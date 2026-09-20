# Quellight Stage 07C — Phase Q5 — Independent Verification

> **Class:** Independent verification record (audit). This document is the
> ONLY file created by the audit. No source, test, script, package file,
> frozen contract, current documentation, or historical report was modified.
> VICT was treated as read-only throughout (its System Reference was not
> updated; `.pi/` was preserved untouched and unread).

## 0. Verdict

```text
NOT VERIFIED
0 Blocking................................................ 1
High ..................................................... 1
Medium ................................................... 1
Low ...................................................... 2
Observations ............................................. 5
PHASE Q5 FORMAL CLOSURE IS NOT PERMITTED
Q5 remains IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION / RE-MEDIATION
PHASE Q6 REMAINS NOT BEGUN
Stage 07 remains In Progress.
```

Formal closure is **not permitted** because one **Blocking** finding
(B-1, inspection read purity) and one **High** finding (H-1, Current-bucket
composition) exist, and both require **executable** remediation. The audit
ladder itself completed green on the untouched audited tree; the defects are
reachable product behaviors, not verification failures.

## 1. Chain of custody (independently established)

| Item | Value |
| --- | --- |
| Fetch | both remotes fetched first; nothing advanced |
| Quellight `HEAD == origin/main` | `d61532d9b03f562e0f431a6ac1e2128059c33d88` (verified) |
| Quellight tracked tree | clean before, during, and after the audit |
| VICT `HEAD == origin/main` | `4b9fed21430787a72eda76b1b72d448f234f05fa` (verified; read-only; pre-existing untracked `.pi/` untouched and unread) |
| Q5 starting baseline | `587e3b4d…` — ancestor of the freeze (proven) |
| Q5 contract freeze | `e2d84369bf31822762329cbb95ee9ee5b6eb02db` — a SINGLE commit (contract document + `policy-contract.ts` + `inspection-contract.ts` + the dated Q4-AMEND-1 edit to `context-contract.ts`), committed BEFORE all consuming implementation (ancestry proven; no Q5 amendment commits exist; no history rewrite — 80 commits, single linear `main`, no other branches) |
| Q5 executable verification tree | `a2d1f2725694ff28751835148db789ad7e8173d2` (descendant of the freeze; ancestry proven) |
| Documentation tip of the implementation | `f18cff8250bdac52dc37d4d4275698f3712c6966` (descendant of `a2d1f27…`) |
| Isolation remediation / audited tree | `d61532d…` = `f18cff8…` + exactly the disclosed remediation set (`scripts/verify-dev-start.mjs`, `src/lib/server/composition.ts`, `test/dev-start-data-seam.test.ts`, remediation report, two current-documentation wording corrections) |
| Conflicting Q5-closure/Q6 work | none on either remote (single-branch linear histories; no `verify:q6` step; no Q6 provider work anywhere) |
| Historical Q2–Q4 reports | working trees byte-identical to their last committed state; the frozen `meaning-contract.ts` byte-identical to its Q2 freeze; `ceremony-contract.ts` changed only by the disclosed Q3 amendment `8dc0032…` (carried Q3 M-3) and never since; `context-contract.ts` changed only in the Q5 freeze commit (Q4-AMEND-1) |
| package-lock.json | unchanged since `b802a87…` (pre-Q2); VICT pins exactly `@victframework/*@0.2.0`; release identity unchanged |
| Applicable AGENTS.md | none exists in either repository |

The freeze commit was verified to precede every consuming implementation
commit, to contain no implementation, and to be the only pre-implementation
Q5 commit. The remediation diff at `d61532d…` was read in full and matches
its declared scope exactly.

## 2. Contract, history, and inventory (audit area 1)

- The freeze document, `policy-contract.ts`, and `inspection-contract.ts`
  were read in full and used as the normative basis; conclusions below were
  derived from source and execution, never from the implementation report's
  claims.
- **Changed-file inventory re-derived from Git** (`git diff --numstat
  e2d8436..a2d1f27`): 32 files, +5927/−462 — matches the implementation
  report's inventory exactly.
- **Lane ownership**: every Q5 commit's files were checked against the
  freeze §14 map, including the ONE disclosed adjustment (all store-level
  SQL — policy, per-turn policy, and inspection READ accessors — in Lane A's
  `sqlite.ts`; Lane B consumes the committed accessors). **Lane D touched no
  production file** (its commit `9073c14…` carries only tests, scripts,
  `package.json` script wiring, and the disclosed bounded re-pins).
- **Q4-AMEND-1 verified to contain ONLY its two declared semantic changes**
  (`scope-excluded` appended to the exclusion vocabulary; assembler version
  `q4-1` → `q5-1`), both dated in-module; no other byte of the frozen
  Q2/Q3/Q4 modules changed.
- **Assembler-version `q4-1` → `q5-1` — precise byte/identity effect** (not
  accepting "algorithm unchanged" as proof):
  - CHANGES for every NEW assembly row: (a) the `assembler_version` column
    value is `'q5-1'`; (b) the `fingerprint` VALUE changes, because the
    version string is a frozen INPUT of `fingerprintOf` (canonical JSON →
    SHA-256). An identical selection produced under `q4-1` and `q5-1`
    yields different fingerprints. This is a deliberate, contract-declared
    evidence-identity change.
  - UNCHANGED under the default `across-conversations` mode (Q4-compatible):
    candidate pools, layer/class ordering, duplicate-current exclusion,
    budgets (8 records / 4096 UTF-8 bytes, whole-record skipping), the
    rendered block bytes, injection format and placement, replay/restart
    semantics, transcript non-pollution, and every pre-existing exclusion
    code (`scope-excluded` can never fire under `across-conversations` —
    proven). All Q4-era rows keep `q4-1` and their original fingerprints
    (migration 4 does not touch the assembly family; nothing recomputes).
  - Independently proven: an explicit `mode: 'across-conversations'`
    evaluation is byte-identical (selection, fingerprint, block) to the
    mode-less default evaluation (probe 03-A).
- **Documentation describes actual behavior** for the delivered scope; two
  truthfulness gaps are recorded inside findings B-1 and H-1 (the
  implementation report presents `getPolicy` among read-only operations
  without disclosing its fresh-store write, and its C-19 equivalent passed
  only vacuously). The §6a disclosure of the historical operator-data
  migration and the remediation report's §2 wording correction are honest.

## 3. Migration 4 and read purity (audit area 2) — **BLOCKING FINDING B-1**

Independently proven on disposable stores (probe 02, and probe 01 through
the real released boundary):

- Forward-only additive upgrade Q1/Q2/Q3/Q4 → 4 applies cleanly; all
  prior rows byte-preserved (full-table dumps before/after); both new
  families created EMPTY; bookkeeping `[1,2,3,4]`; restart idempotent
  (byte-state unchanged); a store carrying a newer recorded version
  refuses to open.
- Schema matches the frozen inventories (column-by-column); closed CHECK
  vocabularies enforced: invalid `mode`/`id`/`revision`/`updated_by`
  insertions all refused with zero partial effects; duplicate
  `turn_id` refused by PRIMARY KEY/UNIQUE; per-turn evidence is
  INSERT-or-converge and never updated (proven).
- Monotonic revision, user attribution (`actor-*` GLOB CHECK; agent
  identities refused at the surface and the store), value-idempotent
  `setMode` (same-value converges without a revision bump), and the
  transactional one-row update were all independently confirmed.

### B-1 (Blocking) — `getPolicy` is not read-pure on a freshly migrated store

- **Reproduction (probe 01, through the REAL released boundary** —
  `app.data.query` on `qlt.inspection` with server-derived actor, exactly
  as `/api/act` issues it): on a freshly migrated store where
  `qlt_memory_policy` is EMPTY, a single `getPolicy` query created the
  singleton default row (`[]` → 1 row; every other table and schema object
  unchanged). All other inspection ops (`listRecords` ×3 buckets,
  `listTurns`, `getRecord`, `getTurn`) were purity-verified by full-store
  dumps before/after each query; `getPolicy` after any write-path
  resolution is pure.
- **Contract violation**: frozen contract §6 lists "no durable effect from
  a read" as an unqualified requirement of the inspection surface, and the
  audit mandate names `getPolicy` explicitly. The §11 lazy-seeding clause
  declares seeding "on first resolution" — a write-path concept (turn
  admission and `act.setMemoryMode` both resolve legitimately); it does
  not truthfully declare a write effect for the `getPolicy` inspection
  read. `resolveCurrent()` resolves the frozen default **in memory** from
  a missing row is exactly what the contract permits; instead the
  implementation wires `getPolicy` → `getPolicyRow()` → `ensurePolicyRow()`
  → `seedDefaultRow()` (an INSERT). A read silently became a write.
- **Reachability**: the Memory UI's `refreshInspection()` issues `getPolicy`
  every time the surface refreshes — opening Memory on a fresh store
  writes the row before any turn admission. The effect is benign in
  content (the default row) but is a durable effect from a declared
  read-only operation, i.e. an executable contract violation.
- **Why the implementation's own gates missed it**: `verify:q5`'s purity
  check and the C-19 test compare only `listRecords bucket:current` output
  around reads — neither compares the policy row (nor full-store state),
  and both ran with the row already present. Recorded as Medium finding
  M-1 below.
- **Disposition**: BLOCKING. Requires executable remediation: `getPolicy`
  (and any inspection read) must resolve an absent row to the frozen
  default WITHOUT writing (seed only on write-path resolution), plus a
  purity regression control that dumps row state on a fresh store.

## 4. Memory Mode semantics (audit area 3) — proven

All three modes proven through the real admission wrapper, real model seam
(offline fixture), and real inspection surface (probe 03):

- **`across-conversations`** (default): all three Q4 layers selected in the
  frozen order (current-thread → global → other-thread), frozen class
  order and budgets preserved; usage `used`; byte-identity with the
  mode-less Q4 default evaluation; `scope-excluded` can never appear.
- **`per-conversation`**: only same-conversation records selected; global
  AND other-conversation records excluded with truthful, bounded
  `scope-excluded` evidence; a thread with no same-conversation memory
  yields usage `scope-empty` with the frozen label admitting exclusion
  ("Memory existed but was excluded…"), never "no memory existed".
- **`off`**: zero injection (empty outcome, empty selection, 0 rendered
  bytes); truthful immutable policy evidence recorded; inspection reports
  usage `off` with "Memory was off for this reply." and the quiet-line
  state carries the applied mode from evidence — an off turn can never be
  misreported as "no memory existed".
- Invalid modes (`sometimes`, `OFF`, `across`, empty, SQL-injection
  attempt, trailing-space) fail closed and non-echoing with the stable
  `QLT_MEMORY_MODE_INVALID` (or the boundary's contract-rejection fence);
  the policy row unchanged after all attempts; same-value retries converge
  without a revision bump; conflicting same-key payloads fail with the
  stable `VICT_COMMAND_IDEMPOTENCY_CONFLICT` at the released boundary.
- Policy revisions behave as frozen (first effective change seeds→rev 2;
  later changes bump monotonically; no bump on same-value).
- Turns cannot accept a client/model/agent-supplied mode or scope target:
  unknown fields in the turn command payload are rejected outright
  (`VICT_COMMAND_PAYLOAD_INVALID` — fail closed, no turn), and the real
  turns route constructs the payload from validated `input` +
  `idempotencyKey` only; the scope is Quellight-owned with the admission
  wrapper as its only constructor.

## 5. Per-turn binding and concurrency (audit area 4) — proven at the timing boundary

Probe 03-E used a gate INSIDE the admission wrapper (turn admitted, dispatch
parked before any model call) to test the timing boundary, not merely final
states:

- Policy captured for a newly admitted turn inside the per-conversation
  critical section (scope installed by the wrapper).
- **Policy changed AFTER admission but BEFORE the first model call**: the
  in-flight turn retained its admission-bound mode — assembly and immutable
  evidence reflect `across-conversations` rev 1 (global record still
  selected) while the durable current policy was already `per-conversation`
  rev 2. Reading the mutable current setting during a later model call is
  structurally impossible (the scope value is immutable; the assembler
  consumes only the scope value; the evidence row is written once).
- **Global policy change while turns in two conversations were in flight**:
  each turn kept its own bound mode; different conversations remained
  concurrent (the second completed while the first was parked in-gate).
- **Later turns used the new policy** (rev 2, per-conversation selection
  with `scope-excluded` evidence).
- **Multiple model calls / retries and replay**: the frozen assembly record
  and evidence row are immutable across the replay window (a conflicting
  re-write does not replace the frozen record; evidence row converges).
- **Restart/reconciliation**: after closing and re-composing over the same
  data directory, current policy durable (rev 2), both turns' historical
  evidence unchanged, `getTurn` reports each turn's OWN applied policy —
  history is never relabelled with the current setting; subsequent policy
  changes leave recorded evidence byte-identical.
- **Stop and failure**: the browser Stop proof (F-1) reran green in the
  ladder (browser-stop-check PASS). Failure BEFORE assembly (probe 03-G):
  a pre-dispatch failure leaves zero fabrication — no assembly rows, no
  evidence, `listTurns` empty, `getTurn` truthfully `QLT_INSPECTION_TURN_MISSING`.
- **Reachability of false explanation**: evidence is recorded at first
  assembly only; a turn that never assembles is absent from inspection
  (truthful absence; it cannot be explained falsely). The `unrecorded`
  usage state is defensively defined but unreachable through the current
  inspection surface (Low finding L-1).

## 6. Project-scope preparation without implementation (audit area 5) — proven

- `memory-policy.ts` is the ONE typed resolver; the assembler consumes only
  the resolved policy carried by the scope; no global-setting conditional
  exists in routes, UI, or selection code (the UI's mode control writes
  through `act.setMemoryMode` and reads state via `getPolicy`; it performs
  no resolution).
- The durable global policy is a product default a future additive scope
  mechanism could resolve against; per-turn evidence carries stable policy
  identities and revisions.
- Structural negatives: no `projectId`, no project tables/selectors/UI/
  placeholders, no client scope identities, no precedence semantics
  anywhere in the tree; current documentation claims preparation, never
  support.

## 7. Inspection surface (audit area 6) — proven except H-1

All five ops exercised through the real released boundary (probe 04):

- Deterministic `updatedAt DESC, id ASC` ordering (repeat-query identity);
  bounded pagination (default 50 / max 100; `limit=500`, negative,
  non-numeric, and oversized-offset inputs refused; pages disjoint with
  exact totals); closed filter vocabulary with unknown/forged fields
  refused (`QLT_INSPECTION_UNSUPPORTED_QUERY`); missing-parameter
  `QLT_INSPECTION_MISSING_PARAM`; missing record/turn →
  `QLT_INSPECTION_RECORD_MISSING` / `QLT_INSPECTION_TURN_MISSING`;
  cross-thread turn access refused (mismatched pair = missing, never a
  leak); traversal and injection-shaped ids refused with the store intact.
- Server-resolved user authority; no client-selected actor field exists
  (filter keys are closed); agent identities refused at every surface
  (zero durable effect).
- Correct Pending/Current/History classification and exact
  provenance/correction lineage: `getRecord` carries predecessor status,
  successor ids, the correction row (reason/corrector/time), and links;
  lineage is append-only (predecessor content bytes immutable after a
  correction; successor a new row).
- Historical selected-record versions and injection order immutable:
  after a correction, `getTurn` still shows `selectedVersion: 1` with the
  PRE-correction bytes and `supersededSince: true`; repeat reads identical
  (no recompute).
- Bounded exclusions with explicit truncation disclosure
  (`exclusionsAreBoundedSubset: true`, `excludedBeyondCount` populated at
  the frozen 64-entry bound; every entry humanized with a stable reason
  label).
- Missing/removed content: retention-removed selected records render the
  truthful `removed` tombstone with `content: null` (never the successor's
  content); a vanished row would render `unavailable`.
- **Zero durable effect from every read EXCEPT B-1** (see §3).
- Never-contains: 18 canaries (credential variable name, provider endpoint,
  credential/secret/token/password words, system-prompt sentences, context
  markers and framing, capability/contract strings) verified ABSENT from
  every reachable inspection response.
- **H-1 (High) — terminal proposals render in the Current bucket.**
  `listInspectionRecords` adds `qlt_proposal` rows to EVERY non-`pending`
  bucket: for `bucket: 'current'` the proposal status list is the TERMINAL
  set (`confirmed/rejected/amended/withdrawn`), so decided proposals are
  returned as Current rows and the pagination `total` is inflated. The
  Memory UI's Current tab issues exactly this query (no `threadId`, no
  `kind` filter), so a decided proposal renders inside the CURRENT area —
  the area frozen to mean "current-effective canonical memory ONLY"
  (freeze §3.2, §6 buckets; acceptance row C-01: "Current never contains
  proposals"). Negative control (probe 07) with the EXACT UI query shape
  after one user-confirmed proposal: `current` returned
  `["proposal:confirmed"]` alongside the canonical claim (total 2 vs 1
  canonical). The implementation's own C-01 test and the `verify:q5`
  bucket checks pass only vacuously — they run against stores containing
  no decided proposals. No injection/authority/data-loss impact (the
  assembler never scans proposals), but the phase's core truthfulness
  promise for the Current area is violated and executable remediation is
  required: the proposal branch must run ONLY for the `pending` and
  `history` buckets, plus a non-vacuous regression control.

## 8. Lifecycle UI and L-3 (audit area 7) — proven

Probe 05, everything through the real governed boundary (`/api/act`
command shapes on the released VICT 0.2.0 boundary):

- Confirm (proposal → active claim), Reject (terminal, never canonical),
  Amend/Edit (declared action, same boundary), Withdraw (declared),
  Correct (creates successor; predecessor bytes unchanged), Retire claim,
  Release commitment, Abandon loop (reason REQUIRED — refused without),
  Transform loop — all successful paths verified; stale/terminal targets
  fail truthfully (`QLT_PROPOSAL_ALREADY_DECIDED`); same-key retries
  converge (truthful replayed receipts); conflicting same-key payloads
  fail with `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; every failed attempt left
  zero partial effects.
- L-3 repaired exactly as frozen: a pending correction-kind proposal —
  seeded at the disclosed repository-level fixture boundary (production
  wires no pending-correction path) — confirmed via the REAL
  `act.confirmProposal` creates EXACTLY ONE successor with EXACTLY ONE
  applicable `source-thread` link and exactly one `proposed-from` link
  (link set: `supersedes`, `source-thread`, `proposed-from`); replay
  converges; predecessor content bytes unchanged; lineage append-only and
  inspectable (`getRecord`: one correction, one successor); conflicting
  same-key confirmation fails with zero partial effects. Pre-Q5 this
  rolled back with `QLT_RECORD_EXISTS`; the repair is confined to
  `meaning-store.ts` `confirmProposal`.
- The agent capability STILL rejects `proposalKind: 'correction'`
  (`accepted: false, QLT_INPUT_REJECTED`, zero durable effect); no new
  agent authority exists.
- Lifecycle UI (four-area surface) exercised end-to-end by the extended
  browser ceremony (ladder: browser-ceremony-check PASS — Q5-1…Q5-6,
  lifecycle transitions Current→History, correction lineage display,
  Used-for-reply recorded evidence with hidden technical ids, mid-turn
  containment, Escape/focus return, conversation usability with the
  surface open, responsive viewports, axe).

## 9. Agent isolation and authority (audit area 8) — proven

- The model-facing envelope remains EXACTLY `qlt.proposal.draft@1`: the
  registry pins exact-revision resolution to that one capability; the
  capability bridge resolves and invokes only it; the compiled plan's
  `capabilities` binding is EMPTY; the plan carries 21 actions whose only
  new entries are the USER-facing `act.queryInspection` (query) and
  `act.setMemoryMode` (mutation). The agent holds no read/list/search/
  inspection/decision/correction/lifecycle/Memory-Mode power.
- Agent-identity attempts against the new surfaces (listRecords, getPolicy,
  getTurn) all fail closed with zero durable effect (probe 04); the
  capability's own correction rejection holds (probe 05); natural-language
  content reaches the model only as injected record DATA with zero
  authority (Q4 containment unchanged and re-proven by the Q4 suite).
- Routes and components contain no direct database mutation path: the UI
  writes only through declared application actions (`/api/act` → released
  boundary → resolved handler → one transaction); inspection reads route
  through the same single released read boundary. Structural gates
  (verify:q5 STRUCTURE; verify:governance) reran green in the ladder.

## 10. Four-area Memory experience (audit area 9)

- Component evidence: the rewritten UI suite (test:ui) and node-side suites
  reran green in the ladder. The three frozen Svelte warning repairs are in
  place (redundant `role="region"` removed; Escape via window-level
  keydown guarded by the tray state with focus returned to the chip;
  `chipButton` as `$state`).
- Real-browser evidence (extended ceremony session, ladder PASS): the
  Memory chip is always present for an open thread; pending count appears
  only when applicable; the tray never opens automatically and never steals
  focus; conversation and composer stay usable with the surface open
  (send/stream/Stop/reconnect/draft retention proven — browser-check and
  browser-stop-check PASS); Escape and Close return focus to the chip; the
  Memory Mode control lives only inside the surface, offers exactly the
  three frozen choices with the applies-to-all statement; mid-turn mode
  change leaves the admitted turn bound (Q5-4) and the next turn uses the
  new mode with truthful "memory was intentionally off" evidence (Q5-5);
  the quiet line reports the off state (Q5-6); axe serious/critical
  findings zero with the surface open on both viewports; no horizontal
  overflow; zero console warnings/errors.
- Origin labels truthful (`this conversation` / `another conversation` /
  `saved without a conversation`); technical identifiers under Details.
- **Qualified by H-1**: the Current area's row set is not truthful when
  decided proposals exist (see §7). All other four-area behavior held.
- Historical views never recompute from current policy or current record
  versions (probes 03-E, 04 §5).
- One UI-consumption note (Observation O-3): the `listTurns` summary rows
  carry `assemblerVersion`/`renderedBytes` outside a Details disclosure;
  the UI does not display them and they are benign operational metrics —
  recorded for the next contract touch-point.

## 11. Verification-data isolation (audit area 10) — remediation verified

- The remediation diff is exactly its declared scope; `package-lock.json`
  byte-identical.
- Ordinary `npm run dev` behavior unchanged (default/relative resolution
  proven by probe 06; no override is set by ordinary startup).
- `QUELLIGHT_DATA_DIR_ABSOLUTE` (probe 06, all through the real seam):
  accepted only absolute, outside-repository, outside-operator-path
  values; REFUSED: the operator directory itself, paths inside it, a
  trailing-dot lookalike inside it, a Windows case-variant of it
  (win32 case-insensitive containment), repository-internal paths
  (including an operator-path lookalike inside the repo), the repository
  root, relative values, the combined form (stable error), while a
  same-named lookalike OUTSIDE the repo is correctly accepted (trusted
  operator configuration).
- `verify:dev-start` (read in full; rerun green in the ladder): unique
  `mkdtempSync` OS-temporary task dir; verifier-side guard
  regression-checked in-process (missing/operator/operator-nested/
  repository-nested refusals); child environment asserted to carry the
  exact task path BEFORE start; spawned negative control proves the
  application seam refuses a repository-internal override with an
  uninitialized control directory; post-teardown READ-ONLY store proof
  that migrations 1..4 ran IN the task-owned dir; ports re-proved free;
  verified `finally` cleanup on success and failure; only task-owned
  paths can be recursively removed; no repository artifact remains.
- **Discriminator (probe 06)**: a full composition booted with the
  override initialized its stores ONLY in the task-owned directory; the
  real repository `.quellight-data` directory entry was never opened and
  its existence/mtime metadata is unchanged. The audit itself never opened,
  queried, hashed, copied, migrated, altered, or deleted the real
  `.quellight-data` (the remediated ladder also never touched it — the
  dev-start gate now isolates by construction).

## 12. Preservation of prior phases (audit area 11) — proven

- **Q2**: durable semantics intact — verify:q2 PASS in the ladder (with
  the disclosed bounded bookkeeping/inventory re-pins verified to be
  assertion-neutral); migration chain and CHECK discipline re-proven by
  probe 02.
- **Q3**: ceremony and agent isolation intact — verify:q3 PASS (19+2
  disclosed re-pin verified additive-only, with an explicit
  "only-additions" strengthening check); the ceremony suite and
  ceremony-authority tests green; FENCE-1 intact.
- **Q4**: verify:q4 PASS (41 checks; disclosed Q4-AMEND-1 re-pins
  verified); context assembly, injection containment, transcript
  non-pollution, and the H-1 overlap remediation all rerun green
  (browser-check, browser-stop-check, turn-overlap suites).
- One-active-turn-per-conversation re-proven at node level (concurrent
  conversations; distinct-key serialization unchanged).
- Future steering remains recorded (D-FUTURE-STEERING-1) and unimplemented.
- **M-1 remains OPEN and unchanged** (truthful VICT effect-class
  correction + Quellight repin) with its hard deadline BEFORE the Phase Q6
  live-provider proof and the Stage 07C final audit.
- No Q6 provider work exists anywhere in either repository.

## 13. Independent negative controls (all external, disposable, removed)

| Control | Result |
| --- | --- |
| Fresh-store `getPolicy` read purity (real boundary; full dump before/after) | **FAILS — B-1 reproduced** (durable row created) |
| All three Memory Modes through the real seam | PASS (modes, evidence, labels) |
| Q4 default-mode parity (explicit vs mode-less evaluation identity) | PASS (byte-identical) |
| Policy change after turn admission (gate inside the admission wrapper) | PASS (in-flight turn keeps bound policy) |
| Restart with immutable applied-policy evidence | PASS (history never relabelled) |
| Historical selected-version inspection after correction | PASS (pre-correction bytes, `supersededSince`) |
| Bounded/truncated exclusions (70-record fixture) | PASS (64-entry bound disclosed) |
| Forged actor / conversation / turn / scope / unknown fields | PASS (all refused closed, zero effect) |
| Agent access refusal at every new surface | PASS |
| L-3 correction proposal through the real boundary | PASS (one successor, one link, replay converges) |
| Inspection credential/prompt canaries (18 needles) | PASS (all absent) |
| Default-data isolation discriminator | PASS (override isolates; operator entry untouched) |
| Operator-path cleanup/combination/case guards | PASS (all refusals verified) |
| C-01 Current-bucket composition (exact UI query shape) | **FAILS — H-1 reproduced** |

All probe code, disposable stores, worktree-free logs, and temporary
directories were created under the OS temporary directory (outside both
repositories) and were removed after use. No probe was committed; no
executable file was modified.

## 14. Authoritative verification (run once, on the untouched audited tree)

**The declared sequence began exactly once and was never interrupted; there
were no failures and no reruns.** Environmental preflight (stale-process
check, environment-variable check, clean-tree check) was completed BEFORE
the sequence was declared started.

```text
npm ci                    PASS (exit 0)
npm run verify:consumer   PASS (exit 0; exact-pin 0.2.0 consumption; N-2 negative control held)
npm run verify:quellight  PASS (exit 0, first attempt) — format:check; typecheck;
                          verify:governance; verify:q2; verify:q3; verify:q4;
                          verify:dev-start (isolated task-owned data dir; zero
                          project Svelte warnings); verify:q5; test:node; test:ui;
                          production build + closed-allowlist build-log scan;
                          browser-check; browser-stop-check; browser-ceremony-check
                          (extended Q5 session; axe zero serious/critical; no
                          overflow; zero console warnings/errors); credential/
                          canary/local-path artifact scan (214 files); git diff --check
npm audit --omit=dev      PASS (exit 0; found 0 vulnerabilities)
git diff --check          PASS (exit 0)
```

Post-ladder observation (disclosed, NOT part of the authoritative sequence):
one supplementary `vitest` node-suite invocation was run solely to capture
test counts for this report (17 files / 240 tests, green); it changed
nothing and hid no failure.

The audited executable tree was untouched throughout (tracked-tree status
identical before and after).

## 15. Findings register

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| B-1 | **Blocking** | Inspection `getPolicy` durably seeds the default-policy row on a freshly migrated store — a read with a durable effect, violating frozen §6 ("no durable effect from a read"); the §11 lazy-seeding clause does not truthfully declare a read-side write. Reachable by simply opening the Memory surface on a fresh store. | **Executable remediation required before re-verification.** Resolve absent rows to the frozen default in memory on every read path; seed only on write-path resolution (admission/setMode). Add a fresh-store row-state purity regression control. |
| H-1 | **High** | `listRecords bucket:'current'` includes terminal proposals (and inflates `total`); the Memory UI's Current tab therefore renders decided proposals as canonical current memory. Violates frozen §3.2/§6 and acceptance row C-01; the implementation's C-01 coverage is vacuous (empty-store only). No injection/authority impact. | **Executable remediation required before re-verification.** Restrict the proposal branch to `pending`/`history`; add a non-vacuous C-01 regression control (a store WITH decided proposals). |
| M-1 | **Medium** | Read-purity and bucket-composition coverage in `verify:q5` and `test/memory-authority.test.ts` (C-19, C-01) cannot detect B-1/H-1 (output-comparison only, vacuous fixtures, no policy-row state assertions). | Non-blocking for closure only because B-1/H-1 already block; MUST be remediated together with them (the audit requires any Medium finding to carry a disposition: remediate alongside B-1/H-1). |
| L-1 | Low | The `unrecorded` usage state is frozen data but unreachable through the current inspection surface (`listTurns` lists only assembly rows; assembly-less turns return `QLT_INSPECTION_TURN_MISSING`). Truthful absence; dead state only. | Carry to the next inspection touch-point (07D retention work). |
| L-2 | Low | `listTurns` summary rows expose `assemblerVersion`/`renderedBytes` outside the Details disclosure; UI does not render them and they are benign metrics. | Carry as a contract-wording touch-point. |
| O-1 | Observation | The implementation report presents `getPolicy` among read-only operations without disclosing the fresh-store write (B-1's disclosure aspect); historical reports remain preserved and the correction belongs to the remediation record. | Fold into B-1's remediation record. |
| O-2 | Observation | Admission-path resolution legitimately seeds the default row inside the critical section (write path) — contract-conformant; noted so the B-1 fix does not remove it. | None. |
| O-3 | Observation | browser-stop-check anchors a disposable store inside the repository (`.quellight-data-stop-check`, pre-Q5, cleaned and gitignored); the operator default is never at risk. | Optional future alignment with the absolute seam. |
| O-4 | Observation | The remediation report's §6 ladder-wording correction is accepted: this audit's own ladder ran green first-attempt with no interruption, superseding nothing. | None. |
| O-5 | Observation | Lane A carried assertion-neutral test re-pins and the verify-q2/q3/q4 re-pins stayed with Lane D, leaving those gates red between commits — the disclosed Q4 pattern, honored within the freeze's own disclosure. | None. |

Carried obligations unchanged: **M-1** (VICT effect-class correction; hard
deadline before the Q6 live-provider proof and the Stage 07C final audit),
L-R1, L-R2, the pending-correction fixture limitation, the Q3 §12
correction-proposal deferral, D-FUTURE-STEERING-1.

## 16. Closure determination

```text
FORMAL CLOSURE IS NOT PERMITTED.
```

Conditions that fail: Blocking finding B-1 exists; High finding H-1 exists;
both require executable remediation (a second independent condition). All
other closure conditions held: authority, history, operator-data isolation,
user-data safety, and the authoritative ladder are all sound, and the
audited executable tree was never modified.

### Exact next permitted remediation (and nothing more)

1. Commit a remediation contract ALONE (truthful title; no implementation)
   covering exactly: (a) B-1 — read-path policy resolution must never
   write (inspect `getPolicy` resolves the frozen default in memory when
   the row is absent; seeding stays on admission/setMode), plus the
   disclosure correction; (b) H-1 — the inspection proposal branch runs
   only for `pending`/`history`; (c) M-1 — non-vacuous regression
   controls: a fresh-store full-row-state read-purity check and a
   decided-proposals-present C-01 check.
2. Implement from the amended freeze SHA under the existing lane map
   (store/surface fix in Lanes A/B; tests in Lane D).
3. Request fresh independent re-verification of the remediated tree.
4. Q5 then remains exactly `IMPLEMENTED — AWAITING REMEDIATION /
   RE-VERIFICATION`; VICT is NOT updated; Q6 is NOT begun.

## 17. Audit footprint

- Files changed by this audit: exactly
  `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-INDEPENDENT-VERIFICATION.md`
  (this file). No other file created, modified, or deleted in either
  repository.
- Probe artifacts: OS-temporary only; all removed.
- VICT: read-only; no change; `.pi/` untouched and unread.
