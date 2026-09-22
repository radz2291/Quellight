#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q5 — focused memory inspection and policy
 * verifier (`npm run verify:q5`; run as `node --import tsx
 * scripts/verify-q5.mjs`).
 *
 * Stable Q5 contract-conformance checks ONLY — the independent
 * adversarial matrix lives in `test/memory-authority.test.ts` (Lane D)
 * and the focused policy/assembly suite in `test/memory-policy.test.ts`
 * (Lane A):
 *
 *   1. CONTRACT     — the frozen Q5 contract data (mode identities,
 *                     migration-4 inventory, inspection identity, closed
 *                     query vocabulary, usage states, stable codes,
 *                     authority data).
 *   2. AMENDMENT    — the Q4-AMEND-1 reality: scope-excluded in the
 *                     frozen exclusion vocabulary; assembler version
 *                     q5-1; the Q4 fingerprint ALGORITHM inputs otherwise
 *                     unchanged.
 *   3. SCHEMA       — live migration-4 introspection vs the frozen
 *                     inventory (policy singleton + immutable per-turn
 *                     evidence; additive forward-only bookkeeping).
 *   4. INVENTORY    — the compiled plan carries exactly 21 actions
 *                     (19 frozen + exactly the two Q5 actions); the
 *                     memory resource still declares exactly the frozen
 *                     thirteen mutations; the capability envelope is
 *                     unchanged (no new capability; no inspection or
 *                     mode-change capability anywhere in the agent
 *                     surface).
 *   5. POLICY       — deterministic policy mechanics on a live store:
 *                     Q5-B-1 read purity on a freshly migrated store
 *                     (complete durable row-state dumps around pure
 *                     reads: implicit default in memory, ZERO effect,
 *                     repeated deterministic identity, write-path
 *                     ensureCurrent creates exactly one row, later reads
 *                     stay pure), value-idempotent setMode with
 *                     monotonic revision, invalid modes fail closed
 *                     (non-echoing), agent refusal, per-turn evidence
 *                     INSERT-or-converge immutability, assembler mode
 *                     semantics (across parity / scope-excluded / off),
 *                     restart persistence.
 *   6. INSPECTION   — bucket determinism (pending/current/history),
 *                     agent refusal, bounded pagination, no durable
 *                     effect from reads, historical Used-for-reply truth
 *                     (selected versions; superseded-since; tombstones),
 *                     never-contains (no context envelope, no markers,
 *                     no provider data in inspection output), plus the
 *                     Q5-H-1 NON-VACUOUS bucket-composition control (a
 *                     fixture with all six proposal statuses, canonical
 *                     current records, and closed/superseded records;
 *                     the exact UI query shape proves Pending holds only
 *                     pending proposals, Current holds zero proposals and
 *                     only canonical current records, History holds all
 *                     terminal proposals plus non-current records,
 *                     pagination is deterministic and duplicate-free,
 *                     and kind/thread filters never reintroduce
 *                     proposals). Basis: the frozen remediation contract
 *                     QUELLIGHT-STAGE-07C-PHASE-Q5-B1-H1-REMEDIATION-
 *                     CONTRACT.md §4 (controls 1 and 2; Q5-M-1).
 *   7. L-3          — correction-kind proposal confirmation through the
 *                     real store: exactly one successor and exactly one
 *                     applicable source link; replay converges; the
 *                     capability still rejects correction proposals.
 *   8. STRUCTURE    — routes/components perform no direct SQLite access;
 *                     the only ingress is /api/act over the released
 *                     boundary; no project-scope placeholder exists
 *                     anywhere (no projectId, no project tables).
 *   9. WIRING       — verify:q5 in package.json and the aggregate
 *                     verifier; the disclosed bounded reconciliation
 *                     re-pins present in verify-q2/q3/q4.
 *
 * Emits clear per-section counts; exits non-zero on ANY failure.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite.ts';
import {
  QLT_MEMORY_MODES,
  QLT_MEMORY_MODE_DEFAULT,
  QLT_MEMORY_MODE_POLICY_ID,
  QLT_MEMORY_MODE_MIGRATION,
  QLT_MEMORY_POLICY_SCHEMA_INVENTORY,
  QLT_MEMORY_POLICY_ROW_ID,
  QLT_TURN_MEMORY_POLICY_SCHEMA_INVENTORY,
  QLT_MEMORY_POLICY_TABLE,
  QLT_TURN_MEMORY_POLICY_TABLE,
  QLT_MEMORY_POLICY_MUTATION_OPS,
  QLT_MEMORY_MODE_INVALID,
} from '../src/lib/sharedworld/policy-contract.ts';
import {
  QLT_INSPECTION_RESOURCE_ID,
  QLT_INSPECTION_QUERY_OPS,
  QLT_INSPECTION_BUCKETS,
  QLT_INSPECTION_USAGE_STATES,
  QLT_INSPECTION_NEVER_CONTAINS,
  QLT_Q5_INSPECTION_INVARIANTS,
} from '../src/lib/sharedworld/inspection-contract.ts';
import {
  QLT_CONTEXT_EXCLUSION_CODES,
  QLT_CONTEXT_ASSEMBLER_VERSION,
} from '../src/lib/sharedworld/context-contract.ts';
import { QLT_PLAN_ACTION_INVENTORY } from '../src/lib/sharedworld/ceremony-contract.ts';
import { QLT_MEMORY_MUTATION_OPS } from '../src/lib/sharedworld/ceremony-contract.ts';
import { getCompiledPlan, bindings } from '../src/lib/application/definition.ts';
import { evaluateContextCandidates } from '../src/lib/sharedworld/context-assembler.ts';
import { canonicalJson, QltMeaningError } from '../src/lib/sharedworld/meaning-contract.ts';
import { createHash } from 'node:crypto';

const failures = [];
let passed = 0;
function check(label, section, condition) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`[${section}] ${label}`);
    console.error(`FAIL: [${section}] ${label}`);
  }
}

const tempDirs = [];
function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-verify-'));
  tempDirs.push(dir);
  return createSharedWorldSqlite({ path: join(dir, 'shared-world.db') });
}
function tempStoreWithDb() {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-verify-'));
  tempDirs.push(dir);
  const dbPath = join(dir, 'shared-world.db');
  return { store: createSharedWorldSqlite({ path: dbPath }), dbPath };
}
/**
 * Q5-B-1/Q5-M-1: complete durable row-state snapshot — every user table
 * of the shared-world db, fully ordered, via a READ-ONLY raw connection.
 * This inspects the durable rows themselves (not any store or inspection
 * projection), so a read that silently persisted anything would show.
 */
function durableDump(dbPath) {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const tables = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
      )
      .all()
      .map((row) => row.name);
    const parts = [];
    for (const table of tables) {
      const columns = raw
        .prepare(`PRAGMA table_info(${table});`)
        .all()
        .map((column) => column.name);
      const order = columns.map((column) => `"${column}"`).join(', ');
      const rows = raw.prepare(`SELECT * FROM ${table} ORDER BY ${order};`).all();
      parts.push(`${table}: ${JSON.stringify(rows)}`);
    }
    return parts.join('\n');
  } finally {
    raw.close();
  }
}
/** The fully ordered durable rows of ONE table (read-only connection). */
function tableRows(dbPath, table) {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return raw.prepare(`SELECT * FROM ${table} ORDER BY id;`).all();
  } finally {
    raw.close();
  }
}
function cleanup() {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort on Windows (D-6) */
    }
  }
}

// ---------------------------------------------------------------------------
// 1. CONTRACT — the frozen Q5 contract data
// ---------------------------------------------------------------------------
console.log('\n[1] CONTRACT — frozen Q5 policy and inspection data');
{
  check(
    'the Memory Mode vocabulary is the closed frozen triple',
    'contract',
    JSON.stringify(QLT_MEMORY_MODES) ===
      JSON.stringify(['across-conversations', 'per-conversation', 'off']),
  );
  check(
    'the durable default mode is across-conversations',
    'contract',
    QLT_MEMORY_MODE_DEFAULT === 'across-conversations',
  );
  check(
    'the policy identity is stable',
    'contract',
    QLT_MEMORY_MODE_POLICY_ID === 'qlt.memory-mode@1',
  );
  check(
    'migration 4 is the frozen additive policy migration',
    'contract',
    QLT_MEMORY_MODE_MIGRATION.version === 4 &&
      QLT_MEMORY_MODE_MIGRATION.name === 'qlt-memory-mode-policy',
  );
  check(
    'the policy singleton row identity is frozen',
    'contract',
    QLT_MEMORY_POLICY_ROW_ID === 'qlt-memory-policy-default',
  );
  check(
    'the inspection resource identity is frozen',
    'contract',
    QLT_INSPECTION_RESOURCE_ID === 'qlt.inspection',
  );
  check(
    'the inspection query vocabulary is the closed frozen five',
    'contract',
    JSON.stringify([...QLT_INSPECTION_QUERY_OPS].sort()) ===
      JSON.stringify(['getPolicy', 'getRecord', 'getTurn', 'listRecords', 'listTurns'].sort()),
  );
  check(
    'the inspection buckets are the frozen three',
    'contract',
    JSON.stringify([...QLT_INSPECTION_BUCKETS]) ===
      JSON.stringify(['pending', 'current', 'history']),
  );
  check(
    'the usage states are the frozen six',
    'contract',
    JSON.stringify([...QLT_INSPECTION_USAGE_STATES].sort()) ===
      JSON.stringify(['none', 'off', 'scope-empty', 'unavailable', 'unrecorded', 'used'].sort()),
  );
  check(
    'the never-contains list forbids the context envelope, markers, provider data, credentials',
    'contract',
    QLT_INSPECTION_NEVER_CONTAINS.some((entry) => entry.includes('context envelope')) &&
      QLT_INSPECTION_NEVER_CONTAINS.some((entry) => entry.includes('credentials')),
  );
  check(
    'the inspection structural invariants are frozen',
    'contract',
    QLT_Q5_INSPECTION_INVARIANTS.length >= 10,
  );
  check(
    'the policy mutation surface is exactly ONE op',
    'contract',
    JSON.stringify([...QLT_MEMORY_POLICY_MUTATION_OPS]) === JSON.stringify(['setMode']),
  );
  check(
    'the stable invalid-mode code is frozen',
    'contract',
    QLT_MEMORY_MODE_INVALID === 'QLT_MEMORY_MODE_INVALID',
  );
  console.log(`  contract: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 2. AMENDMENT — the Q4-AMEND-1 reality (algorithm otherwise unchanged)
// ---------------------------------------------------------------------------
console.log('\n[2] AMENDMENT — Q4-AMEND-1 (scope-excluded; assembler version)');
{
  check(
    'the frozen exclusion vocabulary includes scope-excluded (Q4-AMEND-1)',
    'amendment',
    QLT_CONTEXT_EXCLUSION_CODES.includes('scope-excluded'),
  );
  check(
    'the original eight exclusion codes are unchanged',
    'amendment',
    JSON.stringify(QLT_CONTEXT_EXCLUSION_CODES.filter((code) => code !== 'scope-excluded')) ===
      JSON.stringify([
        'ineligible',
        'superseded',
        'retention-ineligible',
        'provenance-invalid',
        'integrity-failed',
        'conflict-ambiguous',
        'budget',
        'evaluation-failed',
      ]),
  );
  check('the assembler version is q5-1', 'amendment', QLT_CONTEXT_ASSEMBLER_VERSION === 'q5-1');
  console.log(`  amendment: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 3. SCHEMA — live migration-4 introspection vs the frozen inventory
// ---------------------------------------------------------------------------
console.log('\n[3] SCHEMA — migration 4 introspection vs the frozen inventory');
{
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-verify-schema-'));
  tempDirs.push(dir);
  const dbPath = join(dir, 'shared-world.db');
  const store = createSharedWorldSqlite({ path: dbPath });
  store.memoryPolicy.ensureCurrent();
  store.memoryPolicy.recordTurnPolicy({
    turnId: 'turn-schema-probe',
    policy: { policyId: QLT_MEMORY_MODE_POLICY_ID, mode: 'across-conversations', revision: 1 },
  });
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const bookkeeping = raw
      .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
      .all()
      .map((row) => row.version);
    check(
      // D1a bounded re-pin: migration 5 applied on top (identity unchanged).
      'migration bookkeeping is exactly [1, 2, 3, 4, 5] (additive forward-only)',
      'schema',
      JSON.stringify(bookkeeping) === JSON.stringify([1, 2, 3, 4, 5]),
    );

    for (const [table, inventory, pk] of [
      [QLT_MEMORY_POLICY_TABLE, QLT_MEMORY_POLICY_SCHEMA_INVENTORY, 'id'],
      [QLT_TURN_MEMORY_POLICY_TABLE, QLT_TURN_MEMORY_POLICY_SCHEMA_INVENTORY, 'turn_id'],
    ]) {
      const columns = raw.prepare(`PRAGMA table_info(${table});`).all();
      const actual = columns.map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notnull === 1,
        pk: column.pk === 1,
      }));
      const expected = inventory.map((entry) => ({
        name: entry.name,
        type: entry.type,
        notNull: entry.notNull,
        pk: entry.name === pk,
      }));
      check(
        `${table} matches the frozen inventory exactly (columns/types/nullability/PK)`,
        'schema',
        JSON.stringify(actual) === JSON.stringify(expected),
      );
    }
    const modeCheck = raw
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(QLT_MEMORY_POLICY_TABLE);
    check(
      'the policy table carries the closed mode CHECK',
      'schema',
      String(modeCheck.sql).includes("'across-conversations','per-conversation','off'"),
    );
    check(
      'the policy table requires a user actor identity',
      'schema',
      String(modeCheck.sql).includes("updated_by GLOB 'actor-*'"),
    );
    const turnCheck = raw
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(QLT_TURN_MEMORY_POLICY_TABLE);
    check(
      'the per-turn evidence table carries the closed mode CHECK',
      'schema',
      String(turnCheck.sql).includes("'across-conversations','per-conversation','off'"),
    );
    check(
      'the per-turn evidence table carries the policy identity CHECK',
      'schema',
      String(turnCheck.sql).includes("'qlt.memory-mode@1'"),
    );
  } finally {
    raw.close();
    store.close();
  }
  console.log(`  schema: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 4. INVENTORY — the compiled plan and the unchanged capability envelope
// ---------------------------------------------------------------------------
console.log('\n[4] INVENTORY — 19 frozen + exactly the two Q5 actions; envelope unchanged');
{
  const plan = getCompiledPlan();
  const actionIds = Object.keys(plan.actions).sort();
  const expected = [
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
  ].sort();
  check(
    // D1a bounded re-pin: the plan grew by exactly the eight D1 actions.
    'the compiled plan carries exactly 29 actions (19 frozen + two Q5 + eight D1)',
    'inventory',
    actionIds.length === 29 && JSON.stringify(actionIds) === JSON.stringify(expected),
  );
  check(
    'exactly one Q5 query action exists for qlt.inspection',
    'inventory',
    Object.values(plan.actions).filter((a) => a.resourceId === QLT_INSPECTION_RESOURCE_ID)
      .length === 1,
  );
  const policyActions = Object.values(plan.actions).filter(
    (a) => a.resourceId === 'qlt.memory-policy',
  );
  check(
    'exactly one Q5 mutation action exists for qlt.memory-policy and it is setMode',
    'inventory',
    policyActions.length === 1 &&
      policyActions[0].op === 'setMode' &&
      policyActions[0].kind === 'mutation',
  );
  const memoryActions = Object.values(plan.actions).filter((a) => a.resourceId === 'qlt.memory');
  check(
    'the Q3 memory resource still carries exactly 1 query + 13 frozen mutations',
    'inventory',
    memoryActions.length === 14 &&
      JSON.stringify(
        memoryActions
          .filter((a) => a.kind === 'mutation')
          .map((a) => a.op)
          .sort(),
      ) === JSON.stringify([...QLT_MEMORY_MUTATION_OPS].sort()),
  );
  check(
    'the composed capability bindings remain EMPTY (no new capability of any kind)',
    'inventory',
    bindings.capabilities.length === 0,
  );
  check(
    'the agent envelope data is unchanged: no inspection or mode capability exists in the plan',
    'inventory',
    !actionIds.some((id) => id.toLowerCase().includes('inspect') && id !== 'act.queryInspection') &&
      // D1a bounded re-pin: 29 actions (21 + the eight D1 actions).
      actionIds.filter((id) => id.startsWith('act.')).length === 29,
  );
  console.log(`  inventory: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 5. POLICY — deterministic policy mechanics on live stores
// ---------------------------------------------------------------------------
console.log('\n[5] POLICY — resolver, setMode semantics, evidence immutability, modes, restart');
{
  // Q5-B-1/Q5-M-1 READ PURITY on a freshly migrated store (empty policy
  // table): complete durable row-state snapshots around PURE reads; then
  // the legitimate write path establishes exactly one row. Remediation
  // contract §4 control 1 (store-level mirror of the real-boundary test
  // in test/memory-authority.test.ts).
  {
    const { store, dbPath } = tempStoreWithDb();
    const before = durableDump(dbPath);
    const implicit = store.memoryPolicy.peekCurrent();
    check(
      'Q5-B-1: a fresh store resolves the IMPLICIT default in memory (across-conversations, revision 1)',
      'policy',
      implicit.mode === 'across-conversations' &&
        implicit.revision === 1 &&
        implicit.policyId === QLT_MEMORY_MODE_POLICY_ID,
    );
    check(
      'Q5-B-1: the implicit default is truthful — no durable row exists yet (no fabricated timestamp, no persisted-row claim)',
      'policy',
      store.memoryPolicy.peekPolicyRow() === undefined,
    );
    check(
      'Q5-B-1: the read created ZERO durable effect (complete durable row-state dump identical)',
      'policy',
      durableDump(dbPath) === before,
    );
    const repeat = store.memoryPolicy.peekCurrent();
    check(
      'Q5-B-1: repeated reads are deterministically identical and still zero-effect',
      'policy',
      JSON.stringify(repeat) === JSON.stringify(implicit) && durableDump(dbPath) === before,
    );
    const ensured = store.memoryPolicy.ensureCurrent();
    const policyRows = tableRows(dbPath, QLT_MEMORY_POLICY_TABLE);
    check(
      'Q5-B-1: write-path resolution (ensureCurrent) establishes EXACTLY ONE durable default row',
      'policy',
      ensured.mode === 'across-conversations' &&
        ensured.revision === 1 &&
        policyRows.length === 1 &&
        policyRows[0].policy_id === QLT_MEMORY_MODE_POLICY_ID &&
        policyRows[0].mode === 'across-conversations' &&
        policyRows[0].revision === 1 &&
        policyRows[0].updated_by === 'actor-quellight-local',
    );
    const afterEnsure = durableDump(dbPath);
    check(
      'Q5-B-1: after establishment, reads remain pure and resolve from the durable row',
      'policy',
      store.memoryPolicy.peekCurrent().mode === 'across-conversations' &&
        store.memoryPolicy.peekPolicyRow() !== undefined &&
        durableDump(dbPath) === afterEnsure,
    );
    store.close();
  }
  // Q5-B-1: legitimate write-path seeding semantics on an ABSENT row.
  {
    const store = tempStore();
    const sameMode = store.memoryPolicy.setMode({
      mode: 'across-conversations',
      updatedBy: 'actor-quellight-local',
    });
    check(
      'Q5-B-1: same-value setMode on an ABSENT row creates the one default row at revision 1 (no false bump)',
      'policy',
      sameMode.mode === 'across-conversations' && sameMode.revision === 1,
    );
    const changed = store.memoryPolicy.setMode({
      mode: 'per-conversation',
      updatedBy: 'actor-quellight-local',
    });
    check(
      'an effective change bumps the revision monotonically (first change from the default: revision 2)',
      'policy',
      changed.mode === 'per-conversation' && changed.revision === 2,
    );
    const again = store.memoryPolicy.setMode({
      mode: 'per-conversation',
      updatedBy: 'actor-quellight-local',
    });
    check(
      'a same-value set converges without a revision bump (value-idempotent)',
      'policy',
      again.revision === 2,
    );
    check(
      'the resolved mode is read back truthfully from the durable row (peekCurrent)',
      'policy',
      store.memoryPolicy.peekCurrent().mode === 'per-conversation' &&
        store.memoryPolicy.peekCurrent().revision === 2,
    );
    store.close();
  }
  // invalid modes + agent refusal
  {
    const store = tempStore();
    let refusedCode;
    try {
      store.memoryPolicy.setMode({ mode: 'project-wide', updatedBy: 'actor-quellight-local' });
    } catch (cause) {
      refusedCode = cause.code;
    }
    check(
      'an invalid mode fails closed with the stable non-echoing code (no input echo)',
      'policy',
      refusedCode === 'QLT_MEMORY_MODE_INVALID',
    );
    check(
      'the rejection message never echoes the invalid input',
      'policy',
      (() => {
        try {
          store.memoryPolicy.setMode({
            mode: 'per-thread-scope',
            updatedBy: 'actor-quellight-local',
          });
        } catch (cause) {
          return !String(cause.message).includes('per-thread-scope');
        }
        return false;
      })(),
    );
    let agentCode;
    try {
      store.memoryPolicy.setMode({ mode: 'off', updatedBy: 'agent-quellight' });
    } catch (cause) {
      agentCode = cause.code;
    }
    check(
      'an agent identity can never change the mode (zero effect; the default stays truthful)',
      'policy',
      agentCode !== undefined && store.memoryPolicy.peekCurrent().mode === 'across-conversations',
    );
    store.close();
  }
  // per-turn evidence immutability
  {
    const store = tempStore();
    store.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-e',
      policy: { policyId: QLT_MEMORY_MODE_POLICY_ID, mode: 'across-conversations', revision: 1 },
    });
    const second = store.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-e',
      policy: { policyId: QLT_MEMORY_MODE_POLICY_ID, mode: 'off', revision: 9 },
    });
    check(
      'per-turn evidence is INSERT-or-converge: a later write for the same turn never wins',
      'policy',
      second.mode === 'across-conversations' && second.policyRevision === 1,
    );
    store.memoryPolicy.setMode({ mode: 'off', updatedBy: 'actor-quellight-local' });
    check(
      'a mode change after the turn never rewrites the recorded evidence',
      'policy',
      store.memoryPolicy.getTurnPolicy('turn-e').mode === 'across-conversations',
    );
    store.close();
  }
  // assembler mode semantics
  {
    const { createHash: hash } = await import('node:crypto');
    function candidateOf(overrides) {
      const content = JSON.stringify({ statement: 'valid statement text' });
      const fingerprint = hash('sha256')
        .update(Buffer.from(canonicalJson(JSON.parse(content)), 'utf8'))
        .digest('hex');
      return {
        family: 'claim',
        version: 1,
        status: 'active',
        subject: `subject-${overrides.id}`,
        commitmentKey: null,
        loopKind: null,
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        content,
        contentFingerprint: fingerprint,
        sourceThreadId: null,
        createdBy: 'actor-quellight-local',
        updatedAtMs: 100,
        hasSuccessor: false,
        ...overrides,
      };
    }
    const candidates = [
      candidateOf({ id: 'current-1', sourceThreadId: 'thread-a' }),
      candidateOf({ id: 'global-1', sourceThreadId: null }),
      candidateOf({ id: 'other-1', sourceThreadId: 'thread-b' }),
    ];
    const across = evaluateContextCandidates({
      turnId: 't1',
      threadId: 'thread-a',
      candidates,
      mode: 'across-conversations',
    });
    const legacy = evaluateContextCandidates({ turnId: 't1', threadId: 'thread-a', candidates });
    check(
      'across-conversations preserves Q4 behavior byte-for-byte (parity with the legacy evaluation)',
      'policy',
      across.block === legacy.block && across.fingerprint === legacy.fingerprint,
    );
    check(
      'across-conversations selects all three layers in the frozen order',
      'policy',
      JSON.stringify(across.selected.map((e) => e.id)) ===
        JSON.stringify(['current-1', 'global-1', 'other-1']),
    );
    const scoped = evaluateContextCandidates({
      turnId: 't2',
      threadId: 'thread-a',
      candidates,
      mode: 'per-conversation',
    });
    check(
      'per-conversation keeps only the current-thread layer',
      'policy',
      JSON.stringify(scoped.selected.map((e) => e.id)) === JSON.stringify(['current-1']),
    );
    check(
      'per-conversation records truthful scope-excluded evidence for the excluded layers',
      'policy',
      JSON.stringify(scoped.excluded) ===
        JSON.stringify([
          { id: 'global-1', kind: 'claim', reason: 'scope-excluded' },
          { id: 'other-1', kind: 'claim', reason: 'scope-excluded' },
        ]),
    );
    check(
      'scope-excluded can never appear under across-conversations',
      'policy',
      across.excluded.every((entry) => entry.reason !== 'scope-excluded'),
    );
    const across2 = evaluateContextCandidates({
      turnId: 't3',
      threadId: 'thread-a',
      candidates,
      mode: 'across-conversations',
    });
    check(
      'different turns under the same state produce different fingerprints (turn identity is an input)',
      'policy',
      across2.fingerprint !== scoped.fingerprint,
    );
  }
  // restart persistence
  {
    const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-verify-restart-'));
    tempDirs.push(dir);
    const path = join(dir, 'shared-world.db');
    const first = createSharedWorldSqlite({ path });
    first.memoryPolicy.setMode({ mode: 'off', updatedBy: 'actor-quellight-local' });
    first.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-r',
      policy: { policyId: QLT_MEMORY_MODE_POLICY_ID, mode: 'per-conversation', revision: 2 },
    });
    first.close();
    const second = createSharedWorldSqlite({ path });
    check(
      'restart preserves the current default policy',
      'policy',
      second.memoryPolicy.peekCurrent().mode === 'off',
    );
    check(
      'restart preserves the immutable per-turn applied-policy evidence',
      'policy',
      second.memoryPolicy.getTurnPolicy('turn-r').mode === 'per-conversation',
    );
    second.close();
  }
  console.log(`  policy: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 6. INSPECTION — bucket determinism, authority, bounds, historical truth
// ---------------------------------------------------------------------------
console.log('\n[6] INSPECTION — buckets, authority, bounds, historical truth');
{
  const store = tempStore();
  const thread = await store.createThread({ id: 'insp-thread', title: 'Inspection' });
  const claim = await store.meaning.createClaim({
    subject: 'Inspection subject',
    epistemicType: 'E2',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'The original inspected statement.',
    createdBy: 'actor-quellight-local',
    sourceThreadId: thread.id,
  });
  const current = await store.listInspectionRecords({ bucket: 'current', limit: 50, offset: 0 });
  check(
    'the current bucket lists current-effective memory',
    'inspection',
    current.total === 1 && current.rows[0].id === claim.id && current.rows[0].status === 'active',
  );
  const pending = await store.listInspectionRecords({
    bucket: 'pending',
    threadId: thread.id,
    limit: 50,
    offset: 0,
  });
  check(
    'the pending bucket holds only awaiting proposals (none initially)',
    'inspection',
    pending.total === 0,
  );
  // correct the claim: the predecessor moves to History, the successor to Current.
  await store.meaning.applyCorrection({
    subjectRecordId: claim.id,
    subjectFamily: 'claim',
    correctionKey: 'insp-correction',
    content: { statement: 'The corrected inspected statement.' },
    correctedBy: 'actor-quellight-local',
    reason: 'inspection lineage probe',
    sourceThreadId: thread.id,
  });
  const history = await store.listInspectionRecords({
    bucket: 'history',
    threadId: thread.id,
    limit: 50,
    offset: 0,
  });
  check(
    'the corrected predecessor appears in History with its ending state',
    'inspection',
    history.total === 1 &&
      history.rows[0].id === claim.id &&
      history.rows[0].status === 'superseded',
  );
  const current2 = await store.listInspectionRecords({
    bucket: 'current',
    threadId: thread.id,
    limit: 50,
    offset: 0,
  });
  check(
    'the successor is the only current record after the correction',
    'inspection',
    current2.total === 1 && current2.rows[0].id !== claim.id,
  );
  const detail = await store.getInspectionRecord(claim.id, 'claim');
  check(
    'getRecord exposes append-only lineage (predecessor -> successor) and the correction reason',
    'inspection',
    detail !== undefined &&
      detail.successorIds.length === 1 &&
      detail.corrections.length === 1 &&
      detail.corrections[0].reason === 'inspection lineage probe',
  );
  check(
    'lineage is append-only: the predecessor row keeps its immutable content bytes',
    'inspection',
    detail.record.text === 'The original inspected statement.',
  );
  // pagination bounds
  let boundsCode;
  try {
    await store.listInspectionRecords({ bucket: 'current', limit: 101, offset: 0 });
  } catch (cause) {
    boundsCode = cause.code;
  }
  check('pagination beyond the frozen bound fails closed', 'inspection', boundsCode !== undefined);
  const page = await store.listInspectionRecords({ bucket: 'current', limit: 1, offset: 0 });
  check(
    'bounded pagination returns deterministic bounded pages',
    'inspection',
    page.rows.length === 1,
  );
  // turn data authorization
  const turnData = await store.getInspectionTurnData('insp-thread', 'missing-turn');
  check(
    'getTurnData for a missing turn is a truthful miss (no fabrication)',
    'inspection',
    turnData === undefined,
  );
  const wrongThread = await store.getInspectionTurnData('other-thread', 'whatever');
  check(
    'getTurnData never leaks another conversation’s turn',
    'inspection',
    wrongThread === undefined,
  );
  store.close();
  // --- Q5-H-1/Q5-M-1: bucket composition on a NON-VACUOUS fixture ---
  // Decided proposals exist, records are open AND closed, and every query
  // below uses the EXACT UI query shape (bucket only — no threadId, no
  // kind filter) unless a filter is itself the thing under test.
  {
    const { store } = tempStoreWithDb();
    const actor = 'actor-quellight-local';
    const threadA = await store.createThread({ id: 'bucket-thread-a', title: 'Buckets A' });
    const threadB = await store.createThread({ id: 'bucket-thread-b', title: 'Buckets B' });
    // Canonical current records (thread A).
    await store.meaning.createClaim({
      subject: 'Bucket current claim',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The canonical current claim of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    await store.meaning.createCommitment({
      commitmentKey: 'bucket-commitment-current',
      statement: 'The canonical current commitment of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    await store.meaning.createOpenLoop({
      subject: 'Bucket current loop',
      loopKind: 'undecided_question',
      detail: 'The canonical current open loop of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    // Second thread: proves thread filtering (its claim is current).
    await store.meaning.createClaim({
      subject: 'Bucket other-thread claim',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The other-thread claim of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadB.id,
    });
    // Non-vacuous proposal fixture: every proposal status exists.
    const claimProposal = (statement, subject) =>
      store.meaning.createProposal({
        proposalKind: 'claim',
        content: {
          subject,
          epistemicType: 'E2',
          honestyState: 'known',
          confidence: 'stated',
          statement,
        },
        proposedBy: actor,
        sourceThreadId: threadA.id,
      });
    await claimProposal('The still-proposed statement.', 'Bucket proposed');
    const awaiting = await claimProposal('The awaiting-decision statement.', 'Bucket awaiting');
    await store.meaning.markProposalAwaitingDecision(awaiting.id, { key: 'bucket-await-1' });
    const toConfirm = await claimProposal('The to-be-confirmed statement.', 'Bucket confirmed');
    await store.meaning.markProposalAwaitingDecision(toConfirm.id, { key: 'bucket-await-2' });
    await store.meaning.confirmProposal({
      proposalId: toConfirm.id,
      confirmedBy: actor,
      key: 'bucket-confirm-1',
    });
    const toReject = await claimProposal('The rejected statement.', 'Bucket rejected');
    await store.meaning.markProposalAwaitingDecision(toReject.id, { key: 'bucket-await-3' });
    await store.meaning.rejectProposal({
      proposalId: toReject.id,
      decidedBy: actor,
      reason: 'bucket fixture rejection',
    });
    const toAmend = await claimProposal('The original amended statement.', 'Bucket amended');
    await store.meaning.markProposalAwaitingDecision(toAmend.id, { key: 'bucket-await-4' });
    await store.meaning.amendProposal({
      proposalId: toAmend.id,
      amendedBy: actor,
      content: {
        subject: 'Bucket amended',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The amended replacement statement.',
      },
      reason: 'bucket fixture amendment',
    });
    // Amending also creates a NEW proposed amendment: pending grows to 3.
    const toWithdraw = await claimProposal('The withdrawn statement.', 'Bucket withdrawn');
    await store.meaning.markProposalAwaitingDecision(toWithdraw.id, { key: 'bucket-await-5' });
    await store.meaning.withdrawProposal({
      proposalId: toWithdraw.id,
      withdrawnBy: actor,
      reason: 'bucket fixture withdrawal',
    });
    // Closed/superseded records.
    const superseded = await store.meaning.createClaim({
      subject: 'Bucket superseded claim',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The soon-superseded statement of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    await store.meaning.applyCorrection({
      subjectRecordId: superseded.id,
      subjectFamily: 'claim',
      correctionKey: 'bucket-correction-1',
      content: { statement: 'The successor statement of the bucket fixture.' },
      correctedBy: actor,
      sourceThreadId: threadA.id,
    });
    const released = await store.meaning.createCommitment({
      commitmentKey: 'bucket-commitment-released',
      statement: 'The soon-released commitment of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    await store.meaning.releaseCommitment({
      recordId: released.id,
      exitedBy: actor,
      reason: 'bucket fixture release',
    });
    const abandoned = await store.meaning.createOpenLoop({
      subject: 'Bucket abandoned loop',
      loopKind: 'undecided_question',
      detail: 'The soon-abandoned loop of the bucket fixture.',
      createdBy: actor,
      sourceThreadId: threadA.id,
    });
    await store.meaning.abandonLoop({
      loopId: abandoned.id,
      exitedBy: actor,
      reason: 'bucket fixture abandonment',
    });
    // Expected composition (no filters):
    //   pending = proposed + awaiting + the amendment proposal        = 3
    //   current = claim + confirmed-claim + commitment + loop
    //             + correction successor + other-thread claim         = 6
    //   history = 4 terminal proposals + superseded + released
    //             + abandoned                                         = 7
    const page = async (bucket, extra = {}) =>
      store.listInspectionRecords({ bucket, limit: 50, offset: 0, ...extra });
    const pending = await page('pending');
    check(
      'Q5-H-1: PENDING returns ONLY the two pending proposal statuses (proposed, awaiting_decision)',
      'inspection',
      pending.total === 3 &&
        pending.rows.every((row) => row.kind === 'proposal') &&
        pending.rows.every((row) => ['proposed', 'awaiting_decision'].includes(row.status)) &&
        pending.rows.filter((row) => row.status === 'proposed').length === 2 &&
        pending.rows.filter((row) => row.status === 'awaiting_decision').length === 1,
    );
    const current = await page('current');
    check(
      'Q5-H-1: CURRENT returns NO proposal of any status',
      'inspection',
      current.rows.every((row) => row.kind !== 'proposal'),
    );
    check(
      'Q5-H-1: the CURRENT total equals ONLY the canonical current records',
      'inspection',
      current.total === 6 && current.rows.length === 6,
    );
    const history = await page('history');
    const historyStatuses = history.rows.map((row) => row.status);
    check(
      'Q5-H-1: HISTORY contains ALL terminal proposals and the closed/superseded records',
      'inspection',
      history.total === 7 &&
        ['confirmed', 'rejected', 'amended', 'withdrawn', 'superseded'].every((status) =>
          historyStatuses.includes(status),
        ) &&
        history.rows.filter((row) => row.kind === 'proposal').length === 4,
    );
    check(
      'Q5-H-1: no pending proposal status appears in HISTORY and no terminal status appears in PENDING',
      'inspection',
      history.rows.every((row) => !['proposed', 'awaiting_decision'].includes(row.status)) &&
        pending.rows.every(
          (row) => !['confirmed', 'rejected', 'amended', 'withdrawn'].includes(row.status),
        ),
    );
    // Deterministic, duplicate-free pagination across mixed timestamps.
    const walkHistory = async () => {
      const seen = [];
      for (let offset = 0; offset < history.total; offset += 2) {
        const got = await page('history', { limit: 2, offset });
        seen.push(...got.rows.map((row) => row.id));
      }
      return seen;
    };
    const walked = await walkHistory();
    check(
      'Q5-H-1: pagination over mixed buckets content is deterministic and duplicate-free',
      'inspection',
      walked.length === 7 &&
        new Set(walked).size === 7 &&
        JSON.stringify([...walked].sort()) ===
          JSON.stringify([...history.rows.map((row) => row.id)].sort()) &&
        JSON.stringify(await walkHistory()) === JSON.stringify(walked),
    );
    // Kind and thread filters never reintroduce proposals into Current.
    const currentProposals = await page('current', { kind: 'proposal' });
    const currentClaims = await page('current', { kind: 'claim' });
    check(
      'Q5-H-1: the kind filter cannot reintroduce proposals into CURRENT',
      'inspection',
      currentProposals.total === 0 &&
        currentProposals.rows.length === 0 &&
        currentClaims.total === 4 &&
        currentClaims.rows.every((row) => row.kind === 'claim'),
    );
    const currentA = await page('current', { threadId: threadA.id });
    const currentB = await page('current', { threadId: threadB.id });
    check(
      'Q5-H-1: the thread filter stays truthful and never reintroduces proposals into CURRENT',
      'inspection',
      currentA.total === 5 &&
        currentA.rows.every((row) => row.kind !== 'proposal') &&
        currentB.total === 1 &&
        currentB.rows[0].kind === 'claim',
    );
    store.close();
  }
  console.log(`  inspection: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 7. L-3 — the narrow correction-proposal confirmation repair
// ---------------------------------------------------------------------------
console.log('\n[7] L-3 — correction-kind confirmation, replay, and the still-closed capability');
{
  const store = tempStore();
  const thread = await store.createThread({ id: 'l3-verify', title: 'L3 verify' });
  const claim = await store.meaning.createClaim({
    subject: 'L3 verify subject',
    epistemicType: 'E2',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'The L3 original statement.',
    createdBy: 'actor-quellight-local',
    sourceThreadId: thread.id,
  });
  // Disclosed fixture boundary (Q4 L-2 continuity): production wires no
  // pending-correction path, so the proposal is seeded at the repository
  // level (Q2-frozen capability) and confirmed through the REAL store path.
  const proposal = await store.meaning.createProposal({
    proposalKind: 'correction',
    content: { statement: 'The L3 corrected statement.', reason: 'l3 verify' },
    proposedBy: 'actor-quellight-local',
    sourceThreadId: thread.id,
    targetRecord: { recordId: claim.id, family: 'claim', version: claim.version },
  });
  await store.meaning.markProposalAwaitingDecision(proposal.id, { key: 'l3-verify-await' });
  const outcome = await store.meaning.confirmProposal({
    proposalId: proposal.id,
    confirmedBy: 'actor-quellight-local',
    key: 'l3-verify-confirm',
  });
  check(
    'L-3: confirming a correction-kind proposal succeeds (no QLT_RECORD_EXISTS rollback)',
    'l3',
    outcome.proposal.status === 'confirmed',
  );
  check('L-3: exactly one successor record is created', 'l3', outcome.createdRecords.length === 1);
  const links = await store.meaning.listSourceLinks({ fromRecordId: outcome.createdRecords[0].id });
  const threadLinks = links.filter(
    (link) => link.relation === 'source-thread' && link.toRef === thread.id,
  );
  check(
    'L-3: exactly one applicable source-thread link exists for the successor',
    'l3',
    threadLinks.length === 1,
  );
  const proposedFrom = links.filter((link) => link.relation === 'proposed-from');
  check('L-3: the proposed-from link exists exactly once', 'l3', proposedFrom.length === 1);
  const replay = await store.meaning.confirmProposal({
    proposalId: proposal.id,
    confirmedBy: 'actor-quellight-local',
    key: 'l3-verify-confirm',
  });
  check(
    'L-3: same-key replay converges on the identical outcome',
    'l3',
    JSON.stringify(replay.createdRecords.map((r) => r.id)) ===
      JSON.stringify(outcome.createdRecords.map((r) => r.id)),
  );
  const predecessor = await store.meaning.getClaim(claim.id);
  check(
    'L-3: the predecessor content is unchanged (append-only lineage)',
    'l3',
    predecessor.status === 'superseded' &&
      predecessor.content.statement === 'The L3 original statement.',
  );
  store.close();
  console.log(`  l3: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 8. STRUCTURE — no second path, no direct SQLite in routes, no project scope
// ---------------------------------------------------------------------------
console.log('\n[8] STRUCTURE — boundary and exclusion checks');
{
  const { readdirSync, statSync } = await import('node:fs');
  const collect = (root, filter) => {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (filter(full)) files.push(full);
      }
    };
    walk(root);
    return files;
  };
  const routeFiles = collect('src/routes', (f) => f.endsWith('.ts'));
  const offenders = routeFiles.filter((file) => {
    const content = readFileSync(file, 'utf8');
    return /from 'node:sqlite'|from "node:sqlite"|sharedworld\/sqlite|shared-world\.db/.test(
      content,
    );
  });
  check(
    'no route performs direct SQLite access (the released boundary is the only path)',
    'structure',
    offenders.length === 0,
  );
  const islandFiles = collect('src/lib/islands', (f) => f.endsWith('.svelte'));
  const islandOffenders = islandFiles.filter((file) => {
    const content = readFileSync(file, 'utf8');
    return /node:sqlite|sharedworld\/sqlite|shared-world\.db/.test(content);
  });
  check('no component performs direct SQLite access', 'structure', islandOffenders.length === 0);
  const srcAll = collect('src', (f) => f.endsWith('.ts') || f.endsWith('.svelte'));
  // The frozen invariant STRING in policy-contract.ts mentions the words
  // (as a prohibition); the scan looks for actual USAGE shapes instead:
  // a projectId field/property, a project_id column, or project tables.
  const projectOffenders = srcAll.filter((file) => {
    const content = readFileSync(file, 'utf8');
    return (
      /projectId\s*[=:]/.test(content) ||
      /project_id/.test(content) ||
      /CREATE TABLE[^;]*project/i.test(content)
    );
  });
  check(
    'no project-scope placeholder exists anywhere (freeze §16 exclusions)',
    'structure',
    projectOffenders.length === 0,
  );
  const agentSurface = readFileSync('src/lib/agent/proposal-capability.ts', 'utf8');
  check(
    'the agent capability source contains no inspection or mode-change op',
    'structure',
    !agentSurface.includes('queryInspection') && !agentSurface.includes('setMemoryMode'),
  );
  console.log(`  structure: ${passed} checks`);
}

// ---------------------------------------------------------------------------
// 9. WIRING — package.json, aggregate, and the disclosed re-pins
// ---------------------------------------------------------------------------
console.log('\n[9] WIRING — verify:q5 composed; reconciliation re-pins present');
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  check('package.json declares verify:q5', 'wiring', pkg.scripts['verify:q5'] !== undefined);
  const aggregate = readFileSync('scripts/verify-quellight.mjs', 'utf8');
  check(
    'the aggregate verifier runs verify:q5 (step 2g)',
    'wiring',
    aggregate.includes("spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-q5.mjs']"),
  );
  const devStart = readFileSync('scripts/verify-dev-start.mjs', 'utf8');
  check(
    'the dev-start gate expects ZERO project Svelte warnings (no known-warning allowlist)',
    'wiring',
    !devStart.includes('KNOWN_WARNING_IDS') && devStart.includes('ZERO'),
  );
  const q2 = readFileSync('scripts/verify-q2.mjs', 'utf8');
  check(
    'verify-q2 carries the disclosed migration-4 bookkeeping re-pin',
    'wiring',
    q2.includes('[1, 2, 3,') && q2.includes('Q5 reconciliation'),
  );
  const q3 = readFileSync('scripts/verify-q3.mjs', 'utf8');
  check(
    'verify-q3 carries the disclosed 19+2 inventory re-pin',
    'wiring',
    q3.includes('act.queryInspection') && q3.includes('Q5 reconciliation'),
  );
  const q4 = readFileSync('scripts/verify-q4.mjs', 'utf8');
  check(
    'verify-q4 carries the disclosed Q4-AMEND-1 re-pins',
    'wiring',
    q4.includes('q5-1') && q4.includes('scope-excluded') && q4.includes('Q5 reconciliation'),
  );
  console.log(`  wiring: ${passed} checks`);
}

cleanup();
console.log('');
if (failures.length > 0) {
  console.error(`verify:q5: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log(
  `verify:q5: PASS — ${passed} checks green (contract/amendment/schema/inventory/policy/inspection/l3/structure/wiring).`,
);
process.exit(0);
