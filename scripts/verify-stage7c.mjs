#!/usr/bin/env node
/**
 * Quellight Stage 07C — aggregate offline verification gate (N-C25;
 * `npm run verify:stage7c`).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md §4/§10.
 *
 * This aggregate composes the N-C1..N-C25 acceptance matrix of the Stage
 * 07C handoff (§14) by:
 *
 *   1. validating the N-C coverage manifest — every mapped constituent
 *      (script or suite) must exist; every N-C row N-C1..N-C25 must be
 *      present; a negative control proves the validator FAILS when a
 *      constituent is absent or a row is missing;
 *   2. executing the five focused phase gates (Q2–Q5 + Q6) — the
 *      existing Q2–Q5 gates plus the Q6 offline assertions;
 *   3. re-deriving the adopted release identity from the LOCKFILE and
 *      failing on any stale or mixed set (the exact stable
 *      `vict-release-set@1/0.3.0` identity must hold);
 *   4. proving the aggregate never executes the large complete suites
 *      twice (the expensive suites run once, inside verify:quellight)
 *      and never executes the LIVE gate (N-C24 runs separately, last,
 *      exactly once, by explicit operator invocation).
 *
 * The complete suites (`test:node`, `test:ui`, the production build, the
 * three real-browser checks) run exactly once in the authoritative
 * sequence — inside `verify:quellight` — and are NOT re-executed here.
 * The live gate is NEVER invoked by this aggregate (freeze §4).
 */
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  checkReleaseSetCompatibility,
  CONTENT_ID,
  EXPECTED_VERSION,
  RELEASE_IDENTITY,
} from './lib/release-set.mjs';
import {
  QLT_Q6_LIVE_GATE_SCRIPT,
  QLT_Q6_PROVIDER_IDENTITY,
} from '../src/lib/sharedworld/q6-contract.ts';

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);

// ---------------------------------------------------------------------------
// 1. The N-C coverage manifest (freeze §10; N-C1..N-C25)
// ---------------------------------------------------------------------------
const N_C_MANIFEST = [
  {
    id: 'N-C1',
    title: 'credential canaries absent everywhere',
    paths: ['test/composition.test.ts'],
  },
  { id: 'N-C2', title: 'registry-only clean install', paths: ['scripts/verify-consumer.mjs'] },
  {
    id: 'N-C3',
    title: 'baseline F-8 fail-closed shape preserved',
    paths: ['test/governed-mutation.test.ts'],
  },
  {
    id: 'N-C4',
    title: 'invalid/oversized/special-key input fences',
    paths: ['test/governed-mutation.test.ts', 'test/meaning-foundation.test.ts'],
  },
  { id: 'N-C5', title: 'schema mismatch fails closed', paths: ['test/governed-mutation.test.ts'] },
  {
    id: 'N-C6',
    title: 'tampered plan / stale revision refusal',
    paths: ['test/governed-mutation.test.ts'],
  },
  {
    id: 'N-C7',
    title: 'unregistered capability kind refused',
    paths: ['test/governed-mutation.test.ts'],
  },
  {
    id: 'N-C8',
    title: 'agent self-confirmation structurally denied',
    paths: ['test/ceremony-authority.test.ts', 'test/q6-ceremony-authority.test.ts'],
  },
  {
    id: 'N-C9',
    title: 'confirmation without user action creates nothing',
    paths: ['test/ceremony-authority.test.ts', 'scripts/verify-q3.mjs'],
  },
  {
    id: 'N-C10',
    title: 'unconfirmed-context exclusion',
    paths: ['test/context-assembly.test.ts', 'scripts/verify-q4.mjs'],
  },
  {
    id: 'N-C11',
    title: 'superseded-context exclusion',
    paths: ['test/context-assembly.test.ts', 'scripts/verify-q4.mjs'],
  },
  {
    id: 'N-C12',
    title: 'confirmation replay never duplicates',
    paths: ['test/ceremony-authority.test.ts', 'scripts/verify-q3.mjs'],
  },
  {
    id: 'N-C13',
    title: 'crash before confirmation stays truthful',
    paths: ['test/ceremony-authority.test.ts', 'test/restart.test.ts'],
  },
  {
    id: 'N-C14',
    title: 'crash during confirm commit is all-or-nothing',
    paths: ['test/ceremony-authority.test.ts'],
  },
  {
    id: 'N-C15',
    title: 'crash after commit replays truthfully',
    paths: ['test/ceremony-authority.test.ts', 'test/reconnect.test.ts'],
  },
  {
    id: 'N-C16',
    title: 'stale proposal refusal (version-eligibility)',
    paths: ['scripts/verify-q3.mjs', 'scripts/browser-ceremony-check.mjs'],
  },
  {
    id: 'N-C17',
    title: 'correction conflict: one successor',
    paths: ['scripts/verify-q2.mjs', 'scripts/verify-q5.mjs'],
  },
  {
    id: 'N-C18',
    title: 'duplicate correction replay converges',
    paths: ['scripts/verify-q2.mjs', 'scripts/verify-q5.mjs'],
  },
  {
    id: 'N-C19',
    title: 'transcript-only recovery from C1',
    paths: [
      'test/context-injection.test.ts',
      'scripts/verify-q4.mjs',
      'test/q6-fresh-thread-continuity.test.ts',
    ],
  },
  {
    id: 'N-C20',
    title: 'direct-route database-write prohibited',
    paths: ['scripts/verify-q2.mjs', 'scripts/verify-q5.mjs', 'scripts/verify-governance.mjs'],
  },
  {
    id: 'N-C21',
    title: 'identity mismatch refused; server-derived identity',
    paths: ['test/memory-authority.test.ts', 'test/governed-mutation.test.ts'],
  },
  {
    id: 'N-C22',
    title: 'empty-registry/local-checkout negative control',
    paths: ['scripts/verify-consumer.mjs'],
  },
  {
    id: 'N-C23',
    title: 'responsive browser and accessibility proof',
    paths: ['scripts/browser-check.mjs', 'scripts/browser-ceremony-check.mjs'],
  },
  {
    id: 'N-C24',
    title: 'bounded live-provider ceremony proof (LIVE; separate, last, exactly once)',
    paths: [QLT_Q6_LIVE_GATE_SCRIPT],
  },
  { id: 'N-C25', title: 'this aggregate gate', paths: ['scripts/verify-stage7c.mjs'] },
];

const REQUIRED_ROWS = Array.from({ length: 25 }, (_, index) => `N-C${index + 1}`);

/**
 * Validate a manifest: every N-C1..N-C25 row present (once), every
 * constituent path exists under `root`. Returns the problem list.
 */
function validateManifest(manifest, root) {
  const problems = [];
  const seen = new Set();
  for (const row of manifest) {
    if (seen.has(row.id)) {
      problems.push(`duplicate manifest row ${row.id}`);
    }
    seen.add(row.id);
    if (!Array.isArray(row.paths) || row.paths.length === 0) {
      problems.push(`${row.id}: no constituent mapped`);
      continue;
    }
    for (const constituentPath of row.paths) {
      try {
        statSync(join(root, constituentPath));
      } catch {
        problems.push(`${row.id}: constituent missing: ${constituentPath}`);
      }
    }
  }
  for (const required of REQUIRED_ROWS) {
    if (!seen.has(required)) {
      problems.push(`manifest row missing: ${required}`);
    }
  }
  return problems;
}

console.log('verify:stage7c — Stage 07C aggregate offline gate (N-C25)');

console.log('\n[1] MANIFEST — N-C1..N-C25 coverage');
{
  const problems = validateManifest(N_C_MANIFEST, process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) {
      fail(`manifest: ${problem}`);
    }
  } else {
    note(`manifest: all ${N_C_MANIFEST.length} rows present with existing constituents`);
  }
  // Negative control 1: a manifest MISSING a constituent must fail.
  const tamperedMissing = N_C_MANIFEST.map((row) => ({
    ...row,
    paths: row.id === 'N-C9' ? ['scripts/definitely-missing-gate.mjs'] : row.paths,
  }));
  const missingProblems = validateManifest(tamperedMissing, process.cwd());
  if (missingProblems.length === 0) {
    fail('negative control: a manifest with an ABSENT constituent did not fail');
  } else {
    note(`negative control: absent constituent -> ${missingProblems.length} problem(s) (held)`);
  }
  // Negative control 2: a manifest MISSING a row must fail.
  const tamperedRow = N_C_MANIFEST.filter((row) => row.id !== 'N-C14');
  const rowProblems = validateManifest(tamperedRow, process.cwd());
  if (!rowProblems.some((problem) => problem.includes('N-C14'))) {
    fail('negative control: a manifest with a MISSING ROW did not fail');
  } else {
    note('negative control: missing row N-C14 -> validator failed (held)');
  }
}

// ---------------------------------------------------------------------------
// 2. RELEASE IDENTITY — the exact stable set, re-derived from the lockfile
// ---------------------------------------------------------------------------
console.log('\n[2] RELEASE IDENTITY — stale/mixed set detection from the lockfile');
{
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const declared = new Map();
  for (const [name, specifier] of Object.entries({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  })) {
    if (name.startsWith('@victframework/')) {
      declared.set(name, specifier);
    }
  }
  const resolved = new Map();
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const name = typeof key === 'string' ? key.replace(/^node_modules\//, '') : '';
    if (name.startsWith('@victframework/') && typeof entry?.resolved === 'string') {
      // The lockfile records the resolved version directly; the resolved
      // URL must still point at the public registry (checked below).
      const version = entry?.version;
      if (typeof version === 'string' && version.length > 0) {
        resolved.set(name, version);
      }
    }
  }
  const findings = checkReleaseSetCompatibility({ declared, resolved });
  if (findings.length > 0) {
    for (const finding of findings) {
      fail(`release identity: ${finding}`);
    }
  } else {
    note(
      `release identity: ${RELEASE_IDENTITY} (content ${CONTENT_ID.slice(0, 16)}…) holds in the lockfile`,
    );
  }
  if (EXPECTED_VERSION !== '0.3.0' || !CONTENT_ID.startsWith('v1_5f3a074a')) {
    fail('release identity: the recorded constants are not the stable 0.3.0 set');
  } else {
    note('recorded constants match the stable 0.3.0 identity');
  }
  // Registry-only provenance: every resolved member must point at the
  // public registry (a local/file/git resolution would be a bypass).
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const name = typeof key === 'string' ? key.replace(/^node_modules\//, '') : '';
    if (name.startsWith('@victframework/')) {
      const resolved = entry?.resolved ?? '';
      if (!resolved.startsWith('https://registry.npmjs.org/')) {
        fail(`release identity: ${name} resolves outside the public registry (${resolved})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. EXECUTE the focused phase gates (Q2–Q5 + Q6)
// ---------------------------------------------------------------------------
const GATES = ['verify-q2.mjs', 'verify-q3.mjs', 'verify-q4.mjs', 'verify-q5.mjs', 'verify-q6.mjs'];
const aggregateOwnSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
{
  // The no-duplication property: this aggregate executes ONLY the focused
  // gates — never the large complete suites and never the live gate. The
  // tokens are constructed dynamically so this self-scan cannot match its
  // own definition.
  const forbidden = [
    'test' + ':node',
    'test' + ':ui',
    "runNpm('build'",
    'browser-check' + '.mjs',
    'browser-stop-check' + '.mjs',
    'browser-ceremony-check' + '.mjs',
    'verify-q6-live' + '.mjs',
    'verify-quell' + 'ight',
  ];
  for (const forbiddenToken of forbidden) {
    if (aggregateOwnSource.includes(`'${forbiddenToken}'`)) {
      fail(
        `the aggregate must not execute "${forbiddenToken}" (it runs once inside verify:quellight)`,
      );
    }
  }
  if (failures.length === 0) {
    note('aggregate execution set: the five focused gates only (no large suite is run twice)');
  }
}
console.log('\n[3] FOCUSED GATES — Q2, Q3, Q4, Q5, Q6');
for (const gate of GATES) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', join('scripts', gate)], {
    encoding: 'utf8',
    timeout: 900_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`${gate}: FAILED (exit ${result.status})`);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    console.error(output.split('\n').slice(-25).join('\n'));
  } else {
    note(`${gate}: PASS`);
  }
}

// ---------------------------------------------------------------------------
// 4. The live gate is NOT part of this aggregate (N-C24 is separate/last)
// ---------------------------------------------------------------------------
console.log('\n[4] LIVE-SEPARATION — N-C24 never runs here');
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.scripts?.['verify:q6:live'] !== undefined) {
    try {
      statSync(join(process.cwd(), QLT_Q6_LIVE_GATE_SCRIPT));
      note(
        'N-C24: the bounded live ceremony is wired separately (`npm run verify:q6:live`); it is NOT executed by this aggregate',
      );
    } catch {
      fail(`N-C24: package.json declares verify:q6:live but ${QLT_Q6_LIVE_GATE_SCRIPT} is missing`);
    }
  } else {
    note('N-C24: the live ceremony is not yet wired (added by the bounded-live-proof commit)');
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:stage7c: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log(
  'verify:stage7c: PASS — N-C1..N-C25 coverage manifest validated, release identity stable, all focused phase gates green.',
);
process.exit(0);
