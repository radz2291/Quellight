# Quellight Stage 07B — Independent Re-Verification (post-remediation)

> **Class:** independent re-audit report (delta-focused, post-remediation).
> Authored by an independent auditor process that did not implement,
> remediate, or publish any part of Stage 07B and did not author the
> remediation. No remediation claim was inherited as evidence: every
> material claim was reproduced independently (fresh clean-clone ladder,
> independently authored probes, bounded independent live-provider proof).
> No implementation code, test, or pre-existing report was modified by this
> re-audit. No defect was fixed. The VICT repository was read-only
> throughout; its pre-existing untracked `.pi/` material remains
> byte-untouched. All probes ran in temporary directories outside both
> repositories and were removed after the re-audit.
>
> This report supersedes `QUELLIGHT-STAGE-07B-INDEPENDENT-VERIFICATION.md`
> **only for post-remediation status**. The original audit verdict is not
> altered retrospectively.

**Verdict (see §12):**

```text
VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED
```

F-1 and F-2 remediations are independently verified, the independent
bounded live-provider proof (N-15) was executed by this re-audit and
passed, the full verification ladder is green — including
`npm run format:check` and `npm run verify:quellight`, with no formatting
exception — and the remediation introduced no VICT bypass, no fallback, no
credential path, and no test-only production behavior. The remaining open
findings (F-3, F-4, F-5, F-8, F-6/F-7 informational) are all non-blocking
and are carried forward unchanged.

---

## 1. Exact SHAs, remote state, and audited commit

| Item                                                | Value                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Original implementation commit                      | `00ca458374f99f9cd35612affb71e9adbf01b70f`                                                    |
| Original independent audit commit                   | `45e6aa690e3caa9f68264d93143c7107c6d8e11f`                                                    |
| Remediation commit 1 (F-1 fix)                      | `666049180ad25f03b61530d63f119bc403596346`                                                    |
| Remediation commit 2 (strengthened tests)           | `2379d4b781e73f348b3eb42b379ecb462d4c4219`                                                    |
| Remediation commit 3 (remediation report)           | `65f1767eb5929caa0e5b18e3d4d1600d327b3b51`                                                    |
| Re-audit start state                                | `HEAD == origin/main == 65f1767…` (fetched and verified; clean tracked tree; linear ancestry) |
| **Formatting-only correction commit (Phase 0)**     | `587b1838731afc2c3c6eb164cc9dfd9f2f2c3a82`                                                    |
| **Audited commit (authoritative clean-clone base)** | `587b1838731afc2c3c6eb164cc9dfd9f2f2c3a82` — `HEAD == origin/main` verified after push        |
| Re-verification report commit                       | this commit                                                                                   |
| Environment                                         | Windows 11 (win32-x64), Node v22.13.1, npm 10.9.2                                             |

**Linear ancestry:** verified (`git log --graph`: no merges across the full
13-commit chain `e53ee87 → … → 65f1767 → 587b183`). All pushes in this
re-audit were normal fast-forward; the remote never rewound and never
advanced unexpectedly during the re-audit (re-fetched before the report
commit).

## 2. Canonical input integrity

`docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md`
SHA-256 =
`e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` —
verified **byte-identical** at re-audit start, after the formatting commit,
and at report time. The `.prettierignore` freeze is untouched.

## 3. Governing material read (completely, before testing)

- Every applicable `AGENTS.md`: **none exists** in the Quellight repository
  (searched) or its parent directories.
- VICT Stage 07B handoff
  (`260831-VCT-02/docs/handoff/VICT-STAGE-07B-QUELLIGHT-CONSUMER-BOOTSTRAP-HANDOFF.md`):
  read completely (§1–§17, all 20 negative controls).
- Quellight Stage 07B implementation report (`docs/stage-07b-report.md`):
  read completely.
- `docs/report/QUELLIGHT-STAGE-07B-INDEPENDENT-VERIFICATION.md` (prior
  audit): read completely.
- `docs/report/QUELLIGHT-STAGE-07B-REMEDIATION-01.md`: read completely.
- All ten files changed by the remediation (9 code/test files across
  `6660491` + `2379d4b`, plus the remediation report): diffed and read.
- The installed public contracts and emitted runtime of the consumed
  `@victframework/*@0.1.0` packages (public entry points: server
  envelope/command validation, runtime hub, mastra adapter exports,
  contracts validators) and the relevant test, browser, verification,
  persistence, proxy, and composition code.

## 4. Phase 0 — formatting-only correction (exactly as authorized)

The repository's configured formatter (`prettier`, repo `.prettierrc`) was
run on **exactly one file**:
`docs/report/QUELLIGHT-STAGE-07B-INDEPENDENT-VERIFICATION.md`.

Evidence that the change is formatting-only:

1. `prettier --check` failed on exactly that file before; passed after.
2. The complete diff is 119 insertions / 119 deletions (line-symmetric).
3. **Byte-determinism proof:** `git show 65f1767:<file> | prettier
--stdin-filepath <file>` is byte-identical to the committed result —
   the change is exactly the formatter's deterministic transformation of
   that file and nothing else.
4. **Content-invariance proof:** after stripping whitespace/table-padding
   and identifying prettier's emphasis-delimiter normalization
   (`*…*` → `_…_` on 3 prose lines; rendered Markdown semantics identical
   — both are emphasis, no intraword emphasis involved), the old and new
   files are **character-identical**. No wording, finding, verdict,
   evidence, number, or status changed.
5. `git diff -w` residual = table separator dash re-lengthening plus the
   3 emphasis-delimiter lines (both formatting normalizations above);
   `git diff --check` clean.
6. Committed separately as
   `docs(stage-07b): normalize audit report formatting` (`587b183`),
   pushed by normal fast-forward (`65f1767..587b183`).

No other existing report was modified. The authoritative clean-clone audit
started from the pushed formatting commit.

## 5. Verification ladder (fresh clean clone of `587b183`, fresh npm cache, once)

A fresh temporary clone of the pushed commit `587b183` (verified
`HEAD == origin/main`, clean tree) was installed and verified with a fresh
npm cache, outside both repositories, with `OLLAMA_API_KEY` and
`QUELLIGHT_LIVE_PROOF` unset:

| #   | Command                    | Exit  | Evidence                                                                                                                                                                                              |
| --- | -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm ci`                   | 0     | registry-only install from the committed lockfile                                                                                                                                                     |
| 2   | `npm run format:check`     | **0** | prettier clean — **the Phase 0 correction removed the previous drift; no green-gate exception remains**                                                                                               |
| 3   | `npm run typecheck`        | 0     | `tsc --noEmit` clean                                                                                                                                                                                  |
| 4   | `npm test`                 | 0     | node-side **5 files / 28 tests**; browser-side **2 files / 6 tests** (34 total)                                                                                                                       |
| 5   | `npm run build`            | 0     | adapter-node; exactly the 2 documented closed-allowlist notices                                                                                                                                       |
| 6   | `npm run verify:stop`      | 0     | old-commit negative control (worktree at `00ca458`) + full real-browser Stop flow (see §6/§7)                                                                                                         |
| 7   | `npm run verify:consumer`  | 0     | N-1 registry-only exact-pin proof + N-2 unreachable-registry fail-closed                                                                                                                              |
| 8   | `npm run verify:quellight` | **0** | aggregate: format, typecheck, both suites, build + build-log scan (allowlist clean), real-browser check (N-17/N-19), real-browser Stop regression (6b), artifact scan (152 files), `git diff --check` |
| 9   | `npm audit --omit=dev`     | 0     | **0 vulnerabilities** in production dependencies                                                                                                                                                      |
| 10  | `git diff --check`         | 0     | clean                                                                                                                                                                                                 |

`npm run verify:live-provider` was NOT run as a ladder item; the
independent live proof was instead performed by this re-audit's own probe
(§9), per the re-verification mandate. The shipped script's gate refusal
(credential/gate absent → exit 2) was verified in the remediation's own
ladder and the gate mechanism is unchanged on `587b183` (source-inspected;
the offline ladder ran with both variables unset and never touched the
provider).

No failure occurred anywhere in the ladder; nothing was rerun to mask a
failure; no timeout was increased; no assertion or test configuration was
changed. (One audit-process incident — RI-1 in §11 — damaged the disposable
clone's `node_modules` AFTER the first full gate pass had completed; the
environment was recovered via the only supported clean-install path and
`verify:consumer` + the full `verify:quellight` aggregate were re-passed
green in the recovered state, alongside the fresh `npm ci`.)

## 6. F-1 — independent verification (cancellation path)

### 6.1 Released-boundary contract (installed artifact, source-level)

Confirmed from the installed `@victframework/server@0.1.0`: the closed
top-level request envelope (`payload` + optional exact `schema:
vict.command@1`; any other top-level field → `400 VICT_HTTP_BODY_MALFORMED`),
the command registry mapping `POST /vict/v1/turns/cancel` →
`agent.turn.cancel` with the closed payload field set
(`turnId`, `reasonCode`) and `mutation: true`, and the bounded
`idempotency-key` header requirement
(`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`, else
`400 VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`).

### 6.2 Old-client negative control (independently reproduced, temporary worktree)

This re-audit authored its own probe (Probe A) and ran it against a
temporary isolated worktree of `00ca458…` (resolved through a junction to
the identical pinned release set; unlinked and removed afterwards —
`git worktree list` shows only the main checkout). The probe first tied
the old request shape to the actual old UI source
(`JSON.stringify({ turnId: activeTurnId })`, no idempotency-key header),
then sent real HTTP requests through that commit's real loopback boundary:

| Request (on `00ca458` boundary)                                  | Result                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| old UI shape `{"turnId":…}`, no header                           | **400 `VICT_HTTP_BODY_MALFORMED`** (the F-1 defect, reproduced)                                                                                        |
| released envelope `{payload:{turnId,reasonCode:"user"}}`, no key | **400 `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`**                                                                                                         |
| released envelope + valid key (mid-stream)                       | **200 `ok:true`, `accepted:true`** → durable stream settles with **exactly one `response.cancelled`** terminal and the turn record settles `cancelled` |

**5/5 PASS.** The defect was the client request shape; the boundary and the
released contract were already correct at `00ca458`.

### 6.3 The literal browser Stop click (independently authored real-browser probe)

Probe B drove the REAL application (real routes, real island, real `/vict`
proxy, real released in-process VICT boundary) in real Chromium, with the
audited check-only paced offline fixture runtime (only WHICH offline model
runs is substituted; the production composition, deadline seam, routes,
proxy, and boundary are the real code paths). All observation and
assertions are the probe's own. **16/16 PASS**:

| #   | Independent evidence                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Stop requests travel through the real `/vict` proxy (same-origin `/vict/v1/turns/cancel`)                                                                                                                             |
| B2  | request body is EXACTLY `{"payload":{"turnId":…,"reasonCode":"user"}}` (single top-level key)                                                                                                                         |
| B3  | non-empty `idempotency-key` header matching the released bounded pattern                                                                                                                                              |
| B4  | ONE intent, ONE key: two physical clicks on the real control reused the SAME key                                                                                                                                      |
| B5  | safe same-key retry from the page: durable dedupe/replay (200 `ok:true`), no error, no second intent                                                                                                                  |
| B6  | truthful non-terminal "stopping" state observed BEFORE the terminal                                                                                                                                                   |
| B7  | cancelled outcome visible and truthful ("Stopped. The partial response is retained and marked.")                                                                                                                      |
| B8  | authoritative stream via the real proxy: exactly ONE `response.cancelled` SSE event, zero `response.completed`/`response.failed`                                                                                      |
| B9  | persisted truth via the public restore route: exactly ONE turn record, status `cancelled`                                                                                                                             |
| B10 | reload + reopen restores the same cancelled truth; no fabricated completion                                                                                                                                           |
| B11 | post-terminal: the Stop control is not offered; no second effect possible from the UI                                                                                                                                 |
| B12 | a later distinct cancellation intent (new send → new Stop) received a NEW key                                                                                                                                         |
| B13 | malformed/unenveloped requests fail closed: old shape and non-object body → 400 `VICT_HTTP_BODY_MALFORMED`; missing key → 400 `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`; wrong schema marker → 400                       |
| B14 | zero requests to any other origin — no direct provider call, no direct loopback boundary contact, no internal cancellation shortcut                                                                                   |
| B15 | induced network failure → visible accessible failure banner (`CANCEL_REQUEST_UNDELIVERED`, `role="status"`), stream truthfully reverts, Stop retryable, never a false cancelled claim                                 |
| B16 | zero unexpected browser console errors/warnings and zero unexpected ≥400 responses during the real flows (the only console entries were the browser's automatic logs of this probe's own deliberate 400-probes/abort) |

The UI does not claim cancellation merely because the HTTP command was
accepted: acceptance renders only the intermediate truthful state (B6), and
the cancelled claim appears only with the authoritative stream terminal
(B7/B8). Cancellation failures are not swallowed (B15).

### 6.4 Persistence across reconnect, reload, and full-process restart

- Reconnect during cancellation + no second terminal: shipped browser
  regression (`verify:stop` step 1, observed PASS) and Probe B10.
- Full-process SIGKILL restart restoring the cancelled outcome with exactly
  one cancelled terminal: shipped browser regression (restart scenario,
  observed PASS) and Probe E10–E12 (live, §9).
- Restart reconciliation preserving terminal truth: Probe C (deadline
  terminal) and the permanent restart suite (N-9) green in the ladder.

**F-1 disposition: REMEDIATED AND INDEPENDENTLY VERIFIED (all 16 required
evidence items PASS).**

## 7. Production-seam review (`offlineModelFactory`)

- **Production behavior unchanged when the override is absent:** the only
  production composition entry (`src/lib/server/runtime.ts`
  `getQuellightRuntime`) passes `{ env, offlineScript }` — no factory
  option. The default path remains the released deterministic offline model
  wrapped in the production deadline seam, byte-identical logic to the
  pre-remediation composition (verified by diff inspection of `6660491`).
- **Live path untouched:** the live branch returns
  `withTurnDeadline(createLiveProviderModel(…), …)` BEFORE the offline
  branch is reached; the override is never consulted in live mode.
- **Not selectable through untrusted input:** composition options are
  hard-coded in server code; no HTTP route, browser state, database
  content, or ordinary environment variable constructs or selects the
  override. Every caller was enumerated (`grep` across `src`, `scripts`,
  `test`): only `test/composition.test.ts` (deadline proof) and
  `test/fixtures/stop-check-runtime.mts` (check-only runtime used by
  `scripts/browser-stop-check.mjs`).
- **No offline fixture or fallback can activate in production:** live mode
  requires `QUELLIGHT_LIVE_PROOF=1` AND the credential; absence fails
  closed (`VICT_OPERATOR_CREDENTIAL_UNAVAILABLE`, suite-proven). Forcing
  the provider path to fail still fails closed (Probe C: the real provider
  path driven past the deadline settles `failed`/`VICT_AGENT_TURN_FAILED`
  with a single terminal; suite N-4 sanitization).
- **Production bundles do not ship or select a fake model:** the built
  server chunk contains the option DECLARATION (part of the production
  composition module) but no fake model; the paced fixture lives only in
  `test/fixtures/` (never bundled); no production code path supplies the
  option. Bundle scan performed.
- **Used only by controlled tests:** confirmed by caller enumeration
  (above) and by `git status` cleanliness of the shipped tree.

### Dev-config inspection (Stop browser check)

The check generates a temporary Vite config: (a) a check-only plugin
aliases `$lib/server/runtime` to the fixture runtime (the declared
test-seam substitution), and (b) `optimizeDeps: { exclude:
['@victframework/renderer-svelte'] }`. Excluding that package from Vite's
dev-only esbuild prebundling changes only HOW the module is loaded in the
dev server (normal transform pipeline instead of the prebundler, whose
svelte-module pass cannot parse TypeScript in `.svelte.ts` library modules
under the pinned svelte version); the package's real code is still served
unchanged. The repository `vite.config.ts` is untouched (tracked tree
clean), and the production build path (the N-17 evidence path) is
unaffected. No production VICT behavior under test is replaced, mocked, or
bypassed by this setting.

## 8. F-2 — independent deadline proof

The remediated N-6 test was read and then **independently reproduced** by
this re-audit's own probe (Probe C, authored fresh, run against the clean
clone's real composition with controlled time and its own gate around the
RELEASED deterministic offline model):

| Requirement                                                        | Independent result                                                                                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the REAL configured `QUELLIGHT_TURN_DEADLINE_MS` is used           | PASS — resolved through `resolveQuellightEnvironment` → `env.turnDeadlineMs` (2 500 ms in the probe; 5 000 ms in the shipped test) and passed to the production deadline wrapper |
| the fixture remains genuinely pending before the deadline          | PASS — gate holds every stream part; `partsReleasedBeforeDeadline === 0`; turn `running` with ≥1 part waiting                                                                    |
| controlled time crosses the ACTUAL production deadline wrapper     | PASS — the stack trace shows the failure raised inside `withTurnDeadline` (`src/lib/server/model-seam.ts`), installed by the composition's own modelFactory                      |
| exactly one terminal failure                                       | PASS — durable ledger kinds `["response.started","usage.updated","response.failed"]`; exactly one terminal                                                                       |
| stable durable result `VICT_AGENT_TURN_FAILED`                     | PASS — sanitized code, no provider content in any durable row                                                                                                                    |
| no completion or cancellation terminal                             | PASS — none present                                                                                                                                                              |
| the model is invoked once; no retry, no second effect              | PASS — invocation count 1 after settle                                                                                                                                           |
| replay and restart reconciliation preserve the same terminal truth | PASS — replay from zero yields the same single `response.failed`; `reconcileAfterRestart()` preserves `failed`/`VICT_AGENT_TURN_FAILED` with no second terminal                  |

The shipped test does NOT manufacture the expected result: it exercises the
production deadline seam through the real composition. **10/10 PASS. F-2
disposition: REMEDIATED AND INDEPENDENTLY VERIFIED.**

## 9. N-15 — bounded independent live-provider proof (executed by this re-audit)

Executed with the owner-supplied credential present in the audit process
environment (injected by name; never printed, hashed, copied, or
serialized). This re-audit authored its own live proof (Probe E) rather
than running the shipped script: the REAL production build
(`build/index.js`, adapter-node) served the REAL application in live mode;
the cancellation was performed by **clicking the real visible browser Stop
control** through the real `/vict` proxy into the released VICT boundary —
no lower-level test helper.

**Provider turns: exactly THREE per execution** (two executions were
performed; see RI-2 in §11 — the first execution's functional evidence was
complete and green but this probe's own credential-scan section had a
scoping bug, so the proof was executed a second time to collect the full
mandated evidence set from one coherent run):

1. **t1 — ordinary completed turn:** PASS (completed in ~3.4 s; terminal
   reached in the UI).
2. **t2 — genuinely in-flight turn cancelled by the real Stop click:** PASS —
   captured mid-stream (assistant deltas rendered), the click sent
   `{"payload":{"turnId":…,"reasonCode":"user"}}` with a valid non-empty
   `idempotency-key` (`stop-…`) through `/vict/v1/turns/cancel`; the
   authoritative stream settled with **exactly one `response.cancelled`**
   and **no completion after cancellation** (run 1 capture:
   `response.started → text.delta×13 → usage.updated → response.cancelled`);
   partial content retained and truthfully marked in the UI.
3. **t3 — post-SIGKILL-restart completed turn:** PASS — the server process
   was SIGKILLed (verified dead; not a graceful shutdown), a fresh process
   was started on the same data dir, and the restored truth was exactly
   `["completed","cancelled"]`; t3 completed,
   final statuses `["completed","cancelled","completed"]` — exactly three
   provider turns, no second provider effect from reconnect or restart.

Additional live assertions (all PASS):

| #       | Evidence                                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1      | `/api/health`: `modelMode: "live"`, `profile: "ollama-cloud/glm-5.3-flash"`                                                                                                                              |
| E4      | during live streaming, the ONLY remote established TCP endpoint of the server process was `ollama.com` (resolved set; observed `34.36.133.15:443`) — no alternate model, provider, endpoint, or fallback |
| E8      | cursor reconnect (reload + reopen) restored the cancelled truth without restarting the model turn                                                                                                        |
| E9      | authoritative stream: exactly one `response.cancelled`, zero completion                                                                                                                                  |
| E11/E12 | fresh process restores the same durable truth; exactly three turn records total                                                                                                                          |
| E2      | the disclosure "transcript persistence is not Shared World continuity" is visibly present — transcript persistence is not presented as Shared World continuity                                           |
| E13     | credential AND loopback actor token absent from every persisted byte (data dir incl. DB/WAL/SHM, 102 files) and the entire build output (byte-level internal comparison; counts only)                    |
| E14     | credential absent from all captured server stdout/stderr                                                                                                                                                 |
| E15     | zero browser console errors/warnings during the live session                                                                                                                                             |
| E16     | credential and loopback token absent from served page HTML, captured SSE frames, and console output                                                                                                      |

**N-15 disposition: PASS (independently executed). The previous
missing-live-evidence blocker is RESOLVED.**

## 10. VICT alignment regression check

- **No shadow implementation (re-confirmed on the remediated tree):** no
  `response.cancelled`/terminal construction anywhere in `src` (only a doc
  comment reference); no stream-sequence or cursor-value assignment
  (client-side `lastSeq` bookkeeping is consumption-side only); no
  alternate terminal arbitration; no direct Ollama call (the only
  server-side `fetch` is the `/vict` proxy pass-through); no bypass of
  `@victframework/mastra` (exactly one `@mastra/*` import remains —
  `ModelRouterLanguageModel` in `model-seam.ts`, the composition the
  released adapter requires); no unpublished VICT source consumed (all
  imports are public entries of `@victframework/*@0.1.0` as installed).
- **The remediation introduced none of the prohibited patterns:** the Stop
  control crosses only the released HTTP command boundary (Probe B/E5); no
  test model factory is reachable at runtime (§7); no persistence or
  governance semantics moved into the UI.
- **`/vict` remains thin authenticated transport:** server-side token
  injection, bounded header allowlist, byte pass-through (prior audit's
  byte-identity evidence; unchanged by the remediation — the proxy module
  was not modified); Probe B14 (same-origin only) and Probe E5/E6.
- **Release-set integrity:** lockfile contains 11 `@victframework/*`
  entries, all `0.1.0`, all `https://registry.npmjs.org/` resolved, all
  `sha512-`; no `workspace:`/`file:`/`link:`/git specifiers. The release-set
  content ID was **independently recomputed** (SHA-256 over the sorted
  13-package `name@version` list):
  `v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d` — **MATCH**. (The only `0.1.1` string in the lockfile is the unrelated
  transitive `is-extendable@0.1.1`.)
- **VICT `0.1.1` preparation commit classified (read-only):** local VICT
  HEAD `2c8a7fb5c264c337ae8474603e693bfb19394d1e` = `chore(release):
prepare VICT 0.1.1` (owner-authored; documentation and package-version
  preparation for a future release). Classified read-only: it is NOT part
  of any consumed release; Quellight does not upgrade to it and does not
  consume it during this audit (all consumed pins remain the immutable
  `0.1.0` registry artifacts; the commit exists only in the local VICT
  checkout).
- **YAML:** absent — per the binding clarification, not a finding; VICT
  semantic enforcement is what matters and is confirmed above.

## 11. Incidents during this re-audit (diagnosed; no masking)

1. **RI-1 — disposable clone `node_modules` destruction (audit-process
   only).** While cleaning up the Probe A worktree, the auditor's junction
   removal failed (quoting error) and the subsequent `git worktree remove
--force` traversed the surviving junction into the audit clone's
   `node_modules`, emptying it — the same incident class the remediation
   itself documented and fixed in its script. Impact: ONLY the disposable
   audit clone's reinstallable dependencies, AFTER the first full
   `verify:quellight` pass had already completed green (the aggregate gate's
   own step-6b worktree teardown ran correctly earlier in that pass).
   Recovery: `npm ci` from the committed lockfile via the fresh cache;
   tracked tree remained clean throughout. `verify:consumer` and the FULL
   `verify:quellight` aggregate were then re-passed green (exit 0) in the
   recovered environment. No result above depends on the damaged state.
2. **RI-2 — Probe E executed twice (6 live provider turns total).** The
   first execution completed E1–E13 green (all functional live evidence)
   but its own credential-scan section crashed on a probe-side variable-
   scoping bug before E14–E16 (log/console/browser-surface scans). To
   produce the complete mandated evidence set from one coherent run, the
   probe was fixed (probe-side only; no product change) and executed once
   more. Each execution is within the mandated bound of ≤3 provider turns;
   total provider usage across both executions was 6 turns, all short, with
   zero automatic retries.

## 12. Findings and dispositions

| ID                                                                 | Disposition after re-verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F-1** (blocking; browser Stop control)                           | **CLOSED — remediated and independently verified.** Negative control reproduced at `00ca458` (old shape → 400 `VICT_HTTP_BODY_MALFORMED`); corrected contract accepted; literal browser Stop click sends the released envelope with a valid per-intent idempotency key through the real proxy; truthful states; exactly one durable `response.cancelled`; reconnect/reload/restart restore the same truth; failures surfaced accessibly; fail-closed on malformed input; zero unexpected console/network problems. |
| **F-2** (deadline-test stub)                                       | **CLOSED — remediated and independently verified.** Substantive controlled-time proof through the real composition and production deadline seam; independently reproduced 10/10 (§8).                                                                                                                                                                                                                                                                                                                              |
| **F-3** (Quellight display code wearing the `VICT_` prefix)        | **OPEN — non-blocking.** `VICT_STREAM_FRAME_INVALID` remains the island's display-only unhealthy code (display only; released validators enforce). The remediation's new code `CANCEL_REQUEST_UNDELIVERED` correctly avoids the prefix; no new `VICT_`-prefixed codes were invented.                                                                                                                                                                                                                               |
| **F-4** (implementation report placement)                          | **OPEN — non-blocking.** `docs/stage-07b-report.md` remains at `docs/` rather than the reserved `docs/report/` template path. Content requirements otherwise met.                                                                                                                                                                                                                                                                                                                                                  |
| **F-5** (verify-quellight step-7 intermediate print)               | **OPEN — non-blocking.** The step-7 "artifact scan: PASS" print still keys off scan-category failures only; exit code remains correct. Cosmetic.                                                                                                                                                                                                                                                                                                                                                                   |
| **F-6** (dev-only `EBADENGINE` on `npm ci`)                        | **OPEN — informational.** Unchanged; warning-only, dev-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **F-7** (dev-dependency audit findings)                            | **OPEN — informational.** `npm audit --omit=dev` = 0 vulnerabilities; production tree clean.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **F-8** (`/api/act` bounded by the released `app.data.mutate` gap) | **OPEN — non-blocking.** Unchanged by the remediation; the D-4 framework-change proposal stands for the owners.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Prior missing-live-evidence blocker                                | **RESOLVED** — N-15 independently executed and passed (§9).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| RI-1 / RI-2                                                        | Audit-process incidents only (§11); no product impact; fully documented.                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Blocking-pattern scan (remediation regression):** none present — no VICT
bypass, no false cancellation, no production fixture fallback, no credential
leak (byte-level scans, §9), no red gate (`format:check` 0, `verify:quellight`
0 — the previous formatting drift is normalized, not excepted).

## 13. Repository mutation, preservation, and cleanup

- After the separate Phase 0 formatting commit, the ONLY repository change
  made by this re-audit is this report file (new file; no existing report
  or normative document modified; no implementation correction).
- Canonical input re-hashed byte-identical (§2).
- VICT repository: zero changes (tracked tree clean; pre-existing untracked
  `.pi/` material byte-untouched). Quellight `.pi/` material (untracked)
  untouched.
- All temporary clones, the worktree (junction unlinked before removal),
  the fresh npm cache, probe files, probe data directories, browser
  instances, dev/production servers, and all probe processes were removed
  after the re-audit; no probe was committed; no listener remains.

## 14. Verdict

F-1 and N-15 — the two mandatory gates — both pass on independent evidence.
The complete offline ladder is green from the clean clone, the formatting
correction is complete and formatting-only, the remediation is confined to
its authorized scope, and no blocking pattern was introduced. The remaining
open findings are all non-blocking.

```text
VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED
```

Stage 07B is not formally closed by this document; formal closure is now
PERMITTED and remains an owner action. Stage 07C–07E remain accepted and
have not begun.
