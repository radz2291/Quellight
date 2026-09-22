# Quellight Stage 07C Phase Q6 — Empty-Reply Boundary Investigation (Execution 4)

**Status: INVESTIGATION COMPLETE — FIRST-LOSS BOUNDARY LOCALIZED; ROOT-CAUSE
CLASSIFICATION B (reasoning consumed the available output budget), with a
secondary real-model tool-call rejection finding. Entirely OFFLINE except ONE
instrumented diagnostic provider request, made under the owner's conditional
addendum (exactly one; structural metadata only; all bounds respected). NO
live-proof execution, NO retry, NO repair, NO contract change occurred. Phase
Q7 remains BLOCKED — NOT BEGUN. NO FIFTH LIVE EXECUTION IS AUTHORIZED. Q6
remains not independently verified and not formally closed. Stage 07 remains
In Progress.**

## 1. Starting and final SHAs

| Item                                                                                         | Value                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Starting Quellight HEAD (investigation start; verified `== origin/main`, clean tracked tree) | `5e43aba7d2e48f60110930b1b239b606966b4ba5`                                                                               |
| Starting VICT HEAD (verified `== origin/main`; read-only reference)                          | `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4`                                                                               |
| Final Quellight tip                                                                          | the documentation commit carrying this report (recorded in the decision register D-Q6-12 and in the conversation return) |

Both repositories were fetched at the start; no remote advancement occurred
during the investigation. Linear ancestry verified (origin/main is an
ancestor of HEAD; working trees clean apart from VICT's pre-existing
untracked `.pi/`, never read).

## 2. Independence statement

This investigation was performed offline and additively. It is NOT a live
proof execution, NOT Execution 5, NOT the Q6 ceremony, and NOT
`verify:q6:live`. No code, test, script, manifest, lockfile, frozen contract,
provider identity, prompt, instruction, schema, bound, or acceptance rule was
modified. No historical report was modified. Historical Execution-4 records
were read as inputs only. All probes ran from a disposable OS-temporary
workspace outside both repositories, with canary credentials, local loopback
or in-memory transports, and structural-metadata-only recording.

## 3. Evidence-versus-inference correction

The consumed Execution-4 record establishes (directly observed by the
harness):

- the restored end-to-end assistant reply was empty for t1, t2, and t3
  (`composition.restoreThread()` → last assistant message text → the
  natural-flow predicate);
- zero durable capability invocations, zero proposals, zero canonical effects
  per turn;
- turn statuses `completed`, elapsed ≈ 6.4–7.8 s, inside every frozen bound.

The report's phrase "the provider … returned a completed, in-bounds response
… but the message content was empty" was an INFERENCE about the raw provider
response, which was not captured. The truthful formulation (recorded
additively, without rewriting the historical report):

> The end-to-end Quellight path produced an empty restored assistant message;
> the raw provider response was not captured, so its original contents remain
> unknown.

The diagnostic request (below) now supplies direct evidence about the raw
shape: raw responses of this provider/model are NOT empty — they carry
reasoning output and (when emitted) a valid tool call, with **zero visible
content**.

## 4. Exact dependency versions (installed and lockfile-pinned)

| Package                               | Version                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mastra/core`                        | 1.64.0                                                                                                                                               |
| `@mastra/memory`                      | 1.28.2                                                                                                                                               |
| `@mastra/libsql`                      | 1.22.3                                                                                                                                               |
| `@mastra/observability`               | 1.17.5                                                                                                                                               |
| `@victframework/*`                    | 0.3.1 (exact pins; release set `vict-release-set@1/0.3.1`)                                                                                           |
| OpenAI-compatible chat implementation | `@ai-sdk/openai-compatible` **2.0.62** (bundled into `@mastra/core` dist; source maps resolve to the original package)                               |
| provider utilities                    | `@ai-sdk/provider-utils` 4.0.40                                                                                                                      |
| `ai` package                          | NOT installed (Mastra implements its own loop/streamText machinery)                                                                                  |
| runtime                               | Node v22.13.1                                                                                                                                        |
| provider registry                     | `@mastra/core` models.dev static bundle; `ollama-cloud` → url `https://ollama.com/v1`, `apiKeyEnvVar: OLLAMA_API_KEY`, `apiKeyHeader: Authorization` |

## 5. Complete response pipeline (verified by trace and probe)

```text
OpenAI-compatible SSE bytes
→ fetch (global; resolved lazily via getOriginalFetch)
→ @ai-sdk/openai-compatible@2.0.62 chunk schema (zod; delta is a STRIP-mode
   z.object declaring ONLY role, content, reasoning_content, reasoning,
   tool_calls) and chunk transform (delta.reasoning_content | delta.reasoning
   → reasoning-start/delta/end; delta.content → text-start/delta/end;
   delta.tool_calls → tool-input-* + tool-call; finish_reason stop/length/
   content_filter/tool_calls preserved; unknown fields — e.g. thinking —
   are STRIPPED at schema parse, before any transform)
→ ModelRouterLanguageModel.doStream (spec v2; wraps the inner v3 chat model
   in AISDKV6LanguageModel, a pass-through doStream adapter)
→ Mastra loop streamText consumption → convertFullStreamChunkToMastra
   (normalizeFinishReason: {unified, raw} → unified string; usage normalized)
→ Mastra Agent step machinery (processOutputStream; zero-output guard fires
   ONLY for reason "other" with no content chunk)
→ VICT Mastra adapter fullStream switch (tool-call / tool-result / tool-error
   / text-delta / finish / error / abort; reasoning parts fall to default and
   do not enter the reply TEXT — by design)
→ VICT durable stream ledger (durable kinds: response.started, tool.*,
   usage.updated, memory.updated, content.completed, response.completed/failed)
→ Mastra transcript store (assistant message parts: text AND reasoning parts
   both persisted; empty text spans skipped)
→ Quellight restoreThread() (extracts ONLY `type: 'text'` parts)
→ Q6 acceptance (replyText = last assistant message text)
```

## 6. Synthetic response matrix (offline boundary probes)

### Lane C — intercepted ModelRouterLanguageModel (real router + real bundled parser; loopback transport; canary)

| #   | Scenario (synthetic SSE)                  | Router stream parts                                 | text bytes | reasoning bytes | tool calls             | finish     | Result                           |
| --- | ----------------------------------------- | --------------------------------------------------- | ---------- | --------------- | ---------------------- | ---------- | -------------------------------- |
| S1  | `delta.content` text                      | text-start/delta/end + finish                       | 34         | 0               | 0                      | stop       | preserved                        |
| S2  | `delta.tool_calls`                        | tool-input-* + tool-call                            | 0          | 0               | 1 (qlt_proposal_draft) | tool-calls | preserved                        |
| S3  | `reasoning_content` then text             | reasoning-* + text-*                                | 21         | 60              | 0                      | stop       | both preserved                   |
| S4  | reasoning then tool call                  | reasoning-* + tool-call                             | 0          | 19              | 1                      | tool-calls | both preserved                   |
| S5  | reasoning-only, finish stop               | reasoning-* + finish                                | 0          | 36              | 0                      | stop       | text absent (expected)           |
| S6  | reasoning-only, finish length             | reasoning-* + finish                                | 0          | 30              | 0                      | **length** | finish preserved; text absent    |
| S7  | empty content, stop                       | stream-start + finish only                          | 0          | 0               | 0                      | stop       | no content parts                 |
| S8  | fragmented tool arguments                 | tool-input-* + tool-call                            | 0          | 0               | 1                      | tool-calls | arguments concatenated correctly |
| S9  | content + tool call same response         | text-* + tool-call                                  | 22         | 0               | 1                      | tool-calls | both preserved                   |
| S10 | upstream HTTP 500                         | — (doStream rejects `AI_APICallError`)              | —          | —               | —                      | —          | truthful failure                 |
| S11 | unsupported field `delta.thinking` + text | text-* only (thinking STRIPPED by the chunk schema) | 30         | 0               | 0                      | stop       | thinking dropped; text preserved |
| S12 | alternate field `delta.reasoning` + text  | reasoning-* + text-*                                | 31         | 40              | 0                      | stop       | both preserved                   |

Guard: every request intercepted before leaving the process (0 escapes).

### Lane D — end-to-end through the REAL Quellight composition (gateway branch, production wrappers, Mastra Agent, VICT adapter, operational stores, stream ledger, transcript store, `restoreThread()`)

| #   | Scenario                          | Turn status                       | Invocations | Proposals           | Restored assistant text                                             | Durable milestone set                            |
| --- | --------------------------------- | --------------------------------- | ----------- | ------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| D1  | plain text                        | completed (≈0.7 s)                | 0           | 0                   | 27 chars — **preserved**                                            | full completed set                               |
| D2  | valid `qlt_proposal_draft` call   | completed                         | **1**       | **1 pending claim** | post-tool text preserved                                            | tool.requested/started/completed + completed set |
| D3  | reasoning + final text            | completed                         | 0           | 0                   | final text preserved                                                | completed set                                    |
| D4  | reasoning + tool call             | completed                         | 1           | 1 claim             | tool call preserved                                                 | tool.* + completed set                           |
| D5  | **reasoning-only, finish stop**   | **completed**                     | 0           | 0                   | **EMPTY — the Execution-4 signature**                               | completed set                                    |
| D6  | **reasoning-only, finish length** | **completed**                     | 0           | 0                   | **EMPTY — the Execution-4 signature**                               | completed set                                    |
| D7  | empty content, finish stop        | completed                         | 0           | 0                   | no assistant message at all (reply '' by the no-assistant fallback) | completed set                                    |
| D8  | unsupported `thinking` + text     | completed                         | 0           | 0                   | thinking dropped; text preserved                                    | completed set                                    |
| D9  | upstream HTTP error               | failed (`VICT_AGENT_TURN_FAILED`) | 0           | 0                   | —                                                                   | response.failed                                  |

Positive controls proven: ordinary text survives end to end; a valid tool
call reaches the governed bridge exactly once (one invocation, one pending
claim); reasoning + final text preserves the text; reasoning + tool call
preserves the tool call.

Wrapper variants (base router model; + context wrapper; + deadline wrapper;
both in production order `deadline(context(base))`): stream parts, text/
reasoning byte counts, finish reasons, and result properties are IDENTICAL
across all four configurations. Neither wrapper changes or drops any part.

## 7. First-loss-boundary result

**No downstream layer loses any supported field.** For every supported
upstream field (`delta.content`, `delta.tool_calls`, `delta.reasoning`,
`delta.reasoning_content`, fragmented arguments, mixed responses), the
end-to-end pipeline preserves it through the router, the agent loop, the VICT
adapter, both stores, and `restoreThread()`.

The only true loss boundaries found:

1. **Latent (not actual):** a `delta.thinking` field would be STRIPPED at the
   parser's chunk schema (strip-mode `z.object` declaring only role/content/
   reasoning_content/reasoning/tool_calls). Proven synthetically (S11).
   NOT actual for this provider: the diagnostic proves Ollama Cloud emits
   `reasoning`, which IS supported (S12 and the diagnostic both translate it).
2. **By design:** reasoning parts are persisted in the transcript as
   `type: 'reasoning'` parts and are deliberately NOT part of the reply text
   (VICT adapter reply-text accumulation and Quellight `restoreThread()` both
   extract text parts only). A reasoning-only response therefore yields a
   completed turn whose restored reply is empty — with the assistant message
   present (reasoning part only). A zero-content response yields a completed
   turn with NO assistant message (empty-text spans are skipped; reply '' via
   the no-assistant fallback).

## 8. The single diagnostic provider request (conditional addendum; authorized)

The offline boundary matrix could NOT distinguish "provider produced a
genuinely empty result" from "reasoning consumed the output budget" — both
reproduce the identical downstream signature. Under the owner's conditional
addendum, EXACTLY ONE instrumented diagnostic provider request was made.

- Identity: `ollama-cloud` / `glm-5.3-flash` at `https://ollama.com/v1`;
  the REAL Quellight live seam (registry-resolved model, real instructions,
  real pinned `qlt.proposal.draft@3` capability and schema); ONE synthetic,
  non-personal explicit-memory prompt; canary-free (the real credential from
  the owner-designated `auth.json`, read in memory only).
- Bounds: 1 request (structurally enforced: any further `ollama.com` request
  is refused before touching the network — the loop's automatic post-tool
  follow-up attempt WAS refused by this cap and never reached the network);
  `max_tokens: 512`; 120 s deadline; zero retries; no fallback.
- Credential handling: only `auth.json` → `ollama.key` read, in memory only;
  never printed, hashed, serialized, persisted, or placed in command
  arguments; byte-level scan of the disposable store afterward: credential
  absent (7 files scanned, 0 findings); store then deleted and absence
  verified.

### Raw response (structural metadata only)

| Item                                               | Value                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP status                                        | 200                                                                                                                                             |
| Content type                                       | text/event-stream                                                                                                                               |
| SSE events                                         | 141 (+ `[DONE]`)                                                                                                                                |
| Body bytes                                         | 33,787                                                                                                                                          |
| delta field names seen                             | `role`, `content`, `reasoning`, `tool_calls`                                                                                                    |
| **`delta.content` bytes**                          | **0**                                                                                                                                           |
| **`delta.reasoning` bytes**                        | **1,885**                                                                                                                                       |
| `delta.reasoning_content` / `delta.thinking` bytes | 0 / 0                                                                                                                                           |
| tool-call deltas                                   | 1 — tool name `qlt_proposal_draft`                                                                                                              |
| finish reason                                      | `tool_calls`                                                                                                                                    |
| usage in stream                                    | none (no usage chunk; `stream_options` not set)                                                                                                 |
| request UA                                         | `mastra/1.64.0 ai-sdk/openai-compatible/2.0.62 ai-sdk/provider-utils/4.0.40 runtime/node.js/22`                                                 |
| request path                                       | `/v1/chat/completions` (stream: true; `tool_choice: auto`; 1 tool; no temperature; no response_format; no reasoning/thinking field of any kind) |

### Boundary-by-boundary result of the SAME response

| Boundary                       | Observation                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| raw SSE                        | content **0 bytes**; reasoning **1,885 bytes** via `delta.reasoning`; 1 tool call; finish `tool_calls` — **NOT empty**                                                                                                                                          |
| ModelRouterLanguageModel parts | `reasoning-start`/`reasoning-delta` ×138/`reasoning-end` + `tool-input-*` + `tool-call` (name preserved) + finish `{unified: 'tool-calls', raw: 'tool_calls'}` — everything translated; nothing lost                                                            |
| Mastra Agent / VICT adapter    | `tool.requested` → `tool.started` → **`tool.failed`** (the governed bridge rejected the real-model draft — 0 durable invocations, 0 proposals; the Execution-3 contract-rejection class REPRODUCES with real model output) + `usage.updated`, `response.failed` |
| restored assistant result      | assistant message EXISTS with **0 text** (reasoning-only) → restored reply EMPTY                                                                                                                                                                                |
| first disappearance of a field | **`delta.content` never appeared at all** — the loss is at the GENERATION step: the model emitted no visible content, only reasoning and a tool call                                                                                                            |

Turn elapsed: ≈6.7 s — matching Execution-4's per-turn elapsed times
(6.4–7.8 s), corroborating the same behavioral class.

Truthful accounting of the request count: exactly ONE provider request was
sent and observed. The model loop attempted ONE further automatic request
(the post-tool step) which was REFUSED by the structural one-request cap
before any network byte left the process; it was not a retry and consumed no
provider capacity.

## 9. Root-cause classification and confidence

**Classification: B — reasoning consumed the available output budget** (for
the empty-reply class), with a secondary confirmed finding (tool-call
contract rejection). Confidence: **HIGH** for the pipeline conclusion and the
response-shape evidence; the exact per-turn finish reasons of Execution 4
itself remain unknowable (not captured), so the classification is the
evidence-consistent explanation, not a per-turn reconstruction.

- The request sends `max_tokens: 512` (the completion-token ceiling) and does
  NOT control reasoning in any way: no `reasoning_effort`, no `think`-class
  field, no reasoning provider option (reconciled with installed source AND
  the captured request: the field set is exactly `{model, max_tokens,
messages, tools, tool_choice, stream}`).
- The provider/model streams reasoning as `delta.reasoning` (NOT
  `reasoning_content`, NOT `thinking`), and the model spends the completion
  budget on it: the diagnostic response carried 0 content bytes with 1,885
  reasoning bytes and a tool call under the 512-token ceiling.
- Reasoning-only (or reasoning + tool call) streams with zero visible content
  map EXACTLY to the Execution-4 observable: turn `completed`, restored reply
  empty, 0 invocations, 0 proposals (Lane D D5/D6; the diagnostic turn).
- Every downstream layer is exonerated by the positive controls.

Secondary finding (separate class, real-model): when the model DOES reach a
tool call within its budget, the call translates correctly and crosses the
governed boundary — but the bridge rejected the real-model draft
(`tool.failed`; 0 durable invocations, 0 proposals). The exact rejection
reason was not captured (tool arguments were deliberately not recorded per
the addendum's privacy rules). This is the same signature class as Execution
3's contract-shape rejections and should be treated as a SEPARATE owner
decision item; it is NOT explained by the token budget.

## 10. Smallest recommended remediation (NOT implemented)

1. **Primary (empty replies): a bounded CONTRACT AMENDMENT** giving this path
   explicit reasoning control — the vendored provider already serializes
   `reasoning_effort` when the `openaiCompatible` provider option declares it
   (`reasoning_effort: compatibleOptions.reasoningEffort`), so the smallest
   change is an evidence-based amendment either (a) passing an explicit
   reasoning setting for this pinned model through the frozen generation
   envelope, or (b) raising the amended 512-token ceiling to an
   evidence-based value — ONE of the two, by amendment procedure (freeze
   §13). No code, no VICT release, no provider change is required for this
   class.
2. **Secondary (tool-call rejection):** a bounded diagnostic decision on the
   real-model tool-call arguments versus the frozen input contract
   (revision 3) — owner decision; no repair implemented here.
3. NOT required: VICT release; Mastra upgrade; provider-specific adapter;
   node_modules patch. The parser already supports the field the provider
   actually emits (`reasoning`).

## 11. Files/probes created (all disposable; all removed)

Under `%TEMP%/qlt-q6-emptyreply-probe/` (removed; verified absent):

- `lane-c-router-probe.mjs` — Lane C intercepted router probe (12 scenarios);
- `lane-d-endtoend-probe.mjs` — Lane D composition end-to-end matrix;
- `lane-d2-agent-probe.mjs`, `lane-d3-bisect-probe.mjs`,
  `lane-d5-instrumented.mjs` — intermediate bisect probes (superseded);
- `lane-d6-clean.mjs` — the final clean passive end-to-end probe (9 scenarios);
- `q6-diagnostic-request.mjs` — the ONE authorized diagnostic request;
- result JSONs and stderr logs for each probe;
- disposable store directories (`lane-d-stores`, `lane-d2-stores`,
  `lane-d3-stores`, `lane-d5-stores`, `lane-d6-stores`,
  `qlt-q6-diagnostic-store`) — all removed and absence verified.

Pre-existing OS-temp `qlt-q6-compose-*` / `qlt-q6-discretion-*` /
`qlt-q6-fixture-*` / `qlt-q6-fresh-*` / `qlt-q6-hostile-*` /
`qlt-q6-offline-restore-*` directories (earlier verification-gate runs,
mtimes 2026-09-21/22) were NOT created by this investigation and were left
untouched.

## 12. Commands and exits (truthful)

| Command                                                                   | Exit                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `git fetch` + tip/status verification (both repos)                        | 0                                                                                                               |
| Lane C probe (`node lane-c-router-probe.mjs`)                             | 0 (12/12 scenarios; 0 escapes)                                                                                  |
| Lane D probes (multiple iterations while localizing probe-side artifacts) | 0 (final clean run: 9/9 scenarios; 0 escapes)                                                                   |
| Diagnostic request (`node --import tsx q6-diagnostic-request.mjs`)        | 0 (exactly one provider request; structural cap refused the loop's automatic follow-up before any network byte) |
| Credential leak scan (diagnostic store, in-memory compare)                | 7 files, 0 credential occurrences                                                                               |

Two probe-side artifacts were found and corrected during the work and are
recorded for truthfulness: (a) an initial FIFO scenario queue desynced on
multi-request turns (fixed by key-based routing); (b) an eager router tee
perturbed stream consumption and was replaced with pass-through/pull-based
observation; the final clean run used NO stream tees.

## 13. Preservation and cleanup

- `.quellight-data`: never read; mtime unchanged (`2026-09-20 03:43:59 +0800`).
- VICT: read-only; `HEAD == origin/main == fd0c1f7…`; only its pre-existing
  untracked `.pi/` present, never read.
- The private naturalistic fixture: never accessed (no fixture materialized
  or read in this investigation).
- Credential: read once, in memory only; never printed, hashed, serialized,
  copied into the repository, or placed in command arguments; byte-level scan
  of the diagnostic's disposable store: absent; the store was deleted and its
  absence verified.
- The diagnostic's in-memory observations contain structural metadata only
  (counts, field names, byte counts, statuses); no response text, reasoning
  text, tool arguments, prompt text, headers with values, or payload bodies
  were recorded or persisted.
- All probe scripts, logs, stores, and fixtures removed; verified absent.
- No child process or listener remains.

## 14. Exact next owner decision

Choose ONE primary amendment path for the empty-reply class:

1. **Explicit reasoning control on the frozen request path** (smallest code
   change; a freeze amendment making the pinned profile's generation envelope
   carry an explicit reasoning setting for this model), or
2. **An evidence-based token-ceiling amendment** (keep reasoning uncontrolled;
   raise the per-turn output ceiling to a value with measured headroom), and
   SEPARATELY decide how to handle the secondary real-model tool-call
   contract-rejection class (Execution-3 signature reproducing with real
   model output).

Neither is implemented here. Q6 remains not formally closed and not
independently verified. Q7 remains BLOCKED — NOT BEGUN.
