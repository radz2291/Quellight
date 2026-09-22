import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

/**
 * The D2 deep-purge route (safety contract
 * `quellight.stage07d.d2.safety-contract@1` §5): a SEPARATE, explicit,
 * high-intent action for an already governed-deleted conversation. The
 * request must carry the explicit confirmation token; the server derives
 * the identity. Stable, non-echoing codes only.
 */

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function codeOf(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'QLT_PURGE_INCOMPLETE';
}

export const POST: RequestHandler = async ({ params, request }) => {
  let body: { confirmation?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (typeof params.id !== 'string' || !SAFE_ID.test(params.id)) {
    return json({ ok: false, code: 'QLT_DELETION_THREAD_MISSING' }, { status: 404 });
  }
  try {
    const app = getAppServer();
    const composition = await app.composition();
    const result = await composition.conversationLifecycle.purge({
      threadId: params.id,
      confirmation: typeof body.confirmation === 'string' ? body.confirmation : '',
      actorId: composition.actorId,
    });
    return json({ ok: true, value: result.receipt });
  } catch (cause) {
    return json({ ok: false, code: codeOf(cause) }, { status: 400 });
  }
};
