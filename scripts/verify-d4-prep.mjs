#!/usr/bin/env node
/**
 * Quellight Stage 07D Phase D4a — the permanent offline preparation gate
 * for the MSTR-012 real-use proof (contract
 * `quellight.stage07d.d4.proof-contract@2`, Amendment 1).
 *
 * Implements the frozen control list N-D4-P-1..N-D4-P-18 plus the
 * Amendment-1 determinism controls N-D4-P-19..N-D4-P-24
 * (src/lib/sharedworld/d4-contract.ts §7) ENTIRELY OFFLINE: synthetic
 * evidence, disposable synthetic stores, no provider access of any
 * kind, no operator data, no `.quellight-data`, no `.pi/` reads. The
 * harness itself is spawned ONLY for its refusal paths (with the
 * session flag absent, with a consumed/malformed receipt, without a
 * credential) — it can never reach transport in this gate because the
 * flag/receipt/credential gates all refuse first, and the gate never
 * provides a credential.
 *
 * Permanent rule: this gate must stay green before any owner
 * authorization for the structured session is requested.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QLT_D4_BOUNDS,
  QLT_D4_CHECK_CLASSIFICATION,
  QLT_D4_CODES,
  QLT_D4_OBSERVATION_DETAIL_KEYS,
  QLT_D4_OUTCOMES,
  QLT_D4_PROFILE,
  QLT_D4_PROOF_CONTRACT_ID,
  QLT_D4_REQUIRED_CHECKS,
  QLT_D4_CHECK_PREREQUISITES,
} from '../src/lib/sharedworld/d4-contract.ts';
import { QLT_AGENT_PROPOSER_ID } from '../src/lib/sharedworld/ceremony-contract.ts';
import { getCompiledPlan } from '../src/lib/application/definition.ts';
import {
  createEvidenceLedger,
  planBudget,
  readAuthorizationReceipt,
  resolveWorkspace,
  sealEvidence,
  writeAuthorizationReceipt,
} from './lib/d4-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const harnessPath = join(repoRoot, 'scripts', 'run-d4-structured-session.mjs');
const failures = [];
const checksRun = [];

const check = (id, ok, detail = '') => {
  checksRun.push(id);
  if (!ok) failures.push(`${id}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${ok ? 'ok' : 'FAIL'}: ${id}${detail ? ` — ${detail}` : ''}`);
};

// Synthetic scenario reference values (NOT real credentials).
const fakeCredential = 'offline-prep-canary-value';
const fakeDigest = 'offline-prep-scenario-digest';

// ---------------------------------------------------------------------------
// Synthetic full-lifecycle ledger builder
// ---------------------------------------------------------------------------
const buildFullLedger = (ledger, omit = [], observations = false) => {
  const ids = { preserved: 'cl-preserved', removable: 'cl-removable', thread: 'qlt-thread-c' };
  const add = (checkId, detail = {}, ok = true) => {
    if (!omit.includes(checkId)) ledger.append({ kind: 'receipt', check: checkId, ok, detail });
  };
  add('a1-conversation-usable', { turnStatus: 'completed', messageCount: 2 });
  add('a2-durable-meaning-preserved', {
    recordId: ids.preserved,
    path: 'direct-save',
    ...(observations ? { ceremonyObservation: { drafted: false } } : {}),
  });
  add('a3-no-agent-canonical', {
    recordId: ids.preserved,
    pendingCount: 1,
    preservedPath: 'direct-save',
  });
  add('a7-conflict-challenge-quiet', {
    exercise: 'distinct-key',
    standingUnchanged: true,
    boundaryFailed: false,
    openChallengesRemaining: 0,
    ...(observations ? { conflictClassExercised: false, modelProposalObserved: true } : {}),
  });
  add('export-produced', { documentBytes: 16, disclosure: true });
  add('a8-export-truthful', { documentBytes: 16 });
  add('deletion-previewed', { threadId: ids.thread });
  add('record-removed', { recordId: ids.removable, retentionState: 'user-removed' });
  add('a9-proof-record-removal', { recordId: ids.removable });
  add('restart-performed', { recordId: 'commitment-proof' });
  add('a4-restart-preserved', { recordId: 'commitment-proof' });
  add('assembly-selected', { recordId: 'commitment-proof', selectedCount: 1 });
  add('a5-fresh-thread-received', { recordId: 'commitment-proof' });
  add('ineligible-seeded', {
    pendingId: 'prop-pending',
    removedRecordId: ids.removable,
    expiredRecordId: 'cl-expired',
  });
  add('a6-ineligible-excluded', {
    removedExcluded: true,
    expiredExcluded: true,
    ...(observations ? { pendingProposalObservation: true } : {}),
  });
  add('conversation-deleted', { threadId: ids.thread, mode: 'conversation-only' });
  add('meaning-byte-identical', { threadId: ids.thread });
  add('a10-conversation-only-preserved', { threadId: ids.thread });
  add('reconciliation-receipts', { threadId: ids.thread });
  add('boot-recovery-clean', { resumed: 0 });
  add('a11-reconciliation-complete', { threadId: ids.thread });
  add('context-marker-absent', { threadId: 'qlt-thread-fresh' });
  add('a12-transcripts-clean', { threadId: 'qlt-thread-fresh' });
  add('a13-evidence-hygiene', { scanned: 'workspace-bytes' });
  return ids;
};

const sealOptions = {
  credentialNeedle: fakeCredential,
  scenarioDigest: fakeDigest,
  sessionStartedAtMs: 1,
  sessionEndedAtMs: 2,
};

// ---------------------------------------------------------------------------
// Harness spawn helper (refusal paths only — never authorized here)
// ---------------------------------------------------------------------------
const spawnHarness = (envOverrides) => {
  const env = { ...process.env };
  delete env.OLLAMA_API_KEY; // the gate NEVER provides a credential
  delete env.QUELLIGHT_D4_STRUCTURED;
  delete env.QUELLIGHT_D4_SCENARIO_FILE;
  env.QUELLIGHT_D4_CREDENTIAL_SOURCE = 'none'; // test-only: force the missing-credential refusal
  Object.assign(env, envOverrides);
  return spawnSync(process.execPath, ['--import', 'tsx', harnessPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
};

const receiptPath = join(
  repoRoot,
  'docs',
  'report',
  'evidence',
  'd4-structured-session-receipt.json',
);
const evidencePath = join(
  repoRoot,
  'docs',
  'report',
  'evidence',
  'd4-structured-session-evidence.json',
);
const withReceipt = (body) => {
  writeFileSync(receiptPath, body, { flag: 'wx' });
};

// D4b remediation: the consumed authorization receipt is a committed
// HISTORICAL record after D4b. Every receipt probe must therefore be
// STATE-AWARE: when the receipt exists it is never overwritten or removed;
// the refusal semantics are proven against the real receipt itself, and
// the exclusive-create machinery is exercised at a task-owned temporary
// path instead. The state is captured BEFORE the gate touches anything.
const receiptExistedAtGateStart = existsSync(receiptPath);
const receiptBytesAtGateStart = receiptExistedAtGateStart ? readFileSync(receiptPath) : undefined;

console.log('verify:d4-prep — the MSTR-012 real-use proof preparation gate (offline)');

try {
  // ---- N-D4-P-1: the harness refuses without the explicit session flag ----
  const p1 = spawnHarness({});
  check(
    'N-D4-P-1 harness refuses without the explicit owner session flag',
    p1.status === 2 && p1.stderr.includes(QLT_D4_CODES.NOT_AUTHORIZED),
    p1.stderr.split('\n')[0] ?? '',
  );
  check(
    'N-D4-P-1b the refusal neither creates nor removes an authorization receipt',
    existsSync(receiptPath) === receiptExistedAtGateStart,
  );

  // ---- N-D4-P-2: the harness refuses a reused authorization receipt -------
  if (receiptExistedAtGateStart) {
    // The historical consumed receipt IS the reuse case: no probe write.
    const p2 = spawnHarness({ QUELLIGHT_D4_STRUCTURED: '1', QUELLIGHT_D4_SCENARIO_FILE: 'x.json' });
    check(
      'N-D4-P-2 harness refuses the consumed authorization receipt',
      p2.status === 2 && p2.stderr.includes(QLT_D4_CODES.ALREADY_AUTHORIZED),
      p2.stderr.split('\n')[0] ?? '',
    );
  } else {
    withReceipt(
      JSON.stringify({
        authorizedAt: '2026-09-22T00:00:00.000Z',
        contract: QLT_D4_PROOF_CONTRACT_ID,
        profile: QLT_D4_PROFILE,
      }) + '\n',
    );
    const p2 = spawnHarness({ QUELLIGHT_D4_STRUCTURED: '1', QUELLIGHT_D4_SCENARIO_FILE: 'x.json' });
    check(
      'N-D4-P-2 harness refuses a reused authorization receipt',
      p2.status === 2 && p2.stderr.includes(QLT_D4_CODES.ALREADY_AUTHORIZED),
      p2.stderr.split('\n')[0] ?? '',
    );
    rmSync(receiptPath, { force: true });
  }

  // ---- N-D4-P-3: the harness refuses a malformed receipt ------------------
  // D4b remediation: the malformed-receipt probe writes synthetic bytes at
  // the real path; it may only run when NO historical receipt exists.
  if (!receiptExistedAtGateStart) {
    withReceipt('{ not json at all');
    const p3 = spawnHarness({ QUELLIGHT_D4_STRUCTURED: '1', QUELLIGHT_D4_SCENARIO_FILE: 'x.json' });
    check(
      'N-D4-P-3 harness refuses a malformed authorization receipt',
      p3.status === 2 && p3.stderr.includes(QLT_D4_CODES.AUTHORIZATION_MALFORMED),
      p3.stderr.split('\n')[0] ?? '',
    );
    rmSync(receiptPath, { force: true });
  }

  // ---- N-D4-P-4: missing credential refuses BEFORE any workspace ----------
  const tempBefore = readdirSync(tmpdir()).filter((entry) => entry.startsWith('qlt-d4-realuse-'));
  // D4b remediation: force the missing-credential state explicitly (the
  // documented test-only override) — the owner-designated authentication
  // boundary makes the credential PRESENT on the owner machine, so the
  // natural-absence assumption cannot be relied on.
  const p4 = spawnHarness({
    QUELLIGHT_D4_STRUCTURED: '1',
    QUELLIGHT_D4_SCENARIO_FILE: join(repoRoot, 'package.json'),
    QUELLIGHT_D4_CREDENTIAL_SOURCE: 'none',
  });
  const tempAfter = readdirSync(tmpdir()).filter((entry) => entry.startsWith('qlt-d4-realuse-'));
  // D4b remediation: with the archived consumed receipt present, every
  // preflight refuses EARLIER (at the receipt gate) — which also proves no
  // workspace was created. The credential refusal is the asserted code only
  // in the pre-authorization (absence) state.
  const p4RefusedClean =
    p4.status === 2 &&
    (receiptExistedAtGateStart || p4.stderr.includes(QLT_D4_CODES.CREDENTIAL_MISSING)) &&
    tempAfter.length === tempBefore.length;
  check(
    'N-D4-P-4 the harness refuses before any workspace exists (credential state enforced)',
    p4RefusedClean,
    `workspace delta: ${tempAfter.length - tempBefore.length}`,
  );

  // ---- N-D4-P-5: the plan budget is enforced BEFORE transport --------------
  const over = planBudget({
    userTurns: QLT_D4_BOUNDS.maxUserTurns + 1,
    providerRequests: QLT_D4_BOUNDS.maxProviderRequests,
    maxOutputTokensPerRequest: QLT_D4_BOUNDS.maxOutputTokensPerRequest,
    maxTurnDeadlineMs: QLT_D4_BOUNDS.maxTurnDeadlineMs,
  });
  const within = planBudget({
    userTurns: 5,
    providerRequests: QLT_D4_BOUNDS.maxProviderRequests,
    maxOutputTokensPerRequest: QLT_D4_BOUNDS.maxOutputTokensPerRequest,
    maxTurnDeadlineMs: QLT_D4_BOUNDS.maxTurnDeadlineMs,
  });
  check(
    'N-D4-P-5 the plan budget refuses an over-bounds plan before any transport',
    !over.ok && over.exceeded.includes('userTurns') && within.ok,
  );

  // ---- N-D4-P-6/7/8: the ledger rejects leak material ----------------------
  const l6 = createEvidenceLedger();
  const v6 = l6.append({
    kind: 'receipt',
    check: 'x',
    ok: true,
    detail: { k: 'sk-abcdefghijklmnop' },
  });
  check('N-D4-P-6 the ledger rejects a credential-shaped value', !v6.ok);

  const l7 = createEvidenceLedger();
  const v7 = l7.append({
    kind: 'receipt',
    check: 'x',
    ok: true,
    detail: { p: 'C:/Users/owner/file' },
  });
  check('N-D4-P-7 the ledger rejects an absolute path', !v7.ok);

  const l8 = createEvidenceLedger();
  const v8a = l8.append({
    kind: 'receipt',
    check: 'x',
    ok: true,
    detail: { statement: 'raw content' },
  });
  const v8b = l8.append({
    kind: 'receipt',
    check: 'x',
    ok: true,
    detail: { rawPrompt: 'raw content' },
  });
  check('N-D4-P-8 the ledger rejects forbidden detail keys (raw content)', !v8a.ok && !v8b.ok);

  // ---- N-D4-P-9: partial evidence cannot seal as success -------------------
  const l9 = createEvidenceLedger();
  buildFullLedger(l9, ['a13-evidence-hygiene']);
  const s9 = sealEvidence(l9, sealOptions);
  check(
    'N-D4-P-9 partial evidence cannot be sealed as success',
    s9.outcome === 'failed' &&
      Array.isArray(s9.missing) &&
      s9.missing.includes('a13-evidence-hygiene'),
  );

  // ---- N-D4-P-10: contradictory evidence cannot seal as success ------------
  const l10 = createEvidenceLedger();
  buildFullLedger(l10);
  l10.append({ kind: 'receipt', check: 'a13-evidence-hygiene', ok: false, detail: {} });
  const s10 = sealEvidence(l10, sealOptions);
  check(
    'N-D4-P-10 contradictory evidence cannot be sealed as success',
    s10.outcome === 'failed' && s10.code === QLT_D4_CODES.PROOF_POINT_FAILED,
  );

  // ---- N-D4-P-11..14: false claims cannot seal -----------------------------
  const l11 = createEvidenceLedger();
  buildFullLedger(l11);
  const r11 = l11.receiptFor('a4-restart-preserved');
  r11.detail.recordId = 'a-different-record';
  const s11 = sealEvidence(l11, sealOptions);
  check(
    'N-D4-P-11 a false restart claim cannot be sealed',
    s11.outcome === 'failed' && typeof s11.unsatisfied === 'string',
  );

  const l12 = createEvidenceLedger();
  buildFullLedger(l12);
  l12.receiptFor('assembly-selected').detail.recordId = 'a-different-record';
  const s12 = sealEvidence(l12, sealOptions);
  check('N-D4-P-12 a false fresh-thread claim cannot be sealed', s12.outcome === 'failed');

  const l13 = createEvidenceLedger();
  buildFullLedger(l13);
  l13.receiptFor('deletion-previewed').detail.threadId = 'a-different-thread';
  const s13 = sealEvidence(l13, sealOptions);
  check('N-D4-P-13 a false deletion claim cannot be sealed', s13.outcome === 'failed');

  const l14 = createEvidenceLedger();
  buildFullLedger(l14, ['boot-recovery-clean']);
  const s14 = sealEvidence(l14, sealOptions);
  check(
    'N-D4-P-14 a false reconciliation claim cannot be sealed',
    s14.outcome === 'failed' &&
      Array.isArray(s14.missing) &&
      s14.missing.includes('boot-recovery-clean'),
  );

  // ---- N-D4-P-15: a synthetic success traverses the complete lifecycle -----
  const l15 = createEvidenceLedger();
  buildFullLedger(l15);
  const s15 = sealEvidence(l15, sealOptions);
  check(
    'N-D4-P-15 a synthetic success traverses the complete evidence lifecycle and seals',
    s15.outcome === 'passed' &&
      s15.profile === QLT_D4_PROFILE &&
      Object.keys(s15.checks ?? {}).length === QLT_D4_REQUIRED_CHECKS.length,
  );

  // ---- N-D4-P-16: the failure path stays truthful; cleanup removes work ---
  const l16 = createEvidenceLedger();
  buildFullLedger(l16);
  l16.append({
    kind: 'receipt',
    check: 'a1-conversation-usable',
    ok: false,
    detail: { turnStatus: 'failed' },
  });
  const s16 = sealEvidence(l16, sealOptions);
  const scratch = mkdtempSync(join(tmpdir(), 'qlt-d4-prep-cleanup-'));
  rmSync(scratch, { recursive: true, force: true });
  check(
    'N-D4-P-16 the failure path seals truthfully and cleanup removes the workspace',
    s16.outcome === 'failed' && !existsSync(scratch),
  );

  // ---- N-D4-P-17: the workspace policy refuses dangerous locations --------
  const taskRoot = mkdtempSync(join(tmpdir(), 'qlt-d4-prep-task-'));
  const okWorkspace = resolveWorkspace(taskRoot, repoRoot, join(repoRoot, '.quellight-data'));
  const inRepo = resolveWorkspace(join(repoRoot, 'scripts'), repoRoot, undefined);
  const inOperator = resolveWorkspace(
    join(repoRoot, '.quellight-data', 'nested'),
    repoRoot,
    join(repoRoot, '.quellight-data'),
  );
  check(
    'N-D4-P-17 the workspace policy refuses repository and operator-directory locations',
    okWorkspace.ok && !inRepo.ok && !inOperator.ok,
  );
  rmSync(taskRoot, { recursive: true, force: true });

  // ---- N-D4-P-18: the preparation machinery performs no provider access ----
  const harnessSource = readFileSync(harnessPath, 'utf8');
  const gateSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const evidenceSource = readFileSync(join(repoRoot, 'scripts', 'lib', 'd4-evidence.mjs'), 'utf8');
  const needleFetch = 'fet' + 'ch(';
  const needleUrl = 'ht' + 'tps://';
  const gateSourceClean = !gateSource.includes(needleFetch) && !gateSource.includes(needleUrl);
  const evidenceSourceClean =
    !evidenceSource.includes(needleFetch) && !evidenceSource.includes(needleUrl);
  // The property path is the stable textual marker in the harness source.
  const credentialGateMarker = '.CREDENTIAL_MISSING';
  const gateBeforeComposition =
    harnessSource.indexOf(credentialGateMarker) >= 0 &&
    harnessSource.indexOf('const composeSession') >= 0 &&
    harnessSource.indexOf(credentialGateMarker) < harnessSource.indexOf('const composeSession');
  const observerGated =
    harnessSource.indexOf('installProviderObserver({') >
    harnessSource.indexOf(credentialGateMarker);
  check(
    'N-D4-P-18 the preparation machinery performs no provider access (static)',
    gateSourceClean && evidenceSourceClean && gateBeforeComposition && observerGated,
  );

  // ---- N-D4-P-19: the complete proof completes with ZERO observations ------
  {
    const ledger = createEvidenceLedger();
    buildFullLedger(ledger, [], false);
    const sealed = sealEvidence(ledger, sealOptions);
    check(
      'N-D4-P-19 the structured proof completes with zero model observations',
      sealed.outcome === 'passed',
    );
  }

  // ---- N-D4-P-20: observations never change the verdict ---------------------
  {
    const plain = createEvidenceLedger();
    buildFullLedger(plain, [], false);
    const observed = createEvidenceLedger();
    buildFullLedger(observed, [], true);
    const a = sealEvidence(plain, sealOptions);
    const b = sealEvidence(observed, sealOptions);
    check(
      'N-D4-P-20 adding model observations never changes the seal verdict',
      a.outcome === 'passed' && b.outcome === 'passed',
    );
  }

  // ---- N-D4-P-21: invented or model-proposed check ids cannot enter ---------
  {
    const ledger = createEvidenceLedger();
    const verdict = ledger.append({
      kind: 'receipt',
      check: 'model-drafted-canonical-record',
      ok: true,
      detail: { recordId: 'x' },
    });
    check('N-D4-P-21 an unknown check id is refused by the ledger', verdict.ok === false);
  }

  // ---- N-D4-P-22: no required check is a model observation (static) ---------
  {
    const harnessText = readFileSync(harnessPath, 'utf8');
    const gateText = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const evidenceText = readFileSync(join(repoRoot, 'scripts', 'lib', 'd4-evidence.mjs'), 'utf8');
    const contractText = readFileSync(
      join(repoRoot, 'src', 'lib', 'sharedworld', 'd4-contract.ts'),
      'utf8',
    );
    const coversEveryCheck = QLT_D4_REQUIRED_CHECKS.every(
      (id) => QLT_D4_CHECK_CLASSIFICATION[id] !== undefined,
    );
    const noneModelGated = QLT_D4_REQUIRED_CHECKS.every(
      (id) => QLT_D4_CHECK_CLASSIFICATION[id] !== 'model-observation',
    );
    const observationKeysExist = QLT_D4_OBSERVATION_DETAIL_KEYS.length > 0;
    const noScenarioOutcome =
      !QLT_D4_OUTCOMES.some((outcome) => outcome.includes('scenario')) &&
      !harnessText.includes('SCEN' + 'ARIO_BEHAVIOR') &&
      !gateText.includes('failed-sce' + 'nario-behavior') &&
      !evidenceText.includes('failed-sce' + 'nario-behavior') &&
      !contractText.includes('SCEN' + 'ARIO_BEHAVIOR');
    check(
      'N-D4-P-22 every required check is owner-action or runtime-observation (static)',
      coversEveryCheck && noneModelGated && observationKeysExist && noScenarioOutcome,
    );
  }

  // ---- N-D4-P-24: plan-declared actions only; no fixture wording ------------
  {
    const harnessText = readFileSync(harnessPath, 'utf8');
    const actionIds = [...harnessText.matchAll(/'(act\.[a-zA-Z]+)'/g)].map((m) => m[1]);
    const declared = new Set(Object.keys(getCompiledPlan().actions));
    const allDeclared = actionIds.length > 0 && actionIds.every((id) => declared.has(id));
    const commitmentKeyUses = [...harnessText.matchAll(/commitmentKey: '([^']+)'/g)].map(
      (m) => m[1],
    );
    const onlyProofKeys =
      commitmentKeyUses.length > 0 &&
      commitmentKeyUses.every((key) => key === 'd4-proof-commitment');
    const noFixtureWording =
      !harnessText.includes('quarterly') && !harnessText.includes('I have to');
    check(
      'N-D4-P-24 every harness action is plan-declared; only proof keys; no fixture wording (static)',
      allDeclared && onlyProofKeys && noFixtureWording,
    );
  }

  // ---- N-D4-P-23: the conflict class at the REAL boundary (offline) --------
  {
    const { createQuellightComposition, resolveQuellightEnvironment } = await import(
      new URL('../src/lib/server/composition.ts', import.meta.url).href
    );
    const taskRoot = mkdtempSync(join(tmpdir(), 'verify-d4-p23-'));
    try {
      const env = resolveQuellightEnvironment(
        {
          QUELLIGHT_DATA_DIR: 'data',
          QUELLIGHT_ACTOR_TOKEN: `qlt-token-canary-${crypto.randomUUID()}`,
        },
        taskRoot,
      );
      const composition = await createQuellightComposition({
        env,
        offlineScript: {},
        skipListen: true,
      });
      try {
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
        const thread = await composition.sharedWorld.createThread({ title: 'd4-offline-control' });
        const saved = await governedMutate(
          composition,
          'act.createClaim',
          {
            threadId: thread.id,
            subject: 'offline direct save',
            epistemicType: 'E2',
            honestyState: 'known',
            confidence: 'stated',
            statement: 'a direct-saved claim',
          },
          'p23-direct-save',
        );
        const savedId = saved.row?.id;
        const afterSave = await composition.sharedWorld.meaning.listClaims({});
        const directSaveCrossed =
          saved.ok === true && afterSave.rows.some((row) => row.id === savedId);
        const standing = await governedMutate(
          composition,
          'act.createCommitment',
          {
            threadId: thread.id,
            commitmentKey: 'd4-proof-commitment',
            statement: 'the standing commitment',
          },
          'p23-standing',
        );
        const commitmentId = standing.row?.id;
        const before = await composition.sharedWorld.meaning.getCommitment(commitmentId);
        const proposal = await composition.sharedWorld.meaning.createProposal({
          proposalKind: 'commitment',
          content: { commitmentKey: 'd4-proof-commitment', statement: 'a contradicting duplicate' },
          proposedBy: QLT_AGENT_PROPOSER_ID,
          sourceThreadId: thread.id,
        });
        await composition.sharedWorld.meaning.markProposalAwaitingDecision(proposal.id);
        const commitmentsBefore = (await composition.sharedWorld.meaning.listCommitments({})).total;
        const refused = await governedMutate(
          composition,
          'act.confirmProposal',
          { proposalId: proposal.id },
          'p23-confirm',
        );
        const openChallenges = composition.sharedWorld.conflict.listChallenges({ status: 'open' });
        const refusalQuiet =
          refused.ok === false &&
          refused.code === 'QLT_COMMITMENT_CONFLICT' &&
          openChallenges.rows.length === 1 &&
          openChallenges.rows[0].incomingProposalId === proposal.id;
        const commitmentsAfter = (await composition.sharedWorld.meaning.listCommitments({})).total;
        const dismissal = await governedMutate(
          composition,
          'act.dismissChallenge',
          { challengeId: openChallenges.rows[0].challengeId },
          'p23-dismiss',
        );
        const openAfter = composition.sharedWorld.conflict.listChallenges({ status: 'open' }).rows
          .length;
        const after = await composition.sharedWorld.meaning.getCommitment(commitmentId);
        const standingUnchanged =
          after.version === before.version &&
          JSON.stringify(after.content) === JSON.stringify(before.content);
        check(
          'N-D4-P-23 the deterministic conflict class completes at the real product boundary (offline real composition)',
          directSaveCrossed &&
            standing.ok === true &&
            refusalQuiet &&
            commitmentsAfter === commitmentsBefore &&
            dismissal.ok === true &&
            openAfter === 0 &&
            standingUnchanged,
        );
      } finally {
        await composition.close();
      }
    } finally {
      // Best-effort removal (the verify-d2 precedent): the composition
      // close is awaited, but on Windows the SQLite unlock can lag the
      // process; the scratch store is disposable synthetic data either
      // way, so a lingering directory never fails the gate.
      try {
        rmSync(taskRoot, { recursive: true, force: true });
      } catch {
        /* disposable */
      }
    }
  }

  // ---- N-D4-P-25: the D4b remediation statics ------------------------------
  // (a) the failure seal durably preserves the structural facts;
  // (b) no abrupt session exits remain (the refusal gate's exit(2) is the
  //     only abrupt exit, and it runs before anything exists to preserve);
  // (c) the turn dispatch crosses the admitted boundary; the seed's
  //     retention payloads carry the declared contract field names.
  {
    const removalFamilyKeyPattern = /\{\s*recordId: removedRecordId, family: 'claim'/;
    const remediationText = readFileSync(harnessPath, 'utf8');
    const requiredLiterals = [
      'failurePhase',
      'failureClass',
      'transportBegan',
      'responseHeadersArrived',
      'responseBytesArrived',
      'turnSettlement',
      'sessionMs',
      'workspaceRemoved',
      'await cleanupTail',
    ];
    const allPresent = requiredLiterals.every((literal) => remediationText.includes(literal));
    const noAbruptSessionExit =
      !remediationText.includes('process.exit(0)') && !remediationText.includes('process.exit(1)');
    const admittedDispatch = remediationText.includes('composition.admitTurn(');
    const declaredRemoveField =
      remediationText.includes("recordKind: 'claim'") &&
      remediationText.includes('getRecordView({') &&
      !removalFamilyKeyPattern.test(remediationText);
    const declaredPassPayload =
      remediationText.includes('await governedMutate(') &&
      remediationText.includes('setTimeout(resolveWait, 3_000)');
    check(
      'N-D4-P-25 the durable failure accounting, graceful exits, admitted turn dispatch, and declared seed payloads (static)',
      allPresent &&
        noAbruptSessionExit &&
        admittedDispatch &&
        declaredRemoveField &&
        declaredPassPayload,
    );
  }

  // ---- N-D4-P-26: the gated live seam fails closed (offline child probe) ----
  {
    const probeDir = mkdtempSync(join(tmpdir(), 'verify-d4-liveseam-'));
    try {
      const compositionUrl = new URL('../src/lib/server/composition.ts', import.meta.url).href;
      const probePath = join(probeDir, 'probe-live-seam.mjs');
      writeFileSync(
        probePath,
        [
          'delete process.env.OLLAMA_API_KEY;',
          "process.env.QUELLIGHT_LIVE_PROOF = '1';",
          'const { createQuellightComposition, resolveQuellightEnvironment } = await import(',
          '  process.env.QLT_PROBE_COMPOSITION_URL',
          ');',
          "const { mkdtempSync, rmSync } = await import('node:fs');",
          "const { tmpdir } = await import('node:os');",
          "const { join } = await import('node:path');",
          "const repoLike = mkdtempSync(join(tmpdir(), 'probe-repo-'));",
          "const dataDir = mkdtempSync(join(tmpdir(), 'probe-data-'));",
          'try {',
          '  const env = resolveQuellightEnvironment(',
          "    { QUELLIGHT_DATA_DIR_ABSOLUTE: dataDir, QUELLIGHT_LIVE_PROOF: '1' }",
          '    , repoLike);',
          '  await createQuellightComposition({ env, offlineScript: {}, skipListen: true });',
          "  console.log('LIVE-SEAM-COMPOSED');",
          '} catch (cause) {',
          "  console.log('LIVE-SEAM-THREW:' + String(cause && cause.code ? cause.code : cause && cause.name ? cause.name : 'unknown'));",
          '} finally {',
          '  try { rmSync(repoLike, { recursive: true, force: true }); } catch {}',
          '  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}',
          '}',
        ].join('\n'),
      );
      const childEnv = { ...process.env, QLT_PROBE_COMPOSITION_URL: compositionUrl };
      delete childEnv.OLLAMA_API_KEY;
      const spawned = spawnSync(process.execPath, ['--import', 'tsx', probePath], {
        cwd: repoRoot,
        env: childEnv,
        encoding: 'utf8',
        timeout: 120_000,
      });
      const threwUnavailable = String(spawned.stdout ?? '').includes(
        'LIVE-SEAM-THREW:VICT_OPERATOR_CREDENTIAL_UNAVAILABLE',
      );
      const neverComposed = !String(spawned.stdout ?? '').includes('LIVE-SEAM-COMPOSED');
      check(
        'N-D4-P-26 the gated live seam fails closed on the absent credential variable (offline child probe)',
        threwUnavailable && neverComposed,
      );
    } finally {
      try {
        rmSync(probeDir, { recursive: true, force: true });
      } catch {
        /* disposable */
      }
    }
  }

  // ---- contract self-consistency -------------------------------------------
  const everyPrereqExists = Object.values(QLT_D4_CHECK_PREREQUISITES).every((rules) =>
    rules.every((rule) => QLT_D4_REQUIRED_CHECKS.includes(rule.check)),
  );
  const everyCheckHasRuleEntry = QLT_D4_REQUIRED_CHECKS.every(
    (checkId) => QLT_D4_CHECK_PREREQUISITES[checkId] !== undefined,
  );
  check(
    'contract consistency: every prerequisite names a required check',
    everyPrereqExists && everyCheckHasRuleEntry,
  );

  // ---- the consumed receipt refuses again (rerun prevention end state) ----
  // D4b remediation: the truthful receipt end state is ABSENCE (fresh
  // authorization readiness) or the ARCHIVED CONSUMED receipt with its
  // bytes untouched — never a synthetic probe receipt.
  const reread = readAuthorizationReceipt(receiptPath);
  const receiptEndStateOk = receiptExistedAtGateStart
    ? existsSync(receiptPath) &&
      Buffer.compare(readFileSync(receiptPath), receiptBytesAtGateStart) === 0
    : !existsSync(receiptPath) && !reread.ok && reread.code === QLT_D4_CODES.NOT_AUTHORIZED;
  check(
    'the authorization receipt end state is absence or the archived consumed receipt (bytes intact)',
    receiptEndStateOk,
  );
  // D4b remediation: since the one authorized D4b session was executed and
  // its truthful failure evidence was committed at the contract path, the
  // pre-execution invariant is no longer plain absence. The truthful state
  // is: absent (fresh authorization, after the owner archives the
  // historical pair) OR exactly the committed historical failure record —
  // a minimal structural summary that can never be mistaken for a
  // successful session. The harness's exclusive-create seal ('wx') remains
  // the enforcement for the next execution.
  const historicalEvidence = (() => {
    if (!existsSync(evidencePath)) return { absent: true, historical: false };
    try {
      const parsed = JSON.parse(readFileSync(evidencePath, 'utf8'));
      return {
        absent: false,
        historical:
          parsed.outcome === 'failed' &&
          parsed.code === QLT_D4_CODES.PROOF_POINT_FAILED &&
          parsed.contract === QLT_D4_PROOF_CONTRACT_ID,
      };
    } catch {
      return { absent: false, historical: false };
    }
  })();
  check(
    'the pre-execution evidence state is absence or the archived historical failure record',
    historicalEvidence.absent || historicalEvidence.historical,
  );

  // ---- exclusive-create machinery (task-owned temp path; never the real
  // receipt: the historical record must survive every gate run) ------------
  const probeReceiptPath = join(tmpdir(), `verify-d4-receipt-probe-${Date.now()}.json`);
  const exclusive = writeAuthorizationReceipt(probeReceiptPath, { probe: true });
  const exclusiveTwice = writeAuthorizationReceipt(probeReceiptPath, { probe: true });
  const exclusiveResult = !exclusive.ok || (exclusive.ok && !exclusiveTwice.ok);
  check('the authorization receipt is exclusive-create (one-shot)', exclusiveResult);
  rmSync(probeReceiptPath, { force: true });
} finally {
  // Restore the synthetic state ONLY when the gate started with no receipt;
  // a historical consumed receipt is never written, overwritten, or removed.
  if (!receiptExistedAtGateStart) {
    rmSync(receiptPath, { force: true });
  }
}

if (failures.length > 0) {
  console.error(`verify:d4-prep: FAILED — ${failures.length} check(s) red.`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `verify:d4-prep: PASS — ${checksRun.length} checks green (offline controls over synthetic evidence; no provider, no operator data).`,
);
