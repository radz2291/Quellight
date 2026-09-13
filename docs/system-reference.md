# Quellight system reference — Stage 07B/07C

## Status (current, 2026-09-13 — Phase Q2 implemented)

```text
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q1: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q2: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (durable Shared World schema)
Stage 07C Phases Q3–Q7: NOT BEGUN (Shared World meaning and ceremony unimplemented)
Stage 07:  IN PROGRESS (07A closed; 07B closed; Q1 closed; Q2 implemented; Q3–Q7, 07D, 07E remaining)
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
  IMPLEMENTED (2026-09-13;
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`,
  frozen contract at
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`) and
  AWAITING INDEPENDENT VERIFICATION: additive migration 2
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
  enforce it. Q2 wires NO production meaning or confirmation path — no
  proposal/ceremony action, route, UI, agent tool, or context assembly
  exists; the repository is exercised directly by tests only; any future
  effectful write uses the governed VICT 0.2.0 boundary adopted in Q1.
  Q3–Q7 remain pending; Shared World meaning and ceremony implementation
  has not begun.
- Non-blocking debt carried forward: F-3 (open Low, `VICT_`-prefixed
  display-only code), F-4 (open Low, historical implementation-report
  placement), F-5 (open Low, cosmetic verifier output), F-6/F-7
  (informational, development-only); from Phase Q1: FENCE-1 (open Low —
  prototype-named unknown fields silently dropped at the existing Q1
  ingress, proven harmless by the audit; the Q1 ingress itself is NOT
  modified by Q2, while every NEW Q2 Shared World input contract now
  defines explicit closed-field and prototype-key rejection behavior, as
  that finding required) and TEST-1 (open Low — no permanent
  browser-level replay-recovery test; must be resolved no later than
  Phase Q3 verification, before the confirmation ceremony is accepted
  as reliable). DOC-1 (the stale 0.1.0 statement in this document) was
  resolved at formal closure. F-1, F-2, and the missing independent live
  proof are remediated/resolved and independently verified closed.
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
  — Phase Q2 implementation evidence (implemented; awaiting independent
  verification)
