# Quellight Stage 07C — Phase Q6 Execution-3 Remediation Contract (FROZEN)

**Status:** Frozen remediation contract — committed ALONE before any
executable change (L0 freeze discipline; freeze §13 amendment procedure
applied to the Phase Q6 contract as superseded by the bounded-discretion
amendment).
**Frozen:** 2026-09-22, at Quellight base
`1fa178bb5564534cdaa2a58037b74c2dfec9d500` (`HEAD == origin/main`, clean
tracked tree, linear ancestry) and VICT base
`153384877ae90b79c990636eba28fde2e50ae7d5` (`HEAD == origin/main`).
**Governing evidence:** the Phase Q6 contract freeze, the
bounded-discretion amendment (D-Q6-6), the Execution-1/2 failure record,
the Execution-3 record, and the Execution-3 preparation record — all
preserved byte-unchanged. The VICT-side counterpart contract is
`260831-VCT-02/docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`.

Amendment rule: if a frozen semantic rule below must change, the affected
lane stops, the defect is documented, the contract is amended in its own
separate commit, and the affected work restarts from the amendment.

---

## 1. The corrected Execution-3 event location (ADDITIVE; no historical rewrite)

The Execution-3 record (§3/§4) states that the live matrix crashed at the
restart/fresh-thread boundary. That location statement was WRONG, and
this section is the authoritative, ADDITIVE correction: the historical
record is preserved byte-unchanged and is hereby superseded ONLY on this
one point.

Corrected chronology (derived from the prepared worker source, tree
`e0f2797aaa748b576e907ca7e94bb37776e093de`): the worker's
`runMatrixTurn` requests the thread reply IMMEDIATELY after Turn 1
settles (`replyOf(sharedWorld, threadId)` →
`sharedWorld.restoreThread(threadId)`). `restoreThread` belongs to the
FULL Quellight composition, not to its Shared World store
(`composition.restoreThread` exists; `sharedWorld.restoreThread` does
not). Execution 3 therefore crashed during the TURN-1 REPLY RETRIEVAL —
before Turn 2, before the ceremony, and long before the restart /
fresh-thread boundary the report named. The provider turn t1 itself had
already completed; the crash aborted the matrix at the first reply
retrieval with exactly the one recorded finding.

Two independent Execution-3 defects are therefore in scope:

- **B-1 (framework presentation; remediated in VICT):** the model never
  received the proposal tool's input structure (generic
  `{ "type": "object" }` schema; generic description), so its attempts
  were empty or single-field and every attempt was truthfully rejected by
  the authoritative contract fence. Zero durable effect.
- **H-1' (this remediation; the wrong transcript-restore receiver):** the
  worker called `restoreThread` on the Shared World store instead of the
  full composition.

Additional harness defects confirmed by audit and remediated here:

- **M-1 (unawaited asynchronous evidence checks):** the worker called the
  asynchronous durable-invocation checker for proposal-bearing turns
  WITHOUT awaiting it (`checkInvocationTruth(composition, t1.turnId,
't1')` and the t2 call) — evidence checks could race or escape result
  accounting entirely.
- **M-2 (unsafe crash-message derivation):** the worker derived a finding
  from a bounded slice of arbitrary `error.message`
  (`String(error…).slice(0, 300)`), so raw provider, fixture, path,
  proposal, response, or credential-derived error text could enter the
  proof evidence.

## 2. Transcript-restore repair (frozen)

Reply retrieval accepts the FULL composition and calls
`composition.restoreThread(threadId)`. `restoreThread` is NEVER called
on `composition.sharedWorld`. The SAME correct boundary is used before
and after the restart (both composition instances expose the identical
interface). The five-turn matrix, the natural-flow acceptance predicates,
and every acceptance rule of the frozen Q6 contract (as amended) are
PRESERVED UNCHANGED and are never weakened.

## 3. Awaited evidence rules (frozen)

- EVERY asynchronous evidence function in the live worker is `await`ed.
  The durable-invocation-truth checks on proposal-bearing turns are part
  of the governed evidence chain: awaited, failure-recorded, and settled
  BEFORE result serialization.
- A failing or rejecting evidence check produces the stable code
  `QLT_Q6_EVIDENCE_CHECK_FAILED` as a finding; it can never vanish
  through a floating promise, and it can never crash the worker past the
  result record.
- A STRUCTURAL GATE (part of the permanent offline verification) fails on
  any known floating call of an evidence function in the live worker
  source, and BEHAVIORAL TESTS prove that an asynchronous evidence
  failure enters the final findings before result serialization.

## 4. Stable, non-echoing failures (frozen)

The worker derives findings from a CLOSED vocabulary of stable codes
only. Raw provider, fixture, path, proposal, response, or
credential-derived error text NEVER enters findings, notes, result
records, or any evidence surface. The closed codes added:

```text
QLT_Q6_LIVE_MATRIX_FAILED      — the live matrix crashed (stable code only)
QLT_Q6_REPLY_RESTORE_FAILED    — reply/transcript restore failed
QLT_Q6_EVIDENCE_CHECK_FAILED   — an awaited evidence check failed
```

Arbitrary error-message slicing is REMOVED. Existing non-echoing
disciplines (fixture boundary, workspace identity, gate refusals) are
preserved unchanged.

## 5. New released VICT dependency requirement (frozen)

Quellight adopts the VICT model-facing capability presentation API
(`descriptiveJsonSchema` on the neutral contract declaration; bounded
`description` on the capability definition) and, after the candidate is
published through the trusted-OIDC workflow, EXACT-PINS every applicable
`@victframework/*` dependency to **`0.3.1-rc.1`** (release-set identity
`vict-release-set@1/0.3.1-rc.1`, candidate dist-tag `vict-0.3.1-rc`;
`latest` remains `0.3.0`). The lockfile is regenerated SOLELY through the
public registry; no dependency may resolve from a workspace, file path,
link, cache substitution, or Git checkout. The Quellight-side release-set
identity constants are updated through the EXISTING central release-set
source (`scripts/lib/release-set.mjs`) — no scattered hardcoded version
literals. All product behavior outside the proposal presentation and the
Q6 harness repairs is preserved.

## 6. Capability and profile revisions (frozen)

Because the bound contract/model-facing behavior changes:

- proposal capability `qlt.proposal.draft`: revision **2 → 3**; declared
  effect REMAINS `write`; the input/output contract identities and their
  authoritative `Contract.parse` semantics remain unchanged-or-stricter;
- the EXACT host quiet-write policy entry (`qlt.host-policy.quiet-write@1`,
  exactly one entry) references the capability at revision **3**;
- agent profile `agent.quellight.conversation`: revision **5 → 6**;
- conversation instructions artifact: REMAINS revision **4** (the
  D-Q6-6 rule-guided discretion policy is unchanged);
- the authority envelope keeps EXACTLY ONE model capability and
  `maxToolCalls: 2`;
- ADDED: no authority, no read surface, no confirmation power, no
  action, no migration, no provider change, no bound change.

The model-facing presentation added to the capability (per the VICT
candidate):

- a bounded description stating that the tool drafts an INERT proposal
  for user review, NEVER confirms or saves canonical memory, accepts
  ONLY `claim`, `commitment`, or `open_loop`, and must receive the
  correct content shape for the selected kind;
- an EXACT closed input schema:
  - `proposalKind: 'claim'` → `content`: `subject`, `epistemicType`,
    `honestyState`, `confidence`, `statement` (all required; unknown
    fields refused);
  - `proposalKind: 'commitment'` → `content`: `commitmentKey`,
    `statement` (all required; unknown fields refused);
  - `proposalKind: 'open_loop'` → `content`: `subject`, `loopKind`,
    `detail` (all required; unknown fields refused);
- a passive output-schema representation of the closed accepted/refused
  union ("where applicable");
- authoritative `Contract.parse` remains unchanged or stricter than the
  presentation.

## 7. Full offline worker-path proof (frozen)

The real worker orchestration must be exercisable OFFLINE with the
deterministic model by factoring or injecting dependencies ONLY as
needed. The permanent offline proof traverses, in order:

```text
Turn 1 → reply retrieval → proposal inspection → Turn 2 → Turn 3 →
governed confirmation → composition close → recomposition on same root →
Turn 4 fresh-thread restore/continuity → Turn 5 non-mutation →
result serialization → worker exit → parent scan and cleanup
```

The proof uses the REAL worker code path (mode-injected, no credential,
no provider), the REAL composition boundaries, the synthetic
non-personal fixture discipline, and the REAL parent-side
fixture-identity re-verification, credential scan, and owned-root
disposal. It FAILS against the Execution-3 tree (the incorrect restore
call) and PASSES after repair. NO live acceptance rule is weakened; the
live gate, its bounds, its refusal discipline, and its exactly-once
authorization are unchanged.

## 8. No Execution 4 (frozen)

This task authorizes OFFLINE engineering and the candidate repin ONLY.
**No live-provider proof is executed, no provider credential is accessed,
Execution 4 is NOT authorized and MUST NOT run in this task, Phase Q7
remains BLOCKED — NOT BEGUN, and Stage 07 remains In Progress.** The
authoritative live-provider execution count remains THREE (Executions 1–
3, each under its own owner authorization, all failed truthfully). Any
future live execution requires a fresh dated owner decision. Q6 remains
not independently verified and not formally closed.

## 9. Lane ownership (frozen)

- **Lane C** — capability revision/schema adoption (proposal capability
  revision 3 + presentation; composition profile revision 6; frozen
  declarative envelope data; focused suites).
- **Lane D** — worker boundary, awaited evidence, stable failures, and
  the offline matrix proof (worker refactor with mode injection;
  structural gate; behavioral fault-injection suites).
- **Integration lane** — candidate repin, registry-only lockfile,
  authoritative offline ladder, documentation.

If isolated parallel workers are unavailable, the lanes execute
sequentially with disjoint per-commit file ownership and that is reported
honestly. No coordinator abstraction is committed. Historical reports and
frozen contracts remain immutable.
