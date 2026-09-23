# Quellight Stage 07D — Phase D2 Deep-Purge Remediation Report

> **Status: implemented and fully verified on this tree; AWAITING FRESH FOCUSED D5 RE-VERIFICATION.**
> This remediation does NOT close Stage 07D and does NOT perform the D5
> closure: Stage 07D remains **NOT independently verified and NOT formally
> closed**; Stage 07E remains **NOT permitted and NOT begun**. The D4
> evidence, the D5 audit report, and all historical records are untouched.

- **Owner instruction:** 2026-09-24 — repair D5 finding B-1 by deriving and
  enforcing the correct foreign-key dependency order for deep purge; do NOT
  expand D1 tombstoning to erase `proposal_id`; physical deep purge may
  delete dependents before referenced parents within the existing single
  transaction and existing authorized scope.
- **Starting Quellight SHA:** `ed144b19d05aa19f4b7d7fea0b954548b0f51c26` (the
  D5 audit report commit; verified == origin/main after fresh fetch, clean).
- **VICT:** `4aa245d29a79b0e9f9f2e35b46597e7a10701571`, read-only throughout
  (fresh-fetched, HEAD == origin/main, only untracked `.pi/` — never read).
- **Final SHA:** the tip of this repository after this report's commit
  (the commit ledger below ends at it).

## 1. Commit ledger (linear; fast-forward push after fresh fetch)

| #   | SHA           | Class            | Content                                                                                                                                                                                                                                                    |
| --- | ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `559e40a`     | docs, STANDALONE | D2 safety-contract Amendment 1 frozen (`quellight.stage07d.d2.safety-contract@1` → `@2`) + decision register D-07D-15. Documentation only (2 files, 154 insertions).                                                                                       |
| 2   | `b232682`     | fix              | The @2 implementation: the amended purge order in `deletion-store.ts`, the contract data (`d2-contract.ts` id, step order, matrix 18→24), stale `@1` version references updated (migration 6's comment kept at `@1` — historical truth). 8 files, +68/−30. |
| 3   | `483fd7c`     | test             | Permanent coverage: verify:d2 extended with N-D2-19..24 (87 checks total) + focused suite `test/d2-deep-purge.test.ts` (4 tests). 2 files, +773/−6.                                                                                                        |
| 4   | `8e74991`     | test, bounded    | D5 finding L-1 repair (assertion-neutral portability of the dependency-containment invariant in `verify-governance.mjs` and `governed-mutation.test.ts`). Separate commit per the owner's boundary rule; M-1 NOT touched. 2 files, +19/−2.                 |
| 5   | `3503a51`     | style            | Prettier reflow + type corrections in the remediation files (`npm run check` / `format:check` green). 3 files.                                                                                                                                             |
| 6   | (this commit) | docs             | This report + truthful status-surface updates + decision register D-07D-16.                                                                                                                                                                                |

## 2. The exact foreign-key graph and the corrected order

Derived from the LIVE schema — `PRAGMA foreign_key_list` over every
`qlt_*` table after migration 6 on a synthetic disposable store (never
from assumption). All 20 edges use `ON DELETE NO ACTION`; the referenced
parents are exactly **`qlt_proposal`** (claim.proposal_id,
commitment.proposal_id, commitment.normative_basis_proposal_id,
open_loop.proposal_id, conflict_challenge.incoming_proposal_id),
**`qlt_commitment`** (amendment.commitment_id, amendment.successor_id,
conflict_challenge.existing_commitment_id), and **`qlt_thread`** (9
children). Self-edges: claim/commitment/open_loop `supersedes_id`.
`qlt_conversation_deletion` and `qlt_conversation_purge` carry no FKs
(the preserved evidence outlives the purged rows); `qlt_source_link`
carries none (ordered for residue completeness).

The @1 order violated exactly one constraint — it deleted `qlt_proposal`
(step 5) before the originating subject rows (step 6) while four FK
edges still pointed at them, so EVERY ceremony-created record (the
product's normal meaning path: `proposal_id` non-null; ceremony
commitments carry BOTH `proposal_id` and `normative_basis_proposal_id`)
made the deep purge fail with a raw `FOREIGN KEY constraint failed`.

**The frozen @2 order** (one `BEGIN IMMEDIATE` transaction; the only
change from @1 is the swap of steps 5 and 6):

1. challenges (`thread_id = C` OR `incoming_proposal_id` IN C proposals OR `existing_commitment_id` IN C commitments)
2. amendments (`source_thread_id = C` OR `commitment_id`/`successor_id` IN C commitments)
3. corrections (`source_thread_id = C`)
4. source links (to_ref referencing C/C proposals; from_record_id in C's proposals/claims/commitments/open-loops/corrections)
5. **originating subject tombstones** — claims, commitments, open loops `WHERE source_thread_id = C` (one statement per family; a same-thread supersedes chain resolves within the statement — validated on the live schema: a chain deleted by one statement passes, separate-statement parent-first deletion fails as expected)
6. **proposals** (`source_thread_id = C`)
7. assembly evidence → 8. conversation link → 9. thread row

Chain creation in real flows happens ONLY through the correction
ceremony (the successor carries `supersedes_id`; the direct verbs have
no supersedes field) and the amendment ceremony — both are covered by
the new controls. The fail-closed boundary is retained and frozen: a
FOREIGN content record referencing INTO the scope (a cross-thread
correction successor in another conversation superseding a purged
claim) cannot be removed within scope, so that purge fails closed
(rollback, no receipt, no partial deletion) until the foreign child
leaves through its own governed path.

## 3. Old-tree reproduction (before the fix)

Reproduced against the audited pre-fix implementation (frozen D5 tree,
HEAD `60859c4` — executable-identical to `ed144b1`), disposable synthetic
store, meaning created through the real ceremony:

```text
claim created via ceremony: proposal_id = qlt-bf571faa4e2fe885 (FK -> qlt_proposal)
after plus-meaning deletion: proposal_id = qlt-bf571faa4e2fe885 retention_state = user-removed
PURGE FAILED CLOSED with: Error code = ERR_SQLITE_ERROR
  message: FOREIGN KEY constraint failed
post-failure integrity: claim rows = 1 | proposal rows = 1 | purge receipts = 0
```

(The reproduction's trailing `EBUSY` is the probe script's own win32
temp-cleanup racing the SQLite handle release — not a product path.)

## 4. Before/after durable row inventory (the repaired purge)

The committed controls assert the exact inventory on the remediated tree
(mixed scope P: ceremony claim + correction successor + ceremony
commitment + amended successor + ceremony open loop + one direct-verb
claim; plus the cross-thread challenge):

- Pre-purge P scope: 5 subject rows (3 claims, 2 commitments, 1 open
  loop), 4 proposals, 1 correction row, 1 amendment row, 1 challenge
  row (thread Q), source links, the thread row, the conversation-link row.
- Post-purge receipt: `challenges 1, amendments 1, corrections 1,
proposals 4, originatingTombstones 6, assemblyRows 0` (+ the
  conversation-link and thread rows; `vacuumed` recorded truthfully).
- Byte-identity: a full `qlt_*` row inventory before/after differs ONLY
  in scope rows and the permitted content-free receipt row; the
  unrelated conversation's rows (including its proposal) are untouched.
- Post-purge `PRAGMA foreign_key_check` = zero rows.

## 5. Non-vacuity proof (the new tests FAIL on the pre-fix tree)

A disposable clone at the audited `ed144b1` was overlaid with the NEW
gate and suite (overlay only; deleted afterwards):

- `verify:d2` (overlay): **FAILED — 8 checks red**, decisively
  `N-D2-19 … — cause=ERR_SQLITE_ERROR` (the raw FK defect), plus the
  cascade (rows remain, receipts missing, `foreign_key_check` polluted)
  and the two expected structural overlay artifacts (the overlay gate
  encodes the @2 order and the 24-control matrix against the @1 tree).
- Focused suite (overlay): **3 of 4 tests failed with
  `Error: FOREIGN KEY constraint failed`** (N-D2-19, the mixed-scope
  test, and the authority test); the boundary/replay test is
  order-insensitive by design and passes on both trees.
- On the remediated tree: verify:d2 **PASS — 87 checks green**; focused
  suite **4/4 green**. Both D5 findings close: B-1 (the repaired order;
  N-D2-19 proves the principal scenario) and H-1 (the gate now purges
  ceremony-created meaning).

## 6. Files changed

- Commit 2: `src/lib/sharedworld/deletion-store.ts` (the step swap),
  `src/lib/sharedworld/d2-contract.ts` (id @2, step order, N-D2-19..24),
  version-reference comments in `composition.ts`,
  `conversation-lifecycle.ts`, `port.ts`, `sqlite.ts`, both D2 routes.
- Commit 3: `scripts/verify-d2.mjs` (+ the [2b] purge-closure section),
  `test/d2-deep-purge.test.ts` (new).
- Commit 4: `scripts/verify-governance.mjs`, `test/governed-mutation.test.ts`.
- Commit 6: this report, `README.md`, `docs/system-reference.md`,
  `docs/decision-register.md`.

## 7. Verification results (this tree, after the remediation)

| Step               | Exit | Note                                                                                                                                                                   |
| ------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify:d1          | 0    | 49 checks — D1 semantics untouched                                                                                                                                     |
| verify:d2          | 0    | **87 checks** (74 + 13 new); includes N-D2-19..24                                                                                                                      |
| verify:d3          | 0    | 35 checks — conflict/amendment machinery untouched                                                                                                                     |
| verify:dev-live    | 0    | 19 checks                                                                                                                                                              |
| verify:governance  | 0    | L-1 repaired containment (portability proven below)                                                                                                                    |
| test:node          | 0    | **30 files / 357 tests** (was 353; +4 focused purge tests)                                                                                                             |
| check (typecheck)  | 0    |                                                                                                                                                                        |
| format:check       | 0    |                                                                                                                                                                        |
| build (production) | 0    | only the known Node 22 experimental-SQLite notice                                                                                                                      |
| verify:browser-d2  | 0    | real-browser D2/D1/D3 integration incl. the purge ceremony: confirmation word enforced, purge completed with the truthful residue disclosure, axe clean at 1280/390 px |
| git diff --check   | 0    |                                                                                                                                                                        |

L-1 portability demonstration: a disposable clone of the same commit
under a DIFFERENT directory name failed `verify:governance` with the OLD
files, then passed `verify:governance` AND the 28 governed-mutation
tests with the fixed files; the original tree passes both. (Clone and
worktree removed afterwards.)

## 8. Preservation and cleanup

Preserved untouched: VICT (read-only; `.pi/` never read), `.quellight-data`,
credentials/operator data, all D4 evidence (sealed attempt-2 bundle,
attempt-1 archive, organic-use record), all historical reports/contracts
(including the D2 safety contract @1 document and the D5 audit report),
the D5 audit artifacts under `ql-07d-d5-audit\` (frozen tree still clean
at `60859c4`). No provider contact; the D4 session was NOT re-run.
Cleanup: the disposable non-vacuity worktree and overlay, the
portability clone, and all temporary probe scripts/stores were removed.

## 9. Remaining findings (truthful carry)

- **B-1** — remediated here (order repair + N-D2-19); NOT declared
  closed: closure is the fresh focused D5 re-verification's judgment.
- **H-1** — remediated here (ceremony-path purge coverage; the gate can
  now detect the class); same re-verification caveat.
- **M-1** — carried truthfully, NOT rewritten (per the owner
  instruction); the D1a Amendment 1 commit remains a disclosed
  process/attribution deviation in history.
- **L-1** — repaired in commit 4 (bounded, assertion-neutral).
- **L-2** — unchanged; the accepted D4 Layer-B aggregate attestation
  ruling is NOT altered.
- **L-3** — repaired in the D5 audit commit.

## 10. Exact next action

**A fresh, focused, independent D5 re-verification** of this
remediation (owner-authorized): the D2 purge ordering against the live
FK graph, the N-D2-19..24 controls' non-vacuity, the focused suite, and
the unchanged D1/D3/D4 invariants — after which the D5 auditor alone
may reconsider Stage 07D closure. Until then: Stage 07D is NOT
independently verified and NOT formally closed; Stage 07E is NOT
permitted and NOT begun.
