/**
 * The Stage 07D Lane B governed conflict application surface.
 *
 * FROZEN CONTRACT: the D1a freeze (`d1-contract.ts` §6/§7/§10; freeze
 * report §8/§9). This module declares the `qlt.conflict` resource (ONE
 * list query; EXACTLY the three frozen mutations `amendCommitment`,
 * `dismissChallenge`, `resolveChallengeWithAmendment`), the closed input
 * contracts (first fence), and their handlers (second fence). It also
 * serves the CONFIRM-TIME CONFLICT HOOK consumed by the Q3 ceremony
 * surface: the deterministic `commitment-key-conflict` detector that
 * refuses a conflicting confirmation, records the challenge judgment
 * row, and re-raises the stable `QLT_COMMITMENT_CONFLICT` refusal.
 *
 * Authority: every mutation is USER-attributed through the SERVER-DERIVED
 * local actor; an `agent-*` identity fails closed. Presentation is QUIET
 * per the frozen UI rules: plain list rows only — no modal, no focus
 * theft, no tray auto-open, no interruption, no forced decision.
 */

import type {
  ApplicationDataMutationRequest,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ResourceDefinition } from '@victframework/sdk';
import type { Contract } from '@victframework/sdk';
import {
  QLT_CONFLICT_ACTION_IDS,
  QLT_CONFLICT_MUTATION_OPS,
  QLT_CONFLICT_READ_PERMISSION,
  QLT_CONFLICT_RESOURCE_ID,
  QLT_CONFLICT_RESOURCE_REVISION,
  QLT_CONFLICT_WRITE_PERMISSION,
  QLT_D1_CONTRACT_SPECS,
  type QltD1ContractSpec,
} from './d1-contract.js';
import { QltMeaningError, type QltProposal } from './meaning-contract.js';
import type {
  QltChallengeStatus,
  QltChallengeView,
  SharedWorldConflictStore,
} from './conflict-store.js';
import { d1ContractFromSpec } from './retention-surface.js';

// ---------------------------------------------------------------------------
// Resource definition (frozen inventory; adapter mirror)
// ---------------------------------------------------------------------------

export const conflictResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: QLT_CONFLICT_RESOURCE_ID,
  revision: QLT_CONFLICT_RESOURCE_REVISION,
  identity: { key: 'challengeId' },
  fields: [
    { name: 'challengeId', type: 'string', required: true, label: 'Challenge' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'classification', type: 'string', required: true, label: 'Classification' },
    { name: 'existingCommitmentId', type: 'string', required: true, label: 'Existing commitment' },
    { name: 'existingStatus', type: 'string', required: true, label: 'Existing status' },
    { name: 'incomingProposalId', type: 'string', required: true, label: 'Incoming proposal' },
    { name: 'incomingStatus', type: 'string', required: true, label: 'Incoming status' },
    { name: 'resolution', type: 'string', required: true, label: 'Resolution' },
    { name: 'createdBy', type: 'string', required: true, label: 'Created by' },
    { name: 'threadId', type: 'string', required: true, label: 'Thread' },
    { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
  ],
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: ['status', 'threadId'],
      pagination: true,
      projection: [
        'challengeId',
        'status',
        'classification',
        'existingCommitmentId',
        'existingStatus',
        'incomingProposalId',
        'incomingStatus',
        'resolution',
        'createdBy',
        'threadId',
        'updatedAt',
      ],
    },
  },
  mutations: QLT_CONFLICT_MUTATION_OPS.map((op) => ({
    op,
    effect: 'write',
    idempotency: 'keyed',
    permissions: [QLT_CONFLICT_WRITE_PERMISSION],
  })),
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

export const conflictContracts: readonly Contract<unknown>[] = QLT_D1_CONTRACT_SPECS.filter(
  (spec) => spec.id.startsWith('qlt.conflict.'),
).map((spec) => d1ContractFromSpec(spec));

export const conflictContractRegistry = QLT_D1_CONTRACT_SPECS.filter((spec) =>
  spec.id.startsWith('qlt.conflict.'),
).map((spec) => ({ id: spec.id, revision: '1' as const }));

// ---------------------------------------------------------------------------
// Projection + failure mapping
// ---------------------------------------------------------------------------

function projectionOfChallenge(view: QltChallengeView): Record<string, unknown> {
  return {
    challengeId: view.challengeId,
    status: view.status,
    classification: view.classification,
    existingCommitmentId: view.existingCommitmentId,
    // Truthful CURRENT state of the referenced rows (a removed commitment
    // renders its tombstone state, never its content).
    existingStatus: view.existingState === null ? 'missing' : `${view.existingState.status}/${view.existingState.retentionState}`,
    incomingProposalId: view.incomingProposalId,
    incomingStatus: view.incomingState === null ? 'missing' : view.incomingState.status,
    resolution: view.resolution ?? '',
    createdBy: view.createdBy,
    threadId: view.threadId,
    updatedAt: view.updatedAtMs,
  };
}

function d1Failure(cause: unknown): ApplicationDataResult {
  if (
    cause !== null &&
    typeof cause === 'object' &&
    (cause as { name?: unknown }).name === 'QltMeaningError'
  ) {
    const error = cause as QltMeaningError;
    return { ok: false, code: error.code, message: error.message };
  }
  return {
    ok: false,
    code: 'QLT_STORE_ERROR',
    message: 'The conflict action could not be completed; this safe failure is server-generated.',
  };
}

// ---------------------------------------------------------------------------
// The confirm-time conflict hook (deterministic detector)
// ---------------------------------------------------------------------------

export interface ConflictHookDeps {
  readonly conflict: SharedWorldConflictStore;
  /** Resolves the current-effective commitment for a key, if any. */
  readonly resolveCurrentEffectiveCommitment: (
    commitmentKey: string,
  ) => Promise<{ readonly id: string } | undefined>;
  /** The SERVER-DERIVED local user actor. */
  readonly userActorId: string;
}

/**
 * The deterministic confirm-time detector (freeze §8). Called by the Q3
 * ceremony surface BEFORE confirming a proposal: for a CONFIRMATION of a
 * commitment-kind proposal whose key already carries an ACTIVE,
 * currently-relevant commitment, it records (idempotently) the challenge
 * judgment row and returns the stable refusal. Every other kind passes
 * through untouched. The refusal is quiet and non-blocking: the incoming
 * proposal stays `awaiting_decision`; the existing commitment is never
 * touched.
 */
export async function detectCommitmentConflict(
  deps: ConflictHookDeps,
  proposal: QltProposal,
): Promise<ApplicationDataResult | undefined> {
  if (proposal.proposalKind !== 'commitment') {
    return undefined;
  }
  const content = proposal.content as { commitmentKey?: unknown };
  if (typeof content.commitmentKey !== 'string') {
    return undefined;
  }
  const active = await deps.resolveCurrentEffectiveCommitment(content.commitmentKey);
  if (active === undefined || active.id === undefined) {
    return undefined;
  }
  const { challenge } = deps.conflict.ensureChallenge({
    existingCommitmentId: active.id,
    incomingProposalId: proposal.id,
    createdBy: deps.userActorId,
  });
  return {
    ok: false,
    code: 'QLT_COMMITMENT_CONFLICT',
    message:
      'Confirming this proposal would conflict with an active commitment on the same key. A challenge was recorded for your decision; nothing was changed.',
    details: { challengeId: challenge.challengeId },
  } as ApplicationDataResult;
}

// ---------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------

export interface ConflictSurfaceDeps {
  readonly conflict: SharedWorldConflictStore;
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly userActorId: string;
}

export function createConflictSurface(deps: ConflictSurfaceDeps): {
  readonly resource: ResourceDefinition;
  readonly contracts: readonly Contract<unknown>[];
  readonly contractRegistry: readonly { readonly id: string; readonly revision: string }[];
  readonly actionIds: readonly string[];
  query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
  mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
} {
  const user = deps.userActorId;

  function authorize(effect: 'read' | 'write', context: ApplicationDataRequestContext) {
    if (context.effect !== effect) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: 'Access was requested with an effect that does not match the operation.',
      } as ApplicationDataResult;
    }
    const required = effect === 'read' ? QLT_CONFLICT_READ_PERMISSION : QLT_CONFLICT_WRITE_PERMISSION;
    if (!context.permissions.includes(required)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${QLT_CONFLICT_RESOURCE_ID}' requires permission '${required}'.`,
      } as ApplicationDataResult;
    }
    return undefined;
  }

  async function query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const denied = authorize('read', context);
    if (denied !== undefined) {
      return denied;
    }
    if (request.op !== 'list') {
      return { ok: false, code: 'DATA_INVALID_REQUEST', message: 'Unknown query op.' };
    }
    const filters = (request.filters ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(filters)) {
      if (!['status', 'threadId'].includes(key)) {
        return {
          ok: false,
          code: 'DATA_UNSUPPORTED_QUERY',
          message: `Filtering by '${key}' is not declared for this resource.`,
        };
      }
    }
    try {
      const page = deps.conflict.listChallenges({
        status: typeof filters['status'] === 'string' ? (filters['status'] as QltChallengeStatus) : undefined,
        threadId: typeof filters['threadId'] === 'string' ? filters['threadId'] : undefined,
        ...(typeof request.limit === 'number' ? { limit: request.limit } : {}),
        ...(typeof request.offset === 'number' ? { offset: request.offset } : {}),
      });
      return { ok: true, rows: page.rows.map(projectionOfChallenge), total: page.total };
    } catch (cause) {
      return d1Failure(cause);
    }
  }

  async function mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const denied = authorize('write', context);
    if (denied !== undefined) {
      return denied;
    }
    if (!(QLT_CONFLICT_MUTATION_OPS as readonly string[]).includes(request.op)) {
      return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
    }
    if (user.startsWith('agent-')) {
      return {
        ok: false,
        code: 'QLT_INPUT_INVALID_IDENTITY',
        message: 'A conflict action requires a user identity.',
      };
    }
    const input = (request.input ?? {}) as Record<string, unknown>;
    const idempotencyKey =
      typeof request.idempotencyKey === 'string' ? request.idempotencyKey : undefined;
    try {
      switch (request.op) {
        case 'amendCommitment': {
          const outcome = deps.conflict.amendCommitment({
            commitmentId: input['commitmentId'] as string,
            statement: input['statement'] as string,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            amendedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: {
              amendmentId: outcome.amendment.amendmentId,
              successorId: outcome.successor.id,
              predecessorStatus: outcome.predecessor.status,
              successorStatus: outcome.successor.status,
              version: outcome.amendment.createdAtMs,
              updatedAt: outcome.amendment.createdAtMs,
            },
          };
        }
        case 'dismissChallenge': {
          const view = deps.conflict.dismissChallenge({
            challengeId: input['challengeId'] as string,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            dismissedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: projectionOfChallenge(view) };
        }
        case 'resolveChallengeWithAmendment': {
          const outcome = deps.conflict.resolveChallengeWithAmendment({
            challengeId: input['challengeId'] as string,
            statement: input['statement'] as string,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            resolvedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: {
              ...projectionOfChallenge(outcome.challenge),
              amendmentId: outcome.amendment.amendmentId,
              successorId: outcome.amendment.successorId,
            },
          };
        }
        default:
          return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
      }
    } catch (cause) {
      return d1Failure(cause);
    }
  }

  return {
    resource: conflictResource,
    contracts: conflictContracts,
    contractRegistry: conflictContractRegistry,
    actionIds: QLT_CONFLICT_ACTION_IDS,
    query,
    mutate,
  };
}
