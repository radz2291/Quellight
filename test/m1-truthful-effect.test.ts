/**
 * VICT-M-1 focused integration evidence (frozen contract
 * docs/report/QUELLIGHT-STAGE-07C-M-1-REMEDIATION.md, controls 15–16).
 *
 * Through the REAL Quellight composition — the released 0.3.0 VICT
 * bridge, the pinned proposal capability (revision 2 as recorded; 3 as of the Execution-3 remediation) truthfully declared
 * `write`, and the exact composition-supplied host quiet-write policy — a
 * scripted agent turn must:
 *
 *   - draft the inert pending proposal exactly as before (store, provenance,
 *     idempotency unchanged);
 *   - durably record the truthful decision evidence: effect `write`,
 *     approval-required FALSE, the closed-code host-policy disposition, the
 *     versioned policy identity;
 *   - create ZERO approval rows, ZERO approver identities, and ZERO
 *     awaiting-approval events; the turn never suspends;
 *   - keep the full governed chain intact (durable intent, claim, fence,
 *     settlement) and the transcript intact (quiet path, no interruption).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createAppServer } from '../src/lib/server/application-server';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';
import {
  QLT_FIXTURE_TRIGGERS,
  QLT_HOST_QUIET_WRITE_POLICY_IDENTITY,
  QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT,
  QLT_PROPOSAL_CAPABILITY_ID,
  QLT_PROPOSAL_CAPABILITY_REVISION,
} from '../src/lib/sharedworld/ceremony-contract';

const tempDirs: string[] = [];
const composed: Array<{ close(): Promise<void> }> = [];

afterAll(() => {
  for (const entry of composed.splice(0)) {
    void entry.close().catch(() => undefined);
  }
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

const TRIGGER = QLT_FIXTURE_TRIGGERS[0]!;

describe('VICT-M-1: the real composition records truthful write evidence and stays quiet', () => {
  it('a quiet proposal write records write/no-approval/host-policy truthfully with zero approval records and zero awaiting-approval events', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qlt-m1-'));
    tempDirs.push(dir);
    const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, dir);
    const composition = await createQuellightComposition({
      env,
      skipListen: true,
      offlineScript: {
        [TRIGGER.userText]: {
          kind: 'tool-call',
          toolName: TRIGGER.toolName,
          args: TRIGGER.args,
          thenText: TRIGGER.thenText,
        },
      },
    });
    composed.push(composition);
    const app = createAppServer(async () => ({ composition }));
    const actor = { ...composition.actor, presentedTokenKind: 'local-test' as const };

    // The pinned envelope carries the new truthful identity.
    expect(QLT_PROPOSAL_CAPABILITY_REVISION).toBe('3');
    expect(QLT_PROPOSAL_CAPABILITY_DECLARED_EFFECT).toBe('write');

    const created = await app.dispatch(
      'act.createThread',
      { title: 'M-1 truthful effect' },
      `create-${crypto.randomUUID()}`,
    );
    expect(created.ok).toBe(true);
    const threadId = (created as { ok: true; value: { id: string } }).value.id;
    const conversation = await composition.sharedWorld.ensureConversationLink(threadId);
    const outcome = await composition.commandService.dispatch(actor, {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: TRIGGER.userText },
      idempotencyKey: `m1-${crypto.randomUUID()}`,
    });
    if (!outcome.ok) throw new Error(`turn start failed: ${outcome.code}`);
    const { turnId, streamId } = outcome.data as { turnId: string; streamId: string };

    let status = '';
    for (let i = 0; i < 1200; i += 1) {
      const turn = await composition.turnService.getTurn({ ...actor }, turnId);
      status = turn.status;
      if (['completed', 'failed', 'cancelled', 'blocked', 'awaiting-approval'].includes(status)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    // The turn COMPLETED quietly (never suspended awaiting approval).
    expect(status).toBe('completed');

    const invocations = await composition.stores.invocations.listInvocationsForTurn(turnId);
    const record = invocations.at(-1);
    expect(record).toBeDefined();
    expect(record!.capabilityId).toBe(QLT_PROPOSAL_CAPABILITY_ID);
    expect(record!.capabilityRevision).toBe('3');
    // Truthful effect and decision evidence, durably recorded.
    expect(record!.effect).toBe('write');
    expect(record!.approvalRequired).toBe(false);
    expect(record!.approvalDisposition).toBe('host-policy-write-without-separate-approval');
    expect(record!.effectPolicyIdentity).toBe('vict-effect-policy@1');
    expect(QLT_HOST_QUIET_WRITE_POLICY_IDENTITY).toBe('qlt.host-policy.quiet-write@1');
    // The governed chain still ran (claim + fence + generation).
    expect(record!.runFenceToken).toBeTruthy();
    expect(record!.status).toBe('completed');

    // ZERO approval records and ZERO approver identities for the quiet write.
    const approvals = await composition.stores.approvals.listApprovalsForInvocation(
      record!.invocationId,
    );
    expect(approvals).toHaveLength(0);
    expect(await composition.stores.approvals.listOpenApprovals()).toEqual([]);

    // ZERO awaiting-approval events anywhere in the durable stream.
    const durable = await composition.stores.streamLedger.listEventsFrom(streamId, 0);
    const awaiting = durable.filter((event) => event.kind === 'tool.awaiting_approval');
    expect(awaiting).toHaveLength(0);

    // The inert proposal was still created (the store path is unchanged).
    const page = await composition.sharedWorld.meaning.listProposals({ sourceThreadId: threadId });
    expect(page.total).toBe(1);
    expect(page.rows[0]!.status).toBe('proposed');
    // Inert: no canonical record exists after the draft.
    expect((await composition.sharedWorld.meaning.listClaims({})).total).toBe(0);

    // The transcript stayed intact (the quiet completion text reached the turn).
    const restored = await composition.restoreThread(threadId);
    expect(restored.messages.some((message) => message.text.includes('pending memory inbox'))).toBe(
      true,
    );
  });
});
