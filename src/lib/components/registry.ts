import type { ComponentRegistry } from '@victframework/application/renderer';
import ConversationWorkspace from '$lib/islands/ConversationWorkspace.svelte';

/**
 * YOUR COMPONENT REGISTRY — author-owned code island registration.
 *
 * The conversation workspace is the ONE versioned custom-component island
 * of Stage 07B (APP-014). It receives only its declared props (none);
 * every dynamic crossing is a typed server boundary (/api/act, /api/health,
 * /api/threads/*, /vict proxy).
 */
export function registerComponents(registry: ComponentRegistry): void {
  registry.register({
    componentId: 'qlt.conversation-workspace',
    revision: '1',
    implementation: ConversationWorkspace,
  });
}
