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
});
