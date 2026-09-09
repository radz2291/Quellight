import { describe, expect, it, vi, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import ConversationWorkspace from '$lib/islands/ConversationWorkspace.svelte';

/**
 * Browser-side island checks (happy-dom): the conversation workspace
 * renders its truthful baseline states with accessible semantics. The
 * real-browser responsive/keyboard/axe evidence is produced separately by
 * scripts/browser-check.mjs (N-17/N-19).
 */

function mockFetchOnce(responses: Array<{ match: string; body: unknown; status?: number }>) {
  const impl = vi.fn(async (url: string | URL | Request) => {
    const urlText = typeof url === 'string' ? url : url instanceof Request ? url.url : url.href;
    const entry = responses.find((candidate) => urlText.includes(candidate.match));
    if (entry === undefined) {
      return new Response(JSON.stringify({ ok: false, code: 'NO_MOCK' }), { status: 404 });
    }
    return new Response(JSON.stringify(entry.body), {
      status: entry.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', impl);
  return impl;
}

function textOf(host: HTMLElement): string {
  return (host.textContent ?? '').replace(/\s+/g, ' ');
}

let instance: Record<string, unknown> | undefined;
afterEach(() => {
  if (instance !== undefined) {
    unmount(instance as never);
    instance = undefined;
  }
  vi.unstubAllGlobals();
});

describe('conversation workspace island', () => {
  it('renders the empty state, the offline-fixture disclosure, and a live region', async () => {
    mockFetchOnce([
      { match: '/api/health', body: { ok: true, modelMode: 'offline-fixture' } },
      {
        match: '/api/act',
        body: { ok: true, value: { rows: [], total: 0 } },
      },
    ]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    const text = textOf(host);
    // Truthful product language: no continuity or memory-of-meaning claims.
    expect(text).toContain('Quellight');
    expect(text).toContain('Offline deterministic fixture');
    expect(text).toContain('Durable partnership meaning is not implemented');
    // A live region announces streaming state to assistive technology.
    const liveRegion = host.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // The mode badge never claims a live provider in offline mode.
    expect(text).not.toContain('Live provider');
  });

  it('renders the configuration-unavailable state truthfully', async () => {
    mockFetchOnce([{ match: '/api/health', body: { ok: false }, status: 503 }]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    const text = textOf(host);
    expect(text).toContain('Configuration unavailable');
    // The composer is disabled while configuration is unavailable.
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement | null;
    expect(composer?.disabled ?? true).toBe(true);
  });

  it('renders a created thread from the Shared World thread list', async () => {
    mockFetchOnce([
      { match: '/api/health', body: { ok: true, modelMode: 'offline-fixture' } },
      {
        match: '/api/act',
        body: {
          ok: true,
          value: {
            rows: [
              {
                id: 'qlt-test-1',
                title: 'Career direction',
                state: 'active',
                retentionState: 'currently-relevant',
                createdAt: 1,
                updatedAt: 2,
              },
            ],
            total: 1,
          },
        },
      },
    ]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    const text = textOf(host);
    expect(text).toContain('Career direction');
    expect(text).toContain('active');
  });
});
