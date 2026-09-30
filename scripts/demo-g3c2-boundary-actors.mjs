#!/usr/bin/env node
/**
 * Stage 9 G3-C2 (owner-decision OD-R4) LIVE DEMO EVIDENCE — offline
 * deterministic mode (never a live provider).
 *
 * Runs the incremented app through its OWN machinery and records the three
 * contract demonstrations over the REAL boundaries:
 *   1. whoami DIFF for the two boundary tokens (distinct actorIds).
 *   2. agent-context token attempting the operator inspection surface →
 *      REFUSED by Quellight's own authorization (stable DATA_UNAUTHORIZED).
 *   3. the SAME inspection surface under the operator token → succeeds.
 * Plus: ONE real turn through the product admission boundary (agent.turn.
 * start over the loopback boundary under the operator token, offline
 * deterministic fixture), and actor-independent inspect answers.
 *
 * Tokens are generated in-process and REDACTED from every printed line
 * (only their kind/entry position is disclosed); no token value is pasted,
 * logged, or persisted.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition.ts';

const OP_TOKEN = `g3c2-demo-op-${randomUUID().replace(/-/g, '')}`;
const AGENT_TOKEN = `g3c2-demo-agent-${randomUUID().replace(/-/g, '')}`;

const redact = (value) =>
  value
    .replaceAll(OP_TOKEN, '<OP-TOKEN-REDACTED>')
    .replaceAll(AGENT_TOKEN, '<AGENT-TOKEN-REDACTED>');
const emit = (label, value) => {
  console.log(`\n=== ${label} ===`);
  console.log(redact(typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
};

const dir = mkdtempSync(join(tmpdir(), 'qlt-g3c2-demo-'));
const env = resolveQuellightEnvironment(
  {
    QUELLIGHT_DATA_DIR: 'data',
    QUELLIGHT_ACTOR_TOKEN: OP_TOKEN,
    QUELLIGHT_AGENT_ACTOR_TOKEN: AGENT_TOKEN,
  },
  dir,
);
const composition = await createQuellightComposition({ env });
const port = await composition.listen();
const origin = `http://127.0.0.1:${port}`;

const wire = async (token, path, body) => {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return `HTTP ${response.status}\n${text}`;
};

// ---- REAL product turn through the admission boundary (offline fixture) ----
{
  const thread = await composition.sharedWorld.createThread({ title: 'G3-C2 demo thread' });
  const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
  const startResponse = await fetch(`${origin}/vict/v1/turns`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${OP_TOKEN}`,
      'content-type': 'application/json',
      'idempotency-key': 'g3c2-demo-turn-1',
    },
    body: JSON.stringify({
      schema: 'vict.command@1',
      payload: {
        threadId: conversation.mastraThreadId,
        input: 'What memory is relevant to this conversation?',
        applicationReleaseVersion: composition.releaseVersion,
      },
    }),
  });
  const started = await startResponse.json();
  const turnId = started?.data?.turnId;
  if (typeof turnId !== 'string') {
    throw new Error(`turn start failed: ${startResponse.status} ${JSON.stringify(started)}`);
  }
  // Await the deterministic terminal state.
  let status;
  for (let i = 0; i < 200 && status !== 'completed' && status !== 'failed'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    status = (await composition.stores.turns.getTurn(turnId))?.status;
  }
  if (status !== 'completed') {
    throw new Error(`demo turn did not complete (status: ${String(status)})`);
  }
  const turn = await composition.commandService.dispatch(
    await composition.resolveBoundaryActor(OP_TOKEN),
    { command: 'agent.turn.get', payload: { turnId } },
  );
  emit(
    'PRODUCT PROOF — real turn via admission (method POST /vict/v1/turns, authorization header PRESENT, value REDACTED)',
    {
      startResponse: { status: startResponse.status, body: started },
      terminalStatus: status,
      recordedTurn: turn,
    },
  );
}

// ---- Demo 1: whoami for BOTH tokens (method GET /vict/v1/actor/whoami) ------
emit(
  'DEMO 1a — operator token, GET /vict/v1/actor/whoami (authorization header PRESENT, value REDACTED)',
  await wire(OP_TOKEN, '/vict/v1/actor/whoami'),
);
emit(
  'DEMO 1b — agent-context token, GET /vict/v1/actor/whoami (authorization header PRESENT, value REDACTED)',
  await wire(AGENT_TOKEN, '/vict/v1/actor/whoami'),
);

// ---- Demo 2/3: the inspection surface under each identity ------------------
// The released app.data.query GET transport carries query-param strings
// only, so the bounded object filter container crosses the IDENTICAL
// in-process released command boundary the SvelteKit proxy drives (the
// same composition, the same dispatch) — never a client-side simulation.
const inspectAttempt = async (token) => {
  const actor = await composition.resolveBoundaryActor(token);
  const outcome = await composition.commandService.dispatch(actor, {
    command: 'app.data.query',
    payload: {
      resourceId: 'qlt.inspection',
      releaseVersion: composition.releaseVersion,
      filters: { query: 'listRecords', bucket: 'current' },
    },
  });
  return redact(JSON.stringify(outcome, null, 2));
};

const agentInspect = await inspectAttempt(AGENT_TOKEN);
emit(
  'DEMO 2 — agent-context token, app.data.query on qlt.inspection (REFUSED by Quellight\u2019s own authorization; authorization resolved through the boundary authenticator)',
  agentInspect,
);

const operatorInspect = await inspectAttempt(OP_TOKEN);
emit(
  'DEMO 3 — operator token, the SAME surface (SUCCEEDS; inspect answers actor-independent)',
  operatorInspect,
);

// ---- Actor-independent inspect answers (S4, wire, both tokens) --------------
emit('S4 — health.inspect under BOTH tokens (byte-identical; GET /vict/v1/health)', {
  operator: await wire(OP_TOKEN, '/vict/v1/health'),
  'agent-context': await wire(AGENT_TOKEN, '/vict/v1/health'),
});
emit('S4 — compatibility.inspect under BOTH tokens (byte-identical; GET /vict/v1/compatibility)', {
  operator: await wire(OP_TOKEN, '/vict/v1/compatibility'),
  'agent-context': await wire(AGENT_TOKEN, '/vict/v1/compatibility'),
});

await composition.close();
console.log('\nDEMO COMPLETE');
