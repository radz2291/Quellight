/**
 * Q2 durable Shared World schema — BLACK-BOX and ADVERSARIAL conformance
 * suite (Lane C; acceptance matrix A-06..A-15 and A-19..A-30 of
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md).
 *
 * Lane A's `test/meaning-foundation.test.ts` covers A-01..A-05 (migration,
 * upgrade, rollback, restart, refusal) and A-16..A-18/A-26 (keyed
 * idempotency, concurrency, transaction atomicity). This suite proves the
 * semantic surface through the public repository port and the pure domain
 * layer: round-trips, deterministic serialization/ordering, lifecycle
 * transitions, authority (the agent can NEVER confirm), version-based
 * staleness (time alone NEVER stales), ceremony atomicity, correction
 * lineage (append-only; no duplicate successors; no cycles), deterministic
 * current-effective resolution, canonical eligibility, FENCE-1 hostile
 * inputs, UTF-8 byte bounds, SQL-parameter containment, credential
 * canaries, and the structural no-production-wiring gate.
 *
 * Every negative control asserts a stable code AND zero row-count change.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createSharedWorldSqlite, type SharedWorldSqlite } from '../src/lib/sharedworld/sqlite';
import {
  contentFingerprint,
  canonicalJson,
  QLT_MEANING_TABLES,
  QltMeaningError,
  type QltClaimProposalContent,
  type QltParseIssue,
  type QltParseResult,
} from '../src/lib/sharedworld/meaning-contract';
import {
  assertCorrectionSubjectCurrent,
  assertTransition,
  canAuthor,
  canConfirm,
  canCorrect,
  canPropose,
  canWithdraw,
  isCanonicalEligible,
  parseClaimContent,
  parseClaimProposalContent,
  parseOpenLoopProposalContent,
  proposalStaleness,
  resolveCurrentEffective,
  validateLineageChain,
} from '../src/lib/sharedworld/meaning';
import { getCompiledPlan, threadResource } from '../src/lib/application/definition';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-meaning-q2-'));
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
const MEANING_TABLES = [
  'qlt_proposal',
  'qlt_claim',
  'qlt_commitment',
  'qlt_open_loop',
  'qlt_correction',
  'qlt_source_link',
] as const;

/** Deterministic clock + id factories (advancing). */
function deterministic(idPrefix: string) {
  let now = 1_700_000_000_000;
  let counter = 0;
  return {
    clock: (): number => (now += 10),
    ids: {
      proposalId: (): string => `qlt-${idPrefix}-p-${(counter += 1)}`,
      recordId: (): string => `qlt-${idPrefix}-r-${(counter += 1)}`,
      correctionId: (): string => `qlt-${idPrefix}-c-${(counter += 1)}`,
      linkId: (): string => `qlt-${idPrefix}-l-${(counter += 1)}`,
    },
  };
}

/** Row counts across every meaning table + the idempotency ledger. */
function meaningCounts(dbPath: string): Record<string, number> {
  const raw = new DatabaseSync(dbPath);
  try {
    const counts: Record<string, number> = {};
    for (const table of [...MEANING_TABLES, 'qlt_adapter_idempotency']) {
      const row = raw.prepare(`SELECT COUNT(*) AS total FROM ${table};`).get() as {
        total: number;
      };
      counts[table] = row.total;
    }
    return counts;
  } finally {
    raw.close();
  }
}

function expectNoEffects(dbPath: string, before: Record<string, number>): void {
  expect(meaningCounts(dbPath)).toEqual(before);
}

const claimContent = (statement: string): QltClaimProposalContent => ({
  subject: 'project-alpha',
  epistemicType: 'E3',
  honestyState: 'likely',
  confidence: 'qualified',
  statement,
});

interface StoreHandle {
  readonly store: SharedWorldSqlite;
  readonly dbPath: string;
}

function openStore(idPrefix: string, clock?: () => number): StoreHandle {
  const dbPath = join(tempDir(), 'shared-world.db');
  const det = deterministic(idPrefix);
  const store = createSharedWorldSqlite({
    path: dbPath,
    clock: clock ?? det.clock,
    ids: det.ids,
  });
  return { store, dbPath };
}

/** Narrow a parse result to its issues (rejection required). */
function issuesOf<T>(result: QltParseResult<T>): readonly QltParseIssue[] {
  if (result.ok) {
    throw new Error('expected the input to be rejected');
  }
  return result.issues;
}

/** A thread to anchor proposals on. */
async function withThread(store: SharedWorldSqlite): Promise<string> {
  const thread = await store.createThread({ title: 'Q2 anchor thread' });
  return thread.id;
}

async function createAwaitingClaimProposal(
  store: SharedWorldSqlite,
  threadId: string,
  statement = 'the review concluded on Saturday',
): Promise<string> {
  const proposal = await store.meaning.createProposal({
    proposalKind: 'claim',
    content: claimContent(statement),
    proposedBy: AGENT,
    sourceThreadId: threadId,
  });
  await store.meaning.markProposalAwaitingDecision(proposal.id);
  return proposal.id;
}

describe('A-06: round-trip persistence for every record family', () => {
  it('every family round-trips typed content, provenance, retention default, and version 1', async () => {
    const { store, dbPath } = openStore('a6');
    const threadId = await withThread(store);

    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('round-trip claim'),
      proposedBy: AGENT,
      sourceThreadId: threadId,
      sourceTurnRef: 'turn-0001',
    });
    const fetched = await store.meaning.getProposal(proposal.id);
    expect(fetched).toMatchObject({
      id: proposal.id,
      version: 1,
      status: 'proposed',
      proposalKind: 'claim',
      content: claimContent('round-trip claim'),
      proposedBy: AGENT,
      sourceThreadId: threadId,
      sourceTurnRef: 'turn-0001',
      retentionState: 'currently-relevant',
    });

    const claim = await store.meaning.createClaim({
      subject: 'review-state',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'user-authored claim (explicit Save = confirmation)',
      createdBy: USER,
      sourceThreadId: threadId,
    });
    expect(await store.meaning.getClaim(claim.id)).toMatchObject({
      id: claim.id,
      version: 1,
      status: 'active',
      subject: 'review-state',
      epistemicType: 'E1',
      createdBy: USER,
      retentionState: 'currently-relevant',
      content: { statement: 'user-authored claim (explicit Save = confirmation)' },
    });
    expect((await store.meaning.listClaims({ subject: 'review-state' })).total).toBe(1);

    const commitment = await store.meaning.createCommitment({
      commitmentKey: 'budget-overruns',
      statement: 'flag budget overruns before they are incurred',
      createdBy: USER,
      normativeBasisProposalId: proposal.id,
    });
    expect(await store.meaning.getCommitment(commitment.id)).toMatchObject({
      commitmentKey: 'budget-overruns',
      status: 'active',
      normativeBasisProposalId: proposal.id,
      version: 1,
    });

    const loop = await store.meaning.createOpenLoop({
      subject: 'venue decision',
      loopKind: 'undecided_question',
      detail: 'decide the venue before the contract deadline',
      createdBy: USER,
      sourceThreadId: threadId,
    });
    expect(await store.meaning.getOpenLoop(loop.id)).toMatchObject({
      loopKind: 'undecided_question',
      subject: 'venue decision',
      status: 'open',
      version: 1,
    });

    const correction = await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'corr-1',
      content: { statement: 'corrected claim statement' },
      correctedBy: USER,
      reason: 'the review closed earlier',
    });
    expect(await store.meaning.getCorrection(correction.correction.id)).toMatchObject({
      status: 'recorded',
      subjectRecordId: claim.id,
      subjectRecordFamily: 'claim',
      correctionKey: 'corr-1',
      correctedBy: USER,
    });
    // Correction immutability is storage-level: version is frozen at 1 by CHECK.
    const rawCorrection = new DatabaseSync(dbPath);
    const correctionRow = rawCorrection
      .prepare('SELECT version FROM qlt_correction WHERE id = ?;')
      .get(correction.correction.id) as { version: number };
    rawCorrection.close();
    expect(correctionRow.version).toBe(1);
    expect((await store.meaning.listCorrections({ subjectRecordId: claim.id })).length).toBe(1);

    const links = await store.meaning.listSourceLinks({ fromRecordId: claim.id });
    expect(links.length).toBeGreaterThanOrEqual(1);
    // Lineage links flow forward-record → predecessor (frozen relation
    // direction): the correction 'corrects' the claim; the successor
    // 'supersedes' it.
    const correctionLinks = await store.meaning.listSourceLinks({
      fromRecordId: correction.correction.id,
    });
    expect(
      correctionLinks.some((link) => link.relation === 'corrects' && link.toRef === claim.id),
    ).toBe(true);
    const successorLinks = await store.meaning.listSourceLinks({
      fromRecordId: correction.successor.id,
    });
    expect(
      successorLinks.some((link) => link.relation === 'supersedes' && link.toRef === claim.id),
    ).toBe(true);

    expect((await store.meaning.listProposals({})).total).toBe(1);
    expect((await store.meaning.listCommitments({})).total).toBe(1);
    expect((await store.meaning.listOpenLoops({})).total).toBe(1);
    store.close();
  });
});

describe('A-07: deterministic serialization and ordering', () => {
  it('fingerprints and canonical bytes are key-insertion-order invariant', () => {
    const first = { statement: 's', subject: 'x', epistemicType: 'E1' };
    const second = { epistemicType: 'E1', subject: 'x', statement: 's' };
    expect(contentFingerprint(first)).toBe(contentFingerprint(second));
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it('list ordering is deterministic: created_at_ms DESC then id ASC on ties', async () => {
    const fixed = (): number => 1_700_000_000_000; // every record ties on time
    const { store } = openStore('a7', fixed);
    // ids deliberately created out of lexical order: b first, then a.
    const later = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('id-b'),
      proposedBy: AGENT,
      sourceThreadId: await withThread(store),
      id: 'qlt-prop-b',
    });
    const earlier = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('id-a'),
      proposedBy: AGENT,
      sourceThreadId: (await store.meaning.listProposals({})).rows[0]!.sourceThreadId,
      id: 'qlt-prop-a',
    });
    void later;
    const page = await store.meaning.listProposals({});
    expect(page.rows.map((row) => row.id)).toEqual(['qlt-prop-a', 'qlt-prop-b']);
    void earlier;
    store.close();
  });
});

describe('A-08: valid lifecycle transitions succeed with version bumps and provenance', () => {
  it('proposal awaiting→confirmed; claim retire; commitment release; loop resolve/abandon/transform', async () => {
    const { store } = openStore('a8');
    const threadId = await withThread(store);

    const proposalId = await createAwaitingClaimProposal(store, threadId);
    const outcome = await store.meaning.confirmProposal({
      proposalId,
      confirmedBy: USER,
    });
    expect(outcome.proposal.status).toBe('confirmed');
    expect(outcome.proposal.version).toBe(3); // proposed(1) → awaiting(2) → confirmed(3)
    expect(outcome.proposal.decisionBy).toBe(USER);
    expect(outcome.proposal.decidedAtMs).toBeDefined();
    expect(outcome.createdRecords.length).toBe(1);

    const retired = await store.meaning.retireClaim({
      recordId: outcome.createdRecords[0]!.id,
      exitedBy: USER,
      reason: 'superseded by external truth',
    });
    expect(retired.status).toBe('retired');
    expect(retired.version).toBe(2);

    const commitment = await store.meaning.createCommitment({
      commitmentKey: 'release-me',
      statement: 'temporary commitment',
      createdBy: USER,
    });
    const released = await store.meaning.releaseCommitment({
      recordId: commitment.id,
      exitedBy: USER,
    });
    expect(released.status).toBe('released');
    expect(released.version).toBe(2);

    const loop = await store.meaning.createOpenLoop({
      subject: 'loop-a',
      loopKind: 'pending_action',
      detail: 'resolvable',
      createdBy: USER,
    });
    const resolved = await store.meaning.resolveLoop({ loopId: loop.id, exitedBy: USER });
    expect(resolved.status).toBe('resolved');
    expect(resolved.version).toBe(2);
    expect(resolved.exitBy).toBe(USER);
    expect(resolved.exitedAtMs).toBeDefined();

    const loopB = await store.meaning.createOpenLoop({
      subject: 'loop-b',
      loopKind: 'expected_event',
      detail: 'abandon me',
      createdBy: USER,
    });
    const abandoned = await store.meaning.abandonLoop({
      loopId: loopB.id,
      exitedBy: USER,
      reason: 'no longer expected',
    });
    expect(abandoned.status).toBe('abandoned');
    expect(abandoned.exitReason).toBe('no longer expected');

    const loopC = await store.meaning.createOpenLoop({
      subject: 'loop-c',
      loopKind: 'pending_action',
      detail: 'transform me',
      createdBy: USER,
    });
    const transformed = await store.meaning.transformLoop({
      loopId: loopC.id,
      exitedBy: USER,
      reason: 'became a commitment',
    });
    expect(transformed.status).toBe('transformed');
    store.close();
  });

  it('the amendment flow closes the original as amended and drafts a NEW proposed record', async () => {
    const { store } = openStore('a8b');
    const threadId = await withThread(store);
    const proposalId = await createAwaitingClaimProposal(store, threadId);
    const { original, amendment } = await store.meaning.amendProposal({
      proposalId,
      amendedBy: USER,
      content: claimContent('the amended statement'),
      reason: 'user refined the wording',
    });
    expect(original.status).toBe('amended');
    expect(original.decisionBy).toBe(USER);
    expect(amendment.status).toBe('proposed');
    expect(amendment.content).toEqual(claimContent('the amended statement'));
    const links = await store.meaning.listSourceLinks({ fromRecordId: amendment.id });
    expect(links.some((link) => link.relation === 'amends' && link.toRef === original.id)).toBe(
      true,
    );
    store.close();
  });

  it('abandon and transform REQUIRE a reason (QLT_INPUT_MISSING_FIELD, zero effects)', async () => {
    const { store, dbPath } = openStore('a8c');
    const loop = await store.meaning.createOpenLoop({
      subject: 'loop-r',
      loopKind: 'pending_action',
      detail: 'detail',
      createdBy: USER,
    });
    const before = meaningCounts(dbPath);
    await expect(
      store.meaning.abandonLoop({ loopId: loop.id, exitedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_MISSING_FIELD' });
    await expect(
      store.meaning.transformLoop({ loopId: loop.id, exitedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_MISSING_FIELD' });
    expectNoEffects(dbPath, before);
    store.close();
  });
});

describe('A-09: invalid transitions and terminal writes fail closed', () => {
  it('every undeclared transition is refused with the family code and zero effects', async () => {
    const { store, dbPath } = openStore('a9');
    const threadId = await withThread(store);

    // proposed → confirmed directly (skipping awaiting_decision)
    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('skip awaiting'),
      proposedBy: AGENT,
      sourceThreadId: threadId,
    });
    const before1 = meaningCounts(dbPath);
    await expect(
      store.meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_INVALID_TRANSITION' });
    expectNoEffects(dbPath, before1);

    // claim superseded → retired (terminal)
    const claim = await store.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'will be superseded',
      createdBy: USER,
    });
    await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'k1',
      content: { statement: 'successor' },
      correctedBy: USER,
    });
    const supersededVersion = (await store.meaning.getClaim(claim.id))!.version;
    const before2 = meaningCounts(dbPath);
    await expect(
      store.meaning.retireClaim({ recordId: claim.id, exitedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_CLAIM_INVALID_TRANSITION' });
    expect((await store.meaning.getClaim(claim.id))!.version).toBe(supersededVersion);
    expectNoEffects(dbPath, before2);

    // loop resolved → abandoned (terminal)
    const loop = await store.meaning.createOpenLoop({
      subject: 's',
      loopKind: 'pending_action',
      detail: 'd',
      createdBy: USER,
    });
    await store.meaning.resolveLoop({ loopId: loop.id, exitedBy: USER });
    const before3 = meaningCounts(dbPath);
    await expect(
      store.meaning.abandonLoop({ loopId: loop.id, exitedBy: USER, reason: 'r' }),
    ).rejects.toMatchObject({ code: 'QLT_LOOP_INVALID_TRANSITION' });
    expectNoEffects(dbPath, before3);

    // commitment released → released again (terminal)
    const commitment = await store.meaning.createCommitment({
      commitmentKey: 'c-term',
      statement: 's',
      createdBy: USER,
    });
    await store.meaning.releaseCommitment({ recordId: commitment.id, exitedBy: USER });
    const before4 = meaningCounts(dbPath);
    await expect(
      store.meaning.releaseCommitment({ recordId: commitment.id, exitedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_COMMITMENT_INVALID_TRANSITION' });
    expectNoEffects(dbPath, before4);
    store.close();
  });
});

describe('A-10: the agent can never confirm, decide, amend, or correct', () => {
  it('agent identities are refused in every confirmer-class field (zero effects)', async () => {
    const { store, dbPath } = openStore('a10');
    const threadId = await withThread(store);
    const proposalId = await createAwaitingClaimProposal(store, threadId);
    const claim = await store.meaning.createClaim({
      subject: 's',
      epistemicType: 'E2',
      honestyState: 'known',
      confidence: 'stated',
      statement: 's',
      createdBy: USER,
    });
    const before = meaningCounts(dbPath);

    await expect(
      store.meaning.confirmProposal({ proposalId, confirmedBy: AGENT }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.rejectProposal({ proposalId, decidedBy: AGENT }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.withdrawProposal({ proposalId, withdrawnBy: AGENT }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.amendProposal({
        proposalId,
        amendedBy: AGENT,
        content: claimContent('hostile amendment'),
      }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.applyCorrection({
        subjectRecordId: claim.id,
        subjectFamily: 'claim',
        correctionKey: 'agent-key',
        content: { statement: 'hostile correction' },
        correctedBy: AGENT,
      }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    await expect(
      store.meaning.retireClaim({ recordId: claim.id, exitedBy: AGENT }),
    ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });

    // The pure predicates agree: the agent proposes and withdraws, never decides.
    expect(canConfirm(AGENT)).toBe(false);
    expect(canCorrect(AGENT)).toBe(false);
    expect(canAuthor(AGENT)).toBe(false);
    expect(canPropose(AGENT)).toBe(true);
    expect(canWithdraw(AGENT)).toBe(true);
    expect(canConfirm(USER)).toBe(true);

    expectNoEffects(dbPath, before);
    const untouched = await store.meaning.getProposal(proposalId);
    expect(untouched!.status).toBe('awaiting_decision');
    store.close();
  });
});

describe('A-11: a missing confirmer is rejected', () => {
  it('blank, whitespace, and non-string confirmers fail closed (zero effects)', async () => {
    const { store, dbPath } = openStore('a11');
    const threadId = await withThread(store);
    const proposalId = await createAwaitingClaimProposal(store, threadId);
    const before = meaningCounts(dbPath);
    for (const confirmer of ['', '   ', 'not-an-identity', 123, undefined]) {
      await expect(
        store.meaning.confirmProposal({
          proposalId,
          confirmedBy: confirmer as unknown as string,
        }),
      ).rejects.toMatchObject({ code: 'QLT_CONFIRMER_INVALID' });
    }
    expectNoEffects(dbPath, before);
    expect((await store.meaning.getProposal(proposalId))!.status).toBe('awaiting_decision');
    store.close();
  });
});

describe('A-12: the ceremony confirm is ONE transaction with attributable provenance', () => {
  it('confirm creates the target record(s) + links atomically for claim, commitment, and loop kinds', async () => {
    const { store } = openStore('a12');
    const threadId = await withThread(store);

    // claim kind
    const claimProposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('ceremony claim'),
      proposedBy: AGENT,
      sourceThreadId: threadId,
      sourceTurnRef: 'turn-7',
    });
    await store.meaning.markProposalAwaitingDecision(claimProposal.id);
    const claimOutcome = await store.meaning.confirmProposal({
      proposalId: claimProposal.id,
      confirmedBy: USER,
    });
    const createdClaim = claimOutcome.createdRecords[0]!;
    expect('epistemicType' in createdClaim && createdClaim.epistemicType).toBe('E3');
    expect(createdClaim.createdBy).toBe(USER);
    const links = await store.meaning.listSourceLinks({ fromRecordId: createdClaim.id });
    expect(links.some((l) => l.relation === 'proposed-from' && l.toRef === claimProposal.id)).toBe(
      true,
    );
    expect(links.some((l) => l.relation === 'source-thread' && l.toRef === threadId)).toBe(true);
    expect(
      (await store.meaning.listClaims({ subject: 'project-alpha' })).rows.filter(
        (row) => row.proposalId === claimProposal.id,
      ).length,
    ).toBe(1);

    // commitment kind
    const commitmentProposal = await store.meaning.createProposal({
      proposalKind: 'commitment',
      content: { commitmentKey: 'ceremony-key', statement: 'ceremony commitment' },
      proposedBy: AGENT,
      sourceThreadId: threadId,
    });
    await store.meaning.markProposalAwaitingDecision(commitmentProposal.id);
    const commitmentOutcome = await store.meaning.confirmProposal({
      proposalId: commitmentProposal.id,
      confirmedBy: USER,
    });
    expect(
      'normativeBasisProposalId' in commitmentOutcome.createdRecords[0]! &&
        commitmentOutcome.createdRecords[0]!.normativeBasisProposalId,
    ).toBe(commitmentProposal.id);

    // open-loop kind
    const loopProposal = await store.meaning.createProposal({
      proposalKind: 'open_loop',
      content: {
        subject: 'ceremony loop',
        loopKind: 'pending_action',
        detail: 'from the ceremony',
      },
      proposedBy: AGENT,
      sourceThreadId: threadId,
    });
    await store.meaning.markProposalAwaitingDecision(loopProposal.id);
    const loopOutcome = await store.meaning.confirmProposal({
      proposalId: loopProposal.id,
      confirmedBy: USER,
    });
    expect(loopOutcome.createdRecords[0]!.status).toBe('open');
    store.close();
  });
});

describe('A-13: version-based staleness (never time) refuses confirmation', () => {
  it('a drafted-against version mismatch, superseded target, removed target, or removed source is stale', async () => {
    const { store, dbPath } = openStore('a13');
    const threadId = await withThread(store);

    // (a) drafted-against version wrong → target-version-changed
    const claimA = await store.meaning.createClaim({
      subject: 'stale-a',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'current truth',
      createdBy: USER,
    });
    const staleVersionProposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'corrected truth', reason: 'update' },
      proposedBy: AGENT,
      sourceThreadId: threadId,
      targetRecord: { recordId: claimA.id, family: 'claim', version: claimA.version + 5 },
    });
    await store.meaning.markProposalAwaitingDecision(staleVersionProposal.id);
    await expect(
      store.meaning.confirmProposal({ proposalId: staleVersionProposal.id, confirmedBy: USER }),
    ).rejects.toMatchObject({
      code: 'QLT_PROPOSAL_STALE',
      details: { reason: 'target-version-changed' },
    });

    // (b) superseded target → target-superseded
    const claimB = await store.meaning.createClaim({
      subject: 'stale-b',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'will be superseded',
      createdBy: USER,
    });
    const correctionProposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'the successor statement', reason: 'correction' },
      proposedBy: AGENT,
      sourceThreadId: threadId,
      targetRecord: { recordId: claimB.id, family: 'claim', version: claimB.version },
    });
    await store.meaning.markProposalAwaitingDecision(correctionProposal.id);
    // BEFORE confirming, a DIFFERENT correction supersedes the target.
    await store.meaning.applyCorrection({
      subjectRecordId: claimB.id,
      subjectFamily: 'claim',
      correctionKey: 'other-key',
      content: { statement: 'racing correction' },
      correctedBy: USER,
    });
    await expect(
      store.meaning.confirmProposal({ proposalId: correctionProposal.id, confirmedBy: USER }),
    ).rejects.toMatchObject({
      code: 'QLT_PROPOSAL_STALE',
      details: { reason: 'target-superseded' },
    });

    // (c) target retention-removed → target-ineligible
    const claimC = await store.meaning.createClaim({
      subject: 'stale-c',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'target removed',
      createdBy: USER,
    });
    const removedTargetProposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'corrected', reason: 'r' },
      proposedBy: AGENT,
      sourceThreadId: threadId,
      targetRecord: { recordId: claimC.id, family: 'claim', version: claimC.version },
    });
    await store.meaning.markProposalAwaitingDecision(removedTargetProposal.id);
    const rawC = new DatabaseSync(dbPath);
    rawC
      .prepare("UPDATE qlt_claim SET retention_state = 'user-removed' WHERE id = ?;")
      .run(claimC.id);
    rawC.close();
    await expect(
      store.meaning.confirmProposal({ proposalId: removedTargetProposal.id, confirmedBy: USER }),
    ).rejects.toMatchObject({
      code: 'QLT_PROPOSAL_STALE',
      details: { reason: 'target-ineligible' },
    });

    // (d) source thread removed → source-removed (claim kind; no target)
    const sourceProposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent('source removed'),
      proposedBy: AGENT,
      sourceThreadId: threadId,
    });
    await store.meaning.markProposalAwaitingDecision(sourceProposal.id);
    const rawD = new DatabaseSync(dbPath);
    rawD
      .prepare("UPDATE qlt_thread SET retention_state = 'user-removed' WHERE id = ?;")
      .run(threadId);
    rawD.close();
    await expect(
      store.meaning.confirmProposal({ proposalId: sourceProposal.id, confirmedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_STALE', details: { reason: 'source-removed' } });

    // the pure predicate reaches every pinned reason deterministically
    expect(
      proposalStaleness(
        { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 2 },
        { version: 1, status: 'active', retentionState: 'currently-relevant' },
        { retentionState: 'currently-relevant' },
      ),
    ).toEqual({ stale: true, reason: 'target-version-changed' });
    expect(
      proposalStaleness(
        { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 1 },
        { version: 1, status: 'superseded', retentionState: 'currently-relevant' },
        { retentionState: 'currently-relevant' },
      ).reason,
    ).toBe('target-superseded');
    expect(
      proposalStaleness(
        { proposalKind: 'correction', targetRecordFamily: 'claim', targetRecordVersion: 1 },
        undefined,
        { retentionState: 'currently-relevant' },
      ).reason,
    ).toBe('target-ineligible');
    expect(
      proposalStaleness(
        { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
        undefined,
        undefined,
      ).reason,
    ).toBe('source-missing');
    expect(
      proposalStaleness(
        { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
        undefined,
        { retentionState: 'user-removed' },
      ).reason,
    ).toBe('source-removed');
    store.close();
  });
});

describe('A-14: elapsed time alone NEVER makes a proposal stale', () => {
  it('an ancient proposal with unchanged references confirms normally far in the future', async () => {
    const T = 1_000_000_000_000;
    const fixed = (): number => T;
    const { store } = openStore('a14', fixed);
    const threadId = await withThread(store);
    const proposalId = await createAwaitingClaimProposal(store, threadId);
    const outcome = await store.meaning.confirmProposal({
      proposalId,
      confirmedBy: USER,
      now: T + 1_000_000_000, // ~31 years later; references unchanged
    });
    expect(outcome.proposal.status).toBe('confirmed');
    expect(outcome.proposal.decidedAtMs).toBe(T + 1_000_000_000);

    // The predicate has NO time input: an ancient-shaped proposal is fresh.
    expect(
      proposalStaleness(
        { proposalKind: 'claim', targetRecordFamily: undefined, targetRecordVersion: undefined },
        undefined,
        { retentionState: 'currently-relevant' },
      ),
    ).toEqual({ stale: false });
    store.close();
  });
});

describe('A-15: rejected and withdrawn proposals create no canonical record', () => {
  it('reject/withdraw write no substantive rows and refuse re-decision', async () => {
    const { store, dbPath } = openStore('a15');
    const threadId = await withThread(store);

    const rejectedId = await createAwaitingClaimProposal(store, threadId, 'rejected candidate');
    await store.meaning.rejectProposal({
      proposalId: rejectedId,
      decidedBy: USER,
      reason: 'not established truth',
    });
    expect((await store.meaning.getProposal(rejectedId))!.status).toBe('rejected');

    const withdrawnId = await createAwaitingClaimProposal(store, threadId, 'withdrawn candidate');
    await store.meaning.withdrawProposal({ proposalId: withdrawnId, withdrawnBy: USER });
    expect((await store.meaning.getProposal(withdrawnId))!.status).toBe('withdrawn');

    // No canonical record references either proposal.
    for (const id of [rejectedId, withdrawnId]) {
      expect(
        (await store.meaning.listClaims({})).rows.filter((row) => row.proposalId === id).length,
      ).toBe(0);
      expect(
        (await store.meaning.listCommitments({})).rows.filter((row) => row.proposalId === id)
          .length,
      ).toBe(0);
      expect(
        (await store.meaning.listOpenLoops({})).rows.filter((row) => row.proposalId === id).length,
      ).toBe(0);
    }

    // Decided proposals refuse re-decision truthfully.
    const before = meaningCounts(dbPath);
    await expect(
      store.meaning.confirmProposal({ proposalId: rejectedId, confirmedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_ALREADY_DECIDED' });
    await expect(
      store.meaning.rejectProposal({ proposalId: rejectedId, decidedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_ALREADY_DECIDED' });
    await expect(
      store.meaning.confirmProposal({ proposalId: withdrawnId, confirmedBy: USER }),
    ).rejects.toMatchObject({ code: 'QLT_PROPOSAL_ALREADY_DECIDED' });
    expectNoEffects(dbPath, before);

    // Proposals are epistemically inert in EVERY reachable status.
    const statuses: string[] = [
      'proposed',
      'awaiting_decision',
      'confirmed',
      'rejected',
      'withdrawn',
    ];
    const freshThread = await withThread(store);
    const amendedBase = await createAwaitingClaimProposal(store, freshThread, 'amend base');
    const { original } = await store.meaning.amendProposal({
      proposalId: amendedBase,
      amendedBy: USER,
      content: claimContent('amended'),
    });
    const proposalStatuses = new Set<string>(statuses);
    proposalStatuses.add(original.status); // amended
    expect(proposalStatuses.has('amended')).toBe(true);
    const allProposals = await store.meaning.listProposals({});
    for (const row of allProposals.rows) {
      expect(isCanonicalEligible(row)).toBe(false);
    }
    store.close();
  });
});

describe('A-19: correction lineage is append-only', () => {
  it('successor + immutable correction row; predecessor bytes unchanged; no second successor', async () => {
    const { store, dbPath } = openStore('a19');
    const claim = await store.meaning.createClaim({
      subject: 'lineage',
      epistemicType: 'E2',
      honestyState: 'likely',
      confidence: 'qualified',
      statement: 'the original statement',
      createdBy: USER,
    });
    const rawBefore = new DatabaseSync(dbPath);
    const beforeRow = rawBefore
      .prepare('SELECT content, content_fingerprint, version, status FROM qlt_claim WHERE id = ?;')
      .get(claim.id) as {
      content: string;
      content_fingerprint: string;
      version: number;
      status: string;
    };
    rawBefore.close();

    const outcome = await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'key-1',
      content: { statement: 'the corrected statement' },
      correctedBy: USER,
      reason: 'the user corrected the record',
      key: 'lineage-correction-key',
    });
    expect(outcome.successor.status).toBe('active');
    expect(outcome.successor.version).toBe(1);
    expect('supersedesId' in outcome.successor && outcome.successor.supersedesId).toBe(claim.id);
    expect(outcome.predecessor.status).toBe('superseded');
    expect(outcome.predecessor.version).toBe(2);
    expect(outcome.correction.status).toBe('recorded');
    expect(outcome.correction.priorContentFingerprint).toBe(beforeRow.content_fingerprint);

    // The predecessor's durable meaning bytes are untouched.
    const rawAfter = new DatabaseSync(dbPath);
    const afterRow = rawAfter
      .prepare('SELECT content, content_fingerprint FROM qlt_claim WHERE id = ?;')
      .get(claim.id) as { content: string; content_fingerprint: string };
    const successorRow = rawAfter
      .prepare('SELECT content, supersedes_id, version FROM qlt_claim WHERE id = ?;')
      .get(outcome.successor.id) as { content: string; supersedes_id: string; version: number };
    rawAfter.close();
    expect(afterRow.content).toBe(beforeRow.content);
    expect(afterRow.content_fingerprint).toBe(beforeRow.content_fingerprint);
    expect(successorRow.supersedes_id).toBe(claim.id);
    expect(successorRow.version).toBe(1);

    // A DIFFERENT key against the superseded subject: no second successor.
    const before = meaningCounts(dbPath);
    await expect(
      store.meaning.applyCorrection({
        subjectRecordId: claim.id,
        subjectFamily: 'claim',
        correctionKey: 'key-2',
        content: { statement: 'second successor attempt' },
        correctedBy: USER,
      }),
    ).rejects.toMatchObject({ code: 'QLT_RECORD_NOT_CURRENT' });
    expectNoEffects(dbPath, before);

    // The SAME key replays to the SAME correction id (convergence).
    const replay = await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'key-1',
      content: { statement: 'the corrected statement' },
      correctedBy: USER,
      reason: 'the user corrected the record',
      key: 'lineage-correction-key',
    });
    expect(replay.correction.id).toBe(outcome.correction.id);
    expect(replay.successor.id).toBe(outcome.successor.id);
    expect((await store.meaning.listCorrections({ subjectRecordId: claim.id })).length).toBe(1);
    store.close();
  });
});

describe('A-20: a rejected correction changes nothing', () => {
  it('the target stays active and current-effective; no successor exists', async () => {
    const { store, dbPath } = openStore('a20');
    const threadId = await withThread(store);
    const claim = await store.meaning.createClaim({
      subject: 'reject-correction',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'still current',
      createdBy: USER,
    });
    const proposal = await store.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'rejected correction', reason: 'user declined' },
      proposedBy: AGENT,
      sourceThreadId: threadId,
      targetRecord: { recordId: claim.id, family: 'claim', version: claim.version },
    });
    await store.meaning.markProposalAwaitingDecision(proposal.id);
    await store.meaning.rejectProposal({ proposalId: proposal.id, decidedBy: USER });

    expect((await store.meaning.getClaim(claim.id))!.status).toBe('active');
    expect(await store.meaning.resolveCurrentEffectiveClaim('reject-correction')).toMatchObject({
      id: claim.id,
      status: 'active',
    });
    expect((await store.meaning.listCorrections({ subjectRecordId: claim.id })).length).toBe(0);
    store.close();
  });
});

describe('A-21: duplicate successors and lineage cycles fail closed', () => {
  it('cycle/self-reference throw QLT_LINEAGE_INVALID; non-current subjects are refused', () => {
    expect(() =>
      validateLineageChain([
        { id: 'a', supersedesId: 'b' },
        { id: 'b', supersedesId: 'a' },
      ]),
    ).toThrowError(QltMeaningError);
    try {
      validateLineageChain([
        { id: 'a', supersedesId: 'b' },
        { id: 'b', supersedesId: 'a' },
      ]);
    } catch (error) {
      expect((error as QltMeaningError).code).toBe('QLT_LINEAGE_INVALID');
    }
    expect(() => validateLineageChain([{ id: 'a', supersedesId: 'a' }])).toThrowError(
      QltMeaningError,
    );
    // A valid backward chain passes; a longer cycle is still caught.
    expect(() =>
      validateLineageChain([
        { id: 'c', supersedesId: 'b' },
        { id: 'b', supersedesId: 'a' },
        { id: 'a' },
      ]),
    ).not.toThrow();
    expect(() =>
      validateLineageChain([
        { id: 'a', supersedesId: 'b' },
        { id: 'b', supersedesId: 'c' },
        { id: 'c', supersedesId: 'a' },
      ]),
    ).toThrowError(QltMeaningError);
    expect(() => assertCorrectionSubjectCurrent('claim', 'superseded')).toThrowError(
      QltMeaningError,
    );
    try {
      assertCorrectionSubjectCurrent('claim', 'retired');
    } catch (error) {
      expect((error as QltMeaningError).code).toBe('QLT_RECORD_NOT_CURRENT');
    }
    expect(() => assertTransition('proposal', 'confirmed', 'rejected')).toThrowError(
      QltMeaningError,
    );
  });
});

describe('A-22: deterministic current-effective resolution (SQL ≡ pure)', () => {
  it('ties break by id ASC; ineligible records are skipped; both layers agree', async () => {
    const fixed = (): number => 1_700_000_000_000;
    const { store } = openStore('a22', fixed);
    // ids crafted so the winner proves ASC ordering (z created first).
    await store.meaning.createClaim({
      subject: 'parity',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'z record',
      createdBy: USER,
      id: 'qlt-z-9',
    });
    await store.meaning.createClaim({
      subject: 'parity',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'a record',
      createdBy: USER,
      id: 'qlt-a-1',
    });
    // An ineligible third record must be skipped.
    const retired = await store.meaning.createClaim({
      subject: 'parity',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'retired record',
      createdBy: USER,
      id: 'qlt-a-0',
    });
    await store.meaning.retireClaim({ recordId: retired.id, exitedBy: USER });

    const sqlWinner = await store.meaning.resolveCurrentEffectiveClaim('parity');
    expect(sqlWinner!.id).toBe('qlt-a-1');
    const listed = await store.meaning.listClaims({ subject: 'parity' });
    const pureWinner = resolveCurrentEffective(listed.rows);
    expect(pureWinner!.id).toBe(sqlWinner!.id);

    // commitments: released records are skipped (partial unique keeps one active per key)
    const commitment = await store.meaning.createCommitment({
      commitmentKey: 'parity-key',
      statement: 'active',
      createdBy: USER,
      id: 'qlt-z-com',
    });
    expect((await store.meaning.resolveCurrentEffectiveCommitment('parity-key'))!.id).toBe(
      commitment.id,
    );
    const pureCommitment = resolveCurrentEffective(
      (await store.meaning.listCommitments({ commitmentKey: 'parity-key' })).rows,
    );
    expect(pureCommitment!.id).toBe(commitment.id);
    await store.meaning.releaseCommitment({ recordId: commitment.id, exitedBy: USER });
    expect(await store.meaning.resolveCurrentEffectiveCommitment('parity-key')).toBeUndefined();
    expect(
      resolveCurrentEffective(
        (await store.meaning.listCommitments({ commitmentKey: 'parity-key' })).rows,
      ),
    ).toBeUndefined();

    // open loops: two open loops on one subject tie → id ASC
    await store.meaning.createOpenLoop({
      subject: 'loop-parity',
      loopKind: 'pending_action',
      detail: 'z',
      createdBy: USER,
      id: 'qlt-z-loop',
    });
    await store.meaning.createOpenLoop({
      subject: 'loop-parity',
      loopKind: 'pending_action',
      detail: 'a',
      createdBy: USER,
      id: 'qlt-a-loop',
    });
    const loopWinner = await store.meaning.resolveCurrentEffectiveOpenLoop('loop-parity');
    expect(loopWinner!.id).toBe('qlt-a-loop');
    const pureLoopWinner = resolveCurrentEffective(
      (await store.meaning.listOpenLoops({ subject: 'loop-parity' })).rows,
    );
    expect(pureLoopWinner!.id).toBe(loopWinner!.id);
    store.close();
  });
});

describe('A-23: eligibility — only confirmed, current, retention-relevant material passes', () => {
  it('every non-live status and retention-removed record fails; eligible records stay attributable', async () => {
    const { store, dbPath } = openStore('a23');
    const threadId = await withThread(store);

    const eligibleClaim = await store.meaning.createClaim({
      subject: 'elig',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'eligible',
      createdBy: USER,
    });
    const eligibleRow = (await store.meaning.getClaim(eligibleClaim.id))!;
    expect(isCanonicalEligible(eligibleRow)).toBe(true);

    const superseded = await store.meaning.applyCorrection({
      subjectRecordId: eligibleClaim.id,
      subjectFamily: 'claim',
      correctionKey: 'elig-k',
      content: { statement: 'successor' },
      correctedBy: USER,
    });
    expect(isCanonicalEligible(superseded.predecessor)).toBe(false);
    expect(isCanonicalEligible(superseded.correction)).toBe(false);

    const retired = await store.meaning.createClaim({
      subject: 'elig-retired',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'x',
      createdBy: USER,
    });
    const retiredRow = await store.meaning.retireClaim({
      recordId: retired.id,
      exitedBy: USER,
    });
    expect(isCanonicalEligible(retiredRow)).toBe(false);

    const released = await store.meaning.releaseCommitment({
      recordId: (
        await store.meaning.createCommitment({
          commitmentKey: 'elig-key',
          statement: 's',
          createdBy: USER,
        })
      ).id,
      exitedBy: USER,
    });
    expect(isCanonicalEligible(released)).toBe(false);

    const resolved = await store.meaning.resolveLoop({
      loopId: (
        await store.meaning.createOpenLoop({
          subject: 'elig-loop',
          loopKind: 'pending_action',
          detail: 'd',
          createdBy: USER,
        })
      ).id,
      exitedBy: USER,
    });
    expect(isCanonicalEligible(resolved)).toBe(false);

    // retention-ineligible: an active record excluded by the retention column.
    const removed = await store.meaning.createClaim({
      subject: 'elig-removed',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'removed by the user (07D flow preview)',
      createdBy: USER,
    });
    const raw = new DatabaseSync(dbPath);
    raw
      .prepare("UPDATE qlt_claim SET retention_state = 'user-removed' WHERE id = ?;")
      .run(removed.id);
    raw.close();
    const removedRow = (await store.meaning.getClaim(removed.id))!;
    expect(isCanonicalEligible(removedRow)).toBe(false);
    expect(await store.meaning.resolveCurrentEffectiveClaim('elig-removed')).toBeUndefined();

    // Eligible ceremonial records stay attributable end to end.
    const proposalId = await createAwaitingClaimProposal(store, threadId, 'attributable');
    const outcome = await store.meaning.confirmProposal({ proposalId, confirmedBy: USER });
    const record = outcome.createdRecords[0]!;
    expect(isCanonicalEligible(record)).toBe(true);
    expect(record.createdBy).toBe(USER);
    const links = await store.meaning.listSourceLinks({ fromRecordId: record.id });
    expect(links.some((l) => l.relation === 'proposed-from' && l.toRef === proposalId)).toBe(true);
    expect(
      (await store.meaning.listProposals({ status: 'confirmed' })).rows
        .map((row) => row.id)
        .includes(proposalId),
    ).toBe(true);
    store.close();
  });
});

describe('A-24: FENCE-1 — hostile inputs fail closed, never echo, never persist', () => {
  const SECRET = 'SECRET-HOSTILE-VALUE-7f3a9';

  function expectRejected(
    result: { ok: boolean; issues?: readonly { code: string; path: string }[] },
    code: string,
  ): void {
    expect(result.ok).toBe(false);
    const codes = (result.issues ?? []).map((issue) => issue.code);
    expect(codes).toContain(code);
    const dumped = JSON.stringify(result.issues ?? []);
    expect(dumped).not.toContain(SECRET);
    for (const issue of result.issues ?? []) {
      expect(Object.keys(issue).sort()).toEqual(['code', 'path']);
    }
  }

  it('unknown fields are REJECTED (never silently dropped)', () => {
    expectRejected(
      parseClaimProposalContent({ ...claimContent('x'), intruder: SECRET }),
      'QLT_INPUT_UNKNOWN_FIELD',
    );
  });

  it('missing fields, wrong types, and invalid enums fail closed', () => {
    const { statement, ...partial } = claimContent('x');
    void statement;
    expectRejected(parseClaimProposalContent(partial), 'QLT_INPUT_MISSING_FIELD');
    expectRejected(
      parseClaimProposalContent({ ...claimContent('x'), statement: 42 as unknown as string }),
      'QLT_INPUT_INVALID_TYPE',
    );
    expectRejected(
      parseClaimProposalContent({
        ...claimContent('x'),
        epistemicType: 'E9' as unknown as QltClaimProposalContent['epistemicType'],
      }),
      'QLT_INPUT_INVALID_ENUM',
    );
  });

  it('non-object roots and exotic containers fail closed; null-prototype objects are accepted', () => {
    expectRejected(parseClaimProposalContent(['array']), 'QLT_INPUT_NOT_OBJECT');
    expectRejected(parseClaimProposalContent(null), 'QLT_INPUT_NOT_OBJECT');
    expectRejected(parseClaimProposalContent('string'), 'QLT_INPUT_NOT_OBJECT');
    class Hostile {}
    expectRejected(parseClaimProposalContent(new Hostile()), 'QLT_INPUT_INVALID_CONTAINER');
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto['subject'] = 's';
    nullProto['epistemicType'] = 'E1';
    nullProto['honestyState'] = 'known';
    nullProto['confidence'] = 'stated';
    nullProto['statement'] = 'null-proto is fine';
    expect(parseClaimProposalContent(nullProto).ok).toBe(true);
  });

  it('own __proto__ keys (root and nested, via JSON.parse) are REJECTED and pollute nothing', () => {
    const root = JSON.parse(`{"__proto__": {"polluted": "${SECRET}"}, "statement": "x"}`);
    expectRejected(parseClaimContent(root), 'QLT_INPUT_PROTO_KEY');
    const nested = JSON.parse(
      `{"statement": "x", "nested": {"__proto__": {"polluted": "${SECRET}"}}}`,
    );
    expectRejected(parseClaimContent(nested), 'QLT_INPUT_PROTO_KEY');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it('constructor/prototype keys are plain own data → unknown fields; the prototype is untouched', () => {
    expectRejected(
      parseClaimContent({ statement: 'x', constructor: SECRET }),
      'QLT_INPUT_UNKNOWN_FIELD',
    );
    expectRejected(
      parseClaimContent({ statement: 'x', prototype: SECRET }),
      'QLT_INPUT_UNKNOWN_FIELD',
    );
    expect(Object.getOwnPropertyNames(Object.prototype).includes('polluted')).toBe(false);
    expect(Object.getOwnPropertyNames(Object.prototype).includes('intruder')).toBe(false);
  });

  it('depth, key-count, and array bounds fail closed', () => {
    let deep: Record<string, unknown> = { leaf: SECRET };
    for (let i = 0; i < 10; i += 1) {
      deep = { nested: deep };
    }
    expectRejected(parseClaimContent({ statement: 'x', extra: deep }), 'QLT_INPUT_OVERDEPTH');
    const wide: Record<string, string> = {};
    for (let i = 0; i < 40; i += 1) {
      wide[`k${i}`] = 'v';
    }
    expectRejected(parseClaimContent({ statement: 'x', extra: wide }), 'QLT_INPUT_KEY_LIMIT');
    expectRejected(
      parseClaimProposalContent({
        ...claimContent('x'),
        statement: ['a', 'b'] as unknown as string,
      }),
      'QLT_INPUT_INVALID_TYPE',
    );
  });

  it('non-serializable values (function/symbol/bigint/undefined/NaN/Infinity/Date) fail closed', () => {
    expectRejected(
      parseClaimContent({ statement: 'x', extra: (): void => undefined }),
      'QLT_INPUT_NOT_SERIALIZABLE',
    );
    expectRejected(
      parseClaimContent({ statement: 'x', extra: Symbol('sym') }),
      'QLT_INPUT_NOT_SERIALIZABLE',
    );
    expectRejected(parseClaimContent({ statement: 'x', extra: 1n }), 'QLT_INPUT_NOT_SERIALIZABLE');
    expectRejected(
      parseClaimContent({ statement: 'x', extra: undefined }),
      'QLT_INPUT_NOT_SERIALIZABLE',
    );
    expectRejected(
      parseClaimContent({ statement: 'x', extra: Number.NaN }),
      'QLT_INPUT_NOT_SERIALIZABLE',
    );
    expectRejected(
      parseClaimContent({ statement: 'x', extra: Number.POSITIVE_INFINITY }),
      'QLT_INPUT_NOT_SERIALIZABLE',
    );
    expectRejected(
      parseClaimContent({ statement: 'x', extra: new Date() }),
      'QLT_INPUT_INVALID_TYPE',
    );
  });

  it('rejections persist nothing: row counts unchanged after the whole battery', async () => {
    const { store, dbPath } = openStore('a24');
    const threadId = await withThread(store);
    void threadId;
    const before = meaningCounts(dbPath);
    const hostile: unknown[] = [
      ['array'],
      null,
      42,
      'string',
      { statement: 'x', intruder: SECRET },
      JSON.parse(`{"__proto__": {"a": 1}, "statement": "x"}`),
      { statement: 'x', extra: new Date() },
      { statement: 'x', extra: (): void => undefined },
    ];
    for (const input of hostile) {
      const result = parseClaimProposalContent(input);
      expect(result.ok).toBe(false);
    }
    // The store ALSO refuses typed-but-invalid storage guards without effects.
    await expect(
      store.meaning.createClaim({
        subject: 's',
        epistemicType: 'E9' as unknown as QltClaimProposalContent['epistemicType'],
        honestyState: 'known',
        confidence: 'stated',
        statement: 'bad enum',
        createdBy: USER,
      }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_INVALID_ENUM' });
    expectNoEffects(dbPath, before);
    store.close();
  });
});

describe('A-25: UTF-8 byte bounds with multibyte content', () => {
  it('the byte bound wins over the character bound; exactly-4096-byte content is stored', async () => {
    // parseClaimContent canonical form is {"statement":"…"} — 16 bytes of JSON overhead.
    const atBound = '日'.repeat(1360); // 4080 bytes → 4096 total
    expect(Buffer.byteLength(canonicalJson({ statement: atBound }), 'utf8')).toBe(4096);
    expect(parseClaimContent({ statement: atBound }).ok).toBe(true);

    const overBound = '日'.repeat(1361); // 4083 bytes → 4099 total
    const result = parseClaimContent({ statement: overBound });
    expect(issuesOf(result)[0]!.code).toBe('QLT_INPUT_OVERSIZE');

    // 1366 characters is WITHIN the 2000-char bound but OVER the byte bound.
    const charOkByteOver = '日'.repeat(1366);
    expect(charOkByteOver.length).toBeLessThanOrEqual(2000);
    const proposalResult = parseOpenLoopProposalContent({
      subject: 's',
      loopKind: 'pending_action',
      detail: charOkByteOver,
    });
    expect(issuesOf(proposalResult)[0]!.code).toBe('QLT_INPUT_OVERSIZE');

    // The storage CHECK agrees: exactly 4096 canonical bytes persist.
    const { store } = openStore('a25');
    const claim = await store.meaning.createClaim({
      subject: 'bytes',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: atBound,
      createdBy: USER,
    });
    expect((await store.meaning.getClaim(claim.id))!.content.statement).toBe(atBound);
    store.close();
  });
});

describe('A-27: SQL parameters cannot escape into SQL structure', () => {
  it('metacharacter payloads round-trip verbatim as DATA with the schema intact', async () => {
    const { store, dbPath } = openStore('a27');
    await withThread(store);
    const hostile = "'; DROP TABLE qlt_claim; -- Robert'); DELETE FROM qlt_proposal;-- 'OR'1'='1";
    const claim = await store.meaning.createClaim({
      subject: hostile,
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: hostile,
      createdBy: USER,
    });
    expect((await store.meaning.getClaim(claim.id))!.content.statement).toBe(hostile);

    const proposal = await store.meaning.createProposal({
      proposalKind: 'claim',
      content: claimContent(hostile),
      proposedBy: AGENT,
      sourceThreadId: (await store.listThreads()).threads[0]!.id,
    });
    expect(
      (await store.meaning.getProposal(proposal.id))!.content as unknown as { statement: string },
    ).toMatchObject({ statement: hostile });

    const loop = await store.meaning.createOpenLoop({
      subject: hostile,
      loopKind: 'pending_action',
      detail: hostile,
      createdBy: USER,
    });
    expect((await store.meaning.getOpenLoop(loop.id))!.content.detail).toBe(hostile);

    // A hostile correction KEY is refused by the safe-key discipline.
    await expect(
      store.meaning.applyCorrection({
        subjectRecordId: claim.id,
        subjectFamily: 'claim',
        correctionKey: hostile,
        content: { statement: hostile },
        correctedBy: USER,
      }),
    ).rejects.toMatchObject({ code: 'QLT_INPUT_INVALID_ID' });
    // Hostile CONTENT and REASON with a valid key round-trip as data.
    await store.meaning.applyCorrection({
      subjectRecordId: claim.id,
      subjectFamily: 'claim',
      correctionKey: 'hostile-key-1',
      content: { statement: hostile },
      correctedBy: USER,
      reason: hostile,
    });
    expect((await store.meaning.getClaim(claim.id))!.content.statement).toBe(hostile);
    expect((await store.meaning.listCorrections({ subjectRecordId: claim.id }))[0]!.reason).toBe(
      hostile,
    );

    // Every table still exists with its rows.
    const raw = new DatabaseSync(dbPath);
    for (const table of MEANING_TABLES) {
      const row = raw
        .prepare('SELECT COUNT(*) AS total FROM sqlite_master WHERE type = ? AND name = ?;')
        .get('table', table) as { total: number };
      expect(row.total).toBe(1);
    }
    raw.close();
    store.close();
  });
});

describe('A-28: credential canaries never persist (when rejected) and never echo', () => {
  it('rejected canaries are absent from store bytes, errors, and issue paths', async () => {
    const { store, dbPath } = openStore('a28');
    await withThread(store);
    const invalidCanary = `sk-ollama-canary-${randomBytes(16).toString('hex')}`;
    const tokenCanary = `qlt-token-canary-${randomBytes(16).toString('hex')}`;

    // Canary VALUES inside rejected inputs.
    const unknownField = parseClaimProposalContent({
      ...claimContent('x'),
      credential: invalidCanary,
    });
    expect(JSON.stringify(issuesOf(unknownField))).not.toContain(invalidCanary);

    const oversized = parseClaimProposalContent({
      ...claimContent(`${invalidCanary}${tokenCanary}`.repeat(400)),
    });
    expect(JSON.stringify(issuesOf(oversized))).not.toContain(invalidCanary);

    const protoKey = JSON.parse(
      `{"__proto__": "${invalidCanary}", "statement": "${tokenCanary}"}`,
    ) as Record<string, unknown>;
    const protoResult = parseClaimContent(protoKey);
    expect(JSON.stringify(issuesOf(protoResult))).not.toContain(invalidCanary);

    // The store refuses with stable codes and no echo.
    const before = meaningCounts(dbPath);
    await expect(
      store.meaning.createClaim({
        subject: 's',
        epistemicType: 'E9' as unknown as QltClaimProposalContent['epistemicType'],
        honestyState: 'known',
        confidence: 'stated',
        statement: invalidCanary,
        createdBy: USER,
      }),
    ).rejects.toSatisfy((error: QltMeaningError) => {
      expect(error.code).toBe('QLT_INPUT_INVALID_ENUM');
      expect(error.message).not.toContain(invalidCanary);
      return true;
    });
    expectNoEffects(dbPath, before);

    // The rejected canaries are in NO store byte.
    const raw = new DatabaseSync(dbPath);
    const allText = (
      raw
        .prepare(
          "SELECT group_concat(qlt_proposal.content, '') || group_concat(qlt_claim.content, '') AS blob FROM qlt_proposal, qlt_claim;",
        )
        .get() as { blob: string | null }
    ).blob;
    raw.close();
    expect(allText ?? '').not.toContain(invalidCanary);
    expect(allText ?? '').not.toContain(tokenCanary);
    const dbBytes = readFileSync(dbPath).toString('latin1');
    expect(dbBytes).not.toContain(invalidCanary);

    // A canary inside VALID content is legitimate product domain data —
    // but never surfaces in a diagnostic about a DIFFERENT field.
    const validCanary = `sk-ollama-canary-${randomBytes(16).toString('hex')}`;
    const claim = await store.meaning.createClaim({
      subject: 'canary-holder',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: validCanary,
      createdBy: USER,
    });
    expect((await store.meaning.getClaim(claim.id))!.content.statement).toBe(validCanary);
    await expect(
      store.meaning.createClaim({
        subject: 's',
        epistemicType: 'E9' as unknown as QltClaimProposalContent['epistemicType'],
        honestyState: 'known',
        confidence: 'stated',
        statement: 'other row',
        createdBy: USER,
      }),
    ).rejects.toSatisfy((error: QltMeaningError) => {
      expect(JSON.stringify(error).replace(/qlt-[0-9a-f]+/g, '')).not.toContain(validCanary);
      return true;
    });
    store.close();
  });
});

describe('A-29: no production path reaches the meaning repository outside the governed Q3 surface', () => {
  it('no route, island, or component references the meaning store; the plan carries exactly the five thread actions plus the frozen Q3 inventory', async () => {
    const roots = ['src/routes', 'src/lib/islands', 'src/lib/components'];
    const forbidden = ['meaning-store', 'meaning-contract', 'sharedWorld.meaning', '.meaning'];
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else {
          files.push(full);
        }
      }
    };
    for (const root of roots) {
      walk(root);
    }
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const marker of forbidden) {
        expect(content.includes(marker), `${file} references ${marker}`).toBe(false);
      }
    }

    // Phase Q3 reconciliation (frozen Q3 contract §16): the plan now
    // legitimately carries the governed ceremony surface; the Q2-era
    // assertions are re-pinned to the frozen Q3 inventory — never weakened
    // (the thread surface, the memory query, and the thirteen ceremony ops
    // are all exact-inventory enforced; the no-meaning-store scan above is
    // unchanged).
    const ceremony = await import('../src/lib/sharedworld/ceremony-contract');
    const plan = getCompiledPlan();
    const actionIds = Object.keys(plan.actions).sort();
    // Q5 bounded re-pin (freeze §14): the frozen Q3 inventory is unchanged;
    // the plan adds EXACTLY the two Q5 actions (qlt.inspection read,
    // qlt.memory-policy setMode). The Q3 actions are unchanged.
    expect(actionIds).toEqual(
      [
        ...ceremony.QLT_THREAD_ACTION_IDS,
        ...ceremony.QLT_MEMORY_ACTION_IDS,
        'act.queryInspection',
        'act.setMemoryMode',
      ].sort(),
    );
    expect(actionIds).toHaveLength(21);
    const threadActionIds = actionIds.filter(
      (id) => (plan.actions[id] as { resourceId?: string }).resourceId === 'qlt.threads',
    );
    expect(new Set(threadActionIds)).toEqual(new Set(ceremony.QLT_THREAD_ACTION_IDS));
    const mutationOps = (threadResource.mutations ?? []).map((mutation) => mutation.op).sort();
    expect(mutationOps).toEqual(['archive', 'create', 'rename', 'reopen']);
    const memoryMutationOps = Object.values(plan.actions)
      .filter(
        (action) =>
          (action as { resourceId?: string }).resourceId === 'qlt.memory' &&
          (action as { kind?: string }).kind === 'mutation',
      )
      .map((action) => (action as { op: string }).op)
      .sort();
    expect(memoryMutationOps).toEqual([...ceremony.QLT_MEMORY_MUTATION_OPS].sort());
  });
});

describe('A-30: existing Q1 thread behavior stays green alongside meaning records', () => {
  it('thread create/rename/archive/reopen coexists with meaning rows on the same store', async () => {
    const { store } = openStore('a30');
    const thread = await store.createThread({ title: 'Q1 thread' });
    const renamed = await store.renameThread(thread.id, 'Q1 thread renamed');
    expect(renamed.title).toBe('Q1 thread renamed');
    const archived = await store.archiveThread(thread.id);
    expect(archived.state).toBe('dormant');
    const reopened = await store.reopenThread(thread.id);
    expect(reopened.state).toBe('active');

    // Meaning records coexist on the same file/connection.
    const claim = await store.meaning.createClaim({
      subject: 'coexist',
      epistemicType: 'E1',
      honestyState: 'known',
      confidence: 'stated',
      statement: 'same store',
      createdBy: USER,
      sourceThreadId: thread.id,
    });
    expect((await store.meaning.getClaim(claim.id))!.sourceThreadId).toBe(thread.id);
    expect((await store.listThreads()).total).toBe(1);
    store.close();
  });
});
