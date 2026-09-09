import { defineConfig } from 'vitest/config';

/**
 * The NODE-SIDE test configuration: composition, conversation lifecycle,
 * Shared World store, reconnect/restart, and negative-control suites.
 * Runs fully offline — no network access and no provider credential.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/ui/**', 'node_modules/**'],
    // The real pinned Mastra pipeline (dedicated store, memory settle,
    // streaming, restart fixtures) needs long-running scenarios.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
