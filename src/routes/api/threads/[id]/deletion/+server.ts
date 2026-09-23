import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import { QLT_D2_DELETION_MODES, type QltD2DeletionMode } from '$lib/sharedworld/d2-contract';
import type { RequestHandler } from './$types';

/**
 * The D2 governed conversation-deletion route (safety contract
 * `quellight.stage07d.d2.safety-contract@2`).
 *
 * - GET  (no body): the pure, deterministic preview (no durable row).
 * - POST: the CONFIRMED governed deletion. The request must carry
 *   `mode` (one of the two explicit user choices), `confirmed: true`,
 *   and a bounded idempotency key. The server derives the actor identity;
 *   the browser never supplies one. Cancellation has its own route.
 * - DELETE: cancel a PLANNED deletion (zero store effect).
 * - Errors are stable, non-echoing codes; no store content, credential,
 *   or path ever reaches the client.
 */

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function codeOf(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'QLT_DELETION_INCOMPLETE';
}

export const GET: RequestHandler = async ({ params, request }) => {
  const url = new URL(request.url);
  const modeParam = url.searchParams.get('mode') ?? 'conversation-only';
  if (!(QLT_D2_DELETION_MODES as readonly string[]).includes(modeParam)) {
    return json({ ok: false, code: 'QLT_DELETION_MODE_INVALID' }, { status: 400 });
  }
  if (typeof params.id !== 'string' || !SAFE_ID.test(params.id)) {
    return json({ ok: false, code: 'QLT_DELETION_THREAD_MISSING' }, { status: 404 });
  }
  try {
    const app = getAppServer();
    const composition = await app.composition();
    const preview = await composition.conversationLifecycle.preview({
      threadId: params.id,
      mode: modeParam as QltD2DeletionMode,
      actorId: composition.actorId,
    });
    return json({ ok: true, value: preview });
  } catch (cause) {
    return json({ ok: false, code: codeOf(cause) }, { status: 400 });
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  let body: { mode?: unknown; confirmed?: unknown; key?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (
    typeof body.mode !== 'string' ||
    !(QLT_D2_DELETION_MODES as readonly string[]).includes(body.mode)
  ) {
    return json({ ok: false, code: 'QLT_DELETION_MODE_INVALID' }, { status: 400 });
  }
  if (typeof body.key !== 'string' || !SAFE_KEY.test(body.key)) {
    return json({ ok: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (typeof params.id !== 'string' || !SAFE_ID.test(params.id)) {
    return json({ ok: false, code: 'QLT_DELETION_THREAD_MISSING' }, { status: 404 });
  }
  try {
    const app = getAppServer();
    const composition = await app.composition();
    const status = await composition.conversationLifecycle.deleteConversation({
      threadId: params.id,
      mode: body.mode as QltD2DeletionMode,
      confirmed: body.confirmed === true,
      key: body.key,
      actorId: composition.actorId,
    });
    return json({ ok: true, value: status });
  } catch (cause) {
    const code = codeOf(cause);
    return json({ ok: false, code }, { status: code === 'QLT_TURN_ALREADY_OPEN' ? 409 : 400 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  if (typeof params.id !== 'string' || !SAFE_ID.test(params.id)) {
    return json({ ok: false, code: 'QLT_DELETION_THREAD_MISSING' }, { status: 404 });
  }
  try {
    const app = getAppServer();
    const composition = await app.composition();
    const status = await composition.conversationLifecycle.cancelDeletion({
      threadId: params.id,
      actorId: composition.actorId,
    });
    return json({ ok: true, value: status });
  } catch (cause) {
    return json({ ok: false, code: codeOf(cause) }, { status: 400 });
  }
};
