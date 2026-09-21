# Quellight Stage 07C — Mechanical Candidate Repin to `@victframework/*@0.3.1-rc.2`

**Status:** MECHANICAL REPIN COMPLETE — exact-pinned to the VICT
verification candidate `@victframework/*@0.3.1-rc.2` (release-set
identity `vict-release-set@1/0.3.1-rc.2`, content ID
`v1_55d1ad2eb0afaf0e487b3e0b457069e7cfe2ac0bdaed7d443a13287287f0e31f`).
**Awaiting fresh independent re-verification of the VICT candidate.**
`latest` remains `0.3.0`; stable `0.3.1` remains UNPUBLISHED.

**Date:** 2026-09-22.
**Owner decision:** implement the VICT audit-remediation
(frozen contract
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`,
VICT) and mechanically repin Quellight to the resulting candidate after
its trusted-OIDC publication and registry verification. This is a
NARROW version-only repin of the already-verified Execution-3
remediation state — NO product, ceremony, memory, authority, UI,
provider, fixture, or Q6 acceptance change.

## 1. What changed (exactly)

1. **Pins:** the ten direct `@victframework/*` dependencies moved
   `0.3.1-rc.1` → `0.3.1-rc.2` (exact pins; no ranges, tags, workspace,
   file, link, or git specifiers).
2. **Lockfile:** regenerated SOLELY through the public registry
   (`https://registry.npmjs.org/`); every `@victframework/*` entry
   resolves from the public registry at exactly `0.3.1-rc.2`.
3. **Central release-set identity** (`scripts/lib/release-set.mjs`):
   `RELEASE_IDENTITY = 'vict-release-set@1/0.3.1-rc.2'`, `CONTENT_ID =
   'v1_55d1ad2e…'`, `EXPECTED_VERSION = '0.3.1-rc.2'` (content ID
   derived by the canonical algorithm from the 13-member `name@version`
   set).
4. **Derived gates** updated to the new exact-pin identity:
   `verify:q2`, `verify:q3`, `verify:governance`, `verify:dev-start`,
   `verify:stage7c` (recorded-constants check), and the
   `verify:consumer` header; `test/governed-mutation.test.ts` release
   identity assertion.

## 2. What did NOT change

* `qlt.proposal.draft` stays at revision **3**, declared effect stays
  `write`, and the authoritative `Contract.parse` stays
  unchanged-or-stricter.
* Agent profile stays revision **6**; instructions stay revision **4**;
  the exact host quiet-write policy entry
  (`qlt.host-policy.quiet-write@1`, exactly one entry) is unchanged.
* No migration, no store, no memory-policy, no ceremony, no UI, no
  provider, no fixture, and no Q6 acceptance change of any kind. The
  capability envelope diff relative to the Execution-3 remediation state
  is version-reference-free (the capability source carries no VICT
  version literals).

## 3. Candidate provenance (VICT side, recorded here for the consumer chain)

* Release source: `a7b0018c460581e5425df80e56b0ccf309a4b4a4` (pushed
  `HEAD == origin/main`; clean; linear).
* Publication run `35661159776` (`.github/workflows/release.yml`,
  `workflow_dispatch`): full in-workflow chain green; ALL 13 PACKAGES
  PUBLISHED under `vict-0.3.1-rc` through npm OIDC trusted publishing;
  the final same-run registry verification failed on CDN propagation lag
  (2/13 not visible after 12 read-only re-checks) — terminal-`failure`
  on verification timing only, the established recovery class.
* Read-only successor evidence run `35662077320`
  (`.github/workflows/release-evidence.yml`, permissions exactly
  `contents: read`): **terminal-`success`** — 13/13 registry manifests at
  exactly `0.3.1-rc.2`; `vict-0.3.1-rc → 0.3.1-rc.2`; `latest → 0.3.0`;
  stable `0.3.1` absent; per-package integrity equality against the
  rebuilt candidate source; SLSA provenance 13/13 bound to the source
  SHA, workflow, and publication run; release-set content identity
  recomputed and matching; registry-only consumer proof green — per
  `docs/report/VICT-0.3.1-RC2-EVIDENCE-RECOVERY-AMENDMENT.md` (VICT).

## 4. Verification

The authoritative Quellight offline ladder ran ONCE on the repinned tree
(`npm ci`, `verify:consumer`, `verify:quellight`, `verify:stage7c`,
`npm audit --omit=dev`, `git diff --check` — all green; recorded in the
decision register entry below). `verify:q6:live` was NOT executed.

## 5. Status language

The Q6 harness remediation remains INDEPENDENTLY VERIFIED OFFLINE (the
prior independent verification is preserved unchanged). Q6 remains NOT
formally closed; **Execution 4 has not run and is NOT authorized**; the
authoritative live count remains THREE; **Phase Q7 remains BLOCKED — NOT
BEGUN**; Stage 07 remains In Progress. The `0.3.1-rc.2` candidate is a
VERIFICATION CANDIDATE awaiting fresh independent re-verification; the
stable repin (`0.3.1`) remains a separate later owner decision.
