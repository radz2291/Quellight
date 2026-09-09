import { compileAppPlan, inputContractImplementations } from '$lib/application/definition';
import type { ActionResult } from '@victframework/application';
import { getQuellightRuntime } from './runtime';

/**
 * YOUR APPLICATION SERVER — author-owned.
 *
 * The in-process application server: every non-local action crosses the
 * explicit boundaries BELOW the UI (authorization, contract validation,
 * effect policy, durable storage). The UI cannot grant itself anything.
 *
 * The thread resource is Quellight-owned: its durable store is the
 * Quellight Shared World SQLite store (`shared-world.db`) — never Mastra
 * memory, never a VICT operational store. Mutations cross the typed
 * Application Layer action boundary (DATA-014: contract-validated,
 * authorized, keyed-idempotent).
 */

const GRANTS = ['qlt.threads.read', 'qlt.threads.write'];
const CONTRACTS = new Map(inputContractImplementations.map((contract) => [contract.id, contract]));

export function createAppServer() {
  const plan = compileAppPlan();

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    if (action.kind !== 'query' && action.kind !== 'mutation') {
      return {
        ok: false,
        code: 'UNSUPPORTED_ACTION',
        message: 'This action kind is not composed in this deployment.',
      };
    }
    try {
      const runtime = await getQuellightRuntime();
      const adapter = runtime.composition.sharedWorld.adapter;

      if (action.kind === 'query') {
        const payload = (input ?? {}) as { filters?: Record<string, string> };
        const result = await adapter.query(
          {
            op: 'list',
            resourceId: action.resourceId,
            ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
            sort: [{ field: 'updatedAt', direction: 'desc' }],
          },
          { permissions: GRANTS, effect: 'read' },
        );
        return result.ok
          ? { ok: true, value: result }
          : { ok: false, code: result.code, message: result.message };
      }

      // Mutation: the declared input contract is enforced HERE at the
      // typed boundary (conversation-adjacent input is untrusted data).
      const actionWithContract = action as { inputContractId?: string };
      const contractId = actionWithContract.inputContractId;
      const contract = contractId !== undefined ? CONTRACTS.get(contractId) : undefined;
      if (contract === undefined) {
        return {
          ok: false,
          code: 'CONTRACT_UNDECLARED',
          message: 'The mutation does not declare a resolvable input contract.',
        };
      }
      const payload = (input ?? {}) as Record<string, unknown>;
      const parsed = contract.parse(payload);
      if (!parsed.ok) {
        return {
          ok: false,
          code: 'INPUT_CONTRACT_REJECTED',
          message: 'The input was rejected by the declared contract.',
        };
      }
      const values = parsed.value as Record<string, unknown>;
      if (action.op === 'create' && typeof values['id'] !== 'string') {
        // The Shared World thread identity is server-generated when the
        // client does not supply one.
        values['id'] = `qlt-${crypto.randomUUID()}`;
      }
      const identity = typeof values['id'] === 'string' ? values['id'] : undefined;
      const result = await adapter.mutate(
        {
          resourceId: action.resourceId,
          op: action.op,
          input: values,
          ...(identity !== undefined ? { id: identity } : {}),
          ...(action.op === 'create' && typeof values['idempotencyKey'] === 'string'
            ? { idempotencyKey: values['idempotencyKey'] as string }
            : {}),
        },
        { permissions: GRANTS, effect: 'write' },
      );
      return result.ok
        ? { ok: true, value: result.row }
        : { ok: false, code: result.code, message: result.message };
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
    dispatch,
    loadRoute,
    async close(): Promise<void> {
      const runtime = await getQuellightRuntime();
      await runtime.composition.close();
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
