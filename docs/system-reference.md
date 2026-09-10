# Quellight system reference — Stage 07B

## Status (current, 2026-09-10)

```text
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C: SPECIFICATION PERMITTED — NOT BEGUN
Stage 07:  IN PROGRESS (07A closed; 07B closed; 07C–07E remaining)
```

- Stage 07B is formally closed against the audited evidence SHA
  `1e0c0f53d62cde6d5031f865fe871ac1d41c9a9b` (independent re-verification
  verdict `VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE
PERMITTED`). See
  `docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md` and the VICT
  constitutional closure (System Reference v0.4.7, §0.16, commit
  `1fd98060254bd4789cdb559b7952d414d6b51a6b`).
- The retained dependency is exactly the immutable release set
  `@victframework/*@0.1.0` (`vict-release-set@1/0.1.0`, content ID
  `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`).
  VICT `0.1.1` is published but NOT adopted; any later adoption requires
  an explicit Stage 07C compatibility decision and fresh verification.
- The semantic-authority enforcement principle is registered as VICT
  `GOV-007` and mirrored here as decision register **D-8**; the F-8
  `app.data.mutate` payload gap is the binding Stage 07C entry gate,
  mirrored as **D-9**.
- Non-blocking debt carried forward: F-3 (open Low, `VICT_`-prefixed
  display-only code), F-4 (open Low, historical implementation-report
  placement), F-5 (open Low, cosmetic verifier output), F-6/F-7
  (informational, development-only). F-1, F-2, and the missing
  independent live proof are remediated/resolved and independently
  verified closed.
- The status sections below describe the delivered Stage 07B behavior;
  `docs/stage-07b-report.md` is the preserved historical implementation
  report (its issuance-time status wording is superseded by this
  section).

## What Quellight is

A single-user, conversation-first workspace. One SvelteKit process
hosts the product surface **and** composes the VICT runtime in-process;
all VICT boundaries are consumed as released `@victframework/*@0.1.0`
packages from the public registry.

## Ownership boundaries (canonical)

| Layer                                  | Owner                                    | Contents                                                                                                       |
| -------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Conversation execution & delivery      | **VICT**                                 | turn lifecycle, streaming, sequencing, idempotency, cancel/restart semantics, protected operator configuration |
| Transcripts & in-flight working memory | **Mastra** (via `@victframework/mastra`) | dedicated conversation store; replaceable caches                                                               |
| Durable partnership material           | **Quellight**                            | Shared World SQLite store (`qlt_thread` family); retention metadata                                            |

**Transcript survival is not Shared World continuity.** No epistemic
claims, commitments, open loops, or agent-derived meaning exist in
07B; the agent has **no** Shared World write path (negative-controlled).

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
- `/api/act` — typed Application Layer action boundary
  (`ApplicationDataAdapter`, DATA-014) for thread mutations;
  `app.data.query` crosses the released command path;
  `app.data.mutate` fails closed (see decision register D-4).
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
