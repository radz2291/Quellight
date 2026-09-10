/**
 * The REAL-browser stop-regression fixture runtime (F-1 permanent
 * regression; loaded by `scripts/browser-stop-check.mjs` in place of
 * `$lib/server/runtime` for that check ONLY).
 *
 * It composes the REAL `createQuellightComposition` with the REAL
 * released-adaptor pipeline and the REAL `/vict` proxy — the ONLY
 * difference from the product runtime is the offline fixture model: a
 * paced text fixture whose stream stays genuinely in flight (one chunk
 * every CHUNK_INTERVAL_MS) long enough for a real browser Stop click to
 * land mid-stream. The paced parts use the exact same Mastra stream-part
 * shapes and the released offline-fixture identity, so the turn is a
 * normal offline-fixture turn in every durable respect.
 *
 * This module is NOT part of the product runtime path: no product route
 * ever loads it outside `verify:stop`.
 */

import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../../src/lib/server/composition';
import {
  OFFLINE_MODEL_ID,
  OFFLINE_MODEL_IDENTITY,
  OFFLINE_MODEL_PROVIDER,
} from '@victframework/mastra';

/** Paced fixture stream geometry: ~2.4 s of genuinely in-flight streaming. */
const CHUNK_INTERVAL_MS = 300;
const FIXTURE_DELTAS = [
  'The stop-regression fixture streams slowly. ',
  'Each chunk is paced so the turn is genuinely in flight. ',
  'A real browser Stop click can land mid-stream. ',
];

function pacedFixtureModel(): unknown {
  const usage = {
    inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 32, text: 32, reasoning: 0 },
  };
  return {
    specificationVersion: 'v2' as const,
    provider: OFFLINE_MODEL_PROVIDER,
    modelId: OFFLINE_MODEL_ID,
    providerModelIdentity: OFFLINE_MODEL_IDENTITY,
    supportedUrls: {},
    async doGenerate(): Promise<{
      content: ReadonlyArray<{ type: 'text'; text: string }>;
      finishReason: 'stop';
      usage: typeof usage;
      warnings: readonly [];
    }> {
      return { content: [{ type: 'text', text: '' }], finishReason: 'stop', usage, warnings: [] };
    },
    doStream(): { stream: ReadableStream<Record<string, unknown>> } {
      let controller: ReadableStreamDefaultController<Record<string, unknown>> | undefined;
      const stream = new ReadableStream<Record<string, unknown>>({
        start(c) {
          controller = c;
        },
      });
      void (async () => {
        const parts: Array<Record<string, unknown>> = [
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: `offline-${OFFLINE_MODEL_ID}`,
            modelId: OFFLINE_MODEL_ID,
            timestamp: new Date(0),
          },
        ];
        FIXTURE_DELTAS.forEach((delta, index) => {
          parts.push({ type: 'text-start', id: `offline-text-1` });
          parts.push({ type: 'text-delta', id: `offline-text-1`, delta });
          parts.push({ type: 'text-end', id: `offline-text-1` });
          void index;
        });
        parts.push({ type: 'finish', finishReason: 'stop', usage });
        try {
          for (const part of parts) {
            await new Promise((resolvePromise) => setTimeout(resolvePromise, CHUNK_INTERVAL_MS));
            controller!.enqueue(part);
          }
          controller!.close();
        } catch {
          /* the consumer went away (cancelled mid-stream) */
        }
      })();
      return { stream };
    },
  };
}

interface QuellightRuntime {
  readonly composition: {
    listen(): Promise<number>;
    close(): Promise<void>;
    victOrigin(): string;
    actorToken(): string;
    [key: string]: unknown;
  };
  readonly port: number;
  victOrigin(): string;
  actorToken(): string;
}

let runtimePromise: Promise<QuellightRuntime> | undefined;

/** Same contract as the product runtime singleton (getQuellightRuntime). */
export function getQuellightRuntime(): Promise<QuellightRuntime> {
  if (runtimePromise === undefined) {
    runtimePromise = (async () => {
      const env = resolveQuellightEnvironment(process.env, process.cwd());
      const composition = await createQuellightComposition({
        env,
        offlineScript: {},
        offlineModelFactory: pacedFixtureModel,
      });
      const port = await composition.listen();
      return {
        composition,
        port,
        victOrigin(): string {
          return `http://127.0.0.1:${port}`;
        },
        actorToken(): string {
          return env.actorToken;
        },
      };
    })().catch((cause: unknown) => {
      runtimePromise = undefined;
      throw cause;
    });
  }
  return runtimePromise;
}
