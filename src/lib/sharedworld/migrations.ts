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

/**
 * Migration 3: the 07C Phase Q4 per-turn context-assembly family (frozen
 * contract:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md §7;
 * machine-readable inventory: `context-contract.ts`
 * QLT_CONTEXT_ASSEMBLY_SCHEMA_INVENTORY). ADDITIVE `CREATE TABLE`/
 * `CREATE INDEX` only — it neither reads nor writes pre-existing rows and
 * is incapable of deleting or rewriting existing user data. The assembly
 * family is IMMUTABLE, append-only evidence: exactly one row per logical
 * turn (UNIQUE turn_id), no record CONTENT is ever stored (ids, kinds,
 * versions, bounded exclusion reasons, counts only).
 */
const MIGRATION_0003_CONTEXT_ASSEMBLY: QuellightMigration = {
  version: 3,
  name: 'qlt-context-assembly',
  up: (db) => {
    db.exec(`
      CREATE TABLE qlt_context_assembly (
        id TEXT NOT NULL PRIMARY KEY,
        turn_id TEXT NOT NULL UNIQUE,
        thread_id TEXT NOT NULL REFERENCES qlt_thread (id),
        assembler_version TEXT NOT NULL CHECK (length(assembler_version) > 0 AND length(assembler_version) <= 32),
        outcome TEXT NOT NULL CHECK (outcome IN ('complete','empty','failed')),
        selected_ids TEXT NOT NULL CHECK (length(selected_ids) > 0 AND length(selected_ids) <= 4096),
        excluded TEXT NOT NULL CHECK (length(excluded) > 0 AND length(excluded) <= 8192),
        ordering_identity TEXT NOT NULL CHECK (length(ordering_identity) > 0 AND length(ordering_identity) <= 4096),
        max_records INTEGER NOT NULL CHECK (max_records > 0),
        max_bytes INTEGER NOT NULL CHECK (max_bytes > 0),
        rendered_bytes INTEGER NOT NULL CHECK (rendered_bytes >= 0),
        fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
        failure_code TEXT NULL CHECK ((failure_code IS NULL) OR (length(failure_code) <= 64)),
        created_at_ms INTEGER NOT NULL,
        CHECK ((outcome = 'failed') = (failure_code IS NOT NULL))
      );
      CREATE UNIQUE INDEX uq_qlt_context_assembly_turn ON qlt_context_assembly (turn_id);
      CREATE INDEX idx_qlt_context_assembly_thread ON qlt_context_assembly (thread_id, created_at_ms);
    `);
  },
};

/**
 * Migration 4: the 07C Phase Q5 Memory Mode policy families (frozen
 * contract:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md §11;
 * machine-readable inventory: `policy-contract.ts`). ADDITIVE
 * `CREATE TABLE`/`CREATE INDEX` only — it neither reads nor writes
 * pre-existing rows and is incapable of deleting or rewriting existing
 * user data. Two families:
 *   - `qlt_memory_policy`: the durable product-default Memory Mode
 *     (singleton row; closed mode CHECK; monotonic revision; the schema
 *     is created here while the DEFAULT ROW is lazily seeded by the
 *     policy store inside one transaction on first resolution);
 *   - `qlt_turn_memory_policy`: immutable per-turn applied-policy
 *     evidence (turn_id PRIMARY KEY; INSERT-or-converge; NEVER updated).
 * The frozen Q4 assembly family is not touched; the frozen Q4
 * fingerprint algorithm is not modified to encode the mode (bounded
 * immutable policy evidence is added HERE instead).
 */
const MIGRATION_0004_MEMORY_MODE_POLICY: QuellightMigration = {
  version: 4,
  name: 'qlt-memory-mode-policy',
  up: (db) => {
    db.exec(`
      CREATE TABLE qlt_memory_policy (
        id TEXT NOT NULL PRIMARY KEY CHECK (id = 'qlt-memory-policy-default'),
        policy_id TEXT NOT NULL CHECK (policy_id = 'qlt.memory-mode@1'),
        mode TEXT NOT NULL CHECK (mode IN ('across-conversations','per-conversation','off')),
        revision INTEGER NOT NULL CHECK (revision >= 1),
        updated_by TEXT NOT NULL CHECK (updated_by GLOB 'actor-*'),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE qlt_turn_memory_policy (
        turn_id TEXT NOT NULL PRIMARY KEY,
        policy_id TEXT NOT NULL CHECK (policy_id = 'qlt.memory-mode@1'),
        mode TEXT NOT NULL CHECK (mode IN ('across-conversations','per-conversation','off')),
        policy_revision INTEGER NOT NULL CHECK (policy_revision >= 1),
        recorded_at_ms INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX uq_qlt_turn_memory_policy_turn ON qlt_turn_memory_policy (turn_id);
    `);
  },
};

/**
 * Migration 5: the STAGE 07D PHASE D1a retention-and-conflict foundation
 * (frozen contract:
 * docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md;
 * machine-readable inventories: `d1-contract.ts`
 * QLT_D1_SCHEMA_INVENTORY and the amended `meaning-contract.ts`
 * QLT_MEANING_SCHEMA_INVENTORY).
 *
 * TWO kinds of change, both frozen:
 *   1. TABLE REBUILDS (the only non-additive migration so far, forced by
 *      SQLite's inability to ALTER a CHECK): the six meaning tables are
 *      rebuilt in place to the D1a shapes — the 3-state retention CHECK
 *      (`expired` joins the closed vocabulary), nullable content columns
 *      on the three subject families so a removal can write the
 *      CONTENT-FREE tombstone (enforced by row CHECKs, not convention),
 *      claim expiry metadata (`expires_at_ms`), and removal bookkeeping
 *      (`removed_at_ms`/`removed_by`). The COPY preserves every row and
 *      column value EXCEPT that a legacy `user-removed` row (07C had no
 *      write path to that state; the rule is defensive) has its
 *      tombstone columns nulled so it satisfies the new constraint.
 *      Nothing is deleted; no content of a currently-relevant or expired
 *      row is touched.
 *   2. ADDITIVE NEW FAMILIES: `qlt_amendment` (the amendment-vs-execution
 *      judgment record), `qlt_conflict_challenge` (the deterministic
 *      conflict-identification judgment record), and
 *      `qlt_retention_pass` (the append-only enforcement-pass evidence).
 * The whole migration runs in ONE transaction (never a partial schema).
 */
const MIGRATION_0005_RETENTION_CONFLICT_FOUNDATIONS: QuellightMigration = {
  version: 5,
  name: 'qlt-retention-conflict-foundations',
  up: (db) => {
    // The rebuild interleaves DROP/RENAME across parent/child tables;
    // foreign-key enforcement is DEFERRED to the transaction COMMIT (the
    // final schema is fully consistent; an intermediate DROP of a parent
    // whose child rows were already copied would otherwise fail the
    // migration inside the transaction).
    db.exec('PRAGMA defer_foreign_keys = ON;');
    db.exec(`
      -- ------------------------------------------------------------------
      -- Rebuild: qlt_proposal (retention CHECK 3-state; else unchanged)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_proposal_v5 (
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
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed')),
        CHECK ((proposal_kind = 'correction') OR (target_record_id IS NULL)),
        CHECK ((status IN ('confirmed','rejected','amended','withdrawn')) = ((decision_by IS NOT NULL) AND (decided_at_ms IS NOT NULL)))
      );
      INSERT INTO qlt_proposal_v5 SELECT * FROM qlt_proposal;
      DROP TABLE qlt_proposal;
      ALTER TABLE qlt_proposal_v5 RENAME TO qlt_proposal;
      CREATE INDEX idx_qlt_proposal_status ON qlt_proposal (status, created_at_ms);
      CREATE INDEX idx_qlt_proposal_thread ON qlt_proposal (source_thread_id, status);
      CREATE UNIQUE INDEX uq_qlt_proposal_open_per_turn ON qlt_proposal (source_thread_id, proposal_kind, source_turn_ref) WHERE status IN ('proposed','awaiting_decision');

      -- ------------------------------------------------------------------
      -- Rebuild: qlt_claim (3-state retention; nullable content; expiry
      -- metadata; removal bookkeeping; tombstone CHECKs)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_claim_v5 (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('active','superseded','retired')),
        epistemic_type TEXT NULL CHECK ((epistemic_type IS NULL) OR (epistemic_type IN ('E1','E2','E3','E4','E5','E6','E7'))),
        honesty_state TEXT NULL CHECK ((honesty_state IS NULL) OR (honesty_state IN ('known','likely','uncertain','stale','conflicted'))),
        confidence TEXT NULL CHECK ((confidence IS NULL) OR (confidence IN ('stated','qualified','uncertain'))),
        subject TEXT NULL CHECK ((subject IS NULL) OR (length(subject) > 0 AND length(subject) <= 200)),
        content TEXT NULL CHECK ((content IS NULL) OR (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096)),
        content_fingerprint TEXT NULL CHECK ((content_fingerprint IS NULL) OR (length(content_fingerprint) = 64)),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_claim (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NULL CHECK ((expires_at_ms IS NULL) OR (expires_at_ms >= 0)),
        removed_at_ms INTEGER NULL,
        removed_by TEXT NULL CHECK ((removed_by IS NULL) OR (removed_by GLOB 'actor-*')),
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id)),
        CHECK (((removed_by IS NULL) = (removed_at_ms IS NULL)) AND ((removed_at_ms IS NULL) = (retention_state <> 'user-removed'))),
        CHECK ((retention_state <> 'user-removed') OR (subject IS NULL AND epistemic_type IS NULL AND honesty_state IS NULL AND confidence IS NULL AND content IS NULL AND content_fingerprint IS NULL)),
        CHECK ((expires_at_ms IS NULL) OR (retention_state IN ('currently-relevant','expired')))
      );
      INSERT INTO qlt_claim_v5 (
        id, version, status, epistemic_type, honesty_state, confidence, subject, content, content_fingerprint,
        proposal_id, created_by, supersedes_id, source_thread_id, source_turn_ref,
        created_at_ms, updated_at_ms, effective_at_ms, expires_at_ms, removed_at_ms, removed_by, retention_state
      )
      SELECT
        id, version, status,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE epistemic_type END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE honesty_state END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE confidence END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE subject END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content_fingerprint END,
        proposal_id, created_by, supersedes_id, source_thread_id, source_turn_ref,
        created_at_ms, updated_at_ms, effective_at_ms, NULL, NULL, NULL, retention_state
      FROM qlt_claim;
      DROP TABLE qlt_claim;
      ALTER TABLE qlt_claim_v5 RENAME TO qlt_claim;
      CREATE INDEX idx_qlt_claim_subject ON qlt_claim (subject, status);
      CREATE INDEX idx_qlt_claim_eligible ON qlt_claim (status, retention_state, effective_at_ms);
      CREATE INDEX idx_qlt_claim_due_expiry ON qlt_claim (expires_at_ms) WHERE status = 'active' AND retention_state = 'currently-relevant';

      -- ------------------------------------------------------------------
      -- Rebuild: qlt_commitment
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_commitment_v5 (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('active','released','superseded','amended')),
        commitment_key TEXT NULL CHECK ((commitment_key IS NULL) OR (length(commitment_key) > 0 AND length(commitment_key) <= 200)),
        content TEXT NULL CHECK ((content IS NULL) OR (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096)),
        content_fingerprint TEXT NULL CHECK ((content_fingerprint IS NULL) OR (length(content_fingerprint) = 64)),
        normative_basis_proposal_id TEXT NULL REFERENCES qlt_proposal (id),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_commitment (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        removed_at_ms INTEGER NULL,
        removed_by TEXT NULL CHECK ((removed_by IS NULL) OR (removed_by GLOB 'actor-*')),
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id)),
        CHECK (((removed_by IS NULL) = (removed_at_ms IS NULL)) AND ((removed_at_ms IS NULL) = (retention_state <> 'user-removed'))),
        CHECK ((retention_state <> 'user-removed') OR (commitment_key IS NULL AND content IS NULL AND content_fingerprint IS NULL))
      );
      INSERT INTO qlt_commitment_v5 (
        id, version, status, commitment_key, content, content_fingerprint,
        normative_basis_proposal_id, proposal_id, created_by, supersedes_id,
        source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms,
        removed_at_ms, removed_by, retention_state
      )
      SELECT
        id, version, status,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE commitment_key END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content_fingerprint END,
        normative_basis_proposal_id, proposal_id, created_by, supersedes_id,
        source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms,
        NULL, NULL, retention_state
      FROM qlt_commitment;
      DROP TABLE qlt_commitment;
      ALTER TABLE qlt_commitment_v5 RENAME TO qlt_commitment;
      CREATE UNIQUE INDEX uq_qlt_commitment_active_key ON qlt_commitment (commitment_key) WHERE status = 'active';
      CREATE INDEX idx_qlt_commitment_key ON qlt_commitment (commitment_key, status);
      CREATE INDEX idx_qlt_commitment_eligible ON qlt_commitment (status, retention_state, effective_at_ms);

      -- ------------------------------------------------------------------
      -- Rebuild: qlt_open_loop
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_open_loop_v5 (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('open','resolved','superseded','abandoned','transformed')),
        loop_kind TEXT NULL CHECK ((loop_kind IS NULL) OR (loop_kind IN ('pending_action','undecided_question','expected_event'))),
        subject TEXT NULL CHECK ((subject IS NULL) OR (length(subject) > 0 AND length(subject) <= 200)),
        exit_reason TEXT NULL CHECK ((exit_reason IS NULL) OR (length(exit_reason) <= 500)),
        exit_by TEXT NULL CHECK ((exit_by IS NULL) OR (exit_by GLOB 'actor-*')),
        exited_at_ms INTEGER NULL,
        content TEXT NULL CHECK ((content IS NULL) OR (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096)),
        content_fingerprint TEXT NULL CHECK ((content_fingerprint IS NULL) OR (length(content_fingerprint) = 64)),
        proposal_id TEXT NULL UNIQUE REFERENCES qlt_proposal (id),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        supersedes_id TEXT NULL REFERENCES qlt_open_loop (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        source_turn_ref TEXT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        removed_at_ms INTEGER NULL,
        removed_by TEXT NULL CHECK ((removed_by IS NULL) OR (removed_by GLOB 'actor-*')),
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed')),
        CHECK ((supersedes_id IS NULL) OR (supersedes_id <> id)),
        CHECK ((status = 'open') OR ((exit_by IS NOT NULL) AND (exited_at_ms IS NOT NULL))),
        CHECK (((removed_by IS NULL) = (removed_at_ms IS NULL)) AND ((removed_at_ms IS NULL) = (retention_state <> 'user-removed'))),
        CHECK ((retention_state <> 'user-removed') OR (subject IS NULL AND loop_kind IS NULL AND exit_reason IS NULL AND content IS NULL AND content_fingerprint IS NULL))
      );
      INSERT INTO qlt_open_loop_v5 (
        id, version, status, loop_kind, subject, exit_reason, exit_by, exited_at_ms,
        content, content_fingerprint, proposal_id, created_by, supersedes_id,
        source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms,
        removed_at_ms, removed_by, retention_state
      )
      SELECT
        id, version, status,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE loop_kind END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE subject END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE exit_reason END,
        exit_by, exited_at_ms,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content END,
        CASE WHEN retention_state = 'user-removed' THEN NULL ELSE content_fingerprint END,
        proposal_id, created_by, supersedes_id,
        source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms,
        NULL, NULL, retention_state
      FROM qlt_open_loop;
      DROP TABLE qlt_open_loop;
      ALTER TABLE qlt_open_loop_v5 RENAME TO qlt_open_loop;
      CREATE INDEX idx_qlt_open_loop_thread ON qlt_open_loop (source_thread_id, status);
      CREATE INDEX idx_qlt_open_loop_subject ON qlt_open_loop (subject, status);
      CREATE INDEX idx_qlt_open_loop_eligible ON qlt_open_loop (status, retention_state, effective_at_ms);

      -- ------------------------------------------------------------------
      -- Rebuild: qlt_correction (retention CHECK 3-state; else unchanged)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_correction_v5 (
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
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed'))
      );
      INSERT INTO qlt_correction_v5 SELECT * FROM qlt_correction;
      DROP TABLE qlt_correction;
      ALTER TABLE qlt_correction_v5 RENAME TO qlt_correction;
      CREATE UNIQUE INDEX uq_qlt_correction_subject_key ON qlt_correction (subject_record_id, correction_key);
      CREATE INDEX idx_qlt_correction_subject ON qlt_correction (subject_record_id, created_at_ms);

      -- ------------------------------------------------------------------
      -- Rebuild: qlt_source_link (retention CHECK 3-state; else unchanged)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_source_link_v5 (
        id TEXT NOT NULL PRIMARY KEY,
        from_record_id TEXT NOT NULL CHECK (length(from_record_id) > 0 AND length(from_record_id) <= 128),
        from_record_family TEXT NOT NULL CHECK (from_record_family IN ('proposal','claim','commitment','open_loop','correction')),
        to_kind TEXT NOT NULL CHECK (to_kind IN ('thread','turn','message','proposal','record','correction')),
        to_ref TEXT NOT NULL CHECK (length(to_ref) > 0 AND length(to_ref) <= 200),
        relation TEXT NOT NULL CHECK (relation IN ('source-thread','source-turn','proposed-from','supersedes','corrects','amends')),
        created_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed'))
      );
      INSERT INTO qlt_source_link_v5 SELECT * FROM qlt_source_link;
      DROP TABLE qlt_source_link;
      ALTER TABLE qlt_source_link_v5 RENAME TO qlt_source_link;
      CREATE UNIQUE INDEX uq_qlt_source_link ON qlt_source_link (from_record_id, to_kind, to_ref, relation);
      CREATE INDEX idx_qlt_source_link_from ON qlt_source_link (from_record_id);
      CREATE INDEX idx_qlt_source_link_to ON qlt_source_link (to_kind, to_ref);

      -- ------------------------------------------------------------------
      -- New family: qlt_amendment (the amendment-vs-execution judgment
      -- record; INV-15; frozen d1-contract §7)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_amendment (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version = 1),
        status TEXT NOT NULL CHECK (status = 'recorded'),
        commitment_id TEXT NOT NULL REFERENCES qlt_commitment (id),
        amendment_key TEXT NOT NULL CHECK (length(amendment_key) > 0 AND length(amendment_key) <= 200),
        prior_content_fingerprint TEXT NOT NULL CHECK (length(prior_content_fingerprint) = 64),
        reason TEXT NULL CHECK ((reason IS NULL) OR (length(reason) <= 500)),
        content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) > 0 AND length(CAST(content AS BLOB)) <= 4096),
        content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
        amended_by TEXT NOT NULL CHECK (amended_by GLOB 'actor-*'),
        successor_id TEXT NOT NULL REFERENCES qlt_commitment (id),
        source_thread_id TEXT NULL REFERENCES qlt_thread (id),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        effective_at_ms INTEGER NOT NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed'))
      );
      CREATE UNIQUE INDEX uq_qlt_amendment_commitment_key ON qlt_amendment (commitment_id, amendment_key);
      CREATE INDEX idx_qlt_amendment_commitment ON qlt_amendment (commitment_id, created_at_ms);

      -- ------------------------------------------------------------------
      -- New family: qlt_conflict_challenge (the deterministic
      -- conflict-identification judgment record; frozen d1-contract §6)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_conflict_challenge (
        id TEXT NOT NULL PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        status TEXT NOT NULL CHECK (status IN ('open','dismissed','resolved')),
        classification TEXT NOT NULL CHECK (classification IN ('commitment-key-conflict')),
        existing_commitment_id TEXT NOT NULL REFERENCES qlt_commitment (id),
        incoming_proposal_id TEXT NOT NULL UNIQUE REFERENCES qlt_proposal (id),
        resolution TEXT NULL CHECK ((resolution IS NULL) OR (resolution IN ('incoming-abandoned','existing-amended'))),
        created_by TEXT NOT NULL CHECK (created_by GLOB 'actor-*'),
        resolved_by TEXT NULL CHECK ((resolved_by IS NULL) OR (resolved_by GLOB 'actor-*')),
        reason TEXT NULL CHECK ((reason IS NULL) OR (length(reason) <= 500)),
        thread_id TEXT NOT NULL REFERENCES qlt_thread (id),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        resolved_at_ms INTEGER NULL,
        retention_state TEXT NOT NULL DEFAULT 'currently-relevant' CHECK (retention_state IN ('currently-relevant','expired','user-removed')),
        CHECK ((status = 'open') = (resolution IS NULL)),
        CHECK ((status = 'open') = (resolved_at_ms IS NULL)),
        CHECK ((status = 'open') = (resolved_by IS NULL))
      );
      CREATE UNIQUE INDEX uq_qlt_conflict_challenge_proposal ON qlt_conflict_challenge (incoming_proposal_id);
      CREATE INDEX idx_qlt_conflict_challenge_thread ON qlt_conflict_challenge (thread_id, status);

      -- ------------------------------------------------------------------
      -- New family: qlt_retention_pass (append-only enforcement-pass
      -- evidence; frozen d1-contract §2)
      -- ------------------------------------------------------------------
      CREATE TABLE qlt_retention_pass (
        id TEXT NOT NULL PRIMARY KEY,
        ran_by TEXT NOT NULL CHECK (ran_by GLOB 'actor-*'),
        examined INTEGER NOT NULL CHECK (examined >= 0),
        expired_count INTEGER NOT NULL CHECK (expired_count >= 0),
        expired_ids TEXT NOT NULL CHECK (length(expired_ids) <= 4096),
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX idx_qlt_retention_pass_time ON qlt_retention_pass (created_at_ms);
    `);
  },
};

/**
 * Migration 6: the D2 governed conversation-deletion foundations
 * (safety contract `quellight.stage07d.d2.safety-contract@1`).
 *
 * - Rebuilds `qlt_thread` so the content-free thread tombstone is
 *   enforceable at the storage layer: the title becomes nullable with a
 *   CHECK requiring `user-removed ⇒ title IS NULL`. All other columns
 *   and every value are preserved unchanged.
 * - Adds `qlt_conversation_deletion` (the durable product deletion
 *   operation row: recorded mode/scope, closed status lifecycle,
 *   step receipts) and `qlt_conversation_purge` (the content-free
 *   deep-purge receipt). Both are append-only evidence for their row
 *   identity: the deletion row is updated only through its closed
 *   status transitions; the purge receipt is never updated.
 */
const MIGRATION_0006_DELETION_FOUNDATIONS: QuellightMigration = {
  version: 6,
  name: 'qlt-conversation-deletion-foundations',
  up: (db) => {
    // Rebuilding the qlt_thread PARENT table requires deferred FK
    // enforcement (same discipline as migration 5): children keep their
    // REFERENCES clauses and the COMMIT-time recheck validates the copy.
    db.exec('PRAGMA defer_foreign_keys = ON;');
    db.exec(`
      -- Rebuild: qlt_thread (nullable title + tombstone CHECK; else unchanged)
      CREATE TABLE qlt_thread_v6 (
        id TEXT PRIMARY KEY,
        title TEXT NULL CHECK ((title IS NULL) OR (length(CAST(title AS BLOB)) > 0 AND length(CAST(title AS BLOB)) <= 200)),
        state TEXT NOT NULL CHECK (state IN ('active', 'dormant')),
        retention_state TEXT NOT NULL CHECK (retention_state IN ('currently-relevant', 'user-removed')),
        provenance TEXT NOT NULL CHECK (provenance = 'user'),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        CHECK ((retention_state = 'user-removed') = (title IS NULL))
      );
      INSERT INTO qlt_thread_v6 (id, title, state, retention_state, provenance, created_at_ms, updated_at_ms)
        SELECT id, title, state, retention_state, provenance, created_at_ms, updated_at_ms FROM qlt_thread;
      DROP TABLE qlt_thread;
      ALTER TABLE qlt_thread_v6 RENAME TO qlt_thread;
      CREATE INDEX idx_qlt_thread_updated_at ON qlt_thread (updated_at_ms DESC);
      CREATE INDEX idx_qlt_thread_state ON qlt_thread (state);

      -- Durable product deletion operation row (closed lifecycle; the
      -- recorded mode/scope is NEVER broadened; same-key replay converges).
      CREATE TABLE qlt_conversation_deletion (
        id TEXT NOT NULL PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES qlt_thread (id),
        mode TEXT NOT NULL CHECK (mode IN ('conversation-only','conversation-and-originating-meaning')),
        status TEXT NOT NULL CHECK (status IN ('planned','completed','canceled','incomplete')),
        requested_by TEXT NOT NULL CHECK (requested_by GLOB 'actor-*'),
        key TEXT NOT NULL UNIQUE,
        vict_intent_id TEXT NULL,
        meaning_removed_claims INTEGER NOT NULL DEFAULT 0 CHECK (meaning_removed_claims >= 0),
        meaning_removed_commitments INTEGER NOT NULL DEFAULT 0 CHECK (meaning_removed_commitments >= 0),
        meaning_removed_open_loops INTEGER NOT NULL DEFAULT 0 CHECK (meaning_removed_open_loops >= 0),
        meaning_withdrawn_proposals INTEGER NOT NULL DEFAULT 0 CHECK (meaning_withdrawn_proposals >= 0),
        meaning_withdrawn_corrections INTEGER NOT NULL DEFAULT 0 CHECK (meaning_withdrawn_corrections >= 0),
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        error_code TEXT NULL,
        requested_at_ms INTEGER NOT NULL,
        terminal_at_ms INTEGER NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX uq_qlt_conversation_deletion_thread ON qlt_conversation_deletion (thread_id);
      CREATE INDEX idx_qlt_conversation_deletion_status ON qlt_conversation_deletion (status);

      -- Content-free deep-purge receipt (append-only; identifiers and
      -- counts only; written in the purge transaction).
      CREATE TABLE qlt_conversation_purge (
        id TEXT NOT NULL PRIMARY KEY,
        thread_id TEXT NOT NULL,
        purged_by TEXT NOT NULL CHECK (purged_by GLOB 'actor-*'),
        challenges INTEGER NOT NULL CHECK (challenges >= 0),
        amendments INTEGER NOT NULL CHECK (amendments >= 0),
        corrections INTEGER NOT NULL CHECK (corrections >= 0),
        source_links INTEGER NOT NULL CHECK (source_links >= 0),
        proposals INTEGER NOT NULL CHECK (proposals >= 0),
        originating_tombstones INTEGER NOT NULL CHECK (originating_tombstones >= 0),
        assembly_rows INTEGER NOT NULL CHECK (assembly_rows >= 0),
        vacuumed INTEGER NOT NULL CHECK (vacuumed IN (0, 1)),
        created_at_ms INTEGER NOT NULL
      );
    `);
  },
};

/** The ordered, forward-only migration list. */
export const QLT_SHARED_WORLD_MIGRATIONS: readonly QuellightMigration[] = [
  MIGRATION_0001_FOUNDATION,
  MIGRATION_0002_MEANING_FOUNDATION,
  MIGRATION_0003_CONTEXT_ASSEMBLY,
  MIGRATION_0004_MEMORY_MODE_POLICY,
  MIGRATION_0005_RETENTION_CONFLICT_FOUNDATIONS,
  MIGRATION_0006_DELETION_FOUNDATIONS,
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
