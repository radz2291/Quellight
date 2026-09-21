# Quellight Stage 07C — Phase Q6 Live Ceremony Proof FAILURE Record

**Status:** TWO owner-authorized bounded live-provider ceremony proof
executions (N-C24, `npm run verify:q6:live`) were performed on
2026-09-21, and **BOTH FAILED TRUTHFULLY**. Execution 1 failed at its
first provider turn with an HTTP 401 (authentication failure) class —
root-caused afterward to an unresolved credential-environment reference
in the operator's agent configuration, NOT an invalid credential and
NOT a harness or contract defect. Execution 2, run under a fresh owner
authorization with the corrected, verified-working credential, had its
first provider turn COMPLETE successfully (5,925 ms, within all bounds)
but the model did NOT exercise the single draft capability — zero
durable invocation records and zero proposals — so the harness failed
truthfully at the t1 boundary (the frozen "missing proposal" failure
class). Neither run was retried. **The authoritative live-provider
execution count is now exactly TWO (one per owner authorization), both
FAILED. Any further live execution requires a new dated owner
decision.** Q6 remains `IMPLEMENTED — AWAITING INDEPENDENT Q7
VERIFICATION` with the live proof FAILED; the offline Q6 evidence is
unchanged and green. **Phase Q7 remains BLOCKED — NOT BEGUN.** Stage 07
remains In Progress.
**Dates of execution:** 2026-09-21 (local +08:00).
**Governing contract (frozen, unchanged, zero amendments):**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md`.

This record contains SAFE METADATA ONLY: no conversation content, no
provider payload, no response header, no credential value, fragment,
length, hash, prefix, or suffix.

## 1. Execution identity

| Item                                              | Execution 1 (401)                                             | Execution 2 (missing proposal)                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Execution tree SHA (`HEAD == origin/main`, clean) | `8d1273bf51b1bfd2921cd51d0e9bdf1135ad9556`                    | `a32bba5468c2f7fe8d1b805deef8803d2fcd0cad` (docs-only commit above `8d1273b`; zero executable change) |
| Harness/helper bytes                              | byte-identical to the pushed safety-hardened tree             | unchanged (identical to Execution 1)                                                                  |
| VICT                                              | read-only at `153384877ae90b79c990636eba28fde2e50ae7d5`       | same; never touched                                                                                   |
| Command                                           | `npm run verify:q6:live`, gate set for the proof process only | identical                                                                                             |
| Date (local +08:00)                               | 2026-09-21                                                    | 2026-09-21 (later the same day)                                                                       |
| True process exit code                            | **1** (captured directly; no masking)                         | **1** (captured directly; no masking)                                                                 |
| Total process elapsed                             | ~10.6 s                                                       | ~12.6 s                                                                                               |
| Authorization                                     | the original phase authorization                              | a fresh dated owner decision, issued after the Execution-1 root-cause diagnosis                       |

## 2. Execution 1 — HTTP 401 (root cause: credential-environment wiring)

Preflight passed fully before the run (both repositories fetched and
verified at the exact anchors; clean trees; no stale processes; proof
ports free; no task temp directories; exact `@victframework/*@0.3.0`
package and lockfile; gate not persistently set; operator
`.quellight-data` untouched; no source modification). The provider call
failed with an HTTP 401 (authentication failure) response class at the
frozen endpoint; t1 settled `failed` (`VICT_AGENT_TURN_FAILED`) in
1,020 ms; 1 of 6 provider turns used; zero retries; no fallback.

**Read-only root-cause diagnosis (performed afterward; no provider
ceremony invocation):** the operator's agent-configuration file held
the literal string `"$OLLAMA_API_KEY"` (an environment-variable
REFERENCE) as the ollama provider's API key. The launcher passed that
literal string into the proof environment, so the request carried a
meaningless bearer value — hence the 401. The operator's REAL working
Ollama Cloud key lives in their agent's own credential store, which the
agent resolves internally (this is why the model works inside their
agent but the standalone proof could not see it). A presence-verified
direct probe with the real key (models list, then a minimal chat
completion with the frozen model) returned HTTP 200 twice — the
credential, endpoint, and model all work. The frozen contract, harness,
bounds, and provider identity were correct throughout; Execution 1 was
an operator-environment wiring failure.

## 3. Execution 2 — provider turn SUCCEEDED; the model drafted no proposal

Fresh owner authorization (2026-09-21) directed use of the verified
working credential from the agent's credential store. Preflight
re-verified: `HEAD == origin/main == a32bba5…`, clean tree, ports free,
no task temp directories, gate not persistently set. The launcher
verified the credential's presence (value never printed), placed it in
the proof process environment in memory only, and cleared both
environment variables after termination.

Outcome, from the proof output (metadata only):

- gate passed; composition built in **LIVE mode: Ollama Cloud /
  glm-5.3-flash** (`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`);
  bounds printed exactly as frozen (≤6 turns, ≤256 output tokens/turn,
  ≤120,000 ms deadline/turn, zero retries, no fallback);
- **t1: status=completed in 5,925 ms** — the provider turn itself
  SUCCEEDED (the credential, endpoint, and model responded within every
  bound);
- **FAIL: no durable invocation record exists for the turn** — the
  model did not exercise the single draft capability
  (`qlt.proposal.draft@2/write`);
- **FAIL: zero proposals exist (exactly one expected)** — the harness
  failed truthfully at the t1 boundary (the frozen "missing proposal"
  failure class); the proof crashed forward intentionally;
- the same-key t1 retry replayed the idempotent receipt with no second
  provider turn;
- **provider turns used: 1 of 6; zero retries; no fallback**; t2/t3
  never reached; no confirmation ever occurred; no model response
  exercised user authority;
- both byte-level credential leak scans completed and found ZERO
  occurrences; credential discipline held end to end (in-memory
  handoff; value never printed, hashed, serialized, or persisted);
- true process exit **1**; total elapsed ~12.6 s.

**Interpretation (observation, not gate):** the frozen contract makes
the capability invocation STRUCTURAL (a real drafted proposal is the
principal success path) while acknowledging that model wording is
nondeterministic (freeze §15). In this run the model returned a
completed conversational response without invoking the capability.
Whether token/output limits (e.g., the 256-token per-turn cap interacting
with this model's reasoning behavior) or provider-side tool-calling
reliability contributed is an open observation; diagnosing or changing
any of these (bounds, model, prompts) requires the freeze amendment
procedure — an owner decision, not an improvised fix.

## 4. Durable-effect, authority, credential, and cleanup conclusions (both runs)

- **Durable effects:** ZERO durable Shared World state was created in
  either run — no proposal, no canonical record, no confirmation, no
  lineage; no unauthorized durable effect of any kind.
- **Authority:** no model response ever exercised user authority; no
  confirmation occurred (the ceremony was never reached).
- **Credential protection:** presence-only discipline held across both
  runs and the diagnosis; every byte-level leak scan completed (three
  scans total across the runs) and found ZERO occurrences; no
  credential material appeared in any output.
- **Isolation:** every composition ran against the ONE task-owned
  disposable OS-temp root (identity-asserted before any provider turn);
  the operator `.quellight-data` directory was never accessed (file
  mtime unchanged across the entire effort; metadata-only observation).
- **Cleanup (recurring environmental finding):** in BOTH runs the
  harness's fail-closed `dispose()` could not remove the owned OS-temp
  root under Windows (reported as a proof failure, never silently
  swallowed). Safe manual cleanup afterward removed exactly that one
  task-owned `qlt-q6-live-*` OS-temp directory each time (verified) and
  the temporary launchers. NO `qlt-*` directory, process, listener, or
  task file remains; proof ports are free; the repository tree is
  byte-clean (no source, test, script, package, lockfile, schema, or
  contract change at any point).

## 5. Read-only diagnosis summary

- Execution 1: operator-environment credential wiring (an unresolved
  `$VAR` reference sent as a bearer value). The credential itself is
  VALID (verified 200/200 directly). No harness or contract defect.
- Execution 2: the provider turn succeeded; the model did not invoke
  the single draft capability, producing the frozen missing-proposal
  failure. This is model-behavior-dependent and possibly sensitive to
  the frozen per-turn output-token cap / reasoning behavior of the
  chosen model via this provider. The harness behaved exactly as
  specified and failed closed, truthfully, with no retries.
- No harness modification is authorized or has occurred. Under freeze
  §3, failed runs are NEVER silently re-run; any further live execution
  — and any change to bounds, model, prompts, or provider — requires a
  fresh dated owner decision (and, where the frozen contract is
  affected, the §13 amendment procedure).

## 6. Status and next-step ownership

- Q6: `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION` — live proof
  EXECUTED TWICE (each under its own owner authorization), BOTH FAILED;
  not independently verified; not formally closed.
- **Phase Q7 remains BLOCKED — NOT BEGUN.**
- **Stage 07 remains In Progress.**
- Decision now rests with the owner. Possible (owner-decision-only)
  directions include: amending the frozen bounds/model identity via the
  §13 amendment procedure to improve capability-invocation reliability,
  authorizing another live execution as-is, or accepting the current
  evidence state and deferring. No silent rerun exists.
