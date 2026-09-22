/**
 * The Stage 07D Lane A retention and user-removal repository.
 *
 * FROZEN CONTRACT: the D1a freeze (`d1-contract.ts`;
 * docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md). This
 * module conforms to that data and contains the ONLY write paths for:
 *   - governed USER removal (the content-free tombstone; any subject
 *     family; `currently-relevant → user-removed` and
 *     `expired → user-removed` only);
 *   - user-assigned claim expiry metadata (claims ONLY; future times
 *     only; commitments and open loops can never carry expiry);
 *   - the deterministic visible enforcement pass (the ONLY writer of
 *     `expired`; append-only pass evidence in `qlt_retention_pass`).
 *
 * Authority: every mutation asserts a USER identity (`actor-*`); an
 * `agent-*` identity fails closed with zero effect (the agent envelope
 * has no path here at all — this is defense in depth). Every mutation is
 * keyed-idempotent over the shared `qlt_adapter_idempotency` table
 * (distinct scopes), optimistic-version-aware, and runs in ONE
 * transaction (a crash leaves the prior state exactly intact). Reads
 * NEVER write: no read path here mutates any retention state.
 *
 * The storage layer enforces truthfulness independently: the amended
 * family CHECKs refuse a `user-removed` row that still carries content
 * or a removal bookkeeping mismatch, and refuse expiry metadata on a
 * removed row or a non-claim family (no column exists).
 */

import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import {
  QLT_D1_RETENTION_PASS_SCOPE,
  QLT_D1_RETENTION_TRANSITIONS,
  type QltD1RetentionState,
} from './d1-contract.js';
import {
  QLT_SUBJECT_FAMILIES,
  QltMeaningError,
  type QltSubjectFamily,
} from './meaning-contract.js';

// ---------------------------------------------------------------------------
// View types (bounded, truthful retention projections)
// ---------------------------------------------------------------------------

export interface QltRetentionRecordView {
  readonly recordId: string;
  readonly family: QltSubjectFamily;
  readonly status: string;
  readonly retentionState: QltD1RetentionState;
  readonly version: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  /** Claims only; null otherwise (and null on a removed claim). */
  readonly expiresAtMs: number | null;
  readonly removedAtMs: number | null;
  readonly removedBy: string | null;
  readonly sourceThreadId: string | null;
}

export interface QltRetentionPassReport {
  readonly passId: string;
  readonly ranBy: string;
  readonly ranAtMs: number;
  readonly examined: number;
  readonly expiredCount: number;
  readonly expiredIds: readonly string[];
}

export interface QltRetentionViewQuery {
  readonly family?: QltSubjectFamily;
  readonly retentionState?: QltD1RetentionState;
  readonly threadId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** The Lane A retention repository surface (frozen d1-contract §15 ownership). */
export interface SharedWorldRetentionStore {
  setClaimExpiry(input: {
    readonly claimId: string;
    readonly expiresAtMs?: number | null;
    readonly expectedVersion?: number;
    readonly assignedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionRecordView>;
  removeRecord(input: {
    readonly recordId: string;
    readonly family: QltSubjectFamily;
    readonly expectedVersion?: number;
    readonly removedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionRecordView>;
  runRetentionPass(input: {
    readonly ranBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionPassReport>;
  listRetentionPasses(input: {
    readonly limit?: number;
  }): Promise<readonly QltRetentionPassReport[]>;
  getRecordView(input: {
    readonly recordId: string;
    readonly family: QltSubjectFamily;
  }): Promise<QltRetentionRecordView | undefined>;
  listRecordViews(
    query: QltRetentionViewQuery | undefined,
  ): Promise<{ readonly rows: readonly QltRetentionRecordView[]; readonly total: number }>;
}

export interface SharedWorldRetentionStoreOptions {
  readonly clock?: () => number;
  readonly ids?: { readonly passId?: () => string };
}

/** Batch bound: the pass evidence row bounds its id list (≤ 4096 bytes). */
const PASS_BATCH_LIMIT = 100;
const VIEW_DEFAULT_LIMIT = 50;
const VIEW_MAX_LIMIT = 200;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const USER_ACTOR = /^actor-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

const FAMILY_TABLE: Readonly<Record<QltSubjectFamily, string>> = {
  claim: 'qlt_claim',
  commitment: 'qlt_commitment',
  open_loop: 'qlt_open_loop',
};

/** The per-family tombstone UPDATE fragments (d1-contract §1; frozen). */
const TOMBSTONE_NULL_SETS: Readonly<Record<QltSubjectFamily, readonly string[]>> = {
  claim: [
    'subject',
    'epistemic_type',
    'honesty_state',
    'confidence',
    'content',
    'content_fingerprint',
    'expires_at_ms',
  ],
  commitment: ['commitment_key', 'content', 'content_fingerprint'],
  open_loop: ['subject', 'loop_kind', 'exit_reason', 'content', 'content_fingerprint'],
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
function optNum(row: RawRow, column: string): number | null {
  const value = row[column];
  return typeof value === 'number' ? value : null;
}
function optStr(row: RawRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

export function createSharedWorldRetentionStore(
  db: DatabaseSync,
  options: SharedWorldRetentionStoreOptions = {},
): SharedWorldRetentionStore {
  const clock = options.clock ?? (() => Date.now());
  const passIdFactory = options.ids?.passId ?? (() => `qltpass-${randomBytes(8).toString('hex')}`);

  // ---- shared guards --------------------------------------------------------

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

  function assertFamily(value: QltSubjectFamily): QltSubjectFamily {
    if (!(QLT_SUBJECT_FAMILIES as readonly string[]).includes(value)) {
      throw new QltMeaningError('QLT_INPUT_INVALID_ENUM', 'The record family is not recognized.');
    }
    return value;
  }

  // ---- keyed idempotency (the shared application-layer table) ---------------

  interface KeyedOutcome {
    readonly rowIdentity: string;
    readonly fingerprint: string;
  }

  function lookupKey(scope: string, key: string): KeyedOutcome | undefined {
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

  /**
   * Same key + same payload → replay the settled outcome; same key +
   * DIFFERENT payload → the established conflict code (zero effect).
   */
  function resolveKeyed<T>(
    scope: string,
    key: string | undefined,
    payload: Record<string, unknown>,
    replay: (rowIdentity: string) => T,
  ): { readonly prior: T | undefined; readonly fingerprint: string } {
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

  // ---- row reads ------------------------------------------------------------

  function getViewRow(family: QltSubjectFamily, recordId: string): RawRow | undefined {
    return db.prepare(`SELECT * FROM ${FAMILY_TABLE[family]} WHERE id = ?;`).get(recordId) as
      RawRow | undefined;
  }

  function rowToView(family: QltSubjectFamily, row: RawRow): QltRetentionRecordView {
    return {
      recordId: str(row, 'id'),
      family,
      status: str(row, 'status'),
      retentionState: str(row, 'retention_state') as QltD1RetentionState,
      version: num(row, 'version'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      expiresAtMs: family === 'claim' ? optNum(row, 'expires_at_ms') : null,
      removedAtMs: optNum(row, 'removed_at_ms'),
      removedBy: optStr(row, 'removed_by'),
      sourceThreadId: optStr(row, 'source_thread_id'),
    };
  }

  // ---- mutations ------------------------------------------------------------

  async function setClaimExpiry(input: {
    readonly claimId: string;
    readonly expiresAtMs?: number | null;
    readonly expectedVersion?: number;
    readonly assignedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionRecordView> {
    const claimId = assertId(input.claimId, 'claim id');
    const actor = assertUserActor(input.assignedBy, 'expiry assigner');
    const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
    const payload = {
      verb: 'retention.claimExpiry',
      claimId,
      actor,
      ...(input.expiresAtMs !== undefined ? { expiresAtMs: input.expiresAtMs } : {}),
    };
    const { prior } = resolveKeyed('qlt.retention::claim-expiry', key, payload, (rowIdentity) => {
      const row = getViewRow('claim', rowIdentity);
      if (row === undefined) {
        throw new QltMeaningError(
          'QLT_STORE_ERROR',
          'The idempotent record could not be resolved.',
        );
      }
      return rowToView('claim', row);
    });
    if (prior !== undefined) {
      return prior;
    }
    const now = input.now ?? clock();
    const row = getViewRow('claim', claimId);
    if (row === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The claim does not exist.');
    }
    const retentionState = str(row, 'retention_state');
    const status = str(row, 'status');
    // Expiry metadata is assignable ONLY to an ACTIVE, currently-relevant
    // claim (owner decision OD-D1: never a resurrection path, never a
    // removal path — an expired claim keeps its state until removed).
    if (status !== 'active' || retentionState !== 'currently-relevant') {
      throw new QltMeaningError(
        'QLT_RETENTION_INVALID_TRANSITION',
        'Expiry can only be assigned to an active, currently-relevant claim.',
        { currentStatus: status, currentRetentionState: retentionState },
      );
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== num(row, 'version')) {
      throw new QltMeaningError(
        'QLT_VERSION_CONFLICT',
        'The record changed since it was read (optimistic version check).',
        { currentVersion: num(row, 'version') },
      );
    }
    let next: number | null;
    if (input.expiresAtMs === undefined || input.expiresAtMs === null) {
      next = null; // clear
    } else {
      if (
        typeof input.expiresAtMs !== 'number' ||
        !Number.isSafeInteger(input.expiresAtMs) ||
        input.expiresAtMs < 0
      ) {
        throw new QltMeaningError(
          'QLT_INPUT_INVALID_TYPE',
          'The expiry time must be a non-negative safe-integer epoch millisecond value.',
        );
      }
      if (input.expiresAtMs <= now) {
        throw new QltMeaningError(
          'QLT_RETENTION_EXPIRY_INVALID',
          'The assigned expiry must lie in the future.',
        );
      }
      next = input.expiresAtMs;
    }
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(
        `UPDATE qlt_claim SET expires_at_ms = ?, version = version + 1, updated_at_ms = ? WHERE id = ?;`,
      ).run(next, now, claimId);
      if (key !== undefined) {
        recordKey('qlt.retention::claim-expiry', key, claimId, JSON.stringify(payload));
      }
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
    return rowToView('claim', getViewRow('claim', claimId)!);
  }

  async function removeRecord(input: {
    readonly recordId: string;
    readonly family: QltSubjectFamily;
    readonly expectedVersion?: number;
    readonly removedBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionRecordView> {
    const recordId = assertId(input.recordId, 'record id');
    const family = assertFamily(input.family);
    const actor = assertUserActor(input.removedBy, 'remover');
    const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
    const payload = { verb: 'retention.remove', recordId, family, actor };
    const { prior } = resolveKeyed('qlt.retention::remove', key, payload, (rowIdentity) => {
      const row = getViewRow(family, rowIdentity);
      if (row === undefined) {
        throw new QltMeaningError(
          'QLT_STORE_ERROR',
          'The idempotent record could not be resolved.',
        );
      }
      return rowToView(family, row);
    });
    if (prior !== undefined) {
      return prior;
    }
    const now = input.now ?? clock();
    const table = FAMILY_TABLE[family];
    db.exec('BEGIN IMMEDIATE;');
    try {
      const row = getViewRow(family, recordId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The record does not exist.');
      }
      const retentionState = str(row, 'retention_state') as QltD1RetentionState;
      // Retry convergence: an already-removed record converges on its
      // existing tombstone (no second effect, no version bump).
      if (retentionState === 'user-removed') {
        if (key !== undefined) {
          recordKey('qlt.retention::remove', key, recordId, JSON.stringify(payload));
        }
        db.exec('COMMIT;');
        return rowToView(family, row);
      }
      const allowed = QLT_D1_RETENTION_TRANSITIONS[retentionState];
      if (!allowed.includes('user-removed')) {
        throw new QltMeaningError(
          'QLT_RETENTION_INVALID_TRANSITION',
          'The retention lifecycle does not allow this transition.',
          { currentRetentionState: retentionState },
        );
      }
      if (input.expectedVersion !== undefined && input.expectedVersion !== num(row, 'version')) {
        throw new QltMeaningError(
          'QLT_VERSION_CONFLICT',
          'The record changed since it was read (optimistic version check).',
          { currentVersion: num(row, 'version') },
        );
      }
      // The content-free tombstone: null EXACTLY the frozen per-family
      // column set, write the removal bookkeeping, keep every identity,
      // status, version, timestamp, and provenance column. The amended
      // storage CHECKs independently refuse any non-content-free shape.
      const nullSet = TOMBSTONE_NULL_SETS[family].map((column) => `${column} = NULL`).join(', ');
      db.prepare(
        `UPDATE ${table}
         SET retention_state = 'user-removed', ${nullSet}, removed_at_ms = ?, removed_by = ?,
             version = version + 1, updated_at_ms = ?
         WHERE id = ?;`,
      ).run(now, actor, now, recordId);
      if (key !== undefined) {
        recordKey('qlt.retention::remove', key, recordId, JSON.stringify(payload));
      }
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
    return rowToView(family, getViewRow(family, recordId)!);
  }

  async function runRetentionPass(input: {
    readonly ranBy: string;
    readonly key?: string;
    readonly now?: number;
  }): Promise<QltRetentionPassReport> {
    const actor = assertUserActor(input.ranBy, 'pass runner');
    const key = input.key === undefined ? undefined : assertId(input.key, 'idempotency key');
    const payload = { verb: 'retention.pass', actor };
    const replayReport = (passRowIdentity: string): QltRetentionPassReport => {
      const row = db
        .prepare('SELECT * FROM qlt_retention_pass WHERE id = ?;')
        .get(passRowIdentity) as RawRow | undefined;
      if (row === undefined) {
        throw new QltMeaningError(
          'QLT_STORE_ERROR',
          'The idempotent record could not be resolved.',
        );
      }
      return {
        passId: str(row, 'id'),
        ranBy: str(row, 'ran_by'),
        ranAtMs: num(row, 'created_at_ms'),
        examined: num(row, 'examined'),
        expiredCount: num(row, 'expired_count'),
        expiredIds: JSON.parse(str(row, 'expired_ids')) as string[],
      };
    };
    const { prior } = resolveKeyed(QLT_D1_RETENTION_PASS_SCOPE, key, payload, replayReport);
    if (prior !== undefined) {
      return prior;
    }
    const now = input.now ?? clock();
    db.exec('BEGIN IMMEDIATE;');
    try {
      // The frozen DUE predicate: deterministic, bounded per pass.
      const due = db
        .prepare(
          `SELECT id FROM qlt_claim
           WHERE status = 'active' AND retention_state = 'currently-relevant'
             AND expires_at_ms IS NOT NULL AND expires_at_ms <= ?
           ORDER BY expires_at_ms ASC, id ASC LIMIT ?;`,
        )
        .all(now, PASS_BATCH_LIMIT) as Array<{ id: string }>;
      for (const claim of due) {
        db.prepare(
          `UPDATE qlt_claim SET retention_state = 'expired', version = version + 1, updated_at_ms = ?
           WHERE id = ? AND status = 'active' AND retention_state = 'currently-relevant';`,
        ).run(now, claim.id);
      }
      const passId = passIdFactory();
      const expiredIds = due.map((claim) => claim.id);
      db.prepare(
        `INSERT INTO qlt_retention_pass (id, ran_by, examined, expired_count, expired_ids, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?);`,
      ).run(passId, actor, due.length, expiredIds.length, JSON.stringify(expiredIds), now);
      if (key !== undefined) {
        recordKey(QLT_D1_RETENTION_PASS_SCOPE, key, passId, JSON.stringify(payload));
      }
      db.exec('COMMIT;');
      return {
        passId,
        ranBy: actor,
        ranAtMs: now,
        examined: due.length,
        expiredCount: expiredIds.length,
        expiredIds,
      };
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
  }

  // ---- reads (never write) --------------------------------------------------

  async function listRetentionPasses(input: {
    readonly limit?: number;
  }): Promise<readonly QltRetentionPassReport[]> {
    const limit =
      input.limit === undefined
        ? VIEW_DEFAULT_LIMIT
        : Math.min(Math.max(1, input.limit), VIEW_MAX_LIMIT);
    const rows = db
      .prepare('SELECT * FROM qlt_retention_pass ORDER BY created_at_ms DESC, id ASC LIMIT ?;')
      .all(limit) as unknown as RawRow[];
    return rows.map((row) => ({
      passId: str(row, 'id'),
      ranBy: str(row, 'ran_by'),
      ranAtMs: num(row, 'created_at_ms'),
      examined: num(row, 'examined'),
      expiredCount: num(row, 'expired_count'),
      expiredIds: JSON.parse(str(row, 'expired_ids')) as string[],
    }));
  }

  async function getRecordView(input: {
    readonly recordId: string;
    readonly family: QltSubjectFamily;
  }): Promise<QltRetentionRecordView | undefined> {
    const family = assertFamily(input.family);
    const row = getViewRow(family, assertId(input.recordId, 'record id'));
    return row === undefined ? undefined : rowToView(family, row);
  }

  async function listRecordViews(
    query: QltRetentionViewQuery | undefined,
  ): Promise<{ readonly rows: readonly QltRetentionRecordView[]; readonly total: number }> {
    const limit = Math.min(Math.max(1, query?.limit ?? VIEW_DEFAULT_LIMIT), VIEW_MAX_LIMIT);
    const offset = Math.max(0, query?.offset ?? 0);
    const families =
      query?.family === undefined
        ? (QLT_SUBJECT_FAMILIES as readonly QltSubjectFamily[])
        : [assertFamily(query.family)];
    if (query?.retentionState !== undefined) {
      const state = query.retentionState;
      if (!(Object.keys(QLT_D1_RETENTION_TRANSITIONS) as string[]).includes(state)) {
        throw new QltMeaningError('QLT_INPUT_INVALID_ENUM', 'Unknown retention state filter.');
      }
    }
    const threadId =
      query?.threadId === undefined ? undefined : assertId(query.threadId, 'thread id');
    const rows: QltRetentionRecordView[] = [];
    let total = 0;
    const window = offset + limit;
    for (const family of families) {
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (query?.retentionState !== undefined) {
        clauses.push('retention_state = ?');
        params.push(query.retentionState);
      }
      if (threadId !== undefined) {
        clauses.push('source_thread_id = ?');
        params.push(threadId);
      }
      const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const countRow = db
        .prepare(`SELECT COUNT(*) AS total FROM ${FAMILY_TABLE[family]}${where};`)
        .get(...params) as { total: number };
      total += countRow.total;
      const raw = db
        .prepare(
          `SELECT * FROM ${FAMILY_TABLE[family]}${where}
           ORDER BY updated_at_ms DESC, id ASC LIMIT ?;`,
        )
        .all(...params, window) as unknown as RawRow[];
      for (const row of raw) {
        rows.push(rowToView(family, row));
      }
    }
    rows.sort((left, right) =>
      left.updatedAtMs === right.updatedAtMs
        ? left.recordId < right.recordId
          ? -1
          : 1
        : right.updatedAtMs - left.updatedAtMs,
    );
    return { rows: rows.slice(offset, offset + limit), total };
  }

  return {
    setClaimExpiry,
    removeRecord,
    runRetentionPass,
    listRetentionPasses,
    getRecordView,
    listRecordViews,
  };
}
