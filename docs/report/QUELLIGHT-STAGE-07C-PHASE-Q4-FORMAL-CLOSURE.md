# Quellight Stage 07C Phase Q4 — Formal Closure

> **Class:** Formal-closure record (documentation-only). This document
> closes Phase Q4 against the independent verification, the owner
> decision, the H-1 remediation, the evidence erratum, and the fresh
> independent re-verification. It changes NO source, NO test, NO script,
> NO migration, NO frozen contract, NO implementation/remediation report,
> and NEITHER independent audit report. VICT is treated read-only (its
> System Reference registration is the only VICT-side change; no VICT
> code, package, manifest, lockfile, test, or release-identity change).

## 0. Verdict

```text
QUELLIGHT STAGE 07C PHASE Q4 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
One active turn per conversation prevents cross-turn context substitution; ambiguous attribution injects zero memory.
FUTURE TURN STEERING REMAINS RECORDED — NOT IMPLEMENTED
PHASE Q5 CONTRACT AND IMPLEMENTATION PLANNING IS PERMITTED — NOT BEGUN
Stage 07 remains In Progress.
```

## 1. The closed chain of custody

| Step                                     | Identity                                                                                                            | Content                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Q4 contract freeze (alone)            | `b4bf759…`                                                                                                          | Frozen Phase Q4 contract + `context-contract.ts`; no amendment commits                                                                                                                                    |
| 2. Q4 implementation                     | `c9620ad…` … `bf7fec3…` (six lanes) → implementation record                                                         | Deterministic context assembly: migration 3, assembler, seam injection, transparency line, capability envelope unchanged                                                                                  |
| 3. Q4 independent verification           | audit commit `821d4f8…` against audited tree `c4896be…`                                                             | `VERIFIED WITH ONE HIGH FINDING` — H-1 (same-conversation turn-overlap snapshot crossover) blocks closure; L-1/L-2/L-3, O-1/O-2/O-3, M-1 recorded                                                         |
| 4. Owner decision                        | D-Q4-H1-1 in the decision register (implemented by the remediation contract `2b519d2…`)                             | Exactly one active agent turn per conversation; truthful refusal for distinct overlapping requests; same-key retries preserve VICT idempotency; different conversations stay concurrent                   |
| 5. H-1 remediation                       | contract `2b519d2…` (alone) → executable `e9ac36a…` → tests `a49be65…`                                              | Race-safe admission boundary at the real turns ingress + model-seam defensive backstop (`resolveForStream` exactly-one attribution) + 11 permanent regression tests                                       |
| 6. Remediation record + evidence erratum | docs commits `163086c…` → `7ec5dfa…` → `5a37c96…` → `b29456c…` → `6fd1ba8…`                                         | Remediation report; disclosed correction of the malformed 41-character start SHA (→ `821d4f8…`) and the truthful node-test count (205/14; 194+11); Git-derived inventory re-derived (+1880/−51, 12 files) |
| 7. Fresh independent re-verification     | `e0e0f19…` (`QUELLIGHT-STAGE-07C-PHASE-Q4-H1-INDEPENDENT-RE-VERIFICATION.md`) against the untouched tree `6fd1ba8…` | `VERIFIED WITH NON-BLOCKING ISSUES — Q4 FORMAL CLOSURE PERMITTED`; 0 Blocking · 0 High · 0 Medium · 2 Low · 2 Observations                                                                                |

## 2. What the re-verification proved (independent; not the implementer's claims)

- **H-1 is dead on the remediated tree.** The independently authored
  negative control reproduces all four facets of the original defect
  against `c4896be…` (in-flight promise borrowing; snapshot substitution
  with a post-freeze canary; a false durable `complete` record for a turn
  whose stream never saw injection; transparency corruption) and FAILS
  exactly where the fix must hold when pointed at the remediated tree:
  the seam returns `pass/ambiguous` instead of injecting.
- **Admission control is race-safe in the supported single-process
  topology.** Eight simultaneous distinct-key requests to one real turns
  ingress: exactly one durable turn, seven `QLT_TURN_ALREADY_OPEN`
  refusals with deep zero effect (no VICT receipt, no intent, no model
  call, no assembly, no transcript message, no Shared World effect). The
  check+start pair is serialized per conversation (dispatch awaited inside
  the section); different conversations remain concurrent; a distinct
  request succeeds after the active turn becomes terminal; a failed
  dispatch does not poison later requests; no queuing or parallel-reply
  machinery exists.
- **VICT idempotency is preserved exactly.** Same-key retries (during and
  after settlement) replay the original turn identity; a seeded pending
  receipt with a live lease answers the truthful in-progress disposition;
  a same-key different payload is the stable conflict; a key bound to
  conversation A cannot create a turn in conversation B; a stale failed
  receipt replays its deterministic failure; the guard never
  misclassifies a same-key replay as a new overlapping request.
- **The seam-state matrix is complete and fails closed.** Zero open turns
  pass through; exactly-one record-less assembles; exactly-one recorded
  replays byte-identically (post-freeze memory never crosses in); every
  ≥2 combination (record-less, recorded, mixed, in-flight, three-plus,
  reversed ages) is ambiguous with zero injection, no promise borrowing,
  and no new assembly; no mutable global current-turn identity; no
  client/model-supplied turn identity; selection, budgets, ordering,
  injection format, transcript non-pollution, and agent authority
  unchanged (remediation diff bounded to the attribution block).
- **Restart and failure truth hold.** Real boot reconciliation settles
  interrupted turns truthfully; the durable fence rejects a stale
  settlement with `VICT_CONTROL_TURN_INVALID_TRANSITION`; the
  one-active-turn rule reapplies after restart; a bypass-created ambiguous
  state injects zero memory; failure stays non-echoing with no fabricated
  transparency evidence.
- **The refusal is quiet and truthful.** Component probe on the real
  island: optimistic message withdrawn, draft restored, exact sentence,
  no modal, no tray opening, no focus theft, conversation usable, exactly
  one ingress request, notice clears on thread transition/send.
- **Aggregate ladder green first-run** on the untouched audited tree:
  `npm ci`; `verify:consumer` (exact-pin 0.2.0 consumption, content
  identity re-derived, negative control held); `verify:quellight` (format,
  typecheck, governance, Q2, Q3, Q4 — 41 checks, node tests, UI tests,
  production build + warning scan, real-browser checks, artifact scan,
  `git diff --check`); `npm audit --omit=dev` — 0 vulnerabilities;
  `git diff --check` clean.

## 3. Findings carried through closure (with dispositions)

- **L-R1 (Low):** the admission guard's per-conversation critical-section
  map retains one settled promise per DISTINCT conversation id for the
  process lifetime (tail replaced per request; ≈102 B/entry measured;
  unbounded only in the lifetime conversation-count axis of one process).
  Carried: no correctness impact; any eviction policy belongs to a later
  change. Revisit trigger: any future multi-tenant or long-lived-server
  deployment shape.
- **L-R2 (Low):** the `resolveForStream` pass-reason union retains the now
  unreachable `'no-open-turn'` member (zero open turns returns
  `'ambiguous'` under the exactly-one rule; behavior identical). Carried:
  cosmetic; may be cleaned in a future pass.
- **O-R1:** executor post-turn pipeline issues additional in-process model
  calls (memory settle) — server-side only; recorded for future
  verification authors. **O-R2:** the disclosed `verify:q4` inventory
  re-pin to the Q4 audited tree — verified necessary and exact.
- **L-3** (correction-kind proposal confirmation rollback, duplicate
  source-thread link): remains a Q5/backlog obligation only; dormant
  (production correction path is `applyCorrection`; the capability rejects
  correction proposals). NOT repaired here.
- **M-1** (truthful VICT effect-class correction + Quellight repin):
  remains OPEN with its hard deadline — before the Phase Q6 live-provider
  proof and the Stage 07C final audit.
- **Pending-correction fixture limitation** and the **Q3
  correction-proposal deferral**: preserved unchanged.
- **O-1/O-2/O-3** from the Q4 audit: preserved as observations.

## 4. Future direction recorded — NOT implemented

Future turn steering remains recorded (`D-FUTURE-STEERING-1`) as a
deferred product direction: steering must be an explicit operation
targeting the exact active turn — never a second overlapping turn — and
requires a separate future contract (exact target-turn identity;
append-guidance versus cancel-and-restart semantics; durable event and
transcript truth; idempotency; restart/reconnect behavior;
context-snapshot consequences; provider support; user-visible state).
Nothing is implemented.

## 5. Q5

Phase Q5 contract and implementation planning is PERMITTED — NOT BEGUN.
Q5 must not build on any overlap behavior beyond the closed rule set
above, and inherits the carried obligations (M-1 deadline; L-3 backlog;
pending-correction fixture limitation; Q3 correction-proposal deferral).

## 6. Closure checks (documentation-only closure)

- Closure changed-file allowlist: exactly this report, `README.md`,
  `docs/system-reference.md`, `docs/decision-register.md` (Quellight);
  `docs/VICT-SYSTEM-REFERENCE.md` (VICT only).
- No source, test, script, migration, frozen contract, implementation or
  remediation report, or independent audit report touched.
- Targeted formatting checks and `git diff --check` green; both trees
  clean; both pushes normal fast-forward after fresh fetches.
- The full runtime/browser ladder is NOT rerun after closure
  documentation: the audited executable tree is unchanged
  (`6fd1ba8…`; closure commits are documentation-only).
