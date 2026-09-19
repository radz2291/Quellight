/**
 * The Quellight-owned Shared World SQLite adapter (Stage 07 architecture
 * §6.3; handoff §6, §8.6).
 *
 * - `shared-world.db` is QUELLIGHT-OWNED durable state, physically
 *   separate from the VICT operational store and the Mastra store;
 * - migrations are versioned and forward-only (`migrations.ts`);
 * - the domain port (`SharedWorldPort`) is the ONLY writer; every write is
 *   user-initiated. The conversation/model path never receives a writer
 *   (proven by negative control N-12);
 * - the same module also exposes the thread resource through the VICT
 *   Application Layer `ApplicationDataAdapter` port so the structured
 *   surface and the /api action boundary cross the typed DATA-014
 *   discipline: authorization, declared mutations, contract-validated
 *   input, keyed idempotency recorded in the SAME transaction as the row.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type {
  ApplicationDataAdapter,
  ApplicationDataQueryRequest,
  ApplicationDataMutationRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ResourceDefinition } from '@victframework/sdk';
import type { Contract } from '@victframework/contracts';
import {
  QLT_THREAD_PROVENANCE,
  QltSharedWorldError,
  type CreateThreadInput,
  type QltRetentionState,
  type QltThread,
  type QltThreadConversation,
  type QltThreadState,
  type SharedWorldPort,
} from './port.js';
import type { SharedWorldMeaningStore } from './meaning-contract.js';
import { createSharedWorldMeaningStore } from './meaning-store.js';
import { runSharedWorldMigrations } from './migrations.js';
import type { ContextCandidateRow, QltContextAssemblyRecord } from './context-assembler.js';
import { QLT_CONTEXT_MAX_RECORDS, QLT_CONTEXT_SCAN_LIMIT_PER_FAMILY } from './context-contract.js';
import { createMemoryPolicyStore, type MemoryPolicyStore } from './memory-policy.js';

const MAX_TITLE_LENGTH = 200;
const MAX_ID_LENGTH = 128;

interface ThreadRow {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly retention_state: string;
  readonly provenance: string;
  readonly created_at_ms: number;
  readonly updated_at_ms: number;
}

function rowToThread(row: ThreadRow): QltThread {
  return {
    id: row.id,
    title: row.title,
    state: row.state as QltThreadState,
    retentionState: row.retention_state as QltRetentionState,
    provenance: row.provenance as typeof QLT_THREAD_PROVENANCE,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

/** The Shared World thread resource definition (mirrors the Application Definition). */
export const sharedWorldThreadResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'qlt.threads',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'state', type: 'string', required: true, label: 'State' },
    { name: 'retentionState', type: 'string', required: true, label: 'Retention state' },
    { name: 'createdAt', type: 'number', required: true, label: 'Created at' },
    { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
  ],
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: ['state'],
      pagination: true,
      projection: ['id', 'title', 'state', 'retentionState', 'createdAt', 'updatedAt'],
    },
  },
  mutations: [
    { op: 'create', effect: 'write', idempotency: 'keyed', permissions: ['qlt.threads.write'] },
    { op: 'rename', effect: 'write', permissions: ['qlt.threads.write'] },
    { op: 'archive', effect: 'write', permissions: ['qlt.threads.write'] },
    { op: 'reopen', effect: 'write', permissions: ['qlt.threads.write'] },
  ],
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

/** The declared mutation input contracts of the thread resource. */
function contract(
  id: string,
  acceptedFields: readonly string[],
  maxLength: number,
): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded plain-string fields; no exotic shapes (conversation content is untrusted)',
    parse: (input: unknown) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return {
          ok: false as const,
          issues: [{ code: 'INVALID', path: '(root)', message: 'input must be a plain object' }],
        };
      }
      const record = input as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!acceptedFields.includes(key)) {
          return {
            ok: false as const,
            issues: [{ code: 'INVALID', path: key, message: 'unknown input field' }],
          };
        }
        const value = record[key];
        if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
          return {
            ok: false as const,
            issues: [
              {
                code: 'INVALID',
                path: key,
                message: `must be a non-empty string of at most ${maxLength} characters`,
              },
            ],
          };
        }
      }
      return { ok: true as const, value: input };
    },
  };
}

/** The input contracts handed to the adapter (id -> executable contract). */
export const sharedWorldContracts: readonly Contract<unknown>[] = [
  contract('qlt.threads.create.input', ['id', 'title'], MAX_TITLE_LENGTH),
  contract('qlt.threads.rename.input', ['title'], MAX_TITLE_LENGTH),
  contract('qlt.threads.archive.input', [], MAX_ID_LENGTH),
  contract('qlt.threads.reopen.input', [], MAX_ID_LENGTH),
];

/** Deterministic canonical fingerprint of a keyed request (conflict detection). */
function canonicalFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = record[key];
      }
      return sorted;
    }
    return entry;
  });
}

export interface SharedWorldSqliteOptions {
  /** Database file path or ':memory:'. */
  readonly path: string;
  /** Deterministic clock (epoch ms). */
  readonly clock?: () => number;
  /**
   * The SERVER-DERIVED local user actor id (Q5: attributes the lazily
   * seeded default Memory Mode policy row). Defaults to the single-actor
   * envelope identity; the composition passes the authoritative value.
   */
  readonly localActorId?: string;
  /** Deterministic id factory (tests). */
  readonly ids?: {
    readonly threadId?: () => string;
    readonly conversationId?: () => string;
    readonly proposalId?: () => string;
    readonly recordId?: () => string;
    readonly correctionId?: () => string;
    readonly linkId?: () => string;
  };
}

/**
 * One bounded, READ-ONLY row of the Q3 thread-scoped memory listing
 * (amendment A-AMEND-1): the raw join-projection the ceremony query surface
 * projects into the unified `qlt.memory` catalogue shape.
 */
export interface QltMemoryListRow {
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

export interface QltMemoryListOptions {
  readonly threadId: string;
  readonly kind?: 'claim' | 'commitment' | 'open_loop';
  readonly status?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// ---- Q5 inspection read shapes (bounded; SELECT only) ---------------------

export type QltInspectionBucket = 'pending' | 'current' | 'history';

export interface QltInspectionListOptions {
  readonly bucket: QltInspectionBucket;
  readonly threadId?: string;
  readonly kind?: 'claim' | 'commitment' | 'open_loop' | 'proposal';
  readonly limit: number;
  readonly offset: number;
}

/** One bounded row of the family record tables (any status). */
export interface QltInspectionFamilyRow {
  readonly kind: 'claim' | 'commitment' | 'open_loop';
  readonly id: string;
  readonly status: string;
  readonly title: string;
  readonly text: string;
  readonly contentFingerprint: string;
  readonly originThreadId: string | null;
  readonly turnRef: string;
  readonly actor: string;
  readonly decisionBy: string;
  readonly exitReason: string | null;
  readonly exitedAtMs: number | null;
  readonly version: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly retentionState: string;
  readonly hasSuccessor: boolean;
  readonly supersedesId: string | null;
}

/** One bounded row of the proposal table (any status). */
export interface QltInspectionProposalRow {
  readonly kind: 'proposal';
  readonly id: string;
  readonly proposalKind: string;
  readonly status: string;
  readonly title: string;
  readonly text: string;
  readonly contentFingerprint: string;
  readonly originThreadId: string;
  readonly turnRef: string;
  readonly actor: string;
  readonly decisionBy: string;
  readonly decisionReason: string | null;
  readonly decidedAtMs: number | null;
  readonly targetRecordId: string | null;
  readonly targetRecordFamily: string | null;
  readonly targetRecordVersion: number | null;
  readonly version: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly retentionState: string;
  /** The record this confirmed proposal created (proposed-from link), if any. */
  readonly createdRecordId: string | null;
}

export type QltInspectionRecordRow = QltInspectionFamilyRow | QltInspectionProposalRow;

/** Source-link evidence (bounded; ids/relations only — never content). */
export interface QltInspectionLinkRow {
  readonly id: string;
  readonly fromRecordId: string;
  readonly fromRecordFamily: string;
  readonly toKind: string;
  readonly toRef: string;
  readonly relation: string;
  readonly createdAtMs: number;
}

/** Correction-lineage evidence for one subject record. */
export interface QltInspectionCorrectionRow {
  readonly id: string;
  readonly subjectRecordId: string;
  readonly subjectRecordFamily: string;
  readonly correctionKey: string;
  readonly reason: string | null;
  readonly correctedBy: string;
  readonly createdAtMs: number;
}

export interface QltInspectionRecordDetail {
  readonly record: QltInspectionFamilyRow;
  readonly links: readonly QltInspectionLinkRow[];
  readonly corrections: readonly QltInspectionCorrectionRow[];
  readonly successorIds: readonly string[];
}

export interface QltInspectionProposalDetail {
  readonly proposal: QltInspectionProposalRow;
  readonly links: readonly QltInspectionLinkRow[];
}

export interface QltInspectionTurnSummary {
  readonly turnId: string;
  readonly outcome: 'complete' | 'empty' | 'failed';
  readonly usedCount: number;
  readonly memoryMode: string | undefined;
  readonly assemblerVersion: string;
  readonly renderedBytes: number;
  readonly failureCode: string | undefined;
  readonly createdAtMs: number;
}

/** The Quellight Shared World store: domain port + Application Layer adapter. */
export interface SharedWorldSqlite extends SharedWorldPort {
  readonly id: string;
  readonly revision: string;
  /** The VICT Application Layer adapter surface (same store, same boundaries). */
  readonly adapter: ApplicationDataAdapter;
  /** The resource definition the adapter serves. */
  readonly resource: ResourceDefinition;
  /** The declared input contracts of the adapter mutations. */
  readonly contracts: readonly Contract<unknown>[];
  /**
   * The Q2 durable meaning repository (proposal/ceremony, claims,
   * commitments, open loops, corrections, source links) over the SAME
   * connection. Q3 wires it behind the governed VICT boundary through the
   * ceremony action surface (`ceremony-actions.ts`).
   */
  readonly meaning: SharedWorldMeaningStore;
  /**
   * A-AMEND-1 (Q3): ONE bounded READ-ONLY thread-scoped listing over the
   * same connection (SELECT only; no write/effect path). Serves the user
   * presentation read of claims/commitments/open loops for a thread.
   */
  listMemoryRows(options: QltMemoryListOptions): Promise<{
    readonly rows: readonly QltMemoryListRow[];
    readonly total: number;
  }>;
  /**
   * Q3 (freeze §8): server-derived thread correlation — the Shared World
   * thread id for a conversation (Mastra) thread id, resolved from the
   * correlation record. READ-ONLY; undefined when no link exists.
   */
  getThreadIdByConversation(mastraThreadId: string): Promise<string | undefined>;

  /**
   * Q5 (freeze §2/§11): the durable Memory Mode policy store and typed
   * effective-policy resolver (the SINGLE resolution boundary; the
   * assembler consumes the resolved policy from the admission-bound
   * turn scope).
   */
  readonly memoryPolicy: MemoryPolicyStore;

  // ---- Q5 bounded inspection READ accessors (freeze §6; SELECT only; no
  // write/effect path; consumed ONLY by the declared qlt.inspection
  // surface through the released read boundary) -------------------------

  /**
   * Deterministic bounded page of the inspection bucket listing
   * (pending | current | history), optionally thread- and kind-scoped.
   */
  listInspectionRecords(options: QltInspectionListOptions): Promise<{
    readonly rows: readonly QltInspectionRecordRow[];
    readonly total: number;
  }>;

  /** One record (family row) with provenance links and correction lineage. */
  getInspectionRecord(
    recordId: string,
    recordKind: 'claim' | 'commitment' | 'open_loop',
  ): Promise<QltInspectionRecordDetail | undefined>;

  /** One proposal row with its provenance links and created-record links. */
  getInspectionProposal(proposalId: string): Promise<QltInspectionProposalDetail | undefined>;

  /** Bounded completed-assembly listing for one conversation (newest first). */
  listInspectionTurns(
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<{
    readonly rows: readonly QltInspectionTurnSummary[];
    readonly total: number;
  }>;

  /** Immutable per-turn assembly detail + applied-policy evidence. */
  getInspectionTurnData(
    threadId: string,
    turnId: string,
  ): Promise<
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

  /** Re-read specific family rows for historical content resolution. */
  getInspectionRecordsByIds(ids: readonly string[]): Promise<readonly QltInspectionFamilyRow[]>;

  // ---- Q4 per-turn context-assembly reads (all bounded; READ-ONLY over
  // record rows; the assembly family itself is the ONLY new write family
  // and it is append-only immutable evidence) ---------------------------

  /**
   * The bounded candidate scan for the context assembler: per family the
   * most recent currently-relevant rows (`updated_at_ms DESC, id ASC`, at
   * most QLT_CONTEXT_SCAN_LIMIT_PER_FAMILY each), with the lineage
   * successor flag resolved in SQL. Never scans proposals or corrections.
   */
  listContextCandidates(): Promise<readonly ContextCandidateRow[]>;
  /** Re-read specific candidate rows by id (replay rendering). */
  getContextRowsByIds(ids: readonly string[]): Promise<readonly ContextCandidateRow[]>;
  /** Insert-or-get the immutable per-turn assembly record (UNIQUE turn). */
  recordContextAssembly(record: QltContextAssemblyRecord): Promise<QltContextAssemblyRecord>;
  getContextAssemblyByTurn(turnId: string): Promise<QltContextAssemblyRecord | undefined>;
  getLatestContextAssemblyForThread(
    threadId: string,
  ): Promise<QltContextAssemblyRecord | undefined>;
}

export function createSharedWorldSqlite(options: SharedWorldSqliteOptions): SharedWorldSqlite {
  const db = new DatabaseSync(options.path);
  // FK-protected Q2 meaning tables: the frozen schema declares foreign
  // keys, which SQLite enforces only when this pragma is on.
  db.exec('PRAGMA foreign_keys = ON;');
  const clock = options.clock ?? (() => Date.now());
  const threadId = options.ids?.threadId ?? (() => `qlt-${randomBytes(8).toString('hex')}`);
  const conversationId =
    options.ids?.conversationId ?? (() => `conv-${randomBytes(8).toString('hex')}`);

  runSharedWorldMigrations(db, () => new Date(clock()).toISOString());

  const meaning = createSharedWorldMeaningStore(db, {
    clock,
    ids: {
      proposalId: options.ids?.proposalId,
      recordId: options.ids?.recordId,
      correctionId: options.ids?.correctionId,
      linkId: options.ids?.linkId,
    },
  });

  function getThreadRow(threadIdValue: string): ThreadRow | undefined {
    return db.prepare('SELECT * FROM qlt_thread WHERE id = ?;').get(threadIdValue) as
      ThreadRow | undefined;
  }

  function requireThread(id: string): QltThread {
    const row = getThreadRow(id);
    if (row === undefined) {
      throw new QltSharedWorldError(
        'QLT_THREAD_MISSING',
        'The Shared World thread does not exist.',
      );
    }
    return rowToThread(row);
  }

  function assertTitle(title: string): string {
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > MAX_TITLE_LENGTH) {
      throw new QltSharedWorldError(
        'QLT_THREAD_INVALID_TITLE',
        `A thread title must be a non-empty string of at most ${MAX_TITLE_LENGTH} characters.`,
      );
    }
    return title;
  }

  function assertBoundedId(id: string): string {
    if (
      typeof id !== 'string' ||
      id.length === 0 ||
      id.length > MAX_ID_LENGTH ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)
    ) {
      throw new QltSharedWorldError(
        'QLT_THREAD_INVALID_ID',
        'A thread id must be a bounded safe identifier.',
      );
    }
    return id;
  }

  const port: SharedWorldPort = {
    async createThread(input: CreateThreadInput): Promise<QltThread> {
      const title = assertTitle(input.title);
      const id = input.id === undefined ? threadId() : assertBoundedId(input.id);
      const now = input.now ?? clock();
      const insert = db.prepare(
        `INSERT INTO qlt_thread (id, title, state, retention_state, provenance, created_at_ms, updated_at_ms)
         VALUES (?, ?, 'active', 'currently-relevant', ?, ?, ?);`,
      );
      try {
        insert.run(id, title, QLT_THREAD_PROVENANCE, now, now);
      } catch (cause) {
        const message = String((cause as { message?: string }).message ?? '');
        if (message.includes('UNIQUE')) {
          throw new QltSharedWorldError(
            'QLT_THREAD_EXISTS',
            'A Shared World thread with this identity already exists.',
          );
        }
        throw cause;
      }
      return requireThread(id);
    },

    async listThreads(listOptions) {
      const state = listOptions?.state;
      const limit = listOptions?.limit ?? 100;
      const offset = listOptions?.offset ?? 0;
      if (
        state !== undefined &&
        (state as string) !== 'active' &&
        (state as string) !== 'dormant'
      ) {
        throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Unknown thread state.');
      }
      const where = state === undefined ? '' : 'WHERE state = ?';
      const params = state === undefined ? [] : [state];
      const totalRow = db
        .prepare(`SELECT COUNT(*) AS total FROM qlt_thread ${where};`)
        .get(...params) as { total: number };
      const rows = db
        .prepare(
          `SELECT * FROM qlt_thread ${where} ORDER BY updated_at_ms DESC, id DESC LIMIT ? OFFSET ?;`,
        )
        .all(...params, limit, offset) as unknown as ThreadRow[];
      return { threads: rows.map(rowToThread), total: totalRow.total };
    },

    async getThread(id) {
      const row = getThreadRow(assertBoundedId(id));
      return row === undefined ? undefined : rowToThread(row);
    },

    async renameThread(id, title, now) {
      const existing = requireThread(assertBoundedId(id));
      if (existing.state === 'dormant') {
        throw new QltSharedWorldError(
          'QLT_THREAD_ARCHIVED',
          'An archived (dormant) thread is read-only; reopen it first.',
        );
      }
      const cleanTitle = assertTitle(title);
      const at = now ?? clock();
      db.prepare('UPDATE qlt_thread SET title = ?, updated_at_ms = ? WHERE id = ?;').run(
        cleanTitle,
        at,
        existing.id,
      );
      return requireThread(existing.id);
    },

    async archiveThread(id, now) {
      const existing = requireThread(assertBoundedId(id));
      if (existing.state === 'dormant') {
        return existing;
      }
      const at = now ?? clock();
      db.prepare("UPDATE qlt_thread SET state = 'dormant', updated_at_ms = ? WHERE id = ?;").run(
        at,
        existing.id,
      );
      return requireThread(existing.id);
    },

    async reopenThread(id, now) {
      const existing = requireThread(assertBoundedId(id));
      if (existing.state === 'active') {
        return existing;
      }
      const at = now ?? clock();
      db.prepare("UPDATE qlt_thread SET state = 'active', updated_at_ms = ? WHERE id = ?;").run(
        at,
        existing.id,
      );
      return requireThread(existing.id);
    },

    async ensureConversationLink(id, now) {
      const existing = requireThread(assertBoundedId(id));
      if (existing.state === 'dormant') {
        throw new QltSharedWorldError(
          'QLT_THREAD_ARCHIVED',
          'An archived (dormant) thread accepts no new conversation turns.',
        );
      }
      const at = now ?? clock();
      const found = db
        .prepare('SELECT * FROM qlt_thread_conversation WHERE thread_id = ?;')
        .get(existing.id) as
        | { id: string; thread_id: string; mastra_thread_id: string; created_at_ms: number }
        | undefined;
      if (found !== undefined) {
        return {
          id: found.id,
          threadId: found.thread_id,
          mastraThreadId: found.mastra_thread_id,
          createdAtMs: found.created_at_ms,
        } satisfies QltThreadConversation;
      }
      const convId = conversationId();
      // The Mastra thread id convention binds conversations to VICT-owned
      // conversation identities (`vict-conv-<id>`, MSTR-007 discipline).
      const mastraThreadId = `vict-conv-${convId}`;
      db.prepare(
        `INSERT INTO qlt_thread_conversation (id, thread_id, mastra_thread_id, created_at_ms)
         VALUES (?, ?, ?, ?);`,
      ).run(convId, existing.id, mastraThreadId, at);
      return {
        id: convId,
        threadId: existing.id,
        mastraThreadId,
        createdAtMs: at,
      } satisfies QltThreadConversation;
    },

    async getConversationLink(id) {
      const existing = requireThread(assertBoundedId(id));
      const found = db
        .prepare('SELECT * FROM qlt_thread_conversation WHERE thread_id = ?;')
        .get(existing.id) as
        | { id: string; thread_id: string; mastra_thread_id: string; created_at_ms: number }
        | undefined;
      return found === undefined
        ? undefined
        : ({
            id: found.id,
            threadId: found.thread_id,
            mastraThreadId: found.mastra_thread_id,
            createdAtMs: found.created_at_ms,
          } satisfies QltThreadConversation);
    },

    close(): void {
      db.close();
    },
  };

  // ---- Application Layer adapter surface (same store; DATA-014 rules) ----

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
    const required = effect === 'read' ? 'qlt.threads.read' : 'qlt.threads.write';
    if (!context.permissions.includes(required)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource 'qlt.threads' requires permission '${required}'.`,
      };
    }
    return undefined;
  }

  function fieldProjection(row: QltThread, projection: readonly string[] | undefined) {
    const full = {
      id: row.id,
      title: row.title,
      state: row.state,
      retentionState: row.retentionState,
      createdAt: row.createdAtMs,
      updatedAt: row.updatedAtMs,
    };
    if (projection === undefined || projection.length === 0) {
      return full;
    }
    const narrowed: Record<string, unknown> = {};
    for (const field of projection) {
      if (field in full) {
        narrowed[field] = full[field as keyof typeof full];
      }
    }
    return narrowed as typeof full;
  }

  const adapter: ApplicationDataAdapter = {
    id: 'quellight.shared-world',
    revision: '1',

    async query(
      request: ApplicationDataQueryRequest,
      context: ApplicationDataRequestContext,
    ): Promise<ApplicationDataResult> {
      // Closed request field set: unknown top-level fields fail loudly.
      const queryFields = new Set([
        'op',
        'resourceId',
        'filters',
        'search',
        'sort',
        'limit',
        'offset',
        'projection',
        'id',
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
      if (request.resourceId !== sharedWorldThreadResource.id) {
        return { ok: false, code: 'DATA_UNKNOWN_RESOURCE', message: 'Unknown resource.' };
      }
      if (request.op === 'list') {
        // Unknown projection fields fail loudly (never silently ignored).
        const declared = sharedWorldThreadResource.queries?.list?.projection;
        for (const field of request.projection ?? []) {
          if (!sharedWorldThreadResource.fields.some((candidate) => candidate.name === field)) {
            return {
              ok: false,
              code: 'DATA_UNSUPPORTED_QUERY',
              message: `Unknown projection field '${field}'.`,
            };
          }
          if (declared !== undefined && !declared.includes(field)) {
            continue; // declared projection list governs narrowing only
          }
        }
        // Bounded request shape: malformed pagination and filter containers
        // fail with DATA_INVALID_REQUEST (never accepted silently).
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
        let filtersAreMalformed = false;
        try {
          filtersAreMalformed =
            request.filters !== undefined &&
            (typeof request.filters !== 'object' ||
              request.filters === null ||
              Array.isArray(request.filters) ||
              // Unsupported exotic prototypes are rejected outright (the
              // reference-adapter container policy).
              (Object.getPrototypeOf(request.filters) !== Object.prototype &&
                Object.getPrototypeOf(request.filters) !== null));
        } catch {
          // A revoked proxy can throw on ANY inspection: malformed.
          filtersAreMalformed = true;
        }
        if (filtersAreMalformed) {
          return {
            ok: false,
            code: 'DATA_INVALID_REQUEST',
            message: 'The filter container must be a plain object.',
          };
        }
        const filters = request.filters ?? {};
        // Hostile-container containment (LOW-C-1 discipline): throwing
        // getters/proxies/revoked/cyclic/exotic containers produce the
        // SAME structured rejection — the raw hostile message never
        // escapes, and the container is never trusted.
        let filterEntries: [string, unknown][];
        try {
          filterEntries = Object.entries(filters as Record<string, unknown>);
        } catch {
          return {
            ok: false,
            code: 'DATA_INVALID_REQUEST',
            message: 'The filter container could not be read safely.',
          };
        }
        const isPrimitive = (value: unknown): boolean =>
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0));
        // Non-primitive values are a malformed request (checked before the
        // declared-field policy). Value READS are contained: a throwing
        // getter is a malformed container, never a raw exception.
        for (const [, value] of filterEntries) {
          let readable: unknown;
          let readableFailed = false;
          try {
            readable = value;
          } catch {
            readable = undefined;
            readableFailed = true;
          }
          if (readableFailed || !isPrimitive(readable)) {
            return {
              ok: false,
              code: 'DATA_INVALID_REQUEST',
              message: 'Filter values must be primitives.',
            };
          }
        }
        // Catalogue field → physical column mapping (the only validated
        // identifiers that ever reach SQL interpolation).
        const columnOf = (field: string): string =>
          field === 'createdAt'
            ? 'created_at_ms'
            : field === 'updatedAt'
              ? 'updated_at_ms'
              : field === 'retentionState'
                ? 'retention_state'
                : field;
        for (const [field] of filterEntries) {
          // Equality filters are supported on every declared catalogue
          // field (mirroring the reference adapter's primitive-equality
          // semantics); undeclared filter fields are unsupported.
          if (!sharedWorldThreadResource.fields.some((candidate) => candidate.name === field)) {
            return {
              ok: false,
              code: 'DATA_UNSUPPORTED_QUERY',
              message: `Filtering by '${field}' is not declared for this resource.`,
            };
          }
        }
        const sort = request.sort?.at(0);
        if (
          sort !== undefined &&
          sort.field !== 'updatedAt' &&
          sort.field !== 'createdAt' &&
          sort.field !== 'title'
        ) {
          return {
            ok: false,
            code: 'DATA_UNSUPPORTED_QUERY',
            message: `Sorting by '${sort.field}' is not declared for this resource.`,
          };
        }
        const direction = sort?.direction === 'asc' ? 'ASC' : 'DESC';
        const sortField = sort === undefined ? 'updated_at_ms' : columnOf(sort.field);
        // Declared substring search over catalogue text fields (Stage 05
        // semantics; LIKE metacharacters escaped).
        const search = request.search;
        let searchCondition: string | undefined;
        let searchParam: string | undefined;
        if (search !== undefined) {
          if (
            typeof search.text !== 'string' ||
            search.text.length > 200 ||
            !Array.isArray(search.fields)
          ) {
            return {
              ok: false,
              code: 'DATA_INVALID_REQUEST',
              message: 'The search request is malformed.',
            };
          }
          const unknownSearchField = search.fields.some(
            (field) =>
              !sharedWorldThreadResource.fields.some((candidate) => candidate.name === field),
          );
          if (unknownSearchField) {
            return {
              ok: false,
              code: 'DATA_UNSUPPORTED_QUERY',
              message: 'Searching an undeclared field is not supported.',
            };
          }
          const textColumns = search.fields.filter((field) =>
            sharedWorldThreadResource.fields.some(
              (candidate) => candidate.name === field && candidate.type === 'string',
            ),
          );
          if (textColumns.length > 0) {
            searchCondition = textColumns
              .map((field) => `${columnOf(field)} LIKE ? ESCAPE '\\'`)
              .join(' OR ');
            searchParam = `%${search.text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
          }
        }
        const conditions = [
          ...filterEntries.map(([field]) => `${columnOf(field)} = ?`),
          ...(searchCondition !== undefined ? [searchCondition] : []),
        ];
        const where =
          conditions.length > 0
            ? `WHERE ${conditions.map((condition) => `(${condition})`).join(' AND ')}`
            : '';
        const filterValues = [
          ...filterEntries.map(([, value]) => String(value)),
          ...(searchParam !== undefined ? [searchParam] : []),
        ];
        const totalRow = db
          .prepare(`SELECT COUNT(*) AS total FROM qlt_thread ${where};`)
          .get(...filterValues) as { total: number };
        const rows = db
          .prepare(
            `SELECT * FROM qlt_thread ${where} ORDER BY ${sortField} ${direction}, id DESC LIMIT ? OFFSET ?;`,
          )
          .all(
            ...filterValues,
            request.limit ?? 100,
            request.offset ?? 0,
          ) as unknown as ThreadRow[];
        return {
          ok: true,
          rows: rows.map((row) => fieldProjection(rowToThread(row), request.projection)),
          total: totalRow.total,
        };
      }
      if (request.op === 'get') {
        if (typeof request.id !== 'string' || request.id.length === 0) {
          return { ok: false, code: 'DATA_INVALID_REQUEST', message: 'get requires an id.' };
        }
        const row = getThreadRow(request.id);
        if (row === undefined) {
          return { ok: false, code: 'DATA_UNKNOWN_IDENTITY', message: 'No such row.' };
        }
        return { ok: true, row: fieldProjection(rowToThread(row), request.projection) };
      }
      return { ok: false, code: 'DATA_INVALID_REQUEST', message: 'Unknown query op.' };
    },

    async mutate(
      request: ApplicationDataMutationRequest,
      context: ApplicationDataRequestContext,
    ): Promise<ApplicationDataResult> {
      // Closed request field set: unknown top-level fields fail loudly.
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
      if (request.resourceId !== sharedWorldThreadResource.id) {
        return { ok: false, code: 'DATA_UNKNOWN_RESOURCE', message: 'Unknown resource.' };
      }
      const declared = (
        sharedWorldThreadResource.mutations as ReadonlyArray<{ op: string }> | undefined
      )?.find((mutation) => mutation.op === request.op);
      if (declared === undefined) {
        return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
      }
      const input = (request.input ?? {}) as Record<string, unknown>;
      // Hostile-container containment on mutation input: enumeration
      // failures are structured rejections, never raw exceptions.
      let inputKeys: string[];
      try {
        inputKeys = Object.keys(input as Record<string, unknown>);
      } catch {
        return {
          ok: false,
          code: 'DATA_INVALID_INPUT',
          message: 'The input container could not be read safely.',
        };
      }
      // One strict unknown-field/type policy for every declared mutation:
      // attacker fields are rejected, never silently persisted.
      const acceptedFields =
        request.op === 'create'
          ? sharedWorldThreadResource.fields.map((field) => field.name)
          : sharedWorldThreadResource.fields
              .map((field) => field.name)
              .filter(
                (name) =>
                  name !== 'state' &&
                  name !== 'retentionState' &&
                  name !== 'createdAt' &&
                  name !== 'updatedAt',
              );
      for (const key of inputKeys) {
        if (!acceptedFields.includes(key) && key !== 'idempotencyKey') {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: `Unknown input field '${key}'.`,
          };
        }
      }
      for (const field of sharedWorldThreadResource.fields) {
        const value = input[field.name];
        if (value === undefined) {
          continue;
        }
        const expectedType = field.type;
        const actualType = typeof value;
        if (
          (expectedType === 'string' && actualType !== 'string') ||
          (expectedType === 'number' && (actualType !== 'number' || !Number.isFinite(value)))
        ) {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: `Field '${field.name}' must be of type ${expectedType}.`,
          };
        }
      }
      try {
        if (request.op === 'create') {
          const title = input['title'];
          const identity = input['id'];
          if (typeof title !== 'string' || title.length === 0 || title.length > MAX_TITLE_LENGTH) {
            return { ok: false, code: 'DATA_INVALID_INPUT', message: 'create requires a title.' };
          }
          if (
            typeof identity !== 'string' ||
            identity.length === 0 ||
            identity.length > MAX_ID_LENGTH ||
            !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(identity)
          ) {
            return {
              ok: false,
              code: 'DATA_INVALID_INPUT',
              message: 'create requires the identity field id as a bounded string.',
            };
          }
          if (request.idempotencyKey !== undefined) {
            const scopeKey = `${request.resourceId}::create::${request.idempotencyKey}`;
            const fingerprint = canonicalFingerprint({ id: identity, title });
            const prior = db
              .prepare(
                'SELECT row_identity, fingerprint FROM qlt_adapter_idempotency WHERE scope_key = ?;',
              )
              .get(scopeKey) as { row_identity: string; fingerprint: string } | undefined;
            if (prior !== undefined) {
              if (prior.fingerprint !== fingerprint) {
                return {
                  ok: false,
                  code: 'DATA_IDEMPOTENCY_CONFLICT',
                  message:
                    'The idempotency key was already used with a different request; a key reconciles only its original canonical request.',
                };
              }
              const existing = getThreadRow(prior.row_identity);
              return {
                ok: true,
                row:
                  existing === undefined ? {} : fieldProjection(rowToThread(existing), undefined),
              };
            }
            const now = clock();
            db.exec('BEGIN IMMEDIATE;');
            try {
              db.prepare(
                `INSERT INTO qlt_thread (id, title, state, retention_state, provenance, created_at_ms, updated_at_ms)
                 VALUES (?, ?, 'active', 'currently-relevant', ?, ?, ?);`,
              ).run(identity, title, QLT_THREAD_PROVENANCE, now, now);
              // The key is recorded in the SAME transaction as the row it
              // reconciles: a failed transaction never consumes a key.
              db.prepare(
                'INSERT INTO qlt_adapter_idempotency (scope_key, row_identity, fingerprint) VALUES (?, ?, ?);',
              ).run(scopeKey, identity, fingerprint);
              db.exec('COMMIT;');
            } catch (cause) {
              db.exec('ROLLBACK;');
              throw cause;
            }
            const created = getThreadRow(identity)!;
            return { ok: true, row: fieldProjection(rowToThread(created), undefined) };
          }
          // Un-keyed create: still one strict identity insert.
          const now = clock();
          db.prepare(
            `INSERT INTO qlt_thread (id, title, state, retention_state, provenance, created_at_ms, updated_at_ms)
             VALUES (?, ?, 'active', 'currently-relevant', ?, ?, ?);`,
          ).run(identity as string, title as string, QLT_THREAD_PROVENANCE, now, now);
          const created = getThreadRow(identity as string)!;
          return { ok: true, row: fieldProjection(rowToThread(created), undefined) };
        }

        // Domain verbs: rename / archive / reopen — bounded input, VICT
        // domain errors surface as structured adapter failures.
        if (typeof request.id !== 'string' || request.id.length === 0) {
          return {
            ok: false,
            code: 'DATA_INVALID_REQUEST',
            message: 'The mutation requires an id.',
          };
        }
        if (request.op === 'rename') {
          const title = input['title'];
          if (typeof title !== 'string') {
            return { ok: false, code: 'DATA_INVALID_INPUT', message: 'rename requires a title.' };
          }
          const updated = await port.renameThread(request.id, title, clock());
          return { ok: true, row: fieldProjection(updated, undefined) };
        }
        if (request.op === 'archive') {
          const updated = await port.archiveThread(request.id, clock());
          return { ok: true, row: fieldProjection(updated, undefined) };
        }
        if (request.op === 'reopen') {
          const updated = await port.reopenThread(request.id, clock());
          return { ok: true, row: fieldProjection(updated, undefined) };
        }
        return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
      } catch (cause) {
        if (cause instanceof QltSharedWorldError) {
          const code =
            cause.code === 'QLT_THREAD_MISSING'
              ? 'DATA_UNKNOWN_IDENTITY'
              : cause.code === 'QLT_THREAD_ARCHIVED'
                ? 'DATA_INVALID_REQUEST'
                : 'DATA_INVALID_INPUT';
          return { ok: false, code, message: cause.message };
        }
        const message = String((cause as { message?: string }).message ?? '');
        if (message.includes('UNIQUE')) {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: 'A row with the requested identity already exists.',
          };
        }
        return { ok: false, code: 'DATA_INVALID_INPUT', message: 'The mutation was rejected.' };
      }
    },
  };

  // ---- Q3 read-only memory listing (amendment A-AMEND-1; SELECT only) -----

  const MEMORY_FAMILY_TABLES = {
    claim: 'qlt_claim',
    commitment: 'qlt_commitment',
    open_loop: 'qlt_open_loop',
  } as const;
  const CLOSED_RECORD_STATUSES = new Set([
    // claim
    'active',
    'superseded',
    'retired',
    // commitment
    'released',
    'amended',
    // open_loop
    'open',
    'resolved',
    'abandoned',
    'transformed',
  ]);

  async function listMemoryRows(options: QltMemoryListOptions): Promise<{
    readonly rows: readonly QltMemoryListRow[];
    readonly total: number;
  }> {
    const threadId = assertBoundedId(options.threadId);
    const families = (
      options.kind === undefined
        ? (Object.keys(MEMORY_FAMILY_TABLES) as (keyof typeof MEMORY_FAMILY_TABLES)[])
        : [options.kind]
    ).filter(
      (family): family is keyof typeof MEMORY_FAMILY_TABLES => family in MEMORY_FAMILY_TABLES,
    );
    if (families.length === 0) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Unknown memory family.');
    }
    if (
      options.status !== undefined &&
      (typeof options.status !== 'string' || !CLOSED_RECORD_STATUSES.has(options.status))
    ) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Unknown memory status.');
    }
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Invalid memory list limit.');
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Invalid memory list offset.');
    }
    const rows: QltMemoryListRow[] = [];
    let total = 0;
    for (const family of families) {
      const table = MEMORY_FAMILY_TABLES[family];
      const statusCondition = options.status === undefined ? '' : ' AND status = ?';
      const params = options.status === undefined ? [threadId] : [threadId, options.status];
      const countRow = db
        .prepare(
          `SELECT COUNT(*) AS total FROM ${table} WHERE source_thread_id = ?${statusCondition};`,
        )
        .get(...params) as { total: number };
      total += countRow.total;
      const raw = db
        .prepare(
          `SELECT * FROM ${table} WHERE source_thread_id = ?${statusCondition}
           ORDER BY updated_at_ms DESC, id ASC;`,
        )
        .all(...params) as unknown as Array<Record<string, unknown>>;
      for (const row of raw) {
        const contentText = (() => {
          try {
            const parsed = JSON.parse(String(row['content'] ?? '{}')) as Record<string, unknown>;
            const text = parsed['statement'] ?? parsed['detail'];
            return typeof text === 'string' ? text : '';
          } catch {
            return '';
          }
        })();
        rows.push({
          kind: family,
          id: String(row['id'] ?? ''),
          status: String(row['status'] ?? ''),
          title:
            family === 'commitment'
              ? String(row['commitment_key'] ?? '')
              : String(row['subject'] ?? ''),
          text: contentText,
          threadId: String(row['source_thread_id'] ?? ''),
          turnRef: String(row['source_turn_ref'] ?? ''),
          actor: String(row['created_by'] ?? ''),
          decisionBy: String(row['exit_by'] ?? ''),
          version: Number(row['version'] ?? 1),
          createdAtMs: Number(row['created_at_ms'] ?? 0),
          updatedAtMs: Number(row['updated_at_ms'] ?? 0),
        });
      }
    }
    // Deterministic global ordering across the requested families
    // (updated_at_ms DESC, id ASC — the frozen ordering; the Q4 L-1
    // correction re-pins the tie-break to id ASC), then bounded pagination.
    rows.sort((left, right) =>
      left.updatedAtMs === right.updatedAtMs
        ? left.id < right.id
          ? -1
          : left.id > right.id
            ? 1
            : 0
        : right.updatedAtMs - left.updatedAtMs,
    );
    return { rows: rows.slice(offset, offset + limit), total };
  }

  async function getThreadIdByConversation(mastraThreadId: string): Promise<string | undefined> {
    if (
      typeof mastraThreadId !== 'string' ||
      mastraThreadId.length === 0 ||
      mastraThreadId.length > 200
    ) {
      return undefined;
    }
    const row = db
      .prepare('SELECT thread_id FROM qlt_thread_conversation WHERE mastra_thread_id = ?;')
      .get(mastraThreadId) as { thread_id: string } | undefined;
    return row === undefined ? undefined : row.thread_id;
  }

  // ---- Q4 per-turn context-assembly surface (Lane A) -----------------------

  const CONTEXT_FAMILY_TABLES = {
    claim: 'qlt_claim',
    commitment: 'qlt_commitment',
    open_loop: 'qlt_open_loop',
  } as const;

  function candidateRowOf(
    family: keyof typeof CONTEXT_FAMILY_TABLES,
    row: Record<string, unknown>,
  ): ContextCandidateRow {
    return {
      family,
      id: String(row['id'] ?? ''),
      version: Number(row['version'] ?? 0),
      status: String(row['status'] ?? ''),
      subject: family === 'commitment' ? null : (row['subject'] as string | null),
      commitmentKey: family === 'commitment' ? (row['commitment_key'] as string | null) : null,
      loopKind: family === 'open_loop' ? (row['loop_kind'] as string | null) : null,
      epistemicType: family === 'claim' ? (row['epistemic_type'] as string | null) : null,
      honestyState: family === 'claim' ? (row['honesty_state'] as string | null) : null,
      confidence: family === 'claim' ? (row['confidence'] as string | null) : null,
      content: String(row['content'] ?? ''),
      contentFingerprint: String(row['content_fingerprint'] ?? ''),
      sourceThreadId: (row['source_thread_id'] as string | null) ?? null,
      createdBy: String(row['created_by'] ?? ''),
      updatedAtMs: Number(row['updated_at_ms'] ?? 0),
      hasSuccessor: Number(row['has_successor'] ?? 0) === 1,
    };
  }

  async function listContextCandidates(): Promise<readonly ContextCandidateRow[]> {
    const rows: ContextCandidateRow[] = [];
    for (const family of Object.keys(CONTEXT_FAMILY_TABLES) as Array<
      keyof typeof CONTEXT_FAMILY_TABLES
    >) {
      const table = CONTEXT_FAMILY_TABLES[family];
      const raw = db
        .prepare(
          `SELECT t.*, EXISTS(
             SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id
           ) AS has_successor
           FROM ${table} t
           WHERE t.retention_state = 'currently-relevant'
           ORDER BY t.updated_at_ms DESC, t.id ASC
           LIMIT ?;`,
        )
        .all(QLT_CONTEXT_SCAN_LIMIT_PER_FAMILY) as unknown as Array<Record<string, unknown>>;
      for (const row of raw) {
        rows.push(candidateRowOf(family, row));
      }
    }
    return rows;
  }

  async function getContextRowsByIds(
    ids: readonly string[],
  ): Promise<readonly ContextCandidateRow[]> {
    if (ids.length === 0 || ids.length > QLT_CONTEXT_MAX_RECORDS) {
      return [];
    }
    for (const id of ids) {
      if (!assertBoundedIdSilent(id)) {
        return [];
      }
    }
    const rows: ContextCandidateRow[] = [];
    for (const family of Object.keys(CONTEXT_FAMILY_TABLES) as Array<
      keyof typeof CONTEXT_FAMILY_TABLES
    >) {
      const table = CONTEXT_FAMILY_TABLES[family];
      const placeholders = ids.map(() => '?').join(',');
      const raw = db
        .prepare(
          `SELECT t.*, EXISTS(
             SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id
           ) AS has_successor
           FROM ${table} t
           WHERE t.id IN (${placeholders});`,
        )
        .all(...ids) as unknown as Array<Record<string, unknown>>;
      for (const row of raw) {
        rows.push(candidateRowOf(family, row));
      }
    }
    return rows;
  }

  function assertBoundedIdSilent(id: string): boolean {
    return (
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= MAX_ID_LENGTH &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)
    );
  }

  function assemblyRecordOf(row: Record<string, unknown>): QltContextAssemblyRecord {
    const failureCode = row['failure_code'];
    return {
      id: String(row['id'] ?? ''),
      turnId: String(row['turn_id'] ?? ''),
      threadId: String(row['thread_id'] ?? ''),
      assemblerVersion: String(row['assembler_version'] ?? ''),
      outcome: row['outcome'] as QltContextAssemblyRecord['outcome'],
      selectedIds: JSON.parse(
        String(row['selected_ids'] ?? '[]'),
      ) as QltContextAssemblyRecord['selectedIds'],
      excluded: JSON.parse(String(row['excluded'] ?? '[]')) as QltContextAssemblyRecord['excluded'],
      orderingIdentity: String(row['ordering_identity'] ?? '[]'),
      maxRecords: Number(row['max_records'] ?? 0),
      maxBytes: Number(row['max_bytes'] ?? 0),
      renderedBytes: Number(row['rendered_bytes'] ?? 0),
      fingerprint: String(row['fingerprint'] ?? ''),
      ...(failureCode !== null && failureCode !== undefined
        ? { failureCode: String(failureCode) }
        : {}),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
    };
  }

  async function recordContextAssembly(
    record: QltContextAssemblyRecord,
  ): Promise<QltContextAssemblyRecord> {
    const existing = await getContextAssemblyByTurn(record.turnId);
    if (existing !== undefined) {
      return existing;
    }
    const selectedJson = JSON.stringify(record.selectedIds);
    const excludedJson = JSON.stringify(record.excluded);
    if (
      selectedJson.length > 4096 ||
      excludedJson.length > 8192 ||
      record.orderingIdentity.length > 4096
    ) {
      throw new Error('the assembly evidence exceeded the frozen record bounds');
    }
    try {
      db.prepare(
        `INSERT INTO qlt_context_assembly
           (id, turn_id, thread_id, assembler_version, outcome, selected_ids, excluded,
            ordering_identity, max_records, max_bytes, rendered_bytes, fingerprint,
            failure_code, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ).run(
        record.id,
        record.turnId,
        record.threadId,
        record.assemblerVersion,
        record.outcome,
        selectedJson,
        excludedJson,
        record.orderingIdentity,
        record.maxRecords,
        record.maxBytes,
        record.renderedBytes,
        record.fingerprint,
        record.failureCode ?? null,
        record.createdAtMs,
      );
      return record;
    } catch (cause) {
      const message = String((cause as { message?: string }).message ?? '');
      if (message.includes('UNIQUE')) {
        // Converged: another assembly for the same turn already persisted.
        const winner = await getContextAssemblyByTurn(record.turnId);
        if (winner !== undefined) {
          return winner;
        }
      }
      throw cause;
    }
  }

  async function getContextAssemblyByTurn(
    turnId: string,
  ): Promise<QltContextAssemblyRecord | undefined> {
    if (typeof turnId !== 'string' || turnId.length === 0 || turnId.length > 128) {
      return undefined;
    }
    const row = db
      .prepare('SELECT * FROM qlt_context_assembly WHERE turn_id = ?;')
      .get(turnId) as unknown as Record<string, unknown> | undefined;
    return row === undefined ? undefined : assemblyRecordOf(row);
  }

  async function getLatestContextAssemblyForThread(
    threadId: string,
  ): Promise<QltContextAssemblyRecord | undefined> {
    if (!assertBoundedIdSilent(threadId)) {
      return undefined;
    }
    const row = db
      .prepare(
        `SELECT * FROM qlt_context_assembly WHERE thread_id = ?
         ORDER BY created_at_ms DESC, turn_id ASC LIMIT 1;`,
      )
      .get(threadId) as unknown as Record<string, unknown> | undefined;
    return row === undefined ? undefined : assemblyRecordOf(row);
  }

  // ---- Q5 Memory Mode policy store (the SINGLE resolution boundary) -------

  const memoryPolicy = createMemoryPolicyStore({
    db,
    clock,
    localActorId: options.localActorId ?? 'actor-quellight-local',
  });

  // ---- Q5 bounded inspection reads (freeze §6; SELECT only) ---------------

  const INSPECTION_FAMILY_TABLES = CONTEXT_FAMILY_TABLES;

  function familyRowOf(
    family: keyof typeof INSPECTION_FAMILY_TABLES,
    row: Record<string, unknown>,
    hasSuccessor: boolean,
  ): QltInspectionFamilyRow {
    const parsedText = (() => {
      try {
        const parsed = JSON.parse(String(row['content'] ?? '{}')) as Record<string, unknown>;
        const text = parsed['statement'] ?? parsed['detail'];
        return typeof text === 'string' ? text : '';
      } catch {
        return '';
      }
    })();
    return {
      kind: family,
      id: String(row['id'] ?? ''),
      status: String(row['status'] ?? ''),
      title:
        family === 'commitment'
          ? String(row['commitment_key'] ?? '')
          : String(row['subject'] ?? ''),
      text: parsedText,
      contentFingerprint: String(row['content_fingerprint'] ?? ''),
      originThreadId: (row['source_thread_id'] as string | null) ?? null,
      turnRef: String(row['source_turn_ref'] ?? ''),
      actor: String(row['created_by'] ?? ''),
      decisionBy:
        family === 'open_loop' ? String(row['exit_by'] ?? '') : String(row['decision_by'] ?? ''),
      exitReason:
        family === 'open_loop'
          ? ((row['exit_reason'] as string | null) ?? null)
          : ((row['decision_reason'] as string | null) ?? null),
      exitedAtMs: family === 'open_loop' ? ((row['exited_at_ms'] as number | null) ?? null) : null,
      version: Number(row['version'] ?? 1),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
      updatedAtMs: Number(row['updated_at_ms'] ?? 0),
      retentionState: String(row['retention_state'] ?? ''),
      hasSuccessor,
      supersedesId: (row['supersedes_id'] as string | null) ?? null,
    };
  }

  function proposalRowOf(row: Record<string, unknown>): QltInspectionProposalRow {
    const content = (() => {
      try {
        return JSON.parse(String(row['content'] ?? '{}')) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();
    const title =
      typeof content['subject'] === 'string'
        ? content['subject']
        : typeof content['commitmentKey'] === 'string'
          ? content['commitmentKey']
          : `${String(row['proposal_kind'] ?? 'proposal')} proposal`;
    const text =
      typeof content['statement'] === 'string'
        ? content['statement']
        : typeof content['detail'] === 'string'
          ? content['detail']
          : typeof content['reason'] === 'string'
            ? content['reason']
            : '';
    const createdLink = db
      .prepare(
        `SELECT from_record_id FROM qlt_source_link
         WHERE to_kind = 'proposal' AND to_ref = ? AND relation = 'proposed-from'
         ORDER BY created_at_ms ASC, id ASC LIMIT 1;`,
      )
      .get(String(row['id'] ?? '')) as { from_record_id: string } | undefined;
    return {
      kind: 'proposal',
      id: String(row['id'] ?? ''),
      proposalKind: String(row['proposal_kind'] ?? ''),
      status: String(row['status'] ?? ''),
      title,
      text,
      contentFingerprint: String(row['content_fingerprint'] ?? ''),
      originThreadId: String(row['source_thread_id'] ?? ''),
      turnRef: String(row['source_turn_ref'] ?? ''),
      actor: String(row['proposed_by'] ?? ''),
      decisionBy: String(row['decision_by'] ?? ''),
      decisionReason: (row['decision_reason'] as string | null) ?? null,
      decidedAtMs: (row['decided_at_ms'] as number | null) ?? null,
      targetRecordId: (row['target_record_id'] as string | null) ?? null,
      targetRecordFamily: (row['target_record_family'] as string | null) ?? null,
      targetRecordVersion: (row['target_record_version'] as number | null) ?? null,
      version: Number(row['version'] ?? 1),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
      updatedAtMs: Number(row['updated_at_ms'] ?? 0),
      retentionState: String(row['retention_state'] ?? ''),
      createdRecordId: createdLink?.from_record_id ?? null,
    };
  }

  function linksForRecord(recordId: string): QltInspectionLinkRow[] {
    if (!assertBoundedIdSilent(recordId)) {
      return [];
    }
    const raw = db
      .prepare(
        `SELECT * FROM qlt_source_link WHERE from_record_id = ?
         ORDER BY created_at_ms ASC, id ASC;`,
      )
      .all(recordId) as unknown as Array<Record<string, unknown>>;
    return raw.map((row) => ({
      id: String(row['id'] ?? ''),
      fromRecordId: String(row['from_record_id'] ?? ''),
      fromRecordFamily: String(row['from_record_family'] ?? ''),
      toKind: String(row['to_kind'] ?? ''),
      toRef: String(row['to_ref'] ?? ''),
      relation: String(row['relation'] ?? ''),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
    }));
  }

  function correctionsForSubject(subjectRecordId: string): QltInspectionCorrectionRow[] {
    if (!assertBoundedIdSilent(subjectRecordId)) {
      return [];
    }
    const raw = db
      .prepare(
        `SELECT * FROM qlt_correction WHERE subject_record_id = ?
         ORDER BY created_at_ms ASC, id ASC;`,
      )
      .all(subjectRecordId) as unknown as Array<Record<string, unknown>>;
    return raw.map((row) => ({
      id: String(row['id'] ?? ''),
      subjectRecordId: String(row['subject_record_id'] ?? ''),
      subjectRecordFamily: String(row['subject_record_family'] ?? ''),
      correctionKey: String(row['correction_key'] ?? ''),
      reason: (row['reason'] as string | null) ?? null,
      correctedBy: String(row['corrected_by'] ?? ''),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
    }));
  }

  async function listInspectionRecords(options: QltInspectionListOptions): Promise<{
    readonly rows: readonly QltInspectionRecordRow[];
    readonly total: number;
  }> {
    const { bucket } = options;
    const limit = options.limit;
    const offset = options.offset;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Invalid inspection bounds.');
    }
    const threadFilter =
      options.threadId !== undefined ? assertBoundedId(options.threadId) : undefined;
    // Bounded per-source window: the global page is contained in the union
    // of per-source top-(offset+limit) lists under the shared ordering.
    const window = offset + limit;
    const rows: QltInspectionRecordRow[] = [];
    let total = 0;

    const proposalStatusesForBucket =
      bucket === 'pending'
        ? ['proposed', 'awaiting_decision']
        : ['confirmed', 'rejected', 'amended', 'withdrawn'];
    const proposalKindFilter =
      options.kind === undefined || options.kind === 'proposal' ? undefined : options.kind;
    const proposalWhere = [
      `status IN (${proposalStatusesForBucket.map(() => '?').join(',')})`,
      ...(threadFilter !== undefined ? ['source_thread_id = ?'] : []),
      ...(proposalKindFilter !== undefined ? ['proposal_kind = ?'] : []),
    ].join(' AND ');
    const proposalParams = [
      ...proposalStatusesForBucket,
      ...(threadFilter !== undefined ? [threadFilter] : []),
      ...(proposalKindFilter !== undefined ? [proposalKindFilter] : []),
    ];
    const proposalCount = db
      .prepare(`SELECT COUNT(*) AS total FROM qlt_proposal WHERE ${proposalWhere};`)
      .get(...proposalParams) as { total: number };
    total += proposalCount.total;
    const proposalRows = db
      .prepare(
        `SELECT * FROM qlt_proposal WHERE ${proposalWhere}
         ORDER BY updated_at_ms DESC, id ASC LIMIT ?;`,
      )
      .all(...proposalParams, window) as unknown as Array<Record<string, unknown>>;
    for (const row of proposalRows) {
      rows.push(proposalRowOf(row));
    }

    if (options.kind === undefined || options.kind !== 'proposal') {
      const familyFilter = options.kind;
      for (const family of Object.keys(INSPECTION_FAMILY_TABLES) as Array<
        keyof typeof INSPECTION_FAMILY_TABLES
      >) {
        if (familyFilter !== undefined && family !== familyFilter) {
          continue;
        }
        const table = INSPECTION_FAMILY_TABLES[family];
        const eligibleStatus = { claim: 'active', commitment: 'active', open_loop: 'open' }[family];
        const threadClause = threadFilter !== undefined ? ' AND t.source_thread_id = ?' : '';
        const params: (string | number)[] = threadFilter !== undefined ? [threadFilter] : [];
        const countRow = db
          .prepare(
            `SELECT COUNT(*) AS total FROM ${table} t WHERE${' '}
            ${
              bucket === 'current'
                ? `t.status = '${eligibleStatus}' AND t.retention_state = 'currently-relevant'
                 AND NOT EXISTS (SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id)`
                : `NOT (t.status = '${eligibleStatus}' AND t.retention_state = 'currently-relevant'
                 AND NOT EXISTS (SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id))`
            }${threadClause};`,
          )
          .get(...params) as { total: number };
        total += countRow.total;
        const raw = db
          .prepare(
            `SELECT t.*, EXISTS(
               SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id
             ) AS has_successor
             FROM ${table} t
             WHERE ${
               bucket === 'current'
                 ? `t.status = '${eligibleStatus}' AND t.retention_state = 'currently-relevant'
                    AND NOT EXISTS (SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id)`
                 : `NOT (t.status = '${eligibleStatus}' AND t.retention_state = 'currently-relevant'
                    AND NOT EXISTS (SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id))`
             }${threadClause}
             ORDER BY t.updated_at_ms DESC, t.id ASC LIMIT ?;`,
          )
          .all(...params, window) as unknown as Array<Record<string, unknown>>;
        for (const row of raw) {
          rows.push(familyRowOf(family, row, Number(row['has_successor'] ?? 0) === 1));
        }
      }
    }

    rows.sort((left, right) =>
      left.updatedAtMs === right.updatedAtMs
        ? left.id < right.id
          ? -1
          : left.id > right.id
            ? 1
            : 0
        : right.updatedAtMs - left.updatedAtMs,
    );
    return { rows: rows.slice(offset, offset + limit), total };
  }

  async function getInspectionRecord(
    recordId: string,
    recordKind: 'claim' | 'commitment' | 'open_loop',
  ): Promise<QltInspectionRecordDetail | undefined> {
    const id = assertBoundedId(recordId);
    if (!(recordKind in INSPECTION_FAMILY_TABLES)) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Unknown record family.');
    }
    const table = INSPECTION_FAMILY_TABLES[recordKind];
    const row = db
      .prepare(
        `SELECT t.*, EXISTS(
           SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id
         ) AS has_successor
         FROM ${table} t WHERE t.id = ?;`,
      )
      .get(id) as unknown as Record<string, unknown> | undefined;
    if (row === undefined) {
      return undefined;
    }
    const successorRows = db
      .prepare(
        `SELECT id FROM ${table} WHERE supersedes_id = ? ORDER BY created_at_ms ASC, id ASC;`,
      )
      .all(id) as unknown as Array<{ id: string }>;
    return {
      record: familyRowOf(recordKind, row, Number(row['has_successor'] ?? 0) === 1),
      links: linksForRecord(id),
      corrections: correctionsForSubject(id),
      successorIds: successorRows.map((entry) => entry.id),
    };
  }

  async function getInspectionProposal(
    proposalId: string,
  ): Promise<QltInspectionProposalDetail | undefined> {
    const id = assertBoundedId(proposalId);
    const row = db.prepare('SELECT * FROM qlt_proposal WHERE id = ?;').get(id) as unknown as
      Record<string, unknown> | undefined;
    if (row === undefined) {
      return undefined;
    }
    return { proposal: proposalRowOf(row), links: linksForRecord(id) };
  }

  async function listInspectionTurns(
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<{
    readonly rows: readonly QltInspectionTurnSummary[];
    readonly total: number;
  }> {
    const thread = assertBoundedId(threadId);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new QltSharedWorldError('QLT_THREAD_INVALID_STATE', 'Invalid inspection bounds.');
    }
    const countRow = db
      .prepare('SELECT COUNT(*) AS total FROM qlt_context_assembly WHERE thread_id = ?;')
      .get(thread) as { total: number };
    const raw = db
      .prepare(
        `SELECT * FROM qlt_context_assembly WHERE thread_id = ?
         ORDER BY created_at_ms DESC, turn_id ASC LIMIT ? OFFSET ?;`,
      )
      .all(thread, limit, offset) as unknown as Array<Record<string, unknown>>;
    const rows: QltInspectionTurnSummary[] = [];
    for (const row of raw) {
      const record = assemblyRecordOf(row);
      const policy = memoryPolicy.getTurnPolicy(record.turnId);
      rows.push({
        turnId: record.turnId,
        outcome: record.outcome,
        usedCount: record.selectedIds.length,
        memoryMode: policy?.mode,
        assemblerVersion: record.assemblerVersion,
        renderedBytes: record.renderedBytes,
        failureCode: record.failureCode,
        createdAtMs: record.createdAtMs,
      });
    }
    return { rows, total: countRow.total };
  }

  async function getInspectionTurnData(
    threadId: string,
    turnId: string,
  ): Promise<
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
  > {
    const thread = assertBoundedId(threadId);
    if (typeof turnId !== 'string' || turnId.length === 0 || turnId.length > 128) {
      return undefined;
    }
    const assembly = await getContextAssemblyByTurn(turnId);
    // The turn must belong to the requested conversation (no cross-thread
    // inspection; a mismatched pair is a missing turn, never a leak).
    if (assembly === undefined || assembly.threadId !== thread) {
      return undefined;
    }
    const policy = memoryPolicy.getTurnPolicy(turnId);
    return {
      assembly,
      policy: policy
        ? {
            policyId: policy.policyId,
            mode: policy.mode,
            policyRevision: policy.policyRevision,
            recordedAtMs: policy.recordedAtMs,
          }
        : undefined,
    };
  }

  async function getInspectionRecordsByIds(
    ids: readonly string[],
  ): Promise<readonly QltInspectionFamilyRow[]> {
    if (ids.length === 0 || ids.length > QLT_CONTEXT_MAX_RECORDS * 4) {
      return [];
    }
    for (const id of ids) {
      if (!assertBoundedIdSilent(id)) {
        return [];
      }
    }
    const rows: QltInspectionFamilyRow[] = [];
    for (const family of Object.keys(INSPECTION_FAMILY_TABLES) as Array<
      keyof typeof INSPECTION_FAMILY_TABLES
    >) {
      const table = INSPECTION_FAMILY_TABLES[family];
      const placeholders = ids.map(() => '?').join(',');
      const raw = db
        .prepare(
          `SELECT t.*, EXISTS(
             SELECT 1 FROM ${table} s WHERE s.supersedes_id = t.id
           ) AS has_successor
           FROM ${table} t
           WHERE t.id IN (${placeholders});`,
        )
        .all(...ids) as unknown as Array<Record<string, unknown>>;
      for (const row of raw) {
        rows.push(familyRowOf(family, row, Number(row['has_successor'] ?? 0) === 1));
      }
    }
    return rows;
  }

  return {
    ...port,
    id: adapter.id,
    revision: adapter.revision,
    adapter,
    resource: sharedWorldThreadResource,
    contracts: sharedWorldContracts,
    meaning,
    memoryPolicy,
    listMemoryRows,
    getThreadIdByConversation,
    listContextCandidates,
    getContextRowsByIds,
    recordContextAssembly,
    getContextAssemblyByTurn,
    getLatestContextAssemblyForThread,
    listInspectionRecords,
    getInspectionRecord,
    getInspectionProposal,
    listInspectionTurns,
    getInspectionTurnData,
    getInspectionRecordsByIds,
  };
}
