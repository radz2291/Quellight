# Q6 root-cause recovery — final owner report

Date: 2026-09-22. The corrected real-provider ceremony PASSED exactly once
under this recovery authorization. Q6 is ready for fresh independent Q7
verification, not independently verified or formally closed. Q7 has not begun.
Stage 07 remains In Progress.

## Identity and ownership

| Checkpoint                                                | SHA                                        |
| --------------------------------------------------------- | ------------------------------------------ |
| Quellight starting main/origin/main, fetched and verified | `c07385e5b9b05e16471a00b8337c84afee8cf0ad` |
| VICT starting and unchanged                               | `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4` |
| Bounds and guidance amendment                             | `fb6d16e60d0cb6c1c5aabf0684d671926d3930d9` |
| Fixture privacy amendment                                 | `18f8c57a7268bc1f6db86109d61550c67f77a7a5` |
| Synthetic fixture provenance amendment                    | `a33f2b1818fbf2c0b048c1c46421a7c7c4ed41cc` |
| Final executable implementation                           | `ac594628e51d1c5901490f656b3ce6dabe3a31cc` |
| Offline verification evidence / live execution checkout   | `387015a351a4e0a8d7eda3828dacecdb9753107b` |

The documentation commit containing this report and its final remote SHA are
reported in the completion message; a commit cannot contain its own SHA.
All fixes belong to Quellight. VICT source, its unread `.pi/`, package releases,
and Quellight's exact stable `@victframework/*@0.3.1` pins remain unchanged.
No VICT publication was necessary. Historical reports and freezes are retained.

## Independently established failure boundaries

The path is Quellight instructions/profile → VICT generation settings → Mastra
model loop → Ollama Cloud `glm-5.3-flash` at `/v1/chat/completions` → SSE router
→ raw argument guard → Mastra Standard Schema validation → Quellight
`Contract.parse`/domain validation → governed invocation → inert proposal →
restored reply. Tool-result continuations are separate provider requests.

Two observable barriers prevented the desired behavior:

1. The 512-token allowance could terminate generation before a usable tool or
   answer. The historical reasoning-only `length` signature was independently
   reproduced through network-disabled production boundaries: downstream layers
   preserved the stream, and an empty completion could still report completed.
   A new real 512-token diagnostic with reasoning disabled also hit `length`,
   this time with visible content but no call. Disabling reasoning alone did
   not solve the task.
2. At 1,024 tokens with reasoning disabled, two real claim calls had correct
   nesting and fields but an oversized `content.epistemicType` and invalid
   `content.honestyState`/`content.confidence` enums. The raw guard accepted JSON;
   Mastra's actual installed validator rejected it before durable invocation.
   Contract and domain replay also rejected it. Raw and routed arguments were
   equal; normalization did not change them. This was correct contract
   enforcement, not proven argument loss in VICT or the router.

With compact guidance stating the existing closed enum encodings, 2,048 tokens,
and normal default reasoning, the diagnostic produced an accepted claim and
a natural continuation. The final unmodified production requests then passed
the entire ceremony. This establishes a working operational remediation; it
does not prove the provider's internal schema interpretation, a universal
minimum token budget, or the exact arguments of uncaptured historical failures.

Earlier runs also had independent harness failures: unresolved credential
substitution caused the 401; conversational completion without a proposal failed
the old discretion requirement; `sharedWorld.restoreThread` was the wrong API
at turn-1 reply retrieval; incorrect disposable-root handling, an un-awaited
router wrapper and an omitted probe flag invalidated other diagnostic attempts.
Those failures must not be attributed to model incapability. Historical rejected
arguments were not captured, so their precise enum defect remains unknown.

## Remediation and changed files

- `src/lib/agent/proposal-guidance.ts`, `src/lib/server/composition.ts`: explicit
  existing enum guidance; instructions revision 5/profile 7; default and maximum
  output allowance 2,048 per request. No reasoning override, argument coercion,
  schema relaxation or new authority. Capability remains `qlt.proposal.draft@3`,
  maxSteps 8, maxToolCalls 2, retries 0 and the existing 21-action inventory.
- `src/lib/sharedworld/q6-contract.ts`: correctly name the per-request token
  allowance; six user turns, twelve HTTP requests, three requests per turn,
  shared 120-second turn deadline; add the transient conversation control.
- `scripts/lib/q6-provider-observer.mjs`, `q6-provider-probe-worker.mjs`,
  `scripts/q6-provider-probe.mjs`: preserve fragmented SSE, compare validation
  boundaries in memory, retain only structural metadata, and test real adapter
  behavior with injected network-disabled responses. Count every HTTP request.
- `scripts/lib/q6-live-matrix.mjs`: enforce caps, natural visible replies on all
  turns, current-turn reply attribution, no hidden length/tool failures, request
  checkpoints, sixth-turn abstention, confirmation replay and restart version.
- `scripts/lib/q6-fixture-boundary.mjs`, `q6-live-parent.mjs`,
  `q6-live-worker.mjs`, `scripts/verify-q6-live.mjs`: compare fixture bytes only in
  memory without hashing; suppress dependency output; recover safe request
  checkpoints on abnormal exit; retain scan-before-dispose lifecycle.
- `scripts/run-q6-recovery.mjs`: owner-invoked one-shot receipt, external
  disposable synthetic fixture and safe credential loading.
- `scripts/verify-q6.mjs`, `test/q6-provider-boundary.test.ts`,
  `q6-discretion-policy.test.ts`, `q6-fixture-boundary.test.ts`,
  `q6-live-offline-matrix.test.ts`, `q6-live-parent-worker.test.ts`: permanent
  validation, privacy, request-cap, stalled-stream deadline and full adapter
  ceremony regression evidence.
- Three standalone amendments preceded their executable changes. This report,
  README, system reference, decision register and the three evidence JSON files
  record the current outcome without rewriting historical reports.

## Request accounting and real argument evidence

Exactly **13 provider HTTP requests** under this authorization: **5 diagnostic**
requests, then **8 requests in exactly one final formal live execution**.
No final rerun, SDK retry or fallback. A third diagnostic continuation was
refused before transport and is not counted as an HTTP request.

| Diagnostic requests | Purpose                                            | Result                                                     |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| 1                   | Isolate reasoning control, 512/none                | HTTP 200, length, no tool                                  |
| 2–3                 | Inspect real tool arguments, 1024/none             | HTTP 200, two invalid-enum calls, zero durable invocations |
| 4–5                 | Test encoding guidance plus 2048/default reasoning | Accepted pending claim; natural visible continuation       |

The final live calls were 259-byte claim, 215-byte commitment and 219-byte
open-loop JSON arguments. Every one passed guard, installed Mastra validator,
Contract and domain checks without normalization changes. Three actual
completed quiet-write invocations independently demonstrate bridge delivery.
All eight outgoing schemas were unchanged; the observer rewrote no final
request. All eight responses were HTTP 200; finishes were tool_calls or stop,
never length. The diagnostic tool-call experiments additionally compared raw/router equality.

| Live turn                                                | HTTP requests | New proposals / invocations             | Visible bytes | Elapsed ms |
| -------------------------------------------------------- | ------------- | --------------------------------------- | ------------- | ---------- |
| t1 explicit durable request                              | 2             | 1 claim / 1                             | 112           | 10,328     |
| t2 implicit durable commitment                           | 2             | 1 commitment + 1 optional open loop / 2 | 821           | 15,697     |
| t3 transient software incident                           | 1             | 0 / 0                                   | 418           | 4,914      |
| t4 genuinely fresh conversation                          | 1             | 0 / 0                                   | 412           | 9,065      |
| t5 hypothetical conflict                                 | 1             | 0 / 0                                   | 1,302         | 25,956     |
| t6 feeling, incident, speculation, ordinary conversation | 1             | 0 / 0                                   | 487           | 6,147      |

Every reply passed the structural natural-flow checks. No exact response wording
is asserted. Commitment acceptance preserved all four required meaning anchors;
the optional open loop concerned transition pace, not transient incidents.

## Verification and durable effects

Instrumentation was validated without provider access before diagnostics.
Focused development checks covered valid/invalid arguments, reasoning-only
length, fragmented streams, request caps, timeout and credential non-disclosure.
An initially failing offline stalled-stream deadline test exposed an observer
timer problem; it was fixed and its eight-test suite passed before committing
the final executable tree. The full network-disabled real-adapter matrix passed
six turns/eight simulated requests. The offline parent/worker launcher passed.

The authoritative ladder ran **once** on `ac594628…`, all green: `npm ci`,
`verify:consumer`, `verify:quellight`, `verify:stage7c`,
`npm audit --omit=dev` (zero vulnerabilities), `git diff --check`.
This covered full node/UI tests, format/typecheck, Q1–Q6, production build,
real-browser accessibility/responsive/Stop/ceremony checks, N-C1..N-C25 coverage,
registry-only exact pins and negative controls. The artifact scan checked 266
source/build files. One build warning was allowlisted, none unrecognized.
The ladder removed 57 newly allocated test directories, zero cleanup failures.
No large suite was rerun after the live proof; subsequent changes are evidence
and documentation only. Successful aggregate logs suppress child test counts;
no invented total is reported. A stale aggregate prose label says 0.3.0, while
the executable identity checks correctly verify stable 0.3.1.

Final live exit was 0, with zero findings. Before confirmation all proposals
were inert and there were zero canonical records. The real-user governed
boundary confirmed only the t2 commitment, creating exactly one canonical record.
Same-key turn replay used no extra provider request; confirmation replay created
no duplicate; stale version was refused with `QLT_VERSION_CONFLICT` and no effect.
Restart preserved active status, version, content, lineage and assembly evidence.
The fresh conversation began with zero transcript messages and received the
one confirmed record through C1 (603 rendered bytes); pending proposals were
excluded. Conflict and transient follow-ups did not change canonical identity,
version or content. No agent confirmation authority was added or exercised.
Neither conversation transcript contained injected context-block bytes.

The credential was absent from 39 durable ledger frames, serialized configuration,
captured child output and every persisted byte in the owned workspace. The
499-byte external synthetic fixture remained byte-identical during execution,
without any content digest. Worker exit preceded fixture re-verification,
credential scanning and workspace deletion. The separately owned fixture was
then removed. Operator `.quellight-data` was never accessed. Evidence contains
only counts, closed field names/codes, lengths and acceptance results, not raw
provider arguments, replies, authorization headers, credentials or private text.

Evidence: [diagnostics](evidence/q6-recovery-diagnostics.json),
[authoritative offline ladder](evidence/q6-recovery-offline.json),
[single final live receipt](evidence/q6-recovery-live.json).

## Limits and pending work

- The original private fixture path was unavailable. The separately committed
  provenance amendment authorizes a labeled synthetic naturalistic fixture;
  the exact historical private wording is untested.
- One bounded live success is not a guarantee for every future model response.
  The 2,048-token bound is demonstrated, not mathematically minimal. The generic
  runtime still permits lower operator limits; formal proof rejects length.
- Boundary replay imports an internal validator from the installed pinned Mastra
  build; an upgrade requires revalidation. No framework defect/release is claimed.
- Fixture checks detect ordinary changes, not an adversary forging filesystem
  metadata. No private content digest is used.
- **Pending:** fresh independent Q7 verification and formal Q6 closure. No more
  live executions are authorized by this consumed one-shot recovery permission.

QUELLIGHT Q6 ROOT CAUSE REMEDIATED — LIVE CEREMONY PROOF PASSED — READY FOR FRESH INDEPENDENT Q7 VERIFICATION
Q6 IS NOT YET FORMALLY CLOSED
PHASE Q7 HAS NOT BEGUN
Stage 07 remains In Progress.
