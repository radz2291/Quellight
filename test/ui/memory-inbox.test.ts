import { describe, expect, it, vi, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import ConversationWorkspace from '$lib/islands/ConversationWorkspace.svelte';

/**
 * Browser-side memory-surface checks (happy-dom; Q3/Q4 interaction law and
 * Q5 freeze §3/§4): the always-present chip, the user-opened four-area
 * surface (Pending / Current / History / Used for reply), the global
 * Memory Mode control, the lifecycle controls, and the never-blocks /
 * never-auto-opens invariants.
 */

const PROPOSAL_ROW = {
  id: 'qlt-prop-1',
  kind: 'proposal',
  proposalKind: 'claim',
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

const CURRENT_ROW = {
  id: 'qlt-claim-1',
  kind: 'claim',
  kindLabel: 'Claim',
  proposalKind: '',
  status: 'active',
  statusLabel: 'current',
  title: 'Focus',
  text: 'The user prefers focused work.',
  originThreadId: 'qlt-thread-1',
  turnRef: '',
  actor: 'actor-quellight-local',
  decisionBy: '',
  exitReason: null,
  exitedAtMs: null,
  version: 1,
  createdAtMs: 1,
  updatedAtMs: 3,
  createdRecordId: null,
  details: {
    recordId: 'qlt-claim-1',
    contentFingerprint: 'a'.repeat(64),
    retentionState: 'currently-relevant',
  },
};

const HISTORY_ROW = {
  ...CURRENT_ROW,
  id: 'qlt-claim-0',
  kindLabel: 'Claim',
  status: 'superseded',
  statusLabel: 'superseded (a newer version replaced it)',
  updatedAtMs: 2,
  details: {
    recordId: 'qlt-claim-0',
    contentFingerprint: 'b'.repeat(64),
    retentionState: 'currently-relevant',
  },
};

type MemoryRowInput = Record<string, unknown>;

interface FetchOptions {
  memoryRows?: MemoryRowInput[];
  memoryFails?: boolean;
  assembly?: Record<string, unknown>;
  currentRows?: MemoryRowInput[];
  historyRows?: MemoryRowInput[];
  turns?: MemoryRowInput[];
  turnDetail?: MemoryRowInput;
  policyMode?: string;
  inspectionFails?: boolean;
}

function makeFetch(options: FetchOptions): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlText = typeof url === 'string' ? url : url instanceof Request ? url.url : url.href;
    const bodyText = String(init?.body ?? '');
    let payload: unknown = { ok: false, code: 'NO_MOCK' };
    if (urlText.includes('/api/health')) {
      payload = { ok: true, modelMode: 'offline-fixture' };
    } else if (urlText.includes('/assembly')) {
      payload = options.assembly ?? { ok: true };
    } else if (urlText.includes('/api/act')) {
      if (bodyText.includes('act.queryThreads')) {
        payload = { ok: true, value: { rows: [THREAD_ROW], total: 1 } };
      } else if (bodyText.includes('act.queryMemory')) {
        payload =
          (options.memoryRows ?? []).length > 0 || options.memoryFails === true
            ? options.memoryFails === true
              ? { ok: false, code: 'ACTION_FAILED' }
              : {
                  ok: true,
                  value: {
                    rows: options.memoryRows ?? [],
                    total: (options.memoryRows ?? []).length,
                  },
                }
            : { ok: true, value: { rows: [], total: 0 } };
      } else if (bodyText.includes('act.queryInspection')) {
        if (options.inspectionFails === true) {
          payload = { ok: false, code: 'QLT_INSPECTION_UNSUPPORTED_QUERY' };
        } else if (bodyText.includes('"query":"listRecords"') && bodyText.includes('current')) {
          payload = {
            ok: true,
            value: { rows: options.currentRows ?? [], total: (options.currentRows ?? []).length },
          };
        } else if (bodyText.includes('"query":"listRecords"')) {
          payload = {
            ok: true,
            value: { rows: options.historyRows ?? [], total: (options.historyRows ?? []).length },
          };
        } else if (bodyText.includes('"query":"listTurns"')) {
          payload = {
            ok: true,
            value: { rows: options.turns ?? [], total: (options.turns ?? []).length },
          };
        } else if (bodyText.includes('"query":"getTurn"')) {
          payload =
            options.turnDetail === undefined
              ? { ok: false, code: 'QLT_INSPECTION_TURN_MISSING' }
              : { ok: true, value: { row: options.turnDetail } };
        } else if (bodyText.includes('"query":"getPolicy"')) {
          payload = {
            ok: true,
            value: {
              row: {
                policyId: 'qlt.memory-mode@1',
                mode: options.policyMode ?? 'across-conversations',
                modeLabel: 'Across conversations',
                revision: 1,
                updatedAtMs: 1,
                // Q5-B-1 truthfulness signal: the durable row exists in
                // this stub's scenario, so the default is persisted.
                persisted: true,
              },
            },
          };
        } else {
          payload = { ok: false, code: 'QLT_INSPECTION_UNSUPPORTED_QUERY' };
        }
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

async function mountWith(options: FetchOptions = {}): Promise<HTMLElement> {
  vi.stubGlobal('fetch', makeFetch(options));
  const host = document.createElement('div');
  document.body.appendChild(host);
  instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
  return host;
}

async function openThreadAndTray(host: HTMLElement): Promise<void> {
  const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
    HTMLButtonElement | undefined;
  expect(threadButton).not.toBeUndefined();
  threadButton!.click();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
  const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement | null;
  expect(chip).not.toBeNull();
  chip!.click();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
}

async function selectTab(host: HTMLElement, tab: string): Promise<void> {
  const tabButton = host.querySelector(
    `button[data-memory-tab="${tab}"]`,
  ) as HTMLButtonElement | null;
  expect(tabButton).not.toBeNull();
  tabButton!.click();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
}

describe('quiet memory surface (Q3/Q4 law preserved)', () => {
  it('the tray is NEVER auto-opened and no chip exists without an open thread', async () => {
    const host = await mountWith({});
    expect(host.querySelector('section[aria-label="Memory review"]')).toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('button.qlt-memory-chip')).toBeNull();
  });

  it('Q5: the chip is ALWAYS present for an open thread, with a pending count only when applicable', async () => {
    // No rows at all: the chip exists and shows NO pending count.
    const quiet = await mountWith({});
    const threadButton = Array.from(quiet.querySelectorAll('button.qlt-thread')).at(0) as
      HTMLButtonElement | undefined;
    threadButton!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    const chip = quiet.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent?.trim()).toBe('Memory');
    expect(chip.getAttribute('aria-label')).toBe('Memory review');
    unmount(quiet as never);

    // With a pending proposal the truthful count appears.
    const counted = await mountWith({ memoryRows: [PROPOSAL_ROW] });
    const button2 = Array.from(counted.querySelectorAll('button.qlt-thread')).at(0) as
      HTMLButtonElement | undefined;
    button2!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    const chip2 = counted.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    expect(chip2.getAttribute('aria-label')).toContain('1 pending');
    expect(chip2.textContent?.trim()).toBe('Memory · 1 pending');
  });

  it('opening is user-only, the composer stays enabled, and Pending renders with its controls', async () => {
    const host = await mountWith({ memoryRows: [PROPOSAL_ROW] });
    await openThreadAndTray(host);
    const tray = host.querySelector('section[aria-label="Memory review"]');
    expect(tray).not.toBeNull();
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
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    const close = host.querySelector('button.qlt-memory-close') as HTMLButtonElement;
    expect(close).not.toBeNull();
  });

  it('M-2 (Q4): a real Escape keydown closes the tray and focus returns to the chip', async () => {
    const host = await mountWith({ memoryRows: [PROPOSAL_ROW] });
    await openThreadAndTray(host);
    const tray = host.querySelector('section[aria-label="Memory review"]') as HTMLElement | null;
    expect(tray).not.toBeNull();
    const close = host.querySelector('button.qlt-memory-close') as HTMLButtonElement;
    close.focus();
    expect(document.activeElement).toBe(close);
    // A real bubbling keydown reaches the window-level handler (Q5 §13).
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    close.dispatchEvent(event);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    expect(host.querySelector('section[aria-label="Memory review"]')).toBeNull();
    const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    expect(document.activeElement).toBe(chip);
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(false);
  });

  it('Q4 (D-Q4-6): the quiet context-usage line renders its states truthfully', async () => {
    const used = await mountWith({
      assembly: { ok: true, assembly: { outcome: 'complete', usedCount: 3 } },
    });
    await openThreadAndTray(used);
    let line = used.querySelector('.qlt-memory-assembly') as HTMLElement | null;
    expect((line!.textContent ?? '').trim()).toBe('Your last reply here used 3 memories.');
    unmount(used as never);

    const none = await mountWith({
      assembly: { ok: true, assembly: { outcome: 'empty', usedCount: 0 } },
    });
    await openThreadAndTray(none);
    line = none.querySelector('.qlt-memory-assembly') as HTMLElement | null;
    expect((line!.textContent ?? '').trim()).toBe('No memories used');
    unmount(none as never);

    const failed = await mountWith({
      assembly: { ok: true, assembly: { outcome: 'failed', usedCount: 0 } },
    });
    await openThreadAndTray(failed);
    line = failed.querySelector('.qlt-memory-assembly') as HTMLElement | null;
    expect((line!.textContent ?? '').trim()).toBe('Memory unavailable for this turn');
  });

  it('Q5: an intentionally-off last reply is never misreported as "no memories used"', async () => {
    const host = await mountWith({
      assembly: {
        ok: true,
        assembly: { outcome: 'empty', usedCount: 0, memoryMode: 'off' },
      },
    });
    await openThreadAndTray(host);
    const line = host.querySelector('.qlt-memory-assembly') as HTMLElement | null;
    expect((line!.textContent ?? '').trim()).toBe('Memory was off for your last reply here.');
  });
});

describe('Q5 four-area Memory surface', () => {
  it('the Memory Mode control lives inside the surface, says it applies to all conversations, and offers exactly the three modes', async () => {
    const host = await mountWith({ policyMode: 'across-conversations' });
    await openThreadAndTray(host);
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Memory mode');
    expect(text).toContain('This setting applies to all conversations');
    expect(text).toContain('Across conversations (default)');
    expect(text).toContain('Within each conversation only');
    expect(text).toContain('Memory off');
    const radios = Array.from(
      host.querySelectorAll('input[type="radio"][name="qlt-memory-mode"]'),
    ) as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    const values = radios.map((radio) => radio.value).sort();
    expect(values).toEqual(['across-conversations', 'off', 'per-conversation']);
    expect(radios[0]!.checked).toBe(true);
    // The current durable mode is displayed.
    expect(host.querySelector('[data-memory-mode="across-conversations"]')).not.toBeNull();
    // The save button is disabled while the choice equals the current mode.
    const save = host.querySelector('button.qlt-memory-mode-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('saving a Memory Mode change posts the governed action with the chosen mode', async () => {
    const fetchMock = makeFetch({ policyMode: 'across-conversations' });
    vi.stubGlobal('fetch', fetchMock);
    const host = document.createElement('div');
    document.body.appendChild(host);
    instance = mount(ConversationWorkspace, { target: host }) as unknown as Record<string, unknown>;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
      HTMLButtonElement | undefined;
    threadButton!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    chip.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));

    const radio = host.querySelector(
      'input[type="radio"][name="qlt-memory-mode"][value="off"]',
    ) as HTMLInputElement;
    radio.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    const save = host.querySelector('button.qlt-memory-mode-save') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    save.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    const modeCalls = (fetchMock.mock.calls as [string | URL | Request, RequestInit?][]).filter(
      ([url, init]) =>
        String(typeof url === 'string' ? url : (url as URL).href).includes('/api/act') &&
        String(init?.body ?? '').includes('act.setMemoryMode'),
    );
    expect(modeCalls).toHaveLength(1);
    const sentBody = JSON.parse(String(modeCalls[0]![1]?.body ?? '{}')) as {
      input?: { mode?: string };
      idempotencyKey?: string;
    };
    expect(sentBody.input?.mode).toBe('off');
    expect(typeof sentBody.idempotencyKey).toBe('string');
  });

  it('Current lists current-effective memory with human kind, origin, and the full lifecycle controls', async () => {
    const host = await mountWith({ currentRows: [CURRENT_ROW] });
    await openThreadAndTray(host);
    await selectTab(host, 'current');
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Claim');
    expect(text).toContain('Focus');
    expect(text).toContain('this conversation');
    expect(text).toContain('Correct');
    expect(text).toContain('Retire claim');
    // A commitment exposes Release commitment; an open loop exposes
    // Resolve / Abandon / Transform.
    const item = host.querySelector('li[data-kind="claim"]');
    expect(item).not.toBeNull();
    unmount(host as never);

    const loopRow = {
      ...CURRENT_ROW,
      id: 'qlt-loop-1',
      kind: 'open_loop',
      kindLabel: 'Open question',
      status: 'open',
    };
    const loopHost = await mountWith({ currentRows: [loopRow] });
    await openThreadAndTray(loopHost);
    await selectTab(loopHost, 'current');
    const loopText = (loopHost.textContent ?? '').replace(/\s+/g, ' ');
    expect(loopText).toContain('Resolve');
    expect(loopText).toContain('Abandon');
    expect(loopText).toContain('Transform');
    unmount(loopHost as never);

    const commitmentRow = {
      ...CURRENT_ROW,
      id: 'qlt-commit-1',
      kind: 'commitment',
      kindLabel: 'Commitment',
    };
    const commitHost = await mountWith({ currentRows: [commitmentRow] });
    await openThreadAndTray(commitHost);
    await selectTab(commitHost, 'current');
    expect((commitHost.textContent ?? '').replace(/\s+/g, ' ')).toContain('Release commitment');
  });

  it('History is inspect-only: terminal rows render with their ending state and no decision controls', async () => {
    const host = await mountWith({ historyRows: [HISTORY_ROW] });
    await openThreadAndTray(host);
    await selectTab(host, 'history');
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('inspect-only');
    expect(text).toContain('superseded');
    // No lifecycle or decision controls in History.
    expect(text).not.toContain('Retire claim');
    expect(text).not.toContain('Confirm');
    // The Details disclosure hides technical identifiers until opened.
    expect(text).not.toContain('qlt-claim-0');
    const toggle = host.querySelector('button.qlt-memory-details-toggle') as HTMLButtonElement;
    toggle.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    expect((host.textContent ?? '').replace(/\s+/g, ' ')).toContain('qlt-claim-0');
  });

  it('Used for reply shows recorded evidence: usage state, applied mode, ordered selections, exclusions', async () => {
    const turnDetail = {
      usage: 'used',
      usageLabel: 'This reply used 2 memories.',
      appliedPolicy: { policyId: 'qlt.memory-mode@1', mode: 'across-conversations', revision: 1 },
      usedCount: 2,
      selected: [
        {
          kindLabel: 'Open question',
          origin: 'this conversation',
          selectedVersion: 1,
          currentVersion: 2,
          supersededSince: true,
          title: 'Travel',
          content: 'The travel plans are undecided.',
          tombstone: null,
          details: { recordId: 'qlt-loop-9' },
        },
        {
          kindLabel: 'Claim',
          origin: 'another conversation',
          selectedVersion: 3,
          content: null,
          tombstone: 'removed',
          title: 'Focus',
          details: { recordId: 'qlt-claim-9' },
        },
      ],
      exclusions: [
        {
          kindLabel: 'Claim',
          reason: 'scope-excluded',
          reasonLabel:
            'saved in another conversation or without a conversation, and this reply used only this conversation’s memory',
          details: { recordId: 'qlt-claim-8' },
        },
      ],
      exclusionsAreBoundedSubset: true,
      excludedBeyondCount: null,
      details: { turnId: 'turn-1', threadId: 'qlt-thread-1', fingerprint: 'c'.repeat(64) },
    };
    const host = await mountWith({
      turns: [
        {
          turnId: 'turn-1',
          outcome: 'complete',
          usedCount: 2,
          memoryMode: 'across-conversations',
          memoryModeLabel: 'Across conversations',
          createdAtMs: 1,
        },
      ],
      turnDetail: turnDetail as unknown as MemoryRowInput,
    });
    await openThreadAndTray(host);
    await selectTab(host, 'used');
    const chooser = host.querySelector('#qlt-turn-chooser') as HTMLSelectElement | null;
    expect(chooser).not.toBeNull();
    chooser!.value = 'turn-1';
    chooser!.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('This reply used 2 memories.');
    expect(text).toContain('Memory mode: Across conversations');
    // The historical version actually selected (v1) is shown even though
    // the record was superseded since.
    expect(text).toContain('version 1');
    expect(text).toContain('superseded since this reply; the version used is shown');
    // The retention-removed record renders a truthful tombstone.
    expect(text).toContain('removed from current relevance: content withheld');
    // The scope exclusion is humanized and disclosed as a bounded subset.
    expect(text).toContain('used only this conversation’s memory');
    expect(text).toContain('bounded subset');
    // Technical identifiers stay hidden until Details is opened.
    expect(text).not.toContain('turn-1');
    expect(text).not.toContain('c'.repeat(64));
  });

  it('an off reply in Used for reply reports "memory was intentionally off", never "no memory existed"', async () => {
    const host = await mountWith({
      turns: [
        {
          turnId: 'turn-2',
          outcome: 'empty',
          usedCount: 0,
          memoryMode: 'off',
          memoryModeLabel: 'Memory off',
          createdAtMs: 2,
        },
      ],
      turnDetail: {
        usage: 'off',
        usageLabel: 'Memory was off for this reply.',
        appliedPolicy: { policyId: 'qlt.memory-mode@1', mode: 'off', revision: 2 },
        usedCount: 0,
        selected: [],
        exclusions: [],
        exclusionsAreBoundedSubset: false,
        excludedBeyondCount: null,
        details: { turnId: 'turn-2' },
      } as unknown as MemoryRowInput,
    });
    await openThreadAndTray(host);
    await selectTab(host, 'used');
    const chooser = host.querySelector('#qlt-turn-chooser') as HTMLSelectElement;
    chooser.value = 'turn-2';
    chooser.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Memory was off for this reply.');
    expect(text).toContain('Memory mode: Memory off');
    expect(text).not.toContain('No eligible memory existed');
  });

  it('pending, stale, and decided states render distinctly in their areas', async () => {
    const stale = {
      ...PROPOSAL_ROW,
      id: 'qlt-prop-3',
      status: 'awaiting_decision',
      stale: 'true',
    };
    const host = await mountWith({ memoryRows: [stale, PROPOSAL_ROW] });
    await openThreadAndTray(host);
    const text = (host.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('out of date');
    expect(text).toContain('2 pending');
    expect(host.querySelector('.qlt-memory-status[data-status="stale"]')).not.toBeNull();
  });

  it('inspection failures stay quiet and truthful (no fabricated content, no blocked conversation)', async () => {
    const host = await mountWith({ inspectionFails: true });
    const threadButton = Array.from(host.querySelectorAll('button.qlt-thread')).at(0) as
      HTMLButtonElement | undefined;
    threadButton!.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    // The chip still exists (always-present law) but shows no pending count.
    const chip = host.querySelector('button.qlt-memory-chip') as HTMLButtonElement;
    expect(chip.textContent?.trim()).toBe('Memory');
    expect(host.querySelector('section[aria-label="Memory review"]')).toBeNull();
    const composer = host.querySelector('#qlt-composer') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(false);
  });
});
