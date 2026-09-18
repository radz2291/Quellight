import { sveltekit } from '@sveltejs/kit/vite';
import { createLogger, defineConfig, type Logger } from 'vite';

/**
 * Recognized build notices (N-17 record — closed list):
 *
 * 1. `"node:sqlite" is imported by ... treating it as an external
 *    dependency.` — `node:sqlite` is a Node builtin (the VICT engines
 *    floor `>=22.13.0` exists precisely for this API). The bundler
 *    externalizes it correctly; the notice is the resolution-fallback
 *    announcement, not a defect.
 * 2. `Circular dependency: ... node_modules/zod/...` — zod's own internal
 *    module graph, reached through the pinned `@mastra/core`; it resolves
 *    and runs deterministically.
 *
 * Both notices are emitted by the SvelteKit/adapter bundling pipeline
 * itself (not configurable) and are filtered here by EXACT pattern;
 * `verify:quellight` independently scans the full build log and FAILS on
 * any warning outside this closed, documented list. Hydration/runtime
 * warning-freedom is proven separately by the browser smoke test.
 */
const RECOGNIZED_BUILD_NOTICE_PATTERNS = [
  /"node:sqlite" is imported by .*treating it as an external dependency\./,
  /Circular dependency: .*node_modules[/\\]zod[/\\]/,
];

function filteredLogger(): Logger {
  const logger = createLogger();
  const filtered = (original: (message: string, options?: { clear?: boolean }) => void) => {
    return (message: string, options?: { clear?: boolean }): void => {
      if (RECOGNIZED_BUILD_NOTICE_PATTERNS.some((pattern) => pattern.test(message))) {
        return;
      }
      original(message, options);
    };
  };
  logger.warn = filtered(logger.warn);
  logger.warnOnce = filtered(logger.warnOnce);
  return logger;
}

export default defineConfig({
  customLogger: filteredLogger(),
  plugins: [sveltekit()],
  // D-11 (2026-09-18, technical decision — provenance: Stage 07B remediation
  // report incident #2 and the independent re-verification, which real-browser
  // verified exactly this setting): the pinned svelte@5.57.0
  // `svelte.compileModule` cannot parse TypeScript, and Vite's dev-only esbuild
  // prebundler feeds the released renderer's `mount.svelte.ts` to it raw, which
  // crashed `npm run dev` with "Unexpected token" as soon as a browser opened
  // the app (production build — the N-17 evidence path — was never affected).
  // Excluding the renderer routes its modules through the normal dev transform
  // pipeline (esbuild TS strip → svelte module compile) instead. Dev-only;
  // consumption of the immutable `@victframework/*@0.2.0` set (D-3) is
  // unchanged.
  optimizeDeps: { exclude: ['@victframework/renderer-svelte'] },
});
