# Quellight Stage 07C — Phase Q6 Live Proof Execution 3 Record

**Status: EXECUTED ONCE — FAILED (truthful terminal result; NOT rerun).**
Execution 3 — the single owner-authorized live-provider run of the
prepared bounded-discretion harness — was invoked exactly once on
2026-09-21 and ended with **true process exit 1**. The provider turn
t1 completed within every frozen bound, but zero durable capability
invocations and zero proposals resulted (the model's capability
attempts were each rejected by the host tool-input validator at the
frozen proposal-row contract boundary), and the live matrix then
crashed at the fresh-thread boundary on a worker API defect
(`sharedWorld.restoreThread` does not exist on the worker's shared
world binding). One finding was recorded by the harness. This record
contains safe metadata only: **no response text, no prompt or fixture
text, no credential or header material, and no provider payload entered
this report.** **Phase Q7 remains BLOCKED — NOT BEGUN. No fourth live
execution is authorized.** Q6 remains not independently verified and
not formally closed. Stage 07 remains In Progress.

## 1. Execution identity

| Item                 | Value                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact execution tree | `e0f2797aaa748b576e907ca7e94bb37776e093de` (verified `HEAD == origin/main`, clean, linear; the only delta since the prepared executable tree `67d5223…` was four Markdown documents) |
| True process exit    | **1** (captured directly from the launcher process; no pipeline masking)                                                                                                             |
| Date / elapsed       | 2026-09-21; launch 14:15:19Z → exit 14:16:24Z ≈ 65 s wall clock                                                                                                                      |
| Harness entry        | `npm run verify:q6:live` (parent/worker lifecycle, prepared tree)                                                                                                                    |
| Invocations          | EXACTLY ONE; zero retries, zero reruns, zero preliminary provider probes, zero post-failure corrections                                                                              |

## 2. Provider / model identity

`ollama-cloud / glm-5.3-flash` at `https://ollama.com/v1` — the single
frozen provider and model. No fallback, no substitution, zero retries.
Credential source: the owner-designated operator credential file,
resolved in memory and exposed to the live process only as
`OLLAMA_API_KEY`; presence-verified beforehand; never printed, hashed,
serialized, copied, or persisted; process-scoped environment value
cleared when the live process exited.

## 3. Provider turns

| Turn  | Plan role                                                   | Status            | Elapsed   | Invocations | Proposals |
| ----- | ----------------------------------------------------------- | ----------------- | --------- | ----------- | --------- |
| t1    | explicit positive control                                   | completed         | 18,567 ms | 0           | 0         |
| t2–t5 | (discretionary positive / negative / continuity / conflict) | **never reached** | —         | —           | —         |

Turn usage: **1 of 6** (planned five). Zero retries, no fallback, all
frozen bounds respected on the completed turn.

The t1 reply completed, and the model visibly attempted the draft
capability several times, but every attempt was rejected by the host
tool-input validator (`vict-contract-rejected` class): an empty-args
attempt followed by single-field attempts that did not match the frozen
proposal-row contract shape. Zero invocations were durably recorded;
zero proposals existed; no canonical record was created; the pending
claim expected by the t1 acceptance rule never materialized.

## 4. Structural acceptance results

| Control                                        | Result                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| t1 exactly-one-pending-claim                   | **NOT MET** (0 proposals)                                                                                                                                                          |
| t2 discretionary positive (external fixture)   | **NOT REACHED**                                                                                                                                                                    |
| t3 transient negative                          | **NOT REACHED**                                                                                                                                                                    |
| governed confirmation + replay + stale version | **NOT REACHED**                                                                                                                                                                    |
| restart / fresh-thread C1 continuity           | **CRASHED HERE** — the worker's restart step called `sharedWorld.restoreThread`, which is not a function on the worker's shared-world binding; the matrix aborted with one finding |
| hypothetical-conflict non-mutation             | **NOT REACHED**                                                                                                                                                                    |

## 5. Fixture privacy handling

External task-owned fixture: **3,137 bytes, SHA-256
`9cc76c36e73781c1e015e3e0cb0d62e7dcd7e79a4dc409a2c0e1c5d4563170da`**
(UTF-8, no NUL, located in the OS temporary directory outside both
repositories and outside `.quellight-data`; path passed only through
`QUELLIGHT_Q6_NATURAL_FIXTURE_FILE`). The harness validated the
boundary before allocation, treated the file as read-only input, and
re-verified after the worker exited: **the fixture survived the proof
byte-identical**. Its text was never echoed by the harness, never
committed, and never entered any repository file (verified by tree
inspection). The task-owned fixture file was deleted after evidence
handling and its absence verified.

## 6. Credential leak scans and cleanup

- Credential scan: **complete — credential absent.** Every persisted
  byte of the owned workspace was scanned after the worker exited; the
  scan did not fail incomplete. A second, independent repository-side
  check confirmed no credential or fixture material entered any
  tracked file.
- Lifecycle ordering held exactly as prepared: workspace-allocated →
  fixture-validated → worker-exited(0 is the worker process's own exit
  semantics for a recorded failure result) → result-read →
  fixture-reverified → credential-scanned → workspace-disposed.
- Workspace cleanup: **the owned disposable workspace was removed after
  the worker exited (verified)** — the parent/worker lifecycle
  correction eliminated the Windows dispose failure seen in
  Executions 1 and 2. No `qlt-q6-live-*` directory remains anywhere.
- Operator `.quellight-data`: **never accessed** (mtime unchanged
  throughout: `2026-09-20 03:43:59 +0800`).
- VICT: untouched (`HEAD == origin/main == 1533848…`; only its
  pre-existing untracked `.pi/` remains, never read).
- Launcher and gate/fixture environment variables: process-scoped;
  gone with the launcher process; nothing token-bearing was ever
  written to disk.

## 7. Interpretation bounds

Two distinct defects are evident at the structural level, both inside
the already-frozen contract/harness rather than the amendment policy:

1. The live model, given the revision-4 instructions, attempted to
   draft but could not produce argument objects satisfying the frozen
   proposal-row tool contract (its attempts were empty or single-field
   shapes). Zero durable effect resulted; the quiet-write policy
   correctly prevented any partial effect.
2. The prepared worker referenced a shared-world API member
   (`restoreThread`) that the runtime binding does not expose — a
   harness defect that aborted the matrix before the restart,
   continuity, and conflict controls could run.

Per the governing authorization, **no correction was implemented and no
diagnostic provider call was made in this task.** Both observations are
recorded as owner-decision input only. **Q7 remains BLOCKED — NOT
BEGUN; no fourth live execution is authorized.**
