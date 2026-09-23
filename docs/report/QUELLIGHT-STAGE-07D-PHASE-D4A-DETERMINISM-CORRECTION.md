# Quellight Stage 07D Phase D4a — Proof Determinism Correction Record

> **Class:** Correction record (D4a scope: contract/evidence machinery,
> its tests, runbook, report, minimal status records). Companion to
> Amendment 1 (`docs/report/QUELLIGHT-STAGE-07D-PHASE-D4A-CONTRACT-AMENDMENT-1.md`,
> committed standalone as `ebbcdd9` BEFORE any dependent executable
> change, machinery as `3b3f9e2`). No credential, operator data, `.pi/`,
> provider, `.quellight-data`, or scenario file was accessed; the D4
> session was NOT executed. Stage 07D remains unverified and formally
> open.

## 1. The finding

The D4a preparation report carried: "A7's live trigger depends on the
model's key choice by design." The full frozen-mapping audit found the
same defect twice more, plus one vacuous pass:

- **A2 (@1):** the ceremony-confirmation branch required a model-drafted
  proposal (the direct-Save branch existed but only as fallback).
- **A3 (@1):** the gate `failFast`-ed `failed-scenario-behavior` when
  the remember turn drafted NO pending proposal — a required failure
  caused by model inaction.
- **A6 (@1):** the pending-material exclusion proof required a
  model-drafted pending proposal to exist.
- **A7 (@1):** the distinct-key branch passed without exercising the
  conflict class at all (vacuous), while the collision branch required
  the model to choose the standing key.

## 2. Surface audit (repository reality)

- Commitment-kind proposals are created ONLY by the agent draft
  capability (`proposedBy` pinned to the agent identity); the governed
  ceremony inventory is frozen at exactly thirteen ops with NO
  owner-draft action, and `/api/act` dispatches declared action ids
  only.
- The deterministic conflict detector runs ONLY at the owner decision
  boundary `confirmProposal` (`ensureChallenge` has no other product
  caller); challenge resolution is user-only
  (`act.dismissChallenge`/`act.amendCommitment`).
- Direct Save (`act.createClaim`/`act.createCommitment` with an
  owner-chosen `commitmentKey`) is a first-class governed product path.

Because the ceremony inventory is frozen, the correction adds NO
product action. Instead: every required transition is owner-drivable,
and the full conflict class is permanently proven offline through a
REAL composition at the REAL user boundary (N-D4-P-23), where the
proposal is created through the production store service the capability
itself wraps — never raw SQL.

## 3. Deterministic paths now required (@2)

| Required proof | Deterministic path                                                                                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2 preserve    | owner direct-Saves via `act.createClaim` (always); ceremony confirmation recorded as observation when a proposal exists                                                                                                                                                                                                                                         |
| A3 authority   | store-attribution audit: zero agent-created canonical records; owner identities canonically present; no proposal-existence requirement                                                                                                                                                                                                                          |
| A6 exclusion   | owner seeds removed (`act.removeRecord`) AND expired (`act.setClaimExpiry` → `act.runRetentionPass`) records; both must be excluded from the fresh-thread assembly; pending exclusion is observation                                                                                                                                                            |
| A7 conflict    | standing `d4-proof-*` commitment via `act.createCommitment`; EVERY commitment-kind proposal resolved through the real decision boundary (`confirmProposal`: quiet refusal + challenge + user dismissal on same key, ordinary confirmation on distinct key); REQUIRED: standing commitment unchanged, no open challenge, zero mutation; no-proposal still passes |
| A9 removal     | governed plan action `act.removeRecord` (the UI's own boundary), not the store shortcut                                                                                                                                                                                                                                                                         |

Bounds re-affirmed unchanged: one session; ≤ 45 minutes; 5 user turns;
≤ 20 provider requests; ≤ 2048 output tokens/request; ≤ 120 s/turn
deadline; zero retries; no fallback. The amendment adds no turns and no
provider requests.

## 4. Permanent controls added (verify:d4-prep → 29 checks green)

- **N-D4-P-19:** a complete ledger with ZERO model observations seals
  `passed`.
- **N-D4-P-20:** adding observation details never changes the verdict.
- **N-D4-P-21:** the ledger's check-id set is CLOSED — invented or
  model-proposed ids are refused (fail-closed false-evidence defense).
- **N-D4-P-22:** static — the classification covers every required
  check; none is a model observation; the scenario-behavior
  outcome/code exist nowhere.
- **N-D4-P-23:** REAL composition, offline, deterministic fixture: direct
  Save crosses the governed boundary; the intentional owner confirmation
  of the mirrored conflicting proposal refuses quietly
  (`QLT_COMMITMENT_CONFLICT`), exactly one challenge row appears, the
  refusal creates no canonical record, the user-only dismissal
  resolves it, and the standing commitment is byte-identical
  throughout.
- **N-D4-P-24:** static — every harness action id is plan-declared; the
  only `commitmentKey` literal is the dedicated proof key; no fixture
  trigger wording exists.

Battery after the correction: `verify:d1` 49, `verify:d2` 74,
`verify:d3` 35, `verify:d4-prep` 29, node suite 351/351, UI suites
20/20, typecheck, Prettier, `git diff --check` — all green. (The
provider, browser ceremony, and aggregate ladder were NOT run, per
correction scope.)

## 5. Credential boundary (reconciled)

The owner's configured supported path is the owner-designated
authentication boundary (the Q6-precedent credential file); the
environment variable is a secondary source. The authorization text no
longer names the environment variable: presence-only handling, in-memory
provider use, no printing/hashing/persistence/reporting, no copying into
the proof workspace. The credential was NOT read during this correction.

Also corrected: the runbook named the pinned profile
`ollama-cloud/glm-4.6-flash` while the contract and composition pin
`ollama-cloud/glm-5.3-flash` (verified byte-equal at runtime); the
runbook now states the pinned profile truthfully.

## 6. Optional model observations retained

`modelProposalObserved`, `ceremonyObservation`,
`conflictClassExercised`, `pendingProposalObservation` — structural
facts only, under the reserved vocabulary; they never gate a required
check (proven by N-D4-P-20). The authorization-gate chain and the
consumed one-shot receipt are unchanged.
