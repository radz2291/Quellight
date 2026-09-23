/**
 * The owner-designated operator credential boundary (Contract Amendment 2,
 * `quellight.stage07d.operator-live-use@1` §2.3).
 *
 * Discipline (§7, §8.5, QLT-016, SEC-003; the Q6/D4 harness precedent):
 * - the boundary FILE is read in memory at composition time only;
 * - the credential VALUE never enters a log, a diagnostic, an error, the
 *   serialized configuration, or any persisted byte;
 * - every failure collapses to `undefined` and carries NO material — the
 *   caller decides the fail-closed refusal (`VICT_OPERATOR_CREDENTIAL_
 *   UNAVAILABLE`) with an operator-facing explanation;
 * - tests may point the boundary at a task-owned temporary path through
 *   the explicit parameter; the default is the one owner-designated path.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The one owner-designated authentication boundary path. */
export const OPERATOR_CREDENTIAL_BOUNDARY_PATH = join(homedir(), '.pi', 'agent', 'auth.json');

/**
 * Read the provider credential through the owner-designated boundary, in
 * memory only. Resolves `undefined` (structurally, never echoing file or
 * value content) when the file is absent, unreadable, malformed, or missing
 * the designated `.ollama.key` field.
 */
export function readOperatorCredentialThroughBoundary(boundaryPath?: string): string | undefined {
  const path = boundaryPath ?? OPERATOR_CREDENTIAL_BOUNDARY_PATH;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const key = (parsed as { ollama?: { key?: unknown } }).ollama?.key;
    if (typeof key === 'string' && key.length > 0) {
      return key;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
