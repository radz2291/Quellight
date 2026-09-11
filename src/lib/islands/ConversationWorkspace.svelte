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
      Conversation transcripts are retained locally under bounded retention. Durable partnership
      meaning is not implemented in this stage: transcript persistence is not Shared World
      continuity. Conversation content is sent to the configured provider when the live profile is
      active. Credentials are never stored in the product's data.
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
  }
</style>
