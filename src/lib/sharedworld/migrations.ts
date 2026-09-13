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

/**
 * Migration 2: the 07C Phase Q2 durable Shared World meaning foundation
 * (frozen contract: docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md;
 * machine-readable inventory: `meaning-contract.ts`
 * QLT_MEANING_SCHEMA_INVENTORY). ADDITIVE `CREATE TABLE`/`CREATE INDEX`
 * only — it neither reads nor writes pre-existing rows and is incapable
 * of deleting or rewriting existing user data. Table and column order,
 * CHECK expressions, and index definitions must satisfy the frozen
 * inventory exactly (schema-introspection gates compare pragma output
 * against it).
 */
const MIGRATION_0002_MEANING_FOUNDATION: QuellightMigration = {
  version: 2,
  name: 'qlt-meaning-foundation',
  up: (db) => {
    db.exec(`
      CREATE TABLE qlt_proposal (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('proposed','awaiting_decision','confirmed','rejected','amended','withdrawn')),
        proposal_kind TEXT NOT NULL CHECK (proposal_kind IN ('claim','commitment','open_loop','correction')),
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        proposed_by TEXT NOT NULL CHECK ((proposed_by GLOB 'agent-*') OR (proposed_by GLOB 'actor-*')),
        decision_by TEXT NULL CHECK ((decision_by IS NULL) OR (decision_by GLOB 'actor-*')),
        decided_at_ms INTEGER NULL,
        decision_reason TEXT NULL,
        target_record_id TEXT NULL,
        target_record_family TEXT NULL CHECK ((target_record_family IS NULL) OR (target_record_family IN ('claim','commitment','open_loop'))),
        target_record_version INTEGER NULL CHECK ((target_record_version IS NULL) OR (target_record_version >= 1)),
        source_thread_id TEXT NOT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed')),
        CHECK ((proposal_kind = 'correction') OR (target_record_id IS NULL)),
        CHECK ((status IN ('confirmed','rejected','amended','withdrawn')) = ((decision_by IS NOT NULL) AND (decided_at_ms IS NOT NULL)))
      );
      CREATE INDEX idx_qlt_proposal_status ON qlt_proposal (status, created_at_ms);
      CREATE INDEX idx_qlt_proposal_thread ON qlt_proposal (source_thread_id, status);
      CREATE UNIQUE INDEX uq_qlt_proposal_open_per_turn ON qlt_proposal (source_thread_id, proposal_kind, source_turn_ref) WHERE status IN ('proposed','awaiting_decision');

      CREATE TABLE qlt_claim (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('active','superseded','retired')),
        epistemic_type TEXT NOT NULL CHECK (epistemic_type IN ('E1','E2','E3','E4','E5','E6','E7')),
        honesty_state TEXT NOT NULL CHECK (honesty_state IN ('known','likely','uncertain','stale','conflicted')),
        confidence TEXT NOT NULL CHECK (confidence IN ('stated','qualified','uncertain')),
        subject TEXT NOT NULL CHECK (length(subject) > 0 AND length(subject) <= 200),
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_claim (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id))
      );
      CREATE INDEX idx_qlt_claim_subject ON qlt_claim (subject, status);
      CREATE INDEX idx_qlt_claim_eligible ON qlt_claim (status, retention_state, effective_at_ms);

      CREATE TABLE qlt_commitment (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('active','released','superseded','amended')),
        commitment_key TEXT NOT NULL CHECK (length(commitment_key) > 0 AND length(commitment_key) <= 200),
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        normative_basis_proposal_id TEXT NULL REFERENCES qlt_proposal (id),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_commitment (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id))
      );
      CREATE UNIQUE INDEX uq_qlt_commitment_active_key ON qlt_commitment (commitment_key) WHERE status = 'active';
      CREATE INDEX idx_qlt_commitment_key ON qlt_commitment (commitment_key, status);
      CREATE INDEX idx_qlt_commitment_eligible ON qlt_commitment (status, retention_state, effective_at_ms);

      CREATE TABLE qlt_open_loop (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('open','resolved','superseded','abandoned','transformed')),
        loop_kind TEXT NOT NULL CHECK (loop_kind IN ('pending_action','undecided_question','expected_event')),
        subject TEXT NOT NULL CHECK (length(subject) > 0 AND length(subject) <= 200),
        exit_reason TEXT NULL CHECK ((exit_reason IS NULL) OR (length(exit_reason) <= 500)),
        exit_by TEXT NULL CHECK ((exit_by IS NULL) OR (exit_by GLOB 'actor-*')),
        exited_at_ms INTEGER NULL,
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_open_loop (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id)),
        CHECK ((status = 'open') OR ((exit_by IS NOT NULL) AND (exited_at_ms IS NOT NULL)))
      );
      CREATE INDEX idx_qlt_open_loop_thread ON qlt_open_loop (source_thread_id, status);
      CREATE INDEX idx_qlt_open_loop_subject ON qlt_open_loop (subject, status);
      CREATE INDEX idx_qlt_open_loop_eligible ON qlt_open_loop (status, retention_state, effective_at_ms);

      CREATE TABLE qlt_correction (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version = 1),
        status TEXT NOT NULL CHECK (status = 'recorded'),
        subject_record_id TEXT NOT NULL CHECK (length(subject_record_id) > 0 AND length(subject_record_id) <= 128),
        subject_record_family TEXT NOT NULL CHECK (subject_record_family IN ('claim','commitment','open_loop')),
        correction_key TEXT NOT NULL CHECK (length(correction_key) > 0 AND length(correction_key) <= 200),
        prior_content_fingerprint TEXT NOT NULL CHECK (length(prior_content_fingerprint) = 64),
        reason TEXT NULL CHECK ((reason IS NULL) OR (length(reason) <= 500)),
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        corrected_by TEXT NOT NULL CHECK (corrected_by GLOB 'actor-*'),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed'))
      );
      CREATE UNIQUE INDEX uq_qlt_correction_subject_key ON qlt_correction (subject_record_id, correction_key);
      CREATE INDEX idx_qlt_correction_subject ON qlt_correction (subject_record_id, created_at_ms);

      CREATE TABLE qlt_source_link (
        id TEXT NOT NULL PRIMARY KEY,
        from_record_id TEXT NOT NULL CHECK (length(from_record_id) > 0 AND length(from_record_id) <= 128),
        from_record_family TEXT NOT NULL CHECK (from_record_family IN ('proposal','claim','commitment','open_loop','correction')),
        to_kind TEXT NOT NULL CHECK (to_kind IN ('thread','turn','message','proposal','record','correction')),
        to_ref TEXT NOT NULL CHECK (length(to_ref) > 0 AND length(to_ref) <= 200),
        relation TEXT NOT NULL CHECK (relation IN ('source-thread','source-turn','proposed-from','supersedes','corrects','amends')),
        created_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','user-removed'))
      );
      CREATE UNIQUE INDEX uq_qlt_source_link ON qlt_source_link (from_record_id, to_kind, to_ref, relation);
      CREATE INDEX idx_qlt_source_link_from ON qlt_source_link (from_record_id);
      CREATE INDEX idx_qlt_source_link_to ON qlt_source_link (to_kind, to_ref);
    `);
  },
};

/** The ordered, forward-only migration list. */
export const QLT_SHARED_WORLD_MIGRATIONS: readonly QuellightMigration[] = [
  MIGRATION_0001_FOUNDATION,
  MIGRATION_0002_MEANING_FOUNDATION,
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
