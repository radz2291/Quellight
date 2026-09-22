/**
 * Quellight Stage 07C Phase Q2 — meaning domain contracts (Lane B).
 *
 * The PURE domain layer of the durable Shared World meaning foundation:
 * closed validators (the FENCE-1 resolution for every new Shared World
 * input contract), lifecycle transition enforcement, authority predicates
 * (OQ6 ratified launch position), the version-eligibility staleness
 * predicate (NEVER elapsed time), canonical-eligibility predicates,
 * correction-lineage validation, and the pure current-effective resolution
 * rule. Everything here is deterministic: no I/O, no clock, no SQLite.
 *
 * Ownership/behavior is frozen by
 * `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md`; the
 * types, vocabularies, bounds, and error codes come exclusively from
 * `./meaning-contract.js` (frozen; not editable by this lane).
 *
 * Q2 wires NO production caller: these functions are exercised directly
 * by the permanent conformance suite and are the fence future governed
 * paths (Q3+) must call before the repository port.
 */

import {
  QLT_AGENT_IDENTITY_PATTERN,
  QLT_CANONICAL_ELIGIBLE_STATUSES,
  QLT_CLAIM_TRANSITIONS,
  QLT_COMMITMENT_TRANSITIONS,
  QLT_CONFIDENCE_LEVELS,
  QLT_CONTENT_MAX_BYTES,
  QLT_DETAIL_MAX_CHARS,
  QLT_EPISTEMIC_TYPES,
  QLT_HONESTY_STATES,
  QLT_JSON_MAX_ARRAY_ITEMS,
  QLT_JSON_MAX_DEPTH,
  QLT_JSON_MAX_KEYS_PER_OBJECT,
  QLT_KEY_MAX_CHARS,
  QLT_LOOP_KINDS,
  QLT_OPEN_LOOP_TRANSITIONS,
  QLT_PROPOSAL_TRANSITIONS,
  QLT_REASON_MAX_CHARS,
  QLT_SAFE_ID_PATTERN,
  QLT_STATEMENT_MAX_CHARS,
  QLT_SUBJECT_MAX_CHARS,
  QLT_USER_ACTOR_PATTERN,
  QltMeaningError,
  canonicalJson,
  type QltClaimContent,
  type QltClaimProposalContent,
  type QltCommitmentContent,
  type QltCommitmentProposalContent,
  type QltConfidence,
  type QltCorrection,
  type QltCorrectionProposalContent,
  type QltEpistemicType,
  type QltHonestyState,
  type QltMeaningErrorCode,
  type QltLoopKind,
  type QltOpenLoopContent,
  type QltOpenLoopProposalContent,
  type QltParseIssue,
  type QltParseResult,
  type QltProposal,
  type QltProposalContent,
  type QltProposalKind,
  type QltRetentionState,
  type QltSubjectFamily,
  type QltSubjectRecord,
} from './meaning-contract.js';

// ---------------------------------------------------------------------------
// Internal structural walker (FENCE-1 — uniform hostile-input discipline)
// ---------------------------------------------------------------------------

function isPlainObjectCandidate(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Finite JSON numbers only (NaN/Infinity/-0 are non-serializable). */
function isCanonicalNumber(value: number): boolean {
  return Number.isFinite(value) && !Object.is(value, -0);
}

/**
 * Structural walk: prototype-named keys, depth, key counts, array limits,
 * non-serializable values, and hostile containers. Collects issues without
 * ever writing to the input; paths are structural only (non-echoing).
 */
function walkStructure(value: unknown, path: string, depth: number, issues: QltParseIssue[]): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!isCanonicalNumber(value)) {
      issues.push({ code: 'QLT_INPUT_NOT_SERIALIZABLE', path });
    }
    return;
  }
  if (
    typeof value === 'undefined' ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    issues.push({ code: 'QLT_INPUT_NOT_SERIALIZABLE', path });
    return;
  }
  if (value instanceof Date || value instanceof RegExp) {
    issues.push({ code: 'QLT_INPUT_INVALID_TYPE', path });
    return;
  }
  if (Array.isArray(value)) {
    if (depth > QLT_JSON_MAX_DEPTH) {
      issues.push({ code: 'QLT_INPUT_OVERDEPTH', path });
      return;
    }
    if (value.length > QLT_JSON_MAX_ARRAY_ITEMS) {
      issues.push({ code: 'QLT_INPUT_ARRAY_LIMIT', path });
      return;
    }
    for (let index = 0; index < value.length; index += 1) {
      walkStructure(value[index], `${path}[${index}]`, depth + 1, issues);
    }
    return;
  }
  if (!isPlainObjectCandidate(value)) {
    issues.push({ code: 'QLT_INPUT_INVALID_CONTAINER', path });
    return;
  }
  if (depth > QLT_JSON_MAX_DEPTH) {
    issues.push({ code: 'QLT_INPUT_OVERDEPTH', path });
    return;
  }
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length > QLT_JSON_MAX_KEYS_PER_OBJECT) {
    issues.push({ code: 'QLT_INPUT_KEY_LIMIT', path });
    return;
  }
  for (const key of keys) {
    if (key === '__proto__') {
      issues.push({
        code: 'QLT_INPUT_PROTO_KEY',
        path: path === '(root)' ? key : `${path}.${key}`,
      });
      continue;
    }
    walkStructure(
      (value as Record<string, unknown>)[key],
      path === '(root)' ? key : `${path}.${key}`,
      depth + 1,
      issues,
    );
  }
}

/** Structural issues for one candidate root; empty array means structurally clean. */
function structuralIssues(input: unknown): QltParseIssue[] {
  const issues: QltParseIssue[] = [];
  walkStructure(input, '(root)', 0, issues);
  return issues;
}

function notObject(): QltParseIssue[] {
  return [{ code: 'QLT_INPUT_NOT_OBJECT', path: '(root)' }];
}

// ---------------------------------------------------------------------------
// Shared closed-field string-schema machinery
// ---------------------------------------------------------------------------

interface StringFieldSpec {
  readonly key: string;
  readonly maxChars: number;
  readonly enums?: readonly string[];
  readonly idPattern?: boolean;
}

type ParseOutcome =
  | { readonly ok: true; readonly value: Record<string, string> }
  | {
      readonly ok: false;
      readonly issues: readonly QltParseIssue[];
    };

/**
 * Parse a flat closed-field string object against `specs`. The structural
 * walker runs FIRST (proto keys, hostile containers, non-serializable
 * values fail before field semantics), then the closed-field checks:
 * unknown fields REJECTED (never silently dropped), required fields
 * enforced, closed enums, char bounds, and finally the canonical UTF-8
 * byte bound on the parsed result. The result object is built field by
 * field with explicit literals — prototype pollution is impossible.
 */
function parseClosedStringObject(input: unknown, specs: readonly StringFieldSpec[]): ParseOutcome {
  if (Array.isArray(input) || input === null || typeof input !== 'object') {
    return { ok: false, issues: notObject() };
  }
  if (!isPlainObjectCandidate(input)) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_CONTAINER', path: '(root)' }] };
  }
  const structural = structuralIssues(input);
  if (structural.length > 0) {
    return { ok: false, issues: structural };
  }
  const record = input as Record<string, unknown>;
  const issues: QltParseIssue[] = [];
  const specByKey = new Map(specs.map((spec) => [spec.key, spec] as const));
  for (const key of Object.keys(record)) {
    if (!specByKey.has(key)) {
      issues.push({ code: 'QLT_INPUT_UNKNOWN_FIELD', path: key });
    }
  }
  const parsed: Record<string, string> = {};
  for (const spec of specs) {
    const value = record[spec.key];
    if (value === undefined) {
      issues.push({ code: 'QLT_INPUT_MISSING_FIELD', path: spec.key });
      continue;
    }
    if (typeof value !== 'string') {
      issues.push({ code: 'QLT_INPUT_INVALID_TYPE', path: spec.key });
      continue;
    }
    if (value.length === 0 || value.length > spec.maxChars) {
      issues.push({ code: 'QLT_INPUT_OVERSIZE', path: spec.key });
      continue;
    }
    if (spec.enums !== undefined && !spec.enums.includes(value)) {
      issues.push({ code: 'QLT_INPUT_INVALID_ENUM', path: spec.key });
      continue;
    }
    if (spec.idPattern === true && !QLT_SAFE_ID_PATTERN.test(value)) {
      issues.push({ code: 'QLT_INPUT_INVALID_ID', path: spec.key });
      continue;
    }
    parsed[spec.key] = value;
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // Whole-content canonical byte bound (the hard limit; chars lose).
  try {
    const bytes = Buffer.byteLength(canonicalJson(parsed), 'utf8');
    if (bytes > QLT_CONTENT_MAX_BYTES) {
      return { ok: false, issues: [{ code: 'QLT_INPUT_OVERSIZE', path: '(root)' }] };
    }
  } catch {
    return { ok: false, issues: [{ code: 'QLT_INPUT_NOT_SERIALIZABLE', path: '(root)' }] };
  }
  return { ok: true, value: parsed };
}

function asResult<T extends object>(
  outcome: ParseOutcome,
  build: (value: Record<string, string>) => T,
): QltParseResult<T> {
  if (!outcome.ok) {
    return { ok: false, issues: outcome.issues };
  }
  return { ok: true, value: build(outcome.value) };
}

// ---------------------------------------------------------------------------
// Proposal-content validators (one per proposal kind; closed field sets)
// ---------------------------------------------------------------------------

export function parseClaimProposalContent(input: unknown): QltParseResult<QltClaimProposalContent> {
  return asResult(
    parseClosedStringObject(input, [
      { key: 'subject', maxChars: QLT_SUBJECT_MAX_CHARS },
      { key: 'epistemicType', maxChars: 2, enums: QLT_EPISTEMIC_TYPES },
      { key: 'honestyState', maxChars: 16, enums: QLT_HONESTY_STATES },
      { key: 'confidence', maxChars: 16, enums: QLT_CONFIDENCE_LEVELS },
      { key: 'statement', maxChars: QLT_STATEMENT_MAX_CHARS },
    ]),
    (value) => ({
      subject: value['subject']!,
      epistemicType: value['epistemicType']! as QltEpistemicType,
      honestyState: value['honestyState']! as QltHonestyState,
      confidence: value['confidence']! as QltConfidence,
      statement: value['statement']!,
    }),
  );
}

export function parseCommitmentProposalContent(
  input: unknown,
): QltParseResult<QltCommitmentProposalContent> {
  return asResult(
    parseClosedStringObject(input, [
      { key: 'commitmentKey', maxChars: QLT_KEY_MAX_CHARS, idPattern: true },
      { key: 'statement', maxChars: QLT_STATEMENT_MAX_CHARS },
    ]),
    (value) => ({
      commitmentKey: value['commitmentKey']!,
      statement: value['statement']!,
    }),
  );
}

export function parseOpenLoopProposalContent(
  input: unknown,
): QltParseResult<QltOpenLoopProposalContent> {
  return asResult(
    parseClosedStringObject(input, [
      { key: 'subject', maxChars: QLT_SUBJECT_MAX_CHARS },
      { key: 'loopKind', maxChars: 24, enums: QLT_LOOP_KINDS },
      { key: 'detail', maxChars: QLT_DETAIL_MAX_CHARS },
    ]),
    (value) => ({
      subject: value['subject']!,
      loopKind: value['loopKind']! as QltLoopKind,
      detail: value['detail']!,
    }),
  );
}

export function parseCorrectionProposalContent(
  input: unknown,
): QltParseResult<QltCorrectionProposalContent> {
  return asResult(
    parseClosedStringObject(input, [
      { key: 'statement', maxChars: QLT_STATEMENT_MAX_CHARS },
      { key: 'reason', maxChars: QLT_REASON_MAX_CHARS },
    ]),
    (value) => ({
      statement: value['statement']!,
      reason: value['reason']!,
    }),
  );
}

export function parseProposalContent(
  kind: QltProposalKind,
  input: unknown,
): QltParseResult<QltProposalContent> {
  switch (kind) {
    case 'claim':
      return parseClaimProposalContent(input);
    case 'commitment':
      return parseCommitmentProposalContent(input);
    case 'open_loop':
      return parseOpenLoopProposalContent(input);
    case 'correction':
      return parseCorrectionProposalContent(input);
    default:
      return {
        ok: false,
        issues: [{ code: 'QLT_INPUT_INVALID_ENUM', path: '(root)' }],
      };
  }
}

// ---------------------------------------------------------------------------
// Stored-record content validators
// ---------------------------------------------------------------------------

export function parseClaimContent(input: unknown): QltParseResult<QltClaimContent> {
  return asResult(
    parseClosedStringObject(input, [{ key: 'statement', maxChars: QLT_STATEMENT_MAX_CHARS }]),
    (value) => ({ statement: value['statement']! }),
  );
}

export function parseCommitmentContent(input: unknown): QltParseResult<QltCommitmentContent> {
  return asResult(
    parseClosedStringObject(input, [{ key: 'statement', maxChars: QLT_STATEMENT_MAX_CHARS }]),
    (value) => ({ statement: value['statement']! }),
  );
}

export function parseOpenLoopContent(input: unknown): QltParseResult<QltOpenLoopContent> {
  return asResult(
    parseClosedStringObject(input, [{ key: 'detail', maxChars: QLT_DETAIL_MAX_CHARS }]),
    (value) => ({ detail: value['detail']! }),
  );
}

// ---------------------------------------------------------------------------
// Identity / identifier validators
// ---------------------------------------------------------------------------

export function parseUserActorIdentity(input: unknown): QltParseResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_TYPE', path: '(root)' }] };
  }
  if (!QLT_USER_ACTOR_PATTERN.test(input)) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_IDENTITY', path: '(root)' }] };
  }
  return { ok: true, value: input };
}

export function parseAgentOrUserIdentity(input: unknown): QltParseResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_TYPE', path: '(root)' }] };
  }
  if (!QLT_USER_ACTOR_PATTERN.test(input) && !QLT_AGENT_IDENTITY_PATTERN.test(input)) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_IDENTITY', path: '(root)' }] };
  }
  return { ok: true, value: input };
}

export function parseSafeId(input: unknown): QltParseResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_TYPE', path: '(root)' }] };
  }
  if (!QLT_SAFE_ID_PATTERN.test(input)) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_ID', path: '(root)' }] };
  }
  return { ok: true, value: input };
}

export function parseSafeKey(input: unknown): QltParseResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_TYPE', path: '(root)' }] };
  }
  if (input.length === 0 || input.length > QLT_KEY_MAX_CHARS) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_OVERSIZE', path: '(root)' }] };
  }
  if (!QLT_SAFE_ID_PATTERN.test(input)) {
    return { ok: false, issues: [{ code: 'QLT_INPUT_INVALID_ID', path: '(root)' }] };
  }
  return { ok: true, value: input };
}

// ---------------------------------------------------------------------------
// Lifecycle transition enforcement (frozen tables; closed vocabularies)
// ---------------------------------------------------------------------------

export type QltLifecycleFamily = 'proposal' | 'claim' | 'commitment' | 'open_loop';

const TRANSITION_TABLES: Readonly<
  Record<
    QltLifecycleFamily,
    {
      readonly table: Readonly<Record<string, readonly string[]>>;
      readonly code: QltMeaningErrorCode;
    }
  >
> = {
  proposal: { table: QLT_PROPOSAL_TRANSITIONS, code: 'QLT_PROPOSAL_INVALID_TRANSITION' },
  claim: { table: QLT_CLAIM_TRANSITIONS, code: 'QLT_CLAIM_INVALID_TRANSITION' },
  commitment: { table: QLT_COMMITMENT_TRANSITIONS, code: 'QLT_COMMITMENT_INVALID_TRANSITION' },
  open_loop: { table: QLT_OPEN_LOOP_TRANSITIONS, code: 'QLT_LOOP_INVALID_TRANSITION' },
};

/**
 * Assert one lifecycle transition against the frozen transition table.
 * Unknown from/to statuses and non-declared transitions throw a
 * QltMeaningError with the family's stable code (closed vocabularies —
 * unknown states are structurally impossible).
 */
export function assertTransition(family: QltLifecycleFamily, from: string, to: string): void {
  const entry = TRANSITION_TABLES[family];
  const allowed = entry.table[from];
  if (allowed === undefined || !allowed.includes(to)) {
    throw new QltMeaningError(entry.code, 'The lifecycle transition is not declared.', {
      family,
      from,
      to,
    });
  }
}

// ---------------------------------------------------------------------------
// Authority predicates (OQ6 ratified launch position)
// ---------------------------------------------------------------------------

export function isUserActorIdentity(identity: unknown): boolean {
  return typeof identity === 'string' && QLT_USER_ACTOR_PATTERN.test(identity);
}

export function isAgentIdentity(identity: unknown): boolean {
  return typeof identity === 'string' && QLT_AGENT_IDENTITY_PATTERN.test(identity);
}

/** Confirmation authority: USER actors ONLY — the agent may never confirm. */
export function canConfirm(identity: unknown): boolean {
  return isUserActorIdentity(identity);
}

/** Correction authority: USER actors ONLY (OQ6 §19.2.8). */
export function canCorrect(identity: unknown): boolean {
  return isUserActorIdentity(identity);
}

/** Authoring authority (explicit Save = confirmation): USER actors ONLY. */
export function canAuthor(identity: unknown): boolean {
  return isUserActorIdentity(identity);
}

/** Proposal authority: agent or user. */
export function canPropose(identity: unknown): boolean {
  return isUserActorIdentity(identity) || isAgentIdentity(identity);
}

/** Withdrawal authority: agent or user (agent/product-policy withdrawal). */
export function canWithdraw(identity: unknown): boolean {
  return isUserActorIdentity(identity) || isAgentIdentity(identity);
}

// ---------------------------------------------------------------------------
// Staleness (OQ6 §19.3 — version eligibility, NEVER elapsed time)
// ---------------------------------------------------------------------------

export interface QltStalenessTarget {
  readonly version: number;
  readonly status: string;
  readonly retentionState: QltRetentionState;
}

export type QltStalenessReason =
  | 'target-version-changed'
  | 'target-superseded'
  | 'target-ineligible'
  | 'source-missing'
  | 'source-removed';

export interface QltStalenessResult {
  readonly stale: boolean;
  readonly reason?: QltStalenessReason;
}

/**
 * The binding stale-proposal predicate. Deterministic evaluation order:
 * correction-kind proposals — (1) target missing → 'target-ineligible';
 * (2) target status not current-effective → 'target-superseded';
 * (3) drafted-against version ≠ current version → 'target-version-changed';
 * (4) target retention-removed → 'target-ineligible'. Then EVERY kind —
 * (5) source thread missing → 'source-missing';
 * (6) source thread retention-removed → 'source-removed'.
 * No clock exists in this function: time alone NEVER makes a proposal stale.
 */
export function proposalStaleness(
  proposal: Pick<QltProposal, 'proposalKind' | 'targetRecordFamily' | 'targetRecordVersion'>,
  target: QltStalenessTarget | undefined,
  sourceThread: { readonly retentionState: QltRetentionState } | undefined,
): QltStalenessResult {
  if (proposal.proposalKind === 'correction') {
    if (target === undefined) {
      return { stale: true, reason: 'target-ineligible' };
    }
    if (!isStatusEligible(proposal.targetRecordFamily ?? 'claim', target.status)) {
      return { stale: true, reason: 'target-superseded' };
    }
    if (target.version !== proposal.targetRecordVersion) {
      return { stale: true, reason: 'target-version-changed' };
    }
    if (target.retentionState === 'user-removed') {
      return { stale: true, reason: 'target-ineligible' };
    }
    // D1a dependency re-evaluation (freeze §7): the pure projection
    // mirrors the boundary — ANY non-currently-relevant target retention
    // state (expired included) is structurally stale, so the inspection
    // staleness projection can never contradict the confirm boundary.
    if (target.retentionState !== 'currently-relevant') {
      return { stale: true, reason: 'target-ineligible' };
    }
  }
  if (sourceThread === undefined) {
    return { stale: true, reason: 'source-missing' };
  }
  if (sourceThread.retentionState === 'user-removed') {
    return { stale: true, reason: 'source-removed' };
  }
  return { stale: false };
}

// ---------------------------------------------------------------------------
// Canonical eligibility
// ---------------------------------------------------------------------------

const ELIGIBLE_FAMILY_BY_RECORD = {
  proposal: 'proposal',
  claim: 'claim',
  commitment: 'commitment',
  open_loop: 'open_loop',
  correction: 'correction',
} as const;

type EligibleFamily = keyof typeof ELIGIBLE_FAMILY_BY_RECORD;

export function isStatusEligible(family: EligibleFamily, status: string): boolean {
  const statuses = QLT_CANONICAL_ELIGIBLE_STATUSES[family];
  return statuses.includes(status as never);
}

function recordFamily(record: QltProposal | QltSubjectRecord | QltCorrection): EligibleFamily {
  if ('subjectRecordFamily' in record) {
    return 'correction';
  }
  if ('proposalKind' in record) {
    return 'proposal';
  }
  if ('commitmentKey' in record) {
    return 'commitment';
  }
  if ('epistemicType' in record) {
    return 'claim';
  }
  return 'open_loop';
}

/**
 * Canonical eligibility: an eligible status for the record's family AND
 * `currently-relevant` retention. Proposals are epistemically inert and
 * NEVER eligible in any status; corrections are lineage records and never
 * eligible. Eligibility never makes material canonical by itself — no Q2
 * path assembles context from it.
 */
export function isCanonicalEligible(
  record: QltProposal | QltSubjectRecord | QltCorrection,
): boolean {
  return (
    isStatusEligible(recordFamily(record), record.status) &&
    record.retentionState === 'currently-relevant'
  );
}

// ---------------------------------------------------------------------------
// Correction lineage
// ---------------------------------------------------------------------------

/**
 * The subject of a correction must still be current-effective (its
 * family's eligible status); anything else fails QLT_RECORD_NOT_CURRENT —
 * a superseded record can never gain a second successor.
 */
export function assertCorrectionSubjectCurrent(family: QltSubjectFamily, status: string): void {
  if (!isStatusEligible(family, status)) {
    throw new QltMeaningError('QLT_RECORD_NOT_CURRENT', 'The correction subject is not current.', {
      family,
      status,
    });
  }
}

/**
 * Validate a supersedes lineage: no self-reference, no cycle, no revisit.
 * Valid backward chains (a forest) pass; dangling references are a
 * storage concern, not a lineage cycle.
 */
export function validateLineageChain(
  records: readonly { readonly id: string; readonly supersedesId?: string }[],
): void {
  const supersedes = new Map<string, string | undefined>();
  for (const record of records) {
    if (record.supersedesId === record.id) {
      throw new QltMeaningError('QLT_LINEAGE_INVALID', 'The lineage self-references.', {
        recordId: record.id,
      });
    }
    supersedes.set(record.id, record.supersedesId);
  }
  for (const record of records) {
    const visited = new Set<string>([record.id]);
    let cursor = supersedes.get(record.id);
    while (cursor !== undefined) {
      if (visited.has(cursor)) {
        throw new QltMeaningError('QLT_LINEAGE_INVALID', 'The lineage contains a cycle.', {
          recordId: cursor,
        });
      }
      visited.add(cursor);
      cursor = supersedes.get(cursor);
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic current-effective resolution (pure rule; SQL parity rule)
// ---------------------------------------------------------------------------

/**
 * Among eligible records: order by effectiveAtMs DESC, createdAtMs DESC,
 * id ASC (plain string compare); the first is current-effective. The
 * repository implements the identical rule in SQL; the conformance suite
 * proves parity.
 */
export function resolveCurrentEffective<T extends QltSubjectRecord>(
  records: readonly T[],
): T | undefined {
  const eligible = records.filter((record) => isCanonicalEligible(record));
  if (eligible.length === 0) {
    return undefined;
  }
  const sorted = [...eligible].sort((left, right) => {
    if (right.effectiveAtMs !== left.effectiveAtMs) {
      return right.effectiveAtMs - left.effectiveAtMs;
    }
    if (right.createdAtMs !== left.createdAtMs) {
      return right.createdAtMs - left.createdAtMs;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return sorted[0];
}
