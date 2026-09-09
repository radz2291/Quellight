# Quellight Stage 07B — Independent Verification

> **Class:** independent audit report (reference §27.3 discipline). Authored by
> an independent auditor process that did not implement, remediate, or publish
> any part of Stage 07B. The implementation report (`docs/stage-07b-report.md`)
> was reconciled against independently gathered evidence, never cited as proof.
> No implementation code, test, or normative document was modified by this
> audit. No defect was fixed. The VICT repository was read-only throughout;
> its pre-existing untracked `.pi/` material remains byte-untouched. All audit
> probes ran in temporary directories outside both repositories and were
> removed after the audit.

**Verdict (see §14):**

```text
NOT VERIFIED — REMEDIATION REQUIRED
```

One blocking conformance defect (F-1, the browser stop control) and the
unavailable independent live-provider proof (the audit process environment did
not contain `OLLAMA_API_KEY`) prevent a positive verdict. The complete offline
verification ladder, the full framework-conformance classification, all
independent dynamic probes, and every dependency/release check passed.

---

## 1. Exact SHAs, remote state, and environment

| Item | Value |
| --- | --- |
| Audited Quellight commit | `00ca458374f99f9cd35612affb71e9adbf01b70f` (expected prefix `00ca458` — match) |
| HEAD == `origin/main` at audit start and end | Yes (fetched before beginning; re-fetched before the audit commit; remote did not advance during the audit) |
| Commit chain under audit | `e53ee87 → 8f87245 → b63b4b6 → 2155cce → 9354a12 → 909e812 → 4aa82ed → 9184593 → 00ca458` (9 commits, linear, fast-forward history) |
| VICT governing baseline used | `e70b1a876bf7f4bad83a611f5333d86541a0b664` (System Reference v0.4.3, handoff issuance) |
| VICT `origin/main` at audit time | `13b4ef2a97d53560016b8d9771bb4847a84d5cf9` — two later owner commits beyond the baseline, classified read-only below |
| Working tree at audit start | Clean (no tracked modifications); no `.pi/` material exists in the Quellight repository; pre-existing ignored `node_modules/`, `build/`, `.svelte-kit/` only |
| Working tree at audit end (before audit commit) | Clean — only this report file is added |
| Environment | Windows 11 (win32-x64), Node v22.13.1, npm 10.9.2 (the recorded implementation pair; matches the declared VICT engines floor) |

**Later VICT commits — read-only classification (no influence on the audit target):**

| Commit | Content | Disposition |
| --- | --- | --- |
| `4fdabe2` | `fix(renderer): preserve declared navigation group order` — unpublished renderer source fix (GAP-CANDIDATE-2), pending independent verification and a future public release | Verified NOT present in the application: the installed `@victframework/renderer-svelte@0.1.0` `VitApp.svelte` still contains the superseded alphabetical-sort code that `4fdabe2` removes. Quellight provably consumes only the released `0.1.0` artifacts. |
| `13b4ef2` | `docs(application)` — System Reference v0.4.4 registration of the above | Documentation only; no bearing on the audited tree. |

## 2. Governing documents read (completely, before testing)

- Every applicable `AGENTS.md` — none exists in either repository (tracked or untracked; searched).
- VICT `docs/VICT-SYSTEM-REFERENCE.md` at `e70b1a8` (§0.11–§0.14, §5, §12, §15.3, §16, §17.4–§17.10, §21, §23 Stage 7, §24, §27 read in full; DATA-013/DATA-014 verified at source in the requirement tables).
- `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md` at `e70b1a8` (§1 authority/hash, §2–§6 ownership/memory/Shared World, §7 scope/exclusions, §8 first vertical, §9 roadmap, §10 QLT family, §11 OQ1–OQ6, §12 security/retention, §13 exit gate, §14 risks).
- `docs/handoff/VICT-STAGE-07B-QUELLIGHT-CONSUMER-BOOTSTRAP-HANDOFF.md` at `e70b1a8` (complete: §1–§17 including all 20 negative controls).
- `docs/RELEASE-COMPATIBILITY.md` at `e70b1a8` (complete).
- Stage 07A records: implementation report, independent verification (verdict `VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED`, audit at `cb9d74b`), formal closure — read in full.
- Every Quellight repository file: `docs/*` (canonical input, database, decision register, setup, stage-07b report, system reference), `README.md`, `package.json`, lockfile, all configs (`svelte.config.js`, `vite.config.ts`, `vitest*.config.ts`, `tsconfig.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.env.example`), every script (`verify-consumer`, `verify-quellight`, `verify-live-provider`, `browser-check`, `scaffold-host`, `check-format`), every source file (composition, runtime, model-seam, application-server, definition, registry, island, stream-client, sharedworld port/migrations/sqlite, all routes), every test (composition, reconnect, restart, sharedworld, ui/workspace, fixtures/quellight-worker), and the public exports/declarations of every consumed `@victframework/*@0.1.0` package as installed.

**Canonical input integrity:** `docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md` SHA-256 =
`e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` — **matches** the handoff value exactly; committed once at inception (`e53ee87`), never modified since; `.prettierignore` freezes it.

## 3. Repository inception and integrity

| Check | Result |
| --- | --- |
| Default branch `main`; single remote `origin` = `https://github.com/radz2291/Quellight` | PASS |
| No tags exist (content-derived release identity convention) | PASS |
| Linear history; fast-forward pushes only (remote never rewound; `00ca458` tip == remote tip) | PASS |
| `"private": true`, `"license": "UNLICENSED"`, no invented license text | PASS |
| `engines.node >= 22.13.0` exactly (no claim beyond the VICT floor) | PASS |
| `.env.example` carries variable NAMES only, no values | PASS |
| Full-history credential scan (fresh clone, all 9 commits): zero credential-shaped values | PASS |
| Git-tracked tree contains no store files, build outputs, `.env`, or local coding-agent material | PASS |

## 4. Exact VICT release consumption (independent)

| Check | Result |
| --- | --- |
| `package.json` direct deps: 9 × `@victframework/*@0.1.0` exact + `@victframework/scaffolder@0.1.0` (dev); no ranges | PASS |
| `appdata-sqlite`, `cli`, `kernel` not direct deps — consistent with handoff §8.4 (kernel transitive via sdk/runtime; appdata-sqlite explicitly excluded in 07B; cli optional) | PASS |
| Lockfile: 11 `@victframework/*` entries, all `0.1.0`, all `https://registry.npmjs.org/` resolved, all `sha512-` integrity | PASS |
| All 12 probed integrity hashes **equal the live registry `dist.integrity`** (retrieved independently during this audit) | PASS |
| Zero `workspace:` / `file:` / `link:` / `git+` / `git://` / `github:` markers anywhere in the lockfile | PASS |
| Transitive Mastra pins exactly as recorded by the adapter: `@mastra/core 1.64.0`, `@mastra/memory 1.28.2`, `@mastra/libsql 1.22.3`, `@mastra/observability 1.17.5` | PASS |
| Release-set content ID **independently recomputed** (`sha256` over sorted `name@version` list): `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d` — **match** | PASS |
| Fresh temp clone + new empty npm cache + explicit public registry: `npm ci` → 297 packages, typecheck, build, `verify:consumer` all green — **proves the app works with no VICT checkout present** | PASS |
| N-2 from a second fresh clone: `--registry=http://127.0.0.1:9/`, empty cache → **exit 1, 0 files installed** (node_modules contains only empty directory stubs), 0 cache entries, no fallback of any kind | PASS |
| Later VICT repository commits (`4fdabe2`, `13b4ef2`) absent from the installed tree | PASS (§1) |

## 5. Verification ladder (one pass, no rerun-to-mask)

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm ci` (audit target) | 0 | 297 packages; note: transitive dev-only `posthog-node` emits an `EBADENGINE` warning (`^20.20.0 \|\| >=22.22.0` vs Node 22.13.1) — warning only, install succeeds (F-6) |
| 2 | `npm run format:check` | 0 | prettier clean |
| 3 | `npm run typecheck` | 0 | `tsc --noEmit` clean |
| 4 | `npm test` | 0 | node-side: **4 files / 23 tests passed**; browser-side: **1 file / 3 tests passed** (26 total) |
| 5 | `npm run build` | 0 | adapter-node; exactly 2 warning lines, both on the documented closed allowlist (`node:sqlite` externalization, zod internal circular dependency) |
| 6 | `npm run verify:consumer` | 0 | N-1 registry-only proof + N-2 unreachable-registry negative control |
| 7 | `npm run verify:quellight` | 0 | aggregate: format, typecheck, both test suites, build + build-log scan (1 allowlisted warning line), **real-browser check**, artifact scan (146 files), `git diff --check` |
| 8 | `npm audit --omit=dev` | 0 | **0 vulnerabilities** in production dependencies (the install-time banner's 4 findings are all dev-dependency-only — F-7) |
| 9 | `git diff --check` | 0 | clean |
| 10 | `npm run verify:live-provider` (gate check) | 2 | **REFUSED** as designed: `QUELLIGHT_LIVE_PROOF` unset → gate refusal; the credential was also absent (§13) |

No failure occurred anywhere in the ladder; nothing was rerun, no timeout increased, no assertion weakened. Commands not defined in the repository: none — every handoff ladder command exists and was run (the handoff's `npm run dev`/`preview` are operator conveniences, not ladder items).

## 6. Independent dynamic probes (authored fresh for this audit)

All probes ran in temporary directories outside both repositories, against a
fresh clone of `00ca458` with its own `npm ci` (the VICT checkout was absent
from the entire environment). Probe files were deleted after the audit.

### P1 — VICT semantic ownership on a real conversation turn (15/16 core checks passed; the single non-pass is the auditor's own ESM-interceptor installation limitation, covered by P1b)

- Composed objects are released classes: hub = `AgentStreamHub` (`@victframework/runtime`), turnService = `AgentTurnService` (`@victframework/control`), commandService = `VictCommandService` (`@victframework/server`).
- A real `agent.turn.start` through the released command service completed; **all `hub.publish` calls flowed through the released `AgentStreamHub`** (interception on the released prototype observed 7 publishes); Quellight never authored a frame.
- Durable ledger sequence numbers strictly monotonic (`1,4,5,6,7` — deltas transient per contract); durable kinds restricted to the closed vocabulary; **exactly one terminal**.
- Durable frames carry a `contentRef` (`conversation:…`), **never raw content**.
- **Zero `ModelRouterLanguageModel` constructions and zero non-loopback fetches** during a full offline turn (P1b additionally confirms the turn record carries no live-profile identity and the mode is `offline-fixture`).
- Two conversation turns left `shared-world.db` structurally untouched (`qlt_thread=1`, `qlt_thread_conversation=1`, idempotency=0) — the conversation path has no Shared World write.
- Restore is truthful (completed turn content and status restored).

### P2 — `/vict` proxy disposition, reconnect, cancellation truthfulness (15/15)

- Production build (`build/index.js`) on an ephemeral port; upstream loopback VICT boundary located via process sockets (single extra 127.0.0.1 listener).
- Upstream denies unauthenticated requests (**401 default-deny**); the proxied origin serves the browser with **no token** (server-side injection); the actor token is absent from the served page.
- **Frames captured through the proxy and frames captured directly from the upstream are byte-identical** (7 common frames compared `raw` — zero differences, same order, exactly one terminal on each side). The proxy does not parse, reinterpret, buffer, or rewrite stream semantics.
- Cursor reconnect (`?cursor=v1:<streamId>:<seq>`) resumes strictly above the cursor, delivers exactly one terminal, and **does not restart the turn** (still exactly 1 turn record on the thread).
- Cancellation and post-cancel restore are truthful (exactly one terminal frame; statuses `completed`/`completed` when the fixture turn outran the cancel — an honest race, never fabricated).

### P2b — UI cancellation request shape (decisive, see F-1)

Through the real production proxy:

| Request body / headers | Result |
| --- | --- |
| `{"turnId":"…"}` (EXACTLY what the shipped island's stop control sends; no idempotency-key header) | **400 `VICT_HTTP_BODY_MALFORMED`** |
| `{"payload":{"turnId":"…","reasonCode":"user"}}` without `idempotency-key` header | 400 `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID` |
| `{"payload":{…}}` **with** `idempotency-key` header | **200** `{"ok":true,"data":{"result":{"turn":{…,"status":"running",…}},"accepted":true,"duplicate":false}}` |
| `{"payload":{}}` → `actor.whoami` (positive control) | 200 |

Released-source confirmation: `@victframework/server` `dist/http.js` validates the closed top-level envelope (`payload` + optional `schema: vict.command@1`; every other top-level field → `VICT_HTTP_BODY_MALFORMED`), maps `/vict/v1/turns/cancel` → `agent.turn.cancel` whose payload fields are `turnId`/`reasonCode`, and mutation commands require an idempotency key.

### P3 — forced released-VICT-boundary failure → fail-closed (6/6)

In a disposable copy, the released `@victframework/server` `handle()` was patched (node_modules only) to fail every HTTP request with 503. The production server then: page renders (in-process composition unaffected), in-process turn start/execution unaffected, **proxied SSE fails closed (503, forced-failure code, zero fabricated frames)**, proxied commands fail closed, and the VICT-authoritative restore remains truthful. **No alternate provider path exists** — the browser can reach the conversation machinery only through the released boundary.

### P4 — independent SIGKILL restart + credential canaries (8/8)

- setup → completed turn; second process SIGKILLed mid-turn; third process: thread list survives, completed content restored, the killed turn settles **`failed`/`VICT_TURN_INTERRUPTED`** — never fabricated as completed.
- With fresh high-entropy canaries planted as `OLLAMA_API_KEY` and `QUELLIGHT_ACTOR_TOKEN` (and live mode requested): the served page plus **every** served asset scanned — zero canary hits; all persisted bytes under the data dir (DB/WAL/SHM included) scanned — zero hits; a live-mode turn failing on the fake credential leaves **zero canary echo** in any persisted byte.

### P5 — adversarial stream frames vs the real client path (8/8)

Unknown kind → unhealthy/0 applied; missing schema marker → unhealthy/0; duplicate frames → applied once (`[1,2,3]`); seq regression below cursor → unhealthy/0; monotonic gap-ahead (bounded replay) → tolerated in order; **frames after a terminal ignored** (first terminal wins); JSON garbage → unhealthy/0. The client-side validator is the released `assertAgentStreamWireEnvelope` + `assertAgentStreamEvent` (no custom protocol).

### P6 — independent real-browser verification (12/14; the two FAILs are F-1's face)

Desktop 1280 + mobile 390: truthful disclosure (no continuity claims beyond Stage 07B), keyboard-only thread creation, composer focus, streaming response rendered, aria-live region present, zero horizontal overflow, **axe clean (no serious/critical) on both viewports**, no undefined leakage. The shipped **Stop button, clicked during a live turn in real Chromium, emitted `POST /vict/v1/turns/cancel` with body `{"turnId":"…"}` and no idempotency-key header** (captured via request interception) — the exact shape the released boundary rejects (F-1); the 400 then appears as a console error, which the island swallows. (The implementation's own browser check never clicks Stop, which is why its "zero console problems" assertion passes.)

### P7/P7b — turn-deadline seam (the implementation's N-6 test is a stub; substance verified independently)

`withTurnDeadline` returns the SAME instance with `doStream` shadowed; on clock-past-deadline mid-stream it emits **exactly one terminal `error` part** carrying only the fixed marker (no provider content), which the released adapter maps to the stable code `VICT_AGENT_TURN_FAILED` (adapter `dist/adapter.js` line ~803: `case 'error': … errorCode = 'VICT_AGENT_TURN_FAILED'`). N-4's sanitized-failure mapping (`VICT_AGENT_TURN_FAILED`, no raw provider text) is additionally proven by the permanent suite and reconciled here.

### Live-proof gate refusal

`npm run verify:live-provider` with neither gate variable nor credential set → **exit 2** with the stable sanitized refusal message (never part of `npm test`; no leak).

## 7. Framework-conformance classification

Applying the binding owner principle (*VICT-defined semantics must be executed and enforced through released VICT contracts, compilers, runtimes, adapters, capability boundaries, and protocols; Quellight may extend at documented product boundaries but may not reimplement or bypass framework-owned semantics*):

| Category | Quellight code |
| --- | --- |
| **1. VICT-owned behavior (executed through released public APIs)** | Turn lifecycle, idempotent `agent.turn.start`, cancellation intent, terminal arbitration, stream frame construction, per-stream sequence assignment, cursor encode/decode, replay/reconnect, durable delivery truth, wire schema validation, actor authentication/scopes, operator configuration and protected credential resolution, Mastra composition (dedicated store, profile registry/activation, offline fixture, capability-bridge fencing), HTTP/SSE transport, Application Definition compilation, renderer (`VitApp`), component registry, application-data conformance fixtures |
| **2. Allowed Quellight product behavior** | Conversation workspace island (presentation, states, a11y), product wording/disclosure, thread titles, offline fixture scripts, client-side cursor bookkeeping (dedupe/last-ack), deadline policy value, retry-is-a-new-send policy, Shared World store domain (its schema, migrations, port, SQLite adapter — Quellight-owned by the handoff §6 decision) |
| **3. Bounded adapter or registered extension** | `/vict` proxy (thin transport: inject token, allowlist headers, byte pass-through — proven P2), `model-seam.ts` (`ModelRouterLanguageModel` construction + `withTurnDeadline` instance shadow — the only `@mastra/*` import; the released `composeMastraTurnExecutor` **requires** a consumer-supplied `modelFactory` and no released live-model constructor exists to bypass), `/api/act` dispatch glue over the released `ApplicationDataAdapter` port with declared contracts, `/api/threads/*` composition glue, `inputContract` implementations (released `Contract` shape) |
| **4. Framework gap** | Released `app.data.mutate` payload structurally cannot carry a mutation (`remoteMutate` forwards only `kind/resourceId/releaseVersion/actorId/expectedRevision/actionKind` — verified at released source); **honestly documented** (D-4, report §7) and fail-closed on the command path (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`, negative-controlled). Also: no released `contentRef` dereference helper — Quellight dereferences via the released dedicated-store handle (documented D-7). |
| **5. Shadow implementation or bypass** | **None found.** No custom stream/cursor/terminal/cancellation semantics; no alternate provider execution; no VICT internals imports (zero `/dist/`, `/src/`, `/internal` imports); no copied VICT validators, state machines, or error codes (the one `VICT_`-prefixed string is display-only — F-3); no fallback provider path (P3); no hidden mutation protocol pretending to be `app.data.mutate` (it fails closed and is negative-controlled). |

YAML is absent — per the binding clarification this is **not a finding**; the authoritative representation is the typed Application Definition + compiled plan.

## 8. Critical-path conformance map

| Concern | VICT package/export that owns it | Quellight adapter | Dynamic evidence | Class | Verdict |
| --- | --- | --- | --- | --- | --- |
| Application-definition compilation & action dispatch | `@victframework/sdk` `defineApplication/defineResource`; `@victframework/application` `compileApplication`, `ApplicationPlan`, `ActionResult` | `src/lib/application/definition.ts` (author-owned definitions); `application-server.ts` `dispatch` (declared actions only) | P2 createThread via declared action; unknown actions refused (`UNKNOWN_ACTION`) | 1+2 | PASS |
| Provider execution | `@victframework/mastra` `composeMastraTurnExecutor`, `MastraProductAgent`, `createDeterministicOfflineModel`; pinned `@mastra/core` router | `model-seam.ts` `createLiveProviderModel` (router intent only) + `withTurnDeadline` | P1: 0 router constructions, 0 non-loopback fetches offline; P3: no alternate path | 3 | PASS (F-2 note) |
| Conversation identity | `@victframework/control` `AgentTurnService` ids; ledger | supplies id **generator functions** only (`composition.ts` `ids`) | P1 turn/stream ids ledger-bound | 1 | PASS |
| Stream frame construction | `@victframework/runtime` `AgentStreamHub` (schema-gated publish); `@victframework/server` SSE transport | none (parse-only in the island) | P1: all publishes via released hub; no `enqueue` of SSE frames in src | 1 | PASS |
| Sequence & cursor assignment | Durable ledger (monotonic, restart-surviving); `encodeStreamCursor/decodeStreamCursor` in `@victframework/server` | none (client tracks last-ack only) | P1 monotonic `1,4,5,6,7`; P2 cursor honored | 1 | PASS |
| Reconnect & replay | `AgentStreamHub` replay (durable rows + buffered transients, `olderThanBuffer`); server cursor route | island `connectAgentStream` (bounded attempts, dedupe, released validators) | P2: resume > cursor, one terminal, no turn restart | 1+3 | PASS |
| Cancellation & terminal arbitration | `AgentTurnService.cancelTurn` (durable intent, AbortSignal, exactly one honest terminal) | island stop control → **broken request shape (F-1)**; service-level usage correct everywhere else | P2b/P6 (defect); P4 `VICT_TURN_INTERRUPTED`; N-5 single-terminal | 1 + **defect** | **FAIL (F-1, blocking)** |
| Durable delivery truth | `AgentStreamLedgerStore` (released store-sqlite) | none | P1 contentRef-only durable rows | 1 | PASS |
| Transcript persistence | `@victframework/mastra` `createDedicatedMastraStore` (dedicated file, retention bounds); released contentRef discipline (milestones reference, never carry, content) | `restoreThread`: VICT turn records gate an actor-scoped, restore-only read (`vict-actor-…` matches released `mastraResourceIdForActor`) | P1 restore truthful; P4 transcripts survive SIGKILL | 1+3 | PASS (D-7 documented) |
| Shared World thread persistence | Quellight-owned by handoff §6 (VICT Application Layer adapter port + conformance suite) | `src/lib/sharedworld/*` (port, forward-only migrations, SQLite adapter) | released `runApplicationDataAdapterSuite` green; N-10/N-13; P1 isolation | 2 | PASS |
| Governed mutations & effects | `app.data.mutate` command → `remoteMutate` (identity-only payload — released gap); `ApplicationDataAdapter` + `ApplicationDataRequestContext` (typed authorized boundary, DATA-014) | `app.data.mutate` fails closed (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`, negative-controlled); mutations via `/api/act` → declared actions + contracts + adapter | released-source payload proof; test `app.data.mutate … fails closed`; stale-release control | 4+3 | PASS (F-8 residual) |
| Credential resolution | `@victframework/runtime` `resolveOperatorConfiguration`, `requireOperatorCredential`, `OperatorCredentialUnavailableError` | JIT resolution; env injection at the model seam only | N-16 fail-closed; P4 canaries absent everywhere | 1 | PASS |
| HTTP authentication | `@victframework/server` `createServerAuthenticator`/`createLocalTestAuthenticator` (default-deny) | `/vict` proxy injects the server-held token | P2: upstream 401 unauthenticated; token absent from page/assets | 1+3 | PASS |
| Browser wire validation | `@victframework/contracts` `assertAgentStreamWireEnvelope`, `assertAgentStreamEvent` | island stream-client (fail-closed unhealthy state) | P5 adversarial 8/8 | 1+3 | PASS |

## 9. User-action provenance map

| UI action | Presentation-only or effectful | Definition/action/capability identity | Runtime handler | Persistence or external effect | Governing VICT boundary | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Create thread | Effectful (durable) | `act.createThread` (declared mutation, contract `qlt.threads.create.input`) | `/api/act` → compiled-plan dispatch → `ApplicationDataAdapter.mutate` | `shared-world.db` row (keyed idempotency in-transaction) | Application Layer action + adapter port | PASS |
| Rename / Archive / Reopen thread | Effectful (durable) | `act.renameThread` / `act.archiveThread` / `act.reopenThread` (declared domain verbs) | same as above | `shared-world.db` update; archived = read-only enforced at the port | same | PASS |
| Open thread (list selection) | Presentation restore (reads only) | route/view `v.threads` + `GET /api/threads/[id]/messages` | sharedWorld get + released turn-store read + actor-scoped memory read | none (read-only) | turn-record gate + contentRef discipline | PASS |
| Send message | Effectful (external provider call) | `agent.turn.start` command + client idempotency key; thread→conversation correlation server-side | `/api/threads/[id]/turns` → released `VictCommandService` | VICT turn/stream records; Mastra transcript; provider call via VICT/Mastra only | command service + turn executor + stream contract | PASS |
| Stop (cancel) | Effectful (durable cancel intent) | `agent.turn.cancel` command | island `stop()` → `/vict` proxy | should record durable cancel intent | released HTTP envelope + command registry | **FAIL — F-1 (blocking)** |
| Thread-list query | Presentation (read-only) | `act.queryThreads` (declared query) | `/api/act` → adapter `query` | none | adapter read boundary | PASS |
| Composer typing, focus, rename editing, state banners | Presentation-only | local component state | island | none | (no governance required) | PASS |

Every effectful action has a declared, auditable path; exactly one of them (Stop) is defective, and it is defective as a *client request-shape bug*, not a governance bypass.

## 10. Static import / network / database / protocol findings

- **`@victframework/*` imports (all public exports, verified against installed `index.d.ts`):** runtime (10 symbols), mastra (7), control (2), server (8), application (9 incl. `/renderer` + `/testing`), sdk (4), contracts (3), store-sqlite (3), renderer-svelte (`VitApp`, theme.css), scaffolder (dev script only). Zero deep/internal imports.
- **Direct `@mastra/*` imports:** exactly one — `ModelRouterLanguageModel` from `@mastra/core/llm` in `model-seam.ts`. Justification verified: the released `composeMastraTurnExecutor` contract requires a consumer-supplied `modelFactory`; `@victframework/mastra` publishes no live-model constructor; the handoff §8.5 itself prescribes resolution "through the pinned Mastra model router". **Minimal configuration required by the public VICT adapter — not a bypass.** No direct Mastra execution, memory, or persistence outside the adapter (memory access is via the released `DedicatedMastraStore.store` handle only).
- **Network endpoints:** the pinned `https://ollama.com/v1` constant (documentation value; the actual endpoint resolves through the pinned `@mastra/core` provider registry — verified registered url matches the owner decision) and `http://127.0.0.1` loopback. No other endpoints.
- **SQLite:** all SQL confined to `src/lib/sharedworld/*` (Quellight-owned store). No SQL against VICT or Mastra stores; VICT stores are accessed exclusively through released store APIs.
- **SSE frames:** none constructed anywhere in Quellight (server or client). The only `controller.enqueue` is the deadline seam's model-level `error` part (consumed by the released adapter, §6 P7b).
- **Event-name / sequence / replay / terminal implementations:** none authored; client-side bookkeeping (last-ack, dedupe, unhealthy marking) is consumption-side and stricter-or-equal to the released contract (P5).
- **Path aliases / module resolution:** standard SvelteKit `$lib` only; no VICT path overrides; no `paths` remapping of released packages.
- **Runtime fallbacks:** none on the conversation path. Live-mode absent credential → fail-closed `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` (negative-controlled). Forced boundary failure → closed failure (P3). The island's `stop()` `catch {}` is the one silent-failure site — F-1.
- **Copied VICT material:** none. Resource definition duplication between `definition.ts` and `sharedworld/sqlite.ts` is Quellight-internal consistency (both Quellight-owned declarations of the same resource), not a VICT internals copy.

## 11. `/vict` proxy disposition

**Thin transport boundary — proven, not shadow server.** Allowed behaviors only: server-side token injection (the only credential injection point), bounded header allowlist (`content-type`, `cache-control`, `x-vict-replay-bounded`, `x-vict-stream-newest-seq`, `x-vict-stream-cursor`), request body forwarding (≤256 KiB enforced upstream), byte pass-through of the response body, safe shutdown. Prohibited behaviors — creating events, assigning sequences/cursors, deciding terminal truth, replay semantics, synthesizing completion, reinterpreting cancellation, alternative provider calls, persisting records — are each absent statically and disproven dynamically (P2 byte-identity, P3 fail-closed under forced boundary failure).

## 12. `app.data.mutate` gap disposition

Verified at released-source level: `remoteMutate` (`@victframework/server/dist/app-remote.js`) forwards only `{kind, resourceId, releaseVersion, actorId, expectedRevision, actionKind}` — **no op, no input, no idempotencyKey field exists in the released payload**; `remoteAction` with `actionKind: 'mutation'` delegates to the same function, so no released command path can carry a mutation payload in `0.1.0`. D-4's finding is therefore **real, reproducible, and correctly characterized**.

Disposition classification:

1. The mutation does NOT use the released `app.data.mutate` command (impossible); it crosses the released **`ApplicationDataAdapter` port + `ApplicationDataRequestContext`** (the framework's typed, authorized application-data boundary — DATA-014's own definition), with declared plan actions, declared input contracts enforced at the boundary, closed vocabularies, keyed in-transaction idempotency, and the released conformance suite green. This is **category 3 (bounded adapter) built on a category 4 (framework gap)**, not a bypass.
2. The handoff requires user-initiated Shared World writes "through the typed Application Layer mutation boundary (DATA-014 discipline: contract-validated, authorized, idempotent)" — satisfied at the boundary the framework itself defines; the lost elements are transport-layer (command scope check — vacuous here: the single local actor holds the union `developer`+`operator` covering `agent.turn.*` and `app.data.*` scopes; release-binding check — applied on the `app.data.query` command path, not on `/api/act`).
3. None of the blocking patterns is present: no route reaching around the boundary (the adapter IS the boundary); no fake `app.data.mutate` (it fails closed, negative-controlled); no ambient/hidden mutable input (payload crosses explicitly in the HTTP body); no hidden second path (D-4, system-reference, and report all declare `/api/act` openly).

**Framework-change proposal:** confirmed and endorsed for the owners (D-4): extend the released `app.data.mutate` payload with an explicit closed mutation envelope so consumers can use the governed command path without weakening its closed-payload discipline.

## 13. Provider and credential evidence; live-proof status

- One pinned profile enforced in code: any other `QUELLIGHT_PROFILE` value throws `VICT_OPERATOR_CONFIG_INVALID` (test + source). No rotation, no fallback (`OQ4`).
- Live mode requires BOTH `QUELLIGHT_LIVE_PROOF=1` and the credential; absence → fail-closed `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` (negative-controlled; gate refusal exit 2 observed).
- **`OLLAMA_API_KEY` was explicitly absent from the audit process environment** (checked at audit start and re-checked at the live gate). Per the audit mandate, the independent bounded live proof (N-15) was therefore **NOT executed by this audit**, and the implementation's recorded live result (`docs/stage-07b-report.md` §6) is **not inherited as independent evidence**. The live-proof seam itself was verified offline: gate refusal (exit 2), credential-absent fail-closed composition, model-factory discipline (P1: zero live constructions offline), canary discipline with a fake credential (P4), and truthful failure mapping (P7b). The owner must inject `OLLAMA_API_KEY` into an independent audit process environment (with `QUELLIGHT_LIVE_PROOF=1`) for the bounded live proof to be re-run as part of remediation.
- Z.ai Coding Plan is not configured anywhere as a runtime provider (source + config scan).

## 14. Negative-control matrix (N-1 … N-20, independently verified)

| # | Control | Independent result |
| --- | --- | --- |
| N-1 | Registry-only clean install | **PASS** (fresh clone + empty cache + explicit registry; integrity == registry truth) |
| N-2 | Unreachable registry fails closed, no fallback | **PASS** (exit 1, 0 files installed, empty cache, no local fallback) |
| N-3 | Deterministic offline lifecycle, durable ordering | **PASS** (suite 23/23 + P1: monotonic ledger, closed vocabulary, contentRef-only) |
| N-4 | Completion only after final durable milestone; truncated never completed | **PASS** (suite: provider failure → `VICT_AGENT_TURN_FAILED`, no raw content) |
| N-5 | Cancellation: durable intent, exactly one honest terminal, no duplicate effect on retry | **PASS at the service/transport level** (suite + P2 single-terminal) — **but the UI stop control is broken (F-1)** |
| N-6 | Deadline expiry → stable safe code | **Substance PASS via P7b** (seam emits single error part → released adapter maps to `VICT_AGENT_TURN_FAILED`); the implementation's own N-6 test is a stub (F-2) |
| N-7 | Malformed frames rejected client-side | **PASS** (suite + P5 adversarial 8/8) |
| N-8 | Disconnect/reconnect from cursor; dedupe; restored content | **PASS** (suite real-loopback + P2 through the real production proxy) |
| N-9 | SIGKILL restart renders only durable truth | **PASS** (suite real child-process + P4 independent probe) |
| N-10 | Thread list/reopen; archived read-only | **PASS** (suite) |
| N-11 | Duplicate `agent.turn.start` idempotent | **PASS** (suite: same key → same turn, one record) |
| N-12 | No agent Shared World write path; Mastra loss ≠ Shared World loss | **PASS** (suite + P1 structural isolation; capabilities envelope empty; bridge invoke throws) |
| N-13 | Close/reopen; forward-only migrations | **PASS** (suite; newer-schema refusal verified) |
| N-14 | Credential canaries absent from every surface | **PASS** (suite + P4: page, assets, DB/WAL/SHM bytes, failed-live rows) |
| N-15 | Bounded live proof | **NOT INDEPENDENTLY EXECUTED — credential absent** (gate refusal verified; implementation's live run not inherited) |
| N-16 | Live gate fail-closed without credential | **PASS** (suite + observed refusal) |
| N-17 | Clean production build, zero hydration/runtime warnings | **PASS** (build allowlist scan + real-browser check; note: the check never clicks Stop — the F-1 400 surfaces as a console error in real use, P6) |
| N-18 | No unexpected build warnings (closed allowlist) | **PASS** (exactly the 2 documented notices) |
| N-19 | Responsive keyboard-accessible UI, axe, live region | **PASS** (browser-check + P6 independent: both viewports, keyboard flow, axe clean) |
| N-20 | Aggregate gate `verify:quellight` + `git diff --check` | **PASS** (exit 0) |

## 15. Findings

| ID | Severity | Blocking | Finding |
| --- | --- | --- | --- |
| **F-1** | **High** | **YES** | **The island's Stop control can never cancel a turn.** `ConversationWorkspace.svelte` `stop()` sends `POST /vict/v1/turns/cancel` with body `{"turnId":…}` and no `idempotency-key` header; the released boundary requires the `{"payload":{…}}` command envelope plus an idempotency key and deterministically rejects the island's request with 400 `VICT_HTTP_BODY_MALFORMED`. Proven statically (released envelope validation + command registry) and dynamically three ways (P2b through the real production proxy; P6 real-Chromium Stop click with request capture; the 400 appears as a browser console error). The island's `catch {}` swallows the failure, so the user sees "Stopping…" until the turn completes normally; the `cancelled` UI state and the "partial retained and marked" behavior are unreachable in real use. All implemented cancellation evidence (N-5 suite, live-proof script) drives cancellation via `turnService`/`commandService` below the HTTP boundary, which is why the defect never surfaced. Remediation: send the released envelope with an idempotency key (one-line-class fix), then re-verify the full stop flow in a real browser. |
| F-2 | Medium | NO | The implementation's N-6 negative-control test (`test/composition.test.ts`) is a **stub**: its body performs no deadline assertion and its comment defers to a "dedicated seam test below" that does not exist; the report's N-6 evidence pointer is therefore materially overstated. The deadline substance itself is verified (P7b 3/3 + released adapter error mapping), so the mechanism is not in doubt — but the recorded evidence does not match the claim. Recommend replacing the stub with a real deterministic deadline test at remediation. |
| F-3 | Low | NO | `VICT_STREAM_FRAME_INVALID` (island unhealthy-state display code) is a Quellight-invented code wearing the `VICT_` prefix; released stream diagnostics are `AGENT_STREAM_*`. Display-only (the released validators do the enforcement; the client accepts nothing the released contract rejects), so not a shadow protocol — but the prefix invites misattribution of authority. |
| F-4 | Low | NO | The implementation report lives at `docs/stage-07b-report.md` instead of the handoff-template path `docs/report/QUELLIGHT-STAGE-07B-IMPLEMENTATION-REPORT.md` (§8.1 reserves `docs/report/` for implementation/audit reports from 07B onward). Content requirements are otherwise substantially met. Reconcile placement (or record the deviation) at remediation. |
| F-5 | Low | NO | `scripts/verify-quellight.mjs` step 7 prints "artifact scan: PASS" whenever the accumulated failures contain no scan findings — even if earlier steps failed. Exit code is still correct (any failure exits 1). Cosmetic truthfulness of intermediate output only. |
| F-6 | Informational | NO | `npm ci` emits `EBADENGINE` for transitive dev dependency `posthog-node` (`^20.20.0 \|\| >=22.22.0` vs Node 22.13.1). Dev-only, warning-only, install and all gates green. |
| F-7 | Informational | NO | `npm ci` banner reports 4 audit findings (3 low, 1 critical) — **all dev-dependency-only**; `npm audit --omit=dev` reports 0 vulnerabilities. Production dependency tree is clean today; recommend periodic re-review at later stages. |
| F-8 | Informational | NO | `/api/act` does not cross the command-transport governance elements (actor-scope matrix — vacuous for the single actor who holds the union of required scopes; release-binding check — applied on the `app.data.query` command path only). Bounded consequence of the released `app.data.mutate` payload gap (§12); re-evaluate when the owners extend the released payload (D-4 proposal). |

## 16. Persistence ownership evidence

- Five logical domains, three physical SQLite files under one bounded relative data dir (`resolveProtectedStoreDir`): `vict-operational.db` (released `createSqliteStores` + `createSqliteAgentControlStores`), `mastra/mastra-store.db` (released `createDedicatedMastraStore` with executed retention bounds), `shared-world.db` (Quellight port). All outside publicly served directories; permission restriction via the released machinery; sidecars git-ignored.
- Ownership verified dynamically: conversation turns mutate only VICT/Mastra domains; `qlt_thread`/`qlt_thread_conversation` change only via the typed port; the turn record (VICT) governs the product view at restore; losing the conversation machinery leaves the thread list intact and the UI renders the wiped transcript truthfully (N-12 + P1).
- Exactly the permitted 07B Shared World record family exists (`qlt_thread`, `qlt_thread_conversation`, bookkeeping + adapter idempotency); no claims/commitments/loops/lineage tables; no continuity claims in product language (P6 disclosure check).

## 17. Genuine remaining limitations (of the audited stage, truthfully stated)

- Cancellation from the browser is broken until F-1 is remediated; cancellation evidence at the service/transport boundary stands.
- The independent bounded live-provider proof has not been performed by this audit (credential absent); live behavior is evidenced only by the implementation's own record, which is not independently authoritative, plus this audit's offline verification of the seam.
- The offline fixture answers only scripted prompts; unscripted input truthfully yields an empty response.
- Single-actor, single-process, local-only envelope (`MSTR-012` real-use proof remains 07D scope; QLT-017/Q1 obligations remain open by design).
- Deletion in 07B is retention-metadata marking, not Shared World meaning deletion (07D scope).

## 18. Recommendation — formal registration of the owner's enforcement principle

This audit applied the owner's binding clarification — *VICT-defined semantics must be executed and enforced through released VICT contracts, compilers, runtimes, adapters, capability boundaries, and protocols; consumers may extend at documented product boundaries but may not reimplement or bypass framework-owned semantics; YAML is neither required nor sufficient* — as an audit-normative principle. It is recommended that the owner formally register this principle in `docs/VICT-SYSTEM-REFERENCE.md` as a named, versioned consumption invariant (with the authoring-form neutrality stated explicitly), so that every future consumer audit (Quellight 07C–07E and any third-party consumer) can cite a registered requirement rather than a per-audit clarification, and so that framework-change proposals arising from consumer findings (e.g., D-4's `app.data.mutate` payload envelope) enter the standard `GOV-005` channel with a defined home.

## 19. Audit report integrity, repository mutation, and cleanup

- This file is the **only** repository change made by the audit (new file, no modification of any existing report or normative document; no implementation correction).
- Stage 07B is **not** formally closed by this document. Stage 07C–07E remain accepted-but-not-begun. The VICT repository was not modified; its `.pi/` material remains byte-untouched; the canonical input remains byte-identical.
- All temporary clones, probe copies, empty caches, probe databases, and browser artifacts created by this audit were removed after the audit; no probe was committed.

## 20. Verdict

The complete offline verification ladder passed; release consumption, framework conformance of every critical path except the UI stop control, persistence ownership, credential isolation, and 19 of the 20 negative controls are independently verified. However:

- **F-1 is a blocking conformance/functional defect** on the critical conversation path (browser-initiated cancellation cannot succeed and fails silently);
- **N-15 (the bounded live-provider proof) could not be independently executed** because `OLLAMA_API_KEY` was absent from the audit process environment, and a positive verdict is prohibited without it.

```text
NOT VERIFIED — REMEDIATION REQUIRED
```

**Required before re-audit:** (1) remediate F-1 (send the released command envelope with an idempotency key from the island's stop control; restore the end-to-end stop flow including the cancelled state and partial-marking in a real browser, with a regression test that clicks Stop); (2) inject `OLLAMA_API_KEY` into the independent audit process environment and re-run the bounded live proof (§8.10 bounds) as independent evidence; (3) recommend addressing F-2 (real N-6 test) and F-3/F-4 in the same pass.
