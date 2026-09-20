#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q2 — focused durable Shared World schema
 * verifier (`npm run verify:q2`; run as `node --import tsx
 * scripts/verify-q2.mjs`).
 *
 * Stable Q2 checks ONLY — no re-implementation of the permanent test
 * suites (the full adversarial matrix lives in
 * `test/sharedworld-meaning.test.ts` and
 * `test/meaning-foundation.test.ts`):
 *
 *   1. SCHEMA         — fresh-store introspection vs the FROZEN
 *                       QLT_MEANING_SCHEMA_INVENTORY (columns, defaults,
 *                       indexes incl. uniqueness/partial WHERE, foreign
 *                       keys, CHECK fragments); migration bookkeeping
 *                       [1, 2]; schema-version constant; restart dumps
 *                       identical.
 *   2. DETERMINISTIC  — fingerprint key-order invariance; canonical
 *                       serializer refusals; the pure resolution
 *                       tie-break; the pinned staleness matrix; the
 *                       authority predicate matrix.
 *   3. REPOSITORY     — deterministic smoke over the store: ceremony
 *                       confirm + links, correction successor, keyed
 *                       convergence, stale refusal, agent-confirmer
 *                       refusal.
 *   4. STRUCTURAL     — no route/island/component references the meaning
 *                       store; the compiled plan carries EXACTLY the five
 *                       declared thread actions plus the frozen Q3 memory
 *                       inventory (re-pinned by the Q3 contract freeze
 *                       §16/§18 — never weakened); the thread resource
 *                       declares exactly its four mutations and the Q3
 *                       memory resource exactly its thirteen ops.
 *   5. PINS           — package.json @victframework/* deps all exactly
 *                       0.3.0-rc.1; installed @victframework/server is 0.3.0-rc.1
 *                       (the full gate remains `verify:consumer`).
 *   6. WIRING         — `verify:q2` exists in package.json and the
 *                       aggregate verifier references this script.
 *
 * Emits clear per-section counts; exits non-zero on ANY failure.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite.ts';
import { QLT_SHARED_WORLD_SCHEMA_VERSION } from '../src/lib/sharedworld/migrations.ts';
import {
  QLT_MEANING_SCHEMA_INVENTORY,
  QLT_MEANING_TABLES,
  QltMeaningError,
  canonicalJson,
  contentFingerprint,
} from '../src/lib/sharedworld/meaning-contract.ts';
import {
  canAuthor,
  canConfirm,
  canCorrect,
  canPropose,
  canWithdraw,
  proposalStaleness,
  resolveCurrentEffective,
} from '../src/lib/sharedworld/meaning.ts';
import { getCompiledPlan, threadResource } from '../src/lib/application/definition.ts';

const USER = 'actor-quellight-local';
const AGENT = 'agent-quellight-probe';

const sections = { schema: 0, deterministic: 0, repository: 0, structural: 0, pins: 0, wiring: 0 };
const section = (label) =>
  ({ schema: 1, deterministic: 2, repository: 3, structural: 4, pins: 5, wiring: 6 })[label];
const failures = [];
const check = (label, sectionName, condition) => {
  if (condition) {
    sections[sectionName] += 1;
  } else {
    failures.push(`[${sectionName}] ${label}`);
    console.error(`  FAIL: ${label}`);
  }
};

console.log('verify:q2 — Q2 durable Shared World schema conformance');
console.log(`schema version constant: ${QLT_SHARED_WORLD_SCHEMA_VERSION}`);

// ---------------------------------------------------------------------------
// 1. SCHEMA
// ---------------------------------------------------------------------------
console.log('\n[1] SCHEMA — frozen inventory introspection, bookkeeping, restart stability');
{
  const dir = mkdtempSync(join(tmpdir(), 'qlt-verify-q2-'));
  const dbPath = join(dir, 'shared-world.db');
  try {
    const store = createSharedWorldSqlite({ path: dbPath, clock: () => 1_700_000_000_000 });
    const dump = () => {
      const raw = new DatabaseSync(dbPath);
      try {
        return JSON.stringify(
          raw.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name;').all(),
        );
      } finally {
        raw.close();
      }
    };
    const before = dump();

    const raw = new DatabaseSync(dbPath);
    try {
      const tables = new Map(
        (
          raw
            .prepare(
              "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
            )
            .all() ?? []
        ).map((row) => [row.name, row.sql]),
      );
      for (const table of QLT_MEANING_TABLES) {
        const spec = QLT_MEANING_SCHEMA_INVENTORY[table];
        check(`table ${table} exists`, 'schema', tables.has(table));
        const sql = tables.get(table) ?? '';
        const columns = raw.prepare(`PRAGMA table_info (${table});`).all();
        check(
          `${table}: column inventory exact`,
          'schema',
          JSON.stringify(columns.map((c) => [c.name, c.type, c.notnull, c.dflt_value])) ===
            JSON.stringify(
              spec.columns.map((c) => [c.name, c.type, c.notNull ? 1 : 0, c.default ?? null]),
            ),
        );
        for (const fragment of spec.requiredCheckFragments) {
          check(
            `${table}: CHECK fragment present (${fragment.slice(0, 40)}…)`,
            'schema',
            sql.includes(fragment),
          );
        }
        const indexRows = raw.prepare(`PRAGMA index_list (${table});`).all();
        const created = indexRows.filter((row) => row.origin === 'c');
        check(`${table}: index count exact`, 'schema', created.length === spec.indexes.length);
        for (const indexSpec of spec.indexes) {
          const found = created.find((row) => row.name === indexSpec.name);
          check(`${table}: index ${indexSpec.name} exists`, 'schema', found !== undefined);
          if (found === undefined) continue;
          check(
            `${table}: index ${indexSpec.name} unique=${indexSpec.unique}`,
            'schema',
            Number(found.unique) === (indexSpec.unique ? 1 : 0),
          );
          check(
            `${table}: index ${indexSpec.name} partial=${Boolean(indexSpec.partialWhere)}`,
            'schema',
            Number(found.partial) === (indexSpec.partialWhere ? 1 : 0),
          );
          const indexColumns = raw
            .prepare(`PRAGMA index_info (${indexSpec.name});`)
            .all()
            .map((row) => row.name);
          check(
            `${table}: index ${indexSpec.name} columns exact`,
            'schema',
            JSON.stringify(indexColumns) === JSON.stringify(indexSpec.columns),
          );
          if (indexSpec.partialWhere) {
            const indexSql = (
              raw
                .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?;")
                .get(indexSpec.name) ?? {}
            ).sql;
            check(
              `${table}: index ${indexSpec.name} WHERE clause`,
              'schema',
              typeof indexSql === 'string' && indexSql.includes(indexSpec.partialWhere),
            );
          }
        }
        const fks = raw.prepare(`PRAGMA foreign_key_list (${table});`).all();
        check(
          `${table}: foreign keys exact`,
          'schema',
          JSON.stringify(fks.map((fk) => [fk.from, fk.table, fk.to]).sort()) ===
            JSON.stringify(
              spec.foreignKeys.map((fk) => [fk.column, fk.targetTable, fk.targetColumn]).sort(),
            ),
        );
      }
      const bookkeeping = raw
        .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
        .all()
        .map((row) => row.version);
      // Q4 reconciliation (frozen Q4 contract §12): migration 3
      // (qlt-context-assembly) is applied on top of the frozen Q2 schema.
      // Q5 reconciliation (Q5 freeze §14): migration 4
      // (qlt-memory-mode-policy) is applied on top of the frozen Q4
      // schema; the bookkeeping assertion is re-pinned to the full applied
      // list. The frozen Q2 inventory checks above are unchanged.
      check(
        `migration bookkeeping is [1, 2, 3, ${QLT_SHARED_WORLD_SCHEMA_VERSION}]`,
        'schema',
        JSON.stringify(bookkeeping) === JSON.stringify([1, 2, 3, QLT_SHARED_WORLD_SCHEMA_VERSION]),
      );
      check(
        `QLT_SHARED_WORLD_SCHEMA_VERSION === 4 (Q5 additive migration)`,
        'schema',
        QLT_SHARED_WORLD_SCHEMA_VERSION === 4,
      );
      check(
        'PRAGMA foreign_keys enforced on the connection',
        'schema',
        raw.prepare('PRAGMA foreign_keys;').get().foreign_keys === 1,
      );
    } finally {
      raw.close();
    }

    // Restart stability: reopen through the store; the dump is identical.
    store.close();
    const reopened = createSharedWorldSqlite({ path: dbPath, clock: () => 1_700_000_000_000 });
    reopened.close();
    check(
      'reopening mutates no schema state (identical sqlite_master dump)',
      'schema',
      dump() === before,
    );
    console.log(`  schema: ${sections.schema} checks`);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
}

// ---------------------------------------------------------------------------
// 2. DETERMINISTIC CORE
// ---------------------------------------------------------------------------
console.log('\n[2] DETERMINISTIC CORE — serialization, resolution, staleness, authority');
{
  const left = { statement: 's', subject: 'x', epistemicType: 'E1' };
  const right = { epistemicType: 'E1', subject: 'x', statement: 's' };
  check(
    'fingerprint is key-order invariant',
    'deterministic',
    contentFingerprint(left) === contentFingerprint(right),
  );
  check(
    'canonical JSON is key-order invariant',
    'deterministic',
    canonicalJson(left) === canonicalJson(right),
  );
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  check(
    'canonical JSON refuses functions',
    'deterministic',
    throws(() => canonicalJson({ f: () => 1 })),
  );
  check(
    'canonical JSON refuses BigInt',
    'deterministic',
    throws(() => canonicalJson({ b: 1n })),
  );
  const cyclic = {};
  cyclic['self'] = cyclic;
  check(
    'canonical JSON refuses cycles',
    'deterministic',
    throws(() => canonicalJson(cyclic)),
  );

  const mk = (id, status, retention) => ({
    id,
    status,
    retentionState: retention,
    epistemicType: 'E1',
    effectiveAtMs: 1,
    createdAtMs: 1,
  });
  const crafted = [
    {
      ...mk('qlt-b', 'active', 'currently-relevant'),
      subject: 's',
      content: { statement: 'b' },
      version: 1,
    },
    {
      ...mk('qlt-a', 'active', 'currently-relevant'),
      subject: 's',
      content: { statement: 'a' },
      version: 1,
    },
    {
      ...mk('qlt-c', 'retired', 'currently-relevant'),
      subject: 's',
      content: { statement: 'c' },
      version: 2,
    },
  ];
  check(
    'pure resolution breaks ties by id ASC and skips ineligible',
    'deterministic',
    resolveCurrentEffective(crafted)?.id === 'qlt-a',
  );
  check(
    'pure resolution returns undefined with no eligible record',
    'deterministic',
    resolveCurrentEffective([crafted[2]]) === undefined,
  );

  const stalenessCases = [
    [
      'target-version-changed',
      { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 2 },
      { version: 1, status: 'active', retentionState: 'currently-relevant' },
      { retentionState: 'currently-relevant' },
      'target-version-changed',
    ],
    [
      'target-superseded',
      { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 1 },
      { version: 1, status: 'superseded', retentionState: 'currently-relevant' },
      { retentionState: 'currently-relevant' },
      'target-superseded',
    ],
    [
      'target-ineligible (missing)',
      { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 1 },
      undefined,
      { retentionState: 'currently-relevant' },
      'target-ineligible',
    ],
    [
      'target-ineligible (removed)',
      { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 1 },
      { version: 1, status: 'active', retentionState: 'user-removed' },
      { retentionState: 'currently-relevant' },
      'target-ineligible',
    ],
    [
      'source-missing',
      { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
      undefined,
      undefined,
      'source-missing',
    ],
    [
      'source-removed',
      { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
      undefined,
      { retentionState: 'user-removed' },
      'source-removed',
    ],
  ];
  for (const [label, proposal, target, source, reason] of stalenessCases) {
    const result = proposalStaleness(proposal, target, source);
    check(
      `staleness matrix: ${label}`,
      'deterministic',
      result.stale === true && result.reason === reason,
    );
  }
  check(
    'staleness matrix: unchanged references are FRESH (no time input exists)',
    'deterministic',
    JSON.stringify(
      proposalStaleness(
        { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
        undefined,
        { retentionState: 'currently-relevant' },
      ),
    ) === '{"stale":false}',
  );

  const authority = [
    ['canConfirm(user)', canConfirm(USER) === true],
    ['canConfirm(agent)', canConfirm(AGENT) === false],
    ['canConfirm(empty)', canConfirm('') === false],
    ['canCorrect(agent)', canCorrect(AGENT) === false],
    ['canAuthor(agent)', canAuthor(AGENT) === false],
    ['canPropose(agent)', canPropose(AGENT) === true],
    ['canPropose(user)', canPropose(USER) === true],
    ['canWithdraw(agent)', canWithdraw(AGENT) === true],
  ];
  for (const [label, ok] of authority) {
    check(`authority: ${label}`, 'deterministic', ok);
  }
  console.log(`  deterministic: ${sections.deterministic} checks`);
}

// ---------------------------------------------------------------------------
// 3. REPOSITORY SMOKE (deterministic ids/clock)
// ---------------------------------------------------------------------------
console.log('\n[3] REPOSITORY SMOKE — ceremony, correction, idempotency, refusals');
{
  const dir = mkdtempSync(join(tmpdir(), 'qlt-verify-q2-repo-'));
  const dbPath = join(dir, 'shared-world.db');
  let counter = 0;
  try {
    const store = createSharedWorldSqlite({
      path: dbPath,
      clock: () => 1_700_000_000_000,
      ids: {
        proposalId: () => `qlt-vp-${(counter += 1)}`,
        recordId: () => `qlt-vr-${(counter += 1)}`,
        correctionId: () => `qlt-vc-${(counter += 1)}`,
        linkId: () => `qlt-vl-${(counter += 1)}`,
      },
    });
    const thread = await store.createThread({ title: 'verify-q2' });

    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: {
        subject: 'verify',
        epistemicType: 'E3',
        honestyState: 'likely',
        confidence: 'qualified',
        statement: 'verified statement',
      },
      proposedBy: AGENT,
      sourceThreadId: thread.id,
    });
    check('proposal persists at version 1', 'repository', proposal.version === 1);
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    const outcome = await store.meaning.confirmProposal({
      proposalId: proposal.id,
      confirmedBy: USER,
    });
    check(
      'ceremony confirm creates exactly one record',
      'repository',
      outcome.createdRecords.length === 1,
    );
    const links = await store.meaning.listSourceLinks({
      fromRecordId: outcome.createdRecords[0].id,
    });
    check(
      'created record carries a proposed-from link to the proposal',
      'repository',
      links.some((link) => link.relation === 'proposed-from' && link.toRef === proposal.id),
    );

    const correction = await store.meaning.applyCorrection({
      subjectRecordId: outcome.createdRecords[0].id,
      subjectFamily: 'claim',
      correctionKey: 'verify-key',
      key: 'verify-correction-key',
      content: { statement: 'verified successor' },
      correctedBy: USER,
    });
    check(
      'correction supersedes the predecessor (append-only lineage)',
      'repository',
      correction.predecessor.status === 'superseded' && correction.successor.version === 1,
    );

    const replay = await store.meaning.applyCorrection({
      subjectRecordId: outcome.createdRecords[0].id,
      subjectFamily: 'claim',
      correctionKey: 'verify-key',
      key: 'verify-correction-key',
      content: { statement: 'verified successor' },
      correctedBy: USER,
    });
    check(
      'keyed correction replay converges to the same correction',
      'repository',
      replay.correction.id === correction.correction.id,
    );

    const staleProposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'stale', reason: 'r' },
      proposedBy: AGENT,
      sourceThreadId: thread.id,
      targetRecord: { recordId: correction.successor.id, family: 'claim', version: 99 },
    });
    await store.meaning.markProposalAwaitingDecision(staleProposal.id);
    const staleRefused = await store.meaning
      .confirmProposal({ proposalId: staleProposal.id, confirmedBy: USER })
      .then(
        () => false,
        (error) => error instanceof QltMeaningError && error.code === 'QLT_PROPOSAL_STALE',
      );
    check('stale confirm refused with QLT_PROPOSAL_STALE', 'repository', staleRefused === true);

    const agentRefused = await store.meaning
      .confirmProposal({ proposalId: staleProposal.id, confirmedBy: AGENT })
      .then(
        () => false,
        (error) => error instanceof QltMeaningError && error.code === 'QLT_CONFIRMER_INVALID',
      );
    check(
      'agent confirmer refused with QLT_CONFIRMER_INVALID',
      'repository',
      agentRefused === true,
    );

    store.close();
    console.log(`  repository: ${sections.repository} checks`);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
}

// ---------------------------------------------------------------------------
// 4. STRUCTURAL NO-WIRING
// ---------------------------------------------------------------------------
console.log('\n[4] STRUCTURAL — no production path reaches the meaning repository');
await (async () => {
  const forbidden = ['meaning-store', 'meaning-contract', 'sharedWorld.meaning', '.meaning'];
  const roots = ['src/routes', 'src/lib/islands', 'src/lib/components'];
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  for (const root of roots) walk(root);
  check('scan surface is non-empty', 'structural', files.length > 0);
  let clean = true;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const marker of forbidden) {
      if (content.includes(marker)) {
        clean = false;
        console.error(`  ${file} references ${marker}`);
      }
    }
  }
  check('no route/island/component references the meaning store', 'structural', clean);

  // Phase Q3 reconciliation (frozen Q3 contract §16, §18): the compiled
  // plan now legitimately carries the Q3 ceremony surface alongside the
  // UNCHANGED five thread actions. The Q2-era 'exactly five actions' pin is
  // re-pinned to the frozen Q3 inventory — never weakened: the thread
  // surface and the ceremony ops are both exact-inventory enforced, and the
  // dynamic no-meaning-store scan above is unchanged.
  const ceremony = await import('../src/lib/sharedworld/ceremony-contract.ts');
  const plan = getCompiledPlan();
  const actionIds = Object.keys(plan.actions).sort();
  const threadActionIds = Object.keys(plan.actions)
    .filter((id) => plan.actions[id].resourceId === 'qlt.threads')
    .sort();
  check(
    'the compiled plan still carries EXACTLY the five declared thread actions',
    'structural',
    JSON.stringify(threadActionIds) === JSON.stringify([...ceremony.QLT_THREAD_ACTION_IDS].sort()),
  );
  check(
    // Q5 reconciliation (Q5 freeze §14): the frozen Q3 action inventory is
    // unchanged and EXTENDED by exactly the two Q5 actions; the frozen Q3
    // contract data is not rewritten and no other assertion is weakened.
    'the compiled plan carries EXACTLY the frozen Q3 action inventory PLUS exactly the two Q5 actions',
    'structural',
    JSON.stringify(actionIds) ===
      JSON.stringify(
        [
          ...ceremony.QLT_THREAD_ACTION_IDS,
          ...ceremony.QLT_MEMORY_ACTION_IDS,
          'act.queryInspection',
          'act.setMemoryMode',
        ].sort(),
      ),
  );
  check(
    'every plan action targets qlt.threads, the Q3 qlt.memory resource, or the two Q5 resources',
    'structural',
    Object.values(plan.actions).every((action) =>
      ['qlt.threads', 'qlt.memory', 'qlt.inspection', 'qlt.memory-policy'].includes(
        action.resourceId,
      ),
    ),
  );
  check(
    'the thread resource declares exactly its four mutations',
    'structural',
    JSON.stringify(threadResource.mutations.map((m) => m.op).sort()) ===
      JSON.stringify(['archive', 'create', 'rename', 'reopen']),
  );
  check(
    'the Q3 memory resource declares exactly the frozen thirteen mutation ops',
    'structural',
    JSON.stringify(
      Object.values(plan.actions)
        .filter((action) => action.resourceId === 'qlt.memory' && action.kind === 'mutation')
        .map((action) => action.op)
        .sort(),
    ) === JSON.stringify([...ceremony.QLT_MEMORY_MUTATION_OPS].sort()),
  );
  console.log(`  structural: ${sections.structural} checks`);
})();

// ---------------------------------------------------------------------------
// 5. RELEASE PINS (light; the full gate remains verify:consumer)
// ---------------------------------------------------------------------------
console.log('\n[5] RELEASE PINS — exact VICT 0.3.0-rc.1 identity unchanged');
{
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const victDeps = Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }).filter(([name]) => name.startsWith('@victframework/'));
  check(
    'all declared @victframework/* pins are exactly 0.3.0-rc.1',
    'pins',
    victDeps.length >= 9 && victDeps.every(([, specifier]) => specifier === '0.3.0-rc.1'),
  );
  const require = createRequire(join(process.cwd(), 'package.json'));
  const entry = require.resolve('@victframework/server');
  const packageDir = entry.replace(/\\/g, '/').split('/dist/')[0];
  const serverPackage = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  check(
    'installed @victframework/server is exactly 0.3.0-rc.1',
    'pins',
    serverPackage.version === '0.3.0-rc.1',
  );
  console.log(`  pins: ${sections.pins} checks`);
}

// ---------------------------------------------------------------------------
// 6. SELF-WIRING
// ---------------------------------------------------------------------------
console.log('\n[6] WIRING — the focused gate is composed into the package and aggregate');
{
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  check(
    'package.json declares verify:q2',
    'wiring',
    packageJson.scripts['verify:q2'] !== undefined &&
      String(packageJson.scripts['verify:q2']).includes('verify-q2.mjs'),
  );
  const aggregate = readFileSync('scripts/verify-quellight.mjs', 'utf8');
  check(
    'the aggregate verifier invokes verify-q2.mjs as its own recorded step',
    'wiring',
    aggregate.includes('verify-q2.mjs') && aggregate.includes('verify:q2'),
  );
  console.log(`  wiring: ${sections.wiring} checks`);
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:q2: FAILED with ${failures.length} finding(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const total = Object.values(sections).reduce((sum, count) => sum + count, 0);
console.log(
  `verify:q2: PASS — ${total} checks green (schema ${sections.schema}, deterministic ${sections.deterministic}, repository ${sections.repository}, structural ${sections.structural}, pins ${sections.pins}, wiring ${sections.wiring})`,
);
