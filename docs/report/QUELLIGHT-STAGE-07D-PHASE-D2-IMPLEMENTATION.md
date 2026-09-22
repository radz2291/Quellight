# Quellight Stage 07D Phase D2 — Governed Deletion, Export, and Cross-Store Reconciliation Implementation Report

> **Class:** Implementation record (documentation). This report documents
> Phase D2 TRUTHFULLY: the delivered governed conversation deletion, deep
> purge, user export, and cross-store reconciliation; every amendment or
> partial-failure decision taken during implementation; what was verified
> and how; and what remains. **Stage 07D is NOT verified and NOT formally
> closed.** D4 (MSTR-012 real-use proof), D5 (independent audit and
> closure), and Stage 07E remain NOT BEGUN. No provider was accessed; no
> credential, operator data, `.quellight-data`, or VICT `.pi/` material
> was touched; VICT was consumed read-only through its pinned 0.3.1
> governed surface.

## 1. Commit ledger (D2 delivery, in order)

| #   | Commit                  | Content                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | `396eb5c0` + `1c422c02` | **Phase 0 — D2 safety contract** (`quellight.stage07d.d2.safety-contract@1`), standalone, before any executable change.                                                                                                                                                                                                                                                                                                        |
| 1   | `cf9d4b2a`              | Frozen `d2-contract.ts`; migration 6 (thread tombstone CHECK + deletion/purge receipt tables); the deletion store (lifecycle, idempotent meaning removal composing frozen D1 machinery, FK-driven deep purge with content-free receipt); the conversation-lifecycle service wiring the VICT governed surface; composition wiring (shared thread coordinator, governance store, governed deletion/export ports, boot recovery). |
| 2   | `9d5080c6`              | HTTP surface: `/api/threads/[id]/deletion` (GET preview / POST confirmed deletion / DELETE cancel), `/api/threads/[id]/purge`, `/api/export`; D1 retention/conflict ingress schemas.                                                                                                                                                                                                                                           |
| 3   | `fe223407` (+ style)    | Migration-runner parent-rebuild fix + schema reconciliations in the seven affected test books (reconciliation precedent, no assertion weakened).                                                                                                                                                                                                                                                                               |
| 4   | `0f0a4022`              | `verify:d2` — 74 checks green implementing the frozen N-D2-1..18 matrix end-to-end over the real composition.                                                                                                                                                                                                                                                                                                                  |
| 5   | `279bc466`              | `verify:browser-d2` — consolidated real-browser D1/D3/D2 UI pass; q2/q4/q5/d1/dev-start migration-6 re-pins.                                                                                                                                                                                                                                                                                                                   |
| 6   | this commit             | Implementation report + status surfaces + decision register D-07D-4.                                                                                                                                                                                                                                                                                                                                                           |

## 2. What was delivered (natural language)

- **Governed conversation deletion** with exactly two explicit user
  choices. **Conversation-only (default)** tombstones the thread
  content-free (title nulled by a storage CHECK), removes the
  conversation link, deletes the VICT conversation and the fenced Mastra
  thread through the released `ConversationDeletionCoordinator`, and
  preserves every confirmed Shared World meaning record byte-identically
  — disclosed in the preview, the chooser text, and the completion
  notice. **Plus-originating-meaning** additionally removes only records
  proven to originate from the conversation (recorded
  `source_thread_id`): current records become content-free tombstones
  through the frozen D1 retention machinery and pending
  proposals/corrections are withdrawn through the frozen ceremony verb
  (their open challenges resolve quietly as `incoming-abandoned`).
  Cross-thread records, global records, and out-of-thread successors are
  structurally out of scope.
- **Deterministic preview** (pure; counts by family and state, preserved-
  record disclosure, existing operation state) that exactly matches the
  later governed effect.
- **Deep purge** as a separate, explicit, high-intent action, available
  only for a completed deletion, gated by typing the confirmation word,
  executed in ONE transaction in the frozen FK-driven order with a
  content-free receipt and a best-effort `VACUUM`. The recorded deletion
  mode bounds the purge forever: a conversation-only purge removes only
  the conversation shell (assembly evidence + link) and keeps the
  preserved meaning plus its content-free anchor row; a plus-meaning
  purge removes everything including the thread row. No filesystem
  targeting exists anywhere in the surface.
- **Versioned user export** (`quellight.user-export@1`): threads
  (current + content-free tombstones, distinguished), per-conversation
  transcripts through the governed VICT export ports (a deleted
  conversation is an explicitly marked empty section), meaning records in
  ALL states, proposals/corrections/challenges/amendments, retention-pass
  evidence, and deletion/purge receipts, with a disclosure block
  (included/excluded categories, the forbidden claims, the residue
  disclosure, the declared bounds). Deterministic for unchanged state
  (byte-identical), bounded by declared limits, streamed, not retained,
  and fail-closed (any genuine governed-port error yields NO document).
- **Cross-store reconciliation** with no atomicity claims: the durable
  product deletion row is recorded BEFORE any effect; the VICT
  coordinator records its own durable intent and per-step receipts; the
  terminal product state is `completed` only with every receipt, else
  truthfully `incomplete` with the VICT intent id recorded; boot recovery
  resumes open intents receipt-driven (`recoverPending()`), finalizes
  product rows, and fences every completed conversation
  (`fenceCompletedDeletions`). Recovery never broadens scope; same-key
  replays converge; conflicting scope and stale versions fail with zero
  partial effect; deletion serializes against turns through the existing
  per-conversation admission boundary.
- **Quiet UI** in the existing workspace: per-record Remove, claim expiry
  (1/7/30 days or clear), the visible Run-retention-pass and Export-my-
  data controls, conflict challenges with quiet Keep-existing-dismiss /
  Amend-and-resolve paths, the deletion chooser with conversation-only
  preselected, the deleted-state banner, and the word-gated deep purge.
  Nothing opens, focuses, or announces itself; all states are truthful
  (pending, completed, incomplete/reconciliation-required, failed).

## 3. Verification evidence

- `verify:d2` — **74 checks green**: every frozen control N-D2-1..N-D2-18
  implemented end-to-end over the REAL application composition (offline
  deterministic fixture; fresh disposable synthetic stores), including
  simulated failure at every cross-store boundary, restart recovery, the
  fence-across-restart probe, the full-store canary scan after purge, and
  the credential-clean determinism check on the export.
- `verify:browser-d2` — **real-browser integration PASS** on the
  production adapter-node build: all D1/D3/D2 controls driven through the
  rendered UI (including the deletion download and the deterministic-
  fixture conflict → challenge → dismiss flow), zero console
  warnings/errors, no horizontal overflow and no serious/critical axe
  violations at 1280 px and 390 px.
- Full node suite **351/351**; UI suites **20/20**; `verify:q2` 196,
  `q3` 34, `q4` 41, `q5` 86, `q6` 114, `d1` 49, `d3` 35; typecheck,
  `format:check`, `git diff --check` clean. Older consolidated gates were
  run where changed boundaries require them (`verify:governance` PASS;
  `verify:dev-start` re-pinned for the migration chain). The provider
  ladder and the D5 authoritative ladder were NOT run (D4/D5 scope).

## 4. Amendments and decisions taken during implementation (all disclosed)

1. **Migration-runner parent rebuild (pre-existing defect class, fixed):**
   migration 6 rebuilds `qlt_thread`, an FK PARENT. With enforcement on, a
   parent rebuild cannot execute or commit. The runner now runs migrations
   with FK enforcement OFF and restores it immediately after (the standard
   SQLite schema-rebuild discipline; each migration remains ONE atomic
   transaction). Data truth is enforced by the preservation tests
   (A-02/A-04/N-13). Recorded because it changes a previously stated
   invariant ("FKs on during migration") from the 07B-era comments.
2. **Deletion receipt FK removed at migration time:** the deletion row is
   the PRESERVED MINIMUM EVIDENCE and must outlive a plus-meaning purged
   thread row, so `qlt_conversation_deletion.thread_id` carries no
   REFERENCES clause (migration 6 amended before any store shipped).
3. **Unawaited-async defect caught by the gate:** the first gate run
   exposed an unawaited `executeMeaningRemoval` in the lifecycle (the
   deletion could "complete" while the removal was still in flight) and a
   resumption defect (a partial deletion whose link row was already gone
   never re-drove the VICT intent). Both are fixed; the fixes are exactly
   what N-D2-10/N-D2-11 now pin. Recorded for the D5 auditor.
4. **Mode-bounded purge clarification:** the safety contract's purge scope
   implicitly assumed plus-meaning deletions. Implementation clarified it
   truthfully: a conversation-only deletion's preserved meaning is NEVER
   purged; its deep purge removes only the conversation shell and keeps
   the content-free anchor row as the provenance FK anchor. The recorded
   mode bounds the purge forever.
5. **Export NOT_FOUND semantics:** the governed VICT service signals an
   absent conversation with the stable `VICT_AGENT_EXPORT_NOT_FOUND`,
   which the export treats as the one truthful absence (an explicitly
   marked deleted-conversation section); every other governed-port error
   fails the whole export closed.
6. **The D2 operations are conversation-lifecycle services over dedicated
   user routes** (the turns/streaming pattern), NOT plan actions: the
   agent plan and capability envelope remain exactly the 29-action D1
   inventory with the proposal-only agent capability. Every service entry
   point additionally refuses `agent-*` identities fail-closed.

## 5. Carried findings and limitations

- **D1 amendment-composition note (carried for the D5 auditor):** the
  D1a freeze amendment commit (`6856d45d`) also carried in-flight Lane B
  module files; the amendment content itself was standalone and preceded
  the dependent implementation. Unchanged by D2.
- The browser probe found and fixed one UI defect (the chooser Cancel
  briefly called the server-side cancel endpoint; it is now a pure UI
  close with exactly zero effect — the stronger property).
- Deep purge cannot and does not claim to erase Git history, OS/file
  backups, external copies, or provider systems; `VACUUM` reclaims space
  inside the application's own database file only. The `VACUUM` result is
  recorded on the receipt but the purge's truth never depends on it.
- Export sections are bounded by declared limits; the bounds are
  disclosed inside the export. Completeness is claimed only within the
  declared scope.
- The transient q6-live-offline-matrix failure seen once during
  development was the known Windows handle-release lag aggravated by the
  then-unclosed governance.db handle; after wiring
  `governanceStore.close()` into the composition close path, the full
  suite passed repeatedly.
- Carried from D1/D3 unchanged: stale `0.3.0` console labels (docs-only
  cleanup still owed), hashed Mastra dist import coupling, L-1/L-2 audit
  findings, sequential lane execution note.

## 6. Status

```text
QUELLIGHT STAGE 07D D2 IMPLEMENTED — DATA-SAFETY EVIDENCE RECORDED
RETENTION, CONFLICT, DELETION, EXPORT, AND RECONCILIATION ARE INTEGRATED
D4 REAL-USE PROOF HAS NOT BEGUN
STAGE 07D IS NOT VERIFIED OR FORMALLY CLOSED
STAGE 07E HAS NOT BEGUN
Stage 07 remains In Progress.
```
