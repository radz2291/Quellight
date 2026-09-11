# Quellight Stage 07C — Phase Q1 — Controlled Adoption of VICT 0.2.0

> **Class:** implementation report. This document records Phase Q1 of
> Stage 07C Phase Q (Quellight side): the controlled adoption of the
> released public set `@victframework/*@0.2.0` and the migration of the
> historical Stage 07B mutation accommodation to the released governed
> mutation boundary. It is NOT an independent verification. Nothing in
> this stage is "Verified" or "Closed" by this document.
>
> **Completion disposition (binding wording):**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q1 IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
> VICT 0.2.0 ADOPTED FROM THE PUBLIC IMMUTABLE RELEASE
> Shared World meaning and ceremony implementation has not begun.
> ```

## 0. Security prerequisite (npm publication token)

The temporary npm publication token used for the VICT 0.2.0 publication
was a 1-day self-expiring granular token recorded in the VICT publication
report (`260831-VCT-02/docs/report/VICT-0.2.0-PUBLICATION.md` §1: created
2026-09-10; configuration file created with owner-only permissions
OUTSIDE the repository, securely deleted after publication; the owner
advised to revoke; the token self-expires in one day). By the Q1 start
date the token has expired by its own recorded lifetime. No token value,
`.npmrc`, or credential file was inspected, read, copied, or used; Q1
used only public registry access.

## 1. Prerequisites and starting evidence

| Property                                                  | Value                                                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight starting SHA (fetch-verified)                   | `f25b03a322868b37c9fee732a767d91d3ab63f98` (`HEAD == origin/main`; tracked tree clean)                                                  |
| VICT read-only SHA (fetch-verified; unchanged throughout) | `18e3d223ef06948d3308b9b87a49b05ecab2ca8a` (`HEAD == origin/main`; untracked `.pi/` material preserved byte-identically and never read) |
| VICT authoritative release source                         | `5c81aca5e7a50f8f1e1711da1630cb6167b854c0` (ancestor of the documentation tip)                                                          |
| Environment                                               | Windows (win32-x64), Node v22.13.1, npm 10.9.2                                                                                          |
| Baseline release identity                                 | `vict-release-set@1/0.1.0`, content ID `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`                            |
| Adopted release identity                                  | `vict-release-set@1/0.2.0`, content ID `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`                            |
| Canonical persistent-cognitive-partner input              | SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` (unchanged)                                                  |
| No `AGENTS.md` exists in either repository                | verified by filesystem search                                                                                                           |
| Conflicting Q1 / Shared World work                        | none found (both fetches advanced nothing; VICT history inspected; no later-Phase work present)                                         |

## 1. Baseline verification (Phase 1)

The complete 07B offline verification ladder was executed at the starting
tree before any change (all exit 0):

| Command                    | Baseline result                                                |
| -------------------------- | -------------------------------------------------------------- |
| `npm ci`                   | PASS (lockfile reproduces)                                     |
| `npm run format:check`     | PASS                                                           |
| `npm run typecheck`        | PASS (0 errors)                                                |
| `npm test`                 | PASS — node: 5 files / 28 tests; ui: 2 files / 6 tests         |
| `npm run build`            | PASS (build-log scan: 1 warning line, on the closed allowlist) |
| `npm run verify:consumer`  | PASS (N-1/N-2, then-pinned 0.1.0)                              |
| `npm run verify:quellight` | PASS (aggregate incl. real-browser checks, exit 0)             |
| `npm audit --omit=dev`     | 0 vulnerabilities                                              |
| `git diff --check`         | clean                                                          |

### 1.1 Effectful-operation inventory (before migration)

Every effectful operation reachable through a product route:

| #   | Operation                   | Path                                             | Pre-Q1 effect path (07B accommodation)                                                                                                                                                                                                       |
| --- | --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Create Shared World thread  | `POST /api/act` `{actionId:'act.createThread'}`  | route → `application-server.dispatch` → plan lookup → local contract parse → **direct** `sharedWorld.adapter.mutate` (bypassing the released `app.data.mutate` command; D-4/D-9 accommodation) → one SQLite transaction in `shared-world.db` |
| E2  | Rename thread               | `POST /api/act` `{actionId:'act.renameThread'}`  | same direct-adapter accommodation                                                                                                                                                                                                            |
| E3  | Archive thread (`dormant`)  | `POST /api/act` `{actionId:'act.archiveThread'}` | same direct-adapter accommodation                                                                                                                                                                                                            |
| E4  | Reopen thread (`active`)    | `POST /api/act` `{actionId:'act.reopenThread'}`  | same direct-adapter accommodation                                                                                                                                                                                                            |
| E5  | List threads (read)         | `POST /api/act` `{actionId:'act.queryThreads'}`  | plan lookup → direct `adapter.query` (read; not an effect)                                                                                                                                                                                   |
| E6  | Start agent turn            | `POST /api/threads/[id]/turns`                   | released command boundary `agent.turn.start` (unchanged; not an accommodation)                                                                                                                                                               |
| E7  | Restore thread truth (read) | `GET /api/threads/[id]/messages`                 | VICT-authoritative restore read (unchanged)                                                                                                                                                                                                  |
| E8  | VICT commands / SSE         | `/vict/[...path]` server-side proxy              | released loopback boundary (unchanged)                                                                                                                                                                                                       |

Direct adapter/database-write calls reachable from routes, pre-Q1:

1. `application-server.dispatch` — mutations and queries cross the
   adapter directly (the historical D-4/D-9 accommodation; the ONE
   accommodation retired by Q1);
2. `composition.sharedWorldActionBoundary.mutate` — an exposed in-process
   parallel adapter-mutate forwarder (second accommodation; removed by
   Q1);
3. `[...vict]/+page.server.ts` — adapter **query** (read-only view data;
   reads require no capability governance and are unchanged).

### 1.2 Action-provenance matrix — BEFORE (Stage 07B)

| UI action     | Current route             | Declared application action                    | Input contract                    | VICT handler boundary              | Identity                          | SQLite transaction                           | Result/event              |
| ------------- | ------------------------- | ---------------------------------------------- | --------------------------------- | ---------------------------------- | --------------------------------- | -------------------------------------------- | ------------------------- |
| Create thread | `/api/act`                | `act.createThread@1` (mutation, op `create`)   | route-local string-bound contract | **direct adapter** (accommodation) | none (no command actor)           | `qlt_thread` insert (+keyed idempotency row) | `{ok,value:row}`          |
| Rename        | `/api/act`                | `act.renameThread@1` (mutation, op `rename`)   | local parse                       | **direct adapter**                 | none                              | `qlt_thread` update                          | `{ok,value:row}`          |
| Archive       | `/api/act`                | `act.archiveThread@1` (mutation, op `archive`) | local parse                       | **direct adapter**                 | none                              | `qlt_thread` update                          | `{ok,value:row}`          |
| Reopen        | `/api/act`                | `act.reopenThread@1` (mutation, op `reopen`)   | local parse                       | **direct adapter**                 | none                              | `qlt_thread` update                          | `{ok,value:row}`          |
| List          | `/api/act`                | `act.queryThreads@1` (query)                   | `{}`                              | **direct adapter**                 | none                              | read-only                                    | `{ok,value:{rows,total}}` |
| Send turn     | `/api/threads/[id]/turns` | `agent.turn.start` (VICT command)              | closed route parse                | released command boundary          | server-derived actor + client key | turn intent + ledger                         | `{ok,data}`               |

### 1.3 Action-provenance matrix — AFTER (Phase Q1, governed boundary)

| UI action     | Route                       | Declared application action                                                                                                              | Input contract                                       | VICT handler boundary                                                                                                           | Identity                                                                          | SQLite transaction                                   | Result/event                                                           |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Create thread | `/api/act` (thin transport) | `act.createThread@1` (mutation, op `create`, contract `qlt.threads.create.input@1`, idempotency `keyed`, permission `qlt.threads.write`) | `app.data.mutate` mutation envelope, contract-fenced | released `app.data.mutate` command → `remoteMutate` envelope (0.2.0) → plan-resolved action → `threadDataPort.mutate` → adapter | server-derived local actor (`app.data.write` scope) + command idempotency receipt | one `qlt_thread` insert (+key row, same transaction) | `{ok,value:row}`; durable receipt; replay `{ok,value:{replayed:true}}` |
| Rename        | `/api/act`                  | `act.renameThread@1` (op `rename`)                                                                                                       | closed `{title}`                                     | same released boundary                                                                                                          | same                                                                              | one `qlt_thread` update                              | `{ok,value:row}`                                                       |
| Archive       | `/api/act`                  | `act.archiveThread@1` (op `archive`)                                                                                                     | closed `{}`                                          | same                                                                                                                            | same                                                                              | `state → dormant`                                    | `{ok,value:row}`                                                       |
| Reopen        | `/api/act`                  | `act.reopenThread@1` (op `reopen`)                                                                                                       | closed `{}`                                          | same                                                                                                                            | same                                                                              | `state → active`                                     | `{ok,value:row}`                                                       |
| List          | `/api/act`                  | `act.queryThreads@1` (query)                                                                                                             | closed `{filters?}`                                  | released `app.data.query` command → `remoteQuery` → port → adapter                                                              | server-derived actor (`app.data.read` scope)                                      | read-only                                            | `{ok,value:{rows,total}}`                                              |
| Send turn     | `/api/threads/[id]/turns`   | `agent.turn.start`                                                                                                                       | unchanged                                            | unchanged released command boundary                                                                                             | unchanged                                                                         | unchanged                                            | unchanged                                                              |

All six effectful/read actions remain inside the bounded Stage 07B
behavior scope; no new product operation was added in Q1.

## 2. Independent verification of the public 0.2.0 release (Phase 2)

Using public registry access and a fresh task-specific cache:

1. **Versions**: `npm view` confirmed all 13 packages publish exactly
   `0.2.0` and `dist-tags.latest = 0.2.0` on every package (13/13);
   published versions are exactly `0.1.0`, `0.1.1`, `0.2.0` — no mixed
   set, and the temporary candidate tag `vict-0.2.0-rc` is removed
   (final dist-tags exactly `{latest: 0.2.0}`).
2. **Artifacts**: all 13 tarballs were downloaded from the registry
   URLs in each package's `dist.tarball` metadata (public registry
   only — never the VICT checkout).
3. **Coordinated content identity**: re-derived as the sha256 over the
   sorted, newline-joined `name@version` list of the 13-member set →
   `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`
   — EQUAL to the recorded identity.
4. **Integrity**: the downloaded tarballs' sha512 digests match the
   registry-published `dist.integrity` values (e.g. server
   `sha512-1qj3a0Ah…`, application `sha512-NYtBvWfw…`, runtime
   `sha512-QmsW1igX…`, contracts `sha512-usp8eqEt…`).
5. **Public declarations**: the installed `@victframework/server@0.2.0`
   type declarations expose the audited mutation boundary
   (`RemoteApplicationDataOptions.resolveAction` /
   `resolveInputContract`, `ResolvedApplicationAction`, and the closed
   bound constants `MUTATION_ENVELOPE_*` / `MUTATION_INPUT_*`), and the
   `app.data.mutate`/`app.data.action` command field sets carry the
   optional `actionId` / `expectedActionRevision` / `mutation` members.

The release identity was proven from the public registry; no local VICT
checkout was used as a substitute at any point.

## 3. Controlled dependency adoption (Phase 3)

Every Quellight `@victframework/*` manifest specifier moved from exact
`0.1.0` to exact `0.2.0`; the lockfile was updated through the normal
package-manager process (`npm install --legacy-peer-deps`, decision
register D-5) against the public registry only:

| Package                              | Before (package.json / lockfile / installed) | After                 |
| ------------------------------------ | -------------------------------------------- | --------------------- |
| `@victframework/application`         | 0.1.0 / 0.1.0 / 0.1.0                        | 0.2.0 / 0.2.0 / 0.2.0 |
| `@victframework/contracts`           | 0.1.0                                        | 0.2.0                 |
| `@victframework/control`             | 0.1.0                                        | 0.2.0                 |
| `@victframework/mastra`              | 0.1.0                                        | 0.2.0                 |
| `@victframework/renderer-svelte`     | 0.1.0                                        | 0.2.0                 |
| `@victframework/runtime`             | 0.1.0                                        | 0.2.0                 |
| `@victframework/sdk`                 | 0.1.0                                        | 0.2.0                 |
| `@victframework/server`              | 0.1.0                                        | 0.2.0                 |
| `@victframework/store-sqlite`        | 0.1.0                                        | 0.2.0                 |
| `@victframework/scaffolder` (dev)    | 0.1.0                                        | 0.2.0                 |
| `@victframework/kernel` (transitive) | 0.1.0                                        | 0.2.0                 |

- All specifiers are EXACT — no caret, tilde, wildcard, tag,
  workspace, file, git, or local path.
- The lockfile diff touches ONLY the eleven `@victframework` entries
  (verified: no non-VICT `version`/`resolved`/`integrity` line
  changed) — no broad dependency refresh; all unrelated external
  dependency versions preserved.
- Every lockfile VICT entry resolves from `https://registry.npmjs.org/`
  with sha512 integrity metadata; `npm ci` reproduces the graph.
- No 0.1.x VICT package remains anywhere in the installed graph
  (permanent test: 11/11 entries and installed manifests at 0.2.0).
- Every `@victframework` realpath resolves inside Quellight's
  `node_modules` — never inside the VICT repository (permanent test).

## 4. Migration of the bounded mutation path (Phase 4)

### 4.1 The historical accommodation retired

Stage 07B routed thread mutations through `/api/act` →
`application-server.dispatch` → plan lookup → local contract parse →
**direct** `ApplicationDataAdapter.mutate` (decision register D-4/D-9:
the released `app.data.mutate` payload of 0.1.0 structurally could not
carry a mutation input). Q1 replaces this with the released governed
boundary — the D-9 entry-gate option 3: VICT corrected (Stage 07C Phase
F2/F3), independently verified, released as the immutable
`vict-release-set@1/0.2.0`, and adopted here through a controlled
compatibility change.

Retired and removed:

- the direct-adapter dispatch in `application-server.dispatch` (the
  function is now a thin transport — see below);
- the parallel in-process mutation shortcut
  `composition.sharedWorldActionBoundary` (removed from the composition
  interface and object; a permanent structural gate fails if it
  reappears).

There is now exactly ONE authoritative effect path for Quellight thread
mutations.

### 4.2 Definition-driven authority

The five existing effectful/read actions remain declared in the
authoritative Application Definition (`src/lib/application/definition.ts`,
schema `vict.application-definition@2`, app `app.quellight@1`) and are
now compiled with explicit `inputContractRevision: '1'`:

| Action                | Kind     | Op        | Input contract (closed fields) | Idempotency                              | Permission          |
| --------------------- | -------- | --------- | ------------------------------ | ---------------------------------------- | ------------------- |
| `act.queryThreads@1`  | query    | `list`    | —                              | —                                        | `qlt.threads.read`  |
| `act.createThread@1`  | mutation | `create`  | `{id?, title(≤200)}`           | `keyed` (resource declaration)           | `qlt.threads.write` |
| `act.renameThread@1`  | mutation | `rename`  | `{title(≤200)}`                | per-dispatch key required at the ingress | `qlt.threads.write` |
| `act.archiveThread@1` | mutation | `archive` | `{}`                           | per-dispatch key required                | `qlt.threads.write` |
| `act.reopenThread@1`  | mutation | `reopen`  | `{}`                           | per-dispatch key required at the ingress | `qlt.threads.write` |

The contracts were tightened from all-strings-any-field to CLOSED field
sets (unknown input field → rejection). Quellight owns these product
action and input schemas; nothing Quellight-specific entered VICT
(GOV-007 preserved; no `Record<string, unknown>` escape hatch; no
generic arbitrary-mutation action). The authoritative representation
remains the typed definition + compiled plan; YAML plays no role
(structurally gated).

### 4.3 `/api/act` — thin transport boundary

`src/routes/api/act/+server.ts` and `src/lib/server/application-server.ts`:

MAY (and does only):

- resolve the existing local user identity server-side (the
  single-actor envelope; the browser never supplies identity);
- parse the DECLARED request (closed body field set:
  `actionId`/`input`/`idempotencyKey`; closed per-action input fields);
- look up the action in the ONE compiled plan (routing only — the
  authoritative action resolution runs again, plan-based, inside the
  released boundary);
- invoke the released VICT 0.2.0 command boundary
  (`app.data.query` / `app.data.mutate` with the closed mutation
  envelope `mutation: {op, id, input, idempotencyKey}`, `actionId`,
  `expectedActionRevision`, `resourceId`, `releaseVersion`,
  `expectedRevision`, `actionKind`);
- translate governed results into truthful HTTP responses
  (unchanged shapes: `{ok,value:row}` / `{ok,value:{rows,total}}` /
  `{ok:false,code,message}`; a replayed durable receipt yields
  `{ok,value:{replayed:true}}` — identifiers only, never a fabricated
  row).

MAY NOT (all structurally prevented and negative-controlled):

- write SQLite directly (no store import in any route — gated);
- call the adapter through a parallel shortcut (the shortcut is removed
  and gated; the legacy identity-only payload still fails closed with
  `QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`);
- invent undeclared mutation fields (closed command + envelope field
  sets, proven by negative controls);
- select an input schema outside the compiled plan (the envelope is
  resolved and contract-fenced by the released boundary against the
  composed plan);
- use ambient mutable state or hidden headers as mutation input (the
  payload is built only from the parsed request + plan constants);
- bypass action resolution (`VICT_APPDATA_ACTION_UNRESOLVED` on any
  unknown/stale/mismatched action identity);
- perform an effect not declared in the Application Definition.

Server-generated thread identity: for `create`, the server-generated id
is now DETERMINISTIC in the idempotency key
(`qlt-<sha256(release+key)[:24]>`), so an identical retry carries an
identical payload and reconciles instead of creating a second row.

### 4.4 Composition changes

- The single compiled plan (`getCompiledPlan()`) and the closed product
  contract implementations are composed as
  `resolveAction`/`resolveInputContract` into the released
  `RemoteApplicationDataOptions` for BOTH the command-service
  `appData` wiring (loopback HTTP + CLI paths) and the ingress.
- `threadDataPort.mutate` forwards EXACTLY the conforming
  `ApplicationDataMutationRequest` shape
  (`{resourceId, op, input?, id?, idempotencyKey?}`) to the adapter
  under the declared governance context
  (`{permissions: ['qlt.threads.read','qlt.threads.write'], effect:'write'}`);
  legacy identity-only payloads (no operation) fail closed with the
  same stable code as in 07B (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`).
- The composition no longer exposes `sharedWorldActionBoundary`.

### 4.5 The required governed path, proved end-to-end

```text
Visible user action (island create/rename/archive/reopen click)
→ declared Quellight Application Definition action (act.*@1)
→ compiled action + closed input contract (compiled plan, plan-resolved)
→ public VICT 0.2.0 app.data.mutate command boundary
  (durable claim/lease/fenced idempotency; release binding; scope check)
→ remoteMutate envelope: compiled-plan action resolution + contract fence
→ resolved Quellight handler (threadDataPort → ApplicationDataAdapter)
→ identity and governance checks (server-derived actor; declared
  permissions; declared op; closed fields)
→ one SQLite transaction (row + keyed idempotency in shared-world.db)
→ attributable result/event (row value + durable command receipt)
```

Presentation-only actions (focus, panel visibility, local layout)
remain local and do not cross `/api/act`.

### 4.6 Input and identity discipline (as implemented)

- closed-field validation at three fences (ingress request schema →
  released contract fence → adapter declared-field policy);
- plan-resolved input contracts; correct action revision
  (`expectedActionRevision` checked by the boundary);
- user and execution identity (server-derived actor; `app.data.write`
  scope asserted below the transport);
- definition/release/action provenance (action id + revision +
  `quellight-local-1` release binding; durable receipts);
- stable idempotency keys across retries (client key per logical
  action, used as the command key AND the envelope domain key — the
  single-key composition convention; deterministic create identity);
- one dispatch → at most one adapter mutation (durable claim/fence +
  adapter keyed reconciliation);
- zero effects on validation, resolution, identity, or revision failure
  (proven by negative controls);
- non-echoing stable error responses;
- no persistence of credentials or secret-like material (canary
  negative control across all store bytes and receipts).

`/api/act` remains the bounded single ingress; it has NOT been
broadened into the general Shared World write architecture (Q2/Q3
boundary respected; D-9 preserved).

## 5. Permanent conformance enforcement (Phase 5)

New executable gates (all part of the aggregate ladder
`npm run verify:quellight`, step 2b, and runnable alone as
`npm run verify:governance`):

| Gate                        | Enforcement                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route module-graph          | `src/routes/**/+server.ts` must not import `node:sqlite`, `store-sqlite`, `$lib/sharedworld/sqlite`, use `DatabaseSync`, call `adapter.mutate/query` directly, contain inline SQL, or reference the retired shortcut                 |
| Retired accommodation       | `sharedWorldActionBoundary` must not reappear in the composition or the ingress                                                                                                                                                      |
| One effect path             | the ingress must dispatch `app.data.mutate`/`app.data.query` with plan-resolved identity (`actionId`/`expectedActionRevision`/`mutation`); the composition must wire `resolveAction`/`resolveInputContract` from `getCompiledPlan()` |
| Undeclared effectful action | every UI-referenced `act.*` identifier must exist in the re-derived compiled plan                                                                                                                                                    |
| Dependency graph            | every declared and installed VICT member at EXACT `0.2.0`; the resolved graph re-derives the recorded content identity; no forbidden protocol markers                                                                                |
| YAML is not governance      | no YAML file in `src`; the definition references no YAML semantics                                                                                                                                                                   |
| No local checkout           | `@victframework/server` must resolve at 0.2.0 inside Quellight's `node_modules`, never from the VICT repository                                                                                                                      |

`scripts/verify-consumer.mjs` now enforces: exact 0.2.0 pins; lockfile
registry-only resolution with integrity for the FULL resolved graph; the
shared compatibility gate (a mixed 0.1.x/0.2.0 set FAILS); and the
13-member coordinated content identity re-derived from the PUBLIC
REGISTRY (`v1_7a557983…8f172`); the unreachable-registry negative
control (N-2) is retained.

Runtime negative controls (executable, `test/governed-mutation.test.ts`,
28 permanent tests) cover the required matrix; every pre-handler failure
is proven with ZERO adapter effects (row counts and adapter idempotency
counts unchanged):

- adoption: exact-0.2.0 resolution; lockfile registry-only; mixed-set
  gate failure; realpath/no-local-checkout; content-identity derivation;
  audited-boundary constants;
- positive: every effectful action follows the declared path; the
  complete mutation request reaches the adapter value-for-value; exactly
  one intended SQLite effect per action; result and provenance
  attributable (durable receipt + adapter key row); identity-only
  compatibility truthful; UI/HTTP shapes unchanged;
- negative: unknown route action; undeclared application action; unknown
  command-payload and envelope fields; unknown input field; missing
  required input; contract-invalid input; oversized multibyte input;
  wrong action ID; stale action revision; tampered compiled plan
  (deep-frozen; tamper throws); unavailable contract resolver; identity
  mismatch (`VICT_ACTOR_SCOPE_DENIED`); missing idempotency key (ingress
  and machinery); duplicate retry (one row, replayed receipt); same key
  with different payload (`VICT_COMMAND_IDEMPOTENCY_CONFLICT`); handler
  failure (unknown target, truthful structured code); direct-route
  adapter invocation attempt (legacy payload fails closed);
  direct-route SQLite write attempt (undeclared op / ungoverned context
  denied); credential canary (rejected, absent from every store byte and
  error);
- structural + executable: `verify:governance` (module-graph evidence,
  provenance, dependency conformance) complements the runtime controls —
  never fragile substring scanning alone where a runtime control exists.

## 6. Verification ladder (observed on the implementation tree)

| Command                                            | Result                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm ci`                                           | PASS                                                                      |
| `npm run format:check`                             | PASS                                                                      |
| `npm run typecheck`                                | PASS (0 errors)                                                           |
| `npm test`                                         | PASS — node: 6 files / 56 tests; ui: 2 files / 6 tests                    |
| `npm run build`                                    | PASS (build-log scan: all warning lines on the closed allowlist)          |
| `npm run verify:stop`                              | PASS (real-browser Stop regression, included in the aggregate)            |
| `npm run verify:consumer`                          | PASS (0.2.0 set; content identity re-derived from the registry; N-2 held) |
| `npm run verify:quellight`                         | PASS (aggregate incl. governance gate + real-browser checks, exit 0)      |
| `npm run verify:governance`                        | PASS (structural gate)                                                    |
| `npm audit --omit=dev`                             | 0 vulnerabilities                                                         |
| `git diff --check`                                 | clean                                                                     |
| package-graph verification                         | PASS (`verify:governance` [5] + consumer gate [2b])                       |
| public-registry provenance                         | PASS (13-member content identity re-derived)                              |
| governed-mutation tests                            | 28/28                                                                     |
| route-bypass negative controls                     | PASS (legacy payload, ungoverned contexts, structural scan)               |
| SQLite transaction and restart proofs              | PASS (keyed same-transaction idempotency; existing restart suite green)   |
| browser regression tests                           | PASS (real-browser hydration/responsive/axe/Stop)                         |
| clean-install proof (fresh cache)                  | PASS (fresh task-specific npm cache; see §7)                              |
| local-checkout and mixed-release negative controls | PASS (runtime tests + executable gate)                                    |

No command was rerun to mask a failure; no timeout was increased; no
suite was excluded; no required assertion was weakened.

## 7. Clean-install proof

`npm ci` was executed with a fresh task-specific cache
(`/tmp/qlt-q1-npm-cache`), and the complete dependency graph resolved
exclusively from the public registry: 11 VICT members installed at
exactly 0.2.0 with sha512 integrity, realpaths inside Quellight's
`node_modules`, and `npm audit --omit=dev` clean. An unavailable
registry cannot fall back to a local checkout (registry probe negative
control + permanent realpath/lockfile tests).

## 8. Rollback

Truthful rollback path (documented; NOT executed):

1. Revert the complete Q1 implementation through version control: revert
   the two Q1 commits on `main` (or `git revert` their combined diff) —
   the source, tests, gates, and documentation return to the 07B state.
2. Restore the exact VICT 0.1.0 manifest and lockfile by restoring
   `package.json` and `package-lock.json` from `f25b03a…` and running
   `npm ci`. The public registry retains the complete 0.1.0 set —
   rollback pins the prior immutable release-set identity; nothing is
   unpublished or mutated.
3. The historical Stage 07B route implementation is restored ONLY
   through version-control reversal — never by re-implementing it in
   place, and never through a runtime dual-path toggle.
4. The rollback leaves a PURE 0.1.0 graph (no mixed sets; the mixed-set
   gate fails any partial adoption).

The public VICT 0.2.0 release is never mutated or rolled back.

## 9. Documentation

- This report (new).
- `docs/decision-register.md` — decision **D-10** (controlled adoption
  of the 0.2.0 release set; retirement of the D-4/D-9 accommodation) and
  the D-3/D-9 cross-references reconciled; no historical entry rewritten.
- `docs/system-reference.md` — current status and request-path sections
  updated for Q1; historical sections preserved.
- `README.md` — adopted release identity and stage status.
- Historical implementation, audit, remediation, re-verification, and
  closure reports remain BYTE-IDENTICAL.

## 10. Q1 boundary — what was NOT done

- No Shared World record schemas, proposals, confirmation ceremonies,
  context assembly, correction lineage, inspection UI, or retention
  enforcement were implemented (Stage 07C Phases Q2+ scope; Stage 07D/E
  untouched).
- `/api/act` was not broadened into the general Shared World write
  architecture.
- No live model provider was run and no provider credential was read.
- Q2–Q7 remain pending.

## 11. Carried non-blocking debt (unchanged from 07B closure)

- F-3 (Low, display-only `VICT_`-prefixed code), F-4 (Low, historical
  report placement), F-5 (Low, cosmetic verifier output), F-6/F-7
  (informational, development-only) — all preserved.
- New bounded debt from Q1: (a) a replayed mutation receipt answers with
  the released safe projection (`{ok,value:{replayed:true}}`), not the
  original row — truthful, and the intended UI flow refreshes from the
  query boundary; (b) the release identity is recorded in
  `scripts/lib/release-set.mjs` as recorded data and re-derived from the
  registry at gate time (a future set adoption updates that one record);
  (c) the structural gate complements, but cannot replace, the runtime
  negative controls (both are in place).

## 12. Commits

```text
feat(stage-07c): adopt governed VICT mutation boundary
docs(stage-07c): record Phase Q1 implementation
```

Both pushed by normal fast-forward after a fresh fetch;
`HEAD == origin/main` and a clean tracked tree at completion.
