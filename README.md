# Quellight

A private, single-user **conversation-first workspace** built on the
[VICT framework](https://www.npmjs.com/org/victframework) (release set
`vict-release-set@1/0.3.0`). Quellight is implemented as a SvelteKit
application that **consumes only published `@victframework/*@0.3.0`
packages** from the public npm registry — no VICT source is vendored,
linked, or patched.

## Status

```text
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q1: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q2: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (durable Shared World schema)
Stage 07C Phase Q3: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (governed confirmation ceremony and quiet memory inbox)
Stage 07C Phase Q4: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (deterministic Shared World context assembly; H-1 remediated and independently re-verified closed)
Stage 07C Phase Q5: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (Shared World inspection, user memory control, one durable global Memory Mode; B-1/H-1 remediated and independently re-verified closed)
VICT-M-1: INDEPENDENTLY VERIFIED AND FORMALLY CLOSED (truthful write-effect capability `qlt.proposal.draft@2/write`; Quellight exact-pinned to the STABLE `@victframework/*@0.3.0` = `vict-release-set@1/0.3.0`, content ID `v1_5f3a074a…`; `latest` = 0.3.0; the `0.3.0-rc.1` candidate and its recovered evidence chain remain immutable historical record)
Stage 07C Phase Q6: IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION (deterministic final verification: the offline gates and the aggregate N-C25 are green; the bounded live-provider ceremony proof N-C24 was EXECUTED ONCE on 2026-09-21 at `8d1273b…` and FAILED TRUTHFULLY at its first provider turn — the provider rejected the configured credential with an HTTP 401 (authentication failure) response class at the frozen endpoint; true process exit 1; one provider turn of the allowed six used; zero retries; no fallback; zero durable Shared World effects; credential byte-scans completed clean; safe cleanup verified; NOT rerun — the one-execution allowance for that authorization is consumed and a fresh owner decision is required for any further live execution; the freeze had zero amendments; the harness fixes `c0e5a93…` and `6a81f66…` preceded the execution unchanged; see `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`)
Stage 07C Phase Q7: BLOCKED — NOT BEGUN (the independent audit is permitted only after the live proof has executed exactly once and passed; the live proof executed once and FAILED, so Q7 remains blocked)
Stage 07:  IN PROGRESS (07A closed; 07B closed; Q1 closed; Q2 closed; Q3 closed; Q4 closed; Q5 closed; M-1 CLOSED — stable 0.3.0 adopted; Q6 implemented — live proof executed once and failed (provider credential rejected); Q7, 07D, 07E remaining)
```

**VICT-M-1 remediation (2026-09-21; superseded 2026-09-21 by the
independent re-verification and the stable release — see the status block
and `docs/report/QUELLIGHT-STAGE-07C-M-1-STABLE-REPIN.md`; the text below
is preserved as its dated record):** Quellight adopted the
coordinated verification candidate `@victframework/*@0.3.0-rc.1`
(`vict-release-set@1/0.3.0-rc.1`, published through the trusted-OIDC
workflow under the candidate tag `vict-0.3.0-rc`; `latest` remains
`0.2.0`; stable `0.3.0` is NOT yet published) and advanced the pinned
capability to `qlt.proposal.draft@2` with the TRUTHFUL effect class
`write` — a durable, epistemically inert proposal-row creation. Quiet
in-turn completion is preserved by the exact host-owned quiet-write
approval policy supplied through the composition only; every invocation
durably records the truthful effect, the approval decision, and its
closed-code basis; zero approval rows, zero approver identities, and
zero awaiting-approval events exist for a quiet proposal write; the
ceremony, memory modes, inspection, and agent isolation are unchanged.
The authoritative ladder (`npm ci`; `verify:consumer`; `verify:quellight`;
`npm audit --omit=dev`; `git diff --check`) ran exactly once, first-run
green. Record: `docs/report/QUELLIGHT-STAGE-07C-M-1-REMEDIATION.md`;
decision register D-Q-M1-1. At that date M-1 was REMEDIATED — AWAITING
INDEPENDENT VERIFICATION; it has since been independently re-verified
(`CLEARED — CONDITIONAL STABLE RELEASE PERMITTED`) and FORMALLY CLOSED,
and Quellight is exact-pinned to the stable `@victframework/*@0.3.0`
(decision register D-Q-M1-2; the `0.3.0-rc.1` details below are the dated
candidate record). Phase Q6 had not begun at that date; Q6 contract and
implementation planning is now permitted and has not begun.

Stage 07B is formally closed (2026-09-10) against the audited evidence
SHA `1e0c0f53d62cde6d5031f865fe871ac1d41c9a9b`; see
`docs/report/QUELLIGHT-STAGE-07B-FORMAL-CLOSURE.md`. In Stage 07C Phase
Q1 (2026-09-11) Quellight adopted the immutable release set
`vict-release-set@1/0.2.0` (`@victframework/*@0.2.0`, content ID
`v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172`,
independently re-derived from the public registry) and migrated thread
mutations to the released governed mutation boundary; see
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-CONTROLLED-ADOPTION.md` and
decision register D-10. Phase Q1 was independently verified with verdict
`VERIFIED WITH NON-BLOCKING ISSUES — PHASE Q1 FORMAL CLOSURE PERMITTED`
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-INDEPENDENT-VERIFICATION.md`)
and is FORMALLY CLOSED (2026-09-13;
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q1-FORMAL-CLOSURE.md`; VICT
constitutional closure `0f4f72b…`, System Reference v0.4.13 §0.21).
Phase Q2 — the durable Shared World schema foundation (2026-09-13) — was
independently verified (2026-09-16; verdict `VERIFIED WITH NON-BLOCKING
ISSUES — READY FOR FORMAL CLOSURE`, audit commit `95f036995…`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-INDEPENDENT-VERIFICATION.md`)
and is FORMALLY CLOSED (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-FORMAL-CLOSURE.md`):
one additive migration (`qlt-meaning-foundation`, schema version 2)
creating the proposal/ceremony, epistemic-claim, commitment, open-loop,
correction-lineage, and source-link record families with retention
metadata; closed validators and lifecycle vocabularies; the
`SharedWorldMeaningStore` repository with atomic ceremony/correction
transactions, keyed idempotency, version-based (never time-based)
proposal staleness, deterministic current-effective resolution, and
repository-level inspection reads; a permanent adversarial suite and the
focused `verify:q2` gate. The audit found zero Blocking/High/Medium
issues; the two Low findings are carried (F-Q2-1 — a historical prose
index-name erratum, the normative inventory enforcing all sixteen
indexes; F-Q2-2 — user-attributed-only withdrawal, a binding Q3
representation decision). Q2 wires NO production meaning or confirmation
path: schema existence alone never makes material canonical,
model-visible, or user-confirmed; `/api/act` and the declared action
surface are unchanged; any future effectful write uses the governed VICT
Phase Q3 — the governed confirmation ceremony and quiet memory inbox
(2026-09-16) — was independently verified on 2026-09-16 (verdict
`VERIFIED WITH NON-BLOCKING ISSUES — READY FOR FORMAL CLOSURE`, audit
commit `a8b702f…`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-INDEPENDENT-VERIFICATION.md`;
zero Blocking/High findings; three Medium and three Low non-blocking
findings carried to the closure) and is FORMALLY CLOSED
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-FORMAL-CLOSURE.md`; audited
implementation tree `2e494723…`; full first-run verification ladder
green incl. TEST-1 and `npm audit --omit=dev` clean). The carried
non-blocking findings: M-1 the pinned capability's disclosed `read`
effect-class metadata (the framework-change proposal remains owed to
the VICT owners); M-2 the frozen Escape-to-close interaction item is
unimplemented (Close control and focus-return exist; truthful test owed
in the next inbox change); M-3 process discipline — commit `8dc0032`
bundled the A-AMEND-2 amendment with Lane C UI/test implementation
(content verified conformant; amendment and consuming implementation
must never share a commit in future freezes). The Q3 surface:
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONFIRMATION-CEREMONY-IMPLEMENTATION.md`;
frozen contract:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md`, including
dated amendments A-AMEND-1…4). Q3 activates the safe doorway from
conversation into the Shared World: the agent can draft epistemically
inert pending proposals through exactly one pinned capability
(`qlt.proposal.draft@1`, server-derived turn/thread correlation, budget-
gated, with no Shared World read or decision power); the user reviews
them in a quiet, user-opened memory inbox inside the existing workspace
and can Confirm, Edit, Reject, Withdraw, direct-Save ("Remember this"),
and correct confirmed records — all through the governed `/api/act`
boundary and the Q2 store's keyed idempotency and version-staleness
rules. FENCE-1 ingress hardening (D-Q3-6) fails prototype-named or
otherwise prohibited request keys closed with the stable
`QLT_INGRESS_PROHIBITED_FIELD` code. TEST-1 permanently proves the
ceremony recovery in a real browser (`scripts/browser-ceremony-check.mjs`;
`npm run verify:browser-ceremony`). Confirmed Shared World meaning
remains unavailable to the agent — that is Phase Q4. Phase Q4 (2026-09-16)
was contract-frozen and implemented under FastGate; it is recorded as
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` — not verified, not
closed; see `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md`
(freeze SHA `b4bf759…`, no amendments) and
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTEXT-ASSEMBLY-IMPLEMENTATION.md`.
Q4 activates read-side continuity with NO new model-facing capability:
every new agent turn deterministically selects only user-confirmed,
current-effective Shared World records (three frozen layers — current-
thread, global, other-thread; classes open loops → commitments → claims;
`updatedAt DESC, id ASC`; budgets 8 records / 4096 UTF-8 bytes with
whole-record skipping), freezes the selection for that turn, persists an
immutable per-turn assembly record (additive migration 3, UNIQUE turn_id,
deterministic SHA-256 fingerprint, server-derived turn identity,
retries converge), and delivers the snapshot at the Quellight-owned model
seam as ONE user-role message (one text part) inserted immediately before
the trailing user message — bounded data, never authority; the durable
transcript is never touched; the agent envelope remains EXACTLY
`qlt.proposal.draft` (now `@2/write` under the M-1 remediation; see the status section) with no read/list/search power. The serializer is
deterministic and delimiter-safe (no `<`, `>`, `&`, or unescaped `/` byte
inside record content, so markers cannot be forged); conflicts supported
by structured identity are excluded as a group (`conflict-ambiguous`);
assembly failure means zero-memory operation with the truthful `failed`
record and the quiet `Memory unavailable for this turn` tray line
(`Your last reply here used N memories.` / `No memories used`). Carried
Q3 obligations closed in Q4: M-2 (real Escape-to-close with focus return,
component- and browser-proven), L-1 (ordering repaired to
`updatedAt DESC, id ASC`; sort surface restricted to exactly `updatedAt`),
L-2 (real-browser stale refusal through the real governed boundary in the
EXTENDED ceremony script), L-3 (Git-derived changed-file inventory,
independently re-derived and compared by the new `verify:q4` gate wired
into `verify:quellight` step 2e). M-1 remained recorded at that date
with its hard deadline (the truthful noncanonical/proposal VICT
effect-class correction had to land before the Phase Q6 live-provider
proof and the Stage 07C final audit) — it has since been independently
re-verified and FORMALLY CLOSED (2026-09-21; see the status block).
Q4 has no live-provider path; live-model injection resistance
remains Q6. Phase Q5 had not begun at this Q4 checkpoint.

The Q4 independent verification (2026-09-16,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-INDEPENDENT-VERIFICATION.md`,
audit commit `821d4f8…`) returned `VERIFIED WITH ONE HIGH FINDING` and
permitted no formal closure: finding **H-1** proved that two overlapping
open turns in ONE conversation could cross snapshots (the older turn's
later model calls receiving the newer turn's snapshot, and the newer turn
receiving zero injection while its durable record claimed `complete`).
The owner decision made the rule binding — **Quellight permits exactly
one active agent turn per conversation; a distinct request arriving while
a reply remains active is rejected truthfully and creates no second turn;
a retry of the same logical request preserves VICT's existing idempotent
replay behavior** — and the H-1 remediation (2026-09-16,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION.md`, remediation
contract
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION-CONTRACT.md`)
implemented both layers: a race-safe admission boundary at the real turns
ingress (the admission decision and the durable turn start are atomic for
the supported single-process deployment; a distinct overlapping request
is refused with the stable, non-echoing code `QLT_TURN_ALREADY_OPEN` —
"A reply is already in progress for this conversation." — quietly, with
no modal, no tray opening, no focus change, and no queueing; same-key
retries pass through to VICT's idempotent disposition unchanged), and a
model-seam defensive backstop (`resolveForStream` attributes a snapshot
only when EXACTLY ONE open turn exists for the conversation and actor;
every ≥2-open-turn combination in any recorded/unrecorded/in-flight
mixture fails closed with zero injection, no in-flight promise
borrowing, and no new assembly — effective even when the admission
invariant is bypassed). Different conversations still run concurrently.
Q4 is now FORMALLY CLOSED (2026-09-17): the fresh independent
re-verification (`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-INDEPENDENT-RE-VERIFICATION.md`,
audit commit `e0e0f19…` against the untouched tree `6fd1ba8…`)
independently reproduced the original H-1 crossover on the audited
tree `c4896bef…` and proved it dead on the remediated tree (the same
staging fails closed), verified race-safe admission with deep zero
effect for refused requests, exact VICT idempotency preservation, the
complete seam-state matrix, restart fencing, failure truth, and the
quiet refusal UX, and ran the authoritative ladder green first-run
(0 vulnerabilities). Verdict: `VERIFIED WITH NON-BLOCKING ISSUES — Q4
FORMAL CLOSURE PERMITTED` (0 Blocking · 0 High · 0 Medium · 2 Low ·
2 Observations); carried: L-R1 (per-conversation critical-section
settled-entry retention, ≈102 B/entry, conversation-count axis only)
and L-R2 (unreachable `no-open-turn` pass-reason member), both with
dispositions in the closure report. Formal closure:
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-FORMAL-CLOSURE.md`. The
audit's L-1
duplicated status line is corrected here and in the system reference;
L-2's implementation-identity lag is reconciled additively (the Q4
audited implementation tree is `c4896bef…`; executable content unchanged
since `bf7fec3`; the audit-report commit is `821d4f8…`). L-3 (a
pre-existing Q3 latent defect: confirming a correction-kind proposal
through `confirmProposal` always rolls back `QLT_RECORD_EXISTS` because
of a duplicate source-thread link, while the active production
correction path remains `applyCorrection`) is recorded as a Q5/backlog
obligation only and is NOT repaired by the remediation. The pending-
correction fixture limitation and the Q3 correction-proposal deferral
remain preserved; M-1 kept its hard deadline at this Q4-H1 checkpoint
(before the Phase Q6 live-provider proof and the Stage 07C final audit)
— it has since been independently re-verified and FORMALLY CLOSED
(2026-09-21; see the status block). A FUTURE turn-
steering direction (user steers an answer while it is generated, as an
explicit operation targeting the exact active turn — never a second
overlapping turn) is RECORDED in the decision register as a deferred
design input requiring its own future contract; it is NOT implemented.
Phase Q5 is independently re-verified and FORMALLY CLOSED (2026-09-20;
the initial audit returned NOT VERIFIED, and Q5-B-1, Q5-H-1, and
Q5-M-1 were remediated under the frozen remediation contract and
independently re-verified closed — re-verification commit `6cf7dcd…`,
formal closure `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-FORMAL-CLOSURE.md`
at commit `6088fc3…`; L-1 and L-2 remain non-blocking carried issues;
VICT-M-1 was still open at that date — it has since been independently
re-verified and FORMALLY CLOSED, 2026-09-21); at this Q4-H1 checkpoint
Q6–Q7 had not begun. Q4 has no
live-provider path; live-model injection resistance remains Q6 and was
blocked until VICT-M-1 was resolved — that resolution completed
2026-09-21 with the stable `@victframework/*@0.3.0` repin. VICT was
pinned at the 0.2.0 boundary when Q1 adopted it and is now pinned at the
STABLE `0.3.0` boundary (see the status block); VICT `0.1.0`/`0.1.1`
remain published but
are not adopted — any later change requires an explicit compatibility
decision and fresh verification.

Phase Q5 (2026-09-20) makes the existing Shared World understandable and
controllable by the user, and is independently re-verified and FORMALLY
CLOSED (`VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED`; the
initial audit returned NOT VERIFIED, and Q5-B-1, Q5-H-1, and Q5-M-1
were remediated and independently closed; L-1 and L-2 remain carried);
see
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md` (freeze
SHA `e2d8436…`, no amendments) and
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-MEMORY-INSPECTION-IMPLEMENTATION.md`
(executable verification SHA `a2d1f27…`). Owner decision Q5-OD-1
(decision register D-Q5-1) approved ONE durable global Memory Mode with
exactly three choices — `Across conversations` (default; Q4 behavior
preserved byte-for-byte), `Within each conversation only` (global and
other-conversation records excluded with truthful bounded
`scope-excluded` evidence), and `Memory off` (zero injection, truthfully
evidenced) — changed only inside the user-opened Memory surface through
the declared, user-attributed, idempotent `act.setMemoryMode`, applied to
the next not-yet-started turn, and never able to reinterpret a turn
already admitted: the effective mode is resolved inside the per-
conversation admission critical section, carried immutably in the turn
assembly scope, and durably recorded as immutable per-turn evidence
(additive migration 4, `qlt-memory-mode-policy`). The quiet four-area
Memory surface (Pending / Current / History / Used for reply) provides
read-only inspection through `qlt.inspection@1` (records, provenance,
append-only correction lineage, per-turn assembly evidence with the
applied mode and truthful truncation), the lifecycle controls (Correct,
Retire claim, Release commitment, Resolve/Abandon/Transform), and the
Memory Mode control; `Used for reply` shows recorded evidence only and
never recomputes a past turn. The action inventory grew 19 → 21
(`act.queryInspection`, `act.setMemoryMode`); the agent envelope remains
EXACTLY `qlt.proposal.draft@2/write` (M-1 remediation) with no read/list/search/decision power
and no Memory Mode authority. The narrow L-3 defect (correction-kind
proposal confirmation rollback) is repaired without authority expansion,
and the three D-11 deferred Svelte warnings are repaired with a permanent
zero-warning development-start gate (`verify:dev-start` fails on every
project warning). M-1 remained open with its hard deadline at this Q5
closure checkpoint (before the Phase Q6 live-provider proof and the
Stage 07C final audit) — it has since been independently re-verified and
FORMALLY CLOSED (2026-09-21; see the status block).

Stage 07B/07C-Q1 deliver the **conversation foundation** on the governed
mutation boundary: one pinned provider profile, real streaming
conversation through `@victframework/mastra`, persistent threads and
ordered transcripts, resumable `vict.agent-stream@1` SSE, truthful
disconnect / reconnect / cancel / forced-restart behavior,
Quellight-owned SQLite foundations, a minimal responsive accessible UI,
and the governed `/api/act` ingress.

It is **not yet** a persistent cognitive partner in full: Shared World
meaning, the governed ceremony, deterministic context assembly, and user
inspection/Memory Mode exist (Q2–Q5, each independently verified and
formally closed); real-use retention/data-protection proof
(retention/recovery completion, 07D) and the exit gate (07E) are later
stages. Transcript persistence is **not** Shared World
continuity.

## Quick start

Requirements: Node.js >= 22.13.0, npm >= 10.9.0.

```bash
npm ci
npm run dev
```

Open the printed local URL. Without any configuration the app runs in
**offline-fixture mode** (deterministic responses, no network calls to
any provider). See `docs/setup.md` for the operator configuration,
including the live provider credential, and `docs/database.md` for the
store layout.

## Verification

```bash
npm run verify:consumer        # registry-only dependency proof (N-1/N-2; 0.3.0 set)
npm run verify:governance      # governed mutation boundary structural gate (Phase Q1)
npm run verify:q2              # Q2 durable-schema conformance gate (schema/deterministic/repository/structural)
npm run verify:q3              # Q3 governed-ceremony structural + deterministic gate
npm run verify:browser-ceremony # TEST-1 real-browser ceremony recovery proof (Q3, extended Q4 + Q5 + Q6)
npm run verify:quellight       # full deterministic offline gate (N-20, incl. Q1–Q5 gates + TEST-1)
npm run verify:q6              # Q6 focused deterministic gate (bounds/envelope/live-gate/authority/fresh-thread/hostile/restart/seam)
npm run verify:stage7c         # the Stage 07C aggregate gate (N-C25; N-C1..N-C25 coverage manifest + Q2–Q5 + Q6 gates)
npm run verify:live-provider   # bounded live proof (requires explicit gate; Stage 07B)
npm run verify:q6:live         # the bounded LIVE Shared World ceremony proof (N-C24; requires explicit gate; NEVER automatic)
```

`verify:live-provider` refuses to run unless `QUELLIGHT_LIVE_PROOF=1`
**and** `OLLAMA_API_KEY` is present in the process environment. It is an
operator action, never part of the automated test suite.
`verify:q6:live` (the Q6 bounded live ceremony, N-C24) has the same
explicit double gate, runs OUTSIDE every automatic gate, and must run
EXACTLY ONCE after all offline gates. Current status: it WAS executed
exactly once, on 2026-09-21 at tree `8d1273b…`, and FAILED truthfully
(exit 1) at its first provider turn — the provider rejected the
configured credential (HTTP 401 authentication-failure class) at the
frozen endpoint. It was NOT rerun; the one-execution allowance for that
authorization is consumed; a fresh dated owner decision is required
before any further live execution. See
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-PROOF-FAILURE.md`,
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md`, and the
frozen `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md`.

## License

All rights reserved. Quellight is a private product repository
(`private: true`, UNLICENSED). The VICT framework is consumed as an
Apache-2.0 dependency; that license does not transfer to Quellight.
