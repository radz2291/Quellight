# Quellight Stage 07D Phase D4a — MSTR-012 Real-Use Proof Preparation Report

> **Class:** Preparation record. Phase D4a prepared the D4 real-use
> proof — contract, evidence machinery, offline negative controls, and
> the owner runbook — and NOTHING ELSE. No provider was accessed, no
> credential was read (the machine's owner-located auth file was never
> opened by this phase), no organic session was conducted, no operator
> data and no `.quellight-data` or `.pi/` material was touched, and the
> proof was NOT executed. **D4 real-use evidence does not exist.**
> **Stage 07D is not verified or formally closed. Stage 07E has not
> begun.**

## 1. Commit ledger (D4a)

| #   | Commit      | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | `59bb43ad`  | **Phase 0 — D4 proof contract**, standalone before any machinery: MSTR-012/QLT-017 interpretation from canonical text, the two evidence layers, session-level authorization model, staged store strategy, A1–A13 structural proof points, failure semantics, preparation obligations.                                                                                                                                                                                                      |
| 1   | `7cb7dba`   | Frozen `d4-contract.ts` (bounds; checks with identity-matched prerequisites; forbidden-evidence rules; N-D4-P control list), `scripts/lib/d4-evidence.mjs` (ledger, scanners, fail-closed seal, one-shot receipt, workspace policy), `scripts/run-d4-structured-session.mjs` (owner-invoked harness; refuses unauthorized execution; bounds enforced before transport; governed user surfaces only), `scripts/verify-d4-prep.mjs` (permanent offline gate), `verify:d4-prep` registration. |
| 2   | this commit | Owner runbook + this report + status surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## 2. MSTR-012 interpretation (fixed by the contract)

Canonical `MSTR-012`/`QLT-017` prescribe behaviors proven in real use —
retention, deletion, export, and pruning end to end; non-web-accessible
store files; absent secret canaries; credentials external to stored
data; informed-user retention disclosure; documented backup/recovery
limitations — and prescribe NO numeric duration. The approved owner
decision OD-D5 fixes the shape: one bounded owner-authorized structured
session (Q6 one-shot pattern) plus a short owner organic-use window.
Neither layer alone is sufficient; controlled conditions are never
described as organic use.

## 3. What was prepared

- **Layer A (structured session):** a fixed structural plan (5 user
  turns; ≤ 20 provider requests; ≤ 2048 output tokens/request; ≤ 120 s
  per-turn deadline; ≤ 45 minutes total; zero retries, no fallback)
  proving A1 usability, A2 deliberate preservation (ceremony path or
  direct Save — equally valid evidence, path recorded), A3
  no-agent-canonical authority, A4 restart survival, A5 fresh-thread
  receipt through assembly evidence, A6 exclusion of pending/removed
  material, A7 the quiet commitment-conflict behavior (a model key
  collision exercises challenge+dismissal; a distinct key is correct
  product behavior recorded with the unchanged standing commitment —
  neither outcome depends on wording; a non-quiet collision or silent
  overwrite fails truthfully), A8 truthful export, A9 dedicated-record
  removal, A10 conversation-only deletion preserving meaning, A11
  complete truthful reconciliation, A12 transcript hygiene, A13 evidence
  hygiene. The scenario file is owner-supplied OUTSIDE the repository;
  content is memory-only; only its digest (memory-only) feeds scanners.
- **Layer B (organic window):** three genuine sessions, ≥ 2 launches,
  ≥ 2 calendar days, ≥ 1 restart, ≥ 1 fresh conversation; owner-chosen
  low-sensitivity subject; wording never committed; per-event exclusion;
  the eight observation answers as evidence.
- **Authorization model (session level):** explicit session flag +
  one-shot exclusive-create receipt + credential-existence gate +
  scenario gate, in that order; consumed receipts prevent rerun; only
  the owner archives a receipt; infrastructure-only failure permits one
  fresh owner-authorized session. The exact authorization text the
  future owner statement must match is in the runbook.
- **Store strategy (staged):** Layer A uses a dedicated disposable
  directory outside the repository (composition guards refuse the
  operator directory and repository locations — re-proven by N-D4-P-17);
  Layer B uses the normal operator store with NO harness attached, and
  only structural metadata plus owner observations are recorded.
- **Evidence machinery:** an append-only ledger whose validator rejects
  forbidden detail keys (raw prompt/response/content names), credential-
  shaped values, absolute paths, and oversized values at append time;
  leak scanners (credential value, scenario digest, context-block
  marker); a seal that fails closed on missing checks, `ok:false`
  receipts, identity-mismatched prerequisites, or scan hits; the
  workspace policy; the one-shot receipt helpers.
- **Deletion authority:** the harness deletes ONLY through the governed
  user surfaces (the conversation-lifecycle services and ceremony
  actions) on dedicated `d4-proof-*` records/threads, always
  preview-first, export-verified before deletion, reconciliation and
  restart verified after.

## 4. Offline verification evidence (this phase)

- `verify:d4-prep` — **23 checks green**, implementing N-D4-P-1..18 over
  synthetic evidence and disposable synthetic paths: refusal without the
  session flag (no receipt written), refusal of a consumed receipt
  (`QLT_D4_ALREADY_AUTHORIZED`), refusal of a malformed receipt, refusal
  of a missing credential BEFORE any workspace exists (workspace delta 0,
  deterministic via the documented test-only credential-source override),
  the plan budget refusing an over-bounds plan before transport, ledger
  rejection of credential-shaped values / absolute paths / raw-content
  keys, partial and contradictory evidence refused by the seal, false
  restart / fresh-thread / deletion / reconciliation claims refused by
  identity-matched prerequisites, the synthetic full lifecycle sealing
  `passed`, the truthful failure seal, verified cleanup, the workspace
  policy refusing repository and operator-directory locations, the
  static no-provider-access property, and contract self-consistency.
- The harness itself parses (`node --check`) but was NEVER run beyond
  its refusal paths; `verify:d1` 49, `verify:d2` 74, `verify:d3` 35, the
  node suite 351/351, the UI suites 20/20, typecheck, Prettier, and
  `git diff --check` all stayed green.

## 5. Evidence collected versus deliberately excluded

Collected: repository-structural facts (gates green; machinery files;
contract data). Deliberately excluded from any evidence surface:
conversation or scenario content, credential values or digests-of-
credentials, absolute filesystem paths, raw prompts/responses, and any
live-use artifact — because the live use has not happened and must not
happen without owner authorization.

## 6. Carried limitations

- The structured-session harness has been proven by offline controls and
  parse checks only; its first real execution is D4b under owner
  authorization, and a live finding (including a truthful
  scenario-behavior finding if the model drafts no proposal) is a valid
  outcome.
- A7's live trigger depends on the model's key choice by design; the
  deterministic conflict class itself remains proven by the D1 fixture
  evidence and the D2 browser pass.
- The organic window's small size is a floor, not a claim: three
  sessions is the minimum that exhibits continuity, restart, and a fresh
  conversation; the D5 audit may require more.
- Carried from D1/D2/D3 unchanged: sequential-lane execution note, the
  amendment-composition note, stale `0.3.0` console labels, hashed
  Mastra dist import coupling, L-1/L-2.

## 7. Status

```text
QUELLIGHT STAGE 07D D4 REAL-USE PROOF PREPARED — EXECUTION NOT AUTHORIZED
NO PROVIDER OR OPERATOR-DATA ACCESS OCCURRED
D4 REAL-USE EVIDENCE DOES NOT YET EXIST
STAGE 07D IS NOT VERIFIED OR FORMALLY CLOSED
STAGE 07E HAS NOT BEGUN
Stage 07 remains In Progress.
```
