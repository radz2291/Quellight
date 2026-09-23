# Quellight Stage 07D Phase D4b — Structured Real-Use Session Execution Record

> **Outcome: FAILED (truthful seal).** The authorized structured session
> was executed EXACTLY ONCE under the owner authorization dated
> 2026-09-23, sealed `failed` / `QLT_D4_PROOF_POINT_FAILED`, and was not
> rerun. Any future execution requires a NEW explicit owner
> authorization. The organic-use window has NOT begun. Stage 07D is NOT
> verified or formally closed. Stage 07E has NOT begun.

## 1. Execution identity

| Item                                | Value                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Repository anchor at execution      | `e166babb39a0c396fe9d7a08f7045e3a5bf3b5b1` (HEAD == origin/main, tracked tree clean; VICT `4aa245d2…` unchanged)                |
| Contract                            | `quellight.stage07d.d4.proof-contract@2`                                                                                        |
| Profile                             | `ollama-cloud/glm-5.3-flash`                                                                                                    |
| Receipt consumed (exclusive-create) | `docs/report/evidence/d4-structured-session-receipt.json`, `authorizedAt 2026-09-23T02:56:14.476Z`, bounds embedded, no content |
| Evidence seal                       | `docs/report/evidence/d4-structured-session-evidence.json` — `outcome: failed`, `code: QLT_D4_PROOF_POINT_FAILED`               |
| True process exit                   | **1** (captured by a separate echo after an unredirected exit; no pipe masking)                                                 |
| Session duration                    | ≈ 3.4 s from receipt consumption to the failure seal (02:56:14.476Z → 02:56:17.84Z)                                             |

## 2. What is determinate

- The session aborted on an exception at or before the FIRST provider
  turn could complete. In a 3.4 s window at most one transport could
  have been attempted; **zero user turns are verified completed**; the
  provider-request count is bounded by design (≤ 20) but the exact count
  was not preserved (see §4).
- **No A1–A13 proof point was established.** The failure-seal branch
  (`forcedCode`) replaces the check ledger with the minimal failure
  summary; required product results, restart, fresh-thread continuity,
  deletion, export, reconciliation, and hygiene checks were NOT
  demonstrated by this execution.
- The machinery's own failure path ran completely: the seal was written
  without overwriting (`wx`), compositions were closed, the provider
  observer restored, and the task-owned proof workspace was removed and
  verified absent by the harness itself (independently re-verified).

## 3. Post-execution protocol results

- Child processes: none remained (pane exit 1; no quellight/vite
  processes; no listeners on 4200/5173).
- Leak scans (repository evidence + receipt + run log): NO owner
  scenario text fragments; NO credential-shaped material (`sk-`,
  `Bearer`, key assignment patterns). Clean.
- Task-owned material removed and verified absent: the owner-supplied
  scenario materialization directory and the run-log directory (both
  under the OS temp root, outside both repositories); the harness's
  own `qlt-d4-realuse-*` workspace (removed by the harness, verified
  absent independently).
- Operator stores untouched: repo `.quellight-data` has **zero writes
  in the session window** (newest file predates the session by days —
  a leftover from the D2 browser era); no user-level `.quellight-data`
  exists; VICT `.pi` untouched (mtime 2026-09-09, read-only repo).
- The scenario file was supplied by the owner in chat and materialized
  by the assistant at the owner's instruction; it existed only in the
  task-owned temp directory, was consumed once, validated (JSON, all 7
  structural keys) BEFORE receipt consumption, and is now destroyed.
  No credential file was ever used as or copied into scenario material.

## 4. Observability finding (reported, NOT repaired)

The harness's truthful failure cause (`FAIL: the session failed
truthfully (…cause…)` on stderr) and all per-point progress lines were
lost: the failure path ends in `process.exit(1)`, which on Windows can
discard buffered pipe/file writes. Only the startup line reached the
captured log. A future authorized change could seal the cause string
into the evidence summary or use `process.exitCode` after an explicit
drain. **No code, contract, bounds, provider setting, prompt,
assertion, or scenario content was changed before, during, or after
this execution.**

## 5. Status

- The consumed receipt now blocks accidental re-execution
  (`QLT_D4_ALREADY_AUTHORIZED`) — only the owner may archive it.
- This execution consumed the ONE authorized session. The result is a
  truthful failure: the first real-use transport did not complete. The
  most probable cause class is a provider-side transport failure
  (credential validity for `ollama.com`, endpoint/profile, or network);
  the sealed evidence deliberately does not contain enough to
  distinguish further, and no diagnostic provider request was made.
- Per the owner's instruction: any future execution requires a new
  explicit owner authorization. The organic-use window instructions are
  withheld because the structured session did not succeed.

`QUELLIGHT STAGE 07D D4 STRUCTURED REAL-USE SESSION EXECUTED EXACTLY ONCE`
`NO AUTOMATIC RERUN OCCURRED`
`D4 ORGANIC-USE WINDOW HAS NOT BEGUN`
`STAGE 07D IS NOT YET VERIFIED OR FORMALLY CLOSED`
`STAGE 07E HAS NOT BEGUN`
`Stage 07 remains In Progress.`
