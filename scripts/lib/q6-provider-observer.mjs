// @ts-nocheck
// Script-only instrumentation, exercised through the installed transport in regression tests.
// Payloads remain in memory. Only closed structural metadata leaves this observer.
import { proposalDraftInputContract } from '../../src/lib/agent/proposal-capability.ts';
import { parseProposalContent } from '../../src/lib/sharedworld/meaning.ts';
import { inspectRawToolArguments } from '../../node_modules/@victframework/mastra/dist/raw-argument-guard.js';
import { isDeepStrictEqual } from 'node:util';
import { a as validateToolInput } from '../../node_modules/@mastra/core/dist/tool-BwroCWv4.js';

const fieldNames = new Set([
  'proposalKind',
  'content',
  'subject',
  'epistemicType',
  'honestyState',
  'confidence',
  'statement',
  'commitmentKey',
  'loopKind',
  'detail',
]);
const safeKeys = (value) =>
  value && typeof value === 'object'
    ? Object.keys(value)
        .map((key) => (fieldNames.has(key) ? key : '<unknown>'))
        .sort()
    : [];
const finishes = new Set(['stop', 'length', 'tool_calls', 'content_filter']);

export function argumentEvidence(raw) {
  const result = { bytes: Buffer.byteLength(raw), json: false };
  try {
    const input = JSON.parse(raw);
    const parsed = proposalDraftInputContract.parse(input);
    let normalized;
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'vict.contract',
        validate(value) {
          normalized = value;
          const parsed = proposalDraftInputContract.parse(value);
          return parsed.ok
            ? { value: parsed.value }
            : { issues: [{ message: 'vict-contract-rejected' }] };
        },
        jsonSchema: {
          input: () => proposalDraftInputContract.descriptiveJsonSchema,
          output: () => ({ type: 'object' }),
        },
      },
    };
    const validated = validateToolInput(schema, input, 'qlt_proposal_draft');
    let guard = 'accepted';
    try {
      inspectRawToolArguments(input);
    } catch {
      guard = 'rejected';
    }
    const kind = ['claim', 'commitment', 'open_loop'].includes(input?.proposalKind)
      ? input.proposalKind
      : 'other';
    Object.assign(result, {
      json: true,
      kind,
      keys: safeKeys(input),
      contentKeys: safeKeys(input?.content),
      guard,
      mastraAccepted: !validated.error,
      normalizationChanged: !isDeepStrictEqual(input, JSON.parse(JSON.stringify(normalized))),
      contractAccepted: parsed.ok,
      domainAccepted: kind !== 'other' && parseProposalContent(kind, input.content).ok,
      issues: parsed.ok
        ? []
        : parsed.issues.map((issue) => ({
            code: /^QLT_[A-Z_]+$/.test(issue.code) ? issue.code : 'rejected',
            path: String(issue.path)
              .split('.')
              .map((key) => (fieldNames.has(key) ? key : '<unknown>'))
              .join('.'),
          })),
    });
  } catch {
    /* malformed JSON: no raw error or payload escapes */
  }
  return result;
}

/** Intercept the exact installed transport; no stream clone, no asynchronous wrapper race. */
export function installProviderObserver({
  transport,
  maxRequests,
  purpose,
  rewrite,
  onArguments,
  maxRequestsPerTurn,
  turnDeadlineMs,
  maxTokens,
  onUpdate,
}) {
  const original = globalThis.fetch;
  const records = [];
  let refused = 0;
  const turns = new Map();
  globalThis.fetch = async (url, init) => {
    if (String(url) !== 'https://ollama.com/v1/chat/completions') {
      throw new Error('QLT_DIAGNOSTIC_UNEXPECTED_NETWORK');
    }
    if (records.length >= maxRequests) {
      refused += 1;
      onUpdate?.(records);
      throw new Error('QLT_DIAGNOSTIC_REQUEST_CAP');
    }
    const body = JSON.parse(init.body);
    const requestPurpose = typeof purpose === 'function' ? purpose() : purpose;
    const turn = turns.get(requestPurpose) ?? { count: 0, started: Date.now() };
    if (
      (maxRequestsPerTurn && turn.count >= maxRequestsPerTurn) ||
      (turnDeadlineMs && Date.now() - turn.started >= turnDeadlineMs) ||
      (maxTokens && (!Number.isSafeInteger(body.max_tokens) || body.max_tokens > maxTokens))
    ) {
      refused += 1;
      onUpdate?.(records);
      throw new Error('QLT_DIAGNOSTIC_TURN_BOUND');
    }
    turn.count += 1;
    turns.set(requestPurpose, turn);
    const originalSchema = proposalDraftInputContract.descriptiveJsonSchema;
    const presented = body.tools?.[0]?.function?.parameters;
    const before = JSON.stringify(body);
    if (rewrite) rewrite(body);
    const record = {
      request: records.length + 1,
      purpose: requestPurpose,
      maxTokens: body.max_tokens,
      reasoningEffort: ['none', 'low', 'medium', 'high'].includes(body.reasoning_effort)
        ? body.reasoning_effort
        : 'omitted',
      toolChoice: body.tool_choice === 'auto' ? 'auto' : 'other',
      toolCount: body.tools?.length ?? 0,
      schemaUnchanged: isDeepStrictEqual(presented, originalSchema),
      rewritten: before !== JSON.stringify(body),
      http: null,
      reasoningBytes: 0,
      contentBytes: 0,
      toolDeltas: 0,
      finish: null,
      done: false,
      arguments: [],
    };
    records.push(record);
    onUpdate?.(records);
    let response;
    let timer;
    let signal = init.signal;
    try {
      const remaining = turnDeadlineMs
        ? Math.max(1, turnDeadlineMs - (Date.now() - turn.started))
        : undefined;
      if (remaining !== undefined) {
        // Keep the deadline controller alive for the entire response body.
        // A temporary AbortSignal.timeout nested in any() can be collected.
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), remaining);
        signal = AbortSignal.any([...(init.signal ? [init.signal] : []), controller.signal]);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            record.aborted = true;
            onUpdate?.(records);
          },
          { once: true },
        );
      }
      response = await (transport ?? original)(url, {
        ...init,
        signal,
        body: JSON.stringify(body),
      });
    } catch {
      clearTimeout(timer);
      record.transportFailed = true;
      onUpdate?.(records);
      throw new Error('QLT_DIAGNOSTIC_TRANSPORT_FAILED');
    }
    record.http = response.status;
    onUpdate?.(records);
    if (!response.ok || !response.body) {
      clearTimeout(timer);
      return response;
    }
    const decoder = new TextDecoder();
    let pending = '';
    const calls = new Map();
    function line(value) {
      if (!value.startsWith('data:')) return;
      const data = value.slice(5).trim();
      if (data === '[DONE]') {
        record.done = true;
        return;
      }
      try {
        const event = JSON.parse(data);
        for (const choice of event.choices ?? []) {
          const delta = choice.delta ?? {};
          record.reasoningBytes += Buffer.byteLength(
            delta.reasoning ?? delta.reasoning_content ?? '',
          );
          record.contentBytes += Buffer.byteLength(delta.content ?? '');
          if (choice.finish_reason)
            record.finish = finishes.has(choice.finish_reason) ? choice.finish_reason : 'other';
          for (const tool of delta.tool_calls ?? []) {
            record.toolDeltas += 1;
            const key = tool.index ?? 0;
            const call = calls.get(key) ?? { name: '', raw: '' };
            call.name += tool.function?.name ?? '';
            call.raw += tool.function?.arguments ?? '';
            calls.set(key, call);
          }
        }
      } catch {
        record.parseFailed = true;
      }
    }
    const stream = response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop();
          for (const value of lines) line(value);
          controller.enqueue(chunk);
        },
        flush() {
          clearTimeout(timer);
          pending += decoder.decode();
          if (pending) line(pending);
          for (const call of calls.values()) {
            record.arguments.push({
              tool: call.name === 'qlt_proposal_draft' ? call.name : 'other',
              ...argumentEvidence(call.raw),
            });
            onArguments?.(call.raw);
          }
          calls.clear();
          pending = '';
          onUpdate?.(records);
        },
      }),
      signal ? { signal } : undefined,
    );
    return new Response(stream, { status: response.status, headers: response.headers });
  };
  return {
    records,
    get refused() {
      return refused;
    },
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function simulatedResponse(kind, suppliedArgs, suppliedText) {
  const args =
    suppliedArgs ??
    (kind === 'invalid'
      ? {
          proposalKind: 'claim',
          content: {
            subject: 'Synthetic',
            statement: 'Synthetic',
            epistemicType: 'preference',
            honestyState: 'certain',
            confidence: 'high',
          },
        }
      : {
          proposalKind: 'claim',
          content: {
            subject: 'Explanation preference',
            epistemicType: 'E2',
            honestyState: 'known',
            confidence: 'stated',
            statement: 'Plain language before technical detail.',
          },
        });
  const deltas =
    kind === 'length'
      ? [{ reasoning: 'Synthetic reasoning only.' }]
      : kind === 'text'
        ? [{ content: suppliedText ?? 'Plain language first, then the details.' }]
        : [
            { reasoning: 'Synthetic reasoning.' },
            {
              tool_calls: [
                {
                  index: 0,
                  id: 'call-probe',
                  type: 'function',
                  function: {
                    name: 'qlt_proposal_draft',
                    arguments: JSON.stringify(args).slice(0, 21),
                  },
                },
              ],
            },
            { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args).slice(21) } }] },
          ];
  const events = deltas.map((delta) => ({
    id: 'synthetic',
    model: 'glm-5.3-flash',
    choices: [{ index: 0, delta, finish_reason: null }],
  }));
  events.push({
    id: 'synthetic',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: kind === 'length' ? 'length' : kind === 'text' ? 'stop' : 'tool_calls',
      },
    ],
  });
  const bytes = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n',
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        // Deliberately split SSE lines and argument JSON at transport boundaries.
        for (let offset = 0; offset < bytes.length; offset += 17)
          controller.enqueue(bytes.slice(offset, offset + 17));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
