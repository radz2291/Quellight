# Quellight Stage 07D Phase D4 — Attempt-2 Structured Real-Use Session Execution Record

> **Result: `passed` — all 24 proof points true, sealed at contract @2 with
> the pinned profile, inside every frozen bound. True process exit code 1:
> the durable cleanup verification failed inside the session's retry
> window (the proof workspace outlived the 15-second removal retry due to
> the Windows SQLite-unlock lag) and the machinery truthfully refused to
> report success without a durably verified cleanup; the workspace was
> removed and verified immediately after the process exited. The proof
> outcome itself is `passed`; the exit status recorded the cleanup lag.**

## 1. Authorization and preconditions

- Owner authorization: one fresh D4 structured session, stated in the
  owner message dated 2026-09-23, at the pinned tree
  `459a69aaa090c58ef4aef1a403bb4058ab761b52`.
- Preconditions verified before execution: HEAD == origin/main ==
  `459a69a…` with a clean tracked tree; the active receipt, evidence, and
  cleanup-record paths all absent; the archived attempt-1 pair
  byte-identical to the pinned digests (`4ff67b61…`, `c87bbd91…`); the
  preparation gate `verify:d4-prep` 35 checks green; the workspace policy
  enforced fail-closed by the harness itself.
- The scenario was materialized verbatim as a task-owned temporary file
  outside the repository (standalone-validated: exactly the seven required
  keys, each a non-empty string; digest computable) and deleted after the
  session. The credential was resolved ONLY through the existing
  owner-designated authentication boundary by the harness's gate (the
  pinned environment variable was not set by the operator; the boundary
  file was never read or printed by anything in this session's tooling).

## 2. Execution (exactly once)

The structured-session command ran exactly once; no preliminary provider
probe, diagnostic request, retry, or second execution occurred under any
outcome. Frozen bounds enforced live by the machinery: one session,
45 minutes maximum, exactly the planned 5 user turns, at most 20 provider
requests, at most 2048 output tokens per request, zero retries, no
fallback, structural evidence only.

Console-observed sequence (structural lines only): a1, a2, a3,
ineligible-seeded, a7, export/a8, record-removed/a9, restart/a4,
assembly-selected/a5, a6, deletion-previewed, conversation-deleted,
meaning-byte-identical/a10, reconciliation/a11, boot-recovery,
context-marker-absent/a12, a13 — all `ok` — then
`sealed: passed → docs/report/evidence/d4-structured-session-evidence.json`.

## 3. Sealed evidence (structural only)

- Receipt: `authorizedAt 2026-09-23T05:54:40.754Z`, contract
  `quellight.stage07d.d4.proof-contract@2`, profile
  `ollama-cloud/glm-5.3-flash`, frozen bounds embedded (5 user turns,
  20 requests, 2048 tokens, 120 s, zero retries, no fallback).
- Evidence summary: `outcome: "passed"`; all 24 checks true (A1–A13 plus
  the structural points: export-produced, record-removed,
  deletion-previewed, conversation-deleted, meaning-byte-identical,
  reconciliation-receipts, boot-recovery-clean, context-marker-absent,
  ineligible-seeded, assembly-selected, restart-performed);
  sessionStart/End recorded (≈121 s elapsed, far inside the 45-minute
  bound).
- Cleanup record: `workspaceRemoved: false, evidenceSealed: true` — the
  truthful in-session state at seal time.

## 4. The exit-code truth

The true process exit code was **1**, produced by the remediated
fail-closed design working exactly as specified: the proof outcome was
`passed` and the evidence was durably sealed (`evidenceSealed: true`), but
the owned workspace could not be removed within the harness's 15-second
post-close retry window (the Windows SQLite-unlock lag), and a run whose
workspace disposition is NOT durably verified can never report success.
The workspace (`/tmp` task-owned `qlt-d4-realuse-*` directory) was removed
and verified absent immediately after the process exited — no data
remained, no other path was touched. This is a known, bounded cleanup-lag
behavior of the harness on this platform, disclosed here as part of the
attempt's truth; the proof outcome, bounds, and evidence integrity are
unaffected. A future additive improvement may extend the post-close
settle window; no machinery change was made as part of THIS attempt's
record.

## 5. Request accounting

Every transport was bounded live by the installed observer (≤ 20 requests,
≤ 2048 output tokens per request, 120 s turn deadline, zero retries, no
fallback) and the session sealed `passed`, which is only reachable when no
bound was exceeded. The exact request count is not part of the sealed
`passed` summary (a known additive observability gap for future attempts;
the failed branches always carry the full accounting).

## 6. Privacy and cleanup

- The sealed receipt/evidence/cleanup bytes were scanned: zero scenario
  text, zero conversation payloads, zero credential-shaped material, zero
  headers, zero absolute paths.
- The proof workspace was removed and verified absent; the temporary
  scenario file was deleted and verified absent. Normal `.quellight-data`
  and VICT `.pi/` were not accessed.
- No preliminary provider probe, diagnostic request, or second execution
  occurred. The D4b attempt-1 archive remains byte-untouched (its digests
  are pinned by the permanent gate control N-D4-P-30).

## 7. Lifecycle state

The attempt-2 bundle (receipt, evidence, cleanup record) now occupies the
canonical active paths as this attempt's durable record — committed
here by the owner's instruction. Per the corrected runbook lifecycle, any
future fresh authorization requires the owner to archive this bundle
first (byte-identical attempt-2 filenames, additive mapping record);
until then the active paths are intentionally occupied by the completed
proof attempt, and the preparation gate will correctly report the
active-path invariant as red.

## 8. D4 organic-use window — owner instructions (Layer B)

The structured-session proof (Layer A) is complete. The remaining D4
evidence is the organic-use observation window (Layer B), which uses NO
harness and no provider probing:

1. Use Quellight normally — your real application, your normal data
   directory — on a real low-sensitivity subject of your choice.
2. Smallest defensible window: **three genuine sessions, across at least
   two separate application launches on at least two calendar days**,
   including at least one full application restart and at least one
   genuinely fresh conversation. You may extend the window; never shorten
   it below one session.
3. During the window do not commit conversation wording. You may exclude
   any private event from the record without giving a reason. Nothing
   except structural, non-content observations (e.g. that a preference
   was applied, that an exclusion held) may be recorded.
4. When the window is complete, tell the operator; the D4 verification
   and Stage 07D formal closure proceed from there. Do not start D5
   automatically.

`QUELLIGHT STAGE 07D D4 ATTEMPT-2 STRUCTURED SESSION SEALED PASSED — ALL 24 PROOF POINTS TRUE AT CONTRACT @2, EVERY FROZEN BOUND RESPECTED`
`TRUE EXIT CODE 1 PRESERVED — DURABLE CLEANUP VERIFICATION FAILED INSIDE THE RETRY WINDOW AND THE MACHINERY REFUSED TO REPORT SUCCESS; WORKSPACE REMOVED AND VERIFIED AFTER PROCESS EXIT`
`STRUCTURAL EVIDENCE ONLY — NO CONVERSATION PAYLOADS, SCENARIO TEXT, CREDENTIAL MATERIAL, HEADERS, OR ABSOLUTE PATHS`
`EXECUTED EXACTLY ONCE — NO PRELIMINARY PROBE, NO DIAGNOSTIC REQUEST, NO RETRY, NO SECOND EXECUTION`
`D4 LAYER A IS COMPLETE; THE ORGANIC-USE WINDOW (LAYER B) AWAITS THE OWNER; D4 REMAINS INCOMPLETE UNTIL IT IS DONE`
`STAGE 07D IS NOT YET FORMALLY CLOSED; STAGE 07E HAS NOT BEGUN; Stage 07 remains In Progress.`
