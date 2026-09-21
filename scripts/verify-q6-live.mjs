#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q6 — the BOUNDED LIVE-provider Shared World
 * ceremony proof (N-C24; `npm run verify:q6:live`).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md §2/§3 and
 * the frozen declarative module `src/lib/sharedworld/q6-contract.ts`.
 *
 * HARD GATE (the script refuses to run otherwise, exit 2):
 *   - QUELLIGHT_LIVE_PROOF must be set to exactly 1 in the environment;
 *   - OLLAMA_API_KEY must be PRESENT in the process environment
 *     (existence only; the value is never printed, inspected, hashed,
 *     serialized, or written anywhere by this harness).
 *
 * BOUNDS (frozen; verified from the real composition and this run):
 *   <= 6 provider turns (this plan uses 3);
 *   <= 256 output tokens per turn (QUELLIGHT_MAX_OUTPUT_TOKENS=256);
 *   <= 120 s deadline per provider turn (QUELLIGHT_TURN_DEADLINE_MS=120000);
 *   exactly ONE authoritative execution (operator process discipline;
 *   never re-run silently);
 *   ZERO automatic provider retries (the profile pins maxRetries: 0 and
 *   this harness never re-dispatches a failed turn);
 *   no alternative model and no fallback provider.
 *
 * THE CEREMONY (all through the REAL production paths; disposable data):
 *   t1 (thread A): the named minimal example statement through the REAL
 *      admission boundary and the REAL model -> the real model drafts a
 *      bounded pending proposal through qlt.proposal.draft@2; the
 *      durable invocation records the truthful write evidence; the
 *      proposal stays epistemically inert.
 *   A retry of t1 with the SAME key replays VICT's idempotent receipt
 *      with no second provider turn and no duplicate proposal.
 *   The USER confirms the proposal through the REAL governed ceremony
 *      (the released app.data.mutate boundary, the exact /api/act
 *      payload) -> EXACTLY ONE canonical record; a same-key replay
 *      duplicates nothing; a stale expectedVersion is refused with zero
 *      effect.
 *   Restart: the composition closes and recomposes on the SAME disposable
 *      data directory (the ONE owned workspace root, passed explicitly to
 *      both compositions and identity-asserted before any provider
 *      turn); the confirmed record, its lineage, and the
 *      assembly evidence survive.
 *   t2 (thread B, genuinely fresh, NO transcript dependency): the model
 *      receives the confirmed meaning through the per-turn C1 snapshot
 *      (the durable assembly record selected the confirmed record); the
 *      fresh thread's durable transcript contains zero context-block
 *      bytes.
 *   t3 (thread A): a conflicting statement -> the standing record is
 *      available to the model and NOT silently changed (identity,
 *      version, and content bytes unchanged; exactly one canonical
 *      record).
 *   Authority (live): no model response exercised user authority — the
 *      canonical record set is unchanged except by the explicit user
 *      confirmation; zero ceremony effects occur without the governed
 *      user-attributed mutation.
 *
 * METADATA ONLY: no conversation content is ever printed (ids, statuses,
 * counts, and elapsed times only). Every byte under the ONE owned
 * disposable data root — the exact directory every composition runs
 * against (workspace ownership is explicit and asserted at runtime;
 * scripts/lib/q6-live-workspace.mjs) —, every captured ledger frame,
 * and the serialized operator configuration are scanned for the
 * credential VALUE on success AND on failure; any hit fails the proof.
 * Provider 429/5xx/timeout/malformed responses settle truthfully as a
 * FAILED proof; nothing is retried.
 *
 * This script runs OUTSIDE every automatic gate, by explicit operator
 * invocation, after ALL offline gates are green, exactly once.
 */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createQ6LiveWorkspace } from './lib/q6-live-workspace.mjs';
import {
  QLT_Q6_LIVE_BOUNDS,
  QLT_Q6_PROVIDER_IDENTITY,
  QLT_Q6_EXAMPLE_STATEMENT,
} from '../src/lib/sharedworld/q6-contract.ts';
import {
  QLT_CONTEXT_BLOCK_OPEN,
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_RECORD_CLOSE,
} from '../src/lib/sharedworld/context-contract.ts';
import { QLT_AGENT_PROPOSER_ID } from '../src/lib/sharedworld/ceremony-contract.ts';

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);

console.log('verify:q6:live — the bounded live Shared World ceremony proof (N-C24)');

// ---------- gate (double; fail closed) ----------
if (process.env.QUELLIGHT_LIVE_PROOF !== QLT_Q6_PROVIDER_IDENTITY.activationGateValue) {
  console.error(
    'REFUSED: QUELLIGHT_LIVE_PROOF must be set to exactly 1 to run the live ceremony proof.',
  );
  process.exit(2);
}
const credentialPresent =
  typeof process.env.OLLAMA_API_KEY === 'string' && process.env.OLLAMA_API_KEY.length > 0;
if (!credentialPresent) {
  console.error(
    'REFUSED: OLLAMA_API_KEY is not present in the process environment. Configure it in the operator environment (never in chat, source, or committed files), then run the gate exactly once.',
  );
  process.exit(2);
}
note('gate: QUELLIGHT_LIVE_PROOF=1 present; OLLAMA_API_KEY present (value never inspected)');
// The value is read ONCE, into this closure, and never emitted anywhere.
const CREDENTIAL = process.env.OLLAMA_API_KEY;

// ---------- composition (tsx-loaded TS; the REAL production composition) ----
const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  new URL('../src/lib/server/composition.ts', import.meta.url).href
);
const { getCompiledPlan } = await import(
  new URL('../src/lib/application/definition.ts', import.meta.url).href
);

// ---------- the ONE owned disposable workspace (explicit ownership) ------
// Exactly ONE root is allocated for the whole proof; every composition
// (initial and restart) is handed THIS exact path explicitly, its
// resolved data directory is asserted to be this root BEFORE any provider
// turn, the leak scans cover every byte under it, and cleanup removes it
// (verified; an unremovable root FAILS the proof). There is no second
// mkdtempSync and no untracked composition directory.
const workspace = createQ6LiveWorkspace();
const ownedDataDir = workspace.root;

const composed = [];
const composeLive = async (directory) => {
  // Ownership is explicit at the call site: the caller passes the exact
  // owned root; anything else is refused before any composition exists.
  workspace.requireOwned(directory, 'composeLive');
  const composition = await createQuellightComposition({
    env: resolveQuellightEnvironment(
      {
        ...workspace.dataEnv(directory),
        QUELLIGHT_LIVE_PROOF: '1',
        QUELLIGHT_MAX_OUTPUT_TOKENS: String(QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerTurn),
        QUELLIGHT_TURN_DEADLINE_MS: String(QLT_Q6_LIVE_BOUNDS.turnDeadlineMs),
      },
      process.cwd(),
    ),
    skipListen: true,
  });
  try {
    // Fail closed BEFORE any provider turn if the resolved directory
    // identity differs from the owned root.
    workspace.requireCompositionDataDir(composition, 'composeLive');
  } catch (error) {
    // The foreign directory must not escape cleanup either.
    await composition.close().catch(() => undefined);
    try {
      rmSync(resolve(composition.dataDir), { recursive: true, force: true });
    } catch {
      /* best-effort; the proof is already failing closed */
    }
    throw error;
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

/** One turn through the REAL production admission boundary. */
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
  return {
    turnId: admission.result.data.turnId,
    streamId: admission.result.data.streamId,
  };
};

/** One governed ceremony mutation (the exact /api/act payload shape). */
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

let providerTurnCount = 0;
const leakScan = (label) => {
  // Every file under the ONE owned root (nested included) — the exact
  // directory every composition ran against.
  const offending = workspace.scanForCredential(CREDENTIAL);
  for (const file of offending) {
    fail(`${label}: credential value found in ${file} — LEAK`);
  }
  if (offending.length === 0) {
    note(`leak scan (${label}): every persisted byte scanned — credential absent`);
  }
};

try {
  // ---------- composition (live mode; the ONE owned root) ----------
  const composition = await composeLive(ownedDataDir);
  if (composition.modelMode !== 'live') {
    fail(`modelMode is ${composition.modelMode}, expected live`);
  } else {
    note(
      `composed in LIVE mode: ${QLT_Q6_PROVIDER_IDENTITY.provider} / ${QLT_Q6_PROVIDER_IDENTITY.model} ` +
        `(${QLT_Q6_PROVIDER_IDENTITY.routerIdentity} at ${QLT_Q6_PROVIDER_IDENTITY.endpoint})`,
    );
    note(
      `bounds: <=${QLT_Q6_LIVE_BOUNDS.maxProviderTurns} provider turns, ` +
        `<=${QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerTurn} output tokens/turn, ` +
        `<=${QLT_Q6_LIVE_BOUNDS.turnDeadlineMs}ms deadline/turn, zero retries, no fallback`,
    );
  }

  // ---------- t1: the named example statement -> a real drafted proposal ----
  const threadA = await composition.sharedWorld.createThread({ title: 'Q6 live ceremony' });
  const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
  providerTurnCount += 1;
  const t1StartedAt = Date.now();
  const turn1 = await startTurnAdmitted(
    composition,
    threadA.id,
    convA.mastraThreadId,
    QLT_Q6_EXAMPLE_STATEMENT,
    'q6-live-t1',
  );
  const streamId1 = turn1.streamId;
  const t1Settled = await awaitTerminal(composition, turn1.turnId);
  note(
    `t1: status=${t1Settled.status} in ${t1Settled.elapsedMs}ms (turnId recorded; content not printed)`,
  );
  if (t1Settled.status !== 'completed') {
    fail(
      `t1 expected completed, got ${t1Settled.status} (${t1Settled.errorCode ?? 'no code'}) — a truthful failed proof`,
    );
  }
  if (t1Settled.elapsedMs > QLT_Q6_LIVE_BOUNDS.turnDeadlineMs + 5_000) {
    fail(`t1 exceeded the per-turn deadline bound (elapsed ${t1Settled.elapsedMs}ms)`);
  }
  const invocations = await composition.stores.invocations.listInvocationsForTurn(turn1.turnId);
  const invocation = invocations.at(-1);
  if (invocation === undefined) {
    fail('t1: no durable invocation record exists for the turn');
  } else {
    if (invocation.effect !== 'write') {
      fail(
        `t1: the durable invocation effect is ${invocation.effect}, expected the truthful write`,
      );
    }
    if (invocation.approvalRequired !== false) {
      fail('t1: the durable invocation did not record approvalRequired=false');
    }
    if (invocation.approvalDisposition !== 'host-policy-write-without-separate-approval') {
      fail(
        `t1: the durable invocation disposition is ${invocation.approvalDisposition} (expected the host quiet-write policy disposition)`,
      );
    }
    const approvals = await composition.stores.approvals.listApprovalsForInvocation(
      invocation.invocationId,
    );
    if (approvals.length !== 0) {
      fail(`t1: ${approvals.length} approval rows exist for the quiet proposal write (expected 0)`);
    }
  }
  const proposalsA = await composition.sharedWorld.meaning.listProposals({
    sourceThreadId: threadA.id,
  });
  if (proposalsA.total !== 1 || proposalsA.rows[0]?.status !== 'proposed') {
    fail(
      `t1: expected EXACTLY ONE pending proposal drafted by the real model through the capability, found ${proposalsA.total} (statuses: ${proposalsA.rows.map((row) => row.status).join(',') || 'none'})`,
    );
  } else {
    note(
      `t1: the real model drafted exactly one pending proposal through qlt.proposal.draft@2 (proposedBy=${proposalsA.rows[0].proposedBy})`,
    );
    if (proposalsA.rows[0].proposedBy !== QLT_AGENT_PROPOSER_ID) {
      fail(`t1: the proposal proposer identity is wrong (${proposalsA.rows[0].proposedBy})`);
    }
  }
  const candidatesA = await composition.sharedWorld.listContextCandidates();
  if (proposalsA.rows[0] !== undefined && candidatesA.some((c) => c.id === proposalsA.rows[0].id)) {
    fail('t1: the pending proposal is a context candidate (epistemic-inertness violation)');
  } else {
    note('t1: the pending proposal is epistemically inert (never a context candidate)');
  }
  // The proposal-draft retry: the SAME key replays VICT's idempotent
  // receipt — no second provider turn and no duplicate proposal.
  const t1Replay = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: convA.mastraThreadId, input: QLT_Q6_EXAMPLE_STATEMENT },
    idempotencyKey: 'q6-live-t1',
  });
  if (!t1Replay.ok) {
    fail('t1: the same-key retry was not truthfully replayed');
  } else {
    note('t1: the same-key retry replayed the idempotent receipt (no second provider turn)');
  }
  const proposalsAfterReplay = await composition.sharedWorld.meaning.listProposals({
    sourceThreadId: threadA.id,
  });
  if (proposalsAfterReplay.total !== 1) {
    fail(`t1: the retry created a duplicate proposal (${proposalsAfterReplay.total} total)`);
  } else {
    note('t1: the retry produced no duplicate proposal (idempotency holds)');
  }
  leakScan('after-t1');
  if (failures.length > 0) {
    throw new Error('the proof stopped at the t1 boundary (truthful failure; never rerun)');
  }

  // ---------- the governed USER confirmation ----------
  const proposal = proposalsA.rows[0];
  const confirmOutcome = await governedMutate(
    composition,
    'act.confirmProposal',
    { proposalId: proposal.id },
    'q6-live-confirm-1',
  );
  if (confirmOutcome.replayed !== false || confirmOutcome.ok !== true) {
    fail(`the governed confirmation failed truthfully (code ${confirmOutcome.code ?? 'unknown'})`);
  } else {
    note('the real-user confirmation crossed the governed ceremony');
  }
  const claimsA = await composition.sharedWorld.meaning.listClaims({});
  if (claimsA.total !== 1 || claimsA.rows[0]?.status !== 'active') {
    fail(`expected EXACTLY ONE canonical record after the confirmation, found ${claimsA.total}`);
  } else {
    note(
      `the confirmation created EXACTLY ONE canonical record (createdBy=${claimsA.rows[0].createdBy})`,
    );
  }
  const claimId = claimsA.rows[0]?.id;
  const replayConfirm = await governedMutate(
    composition,
    'act.confirmProposal',
    { proposalId: proposal.id },
    'q6-live-confirm-1',
  );
  if (replayConfirm.ok !== true) {
    fail('the same-key confirmation replay was not truthfully replayed');
  }
  const claimsAfterReplay = await composition.sharedWorld.meaning.listClaims({});
  if (claimsAfterReplay.total !== 1) {
    fail(`the confirmation replay duplicated the record (${claimsAfterReplay.total} claims)`);
  } else {
    note('the same-key confirmation replay created no duplicate record');
  }
  // A stale expectedVersion is refused with zero effect.
  const staleExit = await governedMutate(
    composition,
    'act.retireClaim',
    { recordId: claimId, reason: 'stale-version control', expectedVersion: 999 },
    'q6-live-stale-exit',
  );
  if (staleExit.ok !== false || staleExit.code !== 'QLT_VERSION_CONFLICT') {
    fail(`the stale-version control was not refused truthfully (${staleExit.code ?? 'ok'})`);
  } else {
    note('the stale expectedVersion was refused (QLT_VERSION_CONFLICT; zero effect)');
  }
  leakScan('after-confirm');
  if (failures.length > 0) {
    throw new Error('the proof stopped after the confirmation (truthful failure; never rerun)');
  }

  // ---------- restart: the confirmed record and lineage survive -------------
  const assemblyEvidenceBefore = await composition.sharedWorld.getContextAssemblyByTurn(
    turn1.turnId,
  );
  const restartBeganAt = Date.now();
  await composition.close();
  composed.length = 0;
  // The restart recomposes against the SAME owned root, passed
  // explicitly; composeLive re-asserts the resolved identity before any
  // provider turn (the former unused `restartDataDir` assignment is
  // replaced by this enforced identity check).
  const composition2 = await composeLive(ownedDataDir);
  note(`restarted the live composition on the same data dir in ${Date.now() - restartBeganAt}ms`);
  const claimAfterRestart = await composition2.sharedWorld.meaning.getClaim(claimId);
  if (
    claimAfterRestart === undefined ||
    claimAfterRestart.status !== 'active' ||
    claimAfterRestart.content?.statement !== claimsA.rows[0].content?.statement
  ) {
    fail('restart did not preserve the confirmed record truthfully');
  } else {
    note('restart preserved the confirmed record (active, same version, same content bytes)');
  }
  const linksAfterRestart = await composition2.sharedWorld.meaning.listSourceLinks({
    fromRecordId: claimId,
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
  const assemblyEvidenceAfter = await composition2.sharedWorld.getContextAssemblyByTurn(
    turn1.turnId,
  );
  if (JSON.stringify(assemblyEvidenceAfter) !== JSON.stringify(assemblyEvidenceBefore)) {
    fail('restart did not preserve the immutable per-turn assembly evidence');
  } else {
    note('restart preserved the per-turn assembly evidence');
  }

  // ---------- t2: the genuinely FRESH conversation receives C1 --------------
  const threadB = await composition2.sharedWorld.createThread({ title: 'Q6 live fresh thread' });
  const convB = await composition2.sharedWorld.ensureConversationLink(threadB.id);
  const restoredB = await composition2.restoreThread(threadB.id);
  if (restoredB.messages.length !== 0) {
    fail(`the fresh conversation is not transcript-free (${restoredB.messages.length} messages)`);
  }
  providerTurnCount += 1;
  const turnB = await startTurnAdmitted(
    composition2,
    threadB.id,
    convB.mastraThreadId,
    'Briefly: what do you know about my job plans?',
    'q6-live-t-b',
  );
  const streamIdB = turnB.streamId;
  const tBSettled = await awaitTerminal(composition2, turnB.turnId);
  note(`t2 (fresh conversation): status=${tBSettled.status} in ${tBSettled.elapsedMs}ms`);
  if (tBSettled.status !== 'completed') {
    fail(`t2 expected completed, got ${tBSettled.status} (${tBSettled.errorCode ?? 'no code'})`);
  }
  const assemblyB = await composition2.sharedWorld.getContextAssemblyByTurn(turnB.turnId);
  if (assemblyB === undefined || assemblyB.outcome !== 'complete') {
    fail('the fresh conversation turn has no complete per-turn assembly');
  } else if (!assemblyB.selectedIds.some((entry) => entry.id === claimId)) {
    fail('the fresh conversation C1 snapshot did not select the confirmed record');
  } else {
    note(
      `the fresh conversation received the confirmed meaning through C1 (assembly selected ${assemblyB.selectedIds.length} record(s), ${assemblyB.renderedBytes} rendered bytes)`,
    );
  }
  const restoredAfterB = await composition2.restoreThread(threadB.id);
  const transcriptB = restoredAfterB.messages.map((message) => message.text).join('\n');
  if (
    transcriptB.includes(QLT_CONTEXT_BLOCK_OPEN) ||
    transcriptB.includes(QLT_CONTEXT_BLOCK_CLOSE) ||
    transcriptB.includes(QLT_CONTEXT_RECORD_CLOSE)
  ) {
    fail('the fresh conversation durable transcript contains context-block bytes (pollution)');
  } else if (restoredAfterB.messages.length !== 2) {
    fail(
      `the fresh conversation transcript is not exactly its own exchange (${restoredAfterB.messages.length} messages)`,
    );
  } else {
    note(
      'the fresh conversation transcript is clean (zero context-block bytes; own exchange only)',
    );
  }

  // ---------- t3: the conflicting statement cannot silently change truth ----
  const claimsBeforeConflict = await composition2.sharedWorld.meaning.listClaims({});
  providerTurnCount += 1;
  const turnConflict = await startTurnAdmitted(
    composition2,
    threadA.id,
    convA.mastraThreadId,
    'Update: I have decided to leave my job as soon as possible.',
    'q6-live-t-conflict',
  );
  const streamIdConflict = turnConflict.streamId;
  const tCSettled = await awaitTerminal(composition2, turnConflict.turnId);
  note(`t3 (conflict statement): status=${tCSettled.status} in ${tCSettled.elapsedMs}ms`);
  if (tCSettled.status !== 'completed') {
    fail(`t3 expected completed, got ${tCSettled.status} (${tCSettled.errorCode ?? 'no code'})`);
  }
  const claimsAfterConflict = await composition2.sharedWorld.meaning.listClaims({});
  if (claimsAfterConflict.total !== 1) {
    fail(
      `the conflicting statement changed the canonical record set (${claimsAfterConflict.total} claims)`,
    );
  } else {
    const claimAfterConflict = await composition2.sharedWorld.meaning.getClaim(claimId);
    if (
      claimAfterConflict === undefined ||
      claimAfterConflict.status !== 'active' ||
      claimAfterConflict.version !== 1 ||
      claimAfterConflict.content?.statement !== claimsA.rows[0].content?.statement
    ) {
      fail('the standing record was silently changed by the conflicting turn');
    } else {
      note(
        'the conflicting statement left the standing record unchanged (identity, version, bytes) while it stayed available',
      );
    }
  }
  const assemblyConflict = await composition2.sharedWorld.getContextAssemblyByTurn(
    turnConflict.turnId,
  );
  if (
    assemblyConflict === undefined ||
    assemblyConflict.outcome !== 'complete' ||
    !assemblyConflict.selectedIds.some((entry) => entry.id === claimId)
  ) {
    fail('the conflict turn assembly did not select the standing record');
  } else {
    note('the conflict turn assembly still selected the standing record');
  }
  // The durable transcript of thread A must contain zero block markers.
  const restoredA = await composition2.restoreThread(threadA.id);
  const transcriptA = restoredA.messages.map((message) => message.text).join('\n');
  if (transcriptAIncludesMarkers(transcriptA) || transcriptAIncludesMarkers(transcriptB)) {
    fail('a durable transcript contains context-block bytes');
  } else {
    note('both conversation transcripts are free of context-block bytes');
  }
  function transcriptAIncludesMarkers(text) {
    return (
      text.includes(QLT_CONTEXT_BLOCK_OPEN) ||
      text.includes(QLT_CONTEXT_BLOCK_CLOSE) ||
      text.includes(QLT_CONTEXT_RECORD_CLOSE)
    );
  }
  // Any model-drafted proposal from t2/t3 stays pending (never canonical by
  // itself): no canonical record exists beyond the user-confirmed claim.
  const finalClaims = await composition2.sharedWorld.meaning.listClaims({});
  if (finalClaims.total !== 1) {
    fail(`authority violation: ${finalClaims.total} canonical claims exist (expected exactly 1)`);
  } else {
    note('authority: exactly ONE canonical record exists — created only by the user confirmation');
  }

  // ---------- final credential and bounds accounting ----------
  leakScan('final');
  // Every captured ledger frame of every turn must be credential-free.
  const allFramesText = [];
  for (const streamId of [streamId1, streamIdB, streamIdConflict]) {
    if (streamId === undefined) {
      continue;
    }
    const frames = await composition2.stores.streamLedger.listEventsFrom(streamId, 0);
    for (const frame of frames) {
      allFramesText.push(JSON.stringify(frame));
    }
  }
  if (allFramesText.some((frame) => frame.includes(CREDENTIAL))) {
    fail('credential value found in ledger frames — LEAK');
  } else {
    note(`ledger frames scanned (${allFramesText.length} durable frames): credential absent`);
  }
  if (providerTurnCount > QLT_Q6_LIVE_BOUNDS.maxProviderTurns) {
    fail(
      `provider-turn bound violated: ${providerTurnCount} > ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}`,
    );
  } else {
    note(
      `bounds: ${providerTurnCount} provider turns used (<= ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}); one authoritative execution; zero retries; no fallback`,
    );
  }
  if (composition2.serializedOperatorConfig.includes(CREDENTIAL)) {
    fail('credential value found in the serialized operator configuration — LEAK');
  }
  await composition2.close();
  composed.length = 0;
} catch (error) {
  fail(`live ceremony proof crashed: ${String(error && error.message ? error.message : error)}`);
} finally {
  for (const composition of composed.splice(0)) {
    await composition.close().catch(() => undefined);
  }
  // Final leak scan over every byte of the ONE owned workspace (also on
  // the failure path), then VERIFIED cleanup: an unremovable root FAILS
  // the proof rather than emitting a note.
  try {
    const offending = workspace.scanForCredential(CREDENTIAL);
    for (const file of offending) {
      fail(`final leak scan: credential value found in ${file}`);
    }
    if (offending.length === 0) {
      note('final leak scan: every byte of the owned workspace scanned — credential absent');
    }
  } catch {
    /* nothing left to scan */
  }
  const { removed } = await workspace.dispose();
  if (removed) {
    note('cleanup: the owned disposable workspace was removed (verified)');
  } else {
    fail('cleanup: the owned disposable workspace could NOT be removed — the proof fails closed');
  }
}

console.log('');
if (failures.length > 0) {
  console.error(
    `verify:q6:live: FAILED with ${failures.length} finding(s) — the live proof is a TRUTHFUL FAILURE; it was executed once and is never silently rerun.`,
  );
  process.exit(1);
}
console.log(
  'verify:q6:live: PASS — the bounded live ceremony proof is green (statement -> real-model proposal -> governed confirmation -> one canonical record -> restart -> fresh-thread C1 -> conflict non-mutation; credential absent from every observable surface).',
);
process.exit(0);
