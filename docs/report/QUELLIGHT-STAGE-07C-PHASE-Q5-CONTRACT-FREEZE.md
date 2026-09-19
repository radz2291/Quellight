# Quellight Stage 07C — Phase Q5 — Shared World Inspection and User Memory Control Contract Freeze

> **Class:** Phase 0 contract-freeze record. This document (with the frozen
> declarative modules `src/lib/sharedworld/policy-contract.ts` and
> `src/lib/sharedworld/inspection-contract.ts`, plus the dated Q4 contract
> amendment recorded in §10) defines the EXACT Phase Q5 contract before any
> production edit. Every implementation lane begins from this commit and may
> not silently alter it; a material change requires the amendment procedure
> (§19). It is NOT an implementation report and closes nothing.
>
> **Governing status at freeze:**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q4 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
> Q4 is Verified with Non-Blocking Issues and formally closed; H-1 remediated and independently re-verified closed.
> PHASE Q5 IMPLEMENTATION HAS NOT BEGUN (this freeze begins it)
> Stage 07 remains In Progress.
> ```

## 0. Authority and basis

| Input                                   | Value                                                                                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight freeze starting SHA           | `587e3b4dcd7f94807e64a05f8e8bf32d4534b62a` (`HEAD == origin/main`, fetch-verified; clean tracked state; linear ancestry)                                                                            |
| VICT read-only SHA                      | `4b9fed21430787a72eda76b1b72d448f234f05fa` (`HEAD == origin/main`; fetch advanced nothing; pre-existing untracked `.pi/` untouched and unread)                                                      |
| Conflicting Q5 / later work             | none found on either remote (histories inspected; no Q5+ or conflicting phase work exists)                                                                                                          |
| VICT release identity (unchanged by Q5) | `@victframework/*@0.2.0`, `vict-release-set@1/0.2.0`, content ID `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`                                                              |
| Frozen prior contracts (unchanged)      | Q2 `meaning-contract.ts`, Q3 `ceremony-contract.ts`, Q4 `context-contract.ts` (the Q4 module receives ONLY the dated amendment of §10; no other byte changes)                                       |
| Binding decisions                       | Q5-OD-1 (§2, owner-approved); D-Q4-H1-1 (one active turn per conversation); D-Q4-1..6 (unchanged); OQ6 §19; GOV-007 / D-8; D-10; D-11                                                               |
| Carried obligations honored             | M-1 (open; hard deadline before the Phase Q6 live-provider proof and the Stage 07C final audit — recorded, NOT implemented); L-3 (repaired narrowly in Q5, §13); L-R1/L-R2 (unchanged, carried)     |
| Normative code artifacts of this freeze | `src/lib/sharedworld/policy-contract.ts`, `src/lib/sharedworld/inspection-contract.ts` (frozen identifiers, vocabularies, bounds, schema inventories, codes as DATA; committed in this same commit) |

The user remains the final Shared World authority. Q5 makes the EXISTING
Shared World understandable and controllable by the user: read-only
inspection, lifecycle controls in the UI, one durable global Memory Mode,
the narrow L-3 repair, and a zero-warning development-start gate. Q5 gives
the agent NO new capability: the envelope remains EXACTLY
`qlt.proposal.draft@1`; all Q5 inspection and decisions are user-facing
application surface only.

## 1. Objective and exclusions

**Objective (human terms).** You can open one quiet Memory surface and see
exactly four things: what memory is waiting for your decision (Pending),
what memory is currently true and in force (Current), what has ended and
what replaced it (History), and — reply by reply — which memory a past
reply actually used, under which Memory Mode, and what was excluded
(Used for reply). You can correct, retire, release, resolve, abandon, or
transform current memory from that surface, and you can set one durable
Memory Mode that governs all conversations. Nothing about the agent
changes: it still can only draft inert proposals, and it can never inspect,
list, search, decide, or change Memory Mode.

**Q5 delivers:** sequential contract freeze (this document); migration 4
(Memory Mode policy storage + immutable per-turn applied-policy evidence);
the typed effective-policy resolver and its single assembler consumption
point; the `scope-excluded` exclusion evidence; the narrow L-3 production
repair; the `qlt.inspection@1` read surface and the `qlt.memory-policy@1`
mutation surface through the ONE governed boundary; the four-area Memory UI
with lifecycle controls and the Memory Mode control; the three Svelte
warning repairs and the permanent zero-warning dev-start gate; independent
adversarial tests and the `verify:q5` gate; the extended browser-ceremony
session; and the implementation report.

**Q5 excludes** (all forbidden now): project-scoped conversations;
`projectId` fields, nullable placeholder columns, project tables,
selectors, UI, fake project records, project precedence rules,
client-supplied scope identities, or speculative generic policy platforms;
per-project or per-conversation Memory Mode overrides; per-turn user scope
controls; deletion, tombstone writes, export, or full retention
enforcement; live provider calls; live-model injection-resistance proof;
M-1's VICT package correction (recorded, not implemented); new agent
read/list/search capabilities; autonomous cycles; turn steering; queuing
or parallel replies; multi-process/multi-tenant claims; Q6/Q7 work; and
any change to VICT (read-only).

## 2. Owner decision Q5-OD-1 — one global, durable Memory Mode (binding)

Exactly these user-facing choices, with these stable internal identities:

```text
Across conversations             ← default    identity: 'across-conversations'
Within each conversation only                 identity: 'per-conversation'
Memory off                                    identity: 'off'
```

Exact semantics:

- **`across-conversations`** preserves Q4's current behavior exactly:
  eligible confirmed memory may come from the current conversation,
  global/threadless memory, and other conversations under the existing
  deterministic layers (`current-thread` → `global` → `other-thread`),
  ordering (`open_loop` → `commitment` → `claim`, then
  `updatedAt DESC, id ASC`), and budgets (8 records / 4096 UTF-8 bytes,
  whole-record skipping). The injected Q4 context bytes, replay, restart,
  and failure behavior are unchanged.
- **`per-conversation`**: each conversation may use only eligible memory
  originating in that same conversation (`current-thread` layer only).
  Global/threadless and other-conversation records are excluded with
  truthful bounded `scope-excluded` evidence. All remaining Q4 ordering
  and budget laws are preserved.
- **`off`**: zero Shared World memory injection into later turns; truthful
  immutable applied-policy evidence is still recorded; a historical
  Used-for-reply view must report "memory was intentionally off", never
  "no memory existed", when mode was off.

Control properties (all binding): lives only inside the user-opened Memory
surface; clearly says it applies to all conversations; defaults to
`across-conversations`; persists across restart; changed through one
declared, user-attributed, idempotent governed mutation (`act.setMemoryMode`);
never appears as a per-message prompt; never opens automatically or
interrupts conversation; affects the next not-yet-started turn; never
changes a turn already admitted or an in-flight frozen snapshot; cannot be
supplied or overridden by the browser's turn request, the model, or the
agent. Scope cannot be forged through the turns ingress; unknown client
fields continue to fail closed. Invalid modes fail closed and non-echoing
with the stable Q5 code `QLT_MEMORY_MODE_INVALID`. Same-key Memory Mode
retries converge; conflicting same-key content fails with the established
idempotency conflict behavior (`VICT_COMMAND_IDEMPOTENCY_CONFLICT` at the
released boundary).

## 3. The four-area Memory experience (frozen)

The existing memory tray inside `ConversationWorkspace.svelte` is
restructured into exactly four user-selectable areas, one visible at a
time, plus the Memory Mode control. The tray remains the Q3/Q4 quiet
surface: user-opened only, never modal, never auto-opened, never blocking.

### 3.1 Pending

- Shows proposed/awaiting-decision items separately from canonical memory
  (exactly the rows with `kind = 'proposal'` and status
  `proposed | awaiting_decision`).
- Preserves existing Confirm, Edit (amend), Reject, and Withdraw behavior
  unchanged (same declared actions, same governed boundary, same
  idempotency).
- Stale proposals remain visibly out of date (`out of date` status);
  unchanged confirmation refuses truthfully (`QLT_PROPOSAL_STALE`
  surfaced; zero canonical effect) — Q4 behavior unchanged.
- Terminal proposals NEVER render here.

### 3.2 Current

- Shows current-effective canonical memory only: claims `active`,
  commitments `active`, open loops `open`, no successor, retention
  `currently-relevant` (the Q4 eligibility set, presented).
- Each row shows: human-readable kind (Claim / Commitment / Open
  question); current content; origin (`this conversation` |
  `another conversation` | `saved without a conversation`, derived from
  `sourceThreadId` compared to the open thread — never a raw id);
  created/updated timestamps; current status.
- Lifecycle controls appropriate to the family: Correct (all families);
  Retire claim; Release commitment; Resolve loop; Abandon loop (reason
  required); Transform loop (reason required). Reason-required exits use
  an inline input (no browser-native blocking dialogs; decisions stay
  inline and accessible).
- All writes cross `UI → declared application action → /api/act →
released VICT mutation boundary → resolved Quellight handler → one
transaction`. No direct database mutation from routes or components.
  User attribution, exact version checks, append-only corrections,
  immutable predecessor bytes, keyed idempotency, zero partial effects,
  restart truth, and stable non-echoing failures are preserved unchanged.

### 3.3 History

- Shows terminal proposals (`confirmed`, `rejected`, `amended`,
  `withdrawn`) and closed/superseded records (`superseded`, `retired`,
  `released`, `resolved`, `abandoned`, `transformed`) truthfully.
- Each row shows: what state ended it (status); what replaced it where
  applicable (successor relationship); the correction reason where one
  exists; the correcting/deciding user; predecessor/successor
  relationship; timestamps; and an optional technical-details disclosure.
- History is INSPECT-ONLY: no restoration, deletion, or reactivation
  semantics exist. No new actions are added for History rows.

### 3.4 Used for reply

- Provides a bounded chooser of completed turns in the current
  conversation (newest first, deterministic, bounded list).
- For each selected turn the surface shows RECORDED evidence only — it
  never recomputes an old turn with current records or current policy:
  - whether memory was used, intentionally disabled, empty, unavailable,
    or unrecorded (no durable assembly evidence exists for that turn);
  - the exact selected record versions in injection order, each with its
    origin label and the historical content ACTUALLY selected;
  - the applied Memory Mode for that turn (from immutable per-turn
    policy evidence);
  - recorded bounded exclusions in human language, with their stable
    reasons;
  - truthful truncation when evidence was bounded.
- If a selected record was later corrected, the HISTORICAL version
  actually selected is shown (the predecessor row's immutable bytes,
  labelled with the selected version). If content is unavailable or the
  record is retention-removed, a truthful tombstone/unavailable state is
  shown — never the successor's content and never resurrected content.
- If exclusion evidence reached its bound, the UI states that the
  displayed exclusions are a bounded recorded subset and never claims to
  explain every omitted record.
- The serialized context envelope and the hidden prompt are NEVER
  exposed (no rendered block, no framing markers, no system-prompt text).

### 3.5 Quiet transparency line (extends Q4 §9)

The tray's single quiet line about the latest reply gains exactly one new
truthful state and otherwise keeps the frozen Q4 strings:

```text
Your last reply here used N memories.        (Q4, unchanged; singular for N = 1)
No memories used                             (Q4, unchanged; latest assembly empty, mode NOT off)
Memory was off for your last reply here.     (NEW Q5 state: latest turn's applied mode was 'off')
Memory unavailable for this turn             (Q4, unchanged)
```

## 4. Quiet interaction law (frozen; unchanged from Q3/Q4 where stated)

- User-opened only; never modal; never auto-opened; never
  focus-stealing; conversation and composer remain fully usable while
  the Memory surface is open (send, stream, Stop, reconnect).
- Desktop: a side tray beside the conversation (non-modal). Narrow
  screens: a responsive non-modal sheet within the page flow. No
  overlay that blocks the page, no dialog element, no focus trap.
- Close and Escape return focus to the Memory chip. Real Escape-to-close
  is preserved (implemented via a window-level keydown guarded by the
  tray's open state — this is also one of the three warning repairs).
- The Memory Mode control lives ONLY inside this surface, labelled as
  applying to all conversations.

## 5. Memory chip (frozen)

The Memory chip is ALWAYS PRESENT for an open (non-archived semantics
unchanged) thread. It shows a pending count only when applicable
(`Memory` when none, `Memory · N pending` otherwise, with the accessible
name carrying the same truth). The chip remains the focus-return target
and the only opener of the Memory surface.

## 6. Inspection read surface (frozen)

ONE bounded user-facing inspection resource, identity
`qlt.inspection@1` (`QLT_INSPECTION_RESOURCE_ID`), exposed ONLY through
the released read boundary (`app.data.query` via `/api/act`; no route or
UI direct SQLite access; no second path). The ingress request shape is
the declared closed `filters` map of bounded strings (the released query
boundary's shape); numeric parameters are parsed from bounded strings by
the surface with closed validation.

Query family (exact op vocabulary `QLT_INSPECTION_QUERY_OPS`):

| op            | params (all bounded strings)                                                                                                                               | returns                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listRecords` | `bucket` (required: `pending` \| `current` \| `history`), `threadId?`, `kind?` (`claim` \| `commitment` \| `open_loop` \| `proposal`), `limit?`, `offset?` | deterministic bounded page of rows + total                                                                                                                                                                                            |
| `getRecord`   | `recordId`, `recordKind` (`claim` \| `commitment` \| `open_loop`)                                                                                          | one record: human projection + provenance links + correction lineage (predecessors, successors, corrections with reason/corrector/time) + details                                                                                     |
| `listTurns`   | `threadId` (required), `limit?`, `offset?`                                                                                                                 | completed assembly listing for one conversation (bounded summaries, newest first) + total                                                                                                                                             |
| `getTurn`     | `threadId` (required), `turnId` (required)                                                                                                                 | immutable per-turn assembly detail: applied policy, usage state, selected records in injection order with historical content or truthful tombstones, recorded bounded exclusions with stable reasons and truncation evidence, details |
| `getPolicy`   | —                                                                                                                                                          | the current durable Memory Mode (policy id, mode, revision, updatedAt) for the Memory surface control                                                                                                                                 |

Buckets (exact, deterministic):

- `pending` — proposals with status `proposed | awaiting_decision`.
- `current` — canonical current-effective records: `claim: active`,
  `commitment: active`, `open_loop: open`, no successor,
  `retention_state = 'currently-relevant'` (the Q4 eligible set).
- `history` — terminal proposals (`confirmed/rejected/amended/withdrawn`)
  and non-current records (`superseded/retired/released/resolved/
abandoned/transformed`, or successor-exists, or retention-removed).

Requirements (all frozen):

- deterministic ordering `updatedAt DESC, id ASC` everywhere; bounded
  pagination (default 50, max 100 rows; offset ≥ 0);
- no unbounded World dump: every list is paginated and the per-turn
  evidence is bounded by the frozen Q4 evidence limits;
- server-resolved actor/user authority: the actor derives from the
  released boundary (`actorId` arrives server-derived only); an
  `agent-*` identity or any agent-surface attempt fails closed with zero
  effect; no client-selected actor field is accepted anywhere;
- user-owned information only: no system prompts, no capability schemas,
  no hidden context envelope, no rendered context block, no framing
  markers, no provider data, no credentials, no authentication material,
  no raw model input ever enters inspection output;
- no durable effect from a read;
- technical identifiers and fingerprints hidden under an optional
  Details disclosure (rows carry human projections; `details` objects
  carry ids/fingerprints/versions);
- "Used for reply" shows recorded evidence, never recomputation;
- stable codes: `QLT_INSPECTION_UNSUPPORTED_QUERY`,
  `QLT_INSPECTION_MISSING_PARAM`, `QLT_INSPECTION_RECORD_MISSING`,
  `QLT_INSPECTION_TURN_MISSING` (all non-echoing);
- the existing thread-scoped `act.queryMemory` resource and action are
  UNCHANGED (same fields, same filters, same behavior).

The agent envelope contains no read/list/search capability: the capability
bridge resolves EXACTLY `qlt.proposal.draft@1` (unchanged); the
inspection surface requires the `qlt.inspection.read` permission that is
never granted to any agent context; the inspection mutation surface does
not exist (reads only); Memory Mode mutation requires
`qlt.memory-policy.write`, likewise never granted to any agent.

## 7. Effective-turn policy binding and historical policy evidence (frozen)

- The effective Memory Mode for a turn is bound to the SERVER-DERIVED
  durable turn identity at turn admission/start: the composition
  resolves the current durable policy INSIDE the per-conversation
  admission critical section and carries the resolved value immutably in
  the Quellight-owned turn assembly async scope. This is the "bound at
  admission" design (the declared owner-approved option): the mode is
  fixed before the turn intent is created and cannot change for that
  turn, because the in-scope value is immutable for the turn's duration.
- At the model seam, the first assembly of the turn durably records the
  bound policy as immutable per-turn evidence
  (`qlt_turn_memory_policy`, migration 4, `turn_id` PRIMARY KEY,
  INSERT-or-converge), BEFORE candidate evaluation. Every later model
  call of the same turn replays the frozen assembly; the scope value and
  the durable evidence can never be reinterpreted.
- A Memory Mode change while a reply is active never reinterprets that
  reply: the admission-bound scope value governs the in-flight turn's
  snapshot, the frozen Q4 replay rules are unchanged, and the per-turn
  evidence row is written once and never updated.
- The assembler consumes the RESOLVED effective policy carried by the
  scope; there is no global-setting conditional scattered through
  routes, UI, or selection code. ONE typed policy resolver
  (`src/lib/sharedworld/memory-policy.ts`) is the single resolution
  boundary (the future project-scope extension seam, §16).
- Historical truth: the applied mode is read from the per-turn evidence,
  NEVER from the current setting. A turn with no per-turn evidence is
  reported as `unrecorded` (truthful; e.g. pre-Q5 turns), never silently
  relabelled with the current mode.
- Usage states for a turn (exact): `used` (complete, N ≥ 1), `none`
  (empty, mode not off, no scope-excluded evidence), `scope-empty`
  (empty with recorded `scope-excluded` evidence — memory existed but
  was excluded by the selected scope), `off` (applied mode `off` — the
  turn may still have an `empty` Q4 assembly outcome; the policy evidence
  distinguishes it), `unavailable` (assembly `failed`), `unrecorded` (no
  assembly evidence for that turn).
- The durable policy row (`qlt_memory_policy`) is the product default; a
  future additive scope mechanism may resolve against it. Policy
  identity `qlt.memory-mode@1`; a monotonic integer revision increments
  on every effective change; per-turn evidence carries the policy id,
  mode, and revision that were bound.
- The frozen Q4 fingerprint algorithm is NOT modified to encode the
  mode. Mode effects enter the fingerprint only through the frozen
  inputs (selection/exclusion/ordering change naturally in
  `per-conversation`; `off` produces an empty selection). Bounded
  immutable policy evidence is added through migration 4 (§11).

## 8. Frozen-vocabulary amendment `scope-excluded`

The exclusion vocabulary gains exactly one code, `scope-excluded`,
meaning: the record was structurally eligible and current-effective but
originates outside the conversation scope permitted by the turn's applied
Memory Mode (`per-conversation`). The code is emitted ONLY under
`per-conversation`; under `across-conversations` it can never appear. See
§10 for the amendment mechanics (committed in this freeze, before any
assembler consumes it).

## 9. Action inventory change: 19 → 21 (frozen)

Exactly two actions are added to the compiled plan; nothing else changes:

| action                | kind     | resource            | contract                                                                                                               |
| --------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `act.queryInspection` | query    | `qlt.inspection`    | — (declared closed filter surface)                                                                                     |
| `act.setMemoryMode`   | mutation | `qlt.memory-policy` | `qlt.memory-policy.setMode.input` (`mode`: bounded string; closed enum re-validated at the surface — the second fence) |

`qlt.memory-policy@1` carries exactly ONE mutation op (`setMode`) and no
query. `qlt.inspection@1` carries read(s) only. The frozen Q3 inventory
data (`QLT_PLAN_ACTION_INVENTORY`, 19 actions) is NOT rewritten; the
focused `verify:q3` gate receives the disclosed bounded reconciliation
re-pin (frozen 19 + exactly these two Q5 additions) and the complete 21
inventory is asserted by `verify:q5`.

## 10. Dated Q4 contract amendment Q4-AMEND-1 (committed IN this freeze)

Per the owner's Phase Q5 instruction, the Q4 contract amendment is
included in this contract-freeze commit, BEFORE any assembler consumes
it, and is never bundled with consuming implementation. Two changes to
`src/lib/sharedworld/context-contract.ts`, both clearly dated:

1. `QLT_CONTEXT_EXCLUSION_CODES` gains `scope-excluded` (§8).
2. `QLT_CONTEXT_ASSEMBLER_VERSION` changes `q4-1` → `q5-1` (the
   executable assembler gains policy consumption; evidence must identify
   the executing assembler truthfully; the ALGORITHM is unchanged).

No other byte of the Q4/Q3/Q2 frozen modules changes. The frozen Q4
freeze document is NOT rewritten; this section and the in-module dated
comments are the amendment record. This bundling (amendment inside the
Q5 freeze commit) is authorized by the owner's Q5 instruction and does
not repeat the Q3 M-3 defect shape: no consuming implementation shares
this commit, and all lanes start from this SHA.

## 11. Migration 4 — declarative schema inventory (frozen)

ONE forward-only additive migration (`QLT_MEMORY_MODE_MIGRATION`:
version 4, `qlt-memory-mode-policy`); `CREATE TABLE`/`CREATE INDEX` only;
it neither reads nor writes pre-existing rows. Q2/Q3 tables are not
changed; the Q4 assembly table is not rewritten. Machine-readable
inventory: `policy-contract.ts`.

`qlt_memory_policy` — the durable product-default policy (singleton):

| column          | type    | constraints                                                                   |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `id`            | TEXT    | PRIMARY KEY; `CHECK (id = 'qlt-memory-policy-default')`                       |
| `policy_id`     | TEXT    | NOT NULL; `CHECK (policy_id = 'qlt.memory-mode@1')`                           |
| `mode`          | TEXT    | NOT NULL; `CHECK (mode IN ('across-conversations','per-conversation','off'))` |
| `revision`      | INTEGER | NOT NULL; `CHECK (revision >= 1)`                                             |
| `updated_by`    | TEXT    | NOT NULL; `CHECK (updated_by GLOB 'actor-*')`                                 |
| `created_at_ms` | INTEGER | NOT NULL                                                                      |
| `updated_at_ms` | INTEGER | NOT NULL                                                                      |

`qlt_turn_memory_policy` — immutable per-turn applied-policy evidence:

| column            | type    | constraints                                                                                          |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `turn_id`         | TEXT    | NOT NULL, PRIMARY KEY (exactly one evidence row per logical turn; INSERT-or-converge; never updated) |
| `policy_id`       | TEXT    | NOT NULL; `CHECK (policy_id = 'qlt.memory-mode@1')`                                                  |
| `mode`            | TEXT    | NOT NULL; same closed CHECK as above                                                                 |
| `policy_revision` | INTEGER | NOT NULL; `CHECK (policy_revision >= 1)`                                                             |
| `recorded_at_ms`  | INTEGER | NOT NULL                                                                                             |

Seeding: the migration creates SCHEMA only; the store lazily seeds the
singleton default row (`across-conversations`, revision 1) inside one
transaction on first resolution if absent — deterministic, idempotent,
and attributed `actor-quellight-local` (the server-derived local actor).

Restart behavior: both families are durable in `shared-world.db`; after
restart the current default policy, every per-turn applied-policy row,
all records, lineage, and assembly evidence survive unchanged
(append-only; nothing recomputes). The forward-only discipline applies:
a store written by a newer schema refuses to open.

## 12. L-3 — the narrow correction-proposal repair (frozen)

The dormant Q3 latent defect: `confirmProposal` of a `correction`-kind
proposal always rolled back with `QLT_RECORD_EXISTS` because
`applyCorrectionInTransaction` already writes the successor's
thread/turn source links and the confirmation loop wrote them AGAIN
(UNIQUE violation → full rollback). The repair is EXACTLY:

- the confirmation loop no longer rewrites thread/turn links for the
  successor created by the correction path (they exist; exactly one
  applicable source-thread link remains);
- a successful confirmation creates exactly one successor and exactly
  one applicable source link; the `proposed-from` link is still written
  (the correction path never wrote it);
- same-key replay converges (`reconstructConfirmation` unchanged);
- conflicts and stale targets fail with zero partial effects (existing
  checks unchanged);
- predecessor content remains unchanged; lineage stays append-only;
- NO authority expansion: agent-authored correction proposals remain
  rejected (`proposalKind: 'correction'` refused by the pinned
  capability); no UI path bypasses the existing user correction action.

The repair lives in `meaning-store.ts` `confirmProposal` only (Lane A).
The disclosed seeding-fixture boundary for correction-proposal testing
(Q4 L-2) remains: production wires no pending-correction path.

## 13. Svelte warning repair and the zero-warning gate (frozen)

The three known `ConversationWorkspace.svelte` warnings are removed:

1. redundant `role="region"` on the tray `<section aria-label="Memory
review">` — the redundant role is removed (a named section is already
   a region);
2. the keyboard (Escape) listener on the non-interactive `<section>` —
   moved to a window-level keydown guarded by the tray's open state
   (real Escape-to-close and focus return are preserved and remain
   component- and browser-proven);
3. `chipButton` updated without `$state` — the bind becomes `$state`.

`verify:dev-start` is updated IN THE SAME LANE/COMMIT to expect ZERO
project Svelte warnings: any Svelte warning id fails the gate. The
known cosmetic dev-only sourcemap notice (D-11) remains a separately
recorded, optional external-tool notice — it is not a Svelte warning and
never hides project warnings. No dependency upgrade and no
released-package patch is authorized.

## 14. Lane file-ownership map (parallel lanes; adjusted to the file graph)

The originally recommended five-lane map is adjusted in ONE place, for a
recorded reason: the Q5 inspection read accessors and the policy
accessors both live naturally in `src/lib/sharedworld/sqlite.ts`, so
ALL store-level SQL (policy, assembly-policy, and inspection reads) is
owned by Lane A; Lane B owns the application surface and wiring that
consume those accessors. No other adjustment was needed. As in Q4, the
integration owner reconciles once onto one final executable tree; lanes
land as reviewable commits in DAG order A → B → C → D → E from the
freeze SHA.

| Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Lane                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md`, `src/lib/sharedworld/policy-contract.ts`, `src/lib/sharedworld/inspection-contract.ts`, `src/lib/sharedworld/context-contract.ts` (§10 amendment only)                                                                                                                                                                                                                                                                                                                                                                                                                     | Phase 0 freeze (frozen for all lanes)                  |
| `src/lib/sharedworld/migrations.ts` (migration 4), `src/lib/sharedworld/memory-policy.ts` (new: policy store + typed resolver), `src/lib/sharedworld/sqlite.ts` (policy + per-turn-policy + bounded inspection READ accessors), `src/lib/sharedworld/context-assembler.ts` (policy consumption, `scope-excluded`, `off` handling, per-turn evidence, summary extension), `src/lib/sharedworld/meaning-store.ts` (L-3 narrow repair ONLY), `src/lib/server/model-seam.ts` (scope carries the resolved policy; no behavior change otherwise), forced mechanical scope-construction re-pins in existing tests (assertion-neutral, disclosed) | Lane A — persistence, policy, assembly, L-3            |
| `src/lib/sharedworld/inspection-surface.ts` (new), `src/lib/sharedworld/memory-policy-surface.ts` (new), `src/lib/application/definition.ts` (2 actions + 2 resources + views + contracts), `src/lib/server/application-server.ts` (ingress specs for the two actions), `src/lib/server/composition.ts` (resolver wiring, admission-scoped policy binding, data-port branches), `src/routes/api/threads/[id]/turns/+server.ts` (scope install moved into the composition's admission wrapper), `test/context-injection.test.ts` (Lane B-owned seam tests: bounded re-pin)                                                                 | Lane B — inspection application surface and wiring     |
| `src/lib/islands/ConversationWorkspace.svelte` (four areas, Memory Mode control, chip, warning fixes), `test/ui/memory-inbox.test.ts`, `test/ui/workspace.test.ts`, `test/ui/workspace-stop.test.ts` (bounded re-pins for the always-present chip/structure), `scripts/verify-dev-start.mjs` (zero-warning flip)                                                                                                                                                                                                                                                                                                                          | Lane C — Memory UI                                     |
| `test/memory-authority.test.ts` (new independent suite), `scripts/verify-q5.mjs` (new), `package.json` (`verify:q5`), `scripts/verify-quellight.mjs` (new step), `scripts/verify-q2.mjs` + `scripts/verify-q3.mjs` + `scripts/verify-q4.mjs` (disclosed bounded reconciliation re-pins ONLY: migration bookkeeping 4, plan inventory 19+2, assembler version q5-1), `test/turn-overlap-isolation.test.ts` + `test/context-assembly.test.ts` + `test/composition.test.ts` + migration-bookkeeping test re-pins (assertion-neutral, disclosed)                                                                                              | Lane D — independent tests + verifier + reconciliation |
| `scripts/browser-ceremony-check.mjs` (extended scenarios; no new browser boot), `README.md`, `docs/system-reference.md`, `docs/decision-register.md`, `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-MEMORY-INSPECTION-IMPLEMENTATION.md`                                                                                                                                                                                                                                                                                                                                                                                                      | Lane E — browser evidence + documentation              |

No lane touches `package-lock.json`, the VICT repository, `.pi/`
material, historical Q2/Q3/Q4 reports, the frozen Q2/Q3 contract
modules, or the canonical input. Lane D never implements production
code. No lane runs the full ladder during development (focused checks
only).

## 15. Verification DAG (authoritative final sequence)

After integration on the committed frozen executable tree, EXACTLY:

```text
npm ci
npm run verify:consumer
npm run verify:quellight
npm audit --omit=dev
git diff --check
```

`verify:quellight` permanently contains, in dependency order (existing
steps unchanged and in order): format check; typecheck;
verify:governance; verify:q2 (bounded bookkeeping re-pin); verify:q3
(bounded inventory re-pin); verify:q4 (bounded assembler-version
re-pin); verify:dev-start (zero expected project warnings); **verify:q5
(new)**; node-side tests; UI tests; production build + closed warning
scan; existing browser baseline; existing Stop browser proof; ONE
extended browser-ceremony session containing ALL Q5 scenarios (four
areas; lifecycle transitions; correction lineage; Used-for-reply
historical truth; all three Memory Modes; mid-turn policy-change
containment; Escape/focus return; conversation usability with Memory
open; responsive viewports; axe with Memory open); credential/canary
scan; `git diff --check`. No fourth browser boot is added; axe and
responsive passes are not duplicated elsewhere. Failures are diagnosed
and disclosed; no silent reruns, no timeout increases, no weakened
assertions.

## 16. Future project-scope extension seam (prepared, NOT implemented)

- Effective Memory Mode resolution is centralized behind ONE typed
  policy resolver (`memory-policy.ts`); the assembler consumes the
  resolved effective policy; no global-setting conditionals are
  scattered through routes, UI, or selection code.
- The persisted global policy is a PRODUCT DEFAULT that a future
  additive scope mechanism could resolve against; per-turn evidence
  carries stable policy identities and revisions.
- The documented extension seam: a future project override must arrive
  as an ADDITIVE migration plus a resolver extension (resolve against
  the durable global default; per-turn evidence records the resolved
  result), without rewriting existing global-policy history and without
  changing the frozen evidence shape.
- Explicitly NOT created now: `projectId` fields; nullable placeholder
  columns; project tables, selectors, UI, or fake records;
  project-specific precedence rules; client-supplied scope identities;
  speculative generic policy platforms. Project membership and
  project-policy precedence remain undecided FUTURE semantics;
  server-derived authority will be required when that work begins.

## 17. Acceptance and negative-control matrix (numbered)

Lane D's permanent suite plus `verify:q5` and the extended ceremony
browser check must prove every row. Every positive assertion carries a
meaningful zero-effect or failure negative control.

| #    | Control                                                                                                                            | Expected                                                                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Pending and terminal proposals never render as canonical current memory                                                            | Pending bucket holds only `proposed/awaiting_decision`; Current never contains proposals; negative: a confirmed proposal appears only via its created record                    |
| C-02 | Superseded and closed records never enter later context                                                                            | assembler excludes them (Q4 codes) and Current never lists them; negative: injecting such rows changes no snapshot                                                              |
| C-03 | A past turn displays the exact historical record versions and order it used                                                        | getTurn returns selected ids/kinds/versions in injection order with historical content; negative: mutating current records after the fact does not alter the displayed evidence |
| C-04 | Correction lineage remains append-only and inspectable                                                                             | getRecord shows predecessor/successor/correction chains; negative: no inspection op can mutate                                                                                  |
| C-05 | Every UI-exposed lifecycle action is retry-convergent                                                                              | same-key retries converge (correct/retire/release/resolve/abandon/transform/setMode); negative: conflicting same-key payloads fail with the stable conflict                     |
| C-06 | Agent attempts at all inspection and mutation surfaces fail with zero effects                                                      | agent identity/context refused at the surface; envelope exactly `qlt.proposal.draft@1`; negative controls per surface                                                           |
| C-07 | Routes and components contain no direct database writes                                                                            | structural gate; the only write path is the declared action → released boundary → handler → one transaction                                                                     |
| C-08 | Client scope/project/actor/turn forgery fails closed                                                                               | unknown fields, prohibited keys, and forged identities fail closed at every new ingress (FENCE behavior intact)                                                                 |
| C-09 | A Memory Mode change during an active turn leaves that turn's bound policy and snapshot unchanged; the next turn uses the new mode | browser mid-turn scenario + node proof; negative: the in-flight turn's evidence row is immutable                                                                                |
| C-10 | Restart preserves the current default policy, per-turn applied policy, records, lineage, and inspection truth                      | restart tests; negative: nothing recomputes or relabels                                                                                                                         |
| C-11 | Across-conversations mode preserves current Q4 context behavior                                                                    | byte-parity of selection/ordering/budgets against the frozen rules; negative: mode not set → Q4 behavior                                                                        |
| C-12 | Within-each-conversation mode excludes global and other-conversation material truthfully                                           | `scope-excluded` evidence with stable reasons; negative: code never emitted under `across-conversations`                                                                        |
| C-13 | Memory-off mode injects zero while historical inspection reports memory was intentionally off                                      | zero injection + truthful `off` usage state; negative: an off turn is never reported as "no memory existed"                                                                     |
| C-14 | Desktop, tablet, mobile, keyboard, focus-return, and no-overflow behavior pass                                                     | browser checks in the ONE ceremony session                                                                                                                                      |
| C-15 | Axe serious/critical findings remain zero with Memory open                                                                         | axe in the same session, both viewports                                                                                                                                         |
| C-16 | Conversation send, stream, Stop, and reconnect remain usable while Memory is open                                                  | browser scenario with the tray open                                                                                                                                             |
| C-17 | The three existing Svelte warnings are gone and no unknown warning appears                                                         | verify:dev-start zero-warning gate fails on ANY project warning                                                                                                                 |
| C-18 | L-3 is corrected without enabling agent correction proposals                                                                       | correction-kind confirm creates exactly one successor + one applicable source link; replay converges; capability still rejects `correction`                                     |
| C-19 | Inspection pagination, truncation, missing historical content, and retention-removed content fail/display truthfully               | bounded pages; truncation sentinel surfaced; tombstones; negative: no unbounded dump, no fabricated content                                                                     |
| C-20 | The project-scope extension seam is centralized while no project behavior or placeholder exists                                    | resolver is the single consumption point; structural negative: no `projectId`/project artifacts anywhere                                                                        |

## 18. Documentation and status obligations

`README.md`, `docs/system-reference.md`, and `docs/decision-register.md`
are updated to current truthful status; Q5-OD-1, the three Memory Modes,
the extension seam and its non-implementation, inspection authority
boundaries, L-3 disposition, warning disposition, migration and action
inventory, remaining limitations, and the exact executable-verification
and documentation SHAs are recorded. The implementation report
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-MEMORY-INSPECTION-IMPLEMENTATION.md`)
follows repository conventions and carries the Git-derived inventory.
Historical reports and frozen evidence are NOT rewritten. Q5 is recorded
EXACTLY as `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`; Q5 is NOT
marked Verified and NOT formally closed; no `QLT-*` requirement is
promoted to Verified; M-1 remains open and must be corrected before the
Phase Q6 live-provider proof and the Stage 07C final audit.

## 19. Amendment procedure

If implementation reveals a material contract defect: affected lanes
STOP; the integration owner reconciles the change ONCE; the amendment is
committed ALONE (truthful title, no implementation); affected lanes
restart from the amended freeze SHA. Every amendment is a dated addendum
(§20); no silent edits.

## 20. Dated amendments

None at freeze time. (The Q4 amendment Q4-AMEND-1 is recorded in §10 and
is part of the freeze itself per the owner's Q5 instruction.)

## 21. Independent-audit boundary

This task performs contract freeze, implementation, integration,
self-verification, and reporting. It does NOT audit Q5 and does NOT close
it. Q5 remains `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` until an
independent verification and a formal closure exist.
