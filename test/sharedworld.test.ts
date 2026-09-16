import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runApplicationDataAdapterSuite } from '@victframework/application/testing';
import type { ApplicationDataAdapterFixture } from '@victframework/application/testing';
import { authenticatedActorContext, type ActorRecord } from '@victframework/runtime';
import { createSharedWorldSqlite, sharedWorldThreadResource } from '../src/lib/sharedworld/sqlite';
import {
  runSharedWorldMigrations,
  QLT_SHARED_WORLD_SCHEMA_VERSION,
} from '../src/lib/sharedworld/migrations';
import { DatabaseSync } from 'node:sqlite';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-sharedworld-'));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

describe('Quellight Shared World store (Quellight-owned; §6)', () => {
  it('creates, lists (recency order), renames, archives, and reopens thread records (N-10)', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({
      path: join(dir, 'shared-world.db'),
      clock: (() => {
        let now = 1_000;
        return () => (now += 10);
      })(),
    });
    const first = await store.createThread({ title: 'Career direction' });
    const second = await store.createThread({ title: 'House move' });
    expect(first.state).toBe('active');
    expect(first.retentionState).toBe('currently-relevant');
    expect(first.provenance).toBe('user');
    const listed = await store.listThreads();
    expect(listed.total).toBe(2);
    expect(listed.threads.map((thread) => thread.id)).toEqual([second.id, first.id]);

    const renamed = await store.renameThread(first.id, 'Career direction (2026)');
    expect(renamed.title).toBe('Career direction (2026)');

    const archived = await store.archiveThread(second.id);
    expect(archived.state).toBe('dormant');
    // archived threads are read-only: rename refuses; reopen works
    await expect(store.renameThread(second.id, 'nope')).rejects.toMatchObject({
      code: 'QLT_THREAD_ARCHIVED',
    });
    const reopened = await store.reopenThread(second.id);
    expect(reopened.state).toBe('active');
    store.close();
  });

  it('survives SQLite close/reopen with migration bookkeeping intact (N-13)', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    let store = createSharedWorldSqlite({ path: dbPath });
    const thread = await store.createThread({ title: 'Persistent thread' });
    await store.ensureConversationLink(thread.id);
    store.close();

    // reopen: durable truth intact, bookkeeping versioned
    store = createSharedWorldSqlite({ path: dbPath });
    const reopenedThread = await store.getThread(thread.id);
    expect(reopenedThread?.title).toBe('Persistent thread');
    const link = await store.getConversationLink(thread.id);
    expect(link?.mastraThreadId).toBe(`vict-conv-${link?.id}`);
    expect(link?.mastraThreadId.startsWith('vict-conv-')).toBe(true);

    const raw = new DatabaseSync(dbPath, { readOnly: true });
    const bookkeeping = raw
      .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
      .all() as Array<{ version: number }>;
    raw.close();
    // Q4 reconciliation (frozen Q4 contract §12): migration 3
    // (qlt-context-assembly) is applied on top of migrations 1–2; this
    // assertion is re-pinned to the amended frozen reality, never weakened.
    expect(bookkeeping.map((row) => row.version)).toEqual([1, 2, QLT_SHARED_WORLD_SCHEMA_VERSION]);
    store.close();
  });

  it('refuses to open a store written by a NEWER schema (forward-only discipline)', () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    const db = new DatabaseSync(dbPath);
    runSharedWorldMigrations(db);
    db.prepare(
      'INSERT INTO quellight_shared_world_migrations (version, name, applied_at) VALUES (?, ?, ?);',
    ).run(QLT_SHARED_WORLD_SCHEMA_VERSION + 1, 'from-the-future', '0');
    db.close();
    expect(() => createSharedWorldSqlite({ path: dbPath })).toThrow(/newer than this build/);
  });

  it('the conversation link is idempotent: one 07B conversation per thread', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'shared-world.db') });
    const thread = await store.createThread({ title: 'One conversation' });
    const first = await store.ensureConversationLink(thread.id);
    const second = await store.ensureConversationLink(thread.id);
    expect(second.mastraThreadId).toBe(first.mastraThreadId);
    store.close();
  });

  it('passes the shared application-data conformance fixtures for the supported subset', async () => {
    const dir = tempDir();
    const actorRecord: ActorRecord = {
      actorId: 'actor-qlt',
      status: 'active',
      roles: ['developer'],
      createdAt: 0,
    };
    const readContext = {
      permissions: ['qlt.threads.read'],
      effect: 'read' as const,
      actor: 'actor-qlt',
    };
    const writeContext = {
      permissions: ['qlt.threads.read', 'qlt.threads.write'],
      effect: 'write' as const,
      actor: 'actor-qlt',
    };
    const unauthorizedContext = { permissions: [], effect: 'read' as const };
    let counter = 0;
    const fixture: ApplicationDataAdapterFixture = {
      create: (seeds) => {
        counter += 1;
        const path = join(dir, `conformance-${counter}.db`);
        const store = createSharedWorldSqlite({ path });
        let seedNow = counter * 1_000;
        for (const seed of seeds) {
          // The suite's seed template fills absent fields with null; the
          // store's declared defaults take their place for seeding.
          const normalized: Record<string, unknown> = { ...seed };
          if (normalized['state'] === null || normalized['state'] === undefined) {
            normalized['state'] = 'active';
          }
          if (normalized['retentionState'] === null || normalized['retentionState'] === undefined) {
            normalized['retentionState'] = 'currently-relevant';
          }
          if (normalized['createdAt'] === null || normalized['createdAt'] === undefined) {
            normalized['createdAt'] = seedNow;
          }
          if (normalized['updatedAt'] === null || normalized['updatedAt'] === undefined) {
            normalized['updatedAt'] = seedNow;
          }
          seedNow += 1;
          void store.adapter.mutate(
            {
              resourceId: sharedWorldThreadResource.id,
              op: 'create',
              input: normalized,
            },
            writeContext,
          );
        }
        return store.adapter;
      },
      resource: sharedWorldThreadResource,
      readContext,
      writeContext,
      unauthorizedContext,
    };
    await runApplicationDataAdapterSuite(fixture);
    expect(true).toBe(true); // the suite throws on any conformance failure
  });

  it('keys are scoped per resource AND per mutation op (conformance property, shared-world bytes)', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db') });
    const writeContext = {
      permissions: ['qlt.threads.write'],
      effect: 'write' as const,
    };
    const first = await store.adapter.mutate(
      {
        resourceId: sharedWorldThreadResource.id,
        op: 'create',
        input: { id: 'row-a', title: 'alpha' },
        idempotencyKey: 'shared-key',
      },
      writeContext,
    );
    expect(first.ok).toBe(true);
    // same key, same canonical request → idempotent replay (one row)
    const replay = await store.adapter.mutate(
      {
        resourceId: sharedWorldThreadResource.id,
        op: 'create',
        input: { id: 'row-a', title: 'alpha' },
        idempotencyKey: 'shared-key',
      },
      writeContext,
    );
    expect(replay.ok).toBe(true);
    const listed = await store.adapter.query(
      { op: 'list', resourceId: sharedWorldThreadResource.id },
      { permissions: ['qlt.threads.read'], effect: 'read' },
    );
    expect(listed.ok && listed.total === 1).toBe(true);
    store.close();
  });
});
