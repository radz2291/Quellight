/**
 * The Q3 governed Shared World ceremony action surface (Lane A).
 *
 * FROZEN CONTRACT: docs/report/QUELLIGHT-STAGE-07C-PHASE-Q3-CONTRACT-FREEZE.md
 * (§3 identifiers; §5 closed contracts; §6 codes; §9 lifecycle mapping;
 * §10 idempotency; §12 correction targeting).
 *
 * This module is the ONE bounded Shared World application resource
 * (`qlt.memory@1`): the closed input contracts, the unified read
 * projection, and the thirteen user-attributed ceremony mutation handlers.
 * It is consumed ONLY by the composition's application-data port (one
 * effect path through the released VICT 0.2.0 `app.data.mutate` /
 * `app.data.query` boundary) — never by a route, an island, or the agent.
 *
 * Authority (freeze §4): every handler attributes its effect to the
 * SERVER-DERIVED local user actor; an `agent-*` identity can never reach
 * this surface (the agent's only path is the inert proposal capability,
 * and the store independently refuses agent decision identities).
 */

import type { Contract } from '@victframework/contracts';
import type {
  ApplicationDataMutationRequest,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ResourceDefinition } from '@victframework/sdk';
import {
  parseClaimContent,
  parseCommitmentContent,
  parseOpenLoopContent,
  parseProposalContent,
  proposalStaleness,
} from './meaning.js';
import type {
  QltMeaningError,
  QltOpenLoop,
  QltProposal,
  QltSubjectFamily,
  QltSubjectRecord,
  SharedWorldMeaningStore,
} from './meaning-contract.js';
import {
  QLT_MEMORY_CONTRACT_SPECS,
  QLT_MEMORY_FIELDS,
  QLT_MEMORY_FILTER_FIELDS,
  QLT_MEMORY_LIST_DEFAULT_LIMIT,
  QLT_MEMORY_LIST_MAX_LIMIT,
  QLT_MEMORY_MUTATION_OPS,
  QLT_MEMORY_RESOURCE_ID,
  QLT_MEMORY_RESOURCE_REVISION,
  QLT_MEMORY_SORT_FIELDS,
  type QltContractSpec,
} from './ceremony-contract.js';
import type { QltMemoryListOptions } from './sqlite.js';
import type { QltThread } from './port.js';
import type { QltStalenessTarget } from './meaning.js';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// The resource definition (frozen §3 data; mirrored into the compiled plan)
// ---------------------------------------------------------------------------

/** The Q3 memory resource definition (adapter mirror of the declared plan). */
export const memoryResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: QLT_MEMORY_RESOURCE_ID,
  revision: QLT_MEMORY_RESOURCE_REVISION,
  identity: { key: 'id' },
  fields: QLT_MEMORY_FIELDS.map((field) => ({
    name: field.name,
    type: field.type,
    required: field.required,
    label: field.label,
  })),
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: [...QLT_MEMORY_FILTER_FIELDS],
      pagination: true,
      projection: QLT_MEMORY_FIELDS.map((field) => field.name),
    },
  },
  mutations: QLT_MEMORY_MUTATION_OPS.map((op) => ({
    op,
    effect: 'write',
    idempotency: 'keyed',
    permissions: ['qlt.memory.write'],
  })),
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

// ---------------------------------------------------------------------------
// Closed input contracts (first fence at the released boundary; the handlers
// re-validate kind-shaped content through the frozen Q2 parse fence — the
// two-fence pattern)
// ---------------------------------------------------------------------------

const CEREMONY_ENUMS: Readonly<Record<string, readonly string[]>> = {
  epistemicType: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'],
  honestyState: ['known', 'likely', 'uncertain', 'stale', 'conflicted'],
  confidence: ['stated', 'qualified', 'uncertain'],
  loopKind: ['pending_action', 'undecided_question', 'expected_event'],
  recordKind: ['claim', 'commitment', 'open_loop'],
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function ceremonyContract(spec: QltContractSpec): Contract<Record<string, unknown>> {
  const fieldByName = new Map(spec.fields.map((field) => [field.name, field] as const));
  return {
    id: spec.id,
    revision: '1',
    expected: `closed bounded field set (${spec.fields.map((field) => field.name).join(', ')})`,
    parse(input: unknown) {
      if (!isPlainRecord(input)) {
        return {
          ok: false as const,
          issues: [{ code: 'INVALID', path: '(root)', message: 'input must be a plain object' }],
        };
      }
      const issues: { code: string; path: string; message: string }[] = [];
      for (const key of Object.keys(input)) {
        if (!fieldByName.has(key)) {
          issues.push({ code: 'INVALID', path: key, message: 'unknown input field' });
        }
      }
      for (const field of spec.fields) {
        const value = input[field.name];
        if (value === undefined) {
          if (spec.required.includes(field.name)) {
            issues.push({
              code: 'INVALID',
              path: field.name,
              message: 'required input field is missing',
            });
          }
          continue;
        }
        if (field.kind === 'string') {
          if (typeof value !== 'string' || value.length === 0) {
            issues.push({
              code: 'INVALID',
              path: field.name,
              message: 'must be a non-empty string',
            });
          } else if (value.length > (field.maxChars ?? 128)) {
            issues.push({
              code: 'INVALID',
              path: field.name,
              message: `must be at most ${field.maxChars ?? 128} characters`,
            });
          } else if (CEREMONY_ENUMS[field.name] !== undefined) {
            if (!CEREMONY_ENUMS[field.name]!.includes(value)) {
              issues.push({
                code: 'INVALID',
                path: field.name,
                message: 'value is outside the closed vocabulary',
              });
            }
          } else if (
            (field.name === 'threadId' ||
              field.name === 'proposalId' ||
              field.name === 'recordId') &&
            !SAFE_ID.test(value)
          ) {
            issues.push({
              code: 'INVALID',
              path: field.name,
              message: 'must be a bounded safe identifier',
            });
          }
        } else if (field.kind === 'number') {
          if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
            issues.push({
              code: 'INVALID',
              path: field.name,
              message: 'must be a finite safe integer',
            });
          }
        } else if (field.kind === 'object' && !isPlainRecord(value)) {
          issues.push({
            code: 'INVALID',
            path: field.name,
            message: 'must be a plain object',
          });
        }
      }
      if (issues.length > 0) {
        return { ok: false as const, issues };
      }
      return { ok: true as const, value: input };
    },
  };
}

/** The executable memory input contracts (registry order = frozen order). */
export const memoryContracts: readonly Contract<unknown>[] = QLT_MEMORY_CONTRACT_SPECS.map((spec) =>
  ceremonyContract(spec),
);

/** Canonical contract REGISTRY entries for the compiled plan (data only). */
export const memoryContractRegistry = QLT_MEMORY_CONTRACT_SPECS.map((spec) => ({
  id: spec.id,
  revision: '1',
}));

// ---------------------------------------------------------------------------
// Unified read projection (freeze §3 catalogue)
// ---------------------------------------------------------------------------

export interface MemorySurfaceDeps {
  /** The Q2 meaning repository (all ceremony writes; SQL lives there). */
  readonly meaning: SharedWorldMeaningStore;
  /** A-AMEND-1 read-only thread-scoped record listing (same connection). */
  readonly listRecordRows: (
    options: QltMemoryListOptions,
  ) => Promise<{ readonly rows: readonly QltMemoryListRowProjection[]; readonly total: number }>;
  /** Source-thread existence/retention lookups (staleness presentation). */
  readonly getThread: (id: string) => Promise<QltThread | undefined>;
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly userActorId: string;
}

export interface QltMemoryListRowProjection {
  readonly kind: 'claim' | 'commitment' | 'open_loop';
  readonly id: string;
  readonly status: string;
  readonly title: string;
  readonly text: string;
  readonly threadId: string;
  readonly turnRef: string;
  readonly actor: string;
  readonly decisionBy: string;
  readonly version: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

/** Deterministic bounded key derivation for internal keyed sub-steps. */
function derivedKey(prefix: string, idempotencyKey: string): string {
  return `${prefix}-${createHash('sha256').update(idempotencyKey, 'utf8').digest('hex').slice(0, 40)}`;
}

function memoryErrorResult(cause: QltMeaningError): ApplicationDataResult {
  return {
    ok: false,
    code: cause.code,
    message: cause.message,
  };
}

export function createMemorySurface(deps: MemorySurfaceDeps): {
  readonly resource: ResourceDefinition;
  readonly contracts: readonly Contract<unknown>[];
  readonly contractRegistry: readonly { readonly id: string; readonly revision: string }[];
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

  function authorize(
    effect: 'read' | 'write',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined {
    if (context.effect !== effect) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: 'Access was requested with an effect that does not match the operation.',
      };
    }
    const required = effect === 'read' ? 'qlt.memory.read' : 'qlt.memory.write';
    if (!context.permissions.includes(required)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${QLT_MEMORY_RESOURCE_ID}' requires permission '${required}'.`,
      };
    }
    return undefined;
  }

  async function projectProposal(proposal: QltProposal): Promise<Record<string, unknown>> {
    const sourceThread = await deps.getThread(proposal.sourceThreadId);
    let target: QltStalenessTarget | undefined;
    if (proposal.proposalKind === 'correction' && proposal.targetRecordId !== undefined) {
      const record = await subjectRecord(
        proposal.targetRecordFamily as QltSubjectFamily,
        proposal.targetRecordId,
      );
      if (record !== undefined) {
        target = {
          version: record.version,
          status: record.status,
          retentionState: record.retentionState,
        };
      }
    }
    const staleness = proposalStaleness(proposal, target, sourceThread);
    const pending = proposal.status === 'proposed' || proposal.status === 'awaiting_decision';
    const title =
      'subject' in proposal.content && typeof proposal.content.subject === 'string'
        ? proposal.content.subject
        : 'commitmentKey' in proposal.content && typeof proposal.content.commitmentKey === 'string'
          ? proposal.content.commitmentKey
          : `${proposal.proposalKind} proposal`;
    const text =
      'statement' in proposal.content && typeof proposal.content.statement === 'string'
        ? proposal.content.statement
        : 'detail' in proposal.content && typeof proposal.content.detail === 'string'
          ? proposal.content.detail
          : 'reason' in proposal.content && typeof proposal.content.reason === 'string'
            ? proposal.content.reason
            : '';
    return {
      id: proposal.id,
      kind: 'proposal',
      proposalKind: proposal.proposalKind,
      status: proposal.status,
      title,
      text,
      threadId: proposal.sourceThreadId,
      turnRef: proposal.sourceTurnRef ?? '',
      actor: proposal.proposedBy,
      decisionBy: proposal.decisionBy ?? '',
      stale: pending && staleness.stale ? 'true' : 'false',
      version: proposal.version,
      createdAt: proposal.createdAtMs,
      updatedAt: proposal.updatedAtMs,
    };
  }

  async function subjectRecord(
    family: QltSubjectFamily,
    id: string,
  ): Promise<QltSubjectRecord | undefined> {
    if (family === 'claim') {
      return deps.meaning.getClaim(id);
    }
    if (family === 'commitment') {
      return deps.meaning.getCommitment(id);
    }
    return deps.meaning.getOpenLoop(id);
  }

  function projectRecord(record: QltMemoryListRowProjection): Record<string, unknown> {
    return {
      id: record.id,
      kind: record.kind,
      proposalKind: '',
      status: record.status,
      title: record.title,
      text: record.text,
      threadId: record.threadId,
      turnRef: record.turnRef,
      actor: record.actor,
      decisionBy: record.decisionBy,
      stale: 'false',
      version: record.version,
      createdAt: record.createdAtMs,
      updatedAt: record.updatedAtMs,
    };
  }

  // ---- query (the declared `list`) ----------------------------------------

  async function query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const queryFields = new Set([
      'op',
      'resourceId',
      'filters',
      'sort',
      'limit',
      'offset',
      'projection',
    ]);
    for (const key of Object.keys(request)) {
      if (!queryFields.has(key)) {
        return {
          ok: false,
          code: 'DATA_INVALID_REQUEST',
          message: `Unknown query request field '${key}'.`,
        };
      }
    }
    const denied = authorize('read', context);
    if (denied !== undefined) {
      return denied;
    }
    if (request.op !== 'list') {
      return { ok: false, code: 'DATA_INVALID_REQUEST', message: 'Unknown query op.' };
    }
    for (const [name, value] of [
      ['limit', request.limit],
      ['offset', request.offset],
    ] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
        return {
          ok: false,
          code: 'DATA_INVALID_REQUEST',
          message: `${name} must be a non-negative safe integer when present.`,
        };
      }
    }
    const sort = request.sort?.at(0);
    if (sort !== undefined && !(QLT_MEMORY_SORT_FIELDS as readonly string[]).includes(sort.field)) {
      return {
        ok: false,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: `Sorting by '${sort.field}' is not declared for this resource.`,
      };
    }
    for (const field of request.projection ?? []) {
      if (!QLT_MEMORY_FIELDS.some((candidate) => candidate.name === field)) {
        return {
          ok: false,
          code: 'DATA_UNSUPPORTED_QUERY',
          message: `Unknown projection field '${field}'.`,
        };
      }
    }
    const filters: Record<string, string> = {};
    if (request.filters !== undefined) {
      if (
        typeof request.filters !== 'object' ||
        request.filters === null ||
        Array.isArray(request.filters)
      ) {
        return {
          ok: false,
          code: 'DATA_INVALID_REQUEST',
          message: 'The filter container must be a plain object.',
        };
      }
      for (const [key, value] of Object.entries(request.filters)) {
        if (!(QLT_MEMORY_FILTER_FIELDS as readonly string[]).includes(key)) {
          return {
            ok: false,
            code: 'DATA_UNSUPPORTED_QUERY',
            message: `Filtering by '${key}' is not declared for this resource.`,
          };
        }
        if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
          return {
            ok: false,
            code: 'DATA_INVALID_REQUEST',
            message: 'Filter values must be bounded strings.',
          };
        }
        if (key === 'kind' && !['proposal', 'claim', 'commitment', 'open_loop'].includes(value)) {
          return {
            ok: false,
            code: 'DATA_UNSUPPORTED_QUERY',
            message: 'Unknown kind filter value.',
          };
        }
        if (key === 'threadId' && !SAFE_ID.test(value)) {
          return {
            ok: false,
            code: 'DATA_INVALID_REQUEST',
            message: 'The thread filter must be a bounded safe identifier.',
          };
        }
        filters[key] = value;
      }
    }
    if (filters['threadId'] === undefined) {
      // Thread-scoped reads are the declared Q3 access shape (freeze §1:
      // minimal, thread-associated user access; no global memory browser).
      return {
        ok: false,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: 'A bounded threadId filter is required for memory reads.',
      };
    }

    const limit = Math.min(
      request.limit ?? QLT_MEMORY_LIST_DEFAULT_LIMIT,
      QLT_MEMORY_LIST_MAX_LIMIT,
    );
    const offset = request.offset ?? 0;
    const kind = filters['kind'];

    const rows: Record<string, unknown>[] = [];
    let total = 0;
    const wantProposals = kind === undefined || kind === 'proposal';
    const wantRecords = kind === undefined || kind !== 'proposal';

    if (wantProposals) {
      const page = await deps.meaning.listProposals({
        sourceThreadId: filters['threadId'],
        ...(filters['status'] !== undefined
          ? { status: filters['status'] as QltProposal['status'] }
          : {}),
        limit: QLT_MEMORY_LIST_MAX_LIMIT,
      });
      total += page.total;
      for (const proposal of page.rows) {
        rows.push(await projectProposal(proposal));
      }
    }
    if (wantRecords) {
      const statusFilter = filters['status'];
      const listed = await deps.listRecordRows({
        threadId: filters['threadId'],
        ...(kind === 'claim' || kind === 'commitment' || kind === 'open_loop' ? { kind } : {}),
        ...(statusFilter !== undefined ? { status: statusFilter } : {}),
        limit: QLT_MEMORY_LIST_MAX_LIMIT,
      });
      total += listed.total;
      for (const record of listed.rows) {
        rows.push(projectRecord(record));
      }
    }

    // Deterministic unified ordering: updatedAt DESC, id DESC tie-break.
    rows.sort((left, right) => {
      const leftUpdated = left['updatedAt'] as number;
      const rightUpdated = right['updatedAt'] as number;
      if (leftUpdated !== rightUpdated) {
        return rightUpdated - leftUpdated;
      }
      return (right['id'] as string) < (left['id'] as string) ? -1 : 1;
    });
    const sliced = rows.slice(offset, offset + limit);
    return { ok: true, rows: sliced, total };
  }

  // ---- mutation handlers (all user-attributed; freeze §9/§10) -------------

  async function awaitingSubStep(proposalId: string, actionKey: string): Promise<void> {
    const proposal = await deps.meaning.getProposal(proposalId);
    if (proposal !== undefined && proposal.status === 'proposed') {
      await deps.meaning.markProposalAwaitingDecision(proposalId, {
        key: derivedKey('aw', actionKey),
      });
    }
  }

  function meaningFailure(cause: unknown): ApplicationDataResult {
    if (
      cause !== null &&
      typeof cause === 'object' &&
      (cause as { name?: unknown }).name === 'QltMeaningError'
    ) {
      return memoryErrorResult(cause as QltMeaningError);
    }
    const message = String((cause as { message?: string }).message ?? '');
    if (message.includes('UNIQUE constraint failed')) {
      return {
        ok: false,
        code: 'QLT_RECORD_EXISTS',
        message: 'A record with this identity or open-ceremony key already exists.',
      };
    }
    if (message.includes('FOREIGN KEY constraint failed')) {
      return {
        ok: false,
        code: 'QLT_THREAD_MISSING',
        message: 'The referenced Shared World thread does not exist.',
      };
    }
    return {
      ok: false,
      code: 'QLT_STORE_ERROR',
      message: 'The memory action could not be completed; this safe failure is server-generated.',
    };
  }

  async function mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const mutationFields = new Set(['resourceId', 'op', 'input', 'id', 'idempotencyKey']);
    for (const key of Object.keys(request)) {
      if (!mutationFields.has(key)) {
        return {
          ok: false,
          code: 'DATA_INVALID_REQUEST',
          message: `Unknown mutation request field '${key}'.`,
        };
      }
    }
    const denied = authorize('write', context);
    if (denied !== undefined) {
      return denied;
    }
    if (!(QLT_MEMORY_MUTATION_OPS as readonly string[]).includes(request.op)) {
      return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
    }
    const input = (request.input ?? {}) as Record<string, unknown>;
    const idempotencyKey =
      typeof request.idempotencyKey === 'string' ? request.idempotencyKey : undefined;

    try {
      switch (request.op) {
        case 'confirmProposal': {
          const proposalId = input['proposalId'] as string;
          await awaitingSubStep(proposalId, idempotencyKey ?? proposalId);
          const outcome = await deps.meaning.confirmProposal({
            proposalId,
            confirmedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
          });
          return { ok: true, row: await projectProposal(outcome.proposal) };
        }
        case 'rejectProposal': {
          const proposalId = input['proposalId'] as string;
          await awaitingSubStep(proposalId, idempotencyKey ?? proposalId);
          const rejected = await deps.meaning.rejectProposal({
            proposalId,
            decidedBy: user,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: await projectProposal(rejected) };
        }
        case 'withdrawProposal': {
          const proposalId = input['proposalId'] as string;
          await awaitingSubStep(proposalId, idempotencyKey ?? proposalId);
          const withdrawn = await deps.meaning.withdrawProposal({
            proposalId,
            withdrawnBy: user,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: await projectProposal(withdrawn) };
        }
        case 'amendProposal': {
          const proposalId = input['proposalId'] as string;
          const original = await deps.meaning.getProposal(proposalId);
          if (original === undefined) {
            return {
              ok: false,
              code: 'QLT_RECORD_MISSING',
              message: 'The proposal does not exist.',
            };
          }
          const parsed = parseProposalContent(original.proposalKind, input['content']);
          if (!parsed.ok) {
            return {
              ok: false,
              code: 'QLT_INPUT_REJECTED',
              message: 'The amended content was rejected by the closed content contract.',
            };
          }
          await awaitingSubStep(proposalId, idempotencyKey ?? proposalId);
          const amended = await deps.meaning.amendProposal({
            proposalId,
            amendedBy: user,
            content: parsed.value,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: await projectProposal(amended.amendment) };
        }
        case 'createClaim': {
          const claim = await deps.meaning.createClaim({
            subject: input['subject'] as string,
            epistemicType: input['epistemicType'] as never,
            honestyState: input['honestyState'] as never,
            confidence: input['confidence'] as never,
            statement: input['statement'] as string,
            createdBy: user,
            ...(typeof input['threadId'] === 'string'
              ? { sourceThreadId: input['threadId'] as string }
              : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: projectBareRecord(
              'claim',
              claim.id,
              claim.status,
              claim.sourceThreadId,
              claim.sourceTurnRef,
              claim.version,
              claim.createdAtMs,
              claim.updatedAtMs,
            ),
          };
        }
        case 'createCommitment': {
          const commitment = await deps.meaning.createCommitment({
            commitmentKey: input['commitmentKey'] as string,
            statement: input['statement'] as string,
            createdBy: user,
            ...(typeof input['threadId'] === 'string'
              ? { sourceThreadId: input['threadId'] as string }
              : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: projectBareRecord(
              'commitment',
              commitment.id,
              commitment.status,
              commitment.sourceThreadId,
              commitment.sourceTurnRef,
              commitment.version,
              commitment.createdAtMs,
              commitment.updatedAtMs,
            ),
          };
        }
        case 'createOpenLoop': {
          const loop = await deps.meaning.createOpenLoop({
            subject: input['subject'] as string,
            loopKind: input['loopKind'] as never,
            detail: input['detail'] as string,
            createdBy: user,
            ...(typeof input['threadId'] === 'string'
              ? { sourceThreadId: input['threadId'] as string }
              : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: projectBareRecord(
              'open_loop',
              loop.id,
              loop.status,
              loop.sourceThreadId,
              loop.sourceTurnRef,
              loop.version,
              loop.createdAtMs,
              loop.updatedAtMs,
            ),
          };
        }
        case 'correctRecord': {
          const recordId = input['recordId'] as string;
          const recordKind = input['recordKind'] as QltSubjectFamily;
          const subject = await subjectRecord(recordKind, recordId);
          if (subject === undefined) {
            return {
              ok: false,
              code: 'QLT_RECORD_MISSING',
              message: 'The correction target does not exist.',
            };
          }
          // Family-shaped successor content, validated by the frozen fence.
          let content: { statement: string } | { detail: string };
          if (recordKind === 'open_loop') {
            const parsed = parseOpenLoopContent({ detail: input['detail'] });
            if (!parsed.ok) {
              return {
                ok: false,
                code: 'QLT_INPUT_REJECTED',
                message: 'The corrected content was rejected by the closed content contract.',
              };
            }
            content = parsed.value;
          } else {
            const parsed =
              recordKind === 'claim'
                ? parseClaimContent({ statement: input['statement'] })
                : parseCommitmentContent({ statement: input['statement'] });
            if (!parsed.ok) {
              return {
                ok: false,
                code: 'QLT_INPUT_REJECTED',
                message: 'The corrected content was rejected by the closed content contract.',
              };
            }
            content = parsed.value;
          }
          const correctionKey = derivedKey('corr', idempotencyKey ?? recordId);
          const outcome = await deps.meaning.applyCorrection({
            subjectRecordId: recordId,
            subjectFamily: recordKind,
            correctionKey,
            content,
            correctedBy: user,
            ...(typeof input['reason'] === 'string' ? { reason: input['reason'] as string } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            // The correction's source thread is the SUBJECT's thread,
            // derived server-side (the client supplies no thread identity).
            ...(subject.sourceThreadId !== undefined
              ? { sourceThreadId: subject.sourceThreadId }
              : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return {
            ok: true,
            row: projectBareRecord(
              recordKind,
              outcome.successor.id,
              outcome.successor.status,
              outcome.successor.sourceThreadId,
              outcome.successor.sourceTurnRef,
              outcome.successor.version,
              outcome.successor.createdAtMs,
              outcome.successor.updatedAtMs,
            ),
          };
        }
        case 'retireClaim':
        case 'releaseCommitment':
        case 'resolveLoop':
        case 'abandonLoop':
        case 'transformLoop': {
          const recordId = input['recordId'] as string;
          const reason = typeof input['reason'] === 'string' ? input['reason'] : undefined;
          if (reasonRequiredFor(request.op) && (reason === undefined || reason.length === 0)) {
            return {
              ok: false,
              code: 'QLT_INPUT_REJECTED',
              message: 'This exit requires a bounded reason (canonical §5.5).',
            };
          }
          const exitInput = {
            recordId,
            exitedBy: user,
            ...(reason !== undefined ? { reason } : {}),
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
          };
          if (request.op === 'retireClaim') {
            const claim = await deps.meaning.retireClaim(exitInput);
            return {
              ok: true,
              row: projectBareRecord(
                'claim',
                claim.id,
                claim.status,
                claim.sourceThreadId,
                claim.sourceTurnRef,
                claim.version,
                claim.createdAtMs,
                claim.updatedAtMs,
              ),
            };
          }
          if (request.op === 'releaseCommitment') {
            const commitment = await deps.meaning.releaseCommitment(exitInput);
            return {
              ok: true,
              row: projectBareRecord(
                'commitment',
                commitment.id,
                commitment.status,
                commitment.sourceThreadId,
                commitment.sourceTurnRef,
                commitment.version,
                commitment.createdAtMs,
                commitment.updatedAtMs,
              ),
            };
          }
          const loopExit = { ...exitInput, loopId: recordId };
          let loop: QltOpenLoop;
          if (request.op === 'resolveLoop') {
            loop = await deps.meaning.resolveLoop(loopExit);
          } else if (request.op === 'abandonLoop') {
            loop = await deps.meaning.abandonLoop(loopExit);
          } else {
            loop = await deps.meaning.transformLoop(loopExit);
          }
          return {
            ok: true,
            row: projectBareRecord(
              'open_loop',
              loop.id,
              loop.status,
              loop.sourceThreadId,
              loop.sourceTurnRef,
              loop.version,
              loop.createdAtMs,
              loop.updatedAtMs,
            ),
          };
        }
        default:
          return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
      }
    } catch (cause) {
      return meaningFailure(cause);
    }
  }

  return {
    resource: memoryResource,
    contracts: memoryContracts,
    contractRegistry: memoryContractRegistry,
    query,
    mutate,
  };
}

function reasonRequiredFor(op: string): boolean {
  return op === 'abandonLoop' || op === 'transformLoop';
}

/** bounded bare-record projection for creates/exits. */
function projectBareRecord(
  kind: string,
  id: string,
  status: string,
  threadId: string | undefined,
  turnRef: string | undefined,
  version: number,
  createdAtMs: number,
  updatedAtMs: number,
): Record<string, unknown> {
  return {
    id,
    kind,
    proposalKind: '',
    status,
    title: '',
    text: '',
    threadId: threadId ?? '',
    turnRef: turnRef ?? '',
    actor: '',
    decisionBy: '',
    stale: 'false',
    version,
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
  };
}
