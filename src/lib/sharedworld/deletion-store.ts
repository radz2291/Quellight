/**
 * Quellight Stage 07D Phase D2 — the governed conversation-deletion,
 * purge, and reconciliation store.
 *
 * FROZEN CONTRACT: the D2 safety contract
 * (`d2-contract.ts` mirroring `quellight.stage07d.d2.safety-contract@1`).
 *
 * Discipline (identical to the D1 stores):
 * - USER authority only; an `agent-*` identity fails closed at every
 *   entry point (defense in depth — no agent ingress exists at all).
 * - Every effectful verb is one `BEGIN IMMEDIATE` transaction; rows are
 *   keyed and idempotent (same key replays to the same outcome).
 * - The recorded deletion mode/scope is NEVER broadened; recovery
 *   finalizes, it never re-scopes (safety contract §2.5).
 * - Meaning removal COMPOSES the frozen D1 retention machinery
 *   unchanged (content-free tombstones, deterministic guards); pending
 *   proposals are withdrawn through the frozen ceremony verb; challenges
 *   tied to withdrawn proposals resolve with the frozen quiet
 *   `incoming-abandoned` resolution.
 * - Errors carry stable, non-echoing codes only — never store content.
 * - The deep purge is one transaction in the frozen FK-driven order with
 *   a content-free receipt; VACUUM is a separate best-effort step.
 */

import type { DatabaseSync } from 'node:sqlite';
import {
  QLT_D2_DELETION_MODES,
  QLT_D2_PURGE_CONFIRMATION_TOKEN,
  QLT_D2_PURGE_STEP_ORDER,
  QLT_D2_USER_ACTOR_PATTERN,
  QLT_D2_WITHDRAWAL_REASON,
  type QltD2DeletionMode,
  type QltD2DeletionStatus,
  type QltD2PurgeStep,
} from './d2-contract.js';
import { QltMeaningError } from './meaning-contract.js';
import type { QltSubjectFamily, SharedWorldMeaningStore } from './meaning-contract.js';
import type { SharedWorldRetentionStore } from './retention-store.js';
import type { SharedWorldConflictStore } from './conflict-store.js';

/** Stable, non-echoing D2 store error. */
export class QltDeletionError extends Error {
  readonly code: string;
  readonly details?: Record<string, string | number>;
  constructor(code: string, message: string, details?: Record<string, string | number>) {
    super(message);
    this.name = 'QltDeletionError';
    this.code = code;
    this.details = details;
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

/** One originating subject-family row targeted by a deletion preview. */
export interface OriginatingRecordRow {
  readonly id: string;
  readonly family: QltSubjectFamily;
  readonly retentionState: string;
}

/** The deterministic, pure preview of one conversation deletion. */
export interface QltDeletionPreview {
  readonly threadId: string;
  readonly mode: QltD2DeletionMode;
  readonly threadExists: boolean;
  readonly threadAlreadyDeleted: boolean;
  readonly originating: {
    readonly current: number;
    readonly alreadyExpired: number;
    readonly alreadyRemoved: number;
    readonly rows: readonly OriginatingRecordRow[];
  };
  readonly pendingProposals: number;
  readonly pendingCorrections: number;
  /** The existing durable deletion row, if any (truthful UI state). */
  readonly deletion?: QltDeletionRow;
  /** Whether the conversation was already deep-purged. */
  readonly purged?: boolean;
}

/** One durable conversation-deletion operation row (content-free). */
export interface QltDeletionRow {
  readonly id: string;
  readonly threadId: string;
  readonly mode: QltD2DeletionMode;
  readonly status: QltD2DeletionStatus;
  readonly requestedBy: string;
  readonly victIntentId: string | null;
  readonly meaningRemovedClaims: number;
  readonly meaningRemovedCommitments: number;
  readonly meaningRemovedOpenLoops: number;
  readonly meaningWithdrawnProposals: number;
  readonly meaningWithdrawnCorrections: number;
  readonly version: number;
  readonly errorCode: string | null;
  readonly requestedAtMs: number;
  readonly terminalAtMs: number | null;
  readonly updatedAtMs: number;
}

/** One content-free deep-purge receipt. */
export interface QltPurgeRow {
  readonly id: string;
  readonly threadId: string;
  readonly purgedBy: string;
  readonly challenges: number;
  readonly amendments: number;
  readonly corrections: number;
  readonly sourceLinks: number;
  readonly proposals: number;
  readonly originatingTombstones: number;
  readonly assemblyRows: number;
  readonly vacuumed: number;
  readonly createdAtMs: number;
}

export interface SharedWorldDeletionStoreOptions {
  readonly clock?: () => number;
  readonly ids?: { readonly deletionId?: () => string; readonly purgeId?: () => string };
}

const SUBJECT_TABLES: Readonly<Record<QltSubjectFamily, string>> = {
  claim: 'qlt_claim',
  commitment: 'qlt_commitment',
  open_loop: 'qlt_open_loop',
};

interface RawRow {
  [column: string]: string | number | null;
}

function str(row: RawRow, column: string): string {
  const value = row[column];
  return typeof value === 'string' ? value : '';
}
function num(row: RawRow, column: string): number {
  const value = row[column];
  return typeof value === 'number' ? value : 0;
}
function optStr(row: RawRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

function mapSqliteError(cause: unknown): never {
  const message = String((cause as { message?: string }).message ?? '');
  if (message.includes('UNIQUE constraint failed')) {
    throw new QltDeletionError(
      'QLT_DELETION_SCOPE_CONFLICT',
      'A deletion operation for this conversation already exists with a different recorded scope.',
    );
  }
  throw cause;
}

/**
 * The D2 governed conversation-deletion store over the SAME Shared World
 * connection (one durable truth per database file).
 */
export function createSharedWorldDeletionStore(
  db: DatabaseSync,
  meaning: SharedWorldMeaningStore,
  retention: SharedWorldRetentionStore,
  conflict: SharedWorldConflictStore,
  options: SharedWorldDeletionStoreOptions = {},
) {
  const clock = options.clock ?? (() => Date.now());
  const deletionId =
    options.ids?.deletionId ?? (() => `dl-${crypto.randomUUID().replace(/-/g, '')}`);
  const purgeId = options.ids?.purgeId ?? (() => `pg-${crypto.randomUUID().replace(/-/g, '')}`);

  function assertUserActor(value: string, label: string): string {
    if (typeof value !== 'string' || !QLT_D2_USER_ACTOR_PATTERN.test(value)) {
      throw new QltDeletionError(
        'QLT_DELETION_IDENTITY_REFUSED',
        `Only a user identity may ${label}.`,
      );
    }
    return value;
  }

  function assertId(value: string, label: string): string {
    if (typeof value !== 'string' || !SAFE_ID.test(value)) {
      throw new QltDeletionError('QLT_DELETION_THREAD_MISSING', `A bounded ${label} is required.`);
    }
    return value;
  }

  function assertMode(value: string): QltD2DeletionMode {
    if (
      typeof value !== 'string' ||
      !(QLT_D2_DELETION_MODES as readonly string[]).includes(value)
    ) {
      throw new QltDeletionError(
        'QLT_DELETION_MODE_INVALID',
        'The deletion mode must be one of the two explicit user choices.',
      );
    }
    return value as QltD2DeletionMode;
  }

  function rowToDeletion(row: RawRow): QltDeletionRow {
    return {
      id: str(row, 'id'),
      threadId: str(row, 'thread_id'),
      mode: str(row, 'mode') as QltD2DeletionMode,
      status: str(row, 'status') as QltD2DeletionStatus,
      requestedBy: str(row, 'requested_by'),
      victIntentId: optStr(row, 'vict_intent_id'),
      meaningRemovedClaims: num(row, 'meaning_removed_claims'),
      meaningRemovedCommitments: num(row, 'meaning_removed_commitments'),
      meaningRemovedOpenLoops: num(row, 'meaning_removed_open_loops'),
      meaningWithdrawnProposals: num(row, 'meaning_withdrawn_proposals'),
      meaningWithdrawnCorrections: num(row, 'meaning_withdrawn_corrections'),
      version: num(row, 'version'),
      errorCode: optStr(row, 'error_code'),
      requestedAtMs: num(row, 'requested_at_ms'),
      terminalAtMs: (() => {
        const value = row['terminal_at_ms'];
        return typeof value === 'number' ? value : null;
      })(),
      updatedAtMs: num(row, 'updated_at_ms'),
    };
  }

  function getDeletionRow(threadId: string): RawRow | undefined {
    return db
      .prepare('SELECT * FROM qlt_conversation_deletion WHERE thread_id = ?;')
      .get(threadId) as RawRow | undefined;
  }

  /** All originating subject rows for a thread (every retention state). */
  function originatingRows(threadId: string): OriginatingRecordRow[] {
    const rows: OriginatingRecordRow[] = [];
    const familyTable = SUBJECT_TABLES as Readonly<Record<QltSubjectFamily, string>>;
    for (const family of Object.keys(familyTable) as QltSubjectFamily[]) {
      const table = familyTable[family];
      const found = db
        .prepare(
          `SELECT id, retention_state FROM ${table} WHERE source_thread_id = ? ORDER BY id ASC;`,
        )
        .all(threadId) as unknown as RawRow[];
      for (const row of found) {
        rows.push({
          id: str(row, 'id'),
          family: family as QltSubjectFamily,
          retentionState: str(row, 'retention_state'),
        });
      }
    }
    return rows;
  }

  function countPending(threadId: string, kind?: string): number {
    const row = (
      kind === undefined
        ? db
            .prepare(
              "SELECT COUNT(*) AS total FROM qlt_proposal WHERE source_thread_id = ? AND status IN ('proposed','awaiting_decision');",
            )
            .get(threadId)
        : db
            .prepare(
              "SELECT COUNT(*) AS total FROM qlt_proposal WHERE source_thread_id = ? AND proposal_kind = ? AND status IN ('proposed','awaiting_decision');",
            )
            .get(threadId, kind)
    ) as { total: number } | undefined;
    return row?.total ?? 0;
  }

  /** Is the thread content-free tombstoned at the storage layer? */
  function isThreadRemoved(threadId: string): boolean {
    const row = db.prepare('SELECT retention_state FROM qlt_thread WHERE id = ?;').get(threadId) as
      { retention_state: string } | undefined;
    return row?.retention_state === 'user-removed';
  }

  return {
    // -----------------------------------------------------------------
    // Preview (PURE — no durable row, no effect; N-D2-1)
    // -----------------------------------------------------------------
    previewDeletion(input: {
      readonly threadId: string;
      readonly mode: QltD2DeletionMode;
    }): QltDeletionPreview {
      const threadId = assertId(input.threadId, 'thread id');
      const mode = assertMode(input.mode);
      const exists =
        db.prepare('SELECT id FROM qlt_thread WHERE id = ?;').get(threadId) !== undefined;
      const rows = originatingRows(threadId);
      return {
        threadId,
        mode,
        threadExists: exists,
        threadAlreadyDeleted: exists && isThreadRemoved(threadId),
        originating: {
          current: rows.filter((row) => row.retentionState === 'currently-relevant').length,
          alreadyExpired: rows.filter((row) => row.retentionState === 'expired').length,
          alreadyRemoved: rows.filter((row) => row.retentionState === 'user-removed').length,
          rows,
        },
        pendingProposals: countPending(threadId),
        pendingCorrections: countPending(threadId, 'correction'),
      };
    },

    // -----------------------------------------------------------------
    // Plan / cancel / finalize / recover (the closed lifecycle)
    // -----------------------------------------------------------------
    planDeletion(input: {
      readonly threadId: string;
      readonly mode: QltD2DeletionMode;
      readonly requestedBy: string;
      readonly key: string;
      readonly victIntentId?: string;
    }): QltDeletionRow {
      const threadId = assertId(input.threadId, 'thread id');
      const mode = assertMode(input.mode);
      const requestedBy = assertUserActor(input.requestedBy, 'request a conversation deletion');
      if (typeof input.key !== 'string' || !SAFE_KEY.test(input.key)) {
        throw new QltDeletionError('QLT_DELETION_MODE_INVALID', 'A bounded key is required.');
      }
      const existing = getDeletionRow(threadId);
      if (existing !== undefined) {
        if (str(existing, 'key') === input.key && str(existing, 'mode') === mode) {
          // Same key + same scope: truthful replay (N-D2-8).
          return rowToDeletion(existing);
        }
        throw new QltDeletionError(
          'QLT_DELETION_SCOPE_CONFLICT',
          'A deletion operation for this conversation already exists with a different recorded scope.',
          { currentStatus: str(existing, 'status') },
        );
      }
      if (db.prepare('SELECT id FROM qlt_thread WHERE id = ?;').get(threadId) === undefined) {
        throw new QltDeletionError(
          'QLT_DELETION_THREAD_MISSING',
          'The conversation does not exist.',
        );
      }
      const now = clock();
      try {
        db.prepare(
          `INSERT INTO qlt_conversation_deletion
             (id, thread_id, mode, status, requested_by, key, vict_intent_id, requested_at_ms, updated_at_ms)
           VALUES (?, ?, ?, 'planned', ?, ?, ?, ?, ?);`,
        ).run(
          deletionId(),
          threadId,
          mode,
          requestedBy,
          input.key,
          input.victIntentId ?? null,
          now,
          now,
        );
      } catch (cause) {
        mapSqliteError(cause);
      }
      return rowToDeletion(getDeletionRow(threadId)!);
    },

    /** Cancel a PLANNED deletion: zero store effect beyond the row itself. */
    cancelDeletion(input: {
      readonly threadId: string;
      readonly canceledBy: string;
    }): QltDeletionRow {
      const threadId = assertId(input.threadId, 'thread id');
      assertUserActor(input.canceledBy, 'cancel a conversation deletion');
      const row = getDeletionRow(threadId);
      if (row === undefined) {
        throw new QltDeletionError('QLT_DELETION_THREAD_MISSING', 'No deletion is planned.');
      }
      if (str(row, 'status') !== 'planned') {
        throw new QltDeletionError(
          'QLT_DELETION_NOT_CANCELLABLE',
          'Only a planned deletion can be canceled.',
          { currentStatus: str(row, 'status') },
        );
      }
      const now = clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `UPDATE qlt_conversation_deletion
           SET status = 'canceled', terminal_at_ms = ?, updated_at_ms = ?, version = version + 1
           WHERE thread_id = ? AND status = 'planned';`,
        ).run(now, now, threadId);
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToDeletion(getDeletionRow(threadId)!);
    },

    // -----------------------------------------------------------------
    // Execution steps (each idempotent; each its own transaction)
    // -----------------------------------------------------------------

    /**
     * Step `meaning-removal` (plus-meaning mode ONLY): withdraw pending
     * proposals/corrections originating from the conversation (resolving
     * their open challenges quietly), then remove originating
     * currently-relevant subject records through the frozen D1 retention
     * machinery. Already-terminal records converge (idempotent retry,
     * N-D2-8). Records from OTHER conversations and global records are
     * structurally out of scope (N-D2-5).
     */
    executeMeaningRemoval(input: {
      readonly threadId: string;
      readonly requestedBy: string;
    }): QltDeletionRow {
      const threadId = assertId(input.threadId, 'thread id');
      const requestedBy = assertUserActor(input.requestedBy, 'remove originating meaning');
      const row = getDeletionRow(threadId);
      if (row === undefined || str(row, 'mode') !== 'conversation-and-originating-meaning') {
        throw new QltDeletionError(
          'QLT_DELETION_MODE_INVALID',
          'Meaning removal requires the recorded plus-meaning scope.',
        );
      }
      if (str(row, 'status') === 'completed' || str(row, 'status') === 'canceled') {
        return rowToDeletion(row);
      }

      let withdrawnProposals = 0;
      let withdrawnCorrections = 0;
      // Pending proposals of the conversation (both ceremonies and
      // correction drafts) — withdrawn with the frozen user-attributed
      // verb; an already-terminal proposal converges.
      const pending = db
        .prepare(
          "SELECT id, proposal_kind FROM qlt_proposal WHERE source_thread_id = ? AND status IN ('proposed','awaiting_decision') ORDER BY id ASC;",
        )
        .all(threadId) as unknown as RawRow[];
      for (const proposal of pending) {
        const proposalId = str(proposal, 'id');
        const openChallenges = db
          .prepare(
            "SELECT id FROM qlt_conflict_challenge WHERE incoming_proposal_id = ? AND status = 'open';",
          )
          .all(proposalId) as unknown as RawRow[];
        for (const challenge of openChallenges) {
          try {
            conflict.dismissChallenge({
              challengeId: str(challenge, 'id'),
              dismissedBy: requestedBy,
              reason: QLT_D2_WITHDRAWAL_REASON,
            });
          } catch {
            // An already-resolved challenge converges (idempotent retry).
          }
        }
        try {
          meaning.withdrawProposal({
            proposalId,
            withdrawnBy: requestedBy,
            reason: QLT_D2_WITHDRAWAL_REASON,
          });
          if (str(proposal, 'proposal_kind') === 'correction') {
            withdrawnCorrections += 1;
          } else {
            withdrawnProposals += 1;
          }
        } catch (cause) {
          const current = db
            .prepare('SELECT status FROM qlt_proposal WHERE id = ?;')
            .get(proposalId) as { status: string } | undefined;
          if (
            current === undefined ||
            !['withdrawn', 'confirmed', 'rejected', 'amended'].includes(current.status)
          ) {
            throw cause;
          }
          // Already terminal: idempotent convergence.
        }
      }

      // Originating currently-relevant subject records → frozen D1
      // content-free tombstones.
      let removedClaims = 0;
      let removedCommitments = 0;
      let removedOpenLoops = 0;
      for (const target of originatingRows(threadId)) {
        if (target.retentionState !== 'currently-relevant') {
          continue;
        }
        retention.removeRecord({
          recordId: target.id,
          family: target.family,
          removedBy: requestedBy,
        });
        if (target.family === 'claim') removedClaims += 1;
        else if (target.family === 'commitment') removedCommitments += 1;
        else removedOpenLoops += 1;
      }

      // Receipt the step on the deletion row (same-connection txn).
      const now = clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `UPDATE qlt_conversation_deletion
           SET meaning_removed_claims = ?, meaning_removed_commitments = ?,
               meaning_removed_open_loops = ?, meaning_withdrawn_proposals = ?,
               meaning_withdrawn_corrections = ?, updated_at_ms = ?, version = version + 1
           WHERE thread_id = ?;`,
        ).run(
          removedClaims,
          removedCommitments,
          removedOpenLoops,
          withdrawnProposals,
          withdrawnCorrections,
          now,
          threadId,
        );
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToDeletion(getDeletionRow(threadId)!);
    },

    /**
     * Step `conversation-domain`: the content-free thread tombstone +
     * conversation-link removal (the product domain port the VICT
     * governed coordinator drives). Idempotent.
     */
    tombstoneThread(input: { readonly threadId: string }): void {
      const threadId = assertId(input.threadId, 'thread id');
      if (isThreadRemoved(threadId)) {
        return;
      }
      const now = clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `UPDATE qlt_thread SET retention_state = 'user-removed', title = NULL, updated_at_ms = ?
           WHERE id = ? AND retention_state = 'currently-relevant';`,
        ).run(now, threadId);
        db.prepare('DELETE FROM qlt_thread_conversation WHERE thread_id = ?;').run(threadId);
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
    },

    /** Record the VICT governed intent id on the deletion row. */
    recordVictIntentId(input: { readonly threadId: string; readonly victIntentId: string }): void {
      const threadId = assertId(input.threadId, 'thread id');
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          'UPDATE qlt_conversation_deletion SET vict_intent_id = ?, updated_at_ms = ? WHERE thread_id = ?;',
        ).run(input.victIntentId, clock(), threadId);
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
    },

    /** Terminal transition: `completed` (only from planned/incomplete). */
    completeDeletion(input: { readonly threadId: string }): QltDeletionRow {
      const threadId = assertId(input.threadId, 'thread id');
      const row = getDeletionRow(threadId);
      if (row === undefined) {
        throw new QltDeletionError('QLT_DELETION_THREAD_MISSING', 'No deletion is recorded.');
      }
      if (str(row, 'status') === 'completed') {
        return rowToDeletion(row);
      }
      if (str(row, 'status') === 'canceled') {
        throw new QltDeletionError(
          'QLT_DELETION_NOT_CANCELLABLE',
          'A canceled deletion cannot complete.',
        );
      }
      const now = clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `UPDATE qlt_conversation_deletion
           SET status = 'completed', error_code = NULL, terminal_at_ms = ?, updated_at_ms = ?, version = version + 1
           WHERE thread_id = ? AND status IN ('planned','incomplete');`,
        ).run(now, now, threadId);
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToDeletion(getDeletionRow(threadId)!);
    },

    /** Truthful partial-failure state (never a premature complete). */
    markIncomplete(input: {
      readonly threadId: string;
      readonly errorCode: string;
    }): QltDeletionRow {
      const threadId = assertId(input.threadId, 'thread id');
      const row = getDeletionRow(threadId);
      if (row === undefined) {
        throw new QltDeletionError('QLT_DELETION_THREAD_MISSING', 'No deletion is recorded.');
      }
      if (str(row, 'status') === 'completed' || str(row, 'status') === 'canceled') {
        return rowToDeletion(row);
      }
      const now = clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `UPDATE qlt_conversation_deletion
           SET status = 'incomplete', error_code = ?, updated_at_ms = ?, version = version + 1
           WHERE thread_id = ? AND status IN ('planned','incomplete');`,
        ).run(input.errorCode, now, threadId);
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToDeletion(getDeletionRow(threadId)!);
    },

    // -----------------------------------------------------------------
    // Reads
    // -----------------------------------------------------------------
    getDeletion(threadId: string): QltDeletionRow | undefined {
      const row = getDeletionRow(assertId(threadId, 'thread id'));
      return row === undefined ? undefined : rowToDeletion(row);
    },
    listDeletions(input: { readonly limit?: number } = {}): readonly QltDeletionRow[] {
      const limit = input.limit ?? 200;
      const rows = db
        .prepare(
          'SELECT * FROM qlt_conversation_deletion ORDER BY requested_at_ms DESC, id ASC LIMIT ?;',
        )
        .all(limit) as unknown as RawRow[];
      return rows.map(rowToDeletion);
    },
    /** Open (not terminal) product deletions — boot recovery input. */
    listOpenDeletions(): readonly QltDeletionRow[] {
      const rows = db
        .prepare(
          "SELECT * FROM qlt_conversation_deletion WHERE status IN ('planned','incomplete') ORDER BY requested_at_ms ASC;",
        )
        .all() as unknown as RawRow[];
      return rows.map(rowToDeletion);
    },
    /**
     * The D2 export-support read: one bounded page of correction rows
     * (the meaning store's frozen list verb is subject-scoped; the
     * export needs the whole-store bounded page). Read-only.
     */
    listCorrectionsForExport(input: { readonly limit?: number } = {}): readonly RawRow[] {
      return db
        .prepare('SELECT * FROM qlt_correction ORDER BY created_at_ms DESC, id ASC LIMIT ?;')
        .all(input.limit ?? 200) as unknown as RawRow[];
    },

    getPurgeReceipt(threadId: string): QltPurgeRow | undefined {
      const row = db
        .prepare('SELECT * FROM qlt_conversation_purge WHERE thread_id = ?;')
        .get(assertId(threadId, 'thread id')) as RawRow | undefined;
      if (row === undefined) {
        return undefined;
      }
      return {
        id: str(row, 'id'),
        threadId: str(row, 'thread_id'),
        purgedBy: str(row, 'purged_by'),
        challenges: num(row, 'challenges'),
        amendments: num(row, 'amendments'),
        corrections: num(row, 'corrections'),
        sourceLinks: num(row, 'source_links'),
        proposals: num(row, 'proposals'),
        originatingTombstones: num(row, 'originating_tombstones'),
        assemblyRows: num(row, 'assembly_rows'),
        vacuumed: num(row, 'vacuumed'),
        createdAtMs: num(row, 'created_at_ms'),
      };
    },
    listPurgeReceipts(input: { readonly limit?: number } = {}): readonly QltPurgeRow[] {
      const rows = db
        .prepare('SELECT * FROM qlt_conversation_purge ORDER BY created_at_ms DESC LIMIT ?;')
        .all(input.limit ?? 200) as unknown as RawRow[];
      return rows.map((row) => ({
        id: str(row, 'id'),
        threadId: str(row, 'thread_id'),
        purgedBy: str(row, 'purged_by'),
        challenges: num(row, 'challenges'),
        amendments: num(row, 'amendments'),
        corrections: num(row, 'corrections'),
        sourceLinks: num(row, 'source_links'),
        proposals: num(row, 'proposals'),
        originatingTombstones: num(row, 'originating_tombstones'),
        assemblyRows: num(row, 'assembly_rows'),
        vacuumed: num(row, 'vacuumed'),
        createdAtMs: num(row, 'created_at_ms'),
      }));
    },

    // -----------------------------------------------------------------
    // Deep purge (separate, explicit, high-intent; one transaction)
    // -----------------------------------------------------------------

    /**
     * The content-free deep purge of an already governed-deleted
     * conversation (safety contract §5). Requires the explicit
     * confirmation token and a `completed` deletion row. One transaction
     * in the frozen FK-driven order; the receipt is content-free;
     * VACUUM runs separately afterwards (best-effort).
     */
    purgeConversation(input: {
      readonly threadId: string;
      readonly purgedBy: string;
      readonly confirmation: string;
    }): QltPurgeRow {
      const threadId = assertId(input.threadId, 'thread id');
      const purgedBy = assertUserActor(input.purgedBy, 'purge a conversation');
      if (input.confirmation !== QLT_D2_PURGE_CONFIRMATION_TOKEN) {
        throw new QltDeletionError(
          'QLT_PURGE_CONFIRMATION_INVALID',
          'The explicit purge confirmation token was not provided.',
        );
      }
      const deletion = getDeletionRow(threadId);
      if (deletion === undefined || str(deletion, 'status') !== 'completed') {
        throw new QltDeletionError(
          'QLT_PURGE_NOT_AVAILABLE',
          'A conversation can be purged only after its deletion completed.',
        );
      }
      if (!isThreadRemoved(threadId)) {
        throw new QltDeletionError(
          'QLT_PURGE_NOT_AVAILABLE',
          'The conversation tombstone is not present.',
        );
      }

      const counts: Record<QltD2PurgeStep, number> = {
        challenges: 0,
        amendments: 0,
        corrections: 0,
        'source-links': 0,
        proposals: 0,
        'originating-tombstones': 0,
        'assembly-evidence': 0,
        'conversation-link': 0,
        thread: 0,
      };

      db.exec('BEGIN IMMEDIATE;');
      try {
        const single = (sql: string, ...params: (string | number)[]): number => {
          const result = db.prepare(sql).run(...params);
          return Number(result.changes);
        };
        // 1. challenges tied to the conversation's rows (FK children).
        counts.challenges = single(
          `DELETE FROM qlt_conflict_challenge WHERE thread_id = ?
             OR incoming_proposal_id IN (SELECT id FROM qlt_proposal WHERE source_thread_id = ?)
             OR existing_commitment_id IN (SELECT id FROM qlt_commitment WHERE source_thread_id = ?);`,
          threadId,
          threadId,
          threadId,
        );
        // 2. amendments tied to the conversation's commitments.
        counts.amendments = single(
          `DELETE FROM qlt_amendment WHERE source_thread_id = ?
             OR commitment_id IN (SELECT id FROM qlt_commitment WHERE source_thread_id = ?)
             OR successor_id IN (SELECT id FROM qlt_commitment WHERE source_thread_id = ?);`,
          threadId,
          threadId,
          threadId,
        );
        // 3. corrections originating from the conversation.
        counts.corrections = single(
          'DELETE FROM qlt_correction WHERE source_thread_id = ?;',
          threadId,
        );
        // 4. source links touching purged rows or the thread.
        counts['source-links'] = single(
          `DELETE FROM qlt_source_link
           WHERE to_ref = ? OR to_ref IN (SELECT id FROM qlt_proposal WHERE source_thread_id = ?)
              OR from_record_id IN (SELECT id FROM qlt_proposal WHERE source_thread_id = ?)
              OR from_record_id IN (SELECT id FROM qlt_claim WHERE source_thread_id = ?)
              OR from_record_id IN (SELECT id FROM qlt_commitment WHERE source_thread_id = ?)
              OR from_record_id IN (SELECT id FROM qlt_open_loop WHERE source_thread_id = ?)
              OR from_record_id IN (SELECT id FROM qlt_correction WHERE source_thread_id = ?);`,
          threadId,
          threadId,
          threadId,
          threadId,
          threadId,
          threadId,
          threadId,
        );
        // 5. proposals originating from the conversation.
        counts.proposals = single('DELETE FROM qlt_proposal WHERE source_thread_id = ?;', threadId);
        // 6. originating subject rows (tombstones by now).
        for (const table of Object.values(SUBJECT_TABLES)) {
          counts['originating-tombstones'] += single(
            `DELETE FROM ${table} WHERE source_thread_id = ?;`,
            threadId,
          );
        }
        // 7. the thread's context-assembly evidence rows.
        counts['assembly-evidence'] = single(
          'DELETE FROM qlt_context_assembly WHERE thread_id = ?;',
          threadId,
        );
        // 8. the conversation link; 9. the thread row itself.
        counts['conversation-link'] = single(
          'DELETE FROM qlt_thread_conversation WHERE thread_id = ?;',
          threadId,
        );
        counts.thread = single('DELETE FROM qlt_thread WHERE id = ?;', threadId);

        db.prepare(
          `INSERT INTO qlt_conversation_purge
             (id, thread_id, purged_by, challenges, amendments, corrections, source_links,
              proposals, originating_tombstones, assembly_rows, vacuumed, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?);`,
        ).run(
          purgeId(),
          threadId,
          purgedBy,
          counts.challenges,
          counts.amendments,
          counts.corrections,
          counts['source-links'],
          counts.proposals,
          counts['originating-tombstones'],
          counts['assembly-evidence'],
          clock(),
        );
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }

      // Best-effort VACUUM OUTSIDE the transaction (reclaims freed
      // pages within the application's own database file; never a
      // secure-erasure claim).
      let vacuumed = 0;
      try {
        db.exec('VACUUM;');
        vacuumed = 1;
      } catch {
        vacuumed = 0;
      }
      if (vacuumed === 1) {
        db.exec('BEGIN IMMEDIATE;');
        try {
          db.prepare('UPDATE qlt_conversation_purge SET vacuumed = 1 WHERE thread_id = ?;').run(
            threadId,
          );
          db.exec('COMMIT;');
        } catch (cause) {
          db.exec('ROLLBACK;');
          throw cause;
        }
      }
      const receipt = this.getPurgeReceipt(threadId);
      if (receipt === undefined) {
        throw new QltDeletionError('QLT_PURGE_INCOMPLETE', 'The purge receipt is missing.');
      }
      return receipt;
    },

    /** The purge step order (frozen data; used by the verify gate). */
    purgeStepOrder: QLT_D2_PURGE_STEP_ORDER,
  };
}

export type SharedWorldDeletionStore = ReturnType<typeof createSharedWorldDeletionStore>;
