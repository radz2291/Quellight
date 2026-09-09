/**
 * Quellight Shared World migrations (DATA-013 / APP-009 discipline).
 *
 * - versioned, FORWARD-ONLY, additive (CREATE/ALTER only in 07B);
 * - bookkeeping lives in `quellight_shared_world_migrations`, separate
 *   from VICT operational and Mastra bookkeeping;
 * - a recorded version NEWER than the known migration list fails loudly:
 *   durable truth is never opened by older code that cannot understand it;
 * - every migration runs inside one transaction.
 */

import type { DatabaseSync } from 'node:sqlite';

/** One forward-only Shared World migration. */
export interface QuellightMigration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: DatabaseSync) => void;
}

/** Migration 1: the 07B Shared World foundation (handoff §6). */
const MIGRATION_0001_FOUNDATION: QuellightMigration = {
  version: 1,
  name: 'qlt-thread-foundation',
  up: (db) => {
    // The ONLY durable record family of 07B: the user-created Shared World
    // thread record. State and retention vocabularies are closed CHECK
    // constraints — later vocabularies arrive as additive migrations.
    db.exec(`
      CREATE TABLE qlt_thread (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('active', 'dormant')),
        retention_state TEXT NOT NULL CHECK (retention_state IN ('currently-relevant', 'user-removed')),
        provenance TEXT NOT NULL CHECK (provenance = 'user'),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX idx_qlt_thread_updated_at ON qlt_thread (updated_at_ms DESC);
      CREATE INDEX idx_qlt_thread_state ON qlt_thread (state);

      -- Explicit correlation: Shared World thread ↔ Mastra conversation
      -- thread. The thread record SURVIVES loss of the Mastra store.
      CREATE TABLE qlt_thread_conversation (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES qlt_thread (id),
        mastra_thread_id TEXT NOT NULL UNIQUE,
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX idx_qlt_thread_conversation_thread ON qlt_thread_conversation (thread_id);

      -- Application-Layer keyed idempotency for the thread resource:
      -- recorded in the SAME transaction as the row it reconciles
      -- (a failed mutation never consumes a key).
      CREATE TABLE qlt_adapter_idempotency (
        scope_key TEXT PRIMARY KEY,
        row_identity TEXT NOT NULL,
        fingerprint TEXT NOT NULL
      );
    `);
  },
};

/** The ordered, forward-only migration list. */
export const QLT_SHARED_WORLD_MIGRATIONS: readonly QuellightMigration[] = [
  MIGRATION_0001_FOUNDATION,
];

/** The current schema version of this build. */
export const QLT_SHARED_WORLD_SCHEMA_VERSION = QLT_SHARED_WORLD_MIGRATIONS.at(-1)!.version;

/** The applied-migrations bookkeeping table (created first). */
const BOOKKEEPING_DDL = `
  CREATE TABLE IF NOT EXISTS quellight_shared_world_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

export interface AppliedQuellightMigration {
  readonly version: number;
  readonly name: string;
  readonly appliedAt: string;
}

/** List the applied migrations (bookkeeping read). */
export function appliedSharedWorldMigrations(
  db: DatabaseSync,
): readonly AppliedQuellightMigration[] {
  db.exec(BOOKKEEPING_DDL);
  const rows = db
    .prepare(
      'SELECT version, name, applied_at AS appliedAt FROM quellight_shared_world_migrations ORDER BY version;',
    )
    .all() as Array<{ version: number; name: string; appliedAt: string }>;
  return rows.map((row) => ({ version: row.version, name: row.name, appliedAt: row.appliedAt }));
}

/**
 * Apply the forward-only migration list. Idempotent: already-applied
 * versions are skipped; a recorded version newer than this build's list
 * refuses the open (forward-only discipline).
 */
export function runSharedWorldMigrations(
  db: DatabaseSync,
  now: () => string = () => new Date(0).toISOString(),
): void {
  db.exec(BOOKKEEPING_DDL);
  const applied = new Set(appliedSharedWorldMigrations(db).map((migration) => migration.version));
  const newestApplied = Math.max(0, ...applied);
  if (newestApplied > QLT_SHARED_WORLD_SCHEMA_VERSION) {
    throw new Error(
      `the Shared World store was written by schema version ${newestApplied}, newer than this build's version ${QLT_SHARED_WORLD_SCHEMA_VERSION}; refusing the open (forward-only discipline).`,
    );
  }
  for (const migration of QLT_SHARED_WORLD_MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }
    db.exec('BEGIN IMMEDIATE;');
    try {
      migration.up(db);
      db.prepare(
        'INSERT INTO quellight_shared_world_migrations (version, name, applied_at) VALUES (?, ?, ?);',
      ).run(migration.version, migration.name, now());
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
  }
}
