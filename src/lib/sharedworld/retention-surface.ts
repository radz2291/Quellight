/**
 * The Stage 07D Lane A governed retention application surface.
 *
 * FROZEN CONTRACT: the D1a freeze (`d1-contract.ts`; freeze report §10).
 * This module declares the `qlt.retention` resource (ONE list query;
 * EXACTLY the three frozen mutations `removeRecord`, `setClaimExpiry`,
 * `runRetentionPass`), the closed input contracts (first fence at the
 * released boundary), and their handlers (second fence re-validation).
 *
 * Authority: every mutation is USER-attributed through the SERVER-DERIVED
 * local actor (never client-supplied); an `agent-*` identity fails closed.
 * All writes cross the ONE released governed boundary (`app.data.mutate`
 * via `/api/act`) with keyed idempotency; reads are bounded and
 * deterministic. The UI presentation is QUIET per the frozen
 * `QLT_D1_UI_PROHIBITED`/`QLT_D1_UI_REQUIRED` rules: plain list rows only,
 * no interrupting effect exists in or behind this surface.
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
  QLT_D1_CONTRACT_SPECS,
  QLT_RETENTION_ACTION_IDS,
  QLT_RETENTION_MUTATION_OPS,
  QLT_RETENTION_READ_PERMISSION,
  QLT_RETENTION_RESOURCE_ID,
  QLT_RETENTION_RESOURCE_REVISION,
  QLT_RETENTION_WRITE_PERMISSION,
  type QltD1ContractSpec,
  type QltD1RetentionState,
} from './d1-contract.js';
import {
  QLT_SUBJECT_FAMILIES,
  QltMeaningError,
  type QltSubjectFamily,
} from './meaning-contract.js';
import type {
  QltRetentionPassReport,
  QltRetentionRecordView,
  SharedWorldRetentionStore,
} from './retention-store.js';

// ---------------------------------------------------------------------------
// Resource definition (frozen inventory; adapter mirror)
// ---------------------------------------------------------------------------

export const retentionResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: QLT_RETENTION_RESOURCE_ID,
  revision: QLT_RETENTION_RESOURCE_REVISION,
  identity: { key: 'recordId' },
  fields: [
    { name: 'recordId', type: 'string', required: true, label: 'Record' },
    { name: 'family', type: 'string', required: true, label: 'Kind' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'retentionState', type: 'string', required: true, label: 'Retention state' },
    { name: 'version', type: 'number', required: true, label: 'Version' },
    { name: 'expiresAt', type: 'string', required: true, label: 'Expires at' },
    { name: 'removedAt', type: 'string', required: true, label: 'Removed at' },
    { name: 'removedBy', type: 'string', required: true, label: 'Removed by' },
    { name: 'threadId', type: 'string', required: true, label: 'Thread' },
    { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
  ],
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: ['family', 'retentionState', 'threadId'],
      pagination: true,
      projection: [
        'recordId',
        'family',
        'status',
        'retentionState',
        'version',
        'expiresAt',
        'removedAt',
        'removedBy',
        'threadId',
        'updatedAt',
      ],
    },
  },
  mutations: QLT_RETENTION_MUTATION_OPS.map((op) => ({
    op,
    effect: 'write',
    idempotency: 'keyed',
    permissions: [QLT_RETENTION_WRITE_PERMISSION],
  })),
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

// ---------------------------------------------------------------------------
// Closed input contracts (first fence; spec data frozen in d1-contract §4)
// ---------------------------------------------------------------------------

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Runtime contract built from the frozen D1a spec data (two-fence pattern). */
export function d1ContractFromSpec(spec: QltD1ContractSpec): Contract<Record<string, unknown>> {
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
          } else if (
            (field.name === 'recordId' ||
              field.name === 'claimId' ||
              field.name === 'commitmentId' ||
              field.name === 'challengeId') &&
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
        }
      }
      if (issues.length > 0) {
        return { ok: false as const, issues };
      }
      return { ok: true as const, value: input };
    },
  };
}

/** The executable retention input contracts (registry order = frozen order). */
export const retentionContracts: readonly Contract<unknown>[] = QLT_D1_CONTRACT_SPECS.filter(
  (spec) => spec.id.startsWith('qlt.retention.'),
).map((spec) => d1ContractFromSpec(spec));

export const retentionContractRegistry = QLT_D1_CONTRACT_SPECS.filter((spec) =>
  spec.id.startsWith('qlt.retention.'),
).map((spec) => ({ id: spec.id, revision: '1' as const }));

// ---------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------

export interface RetentionSurfaceDeps {
  readonly retention: SharedWorldRetentionStore;
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly userActorId: string;
}

function projectionOf(view: QltRetentionRecordView): Record<string, unknown> {
  return {
    recordId: view.recordId,
    family: view.family,
    status: view.status,
    retentionState: view.retentionState,
    version: view.version,
    // Nulls project as the EMPTY STRING (a string-typed field carries no
    // sentinel number; the empty string truthfully means "none").
    expiresAt: view.expiresAtMs === null ? '' : String(view.expiresAtMs),
    removedAt: view.removedAtMs === null ? '' : String(view.removedAtMs),
    removedBy: view.removedBy ?? '',
    threadId: view.sourceThreadId ?? '',
    updatedAt: view.updatedAtMs,
  };
}

function projectionOfPass(report: QltRetentionPassReport): Record<string, unknown> {
  return {
    recordId: report.passId,
    family: 'retention_pass',
    status: 'recorded',
    retentionState: '',
    version: 1,
    expiresAt: '',
    removedAt: '',
    removedBy: report.ranBy,
    threadId: '',
    updatedAt: report.ranAtMs,
    examined: report.examined,
    expiredCount: report.expiredCount,
    expiredIds: report.expiredIds.join(','),
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
  const message = String((cause as { message?: string }).message ?? '');
  if (message.includes('UNIQUE constraint failed')) {
    return {
      ok: false,
      code: 'QLT_RECORD_EXISTS',
      message: 'A record with this identity already exists.',
    };
  }
  return {
    ok: false,
    code: 'QLT_STORE_ERROR',
    message: 'The retention action could not be completed; this safe failure is server-generated.',
  };
}

export function createRetentionSurface(deps: RetentionSurfaceDeps): {
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
    const required =
      effect === 'read' ? QLT_RETENTION_READ_PERMISSION : QLT_RETENTION_WRITE_PERMISSION;
    if (!context.permissions.includes(required)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${QLT_RETENTION_RESOURCE_ID}' requires permission '${required}'.`,
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
      if (!['family', 'retentionState', 'threadId'].includes(key)) {
        return {
          ok: false,
          code: 'DATA_UNSUPPORTED_QUERY',
          message: `Filtering by '${key}' is not declared for this resource.`,
        };
      }
    }
    try {
      const page = await deps.retention.listRecordViews({
        family:
          typeof filters['family'] === 'string'
            ? (filters['family'] as QltSubjectFamily)
            : undefined,
        retentionState:
          typeof filters['retentionState'] === 'string'
            ? (filters['retentionState'] as QltD1RetentionState)
            : undefined,
        threadId: typeof filters['threadId'] === 'string' ? filters['threadId'] : undefined,
        ...(typeof request.limit === 'number' ? { limit: request.limit } : {}),
        ...(typeof request.offset === 'number' ? { offset: request.offset } : {}),
      });
      return { ok: true, rows: page.rows.map(projectionOf), total: page.total };
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
    if (!(QLT_RETENTION_MUTATION_OPS as readonly string[]).includes(request.op)) {
      return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
    }
    // The user identity is SERVER-DERIVED; an agent identity can never
    // reach this surface through any path (defense in depth).
    if (user.startsWith('agent-')) {
      return {
        ok: false,
        code: 'QLT_INPUT_INVALID_IDENTITY',
        message: 'A retention action requires a user identity.',
      };
    }
    const input = (request.input ?? {}) as Record<string, unknown>;
    const idempotencyKey =
      typeof request.idempotencyKey === 'string' ? request.idempotencyKey : undefined;
    try {
      switch (request.op) {
        case 'removeRecord': {
          const view = await deps.retention.removeRecord({
            recordId: input['recordId'] as string,
            family: input['recordKind'] as QltSubjectFamily,
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            removedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: projectionOf(view) };
        }
        case 'setClaimExpiry': {
          const view = await deps.retention.setClaimExpiry({
            claimId: input['claimId'] as string,
            ...(input['expiresAtMs'] !== undefined
              ? { expiresAtMs: input['expiresAtMs'] as number }
              : {}),
            ...(typeof input['expectedVersion'] === 'number'
              ? { expectedVersion: input['expectedVersion'] as number }
              : {}),
            assignedBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: projectionOf(view) };
        }
        case 'runRetentionPass': {
          const report = await deps.retention.runRetentionPass({
            ranBy: user,
            ...(idempotencyKey !== undefined ? { key: idempotencyKey } : {}),
          });
          return { ok: true, row: projectionOfPass(report) };
        }
        default:
          return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
      }
    } catch (cause) {
      return d1Failure(cause);
    }
  }

  return {
    resource: retentionResource,
    contracts: retentionContracts,
    contractRegistry: retentionContractRegistry,
    actionIds: QLT_RETENTION_ACTION_IDS,
    query,
    mutate,
  };
}

/** Guard reference to keep the closed family vocabulary import-bound. */
export const QLT_RETENTION_FAMILIES = QLT_SUBJECT_FAMILIES;
