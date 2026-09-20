# Quellight Stage 07C — Phase Q5 — B-1/H-1 Remediation Record

> **Class:** Remediation record. This document records the executable
> remediation of the Phase Q5 independent audit findings **Q5-B-1**
> (Blocking), **Q5-H-1** (High), and **Q5-M-1** (Medium) exactly as frozen
> in `QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-CONTRACT.md`.
> Nothing else was remediated. The prior independent audit report and all
> frozen contracts and historical reports are preserved byte-for-byte.
> **Naming discipline:** Q5-B-1 / Q5-H-1 / Q5-M-1 are the findings
> remediated here. The older carried **VICT-M-1** (VICT effect-class
> correction + Quellight repin) is a DIFFERENT finding and remains OPEN,
> unchanged, with its hard deadline before the Phase Q6 live-provider
> proof; it was NOT repaired or altered by this remediation.

## 0. Post-remediation evidence correction (documentation-only)

Added after the remediation completion, before fresh independent
re-verification, by the documentation-only evidence-normalization
commits (`fabaf2c…` — mechanical formatter normalization of the audit
report — and the evidence-reconciliation commit carrying this section).
No executable code, test, script, contract, schema, dependency, or
product behavior changed. The historical command results recorded in
the sections below are preserved exactly as they occurred; the four
corrections here reconcile evidence claims, not results:

1. **Git-derived file inventory** (supersedes the completion response's
   ten-file summary): the complete span
   `e80fe08c409020e5261ca9faa31400da3e028b04..aef57676d0667e76d59f78416dde572dd7e93e39`
   — four commits (`c873692…` contract, `53831fd…` implementation,
   `e56952d…` tests, `aef5767…` documentation) — contains EXACTLY
   **14 files, +1606, −155** by `git diff --numstat`: 1
   remediation-contract file, 4 production files, 5 test/verifier
   files, and 4 documentation/status files including this report. The
   exact per-file inventory is recorded in §9.
2. **Browser-ceremony wording**: the four disclosed runs stand, with
   truthful uncertainty — the first two runs crashed at different,
   unchanged flow points; the exact cause was not conclusively
   established; neither crash demonstrated failure of the new H-1
   assertion; the two subsequent consecutive runs passed, including the
   new assertion. The fresh independent re-verification must judge its
   own first authoritative ceremony result without relying on those
   reruns. §6 corrected accordingly.
3. **Operator-data wording precision**: the remediation compared
   `.quellight-data` filesystem metadata before and after the runs, so
   the accurate statement is: the operator database content was never
   opened, queried, copied, migrated, altered, or deleted; filesystem
   metadata was observed only to confirm that the path remained
   unchanged. §§7–8 corrected accordingly, and the decision register
   corrected additively.
4. **Formatting result reconciliation**: the `format:check` FAILURE
   recorded in §6 remains the historical fact of the remediation
   session. The dedicated documentation-only commit `fabaf2c…`
   (`style(audit): normalize Q5 verification report`) later mechanically
   normalized the audit report with the repository formatter —
   formatting only; every finding, severity, number, SHA, command
   result, conclusion, and status preserved (proof: whitespace- and
   table-padding-collapsed token streams of the original and formatted
   report are byte-equal; the original remains in Git at `e80fe08…`) —
   restoring repository-wide `format:check` compliance before
   re-verification.

## 1. Chain of custody and exact SHAs

| Item                                                          | Value                                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Starting Quellight `HEAD == origin/main`                      | `e80fe08c409020e5261ca9faa31400da3e028b04` (verified; descendant of the audited tree `d61532d…` by exactly the audit-report commit) |
| Starting VICT `HEAD == origin/main`                           | `4b9fed21430787a72eda76b1b72d448f234f05fa` (READ-ONLY throughout; untouched)                                                        |
| Remediation contract (committed ALONE, before implementation) | `c873692854d1c52be45c78cf016f417649e39544` — `docs(stage-07c): freeze Q5 audit remediation contract`                                |
| Implementation commit (Lanes A/B)                             | `53831fda6b0128cdb3cdf2581a190dd43f496ab3` — `fix(stage-07c): restore inspection read purity and truthful current bucket`           |
| Test commit (Lane D)                                          | `e56952dc16629e32310f2f93000694a63b015844` — `test(stage-07c): lock Q5 audit regressions`                                           |
| Documentation commit (this record + status docs)              | this commit                                                                                                                         |
| Final remote `HEAD == origin/main`                            | the documentation commit (pushed as a normal fast-forward after a fresh fetch; no history rewrite)                                  |

Commits follow the four-commit plan frozen in the remediation contract §8.
No conflicting remediation, Q5-closure, or Q6 work existed on either remote
at start; none was created.

## 2. Q5-B-1 (Blocking) — read purity: reproduction and correction

**Reproduction** (negative control at the audited SHA `d61532d…`, isolated
disposable worktree + disposable OS-temp store, through the REAL released
boundary — `act.queryInspection` `getPolicy` exactly as the Memory UI
issues it): on a freshly migrated store whose `qlt_memory_policy` table
was empty (0 rows), one `getPolicy` query created the singleton default
row (0 → 1 row; unchanged after repeats). The probe's remediated-behavior
expectation failed: `expected 1 to be +0`. **B-1 reproduced.**

**Correction** (commit `53831fd…`):

- `memory-policy.ts` — read resolution and write-path establishment are
  now SEPARATE store methods whose names communicate their effect:
  - `peekCurrent(): QltResolvedMemoryPolicy` — PURE read (SELECT only);
    on an absent row it resolves the frozen implicit default IN MEMORY
    (mode `across-conversations`, revision 1, policy id
    `qlt.memory-mode@1`): zero INSERT, zero UPDATE, zero schema change,
    zero bookkeeping change.
  - `peekPolicyRow(): QltMemoryPolicyRow | undefined` — PURE read;
    `undefined` while the default is implicit.
  - `ensureCurrent(): QltResolvedMemoryPolicy` — WRITE-PATH resolution
    that establishes the durable default row; legitimate ONLY on turn
    admission (inside the existing per-conversation critical section —
    audit Observation O-2 preserved).
  - The read-sounding methods `resolveCurrent()` / `getPolicyRow()` (the
    B-1 defect: both silently inserted the row) NO LONGER EXIST.
- `composition.ts` — the inspection surface's `getPolicy` dep now PEEKS;
  turn admission now uses `ensureCurrent()` (write path unchanged in
  effect); `setMode` keeps its transactional seeding (unchanged).
- `inspection-surface.ts` — the `getPolicy` op remains a pure read and
  forwards the truthful representation.

**Corrected behavior on a fresh store:** `getPolicy` → truthful implicit
default → zero INSERT, zero UPDATE, zero schema change, zero bookkeeping
change; repeated calls deterministically identical with continued zero
effect; opening or refreshing Memory changes no durable byte/row state.
The first effective change still transitions truthfully from revision 1
to revision 2; same-value retries and conflicting-idempotency behavior
are unchanged; restart behavior remains truthful whether the default is
still implicit or durable; per-turn evidence, assembler, injection,
fingerprints, and historical-turn behavior are unchanged.

## 3. Implicit versus durable default response semantics

The `getPolicy` inspection response keeps its frozen fields (policy id,
mode, revision, updatedAt) and gains the smallest truthful representation
for the implicit, not-yet-persisted default (remediation contract §2):

| State                                             | `mode`                 | `revision`       | `updatedAtMs`    | `persisted` |
| ------------------------------------------------- | ---------------------- | ---------------- | ---------------- | ----------- |
| Implicit default (no durable row yet)             | `across-conversations` | 1                | `null`           | `false`     |
| Durable default (row established by a write path) | durable mode           | durable revision | durable epoch ms | `true`      |

No timestamp is fabricated and no persisted-row claim is made while the
default is implicit. Compatibility is preserved for every consumer that
reads `policyId`, `mode`, `revision` (the Memory UI reads only the mode).

**Legitimate write-path seeding behavior** (unchanged in effect):
`ensureCurrent` at turn admission seeds the row inside the existing
per-conversation critical section; `act.setMemoryMode` seeds inside its
one transaction (an effective first change lands at revision 2; a
same-as-default set on an absent row creates the ONE legitimate default
row at revision 1 without a false bump). Reads never establish the row.

## 4. Q5-H-1 (High) — truthful buckets: reproduction and correction

**Reproduction** (negative control at the audited SHA, the EXACT UI query
shape — `listRecords bucket:'current'` with no threadId and no kind
filter, through the real boundary, on a store containing one
user-confirmed proposal plus three canonical current records): Current
returned `["claim:active", "proposal:confirmed", "open_loop:open",
"commitment:active", "claim:active"]` — the terminal proposal rendered in
Current and the total was inflated (5 vs 4 canonical). **H-1 reproduced.**

**Correction** (commit `53831fd…`, `sqlite.ts`
`listInspectionRecords`): explicit bucket branching with NO fallback
branch — proposal rows are queried ONLY for `pending` and `history`;
family rows (claims/commitments/open loops) are queried ONLY for
`current` and `history`. Corrected bucket matrix (all proven through the
exact UI query shape on the non-vacuous fixture below):

| Bucket    | Old (audited) contents                                            | Corrected contents                                       |
| --------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `pending` | proposed/awaiting proposals PLUS non-current family rows (leaked) | ONLY proposed/awaiting proposals                         |
| `current` | canonical records PLUS terminal proposals (total inflated)        | ONLY canonical current-effective records; zero proposals |
| `history` | terminal proposals + non-current records                          | unchanged (terminal proposals plus non-current records)  |

Corrected-fixture totals: pending 3 (2 proposed + 1 awaiting_decision —
the amendment creates a new proposed amendment); current 6 (claim,
confirmed-proposal's canonical claim, commitment, open loop, correction
successor, other-thread claim); history 7 (4 terminal proposals +
superseded claim + released commitment + abandoned loop). Kind and thread
filters stay truthful and can never reintroduce a proposal into Current;
pagination total/offset/limit and the deterministic
`updatedAt DESC, id ASC` ordering are correct; empty buckets remain
truthful; no assembler or canonical-record semantics changed.

**After-confirm display control** (existing browser ceremony session
extended; no second browser boot): after the keyboard confirm, the
ceremony now additionally asserts the Current area holds ZERO
`proposal`-kind items of any status and EXACTLY ONE item in total (the
canonical record — no duplicate-looking memory item), alongside the
existing assertions that the canonical record is in Current and the
confirmed proposal in History. Verified green in the ceremony run
(`Q5-H-1: Current holds ONLY the canonical record — zero proposals, no
duplicate item`).

## 5. Q5-M-1 (Medium) — permanent non-vacuous coverage

The audit's vacuous controls (C-19 output-comparison around reads; C-01
with no decided proposals) are replaced by permanent, discriminating
controls (commit `e56952d…`):

1. **Read-purity control (real boundary)** —
   `test/memory-authority.test.ts` `C-19 (Q5-M-1/Q5-B-1)`: freshly
   composed app; complete durable row-state snapshot of the shared-world
   db via a read-only raw connection (ALL user tables, fully ordered);
   `getPolicy` through `act.queryInspection` (real released boundary);
   response asserted to be the truthful implicit default (`persisted:
false`, `updatedAtMs: null`, `across-conversations`, revision 1);
   second complete snapshot identical; repeat — deterministic identity,
   continued zero effect; then `act.setMemoryMode` through the real
   boundary — EXACTLY ONE `qlt_memory_policy` row at revision 2, and
   further reads remain pure. Not output comparison: the durable rows
   themselves.
2. **Bucket-composition control (real boundary)** —
   `test/memory-authority.test.ts` `C-01 (Q5-M-1/Q5-H-1)`: non-vacuous
   fixture with proposed, awaiting_decision, confirmed, rejected,
   amended, and withdrawn proposals (confirmed via the REAL
   `act.confirmProposal` boundary), current claim/commitment/open loop,
   a superseded claim (correction successor), a released commitment, an
   abandoned loop, and a second thread. Exact UI query shape (no filters)
   proves the full corrected bucket matrix, deterministic duplicate-free
   pagination (limit-2 walk), kind-filter and thread-filter negatives.
3. **Store-level mirrors in `verify:q5`** — section 5 now dumps complete
   durable row state around pure reads on a freshly migrated store
   (implicit default; zero effect; deterministic repeat;
   `ensureCurrent` creates exactly one row; reads stay pure; same-value
   seeding without false bump), and section 6 gained the non-vacuous
   bucket-composition block. `verify:q5` = 86 checks green; it alone
   detects Q5-B-1/Q5-H-1 regressions.
4. **Browser display control** — the extended existing ceremony session
   (see §4).
5. `test/memory-policy.test.ts` — the old seeding expectations (which
   asserted the B-1 behavior as correct) are rewritten to the truthful
   semantics (pure peek; one-row ensure; truthful first-change revision
   2; same-value seeding without false bump).

**Discriminating negative control:** the new permanent tests run against
the audited SHA (in the disposable worktree) fail with 12 failing tests —
including real assertion failures of the new coverage (old Pending
bucket: `expected 6 to be 3`; old getPolicy shape: missing `persisted`),
not merely API-absence errors.

## 6. Targeted verification (focused; full ladder deliberately NOT run)

| Check                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                              | **FAILED — pre-existing, disclosed**: prettier flags ONLY `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-INDEPENDENT-VERIFICATION.md` (its chain-of-custody table alignment). Proven pre-existing at the starting SHA (fails with the remediation files stashed). The audit report is preserved byte-for-byte per the mandate; fixing it is forbidden. All files touched by this remediation are prettier-clean (verified per-file). Subsequent normalization: the dedicated documentation-only commit `fabaf2c…` (`style(audit): normalize Q5 verification report`) later mechanically normalized the audit report with the repository formatter — formatting only; every finding, severity, number, SHA, command result, conclusion, and status preserved (whitespace- and table-padding-collapsed token streams byte-equal) — restoring repository-wide `format:check` compliance before re-verification. The FAILED result in this row remains the historical record of the remediation session. |
| `npm run typecheck`                                                 | PASS (`svelte-kit sync && tsc --noEmit`, exit 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run verify:q5`                                                 | PASS — 86 checks green (was 43 sections-passing at the audited tree; the +43 include the Q5-B-1/Q5-H-1 controls)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run test:node` (full)                                          | PASS — 17 files / 242 tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| focused: `test:node` Q5 suites                                      | PASS — memory-policy 16, memory-authority 15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:ui -- memory-inbox`                                   | PASS — 14 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build`                                                     | PASS (exit 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `git diff --check`                                                  | PASS (exit 0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run verify:browser-ceremony` (script changed → rerun required) | Run 1 (fixed tree): **FAILED** — crash at Scenario B `waitForFunction` timeout, AFTER the Q5-H-1 assertion passed. Run 2 (fixed tree): **FAILED** — crash at `openTray 'current'` (element detached repeatedly), BEFORE the Q5-H-1 block runs. The two runs crashed at different, unchanged flow points; the exact cause was not conclusively established; neither crash demonstrated failure of the new H-1 assertion. Run on the audited tree (original script, original code): PASS green. Runs 3 and 4 (fixed tree): **PASS green consecutively, including the new Q5-H-1 assertion.** No assertion was weakened; no rerun hid a failure; every run is disclosed here. The fresh independent re-verification must judge its own first authoritative ceremony result without relying on these reruns.                                                                                                                                                                                        |

The complete Q2–Q5 aggregate ladder was NOT run (per the remediation
mandate); the fresh independent re-verification will run the
authoritative full sequence once on the remediated tree.

## 7. Preservation evidence

- The three Memory Modes, global mode semantics, per-turn binding,
  migration 4 schema, policy revision rules, context assembly/injection,
  Q4-AMEND-1, the future project-scope seam, lifecycle behavior, the L-3
  repair: UNTOUCHED (`git diff e80fe08..HEAD` touches exactly the
  fourteen files listed in §9, Git-derived; see §0; none of the frozen
  contract modules changed).
- Agent envelope unchanged: `verify:q5` section 4 (29 inventory checks)
  proves exactly 21 actions, empty capability bindings, no inspection/
  mode capability — the envelope remains EXACTLY `qlt.proposal.draft@1`.
- VICT packages/source, package pins, and `package-lock.json`: untouched.
- Historical reports, the prior audit report, and every frozen contract:
  byte-for-byte preserved.
- Real user data: the real `.quellight-data` directory metadata
  (existence, sizes, mtimes of every contained file) captured BEFORE any
  probe/test run and compared after ALL runs — byte-identical. Precise
  statement (§0 normalization): the operator database content was never
  opened, queried, copied, migrated, altered, or deleted; filesystem
  metadata was observed only to confirm that the path remained
  unchanged. Every probe, test, ceremony, and
  composition run used explicit disposable task-owned OS-temp stores
  (verified: full composition boots write only `<tempdir>/data/*`).

## 8. Negative controls (all external, disposable, removed)

| Control                                                                            | Result                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q5-B-1 reproduction at audited SHA `d61532d…` (disposable worktree; real boundary) | **REPRODUCED** — policy rows 0 → 1 after one `getPolicy`; probe failed on `expected 1 to be +0`                                                                                                                               |
| Q5-H-1 reproduction at audited SHA (exact UI query, decided proposal present)      | **REPRODUCED** — Current contained `proposal:confirmed`, total 5 vs canonical 4                                                                                                                                               |
| Same probes on the fixed tree                                                      | PASS — B-1 not reproduced (0 rows after reads, `persisted:false`); H-1 not reproduced (Current = 4 canonical rows, zero proposals)                                                                                            |
| New permanent tests against the audited SHA                                        | **FAIL (discriminating)** — 12 of 31 fail, including genuine behavioral assertion failures of the old buckets/shape                                                                                                           |
| Real `.quellight-data` untouched (precise statement; §0)                           | PROVEN — the operator database content was never opened, queried, copied, migrated, altered, or deleted; filesystem metadata was observed only to confirm that the path remained unchanged (identical before/after every run) |

## 9. Files changed (Git-derived inventory; corrected by §0)

The authoritative record is the exact
`git diff --numstat e80fe08c409020e5261ca9faa31400da3e028b04..aef57676d0667e76d59f78416dde572dd7e93e39`
over the four commits `c873692…` (contract), `53831fd…`
(implementation), `e56952d…` (tests), `aef5767…` (documentation) —
**14 files, +1606, −155** (supersedes the earlier ten-file summary;
§0 correction 1):

| Class                                  | File                                                                     | Added    | Deleted |
| -------------------------------------- | ------------------------------------------------------------------------ | -------- | ------- |
| Remediation contract (committed ALONE) | `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-CONTRACT.md` | 186      | 0       |
| Production (Lanes A/B)                 | `src/lib/sharedworld/memory-policy.ts`                                   | 55       | 13      |
| Production (Lanes A/B)                 | `src/lib/server/composition.ts`                                          | 29       | 3       |
| Production (Lanes A/B)                 | `src/lib/sharedworld/sqlite.ts`                                          | 83       | 70      |
| Production (Lanes A/B)                 | `src/lib/sharedworld/inspection-surface.ts`                              | 11       | 2       |
| Test/verifier (Lane D)                 | `test/memory-authority.test.ts`                                          | 389      | 23      |
| Test/verifier (Lane D)                 | `test/memory-policy.test.ts`                                             | 119      | 22      |
| Test/verifier (Lane D)                 | `scripts/verify-q5.mjs`                                                  | 364      | 17      |
| Test/verifier (Lane D)                 | `scripts/browser-ceremony-check.mjs`                                     | 14       | 0       |
| Test/verifier (Lane D)                 | `test/ui/memory-inbox.test.ts`                                           | 3        | 0       |
| Documentation/status                   | `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md`          | 292      | 0       |
| Documentation/status                   | `docs/decision-register.md`                                              | 36       | 0       |
| Documentation/status                   | `docs/system-reference.md`                                               | 23       | 3       |
| Documentation/status                   | `README.md`                                                              | 2        | 2       |
| **Total**                              | **14 files**                                                             | **1606** | **155** |

Per-commit narrative: the implementation commit `53831fd…` carried ONLY
the four production files (pure peek methods; write-path ensure; the
`getPolicy` dep peeking with the truthful implicit representation;
explicit bucket branching, no fallback); the test commit `e56952d…`
carried ONLY the five test/verifier files (real-boundary read-purity
and bucket-composition controls with C-01/C-19 rewritten non-vacuous,
the Q5-B-1/Q5-H-1 verifier controls at 86 checks, the after-confirm
Current-truthfulness ceremony assertions, and the `persisted: true`
getPolicy-stub shape fix); the documentation commit `aef5767…` carried
this report and the current status lines in `README.md`,
`docs/system-reference.md`, and `docs/decision-register.md`.

## 10. FastGate feedback

- Three responsibilities were kept separate by frozen lane ownership
  (contract §6) and by the four-commit plan: contract `c873692…` (alone),
  implementation `53831fd…` (4 production files), tests `e56952d…` (5
  test/verifier files), documentation (3 status docs + this record).
- Parallel isolated-worktree execution via the subagent runner was
  ATTEMPTED and failed twice for infrastructure reasons (async runner
  process died before any work existed; a second run produced two
  excellent test files in ~10 minutes but then corrupted its own edit on
  `scripts/verify-q5.mjs` — the corrupted edit never landed and was
  verified absent; the two test files it left were reviewed line-by-line,
  validated, and adopted). The remaining Lane D work was completed by the
  controller under the same frozen lane ownership, and both subagent
  failures are disclosed here. Production code was written by the
  implementation owner only; no test-side code entered production files
  and vice versa.
- One correction during reconciliation: the kind-filtered current-claim
  count in the verify:q5 bucket block was fixed from an incorrect 3 to
  the correct 4 (miscount; caught by the verifier's own failure).

## 11. Cleanup

- Disposable audited-SHA worktree (`%TEMP%/q5-audited-wt`, node_modules,
  build) and its git worktree registration: removed/pruned.
- Probe scripts and their temp stores: OS-temp only; removed.
- Main tree: clean tracked state at the documentation commit; no probe
  or fixture residue; `git worktree list` shows only the main tree.

## 12. Readiness for fresh independent re-verification

The remediated tree is clean, typed, built, and green on every runnable
focused gate (see §6), with the disclosed pre-existing format drift in
the preserved audit report being the only red check. Q5 remains
IMPLEMENTED — AWAITING REMEDIATION / RE-VERIFICATION: **not Verified and
not formally closed**. VICT-M-1 remains open before the Phase Q6
live-provider proof. No Q6 work exists anywhere. The fresh independent
re-verification may run the authoritative full sequence once on this
tree.
