#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q6 — the live-proof CHILD WORKER (amendment §6,
 * as repaired by the Execution-3 remediation contract).
 *
 * The parent (scripts/verify-q6-live.mjs → scripts/lib/q6-live-parent.mjs)
 * owns the gate, the ONE disposable root, the external-fixture boundary, and
 * — ONLY after this worker has exited — the credential scan, the fixture
 * content-safety re-check, and the workspace deletion. This worker owns
 * EVERY composition, provider turn, restart, and ceremony operation, writes
 * a machine-readable result record into the owned root, and exits. It has
 * NO deletion capability: it adopts the parent's root through
 * `adoptQ6LiveWorkspace` (a deletion-free API) and never removes anything.
 *
 * THE MATRIX (amendment §5; repaired by the Execution-3 remediation
 * contract) lives in `q6-live-matrix.mjs` — the real orchestration, run
 * here in LIVE mode. The SAME matrix runs in OFFLINE mode (deterministic
 * fixture model; no credential, no provider) for the permanent offline
 * worker-path proof: set QUELLIGHT_Q6_OFFLINE=1. Live mode is unchanged:
 * the credential is required, the composition is gated live, and the
 * provider identity is the ONE pinned profile.
 *
 * METADATA ONLY: findings carry stable codes and COUNTS — never proposal,
 * fixture, reply, path, provider, or credential-derived content (M-2:
 * arbitrary error-message slicing is removed; stable closed codes only:
 * QLT_Q6_LIVE_MATRIX_FAILED / QLT_Q6_REPLY_RESTORE_FAILED /
 * QLT_Q6_EVIDENCE_CHECK_FAILED).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adoptQ6LiveWorkspace } from './q6-live-workspace.mjs';
import { Q6_RESULT_FILE_NAME } from './q6-live-parent.mjs';
import { resolveNaturalFixture } from './q6-fixture-boundary.mjs';
import { runQ6LiveMatrix } from './q6-live-matrix.mjs';

const ownedRoot = process.env.QUELLIGHT_Q6_OWNED_ROOT;
if (typeof ownedRoot !== 'string' || ownedRoot.trim() === '') {
  console.error('WORKER REFUSED: the parent did not designate an owned workspace root.');
  process.exit(3);
}
const offline = process.env.QUELLIGHT_Q6_OFFLINE === '1';
const credential = process.env.OLLAMA_API_KEY;
if (!offline && (typeof credential !== 'string' || credential.length === 0)) {
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
    fixturePath: process.env.QUELLIGHT_Q6_NATURAL_FIXTURE_FILE,
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

// ---- run the REAL matrix and record the result ---------------------------
const result = await runQ6LiveMatrix({
  ownedRoot: ownedDataDir,
  mode: offline ? 'offline' : 'live',
  credential:
    typeof credential === 'string' && credential.length > 0
      ? credential
      : 'qlt-q6-offline-scan-canary',
  fixture,
  requireOwned: (directory, label) => workspace.requireOwned(directory, label),
  dataEnv: (directory) => workspace.dataEnv(directory),
  requireResolvedEnvironmentDataDir: (environment) =>
    workspace.requireResolvedEnvironmentDataDir(environment),
  requireCompositionDataDir: (composition, label) =>
    workspace.requireCompositionDataDir(composition, label),
});

// The result record goes INSIDE the owned root so the parent reads it
// before its post-exit scans and deletion. The worker itself deletes
// NOTHING.
try {
  writeFileSync(join(ownedDataDir, Q6_RESULT_FILE_NAME), JSON.stringify(result, null, 1), 'utf8');
} catch {
  console.error('WORKER: the result record could not be written — the parent will fail closed.');
  process.exit(4);
}
process.exit(0);
