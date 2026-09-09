<script lang="ts">
  // The GENERIC application host page: the only page shell this application
  // will ever need. Everything visible is rendered from the neutral plan.
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { VitApp, type ActionResult } from '@victframework/renderer-svelte';
  import '@victframework/renderer-svelte/theme.css';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import { registerComponents } from '$lib/components/registry';

  let { data }: { data: { plan: Record<string, unknown>; viewData: Record<string, unknown> } } =
    $props();

  const registry = createComponentRegistry('registry.app', '1');
  registerComponents(registry);

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const response = await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, input }),
    });
    return (await response.json()) as ActionResult;
  }
</script>

<svelte:head><title>Quellight</title></svelte:head>

<VitApp
  plan={data.plan as never}
  {registry}
  {dispatch}
  path={page.url.pathname}
  viewData={data.viewData}
  onInvalidate={() => void invalidateAll()}
/>
