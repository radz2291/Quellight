import { getCompiledPlan } from '$lib/application/definition';
import { createHash } from 'node:crypto';
import type { ActionResult } from '@victframework/application';
import { VictControlError } from '@victframework/runtime';
import { getQuellightRuntime, type QuellightRuntime } from './runtime';

/**
 * YOUR APPLICATION SERVER — author-owned. Stage 07C Phase Q1: the ingress
 * is a THIN TRANSPORT boundary. It no longer dispatches effects itself:
 *
 * - it resolves the declared action from the ONE compiled plan (routing
 *   only — the authoritative action resolution happens again, plan-based,
 *   inside the released VICT 0.2.0 mutation boundary);
 * - it parses the DECLARED request (closed field set per action);
 * - it invokes the released `app.data.query` / `app.data.mutate` command
 *   boundary (durable claim/lease/fenced idempotency; server-derived
 *   actor; plan-resolved action identity; contract-fenced input);
 * - it translates governed results into truthful HTTP responses.
 *
 * It writes no SQLite directly, never calls an adapter through a parallel
 * shortcut, invents no undeclared mutation fields, selects no input
 * schema outside the compiled plan, uses no ambient mutable state as
 * mutation input, and performs no effect not declared in the Application
 * Definition. The historical Stage 07B direct-adapter accommodation is
 * retired (decision register D-9; released `vict-release-set@1/0.2.0`).
 */

/** The closed ingress request contract for one declared action. */
interface IngressActionSpec {
  /** Accepted request-input fields and their bounds (product-owned schema). */
  readonly fields: Readonly<Record<string, number>>;
  readonly required: readonly string[];
  /** Whether the request must carry a stable idempotency key. */
  readonly idempotencyRequired: true;
}

/**
 * The declared ingress request schemas — Quellight-owned product schemas
 * (never added to VICT). The target identity (`id`) is a resource field;
 * every other field flows into the contract-validated envelope input.
 */
const INGRESS_ACTIONS: Readonly<Record<string, IngressActionSpec>> = {
  'act.createThread': {
    fields: { id: 128, title: 200 },
    required: ['title'],
    idempotencyRequired: true,
  },
  'act.renameThread': {
    fields: { id: 128, title: 200 },
    required: ['id', 'title'],
    idempotencyRequired: true,
  },
  'act.archiveThread': { fields: { id: 128 }, required: ['id'], idempotencyRequired: true },
  'act.reopenThread': { fields: { id: 128 }, required: ['id'], idempotencyRequired: true },
};

/** The bounded idempotency-key shape (same closed pattern as VICT). */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * A DETERMINISTIC server-generated thread identity for a keyed create:
 * the same idempotency key always yields the same identity, so an
 * identical retry reconciles (command digest and adapter key) instead of
 * creating a second row.
 */
function toStableId(releaseVersion: string, idempotencyKey: string): string {
  return createHash('sha256')
    .update(`${releaseVersion}\u0000${idempotencyKey}`)
    .digest('hex')
    .slice(0, 24);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The target thread identity: bounded safe identifier. */
function parseTargetId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    return undefined;
  }
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : undefined;
}

/**
 * Create the application server. `resolveRuntime` injects the runtime for
 * isolated tests; the production ingress resolves the process-single
 * composition (the only caller of the default).
 */
export function createAppServer(
  resolveRuntime: () => Promise<Pick<QuellightRuntime, 'composition'>> = () =>
    getQuellightRuntime(),
) {
  const plan = getCompiledPlan();

  async function dispatch(
    actionId: string,
    input?: unknown,
    idempotencyKey?: unknown,
  ): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    try {
      const runtime = await resolveRuntime();
      const composition = runtime.composition;
      // The local actor is resolved SERVER-SIDE (single-actor envelope);
      // the browser never supplies or holds an identity.
      const actor = { ...composition.actor, presentedTokenKind: 'local-test' as const };

      if (action.kind === 'query') {
        // Thin transport for the declared read: closed request parse
        // (filters only), then the released app.data.query command. The
        // recency ordering is the declared query policy of the view.
        if (input !== undefined && !isPlainObject(input)) {
          return { ok: false, code: 'INVALID_REQUEST', message: 'The input must be an object.' };
        }
        const requestInput = (input ?? {}) as Record<string, unknown>;
        for (const key of Object.keys(requestInput)) {
          if (key !== 'filters') {
            return {
              ok: false,
              code: 'INVALID_REQUEST',
              message: 'The query request declares an unknown field.',
            };
          }
        }
        let filters: Record<string, string> | undefined;
        if (requestInput['filters'] !== undefined) {
          if (!isPlainObject(requestInput['filters'])) {
            return {
              ok: false,
              code: 'INVALID_REQUEST',
              message: 'The filter container must be a plain object.',
            };
          }
          filters = {};
          for (const [key, value] of Object.entries(
            requestInput['filters'] as Record<string, unknown>,
          )) {
            if (typeof key !== 'string' || key.length === 0 || key.length > 128) {
              return {
                ok: false,
                code: 'INVALID_REQUEST',
                message: 'The filter field must be a bounded identifier.',
              };
            }
            if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
              return {
                ok: false,
                code: 'INVALID_REQUEST',
                message: 'The filter value must be a bounded string.',
              };
            }
            filters[key] = value;
          }
        }
        const outcome = await composition.commandService.dispatch(actor, {
          command: 'app.data.query',
          payload: {
            resourceId: action.resourceId,
            releaseVersion: composition.releaseVersion,
            ...(filters !== undefined ? { filters } : {}),
          },
        });
        if (!outcome.ok) {
          return { ok: false, code: outcome.code, message: 'The query was not permitted.' };
        }
        const result = (outcome.data as { result?: { ok: boolean } }).result;
        if (result === undefined) {
          return {
            ok: false,
            code: 'ACTION_FAILED',
            message: 'The action could not be completed; this safe failure is server-generated.',
          };
        }
        return result.ok
          ? { ok: true, value: result }
          : {
              ok: false,
              code: (result as { code?: string }).code ?? 'ACTION_FAILED',
              message: (result as { message?: string }).message ?? 'The query was rejected.',
            };
      }

      if (action.kind !== 'mutation') {
        return {
          ok: false,
          code: 'UNSUPPORTED_ACTION',
          message: 'This action kind is not composed in this deployment.',
        };
      }

      // ---- Mutation: parse the DECLARED request --------------------------
      // Every mutation requires a stable idempotency key (one logical
      // action, one key across retries). The payload is built ONLY from
      // the parsed request and compiled-plan constants — never from
      // ambient mutable state.
      if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
        return {
          ok: false,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'A bounded idempotency key is required for every mutation (per logical action).',
        };
      }
      if (!isPlainObject(input)) {
        return { ok: false, code: 'INVALID_REQUEST', message: 'The input must be an object.' };
      }
      const requestInput = input as Record<string, unknown>;
      const spec = INGRESS_ACTIONS[actionId];
      if (spec === undefined) {
        return {
          ok: false,
          code: 'UNSUPPORTED_ACTION',
          message: 'This action is not composed in this deployment.',
        };
      }
      for (const key of Object.keys(requestInput)) {
        if (spec.fields[key] === undefined) {
          return {
            ok: false,
            code: 'INVALID_REQUEST',
            message: 'The mutation request declares an unknown field.',
          };
        }
      }
      for (const required of spec.required) {
        if (requestInput[required] === undefined) {
          return {
            ok: false,
            code: 'INVALID_REQUEST',
            message: 'A required input field is missing.',
          };
        }
      }
      const bounded = (value: unknown, max: number): string | undefined =>
        typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined;

      // Target identity: for create, the client MAY supply a bounded id
      // (Stage 07B behavior); otherwise the server generates one
      // DETERMINISTICALLY from the idempotency key, so an identical retry
      // carries the identical payload (command-level replay stays
      // reconcilable). For rename/archive/reopen the target id is
      // required.
      let targetId: string | undefined;
      if (action.op === 'create') {
        const supplied = bounded(requestInput['id'], 128);
        targetId =
          supplied !== undefined && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(supplied)
            ? supplied
            : `qlt-${toStableId(composition.releaseVersion, idempotencyKey)}`;
      } else {
        targetId = parseTargetId(requestInput['id']);
        if (targetId === undefined) {
          return {
            ok: false,
            code: 'INVALID_REQUEST',
            message: 'A bounded target thread id is required.',
          };
        }
      }

      // The envelope input carries ONLY the declared contract fields
      // (never the target identity for non-create mutations, which
      // crosses the envelope's `id` field).
      const envelopeInput: Record<string, unknown> =
        action.op === 'create'
          ? { id: targetId, title: bounded(requestInput['title'], 200) ?? '' }
          : action.op === 'rename'
            ? { title: bounded(requestInput['title'], 200) ?? '' }
            : {};

      const outcome = await composition.commandService.dispatch(actor, {
        command: 'app.data.mutate',
        payload: {
          resourceId: action.resourceId,
          releaseVersion: composition.releaseVersion,
          expectedRevision: action.resourceRevision,
          actionKind: 'mutation',
          actionId,
          expectedActionRevision: action.revision,
          mutation: {
            op: action.op,
            id: targetId,
            input: envelopeInput,
            idempotencyKey,
          },
        },
        idempotencyKey,
      });
      if (!outcome.ok) {
        return { ok: false, code: outcome.code, message: 'The mutation was not permitted.' };
      }
      const result = (outcome.data as { result?: { ok: boolean } }).result;
      if (result === undefined) {
        // A replayed durable receipt (identical retry): the released safe
        // projection carries identifiers only — a truthful replay with no
        // fabricated row and no second effect.
        return { ok: true, value: { replayed: true } };
      }
      return result.ok
        ? { ok: true, value: (result as { row?: unknown }).row }
        : {
            ok: false,
            code: (result as { code?: string }).code ?? 'ACTION_FAILED',
            message: (result as { message?: string }).message ?? 'The mutation was rejected.',
          };
    } catch (cause) {
      if (cause instanceof VictControlError) {
        return { ok: false, code: cause.code, message: 'The action was denied by the boundary.' };
      }
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
      const runtime = await resolveRuntime();
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
