import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@victframework/sdk';
import { compileApplication } from '@victframework/application';
import type { ApplicationPlan } from '@victframework/application';
import {
  memoryContractRegistry,
  memoryContracts,
  memoryResource,
} from '$lib/sharedworld/ceremony-actions';

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
              role: 'component',
              id: 'sc.workspace',
              componentId: 'qlt.conversation-workspace',
              revision: '1',
              props: {},
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
    {
      viewId: 'v.memory',
      resourceId: 'qlt.memory',
      resourceRevision: '1',
      fields: [
        'id',
        'kind',
        'proposalKind',
        'status',
        'title',
        'text',
        'threadId',
        'turnRef',
        'actor',
        'decisionBy',
        'stale',
        'version',
        'createdAt',
        'updatedAt',
      ],
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
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.renameThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'rename',
      inputContractId: 'qlt.threads.rename.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.archiveThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'archive',
      inputContractId: 'qlt.threads.archive.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.reopenThread',
      revision: '1',
      resourceId: 'qlt.threads',
      resourceRevision: '1',
      op: 'reopen',
      inputContractId: 'qlt.threads.reopen.input',
      inputContractRevision: '1',
    },
    // ---- Stage 07C Phase Q3: the governed Shared World ceremony surface
    // (one bounded resource; every action user-attributed; frozen §3) -----
    {
      kind: 'query',
      id: 'act.queryMemory',
      revision: '1',
      resourceId: 'qlt.memory',
      resourceRevision: '1',
    },
    ...[
      ['act.confirmProposal', 'confirmProposal', 'qlt.memory.confirm.input'],
      ['act.rejectProposal', 'rejectProposal', 'qlt.memory.reject.input'],
      ['act.amendProposal', 'amendProposal', 'qlt.memory.amend.input'],
      ['act.withdrawProposal', 'withdrawProposal', 'qlt.memory.withdraw.input'],
      ['act.createClaim', 'createClaim', 'qlt.memory.claim.input'],
      ['act.createCommitment', 'createCommitment', 'qlt.memory.commitment.input'],
      ['act.createOpenLoop', 'createOpenLoop', 'qlt.memory.loop.input'],
      ['act.correctRecord', 'correctRecord', 'qlt.memory.correct.input'],
      ['act.retireClaim', 'retireClaim', 'qlt.memory.claimExit.input'],
      ['act.releaseCommitment', 'releaseCommitment', 'qlt.memory.commitmentExit.input'],
      ['act.resolveLoop', 'resolveLoop', 'qlt.memory.loopExit.input'],
      ['act.abandonLoop', 'abandonLoop', 'qlt.memory.loopExit.input'],
      ['act.transformLoop', 'transformLoop', 'qlt.memory.loopExit.input'],
    ].map(([id, op, contractId]) => ({
      kind: 'mutation' as const,
      id,
      revision: '1',
      resourceId: 'qlt.memory',
      resourceRevision: '1',
      op,
      inputContractId: contractId,
      inputContractRevision: '1',
    })),
  ],
  resources: [
    { resourceId: 'qlt.threads', revision: '1' },
    { resourceId: 'qlt.memory', revision: '1' },
  ],
  components: [{ componentId: 'qlt.conversation-workspace', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
});

/**
 * The typed mutation input contracts. Conversation-adjacent input is
 * untrusted data (AI-014): CLOSED field sets, bounded plain strings only,
 * no exotic shapes. Each contract is plan-resolved by action id; the
 * released VICT 0.2.0 governed mutation envelope parses the input through
 * the resolved action's declared contract at the boundary (first fence)
 * and the adapter re-validates (second fence).
 */
function closedStringContract(
  id: string,
  fields: Readonly<Record<string, number>>,
  requiredFields: readonly string[],
) {
  return {
    id,
    revision: '1',
    expected: `closed bounded plain-string field set (${Object.keys(fields).join(', ')})`,
    parse: (input: unknown) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return {
          ok: false as const,
          issues: [{ code: 'INVALID', path: '(root)', message: 'input must be a plain object' }],
        };
      }
      const record = input as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        const maxLength = fields[key];
        if (maxLength === undefined) {
          return {
            ok: false as const,
            issues: [{ code: 'INVALID', path: key, message: 'unknown input field' }],
          };
        }
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
      for (const required of requiredFields) {
        if (!(required in record)) {
          return {
            ok: false as const,
            issues: [
              { code: 'INVALID', path: required, message: 'required input field is missing' },
            ],
          };
        }
      }
      return { ok: true as const, value: input };
    },
  };
}

/**
 * The typed mutation input contracts — RUNTIME IMPLEMENTATIONS. These
 * validate untrusted input at the server adapter (AI-014): bounded plain
 * strings only, no exotic shapes. The compiled plan references the same
 * contracts by canonical {id, revision} registry entries (see
 * `inputContractRegistry`); parse functions are NOT part of the neutral
 * definition data.
 */
/** The target identity bound of the thread resource. */
const THREAD_ID_MAX_LENGTH = 128;
/** The title bound of the thread resource. */
const THREAD_TITLE_MAX_LENGTH = 200;

export const inputContractImplementations = [
  // create: the title is required; the target identity may be
  // client-supplied (bounded) or server-generated by the ingress.
  closedStringContract(
    'qlt.threads.create.input',
    { id: THREAD_ID_MAX_LENGTH, title: THREAD_TITLE_MAX_LENGTH },
    ['title'],
  ),
  closedStringContract('qlt.threads.rename.input', { title: THREAD_TITLE_MAX_LENGTH }, ['title']),
  closedStringContract('qlt.threads.archive.input', {}, []),
  closedStringContract('qlt.threads.reopen.input', {}, []),
  // The Q3 ceremony contracts (executable implementations live in the
  // memory surface module; the same frozen field specs).
  ...memoryContracts,
] as const;

/** Canonical contract REGISTRY entries for the compiled plan (data only). */
export const inputContracts = [
  { id: 'qlt.threads.create.input', revision: '1' },
  { id: 'qlt.threads.rename.input', revision: '1' },
  { id: 'qlt.threads.archive.input', revision: '1' },
  { id: 'qlt.threads.reopen.input', revision: '1' },
  ...memoryContractRegistry,
] as const;

export const bindings = {
  contracts: inputContracts,
  capabilities: [],
  components: [{ componentId: 'qlt.conversation-workspace', revision: '1' }],
} as const;

/** Compile the neutral definition into the immutable plan. */
export function compileAppPlan(): ApplicationPlan {
  const result = compileApplication({
    application,
    resources: [threadResource, memoryResource],
    contracts: bindings.contracts,
    capabilities: bindings.capabilities,
    components: bindings.components,
  });
  if (!result.ok) {
    throw new Error('The application definition is invalid; see compile diagnostics.');
  }
  return result.plan;
}

let cachedPlan: ApplicationPlan | undefined;

/**
 * The ONE compiled plan per process (deep-frozen immutable data; the
 * composition and the ingress share this single instance).
 */
export function getCompiledPlan(): ApplicationPlan {
  if (cachedPlan === undefined) {
    cachedPlan = compileAppPlan();
  }
  return cachedPlan;
}
