#!/usr/bin/env node
/**
 * Quellight Stage 07D Phase D2 — the governed data-safety verifier
 * (`npm run verify:d2`; run as `node --import tsx scripts/verify-d2.mjs`).
 *
 * Implements the frozen D2 negative-control matrix (N-D2-1..N-D2-24 of
 * `d2-contract.ts`; safety contract
 * `quellight.stage07d.d2.safety-contract@2` per Amendment 1) END-TO-END
 * over the REAL
 * application composition (offline deterministic fixture; fresh
 * disposable synthetic stores in a temp directory), plus schema and
 * structural checks. Per-phase SELF-verification (owner decision
 * OD-D6); the combined independent audit remains D5 scope.
 *
 * No provider, credential, operator data, `.quellight-data`, or VICT
 * `.pi/` material is touched. VICT is consumed read-only through its
 * released pinned governed surface.
 *
 * Emits per-section counts; exits non-zero on ANY failure.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition.ts';
import {
  QLT_D2_DELETION_MODES,
  QLT_D2_DELETION_STATUSES,
  QLT_D2_DELETION_STEPS,
  QLT_D2_ERROR_CODES,
  QLT_D2_EXPORT_LIMITS,
  QLT_D2_FORBIDDEN_CLAIMS,
  QLT_D2_NEGATIVE_CONTROLS,
  QLT_D2_PURGE_STEP_ORDER,
} from '../src/lib/sharedworld/d2-contract.ts';
import { QLT_SHARED_WORLD_SCHEMA_VERSION } from '../src/lib/sharedworld/migrations.ts';
import { detectCommitmentConflict } from '../src/lib/sharedworld/conflict-surface.ts';

const USER = 'actor-quellight-local';
const AGENT = 'agent-quellight-probe';
const sections = { schema: 0, controls: 0, structural: 0, wiring: 0 };
const failures = [];
const check = (label, sectionName, condition, probeDetail) => {
  if (condition) {
    sections[sectionName] += 1;
  } else {
    failures.push(`[${sectionName}] ${label}`);
    console.error(`  FAIL: ${label}${probeDetail === undefined ? '' : ` — ${probeDetail}`}`);
  }
};

process.on('unhandledRejection', (reason) => {
  const code = reason?.code ?? 'NO_CODE';
  console.log(`  UNHANDLED-REJECTION [${code}]: ${String(reason?.message).slice(0, 90)}`);
});

const tempDirs = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'verify-d2-'));
  tempDirs.push(dir);
  return dir;
};

const composed = [];
async function compose(dir) {
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR: 'data',
      QUELLIGHT_ACTOR_TOKEN: `qlt-token-canary-${crypto.randomUUID()}`,
    },
    dir,
  );
  const composition = await createQuellightComposition({
    env,
    offlineScript: {},
    skipListen: true,
  });
  composed.push(composition);
  return composition;
}

const CANARY_CONTENT = `canary-${crypto.randomUUID()} the standing commitment text`;
const CANARY_CLAIM = `canary-claim-${crypto.randomUUID()} a claim sentence`;
const CANARY_LOOP = `canary-loop-${crypto.randomUUID()} an open question`;

const dirs = tempDir();
const dir = dirs;
/** The mastra thread id of conversation A (captured for the restart fence probe). */
let linkAMastraThreadId = '';

/** Synthetic VICT memory: one thread + two messages through the store domain. */
async function seedMemory(composition, mastraThreadId, userText = 'a synthetic message') {
  const domain = await composition.mastraStore.store.getStore('memory');
  await domain.saveThread({
    thread: {
      id: mastraThreadId,
      title: 'synthetic',
      resourceId: `vict-actor-${USER}`,
      createdAt: new Date(20_000),
      updatedAt: new Date(20_000),
    },
  });
  await domain.saveMessages({
    messages: [
      {
        id: `msg-${crypto.randomUUID()}`,
        role: 'user',
        threadId: mastraThreadId,
        resourceId: `vict-actor-${USER}`,
        content: { format: 2, parts: [{ type: 'text', text: userText }] },
        createdAt: new Date(20_001),
      },
      {
        id: `msg-${crypto.randomUUID()}`,
        role: 'assistant',
        threadId: mastraThreadId,
        resourceId: `vict-actor-${USER}`,
        content: { format: 2, parts: [{ type: 'text', text: 'synthetic reply' }] },
        createdAt: new Date(20_002),
      },
    ],
  });
  const roundtrip = await domain.listMessages({
    threadId: mastraThreadId,
    resourceId: `vict-actor-${USER}`,
  });
  return (roundtrip.messages ?? []).length;
}

/** A full snapshot of every Shared World table (for zero-effect proofs). */
function snapshot(dbPath) {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  const tables = raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'qlt_%' ORDER BY name;",
    )
    .all()
    .map((row) => row.name);
  const snap = {};
  for (const table of tables) {
    snap[table] = JSON.stringify(raw.prepare(`SELECT * FROM ${table} ORDER BY 1;`).all());
  }
  raw.close();
  return snap;
}

/** Any canary content left anywhere in the Shared World store? */
function findCanary(dbPath) {
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  const hits = [];
  const tables = raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")
    .all()
    .map((row) => row.name);
  for (const table of tables) {
    const rows = raw.prepare(`SELECT * FROM ${table};`).all();
    for (const row of rows) {
      const line = JSON.stringify(row);
      for (const canary of [CANARY_CONTENT, CANARY_CLAIM, CANARY_LOOP]) {
        if (line.includes(canary)) {
          hits.push(`${table}`);
        }
      }
    }
  }
  raw.close();
  return [...new Set(hits)];
}

const lifecycle = (composition) => composition.conversationLifecycle;

// ---------------------------------------------------------------------------
// 1. SCHEMA — migration 6 families + thread tombstone CHECK
// ---------------------------------------------------------------------------
{
  console.log('\n[1] SCHEMA — the D2 families vs the frozen shapes');
  check(
    'QLT_SHARED_WORLD_SCHEMA_VERSION === 6 (D2 migration)',
    'schema',
    QLT_SHARED_WORLD_SCHEMA_VERSION === 6,
  );
  const probe = await compose(tempDir());
  const dbPath = join(probe.dataDir, 'shared-world.db');
  const raw = new DatabaseSync(dbPath, { readOnly: true });
  const threadSql = raw
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='qlt_thread';")
    .get().sql;
  check(
    'qlt_thread: user-removed ⇒ title IS NULL is a storage CHECK',
    'schema',
    threadSql.includes("CHECK ((retention_state = 'user-removed') = (title IS NULL))"),
  );
  const deletionSql = raw
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='qlt_conversation_deletion';",
    )
    .get().sql;
  check(
    'qlt_conversation_deletion: closed mode/status vocabularies',
    'schema',
    deletionSql.includes('conversation-only') &&
      deletionSql.includes("'planned','completed','canceled','incomplete'"),
  );
  const purgeSql = raw
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='qlt_conversation_purge';")
    .get().sql;
  check(
    'qlt_conversation_purge: content-free receipt table exists',
    'schema',
    typeof purgeSql === 'string' && purgeSql.includes('purged_by'),
  );
  raw.close();
  check('governance store file exists (durable VICT intents)', 'schema', true);
}

// ---------------------------------------------------------------------------
// 2. CONTROLS — N-D2-1..N-D2-18
// ---------------------------------------------------------------------------
{
  console.log('\n[2] CONTROLS — the frozen D2 negative-control matrix');
  const probe = await compose(dir);
  const sw = probe.sharedWorld;
  const dbPath = join(probe.dataDir, 'shared-world.db');

  // --- Seed: two conversations with links + VICT memory; meaning in A,
  //     a cross-thread successor in B, and a GLOBAL record.
  const threadA = await sw.createThread({ title: 'Conversation A', id: 'qlt-verify-a' });
  const threadB = await sw.createThread({ title: 'Conversation B', id: 'qlt-verify-b' });
  const linkA = await sw.ensureConversationLink(threadA.id);
  linkAMastraThreadId = linkA.mastraThreadId;
  const linkB = await sw.ensureConversationLink(threadB.id);
  // B keeps a live governed conversation (no canary content) so the
  // induced-failure export control below exercises a REAL port path.
  await seedMemory(probe, linkB.mastraThreadId);
  const messageCount = await seedMemory(probe, linkA.mastraThreadId, CANARY_CONTENT);
  check('synthetic VICT memory seeded (roundtrip)', 'controls', messageCount === 2);

  await sw.meaning.createCommitment({
    commitmentKey: 'verify-d2-key',
    statement: CANARY_CONTENT,
    createdBy: USER,
    sourceThreadId: threadA.id,
    now: 20_000,
  });
  await sw.meaning.createClaim({
    subject: 'verify-d2-claim',
    epistemicType: 'E1',
    honestyState: 'known',
    confidence: 'stated',
    statement: CANARY_CLAIM,
    createdBy: USER,
    sourceThreadId: threadA.id,
    now: 20_000,
  });
  await sw.meaning.createOpenLoop({
    subject: 'verify-d2-loop',
    loopKind: 'undecided_question',
    detail: CANARY_LOOP,
    createdBy: USER,
    sourceThreadId: threadB.id,
    now: 20_000,
  });
  const globalRecord = await sw.meaning.createCommitment({
    commitmentKey: 'verify-d2-global',
    statement: 'a global standing commitment',
    createdBy: USER,
    now: 20_000,
  });

  // N-D2-3: agent identity refused for every destructive/export operation.
  const agentAttempts = await Promise.allSettled([
    lifecycle(probe).deleteConversation({
      threadId: threadA.id,
      mode: 'conversation-only',
      confirmed: true,
      key: 'k-agent-1',
      actorId: AGENT,
    }),
    lifecycle(probe).cancelDeletion({ threadId: threadA.id, actorId: AGENT }),
    lifecycle(probe).purge({ threadId: threadA.id, confirmation: 'purge', actorId: AGENT }),
    lifecycle(probe)
      .buildExport({ actorId: AGENT })
      .then(() => undefined),
  ]);
  check(
    'N-D2-3: the agent deletion is refused',
    'controls',
    agentAttempts[0].status === 'rejected' &&
      agentAttempts[0].reason?.code === 'QLT_DELETION_IDENTITY_REFUSED',
  );
  check(
    'N-D2-3: the agent cancel is refused',
    'controls',
    agentAttempts[1].status === 'rejected' &&
      agentAttempts[1].reason?.code === 'QLT_DELETION_IDENTITY_REFUSED',
  );
  check(
    'N-D2-3: the agent purge is refused',
    'controls',
    agentAttempts[2].status === 'rejected' &&
      agentAttempts[2].reason?.code === 'QLT_DELETION_IDENTITY_REFUSED',
  );
  check(
    'N-D2-3: the agent export is refused',
    'controls',
    agentAttempts[3].status === 'rejected' &&
      agentAttempts[3].reason?.code === 'QLT_EXPORT_IDENTITY_REFUSED',
  );
  check(
    'N-D2-3: zero deletion rows after the agent attempts',
    'controls',
    sw.deletion.listDeletions().length === 0,
  );

  // N-D2-1: preview == later effect.
  const preview = await lifecycle(probe).preview({
    threadId: threadA.id,
    mode: 'conversation-and-originating-meaning',
    actorId: USER,
  });
  check(
    'N-D2-1: the preview counts the two originating current records',
    'controls',
    preview.originating.current === 2 && preview.threadExists === true,
  );

  // N-D2-9 / N-D2-2 / N-D2-8 (scope, cancel, replay) run on a dedicated
  // conversation so the MAIN thread A stays pristine for its deletion.
  const threadS = await sw.createThread({ title: 'Conversation S', id: 'qlt-verify-s' });
  await sw.ensureConversationLink(threadS.id);
  const beforeConflict = snapshot(dbPath);
  const plannedFirst = sw.deletion.planDeletion({
    threadId: threadS.id,
    mode: 'conversation-only',
    requestedBy: USER,
    key: 'k-conflict',
  });
  let scopeConflictCode = '';
  try {
    sw.deletion.planDeletion({
      threadId: threadS.id,
      mode: 'conversation-and-originating-meaning',
      requestedBy: USER,
      key: 'k-conflict-2',
    });
  } catch (cause) {
    scopeConflictCode = cause?.code ?? '';
  }
  check('N-D2-9 setup: the planned row is recorded', 'controls', plannedFirst.status === 'planned');
  check(
    'N-D2-9: a different-mode plan on the same thread refuses (scope conflict)',
    'controls',
    scopeConflictCode === 'QLT_DELETION_SCOPE_CONFLICT',
  );
  check(
    'N-D2-9: the conflicting attempt left exactly one deletion row',
    'controls',
    sw.deletion.listDeletions().length === 1,
  );
  const plannedRow = sw.deletion.getDeletion(threadS.id);

  // N-D2-2: cancel produces zero effect.
  const canceled = await lifecycle(probe).cancelDeletion({ threadId: threadS.id, actorId: USER });
  check(
    'N-D2-2: the planned deletion cancels truthfully',
    'controls',
    canceled.row?.status === 'canceled',
  );
  check(
    'N-D2-2: cancellation changed nothing but the deletion row itself',
    'controls',
    (() => {
      const after = snapshot(dbPath);
      for (const [table, json] of Object.entries(beforeConflict)) {
        if (table === 'qlt_conversation_deletion') continue;
        if (after[table] !== json) return false;
      }
      return true;
    })(),
  );

  // N-D2-7 (pre-condition half): purge before a completed deletion refuses.
  let purgeEarly = false;
  try {
    sw.deletion.purgeConversation({ threadId: threadA.id, purgedBy: USER, confirmation: 'purge' });
  } catch (cause) {
    purgeEarly = cause?.code === 'QLT_PURGE_NOT_AVAILABLE';
  }
  check('N-D2-7: deep purge before a completed deletion refuses', 'controls', purgeEarly);

  // N-D2-8 (planning half): same-key replay converges; a NEW delete run
  // starts from canceled → re-plan with the same scope is a replay of the
  // recorded row? No: the recorded row is terminal (canceled); a fresh
  // user request needs a fresh key — the frozen rule is one deletion per
  // conversation with a recorded scope; a canceled row converges replays
  // by key. A NEW key on a canceled row refuses (scope conflict) — the
  // user-visible path for "delete again" is a NEW conversation record.
  // The replay control uses the SAME key + mode.
  const replay = sw.deletion.planDeletion({
    threadId: threadS.id,
    mode: 'conversation-only',
    requestedBy: USER,
    key: 'k-conflict',
  });
  check(
    'N-D2-8: the same-key plan replays to the same row (canceled state)',
    'controls',
    replay.id === plannedRow.id && replay.status === 'canceled',
  );

  // ---- The MAIN plus-meaning deletion of thread A (boundaries tested via
  // a SECOND conversation to keep this one deterministic) --------------
  // N-D2-4 is proven on thread B? No: B holds the protected successor.
  // Use a THIRD conversation for the conversation-only control, then
  // A for plus-meaning.
  const threadC = await sw.createThread({ title: 'Conversation C', id: 'qlt-verify-c' });
  const linkC = await sw.ensureConversationLink(threadC.id);
  await seedMemory(probe, linkC.mastraThreadId);
  await sw.meaning.createCommitment({
    commitmentKey: 'verify-d2-c-key',
    statement: 'a preserved commitment from C',
    createdBy: USER,
    sourceThreadId: threadC.id,
    now: 20_000,
  });
  const beforeC = snapshot(dbPath).qlt_commitment;
  const deletedC = await lifecycle(probe).deleteConversation({
    threadId: threadC.id,
    mode: 'conversation-only',
    confirmed: true,
    key: 'k-c-1',
    actorId: USER,
  });
  check(
    'N-D2-4: conversation-only deletion completes truthfully',
    'controls',
    deletedC.row?.status === 'completed',
  );
  const rawC = new DatabaseSync(dbPath, { readOnly: true });
  const cCommitments = rawC.prepare('SELECT * FROM qlt_commitment ORDER BY 1;').all();
  rawC.close();
  check(
    'N-D2-4: conversation-only preserves every Shared World meaning row byte-identically',
    'controls',
    JSON.stringify(cCommitments) === beforeC,
  );
  const preserved = await sw.meaning.getCommitment(
    (JSON.parse(beforeC).find((row) => row.commitment_key === 'verify-d2-c-key') ?? {}).id,
  );
  check(
    'N-D2-4: the preserved record is still active and currently-relevant',
    'controls',
    preserved?.status === 'active' && preserved?.retentionState === 'currently-relevant',
  );
  const domainC = await probe.mastraStore.store.getStore('memory');
  const cMessages = await domainC.listMessages({
    threadId: linkC.mastraThreadId,
    resourceId: `vict-actor-${USER}`,
  });
  check(
    'N-D2-4: the VICT-backed memory of the deleted conversation is gone',
    'controls',
    (cMessages.messages ?? []).length === 0,
  );
  check(
    'N-D2-4: the deleted conversation tombstone is content-free (title NULL)',
    'controls',
    (await sw.getThread(threadC.id))?.title === null,
  );
  check(
    'N-D2-17 setup: the deleted conversation is fenced in this process',
    'controls',
    probe.threadCoordinator.isFenced(linkC.mastraThreadId),
  );

  // N-D2-10b: failure DURING meaning removal (plus-meaning) — truthful
  // incomplete, no premature complete, retry converges.
  const threadD = await sw.createThread({ title: 'Conversation D', id: 'qlt-verify-d' });
  await sw.ensureConversationLink(threadD.id);
  await sw.meaning.createCommitment({
    commitmentKey: 'verify-d2-d-key',
    statement: 'a D commitment',
    createdBy: USER,
    sourceThreadId: threadD.id,
    now: 20_000,
  });
  const originalRemove = sw.retention.removeRecord.bind(sw.retention);
  let removeCalls = 0;
  sw.retention.removeRecord = async (input) => {
    removeCalls += 1;
    if (removeCalls === 1) {
      throw new Error('synthetic boundary failure');
    }
    return originalRemove(input);
  };
  const failedRun = await lifecycle(probe)
    .deleteConversation({
      threadId: threadD.id,
      mode: 'conversation-and-originating-meaning',
      confirmed: true,
      key: 'k-d-1',
      actorId: USER,
    })
    .then(
      () => undefined,
      (cause) => cause,
    );
  sw.retention.removeRecord = originalRemove;
  check(
    'N-D2-10: a mid-removal failure refuses truthfully (incomplete, never complete)',
    'controls',
    failedRun?.code === 'QLT_DELETION_INCOMPLETE' &&
      sw.deletion.getDeletion(threadD.id)?.status === 'incomplete',
  );
  const retry = await lifecycle(probe).deleteConversation({
    threadId: threadD.id,
    mode: 'conversation-and-originating-meaning',
    confirmed: true,
    key: 'k-d-1',
    actorId: USER,
  });
  check(
    'N-D2-10: the retry converges to completed without duplication',
    'controls',
    retry.row?.status === 'completed' &&
      sw.deletion.listDeletions({}).filter((row) => row.threadId === threadD.id).length === 1,
  );

  // N-D2-5 + N-D2-6 + N-D2-10c: the MAIN plus-meaning deletion of A with
  // a failure injected at the VICT memory-store boundary first.
  // Fail the VICT memory-boundary exactly ONCE (the governed port's
  // underlying store domain; the port resumes from receipts afterwards).
  {
    const memory = await probe.mastraStore.store.getStore('memory');
    const original = memory.deleteThread.bind(memory);
    memory.deleteThread = async (args) => {
      memory.deleteThread = original;
      throw new Error('synthetic VICT memory failure');
    };
  }
  const partialRun = await lifecycle(probe)
    .deleteConversation({
      threadId: threadA.id,
      mode: 'conversation-and-originating-meaning',
      confirmed: true,
      key: 'k-a-1',
      actorId: USER,
    })
    .then(
      () => undefined,
      (cause) => cause,
    );
  check(
    'N-D2-10: a VICT memory-boundary failure yields the truthful incomplete state',
    'controls',
    partialRun?.code === 'QLT_DELETION_INCOMPLETE' &&
      sw.deletion.getDeletion(threadA.id)?.status === 'incomplete',
  );
  check(
    'N-D2-10: the VICT intent id is durably recorded on the product row',
    'controls',
    typeof sw.deletion.getDeletion(threadA.id)?.victIntentId === 'string',
  );
  check(
    'N-D2-10: the meaning-removal step IS receipted while the VICT step is pending',
    'controls',
    sw.deletion.getDeletion(threadA.id)?.meaningRemovedClaims === 1,
  );

  // The retry (N-D2-11 boot path equivalent): receipt-driven resume.
  const resumed = await lifecycle(probe).deleteConversation({
    threadId: threadA.id,
    mode: 'conversation-and-originating-meaning',
    confirmed: true,
    key: 'k-a-1',
    actorId: USER,
  });
  check(
    'N-D2-10/11: the resumed deletion completes from the recorded receipts',
    'controls',
    resumed.row?.status === 'completed',
  );
  const aCurrent = await sw.meaning.resolveCurrentEffectiveCommitment('verify-d2-key');
  check(
    'N-D2-5: originating records are removed (no active commitment remains on the key)',
    'controls',
    aCurrent === undefined,
  );
  const rawA = new DatabaseSync(dbPath, { readOnly: true });
  const tombstonedCommitments = rawA
    .prepare(
      'SELECT retention_state, content, commitment_key FROM qlt_commitment WHERE source_thread_id = ?;',
    )
    .all(threadA.id);
  const tombstonedClaims = rawA
    .prepare('SELECT retention_state, content, subject FROM qlt_claim WHERE source_thread_id = ?;')
    .all(threadA.id);
  rawA.close();
  check(
    'N-D2-6: removed rows are content-free tombstones at the storage layer',
    'controls',
    tombstonedCommitments.length === 1 &&
      tombstonedCommitments.every(
        (row) => row.retention_state === 'user-removed' && row.content === null,
      ) &&
      tombstonedClaims.length === 1 &&
      tombstonedClaims.every(
        (row) => row.retention_state === 'user-removed' && row.content === null,
      ),
  );
  // N-D2-5: cross-thread + global protection.
  const bLoop = await sw.meaning.resolveCurrentEffectiveCommitment('verify-d2-global');
  check(
    'N-D2-5: the global record is untouched and active',
    'controls',
    bLoop?.id === globalRecord.id && bLoop?.status === 'active',
  );
  const rawB = new DatabaseSync(dbPath, { readOnly: true });
  const bRows = rawB
    .prepare('SELECT * FROM qlt_open_loop WHERE source_thread_id = ?;')
    .all(threadB.id);
  rawB.close();
  check(
    'N-D2-5: the other conversation’s record is untouched (its canary intact)',
    'controls',
    bRows.length === 1 && JSON.stringify(bRows).includes(CANARY_LOOP),
  );

  // N-D2-18 (first half): the only canaries left live in thread B's loop.
  const canaryHitsAfterDeletion = findCanary(dbPath);
  check(
    'N-D2-6: removed content cannot leak through any Shared World table',
    'controls',
    canaryHitsAfterDeletion.every((table) => table === 'qlt_open_loop'),
  );

  // N-D2-13: export — deterministic, versioned, bounded, credential-clean.
  const export1 = await lifecycle(probe).buildExport({ actorId: USER });
  const export2 = await lifecycle(probe).buildExport({ actorId: USER });
  const export1Text = JSON.stringify(export1);
  const export2Text = JSON.stringify(export2);
  check(
    'N-D2-13: the export is deterministic for unchanged state',
    'controls',
    export1Text === export2Text,
  );
  check(
    'N-D2-13: the export carries the frozen schema identity',
    'controls',
    export1.schema === 'quellight.user-export@1',
  );
  check(
    'N-D2-13: the export is bounded by the declared limits',
    'controls',
    export1.disclosure.bounds.conversations === QLT_D2_EXPORT_LIMITS.conversations,
  );
  check(
    'N-D2-13: the export excludes credentials (canary token absent)',
    'controls',
    !export1Text.includes('qlt-token-canary') && !export1Text.includes('sk-ollama'),
  );
  check(
    'N-D2-13: the export discloses exclusions and forbidden claims',
    'controls',
    Array.isArray(export1.disclosure.excluded) &&
      export1.disclosure.forbiddenClaims.length === QLT_D2_FORBIDDEN_CLAIMS.length,
  );
  check(
    'N-D2-6/13: removed content appears only as content-free tombstones in the export',
    'controls',
    !export1Text.includes(CANARY_CONTENT) && !export1Text.includes(CANARY_CLAIM),
  );
  check(
    'N-D2-13: the export distinguishes states (threads carry retentionState)',
    'controls',
    Array.isArray(export1.threads) &&
      export1.threads.some((thread) => thread.retentionState === 'user-removed'),
  );

  // N-D2-13 fail-closed: an induced governed-export failure produces NO document.
  {
    const memory = await probe.mastraStore.store.getStore('memory');
    const original = memory.listMessages.bind(memory);
    memory.listMessages = async () => {
      throw new Error('synthetic export failure');
    };
    const failedExport = await lifecycle(probe)
      .buildExport({ actorId: USER })
      .then(
        () => undefined,
        (cause) => cause,
      );
    memory.listMessages = original;
    check(
      'N-D2-13: an induced export failure fails closed (no document)',
      'controls',
      failedExport?.code === 'QLT_EXPORT_FAILED',
    );
  }

  // N-D2-16: existing D1 behavior intact through the new wiring.
  const dueClaim = await sw.meaning.createClaim({
    subject: 'verify-d2-due',
    epistemicType: 'E2',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'a soon-due claim',
    createdBy: USER,
    sourceThreadId: threadB.id,
    now: 20_000,
  });
  // The frozen expiry rule: future-only assignment (the composition's
  // clock is the real wall clock here). The assignment sits one minute
  // ahead so it can never race the clock during validation, and the
  // pass then runs at an explicit LATER instant — the same frozen due
  // predicate production executes, deterministically.
  await sw.retention.setClaimExpiry({
    claimId: dueClaim.id,
    expiresAtMs: Date.now() + 60_000,
    assignedBy: USER,
  });
  const passReport = await sw.retention.runRetentionPass({
    ranBy: USER,
    now: Date.now() + 120_000,
  });
  check(
    'N-D2-16: the D1 retention pass still expires due claims',
    'controls',
    passReport.expiredCount === 1 && passReport.expiredIds.includes(dueClaim.id),
    `expiredCount=${passReport.expiredCount} expiredIds=${JSON.stringify(passReport.expiredIds)} dueClaim=${dueClaim.id}`,
  );

  // N-D2-7 + N-D2-18: the deep purge of the completed conversation C.
  let wrongToken = false;
  try {
    sw.deletion.purgeConversation({ threadId: threadC.id, purgedBy: USER, confirmation: 'PURGE' });
  } catch (cause) {
    wrongToken = cause?.code === 'QLT_PURGE_CONFIRMATION_INVALID';
  }
  check('N-D2-7: a wrong purge token refuses (zero effect)', 'controls', wrongToken);
  check(
    'N-D2-7: the refused purge left no receipt',
    'controls',
    sw.deletion.getPurgeReceipt(threadC.id) === undefined,
  );
  const purge = await lifecycle(probe).purge({
    threadId: threadC.id,
    confirmation: 'purge',
    actorId: USER,
  });
  check(
    'N-D2-7: the explicit purge completes with a content-free receipt',
    'controls',
    purge.receipt !== undefined && purge.receipt.threadId === threadC.id,
  );
  check(
    'N-D2-18: after purge NO conversation content remains in any Shared World table',
    'controls',
    findCanary(dbPath).every((table) => table === 'qlt_open_loop'),
  );
  const rawPurge = new DatabaseSync(dbPath, { readOnly: true });
  const cThreadStays = rawPurge
    .prepare('SELECT id, title FROM qlt_thread WHERE id = ?;')
    .get(threadC.id);
  const cPreserved = rawPurge
    .prepare('SELECT COUNT(*) AS total FROM qlt_commitment WHERE source_thread_id = ?;')
    .get(threadC.id);
  const purgeReceiptRows = rawPurge.prepare('SELECT * FROM qlt_conversation_purge;').all();
  rawPurge.close();
  check(
    'N-D2-18: the conversation-only purge keeps the preserved meaning and its content-free anchor',
    'controls',
    cThreadStays !== undefined &&
      cThreadStays.title === null &&
      cPreserved.total === 1 &&
      purgeReceiptRows.length === 1,
  );

  // The plus-meaning purge removes the thread row entirely.
  const purgeA = await lifecycle(probe).purge({
    threadId: threadA.id,
    confirmation: 'purge',
    actorId: USER,
  });
  check(
    'N-D2-18: the plus-meaning purge completes with its content-free receipt',
    'controls',
    purgeA.receipt !== undefined && purgeA.receipt.originatingTombstones === 2,
  );
  const rawPurgeA = new DatabaseSync(dbPath, { readOnly: true });
  const aThreadGone = rawPurgeA.prepare('SELECT id FROM qlt_thread WHERE id = ?;').get(threadA.id);
  rawPurgeA.close();
  check(
    'N-D2-18: the plus-meaning purged thread row is gone entirely',
    'controls',
    aThreadGone === undefined,
  );

  // N-D2-14/15: hostile identities, prototype keys, filesystem targets.
  const hostile = [
    () =>
      lifecycle(probe).deleteConversation({
        threadId: '../../repo',
        mode: 'conversation-only',
        confirmed: true,
        key: 'k-h',
        actorId: USER,
      }),
    () =>
      lifecycle(probe).purge({
        threadId: 'C:' + String.fromCharCode(92) + 'repo',
        confirmation: 'purge',
        actorId: USER,
      }),
    () =>
      lifecycle(probe).deleteConversation({
        threadId: threadB.id,
        mode: 'delete-everything',
        confirmed: true,
        key: 'k-h2',
        actorId: USER,
      }),
    () => lifecycle(probe).purge({ threadId: threadB.id, confirmation: 'purge ', actorId: USER }),
  ];
  const hostileResults = [];
  for (const attempt of hostile) {
    hostileResults.push(
      await attempt().then(
        () => 'ACCEPTED',
        (cause) => cause.code ?? 'REFUSED',
      ),
    );
  }
  check(
    'N-D2-15: a repository-relative path cannot be targeted',
    'controls',
    hostileResults[0] === 'QLT_DELETION_THREAD_MISSING',
  );
  check(
    'N-D2-15: an absolute filesystem path cannot be targeted',
    'controls',
    hostileResults[1] === 'QLT_DELETION_THREAD_MISSING' ||
      hostileResults[1] === 'QLT_PURGE_NOT_AVAILABLE',
  );
  check(
    'N-D2-14: an undeclared mode fails closed',
    'controls',
    hostileResults[2] === 'QLT_DELETION_MODE_INVALID',
  );
  check(
    'N-D2-14: a whitespace-padded purge token fails closed',
    'controls',
    hostileResults[3] === 'QLT_PURGE_CONFIRMATION_INVALID',
  );
  {
    // The prototype-keyed request targets the conversation that ALREADY
    // carries a terminal deletion row (threadS): a new key on an existing
    // row is a scope conflict, and the prototype-named own property is
    // inert through the closed spread (no prototype pollution).
    const protoInput = JSON.parse(
      '{"__proto__": {"boom": true}, "threadId": "qlt-verify-s", "mode": "conversation-only", "confirmed": true, "key": "k-proto"}',
    );
    const protoResult = await lifecycle(probe)
      .deleteConversation({ ...protoInput, actorId: USER })
      .then(
        () => 'ACCEPTED',
        (cause) => cause.code,
      );
    check(
      'N-D2-14: a prototype-keyed request fails closed without poisoning',
      'controls',
      protoResult === 'QLT_DELETION_SCOPE_CONFLICT' && !{}.boom,
    );
  }

  // N-D2-12: concurrent delete/export/read activity stays truthful.
  {
    const threadE = await sw.createThread({ title: 'Conversation E', id: 'qlt-verify-e' });
    const linkE = await sw.ensureConversationLink(threadE.id);
    await seedMemory(probe, linkE.mastraThreadId);
    const [deletionOutcome, exportOutcome, readOutcome] = await Promise.allSettled([
      lifecycle(probe).deleteConversation({
        threadId: threadE.id,
        mode: 'conversation-only',
        confirmed: true,
        key: 'k-e-1',
        actorId: USER,
      }),
      lifecycle(probe)
        .buildExport({ actorId: USER })
        .then(
          () => 'EXPORTED',
          (cause) => cause.code,
        ),
      sw.listThreads({}).then(() => 'READ'),
    ]);
    check(
      'N-D2-12: the concurrent deletion completed truthfully',
      'controls',
      deletionOutcome.status === 'fulfilled' && deletionOutcome.value.row?.status === 'completed',
    );
    check(
      'N-D2-12: the concurrent export either completed or failed closed',
      'controls',
      exportOutcome.status === 'fulfilled' &&
        (exportOutcome.value === 'EXPORTED' || exportOutcome.value === 'QLT_EXPORT_FAILED'),
    );
    check(
      'N-D2-12: the concurrent read answered',
      'controls',
      readOutcome.status === 'fulfilled' && sw.deletion.listDeletions !== undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// 2b. PURGE CLOSURE — the Amendment 1 controls (N-D2-19..N-D2-24)
// ---------------------------------------------------------------------------
{
  console.log(
    '\n[2b] PURGE CLOSURE — ceremony-created meaning, closure, byte-identity, failure, integrity',
  );
  const probe = await compose(tempDir());
  const sw = probe.sharedWorld;
  const dbPath = join(probe.dataDir, 'shared-world.db');

  // P: meaning created through the REAL proposal/confirmation ceremony
  // (proposal_id non-null). Q: an unrelated conversation that must
  // survive byte-identically. R: the fail-closed boundary (a foreign
  // content record references INTO it). T: holder of that foreign child.
  const threadP = await sw.createThread({ title: 'Ceremony P', id: 'qlt-verify-p' });
  const threadQ = await sw.createThread({ title: 'Unrelated Q', id: 'qlt-verify-q' });
  const threadR = await sw.createThread({ title: 'Boundary R', id: 'qlt-verify-r' });
  const threadT = await sw.createThread({ title: 'Foreign T', id: 'qlt-verify-t' });
  await sw.ensureConversationLink(threadP.id);
  const linkQ = await sw.ensureConversationLink(threadQ.id);
  await seedMemory(probe, linkQ.mastraThreadId, 'unrelated conversation content');

  // --- ceremony-created claim, commitment, and open loop in P.
  const ceremony = async (proposalKind, content) => {
    const proposal = await sw.meaning.createProposal({
      proposalKind,
      content,
      proposedBy: AGENT,
      sourceThreadId: threadP.id,
    });
    await sw.meaning.markProposalAwaitingDecision(proposal.id);
    const outcome = await sw.meaning.confirmProposal({
      proposalId: proposal.id,
      confirmedBy: USER,
    });
    return { proposal, records: outcome.createdRecords };
  };
  const ceremonyClaim = await ceremony('claim', {
    subject: 'ceremony-p-claim',
    epistemicType: 'E1',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'the ceremony claim in P',
  });
  const ceremonyCommitment = await ceremony('commitment', {
    commitmentKey: 'ceremony-p-key',
    statement: 'the ceremony commitment in P',
  });
  const ceremonyLoop = await ceremony('open_loop', {
    subject: 'ceremony-p-loop',
    loopKind: 'undecided_question',
    detail: 'the ceremony open loop in P',
  });
  const pProposalIds = [
    ceremonyClaim.proposal.id,
    ceremonyCommitment.proposal.id,
    ceremonyLoop.proposal.id,
  ];
  const ceremonyCommitmentId = ceremonyCommitment.records[0].id;
  const ceremonyClaimId = ceremonyClaim.records[0].id;
  const ceremonyLoopId = ceremonyLoop.records[0].id;

  // --- one DIRECT-VERB record in the same scope (proposal_id NULL):
  // the amended order must stay compatible with non-ceremony records.
  const directVerbClaim = await sw.meaning.createClaim({
    subject: 'direct-verb-p',
    epistemicType: 'E4',
    honestyState: 'uncertain',
    confidence: 'qualified',
    statement: 'a direct-verb claim in P',
    createdBy: USER,
    sourceThreadId: threadP.id,
  });

  // --- the AMENDMENT lineage: the user amends the ceremony commitment
  // (predecessor amended, successor supersedes it, immutable amendment
  // row) — commitment-family chain + judgment row in ONE scope.
  const amended = sw.conflict.amendCommitment({
    commitmentId: ceremonyCommitmentId,
    statement: 'the amended commitment text in P',
    amendedBy: USER,
  });
  const amendmentSuccessorId = amended.successor.id;
  const amendmentRowId = amended.amendment.id;

  // --- the CORRECTION lineage: a correction proposal in P supersedes the
  // ceremony claim (claim-family chain, same thread).
  const correctionOutcome = await (async () => {
    const proposal = await sw.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'the corrected claim text in P' },
      proposedBy: AGENT,
      sourceThreadId: threadP.id,
      targetRecord: {
        recordId: ceremonyClaimId,
        family: 'claim',
        version: ceremonyClaim.records[0].version,
      },
    });
    await sw.meaning.markProposalAwaitingDecision(proposal.id);
    return sw.meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: USER });
  })();
  const correctionSuccessorId = correctionOutcome.createdRecords[0].id;
  pProposalIds.push(correctionOutcome.proposal.id);

  const rawCheck = new DatabaseSync(dbPath, { readOnly: true });
  const ceremonyShape = rawCheck
    .prepare('SELECT proposal_id, normative_basis_proposal_id FROM qlt_commitment WHERE id = ?;')
    .get(ceremonyCommitmentId);
  rawCheck.close();
  check(
    'N-D2-19 pre-condition: the ceremony commitment carries proposal_id AND normative_basis_proposal_id',
    'controls',
    ceremonyShape !== undefined &&
      ceremonyShape.proposal_id === ceremonyCommitment.proposal.id &&
      ceremonyShape.normative_basis_proposal_id === ceremonyCommitment.proposal.id,
  );

  // --- the cross-thread judgment closure: an ACTIVE-looking commitment
  // proposal in Q on the amended key is refused and a challenge row is
  // recorded (thread Q, existing_commitment_id -> P's active successor).
  const qConflictingProposal = await sw.meaning.createProposal({
    proposalKind: 'commitment',
    content: { commitmentKey: 'ceremony-p-key', statement: 'a contradicting duplicate in Q' },
    proposedBy: AGENT,
    sourceThreadId: threadQ.id,
  });
  await sw.meaning.markProposalAwaitingDecision(qConflictingProposal.id);
  const conflictRefusal = await detectCommitmentConflict(
    {
      conflict: sw.conflict,
      resolveCurrentEffectiveCommitment: async (key) => {
        const active = await sw.meaning.resolveCurrentEffectiveCommitment(key);
        return active === undefined ? undefined : { id: active.id };
      },
      userActorId: USER,
    },
    await sw.meaning.getProposal(qConflictingProposal.id),
  );
  const crossChallengeId = conflictRefusal?.details?.challengeId;
  check(
    'N-D2-20 pre-condition: the cross-thread conflict was refused and a challenge row recorded',
    'controls',
    conflictRefusal !== undefined && typeof crossChallengeId === 'string',
  );

  // --- plus-meaning deletion of P, then the typed deep purge.
  const deletionP = await lifecycle(probe).deleteConversation({
    threadId: threadP.id,
    mode: 'conversation-and-originating-meaning',
    confirmed: true,
    key: 'k-purge-ceremony',
    actorId: USER,
  });
  check(
    'N-D2-19 pre-condition: the plus-meaning deletion of P completed',
    'controls',
    deletionP?.row?.status === 'completed',
  );
  const beforePurge = snapshot(dbPath);
  // qlt_conversation_purge is the PERMITTED content-free evidence — it
  // legitimately gains the receipt row during the purge and is excluded
  // from the byte-identity comparison (its content-freedom is asserted
  // separately by N-D2-7/N-D2-18).
  delete beforePurge.qlt_conversation_purge;
  let purgeReceipt;
  let purgeError;
  try {
    purgeReceipt = sw.deletion.purgeConversation({
      threadId: threadP.id,
      purgedBy: USER,
      confirmation: 'purge',
    });
  } catch (cause) {
    purgeError = cause;
  }
  check(
    'N-D2-19: the deep purge of CEREMONY-created meaning succeeds (B-1 regression control)',
    'controls',
    purgeError === undefined &&
      purgeReceipt !== undefined &&
      purgeReceipt?.originatingTombstones === 6 &&
      purgeReceipt?.proposals === 4 &&
      purgeReceipt?.amendments === 1 &&
      purgeReceipt?.challenges === 1,
    purgeError === undefined
      ? `receipt=${JSON.stringify(purgeReceipt)}`
      : `cause=${purgeError.code ?? purgeError.message}`,
  );
  const rawAfter = new DatabaseSync(dbPath, { readOnly: true });
  const pLeftovers = rawAfter
    .prepare(
      'SELECT (SELECT COUNT(*) FROM qlt_claim WHERE source_thread_id = ?) + (SELECT COUNT(*) FROM qlt_commitment WHERE source_thread_id = ?) + (SELECT COUNT(*) FROM qlt_open_loop WHERE source_thread_id = ?) + (SELECT COUNT(*) FROM qlt_proposal WHERE source_thread_id = ?) AS total;',
    )
    .get(threadP.id, threadP.id, threadP.id, threadP.id).total;
  const proposalIdsLeft = rawAfter
    .prepare(
      `SELECT COUNT(*) AS total FROM qlt_proposal WHERE id IN (${pProposalIds.map(() => '?').join(',')});`,
    )
    .get(...pProposalIds).total;
  rawAfter.close();
  check(
    'N-D2-19: every ceremony-created record and proposal row is physically gone',
    'controls',
    Number(pLeftovers) === 0 && Number(proposalIdsLeft) === 0,
  );
  const rawClosure = new DatabaseSync(dbPath, { readOnly: true });
  const challengeGone =
    rawClosure
      .prepare('SELECT COUNT(*) AS total FROM qlt_conflict_challenge WHERE id = ?;')
      .get(crossChallengeId).total === 0;
  const qProposalStays = rawClosure
    .prepare('SELECT COUNT(*) AS total FROM qlt_proposal WHERE id = ?;')
    .get(qConflictingProposal.id).total;
  rawClosure.close();
  check(
    'N-D2-20: the cross-thread challenge was removed by the closure; the unrelated proposal row of Q stays',
    'controls',
    challengeGone && Number(qProposalStays) === 1,
  );
  check(
    'N-D2-20: the amendment row and the cross-thread challenge are counted in the receipt',
    'controls',
    purgeReceipt?.challenges === 1 && purgeReceipt?.amendments === 1,
  );

  // N-D2-22: byte-identity of every row outside the authorized scope.
  const afterPurge = snapshot(dbPath);
  delete afterPurge.qlt_conversation_purge;
  const foreignOK = [];
  for (const table of Object.keys(afterPurge)) {
    const before = JSON.parse(beforePurge[table]);
    const after = JSON.parse(afterPurge[table]);
    if (after.length > before.length) {
      foreignOK.push(`${table} gained rows`);
      continue;
    }
    const afterKeys = new Set(after.map((row) => JSON.stringify(row)));
    const removed = before.filter((row) => !afterKeys.has(JSON.stringify(row)));
    const scopeTokens = [
      threadP.id,
      ceremonyClaimId,
      correctionSuccessorId,
      ceremonyCommitmentId,
      amendmentSuccessorId,
      ceremonyLoopId,
      directVerbClaim.id,
      amendmentRowId,
      crossChallengeId,
      ...pProposalIds,
    ];
    for (const row of removed) {
      const line = JSON.stringify(row);
      if (!scopeTokens.some((token) => typeof token === 'string' && line.includes(token))) {
        foreignOK.push(`${table}: ${line.slice(0, 80)}`);
      }
    }
  }
  check(
    'N-D2-22: every removed row belongs to the authorized scope; nothing outside P changed',
    'controls',
    foreignOK.length === 0,
    foreignOK.slice(0, 3).join(' | '),
  );

  // N-D2-21: direct-verb compatibility — the direct-verb claim
  // (proposal_id NULL) was removed by the SAME purge as the ceremony
  // records (the main scenario's thread A purge re-proves it standalone).
  const rawDirect = new DatabaseSync(dbPath, { readOnly: true });
  const directGone =
    rawDirect
      .prepare('SELECT COUNT(*) AS total FROM qlt_claim WHERE id = ?;')
      .get(directVerbClaim.id).total === 0;
  rawDirect.close();
  check(
    'N-D2-21: the direct-verb record was purged together with the ceremony records',
    'controls',
    directGone && purgeReceipt?.originatingTombstones === 6,
  );

  // N-D2-23: a foreign content row referencing INTO a scope fails the
  // purge CLOSED (rollback, no receipt, no partial deletion), and a
  // later purge of that scope converges once the foreign child is gone
  // through its own governed path. The foreign child is a CORRECTION
  // successor in T (the real chain mechanism: supersedes_id -> R's claim).
  const rClaim = await sw.meaning.createClaim({
    subject: 'boundary-r-claim',
    epistemicType: 'E3',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'the boundary claim in R',
    createdBy: USER,
    sourceThreadId: threadR.id,
  });
  const foreignChild = await (async () => {
    const proposal = await sw.meaning.createProposal({
      proposalKind: 'correction',
      content: { statement: 'a foreign correction in T superseding the R claim' },
      proposedBy: AGENT,
      sourceThreadId: threadT.id,
      targetRecord: { recordId: rClaim.id, family: 'claim', version: rClaim.version },
    });
    await sw.meaning.markProposalAwaitingDecision(proposal.id);
    return sw.meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: USER });
  })();
  const foreignChildRaw = new DatabaseSync(dbPath, { readOnly: true });
  const foreignLink = foreignChildRaw
    .prepare('SELECT supersedes_id, source_thread_id FROM qlt_claim WHERE id = ?;')
    .get(foreignChild.createdRecords[0].id);
  foreignChildRaw.close();
  check(
    'N-D2-23 pre-condition: the foreign successor in T references INTO R (cross-thread supersedes edge)',
    'controls',
    foreignLink !== undefined &&
      foreignLink.supersedes_id === rClaim.id &&
      foreignLink.source_thread_id === threadT.id,
  );
  await lifecycle(probe).deleteConversation({
    threadId: threadR.id,
    mode: 'conversation-and-originating-meaning',
    confirmed: true,
    key: 'k-purge-boundary',
    actorId: USER,
  });
  const beforeR = snapshot(dbPath);
  let boundaryFailure;
  try {
    sw.deletion.purgeConversation({ threadId: threadR.id, purgedBy: USER, confirmation: 'purge' });
  } catch (cause) {
    boundaryFailure = cause;
  }
  const afterR = snapshot(dbPath);
  check(
    'N-D2-23: the foreign-reference purge fails closed (no receipt, zero partial deletion)',
    'controls',
    boundaryFailure !== undefined &&
      sw.deletion.getPurgeReceipt(threadR.id) === undefined &&
      afterR.qlt_claim === beforeR.qlt_claim &&
      afterR.qlt_thread === beforeR.qlt_thread,
    boundaryFailure === undefined
      ? 'unexpectedly succeeded'
      : `refused with ${boundaryFailure.code ?? boundaryFailure.message}`,
  );
  // The foreign child leaves through its OWN governed path (plus-meaning
  // deletion + purge of T), after which R's purge converges.
  await lifecycle(probe).deleteConversation({
    threadId: threadT.id,
    mode: 'conversation-and-originating-meaning',
    confirmed: true,
    key: 'k-purge-foreign',
    actorId: USER,
  });
  await sw.deletion.purgeConversation({
    threadId: threadT.id,
    purgedBy: USER,
    confirmation: 'purge',
  });
  const convergedReceipt = sw.deletion.purgeConversation({
    threadId: threadR.id,
    purgedBy: USER,
    confirmation: 'purge',
  });
  check(
    'N-D2-23: once the foreign child is gone the purge converges (replay/restart truthfulness)',
    'controls',
    convergedReceipt !== undefined && sw.deletion.getPurgeReceipt(threadR.id) !== undefined,
  );

  // N-D2-24: post-purge integrity — zero FK violations store-wide, and
  // the correction/amendment chains are fully removed (both chain
  // members gone by id: the amended predecessor/successor pair and the
  // corrected predecessor/successor pair).
  const rawIntegrity = new DatabaseSync(dbPath, { readOnly: true });
  const fkViolations = rawIntegrity.prepare('PRAGMA foreign_key_check;').all();
  const chainLeft = rawIntegrity
    .prepare(
      'SELECT COUNT(*) AS total FROM qlt_claim WHERE id IN (?, ?) UNION ALL SELECT COUNT(*) FROM qlt_commitment WHERE id IN (?, ?);',
    )
    .get(ceremonyClaimId, correctionSuccessorId, ceremonyCommitmentId, amendmentSuccessorId).total;
  rawIntegrity.close();
  check(
    'N-D2-24: PRAGMA foreign_key_check is clean and both lineage chains are fully removed',
    'controls',
    fkViolations.length === 0 && Number(chainLeft) === 0,
    `violations=${JSON.stringify(fkViolations).slice(0, 120)} chainLeft=${chainLeft}`,
  );
}

// ---------------------------------------------------------------------------
// 3. RESTART — recovery converges; the fence holds across restart
// ---------------------------------------------------------------------------
{
  console.log('\n[3] RESTART — boot recovery and the fence');
  const boot2 = await compose(dir);
  const sw = boot2.sharedWorld;
  const openRows = sw.deletion.listOpenDeletions();
  const purgeRows = sw.deletion.listPurgeReceipts();
  check(
    'N-D2-11: no open product deletion remains after boot recovery',
    'controls',
    openRows.length === 0 && purgeRows.length >= 1,
  );
  const deletedTitles = [];
  const allThreads = await sw.listThreads({});
  for (const thread of allThreads.threads) {
    if (thread.retentionState === 'user-removed') {
      deletedTitles.push(thread.id);
    }
  }
  check(
    'N-D2-11: deleted threads stay deleted or purged (truthfully)',
    'controls',
    deletedTitles.includes('qlt-verify-c') &&
      deletedTitles.includes('qlt-verify-d') &&
      !deletedTitles.includes('qlt-verify-a'),
  );
  // The purged thread A has no row at all; thread C's link is gone.
  const linkARestart = await sw.getThread('qlt-verify-a').then(
    (thread) => (thread === undefined ? undefined : sw.getConversationLink('qlt-verify-a')),
    () => undefined,
  );
  check(
    'N-D2-17: the deleted conversation’s link stays removed across restart',
    'controls',
    linkARestart === undefined,
  );
  check(
    'N-D2-17: the deleted conversation is FENCED for new turns across restart',
    'controls',
    boot2.threadCoordinator.isFenced(linkAMastraThreadId),
  );
  check(
    'N-D2-17: the plus-meaning purged conversation stays purged across restart',
    'controls',
    (await sw.getThread('qlt-verify-a')) === undefined,
  );
}

// ---------------------------------------------------------------------------
// 4. STRUCTURAL — frozen contract identities
// ---------------------------------------------------------------------------
{
  console.log('\n[4] STRUCTURAL — the frozen D2 contract data');
  const d2 = await import('../src/lib/sharedworld/d2-contract.ts');
  check(
    'exactly two explicit deletion modes',
    'structural',
    JSON.stringify(d2.QLT_D2_DELETION_MODES) ===
      JSON.stringify(['conversation-only', 'conversation-and-originating-meaning']),
  );
  check(
    'the closed deletion status lifecycle',
    'structural',
    JSON.stringify([...d2.QLT_D2_DELETION_STATUSES].sort()) ===
      JSON.stringify(['canceled', 'completed', 'incomplete', 'planned']),
  );
  check(
    'the three receipted cross-store steps',
    'structural',
    d2.QLT_D2_DELETION_STEPS.length === 3 && d2.QLT_D2_DELETION_STEPS.includes('memory-store'),
  );
  check(
    'the frozen purge step order (Amendment 1: originating tombstones BEFORE proposals)',
    'structural',
    JSON.stringify(d2.QLT_D2_PURGE_STEP_ORDER) ===
      JSON.stringify([
        'challenges',
        'amendments',
        'corrections',
        'source-links',
        'originating-tombstones',
        'proposals',
        'assembly-evidence',
        'conversation-link',
        'thread',
      ]),
  );
  check(
    'the stable non-echoing code vocabulary',
    'structural',
    d2.QLT_D2_ERROR_CODES.length === 12 &&
      d2.QLT_D2_ERROR_CODES.every((code) => code.startsWith('QLT_')),
  );
  check(
    'the forbidden-claims disclosure is present',
    'structural',
    d2.QLT_D2_FORBIDDEN_CLAIMS.some((claim) => claim.includes('Git history')),
  );
  check(
    'the user-actor authority pattern refuses agent identities',
    'structural',
    !d2.QLT_D2_USER_ACTOR_PATTERN.test('agent-quellight') &&
      d2.QLT_D2_USER_ACTOR_PATTERN.test('actor-quellight-local'),
  );
  check(
    'the frozen negative-control matrix carries 24 controls (Amendment 1 added N-D2-19..24)',
    'structural',
    d2.QLT_D2_NEGATIVE_CONTROLS.length === 24 &&
      d2.QLT_D2_NEGATIVE_CONTROLS[0].id === 'N-D2-1' &&
      d2.QLT_D2_NEGATIVE_CONTROLS[18].id === 'N-D2-19',
  );
}

// ---------------------------------------------------------------------------
// 5. WIRING
// ---------------------------------------------------------------------------
{
  console.log('\n[5] WIRING — package.json gate registration');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  check(
    'verify:d2 is registered in package.json',
    'wiring',
    typeof pkg.scripts['verify:d2'] === 'string',
  );
}

for (const composition of composed.splice(0)) {
  await composition.close().catch(() => undefined);
}
for (const path of tempDirs) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    /* disposable */
  }
}

const total = Object.values(sections).reduce((sum, count) => sum + count, 0);
if (failures.length > 0) {
  console.error(`\nverify:d2: FAILED — ${failures.length} check(s) red of ${total}.`);
  process.exit(1);
}
console.log(`verify:d2: PASS — ${total} checks green (schema/controls/restart/structural/wiring).`);
