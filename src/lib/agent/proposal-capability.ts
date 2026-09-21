/**
 * The ONE pinned agent capability of Stage 07C Phase Q3: drafting inert
 * pending Shared World proposals (`qlt.proposal.draft@2` as of the
 * VICT-M-1 remediation).
 *
 * FROZEN CONTRACT: docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md
 * (§3 identifiers, §4 authority matrix, §5 closed contracts, §8 server-derived
 * correlation) as superseded for this capability's identity by the M-1
 * remediation (docs/report/QUELLIGHT-STAGE-07C-M-1-REMEDIATION.md):
 * revision 2 truthfully declares `effect: 'write'`.
 *
 * What this capability is:
 * - the ONLY model-facing effectful surface of Quellight; the pinned agent
 *   authority envelope contains this capability and nothing else;
 * - a creator of exactly one durable, EPISTEMICALLY INERT pending proposal
 *   row per invocation (the Q2 `qlt_proposal` family; never canonical, never
 *   presented to the model again);
 * - correlation-honest: thread and turn provenance are resolved SERVER-SIDE
 *   through the composition-supplied resolver from bridge-supplied turn
 *   identity — the model supplies ONLY the proposal kind and content;
 * - keyed-idempotent: the store key is a bounded deterministic digest of the
 *   bridge's stable logical-invocation idempotency key, so framework retries
 *   and restarts converge to the SAME durable proposal;
 * - truthful under the fenced tool bridge: pre-effect refusals return the
 *   bounded structured outcome; post-effect throws are settled by the
 *   bridge's non-replayable `outcome_unknown` fence (never fabricated).
 *
 * What this capability is NOT:
 * - NOT a confirmer, rejector, amender, withdrawer, corrector, or deleter:
 *   no ceremony verb exists on this surface, and the store refuses agent
 *   decision identities independently (CHECK + QLT_CONFIRMER_INVALID);
 * - NOT a reader: it never lists, inspects, queries, or returns ANY Shared
 *   World record — pending or confirmed — beyond the immediate bounded
 *   outcome of its own invocation;
 * - NOT a correction path: `proposalKind: 'correction'` is rejected in Q3
 *   (agent-originated correction targeting is deferred to Q4, freeze §12).
 *
 * Effect-class disclosure (VICT-M-1, superseding the Q3-era `@1/read`
 * disclosure preserved in the historical Q3 freeze): the capability's
 * factual external impact is a DURABLE proposal-row creation, so revision
 * 2 DECLARED `write`. The quiet in-turn completion is granted by the
 * composition-supplied EXACT host quiet-write policy — never by this
 * metadata, which cannot exempt itself. The bridge durably records the
 * truthful decision evidence on every invocation (effect `write`,
 * approval-required `false`, the closed-code host-policy disposition); no
 * approval row, no approver identity, and no awaiting-approval event
 * exists for a quiet proposal write. Every authority boundary is enforced
 * by this implementation, the store, the contracts, and the permanent
 * tests — never by the class metadata.
 */

import { createHash } from 'node:crypto';
import { defineContract, type Contract } from '@victframework/contracts';
import type { CapabilityDefinition } from '@victframework/sdk';
import {
  QLT_AGENT_PROPOSABLE_KINDS,
  QLT_AGENT_PROPOSER_ID,
  QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT,
  QLT_PROPOSAL_CAPABILITY_ID,
  QLT_PROPOSAL_CAPABILITY_INPUT_CONTRACT,
  QLT_PROPOSAL_CAPABILITY_OUTPUT_CONTRACT,
  QLT_PROPOSAL_CAPABILITY_REVISION,
  QLT_PROPOSAL_OUTPUT_CODES,
} from '../sharedworld/ceremony-contract.js';
import { parseProposalContent } from '../sharedworld/meaning.js';
import type {
  QltParseIssue,
  QltProposal,
  QltProposalContent,
  QltProposalKind,
  SharedWorldMeaningStore,
} from '../sharedworld/meaning-contract.js';

// ---------------------------------------------------------------------------
// Bounded invocation context (the fields the released tool bridge supplies
// to the composition's capability invoker; all correlation-relevant fields
// are bridge-supplied, never model-supplied)
// ---------------------------------------------------------------------------

export interface ProposalDraftInvocationContext {
  readonly victTurnId?: unknown;
  readonly victActorId?: unknown;
  readonly victIdempotencyKey?: unknown;
  readonly victInvocationId?: unknown;
  readonly victToolCallId?: unknown;
  readonly signal?: unknown;
}

/**
 * Server-side correlation resolver (composition-supplied; Lane A wiring).
 * Resolves the Shared World thread for a bridge-supplied turn + actor pair
 * from durable server records ONLY. `undefined` means the correlation could
 * not be truthfully established (missing turn record, actor mismatch, or no
 * Shared World conversation link).
 */
export type ProposalTurnCorrelationResolver = (
  turnId: string,
  actorId: string,
) => Promise<{ readonly threadId: string } | undefined>;

export interface ProposalDraftCapabilityDeps {
  /** The Q2 meaning repository (the ONLY writer this capability touches). */
  readonly meaning: SharedWorldMeaningStore;
  /** Server-derived turn/thread correlation (never model-supplied). */
  readonly resolveTurnCorrelation: ProposalTurnCorrelationResolver;
  /** Deterministic clock (epoch ms) forwarded to the store. */
  readonly clock?: () => number;
  /** The stable proposing-agent identity (default: the product constant). */
  readonly agentIdentity?: string;
}

/** The bounded draft input the model may supply (closed field set). */
export interface ProposalDraftInput {
  readonly proposalKind: QltProposalKind;
  readonly content: QltProposalContent;
}

/** The bounded structured outcome returned to the model (closed union). */
export type ProposalDraftOutput =
  | { readonly accepted: true; readonly proposalId: string }
  | { readonly accepted: false; readonly code: string };

// ---------------------------------------------------------------------------
// Plain-container check (local copy of the shared structural discipline:
// own-file ownership keeps this lane disjoint from the Q2 domain module)
// ---------------------------------------------------------------------------

function isPlainObjectCandidate(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// ---------------------------------------------------------------------------
// Closed contracts (first fence at the bridge; the invoke handler re-parses
// as the second fence — the two-fence pattern of the governed boundary)
// ---------------------------------------------------------------------------

const INPUT_FIELDS = ['proposalKind', 'content'] as const;
const OUTPUT_ACCEPTED_FIELDS = ['accepted', 'proposalId'] as const;
const OUTPUT_REFUSED_FIELDS = ['accepted', 'code'] as const;

// ---------------------------------------------------------------------------
// The EXACT closed model-facing presentation (Execution-3 remediation;
// frozen contract §6). Passive draft-07-style data only: the VICT bridge
// captures it as inert bounded data at tool construction and presents it to
// the provider — it is NEVER executed and NEVER replaces the authoritative
// Contract.parse above. Every branch declares its required content fields
// and refuses unknown fields (additionalProperties: false).
// ---------------------------------------------------------------------------

const MODEL_DESCRIPTION =
  'Draft ONE inert pending proposal for the user to review later. ' +
  'You never confirm, save, or change canonical memory, and the proposal is never shown back to you. ' +
  "Choose proposalKind 'claim', 'commitment', or 'open_loop', and send 'content' in the EXACT shape " +
  'required for that kind: claim needs subject, epistemicType, honestyState, confidence, and statement; ' +
  'commitment needs commitmentKey and statement; open_loop needs subject, loopKind, and detail. ' +
  'Send every required field as a non-empty string and no unknown fields; empty or single-field ' +
  'arguments are always refused.';

const CLAIM_CONTENT_PRESENTATION = {
  type: 'object',
  properties: {
    subject: { type: 'string', minLength: 1, maxLength: 200 },
    epistemicType: { type: 'string', enum: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'] },
    honestyState: {
      type: 'string',
      enum: ['known', 'likely', 'uncertain', 'stale', 'conflicted'],
    },
    confidence: { type: 'string', enum: ['stated', 'qualified', 'uncertain'] },
    statement: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  required: ['subject', 'epistemicType', 'honestyState', 'confidence', 'statement'],
  additionalProperties: false,
} as const;

const COMMITMENT_CONTENT_PRESENTATION = {
  type: 'object',
  properties: {
    commitmentKey: { type: 'string', minLength: 1, maxLength: 200 },
    statement: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  required: ['commitmentKey', 'statement'],
  additionalProperties: false,
} as const;

const OPEN_LOOP_CONTENT_PRESENTATION = {
  type: 'object',
  properties: {
    subject: { type: 'string', minLength: 1, maxLength: 200 },
    loopKind: {
      type: 'string',
      enum: ['pending_action', 'undecided_question', 'expected_event'],
    },
    detail: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  required: ['subject', 'loopKind', 'detail'],
  additionalProperties: false,
} as const;

const proposalInputPresentation = {
  type: 'object',
  properties: {
    proposalKind: {
      type: 'string',
      enum: ['claim', 'commitment', 'open_loop'],
      description:
        "The kind of proposal to draft: 'claim', 'commitment', or 'open_loop'.",
    },
    content: { type: 'object' },
  },
  required: ['proposalKind', 'content'],
  additionalProperties: false,
  oneOf: [
    {
      type: 'object',
      properties: { proposalKind: { const: 'claim' }, content: CLAIM_CONTENT_PRESENTATION },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        proposalKind: { const: 'commitment' },
        content: COMMITMENT_CONTENT_PRESENTATION,
      },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { proposalKind: { const: 'open_loop' }, content: OPEN_LOOP_CONTENT_PRESENTATION },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
  ],
} as const;

const proposalOutputPresentation = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        accepted: { const: true },
        proposalId: { type: 'string', maxLength: 128 },
      },
      required: ['accepted', 'proposalId'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { accepted: { const: false }, code: { type: 'string', maxLength: 64 } },
      required: ['accepted', 'code'],
      additionalProperties: false,
    },
  ],
} as const;

/** Contract issues for the bridge fence: code + path ONLY, never values. */
function issue(
  code: string,
  path: string,
): {
  readonly code: string;
  readonly path: string;
  readonly message: string;
} {
  return { code, path, message: `input rejected at ${path} (${code})` };
}

function boundedSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

export const proposalDraftInputContract: Contract<ProposalDraftInput> =
  defineContract<ProposalDraftInput>({
    id: QLT_PROPOSAL_CAPABILITY_INPUT_CONTRACT,
    revision: '1',
    expected:
      'closed object { proposalKind: claim|commitment|open_loop, content: kind-shaped bounded content }; correlation fields are server-derived and unknown',
    descriptiveJsonSchema: proposalInputPresentation,
    parse(input: unknown) {
      if (Array.isArray(input) || input === null || typeof input !== 'object') {
        return { ok: false as const, issues: [issue('QLT_INPUT_NOT_OBJECT', '(root)')] };
      }
      if (!isPlainObjectCandidate(input)) {
        return { ok: false as const, issues: [issue('QLT_INPUT_INVALID_CONTAINER', '(root)')] };
      }
      const record = input as Record<string, unknown>;
      const issues: ReturnType<typeof issue>[] = [];
      for (const key of Object.keys(record)) {
        if (!(INPUT_FIELDS as readonly string[]).includes(key)) {
          issues.push(issue('QLT_INPUT_UNKNOWN_FIELD', key));
        }
      }
      const kind = record['proposalKind'];
      if (typeof kind !== 'string' || kind.length === 0 || kind.length > 16) {
        issues.push(issue('QLT_INPUT_INVALID_TYPE', 'proposalKind'));
      } else if (!(QLT_AGENT_PROPOSABLE_KINDS as readonly string[]).includes(kind)) {
        // 'correction' is deliberately NOT agent-proposable in Q3 (freeze §12).
        issues.push(issue('QLT_INPUT_INVALID_ENUM', 'proposalKind'));
      }
      if (issues.length > 0) {
        return { ok: false as const, issues };
      }
      const parsedContent = parseProposalContent(kind as QltProposalKind, record['content']);
      if (!parsedContent.ok) {
        const mapped = parsedContent.issues.map((entry: QltParseIssue) =>
          issue(entry.code, `content.${entry.path}`),
        );
        return { ok: false as const, issues: mapped };
      }
      return {
        ok: true as const,
        value: { proposalKind: kind as QltProposalKind, content: parsedContent.value },
      };
    },
  });

export const proposalDraftOutputContract: Contract<ProposalDraftOutput> =
  defineContract<ProposalDraftOutput>({
    id: QLT_PROPOSAL_CAPABILITY_OUTPUT_CONTRACT,
    revision: '1',
    expected:
      'closed union { accepted: true, proposalId } | { accepted: false, code } — the ONLY Shared World information that may reach the model',
    descriptiveJsonSchema: proposalOutputPresentation,
    parse(input: unknown) {
      if (Array.isArray(input) || input === null || typeof input !== 'object') {
        return { ok: false as const, issues: [issue('QLT_OUTPUT_INVALID', '(root)')] };
      }
      if (!isPlainObjectCandidate(input)) {
        return { ok: false as const, issues: [issue('QLT_OUTPUT_INVALID', '(root)')] };
      }
      const record = input as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      if (record['accepted'] === true && keys.join(',') === OUTPUT_ACCEPTED_FIELDS.join(',')) {
        if (!boundedSafeId(record['proposalId'])) {
          return { ok: false as const, issues: [issue('QLT_OUTPUT_INVALID', 'proposalId')] };
        }
        return {
          ok: true as const,
          value: { accepted: true, proposalId: record['proposalId'] as string },
        };
      }
      if (record['accepted'] === false && keys.join(',') === OUTPUT_REFUSED_FIELDS.join(',')) {
        if (
          typeof record['code'] !== 'string' ||
          !QLT_PROPOSAL_OUTPUT_CODES.includes(record['code'])
        ) {
          return { ok: false as const, issues: [issue('QLT_OUTPUT_INVALID', 'code')] };
        }
        return {
          ok: true as const,
          value: { accepted: false, code: record['code'] as string },
        };
      }
      return { ok: false as const, issues: [issue('QLT_OUTPUT_INVALID', '(root)')] };
    },
  });

// ---------------------------------------------------------------------------
// The bounded store key: a deterministic digest of the bridge's stable
// logical-invocation idempotency key (the raw key embeds unbounded
// identifiers and colons; the frozen QLT key pattern is ≤ 128 safe chars)
// ---------------------------------------------------------------------------

function boundedStoreKey(victIdempotencyKey: string): string {
  const digest = createHash('sha256').update(victIdempotencyKey, 'utf8').digest('hex');
  return `draft-${digest.slice(0, 40)}`;
}

// ---------------------------------------------------------------------------
// The capability factory
// ---------------------------------------------------------------------------

/**
 * Create the pinned proposal-draft capability definition. The composition
 * pins it into the agent authority envelope and resolves it — and ONLY it —
 * through the bridge's capability resolver.
 */
export function createProposalDraftCapability(
  deps: ProposalDraftCapabilityDeps,
): CapabilityDefinition<ProposalDraftInput, ProposalDraftOutput> {
  const agentIdentity = deps.agentIdentity ?? QLT_AGENT_PROPOSER_ID;
  return {
    id: QLT_PROPOSAL_CAPABILITY_ID,
    revision: QLT_PROPOSAL_CAPABILITY_REVISION,
    effect: QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT,
    input: proposalDraftInputContract,
    output: proposalDraftOutputContract,
    // Bounded model-facing description (Execution-3 remediation §6):
    // inert presentation metadata captured by the bridge at tool
    // construction; it can never widen authority.
    description: MODEL_DESCRIPTION,
    idempotency: 'keyed',
    async invoke(rawInput, context): Promise<ProposalDraftOutput> {
      // ---- second fence: re-parse through the SAME closed contract -------
      const reparsed = proposalDraftInputContract.parse(rawInput);
      if (!reparsed.ok) {
        return { accepted: false, code: 'QLT_INPUT_REJECTED' };
      }
      const input = reparsed.value;
      const ctx = (context ?? {}) as ProposalDraftInvocationContext;

      // ---- server-derived correlation (freeze §8) -------------------------
      if (typeof ctx.victTurnId !== 'string' || ctx.victTurnId.length === 0) {
        return { accepted: false, code: 'QLT_CORRELATION_MISSING' };
      }
      if (typeof ctx.victIdempotencyKey !== 'string' || ctx.victIdempotencyKey.length === 0) {
        return { accepted: false, code: 'QLT_CORRELATION_MISSING' };
      }
      const correlation = await deps.resolveTurnCorrelation(
        ctx.victTurnId,
        typeof ctx.victActorId === 'string' ? ctx.victActorId : '',
      );
      if (correlation === undefined) {
        return { accepted: false, code: 'QLT_CORRELATION_MISSING' };
      }

      // ---- ONE inert, keyed proposal-row creation -------------------------
      try {
        const proposal: QltProposal = await deps.meaning.createProposal({
          proposalKind: input.proposalKind,
          content: input.content,
          proposedBy: agentIdentity,
          sourceThreadId: correlation.threadId,
          sourceTurnRef: ctx.victTurnId,
          key: boundedStoreKey(ctx.victIdempotencyKey),
          ...(deps.clock !== undefined ? { now: deps.clock() } : {}),
        });
        return { accepted: true, proposalId: proposal.id };
      } catch (cause) {
        const code = (cause as { code?: unknown }).code;
        if (code === 'QLT_RECORD_EXISTS') {
          // The frozen one-open-proposal-per-(thread, kind, turn) rule.
          return { accepted: false, code: 'QLT_PROPOSAL_OPEN_EXISTS' };
        }
        if (code === 'QLT_IDEMPOTENCY_CONFLICT') {
          return { accepted: false, code: 'QLT_IDEMPOTENCY_CONFLICT' };
        }
        if (code === 'QLT_THREAD_MISSING') {
          return { accepted: false, code: 'QLT_THREAD_MISSING' };
        }
        return { accepted: false, code: 'QLT_INPUT_REJECTED' };
      }
    },
  };
}
