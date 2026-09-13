# Quellight Stage 07C — Phase Q2 — Durable Shared World Schema Contract Freeze

> **Class:** Phase 0 contract-freeze record. This document (with the frozen
> declarative module `src/lib/sharedworld/meaning-contract.ts`) defines the
> EXACT Phase Q2 storage contract before any production edit. Every
> implementation lane begins from this commit and may not silently alter it;
> a material change requires the amendment procedure (§16). It is NOT an
> implementation report and closes nothing.
>
> **Governing status at freeze:**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q1 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
> PHASE Q2 DURABLE SHARED WORLD SCHEMA IMPLEMENTATION PERMITTED — NOT BEGUN
> Shared World meaning and confirmation ceremony remain unimplemented.
> Stage 07 remains In Progress.
> ```

## 0. Authority and basis

| Input                                        | Value                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight freeze starting SHA                | `2fc529f48277ee495febee4eb21b91809cb8f616` (`HEAD == origin/main`)                                                                                                                                |
| VICT read-only SHA                           | `0f4f72b0812bdfa40229a170f4d97e9696f72dd9` (`HEAD == origin/main`; untracked `.pi/` untouched)                                                                                                    |
| Canonical persistent-cognitive-partner input | SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` (reconfirmed byte-identical)                                                                                           |
| VICT release identity (unchanged by Q2)      | `@victframework/*@0.2.0`, `vict-release-set@1/0.2.0`, content ID `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`                                                            |
| Stage 07C handoff                            | `260831-VCT-02/docs/handoff/VICT-STAGE-07C-QUELLIGHT-SHARED-WORLD-MEANING-AND-CEREMONY-HANDOFF.md` (§7.1 record families; §8 ceremony vocabulary; §10 correction lineage; §19 OQ6 owner addendum) |
| Binding decisions                            | GOV-007 / D-8 (VICT semantic authority); OQ6 (ratified launch authority model); D-10 (governed VICT 0.2.0 boundary); D-9 (entry gate — resolved by D-10); Q1 formal-closure entry boundary        |
| Normative code artifact of this freeze       | `src/lib/sharedworld/meaning-contract.ts` (frozen data/types; committed in this same commit)                                                                                                      |

The user remains final Shared World authority. An explicit user-authored
Save constitutes confirmation (OQ6 §19.2 consequence 3, represented in the
repository contract as a direct user-authority create with `createdBy` =
user actor). An agent may propose but may never confirm or silently
promote meaning. Proposal staleness is caused by referenced source or
target-version change, never by elapsed time (§19.3).

## 1. Scope — what Q2 builds

The Quellight-owned storage foundation for durable Shared World meaning in
`shared-world.db` (one Quellight-owned SQLite file, unchanged placement):

1. one additive SQLite migration (version 2) creating six new tables and
   their indexes, CHECK constraints, and foreign keys;
2. closed domain schemas and validators (pure functions over untrusted
   input — the FENCE-1 resolution for every new Shared World input
   contract);
3. product-owned ports and a SQLite repository implementing the frozen
   `SharedWorldMeaningStore` port;
4. deterministic lifecycle, staleness, eligibility, and lineage rules;
5. provenance and retention-ready metadata columns on every family;
6. durable transaction and idempotency invariants;
7. repository-level inspection reads (including deterministic
   current-effective resolution);
8. permanent conformance tests, adversarial negative controls, and a
   focused `verify:q2` aggregate wired beside the existing gates.

Q2 makes later proposal/confirmation work POSSIBLE; it activates NO
production meaning-writing path. Schema existence, row persistence, or a
lifecycle label alone never makes material canonical, model-visible, or
user-confirmed.

## 2. Table and index inventory (migration 2)

Migration identifier: `version 2`, `name 'qlt-meaning-foundation'`, applied
after migration 1 (`qlt-thread-foundation`) by the existing forward-only
bookkeeping (`quellight_shared_world_migrations`), inside one transaction,
`BEGIN IMMEDIATE`-protected, atomic, additive (`CREATE TABLE`/`CREATE
INDEX` only). `QLT_SHARED_WORLD_SCHEMA_VERSION` becomes `2`. Reopening an
already-migrated database re-applies nothing and mutates no schema state.
A store written by a NEWER schema still refuses to open.

| Table             | Purpose (handoff §7.1 family)                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qlt_proposal`    | Proposal/ceremony record — agent-drafted meaning; epistemically inert in every status                                                                         |
| `qlt_claim`       | Epistemic claim (E1–E7 typed)                                                                                                                                 |
| `qlt_commitment`  | Standing intention with normative force (distinct from loops)                                                                                                 |
| `qlt_open_loop`   | Unresolved pending action / undecided question / expected event                                                                                               |
| `qlt_correction`  | Append-only correction-lineage record                                                                                                                         |
| `qlt_source_link` | Immutable provenance/lineage link records                                                                                                                     |
| (columns)         | Retention metadata (`retention_state`) lives on every family table — the closed 07B/07C vocabulary `currently-relevant` \| `user-removed`; no 07D enforcement |

Indexes (16 total): `idx_qlt_proposal_status`, `idx_qlt_proposal_thread`,
`uq_qlt_proposal_open_per_turn` (partial unique — one OPEN proposal per
`(source_thread_id, proposal_kind, source_turn_ref)` while `status ∈
{proposed, awaiting_decision}`), `idx_qlt_claim_subject`,
`idx_qlt_claim_eligible`, `uq_qlt_commitment_active_key` (partial unique —
one ACTIVE commitment per commitment key), `idx_qlt_commitment_key`,
`idx_qlt_commitment_eligible`, `idx_qlt_open_loop_thread`,
`idx_qlt_open_loop_subject`, `idx_qlt_open_loop_eligible`,
`uq_qlt_correction_subject_key` (unique — one correction per `(subject,
correction_key)`), `uq_qlt_source_link` (unique per `(from, to_kind,
to_ref, relation)`), plus `idx_qlt_source_link_from`,
`idx_qlt_source_link_to`. The connection enables `PRAGMA foreign_keys =
ON`; every declared FK is consequently enforced.

The exact DDL is normative and reproduced in
`src/lib/sharedworld/meaning-contract.ts` as the machine-readable
`QLT_MEANING_SCHEMA_INVENTORY` (columns/types/nullability/defaults,
indexes with uniqueness and partial WHERE, foreign keys, and required CHECK
fragments). Schema-introspection gates compare live `sqlite_master` and
pragma output against that inventory — any drift fails. Storage guards:
`content` bounded by `length(CAST(content AS BLOB)) <= 4096` (UTF-8
bytes); fingerprints are 64-char sha256 hex; identities carry `GLOB`
pattern CHECKs; `decision_by`/`decided_at_ms` presence is CHECK-coupled to
decided statuses; correction rows are CHECK-frozen at `version = 1`,
`status = 'recorded'`; `supersedes_id` is self-reference-proof (`<>
id`); loop exits are CHECK-coupled to `exit_by`/`exited_at_ms` presence;
polymorphic references (`subject_record_id`, `from_record_id`) are
documented non-FK with family CHECKs and repository-level existence
enforcement.

## 3. Stable identifiers and version fields

- `id`: TEXT PRIMARY KEY, `qlt-`-prefixed, server-generated (existing
  convention; injectable deterministic factories for tests), validated
  against `QLT_SAFE_ID_PATTERN` (≤ 128).
- `version`: INTEGER NOT NULL DEFAULT 1, monotonic per record. EVERY
  lifecycle status transition bumps `version` by exactly 1 through the
  repository; content is NEVER mutated in place. Corrections create a NEW
  record (new id, version 1, `supersedes_id` set); the predecessor keeps
  its content bytes and gains `status = superseded`, `version + 1`.
  Correction rows are immutable (`version = 1` forever, by CHECK).
- Optimistic concurrency: every transition verb accepts
  `expectedVersion`; mismatch → `QLT_VERSION_CONFLICT`, zero effects.
- `source_turn_ref` / `source_thread_id`: bounded conversation provenance
  (source = thread + conversation correlation + turn reference).

## 4. Closed lifecycle vocabularies and transitions

Frozen transition tables (the ONLY allowed transitions; anything else
fails closed with the family's stable code):

| Family           | Vocabulary                                                                                             | Transitions                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qlt_proposal`   | `proposed → awaiting_decision → confirmed \| rejected \| amended \| withdrawn`                         | `proposed → {awaiting_decision, withdrawn}`; `awaiting_decision → {confirmed, rejected, amended, withdrawn}`; the four decided states are terminal |
| `qlt_claim`      | `active → superseded \| retired`                                                                       | `active → {superseded, retired}`; terminal otherwise                                                                                               |
| `qlt_commitment` | `active → released \| superseded \| amended`                                                           | `active → {released, superseded, amended}`; terminal otherwise                                                                                     |
| `qlt_open_loop`  | `open → resolved \| superseded \| abandoned \| transformed` (exactly the four canonical exits, INV-06) | `open → {resolved, superseded, abandoned, transformed}`; terminal otherwise                                                                        |
| `qlt_correction` | `recorded` (append-only; no state machine)                                                             | none                                                                                                                                               |
| retention        | `currently-relevant \| user-removed`                                                                   | columns preserved for 07D; Q2 implements no retention mutation verb                                                                                |

Loop exits require an exiting user identity; `abandon` and `transform`
additionally require a reason (canonical §5.5). Every exit records
`exit_by` (user pattern), `exited_at_ms`, optional `exit_reason` — CHECK-
coupled so an exited loop without exit provenance is structurally
impossible.

## 5. TypeScript domain and port interfaces

Normative and frozen: `src/lib/sharedworld/meaning-contract.ts` exports
the closed vocabularies, record types (`QltProposal`, `QltClaim`,
`QltCommitment`, `QltOpenLoop`, `QltCorrection`, `QltSourceLink`), content
schemas (`QltClaimProposalContent`, …, `QltClaimContent`, …), input types
(`QltCreateProposalInput`, `QltConfirmProposalInput`, `QltApplyCorrectionInput`, …),
the `SharedWorldMeaningStore` port (§7), the parse-result type
(`QltParseResult<T>` with code+path issues that never echo values), the
structured `QltMeaningError`, and the frozen serializer
(`canonicalJson` / `contentFingerprint`).

Implementation modules (lane-owned, conform to the contract):

- `src/lib/sharedworld/meaning.ts` — pure domain layer: closed validators
  for every untrusted input surface, lifecycle transition assertion,
  authority predicates (who may confirm/decide/correct), the OQ6
  version-eligibility staleness predicate, canonical-eligibility
  predicates, correction-lineage validation, normalization helpers;
- `src/lib/sharedworld/meaning-store.ts` — the SQLite repository
  implementing `SharedWorldMeaningStore` over the shared `shared-world.db`
  connection; wired into `SharedWorldSqlite` as `readonly meaning`.

## 6. Validator limits and stable rejection codes

Bounds (all frozen in the contract module): content ≤ 4096 canonical UTF-8
bytes; statement/detail ≤ 2000 chars; subject ≤ 200; commitment/
correction keys ≤ 200; reason ≤ 500; ids ≤ 128; source refs ≤ 200; JSON
depth ≤ 6; ≤ 32 keys per object level; ≤ 100 array items. The byte bound
is the hard limit (a 2000-char multibyte statement exceeding 4096 bytes
fails).

Stable, non-echoing codes (issues carry code + structural path ONLY —
never a value): `QLT_INPUT_NOT_OBJECT`, `QLT_INPUT_INVALID_CONTAINER`,
`QLT_INPUT_UNKNOWN_FIELD`, `QLT_INPUT_MISSING_FIELD`,
`QLT_INPUT_INVALID_TYPE`, `QLT_INPUT_INVALID_ENUM`, `QLT_INPUT_INVALID_ID`,
`QLT_INPUT_INVALID_IDENTITY`, `QLT_INPUT_OVERSIZE`, `QLT_INPUT_OVERDEPTH`,
`QLT_INPUT_KEY_LIMIT`, `QLT_INPUT_ARRAY_LIMIT`, `QLT_INPUT_PROTO_KEY`,
`QLT_INPUT_NOT_SERIALIZABLE`; store codes `QLT_RECORD_MISSING`,
`QLT_RECORD_EXISTS`, `QLT_RECORD_NOT_CURRENT`, `QLT_THREAD_MISSING`,
`QLT_PROPOSAL_INVALID_TRANSITION`, `QLT_PROPOSAL_ALREADY_DECIDED`,
`QLT_PROPOSAL_STALE`, `QLT_CORRECTION_TARGET_REQUIRED`,
`QLT_CLAIM_INVALID_TRANSITION`, `QLT_COMMITMENT_INVALID_TRANSITION`,
`QLT_LOOP_INVALID_TRANSITION`, `QLT_CORRECTION_DUPLICATE`,
`QLT_CORRECTION_CONFLICT`, `QLT_LINEAGE_INVALID`, `QLT_CONFIRMER_INVALID`,
`QLT_IDEMPOTENCY_CONFLICT`, `QLT_VERSION_CONFLICT`, `QLT_STORE_ERROR`.

**FENCE-1 resolution for the new contracts (binding):** unknown fields are
REJECTED (`QLT_INPUT_UNKNOWN_FIELD`) — silent field dropping does not
become the Q2 contract. An own `__proto__` key at any depth is REJECTED
(`QLT_INPUT_PROTO_KEY`); own `constructor`/`prototype` keys are treated as
plain own data and are unknown fields in every closed schema (rejected);
validators read input, never write it, and build results from explicit
literals — prototype pollution is structurally impossible (negative
controls prove the global prototype stays untouched). Exotic containers
(non-plain prototypes), non-serializable values (functions, symbols,
BigInt, undefined, non-finite numbers, Date/RegExp instances, cycles),
over-deep nesting, key/array overflow, and oversized strings/UTF-8 bytes
all fail closed with the codes above. Normalization is deterministic:
canonical serialization sorts object keys, so the same logical content in
different key-insertion orders yields the same canonical bytes and the
same fingerprint. Credential/secret material in rejected input is never
persisted and never echoed.

## 7. Repository method signatures

Normative: `SharedWorldMeaningStore` in
`src/lib/sharedworld/meaning-contract.ts`. Summary:

```text
createProposal / getProposal / listProposals
markProposalAwaitingDecision(proposalId, {expectedVersion?, now?, key?})
confirmProposal({proposalId, confirmedBy, expectedVersion?, key?, now?})
  → {proposal, createdRecords[], correction?}   (ONE transaction)
rejectProposal / withdrawProposal / amendProposal
createClaim / createCommitment / createOpenLoop   (user Save = confirmation)
getClaim / getCommitment / getOpenLoop; listClaims / listCommitments / listOpenLoops
retireClaim / releaseCommitment / resolveLoop / abandonLoop / transformLoop
applyCorrection({subjectRecordId, subjectFamily, correctionKey, content,
                 correctedBy, reason?, expectedVersion?, ...})
  → {correction, predecessor, successor}        (ONE transaction)
getCorrection / listCorrections({subjectRecordId})
listSourceLinks({fromRecordId})
resolveCurrentEffectiveClaim(subject) / resolveCurrentEffectiveCommitment(key)
resolveCurrentEffectiveOpenLoop(subject)
close()
```

Q2 wiring: the repository is exposed as `SharedWorldSqlite.meaning` (same
file, same connection, same migration path — the future ceremony needs
ONE transaction across proposal + records + links). NO route, island,
application action, agent capability, or context assembler references it.

## 8. Authority, provenance, lineage, idempotency, canonical-eligibility invariants

1. **Epistemic inertness of proposals.** A proposal asserts nothing about
   the world in ANY status. `QLT_CANONICAL_ELIGIBLE_STATUSES.proposal` is
   empty; no repository read presents a proposal as canonical meaning;
   only `confirmed` proposals carry created-record links (written by the
   confirm transaction itself).
2. **The agent cannot confirm.** Confirm/decide/correct/amend identities
   MUST match `QLT_USER_ACTOR_PATTERN` (`actor-*`); an `agent-*` identity
   in any confirmer-class field fails `QLT_CONFIRMER_INVALID` /
   `QLT_INPUT_INVALID_IDENTITY` (CHECK-enforced at the storage layer too).
   `proposed_by` accepts `agent-*` or `actor-*`; `withdrawn_by` accepts
   either (agent/product-policy withdrawal before decision).
3. **Confirmation identity is attributable to the user.** Decided
   proposals carry `decision_by` + `decided_at_ms` (CHECK-coupled to the
   decided statuses); created records carry `created_by` (user pattern)
   and a `proposed-from` source link to the proposal; the proposal links
   back through `confirmProposal`'s outcome records. A missing confirmer
   is rejected.
4. **User-authored Save = confirmation.** `createClaim` /
   `createCommitment` / `createOpenLoop` create ACTIVE/OPEN records
   directly with `createdBy` = user actor — the durable representation of
   the explicit Save ceremony (OQ6 §19.2.3); no agent path exists to them.
5. **Staleness is version-eligibility, never time.** `proposalStaleness`
   inspects ONLY: (a) correction-kind proposals — the target record's
   CURRENT version ≠ drafted-against version, or its status is no longer
   current-effective (`superseded`/`retired`/`released`/…), or its
   retention state is `user-removed` → stale (`target-version-changed` /
   `target-superseded` / `target-ineligible`); (b) any proposal — source
   thread missing or `user-removed` → stale (`source-missing` /
   `source-removed`). Elapsed time appears NOWHERE in the predicate
   (negative-controlled: an arbitrarily old proposal with unchanged
   references remains confirmable). `confirmProposal` re-checks staleness
   against CURRENT storage state and refuses stale proposals with
   `QLT_PROPOSAL_STALE` — a stale proposal cannot be confirmed unchanged
   (amendment/regeneration is the Q3 path).
6. **Rejected/withdrawn proposals create no canonical record.** Only the
   confirm transition writes substantive records; reject/withdraw/
   amend-without-confirm write none; a decided proposal refuses further
   decisions (`QLT_PROPOSAL_ALREADY_DECIDED`).
7. **Corrections append history.** `applyCorrection` inserts the immutable
   correction row (prior content fingerprint recorded), creates the
   successor (new id, `supersedes_id`, same family shape), and marks the
   predecessor `superseded` (version+1) — the predecessor's content bytes
   are never mutated and remain attributable. Correction rows and links
   are append-only (no update path exists).
8. **Correction cycles and duplicate successors fail closed.** One
   correction per `(subject, correction_key)` (UNIQUE; same-key replay
   converges idempotently to the SAME successor; same-key-different-
   content fails `QLT_IDEMPOTENCY_CONFLICT`). A different key against a
   non-current subject fails `QLT_RECORD_NOT_CURRENT` — a superseded
   record can never gain a second successor. `supersedes_id <> id` is
   CHECK-enforced; successors always point backward (fresh ids), so the
   lineage is a forest; the pure lineage validator additionally proves
   chain termination on crafted inputs (negative control).
9. **Deterministic current-effective resolution.** Among a subject's
   records with eligible status and `currently-relevant` retention: order
   by `effective_at_ms DESC, created_at_ms DESC, id ASC`; the first is
   current-effective. Implemented twice (SQL read + pure function) and
   parity-tested.
10. **Superseded material is context-ineligible; deletion stays possible.**
    Eligibility predicates require eligible status ∧ `currently-relevant`;
    no Q2 path ever rewrites or deletes rows (07D tombstone semantics stay
    possible: retention columns + lineage refs are content-free and
    future-compatible).
11. **Idempotency.** Keyed verbs record
    `scope_key = '<scope>::<verb>::<key>'` in `qlt_adapter_idempotency`
    IN THE SAME TRANSACTION as their effect (a failed transaction never
    consumes a key). Same key + same canonical fingerprint → converge
    (return the existing row; no duplicate rows). Same key + different
    content → `QLT_IDEMPOTENCY_CONFLICT`. Concurrent duplicate writes
    converge to one row (serialized by `BEGIN IMMEDIATE`).
12. **Failed validation and failed transactions leave zero partial
    effects** (row-count negative controls on every failure class).

## 9. Timestamp and deterministic-serialization rules

All timestamps are server-clock epoch-ms integers (`created_at_ms`,
`updated_at_ms`, `effective_at_ms`; decision/exit timestamps where
applicable), injected via the store clock for determinism. Creation sets
all three to `now`; transitions update `updated_at_ms` only;
`effective_at_ms` never changes after creation (successors get their own).
No elapsed-time comparison exists anywhere in the meaning contract.
Serialization is `canonicalJson` (sorted keys, whitespace-free, UTF-8) and
`contentFingerprint` (sha256 hex); content is stored as canonical JSON
text under the 4096-byte CHECK.

## 10. Enforcement-layer assignment

| Invariant                                                                                                                                                                                                                                                        | Enforced by                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Closed lifecycle vocabularies; retention vocabulary; identity patterns; byte/fingerprint bounds; self-reference and exit-provenance coupling; correction immutability                                                                                            | SQLite CHECK constraints (+ indexes/UNIQUE/FK)                                                                        |
| Closed input field sets, types, enums, char/UTF-8 byte bounds, depth/key/array bounds, proto-key rejection, non-serializable rejection, deterministic normalization                                                                                              | Domain validators (`meaning.ts`) — the ONLY fence for untrusted input                                                 |
| Transaction atomicity (ceremony confirm; correction append; keyed idempotency same-transaction), optimistic version checks, staleness re-check at confirm time, duplicate-successor/one-correction-per-subject rules, deterministic ordering, FK-enabling pragma | Repository transactions (`meaning-store.ts`)                                                                          |
| Agent-never-confirmer; proposal inertness; eligibility of context material                                                                                                                                                                                       | Domain predicates + structural gates (no production caller exists) — Q3 wires the governed VICT 0.2.0 boundary on top |

## 11. Q2 exclusions (all forbidden now)

Production proposal/confirmation/rejection/amendment/correction/commitment
actions; `/api/act` extension; any new HTTP route or UI control; agent
tools/capabilities; context assembly or prompt construction from records;
retention/deletion enforcement (07D); autonomous learning; ingestion;
multi-tenant behavior; any alternate effect path; changes to VICT packages,
framework semantics, package pins, or the Application Definition's
declared action set (the five thread actions remain the entire surface).
TEST-1 (browser replay recovery) remains open with its binding deadline:
no later than Q3 verification — Q2 adds no browser action.

## 12. File-ownership map (parallel lanes)

| File                                                                                                                                                                                                                                                                                                                  | Lane                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`, `src/lib/sharedworld/meaning-contract.ts`                                                                                                                                                                                                              | Phase 0 freeze (integration owner; frozen for all lanes) |
| `src/lib/sharedworld/migrations.ts` (edit: migration 2 only), `src/lib/sharedworld/meaning-store.ts` (new), `src/lib/sharedworld/sqlite.ts` (edit: wire `meaning` port + `PRAGMA foreign_keys`), `test/meaning-foundation.test.ts` (new), `test/sharedworld.test.ts` (edit: bookkeeping assertion only, [1..current]) | Lane A — SQLite foundation                               |
| `src/lib/sharedworld/meaning.ts` (new)                                                                                                                                                                                                                                                                                | Lane B — domain contracts                                |
| `test/sharedworld-meaning.test.ts` (new), `scripts/verify-q2.mjs` (new), `package.json` (edit: `verify:q2` script only), `scripts/verify-quellight.mjs` (edit: add verify:q2 step only)                                                                                                                               | Lane C — conformance + verifier                          |

No two lanes share a file; no lane touches `package-lock.json`, the VICT
repository, `.pi/` material, historical reports, or the canonical input.
Lanes A and B run in parallel from this exact freeze commit (branching is
one-directional: both depend only on the frozen contract module); Lane C's
black-box suite is inherently downstream of both implementations and runs
as the third lane after their integration — recorded honestly as the
parallel/sequential mix actually used.

## 13. Acceptance and negative-control matrix (numbered)

Lane C's permanent suite (plus Lane A foundation fixtures and `verify:q2`)
must prove every row; every important semantic assertion has an
independently inspectable negative control.

| #    | Control                                                                                                                     | Expected                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Fresh-database migration; introspect tables/columns/indexes/FKs/CHECKs                                                      | Exactly the frozen inventory; no drift                                                                                                                        |
| A-02 | Upgrade from the Q1 (migration-1) schema with existing thread + conversation rows                                           | Rows byte-preserved; meaning tables added; bookkeeping `[1, 2]`                                                                                               |
| A-03 | Injected failure inside migration 2 (pre-existing conflicting table)                                                        | Atomic rollback; bookkeeping unchanged; store still opens at v1; no partial schema                                                                            |
| A-04 | Close/reopen migrated store (restart)                                                                                       | Schema state identical (full sqlite_master dump); no re-application; rows intact; version stable                                                              |
| A-05 | Store written by schema version 3 refuses to open                                                                           | Forward-only refusal (existing discipline intact)                                                                                                             |
| A-06 | Round-trip persistence for every family (proposal, claim, commitment, loop, correction, source link)                        | Create → fetch → list; typed content and provenance preserved; retention default `currently-relevant`; version 1                                              |
| A-07 | Deterministic serialization and ordering                                                                                    | Same logical content, different key order → same fingerprint/canonical bytes; list ordering deterministic with stable tie-breaks                              |
| A-08 | Valid lifecycle transitions (all families) succeed                                                                          | Status changes, version +1, timestamps truthful                                                                                                               |
| A-09 | Invalid transitions and terminal-state writes                                                                               | Fail closed with the family's stable code; zero effects                                                                                                       |
| A-10 | Agent self-confirmation attempt (`agent-*` confirmer)                                                                       | `QLT_CONFIRMER_INVALID`; zero effects                                                                                                                         |
| A-11 | Missing/blank confirmer where confirmation requires one                                                                     | Rejected; zero effects                                                                                                                                        |
| A-12 | Ceremony confirm creates target record + links in ONE transaction                                                           | Proposal `confirmed`; record exists exactly once; `proposed-from` link present; outcome attributable                                                          |
| A-13 | Version-based staleness: target version changed / superseded / removed                                                      | Proposal stale; confirm fails `QLT_PROPOSAL_STALE`; zero effects                                                                                              |
| A-14 | Elapsed time alone never creates staleness                                                                                  | Ancient proposal with unchanged references confirms normally (clock far advanced)                                                                             |
| A-15 | Rejected and withdrawn proposals cannot produce canonical records                                                           | No substantive row exists; eligibility empty; re-decision refused                                                                                             |
| A-16 | Duplicate idempotency key converges                                                                                         | Same key + same content → same row, no duplicates (every keyed verb)                                                                                          |
| A-17 | Same key with conflicting content fails closed                                                                              | `QLT_IDEMPOTENCY_CONFLICT`; original effect intact                                                                                                            |
| A-18 | Concurrent duplicate writes converge                                                                                        | Exactly one row; no partial effects                                                                                                                           |
| A-19 | Correction lineage append-only                                                                                              | Correction row immutable; predecessor content bytes unchanged; successor linked; `version` semantics hold                                                     |
| A-20 | Rejected correction changes nothing                                                                                         | Rejecting a correction-kind proposal leaves the target current/effective; no successor exists                                                                 |
| A-21 | Duplicate successor / lineage cycle rejected                                                                                | Second successor refused `QLT_RECORD_NOT_CURRENT`; same-key replay converges; crafted cycle input fails the pure lineage validator; self-reference impossible |
| A-22 | Deterministic current-effective resolution (SQL vs pure parity)                                                             | Identical winner on crafted tie/conflict sets                                                                                                                 |
| A-23 | Eligibility: pending, rejected, stale, superseded, retention-ineligible fail; confirmed eligible pass and stay attributable | Predicate + inspection reads agree; proposal always ineligible                                                                                                |
| A-24 | Unknown, oversized, malformed, nested, special-key, non-serializable inputs fail closed                                     | Stable codes; zero rows; zero value echo                                                                                                                      |
| A-25 | UTF-8 byte bounds with multibyte content at and around 4096 bytes                                                           | Byte-accurate accept/reject (character-count regressions fail the test)                                                                                       |
| A-26 | Failed validation and failed transactions leave zero partial effects                                                        | Row/link counts identical before/after (incl. injected UNIQUE failure mid-transaction)                                                                        |
| A-27 | SQL parameters cannot escape into SQL structure                                                                             | Metacharacter-laden content round-trips as data; schema intact                                                                                                |
| A-28 | Credential canaries never persist or echo                                                                                   | Rejected input leaves no store byte, no diagnostic, no metadata                                                                                               |
| A-29 | No route, UI, application action, agent tool, or context assembler is wired to the meaning store                            | Structural scan (verify:q2): plan actions exactly the five thread actions; no meaning-store import outside the sharedworld module and tests                   |
| A-30 | Existing Q1 behavior stays green; VICT pins unchanged                                                                       | Existing suites untouched-and-green; `@victframework/*@0.2.0` exact; `verify:consumer` and `verify:governance` pass unmodified                                |

## 14. Migration DDL (normative summary)

The complete DDL is carried by the frozen inventory
(`QLT_MEANING_SCHEMA_INVENTORY`) and Lane A's migration; §2 lists tables,
indexes, and guard fragments. The migration body is additive
`CREATE TABLE`/`CREATE INDEX` statements ONLY, wrapped in the existing
`BEGIN IMMEDIATE` bookkeeping transaction; it neither reads nor writes
pre-existing user rows and is incapable of deleting or rewriting them.

## 15. Verification wiring

`npm run verify:q2` (Lane C) runs ONLY stable Q2 checks: schema
introspection vs the frozen inventory on a fresh store; migration
bookkeeping; structural no-production-wiring gates; compiled-plan action
inventory; release-pin spot check; focused repository/lifecycle/lineage
deterministic checks with clear per-section counts. It is wired into the
aggregate `verify:quellight` as an additional step WITHOUT weakening,
replacing, or reordering any existing step.

## 16. Amendment procedure

If implementation evidence requires a material change to this contract,
the affected lanes STOP; the integration owner reconciles the change ONCE,
records the amendment in this document (dated addendum; no silent edits),
and restarts affected lanes from the amended contract SHA.
