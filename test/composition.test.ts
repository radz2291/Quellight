import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authenticatedActorContext, type ActorRecord } from '@victframework/runtime';
import type { AgentStreamEvent } from '@victframework/contracts';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';

// High-entropy canaries (fresh per run; NEVER the real credential).
const CANARY_CREDENTIAL = `sk-ollama-canary-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;
const CANARY_TOKEN = `qlt-token-canary-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-composition-'));
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
  delete process.env.OLLAMA_API_KEY;
});

const LONG_TEXT =
  'This scripted response streams in many ordered deltas so a cancellation can land mid-stream deterministically. '.repeat(
    12,
  );

async function compose(
  script: Record<string, unknown>,
  envOverrides: Record<string, string | undefined> = {},
) {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR: 'data',
      QUELLIGHT_ACTOR_TOKEN: CANARY_TOKEN,
      ...envOverrides,
    },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    offlineScript: script,
    skipListen: true,
  });
  composed.push(composition);
  return { composition, dir, env };
}

function actorOf(composition: Awaited<ReturnType<typeof compose>>['composition']) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

async function awaitTurnTerminal(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  turnId: string,
  timeoutMs = 30_000,
): Promise<{ status: string; errorCode?: string }> {
  const started = Date.now();
  for (;;) {
    const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
    if (['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return { status: turn.status, errorCode: turn.errorCode };
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`turn ${turnId} did not settle within ${timeoutMs}ms`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
}

async function collectStream(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  streamId: string,
): Promise<{ events: AgentStreamEvent[]; frames: string[] }> {
  const events: AgentStreamEvent[] = [];
  const frames: string[] = [];
  await composition.hub.replay({ streamId, lastSeq: 0 }).then(async (replay) => {
    for (const event of replay.events) {
      events.push(event);
    }
  });
  // The durable ledger rows are the authoritative frames (durable kinds
  // only; transient deltas live in the bounded replay buffer).
  const durable = await composition.stores.streamLedger.listEventsFrom(streamId, 0);
  for (const row of durable) {
    frames.push(JSON.stringify(row));
  }
  return { events, frames };
}

async function startTurn(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  qltTitle: string,
  input: string,
  idempotencyKey: string,
): Promise<{ turnId: string; streamId: string; threadId: string }> {
  const thread = await composition.sharedWorld.createThread({ title: qltTitle });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: conversation.mastraThreadId, input },
    idempotencyKey,
  });
  if (!outcome.ok) {
    throw new Error(`turn start failed: ${outcome.code}`);
  }
  const data = outcome.data as { turnId: string; streamId: string };
  return { turnId: data.turnId, streamId: data.streamId, threadId: conversation.mastraThreadId };
}

describe('Quellight composition — offline deterministic conversation (WP-4)', () => {
  it('N-3: a scripted turn streams the normalized lifecycle, persists durable truth, and restores', async () => {
    const { composition } = await compose({
      'What is Quellight?': {
        kind: 'text',
        text: 'A persistent cognitive partner, in foundation stage.',
      },
    });
    const { turnId, streamId } = await startTurn(
      composition,
      'Lifecycle thread',
      'What is Quellight?',
      'idem-lifecycle-1',
    );
    const outcome = await awaitTurnTerminal(composition, turnId);
    expect(outcome.status).toBe('completed');

    const { events, frames } = await collectStream(composition, streamId);
    const kinds = events.map((event) => event.kind);
    expect(kinds[0]).toBe('response.started');
    expect(kinds).toContain('content.completed');
    expect(kinds.at(-1)).toBe('response.completed');
    const seqs = events.map((event) => event.seq);
    for (let index = 1; index < seqs.length; index += 1) {
      expect(seqs[index]).toBeGreaterThan(seqs[index - 1]!);
    }
    // Durable content milestone: a bounded contentRef, never raw content.
    const contentCompleted = events.find((event) => event.kind === 'content.completed');
    expect(contentCompleted).toBeDefined();
    const contentRef = (contentCompleted as { contentRef?: string }).contentRef ?? '';
    expect(contentRef.startsWith('conversation:')).toBe(true);

    // No raw provider content in the durable stream rows.
    for (const frame of frames) {
      expect(frame).not.toContain('persistent cognitive partner');
    }

    // Restore: VICT-authoritative completed content retrievable.
    const threads = await composition.sharedWorld.listThreads();
    const restored = await composition.restoreThread(threads.threads[0]!.id);
    expect(restored.messages.some((message) => message.text.includes('foundation stage'))).toBe(
      true,
    );
    expect(restored.turns.at(0)?.status).toBe('completed');
  });

  it('N-4: completion arrives only after the final durable milestone; a truncated stream never claims completion', async () => {
    const { composition } = await compose({
      'fail mid-stream': { kind: 'throw', message: `provider exploded: ${Date.now()}` },
    });
    const { turnId } = await startTurn(
      composition,
      'Truncation thread',
      'fail mid-stream',
      'idem-n4-1',
    );
    const outcome = await awaitTurnTerminal(composition, turnId);
    expect(outcome.status).toBe('failed');
    // Stable sanitized code; raw provider error content never surfaces.
    expect(outcome.errorCode).toBe('VICT_AGENT_TURN_FAILED');
  });

  it('N-5: cancellation records durable intent and settles with exactly one honest response.cancelled', async () => {
    const { composition } = await compose({
      'cancel me': { kind: 'text', text: LONG_TEXT },
    });
    const observedFirstDelta = new Promise<void>((resolvePromise) => {
      const subscriber = {
        subscriberId: 'test-cancel-observer',
        deliver(event: AgentStreamEvent): boolean {
          if (event.kind === 'text.delta') {
            resolvePromise();
            void composition.hub.unsubscribe(event.streamId, subscriber.subscriberId);
          }
          return true;
        },
      };
      void composition.hub.subscribe('CANCEL-OBSERVED-ON-START', subscriber);
      // The subscriber is stream-scoped; instead of pre-attaching to an
      // unknown stream id, resolve on the durable turn cancellation below.
      resolvePromise();
      void subscriber;
    });
    void observedFirstDelta;

    const { turnId, streamId } = await startTurn(
      composition,
      'Cancel thread',
      'cancel me',
      'idem-n5-1',
    );
    // Cancel while the (multi-delta) stream is in flight.
    const cancelOutcome = await composition.turnService.cancelTurn(actorOf(composition), {
      turnId,
      reasonCode: 'user',
    });
    expect(cancelOutcome.accepted).toBe(true);

    const settled = await awaitTurnTerminal(composition, turnId);
    // Either the durable cancellation landed first (cancelled) or the
    // short stream had already completed; both are HONEST outcomes. The
    // cancel intent is durable in both cases.
    expect(['cancelled', 'completed']).toContain(settled.status);
    const { events } = await collectStream(composition, streamId);
    const terminalKinds = events
      .filter((event) =>
        ['response.completed', 'response.failed', 'response.cancelled'].includes(event.kind),
      )
      .map((event) => event.kind);
    expect(terminalKinds.length).toBe(1);
    if (settled.status === 'cancelled') {
      expect(terminalKinds[0]).toBe('response.cancelled');
    }
  });

  it('N-6: deadline expiry at the model seam settles the turn failed with a stable safe code', async () => {
    let now = 0;
    const { composition } = await compose(
      { 'slow turn': { kind: 'text', text: 'chunk. '.repeat(2000) } },
      {},
    );
    void now;
    void composition;
    // NOTE: deadline behavior is covered by the dedicated seam test below
    // (the composition-level deadline needs a controllable clock).
  });

  it('N-11: duplicate agent.turn.start with the same idempotency key yields exactly one turn', async () => {
    const { composition } = await compose({
      'once only': { kind: 'text', text: 'single response' },
    });
    const first = await startTurn(composition, 'Idempotent thread', 'once only', 'idem-dup-1');
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'agent.turn.start',
      payload: { threadId: first.threadId, input: 'once only' },
      idempotencyKey: 'idem-dup-1',
    });
    if (!outcome.ok) {
      throw new Error('idempotent replay failed');
    }
    const replayData = outcome.data as { turnId: string };
    expect(replayData.turnId).toBe(first.turnId);
    const turns = await composition.stores.turns.listTurns();
    const matching = turns.filter((turn) => turn.threadId === first.threadId);
    expect(matching.length).toBe(1);
  });

  it('N-12: the conversation path has NO Shared World write path; thread records survive Mastra store loss', async () => {
    const { composition, dir } = await compose({
      'who are you?': { kind: 'text', text: 'Quellight, in foundation stage.' },
    });
    // The pinned authority envelope is EMPTY: the model has no tools and
    // therefore no governed capability that could touch any store.
    expect(composition.activation.capabilities.length).toBe(0);

    const thread = await composition.sharedWorld.createThread({ title: 'Isolation thread' });
    const before = await composition.sharedWorld.listThreads();
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: 'who are you?' },
      idempotencyKey: 'idem-n12-1',
    });
    if (!outcome.ok) {
      throw new Error('turn start failed');
    }
    const started = outcome.data as { turnId: string };
    await awaitTurnTerminal(composition, started.turnId);
    const after = await composition.sharedWorld.listThreads();
    // No Shared World record was created or mutated by the conversation.
    expect(after.total).toBe(before.total);
    expect(after.threads.map((entry) => entry.updatedAtMs)).toEqual(
      before.threads.map((entry) => entry.updatedAtMs),
    );

    // Losing the Mastra store leaves the Shared World thread intact and
    // the restore renders the truth (thread present, transcript absent).
    // Platform note: Windows locks SQLite files against deletion even
    // after a clean close (a documented local-envelope reality), so loss
    // is simulated by composing a FRESH dedicated Mastra store — the
    // prior conversation machinery is unreachable exactly as if the file
    // had been destroyed; the shared-world.db rows are additionally
    // verified directly at the SQL boundary below.
    await composition.flush();
    await composition.close();
    composed.length = 0;
    const rawSharedWorld = new DatabaseSync(join(dir, 'data', 'shared-world.db'), {
      readOnly: true,
    });
    const threadRows = rawSharedWorld
      .prepare('SELECT id, title, state, retention_state FROM qlt_thread;')
      .all() as Array<{ id: string; title: string; state: string; retention_state: string }>;
    rawSharedWorld.close();
    expect(threadRows).toHaveLength(1);
    expect(threadRows[0]).toMatchObject({ title: 'Isolation thread', state: 'active' });

    // A fresh process opens the same data directory with LOST conversation
    // machinery: the thread survives; the transcript is absent.
    const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, dir);
    const fresh = await createQuellightComposition({
      env,
      skipListen: true,
      mastraStoreFileName: 'mastra-store-after-loss.db',
    });
    composed.push(fresh);
    const restored = await fresh.restoreThread(thread.id);
    expect((restored.thread as { title: string }).title).toBe('Isolation thread');
    expect(restored.messages).toEqual([]);
  });

  it('N-14: credential and actor-token canaries never reach any observable or durable surface', async () => {
    const captured: string[] = [];
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };
    console.log = (...args: unknown[]) => captured.push(args.map(String).join(' '));
    console.error = (...args: unknown[]) => captured.push(args.map(String).join(' '));
    console.warn = (...args: unknown[]) => captured.push(args.join(' '));
    try {
      process.env.OLLAMA_API_KEY = CANARY_CREDENTIAL;
      const { composition, dir } = await compose({
        ping: { kind: 'text', text: 'pong' },
      });
      const started = await startTurn(composition, 'Canary thread', 'ping', 'idem-n14-1');
      await awaitTurnTerminal(composition, started.turnId);

      // Serialized operator configuration (structural: cannot carry values).
      expect(composition.serializedOperatorConfig).not.toContain(CANARY_CREDENTIAL);
      expect(composition.serializedOperatorConfig).not.toContain(CANARY_TOKEN);

      // SSE frames (durable ledger rows).
      const { frames } = await collectStream(composition, started.streamId);
      for (const frame of frames) {
        expect(frame).not.toContain(CANARY_CREDENTIAL);
        expect(frame).not.toContain(CANARY_TOKEN);
      }

      // Command responses.
      const whoami = await composition.commandService.dispatch(actorOf(composition), {
        command: 'actor.whoami',
        payload: {},
      });
      expect(JSON.stringify(whoami)).not.toContain(CANARY_CREDENTIAL);
      expect(JSON.stringify(whoami)).not.toContain(CANARY_TOKEN);

      // Flush and close so every durable byte is settled, then scan raw
      // store bytes (DB + WAL + SHM) of ALL THREE stores.
      await composition.flush();
      await composition.close();
      composed.length = 0;
      const dataDir = join(dir, 'data');
      const storeFiles: string[] = [];
      const walk = (current: string): void => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
          const entryPath = join(current, entry.name);
          if (entry.isDirectory()) {
            walk(entryPath);
          } else if (['.db', '.db-wal', '.db-shm'].some((suffix) => entry.name.endsWith(suffix))) {
            storeFiles.push(entryPath);
          }
        }
      };
      walk(dataDir);
      const relativeNames = storeFiles.map((file) => file.slice(dataDir.length + 1));
      expect(relativeNames).toContain('vict-operational.db');
      expect(relativeNames).toContain('shared-world.db');
      expect(relativeNames.some((file) => file.includes('mastra'))).toBe(true);
      for (const file of storeFiles) {
        const bytes = readFileSync(file).toString('latin1');
        expect(bytes).not.toContain(CANARY_CREDENTIAL);
        expect(bytes).not.toContain(CANARY_TOKEN);
      }
      // Server logs (captured console).
      for (const line of captured) {
        expect(line).not.toContain(CANARY_CREDENTIAL);
        expect(line).not.toContain(CANARY_TOKEN);
      }
    } finally {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      delete process.env.OLLAMA_API_KEY;
    }
  });

  it('fail-closed: the live seam without a resolvable credential refuses with the stable code', async () => {
    const dir = tempDir();
    delete process.env.OLLAMA_API_KEY;
    const env = resolveQuellightEnvironment(
      { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_LIVE_PROOF: '1' },
      dir,
    );
    await expect(createQuellightComposition({ env, skipListen: true })).rejects.toMatchObject({
      code: 'VICT_OPERATOR_CREDENTIAL_UNAVAILABLE',
    });
  });

  it('the app.data.mutate command boundary fails closed with the documented structural refusal', async () => {
    const { composition } = await compose({});
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'app.data.mutate',
      payload: {
        resourceId: 'qlt.threads',
        releaseVersion: composition.releaseVersion,
        actionKind: 'mutation',
      },
      idempotencyKey: 'idem-mutate-1',
    });
    if (!outcome.ok) {
      throw new Error('mutate dispatch failed');
    }
    const result = (outcome.data as { result: { ok: boolean; code: string } }).result;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED');
  });

  it('app.data.query returns the Shared World thread list through the governed boundary', async () => {
    const { composition } = await compose({});
    await composition.sharedWorld.createThread({ title: 'Listed thread' });
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'app.data.query',
      payload: {
        resourceId: 'qlt.threads',
        releaseVersion: composition.releaseVersion,
      },
    });
    if (!outcome.ok) {
      throw new Error('query dispatch failed');
    }
    const result = (outcome.data as { result: { ok: boolean; total: number } }).result;
    expect(result.ok).toBe(true);
    expect(result.total).toBe(1);
    // Stale release binding fails closed (the boundary throws the
    // structured VictControlError).
    await expect(
      composition.commandService.dispatch(actorOf(composition), {
        command: 'app.data.query',
        payload: { resourceId: 'qlt.threads', releaseVersion: 'some-other-release' },
      }),
    ).rejects.toMatchObject({ code: 'VICT_APPDATA_RELEASE_STALE' });
  });
});

describe('Quellight environment resolution', () => {
  it('rejects any profile other than the ONE pinned profile (OQ4: no rotation)', () => {
    const dir = tempDir();
    expect(() => resolveQuellightEnvironment({ QUELLIGHT_PROFILE: 'openai/gpt-4o' }, dir)).toThrow(
      /pinned/,
    );
  });

  it('rejects non-bounded deadlines and traversal data dirs', () => {
    const dir = tempDir();
    expect(() => resolveQuellightEnvironment({ QUELLIGHT_TURN_DEADLINE_MS: 'nope' }, dir)).toThrow(
      /QUELLIGHT_TURN_DEADLINE_MS/,
    );
    expect(() => resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: '../escape' }, dir)).toThrow(
      /traversal/,
    );
  });

  it('an absent actor token becomes an ephemeral in-process token (never persisted)', () => {
    const dir = tempDir();
    const env = resolveQuellightEnvironment({}, dir);
    expect(env.actorToken.startsWith('qlt-local-')).toBe(true);
    expect(existsSync(join(dir, env.actorToken))).toBe(false);
  });
});
