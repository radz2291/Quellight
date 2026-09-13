/**
 * The Quellight Shared World MEANING repository (Stage 07C Phase Q2).
 *
 * Implements the frozen `SharedWorldMeaningStore` port from
 * `meaning-contract.ts` over the shared `shared-world.db` connection
 * (same file, same connection, same migration path — the later ceremony
 * needs ONE transaction across proposal + records + links).
 *
 * Q2 BOUNDARY: this repository is exercised DIRECTLY BY TESTS ONLY. No
 * production user or agent path reaches it; Q3 wires it behind the
 * governed VICT 0.2.0 boundary. Schema existence, row persistence, or a
 * lifecycle label alone never makes material canonical, model-visible, or
 * user-confirmed.
 *
 * Enforcement layers (frozen contract §10):
 * - SQLite CHECK constraints, UNIQUE indexes, and foreign keys (the
 *   connection runs with `PRAGMA foreign_keys = ON`) protect the store
 *   even against this repository;
 * - this repository is the LAST storage fence: ids/identities/enums/
 *   content serializability and byte bounds are re-checked here with
 *   stable, non-echoing `QltMeaningError` codes before any statement runs;
 * - every effectful verb is one `BEGIN IMMEDIATE` transaction; keyed
 *   idempotency rows are recorded in the SAME transaction (a failed
 *   transaction never consumes a key), reusing `qlt_adapter_idempotency`.
 *
 * Content of existing rows is NEVER mutated in place; rows are NEVER
 * deleted; there is NO retention mutation verb (Stage 07D scope).
 */

import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  QLT_AGENT_IDENTITY_PATTERN,
  QLT_CANONICAL_ELIGIBLE_STATUSES,
  QLT_CLAIM_TRANSITIONS,
  QLT_COMMITMENT_TRANSITIONS,
  QLT_CONTENT_MAX_BYTES,
  QLT_EPISTEMIC_TYPES,
  QLT_HONESTY_STATES,
  QLT_CONFIDENCE_LEVELS,
  QLT_LOOP_KINDS,
  QLT_OPEN_LOOP_TRANSITIONS,
  QLT_PROPOSAL_TRANSITIONS,
  QLT_RETENTION_STATES,
  QLT_SAFE_ID_PATTERN,
  QLT_USER_ACTOR_PATTERN,
  QltMeaningError,
  canonicalJson,
  contentFingerprint,
  type QltApplyCorrectionInput,
  type QltClaim,
  type QltClaimContent,
  type QltClaimStatus,
  type QltCommitment,
  type QltCommitmentContent,
  type QltCommitmentQuery,
  type QltCommitmentStatus,
  type QltConfirmationOutcome,
  type QltCorrection,
  type QltCorrectionOutcome,
  type QltCreateClaimInput,
  type QltCreateCommitmentInput,
  type QltCreateOpenLoopInput,
  type QltCreateProposalInput,
  type QltOpenLoop,
  type QltOpenLoopContent,
  type QltOpenLoopStatus,
  type QltProposal,
  type QltProposalContent,
  type QltProposalQuery,
  type QltProposalStatus,
  type QltRecordPage,
  type QltSourceLink,
  type QltSubjectContent,
  type QltSubjectFamily,
  type QltSubjectQuery,
  type QltSubjectRecord,
  type SharedWorldMeaningStore,
} from './meaning-contract.js';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Idempotency scopes (recorded in the shared keyed-idempotency table). */
const SCOPE = {
  proposalCreate: 'qlt.proposal::create',
  proposalAwaiting: 'qlt.proposal::awaiting',
  proposalConfirm: 'qlt.proposal::confirm',
  proposalReject: 'qlt.proposal::reject',
  proposalWithdraw: 'qlt.proposal::withdraw',
  proposalAmend: 'qlt.proposal::amend',
  claimCreate: 'qlt.claim::create',
  commitmentCreate: 'qlt.commitment::create',
  loopCreate: 'qlt.open_loop::create',
  claimRetire: 'qlt.claim::retire',
  commitmentRelease: 'qlt.commitment::release',
  loopResolve: 'qlt.open_loop::resolve',
  loopAbandon: 'qlt.open_loop::abandon',
  loopTransform: 'qlt.open_loop::transform',
  correctionApply: 'qlt.correction::apply',
} as const;

export interface SharedWorldMeaningStoreOptions {
  /** Deterministic clock (epoch ms). */
  readonly clock?: () => number;
  /** Deterministic id factories (tests). */
  readonly ids?: {
    readonly proposalId?: () => string;
    readonly recordId?: () => string;
    readonly correctionId?: () => string;
    readonly linkId?: () => string;
  };
}

const defaultId = (): string => `qlt-${randomBytes(8).toString('hex')}`;

interface RawRow {
  readonly [column: string]: unknown;
}

function str(row: RawRow, column: string): string {
  return row[column] as string;
}
function num(row: RawRow, column: string): number {
  return row[column] as number;
}
function optStr(row: RawRow, column: string): string | undefined {
  const value = row[column];
  return value === null || value === undefined ? undefined : (value as string);
}
function optNum(row: RawRow, column: string): number | undefined {
  const value = row[column];
  return value === null || value === undefined ? undefined : (value as number);
}

/** Re-check an sqlite error message for the structured failure classes. */
function mapSqliteError(cause: unknown, fallback: () => never): never {
  const message = String((cause as { message?: string }).message ?? '');
  if (message.includes('UNIQUE constraint failed')) {
    throw new QltMeaningError(
      'QLT_RECORD_EXISTS',
      'A record with this identity or open-ceremony key already exists.',
    );
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    throw new QltMeaningError(
      'QLT_THREAD_MISSING',
      'The referenced Shared World thread does not exist.',
    );
  }
  return fallback();
}

/**
 * The Q2 meaning repository. All writes are `BEGIN IMMEDIATE`-atomic;
 * every keyed verb converges (same key + same canonical fingerprint → the
 * SAME durable outcome; different fingerprint → QLT_IDEMPOTENCY_CONFLICT).
 */
export function createSharedWorldMeaningStore(
  db: DatabaseSync,
  options: SharedWorldMeaningStoreOptions = {},
): SharedWorldMeaningStore {
  const clock = options.clock ?? (() => Date.now());
  const nextProposalId = options.ids?.proposalId ?? defaultId;
  const nextRecordId = options.ids?.recordId ?? defaultId;
  const nextCorrectionId = options.ids?.correctionId ?? defaultId;
  const nextLinkId = options.ids?.linkId ?? defaultId;

  // ---- storage guards (the last fence before SQLite) -----------------------

  function assertId(value: string, label: string): string {
    if (typeof value !== 'string' || !QLT_SAFE_ID_PATTERN.test(value)) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_ID',
        `A ${label} must be a bounded safe identifier.`,
      );
    }
    return value;
  }

  /**
   * Commitment / correction keys use the bounded safe-key rule (≤ 200
   * chars) matching the frozen columns and validator bounds.
   */
  function assertSubjectKey(value: string, label: string): string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > 200 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    ) {
      throw new QltMeaningError('QLT_INPUT_INVALID_ID', `A ${label} must be a bounded safe key.`);
    }
    return value;
  }

  function assertUserActor(value: string, role: string): string {
    if (typeof value !== 'string' || !QLT_USER_ACTOR_PATTERN.test(value)) {
      throw new QltMeaningError(
        'QLT_CONFIRMER_INVALID',
        `Only a user-actor identity may act as ${role}.`,
      );
    }
    return value;
  }

  function assertAgentOrUser(value: string, role: string): string {
    if (
      typeof value !== 'string' ||
      (!QLT_USER_ACTOR_PATTERN.test(value) && !QLT_AGENT_IDENTITY_PATTERN.test(value))
    ) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_IDENTITY',
        `A ${role} identity must be a bounded agent or user-actor identity.`,
      );
    }
    return value;
  }

  function assertEnum<T extends string>(value: T, allowed: readonly T[], field: string): T {
    if (!allowed.includes(value)) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_ENUM',
        `The field '${field}' carries a value outside the closed vocabulary.`,
      );
    }
    return value;
  }

  /** Serialize + bound content; returns the canonical text and fingerprint. */
  function canonicalContent(content: unknown): {
    readonly text: string;
    readonly fingerprint: string;
  } {
    let text: string;
    try {
      text = canonicalJson(content);
    } catch {
      throw new QltMeaningError(
        'QLT_INPUT_NOT_SERIALIZABLE',
        'The content is not canonically serializable.',
      );
    }
    if (Buffer.byteLength(text, 'utf8') > QLT_CONTENT_MAX_BYTES) {
      throw new QltMeaningError(
        'QLT_INPUT_OVERSIZE',
        `The canonical content exceeds the ${QLT_CONTENT_MAX_BYTES}-byte bound.`,
      );
    }
    return { text, fingerprint: contentFingerprint(content) };
  }

  function parseStoredContent<T>(text: string, id: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new QltMeaningError(
        'QLT_STORE_ERROR',
        `Stored content of record '${id}' is unreadable.`,
      );
    }
  }

  function assertOptionalKey(key: string | undefined): string | undefined {
    if (key === undefined) {
      return undefined;
    }
    return assertId(key, 'idempotency key');
  }

  function assertOptionalText(
    value: string | undefined,
    max: number,
    field: string,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || value.length > max) {
      throw new QltMeaningError('QLT_INPUT_OVERSIZE', `The field '${field}' exceeds its bound.`);
    }
    return value;
  }

  // ---- idempotency machinery (shared keyed table, same-transaction) -------

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
   * Shallow removal of undefined-valued optional fields from INTERNAL
   * fingerprint sources (canonical JSON correctly refuses undefined
   * values; optional input fields are absent, not null, in the digest).
   */
  function compact(source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  /** Resolve a prior keyed effect or fail on a conflicting fingerprint. */
  function resolveKeyed<T>(
    scope: string,
    key: string | undefined,
    fingerprintSource: unknown,
    replay: (rowIdentity: string) => T,
  ): { readonly prior: T | undefined; readonly fingerprint: string } {
    const fingerprint = contentFingerprint(compact(fingerprintSource as Record<string, unknown>));
    if (key === undefined) {
      return { prior: undefined, fingerprint };
    }
    const existing = lookupKey(scope, key);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new QltMeaningError(
          'QLT_IDEMPOTENCY_CONFLICT',
          'The idempotency key was already used with a different request.',
        );
      }
      return { prior: replay(existing.rowIdentity), fingerprint };
    }
    return { prior: undefined, fingerprint };
  }

  // ---- row mapping ----------------------------------------------------------

  function rowToProposal(row: RawRow): QltProposal {
    const id = str(row, 'id');
    const content = parseStoredContent<QltProposalContent>(str(row, 'content'), id);
    return {
      id,
      version: num(row, 'version'),
      status: str(row, 'status') as QltProposalStatus,
      proposalKind: str(row, 'proposal_kind') as QltProposal['proposalKind'],
      content,
      contentFingerprint: str(row, 'content_fingerprint'),
      proposedBy: str(row, 'proposed_by'),
      decisionBy: optStr(row, 'decision_by'),
      decidedAtMs: optNum(row, 'decided_at_ms'),
      decisionReason: optStr(row, 'decision_reason'),
      targetRecordId: optStr(row, 'target_record_id'),
      targetRecordFamily: optStr(row, 'target_record_family') as QltProposal['targetRecordFamily'],
      targetRecordVersion: optNum(row, 'target_record_version'),
      sourceThreadId: str(row, 'source_thread_id'),
      sourceTurnRef: optStr(row, 'source_turn_ref'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      retentionState: str(row, 'retention_state') as QltProposal['retentionState'],
    };
  }

  function rowToClaim(row: RawRow): QltClaim {
    const id = str(row, 'id');
    const content = parseStoredContent<QltClaimContent>(str(row, 'content'), id);
    return {
      id,
      version: num(row, 'version'),
      status: str(row, 'status') as QltClaimStatus,
      epistemicType: str(row, 'epistemic_type') as QltClaim['epistemicType'],
      honestyState: str(row, 'honesty_state') as QltClaim['honestyState'],
      confidence: str(row, 'confidence') as QltClaim['confidence'],
      subject: str(row, 'subject'),
      content,
      contentFingerprint: str(row, 'content_fingerprint'),
      proposalId: optStr(row, 'proposal_id'),
      createdBy: str(row, 'created_by'),
      supersedesId: optStr(row, 'supersedes_id'),
      sourceThreadId: optStr(row, 'source_thread_id'),
      sourceTurnRef: optStr(row, 'source_turn_ref'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      retentionState: str(row, 'retention_state') as QltClaim['retentionState'],
    };
  }

  function rowToCommitment(row: RawRow): QltCommitment {
    const id = str(row, 'id');
    const content = parseStoredContent<QltCommitmentContent>(str(row, 'content'), id);
    return {
      id,
      version: num(row, 'version'),
      status: str(row, 'status') as QltCommitmentStatus,
      commitmentKey: str(row, 'commitment_key'),
      content,
      contentFingerprint: str(row, 'content_fingerprint'),
      normativeBasisProposalId: optStr(row, 'normative_basis_proposal_id'),
      proposalId: optStr(row, 'proposal_id'),
      createdBy: str(row, 'created_by'),
      supersedesId: optStr(row, 'supersedes_id'),
      sourceThreadId: optStr(row, 'source_thread_id'),
      sourceTurnRef: optStr(row, 'source_turn_ref'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      retentionState: str(row, 'retention_state') as QltCommitment['retentionState'],
    };
  }

  function rowToOpenLoop(row: RawRow): QltOpenLoop {
    const id = str(row, 'id');
    const content = parseStoredContent<QltOpenLoopContent>(str(row, 'content'), id);
    return {
      id,
      version: num(row, 'version'),
      status: str(row, 'status') as QltOpenLoopStatus,
      loopKind: str(row, 'loop_kind') as QltOpenLoop['loopKind'],
      subject: str(row, 'subject'),
      exitReason: optStr(row, 'exit_reason'),
      exitBy: optStr(row, 'exit_by'),
      exitedAtMs: optNum(row, 'exited_at_ms'),
      content,
      contentFingerprint: str(row, 'content_fingerprint'),
      proposalId: optStr(row, 'proposal_id'),
      createdBy: str(row, 'created_by'),
      supersedesId: optStr(row, 'supersedes_id'),
      sourceThreadId: optStr(row, 'source_thread_id'),
      sourceTurnRef: optStr(row, 'source_turn_ref'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      retentionState: str(row, 'retention_state') as QltOpenLoop['retentionState'],
    };
  }

  function rowToCorrection(row: RawRow): QltCorrection {
    const id = str(row, 'id');
    const content = parseStoredContent<QltSubjectContent>(str(row, 'content'), id);
    return {
      id,
      status: str(row, 'status') as QltCorrection['status'],
      subjectRecordId: str(row, 'subject_record_id'),
      subjectRecordFamily: str(
        row,
        'subject_record_family',
      ) as QltCorrection['subjectRecordFamily'],
      correctionKey: str(row, 'correction_key'),
      priorContentFingerprint: str(row, 'prior_content_fingerprint'),
      reason: optStr(row, 'reason'),
      content,
      contentFingerprint: str(row, 'content_fingerprint'),
      correctedBy: str(row, 'corrected_by'),
      sourceThreadId: optStr(row, 'source_thread_id'),
      sourceTurnRef: optStr(row, 'source_turn_ref'),
      createdAtMs: num(row, 'created_at_ms'),
      updatedAtMs: num(row, 'updated_at_ms'),
      effectiveAtMs: num(row, 'effective_at_ms'),
      retentionState: str(row, 'retention_state') as QltCorrection['retentionState'],
    };
  }

  function rowToSourceLink(row: RawRow): QltSourceLink {
    return {
      id: str(row, 'id'),
      fromRecordId: str(row, 'from_record_id'),
      fromRecordFamily: str(row, 'from_record_family') as QltSourceLink['fromRecordFamily'],
      toKind: str(row, 'to_kind') as QltSourceLink['toKind'],
      toRef: str(row, 'to_ref'),
      relation: str(row, 'relation') as QltSourceLink['relation'],
      createdAtMs: num(row, 'created_at_ms'),
      retentionState: str(row, 'retention_state') as QltSourceLink['retentionState'],
    };
  }

  // ---- raw row accessors ----------------------------------------------------

  function getProposalRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_proposal WHERE id = ?;').get(id) as RawRow | undefined;
  }
  function getClaimRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_claim WHERE id = ?;').get(id) as RawRow | undefined;
  }
  function getCommitmentRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_commitment WHERE id = ?;').get(id) as RawRow | undefined;
  }
  function getOpenLoopRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_open_loop WHERE id = ?;').get(id) as RawRow | undefined;
  }
  function getCorrectionRow(id: string): RawRow | undefined {
    return db.prepare('SELECT * FROM qlt_correction WHERE id = ?;').get(id) as RawRow | undefined;
  }

  /** Load a substantive record row by family (polymorphic subject access). */
  function getSubjectRow(family: QltSubjectFamily, id: string): RawRow | undefined {
    if (family === 'claim') {
      return getClaimRow(id);
    }
    if (family === 'commitment') {
      return getCommitmentRow(id);
    }
    return getOpenLoopRow(id);
  }

  function subjectRowToRecord(family: QltSubjectFamily, row: RawRow): QltSubjectRecord {
    if (family === 'claim') {
      return rowToClaim(row);
    }
    if (family === 'commitment') {
      return rowToCommitment(row);
    }
    return rowToOpenLoop(row);
  }

  function requireSubjectRecord(family: QltSubjectFamily, id: string): QltSubjectRecord {
    const row = getSubjectRow(family, id);
    if (row === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The referenced record does not exist.');
    }
    return subjectRowToRecord(family, row);
  }

  function insertSourceLink(params: {
    fromRecordId: string;
    fromRecordFamily: QltSourceLink['fromRecordFamily'];
    toKind: QltSourceLink['toKind'];
    toRef: string;
    relation: QltSourceLink['relation'];
    now: number;
  }): void {
    db.prepare(
      `INSERT INTO qlt_source_link (id, from_record_id, from_record_family, to_kind, to_ref, relation, created_at_ms, retention_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      nextLinkId(),
      params.fromRecordId,
      params.fromRecordFamily,
      params.toKind,
      params.toRef,
      params.relation,
      params.now,
    );
  }

  function writeThreadTurnLinks(params: {
    recordId: string;
    family: QltSourceLink['fromRecordFamily'];
    sourceThreadId?: string;
    sourceTurnRef?: string;
    now: number;
  }): void {
    if (params.sourceThreadId !== undefined) {
      insertSourceLink({
        fromRecordId: params.recordId,
        fromRecordFamily: params.family,
        toKind: 'thread',
        toRef: params.sourceThreadId,
        relation: 'source-thread',
        now: params.now,
      });
    }
    if (params.sourceTurnRef !== undefined) {
      insertSourceLink({
        fromRecordId: params.recordId,
        fromRecordFamily: params.family,
        toKind: 'turn',
        toRef: params.sourceTurnRef,
        relation: 'source-turn',
        now: params.now,
      });
    }
  }

  // ---- proposal state transitions --------------------------------------------

  function transitionProposal(
    proposal: QltProposal,
    to: QltProposalStatus,
    fields: {
      readonly decisionBy?: string;
      readonly decidedAt?: number;
      readonly decisionReason?: string;
    },
    now: number,
    expectedVersion?: number,
  ): void {
    const allowed = QLT_PROPOSAL_TRANSITIONS[proposal.status];
    if (!allowed.includes(to)) {
      if (
        proposal.status === 'confirmed' ||
        proposal.status === 'rejected' ||
        proposal.status === 'amended' ||
        proposal.status === 'withdrawn'
      ) {
        throw new QltMeaningError(
          'QLT_PROPOSAL_ALREADY_DECIDED',
          'The proposal has already been decided; its truthful current state stands.',
          { currentStatus: proposal.status },
        );
      }
      throw new QltMeaningError(
        'QLT_PROPOSAL_INVALID_TRANSITION',
        'The proposal lifecycle does not allow this transition.',
        { currentStatus: proposal.status },
      );
    }
    if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
      throw new QltMeaningError(
        'QLT_VERSION_CONFLICT',
        'The record changed since it was read (optimistic version check).',
        { currentVersion: proposal.version },
      );
    }
    db.prepare(
      `UPDATE qlt_proposal
       SET status = ?, version = version + 1, updated_at_ms = ?, decision_by = ?, decided_at_ms = ?, decision_reason = ?
       WHERE id = ?;`,
    ).run(
      to,
      now,
      fields.decisionBy ?? null,
      fields.decidedAt ?? null,
      fields.decisionReason ?? null,
      proposal.id,
    );
  }

  // ---- source-thread staleness inputs ---------------------------------------

  function sourceThreadState(threadId: string): { readonly retentionState: string } | undefined {
    const row = db.prepare('SELECT retention_state FROM qlt_thread WHERE id = ?;').get(threadId) as
      { retention_state: string } | undefined;
    return row === undefined ? undefined : { retentionState: row.retention_state };
  }

  /** The CURRENT target-record state (staleness re-check at confirm time). */
  function targetRecordState(
    family: QltSubjectFamily,
    recordId: string,
  ):
    | { readonly version: number; readonly status: string; readonly retentionState: string }
    | undefined {
    const row = getSubjectRow(family, recordId);
    if (row === undefined) {
      return undefined;
    }
    return {
      version: num(row, 'version'),
      status: str(row, 'status'),
      retentionState: str(row, 'retention_state'),
    };
  }

  function assertProposalNotStale(proposal: QltProposal): void {
    const source = sourceThreadState(proposal.sourceThreadId);
    if (source === undefined) {
      throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
        reason: 'source-missing',
      });
    }
    if (source.retentionState === 'user-removed') {
      throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
        reason: 'source-removed',
      });
    }
    if (proposal.proposalKind === 'correction') {
      const family = proposal.targetRecordFamily;
      const targetId = proposal.targetRecordId;
      if (family === undefined || targetId === undefined) {
        throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
          reason: 'target-ineligible',
        });
      }
      const target = targetRecordState(family, targetId);
      if (target === undefined || target.retentionState === 'user-removed') {
        throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
          reason: 'target-ineligible',
        });
      }
      const eligibleStatuses = QLT_CANONICAL_ELIGIBLE_STATUSES[family];
      if (!eligibleStatuses.includes(target.status as never)) {
        throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
          reason: 'target-superseded',
        });
      }
      if (target.version !== proposal.targetRecordVersion) {
        throw new QltMeaningError('QLT_PROPOSAL_STALE', 'The proposal is stale.', {
          reason: 'target-version-changed',
        });
      }
    }
  }

  // ---- confirm-time record creation ------------------------------------------

  function claimContentFrom(proposal: QltProposal): QltClaimContent {
    const content = proposal.content as Partial<QltClaimContent> & { statement?: unknown };
    if (typeof content.statement !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        "The field 'statement' must be a string.",
      );
    }
    return { statement: content.statement };
  }

  function insertClaimFromProposal(
    proposal: QltProposal,
    confirmedBy: string,
    id: string,
    now: number,
  ): QltClaim {
    const content = proposal.content as Partial<QltClaim>;
    const subject = content.subject;
    const epistemicType = content.epistemicType;
    const honestyState = content.honestyState;
    const confidence = content.confidence;
    if (
      typeof subject !== 'string' ||
      typeof epistemicType !== 'string' ||
      typeof honestyState !== 'string' ||
      typeof confidence !== 'string'
    ) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The claim proposal content is missing required typed fields.',
      );
    }
    assertEnum(epistemicType as QltClaim['epistemicType'], QLT_EPISTEMIC_TYPES, 'epistemicType');
    assertEnum(honestyState as QltClaim['honestyState'], QLT_HONESTY_STATES, 'honestyState');
    assertEnum(confidence as QltClaim['confidence'], QLT_CONFIDENCE_LEVELS, 'confidence');
    const claimContent = claimContentFrom(proposal);
    const canonical = canonicalContent(claimContent);
    db.prepare(
      `INSERT INTO qlt_claim
        (id, version, status, epistemic_type, honesty_state, confidence, subject, content, content_fingerprint,
         proposal_id, created_by, source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      id,
      epistemicType,
      honestyState,
      confidence,
      subject,
      canonical.text,
      canonical.fingerprint,
      proposal.id,
      confirmedBy,
      proposal.sourceThreadId,
      proposal.sourceTurnRef ?? null,
      now,
      now,
      now,
    );
    return rowToClaim(getClaimRow(id)!);
  }

  function insertCommitmentFromProposal(
    proposal: QltProposal,
    confirmedBy: string,
    id: string,
    now: number,
  ): QltCommitment {
    const content = proposal.content as Partial<QltCommitment>;
    const commitmentKey = content.commitmentKey;
    if (typeof commitmentKey !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        "The field 'commitmentKey' must be a string.",
      );
    }
    assertId(commitmentKey, 'commitment key');
    const statement = (proposal.content as { statement?: unknown }).statement;
    if (typeof statement !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        "The field 'statement' must be a string.",
      );
    }
    const commitmentContent: QltCommitmentContent = { statement };
    const canonical = canonicalContent(commitmentContent);
    db.prepare(
      `INSERT INTO qlt_commitment
        (id, version, status, commitment_key, content, content_fingerprint,
         normative_basis_proposal_id, proposal_id, created_by, source_thread_id, source_turn_ref,
         created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      id,
      commitmentKey,
      canonical.text,
      canonical.fingerprint,
      proposal.id,
      proposal.id,
      confirmedBy,
      proposal.sourceThreadId,
      proposal.sourceTurnRef ?? null,
      now,
      now,
      now,
    );
    return rowToCommitment(getCommitmentRow(id)!);
  }

  function insertOpenLoopFromProposal(
    proposal: QltProposal,
    confirmedBy: string,
    id: string,
    now: number,
  ): QltOpenLoop {
    const content = proposal.content as {
      subject?: unknown;
      loopKind?: unknown;
      detail?: unknown;
    };
    const subject = content.subject;
    const loopKind = content.loopKind;
    const detail = content.detail;
    if (typeof subject !== 'string' || typeof loopKind !== 'string' || typeof detail !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The open-loop proposal content is missing required typed fields.',
      );
    }
    assertEnum(loopKind as QltOpenLoop['loopKind'], QLT_LOOP_KINDS, 'loopKind');
    const loopContent: QltOpenLoopContent = { detail };
    const canonical = canonicalContent(loopContent);
    db.prepare(
      `INSERT INTO qlt_open_loop
        (id, version, status, loop_kind, subject, content, content_fingerprint,
         proposal_id, created_by, source_thread_id, source_turn_ref,
         created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      id,
      loopKind,
      subject,
      canonical.text,
      canonical.fingerprint,
      proposal.id,
      confirmedBy,
      proposal.sourceThreadId,
      proposal.sourceTurnRef ?? null,
      now,
      now,
      now,
    );
    return rowToOpenLoop(getOpenLoopRow(id)!);
  }

  interface AppliedCorrection {
    readonly correction: QltCorrection;
    readonly successor: QltSubjectRecord;
  }

  /** The correction mechanics, usable inside a surrounding transaction. */
  function applyCorrectionInTransaction(
    input: QltApplyCorrectionInput,
    now: number,
  ): AppliedCorrection {
    assertId(input.subjectRecordId, 'subject record id');
    assertUserActor(input.correctedBy, 'corrector');
    assertSubjectKey(input.correctionKey, 'correction key');
    const reason = assertOptionalText(input.reason, 500, 'reason');
    const family = input.subjectFamily;
    assertEnum(family, ['claim', 'commitment', 'open_loop'] as const, 'subjectFamily');
    const sourceThreadId =
      input.sourceThreadId === undefined ? undefined : assertId(input.sourceThreadId, 'thread id');
    const sourceTurnRef =
      input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref');

    const subjectRow = getSubjectRow(family, input.subjectRecordId);
    if (subjectRow === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The correction target does not exist.');
    }
    const subjectStatus = str(subjectRow, 'status');
    if (!QLT_CANONICAL_ELIGIBLE_STATUSES[family].includes(subjectStatus as never)) {
      throw new QltMeaningError(
        'QLT_RECORD_NOT_CURRENT',
        'The correction target is no longer current-effective; duplicate successors fail closed.',
        { currentStatus: subjectStatus },
      );
    }
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== num(subjectRow, 'version')
    ) {
      throw new QltMeaningError(
        'QLT_VERSION_CONFLICT',
        'The record changed since it was read (optimistic version check).',
        { currentVersion: num(subjectRow, 'version') },
      );
    }
    // The successor content must match the subject family shape.
    if (family === 'open_loop') {
      if (typeof (input.content as { detail?: unknown }).detail !== 'string') {
        throw new QltMeaningError(
          'QLT_INPUT_INVALID_TYPE',
          "A corrected open loop requires the field 'detail'.",
        );
      }
    } else if (typeof (input.content as { statement?: unknown }).statement !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        "A corrected claim or commitment requires the field 'statement'.",
      );
    }
    const canonical = canonicalContent(input.content);
    const successorId = input.id === undefined ? nextRecordId() : assertId(input.id, 'record id');
    // The correction row always carries its own fresh identity.
    const correctionId = nextCorrectionId();

    const eligibleStatus = QLT_CANONICAL_ELIGIBLE_STATUSES[family][0];
    if (family === 'claim') {
      const subject = rowToClaim(subjectRow);
      db.prepare(
        `INSERT INTO qlt_claim
          (id, version, status, epistemic_type, honesty_state, confidence, subject, content, content_fingerprint,
           proposal_id, created_by, supersedes_id, source_thread_id, source_turn_ref,
           created_at_ms, updated_at_ms, effective_at_ms, retention_state)
         VALUES (?, 1, 'active', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ).run(
        successorId,
        subject.epistemicType,
        subject.honestyState,
        subject.confidence,
        subject.subject,
        canonical.text,
        canonical.fingerprint,
        input.correctedBy,
        input.subjectRecordId,
        sourceThreadId ?? subject.sourceThreadId ?? null,
        sourceTurnRef ?? subject.sourceTurnRef ?? null,
        now,
        now,
        now,
        // The successor INHERITS the subject's retention state: a corrected
        // record never resurrects user-removed material as fresh and
        // currently-relevant (retention-ready metadata discipline).
        subject.retentionState,
      );
    } else if (family === 'commitment') {
      const subject = rowToCommitment(subjectRow);
      db.prepare(
        `INSERT INTO qlt_commitment
          (id, version, status, commitment_key, content, content_fingerprint,
           normative_basis_proposal_id, proposal_id, created_by, supersedes_id,
           source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
         VALUES (?, 1, 'active', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ).run(
        successorId,
        subject.commitmentKey,
        canonical.text,
        canonical.fingerprint,
        subject.normativeBasisProposalId ?? null,
        input.correctedBy,
        input.subjectRecordId,
        sourceThreadId ?? subject.sourceThreadId ?? null,
        sourceTurnRef ?? subject.sourceTurnRef ?? null,
        now,
        now,
        now,
        subject.retentionState,
      );
    } else {
      const subject = rowToOpenLoop(subjectRow);
      db.prepare(
        `INSERT INTO qlt_open_loop
          (id, version, status, loop_kind, subject, content, content_fingerprint,
           proposal_id, created_by, supersedes_id, source_thread_id, source_turn_ref,
           created_at_ms, updated_at_ms, effective_at_ms, retention_state)
         VALUES (?, 1, 'open', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ).run(
        successorId,
        subject.loopKind,
        subject.subject,
        canonical.text,
        canonical.fingerprint,
        input.correctedBy,
        input.subjectRecordId,
        sourceThreadId ?? subject.sourceThreadId ?? null,
        sourceTurnRef ?? subject.sourceTurnRef ?? null,
        now,
        now,
        now,
        subject.retentionState,
      );
    }
    // The predecessor keeps its content bytes; only its lifecycle moves.
    db.prepare(
      `UPDATE ${family === 'claim' ? 'qlt_claim' : family === 'commitment' ? 'qlt_commitment' : 'qlt_open_loop'}
       SET status = 'superseded', version = version + 1, updated_at_ms = ? WHERE id = ?;`,
    ).run(now, input.subjectRecordId);
    db.prepare(
      `INSERT INTO qlt_correction
        (id, version, status, subject_record_id, subject_record_family, correction_key,
         prior_content_fingerprint, reason, content, content_fingerprint, corrected_by,
         source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
       VALUES (?, 1, 'recorded', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
    ).run(
      correctionId,
      input.subjectRecordId,
      family,
      input.correctionKey,
      str(subjectRow, 'content_fingerprint'),
      reason ?? null,
      canonical.text,
      canonical.fingerprint,
      input.correctedBy,
      sourceThreadId ?? null,
      sourceTurnRef ?? null,
      now,
      now,
      now,
    );
    insertSourceLink({
      fromRecordId: successorId,
      fromRecordFamily: family,
      toKind: 'record',
      toRef: input.subjectRecordId,
      relation: 'supersedes',
      now,
    });
    insertSourceLink({
      fromRecordId: correctionId,
      fromRecordFamily: 'correction',
      toKind: 'record',
      toRef: input.subjectRecordId,
      relation: 'corrects',
      now,
    });
    writeThreadTurnLinks({
      recordId: successorId,
      family,
      sourceThreadId,
      sourceTurnRef,
      now,
    });
    return {
      correction: rowToCorrection(getCorrectionRow(correctionId)!),
      successor: requireSubjectRecord(family, successorId),
    };
  }

  /** Reconstruct a keyed replay outcome for confirm (from stored links). */
  function reconstructConfirmation(proposalId: string): QltConfirmationOutcome {
    const proposalRow = getProposalRow(proposalId);
    if (proposalRow === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
    }
    const proposal = rowToProposal(proposalRow);
    const linkRows = db
      .prepare(
        `SELECT * FROM qlt_source_link WHERE to_kind = 'proposal' AND to_ref = ? AND relation = 'proposed-from';`,
      )
      .all(proposalId) as unknown as RawRow[];
    const createdRecords = linkRows.map((row) =>
      requireSubjectRecord(
        str(row, 'from_record_family') as QltSubjectFamily,
        str(row, 'from_record_id'),
      ),
    );
    if (proposal.proposalKind === 'correction') {
      const targetId = proposal.targetRecordId;
      if (targetId === undefined) {
        throw new QltMeaningError(
          'QLT_STORE_ERROR',
          'The confirmed correction has no recorded target.',
        );
      }
      const correctionRows = db
        .prepare(
          'SELECT * FROM qlt_correction WHERE subject_record_id = ? ORDER BY created_at_ms DESC, id ASC;',
        )
        .all(targetId) as unknown as RawRow[];
      const correction = correctionRows
        .map(rowToCorrection)
        .find((entry) => entry.correctionKey === `confirm-${proposalId}`);
      return { proposal, createdRecords, correction };
    }
    return { proposal, createdRecords, correction: undefined };
  }

  // ---- the port ---------------------------------------------------------------

  const store: SharedWorldMeaningStore = {
    async createProposal(input: QltCreateProposalInput): Promise<QltProposal> {
      assertEnum(
        input.proposalKind,
        ['claim', 'commitment', 'open_loop', 'correction'] as const,
        'proposalKind',
      );
      const proposedBy = assertAgentOrUser(input.proposedBy, 'proposer');
      const sourceThreadId = assertId(input.sourceThreadId, 'thread id');
      const sourceTurnRef =
        input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref');
      const id = input.id === undefined ? nextProposalId() : assertId(input.id, 'proposal id');
      const key = assertOptionalKey(input.key);
      const canonical = canonicalContent(input.content);
      const targetRecord =
        input.proposalKind === 'correction'
          ? input.targetRecord === undefined
            ? (() => {
                throw new QltMeaningError(
                  'QLT_CORRECTION_TARGET_REQUIRED',
                  'A correction-kind proposal requires a target record.',
                );
              })()
            : {
                recordId: assertId(input.targetRecord.recordId, 'target record id'),
                family: assertEnum(
                  input.targetRecord.family,
                  ['claim', 'commitment', 'open_loop'] as const,
                  'target family',
                ),
                version: input.targetRecord.version,
              }
          : input.targetRecord === undefined
            ? undefined
            : (() => {
                throw new QltMeaningError(
                  'QLT_INPUT_INVALID_TYPE',
                  'Only a correction-kind proposal may carry a target record.',
                );
              })();

      const { prior, fingerprint } = resolveKeyed(
        SCOPE.proposalCreate,
        key,
        {
          verb: 'proposal.create',
          proposalKind: input.proposalKind,
          content: input.content,
          proposedBy,
          sourceThreadId,
          sourceTurnRef,
          targetRecord,
        },
        (rowIdentity) => {
          const row = getProposalRow(rowIdentity);
          if (row === undefined) {
            throw new QltMeaningError(
              'QLT_STORE_ERROR',
              'The idempotent record could not be resolved.',
            );
          }
          return rowToProposal(row);
        },
      );
      if (prior !== undefined) {
        return prior;
      }

      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO qlt_proposal
            (id, version, status, proposal_kind, content, content_fingerprint, proposed_by,
             source_thread_id, source_turn_ref, target_record_id, target_record_family, target_record_version,
             created_at_ms, updated_at_ms, effective_at_ms, retention_state)
           VALUES (?, 1, 'proposed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
        ).run(
          id,
          input.proposalKind,
          canonical.text,
          canonical.fingerprint,
          proposedBy,
          sourceThreadId,
          sourceTurnRef ?? null,
          targetRecord?.recordId ?? null,
          targetRecord?.family ?? null,
          targetRecord?.version ?? null,
          now,
          now,
          now,
        );
        if (key !== undefined) {
          recordKey(SCOPE.proposalCreate, key, id, fingerprint);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        if (cause instanceof QltMeaningError) {
          throw cause;
        }
        return mapSqliteError(cause, () => {
          throw cause;
        });
      }
      return rowToProposal(getProposalRow(id)!);
    },

    async getProposal(id): Promise<QltProposal | undefined> {
      const row = getProposalRow(assertId(id, 'proposal id'));
      return row === undefined ? undefined : rowToProposal(row);
    },

    async listProposals(query?: QltProposalQuery): Promise<QltRecordPage<QltProposal>> {
      const limit = query?.limit ?? DEFAULT_LIST_LIMIT;
      const offset = query?.offset ?? 0;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
        throw new QltMeaningError(
          'QLT_INPUT_INVALID_TYPE',
          'The limit must be a bounded positive integer.',
        );
      }
      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new QltMeaningError(
          'QLT_INPUT_INVALID_TYPE',
          'The offset must be a non-negative integer.',
        );
      }
      const conditions: string[] = [];
      const params: string[] = [];
      if (query?.status !== undefined) {
        conditions.push('status = ?');
        params.push(query.status);
      }
      if (query?.proposalKind !== undefined) {
        conditions.push('proposal_kind = ?');
        params.push(query.proposalKind);
      }
      if (query?.sourceThreadId !== undefined) {
        conditions.push('source_thread_id = ?');
        params.push(query.sourceThreadId);
      }
      const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
      const totalRow = db
        .prepare(`SELECT COUNT(*) AS total FROM qlt_proposal ${where};`)
        .get(...params) as { total: number };
      const rows = db
        .prepare(
          `SELECT * FROM qlt_proposal ${where} ORDER BY created_at_ms DESC, id ASC LIMIT ? OFFSET ?;`,
        )
        .all(...params, limit, offset) as unknown as RawRow[];
      return { rows: rows.map(rowToProposal), total: totalRow.total };
    },

    async markProposalAwaitingDecision(proposalId, transitionOptions): Promise<QltProposal> {
      assertId(proposalId, 'proposal id');
      const key = assertOptionalKey(transitionOptions?.key);
      const { prior } = resolveKeyed(
        SCOPE.proposalAwaiting,
        key,
        { verb: 'proposal.awaiting', proposalId },
        (rowIdentity) => rowToProposal(getProposalRow(rowIdentity)!),
      );
      if (prior !== undefined) {
        return prior;
      }
      const row = getProposalRow(proposalId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
      }
      const now = transitionOptions?.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        transitionProposal(
          rowToProposal(row),
          'awaiting_decision',
          {},
          now,
          transitionOptions?.expectedVersion,
        );
        if (key !== undefined) {
          recordKey(
            SCOPE.proposalAwaiting,
            key,
            proposalId,
            contentFingerprint({ verb: 'proposal.awaiting', proposalId }),
          );
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToProposal(getProposalRow(proposalId)!);
    },

    async confirmProposal(input): Promise<QltConfirmationOutcome> {
      assertId(input.proposalId, 'proposal id');
      const confirmedBy = assertUserActor(input.confirmedBy, 'confirmer');
      const key = assertOptionalKey(input.key);
      const { prior } = resolveKeyed(
        SCOPE.proposalConfirm,
        key,
        { verb: 'proposal.confirm', proposalId: input.proposalId, confirmedBy },
        reconstructConfirmation,
      );
      if (prior !== undefined) {
        return prior;
      }
      const row = getProposalRow(input.proposalId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
      }
      const proposal = rowToProposal(row);
      if (proposal.status !== 'awaiting_decision') {
        if (
          proposal.status === 'confirmed' ||
          proposal.status === 'rejected' ||
          proposal.status === 'amended' ||
          proposal.status === 'withdrawn'
        ) {
          throw new QltMeaningError(
            'QLT_PROPOSAL_ALREADY_DECIDED',
            'The proposal has already been decided; its truthful current state stands.',
            { currentStatus: proposal.status },
          );
        }
        throw new QltMeaningError(
          'QLT_PROPOSAL_INVALID_TRANSITION',
          'Only an awaiting_decision proposal may be confirmed.',
          { currentStatus: proposal.status },
        );
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        // The staleness re-check reads CURRENT storage state inside the
        // transaction (version-eligibility, never elapsed time).
        assertProposalNotStale(proposal);
        const createdRecords: QltSubjectRecord[] = [];
        let correction: QltCorrection | undefined;
        if (proposal.proposalKind === 'correction') {
          const applied = applyCorrectionInTransaction(
            {
              subjectRecordId: proposal.targetRecordId!,
              subjectFamily: proposal.targetRecordFamily!,
              correctionKey: `confirm-${proposal.id}`,
              content: proposal.content as {
                statement?: string;
                detail?: string;
              } as QltSubjectContent,
              correctedBy: confirmedBy,
              reason:
                proposal.content &&
                typeof (proposal.content as { reason?: string }).reason === 'string'
                  ? (proposal.content as { reason: string }).reason
                  : undefined,
              sourceThreadId: proposal.sourceThreadId,
              sourceTurnRef: proposal.sourceTurnRef,
            },
            now,
          );
          correction = applied.correction;
          createdRecords.push(applied.successor);
        } else if (proposal.proposalKind === 'claim') {
          createdRecords.push(insertClaimFromProposal(proposal, confirmedBy, nextRecordId(), now));
        } else if (proposal.proposalKind === 'commitment') {
          createdRecords.push(
            insertCommitmentFromProposal(proposal, confirmedBy, nextRecordId(), now),
          );
        } else {
          createdRecords.push(
            insertOpenLoopFromProposal(proposal, confirmedBy, nextRecordId(), now),
          );
        }
        for (const record of createdRecords) {
          const family =
            'commitmentKey' in record ? 'commitment' : 'loopKind' in record ? 'open_loop' : 'claim';
          writeThreadTurnLinks({
            recordId: record.id,
            family,
            sourceThreadId: record.sourceThreadId,
            sourceTurnRef: record.sourceTurnRef,
            now,
          });
          insertSourceLink({
            fromRecordId: record.id,
            fromRecordFamily: family,
            toKind: 'proposal',
            toRef: proposal.id,
            relation: 'proposed-from',
            now,
          });
        }
        transitionProposal(
          proposal,
          'confirmed',
          { decisionBy: confirmedBy, decidedAt: now },
          now,
          input.expectedVersion,
        );
        if (key !== undefined) {
          recordKey(
            SCOPE.proposalConfirm,
            key,
            proposal.id,
            contentFingerprint({ verb: 'proposal.confirm', proposalId: proposal.id, confirmedBy }),
          );
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        if (cause instanceof QltMeaningError) {
          throw cause;
        }
        return mapSqliteError(cause, () => {
          throw cause;
        });
      }
      return reconstructConfirmation(proposal.id);
    },

    async rejectProposal(input): Promise<QltProposal> {
      assertId(input.proposalId, 'proposal id');
      const decidedBy = assertUserActor(input.decidedBy, 'decider');
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const key = assertOptionalKey(input.key);
      const { prior } = resolveKeyed(
        SCOPE.proposalReject,
        key,
        { verb: 'proposal.reject', proposalId: input.proposalId, decidedBy, reason },
        (rowIdentity) => rowToProposal(getProposalRow(rowIdentity)!),
      );
      if (prior !== undefined) {
        return prior;
      }
      const row = getProposalRow(input.proposalId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        transitionProposal(
          rowToProposal(row),
          'rejected',
          { decisionBy: decidedBy, decidedAt: now, decisionReason: reason },
          now,
          input.expectedVersion,
        );
        if (key !== undefined) {
          recordKey(
            SCOPE.proposalReject,
            key,
            input.proposalId,
            contentFingerprint({
              verb: 'proposal.reject',
              proposalId: input.proposalId,
              decidedBy,
              reason,
            }),
          );
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToProposal(getProposalRow(input.proposalId)!);
    },

    async withdrawProposal(input): Promise<QltProposal> {
      assertId(input.proposalId, 'proposal id');
      // Storage coupling: the frozen CHECK requires every decided status
      // (including 'withdrawn') to carry a decision_by matching the
      // actor-* pattern, so a withdrawal is persistable only under a
      // user-actor identity (Q3 routes agent withdrawal through the
      // governed user-identity envelope).
      const withdrawnBy = assertUserActor(input.withdrawnBy, 'withdrawer');
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const key = assertOptionalKey(input.key);
      const { prior } = resolveKeyed(
        SCOPE.proposalWithdraw,
        key,
        { verb: 'proposal.withdraw', proposalId: input.proposalId, withdrawnBy, reason },
        (rowIdentity) => rowToProposal(getProposalRow(rowIdentity)!),
      );
      if (prior !== undefined) {
        return prior;
      }
      const row = getProposalRow(input.proposalId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        transitionProposal(
          rowToProposal(row),
          'withdrawn',
          { decisionBy: withdrawnBy, decidedAt: now, decisionReason: reason },
          now,
          input.expectedVersion,
        );
        if (key !== undefined) {
          recordKey(
            SCOPE.proposalWithdraw,
            key,
            input.proposalId,
            contentFingerprint({
              verb: 'proposal.withdraw',
              proposalId: input.proposalId,
              withdrawnBy,
              reason,
            }),
          );
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return rowToProposal(getProposalRow(input.proposalId)!);
    },

    async amendProposal(
      input,
    ): Promise<{ readonly original: QltProposal; readonly amendment: QltProposal }> {
      assertId(input.proposalId, 'proposal id');
      const amendedBy = assertUserActor(input.amendedBy, 'amender');
      const reason = assertOptionalText(input.reason, 500, 'reason');
      const key = assertOptionalKey(input.key);
      const canonical = canonicalContent(input.content);
      const { prior, fingerprint } = resolveKeyed(
        SCOPE.proposalAmend,
        key,
        {
          verb: 'proposal.amend',
          proposalId: input.proposalId,
          amendedBy,
          content: input.content,
          reason,
        },
        (rowIdentity) => {
          const amendmentRow = getProposalRow(rowIdentity);
          if (amendmentRow === undefined) {
            throw new QltMeaningError(
              'QLT_STORE_ERROR',
              'The amended proposal could not be resolved.',
            );
          }
          const amendment = rowToProposal(amendmentRow);
          const original = db
            .prepare(
              `SELECT from_record_id FROM qlt_source_link WHERE from_record_id = ? AND relation = 'amends';`,
            )
            .get(amendment.id) as { from_record_id: string } | undefined;
          return {
            original: rowToProposal(getProposalRow(original!.from_record_id)!),
            amendment,
          };
        },
      );
      if (prior !== undefined) {
        return prior;
      }
      const row = getProposalRow(input.proposalId);
      if (row === undefined) {
        throw new QltMeaningError('QLT_RECORD_MISSING', 'The proposal does not exist.');
      }
      const original = rowToProposal(row);
      const now = input.now ?? clock();
      const amendmentId = nextProposalId();
      db.exec('BEGIN IMMEDIATE;');
      try {
        transitionProposal(
          original,
          'amended',
          { decisionBy: amendedBy, decidedAt: now, decisionReason: reason },
          now,
          input.expectedVersion,
        );
        db.prepare(
          `INSERT INTO qlt_proposal
            (id, version, status, proposal_kind, content, content_fingerprint, proposed_by,
             source_thread_id, source_turn_ref, target_record_id, target_record_family, target_record_version,
             created_at_ms, updated_at_ms, effective_at_ms, retention_state)
           VALUES (?, 1, 'proposed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
        ).run(
          amendmentId,
          original.proposalKind,
          canonical.text,
          canonical.fingerprint,
          original.proposedBy,
          original.sourceThreadId,
          original.sourceTurnRef ?? null,
          original.targetRecordId ?? null,
          original.targetRecordFamily ?? null,
          original.targetRecordVersion ?? null,
          now,
          now,
          now,
        );
        insertSourceLink({
          fromRecordId: amendmentId,
          fromRecordFamily: 'proposal',
          toKind: 'proposal',
          toRef: original.id,
          relation: 'amends',
          now,
        });
        if (key !== undefined) {
          recordKey(SCOPE.proposalAmend, key, amendmentId, fingerprint);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
      return {
        original: rowToProposal(getProposalRow(original.id)!),
        amendment: rowToProposal(getProposalRow(amendmentId)!),
      };
    },

    async createClaim(input: QltCreateClaimInput): Promise<QltClaim> {
      assertEnum(input.epistemicType, QLT_EPISTEMIC_TYPES, 'epistemicType');
      assertEnum(input.honestyState, QLT_HONESTY_STATES, 'honestyState');
      assertEnum(input.confidence, QLT_CONFIDENCE_LEVELS, 'confidence');
      if (
        typeof input.subject !== 'string' ||
        input.subject.length === 0 ||
        input.subject.length > 200
      ) {
        throw new QltMeaningError('QLT_INPUT_OVERSIZE', "The field 'subject' must be bounded.");
      }
      const createdBy = assertUserActor(input.createdBy, 'creator');
      const sourceThreadId =
        input.sourceThreadId === undefined
          ? undefined
          : assertId(input.sourceThreadId, 'thread id');
      const sourceTurnRef =
        input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref');
      const id = input.id === undefined ? nextRecordId() : assertId(input.id, 'claim id');
      const key = assertOptionalKey(input.key);
      const claimContent: QltClaimContent = { statement: input.statement };
      const canonical = canonicalContent(claimContent);
      const { prior, fingerprint } = resolveKeyed(
        SCOPE.claimCreate,
        key,
        {
          verb: 'claim.create',
          subject: input.subject,
          epistemicType: input.epistemicType,
          honestyState: input.honestyState,
          confidence: input.confidence,
          statement: input.statement,
          createdBy,
          sourceThreadId,
          sourceTurnRef,
        },
        (rowIdentity) => {
          const row = getClaimRow(rowIdentity);
          if (row === undefined) {
            throw new QltMeaningError(
              'QLT_STORE_ERROR',
              'The idempotent record could not be resolved.',
            );
          }
          return rowToClaim(row);
        },
      );
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO qlt_claim
            (id, version, status, epistemic_type, honesty_state, confidence, subject, content, content_fingerprint,
             proposal_id, created_by, source_thread_id, source_turn_ref, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
           VALUES (?, 1, 'active', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
        ).run(
          id,
          input.epistemicType,
          input.honestyState,
          input.confidence,
          input.subject,
          canonical.text,
          canonical.fingerprint,
          createdBy,
          sourceThreadId ?? null,
          sourceTurnRef ?? null,
          now,
          now,
          now,
        );
        writeThreadTurnLinks({ recordId: id, family: 'claim', sourceThreadId, sourceTurnRef, now });
        if (key !== undefined) {
          recordKey(SCOPE.claimCreate, key, id, fingerprint);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        if (cause instanceof QltMeaningError) {
          throw cause;
        }
        return mapSqliteError(cause, () => {
          throw cause;
        });
      }
      return rowToClaim(getClaimRow(id)!);
    },

    async createCommitment(input: QltCreateCommitmentInput): Promise<QltCommitment> {
      const commitmentKey = assertSubjectKey(input.commitmentKey, 'commitment key');
      const createdBy = assertUserActor(input.createdBy, 'creator');
      const normativeBasisProposalId =
        input.normativeBasisProposalId === undefined
          ? undefined
          : assertId(input.normativeBasisProposalId, 'proposal id');
      const sourceThreadId =
        input.sourceThreadId === undefined
          ? undefined
          : assertId(input.sourceThreadId, 'thread id');
      const sourceTurnRef =
        input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref');
      const id = input.id === undefined ? nextRecordId() : assertId(input.id, 'commitment id');
      const key = assertOptionalKey(input.key);
      const commitmentContent: QltCommitmentContent = { statement: input.statement };
      const canonical = canonicalContent(commitmentContent);
      const { prior, fingerprint } = resolveKeyed(
        SCOPE.commitmentCreate,
        key,
        {
          verb: 'commitment.create',
          commitmentKey,
          statement: input.statement,
          createdBy,
          normativeBasisProposalId,
          sourceThreadId,
          sourceTurnRef,
        },
        (rowIdentity) => {
          const row = getCommitmentRow(rowIdentity);
          if (row === undefined) {
            throw new QltMeaningError(
              'QLT_STORE_ERROR',
              'The idempotent record could not be resolved.',
            );
          }
          return rowToCommitment(row);
        },
      );
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO qlt_commitment
            (id, version, status, commitment_key, content, content_fingerprint,
             normative_basis_proposal_id, proposal_id, created_by, source_thread_id, source_turn_ref,
             created_at_ms, updated_at_ms, effective_at_ms, retention_state)
           VALUES (?, 1, 'active', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
        ).run(
          id,
          commitmentKey,
          canonical.text,
          canonical.fingerprint,
          normativeBasisProposalId ?? null,
          createdBy,
          sourceThreadId ?? null,
          sourceTurnRef ?? null,
          now,
          now,
          now,
        );
        writeThreadTurnLinks({
          recordId: id,
          family: 'commitment',
          sourceThreadId,
          sourceTurnRef,
          now,
        });
        if (key !== undefined) {
          recordKey(SCOPE.commitmentCreate, key, id, fingerprint);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        if (cause instanceof QltMeaningError) {
          throw cause;
        }
        return mapSqliteError(cause, () => {
          throw cause;
        });
      }
      return rowToCommitment(getCommitmentRow(id)!);
    },

    async createOpenLoop(input: QltCreateOpenLoopInput): Promise<QltOpenLoop> {
      assertEnum(input.loopKind, QLT_LOOP_KINDS, 'loopKind');
      if (
        typeof input.subject !== 'string' ||
        input.subject.length === 0 ||
        input.subject.length > 200
      ) {
        throw new QltMeaningError('QLT_INPUT_OVERSIZE', "The field 'subject' must be bounded.");
      }
      const createdBy = assertUserActor(input.createdBy, 'creator');
      const sourceThreadId =
        input.sourceThreadId === undefined
          ? undefined
          : assertId(input.sourceThreadId, 'thread id');
      const sourceTurnRef =
        input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref');
      const id = input.id === undefined ? nextRecordId() : assertId(input.id, 'loop id');
      const key = assertOptionalKey(input.key);
      const loopContent: QltOpenLoopContent = { detail: input.detail };
      const canonical = canonicalContent(loopContent);
      const { prior, fingerprint } = resolveKeyed(
        SCOPE.loopCreate,
        key,
        {
          verb: 'loop.create',
          subject: input.subject,
          loopKind: input.loopKind,
          detail: input.detail,
          createdBy,
          sourceThreadId,
          sourceTurnRef,
        },
        (rowIdentity) => {
          const row = getOpenLoopRow(rowIdentity);
          if (row === undefined) {
            throw new QltMeaningError(
              'QLT_STORE_ERROR',
              'The idempotent record could not be resolved.',
            );
          }
          return rowToOpenLoop(row);
        },
      );
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(
          `INSERT INTO qlt_open_loop
            (id, version, status, loop_kind, subject, content, content_fingerprint,
             proposal_id, created_by, source_thread_id, source_turn_ref,
             created_at_ms, updated_at_ms, effective_at_ms, retention_state)
           VALUES (?, 1, 'open', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'currently-relevant');`,
        ).run(
          id,
          input.loopKind,
          input.subject,
          canonical.text,
          canonical.fingerprint,
          createdBy,
          sourceThreadId ?? null,
          sourceTurnRef ?? null,
          now,
          now,
          now,
        );
        writeThreadTurnLinks({
          recordId: id,
          family: 'open_loop',
          sourceThreadId,
          sourceTurnRef,
          now,
        });
        if (key !== undefined) {
          recordKey(SCOPE.loopCreate, key, id, fingerprint);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        if (cause instanceof QltMeaningError) {
          throw cause;
        }
        return mapSqliteError(cause, () => {
          throw cause;
        });
      }
      return rowToOpenLoop(getOpenLoopRow(id)!);
    },

    async getClaim(id): Promise<QltClaim | undefined> {
      const row = getClaimRow(assertId(id, 'claim id'));
      return row === undefined ? undefined : rowToClaim(row);
    },

    async getCommitment(id): Promise<QltCommitment | undefined> {
      const row = getCommitmentRow(assertId(id, 'commitment id'));
      return row === undefined ? undefined : rowToCommitment(row);
    },

    async getOpenLoop(id): Promise<QltOpenLoop | undefined> {
      const row = getOpenLoopRow(assertId(id, 'open loop id'));
      return row === undefined ? undefined : rowToOpenLoop(row);
    },

    async listClaims(query?: QltSubjectQuery): Promise<QltRecordPage<QltClaim>> {
      return listSubjectRows('qlt_claim', query, rowToClaim);
    },

    async listCommitments(query): Promise<QltRecordPage<QltCommitment>> {
      return listCommitmentRows(query);
    },

    async listOpenLoops(query?: QltSubjectQuery): Promise<QltRecordPage<QltOpenLoop>> {
      return listSubjectRows('qlt_open_loop', query, rowToOpenLoop);
    },

    async retireClaim(input): Promise<QltClaim> {
      const updated = await subjectExit(input, 'claim', 'retired');
      return updated as QltClaim;
    },

    async releaseCommitment(input): Promise<QltCommitment> {
      const updated = await subjectExit(input, 'commitment', 'released');
      return updated as QltCommitment;
    },

    async resolveLoop(input): Promise<QltOpenLoop> {
      const updated = await loopExit(input, 'resolved');
      return updated;
    },

    async abandonLoop(input): Promise<QltOpenLoop> {
      const updated = await loopExit(input, 'abandoned', true);
      return updated;
    },

    async transformLoop(input): Promise<QltOpenLoop> {
      const updated = await loopExit(input, 'transformed', true);
      return updated;
    },

    async applyCorrection(input: QltApplyCorrectionInput): Promise<QltCorrectionOutcome> {
      const key = assertOptionalKey(input.key);
      const normalized: QltApplyCorrectionInput = {
        ...input,
        sourceThreadId:
          input.sourceThreadId === undefined
            ? undefined
            : assertId(input.sourceThreadId, 'thread id'),
        sourceTurnRef:
          input.sourceTurnRef === undefined ? undefined : assertId(input.sourceTurnRef, 'turn ref'),
      };
      const { prior, fingerprint } = resolveKeyed(
        SCOPE.correctionApply,
        key,
        {
          verb: 'correction.apply',
          subjectRecordId: normalized.subjectRecordId,
          subjectFamily: normalized.subjectFamily,
          correctionKey: normalized.correctionKey,
          content: normalized.content,
          reason: normalized.reason,
          correctedBy: normalized.correctedBy,
          sourceThreadId: normalized.sourceThreadId,
          sourceTurnRef: normalized.sourceTurnRef,
        },
        (rowIdentity) => reconstructCorrectionOutcome(rowIdentity),
      );
      if (prior !== undefined) {
        return prior;
      }
      const now = input.now ?? clock();
      db.exec('BEGIN IMMEDIATE;');
      try {
        const applied = applyCorrectionInTransaction(normalized, now);
        if (key !== undefined) {
          recordKey(SCOPE.correctionApply, key, applied.correction.id, fingerprint);
        }
        db.exec('COMMIT;');
        const predecessor = requireSubjectRecord(
          normalized.subjectFamily,
          normalized.subjectRecordId,
        );
        return { correction: applied.correction, predecessor, successor: applied.successor };
      } catch (cause) {
        db.exec('ROLLBACK;');
        throw cause;
      }
    },

    async getCorrection(id): Promise<QltCorrection | undefined> {
      const row = getCorrectionRow(assertId(id, 'correction id'));
      return row === undefined ? undefined : rowToCorrection(row);
    },

    async listCorrections(input: {
      readonly subjectRecordId: string;
    }): Promise<readonly QltCorrection[]> {
      const rows = db
        .prepare(
          'SELECT * FROM qlt_correction WHERE subject_record_id = ? ORDER BY created_at_ms DESC, id ASC;',
        )
        .all(assertId(input.subjectRecordId, 'subject record id')) as unknown as RawRow[];
      return rows.map(rowToCorrection);
    },

    async listSourceLinks(input: {
      readonly fromRecordId: string;
    }): Promise<readonly QltSourceLink[]> {
      const rows = db
        .prepare(
          'SELECT * FROM qlt_source_link WHERE from_record_id = ? ORDER BY created_at_ms DESC, id ASC;',
        )
        .all(assertId(input.fromRecordId, 'record id')) as unknown as RawRow[];
      return rows.map(rowToSourceLink);
    },

    async resolveCurrentEffectiveClaim(subject): Promise<QltClaim | undefined> {
      const row = resolveCurrentEffectiveRow('qlt_claim', 'claim', subject);
      return row === undefined ? undefined : rowToClaim(row);
    },

    async resolveCurrentEffectiveCommitment(commitmentKey): Promise<QltCommitment | undefined> {
      if (typeof commitmentKey !== 'string' || commitmentKey.length === 0) {
        throw new QltMeaningError('QLT_INPUT_INVALID_ID', 'A commitment key must be bounded.');
      }
      const row = db
        .prepare(
          `SELECT * FROM qlt_commitment
           WHERE commitment_key = ? AND status = ? AND retention_state = 'currently-relevant'
           ORDER BY effective_at_ms DESC, created_at_ms DESC, id ASC LIMIT 1;`,
        )
        .get(commitmentKey, QLT_CANONICAL_ELIGIBLE_STATUSES.commitment[0]) as RawRow | undefined;
      return row === undefined ? undefined : rowToCommitment(row);
    },

    async resolveCurrentEffectiveOpenLoop(subject): Promise<QltOpenLoop | undefined> {
      const row = resolveCurrentEffectiveRow('qlt_open_loop', 'open_loop', subject);
      return row === undefined ? undefined : rowToOpenLoop(row);
    },

    close(): void {
      // The shared connection is owned and closed by the thread-family
      // store (`SharedWorldSqlite.close`); this repository holds no
      // separate handle.
    },
  };

  // ---- helpers that close over `db` -------------------------------------------

  function listSubjectRows<T>(
    table: 'qlt_claim' | 'qlt_open_loop',
    query: QltSubjectQuery | undefined,
    map: (row: RawRow) => T,
  ): QltRecordPage<T> {
    const limit = query?.limit ?? DEFAULT_LIST_LIMIT;
    const offset = query?.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The limit must be a bounded positive integer.',
      );
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The offset must be a non-negative integer.',
      );
    }
    const conditions: string[] = [];
    const params: string[] = [];
    if (query?.status !== undefined) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query?.subject !== undefined) {
      conditions.push('subject = ?');
      params.push(query.subject);
    }
    if (query?.retentionState !== undefined) {
      assertEnum(query.retentionState, QLT_RETENTION_STATES, 'retentionState');
      conditions.push('retention_state = ?');
      params.push(query.retentionState);
    }
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM ${table} ${where};`)
      .get(...params) as { total: number };
    const rows = db
      .prepare(
        `SELECT * FROM ${table} ${where} ORDER BY created_at_ms DESC, id ASC LIMIT ? OFFSET ?;`,
      )
      .all(...params, limit, offset) as unknown as RawRow[];
    return { rows: rows.map(map), total: totalRow.total };
  }

  function listCommitmentRows(query: QltCommitmentQuery | undefined): QltRecordPage<QltCommitment> {
    const limit = query?.limit ?? DEFAULT_LIST_LIMIT;
    const offset = query?.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The limit must be a bounded positive integer.',
      );
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new QltMeaningError(
        'QLT_INPUT_INVALID_TYPE',
        'The offset must be a non-negative integer.',
      );
    }
    const conditions: string[] = [];
    const params: string[] = [];
    if (query?.status !== undefined) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query?.commitmentKey !== undefined) {
      conditions.push('commitment_key = ?');
      params.push(query.commitmentKey);
    }
    if (query?.retentionState !== undefined) {
      assertEnum(query.retentionState, QLT_RETENTION_STATES, 'retentionState');
      conditions.push('retention_state = ?');
      params.push(query.retentionState);
    }
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM qlt_commitment ${where};`)
      .get(...params) as { total: number };
    const rows = db
      .prepare(
        `SELECT * FROM qlt_commitment ${where} ORDER BY created_at_ms DESC, id ASC LIMIT ? OFFSET ?;`,
      )
      .all(...params, limit, offset) as unknown as RawRow[];
    return { rows: rows.map(rowToCommitment), total: totalRow.total };
  }

  /** Shared substantive-record exit (claim retire / commitment release). */
  async function subjectExit(
    input: { readonly recordId: string; readonly exitedBy: string; readonly reason?: string } & {
      readonly expectedVersion?: number;
      readonly now?: number;
      readonly key?: string;
    },
    family: 'claim' | 'commitment',
    to: 'retired' | 'released',
  ): Promise<QltSubjectRecord> {
    assertId(input.recordId, 'record id');
    assertUserActor(input.exitedBy, family === 'claim' ? 'retirer' : 'releaser');
    const key = assertOptionalKey(input.key);
    const scope = family === 'claim' ? SCOPE.claimRetire : SCOPE.commitmentRelease;
    const verb = family === 'claim' ? 'claim.retire' : 'commitment.release';
    const { prior } = resolveKeyed(
      scope,
      key,
      { verb, recordId: input.recordId, exitedBy: input.exitedBy, reason: input.reason },
      (rowIdentity) => requireSubjectRecord(family, rowIdentity),
    );
    if (prior !== undefined) {
      return prior;
    }
    const row = getSubjectRow(family, input.recordId);
    if (row === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The record does not exist.');
    }
    const transitions = family === 'claim' ? QLT_CLAIM_TRANSITIONS : QLT_COMMITMENT_TRANSITIONS;
    const current = str(row, 'status') as keyof typeof transitions;
    const now = input.now ?? clock();
    db.exec('BEGIN IMMEDIATE;');
    try {
      if (!transitions[current].includes(to as never)) {
        throw new QltMeaningError(
          family === 'claim' ? 'QLT_CLAIM_INVALID_TRANSITION' : 'QLT_COMMITMENT_INVALID_TRANSITION',
          'The record lifecycle does not allow this transition.',
          { currentStatus: String(current) },
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
        `UPDATE ${family === 'claim' ? 'qlt_claim' : 'qlt_commitment'}
         SET status = ?, version = version + 1, updated_at_ms = ? WHERE id = ?;`,
      ).run(to, now, input.recordId);
      if (key !== undefined) {
        recordKey(
          scope,
          key,
          input.recordId,
          contentFingerprint({
            verb,
            recordId: input.recordId,
            exitedBy: input.exitedBy,
            reason: input.reason,
          }),
        );
      }
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
    return requireSubjectRecord(family, input.recordId);
  }

  /** Shared loop exit (resolve / abandon / transform). */
  async function loopExit(
    input: { readonly loopId: string; readonly exitedBy: string; readonly reason?: string } & {
      readonly expectedVersion?: number;
      readonly now?: number;
      readonly key?: string;
    },
    to: 'resolved' | 'abandoned' | 'transformed',
    reasonRequired = false,
  ): Promise<QltOpenLoop> {
    assertId(input.loopId, 'loop id');
    assertUserActor(input.exitedBy, 'exiting user');
    if (reasonRequired && typeof input.reason !== 'string') {
      throw new QltMeaningError(
        'QLT_INPUT_MISSING_FIELD',
        `The field 'reason' is required to ${to} an open loop.`,
      );
    }
    const reason = assertOptionalText(input.reason, 500, 'reason');
    const key = assertOptionalKey(input.key);
    const scope =
      to === 'resolved'
        ? SCOPE.loopResolve
        : to === 'abandoned'
          ? SCOPE.loopAbandon
          : SCOPE.loopTransform;
    const verb = `loop.${to}`;
    const { prior } = resolveKeyed(
      scope,
      key,
      { verb, loopId: input.loopId, exitedBy: input.exitedBy, reason },
      (rowIdentity) => {
        const row = getOpenLoopRow(rowIdentity);
        if (row === undefined) {
          throw new QltMeaningError(
            'QLT_STORE_ERROR',
            'The idempotent record could not be resolved.',
          );
        }
        return rowToOpenLoop(row);
      },
    );
    if (prior !== undefined) {
      return prior;
    }
    const row = getOpenLoopRow(input.loopId);
    if (row === undefined) {
      throw new QltMeaningError('QLT_RECORD_MISSING', 'The open loop does not exist.');
    }
    const now = input.now ?? clock();
    db.exec('BEGIN IMMEDIATE;');
    try {
      const current = str(row, 'status') as keyof typeof QLT_OPEN_LOOP_TRANSITIONS;
      if (!QLT_OPEN_LOOP_TRANSITIONS[current].includes(to)) {
        throw new QltMeaningError(
          'QLT_LOOP_INVALID_TRANSITION',
          'The open-loop lifecycle does not allow this transition.',
          { currentStatus: String(current) },
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
        `UPDATE qlt_open_loop
         SET status = ?, version = version + 1, updated_at_ms = ?, exit_by = ?, exited_at_ms = ?, exit_reason = ?
         WHERE id = ?;`,
      ).run(to, now, input.exitedBy, now, reason ?? null, input.loopId);
      if (key !== undefined) {
        recordKey(
          scope,
          key,
          input.loopId,
          contentFingerprint({ verb, loopId: input.loopId, exitedBy: input.exitedBy, reason }),
        );
      }
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
    return rowToOpenLoop(getOpenLoopRow(input.loopId)!);
  }

  function resolveCurrentEffectiveRow(
    table: 'qlt_claim' | 'qlt_open_loop',
    family: 'claim' | 'open_loop',
    subject: string,
  ): RawRow | undefined {
    if (typeof subject !== 'string' || subject.length === 0) {
      throw new QltMeaningError('QLT_INPUT_INVALID_ID', 'A subject must be a bounded label.');
    }
    const eligibleStatus = QLT_CANONICAL_ELIGIBLE_STATUSES[family][0];
    return db
      .prepare(
        `SELECT * FROM ${table}
         WHERE subject = ? AND status = ? AND retention_state = 'currently-relevant'
         ORDER BY effective_at_ms DESC, created_at_ms DESC, id ASC LIMIT 1;`,
      )
      .get(subject, eligibleStatus) as RawRow | undefined;
  }

  /** Reconstruct a keyed replay outcome for applyCorrection. */
  function reconstructCorrectionOutcome(rowIdentity: string): QltCorrectionOutcome {
    const correctionRow = getCorrectionRow(rowIdentity);
    if (correctionRow === undefined) {
      throw new QltMeaningError(
        'QLT_STORE_ERROR',
        'The idempotent correction could not be resolved.',
      );
    }
    const correction = rowToCorrection(correctionRow);
    const predecessor = requireSubjectRecord(
      correction.subjectRecordFamily,
      correction.subjectRecordId,
    );
    const successorRow = db
      .prepare(
        `SELECT id FROM ${
          correction.subjectRecordFamily === 'claim'
            ? 'qlt_claim'
            : correction.subjectRecordFamily === 'commitment'
              ? 'qlt_commitment'
              : 'qlt_open_loop'
        } WHERE supersedes_id = ? ORDER BY created_at_ms DESC, id ASC LIMIT 1;`,
      )
      .get(correction.subjectRecordId) as { id: string } | undefined;
    if (successorRow === undefined) {
      throw new QltMeaningError(
        'QLT_STORE_ERROR',
        'The correction successor could not be resolved.',
      );
    }
    return {
      correction,
      predecessor,
      successor: requireSubjectRecord(correction.subjectRecordFamily, successorRow.id),
    };
  }

  return store;
}
