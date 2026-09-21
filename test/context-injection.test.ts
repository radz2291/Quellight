import { describe, expect, it, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDeterministicOfflineModel } from '@victframework/mastra';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
  type QuellightComposition,
} from '../src/lib/server/composition';
import { runWithTurnAssemblyScope } from '../src/lib/server/model-seam';
import {
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_OPEN,
} from '../src/lib/sharedworld/context-contract';

/**
 * Node-side Q4 injection proofs (Lane B; frozen contract §5/§6/§7/§8):
 * the exact model-request transformation, the non-persistence of the
 * block, the frozen-snapshot replay across a multi-step turn, cross-thread
 * isolation and continuity, and the agent-envelope invariance. The scope
 * is installed exactly as the production turns route installs it.
 */

// High-entropy canaries (fresh per run; NEVER the real credential).
const CANARY_TOKEN = `qlt-token-canary-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q4-inject-'));
  tempDirs.push(dir);
  return dir;
};
const composed: Array<{ close(): Promise<void> }> = [];

afterEach(() => {
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
});
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort on Windows (D-6) */
    }
  }
});

interface RecordedPrompt {
  readonly roles: string[];
  readonly texts: string[];
}

/** A recording wrapper over the deterministic offline model. */
function recordingModelFactory(
  script: Record<string, unknown>,
  recorded: RecordedPrompt[],
): () => unknown {
  return () => {
    const base = createDeterministicOfflineModel({ script: script as never }) as {
      doStream: (options: unknown) => Promise<unknown>;
    };
    return {
      specificationVersion: 'v2',
      provider: 'recording-offline',
      modelId: 'recording-offline',
      supportedUrls: {},
      doStream: async (options: unknown) => {
        const prompt = (options as { prompt?: Array<Record<string, unknown>> }).prompt ?? [];
        const texts: string[] = [];
        for (const message of prompt) {
          const content = message['content'];
          if (typeof content === 'string') {
            texts.push(content);
          } else if (Array.isArray(content)) {
            for (const part of content) {
              if (
                part !== null &&
                typeof part === 'object' &&
                (part as { type?: unknown }).type === 'text'
              ) {
                texts.push(String((part as { text?: unknown }).text ?? ''));
              }
            }
          }
        }
        recorded.push({ roles: prompt.map((message) => String(message['role'])), texts });
        return base.doStream(options);
      },
    };
  };
}

async function compose(
  script: Record<string, unknown>,
  recorded: RecordedPrompt[],
): Promise<QuellightComposition> {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_ACTOR_TOKEN: CANARY_TOKEN },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    skipListen: true,
    offlineModelFactory: recordingModelFactory(script, recorded),
  });
  composed.push(composition);
  return composition;
}

function actorOf(composition: QuellightComposition) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

async function startTurn(
  composition: QuellightComposition,
  mastraThreadId: string,
  swThreadId: string,
  input: string,
  idempotencyKey: string,
): Promise<string> {
  // Install the scope EXACTLY as the production turns route does.
  const outcome = await runWithTurnAssemblyScope(
    {
      swThreadId,
      mastraThreadId,
      memoryPolicy: { policyId: 'qlt.memory-mode@1', mode: 'across-conversations', revision: 1 },
    },
    () =>
      composition.commandService.dispatch(actorOf(composition), {
        command: 'agent.turn.start',
        payload: { threadId: mastraThreadId, input },
        idempotencyKey,
      }),
  );
  if (!outcome.ok) {
    throw new Error(`turn did not start: ${'code' in outcome ? outcome.code : 'unknown'}`);
  }
  return (outcome.data as { turnId: string }).turnId!;
}

async function awaitTerminal(composition: QuellightComposition, turnId: string): Promise<string> {
  for (let index = 0; index < 400; index += 1) {
    const turn = await composition.stores.turns.getTurn(turnId);
    if (turn && ['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return turn.status;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error('turn did not settle');
}

describe('Q4 model-seam injection (composition level)', () => {
  it('injects the frozen block before the trailing user message and never persists it', async () => {
    const recorded: RecordedPrompt[] = [];
    const composition = await compose({ Hello: { kind: 'text', text: 'Hi there.' } }, recorded);
    const thread = await composition.sharedWorld.createThread({ title: 'Inject' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'morning routine',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The user guards their morning deep-work block.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const turnId = await startTurn(
      composition,
      conversation.mastraThreadId,
      thread.id,
      'Hello',
      'q4-inject-1',
    );
    expect(await awaitTerminal(composition, turnId)).toBe('completed');

    expect(recorded.length).toBeGreaterThan(0);
    const prompt = recorded[0]!;
    // the block is ONE user-role message before the trailing user message
    expect(prompt.roles[prompt.roles.length - 1]).toBe('user');
    expect(prompt.roles[prompt.roles.length - 2]).toBe('user');
    expect(prompt.roles[0]).toBe('system');
    const block = prompt.texts[prompt.texts.length - 2]!;
    expect(block.startsWith(QLT_CONTEXT_BLOCK_OPEN)).toBe(true);
    expect(block.endsWith(QLT_CONTEXT_BLOCK_CLOSE + '\n')).toBe(true);
    expect(block).toContain('morning routine');
    expect(block).toContain('The user guards their morning deep-work block.');
    // the real user message is still the LAST message
    expect(prompt.texts[prompt.texts.length - 1]).toBe('Hello');

    // transcript non-pollution: neither the restore output nor the Mastra
    // store rows contain any block marker
    const restore = await composition.restoreThread(thread.id);
    for (const message of restore.messages) {
      expect(message.text).not.toContain('QLT:SHARED-WORLD-CONTEXT');
    }
    const dbPath = join(composition.dataDir, 'mastra', 'mastra-store.db');
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    const tables = (
      raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table';").all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    let markerHits = 0;
    for (const table of tables) {
      try {
        const rows = raw.prepare(`SELECT * FROM "${table}";`).all() as Array<
          Record<string, unknown>
        >;
        for (const row of rows) {
          if (JSON.stringify(row).includes('QLT:SHARED-WORLD-CONTEXT')) {
            markerHits += 1;
          }
        }
      } catch {
        /* non-readable internal table */
      }
    }
    raw.close();
    expect(markerHits).toBe(0);

    // the durable assembly record exists exactly once for the turn
    const summary = await composition.getThreadAssemblySummary(thread.id);
    expect(summary?.outcome).toBe('complete');
    expect(summary?.usedCount).toBe(1);
  });

  it('turns started without the production scope inject nothing (defensive pass-through)', async () => {
    const recorded: RecordedPrompt[] = [];
    const composition = await compose({ Hello: { kind: 'text', text: 'Hi there.' } }, recorded);
    const thread = await composition.sharedWorld.createThread({ title: 'No scope' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'No scope claim',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: 'Hello' },
      idempotencyKey: 'q4-noscope-1',
    });
    if (!outcome.ok) {
      throw new Error('turn did not start');
    }
    await awaitTerminal(composition, (outcome.data as { turnId: string }).turnId!);
    for (const prompt of recorded) {
      for (const text of prompt.texts) {
        expect(text).not.toContain('QLT:SHARED-WORLD-CONTEXT');
      }
    }
  });

  it('C-14: concurrent turns on two threads each assemble for their OWN turn (layer order proves attribution)', async () => {
    const recorded: RecordedPrompt[] = [];
    const composition = await compose({ Hello: { kind: 'text', text: 'Hi there.' } }, recorded);
    const threadA = await composition.sharedWorld.createThread({ title: 'A' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const threadB = await composition.sharedWorld.createThread({ title: 'B' });
    const convB = await composition.sharedWorld.ensureConversationLink(threadB.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'only-a',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Thread A exclusive memory.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: threadA.id,
    });
    await composition.sharedWorld.meaning.createClaim({
      subject: 'only-b',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Thread B exclusive memory.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: threadB.id,
    });
    const turnA = await startTurn(
      composition,
      convA.mastraThreadId,
      threadA.id,
      'Hello',
      'q4-iso-a',
    );
    const turnB = await startTurn(
      composition,
      convB.mastraThreadId,
      threadB.id,
      'Hello',
      'q4-iso-b',
    );
    await awaitTerminal(composition, turnA);
    await awaitTerminal(composition, turnB);
    expect(recorded.length).toBe(2);
    // cross-thread continuity (D-Q4-3): each turn sees BOTH confirmed
    // records — but in the layer order of ITS OWN thread: the current-
    // thread record is always first. A wrong-assembly substitution would
    // show the wrong record first.
    const orderOf = (prompt: RecordedPrompt): [number, number] => {
      const block = prompt.texts[prompt.texts.length - 2]!;
      const withA = block.indexOf('Thread A exclusive memory.');
      const withB = block.indexOf('Thread B exclusive memory.');
      return [withA, withB];
    };
    const [posAinA, posBinA] = orderOf(recorded[0]!);
    expect(posAinA).toBeGreaterThan(-1);
    expect(posAinA).toBeLessThan(posBinA);
    const [posAinB, posBinB] = orderOf(recorded[1]!);
    expect(posBinB).toBeGreaterThan(-1);
    expect(posBinB).toBeLessThan(posAinB);
    // each turn durably holds its OWN assembly (attribution truth)
    const recordA = await composition.sharedWorld.getContextAssemblyByTurn(turnA);
    const recordB = await composition.sharedWorld.getContextAssemblyByTurn(turnB);
    expect(recordA?.turnId).toBe(turnA);
    expect(recordB?.turnId).toBe(turnB);
    expect(recordA?.fingerprint).not.toBe(recordB?.fingerprint);
    // record A's selection leads with A's own record; record B's with B's
    expect(recordA?.selectedIds[0]?.id).not.toBe(recordB?.selectedIds[0]?.id);
    expect(recordB?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('C-08/D-Q4-3: a confirmed record from an earlier thread helps in a fresh thread', async () => {
    const recorded: RecordedPrompt[] = [];
    const composition = await compose({ Hello: { kind: 'text', text: 'Hi there.' } }, recorded);
    const oldThread = await composition.sharedWorld.createThread({ title: 'Old' });
    await composition.sharedWorld.meaning.createClaim({
      subject: 'communication preference',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The user prefers concise bullet-point answers.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: oldThread.id,
    });
    const freshThread = await composition.sharedWorld.createThread({ title: 'Fresh' });
    const convFresh = await composition.sharedWorld.ensureConversationLink(freshThread.id);
    const turnId = await startTurn(
      composition,
      convFresh.mastraThreadId,
      freshThread.id,
      'Hello',
      'q4-cross-1',
    );
    await awaitTerminal(composition, turnId);
    const prompt = recorded[0]!;
    const block = prompt.texts[prompt.texts.length - 2]!;
    expect(block).toContain('The user prefers concise bullet-point answers.');
    expect(block).toContain('"scope":"other-thread"');
    expect(block).toContain(`"origin":"thread:${oldThread.id}"`);
  });

  it('replays the FROZEN snapshot on the second model call of the same turn; mid-turn corrections do not substitute', async () => {
    const recorded: RecordedPrompt[] = [];
    // The trigger turn makes the fixture call the tool, producing a second
    // model call within the SAME turn.
    const composition = await compose(
      {
        'I keep important details scattered everywhere': {
          kind: 'tool-call',
          toolName: 'qlt_proposal_draft',
          args: {
            proposalKind: 'claim',
            content: {
              subject: 'Deep work preferences',
              epistemicType: 'E5',
              honestyState: 'likely',
              confidence: 'qualified',
              statement: 'The user does their most important work in focused morning sessions.',
            },
          },
          thenText: 'Noted a possible claim.',
        },
      },
      recorded,
    );
    const thread = await composition.sharedWorld.createThread({ title: 'Replay' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    await composition.sharedWorld.meaning.createClaim({
      subject: 'pref',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Frozen at assembly time.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const turnId = await startTurn(
      composition,
      conversation.mastraThreadId,
      thread.id,
      'I keep important details scattered everywhere',
      'q4-replay-1',
    );
    await awaitTerminal(composition, turnId);
    expect(recorded.length).toBe(2);
    const firstBlock = recorded[0]!.texts[recorded[0]!.texts.length - 2]!;
    const secondBlock = recorded[1]!.texts[recorded[1]!.texts.length - 2]!;
    expect(firstBlock).toBe(secondBlock);
    expect(firstBlock).toContain('Frozen at assembly time.');

    // a correction mid-turn (the target is corrected while the turn runs —
    // here: after the turn, then a NEW turn assembles the successor)
    const claims = await composition.sharedWorld.meaning.listClaims({});
    await composition.sharedWorld.meaning.applyCorrection({
      subjectRecordId: claims.rows[0]!.id,
      subjectFamily: 'claim',
      correctionKey: 'q4-correction',
      content: { statement: 'Corrected after the turn.' },
      correctedBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const turnId2 = await startTurn(
      composition,
      conversation.mastraThreadId,
      thread.id,
      'Hello again',
      'q4-replay-2',
    );
    await awaitTerminal(composition, turnId2);
    const thirdCall = recorded.at(-1)!;
    const nextBlock = thirdCall.texts[thirdCall.texts.length - 2]!;
    expect(nextBlock).toContain('Corrected after the turn.');
    expect(nextBlock).not.toContain('Frozen at assembly time.');
    // the FIRST turn's frozen record is unchanged (historical truth)
    const record = await composition.sharedWorld.getContextAssemblyByTurn(turnId);
    expect(record?.selectedIds).toEqual([{ id: claims.rows[0]!.id, kind: 'claim', version: 1 }]);
  });

  it('C-23: with no eligible records the turn proceeds with zero injection and an `empty` record', async () => {
    const recorded: RecordedPrompt[] = [];
    const composition = await compose({ Hello: { kind: 'text', text: 'Hi there.' } }, recorded);
    const thread = await composition.sharedWorld.createThread({ title: 'Empty' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    const turnId = await startTurn(
      composition,
      conversation.mastraThreadId,
      thread.id,
      'Hello',
      'q4-empty-1',
    );
    await awaitTerminal(composition, turnId);
    expect(recorded.length).toBeGreaterThan(0);
    for (const prompt of recorded) {
      for (const text of prompt.texts) {
        expect(text).not.toContain('QLT:SHARED-WORLD-CONTEXT');
      }
    }
    const summary = await composition.getThreadAssemblySummary(thread.id);
    expect(summary?.outcome).toBe('empty');
  });

  it('the agent authority envelope remains EXACTLY the one proposal capability (C-19/C-20)', () => {
    // structural re-assertion at composition level (profile revision 3)
    return (async () => {
      const recorded: RecordedPrompt[] = [];
      const composition = await compose({}, recorded);
      expect(composition.activation.capabilities.length).toBe(1);
      expect(composition.activation.capabilities[0]!.id).toBe('qlt.proposal.draft');
      expect(composition.activation.capabilities[0]!.revision).toBe('3');
    })();
  });
});
