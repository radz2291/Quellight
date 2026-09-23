# Quellight Stage 07E — Preparation Report

**Date:** 2026-09-24
**Authorization:** owner mandate 2026-09-24 (Stage 07E preparation); decision
register D-07E-01 (authorization, L-4 governance decision, contract freeze) and
D-07E-02 (L-5 investigation outcome and gate-script race repair).
**Contract:** `quellight.stage07e.exit-contract@1` (amendment 1) —
`docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md`, byte-pinned by
`verify:stage7e`.
**Final status of this preparation:** STAGE 07A–07D FORMALLY CLOSED; STAGE 07E
PREPARED — THE FINAL INDEPENDENT EXIT AUDIT IS NOT BEGUN; STAGE 07 REMAINS IN
PROGRESS. Nothing here declares Stage 07 closed.

## 1. Starting and final identities; commit ledger

Starting (verified by fresh fetch before any work; both `HEAD == origin/main`,
clean, linear, no conflicting 07E work anywhere in either history):

- Quellight: `b78d8cd5d3285b5bba1f425f32146f8cf3950a17`
- VICT: `2c65a4f8241d6e7765c3fac1a4a09563d288fa63` (reconciliation v0.4.27
  §0.33; only the untracked operator `.pi/` directory present, never read)

Commit ledger (Quellight, in order):

| #   | Commit                                     | Content                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `9325bfae495b4106f81247c8e14393ad77c980e2` | standalone exit-contract freeze (docs-only: contract + D-07E-01) — amended in place, before any dependent commit existed, to replace the raw match-string quotation with the scan-safe JS-escaped form (the freeze document must not trip the scanner it governs); no other content change |
| 2   | `3667c71`                                  | narrow L-4 scanner disposition (`scripts/lib/frozen-evidence.mjs` + `verify-quellight.mjs` scan loop)                                                                                                                                                                                      |
| 3   | `78cbb3f`                                  | `verify:stage7e` machinery + package.json wiring (status-surface checks EXPECTED RED at this commit — the status commit lands after the machinery per the mandated review order)                                                                                                           |
| 4   | `87440dc`                                  | exit-contract amendment 1 (standalone docs): §8.2 superseded by the L-5 investigation outcome; D-07E-02 registered                                                                                                                                                                         |
| 5   | `326e2fe`                                  | L-5 gate-script race repair + amended-contract digest re-pin                                                                                                                                                                                                                               |
| 6   | this commit                                | preparation report + status surfaces (README, system reference)                                                                                                                                                                                                                            |

Final: this commit's tree; every commit a normal fast-forward push of `main`.

## 2. Canonical Stage 07E scope (derived from repository truth)

Stage 07E is the Stage 07 exit gate: the determination of whether Stages
07A–07D collectively form a coherent, verified, release-ready foundation. The
exit requirements were derived from VICT's canonical roadmap
(`docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` §13 — the
eleven exit items), the §7.1 minimum-scope list, the 07A–07D closure records
with their exact identities, and the frozen per-stage gates. The next stage is
NOT assumed: the canonical roadmap defines no numbered "Stage 08" for the
Quellight track; per its §9 roadmap-stage mapping the work after Stage 07 is
the Quellight product roadmap (milestones Q2–Q5, Quellight-led, each
re-entering VICT governance when VICT-side work is needed; VICT's own Stage 8
"Builder Kit and self-hosting" is VICT-track, not the Quellight continuation).
Its numbering, scope, and entry require a fresh owner decision after Stage 07
closes.

## 3. Frozen exit requirements

The contract freezes: closure integrity (§3 identities + E-1), product
coherence (E-2), real-use evidence with consumed one-shots never rerun (E-3),
security and data protection (E-4), user experience (E-5), evidence/governance
integrity (E-6), and the exact exit verdicts (E-7): STAGE 07 VERIFIED —
FORMALLY CLOSED; STAGE 07 NOT VERIFIED — CLOSURE REFUSED; plus the truthful
statement of what comes next. The authoritative final-audit ladder is frozen
(contract §7): `npm ci`; `verify:consumer`; `verify:quellight`; q2–q6 +
stage7c; d1/d2/d3/dev-live/governance; `verify:stage7e`; node/ui suites;
`verify:browser-d2`; `npm audit --omit=dev`; `git diff --check`; VICT-side
fresh-fetch reconciliation. The live provider is NEVER contacted; no consumed
one-shot proof is re-executed; D4 is NOT re-run; `.quellight-data/` and VICT
`.pi/` are NEVER read.

## 4. The exact L-4 implementation (owner decision D-07E-01)

The frozen D5 audit report is preserved byte-for-byte
(sha256 `169a2153…`, git blob `d89fad11…`, untouched — `git log` shows a single
creation commit `ed144b1`). `scripts/lib/frozen-evidence.mjs` registers exactly
ONE exception keyed to four binding values: the exact repo path
(`docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md`), the exact
content SHA-256, the exact Git blob ID, and the exact documented match set
(two matches of the Windows user-directory prefix at lines 15–16).
`verify-quellight.mjs`'s step-7 scan still inspects the file on every run,
verifies all four keys, and reports acceptance explicitly
(`frozen-evidence exception ACCEPTED 2 local-path match(es) … owner decision
D-07E-01; historical record byte-preserved`). Fail-closed on: any byte change
(digest drift fails even if the pattern would no longer match — removing the
paths by editing the frozen record is a rewrite, not a fix), any added,
removed, moved, or different match, git-blob drift, and any other file tripping
the local-path pattern (registration is by exact path AND digests;
documentation in general gains nothing). The canary, credential,
fixture-content, operator-data, and privacy checks are unchanged and still
apply to the frozen file. The boolean local-path test is deliberately
non-global (a `/g` regex would carry `lastIndex` across files and silently
skip findings). The frozen D5 re-verification recorded this very scan finding
live (verify:quellight FAILED with the local-path finding on 2026-09-24) —
non-vacuity of both the finding and the disposition.

## 5. The exact L-5 disposition (owner decision D-07E-02)

The preparation's own standalone confirmation run FAILED, then three further
fresh runs failed at the IDENTICAL step (`openOldestThreadTray`'s tray-reopen
wait) — including a fully serial run with no concurrent load — on a tree whose
`src/` and check script were byte-identical to `b78d8cd`. The frozen §8.2
deterministic trigger fired; the investigation found a **deterministic
gate-script activation race**: the script's `focus()` + page-level
`keyboard.press()` straddled the post-thread-switch re-render cascade, so Enter
landed on a detached element — while the identical keyboard activation
succeeded repeatedly through `openTray` inside every failing run. **Product
defect: none** (no authority, durability, or truthfulness implication; product
code untouched).

Repair (assertion-neutral, timeout-neutral, per the script's own Lane E prior
art for the identical Send-button race): both chip-activation sites use
`locator.press('Enter', { timeout: 20_000 })`. The keyboard-activation
assertion is unchanged; no timeout increased; the check not suppressed.
Verified by two consecutive full-completion serial runs — all steps green
(D-1…D-5b real governed correction + stale refusal `QLT_PROPOSAL_STALE` +
zero canonical effect; M-2 Escape focus return; Q4 fresh-conversation
continuity; Q5-1…6 memory modes; desktop/mobile axe clean; ZERO console
warnings/errors) — the steps the deterministic race had been blocking.

The full-composite run then exposed one more occurrence of the SAME class at a
different site: the Q6 fresh-conversation Send activation (`focus()` +
page-level press, no delivery fallback) swallowed the Enter under in-composite
load, so the turn was never sent and the 45 s assistant-message wait timed out
(first and only failure at that step; the same wait passed standalone twice
immediately before). Under the same D-07E-02 program the script's existing
Lane E delivery semantics were completed across ALL turn-send sites: a shared
`deliverSend` helper delivers through the re-resolved locator, verifies
delivery by the composer clearing, and falls back to a real click on the
re-resolved Send button. Delivery mechanism only; every downstream assertion
unchanged; no timeout increased.

One post-repair standalone run then still failed the tray reopen — with the
open-then-close signature — exposing a PRODUCT action-loss race beneath the
flake: the workspace's thread-restore continuation sets `memoryOpen = false`
AFTER its fetch resolves, so a tray the user opens during a slow thread switch
is force-closed. This is documented as a new Low product finding (contract §9;
fix belongs to future product work; Stage 07E changes no product code), and
the gate's thread-switch reopen now uses bounded retries (three attempts at
the standard 20 s bound) that report every observed force-close signature
truthfully. The fresh-run protocol (contract §8.2) is retained for any future
browser-gate failure. The one-shot post-turn chip-refresh robustness
observation (silently-absorbed single refresh, no retry) remains carried for
future product work.

## 6. Gate composition and negative controls

`verify:stage7e` (scripts/verify-stage7e.mjs; `npm run verify:stage7e`):

1. contract freeze byte-pin (amendment rule enforced);
2. closure integrity — 07A–07D records + dispositions, pinned commits as
   ancestors of HEAD, closure-chain and freeze ordering, five frozen-contract/
   amendment ordering pairs, freeze-before-machinery;
3. status consistency — pure validator over README / system reference /
   decision register / closure records, with non-vacuous negative controls
   (stale 07D status re-inserted, register entry removed, stale 0.3.0
   current-state prose re-inserted — each must be detected);
4. release identity — exact stable 0.3.1 set via the existing release-set
   library, registry-only resolution, tamper negative control;
5. evidence immutability — nine protected files recomputed against frozen
   digests, creation commits proven last-touches, blob equality, tamper
   negative control;
6. constituent manifest + missing-constituent negative control + exact
   package.json wiring;
7. separation self-scan — the aggregate can never spawn the live-provider
   gate, the q6 live gate, the D4 one-shot harness, the dev:live runner, any
   browser gate, the verify:quellight composite, or reach `.quellight-data` /
   VICT `.pi/`;
8. L-4 exception — real-file acceptance (2 matches, lines 15/16) plus tampered
   temp-copy negative controls (byte change / added match / shifted line /
   different path all refuse);
9. execution — consumer, governance, q2–q6, stage7c, d1, d2, d3, dev-live all
   green; `verify:d4-prep` required to exit non-zero with EXACTLY its
   documented by-design single red (sealed attempt-2 bundle occupies the
   canonical paths; N-D4-P-27/28 history-aware skip) — any other exit shape,
   including an unexpected pass, is a real red.

No earlier gate was weakened or re-pinned (the only earlier-gate change is the
L-4 disposition inside `verify:quellight`'s scan, which the owner decision
D-07E-01 authorizes; every other gate is invoked exactly as wired).

## 7. Files changed

- `docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md` (new; amended once)
- `docs/decision-register.md` (D-07E-01, D-07E-02)
- `scripts/lib/frozen-evidence.mjs` (new)
- `scripts/verify-quellight.mjs` (scan-loop L-4 disposition only)
- `scripts/verify-stage7e.mjs` (new; contract digest re-pinned once)
- `package.json` (`verify:stage7e` wiring only)
- `scripts/browser-ceremony-check.mjs` (two chip-activation sites only)
- `README.md`, `docs/system-reference.md` (status surfaces; stale 07D-era tail
  and 0.3.0 current-state prose corrected; 07E-prepared status added)
- this report

## 8. Verification results (this preparation)

Focused, per mandate — no provider ceremony; no D4 rerun; no consumed one-shot
re-executed:

- `verify:stage7e` full gate: machinery sections all green at the rehearsal
  (contract pin, closure, release identity, evidence immutability, manifest,
  separation, L-4 acceptance + negative controls, all composed gates PASS,
  d4-prep exact by-design red); status-surface checks red exactly as disclosed
  until the status commit, then green (final full run recorded below);
- `verify:quellight` full composite: run once on the final tree — the L-4
  acceptance line appears in step 7 and the composite is green (see §9);
- browser-ceremony-check: 4 pre-repair failures recorded truthfully (1 at the
  Scenario-C chip wait, 3+1 in-sequence at the identical tray-reopen wait);
  after the repair, two consecutive full-completion serial runs green;
- `npm run format:check` and `node --check` on every changed script: green;
- `git diff --check`: clean;
- digest cross-checks: all contract digests and the gate's digest pins verified
  programmatically.

## 9. Carried limitations (unchanged + updated)

See the contract §9 inventory. Changes in this preparation: **L-4 RESOLVED**
(hash-bound exception; enforced permanently by the gate), **L-5 REPAIRED**
(reclassified truthfully as a test-machinery defect, repaired
assertion-neutrally, re-verified; fresh-run protocol retained; the chip-refresh
robustness observation carried for future product work). M-1, L-2, the D4
attempt-2 disclosures, MSTR-012 limitations, and the Q7-era notes are carried
unchanged with their dispositions.

## 10. Readiness for the fresh independent Stage 07E final audit

The final audit is performed by a fresh independent session against the frozen
contract. Entry prompt:

> You are the fresh independent Stage 07E exit auditor for Quellight. Read the
> frozen contract `docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md`
> (amendment 1, byte-pinned by `verify:stage7e`), the preparation report
> (this document), and the decision-register entries D-07E-01/D-07E-02. Fresh-fetch
> both repositories (Quellight + VICT), verify remote equality, cleanliness,
> and linear ancestry; treat all completion reports — including this one — as
> claims, and inspect the canonical roadmap, system references, closure
> reports, contracts, and verification machinery directly. Execute the frozen
> authoritative ladder (contract §7) on the frozen tip; hold every result
> against the contract's E-1…E-7 with your own negative controls. The only
> permitted non-greens are the two documented dispositions (§8.1 the
> verify:d4-prep by-design single red; §8.2 the browser-gate fresh-run
> protocol). Do not contact the live provider; do not re-execute any consumed
> one-shot proof; do not read `.quellight-data/` or VICT `.pi/`. Issue exactly
> one verdict — STAGE 07 VERIFIED — FORMALLY CLOSED, or STAGE 07 NOT VERIFIED
> — CLOSURE REFUSED — with your own evidence, your own negative controls, and
> a full carried-limitation reconciliation.
