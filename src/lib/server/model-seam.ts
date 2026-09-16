/**
 * The Quellight model seam (§8.5, §8.8, §8.10; Phase Q4 D-Q4-1).
 *
 * Three Quellight-owned composition wrappers around model instances:
 *
 * 1. `withTurnDeadline` — enforces the operator-visible turn deadline AT
 *    THE MODEL SEAM: when the deadline expires mid-stream, the stream
 *    fails with a stable safe code (`VICT_AGENT_TURN_FAILED`, the Stage
 *    06A sanitized-failure pattern) and zero raw provider content. The
 *    deadline never fabricates a completion and never produces an
 *    automatic retry.
 *
 * 2. `createLiveProviderModel` — resolves the ONE pinned provider profile
 *    (`ollama-cloud/glm-5.3-flash`) through the pinned Mastra model
 *    router. The factory receives NO credential: the credential is
 *    resolved just in time by the composition through the VICT
 *    protected operator-configuration foundation and injected as the
 *    provider ENVIRONMENT value (`OLLAMA_API_KEY`, the registry's
 *    `apiKeyEnvVar`) that the router resolution path reads by name.
 *
 * 3. `withTurnContextAssembly` (Phase Q4, frozen contract §5/§8) — the
 *    per-turn context-injection seam: for every model call it resolves
 *    the frozen per-turn assembly (server-derived turn identity; the
 *    assembler in `context-assembler.ts`), and — ONLY for a `complete`
 *    outcome — inserts ONE user-role message holding the rendered block
 *    immediately BEFORE the trailing user-role message of the request
 *    prompt. The transformation is call-scoped and non-persistent: the
 *    durable user message, the stored transcript, and every durable row
 *    are untouched; system/developer messages remain structurally
 *    superior. No injection ever happens without a frozen `complete`
 *    assembly, and a failed or ambiguous attribution injects zero records
 *    and lets the turn continue (freeze §6).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { TurnAssemblyScope, TurnStreamResolution } from '../sharedworld/context-assembler';

/**
 * The Quellight-owned async scope installed by the turns route around the
 * turn dispatch: the SERVER-RESOLVED Shared World thread id and Mastra
 * conversation id. The client and the model supply neither value; both
 * derive from durable server records (freeze §8). The detached turn
 * execution inherits this scope, so the model seam can correlate a model
 * call to the conversation without any request payload trust.
 */
const assemblyScopeStorage = new AsyncLocalStorage<TurnAssemblyScope>();

/** Run one turn dispatch inside the assembly correlation scope. */
export function runWithTurnAssemblyScope<T>(scope: TurnAssemblyScope, run: () => T): T {
  return assemblyScopeStorage.run(scope, run);
}

/** Read the current assembly correlation scope (undefined outside turns). */
export function readTurnAssemblyScope(): TurnAssemblyScope | undefined {
  return assemblyScopeStorage.getStore();
}

/** Marker for a deadline-enforced stream failure (message is a fixed string). */
const DEADLINE_MARKER = 'quellight turn deadline exceeded';

interface DeadlineStreamPart {
  readonly type: string;
  readonly error?: unknown;
}

interface DeadlineStreamResult {
  readonly stream: ReadableStream<DeadlineStreamPart>;
  [key: string]: unknown;
}

/**
 * Wrap a model so every doStream call is bounded by `deadlineMs`. The
 * timer starts when the model call begins; on expiry the stream emits
 * one `error` part (which the VICT adapter maps to the stable sanitized
 * failure) and closes — even while no chunk is flowing. Normal failure
 * of the underlying stream propagates; nothing is retried automatically.
 */
export function withTurnDeadline<T extends object>(
  model: T,
  deadlineMs: number,
  clock: () => number = () => Date.now(),
): T {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
    throw new Error('the turn deadline must be a positive safe-integer millisecond bound.');
  }
  const deadlineError = new Error(DEADLINE_MARKER);

  const wrapDoStream = (doStream: (options: unknown) => Promise<DeadlineStreamResult>) => {
    return async (options: unknown): Promise<DeadlineStreamResult> => {
      const startedAt = clock();
      const result = await doStream(options);
      const remainingMs = deadlineMs - (clock() - startedAt);
      if (remainingMs <= 0) {
        // The model call itself exhausted the deadline before a stream
        // was produced: fail immediately with the marker error.
        throw deadlineError;
      }
      const source = result.stream;
      const bounded = new ReadableStream<DeadlineStreamPart>({
        async start(controller) {
          let deadlineHit = false;
          const failOnDeadline = (): void => {
            if (deadlineHit) {
              return;
            }
            deadlineHit = true;
            try {
              controller.enqueue({
                type: 'error',
                error: deadlineError,
              } satisfies DeadlineStreamPart);
              controller.close();
            } catch {
              /* the consumer already went away */
            }
          };
          const timer = setTimeout(failOnDeadline, remainingMs);
          const reader = source.getReader();
          try {
            for (;;) {
              if (clock() - startedAt >= deadlineMs) {
                failOnDeadline();
                if (deadlineHit) {
                  void reader.cancel().catch(() => undefined);
                  return;
                }
              }
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              if (deadlineHit) {
                return;
              }
              controller.enqueue(value);
            }
          } catch (cause) {
            if (!deadlineHit) {
              controller.error(cause);
            }
            return;
          } finally {
            clearTimeout(timer);
          }
          try {
            controller.close();
          } catch {
            /* already closed by the deadline path */
          }
        },
      });
      // Result-shaped wrapper: the result's own fields stay reachable
      // through the prototype chain; `stream` is the bounded override.
      const resultWrapper = Object.create(result) as DeadlineStreamResult;
      Object.defineProperty(resultWrapper, 'stream', {
        value: bounded,
        enumerable: true,
      });
      return resultWrapper;
    };
  };

  // Instance-level shadow: `doStream` is overridden as an own property on
  // the REAL model instance. Every other method keeps the instance as its
  // receiver, so class-private state (`#fields`) keeps working — a
  // prototype-chain WRAPPER object would break private-field access
  // inside Mastra's router classes (TypeError on #lastStreamTransport).
  const source = model as unknown as Record<string, unknown>;
  if (typeof source['doStream'] === 'function') {
    const bounded = wrapDoStream(
      source['doStream'].bind(model) as (options: unknown) => Promise<DeadlineStreamResult>,
    );
    Object.defineProperty(model, 'doStream', {
      value: bounded,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  return model;
}

export interface LiveProviderModelOptions {
  readonly routerModel: string;
  readonly endpointBaseUrl: string;
}

/**
 * The result shape the seam reads from `doStream` options. The prompt is
 * the released model-request message array; every other option field is
 * forwarded untouched through the prototype-chain wrapper below.
 */
interface ContextStreamOptions {
  prompt?: unknown;
  [key: string]: unknown;
}

/** One prompt message of the released model-request shape. */
interface ContextPromptMessage {
  readonly role: unknown;
  readonly content?: unknown;
}

/**
 * Build the injected message for a frozen block: ONE user-role message
 * whose content is ONE text part (frozen `QLT_CONTEXT_INJECTION` shape).
 */
function injectedContextMessage(block: string): ContextPromptMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text: block }],
  };
}

/**
 * Insert the context message immediately BEFORE the trailing user-role
 * message (the real user message stays the LAST user message; the
 * fixture/agent behavior keyed on the last user text is unaffected). If
 * no user-role message exists, the frozen prompt invariant is violated:
 * fail closed by returning the prompt unchanged (zero injection).
 */
function promptWithContext(
  prompt: readonly ContextPromptMessage[],
  block: string,
): ContextPromptMessage[] {
  let trailingUserIndex = -1;
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index]?.role === 'user') {
      trailingUserIndex = index;
      break;
    }
  }
  if (trailingUserIndex < 0) {
    return [...prompt];
  }
  const next = [...prompt];
  next.splice(trailingUserIndex, 0, injectedContextMessage(block));
  return next;
}

/**
 * Wrap a model so every doStream call resolves the frozen per-turn
 * assembly and injects the rendered block as bounded DATA. The wrapper is
 * an instance-level shadow (the same discipline as `withTurnDeadline`):
 * class-private state of the real model keeps working, and the returned
 * value IS the model instance with only `doStream` overridden.
 *
 * Resolution discipline (freeze §6/§8):
 * - no scope (not a conversation turn): pass through untouched;
 * - resolution fails / empty / failed assembly: pass through untouched
 *   (the turn continues with zero Shared World records);
 * - a frozen `complete` assembly: inject exactly the frozen block.
 */
export function withTurnContextAssembly<T extends object>(
  model: T,
  resolve: (scope: TurnAssemblyScope) => Promise<TurnStreamResolution>,
): T {
  const source = model as unknown as Record<string, unknown>;
  if (typeof source['doStream'] !== 'function') {
    return model;
  }
  // Capture the ORIGINAL doStream at wrap time (the deadline seam wraps
  // this seam afterwards, so a call-time property read would recurse).
  const originalDoStream = (source['doStream'] as (boundOptions: unknown) => Promise<unknown>).bind(
    model,
  );
  const wrappedDoStream = async (callOptions: unknown): Promise<unknown> => {
    const options = (callOptions ?? {}) as ContextStreamOptions;
    const scope = readTurnAssemblyScope();
    let nextOptions: ContextStreamOptions = options;
    if (scope !== undefined) {
      let resolution: TurnStreamResolution;
      try {
        resolution = await resolve(scope);
      } catch {
        resolution = { kind: 'pass', reason: 'ambiguous' };
      }
      if (resolution.kind === 'inject') {
        const prompt = Array.isArray(options.prompt)
          ? (options.prompt as ContextPromptMessage[])
          : undefined;
        if (prompt !== undefined) {
          // Call-scoped request transformation: the ORIGINAL options and
          // prompt array are never mutated; the injected message is never
          // persisted anywhere (it exists only in this call).
          nextOptions = Object.create(
            Object.getPrototypeOf(options),
            Object.getOwnPropertyDescriptors(options),
          ) as ContextStreamOptions;
          nextOptions['prompt'] = promptWithContext(prompt, resolution.block);
        }
      }
    }
    return originalDoStream(nextOptions);
  };
  Object.defineProperty(model, 'doStream', {
    value: wrappedDoStream,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return model;
}

/**
 * Resolve the pinned live-provider model through the pinned Mastra model
 * router. Returns a model whose public `provider`/`modelId` identity the
 * VICT adapter records per turn (`providerModelIdentity` metadata only).
 *
 * Credential discipline (§7, §8.5, QLT-016, SEC-003): this factory never
 * receives or embeds a credential. The composition resolves the value
 * through `requireOperatorCredential` and sets it as the provider
 * environment value (`OLLAMA_API_KEY`) that the router reads by its
 * registered env-var name during resolution — never logged, serialized,
 * or persisted.
 */
export function createLiveProviderModel(options: LiveProviderModelOptions): {
  provider: string;
  modelId: string;
  providerModelIdentity?: string;
} {
  const slash = options.routerModel.indexOf('/');
  if (slash <= 0 || slash === options.routerModel.length - 1) {
    throw new Error('the router model must be a provider/model intent string.');
  }
  const providerId = options.routerModel.slice(0, slash);
  const modelId = options.routerModel.slice(slash + 1);
  // ProviderId+modelId ONLY: the pinned @mastra/core registry resolves
  // the provider's endpoint and reads the credential BY VARIABLE NAME
  // from the process environment. Passing an explicit `url` would take
  // the router's custom-endpoint branch, which ignores the env lookup
  // (it builds the request with an empty credential -> Unauthorized).
  // The registry entry for ollama-cloud pins the same endpoint the
  // owner decided (https://ollama.com/v1).
  const model = new ModelRouterLanguageModel({
    providerId,
    modelId,
  });
  void options.endpointBaseUrl;
  return model as unknown as {
    provider: string;
    modelId: string;
    providerModelIdentity?: string;
  };
}
