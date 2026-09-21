#!/usr/bin/env node
/**
 * Quellight consumer verification — registry-only dependency proof (N-1)
 * and the unreachable-registry negative control (N-2). Stage 07C Phase
 * Q6 Execution-3 remediation: the adopted release identity is the
 * coordinated verification candidate `@victframework/*@0.3.1-rc.1`
 * (`vict-release-set@1/0.3.1-rc.1`, content ID
 * `v1_b6e39c1f6d6f627c03dfe12e8eb4bc0b6b8bb7f7746b4b871cf00d3c7f7ae731`).
 *
 * Passes ONLY when:
 *  1. every @victframework dependency in package.json is the exact public
 *     release pin (`@victframework/*@0.3.1-rc.1`) — no range, tag, workspace,
 *     file, git, or local-path specifier;
 *  2. the lockfile contains no workspace:/file:/link:/git dependency and
 *     resolves @victframework packages from the public npm registry with
 *     integrity metadata — and NO installed VICT package version is
 *     anything but exactly 0.3.1-rc.1 (a mixed set fails);
 *  3. the coordinated content identity re-derives from the PUBLIC
 *     REGISTRY's published versions of the full 13-member set;
 *  4. each package is actually fetchable from the registry right now
 *     (metadata probe with integrity);
 *  5. NEGATIVE CONTROL: the same probe against a guaranteed-unreachable
 *     registry fails closed — proving the probe really exercises the
 *     network path and cannot silently pass without the registry.
 *
 * No credential values are read, printed or transmitted.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  CONTENT_ID,
  EXPECTED_VERSION,
  RELEASE_IDENTITY,
  RELEASE_SET_MEMBERS,
  checkReleaseSetCompatibility,
} from './lib/release-set.mjs';

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

// 2. Lockfile hygiene: no forbidden protocols, registry-only resolution,
//    and the FULL resolved graph (direct + transitive) at exactly 0.3.0.
console.log('\n[2] lockfile hygiene (no workspace:/file:/link:/git, registry URLs only)');
const lockPackages = Object.entries(lockfile.packages ?? {});
for (const [key, entry] of lockPackages) {
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
const installed = new Map();
for (const [key, entry] of lockPackages) {
  if (!key.startsWith('node_modules/@victframework/')) {
    continue;
  }
  const name = key.replace('node_modules/', '');
  installed.set(name, entry.version);
  if (entry.version !== EXPECTED_VERSION) {
    fail(
      `lockfile has @victframework package at ${entry.version}, expected ${EXPECTED_VERSION} (a mixed release set is not adoptable)`,
    );
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
    `${installed.size} @victframework lockfile entries pinned at ${EXPECTED_VERSION} with integrity, registry-resolved`,
  );
}

// 2b. The executable compatibility gate (shared logic; mixed sets fail).
console.log('\n[2b] release-set compatibility gate (mixed sets fail)');
{
  const declared = new Map(victDeps);
  const findings = checkReleaseSetCompatibility({ declared, resolved: installed });
  if (findings.length > 0) {
    for (const finding of findings) {
      fail(finding);
    }
  } else {
    note(
      `graph compatibility gate PASS: every installed member at ${EXPECTED_VERSION}; the resolved graph re-derives the recorded content identity`,
    );
  }
}

// 3. Public-registry provenance: the recorded content identity must
//    re-derive from the REGISTRY's published versions of the full set.
console.log('\n[3] public-registry provenance (13-member content identity)');
const spawnNpm = (args, options) =>
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    shell: process.platform === 'win32',
    ...options,
  });
{
  const registryVersions = new Map();
  let probeOk = true;
  for (const name of RELEASE_SET_MEMBERS) {
    try {
      const out = spawnNpm(['view', `${name}@${EXPECTED_VERSION}`, 'version'], {
        timeout: 45_000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const version = out.trim().split('\n').at(-1)?.trim() ?? '';
      if (version !== EXPECTED_VERSION) {
        probeOk = false;
        fail(`${name}: registry publishes ${version || 'nothing'} at ${EXPECTED_VERSION}`);
      } else {
        registryVersions.set(name, version);
      }
    } catch (error) {
      probeOk = false;
      fail(`${name}: registry provenance probe failed: ${String(error.message).split('\n')[0]}`);
    }
  }
  const { deriveContentId } = await import('./lib/release-set.mjs');
  const derived = deriveContentId(registryVersions);
  if (derived !== CONTENT_ID) {
    probeOk = false;
    fail(
      `coordinated content identity re-derived from the public registry (${derived ?? 'incomplete'}) does not equal the recorded identity`,
    );
  } else if (probeOk) {
    note(
      `all 13 members publish ${EXPECTED_VERSION} from the public registry; content identity re-derived: ${CONTENT_ID}`,
    );
  }
}

// 4. Live registry probe (bounded): integrity per package via `npm view`.
console.log('\n[4] public registry probe (bounded, metadata only)');
const names = victDeps.map(([name]) => name);
let probeOk = true;
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

// 5. Negative control: unreachable registry must fail the same probe.
console.log('\n[5] negative control — unreachable registry fails closed (N-2)');
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
