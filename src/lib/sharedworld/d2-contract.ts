/**
 * Quellight Stage 07D Phase D2 — the governed deletion, export, and
 * cross-store reconciliation contract data.
 *
 * FROZEN CONTRACT DATA (safety contract
 * `quellight.stage07d.d2.safety-contract@1`, committed before any
 * executable D2 change). This module mirrors that contract exactly:
 * closed vocabularies, stable non-echoing codes, the deep-purge scope
 * order, the export identity, and the permanent negative-control matrix
 * N-D2-1..N-D2-18. The agent capability envelope is UNCHANGED — D2 adds
 * NO plan action; its operations are user-only conversation-lifecycle
 * services and every entry point refuses `agent-*` identities.
 *
 * No D1a frozen data is reinterpreted here: the D1 retention, conflict,
 * and amendment machinery is consumed unchanged.
 */

// ---------------------------------------------------------------------------
// 1. Identity
// ---------------------------------------------------------------------------

/** The D2 safety-contract identity (the amendment of record for D2). */
export const QLT_D2_SAFETY_CONTRACT_ID = 'quellight.stage07d.d2.safety-contract@1';

/** The versioned user-export schema identity. */
export const QLT_D2_EXPORT_SCHEMA_ID = 'quellight.user-export@1';

// ---------------------------------------------------------------------------
// 2. Deletion vocabulary (closed)
// ---------------------------------------------------------------------------

/**
 * The two explicit user choices. `conversation-only` is the DEFAULT and
 * preserves every confirmed Shared World meaning record;
 * `conversation-and-originating-meaning` affects only records proven to
 * originate from the selected conversation (recorded provenance).
 */
export const QLT_D2_DELETION_MODES = [
  'conversation-only',
  'conversation-and-originating-meaning',
] as const;
export type QltD2DeletionMode = (typeof QLT_D2_DELETION_MODES)[number];

/** The closed deletion-operation lifecycle (safety contract §2). */
export const QLT_D2_DELETION_STATUSES = ['planned', 'completed', 'canceled', 'incomplete'] as const;
export type QltD2DeletionStatus = (typeof QLT_D2_DELETION_STATUSES)[number];

/** The cross-store steps receipted on the product deletion row. */
export const QLT_D2_DELETION_STEPS = [
  'meaning-removal',
  'conversation-domain',
  'memory-store',
] as const;
export type QltD2DeletionStep = (typeof QLT_D2_DELETION_STEPS)[number];

// ---------------------------------------------------------------------------
// 3. Stable codes (non-echoing; no store content in any error)
// ---------------------------------------------------------------------------

export type QltD2ErrorCode =
  | 'QLT_DELETION_CONFIRMATION_REQUIRED'
  | 'QLT_DELETION_MODE_INVALID'
  | 'QLT_DELETION_SCOPE_CONFLICT'
  | 'QLT_DELETION_NOT_CANCELLABLE'
  | 'QLT_DELETION_INCOMPLETE'
  | 'QLT_DELETION_IDENTITY_REFUSED'
  | 'QLT_DELETION_THREAD_MISSING'
  | 'QLT_PURGE_NOT_AVAILABLE'
  | 'QLT_PURGE_CONFIRMATION_INVALID'
  | 'QLT_PURGE_INCOMPLETE'
  | 'QLT_EXPORT_FAILED'
  | 'QLT_EXPORT_IDENTITY_REFUSED';

export const QLT_D2_ERROR_CODES: readonly string[] = [
  'QLT_DELETION_CONFIRMATION_REQUIRED',
  'QLT_DELETION_MODE_INVALID',
  'QLT_DELETION_SCOPE_CONFLICT',
  'QLT_DELETION_NOT_CANCELLABLE',
  'QLT_DELETION_INCOMPLETE',
  'QLT_DELETION_IDENTITY_REFUSED',
  'QLT_DELETION_THREAD_MISSING',
  'QLT_PURGE_NOT_AVAILABLE',
  'QLT_PURGE_CONFIRMATION_INVALID',
  'QLT_PURGE_INCOMPLETE',
  'QLT_EXPORT_FAILED',
  'QLT_EXPORT_IDENTITY_REFUSED',
];

/**
 * The reason attributed to pending proposals/corrections withdrawn by the
 * conversation-plus-meaning deletion (user-attributed; deterministic).
 */
export const QLT_D2_WITHDRAWAL_REASON = 'conversation-deleted';

// ---------------------------------------------------------------------------
// 4. Deep-purge scope (the deterministic, FK-driven removal order)
// ---------------------------------------------------------------------------

/**
 * The closed purge step order (one transaction, in this order):
 * challenges tied to the conversation's rows, amendments tied to its
 * commitments, its corrections, source links touching purged rows, its
 * proposals, its originating subject tombstones, its context-assembly
 * evidence rows, the conversation-link row, the thread row. The deletion
 * row, the purge receipt, the VICT governance receipts, and the retention
 * passes are the preserved minimum content-free evidence.
 */
export const QLT_D2_PURGE_STEP_ORDER = [
  'challenges',
  'amendments',
  'corrections',
  'source-links',
  'proposals',
  'originating-tombstones',
  'assembly-evidence',
  'conversation-link',
  'thread',
] as const;
export type QltD2PurgeStep = (typeof QLT_D2_PURGE_STEP_ORDER)[number];

/** The explicit high-intent confirmation token a purge request must carry. */
export const QLT_D2_PURGE_CONFIRMATION_TOKEN = 'purge';

// ---------------------------------------------------------------------------
// 5. Export disclosure (the residue and forbidden-claims text classes)
// ---------------------------------------------------------------------------

/**
 * The categories structurally EXCLUDED from the export and disclosed in
 * its disclosure block (safety contract §6).
 */
export const QLT_D2_EXPORT_EXCLUDED_CATEGORIES: readonly string[] = [
  'credentials and provider headers',
  'capability and authority structures (the compiled action plan)',
  'operator configuration and actor tokens',
  'store file paths and temporary paths',
  'VICT internal traces, registry, and ledger internals',
  'context-injection defense framing (record content is included)',
];

/**
 * The claims the system is FORBIDDEN to make about deletion, purge, and
 * export — disclosed verbatim-in-substance by the purge UI and in every
 * export's disclosure block (safety contract §5).
 */
export const QLT_D2_FORBIDDEN_CLAIMS: readonly string[] = [
  'Deletion or purge erases Git history, operating-system or file-level backups, uncontrolled external copies, provider-side systems, or anything outside this application\u2019s own stores.',
  'Any erasure performed here is "secure erasure".',
  'Deletion across Quellight and VICT stores is atomic.',
  'An export proves deletion or completeness of systems outside its declared scope.',
];

/**
 * What may still retain content after a completed deep purge (truthful
 * residue disclosure).
 */
export const QLT_D2_RESIDUE_DISCLOSURE: readonly string[] = [
  'Git history of this repository',
  'operating-system and file-level backups',
  'uncontrolled external copies',
  'provider-side systems',
  'VICT governance receipts (content-free identifiers only)',
  'this application\u2019s deletion, purge, and retention-pass evidence rows (content-free)',
];

// ---------------------------------------------------------------------------
// 6. Bounded-export limits (bounded generation; never unbounded)
// ---------------------------------------------------------------------------

export const QLT_D2_EXPORT_LIMITS = {
  /** Maximum conversations embedded (thread-scoped governed exports). */
  conversations: 200,
  /** Maximum rows per meaning family section. */
  perFamily: 2000,
  /** Maximum evidence rows (passes) embedded. */
  passes: 500,
  /** Maximum deletion receipt rows embedded. */
  deletions: 500,
} as const;

// ---------------------------------------------------------------------------
// 7. Authority
// ---------------------------------------------------------------------------

/**
 * The user-actor pattern every D2 entry point enforces (defense in
 * depth; no agent ingress exists at all). Identical discipline to the
 * D1 stores.
 */
export const QLT_D2_USER_ACTOR_PATTERN = /^actor-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

// ---------------------------------------------------------------------------
// 8. The permanent negative-control matrix (verify:d2 implements these)
// ---------------------------------------------------------------------------

export interface QltD2NegativeControl {
  readonly id: string;
  readonly must: string;
}

export const QLT_D2_NEGATIVE_CONTROLS: readonly QltD2NegativeControl[] = [
  {
    id: 'N-D2-1',
    must: 'the preview exactly matches the later governed effect (scopes and counts)',
  },
  { id: 'N-D2-2', must: 'cancellation produces zero effect (store bytes unchanged)' },
  {
    id: 'N-D2-3',
    must: 'the agent identity is refused for every destructive and export operation',
  },
  {
    id: 'N-D2-4',
    must: 'conversation-only deletion preserves every Shared World meaning row byte-identically',
  },
  {
    id: 'N-D2-5',
    must: 'plus-meaning deletion affects only proven originating records; cross-thread, global, and out-of-thread successor records are protected',
  },
  {
    id: 'N-D2-6',
    must: 'normal removal yields content-free tombstones and removed content cannot leak through inspection, context, lineage, errors, logs, or export',
  },
  {
    id: 'N-D2-7',
    must: 'deep purge requires a distinct explicit confirmation and a completed deletion; a wrong token refuses with zero effect',
  },
  { id: 'N-D2-8', must: 'retry and same-key replay never duplicate effects' },
  {
    id: 'N-D2-9',
    must: 'conflicting scope requests and stale versions fail with zero partial effect',
  },
  {
    id: 'N-D2-10',
    must: 'simulated failure at every cross-store boundary yields a truthful incomplete/reconciliation state and never a premature complete',
  },
  {
    id: 'N-D2-11',
    must: 'restart recovery converges without broadening deletion (receipt-driven; the fence holds)',
  },
  {
    id: 'N-D2-12',
    must: 'concurrent delete/export/read activity remains truthful and deterministic per section',
  },
  {
    id: 'N-D2-13',
    must: 'the export is complete for its declared scope, deterministic, bounded, versioned, credential-clean, and fails closed on induced failure',
  },
  {
    id: 'N-D2-14',
    must: 'unknown fields, forged actor/thread/scope identities, prototype keys, and hostile filenames fail closed',
  },
  {
    id: 'N-D2-15',
    must: 'no deletion primitive can target the repository, the operator directory, a parent directory, or an arbitrary filesystem path',
  },
  { id: 'N-D2-16', must: 'existing D1/D3 behavior remains intact through the new wiring' },
  {
    id: 'N-D2-17',
    must: 'deleted conversations refuse new turns across restart (the fence holds)',
  },
  {
    id: 'N-D2-18',
    must: 'purge leaves no conversation content in any Shared World table (full-store canary scan; only permitted evidence remains)',
  },
];
