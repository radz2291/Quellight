# Quellight Stage 07E — Independent Exit Audit

**Independent auditor's report — 2026-09-24.**
**Verdict: STAGE 07 VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED.**
(0 Blocking / 0 High / 0 Medium / 4 Low — all non-blocking; dispositions below.)

This audit was performed by a fresh independent session that did not prepare
Stage 07E and does not accept its completion report by assertion. Every material
conclusion below was re-derived from repository truth and freshly executed
verification. No live provider was contacted; no consumed one-shot proof was
re-executed; D4 was not re-run; `.quellight-data/` and VICT `.pi/` were never
read; no product code was modified; no assertion was weakened and no timeout was
increased; every non-green first result is recorded truthfully with its
permitted retry distinguished.

---

## 1. Starting identities and history reconciliation

| Identity                            | SHA                                        | Verified                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight audited tip               | `cfc6653061f44e4fbdc3d0f2a47850e148e07a25` | `HEAD == origin/main` after fresh fetch; tracked tree clean; zero untracked audit residue                                                                                   |
| Quellight 07D closure tip (pre-07E) | `b78d8cd5d3285b5bba1f425f32146f8cf3950a17` | strict ancestor of HEAD (`merge-base --is-ancestor`); no rewrite, no force-push                                                                                             |
| VICT tip                            | `2c65a4f8241d6e7765c3fac1a4a09563d288fa63` | `HEAD == origin/main` after fresh fetch; tracked tree clean (only untracked operator `.pi/`, never read); tip commit is the documentation-only v0.4.27 §0.33 reconciliation |

- Both histories are strictly linear (no merge commits in the audited ranges);
  neither repository carries any branch other than `main`; no conflicting 07E
  work exists anywhere.
- The 07E delta is exactly 12 commits, `b78d8cd..cfc6653`, and touches exactly
  10 files — the contract freeze (amended), the decision register, the
  preparation report, README, system-reference, `package.json` (one gate
  wiring line), `scripts/lib/frozen-evidence.mjs` (new),
  `scripts/verify-quellight.mjs` (scan disposition only),
  `scripts/verify-stage7e.mjs` (new), and
  `scripts/browser-ceremony-check.mjs` (test-machinery repairs only).
  **`src/` is byte-untouched across the entire 07E range** — Stage 07E changed
  no product code, exactly as its mandate requires.

## 2. Closure chain, ordering, and absence of rewritten evidence (E-1)

Independently verified by `git merge-base --is-ancestor` for every pinned
identity: 07A (`cb9d74b`, fix `e45bdec`, release `7e5908e`, closure `84c32e5`
in VICT, record present at the VICT tip), 07B (`f25b03a` closure; remediation
tip `65f1767e`; VICT constitutional closure `1fd9806`), 07C (`a7530a5` closure

- style `5119b06`; Q7 audit `9d5e132b` of tree `8a26d31`), 07D (remediation
  chain `559e40a→b232682→483fd7c→8e74991→3503a51→072430e`; audit `ed144b1` of
  tree `60859c4`; closure `b78d8cd`; register D-07D-17). Strict closure ordering
  `f25b03a < a7530a5 < b78d8cd < (07E work)` holds; all five frozen-contract/
  amendment ordering pairs of contract §3 were independently confirmed.

No rewritten evidence: all nine §6 protected digests recompute exactly; each
file's last-touch commit equals its pinned creation commit (`5cc7e42`, `459a69a`,
`60859c4`, `8a26d31`, `ed144b1`, canonical architecture pre-07); the D5 report
blob equals its §5 pin (`d89fad11…`) with a single creation touch (`ed144b1`).
Status surfaces agree everywhere: 07A–07D closed; 07E prepared with the final
audit not begun; Stage 07 IN PROGRESS; `0.3.0` prose exists only in dated
historical sections. No surface invents a "Stage 08".

## 3. The 07E contract, amendments, and gate pin (E-6, Determination 2)

The freeze commit `9325bfa` precedes the L-4 disposition `3667c71`, the
machinery `78cbb3f`, and every amendment; all three amendments (`87440dc`,
`49effe1`, `a6d38f1`) are standalone docs commits touching only the contract
file and the register, each followed by an explicit executable re-pin. The
contract at HEAD hashes to
`f4d7589f8c29fda28f5b5248d895d4ae8fec75a3e4c34dabfbab74307851e2ee` — exactly
the digest pinned in `verify-stage7e.mjs` (amendment-3 state). The preparation
conforms to the FINAL frozen contract, not merely to its verifier: the gate's
§10-mandated sections were each independently inspected and found real
(pure status validator; shared release-set library; digest/last-touch/blob
evidence checks; manifest; dynamically-tokenized separation self-scan; L-4
behavior checks; exact d4-prep red-shape enforcement).

## 4. The L-4 exception (Determination 3)

`scripts/lib/frozen-evidence.mjs` registers EXACTLY ONE record, keyed to the
exact path, SHA-256 `169a2153…`, git blob `d89fad11…`, and the exact two-match
set. Independent verification:

- The frozen report still trips the scan pattern at exactly 2 places — lines 15
  and 16, both the ten-character Windows user-directory prefix (the auditor's
  quoted VICT-checkout and frozen-audit-tree paths) — collected by my own
  script; a repo-wide sweep of scanned surfaces found NO other file matching.
- The scanner (`verify-quellight.mjs` step 7, diffed against `b78d8cd`) still
  inspects the file — canary and credential checks run on it unchanged BEFORE
  the exception branch; acceptance requires all four keys and reports
  explicitly; the boolean local-path test is deliberately non-global (a `/g`
  regex would carry `lastIndex` across files and silently skip findings); the
  pattern itself is unchanged.
- Empirical fail-closed probes (temp copies only; real file untouched): real
  file ACCEPTED; one-character byte change REFUSED (digest layer); added match
  REFUSED; removed match REFUSED; shifted match REFUSED; same content at a
  different path gains NOTHING (no record → normal failure). Defense in depth:
  the digest layer catches every mutation before the pattern layer is consulted.
- The gate's own runtime negative controls (byte change / added match / shifted
  line / different path) were exercised in this audit's `verify:stage7e` run
  and all held.
- Credential, canary, fixture-content, operator-data, and privacy scans are
  unchanged and still apply to the frozen file; documentation in general gains
  no exception.

**L-4 is RESOLVED exactly per the frozen owner decision D-07E-01.**

## 5. The L-5 test-machinery changes (Determination 4)

`git diff b78d8cd..HEAD -- scripts/browser-ceremony-check.mjs` inspected in
full; timeout literal sets before/after are IDENTICAL
(`{1280, 1200, 1500, 2000, 20000, 45000}`) — no timeout was increased; the
pending-label predicate is character-identical; no assertion was removed; every
failure path is retained. The changes are exactly:

1. `locator.press('Enter', { timeout: 20_000 })` at both chip-activation sites
   (re-resolution + actionability + retry on detachment; the keyboard-activation
   assertion is unchanged) — the deterministic gate-script activation race.
2. A shared `deliverSend` helper at the four bare Send sites (delivery verified
   by the composer clearing; real-click fallback) — delivery mechanism only;
   all downstream turn assertions unchanged.
3. `openOldestThreadTray` bounded retries (three attempts at the standard 20 s
   bound) with every force-close signature reported truthfully; failure to open
   remains a real failure — the frozen amendment-2 design.
4. The `runScenario` pending-label re-present fallback (one bounded
   reload → mount-reconcile re-present → wait once more; fires visibly; a still-
   absent label is a real failure) — the frozen amendment-3 design; the
   fallback's post-reload thread re-selection mirrors step 4's own pattern.

**Classification confirmed: assertion-neutral test-machinery repairs; no
product behavior, timeout, or acceptance condition weakened.** The distinction
between infrastructure races and genuine product failures was re-derived: the
identical interactions succeed repeatedly within failing runs; failures migrate
with machine load, not with code.

## 6. The two product Low findings (Determination 5)

Independently located in product source and independently severity-assessed:

- **Thread-restore force-close race:** `openThread` sets `memoryOpen = false`
  AFTER awaiting the restore fetch (`src/lib/islands/ConversationWorkspace.svelte`
  lines ~170/183), so a tray opened during a slow switch is closed when the
  fetch resolves (the open-then-close signature observed by the gate).
  Assessment: **Low** — a timing-dependent transient action loss in a quiet
  UI surface; the surface converges to its designed closed state; no false
  state is displayed; no durability, authority, or truthfulness implication.
  Does not violate E-5 (which requires truthful statuses, no focus theft, no
  forced OPENING). Can truthfully remain carried non-blocking debt.
- **One-shot post-turn chip refresh:** the post-turn continuation calls
  `refreshMemory()` exactly once; its catch silently keeps the last known state
  ("truthful and quiet; nothing fabricated"). A failed refresh leaves the chip
  label stale until any re-present (reload, thread open, action).
  Assessment: **Low** — stale-quiet presentation only; the underlying proposal
  is durable and truthfully re-presented on any reconcile; nothing false is
  shown. Does not violate any exit requirement.

Both severities were re-derived from source and observed signatures; I concur
with the preparation's Low/non-blocking classification, reached independently.

## 7. Release identity, pins, migrations, manifest (Determination 6)

- `package.json`: all 9 runtime `@victframework/*` + `scaffolder` dev — exactly
  `0.3.1`; lockfile: 11 package entries at `0.3.1` with integrity, all resolved
  from `https://registry.npmjs.org/`, zero non-registry or workspace/file/link
  sources.
- Content identity INDEPENDENTLY RE-DERIVED from the frozen 13-member algorithm:
  `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583` —
  matches the pin, `verify:consumer`'s live-registry derivation, and VICT's own
  `docs/RELEASE-COMPATIBILITY.md` constant. Stable release source `446453fc…`
  is an ancestor at the VICT tip.
- Migration inventory: 6 additive Shared World migrations (v1–v6, 28 CREATE
  TABLE statements); the migration-6 comment intentionally remains at safety
  contract `@1` (historical truth, per the D5 re-verification).
- Cross-stage manifest: `verify:stage7e` [6] validated all 13 constituents and
  the exact minimal wiring, with the missing-constituent negative control held.
- VICT-side truth: tip `2c65a4f` == origin/main; §0.33 (v0.4.27) present and
  documentation-only; the release-set content ID matches Quellight's.

## 8. Product coherence and evidence (Determination 7, 8)

Product coherence is evidenced by the closed substages' frozen gates all green
in this audit (governance, q2–q6, stage7c, d1 49, d2 87, d3 35, dev-live 19,
node 357, ui 20, three real-browser gates) — one governed capability model,
governed mutation boundary, ceremony-bounded meaning, deterministic bounded
context assembly, modes and inspection, retention/tombstones/expiry, conflict
challenges, deletion/export/purge/reconciliation (fail-closed, FK-derived
order), restart/replay/failure/concurrency truthfulness — plus this audit's
in-sequence real-browser ceremony proof (proposal → pending indicator →
keyboard-only confirm → canonical record; stale-refusal `QLT_PROPOSAL_STALE`
with zero canonical effect; Escape/focus; fresh-conversation continuity;
responsive/axe; ZERO console warnings).

Committed real-use evidence validated STRUCTURALLY, never re-executed:
`q6-recovery-live.json` (SHA `6d515b11…`) records exactly 6 completed turns, 8
provider requests (all HTTP 200), zero findings, `refusedProviderRequests: 0`,
single tool `qlt_proposal_draft`, `fixtureRemoved` cleanup flag; the D4 Layer-A
sealed bundle's digests hold and `verify:d4-prep`'s by-design single red proves
the one-shot machinery refuses re-execution (N-D4-P-27/28 correctly skipped);
`d4-organic-use-record.json` (SHA `a3c5e009…`) carries 8 observations with
window minimums, authority, and privacy basis. No evidence file contains
credential-shaped or operator-identifying content.

## 9. Negative controls exercised (Determination 9)

This audit exercised, in its own runs: stale "07D in progress" status
re-insertion → detected; decision-register entry removal → detected; stale
`0.3.0` current-state prose re-insertion → detected; release-pin drift →
detected; evidence digest tampering → detected; absent constituent gate →
detected; L-4 byte change / added match / shifted line / different path → all
refused (gate controls) plus my own temp-copy probes (including removed-match
and same-content-different-path); separation self-scan → held (no live
provider, no one-shot harness, no browser gate, no `verify:quellight`, no
`.quellight-data`/`.pi/` reachable from the aggregate); the unreachable-registry
consumer control → held (fail-closed).

## 10. The authoritative ladder (contract §7) — every true result

Fresh fetch, clean tree `cfc6653`, fresh `npm ci`:

| Step                                                     | First result                                                                                                                                                                                                                                  | Final result                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. `npm ci`                                              | exit 0 (297 packages)                                                                                                                                                                                                                         | green                                                                              |
| 2. `verify:consumer`                                     | exit 0                                                                                                                                                                                                                                        | green (registry-only; N-2 control held)                                            |
| 3. `verify:quellight` run 1                              | **exit 1 — browser-ceremony-check failed** (Q6 fresh-conversation assistant wait, 45 s bound, in-composite load; all other internal steps green incl. the L-4-accepted scan and `git diff --check`)                                           | §8.2 disposition                                                                   |
| 3. `verify:quellight` run 2                              | **exit 1 — browser-ceremony-check failed** (Scenario-C post-reload pending-label wait; the amendment-3 fallback fired visibly, then the run failed for real; different step from run 1; all other internal steps green)                       | §8.2 disposition                                                                   |
| 3/§8.2. ceremony fresh rerun 1                           | exit 0 — FULL PASS, all steps green, zero console findings                                                                                                                                                                                    | permitted fresh run (not a silent rerun)                                           |
| 3/§8.2. ceremony fresh rerun 2                           | exit 0 — FULL PASS                                                                                                                                                                                                                            | permitted fresh run                                                                |
| 4. `verify:q6` / `verify:stage7c`                        | exit 0 / exit 0                                                                                                                                                                                                                               | 114 checks; N-C1..C25                                                              |
| 5. `verify:d1` / `d2` / `d3` / `dev-live` / `governance` | 0 / 0 / 0 / 0 / 0                                                                                                                                                                                                                             | 49 / 87 / 35 checks; operator-data untouchability confirmed (F1/F2)                |
| 6. `verify:stage7e`                                      | exit 0                                                                                                                                                                                                                                        | all sections green; ALL negative controls held; d4-prep exact by-design red (§8.1) |
| 7. `test:node` standalone                                | **356/357 — one test failed** (identity truncated by the auditor's output capture; consistent with the documented pre-existing tmpdir-count isolation race class, 07C stable-repin record; green in BOTH in-composite runs immediately prior) | disclosed fresh rerun: 30 files / 357 tests, exit 0                                |
| 7. `test:ui`                                             | exit 0 (20/20)                                                                                                                                                                                                                                | green                                                                              |
| 8. `npm run build`                                       | green inside both composites (closed-allowlist scan: 1 warning)                                                                                                                                                                               | standalone rerun optional per contract — not repeated                              |
| 9. `verify:browser-d2`                                   | exit 0                                                                                                                                                                                                                                        | axe clean 1280/390 px                                                              |
| 10. `npm audit --omit=dev` / `git diff --check`          | 0 vulnerabilities / clean                                                                                                                                                                                                                     | green                                                                              |
| 11. VICT fresh-fetch reconciliation                      | tip identity + §0.33 + content-ID match                                                                                                                                                                                                       | green                                                                              |

§8.2 protocol accounting: at least one fully green run of EVERY browser gate
(ceremony ×2 standalone; browser-check and browser-stop-check green inside both
composites); NO step failed in two or more independent fresh runs (the two
composite failures were at two different steps); every run — green or not — is
recorded above. The `test:node` first-run failure is disclosed per the
no-silent-rerun discipline with its permitted fresh rerun (see finding A-1).

## 11. Findings and dispositions

| ID  | Severity            | Finding                                                                                                                                                                                   | Disposition                                                                                                                                                                          |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-1 | Low                 | `test:node` first standalone audit run: 1 of 357 tests failed (documented pre-existing tmpdir-count isolation race class; disclosed rerun 357/357 green; green in both in-composite runs) | Recorded truthfully; disclosed rerun per the established precedent (07C stable-repin record); non-blocking; future harness work may close the class                                  |
| A-2 | Low (carried)       | Thread-restore force-close action-loss race (product; §6)                                                                                                                                 | Carried for future product work; non-blocking; no exit requirement violated                                                                                                          |
| A-3 | Low (carried)       | One-shot post-turn Memory-chip refresh gap (product; §6)                                                                                                                                  | Carried for future product work; non-blocking; no exit requirement violated                                                                                                          |
| A-4 | Low (documentation) | The preparation report's header cites "(amendment 1)" and its §1 ledger table predates the final four 07E commits                                                                         | Recorded here; the preparation report is preserved byte-for-byte per the preservation mandate; this audit report and the closure record supersede it as the current-state references |

No Blocking or High finding. No un-carried regression. No mis-stated carried
limitation (M-1, L-2, D4 attempt-2 disclosures, MSTR-012, and the Q7-era notes
were reconciled against their records; L-4 RESOLVED and L-5 REPAIRED as stated).

## 12. Verdict

**STAGE 07 VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED.**

Every E-1…E-6 requirement is evidenced by fresh independent derivation; the
authoritative ladder is green at every step except exactly the two documented
dispositions of contract §8; the L-4 exception behaves exactly per §6.1; the
L-5 protocol was executed within its frozen terms; the two product Low findings
can truthfully remain carried non-blocking debt.

Post-Stage-07 status: **Stages 07A–07E and Stage 07 are FORMALLY CLOSED.** No
numbered "Stage 08" exists or is begun: the canonical roadmap defines the work
after Stage 07 as the Quellight product roadmap (milestones Q2–Q5, Quellight-
led, re-entering VICT governance when VICT-side work is needed; VICT's own
Stage 8 is VICT-track). **The next Quellight increment requires a fresh owner
planning decision.**

— Independent Stage 07E exit auditor, 2026-09-24
