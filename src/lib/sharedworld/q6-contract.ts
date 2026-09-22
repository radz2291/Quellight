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

/** The hard bounds of the ONE bounded live-provider ceremony proof.
 *
 * D-Q6-15 (2026-09-22 recovery amendment) replaces the 512-token request
 * allowance with 2048 and bounds actual HTTP requests as well as user turns.
 */
export const QLT_Q6_LIVE_BOUNDS = {
  /** No more than 6 provider turns for the whole ceremony. */
  maxProviderTurns: 6,
  /** D-Q6-15: reasoning, tool arguments and text share this per-request allowance. */
  maxOutputTokensPerRequest: 2048,
  maxProviderRequests: 12,
  maxProviderRequestsPerTurn: 3,
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

/** The pinned agent authority envelope of Q6 (invariance data).
 *
 * The Execution-3 remediation (2026-09-22,
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-EXECUTION-3-REMEDIATION-CONTRACT.md)
 * bumped the proposal capability (2 → 3: model-facing presentation only;
 * declared effect stays `write`) and the agent profile (5 → 6, binding the
 * revision-3 capability and the unchanged revision-4 discretion
 * instructions). The authority envelope itself — declared effect, host
 * policy, action inventory, maxToolCalls — is unchanged.
 */
export const QLT_Q6_UNCHANGED_ENVELOPE = {
  capabilityId: 'qlt.proposal.draft',
  capabilityRevision: '3',
  declaredEffect: 'write',
  hostQuietWritePolicyIdentity: 'qlt.host-policy.quiet-write@1',
  // D1a freeze amendment: the plan inventory grew from 21 to 29 actions
  // (the eight D1 retention/conflict actions; freeze report §10). The Q6
  // AGENT envelope itself — capability id/revision, declared effect, host
  // policy, maxToolCalls, profile/instructions revisions — is unchanged;
  // no D1 action is agent-reachable.
  actionInventory: 29,
  agentProfileRevision: '7',
  conversationInstructionsRevision: '5',
  conversationInstructionsId: 'quellight.conversation-instructions',
  maxToolCalls: 2,
} as const;

// ---------------------------------------------------------------------------
// The bounded-memory-discretion amendment (D-Q6-6; 2026-09-21)
// ---------------------------------------------------------------------------

/** The amendment identity (declarative data only; D-Q6-6). */
export const QLT_Q6_AMENDMENT = {
  decisionId: 'D-Q6-6',
  document: 'docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-BOUNDED-DISCRETION-AMENDMENT.md',
  date: '2026-09-21',
  liveOutputTokenCeiling: 512,
} as const;

/** The operator environment variable carrying the EXTERNAL natural fixture path.
 *
 * The Turn-2 natural fixture is the operator's personal text. It lives in an
 * operator-designated external UTF-8 file and is NEVER committed, embedded,
 * logged, or reported. Recovery evidence carries byte length only; the privacy
 * amendment prohibits content digests and uses in-memory equality instead.
 */
export const QLT_Q6_NATURAL_FIXTURE_VAR = 'QUELLIGHT_Q6_NATURAL_FIXTURE_FILE' as const;

/** The maximum accepted natural-fixture size in UTF-8 bytes. */
export const QLT_Q6_NATURAL_FIXTURE_MAX_BYTES = 12_288;

// ---------------------------------------------------------------------------
// The six-turn live proof matrix (amendment §5; replaces the single
// implicit-positive proof). Turn 2's input is the EXTERNAL fixture; turns
// 1/3/4/5 use these fixed statements.
// ---------------------------------------------------------------------------

/** Turn 1 — explicit positive control (the user explicitly asks to remember). */
export const QLT_Q6_T1_STATEMENT =
  'Remember this: I prefer explanations in plain language before technical details.' as const;

/** Turn 3 — discretionary negative control (an ordinary software incident). */
export const QLT_Q6_T3_STATEMENT =
  'The installer took eighteen minutes today and I had to restart it twice.' as const;

/** Turn 4 — fresh-conversation continuity (no transcript dependency). */
export const QLT_Q6_T4_STATEMENT =
  'What constraint should guide any advice you give me about leaving my job?' as const;

/** Turn 5 — hypothetical conflict and negative control. */
export const QLT_Q6_T5_STATEMENT =
  'For this thought experiment only, suppose I leave tomorrow without a plan.' as const;

/** D-Q6-15: transient feelings, logistics, speculation and ordinary conversation. */
export const QLT_Q6_T6_STATEMENT =
  "The delivery was late today and I'm annoyed right now. Maybe the rain caused it. Anyway, how's your day going?" as const;

/** The semantic anchors the Turn-2 commitment proposal MUST preserve
 * (normalized matching; minor grammatical normalization allowed). */
export const QLT_Q6_COMMITMENT_ANCHORS: readonly string[] = [
  'not leave',
  'current job',
  'clear pathway',
  'established base',
];

/** Reply-claim patterns that are NEVER acceptable in a live reply
 * (natural-flow non-claim rules; amendment §5). Matched against the
 * normalized (lowercase, whitespace-collapsed) reply text. */
export const QLT_Q6_FORBIDDEN_CLAIM_PATTERNS: readonly string[] = [
  'i saved',
  'i have saved',
  "i've saved",
  'i remembered',
  'i have remembered',
  "i've remembered",
  'i stored',
  'i have stored',
  "i've stored",
  'i will remember this',
  'memory updated',
  'saved to memory',
  'stored in memory',
  'recorded to memory',
  'noted in memory',
  'added to your memory',
];

/** Implementation-jargon patterns that must stay out of live replies
 * (the conversation stays natural; amendment §5). */
export const QLT_Q6_FORBIDDEN_JARGON_PATTERNS: readonly string[] = [
  'qlt_',
  'qlt.',
  'proposal draft',
  'proposal_draft',
  'shared world',
  'context block',
  'memory inbox',
  'capability envelope',
  'schema',
  'tool call',
  'c1 snapshot',
];

/** Advice-authoring markers: the stored commitment must remain the USER'S
 * commitment, never advice authored by the agent (amendment §5). */
export const QLT_Q6_ADVICE_MARKERS: readonly string[] = [
  'you should',
  'you must',
  'you need to',
  'you ought',
  'i recommend',
  'my advice',
  'the user should',
  'the user must',
];

/** Signal-claim markers: uncertain interpretations stay uncertain; hardship
 * must never become a factual "signal" or proof about leaving (D-Q6-6 rule 5). */
export const QLT_Q6_SIGNAL_CLAIM_MARKERS: readonly string[] = [
  'is a signal',
  'as a signal',
  'the signal',
  'proof that',
  'proves that',
  'proved that',
  'evidence that',
  'confirms that',
  'means the user must leave',
  'means the user should leave',
];

/** Transient-incident terms: a proposal whose durable core is only equipment,
 * software, or delivery trouble is a hardship-only proposal and must be
 * rejected (D-Q6-6 rule 3; amendment §5 Turn-2 failure modes). */
export const QLT_Q6_HARDSHIP_TERMS: readonly string[] = [
  'pc',
  'computer',
  'laptop',
  'installer',
  'reinstall',
  'reformat',
  'hardware',
  'software trouble',
  'delivery',
  'restart it',
];

/** The allowed open-loop themes for the OPTIONAL Turn-2 proposal (the
 * unresolved fast-track-versus-gradual transition decision). */
export const QLT_Q6_OPENLOOP_THEMES: readonly string[] = [
  'fast',
  'gradual',
  'slow',
  'transition',
  'pace',
  'timing',
  'timeline',
  'escape',
];

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

/** The Execution-3 preparation status: prepared, NOT executed (amendment §8). */
export const QLT_Q6_EXECUTION3_STATUS = 'PREPARED — NOT EXECUTED' as const;

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
