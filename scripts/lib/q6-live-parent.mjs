// @ts-nocheck
/**
 * The Q6 live-proof PARENT orchestration (script-only helper; amendment §6).
 *
 * The parent/worker lifecycle correction: the process that owns the
 * compositions must NOT also remove their SQLite workspace — on Windows the
 * removal raced the release of the store handles and failed the proof. The
 * split is now structural:
 *
 *   1. the PARENT holds the double refusal gate (activation gate +
 *      presence-only credential), allocates the ONE verified disposable
 *      root, and validates the EXTERNAL natural fixture (non-echoing);
 *   2. a CHILD WORKER process runs every composition, provider turn,
 *      restart, and ceremony operation, writes a machine-readable result
 *      record into the owned root, and EXITS;
 *   3. ONLY after the worker has exited does the parent read the result,
 *      re-verify the fixture content identity, run the byte-level
 *      credential scan (S-2: an incomplete scan is never credential-clean),
 *      and dispose the owned root (S-1: the only deletable path, exactly
 *      once; cleanup failure remains proof failure);
 *   4. the exit code is the TRUE proof outcome: 2 = refused, 1 = failed,
 *      0 = passed.
 *
 * `spawnFn` and `removeFn` are internal test seams (defaults: the real
 * synchronous spawn and the workspace helper's default removal); they never
 * change ownership, ordering, or fail-closed semantics.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createQ6LiveWorkspace } from './q6-live-workspace.mjs';
import {
  Q6FixtureBoundaryError,
  resolveNaturalFixture,
  reverifyFixtureIdentity,
} from './q6-fixture-boundary.mjs';
import {
  QLT_Q6_LIVE_BOUNDS,
  QLT_Q6_NATURAL_FIXTURE_VAR,
  QLT_Q6_PROVIDER_IDENTITY,
} from '../../src/lib/sharedworld/q6-contract.ts';

/** The worker result record written INSIDE the owned root (safe metadata
 * only: stable findings, counts, statuses, elapsed times). */
export const Q6_RESULT_FILE_NAME = 'q6-proof-result.json';

/** The non-echoing refusal reasons (gate). */
const GATE_REASONS = {
  activation: 'QUELLIGHT_LIVE_PROOF must be set to exactly 1 to run the live ceremony proof.',
  credential:
    'OLLAMA_API_KEY is not present in the process environment. Configure it in the operator environment (never in chat, source, or committed files), then run the gate exactly once.',
};

/**
 * Run the complete live-proof lifecycle in the PARENT role.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv;
 *   repoRoot?: string;
 *   spawnFn?: (file: string, args: string[], options: object) => { status: number | null };
 *   removeFn?: (directory: string, options?: object) => void;
 *   workerPath?: string;
 *   log?: (message: string) => void;
 * }} [options]
 * @returns {Promise<{
 *   exit: number;
 *   refused?: string;
 *   findings: string[];
 *   order: string[];
 *   fixture?: { byteLength: number; sha256: string };
 *   workerStatus?: number;
 *   result?: object;
 * }>}
 */
export const runQ6LiveProof = async (options = {}) => {
  const env = options.env ?? process.env;
  const repoRoot = options.repoRoot ?? process.cwd();
  const spawnFn =
    options.spawnFn ?? ((file, args, spawnOptions) => spawnSync(file, args, spawnOptions));
  const log = options.log ?? ((message) => console.log(message));
  const workerPath =
    options.workerPath ?? fileURLToPath(new URL('./q6-live-worker.mjs', import.meta.url));
  /** @type {string[]} */
  const order = [];
  /** @type {string[]} */
  const findings = [];

  // ---- the double refusal gate (fail closed; presence-only credential) ----
  if (env.QUELLIGHT_LIVE_PROOF !== QLT_Q6_PROVIDER_IDENTITY.activationGateValue) {
    return { exit: 2, refused: GATE_REASONS.activation, findings, order };
  }
  const credentialPresent = typeof env.OLLAMA_API_KEY === 'string' && env.OLLAMA_API_KEY.length > 0;
  if (!credentialPresent) {
    return { exit: 2, refused: GATE_REASONS.credential, findings, order };
  }
  const credential = env.OLLAMA_API_KEY;
  log('gate: QUELLIGHT_LIVE_PROOF=1 present; OLLAMA_API_KEY present (value never inspected)');

  // ---- the ONE owned disposable workspace (parent-allocated) ----
  const workspace = createQ6LiveWorkspace({ removeFn: options.removeFn });
  order.push('workspace-allocated');

  // ---- the external natural fixture (non-echoing boundary) ----
  let fixture;
  try {
    fixture = resolveNaturalFixture({
      fixturePath: env[QLT_Q6_NATURAL_FIXTURE_VAR],
      repoRoot,
    });
  } catch (error) {
    const refused =
      error instanceof Q6FixtureBoundaryError
        ? error.message
        : 'the external natural fixture could not be validated (details not echoed)';
    // Fail closed WITHOUT leaking the just-allocated root: dispose it even
    // on this early refusal (nothing was ever composed against it).
    const cleanup = await workspace.dispose();
    order.push(cleanup.removed ? 'workspace-disposed' : 'workspace-dispose-failed');
    return { exit: 2, refused, findings, order };
  }
  order.push('fixture-validated');
  log(
    `fixture boundary: external fixture accepted (${fixture.byteLength} bytes; sha256 recorded; content never read into evidence)`,
  );

  // ---- the worker: EVERY composition, turn, restart, and ceremony ----
  const childEnv = {
    ...env,
    QUELLIGHT_Q6_OWNED_ROOT: workspace.root,
    QUELLIGHT_Q6_FIXTURE_IDENTITY: JSON.stringify({
      byteLength: fixture.byteLength,
      sha256: fixture.sha256,
    }),
    QUELLIGHT_MAX_OUTPUT_TOKENS: String(QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerTurn),
    QUELLIGHT_TURN_DEADLINE_MS: String(QLT_Q6_LIVE_BOUNDS.turnDeadlineMs),
  };
  const worker = spawnFn(process.execPath, ['--import', 'tsx', workerPath], {
    cwd: repoRoot,
    env: childEnv,
    stdio: 'inherit',
  });
  const workerStatus = worker.status === null ? -1 : worker.status;
  order.push(`worker-exited(${workerStatus})`);

  // ---- ONLY NOW: result, fixture safety, credential scan, deletion ----
  let result;
  try {
    const parsed = JSON.parse(readFileSync(join(workspace.root, Q6_RESULT_FILE_NAME), 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('the worker result record is not an object');
    }
    result = parsed;
  } catch {
    findings.push('the worker result record is missing or unreadable — the proof fails closed');
  }
  order.push('result-read');
  if (result !== undefined) {
    for (const finding of Array.isArray(result.findings) ? result.findings : []) {
      findings.push(String(finding));
    }
  }

  try {
    reverifyFixtureIdentity({
      fixturePath: env[QLT_Q6_NATURAL_FIXTURE_VAR],
      repoRoot,
      expected: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
    });
    log(
      'fixture safety: the external fixture survived the proof byte-identical (never deleted, never modified)',
    );
  } catch {
    findings.push(
      'the external fixture vanished or changed during the proof — the content-safety check fails the proof (content not echoed)',
    );
  }
  order.push('fixture-reverified');

  try {
    const offending = workspace.scanForCredential(credential);
    for (const file of offending) {
      findings.push(`credential value found in ${file} — LEAK`);
    }
    if (offending.length === 0) {
      log(
        'credential scan: every persisted byte of the owned workspace scanned — credential absent',
      );
    }
  } catch {
    findings.push(
      'the final credential scan could not complete — an incomplete scan is never treated as credential-clean',
    );
  }
  order.push('credential-scanned');

  const { removed } = await workspace.dispose();
  order.push(removed ? 'workspace-disposed' : 'workspace-dispose-failed');
  if (removed) {
    log('cleanup: the owned disposable workspace was removed after the worker exited (verified)');
  } else {
    findings.push(
      'cleanup: the owned disposable workspace could NOT be removed — the proof fails closed',
    );
  }

  if (workerStatus !== 0) {
    findings.push(`the worker process exited abnormally (status ${workerStatus})`);
  }

  return {
    exit: findings.length > 0 ? 1 : 0,
    findings,
    order,
    fixture: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
    workerStatus,
    result,
  };
};
