/**
 * Stage 07D Phase D2 — the deep-purge conformance suite for safety
 * contract Amendment 1 (`quellight.stage07d.d2.safety-contract@2`;
 * docs/report/QUELLIGHT-STAGE-07D-PHASE-D2-CONTRACT-AMENDMENT-1.md;
 * negative controls N-D2-19..N-D2-24).
 *
 * Closes the Phase D5 audit findings B-1 (the plus-meaning deep purge of
 * ceremony-created meaning failed with a raw FOREIGN KEY error because
 * the frozen order deleted proposals before the subject rows that
 * reference them) and H-1 (no gate exercised a ceremony-created purge).
 *
 * Synthetic disposable data only; no operator data, no provider, no
 * credentials. The amendment lineage uses the REAL mechanisms: a
 * correction successor carries `supersedes_id` (there is no supersedes
 * field on the direct verbs — the correction/amendment ceremonies are
 * the only chain writers), and the challenge is recorded by the REAL
 * `detectCommitmentConflict` wiring (the exact function the composition
 * installs at the ceremony surface).
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite, type SharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import { detectCommitmentConflict } from '../src/lib/sharedworld/conflict-surface';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-d2-purge-'));
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
  readonly threadP: string;
  readonly threadQ: string;
  readonly threadR: string;
  readonly threadT: string;
}

async function openWorld(): Promise<World> {
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => 30_000 });
  const threadP = (await store.createThread({ title: 'Ceremony P', id: 'qlt-d2-p' })).id;
  const threadQ = (await store.createThread({ title: 'Unrelated Q', id: 'qlt-d2-q' })).id;
  const threadR = (await store.createThread({ title: 'Boundary R', id: 'qlt-d2-r' })).id;
  const threadT = (await store.createThread({ title: 'Foreign T', id: 'qlt-d2-t' })).id;
  return { store, dbPath, threadP, threadQ, threadR, threadT };
}

/** The REAL proposal/confirmation ceremony (proposal_id non-null). */
async function confirmCeremony(
  world: World,
  threadId: string,
  proposalKind: 'claim' | 'commitment' | 'open_loop' | 'correction',
  content: Record<string, unknown>,
  targetRecord?: {
    recordId: string;
    family: 'claim' | 'commitment' | 'open_loop';
    version: number;
  },
): Promise<{ proposalId: string; recordIds: string[] }> {
  const proposal = await world.store.meaning.createProposal({
    proposalKind,
    content: content as never,
    proposedBy: AGENT,
    sourceThreadId: threadId,
    ...(targetRecord === undefined ? {} : { targetRecord }),
  });
  await world.store.meaning.markProposalAwaitingDecision(proposal.id);
  const outcome = await world.store.meaning.confirmProposal({
    proposalId: proposal.id,
    confirmedBy: USER,
  });
  return {
    proposalId: proposal.id,
    recordIds: outcome.createdRecords.map((record) => record.id),
  };
}

/** The governed plus-meaning deletion, driven through the store steps. */
async function deletePlusMeaning(world: World, threadId: string, key: string): Promise<void> {
  world.store.deletion.planDeletion({
    threadId,
    mode: 'conversation-and-originating-meaning',
    requestedBy: USER,
    key,
  });
  await world.store.deletion.executeMeaningRemoval({ threadId, requestedBy: USER });
  world.store.deletion.tombstoneThread({ threadId });
  world.store.deletion.completeDeletion({ threadId });
}

function rowCount(world: World, sql: string, ...params: (string | number)[]): number {
  const raw = new DatabaseSync(world.dbPath, { readOnly: true });
  const total = raw.prepare(sql).get(...params) as { total: number };
  raw.close();
  return Number(total.total);
}

describe('D2 Amendment 1: the FK-derived deep-purge order (N-D2-19..24)', () => {
  it('N-D2-19: the deep purge removes ceremony-created meaning (the B-1 regression control)', async () => {
    const world = await openWorld();
    const claim = await confirmCeremony(world, world.threadP, 'claim', {
      subject: 'ceremony-claim',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'the ceremony claim',
    });
    const commitment = await confirmCeremony(world, world.threadP, 'commitment', {
      commitmentKey: 'd2-purge-key',
      statement: 'the ceremony commitment',
    });
    const loop = await confirmCeremony(world, world.threadP, 'open_loop', {
      subject: 'ceremony-loop',
      loopKind: 'undecided_question',
      detail: 'the ceremony open loop',
    });
    expect(claim.recordIds).toHaveLength(1);
    expect(commitment.recordIds).toHaveLength(1);
    expect(loop.recordIds).toHaveLength(1);
    // The ceremony commitment carries BOTH proposal references (the two
    // FK edges that made the @1 order invalid).
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const shape = raw
      .prepare('SELECT proposal_id, normative_basis_proposal_id FROM qlt_commitment WHERE id = ?;')
      .get(commitment.recordIds[0]) as { proposal_id: string; normative_basis_proposal_id: string };
    raw.close();
    expect(shape.proposal_id).toBe(commitment.proposalId);
    expect(shape.normative_basis_proposal_id).toBe(commitment.proposalId);

    await deletePlusMeaning(world, world.threadP, 'k-purge-19');
    const receipt = world.store.deletion.purgeConversation({
      threadId: world.threadP,
      purgedBy: USER,
      confirmation: 'purge',
    });
    expect(receipt.originatingTombstones).toBe(3);
    expect(receipt.proposals).toBe(3);
    expect(receipt.challenges).toBe(0);
    expect(receipt.amendments).toBe(0);
    expect(
      rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_claim WHERE source_thread_id = ?',
        world.threadP,
      ),
    ).toBe(0);
    expect(
      rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_commitment WHERE source_thread_id = ?',
        world.threadP,
      ),
    ).toBe(0);
    expect(
      rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_open_loop WHERE source_thread_id = ?',
        world.threadP,
      ),
    ).toBe(0);
    expect(
      rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_proposal WHERE source_thread_id = ?',
        world.threadP,
      ),
    ).toBe(0);
    expect(
      rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_thread WHERE id = ?', world.threadP),
    ).toBe(0);
    // The purge is not repeatable (the thread is gone) and the receipt is content-free.
    expect(JSON.stringify(receipt)).not.toContain('the ceremony');
  });

  it('N-D2-20/21/22/24: closure, compatibility, byte-identity, and integrity in one mixed scope', async () => {
    const world = await openWorld();
    // Ceremony claim + commitment in P; the user amends the commitment
    // (predecessor amended, successor supersedes, immutable amendment row).
    const claim = await confirmCeremony(world, world.threadP, 'claim', {
      subject: 'mixed-claim',
      epistemicType: 'E2',
      honestyState: 'likely',
      confidence: 'qualified',
      statement: 'the mixed-scope claim',
    });
    const commitment = await confirmCeremony(world, world.threadP, 'commitment', {
      commitmentKey: 'mixed-key',
      statement: 'the mixed-scope commitment',
    });
    const amended = world.store.conflict.amendCommitment({
      commitmentId: commitment.recordIds[0],
      statement: 'the amended commitment text',
      amendedBy: USER,
    });
    // A correction successor on the claim (the REAL chain mechanism:
    // supersedes_id -> the ceremony claim).
    const correction = await confirmCeremony(
      world,
      world.threadP,
      'correction',
      { statement: 'the corrected claim text' },
      { recordId: claim.recordIds[0], family: 'claim', version: 1 },
    );
    // One direct-verb record in the same scope (proposal_id NULL).
    const direct = await world.store.meaning.createClaim({
      subject: 'direct-verb',
      epistemicType: 'E4',
      honestyState: 'uncertain',
      confidence: 'qualified',
      statement: 'a direct-verb claim',
      createdBy: USER,
      sourceThreadId: world.threadP,
    });
    // The cross-thread judgment closure: an incoming commitment proposal
    // in Q on the amended key is refused and a challenge row is recorded
    // (thread Q, existing_commitment_id -> P's active successor).
    const conflicting = await world.store.meaning.createProposal({
      proposalKind: 'commitment',
      content: { commitmentKey: 'mixed-key', statement: 'a contradicting duplicate in Q' },
      proposedBy: AGENT,
      sourceThreadId: world.threadQ,
    });
    await world.store.meaning.markProposalAwaitingDecision(conflicting.id);
    const refusal = await detectCommitmentConflict(
      {
        conflict: world.store.conflict,
        resolveCurrentEffectiveCommitment: async (key) => {
          const active = await world.store.meaning.resolveCurrentEffectiveCommitment(key);
          return active === undefined ? undefined : { id: active.id };
        },
        userActorId: USER,
      },
      (await world.store.meaning.getProposal(conflicting.id))!,
    );
    const challengeId = (refusal as { details?: { challengeId?: string } } | undefined)?.details
      ?.challengeId;
    expect(typeof challengeId).toBe('string');

    // A full row inventory BEFORE the purge.
    const snapshotOf = (): Map<string, string[]> => {
      const raw = new DatabaseSync(world.dbPath, { readOnly: true });
      const tables = raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'qlt_%' ORDER BY name;",
        )
        .all()
        .map((row) => row.name as string);
      const snap = new Map<string, string[]>();
      for (const table of tables) {
        snap.set(
          table,
          (raw.prepare(`SELECT * FROM ${table};`).all() as unknown[]).map((row) =>
            JSON.stringify(row),
          ),
        );
      }
      raw.close();
      return snap;
    };

    await deletePlusMeaning(world, world.threadP, 'k-purge-mixed');
    const before = snapshotOf();
    before.delete('qlt_conversation_purge'); // permitted content-free evidence
    const receipt = world.store.deletion.purgeConversation({
      threadId: world.threadP,
      purgedBy: USER,
      confirmation: 'purge',
    });
    expect(receipt.challenges).toBe(1);
    expect(receipt.amendments).toBe(1);
    expect(receipt.corrections).toBe(1);
    expect(receipt.proposals).toBe(3);
    expect(receipt.originatingTombstones).toBe(5);

    // N-D2-20: the cross-thread challenge is gone; Q's proposal row stays.
    expect(
      rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_conflict_challenge WHERE id = ?',
        challengeId!,
      ),
    ).toBe(0);
    expect(
      rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_proposal WHERE id = ?', conflicting.id),
    ).toBe(1);

    // N-D2-21: the direct-verb record was removed by the same purge.
    expect(rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_claim WHERE id = ?', direct.id)).toBe(
      0,
    );

    // N-D2-24: both lineage chains are fully removed (correction pair and
    // amendment pair) and the whole store passes foreign_key_check.
    for (const id of [
      claim.recordIds[0],
      correction.recordIds[0],
      commitment.recordIds[0],
      amended.successor.id,
    ]) {
      const inClaims = rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_claim WHERE id = ?', id);
      const inCommitments = rowCount(
        world,
        'SELECT COUNT(*) AS total FROM qlt_commitment WHERE id = ?',
        id,
      );
      expect(inClaims + inCommitments).toBe(0);
    }
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    expect(raw.prepare('PRAGMA foreign_key_check;').all()).toHaveLength(0);
    raw.close();

    // N-D2-22: every removed row belongs to the authorized scope.
    const after = snapshotOf();
    after.delete('qlt_conversation_purge');
    const scopeTokens = [
      world.threadP,
      claim.proposalId,
      commitment.proposalId,
      correction.proposalId,
      challengeId as string,
      amended.amendment.amendmentId,
      direct.id,
      ...claim.recordIds,
      ...commitment.recordIds,
      ...correction.recordIds,
    ];
    for (const [table, afterRows] of after) {
      const beforeRows = before.get(table) ?? [];
      expect(afterRows.length).toBeLessThanOrEqual(beforeRows.length);
      const afterSet = new Set(afterRows);
      for (const line of beforeRows) {
        if (afterSet.has(line)) continue;
        expect(
          scopeTokens.some((token) => line.includes(token)),
          `${table} lost an out-of-scope row: ${line.slice(0, 120)}`,
        ).toBe(true);
      }
    }
  });

  it('N-D2-23: a foreign reference INTO the scope fails the purge closed; the scope converges afterwards', async () => {
    const world = await openWorld();
    const boundary = await world.store.meaning.createClaim({
      subject: 'boundary-claim',
      epistemicType: 'E3',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'the boundary claim in R',
      createdBy: USER,
      sourceThreadId: world.threadR,
    });
    // The foreign child: a correction successor in T superseding R's
    // claim (a cross-thread supersedes edge INTO the future purge scope).
    const foreign = await confirmCeremony(
      world,
      world.threadT,
      'correction',
      { statement: 'a foreign correction in T' },
      { recordId: boundary.id, family: 'claim', version: 1 },
    );
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const edge = raw
      .prepare('SELECT supersedes_id, source_thread_id FROM qlt_claim WHERE id = ?;')
      .get(foreign.recordIds[0]) as { supersedes_id: string; source_thread_id: string };
    raw.close();
    expect(edge.supersedes_id).toBe(boundary.id);
    expect(edge.source_thread_id).toBe(world.threadT);

    await deletePlusMeaning(world, world.threadR, 'k-purge-r');
    const snapshotClaim = (): string[] => {
      const reader = new DatabaseSync(world.dbPath, { readOnly: true });
      const rows = (reader.prepare('SELECT * FROM qlt_claim ORDER BY id;').all() as unknown[]).map(
        (row) => JSON.stringify(row),
      );
      const threads = (
        reader.prepare('SELECT * FROM qlt_thread ORDER BY id;').all() as unknown[]
      ).map((row) => JSON.stringify(row));
      reader.close();
      return [...rows, ...threads];
    };
    const before = snapshotClaim();
    let failure: { code?: string } | undefined;
    try {
      world.store.deletion.purgeConversation({
        threadId: world.threadR,
        purgedBy: USER,
        confirmation: 'purge',
      });
    } catch (cause) {
      failure = cause as { code?: string };
    }
    expect(failure).toBeDefined();
    // Full rollback: no receipt, zero partial deletion.
    expect(world.store.deletion.getPurgeReceipt(world.threadR)).toBeUndefined();
    expect(snapshotClaim()).toEqual(before);

    // The foreign child leaves through its OWN governed path; then the
    // R purge converges (restart/replay truthfulness).
    await deletePlusMeaning(world, world.threadT, 'k-purge-t');
    world.store.deletion.purgeConversation({
      threadId: world.threadT,
      purgedBy: USER,
      confirmation: 'purge',
    });
    const receipt = world.store.deletion.purgeConversation({
      threadId: world.threadR,
      purgedBy: USER,
      confirmation: 'purge',
    });
    expect(receipt.originatingTombstones).toBe(1);
    expect(
      rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_thread WHERE id = ?', world.threadR),
    ).toBe(0);
  });

  it('N-D2-7/authority: the purge prerequisites and user authority hold under the amended order', async () => {
    const world = await openWorld();
    const claim = await confirmCeremony(world, world.threadP, 'claim', {
      subject: 'guard-claim',
      epistemicType: 'E5',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'a guard claim',
    });
    // No completed deletion yet.
    expect(() =>
      world.store.deletion.purgeConversation({
        threadId: world.threadP,
        purgedBy: USER,
        confirmation: 'purge',
      }),
    ).toThrowError(expect.objectContaining({ code: 'QLT_PURGE_NOT_AVAILABLE' }));
    // Wrong token: refused with zero effect.
    await deletePlusMeaning(world, world.threadP, 'k-purge-guard');
    expect(() =>
      world.store.deletion.purgeConversation({
        threadId: world.threadP,
        purgedBy: USER,
        confirmation: 'PURGE',
      }),
    ).toThrowError(expect.objectContaining({ code: 'QLT_PURGE_CONFIRMATION_INVALID' }));
    expect(world.store.deletion.getPurgeReceipt(world.threadP)).toBeUndefined();
    // Agent identity: refused.
    expect(() =>
      world.store.deletion.purgeConversation({
        threadId: world.threadP,
        purgedBy: AGENT,
        confirmation: 'purge',
      }),
    ).toThrowError();
    // The successful purge still removes the ceremony record.
    const receipt = world.store.deletion.purgeConversation({
      threadId: world.threadP,
      purgedBy: USER,
      confirmation: 'purge',
    });
    expect(receipt.originatingTombstones).toBe(1);
    expect(
      rowCount(world, 'SELECT COUNT(*) AS total FROM qlt_claim WHERE id = ?', claim.recordIds[0]),
    ).toBe(0);
  });
});
