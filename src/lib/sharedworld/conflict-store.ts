/**
 * The Stage 07D Lane B conflict and amendment repository.
 *
 * FROZEN CONTRACT: the D1a freeze (`d1-contract.ts` §6/§6b/§7;
 * docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md). This
 * module contains the ONLY write paths for:
 *   - challenge judgment records (`qlt_conflict_challenge`): created
 *     ONLY through `ensureChallenge` from the deterministic confirm-time
 *     detector (single classification `commitment-key-conflict`),
 *     resolved ONLY by the two user verbs (`dismissChallenge`,
 *     `resolveChallengeWithAmendment`);
 *   - the amendment of an ACTIVE commitment (`amendCommitment`): ONE
 *     successor commitment, the predecessor moved to `amended`, ONE
 *     immutable `qlt_amendment` judgment row, the successor --amends-->
 *     predecessor source link. No other code path can produce an
 *     amendment row, an `amends` link, or an `amended` status.
 *
 * Authority: every mutation asserts a USER identity (`actor-*`); an
 * `agent-*` identity fails closed. Every mutation is keyed-idempotent,
 * optimistic-version-aware, and transactional. Challenges are
 * epistemically inert: they are never context candidates, never resolve
 * current-effective meaning, and never mutate the records they
 * reference. A removal of a referenced commitment leaves the challenge
 * open and truthful (its projections read the referenced rows' CURRENT
 * state — no hidden auto-transition).
 */

import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  canonicalJson,
  contentFingerprint,
  QltMeaningError,
  type QltSubjectFamily,
} from './meaning-contract.js';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const USER_ACTOR = /^actor-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export type QltChallengeStatus = 'open' | 'dismissed' | 'resolved';
export type QltChallengeResolution = 'incoming-abandoned' | 'existing-amended';

export interface QltChallengeView {
  readonly challengeId: string;
  readonly status: QltChallengeStatus;
  readonly classification: string;
  readonly existingCommitmentId: string;
  readonly incomingProposalId: string;
  readonly resolution: QltChallengeResolution | null;
  readonly createdBy: string;
  readonly resolvedBy: string | null;
  readonly reason: string | null;
  readonly threadId: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly resolvedAtMs: number | null;
  /**
   * Truthful projection inputs: the CURRENT states of the two referenced
   * rows (read at projection time; a removed commitment renders its
   * tombstone state, never its old content).
   */
  readonly existingState: {
    readonly status: string;
    readonly retentionState: string;
    readonly version: number;
  } | null;
  readonly incomingState: { readonly status: string } | null;
}

export interface QltAmendmentView {
  readonly amendmentId: string;
  readonly status: string;
  readonly commitmentId: string;
  readonly amendmentKey: string;
  readonly amendedBy: string;
  readonly reason: string | null;
  readonly successorId: string;
  readonly createdAtMs: number;
}

export interface SharedWorldConflictStoreOptions {
  readonly clock?: () => number;
  readonly ids?: {
    readonly challengeId?: () => string;
    readonly amendmentId?: () => string;
    readonly recordId?: () => string;
  };
}

export interface QltChallengeQuery {
  readonly status?: QltChallengeStatus;
  readonly threadId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

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
function optNum(row: RawRow, column: string): number | null {
  const value = row[column];
  return typeof value === 'number' ? value : null;
}

export function createSharedWorldConflictStore(
  db: DatabaseSync,
  options: SharedWorldConflictStoreOptions = {},
): SharedWorldConflictStore {
  const clock = options.clock ?? (() => Date.now());
  const challengeIdFactory =
    options.ids?.challengeId ?? (() => `qltchal-${randomBytes(8).toString('hex')}`);
  const amendmentIdFactory =
    options.ids?.amendmentId ?? (() => `qltamend-${randomBytes(8).toString('hex')}`);
  const recordIdFactory = options.ids?.recordId ?? (() => `qlt-${randomBytes(8).toString('hex')}`);

  // ---- shared guards ---------------------------------------------------------

  function assertId(value: string, label: string): string {
    if (typeof value !== 'string' || !SAFE_ID.test(value)) {
      throw new QltMeaningError('QLT_INPUT_INVALID_ID', `The ${label} must be a bounded safe id.`);
    }
    return value;
  }
  function assertUserActor(value: string, role: string): string {
    if (typeof value !== 'string' || !USER_ACTOR.test(value)) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_IDENTITY',
        `Only a user identity may act as the ${role}.`,
      );
    }
    return value;
  }
  function assertOptionalText(value: string | undefined, max: number, label: string) {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || value.length === 0 || value.length > max) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        `The ${label} must be a non-empty string of at most ${max} characters.`,
      );
    }
    return value;
  }
  function assertStatement(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2000) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The field statement must be a non-empty string of at most 2000 characters.',
      );
    }
    return value;
  }

  // ---- keyed idempotency (the shared application-layer table) ----------------

  function lookupKey(scope: string, key: string): { rowIdentity: string; fingerprint: string } | undefined {
    const row = db
      .prepare('SELECT row_identity, fingerprint FROM qlt_adapter_idempotency WHERE scope_key = ?;')
      .get(`${scope}::${key}`) as { row_identity: string; fingerprint: string } | undefined;
    return row === undefined
      ? undefined
      : { rowIdentity: row.row_identity, fingerprint: row.fingerprint };
  }
  function recordKey(scope: string, key: string, rowIdentity: string, fingerprint: string): void {
    db.prepare(
      'INSERT INTO qlt_adapter_idempotency (scope_key, row_identity, fingerprint) VALUES (?, ?, ?);',
    ).run(`${scope}::${key}`, rowIdentity, fingerprint);
  }
  function resolveKeyed<T>(
    scope: string,
    key: string | undefined,
    payload: Record<string, unknown>,
    replay: (rowIdentity: string) => T,
  ): { prior: T | undefined; fingerprint: string } {
    if (key === undefined) {
      return { prior: undefined, fingerprint: '' };
    }
    const prior = lookupKey(scope, key);
    const fingerprint = JSON.stringify(payload);
    if (prior !== undefined) {
      if (prior.fingerprint !== fingerprint) {
        throw new QltMeaningError(
          'QLT_IDEMPOTENCY_CONFLICT',
          'This idempotency key was already used for a different payload.',
        );
      }
      return { prior: replay(prior.rowIdentity), fingerprint };
    }
    return { prior: undefined, fingerprint };
  }

  // ---- row reads -------------------------------------------------------------

  function getChallengeRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_conflict_challenge WHERE id = ?;').get(id) as
      | RawRow
      | undefined;
  }
  function getCommitmentRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_commitment WHERE id = ?;').get(id) as RawRow | undefined;
  }
  function getProposalRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_proposal WHERE id = ?;').get(id) as RawRow | undefined;
  }

  function challengeToView(row: RawRow): QltChallengeView {
    const existing = getCommitmentRow(str(row, 'existing_commitment_id'));
    const incoming = getProposalRow(str(row, 'incoming_proposal_id'));
    return {
      challengeId: str(row, 'id'),
      status: str(row, 'status') as QltChallengeStatus,
      classification: str(row, 'classification'),
      existingCommitmentId: str(row, 'existing_commitment_id'),
      incomingProposalId: str(row, 'incoming_proposal_id'),
      resolution: optStr(row, 'resolution') as QltChallengeResolution | null,
      createdBy: str(row, 'created_by'),
      resolvedBy: optStr(row, 'resolved_by'),
      reason: optStr(row, 'reason'),
      threadId: str(row, 'thread_id'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      resolvedAtMs: optNum(row, 'resolved_at_ms'),
      // Truthful CURRENT-state projections (content is never read here).
      existingState:
        existing === undefined
          ? null
          : {
              status: str(existing, 'status'),
              retentionState: str(existing, 'retention_state'),
              version: num(existing, 'version'),
            },
      incomingState: incoming === undefined ? null : { status: str(incoming, 'status') },
    };
  }

  // ---- amendment mechanics (usable inside a surrounding transaction) ---------

  interface AppliedAmendment {
    readonly amendmentId: string;
    readonly predecessorId: string;
    readonly successorId: string;
  }

  function applyAmendmentInTransaction(input: {
    readonly commitmentId: string;
    readonly statement: string;
    readonly reason?: string;
    readonly amendedBy: string;
    readonly amendmentKey: string;
    readonly now: number;
    readonly sourceThreadId?: string;
  }): AppliedAmendment {
    const row = getCommitmentRow(input.commitmentId);
    if (row === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The commitment does not exist.');
    }
    if (str(row, 'status') !== 'active') {
      throw new QltMeaningError(
        'QLT_RECORD_NOT_CURRENT',
        'Only an active commitment can be amended.',
        { currentStatus: str(row, 'status') },
      );
    }
    // D1a freeze §6b/§7: a removed or expired commitment can never be
    // amended (no ghost derivatives; no resurrection).
    if (str(row, 'retention_state') !== 'currently-relevant') {
      throw new QltMeaningError(
        'QLT_RECORD_NOT_CURRENT',
        'The commitment is not currently-relevant; removed or expired material is never amended.',
        { currentRetentionState: str(row, 'retention_state') },
      );
    }
    const successorId = recordIdFactory();
    const amendmentId = amendmentIdFactory();
    const priorFingerprint = str(row, 'content_fingerprint');
    // The predecessor moves FIRST: only after the key is vacated (status
    // 'amended' leaves the partial UNIQUE active-key index) may the
    // same-key successor be inserted.
    db.prepare(
      `UPDATE qlt_commitment SET status = 'amended', version = version + 1, updated_at_ms = ? WHERE id = ?;`,
    ).run(input.now, input.commitmentId);
    // Deterministic canonical serialization + fingerprint, identical to
    // the frozen 07C primitives (single-field commitment content).
    const canonicalText = canonicalJson({ statement: input.statement });
    const fingerprint = contentFingerprint({ statement: input.statement });
    const sourceThreadId = input.sourceThreadId ?? optStr(row, 'source_thread_id');
    // The successor: same key, new content, lineage-linked.
    db.prepare(
      `INSERT INTO qlt_commitment
        (id, version, status, commitment_key, content, content_fingerprint,
         normative_basis_proposal_id, proposal_id, created_by, supersedes_id,
         source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'active', ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, ?, ?, ?, 'currently-relevant');`,
    ).run(
      successorId,
      str(row, 'commitment_key'),
      canonicalText,
      fingerprint,
      input.amendedBy,
      input.commitmentId,
      sourceThreadId,
      input.now,
      input.now,
      input.now,
    );
    // The immutable judgment row.
    db.prepare(
      `INSERT INTO qlt_amendment
        (id, version, status, commitment_id, amendment_key, prior_content_fingerprint, reason,
         content, content_fingerprint, amended_by, successor_id, source_thread_id,
         created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'recorded', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      amendmentId,
      input.commitmentId,
      input.amendmentKey,
      priorFingerprint,
      input.reason ?? null,
      canonicalText,
      fingerprint,
      input.amendedBy,
      successorId,
      sourceThreadId,
      input.now,
      input.now,
      input.now,
    );
    // The lineage link (the frozen 07C relation vocabulary carries 'amends').
    db.prepare(
      `INSERT INTO qlt_source_link
        (id, from_record_id, from_record_family, to_kind, to_ref, relation, created_at_ms, retention_state)
       VALUES (?, ?, 'commitment', 'record', ?, 'amends', ?, 'currently-relevant');`,
    ).run(`qltlink-${randomBytes(8).toString('hex')}`, successorId, input.commitmentId, input.now);
    return { amendmentId, predecessorId: input.commitmentId, successorId };
  }

  return {
    ensureChallenge(input: {
      readonly existingCommitmentId: string;
      readonly incomingProposalId: string;
      readonly createdBy: string;
      readonly key?: string;
      readonly now?: number;
    }): { challenge: QltChallengeView; created: boolean } {
      const existingId = assertId(input.existingCommitmentId, 'existing commitment id');
      const incomingId = assertId(input.incomingProposalId, 'incoming proposal id');
      const actor = assertUserActor(input.createdBy, 'challenge attributor');
      const now = input.now ?? clock();
      // Convergence: one challenge per incoming proposal (UNIQUE). The
      // deterministic re-attempt re-raises the SAME refusal against the
      // SAME challenge.
      const existingRow = db
        .prepare('SELECT * FROM qlt_conflict_challenge WHERE incoming_proposal_id = ?;')
        .get(incomingId) as RawRow | undefined;
      if (existingRow !== undefined) {
        return { challenge: challengeToView(existingRow), created: false };
      }
      const existing = getCommitmentRow(existingId);
      if (existing === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The existing commitment does not exist.');
      }
      const proposal = getProposalRow(incomingId);
      if (proposal === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The incoming proposal does not exist.');
      }
      // The detector's frozen precondition: the referenced commitment is
      // ACTIVE and currently-relevant, and the incoming proposal carries
      // the SAME commitment key.
      if (str(existing, 'status') !== 'active' || str(existing, 'retention_state') !== 'currently-relevant') {
        throw new QltMeaningError(
          'QLT_COMMITMENT_CONFLICT',
          'The referenced commitment is not active and currently-relevant.',
        );
      }
      if (optStr(proposal, 'proposal_kind') !== 'commitment') {
        throw new QltMeaningError(
          'QLT_INPUT_INVALID_TYPE',
          'The incoming proposal is not a commitment proposal.',
        );
      }
      const challengeId = challengeIdFactory();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO qlt_conflict_challenge
            (id, version, status, classification, existing_commitment_id, incoming_proposal_id,
             resolution, created_by, resolved_by, reason, thread_id,
             created_at_ms, updated_at_ms, resolved_at_ms, retention_state)
           VALUES (?, 1, 'open', 'commitment-key-conflict', ?, ?, NULL, ?, NULL, NULL, ?, ?, ?, NULL, 'currently-relevant');`,
        ).run(
          challengeId,
          existingId,
          incomingId,
          actor,
          str(proposal, 'source_thread_id'),
          now,
          now,
        );
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        // A concurrent detector hit the same UNIQUE — converge truthfully.
        const converged = db
          .prepare('SELECT * FROM qlt_conflict_challenge WHERE incoming_proposal_id = ?;')
          .get(incomingId) as RawRow | undefined;
        if (converged !== undefined) {
          return { challenge: challengeToView(converged), created: false };
        }
        throw cause;
      }
      return { challenge: challengeToView(getChallengeRow(challengeId)!), created: true };
    },

    dismissChallenge(input: {
      readonly challengeId: string;
      readonly reason?: string;
      readonly expectedVersion?: number;
      readonly dismissedBy: string;
      readonly key?: string;
      readonly now?: number;
    }): QltChallengeView {
      const challengeId = assertId(input.challengeId, 'challenge id');
      const actor = assertUserActor(input.dismissedBy, 'challenger');
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
      const payload = { verb: 'conflict.dismiss', challengeId, actor };
      const { prior } = resolveKeyed('qlt.conflict::dismiss', key, payload, (rowIdentity) =>
        challengeToView(getChallengeRow(rowIdentity)!),
      );
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        const row = getChallengeRow(challengeId);
        if (row === undefined) {
          throw new QltMeaningError('QLT_RECORD_MISSING', 'The challenge does not exist.');
        }
        if (str(row, 'status') !== 'open') {
          throw new QltMeaningError(
            'QLT_CHALLENGE_NOT_OPEN',
            'Only an open challenge can be dismissed.',
            { currentStatus: str(row, 'status') },
          );
        }
        if (input.expectedVersion !== undefined && input.expectedVersion !== num(row, 'version')) {
          throw new QltMeaningError(
            'QLT_VERSION_CONFLICT',
            'The record changed since it was read (optimistic version check).',
            { currentVersion: num(row, 'version') },
          );
        }
        db.prepare(
          `UPDATE qlt_conflict_challenge
           SET status = 'dismissed', resolution = 'incoming-abandoned', resolved_by = ?,
               reason = ?, resolved_at_ms = ?, updated_at_ms = ?, version = version + 1
           WHERE id = ?;`,
        ).run(actor, reason ?? null, now, now, challengeId);
        if (key !== undefined) {
          recordKey('qlt.conflict::dismiss', key, challengeId, JSON.stringify(payload));
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return challengeToView(getChallengeRow(challengeId)!);
    },

    resolveChallengeWithAmendment(input: {
      readonly challengeId: string;
      readonly statement: string;
      readonly reason?: string;
      readonly expectedVersion?: number;
      readonly resolvedBy: string;
      readonly key?: string;
      readonly now?: number;
    }): { challenge: QltChallengeView; amendment: QltAmendmentView } {
      const challengeId = assertId(input.challengeId, 'challenge id');
      const statement = assertStatement(input.statement);
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const actor = assertUserActor(input.resolvedBy, 'challenger');
      const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
      const payload = { verb: 'conflict.resolveAmend', challengeId, statement, actor };
      const { prior } = resolveKeyed('qlt.conflict::resolve-amend', key, payload, (rowIdentity) => {
        const row = getChallengeRow(rowIdentity)!;
        const amendmentRow = db
          .prepare(
            'SELECT * FROM qlt_amendment WHERE commitment_id = ? ORDER BY created_at_ms DESC, id ASC LIMIT 1;',
          )
          .get(str(row, 'existing_commitment_id')) as RawRow | undefined;
        if (amendmentRow === undefined) {
          throw new QltMeaningError(
            'QLT_STORE_ERROR',
            'The idempotent record could not be resolved.',
          );
        }
        return {
          challenge: challengeToView(row),
          amendment: amendmentToView(amendmentRow),
        };
      });
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        const row = getChallengeRow(challengeId);
        if (row === undefined) {
          throw new QltMeaningError('QLT_RECORD_MISSING', 'The challenge does not exist.');
        }
        if (str(row, 'status') !== 'open') {
          throw new QltMeaningError(
            'QLT_CHALLENGE_NOT_OPEN',
            'Only an open challenge can be resolved.',
            { currentStatus: str(row, 'status') },
          );
        }
        if (input.expectedVersion !== undefined && input.expectedVersion !== num(row, 'version')) {
          throw new QltMeaningError(
            'QLT_VERSION_CONFLICT',
            'The record changed since it was read (optimistic version check).',
            { currentVersion: num(row, 'version') },
          );
        }
        const applied = applyAmendmentInTransaction({
          commitmentId: str(row, 'existing_commitment_id'),
          statement,
          reason,
          amendedBy: actor,
          amendmentKey: `resolve-${challengeId}`,
          now,
        });
        db.prepare(
          `UPDATE qlt_conflict_challenge
           SET status = 'resolved', resolution = 'existing-amended', resolved_by = ?,
               resolved_at_ms = ?, updated_at_ms = ?, version = version + 1
           WHERE id = ?;`,
        ).run(actor, now, now, challengeId);
        if (key !== undefined) {
          recordKey('qlt.conflict::resolve-amend', key, challengeId, JSON.stringify(payload));
        }
        db.exec('COMMIT;');
        const amendmentRow = db
          .prepare('SELECT * FROM qlt_amendment WHERE id = ?;')
          .get(applied.amendmentId) as RawRow;
        return { challenge: challengeToView(getChallengeRow(challengeId)!), amendment: amendmentToView(amendmentRow) };
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
    },

    amendCommitment(input: {
      readonly commitmentId: string;
      readonly statement: string;
      readonly reason?: string;
      readonly expectedVersion?: number;
      readonly amendedBy: string;
      readonly key?: string;
      readonly now?: number;
    }): { amendment: QltAmendmentView; predecessor: RawRowShape; successor: RawRowShape } {
      const commitmentId = assertId(input.commitmentId, 'commitment id');
      const statement = assertStatement(input.statement);
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const actor = assertUserActor(input.amendedBy, 'amender');
      const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
      const payload = { verb: 'conflict.amend', commitmentId, statement, actor };
      const { prior } = resolveKeyed('qlt.conflict::amend', key, payload, (rowIdentity) => {
        const amendmentRow = db
          .prepare('SELECT * FROM qlt_amendment WHERE id = ?;')
          .get(rowIdentity) as RawRow | undefined;
        if (amendmentRow === undefined) {
          throw new QltMeaningError(
            'QLT_STORE_ERROR',
            'The idempotent record could not be resolved.',
          );
        }
        const successor = db
          .prepare('SELECT * FROM qlt_commitment WHERE id = ?;')
          .get(str(amendmentRow, 'successor_id')) as RawRow | undefined;
        const predecessor = getCommitmentRow(str(amendmentRow, 'commitment_id'));
        if (successor === undefined || predecessor === undefined) {
          throw new QltMeaningError(
            'QLT_STORE_ERROR',
            'The idempotent record could not be resolved.',
          );
        }
        return {
          amendment: amendmentToView(amendmentRow),
          predecessor: rowShape(predecessor),
          successor: rowShape(successor),
        };
      });
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        const row = getCommitmentRow(commitmentId);
        if (row === undefined) {
          throw new QltMeaningError('QLT_RECORD_MISSING', 'The commitment does not exist.');
        }
        if (input.expectedVersion !== undefined && input.expectedVersion !== num(row, 'version')) {
          throw new QltMeaningError(
            'QLT_VERSION_CONFLICT',
            'The record changed since it was read (optimistic version check).',
            { currentVersion: num(row, 'version') },
          );
        }
        const amendmentKey = `amend-${randomBytes(8).toString('hex')}`;
        const applied = applyAmendmentInTransaction({
          commitmentId,
          statement,
          reason,
          amendedBy: actor,
          amendmentKey,
          now,
        });
        if (key !== undefined) {
          recordKey('qlt.conflict::amend', key, applied.amendmentId, JSON.stringify(payload));
        }
        db.exec('COMMIT;');
        const amendmentRow = db
          .prepare('SELECT * FROM qlt_amendment WHERE id = ?;')
          .get(applied.amendmentId) as RawRow;
        return {
          amendment: amendmentToView(amendmentRow),
          predecessor: rowShape(getCommitmentRow(commitmentId)!),
          successor: rowShape(getCommitmentRow(applied.successorId)!),
        };
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
    },

    getChallenge(challengeId: string): QltChallengeView | undefined {
      const row = getChallengeRow(assertId(challengeId, 'challenge id'));
      return row === undefined ? undefined : challengeToView(row);
    },

    listChallenges(query: QltChallengeQuery | undefined): {
      readonly rows: readonly QltChallengeView[];
      readonly total: number;
    } {
      const limit = Math.min(Math.max(1, query?.limit ?? 50), 200);
      const offset = Math.max(0, query?.offset ?? 0);
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (query?.status !== undefined) {
        if (!['open', 'dismissed', 'resolved'].includes(query.status)) {
          throw new QltMeaningError('QLT_INPUT_INVALID_ENUM', 'Unknown challenge status filter.');
        }
        clauses.push('status = ?');
        params.push(query.status);
      }
      if (query?.threadId !== undefined) {
        clauses.push('thread_id = ?');
        params.push(assertId(query.threadId, 'thread id'));
      }
      const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const countRow = db
        .prepare(`SELECT COUNT(*) AS total FROM qlt_conflict_challenge${where};`)
        .get(...params) as { total: number };
      const rows = db
        .prepare(
          `SELECT * FROM qlt_conflict_challenge${where}
           ORDER BY created_at_ms DESC, id ASC LIMIT ? OFFSET ?;`,
        )
        .all(...params, limit, offset) as unknown as RawRow[];
      return { rows: rows.map(challengeToView), total: countRow.total };
    },

    listAmendments(input: { readonly commitmentId: string }): readonly QltAmendmentView[] {
      const commitmentId = assertId(input.commitmentId, 'commitment id');
      const rows = db
        .prepare(
          'SELECT * FROM qlt_amendment WHERE commitment_id = ? ORDER BY created_at_ms DESC, id ASC;',
        )
        .all(commitmentId) as unknown as RawRow[];
      return rows.map(amendmentToView);
    },

    hasAmendmentRows(): boolean {
      const row = db.prepare('SELECT COUNT(*) AS total FROM qlt_amendment;').get() as {
        total: number;
      };
      return row.total > 0;
    },
  };
}

/** Minimal truthful commitment shape for amendment outcomes. */
export interface RawRowShape {
  readonly id: string;
  readonly status: string;
  readonly retentionState: string;
  readonly version: number;
  readonly commitmentKey: string | null;
}

function rowShape(row: RawRow): RawRowShape {
  return {
    id: str(row, 'id'),
    status: str(row, 'status'),
    retentionState: str(row, 'retention_state'),
    version: num(row, 'version'),
    commitmentKey: optStr(row, 'commitment_key'),
  };
}

function amendmentToView(row: RawRow): QltAmendmentView {
  return {
    amendmentId: str(row, 'id'),
    status: str(row, 'status'),
    commitmentId: str(row, 'commitment_id'),
    amendmentKey: str(row, 'amendment_key'),
    amendedBy: str(row, 'amended_by'),
    reason: optStr(row, 'reason'),
    successorId: str(row, 'successor_id'),
    createdAtMs: num(row, 'created_at_ms'),
  };
}

export interface SharedWorldConflictStore {
  ensureChallenge(input: {
    readonly existingCommitmentId: string;
    readonly incomingProposalId: string;
    readonly createdBy: string;
    readonly key?: string;
    readonly now?: number;
  }): { challenge: QltChallengeView; created: boolean };
  dismissChallenge(input: {
    readonly challengeId: string;
    readonly reason?: string;
    readonly expectedVersion?: number;
    readonly dismissedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): QltChallengeView;
  resolveChallengeWithAmendment(input: {
    readonly challengeId: string;
    readonly statement: string;
    readonly reason?: string;
    readonly expectedVersion?: number;
    readonly resolvedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): { challenge: QltChallengeView; amendment: QltAmendmentView };
  amendCommitment(input: {
    readonly commitmentId: string;
    readonly statement: string;
    readonly reason?: string;
    readonly expectedVersion?: number;
    readonly amendedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): { amendment: QltAmendmentView; predecessor: RawRowShape; successor: RawRowShape };
  getChallenge(challengeId: string): QltChallengeView | undefined;
  listChallenges(query: QltChallengeQuery | undefined): {
    readonly rows: readonly QltChallengeView[];
    readonly total: number;
  };
  listAmendments(input: { readonly commitmentId: string }): readonly QltAmendmentView[];
  hasAmendmentRows(): boolean;
}

// A quiet type re-export so the family vocabulary stays import-bound.
export type QltConflictSubjectFamily = QltSubjectFamily;
