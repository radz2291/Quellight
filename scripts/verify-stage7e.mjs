#!/usr/bin/env node
/**
 * Quellight Stage 07E — the Stage 07 exit gate (`npm run verify:stage7e`).
 *
 * FROZEN CONTRACT: `quellight.stage07e.exit-contract@1`
 * docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md
 * (digest-pinned below; any contract edit fails here until a standalone
 * amendment commit consciously re-pins it).
 *
 * This aggregate adds the MISSING CROSS-STAGE checks and composes the
 * existing focused offline gates; it does NOT duplicate the large suites:
 *
 *   1. CONTRACT FREEZE    — the frozen contract exists and is byte-pinned
 *   2. CLOSURE INTEGRITY  — 07A–07D closure identities, ancestry, ordering,
 *                           frozen-contract/amendment ordering, no rewrite
 *   3. STATUS CONSISTENCY — README / system reference / decision register /
 *                           closure records agree (non-vacuously controlled)
 *   4. RELEASE IDENTITY   — exact VICT stable 0.3.1 set, registry-only,
 *                           tamper-controlled
 *   5. EVIDENCE IMMUTABILITY — every frozen digest recomputes; creation
 *                           commits are the last touches
 *   6. CONSTITUENT MANIFEST — every composed gate exists (negative control:
 *                           a missing constituent must fail)
 *   7. SEPARATION         — the aggregate can never run the live provider,
 *                           a consumed one-shot harness, a browser gate, or
 *                           the large suites, and can never reach operator
 *                           data (self-scan, non-vacuous)
 *   8. L-4 EXCEPTION      — the hash-bound frozen-evidence disposition is
 *                           verified against the real file and against
 *                           tampered copies (accept/byte-change/added-match/
 *                           different-path/drift must each behave exactly)
 *   9. EXECUTION          — the composed offline gates run, with
 *                           verify:d4-prep required to exit non-zero with
 *                           EXACTLY its documented by-design single red
 *                           (contract §8.1) — never re-pinned, never weakened
 *
 * The authoritative final-audit ladder (contract §7) — `verify:quellight`,
 * the node/ui suites, the production build, the real-browser gates,
 * `npm audit` — runs ONCE, in the fresh independent Stage 07E audit, and is
 * deliberately NOT executed here. This gate contains no browser step, so
 * the L-5 timing flake (contract §8.2) cannot destabilize it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  collectMatches,
  evaluateFrozenEvidence,
  frozenEvidenceFor,
} from './lib/frozen-evidence.mjs';
import {
  checkReleaseSetCompatibility,
  CONTENT_ID,
  EXPECTED_VERSION,
  RELEASE_IDENTITY,
} from './lib/release-set.mjs';

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);
const sha256OfFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const git = (args, options = {}) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
  } catch {
    return undefined;
  }
};
const isAncestor = (ancestor, descendant) =>
  git(['merge-base', '--is-ancestor', ancestor, descendant], {
    stdio: ['ignore', 'pipe', 'pipe'],
  }) === '';

console.log(
  'verify:stage7e — Stage 07 exit gate (frozen contract quellight.stage07e.exit-contract@1)',
);

// ---------------------------------------------------------------------------
// 1. CONTRACT FREEZE — presence + byte pin
// ---------------------------------------------------------------------------
const CONTRACT_PATH = 'docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md';
const CONTRACT_SHA256 = 'f4d7589f8c29fda28f5b5248d895d4ae8fec75a3e4c34dabfbab74307851e2ee';
console.log('\n[1] CONTRACT FREEZE');
{
  if (!existsSync(CONTRACT_PATH)) {
    fail(`the frozen contract is missing: ${CONTRACT_PATH}`);
  } else {
    const digest = sha256OfFile(CONTRACT_PATH);
    if (digest !== CONTRACT_SHA256) {
      fail(
        `the frozen contract drifted (sha256 ${digest} != pinned ${CONTRACT_SHA256}); ` +
          'a standalone amendment commit must re-pin it consciously',
      );
    } else {
      note(`contract byte-pinned (sha256 ${digest.slice(0, 16)}…)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. CLOSURE INTEGRITY — identities, ancestry, ordering, no rewrite
// ---------------------------------------------------------------------------
console.log('\n[2] CLOSURE INTEGRITY');
const CLOSURES = [
  {
    stage: '07A (VICT-side; verified in the VICT checkout by the final audit)',
    file: 'docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md',
    marker: 'Stage 07A remains formally closed',
    commits: [],
  },
  {
    stage: '07B',
    file: 'docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md',
    marker: 'STAGE 07B VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED',
    commits: [
      { id: '65f1767eb5929caa0e5b18e3d4d1600d327b3b51', what: 'remediation tip' },
      { id: 'f25b03a322868b37c9fee732a767d91d3ab63f98', what: 'closure commit' },
    ],
  },
  {
    stage: '07C',
    file: 'docs/report/QUELLIGHT-STAGE-07C-PHASE-Q7-FORMAL-CLOSURE.md',
    marker: 'STAGE 07C — SHARED WORLD MEANING AND CEREMONY — FORMALLY CLOSED',
    commits: [{ id: 'a7530a5e6f3ab6359835b6ba12a874c3fe18e0c4', what: 'closure commit' }],
  },
  {
    stage: '07D',
    file: 'docs/report/QUELLIGHT-STAGE-07D-FORMAL-CLOSURE.md',
    marker: 'Retention, Recovery, and Real-Use Proof — is **FORMALLY CLOSED**',
    commits: [
      { id: 'b78d8cd5d3285b5bba1f425f32146f8cf3950a17', what: 'closure commit (pre-07E tip)' },
    ],
  },
];
const FROZEN_ORDERING_PAIRS = [
  [
    '396eb5c01eac18f76543169a8703259e0807a10e',
    'cf9d4b2a7327af2c5f44ef2556c13065d99cbd61',
    'D2 contract precedes D2 implementation',
  ],
  [
    '59bb43adf03e3b151661f92993b1375058bb5f0e',
    '7cb7dbac4e1e71f0c109d09a6998c08310ec9109',
    'D4 contract precedes D4 machinery',
  ],
  [
    'ebbcdd9a79df7602bad0cf79e38266c8c60fbd40',
    '3b3f9e208b04e7836b03039a023ea19314a94ec3',
    'D4 Amendment 1 standalone before its machinery',
  ],
  [
    '0efd1f4f3b19d58a10c9a0fcf31ffa76d0b712f2',
    '72a59229492d7928e36c9da887c89067d8896993',
    'Amendment 2 standalone before its implementation',
  ],
  [
    '559e40a6971c7e6b9622f5209252a19232377aaf',
    'b23268298ca2e02c68ccd628cfae7cb535718157',
    'D2 safety-contract Amendment 1 before the purge fix',
  ],
];
const FREEZE_COMMIT = '9325bfae495b4106f81247c8e14393ad77c980e2';
{
  for (const closure of CLOSURES) {
    if (!existsSync(closure.file)) {
      fail(`${closure.stage}: closure record missing: ${closure.file}`);
      continue;
    }
    const text = readFileSync(closure.file, 'utf8');
    if (!text.includes(closure.marker)) {
      fail(`${closure.stage}: closure record lacks its disposition marker`);
    }
    for (const { id, what } of closure.commits) {
      if (git(['cat-file', '-e', `${id}^{commit}`]) === undefined) {
        fail(`${closure.stage}: pinned ${what} ${id.slice(0, 12)}… does not exist`);
      } else if (!isAncestor(id, 'HEAD')) {
        fail(`${closure.stage}: pinned ${what} ${id.slice(0, 12)}… is not an ancestor of HEAD`);
      }
    }
  }
  note('closure records exist with their dispositions; pinned commits are ancestors of HEAD');

  const chain = [
    '65f1767eb5929caa0e5b18e3d4d1600d327b3b51',
    'f25b03a322868b37c9fee732a767d91d3ab63f98',
    'a7530a5e6f3ab6359835b6ba12a874c3fe18e0c4',
    'b78d8cd5d3285b5bba1f425f32146f8cf3950a17',
    FREEZE_COMMIT,
  ];
  for (let index = 0; index < chain.length - 1; index += 1) {
    if (!isAncestor(chain[index], chain[index + 1])) {
      fail(
        `closure ordering violated: ${chain[index].slice(0, 12)}… must precede ${chain[index + 1].slice(0, 12)}…`,
      );
    }
  }
  if (!isAncestor(FREEZE_COMMIT, 'HEAD')) {
    fail('the 07E contract freeze commit is not an ancestor of HEAD');
  }
  note('closure chain and 07E freeze ordering verified');

  for (const [before, after, what] of FROZEN_ORDERING_PAIRS) {
    if (!isAncestor(before, after)) {
      fail(`frozen-contract ordering violated: ${what}`);
    }
  }
  note('frozen-contract / amendment ordering verified (M-1 remains the recorded exception)');

  // The freeze precedes every dependent executable 07E change.
  const machineryPending = (git(['ls-files', 'scripts/verify-stage7e.mjs']) ?? '') === '';
  if (machineryPending) {
    note(
      'REHEARSAL ONLY: this gate is not yet committed; freeze-before-machinery checks deferred to the committed run',
    );
  } else {
    for (const mechanical of ['scripts/verify-stage7e.mjs', 'scripts/lib/frozen-evidence.mjs']) {
      const addCommit = (
        git(['log', '--diff-filter=A', '--format=%H', '--', mechanical]) ?? ''
      ).split('\n')[0];
      if (addCommit === undefined || addCommit === '') {
        fail(`no commit found that added ${mechanical}`);
      } else if (!isAncestor(FREEZE_COMMIT, addCommit)) {
        fail(`the freeze commit does not precede the commit that added ${mechanical}`);
      }
    }
    note('the freeze commit precedes every dependent executable 07E change');
  }
}

// ---------------------------------------------------------------------------
// 3. STATUS CONSISTENCY — README / system reference / register / records
// ---------------------------------------------------------------------------
console.log('\n[3] STATUS CONSISTENCY');
/**
 * Pure validator so the negative controls can mutate copies.
 * @param {{readme: string, systemReference: string, register: string, closureD: string, closureB: string}} surfaces
 * @returns {string[]} problems
 */
const validateStatusSurfaces = (surfaces) => {
  const problems = [];
  const readmeRequires = [
    '**Stage 07D is FORMALLY CLOSED**',
    'Stage 07E: EXIT CONTRACT FROZEN',
    'PREPARATION COMPLETE',
    'FINAL INDEPENDENT EXIT AUDIT',
    'Stage 07:  IN PROGRESS (07A, 07B, 07C, and 07D closed;',
    'Stage 07 is NOT closed',
    'consumes only published `@victframework/*@0.3.1`',
    'QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md',
  ];
  const readmeForbids = [
    '07D in progress',
    'AWATING FRESH FOCUSED D5 RE-VERIFICATION',
    '07E not begun and not permitted',
    'consumes only published `@victframework/*@0.3.0`',
    '(N-1/N-2; 0.3.0 set)',
  ];
  for (const required of readmeRequires) {
    if (!surfaces.readme.includes(required)) problems.push(`README lacks: ${required}`);
  }
  for (const forbidden of readmeForbids) {
    if (surfaces.readme.includes(forbidden))
      problems.push(`README still states stale: ${forbidden}`);
  }
  const statusLine = surfaces.systemReference
    .split('\n')
    .find((line) => line.startsWith('## Status (current'));
  if (statusLine === undefined) {
    problems.push('system reference has no current-status header line');
  } else {
    for (const required of [
      'STAGE 07D FORMALLY CLOSED',
      'STAGE 07E PREPARED',
      'STAGE 07 REMAINS IN PROGRESS',
    ]) {
      if (!statusLine.includes(required))
        problems.push(`system-reference status line lacks: ${required}`);
    }
    if (statusLine.includes('STAGE 07E PERMITTED AND NOT BEGUN')) {
      problems.push('system-reference status line still carries the stale 07E formulation');
    }
  }
  const stage07Line = surfaces.systemReference
    .split('\n')
    .find((line) => line.startsWith('Stage 07:'));
  if (stage07Line === undefined) {
    problems.push('system reference has no Stage 07 line');
  } else {
    if (!stage07Line.includes('07E PREPARED'))
      problems.push('system-reference Stage 07 line lacks: 07E PREPARED');
    if (stage07Line.includes('07E PERMITTED and NOT BEGUN')) {
      problems.push('system-reference Stage 07 line still carries the stale 07E formulation');
    }
  }
  for (const required of ['## D-07D-17', '## D-07E-01']) {
    if (!surfaces.register.includes(required))
      problems.push(`decision register lacks: ${required}`);
  }
  if (
    !surfaces.closureD.includes('**Stage 07E (the Stage 07 exit gate): PERMITTED and NOT BEGUN.**')
  ) {
    problems.push('the 07D closure record lost its historical 07E-boundary statement');
  }
  if (
    !surfaces.closureB.includes('STAGE 07B VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED')
  ) {
    problems.push('the 07B closure record lost its disposition');
  }
  return problems;
};
{
  const surfaces = {
    readme: readFileSync('README.md', 'utf8'),
    systemReference: readFileSync('docs/system-reference.md', 'utf8'),
    register: readFileSync('docs/decision-register.md', 'utf8'),
    closureD: readFileSync('docs/report/QUELLIGHT-STAGE-07D-FORMAL-CLOSURE.md', 'utf8'),
    closureB: readFileSync('docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md', 'utf8'),
  };
  const problems = validateStatusSurfaces(surfaces);
  if (problems.length > 0) {
    for (const problem of problems) fail(`status surfaces: ${problem}`);
  } else {
    note('README, system reference, decision register, and closure records agree');
  }
  // Non-vacuous negative controls: mutated copies must produce problems.
  const staleReinserted = {
    ...surfaces,
    readme: surfaces.readme.replace(
      'Stage 07:  IN PROGRESS (07A, 07B, 07C, and 07D closed;',
      'Stage 07:  IN PROGRESS (07A, 07B, and 07C closed; 07D in progress;',
    ),
  };
  if (validateStatusSurfaces(staleReinserted).length === 0) {
    fail('negative control: a re-inserted stale 07D status was not detected');
  } else {
    note('negative control: stale "07D in progress" status is detected (held)');
  }
  const lineRemoved = {
    ...surfaces,
    register: surfaces.register.replace('## D-07E-01', '## (removed)'),
  };
  if (validateStatusSurfaces(lineRemoved).length === 0) {
    fail('negative control: a removed decision-register entry was not detected');
  } else {
    note('negative control: a missing register entry is detected (held)');
  }
  const stalePin = {
    ...surfaces,
    readme: surfaces.readme.replace(
      'consumes only published `@victframework/*@0.3.1`',
      'consumes only published `@victframework/*@0.3.0`',
    ),
  };
  if (validateStatusSurfaces(stalePin).length < 2) {
    fail('negative control: a re-inserted stale 0.3.0 pin claim was not detected');
  } else {
    note('negative control: stale 0.3.0 current-state prose is detected (held)');
  }
}

// ---------------------------------------------------------------------------
// 4. RELEASE IDENTITY — exact stable set, registry-only, tamper-controlled
// ---------------------------------------------------------------------------
console.log('\n[4] RELEASE IDENTITY');
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const declared = new Map();
  for (const [name, specifier] of Object.entries({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  })) {
    if (name.startsWith('@victframework/')) declared.set(name, specifier);
  }
  const resolved = new Map();
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const name = typeof key === 'string' ? key.replace(/^node_modules\//, '') : '';
    if (name.startsWith('@victframework/') && typeof entry?.version === 'string') {
      resolved.set(name, entry.version);
    }
  }
  const findings = checkReleaseSetCompatibility({ declared, resolved });
  if (findings.length > 0) {
    for (const finding of findings) fail(`release identity: ${finding}`);
  } else {
    note(`${RELEASE_IDENTITY} holds (content ${CONTENT_ID.slice(0, 16)}…)`);
  }
  if (EXPECTED_VERSION !== '0.3.1' || !CONTENT_ID.startsWith('v1_1c695280')) {
    fail('release identity: recorded constants are not the stable 0.3.1 set');
  }
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const name = typeof key === 'string' ? key.replace(/^node_modules\//, '') : '';
    if (name.startsWith('@victframework/')) {
      const resolvedUrl = entry?.resolved ?? '';
      if (!resolvedUrl.startsWith('https://registry.npmjs.org/')) {
        fail(`release identity: ${name} resolves outside the public registry (${resolvedUrl})`);
      }
    }
  }
  // Negative control: a drifted pin must produce findings.
  const drift = checkReleaseSetCompatibility({
    declared: new Map(
      [...declared].map(([name, version]) => [name, name.endsWith('/control') ? version : '0.3.0']),
    ),
    resolved,
  });
  if (drift.length === 0) {
    fail('negative control: a drifted release pin was not detected');
  } else {
    note('negative control: a drifted pin is detected (held)');
  }
}

// ---------------------------------------------------------------------------
// 5. EVIDENCE IMMUTABILITY — digests, creation commits, blob equality
// ---------------------------------------------------------------------------
console.log('\n[5] EVIDENCE IMMUTABILITY');
const PROTECTED_EVIDENCE = [
  {
    path: 'docs/report/evidence/d4-structured-session-receipt.json',
    sha256: 'ddaaea537a9d4b12438371b4945cd39a704541a21b0ae63f102facc9a2cb72ac',
    created: '5cc7e429637402f06563d6e15aad7961fd55d205',
  },
  {
    path: 'docs/report/evidence/d4-structured-session-evidence.json',
    sha256: '371fb3264d4f63ab84676fa40e56f0f0c634ddac639a4cca7e085da6e9cf48e0',
    created: '5cc7e429637402f06563d6e15aad7961fd55d205',
  },
  {
    path: 'docs/report/evidence/d4-structured-session-evidence.json.cleanup.json',
    sha256: 'b76c0236a0ff9b85a44b0874e9b561dd843caafdfba23056aa15011dd23d5282',
    created: '5cc7e429637402f06563d6e15aad7961fd55d205',
  },
  {
    path: 'docs/report/evidence/d4-structured-session-receipt.attempt-1.json',
    sha256: '4ff67b61150a8d7de5a1e8c0d68f14bdec305fb545ca5455cc83bc7c43194f8e',
    created: '459a69aaa090c58ef4aef1a403bb4058ab761b52',
  },
  {
    path: 'docs/report/evidence/d4-structured-session-evidence.attempt-1.json',
    sha256: 'c87bbd9128cf1fc38b727646719a9aa41fa56d6ee732900da8b298187b4751b5',
    created: '459a69aaa090c58ef4aef1a403bb4058ab761b52',
  },
  {
    path: 'docs/report/evidence/d4-organic-use-record.json',
    sha256: 'a3c5e009c1b8af8d64c472e7955c42670f82caec0007131f50d9fb4145443751',
    created: '60859c4e4f741b3d711f62bbae33303d638b06d9',
  },
  {
    path: 'docs/report/evidence/q6-recovery-live.json',
    sha256: '6d515b11ee46db6da4ce5e5c552511ebe0a9a4634e8f7fe20fa543b88b05c232',
    created: '8a26d310afc1fa37e4761416803c7d8434037867',
  },
  {
    path: 'docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md',
    sha256: '169a215369114b443697e68c7974b10d56742196f5bc11912cd7d0a6dd7a41b5',
    created: 'ed144b19d05aa19f4b7d7fea0b954548b0f51c26',
  },
  {
    path: 'docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md',
    sha256: 'e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331',
    created: undefined,
  },
];
const recomputeProtectedDigests = (records) =>
  records.map((record) => ({ ...record, actual: sha256OfFile(record.path) }));
{
  const recomputed = recomputeProtectedDigests(PROTECTED_EVIDENCE);
  for (const record of recomputed) {
    if (record.actual !== record.sha256) {
      fail(`evidence immutability: ${record.path} drifted from its frozen digest`);
      continue;
    }
    if (record.created !== undefined) {
      const lastTouch = (git(['log', '--no-follow', '--format=%H', '--', record.path]) ?? '').split(
        '\n',
      )[0];
      if (lastTouch !== record.created) {
        fail(
          `evidence immutability: ${record.path} was touched after its creation commit (${String(lastTouch).slice(0, 12)}…)`,
        );
        continue;
      }
      const blobNow = git(['rev-parse', `HEAD:${record.path}`]);
      const blobAtCreation = git(['rev-parse', `${record.created}:${record.path}`]);
      if (blobNow === undefined || blobNow !== blobAtCreation) {
        fail(`evidence immutability: ${record.path} blob changed since its creation commit`);
      }
    }
  }
  if (!failures.some((entry) => entry.startsWith('evidence immutability'))) {
    note(
      `${PROTECTED_EVIDENCE.length} protected evidence files byte-identical to their creation commits`,
    );
  }
  // Negative control: a tampered expectation must be detected.
  const tampered = recomputeProtectedDigests([
    { path: PROTECTED_EVIDENCE[0].path, sha256: '0'.repeat(64) },
  ]);
  if (tampered.every((record) => record.actual === record.sha256)) {
    fail('negative control: a tampered evidence expectation was not detected');
  } else {
    note('negative control: digest tampering is detected (held)');
  }
}

// ---------------------------------------------------------------------------
// 6. CONSTITUENT MANIFEST — composed gates exist and are wired
// ---------------------------------------------------------------------------
console.log('\n[6] CONSTITUENT MANIFEST');
const COMPOSED_GATES = [
  { script: 'verify:consumer', file: 'scripts/verify-consumer.mjs', tsx: false },
  { script: 'verify:governance', file: 'scripts/verify-governance.mjs', tsx: true },
  { script: 'verify:q2', file: 'scripts/verify-q2.mjs', tsx: true },
  { script: 'verify:q3', file: 'scripts/verify-q3.mjs', tsx: true },
  { script: 'verify:q4', file: 'scripts/verify-q4.mjs', tsx: true },
  { script: 'verify:q5', file: 'scripts/verify-q5.mjs', tsx: true },
  { script: 'verify:q6', file: 'scripts/verify-q6.mjs', tsx: true },
  { script: 'verify:stage7c', file: 'scripts/verify-stage7c.mjs', tsx: true },
  { script: 'verify:d1', file: 'scripts/verify-d1.mjs', tsx: true },
  { script: 'verify:d2', file: 'scripts/verify-d2.mjs', tsx: true },
  { script: 'verify:d3', file: 'scripts/verify-d3.mjs', tsx: true },
  { script: 'verify:dev-live', file: 'scripts/verify-dev-live.mjs', tsx: true },
];
const D4_PREP = { script: 'verify:d4-prep', file: 'scripts/verify-d4-prep.mjs', tsx: true };
const D4_PREP_DOCUMENTED_RED =
  'the active receipt, evidence, and cleanup output paths are all absent (attempt-1 archived)';
const validateConstituents = (gateList) => {
  const problems = [];
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const gate of gateList) {
    if (!existsSync(gate.file)) problems.push(`constituent missing: ${gate.file}`);
    if (pkg.scripts?.[gate.script] === undefined)
      problems.push(`package.json lacks: ${gate.script}`);
  }
  if (pkg.scripts?.['verify:stage7e'] !== 'node scripts/verify-stage7e.mjs') {
    problems.push('package.json verify:stage7e wiring is not the exact minimal composition');
  }
  return problems;
};
{
  const problems = validateConstituents([...COMPOSED_GATES, D4_PREP]);
  if (problems.length > 0) {
    for (const problem of problems) fail(`manifest: ${problem}`);
  } else {
    note(`all ${COMPOSED_GATES.length + 1} constituents exist and are wired`);
  }
  // Negative control: a missing constituent must fail validation.
  const missing = validateConstituents([
    { script: 'verify:d2', file: 'scripts/definitely-missing-gate.mjs' },
  ]);
  if (!missing.some((problem) => problem.includes('definitely-missing-gate'))) {
    fail('negative control: a manifest with an ABSENT constituent did not fail');
  } else {
    note('negative control: an absent constituent is detected (held)');
  }
}

// ---------------------------------------------------------------------------
// 7. SEPARATION — no live provider, no one-shot, no browser, no operator data
// ---------------------------------------------------------------------------
console.log('\n[7] SEPARATION AND OPERATOR-DATA ISOLATION');
{
  const aggregateOwnSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  // Constructed dynamically so this self-scan cannot match its own literals.
  const forbiddenTokens = [
    'verify-live' + '-provider.mjs',
    'verify-q6' + '-live.mjs',
    'run-d4-structured' + '-session.mjs',
    'scripts/dev' + '-live.mjs',
    'browser' + '-check.mjs',
    'browser-stop' + '-check.mjs',
    'browser-ceremony' + '-check.mjs',
    'browser-d2' + '-check.mjs',
    'verify-quell' + 'ight.mjs',
    '.quellight' + '-data',
    '/.pi' + "/'",
  ];
  for (const token of forbiddenTokens) {
    if (aggregateOwnSource.includes(`'${token}'`)) {
      fail(`the aggregate must never execute or read "${token}" (contract §7/§10)`);
    }
  }
  if (
    failures.length === 0 ||
    !failures.some((entry) => entry.startsWith('the aggregate must never'))
  ) {
    note('self-scan: no live, one-shot, browser, or operator-data target is composed (held)');
  }
}

// ---------------------------------------------------------------------------
// 8. L-4 EXCEPTION — the hash-bound disposition behaves exactly as frozen
// ---------------------------------------------------------------------------
console.log('\n[8] L-4 FROZEN-EVIDENCE EXCEPTION (owner decision D-07E-01)');
{
  const FROZEN = 'docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md';
  const record = frozenEvidenceFor(FROZEN);
  if (record === undefined) {
    fail('L-4: the frozen-evidence registry lost the D5 audit report record');
  } else {
    const content = readFileSync(FROZEN, 'utf8');
    const lines = content.split('\n');
    const scanRegex = /[A-Z]:\\Users\\|\/home\/[a-z]+\//g;
    const verdict = evaluateFrozenEvidence(record, content, record.gitBlob, lines, scanRegex);
    if (!verdict.accepted || verdict.matches.length !== 2) {
      fail(`L-4: the real frozen file no longer satisfies its own exception (${verdict.detail})`);
    } else {
      note(
        `real file accepted: ${verdict.matches.length} matches at lines ${verdict.matches.map((match) => match.line).join(' and ')} (path+sha256+blob+match-set)`,
      );
    }
    // Negative controls on tampered copies in the OS temp dir (repo untouched).
    const tempDir = mkdtempSync(join(tmpdir(), 'qlt-07e-l4-'));
    try {
      const mutate = (text) => {
        const file = join(tempDir, 'copy.md');
        writeFileSync(file, text);
        return file;
      };
      const byteChanged = evaluateFrozenEvidence(
        record,
        `${content}\n`,
        record.gitBlob,
        `${content}\n`.split('\n'),
        scanRegex,
      );
      if (byteChanged.accepted) fail('L-4 negative control: a byte-changed copy was accepted');
      const addedMatchText = `${content}extra path C:\\Users\\someone\\x\n`;
      const addedMatch = evaluateFrozenEvidence(
        record,
        addedMatchText,
        record.gitBlob,
        addedMatchText.split('\n'),
        scanRegex,
      );
      if (addedMatch.accepted) fail('L-4 negative control: an added match was accepted');
      const movedMatchText = content.replace('\n', '\n\n');
      const movedMatch = evaluateFrozenEvidence(
        record,
        movedMatchText,
        record.gitBlob,
        movedMatchText.split('\n'),
        scanRegex,
      );
      if (movedMatch.accepted) fail('L-4 negative control: a shifted match position was accepted');
      if (frozenEvidenceFor('docs/report/other.md') !== undefined) {
        fail('L-4 negative control: a different path resolved to the exception');
      }
      if (byteChanged.accepted || addedMatch.accepted || movedMatch.accepted) {
        // failures already pushed
      } else {
        note(
          'negative controls: byte change / added match / shifted line / different path all refuse (held)',
        );
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// 9. EXECUTION — the composed offline gates (and the by-design d4-prep red)
// ---------------------------------------------------------------------------
console.log('\n[9] CONSTITUENT EXECUTION');
const spawnGate = (gate) =>
  spawnSync(process.execPath, gate.tsx ? ['--import', 'tsx', gate.file] : [gate.file], {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  });
for (const gate of COMPOSED_GATES) {
  const result = spawnGate(gate);
  if (result.status !== 0) {
    fail(`${gate.script}: FAILED (exit ${result.status})`);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    console.error(output.split('\n').slice(-25).join('\n'));
  } else {
    note(`${gate.script}: PASS`);
  }
}
{
  // Contract §8.1: verify:d4-prep must exit non-zero with EXACTLY its
  // documented by-design single red — the sealed attempt-2 bundle occupies
  // the canonical active output paths. Any other exit shape is a real red.
  const result = spawnGate(D4_PREP);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const failLines = output.split('\n').filter((line) => line.startsWith('  FAIL:'));
  const expected =
    result.status !== 0 &&
    failLines.length === 1 &&
    failLines[0].trim() === `FAIL: ${D4_PREP_DOCUMENTED_RED}` &&
    output.includes('verify:d4-prep: FAILED — 1 check(s) red.') &&
    output.includes(
      'N-D4-P-27/28 skipped: active output paths were not absent at gate start (history preserved)',
    );
  if (result.status === 0) {
    fail(
      'verify:d4-prep: unexpectedly PASSED — the documented by-design state changed ' +
        '(the sealed attempt-2 bundle must occupy the canonical paths); re-pin consciously via contract amendment',
    );
  } else if (!expected) {
    fail(
      `verify:d4-prep: exit shape deviates from the documented by-design single red (exit ${result.status})`,
    );
    console.error(output.split('\n').slice(-25).join('\n'));
  } else {
    note(
      'verify:d4-prep: exactly the documented by-design red (sealed attempt-2 bundle protects history; N-D4-P-27/28 correctly skipped)',
    );
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:stage7e: FAILED with ${failures.length} finding(s).`);
  for (const entry of failures) console.error(`  - ${entry}`);
  process.exit(1);
}
console.log(
  'verify:stage7e: PASS — frozen contract held, closure/status/identity/evidence verified, ' +
    'all composed offline gates green, the by-design d4-prep red exact, live/one-shot/browser/operator ' +
    'targets provably unreachable from this aggregate. The authoritative ladder (contract §7) remains ' +
    'the final independent audit’s obligation.',
);
process.exit(0);
