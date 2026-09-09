import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';

/**
 * Truthful runtime self-description for the UI (no secrets, no internals).
 * Discloses the model mode (offline fixture vs live provider), the
 * release binding, and the turn deadline; nothing else.
 */
export const GET: RequestHandler = async () => {
  try {
    const runtime = await getQuellightRuntime();
    return json({
      ok: true,
      modelMode: runtime.composition.modelMode,
      releaseVersion: runtime.composition.releaseVersion,
      turnDeadlineMs: runtime.composition.turnDeadlineMs,
      profile: 'ollama-cloud/glm-5.3-flash',
    });
  } catch (cause) {
    const code = (cause as { code?: string }).code;
    return json(
      {
        ok: false,
        code: typeof code === 'string' ? code : 'CONFIGURATION_UNAVAILABLE',
        message: 'Quellight is not configured correctly; check the operator environment.',
      },
      { status: 503 },
    );
  }
};
