# Quellight Stage 07D Phase D4b — Early-Session Failure Investigation and Remediation Record

> **Result: the triggering cause is PROVEN offline (a local harness defect
> chain — no provider fault); the smallest correct fix is implemented,
> loopback-proven across every requested failure class, and locked in by
> two new permanent gate controls; the conditional provider diagnostic
> request was NOT used and is NOT needed.** The original D4b run was not
> rerun; the consumed receipt and the committed failure evidence remain
> historical and byte-intact. D4 remains incomplete; Stage 07D is NOT
> verified or formally closed; Stage 07E has NOT begun.

## 1. Anchors and integrity

- Investigation start: Quellight `02a424f3ccb0cf898f33c4b725dbf9891046787b`
  (== origin/main, clean); VICT `4aa245d2…` unchanged throughout.
- The historical D4b receipt and failure evidence were **never modified**;
  the evidence file is byte-unchanged, and the receipt — which the
  investigation itself briefly exposed to a destructive legacy gate control
  (see §6) — was restored **byte-identical to the committed record**
  (verified by direct comparison against `git show 02a424f…`).

## 2. The proven causal chain of the original D4b termination

The session aborted ~3.4 s after receipt consumption, **before any
provider contact**, at composition creation. Proven chain (all steps
verified in code, reproduced offline, or both):

1. **The triggering defect (composition environment):** the harness's
   `composeSession()` called
   `resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: workspace, … }, workspace)`
   — passing the **workspace itself as the repository-root argument**. The
   composition's fail-closed isolation check demands the data directory
   resolve strictly OUTSIDE that root; comparing the workspace against
   itself is unsatisfiable, so `createQuellightComposition` refused
   deterministically with `VICT_OPERATOR_CONFIG_INVALID` on every
   execution. The generic outer catch sealed
   `failed / QLT_D4_PROOF_POINT_FAILED` and exited 1.
2. **The first latent defect behind it (credential seam):** the harness
   resolved the owner credential at gate 3 (environment variable, else the
   owner-designated authentication file — D4b proved resolution succeeded
   because the receipt was consumed later in the gate order) but **never
   delivered it to the app's gated live seam**, which reads the pinned
   variable `process.env.OLLAMA_API_KEY` and fails closed with
   `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` (reproduced offline with a
   dedicated probe; a control with the variable present composes live).
   The Q6 live precedent succeeded because its worker ran with the
   variable exported in its environment.
3. **Second latent defect (seed removal field):** the governed removal
   payload used a wrong key (`family: 'claim'`) where the declared input
   contract `qlt.retention.remove.input` names `recordKind`.
4. **Third latent defect (retention pass payload):** the declared contract
   `qlt.retention.pass.input` is closed and empty; the original payload
   (`{ now: … }`) is rejected by the released boundary. The pass runs at
   the composition's real clock, so the seed now sits two seconds ahead
   and a short in-session wait makes it genuinely due — wall-clock only,
   zero extra turns or provider requests.
5. **Fourth latent defect (missing await):** the post-removal view read
   `getRecordView(...)` is async and was unawaited, so both A9 rows could
   only fail.
6. **Fifth latent defect (assembly boundary bypass):** `startTurn`
   dispatched `agent.turn.start` directly through the command service,
   bypassing `composition.admitTurn` — the boundary that installs the Q5
   Memory-Mode row and the Q4 per-turn assembly scope. The Q6 live
   precedent (`startTurnAdmitted`) always used the admitted form; the
   bypass made assemblies structurally impossible (proven: zero assembly
   records in the loopback runs before the fix).

**Provider requests in the original D4b run: zero.** The abort occurred
during composition creation; no transport ever began, which the
reproduced timing confirms deterministically.

## 3. Why the failure cause and request accounting were lost (two defects)

- **Known observability defect (machinery):** the failure-seal branch
  wrote a four-field minimal summary and discarded the ledger; the catch
  printed a raw error slice to console and ended in `process.exit(1)`.
- **The console loss in the captured log:** the harness's truthful cause
  line and per-point progress never reached the redirected log file in the
  original run (only a 20-byte startup line from the wrapper layer). The
  exact loss mechanism in the tmux capture layer could not be fully
  attributed (console-to-file capture is empirically synchronous at every
  depth that could be safely reproduced, including the full import graph),
  so the loss is reported as **bounded, not fully attributed** — and it is
  now IRRELEVANT BY CONSTRUCTION: the machinery no longer relies on
  buffered console output for any evidence (see §4).
- **Secondary defect discovered:** with the D4b evidence committed at the
  contract path, two legacy gate controls became destructive to history —
  the evidence-state check demanded plain absence, and the receipt probes
  (synthetic write at the real receipt path, `rmSync` in a `finally`)
  **deleted the committed consumed receipt** during this investigation
  (observed, then restored byte-identical from git). Both controls were
  made state-aware (§5).

## 4. The fix (committed, minimal, contract @2 unchanged)

`scripts/run-d4-structured-session.mjs`:

- `composeSession()` passes `repoRoot` as the isolation argument and
  delivers the gate-3-resolved credential to the live seam via
  `process.env[QLT_D4_CREDENTIAL_VAR]` (memory-only; the leak scans
  enforce it never persists).
- The seed's removal payload uses the declared `recordKind`; the retention
  pass uses the declared (closed-empty) input with a two-second-ahead
  expiry and a three-second in-session wait (no extra turns/requests).
- The removal view read is awaited.
- `startTurn` crosses `composition.admitTurn` (the Q6-precedent admitted
  dispatch) with the Shared-World thread id.
- The seal/cleanup split: `sealSession()` (synchronous, durable — the
  authoritative summary is written with `wx` before anything else) and
  `runCleanup()` (async: awaited composition closes, retrying workspace
  removal that absorbs the Windows SQLite-unlock lag, a durable
  `*.cleanup.json` record, and a truthful `NOT removed` state with exit 1).
- Every failed branch (forced-code, scan-hit, ledger-verdict) now carries
  the structural failure facts: `failurePhase`, `failureClass` (stable
  `QLT_/VICT_` token or constructor name only — raw messages are never
  printed or sealed), `providerRequests`, `transportBegan`,
  `responseHeadersArrived`, `responseBytesArrived`, `turnSettlement`
  (proof point, status, error code), `sessionMs`. A mid-session fail-fast
  seals durably, schedules the cleanup, unwinds via an internal sentinel,
  and the module ends naturally (`process.exitCode`; no abrupt
  `process.exit` remains on any session path; pre-consumption refusal
  gates keep their single-line exit, which is empirically synchronous and
  creates nothing to preserve).

`scripts/verify-d4-prep.mjs` (now **30 checks green in the historical
state; 31 in a pre-authorization state**):

- **N-D4-P-25 (static):** the durable failure accounting, graceful exits,
  the admitted turn dispatch, and the declared seed payload shapes are all
  locked in the harness source.
- **N-D4-P-26 (dynamic, offline):** the gated live seam fails closed with
  `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` when the pinned credential
  variable is absent (child probe; composition creation never reaches
  storage or transport).
- The pre-execution evidence state and the receipt controls are now
  history-aware: the archived failure evidence and the archived consumed
  receipt are accepted as the truthful state, never overwritten or removed,
  and the exclusive-create machinery is exercised at a task-owned temp
  path. The malformed-receipt probe runs only in the absence state; the
  missing-credential refusal is forced explicitly through the documented
  test-only override (the owner machine's authentication boundary makes
  the credential present, so natural absence can no longer be assumed).

## 5. Proof of the fix (offline, loopback; zero real provider contact)

- **Old-tree reproduction:** the real D4b evidence (committed, four fields,
  no facts) plus a disposable pre-fix harness copy reproducing the exact
  trigger — the seal carries no phase, class, or accounting.
- **Discriminating negative control:** under the reproduced
  composition-creation failure the old tree seals `failed` with no
  structural truth; the corrected tree either proceeds (defect fixed) or,
  for every other class, seals the full truth.
- **Full session through real transport:** the complete 24-check session
  ran against a loopback provider standing in for the pinned endpoint
  (URL rewritten outside the observer guard) and sealed **`passed`** with
  all checks true, exit 0, workspace removed and verified, and a durable
  cleanup record — proving fixes 1–6 end-to-end.
- **Every requested failure class sealed truthfully** (all exit 1, all
  with phase/class/accounting, all cleanup verified):
  auth 401 (2 requests, headers arrived, no bytes), model 404, server 500,
  malformed SSE stream, connection reset (no headers), connection refused
  (transport began, nothing arrived), deadline abort (a lab-only 5 s
  deadline; transport began, nothing arrived), injected synchronous throw
  (phase `composed`, 0 requests, transport never began), rejected/awaited
  promise (same machinery), cleanup failure (workspace left behind is
  reported truthfully with exit 1 and the cleanup record), and the
  Windows buffered-output shutdown class (eliminated as a threat: no
  evidence depends on console output).
- **Privacy:** a scan of all lab evidence/receipt artifacts found zero
  credential-shaped material and zero scenario text; the loopback server
  logged only structural metadata (path, byte counts, status). The dummy
  credential never persisted anywhere; the real credential was never read
  during the investigation (presence-only).

## 6. Incidents during the investigation, disclosed

- The legacy gate receipt probe **deleted the committed historical
  receipt** (the `finally { rmSync(receiptPath) }` + `wx`-probe written for
  the pre-D4b absence era). Detected immediately; restored **byte-identical
  to the committed version** (verified against `git show`); the gate was
  then made state-aware so the historical record can never be touched
  again.
- Two task-owned lab artifacts briefly landed in the repository
  (`*.cleanup.json` from an unpatched lab path and a stray `undefined.port`
  from a lab server); both were verified task-owned and deleted. No
  historical file was touched by them.

## 7. Provider diagnostic authorization — NOT used

The authorization permitted one minimal provider diagnostic request **only
if the triggering cause could not be distinguished offline**. The cause
was fully distinguished offline (§2, deterministic code-path proof plus an
offline reproduction), so the condition was not met and **no real provider
request was made**. Exact provider-request accounting for the entire
investigation: **zero requests to any real provider endpoint**; all
transport happened against the loopback stand-in. No retry, no fallback,
no model-list query, no second diagnostic.

## 8. Remaining uncertainty

- **Credential validity:** the owner-designated authentication boundary
  provably RESOLVES a value (the original receipt's consumption proves
  gate 3 read one), but its validity against the pinned endpoint has never
  been tested and cannot be tested offline. The Q6 precedent proved a
  valid key existed in the process environment at that time; whether the
  boundary file holds the same valid value is the one untested link.
- The console-output-loss mechanism in the original run's tmux capture is
  bounded (see §3) but not fully attributed; it is moot for evidence
  integrity under the corrected machinery.

## 9. Readiness and the next owner decision

The machinery is proven end-to-end offline: a complete structured session
seals `passed` through real transport mechanics, every failure class seals
truthfully, and the receipt/evidence histories are protected. **Another D4
structured session is genuinely ready for a new owner authorization**;
the only untested link is the real credential's validity, which the next
authorized session will prove (or truthfully seal as
`failed-infrastructure`, without consuming any ambiguity). The next owner
decision: issue a NEW one-shot D4 structured-session authorization (the
corrected machinery is at the commit recorded in §7 of the repository
status surfaces), after optionally confirming the credential boundary.
No rerun occurred and none is authorized by this record.

`QUELLIGHT STAGE 07D D4B TRIGGERING CAUSE PROVEN OFFLINE (LOCAL HARNESS DEFECTS, ALL FIXED AND LOOPBACK-PROVEN)`
`THE CONDITIONAL PROVIDER DIAGNOSTIC WAS NOT NEEDED AND NOT USED — ZERO REAL PROVIDER REQUESTS IN THE INVESTIGATION`
`THE ORIGINAL D4B RUN WAS NOT RERUN; THE CONSUMED RECEIPT AND FAILURE EVIDENCE REMAIN HISTORICAL AND BYTE-INTACT`
`A NEW STRUCTURED-SESSION AUTHORIZATION IS MACHINERY-READY; THE ONLY UNTESTED LINK IS REAL-CREDENTIAL VALIDITY`
`D4 REMAINS INCOMPLETE — ORGANIC-USE WINDOW HAS NOT BEGUN`
`STAGE 07D IS NOT VERIFIED OR FORMALLY CLOSED; STAGE 07E HAS NOT BEGUN; Stage 07 remains In Progress.`
