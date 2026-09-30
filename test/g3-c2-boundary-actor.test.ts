/**
 * Stage 9 G3-C2 (owner-decision OD-R4): the second boundary actor and the
 * actor-derived inspection grant.
 *
 * S1 — the boundary authenticator resolves TWO token entries to DISTINCT
 *      authoritative actor contexts (operator + agent-context), and the
 *      actor contexts differ (distinct actorId / roles / scopes / resource
 *      identity);
 * S2 — the inspection permission is ACTOR-DERIVED at Quellight's read
 *      boundary: the operator actor keeps its exact released granted
 *      surface while the agent-context actor resolves WITHOUT
 *      `qlt.inspection.read` and is REFUSED by Quellight's own
 *      authorization with the stable `DATA_UNAUTHORIZED` outcome code;
 * S4 — the operator whoami/inspect behavior is unchanged and the inspect
 *      answers stay actor-independent (the frozen health/compatibility
 *      inspect bodies are identical for both tokens).
 *
 * Everything crosses REAL released machinery — the loopback HTTP boundary
 * for the wire demos, the composed boundary authenticator plus the
 * released `app.data.query` command boundary for the inspection surface
 * (exactly the machinery the browser proxy drives) — no client-side
 * simulation anywhere.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AGENT_CONTEXT_ACTOR_ID,
  LOCAL_ACTOR_ID,
  createQuellightComposition,
  resolveQuellightEnvironment,
} from '../src/lib/server/composition';

const TOKEN_OP = `g3c2-op-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;
const TOKEN_AGENT = `g3c2-agent-${crypto.randomUUID().replace(/-/g, '')}${Date.now()}`;

const tempDirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-g3c2-'));
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

async function compose() {
  const dir = tempDir();
  const env = resolveQuellightEnvironment(
    {
      QUELLIGHT_DATA_DIR: 'data',
      QUELLIGHT_ACTOR_TOKEN: TOKEN_OP,
      QUELLIGHT_AGENT_ACTOR_TOKEN: TOKEN_AGENT,
    },
    dir,
  );
  const composition = await createQuellightComposition({ env });
  composed.push(composition);
  const port = await composition.listen();
  return { composition, port, origin: `http://127.0.0.1:${port}`, env };
}

const requestAs = async (
  origin: string,
  token: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as Record<string, unknown> };
};

const inspectQuery = (
  composition: Awaited<ReturnType<typeof compose>>['composition'],
  actor: Awaited<ReturnType<typeof composition.resolveBoundaryActor>>,
): Promise<{ ok: boolean; code?: string } & Record<string, unknown>> =>
  composition.commandService.dispatch(actor, {
    command: 'app.data.query',
    payload: {
      resourceId: 'qlt.inspection',
      releaseVersion: composition.releaseVersion,
      filters: { query: 'listRecords', bucket: 'current' },
    },
  }) as Promise<{ ok: boolean; code?: string } & Record<string, unknown>>;

describe('Stage 9 G3-C2 (OD-R4): second boundary actor + actor-derived inspection grant', () => {
  it('S1: the two boundary tokens resolve DIFFERENT authoritative actor contexts (whoami diff non-empty)', async () => {
    const { composition, origin, env } = await compose();
    expect(env.actorToken).not.toBe(env.agentActorToken);

    // Wire-level whoami for BOTH tokens through the REAL loopback boundary.
    const operator = await requestAs(origin, env.actorToken, '/vict/v1/actor/whoami');
    const agentContext = await requestAs(origin, env.agentActorToken, '/vict/v1/actor/whoami');
    expect(operator.status).toBe(200);
    expect(agentContext.status).toBe(200);
    const operatorData = operator.body.data as Record<string, unknown>;
    const agentData = agentContext.body.data as Record<string, unknown>;

    expect(operatorData.actorId).toBe(LOCAL_ACTOR_ID);
    expect(agentData.actorId).toBe(AGENT_CONTEXT_ACTOR_ID);
    expect(operatorData.actorId).not.toBe(agentData.actorId);
    expect(agentData.mastraResourceId).not.toBe(operatorData.mastraResourceId);
    expect((agentData.roles as string[]).sort().join(',')).not.toBe(
      (operatorData.roles as string[]).sort().join(','),
    );
    const agentScopes = agentData.scopes as string[];
    expect(agentScopes.includes('app.data.read')).toBe(true);
    expect(agentScopes.includes('run.read')).toBe(true);
    expect(agentScopes.includes('app.data.write')).toBe(false);
    expect(agentScopes.includes('operator.resolve')).toBe(false);
    const operatorScopes = operatorData.scopes as string[];
    expect(operatorScopes.includes('app.data.write')).toBe(true);

    // The same two entries through the composed authenticator machinery.
    const resolvedOperator = await composition.resolveBoundaryActor(env.actorToken);
    const resolvedAgent = await composition.resolveBoundaryActor(env.agentActorToken);
    expect(resolvedOperator.actorId).toBe(LOCAL_ACTOR_ID);
    expect(resolvedAgent.actorId).toBe(AGENT_CONTEXT_ACTOR_ID);
    expect(resolvedAgent.roles).toEqual(['developer']);
  });

  it('S2: the agent-context actor is REFUSED on the operator inspection surface by Quellight\u2019s own authorization (stable outcome code); the SAME surface succeeds under the operator token', async () => {
    const { composition, env } = await compose();
    // The REAL boundary authenticator resolves each presented token; the
    // released `app.data.query` command boundary then runs under each
    // authoritative context (the exact machinery the browser proxy drives).
    const agentActor = await composition.resolveBoundaryActor(env.agentActorToken);
    const operatorActor = await composition.resolveBoundaryActor(env.actorToken);
    expect(agentActor.actorId).toBe(AGENT_CONTEXT_ACTOR_ID);

    const refusedOutcome = await inspectQuery(composition, agentActor);
    expect(refusedOutcome.ok).toBe(true); // the command itself executes; the refusal is inside the app-data result
    const refused = (refusedOutcome.data as { result: { ok: boolean; code?: string } }).result;
    // The truthful stable outcome code of Quellight's own inspection
    // authorization, refused INSIDE Quellight (never simulated).
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe('DATA_UNAUTHORIZED');

    const allowedOutcome = await inspectQuery(composition, operatorActor);
    const allowed = (allowedOutcome.data as { result: { ok: boolean } }).result;
    expect(allowed.ok).toBe(true);
  });

  it('S4: the inspect answers are actor-independent (byte-identical between the two tokens) and the operator whoami shape is unchanged', async () => {
    const { origin, env } = await compose();
    const healthOp = await requestAs(origin, env.actorToken, '/vict/v1/health');
    const healthAgent = await requestAs(origin, env.agentActorToken, '/vict/v1/health');
    expect(healthOp).toEqual(healthAgent);
    const compatOp = await requestAs(origin, env.actorToken, '/vict/v1/compatibility');
    const compatAgent = await requestAs(origin, env.agentActorToken, '/vict/v1/compatibility');
    expect(compatOp).toEqual(compatAgent);

    // The operator whoami carries the SAME released four fields.
    const operatorWhoami = await requestAs(origin, env.actorToken, '/vict/v1/actor/whoami');
    expect(Object.keys(operatorWhoami.body.data as object).sort()).toEqual([
      'actorId',
      'mastraResourceId',
      'roles',
      'scopes',
    ]);
    expect((operatorWhoami.body.data as Record<string, unknown>).actorId).toBe(LOCAL_ACTOR_ID);
  });
});
