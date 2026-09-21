/**
 * The Q5 governed Shared World INSPECTION application surface (Lane B).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md and the
 * frozen declarative module `inspection-contract.ts` (resource identity,
 * closed query-op vocabulary, buckets, bounds, usage states, origin
 * labels, stable codes). This module conforms to that data and contains
 * the executable read surface.
 *
 * Authority (freeze §6): this is a USER-FACING READ-ONLY surface exposed
 * ONLY through the released read boundary (`app.data.query` via
 * `/api/act`). It gives the agent NOTHING: the capability envelope remains
 * proposal-draft-only (`qlt.proposal.draft@2` as of the VICT-M-1
 * remediation), and this surface requires the
 * `qlt.inspection.read` permission that no agent context ever carries.
 * An `agent-*` actor identity fails closed with zero effect. Every read
 * is bounded, deterministically ordered, and free of durable effect.
 * Historical turns are reported from RECORDED evidence only — never
 * recomputed with current records or the current Memory Mode.
 */

import type {
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ResourceDefinition } from '@victframework/sdk';
import {
  QLT_INSPECTION_BUCKETS,
  QLT_INSPECTION_USAGE_LABELS,
  QLT_INSPECTION_FILTER_FIELDS,
  QLT_INSPECTION_KIND_FILTERS,
  QLT_INSPECTION_LIST_DEFAULT_LIMIT,
  QLT_INSPECTION_LIST_MAX_LIMIT,
  QLT_INSPECTION_ORIGIN_LABELS,
  QLT_INSPECTION_QUERY_OPS,
  QLT_INSPECTION_READ_PERMISSION,
  QLT_INSPECTION_RESOURCE_ID,
  QLT_INSPECTION_RESOURCE_REVISION,
} from './inspection-contract.js';
import type { QltContextAssemblyRecord } from './context-assembler.js';

/** The inspection resource definition (adapter mirror of the declared plan). */
export const inspectionResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: QLT_INSPECTION_RESOURCE_ID,
  revision: QLT_INSPECTION_RESOURCE_REVISION,
  identity: { key: 'id' },
  fields: [{ name: 'query', type: 'string', required: true, label: 'Query' }],
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: [...QLT_INSPECTION_FILTER_FIELDS],
      pagination: true,
      projection: ['query'],
    },
  },
  mutations: [],
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

/** Human phrasing of the frozen stable exclusion reasons (bounded evidence). */
const EXCLUSION_REASON_LABELS: Readonly<Record<string, string>> = {
  ineligible: 'not currently eligible (its status no longer carries confirmed memory)',
  superseded: 'superseded by a newer version of the same record',
  'retention-ineligible': 'removed from current relevance',
  'provenance-invalid': 'excluded as a safety measure (invalid provenance)',
  'integrity-failed': 'excluded as a safety measure (failed an integrity check)',
  'conflict-ambiguous': 'withheld because two or more current records conflict on the same subject',
  budget: 'did not fit the reply budget for this turn',
  'evaluation-failed': 'excluded as a safety measure (could not be evaluated)',
  'scope-excluded':
    'saved in another conversation or without a conversation, and this reply used only this conversation’s memory',
};

/** Human kind labels (inspection projection). */
function kindLabel(kind: string, proposalKind: string): string {
  const effective = kind === 'proposal' ? proposalKind : kind;
  if (effective === 'claim') return 'Claim';
  if (effective === 'commitment') return 'Commitment';
  if (effective === 'open_loop') return 'Open question';
  if (effective === 'correction') return 'Correction proposal';
  return effective;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    proposed: 'pending',
    awaiting_decision: 'pending',
    active: 'current',
    open: 'open',
    superseded: 'superseded (a newer version replaced it)',
    retired: 'retired by you',
    released: 'released by you',
    resolved: 'resolved by you',
    abandoned: 'abandoned by you',
    transformed: 'transformed by you',
    confirmed: 'confirmed',
    rejected: 'rejected',
    amended: 'amended',
    withdrawn: 'withdrawn',
  };
  return map[status] ?? status;
}

/** One bounded, safe parsed-parameter bundle for one inspection query. */
interface InspectionParams {
  readonly query: string;
  readonly bucket?: string;
  readonly threadId?: string;
  readonly kind?: string;
  readonly recordId?: string;
  readonly recordKind?: string;
  readonly turnId?: string;
  readonly limit: number;
  readonly offset: number;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function invalidResult(code: string, message: string): ApplicationDataResult {
  return { ok: false, code, message };
}

export interface InspectionSurfaceDeps {
  readonly listRecords: (options: {
    readonly bucket: 'pending' | 'current' | 'history';
    readonly threadId?: string;
    readonly kind?: 'claim' | 'commitment' | 'open_loop' | 'proposal';
    readonly limit: number;
    readonly offset: number;
  }) => Promise<{
    readonly rows: readonly Record<string, unknown>[];
    readonly total: number;
  }>;
  readonly getRecord: (
    recordId: string,
    recordKind: 'claim' | 'commitment' | 'open_loop',
  ) => Promise<Record<string, unknown> | undefined>;
  readonly getProposal: (proposalId: string) => Promise<Record<string, unknown> | undefined>;
  readonly listTurns: (
    threadId: string,
    limit: number,
    offset: number,
  ) => Promise<{
    readonly rows: readonly Record<string, unknown>[];
    readonly total: number;
  }>;
  readonly getTurnData: (
    threadId: string,
    turnId: string,
  ) => Promise<
    | {
        readonly assembly: QltContextAssemblyRecord;
        readonly policy:
          | {
              readonly policyId: string;
              readonly mode: string;
              readonly policyRevision: number;
              readonly recordedAtMs: number;
            }
          | undefined;
      }
    | undefined
  >;
  readonly getRecordsByIds: (ids: readonly string[]) => Promise<readonly Record<string, unknown>[]>;
  /**
   * The current Memory Mode policy (getPolicy). Q5-B-1 (remediation
   * contract §2): a PURE peek. While the default is implicit (no durable
   * row yet) `updatedAtMs` is `null` and `persisted` is `false` — no
   * fabricated timestamp and no persisted-row claim; once a legitimate
   * write path has established the row, the durable update time and
   * `persisted: true` are reported.
   */
  readonly getPolicy: () => {
    readonly policyId: string;
    readonly mode: string;
    readonly label: string;
    readonly revision: number;
    readonly updatedAtMs: number | null;
    readonly persisted: boolean;
  };
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly userActorId: string;
}

function parseBoundedInt(value: unknown, fallback: number, max: number): number | undefined {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (!/^[0-9]{1,9}$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) {
    return undefined;
  }
  return parsed;
}

export function createInspectionSurface(deps: InspectionSurfaceDeps): {
  readonly resource: ResourceDefinition;
  query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
} {
  function authorize(
    effect: 'read',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined {
    if (context.effect !== effect) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: 'Access was requested with an effect that does not match the operation.',
      };
    }
    if (!context.permissions.includes(QLT_INSPECTION_READ_PERMISSION)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${QLT_INSPECTION_RESOURCE_ID}' requires permission '${QLT_INSPECTION_READ_PERMISSION}'.`,
      };
    }
    return undefined;
  }

  function parseParams(
    filters: Record<string, unknown> | undefined,
  ): InspectionParams | ApplicationDataResult {
    const params: Record<string, string> = {};
    if (filters !== undefined) {
      for (const [key, value] of Object.entries(filters)) {
        if (!(QLT_INSPECTION_FILTER_FIELDS as readonly string[]).includes(key)) {
          return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', `Unknown filter '${key}'.`);
        }
        if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
          return invalidResult(
            'QLT_INSPECTION_UNSUPPORTED_QUERY',
            'Filter values must be bounded strings.',
          );
        }
        params[key] = value;
      }
    }
    const query = params['query'];
    if (query === undefined || !(QLT_INSPECTION_QUERY_OPS as readonly string[]).includes(query)) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Unknown inspection query.');
    }
    for (const key of ['threadId', 'recordId', 'turnId'] as const) {
      const value = params[key];
      if (value !== undefined && !SAFE_ID.test(value)) {
        return invalidResult(
          'QLT_INSPECTION_UNSUPPORTED_QUERY',
          `The ${key} must be a bounded safe identifier.`,
        );
      }
    }
    if (
      params['bucket'] !== undefined &&
      !(QLT_INSPECTION_BUCKETS as readonly string[]).includes(params['bucket'])
    ) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Unknown inspection bucket.');
    }
    if (
      params['kind'] !== undefined &&
      !(QLT_INSPECTION_KIND_FILTERS as readonly string[]).includes(params['kind'])
    ) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Unknown inspection kind filter.');
    }
    if (
      params['recordKind'] !== undefined &&
      !['claim', 'commitment', 'open_loop'].includes(params['recordKind'])
    ) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Unknown record kind.');
    }
    const limit = parseBoundedInt(
      params['limit'],
      QLT_INSPECTION_LIST_DEFAULT_LIMIT,
      QLT_INSPECTION_LIST_MAX_LIMIT,
    );
    if (limit === undefined) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Invalid limit.');
    }
    const offset = parseBoundedInt(params['offset'], 0, 1_000_000);
    if (offset === undefined) {
      return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Invalid offset.');
    }
    return {
      query,
      bucket: params['bucket'],
      threadId: params['threadId'],
      kind: params['kind'],
      recordId: params['recordId'],
      recordKind: params['recordKind'],
      turnId: params['turnId'],
      limit,
      offset,
    };
  }

  /** Human origin label from the origin thread id and the open thread. */
  function originLabel(originThreadId: string | null, currentThreadId: string | undefined): string {
    if (originThreadId === null) {
      return QLT_INSPECTION_ORIGIN_LABELS.global;
    }
    if (currentThreadId !== undefined && originThreadId === currentThreadId) {
      return QLT_INSPECTION_ORIGIN_LABELS.current;
    }
    return QLT_INSPECTION_ORIGIN_LABELS.other;
  }

  function projectRecordRow(row: Record<string, unknown>): Record<string, unknown> {
    const kind = String(row['kind'] ?? '');
    const proposalKind = String(row['proposalKind'] ?? '');
    return {
      kind,
      kindLabel: kindLabel(kind, proposalKind),
      proposalKind,
      status: String(row['status'] ?? ''),
      statusLabel: statusLabel(String(row['status'] ?? '')),
      title: String(row['title'] ?? ''),
      text: String(row['text'] ?? ''),
      originThreadId: row['originThreadId'] ?? null,
      turnRef: String(row['turnRef'] ?? ''),
      actor: String(row['actor'] ?? ''),
      decisionBy: String(row['decisionBy'] ?? ''),
      exitReason: row['exitReason'] ?? null,
      exitedAtMs: row['exitedAtMs'] ?? null,
      version: Number(row['version'] ?? 1),
      createdAtMs: Number(row['createdAtMs'] ?? 0),
      updatedAtMs: Number(row['updatedAtMs'] ?? 0),
      createdRecordId: row['createdRecordId'] ?? null,
      details: {
        recordId: String(row['id'] ?? ''),
        contentFingerprint: String(row['contentFingerprint'] ?? ''),
        retentionState: String(row['retentionState'] ?? ''),
      },
    };
  }

  function requireParam(
    params: InspectionParams,
    key: 'recordId' | 'turnId' | 'threadId',
  ): string | ApplicationDataResult {
    const value = params[key];
    if (value === undefined) {
      return invalidResult('QLT_INSPECTION_MISSING_PARAM', `The '${key}' parameter is required.`);
    }
    return value;
  }

  function usageStateOf(
    assembly: QltContextAssemblyRecord | undefined,
    policyMode: string | undefined,
  ): string {
    if (assembly === undefined) {
      return 'unrecorded';
    }
    if (policyMode === 'off') {
      return 'off';
    }
    if (assembly.outcome === 'failed') {
      return 'unavailable';
    }
    if (assembly.outcome === 'complete' && assembly.selectedIds.length > 0) {
      return 'used';
    }
    const scoped = (assembly.excluded as readonly { reason?: string }[]).some(
      (entry) =>
        entry !== null && typeof entry === 'object' && entry['reason'] === 'scope-excluded',
    );
    return scoped ? 'scope-empty' : 'none';
  }

  async function turnDetail(threadId: string, turnId: string): Promise<ApplicationDataResult> {
    const data = await deps.getTurnData(threadId, turnId);
    if (data === undefined) {
      return invalidResult(
        'QLT_INSPECTION_TURN_MISSING',
        'No recorded assembly exists for this turn.',
      );
    }
    const { assembly, policy } = data;
    const usage = usageStateOf(assembly, policy?.mode);
    const rows = await deps.getRecordsByIds(assembly.selectedIds.map((entry) => entry.id));
    const byId = new Map(rows.map((row) => [String(row['id'] ?? ''), row] as const));
    const selected = assembly.selectedIds.map((entry) => {
      const row = byId.get(entry.id);
      if (row === undefined) {
        // Truthful tombstone: the selected record row no longer exists.
        return {
          kind: entry.kind,
          kindLabel: kindLabel(entry.kind, ''),
          origin: 'unavailable',
          selectedVersion: entry.version,
          content: null,
          tombstone: 'unavailable',
          details: { recordId: entry.id },
        };
      }
      const retention = String(row['retentionState'] ?? '');
      const originThreadId = row['originThreadId'];
      return {
        kind: entry.kind,
        kindLabel: kindLabel(entry.kind, ''),
        origin: originLabel(
          originThreadId === null || originThreadId === undefined ? null : String(originThreadId),
          assembly.threadId,
        ),
        selectedVersion: entry.version,
        currentVersion: Number(row['version'] ?? 0),
        supersededSince: row['hasSuccessor'] === true,
        content: retention === 'user-removed' ? null : String(row['text'] ?? ''),
        tombstone: retention === 'user-removed' ? 'removed' : null,
        title: String(row['title'] ?? ''),
        details: { recordId: entry.id },
      };
    });
    const truncatedEntry = (assembly.excluded as readonly unknown[]).find(
      (entry) =>
        entry !== null && typeof entry === 'object' && 'truncatedBeyond' in (entry as object),
    ) as { truncatedBeyond?: number } | undefined;
    const exclusions = (assembly.excluded as readonly unknown[])
      .filter(
        (entry) => entry !== null && typeof entry === 'object' && 'reason' in (entry as object),
      )
      .map((entry) => {
        const record = entry as { id?: unknown; kind?: unknown; reason?: unknown };
        const reason = String(record['reason'] ?? '');
        return {
          kindLabel: kindLabel(String(record['kind'] ?? ''), ''),
          reason,
          reasonLabel: EXCLUSION_REASON_LABELS[reason] ?? reason,
          details: { recordId: String(record['id'] ?? '') },
        };
      });
    return {
      ok: true,
      row: {
        usage,
        usageLabel: usageStateLabel(usage, assembly.selectedIds.length),
        appliedPolicy: policy
          ? {
              policyId: policy.policyId,
              mode: policy.mode,
              revision: policy.policyRevision,
              recordedAtMs: policy.recordedAtMs,
            }
          : null,
        usedCount: assembly.selectedIds.length,
        selected,
        exclusions,
        exclusionsAreBoundedSubset: truncatedEntry !== undefined,
        excludedBeyondCount: truncatedEntry?.truncatedBeyond ?? null,
        details: {
          turnId: assembly.turnId,
          threadId: assembly.threadId,
          assemblerVersion: assembly.assemblerVersion,
          fingerprint: assembly.fingerprint,
          renderedBytes: assembly.renderedBytes,
          maxRecords: assembly.maxRecords,
          maxBytes: assembly.maxBytes,
          orderingIdentity: assembly.orderingIdentity,
          createdAtMs: assembly.createdAtMs,
          ...(assembly.failureCode !== undefined ? { failureCode: assembly.failureCode } : {}),
        },
      },
    };
  }

  function usageStateLabel(usage: string, usedCount: number): string {
    if (usage === 'used') {
      return usedCount === 1
        ? 'This reply used 1 memory.'
        : `This reply used ${usedCount} memories.`;
    }
    return QLT_INSPECTION_USAGE_LABELS[usage] ?? usage;
  }

  async function query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const denied = authorize('read', context);
    if (denied !== undefined) {
      return denied;
    }
    // Server-resolved actor authority: the released boundary derives the
    // actor; an agent identity can never read inspection data.
    const actorId = (request as unknown as Record<string, unknown>)['actorId'];
    if (typeof actorId === 'string' && actorId.startsWith('agent-')) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: 'Inspection is user-only surface.',
      };
    }
    const filters = request.filters as Record<string, unknown> | undefined;
    const params = parseParams(filters);
    if ('ok' in params) {
      return params;
    }
    switch (params.query) {
      case 'listRecords': {
        const bucket = params.bucket;
        if (bucket === undefined) {
          return invalidResult(
            'QLT_INSPECTION_MISSING_PARAM',
            "The 'bucket' parameter is required.",
          );
        }
        const page = await deps.listRecords({
          bucket: bucket as 'pending' | 'current' | 'history',
          ...(params.threadId !== undefined ? { threadId: params.threadId } : {}),
          ...(params.kind !== undefined
            ? { kind: params.kind as 'claim' | 'commitment' | 'open_loop' | 'proposal' }
            : {}),
          limit: params.limit,
          offset: params.offset,
        });
        return {
          ok: true,
          rows: page.rows.map(projectRecordRow),
          total: page.total,
        };
      }
      case 'getRecord': {
        const recordId = requireParam(params, 'recordId');
        if (typeof recordId !== 'string') {
          return recordId;
        }
        const recordKind = params.recordKind;
        if (recordKind === undefined) {
          return invalidResult(
            'QLT_INSPECTION_MISSING_PARAM',
            "The 'recordKind' parameter is required.",
          );
        }
        if (recordKind === 'proposal') {
          const detail = await deps.getProposal(recordId);
          if (detail === undefined) {
            return invalidResult('QLT_INSPECTION_RECORD_MISSING', 'No such proposal.');
          }
          return { ok: true, row: detail };
        }
        const detail = await deps.getRecord(
          recordId,
          recordKind as 'claim' | 'commitment' | 'open_loop',
        );
        if (detail === undefined) {
          return invalidResult('QLT_INSPECTION_RECORD_MISSING', 'No such record.');
        }
        return { ok: true, row: detail };
      }
      case 'listTurns': {
        const threadId = requireParam(params, 'threadId');
        if (typeof threadId !== 'string') {
          return threadId;
        }
        const page = await deps.listTurns(threadId, params.limit, params.offset);
        return {
          ok: true,
          rows: page.rows.map((row) => {
            const mode = row['memoryMode'];
            return {
              ...row,
              memoryModeLabel:
                typeof mode === 'string' && mode !== ''
                  ? ({
                      'across-conversations': 'Across conversations',
                      'per-conversation': 'Within each conversation only',
                      off: 'Memory off',
                    }[mode] ?? mode)
                  : 'Not recorded (this reply predates Memory Mode)',
            };
          }),
          total: page.total,
        };
      }
      case 'getTurn': {
        const threadId = requireParam(params, 'threadId');
        if (typeof threadId !== 'string') {
          return threadId;
        }
        const turnId = requireParam(params, 'turnId');
        if (typeof turnId !== 'string') {
          return turnId;
        }
        return turnDetail(threadId, turnId);
      }
      case 'getPolicy': {
        const policy = deps.getPolicy();
        return {
          ok: true,
          row: {
            policyId: policy.policyId,
            mode: policy.mode,
            modeLabel: policy.label,
            revision: policy.revision,
            updatedAtMs: policy.updatedAtMs,
            persisted: policy.persisted,
          },
        };
      }
      default:
        return invalidResult('QLT_INSPECTION_UNSUPPORTED_QUERY', 'Unknown inspection query.');
    }
  }

  return { resource: inspectionResource, query };
}
