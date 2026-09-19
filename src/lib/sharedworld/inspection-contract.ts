/**
 * QUELLIGHT STAGE 07C PHASE Q5 — SHARED WORLD INSPECTION CONTRACT (FROZEN
 * in docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md).
 *
 * This module is the FROZEN, declarative Q5 inspection contract shared by
 * every Q5 lane. It contains contract DATA and TYPES only — the resource
 * identity, the closed query-op vocabulary and parameters, bucket
 * definitions, bounds, usage states, origin labels, stable codes, the
 * read-only authority data, and structural invariants — never executable
 * query handling (the inspection surface lives in
 * `inspection-surface.ts` and conforms to THIS data).
 *
 * Ownership: frozen by the Phase 0 contract-freeze commit; NO Q5 lane may
 * edit this file. A material change requires the freeze amendment
 * procedure (freeze §19). No consuming implementation shares the freeze
 * commit.
 *
 * Authority basis: the inspection resource is USER-FACING READ-ONLY
 * surface exposed ONLY through the released read boundary
 * (`app.data.query` via `/api/act`). It gives the AGENT nothing: the
 * capability envelope remains EXACTLY `qlt.proposal.draft@1`; no
 * read/list/search capability enters the agent surface (freeze §0/§6).
 */

// ---------------------------------------------------------------------------
// Resource identity (freeze §6)
// ---------------------------------------------------------------------------

/** The ONE bounded user-facing inspection resource. */
export const QLT_INSPECTION_RESOURCE_ID = 'qlt.inspection';
export const QLT_INSPECTION_RESOURCE_REVISION = '1';
export const QLT_INSPECTION_QUERY_ACTION_ID = 'act.queryInspection';

// ---------------------------------------------------------------------------
// Closed query-op vocabulary and parameters (freeze §6)
// ---------------------------------------------------------------------------

/** The EXACTLY five inspection query ops. */
export const QLT_INSPECTION_QUERY_OPS: readonly string[] = [
  'listRecords',
  'getRecord',
  'listTurns',
  'getTurn',
  'getPolicy',
];

/** The declared filter keys of the inspection query (closed set). */
export const QLT_INSPECTION_FILTER_FIELDS: readonly string[] = [
  'query',
  'bucket',
  'threadId',
  'kind',
  'recordId',
  'recordKind',
  'turnId',
  'limit',
  'offset',
];

/** Deterministic record buckets (freeze §6). */
export const QLT_INSPECTION_BUCKETS: readonly string[] = ['pending', 'current', 'history'];

/**
 * The kind filter values: the three record families plus proposals.
 * (`correction` rows are lineage evidence, surfaced inside getRecord and
 * History relationships — never a standalone listable kind.)
 */
export const QLT_INSPECTION_KIND_FILTERS: readonly string[] = [
  'claim',
  'commitment',
  'open_loop',
  'proposal',
];

/** Pagination bounds (freeze §6): deterministic, bounded. */
export const QLT_INSPECTION_LIST_DEFAULT_LIMIT = 50;
export const QLT_INSPECTION_LIST_MAX_LIMIT = 100;

/** Deterministic ordering everywhere in inspection. */
export const QLT_INSPECTION_ORDERING = {
  field: 'updatedAt',
  direction: 'desc',
  tieBreak: 'id asc',
} as const;

/** The bounded chooser size of the Used-for-reply turn list (UI-side bound). */
export const QLT_INSPECTION_TURN_CHOOSER_LIMIT = 20;

// ---------------------------------------------------------------------------
// Usage states for a historical turn (freeze §7) — exact, exhaustive
// ---------------------------------------------------------------------------

/**
 * How a past turn's memory usage is reported (RECORDED evidence only;
 * never recomputed):
 *   - `used`: the assembly is `complete` with N ≥ 1 selected records;
 *   - `none`: the assembly is `empty` and the applied mode was NOT off
 *     and no `scope-excluded` evidence exists ("no eligible memory");
 *   - `scope-empty`: the assembly is `empty` (or would be) and recorded
 *     `scope-excluded` evidence exists — memory existed but was excluded
 *     by the selected scope;
 *   - `off`: the applied Memory Mode was `off` — memory was intentionally
 *     disabled, NEVER reported as "no memory existed";
 *   - `unavailable`: the assembly is `failed` (assembly unavailable);
 *   - `unrecorded`: no durable assembly evidence exists for that turn.
 */
export const QLT_INSPECTION_USAGE_STATES: readonly string[] = [
  'used',
  'none',
  'scope-empty',
  'off',
  'unavailable',
  'unrecorded',
];

/** The human strings for the usage states (Used-for-reply; freeze §3.4). */
export const QLT_INSPECTION_USAGE_LABELS: Readonly<Record<string, string>> = {
  used: 'Memory was used for this reply.',
  none: 'No eligible memory existed for this reply.',
  'scope-empty':
    'Memory existed but was excluded: this reply used only memory from this conversation.',
  off: 'Memory was off for this reply.',
  unavailable: 'Memory was unavailable for this reply.',
  unrecorded: 'No memory evidence was recorded for this reply.',
};

// ---------------------------------------------------------------------------
// Origin labels (freeze §3.2/§3.4) — derived server-side from sourceThreadId
// ---------------------------------------------------------------------------

export const QLT_INSPECTION_ORIGIN_LABELS = {
  current: 'this conversation',
  other: 'another conversation',
  global: 'saved without a conversation',
} as const;

export type QltInspectionOrigin = keyof typeof QLT_INSPECTION_ORIGIN_LABELS;

/** The tombstone states for historical selected content (freeze §3.4). */
export const QLT_INSPECTION_TOMBSTONES: readonly string[] = ['unavailable', 'removed'];

// ---------------------------------------------------------------------------
// Stable codes (freeze §6) — closed, non-echoing
// ---------------------------------------------------------------------------

export const QLT_INSPECTION_ERROR_CODES: readonly string[] = [
  'QLT_INSPECTION_UNSUPPORTED_QUERY',
  'QLT_INSPECTION_MISSING_PARAM',
  'QLT_INSPECTION_RECORD_MISSING',
  'QLT_INSPECTION_TURN_MISSING',
];

// ---------------------------------------------------------------------------
// Read permission identity (the agent never holds any of these)
// ---------------------------------------------------------------------------

export const QLT_INSPECTION_READ_PERMISSION = 'qlt.inspection.read';
export const QLT_MEMORY_POLICY_WRITE_PERMISSION = 'qlt.memory-policy.write';

// ---------------------------------------------------------------------------
// Authority data and structural invariants (freeze §17)
// ---------------------------------------------------------------------------

/** What the inspection surface may never contain (freeze §6). */
export const QLT_INSPECTION_NEVER_CONTAINS: readonly string[] = [
  'system prompts or instruction text',
  'capability schemas or tool declarations',
  'the rendered context block or its framing markers',
  'the hidden per-turn context envelope',
  'provider configuration or endpoints',
  'credentials or authentication material',
  'raw model input beyond the durable transcript the user already sees',
];

/** Structural assertions permanently true of the inspection path (freeze §17). */
export const QLT_Q5_INSPECTION_INVARIANTS: readonly string[] = [
  'inspection is read-only: no inspection op creates a durable effect',
  'the resolved user is server-derived; no client-selected actor field exists',
  'agent identities and agent-surface attempts fail closed with zero effect',
  'every list is deterministically ordered and bounded (no unbounded World dump)',
  'Used-for-reply reads recorded evidence and never recomputes a historical turn',
  'technical identifiers and fingerprints are hidden behind the Details disclosure',
  'bounded exclusion evidence is disclosed as bounded (never claimed complete)',
  'a later-corrected selected record shows the historical version, never the successor',
  'unavailable or retention-removed content renders a truthful tombstone',
  'routes and components perform no direct SQLite access',
  'the existing thread-scoped act.queryMemory surface is unchanged',
];
