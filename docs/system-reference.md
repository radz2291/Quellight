# Quellight system reference — Stage 07B/07C

## Status (current, 2026-09-22 — STAGE 07C FORMALLY CLOSED (PHASE Q7 AUDIT VERIFIED); STAGE 07D IN PROGRESS — D1a FROZEN, D1/D3/D2 IMPLEMENTED (SELF-VERIFIED), D4 PREPARED AND MADE DETERMINISTIC, EXECUTION NOT AUTHORIZED, D5 NOT BEGUN; STAGE 07E NOT BEGUN)

```text
VICT-M-1: INDEPENDENTLY VERIFIED AND FORMALLY CLOSED (qlt.proposal.draft@2/write; exact host quiet-write policy qlt.host-policy.quiet-write@1; adopted STABLE set @victframework/*@0.3.0 = vict-release-set@1/0.3.0, contentId v1_5f3a074a…; latest = 0.3.0; the 0.3.0-rc.1 candidate and its recovered evidence chain remain immutable historical record)
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q1: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q2: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (durable Shared World schema)
Stage 07C Phase Q3: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (governed confirmation ceremony and quiet memory inbox)
Stage 07C Phase Q4: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (deterministic Shared World context assembly; H-1 remediated and independently re-verified closed)
Stage 07C Phase Q5: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (Shared World inspection, user memory control, one durable global Memory Mode; independent audit NOT VERIFIED — B-1/H-1; Q5-B-1/Q5-H-1/Q5-M-1 remediated per the frozen remediation contract and independently re-verified closed; L-3 repaired; zero-warning dev-start gate)
Stage 07C Phase Q6: VERIFIED WITH NON-BLOCKING FINDINGS — FORMALLY CLOSED (root-cause recovery; ONE recovery live ceremony passed 2026-09-22 — six turns, eight HTTP requests, zero findings, exact stable VICT 0.3.1, instructions 5/profile 7; the one-shot live authorization is consumed; independently verified by the Phase Q7 audit with independent offline negative controls for every mandated defect class; see docs/report/QUELLIGHT-STAGE-07C-PHASE-Q7-INDEPENDENT-VERIFICATION.md and docs/report/QUELLIGHT-STAGE-07C-PHASE-Q7-FORMAL-CLOSURE.md)
Stage 07C Phase Q7: COMPLETE — AUTHORITATIVE VERDICT PASS (independent Stage 07C audit; the audited tree 8a26d31…; audit ladder green with one recorded browser-timing rerun, unchanged assertions)
Stage 07C: FORMALLY CLOSED (Phases F and Q1–Q5 closed in their own records; Q6/Q7 closed by the Q7 audit and closure record)
Stage 07D: D1a CONTRACT FROZEN; D1/D3/D2 IMPLEMENTED; D4 LAYER A COMPLETE (attempt-2 structured session executed exactly once, SEALED PASSED at contract @2 — all 24 proof points true, bounds respected, exit 1 truthfully recorded the post-exit-verified workspace cleanup; attempt-1 archived byte-pinned); Contract Amendment 2 FROZEN AND IMPLEMENTED (`quellight.stage07d.operator-live-use@1`: `npm run dev:live` — supported normal-use live startup, credential through the protected variable or the owner-designated boundary in memory, fail-closed, pinned profile, normal operator store, verified by the permanent offline gate verify:dev-live 19 checks green); D4 LAYER B (organic-use window) AWAITS THE OWNER; Stage 07D NOT formally closed
Stage 07:  IN PROGRESS (07A, 07B, 07C closed; 07D permitted and not begun; 07D, 07E remain)
```

HISTORICAL STABLE REPIN CHECKPOINT (superseded for current Q6 status by D-Q6-15 below; 2026-09-22, D-Q6-10): after the fresh independent re-verification of `0.3.1-rc.2` returned ZERO Blocking/High/Medium findings, VICT published the stable `0.3.1` coordinated release (source `446453fc4f6837e50a0bf3254b47d6a208f5b491`; publication run `35688234026` — all 13 packages published under `latest` through npm OIDC trusted publishing, same-run registry verification failed on CDN propagation lag, terminal-`failure`, never relabelled; read-only evidence run `35689362749` terminal-`success` under the stable evidence-recovery amendment). Quellight was mechanically repinned `0.3.1-rc.2` → `0.3.1`: ten exact dependency pins, lockfile regenerated SOLELY from the public registry, central release-set identity (`vict-release-set@1/0.3.1`, contentId `v1_1c695280…`) and every derived verification literal updated together (the 0.3.0-era desynchronization class did not recur — a repo-wide sweep found no live-code rc.2 references). No product, Q6-harness, provider, authority, schema, ceremony, UI, or Shared World change. The complete offline ladder ran green (verify:consumer; verify:quellight — first run hit the known pre-existing `test:node` tmpdir-count isolation race, diagnosed Low, disclosed rerun green; verify:stage7c; audit 0 vulnerabilities; git diff --check clean). Candidate tags RETAINED: `vict-0.3.1-rc → 0.3.1-rc.2`; 0.3.0/0.3.1-rc.1/0.3.1-rc.2 immutable and installable. Record: docs/report/QUELLIGHT-STAGE-07C-STABLE-REPIN-0.3.1.md. Q6 remains NOT formally closed; **Execution 4 has NOT run and is NOT authorized**; **Phase Q7 remains BLOCKED — NOT BEGUN**; Stage 07 remains In Progress.

- **VICT-M-1 (2026-09-21): INDEPENDENTLY VERIFIED AND FORMALLY
  CLOSED.** The fresh independent re-verification
  (`CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`, 0 Blocking / 0
  High / 0 Medium) closed Blocking finding B-1 (the recovered evidence
  chain is intact: original publication run `35530894104` truthfully
  terminal-`failure`, successor read-only evidence run `35558851493`
  terminal-`success`), executed the full deferred audit scope (old-tree
  negative controls; 10 independent registry-package semantic probes;
  Linux rebuild 13/13 byte-identical; registry-only consumer proofs
  with fail-closed negative controls; both authoritative ladders green
  exactly once), and permitted the stable release. VICT published the
  STABLE set `vict-release-set@1/0.3.0` (contentId `v1_5f3a074a…`,
  release source `c7a413a…`, trusted-OIDC workflow run `35564490763`,
  attempt 1, terminal-`success`, zero npm credentials), and Quellight
  repinned EXACTLY to it at `1c7d3e6…` (mechanical only:
  `qlt.proposal.draft@2`/`write` and the exact host quiet-write policy
  unchanged; no product or Q6 behavior change). The stable-pinned
  authoritative ladder ran exactly once, first-run green. Quellight
  record: `docs/report/QUELLIGHT-STAGE-07C-M-1-STABLE-REPIN.md`;
  VICT closure record:
  `docs/report/VICT-M-1-STABLE-RELEASE-AND-FORMAL-CLOSURE.md`;
  re-verification record:
  `docs/report/VICT-M-1-INDEPENDENT-RE-VERIFICATION.md` (VICT);
  decision register D-Q-M1-1/D-Q-M1-2. At that date Phase Q6 had not
  begun; Q6 is now implemented (see the Phase Q6 entry below and the
  current status block).

- **Phase Q6 — deterministic final verification and the bounded
  live-provider Shared World ceremony proof (2026-09-22):
  IMPLEMENTED — HARNESS INDEPENDENTLY VERIFIED OFFLINE — LIVE PROOF
  STILL OWED; the live proof is BLOCKED (credential absent).** Contract
  freeze `ca82892…` (committed
  alone; zero amendments; frozen declarative module
  `src/lib/sharedworld/q6-contract.ts`) and implementation record
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md`
  (implementation commits `cd70bc8…`, `d25d9c3…`). Q6 is verification
  hardening ONLY: no new capability, action, migration, or agent
  authority (the envelope stays exactly `qlt.proposal.draft@2/write`
  with the one-entry quiet-write policy; the plan stays at 21 actions;
  migration bookkeeping stays `[1,2,3,4]`). New permanent gates:
  `verify:q6` (89 checks: frozen bounds/identity/envelope, live-gate
  refusal structure and never-automatic enforcement, durable invocation
  truth, epistemic inertness, fresh-thread C1 recovery with zero
  transcript pollution, conflict non-mutation, hostile-memory
  containment, restart preservation, the fail-closed isolation seam,
  wiring), `verify:stage7c` (the N-C25 aggregate: the N-C1..N-C25
  coverage manifest with missing-constituent and missing-row negative
  controls, the lockfile re-derivation of the stable release identity,
  and the five focused Q2–Q5+Q6 gates — never the large suites twice,
  never the live gate), and `verify:q6:live` (the N-C24 bounded live
  ceremony, double-gated, never automatic). The authoritative ladder
  (`npm ci`; `verify:consumer`; `verify:quellight` incl. the EXTENDED
  real-browser ceremony with the Q6 fresh-conversation continuity
  scenario; `verify:stage7c`; `npm audit --omit=dev` 0 vulnerabilities;
  `git diff --check`) ran exactly once, first-run green on the untouched
  tree `d25d9c3…`. The hostile-memory proof: a confirmed record carrying
  adversarial instructions and forged authority markers stays escaped
  bounded DATA, cannot self-confirm (`QLT_CONFIRMER_INVALID`), cannot
  forge correlation identity (`QLT_CORRELATION_MISSING`), and cannot add
  tools — acceptance is STRUCTURAL, never an exact-response assertion.
  **The live ceremony proof (N-C24) has NOT executed**: the operator
  credential `OLLAMA_API_KEY` is absent from the implementation
  environment, so the double gate refused truthfully (real exit 2, no
  composition, no provider call); per the frozen contract the blocked
  state is reported truthfully and Q7 remains blocked until the ONE
  owner-invoked live execution has run and passed. VICT stayed
  read-only; the operator `.quellight-data` directory was never
  accessed (fail-closed seam; mtimes unchanged).

- **Phase Q6 live-proof data-isolation remediation (2026-09-22):
  implementation-conformance correction; contract unchanged.** A
  directory-identity defect was found in the live harness BEFORE any
  live execution: the original `composeLive(reuseDataDir)` silently
  composed against a SECOND temporary directory while ownership, leak
  scanning, and cleanup used the first — so a live run would have
  restarted against the wrong store, could have escaped credential
  scanning, and could have stranded a directory. Remediation commit
  `c0e5a93…`: the script-only helper
  `scripts/lib/q6-live-workspace.mjs` allocates EXACTLY ONE disposable
  root; both compositions receive that exact path explicitly and its
  resolved identity is asserted BEFORE any provider turn (fail closed);
  repository and `.quellight-data` paths are refused; scans cover every
  nested byte of the root; verified cleanup FAILS the proof if the root
  cannot be removed. A non-vacuous offline negative control against the
  starting SHA demonstrated all four old-flow consequences; 11 permanent
  lifecycle suites + a 6-check `live-workspace` section in `verify:q6`
  make the regression unreturnable. Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-DATA-ISOLATION-REMEDIATION.md`.
  The live execution count remains ZERO; Q7 remains BLOCKED — NOT
  BEGUN.

- **Phase Q6 live-harness safety hardening (2026-09-22): final bounded
  correction; contract, bounds, provider identity, ceremony, and
  authority unchanged.** Two safety defects were corrected fail-closed
  (commit `6a81f66…`; record
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-HARNESS-SAFETY-HARDENING.md`):
  (S-1) the live harness no longer recursively deletes ANY unowned or
  rejected path (the `rmSync`/`node:fs` capability is removed from the
  script entirely — only the verified owned workspace root may be
  removed, through the workspace dispose, exactly once); identity
  failures are stable and non-echoing, and the RESOLVED environment's
  data directory is validated against the owned root BEFORE composition
  is constructed; (S-2) a credential scan that cannot COMPLETE (absent
  root, non-directory root, unreadable entry, traversal error) is now a
  PROOF FAILURE — never a clean result — while cleanup still proceeds on
  the owned root. Permanent offline evidence: 10 new safety suites plus
  the 11 lifecycle suites (21 total), and `verify:q6` grew to 100 checks
  (11 live-workspace) with the behavioral suites wired in.

- **Phase Q6 live ceremony proof EXECUTED TWICE, BOTH FAILED
  (2026-09-21; documentation-only).** Execution 1 (tree `8d1273b…`, the
  original phase authorization) failed at its first provider turn with
  an HTTP 401 authentication-failure class. Read-only root-cause
  diagnosis afterward found the operator's agent configuration held a
  literal `$OLLAMA_API_KEY` env-reference string as the provider key;
  the launcher passed it verbatim, so a meaningless bearer value was
  sent. The REAL working key lives in the operator agent's own
  credential store; a presence-verified direct probe (models list 200;
  minimal chat completion 200) proved the credential, endpoint, and
  model all work. Execution 2 (tree `a32bba5…`, a fresh owner
  authorization directing use of that store credential) had its first
  provider turn COMPLETE in 5,925 ms — within every frozen bound — but
  the model did not exercise the single draft capability: zero durable
  invocation records, zero proposals; the harness failed truthfully at
  the t1 boundary (the frozen missing-proposal failure class). Both
  runs: 1 of 6 provider turns used, zero retries, no fallback, zero
  durable Shared World effects, no authority exercised, every
  credential byte-scan clean; both runs hit the same fail-closed
  Windows cleanup finding (the owned temp root could not be removed by
  dispose), remediated by verified safe manual cleanup each time; the
  operator `.quellight-data` directory was never accessed (mtime
  unchanged). Neither run was retried; any further live execution, or
  any change to frozen bounds/model/prompts, requires a fresh dated
  owner decision (freeze §3/§13). Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`.
  Q7 remains BLOCKED — NOT BEGUN.

- **Phase Q6 bounded-memory-discretion amendment D-Q6-6 and Execution 3
  preparation (2026-09-21).** Per the freeze amendment procedure, a
  standalone amendment (`365259f…`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-BOUNDED-DISCRETION-AMENDMENT.md`)
  adopted the owner-approved rule-guided memory-discretion policy
  (D-Q6-6: explicit remember requests draft; clear durable meaning is
  drafted even unasked; transient incidents, software trouble, momentary
  feelings, and speculative interpretations never become proposals;
  mixed messages yield only the durable core; uncertainty stays
  uncertain; at most two proposals per turn; drafting is quiet; only
  the user's confirmation canonicalizes). The conversation instructions
  advanced to revision 4 and the agent profile to revision 5; the
  capability, host policy, model/provider, action inventory, and
  authority are unchanged; ONLY the live output ceiling moved (256 →
  512). The single implicit-positive live proof was replaced by a
  five-turn matrix — explicit positive, discretionary positive via an
  EXTERNAL private fixture (`QUELLIGHT_Q6_NATURAL_FIXTURE_FILE`;
  absolute, outside the repository and `.quellight-data`, <= 12,288
  UTF-8 bytes, no NUL; never committed, echoed, or reported — only byte
  length + SHA-256 as evidence), discretionary negative, governed
  ceremony + restart, fresh-thread continuity, hypothetical conflict —
  and the live harness became a parent/worker lifecycle: the worker
  runs every composition and provider turn; the parent scans for the
  credential, re-verifies the fixture identity, and disposes the owned
  root ONLY after the worker exits (the adopted worker API carries no
  deletion capability; cleanup failure remains proof failure; all S-1/S-2
  protections preserved). Three new permanent suites (38 tests) and a
  strengthened `verify:q6` (107 checks) cover the policy, the fixture
  boundary, and the lifecycle deterministically with a SYNTHETIC
  non-personal fixture. The authoritative offline ladder ran green on
  the committed tree `67d5223…` (npm ci, verify:consumer,
  verify:quellight, verify:stage7c, npm audit 0 vulnerabilities, git
  diff --check). **Execution 3 is PREPARED — NOT EXECUTED**; it
  required a separate owner invocation after review. Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-PREPARATION.md`.
  Execution 3 was subsequently authorized and EXECUTED EXACTLY ONCE on
  the same day (tree `e0f2797…`) and FAILED truthfully: turn t1
  (explicit positive control) completed in 18,567 ms within every
  frozen bound, but the model's capability attempts were each rejected
  by the host tool-input validator at the frozen proposal-row contract
  boundary (empty and single-field shapes) — 0 durable invocations, 0
  proposals — and the matrix then crashed at the fresh-thread boundary
  on a worker API defect (`sharedWorld.restoreThread` is not a
  function), aborting before the restart, continuity, and conflict
  controls could run. 1 of 6 turns used; the external fixture survived
  byte-identical; the credential scan completed clean; the owned
  workspace was disposed after the worker exited (the parent/worker
  lifecycle correction held; the Windows dispose failure of
  Executions 1–2 did not recur). NOT rerun; no correction implemented
  in that task; no diagnostic provider call made. Record:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-EXECUTION-3.md`.
  Q7 remains BLOCKED — NOT BEGUN; no fourth live execution is
  authorized.

- **Phase Q5 — Shared World inspection and user memory control The pinned capability advanced to
  `qlt.proposal.draft@2` with the truthful effect class `write` (the
  durable, epistemically inert proposal-row creation); the composition
  supplies the EXACT host-owned quiet-write approval policy
  (`qlt.host-policy.quiet-write@1`, one exact entry) through the trusted
  bridge-dependency channel only; the agent profile advanced to revision
  4; every invocation durably records effect truth, the approval
  decision, and the closed-code disposition under
  `vict-effect-policy@1`; a quiet proposal write creates zero approval
  rows, zero approver identities, and zero awaiting-approval events;
  the ceremony, memory modes, inspection, context assembly, and agent
  isolation are unchanged. Adopted set:
  `vict-release-set@1/0.3.0-rc.1` (candidate tag `vict-0.3.0-rc`;
  `latest` remains `0.2.0`; stable `0.3.0` not yet published). The
  authoritative ladder (`npm ci`; `verify:consumer`; `verify:quellight`
  incl. the real offline conversation/ceremony browser path;
  `npm audit --omit=dev`; `git diff --check`) ran exactly once,
  first-run green at `0fb4050…`. Record:
  `docs/report/QUELLIGHT-STAGE-07C-M-1-REMEDIATION.md`; decision
  register D-Q-M1-1. M-1 is NOT independently verified and NOT closed;
  Phase Q6 has not begun.

- **Phase Q5 — Shared World inspection and user memory control
  (2026-09-20): VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
  (initial audit NOT VERIFIED — B-1/H-1; remediated per the frozen
  remediation contract, independently re-verified at `6cf7dcd…`, and
  formally closed at `6088fc3…`).** Contract freeze `e2d8436…` (committed alone;
  frozen declarative modules `src/lib/sharedworld/policy-contract.ts`
  and `src/lib/sharedworld/inspection-contract.ts`; dated Q4-AMEND-1
  committed inside the freeze per the owner's Q5 instruction:
  `scope-excluded` added to the frozen exclusion vocabulary and the
  assembler version advanced to `q5-1` — the Q4 fingerprint ALGORITHM
  unchanged) and implementation report
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-MEMORY-INSPECTION-IMPLEMENTATION.md`
  (executable verification SHA `a2d1f27…`). Q5 delivers: additive
  migration 4 (`qlt-memory-mode-policy`: the durable product-default
  Memory Mode singleton + the immutable per-turn applied-policy evidence
  family); owner decision Q5-OD-1 (D-Q5-1) — ONE durable global Memory
  Mode with exactly `Across conversations` (default; Q4 behavior
  byte-preserved) / `Within each conversation only` (global and
  other-conversation records excluded with truthful bounded
  `scope-excluded` evidence) / `Memory off` (zero injection, truthfully
  evidenced) — changed ONLY inside the user-opened Memory surface via
  the declared, user-attributed, idempotent `act.setMemoryMode`
  (`QLT_MEMORY_MODE_INVALID` on invalid modes; same-key retries replay,
  same-key different payloads conflict); the effective mode is resolved
  INSIDE the per-conversation admission critical section, carried
  immutably in the turn assembly scope, and recorded as immutable
  per-turn evidence — a mode change never reinterprets an admitted turn,
  and the current setting never reinterprets history (pre-policy turns
  report `unrecorded`); the resolution is centralized behind ONE typed
  policy resolver (the documented future project-scope extension seam —
  prepared, NOT implemented; no projectId fields, project tables,
  selectors, UI, or placeholders exist); the read-only
  `qlt.inspection@1` surface (`act.queryInspection`: bucketed record
  listing, record lineage, per-turn assembly listing and detail with the
  applied mode, historical selected versions, truthful tombstones, and
  bounded-exclusion disclosure) and the ONE-mutation
  `qlt.memory-policy@1` surface, exposed ONLY through the released read/
  mutation boundary (agent identities refused; no context envelope,
  markers, prompts, capability schemas, provider data, or credentials in
  any output; no durable effect from a read); the quiet four-area Memory
  surface (Pending / Current / History / Used for reply) with the
  lifecycle controls (Correct, Retire claim, Release commitment,
  Resolve/Abandon/Transform — reason-required exits inline, never
  browser-native dialogs), the always-present Memory chip, desktop side
  tray / responsive non-modal sheet, real Escape-to-close with focus
  return, and the quiet line's new frozen off state; the action
  inventory 19 → 21 with `bindings.capabilities` still empty (the agent
  envelope remains EXACTLY `qlt.proposal.draft@1` — no inspection,
  listing, search, decision, or Memory Mode authority); the narrow L-3
  repair (correction-kind confirmation no longer duplicates the
  successor's source-thread link; exactly one successor and one
  applicable link; replay converges; the capability still rejects
  correction proposals); and the permanent zero-warning development-
  start gate (`verify:dev-start` fails on every project Svelte warning;
  the three D-11 deferred warnings repaired). Verification: the
  authoritative ladder passed in full on the untouched tree (`npm ci`;
  `verify:consumer`; `verify:quellight` incl. the 71-check `verify:q5`
  and the EXTENDED real-browser ceremony session with all Q5 scenarios,
  axe clean with the Memory surface open on both viewports;
  `npm audit --omit=dev` 0 vulnerabilities; `git diff --check`) — one
  initial `npm ci` attempt was interrupted by an environmental file lock
  and the subsequent complete frozen-tree sequence passed (corrected
  2026-09-20; see the verification-isolation remediation report).
  Post-Q5 narrow remediation (2026-09-20): the D-11 development-start
  gate had indirectly composed the application against the default
  operator data directory (applying additive migration 4's CREATE-only
  schema during the ladder; new tables empty, existing rows intact) —
  remediated by the typed `QUELLIGHT_DATA_DIR_ABSOLUTE` seam and a fully
  isolated `verify:dev-start` (task-owned OS-temporary data directory,
  fail-closed guards, read-only store proof, permanent guard control,
  verified cleanup on success and failure); the real operator database
  was not accessed during the remediation. See
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-VERIFICATION-ISOLATION-REMEDIATION.md`.
  Post-Q5 audit remediation (2026-09-20): the Phase Q5 independent audit
  returned NOT VERIFIED (B-1: inspection `getPolicy` durably seeded the
  default row on a fresh store — a read with a durable effect; H-1:
  terminal proposals rendered in the Current bucket; M-1: the read-purity
  and bucket coverage was vacuous). Remediated exactly per the frozen
  remediation contract
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-CONTRACT.md`
  (contract commit `c873692…`): read-side policy resolution is now
  durable-effect-free (`peekCurrent`/`peekPolicyRow` pure peeks resolve
  the implicit default in memory; `ensureCurrent` is the only write-path
  establishment; the read-sounding writers were removed); the `getPolicy`
  response is truthful for the implicit default (nullable `updatedAtMs`,
  `persisted: false`); the inspection buckets branch explicitly with no
  fallback (Pending holds only pending proposals; Current holds only
  canonical current-effective records and never any proposal status;
  History holds terminal proposals plus non-current records); and the
  vacuous controls were replaced by permanent non-vacuous read-purity
  and bucket-composition coverage in the Q5 suites, `verify:q5` (86
  checks), and the extended browser ceremony. See
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION.md`.
  Carried: M-1 unchanged with its hard deadline; L-R1/L-R2 unchanged;
  the Q3 §12 correction-proposal deferral remains.
  Fresh independent re-verification and FORMAL CLOSURE (2026-09-20): the
  re-verification at commit `6cf7dcd…`
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-INDEPENDENT-RE-VERIFICATION.md`)
  returned `VERIFIED WITH NON-BLOCKING ISSUES — Q5 FORMAL CLOSURE
PERMITTED` (0 Blocking · 0 High · 0 Medium · 2 Low carried · 0 new
  findings): both original defects independently reproduced at the
  audited SHA `d61532d…` and proven absent on the remediated tree
  (B-1 read purity incl. full write-path seeding/revision semantics;
  H-1 truthful bucket matrix, filters, pagination, tie-break, refusals),
  the permanent coverage proven non-vacuous (12/31 discriminating
  failures against the audited SHA; 31/31 green on the remediated tree;
  `verify:q5` 86 checks), and the authoritative ladder green exactly
  once with the browser ceremony passing on its first and only run.
  Phase Q5 is FORMALLY CLOSED
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-FORMAL-CLOSURE.md`).
  Carried through closure: L-1, L-2, L-R1, L-R2, the pending-correction
  fixture limits, the Q3 §12 correction-proposal deferral,
  D-FUTURE-STEERING-1, and VICT-M-1 (hard deadline before the Phase Q6
  live-provider proof). Future project-scoped conversations remain
  prepared for — NOT implemented. Phases Q6–Q7: planning permitted —
  NOT begun.
- The retained dependency is now the immutable coordinated release set
  `@victframework/*@0.2.0` (`vict-release-set@1/0.2.0`, content ID
  `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`),
  adopted in Phase Q1 through the controlled compatibility change D-10
  (independently re-derived from the public registry; see
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md`).
  Phase Q1 is independently verified (verdict `VERIFIED WITH
NON-BLOCKING ISSUES — PHASE Q1 FORMAL CLOSURE PERMITTED`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`)
  and FORMALLY CLOSED
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md`; VICT
  constitutional closure at `0f4f72b0812bdfa40229a170f4d97e9696f72dd9`,
  System Reference v0.4.13, §0.21). The prior sets (`0.1.0`, `0.1.1`)
  remain published and installable but are not adopted; any later change
  requires an explicit compatibility decision and fresh verification.
- The F-8 `app.data.mutate` payload gap (entry gate D-9) was resolved by
  VICT Stage 07C Phase F2/F3 and closed by the Phase Q1 adoption:
  thread mutations now cross the released governed mutation envelope.
  The historical Stage 07B `/api/act` direct-adapter accommodation is
  retired; `/api/act` is a thin transport ingress (D-10). The retired
  parallel mutation shortcut is removed and permanently gated.
- Phase Q1 is formally closed against the independent verification.
  Phase Q2 — the durable Shared World schema foundation — is
  independently verified (2026-09-16; verdict `VERIFIED WITH
NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`, audit commit
  `95f03699572b7597be0bbe933964f0207e549c44` against the audited
  implementation SHA `9076fb0dbfdb15beeebef64adaa4f699ba9b60b5`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`)
  and FORMALLY CLOSED (2026-09-16;
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md`;
  implementation evidence at
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`,
  frozen contract at
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`):
  additive migration 2
  (`qlt-meaning-foundation`) creates the proposal/ceremony, epistemic
  claim, commitment, open loop, correction-lineage, and source-link
  record families (retention metadata on every table); the closed
  validators reject unknown/prototype/oversized/non-serializable input
  (the Q2-contract FENCE-1 condition); the `SharedWorldMeaningStore`
  repository enforces atomic ceremony/correction transactions, keyed
  idempotency, optimistic versions, user-only confirmation and
  correction identity, version-eligibility (never elapsed-time)
  proposal staleness, append-only lineage, and deterministic
  current-effective resolution; a permanent adversarial suite plus the
  focused `verify:q2` gate (wired into `verify:quellight` step 2c)
  enforce it. The audit independently reproduced the adversarial surface
  (75/75 checks) on top of the complete first-run ladder and found zero
  Blocking/High/Medium issues. Q2 wires NO production meaning or
  confirmation path — no proposal/ceremony action, route, UI, agent tool,
  or context assembly exists; the repository is exercised directly by
  tests only; any future effectful write uses the governed VICT 0.2.0
  boundary adopted in Q1. Phase Q3 contract and implementation planning
  is permitted but has not begun; Phases Q4–Q7 have not begun; Shared
  World meaning and ceremony implementation has not begun. (Superseded
  2026-09-16: Q3 is implemented, independently verified, and formally
  closed — see the Phase Q3 entry below; the carried FENCE-1 Low finding
  was resolved in Q3 as D-Q3-6 and the TEST-1 Low debt was satisfied by
  the permanent real-browser ceremony recovery proof; both were
  independently verified closed.)
- Non-blocking debt carried forward: F-3 (open Low, `VICT_`-prefixed
  display-only code), F-4 (open Low, historical implementation-report
  placement), F-5 (open Low, cosmetic verifier output), F-6/F-7
  (informational, development-only); from Phase Q1: FENCE-1 (open Low —
  prototype-named unknown fields silently dropped at the existing Q1
  ingress, proven harmless by the audit; the Q1 ingress itself is NOT
  modified by Q2, while every NEW Q2 Shared World input contract now
  defines explicit closed-field and prototype-key rejection behavior, as
  that finding required; this observation remains separately open — Q2's
  safe new contracts do not retroactively close it) and TEST-1 (open Low
  — no permanent browser-level replay-recovery test; must be resolved no
  later than Phase Q3 verification, before the confirmation ceremony is
  accepted as reliable); from Phase Q2: F-Q2-1 (Low — historical
  prose-index erratum: the frozen contract §2 and the implementation
  report §6 name fifteen of the sixteen indexes, omitting
  `idx_qlt_correction_subject`; the normative machine-readable inventory,
  migration DDL, and 139 schema-introspection checks contain and enforce
  all sixteen — a documentation erratum, NOT a schema defect; frozen
  documents are not rewritten) and F-Q2-2 (Low — withdrawal is
  user-attributed-only in this schema revision while frozen contract §8.2
  prose admits either identity; strictly narrower, no excess authority,
  no production withdrawal path exists; Phase Q3 must explicitly decide
  withdrawal initiation and attribution before wiring any withdrawal
  action and must not silently reinterpret the frozen discrepancy).
  Binding Q3 inputs also include real turn correlation before production
  enforcement of the one-open-proposal-per-turn rule (NULL turn
  references remain distinct). DOC-1 (the stale 0.1.0 statement in this
  document) was resolved at formal closure. F-1, F-2, and the missing
  independent live proof are remediated/resolved and independently
  verified closed.
- Phase Q3 — the governed confirmation ceremony and quiet memory inbox —
  was independently verified on 2026-09-16 (verdict
  `VERIFIED WITH NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`, audit
  commit `a8b702f…`,
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-INDEPENDENT-VERIFICATION.md`;
  zero Blocking/High findings; carried non-blocking findings M-1/M-2/M-3
  and L-1/L-2/L-3) and is FORMALLY CLOSED
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-FORMAL-CLOSURE.md`; audited
  implementation tree `2e494723…`; audited executable SHA unchanged;
  Q4 contract and implementation planning is PERMITTED and NOT BEGUN).
  Reports:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md` (with
  dated amendments A-AMEND-1…4),
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`,
  and the independent verification / formal closure reports above.
  Carried obligations: M-1 the disclosed `read` effect-class metadata on
  the pinned capability (framework-change proposal owed to the VICT
  owners; the durable invocation record shows `effect:'read'` for a
  durable creation until it lands); M-2 the frozen Escape-to-close
  interaction item is unimplemented (Close control and focus-return
  exist; truthful test owed in the next inbox change); M-3 process
  discipline — commit `8dc0032` bundled the A-AMEND-2 amendment with
  Lane C's UI/test implementation (content verified conformant); L-1
  documentary errata (amendment lane misname; `id DESC` tie-break vs the
  frozen `id ASC` text; extra accepted sort field `createdAt`); L-2 the
  real browser never exercises a stale proposal end-to-end (stale badge
  component-proven, refusal node-proven per the frozen containment map);
  L-3 the implementation report's changed-file inventory erratum
  (claims 22 files +6106/−93; actual 26 files +6551/−102).
  Q3 delivers: the `qlt.memory@1` application resource (one query +
  thirteen mutation ops; a 19-action plan inventory gated by the focused
  `verify:q3` check, wired into `verify:quellight`); exactly one pinned
  agent capability `qlt.proposal.draft@1` (profile revision 2,
  `maxToolCalls: 2` fail-closed budget-gated, server-derived
  turn/thread correlation, one open proposal per thread/turn/kind,
  keyed idempotency, zero Shared World read or decision power for the
  agent); the quiet memory inbox inside the existing conversation
  workspace (user-opened tray; never a modal, never auto-opened, never
  focus-stealing, never blocking; Confirm/Edit/Reject/Withdraw; direct
  "Remember this" Save; user correction; stale/already-decided/
  validation states; keyboard and screen-reader support); the API-level
  lifecycle exit verbs (claim retire, commitment release, loop
  resolve/abandon/transform; dedicated UI exits remain deferred to Q5);
  FENCE-1 ingress hardening (D-Q3-6) with the stable
  `QLT_INGRESS_PROHIBITED_FIELD` code and permanent regression controls;
  and TEST-1, the permanent real-browser ceremony recovery proof
  (`scripts/browser-ceremony-check.mjs`; `verify:quellight` step 6c).
  Owner decisions for Q3 are D-Q3-1…D-Q3-6 (see the decision register):
  user-only durable withdrawal (resolving the F-Q2-2 discrepancy
  explicitly), the quiet never-blocking inbox, Confirm/Edit/Reject/
  Withdraw with edit=amend, direct Save as immediate canonical
  confirmation, API-level exit verbs without Q3 UI, and FENCE-1. The
  agent still cannot read, list, search, or assemble confirmed Shared
  World material — that remains superseded by the Q4 entry below.
- **Phase Q4 — deterministic Shared World context assembly (2026-09-16):
  IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (not verified, not
  closed).** Contract freeze `b4bf759…` (frozen data module
  `src/lib/sharedworld/context-contract.ts`; no amendments) and
  implementation report
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTEXT-ASSEMBLY-IMPLEMENTATION.md`.
  Q4 delivers: additive migration 3 (`qlt-context-assembly`; immutable
  per-turn assembly record, UNIQUE turn_id, deterministic SHA-256
  fingerprint, outcome/failure CHECK); the deterministic assembler
  (three selection layers current-thread → global → other-thread,
  classes open_loop → commitment → claim, `updatedAt DESC, id ASC`
  (L-1), budgets 8 records / 4096 UTF-8 bytes with whole-record
  skipping, closed exclusion vocabulary incl. structured-identity
  `conflict-ambiguous` groups (D-Q4-4)); the model-seam injection as ONE
  user-role message (one text part) immediately before the trailing user
  message, call-scoped, with server-derived turn correlation from
  durable open-turn records, frozen-snapshot replay across multi-call
  turns, retry convergence, and fail-closed identity ambiguity; the
  delimiter-safe serializer (content escaping makes `<`, `>`, `&`, and
  `/` unrepresentable inside record content; hostile confirmed content
  remains quoted data with zero authority); zero-transcript-pollution
  proofs; the quiet tray transparency line (used/none/unavailable) via
  the read-only `/api/threads/[id]/assembly` route (D-Q4-6); M-2 closed
  (real Escape-to-close with focus return, component- and browser-
  proven); L-2 proven in the EXTENDED real-browser ceremony script
  (stale refusal through the real governed boundary; one disclosed
  seeding fixture); L-3 Git-derived inventory independently re-derived
  and compared by the new `verify:q4` gate (`verify:quellight` step 2e);
  the Q3 §12 correction-proposal deferral remains beyond Q4. M-1 stays
  recorded with its hard deadline (before the Phase Q6 live-provider
  proof and the Stage 07C final audit). The agent envelope remains
  EXACTLY `qlt.proposal.draft@1`; no read/list/search capability exists.
  Live-model injection resistance remains Q6. Q5 has not begun.
- **Phase Q4 H-1 remediation independently re-verified; Q4 FORMALLY
  CLOSED (2026-09-17): Q4 VERIFIED WITH NON-BLOCKING ISSUES —
  FORMALLY CLOSED.** The fresh independent re-verification
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-INDEPENDENT-RE-VERIFICATION.md`,
  audit commit `e0e0f19…` against the untouched remediated tree
  `6fd1ba8…`) independently reproduced the original H-1 crossover on
  the audited tree `c4896bef…` (in-flight promise borrowing, snapshot
  substitution with a post-freeze canary, false durable `complete`
  evidence, transparency corruption) and proved it DEAD on the
  remediated tree — the same staging fails closed (`pass/ambiguous`
  where the old seam injected). Independently verified: race-safe
  admission over the REAL turns ingress (eight simultaneous distinct
  keys → exactly one durable turn and seven `QLT_TURN_ALREADY_OPEN`
  refusals with deep zero effect; check+start serialized per
  conversation; different conversations concurrent; terminal-turn
  recovery; dispatch-failure resilience; no queuing machinery);
  VICT idempotency preserved exactly (same-key replay during and after
  settlement; seeded pending-receipt live-lease answers the truthful
  in-progress disposition; digest conflict; cross-conversation key
  reuse refused; stale failed receipt replays deterministically; no
  client-controlled field becomes turn-identity or memory authority);
  the complete seam-state matrix (zero / exactly-one-record-less /
  exactly-one-recorded / every ≥2 combination including in-flight and
  three-plus / reversed ages → ambiguous, zero injection, no promise
  borrowing, no new assembly; no cross-scope leakage; junk scope fields
  ignored); restart reconciliation truthfully settling interrupted
  turns with the durable fence rejecting stale settlements
  (`VICT_CONTROL_TURN_INVALID_TRANSITION`) and the rule reapplied;
  failure truth (a failing model settles `failed`, no fabricated
  transcript, truthful assembly evidence); and the quiet refusal UX on
  the real island (message withdrawn, draft restored, exact sentence,
  no modal, no tray, no focus theft, one ingress request, clears on
  transition). Verdict: `VERIFIED WITH NON-BLOCKING ISSUES — Q4 FORMAL
CLOSURE PERMITTED` (0 Blocking · 0 High · 0 Medium · 2 Low ·
  2 Observations); carried: L-R1 (per-conversation critical-section
  settled-entry retention — one settled promise per distinct
  conversation id, ≈102 B/entry, tail replaced per request, unbounded
  only in the lifetime conversation-count axis; revisit trigger: any
  future multi-tenant/long-lived-server shape) and L-R2 (the now
  unreachable `no-open-turn` pass-reason member; cosmetic), both with
  dispositions in the closure report. The authoritative ladder ran
  green first-run on the untouched tree (`npm ci`; `verify:consumer`;
  `verify:quellight` incl. the 41-check `verify:q4` and the H-1 suite;
  `npm audit --omit=dev` 0 vulnerabilities; `git diff --check`).
  Formal closure:
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-FORMAL-CLOSURE.md`.
  Disposition: `QUELLIGHT STAGE 07C PHASE Q4 VERIFIED WITH
NON-BLOCKING ISSUES — FORMALLY CLOSED`; future turn steering remains
  RECORDED — NOT IMPLEMENTED; Phase Q5 contract and implementation
  planning is permitted — NOT BEGUN (inherits M-1's hard deadline and
  the L-3 backlog item); Stage 07 remains In Progress.
- **Phase Q4 H-1 remediation (2026-09-16): H-1 REMEDIATED — AWAITING
  FRESH INDEPENDENT RE-VERIFICATION (Q4 not Verified, not closed).** The
  independent verification (audit commit `821d4f8…`) found the High
  finding H-1 (same-conversation turn-overlap snapshot crossover) and
  permitted no closure. The owner decision made the rule binding —
  **exactly one active agent turn per conversation; a distinct request
  arriving while a reply remains active is rejected truthfully and
  creates no second turn; a retry of the same logical request preserves
  VICT's existing idempotent replay behavior** — and the remediation
  contract
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION-CONTRACT.md`,
  committed alone before any executable change) froze the state matrix.
  The remediation
  (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION.md`)
  implemented BOTH layers: (1) race-safe admission control at the
  Quellight-owned turn-start boundary (`src/lib/server/
turn-admission.ts`; the turns route wraps the dispatch): the admission
  decision and the durable turn start are atomic for the supported
  single-process deployment (a per-conversation critical section — the
  dispatch that durably creates the turn intent runs INSIDE the
  section, so a concurrent admission decision for the same conversation
  can never interleave); a distinct overlapping request is refused with
  the stable, non-echoing code `QLT_TURN_ALREADY_OPEN` and ZERO effect
  (no VICT intent, no model call, no assembly, no transcript message,
  no Shared World effect), surfaced quietly in the workspace (a quiet
  banner and polite announcement — no modal, no tray opening, no focus
  change; the optimistic local message is withdrawn and the composer is
  restored; nothing is queued); same-key retries pass through to VICT's
  truthful idempotent disposition unchanged (replay / in-progress /
  digest conflict), so a legitimate same-key replay is never
  misclassified; different conversations run concurrently. (2) A
  model-seam defensive backstop in `resolveForStream`: attribution
  requires EXACTLY ONE attributable open turn for the conversation and
  actor — exactly one record-less turn assembles, exactly one recorded
  turn replays, zero open turns pass through, and ≥2 open turns in ANY
  recorded/unrecorded/in-flight combination fail closed with zero
  injection, no per-turn in-flight promise borrowing, and no new
  assembly (no falsely attributed record) — effective even when the
  admission invariant is bypassed through a direct internal call, test
  fixture, future route, or corrupted state. The permanent regression
  suite `test/turn-overlap-isolation.test.ts` (11 tests; real stores,
  real route handler, deliberately delayed offline model) locks the
  frozen state matrix. Audit-finding dispositions carried by the
  remediation documentation pass: L-1 (the duplicated Q3 status line in
  this document and the README) corrected additively by this pass; L-2
  (implementation-identity lag) reconciled additively — the Q4 audited
  implementation tree is `c4896bef…` (executable content unchanged
  since `bf7fec3`), the audit-report commit is `821d4f8…`; L-3
  (pre-existing Q3 latent defect: correction-kind proposal confirmation
  through `confirmProposal` always rolls back `QLT_RECORD_EXISTS` due
  to a duplicate source-thread link; the active production correction
  path remains `applyCorrection`) recorded as a Q5/backlog obligation
  ONLY and NOT repaired here; O-1/O-2/O-3 preserved as observations;
  the pending-correction fixture limitation and the Q3
  correction-proposal deferral preserved; M-1 unchanged with its hard
  deadline (before the Phase Q6 live-provider proof and the Stage 07C
  final audit). A FUTURE turn-steering direction is RECORDED in the
  decision register as a deferred design input (explicit operation
  targeting the exact active turn — never a second overlapping turn;
  requires its own future contract covering target-turn identity,
  append-vs-restart semantics, durable event/transcript truth,
  idempotency, restart/reconnect, context-snapshot consequences,
  provider support, and user-visible state); steering, queuing, and
  parallel replies are NOT implemented.
- The status sections below describe the delivered Stage 07B behavior;
  `docs/stage-07b-report.md` is the preserved historical implementation
  report (its issuance-time status wording is superseded by this
  section).

## What Quellight is

A single-user, conversation-first workspace. One SvelteKit process
hosts the product surface **and** composes the VICT runtime in-process;
all VICT boundaries are consumed as released `@victframework/*@0.2.0`
packages — the exact immutable coordinated release
`vict-release-set@1/0.2.0` adopted and verified in Phase Q1 — from the
public registry.

## Ownership boundaries (canonical)

| Layer                                  | Owner                                    | Contents                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conversation execution & delivery      | **VICT**                                 | turn lifecycle, streaming, sequencing, idempotency, cancel/restart semantics, protected operator configuration                                                                                         |
| Transcripts & in-flight working memory | **Mastra** (via `@victframework/mastra`) | dedicated conversation store; replaceable caches                                                                                                                                                       |
| Durable partnership material           | **Quellight**                            | Shared World SQLite store (`qlt_thread` family + the Q2 meaning families: proposals/ceremony records, epistemic claims, commitments, open loops, correction lineage, source links; retention metadata) |

**Transcript survival is not Shared World continuity.** No epistemic
claims, commitments, open loops, or agent-derived meaning existed in
07B; Q2 adds the DURABLE STORAGE CONTRACTS for those families plus
their lifecycle/lineage/eligibility rules, but still activates no
production meaning path: the agent has **no** Shared World write path
(negative-controlled), records exist only through the test-exercised
repository, and only user-ceremony-confirmed material may ever become
canonical in later phases.

## Composition (one process)

`src/lib/server/composition.ts` composes, on first use:

1. **Operator configuration** — pinned profile
   `agent.quellight.conversation@1` (instructions artifact,
   `lastMessages: 20`, `semanticRecall: false`, `workingMemory` off,
   `maxSteps: 8`, `maxToolCalls: 0` fail-closed, bounded output tokens,
   `maxRetries: 0`).
2. **Three physically separate SQLite stores** in one data dir:
   - `vict-operational.db` — VICT operational stores (actor directory,
     turn records, stream ledger, idempotency, governance);
   - `mastra/mastra-store.db` — dedicated Mastra conversation store;
   - `shared-world.db` — Quellight Shared World store.
3. **Single local actor** `actor-quellight-local` with the union of
   roles required for turn start/cancel, run/stream read, and
   application data read/write. The loopback boundary authenticates
   with a bearer token (`QUELLIGHT_ACTOR_TOKEN` or an ephemeral
   in-process token); the browser never holds it.
4. **Provider seam** — offline mode uses the deterministic fixture
   model; live mode (`QUELLIGHT_LIVE_PROOF=1` + credential present)
   uses `ModelRouterLanguageModel` with the pinned identity
   `ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`. The
   credential is resolved only through the VICT protected boundary and
   injected via the process environment just before model creation; it
   is never visible to composition code, never logged, never
   persisted.
5. **Turn deadline** — a Quellight-owned wrapper at the model boundary
   (`QUELLIGHT_TURN_DEADLINE_MS`, default 120 s) ends an over-deadline
   turn with the stable safe code `VICT_AGENT_TURN_FAILED`. It never
   fabricates or retries content.
6. **VICT loopback HTTP boundary** — `createVictHttpServer` bound to
   `127.0.0.1:0`; the only caller is this process.

## Request paths

- `/*` — SvelteKit page; renders the app plan screen with the island
  registry (`qlt.conversation-workspace@1`).
- `/vict/[...path]` — **proxy** to the loopback boundary; injects the
  bearer token server-side, allowlists headers, passes SSE through
  unbuffered.
- `/api/threads/[id]/turns` — start a turn (client idempotency key;
  resolves the Shared World thread → conversation link server-side).
- `/api/threads/[id]/messages` — VICT-authoritative restore: turn
  records (from operational stores) gate the transcript read (from the
  Mastra store). Incomplete/failed turns stay visibly marked; no
  per-message fabrication.
- `/api/act` — the ONLY non-local action ingress: a thin transport
  boundary that parses the declared request, resolves the local user
  identity server-side, and invokes the released VICT 0.2.0
  `app.data.query` / `app.data.mutate` command boundary (closed mutation
  envelope, plan-resolved action identity, contract-fenced input,
  durable idempotency). It writes no SQLite and holds no parallel
  shortcut (the Stage 07B direct-adapter accommodation is retired;
  decision register D-10). The legacy identity-only `app.data.mutate`
  payload fails closed (`QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED`).
- `/api/health` — discloses model mode, release version, deadline.

## Streaming contract

`vict.agent-stream@1` resumable SSE with cursor `v1:<streamId>:<seq>`:

- the client wire-validates **every** frame (closed envelope **and**
  closed event schema); unknown kinds, broken envelopes, or invalid
  shapes mark the stream unhealthy and halt rendering (N-7);
- duplicate delivery is deduplicated by sequence; reconnect resumes
  from the last acknowledged sequence (N-8);
- `text.delta` is transient: best-effort live delivery. The terminal
  event is the durable milestone; the UI reconciles the transcript from
  the restore boundary at terminal (D-7).

## Forced restart (N-9)

On boot the composition runs `reconcileAfterRestart()`. After a
SIGKILL: completed turns and their content survive; the in-flight turn
settles honestly (`failed`/`cancelled` with a stable `VICT_*` code);
the Shared World thread list survives; nothing is fabricated as
completed.

## Retention metadata

Shared World threads carry `retention_state`
(`currently-relevant` / `user-removed`) and timestamps. Archive maps to
`state = dormant` (read-only except reopen); deletion in 07B is
retention-metadata marking, never Shared World meaning deletion.

## See also

- `docs/database.md` — store layout and migration discipline
- `docs/setup.md` — operator configuration and credentials
- `docs/decision-register.md` — binding decisions
- `docs/stage-07b-report.md` — implementation evidence (historical;
  status superseded by the Status section above)
- `docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md` — formal closure
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md` — the
  frozen Phase Q6 verification contract
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md` —
  Phase Q6 implementation evidence (live proof blocked, credential
  absent)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md` —
  Phase Q1 implementation evidence
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`
  — Phase Q1 independent verification (audit)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md` — Phase
  Q1 formal closure
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md` — the
  frozen Phase Q2 durable-schema contract
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-DURABLE-SCHEMA-IMPLEMENTATION.md`
  — Phase Q2 implementation evidence (historical implementation record;
  status superseded by the closure below)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`
  — Phase Q2 independent verification (audit)
- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md` — Phase
  Q2 formal closure
