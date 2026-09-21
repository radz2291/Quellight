# Quellight Stage 07C — Phase Q6 Execution-3 Remediation — Independent Verification Audit (offline)

**Status (Quellight side): REMEDIATION INDEPENDENTLY VERIFIED OFFLINE —
with one documentation imprecision recorded and one external condition
noted.** Every mandated Part C check passed: the corrected Execution-3
chronology is proven from source; the H-1'/M-1/M-2 harness repairs hold
under independently authored probes, including a full five-turn offline
matrix run through the REAL worker process with an independently
authored synthetic fixture, an independent store inspection, an
independent async-evidence fault injection, and byte-level non-echo and
credential checks. The authoritative offline ladder is green end to end.

**Status (release coupling): STABLE REPIN NOT PERFORMED.** The VICT-side
independent audit (see VICT repository,
`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-INDEPENDENT-VERIFICATION.md`)
found confirmed executable deviations in the VICT presentation-capture
contract and REFUSED stable promotion. There is no stable `0.3.1` to
repin to; Quellight remains exact-pinned to the verification candidate
`@victframework/*@0.3.1-rc.1`. **Q6 remains NOT formally closed (the
required live proof has not passed and Q7 has not completed);
Execution 4 has NOT run and is NOT authorized; Phase Q7 remains BLOCKED
— NOT BEGUN; Stage 07 remains In Progress.**

**Date:** 2026-09-22.
**Audited tree:** `80b415d1ae29b9ac2836f7e67e71c68c5d25fa2e`
(`HEAD == origin/main`, clean tracked tree, linear ancestry;
`.quellight-data` never accessed, never read; no provider credential
accessed, read, or present in any probe environment).

---

## 1. Frozen-contract conformance (all verified from source and runtime)

- **Capability `qlt.proposal.draft@3`** —
  `QLT_PROPOSAL_CAPABILITY_REVISION = '3'`
  (`src/lib/sharedworld/ceremony-contract.ts`).
- **Declared effect remains `write`** —
  `QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT = 'write'`.
- **Quiet-write host policy** — `qlt.host-policy.quiet-write@1`, EXACTLY
  ONE entry, referencing `(qlt.proposal.draft, revision 3)`
  (`src/lib/server/composition.ts` `quietWriteApprovals`).
- **Profile revision 6; instructions revision 4** —
  `PROFILE_REVISION = '6'`, `INSTRUCTIONS_REVISION = '4'`.
- **Exactly one model capability** — the activation envelope's
  `capabilities` array contains exactly
  `{ id: qlt.proposal.draft, revision: '3' }`.
- **`maxToolCalls: 2`** — `src/lib/sharedworld/q6-contract.ts`.
- **No new authority / read surface / confirmation power / action /
  migration** — diff `1fa178b…` (freeze base) → HEAD over
  `q6-contract.ts`, `composition.ts`, `migrations.ts`, `meaning-store.ts`,
  `memory-policy.ts` shows ONLY the revision bumps (capability 2→3,
  profile 5→6) and comment updates; no migration or store change.
- **Exact closed three-branch presentation** — the input presentation
  declares `claim → subject/epistemicType/honestyState/confidence/
  statement`, `commitment → commitmentKey/statement`,
  `open_loop → subject/loopKind/detail`, every branch `required` +
  `additionalProperties: false`; the output presentation declares the
  closed accepted/refused union; the bounded model-facing description
  states the tool drafts ONE inert proposal, never confirms/saves, and
  names each kind's exact content shape.
- **Authoritative parsing unchanged** — the diff of
  `src/lib/agent/proposal-capability.ts` from the Execution-3 tree
  (`e0f2797…`) to HEAD is 122 insertions, 0 deletions: presentation
  constants and the three declaration fields only; `Contract.parse` is
  byte-identical (unchanged, therefore unchanged-or-stricter).

## 2. Corrected Execution-3 chronology and harness repairs (proven from source)

- **Crash location.** The prepared worker at `e0f2797…` defines
  `replyOf(sharedWorld, threadId) → sharedWorld.restoreThread(threadId)`
  inside `runMatrixTurn`, invoked immediately after Turn 1 settles — and
  `restoreThread` exists on the FULL composition
  (`composition.restoreThread`, `src/lib/server/composition.ts`) and on
  NOTHING of the Shared World store (`SharedWorldSqlite` has zero
  `restoreThread` members). Execution 3 therefore crashed during
  TURN-1 REPLY RETRIEVAL, before Turn 2 — the additive correction of the
  frozen remediation contract §1 is confirmed against source. The
  historical records remain byte-unchanged (verified by diff against
  `1fa178b…` for the Q6 freeze, the bounded-discretion amendment, both
  live-failure records, the Execution-3 record, and the preparation
  record).
- **H-1' repaired.** The matrix's reply retrieval now accepts the FULL
  composition and calls `composition.restoreThread(threadId)` before the
  restart AND after it (matrix source lines verified; the same boundary
  at t4/t4-restore and transcript-restore sites). The repository's
  permanent control proves on a real composition that
  `composition.restoreThread` is a function while
  `composition.sharedWorld.restoreThread` is undefined and that calling
  the latter reproduces the Execution-3 TypeError mechanics.
- **M-1 repaired and independently fault-injected.** Both
  `checkInvocationTruth` call sites are `await`ed. An INDEPENDENTLY
  AUTHORED injection (this audit's own probe, using the matrix's public
  `requireCompositionDataDir` seam) made the t1 evidence check's own
  read reject ASYNCHRONOUSLY with canary-laden message and cause:
  the matrix still completed all five turns, `result.ok` was false, the
  finding appeared EXACTLY as
  `QLT_Q6_EVIDENCE_CHECK_FAILED (evidence target: t1)`, exactly one
  finding exists, and NEITHER the canary message, NOR the canary path,
  NOR the cause chain entered the serialized result (7/7 independent
  assertions).
- **M-2 holds.** The failure vocabulary is the frozen closed set
  (`QLT_Q6_LIVE_MATRIX_FAILED`, `QLT_Q6_REPLY_RESTORE_FAILED`,
  `QLT_Q6_EVIDENCE_CHECK_FAILED`) plus stable phase labels; thrown
  values are never stringified into evidence (matrix source verified;
  behavioral non-echo proven by the injection probe above). The
  structural gates wired into `verify-q6.mjs` (111 checks) refuse
  floating evidence calls and non-vocabulary findings — and PASSED in
  the authoritative ladder (below).

## 3. Independent offline five-turn matrix through the REAL worker process

An independently authored runner (fixture, workspace allocation,
spawn command, and assertions all written for this audit) executed:

```text
synthetic non-personal fixture (464 bytes, external OS-temp file)
→ createQ6LiveWorkspace (owned root)
→ spawn REAL scripts/lib/q6-live-worker.mjs, QUELLIGHT_Q6_OFFLINE=1,
  QUELLIGHT_Q6_OWNED_ROOT=<owned root>, QUELLIGHT_Q6_NATURAL_FIXTURE_FILE,
  QUELLIGHT_Q6_FIXTURE_IDENTITY; OLLAMA_API_KEY deleted from the child env
→ worker exit 0
→ result record read from INSIDE the owned root
→ independent SQLite inspection of <root>/shared-world.db
→ parent-side fixture identity re-verification
→ byte-level credential scan over EVERY persisted byte of the owned root
→ owned-root disposal
```

Results (18/19 independent assertions; the one non-pass was an audit-probe
assumption artifact, corrected below):

- Worker exit 0; `ok: true`; `findings: []`; exactly five provider turns;
  turn order exactly `t1 (explicit remember request) → t2 (natural
  discretionary fixture) → t3 (transient incident) → t4 (fresh-conversation
  continuity) → t5 (hypothetical conflict)`.
- t1: completed, exactly 1 invocation, 1 proposal. t2: completed, 1
  invocation, 1 proposal (discretionary durable extraction from the
  audit's OWN fixture text — the runner did not reuse the repository's
  fixture). t3: completed, 0 invocations, 0 proposals (transient
  abstention). t4: completed (fresh-thread C1 continuity). t5: completed,
  0 invocations, 0 proposals (hypothetical-conflict non-mutation).
- **Independent store inspection:** the owned root's `shared-world.db`
  contains EXACTLY ONE canonical commitment (`qlt_commitment` = 1: the
  confirmed t2 commitment, `status: 'active'`, version 1, the expected
  commitment key and statement), ZERO canonical claims (the t1 claim
  proposal stayed pending — never auto-canonicalized), ZERO canonical
  open loops, and both pending proposals retained (`qlt_proposal` = 2).
  (The probe's initial "confirmed state" assertion expected a
  `confirmed` status literal; the canonical vocabulary is `active` — the
  record is the confirmed t2 proposal in every substantive respect.)
- Governed user confirmation produced no agent confirmation authority:
  the confirmation flowed through `act.confirmProposal` via the
  governed mutation boundary (matrix code verified; zero agent-side
  confirm verbs exist on the capability surface — store refuses agent
  decision identities independently).
- No transcript context-block pollution: the fresh-thread t4 acceptance
  (part of the matrix's acceptance predicates, all green — findings
  empty) enforces the C1 context snapshot selection with zero
  context-block bytes in the fresh conversation's durable transcript.
- Fixture survived byte-identical (re-verified); the canary credential
  string planted by the runner appears in NO persisted byte; the
  owned root was fully removed by disposal.

No provider was contacted, no credential was read (the child env
explicitly deleted `OLLAMA_API_KEY`), and the fixture is synthetic and
non-personal.

## 4. Part D — authoritative offline ladder (single run, no reruns)

```text
HEAD 80b415d…  tracked tree clean (.quellight-data untouched)
===== STEP: npm ci =====                    EXIT=0
===== STEP: verify:consumer =====           EXIT=0 (registry-only exact-pin
        consumption 0.3.1-rc.1; unreachable-registry negative control held)
===== STEP: verify:quellight =====          EXIT=0 (format:check, typecheck,
        verify:governance, verify:q2/q3/q4, verify:dev-start, verify:q5,
        test:node (includes the Q6 suites incl. the offline worker-path
        proof), test:ui, production build + build-log scan, three
        real-browser checks, artifact scan, git diff --check — all PASS)
===== STEP: verify:stage7c =====            EXIT=0 (N-C1..N-C25 manifest;
        verify-q6.mjs PASS — the 111 Q6 structural checks; N-C24 live
        ceremony NOT executed by the aggregate)
===== STEP: npm audit --omit=dev =====      EXIT=0 (found 0 vulnerabilities)
===== STEP: git diff --check =====          EXIT=0
```

`verify:q6:live` was NOT executed. No failures occurred; nothing was
rerun; no timeout or assertion was altered.

## 5. Findings (Quellight side)

- **Q-O-1 (documentation imprecision, non-blocking):** the
  implementation report's §5 ladder description lists `verify:q6` inside
  the `verify:quellight` step; in the audited tree `verify:quellight`
  does not invoke `verify:q6` — the Q6 gate runs inside
  `verify:stage7c`'s GATES (verified PASS there), and the Q6 vitest
  suites run inside `test:node`. The substance (the Q6 gate ran green in
  the authoritative offline ladder) holds; the wording should be
  corrected in a future documentation commit.
- **Q-O-2 (external condition, non-blocking here):** `npm audit` WITH
  dev dependencies reports 4 advisories (1 critical) in `happy-dom`
  (dev-only test browser; GHSA-37j7-fg3j-429f et al.). Production
  dependencies audit clean (`--omit=dev` = 0), and the mandated gate is
  the production audit. Recorded so the dev-surface exposure is visible
  to the owner.
- **No frozen-contract violation, authority widening, evidence race,
  non-echo failure, or cleanup defect was found on the Quellight side.**

## 6. Status language

The Execution-3 remediation is INDEPENDENTLY VERIFIED OFFLINE. Q6
remains NOT formally closed: the bounded live-provider proof has not
passed (Executions 1–3 failed truthfully; the authoritative live count
remains THREE), `verify:q6:live` was not run in this audit, **Execution
4 has not run and is not authorized**, and **Phase Q7 remains BLOCKED —
NOT BEGUN**. Stage 07 remains In Progress. The stable repin is deferred
until the VICT-side blockers (see the VICT independent audit report) are
remediated and a stable `0.3.1` actually exists; Quellight remains
exact-pinned to `@victframework/*@0.3.1-rc.1` with a registry-only
lockfile.
