import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';

/**
 * Q4 (frozen contract §9): the READ-ONLY transparency summary of a
 * thread's latest durable per-turn context assembly.
 *
 * - served from the composition's assembly-summary accessor (no store
 *   import, no write path, no second effect path);
 * - consumed ONLY by the user-opened memory tray's quiet usage line; the
 *   response carries counts and outcomes — never record content, never
 *   the rendered block, never lineage data;
 * - `undefined` (no assembly yet) is a truthful empty response.
 */

export const GET: RequestHandler = async ({ params }) => {
  const runtime = await getQuellightRuntime();
  const threadId = params.id ?? '';
  try {
    const thread = await runtime.composition.sharedWorld.getThread(threadId);
    if (thread === undefined) {
      return json({ ok: false, code: 'QLT_THREAD_MISSING' }, { status: 200 });
    }
    const summary = await runtime.composition.getThreadAssemblySummary(threadId);
    if (summary === undefined) {
      return json({ ok: true });
    }
    return json({
      ok: true,
      assembly: {
        outcome: summary.outcome,
        usedCount: summary.usedCount,
        assemblerVersion: summary.assemblerVersion,
        createdAtMs: summary.createdAtMs,
        // Q5 (freeze §3.5): the applied Memory Mode from the immutable
        // per-turn policy evidence (undefined for pre-policy turns) — the
        // quiet line distinguishes an intentionally-off reply from
        // "no memories used".
        ...(summary.memoryMode !== undefined ? { memoryMode: summary.memoryMode } : {}),
      },
    });
  } catch {
    // Truthful quiet failure: the tray keeps its previous state; nothing
    // is fabricated.
    return json({ ok: false, code: 'ASSEMBLY_SUMMARY_UNAVAILABLE' }, { status: 200 });
  }
};
