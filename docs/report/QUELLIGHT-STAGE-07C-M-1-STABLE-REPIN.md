# Quellight Stage 07C — VICT-M-1 Stable Repin Record

**Status:** Quellight is exact-pinned to the STABLE verified release set
`@victframework/*@0.3.0` (`vict-release-set@1/0.3.0`, contentId
`v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580`).
The full stable-pinned authoritative ladder is green. **VICT-M-1 is
FORMALLY CLOSED.** Q5 remains formally closed; Phase Q6 contract and
implementation planning is PERMITTED — NOT BEGUN; no live-provider or
Q6 behavior was added.

**Date:** 2026-09-21.
**Stable release provenance:** VICT release source
`c7a413a1d3e3da978434e9b1a6679b9ac233d203`, published by workflow run
`35564490763` (`.github/workflows/release.yml`, attempt 1,
terminal-`success`, npm OIDC trusted publishing only).
**Governing verification:**
`docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md` (verdict
`CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`) and
`docs/report/VICT-M-1-STABLE-RELEASE-AND-FORMAL-CLOSURE.md` (VICT-side
closure record).

## 1. Commits of this task

| Commit        | Subject                                                                            | Content                              |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| `1c7d3e6…`    | `chore(deps): repin Quellight to the stable vict-release-set@1/0.3.0`              | mechanical repin ONLY (below)        |
| `1ff8e6b…`    | `fix(verifiers): complete the stable-set recorded identities in the Q-phase gates` | recorded-identity completion (§1.1)  |
| (this commit) | documentation and status                                                           | this record + status-surface updates |

## 1.1 Disclosed defect in the repin: the first stable-pinned ladder run FAILED

The first full stable-pinned ladder run (at `1c7d3e6…`) FAILED inside
`verify:quellight` with 5 findings (`verify:q2`, `verify:q3`,
`verify:dev-start`, `test:node`, `browser-stop-check`). Every finding
traced to ONE root cause: the Q-phase verifier gates enforce the
adopted set by RECORDED LITERAL, and the repin missed those literals
(`0.3.0-rc.1` remained in `verify-q2`/`verify-q3`/`verify-governance`/
`verify-dev-start`/`verify-consumer` comments, `browser-ceremony-check`,
and the `governed-mutation` identity assertion). `1ff8e6b…` updates
exactly those recorded identities (27 literal replacements, no
behavior, schema, or product change) — the same class of update the
candidate adoption itself performed. Each affected gate was then
re-verified green individually (q2 179 checks, q3 34 checks, dev-start
zero-warning, browser-stop-check green in isolation) before the
authoritative full ladder re-run below. The failed run and its fix are
part of the truthful record; no failure was hidden and no assertion
was weakened.

## 2. The mechanical repin (exactly what changed)

- `package.json`: every `@victframework/*` dependency exact-pinned
  `0.3.0-rc.1` → `0.3.0` (9 runtime dependencies + the scaffolder
  devDependency). No other manifest change.
- `package-lock.json`: regenerated through REAL public-registry
  installation (no workspace/file/link/git fallback). All 11 VICT
  lockfile entries are at exactly `0.3.0`, resolved from
  `https://registry.npmjs.org/`, with `dist.integrity` values equal to
  the published artifacts; zero candidate references remain.
- `scripts/lib/release-set.mjs`: the consumer-gate constants updated to
  the recorded stable identity (`RELEASE_IDENTITY =
'vict-release-set@1/0.3.0'`,
  `CONTENT_ID = 'v1_5f3a074a…'`, `EXPECTED_VERSION = '0.3.0'`).
- Audit findings L-1/L-2 (stale-text hygiene from the independent
  re-verification): the superseded `qlt.proposal.draft@1` literals in
  the current-surface invariant strings and the stale 0.2.0-era content
  ID in the `verify-consumer.mjs` header comment were corrected to the
  current `@2`/`0.3.0` identities. The historically-framed Q4 deferral
  docblock (which describes the D-Q4-2 decision as made) is preserved
  untouched.
- **NO Quellight product or Q6 behavior change.** `qlt.proposal.draft`
  remains at revision `2` with the truthful `write` declaration; the
  composition still supplies the EXACT one-entry host quiet-write
  policy (`qlt.host-policy.quiet-write@1`) through the trusted
  composition channel only; the agent envelope remains
  proposal-draft-only; Q2–Q5 closure records, the decision register
  history, and all frozen/historical reports are preserved unchanged.

## 3. Verification on the exact stable-pinned tree (`1c7d3e6…`)

The AUTHORITATIVE full run on the corrected tree `1ff8e6b…` (all
steps, sequentially, all exit 0) — the failed first attempt is
disclosed in §1.1:

```text
npm ci                        (clean locked install, exact 0.3.0 set)
npm run verify:consumer       (registry-only exact-pin proof + N-1/N-2
                               unreachable-registry negative control held)
npm run verify:quellight      (format; typecheck; governed-mutation gate;
                               node suites incl. the M-1 real-composition
                               evidence — truthful write/no-approval/host-
                               policy disposition, zero approval records,
                               quiet transcript; zero-warning dev-start
                               gate; UI islands; production build with
                               closed-allowlist build-log scan; real-
                               browser hydration/responsive/axe; Stop
                               regression with old-commit negative
                               control; real-browser ceremony recovery;
                               credential/canary/local-path artifact
                               scan; git diff --check)
npm audit --omit=dev          (0 vulnerabilities)
git diff --check              (clean)
```

Truthful classification is unchanged: the proposal write stays quiet
ONLY through the host-owned policy, and every invocation durably
records `effect='write'`, `approvalRequired=false`,
`approvalDisposition='host-policy-write-without-separate-approval'`,
`effectPolicyIdentity='vict-effect-policy@1'`.

## 4. Standing

- VICT-M-1: **FORMALLY CLOSED** (remediated → candidate published →
  evidence chain recovered → independently re-verified → stable `0.3.0`
  published → Quellight exact-pinned to the stable set).
- Phase Q5: **VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED**
  (unchanged).
- Phase Q6: contract and implementation planning is **PERMITTED — NOT
  BEGUN**.

## 5. Preservation and attestation

All historical reports, frozen contracts, and the decision-register
history are byte-unchanged. `.quellight-data` (operator data) was never
opened, read, or modified. The repin used no npm credential of any kind
— the registry material arrived exclusively through unauthenticated
public installs of the published stable set; no history rewrite, no
force-push, fast-forward only.
