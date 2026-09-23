#!/usr/bin/env node
/**
 * The supported normal-use LIVE startup launcher (Contract Amendment 2,
 * `quellight.stage07d.operator-live-use@1` — `npm run dev:live`).
 *
 * What it does:
 * - refuses (fail closed) if the proof-only seam QUELLIGHT_LIVE_PROOF is
 *   already set in this shell: the two live seams are separate and must
 *   never be combined;
 * - spawns the ordinary Vite dev server (the REAL committed vite.config)
 *   cross-platform-safe via node, passing every argument through, with
 *   `QUELLIGHT_OPERATOR_LIVE=1` added to the child environment;
 * - composes with the NORMAL operator store (no data-dir override is set)
 *   and the pinned live provider profile; the credential resolves through
 *   the protected operator configuration or, in memory only, the
 *   owner-designated authentication boundary — or the composition fails
 *   closed with a clear explanation;
 * - propagates the true child exit code.
 *
 * The launcher itself never touches, reads, or prints any credential.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const viteEntry = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

if (process.env.QUELLIGHT_LIVE_PROOF === '1') {
  console.error(
    'dev:live refuses to start: QUELLIGHT_LIVE_PROOF (the proof-only harness seam) is set in this shell; the two live seams are separate. Unset it and run again.',
  );
  process.exitCode = 2;
} else if (!process.env.QUELLIGHT_OPERATOR_LIVE) {
  const child = spawn(process.execPath, [viteEntry, 'dev', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, QUELLIGHT_OPERATOR_LIVE: '1' },
    cwd: repoRoot,
  });
  child.on('exit', (code, signal) => {
    if (signal !== null) process.exitCode = 1;
    else process.exitCode = code ?? 1;
  });
} else {
  // Already requested (e.g. a wrapped invocation): pass through untouched.
  const child = spawn(process.execPath, [viteEntry, 'dev', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  child.on('exit', (code, signal) => {
    if (signal !== null) process.exitCode = 1;
    else process.exitCode = code ?? 1;
  });
}
