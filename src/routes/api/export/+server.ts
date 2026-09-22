import { json } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import type { RequestHandler } from './$types';

/**
 * The D2 user-export route (safety contract §6): the deterministic,
 * versioned, bounded whole-store export, assembled through the released
 * VICT governed export ports plus the application's own stores. The
 * export is handed to the requestor and NOT retained. Fail closed: any
 * governed port failure produces no document — a stable, non-echoing
 * code only. Generated as a streamed response body.
 */
export const GET: RequestHandler = async () => {
  try {
    const app = getAppServer();
    const composition = await app.composition();
    const document = await composition.conversationLifecycle.buildExport();
    const body = JSON.stringify(document);
    return new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition':
          'attachment; filename="quellight-user-export.json"; filename*=UTF-8\'\'quellight-user-export.json',
        'cache-control': 'no-store',
      },
    });
  } catch (cause) {
    const code = (cause as { code?: unknown } | null)?.code;
    return json(
      { ok: false, code: typeof code === 'string' ? code : 'QLT_EXPORT_FAILED' },
      { status: 500 },
    );
  }
};
