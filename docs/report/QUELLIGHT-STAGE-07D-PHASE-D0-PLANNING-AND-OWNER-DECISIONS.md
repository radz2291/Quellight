# Quellight Stage 07D Phase D0 — Retention, Recovery, and Real-Use Planning

> **Class:** Non-binding planning and owner-decision document (documentation
> only). This document plans Stage 07D — Retention, Recovery, and Real-Use
> Proof — against the canonical Stage 07 architecture, the Stage 07C handoff
> §18 boundary, the closed Stage 07C implementation, and the applicable
> `QLT-*`/`INV-*`/`MSTR-*` requirements. It implements nothing, freezes
> nothing, and decides nothing by itself: every product choice below is
> presented as a pending owner decision with a recommended default. Stage 07D
> implementation has NOT begun; Stage 07E has NOT begun.

## 0. Disposition and state at planning time

```text
Planning basis (verified 2026-09-22, fresh fetch):
Quellight origin/main = 5119b067… (HEAD; clean tree; 0 merge commits;
  no Stage 07D work exists anywhere in history or worktree)
VICT origin/main      = 4aa245d2… (HEAD; docs/VICT-SYSTEM-REFERENCE.md §0.32
  records "Stage 07D is PERMITTED and NOT BEGUN")
Stage 07C: FORMALLY CLOSED (Q7 audit 9d5e132b…, closure a7530a5…)
Stage 07D: PERMITTED — PLANNED BY THIS DOCUMENT ONLY
Stage 07E: NOT BEGUN
Stage 07:  In Progress
```

Both repositories were fetched and verified at the exact anchors above; the
ancestry is clean (no merges, no divergent remote state), no tombstone,
retention, or 07D-named work exists in either repository, and no untracked
material was touched. This phase changes no production code, no migrations,
no routes, no UI, no tests, and no verification scripts.

## 1. Canonical requirements Stage 07D must satisfy

| Requirement                              | Text (condensed)                                                                                                                                                                                                                                       | Status today                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `QLT-011` (`INV-17`)                     | Context assembly MUST exclude deleted/expired material; removal MUST follow the retention policy with truthful tombstones and dependency re-evaluation — no ghost derivatives                                                                          | Planned                                                                              |
| `QLT-019` (`P14`, `P17`, `INV-17`)       | Explicit, inspectable, user-correctable retention policy with per-record retention metadata; user-requested removal honored as a visible operation with content-free tombstones where lineage requires                                                 | Planned (metadata columns exist; policy and removal flows do not)                    |
| `QLT-009` (`P12`)                        | A proposal conflicting with a standing commitment MUST be identified against the commitment's provenance; Quellight MAY challenge rather than harmonize                                                                                                | Planned                                                                              |
| `QLT-010` (`INV-15`)                     | Ordinary execution under standing layers MUST be distinguished from explicit, versioned amendment; ambiguous instruction MUST trigger explicit clarification                                                                                           | Planned (bounded pending-proposal amendment flow exists)                             |
| `QLT-017` (`MSTR-012`)                   | Before real-use claims: retention, deletion, export, and pruning proven end to end; non-web-accessible stores; absent secret canaries; credentials external to stored data; informed-user retention disclosure; documented backup/recovery limitations | Planned                                                                              |
| `MSTR-011`                               | Local data-protection baseline (Verified at Stage 06): retention bounds with executed pruning, governed deletion/export, cross-store reconciliation, canary tests                                                                                      | Verified (Mastra-side machinery Quellight consumes)                                  |
| `MSTR-012`                               | Declared local-first, single-actor, single-process, file-backed envelope; real-use proof of retention/deletion/export/pruning and data protection                                                                                                      | Planned                                                                              |
| Stage 07 exit gate §13 items 5–8, 10, 11 | C1 recovery with transcripts absent; first vertical complete incl. conflict/amendment scenarios; UI deletion with tombstones and dependency re-evaluation; MSTR-012 real-use proofs; no deferred capability claimed; independent audits                | Partly evidenced by 07C; 07D completes the retention/deletion/conflict/real-use rows |

The Stage 07C handoff §18 fixes the 07D boundary exactly: retention
enforcement (tombstones, expiry, dependency re-evaluation, removal flows);
governed deletion/export with cross-store reconciliation; conflict
identification and the full amendment-vs-execution distinction (`QLT-009`,
`QLT-010`, `INV-15` in full); the `MSTR-012` real-use proof and its
data-protection evidence. Autonomous initiative, ingestion, delegation,
learning, full `SYNC`, and the exit gate remain excluded (later milestones /
07E). Nothing in 07D may reopen them.

## 2. What already exists (repository evidence)

Verified closed-07C state this plan builds on:

- **Retention columns and vocabulary.** Every Shared World family table
  carries `retentionState` with the closed vocabulary
  `['currently-relevant', 'user-removed']`, enforced by a CHECK constraint
  (`src/lib/sharedworld/meaning-contract.ts` line 100,
  `meaning-contract.ts` `RETENTION_CHECK`,
  `src/lib/sharedworld/port.ts` line 29). The handoff's structural promise —
  no 07C decision may make a later content-free tombstone impossible — is
  honored.
- **Exclusion semantics already proven.** Context assembly is a deterministic
  read-side assembler whose eligibility is status/retention/lineage/integrity
  only — explicitly time-blind (`context-assembler.ts` header: "elapsed time
  alone never changes eligibility"). N-C10/N-C11 prove unconfirmed/superseded
  exclusion; the Q6 live receipt proved eligible-only assembly end to end.
  `user-removed` sources are excluded in lineage resolution
  (`meaning-store.ts` lines 672/686/949).
- **Truthful inspection tombstones (bounded).** The Q5 inspection surface
  already renders truthful tombstones for retention-removed or missing
  records (`inspection-surface.ts` lines 396–420; `inspection-contract.ts`
  §3.4 states `unavailable` / `removed`).
- **Ceremony and authority.** 21 governed actions on two resources plus the
  single inert agent proposal capability; agent self-confirmation structurally
  denied (N-C8); every effectful write crosses the governed VICT 0.3.1
  boundary; the ratified OQ6 model (user = constitutional authority and final
  confirmer; agent = proposer only) is negative-controlled.
- **Lifecycle exits.** `retireClaim`, `releaseCommitment`, `resolveLoop`,
  `abandonLoop`, `transformLoop` exist as user actions; commitments are
  one-active-per-key; corrections are append-only with keyed idempotency.
- **Mastra-side (VICT, consumed at exact 0.3.1 pins).** Verified MSTR-011
  machinery: protected store placement and permissions
  (`resolveProtectedStoreDir`, `restrictStorePathPermissions`), retention
  bounds with an actually executed pruning function and validated inputs,
  governed conversation deletion with a reconciliation bound that fails
  closed (`VICT_MASTRA_MEMORY_DELETION_INCOMPLETE`), export disclosure, and
  canary-based leak tests.
- **Live-proof harness pattern.** The Q6 parent/worker harness, one-shot
  receipt (exclusive-create; mechanically refuses re-execution), observer
  (`rewritten:false`, request caps, deadline), and structural-evidence-only
  commit discipline are closed, verified patterns D4 can reuse.

## 3. What remains missing (the 07D gap)

1. **No code path sets `user-removed`.** The state exists in vocabulary,
   CHECK, and exclusion logic, but no verb, action, or UI operation produces
   it. Removal enforcement is entirely absent.
2. **No `expired` state, no retention policy object, no enforcement pass.**
   Expiry does not exist in any form; per-family/per-record retention classes
   and a user-correctable policy (QLT-019) do not exist.
3. **No dependency re-evaluation on removal/expiry.** Re-evaluation exists
   only on the correction path; removal/expiry must re-evaluate derived
   records (no ghost derivatives) within the bounded first-vertical scope.
4. **No thread deletion and no Shared World export in the product surface.**
   Threads support create/rename/archive/reopen/query only; there is no
   governed cross-store deletion flow and no export action or disclosure.
5. **No conflict identification and no active-commitment amendment.** The
   assembled context already carries active commitments with provenance (the
   semantic substrate a challenge needs), but nothing detects a conflicting
   instruction, records the judgment, or offers a versioned amendment of an
   ACTIVE commitment (the existing amendment flow covers pending proposals
   only). Ambiguity clarification (QLT-010) does not exist.
6. **MSTR-012 real-use proof and disclosures absent.** No real-use exercise
   of retention/deletion/export/pruning, no informed-user retention
   disclosure surface, no documented backup/recovery limitations, no canary
   matrix re-run with real-provider data.
7. **No 07D verification gate.** `verify:stage7c` covers N-C1..N-C25; 07D
   needs its own control matrix and phase gates.

## 4. Area-by-area analysis

### 4.1 Retention-policy enforcement (tombstones, expiry, dependency re-evaluation, removal)

**Exists:** columns, closed 2-state vocabulary, CHECK, assembly/inspection
exclusion of `user-removed`, time-blind assembler invariant, Memory Mode
policy precedent (one durable, user-correctable, inspectable policy record —
the Q5 pattern a retention policy object should follow), append-only lineage.

**Missing:** `expired` and tombstone states (additive migration only);
the user-correctable retention policy record and its inspection surface;
the user-only removal verb/action; the executed enforcement pass; bounded
dependency re-evaluation on removal/expiry.

**Canonical mapping:** `QLT-019`, `QLT-011`, `INV-17`, `P14`, `P17`;
architecture §12.2 (minimum states currently-relevant / retained-for-lineage
/ expired / user-removed; user removal precedence; visible operations;
content-free tombstones; dependency re-evaluation with visible,
lineage-preserving changes).

**Key design constraint (load-bearing):** the ratified stale-proposal policy
(handoff addendum §19.3) and the assembler's time-blindness mean **elapsed
time alone must never change what the model sees**. Expiry therefore must be
a _state transition executed by an explicit, visible enforcement pass_
(scheduled or manual, MSTR-011 precedent), never an assembly-time time
filter. This keeps `QLT-008`/`QLT-011` semantics deterministic and auditable:
between passes, assembly output is stable; after a pass, exclusions are
record-backed states any inspection can show.

**Dependencies:** additive migrations on 07C tables (forward-only, additive
`ALTER`/`CREATE` only); inspection contract extension; removal UI on the
existing workspace island; D2 consumes this removal machinery.

**Irreversible / privacy-sensitive choices:** removal depth (logical removal
with residue disclosure vs physical-purge attempts — SQLite files retain
freed content in free pages until VACUUM; truthful disclosure is required
either way); whether any class of record may auto-expire (irreversible if
content is purged after expiry).

**Owner decisions:** OD-D1 (defaults and expiry scope), OD-D2 (removal
depth and truthfulness) — §5.

### 4.2 Governed deletion and export with cross-store reconciliation

**Exists:** VICT-side governed Mastra conversation deletion with a
reconciliation bound that fails closed; protected store placement; export
disclosure machinery (MSTR-011, Verified); Quellight thread archive.

**Missing:** a governed thread-deletion action in Quellight; a governed
Shared World removal flow that tombstones meaning derived from a deleted
conversation; a governed export action (Shared World and/or conversation)
with disclosure; the cross-store reconciliation record with the documented
rule that claims are bounded by reconciliation rules and the
VICT-authoritative view governs on disagreement (amendment §4); the
informed-user retention disclosure surface.

**Canonical mapping:** `QLT-017`, `MSTR-011`/`MSTR-012`, architecture §12.1
("durable intent, receipts, cross-store reconciliation" pattern), §12.2
(no cross-store atomicity claimed).

**Dependencies:** D1's removal/tombstone semantics; VICT 0.3.1 verified APIs
unchanged — if the governed VICT surface proves insufficient for a genuine
Shared World need, the implementer STOPS and records a GOV-007
framework-change proposal (no product-side workaround).

**Irreversible / privacy-sensitive choices:** conversation deletion is
irreversible content destruction — cascade behavior toward Shared World
meaning must never be silent; exports move real data out of the protected
store (must be canary-scanned, disclosure-headed, and never web-served).

**Owner decision:** OD-D3 (deletion cascade policy) — §5.

### 4.3 Conflict identification and amendment-versus-execution

**Exists:** the semantic substrate — assembled context already delivers
active commitments with provenance to the model; the proposal ceremony
(agent proposes, user decides) can carry a challenge or amendment candidate
without new authority; keyed idempotent mutations; append-only lineage;
`QLT_VERSION_CONFLICT` optimistic concurrency.

**Missing:** the loop policy that identifies a conflicting instruction
against active commitments and surfaces a visible challenge proposal
(`QLT-009`/`P12`); the full `INV-15` distinction — ordinary execution under
a standing commitment (no durable write) versus an explicit versioned
amendment operation (ceremony-confirmed amendment record); the explicit
clarification flow for ambiguous instructions; the visible, correctable
record of every conflict/amendment judgment (architecture §14: semantic
enforcement is deliberative and can be wrong; lineage is the mitigation).

**Authority invariants that bind the design:** the agent keeps NO Shared
World read/list/decision power — conflict identification runs as server-side
loop policy over the bounded assembled context plus the user's turn, and the
agent's only durable act remains a pending proposal. A challenge never
harmonizes silently and never blocks; the user's decision remains
authoritative. Execution-under-a-commitment produces no durable write;
amendment produces one only through explicit user confirmation.

**Dependencies:** proposal-kind vocabulary extension (additive); agent
proposal guidance revision bump (D-Q6-6 bounded-discretion amendment
pattern); turn pipeline (server-side, before provider call); UI proposal
cards already render pending proposals.

**Irreversible / privacy-sensitive choices:** none directly; the risk to
guard is behavioral drift (challenge fatigue or silent harmonization) — both
negative-controlled.

**Owner decision:** OD-D4 (challenge visibility default) — §5.

### 4.4 MSTR-012 bounded real-use and data-protection proof

**Exists:** the declared envelope in docs (local-first, single-actor,
single-process, non-multi-tenant, file-backed); verified MSTR-011 machinery;
the Q6 live-harness discipline (one-shot owner authorization, receipt,
observer, structural-evidence-only commits, fixture privacy, canaries).

**Missing:** the real-use proof itself — retention/pruning/deletion/export
exercised end to end on real data; store-file placement verified
non-web-accessible in the deployed layout; canary/leakage matrix re-run with
real-provider data; the informed-user retention disclosure in the product;
documented backup/recovery limitations.

**Canonical mapping:** `QLT-017`, `MSTR-012`, exit gate item 8.

**Dependencies:** D1+D2 complete (the proof exercises their machinery); a
fresh one-shot owner authorization for the real-use session (the Q6 pattern:
consumed by a receipt; structural metadata only committed; raw conversation
content never enters the repository).

**Irreversible / privacy-sensitive choices:** real user conversation content
will exist in the proof environment; the authorization scope, evidence
minimization, and retention of the proof artifacts themselves are privacy
decisions.

**Owner decision:** OD-D5 (real-use authorization shape) — §5.

### 4.5 Independent verification and handoff into Stage 07E

**Exists:** the phase-gate ladder pattern (`verify:q2`–`verify:q6`,
`verify:stage7c` N-C manifest, browser suites, `npm audit`, consumer gate);
the independent-audit requirements pattern (handoff §17); the formal-closure
record format proven five times (Q1–Q5, Q6/Q7).

**Missing:** the 07D control matrix (N-D-*), the 07D aggregate gate, the
audit, the closure record, the VICT reconciliation, and the §18-style
handoff boundary statement for Stage 07E.

**Canonical mapping:** exit gate §13 (items 5–8, 10, 11 become fully
evidenced), handoff §17 audit discipline, GOV-007.

**Owner decision:** OD-D6 (audit shape: one combined audit vs per-phase) — §5.

## 5. Genuine owner decisions (PENDING — none decided by this document)

Each decision is presented in plain language with a recommended default and
its practical consequences. Until the owner approves, the corresponding work
does not begin.

- **OD-D1 — Retention defaults and expiry scope.** Should anything expire
  automatically? _Recommended default:_ no automatic expiry of commitments,
  claims, or open loops by default; the user may optionally assign an expiry
  to an individual claim; open loops exit only via their canonical four
  exits; any expiry runs only in the visible enforcement pass.
  _Consequence:_ nothing the user relies on silently disappears; expiry
  becomes an opt-in, visible act rather than background behavior.
- **OD-D2 — Removal depth and truthfulness.** When the user removes a
  record, is "removed" logical removal (content withdrawn from every
  surface, content-free tombstone retained, database-file residue disclosed
  in writing) with an optional separate deep-purge action? _Recommended
  default:_ yes — logical removal plus a written plain-language disclosure
  of storage residue, plus an explicit deep-purge (VACUUM-class) action for
  users who want it. _Consequence:_ honest about what file-backed storage
  can guarantee; avoids claiming secure erasure the envelope cannot prove.
- **OD-D3 — Deletion cascade policy.** When deleting a conversation, what
  happens to Shared World meaning derived from it? _Recommended default:_
  the deletion dialog asks every time — "conversation only" (default) or
  "conversation and its shared-world meaning" (tombstoned, visible,
  lineage-preserving); never a silent cascade. _Consequence:_ one extra
  choice per deletion; no surprise loss of durable meaning.
- **OD-D4 — Conflict challenge visibility.** When a user instruction
  conflicts with an active commitment, how visible is the challenge?
  _Recommended default:_ always surface a visible, dismissible conflict
  notice proposal (the agent proposes; the user decides); the agent never
  silently complies and never silently harmonizes. _Consequence:_ possible
  extra friction in the rare conflicting turn; guarantees P12/QLT-009
  behavior is observable rather than vibes.
- **OD-D5 — Real-use proof authorization.** MSTR-012 requires proving the
  machinery on real data. _Recommended default:_ one bounded owner-authorized
  real-use session (Q6 one-shot pattern: explicit authorization, receipt,
  structural-evidence-only records, no raw conversation content committed)
  followed by a short owner organic-use evidence window. _Consequence:_ real
  conversation content exists in the local proof environment only; the
  repository receives structural evidence; a second authorization would be
  required for any repeat.
- **OD-D6 — Verification and audit shape.** _Recommended default:_ one
  combined independent audit of all 07D phases after D4 (the Stage 07C Q7
  pattern), with per-phase self-verification gates during implementation.
  _Consequence:_ cheapest authoritative path; per-phase audits would be
  slower and more expensive without adding independence at the end.

## 6. Recommended phase map (evaluation of the proposed D1–D5)

The proposed decomposition (D1 retention; D2 deletion/export; D3
conflict/amendment; D4 MSTR-012; D5 verification/closure) is correct in
content. Repository evidence supports one efficiency revision: D1 and D3 are
nearly disjoint in code and can run as two parallel lanes under ONE joint
contract freeze, because the frozen-contract-module pattern from Stage 07C
(Q3/Q4) exists precisely to let lanes share frozen contract data without
editing it concurrently. The real D1→D2 dependency (removal machinery feeds
deletion/export) and the D4 dependency on both are respected.

```text
D0  Planning and owner decisions (this document)          — DONE (docs only)
D1a Joint Stage 07D contract freeze (all lanes' identifiers,
    vocabularies, action ids, codes, budgets, disclosure texts;
    one commit; no executable change)                     — after owner decisions
D1  Lane A — retention, tombstones, expiry (enforcement pass),
    dependency re-evaluation, user removal + UI           — ∥ with D3
D3  Lane B — conflict identification, amendment-vs-execution,
    clarification flow, judgment records                  — ∥ with D1
D2  Governed deletion/export, cross-store reconciliation,
    disclosures (integrates A+B)                          — after A+B green
D4  MSTR-012 real-use and data-protection proof           — after D2
D5  Independent verification, formal closure, 07E handoff — after D4
```

If the owner prefers strictly sequential verification, D1→D3→D2 in series is
the conservative fallback; the parallel plan's savings are one calendar
overlap of two medium phases at the cost of a slightly larger joint freeze.

**Lane file ownership (disjoint during D1/D3):**

- Lane A: `meaning-contract.ts` retention sections (frozen at D1a), `meaning-store.ts`,
  `sqlite.ts`, `migrations.ts`, `context-assembler.ts`, `inspection-contract.ts`/
  `inspection-surface.ts`, retention tests, removal UI slice.
- Lane B: ceremony action implementation (`ceremony-actions.ts`), turn pipeline
  (`turn-admission.ts`, `application-server.ts`), `proposal-capability.ts`/
  `proposal-guidance.ts` (revision bump), conflict/amendment tests, challenge UI slice.
- Shared files (`definition.ts` action registry, ceremony contract data) are
  amended once, in the D1a freeze commit, and not edited by either lane afterward.

## 7. Implementation-efficiency rules

- **Dependency order:** D0 → D1a → (D1 ∥ D3) → D2 → D4 → D5. No phase begins
  before its predecessor's gate is green; D4 requires a fresh explicit owner
  authorization; D5 requires the audit freeze (no repository changes between
  freeze and closure except the closure/status docs themselves).
- **Contract-freeze points:** D1a (joint freeze, covers both lanes); D2 entry
  (integration scope note, additive only); D5 audit freeze. The Q6/Q7 rule
  holds: no phase may soften a frozen fence; material changes need a freeze
  amendment, recorded before the executable change.
- **Required negative controls (new N-D matrix, extending N-C1..N-C25):**
  - N-D1-1 expired/removed material never enters assembled context.
  - N-D1-2 removal/retention-write without user authority fails closed; the
    agent cannot remove or expire anything.
  - N-D1-3 the enforcement pass is idempotent, crash-safe, and visibly
    reports incomplete runs (MSTR-011 pruning precedent).
  - N-D1-4 no ghost derivatives: removing cited evidence re-evaluates
    dependent records visibly; dangling references are structurally impossible.
  - N-D1-5 tombstones are content-free and lineage-preserving; removed
    content cannot resurrect as fresh (extends the existing
    `meaning-store.ts` guard).
  - N-D1-6 assembler time-blindness preserved: identical assembly before/after
    an unexecuted pass; expiry only via recorded states.
  - N-D2-1 incomplete cross-store deletion fails closed with a truthful error
    and the VICT-authoritative view recorded; no partial silent state.
  - N-D2-2 exports are canary-scanned (no credentials), scope-bounded, and
    carry the disclosure header.
  - N-D2-3 the agent cannot delete or export (authority fence).
  - N-D3-1 execution under a standing commitment produces no durable write.
  - N-D3-2 amendment of an active commitment requires explicit user
    confirmation; silent overwrite structurally impossible (extends N-C8/C9).
  - N-D3-3 ambiguous instruction yields clarification, never action.
  - N-D3-4 every conflict/amendment judgment leaves a visible, correctable
    record; an unrecorded judgment is structurally impossible.
  - N-D4-1 canary/leakage matrix absent from every retained and observable
    surface, re-run with real-provider data.
  - N-D4-2 the real-use receipt refuses re-execution.
  - N-D5-1 the 07D aggregate gate fails (non-zero) if any control fails.
- **Operator-data and credential protections:** tests and gates never touch
  real operator data (D-Q5-3 binding decision); verification stores live in
  temp directories; provider requests occur only under explicit one-shot
  owner authorization (D4) with the Q6 observer discipline; credentials never
  in tests, stores, streams, traces, or diagnostics; `.pi/` and
  `.quellight-data` are never read by any verification; raw conversation
  content never enters the repository (structural metadata only).
- **Verification after each phase:** every commit — FastGate only (below).
  Phase end — new phase gate script (`verify:d1`, `verify:d2`, `verify:d3`,
  `verify:d4`) running the phase's node suites + N-D controls + typecheck.
  D2 end — one consolidated real-browser pass covering removal, deletion/
  export, and challenge UI (all UI lands by D2/D3; one browser session, not
  three). D4 end — the MSTR-012 gate only. D5 — the full authoritative
  ladder exactly once: `npm ci`, `verify:consumer`, node+ui suites,
  `verify:stage7d` (extended aggregate), browser suites, `npm audit
--omit=dev`, `git diff --check`.
- **Expensive ladders once at meaningful boundaries:** `npm ci` +
  `verify:consumer` + `npm audit` only at the D5 audit freeze (plus the D2
  integration point if dependency metadata changed — it should not);
  real-browser suites once after lane merge (D2 end) and once at D5; no
  browser or aggregate run for docs-only work.
- **FastGate rules (documentation-only commits, incl. all D0/D5 closure
  work):** `format:check` + `git diff --check` + narrow status-consistency
  greps. Never full ladders, never browser suites, never `npm ci` for docs
  commits — the multi-hour Q6/Q7 verification cost is reserved for the two
  integration boundaries and the final ladder.
- **Framework fence:** D2 uses the pinned VICT 0.3.1 governed APIs as-is. If
  they prove insufficient, STOP and record a GOV-007 framework-change
  proposal; no product-side workaround, no VICT edit inside the Quellight
  repository work.

## 8. Explicit non-goals for Stage 07D

No autonomous initiative, event/time activation beyond the enforcement pass,
ingestion, learning, delegation, or full `SYNC`; no project-scoped
conversations or multi-tenancy; no agent confirmation or removal authority of
any kind; no constitution-custody ceremony (the reserved §19.1 question
stays open); no provider rotation, voice, or model-swap certification; no
Stage 07E work. The transcript-versus-Shared-World separation, the 21-action
authority envelope, and the ratified OQ6 model are preserved unchanged
except where a freeze amendment explicitly extends the proposal vocabulary
(conflict notice / amendment candidate / clarification) without granting the
agent any new durable power.

## 9. What this phase did NOT do

No `npm ci`, no builds, no test suites, no browser suites, no provider
requests, no credential access, no operator-data access, no `.pi/` access.
Checks used: fresh `git fetch` on both repositories, ancestry and status
verification, narrow documentation greps, Prettier formatting, and
`git diff --check`. Nothing was frozen, implemented, verified, or closed.

## 10. Status

```text
QUELLIGHT STAGE 07D PLANNING COMPLETE — OWNER DECISIONS PENDING
STAGE 07D IMPLEMENTATION HAS NOT BEGUN
STAGE 07E HAS NOT BEGUN
Stage 07 remains In Progress.
```
