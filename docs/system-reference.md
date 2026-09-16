# Quellight system reference — Stage 07B/07C

## Status (current, 2026-09-16 — Phase Q4 verified with one High finding; H-1 remediated; awaiting fresh independent re-verification)

```text
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q1: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q2: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (durable Shared World schema)
Stage 07C Phase Q3: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (governed confirmation ceremony and quiet memory inbox)
Stage 07C Phase Q4: VERIFIED WITH ONE HIGH FINDING (H-1) — H-1 REMEDIATED — AWAITING FRESH INDEPENDENT RE-VERIFICATION (deterministic Shared World context assembly)
Stage 07C Phases Q5–Q7: NOT BEGUN (Q5 implementation has not begun)
Stage 07:  IN PROGRESS (07A closed; 07B closed; Q1 closed; Q2 closed; Q3 closed; Q4 verified with one High finding, H-1 remediated, awaiting fresh independent re-verification; Q5–Q7, 07D, 07E remaining)
```

- The retained dependency is now the immutable coordinated release set
  `@victframework/*@0.2.0` (`vict-release-set@1/0.2.0`, content ID
  `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`),
  adopted in Phase Q1 through the controlled compatibility change D-10
  (independently re-derived from the public registry; see
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md`).
  Phase Q1 is independently verified (verdict `VERIFIED WITH
NON-BLOCKING ISSUES — PHASE Q1 FORMAL CLOSURE PERMITTED`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`)
  and FORMALLY CLOSED
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md`; VICT
  constitutional closure at `0f4f72b0812bdfa40229a170f4d97e9696f72dd9`,
  System Reference v0.4.13, §0.21). The prior sets (`0.1.0`, `0.1.1`)
  remain published and installable but are not adopted; any later change
  requires an explicit compatibility decision and fresh verification.
- The F-8 `app.data.mutate` payload gap (entry gate D-9) was resolved by
  VICT Stage 07C Phase F2/F3 and closed by the Phase Q1 adoption:
  thread mutations now cross the released governed mutation envelope.
  The historical Stage 07B `/api/act` direct-adapter accommodation is
  retired; `/api/act` is a thin transport ingress (D-10). The retired
  parallel mutation shortcut is removed and permanently gated.
- Phase Q1 is formally closed against the independent verification.
  Phase Q2 — the durable Shared World schema foundation — is
  independently verified (2026-09-16; verdict `VERIFIED WITH
NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`, audit commit
  `95f03699572b7597be0bbe933964f0207e549c44` against the audited
  implementation SHA `9076fb0dbfdb15beeebef64adaa4f699ba9b60b5`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`)
  and FORMALLY CLOSED (2026-09-16;
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md`;
  implementation evidence at
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`,
  frozen contract at
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`):
  additive migration 2
  (`qlt-meaning-foundation`) creates the proposal/ceremony, epistemic
  claim, commitment, open loop, correction-lineage, and source-link
  record families (retention metadata on every table); the closed
  validators reject unknown/prototype/oversized/non-serializable input
  (the Q2-contract FENCE-1 condition); the `SharedWorldMeaningStore`
  repository enforces atomic ceremony/correction transactions, keyed
  idempotency, optimistic versions, user-only confirmation and
  correction identity, version-eligibility (never elapsed-time)
  proposal staleness, append-only lineage, and deterministic
  current-effective resolution; a permanent adversarial suite plus the
  focused `verify:q2` gate (wired into `verify:quellight` step 2c)
  enforce it. The audit independently reproduced the adversarial surface
  (75/75 checks) on top of the complete first-run ladder and found zero
  Blocking/High/Medium issues. Q2 wires NO production meaning or
  confirmation path — no proposal/ceremony action, route, UI, agent tool,
  or context assembly exists; the repository is exercised directly by
  tests only; any future effectful write uses the governed VICT 0.2.0
  boundary adopted in Q1. Phase Q3 contract and implementation planning
  is permitted but has not begun; Phases Q4–Q7 have not begun; Shared
  World meaning and ceremony implementation has not begun. (Superseded
  2026-09-16: Q3 is implemented, independently verified, and formally
  closed — see the Phase Q3 entry below; the carried FENCE-1 Low finding
  was resolved in Q3 as D-Q3-6 and the TEST-1 Low debt was satisfied by
  the permanent real-browser ceremony recovery proof; both were
  independently verified closed.)
- Non-blocking debt carried forward: F-3 (open Low, `VICT_`-prefixed
  display-only code), F-4 (open Low, historical implementation-report
  placement), F-5 (open Low, cosmetic verifier output), F-6/F-7
  (informational, development-only); from Phase Q1: FENCE-1 (open Low —
  prototype-named unknown fields silently dropped at the existing Q1
  ingress, proven harmless by the audit; the Q1 ingress itself is NOT
  modified by Q2, while every NEW Q2 Shared World input contract now
  defines explicit closed-field and prototype-key rejection behavior, as
  that finding required; this observation remains separately open — Q2's
  safe new contracts do not retroactively close it) and TEST-1 (open Low
  — no permanent browser-level replay-recovery test; must be resolved no
  later than Phase Q3 verification, before the confirmation ceremony is
  accepted as reliable); from Phase Q2: F-Q2-1 (Low — historical
  prose-index erratum: the frozen contract §2 and the implementation
  report §6 name fifteen of the sixteen indexes, omitting
  `idx_qlt_correction_subject`; the normative machine-readable inventory,
  migration DDL, and 139 schema-introspection checks contain and enforce
  all sixteen — a documentation erratum, NOT a schema defect; frozen
  documents are not rewritten) and F-Q2-2 (Low — withdrawal is
  user-attributed-only in this schema revision while frozen contract §8.2
  prose admits either identity; strictly narrower, no excess authority,
  no production withdrawal path exists; Phase Q3 must explicitly decide
  withdrawal initiation and attribution before wiring any withdrawal
  action and must not silently reinterpret the frozen discrepancy).
  Binding Q3 inputs also include real turn correlation before production
  enforcement of the one-open-proposal-per-turn rule (NULL turn
  references remain distinct). DOC-1 (the stale 0.1.0 statement in this
  document) was resolved at formal closure. F-1, F-2, and the missing
  independent live proof are remediated/resolved and independently
  verified closed.
- Phase Q3 — the governed confirmation ceremony and quiet memory inbox —
  was independently verified on 2026-09-16 (verdict
  `VERIFIED WITH NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`, audit
  commit `a8b702f…`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-INDEPENDENT-VERIFICATION.md`;
  zero Blocking/High findings; carried non-blocking findings M-1/M-2/M-3
  and L-1/L-2/L-3) and is FORMALLY CLOSED
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-FORMAL-CLOSURE.md`; audited
  implementation tree `2e494723…`; audited executable SHA unchanged;
  Q4 contract and implementation planning is PERMITTED and NOT BEGUN).
  Reports:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md` (with
  dated amendments A-AMEND-1…4),
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`,
  and the independent verification / formal closure reports above.
  Carried obligations: M-1 the disclosed `read` effect-class metadata on
  the pinned capability (framework-change proposal owed to the VICT
  owners; the durable invocation record shows `effect:'read'` for a
  durable creation until it lands); M-2 the frozen Escape-to-close
  interaction item is unimplemented (Close control and focus-return
  exist; truthful test owed in the next inbox change); M-3 process
  discipline — commit `8dc0032` bundled the A-AMEND-2 amendment with
  Lane C's UI/test implementation (content verified conformant); L-1
  documentary errata (amendment lane misname; `id DESC` tie-break vs the
  frozen `id ASC` text; extra accepted sort field `createdAt`); L-2 the
  real browser never exercises a stale proposal end-to-end (stale badge
  component-proven, refusal node-proven per the frozen containment map);
  L-3 the implementation report's changed-file inventory erratum
  (claims 22 files +6106/−93; actual 26 files +6551/−102).
  Q3 delivers: the `qlt.memory@1` application resource (one query +
  thirteen mutation ops; a 19-action plan inventory gated by the focused
  `verify:q3` check, wired into `verify:quellight`); exactly one pinned
  agent capability `qlt.proposal.draft@1` (profile revision 2,
  `maxToolCalls: 2` fail-closed budget-gated, server-derived
  turn/thread correlation, one open proposal per thread/turn/kind,
  keyed idempotency, zero Shared World read or decision power for the
  agent); the quiet memory inbox inside the existing conversation
  workspace (user-opened tray; never a modal, never auto-opened, never
  focus-stealing, never blocking; Confirm/Edit/Reject/Withdraw; direct
  "Remember this" Save; user correction; stale/already-decided/
  validation states; keyboard and screen-reader support); the API-level
  lifecycle exit verbs (claim retire, commitment release, loop
  resolve/abandon/transform; dedicated UI exits remain deferred to Q5);
  FENCE-1 ingress hardening (D-Q3-6) with the stable
  `QLT_INGRESS_PROHIBITED_FIELD` code and permanent regression controls;
  and TEST-1, the permanent real-browser ceremony recovery proof
  (`scripts/browser-ceremony-check.mjs`; `verify:quellight` step 6c).
  Owner decisions for Q3 are D-Q3-1…D-Q3-6 (see the decision register):
  user-only durable withdrawal (resolving the F-Q2-2 discrepancy
  explicitly), the quiet never-blocking inbox, Confirm/Edit/Reject/
  Withdraw with edit=amend, direct Save as immediate canonical
  confirmation, API-level exit verbs without Q3 UI, and FENCE-1. The
  agent still cannot read, list, search, or assemble confirmed Shared
  World material — that remains superseded by the Q4 entry below.
- **Phase Q4 — deterministic Shared World context assembly (2026-09-16):
  IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (not verified, not
  closed).** Contract freeze `b4bf759…` (frozen data module
  `src/lib/sharedworld/context-contract.ts`; no amendments) and
  implementation report
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTEXT-ASSEMBLY-IMPLEMENTATION.md`.
  Q4 delivers: additive migration 3 (`qlt-context-assembly`; immutable
  per-turn assembly record, UNIQUE turn_id, deterministic SHA-256
  fingerprint, outcome/failure CHECK); the deterministic assembler
  (three selection layers current-thread → global → other-thread,
  classes open_loop → commitment → claim, `updatedAt DESC, id ASC`
  (L-1), budgets 8 records / 4096 UTF-8 bytes with whole-record
  skipping, closed exclusion vocabulary incl. structured-identity
  `conflict-ambiguous` groups (D-Q4-4)); the model-seam injection as ONE
  user-role message (one text part) immediately before the trailing user
  message, call-scoped, with server-derived turn correlation from
  durable open-turn records, frozen-snapshot replay across multi-call
  turns, retry convergence, and fail-closed identity ambiguity; the
  delimiter-safe serializer (content escaping makes `<`, `>`, `&`, and
  `/` unrepresentable inside record content; hostile confirmed content
  remains quoted data with zero authority); zero-transcript-pollution
  proofs; the quiet tray transparency line (used/none/unavailable) via
  the read-only `/api/threads/[id]/assembly` route (D-Q4-6); M-2 closed
  (real Escape-to-close with focus return, component- and browser-
  proven); L-2 proven in the EXTENDED real-browser ceremony script
  (stale refusal through the real governed boundary; one disclosed
  seeding fixture); L-3 Git-derived inventory independently re-derived
  and compared by the new `verify:q4` gate (`verify:quellight` step 2e);
  the Q3 §12 correction-proposal deferral remains beyond Q4. M-1 stays
  recorded with its hard deadline (before the Phase Q6 live-provider
  proof and the Stage 07C final audit). The agent envelope remains
  EXACTLY `qlt.proposal.draft@1`; no read/list/search capability exists.
  Live-model injection resistance remains Q6. Q5 has not begun.
- **Phase Q4 H-1 remediation (2026-09-16): H-1 REMEDIATED — AWAITING
  FRESH INDEPENDENT RE-VERIFICATION (Q4 not Verified, not closed).** The
  independent verification (audit commit `821d4f8…`) found the High
  finding H-1 (same-conversation turn-overlap snapshot crossover) and
  permitted no closure. The owner decision made the rule binding —
  **exactly one active agent turn per conversation; a distinct request
  arriving while a reply remains active is rejected truthfully and
  creates no second turn; a retry of the same logical request preserves
  VICT's existing idempotent replay behavior** — and the remediation
  contract
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION-CONTRACT.md`,
  committed alone before any executable change) froze the state matrix.
  The remediation
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION.md`)
  implemented BOTH layers: (1) race-safe admission control at the
  Quellight-owned turn-start boundary (`src/lib/server/
turn-admission.ts`; the turns route wraps the dispatch): the admission
  decision and the durable turn start are atomic for the supported
  single-process deployment (a per-conversation critical section — the
  dispatch that durably creates the turn intent runs INSIDE the
  section, so a concurrent admission decision for the same conversation
  can never interleave); a distinct overlapping request is refused with
  the stable, non-echoing code `QLT_TURN_ALREADY_OPEN` and ZERO effect
  (no VICT intent, no model call, no assembly, no transcript message,
  no Shared World effect), surfaced quietly in the workspace (a quiet
  banner and polite announcement — no modal, no tray opening, no focus
  change; the optimistic local message is withdrawn and the composer is
  restored; nothing is queued); same-key retries pass through to VICT's
  truthful idempotent disposition unchanged (replay / in-progress /
  digest conflict), so a legitimate same-key replay is never
  misclassified; different conversations run concurrently. (2) A
  model-seam defensive backstop in `resolveForStream`: attribution
  requires EXACTLY ONE attributable open turn for the conversation and
  actor — exactly one record-less turn assembles, exactly one recorded
  turn replays, zero open turns pass through, and ≥2 open turns in ANY
  recorded/unrecorded/in-flight combination fail closed with zero
  injection, no per-turn in-flight promise borrowing, and no new
  assembly (no falsely attributed record) — effective even when the
  admission invariant is bypassed through a direct internal call, test
  fixture, future route, or corrupted state. The permanent regression
  suite `test/turn-overlap-isolation.test.ts` (11 tests; real stores,
  real route handler, deliberately delayed offline model) locks the
  frozen state matrix. Audit-finding dispositions carried by the
  remediation documentation pass: L-1 (the duplicated Q3 status line in
  this document and the README) corrected additively by this pass; L-2
  (implementation-identity lag) reconciled additively — the Q4 audited
  implementation tree is `c4896bef…` (executable content unchanged
  since `bf7fec3`), the audit-report commit is `821d4f8…`; L-3
  (pre-existing Q3 latent defect: correction-kind proposal confirmation
  through `confirmProposal` always rolls back `QLT_RECORD_EXISTS` due
  to a duplicate source-thread link; the active production correction
  path remains `applyCorrection`) recorded as a Q5/backlog obligation
  ONLY and NOT repaired here; O-1/O-2/O-3 preserved as observations;
  the pending-correction fixture limitation and the Q3
  correction-proposal deferral preserved; M-1 unchanged with its hard
  deadline (before the Phase Q6 live-provider proof and the Stage 07C
  final audit). A FUTURE turn-steering direction is RECORDED in the
  decision register as a deferred design input (explicit operation
  targeting the exact active turn — never a second overlapping turn;
  requires its own future contract covering target-turn identity,
  append-vs-restart semantics, durable event/transcript truth,
  idempotency, restart/reconnect, context-snapshot consequences,
  provider support, and user-visible state); steering, queuing, and
  parallel replies are NOT implemented.
- The status sections below describe the delivered Stage 07B behavior;
  `docs/stage-07b-report.md` is the preserved historical implementation
  report (its issuance-time status wording is superseded by this
  section).

## What Quellight is

A single-user, conversation-first workspace. One SvelteKit process
hosts the product surface **and** composes the VICT runtime in-process;
all VICT boundaries are consumed as released `@victframework/*@0.2.0`
packages — the exact immutable coordinated release
`vict-release-set@1/0.2.0` adopted and verified in Phase Q1 — from the
public registry.

## Ownership boundaries (canonical)

| Layer                                  | Owner                                    | Contents                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conversation execution & delivery      | **VICT**                                 | turn lifecycle, streaming, sequencing, idempotency, cancel/restart semantics, protected operator configuration                                                                                         |
| Transcripts & in-flight working memory | **Mastra** (via `@victframework/mastra`) | dedicated conversation store; replaceable caches                                                                                                                                                       |
| Durable partnership material           | **Quellight**                            | Shared World SQLite store (`qlt_thread` family + the Q2 meaning families: proposals/ceremony records, epistemic claims, commitments, open loops, correction lineage, source links; retention metadata) |

**Transcript survival is not Shared World continuity.** No epistemic
claims, commitments, open loops, or agent-derived meaning existed in
07B; Q2 adds the DURABLE STORAGE CONTRACTS for those families plus
their lifecycle/lineage/eligibility rules, but still activates no
production meaning path: the agent has **no** Shared World write path
(negative-controlled), records exist only through the test-exercised
repository, and only user-ceremony-confirmed material may ever become
canonical in later phases.

## Composition (one process)

`src/lib/server/composition.ts` composes, on first use:

1. **Operator configuration** — pinned profile
   `agent.quellight.conversation@1` (instructions artifact,
   `lastMessages: 20`, `semanticRecall: false`, `workingMemory` off,
   `maxSteps: 8`, `maxToolCalls: 0` fail-closed, bounded output tokens,
   `maxRetries: 0`).
2. **Three physically separate SQLite stores** in one data dir:
   - `vict-operational.db` — VICT operational stores (actor directory,
     turn records, stream ledger, idempotency, governance);
   - `mastra/mastra-store.db` — dedicated Mastra conversation store;
   - `shared-world.db` — Quellight Shared World store.
3. **Single local actor** `actor-quellight-local` with the union of
   roles required for turn start/cancel, run/stream read, and
   application data read/write. The loopback boundary authenticates
   with a bearer token (`QUELLIGHT_ACTOR_TOKEN` or an ephemeral
   in-process token); the browser never holds it.
4. **Provider seam** — offline mode uses the deterministic fixture
   model; live mode (`QUELLIGHT_LIVE_PROOF=1` + credential present)
   uses `ModelRouterLanguageModel` with the pinned identity
   `ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`. The
   credential is resolved only through the VICT protected boundary and
   injected via the process environment just before model creation; it
   is never visible to composition code, never logged, never
   persisted.
5. **Turn deadline** — a Quellight-owned wrapper at the model boundary
   (`QUELLIGHT_TURN_DEADLINE_MS`, default 120 s) ends an over-deadline
   turn with the stable safe code `VICT_AGENT_TURN_FAILED`. It never
   fabricates or retries content.
6. **VICT loopback HTTP boundary** — `createVictHttpServer` bound to
   `127.0.0.1:0`; the only caller is this process.

## Request paths

- `/*` — SvelteKit page; renders the app plan screen with the island
  registry (`qlt.conversation-workspace@1`).
- `/vict/[...path]` — **proxy** to the loopback boundary; injects the
  bearer token server-side, allowlists headers, passes SSE through
  unbuffered.
- `/api/threads/[id]/turns` — start a turn (client idempotency key;
  resolves the Shared World thread → conversation link server-side).
- `/api/threads/[id]/messages` — VICT-authoritative restore: turn
  records (from operational stores) gate the transcript read (from the
  Mastra store). Incomplete/failed turns stay visibly marked; no
  per-message fabrication.
- `/api/act` — the ONLY non-local action ingress: a thin transport
  boundary that parses the declared request, resolves the local user
  identity server-side, and invokes the released VICT 0.2.0
  `app.data.query` / `app.data.mutate` command boundary (closed mutation
  envelope, plan-resolved action identity, contract-fenced input,
  durable idempotency). It writes no SQLite and holds no parallel
  shortcut (the Stage 07B direct-adapter accommodation is retired;
  decision register D-10). The legacy identity-only `app.data.mutate`
  payload fails closed (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`).
- `/api/health` — discloses model mode, release version, deadline.

## Streaming contract

`vict.agent-stream@1` resumable SSE with cursor `v1:<streamId>:<seq>`:

- the client wire-validates **every** frame (closed envelope **and**
  closed event schema); unknown kinds, broken envelopes, or invalid
  shapes mark the stream unhealthy and halt rendering (N-7);
- duplicate delivery is deduplicated by sequence; reconnect resumes
  from the last acknowledged sequence (N-8);
- `text.delta` is transient: best-effort live delivery. The terminal
  event is the durable milestone; the UI reconciles the transcript from
  the restore boundary at terminal (D-7).

## Forced restart (N-9)

On boot the composition runs `reconcileAfterRestart()`. After a
SIGKILL: completed turns and their content survive; the in-flight turn
settles honestly (`failed`/`cancelled` with a stable `VICT_*` code);
the Shared World thread list survives; nothing is fabricated as
completed.

## Retention metadata

Shared World threads carry `retention_state`
(`currently-relevant` / `user-removed`) and timestamps. Archive maps to
`state = dormant` (read-only except reopen); deletion in 07B is
retention-metadata marking, never Shared World meaning deletion.

## See also

- `docs/database.md` — store layout and migration discipline
- `docs/setup.md` — operator configuration and credentials
- `docs/decision-register.md` — binding decisions
- `docs/stage-07b-report.md` — implementation evidence (historical;
  status superseded by the Status section above)
- `docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md` — formal closure
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md` —
  Phase Q1 implementation evidence
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`
  — Phase Q1 independent verification (audit)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md` — Phase
  Q1 formal closure
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md` — the
  frozen Phase Q2 durable-schema contract
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`
  — Phase Q2 implementation evidence (historical implementation record;
  status superseded by the closure below)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`
  — Phase Q2 independent verification (audit)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md` — Phase
  Q2 formal closure
