import { installProviderObserver, simulatedResponse } from './q6-provider-observer.mjs';
import { adoptQ6LiveWorkspace } from './q6-live-workspace.mjs';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../../src/lib/server/composition.ts';
import { QLT_Q6_T1_STATEMENT } from '../../src/lib/sharedworld/q6-contract.ts';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import { isDeepStrictEqual } from 'node:util';
import { argumentEvidence } from './q6-provider-observer.mjs';
import { evaluateExplicitPositive } from './q6-acceptance.mjs';
import { QLT_PROPOSAL_FIELD_GUIDANCE } from '../../src/lib/agent/proposal-guidance.ts';
import { QLT_Q6_EXAMPLE_STATEMENT } from '../../src/lib/sharedworld/q6-contract.ts';
import { offlineMatrixScriptFor, runQ6LiveMatrix } from './q6-live-matrix.mjs';

// Suppress dependency diagnostics: raw errors may contain provider arguments.
const emit = console.log.bind(console);
for (const method of ['log', 'error', 'warn', 'info', 'debug']) console[method] = () => {};
const scenario = process.argv[2];
const live = ['baseline', 'none', 'none1024', 'guided2048'].includes(scenario);
if (live && process.env.QUELLIGHT_DIAGNOSTIC !== '1') process.exit(2);
const workspace = adoptQ6LiveWorkspace(process.env.QUELLIGHT_Q6_OWNED_ROOT);
if (scenario === 'matrix') {
  const fixture = {
    text: QLT_Q6_EXAMPLE_STATEMENT,
    byteLength: Buffer.byteLength(QLT_Q6_EXAMPLE_STATEMENT),
  };
  const script = offlineMatrixScriptFor(fixture.text);
  let guidancePresent = true;
  const result = await runQ6LiveMatrix({
    mode: 'live',
    ownedRoot: workspace.root,
    fixture,
    credential: process.env.OLLAMA_API_KEY,
    requireOwned: (dir, label) => workspace.requireOwned(dir, label),
    dataEnv: (dir) => workspace.dataEnv(dir),
    requireResolvedEnvironmentDataDir: (env) => workspace.requireResolvedEnvironmentDataDir(env),
    requireCompositionDataDir: (composition, label) =>
      workspace.requireCompositionDataDir(composition, label),
    note: () => {},
    providerTransport: async (_url, init) => {
      const body = JSON.parse(init.body);
      guidancePresent &&= body.messages[0].content.includes(QLT_PROPOSAL_FIELD_GUIDANCE);
      if (body.max_tokens !== 2048 || body.reasoning_effort !== undefined)
        throw new Error('QLT_WIRE_PROFILE_DRIFT');
      const userIndex = body.messages.findLastIndex((message) => message.role === 'user');
      const step = script[body.messages[userIndex].content];
      if (!step) throw new Error('QLT_WIRE_UNEXPECTED_INPUT');
      const followup = body.messages
        .slice(userIndex + 1)
        .some((message) => message.role === 'tool');
      return step.toolName && !followup
        ? simulatedResponse('valid', step.args)
        : simulatedResponse('text', undefined, step.thenText ?? step.text);
    },
  });
  emit(JSON.stringify({ scenario, guidancePresent, result }));
  process.exit(result.ok && guidancePresent ? 0 : 1);
}
let calls = 0;
const rawArguments = [];
const routerArguments = [];
const routerParts = {};
const originalStream = ModelRouterLanguageModel.prototype.doStream;
ModelRouterLanguageModel.prototype.doStream = async function (options) {
  const result = await originalStream.call(this, options);
  return {
    ...result,
    stream: result.stream.pipeThrough(
      new TransformStream({
        transform(part, controller) {
          routerParts[part.type] = (routerParts[part.type] ?? 0) + 1;
          if (part.type === 'tool-call')
            routerArguments.push(
              typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
            );
          controller.enqueue(part);
        },
      }),
    ),
  };
};
const observer = installProviderObserver({
  maxRequests: 2,
  purpose: `diagnostic-${scenario}`,
  onArguments(raw) {
    rawArguments.push(raw);
  },
  ...(live ? {} : { transport: async () => simulatedResponse(++calls === 1 ? scenario : 'text') }),
  ...(scenario.startsWith('none')
    ? {
        rewrite(body) {
          body.reasoning_effort = 'none';
        },
      }
    : {}),
  ...(scenario.startsWith('guided')
    ? {
        rewrite(body) {
          body.max_tokens = 2048;
          if (typeof body.messages[0]?.content !== 'string' || body.messages[0]?.role !== 'system')
            throw new Error('QLT_PROBE_SYSTEM_SHAPE');
          body.messages[0].content += ' ' + QLT_PROPOSAL_FIELD_GUIDANCE;
        },
      }
    : {}),
});
let composition;
let evidence = {};
try {
  const env = resolveQuellightEnvironment(
    {
      ...workspace.dataEnv(workspace.root),
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_MAX_OUTPUT_TOKENS: scenario === 'none1024' ? '1024' : '512',
    },
    process.cwd(),
  );
  workspace.requireResolvedEnvironmentDataDir(env);
  composition = await createQuellightComposition({ env, skipListen: true });
  workspace.requireCompositionDataDir(composition, 'probe');
  const thread = await composition.sharedWorld.createThread({
    title: 'Disposable structural diagnostic',
  });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
  const started = await composition.admitTurn(
    {
      swThreadId: thread.id,
      mastraThreadId: conversation.mastraThreadId,
      idempotencyKey: 'probe-turn',
    },
    () =>
      composition.commandService.dispatch(
        { ...composition.actor, presentedTokenKind: 'local-test' },
        {
          command: 'agent.turn.start',
          payload: { threadId: conversation.mastraThreadId, input: QLT_Q6_T1_STATEMENT },
          idempotencyKey: 'probe-turn',
        },
      ),
  );
  if (started.refused || !started.result.ok) throw new Error();
  const { turnId, streamId } = started.result.data;
  let terminal;
  const deadline = Date.now() + 125_000;
  while (Date.now() < deadline) {
    terminal = await composition.stores.turns.getTurn(turnId);
    if (['completed', 'failed', 'cancelled', 'blocked'].includes(terminal.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const restored = await composition.restoreThread(thread.id);
  const invocations = await composition.stores.invocations.listInvocationsForTurn(turnId);
  const proposals = await composition.sharedWorld.meaning.listProposals({});
  const frames = await composition.stores.streamLedger.listEventsFrom(streamId, 0);
  const replyText = restored.messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.text)
    .join('');
  evidence = {
    status: terminal.status,
    errorCode: terminal.errorCode,
    acceptance: evaluateExplicitPositive({
      replyText,
      proposals: proposals.rows,
      canonicalRecords: 0,
      invocationCount: invocations.length,
    }),
    visibleReplyBytes: Buffer.byteLength(
      restored.messages
        .filter((message) => message.role === 'assistant')
        .map((message) => message.text)
        .join(''),
    ),
    invocations: invocations.map((row) => ({
      status: row.status,
      effect: row.effect,
      approvalRequired: row.approvalRequired,
      approvalDisposition: row.approvalDisposition,
    })),
    proposals: proposals.rows.map((row) => ({ kind: row.proposalKind, status: row.status })),
    canonical:
      (await composition.sharedWorld.meaning.listClaims({})).total +
      (await composition.sharedWorld.meaning.listCommitments({})).total +
      (await composition.sharedWorld.meaning.listOpenLoops({})).total,
    // Event type/code only: no provider errors or tool argument summaries.
    milestones: frames
      .map((frame) =>
        typeof frame.payload === 'string' ? JSON.parse(frame.payload) : (frame.payload ?? frame),
      )
      .filter((event) => String(event.kind).startsWith('tool.'))
      .map((event) => ({
        kind: event.kind,
        code: /^VICT_[A-Z_]+$/.test(event.code) ? event.code : undefined,
      })),
  };
} catch {
  evidence.failure = 'QLT_PROBE_EXECUTION_FAILED';
  process.exitCode = 1;
} finally {
  await composition?.close();
  observer.restore();
}
emit(
  JSON.stringify({
    scenario,
    requests: observer.records,
    refused: observer.refused,
    routerParts,
    routerArguments: routerArguments.map(argumentEvidence),
    rawRouterEqual: isDeepStrictEqual(
      rawArguments.map(JSON.parse),
      routerArguments.map(JSON.parse),
    ),
    evidence,
  }),
);
process.exit(process.exitCode ?? 0);
