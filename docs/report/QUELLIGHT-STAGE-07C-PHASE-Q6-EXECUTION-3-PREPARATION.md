# Quellight Stage 07C — Phase Q6 Execution 3 Preparation Record

**Status:** the bounded-memory-discretion amendment (D-Q6-6) is
implemented and fully verified OFFLINE. The live harness now prepares a
five-turn discretionary matrix with a parent/worker lifecycle and an
external, privacy-preserving natural fixture. **Execution 3 is PREPARED
— NOT EXECUTED.** It remains unconsumed and requires a separate,
explicit owner invocation after this preparation is reviewed. The
authoritative live-provider execution count remains TWO (both failed,
each under its own owner authorization; see
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`).
Q6 remains `IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION`;
**Phase Q7 remains BLOCKED — NOT BEGUN.** Stage 07 remains In Progress.
**Date:** 2026-09-21.
**Governing amendment:**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-BOUNDED-DISCRETION-AMENDMENT.md`
(commit `365259f…`, committed alone before any executable change).

## 1. SHAs

| Event                                                                    | SHA                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Starting tree (verified `HEAD == origin/main`)                           | `68be8815709b27fc263286e731f4f6f282e95881`                    |
| Amendment — `docs(stage-07c): amend Q6 for bounded memory discretion`    | `365259f…` (committed alone)                                  |
| Implementation — `feat(stage-07c): define bounded memory discretion`     | `d11d9e9…`                                                    |
| Implementation — `fix(stage-07c): isolate Q6 live worker lifecycle`      | `6844bfe…`                                                    |
| Implementation — `test(stage-07c): verify discretionary memory behavior` | `67d5223…` (the authoritative ladder ran on THIS tree, clean) |
| Documentation                                                            | this commit                                                   |

VICT remained read-only at `153384877ae90b79c990636eba28fde2e50ae7d5`
(`HEAD == origin/main` verified by fresh fetch; its pre-existing
untracked `.pi/` material was never read, opened, or modified). No
reset, rebase, force-push, or history rewrite anywhere.

## 2. Lanes (executed SEQUENTIALLY — no isolated parallel workers were available)

The parallel workflow was authorized only for isolated workers; the
coordinator executed all four lanes sequentially on one tree, with
disjoint per-commit file ownership and no coordinator abstraction:

- **Lane A** (`d11d9e9…`): the frozen declarative contract data
  (`src/lib/sharedworld/q6-contract.ts` — 512-token amended ceiling,
  amendment identity, fixture boundary data, five-turn matrix
  statements, commitment anchors, natural-flow/ advice/ signal/
  hardship vocabularies); the conversation instructions artifact
  revision **3 → 4** expressing D-Q6-6 and the agent profile revision
  **4 → 5** binding it (`src/lib/server/composition.ts`); the offline
  fixture reply's profile string made truthful
  (`src/lib/server/runtime.ts`); the `verify:q6` contract/envelope
  literals updated to the amended truth.
- **Lane B** (`6844bfe…`): the parent/worker live harness —
  `scripts/verify-q6-live.mjs` became the parent shell;
  `scripts/lib/q6-live-parent.mjs` (gate, workspace allocation, fixture
  validation, worker spawn, post-exit result/fixture-scan/dispose
  orchestration with test seams); `scripts/lib/q6-live-worker.mjs`
  (every composition, provider turn, restart, ceremony, result record);
  `scripts/lib/q6-live-workspace.mjs` gained
  `adoptQ6LiveWorkspace` (deletion-free worker adoption);
  `scripts/lib/q6-fixture-boundary.mjs` (external fixture validation);
  `scripts/lib/q6-acceptance.mjs` (deterministic semantic predicates);
  the S-1/S-2 structural checks updated to the multi-file layout.
- **Lane C** (`67d5223…`): three new permanent suites (below), the
  fixes they drove, and the `verify:q6` behavioral guard extended to
  all five focused suites.
- **Lane D** (this commit): integration review, the authoritative
  ladder, and this record plus the current status surfaces.

## 3. The amended conversation behavior (D-Q6-6, owner-approved)

Instruction artifact `quellight.conversation-instructions` revision **4**
replaces the one-sided "use it sparingly" guidance with rule-guided
discretion: (1) explicit remember requests draft one proposal; (2)
implicit durable meaning (preference, commitment, ongoing goal,
identity-relevant fact, unresolved issue likely to matter later) is
drafted even unasked; (3) transient logistics, one-off incidents,
software trouble, momentary feelings, speculative interpretations, and
ordinary detail are NEVER drafted; (4) mixed messages yield only the
durable core; (5) uncertainty stays uncertain — hardship never becomes
a factual signal about leaving; (6) at most two proposals per turn, one
per durable item; (7) drafting is quiet and epistemically inert — the
reply never claims a save and never exposes machinery; (8) only the
user's governed confirmation creates canonical meaning.

Profile `agent.quellight.conversation` revision **5** binds the
revision-4 instructions. UNCHANGED: the pinned provider/model
(`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`), the
capability `qlt.proposal.draft@2/write`, the one-entry
`qlt.host-policy.quiet-write@1` policy, the memory-policy artifact, the
21-action inventory, `maxToolCalls: 2`, `maxRetries: 0`. ADDED: nothing
— no capability, query, mutation, schema, migration, or autonomous
behavior.

## 4. The prepared five-turn live matrix (Execution 3's frozen plan)

Exactly five provider turns within the six-turn ceiling; ≤512 output
tokens/turn (amended from 256); ≤120 s deadline/turn; zero retries; one
provider, one model, no fallback; exactly one authoritative execution
per owner invocation:

1. **Turn 1 — explicit positive control**: the fixed remember request;
   expects exactly one pending `claim`, zero canonical records, natural
   reply.
2. **Turn 2 — naturalistic discretionary positive**: the operator's
   EXTERNAL personal fixture verbatim; expects exactly one `commitment`
   preserving all four anchors (`not leave`, `current job`,
   `clear pathway`, `established base`) as the USER'S commitment (never
   advice, never a hardship "signal"); at most one optional `open_loop`
   for the fast-track-versus-gradual decision; no other kinds; ≤2
   proposals and ≤2 invocations; zero canonical records. Acceptance
   FAILS on: no commitment; hardship-only content; hardship-as-factual-
   signal; invented financial/family/health/spiritual/employer/deadline
   facts; automatic canonicalization; >2 proposals.
3. **Turn 3 — discretionary negative control**: the fixed installer
   statement; expects ZERO invocations, ZERO proposals, ZERO canonical
   effects — proving discretion is not "always draft".
4. **User ceremony (no provider turn)**: confirm ONLY the Turn-2
   commitment through the REAL released `app.data.mutate` boundary;
   same-key replay duplicates nothing; stale `expectedVersion` is
   refused (`QLT_VERSION_CONFLICT`, zero effect); exactly one canonical
   commitment; the agent exercised no confirmation authority. Then the
   composition closes and recomposes against the SAME verified root.
5. **Turns 4–5**: a genuinely fresh conversation receives the confirmed
   commitment through its per-turn C1 snapshot (pending proposals are
   NOT injected; zero context-block bytes in the durable transcript);
   then a hypothetical-conflict turn leaves the standing commitment
   byte-identical and version-identical with ZERO invocations.

Natural-flow rules apply to every turn: non-empty completed replies;
no "I saved/remembered/memory updated" claims; no tool, capability,
schema, or Shared World jargon; no generic approval ceremony; no tray,
modal, focus theft, or conversational blocking. No exact response
wording is ever asserted (freeze §15 discipline).

## 5. Privacy-preserving external fixture (amendment §7)

The owner's personal natural message is NEVER committed, embedded,
printed, or reported. The live harness reads it at run time from the
operator-designated file named by `QUELLIGHT_Q6_NATURAL_FIXTURE_FILE`:
an absolute path to a regular UTF-8 file OUTSIDE the repository and
outside `.quellight-data`, ≤ 12,288 UTF-8 bytes, no NUL bytes. The
boundary (`scripts/lib/q6-fixture-boundary.mjs`) fails closed with
NON-ECHOING stable codes (the path and the content never appear in any
message), treats the file as read-only input (the parent re-verifies
its byte identity after the worker exits — a changed or vanished
fixture fails the proof), and exposes only the byte length and SHA-256
fixture identity as evidence. The disposable live transcript may hold
the user turn and is removed with the owned workspace. Offline tests
use a SYNTHETIC, NON-PERSONAL fixture with the same semantic structure.

## 6. Parent/worker lifecycle correction (amendment §6)

Both prior live runs failed Windows cleanup because the composition-
owning process also removed its own SQLite workspace. The harness is
now split: the PARENT (the npm-invoked process) gates, allocates the
ONE verified disposable root, validates the fixture, and spawns the
CHILD WORKER, which runs every composition, provider turn, restart, and
ceremony operation, writes a machine-readable result record into the
owned root, and EXITS. ONLY after the worker exits does the parent read
the result, re-verify the fixture identity, run the byte-level
credential scan (S-2: an incomplete scan is never credential-clean),
and dispose the owned root (cleanup failure remains proof failure).
Only the verified owned root is ever deleted; the external fixture
file is never deleted; every S-1/S-2 ownership and fail-closed
protection is preserved (no `rmSync` anywhere in the live proof; the
worker's adopted API carries NO deletion capability; identity failures
remain stable and non-echoing; the pre-composition resolved-environment
identity assertion is unchanged). The focused suites model success and
every failure mode — worker crash, missing result, planted credential
canary, cleanup lock, fixture mutation — and prove no task directory,
handle, listener, or child process survives.

## 7. Permanent deterministic coverage (offline; fake models)

- `test/q6-discretion-policy.test.ts` — **16 tests**: amended
  instruction/profile identities observable on the activation;
  explicit-positive routing; discretionary-positive routing with the
  synthetic mixed fixture; transient-negative abstention; anchor
  matching with grammatical normalization; advice-authored rejection;
  hardship-signal rejection; hardship-only rejection; open-loop theme
  rules; the two-proposal/two-invocation budget; natural-flow
  non-claim and jargon rules; and the full governed ceremony (replay,
  stale refusal, fresh-thread C1 selection, conflict non-mutation) over
  the REAL composition and REAL boundaries.
- `test/q6-fixture-boundary.test.ts` — **12 tests**: acceptance and
  safe evidence identity; read-only treatment; relative/inside-repo/
  `.quellight-data`/missing/directory/oversized/NUL/invalid-UTF-8
  refusals — every failure non-echoing (a planted content canary never
  appears in any message); post-run identity re-verification.
- `test/q6-live-parent-worker.test.ts` — **10 tests**: worker-exits-
  first ordering (scan and removal strictly after); success exits 0 and
  removes the root; worker crash, missing result, planted credential
  canary, cleanup lock, and fixture mutation each fail the proof while
  the root is still removed or the refusal disposes it; gate refusals
  allocate nothing; the adopted worker API carries no `dispose`.
- The existing lifecycle (11) and safety (10) suites remain green with
  their assertions updated to the parent/worker layout at equal or
  greater strength (no `rmSync` in ANY live-proof file; every parent
  removal through the owned dispose; the worker deletion-free).
- `verify:q6` grew to **107 checks** (was 100): the amended bounds,
  amendment identity, fixture boundary data, matrix statements/anchors,
  revision-4/5 identity pins, the D-Q6-6 instruction block, and the
  parent/worker ordering/ownership structure — every prior check
  preserved. `verify:stage7c` composes it unchanged (N-C24 still never
  runs inside any automatic gate).

These offline suites prove the PREDICATES and the wiring. They do NOT
prove real-model discretion; only Execution 3 provides that evidence.

## 8. Authoritative offline verification (exact commands and exits; tree `67d5223…`, clean, committed)

```text
===== STEP: npm ci =====                    EXIT=0
===== STEP: npm run verify:consumer =====   EXIT=0
===== STEP: npm run verify:quellight =====  EXIT=0 (test:node, test:ui,
        production build, three real-browser checks, artifact scan — green)
===== STEP: npm run verify:stage7c =====    EXIT=0 (release identity stable)
===== STEP: npm audit --omit=dev =====      EXIT=0 (found 0 vulnerabilities)
===== STEP: git diff --check =====          EXIT=0
```

## 9. What Execution 3 requires (owner invocation; NOT performed in this task)

After reviewing this preparation, the owner performs the ONE live
execution in their own operator environment:

```text
QUELLIGHT_LIVE_PROOF=1
OLLAMA_API_KEY=<the operator's real credential, in the environment>
QUELLIGHT_Q6_NATURAL_FIXTURE_FILE=<absolute path to the operator's
  external UTF-8 fixture file, outside the repository>
npm run verify:q6:live        # EXACTLY ONCE; never rerun silently
```

The gate refuses (exit 2) unless all three conditions hold. Any
failure is truthful and final for that authorization; a fresh owner
decision is required for any further run.

## 10. Preservation

The frozen Phase Q6 contract document, the original implementation
report, and BOTH failure records are byte-unchanged. The Stage 07B
live verifier and all Q2–Q5 evidence remain untouched. No product
behavior other than the conversation instructions changed; no new
capability, action, schema, migration, or authority exists; the action
inventory stays 21; VICT stayed read-only; the operator
`.quellight-data` directory was never accessed; no credential was
read, printed, hashed, serialized, or persisted at any point in this
preparation; and NO live provider call occurred.
