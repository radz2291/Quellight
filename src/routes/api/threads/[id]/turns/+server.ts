import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';
import { VictControlError } from '@victframework/runtime';

/**
 * Start one agent turn on a Shared World thread (user-initiated).
 *
 * - the Shared World thread ↔ Mastra conversation correlation is resolved
 *   SERVER-SIDE (the browser never derives or supplies a Mastra thread
 *   id);
 * - the turn crosses the VICT command boundary (agent.turn.start) with
 *   the caller's idempotency key per logical send (duplicate sends
 *   reconcile to exactly one turn);
 * - the model input is bounded (untrusted conversation data).
 */

const MAX_INPUT_LENGTH = 8000;

export const POST: RequestHandler = async ({ request, params }) => {
  const runtime = await getQuellightRuntime();
  const threadId = params.id ?? '';
  let body: { input?: unknown; idempotencyKey?: unknown };
  try {
    body = (await request.json()) as { input?: unknown; idempotencyKey?: unknown };
  } catch {
    return json(
      { ok: false, code: 'INVALID_REQUEST', message: 'The body must be JSON.' },
      { status: 400 },
    );
  }
  if (
    typeof body.input !== 'string' ||
    body.input.length === 0 ||
    body.input.length > MAX_INPUT_LENGTH
  ) {
    return json(
      {
        ok: false,
        code: 'INVALID_REQUEST',
        message: `input is required and must be at most ${MAX_INPUT_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }
  if (
    typeof body.idempotencyKey !== 'string' ||
    body.idempotencyKey.length === 0 ||
    body.idempotencyKey.length > 128
  ) {
    return json(
      {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'idempotencyKey is required (per logical send).',
      },
      { status: 400 },
    );
  }
  try {
    // The correlation record is Quellight-owned; archived threads refuse
    // new turns (QLT_THREAD_ARCHIVED) before any VICT intent is created.
    const conversation = await runtime.composition.sharedWorld.ensureConversationLink(threadId);
    // ServerActorContext = AuthenticatedActorContext + the local token kind
    // marker; the authoritative context still derives from the directory.
    const actor = { ...runtime.composition.actor, presentedTokenKind: 'local-test' as const };
    const outcome = await runtime.composition.commandService.dispatch(actor, {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: body.input },
      idempotencyKey: body.idempotencyKey,
    });
    if (!outcome.ok) {
      return json({ ok: false, code: outcome.code }, { status: 200 });
    }
    return json({ ok: true, data: outcome.data });
  } catch (cause) {
    if (cause instanceof VictControlError) {
      return json({ ok: false, code: cause.code }, { status: 200 });
    }
    const name = (cause as { name?: string }).name;
    const code = (cause as { code?: string }).code;
    if (typeof name === 'string' && typeof code === 'string') {
      // Structured Quellight/VICT domain failure (stable, non-echoing).
      return json({ ok: false, code }, { status: 200 });
    }
    return json(
      { ok: false, code: 'TURN_START_FAILED', message: 'The turn could not start.' },
      { status: 500 },
    );
  }
};
