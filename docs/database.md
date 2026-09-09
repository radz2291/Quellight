# Databases and migrations

Quellight keeps **three physically separate SQLite stores** in one data
directory (default `.quellight-data/`, git-ignored). Separation is a
retention and replaceability boundary, not a cluster: one process owns
all three.

## 1. `vict-operational.db` — VICT operational stores

Owned by VICT (`@victframework/store-sqlite`). Contains the actor
directory, turn records, the stream ledger (durable frames), command
idempotency, and governance tables. Schema and migrations are entirely
VICT's (forward-only, bookkeeping-tracked inside the file). Quellight
never writes application meaning here.

## 2. `mastra/mastra-store.db` — conversation store

Owned by Mastra (via `@victframework/mastra`), dedicated file. Holds
conversation threads and messages (the transcript). Replaceable cache
from Quellight's perspective: losing it loses transcripts, **not**
Shared World continuity. Quellight reads it only through the bounded,
actor-gated restore path.

## 3. `shared-world.db` — Quellight Shared World store

Owned by Quellight (`src/lib/sharedworld/`). Stage 07B materializes
exactly the authorized user-created thread record family:

### `qlt_thread`

| column            | type       | notes                                                      |
| ----------------- | ---------- | ---------------------------------------------------------- |
| `id`              | text PK    | `qlt-` + UUID                                              |
| `title`           | text       | bounded non-empty                                          |
| `state`           | text CHECK | `active` \| `dormant` (archive = dormant; reopen = active) |
| `retention_state` | text CHECK | `currently-relevant` \| `user-removed`                     |
| `provenance`      | text       | always `user` in 07B                                       |
| `created_at_ms`   | integer    |                                                            |
| `updated_at_ms`   | integer    |                                                            |

### `qlt_thread_conversation`

| column             | type                      | notes                  |
| ------------------ | ------------------------- | ---------------------- |
| `id`               | text PK                   | `conv-` + hex          |
| `thread_id`        | text FK → `qlt_thread.id` | one link per thread    |
| `mastra_thread_id` | text UNIQUE               | the Mastra-side thread |

Supporting tables: `quellight_shared_world_migrations` (forward-only
bookkeeping), `qlt_adapter_idempotency` (keyed idempotency recorded in
the same transaction as the row it guards).

### Migration discipline

- Forward-only: no downgrades, no rewrites. Each migration runs once,
  recorded in the bookkeeping table with its id and applied-at.
- A store file created by a NEWER schema refuses to open with an OLDER
  schema set (fail closed, stable error).
- Migration verification runs in the deterministic suite (create,
  migrate, close, reopen — schema stable, no re-application).

## Hygiene

- Store files and sidecars (`*.db`, `*.db-wal`, `*.db-shm`) are
  git-ignored everywhere; they are never committed.
- No credential value can reach any store byte (negative-controlled
  with fresh high-entropy canaries across all three stores).
- The agent has no Shared World write path in 07B (negative-controlled).
