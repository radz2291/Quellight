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
  let turnOpenNotice = $state(false);
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
    turnOpenNotice = false;
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
    exitingId = undefined;
    exitReason = '';
    exitingVerb = undefined;
    memoryTab = 'pending';
    lastPendingAnnounced = -1;
    await refreshMemory();
    await refreshAssembly();
    await refreshInspection();
    await refreshChallenges();
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
    const restingConnection = connection;
    draft = '';
    failureCode = undefined;
    cancelError = undefined;
    turnOpenNotice = false;
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
        if (result.code === 'QLT_TURN_ALREADY_OPEN') {
          // H-1 remediation: the quiet, non-interruptive refusal. The
          // optimistic local message is withdrawn (it never reached the
          // durable transcript), the composer is restored, and the resting
          // connection state is kept. No modal, no tray opening, no focus
          // change, no queueing, no second turn.
          messages.splice(messages.length - 1, 1);
          draft = input;
          connection = restingConnection;
          turnOpenNotice = true;
          announcement = 'A reply is already in progress for this conversation.';
          return;
        }
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
    // Q4: the quiet context-usage line refreshes with the same discipline.
    await refreshMemory();
    await refreshAssembly();
  }

  // ---- Quiet memory surface (Stage 07C Phases Q3–Q5; Q5 freeze §3/§4) -----
  // A small, non-blocking pending indicator plus a USER-OPENED four-area
  // Memory surface (Pending / Current / History / Used for reply) and the
  // global Memory Mode control. It never opens or focuses itself, never
  // blocks sending/streaming/stopping/reconnecting, and never requires a
  // decision before continuing. All writes cross the governed /api/act
  // boundary; all inspection reads cross the read-only act.queryInspection
  // surface (RECORDED evidence only — never recomputed).

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

  /** One bounded inspection row (record or proposal) from qlt.inspection. */
  interface InspectionRow {
    kind: string;
    kindLabel: string;
    proposalKind: string;
    status: string;
    statusLabel: string;
    title: string;
    text: string;
    originThreadId: string | null;
    turnRef: string;
    actor: string;
    decisionBy: string;
    exitReason: string | null;
    exitedAtMs: number | null;
    version: number;
    createdAtMs: number;
    updatedAtMs: number;
    createdRecordId: string | null;
    details: { recordId: string; contentFingerprint: string; retentionState: string };
  }

  /** The unified view model for Current/History lifecycle rows. */
  interface RecordRowView {
    id: string;
    /** The record family ('claim' | 'commitment' | 'open_loop'; History also carries 'proposal'). */
    kind: string;
    title: string;
    text: string;
    status: string;
    statusLabel: string;
    version: number;
    origin: string;
    createdAtMs: number;
    updatedAtMs: number;
    actor: string;
    decisionBy: string;
    exitReason: string | null;
    contentFingerprint: string;
    proposalKind: string;
    createdRecordId: string | null;
  }

  interface TurnSummary {
    turnId: string;
    outcome: string;
    usedCount: number;
    memoryMode: string | undefined;
    memoryModeLabel: string;
    failureCode?: string;
    createdAtMs: number;
  }

  interface TurnDetail {
    usage: string;
    usageLabel: string;
    appliedPolicy: { policyId: string; mode: string; revision: number } | null;
    usedCount: number;
    selected: {
      kindLabel: string;
      origin: string;
      selectedVersion: number;
      currentVersion?: number;
      supersededSince?: boolean;
      title?: string;
      content: string | null;
      tombstone: string | null;
      details: { recordId: string };
    }[];
    exclusions: {
      kindLabel: string;
      reason: string;
      reasonLabel: string;
      details: { recordId: string };
    }[];
    exclusionsAreBoundedSubset: boolean;
    excludedBeyondCount: number | null;
    details: Record<string, unknown>;
  }

  type MemoryTab = 'pending' | 'current' | 'history' | 'used';

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
  let chipButton = $state<HTMLButtonElement | undefined>(undefined);

  // Q5 four-area surface state.
  let memoryTab = $state<MemoryTab>('pending');
  let currentRows = $state<RecordRowView[]>([]);
  let historyRows = $state<RecordRowView[]>([]);
  let inspectionError = $state('');
  let exitingId = $state<string | undefined>(undefined);
  let exitReason = $state('');
  let exitingVerb = $state<'abandon' | 'transform' | undefined>(undefined);
  let detailsOpenId = $state<string | undefined>(undefined);
  // Q5 Used-for-reply state (bounded chooser + recorded detail).
  let turnRows = $state<TurnSummary[]>([]);
  let selectedTurnId = $state<string | undefined>(undefined);
  let turnDetail = $state<TurnDetail | undefined>(undefined);
  let turnDetailError = $state('');
  // Q5 Memory Mode control state (the durable global policy).
  const MEMORY_MODE_CHOICES = [
    {
      value: 'across-conversations',
      label: 'Across conversations (default)',
      hint: 'Memory from this conversation, saved notes, and other conversations may be used.',
    },
    {
      value: 'per-conversation',
      label: 'Within each conversation only',
      hint: 'Only memory created in this conversation is used.',
    },
    {
      value: 'off',
      label: 'Memory off',
      hint: 'No memory is used in replies.',
    },
  ] as const;
  let memoryModeChoice = $state<string>('across-conversations');
  let memoryModeCurrent = $state<string | undefined>(undefined);

  // ---- Stage 07D D1/D3/D2 data-safety controls (quiet; user-opened) ------
  // Retention (remove/expiry/pass), conflict challenges, conversation
  // deletion, export, and deep purge. Nothing here opens, focuses, or
  // announces itself: every control lives inside the USER-OPENED memory
  // tray or the thread header, and every destructive confirmation is
  // shown only after an intentional click. Conversation-only deletion is
  // the DEFAULT choice; deep purge exists only for an already deleted
  // conversation and requires typing the confirmation word.
  interface ChallengeRow {
    challengeId: string;
    status: string;
    classification: string;
    resolution: string | null;
    threadId: string;
    createdAtMs: number;
  }
  interface DeletionPreview {
    threadId: string;
    originating: { current: number; alreadyExpired: number; alreadyRemoved: number };
    pendingProposals: number;
    pendingCorrections: number;
    deletion?: { status: string; mode: string; errorCode: string | null } | undefined;
    purged?: boolean;
  }
  let challenges = $state<ChallengeRow[]>([]);
  let resolvingChallengeId = $state<string | undefined>(undefined);
  let resolveStatement = $state('');
  let dataSafetyOpen = $state(false);
  let deleting = $state(false);
  let deletionPreview = $state<DeletionPreview | undefined>(undefined);
  let deletionMode = $state<'conversation-only' | 'conversation-and-originating-meaning'>(
    'conversation-only',
  );
  let deletionBusy = $state(false);
  let deletionNotice = $state('');
  let deletionError = $state('');
  let purgeOpen = $state(false);
  let purgeWord = $state('');
  let purgeBusy = $state(false);
  let expiringId = $state<string | undefined>(undefined);

  const deletedConversation = $derived(
    selectedThread !== undefined && selectedThread.retentionState === 'user-removed',
  );

  async function refreshChallenges(): Promise<void> {
    if (selectedThreadId === undefined) {
      challenges = [];
      return;
    }
    try {
      const { body } = await fetchJson('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actionId: 'act.queryConflict',
          input: { filters: { threadId: selectedThreadId } },
        }),
      });
      const result = body as { ok: boolean; value?: { rows?: ChallengeRow[] } };
      if (result.ok && result.value && Array.isArray(result.value.rows)) {
        challenges = result.value.rows.filter(
          (row) => row !== null && typeof row === 'object' && typeof row.challengeId === 'string',
        );
      }
    } catch {
      // Truthful and quiet: the last known state stands.
    }
  }

  function openChallenges(): ChallengeRow[] {
    return challenges.filter((row) => row.status === 'open');
  }

  async function dismissChallenge(row: ChallengeRow): Promise<void> {
    await memoryAction(
      'act.dismissChallenge',
      { challengeId: row.challengeId },
      'The challenge was dismissed. Nothing was changed about your memory.',
    );
    await refreshChallenges();
  }

  function startResolveChallenge(row: ChallengeRow): void {
    resolvingChallengeId = row.challengeId;
    resolveStatement = '';
  }

  async function commitResolveChallenge(): Promise<void> {
    if (resolvingChallengeId === undefined || resolveStatement.trim().length === 0) {
      return;
    }
    const done = await memoryAction(
      'act.resolveChallengeWithAmendment',
      { challengeId: resolvingChallengeId, statement: resolveStatement.trim() },
      'Resolved by amendment: the existing commitment was amended and stays in force.',
    );
    if (done) {
      resolvingChallengeId = undefined;
      resolveStatement = '';
      await refreshChallenges();
      await refreshMemory();
    }
  }

  async function removeRecord(row: RecordRowView): Promise<void> {
    const done = await memoryAction(
      'act.removeRecord',
      { recordId: row.id, recordKind: row.kind },
      'Removed. The content is now a content-free tombstone and is excluded from your context. History keeps the truthful lifecycle record.',
    );
    if (done) {
      await refreshMemory();
      await refreshInspection();
    }
  }

  function startExpiry(row: RecordRowView): void {
    expiringId = row.id;
  }

  async function setExpiry(row: RecordRowView, days: number | null): Promise<void> {
    const expiresAtMs = days === null ? 0 : Date.now() + days * 24 * 60 * 60 * 1000;
    const done = await memoryAction(
      'act.setClaimExpiry',
      { claimId: row.id, expiresAtMs, expectedVersion: row.version },
      days === null
        ? 'Expiry cleared. The claim stays active until you remove or retire it.'
        : 'Expiry set. Nothing changes until you run the retention pass; the claim stays in force until then.',
    );
    if (done) {
      expiringId = undefined;
      await refreshMemory();
      await refreshInspection();
    }
  }

  async function runRetentionPass(): Promise<void> {
    await memoryAction(
      'act.runRetentionPass',
      {},
      'The retention pass ran: due claims are now expired and excluded from your context. Durable evidence was recorded.',
    );
    await refreshMemory();
    await refreshInspection();
  }

  async function openDeletionChooser(): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    deleting = true;
    deletionMode = 'conversation-only';
    deletionError = '';
    deletionNotice = '';
    purgeOpen = false;
    purgeWord = '';
    try {
      const { body } = await fetchJson(
        `/api/threads/${encodeURIComponent(selectedThreadId)}/deletion?mode=conversation-only`,
      );
      const result = body as { ok: boolean; value?: DeletionPreview; code?: string };
      if (result.ok && result.value) {
        deletionPreview = result.value;
      } else {
        deletionError = result.code ?? 'QLT_DELETION_INCOMPLETE';
      }
    } catch {
      deletionError = 'QLT_DELETION_INCOMPLETE';
    }
  }

  function closeDeletionChooser(): void {
    deleting = false;
    deletionPreview = undefined;
    purgeOpen = false;
    purgeWord = '';
  }

  async function confirmDeletion(): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    deletionBusy = true;
    deletionError = '';
    try {
      const { body } = await fetchJson(
        `/api/threads/${encodeURIComponent(selectedThreadId)}/deletion`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: deletionMode,
            confirmed: true,
            key: `deletion-${crypto.randomUUID()}`,
          }),
        },
      );
      const result = body as {
        ok: boolean;
        value?: { row?: { status: string } };
        code?: string;
      };
      if (result.ok && result.value?.row) {
        deletionNotice =
          result.value.row.status === 'completed'
            ? deletionMode === 'conversation-only'
              ? 'The conversation was deleted. Your saved meaning from other places is untouched and stays in force.'
              : 'The conversation and the meaning that started in it were deleted. Other conversations’ meaning is untouched.'
            : `The deletion is not fully complete yet (status: ${result.value.row.status}). Nothing is hidden; you can retry.`;
        if (result.value.row.status !== 'completed') {
          deletionError = 'QLT_DELETION_INCOMPLETE';
        }
        await refreshThreads();
        closeDeletionChooser();
      } else {
        deletionError = result.code ?? 'QLT_DELETION_INCOMPLETE';
      }
    } catch {
      deletionError = 'QLT_DELETION_INCOMPLETE';
    } finally {
      deletionBusy = false;
    }
  }

  async function cancelDeletionOperation(): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    deletionBusy = true;
    try {
      await fetchJson(`/api/threads/${encodeURIComponent(selectedThreadId)}/deletion`, {
        method: 'DELETE',
      });
      deletionNotice = 'The deletion was canceled before it ran. Nothing was changed.';
      closeDeletionChooser();
    } finally {
      deletionBusy = false;
    }
  }

  async function confirmPurge(): Promise<void> {
    if (selectedThreadId === undefined || purgeWord !== 'purge') {
      return;
    }
    purgeBusy = true;
    deletionError = '';
    try {
      const { body } = await fetchJson(
        `/api/threads/${encodeURIComponent(selectedThreadId)}/purge`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirmation: purgeWord }),
        },
      );
      const result = body as { ok: boolean; code?: string };
      if (result.ok) {
        deletionNotice =
          'The deep purge finished inside this application’s stores. Content may still exist in Git history, operating-system backups, external copies, or provider systems; this is not secure erasure.';
        await refreshThreads();
        closeDeletionChooser();
      } else {
        deletionError = result.code ?? 'QLT_PURGE_INCOMPLETE';
      }
    } catch {
      deletionError = 'QLT_PURGE_INCOMPLETE';
    } finally {
      purgeBusy = false;
    }
  }

  async function exportUserData(): Promise<void> {
    deletionError = '';
    try {
      const response = await fetch('/api/export');
      if (!response.ok) {
        deletionError = 'QLT_EXPORT_FAILED';
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'quellight-user-export.json';
      anchor.click();
      URL.revokeObjectURL(url);
      deletionNotice =
        'The export was generated and handed to you. It is not stored by the application.';
    } catch {
      deletionError = 'QLT_EXPORT_FAILED';
    }
  }

  // ---- Q4 quiet context-usage line (frozen contract §9; D-Q4-6) ----------
  // One quiet, non-interruptive line inside the USER-OPENED tray only,
  // derived from the thread's latest durable assembly record. Exact frozen
  // strings; the transcript is never annotated and the tray never opens
  // itself.
  interface AssemblySummary {
    outcome: 'complete' | 'empty' | 'failed';
    usedCount: number;
    memoryMode?: string;
  }
  let assemblySummary = $state<AssemblySummary | undefined>(undefined);

  function assemblyLine(summary: AssemblySummary | undefined): string {
    if (summary === undefined) {
      return 'No memories used';
    }
    if (summary.outcome === 'failed') {
      return 'Memory unavailable for this turn';
    }
    if (summary.memoryMode === 'off') {
      // Q5: an intentionally disabled mode is never misreported as "no
      // memory existed" (Q5 freeze §3.5).
      return 'Memory was off for your last reply here.';
    }
    if (summary.outcome === 'complete' && summary.usedCount > 0) {
      return summary.usedCount === 1
        ? 'Your last reply here used 1 memory.'
        : `Your last reply here used ${summary.usedCount} memories.`;
    }
    return 'No memories used';
  }

  async function refreshAssembly(): Promise<void> {
    if (selectedThreadId === undefined) {
      assemblySummary = undefined;
      return;
    }
    try {
      const { body } = await fetchJson(
        `/api/threads/${encodeURIComponent(selectedThreadId)}/assembly`,
        { method: 'GET' },
      );
      const result = body as {
        ok: boolean;
        assembly?: { outcome?: unknown; usedCount?: unknown; memoryMode?: unknown };
      };
      if (result.ok && result.assembly !== undefined && result.assembly !== null) {
        const outcome = result.assembly.outcome;
        const usedCount = result.assembly.usedCount;
        const memoryMode = result.assembly.memoryMode;
        if (
          (outcome === 'complete' || outcome === 'empty' || outcome === 'failed') &&
          typeof usedCount === 'number' &&
          Number.isSafeInteger(usedCount) &&
          usedCount >= 0
        ) {
          assemblySummary = {
            outcome,
            usedCount,
            ...(typeof memoryMode === 'string' ? { memoryMode } : {}),
          };
        }
      } else if (result.ok) {
        assemblySummary = undefined;
      }
      // A failed summary fetch keeps the last known state (nothing fabricated).
    } catch {
      /* quiet: the last known state stands */
    }
  }

  // ---- Q5 four-area surface reads (act.queryInspection; RECORDED evidence
  // only — the Used-for-reply view never recomputes a historical turn) -----

  async function inspectionQuery(
    filters: Record<string, string>,
  ): Promise<Record<string, unknown> | undefined> {
    const { body } = await fetchJson('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'act.queryInspection', input: { filters } }),
    });
    const result = body as { ok: boolean; row?: Record<string, unknown>; value?: unknown };
    if (!result.ok) {
      return undefined;
    }
    // The ingress query path returns the result object itself (rows/total
    // or row) — unwrap either shape truthfully.
    const value = (body as { value?: { row?: Record<string, unknown> } }).value;
    return (result.row ?? value?.row ?? value ?? undefined) as
      | Record<string, unknown>
      | undefined;
  }

  function originLabelOf(row: {
    originThreadId: string | null;
    turnRef?: string;
  }): string {
    if (row.originThreadId === null || row.originThreadId === '') {
      return 'saved without a conversation';
    }
    if (row.originThreadId === selectedThreadId) {
      return 'this conversation';
    }
    return 'another conversation';
  }

  function recordViewOf(row: InspectionRow): RecordRowView {
    return {
      id: row.details.recordId,
      kind: row.kind,
      title: row.title,
      text: row.text,
      status: row.status,
      statusLabel: row.statusLabel,
      version: row.version,
      origin: originLabelOf(row),
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      actor: row.actor,
      decisionBy: row.decisionBy,
      exitReason: row.exitReason,
      contentFingerprint: row.details.contentFingerprint,
      proposalKind: row.proposalKind,
      createdRecordId: row.createdRecordId,
    };
  }

  function timeLabel(ms: number): string {
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return '';
    }
  }

  async function refreshInspection(): Promise<void> {
    if (selectedThreadId === undefined) {
      currentRows = [];
      historyRows = [];
      turnRows = [];
      turnDetail = undefined;
      selectedTurnId = undefined;
      memoryModeCurrent = undefined;
      return;
    }
    try {
      inspectionError = '';
      const current = await inspectionQuery({ query: 'listRecords', bucket: 'current' });
      const rows = (current?.['rows'] as InspectionRow[] | undefined) ?? [];
      currentRows = rows.map(recordViewOf);
      const history = await inspectionQuery({ query: 'listRecords', bucket: 'history' });
      const historyList = (history?.['rows'] as InspectionRow[] | undefined) ?? [];
      historyRows = historyList.map(recordViewOf);
      const turns = await inspectionQuery({
        query: 'listTurns',
        threadId: selectedThreadId,
        limit: '20',
      });
      const turnList = (turns?.['rows'] as TurnSummary[] | undefined) ?? [];
      turnRows = turnList.slice(0, 20);
      if (selectedTurnId !== undefined && !turnRows.some((turn) => turn.turnId === selectedTurnId)) {
        selectedTurnId = undefined;
        turnDetail = undefined;
      }
      const policy = await inspectionQuery({ query: 'getPolicy' });
      const mode = policy?.['mode'];
      memoryModeCurrent = typeof mode === 'string' ? mode : undefined;
      if (memoryModeCurrent !== undefined) {
        memoryModeChoice = memoryModeCurrent;
      }
    } catch {
      inspectionError = 'QLT_INSPECTION_UNAVAILABLE';
    }
  }

  async function openTurn(turnId: string): Promise<void> {
    if (selectedThreadId === undefined) {
      return;
    }
    selectedTurnId = turnId;
    turnDetailError = '';
    try {
      const detail = await inspectionQuery({
        query: 'getTurn',
        threadId: selectedThreadId,
        turnId,
      });
      if (detail === undefined) {
        turnDetail = undefined;
        turnDetailError = 'QLT_INSPECTION_TURN_MISSING';
        return;
      }
      turnDetail = detail as unknown as TurnDetail;
    } catch {
      turnDetail = undefined;
      turnDetailError = 'QLT_INSPECTION_TURN_MISSING';
    }
  }

  function turnLabel(turn: TurnSummary): string {
    const when = timeLabel(turn.createdAtMs);
    if (turn.memoryMode === 'off') {
      return `Reply · memory off${when !== '' ? ` · ${when}` : ''}`;
    }
    if (turn.outcome === 'failed') {
      return `Reply · memory unavailable${when !== '' ? ` · ${when}` : ''}`;
    }
    if (turn.outcome === 'complete' && turn.usedCount > 0) {
      return `Reply · used ${turn.usedCount} ${turn.usedCount === 1 ? 'memory' : 'memories'}${when !== '' ? ` · ${when}` : ''}`;
    }
    return `Reply · no memories used${when !== '' ? ` · ${when}` : ''}`;
  }

  async function saveMemoryMode(): Promise<void> {
    memoryBusy = true;
    memoryError = '';
    try {
      const { body } = await fetchJson('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actionId: 'act.setMemoryMode',
          input: { mode: memoryModeChoice },
          idempotencyKey: `memory-mode-${crypto.randomUUID()}`,
        }),
      });
      const result = body as { ok: boolean; code?: string };
      if (result.ok) {
        memoryModeCurrent = memoryModeChoice;
        announcement = `Memory mode saved: it applies to all conversations and takes effect on your next message.`;
      } else {
        memoryError = result.code ?? 'ACTION_FAILED';
        announcement = `The memory mode was not changed (${memoryError}).`;
      }
    } catch {
      memoryError = 'MEMORY_ACTION_UNDELIVERED';
      announcement = 'The memory mode change could not be delivered; you can retry.';
    } finally {
      memoryBusy = false;
    }
  }

  function pendingProposals(): MemoryRow[] {
    return memoryRows.filter(
      (row) =>
        row.kind === 'proposal' &&
        (row.status === 'proposed' || row.status === 'awaiting_decision'),
    );
  }

  function isLifecycleRow(row: RecordRowView | MemoryRow): boolean {
    return (
      row.status === 'active' ||
      row.status === 'open' ||
      row.status === 'superseded' ||
      row.status === 'retired' ||
      row.status === 'released' ||
      row.status === 'resolved' ||
      row.status === 'abandoned' ||
      row.status === 'transformed'
    );
  }

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
        // Q5: lifecycle/correction effects move rows between areas — the
        // inspection buckets refresh with the same quiet discipline.
        await refreshInspection();
        return true;
      }
      memoryError = result.code ?? 'ACTION_FAILED';
      announcement = `The memory action did not complete (${memoryError}). Nothing was changed by it.`;
      // D3: a refused conflicting confirmation records a challenge —
      // refresh the quiet Data safety rows so it becomes visible.
      await refreshChallenges();
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

  function startCorrect(row: RecordRowView | MemoryRow): void {
    correctingId = row.id;
    correctingText = row.text;
    correctingReason = '';
    editingId = undefined;
  }

  async function commitCorrect(row: RecordRowView | MemoryRow): Promise<void> {
    if (correctingText.trim().length === 0) {
      return;
    }
    const payload: Record<string, unknown> = {
      recordId: row.id,
      recordKind: row.kind,
      reason: correctingReason.trim(),
      expectedVersion: row.version,
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

  /**
   * Q5 lifecycle exits from the Current area (freeze §3.2): retire a
   * claim, release a commitment, resolve/abandon/transform an open loop.
   * All writes cross the governed /api/act boundary with the exact
   * version check; reason-required exits use the inline reason input
   * (no browser-native blocking dialogs).
   */
  function startExit(row: RecordRowView, verb: 'retire' | 'release' | 'resolve'): void {
    exitingId = row.id;
    exitReason = '';
    const actionId =
      verb === 'retire'
        ? 'act.retireClaim'
        : verb === 'release'
          ? 'act.releaseCommitment'
          : 'act.resolveLoop';
    void commitExit(actionId, row);
  }

  function startReasonedExit(
    row: RecordRowView,
    verb: 'abandon' | 'transform',
  ): void {
    exitingId = row.id;
    exitReason = '';
    exitingVerb = verb;
  }

  function cancelExit(): void {
    exitingId = undefined;
    exitReason = '';
    exitingVerb = undefined;
  }

  async function commitExit(
    actionId: string,
    row: RecordRowView,
  ): Promise<void> {
    const done = await memoryAction(
      actionId,
      {
        recordId: row.id,
        expectedVersion: row.version,
        ...(exitReason.trim() !== '' ? { reason: exitReason.trim() } : {}),
      },
      'The lifecycle change was recorded with full attribution.',
    );
    if (done) {
      exitingId = undefined;
      exitReason = '';
      exitingVerb = undefined;
    }
  }

  async function commitReasonedExit(): Promise<void> {
    if (exitingId === undefined || exitingVerb === undefined) {
      return;
    }
    const row = currentRows.find((entry) => entry.id === exitingId);
    if (row === undefined) {
      cancelExit();
      return;
    }
    const reason = exitReason.trim();
    const actionId = exitingVerb === 'abandon' ? 'act.abandonLoop' : 'act.transformLoop';
    if (reason.length === 0) {
      memoryError = 'QLT_INPUT_REJECTED';
      announcement = 'This exit requires a bounded reason; nothing was changed.';
      return;
    }
    await commitExit(actionId, row);
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
    announcement =
      'Memory review opened. Pending proposals are listed; deciding is optional.';
    void refreshMemory();
    void refreshAssembly();
    void refreshInspection();
  }

  /** Q5: real Escape-to-close via the window-level keydown (M-2 law). */
  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && memoryOpen) {
      event.preventDefault();
      closeMemory();
    }
  }

  function toggleDetails(id: string): void {
    detailsOpenId = detailsOpenId === id ? undefined : id;
  }

  /** True when every area is empty (the truthful empty-state message). */
  function memoryEmpty(): boolean {
    return (
      pendingProposals().length === 0 &&
      currentRows.length === 0 &&
      historyRows.length === 0 &&
      turnRows.length === 0
    );
  }

  /** The user-facing label of a stable Memory Mode identity. */
  function memoryModeChoiceLabel(mode: string): string {
    if (mode === 'across-conversations') return 'Across conversations';
    if (mode === 'per-conversation') return 'Within each conversation only';
    if (mode === 'off') return 'Memory off';
    return mode;
  }

  /** The human kind label of a record family (Current/History). */
  function recordKindLabel(kind: string): string {
    if (kind === 'claim') return 'Claim';
    if (kind === 'commitment') return 'Commitment';
    if (kind === 'open_loop') return 'Open question';
    return kind;
  }

  /** The human label of a terminal proposal in History. */
  function proposalHistoryLabel(row: RecordRowView): string {
    const kind = recordKindLabel(row.proposalKind === '' ? row.kind : row.proposalKind);
    if (row.status === 'confirmed') return `Confirmed ${kind.toLowerCase()} proposal`;
    if (row.status === 'rejected') return `Rejected ${kind.toLowerCase()} proposal`;
    if (row.status === 'amended') return `Amended ${kind.toLowerCase()} proposal`;
    if (row.status === 'withdrawn') return `Withdrawn ${kind.toLowerCase()} proposal`;
    return `${kind} proposal`;
  }

  $effect(() => {
    void refreshHealth();
    void refreshThreads();
  });
</script>

<!-- Q5 (freeze §13): real Escape-to-close via the window-level keydown —
     this also removes the a11y warning of a key listener on a non-
     interactive <section>. Focus returns to the memory chip on close. -->
<svelte:window onkeydown={handleWindowKeydown} />

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

    <main
      class="qlt-conversation"
      class:qlt-conversation--with-memory={memoryOpen}
      aria-label="Conversation"
    >
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
            <!-- Q5 (freeze §5): the Memory chip is ALWAYS present for an
                 open thread; the pending count appears only when applicable. -->
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
            {#if !archived && !deletedConversation}
              <!-- D2: the conversation-deletion chooser (conversation-only
                   is the DEFAULT; nothing destructive is preselected beyond
                   that default; the confirmation appears only after this
                   intentional click) -->
              <button
                type="button"
                class="qlt-btn"
                data-testid="delete-conversation"
                onclick={() => void openDeletionChooser()}
              >
                Delete
              </button>
            {/if}
          {/if}
        </div>

        {#if deletedConversation}
          <!-- D2: truthful deleted state (content-free tombstone) -->
          <p class="qlt-banner" role="status" data-testid="deleted-banner">
            This conversation was deleted. Its content is gone from this application's stores;
            only a content-free record remains. Saved meaning from other conversations is
            untouched.
          </p>
        {/if}
        {#if deleting && deletionPreview}
          <section class="qlt-banner" aria-label="Delete this conversation" data-testid="deletion-chooser">
            <p><strong>Delete this conversation?</strong></p>
            <label class="qlt-deletion-option">
              <input type="radio" name="qlt-deletion-mode" value="conversation-only" bind:group={deletionMode} />
              <span>
                <strong>Delete conversation only</strong> (default). The messages and the assistant's
                memory of this conversation are deleted through the governed boundary. Your saved
                Shared World meaning is preserved and stays in force.
              </span>
            </label>
            <label class="qlt-deletion-option">
              <input type="radio" name="qlt-deletion-mode" value="conversation-and-originating-meaning" bind:group={deletionMode} />
              <span>
                <strong>Also delete the meaning that started in this conversation.</strong> Only
                records proven to originate here are removed (content-free tombstones; deterministic
                dependency rules). Meaning from other conversations and global records are never
                touched.{deletionPreview.originating.current > 0
                  ? ` This will remove ${deletionPreview.originating.current} record${deletionPreview.originating.current === 1 ? '' : 's'} and withdraw ${deletionPreview.pendingProposals} pending proposal${deletionPreview.pendingProposals === 1 ? '' : 's'}.`
                  : ' No originating records exist.'}
              </span>
            </label>
            <div class="qlt-memory-actions">
              <button type="button" class="qlt-btn" disabled={deletionBusy} onclick={() => void confirmDeletion()} data-testid="confirm-deletion">
                Confirm delete
              </button>
              <!-- Closing the chooser is a pure UI cancel: no deletion row
                   exists yet (the preview is pure), so there is nothing to
                   cancel server-side and the effect is exactly zero. -->
              <button type="button" class="qlt-btn" onclick={closeDeletionChooser}>
                Cancel
              </button>
            </div>
          </section>
        {/if}
        {#if deletedConversation && !purgeOpen}
          <!-- D2: deep purge — separate, explicit, never default, never
               combined with ordinary removal; only for an already deleted
               conversation -->
          <div class="qlt-memory-actions">
            <button type="button" class="qlt-btn" onclick={() => (purgeOpen = true)} data-testid="open-purge">
              Deep purge remaining records
            </button>
          </div>
        {/if}
        {#if deletedConversation && purgeOpen}
          <section class="qlt-banner" aria-label="Deep purge this conversation">
            <p>
              Deep purge removes the remaining rows of this deleted conversation from this
              application's stores and reclaims freed space. This is not secure erasure: content
              may remain in Git history, operating-system backups, external copies, and provider
              systems.
            </p>
            <label class="qlt-visually-hidden" for="qlt-purge-word">Type purge to confirm</label>
            <input
              id="qlt-purge-word"
              class="qlt-input"
              placeholder="Type purge to confirm"
              bind:value={purgeWord}
            />
            <div class="qlt-memory-actions">
              <button
                type="button"
                class="qlt-btn"
                disabled={purgeBusy || purgeWord !== 'purge'}
                onclick={() => void confirmPurge()}
                data-testid="confirm-purge"
              >
                Deep purge
              </button>
              <button type="button" class="qlt-btn" onclick={() => ((purgeOpen = false), (purgeWord = ''))}>
                Cancel
              </button>
            </div>
          </section>
        {/if}
        {#if deletionNotice !== ''}
          <p class="qlt-banner" role="status" data-testid="deletion-notice">{deletionNotice}</p>
        {/if}
        {#if deletionError !== ''}
          <p class="qlt-banner qlt-banner--warn" role="status">
            The last deletion/export action did not complete ({deletionError}). Nothing is hidden;
            you can retry.
          </p>
        {/if}

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

        {#if turnOpenNotice}
          <p class="qlt-banner" role="status">
            A reply is already in progress for this conversation. Your message was not sent and
            nothing was queued.
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
          <section class="qlt-memory" aria-label="Memory review">
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
              pending until you decide. History and Used for reply show recorded evidence only.
            </p>
            <p class="qlt-memory-assembly" role="status" data-assembly={assemblySummary === undefined ? 'none' : assemblySummary.outcome}>
              {assemblyLine(assemblySummary)}
            </p>
            {#if memoryError !== ''}
              <p class="qlt-memory-error" role="status">The last memory action did not complete ({memoryError}). You can retry.</p>
            {:else if inspectionError !== ''}
              <p class="qlt-memory-error" role="status">The inspection surface did not answer ({inspectionError}). You can retry by reopening.</p>
            {/if}

            <!-- Q5 Memory Mode control (Q5-OD-1; lives ONLY inside this
                 surface; applies to ALL conversations; user-attributed,
                 idempotent governed mutation) -->
            <fieldset class="qlt-memory-mode">
              <legend class="qlt-memory-mode-legend">Memory mode</legend>
              <p class="qlt-memory-mode-scope">
                This setting applies to all conversations. It takes effect on your next message;
                replies already started keep the memory they had.
              </p>
              <div class="qlt-memory-mode-options">
                {#each MEMORY_MODE_CHOICES as choice (choice.value)}
                  <label class="qlt-memory-mode-option">
                    <input
                      type="radio"
                      name="qlt-memory-mode"
                      value={choice.value}
                      bind:group={memoryModeChoice}
                    />
                    <span>
                      <span class="qlt-memory-mode-label">{choice.label}</span>
                      <span class="qlt-memory-mode-hint">{choice.hint}</span>
                    </span>
                  </label>
                {/each}
              </div>
              <button
                type="button"
                class="qlt-btn qlt-memory-mode-save"
                disabled={memoryBusy || memoryModeChoice === memoryModeCurrent}
                onclick={() => void saveMemoryMode()}
              >
                Save memory mode
              </button>
              {#if memoryModeCurrent !== undefined}
                <span class="qlt-memory-mode-current" data-memory-mode={memoryModeCurrent}>
                  Current: {memoryModeChoiceLabel(memoryModeCurrent)}
                </span>
              {/if}
            </fieldset>

            <!-- Stage 07D D1/D3/D2: the quiet data-safety area (USER
                 authority only). Conflict challenges surface here as plain
                 list rows with quiet dismiss/resolve paths; the retention
                 pass is a visible user action; the export is one explicit
                 button. Nothing interrupts: no modal, tray, or focus
                 change exists behind this section. -->
            <section class="qlt-memory-mode" aria-label="Data safety" data-testid="data-safety">
              <legend class="qlt-memory-mode-legend">Data safety</legend>
              {#if openChallenges().length > 0}
                <p class="qlt-memory-area-hint">
                  {openChallenges().length} saved-item conflict{openChallenges().length === 1 ? '' : 's'} need{openChallenges().length === 1 ? 's' : ''} your
                  decision (nothing is decided for you).
                </p>
                <ul class="qlt-memory-list">
                  {#each openChallenges() as row (row.challengeId)}
                    <li class="qlt-memory-item" data-testid="challenge-row">
                      <div class="qlt-memory-item-head">
                        <span class="qlt-memory-kind">Saved-item conflict</span>
                        <span class="qlt-memory-status">open</span>
                      </div>
                      <p class="qlt-memory-text">
                        A confirmation would clash with an existing commitment. Your existing
                        commitment stays in force until you decide.
                      </p>
                      {#if resolvingChallengeId === row.challengeId}
                        <label class="qlt-visually-hidden" for="qlt-resolve-{row.challengeId}">Amended commitment text</label>
                        <textarea
                          id="qlt-resolve-{row.challengeId}"
                          class="qlt-input qlt-memory-input"
                          rows="2"
                          placeholder="The amended commitment text"
                          bind:value={resolveStatement}
                        ></textarea>
                        <div class="qlt-memory-actions">
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void commitResolveChallenge()}>
                            Amend and resolve
                          </button>
                          <button type="button" class="qlt-btn" onclick={() => (resolvingChallengeId = undefined)}>
                            Cancel
                          </button>
                        </div>
                      {:else}
                        <div class="qlt-memory-actions">
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void dismissChallenge(row)} data-testid="dismiss-challenge">
                            Keep existing, dismiss
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startResolveChallenge(row)}>
                            Amend existing…
                          </button>
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="qlt-memory-area-hint">No saved-item conflicts are waiting for you.</p>
              {/if}
              <div class="qlt-memory-actions">
                <button
                  type="button"
                  class="qlt-btn"
                  disabled={memoryBusy}
                  onclick={() => void runRetentionPass()}
                  data-testid="run-retention-pass"
                >
                  Run retention pass
                </button>
                <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void exportUserData()} data-testid="export-data">
                  Export my data
                </button>
              </div>
              <p class="qlt-memory-mode-scope">
                The retention pass expires due claims only after you run it. The export is generated
                fresh, handed to you, and not stored.
              </p>
            </section>

            <!-- Q5 four areas -->
            <div class="qlt-memory-tabs" role="group" aria-label="Memory areas">
              <button
                type="button"
                class="qlt-memory-tab"
                aria-pressed={memoryTab === 'pending'}
                data-memory-tab="pending"
                onclick={() => (memoryTab = 'pending')}
              >
                Pending{pendingProposals().length > 0 ? ` (${pendingProposals().length})` : ''}
              </button>
              <button
                type="button"
                class="qlt-memory-tab"
                aria-pressed={memoryTab === 'current'}
                data-memory-tab="current"
                onclick={() => (memoryTab = 'current')}
              >
                Current
              </button>
              <button
                type="button"
                class="qlt-memory-tab"
                aria-pressed={memoryTab === 'history'}
                data-memory-tab="history"
                onclick={() => (memoryTab = 'history')}
              >
                History
              </button>
              <button
                type="button"
                class="qlt-memory-tab"
                aria-pressed={memoryTab === 'used'}
                data-memory-tab="used"
                onclick={() => (memoryTab = 'used')}
              >
                Used for reply
              </button>
            </div>

            {#if memoryTab === 'pending'}
              <div>
              {#if pendingProposals().length === 0}
                <p class="qlt-memory-empty">No pending proposals for this thread.</p>
              {/if}
              <ul class="qlt-memory-list">
                {#each pendingProposals() as row (row.id)}
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
              </ul>
              </div>
            {:else if memoryTab === 'current'}
              <div>
              <p class="qlt-memory-area-hint">
                Current memory in force across your conversations. Lifecycle changes are attributed
                to you and keep full lineage.
              </p>
              {#if currentRows.length === 0}
                <p class="qlt-memory-empty">No current memory yet.</p>
              {/if}
              <ul class="qlt-memory-list">
                {#each currentRows as row (row.id)}
                  <li class="qlt-memory-item" data-kind={row.kind} data-origin={row.origin}>
                    <div class="qlt-memory-item-head">
                      <span class="qlt-memory-kind">{recordKindLabel(row.kind)}</span>
                      <span class="qlt-memory-status" data-status={row.status}>{row.statusLabel}</span>
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
                    {:else if exitingId === row.id && exitingVerb !== undefined}
                      <label class="qlt-visually-hidden" for="qlt-exit-reason-{row.id}">
                        Reason for this change
                      </label>
                      <input
                        id="qlt-exit-reason-{row.id}"
                        class="qlt-input qlt-memory-input"
                        placeholder="Why is this being {exitingVerb === 'abandon' ? 'abandoned' : 'transformed'}? (required)"
                        bind:value={exitReason}
                      />
                      <div class="qlt-memory-actions">
                        <button
                          type="button"
                          class="qlt-btn"
                          disabled={memoryBusy}
                          onclick={() => void commitReasonedExit()}
                        >
                          Confirm {exitingVerb}
                        </button>
                        <button type="button" class="qlt-btn" onclick={cancelExit}>Cancel</button>
                      </div>
                    {:else}
                      <p class="qlt-memory-text">{row.text}</p>
                      {#if expiringId === row.id}
                        <div class="qlt-memory-actions">
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void setExpiry(row, 1)}>
                            Expire in 1 day
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void setExpiry(row, 7)}>
                            In 7 days
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void setExpiry(row, 30)}>
                            In 30 days
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => void setExpiry(row, null)}>
                            Clear expiry
                          </button>
                          <button type="button" class="qlt-btn" onclick={() => (expiringId = undefined)}>
                            Cancel
                          </button>
                        </div>
                      {/if}
                      <div class="qlt-memory-actions">
                        <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startCorrect(row)}>
                          Correct
                        </button>
                        <button
                          type="button"
                          class="qlt-btn"
                          disabled={memoryBusy}
                          onclick={() => void removeRecord(row)}
                          data-testid="remove-record"
                        >
                          Remove
                        </button>
                        {#if row.kind === 'claim'}
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startExpiry(row)}>
                            Expire…
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startExit(row, 'retire')}>
                            Retire claim
                          </button>
                        {:else if row.kind === 'commitment'}
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startExit(row, 'release')}>
                            Release commitment
                          </button>
                        {:else}
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startExit(row, 'resolve')}>
                            Resolve
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startReasonedExit(row, 'abandon')}>
                            Abandon
                          </button>
                          <button type="button" class="qlt-btn" disabled={memoryBusy} onclick={() => startReasonedExit(row, 'transform')}>
                            Transform
                          </button>
                        {/if}
                      </div>
                    {/if}
                    <p class="qlt-memory-provenance">
                      Origin: {row.origin} · saved {timeLabel(row.createdAtMs)} · updated {timeLabel(row.updatedAtMs)}
                    </p>
                    <button
                      type="button"
                      class="qlt-btn qlt-memory-details-toggle"
                      aria-expanded={detailsOpenId === row.id}
                      onclick={() => toggleDetails(row.id)}
                    >
                      {detailsOpenId === row.id ? 'Hide details' : 'Details'}
                    </button>
                    {#if detailsOpenId === row.id}
                      <p class="qlt-memory-details">
                        record id: {row.id} · version {row.version} · fingerprint {row.contentFingerprint}
                      </p>
                    {/if}
                  </li>
                {/each}
              </ul>
              </div>
            {:else if memoryTab === 'history'}
              <div>
              <p class="qlt-memory-area-hint">
                History is inspect-only: ended proposals and closed or replaced records, with what
                ended them. Nothing here can be restored or reactivated.
              </p>
              {#if historyRows.length === 0}
                <p class="qlt-memory-empty">No history yet.</p>
              {/if}
              <ul class="qlt-memory-list">
                {#each historyRows as row (row.id)}
                  <li class="qlt-memory-item qlt-memory-item--decided" data-kind={row.kind} data-status={row.status}>
                    <div class="qlt-memory-item-head">
                      <span class="qlt-memory-kind">
                        {row.kind === 'proposal' ? proposalHistoryLabel(row) : recordKindLabel(row.kind)}
                      </span>
                      <span class="qlt-memory-status" data-status={row.status}>{row.statusLabel}</span>
                    </div>
                    <p class="qlt-memory-title-text">{row.title}</p>
                    <p class="qlt-memory-text">{row.text}</p>
                    <p class="qlt-memory-provenance">
                      Origin: {row.origin}
                      {#if row.exitReason !== null && row.exitReason !== ''}
                        · reason: {row.exitReason}
                      {/if}
                      {#if row.decisionBy !== ''}
                        · by {row.decisionBy === 'actor-quellight-local' ? 'you' : row.decisionBy}
                      {/if}
                      · ended {timeLabel(row.updatedAtMs)}
                      {#if row.kind === 'proposal' && row.status === 'confirmed'}
                        · became a saved record
                      {/if}
                    </p>
                    <button
                      type="button"
                      class="qlt-btn qlt-memory-details-toggle"
                      aria-expanded={detailsOpenId === row.id}
                      onclick={() => toggleDetails(row.id)}
                    >
                      {detailsOpenId === row.id ? 'Hide details' : 'Details'}
                    </button>
                    {#if detailsOpenId === row.id}
                      <p class="qlt-memory-details">
                        record id: {row.id} · version {row.version} · fingerprint {row.contentFingerprint}
                      </p>
                    {/if}
                  </li>
                {/each}
              </ul>
              </div>
            {:else}
              <div>
              <p class="qlt-memory-area-hint">
                What your replies here actually used — recorded evidence for each completed turn,
                never recomputed.
              </p>
              {#if turnRows.length === 0}
                <p class="qlt-memory-empty">No completed replies in this conversation yet.</p>
              {/if}
              {#if turnRows.length > 0}
                <label class="qlt-visually-hidden" for="qlt-turn-chooser">Choose a completed reply</label>
                <select
                  id="qlt-turn-chooser"
                  class="qlt-input qlt-memory-turn-chooser"
                  onchange={(event) => {
                    const value = (event.currentTarget as HTMLSelectElement).value;
                    if (value !== '') {
                      void openTurn(value);
                    }
                  }}
                >
                  <option value="">Choose a reply…</option>
                  {#each turnRows as turn (turn.turnId)}
                    <option value={turn.turnId} selected={turn.turnId === selectedTurnId}>
                      {turnLabel(turn)}
                    </option>
                  {/each}
                </select>
              {/if}
              {#if turnDetailError !== ''}
                <p class="qlt-memory-error" role="status">
                  No recorded memory evidence for this reply ({turnDetailError}).
                </p>
              {/if}
              {#if turnDetail !== undefined}
                <div class="qlt-memory-item" data-usage={turnDetail.usage}>
                  <div class="qlt-memory-item-head">
                    <span class="qlt-memory-kind">{turnDetail.usageLabel}</span>
                    {#if turnDetail.appliedPolicy !== null}
                      <span class="qlt-memory-status" data-memory-mode={turnDetail.appliedPolicy.mode}>
                        Memory mode: {memoryModeChoiceLabel(turnDetail.appliedPolicy.mode)}
                      </span>
                    {:else}
                      <span class="qlt-memory-status">Memory mode: not recorded</span>
                    {/if}
                  </div>
                  {#if turnDetail.selected.length > 0}
                    <ol class="qlt-memory-used-list">
                      {#each turnDetail.selected as entry, index (index)}
                        <li class="qlt-memory-used-item">
                          <span class="qlt-memory-used-order">{index + 1}.</span>
                          <span>
                            <strong>{entry.kindLabel}</strong>
                            {#if entry.title !== ''}· {entry.title}{/if}
                            · origin: {entry.origin}
                            · version {entry.selectedVersion}
                            {#if entry.supersededSince === true}
                              (superseded since this reply; the version used is shown)
                            {/if}
                            {#if entry.tombstone === 'removed'}
                              · <em>removed from current relevance: content withheld</em>
                            {:else if entry.tombstone === 'unavailable'}
                              · <em>content unavailable</em>
                            {:else if entry.content !== null}
                              <span class="qlt-memory-text"> — {entry.content}</span>
                            {/if}
                          </span>
                        </li>
                      {/each}
                    </ol>
                  {/if}
                  {#if turnDetail.exclusions.length > 0}
                    <p class="qlt-memory-provenance">Excluded from this reply:</p>
                    <ul class="qlt-memory-excluded-list">
                      {#each turnDetail.exclusions as entry, index (index)}
                        <li>
                          {entry.kindLabel}: {entry.reasonLabel}
                        </li>
                      {/each}
                    </ul>
                    {#if turnDetail.exclusionsAreBoundedSubset}
                      <p class="qlt-memory-provenance">
                        Recorded exclusions are a bounded subset; further records beyond the
                        evidence bound are not individually listed.
                      </p>
                    {/if}
                  {/if}
                  <button
                    type="button"
                    class="qlt-btn qlt-memory-details-toggle"
                    aria-expanded={detailsOpenId === 'turn-detail'}
                    onclick={() => toggleDetails('turn-detail')}
                  >
                    {detailsOpenId === 'turn-detail' ? 'Hide details' : 'Details'}
                  </button>
                  {#if detailsOpenId === 'turn-detail'}
                    <pre class="qlt-memory-details">{JSON.stringify(turnDetail.details, null, 2)}</pre>
                  {/if}
                </div>
              {/if}
              </div>
            {/if}

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
  /* Q5 (freeze §4): desktop SIDE TRAY — when the Memory surface is open
     the conversation column becomes a two-column grid and the surface
     occupies the right column (non-modal; the conversation stays fully
     usable). Narrow screens keep the in-flow non-modal sheet. */
  @media (min-width: 961px) {
    .qlt-conversation--with-memory {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      align-items: start;
    }
    .qlt-conversation--with-memory > .qlt-memory {
      grid-column: 2;
      grid-row: 1 / span 8;
      position: sticky;
      top: 0.75rem;
      max-height: calc(100vh - 6rem);
    }
  }
  @media (max-width: 960px) {
    .qlt-conversation--with-memory > .qlt-memory {
      /* responsive narrow-screen non-modal sheet: the tray flows in the
         page between the transcript and the composer; nothing overlays */
      max-height: 26rem;
    }
  }
  .qlt-memory-mode {
    border: 1px solid var(--vict-color-border, #ddd);
    border-radius: 8px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0;
  }
  .qlt-memory-mode-legend {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0 0.25rem;
  }
  .qlt-memory-mode-scope {
    margin: 0;
    font-size: 0.72rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-mode-options {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .qlt-memory-mode-option {
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
    font-size: 0.8rem;
  }
  .qlt-memory-mode-option input {
    margin-top: 0.2rem;
  }
  .qlt-memory-mode-option > span {
    display: flex;
    flex-direction: column;
  }
  .qlt-memory-mode-label {
    font-weight: 600;
  }
  .qlt-memory-mode-hint {
    font-size: 0.72rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-mode-save {
    align-self: flex-start;
  }
  .qlt-memory-mode-current {
    font-size: 0.72rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-deletion-option {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin: 0.5rem 0;
  }
  .qlt-deletion-option input {
    margin-top: 0.3rem;
  }

  .qlt-memory-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .qlt-memory-tab {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--vict-color-border, #ccc);
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
  }
  .qlt-memory-tab[aria-pressed='true'] {
    background: var(--vict-color-accent-surface, #e8f0fe);
    border-color: var(--vict-color-focus-ring, #1a73e8);
  }
  .qlt-memory-area-hint {
    margin: 0;
    font-size: 0.72rem;
    color: var(--vict-color-muted, #575757);
  }
  .qlt-memory-used-list,
  .qlt-memory-excluded-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.8rem;
  }
  .qlt-memory-used-item {
    display: flex;
    gap: 0.3rem;
  }
  .qlt-memory-turn-chooser {
    width: 100%;
  }
  .qlt-memory-details-toggle {
    align-self: flex-start;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
  }
  .qlt-memory-details {
    margin: 0;
    font-size: 0.7rem;
    color: var(--vict-color-muted, #575757);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
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
  /* Q4 quiet context-usage line: subdued, never interruptive. */
  .qlt-memory-assembly {
    margin: 0;
    font-size: 0.8rem;
    color: var(--vict-color-muted, #575757);
    font-style: italic;
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
