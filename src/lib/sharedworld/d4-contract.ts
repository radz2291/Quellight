/**
 * Quellight Stage 07D Phase D4a — the MSTR-012 real-use proof contract
 * data.
 *
 * FROZEN CONTRACT DATA (proof contract
 * `quellight.stage07d.d4.proof-contract@1`, committed standalone BEFORE
 * any D4 proof machinery). This module mirrors that contract exactly:
 * the two evidence layers, the session bounds, the structural proof
 * points and their prerequisite rules, the evidence schema, the
 * forbidden-evidence rules, and the preparation-phase negative-control
 * list. It authorizes nothing: the harness that consumes this data
 * refuses to run without the explicit owner session flag and a
 * one-shot authorization receipt, and the preparation gate proves the
 * whole refusal/scan/seal machinery offline on synthetic data only.
 *
 * No D1a/D2 frozen data is reinterpreted: the D1 retention and conflict
 * machinery and the D2 deletion/export/reconciliation services are
 * consumed unchanged through the same governed user surfaces the
 * product UI uses.
 */

// ---------------------------------------------------------------------------
// 1. Identity
// ---------------------------------------------------------------------------

/** The D4 proof-contract identity (the amendment of record for D4). */
export const QLT_D4_PROOF_CONTRACT_ID = 'quellight.stage07d.d4.proof-contract@2';

// ---------------------------------------------------------------------------
// 2. Session identity and bounds (frozen)
// ---------------------------------------------------------------------------

/** The ONE pinned provider profile for the structured session (unchanged). */
export const QLT_D4_PROFILE = 'ollama-cloud/glm-5.3-flash' as const;

/** The pinned provider endpoint (unchanged). */
export const QLT_D4_ENDPOINT = 'https://ollama.com/v1' as const;

/** The credential environment-variable NAME (never a value). */
export const QLT_D4_CREDENTIAL_VAR = 'OLLAMA_API_KEY' as const;

/** The explicit owner session flag (environment variable NAME). */
export const QLT_D4_SESSION_FLAG = 'QUELLIGHT_D4_STRUCTURED' as const;

/** The owner-supplied scenario file environment-variable NAME. */
export const QLT_D4_SCENARIO_VAR = 'QUELLIGHT_D4_SCENARIO_FILE' as const;

/** The one-shot authorization receipt path (repository-relative). */
export const QLT_D4_RECEIPT_PATH = 'docs/report/evidence/d4-structured-session-receipt.json';

/** The sealed evidence summary path (repository-relative). */
export const QLT_D4_EVIDENCE_PATH = 'docs/report/evidence/d4-structured-session-evidence.json';

/**
 * The frozen structured-session bounds (proof contract §2). The harness
 * verifies the remaining budget BEFORE each transport and fails closed
 * when any bound would be exceeded.
 */
export const QLT_D4_BOUNDS = {
  maxSessionMs: 45 * 60_000,
  maxUserTurns: 10,
  maxProviderRequests: 20,
  maxOutputTokensPerRequest: 2048,
  maxTurnDeadlineMs: 120_000,
  retries: 0,
  fallback: false,
} as const;

// ---------------------------------------------------------------------------
// 3. Dedicated proof-record vocabulary
// ---------------------------------------------------------------------------

/**
 * Proof records and threads are clearly dedicated: every destructive
 * scenario operates ONLY on these, always preview-first, and never on
 * unrelated owner data.
 */
export const QLT_D4_PROOF_KEY_PREFIX = 'd4-proof-';
export const QLT_D4_PROOF_SUBJECT_PREFIX = 'd4-proof';
export const QLT_D4_PROOF_THREAD_TITLE_PREFIX = 'd4-proof';

// ---------------------------------------------------------------------------
// 4. Evidence vocabulary (closed)
// ---------------------------------------------------------------------------

/**
 * The evidence ledger is append-only JSONL. Every receipt carries only
 * structural fields; the record/thread identities below are the ONLY
 * free-form identity strings allowed (they are product ids).
 */
export const QLT_D4_EVIDENCE_KINDS = ['receipt', 'note'] as const;

export const QLT_D4_OUTCOMES = ['passed', 'failed', 'failed-infrastructure'] as const;
export type QltD4Outcome = (typeof QLT_D4_OUTCOMES)[number];

/** Stable non-echoing failure codes for the structured session. */
export const QLT_D4_CODES = {
  NOT_AUTHORIZED: 'QLT_D4_NOT_AUTHORIZED',
  ALREADY_AUTHORIZED: 'QLT_D4_ALREADY_AUTHORIZED',
  AUTHORIZATION_MALFORMED: 'QLT_D4_AUTHORIZATION_MALFORMED',
  CREDENTIAL_MISSING: 'QLT_D4_CREDENTIAL_MISSING',
  SCENARIO_MISSING: 'QLT_D4_SCENARIO_MISSING',
  BOUNDS_EXCEEDED: 'QLT_D4_BOUNDS_EXCEEDED',
  EVIDENCE_INVALID: 'QLT_D4_EVIDENCE_INVALID',
  SEAL_REFUSED: 'QLT_D4_SEAL_REFUSED',
  TURN_FAILED: 'QLT_D4_TURN_FAILED',
  PROOF_POINT_FAILED: 'QLT_D4_PROOF_POINT_FAILED',
  SCAN_HIT: 'QLT_D4_SCAN_HIT',
} as const;

// ---------------------------------------------------------------------------
// 5. Required checks and prerequisite rules
// ---------------------------------------------------------------------------

/**
 * The sealed session must contain `ok: true` receipts for EVERY check
 * below. The prerequisite map is the false-claim defence: a receipt
 * whose prerequisites are missing (or carry a different record/thread
 * identity) cannot seal — this is how false restart, fresh-thread,
 * deletion, export, and reconciliation claims fail closed.
 */
export const QLT_D4_REQUIRED_CHECKS = [
  'a1-conversation-usable',
  'a2-durable-meaning-preserved',
  'a3-no-agent-canonical',
  'restart-performed',
  'a4-restart-preserved',
  'assembly-selected',
  'a5-fresh-thread-received',
  'ineligible-seeded',
  'a6-ineligible-excluded',
  'a7-conflict-challenge-quiet',
  'export-produced',
  'a8-export-truthful',
  'deletion-previewed',
  'record-removed',
  'a9-proof-record-removal',
  'conversation-deleted',
  'meaning-byte-identical',
  'a10-conversation-only-preserved',
  'reconciliation-receipts',
  'boot-recovery-clean',
  'a11-reconciliation-complete',
  'context-marker-absent',
  'a12-transcripts-clean',
  'a13-evidence-hygiene',
] as const;
export type QltD4CheckId = (typeof QLT_D4_REQUIRED_CHECKS)[number];

/**
 * Prerequisite rules. `sameRecord`/`sameThread` require the named
 * identity field on the prerequisite receipt to EQUAL the dependent's
 * (the dependent receipt must carry `recordId`/`threadId`).
 */
export const QLT_D4_CHECK_PREREQUISITES: Readonly<
  Record<QltD4CheckId, ReadonlyArray<{ check: QltD4CheckId; sameField?: 'recordId' | 'threadId' }>>
> = {
  'a1-conversation-usable': [],
  'a2-durable-meaning-preserved': [{ check: 'a1-conversation-usable' }],
  'a3-no-agent-canonical': [{ check: 'a2-durable-meaning-preserved', sameField: 'recordId' }],
  'restart-performed': [{ check: 'a2-durable-meaning-preserved' }],
  'a4-restart-preserved': [{ check: 'restart-performed', sameField: 'recordId' }],
  'assembly-selected': [],
  'a5-fresh-thread-received': [
    { check: 'restart-performed' },
    { check: 'assembly-selected', sameField: 'recordId' },
  ],
  'ineligible-seeded': [{ check: 'a2-durable-meaning-preserved' }],
  'a6-ineligible-excluded': [{ check: 'ineligible-seeded' }],
  'a7-conflict-challenge-quiet': [{ check: 'a2-durable-meaning-preserved' }],
  'export-produced': [],
  'a8-export-truthful': [{ check: 'export-produced' }],
  'deletion-previewed': [{ check: 'export-produced' }],
  'record-removed': [{ check: 'deletion-previewed' }, { check: 'a2-durable-meaning-preserved' }],
  'a9-proof-record-removal': [{ check: 'record-removed', sameField: 'recordId' }],
  'conversation-deleted': [{ check: 'deletion-previewed', sameField: 'threadId' }],
  'meaning-byte-identical': [{ check: 'conversation-deleted', sameField: 'threadId' }],
  'a10-conversation-only-preserved': [
    { check: 'conversation-deleted', sameField: 'threadId' },
    { check: 'meaning-byte-identical', sameField: 'threadId' },
  ],
  'reconciliation-receipts': [{ check: 'conversation-deleted', sameField: 'threadId' }],
  'boot-recovery-clean': [{ check: 'reconciliation-receipts' }],
  'a11-reconciliation-complete': [
    { check: 'reconciliation-receipts', sameField: 'threadId' },
    { check: 'boot-recovery-clean' },
  ],
  'context-marker-absent': [],
  'a12-transcripts-clean': [{ check: 'context-marker-absent' }],
  'a13-evidence-hygiene': [],
};

// ---------------------------------------------------------------------------
// 5b. Determinism classification (Amendment 1)
// ---------------------------------------------------------------------------

/**
 * Amendment 1: every REQUIRED check classifies as an owner/product
 * action (1) or a deterministic runtime observation (2). The class
 * value 'model-observation' (3) exists for the vocabulary only — NO
 * required check carries it, and a nondeterministic model observation
 * can never gate the seal. The static gate proves this mapping.
 */
export type QltD4CheckClass = 'owner-action' | 'runtime-observation' | 'model-observation';

export const QLT_D4_CHECK_CLASSIFICATION: Readonly<Record<QltD4CheckId, QltD4CheckClass>> = {
  'a1-conversation-usable': 'runtime-observation',
  'a2-durable-meaning-preserved': 'owner-action',
  'a3-no-agent-canonical': 'runtime-observation',
  'restart-performed': 'owner-action',
  'a4-restart-preserved': 'runtime-observation',
  'assembly-selected': 'runtime-observation',
  'a5-fresh-thread-received': 'runtime-observation',
  'ineligible-seeded': 'owner-action',
  'a6-ineligible-excluded': 'runtime-observation',
  'a7-conflict-challenge-quiet': 'owner-action',
  'export-produced': 'runtime-observation',
  'a8-export-truthful': 'runtime-observation',
  'deletion-previewed': 'owner-action',
  'record-removed': 'owner-action',
  'a9-proof-record-removal': 'runtime-observation',
  'conversation-deleted': 'owner-action',
  'meaning-byte-identical': 'runtime-observation',
  'a10-conversation-only-preserved': 'runtime-observation',
  'reconciliation-receipts': 'runtime-observation',
  'boot-recovery-clean': 'runtime-observation',
  'a11-reconciliation-complete': 'runtime-observation',
  'context-marker-absent': 'runtime-observation',
  'a12-transcripts-clean': 'runtime-observation',
  'a13-evidence-hygiene': 'runtime-observation',
};

/**
 * Reserved receipt-detail keys for OPTIONAL, truthfully recorded model
 * observations (Amendment 1). They are structural facts only (booleans
 * and product identities — never content) and can never gate a
 * required check: adding or removing them leaves the seal verdict
 * unchanged. The validator treats them like any other structural
 * detail key (they carry no content, path, or secret shape).
 */
export const QLT_D4_OBSERVATION_DETAIL_KEYS = [
  'modelProposalObserved',
  'ceremonyObservation',
  'conflictClassExercised',
  'pendingProposalObservation',
] as const;
export type QltD4ObservationDetailKey = (typeof QLT_D4_OBSERVATION_DETAIL_KEYS)[number];

// ---------------------------------------------------------------------------
// 6. Forbidden evidence (closed)
// ---------------------------------------------------------------------------

/**
 * Receipt detail objects may never carry these keys (raw conversation or
 * prompt/response content under any name the machinery could emit). The
 * ledger validator rejects them at append time; the seal re-checks the
 * whole ledger.
 */
export const QLT_D4_FORBIDDEN_DETAIL_KEYS = [
  'content',
  'statement',
  'title',
  'text',
  'prompt',
  'response',
  'rawPrompt',
  'rawResponse',
  'scenarioText',
  'reply',
  'message',
] as const;

/**
 * Values inside receipt details may never look like filesystem paths or
 * secret-shaped material. The ledger validator and the seal both scan
 * for these patterns; a hit refuses the receipt (or the seal).
 */
export const QLT_D4_FORBIDDEN_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /[A-Za-z]:[\\/]/, // Windows drive paths
  /(\/home\/|\/Users\/|\/root\/|\/tmp\/|\/var\/)/, // POSIX absolute paths
  /(sk-[A-Za-z0-9]{8,}|api[_-]?key\s*[:=])/i, // secret-shaped material
];

// ---------------------------------------------------------------------------
// 7. Preparation-phase negative controls (frozen)
// ---------------------------------------------------------------------------

/**
 * The permanent offline gate `verify:d4-prep` implements these controls
 * over synthetic data and disposable synthetic stores only. The gate
 * performs no provider access of any kind.
 *
 * A7 interpretation of record (proof contract §2): the deterministic
 * conflict class fires at confirm time on a matching commitment key;
 * key choice belongs to the model, so the LIVE session accepts both
 * truthful outcomes — a model key collision exercises the quiet
 * challenge + dismissal end to end, and a distinct key is correct
 * product behavior (a different key is a different commitment) recorded
 * with the standing commitment's unchanged identity. Neither outcome
 * depends on exact wording; a collision with a NON-quiet failure, or a
 * silent overwrite, fails the session.
 */
export const QLT_D4_PREP_CONTROLS = [
  'N-D4-P-1 the harness refuses without the explicit owner session flag',
  'N-D4-P-2 the harness refuses a reused authorization receipt',
  'N-D4-P-3 the harness refuses a malformed authorization receipt',
  'N-D4-P-4 the harness refuses a missing credential before any workspace exists',
  'N-D4-P-5 the scenario plan budget is enforced BEFORE any transport',
  'N-D4-P-6 the evidence ledger rejects a credential-shaped value',
  'N-D4-P-7 the evidence ledger rejects absolute paths',
  'N-D4-P-8 the evidence ledger rejects forbidden detail keys (raw content)',
  'N-D4-P-9 partial evidence cannot be sealed as success',
  'N-D4-P-10 contradictory evidence cannot be sealed as success',
  'N-D4-P-11 a false restart claim cannot be sealed',
  'N-D4-P-12 a false fresh-thread claim cannot be sealed',
  'N-D4-P-13 a false deletion claim cannot be sealed',
  'N-D4-P-14 a false reconciliation claim cannot be sealed',
  'N-D4-P-15 a synthetic success traverses the complete evidence lifecycle and seals',
  'N-D4-P-16 the failure path seals truthfully and cleanup removes the workspace',
  'N-D4-P-17 the workspace policy refuses repository and operator-directory locations',
  'N-D4-P-18 the preparation machinery performs no provider access (static)',
] as const;
