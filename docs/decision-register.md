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

Only exact public registry versions `@victframework/*@0.1.0`
(release identity `vict-release-set@1/0.1.0`, content ID
`v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`).
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
