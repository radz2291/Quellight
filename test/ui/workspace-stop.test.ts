import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import ConversationWorkspace from '$lib/islands/ConversationWorkspace.svelte';

/**
 * Browser-side (happy-dom) F-1 regression proofs for the conversation
 * workspace island's Stop control. The real-browser click evidence is
 * produced separately by scripts/browser-stop-check.mjs (verify:stop).
 *
 * Proven here at the island level, against the exact released
 * vict.command@1 contract:
 * - the visible Stop control sends the closed `{payload:{turnId,…}}`
 *   request envelope with a non-empty `idempotency-key` header;
 * - one cancellation intent keeps ONE key across repeated clicks;
 * - an accepted stop request shows only a truthful INTERMEDIATE state —
 *   the island never claims cancellation before the authoritative
 *   `response.cancelled` stream terminal;
 * - the terminal settles the accessible cancelled state;
 * - an HTTP rejection or network failure surfaces a stable, accessible
 *   failure state and never a false cancelled claim.
 */

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface Harness {
  host: HTMLElement;
  instance: Record<string, unknown>;
  requests: CapturedRequest[];
  sse: {
    send(frame: Record<string, unknown>): Promise<void>;
    close(): void;
  };
  respondNextCancel(response: { status: number; body: unknown } | 'network-failure'): void;
}

const baseFrame = {
  schema: 'vict.agent-stream@1',
  streamId: 'stream-test-1',
  turnId: 'turn-test-1',
  threadId: 'conv-test-1',
  actorId: 'actor-test-1',
  agentProfileVersion: 'v1_test',
};

function textOf(host: HTMLElement): string {
  return (host.textContent ?? '').replace(/\s+/g, ' ');
}

async function waitFor(expectation: () => void, timeoutMs = 2000, stepMs = 10): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      expectation();
      return;
    } catch {
      if (Date.now() - started > timeoutMs) {
        expectation();
        return;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, stepMs));
    }
  }
}

const stopButtonOf = (host: HTMLElement): HTMLButtonElement | undefined =>
  [...host.querySelectorAll('button')].find((button) => button.textContent === 'Stop');

async function mountWorkspace(): Promise<Harness> {
  const requests: CapturedRequest[] = [];
  const cancelQueue: Array<{ status: number; body: unknown } | 'network-failure'> = [];
  let sseController: ReadableStreamDefaultController<Uint8Array> | undefined;
  // Durable-truth stand-in: after an accepted cancellation the VICT-
  // authoritative transcript retains the partial content (exactly what
  // the island's terminal reconcile heals from).
  let durableMessages: Array<{ role: string; text: string }> = [];
  let openSse: (() => void) | undefined;
  const sseOpened = new Promise<void>((resolvePromise) => {
    openSse = resolvePromise;
  });
  void sseOpened;
  const encoder = new TextEncoder();

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlText = typeof url === 'string' ? url : url instanceof Request ? url.url : url.href;
    const headers: Record<string, string> = {};
    if (init?.headers !== undefined) {
      new Headers(init.headers as HeadersInit).forEach((value, key) => {
        headers[key] = value;
      });
    }
    requests.push({ url: urlText, headers, body: typeof init?.body === 'string' ? init.body : '' });

    if (urlText.includes('/api/health')) {
      return json({ ok: true, modelMode: 'offline-fixture' });
    }
    if (urlText.includes('/api/act')) {
      return json({
        ok: true,
        value: {
          rows: [
            {
              id: 'qlt-stop-1',
              title: 'Stop flow thread',
              state: 'active',
              retentionState: 'currently-relevant',
              createdAt: 1,
              updatedAt: 2,
            },
          ],
          total: 1,
        },
      });
    }
    if (urlText.includes('/api/threads/qlt-stop-1/messages')) {
      return json({ ok: true, messages: durableMessages, turns: [] });
    }
    if (urlText.includes('/api/threads/qlt-stop-1/turns')) {
      return json({ ok: true, data: { turnId: 'turn-test-1', streamId: 'stream-test-1' } });
    }
    if (urlText.includes('/vict/v1/turns/cancel')) {
      const next =
        cancelQueue.shift() ??
        ({
          status: 200,
          body: { ok: true, data: { result: { accepted: true, duplicate: false } } },
        } as const);
      if (next === 'network-failure') {
        throw new TypeError('network failure (simulated)');
      }
      if (next.status === 200) {
        durableMessages = [{ role: 'assistant', text: 'Partial answer so far. ' }];
      }
      return json(next.body, next.status);
    }
    if (urlText.includes('/vict/v1/streams/stream-test-1')) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          sseController = controller;
          openSse?.();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    return json({ ok: false, code: 'NO_MOCK' }, 404);
  });
  vi.stubGlobal('fetch', fetchImpl);

  const host = document.createElement('div');
  document.body.appendChild(host);
  const instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<
    string,
    unknown
  >;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));

  return {
    host,
    instance,
    requests,
    sse: {
      async send(frame: Record<string, unknown>): Promise<void> {
        // The SSE connection opens asynchronously once the turn starts;
        // wait for it before delivering a frame.
        const started = Date.now();
        while (sseController === undefined) {
          if (Date.now() - started > 2000) {
            throw new Error('the island never opened the agent stream');
          }
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
        }
        sseController.enqueue(
          encoder.encode(
            `id: v1:stream-test-1:${String(frame.seq)}\ndata: ${JSON.stringify(frame)}\n\n`,
          ),
        );
      },
      close(): void {
        try {
          sseController?.close();
        } catch {
          /* already closed */
        }
      },
    },
    respondNextCancel(response): void {
      cancelQueue.push(response);
    },
  };
}

async function startStreamingTurn(harness: Harness, text: string): Promise<void> {
  const { host, sse } = harness;
  (host.querySelector('.qlt-thread') as HTMLButtonElement).click();
  await waitFor(() => expect(host.querySelector('#qlt-composer')).not.toBeNull());
  const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
  composer.value = text;
  composer.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => {
    const send = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Send');
    expect(send?.disabled).toBe(false);
  });
  const form = host.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await sse.send({ ...baseFrame, kind: 'response.started', seq: 1 });
  await waitFor(() => expect(stopButtonOf(host)).toBeDefined());
  // Some live partial content has already been rendered.
  await sse.send({ ...baseFrame, kind: 'text.delta', delta: 'Partial answer so far. ', seq: 2 });
}

function teardown(harness: Harness): void {
  unmount(harness.instance as never);
  harness.host.remove();
  vi.unstubAllGlobals();
}

describe('conversation workspace island — Stop control (F-1 regression)', () => {
  it('the visible Stop control sends the released envelope with a non-empty idempotency key, keeps one key across repeated clicks, and never claims cancellation before the terminal', async () => {
    const harness = await mountWorkspace();
    const { host, requests, sse } = harness;
    try {
      await startStreamingTurn(harness, 'Hello stop flow');

      // Click the visible Stop control.
      stopButtonOf(host)!.click();
      await waitFor(() => {
        expect(requests.some((request) => request.url.includes('/vict/v1/turns/cancel'))).toBe(
          true,
        );
      });
      const cancelRequests = () =>
        requests.filter((request) => request.url.includes('/vict/v1/turns/cancel'));

      // The EXACT released envelope and a non-empty idempotency key.
      const first = cancelRequests()[0]!;
      expect(JSON.parse(first.body)).toEqual({
        payload: { turnId: 'turn-test-1', reasonCode: 'user' },
      });
      expect(first.headers['idempotency-key']).toBeTruthy();
      expect(first.headers['idempotency-key'].length).toBeGreaterThan(0);

      // Accepted: a truthful INTERMEDIATE state only — no cancelled claim.
      await waitFor(() => expect(textOf(host)).toContain('Stop request accepted'));
      expect(textOf(host)).toContain('Stopping');
      expect(textOf(host)).not.toContain('partial response, retained truthfully');
      expect(textOf(host)).not.toContain('Stopped before any response content');

      // A repeated click on the same intent reuses the SAME key and the
      // same envelope.
      stopButtonOf(host)!.click();
      await waitFor(() => expect(cancelRequests().length).toBe(2));
      const second = cancelRequests()[1]!;
      expect(second.headers['idempotency-key']).toBe(first.headers['idempotency-key']);
      expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
      // The partial content is on screen while stopping; still no
      // cancelled claim.
      expect(textOf(host)).toContain('Partial answer so far.');
      expect(textOf(host)).not.toContain('partial response, retained truthfully');

      // The authoritative stream terminal settles the cancelled state:
      // the partial content is retained (reconciled from the durable
      // transcript) and the accessible announcement states the truth.
      await sse.send({ ...baseFrame, kind: 'response.cancelled', seq: 3 });
      sse.close();
      await waitFor(() =>
        expect(textOf(host)).toContain('Stopped. The partial response is retained and marked.'),
      );
      await waitFor(() => expect(textOf(host)).toContain('Partial answer so far.'));
      const liveRegion = host.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
    } finally {
      teardown(harness);
    }
  });

  it('an HTTP rejection of the stop request surfaces a stable accessible failure state and never a false cancelled claim', async () => {
    const harness = await mountWorkspace();
    const { host, requests } = harness;
    try {
      harness.respondNextCancel({
        status: 400,
        body: { ok: false, code: 'VICT_HTTP_BODY_MALFORMED' },
      });
      await startStreamingTurn(harness, 'Hello rejection flow');

      stopButtonOf(host)!.click();
      await waitFor(() => expect(textOf(host)).toContain('The stop request was not accepted'));
      expect(textOf(host)).toContain('VICT_HTTP_BODY_MALFORMED');
      // Never a cancelled claim: the response was not cancelled by the
      // rejected request, and Stop remains available for a retry.
      expect(textOf(host)).not.toContain('partial response, retained truthfully');
      expect(textOf(host)).not.toContain('Stopped before any response content');
      expect(textOf(host)).toContain('Stop can be retried');
      expect(stopButtonOf(host)).toBeDefined();
      expect(requests.filter((r) => r.url.includes('/vict/v1/turns/cancel'))).toHaveLength(1);
    } finally {
      teardown(harness);
    }
  });

  it('a network failure of the stop request surfaces a truthful failure state and never a false cancelled claim', async () => {
    const harness = await mountWorkspace();
    const { host } = harness;
    try {
      harness.respondNextCancel('network-failure');
      await startStreamingTurn(harness, 'Hello network failure');

      stopButtonOf(host)!.click();
      await waitFor(() => expect(textOf(host)).toContain('could not be delivered'));
      expect(textOf(host)).toContain('CANCEL_REQUEST_UNDELIVERED');
      expect(textOf(host)).not.toContain('partial response, retained truthfully');
      expect(textOf(host)).not.toContain('Stopped before any response content');
    } finally {
      teardown(harness);
    }
  });
});
