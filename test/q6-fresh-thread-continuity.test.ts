import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
  type QuellightComposition,
} from '../src/lib/server/composition';
import { getCompiledPlan } from '$lib/application/definition';
import {
  QLT_CONTEXT_BLOCK_CLOSE,
  QLT_CONTEXT_BLOCK_OPEN,
  QLT_CONTEXT_RECORD_CLOSE,
} from '../src/lib/sharedworld/context-contract';
import { QLT_AGENT_PROPOSER_ID } from '../src/lib/sharedworld/ceremony-contract';
import { QLT_Q6_EXAMPLE_STATEMENT } from '../src/lib/sharedworld/q6-contract';

/**
 * Q6 fresh-thread continuity, restart, and conflict proofs (Lane D;
 * frozen contract §6 controls 5/6/8 and handoff N-C19): the confirmed
 * Shared World meaning reaches a genuinely fresh conversation through
 * its per-turn C1 snapshot with ZERO transcript dependency and ZERO
 * transcript pollution; restart preserves the record, its lineage, and
 * the assembly evidence; a conflicting later statement never mutates the
 * standing record. Every turn crosses the REAL production admission
 * boundary; every ceremony mutation crosses the REAL released
 * app.data.mutate boundary.
 */

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q6-fresh-'));
  tempDirs.push(dir);
  return dir;
};
const composed: Array<{ close(): Promise<void> }> = [];

afterEach(() => {
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
});
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

const OFFLINE_SCRIPT = {
  [QLT_Q6_EXAMPLE_STATEMENT]: {
    kind: 'tool-call',
    toolName: 'qlt_proposal_draft',
    args: {
      proposalKind: 'claim',
      content: {
        subject: 'Job pathway',
        epistemicType: 'E5',
        honestyState: 'likely',
        confidence: 'qualified',
        statement:
          'The user will not leave their current job without a clear pathway and an established base.',
      },
    },
    thenText: 'I noted a possible claim about your job plans for your review.',
  },
  Hello: { kind: 'text', text: 'The offline deterministic fixture is active.' },
  'Update: I have decided to leave my job as soon as possible.': {
    kind: 'text',
    text: 'I hear the update; the earlier note stays in your memory inbox for your decision.',
  },
} as Record<string, unknown>;

async function compose(
  script: Record<string, unknown>,
  dataDirOverride?: string,
): Promise<QuellightComposition> {
  const dir = dataDirOverride ?? tempDir();
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR_ABSOLUTE: dir,
      QUELLIGHT_ACTOR_TOKEN: `qlt-token-canary-${crypto.randomUUID()}`,
    },
    process.cwd(),
  );
  const composition = await createQuellightComposition({
    env,
    skipListen: true,
    offlineScript: script as never,
  });
  composed.push(composition);
  return composition;
}

function actorOf(composition: QuellightComposition) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

async function startTurnAdmitted(
  composition: QuellightComposition,
  swThreadId: string,
  mastraThreadId: string,
  input: string,
  idempotencyKey: string,
): Promise<string> {
  const admission = await composition.admitTurn(
    { swThreadId, mastraThreadId, idempotencyKey },
    () =>
      composition.commandService.dispatch(actorOf(composition), {
        command: 'agent.turn.start',
        payload: { threadId: mastraThreadId, input },
        idempotencyKey,
      }),
  );
  expect(admission.refused).toBe(false);
  const outcome = (
    admission as { refused: false; result: { ok: boolean; data: { turnId: string } } }
  ).result;
  expect(outcome.ok).toBe(true);
  return outcome.data.turnId;
}

async function awaitTerminal(composition: QuellightComposition, turnId: string): Promise<string> {
  for (let index = 0; index < 400; index += 1) {
    const turn = await composition.stores.turns.getTurn(turnId);
    if (turn && ['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return turn.status;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`turn ${turnId} did not settle`);
}

/** One governed ceremony mutation exactly as the /api/act transport builds it. */
async function governedMutate(
  composition: QuellightComposition,
  actionId: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
) {
  const action = getCompiledPlan().actions[actionId]!;
  if (action.kind !== 'mutation') {
    throw new Error(`${actionId} is not a declared mutation action`);
  }
  expect(action.kind).toBe('mutation');
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'app.data.mutate',
    payload: {
      resourceId: action.resourceId,
      releaseVersion: composition.releaseVersion,
      expectedRevision: action.resourceRevision,
      actionKind: 'mutation',
      actionId,
      expectedActionRevision: action.revision,
      mutation: {
        op: action.op,
        ...(action.resourceId === 'qlt.threads' && input.id !== undefined ? { id: input.id } : {}),
        input,
        idempotencyKey,
      },
    },
    idempotencyKey,
  });
  if (!outcome.ok) {
    throw new Error(`the governed dispatch failed at the command layer: ${outcome.code}`);
  }
  expect(outcome.ok).toBe(true);
  // The mutation-LEVEL result (the released boundary's governed result):
  // undefined means a replayed durable receipt (truthful replay).
  const result = (outcome.data as { result?: { ok: boolean; code?: string } }).result;
  return {
    replayed: result === undefined,
    ok: result === undefined || result.ok === true,
    code: result?.code,
  };
}

describe('Q6 fresh-thread continuity (real composition, offline)', () => {
  it('N-Q6-4: a real turn drafts the proposal through the capability; the invocation is truthful write evidence; the proposal is inert', async () => {
    const composition = await compose(OFFLINE_SCRIPT);
    const threadA = await composition.sharedWorld.createThread({ title: 'Principal' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn1 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_EXAMPLE_STATEMENT,
      'q6-t1',
    );
    expect(await awaitTerminal(composition, turn1)).toBe('completed');

    const invocations = await composition.stores.invocations.listInvocationsForTurn(turn1);
    const record = invocations.at(-1)!;
    expect(record.capabilityId).toBe('qlt.proposal.draft');
    expect(record.capabilityRevision).toBe('2');
    expect(record.effect).toBe('write');
    expect(record.approvalRequired).toBe(false);
    expect(record.approvalDisposition).toBe('host-policy-write-without-separate-approval');
    expect(record.effectPolicyIdentity).toBe('vict-effect-policy@1');
    expect(
      await composition.stores.approvals.listApprovalsForInvocation(record.invocationId),
    ).toHaveLength(0);
    expect(await composition.stores.approvals.listOpenApprovals()).toEqual([]);

    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    expect(proposals.total).toBe(1);
    expect(proposals.rows[0]!.status).toBe('proposed');
    expect(proposals.rows[0]!.proposedBy).toBe(QLT_AGENT_PROPOSER_ID);
    const candidates = await composition.sharedWorld.listContextCandidates();
    expect(candidates.some((candidate) => candidate.id === proposals.rows[0]!.id)).toBe(false);
  });

  it('N-Q6-5: a governed confirmation creates exactly one canonical record; a fresh conversation receives it through C1 with zero transcript pollution', async () => {
    const composition = await compose(OFFLINE_SCRIPT);
    const threadA = await composition.sharedWorld.createThread({ title: 'Principal' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn1 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_EXAMPLE_STATEMENT,
      'q6-t1',
    );
    expect(await awaitTerminal(composition, turn1)).toBe('completed');
    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    const proposal = proposals.rows[0]!;

    // Explicit user confirmation through the governed ceremony — the
    // EXACT production shape (the UI sends the proposal identity; the
    // optimistic version check is exercised by the stale-version
    // negative control below).
    const confirmOutcome = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: proposal.id },
      'q6-confirm-1',
    );
    expect(confirmOutcome.replayed).toBe(false);
    expect(confirmOutcome.ok).toBe(true);
    const claims = await composition.sharedWorld.meaning.listClaims({});
    expect(claims.total).toBe(1);
    expect(claims.rows[0]!.status).toBe('active');
    expect(claims.rows[0]!.createdBy).toBe('actor-quellight-local');
    expect(claims.rows[0]!.content.statement).toBe(
      'The user will not leave their current job without a clear pathway and an established base.',
    );
    const claimId = claims.rows[0]!.id;

    // Same-key replay: no duplicate record, no duplicated effect.
    const replay = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: proposal.id },
      'q6-confirm-1',
    );
    expect(replay.ok).toBe(true);
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);

    // Optimistic-concurrency negative control: a STALE expectedVersion on a
    // durable record mutation is refused truthfully with zero effect.
    const staleExit = await governedMutate(
      composition,
      'act.retireClaim',
      { recordId: claimId, reason: 'stale-version control', expectedVersion: 999 },
      'q6-stale-exit',
    );
    expect(staleExit.ok).toBe(false);
    expect(staleExit.code).toBe('QLT_VERSION_CONFLICT');
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);

    // A genuinely fresh conversation with NO transcript dependency.
    const threadB = await composition.sharedWorld.createThread({ title: 'Fresh' });
    const convB = await composition.sharedWorld.ensureConversationLink(threadB.id);
    const restoredBefore = await composition.restoreThread(threadB.id);
    expect(restoredBefore.messages).toHaveLength(0);
    const turnB = await startTurnAdmitted(
      composition,
      threadB.id,
      convB.mastraThreadId,
      'Hello',
      'q6-t-b',
    );
    expect(await awaitTerminal(composition, turnB)).toBe('completed');
    const assemblyB = await composition.sharedWorld.getContextAssemblyByTurn(turnB);
    expect(assemblyB).toBeDefined();
    expect(assemblyB!.outcome).toBe('complete');
    expect(assemblyB!.selectedIds.some((entry) => entry.id === claimId)).toBe(true);

    // Zero transcript pollution on BOTH threads; the fresh conversation
    // holds exactly its own user + assistant exchange.
    for (const threadId of [threadA.id, threadB.id]) {
      const restored = await composition.restoreThread(threadId);
      const transcript = restored.messages.map((message) => message.text).join('\n');
      expect(transcript).not.toContain(QLT_CONTEXT_BLOCK_OPEN);
      expect(transcript).not.toContain(QLT_CONTEXT_BLOCK_CLOSE);
      expect(transcript).not.toContain(QLT_CONTEXT_RECORD_CLOSE);
    }
    const restoredB = await composition.restoreThread(threadB.id);
    expect(restoredB.messages).toHaveLength(2);
    expect(restoredB.messages[0]!.role).toBe('user');
    expect(restoredB.messages[1]!.role).toBe('assistant');
  });

  it('N-Q6-6: a conflicting later statement leaves the standing record unchanged and still available', async () => {
    const composition = await compose(OFFLINE_SCRIPT);
    const threadA = await composition.sharedWorld.createThread({ title: 'Principal' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn1 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_EXAMPLE_STATEMENT,
      'q6-t1',
    );
    expect(await awaitTerminal(composition, turn1)).toBe('completed');
    const proposal = (
      await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadA.id })
    ).rows[0]!;
    expect(
      (
        await governedMutate(
          composition,
          'act.confirmProposal',
          { proposalId: proposal.id },
          'q6-confirm-1',
        )
      ).ok,
    ).toBe(true);
    const claim = (await composition.sharedWorld.meaning.listClaims({})).rows[0]!;

    const turnConflict = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      'Update: I have decided to leave my job as soon as possible.',
      'q6-t-conflict',
    );
    expect(await awaitTerminal(composition, turnConflict)).toBe('completed');

    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);
    const claimAfter = await composition.sharedWorld.meaning.getClaim(claim.id);
    expect(claimAfter!.id).toBe(claim.id);
    expect(claimAfter!.version).toBe(1);
    expect(claimAfter!.status).toBe('active');
    expect(claimAfter!.content.statement).toBe(claim.content.statement);
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(turnConflict);
    expect(assembly!.outcome).toBe('complete');
    expect(assembly!.selectedIds.some((entry) => entry.id === claim.id)).toBe(true);
  });

  it('N-Q6-8: restart preserves the confirmed record, its lineage, and the assembly evidence', async () => {
    const composition = await compose(OFFLINE_SCRIPT);
    const threadA = await composition.sharedWorld.createThread({ title: 'Principal' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn1 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_EXAMPLE_STATEMENT,
      'q6-t1',
    );
    expect(await awaitTerminal(composition, turn1)).toBe('completed');
    const proposal = (
      await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadA.id })
    ).rows[0]!;
    expect(
      (
        await governedMutate(
          composition,
          'act.confirmProposal',
          { proposalId: proposal.id },
          'q6-confirm-1',
        )
      ).ok,
    ).toBe(true);
    const threadB = await composition.sharedWorld.createThread({ title: 'Fresh' });
    const convB = await composition.sharedWorld.ensureConversationLink(threadB.id);
    const turnB = await startTurnAdmitted(
      composition,
      threadB.id,
      convB.mastraThreadId,
      'Hello',
      'q6-t-b',
    );
    expect(await awaitTerminal(composition, turnB)).toBe('completed');
    const assemblyBefore = await composition.sharedWorld.getContextAssemblyByTurn(turnB);
    const claim = (await composition.sharedWorld.meaning.listClaims({})).rows[0]!;
    const dataDir = composition.dataDir;

    await composition.close();
    composed.length = 0;
    const composition2 = await compose(OFFLINE_SCRIPT, dataDir);
    const claimAfter = await composition2.sharedWorld.meaning.getClaim(claim.id);
    expect(claimAfter!.id).toBe(claim.id);
    expect(claimAfter!.status).toBe('active');
    expect(claimAfter!.version).toBe(1);
    expect(claimAfter!.content.statement).toBe(claim.content.statement);
    const links = await composition2.sharedWorld.meaning.listSourceLinks({
      fromRecordId: claim.id,
    });
    expect(
      links.some((link) => link.relation === 'source-thread' && link.toRef === threadA.id),
    ).toBe(true);
    const assemblyAfter = await composition2.sharedWorld.getContextAssemblyByTurn(turnB);
    expect(JSON.stringify(assemblyAfter)).toBe(JSON.stringify(assemblyBefore));
  });
});
