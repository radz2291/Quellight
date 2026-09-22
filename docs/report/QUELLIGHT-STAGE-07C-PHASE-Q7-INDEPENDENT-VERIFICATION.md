# Quellight Stage 07C — Phase Q7 — Independent Verification (Q6 recovery audit and Stage 07C closure audit)

> **Class:** Independent verification record (audit). The auditor did not
> participate in the Q6 root-cause investigation, remediation, or live
> execution. Every conclusion below was re-derived from the repository, the
> code, the Git history, the committed evidence, and independently authored
> offline probes — never from the recovery report's assertions. This file is
> created by the audit; its companion formal-closure record is the only other
> new document. No source, test, script, package file, frozen contract,
> historical report, or `.quellight-data` content was touched. VICT was
> treated as read-only (its `.pi/` unread; its System Reference reconciled in
> a separate documentation-only commit that FOLLOWS this audit). No provider
> request was made; no credential was accessed (all probe credentials were
> task-owned fake canaries intercepted before any transport); the consumed
> one-shot live authorization was NOT re-executed — the committed live
> receipt was verified against its supporting implementation instead.

**Date:** 2026-09-22.
**Audited tip:** `8a26d310afc1fa37e4761416803c7d8434037867`
(`HEAD == origin/main`, clean tracked tree, linear ancestry: 136 commits,
zero merge commits, single `main` branch on both remotes).

## 0. Verdict

```text
VERIFIED
0 Blocking ............................................... 0
High ..................................................... 0
Medium ................................................... 0
Low (new, non-blocking) .................................. 2
Carried (previously disclosed, unchanged) ................ 2
Observations ............................................. 4
Q6 FORMAL CLOSURE PERMITTED
PHASE Q7 (THIS AUDIT) COMPLETE
STAGE 07C FORMAL CLOSURE PERMITTED
STAGE 07D PERMITTED AND NOT BEGUN (next increment per the canonical roadmap)
Stage 07 remains In Progress.
```

The audited recovery record is truthful. The historical Q6 failures are
correctly separated into three classes, the remediation is limited exactly as
declared, VICT required no change, the committed live receipt is corroborated
by the implementation and by Git history, and the permanent offline evidence
detects every defect class the closure policy requires. Nothing overstates
Q6's status.

## 1. Chain of custody (independently established)

| Item                                                | Value                                                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch                                               | both remotes fetched first; neither had advanced                                                                                                                                                                             |
| Quellight starting `HEAD == origin/main`            | `8a26d310afc1fa37e4761416803c7d8434037867` (verified; tracked tree clean before, during, and after the audit)                                                                                                                |
| VICT starting `HEAD == origin/main`                 | `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4` (verified; tip dated 2026-09-22 13:37 +0800, BEFORE the recovery window that began at Quellight `c07385e…` 18:11 +0800; read-only; `.pi/` untouched and unread)                   |
| Q6 recovery starting point                          | `c07385e5b9b05e16471a00b8337c84afee8cf0ad` (matches the recovery report)                                                                                                                                                     |
| Additive amendment 1 (bounds/guidance, D-Q6-15)     | `fb6d16e6…` — docs-only, 1 file                                                                                                                                                                                              |
| Additive amendment 2 (fixture privacy)              | `18f8c57a…` — docs-only, 1 file                                                                                                                                                                                              |
| Additive amendment 3 (synthetic fixture provenance) | `a33f2b18…` — docs-only, 1 file                                                                                                                                                                                              |
| Final executable implementation                     | `ac594628e51d1c5901490f656b3ce6dabe3a31cc` — exactly the 18 declared files                                                                                                                                                   |
| Offline evidence commit                             | `387015a3…` — exactly 2 evidence JSON files                                                                                                                                                                                  |
| Documentation/status commit                         | `8a26d310…` — recovery report + live receipt + README + system reference + decision register                                                                                                                                 |
| Amendment ordering                                  | parent chain proven: `c07385e…` → `fb6d16e…` → `18f8c57…` → `a33f2b1…` → `ac594628…`; all three additive amendments AND the Q6 contract freeze `ca82892…` (via `a624e7a…` ancestry) precede every executable recovery change |
| History integrity                                   | linear, no merges, no rewrite; every historical Q6 report's last-touch commit is its own recording commit (all predate the recovery window)                                                                                  |
| Pins                                                | `package.json`/`package-lock.json`: all `@victframework/*` exact `0.3.1`, registry-only `resolved` URLs; release identity `vict-release-set@1/0.3.1` re-validated by the ladder's consumer gate                              |

## 2. Failure separation (audit duty: the three classes)

1. **Harness defects** — Execution 1 (HTTP 401: unresolved credential
   substitution), Execution 2 (conversational completion failed the old
   discretion requirement), Execution 3 (`sharedWorld.restoreThread` wrong
   API; un-awaited evidence; disposable-root handling), and the probe defects
   of the tool-argument diagnostics are each recorded in their OWN preserved
   reports (`…LIVE-PROOF-FAILURE.md`, `…EXECUTION-3-*.md`, `…REAL-MODEL-…`,
   D-Q6-11..D-Q6-14) and are never attributed to model incapability.
2. **Insufficient generation allowance** — the reasoning-only
   `finish_reason: length` mechanism was reproduced offline through network-
   disabled production boundaries AND confirmed by real diagnostic request 1
   (512/none: `length`, 0 reasoning bytes, 2,438 visible bytes, no call) and
   by D-Q6-14. Disabling reasoning alone did not solve the task — recorded.
3. **Model-produced invalid closed-enum values** — real diagnostic requests
   2–3 (1024/none) produced structurally well-nested claim arguments with
   `epistemicType` oversize and `honestyState`/`confidence` invalid enums;
   the raw guard accepted the JSON while the installed Mastra validator,
   Contract.parse, and domain replay all rejected it, with zero durable
   invocations and `rawRouterEqual: true`. Correct contract enforcement —
   recorded as such, not as argument loss.

The committed diagnostics JSON matches this classification exactly
(`formalProofExecutions: 0`; 5 diagnostic requests; the refused third
continuation recorded as `refused: 1`, not counted as an HTTP request).

## 3. Remediation scope (audit duty: limited exactly as declared)

`git show ac594628…` was read in full (18 files, +1176/−124):

- `src/lib/agent/proposal-guidance.ts` (new): one compact paragraph stating
  the EXISTING closed enum encodings (`E1–E7`; `known/likely/uncertain/
stale/conflicted`; `stated/qualified/uncertain`; `pending_action/
undecided_question/expected_event`) plus a brief natural-reply request. No
  new capability, no relaxation.
- `src/lib/server/composition.ts`: guidance appended to the revision-5
  instructions; profile revision 7; default AND maximum output allowance
  `requirePositiveInt(env, 2048, 2048)`. No reasoning override anywhere (the
  committed receipt records `reasoningEffort: "omitted"` on all 8 requests).
- `src/lib/sharedworld/q6-contract.ts`: the misnamed per-turn field renamed
  to `maxOutputTokensPerRequest: 2048`; `maxProviderRequests: 12`;
  `maxProviderRequestsPerTurn: 3`; the T6 transient control added; the
  unchanged-envelope block (capability `qlt.proposal.draft@3`, truthful
  write effect, 21-action inventory, maxToolCalls 2, quiet-write policy)
  preserved with only the two revision literals bumped.
- Scripts/tests: observer hardening, matrix additions, fixture-boundary
  in-memory identity, recovery launcher. No schema, parser, capability, or
  authority file changed.

Independently confirmed: injecting an extra unknown field into otherwise
valid arguments is REJECTED by the installed validator
(`QLT_INPUT_UNKNOWN_FIELD`) — the closed schema remains strict; the guidance
supplies encodings, it does not loosen validation.

## 4. VICT unchanged (audit duty)

VICT's tip predates the recovery window (§1); no VICT-path file appears in
any recovery commit; Quellight pins remain exact stable `0.3.1` with
registry-only lockfile resolution re-proven by `verify:consumer` in this
audit's ladder run; no VICT publication occurred after `fd0c1f7…`. No VICT
change or publication was required, and none was made.

## 5. The provider observer (audit duty: no rewrite; safe handling)

Source review plus independently authored probes establish:

- **No rewriting in the proof path**: the live matrix installs the observer
  WITHOUT a `rewrite` function; every record also carries a
  `rewritten: before !== JSON.stringify(body)` self-check, `false` on all 8
  committed live requests. The `rewrite` seam exists ONLY in the diagnostic
  probe (which used it for the declared 512/1024/2048/reasoning controls).
- **Fragmented streams**: an independent SSE builder fragmenting at 7-byte
  boundaries (splitting both SSE lines and argument JSON mid-token) is fully
  recovered; all four validation boundaries (guard, installed Mastra
  validator, Contract, domain) accept the reassembled valid arguments.
- **Request counting**: global cap refuses BEFORE transport
  (`QLT_DIAGNOSTIC_REQUEST_CAP`; transport call count unchanged);
  the per-turn cap is enforced independently per purpose key
  (`QLT_DIAGNOSTIC_TURN_BOUND`); every refusal is counted and the matrix
  converts any refusal into `QLT_Q6_PROVIDER_REQUEST_BOUND` (independently
  demonstrated at matrix level: a greedy-transport run reached the 12-request
  checkpoint exactly, refused requests 13–14, and the matrix failed with the
  bound finding plus truthful failed-turn records).
- **Deadlines**: a stalled transport is aborted within the shared turn
  deadline via an AbortController held across the body
  (`record.transportFailed: true`).
- **Abnormal exits**: the parent recovers the per-request checkpoint
  (`q6-provider-requests.json`) when the result record is missing; a missing
  result is a fail-closed finding, never a pass.
- **Structural evidence only**: unknown keys are masked as `<unknown>`;
  issue codes are emitted only when matching `QLT_[A-Z_]+`; paths pass a
  closed field-name allowlist; a planted canary in unknown keys, in request
  bodies, and in observer records never appears in any evidence JSON.

## 6. Negative controls (independently authored; all offline)

The permanent tests were not trusted by assertion. Independent probes
(temp-dir scripts driving the audited modules through their real seams —
injected network-disabled transports for the matrix, fake spawn/remove seams
for the parent, pure predicate calls) demonstrated that each defect class IS
detected by the audited tree as committed:

| Defect injected                                    | Independent result                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positive control (valid 6-turn script, 8 requests) | `ok: true`, zero findings — the discriminator proving detection is signal, not noise                                                                                                                                                                             |
| Reasoning-only `finish_reason: length` at t1       | matrix fails: `QLT_Q6_PROVIDER_BOUNDARY_FAILED`, `length` recorded, empty-reply finding, zero invocations                                                                                                                                                        |
| Visible-content `length` at t1                     | matrix fails: same boundary finding — a length termination fails even with visible text                                                                                                                                                                          |
| Invalid closed-enum arguments at t1                | `guard=accepted` but `mastra=false, contract=false, domain=false`; `QLT_Q6_PROVIDER_BOUNDARY_FAILED` AND `QLT_Q6_TOOL_BOUNDARY_FAILED`; zero durable invocations                                                                                                 |
| Missing visible reply (empty post-tool text)       | matrix fails with the natural-flow empty-reply finding, localized to t1                                                                                                                                                                                          |
| Foreign data dir at restart                        | matrix fails `QLT_Q6_LIVE_MATRIX_FAILED (phase: workspace-identity)` — restart-to-wrong-store cannot pass silently                                                                                                                                               |
| Request-cap flood (greedy tool calls)              | requests stop at the 12-request checkpoint; `refused=2`; `QLT_Q6_PROVIDER_REQUEST_BOUND`; failed turns recorded truthfully                                                                                                                                       |
| Planted credential canary in the workspace         | parent: `credential value found in nested\leak.txt — LEAK`, exit 1                                                                                                                                                                                               |
| Cleanup refusal (removeFn fails)                   | `could NOT be removed — the proof fails closed`, exit 1                                                                                                                                                                                                          |
| Workspace deleted before the scan                  | result-read fails closed AND `the final credential scan could not complete — an incomplete scan is never treated as credential-clean`, exit 1                                                                                                                    |
| Fixture mutated during the run                     | `vanished or changed … content-safety check fails the proof`, exit 1                                                                                                                                                                                             |
| Gate absent                                        | exit 2 BEFORE any allocation (empty order)                                                                                                                                                                                                                       |
| Worker writes no result                            | fail-closed finding, exit 1                                                                                                                                                                                                                                      |
| Tampered worker result                             | parent merge propagates the finding, exit 1                                                                                                                                                                                                                      |
| Canonical record before confirmation               | predicate: `1 canonical record(s) exist … (expected 0)`                                                                                                                                                                                                          |
| Negative-turn durable writes (t3/t6 shapes)        | predicate: zero-proposal/zero-invocation findings                                                                                                                                                                                                                |
| Memory-write claim pattern / jargon in a reply     | predicate: `memory write` / `implementation jargon` findings (6 jargon classes matched)                                                                                                                                                                          |
| Raw-vs-routed mutation                             | a one-field mutation is detected by the probe's deep-equal comparator; structurally injected mutation is rejected outright by the closed schema (`QLT_INPUT_UNKNOWN_FIELD`); the permanent probe test asserts `rawRouterEqual` and `normalizationChanged: false` |

The parent happy-path control reproduced the exact committed order:
`workspace-allocated → fixture-validated → worker-exited(0) → result-read →
fixture-reverified → credential-scanned → workspace-disposed`.

## 7. The committed live receipt (audit duty: verify, do not repeat)

`docs/report/evidence/q6-recovery-live.json` was cross-checked against the
implementation, the contract bounds, and the report's tables:

- Exactly ONE formal execution: `exit: 0`, `workerStatus: 0`,
  `findings: []`, `refusedProviderRequests: 0`; the launcher's `wx`-flag
  receipt makes re-execution refuse (`QLT_Q6_RECOVERY_ALREADY_STARTED`) —
  the consumed one-shot authorization is mechanically enforced.
- Six user turns, EIGHT HTTP requests (2/2/1/1/1/1), all `http: 200`, all
  `done: true`, finishes only `tool_calls`/`stop` — never `length`.
- No retries or fallback: request 4 of t1 (the same-key replay) created no
  extra request; `refusedProviderRequests: 0`.
- `rewritten: false` and `schemaUnchanged: true` on all 8 outgoing requests;
  `reasoningEffort: "omitted"` (default reasoning) and `maxTokens: 2048` on
  all 8.
- Valid proposals: t1 one claim (259 bytes), t2 one commitment (215 bytes)
  plus one optional open_loop (219 bytes) about transition pace; every
  argument passed guard, installed Mastra validator, Contract, and domain
  with `normalizationChanged: false`.
- Abstention: t3/t6 zero proposals, zero invocations; the t2 open loop is
  optional-shape only and the transient incident produced nothing.
- Visible replies on every turn (112/821/418/412/1302/487 bytes — matching
  the report's table byte-for-byte).
- Exactly one canonical commitment created through the governed USER
  boundary (`act.confirmProposal`); agent identity explicitly checked
  against `QLT_AGENT_PROPOSER_ID`; confirmation replay deduplicated;
  stale version refused `QLT_VERSION_CONFLICT` with zero effect.
- Restart preserved status, version, content bytes, lineage link, and
  per-turn assembly evidence; the fresh conversation started transcript-free
  and received the one confirmed record through C1 (603 rendered bytes) with
  pending proposals excluded; the hypothetical conflict and the transient
  turn left the commitment byte-identical.
- No context-block transcript pollution; 39 durable ledger frames and the
  serialized operator configuration scanned — the canary-scanned credential
  absent; the 499-byte synthetic fixture survived byte-identical (in-memory
  equality, no content digest), worker exit preceded re-verification and
  workspace deletion, `fixtureRemoved: true`.
- No raw provider arguments, replies, authorization data, or fixture text
  appears anywhere in the committed evidence (independently re-scanned).

## 8. Authoritative offline ladder (this audit's own run)

Run ONCE on the untouched audited tree `8a26d310…` (no code change before,
during, or after):

| Step                       | First run  | Rerun      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | exit 0     | —          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run verify:consumer`  | exit 0     | —          | registry-only exact-pin 0.3.1 + unreachable-registry negative control held                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run verify:quellight` | **exit 1** | **exit 0** | first run: `browser-ceremony-check` — `page.waitForFunction: Timeout 20000ms exceeded` at the settle/pending-chip wait AFTER scenario steps 1–9a had passed (real-browser timing flake; the previously disclosed flake class is node-side, this is the browser-side analog); rerun with IDENTICAL assertions and NO timeout changes: PASS — all 8 sub-gates green (format, typecheck, Q1–Q5 gates, node tests, UI tests, build + warning scan, browser checks, artifact scan 270 files, git diff --check) |
| `npm run verify:stage7c`   | exit 0     | —          | N-C1..N-C25 manifest (including its own missing-row negative control), release identity `vict-release-set@1/0.3.1` holds, Q2–Q6 focused gates green, N-C24 live separation held                                                                                                                                                                                                                                                                                                                           |
| `npm audit --omit=dev`     | exit 0     | —          | 0 vulnerabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `git diff --check`         | exit 0     | —          | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

The failure and the rerun are recorded truthfully; no assertion was weakened
and no timeout extended.

## 9. Documentation truthfulness (audit duty)

README, `docs/system-reference.md`, and D-Q6-15 uniformly state: recovery
live proof PASSED once; Q6 ready for fresh independent Q7 verification; **Q6
NOT formally closed; Q7 not begun; Stage 07 In Progress**. No document
claims independent verification of Q6 before this audit. The two disclosed
limitations are accurate (verified: the stale `0.3.0` strings are
console-label text only — every executable assertion checks `0.3.1`; the
boundary-replay validator import is the hashed installed Mastra dist module).
The synthetic-fixture substitution is represented exactly as the amendment
authorizes: provenance replaced, behavior rules preserved, the original
private wording disclosed as untested.

## 10. Findings

**Blocking:** none. **High:** none. **Medium:** none.

- **L-1 (new, Low):** the offline matrix's per-request boundary check does
  not include `normalizationChanged` in its failing condition (it records
  the flag but fails only on acceptance/final/parse/schema faults).
  Defense-in-depth gap only: the closed schema rejects structural mutation
  outright, the permanent probe test asserts `normalizationChanged: false`
  and `rawRouterEqual` through the real router, and all committed evidence
  records `false`. Remediation is one condition, documentation-only in
  effect; not closure-blocking.
- **L-2 (new, Low):** the matrix-level global request cap cannot be tripped
  before the ceremony phase under the frozen `maxToolCalls: 2` budget (≤3
  requests/turn × 3 pre-ceremony turns < 12). The observer enforces the cap
  regardless (independently demonstrated at requests 13–14 via the greedy
  control, which the matrix then reports as `QLT_Q6_PROVIDER_REQUEST_BOUND`);
  the bound is real, only its earliest-reachable phase is later than the
  number suggests. Not closure-blocking.
- **Carried L (disclosed):** stale `0.3.0` aggregate-log prose labels
  (assertions correct); Mastra-dist-import upgrade coupling for boundary
  replay. Both disclosed in the audited report/evidence; unchanged.
- **Observations:** (1) the receipt `wx`-flag consumption is a sound
  mechanical guard against silent re-execution; (2) the parent's
  incomplete-scan fail-closed path was independently proven (deleted-workspace
  scan refuses to report clean); (3) the historical reports and freezes are
  byte-preserved with no post-hoc edits; (4) the diagnostic evidence's
  `rewritten: true` entries correctly belong to the DECLARED diagnostic
  rewrites, not to the final proof (all eight final requests
  `rewritten: false`).

## 11. Disposition

Per reference §27.4: verdict **PASS** (VERIFIED). The audit duties of the
Stage 07C handoff §17 are satisfied for Phase Q6 by this audit, with Phases
F and Q1–Q5 carried by their completed independent verifications and formal
closures, the 0.3.1 release set by the fresh B-1..B-4 re-verification, and
the release/pin/registry truth re-proven by this audit's ladder. The bounded
live ceremony was NOT re-executed by the auditor: the owner's standing
instruction records the single successful live authorization as consumed and
directs verification of the committed receipt instead — a disposition this
audit adopts and which the receipt's own mechanical consumption guard
supports. Stage 07C formal closure is PERMITTED; the closure record issued
alongside this report records it, and Stage 07D is the next permitted
increment — permitted, and not begun.

QUELLIGHT STAGE 07C PHASE Q6 VERIFIED — PHASE Q7 COMPLETE — Q6/STAGE 07C
FORMAL CLOSURE PERMITTED — STAGE 07D PERMITTED AND NOT BEGUN
Stage 07 remains In Progress.
