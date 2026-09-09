import type { ComponentRegistry } from '@victframework/application/renderer';

/**
 * YOUR COMPONENT REGISTRY — author-owned code island.
 *
 * Register custom Svelte components here with stable ids and explicit
 * revisions, reference them from your Application Definition with the same
 * id/revision pair, and the generic host renders them. Registered
 * components receive ONLY their declared props.
 *
 * Example:
 *
 * import MyWidget from './MyWidget.svelte';
 * export function registerComponents(registry: ComponentRegistry): void {
 *   registry.register({ componentId: 'app.my-widget', revision: '1', implementation: MyWidget });
 * }
 */

export function registerComponents(_registry: ComponentRegistry): void {
  // Register your custom components here.
}
