# Quellight Stage 07C — Phase Q3 — Governed Confirmation Ceremony and Quiet Memory Inbox Implementation

Status: **IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION** (Q3 is not
independently audited or formally closed by this document.)

- Starting Quellight HEAD: `0cb9c124cc0c3bb127c2df732da29427e6157b16` (== origin/main)
- Starting VICT HEAD: `0f4f72b0812bdfa40229a170f4d97e9696f72dd9` (read-only; unchanged)
- Contract-freeze commit: `7ea62f8` — `docs(stage-07c): freeze Phase Q3 confirmation ceremony contract`
- Final implementation tree: this repository's `main` at the last commit of §4.
- Freeze document: `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md`
  (including dated amendments A-AMEND-1 … A-AMEND-4).

## 1. Prerequisites and starting evidence

Both repositories were fetched before work began; `origin/main` of each
matched the expected starting SHAs exactly (no remote advancement, no
conflicting later-phase work). Both work trees started clean. VICT was
touched only in the narrow documentation reconciliation recorded in §13.

## 2. Phase 0 — the contract freeze

`7ea62f8` froze the complete Q3 contract: objective and exclusions; the six
locked owner decisions (D-Q3-1 … D-Q3-6); the `qlt.memory@1` resource
(one query + thirteen mutation ops); the 19-action plan inventory; the
single pinned capability `qlt.proposal.draft@1` with profile
`agent.quellight.conversation` revision 2 (`maxToolCalls: 2`, fail-closed,
budget-gated); closed input/output contracts; stable non-echoing failure
codes including the new `QLT_INGRESS_PROHIBITED_FIELD` (FENCE-1);
server-derived thread/turn correlation; lifecycle transition mapping
(Q2 vocabularies unchanged); idempotency and optimistic-version rules;
quiet-inbox interaction states; the correction targeting rule; FENCE-1
treatment; the TEST-1 scenario; accessibility requirements; the lane
file-ownership map; the acceptance/negative-control matrix; the
verification containment map; and the independent-audit boundary.

The frozen Q2 contract, historical Q2 reports, and Q2 schemas were not
altered. Q3-owned contracts live in the new Q3 declarative contract module
`src/lib/sharedworld/ceremony-contract.ts`.

## 3. Controlled parallel workflow actually used

Lanes executed as temporary branches over the freeze SHA, consolidated by
the integration owner into the reviewable linear chain of §4. Lane A owned
the application/persistence surface and the shared composition chokepoint;
Lane B owned the agent proposal capability; Lane C owned the conversation
workspace UI; Lane D wrote contract-first adversarial tests and the
focused verifier from the freeze before accommodating implementation;
Lane E built the TEST-1 real-browser harness and ran it against the
integrated tree.

Two material contract reconciliations occurred mid-flight and are recorded
as dated freeze amendments rather than silent deviations:

- **A-AMEND-1/A-AMEND-2** — the Q2 repository lacked thread-scoped reads
  for three record families (a bounded READ-ONLY `sqlite.ts` listing
  helper was added) and the unified projection lacked a proposal-kind
  field (`proposalKind` added additively to the `qlt.memory` catalogue and
  `v.memory` view).
- **A-AMEND-4** — Lane E's reject scenario (a decision without a reason)
  exposed a latent Q2 defect: keyed reconciliation payloads crashed the
  canonical fingerprint serializer when an optional field was absent.
  Fixed inside `meaning-store.ts` by conditionally spreading optional
  payload fields; fingerprints for calls that provide the fields are
  byte-identical, so no convergence history changes. No contract, code,
  identifier, or schema semantics changed.

## 4. Commits and files changed

Linear chain from `0cb9c12` (all authored locally; nothing history-rewritten):

| Commit    | Message                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `7ea62f8` | docs(stage-07c): freeze Phase Q3 confirmation ceremony contract                               |
| `a02d273` | docs(stage-07c): amend Phase Q3 freeze with the read-only memory listing boundary (A-AMEND-1) |
| `8dc0032` | docs(stage-07c): amend Phase Q3 freeze with the proposal-kind projection field (A-AMEND-2)    |
| `dbefac5` | docs(stage-07c): amend Phase Q3 freeze for the N-12 envelope re-pin (A-AMEND-3)               |
| `8c3fdfb` | feat(stage-07c): pin the inert agent proposal-draft capability (Lane B)                       |
| `dfc2ff3` | feat(stage-07c): add governed Shared World confirmation ceremony (Lane A)                     |
| `78d9d82` | feat(stage-07c): add quiet memory review experience (Lane C)                                  |
| `83d4746` | test(stage-07c): verify ceremony authority and recovery (Lane D)                              |
| `0832006` | fix(stage-07c): normalize optional fields in keyed reconciliation payloads (A-AMEND-4)        |
| `07e3d19` | test(stage-07c): prove the governed ceremony in a real browser (Lane E, TEST-1)               |
| `7203856` | fix(stage-07c): meet the accessibility contrast baseline in the memory inbox                  |

Full inventory (22 files, +6106/−93): the freeze report; `package.json`
(`verify:q3`, `verify:browser-ceremony`, aggregate wiring);
`scripts/verify-q3.mjs` (new, 33 checks); `scripts/browser-ceremony-check.mjs`
(new, TEST-1); `scripts/verify-q2.mjs` and `scripts/verify-quellight.mjs`
(§16-bounded structural reconciliation and permanent aggregate integration);
`src/lib/agent/proposal-capability.ts` (new); `src/lib/application/definition.ts`
(19-action plan); `src/lib/islands/ConversationWorkspace.svelte` (quiet memory
inbox); `src/lib/server/application-server.ts` (closed ingress + FENCE-1);
`src/lib/server/composition.ts` (single composition chokepoint);
`src/lib/server/runtime.ts` (offline fixture triggers);
`src/lib/sharedworld/ceremony-actions.ts` (new, memory surface + projection);
`src/lib/sharedworld/ceremony-contract.ts` (new, frozen Q3 contracts);
`src/lib/sharedworld/meaning-store.ts` (A-AMEND-4 normalization only);
`src/lib/sharedworld/sqlite.ts` (A-AMEND-1 read-only listing helper only);
`test/ceremony-authority.test.ts` (new); `test/proposal-capability.test.ts`
(new); `test/ui/memory-inbox.test.ts` (new); reconciliation re-pins in
`test/composition.test.ts`, `test/sharedworld-meaning.test.ts`,
`test/ui/workspace.test.ts`; this report and the freeze document.

Disclosure: commit `8dc0032` (an A-AMEND-2 docs commit by title) also
carries Lane C's island/UI-test work in its tree because the Lane C edits
were made against the same checked-out work tree during the amendment.
Content and tests are correct and green; the report records this openly
rather than rewriting published-order history.

## 5. Integration reconciliation record (no silent deviations)

- Capability effect-class disclosure: the pinned capability is declared
  `effect: 'read'` because the released VICT 0.2.0 tool bridge hardwires
  approval-requiring policy for `write`/`irreversible` classes and the
  ratified single-actor envelope (OQ6; D-10) has no distinct approver — a
  `write` class would deterministically suspend and fail every proposal
  turn, violating D-Q3-2. An auto-approver was REJECTED as a prohibited
  approval-semantics bypass. Every authority property (inertness, no
  confirmer power, no read path, one-open-per-turn, keyed idempotency,
  fenced settlement) is enforced by implementation, store, contracts, and
  permanent tests — never by the class metadata. A truthful framework
  policy extension is recorded in the freeze as a candidate VICT
  framework-change proposal, not implemented in Q3.
- FENCE-1 (D-Q3-6): unknown/prohibited request keys at `/api/act` —
  including prototype-named keys, checked via own-property membership —
  fail closed with the stable non-echoing code
  `QLT_INGRESS_PROHIBITED_FIELD`. All previously valid declared-field
  behavior is preserved (Q1-era negative control suite green). Recorded
  openly as a Q3 change, not retrofitted into Q2 history.
- A-AMEND-4 (see §3): the reason-less keyed-verb normalization.
- TEST-1 interaction-state clarification: the inbox chip remains visible
  with a quiet "Memory" label when a thread holds decided records but zero
  pending proposals, so the user retains a durable, user-opened entry point
  to thread records (required for direct correction and truthful
  presentation; D-Q3-2's pending-count behavior for pending > 0 is
  unchanged and the surface is still never auto-opened, never blocking).

## 6. Action/query/capability inventory (as implemented)

- Resource `qlt.memory@1`: catalogue fields exactly as frozen (including
  `proposalKind`); declared query `list` with filters `kind`, `status`,
  `threadId`; view `v.memory`.
- Thirteen mutation ops: `confirmProposal`, `rejectProposal`,
  `amendProposal`, `withdrawProposal`, `createClaim`, `createCommitment`,
  `createOpenLoop`, `correctRecord`, `retireClaim`, `releaseCommitment`,
  `resolveLoop`, `abandonLoop`, `transformLoop`.
- Plan inventory: 5 existing thread actions + `act.queryMemory` + the
  thirteen `act.*` memory mutations = 19 actions (compile/ingress/adapter
  agreement permanently gated by `verify:q3` §PLAN).
- Capability envelope: exactly one pinned capability
  `qlt.proposal.draft@1` (input `qlt.proposal.draft.input@1`, output
  `qlt.proposal.draft.output@1`) on profile
  `agent.quellight.conversation` revision 2 with `maxToolCalls: 2`
  fail-closed and the per-turn budget gate wired to the released adapter
  gate.
- Offline fixture: three deterministic tool-call triggers (claim,
  commitment, open_loop), each emitted at most once per conversation, on
  fresh threads per scenario.

## 7. Authority matrix and no-agent-read proof (as implemented)

The agent (`agent-quellight`, model-facing) has NO Shared World read or
decision power: no capability to list/inspect confirmed records, query
proposal outcomes, retrieve corrections, assemble context, or receive
saved records in prompt/profile/memory/tool results. Its only possible
Shared World outcome is the immediate bounded result of its own draft
invocation (`{ accepted: true, proposalId }` / `{ accepted: false, code }`).
All reads for presentation/recovery flow through user-facing
`act.queryMemory` and the server-side projection, never into any model
path. Enforcement: pinned envelope; store CHECKs (confirmer/withdrawer
`actor-*` patterns); capability boundary rejections; FENCE-1 ingress;
`verify:q3` ISOLATION/PREP sections; and the adversarial negative controls
in `test/ceremony-authority.test.ts` (23 tests) and
`test/proposal-capability.test.ts` (9 tests) — including agent-identity
confirm/reject/amend/withdraw refusals with zero effects, missing/
client-supplied correlation refusals, one-open-proposal-per-turn, and the
no-read-path structural gates. Direct Save (`act.createClaim` /
`act.createCommitment` / `act.createOpenLoop`) is a first-party UI action
("Remember this") attributable to the signed-in user (`created_by` =
`actor-quellight-local`) and is immediately canonical with no second
ceremony; ordinary model interpretation of natural language cannot reach
it (there is no such path).

## 8. Turn correlation (as implemented)

The model supplies only `proposalKind` and `content`. The composition
resolves server-side: (1) the VICT turn record for the bridge-supplied
`victTurnId`; (2) the turn's authenticated actor must equal the
bridge-supplied actor; (3) the Shared World thread via
`qlt_thread_conversation` on the turn's Mastra thread id. Failures surface
as `QLT_CORRELATION_MISSING` / `QLT_THREAD_MISSING`. Client- or
model-supplied correlation fields are unknown fields and fail closed. The
one-open-proposal-per-(thread, kind, turn) rule is enforced by the Q2
partial unique index.

## 9. Quiet memory inbox (as implemented)

Inside the existing conversation workspace: a small, quiet chip
("Memory · N pending" when pending > 0; a subdued "Memory" when the thread
holds records but nothing is pending) opens a user-opened review tray —
never a modal, never auto-opened, never focus-stealing, never blocking
streaming/reconnect/stop, never requiring a decision, never repeating or
pressuring. The tray lists pending and decided items with kind labels
("Possible claim" / "Possible commitment" / "Possible open question"),
content, provenance, source-thread attribution, pending/stale/confirmed/
rejected/amended/withdrawn presentation, Confirm/Edit/Reject/Withdraw
controls, "Remember this" direct Save for new records, and user correction
(Correct) for confirmed records. Keyboard-only operation, Escape-to-close,
focus management, live screen-reader announcements, and responsive layout
are covered by `test/ui/memory-inbox.test.ts` (5 tests) and TEST-1.

## 10. TEST-1 evidence (as implemented)

`scripts/browser-ceremony-check.mjs` builds the production adapter-node
server, seeds the offline fixture, and drives three real-browser scenarios
(Chromium): claim→Confirm, commitment→Reject, open_loop→Withdraw on fresh
threads, permanently proving freeze §14 items 1–7, 9 (both reject and
withdraw), 11 (keyboard-only review/confirm/decision), and 12 (axe clean,
desktop and mobile viewports, with no horizontal overflow), plus zero
console warnings/errors across the whole session. Items 8, 10, 13, and 14
(idempotent retry, staleness refusal, agent-identity zero-effect failures,
no-model-read) are delegated to the node suites by the frozen containment
map and are proven there. Final run: PASS, all items green. Items
8/10/13/14 negative controls: `test/ceremony-authority.test.ts` and
`test/proposal-capability.test.ts` (same-key convergence, stale-refusal,
agent-identity refusals, no model read path).

## 11. Verification

Development-time evidence (not the final authoritative run):

- `verify:q3`: PASS — 33 checks (plan/authority/ingress/isolation/pins/wiring/deterministic).
- `verify:q2`: PASS — 179 checks (schema 139, deterministic 22, repository 7, structural 7, pins 2, wiring 2) after the §16-bounded re-pins.
- Node suite: 10 files / 134 tests passing (including `ceremony-authority`
  23, `proposal-capability` 9, and the A-AMEND-4-covered Q2 suites).
- UI suite: 3 files / 11 tests passing (including `memory-inbox` 5).
- Typecheck: clean. Build: clean. TEST-1: PASS (§10).

Failed executions recorded and diagnosed (per FastGate rules, disclosed):

1. First TEST-1 run: tray-content read raced the asynchronous memory
   refresh (fixed by awaiting tray items before reading content) —
   disclosed and fixed in `07e3d19`.
2. Second TEST-1 run exposed the A-AMEND-4 store defect (reason-less keyed
   verbs crashed) — diagnosed at node level, fixed, verified by probe and
   full suite (`0832006`).
3. Third/fourth TEST-1 runs: stale build artifacts and a strict-mode
   locator ambiguity in the harness itself — fixed in the script and by
   rebuilding (`07e3d19`).
4. Fifth TEST-1 run: axe `color-contrast` (2) on `.qlt-memory-kind` /
   `.qlt-memory-provenance` — fixed by replacing opacity-dimming with
   solid accessible muted colors and differentiating decided items by
   background (`7203856`); rerun PASS. No assertion was weakened; every
   fix was understood before rerun.

The final authoritative sequence (`npm ci`; `npm run verify:consumer`;
`npm run verify:quellight`; `npm audit --omit=dev`) was executed last on
the frozen candidate tree; its results are recorded in the completion
response.

## 12. Documentation

- `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md` (freeze +
  A-AMEND-1…4).
- This report.
- `README.md`, `docs/system-reference.md`, `docs/decision-register.md`:
  updated to record Q3 as **IMPLEMENTED — AWAITING INDEPENDENT
  VERIFICATION**, the six owner decisions, the ceremony surface, FENCE-1,
  TEST-1, and the exact Q3 status. Q3 is NOT Verified or formally closed;
  Q4 has NOT begun.

## 13. Preservation and cleanup

- The VICT repository: source, packages, tests,
  manifests, lockfiles, and historical reports byte-identical; only the
  current System Reference received the authorized v0.4.14 documentation
  reconciliation (separate commit), recording Q2 closure, Q3
  implementation status, the exact Quellight implementation SHA, the
  unchanged VICT 0.2.0 release identity, Q4 not begun, and Stage 07 In
  Progress.
- Both repositories push only by normal fast-forward after fresh fetch.
- All temporary worktrees, branches, probe files, databases, logs, and
  processes created by this task were removed after integration.

## 14. Genuine limitations (truthful)

- Confirmed Shared World meaning is NOT available to the agent — by
  design; that is Q4.
- Agent-originated correction proposals are deferred to Q4 (the capability
  rejects `proposalKind: 'correction'`).
- Dedicated UI controls for claim/commitment/loop lifecycle exits remain
  deferred to Q5; the exit verbs exist at the API level and are proven.
- The capability's `read` effect class is an openly disclosed imperfect
  metadata description (§5 of the freeze); the substantive authority
  properties are enforced elsewhere. A framework policy extension remains
  a candidate proposal for the VICT owners.
- Retention/deletion enforcement, dedicated global memory management UI,
  and full lineage/context-inspection UI remain out of scope.
- Q3 has no live-provider ceremony proof (offline deterministic fixture
  only), per the frozen boundary.

## 15. Explicit stop point

Q3 ends at IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION. Independent
audit, formal closure, and any Q4 work are out of scope for this task.
