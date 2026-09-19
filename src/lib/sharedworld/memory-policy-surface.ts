/**
 * The Q5 governed Memory Mode application surface (Lane B).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md and the
 * frozen declarative module `policy-contract.ts` (mode identities,
 * stable codes). This module conforms to that data and contains the ONE
 * declared Memory Mode mutation (`setMode`) — the single effect path for
 * changing the durable global Memory Mode.
 *
 * Authority (freeze §2): the change is USER-attributed (the
 * SERVER-DERIVED local user actor; an `agent-*` identity fails closed)
 * and crosses the released governed boundary (`app.data.mutate` via
 * `/api/act`) with keyed idempotency: same-key retries converge on the
 * original effect; a same-key DIFFERENT payload fails at the released
 * boundary with the established conflict code. There is no second
 * mutation path; the agent envelope contains no mode-change capability.
 */

import type {
  ApplicationDataMutationRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ResourceDefinition } from '@victframework/sdk';
import {
  QLT_MEMORY_MODES,
  QLT_MEMORY_MODE_INVALID,
  QLT_MEMORY_MODE_LABELS,
  QLT_MEMORY_POLICY_FORBIDDEN,
  QLT_MEMORY_POLICY_MUTATION_OPS,
  QLT_MEMORY_POLICY_RESOURCE_ID,
  QLT_MEMORY_POLICY_RESOURCE_REVISION,
} from './policy-contract.js';
import type { MemoryPolicyStore } from './memory-policy.js';
import { QLT_MEMORY_POLICY_WRITE_PERMISSION } from './inspection-contract.js';

/** The Memory Mode resource definition (exactly ONE mutation; no query). */
export const memoryPolicyResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: QLT_MEMORY_POLICY_RESOURCE_ID,
  revision: QLT_MEMORY_POLICY_RESOURCE_REVISION,
  identity: { key: 'policyId' },
  fields: [
    { name: 'policyId', type: 'string', required: true, label: 'Policy' },
    { name: 'mode', type: 'string', required: true, label: 'Mode' },
    { name: 'revision', type: 'number', required: true, label: 'Revision' },
    { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
  ],
  queries: {},
  mutations: QLT_MEMORY_POLICY_MUTATION_OPS.map((op) => ({
    op,
    effect: 'write',
    idempotency: 'keyed',
    permissions: [QLT_MEMORY_POLICY_WRITE_PERMISSION],
  })),
  authorization: { effect: 'read' },
} as unknown as ResourceDefinition;

export interface MemoryPolicySurfaceDeps {
  readonly memoryPolicy: MemoryPolicyStore;
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly userActorId: string;
}

export function createMemoryPolicySurface(deps: MemoryPolicySurfaceDeps): {
  readonly resource: ResourceDefinition;
  mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
} {
  function authorize(
    effect: 'write',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined {
    if (context.effect !== effect) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: 'Access was requested with an effect that does not match the operation.',
      };
    }
    if (!context.permissions.includes(QLT_MEMORY_POLICY_WRITE_PERMISSION)) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${QLT_MEMORY_POLICY_RESOURCE_ID}' requires permission '${QLT_MEMORY_POLICY_WRITE_PERMISSION}'.`,
      };
    }
    return undefined;
  }

  async function mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const denied = authorize('write', context);
    if (denied !== undefined) {
      return denied;
    }
    if (!(QLT_MEMORY_POLICY_MUTATION_OPS as readonly string[]).includes(request.op)) {
      return { ok: false, code: 'DATA_MUTATION_NOT_DECLARED', message: 'Undeclared mutation.' };
    }
    const input = (request.input ?? {}) as Record<string, unknown>;
    const mode = input['mode'];
    // Second fence (the declared contract at the released boundary is the
    // first): the closed vocabulary, non-echoing on rejection.
    if (typeof mode !== 'string' || !(QLT_MEMORY_MODES as readonly string[]).includes(mode)) {
      return {
        ok: false,
        code: QLT_MEMORY_MODE_INVALID,
        message: 'The requested memory mode is outside the closed vocabulary.',
      };
    }
    // The user identity is SERVER-DERIVED (single-actor envelope); an
    // agent identity can never reach this surface through any path.
    if (deps.userActorId.startsWith('agent-')) {
      return {
        ok: false,
        code: QLT_MEMORY_POLICY_FORBIDDEN,
        message: 'A memory-mode change requires a user identity.',
      };
    }
    try {
      const row = deps.memoryPolicy.setMode({
        mode: mode as (typeof QLT_MEMORY_MODES)[number],
        updatedBy: deps.userActorId,
      });
      return {
        ok: true,
        row: {
          policyId: row.policyId,
          mode: row.mode,
          modeLabel: QLT_MEMORY_MODE_LABELS[row.mode],
          revision: row.revision,
          updatedAt: row.updatedAtMs,
        },
      };
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      if (code === QLT_MEMORY_MODE_INVALID || code === QLT_MEMORY_POLICY_FORBIDDEN) {
        return { ok: false, code, message: (cause as Error).message };
      }
      return {
        ok: false,
        code: 'QLT_STORE_ERROR',
        message: 'The memory mode could not be changed; this safe failure is server-generated.',
      };
    }
  }

  return { resource: memoryPolicyResource, mutate };
}
