/**
 * The Quellight runtime singleton: the composition is created ONCE per
 * process on first use (dev, preview, and the built node server all run
 * this module inside the single application process).
 *
 * The loopback VICT boundary is bound on an ephemeral 127.0.0.1 port; the
 * only callers are this process's server-side routes (the /vict proxy and
 * the typed Application Layer boundaries below it).
 */

import { dev } from '$app/environment';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
  type QuellightComposition,
} from './composition';
import { QLT_FIXTURE_TRIGGERS } from '../sharedworld/ceremony-contract';

export interface QuellightRuntime {
  readonly composition: QuellightComposition;
  readonly port: number;
  victOrigin(): string;
  actorToken(): string;
}

let runtimePromise: Promise<QuellightRuntime> | undefined;

/**
 * The Quellight-owned DEFAULT deterministic fixture script for offline
 * mode. The fixture model is keyed by the exact last user text; unmatched
 * inputs produce an empty (truthful, content-free) response. Live mode
 * never consults this script.
 */
const DEFAULT_OFFLINE_FIXTURE_SCRIPT = {
  Hello: {
    kind: 'text',
    text: 'Hello. The offline deterministic fixture is active; no live provider call is made.',
  },
  'Tell me about yourself': {
    kind: 'text',
    text: 'Quellight runs on the VICT runtime with the pinned profile agent.quellight.conversation@3. This reply is the deterministic offline fixture, not a live model.',
  },
  // The frozen Q3 ceremony triggers (freeze §3): one deterministic
  // proposal-draft tool call per fresh conversation — the TEST-1 backbone.
  ...Object.fromEntries(
    QLT_FIXTURE_TRIGGERS.map((trigger) => [
      trigger.userText,
      {
        kind: 'tool-call',
        toolName: trigger.toolName,
        args: trigger.args,
        thenText: trigger.thenText,
      },
    ]),
  ),
} as Record<string, unknown>;

function repoRoot(): string {
  // Dev and `vite preview` run from the repository root; the adapter-node
  // build runs from the project directory. Both give the correct data-dir
  // anchor without trusting absolute operator paths.
  return process.cwd();
}

/** Create (or return) the process-single composition + loopback boundary. */
export function getQuellightRuntime(): Promise<QuellightRuntime> {
  if (runtimePromise === undefined) {
    runtimePromise = (async () => {
      const env = resolveQuellightEnvironment(process.env, repoRoot());
      const composition = await createQuellightComposition({
        env,
        offlineScript: DEFAULT_OFFLINE_FIXTURE_SCRIPT,
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
  void dev; // composition behavior is identical in dev and production.
  return runtimePromise;
}
