# Quellight Stage 07D Phase D1a — Joint Retention/Conflict Contract Freeze

> **Class:** Contract freeze (declarative). This document and the frozen
> declarative module `src/lib/sharedworld/d1-contract.ts` (plus the
> explicitly listed data amendments to `meaning-contract.ts`) freeze the
> Stage 07D D1/D3 foundation contracts BEFORE any executable change. No
> production behavior changes in this commit. Any later amendment must be
> explicit, standalone, and committed before dependent implementation
> continues (freeze §17). This commit does NOT implement, verify, or close
> anything: Stage 07D remains in progress, D2/D4/D5 and Stage 07E remain
> not begun.

## 1. Basis and scope

Frozen against: the approved Stage 07D owner decisions OD-D1..OD-D6
(recorded binding in the decision register, D-07D-1; reproduced in §2), the
D0 planning document, the Stage 07 architecture §12/§14 and the §8 first
vertical, the Stage 07C handoff §18 boundary, the ratified OQ6 authority
model, and the frozen 07C contracts. The freeze covers BOTH foundation
lanes jointly because they share one schema migration and one application
plan inventory.

## 2. Binding owner decisions recorded (register D-07D-1)

1. **Expiry (OD-D1):** no automatic expiry by default; users may explicitly
   assign expiry to individual CLAIMS only; commitments and open loops
   never expire automatically; expiry is applied only by a visible
   deterministic enforcement pass, never silently from elapsed time during
   ordinary reads.
2. **Removal depth (OD-D2):** normal removal immediately makes content
   ineligible everywhere; only a content-free tombstone and truthful
   residue disclosure remain; a separate explicit deep-purge operation for
   eligible remaining content is D2 scope; deletion is never claimed
   against storage, evidence, backups, or external systems unless actually
   proven.
3. **Conversation deletion (OD-D3):** always ask — conversation only
   (default) or conversation plus Shared World meaning originating from it;
   never a silent cascade. (D2 scope; recorded here because the freeze
   reserves the tombstone machinery it will use.)
4. **Conflicts (OD-D4):** a conflict with an active commitment produces a
   visible, dismissible challenge proposal; never a silent overwrite,
   harmonization, reinterpretation, or execution against the commitment;
   the challenge stays quiet and non-blocking — no modal, focus theft,
   tray auto-open, conversation interruption, or forced decision.
5. **Real-use proof (OD-D5):** D4 will use one bounded owner-authorized
   structured session plus a short organic-use observation window; D4 is
   NOT executed in D1 and no provider is accessed.
6. **Audit (OD-D6):** per-phase self-verification plus ONE combined
   independent audit after D4; before D4, the D2 deletion/export/
   reconciliation work must pass a focused data-safety gate (not a
   duplicate full audit).

## 3. Frozen data, and the explicit amendments to 07C contract files

New frozen module: `src/lib/sharedworld/d1-contract.ts` (the authoritative
machine-readable data: vocabularies, transitions, inventories, codes,
authority matrix, UI rules, durability rules, migration inventory,
negative controls, lane ownership, D2-facing interfaces, exclusions).

Explicit, standalone DATA amendments to the frozen Q2 module
`meaning-contract.ts` (the freeze-amendment mechanism; the file header
records it):

- `QLT_RETENTION_STATES` extends to
  `['currently-relevant', 'expired', 'user-removed']` for the SIX meaning
  tables; the 07B `qlt_thread` family keeps its closed 2-state vocabulary
  (thread removal is D2; D1 never writes thread retention).
- The three subject families' content-bearing columns become NULLABLE
  (`subject`, `epistemic_type`, `honesty_state`, `confidence`,
  `commitment_key`, `loop_kind`, `exit_reason`, `content`,
  `content_fingerprint`) so a removal can write the CONTENT-FREE
  tombstone, enforced by new row CHECK fragments (not convention):
  `user-removed ⇒ all tombstone columns NULL`, plus removal bookkeeping
  consistency (`removed_by`/`removed_at_ms` present iff `user-removed`).
- Claims gain `expires_at_ms` (expiry metadata; bounds and state checks:
  `expires_at_ms` non-negative, NULL-or-currently-relevant-or-expired; a
  removed claim retains NO schedule) and the partial scan index
  `idx_qlt_claim_due_expiry`.
- Removal bookkeeping columns `removed_at_ms`/`removed_by` on the three
  subject families.
- The full amended per-table inventory (`QLT_MEANING_SCHEMA_INVENTORY`)
  mirrors migration 5 exactly; the schema-introspection gates consume it.

## 4. Retention vocabulary and state transitions (freeze §1 of the module)

Closed 3-state vocabulary; closed transition table:
`currently-relevant → expired` (enforcement pass only, claims only);
`currently-relevant → user-removed` (governed user removal, any subject
family); `expired → user-removed` (removal preempts lineage retention);
every other transition forbidden (no un-expiry, no un-removal, no agent
write, no direct-to-expired write outside the pass).

## 5. Tombstone and expiry semantics

Tombstone: removal nulls EXACTLY the frozen per-family column lists
(`QLT_D1_TOMBSTONE_NULLED_COLUMNS`) — for claims also `expires_at_ms` —
in the same transaction, preserving ids, kinds, status, version,
identities, timestamps, provenance references, and lifecycle exit
metadata. Removal bookkeeping (`removed_at_ms`, `removed_by` GLOB
`actor-*`) records who removed and when. Content-free is a STORAGE
CONSTRAINT. Expiry: user-assignable on ACTIVE, currently-relevant claims
only, future times only, clearable; commitments and open loops carry no
expiry column and can never expire.

## 6. Enforcement-pass rules

`act.runRetentionPass` (user-only): one transaction scans claims DUE by
the frozen predicate (active + currently-relevant + `expires_at_ms` ≤
now), transitions them to `expired` (version + 1), and appends ONE
`qlt_retention_pass` evidence row (examined count, expired count, bounded
expired-id list). Idempotent and convergent; keyed retries replay the
recorded report; a crash rolls the whole pass back. The pass never touches
commitments, open loops, proposals, corrections, links, or threads.
Ordinary reads NEVER apply expiry: the assembler remains time-blind
exactly as frozen in 07C.

## 7. Dependency re-evaluation (bounded)

Frozen in `QLT_D1_DEPENDENCY_REEVALUATION`: correction proposals
targeting a removed/expired record become structurally stale (confirm
refuses `target-ineligible`; the pure projection in `meaning.ts` mirrors
the rule); direct corrections of a non-currently-relevant subject are
refused (`QLT_RECORD_NOT_CURRENT`); amendments of a removed/expired
commitment are refused; everything else is untouched — no semantic
inference, no content rewriting, no transitive lineage rewrites, no
deletion, and unrelated rows stay byte-identical (N-D1-5).

## 8. Conflict identities, classifications, and challenge semantics

Exactly ONE deterministic classification in D1:
`commitment-key-conflict` — a confirmation attempt of a commitment
proposal whose `commitmentKey` already carries an ACTIVE,
currently-relevant commitment. Natural-language contradiction of
commitment text is deliberately NOT a trigger: no deterministic
non-semantic detector exists, and semantic judgment would widen agent
power. The detector is complete over the DURABLE write surface because
every meaning mutation crosses the ceremony choke points and ordinary
turns never write meaning (structurally true since 07C).

Challenge rows (`qlt_conflict_challenge`) are judgment records: created
ONLY by the confirm-time detector, attributed to the user whose attempt
triggered them, idempotent per incoming proposal (UNIQUE), lifecycle
`open → dismissed | resolved` with resolutions
`incoming-abandoned | existing-amended`, resolvable USER-ONLY through
`act.dismissChallenge` and `act.resolveChallengeWithAmendment`. A
challenge NEVER blocks, NEVER mutates, NEVER decides: the existing
commitment keeps content/key/version; the incoming proposal stays
`awaiting_decision`; the refusal to confirm the incoming proposal carries
the stable code `QLT_COMMITMENT_CONFLICT`; repeated conflicting attempts
re-raise the same refusal against the SAME challenge.

## 9. Amendment-versus-execution; clarification and judgment records

Amendment of an active commitment exists EXACTLY as the explicit
user-initiated `act.amendCommitment` operation: one successor commitment
(same key, new content, `supersedes_id`), predecessor → status `amended`
(version + 1), ONE immutable `qlt_amendment` judgment row (UNIQUE
`commitment_id + amendment_key`), and the successor --amends-->
predecessor source link (the frozen 07C relation vocabulary already
carries `amends`). Stale versions fail `QLT_VERSION_CONFLICT`; removed/
expired predecessors fail `QLT_RECORD_NOT_CURRENT`; keyed retries
converge. No other code path can produce an amendment row, an `amends`
link, or an `amended` status — execution events (turns, reads,
confirmations of unrelated proposals, corrections of other records,
lifecycle exits) are structurally incapable of becoming amendments
(N-D3-4).

Clarification boundary (frozen): D1 adds NO durable clarification artifact
and NO agent capability. A clarification is a conversation-level act; the
INV-15 requirement (ambiguous instruction → explicit clarification, never
action) is enforced by the structural no-write property of ordinary turns
plus the challenge record for the durable-conflict case. A durable
clarification record would require a new freeze amendment — justified, if
at all, by D4 real-use evidence.

## 10. Governed action/query inventory (plan addition)

New resources `qlt.retention` (Lane A) and `qlt.conflict` (Lane B), each
with ONE list query and its frozen mutations; EXACTLY eight new plan
actions:

```text
act.queryRetention / act.removeRecord / act.setClaimExpiry /
act.runRetentionPass  (resource qlt.retention)
act.queryConflict / act.amendCommitment / act.dismissChallenge /
act.resolveChallengeWithAmendment  (resource qlt.conflict)
```

Closed input contracts (`QLT_D1_CONTRACT_SPECS`): bounded plain strings
and safe-integer numbers only; every mutation keyed-idempotent and
optimistic-version-aware; every identity SERVER-DERIVED (an `agent-*`
identity can never reach these surfaces through any path). The agent
capability envelope is UNCHANGED: still exactly
`qlt.proposal.draft@3`, same closed kinds, no read/list/search, no
removal/expiry/amendment/challenge power. Stable new codes:
`QLT_COMMITMENT_CONFLICT`, `QLT_RETENTION_INVALID_TRANSITION`,
`QLT_RETENTION_EXPIRY_INVALID`, `QLT_CHALLENGE_NOT_OPEN` (the 07C code
vocabularies are unchanged and reused for everything else).

## 11. UI truthfulness and non-interruption rules

`QLT_D1_UI_PROHIBITED` / `QLT_D1_UI_REQUIRED` freeze the presentation
contract: challenges render as quiet, dismissible list rows; removed
records render content-free tombstones with retained identity; expired
records render their state; dependent re-evaluated records remain
truthfully listed; NO modal, focus theft, tray auto-open, conversation
interruption, forced decision, auto-dismissal, silent suppression, or
untruthful presentation. D1 wires NO new UI component (the browser suites
are therefore not exercised by D1 — noted truthfully); these rules bind
D2+ UI work and are enforced as contract data now.

## 12. Idempotency, replay, restart, concurrency, zero-effect

Frozen in `QLT_D1_DURABILITY_RULES`: keyed idempotency everywhere (same
key + same payload replays the settled outcome; same key + different
payload fails the established conflict code); optimistic versions; one
transaction per mutation (crash → prior state intact, never partial);
convergent pass and removal; convergent challenge creation per incoming
proposal; restart preserves every D1 row byte-identically; reads never
write.

## 13. Migration inventory and compatibility rules

Migration 5 `qlt-retention-conflict-foundations` (forward-only, ONE
transaction, deferred FK enforcement inside the transaction):

1. REBUILDS the six meaning tables in place to the amended shapes
   (SQLite cannot ALTER a CHECK). The COPY preserves every row and column
   value EXCEPT the frozen defensive rule: a legacy `user-removed` row
   (07C had no write path to that state) gets its tombstone columns
   nulled so it satisfies the new content-free constraint. Nothing is
   deleted; no content of a currently-relevant or expired row is touched.
2. ADDS `qlt_amendment`, `qlt_conflict_challenge`, `qlt_retention_pass`
   (inventories frozen in `QLT_D1_SCHEMA_INVENTORY`).

Compatibility: fresh databases apply migrations 1–5 and match the amended
inventories exactly; pre-D1 databases upgrade in place without data loss;
a recorded version newer than the build refuses the open (unchanged
forward-only discipline). Restart dumps remain identical.

## 14. Negative-control matrix (frozen; gates implement every entry)

`QLT_D1_NEGATIVE_CONTROLS`: N-D1-1..N-D1-8 (Lane A) and
N-D3-1..N-D3-9 (Lane B) — removed/expired meaning never reaches context;
reads never mutate; time passage alone does nothing; tombstones are
content-free; bounded dependency re-evaluation leaves unrelated rows
byte-identical; agent attempts fail closed (remove/expire/pass/amend/
dismiss/resolve/confirm); retry convergence; restart preservation;
conflicts never overwrite commitments; challenge convergence; stale-version
refusals; execution never mistaken for amendment; challenges epistemically
inert; conflicting-key direct refusal; lifecycle integrity
(`QLT_CHALLENGE_NOT_OPEN`); quiet non-blocking presentation. All controls
run on synthetic disposable data only.

## 15. Lane ownership and integration order

Frozen in `QLT_D1_LANE_OWNERSHIP`: freeze → schema foundation (migration 5) → Lane A (`retention-store.ts`, `retention-surface.ts`, retention
wiring, `test/d1-retention.test.ts`, `scripts/verify-d1.mjs`) → Lane B
(`conflict-store.ts`, `conflict-surface.ts`, the ceremony confirm-time
conflict hook, conflict wiring, `test/d3-conflict.test.ts`,
`scripts/verify-d3.mjs`) → gates → documentation. Shared files
(`definition.ts`, `composition.ts`, `migrations.ts`, the verify-script
re-pins) are amended exactly once per concern. The lanes execute
SEQUENTIALLY in this delivery (one implementer; no isolated parallel
workers/worktrees were available — this is reported truthfully).

## 16. D2-facing interfaces (declared; D2 NOT begun)

`QLT_D1_D2_FACING`: removal tombstone views, the pass-evidence family,
and the 3-state storage contract are what D2's governed deletion, export,
and cross-store reconciliation will consume. Deep purge, export,
conversation deletion, and cross-store reconciliation are deliberately
NOT defined here.

## 17. Exclusions and amendment procedure

`QLT_D1_EXCLUSIONS` freezes the boundary: no deep purge, export, thread
deletion, cross-store reconciliation, D4 execution/provider access, D5
audit/closure, 07E work, project scopes, autonomous initiative, ingestion,
learning, delegation; no new agent capability or widened proposal
vocabulary; no automatic expiry of commitments/loops ever; no un-expiry or
un-removal. A material change requires an explicit, standalone freeze
amendment committed BEFORE the dependent implementation continues.

## 18. Verification note

Per owner decision OD-D6, D1/D3 are covered by per-phase self-verification
only: the focused `verify:d1` / `verify:d3` gates (implemented in the
following implementation commits) plus the repository's permanent suites.
The existing 07C phase gates are re-pinned where the frozen plan inventory
legitimately grows (Q4/Q5 reconciliation precedent); no 07C assertion is
otherwise weakened. The combined independent audit remains D5 scope after
D4.
