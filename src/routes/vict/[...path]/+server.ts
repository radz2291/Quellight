import type { RequestHandler } from './$types';
import { getQuellightRuntime } from '$lib/server/runtime';

/**
 * The SvelteKit server-side proxy to the VICT boundary (§8.3, AI-015,
 * MSTR-007).
 *
 * - the browser NEVER reaches Mastra or privileged endpoints directly and
 *   NEVER holds an actor token: the proxy injects the local actor
 *   credential server-side from the in-process composition;
 * - SSE streams pass through UNBUFFERED: the upstream body stream becomes
 *   the response body verbatim (no whole-response buffering), preserving
 *   `vict.agent-stream@1` resumable-SSE reconnect semantics;
 * - command bodies are bounded upstream by the VICT transport (256 KiB).
 */

const PASS_THROUGH_RESPONSE_HEADERS = new Set([
  'content-type',
  'cache-control',
  'x-vict-replay-bounded',
  'x-vict-stream-newest-seq',
  'x-vict-stream-cursor',
]);

async function forward(request: Request, target: string): Promise<Response> {
  const runtime = await getQuellightRuntime();
  const upstreamUrl = `${runtime.victOrigin()}${target}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType !== null) {
    headers.set('content-type', contentType);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey !== null) {
    headers.set('idempotency-key', idempotencyKey);
  }
  const lastEventId = request.headers.get('last-event-id');
  if (lastEventId !== null) {
    headers.set('last-event-id', lastEventId);
  }
  // The ONLY credential injection point: server-side, never exposed to
  // the browser. The token value never enters logs or responses here.
  headers.set('authorization', `Bearer ${runtime.actorToken()}`);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    ...(request.method === 'POST' || request.method === 'PUT'
      ? { body: await request.arrayBuffer() }
      : {}),
  });

  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers.entries()) {
    if (PASS_THROUGH_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET: RequestHandler = async ({ request }) => {
  const url = new URL(request.url);
  return forward(request, url.pathname + url.search);
};

export const POST: RequestHandler = async ({ request }) => {
  const url = new URL(request.url);
  return forward(request, url.pathname);
};
