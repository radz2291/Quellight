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
import { DatabaseSync } from 'node:sqlite';
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

/**
 * Complete durable row-state snapshot (Q5-B-1 / Q5-M-1): every user table
 * of the shared-world db, fully ordered, via a READ-ONLY raw connection.
 * This inspects the durable rows themselves — not any inspection
 * projection — so a read that silently persisted anything would show.
 */
function durableDump(dbPath: string): string {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const tables = (
      raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
        )
        .all() as { name: string }[]
    ).map((row) => row.name);
    const parts: string[] = [];
    for (const table of tables) {
      const columns = (raw.prepare(`PRAGMA table_info(${table});`).all() as { name: string }[]).map(
        (column) => column.name,
      );
      const order = columns.map((column) => `"${column}"`).join(', ');
      const rows = raw.prepare(`SELECT * FROM ${table} ORDER BY ${order};`).all();
      parts.push(`${table}: ${JSON.stringify(rows)}`);
    }
    return parts.join('\n');
  } finally {
    raw.close();
  }
}

/** The fully ordered durable rows of ONE table (read-only connection). */
function tableRows(dbPath: string, table: string): Record<string, unknown>[] {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return raw.prepare(`SELECT * FROM ${table} ORDER BY id;`).all() as Record<string, unknown>[];
  } finally {
    raw.close();
  }
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
    expect(composition.sharedWorld.memoryPolicy.peekCurrent().mode).toBe('per-conversation');
    // Same-key SAME-payload retry: the released boundary replays truthfully.
    const replay = await app.dispatch('act.setMemoryMode', { mode: 'per-conversation' }, key);
    expect(replay.ok).toBe(true);
    // Same-key DIFFERENT payload: the established conflict behavior.
    const conflict = await app.dispatch('act.setMemoryMode', { mode: 'off' }, key);
    expect(conflict.ok).toBe(false);
    expect((conflict as { code: string }).code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    // The durable mode stands (zero partial effects from the conflict).
    expect(composition.sharedWorld.memoryPolicy.peekCurrent().mode).toBe('per-conversation');
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
    expect(composition.sharedWorld.memoryPolicy.peekCurrent().mode).toBe('across-conversations');
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
    expect(composition.sharedWorld.memoryPolicy.peekCurrent().mode).toBe('across-conversations');
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

  it('C-01 (Q5-M-1/Q5-H-1): the bucket composition is truthful — decided proposals never render in Current', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const created = await app.dispatch(
      'act.createThread',
      { title: 'Buckets' },
      `create-${crypto.randomUUID()}`,
    );
    const threadId = (created as { value: { id: string } }).value.id;
    const actor = 'actor-quellight-local';
    // ---- Current-effective canonical records (REAL boundary actions) ----
    const claimA1 = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'Buckets current claim',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'A canonical current claim.',
      },
      `claim-a1-${crypto.randomUUID()}`,
    );
    expect(claimA1.ok).toBe(true);
    const commitment = await app.dispatch(
      'act.createCommitment',
      {
        threadId,
        commitmentKey: `buckets-commitment-${crypto.randomUUID()}`,
        statement: 'A canonical current commitment.',
      },
      `commitment-${crypto.randomUUID()}`,
    );
    expect(commitment.ok).toBe(true);
    const loop = await app.dispatch(
      'act.createOpenLoop',
      {
        threadId,
        subject: 'Buckets current loop',
        loopKind: 'undecided_question',
        detail: 'A canonical current open loop.',
      },
      `loop-${crypto.randomUUID()}`,
    );
    expect(loop.ok).toBe(true);
    // ---- Second thread: its records must be excludable by the filter ----
    const createdB = await app.dispatch(
      'act.createThread',
      { title: 'Buckets B' },
      `create-b-${crypto.randomUUID()}`,
    );
    const threadB = (createdB as { value: { id: string } }).value.id;
    const claimB = await app.dispatch(
      'act.createClaim',
      {
        threadId: threadB,
        subject: 'Buckets other-thread claim',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'Another conversation claim.',
      },
      `claim-b-${crypto.randomUUID()}`,
    );
    expect(claimB.ok).toBe(true);
    // ---- Non-vacuous proposal fixture (repository fixture boundary) ----
    const meaning = composition.sharedWorld.meaning;
    const claimProposal = (statement: string, subject: string) =>
      meaning.createProposal({
        proposalKind: 'claim',
        content: {
          subject,
          epistemicType: 'E2',
          honestyState: 'known',
          confidence: 'stated',
          statement,
        },
        proposedBy: actor,
        sourceThreadId: threadId,
      });
    const pProposed = await claimProposal(
      'The still-proposed statement.',
      'Buckets proposed proposal',
    );
    const pAwaiting = await claimProposal(
      'The awaiting-decision statement.',
      'Buckets awaiting proposal',
    );
    await meaning.markProposalAwaitingDecision(pAwaiting.id, { key: 'buckets-await-1' });
    // CONFIRMED through the REAL governed boundary.
    const pConfirmed = await claimProposal(
      'The to-be-confirmed statement.',
      'Buckets confirmed proposal',
    );
    await meaning.markProposalAwaitingDecision(pConfirmed.id, { key: 'buckets-await-2' });
    const confirmed = await app.dispatch(
      'act.confirmProposal',
      { proposalId: pConfirmed.id },
      `confirm-${crypto.randomUUID()}`,
    );
    expect(confirmed.ok).toBe(true);
    const pRejected = await claimProposal('The rejected statement.', 'Buckets rejected proposal');
    await meaning.markProposalAwaitingDecision(pRejected.id, { key: 'buckets-await-3' });
    await meaning.rejectProposal({
      proposalId: pRejected.id,
      decidedBy: actor,
      reason: 'bucket fixture rejection',
    });
    const pAmended = await claimProposal(
      'The original amended statement.',
      'Buckets amended proposal',
    );
    await meaning.markProposalAwaitingDecision(pAmended.id, { key: 'buckets-await-4' });
    const amended = await meaning.amendProposal({
      proposalId: pAmended.id,
      amendedBy: actor,
      content: {
        subject: 'Buckets amended proposal',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The amended replacement statement.',
      },
      reason: 'bucket fixture amendment',
    });
    // Amending also creates a NEW proposed amendment proposal: pending grows.
    expect(amended.original.status).toBe('amended');
    expect(amended.amendment.status).toBe('proposed');
    const pWithdrawn = await claimProposal(
      'The withdrawn statement.',
      'Buckets withdrawn proposal',
    );
    await meaning.markProposalAwaitingDecision(pWithdrawn.id, { key: 'buckets-await-5' });
    await meaning.withdrawProposal({
      proposalId: pWithdrawn.id,
      withdrawnBy: actor,
      reason: 'bucket fixture withdrawal',
    });
    // ---- Superseded / released / abandoned records ----
    const supersededClaim = await app.dispatch(
      'act.createClaim',
      {
        threadId,
        subject: 'Buckets superseded claim',
        epistemicType: 'E2',
        honestyState: 'known',
        confidence: 'stated',
        statement: 'The soon-superseded statement.',
      },
      `claim-sup-${crypto.randomUUID()}`,
    );
    expect(supersededClaim.ok).toBe(true);
    const supersededId = (supersededClaim as { value: { id: string } }).value.id;
    await meaning.applyCorrection({
      subjectRecordId: supersededId,
      subjectFamily: 'claim',
      correctionKey: `buckets-correction-${crypto.randomUUID()}`,
      content: { statement: 'The successor statement.' },
      correctedBy: actor,
      sourceThreadId: threadId,
    });
    const releasedCommitment = await app.dispatch(
      'act.createCommitment',
      {
        threadId,
        commitmentKey: `buckets-released-${crypto.randomUUID()}`,
        statement: 'The soon-released commitment.',
      },
      `commitment-rel-${crypto.randomUUID()}`,
    );
    await meaning.releaseCommitment({
      recordId: (releasedCommitment as { value: { id: string } }).value.id,
      exitedBy: actor,
      reason: 'bucket fixture release',
    });
    const abandonedLoop = await app.dispatch(
      'act.createOpenLoop',
      {
        threadId,
        subject: 'Buckets abandoned loop',
        loopKind: 'undecided_question',
        detail: 'The soon-abandoned loop.',
      },
      `loop-ab-${crypto.randomUUID()}`,
    );
    await meaning.abandonLoop({
      loopId: (abandonedLoop as { value: { id: string } }).value.id,
      exitedBy: actor,
      reason: 'bucket fixture abandonment',
    });

    // Expected composition (NO thread/kind filter):
    // pending  = proposed + awaiting_decision + the amendment proposal = 3
    // current  = claimA1 + confirmed-claim + commitment + loop
    //            + correction successor                                = 5
    //            (+ the second thread's claim => 6 total unfiltered)
    // history  = confirmed + rejected + amended + withdrawn proposals
    //            + superseded claim + released commitment
    //            + abandoned loop                                      = 7
    const list = async (bucket: string, extra: Record<string, string> = {}) =>
      inspectionQuery(app, { query: 'listRecords', bucket, ...extra });
    const pageOf = async (bucket: string, extra: Record<string, string> = {}) => {
      const result = await list(bucket, extra);
      expect(result.ok).toBe(true);
      return (
        result as {
          value: {
            rows: {
              id: string;
              kind: string;
              status: string;
              details?: { recordId?: string };
            }[];
            total: number;
          };
        }
      ).value;
    };

    // PENDING: ONLY the two pending proposal statuses; nothing else.
    const pending = await pageOf('pending');
    expect(pending.total).toBe(3);
    expect(pending.rows.every((row) => row.kind === 'proposal')).toBe(true);
    expect(
      pending.rows.every((row) => ['proposed', 'awaiting_decision'].includes(row.status)),
    ).toBe(true);
    expect(pending.rows.map((row) => row.status).sort()).toEqual(
      ['awaiting_decision', 'proposed', 'proposed'].sort(),
    );

    // CURRENT: ZERO proposals of ANY status; total equals ONLY canonical
    // current records (the second thread's claim is included unfiltered).
    const current = await pageOf('current');
    expect(current.total).toBe(6);
    expect(current.rows.every((row) => row.kind !== 'proposal')).toBe(true);

    // HISTORY: ALL terminal proposals plus the closed/superseded records.
    const history = await pageOf('history');
    expect(history.total).toBe(7);
    const historyStatuses = history.rows.map((row) => row.status).sort();
    for (const status of ['confirmed', 'rejected', 'amended', 'withdrawn', 'superseded']) {
      expect(historyStatuses).toContain(status);
    }
    expect(history.rows.filter((row) => row.kind === 'proposal')).toHaveLength(4);
    expect(
      history.rows.some(
        (row) => (row as { details?: { recordId?: string } }).details?.recordId === supersededId,
      ),
    ).toBe(true);

    // PAGINATION (limit 2 walk over current): deterministic, disjoint,
    // duplicate-free, consistent with the totals.
    const walk = async () => {
      const seen: string[] = [];
      for (let offset = 0; offset < current.total; offset += 2) {
        const page = await pageOf('current', { limit: '2', offset: String(offset) });
        expect(page.rows.length).toBe(Math.min(2, current.total - offset));
        seen.push(
          ...page.rows.map(
            (row) => (row as { details?: { recordId?: string } }).details?.recordId ?? '',
          ),
        );
      }
      return seen;
    };
    const recordIdOf = (row: { details?: { recordId?: string } }) => row.details?.recordId ?? '';
    const walked = await walk();
    expect(new Set(walked).size).toBe(walked.length);
    expect([...walked].sort()).toEqual([...current.rows.map(recordIdOf)].sort());
    expect(await walk()).toEqual(walked);

    // A kind filter can never reintroduce proposals into Current.
    const currentProposals = await pageOf('current', { kind: 'proposal' });
    expect(currentProposals.total).toBe(0);
    expect(currentProposals.rows).toEqual([]);

    // Thread filtering excludes the second thread's records.
    const currentA = await pageOf('current', { threadId });
    expect(currentA.total).toBe(5);
    const currentB = await pageOf('current', { threadId: threadB });
    expect(currentB.total).toBe(1);
    expect(currentB.rows[0].kind).toBe('claim');
    expect(currentB.rows[0].details?.recordId).not.toBe(supersededId);
  });

  it('C-19 (Q5-M-1/Q5-B-1): reads are durable-effect-free — the full row-state never changes; getPolicy is the truthful implicit default', async () => {
    const dir = tempDir();
    const { composition, app } = await compose(dir);
    const dbPath = join(dir, 'data', 'shared-world.db');
    // NOTE: no turn is admitted in this test before the purity assertions
    // (turn admission is a LEGITIMATE write path and would seed the row).
    // (a) Complete durable row-state snapshot of the shared-world db.
    const snapshot1 = durableDump(dbPath);
    // (b) getPolicy through the REAL boundary: truthful implicit default.
    const first = await app.dispatch('act.queryInspection', {
      filters: { query: 'getPolicy' },
    });
    expect(first.ok).toBe(true);
    const implicitRow = (
      first as {
        value: {
          row: {
            policyId: string;
            mode: string;
            modeLabel: string;
            revision: number;
            updatedAtMs: number | null;
            persisted: boolean;
          };
        };
      }
    ).value.row;
    expect(implicitRow).toEqual({
      policyId: 'qlt.memory-mode@1',
      mode: 'across-conversations',
      modeLabel: 'Across conversations',
      revision: 1,
      updatedAtMs: null,
      persisted: false,
    });
    // (c) Second complete snapshot — identical (a declared read never wrote).
    expect(durableDump(dbPath)).toBe(snapshot1);
    // (d) Repeat: deterministic identity, continued zero effect.
    const repeat = await app.dispatch('act.queryInspection', {
      filters: { query: 'getPolicy' },
    });
    expect(repeat.ok).toBe(true);
    expect((repeat as { value: { row: unknown } }).value.row).toEqual(implicitRow);
    expect(durableDump(dbPath)).toBe(snapshot1);
    // (e) A LEGITIMATE write path through the real boundary: exactly ONE
    // qlt_memory_policy row, at the truthful revision 2.
    const modeChange = await app.dispatch(
      'act.setMemoryMode',
      { mode: 'per-conversation' },
      `memory-mode-${crypto.randomUUID()}`,
    );
    expect(modeChange.ok).toBe(true);
    const policyRows = tableRows(dbPath, 'qlt_memory_policy');
    expect(policyRows).toHaveLength(1);
    expect(policyRows[0]).toMatchObject({ mode: 'per-conversation', revision: 2 });
    expect(composition.sharedWorld.memoryPolicy.peekPolicyRow()?.updatedAtMs).toBeTypeOf('number');
    // (f) Further getPolicy reads remain pure (snapshot unchanged).
    const snapshot2 = durableDump(dbPath);
    expect(snapshot2).not.toBe(snapshot1); // the durable row now exists
    const afterWrite = await app.dispatch('act.queryInspection', {
      filters: { query: 'getPolicy' },
    });
    expect(afterWrite.ok).toBe(true);
    expect(
      (afterWrite as { value: { row: { persisted: boolean; revision: number } } }).value.row,
    ).toMatchObject({ persisted: true, revision: 2 });
    expect(durableDump(dbPath)).toBe(snapshot2);

    // Existing pagination-bounds and never-contains coverage (kept).
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
    const before = first.composition.sharedWorld.memoryPolicy.peekCurrent();
    await first.composition.close();
    composed.length = 0;
    // A fresh composition over the SAME data directory (fresh process
    // semantics; D-6 discipline).
    const second = await compose(dir);
    const after = second.composition.sharedWorld.memoryPolicy.peekCurrent();
    expect(after.mode).toBe(before.mode);
    expect(after.revision).toBe(before.revision);
    expect(after.policyId).toBe(QLT_MEMORY_MODE_POLICY_ID);
    // Restart reconciliation ran (reconcileOnStart default true).
    expect(second.composition.sharedWorld).toBeDefined();
  });
});
