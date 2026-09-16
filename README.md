# Quellight

A private, single-user **conversation-first workspace** built on the
[VICT framework](https://www.npmjs.com/org/victframework) (release set
`vict-release-set@1/0.2.0`). Quellight is implemented as a SvelteKit
application that **consumes only published `@victframework/*@0.2.0`
packages** from the public npm registry — no VICT source is vendored,
linked, or patched.

## Status

```text
Stage 07B: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q1: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED
Stage 07C Phase Q2: VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED (durable Shared World schema)
Stage 07C Phase Q3: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (governed confirmation ceremony and quiet memory inbox)
Stage 07C Phases Q4–Q7: NOT BEGUN (Shared World meaning remains unavailable to the agent)
Stage 07:  IN PROGRESS (07A closed; 07B closed; Q1 closed; Q2 closed; Q3 implemented; Q4–Q7, 07D, 07E remaining)
```

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
(2026-09-16) — is IMPLEMENTED and AWAITING INDEPENDENT VERIFICATION
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
remains unavailable to the agent — that is Phase Q4, which has not begun.
0.2.0 boundary. Phases Q4–Q7 have not begun; VICT `0.1.0`/`0.1.1` remain published but
are not adopted — any later change requires an explicit compatibility
decision and fresh verification.

Stage 07B/07C-Q1 deliver the **conversation foundation** on the governed
mutation boundary: one pinned provider profile, real streaming
conversation through `@victframework/mastra`, persistent threads and
ordered transcripts, resumable `vict.agent-stream@1` SSE, truthful
disconnect / reconnect / cancel / forced-restart behavior,
Quellight-owned SQLite foundations, a minimal responsive accessible UI,
and the governed `/api/act` ingress.

It is **not yet** a persistent cognitive partner: Shared World meaning,
ceremony (07C), retention/recovery completion (07D), and the exit gate
(07E) are later stages. Transcript persistence is **not** Shared World
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
npm run verify:consumer        # registry-only dependency proof (N-1/N-2; 0.2.0 set)
npm run verify:governance      # governed mutation boundary structural gate (Phase Q1)
npm run verify:q2              # Q2 durable-schema conformance gate (schema/deterministic/repository/structural)
npm run verify:q3              # Q3 governed-ceremony structural + deterministic gate
npm run verify:browser-ceremony # TEST-1 real-browser ceremony recovery proof (Q3)
npm run verify:quellight       # full deterministic offline gate (N-20, incl. Q1/Q2/Q3 gates + TEST-1)
npm run verify:live-provider   # bounded live proof (requires explicit gate)
```

`verify:live-provider` refuses to run unless `QUELLIGHT_LIVE_PROOF=1`
**and** `OLLAMA_API_KEY` is present in the process environment. It is an
operator action, never part of the automated test suite.

## License

All rights reserved. Quellight is a private product repository
(`private: true`, UNLICENSED). The VICT framework is consumed as an
Apache-2.0 dependency; that license does not transfer to Quellight.
