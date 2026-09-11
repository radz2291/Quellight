import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

// The ONLY non-local action ingress of the application. Stage 07C Phase
// Q1: a thin transport boundary — it parses the DECLARED request (closed
// field set), resolves the existing local user identity server-side, and
// invokes the released VICT 0.2.0 governed mutation/query boundary. It
// never writes SQLite, never calls an adapter through a parallel
// shortcut, and never invents an undeclared mutation field.
export const POST: RequestHandler = async ({ request }) => {
  const app = getAppServer();
  let body: { actionId?: unknown; input?: unknown; idempotencyKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(
      { ok: false, code: 'INVALID_REQUEST', message: 'The request body must be JSON.' },
      { status: 400 },
    );
  }
  if (typeof body.actionId !== 'string' || body.actionId.length === 0) {
    return json(
      { ok: false, code: 'INVALID_REQUEST', message: 'actionId is required.' },
      { status: 400 },
    );
  }
  const result = await app.dispatch(body.actionId, body.input, body.idempotencyKey);
  return json(result);
};
