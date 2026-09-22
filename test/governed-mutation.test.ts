import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { authenticatedActorContext, type ActorRecord } from '@victframework/runtime';
import {
  MUTATION_ENVELOPE_FIELDS,
  MUTATION_ENVELOPE_OP_MAX_LENGTH,
  MUTATION_ENVELOPE_ID_MAX_LENGTH,
  MUTATION_ENVELOPE_IDEMPOTENCY_KEY_MAX_LENGTH,
  MUTATION_INPUT_MAX_DEPTH,
  MUTATION_INPUT_MAX_BYTES,
  MUTATION_INPUT_MAX_ARRAY_LENGTH,
  MUTATION_INPUT_MAX_KEY_LENGTH,
  remoteMutate,
} from '@victframework/server';
import {
  CONTENT_ID,
  EXPECTED_VERSION,
  RELEASE_IDENTITY,
  RELEASE_SET_MEMBERS,
  checkReleaseSetCompatibility,
  deriveContentId,
} from '../scripts/lib/release-set.mjs';
import { getCompiledPlan } from '../src/lib/application/definition';
import { createAppServer } from '../src/lib/server/application-server';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
  APPLICATION_RELEASE_VERSION,
} from '../src/lib/server/composition';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-governed-'));
  tempDirs.push(dir);
  return dir;
};

const composed: Array<{ close(): Promise<void> }> = [];

afterEach(() => {
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
});
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

/** An isolated composition for one test (fresh data dir; no listener). */
async function compose(script: Record<string, unknown> = {}) {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR: 'data',
      QUELLIGHT_ACTOR_TOKEN: `governed-token-${crypto.randomUUID()}`,
    },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    offlineScript: script,
    skipListen: true,
  });
  composed.push(composition);
  return composition;
}

function actorOf(composition: Awaited<ReturnType<typeof compose>>) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

/** Count the governed rows in the composition's Shared World store. */
function threadRowCount(composition: Awaited<ReturnType<typeof compose>>): number {
  const db = new DatabaseSync(join(composition.dataDir, 'shared-world.db'), { readOnly: true });
  try {
    const row = db.prepare('SELECT COUNT(*) AS total FROM qlt_thread;').get() as { total: number };
    return row.total;
  } finally {
    db.close();
  }
}

function adapterKeyCount(composition: Awaited<ReturnType<typeof compose>>): number {
  const db = new DatabaseSync(join(composition.dataDir, 'shared-world.db'), { readOnly: true });
  try {
    const row = db.prepare('SELECT COUNT(*) AS total FROM qlt_adapter_idempotency;').get() as {
      total: number;
    };
    return row.total;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Adoption gates
// ---------------------------------------------------------------------------

describe('VICT 0.2.0 adoption gates (permanent)', () => {
  const require = createRequire(import.meta.url);

  it('every installed @victframework package resolves at exactly 0.2.0 (no 0.1.x residue)', () => {
    const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const installed: [string, string][] = Object.entries(
      lockfile.packages as Record<string, { version: string }>,
    )
      .filter(([key]) => key.startsWith('node_modules/@victframework/'))
      .map(([key, entry]) => [key.replace('node_modules/', ''), entry.version] as [string, string]);
    expect(installed.length).toBeGreaterThanOrEqual(10);
    for (const [name, version] of installed) {
      // The installed manifest is read from the package directory (the
      // released packages do not export './package.json').
      const entry = require.resolve(name);
      const real = entry.replace(/\\/g, '/');
      const marker = `/node_modules/${name}/`;
      const packageDir = real.slice(0, real.indexOf(marker) + marker.length - 1);
      const manifest = JSON.parse(readFileSync(`${packageDir}/package.json`, 'utf8')) as {
        version: string;
      };
      expect(version, name).toBe(EXPECTED_VERSION);
      expect(manifest.version, `${name} installed manifest`).toBe(EXPECTED_VERSION);
    }
  });

  it('the lockfile resolves every dependency from the public registry with integrity (no local checkout)', () => {
    const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const text = JSON.stringify(lockfile);
    for (const forbidden of ['workspace:', 'file:', 'link:', 'git+', 'git://', 'github:']) {
      expect(text.includes(forbidden), forbidden).toBe(false);
    }
    for (const [key, entry] of Object.entries(
      lockfile.packages as Record<string, { resolved?: string; integrity?: string }>,
    )) {
      if (key.startsWith('node_modules/@victframework/')) {
        expect(entry.resolved?.startsWith('https://registry.npmjs.org/'), key).toBe(true);
        expect(entry.integrity?.startsWith('sha512-'), `${key} integrity`).toBe(true);
      }
    }
  });

  it('every @victframework realpath resolves inside Quellight node_modules (never the VICT checkout)', () => {
    for (const name of [
      '@victframework/server',
      '@victframework/application',
      '@victframework/runtime',
      '@victframework/mastra',
      '@victframework/sdk',
      '@victframework/contracts',
      '@victframework/control',
      '@victframework/store-sqlite',
      '@victframework/scaffolder',
      '@victframework/renderer-svelte',
      '@victframework/kernel',
    ]) {
      const entry = require.resolve(name);
      const real = entry.replace(/\\/g, '/');
      expect(real.includes('/260909-VCT-Quellight/node_modules/'), real).toBe(true);
      expect(real.includes('/260831-VCT-02/'), real).toBe(false);
      expect(real.includes('/packages/server/src/'), real).toBe(false);
    }
  });

  it('the compatibility gate passes for the adopted graph and FAILS a mixed 0.1.x/0.2.0 set', () => {
    const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const declared = new Map(
      Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies }).filter(
        ([name]) => name.startsWith('@victframework/'),
      ) as [string, string][],
    );
    const installed = new Map<string, string>();
    for (const [key, entry] of Object.entries(
      lockfile.packages as Record<string, { version: string }>,
    )) {
      if (key.startsWith('node_modules/@victframework/')) {
        installed.set(key.replace('node_modules/', ''), entry.version);
      }
    }
    // The adopted graph passes with zero findings.
    expect(checkReleaseSetCompatibility({ declared, resolved: installed })).toEqual([]);
    // A mixed set (one member still 0.1.1) FAILS the gate.
    const mixed = new Map(installed);
    mixed.set('@victframework/contracts', '0.1.1');
    const findings = checkReleaseSetCompatibility({ declared, resolved: mixed });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.join('\n')).toMatch(/mixed release set|content identity/);
  });

  it('the recorded content identity is the sha256 of the sorted 13-member name@version list', () => {
    const versions = new Map(RELEASE_SET_MEMBERS.map((name) => [name, EXPECTED_VERSION]));
    expect(deriveContentId(versions)).toBe(CONTENT_ID);
    expect(RELEASE_IDENTITY).toBe('vict-release-set@1/0.3.1');
  });

  it('the released audited mutation boundary is genuinely installed (public server package)', () => {
    // Closed bound constants exported from the audited 0.2.0 boundary.
    expect(MUTATION_ENVELOPE_FIELDS).toEqual(['op', 'id', 'input', 'idempotencyKey']);
    expect(MUTATION_INPUT_MAX_BYTES).toBe(64 * 1024);
    expect(MUTATION_ENVELOPE_OP_MAX_LENGTH).toBe(32);
    expect(MUTATION_ENVELOPE_ID_MAX_LENGTH).toBe(128);
    expect(MUTATION_ENVELOPE_IDEMPOTENCY_KEY_MAX_LENGTH).toBe(128);
    expect(MUTATION_INPUT_MAX_DEPTH).toBe(8);
    expect(MUTATION_INPUT_MAX_ARRAY_LENGTH).toBe(1000);
    expect(MUTATION_INPUT_MAX_KEY_LENGTH).toBe(128);
  });
});

// ---------------------------------------------------------------------------
// The governed path (positive behavior)
// ---------------------------------------------------------------------------

describe('governed mutation path — /api/act → app.data.mutate (0.2.0 boundary)', () => {
  /** The route-shaped app server over ONE isolated composition. */
  async function isolatedApp(script: Record<string, unknown> = {}) {
    const composition = await compose(script);
    const app = createAppServer(async () => ({ composition }));
    return { composition, app };
  }

  it('act.queryThreads crosses the released app.data.query command and keeps the UI shape', async () => {
    const { composition, app } = await isolatedApp({});
    await composition.sharedWorld.createThread({ title: 'Listed by the query' });
    const result = await app.dispatch('act.queryThreads', {});
    expect(result.ok).toBe(true);
    const value = (result as { value: { ok: boolean; rows: unknown[]; total: number } }).value;
    expect(value.ok).toBe(true);
    expect(value.rows.length).toBe(1);
    expect((value.rows[0] as { title: string }).title).toBe('Listed by the query');
    expect(value.total).toBe(1);
  });

  it('act.createThread reaches the adapter exactly once with the exact declared fields', async () => {
    const { composition, app } = await isolatedApp({});
    const key = `create-${crypto.randomUUID()}`;
    const result = await app.dispatch('act.createThread', { title: 'Governed create' }, key);
    expect(result.ok).toBe(true);
    const row = (result as { value: Record<string, unknown> }).value;
    expect(typeof row['id']).toBe('string');
    expect(row['title']).toBe('Governed create');
    expect(row['state']).toBe('active');
    expect(row['retentionState']).toBe('currently-relevant');
    // The full record (including provenance) is in the store.
    const stored = await composition.sharedWorld.getThread(row['id'] as string);
    expect(stored?.provenance).toBe('user');
    // Exactly one SQLite effect, and the domain idempotency key is
    // recorded in the same store as the row it guards.
    expect(threadRowCount(composition)).toBe(1);
    expect(adapterKeyCount(composition)).toBe(1);
    // The durable command receipt attributes the dispatch (provenance).
    const receipt = await composition.stores.commandIdempotency.getReceipt({
      actorId: composition.actorId,
      command: 'app.data.mutate',
      idempotencyKey: key,
    });
    expect(receipt?.status).toBe('completed');
    expect(receipt?.command).toBe('app.data.mutate');
  });

  it('act.renameThread, act.archiveThread, and act.reopenThread follow the declared path', async () => {
    const { composition, app } = await isolatedApp({});
    const created = await app.dispatch(
      'act.createThread',
      { title: 'Lifecycle thread' },
      `create-${crypto.randomUUID()}`,
    );
    expect(created.ok).toBe(true);
    const id = (created as { value: { id: string } }).value.id;

    const renamed = await app.dispatch(
      'act.renameThread',
      { id, title: 'Renamed governed thread' },
      `rename-${crypto.randomUUID()}`,
    );
    expect(renamed.ok).toBe(true);
    expect((renamed as { value: { title: string } }).value.title).toBe('Renamed governed thread');

    const archived = await app.dispatch(
      'act.archiveThread',
      { id },
      `archive-${crypto.randomUUID()}`,
    );
    expect(archived.ok).toBe(true);
    expect((archived as { value: { state: string } }).value.state).toBe('dormant');
    const stored = await composition.sharedWorld.getThread(id);
    expect(stored?.state).toBe('dormant');

    // A dormant thread is read-only: rename is refused with no effect.
    const before = await composition.sharedWorld.getThread(id);
    const denied = await app.dispatch(
      'act.renameThread',
      { id, title: 'nope' },
      `rename-denied-${crypto.randomUUID()}`,
    );
    expect(denied.ok).toBe(false);
    expect((denied as { code: string }).code).toBe('DATA_INVALID_REQUEST');
    const afterDenial = await composition.sharedWorld.getThread(id);
    expect(afterDenial?.title).toBe(before?.title);
    expect(afterDenial?.updatedAtMs).toBe(before?.updatedAtMs);

    const reopened = await app.dispatch(
      'act.reopenThread',
      { id },
      `reopen-${crypto.randomUUID()}`,
    );
    expect(reopened.ok).toBe(true);
    expect((reopened as { value: { state: string } }).value.state).toBe('active');

    // An active thread accepts renames again (recovered lifecycle).
    const renamedAgain = await app.dispatch(
      'act.renameThread',
      { id, title: 'Reopened and renamed' },
      `rename-after-reopen-${crypto.randomUUID()}`,
    );
    expect(renamedAgain.ok).toBe(true);
    expect((renamedAgain as { value: { title: string } }).value.title).toBe('Reopened and renamed');
  });

  it('the complete mutation request reaches the adapter value-for-value (direct governed boundary)', async () => {
    const composition = await compose({});
    const title = 'Value-for-value thread';
    const id = 'qlt-governed-vfv';
    const result = await composition.commandService.dispatch(actorOf(composition), {
      command: 'app.data.mutate',
      payload: {
        resourceId: 'qlt.threads',
        releaseVersion: APPLICATION_RELEASE_VERSION,
        expectedRevision: '1',
        actionKind: 'mutation',
        actionId: 'act.createThread',
        expectedActionRevision: '1',
        mutation: {
          op: 'create',
          id,
          input: { id, title },
          idempotencyKey: 'vfv-key-1',
        },
      },
      idempotencyKey: 'vfv-command-key-1',
    });
    expect(result.ok).toBe(true);
    const adapterResult = (
      result as unknown as { data: { result: { ok: boolean; row?: Record<string, unknown> } } }
    ).data.result;
    expect(adapterResult.ok).toBe(true);
    expect(adapterResult.row?.['id']).toBe(id);
    expect(adapterResult.row?.['title']).toBe(title);
    expect(adapterResult.row?.['state']).toBe('active');
  });

  it('identity-only app.data.query remains truthful through the governed boundary (07B compatibility)', async () => {
    const composition = await compose({});
    await composition.sharedWorld.createThread({ title: 'Query compat thread' });
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'app.data.query',
      payload: { resourceId: 'qlt.threads', releaseVersion: APPLICATION_RELEASE_VERSION },
    });
    expect(outcome.ok).toBe(true);
    const result = (outcome as unknown as { data: { result: { ok: boolean; total: number } } }).data
      .result;
    expect(result.ok).toBe(true);
    expect(result.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Negative controls (every pre-handler failure: zero adapter call, zero effect)
// ---------------------------------------------------------------------------

describe('governed mutation negative controls', () => {
  /** The route-shaped app server over ONE isolated composition. */
  async function isolatedApp(script: Record<string, unknown> = {}) {
    const composition = await compose(script);
    const app = createAppServer(async () => ({ composition }));
    return { composition, app };
  }

  async function expectNoEffect(
    composition: Awaited<ReturnType<typeof compose>>,
    run: () => Promise<unknown>,
  ): Promise<void> {
    const rowsBefore = threadRowCount(composition);
    const keysBefore = adapterKeyCount(composition);
    await run();
    expect(threadRowCount(composition)).toBe(rowsBefore);
    expect(adapterKeyCount(composition)).toBe(keysBefore);
  }

  it('unknown route action → UNKNOWN_ACTION (zero effects)', async () => {
    const { composition, app } = await isolatedApp({});
    await expectNoEffect(composition, async () => {
      const result = await app.dispatch('act.doesNotExist', {});
      expect(result.ok).toBe(false);
      expect((result as { code: string }).code).toBe('UNKNOWN_ACTION');
    });
  });

  it('undeclared application action at the released boundary → VICT_APPDATA_ACTION_UNRESOLVED', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.undeclaredAction',
            mutation: { op: 'create', id: 'qlt-x', input: { title: 'x' }, idempotencyKey: 'k' },
          },
          idempotencyKey: `neg-undeclared-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_ACTION_UNRESOLVED' });
    });
  });

  it('unknown command payload field and unknown envelope field fail closed (non-echoing)', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            ambientField: 'smuggled',
            mutation: { op: 'create', id: 'qlt-x', input: { title: 'x' }, idempotencyKey: 'k' },
          },
          idempotencyKey: `neg-cmdfield-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_COMMAND_PAYLOAD_INVALID' });
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            mutation: {
              op: 'create',
              id: 'qlt-x',
              input: { title: 'x' },
              idempotencyKey: 'k',
              smuggled: true,
            },
          },
          idempotencyKey: `neg-envfield-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_COMMAND_PAYLOAD_INVALID' });
    });
  });

  it('unknown input field → contract rejection at the first fence (zero effects, non-echoing)', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            mutation: {
              op: 'create',
              id: 'qlt-neg-uf',
              input: { title: 'ok title', injectedField: 'hostile' },
              idempotencyKey: 'neg-uf-1',
            },
          },
          idempotencyKey: `neg-unknown-input-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
    });
  });

  it('missing required input and contract-invalid input fail closed', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            mutation: {
              op: 'create',
              id: 'qlt-neg-mi',
              input: { id: 'qlt-neg-mi' },
              idempotencyKey: 'neg-mi-1',
            },
          },
          idempotencyKey: `neg-missing-input-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.renameThread',
            mutation: {
              op: 'rename',
              id: 'some-thread',
              input: { title: 'x'.repeat(201) },
              idempotencyKey: 'neg-ci-1',
            },
          },
          idempotencyKey: `neg-contract-invalid-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
    });
  });

  it('oversized multibyte input is rejected by the released delivery-safe bound', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            mutation: {
              op: 'create',
              id: 'qlt-neg-big',
              input: { title: '語'.repeat(70_000) },
              idempotencyKey: 'neg-big-1',
            },
          },
          idempotencyKey: `neg-oversized-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_MUTATION_INPUT_INVALID' });
    });
  });

  it('wrong action ID and stale action revision fail closed (VICT_APPDATA_ACTION_UNRESOLVED)', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.queryThreads',
            mutation: { op: 'create', id: 'qlt-x', input: { title: 'x' }, idempotencyKey: 'k' },
          },
          idempotencyKey: `neg-wrong-action-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_ACTION_UNRESOLVED' });
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            expectedActionRevision: '0',
            mutation: { op: 'create', id: 'qlt-x', input: { title: 'x' }, idempotencyKey: 'k' },
          },
          idempotencyKey: `neg-stale-revision-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_APPDATA_ACTION_UNRESOLVED' });
    });
  });

  it('the compiled plan is immutable (tamper fails; resolution stays truthful)', async () => {
    const plan = getCompiledPlan();
    expect(Object.isFrozen(plan.actions)).toBe(true);
    expect(Object.isFrozen(plan.actions['act.createThread'])).toBe(true);
    expect(() => {
      (plan.actions as Record<string, unknown>)['act.createThread'] = undefined;
    }).toThrow();
    const createThreadAction = plan.actions['act.createThread'] as { op: string };
    expect(createThreadAction.op).toBe('create');
  });

  it('an unavailable contract resolver fails closed at the released boundary', async () => {
    const calls: unknown[] = [];
    const port = {
      query: async () => ({}),
      mutate: async (request: unknown) => {
        calls.push(request);
        return { ok: true };
      },
    };
    await expect(
      remoteMutate(
        {
          actorId: 'actor-test',
          roles: ['operator'],
          scopes: ['app.data.write'],
          presentedTokenKind: 'local-test',
          mastraResourceId: 'actor-test',
        } as never,
        {
          data: port,
          expectedReleaseVersion: 'quellight-local-1',
          resolveAction: (actionId) =>
            actionId === 'act.createThread'
              ? {
                  actionId: 'act.createThread',
                  revision: '1',
                  kind: 'mutation',
                  resourceId: 'qlt.threads',
                  op: 'create',
                  inputContractId: 'qlt.threads.create.input',
                }
              : undefined,
          // The resolver is composed but cannot resolve the declared contract.
          resolveInputContract: () => undefined,
        },
        {
          resourceId: 'qlt.threads',
          releaseVersion: 'quellight-local-1',
          actionKind: 'mutation',
          actionId: 'act.createThread',
          mutation: { op: 'create', id: 'qlt-ncr', input: { title: 'x' }, idempotencyKey: 'k' },
        },
      ),
    ).rejects.toMatchObject({ code: 'VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE' });
    expect(calls.length).toBe(0);
  });

  it('identity mismatch: an actor without app.data.write is denied with zero effects', async () => {
    const composition = await compose({});
    const viewer: ActorRecord = {
      actorId: 'actor-viewer-governed',
      status: 'active',
      roles: ['viewer'],
      createdAt: 0,
    };
    await composition.stores.actors.upsert(viewer);
    const viewerActor = {
      ...authenticatedActorContext(viewer, viewer.actorId),
      presentedTokenKind: 'local-test' as const,
    };
    await expectNoEffect(composition, async () => {
      await expect(
        composition.commandService.dispatch(viewerActor, {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            expectedActionRevision: '1',
            mutation: {
              op: 'create',
              id: 'qlt-noauth',
              input: { title: 'no' },
              idempotencyKey: 'k',
            },
          },
          idempotencyKey: `neg-identity-${crypto.randomUUID()}`,
        }),
      ).rejects.toMatchObject({ code: 'VICT_ACTOR_SCOPE_DENIED' });
    });
  });

  it('missing idempotency key is refused at the ingress and at the command machinery', async () => {
    const { composition, app } = await isolatedApp({});
    await expectNoEffect(composition, async () => {
      const result = await app.dispatch('act.createThread', { title: 'no key' });
      expect(result.ok).toBe(false);
      expect((result as { code: string }).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      await expect(
        composition.commandService.dispatch(actorOf(composition), {
          command: 'app.data.mutate',
          payload: {
            resourceId: 'qlt.threads',
            releaseVersion: APPLICATION_RELEASE_VERSION,
            actionKind: 'mutation',
            actionId: 'act.createThread',
            mutation: { op: 'create', id: 'qlt-nk', input: { title: 'x' }, idempotencyKey: 'k' },
          },
        }),
      ).rejects.toMatchObject({ code: 'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID' });
    });
  });

  it('duplicate retry reconciles to exactly one adapter mutation and one row', async () => {
    const { composition, app } = await isolatedApp({});
    const key = `dup-${crypto.randomUUID()}`;
    const first = await app.dispatch('act.createThread', { title: 'Duplicate retry' }, key);
    expect(first.ok).toBe(true);
    const rowsAfterFirst = threadRowCount(composition);
    const receiptBefore = await composition.stores.commandIdempotency.getReceipt({
      actorId: composition.actorId,
      command: 'app.data.mutate',
      idempotencyKey: key,
    });
    const second = await app.dispatch('act.createThread', { title: 'Duplicate retry' }, key);
    expect(second.ok).toBe(true);
    // A replayed receipt: identifiers only, no fabricated row, no effect.
    expect((second as { value: Record<string, unknown> }).value['replayed']).toBe(true);
    expect(threadRowCount(composition)).toBe(rowsAfterFirst);
    const receiptAfter = await composition.stores.commandIdempotency.getReceipt({
      actorId: composition.actorId,
      command: 'app.data.mutate',
      idempotencyKey: key,
    });
    expect(receiptAfter?.settledAt).toBe(receiptBefore?.settledAt);
  });

  it('the same key with a different payload is a stable conflict (no effect)', async () => {
    const { composition, app } = await isolatedApp({});
    const key = `conflict-${crypto.randomUUID()}`;
    const first = await app.dispatch('act.createThread', { title: 'Conflict original' }, key);
    expect(first.ok).toBe(true);
    const rowsBefore = threadRowCount(composition);
    const conflict = await app.dispatch('act.createThread', { title: 'Conflict DIFFERENT' }, key);
    expect(conflict.ok).toBe(false);
    expect((conflict as { code: string }).code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    expect(threadRowCount(composition)).toBe(rowsBefore);
  });

  it('handler failure: an unknown target identity fails truthfully with zero effects', async () => {
    const { composition, app } = await isolatedApp({});
    await expectNoEffect(composition, async () => {
      const result = await app.dispatch(
        'act.renameThread',
        { id: 'qlt-missing-thread', title: 'nope' },
        `handler-fail-${crypto.randomUUID()}`,
      );
      expect(result.ok).toBe(false);
      expect((result as { code: string }).code).toBe('DATA_UNKNOWN_IDENTITY');
    });
  });

  it('direct-route adapter invocation attempt: the legacy identity-only payload still fails closed', async () => {
    const composition = await compose({});
    await expectNoEffect(composition, async () => {
      const outcome = await composition.commandService.dispatch(actorOf(composition), {
        command: 'app.data.mutate',
        payload: {
          resourceId: 'qlt.threads',
          releaseVersion: APPLICATION_RELEASE_VERSION,
          actionKind: 'mutation',
        },
        idempotencyKey: `neg-legacy-${crypto.randomUUID()}`,
      });
      expect(outcome.ok).toBe(true);
      const result = (outcome as unknown as { data: { result: { ok: boolean; code: string } } })
        .data.result as { ok: boolean; code: string };
      expect(result.ok).toBe(false);
      expect(result.code).toBe('QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED');
    });
  });

  it('direct-route SQLite write attempt: undeclared ops and ungoverned contexts are denied', async () => {
    const composition = await compose({});
    await expect(
      composition.sharedWorld.adapter.mutate(
        { resourceId: 'qlt.threads', op: 'delete', input: { id: 'qlt-nope' } },
        { permissions: ['qlt.threads.write'], effect: 'write' },
      ),
    ).resolves.toMatchObject({ ok: false, code: 'DATA_MUTATION_NOT_DECLARED' });
    await expect(
      composition.sharedWorld.adapter.mutate(
        { resourceId: 'qlt.threads', op: 'create', input: { id: 'qlt-noauth', title: 'no' } },
        { permissions: ['qlt.threads.read'], effect: 'write' },
      ),
    ).resolves.toMatchObject({ ok: false, code: 'DATA_UNAUTHORIZED' });
    await expect(
      composition.sharedWorld.adapter.mutate(
        { resourceId: 'qlt.threads', op: 'create', input: { id: 'qlt-noauth', title: 'no' } },
        { permissions: ['qlt.threads.write'], effect: 'read' },
      ),
    ).resolves.toMatchObject({ ok: false, code: 'DATA_UNAUTHORIZED' });
  });

  it('a credential canary in undeclared input is rejected and appears in no receipt or store byte', async () => {
    const composition = await compose({});
    const canary = `sk-ollama-canary-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;
    await expect(
      composition.commandService.dispatch(actorOf(composition), {
        command: 'app.data.mutate',
        payload: {
          resourceId: 'qlt.threads',
          releaseVersion: APPLICATION_RELEASE_VERSION,
          actionKind: 'mutation',
          actionId: 'act.createThread',
          mutation: {
            op: 'create',
            id: 'qlt-canary',
            input: { title: 'safe title', [canary.slice(0, 20)]: canary },
            idempotencyKey: 'neg-canary-1',
          },
        },
        idempotencyKey: `neg-canary-${crypto.randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
    // The canary value must not appear in ANY durable byte.
    for (const file of [
      'shared-world.db',
      'vict-operational.db',
      join('mastra', 'mastra-store.db'),
    ]) {
      const path = join(composition.dataDir, file);
      if (!existsSync(path)) {
        continue;
      }
      const bytes = readFileSync(path);
      expect(bytes.includes(canary), file).toBe(false);
    }
    // And it was never stored under the attempted identity key either.
    expect(adapterKeyCount(composition)).toBe(0);
  });
});
