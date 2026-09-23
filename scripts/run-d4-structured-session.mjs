#!/usr/bin/env node
/**
 * Quellight Stage 07D Phase D4 — the MSTR-012 bounded structured
 * real-use session (proof contract `quellight.stage07d.d4.proof-contract@1`).
 *
 * OWNER-INVOKED ONLY; not part of any test suite. Refuses to run unless
 * ALL of the following hold:
 *   - QUELLIGHT_D4_STRUCTURED=1 is set explicitly (session intent);
 *   - the one-shot authorization receipt
 *     docs/report/evidence/d4-structured-session-receipt.json does NOT
 *     exist (exclusive-create; any later run refuses — only the OWNER
 *     may archive a consumed receipt to authorize a fresh session);
 *   - the provider credential is present (OLLAMA_API_KEY in the
 *     environment, or the owner-located auth file the Q6 precedent
 *     used) — EXISTENCE ONLY; the value is never printed, logged, or
 *     written anywhere;
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
 * A7 (contract §2): a model key collision exercises the quiet challenge
 * and dismissal end to end; a distinct key is CORRECT product behavior
 * (a different key is a different commitment) recorded with the
 * standing commitment's unchanged identity. A collision that fails
 * non-quietly, or a silent overwrite, fails the session truthfully.
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

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const refuse = (code, message) => {
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
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR_ABSOLUTE: workspace,
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_MAX_OUTPUT_TOKENS: String(plan.maxOutputTokensPerRequest),
      QUELLIGHT_TURN_DEADLINE_MS: String(plan.maxTurnDeadlineMs),
    },
    workspace,
  );
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

const startTurn = async (composition, mastraThreadId, input, key) => {
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: mastraThreadId, input },
    idempotencyKey: key,
  });
  if (!outcome.ok) {
    throw new Error(`turn start failed: ${outcome.code}`);
  }
  return outcome.data;
};

const awaitTerminal = async (composition, turnId) => {
  const startedAt = Date.now();
  for (;;) {
    const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
    if (['completed', 'failed', 'cancelled'].includes(turn.status)) {
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
const sessionStartedAtMs = Date.now();
let sealed = false;

const sealAndCleanup = (forcedCode) => {
  if (sealed) return;
  sealed = true;
  const sessionEndedAtMs = Date.now();
  const scanHits = ledger.scan([
    { label: 'credential', needle: credential },
    { label: 'scenario-digest', needle: scenarioDigest },
  ]);
  const overRequestBudget = observer.records.length > plan.providerRequests;
  const overSessionBudget = sessionEndedAtMs - sessionStartedAtMs > QLT_D4_BOUNDS.maxSessionMs;
  let summary;
  if (overRequestBudget || overSessionBudget) {
    summary = {
      outcome: 'failed',
      code: QLT_D4_CODES.BOUNDS_EXCEEDED,
      providerRequests: observer.records.length,
      sessionMs: sessionEndedAtMs - sessionStartedAtMs,
    };
  } else if (typeof forcedCode === 'string') {
    summary = {
      outcome:
        forcedCode === QLT_D4_CODES.CREDENTIAL_MISSING
          ? 'failed-infrastructure'
          : forcedCode === QLT_D4_CODES.SCENARIO_BEHAVIOR
            ? 'failed-scenario-behavior'
            : 'failed',
      contract: QLT_D4_PROOF_CONTRACT_ID,
      profile: QLT_D4_PROFILE,
      code: forcedCode,
    };
  } else if (scanHits.length > 0) {
    summary = { outcome: 'failed', code: QLT_D4_CODES.SCAN_HIT, hits: scanHits };
  } else {
    summary = sealEvidence(ledger, {
      credentialNeedle: credential,
      scenarioDigest,
      sessionStartedAtMs,
      sessionEndedAtMs,
    });
  }
  const evidencePath = join(repoRoot, QLT_D4_EVIDENCE_PATH);
  try {
    writeFileSync(evidencePath, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    console.log(`  sealed: ${summary.outcome} → ${QLT_D4_EVIDENCE_PATH}`);
  } catch {
    console.error('FAIL: the evidence summary already exists — refusing to overwrite.');
  }
  for (const composition of composed.splice(0)) {
    void composition.close().catch(() => undefined);
  }
  observer.restore();
  rmSync(workspace, { recursive: true, force: true });
  const removed = !existsSync(workspace);
  console.log(
    `  cleanup: the owned workspace was ${removed ? 'removed (verified)' : 'NOT removed — remove it manually'}`,
  );
};

const failFast = (code, message) => {
  console.error(`FAIL: ${message}`);
  sealAndCleanup(code);
  process.exit(1);
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
  const t1 = await startTurn(composition, convA.mastraThreadId, scenario.chatter, 'd4-a1');
  const t1Settled = await awaitTerminal(composition, t1.turnId);
  const restoredA1 = await composition.restoreThread(threadA.id);
  appendReceipt('a1-conversation-usable', t1Settled.status === 'completed', {
    turnStatus: t1Settled.status,
    messageCount: restoredA1.messages.length,
  });

  // ---- A2: the owner deliberately preserves durable meaning ---------------
  phase = 'a2';
  const pendingBefore = (await composition.sharedWorld.meaning.listProposals({})).total;
  const t2 = await startTurn(composition, convA.mastraThreadId, scenario.durableRemember, 'd4-a2');
  const t2Settled = await awaitTerminal(composition, t2.turnId);
  if (t2Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the a2 turn ended ${t2Settled.status}`);
  }
  const pendingPage = await composition.sharedWorld.meaning.listProposals({});
  const newProposals = pendingPage.rows
    .filter((row) => row.status === 'awaiting_decision')
    .slice(0, Math.max(0, pendingPage.total - pendingBefore));
  let a2RecordId;
  let a2Path;
  if (newProposals.length > 0) {
    // The ceremony path: the owner confirms the drafted proposal.
    const confirm = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: newProposals[0].id },
      'd4-a2-confirm',
    );
    if (!confirm.ok) {
      failFast(
        QLT_D4_CODES.PROOF_POINT_FAILED,
        `the ceremony confirmation was refused (${confirm.code})`,
      );
    }
    a2RecordId = confirm.row?.id;
    a2Path = 'ceremony-confirm';
  } else {
    // The direct Save path is an equally valid product path.
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
    a2RecordId = saved.row?.id;
    a2Path = 'direct-save';
  }
  appendReceipt('a2-durable-meaning-preserved', true, {
    recordId: a2RecordId,
    path: a2Path,
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
  phase = 'a3';
  const pendingAfter = await composition.sharedWorld.meaning.listProposals({});
  const openPending = pendingAfter.rows.filter((row) => row.status === 'awaiting_decision');
  if (openPending.length === 0) {
    failFast(
      QLT_D4_CODES.SCENARIO_BEHAVIOR,
      'a3: the remember request produced no pending proposal to review (truthful scenario-behavior finding)',
    );
  }
  appendReceipt('a3-no-agent-canonical', true, {
    recordId: a2RecordId,
    pendingCount: openPending.length,
    preservedPath: a2Path,
  });

  // ---- ineligible material: the pending pool + a dedicated removable claim
  phase = 'seed';
  const pendingId = openPending[0].id;
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
  appendReceipt('ineligible-seeded', true, { pendingId, removedRecordId });

  // ---- A7: a supported commitment conflict → the quiet challenge ----------
  phase = 'a7';
  const standingBefore = await composition.sharedWorld.meaning.getCommitment(commitmentId);
  const t3 = await startTurn(composition, convA.mastraThreadId, scenario.durableSecond, 'd4-a7');
  const t3Settled = await awaitTerminal(composition, t3.turnId);
  if (t3Settled.status !== 'completed') {
    failFast(QLT_D4_CODES.TURN_FAILED, `the a7 turn ended ${t3Settled.status}`);
  }
  const poolSecond = await composition.sharedWorld.meaning.listProposals({});
  const collision = poolSecond.rows.find(
    (row) =>
      row.status === 'awaiting_decision' &&
      row.proposalKind === 'commitment' &&
      row.content?.commitmentKey === 'd4-proof-commitment',
  );
  if (collision !== undefined) {
    const refused = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: collision.id },
      'd4-a7-confirm',
    );
    if (refused.ok || refused.code !== 'QLT_COMMITMENT_CONFLICT') {
      failFast(
        QLT_D4_CODES.PROOF_POINT_FAILED,
        `a7: a key collision must refuse quietly with QLT_COMMITMENT_CONFLICT (got ${refused.code ?? 'ok'})`,
      );
    }
    const challengePage = composition.sharedWorld.conflict.listChallenges({ status: 'open' });
    const openChallenge = challengePage.rows.find((row) => row.incomingProposalId === collision.id);
    if (openChallenge === undefined) {
      failFast(QLT_D4_CODES.PROOF_POINT_FAILED, 'a7: no challenge row was recorded');
    }
    const dismissed = await governedMutate(
      composition,
      'act.dismissChallenge',
      { challengeId: openChallenge.challengeId },
      'd4-a7-dismiss',
    );
    if (!dismissed.ok) {
      failFast(QLT_D4_CODES.PROOF_POINT_FAILED, `the quiet dismissal failed (${dismissed.code})`);
    }
    appendReceipt('a7-conflict-challenge-quiet', true, {
      trigger: 'key-collision',
      challengeResolved: true,
    });
  } else {
    const standingAfter = await composition.sharedWorld.meaning.getCommitment(commitmentId);
    const unchanged =
      standingAfter !== undefined &&
      standingAfter.version === standingBefore.version &&
      JSON.stringify(standingAfter.content) === JSON.stringify(standingBefore.content);
    appendReceipt('a7-conflict-challenge-quiet', unchanged, {
      trigger: 'distinct-key',
      standingCommitmentUnchanged: unchanged,
    });
  }

  // ---- ordinary execution under the standing commitment -------------------
  phase = 'ordinary';
  const t4 = await startTurn(
    composition,
    convA.mastraThreadId,
    scenario.ordinaryFollowup,
    'd4-ord',
  );
  const t4Settled = await awaitTerminal(composition, t4.turnId);
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
  phase = 'a9';
  await composition.sharedWorld.retention.removeRecord({
    recordId: removedRecordId,
    family: 'claim',
    removedBy: composition.actorId,
  });
  const removedView = composition.sharedWorld.retention.getRecordView({
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
    commitmentAfterRestart.version === standingBefore.version;
  appendReceipt('restart-performed', restartOk, { recordId: commitmentId });
  appendReceipt('a4-restart-preserved', restartOk, { recordId: commitmentId });

  // ---- A5/A6: a genuinely fresh conversation --------------------------------
  phase = 'a5';
  const threadB = await composition2.sharedWorld.createThread({ title: 'd4-proof-fresh' });
  const convB = await composition2.sharedWorld.ensureConversationLink(threadB.id);
  const t5 = await startTurn(composition2, convB.mastraThreadId, scenario.freshProbe, 'd4-a5');
  const t5Settled = await awaitTerminal(composition2, t5.turnId);
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
  const pendingExcluded = !selectedIds.includes(pendingId);
  const removedExcluded = !selectedIds.includes(removedRecordId);
  appendReceipt('a6-ineligible-excluded', pendingExcluded && removedExcluded, {
    pendingExcluded,
    removedExcluded,
  });

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
  const marker = '<<<QLT:SHARED-WORLD-CONTEXT:V1>>>';
  const transcriptClean = !transcriptText.includes(marker);
  appendReceipt('context-marker-absent', transcriptClean, { threadId: threadB.id });
  appendReceipt('a12-transcripts-clean', transcriptClean, { threadId: threadB.id });

  // ---- A13: evidence hygiene -------------------------------------------------
  phase = 'a13';
  leakScanWorkspace('a13');
  appendReceipt('a13-evidence-hygiene', true, { scanned: 'workspace-bytes' });

  // ---- seal -------------------------------------------------------------------
  sealAndCleanup(undefined);
  process.exit(0);
} catch (cause) {
  console.error(`FAIL: the session failed truthfully (${String(cause).slice(0, 200)})`);
  sealAndCleanup(QLT_D4_CODES.PROOF_POINT_FAILED);
  process.exit(1);
}
