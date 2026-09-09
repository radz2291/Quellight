import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * The BROWSER-SIDE (component/island) test configuration: happy-dom
 * environment, SvelteKit plugins (which embed the Svelte compiler — a
 * separate svelte() plugin here would compile the generated output a
 * second time), browser resolve conditions. Server-side composition and
 * store tests use vitest.node.config.ts.
 */
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'happy-dom',
    include: ['test/ui/**/*.test.ts'],
  },
});
