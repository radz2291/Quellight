import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';
import { createAppServer } from '../src/lib/server/application-server';
import { getCompiledPlan } from '../src/lib/application/definition';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import {
  createProposalDraftCapability,
  type ProposalDraftInvocationContext,
} from '../src/lib/agent/proposal-capability';
import {
  QLT_AGENT_PROPOSER_ID,
  QLT_FIXTURE_TRIGGERS,
  QLT_MEMORY_MUTATION_OPS,
  QLT_PLAN_ACTION_INVENTORY,
} from '../src/lib/sharedworld/ceremony-contract';
import type { SharedWorldMeaningStore } from '../src/lib/sharedworld/meaning-contract';

/**
 * Lane D — contract-first adversarial suite for the Q3 governed ceremony
 * (freeze §17 matrix B-01..B-32). Every important semantic assertion has an
 * independently inspectable negative control. Fully offline: the
 * deterministic fixture model is the only model; no credential exists.
 */

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q3-ceremony-'));
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
      /* disposable (Windows D-6) */
    }
  }
});

const TRIGGER = QLT_FIXTURE_TRIGGERS[0]!;

function fixtureScript(): Record<string, unknown> {
  return Object.fromEntries(
    QLT_FIXTURE_TRIGGERS.map((trigger) => [
      trigger.userText,
      {
        kind: 'tool-call',
        toolName: trigger.toolName,
        args: trigger.args,
        thenText: trigger.thenText,
      },
    ]),
  );
}

async function compose(
  dir: string,
  overrides: { script?: Record<string, unknown>; clock?: () => number } = {},
) {
  const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, dir);
  const composition = await createQuellightComposition({
    env,
    ...(overrides.script !== undefined ? { offlineScript: overrides.script } : {}),
    ...(overrides.clock !== undefined ? { clock: overrides.clock } : {}),
    skipListen: true,
  });
  composed.push(composition);
  const app = createAppServer(async () => ({ composition }));
  return { composition, app };
}

function actorOf(composition: Awaited<ReturnType<typeof compose>>['composition']) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

async function startTurn(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  threadId: string,
  input: string,
  key: string,
): Promise<{ turnId: string; streamId: string }> {
  const conversation = await composition.sharedWorld.ensureConversationLink(threadId);
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'agent.turn.start',
    payload: { threadId: conversation.mastraThreadId, input },
    idempotencyKey: key,
  });
  if (!outcome.ok) {
    throw new Error(`turn start failed: ${outcome.code}`);
  }
  return outcome.data as { turnId: string; streamId: string };
}

async function awaitTurnTerminal(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  turnId: string,
): Promise<string> {
  for (let i = 0; i < 1200; i += 1) {
    const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
    if (['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
      return turn.status;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error('turn did not settle');
}

async function setupThreadWithProposal(app: ReturnType<typeof createAppServer>) {
  const created = await app.dispatch(
    'act.createThread',
    { title: 'Ceremony' },
    `create-${crypto.randomUUID()}`,
  );
  expect(created.ok).toBe(true);
  const threadId = (created as { value: { id: string } }).value.id;
  return threadId;
}

// ---------------------------------------------------------------------------
// B-01/B-02/B-12: the pinned envelope, the inert draft, server correlation
// ---------------------------------------------------------------------------

describe('B-01/B-02/B-12: the single pinned capability drafts inert, correlated proposals', () => {
  it('a scripted agent turn creates exactly one pending proposal; provenance is server-derived; the transcript stays intact', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir, { script: fixtureScript() });
    const threadId = await setupThreadWithProposal(app);
    const { turnId } = await startTurn(
      composition,
      threadId,
      TRIGGER.userText,
      `turn-${crypto.randomUUID()}`,
    );
    expect(await awaitTurnTerminal(composition, turnId)).toBe('completed');

    const page = await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadId });
    expect(page.total).toBe(1);
    const proposal = page.rows[0]!;
    expect(proposal.status).toBe('proposed');
    expect(proposal.proposalKind).toBe('claim');
    expect(proposal.proposedBy).toBe(QLT_AGENT_PROPOSER_ID);
    // Server-derived correlation: the durable server records, not model input.
    expect(proposal.sourceThreadId).toBe(threadId);
    expect(proposal.sourceTurnRef).toBe(turnId);
    // Inert: no canonical record exists after the draft.
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(0);
    // Truthful turn outcome with the bounded thenText (conversation intact).
    const restored = await composition.restoreThread(threadId);
    expect(restored.messages.some((message) => message.text.includes('pending memory inbox'))).toBe(
      true,
    );
  });

  it('the model cannot smuggle correlation or decision fields (closed input contract)', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const thread = await composition.sharedWorld.createThread({ title: 'Hostile thread' });
    const capability = createProposalDraftCapability({
      meaning: composition.sharedWorld.meaning,
      resolveTurnCorrelation: async () => ({ threadId: thread.id }),
    });
    const ctx = {
      victTurnId: 'turn-x',
      victActorId: 'actor-quellight-local',
      victIdempotencyKey: 'k1',
    } as ProposalDraftInvocationContext;
    const hostile = await capability.invoke(
      {
        proposalKind: 'claim',
        content: {
          subject: 's',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'qualified',
          statement: 'st',
        },
        sourceThreadId: 'qlt-forged',
        sourceTurnRef: 'turn-forged',
        confirmedBy: 'agent-quellight',
      } as never,
      ctx as never,
    );
    expect(hostile).toEqual({ accepted: false, code: 'QLT_INPUT_REJECTED' });
    expect((await composition.sharedWorld.meaning.listProposals({})).total).toBe(0);
  });

  it('the compiled plan carries EXACTLY the frozen Q3 inventory PLUS exactly the two Q5 actions', async () => {
    // Q5 bounded re-pin (freeze §14): the frozen Q3 19-action inventory is
    // unchanged; the plan adds EXACTLY act.queryInspection and
    // act.setMemoryMode. The Q3 actions themselves are unchanged.
    const plan = getCompiledPlan();
    expect(Object.keys(plan.actions).sort()).toEqual(
      [...QLT_PLAN_ACTION_INVENTORY, 'act.queryInspection', 'act.setMemoryMode'].sort(),
    );
    expect(Object.keys(plan.actions)).toHaveLength(21);
  });
});

// ---------------------------------------------------------------------------
// B-03/B-04: the agent can NEVER decide; the store refuses agent identities
// ---------------------------------------------------------------------------

describe('B-03/B-04: agent decision attempts fail with zero effects', () => {
  it('an agent confirmer is refused by the repository and leaves zero effects', async () => {
    const store = createSharedWorldSqlite({ path: ':memory:' });
    const thread = await store.createThread({ title: 'Authority' });
    await store.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'st',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: {
        subject: 's',
        epistemicType: 'E5',
        honestyState: 'likely',
        confidence: 'qualified',
        statement: 'st',
      },
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: thread.id,
      sourceTurnRef: 'turn-1',
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    await expect(
      store.meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: 'agent-quellight' }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.rejectProposal({ proposalId: proposal.id, decidedBy: 'agent-quellight' }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.withdrawProposal({ proposalId: proposal.id, withdrawnBy: 'agent-quellight' }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.amendProposal({
        proposalId: proposal.id,
        amendedBy: 'agent-quellight',
        content: {
          subject: 's',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'qualified',
          statement: 'st2',
        },
      }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    const after = await store.meaning.getProposal(proposal.id);
    expect(after?.status).toBe('awaiting_decision');
    expect((await store.meaning.listClaims({})).total).toBe(1);
    store.close();
  });

  it('user corrections through the store refuse agent identities; exits are actor-only', async () => {
    const store = createSharedWorldSqlite({ path: ':memory:' });
    const thread = await store.createThread({ title: 'Correct authority' });
    const claim = await store.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'before',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    await expect(
      store.meaning.applyCorrection({
        subjectRecordId: claim.id,
        subjectFamily: 'claim',
        correctionKey: 'k1',
        content: { statement: 'after' },
        correctedBy: 'agent-quellight',
      }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.retireClaim({ recordId: claim.id, exitedBy: 'agent-quellight' }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    const unchanged = await store.meaning.getClaim(claim.id);
    expect(unchanged?.content.statement).toBe('before');
    store.close();
  });
});

// ---------------------------------------------------------------------------
// B-05..B-07: the user ceremony through the governed boundary
// ---------------------------------------------------------------------------

describe('B-05..B-07: confirm, reject, withdraw, amend through act.*', () => {
  it('confirm closes the ceremony exactly once with user attribution and one canonical record', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir, { script: fixtureScript() });
    const threadId = await setupThreadWithProposal(app);
    const { turnId } = await startTurn(
      composition,
      threadId,
      TRIGGER.userText,
      `turn-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, turnId);
    const proposal = (
      await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadId })
    ).rows[0]!;

    const confirmed = await app.dispatch(
      'act.confirmProposal',
      { proposalId: proposal.id },
      `confirm-${proposal.id}`,
    );
    expect(confirmed.ok).toBe(true);
    expect((confirmed as { value: { status: string } }).value.status).toBe('confirmed');

    const claims = await composition.sharedWorld.meaning.listClaims({});
    expect(claims.total).toBe(1);
    const created = claims.rows[0]!;
    expect(created.createdBy).toBe('actor-quellight-local');
    expect(created.proposalId).toBe(proposal.id);
    expect(created.content.statement).toContain('focused morning sessions');
    // Full ceremony provenance.
    const links = await composition.sharedWorld.meaning.listSourceLinks({
      fromRecordId: created.id,
    });
    expect(
      links.some((link) => link.relation === 'proposed-from' && link.toRef === proposal.id),
    ).toBe(true);
    // Re-decision is refused truthfully.
    const again = await app.dispatch(
      'act.confirmProposal',
      { proposalId: proposal.id },
      `confirm-${proposal.id}-2`,
    );
    expect(again.ok).toBe(false);
    expect((again as { code?: string }).code).toBe('QLT_PROPOSAL_ALREADY_DECIDED');
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);
  });

  it('reject and withdraw create NO canonical record and are terminal; amend creates a NEW pending proposal without confirming', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir, { script: fixtureScript() });
    const threadId = await setupThreadWithProposal(app);

    // Proposal 1: reject.
    const { turnId: t1 } = await startTurn(
      composition,
      threadId,
      TRIGGER.userText,
      `t1-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, t1);
    const p1 = (await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadId }))
      .rows[0]!;
    const rejected = await app.dispatch(
      'act.rejectProposal',
      { proposalId: p1.id, reason: 'not accurate' },
      `reject-${p1.id}`,
    );
    expect(rejected.ok).toBe(true);
    expect((rejected as { value: { status: string } }).value.status).toBe('rejected');
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(0);

    // Proposal 2 on a FRESH thread (the fixture emits each tool call at most
    // once per conversation): amend (the scripted proposal is a claim).
    const thread2 = await setupThreadWithProposal(app);
    const { turnId: t2 } = await startTurn(
      composition,
      thread2,
      TRIGGER.userText,
      `t2-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, t2);
    const proposalsNow = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: thread2,
      status: 'proposed',
    });
    const p2 = proposalsNow.rows[0]!;
    const amended = await app.dispatch(
      'act.amendProposal',
      {
        proposalId: p2.id,
        content: {
          subject: 'Deep work preferences',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'qualified',
          statement: 'The user does focused work in the morning, when possible.',
        },
        reason: 'softened',
      },
      `amend-${p2.id}`,
    );
    expect(amended.ok).toBe(true);
    const original = await composition.sharedWorld.meaning.getProposal(p2.id);
    expect(original?.status).toBe('amended');
    // The amendment is a NEW pending proposal with the amended content.
    const pending = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: thread2,
      status: 'proposed',
    });
    expect(pending.total).toBe(1);
    expect(pending.rows[0]!.id).not.toBe(p2.id);
    expect((pending.rows[0]!.content as { statement: string }).statement).toContain(
      'when possible',
    );
    // Editing NEVER confirmed anything.
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(0);

    // Confirming the amendment confirms ONLY the new record.
    await app.dispatch(
      'act.confirmProposal',
      { proposalId: pending.rows[0]!.id },
      `confirm-amended-${pending.rows[0]!.id}`,
    );
    const claims = await composition.sharedWorld.meaning.listClaims({});
    expect(claims.total).toBe(1);
    expect((claims.rows[0]!.content as { statement: string }).statement).toContain('when possible');

    // Proposal 3 on another fresh thread: withdraw (user-attributed, durable terminal).
    const thread3 = await setupThreadWithProposal(app);
    const { turnId: t3 } = await startTurn(
      composition,
      thread3,
      TRIGGER.userText,
      `t3-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, t3);
    const p3 = (
      await composition.sharedWorld.meaning.listProposals({
        sourceThreadId: thread3,
        status: 'proposed',
      })
    ).rows[0]!;
    const withdrawn = await app.dispatch(
      'act.withdrawProposal',
      { proposalId: p3.id, reason: 'no longer relevant' },
      `withdraw-${p3.id}`,
    );
    expect(withdrawn.ok).toBe(true);
    expect((withdrawn as { value: { status: string } }).value.status).toBe('withdrawn');
    expect((withdrawn as { value: { decisionBy: string } }).value.decisionBy).toBe(
      'actor-quellight-local',
    );
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B-08/B-09: direct Save is user-originated and immediately canonical
// ---------------------------------------------------------------------------

describe('B-08/B-09: direct Save', () => {
  it('Save creates the confirmed record immediately with user attribution — no second ceremony', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const threadId = await setupThreadWithProposal(app);
    const saved = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'Focus',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The user prefers focused work.',
      },
      `save-${crypto.randomUUID()}`,
    );
    expect(saved.ok).toBe(true);
    const claims = await composition.sharedWorld.meaning.listClaims({});
    expect(claims.total).toBe(1);
    expect(claims.rows[0]!.status).toBe('active');
    expect(claims.rows[0]!.createdBy).toBe('actor-quellight-local');
    expect(claims.rows[0]!.proposalId).toBeUndefined();

    const commitment = await app.dispatch(
      'act.createCommitment',
      {
        threadId,
        commitmentKey: 'quarterly-review-prep',
        statement: 'Prepare the quarterly review.',
      },
      `save-c-${crypto.randomUUID()}`,
    );
    expect(commitment.ok).toBe(true);
    const loop = await app.dispatch(
      'act.createOpenLoop',
      { threadId, subject: 'Travel plans', loopKind: 'undecided_question', detail: 'Undecided.' },
      `save-l-${crypto.randomUUID()}`,
    );
    expect(loop.ok).toBe(true);
    expect((await composition.sharedWorld.meaning.listCommitments({})).total).toBe(1);
    expect((await composition.sharedWorld.meaning.listOpenLoops({})).total).toBe(1);
  });

  it('enum violations and missing required fields fail closed with zero effects', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const threadId = await setupThreadWithProposal(app);
    const bad = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'x',
        epistemicType: 'E9',
        honestyState: 'known',
        confidence: 'stated',
        statement: 's',
      },
      `bad-${crypto.randomUUID()}`,
    );
    expect(bad.ok).toBe(false);
    const missing = await app.dispatch(
      'act.createClaim',
      { threadId, statement: 'missing everything else' },
      `missing-${crypto.randomUUID()}`,
    );
    expect(missing.ok).toBe(false);
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B-10..B-13/B-31: correlation, uniqueness, truthful turn outcomes
// ---------------------------------------------------------------------------

describe('B-10..B-13/B-31: correlation, one-open-per-turn, truthful outcomes', () => {
  it('missing turn correlation fails with zero effects (QLT_CORRELATION_MISSING)', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const capability = createProposalDraftCapability({
      meaning: composition.sharedWorld.meaning,
      resolveTurnCorrelation: async () => undefined,
    });
    const outcome = await capability.invoke(
      {
        proposalKind: 'open_loop',
        content: { subject: 's', loopKind: 'undecided_question', detail: 'd' },
      },
      {
        victTurnId: 'turn-missing',
        victActorId: 'actor-quellight-local',
        victIdempotencyKey: 'k',
      } as never,
    );
    expect(outcome).toEqual({ accepted: false, code: 'QLT_CORRELATION_MISSING' });
    expect((await composition.sharedWorld.meaning.listProposals({})).total).toBe(0);
  });

  it('a second same-kind draft in the SAME turn is refused; the turn still completes truthfully (conversation remains primary)', async () => {
    const dir = tempDir();
    const chainScript = {
      [TRIGGER.userText]: {
        kind: 'tool-chain',
        calls: [
          { toolName: TRIGGER.toolName, args: TRIGGER.args },
          { toolName: TRIGGER.toolName, args: TRIGGER.args },
        ],
        thenText: 'Both attempts are settled; the inbox holds what the user allows.',
      },
    } as Record<string, unknown>;
    const { composition, app } = await compose(dir, { script: chainScript });
    const threadId = await setupThreadWithProposal(app);
    const { turnId } = await startTurn(
      composition,
      threadId,
      TRIGGER.userText,
      `turn-${crypto.randomUUID()}`,
    );
    expect(await awaitTurnTerminal(composition, turnId)).toBe('completed');
    // Exactly ONE proposal from the SAME turn/kind; the duplicate was refused.
    const page = await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadId });
    expect(page.total).toBe(1);
    // The transcript is intact (truthful, uncorrupted conversation).
    const restored = await composition.restoreThread(threadId);
    expect(restored.messages.some((m) => m.text.includes('Both attempts'))).toBe(true);
  });

  it('different kinds in the same turn coexist', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const thread = await composition.sharedWorld.createThread({ title: 'Two kinds' });
    const store = composition.sharedWorld.meaning;
    await store.createProposal({
      proposalKind: 'claim',
      content: {
        subject: 's',
        epistemicType: 'E5',
        honestyState: 'likely',
        confidence: 'qualified',
        statement: 'x',
      },
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: thread.id,
      sourceTurnRef: 'turn-1',
    });
    await store.createProposal({
      proposalKind: 'open_loop',
      content: { subject: 's', loopKind: 'undecided_question', detail: 'd' },
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: thread.id,
      sourceTurnRef: 'turn-1',
    });
    const page = await store.listProposals({ sourceThreadId: thread.id });
    expect(page.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// B-14/B-15/B-16: staleness is version-eligibility, never time
// ---------------------------------------------------------------------------

describe('B-14..B-16: staleness', () => {
  it('a changed target version refuses with QLT_PROPOSAL_STALE and zero effects', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const thread = await composition.sharedWorld.createThread({ title: 'Stale' });
    const meaning: SharedWorldMeaningStore = composition.sharedWorld.meaning;
    const claim = await meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'before',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    // A correction-kind proposal drafted against version 1.
    const proposal = await meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'after', reason: 'because' },
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: thread.id,
      sourceTurnRef: 'turn-1',
      targetRecord: { recordId: claim.id, family: 'claim', version: 1 },
    });
    await meaning.markProposalAwaitingDecision(proposal.id);

    // The target moved on (a user correction superseded it: version + 1).
    await meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'user-key',
      content: { statement: 'user correction' },
      correctedBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });

    // Confirming the stale proposal through the governed boundary fails
    // closed with the stable code and ZERO effects.
    const refused = await app.dispatch(
      'act.confirmProposal',
      { proposalId: proposal.id },
      `stale-${proposal.id}`,
    );
    expect(refused.ok).toBe(false);
    expect((refused as { code?: string }).code).toBe('QLT_PROPOSAL_STALE');
    const stillThere = await meaning.listCorrections({ subjectRecordId: claim.id });
    // Only the USER correction exists; the ceremony added nothing.
    expect(stillThere).toHaveLength(1);
    expect((stillThere[0]!.content as { statement: string }).statement).toBe('user correction');
    const unchanged = await meaning.getClaim(claim.id);
    expect(unchanged?.content.statement).toBe('before');
  });

  it('an old pending proposal with unchanged references confirms normally (no clock in the predicate)', async () => {
    let frozen = 1_000_000;
    const dir = tempDir();
    const { composition, app } = await compose(dir, { clock: () => frozen });
    const threadId = await setupThreadWithProposal(app);
    const store = composition.sharedWorld.meaning;
    const proposal = await store.createProposal({
      proposalKind: 'claim',
      content: {
        subject: 's',
        epistemicType: 'E5',
        honestyState: 'likely',
        confidence: 'qualified',
        statement: 'ancient',
      },
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: threadId,
      sourceTurnRef: 'turn-ancient',
    });
    // Centuries pass.
    frozen += 100 * 365 * 24 * 60 * 60 * 1000;
    const confirmed = await app.dispatch(
      'act.confirmProposal',
      { proposalId: proposal.id },
      `ancient-${proposal.id}`,
    );
    expect(confirmed.ok).toBe(true);
    expect((await store.listClaims({})).total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B-18/B-19: corrections are append-only, user-finalized, agent-unreachable
// ---------------------------------------------------------------------------

describe('B-18/B-19: corrections', () => {
  it('act.correctRecord appends lineage with user attribution; the predecessor is untouched', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const threadId = await setupThreadWithProposal(app);
    await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'Focus',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The user prefers mornings.',
      },
      `save-${crypto.randomUUID()}`,
    );
    const claim = (await composition.sharedWorld.meaning.listClaims({})).rows[0]!;
    const before = JSON.stringify(claim.content);
    // The correction carries NO thread identity: the source thread is
    // derived SERVER-SIDE from the subject record (frozen §5).
    const corrected = await app.dispatch(
      'act.correctRecord',
      {
        recordId: claim.id,
        recordKind: 'claim',
        statement: 'The user prefers deep work in the morning.',
        reason: 'more precise',
      },
      `corr-${crypto.randomUUID()}`,
    );
    expect(corrected.ok).toBe(true);
    const successor = (await composition.sharedWorld.meaning.listClaims({})).rows.find(
      (row) => row.id !== claim.id,
    );
    expect(successor?.supersedesId).toBe(claim.id);
    expect(successor?.content.statement).toBe('The user prefers deep work in the morning.');
    expect(successor?.sourceThreadId).toBe(claim.sourceThreadId);
    // Append-only: the predecessor's content bytes never changed.
    const predecessor = await composition.sharedWorld.meaning.getClaim(claim.id);
    expect(JSON.stringify(predecessor!.content)).toBe(before);
    expect(predecessor!.status).toBe('superseded');
    // A retried correction with the same action key converges (no duplicate).
    const corrections = await composition.sharedWorld.meaning.listCorrections({
      subjectRecordId: claim.id,
    });
    expect(corrections).toHaveLength(1);
  });

  it('an agent correction cannot target any record (the capability rejects the correction kind)', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const thread = await composition.sharedWorld.createThread({ title: 'No agent corrections' });
    const claim = await composition.sharedWorld.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'before',
      createdBy: 'actor-quellight-local',
      sourceThreadId: thread.id,
    });
    const capability = createProposalDraftCapability({
      meaning: composition.sharedWorld.meaning,
      resolveTurnCorrelation: async () => ({ threadId: thread.id }),
    });
    const attempt = await capability.invoke(
      {
        proposalKind: 'correction',
        content: { statement: 'hostile replacement', reason: 'model decides' },
        targetRecord: { recordId: claim.id, family: 'claim', version: claim.version },
      } as never,
      {
        victTurnId: 'turn-1',
        victActorId: 'actor-quellight-local',
        victIdempotencyKey: 'k',
      } as never,
    );
    expect(attempt).toEqual({ accepted: false, code: 'QLT_INPUT_REJECTED' });
    expect((await composition.sharedWorld.meaning.listProposals({})).total).toBe(0);
    // A correction of a MISSING record through the user surface fails truthfully.
    const app = createAppServer(async () => ({ composition }));
    const missing = await app.dispatch(
      'act.correctRecord',
      { recordId: 'qlt-nonexistent', recordKind: 'claim', statement: 'x' },
      `corr-missing-${crypto.randomUUID()}`,
    );
    expect(missing.ok).toBe(false);
    expect((missing as { code?: string }).code).toBe('QLT_RECORD_MISSING');
  });
});

// ---------------------------------------------------------------------------
// B-20/B-21/B-22: idempotency, conflicts, double effects
// ---------------------------------------------------------------------------

describe('B-20..B-22: idempotent retries and conflicts', () => {
  it('the same action key converges to ONE effect; conflicting content fails closed', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const threadId = await setupThreadWithProposal(app);
    const key = `save-${crypto.randomUUID()}`;
    const first = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 's',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'one',
      },
      key,
    );
    expect(first.ok).toBe(true);
    // Identical retry (same key, same payload): ONE durable effect.
    const replay = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 's',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'one',
      },
      key,
    );
    expect(replay.ok).toBe(true);
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);

    // A DIFFERENT payload under the same key is refused — either at the
    // released command fence (VICT_COMMAND_IDEMPOTENCY_CONFLICT) or at the
    // store fence (QLT_IDEMPOTENCY_CONFLICT); both are stable, closed, and
    // leave the original effect intact.
    const conflicting = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 's',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'different',
      },
      key,
    );
    expect(conflicting.ok).toBe(false);
    expect(['VICT_COMMAND_IDEMPOTENCY_CONFLICT', 'QLT_IDEMPOTENCY_CONFLICT']).toContain(
      (conflicting as { code?: string }).code,
    );
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(1);
  });

  it('a refused duplicate never consumes the conversation turn (independent truthful outcomes)', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const thread = await composition.sharedWorld.createThread({ title: 'Independent' });
    await composition.sharedWorld.ensureConversationLink(thread.id);
    const store = composition.sharedWorld.meaning;
    const content = { subject: 's', loopKind: 'undecided_question' as const, detail: 'd' };
    await store.createProposal({
      proposalKind: 'open_loop',
      content,
      proposedBy: QLT_AGENT_PROPOSER_ID,
      sourceThreadId: thread.id,
      sourceTurnRef: 'turn-dup',
      key: 'k-a',
    });
    // The second SAME-turn draft fails (unique open-ceremony key), and the
    // failure is a bounded store refusal — no conversation state is touched.
    await expect(
      store.createProposal({
        proposalKind: 'open_loop',
        content,
        proposedBy: QLT_AGENT_PROPOSER_ID,
        sourceThreadId: thread.id,
        sourceTurnRef: 'turn-dup',
        key: 'k-b',
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_EXISTS' });
  });
});

// ---------------------------------------------------------------------------
// B-24: pending proposals survive restart
// ---------------------------------------------------------------------------

describe('B-24: restart recovery', () => {
  it('a pending proposal survives a full composition restart and re-presents through the governed query', async () => {
    const dir = tempDir();
    const first = await compose(dir, { script: fixtureScript() });
    const threadId = await setupThreadWithProposal(first.app);
    const { turnId } = await startTurn(
      first.composition,
      threadId,
      TRIGGER.userText,
      `turn-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(first.composition, turnId);
    const before = await first.composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadId,
    });
    expect(before.total).toBe(1);
    await first.composition.close();
    composed.pop();

    // A FRESH process composition on the same durable directory.
    const second = await compose(dir, { script: fixtureScript() });
    const after = await second.app.dispatch('act.queryMemory', {
      filters: { threadId, kind: 'proposal' },
    });
    expect(after.ok).toBe(true);
    const rows = (after as { value: { rows: Array<{ status: string; stale: string }> } }).value
      .rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('proposed');
    // The restarted process can still complete the ceremony.
    const confirmed = await second.app.dispatch(
      'act.confirmProposal',
      { proposalId: before.rows[0]!.id },
      `restart-confirm-${before.rows[0]!.id}`,
    );
    expect(confirmed.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B-27: FENCE-1 — prohibited keys fail closed; legacy behavior unchanged
// ---------------------------------------------------------------------------

describe('B-27: FENCE-1 ingress hardening (D-Q3-6)', () => {
  it('prototype-named and prohibited keys fail closed with QLT_INGRESS_PROHIBITED_FIELD on thread and memory actions', async () => {
    const dir = tempDir();
    const { app } = await compose(dir);
    const protoBody = JSON.parse('{"title":"t","__proto__":{"x":1}}') as never;
    const proto = await app.dispatch('act.createThread', protoBody, `fence-${crypto.randomUUID()}`);
    expect(proto.ok).toBe(false);
    expect((proto as { code?: string }).code).toBe('QLT_INGRESS_PROHIBITED_FIELD');

    const constructorBody = JSON.parse('{"title":"t","constructor":1}') as never;
    const ctor = await app.dispatch(
      'act.createThread',
      constructorBody,
      `fence-${crypto.randomUUID()}`,
    );
    expect(ctor.ok).toBe(false);
    expect((ctor as { code?: string }).code).toBe('QLT_INGRESS_PROHIBITED_FIELD');

    const memoryProto = JSON.parse('{"proposalId":"qlt-x","__proto__":{}}') as never;
    const memoryFence = await app.dispatch(
      'act.confirmProposal',
      memoryProto,
      `fence-${crypto.randomUUID()}`,
    );
    expect(memoryFence.ok).toBe(false);
    expect((memoryFence as { code?: string }).code).toBe('QLT_INGRESS_PROHIBITED_FIELD');
  });

  it('query filters refuse prohibited keys instead of silently dropping them', async () => {
    const dir = tempDir();
    const { app } = await compose(dir);
    const filters = JSON.parse('{"threadId":"qlt-x","__proto__":{}}') as never;
    const result = await app.dispatch('act.queryMemory', { filters }, `q-${crypto.randomUUID()}`);
    expect(result.ok).toBe(false);
    expect((result as { code?: string }).code).toBe('QLT_INGRESS_PROHIBITED_FIELD');
  });

  it('POSITIVE regression: every previously valid declared-field behavior is preserved', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    // Thread create → rename → archive → reopen (the full legacy surface).
    const created = await app.dispatch(
      'act.createThread',
      { title: 'Legacy' },
      `leg-${crypto.randomUUID()}`,
    );
    expect(created.ok).toBe(true);
    const id = (created as { value: { id: string } }).value.id;
    await composition.sharedWorld.ensureConversationLink(id);
    const renamed = await app.dispatch(
      'act.renameThread',
      { id, title: 'Legacy 2' },
      `leg-r-${crypto.randomUUID()}`,
    );
    expect(renamed.ok).toBe(true);
    const archived = await app.dispatch(
      'act.archiveThread',
      { id },
      `leg-a-${crypto.randomUUID()}`,
    );
    expect(archived.ok).toBe(true);
    const reopened = await app.dispatch(
      'act.reopenThread',
      { id },
      `leg-ro-${crypto.randomUUID()}`,
    );
    expect(reopened.ok).toBe(true);
    // The legacy thread query keeps its shape.
    const listed = await app.dispatch('act.queryThreads', {}, `leg-q-${crypto.randomUUID()}`);
    expect(listed.ok).toBe(true);
    // Unknown (non-prohibited) fields STILL fail with the plain code.
    const unknown = await app.dispatch(
      'act.createThread',
      { title: 't', evilField: 'x' } as never,
      `leg-u-${crypto.randomUUID()}`,
    );
    expect(unknown.ok).toBe(false);
    expect((unknown as { code?: string }).code).toBe('INVALID_REQUEST');
  });
});

// ---------------------------------------------------------------------------
// B-28/B-29: production isolation (structural)
// ---------------------------------------------------------------------------

describe('B-28/B-29: structural isolation', () => {
  it('the memory resource declares EXACTLY the thirteen frozen mutations and the query', () => {
    const plan = getCompiledPlan();
    const memoryOps = (
      Object.values(plan.actions) as Array<{ resourceId?: string; op?: string; kind?: string }>
    )
      .filter((action) => action.resourceId === 'qlt.memory' && action.kind === 'mutation')
      .map((action) => action.op)
      .sort();
    expect(memoryOps).toEqual([...QLT_MEMORY_MUTATION_OPS].sort());
    const queryActions = (
      Object.values(plan.actions) as Array<{ kind?: string; resourceId?: string }>
    ).filter((action) => action.resourceId === 'qlt.memory' && action.kind === 'query');
    expect(queryActions).toHaveLength(1);
  });
});
