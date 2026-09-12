# Quellight Stage 07C — Phase Q1 — Independent Verification

> **Class:** independent verification report (audit). This document is the
> fresh, independent verification of Quellight Stage 07C Phase Q1
> (controlled VICT 0.2.0 adoption and governed mutation migration). It was
> produced by an auditor with no participation in the Q1 implementation;
> the implementer's report, tests, action inventory, and architectural
> conclusions were treated as claims, not as proof. Expected behavior was
> derived from the governing documentation, and the critical evidence was
> reproduced independently.
>
> **Verdict (binding wording):**
>
> ```text
> VERIFIED WITH NON-BLOCKING ISSUES — PHASE Q1 FORMAL CLOSURE PERMITTED
> ```

## 0. Auditor-independence statement

The auditor did not implement, remediate, or modify any Q1 behavior, did
not rely on the implementation report as evidence, and derived all
expectations from: VICT `VICT-SYSTEM-REFERENCE.md` v0.4.12 (GOV-007,
ratified OQ6, Stage 07C handoff, Phase F/release records),
`docs/RELEASE-COMPATIBILITY.md`, the Quellight system reference,
decision register, canonical persistent-cognitive-partner input, and the
released public packages themselves. All critical evidence — baseline
behavior, dependency state, registry identity, action provenance, route
thinness, identity/scope enforcement, idempotency/crash boundaries,
replay truthfulness, SQLite transaction behavior, and browser flows —
was reproduced independently with disposable probes that were removed
after the audit. No production code, test, manifest, lockfile, status
document, decision-register entry, canonical input, or historical report
was modified. No credential or authentication file was read; the
VICT-local npm release skill was not read; only public registry access
was used.

## 1. Audited SHAs, ancestry, and repository state

| Property                                       | Value                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Quellight audited target                       | `269fa21c5a55a1878eec312401eade26dd4a7e39`                                                                                        |
| Quellight `origin/main` at audit start and end | `269fa21c5a55a1878eec312401eade26dd4a7e39` (`HEAD == origin/main`)                                                                |
| Quellight pre-Q1 baseline                      | `f25b03a322868b37c9fee732a767d91d3ab63f98` — verified ancestor of HEAD                                                            |
| Q1 implementation commit                       | `b802a877c5eae502ee87846b3e9a3bd202df85b1` — verified ancestor of HEAD; parent sequence `f25b03a → b802a87 → 269fa21`             |
| VICT read-only evidence tip                    | `18e3d223ef06948d3308b9b87a49b05ecab2ca8a` (`HEAD == origin/main`; tracked tree clean; untracked `.pi/` never read and untouched) |
| VICT authoritative 0.2.0 release source        | `5c81aca5e7a50f8f1e1711da1630cb6167b854c0` — verified ancestor of the VICT documentation tip                                      |
| Canonical input SHA-256                        | `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` — recomputed by the auditor; byte-identical                    |
| Tracked tree                                   | clean at start and end of the audit (both repositories)                                                                           |
| `AGENTS.md`                                    | none exists in either repository (filesystem search)                                                                              |

Both remotes were fetched at audit start; neither had advanced. No
reset, rebase, force-push, history rewrite, or `.pi/` access occurred.

## 2. Commit and scope audit

### 2.1 Implementation commit `b802a87…`

- **Exactly 15 files** changed (1858 insertions, 240 deletions),
  matching the claim: `package.json`, `package-lock.json`,
  `scripts/lib/release-set.mjs` (new), `scripts/verify-consumer.mjs`,
  `scripts/verify-governance.mjs` (new), `scripts/verify-quellight.mjs`,
  `src/lib/application/definition.ts`,
  `src/lib/islands/ConversationWorkspace.svelte`,
  `src/lib/server/application-server.ts`, `src/lib/server/composition.ts`,
  `src/lib/server/runtime.ts`, `src/routes/api/act/+server.ts`,
  `test/fixtures/app-environment.ts` (new),
  `test/governed-mutation.test.ts` (new), `vitest.node.config.ts`.
- **Dependency adoption limited to VICT 0.2.0.** The auditor parsed both
  lockfile revisions: 381 package entries in each; exactly the 11
  `@victframework` members changed (`0.1.0 → 0.2.0`: 10 declared
  dependencies + transitive `kernel`) plus the root manifest snapshot.
  **Zero non-VICT version/resolved/integrity/dependency changes.**
  No unrelated external dependency drift exists.
- **No Shared World scope was added.** `src/lib/sharedworld/**` is
  byte-identical to baseline (`git diff` empty); no new tables,
  migrations, proposals, ceremony, context, correction, or retention
  behavior appears anywhere in the diff. No new product operation was
  introduced (the five bounded actions are unchanged).
- **No historical evidence was changed** — every 07B report,
  `docs/stage-07b-report.md`, `docs/database.md`, `docs/setup.md`, and
  the canonical input are byte-identical (SHA-256 compared across
  baseline, target commit, and working tree).
- **No test hiding.** `vitest.node.config.ts` ADDS one alias
  (`$app/environment` → the deterministic test fixture); `include`
  remains `test/**/*.test.ts`; exclusions remain `test/ui/**` and
  `node_modules`. Discovery grew 5 → 6 node files; no suite disappeared.
- **Removal of the old direct boundary is complete.** Baseline
  `application-server.dispatch` called `sharedWorld.adapter.mutate`
  directly (verified in the baseline worktree source); the target
  dispatch crosses only `app.data.query`/`app.data.mutate`. The baseline
  parallel forwarder `composition.sharedWorldActionBoundary` (verified
  present at baseline `composition.ts:233/573`) is absent at target and
  permanently gated (`verify:governance` step 2).
- **Interface-only claims are genuine.** `runtime.ts` only exports a
  previously private interface; `test/fixtures/app-environment.ts` is a
  new test-only fixture (`dev=false`); no behavioral semantics ride on
  either.

### 2.2 Documentation commit `269fa21…`

- Changes exactly the four reported files: `README.md`,
  `docs/system-reference.md`, `docs/decision-register.md`, and the new
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md`.
- D-10 is recorded truthfully and additively (D-3 updated by
  cross-reference; D-4/D-9 preserved verbatim; no historical entry
  rewritten). The implementation report explicitly disclaims
  verification ("NOT an independent verification… nothing in this stage
  is Verified or Closed") and does not claim Phase Q2 completion; Q2–Q7
  are declared pending everywhere.
- **One undisclosed residue (Low, DOC-1):** `docs/system-reference.md`
  §"What Quellight is" still reads "consumed as released
  `@victframework/*@0.1.0` packages", contradicting the same document's
  Status section (0.2.0). Documentation-only inconsistency; no behavior
  impact.

## 3. Independently reproduced baseline (`f25b03a…`)

The auditor created a disposable worktree at the baseline SHA, installed
its exact lockfile (0.1.0 set) from the public registry, and verified:

- **VICT 0.1.0 dependency state:** all 10 declared pins at exact
  `0.1.0` + transitive `kernel` at `0.1.0` in manifest and lockfile.
- **Pre-Q1 `/api/act` mutation behavior:** the route accepted only
  `{actionId, input}` (no idempotency key); `dispatch` resolved the
  compiled plan locally and called `sharedWorld.adapter.mutate` DIRECTLY
  (the D-4/D-9 accommodation). Server-generated create identity was
  random (`qlt-<crypto.randomUUID()>`), so an identical retry carried a
  different payload (no command-level reconciliation existed).
- **Direct adapter callers (baseline):** (1) `dispatch` for both query
  and mutation; (2) `composition.sharedWorldActionBoundary.mutate` (a
  second in-process forwarder); (3) `[...vict]/+page.server.ts`
  `adapter.query` (read-only view data — not an effect).
- **Input contracts:** baseline contracts were bounded-string, ANY-field
  (`boundedStringContract`); Q1 tightened them to CLOSED field sets.
- **Effectful routes (baseline = target):** `/api/act` (E1–E5),
  `/api/threads/[id]/turns` (E6, released `agent.turn.start` command
  boundary — not an accommodation), `/api/threads/[id]/messages` (E7,
  read-only restore), `/vict/[...path]` (E8, released loopback boundary),
  `/api/health` (read-only), `[...vict]` page load (read-only).
- **Baseline tests:** node suite green at **5 files / 28 tests**
  (matches the report's baseline claim). One environmental preparation
  step was required in the fresh worktree (`npx svelte-kit sync` to
  generate the gitignored `.svelte-kit/tsconfig.json`); diagnosed before
  rerun; no test, timeout, or assertion was changed.

**Baseline ≡ target parity evidence:** the Q1 diff leaves the turn,
stream, stop, restore, proxy, and fixture paths untouched, and the
auditor's identical behavioral probe produced indistinguishable results
on baseline and target builds (§10, REG-1).

## 4. Dependency and registry verification (public, fresh cache)

Using only public registry access (fresh task-specific npm cache for
`npm ci`):

- **Versions:** all 13 `@victframework` packages publish exactly
  `[0.1.0, 0.1.1, 0.2.0]` with `dist-tags.latest = 0.2.0` (13/13);
  full dist-tags are exactly `{latest: 0.2.0}` — the `vict-0.2.0-rc`
  candidate tag is gone; no other tag exists.
- **Coordinated content identity, independently re-derived:**
  sha256 over the sorted, newline-joined `name@version` list of the
  13-member set →
  `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`
  — EQUAL to the recorded identity (algorithm per
  `docs/RELEASE-COMPATIBILITY.md` §2).
- **Artifact integrity:** all 13 tarballs downloaded from the registry
  `dist.tarball` URLs; recomputed sha512 equals `dist.integrity` for
  13/13. The installed `@victframework/server` `dist/app-remote.js` and
  `app-remote.d.ts` are byte-identical to the registry tarball content.
- **Public declarations carry the governed mutation API:** the released
  `app-remote.d.ts` exposes `RemoteApplicationDataOptions.resolveAction`
  / `resolveInputContract`, `ResolvedApplicationAction`, the closed
  constants `MUTATION_ENVELOPE_*` / `MUTATION_INPUT_*` (op ≤ 32,
  id ≤ 128, key ≤ 128, depth 8, arrays ≤ 1000, keys ≤ 128, size
  declared), and `commands.js` declares the corrected closed payload
  field sets for `app.data.mutate` / `app.data.action` (optional
  `actionId` / `expectedActionRevision` / `mutation`) — matching the
  Stage 07C Phase F handoff §6.
- **Quellight's installed graph:** 11 lockfile VICT entries, all at
  exactly `0.2.0`, all `resolved` from `https://registry.npmjs.org/`
  with sha512 integrity; zero 0.1.x residue; every manifest pin exact
  (no range/tag/workspace/file/link/git); every `require.resolve`
  realpath for the 11 members lands inside Quellight's own
  `node_modules` and never inside the VICT repository.
- **Negative controls (disposable probes against the shared gate):**
  a mixed 0.1.x/0.2.0 resolved set FAILS ("a mixed release set is not
  adoptable"); a tampered recorded content identity FAILS; the correct
  set PASSES. An unreachable registry fails the consumer's live probe
  (permanent N-2 re-verified: `--registry=http://127.0.0.1:9/` fails
  closed), so registry unavailability cannot silently fall back to any
  local source. See finding INFO-1 for the omission-detection nuance.

## 5. Action inventory and provenance (independently derived)

The compiled plan (re-derived by the auditor through the released SDK/compiler)
declares exactly five actions on the single resource `qlt.threads@1`
(`app.quellight@1`, schema `vict.application-definition@2`):

| #   | UI action          | Request                                                                         | Route             | Definition action                                                          | Plan resolution                                                                                                                         | Input contract                                                                                                | VICT boundary                                                                                                                                                                             | Identity & governance                                                                                                                                                                                        | Handler → SQLite                                                                                                                                                  | Result/event                                                                                                                          |
| --- | ------------------ | ------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | "New thread" click | `POST /api/act {actionId:'act.createThread', input:{title}, idempotencyKey}`    | `/api/act` (thin) | `act.createThread@1` mutation, op `create`, resource `qlt.threads`         | ingress plan lookup (routing only) → released resolver re-resolves inside `remoteMutateEnvelope`; `expectedActionRevision:'1'` enforced | `qlt.threads.create.input@1` closed `{id?,title≤200}`, fenced at the boundary AND re-validated by the adapter | released `app.data.mutate` command (scope `app.data.write`; durable claim/lease/fenced idempotency; digest-bound receipt) → envelope → `threadDataPort.mutate` → `ApplicationDataAdapter` | server-derived local actor (`actor-quellight-local`; roles developer+operator → `app.data.read`+`app.data.write`); browser never supplies identity; deterministic create id `qlt-<sha256(release⊕key)[:24]>` | ONE `BEGIN IMMEDIATE` transaction in `shared-world.db`: `qlt_thread` INSERT + `qlt_adapter_idempotency` key row, same transaction                                 | `{ok,value:row}`; durable receipt (safe projection `{command,resourceId,releaseVersion}` only); replay → `{ok,value:{replayed:true}}` |
| E2  | Rename (Save)      | `POST /api/act {actionId:'act.renameThread', input:{id,title}, idempotencyKey}` | `/api/act`        | `act.renameThread@1` mutation, op `rename`                                 | same released resolution                                                                                                                | `qlt.threads.rename.input@1` closed `{title≤200}`; target id crosses the envelope `id` field                  | same released boundary                                                                                                                                                                    | same                                                                                                                                                                                                         | one UPDATE via port (dormant threads refused `DATA_INVALID_REQUEST`)                                                                                              | `{ok,value:row}`                                                                                                                      |
| E3  | Archive            | `POST /api/act {actionId:'act.archiveThread', input:{id}, idempotencyKey}`      | `/api/act`        | `act.archiveThread@1` mutation, op `archive`                               | same                                                                                                                                    | `qlt.threads.archive.input@1` closed `{}`                                                                     | same                                                                                                                                                                                      | same                                                                                                                                                                                                         | `state→dormant` (idempotent domain semantics)                                                                                                                     | `{ok,value:row}`                                                                                                                      |
| E4  | Reopen             | `POST /api/act {actionId:'act.reopenThread', input:{id}, idempotencyKey}`       | `/api/act`        | `act.reopenThread@1` mutation, op `reopen`                                 | same                                                                                                                                    | `qlt.threads.reopen.input@1` closed `{}`                                                                      | same                                                                                                                                                                                      | same                                                                                                                                                                                                         | `state→active`                                                                                                                                                    | `{ok,value:row}`                                                                                                                      |
| E5  | Thread list        | `POST /api/act {actionId:'act.queryThreads', input:{filters?}}`                 | `/api/act`        | `act.queryThreads@1` query                                                 | plan lookup → released `app.data.query` (`scope app.data.read`; not idempotency-governed)                                               | closed `{filters}` (bounded identifiers/values)                                                               | released `app.data.query` → `remoteQuery` → port → adapter (`effect:'read'`)                                                                                                              | same actor                                                                                                                                                                                                   | read-only SELECT                                                                                                                                                  | `{ok,value:{rows,total}}`                                                                                                             |
| E6  | Send turn          | `POST /api/threads/[id]/turns {input≤8000, idempotencyKey}`                     | turns route       | VICT command `agent.turn.start` (not an application action; unchanged 07B) | n/a (released command contract)                                                                                                         | closed route parse; conversation link resolved SERVER-SIDE                                                    | released command boundary via `commandService`                                                                                                                                            | same actor; per-send client key reconciles duplicate sends                                                                                                                                                   | correlation row `qlt_thread_conversation` (Quellight-owned, 07B-bounded) + turn intent/ledger in VICT operational stores; Mastra transcript via released executor | `{ok,data:{turnId,streamId}}` + `vict.agent-stream@1` SSE                                                                             |
| E7  | Reopen thread view | `GET /api/threads/[id]/messages`                                                | messages route    | read-only restore (no action)                                              | n/a                                                                                                                                     | n/a                                                                                                           | none (VICT-authoritative turn records gate the Mastra read)                                                                                                                               | server-side                                                                                                                                                                                                  | read-only                                                                                                                                                         | thread + conversation + messages + turns                                                                                              |
| E8  | Stream/proxy       | `/vict/[...path]`                                                               | proxy             | released loopback commands/SSE                                             | n/a                                                                                                                                     | released transport contract (256 KiB body bound; closed `{payload}` envelope; idempotency-key header)         | released `createVictHttpServer`                                                                                                                                                           | token injected SERVER-SIDE only; allowlisted headers                                                                                                                                                         | VICT-owned stores                                                                                                                                                 | released behavior                                                                                                                     |
| —   | Health             | `GET /api/health`                                                               | health route      | read-only self-description                                                 | n/a                                                                                                                                     | n/a                                                                                                           | none                                                                                                                                                                                      | n/a                                                                                                                                                                                                          | none                                                                                                                                                              | mode/release/deadline                                                                                                                 |
| —   | Plan screen        | `/` page load                                                                   | `[...vict]` page  | view data read                                                             | `loadRoute` (declared routes only; unknown → 404)                                                                                       | n/a                                                                                                           | none — direct adapter QUERY with `effect:'read'`                                                                                                                                          | server-side                                                                                                                                                                                                  | read-only SELECT                                                                                                                                                  | view data                                                                                                                             |

**Complete-effect census:** the ONLY server-side durable writes outside
`/api/act` are (a) the 07B-bounded `qlt_thread_conversation` correlation
insert inside the turn-start flow (unchanged by Q1; server-derived; not
Shared World meaning), (b) VICT-owned operational writes (turn intents,
stream ledger, command receipts) through the released command boundary,
and (c) Mastra conversation-store writes through the released turn
executor. No route imports `node:sqlite`, `store-sqlite`,
`$lib/sharedworld/sqlite`, or `DatabaseSync`; no inline SQL exists in
any route (structural gate re-verified).

## 6. `/api/act` thinness and bypass analysis

Source inspection + runtime probes establish that the ingress performs
ONLY: identity acquisition (server-side), closed request parsing
(`actionId`/`input`/`idempotencyKey` — the route destructures exactly
these), plan lookup (routing only), invocation of the released boundary,
and truthful result translation. It does NOT:

- call the data adapter directly (removed; permanent structural gate);
- access SQLite (no store import in any route — gated);
- retain `sharedWorldActionBoundary` (removed; gated);
- select a schema outside the compiled plan (the envelope is resolved
  against the composed plan inside `remoteMutateEnvelope`;
  `resourceId`/`op`/revision mismatches fail
  `VICT_APPDATA_ACTION_UNRESOLVED`);
- accept an undeclared action (ingress `UNKNOWN_ACTION` + boundary
  `VICT_APPDATA_ACTION_UNRESOLVED`; probe-proven both);
- take mutation input from headers, cookies, query, or ambient state
  (probe-proven inert; the payload is built only from the parsed body
  and plan constants);
- contain a fallback mutation path (the legacy identity-only payload —
  via `/api/act` shape or the `/vict` proxy — returns
  `QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED` with ZERO effects;
  probe-proven on both transports);
- act as a generic Shared World write endpoint (the five bounded actions
  are the entire composed surface; no Shared World record family exists).

The `id`-selection check: `operation` (`op`) always comes from the plan
(`action.op`) — a caller can supply only the declared `input` fields and
the target id; the caller cannot select another action, contract,
operation, resource, or revision (probes F2–F8). `app.data.query`
remains read-only and cannot effect (probe A5/A5b + adapter
`effect:'read'` authorization). No copied VICT semantics shadow the
released implementation — Quellight composes `remoteQuery`/`remoteMutate`
from the released `@victframework/server` and re-validates product
contracts only.

## 7. Identity, authorization, and provenance

- **Server-derived identity:** the single local actor is composed
  in-process (`authenticatedActorContext` over the directory record);
  the browser never holds a token (the proxy injects it server-side;
  `/api/act` needs none). Probes: spoofed `x-user-id`,
  `x-forwarded-user`, `authorization`, cookies, and body
  `actorId`/`roles`/`token` fields are inert — behavior identical to a
  clean request (H4/H4b).
- **Scope enforcement:** `app.data.mutate` requires `app.data.write`,
  `app.data.query` requires `app.data.read` (released
  `COMMAND_REGISTRY` + `assertCommandScope`); an actor lacking the scope
  is denied `VICT_ACTOR_SCOPE_DENIED` with ZERO adapter calls, ZERO
  database effects, and ZERO durable receipts (probe F1 — receipt table
  empty after denial). Scope is checked BEFORE the idempotency claim.
- **Attribution:** execution identity (actor), definition identity
  (`app.quellight@1` via the compiled plan), release binding
  (`quellight-local-1`; mismatch → `VICT_APPDATA_RELEASE_STALE`),
  action identity + revision (`VICT_APPDATA_ACTION_UNRESOLVED` on
  mismatch), capability/permission (`qlt.threads.write` enforced by the
  adapter under `effect:'write'`), and resource identity are all
  checked and attributable. Durable receipts bind
  actor+command+request digest and store safe projections only.
- **Error/receipt surfaces:** failures carry stable codes and bounded
  messages; the replay receipt carries identifiers only
  (`{command,resourceId,releaseVersion}`; UI-visible value is
  `{replayed:true}`). Credential canary probes (J1–J6): canary in an
  UNDECLARED field is rejected; canary inside a declared title becomes
  product domain data in `shared-world.db` ONLY (per handoff §6.10) and
  appears in NO VICT operational byte, NO receipt `result_json`, NO
  replay receipt, and NO Mastra store byte.

Every probed pre-handler failure (unknown action, undeclared action,
wrong action id, stale revision, tampered/foreign resource, wrong
release, unknown payload/envelope field, contract rejection, identity
mismatch, missing/malformed/oversized key) produced ZERO adapter
mutations and ZERO database effects.

## 8. Idempotency, concurrency, and crash boundaries

Independently probed (87/87 checks passed; summary below):

- identical retries converge (same payload digest → receipt replay; NO
  duplicate row; adapter key row unchanged);
- the replay receipt is `{ok:true,value:{replayed:true}}` — identifiers
  only, never a fabricated row (G2/G3, H6, K3);
- concurrent identical requests → exactly ONE row; the loser receives
  the stable `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` (G5/G5b);
- same key + different payload → `VICT_COMMAND_IDEMPOTENCY_CONFLICT`
  (G3, H9); same key across different actions → conflict (G4, H10);
  same key across actors is namespaced (actorId ∈ claim namespace) and
  cannot collide;
- missing/malformed/oversized keys fail at the ingress
  (`IDEMPOTENCY_KEY_REQUIRED`; pattern byte-equal to the released
  `COMMAND_IDEMPOTENCY_KEY_PATTERN`) and at the machinery
  (`VICT_COMMAND_IDEMPOTENCY_KEY_INVALID` before any claim, K1);
- deterministic create identity: same key ⇒ same
  `qlt-<24hex>` payload ⇒ reconcile; different keys ⇒ distinct rows
  (G6/G7); one dispatch ⇒ at most one adapter mutation;
- adapter-level keyed fence: same adapter key with a different
  fingerprint → `DATA_IDEMPOTENCY_CONFLICT`, no second row (G8/G9).

Crash boundaries (durable claim/lease/fence machinery + keyed adapter
reconciliation; deterministic fault injection by receipt/lease
manipulation and duplicate-identity injection):

1. **Before durable claim** — invalid key / scope denial / validation
   failure: zero receipts, zero rows, zero adapter calls (F1, K1).
2. **After claim, before/at handler** — expired-lease takeover
   re-executes fenced (K2): takeover produced the row ONCE; the adapter
   key prevented any duplicate (`SELECT COUNT(*)=1` after re-execution);
   a LIVE lease answers `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` (K4).
3. **During the SQLite transaction** — duplicate-identity injection
   forces the `qlt_thread` INSERT to fail UNIQUE inside
   `BEGIN IMMEDIATE` → ROLLBACK → the key row is NOT recorded (a failed
   transaction never consumes a key) and row count is unchanged (H2).
4. **After commit, before response** — claim left pending
   (crash simulation) → retry takes over the expired lease, the adapter
   reconciles the already-committed row, and the receipt settles
   truthfully; exactly one row exists (K2).
5. **After receipt persistence** — identical retry replays the safe
   identifiers-only projection with no effect (K3, G2).

Restart behavior: after SIGKILL of the production build and relaunch,
the thread list, titles, and lifecycle state are reconstructed
truthfully from the stores (probe R1/R2; the aggregate's restart suites
additionally pass).

## 9. Replay-receipt truthfulness (specific audit target)

Simulated end-to-end at the HTTP layer against the production build:
commit succeeds → response "lost" → client retries with the SAME
idempotency key → VICT returns the safe replay projection.

- **No duplicate effect:** thread total unchanged across the replay
  (H7: totals 2,2,2).
- **Replay shape:** `{ok:true,value:{replayed:true}}` — the released
  safe projection contains no row data (H6, H8).
- **UI truthfulness:** `createThread` refreshes the authoritative list
  BEFORE inspecting the value and only auto-opens when a real `id` is
  returned — the receipt is never mistaken for a new row; no false
  failure and no false success is shown (source-verified; the user sees
  the created thread in the refreshed list). `threadAction`
  (rename/archive/reopen) ignores the body and refreshes authoritative
  list + restore state unconditionally — a replay receipt is
  structurally indistinguishable from success and equally truthful.
- **Reload/restart:** truthful reconstruction verified (B6, R1/R2).
- **Compatibility claims:** the implementation report's stated replay
  shape and UI flow match observed behavior exactly.

**Replay-recovery verdict: SAFE — no product-level blocking finding.**
(Non-blocking note UI-1: after a replayed CREATE the UI does not
auto-select the thread; the refreshed list still surfaces it. Truthful;
cosmetic.)

## 10. SQLite and state-transition integrity

For every migrated action: exactly one intended transaction (row + key
row in ONE `BEGIN IMMEDIATE`/`COMMIT` for keyed create); ROLLBACK on
handler failure (H2 — mid-transaction failure leaves zero partial
state and consumes no key); archive/reopen transitions are valid and
idempotent (`dormant`↔`active`; rename refused while dormant with
`DATA_INVALID_REQUEST` and no effect — probe A3b); rename validation
(non-empty, ≤ 200, trimmed); create uniqueness (UNIQUE id → structured
`DATA_INVALID_INPUT`, no key consumption); reads remain truthful after
restart (R1/R2); validation/governance failures leave the database
logically unchanged (row + key counts compared before/after every
negative probe). **Q1 added no Shared World tables or migrations**
(`src/lib/sharedworld/**` byte-identical; `qlt_adapter_idempotency`
pre-existed at baseline).

## 11. Independent adversarial matrix (disposable probes)

87 app-server-level checks + 27 HTTP/browser-level checks executed
against the real composition and the production build. Selected matrix
(expected → actual; all "zero effects" verified by row/key/receipt
counts):

| Probe                                                                                  | Expected                                                            | Actual                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| unknown route action                                                                   | `UNKNOWN_ACTION`, 0 effects                                         | match                                                                                                   |
| undeclared application action at boundary                                              | `VICT_APPDATA_ACTION_UNRESOLVED`                                    | match                                                                                                   |
| wrong action ID / stale `expectedActionRevision`                                       | `VICT_APPDATA_ACTION_UNRESOLVED`                                    | match                                                                                                   |
| action vs foreign resource                                                             | `VICT_APPDATA_ACTION_UNRESOLVED`                                    | match                                                                                                   |
| wrong release binding                                                                  | `VICT_APPDATA_RELEASE_STALE`                                        | match                                                                                                   |
| unknown command payload field                                                          | `VICT_COMMAND_PAYLOAD_INVALID`                                      | match                                                                                                   |
| unknown envelope field                                                                 | stable closed-envelope code                                         | `VICT_COMMAND_PAYLOAD_INVALID`, 0 effects                                                               |
| unknown input field                                                                    | contract rejection                                                  | `VICT_APPDATA_INPUT_CONTRACT_REJECTED`, 0 effects                                                       |
| missing input / non-object input                                                       | `INVALID_REQUEST`                                                   | match                                                                                                   |
| empty / oversized (201>200) / multibyte-oversized title                                | fail closed                                                         | contract-fence rejection, 0 effects                                                                     |
| wrong input type                                                                       | fail closed                                                         | contract-fence rejection, 0 effects                                                                     |
| title at exact bound (200) and multibyte ≤ bound                                       | accepted                                                            | match (one transaction each)                                                                            |
| excessive nesting / hostile containers                                                 | fail closed                                                         | rejected (unknown-field fence; adapter containment)                                                     |
| `__proto__`/`constructor` in mutation input                                            | no injection, no persistence                                        | silently DROPPED by ingress (see LOW-2); row carries only declared columns; global prototype unpolluted |
| `__proto__` in query filters                                                           | no undeclared filter reaches SQL                                    | silently dropped by the sanitized rebuild; read-only                                                    |
| malformed JSON at HTTP                                                                 | 400 `INVALID_REQUEST`                                               | match                                                                                                   |
| identity spoofing (headers/cookies/body)                                               | inert                                                               | match; behavior identical to clean request                                                              |
| actor without `app.data.write`                                                         | `VICT_ACTOR_SCOPE_DENIED`, 0 receipts                               | match                                                                                                   |
| missing idempotency key (ingress / machinery)                                          | `IDEMPOTENCY_KEY_REQUIRED` / `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID` | match                                                                                                   |
| duplicate retry                                                                        | replayed identifiers-only receipt, 1 row                            | match                                                                                                   |
| concurrent duplicate                                                                   | 1 row; loser `…IN_PROGRESS`                                         | match                                                                                                   |
| same key / different payload; same key / different action                              | `VICT_COMMAND_IDEMPOTENCY_CONFLICT`                                 | match                                                                                                   |
| handler exception (unknown target)                                                     | structured failure, 0 effects                                       | `DATA_UNKNOWN_IDENTITY` via port mapping, 0 effects                                                     |
| transaction failure (UNIQUE mid-transaction)                                           | ROLLBACK; key NOT consumed                                          | match                                                                                                   |
| direct-route write attempt (legacy payload; ungoverned adapter context; undeclared op) | fail closed                                                         | `QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED` / adapter denials; 0 effects (both transports)               |
| local-checkout resolution                                                              | impossible                                                          | all realpaths inside Quellight `node_modules`; N-2 registry negative held                               |
| mixed VICT release                                                                     | gate fails                                                          | match (NC-1)                                                                                            |
| credential canary                                                                      | rejected; never persisted outside product data; never in receipts   | match (J1–J6)                                                                                           |
| tampered compiled plan                                                                 | tamper throws; resolution truthful                                  | plan deep-frozen; exactly the five declared actions                                                     |
| unavailable contract resolver                                                          | `VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE` (released fence)       | permanent test green; composition always supplies the resolver                                          |

## 12. Browser and regression evidence

Independent Playwright probe against the production adapter-node build
(`build/index.js`, offline fixture, throwaway data dir):

- workspace mounts with ZERO console warnings/errors across the whole
  session (B8);
- **real-browser create → rename → archive → reopen** through the
  island buttons: new thread appears and is selected; rename updates the
  title; archive renders `dormant` + read-only banner + disabled
  composer; reopen restores `active` (B2–B5) — the UI demonstrably uses
  the governed `/api/act` path with idempotency keys (network observed);
- reload reconstructs the truthful list and state (B6); SIGKILL restart
  reconstructs thread list and lifecycle truth (R1/R2);
- the aggregate's own real-browser gates pass (hydration smoke,
  responsive 390px/1280px, keyboard operability, axe serious/critical
  scan, and the F-1 real-click Stop regression against the released
  command boundary).

Streaming/Stop/restore/proxy: the Q1 diff touches none of these paths,
and an identical scenario probe on the BASELINE build reproduces the
TARGET behavior exactly (REG-1, below). Turn start, SSE, cancellation,
reconnect, and restore are governed by the same released 0.2.0
boundaries as in 07B; no live provider was used and no credential was
read.

**REG-1 (Informational, pre-existing):** with the production offline
fixture (empty script), an unscripted send yields an EMPTY completion
(released fixture contract: "a missing script entry responds with an
empty completion"), and per D-7 `text.delta` is transient (never
replayed). Whether an assistant bubble appears is therefore a
subscribe-vs-finish race; the durable reconcile truthfully reflects the
authoritative transcript (turn `completed`, user message persisted,
nothing fabricated). The auditor reproduced IDENTICAL outcomes on the
baseline build (`f25b03a`, 0.1.0) and the target build (0/5 vs 0/5 under
the same probe cadence) — pre-existing 07B behavior, NOT a Q1
regression.

## 13. Permanent-test and verifier adequacy

- **All previous suites still run:** node 6 files / 56 tests (5 prior
  files + governed-mutation) and ui 2 files / 6 tests, all green.
- **`verify:governance` is genuinely invoked** by
  `verify:quellight` step 2b (spawnSync, hard-failing `record()`), and
  passes standalone. Its structural scanning is complemented (not
  replaced) by runtime negative controls; the module-graph gate uses
  import/call patterns on real route files, and the released-boundary
  gate re-derives the compiled plan in-process through the installed
  released packages — trivial aliasing or helper indirection does not
  defeat the RUNTIME controls (direct-route attempts fail at the
  adapter/boundary regardless of source shape), which is the load-bearing
  layer.
- **`verify:consumer` independently detects** wrong pins, mixed sets,
  non-registry resolution, and missing integrity, and re-derives the
  recorded content identity FROM THE PUBLIC REGISTRY; the
  unreachable-registry negative control (N-2) is retained and passed.
  The recorded identity lives in `scripts/lib/release-set.mjs` and is
  re-derived at gate time — silent drift fails gates and tests.
- **Permanent runtime negative controls** cover: unknown/undeclared
  actions, unknown payload/envelope/input fields, missing/invalid
  input, oversized multibyte input, wrong action id, stale revision,
  tampered plan, unavailable resolver, identity mismatch, missing key
  (ingress + machinery), duplicate retry, same-key/different-payload,
  handler failure, legacy-payload fail-closed, direct SQLite write
  denial, credential canary, mixed-set gate, realpath/no-local-checkout,
  and content-identity derivation — each with ZERO-effect assertions
  (row + adapter-key counts).
- **Gaps (non-blocking):** no permanent BROWSER-level replay-receipt
  test (LOW-3; the server-level replay contract is permanently tested,
  and the UI refresh flow was verified in this audit by disposable
  probe). No permanent test pins the empty-completion streaming race
  (pre-existing; INFO-2). No critical effect boundary lacks permanent
  protection.

## 14. Verification ladder (auditor-executed, clean environment)

Environment: Windows win32-x64, Node v22.13.1, npm 10.9.2. All exits
observed first-run; the one non-green baseline occurrence was
diagnosed (missing gitignored `.svelte-kit` generation in a fresh
worktree) before rerun; no timeout was raised, no suite excluded, no
assertion weakened, no failing command rerun to mask a failure.

| Command                                                 | Result                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` (fresh task-specific cache)                    | EXIT 0                                                                                                                                                                                                                          |
| `npm run format:check`                                  | EXIT 0                                                                                                                                                                                                                          |
| `npm run typecheck`                                     | EXIT 0                                                                                                                                                                                                                          |
| `npm test` (`test:node` + `test:ui`)                    | EXIT 0 — node 6 files/56 tests; ui 2 files/6 tests                                                                                                                                                                              |
| `npm run build`                                         | EXIT 0 (build-log scan: 1 warning line, closed allowlist)                                                                                                                                                                       |
| `npm run verify:consumer`                               | EXIT 0 (13-member identity re-derived; N-2 held)                                                                                                                                                                                |
| `npm run verify:governance`                             | EXIT 0 (standalone AND inside aggregate step 2b)                                                                                                                                                                                |
| `npm run verify:quellight` (aggregate)                  | EXIT 0 — steps: format, typecheck, governance, node tests, ui tests, build+scan, real-browser check, real-browser Stop regression (= `verify:stop`), credential/canary/local-path artifact scan (159 files), `git diff --check` |
| `npm audit --omit=dev`                                  | EXIT 0 — 0 vulnerabilities                                                                                                                                                                                                      |
| `git diff --check`                                      | EXIT 0                                                                                                                                                                                                                          |
| Baseline `npm ci` + node suite at `f25b03a…` (worktree) | PASS — 5 files / 28 tests                                                                                                                                                                                                       |
| Independent registry verification                       | 13/13 versions, dist-tags, integrity; content identity re-derived EQUAL                                                                                                                                                         |
| Independent dependency negative controls                | mixed set FAILS; tampered identity FAILS; correct set PASSES; omission caught by permanent realpath/require.resolve coverage (INFO-1)                                                                                           |
| Independent runtime adversarial probe                   | 87/87 checks passed                                                                                                                                                                                                             |
| Independent HTTP/browser probe                          | 26/27 passed; the 1 non-pass is REG-1 (baseline-identical, pre-existing)                                                                                                                                                        |
| Baseline-vs-target behavioral probe                     | identical outcomes (REG-1 parity evidence)                                                                                                                                                                                      |

## 15. Findings

| ID      | Severity      | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Disposition                                                                                  |
| ------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| DOC-1   | Low           | `docs/system-reference.md` §"What Quellight is" still says `@victframework/*@0.1.0` (contradicts the same document's Status section and D-10).                                                                                                                                                                                                                                                                                                                                                                                   | Non-blocking; correct in a later documentation-only change.                                  |
| FENCE-1 | Low           | Prototype-named unknown request fields (`__proto__` via JSON.parse, `constructor`, etc.) are silently DROPPED at the ingress fence (prototype-chain lookup in the field check; fresh envelope construction) instead of rejected; the query `filters` rebuild likewise drops `__proto__`. Proven harmless: nothing propagates into the envelope, contract fence, adapter, or rows (rows carry only declared columns; global prototype unpolluted; VICT's own envelope fence and the adapter's array-based fence remain in depth). | Non-blocking; recommend explicit rejection for fence strictness in a later hardening change. |
| TEST-1  | Low           | No permanent browser-level test of the replay-receipt UI flow (the server contract IS permanently tested; the UI refresh flow was independently verified here).                                                                                                                                                                                                                                                                                                                                                                  | Non-blocking; add with Q2 browser work.                                                      |
| INFO-1  | Informational | The shared release-set gate fills unobserved members with the expected version (documented consumer-subset design), so member OMISSION alone does not fail THAT gate; omission is caught truthfully by the permanent realpath test (`require.resolve` of all 11 members), `npm ci`, and build/typecheck failure.                                                                                                                                                                                                                 | Recorded; no action required.                                                                |
| INFO-2  | Informational | Pre-existing, timing-dependent visibility of the assistant bubble with the empty-completion offline fixture (D-7 transient deltas); baseline-identical (REG-1).                                                                                                                                                                                                                                                                                                                                                                  | Recorded; belongs to 07B debt, not Q1.                                                       |
| INFO-3  | Informational | After a replayed CREATE the UI does not auto-select the created thread (truthful; the refreshed list surfaces it).                                                                                                                                                                                                                                                                                                                                                                                                               | Cosmetic.                                                                                    |

No blocking, High, or Medium findings. No effectful-route bypass,
caller-controlled authority, unresolved action/contract, actor spoofing
vector, duplicate/non-atomic effect, untruthful replay recovery,
mixed/local dependency resolution, missing critical negative control,
hidden Shared World implementation, or existing-browser regression was
found. No audit-process incident occurred (the single environmental
baseline hiccup was diagnosed and disclosed in §3).

## 16. Preservation and cleanup

- Audited implementation target unchanged: tracked tree clean; `HEAD ==
origin/main == 269fa21…` before and after the audit.
- VICT byte-identical at `18e3d223…` (tracked tree clean; `.pi/`
  untouched and unread); the public VICT registry was only read
  (fetch/npm view/curl GET) — no write, publish, deprecate, or tag
  operation was performed.
- Canonical input byte-identical (`e7f61d24…b01331` recomputed); all
  historical reports byte-identical (SHA-256 compared).
- Q2+ functionality remains unimplemented (no Shared World schema,
  proposal, ceremony, context, correction, retention enforcement).
- No credential or authentication file was read at any point.
- Every audit-created artifact was removed: baseline worktree (git
  worktree remove), fresh npm caches, downloaded tarballs, disposable
  probe scripts, temporary databases (including the H1 debug server
  process, killed), and log files; pre-existing untracked files were
  preserved; the tracked tree is clean and only this report is added by
  the audit commit.

## 17. Verdict

Phase Q1 is verified: the controlled adoption of the exact coordinated
public release `vict-release-set@1/0.2.0` is genuine and
registry-proven; `/api/act` is a genuinely thin transport over the
released governed mutation boundary with the historical accommodation
fully retired and permanently gated; identity, authority, idempotency,
crash, and replay behavior are truthful and independently reproduced;
existing 07B behavior is preserved; documentation is truthful with two
Low residues. The findings above are non-blocking.

```text
VERIFIED WITH NON-BLOCKING ISSUES — PHASE Q1 FORMAL CLOSURE PERMITTED
```
