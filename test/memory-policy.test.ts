/**
 * Q5 Lane A focused suite — Memory Mode policy, assembler mode
 * consumption, per-turn applied-policy evidence, and the narrow L-3
 * repair. (The independent adversarial matrix lives in
 * test/memory-authority.test.ts, Lane D.)
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSharedWorldSqlite, type SharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import {
  QLT_MEMORY_MODES,
  QLT_MEMORY_POLICY_TABLE,
  QLT_TURN_MEMORY_POLICY_TABLE,
} from '../src/lib/sharedworld/policy-contract';
import { QLT_CONTEXT_EXCLUSION_CODES } from '../src/lib/sharedworld/context-contract';
import {
  evaluateContextCandidates,
  type ContextCandidateRow,
} from '../src/lib/sharedworld/context-assembler';
import { canonicalJson } from '../src/lib/sharedworld/meaning-contract';

const tempDirs: string[] = [];
const stores: SharedWorldSqlite[] = [];

function createStore(): SharedWorldSqlite {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-lane-a-'));
  tempDirs.push(dir);
  const store = createSharedWorldSqlite({ path: join(dir, 'shared-world.db') });
  stores.push(store);
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const store of stores) {
    try {
      store.close();
    } catch {
      /* best-effort (D-6) */
    }
  }
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort on Windows */
    }
  }
});

function claimRow(overrides: Partial<ContextCandidateRow> & { id: string }): ContextCandidateRow {
  const content = overrides.content ?? JSON.stringify({ statement: 'statement text' });
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
    contentFingerprint: 'f'.repeat(64),
    sourceThreadId: null,
    createdBy: 'actor-quellight-local',
    updatedAtMs: 100,
    hasSuccessor: false,
    ...overrides,
  } as ContextCandidateRow;
}

describe('Q5 migration 4 — Memory Mode policy families', () => {
  it('creates the frozen policy families and the singleton default row on first resolution', () => {
    const store = createStore();
    const resolved = store.memoryPolicy.resolveCurrent();
    expect(resolved.policyId).toBe('qlt.memory-mode@1');
    expect(resolved.mode).toBe('across-conversations');
    expect(resolved.revision).toBe(1);
    const raw = store.memoryPolicy.getPolicyRow();
    expect(raw.mode).toBe('across-conversations');
    expect(raw.revision).toBe(1);
    expect(raw.updatedBy).toBe('actor-quellight-local');
  });

  it('resolves lazily and deterministically: repeated resolution converges on one row', () => {
    const store = createStore();
    const first = store.memoryPolicy.getPolicyRow();
    const second = store.memoryPolicy.getPolicyRow();
    expect(first).toEqual(second);
  });

  it('rejects invalid modes with the stable non-echoing code (no input echo)', () => {
    const store = createStore();
    for (const invalid of ['off ', 'PROJECT', 'per-thread', '__proto__', '', 'across']) {
      expect(() =>
        store.memoryPolicy.setMode({ mode: invalid as never, updatedBy: 'actor-quellight-local' }),
      ).toThrowError(/closed vocabulary/);
      try {
        store.memoryPolicy.setMode({ mode: invalid as never, updatedBy: 'actor-quellight-local' });
      } catch (cause) {
        expect((cause as { code?: string }).code).toBe('QLT_MEMORY_MODE_INVALID');
        if (String(invalid).length > 0) {
          expect((cause as Error).message).not.toContain(String(invalid));
        }
      }
    }
    // The current mode is unchanged by every refusal.
    expect(store.memoryPolicy.resolveCurrent().mode).toBe('across-conversations');
  });

  it('rejects non-user actors (agent identities can never change the mode)', () => {
    const store = createStore();
    expect(() =>
      store.memoryPolicy.setMode({ mode: 'off', updatedBy: 'agent-quellight' }),
    ).toThrowError(/user identity/);
    expect(store.memoryPolicy.resolveCurrent().mode).toBe('across-conversations');
  });

  it('changes the mode with a monotonic revision and converges on same-value sets', () => {
    const store = createStore();
    const first = store.memoryPolicy.setMode({
      mode: 'per-conversation',
      updatedBy: 'actor-quellight-local',
    });
    expect(first.mode).toBe('per-conversation');
    expect(first.revision).toBe(2);
    // Same-value set: value-idempotent convergence, no revision bump.
    const again = store.memoryPolicy.setMode({
      mode: 'per-conversation',
      updatedBy: 'actor-quellight-local',
    });
    expect(again.revision).toBe(2);
    const off = store.memoryPolicy.setMode({ mode: 'off', updatedBy: 'actor-quellight-local' });
    expect(off.revision).toBe(3);
    expect(store.memoryPolicy.resolveCurrent()).toEqual({
      policyId: 'qlt.memory-mode@1',
      mode: 'off',
      revision: 3,
    });
  });

  it('persists the policy and per-turn evidence across a full store restart (fresh open over the same file)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-restart-'));
    tempDirs.push(dir);
    const path = join(dir, 'shared-world.db');
    const first = createSharedWorldSqlite({ path });
    stores.push(first);
    first.memoryPolicy.setMode({ mode: 'per-conversation', updatedBy: 'actor-quellight-local' });
    first.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-restart-1',
      policy: { policyId: 'qlt.memory-mode@1', mode: 'across-conversations', revision: 1 },
    });
    first.close();
    const second = createSharedWorldSqlite({ path });
    stores.push(second);
    expect(second.memoryPolicy.resolveCurrent()).toEqual({
      policyId: 'qlt.memory-mode@1',
      mode: 'per-conversation',
      revision: 2,
    });
    expect(second.memoryPolicy.getTurnPolicy('turn-restart-1')).toEqual({
      turnId: 'turn-restart-1',
      policyId: 'qlt.memory-mode@1',
      mode: 'across-conversations',
      policyRevision: 1,
      recordedAtMs: expect.any(Number),
    });
    second.close();
  });

  it('records per-turn applied-policy evidence INSERT-or-converge and never updates it', () => {
    const store = createStore();
    const first = store.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-ev-1',
      policy: { policyId: 'qlt.memory-mode@1', mode: 'across-conversations', revision: 1 },
    });
    // A different later policy for the SAME turn converges on the winner
    // (the evidence is immutable; a mid-turn change can never rewrite it).
    const second = store.memoryPolicy.recordTurnPolicy({
      turnId: 'turn-ev-1',
      policy: { policyId: 'qlt.memory-mode@1', mode: 'off', revision: 9 },
    });
    expect(second).toEqual(first);
    expect(second.mode).toBe('across-conversations');
    expect(second.policyRevision).toBe(1);
    expect(store.memoryPolicy.getTurnPolicy('turn-missing')).toBeUndefined();
  });

  it('keeps the frozen migration vocabulary and table identities as data', () => {
    expect(QLT_MEMORY_MODES).toEqual(['across-conversations', 'per-conversation', 'off']);
    expect(QLT_MEMORY_POLICY_TABLE).toBe('qlt_memory_policy');
    expect(QLT_TURN_MEMORY_POLICY_TABLE).toBe('qlt_turn_memory_policy');
  });
});

describe('Q5 assembler mode consumption', () => {
  const NOW = 1_000_000;

  function candidateOf(
    overrides: Partial<Omit<ContextCandidateRow, 'id'>> & { id: string },
  ): ContextCandidateRow {
    const content = JSON.stringify({ statement: 'valid statement text' });
    // Recompute a real fingerprint so integrity holds (the store-level
    // canonical form is content JSON with the statement field).
    const fingerprint = createHash('sha256')
      .update(Buffer.from(canonicalJson(JSON.parse(content)), 'utf8'))
      .digest('hex');
    return claimRow({ ...overrides, content, contentFingerprint: fingerprint, updatedAtMs: NOW });
  }

  it('across-conversations (default) preserves Q4 behavior byte-for-byte', () => {
    const candidates = [
      candidateOf({ id: 'other-1', sourceThreadId: 'thread-b' }),
      candidateOf({ id: 'global-1', sourceThreadId: null }),
      candidateOf({ id: 'current-1', sourceThreadId: 'thread-a' }),
    ];
    const legacy = evaluateContextCandidates({
      turnId: 'turn-x',
      threadId: 'thread-a',
      candidates,
    });
    const across = evaluateContextCandidates({
      turnId: 'turn-x',
      threadId: 'thread-a',
      candidates,
      mode: 'across-conversations',
    });
    expect(across.block).toBe(legacy.block);
    expect(across.fingerprint).toBe(legacy.fingerprint);
    expect(across.selected.map((entry) => entry.id)).toEqual(['current-1', 'global-1', 'other-1']);
    expect(across.excluded).toEqual([]);
  });

  it('per-conversation keeps only the current-thread layer and records scope-excluded evidence', () => {
    const candidates = [
      candidateOf({ id: 'other-1', sourceThreadId: 'thread-b' }),
      candidateOf({ id: 'global-1', sourceThreadId: null }),
      candidateOf({ id: 'current-1', sourceThreadId: 'thread-a' }),
    ];
    const scoped = evaluateContextCandidates({
      turnId: 'turn-y',
      threadId: 'thread-a',
      candidates,
      mode: 'per-conversation',
    });
    expect(scoped.selected.map((entry) => entry.id)).toEqual(['current-1']);
    expect(scoped.excluded).toEqual([
      { id: 'other-1', kind: 'claim', reason: 'scope-excluded' },
      { id: 'global-1', kind: 'claim', reason: 'scope-excluded' },
    ]);
    expect(QLT_CONTEXT_EXCLUSION_CODES).toContain('scope-excluded');
  });

  it('per-conversation selection differs from across (fingerprint changes through frozen inputs only)', () => {
    const candidates = [
      candidateOf({ id: 'current-1', sourceThreadId: 'thread-a' }),
      candidateOf({ id: 'global-1', sourceThreadId: null }),
    ];
    const across = evaluateContextCandidates({
      turnId: 'turn-z',
      threadId: 'thread-a',
      candidates,
      mode: 'across-conversations',
    });
    const scoped = evaluateContextCandidates({
      turnId: 'turn-z',
      threadId: 'thread-a',
      candidates,
      mode: 'per-conversation',
    });
    expect(across.selected.length).toBe(2);
    expect(scoped.selected.length).toBe(1);
    expect(scoped.fingerprint).not.toBe(across.fingerprint);
  });

  it('the scope-excluded code can never be produced under across-conversations', () => {
    const candidates = [candidateOf({ id: 'other-1', sourceThreadId: 'thread-b' })];
    const across = evaluateContextCandidates({
      turnId: 'turn-no-scope',
      threadId: 'thread-a',
      candidates,
      mode: 'across-conversations',
    });
    expect(across.excluded.filter((entry) => entry.reason === 'scope-excluded')).toEqual([]);
  });
});

describe('Q5 L-3 — narrow correction-proposal confirmation repair', () => {
  it('confirming a correction-kind proposal creates exactly one successor and one applicable source link', async () => {
    const store = createStore();
    const thread = await store.createThread({ id: 'l3-thread', title: 'L3' });
    const claim = await store.meaning.createClaim({
      subject: 'L3 subject',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'The original statement before correction.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: {
        statement: 'The corrected statement via proposal confirmation.',
        reason: 'proposal confirmation lineage',
      },
      proposedBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
      targetRecord: { recordId: claim.id, family: 'claim', version: claim.version },
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id, { key: 'l3-await' });
    const outcome = await store.meaning.confirmProposal({
      proposalId: proposal.id,
      confirmedBy: 'actor-quellight-local',
      key: 'l3-confirm-1',
    });
    expect(outcome.proposal.status).toBe('confirmed');
    expect(outcome.createdRecords).toHaveLength(1);
    const successor = outcome.createdRecords[0]!;
    expect(successor.supersedesId).toBe(claim.id);

    // Exactly one successor; exactly one applicable source-thread link.
    const links = await store.meaning.listSourceLinks({ fromRecordId: successor.id });
    const threadLinks = links.filter(
      (link) => link.relation === 'source-thread' && link.toRef === thread.id,
    );
    expect(threadLinks).toHaveLength(1);
    // The proposed-from link exists exactly once.
    const proposedFrom = links.filter((link) => link.relation === 'proposed-from');
    expect(proposedFrom).toHaveLength(1);

    // Same-key replay converges on the same outcome.
    const replay = await store.meaning.confirmProposal({
      proposalId: proposal.id,
      confirmedBy: 'actor-quellight-local',
      key: 'l3-confirm-1',
    });
    expect(replay.createdRecords.map((record) => record.id)).toEqual([successor.id]);

    // Predecessor content unchanged; lineage append-only.
    const predecessor = await store.meaning.getClaim(claim.id);
    expect(predecessor?.status).toBe('superseded');
    expect(predecessor?.content).toEqual({
      statement: 'The original statement before correction.',
    });
  });

  it('a stale correction target fails with zero partial effects (existing behavior preserved)', async () => {
    const store = createStore();
    const thread = await store.createThread({ id: 'l3-thread-2', title: 'L3-2' });
    const claim = await store.meaning.createClaim({
      subject: 'L3 stale subject',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'Original.',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'Correction.', reason: 'stale refusal fixture' },
      proposedBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
      targetRecord: { recordId: claim.id, family: 'claim', version: claim.version },
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id, { key: 'l3-await-2' });
    // The target moves on BEFORE confirmation (stale by version-eligibility).
    await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'intercede',
      content: { statement: 'Interceding correction.' },
      correctedBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    await expect(
      store.meaning.confirmProposal({
        proposalId: proposal.id,
        confirmedBy: 'actor-quellight-local',
        key: 'l3-confirm-2',
      }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_STALE' });
    // Zero partial effects: the proposal stays awaiting_decision; exactly
    // one correction chain exists (the interceding one).
    const still = await store.meaning.getProposal(proposal.id);
    expect(still?.status).toBe('awaiting_decision');
  });
});
