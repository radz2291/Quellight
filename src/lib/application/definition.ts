import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';

/**
 * QUELLIGHT APPLICATION DEFINITION — author-owned.
 *
 * Quellight is a persistent cognitive partner (long-term). Stage 07B
 * delivers the conversation foundation ONLY: a conversation-first
 * workspace whose durable concern list (Shared World thread records)
 * renders from the Quellight-owned store. Conversation persistence is NOT
 * Shared World continuity; no durable partnership meaning exists in 07B
 * (that is Stage 07C work).
 *
 * The neutral definition is the source of truth for the structured
 * application surface. The live conversation workspace is an explicit
 * versioned custom-component island (APP-014) registered in
 * `src/lib/components/registry.ts`; it receives only its declared props.
 */

/**
 * The Shared World thread record resource (Quellight-owned).
 *
 * `qlt.threads` is backed by the Quellight-owned Shared World store
 * (`shared-world.db`), never by Mastra memory and never by VICT
 * operational stores. Canonical thread state vocabulary is DECLARED
 * CLOSED in 07B: `active` | `dormant`. (`waiting` / `resolved` acquire
 * meaning with later substages and arrive as additive migrations, never
 * semantic overloads.) Retention metadata is present from day one
 * (QLT-019 foundation); the full retention policy engine is a later
 * substage.
 */
export const threadResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'qlt.threads',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'state', type: 'string', required: true, label: 'State' },
    { name: 'retentionState', type: 'string', required: true, label: 'Retention state' },
    { name: 'createdAt', type: 'number', required: true, label: 'Created at' },
    { name: 'updatedAt', type: 'number', required: true, label: 'Updated at' },
  ],
  queries: {
    list: {
      sort: ['updatedAt'],
      filters: ['state'],
      pagination: true,
      projection: ['id', 'title', 'state', 'retentionState', 'createdAt', 'updatedAt'],
    },
  },
  mutations: [
    { op: 'create', effect: 'write', idempotency: 'keyed', permissions: ['qlt.threads.write'] },
    { op: 'rename', effect: 'write', permissions: ['qlt.threads.write'] },
    { op: 'archive', effect: 'write', permissions: ['qlt.threads.write'] },
    { op: 'reopen', effect: 'write', permissions: ['qlt.threads.write'] },
  ],
  authorization: { effect: 'read' },
});

export const application = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.quellight',
  revision: '1',
  name: 'Quellight',
  routes: [
    { id: 'home', path: '/', screenId: 's.workspace', nav: { label: 'Workspace', order: 1 } },
  ],
  screens: [
    {
      id: 's.workspace',
      title: 'Quellight',
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.workspace-hold',
              content:
                'Quellight workspace. The conversation surface arrives with the Stage 07B conversation increment.',
              level: 2,
            },
          ],
        },
      ],
      states: {
        empty: {
          role: 'text',
          id: 't.empty',
          content: 'No conversation yet. Start a thread to begin.',
        },
        denied: {
          role: 'text',
          id: 't.denied',
          content: 'This action was denied by the authorization boundary.',
        },
        failure: {
          role: 'text',
          id: 't.failure',
          content: 'Something failed safely. No partial state is claimed.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.threads',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      fields: ['id', 'title', 'state', 'retentionState', 'createdAt', 'updatedAt'],
    },
  ],
  actions: [
    {
      kind: 'query',
      id: 'act.queryThreads',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.createThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'qlt.threads.create.input',
    },
    {
      kind: 'mutation',
      id: 'act.renameThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'rename',
      inputContractId: 'qlt.threads.rename.input',
    },
    {
      kind: 'mutation',
      id: 'act.archiveThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'archive',
      inputContractId: 'qlt.threads.archive.input',
    },
    {
      kind: 'mutation',
      id: 'act.reopenThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'reopen',
      inputContractId: 'qlt.threads.reopen.input',
    },
  ],
  resources: [{ resourceId: 'qlt.threads', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});

/**
 * The typed mutation input contracts. Conversation content is untrusted
 * data (AI-014): bounded plain strings only, no exotic shapes.
 */
function boundedStringContract(id: string, maxLength: number) {
  return {
    id,
    revision: '1',
    expected: 'bounded plain string input',
    parse: (input: unknown) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return {
          ok: false as const,
          issues: [{ code: 'INVALID', path: 'input', message: 'input must be an object' }],
        };
      }
      const record = input as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
          return {
            ok: false as const,
            issues: [
              {
                code: 'INVALID',
                path: key,
                message: `must be a non-empty string of at most ${maxLength} characters`,
              },
            ],
          };
        }
      }
      return { ok: true as const, value: input };
    },
  };
}

export const inputContracts = [
  boundedStringContract('qlt.threads.create.input', 200),
  boundedStringContract('qlt.threads.rename.input', 200),
  boundedStringContract('qlt.threads.archive.input', 128),
  boundedStringContract('qlt.threads.reopen.input', 128),
] as const;

export const bindings = {
  contracts: inputContracts,
  capabilities: [],
  components: [],
} as const;

/** Compile the neutral definition into the immutable plan. */
export function compileAppPlan(): ApplicationPlan {
  const result = compileApplication({
    application,
    resources: [threadResource],
    contracts: bindings.contracts,
    capabilities: bindings.capabilities,
    components: bindings.components,
  });
  if (!result.ok) {
    throw new Error('The application definition is invalid; see compile diagnostics.');
  }
  return result.plan;
}
