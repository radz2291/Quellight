# Local setup

## Requirements

- Node.js >= 22.13.0
- npm >= 10.9.0

## Install

```bash
npm ci
```

(If you change dependencies, use `npm install --legacy-peer-deps` — see
decision register D-5. The committed lockfile reproduces with plain
`npm ci`.)

## Run

```bash
npm run dev       # development
npm run build     # production build (adapter-node)
node build        # run the production server
```

## Offline-fixture mode (default)

With no configuration, the app runs fully offline: responses come from
the deterministic fixture model, which replies to **scripted prompts**
(the workspace disclosure names them, e.g. `Hello`). Unscripted inputs
truthfully produce an empty response. No provider is contacted.

## Protected configuration

Copy `.env.example` to `.env` and fill values **in your own
environment**. `.env` is git-ignored and must never be committed.

Credential rules (binding):

- the Ollama Cloud API key lives only in the process environment as
  `OLLAMA_API_KEY`;
- never in source, configuration objects, URLs, logs, errors, stream
  events, snapshots, tests, documentation, browser bundles, or SQLite
  bytes (negative-controlled with fresh high-entropy canaries);
- when the variable is absent, live mode fails closed with the stable
  sanitized error `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE`; the product
  keeps working in offline-fixture mode;
- never echo any part of the credential — not in chat, not in reports.

The live provider activates only when **both**:

1. `QUELLIGHT_LIVE_PROOF=1` (explicit gate), and
2. `OLLAMA_API_KEY` is present in the environment.

## Environment variables

| Variable                      | Purpose                                                  | Default                      |
| ----------------------------- | -------------------------------------------------------- | ---------------------------- |
| `QUELLIGHT_PROFILE`           | pinned provider profile                                  | `ollama-cloud/glm-5.3-flash` |
| `OLLAMA_API_KEY`              | provider credential (value never leaves the environment) | —                            |
| `QUELLIGHT_ACTOR_TOKEN`       | loopback bearer token (browser never holds it)           | ephemeral per process        |
| `QUELLIGHT_DATA_DIR`          | bounded relative data directory                          | `.quellight-data`            |
| `QUELLIGHT_PORT`              | public port                                              | 5173 dev / 4173 preview      |
| `QUELLIGHT_TURN_DEADLINE_MS`  | bounded turn deadline (1000–600000)                      | 120000                       |
| `QUELLIGHT_MAX_OUTPUT_TOKENS` | per-turn output cap (64–1024)                            | 1024                         |
| `QUELLIGHT_LIVE_PROOF`        | live-proof gate (`1` to enable)                          | off                          |
| `QUELLIGHT_RETENTION_*`       | Mastra-side retention bounds                             | —                            |

## Verification ladder

```bash
npm run verify:consumer     # N-1/N-2: registry-only dependency proof
npm run verify:quellight    # N-20: full deterministic offline gate
npm run verify:live-provider
```

`verify:quellight` runs: format check, typecheck, node-side tests
(composition, Shared World, restart, reconnect), browser-side island
tests, production build with a closed-allowlist build-log warning scan,
the real-browser check, the credential/canary/local-path artifact scan,
and `git diff --check`.

`verify:live-provider` is a bounded operator action (≤ 5 turns, ≤ 256
output tokens per turn, one cancellation, one restart-and-restore,
metadata only). It refuses to run without the explicit gate and the
credential, and it scans every persisted byte for the credential value.
