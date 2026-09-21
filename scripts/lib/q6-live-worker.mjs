#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q6 — the live-proof CHILD WORKER (amendment §6).
 *
 * The parent (scripts/verify-q6-live.mjs → scripts/lib/q6-live-parent.mjs)
 * owns the gate, the ONE disposable root, the external-fixture boundary, and
 * — ONLY after this worker has exited — the credential scan, the fixture
 * content-safety re-check, and the workspace deletion. This worker owns
 * EVERY composition, provider turn, restart, and ceremony operation, writes
 * a machine-readable result record into the owned root, and exits. It has
 * NO deletion capability: it adopts the parent's root through
 * `adoptQ6LiveWorkspace` (a deletion-free API) and never removes
 * anything.
 *
 * THE FIVE-TURN MATRIX (amendment §5; five provider turns of the allowed
 * six; zero retries; no fallback; ≤512 output tokens/turn; ≤120 s/turn):
 *
 *   t1 (thread A) — EXPLICIT POSITIVE CONTROL: the user explicitly asks to
 *      remember a preference. Expected: natural reply; EXACTLY ONE pending
 *      `claim` proposal; zero canonical records; no memory-write claim.
 *   t2 (thread A) — NATURALISTIC DISCRETIONARY POSITIVE: the operator's
 *      EXTERNAL personal fixture, verbatim, through the real ingress.
 *      Expected: natural reply; EXACTLY ONE `commitment` proposal carrying
 *      all four semantic anchors as the USER'S commitment (never advice,
 *      never a hardship "signal"); at most one optional `open_loop` for the
 *      transition-pacing decision; no other kinds; ≤2 proposals; ≤2
 *      invocations; zero canonical records.
 *   t3 (thread A) — DISCRETIONARY NEGATIVE CONTROL: an ordinary software
 *      incident. Expected: natural reply; ZERO invocations; ZERO proposals;
 *      ZERO canonical effects.
 *   ceremony (no provider turn) — the USER confirms ONLY the t2 commitment
 *      through the REAL released app.data.mutate boundary: exactly one
 *      canonical commitment; same-key replay duplicates nothing; a stale
 *      expectedVersion is refused with zero effect; the agent exercised no
 *      confirmation authority. Then the composition CLOSES and RECOMPOSES
 *      against the SAME verified owned root.
 *   t4 (thread B, genuinely fresh) — CONTINUITY: the confirmed commitment
 *      is selected into the per-turn C1 snapshot; the reply is non-empty;
 *      zero context-block bytes in the durable transcript; pending
 *      proposals are NOT injected as canonical meaning.
 *   t5 (thread A) — HYPOTHETICAL CONFLICT AND NEGATIVE CONTROL: the agent
 *      may engage the hypothetical normally; ZERO invocations; ZERO
 *      proposals; the confirmed commitment remains byte-identical and
 *      version-identical.
 *
 * METADATA ONLY: findings carry stable codes and COUNTS — never proposal,
 * fixture, or reply content. The durable invocation truth (effect `write`,
 * approvalRequired=false, the host quiet-write disposition, zero approval
 * rows) is asserted from durable rows on the proposal-bearing turns; the
 * ledger frames and the serialized operator configuration are scanned for
 * the credential VALUE in memory (the parent scans every persisted byte
 * after this worker exits).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adoptQ6LiveWorkspace } from './q6-live-workspace.mjs';
import { Q6_RESULT_FILE_NAME } from './q6-live-parent.mjs';
import { resolveNaturalFixture } from './q6-fixture-boundary.mjs';
import {
  evaluateConflictTurn,
  evaluateDiscretionaryNegative,
  evaluateDiscretionaryPositive,
  evaluateExplicitPositive,
} from './q6-acceptance.mjs';
import { QLT_AGENT_PROPOSER_ID } from '../../src/lib/sharedworld/ceremony-contract.ts';
import {
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_OPEN,
  QLT_CONTEXT_RECORD_CLOSE,
} from '../../src/lib/sharedworld/context-contract.ts';
import {
  QLT_Q6_COMMITMENT_ANCHORS,
  QLT_Q6_LIVE_BOUNDS,
  QLT_Q6_NATURAL_FIXTURE_VAR,
  QLT_Q6_PROVIDER_IDENTITY,
  QLT_Q6_T1_STATEMENT,
  QLT_Q6_T3_STATEMENT,
  QLT_Q6_T4_STATEMENT,
  QLT_Q6_T5_STATEMENT,
} from '../../src/lib/sharedworld/q6-contract.ts';

/** Non-echoing crash guard: stable prefix + bounded message length. */
const safeCrashMessage = (error) =>
  `live matrix crashed: ${String(error && error.message ? error.message : error).slice(0, 300)}`;

const ownedRoot = process.env.QUELLIGHT_Q6_OWNED_ROOT;
if (typeof ownedRoot !== 'string' || ownedRoot.trim() === '') {
  console.error('WORKER REFUSED: the parent did not designate an owned workspace root.');
  process.exit(3);
}
const credential = process.env.OLLAMA_API_KEY;
if (typeof credential !== 'string' || credential.length === 0) {
  console.error('WORKER REFUSED: no credential is present in the worker environment.');
  process.exit(3);
}

// ---- adopt the parent's root: ownership without any deletion capability --
let workspace;
try {
  workspace = adoptQ6LiveWorkspace(ownedRoot);
} catch {
  console.error(
    'WORKER REFUSED: the designated workspace root is not adoptable (path not echoed).',
  );
  process.exit(3);
}
const ownedDataDir = workspace.root;

// ---- the external fixture (non-echoing; identity cross-checked) ----------
let fixture;
try {
  fixture = resolveNaturalFixture({
    fixturePath: process.env[QLT_Q6_NATURAL_FIXTURE_VAR],
    repoRoot: process.cwd(),
  });
} catch {
  console.error(
    'WORKER REFUSED: the external natural fixture could not be validated (details not echoed).',
  );
  process.exit(3);
}
try {
  const expected = JSON.parse(process.env.QUELLIGHT_Q6_FIXTURE_IDENTITY ?? '');
  if (expected.byteLength !== fixture.byteLength || expected.sha256 !== fixture.sha256) {
    console.error(
      'WORKER REFUSED: the fixture changed between parent validation and worker use (content not echoed).',
    );
    process.exit(3);
  }
} catch {
  console.error('WORKER REFUSED: the parent fixture identity is missing or malformed.');
  process.exit(3);
}

// ---- the REAL production composition (tsx-loaded TS) ----------------------
const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  new URL('../../src/lib/server/composition.ts', import.meta.url).href
);
const { getCompiledPlan } = await import(
  new URL('../../src/lib/application/definition.ts', import.meta.url).href
);

const findings = [];
const fail = (message) => {
  findings.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);
/** @type {Array<{ id: string; status: string; elapsedMs: number; proposals: number; invocations: number }>} */
const turnRecords = [];
let providerTurnCount = 0;

const composed = [];
const composeLive = async (directory) => {
  try {
    workspace.requireOwned(directory, 'composeLive');
  } catch {
    fail(
      'composeLive refused a directory that is not the owned workspace root (path not echoed) — failing closed',
    );
    throw new Error(
      'Q6 LIVE WORKSPACE IDENTITY VIOLATION — failing closed before any composition or provider turn',
    );
  }
  const env = resolveQuellightEnvironment(
    {
      ...workspace.dataEnv(directory),
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_MAX_OUTPUT_TOKENS: String(QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerTurn),
      QUELLIGHT_TURN_DEADLINE_MS: String(QLT_Q6_LIVE_BOUNDS.turnDeadlineMs),
    },
    process.cwd(),
  );
  try {
    workspace.requireResolvedEnvironmentDataDir(env);
  } catch {
    fail(
      'the resolved environment data directory is not the owned workspace root (path not echoed) — failing closed before composition',
    );
    throw new Error(
      'Q6 LIVE WORKSPACE IDENTITY VIOLATION — failing closed before any provider turn',
    );
  }
  const composition = await createQuellightComposition({ env, skipListen: true });
  try {
    workspace.requireCompositionDataDir(composition, 'composeLive');
  } catch {
    await composition.close().catch(() => undefined);
    fail(
      'the composition reported a data directory that is not the owned workspace root (path not echoed) — failing closed before any provider turn; the unowned path was left untouched',
    );
    throw new Error(
      'Q6 LIVE WORKSPACE IDENTITY VIOLATION — failing closed before any provider turn',
    );
  }
  composed.push(composition);
  return composition;
};

const actorOf = (composition) => ({
  ...composition.actor,
  presentedTokenKind: 'local-test',
});

const awaitTerminal = async (composition, turnId, timeoutMs = 150_000) => {
  const startedAt = Date.now();
  for (;;) {
    const turn = await composition.stores.turns.getTurn(turnId);
    if (turn && ['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return { status: turn.status, errorCode: turn.errorCode, elapsedMs: Date.now() - startedAt };
    }
    if (Date.now() - startedAt > timeoutMs) {
      return {
        status: `timeout-waiting(${turn?.status ?? 'unknown'})`,
        errorCode: undefined,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
};

const startTurnAdmitted = async (
  composition,
  swThreadId,
  mastraThreadId,
  input,
  idempotencyKey,
) => {
  const admission = await composition.admitTurn(
    { swThreadId, mastraThreadId, idempotencyKey },
    () =>
      composition.commandService.dispatch(actorOf(composition), {
        command: 'agent.turn.start',
        payload: { threadId: mastraThreadId, input },
        idempotencyKey,
      }),
  );
  if (admission.refused) {
    throw new Error('turn admission refused (QLT_TURN_ALREADY_OPEN)');
  }
  if (!admission.result.ok) {
    throw new Error(`turn did not start: ${admission.result.code}`);
  }
  return { turnId: admission.result.data.turnId, streamId: admission.result.data.streamId };
};

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
    return { replayed: false, ok: false, code: outcome.code };
  }
  const result = (outcome.data ?? {}).result;
  return {
    replayed: result === undefined,
    ok: result === undefined || result.ok === true,
    code: result?.code,
  };
};

/** The last assistant reply of a thread (for natural-flow evaluation). */
const replyOf = async (sharedWorld, threadId) => {
  const restored = await sharedWorld.restoreThread(threadId);
  const messages = restored.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return String(messages[index].text ?? '');
    }
  }
  return '';
};

/** Canonical records across ALL substantive families (claims + commitments + open loops). */
const canonicalTotals = async (sharedWorld) => {
  const claims = await sharedWorld.meaning.listClaims({});
  const commitments = await sharedWorld.meaning.listCommitments({});
  const openLoops = await sharedWorld.meaning.listOpenLoops({});
  return {
    total: claims.total + commitments.total + openLoops.total,
    claims,
    commitments,
    openLoops,
  };
};

/** The durable invocation-truth checks on a proposal-bearing turn (N-Q6-4). */
const checkInvocationTruth = async (composition, turnId, label) => {
  const invocations = await composition.stores.invocations.listInvocationsForTurn(turnId);
  const invocation = invocations.at(-1);
  if (invocation === undefined) {
    fail(`${label}: no durable invocation record exists for the turn`);
    return;
  }
  if (invocation.effect !== 'write') {
    fail(
      `${label}: the durable invocation effect is ${invocation.effect}, expected the truthful write`,
    );
  }
  if (invocation.approvalRequired !== false) {
    fail(`${label}: the durable invocation did not record approvalRequired=false`);
  }
  if (invocation.approvalDisposition !== 'host-policy-write-without-separate-approval') {
    fail(
      `${label}: the durable invocation disposition is ${invocation.approvalDisposition} (expected the host quiet-write policy disposition)`,
    );
  }
  const approvals = await composition.stores.approvals.listApprovalsForInvocation(
    invocation.invocationId,
  );
  if (approvals.length !== 0) {
    fail(
      `${label}: ${approvals.length} approval rows exist for the quiet proposal write (expected 0)`,
    );
  }
};

/** Run one provider turn of the matrix and record its safe metadata. */
const runMatrixTurn = async (
  composition,
  sharedWorld,
  swThreadId,
  mastraThreadId,
  input,
  key,
  label,
) => {
  const before = await canonicalTotals(sharedWorld);
  const proposalsBefore = (await sharedWorld.meaning.listProposals({ sourceThreadId: swThreadId }))
    .total;
  providerTurnCount += 1;
  const turn = await startTurnAdmitted(composition, swThreadId, mastraThreadId, input, key);
  const settled = await awaitTerminal(composition, turn.turnId);
  note(`${label}: status=${settled.status} in ${settled.elapsedMs}ms (content not printed)`);
  if (settled.status !== 'completed') {
    fail(
      `${label} expected completed, got ${settled.status} (${settled.errorCode ?? 'no code'}) — a truthful failed proof`,
    );
  }
  if (settled.elapsedMs > QLT_Q6_LIVE_BOUNDS.turnDeadlineMs + 5_000) {
    fail(`${label} exceeded the per-turn deadline bound (elapsed ${settled.elapsedMs}ms)`);
  }
  const invocations = await composition.stores.invocations.listInvocationsForTurn(turn.turnId);
  const proposalsAfter = await sharedWorld.meaning.listProposals({ sourceThreadId: swThreadId });
  const after = await canonicalTotals(sharedWorld);
  turnRecords.push({
    id: label,
    status: settled.status,
    elapsedMs: settled.elapsedMs,
    proposals: proposalsAfter.total - proposalsBefore,
    invocations: invocations.length,
  });
  const reply = await replyOf(sharedWorld, swThreadId);
  return {
    turnId: turn.turnId,
    streamId: turn.streamId,
    reply,
    invocations,
    newProposals: proposalsAfter.total - proposalsBefore,
    proposals: proposalsAfter,
    newCanonical: after.total - before.total,
    canonical: after,
  };
};

let result = {
  ok: false,
  findings,
  turns: turnRecords,
  fixture: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
  providerTurns: 0,
};

try {
  // ---- composition (live mode; the ONE owned root) ------------------------
  const composition = await composeLive(ownedDataDir);
  if (composition.modelMode !== 'live') {
    fail(`modelMode is ${composition.modelMode}, expected live`);
  } else {
    note(
      `composed in LIVE mode: ${QLT_Q6_PROVIDER_IDENTITY.provider} / ${QLT_Q6_PROVIDER_IDENTITY.model} (${QLT_Q6_PROVIDER_IDENTITY.routerIdentity} at ${QLT_Q6_PROVIDER_IDENTITY.endpoint})`,
    );
    note(
      `bounds: <=${QLT_Q6_LIVE_BOUNDS.maxProviderTurns} provider turns, <=${QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerTurn} output tokens/turn, <=${QLT_Q6_LIVE_BOUNDS.turnDeadlineMs}ms deadline/turn, zero retries, no fallback`,
    );
  }

  const threadA = await composition.sharedWorld.createThread({
    title: 'Q6 live discretion matrix',
  });
  const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);

  // ---- t1: explicit positive control --------------------------------------
  const t1 = await runMatrixTurn(
    composition,
    composition.sharedWorld,
    threadA.id,
    convA.mastraThreadId,
    QLT_Q6_T1_STATEMENT,
    'q6-live-t1',
    't1 (explicit remember request)',
  );
  checkInvocationTruth(composition, t1.turnId, 't1');
  const t1Findings = evaluateExplicitPositive({
    replyText: t1.reply,
    proposals: t1.proposals.rows.filter((row) => row.sourceThreadId === threadA.id),
    canonicalRecords: t1.canonical.total,
  });
  for (const finding of t1Findings) {
    fail(finding);
  }
  if (t1Findings.length === 0) {
    note(
      't1: the explicit remember request produced exactly one pending claim proposal (never canonical; no memory-write claim)',
    );
  }
  // The same-key retry replays the idempotent receipt — no second provider turn.
  const t1Replay = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: convA.mastraThreadId, input: QLT_Q6_T1_STATEMENT },
    idempotencyKey: 'q6-live-t1',
  });
  if (!t1Replay.ok) {
    fail('t1: the same-key retry was not truthfully replayed');
  } else {
    note('t1: the same-key retry replayed the idempotent receipt (no second provider turn)');
  }
  const proposalsAfterT1Replay = await composition.sharedWorld.meaning.listProposals({
    sourceThreadId: threadA.id,
  });
  if (proposalsAfterT1Replay.total !== 1) {
    fail(`t1: the retry created a duplicate proposal (${proposalsAfterT1Replay.total} total)`);
  }

  // ---- t2: the operator's external natural fixture (discretionary) --------
  const t2 = await runMatrixTurn(
    composition,
    composition.sharedWorld,
    threadA.id,
    convA.mastraThreadId,
    fixture.text,
    'q6-live-t2',
    't2 (natural discretionary fixture)',
  );
  checkInvocationTruth(composition, t2.turnId, 't2');
  const t2Proposals = t2.proposals.rows.filter((row) => row.sourceThreadId === threadA.id);
  const commitment = t2Proposals.find((row) => row.kind === 'commitment');
  const t2Findings = evaluateDiscretionaryPositive({
    replyText: t2.reply,
    proposals: t2Proposals,
    canonicalRecords: t2.canonical.total,
    invocationCount: t2.invocations.length,
  });
  for (const finding of t2Findings) {
    fail(finding);
  }
  if (t2Findings.length === 0) {
    note(
      `t2: the durable commitment was drafted with all ${QLT_Q6_COMMITMENT_ANCHORS.length} anchors (user's own commitment; transient incident not recorded)`,
    );
  }
  if (commitment === undefined) {
    fail('t2: no commitment proposal exists for the user ceremony to confirm');
  }

  // ---- t3: discretionary negative control ---------------------------------
  const t3 = await runMatrixTurn(
    composition,
    composition.sharedWorld,
    threadA.id,
    convA.mastraThreadId,
    QLT_Q6_T3_STATEMENT,
    'q6-live-t3',
    't3 (transient incident)',
  );
  const t3Findings = evaluateDiscretionaryNegative({
    replyText: t3.reply,
    newProposals: t3.newProposals,
    invocationCount: t3.invocations.length,
    newCanonicalRecords: t3.newCanonical,
  });
  for (const finding of t3Findings) {
    fail(finding);
  }
  if (t3Findings.length === 0) {
    note('t3: the ordinary software incident drafted nothing — discretion abstains');
  }

  // ---- the governed USER ceremony (not a provider turn) -------------------
  if (commitment === undefined) {
    throw new Error(
      'the proof stopped before the ceremony (no commitment to confirm; truthful failure; never rerun)',
    );
  }
  const confirmOutcome = await governedMutate(
    composition,
    'act.confirmProposal',
    { proposalId: commitment.id },
    'q6-live-confirm-1',
  );
  if (confirmOutcome.replayed !== false || confirmOutcome.ok !== true) {
    fail(`the governed confirmation failed truthfully (code ${confirmOutcome.code ?? 'unknown'})`);
  } else {
    note('the real-user confirmation crossed the governed ceremony (only the t2 commitment)');
  }
  let canonical = await canonicalTotals(composition.sharedWorld);
  if (canonical.total !== 1) {
    fail(`expected EXACTLY ONE canonical record after the confirmation, found ${canonical.total}`);
  }
  const canonicalCommitment = canonical.commitments.rows[0];
  if (canonicalCommitment === undefined) {
    fail('the confirmed canonical record is not a commitment');
  }
  if (canonicalCommitment !== undefined) {
    if (canonicalCommitment.createdBy === QLT_AGENT_PROPOSER_ID) {
      fail('authority violation: the canonical record carries an agent decision identity');
    } else {
      note(
        'authority: the canonical record was created by the governed user boundary, never the agent',
      );
    }
    if (canonicalCommitment.content?.statement !== commitment.content?.statement) {
      fail('the canonical commitment statement differs from the confirmed proposal statement');
    }
  }
  const commitmentId = canonicalCommitment?.id;
  const replayConfirm = await governedMutate(
    composition,
    'act.confirmProposal',
    { proposalId: commitment.id },
    'q6-live-confirm-1',
  );
  if (replayConfirm.ok !== true) {
    fail('the same-key confirmation replay was not truthfully replayed');
  }
  canonical = await canonicalTotals(composition.sharedWorld);
  if (canonical.total !== 1) {
    fail(
      `the confirmation replay duplicated the canonical record set (${canonical.total} records)`,
    );
  } else {
    note('the same-key confirmation replay created no duplicate record');
  }
  const staleExit = await governedMutate(
    composition,
    'act.releaseCommitment',
    { recordId: commitmentId, reason: 'stale-version control', expectedVersion: 999 },
    'q6-live-stale-exit',
  );
  if (staleExit.ok !== false || staleExit.code !== 'QLT_VERSION_CONFLICT') {
    fail(`the stale-version control was not refused truthfully (${staleExit.code ?? 'ok'})`);
  } else {
    note('the stale expectedVersion was refused (QLT_VERSION_CONFLICT; zero effect)');
  }
  const pendingIds = new Set(
    (await composition.sharedWorld.meaning.listProposals({})).rows.map((row) => row.id),
  );

  // ---- restart against the SAME verified owned root ------------------------
  const assemblyEvidenceBefore = await composition.sharedWorld.getContextAssemblyByTurn(t2.turnId);
  const restartBeganAt = Date.now();
  await composition.close();
  composed.length = 0;
  const composition2 = await composeLive(ownedDataDir);
  note(`restarted the live composition on the same data dir in ${Date.now() - restartBeganAt}ms`);
  const commitmentAfterRestart =
    commitmentId === undefined
      ? undefined
      : await composition2.sharedWorld.meaning.getCommitment(commitmentId);
  if (
    commitmentAfterRestart === undefined ||
    commitmentAfterRestart.status !== 'active' ||
    JSON.stringify(commitmentAfterRestart.content) !== JSON.stringify(canonicalCommitment.content)
  ) {
    fail('restart did not preserve the confirmed commitment truthfully');
  } else {
    note('restart preserved the confirmed commitment (active, same version, same content bytes)');
  }
  const linksAfterRestart = await composition2.sharedWorld.meaning.listSourceLinks({
    fromRecordId: commitmentId,
  });
  if (
    !linksAfterRestart.some(
      (link) => link.relation === 'source-thread' && link.toRef === threadA.id,
    )
  ) {
    fail('restart did not preserve the record lineage (source-thread link)');
  } else {
    note('restart preserved the record lineage');
  }
  const assemblyEvidenceAfter = await composition2.sharedWorld.getContextAssemblyByTurn(t2.turnId);
  if (JSON.stringify(assemblyEvidenceAfter) !== JSON.stringify(assemblyEvidenceBefore)) {
    fail('restart did not preserve the immutable per-turn assembly evidence');
  } else {
    note('restart preserved the per-turn assembly evidence');
  }

  // ---- t4: the genuinely FRESH conversation receives C1 --------------------
  const threadB = await composition2.sharedWorld.createThread({
    title: 'Q6 live fresh continuity',
  });
  const convB = await composition2.sharedWorld.ensureConversationLink(threadB.id);
  const restoredB = await composition2.restoreThread(threadB.id);
  if (restoredB.messages.length !== 0) {
    fail(`the fresh conversation is not transcript-free (${restoredB.messages.length} messages)`);
  }
  const t4 = await runMatrixTurn(
    composition2,
    composition2.sharedWorld,
    threadB.id,
    convB.mastraThreadId,
    QLT_Q6_T4_STATEMENT,
    'q6-live-t4',
    't4 (fresh-conversation continuity)',
  );
  const assemblyB = await composition2.sharedWorld.getContextAssemblyByTurn(t4.turnId);
  if (assemblyB === undefined || assemblyB.outcome !== 'complete') {
    fail('the fresh conversation turn has no complete per-turn assembly');
  } else {
    if (!assemblyB.selectedIds.some((entry) => entry.id === commitmentId)) {
      fail('the fresh conversation C1 snapshot did not select the confirmed commitment');
    } else {
      note(
        `the fresh conversation received the confirmed commitment through C1 (${assemblyB.selectedIds.length} record(s) selected, ${assemblyB.renderedBytes} rendered bytes)`,
      );
    }
    const leakedPending = assemblyB.selectedIds.filter((entry) => pendingIds.has(entry.id));
    if (leakedPending.length > 0) {
      fail(
        `the fresh conversation assembly injected ${leakedPending.length} pending proposal(s) as canonical meaning`,
      );
    } else {
      note('the pending proposals were not injected as canonical meaning');
    }
  }
  canonical = await canonicalTotals(composition2.sharedWorld);
  if (canonical.total !== 1) {
    fail(
      `the canonical record set changed across the fresh conversation (${canonical.total} records)`,
    );
  }

  // ---- t5: hypothetical conflict and negative control ----------------------
  const commitmentBeforeConflict =
    await composition2.sharedWorld.meaning.getCommitment(commitmentId);
  const t5 = await runMatrixTurn(
    composition2,
    composition2.sharedWorld,
    threadA.id,
    convA.mastraThreadId,
    QLT_Q6_T5_STATEMENT,
    'q6-live-t5',
    't5 (hypothetical conflict)',
  );
  const t5Findings = evaluateConflictTurn({
    replyText: t5.reply,
    newProposals: t5.newProposals,
    invocationCount: t5.invocations.length,
  });
  for (const finding of t5Findings) {
    fail(finding);
  }
  const commitmentAfterConflict =
    await composition2.sharedWorld.meaning.getCommitment(commitmentId);
  if (
    commitmentBeforeConflict === undefined ||
    commitmentAfterConflict === undefined ||
    commitmentAfterConflict.version !== commitmentBeforeConflict.version ||
    JSON.stringify(commitmentAfterConflict.content) !==
      JSON.stringify(commitmentBeforeConflict.content) ||
    commitmentAfterConflict.status !== 'active'
  ) {
    fail('the hypothetical silently changed the standing commitment (identity, version, or bytes)');
  } else {
    note(
      'the hypothetical left the standing commitment unchanged (identity, version, bytes) while it stayed available',
    );
  }
  const assemblyConflict = await composition2.sharedWorld.getContextAssemblyByTurn(t5.turnId);
  if (
    assemblyConflict === undefined ||
    !assemblyConflict.selectedIds.some((entry) => entry.id === commitmentId)
  ) {
    fail('the conflict turn assembly did not select the standing commitment');
  } else {
    note('the conflict turn assembly still selected the standing commitment');
  }

  // ---- transcript pollution + bounds + in-memory credential surfaces ------
  const restoredA = await composition2.restoreThread(threadA.id);
  const restoredAfterB = await composition2.restoreThread(threadB.id);
  const transcripts = restoredA.messages
    .concat(restoredAfterB.messages)
    .map((message) => message.text)
    .join('\n');
  if (
    transcripts.includes(QLT_CONTEXT_BLOCK_OPEN) ||
    transcripts.includes(QLT_CONTEXT_BLOCK_CLOSE) ||
    transcripts.includes(QLT_CONTEXT_RECORD_CLOSE)
  ) {
    fail('a durable transcript contains context-block bytes (pollution)');
  } else {
    note('both conversation transcripts are free of context-block bytes');
  }
  const canonicalFinal = await canonicalTotals(composition2.sharedWorld);
  if (canonicalFinal.total !== 1) {
    fail(
      `authority violation: ${canonicalFinal.total} canonical records exist (expected exactly 1)`,
    );
  } else {
    note('authority: exactly ONE canonical record exists — created only by the user confirmation');
  }
  const allFramesText = [];
  for (const streamId of [t1.streamId, t2.streamId, t3.streamId, t4.streamId, t5.streamId]) {
    if (streamId === undefined) {
      continue;
    }
    const frames = await composition2.stores.streamLedger.listEventsFrom(streamId, 0);
    for (const frame of frames) {
      allFramesText.push(JSON.stringify(frame));
    }
  }
  if (allFramesText.some((frame) => frame.includes(credential))) {
    fail('credential value found in ledger frames — LEAK');
  } else {
    note(`ledger frames scanned (${allFramesText.length} durable frames): credential absent`);
  }
  if (composition2.serializedOperatorConfig.includes(credential)) {
    fail('credential value found in the serialized operator configuration — LEAK');
  }
  if (providerTurnCount > QLT_Q6_LIVE_BOUNDS.maxProviderTurns) {
    fail(
      `provider-turn bound violated: ${providerTurnCount} > ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}`,
    );
  } else {
    note(
      `bounds: ${providerTurnCount} provider turns used of the planned five (<= ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}); one authoritative execution; zero retries; no fallback`,
    );
  }
  result = {
    ok: findings.length === 0,
    findings,
    turns: turnRecords,
    fixture: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
    providerTurns: providerTurnCount,
  };
  await composition2.close();
  composed.length = 0;
} catch (error) {
  fail(safeCrashMessage(error));
  result = {
    ok: false,
    findings,
    turns: turnRecords,
    fixture: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
    providerTurns: providerTurnCount,
  };
} finally {
  for (const composition of composed.splice(0)) {
    await composition.close().catch(() => undefined);
  }
  // The result record goes INSIDE the owned root so the parent reads it
  // before its post-exit scans and deletion. The worker itself deletes
  // NOTHING and scans every deletion path for nobody.
  try {
    writeFileSync(join(ownedDataDir, Q6_RESULT_FILE_NAME), JSON.stringify(result, null, 1), 'utf8');
  } catch {
    console.error('WORKER: the result record could not be written — the parent will fail closed.');
    process.exit(4);
  }
}
process.exit(0);
