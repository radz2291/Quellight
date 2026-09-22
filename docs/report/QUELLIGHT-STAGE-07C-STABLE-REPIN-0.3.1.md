# Quellight Stage 07C — Mechanical Stable Repin to `@victframework/*@0.3.1`

**Status:** MECHANICAL STABLE REPIN COMPLETE — exact-pinned to the VICT
STABLE release `@victframework/*@0.3.1` (release-set identity
`vict-release-set@1/0.3.1`, content ID
`v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583`).
The stable release was independently re-verified before this repin; the
VICT model-facing capability-schema remediation is FORMALLY CLOSED.
`latest → 0.3.1`; the candidate tag is RETAINED:
`vict-0.3.1-rc → 0.3.1-rc.2`; `0.3.0`, `0.3.1-rc.1`, `0.3.1-rc.2`
remain published, immutable, and installable.

**Date:** 2026-09-22.
**Owner decision (this audit cycle):** after the fresh independent
re-verification of `0.3.1-rc.2` returned ZERO Blocking/High/Medium
findings, publish the stable `0.3.1` coordinated release and repin
Quellight to it. This is a NARROW version-only repin of the already
verified Execution-3 remediation state — NO product, ceremony, memory,
authority, UI, provider, fixture, or Q6 acceptance change.

## 1. Provenance of the stable release (VICT side)

- Audited candidate: `0.3.1-rc.2` (source `a7b0018…`, publication run
  `35661159776`, evidence run `35662077320`) — fresh independent
  re-verification verdict: ZERO Blocking/High/Medium findings.
- Stable release source: `446453fc4f6837e50a0bf3254b47d6a208f5b491`
  (pushed `HEAD == origin/main`, clean, linear). All 13 stable payloads
  were proven content-equivalent to the audited rc.2 tarballs modulo
  version/pin metadata (13/13 file-level comparison).
- Publication run `35688234026` (`.github/workflows/release.yml`,
  `workflow_dispatch`, inputs `source_sha 446453fc…`, `version 0.3.1`,
  `npm_tag latest`): the full pre-publication chain ran once green and
  ALL 13 PACKAGES WERE PUBLISHED under `latest` through npm OIDC
  trusted publishing; the same-run registry verification then failed on
  CDN propagation lag (terminal-`failure`, the established
  verification-timing class; NEVER relabelled).
- Read-only successor evidence run `35689362749`
  (`.github/workflows/release-evidence.yml`, permissions exactly
  `contents: read`, re-bound to the stable identity by amendment
  `docs/report/VICT-0.3.1-STABLE-EVIDENCE-RECOVERY-AMENDMENT.md`):
  **terminal-`success`** — Linux rebuild at the bound source, tarball
  scan, and the full bounded registry verification green.
- Independent registry verification (this audit): 13/13 manifests at
  exactly `0.3.1`; exact internal pins; tarball integrity 13/13
  (sha512); SLSA provenance 13/13 bound to `radz2291/vict-02`, source
  `446453fc…`, `release.yml`, run `35688234026`; content ID recomputed
  and matching; a registry-only disposable consumer at exactly `0.3.1`
  proves the repaired tool surface (adapter revision 3; raw-argument
  guard; presentation capture).

## 2. What changed (exactly)

1. **Pins:** the ten direct `@victframework/*` dependencies moved
   `0.3.1-rc.2` → `0.3.1` (exact pins; no ranges, tags, workspace, file,
   link, or git specifiers).
2. **Lockfile:** regenerated SOLELY through the public registry
   (`https://registry.npmjs.org/`); all 11 registry-resolved
   `@victframework/*` entries are exactly `0.3.1` from the public
   registry; zero `0.3.1-rc.2` references remain.
3. **Central release-set identity** (`scripts/lib/release-set.mjs`):
   `RELEASE_IDENTITY = 'vict-release-set@1/0.3.1'`, `CONTENT_ID =
'v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583'`,
   `EXPECTED_VERSION = '0.3.1'`.
4. **Derived gates** updated to the new exact literals:
   `scripts/verify-stage7c.mjs` (identity + content-ID prefix),
   `scripts/verify-q2.mjs`, `scripts/verify-q3.mjs`,
   `scripts/verify-governance.mjs`, `scripts/verify-dev-start.mjs`,
   `scripts/verify-consumer.mjs`, `test/governed-mutation.test.ts`.
   Every derived literal was swept (the desynchronization class
   recorded during the 0.3.0 repin did not recur: a repo-wide grep for
   `0.3.1-rc.2` after the repin matches ONLY frozen historical
   documents).

## 3. What did NOT change

- `qlt.proposal.draft` stays at revision **3**, declared effect stays
  `write`, and the authoritative `Contract.parse` stays
  unchanged-or-stricter.
- Agent profile stays revision **6**; instructions stay revision **4**;
  the exact host quiet-write policy entry
  (`qlt.host-policy.quiet-write@1`, exactly one entry) is unchanged.
- No migration, no store, no memory-policy, no ceremony, no UI, no
  provider, no fixture, and no Q6 acceptance change of any kind.

## 4. Verification on the final stable-pinned tree

- `verify:consumer` — PASS (registry-only exact-pin consumption at
  `0.3.1`; the unreachable-registry negative control held).
- `verify:quellight` — first run FAILED on the KNOWN pre-existing
  `test:node` isolation race (`q6-live-parent-worker.test.ts` global
  tmpdir count vs the parallel offline-matrix test's same-prefix
  workspace allocations; diagnosed and recorded as a Low finding of the
  fresh audit — the gate invariant itself holds, proven by isolation
  runs); the disclosed rerun PASSED the full offline ladder (browser
  checks, ceremony, artifact scan, format gate).
- `verify:stage7c` — PASS (N-C1..N-C25 coverage manifest validated,
  release identity stable, all focused phase gates green).
- `npm audit --omit=dev` — 0 vulnerabilities.
- `git diff --check` — clean.

## 5. Status language

Quellight is exact-pinned to the STABLE `@victframework/*@0.3.1`. The
VICT model-facing capability-schema remediation is independently
verified and FORMALLY CLOSED. Quellight Phase Q6 remains NOT formally
closed: the live ceremony proof has not passed (three truthful failures;
the harness remediation is independently verified offline).
**Execution 4 has NOT run and is NOT authorized.** Phase Q7 remains
BLOCKED — NOT BEGUN. Stage 07 remains In Progress.
