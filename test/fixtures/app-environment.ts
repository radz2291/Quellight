/**
 * The deterministic `$app/environment` stub for NODE-SIDE suites that
 * exercise the server ingress module (runtime.ts reads `dev` only to
 * assert composition behavior is identical in dev and production — the
 * built app embeds the real module).
 */
export const dev = false;
export const version = 'test-node-suite';
