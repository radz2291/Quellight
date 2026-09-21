/**
 * QUELLIGHT STAGE 07C PHASE Q6 — VERIFICATION CONTRACT (FROZEN in
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md).
 *
 * This module is FROZEN, declarative Q6 contract DATA only — the live
 * proof bounds, the pinned provider/profile identity, the activation
 * gate, the named minimal example statement, and the exact status
 * language. It contains NO executable policy and NO product behavior:
 * Q6 adds no capability, no action, no migration, no agent authority,
 * and no schema change.
 *
 * Ownership: frozen by the Phase Q6 contract-freeze commit. A material
 * change requires the freeze amendment procedure (freeze §13): a
 * standalone dated amendment commit, never bundled with implementation.
 *
 * Authority basis: Stage 07C handoff §14 (N-C matrix), §15 (ladder), §19
 * (ratified OQ6 authority model); D-1 (the ONE pinned provider); the
 * M-1 stable-repin record (D-Q-M1-2); the H-1 binding rule (D-Q4-H1-1).
 */

// ---------------------------------------------------------------------------
// The frozen live-proof bounds (N-C24)
// ---------------------------------------------------------------------------

/** The hard bounds of the ONE bounded live-provider ceremony proof. */
export const QLT_Q6_LIVE_BOUNDS = {
  /** No more than 6 provider turns for the whole ceremony. */
  maxProviderTurns: 6,
  /** No more than 256 output tokens per provider turn. */
  maxOutputTokensPerTurn: 256,
  /** Maximum 120-second deadline per provider turn. */
  turnDeadlineMs: 120_000,
  /** Exactly ONE authoritative execution (process discipline). */
  authoritativeExecutions: 1,
  /** Zero automatic provider retries. */
  automaticProviderRetries: 0,
  /** No alternative model and no fallback provider. */
  fallbackProviders: 0,
} as const;

// ---------------------------------------------------------------------------
// The exact provider/profile identity (frozen; unchanged from D-1/M-1)
// ---------------------------------------------------------------------------

export const QLT_Q6_PROVIDER_IDENTITY = {
  provider: 'Ollama Cloud',
  model: 'glm-5.3-flash',
  routerIdentity: 'ollama-cloud/glm-5.3-flash',
  endpoint: 'https://ollama.com/v1',
  /** The credential environment-variable NAME (never a value). */
  credentialEnvVarName: 'OLLAMA_API_KEY',
  /** The explicit activation gate (never set by any automatic gate). */
  activationGateEnvVar: 'QUELLIGHT_LIVE_PROOF',
  activationGateValue: '1',
} as const;

/** The unchanged pinned agent authority envelope of Q6 (invariance). */
export const QLT_Q6_UNCHANGED_ENVELOPE = {
  capabilityId: 'qlt.proposal.draft',
  capabilityRevision: '2',
  declaredEffect: 'write',
  hostQuietWritePolicyIdentity: 'qlt.host-policy.quiet-write@1',
  actionInventory: 21,
  agentProfileRevision: '4',
} as const;

// ---------------------------------------------------------------------------
// The named minimal example (the principal success path statement)
// ---------------------------------------------------------------------------

/**
 * The minimum viable Stage 07C example already named in the architecture.
 * It is sent as a real user turn through the real ingress; it is NEVER
 * seeded into SQLite and never bypasses the model/tool bridge.
 */
export const QLT_Q6_EXAMPLE_STATEMENT =
  'I will not leave my current job without a clear pathway and established base.';

// ---------------------------------------------------------------------------
// Status language (frozen; never "independently verified" or "closed")
// ---------------------------------------------------------------------------

/** The exact Q6 implementation status (Q7 owns verification/closure). */
export const QLT_Q6_STATUS_IMPLEMENTED =
  'IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION' as const;

/** The live gate script path (the ONLY runner of the live ceremony). */
export const QLT_Q6_LIVE_GATE_SCRIPT = 'scripts/verify-q6-live.mjs';

/**
 * Automatic gates that must NEVER invoke the live ceremony (structural
 * scan targets; the live gate runs only by explicit operator invocation
 * of `npm run verify:q6:live` after ALL offline gates).
 */
export const QLT_Q6_NEVER_AUTOMATIC: readonly string[] = [
  'test',
  'test:node',
  'test:ui',
  'verify:quellight',
  'verify:stage7c',
  'verify:q6',
];
