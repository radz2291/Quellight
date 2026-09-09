/**
 * The forced-restart fixture worker (N-9). Plain process: the parent test
 * spawns it with tsx, feeds it a mode, and SIGKILLs it mid-turn to prove
 * truthful recovery from durable state alone.
 *
 * Modes:
 * - `setup`:     compose, create a thread, complete one turn, print
 *                `{"ok":true,"threadId":...}` and exit cleanly.
 * - `midturn`:   compose on the SAME data dir, start a LONG scripted
 *                turn, print READY, and stay alive until SIGKILLed.
 * - `verify`:    compose on the SAME data dir (reconciliation runs at
 *                boot), inspect durable truth, print a JSON verdict.
 *
 * No network access and no provider credential are involved: the offline
 * deterministic fixture is the only model.
 */

const mode = process.argv[2] ?? '';
const dataDir = process.env.QUELLIGHT_WORKER_DATA_DIR ?? '';
const scriptText = process.env.QUELLIGHT_WORKER_TEXT ?? 'working. ';

const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  new URL('../../src/lib/server/composition.ts', import.meta.url).href
);

// The data dir is passed as the worker's "repository root"; the store
// directory stays a bounded RELATIVE path inside it (operator discipline).
const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, dataDir);
const script = {};
for (const key of ['Tell me about the weather', 'long running question']) {
  script[key] = { kind: 'text', text: scriptText.repeat(80) };
}
script['completed in setup'] = { kind: 'text', text: 'setup-response-text' };

const composition = await createQuellightComposition({
  env,
  offlineScript: script,
  skipListen: true,
});

const actor = { ...composition.actor, presentedTokenKind: 'local-test' };
const say = (payload: unknown): void => {
  process.stdout.write(`<<JSON>>${JSON.stringify(payload)}\n`);
};

if (mode === 'setup') {
  const thread = await composition.sharedWorld.createThread({ title: 'Restart proof thread' });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
  const outcome = await composition.commandService.dispatch(actor, {
    command: 'agent.turn.start',
    payload: { threadId: conversation.mastraThreadId, input: 'completed in setup' },
    idempotencyKey: 'worker-setup-1',
  });
  if (!outcome.ok) {
    say({ ok: false, stage: 'setup', code: outcome.code });
    process.exit(1);
  }
  const { turnId } = outcome.data as { turnId: string };
  for (let i = 0; i < 400; i += 1) {
    const turn = await composition.turnService.getTurn(actor, turnId);
    if (turn.status === 'completed') {
      say({ ok: true, threadId: thread.id });
      await composition.close();
      process.exit(0);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  say({ ok: false, stage: 'setup-timeout' });
  process.exit(1);
}

if (mode === 'midturn') {
  const threads = await composition.sharedWorld.listThreads();
  const threadId = threads.threads[0]!.id;
  const conversation = await composition.sharedWorld.ensureConversationLink(threadId);
  const outcome = await composition.commandService.dispatch(actor, {
    command: 'agent.turn.start',
    payload: { threadId: conversation.mastraThreadId, input: 'long running question' },
    idempotencyKey: 'worker-midturn-1',
  });
  if (!outcome.ok) {
    say({ ok: false, stage: 'midturn', code: outcome.code });
    process.exit(1);
  }
  const { turnId } = outcome.data as { turnId: string };
  say({ ok: true, turnId });
  // Stay alive mid-turn until the parent SIGKILLs this process.
  await new Promise(() => undefined);
}

if (mode === 'verify') {
  const threads = await composition.sharedWorld.listThreads();
  const threadId = threads.threads[0]!.id;
  const restored = await composition.restoreThread(threadId);
  const conversation = await composition.sharedWorld.getConversationLink(threadId);
  const allTurns = await composition.stores.turns.listTurns();
  const verdict = {
    ok: true,
    threadTitle: restored.thread.title,
    threadCount: threads.total,
    restoredMessages: restored.messages.map((message) => message.text),
    turns: restored.turns.map((turn) => ({
      status: turn.status,
      errorCode: turn.errorCode ?? null,
    })),
    rawTurns: allTurns.map((turn) => ({
      turnId: turn.turnId,
      threadId: turn.threadId,
      actorId: turn.actorId,
      status: turn.status,
      linked: conversation?.mastraThreadId ?? null,
    })),
  };
  say(verdict);
  await composition.close();
  process.exit(0);
}

say({ ok: false, stage: 'unknown-mode' });
process.exit(1);
