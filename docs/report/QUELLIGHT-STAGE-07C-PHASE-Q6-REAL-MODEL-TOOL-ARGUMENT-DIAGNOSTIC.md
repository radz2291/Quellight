# Quellight Stage 07C Phase Q6 — Real-Model Tool-Argument Contract Diagnostic

**Status: DIAGNOSTIC ATTEMPT EXECUTED AND FAILED CLIENT-SIDE — the one
authorized provider request attempt was initiated and aborted mid-flight by a
verified probe instrumentation defect; no response was captured; the exact
generated tool-argument JSON was NOT captured; the tool-call rejection
boundary REMAINS UNIDENTIFIED and NO A–E classification is evidence-backed.
The single-request authorization is conservatively treated as CONSUMED. NO
second request was made (prohibited). The corrected probe machinery is now
proven end-to-end on loopback. The earlier "Classification B" conclusion is
truthfully DISPOSED OF as an unsupported hypothesis. NO live-proof execution
occurred. Phase Q7 remains BLOCKED — NOT BEGUN. NO FIFTH LIVE EXECUTION IS
AUTHORIZED. Q6 remains not independently verified and not formally closed.
Stage 07 remains In Progress.**

## 1. Exact SHAs

| Item                                                                              | Value                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------- |
| Quellight HEAD at diagnostic time (verified `== origin/main`, clean tracked tree) | `860f172d2c6e7baecaa2bb893583dc19a9692393`    |
| VICT HEAD (verified `== origin/main`; read-only reference)                        | `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4`    |
| Final Quellight tip                                                               | the documentation commit carrying this report |

## 2. Request accounting (truthful)

| Item                                                | Value                                                                                                                                                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorized                                          | exactly ONE diagnostic provider request, dated 2026-09-22                                                                                                                                                            |
| Provider request attempts initiated                 | 1 (the fetch wrapper was invoked once for `ollama.com` with the fully built request; `refusedRequests: 0`, `refusedExternal: 0`, zero retries)                                                                       |
| What happened                                       | the request was aborted mid-flight ~200–300 ms into the attempt by a PROBE instrumentation defect (§4); no response was consumed; no boundary capture recorded a response                                            |
| Whether request bytes reached the provider endpoint | **could not be determined** (the abort window fell during connection/request transmission; DNS + TCP + TLS to `ollama.com` were verified healthy from this machine immediately before and after)                     |
| Conservative disposition                            | the ONE-request authorization is treated as CONSUMED; no re-run (a second request is explicitly prohibited)                                                                                                          |
| Turn outcome                                        | `failed` / `VICT_AGENT_TURN_FAILED` in 425 ms (truthful client-side failure; `0` durable invocations, `0` proposals, no assistant message; ledger: `response.started` → `usage.updated` (0/0/0) → `response.failed`) |

The authorization's stated purpose — capturing the real model's generated
tool-argument JSON — was therefore **not achieved**. Per the owner's standing
rule ("exactly 1 maximum"; "Do not run a second request…"), no re-run was
performed or is authorized by this task.

## 3. What WAS captured from the real attempt (structural only)

The intercepted request body (captured before transmission; structural fields
only; the synthetic prompt text is NOT recorded):

```json
{
  "model": "glm-5.3-flash",
  "max_tokens": 512,
  "stream": true,
  "tool_choice": "auto",
  "messageRoles": ["system", "user"],
  "reasoningFields": [], // NO reasoning control of any kind
  "bodyKeys": ["model", "max_tokens", "messages", "tools", "tool_choice", "stream"],
  "toolFunctionName": "qlt_proposal_draft"
}
```

The exact model-facing input schema transmitted upstream (`function.parameters`)
is **structurally equal** (key-order-normalized deep compare; 1,781 bytes
serialized both ways; the wire layer normalizes key order) to the frozen
revision-3 `descriptiveJsonSchema` presentation on the input contract — the
ADEQUATE closed schema with per-branch required fields, closed enums,
`additionalProperties: false`, and the `oneOf` branch list reached the
provider. (Same evidence from the loopback validation: the wire schema is the
frozen presentation, re-keyed.)

No response bytes, no reasoning text, no content text, no tool-argument JSON,
and no finish reason were captured from the real attempt.

## 4. Verified cause of the failed attempt (offline-reproduced; NO network)

The probe's `ModelRouterLanguageModel.prototype.doStream` wrapper called the
async original **without awaiting it**:

```js
const callResult = originalDoStream.call(this, callOptions); // a PROMISE
const source = callResult.stream; // undefined
// first pull: reader = source.getReader() -> TypeError
```

Offline reproduction (no network): the wrapped stream's FIRST pull throws
`TypeError: Cannot read properties of undefined (reading 'getReader')` — the
stream chain errors before any part flows, the model layer cancels the stream,
and the in-flight fetch is aborted mid-flight (~200–300 ms into the attempt).
This exactly matches the real attempt's observable: turn failed in 425 ms with
`VICT_AGENT_TURN_FAILED`, zero router parts recorded, zero response capture,
and the request counted at the fetch boundary. The Mastra span record for the
attempt independently shows `finishReason: error` with `maxOutputTokens 512`,
`maxRetries 0`, available tools `qlt_proposal_draft`, `toolChoice auto` — and
no error payload was persisted anywhere.

## 5. Corrected probe machinery — proven end-to-end on LOOPBACK (zero real provider contact)

The corrected wrapper (`await originalDoStream.call(this, …)`) was validated
against a loopback-simulated provider (real composition, real live model
factory, real bridge, disposable stores, canary credential — `auth.json`
never read):

- the router part chain is recorded IN FULL: `stream-start`,
  `response-metadata`, `reasoning-start`, `reasoning-delta` ×2,
  `reasoning-end`, `tool-input-start`, `tool-input-delta` ×2,
  `tool-input-end`, `tool-call`, `finish {unified: tool-calls, raw:
tool_calls}`;
- the raw tool-argument JSON is captured from the SSE fragments and replayed
  through every fence: raw-argument guard (pass), Mastra
  `validateToolInput` (accepted), authoritative `Contract.parse` (accepted),
  content-domain `parseProposalContent` (accepted), and — through the REAL
  governed bridge — a durable, quiet, keyed invocation `completed` with
  EXACTLY ONE pending claim proposal created (`tool.completed` milestone,
  `argumentSummary: object(2 fields)`, zero approvals);
- `convertUndefinedToNull` normalization changed NOTHING for this shape
  (verified false for the whole-document JSON compare);
- the one-request cap structurally refused the loop's automatic post-tool
  follow-up request BEFORE any network byte (the turn then failed truthfully —
  expected in loopback mode; the loopback follow-up refusal is NOT a provider
  event).

This proves the corrected diagnostic would deliver all required captures on
its first run.

## 6. Correction of the earlier reasoning-budget inference ("Classification B")

The earlier boundary-investigation report (D-Q6-12) concluded
"Classification B — reasoning consumed the available output budget." The
owner's framing and the new evidence require a truthful demotion:

- **What remains valid (offline-proven):** every downstream layer preserves
  every supported field; a reasoning-only response maps exactly to the
  Execution-4 observable (completed turn, empty restored reply, 0 invocations,
  0 proposals); the parser already supports the field the provider emits
  (`delta.reasoning`); the request sends `max_tokens: 512` with NO reasoning
  control (re-verified in the real attempt's captured request:
  `reasoningFields: []`).
- **What is WITHDRAWN:** the claim that reasoning consumed the output budget.
  The earlier diagnostic response ended with `finish_reason: tool_calls`, not
  `length`; zero visible content before completing a tool call is normal
  provider behavior; and the immediate failure in that response was the
  tool-call contract rejection (`tool.failed`, 0 invocations) — whose cause
  (the rejected arguments) was not captured. Budget exhaustion is therefore
  an UNEVIDENCED hypothesis for Execution 4, not a classification.
- **New uncertainty:** Execution 4's per-turn elapsed times (6.4–7.8 s) can no
  longer be mapped to a single provider request: a reasoning + tool-call
  response triggers the loop's automatic follow-up request within
  `maxSteps: 8`, so each recorded turn may contain TWO or more provider
  requests. Execution 4's per-turn finish reasons AND request counts remain
  unknown.
- **Standing disposition:** reasoning-control or token-ceiling amendments
  remain UNDECIDED and are not to be advanced until the tool-call rejection is
  independently understood (the owner's own instruction, unchanged).

## 7. The tool-call rejection: boundary map (what is and is not known)

The REAL governed pipeline for a model tool call, verified in source and
exercised on loopback:

```text
raw SSE argument fragments (JSON string)
→ ModelRouter tool-call part (arguments parsed by the router)
→ Mastra Tool wrapper: normalizeNullishInput → convertUndefinedToNull →
  ~standard.validate (→ the frozen Contract.parse) — on failure the wrapper
  RETURNS an {error: true} result (bridge never reached) → adapter:
  VICT_TOOL_FAILED
→ raw-argument guard (untouched args; hostile keys only)
→ bridge execute: Contract.parse SECOND fence
  → VICT_CAPABILITY_INPUT_CONTRACT_REJECTED
→ durable intent → invocation → capability invoke → output contract
```

Known: the earlier diagnostic's durable events were
`tool.requested → tool.started → tool.failed` with zero durable invocations —
consistent with a rejection at the Mastra tool-input validation boundary
(`VICT_TOOL_FAILED`) OR an envelope failure before invocation; the exact
stable error code was not captured then, and this attempt captured nothing.

Unknown (requires the arguments): whether the real model's arguments
themselves were invalid (A/B), whether Mastra's normalization changed a valid
shape (C), whether the VICT/bridge fence rejected a semantically safe shape
(D), or whether an unrelated defect intervened (E). **No A–E classification is
evidence-backed by this task.**

## 8. Required captures — status

| Capture                                          | Status                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| HTTP status                                      | not captured (request aborted mid-flight)                                                   |
| finish reason                                    | not captured (real attempt); loopback-validated capture machinery                           |
| reasoning / content byte counts                  | not captured (real attempt)                                                                 |
| tool name                                        | not captured (real attempt)                                                                 |
| complete tool-argument JSON                      | **NOT CAPTURED** — the central objective failed                                             |
| JSON byte length / property names / nesting      | not captured                                                                                |
| ModelRouter-translated tool input                | not captured (real attempt); machinery validated on loopback                                |
| Mastra-normalized tool input                     | not captured (real attempt); replay machinery validated on loopback                         |
| raw-argument-guard result                        | not captured (real attempt); validated on loopback                                          |
| standard-schema / `Contract.parse` result        | not captured (real attempt); validated on loopback                                          |
| governed-bridge result + exact stable error code | not captured (real attempt); the earlier diagnostic's `tool.failed` code remains uncaptured |
| first rejecting/changing boundary                | **UNIDENTIFIED**                                                                            |

The contract-comparison table for the captured arguments (proposalKind,
content fields, commitmentKey, etc.) could not be produced: there is nothing
to compare. No field addition/removal/rename/null-conversion can be asserted
for the real response; the loopback validation shows the pipeline performs
NONE of these transformations for structurally valid input.

## 9. Credential protection

The credential file was read ONCE for the authorized attempt: only the
`ollama` entry's `key` value, in memory only; never printed, hashed,
serialized, persisted, or placed in command arguments. The disposable
diagnostic store was byte-scanned for the credential value (0 occurrences),
and the attempt's captures contain no credential bytes. The loopback
validation used a canary only and never read `auth.json`. No fixture was
accessed. `.quellight-data` never accessed (mtime unchanged). VICT untouched
(`fd0c1f7…`; pre-existing untracked `.pi/` never read).

## 10. Cleanup

- All probe scripts, result JSONs, disposable stores (`diag-store`,
  `v2-loopback-store`), and the loopback server were removed and verified
  absent after this report was transcribed.
- No child process or listener remains.
- No code, test, script, manifest, lockfile, frozen contract, prompt,
  instruction, schema, or bound was modified. No historical report modified.
- Pre-existing OS-temp `qlt-q6-compose-*`/`discretion-*`/`fixture-*`/
  `fresh-*`/`hostile-*`/`offline-restore-*` gate-fixture directories from
  earlier runs were left untouched.

## 11. Exact next owner decision

1. **Re-authorize exactly ONE corrected diagnostic provider request.** The
   corrected probe is machinery-validated end-to-end on loopback (§5); a
   re-authorization would be a NEW owner decision (the current authorization
   is consumed), and the corrected probe is ready.
2. Alternatively, defer the tool-call rejection question and resolve the
   Execution-4 empty-reply class through the offline record alone — which,
   with this correction, can no longer settle the root cause offline.
3. In either case, the reasoning-control / token-ceiling amendment decision
   remains SEPARATE and should not advance until the tool-call rejection
   boundary is identified.
