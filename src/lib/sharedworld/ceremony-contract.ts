/**
 * QUELLIGHT STAGE 07C PHASE Q3 — GOVERNED CONFIRMATION CEREMONY CONTRACT
 * (FROZEN in
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md).
 *
 * This module is the FROZEN, declarative Q3 contract shared by every Q3
 * lane. It contains contract DATA and TYPES only — identifiers, bounds,
 * stable codes, authority-matrix data, ingress request schemas as data,
 * and the frozen offline-fixture trigger contract — never product write
 * policy and never executable validation (the executable parse fences live
 * in `meaning.ts` (Q2, frozen) and in Lane A's `ceremony-actions.ts`,
 * which conform to THIS data).
 *
 * Ownership: frozen by the Phase 0 contract-freeze commit; NO Q3 lane may
 * edit this file. A material change requires the freeze amendment
 * procedure (freeze §19).
 *
 * Authority basis: Stage 07C handoff §7.1/§8/§10/§12.1 and the ratified
 * OQ6 owner addendum (§19); owner decisions D-Q3-1..D-Q3-6 (freeze §2);
 * GOV-007 (VICT semantic authority); D-10 (governed VICT 0.2.0 boundary);
 * the frozen Q2 contract (`meaning-contract.ts`, byte-identical through
 * Q3). Q3 wires the governed USER ceremony and the single inert agent
 * proposal capability; the agent still has NO Shared World read path and
 * NO confirmer-class power of any kind.
 */

// ---------------------------------------------------------------------------
// Identity discipline (Q2 patterns, unchanged; import-free re-declaration
// as data for the authority matrix)
// ---------------------------------------------------------------------------

/** The single product agent identity that proposes (stable, bounded). */
export const QLT_AGENT_PROPOSER_ID = 'agent-quellight';

/** The user-actor pattern (decision/correct/author identity; Q2-frozen). */
export const QLT_USER_ACTOR_PATTERN_SOURCE = 'actor-*';

/** Prototype-named and otherwise prohibited request keys (FENCE-1; D-Q3-6). */
export const QLT_INGRESS_PROHIBITED_KEYS: readonly string[] = [
  '__proto__',
  'constructor',
  'prototype',
];

/** The stable non-echoing FENCE-1 ingress rejection code. */
export const QLT_INGRESS_PROHIBITED_FIELD = 'QLT_INGRESS_PROHIBITED_FIELD';

// ---------------------------------------------------------------------------
// Resource and action identifiers (freeze §3)
// ---------------------------------------------------------------------------

/** The ONE bounded Shared World application resource of Q3. */
export const QLT_MEMORY_RESOURCE_ID = 'qlt.memory';
export const QLT_MEMORY_RESOURCE_REVISION = '1';
export const QLT_MEMORY_VIEW_ID = 'v.memory';

/** The unified read-projection catalogue fields (freeze §3). */
export const QLT_MEMORY_FIELDS: readonly {
  readonly name: string;
  readonly type: 'string' | 'number';
  readonly required: boolean;
  readonly label: string;
}[] = [
  { name: 'id', type: 'string', required: true, label: 'Id' },
  { name: 'kind', type: 'string', required: true, label: 'Kind' },
  { name: 'proposalKind', type: 'string', required: true, label: 'Proposal kind' },
  { name: 'status', type: 'string', required: true, label: 'Status' },
  { name: 'title', type: 'string', required: true, label: 'Title' },
  { name: 'text', type: 'string', required: true, label: 'Text' },
  { name: 'threadId', type: 'string', required: true, label: 'Thread' },
  { name: 'turnRef', type: 'string', required: true, label: 'Turn' },
  { name: 'actor', type: 'string', required: true, label: 'Actor' },
  { name: 'decisionBy', type: 'string', required: true, label: 'Decision by' },
  { name: 'stale', type: 'string', required: true, label: 'Stale' },
  { name: 'version', type: 'number', required: true, label: 'Version' },
  { name: 'createdAt', type: 'number', required: true, label: 'Created at' },
  { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
];

/** The declared equality-filter fields of the memory list query. */
export const QLT_MEMORY_FILTER_FIELDS: readonly string[] = ['kind', 'status', 'threadId'];

/** Declared sort fields of the memory list query. */
export const QLT_MEMORY_SORT_FIELDS: readonly string[] = ['updatedAt', 'createdAt'];

/** Query/list bounds. */
export const QLT_MEMORY_LIST_DEFAULT_LIMIT = 50;
export const QLT_MEMORY_LIST_MAX_LIMIT = 100;

/** The EXACTLY thirteen memory mutation ops (the whole ceremony surface). */
export const QLT_MEMORY_MUTATION_OPS: readonly string[] = [
  'confirmProposal',
  'rejectProposal',
  'amendProposal',
  'withdrawProposal',
  'createClaim',
  'createCommitment',
  'createOpenLoop',
  'correctRecord',
  'retireClaim',
  'releaseCommitment',
  'resolveLoop',
  'abandonLoop',
  'transformLoop',
];

/** The declared Application Definition action ids (frozen inventory). */
export const QLT_THREAD_ACTION_IDS: readonly string[] = [
  'act.queryThreads',
  'act.createThread',
  'act.renameThread',
  'act.archiveThread',
  'act.reopenThread',
];

export const QLT_MEMORY_ACTION_IDS: readonly string[] = [
  'act.queryMemory',
  'act.confirmProposal',
  'act.rejectProposal',
  'act.amendProposal',
  'act.withdrawProposal',
  'act.createClaim',
  'act.createCommitment',
  'act.createOpenLoop',
  'act.correctRecord',
  'act.retireClaim',
  'act.releaseCommitment',
  'act.resolveLoop',
  'act.abandonLoop',
  'act.transformLoop',
];

/** The complete frozen Q3 plan inventory (5 thread + 14 memory = 19). */
export const QLT_PLAN_ACTION_INVENTORY: readonly string[] = [
  ...QLT_THREAD_ACTION_IDS,
  ...QLT_MEMORY_ACTION_IDS,
].sort();

// ---------------------------------------------------------------------------
// Pinned agent capability identifiers (freeze §3; exactly one envelope entry)
// ---------------------------------------------------------------------------

export const QLT_PROPOSAL_CAPABILITY_ID = 'qlt.proposal.draft';
/**
 * Revision 3 (Execution-3 remediation; frozen contract
 * `docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-REMEDIATION-CONTRACT.md`,
 * superseding revision 2 of the VICT-M-1 remediation): the capability's
 * MODEL-FACING presentation changes — revision 3 adopts the VICT 0.3.1-rc.1
 * descriptive presentation API (an exact closed input schema, a passive
 * output-schema representation, and the bounded model-facing description)
 * so the model finally receives the proposal-tool structure. The accepted
 * shape is UNCHANGED (the authoritative `Contract.parse` remains the same
 * closed fence, unchanged-or-stricter), the declared effect REMAINS
 * `write`, and no authority moves. The revision bump follows the SDK
 * capability-identity discipline: changing the bound contract's
 * model-facing behavior requires a new capability revision so activation
 * identity can distinguish the change.
 */
export const QLT_PROPOSAL_CAPABILITY_REVISION = '3';
export const QLT_PROPOSAL_CAPABILITY_INPUT_CONTRACT = 'qlt.proposal.draft.input';
export const QLT_PROPOSAL_CAPABILITY_OUTPUT_CONTRACT = 'qlt.proposal.draft.output';

/**
 * Truthful effect class of the durable proposal-row creation (revision 2;
 * VICT-M-1). The class NEVER widens authority: the implementation, the
 * store, the contracts, and the tests carry every authority boundary.
 * The quiet in-turn completion is granted by the composition-supplied
 * EXACT host quiet-write policy (`QLT_HOST_QUIET_WRITE_POLICY`), never
 * by this metadata.
 */
export const QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT = 'write' as const;

/**
 * The composition-supplied host-owned quiet-write approval policy for the
 * pinned capability (VICT-M-1). EXACTLY ONE entry at the exact (id,
 * revision); no wildcard, no capability-controlled opt-out, and an
 * `irreversible` target can never be exempted. The policy identity is a
 * host-chosen versioned identifier (bounded identity pattern); VICT
 * records its own closed-code disposition basis, never this content.
 */
export const QLT_HOST_QUIET_WRITE_POLICY_IDENTITY = 'qlt.host-policy.quiet-write@1';

/** Kinds the agent may propose in Q3 ('correction' is deferred to Q4). */
export const QLT_AGENT_PROPOSABLE_KINDS: readonly string[] = ['claim', 'commitment', 'open_loop'];

// ---------------------------------------------------------------------------
// Closed input contracts (freeze §5): bounded field descriptors as data.
// kind: 'string' (non-empty ≤ maxChars) | 'number' (finite safe integer)
// | 'object' (plain object; family-shaped content validated by the parse
// fence at the handler). `required` lists names that must be present.
// ---------------------------------------------------------------------------

export interface QltContractFieldSpec {
  readonly name: string;
  readonly kind: 'string' | 'number' | 'object';
  readonly maxChars?: number;
}

export interface QltContractSpec {
  readonly id: string;
  readonly fields: readonly QltContractFieldSpec[];
  readonly required: readonly string[];
}

const S = (name: string, maxChars: number): QltContractFieldSpec => ({
  name,
  kind: 'string',
  maxChars,
});
const N = (name: string): QltContractFieldSpec => ({ name, kind: 'number' });
const O = (name: string): QltContractFieldSpec => ({ name, kind: 'object' });

export const QLT_MEMORY_CONTRACT_SPECS: readonly QltContractSpec[] = [
  {
    id: 'qlt.memory.confirm.input',
    fields: [S('proposalId', 128), N('expectedVersion')],
    required: ['proposalId'],
  },
  {
    id: 'qlt.memory.reject.input',
    fields: [S('proposalId', 128), S('reason', 500)],
    required: ['proposalId'],
  },
  {
    id: 'qlt.memory.amend.input',
    fields: [S('proposalId', 128), O('content'), S('reason', 500)],
    required: ['proposalId', 'content'],
  },
  {
    id: 'qlt.memory.withdraw.input',
    fields: [S('proposalId', 128), S('reason', 500)],
    required: ['proposalId'],
  },
  {
    id: 'qlt.memory.claim.input',
    fields: [
      S('threadId', 128),
      S('subject', 200),
      S('epistemicType', 2),
      S('honestyState', 16),
      S('confidence', 16),
      S('statement', 2000),
    ],
    required: ['subject', 'epistemicType', 'honestyState', 'confidence', 'statement'],
  },
  {
    id: 'qlt.memory.commitment.input',
    fields: [S('threadId', 128), S('commitmentKey', 200), S('statement', 2000)],
    required: ['commitmentKey', 'statement'],
  },
  {
    id: 'qlt.memory.loop.input',
    fields: [S('threadId', 128), S('subject', 200), S('loopKind', 24), S('detail', 2000)],
    required: ['subject', 'loopKind', 'detail'],
  },
  {
    id: 'qlt.memory.correct.input',
    fields: [
      S('recordId', 128),
      S('recordKind', 16),
      S('statement', 2000),
      S('detail', 2000),
      S('reason', 500),
      N('expectedVersion'),
    ],
    required: ['recordId', 'recordKind'],
  },
  {
    id: 'qlt.memory.claimExit.input',
    fields: [S('recordId', 128), S('reason', 500), N('expectedVersion')],
    required: ['recordId'],
  },
  {
    id: 'qlt.memory.commitmentExit.input',
    fields: [S('recordId', 128), S('reason', 500), N('expectedVersion')],
    required: ['recordId'],
  },
  {
    id: 'qlt.memory.loopExit.input',
    fields: [S('recordId', 128), S('reason', 500), N('expectedVersion')],
    required: ['recordId'],
  },
];

/** Input bounds for the pinned capability's closed contract (freeze §5). */
export const QLT_PROPOSAL_CAPABILITY_FIELD_SPECS: readonly QltContractFieldSpec[] = [
  S('proposalKind', 16),
  O('content'),
];

// ---------------------------------------------------------------------------
// Stable failure codes introduced by Q3 (the Q2 code vocabulary is
// unchanged and reused; freeze §6)
// ---------------------------------------------------------------------------

export type QltCeremonyErrorCode =
  | 'QLT_INGRESS_PROHIBITED_FIELD'
  | 'QLT_CORRELATION_MISSING'
  | 'QLT_PROPOSAL_OPEN_EXISTS'
  | 'QLT_INPUT_REJECTED';

/** The closed output-code vocabulary of the proposal capability. */
export const QLT_PROPOSAL_OUTPUT_CODES: readonly string[] = [
  'QLT_CORRELATION_MISSING',
  'QLT_THREAD_MISSING',
  'QLT_PROPOSAL_OPEN_EXISTS',
  'QLT_IDEMPOTENCY_CONFLICT',
  'QLT_INPUT_REJECTED',
];

// ---------------------------------------------------------------------------
// Authority matrix data (freeze §4) — declarative, test-consumed
// ---------------------------------------------------------------------------

/** What each identity class may durably do (Q3). */
export const QLT_Q3_AUTHORITY_MATRIX = {
  user: {
    confirm: true,
    reject: true,
    amend: true,
    withdraw: true,
    directSave: true,
    correct: true,
    lifecycleExits: true,
    readPresentation: true,
    propose: false,
  },
  agent: {
    confirm: false,
    reject: false,
    amend: false,
    withdraw: false,
    directSave: false,
    correct: false,
    lifecycleExits: false,
    readPresentation: false,
    propose: true,
  },
} as const;

// ---------------------------------------------------------------------------
// Frozen offline-fixture trigger contract (freeze §3; TEST-1)
// ---------------------------------------------------------------------------

export interface QltFixtureTriggerSpec {
  readonly userText: string;
  readonly toolName: string;
  readonly args: {
    readonly proposalKind: 'claim' | 'commitment' | 'open_loop';
    readonly content: Record<string, string>;
  };
  readonly thenText: string;
}

/** Deterministic tool-name mapping for the pinned capability id. */
export const QLT_PROPOSAL_TOOL_NAME = 'qlt_proposal_draft';

export const QLT_FIXTURE_TRIGGERS: readonly QltFixtureTriggerSpec[] = [
  {
    userText: 'I keep important details scattered everywhere',
    toolName: QLT_PROPOSAL_TOOL_NAME,
    args: {
      proposalKind: 'claim',
      content: {
        subject: 'Deep work preferences',
        epistemicType: 'E5',
        honestyState: 'likely',
        confidence: 'qualified',
        statement: 'The user does their most important work in focused morning sessions.',
      },
    },
    thenText:
      'I noted a possible claim about your working style — it is in your pending memory inbox for review whenever you like.',
  },
  {
    userText: 'I have to prepare the quarterly review',
    toolName: QLT_PROPOSAL_TOOL_NAME,
    args: {
      proposalKind: 'commitment',
      content: {
        commitmentKey: 'quarterly-review-prep',
        statement: 'The user intends to prepare the quarterly review.',
      },
    },
    thenText:
      'I noted a possible commitment — it is in your pending memory inbox for review whenever you like.',
  },
  {
    userText: 'I still need to figure out the travel plans',
    toolName: QLT_PROPOSAL_TOOL_NAME,
    args: {
      proposalKind: 'open_loop',
      content: {
        subject: 'Travel plans',
        loopKind: 'undecided_question',
        detail: 'The travel plans are still undecided.',
      },
    },
    thenText:
      'I noted a possible open question — it is in your pending memory inbox for review whenever you like.',
  },
];
