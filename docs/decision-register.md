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
