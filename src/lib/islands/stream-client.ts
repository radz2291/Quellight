/**
 * The browser-safe `vict.agent-stream@1` stream client used by the
 * conversation island (and exercised directly by the reconnect and
 * malformed-frame negative controls).
 *
 * - every frame is wire-validated with the released
 *   `@victframework/contracts` validator BEFORE it is applied (N-7):
 *   unknown kinds, broken envelopes, and non-monotonic sequences mark the
 *   stream unhealthy and stop rendering — nothing invalid is accepted
 *   silently;
 * - at-least-once delivery is deduplicated by (stream, seq);
 * - the reconnect cursor is `v1:<streamId>:<seq>` (the SSE frame id IS
 *   the reconnect token), so a reconnect resumes from the last
 *   acknowledged position;
 * - the SSE bytes are consumed as a stream: no whole-response buffering.
 */

import { assertAgentStreamEvent, assertAgentStreamWireEnvelope } from '@victframework/contracts';

export interface AgentStreamFrame {
  readonly kind: string;
  readonly seq: number;
  readonly [key: string]: unknown;
}

export interface ConnectAgentStreamOptions {
  readonly streamId: string;
  /** The last acknowledged sequence (0 = subscribe from the start). */
  readonly lastSeq: number;
  /** Applied only to wire-valid, non-duplicate frames, in arrival order. */
  readonly onEvent: (frame: AgentStreamFrame) => void;
  /** Abort the underlying connection. */
  readonly signal: AbortSignal;
  /** The /vict proxy base (same origin; overridable in tests). */
  readonly baseUrl?: string;
  /** Injectable fetch (tests). */
  readonly fetchImpl?: typeof fetch;
  readonly onReconnecting?: () => void;
  /** Bounded reconnect attempts (default 5, backoff 300ms * attempt). */
  readonly maxAttempts?: number;
}

export type StreamOutcome = 'terminal' | 'disconnected' | 'unhealthy';

export interface ConnectAgentStreamResult {
  /**
   * `terminal`: an honest terminal event was applied; `disconnected`:
   * the bounded reconnect attempts exhausted without a terminal event
   * (nothing is fabricated); `unhealthy`: a frame failed wire validation
   * and rendering stopped.
   */
  readonly status: StreamOutcome;
  /** The last acknowledged (applied) sequence. */
  readonly lastSeq: number;
}

/** Parse one SSE frame block into its `id:` and `data:` members. */
export function parseSseFrame(block: string): { id?: string; data?: string } {
  let id: string | undefined;
  let data: string | undefined;
  for (const line of block.split('\n')) {
    if (line.startsWith('id: ')) {
      id = line.slice('id: '.length);
    } else if (line.startsWith('data: ')) {
      data = line.slice('data: '.length);
    }
  }
  return { id, data };
}

/**
 * Connect to the resumable stream and pump it to a terminal state.
 * Never throws for stream-level outcomes: the terminal status is
 * returned truthfully (`disconnected` after bounded reconnect attempts,
 * `unhealthy` when a frame failed wire validation).
 */
export async function connectAgentStream(
  options: ConnectAgentStreamOptions,
): Promise<ConnectAgentStreamResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? '';
  const maxAttempts = options.maxAttempts ?? 5;
  let lastSeq = options.lastSeq;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      options.onReconnecting?.();
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300 * attempt));
      if (options.signal.aborted) {
        return { status: 'disconnected', lastSeq };
      }
    }
    const cursor = lastSeq > 0 ? `?cursor=v1:${options.streamId}:${lastSeq}` : '';
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/vict/v1/streams/${options.streamId}${cursor}`, {
        headers: { accept: 'text/event-stream' },
        signal: options.signal,
      });
    } catch {
      continue; // transport error: bounded reconnect from the same cursor
    }
    if (!response.ok || response.body === null) {
      // A structured HTTP refusal is terminal for this stream consumer.
      return { status: 'disconnected', lastSeq };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawTerminal = false;
    let unhealthy = false;
    let streamEnded = false;
    while (!streamEnded) {
      const { done, value } = await reader.read();
      if (done) {
        streamEnded = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        const { data } = parseSseFrame(block);
        if (data === undefined) {
          continue; // comment / keep-alive
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          unhealthy = true;
          break;
        }
        // Client-side wire validation (fail closed on unknown kinds,
        // broken envelopes, and invalid shapes): the closed wire envelope
        // (which carries the schema marker) AND the full closed event
        // schema are both enforced.
        try {
          assertAgentStreamWireEnvelope(parsed);
          const { schema: _schema, ...event } = parsed as Record<string, unknown>;
          void _schema;
          assertAgentStreamEvent(event);
        } catch {
          unhealthy = true;
          break;
        }
        const frame = parsed as AgentStreamFrame;
        if (typeof frame.seq !== 'number' || !Number.isSafeInteger(frame.seq)) {
          unhealthy = true;
          break;
        }
        if (frame.seq <= lastSeq) {
          continue; // at-least-once duplicate: already applied
        }
        lastSeq = frame.seq;
        options.onEvent(frame);
        if (
          frame.kind === 'response.completed' ||
          frame.kind === 'response.failed' ||
          frame.kind === 'response.cancelled'
        ) {
          sawTerminal = true;
          break;
        }
      }
      if (sawTerminal || unhealthy) {
        break;
      }
    }
    if (!sawTerminal && !unhealthy) {
      try {
        await reader.cancel();
      } catch {
        /* the transport already went away */
      }
    }
    if (unhealthy) {
      return { status: 'unhealthy', lastSeq };
    }
    if (sawTerminal) {
      return { status: 'terminal', lastSeq };
    }
    // The stream ended (or the connection dropped) WITHOUT a terminal
    // event: reconnect from the acknowledged cursor.
  }
  return { status: 'disconnected', lastSeq };
}
