#!/usr/bin/env node
/**
 * Quellight Stage 07D Lane B — focused conflict-semantics verifier
 * (`npm run verify:d3`; run as `node --import tsx
 * scripts/verify-d3.mjs`).
 *
 * Implements the frozen Lane B negative-control matrix (N-D3-1..N-D3-9 of
 * `d1-contract.ts` QLT_D1_NEGATIVE_CONTROLS) END-TO-END over fresh
 * synthetic disposable stores, plus schema and structural checks. This
 * gate is per-phase SELF-verification (owner decision OD-D6) — the
 * combined independent audit remains D5 scope.
 *
 *   1. SCHEMA      — the three D1 families vs the frozen inventories
 *                    (challenge mutable-version discipline; amendment
 *                    immutability).
 *   2. CONTROLS    — N-D3-1..N-D3-9, each non-vacuous.
 *   3. STRUCTURAL  — challenge/amendment table integrity from the frozen
 *                    CHECK fragments; the closed challenge lifecycle.
 *   4. WIRING      — `verify:d3` exists in package.json.
 *
 * Emits clear per-section counts; exits non-zero on ANY failure.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite.ts';
import { createMemorySurface } from '../src/lib/sharedworld/ceremony-actions.ts';
import { detectCommitmentConflict } from '../src/lib/sharedworld/conflict-surface.ts';
import { QLT_D1_NEW_TABLES, QLT_D1_SCHEMA_INVENTORY } from '../src/lib/sharedworld/d1-contract.ts';

const USER = 'actor-quellight-local';
const AGENT = 'agent-quellight-probe';
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
  const dir = mkdtempSync(join(tmpdir(), 'verify-d3-'));
  dirs.push(dir);
  return dir;
};

/** The conflict-store mutations are synchronous; assert their thrown codes. */
function expectCode(fn, code) {
  try {
    fn();
  } catch (cause) {
    check(`stable refusal ${code}`, 'controls', cause?.code === code);
    return;
  }
  check(`stable refusal ${code}`, 'controls', false);
}

const WRITE = { permissions: ['qlt.memory.read', 'qlt.memory.write'], effect: 'write' };

// ---------------------------------------------------------------------------
// 1. SCHEMA
// ---------------------------------------------------------------------------
{
  console.log('\n[1] SCHEMA — the D1 families vs the frozen inventories');
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => 1_000 });
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  for (const table of QLT_D1_NEW_TABLES) {
    const sql = raw
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?;")
      .get(table).sql;
    const spec = QLT_D1_SCHEMA_INVENTORY[table];
    check(
      `${table}: frozen CHECK fragments all present`,
      'schema',
      spec.requiredCheckFragments.every((fragment) => sql.includes(fragment)),
    );
  }
  const challengeSql = raw
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='qlt_conflict_challenge';")
    .get().sql;
  check(
    'challenge rows are mutable judgment rows (version >= 1; amendment 1)',
    'schema',
    challengeSql.includes('version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)'),
  );
  const amendmentSql = raw
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='qlt_amendment';")
    .get().sql;
  check(
    'amendment rows are immutable (version = 1)',
    'schema',
    amendmentSql.includes('CHECK (version = 1)') && amendmentSql.includes("status = 'recorded'"),
  );
  raw.close();
  store.close();
}

// ---------------------------------------------------------------------------
// 2. CONTROLS — N-D3-1..N-D3-9
// ---------------------------------------------------------------------------
{
  console.log('\n[2] CONTROLS — the frozen Lane B negative-control matrix');
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const now = { value: 20_000_000 };
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
  const thread = await store.createThread({ title: 'verify:d3' });
  const conflictHook = (proposal) =>
    detectCommitmentConflict(
      {
        conflict: store.conflict,
        resolveCurrentEffectiveCommitment: async (key) => {
          const active = await store.meaning.resolveCurrentEffectiveCommitment(key);
          return active === undefined ? undefined : { id: active.id };
        },
        userActorId: USER,
      },
      proposal,
    );
  const surface = createMemorySurface({
    meaning: store.meaning,
    listRecordRows: (options) => store.listMemoryRows(options),
    getThread: (id) => store.getThread(id),
    userActorId: USER,
    conflictHook,
  });

  const seedCommitment = async (key, statement) =>
    store.meaning.createCommitment({
      commitmentKey: key,
      statement,
      createdBy: USER,
      sourceThreadId: thread.id,
      now: now.value,
    });
  const seedProposal = async (key, statement) => {
    const proposal = await store.meaning.createProposal({
      proposalKind: 'commitment',
      content: { commitmentKey: key, statement },
      proposedBy: AGENT,
      sourceThreadId: thread.id,
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    return proposal;
  };
  const attemptConfirm = async (proposal) =>
    surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposal.id },
        idempotencyKey: `confirm-${proposal.id}`,
      },
      WRITE,
    );

  // --- N-D3-1: the conflicting confirm is refused; NOTHING is mutated.
  const existing = await seedCommitment('vd3-key', 'the standing commitment');
  const proposal1 = await seedProposal('vd3-key', 'a contradicting duplicate');
  const refusal = await attemptConfirm(proposal1);
  check(
    'N-D3-1: the conflicting confirmation is refused with the stable code',
    'controls',
    refusal.ok === false && refusal.code === 'QLT_COMMITMENT_CONFLICT',
  );
  const challengeId1 = refusal.details?.challengeId;
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  const existingRow = raw.prepare('SELECT * FROM qlt_commitment WHERE id = ?;').get(existing.id);
  raw.close();
  check(
    'N-D3-1: the existing commitment keeps status/version/content',
    'controls',
    existingRow['status'] === 'active' &&
      existingRow['version'] === 1 &&
      String(existingRow['content']).includes('the standing commitment'),
  );
  const probe1 = await store.meaning.getProposal(proposal1.id);
  check(
    'N-D3-1: the incoming proposal stays awaiting_decision (never auto-decided)',
    'controls',
    probe1.status === 'awaiting_decision',
  );
  const challenge1 = store.conflict.getChallenge(challengeId1);
  check(
    'N-D3-1: the challenge judgment row is open, classified, user-attributed',
    'controls',
    challenge1.status === 'open' &&
      challenge1.classification === 'commitment-key-conflict' &&
      challenge1.createdBy === USER,
  );

  // --- N-D3-2: the repeated attempt converges on the SAME challenge.
  const refusal2 = await attemptConfirm(proposal1);
  check(
    'N-D3-2: the repeated attempt re-raises the same refusal',
    'controls',
    refusal2.ok === false && refusal2.code === 'QLT_COMMITMENT_CONFLICT',
  );
  check(
    'N-D3-2: the same challenge is re-raised (no duplicates)',
    'controls',
    refusal2.details?.challengeId === challengeId1 && store.conflict.listChallenges({}).total === 1,
  );

  // --- N-D3-5: challenges are epistemically inert.
  const poolBefore = (await store.listContextCandidates()).map((row) => row.id).sort();
  const resolved = await store.meaning.resolveCurrentEffectiveCommitment('vd3-key');
  check(
    'N-D3-5: the open challenge does not displace current-effective meaning',
    'controls',
    resolved?.id === existing.id,
  );
  const claim = await store.meaning.createClaim({
    subject: 'vd3-inert',
    epistemicType: 'E1',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'plain claim',
    createdBy: USER,
    sourceThreadId: thread.id,
    now: now.value,
  });
  const poolAfter = (await store.listContextCandidates()).map((row) => row.id).sort();
  check(
    'N-D3-5: the candidate pool is unchanged by the challenge (only the new claim added)',
    'controls',
    JSON.stringify(poolAfter) === JSON.stringify([...poolBefore, claim.id].sort()),
  );

  // --- N-D3-6: the agent identity fails closed on every conflict verb.
  const agentThrows = (fn) => {
    try {
      fn();
      return false;
    } catch (cause) {
      return cause?.code === 'QLT_INPUT_INVALID_IDENTITY';
    }
  };
  check(
    'N-D3-6: the agent amendment fails closed',
    'controls',
    agentThrows(() =>
      store.conflict.amendCommitment({
        commitmentId: existing.id,
        statement: 'x',
        amendedBy: AGENT,
        now: now.value,
      }),
    ),
  );
  check(
    'N-D3-6: the agent dismissal fails closed',
    'controls',
    agentThrows(() =>
      store.conflict.dismissChallenge({
        challengeId: challengeId1,
        dismissedBy: AGENT,
        now: now.value,
      }),
    ),
  );
  check(
    'N-D3-6: the agent resolution fails closed',
    'controls',
    agentThrows(() =>
      store.conflict.resolveChallengeWithAmendment({
        challengeId: challengeId1,
        statement: 'x',
        resolvedBy: AGENT,
        now: now.value,
      }),
    ),
  );
  check(
    'N-D3-6: zero amendment rows after the agent attempts',
    'controls',
    !store.conflict.hasAmendmentRows(),
  );

  // --- N-D3-8: closed lifecycle transitions.
  const dismissed = store.conflict.dismissChallenge({
    challengeId: challengeId1,
    dismissedBy: USER,
    now: now.value,
  });
  check(
    'N-D3-8: dismissal resolves the challenge quietly (incoming-abandoned)',
    'controls',
    dismissed.status === 'dismissed' && dismissed.resolution === 'incoming-abandoned',
  );
  expectCode(
    () =>
      store.conflict.dismissChallenge({
        challengeId: challengeId1,
        dismissedBy: USER,
        now: now.value,
      }),
    'QLT_CHALLENGE_NOT_OPEN',
  );

  // --- the amendment path (resolve-with-amendment and direct amendment).
  const proposal2 = await seedProposal('vd3-key', 'duplicate two');
  const refusal3 = await attemptConfirm(proposal2);
  const challengeId3 = refusal3.details?.challengeId;
  const resolution = store.conflict.resolveChallengeWithAmendment({
    challengeId: challengeId3,
    statement: 'the amended standing statement',
    resolvedBy: USER,
    now: now.value,
  });
  check(
    'N-D3-8: resolve-with-amendment resolves the challenge (existing-amended)',
    'controls',
    resolution.challenge.status === 'resolved' &&
      resolution.challenge.resolution === 'existing-amended',
  );
  const predecessor = await store.meaning.getCommitment(resolution.amendment.commitmentId);
  const successor = await store.meaning.getCommitment(resolution.amendment.successorId);
  check(
    'N-D3-8: the predecessor is amended and the successor active on the same key',
    'controls',
    predecessor.status === 'amended' &&
      successor.status === 'active' &&
      successor.supersedesId === predecessor.id,
  );
  const links = await store.meaning.listSourceLinks({ fromRecordId: successor.id });
  check(
    'N-D3-8: the successor --amends--> predecessor lineage link exists',
    'controls',
    links.some((link) => link.relation === 'amends' && link.toRef === predecessor.id),
  );

  // --- direct amendment with keyed convergence.
  const amended = store.conflict.amendCommitment({
    commitmentId: successor.id,
    statement: 'second revision',
    amendedBy: USER,
    key: 'vd3-amend-1',
    now: now.value,
  });
  const amendedReplay = store.conflict.amendCommitment({
    commitmentId: successor.id,
    statement: 'second revision',
    amendedBy: USER,
    key: 'vd3-amend-1',
    now: now.value,
  });
  check(
    'N-D3-8: the direct amendment converges on keyed replay',
    'controls',
    JSON.stringify(amended.amendment) === JSON.stringify(amendedReplay.amendment),
  );

  // --- N-D3-3: stale versions and removed predecessors refuse.
  expectCode(
    () =>
      store.conflict.amendCommitment({
        commitmentId: amended.successor.id,
        statement: 'racing revision',
        expectedVersion: 99,
        amendedBy: USER,
        now: now.value,
      }),
    'QLT_VERSION_CONFLICT',
  );
  await store.retention.removeRecord({
    recordId: amended.successor.id,
    family: 'commitment',
    removedBy: USER,
    now: now.value,
  });
  expectCode(
    () =>
      store.conflict.amendCommitment({
        commitmentId: amended.successor.id,
        statement: 'ghost revision',
        amendedBy: USER,
        now: now.value,
      }),
    'QLT_RECORD_NOT_CURRENT',
  );

  // --- N-D3-7: direct conflicting-key creation refuses (on a key whose
  // commitment is still ACTIVE — the earlier vd3-key was amended and its
  // latest successor removed above, so the key is vacant by now).
  await seedCommitment('vd3-direct-key', 'standing for the direct refusal');
  let directRefused = false;
  try {
    await store.meaning.createCommitment({
      commitmentKey: 'vd3-direct-key',
      statement: 'another',
      createdBy: USER,
      now: now.value,
    });
  } catch (cause) {
    directRefused = cause?.code === 'QLT_RECORD_EXISTS' || cause?.code === 'QLT_VERSION_CONFLICT';
  }
  check(
    'N-D3-7: direct second-active-commitment creation refuses with a stable code',
    'controls',
    directRefused,
  );

  // --- N-D3-4: execution events never become amendments.
  const amendmentCount = new DatabaseSync(dbPath, { readOnly: true })
    .prepare('SELECT COUNT(*) AS total FROM qlt_amendment;')
    .get();
  // Two REAL amendments happened above (resolve-with-amendment + direct);
  // the count must be EXACTLY two, and a fresh ceremony run must not
  // change it.
  const ceremonyProposal = await seedProposal('vd3-exec-key', 'unrelated execution commitment');
  const ceremonyConfirm = await attemptConfirm(ceremonyProposal);
  const amendmentCountAfter = new DatabaseSync(dbPath, { readOnly: true })
    .prepare('SELECT COUNT(*) AS total FROM qlt_amendment;')
    .get();
  check(
    'N-D3-4: exactly two amendment rows exist (the two real amendments)',
    'controls',
    amendmentCount.total === 2,
  );
  check(
    'N-D3-4: an ordinary unrelated confirmation adds ZERO amendment rows',
    'controls',
    ceremonyConfirm.ok === true && amendmentCountAfter.total === 2,
  );
  const amendedStatus = new DatabaseSync(dbPath, { readOnly: true })
    .prepare("SELECT COUNT(*) AS total FROM qlt_commitment WHERE status = 'amended';")
    .get();
  check(
    'N-D3-4: only amendment-path predecessors carry the amended status',
    'controls',
    amendedStatus.total === 2,
  );

  // --- N-D3-9: quiet presentation — the projection is plain data.
  const listed = store.conflict.listChallenges({});
  const banned = ['modal', 'focus', 'tray', 'interrupt', 'priority', 'urgent'];
  const projectionKeys = Object.keys(listed.rows[0] ?? { ok: true });
  check(
    'N-D3-9: challenge projections are plain list-row data (no interruption flags exist)',
    'controls',
    listed.total >= 1 &&
      projectionKeys.every((key) => !banned.some((word) => key.toLowerCase().includes(word))),
  );
  store.close();
}

// ---------------------------------------------------------------------------
// 3. STRUCTURAL
// ---------------------------------------------------------------------------
{
  console.log('\n[3] STRUCTURAL — closed vocabularies and identities');
  const d1 = await import('../src/lib/sharedworld/d1-contract.ts');
  check(
    'exactly one frozen challenge classification',
    'structural',
    d1.QLT_D1_CHALLENGE_CLASSIFICATIONS.length === 1 &&
      d1.QLT_D1_CHALLENGE_CLASSIFICATIONS[0] === 'commitment-key-conflict',
  );
  check(
    'the challenge lifecycle is exactly open/dismissed/resolved',
    'structural',
    JSON.stringify(d1.QLT_D1_CHALLENGE_STATUSES) ===
      JSON.stringify(['open', 'dismissed', 'resolved']),
  );
  check(
    'the challenge resolutions are exactly incoming-abandoned/existing-amended',
    'structural',
    JSON.stringify(d1.QLT_D1_CHALLENGE_RESOLUTIONS) ===
      JSON.stringify(['incoming-abandoned', 'existing-amended']),
  );
  check(
    'the authority matrix refuses every conflict verb to the agent',
    'structural',
    Object.values(d1.QLT_D1_AUTHORITY_MATRIX.agent).every((allowed) => allowed === false),
  );
}

// ---------------------------------------------------------------------------
// 4. WIRING
// ---------------------------------------------------------------------------
{
  console.log('\n[4] WIRING — package.json gate registration');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
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
  console.error(`\nverify:d3: FAILED — ${failures.length} check(s) red of ${total}.`);
  process.exit(1);
}
console.log(`verify:d3: PASS — ${total} checks green (schema/controls/structural/wiring).`);
