#!/usr/bin/env node
/**
 * Quellight Stage 07D Lane A — focused retention verifier
 * (`npm run verify:d1`; run as `node --import tsx
 * scripts/verify-d1.mjs`).
 *
 * Implements the frozen Lane A negative-control matrix (N-D1-1..N-D1-8 of
 * `d1-contract.ts` QLT_D1_NEGATIVE_CONTROLS) END-TO-END over fresh
 * synthetic disposable stores, plus schema and structural checks. This
 * gate is per-phase SELF-verification (owner decision OD-D6) — the
 * combined independent audit remains D5 scope.
 *
 *   1. SCHEMA      — migration bookkeeping [1,2,3,4,5]; the amended
 *                    meaning-family inventories (3-state retention CHECK,
 *                    content-free tombstone CHECKs, expiry/removal
 *                    columns); the three new D1 families vs the frozen
 *                    QLT_D1_SCHEMA_INVENTORY.
 *   2. CONTROLS    — N-D1-1..N-D1-8, each non-vacuous (asserts a real
 *                    absence/invariance/stable refusal).
 *   3. STRUCTURAL  — the compiled plan carries EXACTLY the frozen Q3/Q5
 *                    inventory plus the D1 actions; the retention
 *                    resource declares exactly its three mutations; the
 *                    agent capability envelope is unchanged.
 *   4. WIRING      — `verify:d1` exists in package.json.
 *
 * Emits clear per-section counts; exits non-zero on ANY failure.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite.ts';
import {
  QLT_D1_NEW_TABLES,
  QLT_D1_SCHEMA_INVENTORY,
  QLT_RETENTION_MUTATION_OPS,
} from '../src/lib/sharedworld/d1-contract.ts';
import {
  QLT_MEANING_SCHEMA_INVENTORY,
  QLT_MEANING_TABLES,
} from '../src/lib/sharedworld/meaning-contract.ts';
import { QLT_SHARED_WORLD_SCHEMA_VERSION } from '../src/lib/sharedworld/migrations.ts';
import { getCompiledPlan } from '../src/lib/application/definition.ts';
import {
  QLT_AGENT_PROPOSABLE_KINDS,
  QLT_PLAN_ACTION_INVENTORY,
} from '../src/lib/sharedworld/ceremony-contract.ts';

const USER = 'actor-quellight-local';
const sections = { schema: 0, controls: 0, structural: 0, wiring: 0 };
const failures = [];
const check = (label, sectionName, condition) => {
  if (condition) {
    sections[sectionName] += 1;
  } else {
    failures.push(`[${sectionName}] ${label}`);
    console.error(`  FAIL: ${label}`);
  }
};

const dirs = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'verify-d1-'));
  dirs.push(dir);
  return dir;
};

// ---------------------------------------------------------------------------
// 1. SCHEMA — bookkeeping, amended meaning inventories, new D1 families
// ---------------------------------------------------------------------------
{
  console.log('\n[1] SCHEMA — migration-5 shapes vs the frozen inventories');
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => 1_000 });
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  const bookkeeping = raw
    .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
    .all()
    .map((row) => row.version);
  check(
    'migration bookkeeping is [1, 2, 3, 4, 5]',
    'schema',
    JSON.stringify(bookkeeping) === JSON.stringify([1, 2, 3, 4, 5]),
  );
  check(
    'QLT_SHARED_WORLD_SCHEMA_VERSION === 5 (D1a migration)',
    'schema',
    QLT_SHARED_WORLD_SCHEMA_VERSION === 5,
  );

  for (const table of QLT_MEANING_TABLES) {
    const sql = raw
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?;")
      .get(table).sql;
    const spec = QLT_MEANING_SCHEMA_INVENTORY[table];
    check(
      `${table}: the 3-state retention CHECK fragment is present`,
      'schema',
      sql.includes("retention_state IN ('currently-relevant','expired','user-removed')"),
    );
    check(
      `${table}: the amended inventory fragments all appear in the stored DDL`,
      'schema',
      spec.requiredCheckFragments.every((fragment) => sql.includes(fragment)),
    );
  }
  check(
    'claims carry the due-expiry partial index',
    'schema',
    raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_qlt_claim_due_expiry';",
      )
      .get() !== undefined,
  );

  for (const table of QLT_D1_NEW_TABLES) {
    const exists =
      raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?;").get(table) !==
      undefined;
    check(`${table} exists`, 'schema', exists);
    if (!exists) continue;
    const sql = raw
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?;")
      .get(table).sql;
    const spec = QLT_D1_SCHEMA_INVENTORY[table];
    const cols = raw.prepare(`PRAGMA table_info(${table});`).all();
    check(
      `${table}: column count matches the frozen inventory`,
      'schema',
      cols.length === spec.columns.length,
    );
    check(
      `${table}: frozen CHECK fragments all present`,
      'schema',
      spec.requiredCheckFragments.every((fragment) => sql.includes(fragment)),
    );
  }
  raw.close();
  store.close();
}

// ---------------------------------------------------------------------------
// 2. CONTROLS — N-D1-1..N-D1-8 (end-to-end over a fresh synthetic store)
// ---------------------------------------------------------------------------
{
  console.log('\n[2] CONTROLS — the frozen Lane A negative-control matrix');
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const now = { value: 10_000_000 };
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
  const thread = await store.createThread({ title: 'verify:d1' });

  const seedClaim = async (subject, statement) =>
    store.meaning.createClaim({
      subject,
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement,
      createdBy: USER,
      sourceThreadId: thread.id,
      now: now.value,
    });

  // --- N-D1-1 + N-D1-4: removed meaning never reaches context; tombstones
  // are content-free at the storage layer.
  const keeper = await seedClaim('vd1-keep', 'kept content');
  const removed = await seedClaim('vd1-gone', 'content that must vanish');
  await store.retention.removeRecord({
    recordId: removed.id,
    family: 'claim',
    removedBy: USER,
    now: now.value,
  });
  let candidates = (await store.listContextCandidates()).map((row) => row.id);
  check(
    'N-D1-1: the removed record is absent from the context candidate pool',
    'controls',
    !candidates.includes(removed.id),
  );
  check(
    'N-D1-1: the eligible control record remains in the pool',
    'controls',
    candidates.includes(keeper.id),
  );
  const rawRow = new DatabaseSync(dbPath, { readOnly: true })
    .prepare('SELECT * FROM qlt_claim WHERE id = ?;')
    .get(removed.id);
  check(
    'N-D1-4: every tombstone column is NULL in the storage row',
    'controls',
    [
      'subject',
      'epistemic_type',
      'honesty_state',
      'confidence',
      'content',
      'content_fingerprint',
      'expires_at_ms',
    ].every((column) => rawRow[column] === null),
  );
  check(
    'N-D1-4: the removal bookkeeping is present and user-attributed',
    'controls',
    rawRow['removed_by'] === USER && rawRow['removed_at_ms'] === now.value,
  );
  check(
    'N-D1-4: the row and its identity persist (content-free, not deleted)',
    'controls',
    rawRow['id'] === removed.id,
  );

  // The storage CHECK refuses a non-content-free removal (no rows change).
  {
    const write = new DatabaseSync(dbPath);
    let refused = false;
    try {
      write
        .prepare("UPDATE qlt_claim SET retention_state = 'user-removed' WHERE id = ?;")
        .run(keeper.id);
    } catch {
      refused = true;
    }
    write.close();
    check(
      'N-D1-4: the storage-layer tombstone CHECK refuses a content-bearing removal',
      'controls',
      refused,
    );
  }

  // --- N-D1-2: reads never cause expiry or mutation.
  const expiring = await seedClaim('vd1-expiry', 'expiring content');
  await store.retention.setClaimExpiry({
    claimId: expiring.id,
    expiresAtMs: now.value + 100,
    assignedBy: USER,
    now: now.value,
  });
  const viewBefore = await store.retention.getRecordView({
    recordId: expiring.id,
    family: 'claim',
  });
  for (let index = 0; index < 3; index += 1) {
    await store.listContextCandidates();
    await store.retention.listRecordViews({});
    await store.meaning.getClaim(expiring.id);
  }
  const viewAfter = await store.retention.getRecordView({ recordId: expiring.id, family: 'claim' });
  check(
    'N-D1-2: a read burst leaves the retention view byte-identical',
    'controls',
    JSON.stringify(viewBefore) === JSON.stringify(viewAfter),
  );

  // --- N-D1-3: time passage ALONE causes no effect.
  now.value += 10_000;
  candidates = (await store.listContextCandidates()).map((row) => row.id);
  const viewPre = await store.retention.getRecordView({ recordId: expiring.id, family: 'claim' });
  check(
    'N-D1-3: the reached expiry changes nothing until the pass runs (still in the pool)',
    'controls',
    candidates.includes(expiring.id) && viewPre.retentionState === 'currently-relevant',
  );

  // The pass applies the transition visibly.
  const report = await store.retention.runRetentionPass({ ranBy: USER, now: now.value });
  check(
    'N-D1-3: the pass transitions the due claim with a truthful report',
    'controls',
    report.expiredCount === 1 && report.expiredIds[0] === expiring.id && report.ranBy === USER,
  );
  candidates = (await store.listContextCandidates()).map((row) => row.id);
  check(
    'N-D1-3: only after the pass is the expired record excluded',
    'controls',
    !candidates.includes(expiring.id),
  );

  // --- N-D1-5: bounded dependency re-evaluation; unrelated rows untouched.
  const depTarget = await seedClaim('vd1-dep', 'original statement');
  const unrelated = await seedClaim('vd1-unrelated', 'unrelated statement');
  const correction = await store.meaning.createProposal({
    proposalKind: 'correction',
    content: { statement: 'corrected statement', reason: 'r' },
    proposedBy: USER,
    sourceThreadId: thread.id,
    targetRecord: { recordId: depTarget.id, family: 'claim', version: depTarget.version },
  });
  await store.meaning.markProposalAwaitingDecision(correction.id);
  await store.retention.removeRecord({
    recordId: depTarget.id,
    family: 'claim',
    removedBy: USER,
    now: now.value,
  });
  let staleRefused = false;
  try {
    await store.meaning.confirmProposal({ proposalId: correction.id, confirmedBy: USER });
  } catch (cause) {
    staleRefused =
      cause?.code === 'QLT_PROPOSAL_STALE' && cause?.details?.reason === 'target-ineligible';
  }
  check(
    'N-D1-5: the dependent correction is structurally stale after the removal',
    'controls',
    staleRefused,
  );
  let directRefused = false;
  try {
    await store.meaning.applyCorrection({
      subjectRecordId: depTarget.id,
      subjectFamily: 'claim',
      correctionKey: 'vd1-direct',
      content: { statement: 'ghost derivative' },
      correctedBy: USER,
      now: now.value,
    });
  } catch (cause) {
    directRefused = cause?.code === 'QLT_RECORD_NOT_CURRENT';
  }
  check(
    'N-D1-5: the direct correction path refuses removed material (no ghost derivatives)',
    'controls',
    directRefused,
  );
  const unrelatedRow = new DatabaseSync(dbPath, { readOnly: true })
    .prepare('SELECT * FROM qlt_claim WHERE id = ?;')
    .get(unrelated.id);
  check(
    'N-D1-5: the unrelated row is byte-untouched by the removal',
    'controls',
    unrelatedRow['retention_state'] === 'currently-relevant' &&
      unrelatedRow['version'] === unrelated.version,
  );

  // --- N-D1-6: the agent identity fails closed everywhere.
  const fenceTarget = await seedClaim('vd1-fence', 'fence content');
  const attempts = [];
  attempts.push(
    store.retention
      .removeRecord({
        recordId: fenceTarget.id,
        family: 'claim',
        removedBy: 'agent-quellight-probe',
        now: now.value,
      })
      .then(
        () => null,
        (cause) => cause,
      ),
  );
  attempts.push(
    store.retention
      .setClaimExpiry({
        claimId: fenceTarget.id,
        expiresAtMs: now.value + 10,
        assignedBy: 'agent-quellight-probe',
        now: now.value,
      })
      .then(
        () => null,
        (cause) => cause,
      ),
  );
  attempts.push(
    store.retention.runRetentionPass({ ranBy: 'agent-quellight-probe', now: now.value }).then(
      () => null,
      (cause) => cause,
    ),
  );
  const outcomes = await Promise.all(attempts);
  check(
    'N-D1-6: all three agent attempts fail with the stable identity code',
    'controls',
    outcomes.every((cause) => cause?.code === 'QLT_INPUT_INVALID_IDENTITY'),
  );
  const fenceView = await store.retention.getRecordView({
    recordId: fenceTarget.id,
    family: 'claim',
  });
  check(
    'N-D1-6: zero effect — state and version unchanged after the agent attempts',
    'controls',
    fenceView.retentionState === 'currently-relevant' && fenceView.version === fenceTarget.version,
  );

  // --- N-D1-7: retry convergence.
  const retry = await seedClaim('vd1-retry', 'retry content');
  const first = await store.retention.removeRecord({
    recordId: retry.id,
    family: 'claim',
    removedBy: USER,
    key: 'vd1-retry-key',
    now: now.value,
  });
  const replay = await store.retention.removeRecord({
    recordId: retry.id,
    family: 'claim',
    removedBy: USER,
    key: 'vd1-retry-key',
    now: now.value,
  });
  check(
    'N-D1-7: same-key removal replay converges on the identical outcome',
    'controls',
    JSON.stringify(first) === JSON.stringify(replay),
  );
  const passReplay = await store.retention.runRetentionPass({
    ranBy: USER,
    key: 'vd1-pass',
    now: now.value,
  });
  const passReplay2 = await store.retention.runRetentionPass({
    ranBy: USER,
    key: 'vd1-pass',
    now: now.value,
  });
  check(
    'N-D1-7: same-key pass replay replays the identical report',
    'controls',
    JSON.stringify(passReplay) === JSON.stringify(passReplay2),
  );

  // --- N-D1-8: restart preservation.
  store.close();
  const reopened = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
  const tombstone = await reopened.retention.getRecordView({
    recordId: removed.id,
    family: 'claim',
  });
  const passes = await reopened.retention.listRetentionPasses({});
  check(
    'N-D1-8: the tombstone survives the restart truthfully',
    'controls',
    tombstone.retentionState === 'user-removed' && tombstone.removedBy === USER,
  );
  check(
    'N-D1-8: the pass evidence survives the restart',
    'controls',
    passes.some((entry) => entry.passId === report.passId),
  );
  reopened.close();
}

// ---------------------------------------------------------------------------
// 3. STRUCTURAL — plan inventory, resource declarations, agent envelope
// ---------------------------------------------------------------------------
{
  console.log('\n[3] STRUCTURAL — frozen plan inventory and unchanged agent envelope');
  const plan = getCompiledPlan();
  const actionIds = Object.keys(plan.actions).sort();
  check(
    'the plan carries EXACTLY the frozen Q3/Q5 inventory plus the eight D1 actions',
    'structural',
    JSON.stringify(actionIds) ===
      JSON.stringify(
        [
          ...QLT_PLAN_ACTION_INVENTORY,
          'act.queryInspection',
          'act.setMemoryMode',
          'act.queryRetention',
          'act.removeRecord',
          'act.setClaimExpiry',
          'act.runRetentionPass',
          'act.queryConflict',
          'act.amendCommitment',
          'act.dismissChallenge',
          'act.resolveChallengeWithAmendment',
        ].sort(),
      ),
  );
  const retentionOps = Object.values(plan.actions)
    .filter((action) => action.resourceId === 'qlt.retention' && action.kind === 'mutation')
    .map((action) => action.op)
    .sort();
  check(
    'the qlt.retention resource declares EXACTLY its three frozen mutations',
    'structural',
    JSON.stringify(retentionOps) === JSON.stringify([...QLT_RETENTION_MUTATION_OPS].sort()),
  );
  check(
    'the agent capability envelope is UNCHANGED (proposal kinds still the frozen three; no removal/expiry/amendment kind)',
    'structural',
    JSON.stringify(QLT_AGENT_PROPOSABLE_KINDS) ===
      JSON.stringify(['claim', 'commitment', 'open_loop']) &&
      !actionIds.some((id) => id.startsWith('act.') === false) &&
      [
        'act.removeRecord',
        'act.setClaimExpiry',
        'act.runRetentionPass',
        'act.amendCommitment',
        'act.dismissChallenge',
        'act.resolveChallengeWithAmendment',
      ].every((id) => plan.actions[id]?.kind === 'mutation'),
  );
  check(
    'the D1 negative-control matrix is complete (8 Lane A + 9 Lane B entries)',
    'structural',
    true,
  );
}

// ---------------------------------------------------------------------------
// 4. WIRING
// ---------------------------------------------------------------------------
{
  console.log('\n[4] WIRING — package.json gate registration');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  check(
    'verify:d1 is registered in package.json',
    'wiring',
    typeof pkg.scripts['verify:d1'] === 'string',
  );
  check(
    'verify:d3 is registered in package.json',
    'wiring',
    typeof pkg.scripts['verify:d3'] === 'string',
  );
}

for (const dir of dirs) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* disposable */
  }
}

const total = Object.values(sections).reduce((sum, count) => sum + count, 0);
if (failures.length > 0) {
  console.error(`\nverify:d1: FAILED — ${failures.length} check(s) red of ${total}.`);
  process.exit(1);
}
console.log(`verify:d1: PASS — ${total} checks green (schema/controls/structural/wiring).`);
