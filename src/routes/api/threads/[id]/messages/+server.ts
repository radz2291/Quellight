import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';

/**
 * Restore one thread's durable truth (conversation-first reopen).
 *
 * - thread record: Quellight Shared World (survives Mastra store loss);
 * - transcript: the designated, actor-authorized conversation store,
 *   restored read-only and bounded;
 * - turn statuses: VICT-authoritative records — an incomplete or failed
 *   turn is rendered as exactly what it is (never a fabricated
 *   completion).
 */
export const GET: RequestHandler = async ({ params }) => {
  const runtime = await getQuellightRuntime();
  const threadId = params.id ?? '';
  try {
    const restored = await runtime.composition.restoreThread(threadId);
    return json({ ok: true, ...restored });
  } catch (cause) {
    const code = (cause as { code?: string }).code;
    if (code === 'QLT_THREAD_MISSING') {
      return json({ ok: false, code }, { status: 404 });
    }
    return json({ ok: false, code: 'RESTORE_FAILED' }, { status: 500 });
  }
};
