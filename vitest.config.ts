import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * The BROWSER-SIDE (component/island) test configuration: happy-dom
 * environment, Svelte + SvelteKit plugins, browser resolve conditions.
 * Server-side composition and store tests use vitest.node.config.ts.
 */
export default defineConfig({
  plugins: [svelte(), sveltekit()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'happy-dom',
    include: ['test/ui/**/*.test.ts'],
  },
});
