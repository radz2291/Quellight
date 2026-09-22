// @ts-nocheck
/**
 * Quellight Stage 07C Phase Q6 — the LIVE-PROOF MATRIX (Execution-3
 * remediation; frozen contract
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-REMEDIATION-CONTRACT.md).
 *
 * This module is the REAL worker orchestration, factored so it can run in
 * TWO modes against the SAME six-turn matrix:
 *
 *   - mode 'live'    — exactly the prepared Execution-3 behavior: every
 *     composition, provider turn, restart, and ceremony operation with the
 *     real provider (gated exactly as before; never automatic);
 *   - mode 'offline' — the SAME orchestration against the deterministic
 *     offline fixture model (no credential, no provider, no gate): the
 *     permanent offline worker-path proof required by the remediation
 *     contract §7.
 *
 * REMEDIATIONS carried here:
 *   - H-1'  reply retrieval accepts the FULL composition and calls
 *           `composition.restoreThread(threadId)` — NEVER on the Shared
 *           World store binding (the Execution-3 crash). The same
 *           correct boundary is used before and after the restart.
 *   - M-1   every asynchronous evidence function is AWAITED; an evidence
 *           failure becomes the stable `QLT_Q6_EVIDENCE_CHECK_FAILED`
 *           finding BEFORE result serialization (structural + behavioral
 *           tests enforce this).
 *   - M-2   findings are STABLE NON-ECHOING CODES only:
 *           `QLT_Q6_LIVE_MATRIX_FAILED`, `QLT_Q6_REPLY_RESTORE_FAILED`,
 *           `QLT_Q6_EVIDENCE_CHECK_FAILED` (+ a phase label). Raw provider,
 *           fixture, path, proposal, response, or credential-derived error
 *           text NEVER enters findings (the old bounded slicing of the
 *           thrown value is removed entirely).
 *
 * The six-turn matrix, the natural-flow acceptance predicates, every
 * acceptance rule, the durable-invocation truth checks, the governed
 * ceremony, the restart, the fresh-thread continuity, the conflict
 * non-mutation, the in-memory credential surfaces, and the bounds are
 * PRESERVED UNCHANGED from the prepared harness. No live acceptance rule
 * is weakened. The live gate, its bounds, and its exactly-once
 * authorization live in the parent (`q6-live-parent.mjs`) and are
 * unchanged.
 */
import { QLT_AGENT_PROPOSER_ID } from '../../src/lib/sharedworld/ceremony-contract.ts';
import {
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_OPEN,
  QLT_CONTEXT_RECORD_CLOSE,
} from '../../src/lib/sharedworld/context-contract.ts';
import {
  QLT_Q6_COMMITMENT_ANCHORS,
  QLT_Q6_LIVE_BOUNDS,
  QLT_Q6_PROVIDER_IDENTITY,
  QLT_Q6_T1_STATEMENT,
  QLT_Q6_T3_STATEMENT,
  QLT_Q6_T4_STATEMENT,
  QLT_Q6_T5_STATEMENT,
  QLT_Q6_T6_STATEMENT,
} from '../../src/lib/sharedworld/q6-contract.ts';
import {
  evaluateConflictTurn,
  evaluateDiscretionaryNegative,
  evaluateDiscretionaryPositive,
  evaluateExplicitPositive,
  evaluateNaturalFlow,
} from './q6-acceptance.mjs';
import { installProviderObserver } from './q6-provider-observer.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The closed vocabulary of matrix failure codes (M-2; non-echoing). */
export const QLT_Q6_FAILURE_CODES = Object.freeze({
  MATRIX: 'QLT_Q6_LIVE_MATRIX_FAILED',
  REPLY_RESTORE: 'QLT_Q6_REPLY_RESTORE_FAILED',
  EVIDENCE: 'QLT_Q6_EVIDENCE_CHECK_FAILED',
});

/** The mode the matrix runs in ('live' | 'offline'). */
export const Q6_MATRIX_MODES = Object.freeze(['live', 'offline']);

/** A stable, non-echoing matrix failure: code + phase only, never content. */
export class Q6MatrixFailure extends Error {
  code;
  phase;

  constructor(code, phase) {
    super(`${code} (phase: ${phase})`);
    this.name = 'Q6MatrixFailure';
    this.code = code;
    this.phase = phase;
  }
}

/**
 * The deterministic OFFLINE script for the offline mode (no provider):
 * keyed by the exact last-user text, exercising the SAME capability through
 * the SAME real bridge and store boundaries. The synthetic commitment
 * carries all four frozen anchors in the USER'S voice; t3/t4/t5 produce
 * text only (no tool call).
 */
export function offlineMatrixScriptFor(fixtureText) {
  return {
    [QLT_Q6_T1_STATEMENT]: {
      toolName: 'qlt_proposal_draft',
      args: {
        proposalKind: 'claim',
        content: {
          subject: 'Explanation preference',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'qualified',
          statement: 'The user prefers explanations in plain language before technical details.',
        },
      },
      thenText: 'Understood — plain language first, technical detail after.',
    },
    [String(fixtureText)]: {
      toolName: 'qlt_proposal_draft',
      args: {
        proposalKind: 'commitment',
        content: {
          commitmentKey: 'career-transition-base',
          statement:
            'The user will not leave their current job until there is a clear pathway and an established base.',
        },
      },
      thenText:
        'That is a steady way to hold it — building the base first and keeping the job until the pathway is clear.',
    },
    [QLT_Q6_T3_STATEMENT]: {
      text: 'That installer sounds genuinely annoying — restarting it twice is never fun.',
    },
    [QLT_Q6_T4_STATEMENT]: {
      text: 'The clearest guide is the commitment you already named: a clear pathway and an established base first.',
    },
    [QLT_Q6_T5_STATEMENT]: {
      text: 'As a pure thought experiment that would change everything — in reality you set the terms.',
    },
    [QLT_Q6_T6_STATEMENT]: {
      text: 'That sounds frustrating. I can keep you company while you wait.',
    },
  };
}

const OFFLINE_USAGE = { total: 21, text: 21, reasoning: 0 };

/** The last user-message text of one model-request prompt. */
function lastUserText(prompt) {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    const message = prompt[index];
    if (message?.role !== 'user') {
      continue;
    }
    const parts = message.content ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part?.type === 'text') {
        return part.text;
      }
    }
  }
  return undefined;
}

/**
 * True when THIS request is an intra-turn re-prompt: the model is being
 * asked again after its OWN tool call within the same turn (a tool result
 * appears after the newest user message). In that case the driver emits the
 * post-tool text so the pinned agent loop terminates deterministically.
 */
function isIntraTurnReprompt(prompt) {
  let lastToolResultIndex = -1;
  for (let index = 0; index < prompt.length; index += 1) {
    if (prompt[index]?.role === 'tool') {
      lastToolResultIndex = index;
    }
  }
  if (lastToolResultIndex < 0) {
    return false;
  }
  for (let index = lastToolResultIndex + 1; index < prompt.length; index += 1) {
    if (prompt[index]?.role === 'user') {
      return false; // a NEW user turn started after the tool result
    }
  }
  return true;
}

/**
 * The Quellight-owned deterministic offline driver (offline mode ONLY).
 *
 * WHY NOT THE STOCK VICT FIXTURE: the released deterministic fixture emits
 * a scripted tool call AT MOST ONCE per conversation (it suppresses any
 * repeat once a tool result of the same name is in the prompt), so it can
 * never drive the matrix's TWO tool-calling turns (t1 AND t2) in ONE
 * conversation — which the REAL provider handled and the live matrix
 * requires. This driver keeps the turn-aware distinction the stock fixture
 * cannot express: intra-turn re-prompts terminate with the post-tool text;
 * a NEW user turn may call the tool again — exactly the real-provider
 * shape. Every other boundary stays REAL (composition, bridge, contracts,
 * stores, acceptance predicates). The model is injected through the
 * composition's existing `offlineModelFactory` seam; the released fixture
 * in `@victframework/mastra` is untouched.
 */
export function offlineModelFactoryFor(script) {
  return () => {
    let toolCallOccurrence = 0;
    const model = {
      specificationVersion: 'v2',
      provider: 'offline-fixture',
      modelId: 'quellight-q6-matrix-driver-1',
      supportedUrls: {},
      async doStream(callOptions) {
        const prompt = (callOptions ?? {}).prompt ?? [];
        const key = lastUserText(prompt);
        const step = script[key] ?? {};
        const wantsToolCall = step.toolName !== undefined && !isIntraTurnReprompt(prompt);
        const stream = new ReadableStream({
          start(controller) {
            try {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `offline-quellight-q6-matrix`,
                modelId: model.modelId,
                timestamp: new Date(0),
              });
              if (wantsToolCall) {
                toolCallOccurrence += 1;
                const toolCallId = `offline-call-${step.toolName}-${toolCallOccurrence}`;
                const inputJson = JSON.stringify(step.args ?? {});
                controller.enqueue({
                  type: 'tool-input-start',
                  id: toolCallId,
                  toolName: step.toolName,
                });
                controller.enqueue({ type: 'tool-input-delta', id: toolCallId, delta: inputJson });
                controller.enqueue({ type: 'tool-input-end', id: toolCallId });
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId,
                  toolName: step.toolName,
                  input: inputJson,
                });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: OFFLINE_USAGE,
                });
                controller.close();
                return;
              }
              const text = wantsToolCall ? '' : (step.thenText ?? step.text ?? '');
              controller.enqueue({ type: 'text-start', id: 'offline-text-1' });
              controller.enqueue({ type: 'text-delta', id: 'offline-text-1', delta: text });
              controller.enqueue({ type: 'text-end', id: 'offline-text-1' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage: OFFLINE_USAGE });
              controller.close();
            } catch (error) {
              controller.enqueue({ type: 'error', error });
              controller.close();
            }
          },
        });
        return { stream };
      },
    };
    return model;
  };
}

/**
 * Run the complete six-turn matrix. Returns the machine-readable result
 * record (safe metadata only). The caller owns workspace adoption, fixture
 * validation, result serialization, process exit, and (for live runs) the
 * parent-side scans.
 *
 * @param {{
 *   ownedRoot: string;
 *   mode: 'live' | 'offline';
 *   credential: string;
 *   fixture: { text: string; byteLength: number; identity?: object; text?: string };
 *   requireOwned?: (directory: string, label: string) => void;
 *   dataEnv?: (directory: string) => Record<string, string>;
 *   requireResolvedEnvironmentDataDir?: (environment: unknown) => void;
 *   requireCompositionDataDir?: (composition: unknown, label: string) => void;
 *   clock?: () => number;
 *   note?: (message: string) => void;
 * }} options
 */
export async function runQ6LiveMatrix(options) {
  const mode = options.mode;
  if (!Q6_MATRIX_MODES.includes(mode)) {
    throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.MATRIX, 'options');
  }
  const workspace = {
    requireOwned:
      options.requireOwned ??
      (() => {
        throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.MATRIX, 'workspace');
      }),
    dataEnv: options.dataEnv ?? (() => ({})),
    requireResolvedEnvironmentDataDir:
      options.requireResolvedEnvironmentDataDir ?? (() => undefined),
    requireCompositionDataDir: options.requireCompositionDataDir ?? (() => undefined),
  };
  const note = options.note ?? ((message) => console.log(`  ${message}`));
  const clock = options.clock ?? (() => Date.now());
  const ownedRoot = options.ownedRoot;
  const credential = options.credential;
  const fixture = options.fixture;

  // ---- the REAL production composition (tsx-loaded TS) --------------------
  const { createQuellightComposition, resolveQuellightEnvironment } = await import(
    new URL('../../src/lib/server/composition.ts', import.meta.url).href
  );
  const { getCompiledPlan } = await import(
    new URL('../../src/lib/application/definition.ts', import.meta.url).href
  );

  const findings = [];
  const fail = (message) => {
    findings.push(message);
    console.error(`FAIL: ${message}`);
  };
  /** @type {Array<{ id: string; status: string; elapsedMs: number; proposals: number; invocations: number }>} */
  const turnRecords = [];
  let providerTurnCount = 0;
  /** The current matrix phase label (stable, non-echoing evidence). */
  let phase = 'start';
  const providerObserver =
    mode === 'live'
      ? installProviderObserver({
          maxRequests: QLT_Q6_LIVE_BOUNDS.maxProviderRequests,
          maxRequestsPerTurn: QLT_Q6_LIVE_BOUNDS.maxProviderRequestsPerTurn,
          turnDeadlineMs: QLT_Q6_LIVE_BOUNDS.turnDeadlineMs,
          maxTokens: QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerRequest,
          purpose: () => phase,
          transport: options.providerTransport,
          onUpdate: (records) =>
            writeFileSync(join(ownedRoot, 'q6-provider-requests.json'), JSON.stringify(records)),
        })
      : undefined;

  let result = {
    ok: false,
    findings,
    turns: turnRecords,
    fixture: { byteLength: fixture.byteLength },
    providerTurns: 0,
  };

  const composed = [];
  const composeMatrix = async (directory) => {
    workspace.requireOwned(directory, 'compose');
    const env = resolveQuellightEnvironment(
      {
        ...workspace.dataEnv(directory),
        ...(mode === 'live' ? { QUELLIGHT_LIVE_PROOF: '1' } : {}),
        QUELLIGHT_MAX_OUTPUT_TOKENS: String(QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerRequest),
        QUELLIGHT_TURN_DEADLINE_MS: String(QLT_Q6_LIVE_BOUNDS.turnDeadlineMs),
      },
      process.cwd(),
    );
    workspace.requireResolvedEnvironmentDataDir(env);
    const composition = await createQuellightComposition({
      env,
      skipListen: true,
      ...(mode === 'offline'
        ? { offlineModelFactory: offlineModelFactoryFor(offlineMatrixScriptFor(fixture.text)) }
        : {}),
    });
    try {
      workspace.requireCompositionDataDir(composition, 'compose');
    } catch {
      await composition.close().catch(() => undefined);
      throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.MATRIX, 'workspace-identity');
    }
    composed.push(composition);
    return composition;
  };

  try {
    // ---- composition (matrix mode; the ONE owned root) --------------------
    phase = 'compose';
    const composition = await composeMatrix(ownedRoot);
    const expectedMode = mode === 'live' ? 'live' : 'offline-fixture';
    if (composition.modelMode !== expectedMode) {
      fail(`modelMode is ${composition.modelMode}, expected ${expectedMode}`);
    } else if (mode === 'live') {
      note(
        `composed in LIVE mode: ${QLT_Q6_PROVIDER_IDENTITY.provider} / ${QLT_Q6_PROVIDER_IDENTITY.model} (${QLT_Q6_PROVIDER_IDENTITY.routerIdentity} at ${QLT_Q6_PROVIDER_IDENTITY.endpoint})`,
      );
      note(
        `bounds: <=${QLT_Q6_LIVE_BOUNDS.maxProviderTurns} user turns, <=${QLT_Q6_LIVE_BOUNDS.maxProviderRequests} HTTP requests, <=${QLT_Q6_LIVE_BOUNDS.maxOutputTokensPerRequest} output tokens/request, <=${QLT_Q6_LIVE_BOUNDS.turnDeadlineMs}ms deadline/turn, zero retries, no fallback`,
      );
    } else {
      note(
        'composed in OFFLINE mode: the deterministic fixture model drives the SAME matrix through the SAME real boundaries (no provider, no credential)',
      );
    }

    const threadA = await composition.sharedWorld.createThread({
      title: 'Q6 live discretion matrix',
    });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);

    /** The last assistant reply of a thread — through the FULL composition
     * (H-1': `restoreThread` belongs to the composition, never to the
     * Shared World store). */
    const replyOf = async (replyComposition, threadId) => {
      const restored = await replyComposition.restoreThread(threadId);
      const messages = restored.messages ?? [];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') return '';
        if (messages[index].role === 'assistant') {
          return String(messages[index].text ?? '');
        }
      }
      return '';
    };

    /** Canonical records across ALL substantive families. */
    const canonicalTotals = async (sharedWorld) => {
      const claims = await sharedWorld.meaning.listClaims({});
      const commitments = await sharedWorld.meaning.listCommitments({});
      const openLoops = await sharedWorld.meaning.listOpenLoops({});
      return {
        total: claims.total + commitments.total + openLoops.total,
        claims,
        commitments,
        openLoops,
      };
    };

    /**
     * The durable invocation-truth checks on a proposal-bearing turn
     * (N-Q6-4). AWAITED (M-1); any internal failure becomes the stable
     * QLT_Q6_EVIDENCE_CHECK_FAILED finding — recorded, non-throwing, and
     * non-echoing (M-2).
     */
    const checkInvocationTruth = async (truthComposition, turnId, label) => {
      try {
        const invocations =
          await truthComposition.stores.invocations.listInvocationsForTurn(turnId);
        if (invocations.length === 0) {
          fail(`${label}: no durable invocation record exists for the turn`);
          return;
        }
        for (const invocation of invocations) {
          if (invocation.status !== 'completed') fail(`${label}: invocation did not complete`);
          if (invocation.effect !== 'write') {
            fail(
              `${label}: the durable invocation effect is ${invocation.effect}, expected the truthful write`,
            );
          }
          if (invocation.approvalRequired !== false) {
            fail(`${label}: the durable invocation did not record approvalRequired=false`);
          }
          if (invocation.approvalDisposition !== 'host-policy-write-without-separate-approval') {
            fail(
              `${label}: the durable invocation disposition is ${invocation.approvalDisposition} (expected the host quiet-write policy disposition)`,
            );
          }
          const approvals = await truthComposition.stores.approvals.listApprovalsForInvocation(
            invocation.invocationId,
          );
          if (approvals.length !== 0) {
            fail(
              `${label}: ${approvals.length} approval rows exist for the quiet proposal write (expected 0)`,
            );
          }
        }
      } catch {
        fail(`${QLT_Q6_FAILURE_CODES.EVIDENCE} (evidence target: ${label})`);
      }
    };

    /** Run one provider turn of the matrix and record its safe metadata. */
    const runMatrixTurn = async (
      turnComposition,
      sharedWorld,
      swThreadId,
      mastraThreadId,
      input,
      key,
      label,
    ) => {
      phase = label;
      if (providerTurnCount >= QLT_Q6_LIVE_BOUNDS.maxProviderTurns)
        throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.MATRIX, 'turn-bound');
      const requestOffset = providerObserver?.records.length ?? 0;
      const before = await canonicalTotals(sharedWorld);
      const proposalsBefore = (
        await sharedWorld.meaning.listProposals({ sourceThreadId: swThreadId })
      ).total;
      providerTurnCount += 1;
      const turn = await startTurnAdmitted(turnComposition, swThreadId, mastraThreadId, input, key);
      const settled = await awaitTerminal(turnComposition, turn.turnId);
      note(`${label}: status=${settled.status} in ${settled.elapsedMs}ms (content not printed)`);
      if (settled.status !== 'completed') {
        fail(
          `${label} expected completed, got ${settled.status} (${settled.errorCode ?? 'no code'}) — a truthful failed proof`,
        );
      }
      if (settled.elapsedMs > QLT_Q6_LIVE_BOUNDS.turnDeadlineMs + 5_000) {
        fail(`${label} exceeded the per-turn deadline bound (elapsed ${settled.elapsedMs}ms)`);
      }
      const invocations = await turnComposition.stores.invocations.listInvocationsForTurn(
        turn.turnId,
      );
      const proposalsAfter = await sharedWorld.meaning.listProposals({
        sourceThreadId: swThreadId,
      });
      const after = await canonicalTotals(sharedWorld);
      turnRecords.push({
        id: label,
        status: settled.status,
        elapsedMs: settled.elapsedMs,
        proposals: proposalsAfter.total - proposalsBefore,
        invocations: invocations.length,
      });
      // H-1' reply retrieval — through the FULL composition. A failure is a
      // stable non-echoing REPLY_RESTORE failure at this phase (M-2); the
      // matrix crashes forward truthfully (crash-forward semantics preserved).
      const reply = await replyOf(turnComposition, swThreadId).catch((cause) => {
        // The cause object is NEVER stringified into evidence (M-2).
        void cause;
        throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.REPLY_RESTORE, label);
      });
      for (const finding of evaluateNaturalFlow(reply)) fail(`${label}: ${finding}`);
      const requests = providerObserver?.records.slice(requestOffset) ?? [];
      if (
        providerObserver &&
        (requests.length === 0 ||
          requests.some(
            (request) =>
              request.http !== 200 ||
              !request.done ||
              !['stop', 'tool_calls'].includes(request.finish) ||
              request.parseFailed ||
              !request.schemaUnchanged ||
              request.arguments.some((args) => !args.contractAccepted || !args.mastraAccepted),
          ))
      ) {
        fail(`${label}: QLT_Q6_PROVIDER_BOUNDARY_FAILED`);
      }
      const frames = await turnComposition.stores.streamLedger.listEventsFrom(turn.streamId, 0);
      if (
        frames.some(
          (frame) => frame.kind === 'tool.failed' || frame.kind === 'tool.awaiting_approval',
        )
      ) {
        fail(`${label}: QLT_Q6_TOOL_BOUNDARY_FAILED`);
      }
      turnRecords.at(-1).visibleReplyBytes = Buffer.byteLength(reply);
      turnRecords.at(-1).providerRequests = requests.length;
      return {
        turnId: turn.turnId,
        streamId: turn.streamId,
        reply,
        invocations,
        newProposals: proposalsAfter.total - proposalsBefore,
        proposals: proposalsAfter,
        newCanonical: after.total - before.total,
        canonical: after,
      };
    };

    const startTurnAdmitted = async (turnComposition, swThreadId, mastraThreadId, input, key) => {
      const admission = await turnComposition.admitTurn(
        { swThreadId, mastraThreadId, idempotencyKey: key },
        () =>
          turnComposition.commandService.dispatch(actorOf(turnComposition), {
            command: 'agent.turn.start',
            payload: { threadId: mastraThreadId, input },
            idempotencyKey: key,
          }),
      );
      if (admission.refused) {
        throw new Error('turn admission refused (QLT_TURN_ALREADY_OPEN)');
      }
      if (!admission.result.ok) {
        throw new Error(`turn did not start: ${admission.result.code}`);
      }
      return { turnId: admission.result.data.turnId, streamId: admission.result.data.streamId };
    };

    const awaitTerminal = async (turnComposition, turnId, timeoutMs = 150_000) => {
      const startedAt = clock();
      for (;;) {
        const turn = await turnComposition.stores.turns.getTurn(turnId);
        if (turn && ['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
          return { status: turn.status, errorCode: turn.errorCode, elapsedMs: clock() - startedAt };
        }
        if (clock() - startedAt > timeoutMs) {
          return {
            status: `timeout-waiting(${turn?.status ?? 'unknown'})`,
            errorCode: undefined,
            elapsedMs: clock() - startedAt,
          };
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      }
    };

    const actorOf = (turnComposition) => ({
      ...turnComposition.actor,
      presentedTokenKind: 'local-test',
    });

    const governedMutate = async (mutateComposition, actionId, input, idempotencyKey) => {
      const action = getCompiledPlan().actions[actionId];
      if (action === undefined || action.kind !== 'mutation') {
        throw new Error(`the plan does not declare mutation action ${actionId}`);
      }
      const outcome = await mutateComposition.commandService.dispatch(actorOf(mutateComposition), {
        command: 'app.data.mutate',
        payload: {
          resourceId: action.resourceId,
          releaseVersion: mutateComposition.releaseVersion,
          expectedRevision: action.resourceRevision,
          actionKind: 'mutation',
          actionId,
          expectedActionRevision: action.revision,
          mutation: { op: action.op, input, idempotencyKey },
        },
        idempotencyKey,
      });
      if (!outcome.ok) {
        return { replayed: false, ok: false, code: outcome.code };
      }
      const resultData = (outcome.data ?? {}).result;
      return {
        replayed: resultData === undefined,
        ok: resultData === undefined || resultData.ok === true,
        code: resultData?.code,
      };
    };

    // ---- t1: explicit positive control ------------------------------------
    const t1 = await runMatrixTurn(
      composition,
      composition.sharedWorld,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T1_STATEMENT,
      'q6-live-t1',
      't1 (explicit remember request)',
    );
    // M-1: the durable-invocation evidence check is AWAITED — it can never
    // race result serialization or escape the findings.
    await checkInvocationTruth(composition, t1.turnId, 't1');
    const t1Findings = evaluateExplicitPositive({
      replyText: t1.reply,
      proposals: t1.proposals.rows.filter((row) => row.sourceTurnRef === t1.turnId),
      canonicalRecords: t1.canonical.total,
    });
    for (const finding of t1Findings) {
      fail(finding);
    }
    if (t1Findings.length === 0) {
      note(
        't1: the explicit remember request produced exactly one pending claim proposal (never canonical; no memory-write claim)',
      );
    }
    // The same-key retry replays the idempotent receipt — no second provider turn.
    phase = 't1-replay';
    const t1Replay = await composition.commandService.dispatch(actorOf(composition), {
      command: 'agent.turn.start',
      payload: { threadId: convA.mastraThreadId, input: QLT_Q6_T1_STATEMENT },
      idempotencyKey: 'q6-live-t1',
    });
    if (!t1Replay.ok) {
      fail('t1: the same-key retry was not truthfully replayed');
    } else {
      note('t1: the same-key retry replayed the idempotent receipt (no second provider turn)');
    }
    const proposalsAfterT1Replay = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    if (proposalsAfterT1Replay.total !== 1) {
      fail(`t1: the retry created a duplicate proposal (${proposalsAfterT1Replay.total} total)`);
    }

    // ---- t2: the operator's external natural fixture (discretionary) ------
    const t2 = await runMatrixTurn(
      composition,
      composition.sharedWorld,
      threadA.id,
      convA.mastraThreadId,
      fixture.text,
      'q6-live-t2',
      't2 (natural discretionary fixture)',
    );
    // M-1: awaited evidence (see t1).
    await checkInvocationTruth(composition, t2.turnId, 't2');
    // The t2 acceptance evaluates what THIS TURN drafted (turn-scoped rows;
    // the durable proposal row field is `proposalKind`). The cumulative
    // thread state is asserted separately by the canonical-record controls.
    const t2Proposals = t2.proposals.rows.filter((row) => row.sourceTurnRef === t2.turnId);
    const commitment = t2Proposals.find((row) => row.proposalKind === 'commitment');
    const t2Findings = evaluateDiscretionaryPositive({
      replyText: t2.reply,
      proposals: t2Proposals,
      canonicalRecords: t2.canonical.total,
      invocationCount: t2.invocations.length,
    });
    for (const finding of t2Findings) {
      fail(finding);
    }
    if (t2Findings.length === 0) {
      note(
        `t2: the durable commitment was drafted with all ${QLT_Q6_COMMITMENT_ANCHORS.length} anchors (user's own commitment; transient incident not recorded)`,
      );
    }
    if (commitment === undefined) {
      fail('t2: no commitment proposal exists for the user ceremony to confirm');
    }

    // ---- t3: discretionary negative control --------------------------------
    const t3 = await runMatrixTurn(
      composition,
      composition.sharedWorld,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T3_STATEMENT,
      'q6-live-t3',
      't3 (transient incident)',
    );
    const t3Findings = evaluateDiscretionaryNegative({
      replyText: t3.reply,
      newProposals: t3.newProposals,
      invocationCount: t3.invocations.length,
      newCanonicalRecords: t3.newCanonical,
    });
    for (const finding of t3Findings) {
      fail(finding);
    }
    if (t3Findings.length === 0) {
      note('t3: the ordinary software incident drafted nothing — discretion abstains');
    }

    // ---- the governed USER ceremony (not a provider turn) -------------------
    phase = 'ceremony';
    if (commitment === undefined) {
      throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.MATRIX, 'ceremony');
    }
    const confirmOutcome = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: commitment.id },
      'q6-live-confirm-1',
    );
    if (confirmOutcome.replayed !== false || confirmOutcome.ok !== true) {
      fail(
        `the governed confirmation failed truthfully (code ${confirmOutcome.code ?? 'unknown'})`,
      );
    } else {
      note('the real-user confirmation crossed the governed ceremony (only the t2 commitment)');
    }
    let canonical = await canonicalTotals(composition.sharedWorld);
    if (canonical.total !== 1) {
      fail(
        `expected EXACTLY ONE canonical record after the confirmation, found ${canonical.total}`,
      );
    }
    const canonicalCommitment = canonical.commitments.rows[0];
    if (canonicalCommitment === undefined) {
      fail('the confirmed canonical record is not a commitment');
    }
    if (canonicalCommitment !== undefined) {
      if (canonicalCommitment.createdBy === QLT_AGENT_PROPOSER_ID) {
        fail('authority violation: the canonical record carries an agent decision identity');
      } else {
        note(
          'authority: the canonical record was created by the governed user boundary, never the agent',
        );
      }
      if (canonicalCommitment.content?.statement !== commitment.content?.statement) {
        fail('the canonical commitment statement differs from the confirmed proposal statement');
      }
    }
    const commitmentId = canonicalCommitment?.id;
    const replayConfirm = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: commitment.id },
      'q6-live-confirm-1',
    );
    if (replayConfirm.ok !== true || replayConfirm.replayed !== true) {
      fail('the same-key confirmation replay was not truthfully replayed');
    }
    canonical = await canonicalTotals(composition.sharedWorld);
    if (canonical.total !== 1) {
      fail(
        `the confirmation replay duplicated the canonical record set (${canonical.total} records)`,
      );
    } else {
      note('the same-key confirmation replay created no duplicate record');
    }
    const staleExit = await governedMutate(
      composition,
      'act.releaseCommitment',
      { recordId: commitmentId, reason: 'stale-version control', expectedVersion: 999 },
      'q6-live-stale-exit',
    );
    if (staleExit.ok !== false || staleExit.code !== 'QLT_VERSION_CONFLICT') {
      fail(`the stale-version control was not refused truthfully (${staleExit.code ?? 'ok'})`);
    } else {
      note('the stale expectedVersion was refused (QLT_VERSION_CONFLICT; zero effect)');
    }
    const pendingIds = new Set(
      (await composition.sharedWorld.meaning.listProposals({})).rows.map((row) => row.id),
    );

    // ---- restart against the SAME verified owned root -----------------------
    phase = 'restart';
    const assemblyEvidenceBefore = await composition.sharedWorld.getContextAssemblyByTurn(
      t2.turnId,
    );
    const restartBeganAt = clock();
    await composition.close();
    {
      const idx = composed.indexOf(composition);
      if (idx >= 0) composed.splice(idx, 1);
    }
    const composition2 = await composeMatrix(ownedRoot);
    note(`restarted the live composition on the same data dir in ${clock() - restartBeganAt}ms`);
    const commitmentAfterRestart =
      commitmentId === undefined
        ? undefined
        : await composition2.sharedWorld.meaning.getCommitment(commitmentId);
    if (
      commitmentAfterRestart === undefined ||
      commitmentAfterRestart.status !== 'active' ||
      commitmentAfterRestart.version !== canonicalCommitment.version ||
      JSON.stringify(commitmentAfterRestart.content) !== JSON.stringify(canonicalCommitment.content)
    ) {
      fail('restart did not preserve the confirmed commitment truthfully');
    } else {
      note('restart preserved the confirmed commitment (active, same version, same content bytes)');
    }
    const linksAfterRestart = await composition2.sharedWorld.meaning.listSourceLinks({
      fromRecordId: commitmentId,
    });
    if (
      !linksAfterRestart.some(
        (link) => link.relation === 'source-thread' && link.toRef === threadA.id,
      )
    ) {
      fail('restart did not preserve the record lineage (source-thread link)');
    } else {
      note('restart preserved the record lineage');
    }
    const assemblyEvidenceAfter = await composition2.sharedWorld.getContextAssemblyByTurn(
      t2.turnId,
    );
    if (JSON.stringify(assemblyEvidenceAfter) !== JSON.stringify(assemblyEvidenceBefore)) {
      fail('restart did not preserve the immutable per-turn assembly evidence');
    } else {
      note('restart preserved the per-turn assembly evidence');
    }

    // ---- t4: the genuinely FRESH conversation receives C1 -------------------
    phase = 't4';
    const threadB = await composition2.sharedWorld.createThread({
      title: 'Q6 live fresh continuity',
    });
    const convB = await composition2.sharedWorld.ensureConversationLink(threadB.id);
    // H-1': the fresh-thread restore uses the SAME correct boundary.
    const restoredB = await composition2.restoreThread(threadB.id).catch(() => {
      throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.REPLY_RESTORE, 't4-restore');
    });
    if (restoredB.messages.length !== 0) {
      fail(`the fresh conversation is not transcript-free (${restoredB.messages.length} messages)`);
    }
    const t4 = await runMatrixTurn(
      composition2,
      composition2.sharedWorld,
      threadB.id,
      convB.mastraThreadId,
      QLT_Q6_T4_STATEMENT,
      'q6-live-t4',
      't4 (fresh-conversation continuity)',
    );
    const assemblyB = await composition2.sharedWorld.getContextAssemblyByTurn(t4.turnId);
    if (assemblyB === undefined || assemblyB.outcome !== 'complete') {
      fail('the fresh conversation turn has no complete per-turn assembly');
    } else {
      if (!assemblyB.selectedIds.some((entry) => entry.id === commitmentId)) {
        fail('the fresh conversation C1 snapshot did not select the confirmed commitment');
      } else {
        note(
          `the fresh conversation received the confirmed commitment through C1 (${assemblyB.selectedIds.length} record(s) selected, ${assemblyB.renderedBytes} rendered bytes)`,
        );
      }
      const leakedPending = assemblyB.selectedIds.filter((entry) => pendingIds.has(entry.id));
      if (leakedPending.length > 0) {
        fail(
          `the fresh conversation assembly injected ${leakedPending.length} pending proposal(s) as canonical meaning`,
        );
      } else {
        note('the pending proposals were not injected as canonical meaning');
      }
    }
    canonical = await canonicalTotals(composition2.sharedWorld);
    if (canonical.total !== 1) {
      fail(
        `the canonical record set changed across the fresh conversation (${canonical.total} records)`,
      );
    }

    // ---- t5: hypothetical conflict and negative control ----------------------
    phase = 't5';
    const commitmentBeforeConflict =
      await composition2.sharedWorld.meaning.getCommitment(commitmentId);
    const t5 = await runMatrixTurn(
      composition2,
      composition2.sharedWorld,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T5_STATEMENT,
      'q6-live-t5',
      't5 (hypothetical conflict)',
    );
    const t5Findings = evaluateConflictTurn({
      replyText: t5.reply,
      newProposals: t5.newProposals,
      invocationCount: t5.invocations.length,
    });
    for (const finding of t5Findings) {
      fail(finding);
    }
    const commitmentAfterConflict =
      await composition2.sharedWorld.meaning.getCommitment(commitmentId);
    if (
      commitmentBeforeConflict === undefined ||
      commitmentAfterConflict === undefined ||
      commitmentAfterConflict.version !== commitmentBeforeConflict.version ||
      JSON.stringify(commitmentAfterConflict.content) !==
        JSON.stringify(commitmentBeforeConflict.content) ||
      commitmentAfterConflict.status !== 'active'
    ) {
      fail(
        'the hypothetical silently changed the standing commitment (identity, version, or bytes)',
      );
    } else {
      note(
        'the hypothetical left the standing commitment unchanged (identity, version, bytes) while it stayed available',
      );
    }
    const assemblyConflict = await composition2.sharedWorld.getContextAssemblyByTurn(t5.turnId);
    if (
      assemblyConflict === undefined ||
      !assemblyConflict.selectedIds.some((entry) => entry.id === commitmentId)
    ) {
      fail('the conflict turn assembly did not select the standing commitment');
    } else {
      note('the conflict turn assembly still selected the standing commitment');
    }

    const t6 = await runMatrixTurn(
      composition2,
      composition2.sharedWorld,
      threadB.id,
      convB.mastraThreadId,
      QLT_Q6_T6_STATEMENT,
      'q6-live-t6',
      't6 (transient conversation)',
    );
    for (const finding of evaluateDiscretionaryNegative({
      replyText: t6.reply,
      newProposals: t6.newProposals,
      invocationCount: t6.invocations.length,
      newCanonicalRecords: t6.newCanonical,
    }))
      fail(`t6: ${finding}`);
    const afterTransient = await composition2.sharedWorld.meaning.getCommitment(commitmentId);
    if (JSON.stringify(afterTransient) !== JSON.stringify(commitmentAfterConflict)) {
      fail('t6: the transient conversation changed the canonical commitment');
    }

    // ---- transcript pollution + bounds + in-memory credential surfaces ------
    phase = 'transcript-and-bounds';
    const restoredA = await composition2.restoreThread(threadA.id).catch(() => {
      throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.REPLY_RESTORE, 'transcript-restore');
    });
    const restoredAfterB = await composition2.restoreThread(threadB.id).catch(() => {
      throw new Q6MatrixFailure(QLT_Q6_FAILURE_CODES.REPLY_RESTORE, 'transcript-restore');
    });
    const transcripts = restoredA.messages
      .concat(restoredAfterB.messages)
      .map((message) => message.text)
      .join('\n');
    if (
      transcripts.includes(QLT_CONTEXT_BLOCK_OPEN) ||
      transcripts.includes(QLT_CONTEXT_BLOCK_CLOSE) ||
      transcripts.includes(QLT_CONTEXT_RECORD_CLOSE)
    ) {
      fail('a durable transcript contains context-block bytes (pollution)');
    } else {
      note('both conversation transcripts are free of context-block bytes');
    }
    const canonicalFinal = await canonicalTotals(composition2.sharedWorld);
    if (canonicalFinal.total !== 1) {
      fail(
        `authority violation: ${canonicalFinal.total} canonical records exist (expected exactly 1)`,
      );
    } else {
      note(
        'authority: exactly ONE canonical record exists — created only by the user confirmation',
      );
    }
    const allFramesText = [];
    for (const streamId of [
      t1.streamId,
      t2.streamId,
      t3.streamId,
      t4.streamId,
      t5.streamId,
      t6.streamId,
    ]) {
      if (streamId === undefined) {
        continue;
      }
      const frames = await composition2.stores.streamLedger.listEventsFrom(streamId, 0);
      for (const frame of frames) {
        allFramesText.push(JSON.stringify(frame));
      }
    }
    if (allFramesText.some((frame) => frame.includes(credential))) {
      fail('credential value found in ledger frames — LEAK');
    } else {
      note(`ledger frames scanned (${allFramesText.length} durable frames): credential absent`);
    }
    if (composition2.serializedOperatorConfig.includes(credential)) {
      fail('credential value found in the serialized operator configuration — LEAK');
    }
    if (providerTurnCount > QLT_Q6_LIVE_BOUNDS.maxProviderTurns) {
      fail(
        `provider-turn bound violated: ${providerTurnCount} > ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}`,
      );
    } else {
      note(
        `bounds: ${providerTurnCount} user turns used of the planned six (<= ${QLT_Q6_LIVE_BOUNDS.maxProviderTurns}); one authoritative execution; zero retries; no fallback`,
      );
    }
    phase = 'serialize';
    result = {
      ok: findings.length === 0,
      findings,
      turns: turnRecords,
      fixture: { byteLength: fixture.byteLength },
      providerTurns: providerTurnCount,
    };
    await composition2.close();
    {
      const idx = composed.indexOf(composition2);
      if (idx >= 0) composed.splice(idx, 1);
    }
  } catch (error) {
    // M-2: STABLE, NON-ECHOING findings only. The thrown error's message,
    // stack, cause, or any derived content NEVER enters the evidence.
    if (error instanceof Q6MatrixFailure) {
      fail(`${error.code} (phase: ${error.phase})`);
    } else {
      fail(`${QLT_Q6_FAILURE_CODES.MATRIX} (phase: ${phase})`);
    }
    result = {
      ok: false,
      findings,
      turns: turnRecords,
      fixture: { byteLength: fixture.byteLength },
      providerTurns: providerTurnCount,
    };
  } finally {
    providerObserver?.restore();
    for (const composition of composed.splice(0)) {
      await composition.close().catch(() => undefined);
    }
  }
  result.providerRequests = providerObserver?.records ?? [];
  result.refusedProviderRequests = providerObserver?.refused ?? 0;
  if (result.refusedProviderRequests) {
    fail('QLT_Q6_PROVIDER_REQUEST_BOUND');
    result.ok = false;
  }
  return result;
}
