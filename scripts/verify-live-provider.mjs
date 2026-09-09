#!/usr/bin/env node
/**
 * Quellight bounded LIVE-provider proof (N-15) — Ollama Cloud,
 * glm-5.3-flash via ollama-cloud/glm-5.3-flash at https://ollama.com/v1.
 *
 * Hard gate: the script refuses to run unless BOTH
 *   - QUELLIGHT_LIVE_PROOF=1 is set explicitly, and
 *   - OLLAMA_API_KEY exists in the process environment (existence only;
 *     the value is never printed, logged or written anywhere).
 *
 * Bounded scenario (<= 5 turns, output capped to 256 tokens/turn):
 *   t1: short prompt → completed (metadata only)
 *   t2: short prompt → cancelled mid-stream (truthful terminal)
 *   full process restart on the same data dir (durable reconciliation)
 *   restore: t1 completed content present; t2 honestly non-completed
 *   t3: one further turn in the restarted process → completed
 *
 * METADATA ONLY: no conversation content is ever printed. As a leak
 * check, every byte under the proof's data directory and every captured
 * ledger frame is scanned for the credential VALUE; any hit fails the
 * proof.
 *
 * This script runs OUTSIDE the automated test suite by explicit operator
 * invocation: npm run verify:live-provider.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);

console.log('verify:live-provider — bounded Ollama Cloud live proof (N-15)');

// ---------- gate ----------
if (process.env.QUELLIGHT_LIVE_PROOF !== '1') {
  console.error('REFUSED: QUELLIGHT_LIVE_PROOF must be set to exactly 1 to run the live proof.');
  process.exit(2);
}
const credentialPresent =
  typeof process.env.OLLAMA_API_KEY === 'string' && process.env.OLLAMA_API_KEY.length > 0;
if (!credentialPresent) {
  console.error(
    'REFUSED: OLLAMA_API_KEY is not present in the process environment. Configure it in the implementation process environment (never in chat, source, or committed files), then re-run.',
  );
  process.exit(2);
}
note('gate: QUELLIGHT_LIVE_PROOF=1 present; OLLAMA_API_KEY present (value never inspected)');
const CREDENTIAL = process.env.OLLAMA_API_KEY;

// ---------- composition (tsx-loaded TS) ----------
const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  new URL('../src/lib/server/composition.ts', import.meta.url).href
);

const dataDir = mkdtempSync(join(tmpdir(), 'qlt-live-proof-'));
const composed = [];
const composeLive = async () => {
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR: 'data',
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_MAX_OUTPUT_TOKENS: '256',
      QUELLIGHT_TURN_DEADLINE_MS: '60000',
    },
    dataDir,
  );
  const composition = await createQuellightComposition({ env, skipListen: true });
  composed.push(composition);
  return composition;
};

const actorOf = (composition) => ({
  ...composition.actor,
  presentedTokenKind: 'local-test',
});

const awaitTerminal = async (composition, turnId, timeoutMs = 90_000) => {
  const startedAt = Date.now();
  for (;;) {
    const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
    if (['completed', 'failed', 'cancelled'].includes(turn.status)) {
      return { status: turn.status, errorCode: turn.errorCode, elapsedMs: Date.now() - startedAt };
    }
    if (Date.now() - startedAt > timeoutMs) {
      return {
        status: `timeout-waiting(${turn.status})`,
        errorCode: undefined,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
};

const startTurn = async (composition, threadLinkId, input, idempotencyKey) => {
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: threadLinkId, input },
    idempotencyKey,
  });
  if (!outcome.ok) {
    throw new Error(`turn start failed: ${outcome.code}`);
  }
  return outcome.data;
};

const SHORT_PROMPTS = [
  'Reply with the single word: ready.',
  'Reply with the single word: steady.',
  'Reply with the single word: done.',
];

const leakScan = (label) => {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else {
        const bytes = readFileSync(full);
        if (bytes.includes(CREDENTIAL)) {
          fail(`${label}: credential value found in ${entry} — LEAK`);
        }
      }
    }
  };
  walk(dataDir);
};

try {
  // ---------- session 1 ----------
  const composition = await composeLive();
  if (composition.modelMode !== 'live') {
    fail(`modelMode is ${composition.modelMode}, expected live`);
  }
  note('composed in live mode against ollama-cloud/glm-5.3-flash');

  const thread = await composition.sharedWorld.createThread({ title: 'Live proof thread' });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);

  // t1: completed
  const t1StartedAt = Date.now();
  const t1 = await startTurn(composition, conversation.mastraThreadId, SHORT_PROMPTS[0], 'live-t1');
  const t1Settled = await awaitTerminal(composition, t1.turnId);
  note(
    `t1: status=${t1Settled.status} in ${Date.now() - t1StartedAt}ms (turnId recorded, content not printed)`,
  );
  if (t1Settled.status !== 'completed') {
    fail(`t1 expected completed, got ${t1Settled.status} (${t1Settled.errorCode ?? 'no code'})`);
  }
  const t1Frames = await composition.stores.streamLedger.listEventsFrom(t1.streamId, 0);
  const t1Seqs = t1Frames.map((frame) => frame.event?.seq ?? frame.seq);
  for (let index = 1; index < t1Seqs.length; index += 1) {
    if (t1Seqs[index] <= t1Seqs[index - 1]) {
      fail(`t1 stream sequences not strictly increasing at position ${index}`);
      break;
    }
  }
  const t1Terminals = t1Frames.filter((frame) => {
    const kind = frame.event?.kind ?? frame.kind;
    return ['response.completed', 'response.failed', 'response.cancelled'].includes(kind);
  });
  if (t1Terminals.length !== 1) {
    fail(`t1 expected exactly one terminal frame, found ${t1Terminals.length}`);
  }

  // t2: cancelled mid-stream
  const t2 = await startTurn(composition, conversation.mastraThreadId, SHORT_PROMPTS[1], 'live-t2');
  const cancelOutcome = await composition.turnService.cancelTurn(actorOf(composition), {
    turnId: t2.turnId,
    reasonCode: 'user',
  });
  const t2Settled = await awaitTerminal(composition, t2.turnId);
  note(
    `t2: cancel accepted=${cancelOutcome.accepted}, settled status=${t2Settled.status} (${t2Settled.errorCode ?? 'no code'})`,
  );
  if (t2Settled.status !== 'cancelled') {
    fail(`t2 expected cancelled, got ${t2Settled.status}`);
  }
  if (t2Settled.errorCode !== 'VICT_TURN_CANCELLED') {
    fail(`t2 expected stable code VICT_TURN_CANCELLED, got ${t2Settled.errorCode}`);
  }

  // credential leak scan for session 1 writes
  leakScan('session-1 stores');

  // ---------- full process restart on the same data dir ----------
  const restartBeganAt = Date.now();
  await composition.close();
  composed.length = 0;
  const composition2 = await composeLive();
  note(`restarted composition on the same data dir in ${Date.now() - restartBeganAt}ms`);

  const restored = await composition2.restoreThread(thread.id);
  const restoredTurns = restored.turns.map((turn) => ({
    status: turn.status,
    code: turn.errorCode ?? null,
  }));
  note(
    `restore: ${restored.messages.length} durably restored message(s); turns=${JSON.stringify(restoredTurns)}`,
  );
  if (restoredTurns.filter((turn) => turn.status === 'completed').length !== 1) {
    fail('restore expected exactly the one completed turn from session 1');
  }
  if (restoredTurns.filter((turn) => turn.status === 'cancelled').length !== 1) {
    fail('restore expected the cancelled turn to remain truthfully cancelled');
  }
  if (restored.messages.length < 2) {
    fail('restore expected the completed exchange to be present (user + assistant)');
  }

  // t3: conversation continues in the restarted process
  const t3 = await startTurn(
    composition2,
    conversation.mastraThreadId,
    SHORT_PROMPTS[2],
    'live-t3',
  );
  const t3Settled = await awaitTerminal(composition2, t3.turnId);
  note(`t3 (post-restart): status=${t3Settled.status}`);
  if (t3Settled.status !== 'completed') {
    fail(`t3 expected completed, got ${t3Settled.status} (${t3Settled.errorCode ?? 'no code'})`);
  }

  // final leak scans: store bytes + captured ledger frames
  leakScan('all stores (post-proof)');
  const allFrames = [
    ...(await composition2.stores.streamLedger.listEventsFrom(t1.streamId, 0)),
    ...(await composition2.stores.streamLedger.listEventsFrom(t2.streamId, 0)),
    ...(await composition2.stores.streamLedger.listEventsFrom(t3.streamId, 0)),
  ]
    .map((frame) => JSON.stringify(frame))
    .join('\n');
  if (allFrames.includes(CREDENTIAL)) {
    fail('credential value found in ledger frames — LEAK');
  }
  if (composition2.serializedOperatorConfig.includes(CREDENTIAL)) {
    fail('credential value found in serialized operator configuration — LEAK');
  }

  await composition2.close();
  composed.length = 0;
} catch (error) {
  fail(`live proof crashed: ${String(error && error.message ? error.message : error)}`);
} finally {
  for (const composition of composed.splice(0)) {
    await composition.close().catch(() => undefined);
  }
  // best-effort temp cleanup (Windows may briefly hold locks; inert on failure)
  const attempt = (remaining) => {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      if (remaining > 0) {
        spawnSync(process.platform === 'win32' ? 'timeout' : 'sleep', [
          process.platform === 'win32' ? '/t' : '0.5',
          ...(process.platform === 'win32' ? ['1', '/nobreak'] : []),
        ]);
        attempt(remaining - 1);
      }
    }
  };
  attempt(5);
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:live-provider: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log(
  'verify:live-provider: PASS — 3 bounded live turns (completed, cancelled, post-restart completed), durable restore truthful, credential absent from all persisted bytes and frames (N-15).',
);
