/**
 * Stage 07D Lane A — retention and user-removal conformance suite
 * (D1a freeze; docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md;
 * negative controls N-D1-1..N-D1-8 of the frozen matrix).
 *
 * Synthetic disposable data only; no operator data, no provider, no
 * credentials. Every negative control asserts a stable code or a
 * truthful absence/invariance — never a vacuous truth.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite, type SharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import { QLT_D1_NEW_TABLES } from '../src/lib/sharedworld/d1-contract';
import { QLT_SHARED_WORLD_MIGRATIONS } from '../src/lib/sharedworld/migrations';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-d1-retention-'));
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

const USER = 'actor-quellight-local';
const AGENT = 'agent-quellight-probe';

interface World {
  readonly store: SharedWorldSqlite;
  readonly dbPath: string;
  readonly threadId: string;
  readonly now: { value: number };
}

let worldCount = 0;

async function openWorld(): Promise<World> {
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const now = { value: 1_000_000 + worldCount };
  worldCount += 1;
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
  const thread = await store.createThread({ title: `D1 lane A ${worldCount}` });
  return { store, dbPath, threadId: thread.id, now };
}

async function seedClaim(world: World, subject: string, statement: string) {
  return world.store.meaning.createClaim({
    subject,
    epistemicType: 'E1',
    honestyState: 'known',
    confidence: 'stated',
    statement,
    createdBy: USER,
    sourceThreadId: world.threadId,
    now: world.now.value,
  });
}

describe('D1 Lane A: governed user removal (content-free tombstones)', () => {
  it('removes a claim: ineligible everywhere, tombstone content-free at the storage layer (N-D1-1, N-D1-4)', async () => {
    const world = await openWorld();
    const keeper = await seedClaim(world, 'keep-subject', 'kept statement content');
    const removed = await seedClaim(world, 'gone-subject', 'sensitive content that must vanish');
    const before = await world.store.retention.getRecordView({
      recordId: removed.id,
      family: 'claim',
    });
    expect(before?.retentionState).toBe('currently-relevant');

    const view = await world.store.retention.removeRecord({
      recordId: removed.id,
      family: 'claim',
      removedBy: USER,
      now: world.now.value,
    });
    expect(view.retentionState).toBe('user-removed');
    expect(view.removedBy).toBe(USER);
    expect(view.removedAtMs).toBe(world.now.value);

    // N-D1-1: the removed claim never reaches the context candidate scan;
    // the eligible control claim stays present.
    const candidates = await world.store.listContextCandidates();
    const ids = candidates.map((row) => row.id);
    expect(ids).not.toContain(removed.id);
    expect(ids).toContain(keeper.id);

    // N-D1-4: the tombstone is content-free AT THE STORAGE LAYER — the
    // raw row carries NULLs for every frozen tombstone column.
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const row = raw.prepare('SELECT * FROM qlt_claim WHERE id = ?;').get(removed.id) as Record<
      string,
      unknown
    >;
    raw.close();
    for (const column of [
      'subject',
      'epistemic_type',
      'honesty_state',
      'confidence',
      'content',
      'content_fingerprint',
      'expires_at_ms',
    ]) {
      expect(row[column], column).toBeNull();
    }
    expect(row['removed_by']).toBe(USER);
    expect(row['retention_state']).toBe('user-removed');
    // The identity and lineage columns persist (truthful tombstone).
    expect(row['id']).toBe(removed.id);
    expect(row['created_by']).toBe(USER);

    // Storage-layer enforcement: the CHECK refuses a non-content-free
    // "removal" — setting the state without nulling content and writing
    // the removal bookkeeping must fail at the storage layer.
    const rawWrite = new DatabaseSync(world.dbPath);
    expect(() =>
      rawWrite
        .prepare("UPDATE qlt_claim SET retention_state = 'user-removed' WHERE id = ?;")
        .run(keeper.id),
    ).toThrow();
    rawWrite.close();
  });

  it('removes commitments and open loops too; lifecycle identity preserved', async () => {
    const world = await openWorld();
    const commitment = await world.store.meaning.createCommitment({
      commitmentKey: 'd1-key',
      statement: 'committed statement',
      createdBy: USER,
      sourceThreadId: world.threadId,
      now: world.now.value,
    });
    const loop = await world.store.meaning.createOpenLoop({
      subject: 'open subject',
      loopKind: 'undecided_question',
      detail: 'loop detail content',
      createdBy: USER,
      sourceThreadId: world.threadId,
      now: world.now.value,
    });
    const cView = await world.store.retention.removeRecord({
      recordId: commitment.id,
      family: 'commitment',
      removedBy: USER,
      now: world.now.value,
    });
    const lView = await world.store.retention.removeRecord({
      recordId: loop.id,
      family: 'open_loop',
      removedBy: USER,
      now: world.now.value,
    });
    expect(cView.retentionState).toBe('user-removed');
    expect(lView.retentionState).toBe('user-removed');
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const cRow = raw
      .prepare('SELECT * FROM qlt_commitment WHERE id = ?;')
      .get(commitment.id) as Record<string, unknown>;
    const lRow = raw.prepare('SELECT * FROM qlt_open_loop WHERE id = ?;').get(loop.id) as Record<
      string,
      unknown
    >;
    raw.close();
    expect(cRow['commitment_key']).toBeNull();
    expect(cRow['content']).toBeNull();
    expect(lRow['subject']).toBeNull();
    expect(lRow['loop_kind']).toBeNull();
    expect(lRow['content']).toBeNull();
  });

  it('converges on retries: re-removal is a no-op view, same-key replay replays the outcome (N-D1-7)', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'retry-subject', 'retry statement');
    const first = await world.store.retention.removeRecord({
      recordId: claim.id,
      family: 'claim',
      removedBy: USER,
      key: 'rem-key-1',
      now: world.now.value,
    });
    // Same key + same payload → replay (no second effect).
    const replay = await world.store.retention.removeRecord({
      recordId: claim.id,
      family: 'claim',
      removedBy: USER,
      key: 'rem-key-1',
      now: world.now.value,
    });
    expect(replay).toEqual(first);
    // Distinct attempt on an already-removed record converges (no bump).
    const second = await world.store.retention.removeRecord({
      recordId: claim.id,
      family: 'claim',
      removedBy: USER,
      now: world.now.value,
    });
    expect(second.version).toBe(first.version);
    // Same key + DIFFERENT payload → the established conflict code.
    await expect(
      world.store.retention.removeRecord({
        recordId: claim.id,
        family: 'commitment',
        removedBy: USER,
        key: 'rem-key-1',
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_IDEMPOTENCY_CONFLICT' });
  });

  it('refuses stale-version removals and unknown records with zero effect', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'stale-subject', 'statement');
    await expect(
      world.store.retention.removeRecord({
        recordId: claim.id,
        family: 'claim',
        expectedVersion: claim.version + 5,
        removedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_VERSION_CONFLICT' });
    await expect(
      world.store.retention.removeRecord({
        recordId: 'qlt-missing',
        family: 'claim',
        removedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_MISSING' });
    const after = await world.store.retention.getRecordView({
      recordId: claim.id,
      family: 'claim',
    });
    expect(after?.retentionState).toBe('currently-relevant');
  });
});

describe('D1 Lane A: claim expiry and the enforcement pass', () => {
  it('N-D1-3: time passage ALONE causes no effect until the visible pass runs', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'expiry-subject', 'expiring statement');
    const keeper = await seedClaim(world, 'no-expiry-subject', 'durable statement');
    await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      expiresAtMs: world.now.value + 1_000,
      assignedBy: USER,
      now: world.now.value,
    });
    // The clock passes the assigned expiry; NO pass runs.
    world.now.value += 5_000;
    let candidates = await world.store.listContextCandidates();
    expect(candidates.map((row) => row.id)).toContain(claim.id);
    let view = await world.store.retention.getRecordView({ recordId: claim.id, family: 'claim' });
    expect(view?.retentionState).toBe('currently-relevant');
    // Reads that observed the passage did not mutate anything (N-D1-2
    // spot check for this flow).
    expect(view?.expiresAtMs).toBe(world.now.value - 4_000);

    // The pass runs (visible, attributed, evidence-producing).
    const report = await world.store.retention.runRetentionPass({
      ranBy: USER,
      now: world.now.value,
    });
    expect(report.examined).toBe(1);
    expect(report.expiredCount).toBe(1);
    expect(report.expiredIds).toEqual([claim.id]);
    view = await world.store.retention.getRecordView({ recordId: claim.id, family: 'claim' });
    expect(view?.retentionState).toBe('expired');
    // Expired → excluded from assembly; the control claim remains.
    candidates = await world.store.listContextCandidates();
    expect(candidates.map((row) => row.id)).not.toContain(claim.id);
    expect(candidates.map((row) => row.id)).toContain(keeper.id);
  });

  it('the pass is idempotent and convergent; a keyed retry replays the report (N-D1-7)', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'pass-subject', 'statement');
    await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      expiresAtMs: world.now.value + 10,
      assignedBy: USER,
      now: world.now.value,
    });
    world.now.value += 100;
    const first = await world.store.retention.runRetentionPass({
      ranBy: USER,
      key: 'pass-1',
      now: world.now.value,
    });
    expect(first.expiredIds).toEqual([claim.id]);
    const replay = await world.store.retention.runRetentionPass({
      ranBy: USER,
      key: 'pass-1',
      now: world.now.value,
    });
    expect(replay).toEqual(first);
    // A NEW pass finds nothing due (convergence; no double effect).
    const second = await world.store.retention.runRetentionPass({
      ranBy: USER,
      now: world.now.value,
    });
    expect(second.examined).toBe(0);
    expect(second.expiredCount).toBe(0);
    // The evidence family is append-only and readable.
    const passes = await world.store.retention.listRetentionPasses({});
    expect(passes.map((pass) => pass.passId)).toContain(first.passId);
  });

  it('expiry metadata rules: future-only, active+currently-relevant only, clearable', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'meta-subject', 'statement');
    await expect(
      world.store.retention.setClaimExpiry({
        claimId: claim.id,
        expiresAtMs: world.now.value - 1,
        assignedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RETENTION_EXPIRY_INVALID' });
    await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      expiresAtMs: world.now.value + 50,
      assignedBy: USER,
      now: world.now.value,
    });
    // Clearing is allowed.
    const cleared = await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      assignedBy: USER,
      now: world.now.value,
    });
    expect(cleared.expiresAtMs).toBeNull();
    // An expired claim can never re-assign (state guard).
    await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      expiresAtMs: world.now.value + 10,
      assignedBy: USER,
      now: world.now.value,
    });
    world.now.value += 100;
    await world.store.retention.runRetentionPass({ ranBy: USER, now: world.now.value });
    await expect(
      world.store.retention.setClaimExpiry({
        claimId: claim.id,
        expiresAtMs: world.now.value + 10,
        assignedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RETENTION_INVALID_TRANSITION' });
    // A removed claim can never re-assign either (removal clears the
    // schedule; the state guard refuses).
    await world.store.retention.removeRecord({
      recordId: claim.id,
      family: 'claim',
      removedBy: USER,
      now: world.now.value,
    });
    await expect(
      world.store.retention.setClaimExpiry({
        claimId: claim.id,
        expiresAtMs: world.now.value + 10,
        assignedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RETENTION_INVALID_TRANSITION' });
  });
});

describe('D1 Lane A: dependency re-evaluation, authority fence, durability', () => {
  it('N-D1-5: removal makes dependent corrections structurally stale; unrelated rows stay put', async () => {
    const world = await openWorld();
    const target = await seedClaim(world, 'dep-subject', 'original statement');
    const unrelated = await seedClaim(world, 'unrelated-subject', 'unrelated statement');
    const correction = await world.store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'corrected statement', reason: 'r' },
      proposedBy: USER,
      sourceThreadId: world.threadId,
      targetRecord: { recordId: target.id, family: 'claim', version: target.version },
    });
    await world.store.meaning.markProposalAwaitingDecision(correction.id);

    // Before removal the correction is confirmable-in-principle (not
    // stale). Remove the target → the correction becomes structurally
    // stale (confirm refuses; the reason is truthful).
    await world.store.retention.removeRecord({
      recordId: target.id,
      family: 'claim',
      removedBy: USER,
      now: world.now.value,
    });
    await expect(
      world.store.meaning.confirmProposal({ proposalId: correction.id, confirmedBy: USER }),
    ).rejects.toMatchObject({
      code: 'QLT_PROPOSAL_STALE',
      details: { reason: 'target-ineligible' },
    });

    // The DIRECT correction path carries the same retention guard — no
    // ghost derivative may use removed material as its basis.
    await expect(
      world.store.meaning.applyCorrection({
        subjectRecordId: target.id,
        subjectFamily: 'claim',
        correctionKey: 'direct-key',
        content: { statement: 'ghost derivative' },
        correctedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_NOT_CURRENT' });

    // The unrelated row is untouched by the removal.
    const unrelatedAfter = await world.store.retention.getRecordView({
      recordId: unrelated.id,
      family: 'claim',
    });
    expect(unrelatedAfter).toMatchObject({
      retentionState: 'currently-relevant',
      version: unrelated.version,
    });
  });

  it('N-D1-2: reads never cause expiry or mutation', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'read-subject', 'statement');
    await world.store.retention.setClaimExpiry({
      claimId: claim.id,
      expiresAtMs: world.now.value + 10,
      assignedBy: USER,
      now: world.now.value,
    });
    const before = await world.store.retention.getRecordView({
      recordId: claim.id,
      family: 'claim',
    });
    // A burst of pure reads — including the candidate scan that the
    // assembler uses — over the due claim.
    for (let index = 0; index < 3; index += 1) {
      await world.store.listContextCandidates();
      await world.store.retention.listRecordViews({});
      await world.store.retention.getRecordView({ recordId: claim.id, family: 'claim' });
      await world.store.meaning.getClaim(claim.id);
    }
    const after = await world.store.retention.getRecordView({
      recordId: claim.id,
      family: 'claim',
    });
    expect(after).toEqual(before);
    expect(after?.retentionState).toBe('currently-relevant');
  });

  it('N-D1-6: agent attempts to remove, expire, or run the pass fail closed with zero effect', async () => {
    const world = await openWorld();
    const claim = await seedClaim(world, 'fence-subject', 'statement');
    for (const attempt of [
      () =>
        world.store.retention.removeRecord({
          recordId: claim.id,
          family: 'claim',
          removedBy: AGENT,
          now: world.now.value,
        }),
      () =>
        world.store.retention.setClaimExpiry({
          claimId: claim.id,
          expiresAtMs: world.now.value + 10,
          assignedBy: AGENT,
          now: world.now.value,
        }),
      () => world.store.retention.runRetentionPass({ ranBy: AGENT, now: world.now.value }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: 'QLT_INPUT_INVALID_IDENTITY' });
    }
    const after = await world.store.retention.getRecordView({
      recordId: claim.id,
      family: 'claim',
    });
    expect(after?.retentionState).toBe('currently-relevant');
    expect(after?.version).toBe(claim.version);
    const passes = await world.store.retention.listRetentionPasses({});
    expect(passes).toHaveLength(0);
  });

  it('N-D1-8: restart preserves tombstones, expiries, and pass evidence; migrations stay forward-only', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'shared-world.db');
    const now = { value: 2_000_000 };
    const store = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
    const thread = await store.createThread({ title: 'restart thread' });
    const claim = await store.meaning.createClaim({
      subject: 'restart-subject',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'restart statement',
      createdBy: USER,
      sourceThreadId: thread.id,
      now: now.value,
    });
    await store.retention.removeRecord({
      recordId: claim.id,
      family: 'claim',
      removedBy: USER,
      now: now.value,
    });
    const pass = await store.retention.runRetentionPass({ ranBy: USER, now: now.value });
    store.close();

    const reopened = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
    const view = await reopened.retention.getRecordView({ recordId: claim.id, family: 'claim' });
    expect(view?.retentionState).toBe('user-removed');
    expect(view?.removedBy).toBe(USER);
    const passes = await reopened.retention.listRetentionPasses({});
    expect(passes.map((entry) => entry.passId)).toContain(pass.passId);
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    const bookkeeping = (
      raw
        .prepare('SELECT version FROM quellight_shared_world_migrations ORDER BY version;')
        .all() as Array<{
        version: number;
      }>
    ).map((row) => row.version);
    raw.close();
    reopened.close();
    expect(bookkeeping).toEqual(QLT_SHARED_WORLD_MIGRATIONS.map((migration) => migration.version));
    expect(bookkeeping).toEqual([1, 2, 3, 4, 5]);
    expect(QLT_D1_NEW_TABLES).toHaveLength(3);
  });
});
