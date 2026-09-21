# Quellight Stage 07C — Phase Q6 Execution-3 Remediation — Implementation Report

**Status:** REMEDIATED (harness + capability presentation) and
EXACT-PINNED to the VICT verification candidate `0.3.1-rc.1` —
**AWAITING INDEPENDENT VERIFICATION.** NO live-provider proof was
executed; **Execution 4 has NOT run and is NOT authorized by this
task.** Phase Q7 remains BLOCKED — NOT BEGUN. Q6 remains not
independently verified and not formally closed. Stage 07 remains In
Progress.

**Date:** 2026-09-22.
**Frozen contract:**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-REMEDIATION-CONTRACT.md`
(committed alone at `ffecfd7…`, before any executable change). VICT-side
counterpart:
`260831-VCT-02/docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md`.

## 1. Corrected Execution-3 chronology (additive; no historical rewrite)

The Execution-3 record located the crash at the restart/fresh-thread
boundary. That location was WRONG. The corrected, additive chronology:
the prepared worker's `runMatrixTurn` requests the reply IMMEDIATELY
after Turn 1 settles, through `replyOf(sharedWorld, threadId)` →
`sharedWorld.restoreThread(threadId)` — and `restoreThread` belongs to
the FULL composition, not the Shared World store. **Execution 3 crashed
during TURN-1 REPLY RETRIEVAL, before Turn 2** — the provider turn t1
had already completed; the matrix never reached the ceremony, restart,
continuity, or conflict controls. The historical record is preserved
byte-unchanged; this correction is recorded in the frozen remediation
contract §1 and here.

## 2. Harness repairs (Lane D)

- **H-1' — transcript restore:** reply retrieval now accepts the FULL
  composition and calls `composition.restoreThread(threadId)`; the same
  correct boundary is used before and after the restart. The real
  composition exposes `restoreThread` on the composition and NOTHING on
  the Shared World store (permanently asserted; the Execution-3
  TypeError mechanics are reproduced as a negative control).
- **M-1 — awaited evidence:** every asynchronous evidence function is
  `await`ed; the durable-invocation-truth checks on t1/t2 are part of
  the governed evidence chain and settle BEFORE result serialization.
  Structural gates (vitest + `verify:q6`) refuse any floating
  evidence-check call; behavioral fault injection proves an
  ASYNCHRONOUS evidence failure enters the final findings
  (`QLT_Q6_EVIDENCE_CHECK_FAILED`, target `t1`), is present in the
  serialized result, and the matrix still completes all five turns.
- **M-2 — stable non-echoing failures:** findings are a closed
  vocabulary — `QLT_Q6_LIVE_MATRIX_FAILED`,
  `QLT_Q6_REPLY_RESTORE_FAILED`, `QLT_Q6_EVIDENCE_CHECK_FAILED` — plus
  a stable phase label. Arbitrary error-message slicing is removed;
  the thrown value's message/stack/cause NEVER enters findings, notes,
  or result records. Credential surfaces (ledger frames, serialized
  operator configuration) are still scanned in-memory by value.
- **Offline worker-path proof (frozen contract §7):** the real
  orchestration was factored into `scripts/lib/q6-live-matrix.mjs` with
  mode injection. LIVE mode is the unchanged prepared Execution-3
  behavior (gate, bounds, exactly-once, parent/worker lifecycle,
  credential seam). OFFLINE mode drives the SAME five-turn matrix
  through the SAME real composition/bridge/contract/store boundaries
  with a Quellight-owned turn-aware deterministic driver injected
  through the existing `offlineModelFactory` seam (the released VICT
  fixture is untouched; its at-most-once-per-conversation suppression
  cannot express two tool-calling turns in one conversation, which the
  real provider handled). The permanent proof SPAWNS THE REAL WORKER
  PROCESS (no credential, no provider, synthetic non-personal external
  fixture through the real boundary) and traverses: Turn 1 → reply
  retrieval → proposal inspection → Turn 2 → Turn 3 → governed
  confirmation → composition close → recomposition on same root →
  Turn 4 fresh-thread restore/continuity → Turn 5 non-mutation →
  result serialization → worker exit → parent fixture re-verification,
  byte-level credential scan, and owned-root disposal. The offline
  proof also surfaced and fixed two LATENT predicate-feed defects the
  Execution-3 crash had masked: the t2 acceptance now receives
  turn-scoped proposal rows (`sourceTurnRef`) and the commitment
  lookup reads the durable `proposalKind` field. No live acceptance
  rule is weakened.
- `verify:q6` grew 107 → 111 checks (awaited-evidence call sites;
  full-composition restore boundary; non-echoing code vocabulary;
  worker deletion-free adoption).

## 3. Capability/profile revisions (Lane C)

- `qlt.proposal.draft` **revision 2 → 3** — model-facing presentation
  only: the input contract declares the EXACT closed three-branch
  presentation (claim → subject/epistemicType/honestyState/confidence/
  statement; commitment → commitmentKey/statement; open_loop →
  subject/loopKind/detail; every branch required + `additionalProperties:
false`), the output contract declares the closed accepted/refused
  union, and the capability carries the bounded model-facing description
  (drafts ONE inert pending proposal for user review; never confirms,
  saves, or changes canonical memory; accepts only
  claim/commitment/open_loop; each kind's exact content shape).
  Authoritative `Contract.parse` is UNCHANGED; declared effect stays
  `write`; contract identities and revisions of the closed contracts
  are unchanged.
- The EXACT host quiet-write policy entry (`qlt.host-policy.quiet-write@1`,
  one entry) references the capability at revision **3**.
- Agent profile `agent.quellight.conversation` **revision 5 → 6**;
  instruction artifact stays revision **4**; exactly ONE model
  capability; `maxToolCalls: 2`; no authority, read surface,
  confirmation power, action, or migration added.
- The REAL Mastra bridge (VICT `0.3.1-rc.1` code) is proven to present
  the exact captured schema and description to the provider —
  `jsonSchema.input()` EQUALS the declared presentation; a hostile
  schema can never wave an argument past the authoritative `validate`.

## 4. Exact candidate pin (release lane)

- Every `@victframework/*` dependency (9 runtime + the scaffolder
  devDependency) exact-pins **`0.3.1-rc.1`**; the lockfile was
  regenerated SOLELY through real public-registry installation
  (11/11 lockfile entries at exactly `0.3.1-rc.1`, registry-only
  resolution, integrity metadata; `npm ci` reproduces the graph).
- The recorded identity moved through the EXISTING central release-set
  source (`scripts/lib/release-set.mjs`):
  `vict-release-set@1/0.3.1-rc.1`, content ID
  `v1_b6e39c1f6d6f627c03dfe12e8eb4bc0b6b8bb7f7746b4b871cf00d3c7f7ae731`;
  all recorded-identity gate literals updated (verify-consumer,
  verify-dev-start, verify-governance, verify-q2, verify-q3,
  verify-stage7c, governed-mutation suite). No scattered version
  literals.
- Publication chain of the candidate (VICT repository): trusted-OIDC
  workflow run `35625570254` published all 13 packages under
  `vict-0.3.1-rc`; its final same-run registry verification failed on
  CDN propagation lag; the read-only successor evidence run
  `35630175086` re-proved the set terminal-`success` (13/13 integrity,
  provenance, dist-tags, Linux rebuild, registry-only consumer proof)
  per `VICT-0.3.1-RC1-EVIDENCE-RECOVERY-AMENDMENT.md`. `latest`
  remains `0.3.0`; stable `0.3.1` remains unpublished.

## 5. Full offline evidence (authoritative ladder, exact commands and exits; tree `acec1b1…`, clean, committed)

```text
===== STEP: npm ci =====                    EXIT=0
===== STEP: npm run verify:consumer =====   EXIT=0 (registry-only exact-pin
        consumption; unreachable-registry negative control held)
===== STEP: npm run verify:quellight =====  EXIT=0 (format, typecheck,
        verify:governance, verify:q2/q3/q4/q6 — 111 checks, test:node
        26 files/321 tests incl. the NEW offline worker-path proof,
        test:ui, production build, three real-browser checks, artifact
        scan, git diff --check — green)
===== STEP: npm run verify:stage7c =====    EXIT=0 (N-C1..N-C25 manifest,
        release identity stable, focused phase gates green; N-C24 NOT run)
===== STEP: npm audit --omit=dev =====      EXIT=0 (found 0 vulnerabilities)
===== STEP: git diff --check =====          EXIT=0
```

`verify:q6:live` was NOT executed (and is never automatic).

## 6. Commits (all on main; linear)

| Commit                 | Content                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `ffecfd7…`             | the frozen Execution-3 remediation contract (alone)                                     |
| `117773f…`             | Lane C — capability revision 3 + model-facing presentation; profile revision 6          |
| `ae06296…`             | Lane D — worker boundary repairs (H-1'/M-1/M-2), offline matrix proof, structural gates |
| `cef9bae…`             | exact-pin to `0.3.1-rc.1` (registry-only lockfile; central release-set source)          |
| `847dd6e…`, `92cf504…` | prettier formatting for the remediation surfaces                                        |
| `acec1b1…`             | race-free gate-refusal allocation assertion                                             |

Lanes were executed SEQUENTIALLY — no isolated parallel workers were
available in the execution environment; per-commit file ownership was
disjoint and no coordinator abstraction was committed.

## 7. Preservation and status

The historical Q6 records (freeze, amendment, implementation, both
failure records, the Execution-3 record, the preparation record) are
byte-unchanged. The live gate, its bounds, its refusal discipline, and
its exactly-once authorization are unchanged; `verify:q6:live` was not
run. The operator `.quellight-data` directory was never accessed; no
provider credential was read, printed, hashed, serialized, or persisted;
the offline proof used a synthetic non-personal fixture. **Execution 4
has not run and is not authorized; Q7 remains BLOCKED — NOT BEGUN;
Stage 07 remains In Progress.**
