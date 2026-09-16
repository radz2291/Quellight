/**
 * The Q4 deterministic Shared World context assembler (Lane A).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md and the
 * frozen declarative module `context-contract.ts` (identifiers, budgets,
 * codes, framing markers, schema inventory as DATA). This module conforms
 * to that data and contains the executable assembly policy.
 *
 * What this module is:
 * - a DETERMINISTIC, read-side assembler: for one turn identity it
 *   evaluates the eligible confirmed-record pool, applies the frozen
 *   layer/class/ordering rules and the frozen record/byte budgets, and
 *   renders the delimiter-safe context block;
 * - the turn-context service: it resolves the in-flight turn identity
 *   from DURABLE VICT turn records (server-derived; the client and the
 *   model supply no authority), persists EXACTLY ONE immutable assembly
 *   record per logical turn, and replays the frozen record for every
 *   later model call of the same turn.
 *
 * What this module is NOT:
 * - NOT an authority: it performs no semantic conflict detection, never
 *   mutates Shared World records, and never grants the model any power
 *   beyond receiving the assembled snapshot as bounded data;
 * - NOT a transcript participant: its output is a call-scoped model-
 *   request transformation; the durable transcript is never touched;
 * - NOT a recall engine: eligibility is status/retention/lineage/
 *   integrity only — elapsed time alone never changes eligibility, and
 *   no embeddings, semantic retrieval, or second model call exist.
 */

import { createHash } from 'node:crypto';
import {
  QLT_CONTEXT_ASSEMBLER_VERSION,
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_HEADER_LINES,
  QLT_CONTEXT_BLOCK_OPEN,
  QLT_CONTEXT_CANDIDATE_FAMILIES,
  QLT_CONTEXT_CLASS_ORDER,
  QLT_CONTEXT_CONTENT_CLOSE,
  QLT_CONTEXT_CONTENT_FIELD,
  QLT_CONTEXT_CONTENT_OPEN,
  QLT_CONTEXT_EXCLUSION_CODES,
  QLT_CONTEXT_EXCLUSION_EVIDENCE_LIMIT,
  QLT_CONTEXT_FAILURE_CODES,
  QLT_CONTEXT_IDENTITY_FIELD,
  QLT_CONTEXT_LAYER_ORDER,
  QLT_CONTEXT_MAX_BYTES,
  QLT_CONTEXT_MAX_RECORDS,
  QLT_CONTEXT_RECORD_CLOSE,
  QLT_CONTEXT_RECORD_OPEN_PREFIX,
  QLT_CONTEXT_RECORD_OPEN_SUFFIX,
  QLT_CONTEXT_SCHEMA,
} from './context-contract.js';
import type { QltContextLayer } from './context-contract.js';
import { canonicalJson } from './meaning-contract.js';

// ---------------------------------------------------------------------------
// Candidate rows (the bounded read shape served by `sqlite.ts`)
// ---------------------------------------------------------------------------

export interface ContextCandidateRow {
  readonly family: 'claim' | 'commitment' | 'open_loop';
  readonly id: string;
  readonly version: number;
  readonly status: string;
  readonly subject: string | null;
  readonly commitmentKey: string | null;
  readonly loopKind: string | null;
  readonly epistemicType: string | null;
  readonly honestyState: string | null;
  readonly confidence: string | null;
  readonly content: string;
  readonly contentFingerprint: string;
  readonly sourceThreadId: string | null;
  readonly createdBy: string;
  readonly updatedAtMs: number;
  /** True when another record's `supersedes_id` points at this row. */
  readonly hasSuccessor: boolean;
}

/** One frozen selected-record entry (persisted in injection order). */
export interface ContextSelectedEntry {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
}

/** One bounded exclusion-evidence entry (id/kind/reason only — no content). */
export interface ContextExcludedEntry {
  readonly id: string;
  readonly kind: string;
  readonly reason: string;
}

/** The durable per-turn assembly record (mirrors the frozen inventory). */
export interface QltContextAssemblyRecord {
  readonly id: string;
  readonly turnId: string;
  readonly threadId: string;
  readonly assemblerVersion: string;
  readonly outcome: 'complete' | 'empty' | 'failed';
  readonly selectedIds: readonly ContextSelectedEntry[];
  readonly excluded: readonly (ContextExcludedEntry | { truncatedBeyond: number })[];
  readonly orderingIdentity: string;
  readonly maxRecords: number;
  readonly maxBytes: number;
  readonly renderedBytes: number;
  readonly fingerprint: string;
  readonly failureCode?: string;
  readonly createdAtMs: number;
}

// ---------------------------------------------------------------------------
// Stable exclusion reason mapping (freeze §3/§4; codes are frozen data)
// ---------------------------------------------------------------------------

type ExclusionReason = (typeof QLT_CONTEXT_EXCLUSION_CODES)[number];

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// ---------------------------------------------------------------------------
// Content escaping (frozen rule: JSON.stringify, then escape / < > &)
// ---------------------------------------------------------------------------

/**
 * Deterministic, reversible content escaping. After JSON.stringify the
 * only remaining active bytes are escaped so that NO `<`, `>`, `/`, or
 * `&` byte can exist inside emitted content — record text can therefore
 * never forge a framing marker, a record envelope, or close the context
 * section. Hostile confirmed content remains quoted data.
 */
export function escapeContextContent(content: string): string {
  return JSON.stringify(content)
    .replace(/\//g, '\\/')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// ---------------------------------------------------------------------------
// Serializer (freeze §5)
// ---------------------------------------------------------------------------

/** The per-record envelope fields, canonically ordered (JSON object). */
function recordEnvelope(row: ContextCandidateRow, layer: QltContextLayer): Record<string, unknown> {
  const origin = row.sourceThreadId === null ? 'global' : `thread:${row.sourceThreadId}`;
  const envelope: Record<string, unknown> = {
    confirmed: 'user',
    id: row.id,
    kind: row.family,
    origin,
    scope: layer,
    version: row.version,
  };
  if (row.family === 'claim') {
    envelope['subject'] = row.subject ?? '';
    envelope['epistemicType'] = row.epistemicType ?? '';
    envelope['honestyState'] = row.honestyState ?? '';
    envelope['confidence'] = row.confidence ?? '';
  } else if (row.family === 'commitment') {
    envelope['commitmentKey'] = row.commitmentKey ?? '';
  } else {
    envelope['subject'] = row.subject ?? '';
    envelope['loopKind'] = row.loopKind ?? '';
  }
  return envelope;
}

/** Extract the bounded confirmed content text of one candidate row. */
function contentTextOf(row: ContextCandidateRow): string {
  const parsed = JSON.parse(row.content) as Record<string, unknown>;
  const field = QLT_CONTEXT_CONTENT_FIELD[row.family];
  const text = parsed[field];
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('content field missing');
  }
  return text;
}

/** Render ONE record item (envelope + escaped content + close). */
export function renderRecordItem(row: ContextCandidateRow, layer: QltContextLayer): string {
  const envelopeJson = JSON.stringify(recordEnvelope(row, layer));
  const content = contentTextOf(row);
  return (
    `${QLT_CONTEXT_RECORD_OPEN_PREFIX}${envelopeJson}${QLT_CONTEXT_RECORD_OPEN_SUFFIX}\n` +
    `${QLT_CONTEXT_CONTENT_OPEN}${escapeContextContent(content)}${QLT_CONTEXT_CONTENT_CLOSE}\n` +
    `${QLT_CONTEXT_RECORD_CLOSE}\n`
  );
}

/** The fixed block frame (open marker, constant header lines, close). */
function blockFrame(): string {
  return (
    `${QLT_CONTEXT_BLOCK_OPEN}\n` +
    `${QLT_CONTEXT_BLOCK_HEADER_LINES.join('\n')}\n` +
    `${QLT_CONTEXT_BLOCK_CLOSE}\n`
  );
}

const BLOCK_FRAME_BYTES = Buffer.byteLength(blockFrame(), 'utf8');

/** Assemble the full block from rendered items (frozen frame layout). */
export function renderContextBlock(items: readonly string[]): string {
  return `${QLT_CONTEXT_BLOCK_OPEN}\n${QLT_CONTEXT_BLOCK_HEADER_LINES.join('\n')}\n${items.join('')}${QLT_CONTEXT_BLOCK_CLOSE}\n`;
}

// ---------------------------------------------------------------------------
// Deterministic fingerprint (freeze §7)
// ---------------------------------------------------------------------------

/** The assembly fingerprint input (no record content ever enters it). */
function fingerprintOf(input: {
  readonly turnId: string;
  readonly threadId: string;
  readonly outcome: string;
  readonly selected: readonly ContextSelectedEntry[];
  readonly excludedCount: number;
  readonly orderingIdentity: string;
}): string {
  return createHash('sha256')
    .update(
      Buffer.from(
        canonicalJson({
          assemblerVersion: QLT_CONTEXT_ASSEMBLER_VERSION,
          excludedCount: input.excludedCount,
          maxBytes: QLT_CONTEXT_MAX_BYTES,
          maxRecords: QLT_CONTEXT_MAX_RECORDS,
          orderingIdentity: input.orderingIdentity,
          outcome: input.outcome,
          schema: QLT_CONTEXT_SCHEMA,
          selected: input.selected,
          threadId: input.threadId,
          turnId: input.turnId,
        }),
        'utf8',
      ),
    )
    .digest('hex');
}

// ---------------------------------------------------------------------------
// The deterministic evaluator
// ---------------------------------------------------------------------------

export interface AssemblyEvaluation {
  readonly outcome: 'complete' | 'empty';
  readonly selected: readonly ContextSelectedEntry[];
  readonly selectedRows: readonly ContextCandidateRow[];
  readonly excluded: readonly ContextExcludedEntry[];
  readonly excludedTruncated: boolean;
  readonly excludedTotal: number;
  readonly orderingIdentity: string;
  readonly fingerprint: string;
  readonly block: string;
  readonly renderedBytes: number;
}

function layerRank(sourceThreadId: string | null, currentThreadId: string): number {
  if (sourceThreadId === currentThreadId) {
    return QLT_CONTEXT_LAYER_ORDER.indexOf('current-thread');
  }
  if (sourceThreadId === null) {
    return QLT_CONTEXT_LAYER_ORDER.indexOf('global');
  }
  return QLT_CONTEXT_LAYER_ORDER.indexOf('other-thread');
}

/**
 * Evaluate ONE candidate row. Throws only on integrity read failures the
 * caller maps to `evaluation-failed`; every structural exclusion returns
 * a stable reason.
 */
function evaluateRow(
  row: ContextCandidateRow,
  currentThreadId: string,
):
  | { readonly ok: true; readonly layer: QltContextLayer }
  | { readonly ok: false; readonly reason: ExclusionReason } {
  // provenance/identity validity (fail closed on malformed provenance)
  if (
    !SAFE_ID.test(row.id) ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1 ||
    typeof row.content !== 'string' ||
    row.content.length === 0 ||
    row.createdBy.length === 0 ||
    row.createdBy.length > 128 ||
    (row.sourceThreadId !== null && !SAFE_ID.test(row.sourceThreadId))
  ) {
    return { ok: false, reason: 'provenance-invalid' };
  }
  // the structured identity field must be present and bounded (a record
  // without its identity is malformed provenance, never groupable)
  const identityField = QLT_CONTEXT_IDENTITY_FIELD[row.family];
  const identityValue = (row as unknown as Record<string, unknown>)[identityField];
  if (
    typeof identityValue !== 'string' ||
    identityValue.length === 0 ||
    identityValue.length > 200
  ) {
    return { ok: false, reason: 'provenance-invalid' };
  }
  // status eligibility (claim active / commitment active / open loop open)
  const eligibleStatus = { claim: 'active', commitment: 'active', open_loop: 'open' }[row.family];
  if (row.status !== eligibleStatus) {
    return { ok: false, reason: row.status === 'superseded' ? 'superseded' : 'ineligible' };
  }
  // lineage: a successor exists — the record is not current-effective
  if (row.hasSuccessor) {
    return { ok: false, reason: 'superseded' };
  }
  // content integrity: parse + family field + stored-fingerprint equality
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.content);
  } catch {
    return { ok: false, reason: 'integrity-failed' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'integrity-failed' };
  }
  const record = parsed as Record<string, unknown>;
  const contentField = QLT_CONTEXT_CONTENT_FIELD[row.family];
  if (typeof record[contentField] !== 'string' || (record[contentField] as string).length === 0) {
    return { ok: false, reason: 'integrity-failed' };
  }
  const recomputed = createHash('sha256')
    .update(Buffer.from(canonicalJson(record), 'utf8'))
    .digest('hex');
  if (recomputed !== row.contentFingerprint) {
    return { ok: false, reason: 'integrity-failed' };
  }
  return { ok: true, layer: layerOf(row.sourceThreadId, currentThreadId) };
}

function layerOf(sourceThreadId: string | null, currentThreadId: string): QltContextLayer {
  const index = layerRank(sourceThreadId, currentThreadId);
  return QLT_CONTEXT_LAYER_ORDER[index] as QltContextLayer;
}

/**
 * The deterministic assembly evaluation (freeze §3/§4/§5). Never throws
 * for store-level failures — the CALLER wraps evaluation and records the
 * truthful `failed` outcome; per-row failures are excluded
 * `evaluation-failed` so one hostile row cannot veto the turn.
 */
export function evaluateContextCandidates(input: {
  readonly turnId: string;
  readonly threadId: string;
  readonly candidates: readonly ContextCandidateRow[];
}): AssemblyEvaluation {
  const { turnId, threadId, candidates } = input;
  const excluded: ContextExcludedEntry[] = [];
  const noteExcluded = (row: ContextCandidateRow, reason: ExclusionReason): void => {
    excluded.push({ id: row.id, kind: row.family, reason });
  };

  // 1. individual evaluation (fail closed per row)
  const valid: { row: ContextCandidateRow; layer: QltContextLayer }[] = [];
  for (const row of candidates) {
    try {
      const verdict = evaluateRow(row, threadId);
      if (verdict.ok) {
        valid.push({ row, layer: verdict.layer });
      } else {
        noteExcluded(row, verdict.reason);
      }
    } catch {
      noteExcluded(row, 'evaluation-failed');
    }
  }

  // 2. structured-identity duplicate-current groups (D-Q4-4; per family)
  const groups = new Map<string, { row: ContextCandidateRow; layer: QltContextLayer }[]>();
  for (const entry of valid) {
    const identityField = QLT_CONTEXT_IDENTITY_FIELD[entry.row.family];
    const identityValue = String(
      (entry.row as unknown as Record<string, unknown>)[identityField] ?? '',
    );
    const key = `${entry.row.family}::${identityValue}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [entry]);
    } else {
      group.push(entry);
    }
  }
  const pool: { row: ContextCandidateRow; layer: QltContextLayer }[] = [];
  for (const group of groups.values()) {
    if (group.length > 1) {
      for (const entry of group) {
        noteExcluded(entry.row, 'conflict-ambiguous');
      }
      continue;
    }
    pool.push(group[0]!);
  }

  // 3. deterministic total order: layer → class → updatedAt DESC, id ASC
  pool.sort((left, right) => {
    const layerDelta =
      layerRank(left.row.sourceThreadId, threadId) - layerRank(right.row.sourceThreadId, threadId);
    if (layerDelta !== 0) {
      return layerDelta;
    }
    const classDelta =
      QLT_CONTEXT_CLASS_ORDER.indexOf(left.row.family) -
      QLT_CONTEXT_CLASS_ORDER.indexOf(right.row.family);
    if (classDelta !== 0) {
      return classDelta;
    }
    if (left.row.updatedAtMs !== right.row.updatedAtMs) {
      return right.row.updatedAtMs - left.row.updatedAtMs;
    }
    return left.row.id < right.row.id ? -1 : left.row.id > right.row.id ? 1 : 0;
  });

  // 4. budget: include while fitting; the first non-fitting record and
  //    every later record are excluded `budget` (deterministic tail)
  const selectedRows: ContextCandidateRow[] = [];
  const renderedItems: string[] = [];
  let usedBytes = BLOCK_FRAME_BYTES;
  let budgetTail = false;
  for (const entry of pool) {
    if (budgetTail || selectedRows.length >= QLT_CONTEXT_MAX_RECORDS) {
      noteExcluded(entry.row, 'budget');
      continue;
    }
    let item: string;
    try {
      item = renderRecordItem(entry.row, entry.layer);
    } catch {
      noteExcluded(entry.row, 'evaluation-failed');
      continue;
    }
    const itemBytes = Buffer.byteLength(item, 'utf8');
    if (usedBytes + itemBytes > QLT_CONTEXT_MAX_BYTES) {
      budgetTail = true;
      noteExcluded(entry.row, 'budget');
      continue;
    }
    usedBytes += itemBytes;
    selectedRows.push(entry.row);
    renderedItems.push(item);
  }

  const selected: ContextSelectedEntry[] = selectedRows.map((row) => ({
    id: row.id,
    kind: row.family,
    version: row.version,
  }));
  const orderingKeys = selectedRows.map((row) => ({
    class: row.family,
    id: row.id,
    layer: layerOf(row.sourceThreadId, threadId),
    updatedAt: row.updatedAtMs,
  }));
  const orderingIdentity = canonicalJson(orderingKeys);
  const outcome: 'complete' | 'empty' = selected.length > 0 ? 'complete' : 'empty';
  const fingerprint = fingerprintOf({
    turnId,
    threadId,
    outcome,
    selected,
    excludedCount: excluded.length,
    orderingIdentity,
  });
  const block = selected.length > 0 ? renderContextBlock(renderedItems) : '';
  const renderedBytes = selected.length > 0 ? Buffer.byteLength(block, 'utf8') : 0;
  if (renderedBytes > QLT_CONTEXT_MAX_BYTES) {
    // Structural impossibility by construction; fail closed loudly rather
    // than ever emitting an over-budget block.
    throw new Error('the rendered context block exceeded the frozen byte budget');
  }
  return {
    outcome,
    selected,
    selectedRows,
    excludedTotal: excluded.length,
    excluded: excluded.slice(0, QLT_CONTEXT_EXCLUSION_EVIDENCE_LIMIT),
    excludedTruncated: excluded.length > QLT_CONTEXT_EXCLUSION_EVIDENCE_LIMIT,
    orderingIdentity,
    fingerprint,
    block,
    renderedBytes,
  };
}

/** Assert a reason is inside the frozen exclusion vocabulary. */
export function isContextExclusionReason(value: string): value is ExclusionReason {
  return (QLT_CONTEXT_EXCLUSION_CODES as readonly string[]).includes(value);
}

/** Assert a code is inside the frozen assembly failure vocabulary. */
export function isContextFailureCode(value: string): boolean {
  return (QLT_CONTEXT_FAILURE_CODES as readonly string[]).includes(value);
}

/** The assembly record id factory (bounded, deterministic-enough). */
function assemblyId(now: number): string {
  const digest = createHash('sha256').update(`asm:${now}:${crypto.randomUUID()}`).digest('hex');
  return `asm-${digest.slice(0, 24)}`;
}

// ---------------------------------------------------------------------------
// The per-turn context service (turn identity is SERVER-DERIVED only)
// ---------------------------------------------------------------------------

/** The async scope installed by the turns route (server-resolved ids). */
export interface TurnAssemblyScope {
  /** The Shared World thread id (resolved server-side by the route). */
  readonly swThreadId: string;
  /** The Mastra conversation thread id of the same conversation. */
  readonly mastraThreadId: string;
}

/** One open VICT turn record (the fields the service reads). */
export interface OpenTurnRecord {
  readonly turnId: string;
  readonly threadId: string;
  readonly actorId: string;
  readonly status: string;
}

/** Durable store ports the service depends on (all bounded reads). */
export interface TurnContextServiceDeps {
  /** Bounded per-family candidate scan (currently-relevant rows). */
  readonly listCandidates: () => Promise<readonly ContextCandidateRow[]>;
  /** Re-read specific rows by id (replay rendering; frozen id order). */
  readonly getRowsByIds: (ids: readonly string[]) => Promise<readonly ContextCandidateRow[]>;
  /** Insert-or-get by turn_id (converge on UNIQUE). */
  readonly recordAssembly: (record: QltContextAssemblyRecord) => Promise<QltContextAssemblyRecord>;
  readonly getAssemblyByTurn: (turnId: string) => Promise<QltContextAssemblyRecord | undefined>;
  readonly getLatestAssemblyForThread: (
    threadId: string,
  ) => Promise<QltContextAssemblyRecord | undefined>;
  /** Durable open turns (intent/running/awaiting-approval). */
  readonly listOpenTurns: () => Promise<readonly OpenTurnRecord[]>;
  /** The server-derived local actor (never client/model-supplied). */
  readonly localActorId: string;
  readonly clock?: () => number;
}

export type TurnStreamResolution =
  | {
      readonly kind: 'inject';
      readonly turnId: string;
      readonly block: string;
      readonly outcome: 'complete';
    }
  | {
      readonly kind: 'pass';
      readonly reason: 'no-open-turn' | 'failed-assembly' | 'empty-assembly' | 'ambiguous';
    };

/**
 * The per-turn context service. `resolveForStream` is called at the model
 * seam for every doStream invocation; it returns the frozen block for the
 * assembling turn, replays the frozen record for later calls of the same
 * turn, and fails closed (zero injection) whenever the turn identity
 * cannot be truthfully attributed.
 */
export function createTurnContextService(deps: TurnContextServiceDeps): {
  resolveForStream(scope: TurnAssemblyScope): Promise<TurnStreamResolution>;
  summaryForThread(threadId: string): Promise<
    | {
        readonly outcome: 'complete' | 'empty' | 'failed';
        readonly usedCount: number;
        readonly assemblerVersion: string;
        readonly createdAtMs: number;
      }
    | undefined
  >;
} {
  const clock = deps.clock ?? (() => Date.now());
  // Process-local per-turn render cache: the FIRST successful render of a
  // turn is immutable for the turn's duration (an in-flight turn never
  // silently substitutes a newer assembly). Values are never mutated.
  const renderCache = new Map<string, string>();
  // Process-local assembly dedup: concurrent doStream calls of the same
  // turn share one evaluation (the UNIQUE index is the durable backstop).
  const inFlight = new Map<string, Promise<TurnStreamResolution>>();

  async function assembleForTurn(
    scope: TurnAssemblyScope,
    turnId: string,
  ): Promise<TurnStreamResolution> {
    const existing = await deps.getAssemblyByTurn(turnId);
    if (existing !== undefined) {
      return replayRecord(existing);
    }
    let evaluation: AssemblyEvaluation;
    try {
      const candidates = await deps.listCandidates();
      evaluation = evaluateContextCandidates({
        turnId,
        threadId: scope.swThreadId,
        candidates,
      });
    } catch {
      // Assembly cannot be evaluated: truthful failed outcome, zero
      // injection, the turn continues (freeze §6).
      const failed = await deps.recordAssembly({
        id: assemblyId(clock()),
        turnId,
        threadId: scope.swThreadId,
        assemblerVersion: QLT_CONTEXT_ASSEMBLER_VERSION,
        outcome: 'failed',
        selectedIds: [],
        excluded: [],
        orderingIdentity: '[]',
        maxRecords: QLT_CONTEXT_MAX_RECORDS,
        maxBytes: QLT_CONTEXT_MAX_BYTES,
        renderedBytes: 0,
        fingerprint: fingerprintOf({
          turnId,
          threadId: scope.swThreadId,
          outcome: 'failed',
          selected: [],
          excludedCount: 0,
          orderingIdentity: '[]',
        }),
        failureCode: 'QLT_CONTEXT_ASSEMBLY_FAILED',
        createdAtMs: clock(),
      });
      void failed;
      return { kind: 'pass', reason: 'failed-assembly' };
    }
    const record = await deps.recordAssembly({
      id: assemblyId(clock()),
      turnId,
      threadId: scope.swThreadId,
      assemblerVersion: QLT_CONTEXT_ASSEMBLER_VERSION,
      outcome: evaluation.outcome,
      selectedIds: evaluation.selected,
      excluded: evaluation.excludedTruncated
        ? [
            ...evaluation.excluded,
            { truncatedBeyond: evaluation.excludedTotal - evaluation.excluded.length },
          ]
        : evaluation.excluded,
      orderingIdentity: evaluation.orderingIdentity,
      maxRecords: QLT_CONTEXT_MAX_RECORDS,
      maxBytes: QLT_CONTEXT_MAX_BYTES,
      renderedBytes: evaluation.renderedBytes,
      fingerprint: evaluation.fingerprint,
      createdAtMs: clock(),
    });
    if (evaluation.outcome === 'complete') {
      renderCache.set(turnId, evaluation.block);
      return { kind: 'inject', turnId, block: evaluation.block, outcome: 'complete' };
    }
    void record;
    return { kind: 'pass', reason: 'empty-assembly' };
  }

  async function replayRecord(record: QltContextAssemblyRecord): Promise<TurnStreamResolution> {
    if (record.outcome === 'failed') {
      return { kind: 'pass', reason: 'failed-assembly' };
    }
    if (record.outcome === 'empty') {
      return { kind: 'pass', reason: 'empty-assembly' };
    }
    const cached = renderCache.get(record.turnId);
    if (cached !== undefined) {
      return { kind: 'inject', turnId: record.turnId, block: cached, outcome: 'complete' };
    }
    // Cache miss (cross-replay edge): re-render from the FROZEN selection
    // (ids, kinds, versions, order) — the selection is what is frozen.
    const ids = record.selectedIds.map((entry) => entry.id);
    const rows = await deps.getRowsByIds(ids);
    const byId = new Map(rows.map((row) => [row.id, row] as const));
    const items: string[] = [];
    for (const entry of record.selectedIds) {
      const row = byId.get(entry.id);
      if (row === undefined || row.family !== entry.kind || row.version !== entry.version) {
        // A frozen row vanished or mutated identity: fail closed for this
        // stream (never inject a partially re-read snapshot).
        return { kind: 'pass', reason: 'failed-assembly' };
      }
      items.push(renderRecordItem(row, layerOf(row.sourceThreadId, record.threadId)));
    }
    const block = renderContextBlock(items);
    renderCache.set(record.turnId, block);
    return { kind: 'inject', turnId: record.turnId, block, outcome: 'complete' };
  }

  return {
    async resolveForStream(scope: TurnAssemblyScope): Promise<TurnStreamResolution> {
      let openTurns: readonly OpenTurnRecord[];
      try {
        openTurns = (await deps.listOpenTurns()).filter(
          (turn) => turn.threadId === scope.mastraThreadId && turn.actorId === deps.localActorId,
        );
      } catch {
        return { kind: 'pass', reason: 'ambiguous' };
      }
      const byTurn = new Map<string, QltContextAssemblyRecord | undefined>();
      const unrecorded: OpenTurnRecord[] = [];
      const recorded: { turn: OpenTurnRecord; record: QltContextAssemblyRecord }[] = [];
      for (const turn of openTurns) {
        const pending = inFlight.get(turn.turnId);
        if (pending !== undefined) {
          return pending;
        }
        let record: QltContextAssemblyRecord | undefined;
        try {
          record = await deps.getAssemblyByTurn(turn.turnId);
        } catch {
          return { kind: 'pass', reason: 'ambiguous' };
        }
        byTurn.set(turn.turnId, record);
        if (record === undefined) {
          unrecorded.push(turn);
        } else {
          recorded.push({ turn, record });
        }
      }
      if (unrecorded.length === 1) {
        const turn = unrecorded[0]!;
        const promise = assembleForTurn(scope, turn.turnId).finally(() => {
          inFlight.delete(turn.turnId);
        });
        inFlight.set(turn.turnId, promise);
        return promise;
      }
      if (unrecorded.length === 0 && recorded.length === 1) {
        return replayRecord(recorded[0]!.record);
      }
      // Zero open turns (nothing to attribute) or ambiguity (multiple
      // record-less open turns / multiple recorded streams): fail closed
      // with zero injection and no false record (freeze §6/§8).
      return { kind: 'pass', reason: 'ambiguous' };
    },

    async summaryForThread(threadId) {
      const record = await deps.getLatestAssemblyForThread(threadId);
      if (record === undefined) {
        return undefined;
      }
      return {
        outcome: record.outcome,
        usedCount: record.selectedIds.length,
        assemblerVersion: record.assemblerVersion,
        createdAtMs: record.createdAtMs,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Structural re-exports for the focused verifier (frozen vocabularies)
// ---------------------------------------------------------------------------

/** The candidate families (frozen; proposals/corrections never scan). */
export const CONTEXT_CANDIDATE_FAMILIES = QLT_CONTEXT_CANDIDATE_FAMILIES;
