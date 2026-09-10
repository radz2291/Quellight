import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';

/**
 * F-1 regression proof at the released VICT HTTP command boundary (the
 * public browser-to-VICT route the `/vict` proxy forwards into).
 *
 * The island's Stop control must send the EXACT released vict.command@1
 * contract — `{ payload: { turnId, reasonCode? } }` plus a non-empty
 * `idempotency-key` header — through the real loopback boundary used in
 * production. These tests prove, against the REAL released boundary:
 *
 * - the pre-remediation request shape (`{"turnId":…}`, no header) is
 *   deterministically rejected with 400 `VICT_HTTP_BODY_MALFORMED`
 *   (fail closed; no cancel intent, no effect);
 * - a correct envelope WITHOUT the idempotency header is rejected with
 *   400 `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`;
 * - malformed and missing-envelope bodies still fail closed;
 * - cancelling an already-terminal turn returns `accepted: false` and
 *   creates no second effect or second terminal frame;
 * - retries of one intent with the same key deduplicate durably.
 *
 * The real-browser click path itself is proven by
 * `scripts/browser-stop-check.mjs` (verify:stop).
 */

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-stop-boundary-'));
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

const TOKEN = `qlt-stop-boundary-${Date.now()}`;
const LONG_TEXT =
  'The stop-boundary suite streams this long scripted response so a cancellation can land mid-stream. '.repeat(
    8,
  );

async function compose(): Promise<{
  composition: Awaited<ReturnType<typeof createQuellightComposition>>;
  origin: string;
}> {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_ACTOR_TOKEN: TOKEN },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    offlineScript: { 'stop boundary probe': { kind: 'text', text: LONG_TEXT } },
  });
  composed.push(composition);
  const port = await composition.listen();
  return { composition, origin: `http://127.0.0.1:${port}` };
}

async function startTurn(
  composition: Awaited<ReturnType<typeof createQuellightComposition>>,
): Promise<{ turnId: string; streamId: string; threadId: string }> {
  const thread = await composition.sharedWorld.createThread({ title: 'Stop boundary thread' });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
  const outcome = await composition.commandService.dispatch(
    { ...composition.actor, presentedTokenKind: 'local-test' as const },
    {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: 'stop boundary probe' },
      idempotencyKey: `stop-boundary-${crypto.randomUUID()}`,
    },
  );
  if (!outcome.ok) {
    throw new Error(`turn start failed: ${outcome.code}`);
  }
  const data = outcome.data as { turnId: string; streamId: string };
  return { ...data, threadId: conversation.mastraThreadId };
}

interface CancelResponse {
  status: number;
  body: { ok: boolean; code?: string; data?: unknown };
}

async function postCancel(
  origin: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<CancelResponse> {
  const response = await fetch(`${origin}/vict/v1/turns/cancel`, {
    method: 'POST',
    // The bearer header is exactly what the /vict proxy injects
    // server-side before forwarding a browser request to this boundary.
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  let parsed: CancelResponse['body'];
  try {
    parsed = (await response.json()) as CancelResponse['body'];
  } catch {
    parsed = { ok: false, code: 'UNPARSEABLE' };
  }
  return { status: response.status, body: parsed };
}

async function terminalKinds(
  composition: Awaited<ReturnType<typeof createQuellightComposition>>,
  streamId: string,
): Promise<string[]> {
  const durable = await composition.stores.streamLedger.listEventsFrom(streamId, 0);
  const kinds: string[] = [];
  for (const row of durable) {
    const kind = (row as { kind?: unknown; event?: { kind?: unknown } }).kind;
    if (typeof kind === 'string') {
      kinds.push(kind);
    } else {
      const nested = (row as { event?: { kind?: unknown } }).event?.kind;
      if (typeof nested === 'string') {
        kinds.push(nested);
      }
    }
  }
  return kinds.filter((kind) =>
    ['response.completed', 'response.failed', 'response.cancelled'].includes(kind),
  );
}

describe('released VICT boundary — stop request contract (F-1 regression)', () => {
  it('the pre-remediation request shape fails closed with VICT_HTTP_BODY_MALFORMED and no effect', async () => {
    const { composition, origin } = await compose();
    const { turnId } = await startTurn(composition);

    // EXACTLY what the shipped island's Stop control sent before
    // remediation (audit P2b/P6): flat body, no idempotency-key header.
    const result = await postCancel(origin, { turnId });
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.code).toBe('VICT_HTTP_BODY_MALFORMED');

    // Fail closed: no cancel intent was durably created by the rejected
    // request.
    expect(await composition.stores.turns.listCancelIntents(turnId)).toHaveLength(0);
  });

  it('a correct envelope without the idempotency header fails closed with VICT_COMMAND_IDEMPOTENCY_KEY_INVALID', async () => {
    const { composition, origin } = await compose();
    const { turnId } = await startTurn(composition);
    const result = await postCancel(origin, { payload: { turnId, reasonCode: 'user' } });
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('VICT_COMMAND_IDEMPOTENCY_KEY_INVALID');
    expect(await composition.stores.turns.listCancelIntents(turnId)).toHaveLength(0);
  });

  it('malformed and missing-envelope bodies still fail closed with VICT_HTTP_BODY_MALFORMED', async () => {
    const { origin } = await compose();
    const key = `stop-${crypto.randomUUID()}`;
    const cases: Array<[unknown, Record<string, string>]> = [
      // Non-object envelope.
      ['[1,2,3]', { 'idempotency-key': key }],
      // Unknown top-level field (the missing-envelope flat shape).
      [{ turnId: 'turn-does-not-exist' }, {}],
      // Unknown top-level field beside the envelope.
      [{ payload: { turnId: 'turn-does-not-exist' }, extra: true }, { 'idempotency-key': key }],
      // Wrong schema marker.
      [
        {
          payload: { turnId: 'turn-does-not-exist' },
          schema: 'vict.command@2',
        },
        { 'idempotency-key': key },
      ],
    ];
    for (const [body, headers] of cases) {
      const result = await postCancel(origin, body, headers);
      expect(result.status).toBe(400);
      expect(result.body.code).toBe('VICT_HTTP_BODY_MALFORMED');
    }
  });

  it('an idempotent retry of one cancellation intent deduplicates with exactly one effect', async () => {
    const { composition, origin } = await compose();
    const { turnId, streamId } = await startTurn(composition);
    const key = `stop-${crypto.randomUUID()}`;
    const envelope = { payload: { turnId, reasonCode: 'user' } };

    // The released fixture turn settles quickly; both retries of the SAME
    // intent (same key, same digest) must produce the same durable
    // disposition and never a second cancellation effect.
    const first = await postCancel(origin, envelope, { 'idempotency-key': key });
    const second = await postCancel(origin, envelope, { 'idempotency-key': key });
    // The released durable idempotent replay answers the retry from the
    // command receipt (the safe `{ command }` projection) WITHOUT
    // re-executing: both responses are 200 ok, and the durable effect
    // happened exactly once.
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);
    expect(second.body.data).toEqual({ command: 'agent.turn.cancel' });

    // Exactly one terminal frame on the stream, whatever the honest race
    // outcome was (cancelled before completion, or completed first), and
    // exactly one durable cancel intent for the turn.
    // The cancel intent is durable immediately; the cooperative abort
    // settles the honest terminal a moment later. Wait for the turn to
    // settle, then assert the durable truth: exactly ONE cancel intent
    // and exactly ONE honest terminal (the released fixture is fast, so
    // either cancelled or completed-first is an honest outcome — the
    // intent is durable in both cases and no second effect ever occurs).
    const settleStarted = Date.now();
    let settledStatus = '';
    for (;;) {
      const turn = await composition.turnService.getTurn(composition.actor, turnId);
      if (['completed', 'failed', 'cancelled'].includes(turn.status)) {
        settledStatus = turn.status;
        break;
      }
      if (Date.now() - settleStarted > 30_000) {
        throw new Error('the cancelled turn did not settle in time');
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
    expect(['cancelled', 'completed']).toContain(settledStatus);
    const kinds = await terminalKinds(composition, streamId);
    expect(kinds).toEqual([
      settledStatus === 'cancelled' ? 'response.cancelled' : 'response.completed',
    ]);
    expect(await composition.stores.turns.listCancelIntents(turnId)).toHaveLength(1);
  });

  it('a post-terminal cancel fails closed (stable conflict) and creates no second terminal', async () => {
    const { composition, origin } = await compose();
    const { turnId, streamId } = await startTurn(composition);
    const started = Date.now();
    for (;;) {
      const turn = await composition.turnService.getTurn(composition.actor, turnId);
      if (turn.status === 'completed') {
        break;
      }
      if (Date.now() - started > 30_000) {
        throw new Error('the fixture turn did not complete in time');
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }

    // The released boundary refuses to cancel a settled turn: a stable
    // conflict (409, VICT_CONTROL_TURN_INVALID_TRANSITION) — never a
    // fabricated cancelled outcome on top of the honest completed one.
    const result = await postCancel(
      origin,
      { payload: { turnId, reasonCode: 'user' } },
      {
        'idempotency-key': `stop-${crypto.randomUUID()}`,
      },
    );
    expect(result.status).toBe(409);
    expect(result.body.ok).toBe(false);
    expect(result.body.code).toBe('VICT_CONTROL_TURN_INVALID_TRANSITION');

    // The honest completed terminal stands; no cancelled terminal was
    // appended by the late cancel request.
    const kinds = await terminalKinds(composition, streamId);
    expect(kinds).toEqual(['response.completed']);
  });
});
