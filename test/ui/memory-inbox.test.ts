import { describe, expect, it, vi, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import ConversationWorkspace from '$lib/islands/ConversationWorkspace.svelte';

/**
 * Browser-side memory-inbox checks (happy-dom; freeze §11 interaction law
 * and §15 accessibility): the quiet pending indicator, the user-opened
 * review tray, the decision controls, the direct Save, and the
 * never-blocks / never-auto-opens invariants.
 */

const PROPOSAL_ROW = {
  id: 'qlt-prop-1',
  kind: 'proposal',
  status: 'proposed',
  title: 'Deep work preferences',
  text: 'The user does their most important work in focused morning sessions.',
  threadId: 'qlt-thread-1',
  turnRef: 'turn-1',
  actor: 'agent-quellight',
  decisionBy: '',
  stale: 'false',
  version: 1,
  createdAt: 1,
  updatedAt: 2,
};

const THREAD_ROW = {
  id: 'qlt-thread-1',
  title: 'Career direction',
  state: 'active',
  retentionState: 'currently-relevant',
  createdAt: 1,
  updatedAt: 2,
};

type MemoryRowInput = Record<string, unknown>;

function makeFetch(
  memoryRows: MemoryRowInput[],
  options: { memoryFails?: boolean } = {},
): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlText = typeof url === 'string' ? url : url instanceof Request ? url.url : url.href;
    const bodyText = String(init?.body ?? '');
    let payload: unknown = { ok: false, code: 'NO_MOCK' };
    if (urlText.includes('/api/health')) {
      payload = { ok: true, modelMode: 'offline-fixture' };
    } else if (urlText.includes('/api/act')) {
      if (bodyText.includes('act.queryThreads')) {
        payload = { ok: true, value: { rows: [THREAD_ROW], total: 1 } };
      } else if (bodyText.includes('act.queryMemory')) {
        payload = options.memoryFails
          ? { ok: false, code: 'ACTION_FAILED' }
          : { ok: true, value: { rows: memoryRows, total: memoryRows.length } };
      } else {
        payload = { ok: true, value: {} };
      }
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

let instance: Record<string, unknown> | undefined;
afterEach(() => {
  if (instance !== undefined) {
    unmount(instance as never);
    instance = undefined;
  }
  vi.unstubAllGlobals();
});

async function mountWith(
  memoryRows: MemoryRowInput[],
  options: { memoryFails?: boolean } = {},
): Promise<HTMLElement> {
  vi.stubGlobal('fetch', makeFetch(memoryRows, options));
  const host = document.createElement('div');
  document.body.appendChild(host);
  instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
  return host;
}

async function openThreadAndTray(host: HTMLElement): Promise<void> {
  const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
    | HTMLButtonElement
    | undefined;
  expect(threadButton).not.toBeUndefined();
  threadButton!.click();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
  const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement | null;
  expect(chip).not.toBeNull();
  chip!.click();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
}

describe('quiet memory inbox (Q3)', () => {
  it('the tray is NEVER auto-opened and no chip exists without a truthful count', async () => {
    const host = await mountWith([]);
    expect(host.querySelector('[aria-label="Memory review"]')).toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('button.qlt-memory-chip')).toBeNull();
  });

  it('the chip shows the pending count, opening is user-only, and the composer stays enabled', async () => {
    const host = await mountWith([PROPOSAL_ROW]);
    const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
      | HTMLButtonElement
      | undefined;
    threadButton!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));

    const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    expect(chip.getAttribute('aria-label')).toContain('1 pending');
    expect(chip.getAttribute('aria-label')).toContain('proposal');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    // The chip never opens the review by itself.
    expect(host.querySelector('[aria-label="Memory review"]')).toBeNull();
    // The conversation remains fully usable (never blocked).
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();

    // The USER opens the tray (click).
    chip.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    const tray = host.querySelector('[aria-label="Memory review"]');
    expect(tray).not.toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Possible claim');
    expect(text).toContain('Deep work preferences');
    expect(text).toContain('Drafted by the assistant');
    expect(text).toContain('Confirm');
    expect(text).toContain('Edit');
    expect(text).toContain('Reject');
    expect(text).toContain('Withdraw');
    expect(text).toContain('Remember this');
    expect(text).toContain('Deciding is optional');
    // The chip is a real keyboard-operable button.
    expect(chip.tagName).toBe('BUTTON');

    // Escape closes via the Close control being a real button as well.
    const close = host.querySelector('button.qlt-memory-close') as HTMLButtonElement;
    expect(close).not.toBeNull();
  });

  it('pending, stale, and decided states render distinctly', async () => {
    const decided = {
      ...PROPOSAL_ROW,
      id: 'qlt-prop-2',
      status: 'confirmed',
      decisionBy: 'actor-quellight-local',
    };
    const stale = {
      ...PROPOSAL_ROW,
      id: 'qlt-prop-3',
      status: 'awaiting_decision',
      stale: 'true',
    };
    const host = await mountWith([decided, stale, PROPOSAL_ROW]);
    await openThreadAndTray(host);
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('out of date');
    expect(text).toContain('confirmed');
    expect(text).toContain('2 pending');
    // The stale badge is marked with the dedicated status data attribute.
    expect(host.querySelector('.qlt-memory-status[data-status="stale"]')).not.toBeNull();
    expect(host.querySelector('.qlt-memory-status[data-status="confirmed"]')).not.toBeNull();
  });

  it('records render with a Correct control and the direct Save form exposes the durable-write disclosure', async () => {
    const record = {
      id: 'qlt-claim-1',
      kind: 'claim',
      status: 'active',
      title: 'Focus',
      text: 'The user prefers focused work.',
      threadId: 'qlt-thread-1',
      turnRef: '',
      actor: 'actor-quellight-local',
      decisionBy: '',
      stale: 'false',
      version: 1,
      createdAt: 1,
      updatedAt: 3,
    };
    const host = await mountWith([PROPOSAL_ROW, record]);
    await openThreadAndTray(host);
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Claim');
    expect(text).toContain('Correct');
    expect(text).toContain('Remember this');
    expect(text).toContain('Save immediately writes confirmed memory, attributed to you.');
    // The Save control is a real submit button labelled Save.
    const saveButton = Array.from(host.querySelectorAll('button[type="submit"]')).find(
      (button) => button.textContent?.trim() === 'Save',
    );
    expect(saveButton).not.toBeUndefined();
  });

  it('memory query failures stay quiet and truthful (no fabricated count, no blocked conversation)', async () => {
    const host = await mountWith([], { memoryFails: true });
    const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
      | HTMLButtonElement
      | undefined;
    threadButton!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    // No chip without a truthful count; no tray auto-opened.
    expect(host.querySelector('button.qlt-memory-chip')).toBeNull();
    expect(host.querySelector('[aria-label="Memory review"]')).toBeNull();
    // The conversation remains fully usable.
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(false);
  });
});
