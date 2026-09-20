# Quellight Stage 07C Phase Q5 — Formal Closure

> **Class:** Formal-closure record (documentation-only). This document
> closes Phase Q5 against the implementation, the independent audit (NOT
> VERIFIED — B-1/H-1/M-1), the frozen B-1/H-1 remediation contract, the
> executable remediation, the permanent regression coverage, the evidence
> normalization, and the fresh independent re-verification. It changes NO
> source, NO test, NO script, NO migration, NO package file, NO frozen
> contract, and NO historical report (including both Q5 audit reports,
> which are preserved byte-for-byte). VICT is treated read-only; its
> documentation-only System Reference reconciliation FOLLOWS this closure
> as a separate change (`docs/VICT-SYSTEM-REFERENCE.md` only; no VICT
> code, package, manifest, lockfile, test, release identity, or `.pi/`
> change).

## 0. Verdict

```text
QUELLIGHT STAGE 07C PHASE Q5 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Shared World memory is inspectable and user-controlled, while agent authority remains unchanged.
FUTURE PROJECT-SCOPED CONVERSATIONS REMAIN PREPARED FOR — NOT IMPLEMENTED
VICT-M-1 MUST BE RESOLVED BEFORE THE PHASE Q6 LIVE-PROVIDER PROOF
PHASE Q6 CONTRACT AND IMPLEMENTATION PLANNING IS PERMITTED — NOT BEGUN
Stage 07 remains In Progress.
```

## 1. The closed chain of custody

| Step                                    | Identity                                                                                                                                                                                         | Content                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Q5 contract freeze (alone)           | `e2d8436…`                                                                                                                                                                                       | Frozen Phase Q5 contract + `policy-contract.ts` + `inspection-contract.ts` + the dated Q4-AMEND-1 edit to `context-contract.ts`; committed BEFORE all consuming implementation                                                            |
| 2. Q5 implementation                    | lanes `9073c14…`, `a2d1f27…`, … → implementation record at `f18cff8…`                                                                                                                            | Migration 4 (`qlt_memory_policy`, `qlt_turn_memory_policy`), the Memory Mode policy family, the five-op inspection surface, the four-area Memory UI, the quiet Memory chip; agent envelope UNCHANGED at exactly `qlt.proposal.draft@1`    |
| 3. Verification-isolation remediation   | `d61532d…`                                                                                                                                                                                       | Dev-start gate never touches operator data (`QUELLIGHT_DATA_DIR_ABSOLUTE` fail-closed seam; task-owned `mkdtemp` stores)                                                                                                                  |
| 4. Q5 independent verification (audit)  | `e80fe08…` against audited tree `d61532d…`                                                                                                                                                       | `NOT VERIFIED` — Blocking B-1 (a read — `getPolicy` — durably seeded the default row), High H-1 (terminal proposals rendered in Current), Medium M-1 (vacuous read-purity/bucket coverage); Low L-1/L-2 and Observations O-1..O-5 carried |
| 5. B-1/H-1 remediation contract (alone) | `c873692…`                                                                                                                                                                                       | Frozen remediation of exactly B-1, H-1, M-1; lane ownership frozen before branching                                                                                                                                                       |
| 6. Executable remediation               | `53831fd…` (production; exactly 4 files) → `e56952d…` (tests; exactly 5 files)                                                                                                                   | Pure peeks (`peekCurrent`/`peekPolicyRow`) + write-path-only `ensureCurrent`; truthful implicit representation (`updatedAtMs: null`, `persisted: false`); explicit bucket branching with no fallback; permanent non-vacuous controls      |
| 7. Remediation record + status docs     | `aef5767…`                                                                                                                                                                                       | `QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md` + README/system-reference/decision-register status lines                                                                                                                              |
| 8. Evidence normalization               | `fabaf2c…` (style-only; audit-report formatting; token streams byte-equal) → `73ca1cb…` (documentation-only reconciliation; the complete span `e80fe08..aef5767` = exactly 14 files, +1606/−155) | Repository-wide `format:check` compliance restored; evidence claims reconciled without changing any recorded result                                                                                                                       |
| 9. Fresh independent re-verification    | `6cf7dcd…` (`QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-INDEPENDENT-RE-VERIFICATION.md`) against the untouched tree `73ca1cb…`                                                                           | `VERIFIED WITH NON-BLOCKING ISSUES — Q5 FORMAL CLOSURE PERMITTED`; 0 Blocking · 0 High · 0 Medium · 2 Low (carried L-1/L-2) · 0 new findings                                                                                              |
| 10. THIS formal closure                 | this commit                                                                                                                                                                                      | Q5 closed; VICT documentation reconciled separately; Q6 planning permitted, not begun                                                                                                                                                     |

## 2. What the re-verification proved (independent; not the implementer's claims)

- **B-1 is dead.** Independently authored probes through the REAL
  released `app.data.query` boundary reproduce the original defect at
  `d61532d…` (one `getPolicy` on a freshly migrated store with an empty
  `qlt_memory_policy` table inserts the default row: 0 → 1, visible in a
  complete durable row-state dump) and prove the corrected behavior on
  the remediated tree: zero durable effect, no schema mutation, the
  truthful implicit default (`across-conversations`, revision 1,
  `updatedAtMs: null`, `persisted: false`), deterministic repeats, and
  purity for EVERY inspection operation.
- **Write paths still seed, truthfully.** Turn admission establishes the
  durable default at revision 1 inside the per-conversation critical
  section (Observation O-2 preserved); a default-mode set on an absent
  row creates exactly one row at revision 1 without a false bump; the
  first effective change lands at revision 2; later changes increment
  monotonically; same-value operations converge without a bump; same-key
  retries replay truthfully without re-application; conflicting same-key
  payloads fail with zero partial effects; restart preserves the durable
  row byte-for-byte; reads remain pure after persistence; per-turn
  applied-policy evidence stays admission-bound and never relabels.
- **H-1 is dead.** The same probes reproduce the original Current-bucket
  leak at `d61532d…` (`["claim","proposal","open_loop","commitment",
"claim"]`, total 5 vs 4 canonical — the confirmed proposal rendered in
  Current) and prove the truthful buckets on the remediated tree over a
  non-vacuous mixed fixture (all six proposal statuses, current claim/
  commitment/loop, superseded/released/resolved/abandoned/retired/
  transformed records, two threads): pending = 3 (only
  proposed/awaiting_decision proposals), current = 6 (zero proposals of
  every status; exactly the independently derived current-effective id
  set; no duplicate-looking pair), history = 10 (all four terminal
  proposals + all six closed records; no current-effective record);
  deterministic ordering with equal-timestamp `id ASC` tie-break;
  disjoint duplicate-free deterministic pagination with consistent
  totals; kind/thread filters correct and unable to reintroduce
  proposals into Current (`kind=proposal` on Current = exactly 0);
  unsupported bucket/kind and unknown ops refused with the stable codes
  — no fallback branch can classify a future bucket as History; empty
  buckets truthful.
- **The coverage is no longer vacuous.** The new permanent suites run
  against the audited SHA fail 12/31 — including genuine behavioral
  assertion failures (`expected 6 to be 3` on the old leaking Pending
  bucket; the old `getPolicy` shape failing on the missing `persisted`
  field) — and pass 31/31 on the remediated tree (`memory-policy.test.ts`
  16 tests; `memory-authority.test.ts` 15 tests; `verify:q5` 86 checks;
  the extended browser ceremony's after-confirm Current-truthfulness
  assertion). The browser control uses a confirmed proposal plus its
  resulting canonical record.
- **The authoritative ladder ran green exactly once** on the untouched
  tree with full preflight (processes, ports, environment, disposable
  directories): `npm ci` (exit 0); `verify:consumer` (exit 0);
  `verify:quellight` (exit 0 — format:check; typecheck; verify:governance;
  verify:q2; verify:q3; verify:q4; verify:dev-start; verify:q5;
  test:node; test:ui; build + closed-allowlist scan; browser-check;
  browser-stop-check; browser-ceremony-check PASS on its first and only
  run; artifact scan; git diff --check); `npm audit --omit=dev`
  (0 vulnerabilities); `git diff --check`. No rerun, no timeout or
  assertion change.
- **Preservation held everywhere else**: three Memory Modes; global
  policy semantics; per-turn binding; immutable historical evidence;
  context assembly/injection and assembler fingerprints; project-scope
  seam (prepared, NOT implemented); lifecycle actions and the L-3
  repair; agent isolation (envelope EXACTLY `qlt.proposal.draft@1`);
  one-active-turn-per-conversation; verification-data isolation;
  Q2/Q3/Q4 behavior; VICT pins exactly `@victframework/*@0.2.0`;
  package lock and release identity unchanged; future steering
  unimplemented; no Q6 work.
- **Operator data was never touched**: never opened, queried, hashed,
  copied, migrated, altered, or deleted (filesystem metadata was not
  inspected by the re-verification either); all probes and suites used
  explicit disposable task-owned OS-temporary stores.

## 3. Carried obligations (recorded truthfully; unchanged by closure)

- **L-1** — the `unrecorded` usage state is frozen data but unreachable
  through the current inspection surface (truthful absence; dead state
  only). Carry to the next inspection touch-point (07D retention work).
- **L-2** — `listTurns` summary rows expose
  `assemblerVersion`/`renderedBytes` outside the Details disclosure; the
  UI does not render them and they are benign metrics. Carry as a
  contract-wording touch-point.
- **L-R1** — the admission guard's per-conversation critical-section map
  retains one settled promise per distinct conversation id (≈102 B/entry,
  tail replaced per request; unbounded only in the lifetime
  conversation-count axis of one process). Carried from the Q4 closure.
- **L-R2** — the now-unreachable `no-open-turn` pass-reason union member
  (cosmetic). Carried from the Q4 closure.
- **Pending-correction fixture limits** — production wires no
  pending-correction proposal path; correction-proposal coverage seeds at
  the disclosed repository-level fixture boundary (Q3 §12 deferral and
  the Q4/L-3 disclosures remain).
- **Q3 §12 correction-proposal deferral** — dedicated UI exits and the
  correction-proposal production path remain deferred (backlog/Q5+
  disposition unchanged).
- **D-FUTURE-STEERING-1** — future turn steering remains RECORDED — NOT
  IMPLEMENTED.
- **VICT-M-1** — the truthful VICT effect-class correction (or an
  equivalently truthful framework-native abstraction in a NEW immutable
  released package set) followed by the Quellight repin and fresh
  compatibility proof REMAINS REQUIRED with its hard deadline: BEFORE the
  Phase Q6 live-provider proof and therefore before the Stage 07C final
  audit. DISTINCT from Q5-M-1 (which this closure closes); VICT-M-1 is
  NOT affected by this closure.
- **Future project-scoped conversations** — PREPARED FOR (the durable
  global policy, typed resolver, and scope seam exist) and NOT
  IMPLEMENTED (no project identities, tables, selectors, UI, or
  precedence semantics exist anywhere; no documentation claims support).

## 4. Scope of this closure (documentation-only)

Changed by the closure commit: this record, `README.md` (status lines),
`docs/system-reference.md` (status header, status lines, and the Phase Q5
closure sentence), and `docs/decision-register.md` (the D-Q5-5 entry).
Preserved byte-for-byte: every frozen contract, every historical report,
both Q5 audit reports, the remediation contract and record, all source,
tests, scripts, migrations, manifests, and lockfiles. The VICT
documentation reconciliation (`docs/VICT-SYSTEM-REFERENCE.md` only)
follows as a separate documentation-only commit after this closure;
no VICT code, package, manifest, lockfile, test, registry state, tag,
release identity, or `.pi/` content is changed.

## 5. Disposition

```text
QUELLIGHT STAGE 07C PHASE Q5 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
PHASE Q6 CONTRACT AND IMPLEMENTATION PLANNING IS PERMITTED — NOT BEGUN
VICT-M-1 REMAINS OPEN — HARD DEADLINE BEFORE THE PHASE Q6 LIVE-PROVIDER PROOF
Stage 07 remains In Progress.
```
