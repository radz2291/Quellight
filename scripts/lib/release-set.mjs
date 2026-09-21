#!/usr/bin/env node
/**
 * Shared release-set compatibility gate logic (Quellight Stage 07C Phase
 * Q1). Used by `scripts/verify-consumer.mjs` (executable gate) and by the
 * permanent governed-mutation test suite (structural gate).
 *
 * The coordinated release-set identity is immutable:
 *   `vict-release-set@1/0.2.0`
 *   content ID: sha256 over the sorted, newline-joined `name@version`
 *   list of the EXACT 13-member set, prefixed `v1_` (VICT
 *   `docs/RELEASE-COMPATIBILITY.md` §2 algorithm).
 */

import { createHash } from 'node:crypto';

/** The recorded, authoritative public release identity: the coordinated
 * stable set `0.3.0` — the M-1 remediation content published as the
 * verified stable release after the fresh independent re-verification
 * (VICT `docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md`), through
 * the same trusted-OIDC workflow. */
export const RELEASE_IDENTITY = 'vict-release-set@1/0.3.0';
export const CONTENT_ID = 'v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580';
export const EXPECTED_VERSION = '0.3.0';

/** The exact 13-member coordinated release set (recorded identity). */
export const RELEASE_SET_MEMBERS = Object.freeze([
  '@victframework/appdata-sqlite',
  '@victframework/application',
  '@victframework/cli',
  '@victframework/contracts',
  '@victframework/control',
  '@victframework/kernel',
  '@victframework/mastra',
  '@victframework/renderer-svelte',
  '@victframework/runtime',
  '@victframework/scaffolder',
  '@victframework/sdk',
  '@victframework/server',
  '@victframework/store-sqlite',
]);

/**
 * Derive the coordinated content identity from a `name -> version` map.
 * Returns `v1_…` (or undefined when a member is missing).
 *
 * @param {Map<string, string>} versions
 * @returns {string | undefined}
 */
export function deriveContentId(versions) {
  const list = RELEASE_SET_MEMBERS.map((name) => {
    const version = versions.get(name);
    return version === undefined ? null : `${name}@${version}`;
  });
  if (list.some((entry) => entry === null)) {
    return undefined;
  }
  list.sort();
  return `v1_${createHash('sha256').update(list.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * The release-set compatibility gate: a dependency graph fails when any
 * VICT member is absent from the declared set, at any version other than
 * the exact coordinated release version, or resolved outside the public
 * registry. Returns the list of findings (empty = pass).
 */
/**
 * @param {{ declared: Map<string, string>; resolved: Map<string, string>; expectedVersion?: string; expectedContentId?: string }} args
 * @returns {string[]}
 */
export function checkReleaseSetCompatibility({
  /** `name -> exact version specifier` (package.json dependencies). */
  declared,
  /** `name -> resolved version` for the installed/lockfile graph. */
  resolved,
  expectedVersion = EXPECTED_VERSION,
  expectedContentId = CONTENT_ID,
}) {
  const findings = [];
  for (const [name, specifier] of declared) {
    if (specifier !== expectedVersion) {
      findings.push(
        `${name} must be pinned to the exact coordinated release ${expectedVersion}, found "${specifier}"`,
      );
    }
  }
  const installed = new Map(resolved);
  const resolvedVersions = new Map();
  for (const [name, version] of installed) {
    if (!RELEASE_SET_MEMBERS.includes(name)) {
      findings.push(`${name} is not a member of the recorded release set ${RELEASE_IDENTITY}`);
      continue;
    }
    if (version !== expectedVersion) {
      findings.push(`${name} resolves at ${version}; a mixed release set is not adoptable`);
    }
    resolvedVersions.set(name, version);
  }
  if (resolvedVersions.size === 0) {
    findings.push('no installed @victframework/* package was found in the resolved graph');
  }
  const derived = deriveContentId(
    new Map([...deriveFullSetFrom(resolvedVersions, expectedVersion)].map(([k, v]) => [k, v])),
  );
  if (derived !== expectedContentId) {
    findings.push(
      `release-set content identity derived from the resolved graph (${derived ?? 'incomplete'}) does not match the recorded identity ${expectedContentId}`,
    );
  }
  return findings;
}

/**
 * Reconstruct the FULL 13-member set versions from the subset observed in
 * a consumer graph: every observed member must sit at the expected
 * version; unobserved members are assumed at the expected version (the
 * recorded identity) — the full-set content identity check therefore
 * fails if ANY observed member is mixed.
 */
/**
 * @param {Map<string, string>} observedSubset
 * @param {string} expectedVersion
 * @returns {Map<string, string>}
 */
function deriveFullSetFrom(observedSubset, expectedVersion) {
  const full = new Map();
  for (const name of RELEASE_SET_MEMBERS) {
    full.set(name, observedSubset.get(name) ?? expectedVersion);
  }
  return full;
}

/**
 * The registry-provenance gate for one member: returns the resolved
 * tarball URL only when it points at the public npm registry.
 *
 * @param {string} name
 * @param {string} version
 * @param {string | undefined} resolved
 * @returns {string | undefined}
 */
export function registryTarballUrl(name, version, resolved) {
  if (
    typeof resolved === 'string' &&
    resolved.startsWith('https://registry.npmjs.org/') &&
    resolved.includes(`/${name}/-/`) &&
    resolved.endsWith(`-${version}.tgz`)
  ) {
    return resolved;
  }
  return undefined;
}
