import { error } from '@sveltejs/kit';
import { getAppServer } from '$lib/server/application-server';
import { getQuellightRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

// The ONLY page server load of the application: resolves the route from the
// neutral plan and reads declared view data through the Quellight Shared
// World adapter. Unknown paths produce a structured 404 — never a silent
// fallback. No credential and no internal handle crosses this boundary.
export const load: PageServerLoad = async ({ url }) => {
  const app = getAppServer();
  const path = url.pathname === '' ? '/' : url.pathname;
  const route = app.loadRoute(path);
  if (route === undefined || route === null) {
    throw error(404, 'No application route is declared for this path.');
  }
  const viewData: Record<string, unknown> = {};
  const runtime = await getQuellightRuntime();
  const read = await runtime.composition.sharedWorld.adapter.query(
    { op: 'list', resourceId: 'qlt.threads', sort: [{ field: 'updatedAt', direction: 'desc' }] },
    { permissions: ['qlt.threads.read'], effect: 'read' },
  );
  if (read.ok) {
    viewData['v.threads'] = { rows: read.rows ?? [], total: read.total ?? 0 };
  }
  return {
    plan: app.plan.toJSON(),
    viewData,
  };
};
