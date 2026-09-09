import { createInMemoryApplicationData } from '@victframework/application';
import type { ApplicationDataAdapter, ActionResult } from '@victframework/application';
import { compileAppPlan, inputContracts, threadResource } from '$lib/application/definition';

/**
 * YOUR APPLICATION SERVER — author-owned.
 *
 * The in-process application server: every non-local action crosses the
 * explicit boundaries BELOW the UI (authorization, contract validation,
 * effect policy, durable storage). The UI cannot grant itself anything.
 *
 * Stage 07B note: this module is the composition seam. The thread resource
 * is Quellight-owned; this revision bridges it with the in-memory
 * reference adapter ONLY until the Quellight Shared World SQLite store
 * lands in the same Stage 07B increment (the store is Quellight-owned,
 * never Mastra memory, never a VICT operational store).
 */

/** The authorization profile of this deployment (server-side only). */
const grants = ['qlt.threads.read', 'qlt.threads.write'];

export function createAppServer() {
  const plan = compileAppPlan();
  const data: ApplicationDataAdapter = createInMemoryApplicationData([threadResource], {
    id: 'quellight.shell',
    revision: '1',
    contracts: [...inputContracts],
  });

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    try {
      if (action.kind === 'query') {
        const payload = (input ?? {}) as {
          filters?: Record<string, string>;
          search?: { text: string; fields: string[] };
          sort?: { field: string; direction: 'asc' | 'desc' }[];
          limit?: number;
          offset?: number;
        };
        const result = await data.query(
          {
            op: 'list',
            resourceId: action.resourceId,
            ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
            ...(payload.search !== undefined ? { search: payload.search } : {}),
            ...(payload.sort !== undefined ? { sort: payload.sort } : {}),
            ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
            ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
          },
          { permissions: grants, effect: 'read' },
        );
        return result.ok
          ? { ok: true, value: result }
          : { ok: false, code: result.code, message: result.message };
      }
      if (action.kind === 'mutation') {
        const payload = (input ?? {}) as { id?: string; [key: string]: unknown };
        const identity =
          typeof payload.id === 'string'
            ? payload.id
            : typeof payload.__identity === 'string'
              ? payload.__identity
              : undefined;
        const result = await data.mutate(
          {
            resourceId: action.resourceId,
            op: action.op,
            input: payload,
            ...(identity !== undefined ? { id: identity } : {}),
            ...(action.op === 'create' && typeof payload.id === 'string'
              ? { idempotencyKey: `create:${payload.id}` }
              : {}),
          },
          { permissions: grants, effect: 'write' },
        );
        return result.ok
          ? { ok: true, value: result.row }
          : { ok: false, code: result.code, message: result.message };
      }
      return {
        ok: false,
        code: 'UNSUPPORTED_ACTION',
        message: 'This action kind is not wired in this shell.',
      };
    } catch {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The action could not be completed; this safe failure is server-generated.',
      };
    }
  }

  function loadRoute(path: string) {
    const route = plan.routes.find((entry) => entry.route.path === path);
    if (route === undefined) {
      return null;
    }
    return route;
  }

  return {
    plan,
    data,
    dispatch,
    loadRoute,
    async close(): Promise<void> {
      (data as { close?: () => void }).close?.();
    },
  };
}

let server: ReturnType<typeof createAppServer> | undefined;

export function getAppServer() {
  if (server === undefined) {
    server = createAppServer();
  }
  return server;
}
