# Decision register

Quellight's binding decisions. Entries are appended; decisions are not
reopened without concrete incompatibility evidence.

## D-1 — Stage 07B provider (owner)

- **Decision**: Ollama Cloud is the Stage 07B provider.
- **Model**: `glm-5.3-flash`
- **Router identity**: `ollama-cloud/glm-5.3-flash`
- **Endpoint**: `https://ollama.com/v1`
- **Credential variable**: `OLLAMA_API_KEY`
- **Consequences**: exactly one profile; no automatic fallback; no
  provider rotation. The Z.ai Coding Plan may be used by the coding
  agent during development but is never a Quellight runtime provider.

## D-2 — Remaining Stage 07 sequence (owner)

Accepted sequence:

```text
07C — Shared World Meaning and Ceremony
07D — Retention, Recovery, and Real-Use Proof
07E — Stage 07 Exit Gate
```

Stage 07B must not implement 07C–07E scope.

## D-3 — Immutable consumption (owner + release identity)

Only exact public registry versions (initially `@victframework/*@0.1.0`
— release identity `vict-release-set@1/0.1.0`, content ID
`v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`;
as of Phase Q1 the adopted set is `@victframework/*@0.2.0`, release
identity `vict-release-set@1/0.2.0`, content ID
`v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`,
see D-10).
`workspace:` / `file:` / `link:` / git dependencies / vendored VICT
source are prohibited and are negative-controlled by
`npm run verify:consumer`.

## D-4 — Framework-change proposal: `app.data.mutate` payload

**Finding** (bounded, reproducible): the released
`vict.app-command@1` `app.data.mutate` command payload has a closed
field set (`resourceId`, `releaseVersion`, `expectedRevision`,
`actionKind`) that structurally cannot carry a mutation payload (the
operation id and its input). There is no released field in which a
consumer can place the mutation input, so thread mutations cannot cross
that command without inventing an undeclared field — which the
framework correctly rejects.

**Resolution for 07B (no framework change, no bypass)**: thread queries
cross the released `app.data.query` command as specified; thread
mutations cross the VICT-delivered **typed Application Layer action
boundary** (`/api/act` → `ApplicationDataAdapter` per DATA-014), which
is the release-defined consumer extension point for application
actions. The released `app.data.mutate` command is wired and fails
closed with `QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED` (proven by a
negative control).

**Proposal to the framework owners** (for a future release, NOT applied
here): extend the `app.data.mutate` payload schema with an explicit,
closed mutation envelope field (for example
`mutation: { actionKind, input }`) so consumers can use the command
path without weakening its closed-payload discipline.

## D-5 — npm tooling (environment note)

Plain `npm install` crashes on npm 10.9.2 with this dependency set
(arborist `#loadPeerSet` null dereference). Dependency changes use
`npm install --legacy-peer-deps`; the committed lockfile reproduces
cleanly with plain `npm ci`. This is an npm tooling issue, not a VICT
defect.

## D-6 — Windows store-lock note

On Windows, a store file can still be locked (EBUSY) briefly after
`close()`. Tests treat temp-store removal as best-effort and never
assert deletion. No test asserts "close then immediately reopen the
same path" on Windows; close/reopen is proven by reopening through a
fresh process (restart tests) and by the migration verification.

## D-7 — Transient stream deltas and durable reconcile

`text.delta` frames are a **transient** kind in `vict.agent-stream@1`:
they are best-effort live delivery and are not replayed from the ledger
to a subscriber that connects after the fact. Quellight therefore
treats the terminal event as the durable milestone and reconciles the
open thread's transcript from the VICT-authoritative restore boundary
at terminal. This is the honest composition of the released contracts:
nothing fabricated, nothing invented, no framework change.

## D-8 — VICT semantic authority (owner enforcement principle; mirror of VICT GOV-007)

Registered in VICT as governing requirement **GOV-007**
(`VICT-SYSTEM-REFERENCE.md` v0.4.7, §0.4 and §0.16.2) at the Stage 07B
formal closure; mirrored here as a binding Quellight decision:

- VICT's released definitions, typed IR, contracts, compilers, runtimes,
  capability boundaries, execution identities, delivery semantics, and
  protocols are authoritative wherever VICT defines the behavior.
- YAML is an optional authoring or serialization notation; YAML itself
  provides no architectural enforcement or conformance guarantee. Stage
  07B was **not** YAML-authored — its authoritative representation is
  the typed Application Definition plus the compiled plan; YAML absence
  alone is never a conformance failure.
- A consumer may implement product UI, presentation state, product
  policy, prompts, product-owned storage, and thin documented adapters.
- A consumer may not recreate, shadow, bypass, or silently replace
  VICT-owned semantics.
- A framework limitation must fail closed and become an explicit
  framework-change or registered-extension proposal — never a custom
  shortcut.
- Every effectful user action must have auditable provenance from the
  user-visible action through its declared application action or
  capability, runtime handler, governed boundary, and resulting effect;
  presentation-only actions (focus, panel visibility, local layout) do
  not require capability governance.
- Independent consumer audits must treat an unproven critical VICT path
  or semantic bypass as blocking even when the application appears to
  work.

## D-9 — Stage 07C entry gate (F-8)

The released `app.data.mutate` command payload structurally cannot carry
mutation input (D-4; confirmed at released-source level by the
independent audit). This is non-blocking for Stage 07B (closed 2026-09-10)
and binding as the **Stage 07C entry gate** (VICT reference §0.16.3;
`docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md` §5): before Stage 07C
implements Shared World proposals, confirmation ceremonies, corrections,
commitments, open loops, or other durable meaning writes, the Stage 07C
handoff must resolve F-8 by proving ONE of:

1. the required mutation input is expressible through a released public
   VICT application/capability boundary; or
2. a formally defined, registered, governed consumer capability
   extension provides the required input and effect boundary; or
3. VICT is corrected, independently verified, released as a new
   immutable package set, and Quellight adopts that exact set through a
   controlled compatibility change.

Prohibited: `UI or ordinary product route → custom mutation shortcut →
direct durable write` merely because the current `app.data.mutate`
payload is insufficient. The existing bounded `/api/act` treatment
remains historical Stage 07B behavior and must not silently become the
general Stage 07C effect model.

## D-10 — Controlled adoption of VICT 0.2.0 and the governed mutation boundary (Phase Q1)

**Decision (Phase Q1, implemented):** Quellight adopts the exact
coordinated public release set `@victframework/*@0.2.0` (release identity
`vict-release-set@1/0.2.0`, content ID
`v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`,
independently re-derived from the public registry during Phase Q1),
resolving the D-9 entry gate through option 3: VICT was corrected (Stage
07C Phase F2/F3), independently verified, released as the new immutable
set, and adopted here through a controlled compatibility change.

Consequences:

- the historical Stage 07B `/api/act` → direct-`ApplicationDataAdapter`
  mutation accommodation (D-4) is RETIRED. `/api/act` is now a thin
  transport ingress over the released `app.data.mutate`/`app.data.query`
  command boundary (closed mutation envelope; plan-resolved action
  identity; contract-fenced input; durable claim/lease/fenced
  idempotency; server-derived actor). The parallel in-process shortcut
  `sharedWorldActionBoundary` is removed and gated.
- there is exactly ONE authoritative effect path for Quellight thread
  mutations: UI → declared action → compiled contract → released
  boundary → resolved handler → one SQLite transaction → attributable
  result/event. This remains the BOUNDED Stage 07B behavior set; it is
  NOT the general Shared World write architecture (Q2/Q3 boundary).
- D-4 remains the historical finding/record (not rewritten); D-9's
  prohibition is enforced structurally and at runtime by the permanent
  gates (`npm run verify:governance`, `test/governed-mutation.test.ts`).
- rollback (if ever needed) restores the 0.1.0 manifest + lockfile
  through version-control reversal only; no runtime dual-path toggle;
  the public release is never mutated.
- Phase Q1 does NOT begin Shared World meaning or ceremony work; Q2–Q7
  remain pending.

**Status update (2026-09-13, formal closure):** Phase Q1 is independently
verified — verdict `VERIFIED WITH NON-BLOCKING ISSUES — PHASE Q1 FORMAL
CLOSURE PERMITTED` (audit at Quellight commit `73d53c8e339eb387d80963fd733bf34f89984a51`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`) —
and FORMALLY CLOSED (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md`),
reconciled with the VICT constitutional closure commit
`0f4f72b0812bdfa40229a170f4d97e9696f72dd9` (VICT System Reference
v0.4.13, §0.21). D-10 therefore carries VERIFIED delivery status: the
D-9 entry gate is resolved and closed through authorized path 3, and the
audit adopted `QUELLIGHT STAGE 07C PHASE Q1 VERIFIED WITH NON-BLOCKING
ISSUES — FORMALLY CLOSED`. Carried findings: FENCE-1 (Low — the Q1
ingress silently drops prototype-named unknown fields; proven harmless;
Q2/Q3 Shared World contracts must define explicit closed-field and
prototype-key behavior) and TEST-1 (Low — no permanent browser-level
replay-recovery test; due no later than Phase Q3 verification, before
the confirmation ceremony is accepted as reliable); DOC-1 (the stale
0.1.0 statement in the system reference) was resolved at closure; the
informational findings (gate fill-in semantics, the pre-existing
streaming completion race, replay non-selection of the affected thread,
and the unchanged 07B-bounded conversation-correlation insert) are
carried without reopening Q1. Phase Q2 — durable Shared World schema —
is permitted and NOT BEGUN; Q3–Q7 have not begun; Stage 07C and Stage 07
remain In Progress.

**Status update (2026-09-13, Phase Q2 implementation):** Phase Q2 — the
durable Shared World schema foundation authorized by this closure — is
IMPLEMENTED and AWAITING INDEPENDENT VERIFICATION (see
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`;
frozen contract:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`). The Q2
schema derives from the Stage 07C handoff (§7.1 record families; §8
ceremony vocabulary; §10 correction lineage) and the ratified OQ6 owner
decision (handoff §19) — no new owner-level decision was required, so no
new decision identifier is created. Q2 adds no production meaning or
confirmation path: the declared action surface, `/api/act`, and the VICT
0.2.0 pins of D-10 are unchanged (permanently gated); schema existence
alone never makes material canonical, model-visible, or user-confirmed.
This entry remains the record of the Q1 adoption; the Q2 boundary notes
live in the system reference and the two Q2 reports.

**Status update (2026-09-16, Phase Q2 formal closure):** Phase Q2 — the
durable Shared World schema foundation — is independently verified
(verdict `VERIFIED WITH NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`;
audit at Quellight commit
`95f03699572b7597be0bbe933964f0207e549c44` against the audited
implementation SHA `9076fb0dbfdb15beeebef64adaa4f699ba9b60b5`;
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`:
zero Blocking/High/Medium findings, complete first-run verification
ladder, 178-check `verify:q2`, independent 75/75 adversarial probe) and
FORMALLY CLOSED (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md`).
No new decision identifier is created by this closure: formal closure is
a governance act, not a new architectural decision, and Q2's normative
artifact remains the frozen contract
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`, derived
from the Stage 07C handoff and the ratified OQ6 addendum). Carried Low
findings: F-Q2-1 (historical prose-index erratum — the frozen contract §2
and implementation report §6 name fifteen of the sixteen indexes,
omitting `idx_qlt_correction_subject`; the normative machine-readable
inventory, migration DDL, and 139 schema-introspection checks contain and
enforce all sixteen; recorded, not a schema defect, frozen documents not
rewritten) and F-Q2-2 (withdrawal is user-attributed-only in this schema
revision while frozen contract §8.2 prose admits either identity;
strictly narrower, no excess authority, no production withdrawal path;
Phase Q3 must explicitly decide withdrawal initiation and attribution
before wiring any withdrawal action and must not silently reinterpret the
frozen discrepancy). Binding Q3 inputs carried forward: real turn
correlation before production enforcement of the
one-open-proposal-per-turn rule (NULL turn references remain distinct);
TEST-1 permanent browser replay recovery no later than Phase Q3
verification, before the confirmation ceremony is accepted as reliable;
Q2 remains storage-contract-only (no proposal, confirmation, withdrawal,
correction, UI, route, agent-tool, or context-assembly path active); the
Q1 FENCE-1 Low ingress observation remains separately open (Q2's safe new
contracts do not retroactively close it). The D-10 boundary is unchanged:
`/api/act` and the declared action surface are untouched, and every
future effectful write uses the governed VICT 0.2.0 boundary adopted
through this entry. Phase Q3 contract and implementation planning is
permitted and NOT BEGUN; Phases Q4–Q7 have not begun; Stage 07C and
Stage 07 remain In Progress.

**Status update (2026-09-16, Phase Q3 implementation):** Phase Q3 — the
governed confirmation ceremony and quiet memory inbox — is IMPLEMENTED
and AWAITING INDEPENDENT VERIFICATION (see
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`;
frozen contract:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md`, with dated
amendments A-AMEND-1…4). The six Phase Q3 owner decisions are recorded in
the frozen contract §2 as D-Q3-1…D-Q3-6 and are not new architectural
decision entries of this register (they are product-level phase
decisions derived from the ratified OQ6/D-10 framework, mirroring the Q2
convention of not minting new register identifiers without a normative
architectural change): D-Q3-1 withdrawal is durable user-attributed only
(explicitly resolving the carried F-Q2-2 discrepancy in the narrower
direction, with no agent withdrawal authority and no Q2 CHECK change);
D-Q3-2 the memory inbox is quiet, user-opened, never auto-opening,
never focus-stealing, never blocking conversation, and never requires a
decision; D-Q3-3 pending agent proposals support Confirm, Edit (which
amends — closing the original as `amended` and creating a new pending
proposal — and never silently confirms), Reject, and durable Withdraw;
D-Q3-4 direct "Remember this" Save is a first-party, user-attributed UI
action that is immediately canonical without a second ceremony, and
ordinary model interpretation of natural language can never reach it;
D-Q3-5 the claim/commitment/open-loop exit verbs exist at the API level
with dedicated UI controls deferred to Q5; D-Q3-6 the Q1 FENCE-1 ingress
observation is hardened in Q3 (prototype-named or otherwise prohibited
request keys fail closed with the stable non-echoing
`QLT_INGRESS_PROHIBITED_FIELD` code, all previously valid declared-field
behavior preserved, permanent positive and negative regression controls,
recorded openly rather than retrofitted into Q2 history). The A-AMEND-4
reconciliation additionally fixed a latent Q2 store defect exposed by
Lane E (keyed reconciliation payloads crashed on absent optional
fields; fingerprints for provided-field calls are unchanged). The agent
retains NO Shared World read, list, search, assembly, or decision power
in Q3; its only Shared World outcome is the immediate bounded result of
its own proposal-draft invocation. TEST-1 (the permanent real-browser
ceremony recovery proof) is wired into `verify:quellight` alongside the
focused `verify:q3` gate. Phase Q3 is not verified or formally closed
by this update; Phases Q4–Q7 have not begun; Stage 07C and Stage 07
remain In Progress.

**Status update (2026-09-16, Phase Q3 independent verification and formal
closure):** Phase Q3 was independently verified with the verdict
`VERIFIED WITH NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`
(zero Blocking/High findings; three Medium, three Low, two Observations,
all non-blocking;
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-INDEPENDENT-VERIFICATION.md`,
audit commit `a8b702f…`, audited implementation tree `2e494723…`) and is
FORMALLY CLOSED
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-FORMAL-CLOSURE.md`; audited
executable SHA unchanged). The carried findings are recorded in the
closure with their obligations: M-1 the disclosed `read` effect-class
metadata on the pinned capability (framework-change proposal owed to the
VICT owners; the durable invocation record shows `effect: 'read'` for a
durable creation until it lands); M-2 the frozen Escape-to-close
interaction item is unimplemented (truthful test or owner-approved
deviation owed in the next inbox change); M-3 process discipline
(amendment commit `8dc0032` bundled with Lane C's implementation; content
verified conformant; future amendments must not share a commit with
consuming implementation); L-1 documentary errata (amendment lane
misname; `id DESC` tie-break against the frozen `id ASC` text; extra
accepted sort field `createdAt`); L-2 the real browser never exercises a
stale proposal end-to-end (the frozen containment map authorized the
node/component split); L-3 the implementation report's changed-file
inventory erratum (actual 26 files +6551/−102 vs the claimed 22 files
+6106/−93). D-Q3-1…D-Q3-6 stand as ratified; the carried F-Q2-2
discrepancy is resolved by D-Q3-1; the Q1-era FENCE-1 Low finding is
resolved by D-Q3-6 and the TEST-1 Low debt is satisfied and
independently verified closed. Confirmed Shared World meaning is now
available to the agent ONLY through the deterministic, bounded,
per-turn context snapshots of Phase Q4 (D-Q4-1…D-Q4-6 below). Phase Q4
is IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION; Phases Q5–Q7 have
not begun; Stage 07C and Stage 07 remain In Progress.

## D-Q4-1…D-Q4-6 — Phase Q4 owner decisions (frozen; recorded)

Ratified in `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md`
(freeze SHA `b4bf759…`, committed alone, no amendments):

- **D-Q4-1 (injection point).** The Quellight-owned model seam at the
  per-turn model boundary; ONE user-role message (one text part)
  immediately before the trailing user message, call-scoped; the durable
  transcript is never modified; record content never enters the fixed
  system-instruction string; no static working memory or semantic
  recall.
- **D-Q4-2 (agent access).** The agent receives only the assembled
  snapshot; the capability envelope remains EXACTLY
  `qlt.proposal.draft@1`; no read/list/search tool, no lookup, no
  embeddings, no semantic retrieval, no second model call. The Q3 §12
  agent-originated-correction deferral therefore remains beyond Q4.
- **D-Q4-3 (cross-thread continuity).** `sourceThreadId` records origin,
  never access scope; three selection layers (current-thread, global,
  other-thread), classes open_loop → commitment → claim, `updatedAt
DESC, id ASC`; the 8-record/4096-byte budget prevents whole-World
  prompts; explicit user-controlled scope remains a possible Q5
  enhancement (nothing hidden was invented).
- **D-Q4-4 (conflicts).** The assembler performs no semantic conflict
  detection; only structured-identity duplicate-current groups are
  excluded, AS A GROUP, with `conflict-ambiguous`; invalid provenance or
  corrupt lineage fails closed; the model may see two truthful records
  in tension but receives no durable resolution authority.
- **D-Q4-5 (M-1 timing).** The VICT effect-class correction is recorded
  (never implemented inside Q4) with the hard deadline: before the
  Phase Q6 live-provider proof, and therefore before the Stage 07C final
  audit.
- **D-Q4-6 (transparency).** A quiet, non-interruptive usage line inside
  the user-opened memory tray only (`used N` / `none` / `unavailable`);
  no transcript annotation, no auto-open, no focus stealing, no full
  inspection UI (Q5).

Q4 disposition (2026-09-16): implemented as frozen; recorded as
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`; the two disclosed Q3
re-pins (migration bookkeeping `[1,2,3]`, assembler-location
authorization) strengthened assertions and never weakened them. The
carried M-2/L-1/L-2/L-3 findings are closed in Q4 as recorded in the
implementation report; M-1 and M-3 obligations remain tracked (M-3
honored: no amendment commits were needed).

## D-Q4-H1-1 — One active agent turn per conversation (owner decision; binding; implemented by the H-1 remediation)

The Phase Q4 independent verification (audit commit `821d4f8…`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-INDEPENDENT-VERIFICATION.md`)
confirmed the High finding **H-1** (same-conversation turn-overlap
snapshot crossover) and permitted no formal closure. The owner decision
is now binding:

> Quellight permits exactly one active agent turn per conversation. A
> distinct request arriving while a reply remains active is rejected
> truthfully and creates no second turn. A retry of the same logical
> request preserves VICT's existing idempotent replay behavior.

Applies to the current single-process Quellight product scope. The second
message is NOT queued; parallel replies in one conversation are NOT
permitted; different conversations may continue concurrently.

The remediation contract
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION-CONTRACT.md`,
committed alone before any executable change, dated 2026-09-16; the
frozen Q4 contract is NOT rewritten) freezes the state matrix, the
stable non-echoing refusal code `QLT_TURN_ALREADY_OPEN` ("A reply is
already in progress for this conversation." — quiet, non-interruptive:
no modal, no tray opening, no focus change), and the two required
layers (race-safe admission control at the Quellight-owned turn-start
boundary, atomic for the single-process deployment; the model-seam
defensive backstop). Implemented in
`src/lib/server/turn-admission.ts`, the turns route, and the
`resolveForStream` backstop; permanent regression coverage in
`test/turn-overlap-isolation.test.ts`. Status after implementation:
`Q4 H-1 REMEDIATED — AWAITING FRESH INDEPENDENT RE-VERIFICATION` — Q4
is NOT Verified and NOT formally closed by the remediation.

Audit-finding dispositions recorded by the remediation documentation
pass (additive; no historical report rewritten): **L-1** (duplicated Q3
status line in README/system-reference) corrected in this pass; **L-2**
(implementation-identity lag) reconciled additively — the Q4 audited
implementation tree is `c4896bef…` (executable content unchanged since
`bf7fec3`), the audit-report commit is `821d4f8…`; **L-3** (pre-existing
Q3 latent defect: confirming a `correction`-kind proposal through
`confirmProposal` always fails `QLT_RECORD_EXISTS` —
`applyCorrectionInTransaction` already writes the successor's
source-thread link and the confirmation loop writes it again, so the
transaction rolls back; dormant because the active production correction
path is `applyCorrection` and the capability rejects correction
proposals) is recorded as a **Q5/backlog obligation only** and is NOT
repaired by this remediation; **O-1/O-2/O-3** remain observations; the
pending-correction fixture limitation and the Q3 correction-proposal
deferral remain preserved; **M-1** remains open with its hard deadline
(the truthful noncanonical/proposal VICT effect-class correction and
Quellight repin must complete before the Phase Q6 live-provider proof
and the Stage 07C final audit).

## D-FUTURE-STEERING-1 — Future turn steering (deferred product direction; recorded, NOT implemented)

Deferred product direction, not an implementation requirement of the
H-1 remediation:

> In the future, Quellight may allow the user to steer an answer while
> it is being generated. Steering must be an explicit operation
> targeting the exact active turn — not a second overlapping turn.

Future steering requires a separate contract covering: exact target-turn
identity; append-guidance versus cancel-and-restart semantics; durable
event and transcript truth; idempotency; restart/reconnect behavior;
context-snapshot consequences; provider support; and user-visible
state. Nothing is implemented: no steering, no queuing, no parallel
replies, no cancellation redesign, and no provider behavior exist in
this remediation. This entry is a future design input only; it invents
no requirement claims beyond the direction recorded here.

## D-Q4-CLOSE-1 — Phase Q4 formal closure (documentation-only; reconciles implementation, audit, owner decision, remediation, evidence erratum, and fresh re-verification)

Phase Q4 is FORMALLY CLOSED (2026-09-17) as
`QUELLIGHT STAGE 07C PHASE Q4 VERIFIED WITH NON-BLOCKING ISSUES —
FORMALLY CLOSED`. The reconciled chain: the Q4 contract freeze `b4bf759…`
(alone); the implementation through `bf7fec3…` (recorded `6a7f089…`,
audited tree `c4896bef…`); the independent verification (audit commit
`821d4f8…`, verdict `VERIFIED WITH ONE HIGH FINDING`, H-1 blocking);
the owner decision D-Q4-H1-1; the H-1 remediation (contract `2b519d2…`
committed alone, executable `e9ac36a…`, permanent tests `a49be65…`,
recorded `163086c…` with the disclosed evidence erratum `6fd1ba8…`
correcting the malformed start SHA to `821d4f8…` and the truthful
205/14 node-test count); and the fresh independent re-verification
(`e0e0f19…`, verdict `VERIFIED WITH NON-BLOCKING ISSUES — Q4 FORMAL
CLOSURE PERMITTED`; 0 Blocking · 0 High · 0 Medium · 2 Low ·
2 Observations): the original crossover independently reproduced on
`c4896bef…` and proven dead on the remediated tree; race-safe admission
with deep zero effect for refused requests over the REAL turns ingress;
VICT idempotency preserved exactly; the complete seam-state matrix
failing closed; restart fencing (`VICT_CONTROL_TURN_INVALID_TRANSITION`)
and failure truth; the quiet truthful refusal UX. Carried through
closure with dispositions: **L-R1** (per-conversation critical-section
settled-entry retention — one settled promise per distinct conversation
id, ≈102 B/entry, tail replaced per request, unbounded only in the
lifetime conversation-count axis of one process; revisit trigger: any
future multi-tenant or long-lived-server deployment shape) and **L-R2**
(the now unreachable `no-open-turn` pass-reason union member; cosmetic).
Still carried unchanged: **L-3** (correction-kind proposal confirmation
rollback; Q5/backlog only), **M-1** (truthful VICT effect-class
correction + Quellight repin; hard deadline before the Phase Q6
live-provider proof and the Stage 07C final audit), the
pending-correction fixture limitation, the Q3 correction-proposal
deferral, and O-1/O-2/O-3. Future turn steering remains RECORDED —
NOT IMPLEMENTED (D-FUTURE-STEERING-1). **Phase Q5 contract and
implementation planning is PERMITTED — NOT BEGUN**; Stage 07 remains
In Progress. Closure record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-FORMAL-CLOSURE.md`;
re-verification record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-INDEPENDENT-RE-VERIFICATION.md`.
Documentation-only closure: no source, test, script, migration, frozen
contract, implementation/remediation report, or independent audit
report changed; VICT treated read-only (its System Reference
registration is VICT's own documentation-only record).

## D-Q5-1 — Phase Q5 owner decision Q5-OD-1: one global, durable Memory Mode (ratified; implemented)

The owner approved, and Phase Q5 implements, EXACTLY one global durable
Memory Mode with three user-facing choices and stable identities:
`Across conversations` (default; identity `across-conversations`; Q4
behavior preserved byte-for-byte), `Within each conversation only`
(identity `per-conversation`; only the current conversation's memory is
used; global/threadless and other-conversation records are excluded with
truthful bounded `scope-excluded` evidence), and `Memory off` (identity
`off`; zero injection, truthfully evidenced — never misreportable as
"no memory existed"). Binding control properties: the control lives only
inside the user-opened Memory surface; clearly says it applies to all
conversations; persists across restart; is changed through one declared,
user-attributed, idempotent governed mutation (`act.setMemoryMode`);
never appears as a per-message prompt; never opens automatically; affects
the next not-yet-started turn; never changes a turn already admitted or
an in-flight frozen snapshot; cannot be supplied or overridden by the
browser's turn request, the model, or the agent. The approved binding
design: the effective mode is resolved from the durable policy INSIDE
the per-conversation admission critical section, carried immutably in
the turn assembly scope, and durably recorded as immutable per-turn
evidence (migration 4, `qlt_turn_memory_policy`) at first assembly — a
historical Used-for-reply view reads the evidence, never the current
setting. The frozen Q4 fingerprint algorithm is not modified to encode
the mode; bounded immutable policy evidence is added through migration 4.
Future project-scoped conversations are PREPARED, not implemented: the
resolver is the single extension seam; no projectId fields, project
tables, selectors, UI, fake records, precedence rules, client-supplied
scope identities, or speculative policy platforms exist.

## D-Q5-2 — Phase Q5 disposition: implemented, awaiting independent verification (documentation-only)

Phase Q5 is IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (2026-09-20;
implementation report
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-MEMORY-INSPECTION-IMPLEMENTATION.md`;
freeze `e2d8436…`; executable verification SHA `a2d1f27…`). Delivered:
the four-area quiet Memory surface (Pending / Current / History / Used
for reply), read-only `qlt.inspection@1` inspection, the lifecycle
controls in the UI (Correct, Retire claim, Release commitment,
Resolve/Abandon/Transform), the durable global Memory Mode (D-Q5-1),
additive migration 4, the narrow L-3 repair (correction-kind proposal
confirmation rollback — repaired without authority expansion; the
capability still rejects `proposalKind: 'correction'`), and the
permanent zero-warning development-start gate (the three D-11 deferred
Svelte warnings repaired; `verify:dev-start` fails on every project
warning). The action inventory is 21 (19 frozen + `act.queryInspection`

- `act.setMemoryMode`). The agent envelope remains EXACTLY
  `qlt.proposal.draft@1`. The authoritative ladder passed in full on the
  untouched tree; one initial `npm ci` attempt was interrupted by an
  environmental file lock and the subsequent complete frozen-tree
  sequence passed (see D-Q5-3 and the isolation-remediation report).
  Carried unchanged: M-1 (open; hard deadline before
  the Phase Q6 live-provider proof and the Stage 07C final audit), L-R1/
  L-R2, the pending-correction fixture limitation, the Q3 §12 deferral,
  and D-FUTURE-STEERING-1. Q5 is NOT Verified and NOT formally closed;
  Phases Q6–Q7 have not begun; Stage 07 remains In Progress. This entry is
  documentation-only.

## D-Q5-3 — Phase Q5 remediation decision: verification gates must never touch operator data (technical decision, implemented)

Post-Q5 remediation decision (2026-09-20; report
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-VERIFICATION-ISOLATION-REMEDIATION.md`):
verification and test gates must never start the application against the
default operator data location. The D-11 development-start gate had done
so indirectly — its `GET /` composed the application through the default
operator data directory, applying Q5's additive migration-4 schema to
the real operator database during the Q5 ladder (both new tables empty;
existing rows reported intact; no content damage indicated; the Q5
implementation report's "no test/script read or write" wording was too
broad and is corrected additively in the remediation report — the
historical reports are preserved byte-for-byte). Implemented: the typed
`QUELLIGHT_DATA_DIR_ABSOLUTE` seam in `resolveQuellightEnvironment`
(fail-closed: absolute, never combined with the relative form, never at
or inside the default operator data directory or the repository; ordinary
startup unchanged) and a fully isolated `verify:dev-start` (task-owned
`mkdtempSync` OS-temporary data directory; explicit child environment;
fail-closed path assessment regression-checked in-process; post-teardown
read-only store proof of migrations 1..4 in the task-owned directory; a
permanent spawned guard control that must be refused; port-release
re-proof; verified `finally` cleanup on success and failure). The ladder
wording is also corrected: one `npm ci` attempt was interrupted by an
environmental file lock and the subsequent complete frozen-tree sequence
passed — no unqualified "first-run" claim is retained. Data safety: the
real operator database was not accessed during the remediation. Q5
status is unchanged: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION;
Phases Q6–Q7 have not begun. This entry is documentation-only.

## D-Q5-4 — Phase Q5 disposition after the independent audit: B-1/H-1 remediated, awaiting fresh independent re-verification (documentation-only)

The Phase Q5 independent audit (2026-09-20,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-INDEPENDENT-VERIFICATION.md`)
returned NOT VERIFIED with Blocking B-1 (inspection `getPolicy` durably
seeded the default policy row on a freshly migrated store — a read with
a durable effect), High H-1 (terminal proposals rendered in the Current
bucket, inflating its total), and Medium Q5-M-1 (the read-purity and
bucket-composition coverage was vacuous). Executable remediation was
performed exactly per the frozen remediation contract
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-CONTRACT.md`
(contract committed ALONE as `c873692…`; implementation `53831fd…`;
tests `e56952d…`; record
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md`):
read-side policy resolution is durable-effect-free (pure
`peekCurrent`/`peekPolicyRow` peeks; write-path-only `ensureCurrent`;
the read-sounding writers removed), the implicit default is represented
truthfully (nullable `updatedAtMs`, explicit `persisted` signal), the
inspection buckets branch explicitly with no fallback (Pending = only
pending proposals; Current = only canonical current-effective records,
never any proposal status; History = terminal proposals plus
non-current records), and the vacuous controls were replaced by
permanent non-vacuous coverage (real-boundary read-purity and
bucket-composition suites, `verify:q5` at 86 checks, and the extended
browser ceremony after-confirm assertion). Both defects were reproduced
at the audited SHA `d61532d…` in disposable worktrees with disposable
OS-temp stores and shown absent on the remediated tree; the new
permanent tests fail against the audited SHA (12 discriminating
failures); the real operator data was never accessed. Distinction: this
Q5-M-1 is a Q5 verification-coverage finding and is DISTINCT from the
carried VICT **M-1** effect-class finding, which remains OPEN and
unchanged with its hard deadline before the Phase Q6 live-provider
proof. Q5 remains NOT Verified and NOT formally closed — it is exactly
IMPLEMENTED — AWAITING REMEDIATION / RE-VERIFICATION. Phases Q6–Q7 have
not begun. Wording precision (post-remediation evidence normalization,
documentation-only): in this entry, the statement that the real
operator data was never accessed means precisely — the operator
database content was never opened, queried, copied, migrated, altered,
or deleted; filesystem metadata was observed only to confirm that the
path remained unchanged. This entry is documentation-only.

## D-Q5-5 — Phase Q5 disposition after the fresh independent re-verification: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (documentation-only)

The fresh independent re-verification (2026-09-20, commit `6cf7dcd…`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-INDEPENDENT-RE-VERIFICATION.md`)
returned `VERIFIED WITH NON-BLOCKING ISSUES — Q5 FORMAL CLOSURE
PERMITTED` (0 Blocking · 0 High · 0 Medium · 2 Low carried · 0 new
findings): both original audit defects were independently reproduced at
the audited SHA `d61532d…` with independently authored probes and proven
absent on the remediated tree; Q5-B-1 (read purity), Q5-H-1 (Current-
bucket truthfulness), and Q5-M-1 (non-vacuous permanent coverage) are
each independently closed; the permanent suites fail 12/31 against the
audited SHA for genuine behavioral reasons and pass 31/31 on the
remediated tree; `verify:q5` reports 86 checks; the authoritative ladder
(`npm ci`; `verify:consumer`; `verify:quellight`; `npm audit --omit=dev`;
`git diff --check`) ran exactly once, green, with the browser ceremony
passing on its first and only run after full process/port/environment
preflight; the real operator data was never opened, queried, hashed,
copied, migrated, altered, or deleted (filesystem metadata was not
inspected); VICT was read-only. Phase Q5 is FORMALLY CLOSED
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-FORMAL-CLOSURE.md`).
Carried through closure unchanged: L-1 (unreachable `unrecorded` usage
state), L-2 (`listTurns` metrics outside Details), L-R1 (admission
critical-section map memory profile), L-R2 (unreachable `no-open-turn`
union member), the pending-correction fixture limits, the Q3 §12
correction-proposal deferral, D-FUTURE-STEERING-1 (future steering NOT
IMPLEMENTED), and **VICT-M-1** (truthful VICT effect-class correction +
Quellight repin — OPEN with its hard deadline BEFORE the Phase Q6
live-provider proof and the Stage 07C final audit). Future project-
scoped conversations remain PREPARED FOR — NOT IMPLEMENTED. Phase Q6
contract and implementation planning is PERMITTED — NOT BEGUN (VICT-M-1
must be resolved before the Q6 live-provider proof). Phases Q7, 07D,
and 07E have not begun. This entry is documentation-only.

## D-Q-M1-1 — VICT-M-1 remediation implemented on the adopted verification candidate (binding integration decision; AWAITING INDEPENDENT VERIFICATION)

- **Decision**: Quellight adopts `@victframework/*@0.3.0-rc.1`
  (`vict-release-set@1/0.3.0-rc.1`, content ID
  `v1_9117e0cbd3f3fe520238442e237889bf3b9a50916327051487b8a497551500a4`,
  published through the trusted-OIDC release workflow under the candidate
  tag `vict-0.3.0-rc`; `latest` remains `0.2.0`) and advances the pinned
  capability to `qlt.proposal.draft@2` with the TRUTHFUL effect class
  `write` (the durable, epistemically inert proposal-row creation).
  Quiet in-turn completion is preserved through the EXACT host-owned
  quiet-write approval policy (one entry, exact id+revision, policy
  identity `qlt.host-policy.quiet-write@1`) supplied only through the
  trusted composition-dependency channel — never through capability
  metadata, which cannot exempt itself; `irreversible` targets can never
  be exempted; defaults are byte-equivalent when the policy is absent.
- **Why**: resolves carried finding M-1 (the untruthful `read` class on
  an effect-ful capability, disclosed in the Q3 freeze) exactly along
  the framework path that freeze anticipated: effect truth and approval
  policy become independently represented, and every invocation durably
  records the truthful effect, the resolved approval decision, and the
  closed-code policy basis (`vict-effect-policy@1`).
- **Consequences**: the agent profile advances to revision 4; the
  model-visible tool description now truthfully says `write`; the durable
  invocation evidence gains `approvalRequired=false` +
  `approvalDisposition='host-policy-write-without-separate-approval'` on
  quiet proposal writes with zero approval rows, zero approver
  identities, and zero awaiting-approval events; the ceremony, memory
  modes, inspection, context assembly, and agent isolation are unchanged;
  no live-provider or Q6 behavior exists. Stable `0.3.0` and the Quellight
  stable repin remain post-verification decisions.
- **Verification status**: implemented and integrated at Quellight
  `0fb4050…`; the authoritative ladder (`npm ci`; `verify:consumer`;
  `verify:quellight`; `npm audit --omit=dev`; `git diff --check`) ran
  EXACTLY ONCE, first-run green. **M-1 is REMEDIATED — AWAITING
  INDEPENDENT VERIFICATION** (not verified, not closed). Q5 remains
  formally closed. Record:
  `docs/report/QUELLIGHT-STAGE-07C-M-1-REMEDIATION.md`.
- **Date**: 2026-09-21.

## D-11 — Dev-only `optimizeDeps` exclusion for the released renderer (development-tooling compatibility note — technical decision, recorded, not a product semantic decision)

- **Decision**: `vite.config.ts` now sets
  `optimizeDeps: { exclude: ['@victframework/renderer-svelte'] }`.
- **Why**: under the pinned `svelte@5.57.0`, `svelte.compileModule` cannot
  parse TypeScript, and Vite's dev-only esbuild prebundler feeds the
  released renderer's `mount.svelte.ts` to it raw — so `npm run dev`
  crashed with "Unexpected token" the moment a browser opened the app.
  Excluding the renderer routes it through the normal dev transform
  pipeline (esbuild TS strip → svelte module compile). This is the exact
  setting the Stage 07B browser-stop-check generated and real-browser
  verified (REMEDIATION-01 incident #2; INDEPENDENT-REVERIFICATION
  "Dev-config inspection"); this entry applies it durably to the
  repository config, which Stage 07B deliberately left untouched.
- **Provenance / clarification**: the "xport interface" in the crash log
  is a rendering artifact (off-by-one in vite-plugin-svelte's
  `lineFromFrame` esbuild-error frame extraction), NOT file corruption —
  reproduced byte-identical on a pristine `npm ci` install whose
  `mount.svelte.ts` matches the published `@victframework/renderer-svelte`
  0.2.0 tarball. Production build (N-17 evidence path) is unaffected;
  `optimizeDeps` is dev-only. D-3 immutable consumption unchanged.
- **Consequences**: dev server starts cleanly; one cosmetic dev-only
  sourcemap notice for `application/dist/renderer.js` appears in this
  loading mode. The three pre-existing Svelte warnings in
  `ConversationWorkspace.svelte` (two a11y, one `non_reactive_update`)
  are separate, non-fatal, and remain open follow-up items.
- **Environment restoration (2026-09-18)**: during this investigation
  the repository's `node_modules/.bin` directory was found missing.
  Its cause is UNKNOWN and is not attributed to any agent or process.
  A clean `npm ci` restored the full dependency installation WITHOUT
  changing `package-lock.json` (byte-identical before and after), and
  the pristine install's renderer source was then verified to match
  the published `@victframework/renderer-svelte@0.2.0` tarball (the
  provenance evidence above).
- **Deferred warnings (Q5 UI lane)**: the three pre-existing Svelte
  warnings in `src/lib/islands/ConversationWorkspace.svelte` are
  DEFERRED to the Phase Q5 UI lane (which already plans to touch the
  memory-inspection UI) and are NOT repaired by this dev-only change:
  (1) redundant `role="region"`; (2) keyboard listener on a
  non-interactive `<section>`; (3) `chipButton` updated without
  `$state`. They are non-fatal, do not reopen Q4, and the existing
  real-browser proof shows focus return currently works.
  `verify:dev-start` treats them as a closed allowlist with exact
  expected counts, so any new or unknown warning still fails.
- **Permanent regression gate**: `npm run verify:dev-start`
  (`scripts/verify-dev-start.mjs`, wired into `verify:quellight` as
  step 2f) starts the real dev server through the committed
  `vite.config.ts` and requires HTTP 200 plus a clean transform of the
  released renderer (`mount.svelte.ts`), failing on the recorded
  optimizer signatures — so the ordinary `npm run dev` path cannot
  silently regress again.
- **Date**: 2026-09-18 (decision executed by co-founder agent; no owner
  input required — no binding principle touched, trade-off already
  charted and browser-verified by Stage 07B).

## D-Q-M1-2 — VICT-M-1 formally closed; Quellight exact-pinned to the stable vict-release-set@1/0.3.0 (closure decision)

- **Decision**: upon the fresh independent re-verification of VICT-M-1
  (`VERDICT: CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`,
  `0 Blocking · 0 High · 0 Medium · 2 Low · 3 Observations` —
  `docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md` on the VICT side,
  committed at `4912d24…`), VICT published the STABLE coordinated set
  `vict-release-set@1/0.3.0` (contentId
  `v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580`)
  from release source `c7a413a…` through the unchanged trusted-OIDC
  workflow (run `35564490763`, attempt 1, terminal-`success`; zero npm
  tokens/logins/OTPs/local publishes), and Quellight repinned EXACTLY to
  it (`1c7d3e6…`).
- **Scope of the Quellight change**: MECHANICAL ONLY — every
  `@victframework/*` dependency `0.3.0-rc.1` → exact `0.3.0` (lockfile
  regenerated through real public-registry installation; 11/11 entries
  at `0.3.0`); the release-set gate constants updated to the stable
  identity; stale invariant/doc text corrected (audit L-1/L-2; the
  historically-framed Q4 deferral docblock preserved). NO product or Q6
  behavior change; `qlt.proposal.draft@2` (`write`),
  `qlt.host-policy.quiet-write@1`, the proposal-only agent envelope,
  and every Q2–Q5 closure remain unchanged.
- **Verification**: the stable-pinned authoritative ladder ran EXACTLY
  ONCE on the pushed tree (`npm ci`; `verify:consumer` incl. N-2
  negative control; `verify:quellight` incl. the real offline
  conversation/ceremony path, the M-1 truthful-evidence suite,
  dev-start zero-warning gate, real-browser checks, artifact scan;
  `npm audit --omit=dev` clean; `git diff --check`) — first-run green.
- **Standing**: **VICT-M-1: INDEPENDENTLY VERIFIED AND FORMALLY
  CLOSED.** The candidate `0.3.0-rc.1` and its recovered evidence chain
  (original run `35530894104` truthfully terminal-`failure`; successor
  evidence run `35558851493` terminal-`success`) remain immutable
  historical record. **Q5 REMAINS VERIFIED WITH NON-BLOCKING ISSUES —
  FORMALLY CLOSED.** **PHASE Q6 CONTRACT AND IMPLEMENTATION PLANNING IS
  PERMITTED — NOT BEGUN.** Stage 07 remains In Progress.
- **Date**: 2026-09-21. Quellight record:
  `docs/report/QUELLIGHT-STAGE-07C-M-1-STABLE-REPIN.md`.

## D-Q6-1 — Phase Q6 disposition: deterministic final verification implemented; the live ceremony proof BLOCKED (documentation-only)

- **Contract**: Phase Q6 was contract-frozen ALONE before any executable
  change (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md`,
  freeze commit `ca82892…`; frozen declarative module
  `src/lib/sharedworld/q6-contract.ts`). ZERO amendments were needed.
- **What Q6 is**: verification hardening only — the deterministic final
  verification of the already-implemented Shared World system plus the
  ONE bounded live-provider ceremony proof (N-C24). No new capability,
  action, migration, or agent authority exists (the envelope stays
  exactly `qlt.proposal.draft@2/write` with the one-entry
  `qlt.host-policy.quiet-write@1` policy; the plan stays at 21 actions;
  migration bookkeeping stays `[1,2,3,4]`).
- **Delivered** (commits `cd70bc8…`, `d25d9c3…`; record
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md`): the
  focused permanent gate `verify:q6` (89 checks), the Stage 07C
  aggregate gate `verify:stage7c` (N-C25: the N-C1..N-C25 coverage
  manifest with absent-constituent and missing-row negative controls,
  the lockfile re-derivation of the exact stable release identity, and
  the focused Q2–Q5+Q6 gates — never the large suites twice, never the
  live gate), the bounded live harness `verify:q6:live` (double-gated,
  never automatic, credential presence-only, leak scans, verified
  cleanup), the hostile-memory authority/injection suites, the
  fresh-thread C1/restart/conflict suites over the real composition and
  the real released `app.data.mutate` boundary, and the Q6
  fresh-conversation continuity scenario in the EXISTING real-browser
  ceremony session.
- **Verification**: the authoritative offline ladder (`npm ci`;
  `verify:consumer`; `verify:quellight` incl. the extended browser
  ceremony; `verify:stage7c`; `npm audit --omit=dev` — 0
  vulnerabilities; `git diff --check`) ran exactly once, first-run
  green, on the untouched tree `d25d9c3…`.
- **Status**: Q6 is `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION`
  — NOT independently verified and NOT formally closed. **The live
  ceremony proof (N-C24) has NOT executed**: the operator credential
  `OLLAMA_API_KEY` is absent from the implementation environment; the
  double gate refused truthfully (real exit 2, nothing composed, no
  provider call). Per the frozen contract the blocked state is reported
  truthfully, the completion marker is not used, and **Phase Q7 remains
  BLOCKED — NOT BEGUN** until the ONE owner-invoked live execution has
  run and passed. The frozen live plan (3 provider turns: statement →
  proposal; fresh conversation; conflicting statement — plus the
  governed confirmation, replay, stale-version control, restart, and
  leak scans) stands ready within the frozen bounds.
- **Data safety**: VICT stayed read-only (its `.pi/` material untouched);
  the operator `.quellight-data` directory was never opened, read,
  migrated, hashed, or modified (fail-closed seam negative controls;
  file mtimes unchanged, metadata-only observation); all task stores
  were disposable OS-temporary directories and were removed after the
  ladder.
- **Date**: 2026-09-22. This entry is documentation-only (no new
  architectural decision; the phase followed the frozen contract and the
  ratified OQ6 authority model without owner-level amendment).

## D-Q6-2 — Q6 live-proof data-isolation remediation (implementation-conformance correction; contract unchanged)

- **Defect**: the bounded live harness (`verify:q6:live`, N-C24)
  allocated one temporary directory for ownership (leak scan, cleanup)
  but let `composeLive(reuseDataDir)` silently compose against a SECOND
  temporary directory; an assigned-but-unused `restartDataDir` masked
  the mismatch. Had the credential-backed proof run, the restart would
  have recomposed against the WRONG store, the actual store could have
  escaped credential scanning, and it could have survived cleanup. No
  live execution ever occurred (the credential was absent), so no
  evidence was produced from a wrong store and the frozen
  one-execution allowance remains unused.
- **Correction** (commit `c0e5a93…`; record
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-DATA-ISOLATION-REMEDIATION.md`):
  the script-only helper `scripts/lib/q6-live-workspace.mjs` allocates
  EXACTLY ONE disposable root; every composition receives that exact
  resolved path explicitly (`composeLive(ownedDataDir)`, no boolean
  flag) and its resolved `dataDir` is asserted against the root BEFORE
  any provider turn (fail closed; a mismatching foreign directory is
  closed and removed before the failure); repository paths and
  `.quellight-data` are refused by name/segment; credential scans cover
  every nested byte of the root; verified cleanup removes the complete
  root on success and every failure path, and removal failure FAILS the
  proof (never a note). The frozen Q6 contract, its bounds, the
  provider identity, the ceremony behavior, the authority assertions,
  the zero-retry rule, and output redaction are unchanged.
- **Regression proof**: a non-vacuous offline negative control against
  the starting SHA `6cdbf075…` (disposable worktree; no provider, no
  credential) demonstrated all four old-flow consequences; 11 permanent
  offline lifecycle suites and a 6-check `live-workspace` section in
  `verify:q6` (including behavioral execution of those suites) pin the
  single-root discipline. Bounded FastGate set green: format:check,
  typecheck, lifecycle suites, verify:q6 (95 checks), verify:stage7c,
  git diff --check. Package and lock files byte-unchanged; VICT
  identity `vict-release-set@1/0.3.0` re-derived unchanged; no product
  source or durable schema changed.
- **Status**: Q6 remains
  `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION` with the live
  proof NOT executed. **The authoritative live-provider execution count
  remains ZERO** (no credential was present or accessed at any point).
  **Phase Q7 remains BLOCKED — NOT BEGUN.**
- **Date**: 2026-09-22. Documentation-only decision entry (the
  remediation enforces the frozen contract's own requirements).

## D-Q6-3 — Q6 live-harness safety hardening: unowned paths never deleted; incomplete scans fail closed (implementation-conformance correction; contract unchanged)

- **S-1 (deletion of an unowned path)**: the live harness's
  composition-directory-mismatch handler recursively deleted the
  REJECTED path (`rmSync(resolve(composition.dataDir), …)`). A path
  rejected for not being the owned workspace must never be deleted — a
  future composition defect reporting the repository, operator data, or
  an unrelated location could have destroyed unowned data. Corrected
  (commit `6a81f66…`): the harness now has NO deletion capability at all
  (`rmSync`, `node:fs`, and `path.resolve` imports removed); the only
  permitted removal target is the verified owned workspace root through
  the workspace dispose (exactly once, in the proof's finally); a
  mismatch closes the composition, records a stable NON-ECHOING failure
  (`path not echoed`), leaves the unowned path untouched, and the
  RESOLVED environment's data directory is validated against the owned
  root BEFORE composition construction (ownership chain: caller-passed
  root → dataEnv → resolved environment → composition-reported dataDir,
  asserted at every link, all before any provider turn).
- **S-2 (swallowable final scan)**: the final credential scan treated
  every exception as "nothing left to scan" and the helper treated an
  absent workspace root as an empty CLEAN scan — invalid evidence.
  Corrected: `scanForCredential` FAILS unless traversal COMPLETES
  (absent root, non-directory root, unreadable entry, traversal error),
  and the harness converts every scan exception into a proof failure
  ("an incomplete scan is never treated as credential-clean") without
  echoing the credential or file contents; cleanup still proceeds on
  the owned root only, and an unremovable root remains a proof failure.
- **Regression proof**: 10 new permanent offline safety suites
  (`test/q6-live-workspace-safety.test.ts`) + the 11 lifecycle suites —
  rejected foreign/repository/operator-named paths with sentinels are
  provably untouched; no `rmSync`/`node:fs` in the harness; exactly one
  owned dispose (sibling sentinels survive); absent-root and incomplete
  scans fail; cleanup proceeds after scan failure; completed traversals
  still detect nested canaries; the same-root initial/restart path stays
  green. `verify:q6` grew to 100 checks (11 live-workspace) with both
  behavioral suites wired in — S-1 and S-2 cannot regress unnoticed.
- **Scope preserved**: no product source or durable schema change; no
  package/lockfile change; provider identity, turn/token/deadline
  bounds, ceremony behavior, authority rules, the frozen Q6 contract,
  and all historical reports unchanged. Bounded FastGate set green:
  format:check, typecheck, 21 suites, verify:q6 (100 checks),
  verify:stage7c, git diff --check.
- **Status**: Q6 remains
  `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION` with the live
  proof NOT executed. `OLLAMA_API_KEY` was neither present nor accessed.
  **The authoritative live-provider execution count remains ZERO.**
  **Phase Q7 remains BLOCKED — NOT BEGUN.**
- **Date**: 2026-09-22. Documentation-only decision entry.

## D-Q6-4 — Phase Q6 live ceremony proof executed once and FAILED: provider credential rejected; fresh owner decision required before any further live execution (documentation-only)

- **What happened**: the ONE owner-authorized bounded live-provider
  ceremony proof (N-C24, `npm run verify:q6:live` with
  `QUELLIGHT_LIVE_PROOF=1` for the proof process only) was executed on
  2026-09-21 at tree `8d1273bf51b1bfd2921cd51d0e9bdf1135ad9556`
  (`HEAD == origin/main`, clean tree; the harness and workspace-helper
  bytes matched the pushed safety-hardened tree exactly; VICT read-only
  at `15338487…`). It **FAILED truthfully at its first provider turn
  (t1)**: the frozen provider endpoint returned an HTTP 401
  (authentication failure) response class, rejecting the configured
  credential. The true process exit was **1** (captured directly, no
  masking). Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`.
- **Turn accounting**: 1 provider turn used of the allowed 6 (planned
  3); t1 settled `failed` (`VICT_AGENT_TURN_FAILED`) in 1,020 ms; the
  same-key t1 retry replayed the idempotent receipt with no second
  provider turn; t2/t3 were never reached; zero retries were dispatched
  and no fallback, model, prompt, timeout, or bound change occurred.
- **Consequences within the frozen bounds**: ZERO durable Shared World
  state was created (no proposal, no canonical record, no
  confirmation); no model response exercised user authority; both
  byte-level credential leak scans completed and found zero occurrences
  (presence-only credential discipline held end to end — the value was
  never printed, hashed, serialized, or persisted).
- **Cleanup**: the harness's fail-closed dispose could not remove the
  owned OS-temp root under Windows (reported as a proof failure, never
  a note); safe manual cleanup afterward removed exactly that one
  task-owned `qlt-q6-live-*` directory (verified) plus the temporary
  launcher; no `qlt-*` directory, process, listener, or task file
  remains; the operator `.quellight-data` directory was never accessed
  (file mtime unchanged; metadata-only observation); the repository
  tree is byte-clean.
- **Execution accounting**: the authoritative live-provider execution
  count is now **exactly ONE, and that execution FAILED**. The run was
  NOT rerun (freeze §3: never silently re-run). **The one-execution
  allowance of that authorization is CONSUMED; any further live
  execution requires a fresh dated owner decision** (for example after
  the operator refreshes or corrects their Ollama Cloud credential in
  their own environment).
- **Scope preserved**: no source, test, script, package, lockfile,
  schema, or frozen-contract change before, during, or after the
  execution; VICT read-only and untouched; no provider connectivity
  probe, no Stage 07B live verifier, no second model/provider check.
  The offline Q6 evidence (verify:q6, verify:stage7c, the 21
  lifecycle/safety suites, the authoritative ladder) is unchanged and
  remains green; only the live evidence item is outstanding.
- **Status**: Q6 is `IMPLEMENTED — AWAITING INDEPENDENT Q7
VERIFICATION` with the live proof EXECUTED ONCE and FAILED. Q6 is NOT
  independently verified and NOT formally closed. **Phase Q7 remains
  BLOCKED — NOT BEGUN. Stage 07 remains In Progress.**
- **Date**: 2026-09-21. Documentation-only decision entry.

## D-Q6-5 — Phase Q6 live proof: Execution-1 root cause confirmed (operator credential-environment wiring, credential VALID); fresh owner-authorized Execution 2 FAILED on the missing-proposal class; further execution requires a new owner decision (documentation-only)

- **Execution-1 root cause (read-only diagnosis, no ceremony
  invocation)**: the operator's agent-configuration file held the
  literal string `$OLLAMA_API_KEY` (an environment-variable REFERENCE)
  as the ollama provider's API key; the Execution-1 launcher passed it
  verbatim, so the proof sent a meaningless bearer value and received
  the HTTP 401. The operator's REAL working Ollama Cloud key lives in
  their agent's own credential store (`~/.pi/agent/auth.json`,
  resolved internally by the agent — which is why the model works
  inside the agent). A presence-verified direct probe with the real
  key returned HTTP 200 for both the models list and a minimal chat
  completion with the frozen model: **the credential, endpoint, and
  model are all VALID and working**. Execution 1 was therefore an
  operator-environment wiring failure — no harness, contract, or
  provider defect.
- **Execution 2 (fresh dated owner authorization, 2026-09-21 — the
  owner directed use of the store credential)**: executed ONCE at tree
  `a32bba5468c2f7fe8d1b805deef8803d2fcd0cad` (`HEAD == origin/main`,
  clean; docs-only delta from `8d1273b…`; zero executable change).
  Gate passed; composition LIVE (`ollama-cloud/glm-5.3-flash` at
  `https://ollama.com/v1`); **t1 provider turn status=completed in
  5,925 ms** (within every frozen bound) — but the model did NOT
  exercise the single draft capability: zero durable invocation
  records, zero proposals. The harness failed truthfully at the t1
  boundary (the frozen missing-proposal failure class); true exit 1;
  1 of 6 provider turns used; zero retries; no fallback; zero durable
  Shared World effects; no authority exercised; both byte-level
  credential leak scans clean; the recurring fail-closed Windows
  cleanup finding (owned temp root unremovable by dispose) recurred and
  was remediated by verified safe manual cleanup; the operator
  `.quellight-data` directory was never accessed (mtime unchanged);
  repository tree byte-clean throughout.
- **Observation (not a gate; freeze §15)**: the frozen contract makes
  the capability invocation structural while acknowledging model
  wording is nondeterministic. Whether the frozen 256-token per-turn
  output cap interacting with this model's reasoning behavior, or
  provider-side tool-calling reliability, contributed to the missed
  capability invocation is an open observation. Diagnosing or changing
  bounds/model/prompts requires the freeze §13 amendment procedure —
  an owner decision, never an improvised fix.
- **Execution accounting**: total live-provider executions = TWO
  (Execution 1: failed 401 — credential wiring; Execution 2: failed
  missing proposal — credential proven valid). Each ran under its own
  explicit owner authorization; NEITHER was retried; no silent rerun
  exists. **Any further live execution requires a fresh dated owner
  decision** (and, where frozen contract text is affected, the §13
  amendment procedure).
- **Status**: Q6 is `IMPLEMENTED — AWAITING INDEPENDENT Q7
VERIFICATION` with the live proof EXECUTED TWICE, BOTH FAILED. Q6 is
  NOT independently verified and NOT formally closed. **Phase Q7
  remains BLOCKED — NOT BEGUN. Stage 07 remains In Progress.**
- **Date**: 2026-09-21. Documentation-only decision entry. Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`.

## D-Q6-6 — Bounded memory discretion amendment: rule-guided memory proposal discretion adopted; instructions revision 4, profile revision 5; five-turn live matrix and parent/worker lifecycle prepared; Execution 3 NOT executed (owner-approved policy; binding behavior decision)

- **Why**: the revision-3 instruction "use it sparingly" was one-sided —
  it restrained over-drafting but gave NO rule for when drafting is
  appropriate, so Execution 2 of the live proof (a successful provider
  turn with zero capability invocations) demonstrated that drafting on
  genuinely durable meaning was unconstrained coin-flipping. A bounded
  live proof cannot rest on unspecified behavior. Owner-approved
  correction: discretion is RULE-GUIDED, not arbitrary.
- **The policy (amendment §3)**: (1) explicit remember requests draft
  one reviewable pending proposal; (2) implicit durable meaning (clear
  durable preference, commitment, ongoing goal, identity-relevant fact,
  unresolved issue likely to matter later) is drafted even unasked;
  (3) temporary logistics, one-off incidents, software trouble,
  momentary feelings, speculative causal interpretations, and ordinary
  conversational detail never become proposals merely by being
  mentioned; (4) mixed messages yield only the durable core; (5)
  uncertainty stays uncertain — hardship is never converted into a
  factual claim that the user should leave a job; (6) at most two
  proposals per turn, one per durable semantic item; (7) drafting stays
  quiet and epistemically inert — the reply continues naturally and
  never claims a save; (8) only the user's governed confirmation
  creates canonical Shared World meaning. The capability envelope is
  unchanged: exactly `qlt.proposal.draft@2/write` under
  `qlt.host-policy.quiet-write@1`, `maxToolCalls: 2`.
- **Identity**: conversation instructions `quellight.conversation-
instructions` revision 3 → 4; agent profile
  `agent.quellight.conversation` revision 4 → 5. Preserved: model,
  provider, capability, authority, memory policy, 21-action inventory,
  host quiet-write policy. Added: NOTHING (no capability, query,
  mutation, schema, migration, or autonomous behavior).
- **Live-proof changes (prepared only)**: the single implicit-positive
  proof is REPLACED by a five-turn matrix (explicit positive control;
  naturalistic discretionary positive driven by the operator's EXTERNAL
  private fixture `QUELLIGHT_Q6_NATURAL_FIXTURE_FILE` — absolute,
  outside the repository and `.quellight-data`, <= 12,288 UTF-8 bytes,
  no NUL bytes, never committed, echoed, or reported; only byte length
  - SHA-256 enter evidence; discretionary negative control; the
    governed user ceremony with replay and stale-version proofs; a
    close/restart on the same verified root; fresh-thread C1 continuity;
    a hypothetical-conflict negative control). ONLY the Q6 live output
    ceiling was raised: 256 → 512 tokens/turn. Six turns, 120 s/turn,
    zero retries, one provider, one model, no fallback, and the
    one-execution-per-authorization discipline are retained.
- **Parent/worker lifecycle**: the live harness is split so the
  composition-owning process no longer removes its own SQLite
  workspace (the cause of both prior Windows cleanup failures): the
  worker runs every composition and exits; the parent then scans for
  the credential, re-verifies the external fixture's byte identity, and
  disposes the ONE owned root. Cleanup failure remains proof failure;
  the worker has no deletion capability; all S-1/S-2 protections are
  preserved and re-proven.
- **Verification**: three new permanent suites (16 + 12 + 10 tests)
  plus the updated lifecycle (11) and safety (10) suites, all offline
  with deterministic fake models and a SYNTHETIC non-personal fixture;
  `verify:q6` grew to 107 checks; the authoritative ladder (npm ci,
  verify:consumer, verify:quellight, verify:stage7c, npm audit
  --omit=dev, git diff --check) ran green on the committed tree
  `67d5223…`. The offline suites prove the predicates and the wiring,
  NOT real-model discretion — only Execution 3 can.
- **Status**: Execution 3 is `PREPARED — NOT EXECUTED`; it remains
  unconsumed and requires a separate owner invocation after review. Q6
  is `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION`; NOT
  independently verified; NOT formally closed. **Phase Q7 remains
  BLOCKED — NOT BEGUN. Stage 07 remains In Progress.**
- **Date**: 2026-09-21. Amendment commit `365259f…`; implementation
  commits `d11d9e9…`, `6844bfe…`, `67d5223…`. Records:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-BOUNDED-DISCRETION-AMENDMENT.md`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-PREPARATION.md`.

## D-Q6-7 — Q6 live proof Execution 3: prepared bounded-discretion matrix executed exactly once and FAILED truthfully; no fourth execution authorized (owner-authorized execution; truthful-result decision)

- **What ran**: the one owner-authorized live execution of the prepared
  five-turn matrix on tree `e0f2797…` (verified `HEAD == origin/main`,
  clean, linear; docs-only delta since the prepared tree `67d5223…`),
  2026-09-21, ~65 s wall clock, model `ollama-cloud/glm-5.3-flash` at
  `https://ollama.com/v1`. Credential resolved in memory from the
  owner-designated store and exposed only as `OLLAMA_API_KEY`; never
  printed, hashed, serialized, or persisted; process-scoped variables
  cleared on exit. **True exit: 1.** Invoked EXACTLY ONCE; zero
  retries; zero preliminary probes; no post-failure correction.
- **Outcome**: turn t1 (explicit positive control) COMPLETED in
  18,567 ms within every frozen bound, but the model's draft-capability
  attempts were each rejected by the host tool-input validator at the
  frozen proposal-row contract boundary (an empty-args attempt and
  single-field attempts) — **0 durable invocations, 0 proposals, 0
  canonical effects**. The matrix then CRASHED at the fresh-thread
  boundary: the prepared worker called `sharedWorld.restoreThread`,
  which the runtime binding does not expose — a harness defect
  aborting the restart, continuity, and conflict controls. 1 of 6
  turns used; one finding recorded; turns t2–t5 never reached.
- **What held**: the parent/worker lifecycle correction worked — the
  worker exited before the parent scanned and disposed; the external
  fixture survived byte-identical (3,137 bytes, SHA-256
  `9cc76c36…`) and never entered the repository; the credential scan
  completed clean (credential absent from every persisted byte); the
  owned workspace was removed and verified absent; the Windows dispose
  failure of Executions 1–2 did NOT recur; `.quellight-data` was never
  accessed (mtime unchanged); VICT untouched.
- **Structural observations (owner-decision input only; nothing
  changed in this task)**: (a) the live model cannot currently produce
  argument objects satisfying the frozen `qlt.proposal.draft@2`
  contract shape — the quiet-write policy correctly prevented any
  partial effect; (b) the prepared worker references a nonexistent
  shared-world API member. Both require owner decisions; any harness
  or bounds change follows freeze §13.
- **Status**: Q6 `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION`;
  NOT independently verified; NOT formally closed. **PHASE Q7 REMAINS
  BLOCKED — NOT BEGUN. NO FOURTH LIVE EXECUTION IS AUTHORIZED. Stage 07
  remains In Progress.**
- **Date**: 2026-09-21. Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-EXECUTION-3.md`.

## D-Q6-8 — Execution-3 remediation: corrected chronology, harness repairs, model-facing proposal presentation, and exact repin to the VICT verification candidate `0.3.1-rc.1` (implementation decision under the frozen remediation contract; no live execution authorized)

**Date:** 2026-09-22. **Governing contract (frozen, committed alone at
`ffecfd7…`):**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-REMEDIATION-CONTRACT.md`.

Adopted:

1. **Corrected Execution-3 chronology (additive):** the live matrix
   crashed at TURN-1 REPLY RETRIEVAL — `runMatrixTurn` requests the
   reply immediately after Turn 1, and the prepared worker called
   `sharedWorld.restoreThread`, which does not exist on the Shared World
   store binding — NOT at the restart/fresh-thread boundary named in the
   historical record (preserved byte-unchanged; superseded on this one
   point).
2. **H-1' repair:** reply retrieval uses `composition.restoreThread`
   (the full-composition boundary) before and after the restart.
3. **M-1 repair:** every asynchronous evidence check is awaited and
   recorded before result serialization (`QLT_Q6_EVIDENCE_CHECK_FAILED`);
   structural + behavioral gates make floating evidence calls impossible
   to reintroduce.
4. **M-2 repair:** findings are the closed non-echoing codes
   `QLT_Q6_LIVE_MATRIX_FAILED` / `QLT_Q6_REPLY_RESTORE_FAILED` /
   `QLT_Q6_EVIDENCE_CHECK_FAILED` (+ a stable phase label); arbitrary
   error-message slicing is removed.
5. **Capability presentation:** `qlt.proposal.draft` revision 2 → 3
   carries the VICT descriptive presentation (exact closed three-branch
   input schema; closed output union; bounded description); declared
   effect stays `write`; `Contract.parse` unchanged-or-stricter; profile
   revision 5 → 6; instructions stay revision 4; exactly one model
   capability; `maxToolCalls: 2`.
6. **Candidate repin:** exact `@victframework/*@0.3.1-rc.1`
   (`vict-release-set@1/0.3.1-rc.1`, content ID `v1_b6e39c1f…`),
   registry-only lockfile through the central release-set source.
7. **Offline proof:** the REAL worker orchestration runs the full
   five-turn matrix offline (mode-injected deterministic driver through
   the existing `offlineModelFactory` seam), spawning the real worker
   process and traversing the parent scan-and-cleanup phase — permanent,
   fail-closed, and non-weakening of any live acceptance rule.

NOT adopted / NOT authorized: no live-provider proof, no provider
credential access, **no Execution 4**, no Q7 work, no bound change, no
provider change, no authority widening, no action or schema change.
Q6 remains NOT independently verified and NOT formally closed; Stage 07
remains In Progress.

## D-Q6-9 — Mechanical candidate repin to the VICT verification candidate `0.3.1-rc.2` (version-only; the audit-remediation adoption; no live execution authorized)

**Date:** 2026-09-22. **Governing decision:** the VICT audit-remediation
contract (`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`,
VICT; frozen alone before executable change) implemented the four
findings of the independent `0.3.1-rc.1` verification (B-1 real
serialized UTF-8 byte bound; B-2 symbol-keyed fields rejected never
dropped; B-3 native proxy rejection before any inspection; B-4 raw
prototype-key guard before upstream normalization) and published the
coordinated candidate `vict-release-set@1/0.3.1-rc.2` (13 members,
release source `a7b0018…`, publication run `35661159776` — ALL 13
published, final same-run registry verification failed on CDN
propagation lag; read-only successor evidence run `35662077320`
terminal-`success` per the VICT rc.2 amendment).

Adopted (mechanical, version-only):

1. The ten exact `@victframework/*` pins moved `0.3.1-rc.1` →
   `0.3.1-rc.2`; the lockfile was regenerated SOLELY through the public
   registry; the central release-set identity
   (`scripts/lib/release-set.mjs`) and the derived exact-pin gates were
   updated; record:
   `docs/report/QUELLIGHT-STAGE-07C-CANDIDATE-REPIN-0.3.1-RC.2.md`.
2. NOTHING else changed: `qlt.proposal.draft@3`/`write`, profile
   revision 6, instructions revision 4, the exact host quiet-write
   policy, every ceremony/memory/authority/UI/provider/fixture/Q6
   acceptance behavior are byte-preserved. The Q6 harness remediation
   remains independently verified offline (prior record preserved).
3. The authoritative offline ladder ran ONCE on the repinned tree,
   first-run green (`npm ci`, `verify:consumer`, `verify:quellight`,
   `verify:stage7c`, `npm audit --omit=dev`, `git diff --check`);
   `verify:q6:live` NOT executed.

NOT adopted / NOT authorized: no stable repin (`0.3.1` does not exist;
`latest` remains `0.3.0`), no live-provider proof, no provider
credential access, **no Execution 4**, no Q7 work, no bound change, no
provider change, no authority widening. The `0.3.1-rc.2` candidate is a
verification candidate AWAITING FRESH INDEPENDENT RE-VERIFICATION; Q6
remains NOT formally closed; **Phase Q7 remains BLOCKED — NOT BEGUN**;
Stage 07 remains In Progress.

## D-Q6-10 — Mechanical stable repin to the VICT STABLE release `0.3.1` (version-only; no live execution authorized)

**Date:** 2026-09-22. **Trigger:** the fresh independent re-verification
of the VICT audit-remediation candidate `0.3.1-rc.2` returned ZERO
Blocking/High/Medium findings, so the owner-authorized conditional
stable release proceeded: all 13 `@victframework/*` packages published
at `0.3.1` under `latest` through the frozen trusted-OIDC workflow
(publication run `35688234026`, source
`446453fc4f6837e50a0bf3254b47d6a208f5b491`; the same-run registry
verification failed on CDN propagation lag — terminal-`failure`, never
relabelled — and the read-only evidence run `35689362749` under the
stable evidence-recovery amendment concluded terminal-`success`).

**Decision:** mechanically repin Quellight to the stable release:

1. the ten exact `@victframework/*` dependency pins `0.3.1-rc.2` →
   `0.3.1`;
2. the lockfile regenerated SOLELY through the public registry;
3. the central release-set identity
   (`scripts/lib/release-set.mjs`) moved to
   `vict-release-set@1/0.3.1`, content ID
   `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583`,
   `EXPECTED_VERSION = '0.3.1'`;
4. every derived verification literal updated in the SAME commit
   (`verify-stage7c`, `verify-q2`, `verify-q3`, `verify-governance`,
   `verify-dev-start`, `verify-consumer`,
   `test/governed-mutation.test.ts`) — a repo-wide sweep confirms the
   0.3.0-era recorded-literal desynchronization class did not recur.

**Verification:** the complete offline ladder on the final
stable-pinned tree — `verify:consumer` PASS, `verify:quellight` (first
run hit the known pre-existing `test:node` tmpdir-count isolation race,
diagnosed Low and disclosed; the disclosed rerun PASSed the full
offline ladder), `verify:stage7c` PASS, `npm audit --omit=dev` clean,
`git diff --check` clean. Candidate tags RETAINED:
`vict-0.3.1-rc → 0.3.1-rc.2`; 0.3.0/0.3.1-rc.1/0.3.1-rc.2 remain
immutable and installable.

**NOT adopted / NOT authorized:** no live-provider proof, no provider
credential access, **no Execution 4**, no Q7 work, no product,
Q6-harness, ceremony, memory, authority, UI, or Shared World change.
Q6 remains NOT formally closed; **Phase Q7 remains BLOCKED — NOT
BEGUN**; Stage 07 remains In Progress. Record:
`docs/report/QUELLIGHT-STAGE-07C-STABLE-REPIN-0.3.1.md`.

## D-Q6-11 — Phase Q6 live proof Execution 4: the final authorized run executed exactly once on the remediated parent/worker harness and FAILED truthfully on the empty-reply class; no fifth execution authorized (owner-authorized execution; truthful-result decision)

**Date:** 2026-09-22. **Trigger:** the owner authorization dated
2026-09-22 permitting EXACTLY ONE live execution on the execution tree
`1fae9f3c8fe1de206ce9f58c6dc0d97512d260ec` (`HEAD == origin/main`,
clean tracked tree, exact-pinned `@victframework/*@0.3.1`, release-set
`vict-release-set@1/0.3.1` / `v1_1c695280…63c2583`), after the
Execution-3 remediation was implemented and independently verified
offline (D-Q6-8/D-Q6-9/D-Q6-10; no other tree change).

**Execution:** `QUELLIGHT_LIVE_PROOF=1 npm run verify:q6:live` invoked
EXACTLY ONCE on 2026-09-22 (launch 06:16:25.627Z → exit 06:16:56.482Z;
true process exit **1**, captured unmasked). Provider
`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`; LIVE
composition confirmed; zero retries, zero fallback, zero diagnostic
provider requests. Credential resolved in memory from the
owner-designated store and exposed to the live child only as
`OLLAMA_API_KEY`; never printed, tested, or persisted.

**Result — FAILED:** 3 of 6 ceiling turns completed (t1 6,453 ms; t2
6,489 ms; t3 7,777 ms — every frozen bound respected), but EVERY
completed reply was EMPTY: 0 durable capability invocations, 0
proposals, 0 canonical effects on all turns; the t1 same-key retry
replayed the idempotent receipt; the matrix aborted at the
governed-ceremony boundary (`QLT_Q6_LIVE_MATRIX_FAILED`, phase:
ceremony) with 10 findings. T1/T2 structural requirements NOT MET; T3's
zero-effect held trivially while its natural-flow requirement failed;
ceremony, replay, staleness, restart, fresh-thread, and conflict
controls NOT REACHED. Failure class: provider-response content
(empty completed replies) — distinct from Execution 3's tool-contract
rejection class.

**Safety (all verified):** the external fixture (3,137 bytes, SHA-256
`9cc76c36…3170da`, byte-identical to the owner-approved Execution-3
identity) survived the proof byte-identical and was deleted only after
evidence handling; the byte-level credential scan over every persisted
workspace byte COMPLETED with the credential ABSENT, and an independent
scan of all 157 tracked files found 0 credential and 0 fixture-path
occurrences; lifecycle ordering held
(workspace-allocated → fixture-validated → worker-exited → result-read
→ fixture-reverified → credential-scanned → workspace-disposed); the
owned disposable workspace was removed and verified absent; the
operator `.quellight-data` directory was never accessed (mtime
unchanged: 2026-09-20 03:43:59 +0800); VICT was never modified
(`fd0c1f7…`, pre-existing untracked `.pi/` never read); no child
process, listener, launcher, fixture, or `qlt-q6-live-*` directory
remains.

**Disposition:** Q6 is NOT independently verified and NOT formally
closed. **NO FIFTH LIVE EXECUTION IS AUTHORIZED.** **Phase Q7 remains
BLOCKED — NOT BEGUN.** Stage 07 remains In Progress. Record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-EXECUTION-4.md`.

## D-Q6-12 — Phase Q6 empty-reply boundary investigation (Execution 4 root cause): the offline boundary matrix plus ONE instrumented diagnostic provider request localized the first loss boundary to the generation step — classification B (reasoning consumed the output budget); every downstream layer exonerated; a secondary real-model tool-call rejection finding recorded (owner-decision input; no repair, no contract change, no rerun)

**Date:** 2026-09-22. **Trigger:** the owner's offline investigation order
(additively recording the consumed Execution-4 record D-Q6-11 as input) and
the owner's conditional addendum authorizing exactly ONE narrowly
instrumented diagnostic provider request if — and only if — the offline
boundary matrix could not conclusively locate the first loss boundary.

**Investigation (offline; entirely read-only/additive):** starting tip
`5e43aba7…` (`HEAD == origin/main`, clean tracked tree; VICT
`fd0c1f7…` untouched). Lane A mapped exactly what Execution 4 directly
observed (restored reply empty through `restoreThread()`; 0 invocations; 0
proposals; completed statuses) versus inferred (the raw provider response was
never captured) — recorded as the additive truthfulness correction: the
end-to-end Quellight path produced an empty restored assistant message; the
raw provider response was not captured, so its original contents remain
unknown. Lane B traced the installed pipeline exactly
(`@mastra/core@1.64.0` → bundled `@ai-sdk/openai-compatible@2.0.62` chat
parser → `ModelRouterLanguageModel` → loop/agent → VICT adapter → durable
ledger → transcript store → `restoreThread()`), including the parser's
strip-mode delta schema (`role`, `content`, `reasoning_content`, `reasoning`,
`tool_calls` only; a `thinking` field would be stripped — LATENT, not actual)
and the finish-reason/usage normalization. Lane C (12 synthetic scenarios
through the REAL router with a loopback transport and a canary; 0 network
escapes) proved every supported field translates correctly; Lane D (9 clean
passive end-to-end scenarios through the REAL composition) proved text,
tool calls, reasoning+text, and reasoning+tool-call all survive to
proposals/effects and the restored transcript; reasoning-only streams
(finish `stop` or `length`) map EXACTLY to the Execution-4 observable
(completed turn, empty restored reply, 0 invocations, 0 proposals); wrapper
variants (base / +context / +deadline / production order) preserve parts
identically.

**Diagnostic request (the ONE conditional authorization; truthful
accounting):** exactly ONE provider request was sent to
`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1` — HTTP 200, 141 SSE
events, 33,787 body bytes — carrying **`delta.reasoning` 1,885 bytes,
`delta.content` 0 bytes, one valid `qlt_proposal_draft` tool-call delta,
finish `tool_calls`, no usage chunk** — with the REAL Quellight capability
schema and ONE synthetic non-personal explicit-memory prompt. The same
response was observed at every boundary: router parts preserved everything
(reasoning ×138 → reasoning parts; tool call → tool-call part); the VICT
adapter durably recorded `tool.requested` → `tool.started` → **`tool.failed`**
(0 durable invocations — the Execution-3 contract-rejection class REPRODUCES
with real model output); the restored assistant message existed with 0 text.
The loop's automatic post-tool follow-up request was REFUSED by the
structural one-request cap before any network byte (not a retry; no provider
capacity consumed). Turn elapsed ≈6.7 s — matching Execution-4's 6.4–7.8 s.
Bounds: `max_tokens: 512`, 120 s deadline, zero retries, no fallback; the
request controls NO reasoning parameter (field set exactly `{model,
max_tokens, messages, tools, tool_choice, stream}`).

**Classification: B — reasoning consumed the available output budget** (the
model streams reasoning via `delta.reasoning` with zero visible content under
the uncontrolled 512-token `max_tokens` path; downstream preserves
everything; the restored reply is the assistant TEXT, which is empty).
Smallest recommended remediation (NOT implemented): a bounded freeze
amendment adding explicit reasoning control for the pinned model path, OR an
evidence-based token-ceiling amendment — one of the two. Secondary owner
decision: the real-model tool-call rejection class. No VICT release, Mastra
upgrade, or node_modules change is required for either.

**Safety (all verified):** the credential was read ONCE from the
owner-designated `auth.json` (`ollama` entry, `key` field only), passed in
memory only, never printed, hashed, serialized, persisted, or placed in
command arguments; the diagnostic's disposable store was byte-scanned for
the credential (7 files, 0 occurrences) and then deleted (absence verified);
all probe scripts, logs, stores, and fixtures were removed (verified
absent); `.quellight-data` never accessed (mtime unchanged); VICT never
modified; no historical report modified; no code, test, script, manifest,
lockfile, frozen contract, prompt, instruction, schema, or bound changed;
pre-existing OS-temp `qlt-q6-compose-*`/`discretion-*`/`fixture-*`/
`fresh-*`/`hostile-*`/`offline-restore-*` gate-fixture directories from
earlier runs were left untouched. Record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EMPTY-REPLY-BOUNDARY-INVESTIGATION.md`.

**Disposition:** Q6 is NOT independently verified and NOT formally closed.
**NO FIFTH LIVE EXECUTION IS AUTHORIZED.** **Phase Q7 remains BLOCKED — NOT
BEGUN.** Stage 07 remains In Progress.

## D-Q6-13 — Phase Q6 real-model tool-argument diagnostic: the one authorized provider request attempt was aborted mid-flight by a verified probe instrumentation defect; the tool-argument JSON was NOT captured; the earlier reasoning-budget conclusion is truthfully DISPOSED OF as an unevidenced hypothesis; no A–E classification is evidence-backed (owner-decision input; no repair, no contract change, no re-run)

**Date:** 2026-09-22. **Trigger:** the owner's correction of the D-Q6-12
reasoning-budget inference and the authorization of exactly ONE diagnostic
provider request to capture the real model's generated tool-argument JSON and
identify the tool-call rejection boundary.

**Request accounting (truthful):** starting tip `860f172…` (verified
`== origin/main`, clean tracked tree; VICT `fd0c1f7…` untouched). Exactly ONE
provider request attempt was initiated through the real composition (real
profile, revision-3 capability, real bridge, bounds unchanged: 512 output
tokens, 120 s deadline, zero retries, `tool_choice: auto`, NO reasoning
control field — verified in the captured request body). The tool schema
transmitted upstream was verified STRUCTURALLY EQUAL to the frozen
revision-3 presentation (1,781 bytes; the wire layer normalizes key order).
The request was aborted mid-flight (~200–300 ms into the attempt) by a PROBE
instrumentation defect — the `doStream` wrapper did not await the async
original, so the stream chain errored on first pull and the in-flight fetch
was aborted; the defect was REPRODUCED offline with zero network (first-pull
`TypeError`). No response, finish reason, reasoning/content byte counts, or
tool-argument JSON was captured; the turn failed truthfully in 425 ms
(`VICT_AGENT_TURN_FAILED`; 0 invocations, 0 proposals, no assistant message;
ledger `response.started` → `usage.updated` 0/0/0 → `response.failed`;
Mastra span `finishReason: error`, no persisted error payload). Whether
request bytes reached the provider endpoint could NOT be determined; the
one-request authorization is CONSERVATIVELY TREATED AS CONSUMED. NO second
request, retry, follow-up, model-list query, credential test, or diagnostic
chat was made or is authorized by this task.

**Corrected machinery (validated on LOOPBACK; zero real provider contact;
canary only):** the corrected `await`-ed wrapper forwards the complete router
part chain (stream-start → response-metadata → reasoning ×4 → tool-input ×4 →
tool-call → finish `tool_calls`); the raw argument JSON is captured from SSE
fragments and replayed through every fence — raw-argument guard (pass),
Mastra `validateToolInput` with the REAL frozen contract (accepted),
authoritative `Contract.parse` (accepted), content-domain parse (accepted) —
and the REAL governed bridge accepted the structurally valid synthetic shape
end-to-end: ONE durable quiet keyed invocation `completed`, EXACTLY ONE
pending claim proposal, `tool.completed`, zero approvals;
`convertUndefinedToNull` changed NOTHING for this shape; the one-request cap
structurally refused the loop's automatic post-tool follow-up BEFORE any
network byte.

**Disposition of D-Q6-12's "Classification B":** WITHDRAWN as an established
conclusion. The earlier diagnostic response ended `finish_reason: tool_calls`
(not `length`), so reasoning-budget exhaustion was NOT proven; zero visible
content before completing a tool call is normal provider behavior; the
immediate failure in that response was the tool-call contract rejection
(cause unknown — the arguments were not captured). Reasoning-budget
consumption is now recorded as an UNEVIDENCED hypothesis for Execution 4.
What REMAINS validly established offline: every downstream layer preserves
every supported field; reasoning-only responses map exactly to the
Execution-4 observable; the request sends `max_tokens: 512` with NO reasoning
control. NEW uncertainty: Execution-4 per-turn elapsed times (6.4–7.8 s) can
no longer be mapped to a single provider request (a reasoning + tool-call
response triggers the loop's automatic follow-up within `maxSteps: 8`), so
Execution 4's per-turn request counts and finish reasons remain unknown.

**Classification:** NONE of A–E is evidence-backed — the central objective
(the real model's generated tool-argument JSON) was not captured. The
tool-call rejection boundary remains UNIDENTIFIED. The smallest correction
now available is procedural: the corrected probe is machinery-validated and
ready; a new single-request authorization would be a NEW owner decision.

**Safety (all verified):** the credential was read once (memory only; never
printed, hashed, serialized, persisted, or placed in command arguments); the
disposable diagnostic store was byte-scanned (0 credential occurrences) and
deleted; the loopback validation used a canary and never read `auth.json`;
no fixture was accessed; `.quellight-data` never accessed (mtime unchanged);
VICT never modified; no historical report modified; no code, test, script,
manifest, lockfile, frozen contract, prompt, instruction, schema, or bound
changed; all probes, stores, and listeners removed and verified absent.
Record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-REAL-MODEL-TOOL-ARGUMENT-DIAGNOSTIC.md`.

**Disposition:** Q6 is NOT independently verified and NOT formally closed.
**NO FIFTH LIVE EXECUTION IS AUTHORIZED.** **Phase Q7 remains BLOCKED — NOT
BEGUN.** Stage 07 remains In Progress.

## D-Q6-14 — Phase Q6 tool-argument diagnostic completion: two authorized provider requests executed; the model emitted NO tool call in either response — its reasoning phase consumed the full 512-token output budget (provider-reported `finish_reason: length`, 0 content bytes, 0 tool-call deltas), so no argument JSON exists to capture; the tool-call rejection boundary remains UNIDENTIFIED (classification F); the reasoning-budget mechanism for the Execution-4 empty-reply class is now DIRECTLY EVIDENCED; corrected machinery fully validated offline (owner-decision input; no repair, no contract change, no third request)

**Date:** 2026-09-22. **Trigger:** the owner's completion authorization (max
TWO diagnostic provider requests, not live-proof executions) for capturing the
real model's generated tool arguments and identifying the VICT bridge
rejection boundary, using the corrected machinery from D-Q6-13.

**Request accounting (exact):** starting tip `03df759…` (verified
`== origin/main`, clean tracked trees, linear ancestry; VICT `fd0c1f7…`
untouched). Exactly TWO provider requests to `ollama-cloud` /
`glm-5.3-flash` / `https://ollama.com/v1` (registry-pinned, env-var
credential lookup), both HTTP 200 with the frozen bounds (512 output tokens,
120 s deadline, 0 retries, no fallback, `tool_choice: auto`, NO reasoning
control — verified in both captured request bodies). **Request 1** (exact
production request, nothing rewritten): 154 SSE events, 36,803 body bytes,
7,926 ms — **2,403 reasoning bytes, 0 visible content bytes, 0 tool-call
deltas, `finish_reason: length`** (router-verified `unified: length`); turn
completed with a 0-byte restored reply, 0 invocations, 0 proposals.
**Request 2** (permitted fallback; TRUTHFULLY DISCLOSED: executed UNFORCED
because the probe's forcing flag was unset in the launch environment — a
probe-side configuration omission; forcing was optional under the
authorization, and the request was otherwise the exact production shape):
178 SSE events, 41,897 body bytes, 6,865 ms — **2,326 reasoning bytes, 0
content bytes, 0 tool-call deltas, `finish_reason: length`**; turn completed,
0-byte reply, 0 invocations, 0 proposals. No third request was attempted; no
retry; the automatic follow-up was structurally refused before any network
byte (and did not occur — neither response contained a tool call).

**Classification: F — still inconclusive on the tool-argument rejection
boundary.** Precise reason: the model produced NO tool call in either
authorized response — within the frozen bounds its reasoning phase consumes
the entire 512-token output budget BEFORE any tool-call or content tokens are
emitted. There is no generated argument JSON to capture, so the A–E
classification remains unevidenced and the earlier diagnostic's `tool.failed`
boundary remains unidentified. The capture/replay/corrected-fixture machinery
is validated and ready for any future authorization.

**Reasoning-budget disposition (truthful):** the mechanism for the
Execution-4 empty-reply class is now DIRECTLY EVIDENCED — both responses
carry the provider's own `finish_reason: length` with pure reasoning and zero
content, reproducing the exact Execution-4 observable (completed turn, empty
restored reply, 0 invocations, 0 proposals, ~7–9 s) twice. The earlier
caveats stand: that specific earlier response ended `tool_calls` (so it did
not exhaust the budget — model behavior is non-deterministic across runs:
when the reasoning phase fits within 512 tokens the tool call completes;
today both runs exceeded it), and reasoning control remains a separate,
undecided concern for non-tool turns. Downstream field-preservation findings
remain valid.

**Corrected machinery (offline-validated on loopback with a SIMULATED
provider; simulated arguments are machinery-validation artifacts, NOT model
output):** the corrected awaited `doStream` wrapper forwards the complete
router part chain; raw argument JSON is reassembled from SSE fragments and
replayed through every fence — raw guard, real Mastra `validateToolInput`
(rejected the invalid simulated shape with the exact durable code
`VICT_TOOL_FAILED`), authoritative `Contract.parse` (accumulated per-field
issues `{code, path}`, e.g. `QLT_INPUT_UNKNOWN_FIELD`,
`QLT_INPUT_INVALID_ENUM`), and the real governed bridge (deterministic
rejection: 0 invocations, 0 proposals). The smallest corrected fixture (six
pointer-addressed transformations) parsed OK and, through the REAL governed
bridge, produced ONE durable quiet-write invocation (completed), ONE pending
proposal (`status: proposed`), ZERO approvals, ZERO changesets (zero
canonical effect), no authority escalation. No production repair implemented.

**Safety (all verified):** the credential was read once (memory only; never
printed, hashed, persisted, serialized, or placed in command arguments); no
fixture was accessed; `.quellight-data` never accessed (mtime unchanged);
VICT never modified; neither previous report modified; no code, test, script,
manifest, lockfile, pin, contract, prompt, instruction, schema, or bound
changed; all probes, stores, and listeners removed and verified absent.
Record:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-TOOL-ARGUMENT-DIAGNOSTIC-COMPLETION.md`.

**Disposition:** Q6 is NOT independently verified and NOT formally closed.
**NO FIFTH LIVE EXECUTION IS AUTHORIZED.** **Phase Q7 remains BLOCKED — NOT
BEGUN.** Stage 07 remains In Progress.

## D-Q6-15 — Root-cause recovery: corrected generation guidance/bounds; one final live ceremony passed

**Date:** 2026-09-22. New owner recovery authorization supersedes earlier no-further-execution dispositions for this single recovery. Three standalone additive amendments preceded their executable changes: bounds/encoding guidance, fixture identity without hashing, and labeled synthetic naturalistic fixture provenance. Historical decisions remain unchanged.

Real diagnostics established generation truncation at insufficient bounds and generated claim enum violations rejected correctly at Mastra validation. Quellight now supplies existing closed enum encodings and a bounded 2,048-token allowance with default reasoning, unchanged capability schema and authority. VICT 0.3.1 remains exact-pinned and unchanged; no release was needed.

The authoritative offline ladder passed once. Exactly five diagnostic HTTP requests preceded exactly one final live ceremony, which passed six turns/eight HTTP requests with zero findings, three valid pending proposals and exactly one governed user-confirmed canonical record. Idempotency, stale-version refusal, restart, fresh-thread continuity, conflict non-mutation, privacy and cleanup passed. The original private fixture wording remains untested. No additional live run is authorized.

Record: [Q6 root-cause recovery](report/QUELLIGHT-STAGE-07C-PHASE-Q6-ROOT-CAUSE-RECOVERY.md), including implementation and verification identities and structural evidence. **Q6 is ready for fresh independent Q7 verification, not formally closed. Q7 has not begun. Stage 07 remains In Progress.**

## D-Q6-16 — Phase Q7 independent audit: VERIFIED (0 Blocking / 0 High / 0 Medium); Phase Q6, Phase Q7, and Stage 07C formally closed; Stage 07D permitted and not begun

**Date:** 2026-09-22. **Trigger:** D-Q6-15's handoff. A fresh independent auditor (not a participant in the Q6 investigation, remediation, or live execution) audited the untouched `8a26d310…` tree.

The audit independently re-derived the three-way failure separation (harness defects / insufficient generation allowance / model-produced invalid closed-enum values), confirmed the remediation is limited to compact existing-enum guidance, a 2,048-token default+maximum with default reasoning, and request caps — no schema relaxation, coercion, new capability, or authority — confirmed VICT remained exact-pinned stable `0.3.1`, unchanged and unpublished, and verified the amendment-before-executable ancestry (`fb6d16e…` → `18f8c57…` → `a33f2b1…` → `ac594628…`) together with the preserved historical records.

The audit authored its own offline negative controls and proved the committed tree detects: reasoning-only and visible `length`; invalid closed-enum arguments (guard/routed divergence recorded; zero durable invocations); raw-vs-routed argument mutation; global and per-turn request-cap violations; missing visible replies; false canonicalization; foreign-dir restart; and incomplete scans/cleanup (planted leak, refused removal, deleted workspace, mutated fixture, missing result, tampered result, absent gate). The committed live receipt was verified against the implementation and Git history in every cross-checked detail; the auditor did NOT repeat the live proof — the one-shot recovery authorization remains consumed, mechanically enforced by the receipt.

The audit's own authoritative ladder ran on the untouched tree: `npm ci`, `verify:consumer`, `verify:stage7c`, `npm audit --omit=dev` (0 vulnerabilities), `git diff --check` — all green on first run; `verify:quellight` first run hit a real-browser ceremony timing timeout (recorded) and passed on rerun with identical assertions and no timeout changes.

Findings: 0 Blocking, 0 High, 0 Medium; Low L-1 (the offline matrix records but does not fail on `normalizationChanged` alone; permanently asserted at probe level), Low L-2 (the global cap's earliest reachable matrix phase is post-ceremony under the frozen tool budget); both carried disclosures unchanged (stale `0.3.0` console labels; hashed Mastra dist import coupling). Disposition per reference §27.4: PASS.

Record: [Q7 independent verification](report/QUELLIGHT-STAGE-07C-PHASE-Q7-INDEPENDENT-VERIFICATION.md) and the [Q6/Q7 formal closure](report/QUELLIGHT-STAGE-07C-PHASE-Q7-FORMAL-CLOSURE.md). **Phase Q6 and Phase Q7 are FORMALLY CLOSED; Stage 07C is FORMALLY CLOSED; Stage 07D is PERMITTED and NOT BEGUN; Stage 07 remains In Progress.**

## D-07D-0 — Stage 07D Phase D0 planning complete; owner decisions pending (documentation-only; non-binding)

**Date:** 2026-09-22. **Trigger:** the Stage 07C formal closure's handoff
(D-Q6-16). A non-binding planning document for Stage 07D — Retention,
Recovery, and Real-Use Proof — was produced against the Stage 07 architecture,
the 07C handoff §18 boundary, the closed 07C implementation, and the
applicable `QLT-*`/`INV-*`/`MSTR-012` requirements.

The plan: one joint contract freeze (D1a), then retention/tombstones/expiry
with dependency re-evaluation and user removal (Lane A) and conflict
identification with amendment-vs-execution semantics (Lane B) as parallel
lanes with disjoint file ownership, then governed deletion/export with
cross-store reconciliation (D2), then the MSTR-012 real-use and
data-protection proof (D4, one-shot owner-authorized), then independent
verification and formal closure with the Stage 07E handoff (D5).

Six genuine owner decisions are presented with recommended defaults and are
PENDING (retention/expiry defaults; removal depth and residue truthfulness;
deletion-cascade policy; conflict-challenge visibility; real-use
authorization shape; audit shape). Nothing is frozen, implemented, verified,
or closed by this entry.

Record: [the D0 planning document](report/QUELLIGHT-STAGE-07D-PHASE-D0-PLANNING-AND-OWNER-DECISIONS.md). **Stage 07D planning is COMPLETE; owner decisions are PENDING; Stage 07D implementation has NOT begun; Stage 07E has NOT begun; Stage 07 remains In Progress.**

## D-07D-1 — Stage 07D owner decisions APPROVED and BINDING (recorded at the D1a freeze)

**Date:** 2026-09-22. **Trigger:** the D0 planning document's six pending
decisions. The owner approved all six with the recommended defaults; they
are now BINDING Stage 07D decisions and are codified by the D1a contract
freeze:

1. **Expiry:** none automatic by default; user-assigned expiry on
   individual CLAIMS only; commitments and open loops never expire
   automatically; expiry is applied only by a visible deterministic
   enforcement pass, never silently from elapsed time during ordinary
   reads.
2. **Removal depth:** normal removal immediately makes content ineligible
   everywhere; only a content-free tombstone and truthful residue
   disclosure remain; a separate explicit deep-purge for eligible
   remaining content is D2 scope; deletion is never claimed against
   storage, evidence, backups, or external systems unless proven.
3. **Conversation deletion (D2):** always ask — conversation only
   (default) or conversation plus Shared World meaning originating from
   it; never a silent cascade.
4. **Conflicts:** a conflict with an active commitment produces a visible,
   dismissible, quiet, non-blocking challenge proposal; never a silent
   overwrite, harmonization, reinterpretation, or execution against the
   commitment; no modal, focus theft, tray auto-open, interruption, or
   forced decision.
5. **Real-use proof:** D4 uses one bounded owner-authorized structured
   session plus a short organic-use observation window; D4 is not
   executed before its phase and no provider is accessed in D1.
6. **Audit:** per-phase self-verification and one combined independent
   audit after D4; before D4, D2 deletion/export/reconciliation passes a
   focused data-safety gate (not a duplicate full audit).

## D-07D-2 — Stage 07D Phase D1a joint contract freeze (declarative; committed alone)

**Date:** 2026-09-22. The joint D1/D3 foundation contract is FROZEN in
`src/lib/sharedworld/d1-contract.ts` and the freeze report, including: the
3-state meaning-family retention vocabulary with its closed transition
table (the 07B thread family keeps its 2-state vocabulary); content-free
tombstone column rules as STORAGE CHECKs; claim-only expiry metadata;
enforcement-pass rules with append-only pass evidence; the bounded
dependency re-evaluation; the single deterministic conflict classification
(`commitment-key-conflict`) with quiet dismissible challenge judgment
records; the structural amendment-versus-execution distinction with the
`qlt_amendment` judgment family; the clarification boundary (no durable
clarification artifact, no agent-surface change in D1); the eight new
governed actions on two new resources (`qlt.retention`, `qlt.conflict`);
the UI truthfulness/non-interruption rules; the durability rules; migration
5 (`qlt-retention-conflict-foundations`) with its rebuild/copy rules and
new-family inventories; the N-D1/N-D3 negative-control matrix; lane
ownership and integration order; D2-facing interfaces; and the explicit
exclusions (deep purge, export, thread deletion, cross-store
reconciliation, D4/D5/07E, agent-surface widening).

Explicit data amendments to the frozen Q2 module `meaning-contract.ts`
(retention vocabulary, nullable content columns, expiry/removal columns,
amended inventory) are recorded in its header and the freeze report §3.
The freeze commit contains NO executable behavior change.

Record: [the D1a freeze report](report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md). **Stage 07D foundations are FROZEN; implementation lanes are next; nothing is implemented, verified, or closed by this entry.**

## D-07D-3 — Stage 07D Phase D1a freeze executed; D1/D3 foundations implemented and self-verified (D2 next)

**Date:** 2026-09-22. The D1a joint contract freeze was committed alone
(`493c52e0`, declarative only), followed by the schema foundation
(`cdcfde24`, migration 5 `qlt-retention-conflict-foundations`), Lane A
(`68b72958`: governed user removal with content-free tombstones, claim-only
expiry, the deterministic visible enforcement pass with append-only
evidence, bounded dependency re-evaluation), an explicit standalone freeze
amendment (`6856d45d`: challenge rows are mutable judgment rows,
`version >= 1`; the commit also carried in-flight Lane B module files —
composition disclosed), Lane B (`8fa81906`: deterministic
commitment-key-conflict detection with quiet dismissible challenge records
at the ceremony confirm choke point; the structural amendment-vs-execution
operation with immutable amendment rows and amends lineage), and the
focused gates (`866074ea`: `verify:d1` 49 checks, `verify:d3` 35 checks;
verify-q2..q6 re-pins reconciled for the grown plan inventory and
migration bookkeeping).

Verification at delivery: full node suite 351/351 green; verify:q2 (196),
q3 (34), q4 (41), q5 (86), q6 (114), d1 (49), d3 (35) all green; typecheck,
format, and `git diff --check` clean. The aggregate/browser ladder was
deliberately not run (no UI/route/dependency changes; runs once at the D2
integration point and the D5 audit freeze). No provider access; no
operator data or credentials touched; VICT unmodified.

Record: [the implementation report](report/QUELLIGHT-STAGE-07D-PHASE-D1-D3-FOUNDATIONS-IMPLEMENTATION.md). **Stage 07D D1/D3 foundations are IMPLEMENTED — AWAITING D2 INTEGRATION; deep purge, export, and cross-store reconciliation are NOT implemented; Stage 07D is NOT verified or formally closed; Stage 07E has NOT begun.**

## D-07D-4 — Stage 07D Phase D2 implemented: governed deletion, export, and cross-store reconciliation (D4 next)

**Date:** 2026-09-22. Following the standalone D2 safety contract
(`quellight.stage07d.d2.safety-contract@1`, `396eb5c0`), Phase D2
delivered: governed conversation deletion with the two explicit user
choices (conversation-only default preserving meaning byte-identically;
plus-originating-meaning bounded by recorded provenance), content-free
thread tombstones enforced at the storage layer, a word-gated mode-bounded
deep purge with content-free receipts and best-effort VACUUM, the
deterministic versioned user export (`quellight.user-export@1`) through
the released VICT governed export ports, and receipt-driven cross-store
reconciliation with boot recovery and restart fencing — all through the
pinned VICT 0.3.1 governed surface (no GOV-007 stop; no ungoverned local
substitute). The agent plan/capability envelope is unchanged (29-action
plan, proposal-only).

Verification at delivery: verify:d2 (74 checks), verify:d1 (49),
verify:d3 (35), verify:q2–q6, verify:governance, the consolidated
real-browser D1/D3/D2 pass, full node suite 351/351, UI suites 20/20;
typecheck/format/diff-check clean. Implementation decisions of record
(purge scope bounded by the recorded deletion mode; deletion receipts
outlive purged thread rows; the runner's parent-rebuild FK discipline; two
gate-found lifecycle defects fixed and pinned) are documented in the
[implementation report](report/QUELLIGHT-STAGE-07D-PHASE-D2-IMPLEMENTATION.md).
**D4 real-use proof has NOT begun and requires its own owner
authorization; Stage 07D is NOT verified or formally closed; Stage 07E has
NOT begun.**

## D-07D-5 — Stage 07D Phase D4a: MSTR-012 real-use proof PREPARED, execution NOT authorized

**Date:** 2026-09-22. Following the standalone D4 proof contract
(`59bb43ad` — the contract SHA is corrected in the machinery commit
message of record), Phase D4a prepared the MSTR-012 real-use proof: the
two evidence layers fixed by the contract (a bounded owner-authorized
structured session over the pinned provider profile in a disposable
out-of-repository directory, and a short organic-use observation window
on the normal operator store with no harness attached), the session-level
one-shot authorization receipt, the evidence ledger with fail-closed
scanning and sealing, bounds enforced before transport, the governed-user-surface-only
deletion authority, the permanent offline `verify:d4-prep` gate (23
checks green over synthetic evidence), and the owner runbook with the
exact authorization text. **D4 real-use evidence DOES NOT EXIST; no
provider or operator-data access occurred; D4 execution requires its own
owner authorization; Stage 07D is NOT verified or formally closed; Stage
07E has NOT begun.**

## D-07D-6 — Stage 07D Phase D4a: D4 proof determinism correction (Amendment 1)

**Date:** 2026-09-22. The D4a report's A7 limitation ("the live trigger
depends on the model's key choice") was corrected under the accepted
principle: model discretion is a real-use observation; required state
transitions must have a deterministic owner-governed path. The D4 proof
contract moved to @2 (standalone amendment `ebbcdd9` BEFORE dependent
machinery `3b3f9e2`): every required A1–A13 pass condition now
classifies owner-action or runtime-observation; the scenario-behavior
outcome/code are removed; A2's required path is the owner's direct Save
with ceremony as observation; A3 is a user-attribution audit; A6's
required exclusions are owner-seeded (removed + expired); A7 is
deterministic at the real decision boundary (standing commitment via
`act.createCommitment`; every commitment-kind proposal resolved through
`act.confirmProposal` with quiet refusal + challenge + user-only
dismissal on same key; the standing commitment unchanged; zero open
challenges; zero mutation; no-proposal still passes). The full conflict
class is permanently proven offline through a real composition at the
real user boundary (`verify:d4-prep` N-D4-P-23; gate now 29 checks
green). The credential boundary wording was reconciled to the
owner-designated authentication boundary (presence-only, in-memory);
the runbook's stale pinned-profile text was corrected to the
composition-pinned `ollama-cloud/glm-5.3-flash`. Bounds unchanged. No
provider, credential, operator data, `.pi/`, `.quellight-data`, or
scenario file access; D4 execution remains NOT authorized; Stage 07D is
NOT verified or formally closed; Stage 07E has NOT begun.

## D-07D-7 — Stage 07D Phase D4b: the one authorized structured session FAILED truthfully; no rerun

**Date:** 2026-09-23. Under the owner's one-shot authorization the D4
structured real-use session was executed exactly once against the
pinned profile with the credential resolved through the owner-designated
authentication boundary. The session aborted ~3.4 s after receipt
consumption, at or before the first provider turn could complete, and
the machinery sealed the truthful failure outcome
(`failed` / `QLT_D4_PROOF_POINT_FAILED`); the process exited 1. Zero
user turns were verified completed; no A1–A13 proof point was
established. The failure path's cause line was lost to the
`process.exit(1)` buffered-write discard (reported as an observability
finding; NOT repaired). Cleanup completed: the harness removed and the
assistant independently verified the proof workspace absent; the
owner-scenario materialization and run-log directories were removed and
verified absent; leak scans found no scenario text or credential-shaped
material; the repo `.quellight-data` operator store has zero writes in
the session window and VICT `.pi` is untouched. The consumed receipt
now blocks re-execution. Per the owner's instruction, any future
execution requires a new explicit owner authorization; the organic-use
window has NOT begun; Stage 07D is NOT verified or formally closed;
Stage 07E has NOT begun.

## D-07D-8 — Stage 07D Phase D4b: the early-session failure proven, fixed, and locked in

**Date:** 2026-09-23. The D4b termination ~3.4 s after receipt
consumption was investigated under the owner's conditional diagnostic
authorization. The triggering cause is PROVEN offline: the harness passed
the proof workspace as the repository-root argument to the composition's
fail-closed isolation check, refusing every execution before any provider
contact (zero provider requests occurred). Five stacked local harness
defects were found and fixed (credential delivery to the gated live seam,
the declared `recordKind` field, the closed-empty retention-pass payload
with a two-second-ahead expiry and an in-session wait, a missing await on
the removal view read, and the turn dispatch bypassing the admitted
boundary), and the failure observability was rebuilt (durable structural
failure facts on every failed seal — phase, stable class, request
accounting, transport/header/bytes booleans, turn settlement, elapsed
time, cleanup record — with no abrupt session exits). The corrected
machinery sealed a COMPLETE 24-check structured session `passed` against
a loopback provider stand-in and every requested failure class
truthfully; two new permanent gate controls (the durable-accounting
statics and the live-seam fail-closed child probe) lock the remediation
in, and the gate's legacy destructive receipt/evidence controls were made
history-aware after they briefly deleted the committed consumed receipt
(restored byte-identical, verified against git). The conditional provider
diagnostic was NOT used (the cause was distinguishable offline; zero real
provider requests in the entire investigation). Remaining uncertainty:
the real credential's validity against the pinned endpoint (resolution is
proven; validity is the one untested link). A new structured-session
authorization is machinery-ready; D4 remains incomplete; Stage 07D is NOT
verified or formally closed; Stage 07E has NOT begun.

## D-07D-9 — Stage 07D Phase D4: the attempt-1 bundle archived and the evidence lifecycle made fail-closed

**Date:** 2026-09-23. Under the owner's explicit instruction the attempt-1
D4 bundle (the consumed receipt and the truthful failed-evidence summary
from the one authorized 2026-09-23 session) was archived byte-identically
to immutable attempt-1 filenames, and the evidence lifecycle was corrected
so every future attempt records its own truth or fails closed.

**Additive archive mapping (byte-identical, verified by SHA-256 before and
after the move; no new receipt created):**

| from (active path, now absent)                             | to (immutable archive)                                               | sha-256                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/report/evidence/d4-structured-session-receipt.json`  | `docs/report/evidence/d4-structured-session-receipt.attempt-1.json`  | `4ff67b61150a8d7de5a1e8c0d68f14bdec305fb545ca5455cc83bc7c43194f8e` |
| `docs/report/evidence/d4-structured-session-evidence.json` | `docs/report/evidence/d4-structured-session-evidence.attempt-1.json` | `c87bbd9128cf1fc38b727646719a9aa41fa56d6ee732900da8b298187b4751b5` |

No attempt-1 cleanup record existed (the attempt-1 workspace was removed
and verified; the runbook's bundle instruction covers the cleanup record
for future attempts). **Lifecycle corrections (all offline, no contract,
bounds, or product-semantic change; no gate weakened):** the harness now
refuses — before the credential, scenario, workspace, or authorization
consumption — unless the active receipt, evidence, AND cleanup-record
paths are all absent; every evidence or cleanup-record write collision
fails closed with a non-zero exit and the cleanup record carries the
truthful `evidenceSealed` flag (a run can never report success unless its
own evidence and cleanup result were durably recorded); unexpected-throw
termination now also records the cleanup result; the bounds-exceeded seal
carries the same complete structural accounting as every other failed
branch (phase, stable failure class naming the exceeded bound, request
accounting, transport/header/bytes facts, turn settlement, elapsed time);
and the owner runbook now instructs handling every attempt as one atomic
receipt/evidence/cleanup bundle. New permanent gate controls:
N-D4-P-27/28 (stale active output paths refuse before anything is
consumed or created), N-D4-P-29 (fail-closed collisions, complete bounds
accounting, and cleanup recorded on every termination path), N-D4-P-30
(the archived attempt-1 bytes are pinned by digest), plus the active-paths
all-absent invariant. Gate now 35 checks green. The active canonical
paths are clean; a fresh owner authorization can create exactly one new
attempt. No new structured-session authorization is granted or running;
D4 remains incomplete; Stage 07D is NOT verified or formally closed;
Stage 07E has NOT begun.

## D-07D-10 — Stage 07D Phase D4: attempt-2 structured session EXECUTED and SEALED PASSED (Layer A complete)

**Date:** 2026-09-23. Under the owner's one-shot authorization at the
pinned tree `459a69a…`, the fresh D4 structured real-use session ran
EXACTLY ONCE (no probe, no diagnostic, no retry, no second execution),
resolved the credential only through the owner-designated authentication
boundary, and sealed `passed` at contract @2 with the pinned profile —
all 24 proof points true, ≈121 s elapsed, every frozen bound enforced
live and respected (5 planned turns, ≤20 requests, ≤2048 tokens/request,
zero retries, no fallback). True exit code 1, preserved truthfully: the
durable cleanup verification failed inside the harness's 15-second
post-close retry window (Windows SQLite-unlock lag) and the machinery
refused to report success without a durably verified workspace
disposition; the workspace was removed and verified immediately after
process exit and the lag is disclosed as a bounded platform behavior.
Privacy scans over the sealed bundle found zero scenario text, zero
conversation payloads, zero credential material. The scenario temp file
was deleted. The attempt-2 bundle occupies the canonical active paths as
this attempt's committed record; per the corrected runbook lifecycle any
future fresh authorization requires the owner to archive this bundle
first. D4 Layer A is COMPLETE; Layer B (the organic-use window — three
genuine sessions across two launches on two days, no harness) awaits the
owner and must not begin automatically. D4 remains incomplete until
Layer B; Stage 07D is NOT formally closed; Stage 07E has NOT begun.
**Truthful wording correction (owner instruction, 2026-09-23):** the
credential resolution sentence above must not be read as "the boundary
file was never read": the harness DID read the designated credential
field of the owner-designated authentication boundary file — in memory
only; no human or tooling inspection of the file, no printing, and no
persistence of the credential value occurred.

## D-07D-11 — Stage 07D Contract Amendment 2: the supported operator live-use startup (`quellight.stage07d.operator-live-use@1`)

**Date:** 2026-09-23. Product-readiness finding (owner): ordinary `npm run
dev` composes the OFFLINE fixture only — the owner's attempted organic-use
session ran in offline-fixture mode and therefore does NOT count toward the
D4 Layer B window. The only live seam in the released source was the
proof-only `QUELLIGHT_LIVE_PROOF=1` gate of the Q6/D4 harnesses. **Amended
(frozen as this document, committed before any executable change):** the
supported normal-use live startup is `npm run dev:live` through the new
`QUELLIGHT_OPERATOR_LIVE=1` seam — entirely separate from
`QUELLIGHT_LIVE_PROOF` and all D4 machinery (setting both live seams is a
fail-closed `VICT_OPERATOR_CONFIG_INVALID`); the credential resolves ONLY
(a) through the protected operator credential variable via the closed VICT
operator-configuration foundation, or (b) in memory through the existing
owner-designated authentication boundary (the Q6/D4 precedent field), never
printed, persisted, echoed, or asked of the owner; absence fails closed with
`VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` and NO fixture fallback; the pinned
profile and the normal operator store (`.quellight-data`) are used;
deterministic offline remains the default for `npm run dev` and all tests;
mode disclosure stays exactly Live / Offline fixture / Unavailable. The
live path is proven offline through the loopback transport stand-in over a
task-owned store. No D4 machinery change; no rerun of the structured
proof; D5 not begun.

## D-07D-12 — Contract Amendment 2 implemented and proven; the organic-use attempt re-run instruction

**Date:** 2026-09-23. Executable changes landed AFTER the frozen
amendment (D-07D-11): `src/lib/server/operator-credential.ts` (the
owner-designated boundary reader, in-memory only, structural failures),
the composition mode selection (`QUELLIGHT_OPERATOR_LIVE=1`, mutually
exclusive with the proof seam, credential = protected variable →
boundary → fail-closed `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` with NO
fixture fallback), the cross-platform `scripts/dev-live.mjs` launcher
(`npm run dev:live`), and the permanent offline proof gate
`verify:dev-live` (19 checks green: offline default unchanged; live
selection through the loopback transport stand-in with exactly one
provider request and the assistant response produced through the real
adapter path; credential in memory only, in no durable frame, no
serialized configuration; fail-closed refusals; seam separation;
boundary unavailability; task-owned store with the default operator
directory proven untouched). Full battery: node tests 353, UI tests 20,
dev-start gate, d1/d2/d3 all green; `verify:d4-prep` shows exactly one
red line — the by-design post-consumption active-paths invariant (the
attempt-2 bundle occupies the canonical paths as its committed record;
any fresh authorization requires the owner to archive that bundle
first). **The owner's attempted organic-use session ran in
offline-fixture mode and does NOT count toward Layer B**; the window
begins with genuine live use on `npm run dev:live` and remains
harness-free. No D4 rerun; no real provider contact in any proof; no
operator data access; D5 not begun.

## D-07D-13 — D4 Layer B recorded and closed: the owner's organic-use window satisfies the frozen minimum; D4 is COMPLETE; Stage 07D awaits independent D5

**Date:** 2026-09-23. The owner used Quellight normally on the live
startup (`npm run dev:live`, live provider working — owner-affirmed; the
earlier offline-fixture attempt remains excluded per D-07D-11/12) and
answered the window questions directly. Every frozen minimum of proof
contract @2 §3 is established without inference: THREE genuine sessions,
across TWO separate launches on TWO calendar days, including a full
application restart ("restart all is working well") and genuinely fresh
conversations ("multiple conversations from scratch"). The eight
observation answers are recorded structurally in
`docs/report/evidence/d4-organic-use-record.json` with explicit
attribution: direct answers — remembered meaning ACCURATE, restart
trust preserved, memory understandable after learning the vocabulary,
and prototype-level feel noted as friction — plus the owner's explicit
blanket evaluation covering continuity, confirmation burden, conflict
handling, and deletion/export (acceptable; NOT presented as independent
detailed observations). The owner approved the product from their side
with NO blocking concern. Non-blocking feedback carried forward:
prototype-level feel needing continued polish, and the vocabulary
learning curve. Layer A (attempt-2 sealed passed) and Layer B are
mutually consistent and complementary; Layer A evidence, receipts,
attempt archives, and contracts are preserved byte-for-byte (the only
evidence-directory addition is the organic-use record itself). **D4 is
COMPLETE** — both contract-required evidence layers exist. Stage 07D is
ready for independent Phase D5 verification; D5 has NOT begun (it is
the next session's work); Stage 07D is NOT independently verified or
formally closed by this entry; Stage 07E has NOT begun. Closeout was
documentation-only: no executable change, no provider contact, no
operator-data access, no structured-session rerun.

## D-07D-14 — Phase D5 independent audit EXECUTED: verdict NOT VERIFIED — FORMAL CLOSURE REFUSED (1 Blocking / 1 High / 1 Medium / 3 Low); D2 deep-purge ordering defect reported, NOT repaired; remediation path fixed

**Date:** 2026-09-23. **Audited tree:** `60859c4e4f741b3d711f62bbae33303d638b06d9`
(verified HEAD == origin/main after fresh fetch, clean; VICT tip
`4aa245d29a79b0e9f9f2e35b46597e7a10701571` verified the same way). The
audit was performed fresh and independently: full history/ancestry
reconciliation (linear, no merges; the two commits between the attempt-2
seal `5cc7e42…` and the tip are the standalone Amendment-2 freeze
`0efd1f4` and its disclosed implementation `72a5922`; the D4 machinery is
byte-unchanged since `459a69a`; the sealed attempt-2 bundle and the
attempt-1 archive are git-blob-identical to the sealing commit and match
the pinned digests); independent source review plus 44 fresh negative
controls on disposable synthetic stores (43 pass — the single failure is
the blocking defect below); mutation-based non-vacuity demonstration
(3/3 injected regressions caught); one first-run real-browser D2/D1/D3
evidence pass on an isolated disposable store (PASS, never rerun); and
the complete authoritative ladder on the frozen clone with every true
exit recorded (verify:governance and one node test fail ONLY on a
hard-coded `/260909-VCT-Quellight/` directory-name assertion — green on
reruns in the identical-SHA original tree; verify:d4-prep's single red is
the documented by-design active-paths state).

**B-1 (Blocking):** the D2 deep purge (`purgeConversation`) throws a raw
`FOREIGN KEY constraint failed` for ceremony-created meaning in the
plus-meaning path: the frozen step order deletes `qlt_proposal` rows
before the originating subject rows whose `proposal_id` (and a
commitment's `normative_basis_proposal_id`) reference them, and the D1
tombstone null-set does not clear `proposal_id`. Fails closed (rollback,
no receipt, no partial deletion, no false success) — a required D2
capability is functionally broken in its principal scenario. **H-1
(High):** `verify:d2` seeds purge scenarios only through direct-verb
records (`proposal_id` NULL) and cannot detect the B-1 class. **M-1
(Medium):** commit `6856d45` landed the Lane B implementation under a
`docs(…AMENDMENT 1…standalone)` label — the amendment was not standalone
in history (final-state conformance verified). **L-1:** hard-coded
`/260909-VCT-Quellight/` in `verify-governance.mjs` and
`test/governed-mutation.test.ts` breaks the ladder in any differently
named checkout. **L-2:** Layer B OB-1/3/4/7 are aggregate-attested
(covered by the owner's blanket evaluation) — ruled within the frozen
minimum and honestly labeled, weaker than direct answers. **L-3:**
stale system-reference status tail (corrected by this entry's status
update).

**Consequences:** Stage 07D is NOT independently verified and NOT
formally closed; D4 is not marked closed by the audit; Stage 07E is NOT
begun and NOT permitted. No executable change was made by the audit; all
historical records, contracts, receipts, evidence, and reports remain
byte-preserved; no provider contact, no credential access, no D4 rerun,
no access to `.quellight-data` or VICT `.pi/`. VICT required no
reconciliation. **Smallest next permitted remediation (owner-authorized,
in order):** (1) freeze the D2 safety-contract amendment @1 → @2
correcting the purge step order (or, by explicit owner decision, extend
the D1 tombstone null-set to the proposal-reference columns);
(2) implement it and extend `verify:d2` with a ceremony-path purge
control (closes H-1); (3) run the focused gates and request a focused D5
re-verification. Optionally: one direct owner answer each for OB-1/3/4/7
(L-2); repo-root-relative path containment (L-1). Report:
`docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md`.

## D-07D-15 — D2 safety contract Amendment 1 FROZEN (`…d2.safety-contract@1` → `@2`): the deep purge is repaired by FK-derived deletion order, NOT by erasing proposal provenance

**Date:** 2026-09-24. Response to the Phase D5 independent audit finding B-1
(blocking: plus-meaning deep purge of ceremony-created meaning failed with a
raw FOREIGN KEY constraint failed; the transaction rolled back, no receipt,
no partial deletion — fail-closed but the principal scenario was unusable)
and H-1 (verify:d2 seeded purges only through direct-verb records with
`proposal_id` NULL, so the gate could not see the class).

**Owner decision recorded here:** repair by deriving and enforcing the
correct foreign-key dependency order for deep purge; do NOT expand D1
tombstoning to erase `proposal_id` (provenance and lineage are preserved
during normal logical removal); the physical purge may delete dependent
rows before their referenced parents inside the existing single
transaction and existing authorized scope.

**Frozen (standalone docs commit, before any executable change):** the
complete live FK graph (20 edges, PRAGMA-derived on the live schema; the
referenced parents are exactly `qlt_proposal`, `qlt_commitment`,
`qlt_thread`); the amended purge order — challenges, amendments,
corrections, source links, ORIGINATING SUBJECT TOMBSTONES, proposals,
assembly evidence, conversation link, thread (the only change from @1 is
moving the subject tombstones before the proposals, satisfying FK edges
`claim/commitment/open_loop.proposal(_normative_basis)_id → proposal`);
self-referential supersedes chains resolved within one statement per
family (validated empirically); the @1 judgment-row closure (challenges
and amendments deleted by id-membership, cross-thread judgment rows
included, counted in the receipt) formally frozen; the precise boundary
(a foreign content record referencing INTO the scope through supersedes
fails the purge closed) retained; prerequisites, typed confirmation,
recorded-mode bounding, one transaction, content-free receipt, best-effort
VACUUM, rollback-no-receipt semantics all unchanged; D1 tombstone null
sets NOT amended; D4 evidence and all prior contracts NOT reinterpreted.
Coverage matrix extended to N-D2-19..24 (ceremony-created purge, closure
receipt, direct-verb compatibility, unrelated-row byte-identity, induced
failure rollback + convergence, post-purge `foreign_key_check` + chain
removal). Amendment text:
`docs/report/QUELLIGHT-STAGE-07D-PHASE-D2-CONTRACT-AMENDMENT-1.md`.
Implementation, coverage, and the focused D5 re-verification request
follow in subsequent entries; Stage 07D remains NOT independently
verified and NOT formally closed; Stage 07E NOT permitted and NOT begun.

## D-07D-16 — D2 safety-contract @2 IMPLEMENTED AND VERIFIED: the deep-purge repair, its permanent non-vacuous coverage, and the L-1 portability repair; AWAITING THE FRESH FOCUSED D5 RE-VERIFICATION

**Date:** 2026-09-24. Implements the frozen Amendment 1 (D-07D-15) per the
owner's remediation instruction. Commit ledger on top of the audited
`ed144b19…`: `559e40a` Amendment freeze (standalone docs);
`b232682` the fix (purge order: originating subject tombstones BEFORE
proposals, derived from the live 20-edge FK graph; contract data @2;
stale version references updated; migration 6's comment kept at @1 —
historical truth); `483fd7c` the coverage (verify:d2 N-D2-19..24, 87
checks; focused `test/d2-deep-purge.test.ts`);
`8e74991` the L-1 repair (repo-root-relative containment in
verify-governance + governed-mutation test; assertion-neutral; separate
bounded commit per the owner's boundary rule); `3503a51` style/type
corrections.

**Evidence:** the defect was reproduced on the audited pre-fix tree
(ceremony-created claim → plus-meaning deletion → raw
`FOREIGN KEY constraint failed`, rollback, no receipt); the repaired
purge removes ceremony-created claim/commitment/open-loop meaning with
truthful receipts (originatingTombstones 6, proposals 4, challenges 1,
amendments 1, corrections 1 in the mixed scenario), removes the
cross-thread challenge and amendment rows by the id-membership closure,
keeps unrelated rows byte-identical (full-store inventory), fails closed
on a foreign correction successor referencing INTO the scope (rollback,
no receipt) and converges after the foreign child leaves through its own
governed path, and leaves `PRAGMA foreign_key_check` clean.
**Non-vacuity:** the new gate and suite were overlaid on a disposable
pre-fix clone (ed144b1): the gate ran 8 red (N-D2-19 with
`cause=ERR_SQLITE_ERROR`), the suite failed 3/4 with the raw FK error;
on the remediated tree both are green. **Battery:** verify:d1/d2/d3/
dev-live/governance, test:node (30 files / 357 tests), typecheck,
format:check, production build, verify:browser-d2 (purge ceremony in the
real browser), `git diff --check` — all exit 0. **Carried truthfully:**
M-1 NOT rewritten; the D4 Layer-B aggregate attestation ruling NOT
altered; L-2/L-3 unchanged (L-3 already repaired in the D5 audit
commit). **Status:** Stage 07D remains NOT independently verified and
NOT formally closed — this remediation awaits the fresh focused
independent D5 re-verification; Stage 07E NOT permitted and NOT begun.
Report: `docs/report/QUELLIGHT-STAGE-07D-PHASE-D2-REMEDIATION.md`.

## D-07D-17 — Stage 07D FORMALLY CLOSED on the fresh focused independent D5 re-verification: VERIFIED WITH NON-BLOCKING ISSUES — CLOSURE PERMITTED; Stage 07E PERMITTED and NOT BEGUN

**Decision (2026-09-24, documentation-only).** The fresh focused independent
D5 re-verification of the D2 deep-purge remediation returned **VERIFIED WITH
NON-BLOCKING ISSUES — STAGE 07D FORMAL CLOSURE PERMITTED** (0 Blocking / 0
High / 1 Medium carried / new non-blocking L-4 and L-5), audited tip
`072430e74874dfb5b1c22c4771f7fc176c2be42d` == `origin/main` after fresh
fetch. The auditor did not implement the remediation and re-derived every
claim independently: the pre-fix B-1 defect was reproduced on a disposable
`60859c4` tree through the real boundaries (raw `FOREIGN KEY constraint
failed`, full rollback, no receipt, direct-verb mask confirmed); the 20-edge
live FK graph was independently re-derived (0 order violations); a 24-probe
real-boundary battery passed (ceremony families, conversation-only
preservation, same-key replay, restart truthfulness, mixed scope with real
amendment/correction/challenge lineage, unrelated-row byte-identity,
fail-closed foreign references with full mid-purge rollback and governed
convergence, `foreign_key_check` clean after success AND failure);
non-vacuity was demonstrated against the pre-fix tree (focused suite 3/4 red
with the raw FK error; `verify:d2` overlay red exactly on N-D2-19..24) versus
green on the remediated tree (87/87 + 4/4); the L-1 repair was confirmed in a
renamed checkout. The authoritative ladder ran on the frozen tip: every
mandated step green (`verify:d2` 87; `test:node` 30 files / 357 tests;
preservation gates q2–q6 and stage7c; consumer; dev-live; governance;
browser-d2; `npm audit --omit=dev` 0 vulnerabilities; `git diff --check`);
`verify:d4-prep`'s single red is the documented by-design active-paths state
(the sealed attempt-2 bundle occupies the canonical paths — refusal
invariant, not a regression); the live provider session was NOT run and D4
was NOT re-executed. **Carried truthfully:** M-1 remains carried (process/
attribution; verified no frozen-contract ambiguity, no executable bypass;
history NOT rewritten); L-2 ruling unchanged; L-3 remains repaired. **New
non-blocking findings:** L-4 — the frozen D5 audit report's own
environment-path quotations deterministically trip `verify:quellight`'s
local-path scan (self-referential: the report entered the tree after that
audit's battery; byte-preservation of historical records vs scan hygiene
requires an owner decision — scan-scope exception for frozen historical
documents or owner-authorized redaction; neither performed here); L-5 — an
intermittent load-sensitive in-sequence browser-ceremony timing flake,
reproduced identically on the pre-fix tree (gate byte-identical since 07C;
same class as the Q7-audit incident recorded in VICT §0.32; standalone runs
green). **Consequence:** Stage 07D is FORMALLY CLOSED
(`docs/report/QUELLIGHT-STAGE-07D-FORMAL-CLOSURE.md`; re-verification report
`docs/report/QUELLIGHT-STAGE-07D-D5-REVERIFICATION.md`). **Stage 07E (the
Stage 07 exit gate) is PERMITTED and NOT BEGUN** — its entry requires its own
owner authorization and contract freeze; no 07E implementation is authorized
by this record. Documentation-only VICT reconciliation registered
separately (VICT v0.4.27, §0.33).

## D-07E-01 — Stage 07E preparation authorized; exit contract FROZEN; L-4 resolved by the owner's hash-bound frozen-evidence exception

**Decision (2026-09-24, owner).** Stage 07E preparation is authorized:
reconcile the Stage 07 exit requirements from the canonical roadmap, freeze the
Stage 07E exit contract, and prepare deterministic exit-gate verification. This
authorizes NO new product feature, NO provider call, NO operator-data access,
NO rewrite of historical evidence, and NO declaration that Stage 07 is closed —
the final Stage 07E audit is performed by a fresh independent session against
the frozen contract.

**L-4 governance decision.** The frozen D5 audit report is preserved
byte-for-byte, and the narrowest defensible scan disposition is implemented:
the `verify:quellight` local-path scan gains exactly one evidence-bound
exception for `docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md`,
bound to its exact content SHA-256
(`169a215369114b443697e68c7974b10d56742196f5bc11912cd7d0a6dd7a41b5`), its exact
Git blob (`d89fad1134e55b5e32e302519219e23085f8ff69`), and its exact
documented match set (exactly two matches of the ten-character Windows
user-directory prefix — JS-escaped here as `C:\\Users\\` to keep this register
scan-clean; registered machine-readably in `scripts/lib/frozen-evidence.mjs` —
on lines 15–16: the auditor's quoted VICT-checkout and frozen-audit-tree
paths). The scanner
must still inspect the file and must report the accepted matches explicitly.
Any byte change, additional match, different file, different path, or new
local-path disclosure must fail. Documentation in general is not excluded; the
credential, canary, fixture-content, operator-data, and privacy scans are not
weakened; the historical report is not redacted or rewritten. Full normative
text: `docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md` §5/§6.1
(contract `quellight.stage07e.exit-contract@1`).

**Consequences:** Stage 07E work proceeds in reviewable order (contract freeze;
narrow L-4 scanner disposition; exit-gate machinery and negative controls;
preparation report/status). Stage 07 remains IN PROGRESS; 07A–07D remain
FORMALLY CLOSED; the final independent Stage 07E exit audit has NOT begun.

## D-07E-02 — Stage 07E L-5 investigation outcome and the gate-script race repair

**Decision (2026-09-24, Stage 07E preparation under the D-07E-01 mandate;
"investigate L-5 only to the degree necessary to make the final audit
trustworthy").** The frozen exit-contract protocol's deterministic trigger
fired: after the preparation's standalone confirmation run failed, three
further fresh runs failed at the IDENTICAL step (`openOldestThreadTray`'s
tray-reopen wait), including a fully serial run with no concurrent load — on a
tree whose `src/` and check script were byte-identical to the 07D-closed tip.
The investigation found a DETERMINISTIC GATE-SCRIPT ACTIVATION RACE, not a
product defect: within every failing run the identical keyboard-activation
succeeded repeatedly through `openTray`, and the failing site delivers
`focus()` + a page-level `keyboard.press()` across the post-thread-switch
re-render cascade, so Enter landed on a detached element.

**Decision:** repair the check script assertion-neutrally and timeout-neutrally
(both chip-activation sites use `locator.press('Enter', { timeout: 20_000 })` —
re-resolve, actionability, focus, press, with Playwright retry on detachment;
the script's own Lane E prior art for the identical Send-button race), re-pin
the amended contract digest in the gate, and retain the fresh-run protocol for
any future browser-gate failure. No timeout was increased; the check was not
suppressed; no product code changed; the keyboard-activation assertion is
unchanged; verified by two consecutive full-completion serial runs (all steps
green, zero console warnings/errors) covering the correction-lineage, memory-
mode, fresh-conversation, responsive/axe, and console-cleanliness steps the
race had been blocking. Full normative text:
`docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md` §8.2 (amended).

**Consequences:** the final independent Stage 07E exit audit runs the repaired
check; the L-5 carried limitation is reclassified truthfully as a repaired
test-machinery defect (not an intermittent product-adjacent flake); Stage 07
remains IN PROGRESS; nothing here declares Stage 07 closed.

**Addendum (same date, same session; concrete evidence: the full-composite run
then failed at the Q6 fresh-conversation Send — the same race class at a site
without a delivery fallback — and one post-repair standalone run still failed
the tray reopen with the open-then-close signature).** The repair program is
completed in two further assertion-neutral, timeout-neutral parts: (1) ALL
turn-send sites now deliver through the shared `deliverSend` helper
(re-resolved locator press; delivery verified by the composer clearing; real
click fallback) — the Lane E pattern the script already used for its main
scenario; (2) the openOldestThreadTray tray reopen uses bounded retries (three
attempts at the standard 20 s bound) with every observed force-close signature
reported truthfully, because the investigation exposed a PRODUCT action-loss
race beneath the flake: the thread-restore continuation sets `memoryOpen =
false` AFTER its fetch resolves, so a tray opened during a slow thread switch
is force-closed — carried as a new Low product finding for future product
work; Stage 07E changes no product code.

**Addendum 2 (same session; evidence: the chip-pending wait failed twice more
through the documented one-shot refresh gap — once standalone, once in the
full composite — even though the turn completed and the proposal was durably
created).** `runScenario` gains a bounded re-present fallback for exactly that
carried gap: if the pending label has not updated after one standard bound,
the page is reloaded (the mount reconcile re-runs `refreshMemory` and
re-presents the durable pending state — the same re-present flow step 4
asserts) and the wait runs once more; the fallback fires visibly in the
output; if the label is still absent after the reload, the pending proposal
itself is missing and the run fails for real. Assertion target unchanged; no
timeout increased; product code untouched.

## D-07E-03 — Stage 07E exit audit EXECUTED by a fresh independent session: STAGE 07 VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED; Stages 07A–07E and Stage 07 FORMALLY CLOSED; no successor stage begun

**Decision (2026-09-24, on the fresh independent Stage 07E exit audit; this
entry records the closure, it does not authorize any new stage).** The audit
(`docs/report/QUELLIGHT-STAGE-07E-INDEPENDENT-AUDIT.md`, audited tree
`cfc6653061f44e4fbdc3d0f2a47850e148e07a25`) re-derived every material
conclusion independently of the preparation: the complete 07A–07D closure
chain, ordering, and absence of rewritten evidence (all nine protected digests
recomputed; last-touch commits equal creation commits); the frozen contract
byte-pin (`f4d7589f…`, amendment-3 state) and the standalone-docs amendment
ordering; the L-4 exception proven fail-closed by the auditor's own temp-copy
probes on top of the gate's held negative controls; the L-5 repairs proven
assertion-neutral (identical timeout literal sets; `src/` byte-untouched
across 07E); both new product Low findings independently located in source and
severity-assessed (A-2 thread-restore force-close action-loss race; A-3
one-shot post-turn chip refresh gap — carried non-blocking, no exit
requirement violated); the stable release identity re-derived from the frozen
13-member algorithm (`v1_1c695280…`) and matched against the live public
registry and VICT's own RELEASE-COMPATIBILITY constant; and the committed
real-use evidence validated structurally without any re-execution. The frozen
§7 authoritative ladder ran on the untouched audit tree with every true exit
recorded: `npm ci`; `verify:consumer` (unreachable-registry control held);
`verify:quellight` ×2 (each exit 1 with EXACTLY one browser-ceremony finding,
at two DIFFERENT steps — Q6 assistant wait, then the Scenario-C post-reload
pending-label wait with the amendment-3 fallback firing visibly; all other
internal steps green including the L-4-accepted scan) — dispositioned exactly
per the frozen §8.2 fresh-run protocol with two fully green standalone
ceremony runs and no step failing twice; `verify:q6` (114); `verify:stage7c`;
`verify:d1` (49) / `d2` (87) / `d3` (35) / `dev-live` / `governance`;
`verify:stage7e` PASS with every negative control held and `verify:d4-prep`
held to its exact by-design single red; `test:node` (first standalone run
356/357 — the documented pre-existing tmpdir-count isolation race class,
disclosed; fresh rerun 30 files / 357 tests green; green in both in-composite
runs — recorded as Low finding A-1); `test:ui` (20); `verify:browser-d2`;
`npm audit --omit=dev` zero vulnerabilities; `git diff --check` clean; VICT
fresh-fetch reconciliation (tip `2c65a4f…`, §0.33, content-ID match).

**Consequences:** Stages 07A–07E and Stage 07 are FORMALLY CLOSED
(`docs/report/QUELLIGHT-STAGE-07-FORMAL-CLOSURE.md`). No numbered "Stage 08"
exists or is begun: the work after Stage 07 is the Quellight product roadmap
(milestones Q2–Q5, Quellight-led, re-entering VICT governance when VICT-side
work is needed), and **the next Quellight increment requires a fresh owner
planning decision** — its numbering, scope, contract, and entry are NOT
authorized by this closure. The current Quellight status surfaces were
reconciled to the closed state in the same documentation commit, and the
`verify:stage7e` status-consistency validator ([3]) was re-keyed, in a
separate following commit, from the pre-closure status truth to the
post-closure status truth (its stale-status negative controls retained and
re-verified green; the contract byte-pin and every other section untouched) —
disclosed here because the alternative was leaving the exit gate knowingly red
against the truthful closed status. All contracts, reports, evidence bundles,
receipts, and historical records — including the preparation report — remain
byte-for-byte preserved.
