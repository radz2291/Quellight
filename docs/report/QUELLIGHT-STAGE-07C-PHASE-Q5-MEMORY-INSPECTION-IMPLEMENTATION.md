# Quellight Stage 07C — Phase Q5 — Shared World Inspection and User Memory Control — Implementation Report

```text
STATUS: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
Phase Q5 is NOT independently verified and NOT formally closed.
Phase Q6 implementation has NOT begun.
Stage 07 remains In Progress.
Freeze SHA: e2d84369bf31822762329cbb95ee9ee5b6eb02db (single freeze commit; no Q5 amendments)
Executable verification SHA: a2d1f2725694ff28751835148db789ad7e8173d2 (the tree the authoritative ladder ran on)
```

This report records the Q5 implementation: the existing Shared World made
understandable and controllable by the user — read-only inspection
(`qlt.inspection@1`), the four-area quiet Memory surface, lifecycle
controls in the UI, one durable global Memory Mode (Q5-OD-1) with
admission-bound per-turn policy evidence, the narrow L-3 repair, and the
permanent zero-warning development-start gate. It gives the agent NO new
capability: the envelope remains EXACTLY `qlt.proposal.draft@1`. It does
not claim Q5 verification or closure.

## 1. Repository identity and commits

- Starting point: Quellight `587e3b4dcd7f94807e64a05f8e8bf32d4534b62a`
  (== origin/main at task start; fetch-verified; clean tracked state;
  linear ancestry). VICT `4b9fed21430787a72eda76b1b72d448f234f05fa`
  (== origin/main; READ-ONLY — untouched, unread beyond its committed
  state; the pre-existing untracked `.pi/` material preserved untouched).
- Contract freeze commit
  `e2d84369bf31822762329cbb95ee9ee5b6eb02db`
  (`docs(stage-07c): freeze Phase Q5 Shared World inspection contract`) —
  the freeze document, the frozen declarative modules
  `src/lib/sharedworld/policy-contract.ts` and
  `src/lib/sharedworld/inspection-contract.ts`, and the dated Q4
  amendment Q4-AMEND-1 committed ALONE, before any consuming
  implementation (no Q3-M-3 repeat; no Q5 amendment commits were needed,
  so no lane restarts occurred).
- Implementation commits, in lane-DAG order, all from the freeze SHA:
  - `bb3a20d` `feat(stage-07c): add memory mode policy, scoped assembly,
and L-3 repair` — Lane A (migration 4, the policy store and typed
    resolver, assembler mode consumption + `scope-excluded` + off
    handling + per-turn policy evidence, store-level inspection reads,
    the narrow L-3 repair, mechanical forced wiring, focused suite
    `test/memory-policy.test.ts`, and the disclosed assertion-neutral
    test re-pins forced by the Lane A changes).
  - `686c3b7` `feat(stage-07c): compose the inspection and memory-mode
application surfaces` — Lane B (`qlt.inspection@1` and
    `qlt.memory-policy@1` surfaces, the two declared actions (19 → 21),
    ingress schema, admission-scoped policy binding in the composition,
    data-port branches, scope install moved out of the turns route).
  - `8a080c3` `feat(stage-07c): build the four-area user-controlled
Memory workspace` — Lane C (four-area Memory surface + Memory Mode
    control + always-present chip + the three Svelte warning repairs +
    rewritten UI tests; `verify:dev-start` flipped to the zero-warning
    gate), followed by two formatting-only commits
    (`60064ed`, `856248f`, disclosed).
  - `9073c14` `test(stage-07c): verify memory policy, inspection
authority, and mode control` — Lane D (the independent black-box
    suite `test/memory-authority.test.ts`, `scripts/verify-q5.mjs`,
    `verify:q5` wiring into package.json and the aggregate, and the
    disclosed bounded reconciliation re-pins of verify-q2/q3/q4 and two
    Q3-era tests).
  - `a2d1f27` `test(stage-07c): extend the ceremony browser session with
the Q5 scenarios` — Lane E browser evidence (extended ceremony
    session; the assembly summary route forwards the applied
    `memoryMode`).
- Lanes actually used: A, B, C, D, E, landed sequentially on one
  branch (the single-agent integration reality; each commit honors the
  freeze §14 ownership map — with ONE recorded adjustment: all
  store-level SQL, including the bounded inspection READ accessors,
  is Lane A's, so Lane B consumes Lane A's committed accessors; and
  Lane A carried the assertion-neutral test re-pins its own type change
  forced, while the verify-q2/q3/q4 script re-pins stayed with Lane D as
  mapped — those focused gates were knowingly red between Lane A's and
  Lane D's commits and green from Lane D onward).
- Documentation commit: this one (documentation/evidence only; no
  executable content).

## 2. Frozen contract artifacts

- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md` (§0–§21).
- `src/lib/sharedworld/policy-contract.ts` — mode identities
  (`across-conversations` default / `per-conversation` / `off`), policy
  identity `qlt.memory-mode@1`, migration 4 inventory, per-turn evidence
  shape, stable codes, transparency off-state string, authority delta,
  structural invariants.
- `src/lib/sharedworld/inspection-contract.ts` — `qlt.inspection@1`,
  the closed five-op query vocabulary, buckets, bounds, the six usage
  states, origin labels, tombstones, stable codes, never-contains list,
  invariants.
- `src/lib/sharedworld/context-contract.ts` — Q4-AMEND-1 (2026-09-20):
  `scope-excluded` added to the frozen exclusion vocabulary;
  `QLT_CONTEXT_ASSEMBLER_VERSION` `q4-1` → `q5-1`. The fingerprint
  ALGORITHM is unchanged (the version is a frozen input value; the
  amendment predates every consuming implementation commit).

## 3. What Q5 delivers (all frozen behavior implemented)

- **Migration 4** (`qlt-memory-mode-policy`, additive forward-only):
  `qlt_memory_policy` (the durable product-default singleton; closed
  mode CHECK; monotonic revision; `updated_by GLOB 'actor-*'`) and
  `qlt_turn_memory_policy` (immutable per-turn applied-policy evidence;
  `turn_id` PRIMARY KEY; INSERT-or-converge; never updated). Q2/Q3
  tables untouched; the Q4 assembly family untouched; the Q4 fingerprint
  algorithm NOT modified to encode the mode.
- **One typed policy resolver** (`memory-policy.ts`): the SINGLE
  resolution boundary (the future project-scope extension seam, §10).
  Lazy default seed inside one transaction; value-idempotent `setMode`
  with revision bump on effective change; agent identities refused;
  invalid modes fail closed and non-echoing (`QLT_MEMORY_MODE_INVALID`,
  with the durable CHECK as the third fence).
- **Admission-bound turn policy** (freeze §7): the composition resolves
  the durable policy INSIDE the per-conversation admission critical
  section and carries it immutably in the turn assembly scope; the
  immutable per-turn evidence row is written at first assembly BEFORE
  evaluation. A mode change while a reply is active can never rebind or
  reinterpret that turn. The current setting never reinterprets history:
  Used-for-reply reads the per-turn evidence (pre-policy turns report
  `unrecorded` truthfully).
- **Assembler mode consumption**: `across-conversations` preserves Q4
  behavior byte-for-byte (parity-proven); `per-conversation` keeps only
  the current-thread layer and records truthful bounded
  `scope-excluded` evidence (never emitted under across);
  `off` performs zero injection with a truthful empty assembly outcome
  plus the policy evidence (an off turn is never misreportable as
  "no memory existed"). Budgets, ordering, replay, restart, and failure
  behavior are unchanged.
- **`qlt.inspection@1`** (read-only, exposed ONLY through the released
  read boundary): `listRecords` (pending/current/history buckets,
  deterministic `updatedAt DESC, id ASC`, bounded pagination 50/100),
  `getRecord` (provenance links + append-only correction lineage),
  `listTurns` (bounded completed-assembly listing, newest first),
  `getTurn` (immutable per-turn detail: usage state, applied policy from
  evidence, selected records in injection order with historical content
  or truthful `unavailable`/`removed` tombstones, humanized bounded
  exclusions with truncation disclosure, details disclosure),
  `getPolicy`. Server-resolved actor; agent identities refused; no
  system prompts, capability schemas, context envelope, rendered block,
  provider data, or credentials in any output; no durable effect from a
  read.
- **`qlt.memory-policy@1`** with exactly ONE mutation (`setMode`) —
  `act.setMemoryMode`, user-attributed, keyed idempotent through the
  released boundary (same-key retries replay; same-key different payload
  conflicts).
- **The four-area Memory surface** (quiet interaction law unchanged):
  Pending (Confirm/Edit/Reject/Withdraw; stale stays visibly out of
  date; unchanged confirmation refuses truthfully), Current (human
  kind, current content, origin labels, timestamps, and Correct /
  Retire claim / Release commitment / Resolve / Abandon (reason
  required) / Transform (reason required)), History (inspect-only;
  what ended each row, reasons, deciding user, successor relationship,
  timestamps, Details disclosure), Used for reply (bounded chooser;
  recorded evidence only; never recomputed). Desktop side tray;
  responsive narrow-screen non-modal sheet; Close and real Escape
  (window-level) return focus to the chip; the conversation and composer
  stay fully usable while the surface is open. The Memory chip is ALWAYS
  present for an open thread, with a pending count only when applicable.
- **The quiet transparency line** gains exactly one frozen state:
  `Memory was off for your last reply here.` (Q4's used/none/unavailable
  strings unchanged).
- **L-3 repaired narrowly** (freeze §12): the confirmation loop no
  longer rewrites the correction successor's thread/turn source links;
  correction-kind confirmation succeeds with exactly one successor and
  exactly one applicable source link; `proposed-from` still written
  once; replay converges; conflicts and stale targets fail with zero
  partial effects; predecessor bytes unchanged; lineage append-only; the
  capability still rejects `proposalKind: 'correction'`; no UI bypass of
  the user correction action.
- **Zero-warning development-start gate** (freeze §13): the three
  D-11 deferred warnings repaired (redundant `role="region"` removed;
  Escape moved to a window-level keydown; `chipButton` via `$state`);
  `verify:dev-start` now expects ZERO project Svelte warnings and fails
  on EVERY warning; the known cosmetic dev-only sourcemap notice (D-11)
  remains a separately recorded optional external-tool notice.
- **Action inventory 19 → 21**: `act.queryInspection` (query,
  `qlt.inspection`) and `act.setMemoryMode` (mutation,
  `qlt.memory-policy`, contract `qlt.memory-policy.setMode.input`);
  everything else unchanged; `bindings.capabilities` stays empty.

## 4. Verification evidence (authoritative ladder; first-run green)

The exact sequence of freeze §15, run on the clean committed tree at
`a2d1f2725694ff28751835148db789ad7e8173d2`:

```text
npm ci                       PASS (after terminating a leftover `npm run dev`
                             process from the D-11 investigation that held
                             Windows file locks on esbuild/libsql artifacts;
                             disclosed environment incident, no tree change)
npm run verify:consumer      PASS
npm run verify:quellight     PASS (exit 0), containing in order:
  format:check               PASS
  typecheck                  PASS
  verify:governance          PASS
  verify:q2                  PASS (179 checks; disclosed bookkeeping/plan re-pins)
  verify:q3                  PASS (34 checks; disclosed 19+2 inventory re-pin)
  verify:q4                  PASS (41 checks; disclosed Q4-AMEND-1 re-pins)
  verify:dev-start           PASS (ZERO project Svelte warnings expected and observed)
  verify:q5                  PASS (71 checks)
  test:node                  PASS (234 tests, 16 files)
  test:ui                    PASS (20 tests, 3 files)
  build + build-log scan     PASS (only the closed-allowlist notices)
  browser-check              PASS (N-17/N-19 baseline; axe; responsive)
  browser-stop-check         PASS (F-1 Stop regression incl. old-commit control)
  browser-ceremony-check     PASS (the EXTENDED session: all Q3 + Q4 + Q5
                             scenarios; axe serious/critical zero with the
                             Memory surface open on desktop and mobile; no
                             horizontal overflow; zero console warnings/errors)
  credential/canary scan     PASS (211 files)
  git diff --check           PASS
npm audit --omit=dev         PASS (0 vulnerabilities)
git diff --check             PASS
```

No failure was rerun silently; no timeout was increased; no assertion
was weakened. The single ladder-blocking incident (Windows EPERM on
`npm ci` caused by a leftover dev-server process outside the
repository's lifecycle) was diagnosed, disclosed above, and resolved by
terminating that process; it produced no repository change.

## 5. Changed-file inventory (Git-derived; freeze SHA `e2d8436..a2d1f27`)

FREEZE-SHA: e2d84369bf31822762329cbb95ee9ee5b6eb02db
EXECUTABLE-VERIFICATION-SHA: a2d1f2725694ff28751835148db789ad7e8173d2
FILES: 32
INSERTIONS: 5927
DELETIONS: 462

```text
package.json +2 -1
scripts/browser-ceremony-check.mjs +245 -20
scripts/verify-dev-start.mjs +22 -37
scripts/verify-q2.mjs +25 -11
scripts/verify-q3.mjs +14 -2
scripts/verify-q4.mjs +12 -5
scripts/verify-q5.mjs +884 -0
scripts/verify-quellight.mjs +12 -2
src/lib/application/definition.ts +43 -1
src/lib/islands/ConversationWorkspace.svelte +1030 -182
src/lib/server/application-server.ts +12 -3
src/lib/server/composition.ts +132 -4
src/lib/sharedworld/context-assembler.ts +112 -5
src/lib/sharedworld/inspection-surface.ts +607 -0
src/lib/sharedworld/meaning-store.ts +20 -7
src/lib/sharedworld/memory-policy-surface.ts +154 -0
src/lib/sharedworld/memory-policy.ts +319 -0
src/lib/sharedworld/migrations.ts +46 -0
src/lib/sharedworld/sqlite.ts +611 -0
src/routes/api/threads/[id]/assembly/+server.ts +5 -0
src/routes/api/threads/[id]/turns/+server.ts +22 -19
test/ceremony-authority.test.ts +8 -3
test/context-assembly.test.ts +19 -4
test/context-authority.test.ts +3 -1
test/context-injection.test.ts +12 -6
test/meaning-foundation.test.ts +8 -4
test/memory-authority.test.ts +664 -0
test/memory-policy.test.ts +396 -0
test/sharedworld-meaning.test.ts +10 -2
test/sharedworld.test.ts +8 -1
test/turn-overlap-isolation.test.ts +47 -5
test/ui/memory-inbox.test.ts +423 -137
```

(Re-derivable with `git diff --numstat e2d8436..a2d1f27`; the Q4
`verify:q4` inventory gate remains anchored to the Q4 audited tree and
is unaffected.)

## 6. Disclosed boundaries and limitations

- The Q4 amendment Q4-AMEND-1 was committed INSIDE the Q5 contract-freeze
  commit per the owner's explicit Q5 instruction (never bundled with
  consuming implementation; all lanes started from the amended SHA).
- One lane-map adjustment (freeze §14): all store-level SQL (policy,
  per-turn policy, and inspection READ accessors) is Lane A's; Lane B
  consumes the committed accessors. Recorded because the file graph made
  the original split unsafe.
- Lane A's commit carried assertion-neutral re-pins to existing tests
  that its type change forced (scope construction, migration
  bookkeeping, assembler version); the verify-q2/q3/q4 script re-pins
  stayed in Lane D per the map, leaving those focused gates red between
  Lane A and Lane D (the Q4 pattern).
- svelte@5.57.0 + happy-dom render `{#each}` fragments unreliably when
  an `{#if}` branch template starts with a comment anchor; each tab
  area therefore wraps its content in a plain `<div>` (presentation-
  neutral; component- and browser-proven).
- The browser mid-turn containment scenario proves containment for any
  change issued after the send's admission (the stream has started ⇒
  admission has completed); true in-flight binding is additionally
  proven at node level (the admission critical section resolves the
  policy; the scope value is immutable; the evidence row converges).
- Retention-removed tombstone rendering is proven against a disclosed
  store-level fixture (no production path sets record-level
  `user-removed` in Q5; full retention enforcement remains 07D).
- Carried obligations unchanged: M-1 (the truthful VICT effect-class
  correction + repin) remains open with its hard deadline BEFORE the
  Phase Q6 live-provider proof and the Stage 07C final audit; L-R1/L-R2
  carried with dispositions; the Q3 §12 correction-proposal deferral
  remains (the capability still rejects corrections).
- L-3 is repaired in Q5 as frozen (§12/§13 here and freeze §12); the
  repair is production code plus regression coverage, with the
  disclosed seeding-fixture boundary for pending-correction proposals
  unchanged from Q4.

## 7. Status

Phase Q5 is recorded EXACTLY as `IMPLEMENTED — AWAITING INDEPENDENT
VERIFICATION`. It is not Verified and not formally closed; no `QLT-*`
requirement is promoted. Phases Q6–Q7 have not begun. VICT remains
pinned at the immutable `@victframework/*@0.2.0` set and was not
modified. Stage 07 remains In Progress.
