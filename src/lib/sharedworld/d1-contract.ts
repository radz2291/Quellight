/**
 * QUELLIGHT STAGE 07D PHASE D1a — JOINT RETENTION/CONFLICT CONTRACT FREEZE
 * (FROZEN in
 * docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md).
 *
 * This module is the FROZEN, declarative Stage 07D D1a contract shared by
 * the D1 Lane A (retention and user removal) and D3 Lane B (conflicts and
 * semantic distinction) implementations. It contains contract DATA and
 * TYPES only — closed vocabularies, identity/action inventories, stable
 * codes, lifecycle and retention transition tables, tombstone column
 * rules, enforcement-pass rules, migration-5 inventory data (new
 * families), the amended meaning-family CHECK fragment data, the
 * authority matrix, UI truthfulness/presentation rules, the
 * negative-control matrix, lane ownership, D2-facing interface
 * declarations, and explicit exclusions — never executable policy. The
 * conforming implementations are `retention-store.ts` /
 * `retention-surface.ts` (Lane A) and `conflict-store.ts` /
 * `conflict-surface.ts` plus the ceremony confirm-time conflict hook
 * (Lane B).
 *
 * Ownership: frozen by the Phase D1a contract-freeze commit; NO D1/D3
 * lane may edit this file. A material change requires an explicit,
 * standalone freeze amendment committed BEFORE the dependent
 * implementation continues.
 *
 * Authority basis: the approved Stage 07D owner decisions OD-D1..OD-D6
 * (decision register D-07D-1; binding), the D0 planning document, the
 * Stage 07 architecture §12/§14 and §8 first vertical, the Stage 07C
 * handoff §18 boundary, the ratified OQ6 model (user = constitutional
 * authority and final confirmer; agent = proposer only), and the frozen
 * 07C contracts (Q2/Q3/Q4/Q5/Q6 data unchanged except the explicitly
 * amended meaning-family data noted in the freeze report §3).
 */

import type {
  QltColumnSpec,
  QltForeignKeySpec,
  QltIndexSpec,
  QltTableSpec,
} from './meaning-contract.js';

// ---------------------------------------------------------------------------
// 1. Retention vocabulary and state transitions (owner decision OD-D1)
// ---------------------------------------------------------------------------

/**
 * The 07D meaning-family retention vocabulary (closed; supersedes the
 * 07C two-state list for the SIX meaning tables only — the 07B
 * `qlt_thread` family keeps its closed 2-state vocabulary
 * `currently-relevant` | `user-removed`; thread removal arrives with D2
 * conversation deletion and is NOT part of D1).
 *
 *   - `currently-relevant`: eligible for context assembly (with the
 *     frozen status/lineage/integrity rules).
 *   - `expired`: no longer currently relevant (claims only; user-assigned
 *     expiry metadata applied by the enforcement pass). Excluded from
 *     assembly forever; inspectable in the history bucket with its
 *     content retained (expiry is NOT removal; content handling beyond
 *     current relevance is D2 scope).
 *   - `user-removed`: the content-free tombstone state (owner decision
 *     OD-D2). Every content-bearing column is NULL; the row and its
 *     identity persist for lineage truthfulness; excluded from assembly
 *     forever; removal is irreversible in D1 (no un-removal path).
 */
export const QLT_D1_MEANING_RETENTION_STATES = [
  'currently-relevant',
  'expired',
  'user-removed',
] as const;
export type QltD1RetentionState = (typeof QLT_D1_MEANING_RETENTION_STATES)[number];

/** The 07B thread retention vocabulary (unchanged; D1 never writes it). */
export const QLT_D1_THREAD_RETENTION_STATES = ['currently-relevant', 'user-removed'] as const;

/**
 * The retention transition table (closed, total; the ONLY allowed
 * retention-state writes of D1):
 *   - `currently-relevant → user-removed`: the governed user removal
 *     (any subject family; user identity only).
 *   - `currently-relevant → expired`: the enforcement pass ONLY (claims
 *     with user-assigned `expires_at_ms` metadata whose time has been
 *     reached at pass execution).
 *   - `expired → user-removed`: the governed user removal of an expired
 *     claim (removal preempts lineage retention).
 *   - every other transition is FORBIDDEN (no un-expiry, no un-removal,
 *     no direct-to-expired write outside the pass, no agent write).
 */
export const QLT_D1_RETENTION_TRANSITIONS: Readonly<
  Record<QltD1RetentionState, readonly QltD1RetentionState[]>
> = {
  'currently-relevant': ['expired', 'user-removed'],
  expired: ['user-removed'],
  'user-removed': [],
};

/**
 * Tombstone column rules (owner decision OD-D2): when a family row
 * reaches `user-removed`, EXACTLY these columns are set to NULL in the
 * same transaction; every other column (ids, kinds, status, version,
 * identities, timestamps, provenance references, lifecycle exit
 * metadata) is PRESERVED. The row-level CHECK constraints added by
 * migration 5 enforce this at the storage layer (content-free is not a
 * convention; it is a constraint).
 */
export const QLT_D1_TOMBSTONE_NULLED_COLUMNS: Readonly<{
  claim: readonly string[];
  commitment: readonly string[];
  open_loop: readonly string[];
}> = {
  claim: [
    'subject',
    'epistemic_type',
    'honesty_state',
    'confidence',
    'content',
    'content_fingerprint',
    // A removed record retains NO forward-looking retention schedule:
    // removal clears the expiry metadata too (enforced by the
    // EXPIRY_STATE_CHECK fragment in the amended inventory).
    'expires_at_ms',
  ],
  commitment: ['commitment_key', 'content', 'content_fingerprint'],
  open_loop: ['subject', 'loop_kind', 'exit_reason', 'content', 'content_fingerprint'],
};

/** Removal bookkeeping columns (written together with the state change). */
export const QLT_D1_REMOVAL_BOOKKEEPING_COLUMNS = ['removed_at_ms', 'removed_by'] as const;

/**
 * Expiry metadata (owner decision OD-D1): claims ONLY. A user may assign
 * or clear `expires_at_ms` on an ACTIVE, currently-relevant claim. The
 * assigned time must lie in the future at assignment. Commitments and
 * open loops NEVER carry expiry metadata and NEVER expire (no column
 * exists; the closed CHECK-free absence is the constraint). Expiry is
 * applied ONLY by the enforcement pass — ordinary reads never
 * transition state from elapsed time, and the assembler remains
 * time-blind exactly as frozen in 07C.
 */
export const QLT_D1_EXPIRY_COLUMN = 'expires_at_ms';
export const QLT_D1_EXPIRY_FAMILIES: readonly ('claim' | 'commitment' | 'open_loop')[] = ['claim'];

// ---------------------------------------------------------------------------
// 2. Enforcement-pass rules (owner decisions OD-D1/OD-D2; MSTR-011 precedent)
// ---------------------------------------------------------------------------

export const QLT_D1_RETENTION_PASS_ACTION_ID = 'act.runRetentionPass';
export const QLT_D1_RETENTION_PASS_SCOPE = 'qlt.retention::pass';

/**
 * The deterministic pass predicate (frozen): a claim is DUE exactly when
 *   status = 'active'
 *   AND retention_state = 'currently-relevant'
 *   AND expires_at_ms IS NOT NULL
 *   AND expires_at_ms <= now(at execution).
 * The pass transitions every DUE claim to `expired` (version + 1,
 * updated_at_ms = now) in ONE transaction and records ONE append-only
 * pass-evidence row (`qlt_retention_pass`) with the examined count, the
 * expired count, and the bounded expired-id list. The pass is idempotent:
 * re-execution converges (already-expired rows are never DUE again), a
 * keyed retry replays the recorded report, and a crash rolls the whole
 * transaction back (never a partial pass). Passes never touch
 * commitments, open loops, proposals, corrections, links, or threads.
 */
export const QLT_D1_PASS_EVIDENCE_TABLE = 'qlt_retention_pass';

// ---------------------------------------------------------------------------
// 3. Governed action / resource inventory (D1 surface identities)
// ---------------------------------------------------------------------------

/** The Lane A retention resource and its ops (all USER authority). */
export const QLT_RETENTION_RESOURCE_ID = 'qlt.retention';
export const QLT_RETENTION_RESOURCE_REVISION = '1';
export const QLT_RETENTION_READ_PERMISSION = 'qlt.retention.read';
export const QLT_RETENTION_WRITE_PERMISSION = 'qlt.retention.write';

export const QLT_RETENTION_MUTATION_OPS: readonly string[] = [
  'removeRecord',
  'setClaimExpiry',
  'runRetentionPass',
];

export const QLT_RETENTION_ACTION_IDS: readonly string[] = [
  'act.queryRetention',
  'act.removeRecord',
  'act.setClaimExpiry',
  'act.runRetentionPass',
];

/** The Lane B conflict resource and its ops (all USER authority). */
export const QLT_CONFLICT_RESOURCE_ID = 'qlt.conflict';
export const QLT_CONFLICT_RESOURCE_REVISION = '1';
export const QLT_CONFLICT_READ_PERMISSION = 'qlt.conflict.read';
export const QLT_CONFLICT_WRITE_PERMISSION = 'qlt.conflict.write';

export const QLT_CONFLICT_MUTATION_OPS: readonly string[] = [
  'amendCommitment',
  'dismissChallenge',
  'resolveChallengeWithAmendment',
];

export const QLT_CONFLICT_ACTION_IDS: readonly string[] = [
  'act.queryConflict',
  'act.amendCommitment',
  'act.dismissChallenge',
  'act.resolveChallengeWithAmendment',
];

/** The complete D1 plan addition: EXACTLY these eight actions. */
export const QLT_D1_ADDED_ACTION_IDS: readonly string[] = [
  ...QLT_RETENTION_ACTION_IDS,
  ...QLT_CONFLICT_ACTION_IDS,
].sort();

/** The D1 removal action identities. */
export const QLT_D1_REMOVE_ACTION_ID = 'act.removeRecord';
export const QLT_D1_SET_EXPIRY_ACTION_ID = 'act.setClaimExpiry';
export const QLT_D1_AMEND_ACTION_ID = 'act.amendCommitment';
export const QLT_D1_DISMISS_CHALLENGE_ACTION_ID = 'act.dismissChallenge';
export const QLT_D1_RESOLVE_CHALLENGE_ACTION_ID = 'act.resolveChallengeWithAmendment';

// ---------------------------------------------------------------------------
// 4. Closed input contracts (field descriptor data; the released
//    boundary parses these at the first fence, surfaces re-validate)
// ---------------------------------------------------------------------------

export interface QltD1ContractFieldSpec {
  readonly name: string;
  readonly kind: 'string' | 'number';
  readonly maxChars?: number;
}

export interface QltD1ContractSpec {
  readonly id: string;
  readonly fields: readonly QltD1ContractFieldSpec[];
  readonly required: readonly string[];
}

const S1 = (name: string, maxChars: number): QltD1ContractFieldSpec => ({
  name,
  kind: 'string',
  maxChars,
});
const N1 = (name: string): QltD1ContractFieldSpec => ({ name, kind: 'number' });

export const QLT_D1_CONTRACT_SPECS: readonly QltD1ContractSpec[] = [
  {
    id: 'qlt.retention.remove.input',
    fields: [S1('recordId', 128), S1('recordKind', 16), N1('expectedVersion')],
    required: ['recordId', 'recordKind'],
  },
  {
    id: 'qlt.retention.claimExpiry.input',
    fields: [S1('claimId', 128), N1('expiresAtMs'), N1('expectedVersion')],
    required: ['claimId'],
  },
  { id: 'qlt.retention.pass.input', fields: [], required: [] },
  {
    id: 'qlt.conflict.amend.input',
    fields: [
      S1('commitmentId', 128),
      S1('statement', 2000),
      S1('reason', 500),
      N1('expectedVersion'),
    ],
    required: ['commitmentId', 'statement'],
  },
  {
    id: 'qlt.conflict.dismiss.input',
    fields: [S1('challengeId', 128), S1('reason', 500), N1('expectedVersion')],
    required: ['challengeId'],
  },
  {
    id: 'qlt.conflict.resolveAmend.input',
    fields: [
      S1('challengeId', 128),
      S1('statement', 2000),
      S1('reason', 500),
      N1('expectedVersion'),
    ],
    required: ['challengeId', 'statement'],
  },
];

// ---------------------------------------------------------------------------
// 5. Stable codes (the 07C vocabularies are unchanged and reused)
// ---------------------------------------------------------------------------

export type QltD1ErrorCode =
  | 'QLT_COMMITMENT_CONFLICT'
  | 'QLT_RETENTION_INVALID_TRANSITION'
  | 'QLT_RETENTION_EXPIRY_INVALID'
  | 'QLT_CHALLENGE_NOT_OPEN';

/** Stable codes carried by the two-fence surfaces (non-echoing). */
export const QLT_D1_SURFACE_ERROR_CODES: readonly string[] = [
  'QLT_COMMITMENT_CONFLICT',
  'QLT_RETENTION_INVALID_TRANSITION',
  'QLT_RETENTION_EXPIRY_INVALID',
  'QLT_CHALLENGE_NOT_OPEN',
  'QLT_INPUT_REJECTED',
];

// ---------------------------------------------------------------------------
// 6. Conflict identification and challenge semantics (Lane B; owner OD-D4)
// ---------------------------------------------------------------------------

/**
 * The closed challenge classification vocabulary. D1 freezes EXACTLY ONE
 * deterministic classification; extending it requires a freeze
 * amendment. `commitment-key-conflict`: a confirmation attempt of a
 * commitment proposal whose `commitmentKey` already carries an ACTIVE,
 * currently-relevant commitment. Natural-language contradiction of
 * commitment TEXT is deliberately NOT a D1 trigger: no deterministic,
 * non-semantic detector exists, and semantic judgment would widen the
 * agent's power. The frozen detector is complete over the DURABLE write
 * surface because every meaning mutation crosses the ceremony choke
 * points; ordinary conversation turns never write meaning at all.
 */
export const QLT_D1_CHALLENGE_CLASSIFICATIONS: readonly string[] = ['commitment-key-conflict'];

/** Challenge lifecycle (closed). */
export const QLT_D1_CHALLENGE_STATUSES = ['open', 'dismissed', 'resolved'] as const;
export type QltD1ChallengeStatus = (typeof QLT_D1_CHALLENGE_STATUSES)[number];

/**
 * Challenge resolutions (closed): `open` rows carry NULL resolution;
 * `dismissed` rows carry `incoming-abandoned` (the user quietly declined
 * the challenge; the incoming proposal remains whatever the user then
 * makes of it through the ordinary ceremony verbs); `resolved` rows
 * carry `existing-amended` (the user resolved the conflict by amending
 * the existing commitment through the frozen amendment operation).
 */
export const QLT_D1_CHALLENGE_RESOLUTIONS: readonly string[] = [
  'incoming-abandoned',
  'existing-amended',
];

/**
 * Challenge semantics (frozen):
 *   - A challenge is created ONLY by the deterministic confirm-time
 *     detector, is attributed to the USER whose confirmation attempt
 *     triggered it (`created_by` GLOB 'agent-*' is refused), and is
 *     idempotent per incoming proposal (UNIQUE `incoming_proposal_id`;
 *     repeated attempts converge on the existing challenge).
 *   - A challenge NEVER blocks, NEVER mutates, and NEVER decides: the
 *     existing commitment keeps its content, key, and version; the
 *     incoming proposal stays `awaiting_decision`; assembly is
 *     unaffected (challenges are epistemically inert — they are never
 *     context candidates, never resolve current-effective meaning, and
 *     never satisfy ceremony preconditions).
 *   - Resolution is USER-ONLY through the two frozen verbs
 *     (dismiss / resolve-with-amendment). There is no auto-resolution,
 *     no timeout, and no agent path.
 *   - A challenge is a JUDGMENT RECORD: the visible, correctable record
 *     of a conflict identification (architecture §14 discipline).
 */
export const QLT_D1_CHALLENGE_TABLE = 'qlt_conflict_challenge';

// ---------------------------------------------------------------------------
// 6b. Dependency re-evaluation (bounded; owner decision OD-D2 context)
// ---------------------------------------------------------------------------

/**
 * What a removal or expiry RE-EVALUATES (frozen, bounded — the first
 * vertical's correction/removal paths, never a general inference
 * engine):
 *   1. PENDING PROPOSALS that target the removed/expired record as a
 *      correction become structurally stale: the confirm-time staleness
 *      re-check refuses them (`target-ineligible`) for BOTH the
 *      `user-removed` state (already true in 07C) and the `expired`
 *      state (mandated by this freeze); the pure presentation twin in
 *      `meaning.ts` mirrors the same rule so the projection never
 *      contradicts the boundary.
 *   2. DIRECT corrections of a subject that is not
 *      `currently-relevant` are refused (`QLT_RECORD_NOT_CURRENT`) —
 *      no ghost derivative may use removed/expired material as its
 *      basis, and no successor may resurrect it (the 07C successor
 *      retention-inheritance rule is unchanged).
 *   3. AMENDMENTS of a removed/expired commitment are refused
 *      (`QLT_RECORD_NOT_CURRENT`); open challenges referencing a
 *      removed commitment stay open and their projections read the
 *      referenced rows' CURRENT state (truthful tombstone rendering;
 *      no hidden auto-transition).
 *   4. NOTHING ELSE changes: no subject-matching inference, no content
 *      rewriting, no transitive lineage rewrites, no deletion. Dependent
 *      records keep their own identity and recorded lineage; the
 *      assembled context excludes the removed/expired source at the
 *      next deterministic assembly; unrelated rows stay byte-identical
 *      (N-D1-5).
 */
export const QLT_D1_DEPENDENCY_REEVALUATION: readonly string[] = [
  'correction proposals targeting a removed/expired record are structurally stale (confirm refuses; projection mirrors)',
  'direct corrections of a non-currently-relevant subject are refused (QLT_RECORD_NOT_CURRENT)',
  'amendments of a removed/expired commitment are refused (QLT_RECORD_NOT_CURRENT)',
  'no semantic inference, no content rewriting, no transitive lineage rewrites, no deletion',
  'unrelated rows stay byte-identical across a removal or expiry',
];

// ---------------------------------------------------------------------------
// 7. Amendment-versus-execution (INV-15; frozen structural distinction)
// ---------------------------------------------------------------------------

/**
 * The amendment of an ACTIVE commitment exists EXACTLY as the explicit,
 * user-initiated `amendCommitment` operation: it creates ONE successor
 * commitment (same key, new content, `supersedes_id` set), moves the
 * predecessor to status `amended` (version + 1), writes ONE immutable
 * `qlt_amendment` judgment row, and links successor --amends-->
 * predecessor in `qlt_source_link` (the frozen 07C relation vocabulary
 * already carries `amends`; no vocabulary change). Stale-version
 * attempts fail `QLT_VERSION_CONFLICT`; removed/expired predecessors are
 * refused `QLT_RECORD_NOT_CURRENT`; keyed retries converge on the
 * original outcome; a different key on a non-active predecessor fails
 * `QLT_RECORD_NOT_CURRENT`.
 *
 * EXECUTION under standing layers — ordinary conversation turns, reads,
 * queries, assembly, corrections of OTHER records, confirmations of
 * unrelated proposals, lifecycle exits — can never produce an amendment
 * row, an `amends` link, or an `amended` status, because no other code
 * path writes them. The distinction is structural, not conventional.
 *
 * Clarification (QLT-010 boundary, frozen): D1 adds NO durable
 * clarification artifact and NO agent capability. A clarification is a
 * conversation-level act: the model already converses, and ordinary
 * turns never durably write meaning (structurally true since 07C), so
 * the INV-15 requirement "ambiguous instruction → explicit
 * clarification, never action" is enforced by the structural no-write
 * property plus the challenge record for the durable-conflict case. If
 * real-use evidence (D4) demands a durable clarification record, that is
 * a NEW freeze amendment — not a silent addition.
 */
export const QLT_D1_AMENDMENT_TABLE = 'qlt_amendment';
export const QLT_D1_AMENDMENT_STATUS = 'recorded' as const;

// ---------------------------------------------------------------------------
// 8. Authority matrix data (D1; test-consumed)
// ---------------------------------------------------------------------------

export const QLT_D1_AUTHORITY_MATRIX = {
  user: {
    remove: true,
    setExpiry: true,
    runRetentionPass: true,
    amendCommitment: true,
    dismissChallenge: true,
    resolveChallenge: true,
    readRetentionViews: true,
    readChallenges: true,
  },
  agent: {
    remove: false,
    setExpiry: false,
    runRetentionPass: false,
    amendCommitment: false,
    dismissChallenge: false,
    resolveChallenge: false,
    readRetentionViews: false,
    readChallenges: false,
  },
} as const;

// ---------------------------------------------------------------------------
// 9. UI truthfulness and non-interruption rules (owner decision OD-D4)
// ---------------------------------------------------------------------------

/**
 * The D1 presentation contract for retention/conflict state. The D1
 * surfaces are QUIET: they appear as ordinary list rows in their own
 * resources and in the existing inspection buckets; they must never be
 * presented through any interrupting mechanism. `QLT_D1_UI_PROHIBITED`
 * enumerates the prohibited presentation effects; `QLT_D1_UI_REQUIRED`
 * the required truthful ones. The D1 implementation wires NO new UI
 * component (the browser suites are therefore not exercised by D1);
 * these rules bind the D2+ UI work and are enforced as contract data
 * now.
 */
export const QLT_D1_UI_PROHIBITED: readonly string[] = [
  'modal dialogs for retention or conflict state',
  'focus theft or window activation',
  'tray or notification auto-open',
  'conversation interruption or forced decision',
  'auto-dismissal or auto-resolution of challenges',
  'silent suppression of removed/expired rows (state must stay inspectable)',
  'presenting removed content as if present (tombstones must be truthful)',
];

export const QLT_D1_UI_REQUIRED: readonly string[] = [
  'challenges render as dismissible list rows in the qlt.conflict surface',
  'removed records render content-free tombstones with their retained identity',
  'expired records render with their expired retention state visible',
  'dependent records re-evaluated by a removal remain truthfully listed',
  'every presented state is readable from durable rows (no invented state)',
];

// ---------------------------------------------------------------------------
// 10. Idempotency, replay, restart, concurrency, zero-effect requirements
// ---------------------------------------------------------------------------

export const QLT_D1_DURABILITY_RULES: readonly string[] = [
  'every mutation is keyed-idempotent: same key + same payload replays the settled outcome; same key + different payload fails the established conflict code',
  'every mutation is optimistic-version-aware: a stale expectedVersion fails QLT_VERSION_CONFLICT with zero effect',
  'every mutation runs in one transaction: a crash leaves the prior state exactly intact (never partial)',
  'the enforcement pass is idempotent and convergent; its report is durable append-only evidence',
  'removal converges: re-removing an already-removed record returns the existing tombstone view (never a second effect)',
  'challenge creation converges per incoming proposal (UNIQUE); a re-attempted conflicting confirm re-raises the same refusal',
  'restart preserves every retention state, expiry, tombstone, challenge, amendment, and pass row byte-identically',
  'reads NEVER write: no query, assembly, list, or inspection path mutates retention state or any D1 family',
];

// ---------------------------------------------------------------------------
// 11. Migration 5 inventory data (new D1 families; the AMENDED meaning
//     family CHECK fragments are data-amended in meaning-contract.ts)
// ---------------------------------------------------------------------------

const D1_ID_COLUMN: QltColumnSpec = { name: 'id', type: 'TEXT', notNull: true };
const D1_VERSION_ONE_COLUMN: QltColumnSpec = {
  name: 'version',
  type: 'INTEGER',
  notNull: true,
  default: '1',
};
const D1_CREATED_COLUMN: QltColumnSpec = { name: 'created_at_ms', type: 'INTEGER', notNull: true };
const D1_UPDATED_COLUMN: QltColumnSpec = { name: 'updated_at_ms', type: 'INTEGER', notNull: true };
const D1_EFFECTIVE_COLUMN: QltColumnSpec = {
  name: 'effective_at_ms',
  type: 'INTEGER',
  notNull: true,
};
const D1_RETENTION_COLUMN: QltColumnSpec = {
  name: 'retention_state',
  type: 'TEXT',
  notNull: true,
  default: "'currently-relevant'",
};
const D1_RETENTION_CHECK_3 = "retention_state IN ('currently-relevant','expired','user-removed')";
const D1_ACTOR_BY = (column: string) => `(${column} IS NULL) OR (${column} GLOB 'actor-*')`;

export const QLT_D1_NEW_TABLES = [
  'qlt_amendment',
  'qlt_conflict_challenge',
  'qlt_retention_pass',
] as const;

export const QLT_D1_SCHEMA_INVENTORY: Readonly<
  Record<(typeof QLT_D1_NEW_TABLES)[number], QltTableSpec>
> = {
  qlt_amendment: {
    columns: [
      D1_ID_COLUMN,
      D1_VERSION_ONE_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'commitment_id', type: 'TEXT', notNull: true },
      { name: 'amendment_key', type: 'TEXT', notNull: true },
      { name: 'prior_content_fingerprint', type: 'TEXT', notNull: true },
      { name: 'reason', type: 'TEXT', notNull: false },
      { name: 'content', type: 'TEXT', notNull: true },
      { name: 'content_fingerprint', type: 'TEXT', notNull: true },
      { name: 'amended_by', type: 'TEXT', notNull: true },
      { name: 'successor_id', type: 'TEXT', notNull: true },
      { name: 'source_thread_id', type: 'TEXT', notNull: false },
      D1_CREATED_COLUMN,
      D1_UPDATED_COLUMN,
      D1_EFFECTIVE_COLUMN,
      D1_RETENTION_COLUMN,
    ],
    indexes: [
      {
        name: 'uq_qlt_amendment_commitment_key',
        columns: ['commitment_id', 'amendment_key'],
        unique: true,
      },
      {
        name: 'idx_qlt_amendment_commitment',
        columns: ['commitment_id', 'created_at_ms'],
        unique: false,
      },
    ],
    foreignKeys: [
      { column: 'commitment_id', targetTable: 'qlt_commitment', targetColumn: 'id' },
      { column: 'successor_id', targetTable: 'qlt_commitment', targetColumn: 'id' },
      { column: 'source_thread_id', targetTable: 'qlt_thread', targetColumn: 'id' },
    ],
    requiredCheckFragments: [
      "status = 'recorded'",
      '(version = 1)',
      'length(prior_content_fingerprint) = 64',
      'length(content_fingerprint) = 64',
      "amended_by GLOB 'actor-*'",
      D1_RETENTION_CHECK_3,
    ],
  },
  qlt_conflict_challenge: {
    columns: [
      D1_ID_COLUMN,
      D1_VERSION_ONE_COLUMN,
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'classification', type: 'TEXT', notNull: true },
      { name: 'existing_commitment_id', type: 'TEXT', notNull: true },
      { name: 'incoming_proposal_id', type: 'TEXT', notNull: true },
      { name: 'resolution', type: 'TEXT', notNull: false },
      { name: 'created_by', type: 'TEXT', notNull: true },
      { name: 'resolved_by', type: 'TEXT', notNull: false },
      { name: 'reason', type: 'TEXT', notNull: false },
      { name: 'thread_id', type: 'TEXT', notNull: true },
      D1_CREATED_COLUMN,
      D1_UPDATED_COLUMN,
      { name: 'resolved_at_ms', type: 'INTEGER', notNull: false },
      D1_RETENTION_COLUMN,
    ],
    indexes: [
      {
        name: 'uq_qlt_conflict_challenge_proposal',
        columns: ['incoming_proposal_id'],
        unique: true,
      },
      {
        name: 'idx_qlt_conflict_challenge_thread',
        columns: ['thread_id', 'status'],
        unique: false,
      },
    ],
    foreignKeys: [
      {
        column: 'existing_commitment_id',
        targetTable: 'qlt_commitment',
        targetColumn: 'id',
      },
      { column: 'incoming_proposal_id', targetTable: 'qlt_proposal', targetColumn: 'id' },
      { column: 'thread_id', targetTable: 'qlt_thread', targetColumn: 'id' },
    ],
    requiredCheckFragments: [
      "status IN ('open','dismissed','resolved')",
      "classification IN ('commitment-key-conflict')",
      "created_by GLOB 'actor-*'",
      D1_ACTOR_BY('resolved_by'),
      "((status = 'open') = (resolution IS NULL))",
      "((status = 'open') = (resolved_at_ms IS NULL))",
      D1_RETENTION_CHECK_3,
    ],
  },
  qlt_retention_pass: {
    columns: [
      D1_ID_COLUMN,
      { name: 'ran_by', type: 'TEXT', notNull: true },
      { name: 'examined', type: 'INTEGER', notNull: true },
      { name: 'expired_count', type: 'INTEGER', notNull: true },
      { name: 'expired_ids', type: 'TEXT', notNull: true },
      D1_CREATED_COLUMN,
    ],
    indexes: [{ name: 'idx_qlt_retention_pass_time', columns: ['created_at_ms'], unique: false }],
    foreignKeys: [],
    requiredCheckFragments: [
      "ran_by GLOB 'actor-*'",
      '(examined >= 0)',
      '(expired_count >= 0)',
      '(length(expired_ids) <= 4096)',
    ],
  },
};

/**
 * The AMENDED meaning-family fragment data (migration 5 rebuilds the six
 * meaning tables so their CHECKs match; the full per-table inventory in
 * `meaning-contract.ts` QLT_MEANING_SCHEMA_INVENTORY is data-amended by
 * the freeze commit to the post-migration-5 shape). These fragments are
 * the D1-specific additions the introspection gates assert:
 *   - the 3-state retention CHECK everywhere;
 *   - the tombstone content-free CHECK on the three subject families;
 *   - the expiry columns/checks on claims;
 *   - the removal bookkeeping columns.
 */
export const QLT_D1_AMENDED_CHECK_FRAGMENTS: readonly string[] = [
  D1_RETENTION_CHECK_3,
  "(retention_state <> 'user-removed') OR (content IS NULL AND content_fingerprint IS NULL)",
  "(retention_state <> 'user-removed') OR (subject IS NULL)",
  "(retention_state <> 'user-removed') OR (commitment_key IS NULL)",
  "(retention_state <> 'user-removed') OR (exit_reason IS NULL)",
  '(expires_at_ms IS NULL) OR (expires_at_ms >= 0)',
  "(expires_at_ms IS NULL) OR (retention_state IN ('currently-relevant','expired'))",
  "(removed_at_ms IS NULL) OR (retention_state = 'user-removed')",
  '((removed_by IS NULL) = (removed_at_ms IS NULL))',
];

/** Migration identity (frozen; forward-only; one transaction). */
export const QLT_D1_MIGRATION_VERSION = 5;
export const QLT_D1_MIGRATION_NAME = 'qlt-retention-conflict-foundations';

/**
 * Legacy-copy rule (frozen): the rebuild COPY nulls the tombstone
 * columns of any legacy `user-removed` row (07C had no write path to
 * that state; the defensive copy makes even a hand-crafted legacy row
 * satisfy the new content-free constraint without failing the
 * migration). All other rows copy unchanged.
 */
export const QLT_D1_MIGRATION_COPY_RULE =
  'copy rows unchanged except: user-removed rows get their tombstone columns nulled';

// ---------------------------------------------------------------------------
// 12. Negative-control matrix (the gates implement EVERY entry; none may
//     be vacuous — each asserts a real refusal/absence/invariance)
// ---------------------------------------------------------------------------

export interface QltD1NegativeControl {
  readonly id: string;
  readonly lane: 'A' | 'B';
  readonly statement: string;
}

export const QLT_D1_NEGATIVE_CONTROLS: readonly QltD1NegativeControl[] = [
  {
    id: 'N-D1-1',
    lane: 'A',
    statement:
      'removed or expired meaning never reaches context assembly (candidate scan excludes it; eligible control records remain)',
  },
  {
    id: 'N-D1-2',
    lane: 'A',
    statement:
      'reads never cause expiry or mutation: queries, assembly reads, and inspection lists leave every retention view byte-identical',
  },
  {
    id: 'N-D1-3',
    lane: 'A',
    statement:
      'time passage alone causes no effect: an assigned expiry reached by the clock changes nothing until the pass runs',
  },
  {
    id: 'N-D1-4',
    lane: 'A',
    statement:
      'tombstones contain no removed content: the storage row and every projection carry NULL content fields after removal',
  },
  {
    id: 'N-D1-5',
    lane: 'A',
    statement:
      'dependency re-evaluation is bounded and side-effect-free: removal makes dependent corrections structurally stale while unrelated records stay byte-identical',
  },
  {
    id: 'N-D1-6',
    lane: 'A',
    statement:
      'agent attempts to remove, expire, or run the pass fail closed with zero effect (identity fence + plan inventory)',
  },
  {
    id: 'N-D1-7',
    lane: 'A',
    statement:
      'retry convergence: same-key removal/pass retries replay the original outcome; no duplicate effects',
  },
  {
    id: 'N-D1-8',
    lane: 'A',
    statement:
      'restart preservation: close and reopen the store; every retention state, expiry, tombstone, and pass row survives',
  },
  {
    id: 'N-D3-1',
    lane: 'B',
    statement:
      'conflicts never overwrite commitments: the conflicting confirm is refused, the challenge is recorded, and the existing commitment keeps content/key/version',
  },
  {
    id: 'N-D3-2',
    lane: 'B',
    statement:
      'challenge convergence: a repeated conflicting confirm re-raises the refusal against the SAME challenge (no duplicates)',
  },
  {
    id: 'N-D3-3',
    lane: 'B',
    statement:
      'stale-version amendment refusal: a wrong expectedVersion (and a removed/expired predecessor) fails with zero effect',
  },
  {
    id: 'N-D3-4',
    lane: 'B',
    statement:
      'execution events never mistaken for amendments: a full ceremony run (confirm/retire/release/correct) writes ZERO amendment rows and never produces an amended status',
  },
  {
    id: 'N-D3-5',
    lane: 'B',
    statement:
      'challenge proposals remain epistemically inert: an open challenge changes nothing in the candidate pool, current-effective resolution, or assembly',
  },
  {
    id: 'N-D3-6',
    lane: 'B',
    statement:
      'agent attempts to amend, dismiss, resolve, or confirm fail closed with zero effect (identity fence + plan inventory)',
  },
  {
    id: 'N-D3-7',
    lane: 'B',
    statement:
      'conflicting-key direct refusal: direct creation of a second active commitment on the same key fails with a stable code (no silent overwrite)',
  },
  {
    id: 'N-D3-8',
    lane: 'B',
    statement:
      'challenge/amendment lifecycle integrity: dismissal and resolve-with-amendment follow the closed transitions; invalid transitions fail QLT_CHALLENGE_NOT_OPEN',
  },
  {
    id: 'N-D3-9',
    lane: 'B',
    statement:
      'quiet non-blocking presentation: challenge/retention projections carry no interrupting presentation effect and the frozen UI rule data prohibits them',
  },
];

// ---------------------------------------------------------------------------
// 13. Lane ownership and integration order (frozen)
// ---------------------------------------------------------------------------

export const QLT_D1_LANE_OWNERSHIP: readonly string[] = [
  'FREEZE (shared, amended once): d1-contract.ts (new), meaning-contract.ts (data amendment), migrations.ts (migration 5), definition.ts (action registry), composition.ts (wiring), verify-q2/q4/q5/q6 re-pins',
  'Lane A owns: retention-store.ts, retention-surface.ts, the retention-half of the sqlite/composition/definition wiring, test/d1-retention.test.ts, scripts/verify-d1.mjs',
  'Lane B owns: conflict-store.ts, conflict-surface.ts, the ceremony-actions confirm-time conflict hook, the conflict-half of the wiring, test/d3-conflict.test.ts, scripts/verify-d3.mjs',
  'integration order: freeze → schema foundation (migration 5) → Lane A → Lane B → gates → documentation; lanes execute SEQUENTIALLY in this delivery (one implementer; no isolated parallel workers were available — reported truthfully)',
];

// ---------------------------------------------------------------------------
// 14. D2-facing interfaces (declared now; D2 itself remains NOT BEGUN)
// ---------------------------------------------------------------------------

export const QLT_D1_D2_FACING: readonly string[] = [
  'removeRecord tombstone views (content-free, identity-preserving) are the unit D2 conversation-deletion cascades will request',
  'the enforcement-pass evidence family (qlt_retention_pass) is the pattern D2 export/deletion evidence must follow',
  'the 3-state retention vocabulary and CHECKs are the storage contract D2 export must respect (expired content retained; removed content absent)',
  'thread deletion, deep purge, export, and cross-store reconciliation are D2 scope and are deliberately NOT defined here',
];

// ---------------------------------------------------------------------------
// 15. Explicit exclusions (frozen; violating any requires a new freeze)
// ---------------------------------------------------------------------------

export const QLT_D1_EXCLUSIONS: readonly string[] = [
  'no deep purge (D2)',
  'no export (D2)',
  'no conversation/thread deletion (D2)',
  'no cross-store reconciliation (D2)',
  'no MSTR-012 real-use execution and no provider access (D4)',
  'no independent audit or closure (D5)',
  'no Stage 07E work',
  'no project-scoped conversations, autonomous initiative, ingestion, learning, or delegation',
  'no new agent capability, no widened agent proposal vocabulary, no durable clarification artifact (frozen boundary; revisit only by amendment with D4 evidence)',
  'no automatic expiry of commitments or open loops, ever (owner decision OD-D1)',
  'no un-expiry and no un-removal path',
];
