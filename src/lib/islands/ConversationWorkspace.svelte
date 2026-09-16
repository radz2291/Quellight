<script lang="ts">
  /**
   * `qlt.conversation-workspace@1` — the conversation-first workspace
   * island (APP-014). Receives ONLY its declared props (none): every
   * dynamic crossing is a typed server boundary.
   *
   * - the thread list renders from the Quellight-owned Shared World store
   *   (`/api/act` → `qlt.threads`); the agent never writes it;
   * - turns cross the VICT command boundary; streaming crosses the
   *   `vict.agent-stream@1` resumable-SSE proxy with explicit cursor
   *   reconnect; frames are wire-validated client-side (N-7) and unknown
   *   or broken frames mark the stream unhealthy — nothing silent is
   *   rendered;
   * - every state is truthful: empty, streaming, stopping, disconnected,
   *   reconnecting, recoverable failure, non-recoverable failure,
   *   cancelled (partial retained and marked), archived (read-only),
   *   restored, and configuration-unavailable;
   * - the QUIET MEMORY INBOX (Stage 07C Phase Q3): a small pending-memory
   *   indicator plus a USER-OPENED review tray inside this workspace. The
   *   tray never opens or focuses itself, never blocks the conversation,
   *   and never requires a decision: pending proposals may stay pending
   *   indefinitely. Confirm / Edit / Reject / Withdraw, the direct
   *   "Remember this" Save, and user corrections are first-party controls
   *   attributable to the user; the assistant has no memory authority
   *   beyond drafting inert proposals and cannot read any memory;
   * - the Stop control routes the user's cancellation intent through the
   *   real `/vict` proxy into the released VICT HTTP command boundary
   *   (`agent.turn.cancel`) using the exact released vict.command@1
   *   contract: the closed `{ payload: { turnId, reasonCode? } }` request
   *   envelope plus a non-empty `idempotency-key` header (one intent, one
   *   key; retries of the same intent reuse the key). The request never
   *   fabricates a cancelled state: only the authoritative
   *   `response.cancelled` stream terminal settles the UI, and a rejected
   *   or undeliverable stop request surfaces as a stable, accessible
   *   failure state instead of being swallowed.
   */
  import { connectAgentStream } from './stream-client';

  interface ThreadRecord {
    id: string;
    title: string;
    state: 'active' | 'dormant';
    retentionState: string;
    createdAt: number;
    updatedAt: number;
  }

  interface RestoredMessage {
    role: string;
    text: string;
  }

  interface TurnRecord {
    turnId: string;
    status: string;
    errorCode?: string;
    createdAtMs: number;
    terminalAtMs?: number;
  }

  type ConnectionState =
    | 'idle'
    | 'connecting'
    | 'streaming'
    | 'stopping'
    | 'reconnecting'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'disconnected';

  let threads = $state<ThreadRecord[]>([]);
  let selectedThreadId = $state<string | undefined>(undefined);
  let messages = $state<{ role: string; text: string; kind: 'restored' | 'live' }[]>([]);
  let turns = $state<TurnRecord[]>([]);
  let draft = $state('');
  let connection = $state<ConnectionState>('idle');
  let failureCode = $state<string | undefined>(undefined);
  let partialMarked = $state(false);
  let modelMode = $state<'offline-fixture' | 'live' | 'unavailable'>('unavailable');
  let busyCreating = $state(false);
  let renamingTitle = $state('');
  let renaming = $state(false);
  let announcement = $state('');
  let listMessage = $state('');
  /** Stable display code for a rejected or undelivered stop request. */
  let cancelError = $state<string | undefined>(undefined);
  /**
   * The idempotency key of the CURRENT cancellation intent (one intent,
   * one key). Plain binding: it never renders directly.
   */
  let stopIntentKey: string | undefined = undefined;

  /** Whether an authoritative terminal already settled the open stream. */
  function isSettled(): boolean {
    return (
      connection === 'completed' ||
      connection === 'cancelled' ||
      connection === 'failed' ||
      connection === 'disconnected'
    );
  }

  const selectedThread = $derived(threads.find((thread) => thread.id === selectedThreadId));
  const archived = $derived(selectedThread?.state === 'dormant');
  const canSend = $derived(
    selectedThread !== undefined &&
      !archived &&
      draft.trim().length > 0 &&
      connection !== 'streaming' &&
      connection !== 'connecting' &&
      connection !== 'stopping' &&
      connection !== 'reconnecting',
  );

  async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    const response = await fetch(url, init);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { ok: false, code: 'INVALID_RESPONSE' };
    }
    return { status: response.status, body: body as Record<string, unknown> };
  }

  async function refreshThreads(): Promise<void> {
    const { body } = await fetchJson('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'act.queryThreads', input: {} }),
    });
    const result = body as { ok: boolean; value?: { rows?: unknown } };
    if (result.ok && result.value && typeof result.value === 'object') {
      const rows = (result.value as { rows?: unknown }).rows;
      threads = Array.isArray(rows) ? (rows as ThreadRecord[]) : [];
      if (threads.length === 0) {
        listMessage = 'No threads yet. Create one to begin.';
      } else {
        listMessage = '';
      }
    }
  }

  async function refreshHealth(): Promise<void> {
    try {
      const { status, body } = await fetchJson('/api/health');
      const result = body as { ok: boolean; modelMode?: string };
      if (status === 200 && result.ok && result.modelMode === 'live') {
        modelMode = 'live';
      } else if (status === 200 && result.ok) {
        modelMode = 'offline-fixture';
      } else {
        modelMode = 'unavailable';
      }
    } catch {
      modelMode = 'unavailable';
    }
  }

  async function openThread(threadId: string): Promise<void> {
    selectedThreadId = threadId;
    messages = [];
    turns = [];
    failureCode = undefined;
    cancelError = undefined;
    stopIntentKey = undefined;
    partialMarked = false;
    connection = 'idle';
    const { body } = await fetchJson(`/api/threads/${encodeURIComponent(threadId)}/messages`);
    const result = body as {
      ok: boolean;
      messages?: RestoredMessage[];
      turns?: TurnRecord[];
    };
    if (result.ok) {
      messages = (result.messages ?? []).map((message) => ({ ...message, kind: 'restored' }));
      turns = result.turns ?? [];
      announcement = 'Thread restored. Conversation history follows.';
    }
    memoryOpen = false;
    memoryError = '';
    editingId = undefined;
    correctingId = undefined;
    lastPendingAnnounced = -1;
    await refreshMemory();
    const composer = document.getElementById('qlt-composer');
    composer?.focus();
  }

  async function createThread(): Promise<void> {
    const title = `Thread ${new Date().toLocaleString()}`;
    busyCreating = true;
    try {
      const { body } = await fetchJson('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actionId: 'act.createThread',
          input: { title },
          // One logical create, one stable key across retries.
          idempotencyKey: `create-${crypto.randomUUID()}`,
        }),
      });
      const result = body as { ok: boolean; value?: { id?: string } };
      await refreshThreads();
      if (result.ok && typeof result.value?.id === 'string') {
        await openThread(result.value.id);
      }
    } finally {
      busyCreating = false;
    }
  }

  async function threadAction(actionId: string, input: Record<string, unknown>): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    await fetchJson('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actionId,
        input: { ...input, id: selectedThreadId },
        idempotencyKey: `${actionId}-${crypto.randomUUID()}`,
      }),
    });
    await refreshThreads();
    await openThread(selectedThreadId);
  }

  function startRename(): void {
    renaming = true;
    renamingTitle = selectedThread?.title ?? '';
  }

  async function commitRename(): Promise<void> {
    renaming = false;
    if (renamingTitle.trim().length === 0) {
      return;
    }
    await threadAction('act.renameThread', { title: renamingTitle.trim() });
  }

  // ---- Streaming turn lifecycle (vict.agent-stream@1 via the proxy) ------

  let activeTurnId = $state<string | undefined>(undefined);
  let activeStreamId = $state<string | undefined>(undefined);
  let activeStreamController: AbortController | undefined = undefined;
  let cursorSeq = 0;
  let streamUnhealthy = $state(false);

  function applyEvent(event: Record<string, unknown> & { kind: string }): void {
    const kind = event['kind'];
    if (kind === 'response.started') {
      connection = 'streaming';
      announcement = 'Response streaming.';
      return;
    }
    if (kind === 'text.delta') {
      const delta = typeof event['delta'] === 'string' ? event['delta'] : '';
      const last = messages.at(-1);
      if (last !== undefined && last.role === 'assistant' && last.kind === 'live') {
        last.text += delta;
      } else {
        messages.push({ role: 'assistant', text: delta, kind: 'live' });
      }
      return;
    }
    if (kind === 'content.completed') {
      // Durable milestone; the text itself was delivered through deltas.
      return;
    }
    if (kind === 'response.completed') {
      connection = 'completed';
      cancelError = undefined;
      announcement = 'Response completed.';
      return;
    }
    if (kind === 'response.cancelled') {
      connection = 'cancelled';
      partialMarked = messages.some((message) => message.role === 'assistant');
      announcement = partialMarked
        ? 'Stopped. The partial response is retained and marked.'
        : 'Stopped before any response content.';
      return;
    }
    if (kind === 'response.failed') {
      connection = 'failed';
      cancelError = undefined;
      failureCode = typeof event['code'] === 'string' ? (event['code'] as string) : 'UNKNOWN';
      announcement = `Response failed (${failureCode ?? 'unknown'}). Retry sends a new message.`;
      return;
    }
    // memory.updated / usage.updated / tool.* kinds are truthful metadata
    // in the closed vocabulary; 07B turns produce none of the tool kinds.
  }

  async function pumpStream(streamId: string): Promise<void> {
    const controller = new AbortController();
    activeStreamController = controller;
    const outcome = await connectAgentStream({
      streamId,
      lastSeq: cursorSeq,
      onEvent: (frame) => {
        cursorSeq = frame.seq;
        applyEvent(frame as Parameters<typeof applyEvent>[0]);
      },
      onReconnecting: () => {
        if (connection !== 'stopping') {
          connection = 'reconnecting';
          announcement = 'Connection lost. Reconnecting from the last acknowledged event.';
        }
      },
      signal: controller.signal,
    });
    activeStreamController = undefined;
    if (outcome.status === 'terminal') {
      // Reconcile with the DURABLE transcript at the terminal: transient
      // deltas are best-effort live delivery, so a subscriber that missed
      // some (fast turn, mid-stream drop) heals from the VICT-authoritative
      // record instead of rendering an incomplete response as if whole.
      await durableReconcile();
      return;
    }
    if (outcome.status === 'unhealthy') {
      streamUnhealthy = true;
      connection = 'failed';
      failureCode = 'VICT_STREAM_FRAME_INVALID';
      announcement =
        'The stream delivered invalid frames and was stopped. Rendering halted; no invented content is shown.';
      return;
    }
    if (connection !== 'stopping' && connection !== 'cancelled') {
      connection = 'disconnected';
      announcement =
        'The connection was lost and reconnection did not succeed. Nothing was fabricated; retry sends a new message or reopen the thread.';
    }
  }

  async function send(): Promise<void> {
    if (!canSend || selectedThreadId === undefined) {
      return;
    }
    const input = draft.trim();
    draft = '';
    failureCode = undefined;
    cancelError = undefined;
    // A new send is a NEW turn and therefore a NEW cancellation intent:
    // its Stop clicks must carry a fresh idempotency key.
    stopIntentKey = undefined;
    partialMarked = false;
    streamUnhealthy = false;
    cursorSeq = 0;
    connection = 'connecting';
    messages.push({ role: 'user', text: input, kind: 'live' });
    const idempotencyKey = `send-${crypto.randomUUID()}`;
    try {
      const { body } = await fetchJson(`/api/threads/${encodeURIComponent(selectedThreadId)}/turns`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, idempotencyKey }),
      });
      const result = body as { ok: boolean; code?: string; data?: { turnId?: string; streamId?: string } };
      if (!result.ok || typeof result.data?.turnId !== 'string' || typeof result.data?.streamId !== 'string') {
        connection = 'failed';
        failureCode = result.code ?? 'TURN_START_FAILED';
        announcement = `The turn did not start (${failureCode ?? 'unknown'}).`;
        return;
      }
      activeTurnId = result.data.turnId;
      activeStreamId = result.data.streamId;
      await pumpStream(result.data.streamId);
      await refreshThreads();
    } catch {
      connection = 'failed';
      failureCode = 'TURN_START_FAILED';
      announcement = 'The turn did not start.';
    }
  }

  /**
   * The visible Stop control: one user cancellation intent crosses the
   * real `/vict` proxy into the released VICT command boundary
   * (`agent.turn.cancel`) using the exact released public contract —
   * the closed vict.command@1 request envelope `{ payload: { turnId,
   * reasonCode? } }` plus a non-empty `idempotency-key` header (the
   * released boundary deterministically rejects any other shape with
   * 400 `VICT_HTTP_BODY_MALFORMED` / `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`).
   *
   * Idempotency: the FIRST Stop click for a turn creates the intent key;
   * every retry of the SAME intent (repeated clicks, redelivery) reuses
   * it, so the released boundary's durable deduplication yields exactly
   * one cancellation effect. A later send starts a new turn and a new key.
   *
   * Truthfulness: acceptance here is only an intermediate state — the UI
   * never claims cancellation before the authoritative stream terminal;
   * an HTTP rejection or network failure surfaces as a stable, accessible
   * failure state (never swallowed, never a false cancelled claim).
   */
  async function stop(): Promise<void> {
    if (activeTurnId === undefined) {
      return;
    }
    stopIntentKey ??= `stop-${crypto.randomUUID()}`;
    cancelError = undefined;
    const inFlight =
      connection === 'streaming' || connection === 'connecting' || connection === 'stopping';
    if (inFlight && connection !== 'stopping') {
      connection = 'stopping';
    }
    try {
      const { status, body } = await fetchJson('/vict/v1/turns/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': stopIntentKey },
        body: JSON.stringify({ payload: { turnId: activeTurnId, reasonCode: 'user' } }),
      });
      const result = body as {
        ok: boolean;
        code?: string;
        data?: { result?: { accepted?: boolean; duplicate?: boolean } };
      };
      if (status === 200 && result.ok) {
        // Accepted (or a durable duplicate of this same intent): keep the
        // truthful intermediate state until the authoritative terminal.
        if (
          connection === 'streaming' ||
          connection === 'connecting' ||
          connection === 'stopping'
        ) {
          connection = 'stopping';
          announcement = 'Stop request accepted. Waiting for the response to finish stopping.';
        }
        return;
      }
      if (result.code === 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS') {
        // The SAME intent is already being processed durably: intermediate
        // state, not a failure.
        if (connection === 'streaming' || connection === 'connecting') {
          connection = 'stopping';
          announcement = 'A stop request for this response is already being processed.';
        }
        return;
      }
      // HTTP rejection: surfaced accessibly — but only while the turn is
      // still in flight. If a terminal already settled the stream, the
      // truthful terminal state stands and the stale rejection is dropped.
      // The response was NOT cancelled by this request, so the stream
      // state stays truthful (streaming) and Stop remains retryable.
      if (!isSettled()) {
        cancelError = result.code ?? `HTTP_${status}`;
        if (connection === 'stopping') {
          connection = 'streaming';
        }
        announcement = `The stop request was rejected (${cancelError}). The response was not cancelled by it; you can retry.`;
      }
    } catch {
      // Network failure delivering the stop request: surfaced, never
      // swallowed, and never a false cancelled claim.
      if (!isSettled()) {
        cancelError = 'CANCEL_REQUEST_UNDELIVERED';
        if (connection === 'stopping') {
          connection = 'streaming';
        }
        announcement =
          'The stop request could not be delivered. The response was not cancelled by it; you can retry.';
      }
    }
  }

  /** Quiet durable reconcile of the open thread's transcript. */
  async function durableReconcile(): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    try {
      const { body } = await fetchJson(
        `/api/threads/${encodeURIComponent(selectedThreadId)}/messages`,
        { method: 'GET' },
      );
      const result = body as {
        ok: boolean;
        messages?: Array<{ role: string; text: string }>;
        turns?: TurnRecord[];
      };
      if (result.ok && Array.isArray(result.messages)) {
        messages = result.messages.map((message) => ({ ...message, kind: 'restored' }));
        // The VICT-authoritative turn records arrive with the same
        // response: a cancelled or failed outcome stays visibly marked
        // after the durable reconcile (never silently unmarked).
        if (Array.isArray(result.turns)) {
          turns = result.turns;
        }
        partialMarked = false;
      }
    } catch {
      // Keep what the live stream delivered; nothing is fabricated.
    }
    // The turn may have drafted a pending proposal: quiet, non-blocking
    // refresh of the memory indicator (never opens or focuses the tray).
    await refreshMemory();
  }

  // ---- Quiet memory inbox (Stage 07C Phase Q3; freeze §11) ----------------
  // A small, non-blocking pending indicator plus a USER-OPENED review tray.
  // It never opens or focuses itself, never blocks sending/streaming/
  // stopping/reconnecting, and never requires a decision before continuing.

  interface MemoryRow {
    id: string;
    kind: 'proposal' | 'claim' | 'commitment' | 'open_loop';
    proposalKind: string;
    status: string;
    title: string;
    text: string;
    threadId: string;
    turnRef: string;
    actor: string;
    decisionBy: string;
    stale: string;
    version: number;
    createdAt: number;
    updatedAt: number;
  }

  let memoryRows = $state<MemoryRow[]>([]);
  let memoryOpen = $state(false);
  let memoryBusy = $state(false);
  let memoryError = $state('');
  let pendingCount = $state(0);
  let lastPendingAnnounced = -1;
  let editingId = $state<string | undefined>(undefined);
  let editingText = $state('');
  let correctingId = $state<string | undefined>(undefined);
  let correctingText = $state('');
  let correctingReason = $state('');
  let saveKind = $state<'claim' | 'commitment' | 'open_loop'>('claim');
  let saveSubject = $state('');
  let saveText = $state('');
  let chipButton: HTMLButtonElement | undefined = undefined;

  const pendingProposals = $derived(
    memoryRows.filter(
      (row) =>
        row.kind === 'proposal' &&
        (row.status === 'proposed' || row.status === 'awaiting_decision'),
    ),
  );
  const decidedProposals = $derived(
    memoryRows.filter(
      (row) => row.kind === 'proposal' && !['proposed', 'awaiting_decision'].includes(row.status),
    ),
  );
  const memoryRecords = $derived(memoryRows.filter((row) => row.kind !== 'proposal'));

  function contentPayload(row: MemoryRow, text: string): Record<string, string> {
    // For proposals the SPECIFIC drafted kind governs the content shape;
    // for records the family does.
    const kind = row.kind === 'proposal' ? row.proposalKind : row.kind;
    if (kind === 'commitment') {
      return { commitmentKey: row.title, statement: text };
    }
    if (kind === 'open_loop') {
      return { subject: row.title, detail: text };
    }
    return { subject: row.title, statement: text };
  }

  async function refreshMemory(): Promise<void> {
    if (selectedThreadId === undefined) {
      memoryRows = [];
      pendingCount = 0;
      lastPendingAnnounced = -1;
      return;
    }
    try {
      const { body } = await fetchJson('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actionId: 'act.queryMemory',
          input: { filters: { threadId: selectedThreadId } },
        }),
      });
      const result = body as { ok: boolean; value?: { rows?: MemoryRow[] } };
      if (result.ok && result.value && typeof result.value === 'object') {
        const rows = Array.isArray(result.value.rows)
          ? result.value.rows.filter(
              (row) => row !== null && typeof row === 'object' && typeof row.id === 'string',
            )
          : [];
        memoryRows = rows;
        const count = rows.filter(
          (row) =>
            row.kind === 'proposal' &&
            (row.status === 'proposed' || row.status === 'awaiting_decision'),
        ).length;
        if (count !== lastPendingAnnounced) {
          pendingCount = count;
          if (count > 0) {
            announcement =
              count === 1
                ? '1 pending memory proposal is waiting for your review.'
                : `${count} pending memory proposals are waiting for your review.`;
          }
          lastPendingAnnounced = count;
        } else {
          pendingCount = count;
        }
      }
    } catch {
      // Truthful and quiet: the last known state stands; nothing fabricated.
    }
  }

  async function memoryAction(
    actionId: string,
    input: Record<string, unknown>,
    successMessage: string,
  ): Promise<boolean> {
    memoryBusy = true;
    memoryError = '';
    try {
      const { body } = await fetchJson('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actionId,
          input,
          idempotencyKey: `${actionId}-${crypto.randomUUID()}`,
        }),
      });
      const result = body as { ok: boolean; code?: string };
      if (result.ok) {
        announcement = successMessage;
        await refreshMemory();
        return true;
      }
      memoryError = result.code ?? 'ACTION_FAILED';
      announcement = `The memory action did not complete (${memoryError}). Nothing was changed by it.`;
      return false;
    } catch {
      memoryError = 'MEMORY_ACTION_UNDELIVERED';
      announcement = 'The memory action could not be delivered; you can retry.';
      return false;
    } finally {
      memoryBusy = false;
    }
  }

  function statusLabel(row: MemoryRow): string {
    if (row.kind === 'proposal') {
      const map: Record<string, string> = {
        proposed: 'pending',
        awaiting_decision: 'pending',
        confirmed: 'confirmed',
        rejected: 'rejected',
        amended: 'amended',
        withdrawn: 'withdrawn',
      };
      const base = map[row.status] ?? row.status;
      const pendingNow = row.status === 'proposed' || row.status === 'awaiting_decision';
      return row.stale === 'true' && pendingNow ? `${base} · out of date` : base;
    }
    return row.status;
  }

  function kindLabel(row: MemoryRow): string {
    const kind = row.kind === 'proposal' ? row.proposalKind : row.kind;
    if (kind === 'claim') return 'Possible claim';
    if (kind === 'commitment') return 'Possible commitment';
    if (kind === 'open_loop') return 'Possible open question';
    if (kind === 'correction') return 'Possible correction';
    return kind;
  }

  async function decide(actionId: string, row: MemoryRow, successMessage: string): Promise<void> {
    editingId = undefined;
    await memoryAction(actionId, { proposalId: row.id }, successMessage);
  }

  function startEdit(row: MemoryRow): void {
    editingId = row.id;
    editingText = row.text;
    correctingId = undefined;
  }

  async function commitEdit(row: MemoryRow): Promise<void> {
    if (editingText.trim().length === 0) {
      return;
    }
    // The kind-shaped content is rebuilt from what the row exposed; the
    // server re-validates it through the closed contract (freeze §5).
    // Editing NEVER confirms: the original closes as amended and a NEW
    // pending proposal replaces it.
    const done = await memoryAction(
      'act.amendProposal',
      { proposalId: row.id, content: contentPayload(row, editingText.trim()) },
      'The proposal was amended: the original closed as amended and a new pending proposal replaced it. Nothing was confirmed.',
    );
    if (done) {
      editingId = undefined;
    }
  }

  async function saveDirect(): Promise<void> {
    const text = saveText.trim();
    if (text.length === 0) {
      return;
    }
    let done = false;
    if (saveKind === 'claim') {
      done = await memoryAction(
        'act.createClaim',
        {
          threadId: selectedThreadId,
          subject: saveSubject.trim() || 'Note',
          epistemicType: 'E2',
          honestyState: 'known',
          confidence: 'stated',
          statement: text,
        },
        'Saved. The record is now confirmed memory, attributed to you.',
      );
    } else if (saveKind === 'commitment') {
      done = await memoryAction(
        'act.createCommitment',
        {
          threadId: selectedThreadId,
          commitmentKey: (saveSubject.trim() || 'commitment').replace(/[^A-Za-z0-9._:-]+/g, '-'),
          statement: text,
        },
        'Saved. The commitment is now confirmed memory, attributed to you.',
      );
    } else {
      done = await memoryAction(
        'act.createOpenLoop',
        {
          threadId: selectedThreadId,
          subject: saveSubject.trim() || 'Open question',
          loopKind: 'undecided_question',
          detail: text,
        },
        'Saved. The open loop is now confirmed memory, attributed to you.',
      );
    }
    if (done) {
      saveSubject = '';
      saveText = '';
    }
  }

  function startCorrect(row: MemoryRow): void {
    correctingId = row.id;
    correctingText = row.text;
    correctingReason = '';
    editingId = undefined;
  }

  async function commitCorrect(row: MemoryRow): Promise<void> {
    if (correctingText.trim().length === 0) {
      return;
    }
    const payload: Record<string, unknown> = {
      recordId: row.id,
      recordKind: row.kind,
      reason: correctingReason.trim(),
    };
    if (row.kind === 'open_loop') {
      payload['detail'] = correctingText.trim();
    } else {
      payload['statement'] = correctingText.trim();
    }
    const done = await memoryAction(
      'act.correctRecord',
      payload,
      'The correction was recorded with full lineage. The previous version remains attributable.',
    );
    if (done) {
      correctingId = undefined;
    }
  }

  function closeMemory(): void {
    memoryOpen = false;
    chipButton?.focus();
  }

  function toggleMemory(): void {
    if (memoryOpen) {
      closeMemory();
      return;
    }
    memoryOpen = true;
    announcement = 'Memory review opened. Pending proposals are listed; deciding is optional.';
    void refreshMemory();
  }

  $effect(() => {
    void refreshHealth();
    void refreshThreads();
  });
</script>

<section class="qlt-workspace" aria-label="Quellight conversation workspace">
  <header class="qlt-topbar">
    <h1 class="qlt-title">Quellight</h1>
    <p class="qlt-mode" data-mode={modelMode}>
      {#if modelMode === 'live'}
        Live provider: ollama-cloud / glm-5.3-flash
      {:else if modelMode === 'offline-fixture'}
        Offline deterministic fixture — no live provider call
      {:else}
        Configuration unavailable — check the operator environment
      {/if}
    </p>
  </header>

  <div class="qlt-columns">
    <nav class="qlt-threads" aria-label="Conversation threads">
      <button type="button" class="qlt-btn" onclick={() => void createThread()} disabled={busyCreating}>
        New thread
      </button>
      {#if listMessage !== ''}
        <p class="qlt-empty" role="status">{listMessage}</p>
      {/if}
      <ul class="qlt-thread-list">
        {#each threads as thread (thread.id)}
          <li>
            <button
              type="button"
              class="qlt-thread"
              class:active={thread.id === selectedThreadId}
              onclick={() => void openThread(thread.id)}
            >
              <span class="qlt-thread-title">{thread.title}</span>
              <span class="qlt-thread-state">{thread.state}</span>
            </button>
          </li>
        {/each}
      </ul>
    </nav>

    <main class="qlt-conversation" aria-label="Conversation">
      {#if selectedThread === undefined}
        <div class="qlt-center" data-state="empty">
          <p class="qlt-empty">
            Select a thread, or create one. Quellight keeps the thread list; the
            conversation lives below it.
          </p>
        </div>
      {:else}
        <div class="qlt-thread-header">
          {#if renaming}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="qlt-rename"
              aria-label="Thread title"
              bind:value={renamingTitle}
              autofocus
              onkeydown={(event) => {
                if (event.key === 'Enter') void commitRename();
                if (event.key === 'Escape') renaming = false;
              }}
            />
            <button type="button" class="qlt-btn" onclick={() => void commitRename()}>Save</button>
            <button type="button" class="qlt-btn" onclick={() => (renaming = false)}>Cancel</button>
          {:else}
            <h2 class="qlt-thread-heading">{selectedThread.title}</h2>
    {#if pendingCount > 0 || memoryRows.length > 0}
              <button
                type="button"
                class="qlt-memory-chip"
                bind:this={chipButton}
                aria-label={pendingCount > 0
                  ? `Memory review, ${pendingCount} pending ${pendingCount === 1 ? 'proposal' : 'proposals'}`
                  : 'Memory review'}
                aria-expanded={memoryOpen}
                onclick={toggleMemory}
              >
                {pendingCount > 0 ? `Memory · ${pendingCount} pending` : 'Memory'}
              </button>
            {/if}
            <button type="button" class="qlt-btn" onclick={startRename} disabled={archived}>Rename</button>
            {#if archived}
              <button type="button" class="qlt-btn" onclick={() => void threadAction('act.reopenThread', {})}
                >Reopen</button
              >
            {:else}
              <button type="button" class="qlt-btn" onclick={() => void threadAction('act.archiveThread', {})}
                >Archive</button
              >
            {/if}
          {/if}
        </div>

        {#if archived}
          <p class="qlt-banner" role="status">
            This thread is archived (dormant). It is read-only: reopen it to continue the
            conversation.
          </p>
        {/if}
        {#if turns.some((turn) => turn.status === 'failed' || turn.status === 'cancelled')}
          <p class="qlt-banner qlt-banner--warn" role="status">
            Past turn outcome: {turns.at(-1)?.status ?? 'unknown'}{turns.at(-1)?.errorCode
              ? ` (${turns.at(-1)?.errorCode})`
              : ''}. Nothing was fabricated; a retry is a new send.
          </p>
        {/if}

        <ol class="qlt-messages" aria-label="Messages">
          {#each messages as message, index (index)}
            <li class="qlt-message qlt-message--{message.role}" data-kind={message.kind}>
              <span class="qlt-role">{message.role}</span>
              <span class="qlt-text">{message.text}</span>
              {#if partialMarked && message.role === 'assistant' && index === messages.length - 1 && connection === 'cancelled'}
                <em class="qlt-partial">partial response, retained truthfully</em>
              {/if}
            </li>
          {:else}
            <li class="qlt-empty" data-state="empty-thread">No conversation history here yet.</li>
          {/each}
        </ol>

        {#if connection === 'reconnecting'}
          <p class="qlt-banner qlt-banner--warn" role="status">Reconnecting from the last acknowledged event…</p>
        {:else if connection === 'disconnected'}
          <p class="qlt-banner qlt-banner--warn" role="status">
            Disconnected. The stream did not complete; nothing was invented. You can retry.
          </p>
        {:else if connection === 'stopping'}
          <p class="qlt-banner" role="status">Stopping…</p>
        {/if}
        {#if cancelError !== undefined}
          <p class="qlt-banner qlt-banner--warn" role="status">
            The stop request was not accepted ({cancelError}). The response was not cancelled by
            that request; Stop can be retried.
          </p>
        {/if}
        {#if streamUnhealthy}
          <p class="qlt-banner qlt-banner--warn" role="status">
            The stream delivered invalid frames and was stopped. Rendering halted; no invented
            content is shown.
          </p>
        {/if}

        {#if memoryOpen}
          <section class="qlt-memory" role="region" aria-label="Memory review">
            <div class="qlt-memory-head">
              <h3 class="qlt-memory-title">Memory review</h3>
              <button
                type="button"
                class="qlt-btn qlt-memory-close"
                onclick={closeMemory}
                aria-label="Close memory review"
              >
                Close
              </button>
            </div>
            <p class="qlt-memory-hint">
              Deciding is optional and nothing is confirmed by waiting. Pending proposals stay
              pending until you decide.
            </p>
            {#if memoryError !== ''}
              <p class="qlt-memory-error" role="status">The last memory action did not complete ({memoryError}). You can retry.</p>
            {/if}

            {#if pendingProposals.length === 0 && decidedProposals.length === 0 && memoryRecords.length === 0}
              <p class="qlt-memory-empty">No pending proposals or saved memory for this thread.</p>
            {/if}

            <ul class="qlt-memory-list">
              {#each pendingProposals as row (row.id)}
                <li class="qlt-memory-item" data-stale={row.stale}>
                  <div class="qlt-memory-item-head">
                    <span class="qlt-memory-kind">{kindLabel(row)}</span>
                    <span class="qlt-memory-status" data-status={row.stale === 'true' ? 'stale' : 'pending'}>
                      {statusLabel(row)}
                    </span>
                  </div>
                  <p class="qlt-memory-title-text">{row.title}</p>
                  {#if editingId === row.id}
                    <label class="qlt-visually-hidden" for="qlt-edit-{row.id}">Amended proposal text</label>
                    <textarea
                      id="qlt-edit-{row.id}"
                      class="qlt-input qlt-memory-input"
                      rows="2"
                      bind:value={editingText}
                    ></textarea>
                    <div class="qlt-memory-actions">
                      <button
                        type="button"
                        class="qlt-btn"
                        disabled={memoryBusy}
                        onclick={() => void commitEdit(row)}
                      >
                        Save amendment
                      </button>
                      <button type="button" class="qlt-btn" onclick={() => (editingId = undefined)}>
                        Cancel
                      </button>
                    </div>
                  {:else}
                    <p class="qlt-memory-text">{row.text}</p>
                    <div class="qlt-memory-actions">
                      <button
                        type="button"
                        class="qlt-btn"
                        disabled={memoryBusy}
                        onclick={() => void decide('act.confirmProposal', row, 'Confirmed. The proposal is now confirmed memory, attributed to you.')}
                      >
                        Confirm
                      </button>
                      <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        class="qlt-btn"
                        disabled={memoryBusy}
                        onclick={() => void decide('act.rejectProposal', row, 'Rejected. Nothing was saved as memory.')}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        class="qlt-btn"
                        disabled={memoryBusy}
                        onclick={() => void decide('act.withdrawProposal', row, 'Withdrawn. The proposal was permanently withdrawn by you.')}
                      >
                        Withdraw
                      </button>
                    </div>
                  {/if}
                  <p class="qlt-memory-provenance">
                    Drafted by {row.actor === 'agent-quellight' ? 'the assistant' : row.actor} · in
                    this thread{row.turnRef !== '' ? ' · from a conversation turn' : ''}
                  </p>
                </li>
              {/each}

              {#each decidedProposals as row (row.id)}
                <li class="qlt-memory-item qlt-memory-item--decided" data-status={row.status}>
                  <div class="qlt-memory-item-head">
                    <span class="qlt-memory-kind">{kindLabel(row)}</span>
                    <span class="qlt-memory-status" data-status={row.status}>{statusLabel(row)}</span>
                  </div>
                  <p class="qlt-memory-title-text">{row.title}</p>
                  <p class="qlt-memory-text">{row.text}</p>
                  <p class="qlt-memory-provenance">
                    {row.status === 'withdrawn'
                      ? 'Permanently withdrawn by you.'
                      : row.status === 'amended'
                        ? 'Amended by you; the amended version is a new pending proposal.'
                        : row.status === 'rejected'
                          ? 'Rejected by you. Nothing was saved as memory.'
                          : `Decided by ${row.decisionBy === 'actor-quellight-local' ? 'you' : row.decisionBy}.`}
                  </p>
                </li>
              {/each}

              {#each memoryRecords as row (row.id)}
                <li class="qlt-memory-item" data-kind={row.kind}>
                  <div class="qlt-memory-item-head">
                    <span class="qlt-memory-kind">{row.kind === 'claim' ? 'Claim' : row.kind === 'commitment' ? 'Commitment' : 'Open question'}</span>
                    <span class="qlt-memory-status" data-status={row.status}>{statusLabel(row)}</span>
                  </div>
                  <p class="qlt-memory-title-text">{row.title}</p>
                  {#if correctingId === row.id}
                    <label class="qlt-visually-hidden" for="qlt-correct-{row.id}">Corrected text</label>
                    <textarea
                      id="qlt-correct-{row.id}"
                      class="qlt-input qlt-memory-input"
                      rows="2"
                      bind:value={correctingText}
                    ></textarea>
                    <label class="qlt-visually-hidden" for="qlt-correct-reason-{row.id}">Reason for the correction</label>
                    <input
                      id="qlt-correct-reason-{row.id}"
                      class="qlt-input qlt-memory-input"
                      placeholder="Why is this being corrected?"
                      bind:value={correctingReason}
                    />
                    <div class="qlt-memory-actions">
                      <button
                        type="button"
                        class="qlt-btn"
                        disabled={memoryBusy}
                        onclick={() => void commitCorrect(row)}
                      >
                        Save correction
                      </button>
                      <button type="button" class="qlt-btn" onclick={() => (correctingId = undefined)}>
                        Cancel
                      </button>
                    </div>
                  {:else}
                    <p class="qlt-memory-text">{row.text}</p>
                    {#if row.status === 'active' || row.status === 'open'}
                      <div class="qlt-memory-actions">
                        <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startCorrect(row)}>
                          Correct
                        </button>
                      </div>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>

            <form
              class="qlt-memory-save"
              aria-label="Remember this"
              onsubmit={(event) => {
                event.preventDefault();
                void saveDirect();
              }}
            >
              <h4 class="qlt-memory-save-title">Remember this</h4>
              <div class="qlt-memory-save-row">
                <label class="qlt-visually-hidden" for="qlt-save-kind">What kind of memory</label>
                <select id="qlt-save-kind" class="qlt-input" bind:value={saveKind}>
                  <option value="claim">A claim (something you know or believe)</option>
                  <option value="commitment">A commitment (something you intend)</option>
                  <option value="open_loop">An open question</option>
                </select>
              </div>
              <div class="qlt-memory-save-row">
                <label class="qlt-visually-hidden" for="qlt-save-subject">{saveKind === 'commitment' ? 'Commitment key' : 'Subject'}</label>
                <input
                  id="qlt-save-subject"
                  class="qlt-input"
                  placeholder={saveKind === 'commitment' ? 'Key (e.g. morning-deep-work)' : 'Subject'}
                  bind:value={saveSubject}
                />
              </div>
              <div class="qlt-memory-save-row">
                <label class="qlt-visually-hidden" for="qlt-save-text">{saveKind === 'open_loop' ? 'Details' : 'Statement'}</label>
                <textarea
                  id="qlt-save-text"
                  class="qlt-input"
                  rows="2"
                  placeholder={saveKind === 'open_loop' ? 'What is undecided?' : 'What should be remembered?'}
                  bind:value={saveText}
                ></textarea>
              </div>
              <div class="qlt-memory-save-row qlt-memory-save-actions">
                <button type="submit" class="qlt-btn" disabled={memoryBusy}>
                  Save
                </button>
                <span class="qlt-memory-save-note">Save immediately writes confirmed memory, attributed to you.</span>
              </div>
            </form>
          </section>
        {/if}

        <form
          class="qlt-composer"
          onsubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="qlt-visually-hidden" for="qlt-composer">Message</label>
          <textarea
            id="qlt-composer"
            class="qlt-input"
            rows="2"
            placeholder={archived ? 'Archived threads are read-only' : 'Write a message…'}
            bind:value={draft}
            disabled={archived || modelMode === 'unavailable'}
          ></textarea>
          {#if connection === 'streaming' || connection === 'connecting' || connection === 'stopping'}
            <button type="button" class="qlt-btn qlt-btn--stop" onclick={() => void stop()}>
              Stop
            </button>
          {:else}
            <button type="submit" class="qlt-btn" disabled={!canSend}>Send</button>
          {/if}
        </form>
      {/if}
    </main>
  </div>

  <p class="qlt-visually-hidden" role="status" aria-live="polite">{announcement}</p>

  <footer class="qlt-disclosure">
    <p>
      Conversation transcripts are retained locally under bounded retention; transcript persistence
      is not memory. The pending-memory inbox holds suggestions awaiting your decision: only you can
      confirm, amend, reject, or withdraw them, and confirmed memory is never visible to the
      assistant in this stage. Conversation content is sent to the configured provider when the live
      profile is active. Credentials are never stored in the product's data.
    </p>
  </footer>
</section>

<style>
  .qlt-workspace {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 70vh;
    color: var(--vict-color-text, inherit);
  }
  .qlt-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem;
  }
  .qlt-title {
    font-size: 1.25rem;
    margin: 0;
  }
  .qlt-mode {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .qlt-mode[data-mode='unavailable'] {
    color: var(--vict-color-danger, #b3261e);
    font-weight: 600;
  }
  .qlt-columns {
    display: grid;
    grid-template-columns: 16rem 1fr;
    gap: 1rem;
    flex: 1;
  }
  .qlt-threads {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-right: 1px solid var(--vict-color-border, #ccc);
    padding-right: 0.75rem;
  }
  .qlt-thread-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .qlt-thread {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .qlt-thread.active {
    background: var(--vict-color-surface, #f4f4f5);
  }
  .qlt-thread-state {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .qlt-conversation {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 40vh;
  }
  .qlt-thread-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .qlt-thread-heading {
    font-size: 1.05rem;
    margin: 0;
    margin-right: auto;
  }
  .qlt-messages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    overflow-y: auto;
  }
  .qlt-message {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    background: var(--vict-color-surface, #f6f6f7);
    max-width: 52rem;
  }
  .qlt-message--user {
    align-self: flex-end;
    background: var(--vict-color-accent-surface, #e8f0fe);
  }
  .qlt-role {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.65;
  }
  .qlt-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .qlt-partial {
    font-size: 0.8rem;
    opacity: 0.8;
  }
  .qlt-composer {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .qlt-input {
    flex: 1;
    resize: vertical;
    min-height: 2.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--vict-color-border, #ccc);
    font: inherit;
  }
  .qlt-btn {
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--vict-color-border, #ccc);
    background: var(--vict-color-surface, #fff);
    cursor: pointer;
    font: inherit;
  }
  .qlt-btn--stop {
    border-color: var(--vict-color-danger, #b3261e);
    color: var(--vict-color-danger, #b3261e);
  }
  .qlt-btn:focus-visible,
  .qlt-thread:focus-visible,
  .qlt-input:focus-visible,
  .qlt-rename:focus-visible {
    outline: 2px solid var(--vict-color-focus-ring, #1a73e8);
    outline-offset: 2px;
  }
  .qlt-banner {
    margin: 0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: var(--vict-color-surface, #f4f4f5);
    font-size: 0.9rem;
  }
  .qlt-banner--warn {
    border: 1px solid var(--vict-color-warning, #b26a00);
  }
  .qlt-empty {
    opacity: 0.75;
  }
  .qlt-center {
    display: grid;
    place-items: center;
    flex: 1;
  }
  .qlt-disclosure {
    border-top: 1px solid var(--vict-color-border, #ccc);
    padding-top: 0.5rem;
  }
  .qlt-disclosure p {
    margin: 0;
    font-size: 0.78rem;
    opacity: 0.75;
  }
  .qlt-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .qlt-memory-chip {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--vict-color-border, #ccc);
    background: var(--vict-color-surface, #f4f4f5);
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
  }
  .qlt-memory {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--vict-color-border, #ccc);
    border-radius: 8px;
    padding: 0.75rem;
    max-height: 24rem;
    overflow-y: auto;
    background: var(--vict-color-surface, #fbfbfc);
  }
  .qlt-memory-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .qlt-memory-title {
    margin: 0;
    font-size: 0.95rem;
  }
  .qlt-memory-hint,
  .qlt-memory-empty {
    margin: 0;
    font-size: 0.8rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--vict-color-danger, #b3261e);
  }
  .qlt-memory-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .qlt-memory-item {
    border: 1px solid var(--vict-color-border, #ddd);
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .qlt-memory-item--decided {
    background: var(--vict-color-surface, #f6f6f7);
  }
  .qlt-memory-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .qlt-memory-kind {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-status {
    font-size: 0.72rem;
    border-radius: 999px;
    padding: 0.05rem 0.5rem;
    border: 1px solid var(--vict-color-border, #ccc);
  }
  .qlt-memory-status[data-status='pending'] {
    border-color: var(--vict-color-warning, #b26a00);
    color: var(--vict-color-warning, #b26a00);
  }
  .qlt-memory-status[data-status='stale'] {
    border-color: var(--vict-color-danger, #b3261e);
    color: var(--vict-color-danger, #b3261e);
  }
  .qlt-memory-status[data-status='confirmed'],
  .qlt-memory-status[data-status='active'] {
    border-color: var(--vict-color-success, #1b7f4d);
    color: var(--vict-color-success, #1b7f4d);
  }
  .qlt-memory-title-text {
    margin: 0;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .qlt-memory-text {
    margin: 0;
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .qlt-memory-provenance {
    margin: 0;
    font-size: 0.72rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .qlt-memory-input {
    width: 100%;
  }
  .qlt-memory-save {
    border-top: 1px solid var(--vict-color-border, #ddd);
    padding-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .qlt-memory-save-title {
    margin: 0;
    font-size: 0.9rem;
  }
  .qlt-memory-save-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .qlt-memory-save-actions {
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
  }
  .qlt-memory-save-note {
    font-size: 0.72rem;
    opacity: 0.7;
  }
  @media (max-width: 720px) {
    .qlt-columns {
      grid-template-columns: 1fr;
    }
    .qlt-threads {
      border-right: none;
      border-bottom: 1px solid var(--vict-color-border, #ccc);
      padding-right: 0;
      padding-bottom: 0.5rem;
    }
    .qlt-thread-list {
      flex-direction: row;
      overflow-x: auto;
    }
    .qlt-thread {
      flex-direction: column;
      width: auto;
      white-space: nowrap;
    }
    .qlt-memory {
      max-height: 20rem;
    }
  }
</style>
