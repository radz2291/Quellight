# Quellight Stage 07C Phase Q4 — Deterministic Shared World Context Assembly — Implementation Report

```text
STATUS: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
Phase Q4 is NOT independently verified and NOT formally closed.
Phase Q5 implementation has NOT begun.
Stage 07 remains In Progress.
Freeze SHA: b4bf75980a14f74346bdfa59c252c84dadca338e (no amendments; a single freeze commit)
```

This report records the Q4 implementation: per-turn deterministic assembly
of user-confirmed Shared World records into a bounded, call-scoped model
request at the Quellight-owned model seam, with an immutable per-turn
assembly record, no transcript pollution, no new agent capability, and no
live-provider call. It does not claim Q4 closure.

## 1. Repository identity and commits

- Starting point: Quellight `908af92fc14fccdebb85e4130767a014b99b1f87`
  (== origin/main at task start; fetched, fast-forward only). VICT
  `bcaa46ffab9a265164411fa2f97a12cb459160a9` (== origin/main; READ-ONLY
  except the final documentation reconciliation commit; its pre-existing
  untracked `.pi/` untouched).
- Contract freeze commit `b4bf75980a14f74346bdfa59c252c84dadca338e`
  (`docs(stage-07c): freeze Phase Q4 context assembly contract`) — the
  freeze document and `src/lib/sharedworld/context-contract.ts` committed
  ALONE (M-3 discipline honored; no amendment commits were needed, so no
  lane restarts occurred).
- Implementation commits, in order (all lanes started from the freeze):
  - `c9620ad` `feat(stage-07c): add deterministic Shared World context assembly` — Lane A (assembler, migration 3, assembly persistence, L-1 fixes, focused tests).
  - `fb052ba` `feat(stage-07c): inject frozen context at the model seam` — Lane B (model-seam wrapper, server-derived turn correlation, composition wiring at profile revision 3, focused tests).
  - `4cf9e6c` `fix(stage-07c): close carried ceremony UX findings` — Lane C (M-2 Escape-to-close + focus return, D-Q4-6 quiet transparency line, read-only `/api/threads/[id]/assembly` summary route, component tests).
  - `1e07757` `test(stage-07c): verify context authority and replay` — Lane D (independent black-box authority/containment matrix, `verify:q4`, aggregate wiring, plus the two DISCLOSED bounded Q3 re-pins: verify-q2/verify-q3 bookkeeping and assembler-location assertions re-pinned to the amended frozen reality per freeze §12 — assertions strengthened, never weakened — plus a two-line type-only fix in the Lane B test file).
  - `41b9817` `test(stage-07c): extend the ceremony browser proof with stale refusal and Q4 transparency` — Lane E.
  - `bf7fec3` `style(stage-07c): format the extended ceremony browser script` (formatting-only follow-up to Lane E; disclosed).
  - `docs(stage-07c): record Phase Q4 implementation` — documentation lane (this report, README, system reference, decision register).
- Lanes actually used: A (assembly/durability), B (model-seam injection),
  C (quiet transparency + carried UI fixes), D (contract-first adversarial
  verification), E (real-browser evidence), documentation/evidence lane.
  Integration (composition wiring, aggregate verifier wiring) was
  reconciled by the integration owner without a permanent coordinator.

## 2. Migration and assembly schema (freeze §7)

- Migration 3 `qlt-context-assembly` (additive, forward-only;
  `QLT_SHARED_WORLD_SCHEMA_VERSION` now 3): creates
  `qlt_context_assembly` with the frozen 14-column inventory
  (`QLT_CONTEXT_ASSEMBLY_SCHEMA_INVENTORY`): identity (`id`, `turn_id`,
  `thread_id`), provenance (`assembler_version`), outcome (`outcome`
  ∈ complete/empty/failed), selection (`selected_ids`, `excluded`,
  `ordering_identity`), budgets (`max_records`, `max_bytes`,
  `rendered_bytes`), integrity (`fingerprint`), failure
  (`failure_code`, NULL unless failed — CHECK enforced), time
  (`created_at_ms`). `turn_id TEXT NOT NULL UNIQUE` (exactly one durable
  assembly per logical turn); index `uq_qlt_context_assembly_turn`
  (UNIQUE) + `idx_qlt_context_assembly_thread` (thread, created_at_ms);
  FK `thread_id` → `qlt_thread(id)`; bounded evidence sizes enforced in
  the persistence path. `verify:q4` introspects a live store against the
  frozen inventory and proves the UNIQUE and CHECK enforcement.

## 3. Selection layers, ordering, budgets (freeze §3/§4)

- Eligibility: only the three candidate families (`claim`, `commitment`,
  `open_loop`) with eligible status, no successor (current-effective),
  structurally valid provenance/identity, parseable content matching the
  stored content fingerprint. Proposals (all statuses) and correction
  rows are structurally excluded; only the current-effective successor of
  a correction may enter; elapsed time alone never changes eligibility.
- Layers (D-Q4-3; `sourceThreadId` is provenance, never scope):
  current-thread → global (threadless direct-Save) → other-thread.
  Within a layer: open_loop → commitment → claim. Within each class:
  `updatedAt DESC, id ASC` (L-1).
- Budgets: max 8 records; max 4096 UTF-8 bytes for the whole rendered
  block; whole-record skipping (a non-fitting record is skipped whole and
  the deterministic tail is excluded `budget`); bounded per-family scan
  (200) and bounded exclusion evidence (64 entries; id/kind/reason only —
  never content, never secrets).
- Exclusion codes (closed frozen vocabulary): `ineligible`, `superseded`,
  `retention-ineligible`, `provenance-invalid`, `integrity-failed`,
  `conflict-ambiguous`, `budget`, `evaluation-failed`. Structurally
  ambiguous duplicate-current groups (exact `subject` for claims/open
  loops, exact `commitmentKey` for commitments) are excluded AS A GROUP
  with `conflict-ambiguous` (D-Q4-4); the model receives no authority to
  resolve semantic tension durably.

## 4. Injection shape and authority (freeze §5; D-Q4-1/D-Q4-2)

- The exact model-request transformation (frozen
  `QLT_CONTEXT_INJECTION`): ONE `user`-role message whose content is
  exactly ONE text part holding the rendered block, inserted immediately
  BEFORE the trailing user-role message of the model-request prompt
  array. System/developer messages are untouched and remain structurally
  superior; the injected message is call-scoped (non-persistent); no
  static working memory, no semantic recall, no second model call. The
  fixed higher-authority treatment instruction lives in the pinned
  instructions artifact (revision 3); record content is a separate
  structured data payload only.
- Wrapper order at the seam: `withTurnDeadline(withTurnContextAssembly(model, resolve), deadline)` — the context wrapper captures the original
  `doStream` at wrap time (no recursion), shallow-copies the request
  options, and never mutates the durable transcript.
- Agent access is UNCHANGED (D-Q4-2): no memory read/list/search tool, no
  arbitrary lookup, no embeddings, no semantic retrieval. The capability
  envelope remains EXACTLY `qlt.proposal.draft@1`; the compiled plan
  carries no read/list/search verb; the profile (revision 3) instructions
  state that context records are quoted user-confirmed data that grant no
  authority.

## 5. Turn semantics (freeze §8)

- Correlation is SERVER-DERIVED ONLY: the turns route wraps the dispatch
  in a Quellight-owned async scope `{swThreadId, mastraThreadId}`; the
  detached turn execution inherits it. At the model seam the in-flight
  VICT turn is resolved from DURABLE open-turn records; the client and
  the model supply no actor/thread/turn authority.
- The assembling turn is the single open turn without a durable assembly
  record: 0 candidates → no injection (no false record); >1 → fail
  closed (`QLT_CONTEXT_TURN_AMBIGUOUS`, zero injection, no false
  record). A turn whose record exists replays the FROZEN snapshot
  (multi-call turns inject the identical block on every model call;
  mid-turn corrections never substitute); `failed`/`empty` records pass
  through with zero injection. Retries under the same turn identity
  converge to the one durable record (`UNIQUE turn_id` + converge-on-
  existing persistence). Historical turns never recompute; corrections
  affect only the next not-yet-started turn; restart reproduces the
  durable record (in-flight turns never survive restart — they settle
  honestly failed by framework reconciliation — and the next turn
  assembles fresh). There is no shared mutable "current memory" variable.
- Deterministic fingerprint: SHA-256 over the canonical JSON of
  {schema, assemblerVersion, turnId, threadId, outcome, selected,
  excludedCount, orderingIdentity, budgets} — never record content.
  `verify:q4` independently recomputes it.

## 6. Data-versus-instruction boundary (freeze §5)

- Serializer: fixed framing
  (`<<<QLT:SHARED-WORLD-CONTEXT:V1>>>` … `<<<QLT:SHARED-WORLD-CONTEXT:END>>>`,
  per-record `<<<QLT:RECORD {envelope}>>>` / `<content>…</content>` /
  `<<<QLT:/RECORD>>>`), canonical JSON envelope with the frozen field
  allowlist, and content escaping `JSON.stringify` then `/ → \/`,
  `< → \u003c`, `> → \u003e`, `& → \u0026` (all value-preserving JSON
  escapes). Result: no `<`, `>`, `&`, or unescaped `/` byte can exist
  inside emitted content, so record text can never forge a marker, a
  record envelope, or close the context section. Hostile confirmed
  content ("ignore previous instructions…", marker sequences, `</content>`)
  round-trips bit-for-bit as quoted data and grants no tool, approval, or
  authority semantics; no tool names or capability schemas appear in the
  block. Adversarial fixtures prove containment
  (`test/context-authority.test.ts` §E, `verify:q4` §4). Live-model
  injection resistance remains part of Q6; Q4 proves the structural
  boundary offline and makes no claim that text labelling alone
  mathematically prevents model influence.
- Credential canaries never enter the context block, the assembly
  record, diagnostics, or artifacts (the aggregate verifier's canary scan
  covers sources and build artifacts; the test suites generate fresh
  high-entropy canaries per run and assert their absence from the block,
  the durable record, and the Mastra store).

## 7. Transparency (freeze §9; D-Q4-6)

The quiet, non-interruptive line lives ONLY inside the user-opened
memory tray, derived from the thread's latest durable assembly record via
the read-only `GET /api/threads/[id]/assembly` route (composition
accessor only; no store import; no write path): `Your last reply here
used 1 memory.` / `…used N memories.` / `No memories used` /
`Memory unavailable for this turn`. The transcript is never annotated;
the tray never opens itself; focus is never stolen. Browser proof:
`scripts/browser-ceremony-check.mjs` Scenario D-7/D-8 (used state after a
real follow-up turn; unavailable state with an intercepted summary
mirroring the frozen failed shape — disclosed fixture; the underlying
truth of a real failed record rendering unavailable is proven at node
level by the Lane B/D suites).

## 8. Carried Q3 findings — dispositions (freeze §10–§12)

- **M-2 (Escape-to-close): CLOSED.** A real Escape keydown inside the
  tray closes it; focus returns to the memory chip; the composer is
  unaffected. Component tests use a real `KeyboardEvent`
  (`test/ui/memory-inbox.test.ts`); the real browser proves it
  (ceremony Scenario M-2). The Q3 misleading test comment was replaced
  with a truthful one.
- **M-3 (freeze discipline): HONORED.** The freeze commit contains only
  the freeze document and the frozen contract module; no Q4 amendment
  was required, so no amendment commit exists; no implementation shares
  an amendment commit.
- **L-1 (ordering/query surface): REPAIRED.** Every unified record
  listing orders `updatedAt DESC, id ASC` (`ORDER BY updated_at_ms
DESC, id ASC` verified in the store and pinned by tests); the accepted
  query-sort surface is restricted to exactly `updatedAt`
  (`QLT_CONTEXT_QUERY_SORT_FIELDS`; `ceremony-actions.ts` rejects other
  sort fields). Q3 historical reports and frozen documents were NOT
  rewritten; this correction is recorded here and in the freeze.
- **L-2 (real-browser stale refusal): PROVEN.** The existing ceremony
  browser script was EXTENDED (no fourth browser boot): a real governed
  correction through the UI (`act.correctRecord` over `/api/act`) makes
  the seeded pending correction proposal's target stale; a hard reload
  re-presents it as stale ("out of date"); the unchanged confirm visibly
  fails with `QLT_PROPOSAL_STALE`; zero canonical effect occurs (no new
  record, correction lineage unchanged). Disclosed fixture boundary:
  production wires no pending-correction path (the pinned capability
  rejects `proposalKind: 'correction'`; Q2-frozen), so the pending
  correction proposal is seeded directly into the disposable store by
  the script; the staleness CAUSE and the REFUSED CONFIRMATION both
  cross the real governed boundary.
- **L-3 (Git-derived inventory): IMPLEMENTED.** This report's inventory
  below is derived directly from Git; `verify:q4` independently re-derives
  `git diff --numstat <freeze-sha>..HEAD` (the freeze SHA itself is
  re-derived from Git by commit-title grep) and compares it with the
  report block; any mismatch fails the gate. No manual counting.
- **M-1 (framework obligation): RECORDED, deadline unchanged.** The
  false `read` effect-class metadata is not accepted as a final state;
  the owed VICT change (truthful noncanonical/proposal effect class or
  equivalent framework-native abstraction; new immutable package set;
  Quellight repin + fresh compatibility proof) is recorded in the freeze
  (`QLT_M1_FRAMEWORK_OBLIGATION`), the system reference, the decision
  register, and this report. **Hard deadline: before the Phase Q6
  live-provider proof, and therefore before the Stage 07C final audit.**
  No VICT package, manifest, or code was modified in Q4.
- **Q3 §12 deferral (agent-originated correction proposals): remains
  deferred beyond Q4** (D-Q4-2 — the capability envelope is unchanged;
  the pinned capability still rejects `proposalKind: 'correction'`).

## 9. Assembly failure behaviour

If assembly cannot be evaluated: zero Shared World records are injected,
the conversation turn CONTINUES, a truthful `failed` assembly record
(with the stable non-echoing `QLT_CONTEXT_ASSEMBLY_FAILED` code) is
durably persisted, and the tray shows the quiet `Memory unavailable for
this turn` state. Model-seam identity ambiguity fails closed
(`QLT_CONTEXT_TURN_AMBIGUOUS`, zero injection, no false record). Nothing
partial is ever fabricated.

## 10. Verification containment and results

- Focused gates during lanes: `verify:q2` (179 checks, re-pinned to
  migration bookkeeping `[1,2,3]` and schema version 3 — disclosed,
  strengthening), `verify:q3` (33 checks; the "no assembler exists"
  isolation pin re-pinned to "assembler exists ONLY in the frozen
  location" — disclosed, strengthening), the full node suite (194 tests
  incl. the Lane A/B/D matrices), the UI suite (15 tests).
- Aggregate containment (`verify:quellight`): 1 format check; 2 typecheck;
  2b verify:governance; 2c verify:q2; 2d verify:q3; **2e verify:q4 (new —
  contract data, live schema introspection, fingerprint parity, retry
  convergence, budgets, adversarial containment, durable round-trip,
  Git-derived inventory comparison, wiring)**; 3 node tests; 4 UI tests;
  5 production build + closed-allowlist warning scan; 6 browser-check;
  6b browser-stop-check; 6c the EXTENDED ceremony browser check; 7
  credential/canary/local-path artifact scan; git hygiene. No
  live-provider check exists in or after the ladder. Diagnosed failures
  during lane development (all diagnosed and fixed, never silently
  rerun): two test-side expectation errors in the Lane D suite (id-ASC
  tie-break; budget sizing), one verifier-side expectation error (layer
  order), and the Lane E findings listed in §11.
- The authoritative final ladder (run exactly once on the frozen tree,
  in the documented order) and its per-step results are recorded in §13.

## 11. Browser evidence (Lane E; existing script EXTENDED — no fourth boot)

`scripts/browser-ceremony-check.mjs` (TEST-1) now also proves, against
the production build with the deterministic offline fixture:

- the L-2 stale-refusal chain (Scenario D, see §8);
- M-2: a real Escape key closes the tray with focus on the memory chip;
  the composer is unaffected;
- the Q4 quiet usage line renders `Your last reply here used 1 memory.`
  after a real follow-up turn, and `Memory unavailable for this turn`
  with an intercepted failed summary (disclosed fixture boundary);
- the conversation is never interrupted (composer enabled throughout;
  the tray never auto-opens);
- the Q3-era proofs remain green (chip counts, keyboard-only ceremony,
  reject/withdraw zero-effect, hard-reload convergence, axe clean in
  both viewports, zero console warnings/errors).
  One Q3-era flake was diagnosed and fixed in the script itself (the
  thread-creation re-render could swallow the Send activation; the send is
  now confirmed by the composer clearing, with a re-resolved click as the
  fallback) — disclosed as a script robustness fix, not a product change.

## Changed-file inventory (Git-derived)

Derived with `git diff --numstat <freeze-sha>..HEAD` against the freeze
SHA `b4bf75980a14f74346bdfa59c252c84dadca338e` (verify:q4 re-derives and
compares this block exactly; tab-separated numstat columns are
normalized to single spaces here and by the verifier):

```text
42 5 README.md
49 4 docs/decision-register.md
370 0 docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTEXT-ASSEMBLY-IMPLEMENTATION.md
39 4 docs/system-reference.md
2 1 package.json
344 0 scripts/browser-ceremony-check.mjs
8 4 scripts/verify-q2.mjs
11 2 scripts/verify-q3.mjs
804 0 scripts/verify-q4.mjs
9 0 scripts/verify-quellight.mjs
88 1 src/lib/islands/ConversationWorkspace.svelte
58 9 src/lib/server/composition.ts
154 2 src/lib/server/model-seam.ts
1 1 src/lib/server/runtime.ts
13 3 src/lib/sharedworld/ceremony-actions.ts
757 0 src/lib/sharedworld/context-assembler.ts
41 0 src/lib/sharedworld/migrations.ts
233 3 src/lib/sharedworld/sqlite.ts
43 0 src/routes/api/threads/[id]/assembly/+server.ts
24 6 src/routes/api/threads/[id]/turns/+server.ts
696 0 test/context-assembly.test.ts
987 0 test/context-authority.test.ts
465 0 test/context-injection.test.ts
12 3 test/meaning-foundation.test.ts
4 1 test/sharedworld.test.ts
82 3 test/ui/memory-inbox.test.ts
```

## 13. Final verification ladder

Run exactly once on the frozen tree after the documentation commit:

```text
npm ci                 → (recorded below after the run)
npm run verify:consumer → (recorded below after the ladder run)
npm run verify:quellight → (recorded below after the ladder run)
npm audit --omit=dev   → (recorded below after the ladder run)
```

This section is completed with the exact first-run results immediately
after the ladder executes (no reruns, no timeout changes, no weakened
assertions).

## 14. Genuine limitations

- Live-model prompt-injection resistance is NOT proven by Q4; Q6 owns it.
  Q4 proves the structural boundary (escaping/containment, data-only
  framing) offline.
- The L-2 pending-correction proposal is a script-seeded fixture
  (disclosed); production wires no agent- or user-originated pending
  correction path.
- The unavailable transparency state is rendered in the browser with an
  intercepted summary mirroring the frozen failed shape; a real failed
  assembly record rendering unavailable is proven at node level.
- The agent still has no read/list/search access and no way to inspect
  record-by-record context (full inspection UI remains Q5).
- `@victframework/*@0.2.0` remains pinned EXACTLY (verify:consumer and
  the pins gates assert it); the M-1 effect-class correction is recorded
  but not implemented (hard deadline per §8).
- Q4 is not independently verified and not formally closed; Q5 has not
  begun.

## 15. Independent-audit readiness

Every semantic assertion above is backed by an independently inspectable
negative control: the Lane D black-box matrix
(`test/context-authority.test.ts`, 34 tests) derives expectations from
the FROZEN contract data rather than implementation internals;
`verify:q4` re-derives the fingerprint, re-introspects the live schema,
re-runs adversarial containment, and re-derives the changed-file
inventory from Git; the Lane B suite proves the injection shape,
non-persistence (Mastra store byte-scan), frozen replay, cross-thread
attribution, and empty/failed pass-through at the composition level;
the Lane E script proves the browser surfaces. The frozen contract
module (`context-contract.ts`) is data-only and shared by all lanes.

## 16. FastGate feedback

The lane split worked well; the assembler's pure evaluator made the
black-box matrix cheap. Two frictions worth recording: (1) the
migration-additive re-pin was foreseeable at freeze time and could have
been pre-declared per-assertion instead of discovered during Lane D
(disclosed anyway); (2) browser-scenario determinism required three
script-side robustness fixes (thread ordering by durable title, send
activation confirmation, tray re-open idempotence) — future ceremony
work should budget for UI-async races explicitly.
