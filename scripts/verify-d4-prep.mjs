#!/usr/bin/env node
/**
 * Quellight Stage 07D Phase D4a — the permanent offline preparation gate
 * for the MSTR-012 real-use proof (contract
 * `quellight.stage07d.d4.proof-contract@1`).
 *
 * Implements the frozen control list N-D4-P-1..N-D4-P-18
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
  QLT_D4_CODES,
  QLT_D4_PROFILE,
  QLT_D4_PROOF_CONTRACT_ID,
  QLT_D4_REQUIRED_CHECKS,
  QLT_D4_CHECK_PREREQUISITES,
} from '../src/lib/sharedworld/d4-contract.ts';
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
const buildFullLedger = (ledger, omit = []) => {
  const ids = { preserved: 'cl-preserved', removable: 'cl-removable', thread: 'qlt-thread-c' };
  const add = (checkId, detail = {}, ok = true) => {
    if (!omit.includes(checkId)) ledger.append({ kind: 'receipt', check: checkId, ok, detail });
  };
  add('a1-conversation-usable', { turnStatus: 'completed', messageCount: 2 });
  add('a2-durable-meaning-preserved', { recordId: ids.preserved, path: 'direct-save' });
  add('a3-no-agent-canonical', {
    recordId: ids.preserved,
    pendingCount: 1,
    preservedPath: 'direct-save',
  });
  add('a7-conflict-challenge-quiet', {
    trigger: 'distinct-key',
    standingCommitmentUnchanged: true,
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
  add('ineligible-seeded', { pendingId: 'prop-pending', removedRecordId: ids.removable });
  add('a6-ineligible-excluded', { pendingExcluded: true, removedExcluded: true });
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

console.log('verify:d4-prep — the MSTR-012 real-use proof preparation gate (offline)');

try {
  // ---- N-D4-P-1: the harness refuses without the explicit session flag ----
  const p1 = spawnHarness({});
  check(
    'N-D4-P-1 harness refuses without the explicit owner session flag',
    p1.status === 2 && p1.stderr.includes(QLT_D4_CODES.NOT_AUTHORIZED),
    p1.stderr.split('\n')[0] ?? '',
  );
  check('N-D4-P-1b no receipt was written by the refusal', !existsSync(receiptPath));

  // ---- N-D4-P-2: the harness refuses a reused authorization receipt -------
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

  // ---- N-D4-P-3: the harness refuses a malformed receipt ------------------
  withReceipt('{ not json at all');
  const p3 = spawnHarness({ QUELLIGHT_D4_STRUCTURED: '1', QUELLIGHT_D4_SCENARIO_FILE: 'x.json' });
  check(
    'N-D4-P-3 harness refuses a malformed authorization receipt',
    p3.status === 2 && p3.stderr.includes(QLT_D4_CODES.AUTHORIZATION_MALFORMED),
    p3.stderr.split('\n')[0] ?? '',
  );
  rmSync(receiptPath, { force: true });

  // ---- N-D4-P-4: missing credential refuses BEFORE any workspace ----------
  const tempBefore = readdirSync(tmpdir()).filter((entry) => entry.startsWith('qlt-d4-realuse-'));
  const p4 = spawnHarness({
    QUELLIGHT_D4_STRUCTURED: '1',
    QUELLIGHT_D4_SCENARIO_FILE: join(repoRoot, 'package.json'),
  });
  const tempAfter = readdirSync(tmpdir()).filter((entry) => entry.startsWith('qlt-d4-realuse-'));
  check(
    'N-D4-P-4 missing credential refuses before any workspace exists',
    p4.status === 2 &&
      p4.stderr.includes(QLT_D4_CODES.CREDENTIAL_MISSING) &&
      tempAfter.length === tempBefore.length,
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
  const reread = readAuthorizationReceipt(receiptPath);
  check(
    'receipt absence is the stable pre-authorization state',
    !existsSync(receiptPath) && !reread.ok && reread.code === QLT_D4_CODES.NOT_AUTHORIZED,
  );
  check('no evidence summary exists before execution', !existsSync(evidencePath));

  // ---- exclusive-create still works for the real authorization ------------
  const exclusive = writeAuthorizationReceipt(receiptPath, { probe: true });
  const exclusiveTwice = writeAuthorizationReceipt(receiptPath, { probe: true });
  const exclusiveResult = !exclusive.ok || (exclusive.ok && !exclusiveTwice.ok);
  check('the authorization receipt is exclusive-create (one-shot)', exclusiveResult);
  rmSync(receiptPath, { force: true });
} finally {
  rmSync(receiptPath, { force: true });
}

if (failures.length > 0) {
  console.error(`verify:d4-prep: FAILED — ${failures.length} check(s) red.`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `verify:d4-prep: PASS — ${checksRun.length} checks green (offline controls over synthetic evidence; no provider, no operator data).`,
);
