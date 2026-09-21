#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q6 — the BOUNDED LIVE-provider Shared World
 * ceremony proof (N-C24; `npm run verify:q6:live`) — PARENT PROCESS.
 *
 * FROZEN CONTRACT (as amended):
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md and the
 * bounded-memory-discretion amendment
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-BOUNDED-DISCRETION-AMENDMENT.md
 * (D-Q6-6), with the frozen declarative data in
 * `src/lib/sharedworld/q6-contract.ts`.
 *
 * PARENT/WORKER LIFECYCLE (amendment §6): this script is the PARENT. It
 * holds the double refusal gate (exit 2), allocates the ONE verified
 * disposable OS-temporary root, validates the EXTERNAL natural fixture
 * (non-echoing), and spawns the CHILD WORKER
 * (`scripts/lib/q6-live-worker.mjs`) which runs every composition,
 * provider turn, restart, and ceremony operation. ONLY after the worker
 * has exited does the parent read the worker's result record, re-verify
 * the fixture content identity, run the byte-level credential scan, and
 * dispose the owned root (exactly once; cleanup failure remains proof
 * failure). The TRUE exit code of the proof is propagated unmasked.
 *
 * HARD GATE (the script refuses to run otherwise, exit 2):
 *   - QUELLIGHT_LIVE_PROOF must be set to exactly 1 in the environment;
 *   - OLLAMA_API_KEY must be PRESENT in the process environment
 *     (existence only; the value is never printed, inspected, hashed,
 *     serialized, or written anywhere by this harness);
 *   - QUELLIGHT_Q6_NATURAL_FIXTURE_FILE must name a valid external
 *     UTF-8 fixture file (absolute; outside the repository and
 *     `.quellight-data`; <= 12288 bytes; no NUL bytes) — validated
 *     WITHOUT echoing the path or the content.
 *
 * BOUNDS (frozen, as amended): <= 6 provider turns (the matrix plans
 * 5); <= 512 output tokens per turn (amended from 256); <= 120 s
 * deadline per turn; exactly ONE authoritative execution per owner
 * authorization (never re-run silently); ZERO automatic provider
 * retries; one provider, one model, no fallback.
 *
 * This script runs OUTSIDE every automatic gate, by explicit operator
 * invocation, after ALL offline gates are green, exactly once.
 */
import { runQ6LiveProof } from './lib/q6-live-parent.mjs';

const outcome = await runQ6LiveProof({
  env: process.env,
  repoRoot: process.cwd(),
});

if (outcome.refused !== undefined) {
  console.error(`REFUSED: ${outcome.refused}`);
  process.exit(2);
}

console.log('');
if (outcome.result !== undefined) {
  const turns = Array.isArray(outcome.result.turns) ? outcome.result.turns : [];
  for (const turn of turns) {
    console.log(
      `  turn ${turn.id}: status=${turn.status}, ${turn.elapsedMs}ms, ${turn.invocations} invocation(s), ${turn.proposals} proposal(s)`,
    );
  }
  console.log(
    `  provider turns used: ${outcome.result.providerTurns} (planned five; frozen ceiling six)`,
  );
}
console.log(
  `  fixture identity: ${outcome.fixture?.byteLength ?? '?'} bytes, sha256 ${outcome.fixture?.sha256 ?? '?'}`,
);
console.log(`  lifecycle ordering: ${outcome.order.join(' -> ')}`);

if (outcome.exit !== 0) {
  console.error('');
  console.error(
    `verify:q6:live: FAILED with ${outcome.findings.length} finding(s) — the live proof is a TRUTHFUL FAILURE; it was executed once and is never silently rerun.`,
  );
  process.exit(outcome.exit);
}
console.log('');
console.log(
  'verify:q6:live: PASS — the five-turn bounded live discretion matrix is green (explicit remembering, discretionary durable meaning with the four commitment anchors, transient abstention, governed user ceremony, restart, fresh-thread C1 continuity, hypothetical conflict non-mutation; credential absent from every observable surface; the external fixture untouched).',
);
process.exit(0);
