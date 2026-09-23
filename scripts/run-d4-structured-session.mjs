#!/usr/bin/env node
/**
 * Quellight Stage 07D Phase D4 — the MSTR-012 bounded structured
 * real-use session (proof contract `quellight.stage07d.d4.proof-contract@2`).
 *
 * OWNER-INVOKED ONLY; not part of any test suite. Refuses to run unless
 * ALL of the following hold:
 *   - QUELLIGHT_D4_STRUCTURED=1 is set explicitly (session intent);
 *   - the one-shot authorization receipt
 *     docs/report/evidence/d4-structured-session-receipt.json does NOT
 *     exist (exclusive-create; any later run refuses — only the OWNER
 *     may archive a consumed receipt to authorize a fresh session);
 *   - the provider credential is present through the owner-designated
 *     authentication boundary (the Q6-precedent credential file; the
 *     environment variable is accepted as a secondary source) —
 *     EXISTENCE ONLY; the value is never printed, logged, persisted,
 *     reported, or copied anywhere;
 *   - the owner scenario file (QUELLIGHT_D4_SCENARIO_FILE) exists
 *     outside the repository; its content stays in memory, never
 *     printed; only its SHA-256 digest (memory-only) feeds the leak
 *     scanners.
 *
 * STRUCTURAL EVIDENCE ONLY: every ledger receipt carries statuses,
 * counters, and product identities — never conversation content,
 * credential values, filesystem paths, scenario text, or raw
 * prompts/responses. The ledger validator and the seal fail closed on
 * any violation. Request bounds are enforced BEFORE transport by the
 * Q6 provider observer (request cap, per-turn cap, deadline, token cap).
 *
 * Deletion runs ONLY through the governed user surfaces the product UI
 * uses (the conversation-lifecycle services and governed ceremony
 * actions) and only on dedicated d4-proof-* records/threads. The
 * harness gains no deletion authority beyond them.
 *
 * A7 (contract §2, Amendment 1): DETERMINISTIC AT THE PRODUCT
 * BOUNDARY. The owner establishes the standing d4-proof-* commitment
 * through the governed plan; for EVERY commitment-kind proposal the
 * session turn produced, the owner exercises the real decision
 * boundary (confirmProposal): same key ⇒ quiet QLT_COMMITMENT_CONFLICT
 * refusal + challenge row + user-only dismissal; distinct key ⇒
 * ordinary confirmation. Required: the standing commitment is
 * unchanged after all observations, no challenge remains open, and
 * refusals mutated nothing. No commitment proposal ⇒ A7 still passes —
 * model discretion can never prevent completion (the full refusal
 * class is permanently proven offline by verify:d4-prep N-D4-P-23).
 * A live collision is recorded as the observation conflictClassExercised.
 *
 * Model discretion is a real-use OBSERVATION only: whether the turns
 * draft proposals, which semantic keys they choose, and which
 * capabilities they call are recorded as structural detail facts under
 * the contract's observation vocabulary — none of them gates a
 * required check (Amendment 1).
 *
 * This preparation phase NEVER RUNS the harness; verify:d4-prep proves
 * the gate, scanner, and seal machinery offline on synthetic data.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QLT_D4_BOUNDS,
  QLT_D4_CODES,
  QLT_D4_CREDENTIAL_VAR,
  QLT_D4_EVIDENCE_PATH,
  QLT_D4_PROFILE,
  QLT_D4_PROOF_CONTRACT_ID,
  QLT_D4_RECEIPT_PATH,
  QLT_D4_SCENARIO_VAR,
  QLT_D4_SESSION_FLAG,
} from '../src/lib/sharedworld/d4-contract.ts';
import {
  createEvidenceLedger,
  planBudget,
  readAuthorizationReceipt,
  resolveWorkspace,
  scenarioDigestOf,
  sealEvidence,
  writeAuthorizationReceipt,
} from './lib/d4-evidence.mjs';
import { installProviderObserver } from './lib/q6-provider-observer.mjs';
import { getCompiledPlan } from '../src/lib/application/definition.ts';
import { QLT_CONTEXT_BLOCK_OPEN } from '../src/lib/sharedworld/context-contract.ts';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const refuse = (code, message) => {
  // Preflight refusals run BEFORE the heavy application import and before
  // any receipt, workspace, or evidence exists (nothing needs durable
  // preservation); the single-line console write at this depth is
  // empirically synchronous on this platform (verified by the D4b
  // forensics captures), so the abrupt exit cannot discard it.
  console.error(`${code}: ${message}`);
  process.exit(2);
};

console.log('run-d4-structured-session — bounded MSTR-012 real-use session (D4)');

// ---------- 1. session flag ----------
if (process.env[QLT_D4_SESSION_FLAG] !== '1') {
  refuse(QLT_D4_CODES.NOT_AUTHORIZED, `${QLT_D4_SESSION_FLAG} must be set to exactly 1.`);
}

// ---------- 2. one-shot authorization receipt ----------
const receiptPath = join(repoRoot, QLT_D4_RECEIPT_PATH);
const receiptState = readAuthorizationReceipt(receiptPath);
if (receiptState.ok) {
  refuse(
    QLT_D4_CODES.ALREADY_AUTHORIZED,
    'the authorization receipt already exists — this session was consumed. Only the owner may archive it.',
  );
}
if (receiptState.code !== QLT_D4_CODES.NOT_AUTHORIZED) {
  refuse(receiptState.code, 'the existing authorization receipt is malformed.');
}

// ---------- 2b. active output paths must be absent ------------------------
// Every run writes its OWN receipt, evidence summary, and cleanup record;
// a file already occupying any of these paths belongs to a previous
// attempt whose bundle must be archived first. Refusing here — before the
// credential, scenario, workspace, or authorization consumption — proves
// the run can never append to, or silently overwrite, another attempt's
// record, and can never exit 0 without recording its own evidence.
const evidencePath = join(repoRoot, QLT_D4_EVIDENCE_PATH);
const cleanupPath = join(repoRoot, `${QLT_D4_EVIDENCE_PATH}.cleanup.json`);
for (const [occupiedLabel, occupiedPath] of [
  ['evidence summary', evidencePath],
  ['cleanup record', cleanupPath],
]) {
  if (existsSync(occupiedPath)) {
    refuse(
      QLT_D4_CODES.SEAL_REFUSED,
      `a ${occupiedLabel} from a previous attempt still occupies the active path — archive the previous attempt's receipt/evidence/cleanup bundle first.`,
    );
  }
}

// ---------- 3. credential presence (existence only; never persisted) ------
// QUELLIGHT_D4_CREDENTIAL_SOURCE=none is a TEST-ONLY override (used by
// verify:d4-prep to force the missing-credential refusal deterministically
// on machines where the owner-located auth file exists).
const credentialBlocked = process.env.QUELLIGHT_D4_CREDENTIAL_SOURCE === 'none';
let credential = credentialBlocked ? undefined : process.env[QLT_D4_CREDENTIAL_VAR];
if (!credentialBlocked && (typeof credential !== 'string' || credential.length === 0)) {
  try {
    credential = JSON.parse(readFileSync(join(homedir(), '.pi/agent/auth.json'), 'utf8')).ollama
      .key;
  } catch {
    credential = undefined;
  }
}
if (typeof credential !== 'string' || credential.length === 0) {
  refuse(
    QLT_D4_CODES.CREDENTIAL_MISSING,
    'the provider credential is not present; nothing was created or touched.',
  );
}

// ---------- 4. owner scenario (memory only; never printed) ----------------
const scenarioPath = process.env[QLT_D4_SCENARIO_VAR];
if (typeof scenarioPath !== 'string' || scenarioPath.length === 0 || !existsSync(scenarioPath)) {
  refuse(
    QLT_D4_CODES.SCENARIO_MISSING,
    `${QLT_D4_SCENARIO_VAR} must point to the owner scenario file (outside the repository).`,
  );
}
let scenario;
try {
  scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));
} catch {
  refuse(QLT_D4_CODES.SCENARIO_MISSING, 'the scenario file is not valid JSON.');
}
for (const key of [
  'chatter',
  'durableRemember',
  'durableSecond',
  'ordinaryFollowup',
  'freshProbe',
  'preservedNote',
  'removableNote',
]) {
  if (typeof scenario[key] !== 'string' || scenario[key].length === 0) {
    refuse(QLT_D4_CODES.SCENARIO_MISSING, `the scenario file is missing the "${key}" entry.`);
  }
}
const scenarioDigest = scenarioDigestOf(readFileSync(scenarioPath));

// ---------- 5. fixed structural plan; budget enforced BEFORE transport ----
const plan = {
  userTurns: 5,
  providerRequests: QLT_D4_BOUNDS.maxProviderRequests,
  maxOutputTokensPerRequest: QLT_D4_BOUNDS.maxOutputTokensPerRequest,
  maxTurnDeadlineMs: QLT_D4_BOUNDS.maxTurnDeadlineMs,
};
const budget = planBudget(plan);
if (!budget.ok) {
  refuse(
    QLT_D4_CODES.BOUNDS_EXCEEDED,
    `the plan exceeds the frozen bounds: ${budget.exceeded.join(', ')}`,
  );
}

// ---------- 6. workspace (task-owned temp dir; policy guard) --------------
const workspaceState = resolveWorkspace(mkdtempSync(join(tmpdir(), 'qlt-d4-realuse-')), repoRoot);
if (!workspaceState.ok) {
  refuse(workspaceState.code, workspaceState.reason);
}
const workspace = workspaceState.workspace;

// ---------- 7. consume the authorization (exclusive-create) ---------------
const written = writeAuthorizationReceipt(receiptPath, {
  authorizedAt: new Date().toISOString(),
  contract: QLT_D4_PROOF_CONTRACT_ID,
  profile: QLT_D4_PROFILE,
  bounds: {
    maxSessionMs: QLT_D4_BOUNDS.maxSessionMs,
    maxUserTurns: plan.userTurns,
    maxProviderRequests: plan.providerRequests,
    maxOutputTokensPerRequest: plan.maxOutputTokensPerRequest,
    maxTurnDeadlineMs: plan.maxTurnDeadlineMs,
    retries: QLT_D4_BOUNDS.retries,
    fallback: QLT_D4_BOUNDS.fallback,
  },
});
if (!written.ok) {
  refuse(written.code, 'the authorization receipt already exists.');
}

// ---------- 8. provider observer (bounds enforced BEFORE transport) -------
let phase = 'start';
const observer = installProviderObserver({
  maxRequests: plan.providerRequests,
  maxRequestsPerTurn: 4,
  turnDeadlineMs: plan.maxTurnDeadlineMs,
  maxTokens: plan.maxOutputTokensPerRequest,
  purpose: () => phase,
});

// ---------- composition ----------
const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  new URL('../src/lib/server/composition.ts', import.meta.url).href
);

const composed = [];
const composeSession = async () => {
  // D4b remediation (structural): the second argument is the REPOSITORY
  // root used by the composition's fail-closed isolation check — the proof
  // workspace must resolve OUTSIDE it. The original session passed the
  // workspace itself here, so the check compared the workspace against
  // itself and refused the composition before any transport could exist.
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR_ABSOLUTE: workspace,
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_MAX_OUTPUT_TOKENS: String(plan.maxOutputTokensPerRequest),
      QUELLIGHT_TURN_DEADLINE_MS: String(plan.maxTurnDeadlineMs),
    },
    repoRoot,
  );
  // D4b remediation (structural): the gated live seam resolves the
  // provider credential from the pinned credential VARIABLE in the
  // process environment and fails closed with
  // VICT_OPERATOR_CREDENTIAL_UNAVAILABLE when it is absent. Gate 3
  // already resolved that value (environment or the owner-designated
  // authentication boundary, presence-checked, in memory only) — deliver
  // it to the seam here. The value stays in process memory; it never
  // enters any store, log, event, or evidence byte (the leak scans below
  // enforce exactly that).
  if (process.env[QLT_D4_CREDENTIAL_VAR] !== credential) {
    process.env[QLT_D4_CREDENTIAL_VAR] = credential;
  }
  const composition = await createQuellightComposition({ env, skipListen: true });
  composed.push(composition);
  return composition;
};

const actorOf = (composition) => ({
  ...composition.actor,
  presentedTokenKind: 'local-test',
});

const governedMutate = async (composition, actionId, input, idempotencyKey) => {
  const action = getCompiledPlan().actions[actionId];
  if (action === undefined || action.kind !== 'mutation') {
    throw new Error(`the plan does not declare mutation action ${actionId}`);
  }
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'app.data.mutate',
    payload: {
      resourceId: action.resourceId,
      releaseVersion: composition.releaseVersion,
      expectedRevision: action.resourceRevision,
      actionKind: 'mutation',
      actionId,
      expectedActionRevision: action.revision,
      mutation: { op: action.op, input, idempotencyKey },
    },
    idempotencyKey,
  });
  if (!outcome.ok) {
    return { ok: false, code: outcome.code };
  }
  const resultData = (outcome.data ?? {}).result;
  return {
    ok: resultData === undefined || resultData.ok === true,
    code: resultData?.code,
    row: resultData?.row,
  };
};

const startTurn = async (composition, swThreadId, mastraThreadId, input, key) => {
  // D4b remediation: the turn dispatch crosses the composition's admission
  // boundary (the Q6 live-precedent `startTurnAdmitted` shape) — the same
  // boundary installs the Q5 Memory-Mode row and the Q4 per-turn assembly
  // scope; a raw dispatch bypasses both and no assembly can ever exist.
  const admission = await composition.admitTurn(
    { swThreadId, mastraThreadId, idempotencyKey: key },
    () =>
      composition.commandService.dispatch(actorOf(composition), {
        command: 'agent.turn.start',
        payload: { threadId: mastraThreadId, input },
        idempotencyKey: key,
      }),
  );
  if (admission.refused) {
    failFast(QLT_D4_CODES.PROOF_POINT_FAILED, 'the turn admission was refused');
  }
  if (!admission.result.ok) {
    throw new Error(`turn start failed: ${admission.result.code}`);
  }
  return admission.result.data;
};

const awaitTerminal = async (composition, turnId, proofPoint) => {
  const startedAt = Date.now();
  for (;;) {
    const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
    if (['completed', 'failed', 'cancelled'].includes(turn.status)) {
      sessionState.turnSettlement = {
        proofPoint: typeof proofPoint === 'string' ? proofPoint : 'unknown',
        status: turn.status,
        errorCode: typeof turn.errorCode === 'string' ? turn.errorCode : undefined,
      };
      return { status: turn.status, errorCode: turn.errorCode, elapsedMs: Date.now() - startedAt };
    }
    if (Date.now() - startedAt > plan.maxTurnDeadlineMs + 30_000) {
      return { status: `timeout-waiting(${turn.status})`, errorCode: undefined };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
};

// ---------- evidence ledger + truthful seal/cleanup ------------------------
const ledger = createEvidenceLedger();
/** Internal unwinding sentinel for mid-session fail-fast (never sealed as evidence). */
class QuellightSessionExit extends Error {}

let cleanupTail = Promise.resolve();
const sessionStartedAtMs = Date.now();
let sealed = false;
// Fail-closed bookkeeping: set when the durable evidence write collides or
// fails; every exit path that observes it reports a non-zero result, and
// the cleanup record carries the truthful `evidenceSealed` flag.
let sealWriteFailed = false;
// D4b remediation (observability): durable structural session facts that
// must survive any termination path. Values are closed metadata only —
// never conversation content, credential material, paths, or scenario
// text.
const sessionState = {
  turnSettlement: undefined,
};

const sealSession = (forcedCode, failure = {}) => {
  if (sealed) return;
  sealed = true;
  const sessionEndedAtMs = Date.now();
  const scanHits = ledger.scan([
    { label: 'credential', needle: credential },
    { label: 'scenario-digest', needle: scenarioDigest },
  ]);
  const overRequestBudget = observer.records.length > plan.providerRequests;
  const overSessionBudget = sessionEndedAtMs - sessionStartedAtMs > QLT_D4_BOUNDS.maxSessionMs;
  // D4b remediation: one structural failure-fact block, computed once and
  // attached to EVERY failed summary (bounds-exceeded, forced-code, scan-hit,
  // or ledger verdict alike). Closed metadata only: stable tokens, counts,
  // and booleans — never messages, paths, prompts, responses, scenario
  // text, or credential material.
  const failureFacts = {
    failurePhase: phase,
    providerRequests: observer.records.length,
    transportBegan: observer.records.length > 0,
    responseHeadersArrived: observer.records.some(
      (record) => record.http !== null && record.http !== undefined,
    ),
    responseBytesArrived: observer.records.some(
      (record) => record.reasoningBytes > 0 || record.contentBytes > 0 || record.toolDeltas > 0,
    ),
    turnSettlement: sessionState.turnSettlement,
    sessionMs: sessionEndedAtMs - sessionStartedAtMs,
  };
  let summary;
  if (overRequestBudget || overSessionBudget) {
    // Bounds-exceeded failures carry the SAME complete structural
    // accounting as every other failed branch: phase, request accounting,
    // transport/headers/bytes booleans, turn settlement, elapsed time, and
    // a stable failure class naming which bound was exceeded.
    summary = {
      outcome: 'failed',
      contract: QLT_D4_PROOF_CONTRACT_ID,
      profile: QLT_D4_PROFILE,
      code: QLT_D4_CODES.BOUNDS_EXCEEDED,
      ...failureFacts,
      failureClass: overRequestBudget
        ? 'bounds-exceeded:provider-requests'
        : 'bounds-exceeded:session-ms',
    };
  } else if (typeof forcedCode === 'string') {
    summary = {
      outcome: forcedCode === QLT_D4_CODES.CREDENTIAL_MISSING ? 'failed-infrastructure' : 'failed',
      contract: QLT_D4_PROOF_CONTRACT_ID,
      profile: QLT_D4_PROFILE,
      code: forcedCode,
      ...failureFacts,
      failureClass:
        typeof failure.failureClass === 'string' ? failure.failureClass : 'unclassified',
    };
  } else if (scanHits.length > 0) {
    summary = {
      outcome: 'failed',
      code: QLT_D4_CODES.SCAN_HIT,
      hits: scanHits,
      ...failureFacts,
      failureClass: 'evidence-leak-scan',
    };
  } else {
    summary = sealEvidence(ledger, {
      credentialNeedle: credential,
      scenarioDigest,
      sessionStartedAtMs,
      sessionEndedAtMs,
    });
    if (summary.outcome === 'failed') {
      const firstFalse = ledger.receipts().find((row) => row.ok === false);
      summary = {
        ...summary,
        ...failureFacts,
        failureClass:
          firstFalse === undefined
            ? 'proof-point-failed'
            : `proof-point-failed:${firstFalse.check}`,
      };
    }
  }
  // Fail-closed seal: a run may NEVER report success unless its own
  // evidence was durably recorded. A collision with a file that somehow
  // occupied the path (the preflight makes this unreachable for a
  // well-formed attempt, so a collision here is itself an anomaly) forces
  // a non-zero exit — the truthful console line is supplementary, the
  // exit status is the contract.
  try {
    writeFileSync(evidencePath, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    console.log(`  sealed: ${summary.outcome} → ${QLT_D4_EVIDENCE_PATH}`);
  } catch {
    console.error(`FAIL: the evidence summary could not be sealed (path occupied or unwritable).`);
    sealWriteFailed = true;
    process.exitCode = 1;
  }
  return summary;
};

// Cleanup runs AFTER the durable seal (the seal is authoritative and must
// never wait on, or be lost with, teardown). The retry absorbs the Windows
// SQLite-unlock lag after close; a workspace that still cannot be removed
// is reported truthfully (exit status 1, cleanup record written).
const runCleanup = async () => {
  for (const composition of composed.splice(0)) {
    await composition.close().catch(() => undefined);
  }
  observer.restore();
  let removed = false;
  for (let attempt = 0; attempt < 30 && !removed; attempt += 1) {
    try {
      rmSync(workspace, { recursive: true, force: true });
      removed = !existsSync(workspace);
    } catch {
      await new Promise((resolvePause) => setTimeout(resolvePause, 500));
    }
  }
  console.log(
    `  cleanup: the owned workspace was ${removed ? 'removed (verified)' : 'NOT removed — remove it manually'}`,
  );
  try {
    writeFileSync(
      cleanupPath,
      JSON.stringify({ workspaceRemoved: removed, evidenceSealed: !sealWriteFailed }, null, 2) +
        '\n',
      { flag: 'wx' },
    );
  } catch {
    // Fail-closed: a run whose cleanup result was not durably recorded can
    // never report success, even when the workspace itself was removed.
    console.error('FAIL: the cleanup record could not be written (path occupied or unwritable).');
    process.exitCode = 1;
  }
  if (!removed) {
    process.exitCode = 1;
  }
};

const failFast = (code, message) => {
  console.error(`FAIL: ${message}`);
  sealSession(code);
  cleanupTail = runCleanup();
  process.exitCode = 1;
  throw new QuellightSessionExit(message);
};

const appendReceipt = (check, ok, detail = {}) => {
  const verdict = ledger.append({ kind: 'receipt', check, ok, atMs: Date.now(), detail });
  if (!verdict.ok) {
    failFast(QLT_D4_CODES.EVIDENCE_INVALID, `${check}: ${verdict.reason}`);
  }
  console.log(`  ${ok ? 'ok' : 'FAIL'}: ${check}`);
};

const leakScanWorkspace = (label) => {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const bytes = readFileSync(full);
      if (bytes.includes(credential) || bytes.includes(scenarioDigest)) {
        failFast(QLT_D4_CODES.SCAN_HIT, `${label}: leak material found in the workspace`);
      }
    }
  };
  walk(workspace);
};

// ===========================================================================
// The structured session (proof points A1–A13)
// ===========================================================================
try {
  const composition = await composeSession();
  if (composition.modelMode !== 'live') {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `modelMode is ${composition.modelMode}, expected live`,
    );
  }
  phase = 'composed';

  // ---- thread A: the main proof conversation ------------------------------
  const threadA = await composition.sharedWorld.createThread({ title: 'd4-proof-a' });
  const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);

  // ---- A1: natural conversation remains usable ----------------------------
  phase = 'a1';
  const t1 = await startTurn(
    composition,
    threadA.id,
    convA.mastraThreadId,
    scenario.chatter,
    'd4-a1',
  );
  const t1Settled = await awaitTerminal(composition, t1.turnId, 'a1');
  const restoredA1 = await composition.restoreThread(threadA.id);
  appendReceipt('a1-conversation-usable', t1Settled.status === 'completed', {
    turnStatus: t1Settled.status,
    messageCount: restoredA1.messages.length,
  });

  // ---- A2: the owner deliberately preserves durable meaning ---------------
  // Amendment 1: the REQUIRED path is the owner's direct Save through
  // the governed plan — a first-class product behavior, never a test
  // workaround. A ceremony confirmation of a turn-drafted proposal, when
  // one exists, is a genuine-use OBSERVATION recorded on the receipt;
  // its absence can never gate the required preservation.
  phase = 'a2';
  const pendingBefore = (await composition.sharedWorld.meaning.listProposals({})).total;
  const t2 = await startTurn(
    composition,
    threadA.id,
    convA.mastraThreadId,
    scenario.durableRemember,
    'd4-a2',
  );
  const t2Settled = await awaitTerminal(composition, t2.turnId, 'a2');
  if (t2Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the a2 turn ended ${t2Settled.status}`);
  }
  const saved = await governedMutate(
    composition,
    'act.createClaim',
    {
      threadId: threadA.id,
      subject: 'd4-proof preserved meaning',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: scenario.durableRemember,
    },
    'd4-a2-direct-save',
  );
  if (!saved.ok) {
    failFast(QLT_D4_CODES.PROOF_POINT_FAILED, `the direct save was refused (${saved.code})`);
  }
  const a2RecordId = saved.row?.id;
  const pendingPage = await composition.sharedWorld.meaning.listProposals({});
  const newProposals = pendingPage.rows
    .filter((row) => row.status === 'awaiting_decision')
    .slice(0, Math.max(0, pendingPage.total - pendingBefore));
  let ceremonyObservation;
  if (newProposals.length > 0) {
    // Optional genuine-use observation: the owner confirms the drafted
    // proposal through the same decision boundary. A refusal here is a
    // truthful observation failure recorded on the A7 boundary, not a
    // scenario verdict.
    const confirm = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: newProposals[0].id },
      'd4-a2-confirm',
    );
    ceremonyObservation = { drafted: true, confirmed: confirm.ok === true };
  } else {
    ceremonyObservation = { drafted: false };
  }
  appendReceipt('a2-durable-meaning-preserved', true, {
    recordId: a2RecordId,
    path: 'direct-save',
    ceremonyObservation,
  });

  // ---- A2b: the owner direct-saves the standing d4-proof commitment -------
  phase = 'a2b';
  const commitment = await governedMutate(
    composition,
    'act.createCommitment',
    {
      threadId: threadA.id,
      commitmentKey: 'd4-proof-commitment',
      statement: scenario.durableRemember,
    },
    'd4-a2b-commitment',
  );
  if (!commitment.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the proof commitment was refused (${commitment.code})`,
    );
  }
  const commitmentId = commitment.row?.id;

  // ---- A3: nothing is canonical without user authority --------------------
  // Amendment 1: store-attribution audit — model-independent. Every
  // canonical record must carry user attribution (an agent creator is
  // forbidden), and every owner-created session identity must be
  // canonically present. A drafted-but-unconfirmed proposal stays
  // pending and non-canonical; its existence is not required.
  phase = 'a3';
  const pendingAfter = await composition.sharedWorld.meaning.listProposals({});
  const openPending = pendingAfter.rows.filter((row) => row.status === 'awaiting_decision');
  const canonicalClaims = await composition.sharedWorld.meaning.listClaims({});
  const canonicalCommitments = await composition.sharedWorld.meaning.listCommitments({});
  const canonicalRecords = [...canonicalClaims.rows, ...canonicalCommitments.rows];
  const agentCanonical = canonicalRecords.filter((row) =>
    String(row.createdBy ?? '').startsWith('agent-'),
  );
  const ownerCreatedPresent = [a2RecordId, commitmentId].every((id) =>
    canonicalRecords.some((row) => row.id === id),
  );
  appendReceipt('a3-no-agent-canonical', agentCanonical.length === 0 && ownerCreatedPresent, {
    recordId: a2RecordId,
    canonicalCount: canonicalRecords.length,
    agentCanonicalCount: agentCanonical.length,
    ownerCreatedPresent,
    pendingProposalObservation: { present: openPending.length > 0 },
  });

  // ---- ineligible material: a removable claim + an expired claim ----------
  // Amendment 1: the REQUIRED exclusion pool is owner-seeded. The
  // pending proposal (when the model drafted one) is observation only.
  phase = 'seed';
  const pendingId = openPending[0]?.id;
  const removable = await governedMutate(
    composition,
    'act.createClaim',
    {
      threadId: threadA.id,
      subject: 'd4-proof removable',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: scenario.removableNote,
    },
    'd4-seed-removable',
  );
  if (!removable.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the removable claim was refused (${removable.code})`,
    );
  }
  const removedRecordId = removable.row?.id;
  // The owner expires a dedicated claim through the governed plan:
  // future-only assignment (the composition's clock is the real wall
  // clock), then the retention pass at an explicit later instant — the
  // same frozen due predicate production executes, deterministically.
  const expirySeed = await governedMutate(
    composition,
    'act.createClaim',
    {
      threadId: threadA.id,
      subject: 'd4-proof expiring',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: scenario.removableNote,
    },
    'd4-seed-expiring',
  );
  if (!expirySeed.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the expiring claim was refused (${expirySeed.code})`,
    );
  }
  const expiredRecordId = expirySeed.row?.id;
  const expirySet = await governedMutate(
    composition,
    'act.setClaimExpiry',
    // D4b remediation: the declared input contract for the retention pass
    // (`qlt.retention.pass.input`) is closed and empty — the pass runs at
    // the composition's real clock. The expiry therefore sits only two
    // seconds ahead (still future-only per the frozen rule) and the
    // in-session wait below makes it due deterministically without extra
    // turns or provider requests.
    { claimId: expiredRecordId, expiresAtMs: Date.now() + 2_000 },
    'd4-seed-expiry-set',
  );
  if (!expirySet.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the expiry assignment was refused (${expirySet.code})`,
    );
  }
  // D4b remediation: let the seeded expiry genuinely come due on the
  // real clock before the pass (expiry sits two seconds ahead). Wall
  // clock only: no user turns, no provider requests.
  await new Promise((resolveWait) => setTimeout(resolveWait, 3_000));
  const passOutcome = await governedMutate(
    composition,
    'act.runRetentionPass',
    {},
    // D4b remediation: the pass runs after the seeded expiry has genuinely
    // come due on the real clock. This costs wall-clock time only — no
    // user turns, no provider requests — inside the frozen session bound.
    'd4-seed-retention-pass',
  );
  if (!passOutcome.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the retention pass was refused (${passOutcome.code})`,
    );
  }
  appendReceipt('ineligible-seeded', true, { pendingId, removedRecordId, expiredRecordId });

  // ---- A7: the conflict class, deterministic at the product boundary ------
  // Amendment 1: the model CANNOT decide this proof point. The owner
  // exercises the real decision boundary (confirmProposal) on every
  // commitment-kind proposal the turn produced — a same-key collision
  // must refuse quietly (refusal + challenge + user-only dismissal), a
  // distinct key confirms ordinarily. REQUIRED either way: the standing
  // commitment is unchanged, no challenge remains open, and refusals
  // mutated nothing. With NO commitment proposal, A7 still passes: the
  // detector ran at the boundary on every confirmation that occurred,
  // and no false challenge exists. The full refusal class is
  // permanently proven offline (verify:d4-prep N-D4-P-23).
  phase = 'a7';
  const standingBefore = await composition.sharedWorld.meaning.getCommitment(commitmentId);
  const t3 = await startTurn(
    composition,
    threadA.id,
    convA.mastraThreadId,
    scenario.durableSecond,
    'd4-a7',
  );
  const t3Settled = await awaitTerminal(composition, t3.turnId, 'a7');
  if (t3Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the a7 turn ended ${t3Settled.status}`);
  }
  const poolSecond = await composition.sharedWorld.meaning.listProposals({});
  const commitmentProposals = poolSecond.rows.filter(
    (row) => row.status === 'awaiting_decision' && row.proposalKind === 'commitment',
  );
  let conflictClassExercised = false;
  let boundaryFailed = false;
  for (const proposal of commitmentProposals) {
    const decision = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: proposal.id },
      `d4-a7-confirm-${proposal.id}`,
    );
    if (decision.ok) {
      // A distinct key is CORRECT product behavior: a different key is
      // a different commitment. The audit below proves the standing
      // commitment was untouched.
      continue;
    }
    if (decision.code === 'QLT_COMMITMENT_CONFLICT') {
      conflictClassExercised = true;
      const challengePage = composition.sharedWorld.conflict.listChallenges({ status: 'open' });
      const openChallenge = challengePage.rows.find(
        (row) => row.incomingProposalId === proposal.id,
      );
      if (openChallenge === undefined) {
        boundaryFailed = true;
        continue;
      }
      const dismissed = await governedMutate(
        composition,
        'act.dismissChallenge',
        { challengeId: openChallenge.challengeId },
        `d4-a7-dismiss-${openChallenge.challengeId}`,
      );
      if (!dismissed.ok) {
        boundaryFailed = true;
      }
      continue;
    }
    // Any OTHER refusal is a non-quiet boundary failure.
    boundaryFailed = true;
  }
  const standingAfter = await composition.sharedWorld.meaning.getCommitment(commitmentId);
  const standingUnchanged =
    standingAfter !== undefined &&
    standingAfter.id === commitmentId &&
    standingAfter.version === standingBefore.version &&
    JSON.stringify(standingAfter.content) === JSON.stringify(standingBefore.content);
  const openChallengesRemaining = composition.sharedWorld.conflict.listChallenges({
    status: 'open',
  }).rows.length;
  appendReceipt(
    'a7-conflict-challenge-quiet',
    standingUnchanged && !boundaryFailed && openChallengesRemaining === 0,
    {
      exercise:
        commitmentProposals.length === 0
          ? 'none'
          : conflictClassExercised
            ? 'collision'
            : 'distinct-key',
      standingUnchanged,
      boundaryFailed,
      openChallengesRemaining,
      conflictClassExercised,
      modelProposalObserved: commitmentProposals.length > 0,
    },
  );

  // ---- ordinary execution under the standing commitment -------------------
  phase = 'ordinary';
  const t4 = await startTurn(
    composition,
    threadA.id,
    convA.mastraThreadId,
    scenario.ordinaryFollowup,
    'd4-ord',
  );
  const t4Settled = await awaitTerminal(composition, t4.turnId, 'ordinary');
  if (t4Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the ordinary turn ended ${t4Settled.status}`);
  }

  // ---- A8: export truthfully represents its declared scope ----------------
  phase = 'a8';
  const exportDocument = await composition.conversationLifecycle.buildExport({
    actorId: composition.actorId,
  });
  const exportBytes = Buffer.byteLength(JSON.stringify(exportDocument));
  const exportText = JSON.stringify(exportDocument);
  appendReceipt('export-produced', exportBytes > 0, {
    documentBytes: exportBytes,
    disclosure: typeof exportDocument.disclosure === 'object',
  });
  appendReceipt(
    'a8-export-truthful',
    exportBytes > 0 && !exportText.includes(credential) && !exportText.includes(scenarioDigest),
    { documentBytes: exportBytes },
  );

  // ---- A9: removal of the dedicated proof record ---------------------------
  // Amendment 1: the removal goes through the governed plan action the
  // product UI uses — the same user-only boundary, no store shortcut.
  phase = 'a9';
  const removalOutcome = await governedMutate(
    composition,
    'act.removeRecord',
    // D4b remediation: the declared input contract (`qlt.retention.remove.input`)
    // names this field `recordKind`; the original payload used a wrong key.
    { recordId: removedRecordId, recordKind: 'claim' },
    'd4-a9-remove',
  );
  if (!removalOutcome.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the governed removal was refused (${removalOutcome.code})`,
    );
  }
  const removedView = await composition.sharedWorld.retention.getRecordView({
    recordId: removedRecordId,
    family: 'claim',
  });
  const tombstoneFree =
    removedView !== undefined &&
    removedView.retentionState === 'user-removed' &&
    removedView.removedAtMs !== null;
  appendReceipt('record-removed', tombstoneFree, {
    recordId: removedRecordId,
    retentionState: removedView?.retentionState,
  });
  appendReceipt('a9-proof-record-removal', tombstoneFree, { recordId: removedRecordId });

  // ---- A4: restart on the same data dir ------------------------------------
  phase = 'restart';
  await composition.close();
  composed.splice(
    composed.findIndex((entry) => entry === composition),
    1,
  );
  const composition2 = await composeSession();
  const commitmentAfterRestart = await composition2.sharedWorld.meaning.getCommitment(commitmentId);
  const restartOk =
    commitmentAfterRestart !== undefined &&
    commitmentAfterRestart.version === standingBefore.version &&
    JSON.stringify(commitmentAfterRestart.content) === JSON.stringify(standingBefore.content);
  appendReceipt('restart-performed', restartOk, { recordId: commitmentId });
  appendReceipt('a4-restart-preserved', restartOk, { recordId: commitmentId });

  // ---- A5/A6: a genuinely fresh conversation --------------------------------
  phase = 'a5';
  const threadB = await composition2.sharedWorld.createThread({ title: 'd4-proof-fresh' });
  const convB = await composition2.sharedWorld.ensureConversationLink(threadB.id);
  const t5 = await startTurn(
    composition2,
    threadB.id,
    convB.mastraThreadId,
    scenario.freshProbe,
    'd4-a5',
  );
  const t5Settled = await awaitTerminal(composition2, t5.turnId, 'a5');
  if (t5Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the fresh-conversation turn ended ${t5Settled.status}`);
  }
  const assembly = await composition2.sharedWorld.getContextAssemblyByTurn(t5.turnId);
  const selectedIds = (assembly?.selectedIds ?? []).map((entry) => entry.id);
  appendReceipt('assembly-selected', selectedIds.includes(commitmentId), {
    recordId: commitmentId,
    selectedCount: selectedIds.length,
  });
  appendReceipt('a5-fresh-thread-received', selectedIds.includes(commitmentId), {
    recordId: commitmentId,
  });
  // Amendment 1: the REQUIRED exclusions are the owner-seeded removed
  // and expired records. The pending proposal, when the model drafted
  // one, is an observation recorded under the reserved vocabulary —
  // its absence never gates the check, its selection always fails it.
  const pendingObservation = pendingId === undefined ? null : !selectedIds.includes(pendingId);
  const removedExcluded = !selectedIds.includes(removedRecordId);
  const expiredExcluded = !selectedIds.includes(expiredRecordId);
  appendReceipt(
    'a6-ineligible-excluded',
    removedExcluded && expiredExcluded && pendingObservation !== false,
    {
      removedExcluded,
      expiredExcluded,
      pendingProposalObservation: pendingObservation,
    },
  );

  // ---- A10: conversation-only deletion preserves Shared World meaning ------
  phase = 'a10';
  const threadC = await composition2.sharedWorld.createThread({ title: 'd4-proof-delete' });
  const preserved = await governedMutate(
    composition2,
    'act.createClaim',
    {
      threadId: threadC.id,
      subject: 'd4-proof preserved claim',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: scenario.preservedNote,
    },
    'd4-a10-preserved',
  );
  if (!preserved.ok) {
    failFast(
      QLT_D4_CODES.PROOF_POINT_FAILED,
      `the preserved claim was refused (${preserved.code})`,
    );
  }
  const preservedId = preserved.row?.id;
  const preservedBefore = await composition2.sharedWorld.meaning.getClaim(preservedId);
  await composition2.sharedWorld.ensureConversationLink(threadC.id);
  const preview = await composition2.conversationLifecycle.preview({
    threadId: threadC.id,
    mode: 'conversation-only',
    actorId: composition2.actorId,
  });
  appendReceipt('deletion-previewed', preview !== undefined, { threadId: threadC.id });
  const deletion = await composition2.conversationLifecycle.deleteConversation({
    threadId: threadC.id,
    mode: 'conversation-only',
    confirmed: true,
    key: 'd4-a10-delete',
    actorId: composition2.actorId,
  });
  const deletedCompleted = deletion.row?.status === 'completed';
  appendReceipt('conversation-deleted', deletedCompleted, {
    threadId: threadC.id,
    mode: 'conversation-only',
  });
  const preservedAfter = await composition2.sharedWorld.meaning.getClaim(preservedId);
  const byteIdentical =
    preservedAfter !== undefined &&
    preservedAfter.version === preservedBefore.version &&
    JSON.stringify(preservedAfter.content) === JSON.stringify(preservedBefore.content);
  appendReceipt('meaning-byte-identical', byteIdentical, { threadId: threadC.id });
  const tombstoneThread = await composition2.sharedWorld.getThread(threadC.id);
  const tombstoneTruthful =
    tombstoneThread?.retentionState === 'user-removed' && tombstoneThread?.title === null;
  appendReceipt(
    'a10-conversation-only-preserved',
    deletedCompleted && byteIdentical && tombstoneTruthful,
    { threadId: threadC.id },
  );

  // ---- A11: reconciliation remains complete and truthful --------------------
  phase = 'a11';
  const status = await composition2.conversationLifecycle.status({
    threadId: threadC.id,
    actorId: composition2.actorId,
  });
  const receiptsComplete = status.row?.status === 'completed';
  appendReceipt('reconciliation-receipts', receiptsComplete, { threadId: threadC.id });
  const recovery = await composition2.conversationLifecycle.recoverOnBoot();
  appendReceipt('boot-recovery-clean', recovery.resumed === 0, { resumed: recovery.resumed });
  appendReceipt('a11-reconciliation-complete', receiptsComplete && recovery.resumed === 0, {
    threadId: threadC.id,
  });

  // ---- A12: transcripts contain no injected context block -------------------
  phase = 'a12';
  const restoredA = await composition2.restoreThread(threadA.id);
  const restoredB = await composition2.restoreThread(threadB.id);
  const transcriptText = restoredA.messages
    .concat(restoredB.messages)
    .map((message) => message.text)
    .join('\n');
  const transcriptClean = !transcriptText.includes(QLT_CONTEXT_BLOCK_OPEN);
  appendReceipt('context-marker-absent', transcriptClean, { threadId: threadB.id });
  appendReceipt('a12-transcripts-clean', transcriptClean, { threadId: threadB.id });

  // ---- A13: evidence hygiene -------------------------------------------------
  phase = 'a13';
  leakScanWorkspace('a13');
  appendReceipt('a13-evidence-hygiene', true, { scanned: 'workspace-bytes' });

  // ---- seal -------------------------------------------------------------------
  sealSession(undefined);
  cleanupTail = runCleanup();
  await cleanupTail;
  // Natural module completion: the durable evidence is already written
  // synchronously, cleanup has completed and been verified, and the exit
  // code stays 0 — no abrupt exit can discard truthful output.
} catch (cause) {
  if (cause instanceof QuellightSessionExit) {
    // Mid-session fail-fast already sealed durably and printed its
    // truthful line; only the exit status and the awaited cleanup remain.
    process.exitCode = 1;
    await cleanupTail;
  } else {
    // D4b remediation: seal the durable structural truth BEFORE the exit
    // status is set, and never rely on buffered console output. The only
    // tokens printed or sealed are stable identifiers: the product or
    // framework fail-closed code when one is present (QLT_/VICT_ tokens are
    // stable, path-free, content-free), otherwise the error's constructor
    // name. Raw messages can carry unsuitable material and are never
    // printed or sealed.
    const messageText = cause instanceof Error ? cause.message : '';
    const codeMatch = /(?:QLT|VICT)_[A-Z0-9_]+/.exec(messageText);
    const failureClass =
      codeMatch?.[0] ?? (cause instanceof Error ? cause.name : 'non-error-throw');
    console.error(`FAIL: the session failed truthfully (${failureClass})`);
    sealSession(QLT_D4_CODES.PROOF_POINT_FAILED, {
      failureClass,
    });
    // The cleanup result is durably recorded for EVERY termination path —
    // including unexpected throws — so a run never ends without its
    // workspace disposition on durable record.
    cleanupTail = runCleanup();
    await cleanupTail;
    process.exitCode = 1;
  }
}
