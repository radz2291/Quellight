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
Stage 07C Phase Q1: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
Stage 07C Phases Q2–Q7: PENDING (Shared World meaning and ceremony has not begun)
Stage 07:  IN PROGRESS (07A closed; 07B closed; Q1 awaiting verification; Q2–Q7, 07D, 07E remaining)
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
decision register D-10. Phase Q1 awaits independent verification; VICT
`0.1.0`/`0.1.1` remain published but are not adopted — any later change
requires an explicit compatibility decision and fresh verification.

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
npm run verify:quellight       # full deterministic offline gate (N-20, incl. Q1 gates)
npm run verify:live-provider   # bounded live proof (requires explicit gate)
```

`verify:live-provider` refuses to run unless `QUELLIGHT_LIVE_PROOF=1`
**and** `OLLAMA_API_KEY` is present in the process environment. It is an
operator action, never part of the automated test suite.

## License

All rights reserved. Quellight is a private product repository
(`private: true`, UNLICENSED). The VICT framework is consumed as an
Apache-2.0 dependency; that license does not transfer to Quellight.
