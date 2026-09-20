# Quellight Stage 07C — Phase Q5 — B-1/H-1 Remediation Contract

> **Class:** Remediation contract (frozen before implementation). This
> document is committed ALONE, before any consuming change. It freezes the
> exact remediation of the Q5 independent audit findings **Q5-B-1**
> (Blocking), **Q5-H-1** (High), and **Q5-M-1** (Medium — the audit's
> vacuous-coverage finding) and nothing else.
>
> Basis: `QUELLIGHT-STAGE-07C-PHASE-Q5-INDEPENDENT-VERIFICATION.md`
> (audit, NOT VERIFIED) and the frozen Phase Q5 contract
> (`QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md`, byte-preserved —
> never amended here).
>
> Naming discipline: the audit findings remediated here are **Q5-B-1**,
> **Q5-H-1**, **Q5-M-1**. The older carried VICT effect-class finding is
> **VICT-M-1** and is DISTINCT; it is NOT repaired or altered by this
> remediation. Q5-M-1 (this contract) is a Q5 verification-coverage
> finding; VICT-M-1 remains open with its own deadline before the Phase Q6
> live-provider proof.

## 0. Starting state (frozen)

| Item                            | Value                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight `HEAD == origin/main` | `e80fe08c409020e5261ca9faa31400da3e028b04` (verified; descendant of the audited tree `d61532d9b03f562e0f431a6ac1e2128059c33d88` by exactly the audit-report commit) |
| VICT `HEAD == origin/main`      | `4b9fed21430787a72eda76b1b72d448f234f05fa` (READ-ONLY for this entire remediation)                                                                                  |
| Conflicting work                | none: no competing remediation, no Q5-closure, no Q6 work on either remote (single-branch linear history)                                                           |
| Real `.quellight-data`          | NEVER accessed by this remediation; all probes/tests use explicit disposable task-owned stores in the OS temporary directory                                        |

## 1. Q5-B-1 (Blocking) — read-side policy resolution is durable-effect-free

Frozen defect: `act.queryInspection`/`getPolicy` → `getPolicyRow()` →
`ensurePolicyRow()` → `seedDefaultRow()` → durable INSERT. A declared read
wrote.

Frozen remediation: read resolution and write-path establishment are
SEPARATE store methods whose names communicate their effect:

- **Pure read/peek** (`peekPolicyRow`, `peekCurrent`): SELECT only. On an
  absent row the frozen implicit default is resolved IN MEMORY:
  mode `across-conversations`, revision 1, policy id
  `qlt.memory-mode@1`. Zero INSERT, zero UPDATE, zero schema change, zero
  bookkeeping change. The read-sounding methods `resolveCurrent` /
  `getPolicyRow` are REMOVED so no apparently read-only method silently
  inserts the row.
- **Write-path resolution/ensure** (`ensureCurrent`): establishes the
  durable default row when absent. Legitimate ONLY on:
  1. turn admission (inside the existing per-conversation critical
     section — preserves audit Observation O-2); and
  2. `act.setMemoryMode` (transactional seeding inside its one
     transaction — unchanged).

Frozen behavior on a freshly migrated store whose `qlt_memory_policy`
table is empty: `getPolicy` returns the truthful implicit default with
zero durable effect; repeated `getPolicy` calls are deterministically
identical and continue to have zero effect; opening or refreshing the
Memory surface changes no durable byte/row state. The first effective
change still transitions truthfully from default revision 1 to revision 2.
Setting the default mode on an absent row creates at most the ONE
legitimate durable default row without a false revision bump. Same-value
retries and conflicting-idempotency behavior are unchanged. Restart
behavior remains truthful whether the default is still implicit or has
become durable. Per-turn applied-policy evidence, the assembler,
injection, fingerprints, and historical-turn behavior are unchanged.

## 2. Truthful representation of the implicit (not-yet-persisted) default

The `getPolicy` inspection response keeps its frozen fields (policy id,
mode, revision, updatedAt) and gains the SMALLEST truthful representation
for the implicit default:

- `updatedAtMs` is **nullable**: `null` while the default is implicit
  (no fabricated timestamp, no persisted-row claim); the durable epoch ms
  once a row exists.
- `persisted: boolean` is added as an explicit persisted-state signal
  (`false` = implicit default resolved in memory; `true` = durable row).

This is compatible with every consumer that reads `policyId`, `mode`,
`revision` (the Memory UI reads only the mode) and truthful where
compatibility is impossible.

## 3. Q5-H-1 (High) — truthful bucket composition

Frozen defect: `listInspectionRecords` queried terminal proposals for
EVERY non-`pending` bucket, so decided proposals rendered in Current and
inflated its total.

Frozen remediation — explicit bucket branching with NO fallback branch
(an unknown/future bucket can never silently classify as History):

| Bucket    | Contents (exhaustive)                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending` | ONLY proposals with status `proposed \| awaiting_decision` (no family records, nothing else)                                                             |
| `current` | ONLY canonical current-effective records (active claims, active commitments, open loops — no successor, `currently-relevant`); NEVER any proposal status |
| `history` | terminal proposals (`confirmed/rejected/amended/withdrawn`) PLUS non-current/closed/superseded records                                                   |

Frozen invariants: proposal rows are queried only for `pending` and
`history`; kind filters and thread filters remain correct and can never
reintroduce a proposal into Current; pagination total/offset/limit and the
deterministic `updatedAt DESC, id ASC` ordering remain correct; empty
buckets remain truthful; no assembler or canonical-record semantics
change.

## 4. Q5-M-1 (Medium) — permanent non-vacuous coverage

The audit found the existing C-19/C-01 coverage vacuous (output-comparison
only; fixtures without decided proposals; no policy-row state
assertions). Frozen remediation — permanent controls that FAIL on the
audited tree:

1. **Read-purity control**: on a freshly migrated disposable store with an
   empty `qlt_memory_policy` table: complete durable row-state snapshot →
   `getPolicy` through the REAL released `app.data.query` boundary →
   truthful implicit default response → second complete snapshot →
   byte-identical → repeat for deterministic identity and continued zero
   effect → then a legitimate write-path resolution creates EXACTLY ONE
   default row → later reads remain pure. All relevant durable row
   families are inspected (not only inspection output).
2. **Bucket-composition control**: a non-vacuous fixture containing a
   proposed proposal, an awaiting-decision proposal, a confirmed proposal,
   a rejected proposal, an amended proposal, a withdrawn proposal, a
   current claim, a current commitment, a current open loop, and
   closed/superseded records. Through the EXACT UI query shape (no thread
   or kind filter): Pending returns only the two pending statuses; Current
   returns no proposal of any status and its total equals only canonical
   current records; History contains all terminal proposals and
   non-current records; pagination across mixed timestamps is
   deterministic and duplicate-free; kind and thread filtering never
   reintroduce terminal proposals into Current.
3. **After-confirm display control** (existing browser ceremony session
   extended; no second browser boot): after confirming a proposal, the
   created canonical record appears in Current; the confirmed proposal
   appears in History; the confirmed proposal does NOT appear in Current;
   Current displays no duplicate-looking memory item.
4. `verify:q5` is strengthened with the same two controls (read purity and
   bucket composition) so the verifier alone can detect regressions of
   Q5-B-1/Q5-H-1.

## 5. Preservation (nothing else changes)

The three Memory Modes; global Memory Mode semantics; per-turn binding;
migration 4 schema; policy revision rules; context assembly or injection;
Q4-AMEND-1; the future project-scope seam; lifecycle behavior; the L-3
repair; the agent capability envelope (EXACTLY `qlt.proposal.draft@1`;
no agent read/list/search/inspection/decision authority); the action
inventory; UI structure except any inseparable truthful-state rendering
adjustment; VICT packages and source; package pins and
`package-lock.json`; historical reports; the prior audit report; user
data — all UNCHANGED. L-1, L-2, and the five observations are carried
unchanged. No other Q5 semantics change. Q6 is NOT begun. Q5 remains not
Verified and not formally closed.

## 6. FastGate lane ownership (frozen before branching)

| Lane                             | Responsibility                                                          | Exact files                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract owner                   | this contract only                                                      | `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-CONTRACT.md`                                                                                  |
| Implementation owner (Lanes A/B) | production read-purity + truthful buckets                               | `src/lib/sharedworld/memory-policy.ts`, `src/lib/server/composition.ts`, `src/lib/sharedworld/sqlite.ts`, `src/lib/sharedworld/inspection-surface.ts`     |
| Independent test owner (Lane D)  | non-vacuous regressions + verifier; MUST NOT implement production fixes | `test/memory-policy.test.ts`, `test/memory-authority.test.ts`, `scripts/verify-q5.mjs`, `scripts/browser-ceremony-check.mjs`                              |
| Documentation owner              | remediation record + current status docs                                | `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md`, `README.md`, `docs/system-reference.md`, `docs/decision-register.md` (status lines only) |

Lane D's suite updates to the renamed store methods (mechanical call-site
re-names and REWRITTEN seeding expectations) are test-side only and are
the M-1 remediation itself; they alter no production file. Work proceeds
in isolated worktrees per lane and reconciles once on `main`.

## 7. Verification discipline

Focused checks only (`format:check`, `typecheck`, `verify:q5`, focused
node/UI suites, `build`, `git diff --check`); the browser ceremony rerun
only because its script changes. Required negative controls: reproduce
Q5-B-1 and Q5-H-1 at the audited SHA `d61532d…` in a disposable worktree
with disposable stores; show the probes pass on the fixed tree; show the
new permanent tests fail against the audited SHA; prove the real
`.quellight-data` was never accessed. All non-zero commands disclosed.

## 8. Commit plan

```text
docs(stage-07c): freeze Q5 audit remediation contract          (this commit, ALONE)
fix(stage-07c): restore inspection read purity and truthful current bucket
test(stage-07c): lock Q5 audit regressions
docs(stage-07c): record Q5 audit remediation
```

Push only normal fast-forwards after a fresh fetch; no history rewrite.
