# Quellight Stage 07C Phase Q6 — Tool-Argument Diagnostic Completion

**Status: DIAGNOSTIC COMPLETE — CLASSIFICATION F (STILL INCONCLUSIVE ON THE
TOOL-ARGUMENT REJECTION BOUNDARY). Both authorized diagnostic provider
requests completed (HTTP 200, `finish_reason: length`) and the real model
emitted NO tool call in either response: its reasoning phase consumed the
entire 512-token output budget (2,403 / 2,326 reasoning bytes, 0 visible
content bytes, 0 tool-call deltas), so there is NO generated tool-argument
JSON to capture. The tool-call rejection boundary from the earlier diagnostic
remains UNIDENTIFIED — precisely because, within the frozen bounds, the pinned
model does not reliably reach the tool call at all. The Execution-4
empty-reply class was reproduced TWICE with the finish reason captured, and
the reasoning-budget mechanism is now DIRECTLY EVIDENCED (budget exhaustion,
not inference). The corrected machinery is fully validated offline. NO
live-proof execution occurred. Phase Q7 remains BLOCKED — NOT BEGUN. NO FIFTH
LIVE EXECUTION IS AUTHORIZED. Q6 remains not independently verified and not
formally closed. Stage 07 remains In Progress.**

## 1. Exact SHAs

| Item                                                                                               | Value                                         |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Quellight HEAD at diagnostic time (verified `== origin/main`, clean tracked tree, linear ancestry) | `03df759476d7c7defa7af383573a8f2441c6a72b`    |
| VICT HEAD (verified `== origin/main`; read-only reference)                                         | `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4`    |
| Final Quellight tip                                                                                | the documentation commit carrying this report |

## 2. Request accounting (exact)

| Item                        | Value                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorized                  | maximum TWO diagnostic provider requests (not live-proof executions)                                                                                                                                |
| Provider requests executed  | **exactly 2** (no third attempt, no retry, no automatic follow-up — the follow-up is structurally refused before any network byte and did not occur because neither response contained a tool call) |
| Provider / model / endpoint | `ollama-cloud` / `glm-5.3-flash` / `https://ollama.com/v1` (registry-pinned; env-var credential lookup)                                                                                             |
| Bounds                      | max output 512 tokens, deadline 120 s, 0 retries, no fallback, no reasoning-control field (verified in both captured request bodies: `reasoningFields: []`)                                         |

### Request 1 — exact production request

- Captured outgoing body: `{model: glm-5.3-flash, max_tokens: 512, stream: true, tool_choice: "auto", bodyKeys: [model, max_tokens, messages, tools, tool_choice, stream], messageRoles: [system, user], tools: [qlt_proposal_draft], reasoningFields: []}` — the exact production request; nothing rewritten (`otherKeysUnchanged: true`).
- Response: HTTP 200, 154 SSE events, 36,803 body bytes, 7,926 ms, `[DONE]` seen.
- **reasoning bytes: 2,403; visible content bytes: 0; tool-call deltas: 0; tool name: none.**
- **finish_reason: `length`** (router-verified: `{unified: "length", raw: "length"}`).
- Router part chain: `stream-start → response-metadata → reasoning-start → reasoning-delta(s) → reasoning-end → finish(length)`.
- Turn: **completed** (8,778 ms), restored assistant text **0 bytes**, 0 invocations, 0 proposals.
- Verdict: `completed-without-complete-tool-call (finish=length)`.

### Request 2 — permitted fallback (executed UNFORCED — truthful disclosure)

Request 1 completed without a tool call, so Request 2 was permitted. The
probe's forcing flag (`QLT_FORCE_REQUEST2`) was **not set in the launch
environment** (a probe-side configuration omission, disclosed here
truthfully): Request 2 therefore repeated the exact production shape
(`tool_choice: "auto"`; captured `originalToolChoice → finalToolChoice:
"auto" → "auto"`, `rewritten: false`). The authorization makes forcing
optional ("may force"), so the request was within budget and otherwise
unchanged — but the discriminating forced-tool-choice variant was NOT run.
The model-facing request was in all other respects the exact production
request.

- Response: HTTP 200, 178 SSE events, 41,897 body bytes, 6,865 ms.
- **reasoning bytes: 2,326; visible content bytes: 0; tool-call deltas: 0; tool name: none.**
- **finish_reason: `length`** (router-verified).
- Turn: **completed** (7,579 ms), restored assistant text **0 bytes**, 0 invocations, 0 proposals.
- Verdict: `no-complete-tool-call (finish=length)`.

No third request is authorized; none was attempted.

## 3. The exact generated tool-argument JSON

**None exists.** The model emitted zero tool-call deltas in both responses, so
there is no raw argument JSON, no fragment list, no router reassembly, no
Mastra normalization, no guard input, no standard-schema input, no
`Contract.parse` input, and no capability-handler input to record for this
task. The capture chain itself is machinery-validated end-to-end (§5) and
would have produced every required representation.

## 4. What WAS proven — the reasoning-budget mechanism (direct evidence)

Both authorized responses carry the **strongest possible evidence of output
budget exhaustion**: the provider's own `finish_reason: length`. No inference
is required.

| Observable              | Request 1               | Request 2               | Execution 4 (per-turn, historical) |
| ----------------------- | ----------------------- | ----------------------- | ---------------------------------- |
| HTTP                    | 200                     | 200                     | (not captured)                     |
| finish_reason           | **length**              | **length**              | (not captured)                     |
| reasoning bytes         | 2,403                   | 2,326                   | (not captured)                     |
| visible content bytes   | **0**                   | **0**                   | 0 (restored reply empty)           |
| tool calls              | **0**                   | **0**                   | 0                                  |
| invocations / proposals | 0 / 0                   | 0 / 0                   | 0 / 0                              |
| turn outcome            | completed, 0-byte reply | completed, 0-byte reply | completed, 0-byte reply            |
| elapsed                 | 8.8 s                   | 7.6 s                   | 6.4–7.8 s                          |

The pinned model, under the frozen bounds (512 output tokens, no reasoning
control), streams its reasoning phase and exhausts the budget **before any
tool-call or content tokens are emitted**. The turn then completes truthfully
with an empty reply — the Execution-4 signature, now reproduced twice with the
finish reason captured.

### Truthful disposition of the earlier reasoning-budget theory

- **`finish_reason: tool_calls` does not prove budget exhaustion** — correct,
  and it remains true for THAT earlier diagnostic response: that particular
  response DID complete a tool call (reasoning 1,885 bytes + a well-formed
  `qlt_proposal_draft` call) within the budget. Model behavior is
  non-deterministic across runs: when the reasoning phase fits within 512
  tokens, the tool call completes (earlier diagnostic); when it does not, the
  budget is exhausted with zero visible content and no tool call (both of
  today's requests).
- **Zero visible text before a tool call may be normal** — confirmed; no
  downstream layer drops anything (all preservation findings remain valid).
- **The reasoning-budget mechanism for the Execution-4 empty-reply class is
  now directly evidenced**: both of today's responses show
  `finish_reason: length` with pure reasoning and zero content — the exact
  Execution-4 observable, with the previously missing finish reason now
  captured. For the empty-reply class the earlier theory stands PROVEN as a
  mechanism (with direct, not inferential, evidence).
- **Reasoning control remains a separate, undecided concern for non-tool
  turns** — unchanged; no reasoning-control amendment is authorized or made.

## 5. Corrected machinery — offline validation (zero real provider contact)

The previous attempt's instrumentation defect (`doStream` wrapper missing
`await`) was reproduced offline, corrected, and the complete v3 machinery was
validated against a LOCAL SIMULATED provider (loopback only, canary
credential, disposable stores; the simulated arguments are a machinery-
validation artifact and are explicitly NOT model output):

- the corrected wrapper forwards the complete router part chain, including
  `tool-input-start/delta/end`, `tool-call`, and `finish`;
- the raw argument JSON is reassembled from SSE fragments with byte offsets
  and replayed through every fence: raw-argument guard (pass), real Mastra
  `validateToolInput` (rejected the deliberately invalid simulated shape with
  the sanitized non-echoing marker `vict-contract-rejected`; the durable
  `tool.failed` frame carried the exact stable code `VICT_TOOL_FAILED`),
  authoritative `Contract.parse` (rejected with per-field issues
  `{code, path}` — e.g. `QLT_INPUT_UNKNOWN_FIELD @ statement`,
  `QLT_INPUT_INVALID_ENUM @ proposalKind` — accumulated across ALL fields),
  and the real governed bridge (deterministic rejection: 0 invocations,
  0 proposals);
- the smallest corrected fixture (six minimal, pointer-addressed
  transformations: nest top-level content fields under `/content`, correct the
  branch `insight → claim`, derive `/content/subject` from the statement, map
  `epistemicType preference → E2`, `honestyState certain → known`,
  `confidence high → stated`) parsed OK and, replayed through the REAL
  governed bridge on loopback, produced **one durable quiet-write invocation
  (completed), one pending proposal (`status: proposed`), zero approvals, zero
  changesets (zero canonical effect), no authority escalation** (pinned local
  actor, in-turn quiet path).

This proves the capture machinery and the deterministic replay are correct;
had the model emitted a tool call, every required representation would have
been recorded.

## 6. Classification

**F — still inconclusive.** Precise reason: the tool-call rejection boundary
cannot be identified without the generated argument JSON, and the model
produced none — in both authorized requests its reasoning phase consumed the
full 512-token output budget (provider-reported `finish_reason: length`,
0 tool-call deltas, 0 content bytes). The question is unreachable at the
frozen bounds: the model does not reliably reach the tool call at all.
A–E therefore remain unevidenced; the machinery to decide them (capture +
replay + corrected-fixture proof) is validated and ready for any future
authorization.

No production repair was implemented. The smallest actionable remediation —
exactly one of: (a) a bounded frozen amendment adding explicit reasoning
control to the pinned model path, or (b) an evidence-based output-token
ceiling correction — remains an OWNER DECISION, now supported by direct
evidence that the unbounded reasoning phase is the binding constraint.

## 7. Credential protection

The credential file was read for the authorized requests: only the `ollama`
entry's `key` value, in memory only (set as the provider's env-var value);
never printed, hashed, persisted, serialized, copied into repository content,
or placed in command arguments. No fixture was accessed. `.quellight-data`
never accessed (mtime unchanged). VICT untouched (`fd0c1f7…`; pre-existing
untracked `.pi/` never read). The disposable diagnostic store was removed
after transcription; no credential bytes exist in the repository or records.

## 8. Cleanup

- Probe scripts, result JSONs, disposable stores, simulated-provider servers,
  and loopback listeners were removed and verified absent.
- No child process or listener remains.
- No code, test, script, contract, manifest, lockfile, pin, or provider
  setting was changed. Neither previous diagnostic report was modified.
- Pre-existing OS-temp gate-fixture directories were left untouched.

## 9. Exact next owner decision

1. **If the tool-argument question is still wanted:** authorize a new single
   diagnostic request with a raised output budget or explicit reasoning
   control (both are frozen-bound amendments requiring owner approval); the
   corrected, machinery-validated probe is ready and would capture every
   required representation on its first response.
2. **If the empty-reply class is the priority:** the mechanism is now
   directly evidenced (§4); the owner may decide the reasoning-control vs
   token-ceiling amendment for the frozen model path and close Q6's
   empty-reply item on that basis.
3. In either case, the tool-call rejection boundary observed in the earlier
   diagnostic remains a separate, open item; today's evidence shows the model
   may never reach it within the frozen bounds.
