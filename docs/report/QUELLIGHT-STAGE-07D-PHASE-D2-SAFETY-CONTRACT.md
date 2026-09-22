# Quellight Stage 07D Phase D2 — Governed Deletion, Export, and Cross-Store Reconciliation Safety Contract

> **Identity:** `quellight.stage07d.d2.safety-contract@1`.
> **Class:** Product safety contract (Phase 0 of D2). This document is the
> binding behavior contract for every D2 change. It is committed BEFORE any
> executable D2 change, standalone, and is written against the actual
> released VICT 0.3.1 governed surface and the actual Quellight store
> boundaries. It does not amend the D1a freeze; where D2 extends D1
> machinery it composes it unchanged. Stage 07D is NOT verified or closed;
> D4/D5/07E are NOT begun.
>
> **VICT 0.3.1 governed capability check (GOV-007):** the pinned release
> provides the complete governed surface D2 requires —
> `ConversationDeletionCoordinator` (durable intents + per-step receipts,
> idempotent, `recoverPending()`), `AgentConversationDomainPort`,
> `MastraMemoryDeletionPort` + `createGovernedMemoryDeletionPort` +
> `MastraThreadCoordinator` (fencing; turn/deletion causal rule),
> `fenceCompletedDeletions`, `ConversationExportService` +
> `MastraConversationExportPort` (classification-policy export,
> request-scoped, `retained: false`), `AgentGovernanceStore` durable
> implementation (`createSqliteAgentGovernanceStore`). **No GOV-007 stop is
> invoked and no ungoverned local substitute is created**: every VICT-backed
> store is touched only through these governed ports.

## 1. Stores and record families affected; authority

| Store (file)                                                | Owner/authority                                                           | Families                                                                                                                                                                                | D2 writes                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight Shared World SQLite (`shared-world.db`)           | Quellight product; USER only (`actor-quellight-local`; `agent-*` refused) | `qlt_thread`, `qlt_thread_conversation`, six meaning families, proposals, corrections, source links, challenges, amendments, retention passes, context-assembly evidence, memory policy | thread tombstone + link removal (via the VICT governed domain port callback), originating-meaning removal (via the frozen D1 retention store), pending-proposal/correction withdrawal, NEW `qlt_conversation_deletion` + `qlt_conversation_purge` receipt rows, migration 6 |
| VICT governance store (`governance.db`, NEW dedicated file) | VICT-owned (`AgentGovernanceStore`)                                       | deletion intents + step receipts (`application-domain`, `memory-store`)                                                                                                                 | only through `ConversationDeletionCoordinator`; content-free identifiers and timestamps only                                                                                                                                                                                |
| VICT Mastra memory store (`mastra-store.db`)                | VICT-owned; adapter-governed                                              | conversation threads, messages, thread-scoped memory                                                                                                                                    | only through `MastraMemoryDeletionPort` (fenced, coordinator-shared) and `MastraConversationExportPort` (read)                                                                                                                                                              |
| VICT operational stores (`vict-operational.db`)             | VICT-owned                                                                | turns, invocations, approvals, stream ledger, command idempotency                                                                                                                       | no D2 writes                                                                                                                                                                                                                                                                |

The agent capability envelope is UNCHANGED: the compiled plan remains the
29-action D1 inventory (proposal-only agent capability); D2 operations are
conversation-lifecycle services over dedicated authenticated USER routes
(the same pattern as turns/streaming), NOT plan actions. No agent ingress to
any D2 operation exists; additionally every D2 service entry point refuses
`agent-*` identities fail-closed (defense in depth, tested).

## 2. Deletion lifecycle (preview → confirm/cancel → execute → reconcile → terminal)

**States (closed):** `planned → completed | canceled | incomplete`;
`incomplete → completed` (recovery only; never re-scoped). A deletion row is
created (durable, in the SAME transaction as the first effect) keyed by an
idempotency key; the same key replays to the same outcome and never
duplicates.

1. **Preview (pure, no durable row):** deterministic function of current
   store state only — thread identity/state, conversation message and turn
   counts (governed reads), originating-meaning counts by family and state
   (current / already-expired / already-removed), pending proposal and
   correction counts originating from the conversation, and preserved-record
   disclosure (cross-thread and global records, successors in other
   threads). The preview is exactly what the confirmed execution will affect;
   the verify gate proves preview == later effect.
2. **Confirm:** requires an explicit user confirmation flag on the request;
   a missing/false confirmation refuses with `QLT_DELETION_CONFIRMATION_REQUIRED`
   and ZERO effect (a planned row may be recorded only together with the
   first real effect).
3. **Cancel:** an explicitly requested cancel of a `planned` row marks it
   `canceled`; cancellation has zero store effect. A cancel of a
   `completed` row is refused truthfully (`QLT_DELETION_NOT_CANCELLABLE`).
4. **Execute (ordering is fixed):**
   1. record the product deletion row (`planned`, mode + thread scope
      recorded at plan time and NEVER broadened);
   2. mode `conversation-and-originating-meaning` ONLY: remove originating
      subject-family records through the frozen D1 retention removal
      (content-free tombstones; deterministic dependency re-evaluation;
      one transaction; counts recorded on the deletion row) and withdraw
      pending proposals/corrections originating from the conversation
      (user-attributed, reason `conversation-deleted`);
   3. run the VICT `ConversationDeletionCoordinator` — step
      `application-domain` (the product domain port: tombstone the thread
      content-free + remove the conversation link; idempotent), step
      `memory-store` (the governed, fenced Mastra deletion);
   4. finalize: `completed` only when the VICT intent is `completed` AND
      every product step is durable; otherwise `incomplete` with the VICT
      intent id recorded.
      **Conversation-only mode skips step 2 entirely** and preserves all
      confirmed Shared World meaning; this preservation is disclosed in the
      preview, the confirmation text, and the completion state.
5. **Reconcile/recover:** at composition boot (and on explicit retry),
   `coordinator.recoverPending()` resumes open VICT intents from recorded
   receipts (completed steps are never re-driven), `fenceCompletedDeletions()`
   fences every completed conversation, and product `incomplete` rows whose
   VICT intent reached `completed` are finalized `completed`. Recovery never
   broadens scope: only recorded intents resume, and a recovery run removes
   nothing that was not in the recorded intent. Repeated requests converge.
6. **Terminal truthfulness:** `incomplete` is a truthful
   reconciliation-required state surfaced to the user (`QLT_DELETION_INCOMPLETE`
   - the durable row status); the system never reports complete deletion
     while any governed step lacks its receipt, and refuses ambiguous
     destructive continuation (a second execution with a DIFFERENT mode on the
     same thread refuses with `QLT_DELETION_SCOPE_CONFLICT`).

**Partial-failure matrix:** failure before the product row → zero effect;
failure during the meaning transaction → rollback, row rolled back with it
(no planned orphan), retry converges; failure between meaning removal and
the VICT run → durable row stays, VICT intent recorded by the coordinator
before its own steps, recovery completes it; failure inside VICT between
steps → VICT receipts make the next attempt resume exactly there; failure
during finalization → row remains truthful (`incomplete`), recovery
finalizes. Restart at every boundary converges without duplication
(verified per-boundary in `verify:d2`).

## 3. Conversation-only deletion

Default choice. Tombstones the thread (content-free: title nulled; identity,
state metadata, timestamps preserved), removes the conversation link,
deletes the VICT conversation + Mastra thread/memory through the governed
coordinator (fenced; deleted conversations refuse new turns via
`VICT_AGENT_THREAD_FENCED`), and **preserves every confirmed Shared World
meaning record, its history, and pending proposals** — disclosed in preview,
confirmation text, and completion status. Pending proposals/corrections from
the conversation are preserved in this mode and remain decidable in the
Memory inbox.

## 4. Conversation-plus-originating-meaning deletion

Affects ONLY records proven to originate from the selected conversation:
subject-family rows and pending proposals/corrections whose
`source_thread_id` equals the thread. **Never** touched: records sourced from
other conversations or with no conversation provenance (global), successors
created in other threads (they survive, pointing at content-free
tombstones — the frozen lineage rules prevent leakage), already-expired or
already-removed records (nothing to do; counted truthfully), other
conversations' challenges. Challenges tied to withdrawn incoming proposals
resolve as `incoming-abandoned` (the frozen quiet resolution). No semantic
inference, no broad cascade: "originating" is the recorded provenance column,
nothing else.

## 5. Normal removal versus deep purge

**Normal removal** (D1 machinery, unchanged; used by conversation-plus-meaning
and by the Memory workspace controls): immediate exclusion from
inspection-current and context assembly; content-free tombstone only;
deterministic dependency re-evaluation; retry/restart convergence; no leak
through lineage (links carry identifiers only), evidence (bounded id lists),
errors (stable non-echoing codes), previews (counts only), logs (no content
logging exists), or exports (tombstones render content-free by schema).

**Deep purge** is a SEPARATE, explicit, high-intent, conversation-scoped
action for an already governed-deleted (`completed`) conversation:

- **Precondition:** the conversation's deletion row is `completed` (never
  combined silently with ordinary removal; never a default; the UI hides it
  until deletion completed and requires typing an explicit confirmation
  token).
- **Scope (application-controlled rows only, in ONE transaction):**
  originating meaning tombstone rows, pending/withdrawn/confirmed proposal
  and correction rows originating from the conversation (with their source
  links), challenges and amendment rows tied to those purged rows (FK-driven,
  deterministic order: challenges → amendments → corrections → links →
  proposals → subject tombstones → assembly evidence → link row → thread
  row), the thread's context-assembly evidence rows, the thread row and
  conversation-link row.
- **Preserved minimum content-free evidence:** the deletion row, the purge
  receipt (content-free: identifiers, counts, timestamps), and the VICT
  governance receipts (VICT-owned; identifiers only). Retention-pass
  evidence rows are preserved (bounded identifier lists; identifiers of
  purged rows may remain as historical fact).
- **After the transaction** a best-effort `VACUUM` of the Shared World
  database reclaims freed pages. The purge receipt is written in the purge
  transaction and does not depend on `VACUUM` succeeding.
- **Never:** recursive filesystem deletion, client-supplied filesystem
  targets, or any path-scoped operation. Purge is record-scoped via
  server-resolved identities only.
- **Forbidden claims (the system must never state or imply):** that
  deletion or purge erases Git history, operating-system or file-level
  backups, uncontrolled external copies, provider-side systems, or anything
  outside the application's own stores; that any erasure is "secure";
  that deletion across Quellight and VICT stores is atomic; that an export
  proves deletion or completeness of systems outside its declared scope.
  These disclosures appear verbatim-class in the purge UI and in every
  export's disclosure block.

## 6. Export

`quellight.user-export@1` — a deterministic, versioned, bounded JSON
document assembled from the application's own stores plus the governed
VICT conversation export ports:

- **Included:** schema/version identity; every thread (current and
  content-free tombstones, distinguished); per linked conversation the
  governed VICT message export (role/text/order/thread creation time);
  meaning records in ALL states (current, historical/superseded/amended,
  expired, removed — tombstones render content-free with lifecycle
  metadata), proposals and corrections with status; challenges (content-free
  projection) and amendments; retention-pass evidence; memory-mode policy;
  conversation deletion receipts (content-free) — each record carries
  provenance (source thread, actor attribution) and status sufficient to
  understand current vs historical vs removed vs expired.
- **Excluded (structurally absent, disclosed):** credentials and provider
  headers (never read by the export path), capability/authority structures
  and the compiled plan, serialized operator configuration, actor tokens,
  store file paths and temporary paths, VICT internal traces/registry/ledger
  internals, context-injection defense framing (record content is included;
  the assembler's guard framing is not user data).
- **Determinism:** identical store state yields byte-identical JSON (stable
  key order, sorted collections, no wall-clock field inside the payload).
- **Bounded and safe:** section-by-section bounded assembly with limit
  constants; generated as a streamed response; no unbounded string
  concatenation of store content.
- **Fail closed:** any governed VICT export port error or store error
  produces `QLT_EXPORT_FAILED` with NO document (never a falsely complete
  export).
- **Not retained:** mirroring the governed VICT export discipline, the
  product export is handed to the requestor and not stored; concurrent read
  activity affects only which truthful point-in-time each section reflects,
  never internal consistency of a section.

## 7. Crash, restart, concurrency, retry, partial failure

Per-section store reads; deletion runs under the existing per-conversation
turn-admission critical section (deletion and turns serialize; the governed
fence adds the cross-process causal rule); all product writes are keyed and
transactional; recovery is idempotent and receipt-driven (§2.5). A stale
version or conflicting concurrent request fails with zero partial effect.

## 8. Stable codes (non-echoing; no store content in any error)

`QLT_DELETION_CONFIRMATION_REQUIRED`, `QLT_DELETION_MODE_INVALID`,
`QLT_DELETION_SCOPE_CONFLICT`, `QLT_DELETION_NOT_CANCELLABLE`,
`QLT_DELETION_INCOMPLETE`, `QLT_DELETION_IDENTITY_REFUSED`,
`QLT_DELETION_THREAD_MISSING`, `QLT_PURGE_NOT_AVAILABLE`,
`QLT_PURGE_CONFIRMATION_INVALID`, `QLT_PURGE_INCOMPLETE`,
`QLT_EXPORT_FAILED`, `QLT_EXPORT_IDENTITY_REFUSED` (plus the unchanged VICT
codes, e.g. `VICT_AGENT_THREAD_FENCED`).

## 9. UI wording and safe defaults (quiet discipline; D1 rules carried)

- Deletion chooser: **"Delete conversation only"** preselected (default);
  the plus-meaning choice is an explicit separate selection whose label
  states exactly what will be removed ("and the Shared World meaning that
  started in this conversation") and what will be preserved; confirmation
  dialog only after an intentional destructive click; cancel is always
  available and has zero effect; states are truthful: pending, completed
  (with the preservation disclosure), incomplete/reconciliation-required,
  failed.
- Memory workspace: per-record Remove, claim expiry (set/clear), and a
  visible "Run retention pass" control; challenge list with quiet
  Dismiss / Amend-and-resolve paths. Nothing opens, focuses, or announces
  itself beyond the existing polite aria-live status line; no modal, tray,
  focus theft, pressured wording, destructive preselection, or hidden
  cascade.
- Deep purge: hidden until deletion `completed`; requires typing the word
  `purge`; its dialog states the forbidden-claims disclosure (§5) verbatim
  in substance.
- Export: one explicit button; on failure a stable, non-echoing error; no
  automatic download ever.
- Existing responsive (390 px / 1280 px) and accessibility requirements
  (keyboard operability, visible focus, no serious/critical axe violations)
  apply to every new control.

## 10. Permanent negative controls (verify:d2; synthetic stores only)

N-D2-1 preview == later governed effect (counts and scopes). N-D2-2 cancel
produces zero effect (store bytes unchanged). N-D2-3 agent identity refused
for deletion, purge, export, and every destructive path. N-D2-4
conversation-only preserves all Shared World meaning (rows byte-identical).
N-D2-5 plus-meaning affects only proven originating records; cross-thread,
global, and successor records protected. N-D2-6 normal removal yields
content-free tombstones (storage CHECKs + no content in lineage/evidence/
errors/logs/export). N-D2-7 deep purge requires its distinct explicit
confirmation and a completed deletion; wrong token refuses with zero
effect. N-D2-8 retry and same-key replay never duplicate effects (one row,
one outcome). N-D2-9 conflicting scope and stale versions fail with zero
partial effect. N-D2-10 simulated failure at EVERY cross-store boundary
(before intent, after intent, between VICT steps, after VICT before
finalization) yields truthful incomplete/reconciliation state, never
premature "complete". N-D2-11 restart recovery converges without
broadening deletion (receipt-driven; fence holds). N-D2-12 concurrent
delete/export/read activity stays truthful and deterministic per section.
N-D2-13 export is complete for its declared scope, deterministic
(byte-identical for unchanged state), bounded, versioned, credential-clean
(canary scan), and fails closed on induced port failure. N-D2-14 unknown
fields, forged actor/thread/scope identities, prototype keys, and hostile
filenames fail closed. N-D2-15 no deletion/purge primitive can target the
repository, the operator directory, a parent directory, or any filesystem
path (identity-shaped inputs only). N-D2-16 existing D1/D3 behavior intact
(retention pass, tombstones, conflicts, amendments re-exercised through the
new wiring). N-D2-17 deleted conversations refuse new turns (fence across
restart). N-D2-18 purge leaves no conversation content in any Shared World
table (full-store content scan against seeded canaries; only the permitted
evidence rows remain).

## 11. Relationship to frozen contracts

No D1a frozen data is reinterpreted. New vocabularies, states, codes, and
the purge scope are NEW D2 contract data (to be frozen as `d2-contract.ts`
in the implementation that follows this document). The D1 retention,
conflict, and amendment machinery is consumed unchanged. The agent envelope
is unchanged. This contract is the D2 amendment of record; any later change
to it requires a standalone amendment committed before its dependent
implementation.
