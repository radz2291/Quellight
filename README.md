# Quellight

A private, single-user **conversation-first workspace** built on the
[VICT framework](https://www.npmjs.com/org/victframework) (release set
`vict-release-set@1/0.1.0`). Quellight is implemented as a SvelteKit
application that **consumes only published `@victframework/*@0.1.0`
packages** from the public npm registry — no VICT source is vendored,
linked, or patched.

## Status

```text
Stage 07B: IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
Stage 07C: ACCEPTED SEQUENCE — NOT BEGUN
```

Stage 07B delivers the **conversation foundation**: one pinned provider
profile, real streaming conversation through `@victframework/mastra`,
persistent threads and ordered transcripts, resumable
`vict.agent-stream@1` SSE, truthful disconnect / reconnect / cancel /
forced-restart behavior, Quellight-owned SQLite foundations, and a
minimal responsive accessible UI.

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
npm run verify:consumer        # registry-only dependency proof (N-1/N-2)
npm run verify:quellight       # full deterministic offline gate (N-20)
npm run verify:live-provider   # bounded live proof (requires explicit gate)
```

`verify:live-provider` refuses to run unless `QUELLIGHT_LIVE_PROOF=1`
**and** `OLLAMA_API_KEY` is present in the process environment. It is an
operator action, never part of the automated test suite.

## License

All rights reserved. Quellight is a private product repository
(`private: true`, UNLICENSED). The VICT framework is consumed as an
Apache-2.0 dependency; that license does not transfer to Quellight.
