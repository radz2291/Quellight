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
import { QLT_AGENT_PROPOSER_ID } from '../src/lib/sharedworld/ceremony-contract';
import {
  QLT_Q6_ADVICE_MARKERS,
  QLT_Q6_COMMITMENT_ANCHORS,
  QLT_Q6_HARDSHIP_TERMS,
  QLT_Q6_SIGNAL_CLAIM_MARKERS,
  QLT_Q6_T1_STATEMENT,
  QLT_Q6_T3_STATEMENT,
  QLT_Q6_T4_STATEMENT,
  QLT_Q6_T5_STATEMENT,
} from '../src/lib/sharedworld/q6-contract';
import {
  containsAll,
  containsAny,
  evaluateConflictTurn,
  evaluateDiscretionaryNegative,
  evaluateDiscretionaryPositive,
  evaluateExplicitPositive,
  evaluateNaturalFlow,
  normalizeText,
} from '../scripts/lib/q6-acceptance.mjs';

/**
 * Q6 bounded memory discretion (D-Q6-6; amendment §3–§5): focused OFFLINE
 * coverage for the rule-guided discretion policy, its acceptance
 * predicates, and the authority/quiet rules around it. The fake-model
 * scripts here prove the PREDICATES and the composition wiring — they do
 * NOT prove real-model discretion; only the live Execution 3 can.
 * Every store lives in a disposable temp directory; nothing personal is
 * present in this file (the live natural fixture stays external).
 */

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q6-discretion-'));
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

/**
 * A SYNTHETIC, NON-PERSONAL fixture with the same semantic structure as the
 * private live fixture: transient equipment/software troubles, one durable
 * commitment carrying the four anchors, one unresolved pacing decision, and
 * explicit uncertainty over whether the trouble "means anything".
 */
const SYNTHETIC_MIXED_FIXTURE = [
  'This week was a setup marathon: my work laptop screen died, so I had to move to a borrowed machine,',
  'the tools had to be reinstalled twice, and a part I ordered for the desk never arrived on time.',
  'Through all of that, one thing stays fixed: I will not leave my current job until there is a clear pathway',
  'and an established base for the change I am building toward.',
  'I still cannot decide whether to push that change on a fast track or move gradually, and honestly,',
  'I do not know whether this stretch of trouble is a signal of anything at all.',
].join(' ');

const claimToolCall = (statement: string) => ({
  kind: 'tool-call',
  toolName: 'qlt_proposal_draft',
  args: {
    proposalKind: 'claim',
    content: {
      subject: 'Explanation preference',
      epistemicType: 'E5',
      honestyState: 'likely',
      confidence: 'qualified',
      statement,
    },
  },
  thenText: 'Understood — plain language first, details after.',
});

const commitmentToolCall = (statement: string) => ({
  kind: 'tool-call',
  toolName: 'qlt_proposal_draft',
  args: {
    proposalKind: 'commitment',
    content: {
      commitmentKey: 'career-transition-base',
      statement,
    },
  },
  thenText:
    'That is a steady way to hold it — building the base first and keeping the job until the pathway is clear.',
});

const openLoopToolCall = (subject: string, detail: string) => ({
  kind: 'tool-call',
  toolName: 'qlt_proposal_draft',
  args: {
    proposalKind: 'open_loop',
    content: {
      subject,
      loopKind: 'undecided_question',
      detail,
    },
  },
  thenText: 'Both paces are real options; no need to settle that today.',
});

const COMMITMENT_STATEMENT =
  'The user will not leave their current job until a clear pathway and an established base exist.';

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
  const outcome = await composition.commandService.dispatch(actorOf(composition), {
    command: 'app.data.mutate',
    payload: {
      resourceId: action.resourceId,
      releaseVersion: composition.releaseVersion,
      expectedRevision: action.resourceRevision,
      actionKind: 'mutation',
      actionId,
      expectedActionRevision: action.revision,
      mutation: { op: action.op, input, idempotencyKey },
    },
    idempotencyKey,
  });
  expect(outcome.ok).toBe(true);
  const result = (outcome as unknown as { data?: { result?: { ok: boolean; code?: string } } }).data
    ?.result;
  return {
    replayed: result === undefined,
    ok: result === undefined || result.ok === true,
    code: result?.code,
  };
}

async function canonicalTotal(composition: QuellightComposition): Promise<number> {
  const [claims, commitments, openLoops] = await Promise.all([
    composition.sharedWorld.meaning.listClaims({}),
    composition.sharedWorld.meaning.listCommitments({}),
    composition.sharedWorld.meaning.listOpenLoops({}),
  ]);
  return claims.total + commitments.total + openLoops.total;
}

describe('Q6 discretion identity (D-Q6-6; amendment §4)', () => {
  it('the composition activates instruction artifact revision 5 through profile revision 7', async () => {
    const composition = await compose({ Hello: { kind: 'text', text: 'Hello.' } });
    expect(composition.activation.instructions.reference.id).toBe(
      'quellight.conversation-instructions',
    );
    expect(composition.activation.instructions.reference.revision).toBe('5');
    expect(composition.activation.profile.profile.id).toBe('agent.quellight.conversation');
    expect(composition.activation.profile.profile.revision).toBe('7');
    // The authority envelope is unchanged by the identity bump.
    expect(composition.activation.capabilities).toHaveLength(1);
    expect(composition.activation.capabilities[0]?.revision).toBe('3');
  });
});

describe('Q6 discretion routing (real composition; deterministic fake models)', () => {
  it('explicit positive: an explicit remember request drafts exactly one claim proposal; nothing canonical; no memory-write claim', async () => {
    const composition = await compose({
      [QLT_Q6_T1_STATEMENT]: claimToolCall(
        'The user prefers explanations in plain language before technical details.',
      ),
    });
    const threadA = await composition.sharedWorld.createThread({ title: 'Explicit' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T1_STATEMENT,
      'q6-disc-t1',
    );
    expect(await awaitTerminal(composition, turn)).toBe('completed');
    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    expect(proposals.total).toBe(1);
    expect(proposals.rows[0]?.proposalKind).toBe('claim');
    expect(proposals.rows[0]?.status).toBe('proposed');
    expect(await canonicalTotal(composition)).toBe(0);
    const findings = evaluateExplicitPositive({
      replyText: 'Understood — plain language first, details after.',
      proposals: proposals.rows.map((row) => ({ kind: row.proposalKind })),
      canonicalRecords: await canonicalTotal(composition),
    });
    expect(findings).toEqual([]);
  });

  it('discretionary positive: the synthetic mixed fixture yields exactly one anchor-complete commitment plus at most one transition open loop; zero canonical', async () => {
    const composition = await compose({
      [SYNTHETIC_MIXED_FIXTURE]: {
        kind: 'tool-chain',
        calls: [
          { toolName: 'qlt_proposal_draft', args: commitmentToolCall(COMMITMENT_STATEMENT).args },
          {
            toolName: 'qlt_proposal_draft',
            args: openLoopToolCall(
              'Transition pacing',
              'The user is undecided between fast-tracking the transition and moving gradually.',
            ).args,
          },
        ],
        thenText:
          'That is a steady way to hold it — the base first, the pathway clear, and both paces still open.',
      },
    });
    const threadA = await composition.sharedWorld.createThread({ title: 'Mixed' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      SYNTHETIC_MIXED_FIXTURE,
      'q6-disc-t2',
    );
    expect(await awaitTerminal(composition, turn)).toBe('completed');
    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    expect(proposals.total).toBe(2);
    const kinds = proposals.rows.map((row) => row.proposalKind).sort();
    expect(kinds).toEqual(['commitment', 'open_loop']);
    const commitment = proposals.rows.find((row) => row.proposalKind === 'commitment');
    const commitmentStatement =
      (commitment?.content as { statement?: string } | undefined)?.statement ?? '';
    expect(containsAll(normalizeText(commitmentStatement), QLT_Q6_COMMITMENT_ANCHORS)).toBe(true);
    expect(await canonicalTotal(composition)).toBe(0);
  });

  it('discretionary positive acceptance: a commitment-only outcome is accepted; anchors, advice, and signal rules hold', () => {
    const findings = evaluateDiscretionaryPositive({
      replyText: 'That is a steady way to hold it — the base first, the pathway clear.',
      proposals: [
        { kind: 'commitment', content: { commitmentKey: 'k', statement: COMMITMENT_STATEMENT } },
      ],
      canonicalRecords: 0,
      invocationCount: 1,
    });
    expect(findings).toEqual([]);
  });

  it('discretionary positive rejection: a hardship-only proposal fails the anchors rule', () => {
    const findings = evaluateDiscretionaryPositive({
      replyText: 'That setup week sounds exhausting.',
      proposals: [
        {
          kind: 'commitment',
          content: {
            commitmentKey: 'k',
            statement:
              'The user spent the week fighting laptop setup trouble, reinstalls, and a late delivery.',
          },
        },
      ],
      canonicalRecords: 0,
      invocationCount: 1,
    });
    expect(findings.some((finding) => finding.includes('semantic anchors'))).toBe(true);
  });

  it('discretionary positive rejection: a hardship-as-factual-signal proposal is refused', () => {
    const findings = evaluateDiscretionaryPositive({
      replyText: 'Noted.',
      proposals: [
        {
          kind: 'claim',
          content: {
            subject: 'Signal',
            epistemicType: 'E5',
            honestyState: 'known',
            confidence: 'stated',
            statement: 'The setup hardship is a signal that the user must leave the job.',
          },
        },
      ],
      canonicalRecords: 0,
      invocationCount: 1,
    });
    expect(findings.some((finding) => finding.includes('not permitted in this turn'))).toBe(true);
    expect(findings.some((finding) => finding.includes('factual signal or proof'))).toBe(true);
  });

  it('discretionary positive rejection: agent-authored advice cannot pass as the user commitment', () => {
    const findings = evaluateDiscretionaryPositive({
      replyText: 'Here is my thought.',
      proposals: [
        {
          kind: 'commitment',
          content: {
            commitmentKey: 'k',
            statement:
              'You should leave your current job only after a clear pathway and an established base.',
          },
        },
      ],
      canonicalRecords: 0,
      invocationCount: 1,
    });
    expect(findings.some((finding) => finding.includes('agent-authored advice'))).toBe(true);
  });

  it('discretionary positive rejection: a hardship-flavored open loop is not the transition decision', () => {
    const findings = evaluateDiscretionaryPositive({
      replyText: 'Sounds like a rough week.',
      proposals: [
        { kind: 'commitment', content: { commitmentKey: 'k', statement: COMMITMENT_STATEMENT } },
        {
          kind: 'open_loop',
          content: {
            subject: 'Installer',
            loopKind: 'pending_action',
            detail: 'Whether the reinstall finished without another restart.',
          },
        },
      ],
      canonicalRecords: 0,
      invocationCount: 2,
    });
    expect(findings.some((finding) => finding.includes('transient incident'))).toBe(true);
  });

  it('discretionary positive rejection: more than two proposals or invocations breaches the turn budget', () => {
    const base = {
      kind: 'commitment',
      content: { commitmentKey: 'k', statement: COMMITMENT_STATEMENT },
    };
    const findings = evaluateDiscretionaryPositive({
      replyText: 'Ok.',
      proposals: [base, base, base],
      canonicalRecords: 0,
      invocationCount: 3,
    });
    expect(findings.some((finding) => finding.includes('two-proposal turn budget'))).toBe(true);
    expect(findings.some((finding) => finding.includes('two-invocation bound'))).toBe(true);
  });

  it('transient negative: an ordinary software incident drafts NOTHING', async () => {
    const composition = await compose({
      [QLT_Q6_T3_STATEMENT]: {
        kind: 'text',
        text: 'Eighteen minutes is a long install; hopefully the restarts settle it down.',
      },
    });
    const threadA = await composition.sharedWorld.createThread({ title: 'Transient' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T3_STATEMENT,
      'q6-disc-t3',
    );
    expect(await awaitTerminal(composition, turn)).toBe('completed');
    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    const invocations = await composition.stores.invocations.listInvocationsForTurn(turn);
    const findings = evaluateDiscretionaryNegative({
      replyText: 'Eighteen minutes is a long install; hopefully the restarts settle it down.',
      newProposals: proposals.total,
      invocationCount: invocations.length,
      newCanonicalRecords: await canonicalTotal(composition),
    });
    expect(findings).toEqual([]);
    expect(proposals.total).toBe(0);
    expect(invocations.length).toBe(0);
  });
});

describe('Q6 discretion predicates (pure, deterministic)', () => {
  it('anchor matching tolerates grammatical normalization but requires every anchor', () => {
    const normalized = normalizeText(
      'The user will not leave the CURRENT JOB until a clear pathway and an ESTABLISHED BASE exist.',
    );
    expect(containsAll(normalized, QLT_Q6_COMMITMENT_ANCHORS)).toBe(true);
    expect(
      containsAll(
        normalizeText('The user will not leave the job without a clear pathway.'),
        QLT_Q6_COMMITMENT_ANCHORS,
      ),
    ).toBe(false);
  });

  it('the anchor set is exactly the four frozen anchors', () => {
    expect([...QLT_Q6_COMMITMENT_ANCHORS].sort()).toEqual([
      'clear pathway',
      'current job',
      'established base',
      'not leave',
    ]);
  });

  it('natural-flow rules reject save-claims and implementation jargon, and accept plain conversation', () => {
    expect(evaluateNaturalFlow('I saved that to your memory.').length).toBeGreaterThan(0);
    expect(evaluateNaturalFlow('I have remembered that for you.').length).toBeGreaterThan(0);
    expect(evaluateNaturalFlow('Memory updated with your preference.').length).toBeGreaterThan(0);
    expect(
      evaluateNaturalFlow('The tool call drafted a pending proposal in the Shared World.').length,
    ).toBeGreaterThan(0);
    expect(evaluateNaturalFlow('That makes sense — holding the base first is steady.')).toEqual([]);
    expect(evaluateNaturalFlow('   ')[0]).toContain('empty');
  });

  it('advice and signal marker vocabularies carry the amendment rules', () => {
    const adviceText = 'my advice is to wait';
    const signalText = 'the trouble is a signal that leaving is right';
    expect(containsAny(normalizeText(adviceText), QLT_Q6_ADVICE_MARKERS)).toBe(true);
    expect(containsAny(normalizeText(signalText), QLT_Q6_SIGNAL_CLAIM_MARKERS)).toBe(true);
    expect(containsAny(normalizeText(COMMITMENT_STATEMENT), QLT_Q6_ADVICE_MARKERS)).toBe(false);
    expect(containsAny(normalizeText(COMMITMENT_STATEMENT), QLT_Q6_SIGNAL_CLAIM_MARKERS)).toBe(
      false,
    );
    expect(containsAny(normalizeText(COMMITMENT_STATEMENT), QLT_Q6_HARDSHIP_TERMS)).toBe(false);
  });

  it('conflict-turn evaluation requires zero invocations and zero proposals', () => {
    expect(
      evaluateConflictTurn({
        replyText: 'A thought experiment, sure.',
        newProposals: 0,
        invocationCount: 0,
      }),
    ).toEqual([]);
    expect(
      evaluateConflictTurn({
        replyText: 'A thought experiment, sure.',
        newProposals: 1,
        invocationCount: 0,
      }).length,
    ).toBe(1);
  });
});

describe('Q6 discretion ceremony (real governed boundary; offline)', () => {
  it('only the user confirmation canonicalizes the commitment; replay duplicates nothing; stale version refused; fresh thread receives it; conflict never mutates it', async () => {
    const composition = await compose({
      [SYNTHETIC_MIXED_FIXTURE]: commitmentToolCall(COMMITMENT_STATEMENT),
      [QLT_Q6_T4_STATEMENT]: {
        kind: 'text',
        text: 'The steady base comes first — advice can follow from that.',
      },
      [QLT_Q6_T5_STATEMENT]: {
        kind: 'text',
        text: 'In that thought experiment the plan would change, but that is hypothetical.',
      },
    });
    const threadA = await composition.sharedWorld.createThread({ title: 'Ceremony' });
    const convA = await composition.sharedWorld.ensureConversationLink(threadA.id);
    const turn2 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      SYNTHETIC_MIXED_FIXTURE,
      'q6-cer-t2',
    );
    expect(await awaitTerminal(composition, turn2)).toBe('completed');
    const proposals = await composition.sharedWorld.meaning.listProposals({
      sourceThreadId: threadA.id,
    });
    const commitment = proposals.rows.find((row) => row.proposalKind === 'commitment');
    expect(commitment).toBeDefined();
    // No agent authority: drafting alone canonicalizes nothing.
    expect(await canonicalTotal(composition)).toBe(0);

    const confirm = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: commitment!.id },
      'q6-cer-confirm',
    );
    expect(confirm.replayed).toBe(false);
    expect(confirm.ok).toBe(true);
    expect(await canonicalTotal(composition)).toBe(1);
    const commitments = await composition.sharedWorld.meaning.listCommitments({});
    expect(commitments.total).toBe(1);
    const canonical = commitments.rows[0]!;
    expect(canonical.createdBy).not.toBe(QLT_AGENT_PROPOSER_ID);
    expect(canonical.status).toBe('active');
    expect(canonical.content?.statement).toBe(COMMITMENT_STATEMENT);

    const replay = await governedMutate(
      composition,
      'act.confirmProposal',
      { proposalId: commitment!.id },
      'q6-cer-confirm',
    );
    expect(replay.replayed).toBe(true);
    expect(await canonicalTotal(composition)).toBe(1);

    const stale = await governedMutate(
      composition,
      'act.releaseCommitment',
      { recordId: canonical.id, reason: 'stale-version control', expectedVersion: 999 },
      'q6-cer-stale',
    );
    expect(stale.ok).toBe(false);
    expect(stale.code).toBe('QLT_VERSION_CONFLICT');
    expect(await canonicalTotal(composition)).toBe(1);

    // Fresh conversation: the confirmed commitment is selected; the pending
    // T1-style claim (none here) and any open loop are NOT canonical.
    const threadB = await composition.sharedWorld.createThread({ title: 'Fresh' });
    const convB = await composition.sharedWorld.ensureConversationLink(threadB.id);
    const restoredB = await composition.restoreThread(threadB.id);
    expect(restoredB.messages.length).toBe(0);
    const turn4 = await startTurnAdmitted(
      composition,
      threadB.id,
      convB.mastraThreadId,
      QLT_Q6_T4_STATEMENT,
      'q6-cer-t4',
    );
    expect(await awaitTerminal(composition, turn4)).toBe('completed');
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(turn4);
    expect(assembly).toBeDefined();
    expect(assembly?.outcome).toBe('complete');
    expect(assembly?.selectedIds.some((entry) => entry.id === canonical.id)).toBe(true);

    // Hypothetical conflict: engagement without any proposal and without mutation.
    const turn5 = await startTurnAdmitted(
      composition,
      threadA.id,
      convA.mastraThreadId,
      QLT_Q6_T5_STATEMENT,
      'q6-cer-t5',
    );
    expect(await awaitTerminal(composition, turn5)).toBe('completed');
    const invocations5 = await composition.stores.invocations.listInvocationsForTurn(turn5);
    expect(invocations5.length).toBe(0);
    const after = await composition.sharedWorld.meaning.getCommitment(canonical.id);
    expect(after?.version).toBe(canonical.version);
    expect(JSON.stringify(after?.content)).toBe(JSON.stringify(canonical.content));
    expect(await canonicalTotal(composition)).toBe(1);
  });
});
