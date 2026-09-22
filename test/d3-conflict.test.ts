/**
 * Stage 07D Lane B — conflict and amendment conformance suite
 * (D1a freeze; docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md;
 * negative controls N-D3-1..N-D3-9 of the frozen matrix).
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
import { createMemorySurface, type MemorySurfaceDeps } from '../src/lib/sharedworld/ceremony-actions';
import { detectCommitmentConflict } from '../src/lib/sharedworld/conflict-surface';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-d3-conflict-'));
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
  readonly surface: ReturnType<typeof createMemorySurface>;
  readonly now: { value: number };
}

let worldCount = 0;

async function openWorld(): Promise<World> {
  const dir = tempDir();
  const dbPath = join(dir, 'shared-world.db');
  const now = { value: 3_000_000 + worldCount };
  worldCount += 1;
  const store = createSharedWorldSqlite({ path: dbPath, clock: () => now.value });
  const thread = await store.createThread({ title: `D3 lane B ${worldCount}` });
  const conflictHook = (proposal: Parameters<typeof detectCommitmentConflict>[1]) =>
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
  } satisfies MemorySurfaceDeps);
  return { store, dbPath, threadId: thread.id, surface, now };
}

async function seedCommitment(world: World, key: string, statement: string) {
  return world.store.meaning.createCommitment({
    commitmentKey: key,
    statement,
    createdBy: USER,
    sourceThreadId: world.threadId,
    now: world.now.value,
  });
}

/** A pending commitment proposal on a key, moved to awaiting_decision. */
async function seedCommitmentProposal(world: World, key: string, statement: string) {
  const proposal = await world.store.meaning.createProposal({
    proposalKind: 'commitment',
    content: { commitmentKey: key, statement },
    proposedBy: AGENT,
    sourceThreadId: world.threadId,
  });
  await world.store.meaning.markProposalAwaitingDecision(proposal.id);
  return proposal;
}

const WRITE = { permissions: ['qlt.memory.read', 'qlt.memory.write'], effect: 'write' } as const;

describe('D3 Lane B: deterministic conflict identification (challenge judgment records)', () => {
  it('N-D3-1: a conflicting confirmation is refused, the challenge is recorded, and NOTHING is mutated', async () => {
    const world = await openWorld();
    const existing = await seedCommitment(world, 'conflict-key', 'the standing commitment');
    const proposal = await seedCommitmentProposal(world, 'conflict-key', 'a contradicting duplicate');

    const refusal = await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposal.id },
        idempotencyKey: `confirm-${proposal.id}`,
      },
      WRITE,
    );
    expect(refusal.ok).toBe(false);
    expect((refusal as { code?: string }).code).toBe('QLT_COMMITMENT_CONFLICT');
    const challengeId = (refusal as { details?: { challengeId?: string } }).details?.challengeId;
    expect(typeof challengeId).toBe('string');

    // The existing commitment keeps content, key, status, and version.
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const row = raw.prepare('SELECT * FROM qlt_commitment WHERE id = ?;').get(existing.id) as Record<
      string,
      unknown
    >;
    raw.close();
    expect(row['status']).toBe('active');
    expect(row['version']).toBe(1);
    expect(String(row['content'])).toContain('the standing commitment');
    // The incoming proposal stays awaiting_decision (never auto-decided).
    const probe = await world.store.meaning.getProposal(proposal.id);
    expect(probe?.status).toBe('awaiting_decision');
    // The challenge is open, classified, user-attributed.
    const challenge = world.store.conflict.getChallenge(challengeId!);
    expect(challenge).toMatchObject({
      status: 'open',
      classification: 'commitment-key-conflict',
      existingCommitmentId: existing.id,
      incomingProposalId: proposal.id,
      createdBy: USER,
    });
  });

  it('N-D3-2: a repeated conflicting confirm re-raises the SAME refusal against the SAME challenge', async () => {
    const world = await openWorld();
    await seedCommitment(world, 'dup-key', 'standing');
    const proposal = await seedCommitmentProposal(world, 'dup-key', 'duplicate');
    const args = {
      resourceId: 'qlt.memory',
      op: 'confirmProposal',
      input: { proposalId: proposal.id },
      idempotencyKey: `confirm-${proposal.id}`,
    } as const;
    const first = await world.surface.mutate(args, WRITE);
    const second = await world.surface.mutate(args, WRITE);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect((second as { code?: string }).code).toBe('QLT_COMMITMENT_CONFLICT');
    expect((second as { details?: { challengeId?: string } }).details?.challengeId).toBe(
      (first as { details?: { challengeId?: string } }).details?.challengeId,
    );
    const open = world.store.conflict.listChallenges({ status: 'open' });
    expect(open.total).toBe(1);
  });

  it('N-D3-5: an open challenge is epistemically inert — the pool and resolution are unchanged', async () => {
    const world = await openWorld();
    const existing = await seedCommitment(world, 'inert-key', 'standing statement');
    const keeper = await world.store.meaning.createClaim({
      subject: 'inert-claim',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'plain claim',
      createdBy: USER,
      sourceThreadId: world.threadId,
      now: world.now.value,
    });
    const before = await world.store.listContextCandidates();
    await seedCommitmentProposal(world, 'inert-key', 'duplicate statement');
    await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: (await world.store.conflict.listChallenges({ status: 'open' })).rows[0]?.incomingProposalId },
        idempotencyKey: 'inert-confirm',
      },
      WRITE,
    );
    const after = await world.store.listContextCandidates();
    expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
    const resolved = await world.store.meaning.resolveCurrentEffectiveCommitment('inert-key');
    expect(resolved?.id).toBe(existing.id);
    expect((await world.store.meaning.getClaim(keeper.id))?.status).toBe('active');
  });

  it('N-D3-7: direct conflicting-key creation is refused with a stable code (no silent overwrite)', async () => {
    const world = await openWorld();
    await seedCommitment(world, 'direct-key', 'standing');
    await expect(
      world.store.meaning.createCommitment({
        commitmentKey: 'direct-key',
        statement: 'a different commitment',
        createdBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_EXISTS' });
  });

  it('N-D3-6: agent attempts to amend, dismiss, resolve, or ensure challenges fail closed', async () => {
    const world = await openWorld();
    const existing = await seedCommitment(world, 'fence-key', 'standing');
    await seedCommitmentProposal(world, 'fence-key', 'duplicate');
    const challenge = world.store.conflict.listChallenges({ status: 'open' }).rows[0];
    expect(challenge).toBeDefined();
    for (const attempt of [
      () =>
        world.store.conflict.amendCommitment({
          commitmentId: existing.id,
          statement: 'agent amendment',
          amendedBy: AGENT,
          now: world.now.value,
        }),
      () =>
        world.store.conflict.dismissChallenge({
          challengeId: challenge!.challengeId,
          dismissedBy: AGENT,
          now: world.now.value,
        }),
      () =>
        world.store.conflict.resolveChallengeWithAmendment({
          challengeId: challenge!.challengeId,
          statement: 'agent resolution',
          resolvedBy: AGENT,
          now: world.now.value,
        }),
      () =>
        world.store.conflict.ensureChallenge({
          existingCommitmentId: existing.id,
          incomingProposalId: challenge!.incomingProposalId,
          createdBy: AGENT,
          now: world.now.value,
        }),
    ]) {
      expect(attempt).toThrow();
    }
    const after = world.store.conflict.listChallenges({});
    expect(after.rows.every((row) => row.status === 'open')).toBe(true);
    expect(world.store.conflict.hasAmendmentRows()).toBe(false);
  });

  it('N-D3-8: challenge lifecycle integrity — dismissal and resolve-with-amendment follow the closed transitions', async () => {
    const world = await openWorld();
    await seedCommitment(world, 'lifecycle-key', 'standing');
    const proposalA = await seedCommitmentProposal(world, 'lifecycle-key', 'duplicate A');
    const refusalA = await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposalA.id },
        idempotencyKey: `confirm-${proposalA.id}`,
      },
      WRITE,
    );
    const challengeA = (refusalA as { details?: { challengeId?: string } }).details!.challengeId!;
    // Dismissal resolves the challenge quietly.
    const dismissed = world.store.conflict.dismissChallenge({
      challengeId: challengeA,
      dismissedBy: USER,
      now: world.now.value,
    });
    expect(dismissed).toMatchObject({ status: 'dismissed', resolution: 'incoming-abandoned' });
    // A decided challenge refuses further transitions.
    await expect(
      world.store.conflict.dismissChallenge({
        challengeId: challengeA,
        dismissedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_CHALLENGE_NOT_OPEN' });

    // Resolve-with-amendment: amendment + challenge resolution together.
    const proposalB = await seedCommitmentProposal(world, 'lifecycle-key', 'duplicate B');
    const refusalB = await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposalB.id },
        idempotencyKey: `confirm-${proposalB.id}`,
      },
      WRITE,
    );
    const challengeB = (refusalB as { details?: { challengeId?: string } }).details!.challengeId!;
    const resolved = world.store.conflict.resolveChallengeWithAmendment({
      challengeId: challengeB,
      statement: 'the amended standing statement',
      resolvedBy: USER,
      now: world.now.value,
    });
    expect(resolved.challenge).toMatchObject({ status: 'resolved', resolution: 'existing-amended' });
    // The amendment mechanics ran: predecessor amended, successor active.
    const predecessor = await world.store.meaning.getCommitment(resolved.amendment.commitmentId);
    expect(predecessor?.status).toBe('amended');
    const successor = await world.store.meaning.getCommitment(resolved.amendment.successorId);
    expect(successor).toMatchObject({ status: 'active', supersedesId: resolved.amendment.commitmentId });
    const amendments = world.store.conflict.listAmendments({ commitmentId: resolved.amendment.commitmentId });
    expect(amendments.map((amendment) => amendment.amendmentId)).toContain(resolved.amendment.amendmentId);
    // The lineage link exists (successor --amends--> predecessor).
    const links = await world.store.meaning.listSourceLinks({ fromRecordId: resolved.amendment.successorId });
    expect(links.some((link) => link.relation === 'amends' && link.toRef === resolved.amendment.commitmentId)).toBe(true);
  });
});

describe('D3 Lane B: amendment-versus-execution (structural distinction)', () => {
  it('the direct amendment mechanics: successor/predecessor/judgment row/link, keyed convergence', async () => {
    const world = await openWorld();
    const commitment = await seedCommitment(world, 'amend-key', 'original statement');
    const first = world.store.conflict.amendCommitment({
      commitmentId: commitment.id,
      statement: 'revised statement',
      reason: 'owner revision',
      amendedBy: USER,
      key: 'amend-1',
      now: world.now.value,
    });
    expect(first.amendment.status).toBe('recorded');
    expect(first.predecessor).toMatchObject({ status: 'amended', version: commitment.version + 1 });
    expect(first.successor).toMatchObject({ status: 'active', commitmentKey: 'amend-key' });
    // Same key + same payload → replay (identical outcome).
    const replay = world.store.conflict.amendCommitment({
      commitmentId: commitment.id,
      statement: 'revised statement',
      reason: 'owner revision',
      amendedBy: USER,
      key: 'amend-1',
      now: world.now.value,
    });
    expect(replay.amendment).toEqual(first.amendment);
    expect(replay.successor.id).toBe(first.successor.id);
  });

  it('N-D3-3: stale-version amendments (and removed/expired predecessors) fail with zero effect', async () => {
    const world = await openWorld();
    const commitment = await seedCommitment(world, 'stale-amend-key', 'original');
    await expect(
      world.store.conflict.amendCommitment({
        commitmentId: commitment.id,
        statement: 'revised',
        expectedVersion: commitment.version + 9,
        amendedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_VERSION_CONFLICT' });
    // A REMOVED commitment can never be amended.
    await world.store.retention.removeRecord({
      recordId: commitment.id,
      family: 'commitment',
      removedBy: USER,
      now: world.now.value,
    });
    await expect(
      world.store.conflict.amendCommitment({
        commitmentId: commitment.id,
        statement: 'revised',
        amendedBy: USER,
        now: world.now.value,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_NOT_CURRENT' });
    // An EXPIRED claim path is a claim; an expired COMMITMENT cannot
    // exist (no expiry metadata for commitments), so the guard above is
    // the complete refusal surface. Zero amendment rows exist.
    expect(world.store.conflict.hasAmendmentRows()).toBe(false);
  });

  it('N-D3-4: a full ceremony run writes ZERO amendment rows and never produces an amended status', async () => {
    const world = await openWorld();
    // Ordinary execution-shaped ceremony events:
    const claim = await world.store.meaning.createClaim({
      subject: 'execution-claim',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'plain claim',
      createdBy: USER,
      sourceThreadId: world.threadId,
      now: world.now.value,
    });
    const loop = await world.store.meaning.createOpenLoop({
      subject: 'execution-loop',
      loopKind: 'pending_action',
      detail: 'plain loop',
      createdBy: USER,
      sourceThreadId: world.threadId,
      now: world.now.value,
    });
    await world.store.meaning.retireClaim({ recordId: claim.id, exitedBy: USER, now: world.now.value });
    await world.store.meaning.resolveLoop({ loopId: loop.id, exitedBy: USER, now: world.now.value });
    await world.store.meaning.applyCorrection({
      subjectRecordId: (
        await world.store.meaning.createClaim({
          subject: 'correction-target',
          epistemicType: 'E1',
          honestyState: 'known',
          confidence: 'stated',
          statement: 'target',
          createdBy: USER,
          sourceThreadId: world.threadId,
          now: world.now.value,
        })
      ).id,
      subjectFamily: 'claim',
      correctionKey: 'exec-corr',
      content: { statement: 'corrected' },
      correctedBy: USER,
      now: world.now.value,
    });
    await seedCommitment(world, 'execution-key', 'standing');
    const proposal = await seedCommitmentProposal(world, 'other-key', 'unrelated commitment');
    const confirmed = await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposal.id },
        idempotencyKey: `confirm-${proposal.id}`,
      },
      WRITE,
    );
    expect(confirmed.ok).toBe(true);
    // NONE of that produced an amendment artifact.
    expect(world.store.conflict.hasAmendmentRows()).toBe(false);
    const raw = new DatabaseSync(world.dbPath, { readOnly: true });
    const amended = raw
      .prepare("SELECT COUNT(*) AS total FROM qlt_commitment WHERE status = 'amended';")
      .get() as { total: number };
    const amends = raw
      .prepare("SELECT COUNT(*) AS total FROM qlt_source_link WHERE relation = 'amends';")
      .get() as { total: number };
    raw.close();
    expect(amended.total).toBe(0);
    expect(amends.total).toBe(0);
  });
});

describe('D3 Lane B: quiet presentation and challenge convergence under concurrency', () => {
  it('N-D3-9: projections carry no interrupting presentation effect (list rows only)', async () => {
    const world = await openWorld();
    await seedCommitment(world, 'quiet-key', 'standing');
    const proposal = await seedCommitmentProposal(world, 'quiet-key', 'duplicate');
    await world.surface.mutate(
      {
        resourceId: 'qlt.memory',
        op: 'confirmProposal',
        input: { proposalId: proposal.id },
        idempotencyKey: `confirm-${proposal.id}`,
      },
      WRITE,
    );
    const listed = world.store.conflict.listChallenges({});
    expect(listed.total).toBe(1);
    const view = listed.rows[0]!;
    // The projection is plain data: identifiers, states, timestamps. No
    // presentation verb, priority, or interruption flag exists at all.
    for (const key of Object.keys(view)) {
      expect(['modal', 'focus', 'tray', 'interrupt', 'priority', 'urgent'].some((banned) => key.toLowerCase().includes(banned))).toBe(false);
    }
  });

  it('challenges converge under a concurrent detector race (UNIQUE backstop)', async () => {
    const world = await openWorld();
    const existing = await seedCommitment(world, 'race-key', 'standing');
    const proposal = await seedCommitmentProposal(world, 'race-key', 'duplicate');
    const hook = () =>
      detectCommitmentConflict(
        {
          conflict: world.store.conflict,
          resolveCurrentEffectiveCommitment: async () => ({ id: existing.id }),
          userActorId: USER,
        },
        proposal,
      );
    const results = await Promise.all([hook(), hook(), hook()]);
    for (const result of results) {
      expect(result?.ok).toBe(false);
      expect((result as { code?: string }).code).toBe('QLT_COMMITMENT_CONFLICT');
    }
    expect(world.store.conflict.listChallenges({}).total).toBe(1);
  });
});
