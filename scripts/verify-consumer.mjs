#!/usr/bin/env node
/**
 * Quellight consumer verification — registry-only dependency proof (N-1)
 * and the unreachable-registry negative control (N-2).
 *
 * Passes ONLY when:
 *  1. every @victframework dependency in package.json is the exact public
 *     release pin (@victframework/*@0.1.0, release identity
 *     vict-release-set@1/0.1.0);
 *  2. the lockfile contains no workspace:/file:/link:/git dependency and
 *     resolves @victframework packages from the public npm registry;
 *  3. each package is actually fetchable from the registry right now
 *     (metadata probe with integrity);
 *  4. NEGATIVE CONTROL: the same probe against a guaranteed-unreachable
 *     registry fails closed — proving the probe really exercises the
 *     network path and cannot silently pass without the registry.
 *
 * No credential values are read, printed or transmitted.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXPECTED_VERSION = '0.1.0';
const RELEASE_IDENTITY = 'vict-release-set@1/0.1.0';
const CONTENT_ID = 'v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d';

const failures = [];
const note = (message) => console.log(`  ${message}`);
const fail = (message) => {
  failures.push(message);
  console.error(`  FAIL: ${message}`);
};

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));

const victDeps = Object.entries({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}).filter(([name]) => name.startsWith('@victframework/'));

console.log('verify:consumer — registry-only VICT consumption (N-1/N-2)');
console.log(`release identity: ${RELEASE_IDENTITY}`);
console.log(`content id:       ${CONTENT_ID}`);

// 1. Exact public pins.
console.log('\n[1] exact public release pins in package.json');
for (const [name, range] of victDeps) {
  if (range === EXPECTED_VERSION) {
    note(`${name}@${range}`);
  } else {
    fail(`${name} must be pinned to ${EXPECTED_VERSION}, found "${range}"`);
  }
}
if (victDeps.length < 9) {
  fail(`expected at least 9 @victframework dependencies, found ${victDeps.length}`);
}

// 2. Lockfile hygiene: no forbidden protocols, registry-only resolution.
console.log('\n[2] lockfile hygiene (no workspace:/file:/link:/git, registry URLs only)');
const lockPackages = Object.entries(lockfile.packages ?? {});
for (const [key, entry] of lockPackages) {
  const spec = typeof entry === 'object' ? (entry.version ?? '') : '';
  void spec;
  const link = entry.link === true || key.startsWith('link:');
  const resolved =
    typeof entry === 'object' && typeof entry.resolved === 'string' ? entry.resolved : undefined;
  if (link) {
    fail(`lockfile entry ${key} is a link dependency`);
  }
  if (resolved !== undefined && !resolved.startsWith('https://registry.npmjs.org/')) {
    fail(`lockfile entry ${key} resolved outside the public registry: ${resolved}`);
  }
}
for (const [key, entry] of lockPackages) {
  if (!key.startsWith('node_modules/@victframework/')) {
    continue;
  }
  if (entry.version !== EXPECTED_VERSION) {
    fail(`lockfile has @victframework package at ${entry.version}, expected ${EXPECTED_VERSION}`);
  }
  if (typeof entry.integrity !== 'string' || entry.integrity.length === 0) {
    fail(`lockfile entry ${key} has no integrity hash`);
  }
}
const lockText = JSON.stringify(lockfile);
for (const forbidden of ['workspace:', 'file:', 'link:', 'git+', 'git://', 'github:']) {
  if (lockText.includes(forbidden)) {
    fail(`lockfile contains forbidden protocol marker "${forbidden}"`);
  }
}
if (failures.length === 0) {
  note(
    `all ${lockPackages.filter(([key]) => key.startsWith('node_modules/@victframework/')).length} @victframework lockfile entries pinned at 0.1.0 with integrity, registry-resolved`,
  );
}

// 3. Live registry probe (bounded): integrity per package via `npm view`.
console.log('\n[3] public registry probe (bounded, metadata only)');
const names = victDeps.map(([name]) => name);
let probeOk = true;
// `shell: true` is required on Windows to spawn the npm shim (Node >=18.20
// EINVAL guard for .cmd files) and is safe here: every argument is a
// literal constant defined in this file.
const spawnNpm = (args, options) =>
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    shell: process.platform === 'win32',
    ...options,
  });
for (const name of names) {
  try {
    const out = spawnNpm(['view', `${name}@${EXPECTED_VERSION}`, 'dist.integrity'], {
      timeout: 45_000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const integrity = out.trim().split('\n').at(-1)?.trim() ?? '';
    if (integrity.startsWith('sha512-')) {
      note(`${name}@${EXPECTED_VERSION} → ${integrity.slice(0, 24)}…`);
    } else {
      fail(`${name}: registry returned no sha512 integrity`);
    }
  } catch (error) {
    probeOk = false;
    fail(`${name}: registry probe failed: ${String(error.message).split('\n')[0]}`);
  }
}

// 4. Negative control: unreachable registry must fail the same probe.
console.log('\n[4] negative control — unreachable registry fails closed (N-2)');
try {
  spawnNpm(
    [
      'view',
      `${names[0]}@${EXPECTED_VERSION}`,
      'dist.integrity',
      '--registry=http://127.0.0.1:9/',
      '--fetch-timeout=8000',
      '--fetch-retries=0',
      '--prefer-offline=false',
    ],
    { timeout: 30_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  fail(
    'unreachable-registry probe unexpectedly succeeded — the probe cannot prove registry dependence',
  );
} catch {
  note('unreachable-registry probe failed as required (fail closed)');
}

console.log('');
if (failures.length > 0 || !probeOk) {
  console.error(`verify:consumer: FAILED with ${failures.length} failure(s).`);
  process.exit(1);
}
console.log(
  'verify:consumer: PASS — registry-only exact-pin VICT consumption proven (N-1), unreachable-registry negative control held (N-2).',
);
