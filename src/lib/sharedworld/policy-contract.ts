/**
 * QUELLIGHT STAGE 07C PHASE Q5 — MEMORY MODE POLICY CONTRACT (FROZEN in
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md).
 *
 * This module is the FROZEN, declarative Q5 policy contract shared by
 * every Q5 lane. It contains contract DATA and TYPES only — the owner
 * decision Q5-OD-1 identities, the closed mode vocabulary, the migration 4
 * schema inventory, the per-turn applied-policy evidence shape, stable
 * codes, transparency strings, authority data, and structural invariants —
 * never executable policy resolution (the resolver/store live in
 * `memory-policy.ts` and conform to THIS data).
 *
 * Ownership: frozen by the Phase 0 contract-freeze commit; NO Q5 lane may
 * edit this file. A material change requires the freeze amendment
 * procedure (freeze §19). No consuming implementation shares the freeze
 * commit.
 *
 * Future-scope seam (freeze §16): this policy is a PRODUCT DEFAULT. A
 * future project-scope mechanism must arrive as an additive migration plus
 * a resolver extension that resolves against this durable default and
 * records the resolved result in per-turn evidence — never by rewriting
 * existing global-policy history and never by adding project fields,
 * tables, selectors, or placeholders now (explicitly excluded).
 */

// ---------------------------------------------------------------------------
// Identity (owner decision Q5-OD-1; freeze §2)
// ---------------------------------------------------------------------------

/** The stable identity of the ONE durable global Memory Mode policy. */
export const QLT_MEMORY_MODE_POLICY_ID = 'qlt.memory-mode@1';

/** The migration that creates the policy families (additive, forward-only). */
export const QLT_MEMORY_MODE_MIGRATION = {
  version: 4,
  name: 'qlt-memory-mode-policy',
} as const;

// ---------------------------------------------------------------------------
// The closed Memory Mode vocabulary (Q5-OD-1; freeze §2)
// ---------------------------------------------------------------------------

/**
 * The EXACTLY three user-facing choices and their stable internal
 * identities:
 *   - `across-conversations` (DEFAULT): Q4 behavior preserved exactly
 *     (layers current-thread → global → other-thread, frozen ordering
 *     and budgets);
 *   - `per-conversation`: only the current-conversation layer is
 *     eligible; global/threadless and other-conversation records are
 *     excluded with truthful bounded `scope-excluded` evidence;
 *   - `off`: zero Shared World memory injection; truthful immutable
 *     applied-policy evidence is still recorded and a historical
 *     Used-for-reply view reports "memory was intentionally off".
 */
export const QLT_MEMORY_MODES: readonly QltMemoryMode[] = [
  'across-conversations',
  'per-conversation',
  'off',
];

export type QltMemoryMode = 'across-conversations' | 'per-conversation' | 'off';

/** The default mode (durable product default; seeded lazily, deterministically). */
export const QLT_MEMORY_MODE_DEFAULT: QltMemoryMode = 'across-conversations';

/** The user-facing labels, in the frozen display order (default first). */
export const QLT_MEMORY_MODE_LABELS: Readonly<Record<QltMemoryMode, string>> = {
  'across-conversations': 'Across conversations',
  'per-conversation': 'Within each conversation only',
  off: 'Memory off',
};

/**
 * The human explanation rendered with the control. The control always
 * states that the choice applies to ALL conversations (freeze §2/§4).
 */
export const QLT_MEMORY_MODE_SCOPE_DISCLOSURE = 'This setting applies to all conversations.';

// ---------------------------------------------------------------------------
// Migration 4 schema inventory (freeze §11) — declarative data only
// ---------------------------------------------------------------------------

/** The durable product-default policy row (singleton). */
export const QLT_MEMORY_POLICY_TABLE = 'qlt_memory_policy';

export const QLT_MEMORY_POLICY_SCHEMA_INVENTORY: readonly {
  readonly name: string;
  readonly type: string;
  readonly notNull: boolean;
  readonly default?: string | number;
}[] = [
  { name: 'id', type: 'TEXT', notNull: true },
  { name: 'policy_id', type: 'TEXT', notNull: true },
  { name: 'mode', type: 'TEXT', notNull: true },
  { name: 'revision', type: 'INTEGER', notNull: true },
  { name: 'updated_by', type: 'TEXT', notNull: true },
  { name: 'created_at_ms', type: 'INTEGER', notNull: true },
  { name: 'updated_at_ms', type: 'INTEGER', notNull: true },
];

/** The singleton row identity and its closed CHECK. */
export const QLT_MEMORY_POLICY_ROW_ID = 'qlt-memory-policy-default';

/** The immutable per-turn applied-policy evidence family. */
export const QLT_TURN_MEMORY_POLICY_TABLE = 'qlt_turn_memory_policy';

export const QLT_TURN_MEMORY_POLICY_SCHEMA_INVENTORY: readonly {
  readonly name: string;
  readonly type: string;
  readonly notNull: boolean;
  readonly default?: string | number;
}[] = [
  { name: 'turn_id', type: 'TEXT', notNull: true },
  { name: 'policy_id', type: 'TEXT', notNull: true },
  { name: 'mode', type: 'TEXT', notNull: true },
  { name: 'policy_revision', type: 'INTEGER', notNull: true },
  { name: 'recorded_at_ms', type: 'INTEGER', notNull: true },
];

/**
 * Index inventory of migration 4 (exactly this one beyond the PRIMARY
 * KEYs): per-turn evidence listing joins the assembly family by
 * `turn_id` (its PRIMARY KEY), so no additional lookup index is needed;
 * the policy listing order is served by the assembly thread index.
 */
export const QLT_MEMORY_MODE_INDEXES: readonly {
  readonly name: string;
  readonly table: string;
  readonly columns: string[];
  readonly unique: boolean;
}[] = [
  {
    name: 'uq_qlt_turn_memory_policy_turn',
    table: QLT_TURN_MEMORY_POLICY_TABLE,
    columns: ['turn_id'],
    unique: true,
  },
];

// ---------------------------------------------------------------------------
// The resolved effective policy (the ONE assembler consumption shape)
// ---------------------------------------------------------------------------

/** The typed resolved policy carried by the turn assembly scope. */
export interface QltResolvedMemoryPolicy {
  readonly policyId: typeof QLT_MEMORY_MODE_POLICY_ID;
  readonly mode: QltMemoryMode;
  /** Monotonic revision of the durable default policy at resolution time. */
  readonly revision: number;
}

// ---------------------------------------------------------------------------
// Per-turn applied-policy evidence (freeze §7; migration 4 evidence row)
// ---------------------------------------------------------------------------

/** The immutable per-turn applied-policy evidence record. */
export interface QltTurnMemoryPolicyRecord {
  readonly turnId: string;
  readonly policyId: string;
  readonly mode: QltMemoryMode;
  readonly policyRevision: number;
  readonly recordedAtMs: number;
}

// ---------------------------------------------------------------------------
// Stable codes (freeze §2/§6) — closed, non-echoing
// ---------------------------------------------------------------------------

/** The stable rejection code for an invalid Memory Mode (never echoes input). */
export const QLT_MEMORY_MODE_INVALID = 'QLT_MEMORY_MODE_INVALID';

/** The stable rejection code for a prohibited Memory Mode mutation actor. */
export const QLT_MEMORY_POLICY_FORBIDDEN = 'QLT_MEMORY_POLICY_FORBIDDEN';

// ---------------------------------------------------------------------------
// Transparency (freeze §3.5): the ONE new quiet-line state (Q4 §9 strings
// live frozen in context-contract.ts and are unchanged)
// ---------------------------------------------------------------------------

/** The exact new quiet-line string for a latest turn whose applied mode was off. */
export const QLT_MEMORY_MODE_TRANSPARENCY_OFF = 'Memory was off for your last reply here.';

// ---------------------------------------------------------------------------
// Mutation surface identity (freeze §9): ONE declared governed mutation
// ---------------------------------------------------------------------------

/** The Memory Mode application resource (exactly ONE mutation, no query). */
export const QLT_MEMORY_POLICY_RESOURCE_ID = 'qlt.memory-policy';
export const QLT_MEMORY_POLICY_RESOURCE_REVISION = '1';
export const QLT_MEMORY_POLICY_MUTATION_OPS: readonly string[] = ['setMode'];
export const QLT_MEMORY_POLICY_SET_MODE_ACTION_ID = 'act.setMemoryMode';
export const QLT_MEMORY_POLICY_SET_MODE_CONTRACT_ID = 'qlt.memory-policy.setMode.input';

// ---------------------------------------------------------------------------
// Authority delta and structural invariants (freeze §17/§20)
// ---------------------------------------------------------------------------

/** What Q5 changes for each identity class (everything else unchanged). */
export const QLT_Q5_AUTHORITY_DELTA = {
  user: 'gains read-only inspection of their own Shared World, in-UI lifecycle controls, and the global Memory Mode control; all writes remain user-attributed governed actions',
  agent:
    'UNCHANGED: exactly qlt.proposal.draft@1; no inspection, listing, search, decision, or Memory Mode power; receives the same bounded per-turn snapshot as data (now mode-scoped)',
  policyResolver:
    'a typed Quellight-owned read-side component; the SINGLE resolution boundary for the effective Memory Mode; holds no authority beyond resolving the durable default',
} as const;

/** Structural assertions permanently true of the Q5 policy path (freeze §17). */
export const QLT_Q5_STRUCTURAL_INVARIANTS: readonly string[] = [
  'the agent envelope remains exactly qlt.proposal.draft@1 (no read/list/search capability)',
  'the effective mode is bound at turn admission and carried immutably in the turn scope',
  'the per-turn applied-policy evidence is written once (INSERT-or-converge) and never updated',
  'the current setting never reinterprets a historical turn',
  'an off turn is never reported as "no memory existed"',
  'scope-excluded is emitted only under per-conversation and never under across-conversations',
  'Memory Mode cannot be supplied or overridden by the browser turn request, the model, or the agent',
  'invalid modes fail closed and non-echoing with QLT_MEMORY_MODE_INVALID',
  'the assembler consumes the resolved policy from one typed resolver (no scattered global conditionals)',
  'no projectId field, project table, project selector, or project UI exists',
  'no client-supplied scope identity exists anywhere in the turn path',
  'the Memory Mode control lives only inside the user-opened Memory surface',
];
