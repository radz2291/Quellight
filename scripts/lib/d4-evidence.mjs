/**
 * Quellight Stage 07D Phase D4a — the minimal real-use evidence
 * machinery (contract `quellight.stage07d.d4.proof-contract@1`).
 *
 * This module implements ONLY what the proof contract requires:
 *   - an append-only, schema-validating evidence ledger (JSONL) that
 *     refuses raw content, absolute paths, secret-shaped values, and
 *     oversized details at append time;
 *   - leak scanners (credential value, scenario digest, path patterns,
 *     context-block marker);
 *   - the seal step, which fails closed on missing checks, `ok:false`
 *     receipts, unsatisfied prerequisites (identity-matched), or any
 *     scan hit — so partial or contradictory evidence can never be
 *     sealed as success, and false restart / fresh-thread / deletion /
 *     reconciliation claims cannot seal;
 *   - the one-shot authorization receipt helpers (exclusive create;
 *     malformed and reused receipts refuse);
 *   - the workspace path policy (task-owned temp location only; the
 *     repository and the default operator directory are refused).
 *
 * The module performs no transport and never touches the default
 * operator data directory. The structured-session harness consumes it;
 * `verify:d4-prep` proves every negative control offline.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  QLT_D4_CODES,
  QLT_D4_CHECK_PREREQUISITES,
  QLT_D4_EVIDENCE_KINDS,
  QLT_D4_FORBIDDEN_DETAIL_KEYS,
  QLT_D4_FORBIDDEN_VALUE_PATTERNS,
  QLT_D4_OUTCOMES,
  QLT_D4_PROFILE,
  QLT_D4_PROOF_CONTRACT_ID,
  QLT_D4_REQUIRED_CHECKS,
} from '../../src/lib/sharedworld/d4-contract.ts';

// ---------------------------------------------------------------------------
// Receipt validation
// ---------------------------------------------------------------------------

const MAX_DETAIL_BYTES = 2048;
const CONTEXT_MARKER = '<<<QLT:SHARED-WORLD-CONTEXT:V1>>>';

/** A receipt is `{seq, kind, check?, ok?, atMs?, detail?}` — nothing else. */
export function validateReceipt(candidate) {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return { ok: false, code: QLT_D4_CODES.EVIDENCE_INVALID, reason: 'receipt must be an object' };
  }
  const keys = Object.keys(candidate).sort();
  const allowed = ['atMs', 'check', 'detail', 'kind', 'ok', 'seq'];
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return { ok: false, code: QLT_D4_CODES.EVIDENCE_INVALID, reason: `unknown key: ${key}` };
    }
  }
  if (!QLT_D4_EVIDENCE_KINDS.includes(candidate.kind)) {
    return { ok: false, code: QLT_D4_CODES.EVIDENCE_INVALID, reason: 'unknown receipt kind' };
  }
  if (candidate.kind === 'receipt') {
    if (typeof candidate.check !== 'string' || candidate.check.length === 0) {
      return {
        ok: false,
        code: QLT_D4_CODES.EVIDENCE_INVALID,
        reason: 'receipt requires a check id',
      };
    }
    if (typeof candidate.ok !== 'boolean') {
      return {
        ok: false,
        code: QLT_D4_CODES.EVIDENCE_INVALID,
        reason: 'receipt requires a boolean ok',
      };
    }
  }
  const detail = candidate.detail;
  if (detail !== undefined) {
    if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) {
      return { ok: false, code: QLT_D4_CODES.EVIDENCE_INVALID, reason: 'detail must be an object' };
    }
    for (const key of Object.keys(detail)) {
      if (QLT_D4_FORBIDDEN_DETAIL_KEYS.includes(key)) {
        return {
          ok: false,
          code: QLT_D4_CODES.EVIDENCE_INVALID,
          reason: `forbidden detail key (raw content): ${key}`,
        };
      }
      const value = detail[key];
      if (typeof value !== 'string') {
        continue;
      }
      if (value.length > MAX_DETAIL_BYTES) {
        return {
          ok: false,
          code: QLT_D4_CODES.EVIDENCE_INVALID,
          reason: `detail value exceeds ${MAX_DETAIL_BYTES} bytes: ${key}`,
        };
      }
      for (const pattern of QLT_D4_FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          return {
            ok: false,
            code: QLT_D4_CODES.EVIDENCE_INVALID,
            reason: `forbidden value pattern in detail: ${key}`,
          };
        }
      }
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export function createEvidenceLedger() {
  /** @type {Array<object>} */
  const receipts = [];
  let seq = 0;

  const append = (candidate) => {
    const verdict = validateReceipt(candidate);
    if (!verdict.ok) {
      return verdict;
    }
    // Amendment 1: the check-id set is CLOSED. An invented or
    // model-proposed check id can never enter the evidence ledger —
    // only the frozen required ids are valid receipts; notes carry no
    // check id and stay available for structural annotations.
    if (candidate.kind === 'receipt' && !QLT_D4_REQUIRED_CHECKS.includes(candidate.check)) {
      return { ok: false, reason: 'unknown check id' };
    }
    seq += 1;
    receipts.push({ ...candidate, seq });
    return { ok: true, seq };
  };

  /** Scan every receipt for leak material; returns a list of hits. */
  const scan = (needles) => {
    const hits = [];
    const serialized = JSON.stringify(receipts);
    for (const { label, needle } of needles) {
      if (typeof needle === 'string' && needle.length > 0 && serialized.includes(needle)) {
        hits.push(label);
      }
    }
    return hits;
  };

  const has = (check, ok = true) =>
    receipts.some((r) => r.kind === 'receipt' && r.check === check && r.ok === ok);

  const receiptFor = (check) => receipts.find((r) => r.kind === 'receipt' && r.check === check);

  return { append, scan, has, receiptFor, receipts: () => [...receipts] };
}

// ---------------------------------------------------------------------------
// Seal (fail closed)
// ---------------------------------------------------------------------------

/**
 * Seal the ledger into the truthful outcome. Never throws; always
 * returns a plain summary document with structural fields only.
 */
export function sealEvidence(ledger, options) {
  const { credentialNeedle, scenarioDigest, sessionStartedAtMs, sessionEndedAtMs } = options;

  // 1. Scan hits refuse the seal entirely.
  const hits = ledger.scan([
    { label: 'credential', needle: credentialNeedle },
    { label: 'scenario-digest', needle: scenarioDigest },
    { label: 'context-marker', needle: CONTEXT_MARKER },
  ]);
  if (hits.length > 0) {
    return { outcome: 'failed', code: QLT_D4_CODES.SCAN_HIT, hits };
  }

  // 2. Any explicit failure receipt makes the outcome failure.
  const failedChecks = ledger
    .receipts()
    .filter((r) => r.kind === 'receipt' && r.ok === false)
    .map((r) => r.check);
  if (failedChecks.length > 0) {
    return { outcome: 'failed', code: QLT_D4_CODES.PROOF_POINT_FAILED, failedChecks };
  }

  // 3. Every required check must be present (partial evidence cannot
  //    seal as success).
  const missing = QLT_D4_REQUIRED_CHECKS.filter((check) => !ledger.has(check));
  if (missing.length > 0) {
    return { outcome: 'failed', code: QLT_D4_CODES.EVIDENCE_INVALID, missing };
  }

  // 4. Prerequisites must hold with matching identities (the
  //    false-claim defence).
  for (const check of QLT_D4_REQUIRED_CHECKS) {
    const rules = QLT_D4_CHECK_PREREQUISITES[check] ?? [];
    const receipt = ledger.receiptFor(check);
    for (const rule of rules) {
      const prereq = ledger.receiptFor(rule.check);
      if (prereq === undefined) {
        return {
          outcome: 'failed',
          code: QLT_D4_CODES.EVIDENCE_INVALID,
          unsatisfied: `${check} <- ${rule.check}`,
        };
      }
      if (rule.sameField !== undefined) {
        const own = receipt.detail?.[rule.sameField];
        const theirs = prereq.detail?.[rule.sameField];
        if (typeof own !== 'string' || typeof theirs !== 'string' || own !== theirs) {
          return {
            outcome: 'failed',
            code: QLT_D4_CODES.EVIDENCE_INVALID,
            unsatisfied: `${check} identity mismatch on ${rule.sameField}`,
          };
        }
      }
    }
  }

  const checks = {};
  for (const check of QLT_D4_REQUIRED_CHECKS) {
    checks[check] = true;
  }
  return {
    outcome: 'passed',
    contract: QLT_D4_PROOF_CONTRACT_ID,
    profile: QLT_D4_PROFILE,
    checks,
    sessionStartedAtMs: sessionStartedAtMs ?? null,
    sessionEndedAtMs: sessionEndedAtMs ?? null,
  };
}

/** A truthful failure seal (structural fields only). */
export function sealFailure(code, detail = {}) {
  return { outcome: 'failed', code, ...detail };
}

// ---------------------------------------------------------------------------
// Authorization receipt (one-shot)
// ---------------------------------------------------------------------------

/** Exclusive-create the authorization receipt; refuses reuse. */
export function writeAuthorizationReceipt(receiptPath, authorization) {
  try {
    writeFileSync(receiptPath, JSON.stringify(authorization, null, 2) + '\n', { flag: 'wx' });
    return { ok: true };
  } catch {
    return { ok: false, code: QLT_D4_CODES.ALREADY_AUTHORIZED };
  }
}

/** Read the receipt; refuses malformed content truthfully. */
export function readAuthorizationReceipt(receiptPath) {
  if (!existsSync(receiptPath)) {
    return { ok: false, code: QLT_D4_CODES.NOT_AUTHORIZED };
  }
  try {
    const parsed = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.profile !== QLT_D4_PROFILE ||
      typeof parsed.authorizedAt !== 'string'
    ) {
      return { ok: false, code: QLT_D4_CODES.AUTHORIZATION_MALFORMED };
    }
    return { ok: true, authorization: parsed };
  } catch {
    return { ok: false, code: QLT_D4_CODES.AUTHORIZATION_MALFORMED };
  }
}

// ---------------------------------------------------------------------------
// Bounds and plan budget (enforced BEFORE any transport)
// ---------------------------------------------------------------------------

/**
 * A scenario plan is the fixed structural step list with owner-supplied
 * content OUTSIDE the repository. The budget check refuses any plan
 * whose turn/request profile exceeds the frozen bounds before the
 * first transport would ever occur.
 */
export function planBudget(plan) {
  const turns = plan.userTurns ?? 0;
  const requests = plan.providerRequests ?? 0;
  const tokensPerRequest = plan.maxOutputTokensPerRequest ?? 0;
  const deadlineMs = plan.maxTurnDeadlineMs ?? 0;
  const exceeded = [];
  const bounds = {
    maxUserTurns: 10,
    maxProviderRequests: 20,
    maxOutputTokensPerRequest: 2048,
    maxTurnDeadlineMs: 120_000,
  };
  if (turns > bounds.maxUserTurns) exceeded.push('userTurns');
  if (requests > bounds.maxProviderRequests) exceeded.push('providerRequests');
  if (tokensPerRequest > bounds.maxOutputTokensPerRequest) exceeded.push('outputTokensPerRequest');
  if (deadlineMs > bounds.maxTurnDeadlineMs) exceeded.push('turnDeadlineMs');
  return exceeded.length === 0 ? { ok: true } : { ok: false, exceeded };
}

// ---------------------------------------------------------------------------
// Workspace policy
// ---------------------------------------------------------------------------

/**
 * The structured session's data directory must live INSIDE the
 * task-owned root and outside both the repository and the default
 * operator directory. Returns the resolved workspace path or a refusal.
 */
export function resolveWorkspace(taskRoot, repositoryDir, operatorDir) {
  const task = resolve(taskRoot);
  const repo = resolve(repositoryDir);
  const operator = operatorDir === undefined ? undefined : resolve(operatorDir);
  if (task === repo || isAncestor(repo, task)) {
    return {
      ok: false,
      code: QLT_D4_CODES.EVIDENCE_INVALID,
      reason: 'workspace inside repository',
    };
  }
  if (operator !== undefined && (task === operator || isAncestor(operator, task))) {
    return {
      ok: false,
      code: QLT_D4_CODES.EVIDENCE_INVALID,
      reason: 'workspace inside the default operator directory',
    };
  }
  return { ok: true, workspace: task };
}

function isAncestor(parent, candidate) {
  const rel = relative(parent, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

// ---------------------------------------------------------------------------
// Scenario digest (memory-only; never persisted)
// ---------------------------------------------------------------------------

export function scenarioDigestOf(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The export receipt must record a disclosure-bearing document. Only
 * structural markers are inspected; no export content is stored.
 */
export function exportDisclosurePresent(document) {
  return (
    typeof document === 'object' &&
    document !== null &&
    typeof document.disclosure === 'object' &&
    document.disclosure !== null
  );
}

export { CONTEXT_MARKER };
