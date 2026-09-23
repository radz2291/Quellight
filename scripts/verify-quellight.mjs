#!/usr/bin/env node
/**
 * Quellight aggregate offline verification gate (N-20).
 *
 * Runs the full deterministic offline ladder and fails on the first red:
 *
 *   1. format check            (npm run format:check)
 *   2. typecheck               (npm run typecheck)
 *   3. node-side tests         (composition, sharedworld, ceremony authority,
 *                                 restart, reconnect)
 *   (2f. development-start regression gate (D-11) with the Q5
 *        zero-warning gate; 2g. Q5 memory inspection and policy gate
 *        path is started through the real repository vite.config.ts and
 *        must serve the app and transform the released renderer)
 *   4. browser-side island tests (happy-dom)
 *   5. production build        (npm run build) with a BUILD-LOG scan:
 *      any warning that is not on the closed allowlist fails (N-17/N-18)
 *   6. credential/canary scan over the source tree and build output:
 *      high-entropy canary markers, credential-shaped strings, and local
 *      absolute paths must be absent from committed sources AND artifacts
 *   7. git hygiene             (git diff --check)
 *
 * Exit code 0 means the complete offline ladder is green.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  evaluateFrozenEvidence,
  frozenEvidenceFor,
  gitBlobIdOfWorkingFile,
} from './lib/frozen-evidence.mjs';

const step = (title) => console.log(`\n=== ${title} ===`);
const runNpm = (script, options = {}) => {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 900_000,
    ...options,
  });
  return result;
};

const failures = [];
const record = (label, result) => {
  const ok = result.status === 0;
  if (!ok) {
    failures.push(label);
    console.error(`${label}: FAILED (exit ${result.status})`);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    console.error(output.split('\n').slice(-40).join('\n'));
  } else {
    console.log(`${label}: PASS`);
  }
  return ok;
};

// 1. Format check.
step('1. format check');
record('format:check', runNpm('format:check'));

// 2–2b. Typecheck and the governed-mutation structural conformance gate.
step('2. typecheck');
record('typecheck', runNpm('typecheck'));

step('2b. governed-mutation structural conformance gate (Phase Q1)');
record(
  'verify:governance',
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-governance.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);

step('2c. Q2 durable Shared World schema conformance gate (Phase Q2)');
record(
  'verify:q2',
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-q2.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);

step('2d. Q3 governed ceremony conformance gate (Phase Q3)');
record(
  'verify:q3',
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-q3.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);
step('2e. Q4 deterministic context-assembly conformance gate (Phase Q4)');
record(
  'verify:q4',
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-q4.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);
step('2f. development-start regression gate (D-11 + Q5 zero-warning gate)');
record(
  'verify:dev-start',
  spawnSync(process.execPath, ['scripts/verify-dev-start.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);
step('2g. Q5 memory inspection and policy conformance gate (Phase Q5)');
record(
  'verify:q5',
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-q5.mjs'], {
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  }),
);
step('3. node-side tests (composition, sharedworld, restart, reconnect)');
record('test:node', runNpm('test:node'));

step('4. browser-side island tests (happy-dom)');
record('test:ui', runNpm('test:ui'));

// 5. Production build with closed-allowlist warning scan (N-17/N-18).
step('5. production build + build-log warning scan (N-17/N-18)');
const build = runNpm('build', { maxBuffer: 32 * 1024 * 1024 });
const buildLog = `${build.stdout ?? ''}\n${build.stderr ?? ''}`;
const allowlist = [
  /"node:sqlite" is imported by .*treating it as an external dependency\./,
  /Circular dependency: .*zod/,
  // The trailer line that belongs to the recognized circular-dependency
  // warning emitted through node's warning machinery.
  /\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)/,
];
const warningLines = buildLog.split('\n').filter((line) => /\bwarning\b/i.test(line));
const unrecognized = warningLines.filter(
  (line) => !allowlist.some((pattern) => pattern.test(line)),
);
if (build.status !== 0) {
  failures.push('build');
  console.error('build: FAILED (exit non-zero)');
  console.error(buildLog.split('\n').slice(-40).join('\n'));
} else {
  console.log('build: PASS');
}
if (unrecognized.length > 0) {
  failures.push('build-log warnings outside the closed allowlist');
  console.error('unrecognized build warnings:');
  for (const line of unrecognized) {
    console.error(`  ${line.trim()}`);
  }
} else {
  console.log(
    `build-log scan: PASS (${warningLines.length} warning line(s), all on the closed allowlist)`,
  );
}

// 6. REAL-BROWSER proof against the production build (N-17/N-19).
step('6. real-browser check (N-17 hydration smoke, N-19 responsive/keyboard/axe)');
record(
  'browser-check',
  spawnSync(process.execPath, ['scripts/browser-check.mjs'], {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  }),
);

// 6b. REAL-BROWSER Stop-control regression (F-1): the old-commit negative
// control in an isolated worktree + the full real-browser Stop flow.
step('6b. real-browser Stop regression (F-1): old-commit negative control + real click flow');
record(
  'browser-stop-check',
  spawnSync(process.execPath, ['scripts/browser-stop-check.mjs'], {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  }),
);

// 6c. TEST-1: the permanent real-browser ceremony recovery proof (Phase Q3).
step('6c. TEST-1 real-browser ceremony recovery (Phase Q3, offline deterministic fixture)');
record(
  'browser-ceremony-check',
  spawnSync(process.execPath, ['scripts/browser-ceremony-check.mjs'], {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  }),
);

// 7. Credential/canary/local-path scan over sources and artifacts.
step('7. credential/canary/local-path artifact scan');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svelte-kit',
  'dist',
  'build',
  'coverage',
  '.quellight-data',
  'data',
]);
const SKIP_FILES = new Set(['package-lock.json']);
const collectFiles = (root) => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (SKIP_DIRS.has(entry)) {
        continue;
      }
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else if (!SKIP_FILES.has(entry)) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files;
};
const sourceFiles = collectFiles(process.cwd());
const distDir = join(process.cwd(), 'build');
const artifactFiles = (() => {
  try {
    return collectFiles(distDir);
  } catch {
    return [];
  }
})();
const scanTargets = [
  ...sourceFiles.map((file) => ({ file, scope: 'source' })),
  ...artifactFiles.map((file) => ({ file, scope: 'artifact' })),
];
// Patterns that must NEVER appear in committed sources or build artifacts:
//  - the canary marker family used by the test suite (fresh high-entropy
//    values are generated per run; the MARKER is stable);
//  - credential-shaped assignments (a real credential next to its
//    variable name inside source bytes);
//  - local absolute paths of the implementation machines.
const canaryMarker = /sk-ollama-canary-|qlt-token-canary-/;
const credentialAssignment = /OLLAMA_API_KEY\s*[=:]\s*['"][^'"]{8,}['"]/;
// Non-global: boolean membership test (a /g regex would carry lastIndex
// across files and silently skip findings).
const localPathPresent = /[A-Z]:\\Users\\|\/home\/[a-z]+\//;
// Global twin of the SAME pattern: ordered match collection for the
// frozen-evidence disposition (collectMatches resets lastIndex per line).
const localPathScan = /[A-Z]:\\Users\\|\/home\/[a-z]+\//g;
// Frozen-evidence exception (owner decision D-07E-01; Stage 07E contract
// §5/§6.1): exactly ONE historical file is digest-pinned; the scanner still
// inspects it and reports the accepted matches explicitly. Any byte change,
// additional match, different file, different path, or new local-path
// disclosure fails. The canary and credential checks below are NOT weakened
// and apply to the frozen file like any other.
// The canary marker may legitimately appear where the canaries are
// DEFINED (test sources and this scanner); it must never appear in
// product source or in any build artifact.
const canaryAllowedIn = (file, scope) =>
  scope === 'source' && (file.includes(`${sep}test${sep}`) || file.includes(`${sep}scripts${sep}`));
let scanned = 0;
let frozenAccepted = 0;
for (const { file, scope } of scanTargets) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binary artifact (e.g. wasm) — not scannable as text
  }
  scanned += 1;
  const tag = `${scope}:${file}`;
  if (!canaryAllowedIn(file, scope) && canaryMarker.test(content)) {
    failures.push(`${tag}: canary marker present`);
  }
  if (credentialAssignment.test(content)) {
    failures.push(`${tag}: credential-shaped assignment present`);
  }
  const record = frozenEvidenceFor(relative(process.cwd(), file).split(sep).join('/'));
  if (record !== undefined) {
    // Digest-bound disposition: the frozen file must be byte-identical to
    // the pinned record; its local-path matches must be exactly the pinned
    // set. Without a verified exception the normal failure applies.
    const verdict = evaluateFrozenEvidence(
      record,
      content,
      gitBlobIdOfWorkingFile(file),
      content.split('\n'),
      localPathScan,
    );
    if (!verdict.accepted) {
      for (const problem of verdict.problems) {
        failures.push(`${tag}: frozen-evidence exception invalid — ${problem}`);
      }
    } else {
      frozenAccepted += 1;
      console.log(
        `artifact scan: frozen-evidence exception ACCEPTED ${verdict.matches.length} ` +
          `local-path match(es) in ${record.path} (${verdict.detail}; ` +
          `owner decision ${record.decision}; historical record byte-preserved)`,
      );
    }
  } else if (localPathPresent.test(content)) {
    failures.push(`${tag}: local absolute path present`);
  }
}
if (
  failures.length === 0 ||
  failures.every(
    (entry) =>
      !entry.includes('canary marker') &&
      !entry.includes('credential-shaped') &&
      !entry.includes('local absolute') &&
      !entry.includes('frozen-evidence exception invalid'),
  )
) {
  console.log(
    `artifact scan: PASS (${scanned} files scanned: sources + build output; ` +
      `${frozenAccepted} frozen-evidence exception(s) verified)`,
  );
}

// 8. Git hygiene.
step('8. git diff --check');
const gitCheck = spawnSync('git', ['diff', '--check'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
record('git diff --check', gitCheck);

console.log('');
if (failures.length > 0) {
  console.error(`verify:quellight: FAILED with ${failures.length} finding(s):`);
  for (const entry of failures) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
}
console.log('verify:quellight: PASS — full deterministic offline ladder green (N-20).');
