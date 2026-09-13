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
