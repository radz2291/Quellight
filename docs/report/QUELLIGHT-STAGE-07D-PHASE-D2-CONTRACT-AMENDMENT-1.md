# Quellight Stage 07D — Phase D2 Safety Contract Amendment 1

**Contract:** `quellight.stage07d.d2.safety-contract@1` → **`quellight.stage07d.d2.safety-contract@2`**
**Status:** FROZEN 2026-09-24 — committed ALONE, before any executable change (owner instruction).
**Trigger:** the Phase D5 independent audit's finding **B-1** (blocking): the plus-meaning deep purge of ceremony-created meaning fails with a raw `FOREIGN KEY constraint failed` inside `purgeConversation`'s transaction. The transaction correctly rolls back (no receipt, no partial deletion), but the principal deep-purge scenario is unusable. The companion finding **H-1** (the verify:d2 fixture seeds only direct-verb records with `proposal_id = NULL`, so the gate cannot see the class) is closed by the coverage extension frozen in §8.

The owner's decision: repair by deriving and enforcing the correct foreign-key dependency order for deep purge. D1 tombstoning is NOT expanded — `proposal_id` is NOT added to any tombstone null-set; proposal provenance and lineage are preserved during normal logical removal, and the physical purge may delete dependent rows before their referenced parents inside the existing single transaction and existing authorized scope.

## 1. What changed and what did not

**Changed:** exactly one thing — the frozen deep-purge step order. The `originating-tombstones` step (the originating subject rows of the conversation: claims, commitments, open loops) now executes BEFORE the `proposals` step. Everything else in the purge is byte-for-byte the @1 semantics.

**Unchanged (re-affirmed):**
- the completed-deletion prerequisite (`QLT_PURGE_NOT_AVAILABLE` without a `completed` deletion row or a present thread tombstone);
- the explicit typed confirmation token (`purge`; wrong/missing token refuses with zero effect);
- the recorded-mode scope bound FOREVER (conversation-only purges never delete meaning rows, proposals, or the thread tombstone row; the recorded mode is never broadened);
- ONE `BEGIN IMMEDIATE` transaction for the whole purge; the content-free receipt row written in that transaction; best-effort VACUUM outside it with truthful `vacuumed` recording;
- rollback with no receipt and no partial deletion on any failure;
- ordinary logical removal and D1 tombstone semantics UNCHANGED — `TOMBSTONE_NULL_SETS` are not modified; `proposal_id` and `normative_basis_proposal_id` survive logical removal as provenance;
- all D1/D3/D4 behavior; no D4 evidence, receipt, or prior contract is reinterpreted. This amendment supersedes @1 solely in the purge ordering and the coverage matrix additions of §8.

## 2. The complete live foreign-key graph (the derivation input)

Derived from the LIVE schema (`PRAGMA foreign_key_list` over every `qlt_*` table after migration 6 on a synthetic disposable store — not from assumption; the dump is reproduced in the remediation report). All edges use `ON DELETE NO ACTION` / `ON UPDATE NO ACTION`. Exactly 20 edges:

| # | Child column | → Referenced parent |
| --- | --- | --- |
| 1 | `qlt_amendment.source_thread_id` | `qlt_thread.id` |
| 2 | `qlt_amendment.successor_id` | `qlt_commitment.id` |
| 3 | `qlt_amendment.commitment_id` | `qlt_commitment.id` |
| 4 | `qlt_claim.source_thread_id` | `qlt_thread.id` |
| 5 | `qlt_claim.supersedes_id` | `qlt_claim.id` (self) |
| 6 | `qlt_claim.proposal_id` | `qlt_proposal.id` |
| 7 | `qlt_commitment.source_thread_id` | `qlt_thread.id` |
| 8 | `qlt_commitment.supersedes_id` | `qlt_commitment.id` (self) |
| 9 | `qlt_commitment.proposal_id` | `qlt_proposal.id` |
| 10 | `qlt_commitment.normative_basis_proposal_id` | `qlt_proposal.id` |
| 11 | `qlt_conflict_challenge.thread_id` | `qlt_thread.id` |
| 12 | `qlt_conflict_challenge.incoming_proposal_id` | `qlt_proposal.id` |
| 13 | `qlt_conflict_challenge.existing_commitment_id` | `qlt_commitment.id` |
| 14 | `qlt_context_assembly.thread_id` | `qlt_thread.id` |
| 15 | `qlt_correction.source_thread_id` | `qlt_thread.id` |
| 16 | `qlt_open_loop.source_thread_id` | `qlt_thread.id` |
| 17 | `qlt_open_loop.supersedes_id` | `qlt_open_loop.id` (self) |
| 18 | `qlt_open_loop.proposal_id` | `qlt_proposal.id` |
| 19 | `qlt_proposal.source_thread_id` | `qlt_thread.id` |
| 20 | `qlt_thread_conversation.thread_id` | `qlt_thread.id` |

Referenced parents: **`qlt_proposal`** (edges 6, 9, 10, 12, 18), **`qlt_commitment`** (edges 2, 3, 13), **`qlt_thread`** (edges 1, 4, 7, 11, 14, 15, 16, 19, 20). Tables with no inbound edges (`qlt_correction`, `qlt_source_link`, `qlt_retention_pass`, `qlt_conversation_deletion`, `qlt_conversation_purge`, policy/idempotency tables) are ordered only by their outbound edges. `qlt_conversation_deletion` and `qlt_conversation_purge` carry NO foreign keys by design (the preserved minimum evidence must outlive the purged rows). `qlt_source_link` carries no foreign keys (plain-text references; ordered for residue completeness, not FK necessity).

## 3. The derivation (why this order and no other)

A purge of a conversation `C` (recorded mode `conversation-and-originating-meaning`) removes: the challenge, amendment, correction, source-link, proposal, and originating-subject rows tied to `C`, the assembly evidence, the conversation-link row, and the thread row. For every FK edge, the child row must be deleted before the referenced parent row (all actions are `NO ACTION`; the transaction is one `BEGIN IMMEDIATE`, so ordering across statements inside it is what matters). Topologically ordering the deleted classes by their edges gives exactly one constraint set:

- `qlt_conflict_challenge` before `qlt_commitment` and `qlt_proposal` (edges 12, 13) and before `qlt_thread` (11);
- `qlt_amendment` before `qlt_commitment` (edges 2, 3) and before `qlt_thread` (1);
- `qlt_correction` before `qlt_thread` (15);
- originating subject rows (`qlt_claim`, `qlt_commitment`, `qlt_open_loop`) before `qlt_proposal` (edges 6, 9, 10, 18) and before `qlt_thread` (4, 7, 16);
- `qlt_source_link` anywhere (no FK) — kept BEFORE proposals for residue completeness (links sourced from proposals are removed in the same transaction);
- `qlt_proposal` before `qlt_thread` (19);
- `qlt_context_assembly` before `qlt_thread` (14); `qlt_thread_conversation` before `qlt_thread` (20).

The @1 order violated exactly one of these constraints: proposals (step 5) were deleted before the originating subject rows (step 6) while edges 6/9/10/18 still pointed at them — deterministic `FOREIGN KEY constraint failed` for every ceremony-created record (the product's normal meaning path, where `proposal_id` is non-null). Direct-verb records (`proposal_id` NULL) masked it.

**Self-reference semantics (validated empirically, frozen here):** the `supersedes_id` self-edges are removed by the SAME single `DELETE ... WHERE source_thread_id = ?` statement per family; SQLite resolves a self-referential chain deleted by one statement (validated on the live schema: a two-row chain in parent-before-child scan order deletes completely; the failure mode exists only for separate statements deleting a referenced parent first — which the amended order never does). The per-family single statement is retained; no leaf-first iteration is added.

**Judgment-row closure (as implemented in @1, now formally frozen):** challenge and amendment rows are deleted by id-membership, not only by thread attribution (`thread_id = C OR incoming_proposal_id IN (C proposals) OR existing_commitment_id IN (C commitments)`; `source_thread_id = C OR commitment_id IN (C commitments) OR successor_id IN (C commitments)`). A judgment row created by ANOTHER conversation's incoming proposal that references a purged commitment is a zero-content dependent of the purged record and is removed wherever it sits, counted in the receipt; no content-bearing row outside the scope is ever touched.

**The precise boundary (unchanged from @1):** a content-bearing record in ANOTHER conversation that references INTO the scope through a `supersedes_id` chain (a foreign claim/commitment/open-loop superseding a purged record) cannot be removed within the authorized scope. Such a purge fails closed: the transaction rolls back, no receipt is written, no partial deletion occurs, and the stable non-echoing incomplete refusal surfaces (`QLT_PURGE_INCOMPLETE` at the route). No broadening, no FK disabling, no deferred cleanup.

## 4. The frozen `@2` purge order

One transaction, in this order (the only change from @1 is the swap of steps 5 and 6):

1. **challenges** — `thread_id = C OR incoming_proposal_id IN (C proposals) OR existing_commitment_id IN (C commitments)`
2. **amendments** — `source_thread_id = C OR commitment_id IN (C commitments) OR successor_id IN (C commitments)`
3. **corrections** — `source_thread_id = C`
4. **source links** — `to_ref` referencing `C` or `C` proposals; `from_record_id` in `C` proposals/claims/commitments/open-loops/corrections
5. **originating subject tombstones** (plus-meaning mode only) — claims, commitments, open loops `WHERE source_thread_id = C` (single statement per family; self-chains resolved within the statement)
6. **proposals** (plus-meaning mode only) — `source_thread_id = C`
7. **assembly evidence** — `thread_id = C`
8. **conversation link** — `thread_id = C`
9. **thread row** (plus-meaning mode only)

The receipt shape, counts, content-freedom, prerequisites, token, mode bounding, and VACUUM discipline are exactly @1's.

## 5. Authority, codes, vocabulary

No new error codes, no vocabulary change, no authority change (user-only; `agent-*` refused at every entry point). `QLT_D2_ERROR_CODES` is unchanged (12 codes).

## 6. D1 non-amendment (explicit)

The D1 tombstone null-sets are NOT amended. `proposal_id` and `normative_basis_proposal_id` remain on tombstoned rows as provenance; the FK conflict is resolved at purge time by order, not by erasing provenance earlier. Amendment lineage (`qlt_amendment`), challenge judgments, and `amends` links are likewise preserved through logical removal and are removed only by the physical purge closure.

## 7. Non-reinterpretation

The D4 sealed evidence, the attempt-1 archive, the organic-use record, the D1a contract and its amendment, the D4 proof contract and its amendment, and the operator-live-use amendment are NOT reinterpreted and remain byte-preserved. This amendment changes only the D2 purge ordering and coverage from this point forward.

## 8. Permanent coverage additions (the N-D2 matrix extends to N-D2-24)

verify:d2 and the focused tests implement, at minimum:

- **N-D2-19** — deep purge of CEREMONY-created meaning succeeds: a claim, a commitment (with `normative_basis_proposal_id`), and an open loop each created through the real proposal/confirmation ceremony (`proposal_id` non-null) are tombstoned by plus-meaning deletion and then physically removed by the typed purge with a truthful receipt. (The B-1 regression control; fails on @1 with the raw FK error.)
- **N-D2-20** — the purge closure removes challenges, amendments, and source links referencing the purged records (including a cross-thread judgment row referencing a purged commitment), counted in the receipt; content-bearing rows of unrelated conversations are untouched.
- **N-D2-21** — direct-verb compatibility: purging direct-verb-created meaning (`proposal_id` NULL) completes exactly as under @1.
- **N-D2-22** — unrelated-row byte-identity: a full row inventory of every `qlt_*` table before/after a purge is byte-identical outside the authorized scope (including preserved meaning of a conversation-only deletion and other conversations' proposals and records); only the scope rows and permitted content-free evidence differ.
- **N-D2-23** — induced mid-purge failure rolls back completely (no receipt, zero partial deletion, the deletion row stays `completed`), and a subsequent purge converges (restart/replay truthfulness).
- **N-D2-24** — post-purge integrity: `PRAGMA foreign_key_check` returns zero rows after completion, and a same-thread supersedes chain is fully removed by the single-transaction order.

Both D5 findings close: B-1 (the repaired order; N-D2-19 proves the principal scenario) and H-1 (the gate now exercises ceremony-created purges).

*Standalone freeze: this file and the decision-register entry are the entire commit; no executable change is included.*
