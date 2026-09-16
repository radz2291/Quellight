import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';
import { runWithTurnAssemblyScope } from '$lib/server/model-seam';
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
 * - the model input is bounded (untrusted conversation data);
 * - Q4 (frozen contract §8): the dispatch runs inside the Quellight-owned
 *   assembly correlation scope carrying the SERVER-RESOLVED Shared World
 *   thread id and Mastra conversation id — the model seam resolves the
 *   in-flight turn identity from durable records only; the client and the
 *   model supply no actor, thread, or turn authority. The detached turn
 *   execution inherits this scope.
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
    // Narrowed values captured into consts: the dispatch closure below must
    // see the validated string types (a `let` binding's narrowing does not
    // survive into closures).
    const input: string = body.input;
    const idempotencyKey: string = body.idempotencyKey;
    // The correlation record is Quellight-owned; archived threads refuse
    // new turns (QLT_THREAD_ARCHIVED) before any VICT intent is created.
    const conversation = await runtime.composition.sharedWorld.ensureConversationLink(threadId);
    // ServerActorContext = AuthenticatedActorContext + the local token kind
    // marker; the authoritative context still derives from the directory.
    const actor = { ...runtime.composition.actor, presentedTokenKind: 'local-test' as const };
    // Q4: the server-derived assembly correlation scope wraps the whole
    // dispatch (the detached turn execution inherits it).
    const outcome = await runWithTurnAssemblyScope(
      { swThreadId: threadId, mastraThreadId: conversation.mastraThreadId },
      () =>
        runtime.composition.commandService.dispatch(actor, {
          command: 'agent.turn.start',
          payload: { threadId: conversation.mastraThreadId, input },
          idempotencyKey,
        }),
    );
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
