import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentStreamEvent } from '@victframework/contracts';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';
import { connectAgentStream, parseSseFrame } from '../src/lib/islands/stream-client';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-reconnect-'));
  tempDirs.push(dir);
  return dir;
};
const composed: Array<{ close(): Promise<void> }> = [];
afterEach(() => {
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
});
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

const LONG_TEXT =
  'The reconnect scenario streams this long scripted response through many ordered deltas so a mid-stream client drop can be observed deterministically. '.repeat(
    8,
  );

async function compose() {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_ACTOR_TOKEN: `test-token-${Date.now()}` },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    offlineScript: { 'reconnect probe': { kind: 'text', text: LONG_TEXT } },
  });
  composed.push(composition);
  const port = await composition.listen();
  // The token is the loopback transport credential the /vict proxy would
  // inject server-side; tests present it the same way.
  const token = env.actorToken;
  return { composition, port, origin: `http://127.0.0.1:${port}`, token };
}

describe('resumable SSE reconnect over the real loopback boundary (N-8)', () => {
  it('a dropped connection resumes from the acknowledged cursor without loss or duplication', async () => {
    const { composition, origin, token: localToken } = await compose();
    const thread = await composition.sharedWorld.createThread({ title: 'Reconnect thread' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    const outcome = await composition.commandService.dispatch(
      { ...composition.actor, presentedTokenKind: 'local-test' as const },
      {
        command: 'agent.turn.start',
        payload: { threadId: conversation.mastraThreadId, input: 'reconnect probe' },
        idempotencyKey: 'idem-reconnect-1',
      },
    );
    if (!outcome.ok) {
      throw new Error('turn start failed');
    }
    const { streamId } = outcome.data as { streamId: string };
    const token = localToken;

    // ---- first connection: read exactly TWO frames, then drop --------
    const appliedFirst: AgentStreamEvent[] = [];
    let firstCursor = 0;
    const firstController = new AbortController();
    const firstResponse = await fetch(`${origin}/vict/v1/streams/${streamId}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: firstController.signal,
    });
    expect(firstResponse.status).toBe(200);
    const reader = firstResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (appliedFirst.length < 2) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1 && appliedFirst.length < 2) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        const { data } = parseSseFrame(block);
        if (data === undefined) {
          continue;
        }
        const event = JSON.parse(data) as AgentStreamEvent & { seq: number };
        appliedFirst.push(event);
        firstCursor = event.seq;
      }
    }
    firstController.abort();
    expect(firstCursor).toBeGreaterThan(0);

    // ---- reconnect from the acknowledged cursor ----------------------
    const applied: AgentStreamEvent[] = [];
    const result = await connectAgentStream({
      streamId,
      lastSeq: firstCursor,
      onEvent: (frame) => applied.push(frame as unknown as AgentStreamEvent),
      signal: new AbortController().signal,
      baseUrl: origin,
      fetchImpl: ((url: string | URL, init?: RequestInit) =>
        fetch(url, {
          ...(init ?? {}),
          headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
        })) as typeof fetch,
      maxAttempts: 3,
    });
    expect(result.status).toBe('terminal');
    expect(result.lastSeq).toBe(firstCursor + applied.length);

    // Lossless ordered continuation: sequences strictly increase from the
    // cursor; the terminal event is response.completed; the terminal is
    // exactly one.
    let previous = firstCursor;
    for (const event of applied) {
      expect(event.seq).toBeGreaterThan(previous);
      previous = event.seq;
    }
    const terminals = applied.filter((event) =>
      ['response.completed', 'response.failed', 'response.cancelled'].includes(event.kind),
    );
    expect(terminals).toHaveLength(1);
    expect(terminals[0]!.kind).toBe('response.completed');
  });

  it('duplicate delivery of the same frame applies one event (client dedupe)', async () => {
    const applied: Array<{ kind: string; seq: number }> = [];
    const sse = [
      'id: v1:s1:1\nevent: response.started\ndata: {"schema":"vict.agent-stream@1","streamId":"s1","turnId":"t1","threadId":"th1","actorId":"a1","agentProfileVersion":"p1","seq":1,"kind":"response.started"}\n\n',
      'id: v1:s1:2\nevent: text.delta\ndata: {"schema":"vict.agent-stream@1","streamId":"s1","turnId":"t1","threadId":"th1","actorId":"a1","agentProfileVersion":"p1","seq":2,"kind":"text.delta","delta":"hello"}\n\n',
      // at-least-once DUPLICATE of seq 2 with the identical frame
      'id: v1:s1:2\nevent: text.delta\ndata: {"schema":"vict.agent-stream@1","streamId":"s1","turnId":"t1","threadId":"th1","actorId":"a1","agentProfileVersion":"p1","seq":2,"kind":"text.delta","delta":"hello"}\n\n',
      'id: v1:s1:3\nevent: response.completed\ndata: {"schema":"vict.agent-stream@1","streamId":"s1","turnId":"t1","threadId":"th1","actorId":"a1","agentProfileVersion":"p1","seq":3,"kind":"response.completed"}\n\n',
    ].join('');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    const result = await connectAgentStream({
      streamId: 's1',
      lastSeq: 0,
      onEvent: (frame) => applied.push({ kind: frame.kind, seq: frame.seq }),
      signal: new AbortController().signal,
      fetchImpl: (async () => new Response(stream, { status: 200 })) as unknown as typeof fetch,
      maxAttempts: 1,
    });
    expect(result.status).toBe('terminal');
    expect(applied.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(applied.filter((event) => event.kind === 'text.delta')).toHaveLength(1);
  });

  it('N-7: malformed frames — unknown kind, broken envelope, non-monotonic sequence — are rejected structurally', async () => {
    const cases: Array<{ sse: string; expectApplied: number }> = [
      {
        // unknown event kind (outside the closed 13-kind vocabulary)
        sse: 'data: {"schema":"vict.agent-stream@1","streamId":"s2","turnId":"t2","threadId":"th2","actorId":"a2","agentProfileVersion":"p2","seq":1,"kind":"mind.reader"}\n\n',
        expectApplied: 0,
      },
      {
        // broken envelope: missing the schema marker
        sse: 'data: {"streamId":"s3","turnId":"t3","threadId":"th3","actorId":"a3","agentProfileVersion":"p3","seq":1,"kind":"response.started"}\n\n',
        expectApplied: 0,
      },
      {
        // non-monotonic sequence: seq regression below the acknowledged cursor
        sse: 'data: {"schema":"vict.agent-stream@1","streamId":"s4","turnId":"t4","threadId":"th4","actorId":"a4","agentProfileVersion":"p4","seq":0,"kind":"response.started"}\n\n',
        expectApplied: 0,
      },
    ];
    for (const testCase of cases) {
      const applied: unknown[] = [];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(testCase.sse));
          controller.close();
        },
      });
      const result = await connectAgentStream({
        streamId: 'sx',
        lastSeq: 0,
        onEvent: (frame) => applied.push(frame),
        signal: new AbortController().signal,
        fetchImpl: (async () => new Response(stream, { status: 200 })) as unknown as typeof fetch,
        maxAttempts: 1,
      });
      expect(result.status).toBe('unhealthy');
      expect(applied).toHaveLength(testCase.expectApplied);
    }
  });
});
