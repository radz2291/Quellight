/**
 * QLTLIGHT STAGE 07C PHASE Q2 — DURABLE SHARED WORLD SCHEMA CONTRACT
 * (FROZEN in docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md).
 *
 * This module is the FROZEN, declarative Q2 contract shared by every Q2
 * lane. It contains contract DATA and TYPES only (plus the deterministic
 * canonical-serialization primitive), never product write policy:
 *
 * - closed vocabularies (lifecycle, retention, epistemic types, identity);
 * - the frozen SQLite schema inventory (mirror of migration 2);
 * - stable, non-echoing rejection codes and validation bounds;
 * - the lifecycle transition tables (closed, total functions as data);
 * - canonical-eligibility data (which family statuses may ever become
 *   context-eligible — eligibility alone never activates a write path);
 * - record/port TYPES for the Q2 meaning repository;
 * - the deterministic canonical JSON serializer + content fingerprint.
 *
 * Ownership: frozen by the Phase 0 contract-freeze commit; NO Q2 lane may
 * edit this file. Implementation lives in `meaning.ts` (domain validators,
 * lifecycle, authority/staleness/eligibility predicates) and
 * `meaning-store.ts` (SQLite repository) — both conform to THIS contract.
 *
 * Authority basis: Stage 07C handoff §7.1 (record families), §8 (ceremony
 * vocabulary), §10 (correction lineage), §19 owner addendum (OQ6 ratified:
 * the agent may never confirm; staleness is version-eligibility, never
 * elapsed time), GOV-007 (VICT semantic authority), D-10 (governed 0.2.0
 * boundary). Q2 implements STORAGE CONTRACTS ONLY: schema existence, row
 * persistence, or a lifecycle label alone never makes material canonical,
 * model-visible, or user-confirmed.
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

/** The proposal/ceremony lifecycle (handoff §8.1; closed). */
export const QLT_PROPOSAL_STATUSES = [
  'proposed',
  'awaiting_decision',
  'confirmed',
  'rejected',
  'amended',
  'withdrawn',
] as const;
export type QltProposalStatus = (typeof QLT_PROPOSAL_STATUSES)[number];

/** Epistemic claim lifecycle (handoff §7.1; closed; 07D adds expiry states). */
export const QLT_CLAIM_STATUSES = ['active', 'superseded', 'retired'] as const;
export type QltClaimStatus = (typeof QLT_CLAIM_STATUSES)[number];

/** Commitment lifecycle (handoff §7.1; closed; 07D adds retention exits). */
export const QLT_COMMITMENT_STATUSES = ['active', 'released', 'superseded', 'amended'] as const;
export type QltCommitmentStatus = (typeof QLT_COMMITMENT_STATUSES)[number];

/** Open-loop lifecycle — exactly the four canonical exits (INV-06; closed). */
export const QLT_OPEN_LOOP_STATUSES = [
  'open',
  'resolved',
  'superseded',
  'abandoned',
  'transformed',
] as const;
export type QltOpenLoopStatus = (typeof QLT_OPEN_LOOP_STATUSES)[number];

/** Correction lineage is append-only: a single immutable state. */
export const QLT_CORRECTION_STATUSES = ['recorded'] as const;
export type QltCorrectionStatus = (typeof QLT_CORRECTION_STATUSES)[number];

/** Proposal kinds (what a proposal drafts; closed). */
export const QLT_PROPOSAL_KINDS = ['claim', 'commitment', 'open_loop', 'correction'] as const;
export type QltProposalKind = (typeof QLT_PROPOSAL_KINDS)[number];

/** The substantive record families a proposal may create or correct. */
export const QLT_SUBJECT_FAMILIES = ['claim', 'commitment', 'open_loop'] as const;
export type QltSubjectFamily = (typeof QLT_SUBJECT_FAMILIES)[number];

/** Every family that carries durable rows with lineage (incl. proposals). */
export const QLT_RECORD_FAMILIES = [...QLT_SUBJECT_FAMILIES, 'proposal'] as const;
export type QltRecordFamily = (typeof QLT_RECORD_FAMILIES)[number];

/** Epistemic types E1–E7 (canonical §5.3; closed). */
export const QLT_EPISTEMIC_TYPES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'] as const;
export type QltEpistemicType = (typeof QLT_EPISTEMIC_TYPES)[number];

/** Honesty states (canonical §10.2; closed). */
export const QLT_HONESTY_STATES = ['known', 'likely', 'uncertain', 'stale', 'conflicted'] as const;
export type QltHonestyState = (typeof QLT_HONESTY_STATES)[number];

/** Bounded confidence vocabulary — never a bare unqualified "fact" field. */
export const QLT_CONFIDENCE_LEVELS = ['stated', 'qualified', 'uncertain'] as const;
export type QltConfidence = (typeof QLT_CONFIDENCE_LEVELS)[number];

/** Open-loop kinds (canonical §5.5; closed). */
export const QLT_LOOP_KINDS = ['pending_action', 'undecided_question', 'expected_event'] as const;
export type QltLoopKind = (typeof QLT_LOOP_KINDS)[number];

/** The closed 07B/07C retention vocabulary (07D adds tombstone semantics). */
export const QLT_RETENTION_STATES = ['currently-relevant', 'user-removed'] as const;
export type QltRetentionState = (typeof QLT_RETENTION_STATES)[number];

/** Source-link relation vocabulary (closed; append-only links). */
export const QLT_SOURCE_LINK_RELATIONS = [
  'source-thread',
  'source-turn',
  'proposed-from',
  'supersedes',
  'corrects',
  'amends',
] as const;
export type QltSourceLinkRelation = (typeof QLT_SOURCE_LINK_RELATIONS)[number];

/** Source-link target kinds (closed). */
export const QLT_SOURCE_LINK_TO_KINDS = [
  'thread',
  'turn',
  'message',
  'proposal',
  'record',
  'correction',
] as const;
export type QltSourceLinkToKind = (typeof QLT_SOURCE_LINK_TO_KINDS)[number];

/** Source-link origin families (closed). */
export const QLT_SOURCE_LINK_FROM_FAMILIES = [
  'proposal',
  'claim',
  'commitment',
  'open_loop',
  'correction',
] as const;
export type QltSourceLinkFromFamily = (typeof QLT_SOURCE_LINK_FROM_FAMILIES)[number];

// ---------------------------------------------------------------------------
// Identity discipline (OQ6 ratified launch position)
// ---------------------------------------------------------------------------

/**
 * User-actor identities (`actor-*`) are the ONLY identities that may
 * confirm, correct, or decide. Agent identities (`agent-*`) may propose
 * and withdraw; they may NEVER appear as a confirmer, decider, corrector,
 * or creator of a canonical record. Q2 has no production identity path —
 * these predicates are storage-contract enforcement for Q3+.
 */
export const QLT_USER_ACTOR_PATTERN = /^actor-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
export const QLT_AGENT_IDENTITY_PATTERN = /^agent-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
/** Bounded safe identifier pattern (existing Quellight convention). */
export const QLT_SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// ---------------------------------------------------------------------------
// Bounds (stable; every bound has a stable rejection code)
// ---------------------------------------------------------------------------

/** Hard canonical-content byte bound (handoff §7.1: ≤ 4 KiB). */
export const QLT_CONTENT_MAX_BYTES = 4096;
export const QLT_STATEMENT_MAX_CHARS = 2000;
export const QLT_DETAIL_MAX_CHARS = 2000;
export const QLT_SUBJECT_MAX_CHARS = 200;
export const QLT_KEY_MAX_CHARS = 200;
export const QLT_REASON_MAX_CHARS = 500;
export const QLT_ID_MAX_CHARS = 128;
export const QLT_SOURCE_REF_MAX_CHARS = 200;
/** JSON container bounds (defensive; content schemas are flat). */
export const QLT_JSON_MAX_DEPTH = 6;
export const QLT_JSON_MAX_KEYS_PER_OBJECT = 32;
export const QLT_JSON_MAX_ARRAY_ITEMS = 100;

// ---------------------------------------------------------------------------
// Stable, non-echoing rejection codes
// ---------------------------------------------------------------------------

export type QltInputErrorCode =
  | 'QLT_INPUT_NOT_OBJECT'
  | 'QLT_INPUT_INVALID_CONTAINER'
  | 'QLT_INPUT_UNKNOWN_FIELD'
  | 'QLT_INPUT_MISSING_FIELD'
  | 'QLT_INPUT_INVALID_TYPE'
  | 'QLT_INPUT_INVALID_ENUM'
  | 'QLT_INPUT_INVALID_ID'
  | 'QLT_INPUT_INVALID_IDENTITY'
  | 'QLT_INPUT_OVERSIZE'
  | 'QLT_INPUT_OVERDEPTH'
  | 'QLT_INPUT_KEY_LIMIT'
  | 'QLT_INPUT_ARRAY_LIMIT'
  | 'QLT_INPUT_PROTO_KEY'
  | 'QLT_INPUT_NOT_SERIALIZABLE';

export type QltStoreErrorCode =
  | 'QLT_RECORD_MISSING'
  | 'QLT_RECORD_EXISTS'
  | 'QLT_RECORD_NOT_CURRENT'
  | 'QLT_THREAD_MISSING'
  | 'QLT_PROPOSAL_INVALID_TRANSITION'
  | 'QLT_PROPOSAL_ALREADY_DECIDED'
  | 'QLT_PROPOSAL_STALE'
  | 'QLT_CORRECTION_TARGET_REQUIRED'
  | 'QLT_CLAIM_INVALID_TRANSITION'
  | 'QLT_COMMITMENT_INVALID_TRANSITION'
  | 'QLT_LOOP_INVALID_TRANSITION'
  | 'QLT_CORRECTION_DUPLICATE'
  | 'QLT_CORRECTION_CONFLICT'
  | 'QLT_LINEAGE_INVALID'
  | 'QLT_CONFIRMER_INVALID'
  | 'QLT_IDEMPOTENCY_CONFLICT'
  | 'QLT_VERSION_CONFLICT'
  | 'QLT_STORE_ERROR';

export type QltMeaningErrorCode = QltInputErrorCode | QltStoreErrorCode;

/** Structured meaning-store failure: stable code, never echoes content. */
export class QltMeaningError extends Error {
  readonly code: QltMeaningErrorCode;
  /** Bounded, non-content details (e.g. the truthful current status). */
  readonly details?: Readonly<Record<string, string | number>>;
  constructor(
    code: QltMeaningErrorCode,
    message: string,
    details?: Readonly<Record<string, string | number>>,
  ) {
    super(message);
    this.name = 'QltMeaningError';
    this.code = code;
    this.details = details;
  }
}

/** One validation issue: code + structural path ONLY (never a value). */
export interface QltParseIssue {
  readonly code: QltInputErrorCode;
  readonly path: string;
}

export type QltParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly QltParseIssue[] };

// ---------------------------------------------------------------------------
// Lifecycle transition tables (frozen data; the ONLY allowed transitions)
// ---------------------------------------------------------------------------

export const QLT_PROPOSAL_TRANSITIONS: Readonly<
  Record<QltProposalStatus, readonly QltProposalStatus[]>
> = {
  proposed: ['awaiting_decision', 'withdrawn'],
  awaiting_decision: ['confirmed', 'rejected', 'amended', 'withdrawn'],
  confirmed: [],
  rejected: [],
  amended: [],
  withdrawn: [],
};

export const QLT_CLAIM_TRANSITIONS: Readonly<Record<QltClaimStatus, readonly QltClaimStatus[]>> = {
  active: ['superseded', 'retired'],
  superseded: [],
  retired: [],
};

export const QLT_COMMITMENT_TRANSITIONS: Readonly<
  Record<QltCommitmentStatus, readonly QltCommitmentStatus[]>
> = {
  active: ['released', 'superseded', 'amended'],
  released: [],
  superseded: [],
  amended: [],
};

export const QLT_OPEN_LOOP_TRANSITIONS: Readonly<
  Record<QltOpenLoopStatus, readonly QltOpenLoopStatus[]>
> = {
  open: ['resolved', 'superseded', 'abandoned', 'transformed'],
  resolved: [],
  superseded: [],
  abandoned: [],
  transformed: [],
};

// ---------------------------------------------------------------------------
// Canonical eligibility (data; Q2 exposes predicates and inspection reads
// ONLY — it never assembles model context)
// ---------------------------------------------------------------------------

/**
 * The statuses per family that MAY become context-eligible. Proposals are
 * epistemically inert: never eligible in any status. Corrections are
 * lineage records, not context material. Eligibility additionally
 * requires retention_state = 'currently-relevant'.
 */
export const QLT_CANONICAL_ELIGIBLE_STATUSES: Readonly<{
  proposal: readonly QltProposalStatus[];
  claim: readonly QltClaimStatus[];
  commitment: readonly QltCommitmentStatus[];
  open_loop: readonly QltOpenLoopStatus[];
  correction: readonly QltCorrectionStatus[];
}> = {
  proposal: [],
  claim: ['active'],
  commitment: ['active'],
  open_loop: ['open'],
  correction: [],
};

// ---------------------------------------------------------------------------
// Content schemas (closed field sets per family)
// ---------------------------------------------------------------------------

/** Epistemic-claim proposal content (maps 1:1 onto qlt_claim columns). */
export interface QltClaimProposalContent {
  readonly subject: string;
  readonly epistemicType: QltEpistemicType;
  readonly honestyState: QltHonestyState;
  readonly confidence: QltConfidence;
  readonly statement: string;
}

/** Commitment proposal content. */
export interface QltCommitmentProposalContent {
  readonly commitmentKey: string;
  readonly statement: string;
}

/** Open-loop proposal content. */
export interface QltOpenLoopProposalContent {
  readonly subject: string;
  readonly loopKind: QltLoopKind;
  readonly detail: string;
}

/** Correction proposal content (targets an existing record). */
export interface QltCorrectionProposalContent {
  readonly statement: string;
  readonly reason: string;
}

export type QltProposalContent =
  | QltClaimProposalContent
  | QltCommitmentProposalContent
  | QltOpenLoopProposalContent
  | QltCorrectionProposalContent;

/** Stored substantive-record content (bounded, canonical JSON). */
export interface QltClaimContent {
  readonly statement: string;
}
export interface QltCommitmentContent {
  readonly statement: string;
}
export interface QltOpenLoopContent {
  readonly detail: string;
}
export type QltSubjectContent = QltClaimContent | QltCommitmentContent | QltOpenLoopContent;

// ---------------------------------------------------------------------------
// Record types (camelCase mirrors of the frozen columns)
// ---------------------------------------------------------------------------

export interface QltProposal {
  readonly id: string;
  readonly version: number;
  readonly status: QltProposalStatus;
  readonly proposalKind: QltProposalKind;
  readonly content: QltProposalContent;
  readonly contentFingerprint: string;
  readonly proposedBy: string;
  readonly decisionBy?: string;
  readonly decidedAtMs?: number;
  readonly decisionReason?: string;
  readonly targetRecordId?: string;
  readonly targetRecordFamily?: QltSubjectFamily;
  readonly targetRecordVersion?: number;
  readonly sourceThreadId: string;
  readonly sourceTurnRef?: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  readonly retentionState: QltRetentionState;
}

export interface QltClaim {
  readonly id: string;
  readonly version: number;
  readonly status: QltClaimStatus;
  readonly epistemicType: QltEpistemicType;
  readonly honestyState: QltHonestyState;
  readonly confidence: QltConfidence;
  readonly subject: string;
  readonly content: QltClaimContent;
  readonly contentFingerprint: string;
  readonly proposalId?: string;
  readonly createdBy: string;
  readonly supersedesId?: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  readonly retentionState: QltRetentionState;
}

export interface QltCommitment {
  readonly id: string;
  readonly version: number;
  readonly status: QltCommitmentStatus;
  readonly commitmentKey: string;
  readonly content: QltCommitmentContent;
  readonly contentFingerprint: string;
  readonly normativeBasisProposalId?: string;
  readonly proposalId?: string;
  readonly createdBy: string;
  readonly supersedesId?: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  readonly retentionState: QltRetentionState;
}

export interface QltOpenLoop {
  readonly id: string;
  readonly version: number;
  readonly status: QltOpenLoopStatus;
  readonly loopKind: QltLoopKind;
  readonly subject: string;
  readonly exitReason?: string;
  readonly exitBy?: string;
  readonly exitedAtMs?: number;
  readonly content: QltOpenLoopContent;
  readonly contentFingerprint: string;
  readonly proposalId?: string;
  readonly createdBy: string;
  readonly supersedesId?: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  readonly retentionState: QltRetentionState;
}

export interface QltCorrection {
  readonly id: string;
  readonly status: QltCorrectionStatus;
  readonly subjectRecordId: string;
  readonly subjectRecordFamily: QltSubjectFamily;
  readonly correctionKey: string;
  readonly priorContentFingerprint: string;
  readonly reason?: string;
  readonly content: QltSubjectContent;
  readonly contentFingerprint: string;
  readonly correctedBy: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly effectiveAtMs: number;
  readonly retentionState: QltRetentionState;
}

/** One immutable provenance/lineage link. */
export interface QltSourceLink {
  readonly id: string;
  readonly fromRecordId: string;
  readonly fromRecordFamily: QltSourceLinkFromFamily;
  readonly toKind: QltSourceLinkToKind;
  readonly toRef: string;
  readonly relation: QltSourceLinkRelation;
  readonly createdAtMs: number;
  readonly retentionState: QltRetentionState;
}

/** Any substantive record (claim | commitment | open loop). */
export type QltSubjectRecord = QltClaim | QltCommitment | QltOpenLoop;

// ---------------------------------------------------------------------------
// Repository port (Q2: exercised directly by tests only — no production
// user or agent path may reach it; Q3 wires it behind the governed VICT
// 0.2.0 boundary)
// ---------------------------------------------------------------------------

export interface QltRecordPage<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

/** Shared transition options: optimistic version + deterministic clock. */
export interface QltTransitionOptions {
  /** Optimistic concurrency: fail QLT_VERSION_CONFLICT on mismatch. */
  readonly expectedVersion?: number;
  /** Deterministic clock override (epoch ms). */
  readonly now?: number;
  /** Idempotency key (bounded safe pattern) for exactly-once convergence. */
  readonly key?: string;
}

export interface QltCreateProposalInput {
  readonly proposalKind: QltProposalKind;
  /** Already-validated typed content (produced by the `meaning.ts` parse fence). */
  readonly content: QltProposalContent;
  readonly proposedBy: string;
  readonly sourceThreadId: string;
  readonly sourceTurnRef?: string;
  /** REQUIRED for kind = 'correction'; FORBIDDEN otherwise. */
  readonly targetRecord?: {
    readonly recordId: string;
    readonly family: QltSubjectFamily;
    readonly version: number;
  };
  readonly id?: string;
  readonly key?: string;
  readonly now?: number;
}

export interface QltConfirmProposalInput extends QltTransitionOptions {
  readonly proposalId: string;
  readonly confirmedBy: string;
}

export interface QltRejectProposalInput extends QltTransitionOptions {
  readonly proposalId: string;
  readonly decidedBy: string;
  readonly reason?: string;
}

export interface QltWithdrawProposalInput extends QltTransitionOptions {
  readonly proposalId: string;
  readonly withdrawnBy: string;
  readonly reason?: string;
}

export interface QltAmendProposalInput extends QltTransitionOptions {
  readonly proposalId: string;
  /** Amendments are USER-authority operations (OQ6): an actor-* identity. */
  readonly amendedBy: string;
  readonly content: QltProposalContent;
  readonly reason?: string;
}

export interface QltCreateClaimInput {
  readonly subject: string;
  readonly epistemicType: QltEpistemicType;
  readonly honestyState: QltHonestyState;
  readonly confidence: QltConfidence;
  readonly statement: string;
  /** User-authority identity (actor-*): explicit Save = confirmation. */
  readonly createdBy: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly id?: string;
  readonly key?: string;
  readonly now?: number;
}

export interface QltCreateCommitmentInput {
  readonly commitmentKey: string;
  readonly statement: string;
  readonly createdBy: string;
  readonly normativeBasisProposalId?: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly id?: string;
  readonly key?: string;
  readonly now?: number;
}

export interface QltCreateOpenLoopInput {
  readonly subject: string;
  readonly loopKind: QltLoopKind;
  readonly detail: string;
  readonly createdBy: string;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly id?: string;
  readonly key?: string;
  readonly now?: number;
}

export interface QltLoopExitInput extends QltTransitionOptions {
  readonly loopId: string;
  readonly exitedBy: string;
  /** REQUIRED for abandon and transform (canonical §5.5). */
  readonly reason?: string;
}

export interface QltSubjectExitInput extends QltTransitionOptions {
  readonly recordId: string;
  readonly exitedBy: string;
  readonly reason?: string;
}

export interface QltApplyCorrectionInput {
  readonly subjectRecordId: string;
  readonly subjectFamily: QltSubjectFamily;
  readonly correctionKey: string;
  /** The successor's content (same family shape as the subject). */
  readonly content: QltSubjectContent;
  readonly correctedBy: string;
  readonly reason?: string;
  readonly expectedVersion?: number;
  readonly sourceThreadId?: string;
  readonly sourceTurnRef?: string;
  readonly id?: string;
  readonly key?: string;
  readonly now?: number;
}

export interface QltConfirmationOutcome {
  readonly proposal: QltProposal;
  readonly createdRecords: readonly QltSubjectRecord[];
  readonly correction?: QltCorrection;
}

export interface QltCorrectionOutcome {
  readonly correction: QltCorrection;
  readonly predecessor: QltSubjectRecord;
  readonly successor: QltSubjectRecord;
}

export interface QltProposalQuery {
  readonly status?: QltProposalStatus;
  readonly proposalKind?: QltProposalKind;
  readonly sourceThreadId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface QltSubjectQuery {
  readonly status?: string;
  readonly subject?: string;
  readonly retentionState?: QltRetentionState;
  readonly limit?: number;
  readonly offset?: number;
}

export interface QltCommitmentQuery {
  readonly status?: QltCommitmentStatus;
  readonly commitmentKey?: string;
  readonly retentionState?: QltRetentionState;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * The Q2 meaning repository port. Deterministic, transactional, keyed
 * idempotent. Q2 wires NO production caller; tests exercise it directly.
 */
export interface SharedWorldMeaningStore {
  // -- proposal / ceremony records -----------------------------------------
  createProposal(input: QltCreateProposalInput): Promise<QltProposal>;
  getProposal(id: string): Promise<QltProposal | undefined>;
  listProposals(query?: QltProposalQuery): Promise<QltRecordPage<QltProposal>>;
  markProposalAwaitingDecision(
    proposalId: string,
    options?: QltTransitionOptions,
  ): Promise<QltProposal>;
  /**
   * THE ceremony transition (repository level in Q2): proposal →
   * confirmed AND the target record(s) created AND provenance links
   * written, in ONE transaction. Refuses: non-awaiting proposals,
   * non-user confirmers, stale proposals (version-eligibility), decided
   * proposals. A rejected/withdrawn proposal can never be confirmed.
   */
  confirmProposal(input: QltConfirmProposalInput): Promise<QltConfirmationOutcome>;
  rejectProposal(input: QltRejectProposalInput): Promise<QltProposal>;
  withdrawProposal(input: QltWithdrawProposalInput): Promise<QltProposal>;
  amendProposal(input: QltAmendProposalInput): Promise<{
    readonly original: QltProposal;
    readonly amendment: QltProposal;
  }>;

  // -- direct user-authored records (explicit Save = confirmation) ---------
  createClaim(input: QltCreateClaimInput): Promise<QltClaim>;
  createCommitment(input: QltCreateCommitmentInput): Promise<QltCommitment>;
  createOpenLoop(input: QltCreateOpenLoopInput): Promise<QltOpenLoop>;

  // -- reads ----------------------------------------------------------------
  getClaim(id: string): Promise<QltClaim | undefined>;
  getCommitment(id: string): Promise<QltCommitment | undefined>;
  getOpenLoop(id: string): Promise<QltOpenLoop | undefined>;
  listClaims(query?: QltSubjectQuery): Promise<QltRecordPage<QltClaim>>;
  listCommitments(query?: QltCommitmentQuery): Promise<QltRecordPage<QltCommitment>>;
  listOpenLoops(query?: QltSubjectQuery): Promise<QltRecordPage<QltOpenLoop>>;

  // -- lifecycle exits (user authority; optimistic; keyed) ------------------
  retireClaim(input: QltSubjectExitInput): Promise<QltClaim>;
  releaseCommitment(input: QltSubjectExitInput): Promise<QltCommitment>;
  resolveLoop(input: QltLoopExitInput): Promise<QltOpenLoop>;
  abandonLoop(input: QltLoopExitInput): Promise<QltOpenLoop>;
  transformLoop(input: QltLoopExitInput): Promise<QltOpenLoop>;

  // -- correction lineage (append-only) --------------------------------------
  /**
   * ONE transaction: successor record created (supersedes_id), predecessor
   * → superseded (version + 1), immutable qlt_correction row, source
   * links. Duplicate (subject, correctionKey) converges idempotently;
   * a different key on a non-current subject fails QLT_RECORD_NOT_CURRENT
   * (duplicate successors fail closed).
   */
  applyCorrection(input: QltApplyCorrectionInput): Promise<QltCorrectionOutcome>;
  getCorrection(id: string): Promise<QltCorrection | undefined>;
  listCorrections(input: { readonly subjectRecordId: string }): Promise<readonly QltCorrection[]>;

  // -- provenance and lineage inspection reads -------------------------------
  listSourceLinks(input: { readonly fromRecordId: string }): Promise<readonly QltSourceLink[]>;
  /** Deterministic current-effective resolution (contract-declared rule). */
  resolveCurrentEffectiveClaim(subject: string): Promise<QltClaim | undefined>;
  resolveCurrentEffectiveCommitment(commitmentKey: string): Promise<QltCommitment | undefined>;
  resolveCurrentEffectiveOpenLoop(subject: string): Promise<QltOpenLoop | undefined>;

  close(): void;
}

// ---------------------------------------------------------------------------
// Deterministic serialization (frozen primitive shared by all lanes)
// ---------------------------------------------------------------------------

/**
 * Canonical JSON: object keys sorted lexicographically (UTF-16 code-unit
 * order, matching Array.prototype.sort), arrays in order, no whitespace.
 * Accepts JSON scalars, plain objects and arrays ONLY; symbols, BigInt,
 * functions, undefined, non-finite numbers, exotic prototypes, and cycles
 * throw (QLT_INPUT_NOT_SERIALIZABLE discipline). Deterministic for the
 * same logical value regardless of key insertion order.
 */
export function canonicalJson(value: unknown, _depth = 0, _seen?: Set<object>): string {
  const seen = _seen ?? new Set<object>();
  if (value === null) {
    return 'null';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'symbol') {
    throw new TypeError('value is not canonically serializable (non-JSON scalar)');
  }
  if (typeof value === 'function' || typeof value === 'undefined') {
    throw new TypeError('value is not canonically serializable (non-JSON value)');
  }
  if (value instanceof Date || value instanceof RegExp) {
    throw new TypeError('value is not canonically serializable (exotic instance)');
  }
  if (typeof value !== 'object') {
    throw new TypeError('value is not canonically serializable');
  }
  if (_depth > QLT_JSON_MAX_DEPTH) {
    throw new TypeError('value exceeds the canonical depth bound');
  }
  if (seen.has(value as object)) {
    throw new TypeError('value is not canonically serializable (cycle)');
  }
  const proto = Object.getPrototypeOf(value as object);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) {
    throw new TypeError('value is not canonically serializable (exotic container)');
  }
  seen.add(value as object);
  try {
    if (Array.isArray(value)) {
      if (value.length > QLT_JSON_MAX_ARRAY_ITEMS) {
        throw new TypeError('value exceeds the canonical array bound');
      }
      const items = value.map((item) => canonicalJson(item, _depth + 1, seen));
      return `[${items.join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length > QLT_JSON_MAX_KEYS_PER_OBJECT) {
      throw new TypeError('value exceeds the canonical key bound');
    }
    const entries = keys.map((key) => {
      if (key === '__proto__') {
        throw new TypeError('value carries a prototype-named key');
      }
      return `${JSON.stringify(key)}:${canonicalJson(record[key], _depth + 1, seen)}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    seen.delete(value as object);
  }
}

/** Deterministic content fingerprint: sha256 hex over canonical JSON bytes. */
export function contentFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(Buffer.from(canonicalJson(value), 'utf8'))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// FROZEN SCHEMA INVENTORY — machine-readable mirror of migration 2
// (`qlt-meaning-foundation`). Introspection gates compare the live
// sqlite_master / pragma output against THIS data; any drift fails.
// ---------------------------------------------------------------------------

export interface QltColumnSpec {
  readonly name: string;
  readonly type: 'TEXT' | 'INTEGER';
  readonly notNull: boolean;
  readonly default?: string;
}

export interface QltIndexSpec {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly partialWhere?: string;
}

export interface QltForeignKeySpec {
  readonly column: string;
  readonly targetTable: string;
  readonly targetColumn: string;
}

export interface QltTableSpec {
  readonly columns: readonly QltColumnSpec[];
  readonly indexes: readonly QltIndexSpec[];
  readonly foreignKeys: readonly QltForeignKeySpec[];
  /** Substrings that MUST appear in the stored CREATE TABLE sql. */
  readonly requiredCheckFragments: readonly string[];
}

export const QLT_MEANING_TABLES = [
  'qlt_proposal',
  'qlt_claim',
  'qlt_commitment',
  'qlt_open_loop',
  'qlt_correction',
  'qlt_source_link',
] as const;

const CONTENT_COLUMN: QltColumnSpec = { name: 'content', type: 'TEXT', notNull: true };
const CONTENT_FINGERPRINT_COLUMN: QltColumnSpec = {
  name: 'content_fingerprint',
  type: 'TEXT',
  notNull: true,
};
const CREATED_AT_COLUMN: QltColumnSpec = { name: 'created_at_ms', type: 'INTEGER', notNull: true };
const UPDATED_AT_COLUMN: QltColumnSpec = { name: 'updated_at_ms', type: 'INTEGER', notNull: true };
const EFFECTIVE_AT_COLUMN: QltColumnSpec = {
  name: 'effective_at_ms',
  type: 'INTEGER',
  notNull: true,
};
const RETENTION_COLUMN: QltColumnSpec = {
  name: 'retention_state',
  type: 'TEXT',
  notNull: true,
  default: "'currently-relevant'",
};
const VERSION_COLUMN: QltColumnSpec = {
  name: 'version',
  type: 'INTEGER',
  notNull: true,
  default: '1',
};
const SOURCE_THREAD_COLUMN: QltColumnSpec = {
  name: 'source_thread_id',
  type: 'TEXT',
  notNull: false,
};
const SOURCE_TURN_COLUMN: QltColumnSpec = { name: 'source_turn_ref', type: 'TEXT', notNull: false };
const RETENTION_CHECK = "retention_state IN ('currently-relevant','user-removed')";
const CONTENT_CHECK = 'length(CAST(content AS BLOB)) <= 4096';
const FINGERPRINT_CHECK = 'length(content_fingerprint) = 64';
const CREATED_BY_CHECK = "created_by GLOB 'actor-*'";
const SUPERSEDES_CHECK = '(supersedes_id IS NULL) OR (supersedes_id <> id)';

export const QLT_MEANING_SCHEMA_INVENTORY: Readonly<
  Record<(typeof QLT_MEANING_TABLES)[number], QltTableSpec>
> = {
  qlt_proposal: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      VERSION_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'proposal_kind', type: 'TEXT', notNull: true },
      CONTENT_COLUMN,
      CONTENT_FINGERPRINT_COLUMN,
      { name: 'proposed_by', type: 'TEXT', notNull: true },
      { name: 'decision_by', type: 'TEXT', notNull: false },
      { name: 'decided_at_ms', type: 'INTEGER', notNull: false },
      { name: 'decision_reason', type: 'TEXT', notNull: false },
      { name: 'target_record_id', type: 'TEXT', notNull: false },
      { name: 'target_record_family', type: 'TEXT', notNull: false },
      { name: 'target_record_version', type: 'INTEGER', notNull: false },
      { name: 'source_thread_id', type: 'TEXT', notNull: true },
      SOURCE_TURN_COLUMN,
      CREATED_AT_COLUMN,
      UPDATED_AT_COLUMN,
      EFFECTIVE_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      { name: 'idx_qlt_proposal_status', columns: ['status', 'created_at_ms'], unique: false },
      {
        name: 'idx_qlt_proposal_thread',
        columns: ['source_thread_id', 'status'],
        unique: false,
      },
      {
        name: 'uq_qlt_proposal_open_per_turn',
        columns: ['source_thread_id', 'proposal_kind', 'source_turn_ref'],
        unique: true,
        partialWhere: "status IN ('proposed','awaiting_decision')",
      },
    ],
    foreignKeys: [{ column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' }],
    requiredCheckFragments: [
      "status IN ('proposed','awaiting_decision','confirmed','rejected','amended','withdrawn')",
      "proposal_kind IN ('claim','commitment','open_loop','correction')",
      CONTENT_CHECK,
      FINGERPRINT_CHECK,
      "(proposed_by GLOB 'agent-*') OR (proposed_by GLOB 'actor-*')",
      "((decision_by IS NULL) OR (decision_by GLOB 'actor-*'))",
      "(proposal_kind = 'correction') OR (target_record_id IS NULL)",
      RETENTION_CHECK,
      "((status IN ('confirmed','rejected','amended','withdrawn')) = ((decision_by IS NOT NULL) AND (decided_at_ms IS NOT NULL)))",
    ],
  },
  qlt_claim: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      VERSION_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'epistemic_type', type: 'TEXT', notNull: true },
      { name: 'honesty_state', type: 'TEXT', notNull: true },
      { name: 'confidence', type: 'TEXT', notNull: true },
      { name: 'subject', type: 'TEXT', notNull: true },
      CONTENT_COLUMN,
      CONTENT_FINGERPRINT_COLUMN,
      { name: 'proposal_id', type: 'TEXT', notNull: false },
      { name: 'created_by', type: 'TEXT', notNull: true },
      { name: 'supersedes_id', type: 'TEXT', notNull: false },
      SOURCE_THREAD_COLUMN,
      SOURCE_TURN_COLUMN,
      CREATED_AT_COLUMN,
      UPDATED_AT_COLUMN,
      EFFECTIVE_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      { name: 'idx_qlt_claim_subject', columns: ['subject', 'status'], unique: false },
      {
        name: 'idx_qlt_claim_eligible',
        columns: ['status', 'retention_state', 'effective_at_ms'],
        unique: false,
      },
    ],
    foreignKeys: [
      { column: 'proposal_id', targetTable: 'qlt_proposal', targetColumn: 'id' },
      { column: 'supersedes_id', targetTable: 'qlt_claim', targetColumn: 'id' },
      { column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' },
    ],
    requiredCheckFragments: [
      "status IN ('active','superseded','retired')",
      "epistemic_type IN ('E1','E2','E3','E4','E5','E6','E7')",
      "honesty_state IN ('known','likely','uncertain','stale','conflicted')",
      "confidence IN ('stated','qualified','uncertain')",
      CONTENT_CHECK,
      FINGERPRINT_CHECK,
      CREATED_BY_CHECK,
      SUPERSEDES_CHECK,
      RETENTION_CHECK,
    ],
  },
  qlt_commitment: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      VERSION_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'commitment_key', type: 'TEXT', notNull: true },
      CONTENT_COLUMN,
      CONTENT_FINGERPRINT_COLUMN,
      { name: 'normative_basis_proposal_id', type: 'TEXT', notNull: false },
      { name: 'proposal_id', type: 'TEXT', notNull: false },
      { name: 'created_by', type: 'TEXT', notNull: true },
      { name: 'supersedes_id', type: 'TEXT', notNull: false },
      SOURCE_THREAD_COLUMN,
      SOURCE_TURN_COLUMN,
      CREATED_AT_COLUMN,
      UPDATED_AT_COLUMN,
      EFFECTIVE_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      {
        name: 'uq_qlt_commitment_active_key',
        columns: ['commitment_key'],
        unique: true,
        partialWhere: "status = 'active'",
      },
      { name: 'idx_qlt_commitment_key', columns: ['commitment_key', 'status'], unique: false },
      {
        name: 'idx_qlt_commitment_eligible',
        columns: ['status', 'retention_state', 'effective_at_ms'],
        unique: false,
      },
    ],
    foreignKeys: [
      {
        column: 'normative_basis_proposal_id',
        targetTable: 'qlt_proposal',
        targetColumn: 'id',
      },
      { column: 'proposal_id', targetTable: 'qlt_proposal', targetColumn: 'id' },
      { column: 'supersedes_id', targetTable: 'qlt_commitment', targetColumn: 'id' },
      { column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' },
    ],
    requiredCheckFragments: [
      "status IN ('active','released','superseded','amended')",
      CONTENT_CHECK,
      FINGERPRINT_CHECK,
      CREATED_BY_CHECK,
      SUPERSEDES_CHECK,
      RETENTION_CHECK,
    ],
  },
  qlt_open_loop: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      VERSION_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'loop_kind', type: 'TEXT', notNull: true },
      { name: 'subject', type: 'TEXT', notNull: true },
      { name: 'exit_reason', type: 'TEXT', notNull: false },
      { name: 'exit_by', type: 'TEXT', notNull: false },
      { name: 'exited_at_ms', type: 'INTEGER', notNull: false },
      CONTENT_COLUMN,
      CONTENT_FINGERPRINT_COLUMN,
      { name: 'proposal_id', type: 'TEXT', notNull: false },
      { name: 'created_by', type: 'TEXT', notNull: true },
      { name: 'supersedes_id', type: 'TEXT', notNull: false },
      SOURCE_THREAD_COLUMN,
      SOURCE_TURN_COLUMN,
      CREATED_AT_COLUMN,
      UPDATED_AT_COLUMN,
      EFFECTIVE_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      { name: 'idx_qlt_open_loop_thread', columns: ['source_thread_id', 'status'], unique: false },
      { name: 'idx_qlt_open_loop_subject', columns: ['subject', 'status'], unique: false },
      {
        name: 'idx_qlt_open_loop_eligible',
        columns: ['status', 'retention_state', 'effective_at_ms'],
        unique: false,
      },
    ],
    foreignKeys: [
      { column: 'proposal_id', targetTable: 'qlt_proposal', targetColumn: 'id' },
      { column: 'supersedes_id', targetTable: 'qlt_open_loop', targetColumn: 'id' },
      { column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' },
    ],
    requiredCheckFragments: [
      "status IN ('open','resolved','superseded','abandoned','transformed')",
      "loop_kind IN ('pending_action','undecided_question','expected_event')",
      CONTENT_CHECK,
      FINGERPRINT_CHECK,
      CREATED_BY_CHECK,
      "((exit_by IS NULL) OR (exit_by GLOB 'actor-*'))",
      "((status = 'open') OR ((exit_by IS NOT NULL) AND (exited_at_ms IS NOT NULL)))",
      SUPERSEDES_CHECK,
      RETENTION_CHECK,
    ],
  },
  qlt_correction: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      { name: 'version', type: 'INTEGER', notNull: true, default: '1' },
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'subject_record_id', type: 'TEXT', notNull: true },
      { name: 'subject_record_family', type: 'TEXT', notNull: true },
      { name: 'correction_key', type: 'TEXT', notNull: true },
      { name: 'prior_content_fingerprint', type: 'TEXT', notNull: true },
      { name: 'reason', type: 'TEXT', notNull: false },
      CONTENT_COLUMN,
      CONTENT_FINGERPRINT_COLUMN,
      { name: 'corrected_by', type: 'TEXT', notNull: true },
      SOURCE_THREAD_COLUMN,
      SOURCE_TURN_COLUMN,
      CREATED_AT_COLUMN,
      UPDATED_AT_COLUMN,
      EFFECTIVE_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      {
        name: 'uq_qlt_correction_subject_key',
        columns: ['subject_record_id', 'correction_key'],
        unique: true,
      },
      {
        name: 'idx_qlt_correction_subject',
        columns: ['subject_record_id', 'created_at_ms'],
        unique: false,
      },
    ],
    foreignKeys: [{ column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' }],
    requiredCheckFragments: [
      "status = 'recorded'",
      "subject_record_family IN ('claim','commitment','open_loop')",
      '(version = 1)',
      'length(prior_content_fingerprint) = 64',
      CONTENT_CHECK,
      FINGERPRINT_CHECK,
      "corrected_by GLOB 'actor-*'",
      RETENTION_CHECK,
    ],
  },
  qlt_source_link: {
    columns: [
      { name: 'id', type: 'TEXT', notNull: true },
      { name: 'from_record_id', type: 'TEXT', notNull: true },
      { name: 'from_record_family', type: 'TEXT', notNull: true },
      { name: 'to_kind', type: 'TEXT', notNull: true },
      { name: 'to_ref', type: 'TEXT', notNull: true },
      { name: 'relation', type: 'TEXT', notNull: true },
      CREATED_AT_COLUMN,
      RETENTION_COLUMN,
    ],
    indexes: [
      {
        name: 'uq_qlt_source_link',
        columns: ['from_record_id', 'to_kind', 'to_ref', 'relation'],
        unique: true,
      },
      { name: 'idx_qlt_source_link_from', columns: ['from_record_id'], unique: false },
      { name: 'idx_qlt_source_link_to', columns: ['to_kind', 'to_ref'], unique: false },
    ],
    foreignKeys: [],
    requiredCheckFragments: [
      "from_record_family IN ('proposal','claim','commitment','open_loop','correction')",
      "to_kind IN ('thread','turn','message','proposal','record','correction')",
      "relation IN ('source-thread','source-turn','proposed-from','supersedes','corrects','amends')",
      RETENTION_CHECK,
    ],
  },
};
