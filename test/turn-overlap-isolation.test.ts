import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeterministicOfflineModel } from '@victframework/mastra';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
  LOCAL_ACTOR_ID,
  type QuellightComposition,
} from '../src/lib/server/composition';
import { createTurnContextService } from '../src/lib/sharedworld/context-assembler';
import {
  QLT_CONTEXT_ASSEMBLER_VERSION,
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_OPEN,
} from '../src/lib/sharedworld/context-contract';
import { runWithTurnAssemblyScope } from '../src/lib/server/model-seam';
import { POST as turnsPost } from '../src/routes/api/threads/[id]/turns/+server';
import type { QuellightRuntime } from '../src/lib/server/runtime';

/**
 * H-1 remediation regression suite (remediation contract §2/§3).
 *
 * Locks the one-active-turn-per-conversation rule at BOTH layers:
 * the race-safe admission boundary at the real turns ingress, and the
 * model-seam defensive backstop in `resolveForStream` (effective even
 * when the admission invariant is bypassed through a direct internal
 * call or a corrupted-state fixture). A deliberately delayed offline
 * model keeps the first turn open long enough to exercise the real race.
 *
 * State matrix under test (one conversation):
 * - one recorded open turn            -> only that turn replays its snapshot
 * - one record-less open turn         -> only that turn assembles
 * - ≥2 open turns in any combination  -> ambiguous, zero injection, no
 *                                        in-flight promise borrowing, no
 *                                        new assembly
 * - distinct key while a turn is open -> QLT_TURN_ALREADY_OPEN, zero effect
 * - same key                          -> VICT idempotent replay, never a
 *                                        second turn
 * - different conversations           -> concurrent, uninterfered
 */

// High-entropy canaries (fresh per run; NEVER the real credential).
const CANARY_TOKEN = `qlt-token-canary-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-h1-'));
  tempDirs.push(dir);
  return dir;
};

// ---------------------------------------------------------------------------
// Delayed recording model: each doStream registers a gate (the stream stays
// genuinely in flight until released) and records the prompt it received.
// ---------------------------------------------------------------------------

interface RecordedPrompt {
  readonly roles: string[];
  readonly texts: string[];
}

interface ModelHarness {
  readonly recorded: RecordedPrompt[];
  releaseAll(): void;
  factory(): () => unknown;
}

function delayedRecordingModel(script: Record<string, unknown>): ModelHarness {
  const recorded: RecordedPrompt[] = [];
  const gates: Array<() => void> = [];
  return {
    recorded,
    releaseAll(): void {
      for (const release of gates.splice(0)) {
        release();
      }
    },
    factory: () => () => {
      const base = createDeterministicOfflineModel({ script: script as never }) as {
        doStream: (options: unknown) => Promise<unknown>;
      };
      return {
        specificationVersion: 'v2',
        provider: 'delayed-recording-offline',
        modelId: 'delayed-recording-offline',
        supportedUrls: {},
        doStream: async (options: unknown) => {
          const prompt = (options as { prompt?: Array<Record<string, unknown>> }).prompt ?? [];
          const texts: string[] = [];
          for (const message of prompt) {
            const content = message['content'];
            if (typeof content === 'string') {
              texts.push(content);
            } else if (Array.isArray(content)) {
              for (const part of content) {
                if (
                  part !== null &&
                  typeof part === 'object' &&
                  (part as { type?: unknown }).type === 'text'
                ) {
                  texts.push(String((part as { text?: unknown }).text ?? ''));
                }
              }
            }
          }
          recorded.push({ roles: prompt.map((message) => String(message['role'])), texts });
          await new Promise<void>((resolvePromise) => {
            gates.push(resolvePromise);
          });
          return base.doStream(options);
        },
      };
    },
  };
}

async function compose(harness: ModelHarness): Promise<QuellightComposition> {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_ACTOR_TOKEN: CANARY_TOKEN },
    dir,
  );
  return createQuellightComposition({
    env,
    skipListen: true,
    offlineModelFactory: harness.factory(),
  });
}

const composed: Array<{ close(): Promise<void> }> = [];
afterEach(() => {
  routeRuntime?.harness.releaseAll();
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
});
afterAll(async () => {
  if (routeRuntime !== undefined) {
    await routeRuntime.composition.close().catch(() => undefined);
  }
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort on Windows (D-6) */
    }
  }
});

async function awaitTerminal(composition: QuellightComposition, turnId: string): Promise<string> {
  for (let index = 0; index < 800; index += 1) {
    const turn = await composition.stores.turns.getTurn(turnId);
    if (turn && ['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return turn.status;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error('turn did not settle');
}

async function waitFor(predicate: () => Promise<boolean>, what: string): Promise<void> {
  for (let index = 0; index < 800; index += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error(`condition never held: ${what}`);
}

/**
 * Wait until at least `expectedTotal` model calls have REACHED the seam
 * (each holds a gate), then release every held gate. Deterministic gate
 * bookkeeping: a gate registered after a blind releaseAll would hold its
 * turn open forever.
 */
async function releaseWhenRecorded(harness: ModelHarness, expectedTotal: number): Promise<void> {
  await waitFor(
    async () => harness.recorded.length >= expectedTotal,
    `${expectedTotal} model calls`,
  );
  harness.releaseAll();
}

async function createOpenTurnFixture(
  composition: QuellightComposition,
  mastraThreadId: string,
  turnId: string,
): Promise<void> {
  const now = Date.now();
  await composition.stores.turns.createTurnIntent({
    turnId,
    streamId: `stream-${turnId}`,
    threadId: mastraThreadId,
    actorId: LOCAL_ACTOR_ID,
    agentProfileVersion: 'agent.quellight.conversation@3',
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'corrupted-state fixture turn',
    status: 'intent',
    createdAt: now,
    updatedAt: now,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await composition.stores.turns.startTurn(turnId, now);
}

async function writeAssemblyFixture(
  composition: QuellightComposition,
  turnId: string,
  threadId: string,
): Promise<void> {
  await composition.sharedWorld.recordContextAssembly({
    id: `asm-fixture-${turnId}`,
    turnId,
    threadId,
    assemblerVersion: QLT_CONTEXT_ASSEMBLER_VERSION,
    outcome: 'complete',
    selectedIds: [],
    excluded: [],
    orderingIdentity: '[]',
    maxRecords: 8,
    maxBytes: 4096,
    renderedBytes: 0,
    fingerprint: 'f'.repeat(64),
    createdAtMs: Date.now(),
  });
}

/** The per-turn context service wired EXACTLY as the composition wires it. */
function serviceOf(composition: QuellightComposition) {
  return createTurnContextService({
    listCandidates: () => composition.sharedWorld.listContextCandidates(),
    getRowsByIds: (ids) => composition.sharedWorld.getContextRowsByIds(ids),
    recordAssembly: (record) => composition.sharedWorld.recordContextAssembly(record),
    getAssemblyByTurn: (turnId) => composition.sharedWorld.getContextAssemblyByTurn(turnId),
    getLatestAssemblyForThread: (threadId) =>
      composition.sharedWorld.getLatestContextAssemblyForThread(threadId),
    listOpenTurns: () => composition.stores.turns.listOpenTurns(),
    localActorId: LOCAL_ACTOR_ID,
  });
}

function actorOf(composition: QuellightComposition) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

// ---------------------------------------------------------------------------
// Real turns ingress: the route handler against the real composition (the
// exact production boundary the browser calls), via the runtime seam.
// ---------------------------------------------------------------------------

const runtimeHolder = vi.hoisted(() => ({ promise: undefined as Promise<unknown> | undefined }));
vi.mock('$lib/server/runtime', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    getQuellightRuntime: (): Promise<unknown> => {
      const promise = runtimeHolder.promise;
      if (promise === undefined) {
        throw new Error('the route-test runtime was not prepared');
      }
      return promise;
    },
  };
});

let routeRuntime: { composition: QuellightComposition; harness: ModelHarness } | undefined;

beforeAll(async () => {
  const harness = delayedRecordingModel({ Hello: { kind: 'text', text: 'Hi there.' } });
  const composition = await compose(harness);
  routeRuntime = { composition, harness };
  const runtime: QuellightRuntime = {
    composition,
    port: 0,
    victOrigin: () => 'http://127.0.0.1:0',
    actorToken: () => CANARY_TOKEN,
  };
  runtimeHolder.promise = Promise.resolve(runtime) as unknown as Promise<unknown>;
});

function postTurn(threadId: string, input: string, idempotencyKey: string): Promise<Response> {
  if (routeRuntime === undefined) {
    throw new Error('route runtime missing');
  }
  const request = new Request('http://localhost/api/threads/x/turns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input, idempotencyKey }),
  });
  return turnsPost({ request, params: { id: threadId } } as never) as unknown as Promise<Response>;
}

interface TurnReply {
  readonly ok: boolean;
  readonly code?: string;
  readonly data?: { turnId?: string; streamId?: string };
}

async function replyOf(response: Response): Promise<TurnReply> {
  return (await response.json()) as TurnReply;
}

async function openTurnCount(
  composition: QuellightComposition,
  mastraThreadId: string,
): Promise<number> {
  return (await composition.stores.turns.listOpenTurns()).filter(
    (turn) => turn.threadId === mastraThreadId && turn.actorId === LOCAL_ACTOR_ID,
  ).length;
}

async function turnsOfConversation(
  composition: QuellightComposition,
  mastraThreadId: string,
): Promise<unknown[]> {
  return (await composition.stores.turns.listTurns()).filter(
    (turn) => turn.threadId === mastraThreadId,
  );
}

// ---------------------------------------------------------------------------
// Layer 1 — the model-seam defensive backstop (real durable stores)
// ---------------------------------------------------------------------------

describe('H-1 model-seam backstop (real stores; corrupted-state fixtures)', () => {
  it('mixed state (one recorded + one record-less open turn): zero injection for every stream, no promise borrowing, no new assembly', async () => {
    const harness = delayedRecordingModel({ Hello: { kind: 'text', text: 'Hi there.' } });
    const composition = await compose(harness);
    composed.push(composition);
    const thread = await composition.sharedWorld.createThread({ title: 'Mixed' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'early',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Memory present before turn A assembled.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    // Turn A: a REAL open turn whose assembly record exists (its first
    // model call resolved while the stream stays held open).
    const outcome = await runWithTurnAssemblyScope(
      { swThreadId: thread.id, mastraThreadId: conversation.mastraThreadId },
      () =>
        composition.commandService.dispatch(actorOf(composition), {
          command: 'agent.turn.start',
          payload: { threadId: conversation.mastraThreadId, input: 'Hello' },
          idempotencyKey: 'h1-mixed-a',
        }),
    );
    if (!outcome.ok) {
      throw new Error('turn A did not start');
    }
    const turnA = (outcome.data as { turnId: string }).turnId!;
    await waitFor(
      async () => (await composition.sharedWorld.getContextAssemblyByTurn(turnA)) !== undefined,
      'turn A assembly record',
    );
    const recordA = await composition.sharedWorld.getContextAssemblyByTurn(turnA);
    expect(recordA?.outcome).toBe('complete');
    // A memory that exists ONLY after A's frozen snapshot: had any stream
    // later received a freshly assembled (B-attributed) snapshot, this
    // record would leak into it.
    await composition.sharedWorld.meaning.createClaim({
      subject: 'later',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Memory created after turn A froze its snapshot.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    // Turn B: a record-less open turn (corrupted-state fixture — a
    // real-shaped open turn record written directly to the durable store,
    // bypassing the admission invariant: exactly the bypass the backstop
    // must survive).
    const turnB = 'turn-h1-mixed-b-fixture';
    await createOpenTurnFixture(composition, conversation.mastraThreadId, turnB);

    const service = serviceOf(composition);
    const scope = { swThreadId: thread.id, mastraThreadId: conversation.mastraThreadId };
    // Stream 1 (may be turn A's later model call) and stream 2 (may be
    // turn B's first call) must BOTH fail closed: zero injection, no
    // in-flight promise belonging to one turn returned for another, and
    // no new assembly record for B.
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    // no new assembly was created for the record-less turn
    expect(await composition.sharedWorld.getContextAssemblyByTurn(turnB)).toBeUndefined();
    // a third call (still two open turns) stays ambiguous — turn A never
    // receives turn B's snapshot
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    // turn A's own frozen record is unchanged (the later memory never
    // crossed into it) and the transparency truth stays A's own record
    expect(recordA?.selectedIds.length).toBe(1);
    const latest = await composition.sharedWorld.getLatestContextAssemblyForThread(thread.id);
    expect(latest?.turnId).toBe(turnA);
    const summary = await service.summaryForThread(thread.id);
    expect(summary?.outcome).toBe('complete');
    expect(summary?.usedCount).toBe(1);
    harness.releaseAll();
    expect(await awaitTerminal(composition, turnA)).toBe('completed');
  });

  it('an in-flight older turn never lends its resolution to a newer record-less turn', async () => {
    const harness = delayedRecordingModel({ Hello: { kind: 'text', text: 'Hi there.' } });
    const composition = await compose(harness);
    composed.push(composition);
    const thread = await composition.sharedWorld.createThread({ title: 'InFlight' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'pref',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'A confirmed memory.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    const turnA = 'turn-h1-inflight-a';
    await createOpenTurnFixture(composition, conversation.mastraThreadId, turnA);
    // Gate A's first assembly read so its resolution stays genuinely
    // in flight (its promise is registered in the service's in-flight map).
    let releaseA: (() => void) | undefined;
    const gateA = new Promise<void>((resolvePromise) => {
      releaseA = resolvePromise;
    });
    const service = createTurnContextService({
      listCandidates: () => composition.sharedWorld.listContextCandidates(),
      getRowsByIds: (ids) => composition.sharedWorld.getContextRowsByIds(ids),
      recordAssembly: (record) => composition.sharedWorld.recordContextAssembly(record),
      getAssemblyByTurn: async (turnId) => {
        if (turnId === turnA) {
          await gateA;
        }
        return composition.sharedWorld.getContextAssemblyByTurn(turnId);
      },
      getLatestAssemblyForThread: (threadId) =>
        composition.sharedWorld.getLatestContextAssemblyForThread(threadId),
      listOpenTurns: () => composition.stores.turns.listOpenTurns(),
      localActorId: LOCAL_ACTOR_ID,
    });
    const scope = { swThreadId: thread.id, mastraThreadId: conversation.mastraThreadId };
    const pendingA = service.resolveForStream(scope);
    // While A's assembly is in flight, turn B opens (record-less).
    const turnB = 'turn-h1-inflight-b';
    await createOpenTurnFixture(composition, conversation.mastraThreadId, turnB);
    // ANY stream in the scope now sees TWO open turns: ambiguous — and
    // never the promise belonging to turn A.
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    releaseA?.();
    const resolutionA = await pendingA;
    expect(resolutionA).toMatchObject({ kind: 'inject', turnId: turnA });
    // Still ambiguous while both are open (A is now recorded too).
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    expect(await composition.sharedWorld.getContextAssemblyByTurn(turnB)).toBeUndefined();
    // The state matrix's first-turn-terminal row: once A settles, the
    // single record-less turn B assembles normally.
    await composition.stores.turns.completeTurn({
      turnId: turnA,
      status: 'completed',
      at: Date.now(),
    });
    const resAfter = await service.resolveForStream(scope);
    expect(resAfter).toMatchObject({ kind: 'inject', turnId: turnB });
    expect(await composition.sharedWorld.getContextAssemblyByTurn(turnB)).toBeDefined();
  });

  it('two record-less open turns and two recorded open turns both fail closed with zero injection and zero new records', async () => {
    const harness = delayedRecordingModel({ Hello: { kind: 'text', text: 'Hi there.' } });
    const composition = await compose(harness);
    composed.push(composition);
    const thread = await composition.sharedWorld.createThread({ title: 'TwoOpen' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'pref',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'A confirmed memory.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    const service = serviceOf(composition);
    const scope = { swThreadId: thread.id, mastraThreadId: conversation.mastraThreadId };
    // two record-less open turns (corrupted-state fixture)
    await createOpenTurnFixture(composition, conversation.mastraThreadId, 'turn-h1-rl-1');
    await createOpenTurnFixture(composition, conversation.mastraThreadId, 'turn-h1-rl-2');
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    expect(await composition.sharedWorld.getContextAssemblyByTurn('turn-h1-rl-1')).toBeUndefined();
    expect(await composition.sharedWorld.getContextAssemblyByTurn('turn-h1-rl-2')).toBeUndefined();
    // two recorded open turns (corrupted-state fixture: durable records
    // for both, neither stream's model call present)
    await writeAssemblyFixture(composition, 'turn-h1-rl-1', thread.id);
    await writeAssemblyFixture(composition, 'turn-h1-rl-2', thread.id);
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
  });

  it('exactly one record-less open turn still assembles, and exactly one recorded open turn still replays its own frozen block', async () => {
    const harness = delayedRecordingModel({ Hello: { kind: 'text', text: 'Hi there.' } });
    const composition = await compose(harness);
    composed.push(composition);
    const thread = await composition.sharedWorld.createThread({ title: 'Single' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'pref',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The single confirmed memory.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    const service = serviceOf(composition);
    const scope = { swThreadId: thread.id, mastraThreadId: conversation.mastraThreadId };
    // exactly one record-less open turn assembles
    await createOpenTurnFixture(composition, conversation.mastraThreadId, 'turn-h1-single-1');
    const assembled = await service.resolveForStream(scope);
    expect(assembled).toMatchObject({ kind: 'inject', turnId: 'turn-h1-single-1' });
    if (assembled.kind === 'inject') {
      expect(assembled.block).toContain('The single confirmed memory.');
      expect(assembled.block.startsWith(QLT_CONTEXT_BLOCK_OPEN)).toBe(true);
      expect(assembled.block.endsWith(`${QLT_CONTEXT_BLOCK_CLOSE}\n`)).toBe(true);
    }
    // once recorded, later calls of the SAME turn replay the identical block
    const replayed = await service.resolveForStream(scope);
    expect(replayed).toMatchObject({ kind: 'inject', turnId: 'turn-h1-single-1' });
    if (assembled.kind === 'inject' && replayed.kind === 'inject') {
      expect(replayed.block).toBe(assembled.block);
    }
    const record = await composition.sharedWorld.getContextAssemblyByTurn('turn-h1-single-1');
    expect(record?.outcome).toBe('complete');
    expect(record?.selectedIds.length).toBe(1);
    // after the turn settles, zero open turns pass through untouched
    // (existing safe pass-through)
    await composition.stores.turns.completeTurn({
      turnId: 'turn-h1-single-1',
      status: 'completed',
      at: Date.now(),
    });
    expect(await service.resolveForStream(scope)).toEqual({ kind: 'pass', reason: 'ambiguous' });
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — race-safe admission at the REAL turns ingress
// ---------------------------------------------------------------------------

function runtime(): { composition: QuellightComposition; harness: ModelHarness } {
  if (routeRuntime === undefined) {
    throw new Error('route runtime missing');
  }
  return routeRuntime;
}

describe('H-1 admission control over the real turns ingress', () => {
  async function makeThread(
    composition: QuellightComposition,
    title: string,
    statement?: string,
  ): Promise<{ thread: { id: string }; conversation: { mastraThreadId: string } }> {
    const thread = await composition.sharedWorld.createThread({ title });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    if (statement !== undefined) {
      await composition.sharedWorld.meaning.createClaim({
        subject: `${title.toLowerCase()}-pref`,
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement,
        createdBy: LOCAL_ACTOR_ID,
        sourceThreadId: thread.id,
      });
    }
    return { thread, conversation };
  }

  it('two simultaneous distinct-key requests: exactly one durable turn; the other is refused with zero effect', async () => {
    const { composition, harness } = runtime();
    const { thread, conversation } = await makeThread(
      composition,
      'Race',
      'The race thread memory.',
    );
    const meaningCountBefore = (await composition.sharedWorld.meaning.listClaims({})).rows.length;
    const acceptedInput = 'The message that should win the race';
    const refusedInput = 'The second distinct message arriving concurrently';
    const [replyOne, replyTwo] = await Promise.all([
      postTurn(thread.id, acceptedInput, 'h1-race-key-1'),
      postTurn(thread.id, refusedInput, 'h1-race-key-2'),
    ]);
    const replies = [await replyOf(replyOne), await replyOf(replyTwo)];
    const admitted = replies.filter((reply) => reply.ok && reply.data?.turnId !== undefined);
    const refusedReplies = replies.filter((reply) => !reply.ok);
    expect(admitted).toHaveLength(1);
    expect(refusedReplies).toHaveLength(1);
    expect(refusedReplies[0]?.code).toBe('QLT_TURN_ALREADY_OPEN');

    const admittedTurnId = admitted[0]!.data!.turnId!;
    const admittedInput = replies.indexOf(admitted[0]!) === 0 ? acceptedInput : refusedInput;
    const refusedKey =
      replies.indexOf(refusedReplies[0]!) === 0 ? 'h1-race-key-1' : 'h1-race-key-2';
    // exactly one open turn, one model execution, one assembly
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(1);
    await releaseWhenRecorded(harness, 1);
    const blockTexts = harness.recorded[0]!.texts.slice(0, -1);
    expect(blockTexts.some((text) => text.includes('The race thread memory.'))).toBe(true);
    await waitFor(
      async () =>
        (await composition.sharedWorld.getContextAssemblyByTurn(admittedTurnId)) !== undefined,
      'one assembly record',
    );
    // zero effect for the refused request: no idempotency receipt, no
    // second intent, no Shared World mutation
    expect(
      await composition.stores.commandIdempotency.getReceipt({
        actorId: LOCAL_ACTOR_ID,
        command: 'agent.turn.start',
        idempotencyKey: refusedKey,
      }),
    ).toBeUndefined();
    expect(
      (await composition.stores.turns.listTurns()).filter(
        (turn) => turn.threadId === conversation.mastraThreadId,
      ),
    ).toHaveLength(1);
    expect((await composition.sharedWorld.meaning.listClaims({})).rows.length).toBe(
      meaningCountBefore,
    );
    // the admitted turn completes normally; ONLY the accepted input ever
    // reaches the durable transcript
    expect(await awaitTerminal(composition, admittedTurnId)).toBe('completed');
    const restore = await composition.restoreThread(thread.id);
    const userMessages = restore.messages.filter((message) => message.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0]!.text).toBe(admittedInput);
    expect(restore.messages.some((message) => message.text.includes(refusedInput))).toBe(false);
  });

  it('same-key replay during AND after an active turn never creates another turn', async () => {
    const { composition, harness } = runtime();
    const { thread, conversation } = await makeThread(composition, 'SameKey');
    const recordedBefore = harness.recorded.length;
    const first = await replyOf(await postTurn(thread.id, 'Hello', 'h1-same-key-1'));
    expect(first.ok).toBe(true);
    const turnId = first.data!.turnId!;
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(1);
    await releaseWhenRecorded(harness, recordedBefore + 1);
    // the SAME logical request retried while the turn is active: VICT's
    // truthful idempotent disposition, the ORIGINAL turn identity, never
    // a second turn
    const during = await replyOf(await postTurn(thread.id, 'Hello', 'h1-same-key-1'));
    expect(during.ok).toBe(true);
    expect(during.data?.turnId).toBe(turnId);
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(1);
    expect(await awaitTerminal(composition, turnId)).toBe('completed');
    // the settled same-key retry replays the original turn identity
    const after = await replyOf(await postTurn(thread.id, 'Hello', 'h1-same-key-1'));
    expect(after.ok).toBe(true);
    expect(after.data?.turnId).toBe(turnId);
    expect(
      (await composition.stores.turns.listTurns()).filter(
        (turn) => turn.threadId === conversation.mastraThreadId,
      ),
    ).toHaveLength(1);
  });

  it('the same key with different content remains an idempotency conflict and creates no turn', async () => {
    const { composition, harness } = runtime();
    const { thread, conversation } = await makeThread(composition, 'KeyConflict');
    const recordedBefore = harness.recorded.length;
    const first = await replyOf(await postTurn(thread.id, 'First payload', 'h1-conflict-key'));
    expect(first.ok).toBe(true);
    await releaseWhenRecorded(harness, recordedBefore + 1);
    expect(await awaitTerminal(composition, first.data!.turnId!)).toBe('completed');
    const before = (await composition.stores.turns.listTurns()).filter(
      (turn) => turn.threadId === conversation.mastraThreadId,
    ).length;
    const conflict = await replyOf(
      await postTurn(thread.id, 'Different content', 'h1-conflict-key'),
    );
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    const after = (await composition.stores.turns.listTurns()).filter(
      (turn) => turn.threadId === conversation.mastraThreadId,
    ).length;
    expect(after).toBe(before);
  });

  it('a new distinct request after the first turn becomes terminal starts normally', async () => {
    const { composition, harness } = runtime();
    const { thread, conversation } = await makeThread(composition, 'Sequential');
    const recordedBefore = harness.recorded.length;
    const first = await replyOf(await postTurn(thread.id, 'Hello', 'h1-seq-1'));
    expect(first.ok).toBe(true);
    await releaseWhenRecorded(harness, recordedBefore + 1);
    expect(await awaitTerminal(composition, first.data!.turnId!)).toBe('completed');
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(0);
    const second = await replyOf(await postTurn(thread.id, 'Hello', 'h1-seq-2'));
    expect(second.ok).toBe(true);
    expect(second.data?.turnId).not.toBe(first.data!.turnId);
    await releaseWhenRecorded(harness, recordedBefore + 2);
    expect(await awaitTerminal(composition, second.data!.turnId!)).toBe('completed');
  });

  it('concurrent turns in DIFFERENT conversations remain supported with their own snapshots', async () => {
    const { composition, harness } = runtime();
    const recordedBefore = harness.recorded.length;
    const convA = await makeThread(composition, 'ConcurrentA', 'Memory that belongs to A.');
    const convB = await makeThread(composition, 'ConcurrentB', 'Memory that belongs to B.');
    const [replyA, replyB] = await Promise.all([
      postTurn(convA.thread.id, 'Hello', 'h1-conc-a'),
      postTurn(convB.thread.id, 'Hello', 'h1-conc-b'),
    ]);
    const a = await replyOf(replyA);
    const b = await replyOf(replyB);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    await releaseWhenRecorded(harness, recordedBefore + 2);
    expect(await awaitTerminal(composition, a.data!.turnId!)).toBe('completed');
    expect(await awaitTerminal(composition, b.data!.turnId!)).toBe('completed');
    // each turn received its OWN conversation's snapshot
    const prompts = harness.recorded.slice(recordedBefore);
    expect(prompts.length).toBe(2);
    for (const prompt of prompts) {
      const block = prompt.texts[prompt.texts.length - 2]!;
      expect(block.startsWith(QLT_CONTEXT_BLOCK_OPEN)).toBe(true);
    }
    const promptA = prompts.find((prompt) =>
      prompt.texts.some((text) => text.includes('Memory that belongs to A.')),
    );
    const promptB = prompts.find((prompt) =>
      prompt.texts.some((text) => text.includes('Memory that belongs to B.')),
    );
    expect(promptA).toBeDefined();
    expect(promptB).toBeDefined();
    // each durable assembly record binds to its OWN turn
    const recordA = await composition.sharedWorld.getContextAssemblyByTurn(a.data!.turnId!);
    const recordB = await composition.sharedWorld.getContextAssemblyByTurn(b.data!.turnId!);
    expect(recordA?.threadId).toBe(convA.thread.id);
    expect(recordB?.threadId).toBe(convB.thread.id);
    expect(recordA?.fingerprint).not.toBe(recordB?.fingerprint);
  });

  it('the refused request leaves no partial effect even under the delayed-model race (deep zero-effect audit)', async () => {
    const { composition, harness } = runtime();
    const { thread, conversation } = await makeThread(
      composition,
      'ZeroEffect',
      'Zero effect memory.',
    );
    const meaningBefore = (await composition.sharedWorld.meaning.listClaims({})).rows.length;
    const recordedBefore = harness.recorded.length;
    const heldTurn = (async () => {
      const reply = await replyOf(await postTurn(thread.id, 'Hello', 'h1-ze-1'));
      expect(reply.ok).toBe(true);
      return reply.data!.turnId!;
    })();
    await waitFor(
      async () => (await openTurnCount(composition, conversation.mastraThreadId)) === 1,
      'the first turn is durably open',
    );
    await releaseWhenRecorded(harness, recordedBefore + 1);
    // transcript snapshot while the first turn is open
    const restoreMid = await composition.restoreThread(thread.id);
    const refused = await replyOf(
      await postTurn(thread.id, 'The overlapping distinct message', 'h1-ze-2'),
    );
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe('QLT_TURN_ALREADY_OPEN');
    // no receipt, no second transcript message, no Shared World effect
    expect(
      await composition.stores.commandIdempotency.getReceipt({
        actorId: LOCAL_ACTOR_ID,
        command: 'agent.turn.start',
        idempotencyKey: 'h1-ze-2',
      }),
    ).toBeUndefined();
    const restoreAfter = await composition.restoreThread(thread.id);
    expect(restoreAfter.messages.length).toBe(restoreMid.messages.length);
    expect(restoreAfter.messages).toEqual(restoreMid.messages);
    expect((await composition.sharedWorld.meaning.listClaims({})).rows.length).toBe(meaningBefore);
    expect(harness.recorded.length).toBe(recordedBefore + 1);
    // the refused input never reaches the transcript, even after the
    // admitted turn completes
    const turnId = await heldTurn;
    expect(await awaitTerminal(composition, turnId)).toBe('completed');
    const restoreFinal = await composition.restoreThread(thread.id);
    for (const message of restoreFinal.messages) {
      expect(message.text).not.toContain('The overlapping distinct message');
    }
  });
});

// ---------------------------------------------------------------------------
// Restart reconciliation preserves the one-active-turn rule
// ---------------------------------------------------------------------------

describe('H-1 restart reconciliation', () => {
  it('boot reconciliation settles the interrupted turn truthfully and the one-active-turn rule holds afterwards', async () => {
    const { composition, harness } = runtime();
    const thread = await composition.sharedWorld.createThread({ title: 'Restart' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'restart-pref',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Memory for the restart turn.',
      createdBy: LOCAL_ACTOR_ID,
      sourceThreadId: thread.id,
    });
    const first = await replyOf(await postTurn(thread.id, 'Hello', 'h1-restart-1'));
    expect(first.ok).toBe(true);
    const turnId = first.data!.turnId!;
    const recordedBefore = harness.recorded.length;
    await waitFor(
      async () => (await openTurnCount(composition, conversation.mastraThreadId)) === 1,
      'the first turn is durably open',
    );
    await releaseWhenRecorded(harness, recordedBefore + 1);
    // The REAL boot reconciliation path settles the interrupted turn
    // (completeTurn is fenced to open statuses, so the later executor
    // settlement cannot overwrite the reconciled terminal).
    const reconciliation = await composition.turnService.reconcileAfterRestart();
    expect(reconciliation.failed).toBeGreaterThanOrEqual(1);
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(0);
    const settled = await composition.stores.turns.getTurn(turnId);
    expect(['failed', 'cancelled']).toContain(settled?.status);
    // The rule holds after restart: a distinct request is admitted, and
    // while IT is active another distinct request is refused.
    const second = await replyOf(await postTurn(thread.id, 'Hello', 'h1-restart-2'));
    expect(second.ok).toBe(true);
    expect(await openTurnCount(composition, conversation.mastraThreadId)).toBe(1);
    const refused = await replyOf(await postTurn(thread.id, 'Another message', 'h1-restart-3'));
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe('QLT_TURN_ALREADY_OPEN');
    await releaseWhenRecorded(harness, recordedBefore + 2);
    expect(await awaitTerminal(composition, second.data!.turnId!)).toBe('completed');
  });
});
