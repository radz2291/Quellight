# Quellight Stage 07C — Phase Q5 — B-1/H-1 Remediation — Independent Re-Verification

> **Class:** Independent re-verification record (audit). This document is
> the ONLY file created during verification. No source, test, script,
> package file, frozen contract, current documentation, or historical
> report was modified. VICT was treated as read-only (its System Reference
> is reconciled only AFTER formal closure, per the mandate).

## 0. Verdict

```text
VERIFIED WITH NON-BLOCKING ISSUES — Q5 FORMAL CLOSURE PERMITTED
0 Blocking ............................................... 0
High ..................................................... 0
Medium ................................................... 0
Low ...................................................... 2 (carried L-1, L-2 — no new Low findings)
New findings requiring remediation ....................... 0
Observations carried ..................................... O-1..O-5 dispositions unchanged
PHASE Q5 FORMAL CLOSURE IS PERMITTED
Q5-B-1: CLOSED — Q5-H-1: CLOSED — Q5-M-1: CLOSED
L-1 / L-2: REMAIN CARRIED — VICT-M-1: REMAINS OPEN (outside this remediation)
```

All executable defects of the Phase Q5 independent audit (B-1, H-1) are
independently proven remediated, the M-1 vacuous-coverage finding is
proven remediated with discriminating permanent controls, the audited
executable tree is unchanged, and the authoritative ladder ran green
exactly once with no rerun.

## 1. Chain of custody (independently established)

| Item                            | Value                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fetch                           | both remotes fetched FIRST; nothing advanced by the fetch                                                                                                                                                                                  |
| Quellight `HEAD == origin/main` | `73ca1cb5ebd8e9216025dba435ce99c2a9230359` (verified)                                                                                                                                                                                      |
| VICT `HEAD == origin/main`      | `4b9fed21430787a72eda76b1b72d448f234f05fa` (verified; READ-ONLY; pre-existing untracked `.pi/` untouched and unread)                                                                                                                       |
| Quellight tracked tree          | clean before, during, and after verification (`git status --porcelain` empty; HEAD unchanged throughout)                                                                                                                                   |
| Conflicting work                | none: no Q5 formal-closure report existed, no Q6 contract/implementation work exists on either remote (single-branch linear histories)                                                                                                     |
| Applicable AGENTS.md            | none exists in either repository (re-verified by search)                                                                                                                                                                                   |
| Remediation span                | `e80fe08..aef5767` = exactly 4 commits (`c873692` contract → `53831fd` production → `e56952d` tests → `aef5767` documentation), linearly ancestral, then `fabaf2c` (style-only) and `73ca1cb` (documentation-only evidence reconciliation) |

## 2. History and boundedness (audit area 1) — proven

- **Contract committed ALONE before executable changes**: `c873692`
  carries exactly one file (the remediation contract, +186/−0) and
  precedes `53831fd` in ancestry.
- **Production / independent-test ownership separation held**: `53831fd`
  (implementation, Lanes A/B) carries ONLY the four declared production
  files (`src/lib/sharedworld/memory-policy.ts`,
  `src/lib/sharedworld/sqlite.ts`, `src/lib/server/composition.ts`,
  `src/lib/sharedworld/inspection-surface.ts`); `e56952d` (Lane D, committed
  AFTER production) carries ONLY the five test/verifier files
  (`test/memory-authority.test.ts`, `test/memory-policy.test.ts`,
  `scripts/verify-q5.mjs`, `scripts/browser-ceremony-check.mjs`,
  `test/ui/memory-inbox.test.ts`). No test-side code entered production
  files and vice versa.
- **No frozen contract silently changed**: `git diff d61532d..HEAD` over
  `src/lib/sharedworld/contracts/` and every frozen contract module is
  EMPTY; Q4-AMEND-1 content untouched; migration files untouched.
- **Evidence normalization scope**: `73ca1cb` changed exactly the two
  declared Markdown files (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md`,
  `docs/decision-register.md`); `fabaf2c` changed exactly the audit
  report (+45/−45).
- **Style commit is formatting-only** (independently proven): the
  whitespace-collapsed token streams of the audit report at `e80fe08` and
  at `fabaf2c` are byte-identical (identical MD5 computed by this audit);
  every finding, severity, number, SHA, command result, and conclusion
  preserved.
- **Boundedness**: `git diff --numstat e80fe08..aef5767` = EXACTLY
  **14 files, +1606/−155** (1 contract, 4 production, 5 test/verifier,
  4 documentation), matching the remediation record §9 line-by-line.
  The full span `d61532d..HEAD` adds ONLY the audit-report normalization
  (1 file, +45/−45) and the two-file evidence reconciliation.
- **Unchanged identity**: `package-lock.json`, `package.json` (version
  `0.1.0`, exact `@victframework/*@0.2.0` pins), migrations, release
  identity: byte-unchanged across the whole audited span.
- **Every executable diff from `d61532d` to the current tree was read in
  full** by this audit (4 production files, 5 test/verifier files): the
  diffs contain exactly the declared remediation and nothing else.

## 3. Discriminating negative controls (audit area 2) — both defects reproduced and cleared

Independently authored probes (NOT the implementation agent's probe code;
re-verifier-written vitest specs) executed in disposable OS-temporary
worktrees with disposable task-owned stores, through the REAL released
`app.data.query` boundary (`act.queryInspection` exactly as `/api/act`
issues it).

### Q5-B-1 original defect — REPRODUCED at `d61532d`

Freshly migrated store, EMPTY `qlt_memory_policy` table (0 rows):

- one `getPolicy` query through the real boundary **created the durable
  default row: 0 → 1**, visible in the COMPLETE durable row-state dump
  (every user table, fully ordered, read-only raw connection), not merely
  in a count or returned output.

### Q5-H-1 original defect — REPRODUCED at `d61532d`

Non-vacuous fixture: three canonical current records (claim, commitment,
open loop) plus a proposal created at the repository fixture boundary,
awaited, and CONFIRMED through the real `act.confirmProposal` boundary.
The EXACT UI query shape (`listRecords bucket:'current'`, no threadId, no
kind filter):

- Current returned `["claim", "proposal", "open_loop", "commitment",
"claim"]`, `total=5` — the terminal CONFIRMED proposal rendered in
  Current and the total was inflated (5 vs 4 canonical).

### Same probes on the current tree — BOTH CLEAR

- B-1: **0 rows after the read**; complete durable state identical; the
  response is the truthful implicit default `{"policyId":
"qlt.memory-mode@1", "mode": "across-conversations", "modeLabel":
"Across conversations", "revision": 1, "updatedAtMs": null, "persisted":
false}`; repeated reads deterministically identical with continued zero
  effect; `listRecords` ×3 buckets and `listTurns` also durable-effect-free.
- H-1: Current returned `["claim", "open_loop", "commitment", "claim"]`,
  `total=4` — **zero proposals of any status**, total equals the canonical
  count, the confirmed proposal appears in History, and no
  duplicate-looking pair exists (claim ids unique).

The discriminator FAILS for the precise old behavior and PASSES for the
precise new behavior. Worktrees, stores, and probe artifacts were removed
after use.

## 4. Q5-B-1 — read purity (audit area 3) — proven

Full-depth independent probe on the current tree, freshly migrated store:

1. Complete durable row-state snapshot + `sqlite_master` schema
   fingerprint (read-only raw connections).
2. `getPolicy` through the real `act.queryInspection` boundary.
3. Complete state captured again — **exact identity** (rows AND schema).
4. Repeated reads — continued identity and deterministic response.

The implicit response is truthfully `mode: across-conversations,
revision: 1, updatedAtMs: null, persisted: false`. No fabricated
timestamp, no actor fabrication, no durable-row claim, no schema
mutation, no bookkeeping change, no INSERT, no UPDATE. Purity was
re-proven for EVERY inspection operation (`listRecords` ×3,
`listTurns`, `getRecord`, `getTurn`, `getPolicy` — full-state dumps
identical around each read). Static inspection confirms the
read-sounding methods `resolveCurrent`/`getPolicyRow` NO LONGER EXIST;
`peekCurrent`/`peekPolicyRow` are SELECT-only and resolve the absent row
IN MEMORY; no read-sounding public method can seed a row.

Legitimate write paths independently proven:

| Write-path semantic                            | Result                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Turn admission establishes the durable default | EXACTLY ONE row, revision 1, `across-conversations`, `actor-quellight-local` (inside the per-conversation critical section; audit O-2 preserved) |
| Default mode set on an ABSENT row              | creates EXACTLY ONE row at revision 1 — no false revision bump                                                                                   |
| First effective change                         | revision 2 (no double bump)                                                                                                                      |
| Later effective changes                        | monotonic 3, 4                                                                                                                                   |
| Same-value operation                           | converges, no increment (still 4)                                                                                                                |
| Same-key retry                                 | truthful replayed receipt; no re-apply, no new row, no bump                                                                                      |
| Conflicting same-key payload                   | fails `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; zero partial effects (mode/revision unchanged)                                                        |
| Restart                                        | durable row preserved byte-for-byte; `getPolicy` truthful (`persisted: true`); reads pure after restart                                          |
| Reads after persistence                        | full-state identical                                                                                                                             |
| Per-turn applied-policy evidence               | admission-bound revision 1 retained across later mode changes and restart; repeat `getTurn` identical — history never relabelled                 |

## 5. Q5-H-1 — bucket truthfulness (audit area 4) — proven

Non-vacuous mixed fixture (current tree; proposals decided through the
REAL `act.*` boundaries wherever a user-facing action exists; the
fixture-derived expectation model was computed INDEPENDENTLY from the
meaning-store listers plus the frozen eligibility rule, not from the
inspection SQL under test):

- proposals: proposed, awaiting_decision, confirmed (via
  `act.confirmProposal`), rejected (`act.rejectProposal`), amended
  (`act.amendProposal` — original `amended` + NEW `proposed` amendment),
  withdrawn (`act.withdrawnProposal`-equivalent `act.withdrawProposal`);
- canonical current: claim, commitment, open loop (+ the confirmed
  proposal's resulting canonical claim + the correction successor + a
  second thread's claim);
- closed/superseded: superseded claim (`act.correctRecord`), released
  commitment (`act.releaseCommitment`), abandoned loop
  (`act.abandonLoop`), retired claim (`act.retireClaim`), resolved loop
  (`act.resolveLoop`), transformed loop (`act.transformLoop`).

Exact fixture totals (independently derived AND observed):
**pending = 3, current = 6, history = 10 (4 terminal proposals + 6
closed/superseded records)**.

### Pending

- ONLY proposals with status `proposed | awaiting_decision` (statuses
  observed `["proposed","awaiting_decision","proposed"]`); zero canonical
  record family rows; correct total (3); deterministic
  `updatedAt DESC, id ASC` ordering.

### Current

- ZERO proposals of every status; ONLY current-effective,
  retention-eligible claims, commitments, and open loops; the returned
  record-id set EQUALS the independently derived expected set; no
  closed/superseded status; no duplicate-looking proposal/record pair
  after confirmation (claim ids unique); correct total (6).

### History

- ALL terminal proposals (confirmed/rejected/amended/withdrawn present;
  count exactly 4); all closed records (superseded/retired/released/
  resolved/abandoned/transformed ALL present); no current-effective
  record; correct total (10).

Also verified:

- no-filter, every supported kind filter per bucket, thread filters
  (both directions), mixed timestamps with verified `updatedAt DESC,
id ASC` compliance (including equal-timestamp id ASC tie-break),
  offset/limit page boundaries (limit-2 walk: disjoint, duplicate-free,
  deterministic on repeat, totals consistent across pages;
  offset=total−1 returns exactly the last row; offset beyond total →
  empty page with truthful total);
- unsupported bucket `future` → `QLT_INSPECTION_UNSUPPORTED_QUERY`;
  unsupported kind → same; missing bucket → `QLT_INSPECTION_MISSING_PARAM`;
  unknown query op → `QLT_INSPECTION_UNSUPPORTED_QUERY` — **no fallback
  branch classifies a future bucket as History** (the branch structure in
  `sqlite.ts` is explicit `pending|history` / `current|history` with
  deliberately NO else);
- empty buckets on a fresh store: truthful zeros for all three buckets.

## 6. Q5-M-1 — regression quality (audit area 5) — proven

- The new controls compare COMPLETE durable state, not returned output
  (`durableDump` over every user table via a read-only raw connection in
  both `test/memory-authority.test.ts` and `scripts/verify-q5.mjs`);
  no fixture pre-seeds the policy row before the purity check (C-19
  explicitly admits no turn and performs no write before the first
  snapshot).
- Current-bucket tests CONTAIN decided proposals (confirmed/rejected/
  amended/withdrawn); Pending tests contain non-current record families
  and prove their exclusion (pending holds zero family rows; the
  old-tree Pending leak produced the behavioral failure below).
- The browser display control uses a confirmed proposal plus its
  resulting canonical record: the ceremony confirms via the REAL
  governed boundary, asserts EXACTLY ONE active claim in Current, and
  the new Q5-H-1 assertion requires ZERO proposal items and EXACTLY ONE
  item in total in Current.
- **Old-tree discrimination** (current test files executed against a
  disposable `d61532d` worktree): `12 failed | 19 passed (31)` —
  including GENUINE BEHAVIORAL assertion failures of the new coverage:
  `expected 6 to be 3` (old Pending bucket leaks family records) and the
  old `getPolicy` shape failing `toEqual` on the missing `persisted`
  field — not merely API-absence errors (the remaining failures are the
  expected `peekCurrent is not a function` TypeErrors on the renamed
  methods). The new `verify:q5` also fails against `d61532d` (cannot pass
  the old tree).
- **Current-tree pass**: the same two suites pass 31/31.
- No assertion was weakened anywhere in the diff; the old
  seeding-assertions that encoded the B-1 behavior as correct were
  REWRITTEN to the truthful semantics (not deleted).

Exact test names and counts (no double-counting; two distinct files):

- `test/memory-policy.test.ts` — **16 tests**, incl. `Q5-B-1:
peekCurrent/peekPolicyRow are PURE reads…`, `Q5-B-1: ensureCurrent is
the write-path resolution…`, `Q5-B-1: setMode on an ABSENT row…`,
  `Q5-B-1: same-as-default setMode on an ABSENT row…`.
- `test/memory-authority.test.ts` — **15 tests**, incl. `C-01
(Q5-M-1/Q5-H-1): the bucket composition is truthful…` and `C-19
(Q5-M-1/Q5-B-1): reads are durable-effect-free…`.
- `scripts/verify-q5.mjs` — **86 checks green** (store-level read-purity
  and non-vacuous bucket-composition controls included).

## 7. Directly affected UI behavior (audit area 6) — proven, single authoritative run

The existing browser ceremony session (no additional browser boot) was
used; its script additions were inspected line-by-line before the run.

**Preflight** (completed BEFORE the authoritative sequence): no stale
Playwright/headless test processes (the running `chrome.exe`/`node.exe`
images were identified by command line as the operator's own browser and
the agent harness — untouched); no listeners on the dev/preview ports;
no `QUELLIGHT_*`/`PORT`/`VICT` environment overrides; clean tree at the
verified tip; both disposable verification worktrees already removed.

**Result**: `browser-ceremony-check: PASS` on its FIRST and ONLY
authoritative run inside `npm run verify:quellight` — no crash, no
rerun, no silent retry; the result is trustworthy. The session proves:
after confirmation the canonical memory appears EXACTLY ONCE in Current
(zero proposal-kind items, one item total — the new Q5-H-1 control), the
confirmed proposal appears in History and not in Current, opening Memory
on a fresh store performs no durable write (B-1 control), the implicit
default displays as "Across conversations", Memory Mode changes persist
normally, and axe/console/overflow/focus/modal checks stay clean.

The remediation session's two unexplained crashes were NOT dismissed as
environmental by this audit: this re-verification produced its own
trustworthy first-run result on the fully preflighted environment.

## 8. Preservation of unaffected areas (audit area 7) — proven

By full diff inspection (every executable diff read), the aggregate
ladder, and focused probes:

- three Memory Modes, global policy semantics, admission-time per-turn
  binding, immutable historical evidence (`verify:q2/q3/q4/q5`, node
  suites all PASS; probe-proven evidence immutability across mode
  changes and restart);
- context selection and injection, assembler version/fingerprint
  behavior (assembler untouched by the remediation diff; `verify:q4` PASS);
- project-scope extension seam untouched (no `projectId`, no project
  selectors anywhere; documentation claims preparation only);
- lifecycle actions and the L-3 correction fix (`verify:q3/q5` +
  `test:node` PASS; `act.correctRecord`/`act.confirmProposal` exercised
  by this audit's own probes);
- agent isolation: the model-facing envelope remains EXACTLY
  `qlt.proposal.draft@1` (`verify:q5` section 4 — 29 inventory checks —
  and the C-06 suite green; agent identities refused with zero effect);
- one-active-turn-per-conversation (`verify:q4`/turn-overlap suite PASS);
- verification-data isolation (`verify:dev-start` PASS — isolated
  task-owned data dir; zero project Svelte warnings);
- Q2/Q3/Q4 behavior preserved (their gates PASS; frozen modules
  byte-identical);
- future steering remains unimplemented (D-FUTURE-STEERING-1); no Q6
  provider work exists anywhere in either repository.

## 9. Authoritative verification (run once, exactly as declared)

Environmental, process, port, disposable-directory, and stale-server
preflight was completed BEFORE the sequence was declared started. The
sequence ran SEQUENTIALLY (never concurrently), each command started
only after the previous exit status was observed, exactly once, with no
failure, no rerun, no timeout change, no assertion change, and no other
command touching `node_modules` during `npm ci`:

| Command                    | Exit | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`                   | 0    | clean install                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run verify:consumer`  | 0    | exact-pin 0.2.0 registry consumption (N-1); unreachable-registry negative control (N-2) held                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run verify:quellight` | 0    | first attempt, ALL gates PASS: format:check; typecheck; verify:governance; verify:q2; verify:q3; verify:q4; verify:dev-start (isolated task-owned data dir); verify:q5 (86 checks); test:node; test:ui; production build + closed-allowlist build-log scan (1 warning line, allowlisted); browser-check; browser-stop-check; **browser-ceremony-check (PASS, first and only run)**; credential/canary/local-path artifact scan (217 files); git diff --check |
| `npm audit --omit=dev`     | 0    | found 0 vulnerabilities                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `git diff --check`         | 0    | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

The repository-wide format check PASSES (the `fabaf2c…` normalization
restored it; independently confirmed formatting-only).

Supplemental count-only commands (disclosed SEPARATELY; run after the
authoritative sequence because the aggregate output genuinely omits
counts; they changed nothing): `verify:q5` reports 86 checks;
`test:node` = 17 files / 242 tests passed; `test:ui` = 3 files / 20
tests passed; the two focused Q5 suites = 16 + 15 tests (31 total).
Additionally — disclosed — the re-verifier's own probes and the M-1
old-tree discrimination ran in disposable OS-temporary worktrees BEFORE
the authoritative sequence and were removed before it started.

## 10. Findings register

| ID       | Severity | Finding                                                                                                                                                      | Disposition                                                                                                |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| L-1      | Low      | (carried, unchanged) the `unrecorded` usage state is frozen data but unreachable through the current inspection surface — truthful absence, dead state only. | Carry to the next inspection touch-point (07D retention work). Not an executable remediation for Q5.       |
| L-2      | Low      | (carried, unchanged) `listTurns` summary rows expose `assemblerVersion`/`renderedBytes` outside the Details disclosure; benign operational metrics.          | Carry as a contract-wording touch-point. Not an executable remediation for Q5.                             |
| VICT-M-1 | —        | (older carried obligation, DISTINCT from Q5-M-1) truthful VICT effect-class correction + Quellight repin.                                                    | REMAINS OPEN with its hard deadline BEFORE the Phase Q6 live-provider proof and the Stage 07C final audit. |

No new Blocking, High, Medium, or Low findings. No finding of any
severity requires executable remediation. (One non-blocking note, no
action required: the `act.resolveLoop` ingress spec accepts no `reason`
while sibling loop exits do — deliberate frozen Q3-era behavior,
unchanged by the remediation, recorded here for the next contract
touch-point.)

## 11. Operator-data isolation and cleanup

- The real `.quellight-data` directory was NEVER opened, queried,
  hashed, copied, migrated, altered, or deleted by this re-verification;
  even filesystem metadata was not inspected. Isolation is proven from
  code paths (`resolveQuellightEnvironment` anchored every probe store
  INSIDE an explicit `mkdtempSync` OS-temporary task directory; the
  dev-start gate isolates by construction and PASSED) and from
  disposable execution (all probes/tests/worktrees lived in the OS
  temporary directory, outside both repositories, and were removed).
- Disposable worktrees at `d61532d` and `73ca1cb` (with their
  node_modules and probe copies): created OUTSIDE both repositories,
  removed, and `git worktree list` shows only the main tree.
- Probe scripts and stores: OS-temporary only; all removed.
- Quellight tracked tree: clean at start, unchanged through every
  verification step; the audited executable tree is untouched.
- VICT: read-only throughout; `.pi/` untouched and unread.

## 12. Closure determination

```text
Q5-B-1 CLOSED — Q5-H-1 CLOSED — Q5-M-1 CLOSED
NO BLOCKING OR HIGH FINDING — NO FINDING REQUIRES EXECUTABLE REMEDIATION
AUTHORITATIVE SEQUENCE GREEN, EXACTLY ONCE, NO RERUN
OPERATOR-DATA ISOLATION AND AGENT AUTHORITY HOLD
AUDITED EXECUTABLE TREE UNCHANGED
FORMAL CLOSURE IS PERMITTED
```

Exact next permitted actions (and nothing more): commit this
re-verification report; then, if closure is executed, create the Q5
formal-closure record, update ONLY the current Quellight status surfaces
(`README.md`, `docs/system-reference.md`, `docs/decision-register.md`),
reconcile VICT documentation (`docs/VICT-SYSTEM-REFERENCE.md` only,
patch-version advance), and push by normal fast-forwards. Phase Q6
contract and implementation planning is PERMITTED — NOT BEGUN.
