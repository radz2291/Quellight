# Stage 07B implementation report — Quellight

Status of this stage (binding wording):

```text
Stage 07B: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
Stage 07C: ACCEPTED SEQUENCE — NOT BEGUN
```

This is an implementation report, not an independent verification.
Nothing in this stage is "Verified" or "Closed".

## 1. Inputs and boundaries

- **Canonical product input**: byte-identical to the owner-provided
  document, SHA-256
  `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331`
  (re-verified after every operation that touches tree-wide files; a
  `.prettierignore` entry freezes it).
- **VICT reference**: `260831-VCT-02` at `e70b1a876bf7f4bad83a611f5333d86541a0b664`,
  treated read-only throughout; VICT was not modified, committed, tagged,
  or pushed.
- **VICT consumption**: exact public registry pins
  `@victframework/*@0.1.0` (release identity `vict-release-set@1/0.1.0`,
  content ID `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`).
  No `workspace:`/`file:`/`link:`/git deps; no vendored source; no
  imports from any VICT checkout.
- **npm resolution evidence**: `package-lock.json` lockfileVersion 3;
  all `@victframework` entries at `0.1.0` with `sha512-` integrity and
  `https://registry.npmjs.org/` resolved URLs. Key resolved transitive
  pins: `@mastra/core 1.64.0`, `@mastra/memory 1.28.2`,
  `@mastra/libsql 1.22.3`, `@mastra/observability 1.17.5`,
  `svelte 5.x`, `vite 6.x`, `typescript 5.x`, `@sveltejs/kit 2.x`.

## 2. Provider and credential boundary

- One profile only: `ollama-cloud/glm-5.3-flash`, endpoint
  `https://ollama.com/v1`, credential variable `OLLAMA_API_KEY`
  (owner decision D-1). No fallback, no rotation.
- Live mode requires `QUELLIGHT_LIVE_PROOF=1` **and** the credential;
  otherwise the system runs fully offline (deterministic fixture).
- Credential handling: resolved only via the VICT protected operator
  configuration; injected at the model seam via the process
  environment immediately before model creation; absent → fail-closed
  `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE`; never in source, config
  objects, URLs, logs, errors, stream frames, snapshots, tests,
  browser bundles, or store bytes (canary negative-controls below).
- The Z.ai Coding Plan was used only as the development agent's
  tooling; it is not configured anywhere as a runtime provider.

## 3. Work packages

1. **Inception** — safe preflight (empty remote, canonical input SHA,
   VICT SHA, package availability, engines, no credentials), git init
   on `main`, origin connected, canonical input committed byte-exact.
2. **Consumer scaffold** — SvelteKit + TypeScript host reconciled with
   the released scaffolder; private/UNLICENSED posture; `.env.example`
   names only; lockfile committed.
3. **Shared World foundation** — `src/lib/sharedworld/`: storage port
   with closed vocabularies (`active|dormant`,
   `currently-relevant|user-removed`, provenance `user`),
   forward-only migrations with bookkeeping, SQLite store passing the
   full released application-data conformance suite, hostile-input
   validation, in-transaction keyed idempotency.
4. **Composition + conversation path** — single-process composition
   (operator config, three separate stores, single local actor,
   pinned profile, Mastra product agent, stream hub, command service,
   loopback VICT HTTP boundary), `/vict` proxy with server-side
   credential injection and unbuffered SSE pass-through, typed
   conversation boundaries, boot-time restart reconciliation.
5. **Live provider seam** — `ModelRouterLanguageModel` with the pinned
   identity, deadline seam, bounded live-proof script (see §6).
6. **Conversation UI** — `qlt.conversation-workspace@1` island with
   all twelve truthful states, cursor reconnect, client-side wire
   validation, durable reconcile at terminal, accessible live region,
   keyboard operability, responsive layout.
7. **Verification + docs** — negative controls, verification scripts,
   aggregate gate, this documentation set.

## 4. Negative controls (N-1 … N-20)

| #    | Control                                                                                                                    | Evidence                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| N-1  | registry-only installation                                                                                                 | `scripts/verify-consumer.mjs` [1][2][3] — PASS                     |
| N-2  | unreachable registry fails closed                                                                                          | `verify-consumer` [4] — PASS                                       |
| N-3  | deterministic streaming lifecycle, durable ordering                                                                        | `test/composition.test.ts`                                         |
| N-4  | provider failure → honest failure (`VICT_AGENT_TURN_FAILED`)                                                               | `test/composition.test.ts` (truncated-script case)                 |
| N-5  | cancellation truthfulness (durable intent, single terminal)                                                                | `test/composition.test.ts`                                         |
| N-6  | deadline expiry → stable safe code, no fabricated content                                                                  | `test/composition.test.ts` + model deadline seam                   |
| N-7  | malformed frames rejected client-side (unknown kind, broken envelope, invalid seq)                                         | `test/reconnect.test.ts`                                           |
| N-8  | disconnect/reconnect from acknowledged cursor; idempotent duplicates                                                       | `test/reconnect.test.ts` (real loopback HTTP)                      |
| N-9  | forced SIGKILL + restart renders only durable truth                                                                        | `test/restart.test.ts` (real child process)                        |
| N-10 | thread list/reopen after close; SQLite close/reopen                                                                        | `test/composition.test.ts`, `test/sharedworld.test.ts`             |
| N-11 | duplicate command delivery idempotent                                                                                      | `test/composition.test.ts`                                         |
| N-12 | no agent Shared World write path; Mastra loss ≠ Shared World loss                                                          | `test/composition.test.ts`                                         |
| N-13 | no continuity claim from transcript persistence                                                                            | island disclosure text (asserted in `test/ui/workspace.test.ts`)   |
| N-14 | credential canaries absent from config, frames, whoami, all store bytes, console                                           | `test/composition.test.ts` (fresh high-entropy canaries per run)   |
| N-15 | bounded live proof (gate-refusing, ≤5 turns, ≤256 tokens, cancel + restart + restore, metadata only, byte-level leak scan) | `scripts/verify-live-provider.mjs`                                 |
| N-16 | fail-closed live gate without credential                                                                                   | `test/composition.test.ts`                                         |
| N-17 | clean production build, zero console/hydration warnings                                                                    | `scripts/browser-check.mjs` + build-log scan in `verify:quellight` |
| N-18 | no unexpected build warnings (closed allowlist)                                                                            | `verify:quellight` step 5                                          |
| N-19 | responsive + keyboard + axe (real browser)                                                                                 | `scripts/browser-check.mjs` (desktop 1280 / mobile 390)            |
| N-20 | full aggregate gate                                                                                                        | `npm run verify:quellight` — PASS                                  |

Note on repetition discipline: the N-9 test was stabilized by removing
an accidental duplicate worker spawn (both flake modes were diagnosed
and the fix eliminates the race rather than loosening the assertion);
post-fix it was characterized 12/12 green. No required assertion was
weakened, no timeout increased, no test skipped.

## 5. Verification ladder (executed)

```text
npm ci                        PASS (lockfile reproduces)
format check                  PASS
typecheck                     PASS (0 errors)
unit/integration (node)       PASS (23 tests, 4 files)
browser-side island tests     PASS (3 tests)
process restart/reconnect     PASS (N-8, N-9 inside node suite)
real-browser checks           PASS (N-17/N-19)
production build              PASS (adapter-node)
credential canary scan        PASS (sources + artifacts, 140 files)
migration verification        PASS (inside sharedworld suite)
git diff --check              PASS
```

Aggregate gate: `npm run verify:quellight` → PASS (exit 0).

## 6. Bounded live proof (N-15)

The live proof is an explicit operator action, outside the automated
suite. The script (`npm run verify:live-provider`):

- refuses to run without `QUELLIGHT_LIVE_PROOF=1` and the credential
  (exit 2, stable sanitized message);
- performs ≤ 5 live turns at ≤ 256 output tokens: one completed turn,
  one mid-stream cancellation (`VICT_TURN_CANCELLED`), a full process
  restart on the same data dir, a durable restore check, and one
  post-restart completed turn;
- prints metadata only (statuses, codes, timings, counts) — never
  conversation content;
- scans every persisted store byte and captured ledger frame for the
  credential value and fails on any hit.

**Result**: PASS. Three bounded live turns against the real provider —
t1 completed (~2.6 s), t2 cancelled mid-stream with the truthful
terminal (exactly one `response.cancelled` durable frame), full
composition restart on the same data dir (~340 ms) with truthful
restore (3 durably restored messages; turn statuses
completed/cancelled), t3 completed in the restarted process. The
credential value was absent from every persisted byte and ledger
frame. No conversation content was printed.

Contract note (recorded in D-4's spirit, no framework change): in
released VICT 0.1.0 an in-flight cancellation records the turn as
`cancelled` WITHOUT a code on the turn record; the
`VICT_TURN_CANCELLED` code is written on the restart-reconcile path.
The live proof asserts the released contract: truthful cancelled
status plus exactly one `response.cancelled` durable terminal frame.

## 7. Framework-change proposal

See decision register D-4: the released `app.data.mutate` command
payload cannot structurally carry a mutation input. 07B wires it to
fail closed (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`) and routes
thread mutations through the release-defined typed Application Layer
action boundary. No framework code was changed or patched.

## 8. Genuine limitations

- The offline fixture replies only to scripted prompts (unscripted
  input truthfully yields an empty response); live conversation
  requires the operator gate + credential.
- `text.delta` frames are transient by contract; a client that misses
  them sees the response content at the durable terminal milestone
  (reconcile), never a fabricated partial (D-7).
- Deletion in 07B is retention metadata (`user-removed`), not Shared
  World meaning deletion (that is 07D scope).
- Single-user, single-process, local-only; the loopback VICT boundary
  binds to `127.0.0.1` by design.
- On Windows, store files can remain locked briefly after close
  (documented, D-6); no correctness impact.

## 9. Commits

```text
e53ee87  docs: canonical architecture input
8f87245  chore(stage-07b): initialize Quellight consumer
b63b4b6  chore: dependencies and lockfile
2155cce  chore(stage-07b): verification tooling dependencies
9354a12  feat(stage-07b): implement live conversation foundation
909e812  docs(stage-07b): record implementation evidence
4aa82ed  fix(stage-07b): live provider model construction
9184593  fix(stage-07b): align live-proof cancellation evidence with
         released contract
<final>  docs(stage-07b): record final commit chain
```

All pushes were fast-forward-only to `main` after re-checking the
remote; the remote never advanced unexpectedly during the stage.
