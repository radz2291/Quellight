# Quellight Stage 07B — Audit Remediation 01

> **Class:** remediation record (bounded, audit-driven). This document records
> the bounded remediation of the Stage 07B independent audit findings F-1 and
> F-2. It is NOT an independent verification, NOT a formal closure, and it does
> not change the audit's verdict (`NOT VERIFIED — REMEDIATION REQUIRED`). The
> independent audit report and the implementation report are preserved
> byte-untouched. The bounded live-provider proof (N-15) remains open for the
> independent re-audit; this remediation neither executes nor satisfies it.
> The VICT repository was read-only throughout.

## 1. Starting and final SHAs

| Item                                         | Value                                                                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting commit (verified before any change) | `45e6aa690e3caa9f68264d93143c7107c6d8e11f` — `HEAD == origin/main`, fetched and re-verified; linear history (9 commits, no merges)                                                             |
| Working tree at start                        | Clean; no untracked files                                                                                                                                                                      |
| Remediation commit 1 (fix)                   | `666049180ad25f03b61530d63f119bc403596346` — `fix(stage-07b): route stop through VICT command boundary`                                                                                        |
| Remediation commit 2 (test)                  | `2379d4b781e73f348b3eb42b379ecb462d4c4219` — `test(stage-07b): strengthen cancellation and deadline proof`                                                                                     |
| Remediation commit 3 (docs)                  | this commit                                                                                                                                                                                    |
| Final state                                  | fast-forward push to `origin/main`; `HEAD == origin/main` re-verified after push                                                                                                               |
| VICT repository                              | read-only throughout; zero tracked changes introduced; pre-existing untracked `.pi/` material byte-untouched                                                                                   |
| Canonical input                              | `docs/The-Persistent-Cognitive-Partner-Agent-Context-v1.3-CANONICAL.md` SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` — re-verified unchanged before every commit |

Environment: Windows 11 (win32-x64), Node v22.13.1, npm 10.9.2 (the recorded
implementation pair; matches the declared VICT engines floor). The consumed
release set is unchanged: `@victframework/*@0.1.0` exact pins, content ID
`v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`;
nothing was upgraded, patched, vendored, or replaced.

## 2. F-1 — exact root cause

`src/lib/islands/ConversationWorkspace.svelte`, `stop()`, sent:

```json
{ "turnId": "<turnId>" }
```

with `content-type: application/json` and **no** `idempotency-key` header, to
`POST /vict/v1/turns/cancel`. The released boundary
(`@victframework/server@0.1.0`, independently confirmed from the installed
package before editing) validates:

- the closed top-level request envelope — only `payload` plus the optional
  exact `schema: vict.command@1` marker; any other top-level field fails with
  `400 VICT_HTTP_BODY_MALFORMED` (`dist/http.js`);
- the command registry maps `POST /vict/v1/turns/cancel` → `agent.turn.cancel`
  with the closed payload field set `['turnId', 'reasonCode']` and
  `mutation: true` (`dist/commands.js`), and every state-changing command
  requires a bounded `Idempotency-Key` header matching
  `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`, else
  `400 VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`.

The island's request therefore deterministically failed with
`400 VICT_HTTP_BODY_MALFORMED`, and the surrounding `catch {}` swallowed the
failure: the user saw "Stopping…" until the turn completed normally; the
`cancelled` state was unreachable in real use. Exactly as the audit's P2b/P6
evidence described.

## 3. Corrected request (the released public contract, nothing more)

```json
{ "payload": { "turnId": "<turnId>", "reasonCode": "user" } }
```

with headers `content-type: application/json` and a non-empty
`idempotency-key`. The request still crosses the real `/vict` proxy
(thin transport: server-side actor-token injection, byte pass-through —
unchanged) into the released VICT boundary. No internal executor, provider,
Mastra object, or cancellation primitive is called from the island; no
parallel cancellation protocol exists; `response.cancelled` is never
synthesized in Quellight code.

## 4. Idempotency behavior

- One user cancellation intent (one in-flight turn's Stop) receives ONE
  idempotency key, created on the first click (`stop-<uuid>`; matches the
  released key pattern).
- Every retry of the SAME intent — repeated clicks, redelivery — reuses the
  key verbatim; the released boundary's durable command-idempotency dedupes
  (200 replay of the receipt projection, or the stable 409
  `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` while the first execution is in
  flight, which the island treats as the intermediate state it is — not a
  failure).
- A later independent cancellation intent (the next send creates a NEW turn)
  uses a NEW key (`send()` resets the intent key).
- Post-terminal clicks are structurally unreachable (the Stop control only
  renders while the turn is in flight); even a raced late request fails
  closed — the released boundary answers the terminal turn with 409
  `VICT_CONTROL_TURN_INVALID_TRANSITION` and no second terminal is ever
  produced. Exactly one durable `response.cancelled` terminal frame results,
  authored by VICT alone.

## 5. Failure-reporting behavior

- **Accepted (200, `ok: true`)**: only a truthful intermediate state
  ("Stop request accepted. Waiting for the response to finish stopping.");
  the island never claims cancellation before the authoritative
  `response.cancelled` stream terminal arrives. The honest race (the turn
  completes first) renders `completed` — never a fabricated cancellation.
- **HTTP rejection (non-2xx or `ok: false`)**: a stable, accessible failure
  banner ("The stop request was not accepted (`<stable code>`). The response
  was not cancelled by that request; Stop can be retried.", `role="status"`)
  plus the aria-live announcement; the connection reverts to the truthful
  `streaming` state and Stop stays retryable. Never swallowed.
- **Network failure**: the same truthful surface with the Quellight display
  code `CANCEL_REQUEST_UNDELIVERED` (deliberately NOT `VICT_`-prefixed —
  finding F-3's discipline is respected; no new VICT-namespace codes were
  invented).
- **Settle race**: if a terminal already settled the stream when the
  rejection arrives, the stale rejection is suppressed — the authoritative
  terminal state stands.
- The terminal reconcile now also refreshes the VICT-authoritative turn
  records, so a cancelled outcome remains visibly marked
  ("Past turn outcome: cancelled") after the durable reconcile, in addition
  to the aria-live announcement.

## 6. Baseline negative control (old commit, isolated worktree)

`scripts/browser-stop-check.mjs` step 0 (permanent; runs in `verify:quellight`
step 6b and standalone as `npm run verify:stop`):

- creates an isolated temporary git worktree at the audited commit
  `00ca458374f99f9cd35612affb71e9adbf01b70f`;
- resolves that worktree's `@victframework/*@0.1.0` imports through a
  junction to the repository's node_modules (identical pinned release set on
  both commits — same lockfile);
- composes the OLD commit's real composition, starts a turn, and sends the
  EXACT old island request shape through that commit's real loopback
  boundary.

Observed (every run, including the final ladder):

```text
old shape {"turnId":…} (no header) on 00ca458 boundary -> 400 VICT_HTTP_BODY_MALFORMED
released envelope {payload:{}} on 00ca458 boundary      -> 200 (contract was already correct)
released envelope + key on 00ca458 cancel route         -> 200 accepted
```

This proves the defect was the client request shape — not the boundary, not
the proxy, not the released contract. The worktree, junction, probe file, and
probe data dir are removed afterwards (junction unlinked BEFORE
`git worktree remove`; see §11).

## 7. Real-browser evidence (permanent regression; `verify:stop`)

The real-browser check serves the REAL SvelteKit application via `vite dev`
with exactly ONE substitution for the check only: the offline fixture model
is a paced text fixture (test/fixtures/stop-check-runtime.mts; released
offline identity, standard stream-part shapes) whose stream stays genuinely
in flight (~3.6 s) so a real Chromium can click Stop mid-stream. Routes,
island, `/vict` proxy, and the released in-process VICT boundary are the real
product code paths. The production build path (N-17) is untouched.

Observed in the final ladder run (all through the real browser + real proxy

- real boundary):

```text
thread created: Stop check
fixture turn genuinely in flight (assistant delta rendered)
stop request envelope {payload:{turnId,reasonCode}} (turn turn-…)
stop request idempotency-key present (stop-…)
VICT boundary -> 200 {ok:true, accepted:true} through the real /vict proxy
repeated Stop click (1 extra request(s)) reused the SAME key and was durably deduplicated
truthful intermediate state rendered BEFORE the terminal (announcements:
  ["Stop request accepted. Waiting for the response to finish stopping.",
   "Stopped. The partial response is retained and marked."])
simulated same-key retry -> 200 (durable dedupe/replay, no second intent)
cancelled state visible and accessible (status banner + live-region announcement)
stream replay through the real proxy: exactly ONE response.cancelled terminal
persisted truth: exactly one turn record, status cancelled
page reloaded mid-cancellation (client disconnected from the SSE stream)
reconnect during cancellation restored the truthful cancelled outcome
no second terminal was created by the disconnect/reconnect (replay: exactly one)
failed stop request -> visible truthful failure banner, never a false cancelled state
the unaffected turn settled completed truthfully after the failed stop request
old shape -> 400 VICT_HTTP_BODY_MALFORMED (fail closed)
non-object envelope -> 400 VICT_HTTP_BODY_MALFORMED (fail closed)
wrong schema marker -> 400 VICT_HTTP_BODY_MALFORMED (fail closed)
missing idempotency-key header -> 400 VICT_COMMAND_IDEMPOTENCY_KEY_INVALID
restarting the whole application process (SIGKILL) on the same data dir
fresh process serving at http://127.0.0.1:5173
full-process restart restored the cancelled outcome (exactly one cancelled turn)
post-restart stream replay: still exactly ONE response.cancelled terminal
zero console warnings/errors and zero 5xx responses during the real Stop flows
```

The literal Stop click: the check drives the visible Stop control with a real
double-click gesture in Chromium (two genuine clicks; both requests captured
with the same key; the second durably deduplicated), plus a same-key retry
issued from the page against the same URL. No server executor, cancellation
handler, or other lower-level shortcut is ever invoked to perform
cancellation. Durable terminal truth is additionally counted by replaying the
stream through the real proxy from the page and by the persisted turn records
through the public restore route.

## 8. F-2 — the deadline stub replaced with a substantive proof

The old N-6 test was a stub (no deadline assertion; its comment deferred to a
nonexistent seam test). It is replaced in `test/composition.test.ts` with a
deterministic, controlled-time proof through the real composition and the
released adapter:

- the composition runs with a controlled clock and the ACTUAL configured
  `QUELLIGHT_TURN_DEADLINE_MS` (5 000 ms in the proof);
- the provider fixture is the RELEASED deterministic offline model (not a
  fixture that pre-returns the expected error), held genuinely pending by a
  clock-gated delivery seam — zero parts delivered while controlled time is
  before the deadline (asserted: `partsDeliveredBeforeDeadline === 0`, turn
  still in flight);
- controlled time then reaches the configured deadline and exactly one
  pending part is released; the production deadline seam
  (`withTurnDeadline`, the same wrapper the composition installs) observes
  the expired deadline and emits exactly ONE error part;
- the released adapter settles the turn `failed` with the durable code
  `VICT_AGENT_TURN_FAILED` (sanitized; no provider content);
- the durable ledger contains exactly one terminal frame (`response.failed`);
  no `response.completed`, no `response.cancelled`, no `content.completed`;
- exactly one model invocation (no second effect, no automatic retry);
- a client replaying the stream from zero receives the same single terminal;
  `reconcileAfterRestart()` preserves the same terminal truth with no second
  effect.

No real sleeping: the only waits are the standard bounded 25 ms settlement
polls; the deadline fires in controlled time. Production timeouts were not
changed. `composition.ts` gained one documented TEST-ONLY option
(`offlineModelFactory`); the default path is byte-identical to before (the
released deterministic fixture wrapped in the production deadline seam).

## 9. Verification evidence (working tree, final state)

Every command run once in its final form; the single non-zero result is
diagnosed below, not masked.

| #   | Command                                     | Exit | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run format:check`                      | 1    | flags EXACTLY ONE file: `docs/report/QUELLIGHT-STAGE-07B-INDEPENDENT-VERIFICATION.md` — pre-existing drift introduced by the audit's own commit `45e6aa6` (the audit ladder ran before that commit existed); pure markdown table-column alignment; the file is modification-protected by this remediation's mandate and was left byte-untouched; every remediation file is prettier-clean — **diagnosed and left unchanged; disposition belongs to the independent re-audit** |
| 2   | `npm run typecheck`                         | 0    | `tsc --noEmit` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | `npm test`                                  | 0    | node-side: 5 files / 28 tests passed (incl. 5 new stop-boundary tests + the substantive N-6 deadline proof); browser-side: 2 files / 6 tests passed (incl. 3 new island Stop-flow tests)                                                                                                                                                                                                                                                                                      |
| 4   | `npm run build`                             | 0    | adapter-node; exactly the 2 documented closed-allowlist notices                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | `npm run verify:consumer`                   | 0    | N-1 registry-only exact-pin proof + N-2 unreachable-registry fail-closed control                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | `npm run verify:quellight`                  | 1    | aggregate gate: typecheck, both test suites, build + build-log scan (allowlist clean), real-browser check (N-17/N-19) PASS, real-browser stop regression (6b) PASS, artifact scan PASS (151 files), `git diff --check` PASS — the ONLY finding is the §9-1 pre-existing protected-file format drift                                                                                                                                                                           |
| 7   | `npm audit --omit=dev`                      | 0    | 0 vulnerabilities in production dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 8   | `git diff --check`                          | 0    | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 9   | `npm run verify:stop` (standalone)          | 0    | §6 + §7 evidence, including the old-commit worktree negative control                                                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | `npm run verify:live-provider` (gate check) | 2    | REFUSED as designed (`QUELLIGHT_LIVE_PROOF` unset) — the live-proof gate is intact and remains the independent re-audit's item; no credential was read or used                                                                                                                                                                                                                                                                                                                |

Additional permanent proofs (all inside `npm test` / `verify:quellight`):
repeated-click/idempotency controls (stop-boundary suite + island suite +
browser double-click and same-key retry), cancellation reconnect and restart
proof (browser check scenarios B + restart; restart suite unchanged), the
substantive deadline proof (N-6), credential canary controls (N-14 unchanged),
and artifact scans (gate step 7: canary markers, credential-shaped
assignments, local absolute paths — clean across 151 sources + artifacts).

## 10. Files changed

```text
src/lib/islands/ConversationWorkspace.svelte   (F-1 fix; stop contract, truthful states, reconcile marks)
src/lib/server/composition.ts                  (test-only offlineModelFactory override; default identical)
test/composition.test.ts                       (F-2: stubbed N-6 replaced with the controlled-time deadline proof)
test/stop-boundary.test.ts                     (new: released-boundary request-shape contract tests)
test/ui/workspace-stop.test.ts                 (new: island Stop-flow tests, happy-dom)
test/fixtures/stop-check-runtime.mts           (new: check-only paced fixture runtime)
scripts/browser-stop-check.mjs                 (new: old-commit negative control + real-browser Stop regression)
scripts/verify-quellight.mjs                   (gate step 6b added; nothing weakened or removed)
package.json                                   (verify:stop script added)
docs/report/QUELLIGHT-STAGE-07B-REMEDIATION-01.md (this file)
```

Not changed: provider profile, `/api/act` and the D-4 disposition, Shared
World schemas/retention, stream protocol, `/vict` proxy semantics, sequence
assignment, cursor semantics, replay, terminal arbitration, transcript
persistence, the implementation report, the independent audit report, and
every `@victframework/*@0.1.0` package.

## 11. Incidents during development (diagnosed, no masking)

1. **node_modules junction destruction (first negative-control run):** the
   first version removed the temporary worktree while the
   `worktree/node_modules` junction still pointed into the repository;
   `git worktree remove --force` traversed the junction and emptied the
   repository's node_modules. Diagnosed immediately (empty node_modules;
   tracked tree and lockfile unaffected); recovered with the only supported
   clean-install path (`npm ci`, 227 top-level packages). The script was
   fixed to unlink the junction FIRST and only then remove the worktree; the
   negative control now tears down cleanly (verified on every subsequent
   run).
2. **Dev-server client prebundling limitation:** under the pinned
   `svelte@5.57.0`, `svelte.compileModule` cannot parse TypeScript, so
   Vite's dev-only esbuild prebundler fails on the released
   `renderer-svelte` `.svelte.ts` module (production build unaffected — the
   N-17/N-19 evidence path). The stop check's GENERATED dev-only config
   excludes that one package from prebundling so it flows through the normal
   transform pipeline (esbuild TS strip → svelte module compile). This is a
   check-only, dev-server-only setting; the repository's vite config is
   unchanged. Recorded here because `npm run dev` on the pinned versions
   would hit the same prebundling behavior in a real browser.

## 12. Preservation and cleanup evidence

- Canonical input re-hashed byte-identical (`e7f61d24…331`) before every
  commit and after the full ladder; `.prettierignore` freeze untouched.
- VICT repository: zero tracked changes (`git status` clean except the
  pre-existing untracked `.pi/`, byte-untouched). Observation recorded: the
  VICT owner advanced the local VICT checkout mid-session (reflog: `2c8a7fb
chore(release): prepare VICT 0.1.1`, authored by the owner); this
  remediation neither caused, influenced, nor consumed it — the consumed
  release set remains the immutable `@victframework/*@0.1.0` pins.
- No credential was read from `.pi/` or any file; `OLLAMA_API_KEY` was
  unset for every run (the live-gate refusal, exit 2, re-proven after the
  ladder).
- Cleanup after every check run: temporary worktrees (none remain —
  `git worktree list` shows only the main checkout), probe clones, the
  disposable data directories, the generated vite config, browser
  instances, and vite dev servers were removed; `verify:quellight`'s own
  artifact scan (step 7) re-verified the tree.

## 13. Readiness for independent re-verification

- F-1 is remediated at the exact released public contract, with permanent
  regression proof at three levels (released boundary contract, island
  behavior, real-browser click flow) plus the old-commit negative control.
- F-2 is remediated with a substantive deterministic deadline proof through
  the real composition and released adapter.
- The remediation does not claim Verified status for Stage 07B, does not
  begin Stage 07C–07E, and does not satisfy the independent live-provider
  gate. The re-audit should re-run the complete ladder, the stop regression
  (`npm run verify:stop`), and the bounded live proof with the owner-supplied
  credential, and disposition the pre-existing audit-report format drift
  recorded in §9-1.
