import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite, type SharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import { QLT_D1_NEW_TABLES } from '../src/lib/sharedworld/d1-contract.js';
import {
  QLT_SHARED_WORLD_SCHEMA_VERSION,
  runSharedWorldMigrations,
} from '../src/lib/sharedworld/migrations';
import {
  QLT_MEANING_SCHEMA_INVENTORY,
  QLT_MEANING_TABLES,
  QltMeaningError,
  type QltClaimProposalContent,
  type QltTableSpec,
} from '../src/lib/sharedworld/meaning-contract';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-meaning-foundation-'));
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

/** Deterministic clock + id factories. */
function deterministic(idPrefix: string) {
  let now = 1_700_000_000_000;
  let counter = 0;
  return {
    clock: (): number => (now += 10),
    ids: {
      proposalId: (): string => `qlt-${idPrefix}-p-${(counter += 1)}`,
      recordId: (): string => `qlt-${idPrefix}-r-${(counter += 1)}`,
      correctionId: (): string => `qlt-${idPrefix}-c-${(counter += 1)}`,
      linkId: (): string => `qlt-${idPrefix}-l-${(counter += 1)}`,
    },
  };
}

const claimContent = (statement: string): QltClaimProposalContent => ({
  subject: 'project-alpha',
  epistemicType: 'E3',
  honestyState: 'likely',
  confidence: 'qualified',
  statement,
});

interface IntrospectedTable {
  readonly columns: {
    readonly name: string;
    readonly type: string;
    readonly notnull: number;
    readonly dflt: string | null;
  }[];
  readonly createdIndexes: Map<
    string,
    { readonly unique: number; readonly partial: number; readonly columns: readonly string[] }
  >;
  readonly foreignKeys: readonly {
    readonly from: string;
    readonly table: string;
    readonly to: string | null;
  }[];
  readonly sql: string;
}

/** The stored CREATE INDEX sql of the last introspection (partial WHEREs). */
let lastIndexSql = new Map<string, string>();

function introspect(db: DatabaseSync): Map<string, IntrospectedTable> {
  const tables = new Map<string, IntrospectedTable>();
  const indexSql = new Map<string, string>();
  for (const row of db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL;")
    .all() as Array<{ name: string; sql: string }>) {
    indexSql.set(row.name, row.sql);
  }
  lastIndexSql = indexSql;
  const tableRows = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
    )
    .all() as Array<{ name: string; sql: string }>;
  for (const { name, sql } of tableRows) {
    const columns = (
      db.prepare(`PRAGMA table_info (${name});`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>
    ).map((column) => ({
      name: column.name,
      type: column.type,
      notnull: column.notnull,
      dflt: column.dflt_value,
    }));
    const createdIndexes = new Map<
      string,
      { readonly unique: number; readonly partial: number; readonly columns: readonly string[] }
    >();
    const indexRows = db.prepare(`PRAGMA index_list (${name});`).all() as Array<{
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;
    for (const index of indexRows) {
      if (index.origin !== 'c') {
        continue; // implicit UNIQUE/PK auto-indexes are not part of the inventory
      }
      const columns = (
        db.prepare(`PRAGMA index_info (${index.name});`).all() as Array<{ name: string }>
      ).map((entry) => entry.name);
      createdIndexes.set(index.name, { unique: index.unique, partial: index.partial, columns });
    }
    const foreignKeys = (
      db.prepare(`PRAGMA foreign_key_list (${name});`).all() as Array<{
        from: string;
        table: string;
        to: string | null;
      }>
    ).map((entry) => ({ from: entry.from, table: entry.table, to: entry.to }));
    tables.set(name, { columns, createdIndexes, foreignKeys, sql });
  }
  return tables;
}

function assertTableMatchesInventory(db: DatabaseSync): void {
  const introspected = introspect(db);
  for (const tableName of QLT_MEANING_TABLES) {
    const spec: QltTableSpec = QLT_MEANING_SCHEMA_INVENTORY[tableName];
    const table = introspected.get(tableName);
    if (table === undefined) {
      throw new Error(`missing table ${tableName}`);
    }
    // columns: exact order, type, nullability, default
    expect(table.columns.length, `${tableName} column count`).toBe(spec.columns.length);
    for (let index = 0; index < spec.columns.length; index += 1) {
      const expected = spec.columns[index];
      const actual = table.columns[index];
      expect(actual.name, `${tableName}.${expected.name} name`).toBe(expected.name);
      expect(actual.type, `${tableName}.${expected.name} type`).toBe(expected.type);
      expect(actual.notnull, `${tableName}.${expected.name} notnull`).toBe(
        expected.notNull ? 1 : 0,
      );
      expect(actual.dflt ?? null, `${tableName}.${expected.name} default`).toBe(
        expected.default ?? null,
      );
    }
    // indexes: exact created-index set, columns, uniqueness, partial WHERE
    const expectedIndexNames = spec.indexes.map((index) => index.name).sort();
    const actualIndexNames = [...table.createdIndexes.keys()].sort();
    expect(actualIndexNames, `${tableName} index set`).toEqual(expectedIndexNames);
    for (const index of spec.indexes) {
      const actual = table.createdIndexes.get(index.name);
      if (actual === undefined) {
        throw new Error(`missing index ${index.name}`);
      }
      expect(actual.columns, `${index.name} columns`).toEqual(index.columns);
      expect(actual.unique, `${index.name} unique`).toBe(index.unique ? 1 : 0);
      expect(actual.partial, `${index.name} partial`).toBe(
        index.partialWhere === undefined ? 0 : 1,
      );
      if (index.partialWhere !== undefined) {
        expect(
          (lastIndexSql.get(index.name) ?? '').includes(index.partialWhere),
          `${index.name} partial WHERE`,
        ).toBe(true);
      }
    }
    // foreign keys: exact set
    const expectedFks = spec.foreignKeys
      .map((fk) => `${fk.column}->${fk.targetTable}.${fk.targetColumn}`)
      .sort();
    const actualFks = table.foreignKeys.map((fk) => `${fk.from}->${fk.table}.${fk.to}`).sort();
    expect(actualFks, `${tableName} foreign keys`).toEqual(expectedFks);
    // CHECK fragments present in the stored CREATE sql
    for (const fragment of spec.requiredCheckFragments) {
      expect(table.sql.includes(fragment), `${tableName} check fragment: ${fragment}`).toBe(true);
    }
  }
}

/** Build a migration-1-era store file with real thread + conversation rows. */
function buildQ1EraStore(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  runSharedWorldMigrations(db, () => '0');
  db.prepare(
    `INSERT INTO qlt_thread (id, title, state, retention_state, provenance, created_at_ms, updated_at_ms)
     VALUES ('qlt-q1-thread', 'Q1 era thread', 'active', 'currently-relevant', 'user', 1, 1);`,
  ).run();
  db.prepare(
    `INSERT INTO qlt_thread_conversation (id, thread_id, mastra_thread_id, created_at_ms)
     VALUES ('conv-q1', 'qlt-q1-thread', 'vict-conv-conv-q1', 1);`,
  ).run();
  // Downgrade simulation: remove the migration-2 artifacts (children
  // first) plus the migration-5 families and the migration-6 tables,
  // whose bookkeeping entries are also removed below.
  for (const table of [
    ...QLT_MEANING_TABLES,
    ...QLT_D1_NEW_TABLES,
    'qlt_conversation_deletion',
    'qlt_conversation_purge',
  ].reverse()) {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  }
  // D1a reconciliation: migration 5 REBUILDS the same meaning tables, so
  // the downgrade simulation removes its bookkeeping entry too; the
  // reopen then re-applies migrations 2 and 5 and lands on the same
  // frozen post-migration-5 shapes (forward-only discipline unchanged).
  db.prepare(
    'DELETE FROM quellight_shared_world_migrations WHERE version IN (2, 5, 6);',
  ).run();
  db.close();
}

describe('Q2 meaning foundation: migration and schema (A-01..A-05)', () => {
  it('A-01: a fresh database migrates to exactly the frozen schema inventory', () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    const store = createSharedWorldSqlite({ path: dbPath });
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    assertTableMatchesInventory(raw);
    raw.close();
    store.close();
  });

  it('A-02: upgrading a Q1-era store preserves existing rows and applies migration 2 additively', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    buildQ1EraStore(dbPath);
    const rawBefore = new DatabaseSync(dbPath, { readOnly: true });
    const threadBefore = rawBefore
      .prepare('SELECT * FROM qlt_thread WHERE id = ?;')
      .get('qlt-q1-thread');
    const conversationBefore = rawBefore
      .prepare('SELECT * FROM qlt_thread_conversation WHERE id = ?;')
      .get('conv-q1');
    rawBefore.close();

    const store = createSharedWorldSqlite({ path: dbPath });
    // existing rows preserved
    const thread = await store.getThread('qlt-q1-thread');
    expect(thread).toBeDefined();
    expect(thread?.title).toBe('Q1 era thread');
    const link = await store.getConversationLink('qlt-q1-thread');
    expect(link?.mastraThreadId).toBe('vict-conv-conv-q1');
    // meaning tables exist and are usable
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('upgraded store accepts meaning rows'),
      proposedBy: 'agent-quellight',
      sourceThreadId: 'qlt-q1-thread',
      key: 'upgrade-probe',
    });
    expect(proposal.status).toBe('proposed');
    store.close();

    const rawAfter = new DatabaseSync(dbPath, { readOnly: true });
    expect(rawAfter.prepare('SELECT * FROM qlt_thread WHERE id = ?;').get('qlt-q1-thread')).toEqual(
      threadBefore,
    );
    expect(
      rawAfter.prepare('SELECT * FROM qlt_thread_conversation WHERE id = ?;').get('conv-q1'),
    ).toEqual(conversationBefore);
    expect(
      (
        rawAfter
          .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
          .all() as Array<{ version: number }>
      ).map((row) => row.version),
      // Q4 reconciliation (frozen Q4 contract §12): migration 3
      // (qlt-context-assembly) is applied on top of migrations 1–2; this
      // assertion is re-pinned to the amended frozen reality, never weakened.
      // Q5 bounded re-pin: migration 4 (qlt-memory-mode-policy) exists.
      // D2 bounded re-pin: migrations 5 and 6 exist on top.
    ).toEqual([1, 2, 3, 4, 5, QLT_SHARED_WORLD_SCHEMA_VERSION]);
    assertTableMatchesInventory(rawAfter);
    rawAfter.close();
  });

  it('A-03: an injected failure rolls migration 2 back atomically (bookkeeping untouched, no partial schema)', () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    buildQ1EraStore(dbPath);
    const db = new DatabaseSync(dbPath);
    // injected conflicting table: migration 2 must fail on CREATE TABLE qlt_claim
    db.exec('CREATE TABLE qlt_claim (id TEXT);');
    expect(() => runSharedWorldMigrations(db, () => '0')).toThrow();
    const bookkeeping = (
      db
        .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
        .all() as Array<{
        version: number;
      }>
    ).map((row) => row.version);
    // Q5 bounded re-pin; D1a/D2 re-pins: the downgrade simulation removes
    // the bookkeeping entries for version 2 and the rebuilding versions 5
    // and 6; the FAILED migration-2 attempt aborts the runner BEFORE
    // re-applying 5/6, so the surviving bookkeeping is exactly [1, 3, 4]
    // (untouched by the failed attempt).
    expect(bookkeeping).toEqual([1, 3, 4]);
    // Q4 reconciliation: `buildQ1EraStore` applies migrations 1–3 before the
    // simulated downgrade, so the pre-existing bookkeeping [1,3] must be
    // untouched by the FAILED migration-2 attempt (the rollback assertion
    // is unchanged: no version-2 row may appear and no partial schema).
    const meaningTables = QLT_MEANING_TABLES.filter((table) => table !== 'qlt_claim');
    for (const table of meaningTables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;")
        .get(table);
      expect(row, `${table} must not exist after rollback`).toBeUndefined();
    }
    // the Q1 rows survive the failed attempt
    expect(
      db.prepare('SELECT id FROM qlt_thread WHERE id = ?;').get('qlt-q1-thread'),
    ).toBeDefined();
    // after removing the injected table the store opens cleanly and migrates once
    db.exec('DROP TABLE qlt_claim;');
    db.close();
    const store = createSharedWorldSqlite({ path: dbPath });
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    expect(
      (
        raw
          .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
          .all() as Array<{
          version: number;
        }>
      ).map((row) => row.version),
      // Q4 reconciliation (frozen Q4 contract §12): the clean migration
      // path now applies migrations 1–3. Q5 bounded re-pin: migration 4
      // exists. D2 bounded re-pin: migrations 5 and 6 exist on top.
    ).toEqual([1, 2, 3, 4, 5, QLT_SHARED_WORLD_SCHEMA_VERSION]);
    assertTableMatchesInventory(raw);
    raw.close();
    store.close();
  });

  it('A-04: restart — reopening a migrated store neither re-applies nor mutates schema state', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    const deterministic1 = deterministic('a4');
    let store: SharedWorldSqlite = createSharedWorldSqlite({ path: dbPath, ...deterministic1 });
    const thread = await store.createThread({ title: 'Restart thread' });
    await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('survives a restart'),
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
      key: 'restart-probe',
    });
    await store.meaning.createClaim({
      subject: 'restart-subject',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'durable across restart',
      createdBy: 'actor-quellight-local',
      key: 'restart-claim',
    });
    const capture = (): unknown => {
      const raw = new DatabaseSync(dbPath, { readOnly: true });
      const schema = raw
        .prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name;')
        .all();
      const bookkeeping = raw
        .prepare(
          'SELECT version, name, applied_at FROM quellight_shared_world_migrations ORDER BY version;',
        )
        .all();
      raw.close();
      return { schema, bookkeeping };
    };
    const before = capture();
    store.close();
    store = createSharedWorldSqlite({ path: dbPath, ...deterministic1 });
    expect(capture()).toEqual(before);
    const proposalPage = await store.meaning.listProposals({});
    expect(proposalPage.total).toBe(1);
    const claimPage = await store.meaning.listClaims({});
    expect(claimPage.total).toBe(1);
    expect(claimPage.rows[0]?.content.statement).toBe('durable across restart');
    store.close();
  });

  it('A-05: a store written by a newer schema version still refuses to open', () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    const db = new DatabaseSync(dbPath);
    runSharedWorldMigrations(db, () => '0');
    db.prepare(
      'INSERT INTO quellight_shared_world_migrations (version, name, applied_at) VALUES (?, ?, ?);',
    ).run(QLT_SHARED_WORLD_SCHEMA_VERSION + 1, 'from-the-future', '0');
    db.close();
    expect(() => createSharedWorldSqlite({ path: dbPath })).toThrow(/newer than this build/);
  });
});

describe('Q2 meaning foundation: keyed idempotency and transactions (A-16..A-18, A-26)', () => {
  it('A-16: a duplicate keyed createProposal converges to the same row without duplicates', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('a16') });
    const thread = await store.createThread({ title: 'Idempotency thread' });
    const input = {
      proposalKind: 'claim' as const,
      content: claimContent('same logical request'),
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
    };
    const first = await store.meaning.createProposal({ ...input, key: 'dup-key' });
    const second = await store.meaning.createProposal({ ...input, key: 'dup-key' });
    expect(second.id).toBe(first.id);
    expect(second.contentFingerprint).toBe(first.contentFingerprint);
    expect((await store.meaning.listProposals({})).total).toBe(1);
    store.close();
  });

  it('A-17: the same key with conflicting content fails closed and the original stays intact', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('a17') });
    const thread = await store.createThread({ title: 'Conflict thread' });
    const first = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('original content'),
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
      key: 'conflict-key',
    });
    await expect(
      store.meaning.createProposal({
        proposalKind: 'claim',
        content: claimContent('different content'),
        proposedBy: 'agent-quellight',
        sourceThreadId: thread.id,
        key: 'conflict-key',
      }),
    ).rejects.toMatchObject({ code: 'QLT_IDEMPOTENCY_CONFLICT' });
    const page = await store.meaning.listProposals({});
    expect(page.total).toBe(1);
    expect(page.rows[0]?.id).toBe(first.id);
    expect((page.rows[0]?.content as { statement: string }).statement).toBe('original content');
    store.close();
  });

  it('A-18: concurrent duplicate writes converge to exactly one row and both resolve', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('a18') });
    const results = await Promise.all([
      store.meaning.createClaim({
        subject: 'concurrent-subject',
        epistemicType: 'E1',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'exactly once',
        createdBy: 'actor-quellight-local',
        key: 'race-key',
      }),
      store.meaning.createClaim({
        subject: 'concurrent-subject',
        epistemicType: 'E1',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'exactly once',
        createdBy: 'actor-quellight-local',
        key: 'race-key',
      }),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect((await store.meaning.listClaims({})).total).toBe(1);
    store.close();
  });

  it('A-26: a failed confirm transaction leaves zero partial effects (proposal stays pending, no links)', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'sw.db');
    const store = createSharedWorldSqlite({ path: dbPath, ...deterministic('a26') });
    const thread = await store.createThread({ title: 'Crash thread' });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('will fail to confirm'),
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    // Inject a collision: a claim row already occupying this proposal_id.
    const raw = new DatabaseSync(dbPath);
    raw
      .prepare(
        `INSERT INTO qlt_claim (id, version, status, epistemic_type, honesty_state, confidence, subject, content,
          content_fingerprint, proposal_id, created_by, created_at_ms, updated_at_ms, effective_at_ms, retention_state)
         VALUES ('qlt-injected', 1, 'active', 'E1', 'known', 'stated', 'injected',
          '{"statement":"injected"}', '${'a'.repeat(64)}', ?, 'actor-quellight-local', 1, 1, 1, 'currently-relevant');`,
      )
      .run(proposal.id);
    const countsBefore = {
      claims: (raw.prepare('SELECT COUNT(*) AS n FROM qlt_claim;').get() as { n: number }).n,
      links: (raw.prepare('SELECT COUNT(*) AS n FROM qlt_source_link;').get() as { n: number }).n,
    };
    raw.close();
    await expect(
      store.meaning.confirmProposal({
        proposalId: proposal.id,
        confirmedBy: 'actor-quellight-local',
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_EXISTS' });
    const after = await store.meaning.getProposal(proposal.id);
    expect(after?.status).toBe('awaiting_decision');
    expect(after?.version).toBe(2); // only the awaiting transition bumped it
    expect(await store.meaning.listSourceLinks({ fromRecordId: proposal.id })).toEqual([]);
    const rawAfter = new DatabaseSync(dbPath, { readOnly: true });
    expect(
      (rawAfter.prepare('SELECT COUNT(*) AS n FROM qlt_claim;').get() as { n: number }).n,
    ).toBe(countsBefore.claims);
    expect(
      (rawAfter.prepare('SELECT COUNT(*) AS n FROM qlt_source_link;').get() as { n: number }).n,
    ).toBe(countsBefore.links);
    rawAfter.close();
    store.close();
  });

  it('A-26b: a proposal on a nonexistent source thread fails with QLT_THREAD_MISSING and zero rows', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'sw.db');
    const store = createSharedWorldSqlite({ path: dbPath, ...deterministic('a26b') });
    await expect(
      store.meaning.createProposal({
        proposalKind: 'claim',
        content: claimContent('orphan proposal'),
        proposedBy: 'agent-quellight',
        sourceThreadId: 'qlt-missing-thread',
      }),
    ).rejects.toMatchObject({ code: 'QLT_THREAD_MISSING' });
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    expect((raw.prepare('SELECT COUNT(*) AS n FROM qlt_proposal;').get() as { n: number }).n).toBe(
      0,
    );
    raw.close();
    store.close();
  });
});

describe('Q2 meaning foundation: storage guards (agent confirmer, enums, bytes, SQL safety)', () => {
  it('an agent identity may never confirm (QLT_CONFIRMER_INVALID, zero effects)', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('g1') });
    const thread = await store.createThread({ title: 'Guard thread' });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('agent must not confirm'),
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    await expect(
      store.meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: 'agent-quellight' }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    expect((await store.meaning.getProposal(proposal.id))?.status).toBe('awaiting_decision');
    expect(await store.meaning.listClaims({})).toMatchObject({ total: 0 });
    store.close();
  });

  it('an invalid epistemic enum in typed content is rejected by the storage guard (zero effects)', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('g2') });
    const thread = await store.createThread({ title: 'Enum thread' });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: { ...claimContent('bad enum'), epistemicType: 'E9' as unknown as 'E1' },
      proposedBy: 'agent-quellight',
      sourceThreadId: thread.id,
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    await expect(
      store.meaning.confirmProposal({
        proposalId: proposal.id,
        confirmedBy: 'actor-quellight-local',
      }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_INVALID_ENUM' });
    expect((await store.meaning.getProposal(proposal.id))?.status).toBe('awaiting_decision');
    expect((await store.meaning.listClaims({})).total).toBe(0);
    store.close();
  });

  it('canonical content over the 4096-byte UTF-8 bound is rejected (QLT_INPUT_OVERSIZE)', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('g3') });
    // 2000 CJK characters = 6000 UTF-8 bytes — the byte bound is the hard limit
    await expect(
      store.meaning.createClaim({
        subject: 'byte-bound',
        epistemicType: 'E1',
        honestyState: 'known',
        confidence: 'stated',
        statement: '日'.repeat(2000),
        createdBy: 'actor-quellight-local',
      }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_OVERSIZE' });
    // multibyte content just UNDER the bound is accepted (deterministic ids keep this bounded)
    const underBound = store.meaning.createClaim({
      subject: 'byte-bound-under',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: '日'.repeat(1000),
      createdBy: 'actor-quellight-local',
      key: 'under-bound',
    });
    await expect(underBound).resolves.toMatchObject({ status: 'active' });
    store.close();
  });

  it('SQL metacharacters in content stay data: round-trip verbatim, schema intact', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'sw.db');
    const store = createSharedWorldSqlite({ path: dbPath, ...deterministic('g4') });
    const hostile = "'; DROP TABLE qlt_claim; --";
    const created = await store.meaning.createClaim({
      subject: 'sql-safety',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: hostile,
      createdBy: 'actor-quellight-local',
    });
    const fetched = await store.meaning.getClaim(created.id);
    expect(fetched?.content.statement).toBe(hostile);
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    expect(
      (
        raw
          .prepare(
            "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'qlt_claim';",
          )
          .get() as { n: number }
      ).n,
    ).toBe(1);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM qlt_claim;').get() as { n: number }).n).toBe(1);
    raw.close();
    store.close();
  });

  it('malformed identifiers and oversized idempotency keys fail closed', async () => {
    const dir = tempDir();
    const store = createSharedWorldSqlite({ path: join(dir, 'sw.db'), ...deterministic('g5') });
    const thread = await store.createThread({ title: 'Guard two' });
    await expect(
      store.meaning.createProposal({
        proposalKind: 'claim',
        content: claimContent('bad id'),
        proposedBy: 'agent-quellight',
        sourceThreadId: thread.id,
        id: 'bad id with spaces',
      }),
    ).rejects.toBeInstanceOf(QltMeaningError);
    await expect(
      store.meaning.createProposal({
        proposalKind: 'claim',
        content: claimContent('bad key'),
        proposedBy: 'agent-quellight',
        sourceThreadId: thread.id,
        key: 'x'.repeat(129),
      }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_INVALID_ID' });
    store.close();
  });
});
