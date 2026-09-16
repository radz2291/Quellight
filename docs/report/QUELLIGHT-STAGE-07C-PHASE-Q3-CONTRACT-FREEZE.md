# Quellight Stage 07C — Phase Q3 — Governed Confirmation Ceremony and Quiet Memory Inbox Contract Freeze

> **Class:** Phase 0 contract-freeze record. This document (with the frozen
> declarative module `src/lib/sharedworld/ceremony-contract.ts`) defines the
> EXACT Phase Q3 contract before any production edit. Every implementation
> lane begins from this commit and may not silently alter it; a material
> change requires the amendment procedure (§19). It is NOT an
> implementation report and closes nothing.
>
> **Governing status at freeze:**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q2 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
> PHASE Q3 CONTRACT AND IMPLEMENTATION PERMITTED — NOT BEGUN
> Shared World schemas exist, but no production meaning,
> confirmation or model-context path is active.
> Stage 07 remains In Progress.
> ```

## 0. Authority and basis

| Input                                        | Value                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quellight freeze starting SHA                | `0cb9c124cc0c3bb127c2df732da29427e6157b16` (`HEAD == origin/main`, fetch-verified)                                                                                                                                                               |
| VICT read-only SHA                           | `0f4f72b0812bdfa40229a170f4d97e9696f72dd9` (`HEAD == origin/main`; untracked `.pi/` untouched)                                                                                                                                                   |
| Conflicting Q3 / later work                  | none found on either remote (both fetches advanced nothing; histories inspected)                                                                                                                                                                 |
| Canonical persistent-cognitive-partner input | SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` (reconfirmed byte-identical)                                                                                                                                          |
| VICT release identity (unchanged by Q3)      | `@victframework/*@0.2.0`, `vict-release-set@1/0.2.0`, content ID `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`                                                                                                           |
| Stage 07C handoff                            | `260831-VCT-02/docs/handoff/VICT-STAGE-07C-QUELLIGHT-SHARED-WORLD-MEANING-AND-CEREMONY-HANDOFF.md` (§7.1 families; §8 ceremony; §10 corrections; §12.1 provenance table; §19 OQ6 ratified addendum)                                              |
| Q2 frozen contract (unchanged)               | `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md` + `src/lib/sharedworld/meaning-contract.ts` (byte-identical through Q3)                                                                                                            |
| Binding decisions                            | GOV-007 / D-8 (VICT semantic authority); OQ6 §19 (ratified authority model); D-10 (governed VICT 0.2.0 boundary); F-Q2-2 (withdrawal attribution — resolved by owner decision D-Q3-1); Q1 FENCE-1 and TEST-1 (resolved in Q3 per D-Q3-6 and §13) |
| Normative code artifact of this freeze       | `src/lib/sharedworld/ceremony-contract.ts` (frozen identifiers, bounds, codes, authority data, ingress schemas as DATA; committed in this same commit)                                                                                           |

The user remains final Shared World authority. An explicit user-authored
Save constitutes confirmation (OQ6 §19.2 consequence 3). An agent may
propose but may never confirm, reject, amend, withdraw, correct, delete,
or read Shared World meaning. Proposal staleness is caused by referenced
source/target-version change, never by elapsed time (§19.3).

## 1. Objective and exclusions

**Objective (human terms).** Q3 builds the safe doorway from conversation
into Quellight's Shared World: the agent notices something potentially
worth preserving → creates an inert proposal → the conversation continues
naturally → a quiet pending-memory indicator appears → the user reviews
it when convenient → only the user can confirm, edit, reject or withdraw
it → the outcome survives refresh, reconnect and restart exactly once.

**Q3 delivers** (complete list): sequential contract freeze (this
document); the closed ceremony action and query contracts under one
bounded Shared World application resource; one pinned agent capability
for drafting inert proposals; server-derived thread and turn correlation;
governed user actions for confirmation, rejection, amendment, withdrawal,
direct Save and user-authorized correction; the API-level lifecycle exits
required by the Stage 07C handoff; the quiet pending-memory inbox inside
the existing conversation workspace; minimal user access to
recently-confirmed/thread-associated records for direct correction;
explicit stale, conflict, already-decided and validation states; idempotent
retries and truthful restart/reconnect recovery; TEST-1 permanent
real-browser ceremony recovery proof; FENCE-1 ingress hardening with
regression proof; a focused `verify:q3`; permanent aggregate integration;
the implementation report and truthful status reconciliation; and the VICT
System Reference registration of Q2 closure and Q3 implementation status.

**Q3 excludes** (all forbidden now): Shared World context assembly; any
confirmed-memory visibility to the model; an agent read/list/search
capability over Shared World; agent confirmation, rejection, amendment,
withdrawal, correction-finalization or deletion authority; automatic
confirmation from inferred natural-language intent; dedicated global
memory management, full lineage or context-inspection UI; retention and
deletion enforcement; live-provider ceremony proof; autonomous initiative,
ingestion, learning or delegation; new VICT framework semantics or package
versions; an alternate route-local persistence path; formal Q3 verification
or closure; and the beginning of Q4.

## 2. Locked owner decisions (binding; not reopened)

- **D-Q3-1 — Withdrawal.** Durable withdrawal is USER-attributed only.
  No migration 3; the Q2 CHECK constraints are unchanged; the agent
  receives no durable withdrawal authority. An agent retracting or
  replacing its own suggestion may later be represented as presentation
  state only; it is not a durable Q3 decision and does not close the
  existing proposal. (`withdrawn_by` remains `actor-*` per the frozen Q2
  schema; agent-initiated withdrawal is deferred beyond Q3.)
- **D-Q3-2 — Quiet memory inbox.** No large proposal forms in the
  transcript by default. The existing conversation workspace gains a
  small non-blocking pending-memory indicator and count, a user-opened
  review tray inside the existing workspace, and proposal details and
  decision controls only when the user chooses to review. The inbox must:
  never show a modal automatically; never steal focus; never block
  message sending, reply streaming, stopping or reconnecting; never
  require the user to decide before continuing; never repeatedly remind
  or pressure; allow pending proposals to remain pending indefinitely;
  remain responsive and accessible. Exact visual placement is
  implementation judgment inside the preserved conversation-first
  hierarchy.
- **D-Q3-3 — Decision controls.** A pending agent proposal supports
  Confirm, Edit, Reject and Withdraw. Edit closes the original proposal
  as `amended` and creates a new pending proposal; editing never silently
  confirms. Withdraw is a durable terminal user decision; a visual
  hide/dismiss is never labelled or implemented as withdrawal.
- **D-Q3-4 — Direct user Save.** A minimal direct-authoring path exists
  for an epistemic claim, a commitment and an open loop. A visible,
  attributable user action labelled Save (in a surface titled
  "Remember this") constitutes confirmation. Unconstrained model
  interpretation of ordinary natural language is NEVER user confirmation.
  Direct Save creates the confirmed record without a second confirmation
  ceremony.
- **D-Q3-5 — Exit verbs.** The required API-level exit verbs for claims,
  commitments and open loops are declared and proven. Dedicated UI
  controls for those exits remain deferred to Q5.
- **D-Q3-6 — FENCE-1.** The small Q1 ingress hardening is explicitly
  included in Q3: prototype-named or otherwise prohibited unknown fields
  fail closed at the `/api/act` ingress with a stable non-echoing error
  code; every previously valid declared-field behavior is preserved;
  permanent positive and negative regression controls are added; the
  change is recorded openly (Q2 did not resolve it).

## 3. Resource, action, query and capability identifiers (frozen)

**Application resource (ONE bounded Shared World application resource).**

```text
id:        qlt.memory        revision: '1'
identity:  { key: 'id' }
```

Catalogue fields (the unified read projection over the four families):

```text
id            string   stable record/proposal identifier
kind          string   'proposal' | 'claim' | 'commitment' | 'open_loop'
proposalKind  string   for proposal rows: the drafted kind
                       ('claim' | 'commitment' | 'open_loop'); ''
                       for record rows (A-AMEND-2)
status        string   the family's closed lifecycle status (Q2 vocabularies)
title      string   presentation subject (claim/loop subject, commitment key,
                    proposal subject or kind label; bounded ≤ 200)
text       string   presentation text (statement/detail; bounded by the Q2
                    content bounds; ≤ 2000 chars)
threadId   string   source thread ('' when absent on direct creates without
                    thread context)
turnRef    string   source turn reference ('' when absent)
actor      string   proposedBy | createdBy (identity)
decisionBy string   decision/exit identity ('' when absent)
stale      string   'true' | 'false' — presentation-computed version-
                    eligibility staleness for pending proposals
version    number   record version (proposals and records)
createdAt  number   created_at_ms
updatedAt  number   updated_at_ms
```

Declared query: `list` — sort `updatedAt` (desc default), declared filter
fields exactly `kind`, `status`, `threadId` (equality), projection and
pagination (default limit 50, max 100; deterministic ordering
`updated_at_ms DESC, id ASC`). Declared view: `v.memory`.

**Mutation ops on `qlt.memory` (exactly thirteen; the entire Q3 ceremony
write surface):**

```text
confirmProposal     rejectProposal      amendProposal       withdrawProposal
createClaim         createCommitment    createOpenLoop      correctRecord
retireClaim         releaseCommitment   resolveLoop         abandonLoop
transformLoop
```

**Declared Application Definition actions (Q3-added; the five existing
thread actions are unchanged):**

```text
act.queryMemory        (query,    qlt.memory)
act.confirmProposal    (mutation, qlt.memory, op confirmProposal,     contract qlt.memory.confirm.input)
act.rejectProposal     (mutation, qlt.memory, op rejectProposal,      contract qlt.memory.reject.input)
act.amendProposal      (mutation, qlt.memory, op amendProposal,       contract qlt.memory.amend.input)
act.withdrawProposal   (mutation, qlt.memory, op withdrawProposal,    contract qlt.memory.withdraw.input)
act.createClaim        (mutation, qlt.memory, op createClaim,         contract qlt.memory.claim.input)
act.createCommitment   (mutation, qlt.memory, op createCommitment,    contract qlt.memory.commitment.input)
act.createOpenLoop     (mutation, qlt.memory, op createOpenLoop,      contract qlt.memory.loop.input)
act.correctRecord      (mutation, qlt.memory, op correctRecord,       contract qlt.memory.correct.input)
act.retireClaim        (mutation, qlt.memory, op retireClaim,         contract qlt.memory.claimExit.input)
act.releaseCommitment  (mutation, qlt.memory, op releaseCommitment,   contract qlt.memory.commitmentExit.input)
act.resolveLoop        (mutation, qlt.memory, op resolveLoop,         contract qlt.memory.loopExit.input)
act.abandonLoop        (mutation, qlt.memory, op abandonLoop,         contract qlt.memory.loopExit.input)
act.transformLoop      (mutation, qlt.memory, op transformLoop,       contract qlt.memory.loopExit.input)
```

The complete Q3 plan inventory is therefore 19 actions: the five thread
actions plus `act.queryMemory` plus the thirteen memory mutations. The
compiled plan, the ingress dispatch, and the memory adapter must agree on
exactly this inventory (permanently gated).

**Pinned agent capability (exactly one; the whole agent authority
envelope):**

```text
id: qlt.proposal.draft   revision: '1'
input:  qlt.proposal.draft.input@1
output: qlt.proposal.draft.output@1
```

The pinned profile `agent.quellight.conversation` moves to revision '2'
with `capabilities: [{ id: 'qlt.proposal.draft', revision: '1' }]` and a
bounded tool budget (`maxToolCalls: 2`, `onLimit: 'fail-closed'`
unchanged). The conversation instructions artifact moves to revision '2'
with a truthful single-tool disclosure. `maxToolCalls` remains bounded and
fail-closed; the per-turn capability budget gate is wired to the released
adapter gate so the declared budget actually governs capability calls.

**Capability effect-class disclosure (recorded openly; no silent
deviation).** The truthful class of a durable proposal-row creation is
`write`. The released VICT 0.2.0 tool bridge hardwires its approval policy
(`defaultBridgePolicy`): `write`/`irreversible` capabilities require a
VICT approval decided by an actor DISTINCT from the requesting actor
(AI-006; no self-approval). This product is a ratified single-actor
envelope (OQ6; D-10): no distinct approver exists, so a `write`-class
proposal tool would deterministically suspend every turn for the approval
window and then fail (`VICT_APPROVAL_EXPIRED`) — proposals could never be
created, violating D-Q3-2 (never block streaming; never require a decision
before continuing). An automated second approver actor was REJECTED as a
prohibited approval-semantics bypass (GOV-007 / D-8). Q3 therefore
DECLARED the capability as effect class `read` — the released class whose
policy permits in-turn completion — and closes over the disclosure: the
class metadata is an imperfect description of a bounded, inert, keyed
proposal-row creation; every authority property that matters (inertness,
no confirmer power, no read path, one-open-per-turn, keyed idempotency,
fenced settlement) is enforced by the implementation, the store, the
contracts, and the permanent tests, never by the class metadata. A
framework policy extension (a truthful `write` class with a product-policy
non-approval disposition) is recorded as a candidate framework-change
proposal for the VICT owners — NOT implemented in Q3.

**Offline deterministic fixture (frozen trigger contract for TEST-1).**
The default offline fixture script gains exactly three deterministic
tool-call entries, keyed by these exact user texts on a fresh thread:

```text
'I keep important details scattered everywhere'
   → tool qlt_proposal_draft { proposalKind: 'claim', content: { subject:
     'Deep work preferences', epistemicType: 'E5', honestyState: 'likely',
     confidence: 'qualified', statement: 'The user does their most
     important work in focused morning sessions.' } }
   thenText: 'I noted a possible claim about your working style — it is in
     your pending memory inbox for review whenever you like.'

'I have to prepare the quarterly review'
   → tool qlt_proposal_draft { proposalKind: 'commitment', content: {
     commitmentKey: 'quarterly-review-prep', statement: 'The user intends
     to prepare the quarterly review.' } }
   thenText: 'I noted a possible commitment — it is in your pending memory
     inbox for review whenever you like.'

'I still need to figure out the travel plans'
   → tool qlt_proposal_draft { proposalKind: 'open_loop', content: {
     subject: 'Travel plans', loopKind: 'undecided_question', detail:
     'The travel plans are still undecided.' } }
   thenText: 'I noted a possible open question — it is in your pending
     memory inbox for review whenever you like.'
```

The fixture emits each tool call at most once per conversation (released
fixture behavior), so each scenario runs on its own fresh thread.

## 4. User and agent authority matrix (frozen)

| Capability                                          | User (actor-\*)                                                                                                   | Agent (agent-\*)                                                                                         | Enforcement                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Draft a pending proposal                            | n/a (product offers direct Save instead)                                                                          | YES — via the single pinned capability only                                                              | pinned envelope; capability implementation                             |
| Confirm a proposal                                  | YES — `act.confirmProposal`                                                                                       | NO                                                                                                       | store CHECK + `QLT_CONFIRMER_INVALID`; no agent path; negative control |
| Reject a proposal                                   | YES — `act.rejectProposal`                                                                                        | NO                                                                                                       | as above                                                               |
| Amend (edit) a proposal                             | YES — `act.amendProposal`                                                                                         | NO                                                                                                       | as above                                                               |
| Withdraw a proposal (durable)                       | YES — `act.withdrawProposal` (D-Q3-1: user-attributed only)                                                       | NO                                                                                                       | store CHECK (`decision_by GLOB 'actor-*'`)                             |
| Direct Save (claim/commitment/open loop)            | YES — `act.createClaim` / `act.createCommitment` / `act.createOpenLoop`; Save = confirmation, `created_by` = user | NO — no capability; no action path                                                                       | structural + negative controls                                         |
| Correct a confirmed record (durable lineage)        | YES — `act.correctRecord` with a user-selected target                                                             | NO — agent correction proposals are deferred to Q4 (the capability rejects `proposalKind: 'correction'`) | input contract + negative control                                      |
| Claim/commitment/loop lifecycle exits               | YES — the five declared exit ops                                                                                  | NO — no capability; `exit_by` is `actor-*` CHECK-enforced                                                | CHECK + structural                                                     |
| Read pending proposals / own records (presentation) | YES — `act.queryMemory` (user-facing UI and server recovery)                                                      | NO — the model receives nothing from Shared World                                                        | no model path; negative controls                                       |
| Read ANY record into the model context              | NO (no path needed)                                                                                               | NO                                                                                                       | Q3 structural gates                                                    |

The agent's tool-call result is limited to the immediate bounded outcome
of its own proposal-draft invocation: `{ accepted: true, proposalId }` or
`{ accepted: false, code }`. Nothing else about Shared World — pending or
confirmed — is ever readable, listable, searchable, or assemblable by the
model in Q3.

## 5. Closed input contracts (ingress + envelope; frozen bounds)

All contracts are closed field sets: unknown fields, prototype-named keys,
exotic containers, and non-serializable values fail closed. String bounds
are characters; `expectedVersion` is a finite safe integer when present.
`threadId` is always optional where shown; when present it must match the
Q2 safe-id pattern and the store enforces existence (FK).

```text
qlt.memory.confirm.input     { proposalId, expectedVersion? }
qlt.memory.reject.input      { proposalId, reason? }
qlt.memory.amend.input       { proposalId, content, reason? }
                             content: closed kind-shaped proposal content;
                             validated kind-specifically against the
                             ORIGINAL proposal's kind at the handler
                             (second fence) via the frozen Q2 parse fence
qlt.memory.withdraw.input    { proposalId, reason? }
qlt.memory.claim.input       { threadId?, subject, epistemicType,
                             honestyState, confidence, statement }
qlt.memory.commitment.input  { threadId?, commitmentKey, statement }
qlt.memory.loop.input        { threadId?, subject, loopKind, detail }
qlt.memory.correct.input     { recordId, recordKind, statement?, detail?,
                             reason?, expectedVersion? }
                             recordKind ∈ claim | commitment | open_loop;
                             claim/commitment require statement; open_loop
                             requires detail (family-shaped successor
                             content; the handler validates per kind)
qlt.memory.claimExit.input   { recordId, reason?, expectedVersion? }
qlt.memory.commitmentExit.input  { recordId, reason?, expectedVersion? }
qlt.memory.loopExit.input    { recordId, reason?, expectedVersion? }
                             reason REQUIRED for abandonLoop and
                             transformLoop (canonical §5.5), optional for
                             resolveLoop
qlt.proposal.draft.input     { proposalKind, content }
                             proposalKind ∈ claim | commitment | open_loop
                             ('correction' is REJECTED in Q3 — deferred to
                             Q4 with trusted targeting); content validated
                             by the frozen Q2 parse fence for the kind
qlt.proposal.draft.output    { accepted: true,  proposalId }
                           | { accepted: false, code }
                             code ∈ QLT_CORRELATION_MISSING |
                             QLT_THREAD_MISSING | QLT_PROPOSAL_OPEN_EXISTS |
                             QLT_IDEMPOTENCY_CONFLICT | QLT_INPUT_REJECTED
```

The amendment content NEVER bypasses the parse fence; the correction
content is family-shaped and bounded by the same Q2 content bounds
(≤ 4096 canonical UTF-8 bytes hard limit).

## 6. Stable success and failure codes (frozen)

Success: `{ ok: true, … }` with the projected row/outcome; the capability
output above. Failure codes are stable, non-echoing (code + structural
path only; never values):

```text
QLT_INGRESS_PROHIBITED_FIELD   FENCE-1: prototype-named or otherwise
                               prohibited request/filter key at /api/act
                               (new in Q3; stable, non-echoing)
QLT_CORRELATION_MISSING        the proposal capability could not resolve a
                               trustworthy server-side turn/thread
                               correlation (missing turn record, actor
                               mismatch, or no Shared World thread link)
QLT_PROPOSAL_OPEN_EXISTS       one open proposal per (thread, kind, turn)
                               already exists (second same-kind draft in
                               the same turn)
QLT_INPUT_REJECTED             closed-contract rejection at the capability
                               boundary
QLT_PROPOSAL_STALE             version-eligibility staleness (re-checked at
                               confirm time; stale proposals cannot be
                               confirmed unchanged)
QLT_PROPOSAL_ALREADY_DECIDED   the proposal already reached a terminal state
QLT_PROPOSAL_INVALID_TRANSITION / QLT_VERSION_CONFLICT /
QLT_IDEMPOTENCY_CONFLICT / QLT_RECORD_MISSING / QLT_RECORD_NOT_CURRENT /
QLT_THREAD_MISSING / QLT_CONFIRMER_INVALID / QLT_CORRECTION_DUPLICATE /
QLT_CORRECTION_CONFLICT / QLT_LINEAGE_INVALID / QLT_LOOP_INVALID_TRANSITION
…                              the frozen Q2 store codes, unchanged
INVALID_REQUEST / IDEMPOTENCY_KEY_REQUIRED / UNKNOWN_ACTION /
UNSUPPORTED_ACTION / ACTION_FAILED                existing ingress codes
```

## 7. Direct-Save authority evidence

- The Save control is a first-party button in the user-opened memory
  tray, rendered by the product island; the label is `Save` inside a
  surface titled `Remember this`, with an explicit durable-write
  disclosure ("Save immediately writes confirmed memory") satisfying OQ6
  §19.2 consequence 3's proviso.
- The action crosses `/api/act` as a declared, keyed mutation
  (`act.createClaim` / `act.createCommitment` / `act.createOpenLoop`);
  identity is resolved SERVER-SIDE (the local user actor); the browser
  never supplies an identity; the durable row carries `created_by` = user
  actor and the action's idempotency key.
- The record is created directly ACTIVE/OPEN (`createdBy` = user actor):
  the visible Save IS the confirmation ceremony for user-authored content;
  no second confirm step exists (OQ6 §19.2.3).
- Ordinary model interpretation can never impersonate direct Save: the
  model's ONLY effectful path is `qlt.proposal.draft`, which creates a
  pending INERT proposal and nothing else; no tool, capability, or route
  lets model output reach `createClaim`/`createCommitment`/
  `createOpenLoop` (permanently negative-controlled: structurally and at
  runtime).

## 8. Server-derived thread and turn correlation (frozen)

The model supplies ONLY `proposalKind` and `content`. The composition's
capability invocation boundary resolves, server-side, in this order:

1. the VICT turn record for the invocation's `victTurnId` (bridge-supplied,
   never model-supplied) — a missing record fails
   `QLT_CORRELATION_MISSING`;
2. the turn's authenticated actor must equal the invocation's
   bridge-supplied actor — a mismatch fails `QLT_CORRELATION_MISSING`;
3. the Shared World thread via the conversation-correlation record
   (`qlt_thread_conversation` by the turn's Mastra thread id) — a missing
   link fails `QLT_THREAD_MISSING`;
4. `sourceTurnRef` = the VICT turn id; `sourceThreadId` = the resolved
   Shared World thread id; `proposedBy` = the product's stable agent
   identity `agent-quellight`.

Consequently: client- or model-supplied correlation fields are unknown
fields (contract-rejected); missing correlation fails; production
correlation is always server-derived. The one-open-proposal-per-
`(source_thread_id, proposal_kind, source_turn_ref)` rule is enforced in
production by the Q2 partial unique index (turn references are never NULL
on the capability path).

## 9. Lifecycle transition mapping (frozen; Q2 vocabularies unchanged)

```text
proposal:  proposed → awaiting_decision → confirmed | rejected | amended | withdrawn
           (the four decided states are terminal; decided ↔ decision identity CHECK-coupled)
claim:     active → superseded | retired
commitment: active → released | superseded | amended
open_loop: open → resolved | superseded | abandoned | transformed
correction: recorded (append-only, immutable)
```

Q3 action-level mapping:

```text
act.confirmProposal:   proposed is first moved to awaiting_decision
                       (keyed sub-step) and then confirmed in the same
                       logical action; decided states refuse with
                       QLT_PROPOSAL_ALREADY_DECIDED; stale refuses with
                       QLT_PROPOSAL_STALE (version-eligibility re-check)
act.rejectProposal / act.withdrawProposal: same awaiting sub-step; then
                       terminal rejection / withdrawal (user-attributed)
act.amendProposal:     original → amended; NEW proposal (same kind, new id)
                       → proposed, linked by the `amends` relation; the
                       amendment is NEVER auto-confirmed
act.correctRecord:     predecessor → superseded (version + 1); successor
                       created (new id, supersedes_id); immutable
                       qlt_correction row + links in ONE transaction
act.retireClaim / act.releaseCommitment / act.resolveLoop /
act.abandonLoop / act.transformLoop: the frozen Q2 exit verbs; exits
                       require the user identity; abandon/transform require
                       a reason; exit provenance is CHECK-coupled
```

## 10. Idempotency and optimistic-version rules (frozen)

- Every memory mutation requires a bounded idempotency key at the ingress
  (existing discipline). The key reaches the store verbs as their `key`:
  same key + same canonical fingerprint converges to the SAME durable
  outcome (no duplicate rows); same key + different content fails
  `QLT_IDEMPOTENCY_CONFLICT`. The VICT command boundary additionally holds
  the durable claim/lease/receipt fence: an identical retry replays the
  first outcome (one effect; double-click, reconnect and replay create
  exactly one effect).
- The confirm flow's internal awaiting sub-step is itself keyed
  (`<action key>:await`) so a retry of a partially completed confirm
  converges.
- `expectedVersion` (when supplied by the UI) crosses to the store's
  optimistic check; mismatch → `QLT_VERSION_CONFLICT`, zero effects.
- Failed validation and failed transactions leave zero partial effects
  (row/link-count negative controls on every failure class).
- The correction key is server-derived from the action's idempotency key
  (`corr-<key>`): a retried correction converges to the SAME successor;
  the (subject, correction-key) uniqueness holds; client-supplied
  correction keys are not an input surface.

## 11. Quiet-inbox interaction states (frozen)

```text
memoryClosed        default; a small chip shows only when count > 0:
                    'Memory · N pending' with an accessible name
memoryOpen          user-opened tray (click/keyboard on the chip); shows:
                    pending proposals (content, kind, provenance
                    'drafted by the assistant', source-thread + turn
                    reference, stale flag when applicable) with
                    Confirm / Edit / Reject / Withdraw;
                    decided proposals in their truthful terminal states
                    (confirmed, rejected, amended, withdrawn, stale
                    refusal);
                    the 'Remember this' direct-Save form (claim /
                    commitment / open loop) with the durable-write
                    disclosure and a Save control;
                    the thread's recent records (status badges) with a
                    Correct action per record (inline correction form);
                    a failure line inside the tray when an action fails
                    (never a global interruption)
memoryActionFailed  the affected control shows the stable code; the
                    conversation is never blocked or erased
```

Interaction law: the tray NEVER opens or focuses itself; the count
updates silently; no timers, no re-prompting, no modal, no transcript
insertion; pending proposals stay pending indefinitely; sending,
streaming, stopping and reconnecting are never blocked by inbox state;
Escape closes the tray; focus returns to the chip on close; every control
is keyboard-reachable with a visible focus ring and an accessible name.

## 12. Correction targeting rule (frozen)

Q3 correction is USER-finalized only: the user opens a record in the tray
and submits a correction; the target identity comes exclusively from the
user's own UI selection over `act.queryMemory` results (trusted,
model-independent). The durable agent-originated correction proposal path
requires a trusted server/UI interaction to supply the exact target
identity independently of the model; Q3 instead DEFERS agent-originated
correction targeting to Q4 — the pinned capability rejects
`proposalKind: 'correction'`, so an agent correction cannot target ANY
record, arbitrary or otherwise. No agent read tool exists to make
correction convenient.

## 13. FENCE-1 treatment (frozen; D-Q3-6)

- The `/api/act` ingress field checks move from prototype-chain lookups to
  own-property checks; request keys named `__proto__`, `constructor`, or
  `prototype` (case-sensitive, own or inherited lookups) fail closed with
  the new stable code `QLT_INGRESS_PROHIBITED_FIELD`; plain unknown keys
  continue to fail with `INVALID_REQUEST` (unchanged).
- The query `filters` rebuild rejects the same prohibited names with the
  same stable code (the silent `__proto__` drop is closed).
- Every previously valid declared-field behavior is preserved (positive
  regression controls: thread create/rename/archive/reopen and query
  filters; every memory action's declared fields).
- Permanent negative controls prove the failure is closed and value-free;
  the change is recorded here and in the implementation report as a Q3
  resolution of the open Q1 Low finding — Q2 did not resolve it and no
  frozen document is rewritten.

## 14. TEST-1 scenario (frozen; offline deterministic composition)

TEST-1 is the permanent ceremony-recovery proof. It is delivered as a
real-browser script (`scripts/browser-ceremony-check.mjs`) PLUS the node
ceremony suite, permanently wired into the aggregate. Proof surfaces:

| #   | Requirement (task wording)                                              | Proof surface                                                                                             |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | fixture agent turn invokes the proposal capability                      | browser (fixture tool-call turn) + node (composition-level)                                               |
| 2   | conversation continues; quiet pending count appears                     | browser                                                                                                   |
| 3   | inbox does not open or steal focus automatically                        | browser                                                                                                   |
| 4   | reload/reconnect re-presents the pending proposal                       | browser (hard reload) + node (store reopen)                                                               |
| 5   | user confirmation crosses the governed boundary                         | browser (keyboard confirm via `/api/act`)                                                                 |
| 6   | hard reload around the commit boundary converges on the truthful result | browser                                                                                                   |
| 7   | exactly one target record exists                                        | browser (records list) + node (row counts)                                                                |
| 8   | retrying the same command returns the recorded outcome                  | node (same-key replay through the ingress)                                                                |
| 9   | rejected and withdrawn proposals create no canonical record             | browser (reject/withdraw scenarios on fresh threads) + node (row counts)                                  |
| 10  | stale proposals visibly refuse unchanged confirmation                   | node (`QLT_PROPOSAL_STALE` through `act.confirmProposal`; tray renders the stale badge — component test)  |
| 11  | keyboard-only review and decision work                                  | browser                                                                                                   |
| 12  | accessibility baseline remains clean                                    | browser (axe serious/critical = 0 on both viewports, tray open)                                           |
| 13  | agent-identity decision attempts fail with zero effects                 | node (store + capability negative controls) + structural                                                  |
| 14  | confirmed records never enter the model/tool-readable surface           | node (bounded output contract; no read capability; follow-up turn carries no record content) + structural |

The browser script uses the production adapter-node build, the offline
deterministic fixture, an ephemeral port, and a throwaway data directory.
No live provider is involved.

## 15. Accessibility and responsive requirements (frozen)

The memory surface inherits the Stage 05 discipline: full keyboard
operation (review → decision), visible focus, accessible names for every
control, `aria-live` announcements after user-visible state changes
(pending count changes and decision outcomes are announced politely),
desktop/tablet/mobile responsive layout with no horizontal overflow, and
an axe-clean serious/critical baseline with the tray open. The chip and
tray are real buttons/regions (no modal, no focus trap); the tray closes
on Escape and returns focus to the chip.

## 16. File-ownership map (parallel lanes; no two lanes share a file)

| File                                                                                                                                                                                                                                                                                                     | Lane                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md`, `src/lib/sharedworld/ceremony-contract.ts`                                                                                                                                                                                                | Phase 0 freeze (integration owner; frozen for all lanes) |
| `src/lib/application/definition.ts`, `src/lib/server/application-server.ts`, `src/lib/server/composition.ts`, `src/lib/server/runtime.ts`, `src/lib/sharedworld/ceremony-actions.ts` (new), `src/lib/sharedworld/sqlite.ts` (read-only memory listing helper only — amendment A-AMEND-1)                 | Lane A — governed application and persistence surface    |
| `src/lib/agent/proposal-capability.ts` (new), `test/proposal-capability.test.ts` (new)                                                                                                                                                                                                                   | Lane B — agent proposal capability                       |
| `src/lib/islands/ConversationWorkspace.svelte`, `test/ui/workspace.test.ts`, `test/ui/memory-inbox.test.ts` (new)                                                                                                                                                                                        | Lane C — quiet memory UX                                 |
| `test/ceremony-authority.test.ts` (new), `scripts/verify-q3.mjs` (new), `package.json` (verify:q3 script), `scripts/verify-quellight.mjs` (aggregate steps), `scripts/verify-q2.mjs` (structural inventory reconciliation ONLY), `test/sharedworld-meaning.test.ts` (A-29 inventory reconciliation ONLY) | Lane D — contract-first adversarial tests + verifier     |
| `scripts/browser-ceremony-check.mjs` (new)                                                                                                                                                                                                                                                               | Lane E — TEST-1 browser specification and harness        |
| `README.md`, `docs/system-reference.md`, `docs/decision-register.md`, `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`                                                                                                                                                 | documentation/evidence lane                              |

No lane touches `package-lock.json`, the VICT repository, `.pi/` material,
historical reports, frozen Q2 artifacts
(`meaning-contract.ts`, the Q2 reports), or the canonical input. Lane D's
touching of `verify-q2.mjs` / `sharedworld-meaning.test.ts` is bounded to
the frozen-inventory reconciliation (§18) and is disclosed here in
advance; assertions are re-pinned to the Q3 frozen inventory, never
weakened. Lane E depends only on this freeze (§3 trigger contract) and
Lane A's fixture entries, never on Lane A's files.

## 17. Acceptance and negative-control matrix (numbered)

Lane D's permanent suite plus `verify:q3` and TEST-1 must prove every row;
every important semantic assertion has an independently inspectable
negative control.

| #    | Control                                                                               | Expected                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Agent drafts via the pinned capability during a real scripted turn                    | pending `proposed` row exists; epistemically inert; turn completes; tool result is the bounded outcome only                             |
| B-02 | The capability is the ONLY model-facing tool; no read/list/search capability resolves | exactly one envelope entry; resolver returns undefined for everything else                                                              |
| B-03 | Agent confirmer identity on any decision verb                                         | `QLT_CONFIRMER_INVALID`; zero effects                                                                                                   |
| B-04 | Agent withdraw/correct/exit attempts (any surface)                                    | structurally impossible; store CHECKs hold                                                                                              |
| B-05 | User confirms a pending proposal                                                      | one transaction effect: proposal `confirmed` (decision_by = user), target record created exactly once, `proposed-from` link present     |
| B-06 | User rejects / withdraws                                                              | terminal state recorded; zero canonical rows                                                                                            |
| B-07 | User edits (amends)                                                                   | original `amended`; NEW pending proposal; no confirmation; confirming the amendment confirms only the new record                        |
| B-08 | Direct Save (claim/commitment/loop)                                                   | immediately ACTIVE/OPEN; `created_by` = user; no second ceremony; truthful source-thread link                                           |
| B-09 | Model-impersonated direct Save                                                        | impossible: no model path to create actions (structural + runtime)                                                                      |
| B-10 | Missing turn correlation (no turn record)                                             | `QLT_CORRELATION_MISSING`; zero effects                                                                                                 |
| B-11 | Model/client-supplied correlation fields                                              | unknown-field contract rejection                                                                                                        |
| B-12 | Production correlation is server-derived                                              | stored sourceThreadId/sourceTurnRef equal the server-resolved values for a scripted turn                                                |
| B-13 | One open proposal per thread/turn/kind                                                | second same-kind draft in the same turn → `QLT_PROPOSAL_OPEN_EXISTS`; different kinds coexist                                           |
| B-14 | Elapsed time alone never causes staleness                                             | an arbitrarily old pending proposal with unchanged references confirms normally                                                         |
| B-15 | Source/target version change causes staleness                                         | seeded changed-version scenario → `QLT_PROPOSAL_STALE`; zero effects; truthful current state                                            |
| B-16 | Stale proposal cannot confirm unchanged                                               | `QLT_PROPOSAL_STALE` at the action surface; the UI renders the stale state (component test)                                             |
| B-17 | Edit creates a new pending proposal and does not confirm                              | covered by B-07 (explicit)                                                                                                              |
| B-18 | Correction is append-only and user-finalized                                          | predecessor content bytes unchanged; successor linked; correction row immutable; `corrected_by` = user                                  |
| B-19 | Agent correction cannot target any record                                             | capability rejects `correction` kind; no targeting path exists                                                                          |
| B-20 | Same-key retries converge (every memory action)                                       | same durable outcome, no duplicates                                                                                                     |
| B-21 | Conflicting same-key content fails closed                                             | `QLT_IDEMPOTENCY_CONFLICT`; original effect intact                                                                                      |
| B-22 | Double click / reconnect / replay create one effect                                   | identical duplicate dispatches (same key) converge; VICT receipt replay carries no second effect                                        |
| B-23 | Validation and transaction failures leave zero partial effects                        | row/link counts identical before/after on every failure class                                                                           |
| B-24 | Pending proposals survive refresh/restart                                             | store close/reopen (fresh process) re-presents pending; browser hard-reload re-presents                                                 |
| B-25 | Memory inbox never blocks or interrupts conversation                                  | component test: composer enabled and send/reconnect states reachable while pending > 0; no auto-open/focus (TEST-1 #3)                  |
| B-26 | No modal / focus theft / repeated prompt                                              | component + browser assertions                                                                                                          |
| B-27 | FENCE-1 prohibited keys fail closed; valid legacy actions unchanged                   | `QLT_INGRESS_PROHIBITED_FIELD` on `__proto__`/`constructor`/`prototype` request and filter keys; full positive thread-action regression |
| B-28 | No route-local SQLite write or second effect path exists                              | structural scans (verify:governance, verify:q3): routes/islands store-free; one effect path through the released boundary               |
| B-29 | No Q4 context assembler or agent memory reader exists                                 | structural: no context-assembly module; agent module imports no record-read surface                                                     |
| B-30 | VICT 0.2.0 pins and release identity remain exact                                     | verify:consumer green; lockfile untouched by Q3                                                                                         |
| B-31 | Truthful independent outcomes                                                         | a proposal refusal (e.g. B-13) never fails the turn or corrupts the transcript; stream terminal remains truthful                        |
| B-32 | Announcement and keyboard discipline                                                  | live-region announcement on count change and decision outcomes; keyboard-only review→decision (TEST-1 #11)                              |

## 18. Verification-command containment map (frozen)

Final authoritative sequence (the ONLY final-tree execution; component
commands may be used during development but are NOT re-run immediately
before the aggregate):

```text
npm ci
npm run verify:consumer
npm run verify:quellight
npm audit --omit=dev
```

`verify:quellight` permanently contains, after Q3 integration (existing
steps unchanged and in order): format:check; typecheck; verify:governance;
verify:q2 (with the §16-bounded inventory reconciliation); **verify:q3
(new; Lane D)**; node-side tests (now including `ceremony-authority` and
`proposal-capability` suites via the existing configs); browser-side
island tests (now including the memory-inbox suite); production build +
build-log scan; credential/canary scan; git hygiene; and the real-browser
checks **including the new TEST-1 browser ceremony check
(`scripts/browser-ceremony-check.mjs`)** beside `browser-check` and
`browser-stop-check`. No existing step is weakened, replaced, or removed.
`verify:live-provider` is NOT run in Q3 (no live-provider proof).

## 19. Documentation, status, and amendment procedure

Documentation obligations: the implementation report
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`);
truthful updates to `README.md`, `docs/system-reference.md`,
`docs/decision-register.md` (the six owner decisions recorded without
inventing new normative decision IDs); Q3 status recorded exactly as
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`; no Q4 start; and the
narrow VICT System Reference reconciliation AFTER the verified Quellight
implementation commit exists (Q2 closure + Q3 implemented + implementation
SHA + release identity unchanged + Q4 not begun + Stage 07 In Progress;
expected v0.4.14).

Independent-audit boundary: this task performs contract freeze,
implementation, integration, self-verification, and reporting. It does NOT
audit Q3 and does NOT close it. Q3 remains
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` until an independent
verification and a formal closure exist.

Amendment: if implementation reveals a material contract defect, affected
lanes STOP; the integration owner reconciles the change ONCE, records the
amendment (dated addendum; no silent edits), and restarts affected work
from the amended freeze SHA.

## 20. Dated amendments

### A-AMEND-1 (2026-09-16, recorded before Lane A began; Lane B restarted from the amended SHA)

The memory query surface (§3) declares a `threadId` equality filter over
ALL four families. The frozen Q2 repository exposes thread-scoped reads
for proposals (`listProposals({ sourceThreadId })`) but not for the claim,
commitment, and open-loop families (their Q2 query types carry no thread
field, and `meaning-contract.ts` is frozen). Rather than filtering
unbounded pools in application code or touching frozen Q2 artifacts, Lane
A's file map gains `src/lib/sharedworld/sqlite.ts` for ONE bounded,
READ-ONLY helper: a thread-scoped listing SELECT (per family:
`WHERE source_thread_id = ?` plus the declared status/kind constraints,
`ORDER BY updated_at_ms DESC, id ASC`, LIMIT/OFFSET + truthful filtered
count) over the SAME connection. It is a read path only — it creates no
second WRITE/effect path (the single-effect-path rule governs writes and
remains enforced). No other change: every other element of this freeze,
including all frozen identifiers, contracts, codes, and the Q2 artifacts,
is unchanged.

### A-AMEND-2 (2026-09-16, during Lane C's first UI integration pass)

The unified read projection (A-AMEND-1 context) carries no field naming a
proposal's SPECIFIC drafted kind, but the tray must label it truthfully
("Possible claim") and rebuild kind-shaped amendment content (freeze §5).
The §3 catalogue gains ONE additive field: `proposalKind` (string) — for
proposal rows the drafted kind (`claim` | `commitment` | `open_loop`);
empty string on record rows. Declared view `v.memory` gains the same
field; the adapter projection, the frozen module's `QLT_MEMORY_FIELDS`,
and the UI consume it. Everything else is unchanged. Lane A's commit is
amended in place (its files are the only code touched besides the frozen
module data), and Lane C continues from the amended state.

### A-AMEND-3 (2026-09-16, during Lane D's adversarial run)

The Q1-era live test `test/composition.test.ts` (N-12) pins the agent
authority envelope as EMPTY (`capabilities.length === 0`) — true for 07B
through Q2, superseded by the frozen Q3 §3 envelope of exactly ONE
capability. Lane D's file map gains `test/composition.test.ts` for ONE
bounded reconciliation: the N-12 envelope assertion is re-pinned from
"empty" to "exactly the pinned proposal-draft capability" (the same
single-entry envelope, id + revision asserted); every other N-12
assertion (no thread mutation by a text-only turn; store survival) is
unchanged and stays green. This continues the same reconciliation
principle recorded in §16 for the Q2-era structural gates: re-pinning
to the amended frozen reality, never weakening.
