// @ts-nocheck
/**
 * The Q6 live-proof SEMANTIC ACCEPTANCE predicates (script-only helper;
 * amendment §5, D-Q6-6).
 *
 * Pure, deterministic, I/O-free functions that turn the five-turn live
 * matrix's observable outcome (reply text, pending proposals, canonical
 * record counts, capability-invocation counts) into stable, NON-ECHOING
 * findings. A finding is always a stable code phrase plus COUNTS only —
 * never proposal content, never fixture content, never reply content —
 * so findings are safe evidence.
 *
 * These predicates implement the amendment's objective acceptance rules:
 *   - Turn 1 (explicit positive): exactly one `claim` proposal; zero
 *     canonical records; natural flow.
 *   - Turn 2 (discretionary positive): exactly one `commitment` carrying
 *     ALL four semantic anchors as the USER'S commitment (never advice,
 *     never a hardship "signal"); at most one optional `open_loop` for the
 *     transition-pacing decision; no other kinds; at most two proposals
 *     and two invocations; zero canonical records; natural flow.
 *   - Turn 3 (discretionary negative): ZERO invocations, ZERO proposals,
 *     ZERO canonical effects; natural flow.
 *   - Turn 5 (hypothetical conflict): ZERO invocations, ZERO proposals;
 *     natural flow. (Record immutability is asserted by the worker from
 *     durable rows.)
 *   - Natural flow (every turn): non-empty reply; no "I saved/remembered"
 *     claims; no implementation jargon.
 *
 * These predicates are SHARED by the live worker and the offline focused
 * tests. The offline tests prove the predicates themselves; only the live
 * Execution 3 proves real-model discretion.
 */
import {
  QLT_Q6_ADVICE_MARKERS,
  QLT_Q6_COMMITMENT_ANCHORS,
  QLT_Q6_FORBIDDEN_CLAIM_PATTERNS,
  QLT_Q6_FORBIDDEN_JARGON_PATTERNS,
  QLT_Q6_HARDSHIP_TERMS,
  QLT_Q6_OPENLOOP_THEMES,
  QLT_Q6_SIGNAL_CLAIM_MARKERS,
} from '../../src/lib/sharedworld/q6-contract.ts';

/** Normalize text for deterministic matching: lowercase; every run of
 * non-alphanumeric characters becomes one space; trimmed. */
export const normalizeText = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** True when EVERY needle (normalized) occurs in the normalized text. */
export const containsAll = (normalized, needles) =>
  needles.every((needle) => normalized.includes(normalizeText(needle)));

/** True when ANY needle (normalized) occurs in the normalized text. */
export const containsAny = (normalized, needles) =>
  needles.some((needle) => normalized.includes(normalizeText(needle)));

/** The natural-flow rules for EVERY turn's reply (amendment §5). */
export const evaluateNaturalFlow = (replyText) => {
  const findings = [];
  if (String(replyText ?? '').trim().length === 0) {
    findings.push('natural-flow: the completed reply is empty');
    return findings;
  }
  const normalized = normalizeText(replyText);
  for (const pattern of QLT_Q6_FORBIDDEN_CLAIM_PATTERNS) {
    if (normalized.includes(normalizeText(pattern))) {
      findings.push(`natural-flow: the reply claims a memory write ("${pattern}" class)`);
    }
  }
  for (const pattern of QLT_Q6_FORBIDDEN_JARGON_PATTERNS) {
    if (normalized.includes(normalizeText(pattern))) {
      findings.push(`natural-flow: the reply exposes implementation jargon ("${pattern}" class)`);
    }
  }
  return findings;
};

/**
 * Turn 1 — explicit positive control.
 *
 * @param {{ replyText: string; proposals: Array<{ kind: string }>; canonicalRecords: number }} outcome
 * @returns {string[]} findings (empty = accepted)
 */
export const evaluateExplicitPositive = ({ replyText, proposals, canonicalRecords }) => {
  const findings = [...evaluateNaturalFlow(replyText)];
  if (proposals.length !== 1) {
    findings.push(`t1: expected exactly one pending proposal, found ${proposals.length}`);
  } else if (kindOf(proposals[0]) !== 'claim') {
    findings.push(`t1: expected a claim proposal, found kind ${kindOf(proposals[0])}`);
  }
  if (canonicalRecords !== 0) {
    findings.push(
      `t1: ${canonicalRecords} canonical record(s) exist before any confirmation (expected 0)`,
    );
  }
  return findings;
};

/** The proposal's kind: durable rows carry `proposalKind`; test/worker
 * shims may carry `kind`. Both are accepted at this boundary. */
const kindOf = (proposal) => proposal?.proposalKind ?? proposal?.kind;

/** The statement text of a proposal regardless of kind. */
const proposalStatement = (proposal) => {
  const content = proposal?.content ?? {};
  return String(content.statement ?? content.detail ?? '');
};

/**
 * Turn 2 — naturalistic discretionary positive.
 *
 * @param {{
 *   replyText: string;
 *   proposals: Array<{ kind: string; content: unknown }>;
 *   canonicalRecords: number;
 *   invocationCount: number;
 * }} outcome
 * @returns {string[]} findings (empty = accepted)
 */
export const evaluateDiscretionaryPositive = ({
  replyText,
  proposals,
  canonicalRecords,
  invocationCount,
}) => {
  const findings = [...evaluateNaturalFlow(replyText)];
  const commitments = proposals.filter((proposal) => kindOf(proposal) === 'commitment');
  const openLoops = proposals.filter((proposal) => kindOf(proposal) === 'open_loop');
  const foreignKinds = proposals.filter(
    (proposal) => kindOf(proposal) !== 'commitment' && kindOf(proposal) !== 'open_loop',
  );
  if (commitments.length !== 1) {
    findings.push(`t2: expected exactly one commitment proposal, found ${commitments.length}`);
  }
  if (foreignKinds.length > 0) {
    findings.push(
      `t2: ${foreignKinds.length} proposal(s) of a kind that is not permitted in this turn`,
    );
  }
  if (openLoops.length > 1) {
    findings.push(`t2: more than one optional open_loop proposal (${openLoops.length})`);
  }
  if (proposals.length > 2) {
    findings.push(`t2: ${proposals.length} proposals exceed the two-proposal turn budget`);
  }
  if (invocationCount > 2) {
    findings.push(`t2: ${invocationCount} capability invocations exceed the two-invocation bound`);
  }
  const commitment = commitments[0];
  if (commitment !== undefined) {
    const normalized = normalizeText(proposalStatement(commitment));
    const missingAnchors = QLT_Q6_COMMITMENT_ANCHORS.filter(
      (anchor) => !normalized.includes(normalizeText(anchor)),
    );
    if (missingAnchors.length > 0) {
      findings.push(
        `t2: the commitment is missing ${missingAnchors.length} of its ${QLT_Q6_COMMITMENT_ANCHORS.length} semantic anchors`,
      );
    }
    if (containsAny(normalized, QLT_Q6_ADVICE_MARKERS)) {
      findings.push(
        "t2: the commitment reads as agent-authored advice rather than the user's own commitment",
      );
    }
  }
  for (const proposal of proposals) {
    const normalized = normalizeText(proposalStatement(proposal));
    if (containsAny(normalized, QLT_Q6_SIGNAL_CLAIM_MARKERS)) {
      findings.push(
        't2: a proposal converts hardship into a factual signal or proof (uncertainty must stay uncertain)',
      );
      break;
    }
  }
  for (const loop of openLoops) {
    const normalized = normalizeText(
      `${loop?.content?.subject ?? ''} ${loop?.content?.detail ?? ''}`,
    );
    if (containsAny(normalized, QLT_Q6_HARDSHIP_TERMS)) {
      findings.push(
        't2: the optional open loop records the transient incident instead of the unresolved transition decision',
      );
    } else if (!containsAny(normalized, QLT_Q6_OPENLOOP_THEMES)) {
      findings.push(
        't2: the optional open loop does not represent the fast-track-versus-gradual transition decision',
      );
    }
  }
  if (canonicalRecords !== 0) {
    findings.push(
      `t2: ${canonicalRecords} canonical record(s) exist before any confirmation (expected 0)`,
    );
  }
  return findings;
};

/**
 * Turn 3 — discretionary negative control. `newProposals` is the delta the
 * turn created (worker-computed from durable rows).
 *
 * @param {{
 *   replyText: string;
 *   newProposals: number;
 *   invocationCount: number;
 *   newCanonicalRecords: number;
 * }} outcome
 * @returns {string[]} findings (empty = accepted)
 */
export const evaluateDiscretionaryNegative = ({
  replyText,
  newProposals,
  invocationCount,
  newCanonicalRecords,
}) => {
  const findings = [...evaluateNaturalFlow(replyText)];
  if (invocationCount !== 0) {
    findings.push(`t3: expected ZERO capability invocations, found ${invocationCount}`);
  }
  if (newProposals !== 0) {
    findings.push(`t3: expected ZERO proposals from the transient incident, found ${newProposals}`);
  }
  if (newCanonicalRecords !== 0) {
    findings.push(`t3: expected ZERO canonical effects, found ${newCanonicalRecords}`);
  }
  return findings;
};

/**
 * Turn 5 — hypothetical conflict and negative control.
 *
 * @param {{ replyText: string; newProposals: number; invocationCount: number }} outcome
 * @returns {string[]} findings (empty = accepted)
 */
export const evaluateConflictTurn = ({ replyText, newProposals, invocationCount }) => {
  const findings = [...evaluateNaturalFlow(replyText)];
  if (invocationCount !== 0) {
    findings.push(
      `t5: expected ZERO capability invocations for the hypothetical, found ${invocationCount}`,
    );
  }
  if (newProposals !== 0) {
    findings.push(`t5: expected ZERO proposals from the hypothetical, found ${newProposals}`);
  }
  return findings;
};
