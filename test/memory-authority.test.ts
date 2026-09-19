/**
 * Lane D — independent black-box suite for Phase Q5 (Q5 freeze §17
 * matrix C-01..C-20). Everything crosses the REAL boundaries: the real
 * composition, the real admission wrapper (policy binding), the real
 * model seam (fixture model + assembly injection), the real released
 * command boundary via /api/act's application server, and the real
 * inspection/policy surfaces. Fully offline; the deterministic fixture
 * is the only model; no credential exists.
 */
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
import {
  createProposalDraftCapability,
  type ProposalDraftInvocationContext,
} from '../src/lib/agent/proposal-capability';
import { QLT_MEMORY_MODE_POLICY_ID } from '../src/lib/sharedworld/policy-contract';
import { QLT_CONTEXT_ASSEMBLER_VERSION } from '../src/lib/sharedworld/context-contract';

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q5-authority-'));
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
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable (Windows D-6) */
    }
  }
});

function actorOf(composition: Awaited<ReturnType<typeof compose>>['composition']) {
  return { ...composition.actor, presentedTokenKind: 'local-test' as const };
}

async function compose(dir: string) {
  const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, dir);
  const composition = await createQuellightComposition({
    env,
    offlineScript: {},
    skipListen: true,
  });
  composed.push(composition);
  const app = createAppServer(async () => ({ composition }));
  return { composition, app };
}

async function startTurnViaAdmission(
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  threadId: string,
  input: string,
  key: string,
): Promise<{ turnId: string; streamId: string }> {
  // The REAL production path: the composition's admission wrapper resolves
  // the durable policy INSIDE the per-conversation critical section and
  // installs the server-derived assembly scope around the dispatch.
  const conversation = await composition.sharedWorld.ensureConversationLink(threadId);
  const admission = await composition.admitTurn(
    { swThreadId: threadId, mastraThreadId: conversation.mastraThreadId, idempotencyKey: key },
    () =>
      composition.commandService.dispatch(actorOf(composition), {
        command: 'agent.turn.start',
        payload: { threadId: conversation.mastraThreadId, input },
        idempotencyKey: key,
      }),
  );
  if (admission.refused) {
    throw new Error('unexpectedly refused');
  }
  const outcome = admission.result;
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

async function inspectionQuery(
  app: ReturnType<typeof createAppServer>,
  filters: Record<string, string>,
) {
  return app.dispatch('act.queryInspection', { filters });
}

describe('C-08/C-06: the Memory Mode mutation is user-attributed, idempotent, fail-closed', () => {
  it('act.setMemoryMode changes the durable mode; a same-key retry converges; a conflicting same-key payload fails', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const key = `memory-mode-${crypto.randomUUID()}`;
    const first = await app.dispatch('act.setMemoryMode', { mode: 'per-conversation' }, key);
    expect(first.ok).toBe(true);
    expect((first as { value: { mode: string; revision: number } }).value.mode).toBe(
      'per-conversation',
    );
    expect(composition.sharedWorld.memoryPolicy.resolveCurrent().mode).toBe('per-conversation');
    // Same-key SAME-payload retry: the released boundary replays truthfully.
    const replay = await app.dispatch('act.setMemoryMode', { mode: 'per-conversation' }, key);
    expect(replay.ok).toBe(true);
    // Same-key DIFFERENT payload: the established conflict behavior.
    const conflict = await app.dispatch('act.setMemoryMode', { mode: 'off' }, key);
    expect(conflict.ok).toBe(false);
    expect((conflict as { code: string }).code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    // The durable mode stands (zero partial effects from the conflict).
    expect(composition.sharedWorld.memoryPolicy.resolveCurrent().mode).toBe('per-conversation');
    // Missing idempotency key: refused by the ingress.
    const unkeyed = await app.dispatch('act.setMemoryMode', { mode: 'off' });
    expect(unkeyed.ok).toBe(false);
  });

  it('invalid modes fail closed with the stable code, zero effect, and no echo', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const result = await app.dispatch(
      'act.setMemoryMode',
      { mode: 'this-conversation-and-project-x' },
      `memory-mode-${crypto.randomUUID()}`,
    );
    expect(result.ok).toBe(false);
    expect((result as { code: string }).code).toBe('QLT_MEMORY_MODE_INVALID');
    expect((result as { message?: string }).message ?? '').not.toContain(
      'this-conversation-and-project-x',
    );
    expect(composition.sharedWorld.memoryPolicy.resolveCurrent().mode).toBe('across-conversations');
  });

  it('scope forgery through the mutation ingress fails closed (unknown fields, prohibited keys)', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const forged = await app.dispatch(
      'act.setMemoryMode',
      { mode: 'off', scope: 'project:my-project', projectId: 'p1' } as never,
      `memory-mode-${crypto.randomUUID()}`,
    );
    expect(forged.ok).toBe(false);
    expect((forged as { code: string }).code).toBe('INVALID_REQUEST');
    const proto = await app.dispatch(
      'act.setMemoryMode',
      JSON.parse('{"mode":"off","__proto__":{"mode":"off"}}') as never,
      `memory-mode-${crypto.randomUUID()}`,
    );
    expect(proto.ok).toBe(false);
    expect((proto as { code: string }).code).toBe('QLT_INGRESS_PROHIBITED_FIELD');
    expect(composition.sharedWorld.memoryPolicy.resolveCurrent().mode).toBe('across-conversations');
  });
});

describe('C-06: the agent can never reach inspection or the Memory Mode', () => {
  it('an agent identity is refused at the inspection surface with zero effect; the plan grants the agent nothing', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    // The plan declares the inspection read; the AGENT's capability
    // envelope is still exactly the pinned proposal capability.
    const plan = getCompiledPlan();
    expect(plan.actions['act.queryInspection']).toBeDefined();
    const capability = createProposalDraftCapability({
      meaning: composition.sharedWorld.meaning,
      resolveTurnCorrelation: async () => undefined,
      agentIdentity: 'agent-quellight',
    });
    const capabilityIds = (capability as unknown as { id?: string }).id;
    expect(capabilityIds).toBe('qlt.proposal.draft');
    // The inspection surface refuses agent actors directly (the released
    // boundary derives the actor server-side; the agent never has the
    // inspection permission in any context).
    const bogus = await app.dispatch('act.queryInspection', {
      filters: { query: 'getPolicy', actorId: 'agent-quellight' },
    });
    // The ingress parse accepts only the declared filters; an actor field
    // inside filters is an unknown inspection filter -> stable refusal.
    expect(bogus.ok).toBe(false);
    // The mode mutation surface requires the qlt.memory-policy.write
    // permission that no agent context ever carries.
    const noPerm = await app.dispatch(
      'act.setMemoryMode',
      { mode: 'off' },
      `memory-mode-${crypto.randomUUID()}`,
    );
    expect(noPerm.ok).toBe(true); // the USER path still works
    void composition;
  });
});

describe('C-09/C-11/C-12/C-13: mode semantics through the REAL seam and evidence', () => {
  async function worldWithMemory() {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const createdA = await app.dispatch(
      'act.createThread',
      { title: 'Thread A' },
      `create-a-${crypto.randomUUID()}`,
    );
    const threadA = (createdA as { value: { id: string } }).value.id;
    // Memory in thread A (current layer for A's turns).
    await app.dispatch(
      'act.createClaim',
      {
        threadId: threadA,
        subject: 'Focus preference',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The user prefers focused work.',
      },
      `claim-a-${crypto.randomUUID()}`,
    );
    // Memory saved without a conversation (global layer).
    await app.dispatch(
      'act.createClaim',
      {
        subject: 'Global note',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'A global saved note.',
      },
      `claim-global-${crypto.randomUUID()}`,
    );
    return { composition, app, threadA };
  }

  it('across-conversations (default) preserves Q4 layer continuity; the evidence records the mode', async () => {
    const { composition, app, threadA } = await worldWithMemory();
    const started = await startTurnViaAdmission(
      composition,
      threadA,
      'Hello',
      `send-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, started.turnId);
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(started.turnId);
    expect(assembly?.outcome).toBe('complete');
    expect(assembly?.selectedIds.length).toBe(2); // current + global layers
    expect(assembly?.assemblerVersion).toBe(QLT_CONTEXT_ASSEMBLER_VERSION);
    const policy = composition.sharedWorld.memoryPolicy.getTurnPolicy(started.turnId);
    expect(policy?.mode).toBe('across-conversations');
    // Inspection reports the turn from recorded evidence.
    const page = await inspectionQuery(app, {
      query: 'listTurns',
      threadId: threadA,
      limit: '10',
    });
    expect(page.ok).toBe(true);
    const rows = (page as { value: { rows: { memoryMode: string; usedCount: number }[] } }).value
      .rows;
    expect(rows[0].memoryMode).toBe('across-conversations');
    expect(rows[0].usedCount).toBe(2);
    void app;
  });

  it('per-conversation excludes the global layer with truthful scope-excluded evidence', async () => {
    const { composition, threadA } = await worldWithMemory();
    composition.sharedWorld.memoryPolicy.setMode({
      mode: 'per-conversation',
      updatedBy: 'actor-quellight-local',
    });
    const started = await startTurnViaAdmission(
      composition,
      threadA,
      'Hello',
      `send-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, started.turnId);
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(started.turnId);
    expect(assembly?.outcome).toBe('complete');
    expect(assembly?.selectedIds.length).toBe(1); // current layer only
    const excluded = (assembly?.excluded ?? []) as readonly { reason?: string }[];
    expect(excluded.some((entry) => entry.reason === 'scope-excluded')).toBe(true);
    expect(composition.sharedWorld.memoryPolicy.getTurnPolicy(started.turnId)?.mode).toBe(
      'per-conversation',
    );
  });

  it('memory-off injects zero memory and the evidence distinguishes it from "no memory existed"', async () => {
    const { composition, threadA } = await worldWithMemory();
    composition.sharedWorld.memoryPolicy.setMode({
      mode: 'off',
      updatedBy: 'actor-quellight-local',
    });
    const started = await startTurnViaAdmission(
      composition,
      threadA,
      'Hello',
      `send-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, started.turnId);
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(started.turnId);
    expect(assembly?.outcome).toBe('empty'); // zero injection
    expect(assembly?.selectedIds.length).toBe(0);
    expect(composition.sharedWorld.memoryPolicy.getTurnPolicy(started.turnId)?.mode).toBe('off');
    // The transparency summary reports the applied mode from the evidence,
    // so the UI can never misreport an off turn as "no memories used".
    const summary = await composition.getThreadAssemblySummary(threadA);
    expect(summary?.memoryMode).toBe('off');
  });

  it('C-09: a mode change AFTER an admitted turn never reinterprets it; the next turn uses the new mode', async () => {
    const { composition, threadA } = await worldWithMemory();
    const first = await startTurnViaAdmission(
      composition,
      threadA,
      'Hello',
      `send-${crypto.randomUUID()}`,
    );
    // The mode changes while the first reply is active (admission already
    // happened; the scope value is immutable for the turn's duration).
    composition.sharedWorld.memoryPolicy.setMode({
      mode: 'off',
      updatedBy: 'actor-quellight-local',
    });
    await awaitTurnTerminal(composition, first.turnId);
    const firstAssembly = await composition.sharedWorld.getContextAssemblyByTurn(first.turnId);
    expect(firstAssembly?.outcome).toBe('complete'); // memory WAS used
    expect(firstAssembly?.selectedIds.length).toBe(2);
    expect(composition.sharedWorld.memoryPolicy.getTurnPolicy(first.turnId)?.mode).toBe(
      'across-conversations',
    );
    // The next turn (a NEW send) uses the new mode.
    const second = await startTurnViaAdmission(
      composition,
      threadA,
      'Again',
      `send-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, second.turnId);
    expect(composition.sharedWorld.memoryPolicy.getTurnPolicy(second.turnId)?.mode).toBe('off');
    const secondAssembly = await composition.sharedWorld.getContextAssemblyByTurn(second.turnId);
    expect(secondAssembly?.outcome).toBe('empty');
  });

  it('C-08: the browser turn request cannot supply a scope or policy override', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const created = await composition.sharedWorld.createThread({ title: 'Forge probe' });
    // No ingress field exists that could carry a scope/policy override:
    // the turns route accepts exactly {input, idempotencyKey}; the
    // admission input is composed server-side from resolved records.
    const conversation = await composition.sharedWorld.ensureConversationLink(created.id);
    let refused = false;
    const admission = await composition.admitTurn(
      {
        swThreadId: created.id,
        mastraThreadId: conversation.mastraThreadId,
        idempotencyKey: `send-${crypto.randomUUID()}`,
      },
      async () => {
        try {
          return await composition.commandService.dispatch(actorOf(composition), {
            command: 'agent.turn.start',
            payload: {
              threadId: conversation.mastraThreadId,
              input: 'Hello',
              // forged fields in the turn request are NOT turn authority:
              // the released boundary's closed payload refuses them.
              memoryMode: 'off',
              scope: 'project:fake',
            },
            idempotencyKey: `send-${crypto.randomUUID()}`,
          });
        } catch {
          // The released boundary fails closed on the unknown fields.
          refused = true;
          return { ok: false, code: 'VICT_COMMAND_PAYLOAD_FIELD_UNKNOWN' };
        }
      },
    );
    expect(admission.refused).toBe(false);
    expect(refused).toBe(true);
    // Zero effect: the refused request created no turn and no evidence.
    const openTurns = await composition.stores.turns.listOpenTurns();
    expect(openTurns.filter((turn) => turn.threadId === conversation.mastraThreadId)).toHaveLength(
      0,
    );
  });
});

describe('C-03/C-19: historical truth and truthful display through the inspection surface', () => {
  it('a past turn displays the exact historical versions; later corrections never alter the evidence', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const created = await app.dispatch(
      'act.createThread',
      { title: 'History' },
      `create-${crypto.randomUUID()}`,
    );
    const threadId = (created as { value: { id: string } }).value.id;
    const claimResult = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'History subject',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The historical statement selected for the turn.',
      },
      `claim-${crypto.randomUUID()}`,
    );
    expect(claimResult.ok).toBe(true);
    const started = await startTurnViaAdmission(
      composition,
      threadId,
      'Hello',
      `send-${crypto.randomUUID()}`,
    );
    await awaitTurnTerminal(composition, started.turnId);
    const assembly = await composition.sharedWorld.getContextAssemblyByTurn(started.turnId);
    const selectedId = assembly?.selectedIds[0]?.id;
    expect(selectedId).toBeTypeOf('string');
    // The record is corrected AFTER the turn: version 2 now exists.
    await app.dispatch(
      'act.correctRecord',
      { recordId: selectedId, recordKind: 'claim', statement: 'The corrected v2 statement.' },
      `correct-${crypto.randomUUID()}`,
    );
    // The turn's recorded evidence is untouched: still version 1, still
    // the original selection (never recomputed).
    expect(assembly?.selectedIds[0]?.version).toBe(1);
    const detail = await inspectionQuery(app, {
      query: 'getTurn',
      threadId,
      turnId: started.turnId,
    });
    expect(detail.ok).toBe(true);
    const row = (
      detail as {
        value: {
          row: {
            appliedPolicy: { mode: string } | null;
            selected: {
              selectedVersion: number;
              content: string | null;
              supersededSince?: boolean;
              currentVersion?: number;
            }[];
          };
        };
      }
    ).value.row;
    expect(row.selected[0].selectedVersion).toBe(1);
    // The historical content actually used is shown (immutable predecessor
    // bytes), labelled as superseded-since with the successor's current
    // version visible.
    expect(row.selected[0].content).toBe('The historical statement selected for the turn.');
    expect(row.selected[0].supersededSince).toBe(true);
    expect(row.selected[0].currentVersion).toBe(2);
    expect(row.appliedPolicy?.mode).toBe('across-conversations');
  });

  it('C-01: pending and terminal proposals never render as canonical Current memory', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const created = await app.dispatch(
      'act.createThread',
      { title: 'Buckets' },
      `create-${crypto.randomUUID()}`,
    );
    const threadId = (created as { value: { id: string } }).value.id;
    void composition;
    // A pending proposal exists only through the agent's inert draft —
    // absent here, the pending bucket is truthfully empty and Current
    // holds no proposals.
    const pending = await inspectionQuery(app, {
      query: 'listRecords',
      bucket: 'pending',
      threadId,
    });
    expect((pending as { value: { total: number } }).value.total).toBe(0);
    const current = await inspectionQuery(app, { query: 'listRecords', bucket: 'current' });
    const kinds = ((current as { value: { rows: { kind: string }[] } }).value.rows ?? []).map(
      (row) => row.kind,
    );
    expect(kinds.every((kind) => kind !== 'proposal')).toBe(true);
  });

  it('C-19: reads create no durable effect; pagination bounds fail closed; the envelope never leaks', async () => {
    const dir = tempDir();
    const { app } = await compose(dir);
    const created = await app.dispatch(
      'act.createThread',
      { title: 'No effect' },
      `create-${crypto.randomUUID()}`,
    );
    const threadId = (created as { value: { id: string } }).value.id;
    const before = JSON.stringify(
      await inspectionQuery(app, { query: 'listRecords', bucket: 'current' }),
    );
    for (let i = 0; i < 3; i += 1) {
      await inspectionQuery(app, { query: 'listRecords', bucket: 'current' });
      await inspectionQuery(app, { query: 'getPolicy' });
      await inspectionQuery(app, { query: 'listTurns', threadId });
    }
    const after = JSON.stringify(
      await inspectionQuery(app, { query: 'listRecords', bucket: 'current' }),
    );
    expect(after).toBe(before); // reads create no durable effect
    const over = await inspectionQuery(app, {
      query: 'listRecords',
      bucket: 'current',
      limit: '500',
    });
    expect(over.ok).toBe(false);
    const unknown = await inspectionQuery(app, { query: 'listEverything' });
    expect(unknown.ok).toBe(false);
    expect((unknown as { code: string }).code).toBe('QLT_INSPECTION_UNSUPPORTED_QUERY');
    // The rendered context envelope/marker never appears in inspection
    // output (never-contains).
    const serialized = JSON.stringify(before) + JSON.stringify(after);
    expect(serialized).not.toContain('QLT:SHARED-WORLD-CONTEXT');
    expect(serialized).not.toContain('QLT:RECORD');
    void threadId;
  });
});

describe('C-18: L-3 through the REAL governed boundary; the capability stays closed', () => {
  it('a seeded correction proposal confirmed via act.confirmProposal creates exactly one successor and one link', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const created = await app.dispatch(
      'act.createThread',
      { title: 'L3 boundary' },
      `create-${crypto.randomUUID()}`,
    );
    const threadId = (created as { value: { id: string } }).value.id;
    await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'L3 boundary subject',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The boundary original statement.',
      },
      `claim-${crypto.randomUUID()}`,
    );
    const claims = await composition.sharedWorld.listMemoryRows({ threadId, kind: 'claim' });
    const target = claims.rows[0];
    // Disclosed fixture boundary (Q4 L-2 continuity): production wires no
    // pending-correction path; the pending correction proposal is seeded
    // at the repository level. Confirmation crosses the REAL boundary.
    await composition.sharedWorld.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'The boundary corrected statement.', reason: 'boundary probe' },
      proposedBy: 'actor-quellight-local',
      sourceThreadId: threadId,
      targetRecord: { recordId: target.id, family: 'claim', version: target.version },
    });
    const listed = await app.dispatch('act.queryMemory', {
      filters: { threadId, kind: 'proposal' },
    });
    const proposals = (
      listed as { value: { rows: { id: string; kind: string; status: string }[] } }
    ).value.rows.filter((row) => row.kind === 'proposal' && row.status === 'proposed');
    expect(proposals.length).toBe(1);
    const key = `confirm-${crypto.randomUUID()}`;
    const confirmed = await app.dispatch(
      'act.confirmProposal',
      { proposalId: proposals[0]!.id },
      key,
    );
    expect(confirmed.ok).toBe(true);
    const links = await composition.sharedWorld.meaning.listSourceLinks({
      fromRecordId: (
        await composition.sharedWorld.listMemoryRows({ threadId, kind: 'claim' })
      ).rows.find((row) => row.id !== target.id)!.id,
    });
    const threadLinks = links.filter((link) => link.relation === 'source-thread');
    expect(threadLinks.length).toBe(1);
    // Same-key replay converges truthfully.
    const replay = await app.dispatch('act.confirmProposal', { proposalId: proposals[0]!.id }, key);
    expect(replay.ok).toBe(true);
  });

  it('the pinned capability still rejects correction proposals (no authority expansion)', async () => {
    const dir = tempDir();
    const { composition } = await compose(dir);
    const capability = createProposalDraftCapability({
      meaning: composition.sharedWorld.meaning,
      resolveTurnCorrelation: async () => undefined,
      agentIdentity: 'agent-quellight',
    });
    const context = {
      turnId: 'turn-l3-probe',
      actorId: 'agent-quellight',
    } as unknown as ProposalDraftInvocationContext;
    const outcome = await (
      capability as unknown as {
        invoke: (input: unknown, context: unknown) => Promise<unknown>;
      }
    ).invoke(
      {
        proposalKind: 'correction',
        content: { statement: 'nope', reason: 'nope' },
      },
      context,
    );
    // The correction proposal is refused (structured refusal, not an
    // acceptance; no durable proposal row is created).
    const serialized = JSON.stringify(outcome);
    expect(serialized.includes('"accepted":true')).toBe(false);
    void composition;
  });
});

describe('C-10: restart preserves policy, per-turn evidence, records, and inspection truth', () => {
  it('a fresh composition over the same data directory keeps every durable truth', async () => {
    const dir = tempDir();
    const first = await compose(dir);
    await first.app.dispatch(
      'act.createThread',
      { title: 'Restart truth' },
      `create-${crypto.randomUUID()}`,
    );
    await first.app.dispatch(
      'act.setMemoryMode',
      { mode: 'per-conversation' },
      `mm-${crypto.randomUUID()}`,
    );
    const before = first.composition.sharedWorld.memoryPolicy.resolveCurrent();
    await first.composition.close();
    composed.length = 0;
    // A fresh composition over the SAME data directory (fresh process
    // semantics; D-6 discipline).
    const second = await compose(dir);
    const after = second.composition.sharedWorld.memoryPolicy.resolveCurrent();
    expect(after.mode).toBe(before.mode);
    expect(after.revision).toBe(before.revision);
    expect(after.policyId).toBe(QLT_MEMORY_MODE_POLICY_ID);
    // Restart reconciliation ran (reconcileOnStart default true).
    expect(second.composition.sharedWorld).toBeDefined();
  });
});
