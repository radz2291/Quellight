import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import {
  QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT,
  QLT_PROPOSAL_CAPABILITY_ID,
  QLT_PROPOSAL_CAPABILITY_REVISION,
  QLT_AGENT_PROPOSER_ID,
} from '../src/lib/sharedworld/ceremony-contract';
import {
  createProposalDraftCapability,
  proposalDraftInputContract,
  proposalDraftOutputContract,
  type ProposalDraftInvocationContext,
} from '../src/lib/agent/proposal-capability';
import type { QltProposal } from '../src/lib/sharedworld/meaning-contract';

/**
 * Lane B focused tests (freeze §16 file ownership): the pinned agent
 * proposal-draft capability against the frozen Q3 contract — inert
 * proposals only, server-derived correlation, keyed idempotency,
 * one-open-proposal-per-turn/kind, no confirmer power, no read surface.
 */

const tempDirs: string[] = [];
function openStore(clock: () => number = () => 1_000_000) {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q3-laneb-'));
  tempDirs.push(dir);
  const store = createSharedWorldSqlite({ path: ':memory:', clock });
  return { store, dir };
}

const CLAIM_CONTENT = {
  subject: 'Deep work preferences',
  epistemicType: 'E5',
  honestyState: 'likely',
  confidence: 'qualified',
  statement: 'The user does their most important work in focused morning sessions.',
};

const LOOP_CONTENT = {
  subject: 'Travel plans',
  loopKind: 'undecided_question',
  detail: 'The travel plans are still undecided.',
} as const;

/**
 * The released bridge invokes the definition with a bridge-scoped context
 * (a superset of the SDK `CapabilityContext` fields it actually supplies);
 * the tests exercise that exact released shape.
 */
function invokeRaw(
  capability: { invoke(input: unknown, context: never): unknown },
  input: unknown,
  context: ProposalDraftInvocationContext,
): Promise<unknown> {
  return Promise.resolve(capability.invoke(input, context as never));
}

function ctx(
  overrides: Partial<ProposalDraftInvocationContext> = {},
): ProposalDraftInvocationContext {
  return {
    victTurnId: 'turn-abc',
    victActorId: 'actor-quellight-local',
    victIdempotencyKey: 'turn-abc:call-1:qlt.proposal.draft:1:digest',
    ...overrides,
  };
}

describe('qlt.proposal.draft — closed contracts', () => {
  it('accepts a valid kind-shaped draft input and rejects unknown fields', () => {
    const ok = proposalDraftInputContract.parse({
      proposalKind: 'claim',
      content: CLAIM_CONTENT,
    });
    expect(ok.ok).toBe(true);

    const hostile = proposalDraftInputContract.parse({
      proposalKind: 'claim',
      content: CLAIM_CONTENT,
      sourceThreadId: 'qlt-forged-thread',
      sourceTurnRef: 'turn-forged',
      proposedBy: 'agent-quellight',
    });
    expect(hostile.ok).toBe(false);
    if (!hostile.ok) {
      const paths = hostile.issues.map((entry) => entry.path);
      expect(paths).toContain('sourceThreadId');
      expect(paths).toContain('sourceTurnRef');
      expect(JSON.stringify(hostile)).not.toContain('qlt-forged-thread');
    }
  });

  it('rejects the correction kind in Q3 (agent correction targeting deferred to Q4)', () => {
    const correction = proposalDraftInputContract.parse({
      proposalKind: 'correction',
      content: { statement: 'changed', reason: 'because' },
    });
    expect(correction.ok).toBe(false);
    if (!correction.ok) {
      expect(correction.issues.map((entry) => entry.code)).toContain('QLT_INPUT_INVALID_ENUM');
    }
  });

  it('rejects hostile containers and oversized content through the Q2 fence', () => {
    const exotic = proposalDraftInputContract.parse([
      { proposalKind: 'claim', content: CLAIM_CONTENT },
    ]);
    expect(exotic.ok).toBe(false);

    const proto = proposalDraftInputContract.parse(
      JSON.parse('{"proposalKind":"claim","content":{"__proto__":{"x":1}}}') as unknown,
    );
    expect(proto.ok).toBe(false);

    const oversized = proposalDraftInputContract.parse({
      proposalKind: 'claim',
      content: { ...CLAIM_CONTENT, statement: 'x'.repeat(2001) },
    });
    expect(oversized.ok).toBe(false);
  });

  it('the output contract admits ONLY the closed bounded outcome union', () => {
    expect(proposalDraftOutputContract.parse({ accepted: true, proposalId: 'qlt-p-1' }).ok).toBe(
      true,
    );
    expect(
      proposalDraftOutputContract.parse({ accepted: false, code: 'QLT_THREAD_MISSING' }).ok,
    ).toBe(true);
    // A record payload can never cross: unknown fields and unknown codes fail.
    expect(
      proposalDraftOutputContract.parse({
        accepted: true,
        proposalId: 'qlt-p-1',
        records: [{ statement: 'confirmed meaning' }],
      }).ok,
    ).toBe(false);
    expect(
      proposalDraftOutputContract.parse({ accepted: false, code: 'RECORDS: everything' }).ok,
    ).toBe(false);
  });
});

describe('qlt.proposal.draft — inert proposals, correlation, idempotency', () => {
  it('creates ONE epistemically inert pending proposal with server-derived provenance', async () => {
    const { store } = openStore();
    const thread = await store.createThread({ title: 'Lane B thread' });
    const capability = createProposalDraftCapability({
      meaning: store.meaning,
      resolveTurnCorrelation: async (turnId, actorId) => {
        expect(turnId).toBe('turn-abc');
        expect(actorId).toBe('actor-quellight-local');
        return { threadId: thread.id };
      },
    });

    expect(capability.id).toBe(QLT_PROPOSAL_CAPABILITY_ID);
    expect(capability.revision).toBe(QLT_PROPOSAL_CAPABILITY_REVISION);
    expect(capability.effect).toBe(QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT);

    const outcome = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: CLAIM_CONTENT },
      ctx(),
    )) as { accepted: boolean; proposalId?: string };
    expect(outcome.accepted).toBe(true);

    const proposal: QltProposal | undefined = await store.meaning.getProposal(
      outcome.proposalId as string,
    );
    expect(proposal).toBeDefined();
    expect(proposal?.status).toBe('proposed');
    expect(proposal?.proposalKind).toBe('claim');
    expect(proposal?.proposedBy).toBe(QLT_AGENT_PROPOSER_ID);
    expect(proposal?.sourceThreadId).toBe(thread.id);
    expect(proposal?.sourceTurnRef).toBe('turn-abc');

    // Inertness: the proposal is canonical-eligible in NO status, and no
    // substantive record family row was created by the draft.
    const claims = await store.meaning.listClaims({});
    expect(claims.total).toBe(0);
    const commitments = await store.meaning.listCommitments({});
    expect(commitments.total).toBe(0);
    const loops = await store.meaning.listOpenLoops({});
    expect(loops.total).toBe(0);
    store.close();
  });

  it('fails closed on missing or untrustworthy correlation', async () => {
    const { store } = openStore();
    const capability = createProposalDraftCapability({
      meaning: store.meaning,
      resolveTurnCorrelation: async () => undefined,
    });
    const noTurn = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: CLAIM_CONTENT },
      ctx({ victTurnId: undefined }),
    )) as { accepted: boolean; code?: string };
    expect(noTurn).toEqual({ accepted: false, code: 'QLT_CORRELATION_MISSING' });

    const unknownTurn = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: CLAIM_CONTENT },
      ctx(),
    )) as { accepted: boolean; code?: string };
    expect(unknownTurn).toEqual({ accepted: false, code: 'QLT_CORRELATION_MISSING' });

    const noKey = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: CLAIM_CONTENT },
      ctx({ victIdempotencyKey: undefined }),
    )) as { accepted: boolean; code?: string };
    expect(noKey).toEqual({ accepted: false, code: 'QLT_CORRELATION_MISSING' });

    const page = await store.meaning.listProposals({});
    expect(page.total).toBe(0);
    store.close();
  });

  it('converges identical retries on the derived store key (exactly one proposal)', async () => {
    const { store } = openStore();
    const thread = await store.createThread({ title: 'Retry thread' });
    const capability = createProposalDraftCapability({
      meaning: store.meaning,
      resolveTurnCorrelation: async () => ({ threadId: thread.id }),
    });
    const first = (await invokeRaw(
      capability,
      { proposalKind: 'open_loop', content: LOOP_CONTENT },
      ctx(),
    )) as { accepted: boolean; proposalId?: string };
    const retry = (await invokeRaw(
      capability,
      { proposalKind: 'open_loop', content: LOOP_CONTENT },
      ctx(),
    )) as { accepted: boolean; proposalId?: string };
    expect(first.accepted).toBe(true);
    expect(retry.accepted).toBe(true);
    expect(retry.proposalId).toBe(first.proposalId);
    const page = await store.meaning.listProposals({});
    expect(page.total).toBe(1);
    store.close();
  });

  it('enforces one open proposal per (thread, kind, turn); different kinds coexist', async () => {
    const { store } = openStore();
    const thread = await store.createThread({ title: 'Uniqueness thread' });
    const capability = createProposalDraftCapability({
      meaning: store.meaning,
      resolveTurnCorrelation: async () => ({ threadId: thread.id }),
    });
    const first = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: CLAIM_CONTENT },
      ctx(),
    )) as { accepted: boolean };
    expect(first.accepted).toBe(true);

    // Second same-kind draft in the SAME turn: distinct invocation key,
    // refused by the frozen one-open-per-turn rule.
    const second = (await invokeRaw(
      capability,
      { proposalKind: 'claim', content: { ...CLAIM_CONTENT, subject: 'Other subject' } },
      ctx({ victIdempotencyKey: 'turn-abc:call-2:qlt.proposal.draft:1:digest2' }),
    )) as { accepted: boolean; code?: string };
    expect(second).toEqual({ accepted: false, code: 'QLT_PROPOSAL_OPEN_EXISTS' });

    // A different kind in the same turn coexists.
    const loop = (await invokeRaw(
      capability,
      { proposalKind: 'open_loop', content: LOOP_CONTENT },
      ctx({ victIdempotencyKey: 'turn-abc:call-3:qlt.proposal.draft:1:digest3' }),
    )) as { accepted: boolean };
    expect(loop.accepted).toBe(true);

    const page = await store.meaning.listProposals({});
    expect(page.total).toBe(2);
    store.close();
  });

  it('the proposed-by identity is the product agent identity; no decision identity exists on the surface', async () => {
    const { store } = openStore();
    const thread = await store.createThread({ title: 'Identity thread' });
    const capability = createProposalDraftCapability({
      meaning: store.meaning,
      resolveTurnCorrelation: async () => ({ threadId: thread.id }),
    });
    // Even a hostile caller cannot smuggle a confirmer onto the surface:
    // the input contract rejects unknown fields, and the capability exposes
    // no decision verb at all.
    const hostile = await invokeRaw(
      capability,
      {
        proposalKind: 'claim',
        content: CLAIM_CONTENT,
        confirmedBy: 'agent-quellight',
        decision: 'confirmed',
      },
      ctx(),
    );
    expect(hostile).toEqual({ accepted: false, code: 'QLT_INPUT_REJECTED' });
    const capabilityKeys = Object.keys(capability).sort();
    expect(capabilityKeys).toEqual([
      'effect',
      'id',
      'idempotency',
      'input',
      'invoke',
      'output',
      'revision',
    ]);
    store.close();
  });
});
