/**
 * The Q5 Memory Mode policy store and typed effective-policy resolver
 * (Lane A).
 *
 * FROZEN CONTRACT:
 * docs/report/QUELLIGHT-STAGE-07C-PHASE-Q5-CONTRACT-FREEZE.md and the
 * frozen declarative module `policy-contract.ts` (mode identities,
 * migration 4 inventory, evidence shape, codes). This module conforms to
 * that data and contains the executable policy mechanics.
 *
 * What this module is:
 * - the durable product-default Memory Mode storage (singleton row in
 *   `qlt_memory_policy`, migration 4) with value-idempotent, user-
 *   attributed, revision-monotonic updates in ONE transaction;
 * - the ONE typed resolution boundary for the effective Memory Mode
 *   (freeze §7/§16): the assembler consumes the RESOLVED policy carried
 *   by the turn assembly scope — there are no global-setting conditionals
 *   scattered through routes, UI, or selection code. This centralization
 *   is the future project-scope extension seam: a later additive
 *   migration + resolver extension can resolve a project-specific policy
 *   against this durable default WITHOUT rewriting existing global-policy
 *   history (explicitly NOT implemented now; no project fields, tables,
 *   selectors, or placeholders exist).
 *
 * What this module is NOT:
 * - NOT a per-turn authority: the per-turn binding is the admission-time
 *   scope value plus the immutable `qlt_turn_memory_policy` evidence
 *   written at first assembly (see `context-assembler.ts`);
 * - NOT agent-reachable: every mutation is user-attributed
 *   (`actor-*` identities only; `agent-*` fails closed at the surface
 *   and the store CHECK);
 * - NOT a second mutation path: the only caller is the declared
 *   `act.setMemoryMode` action through the released governed boundary.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  QLT_MEMORY_MODE_DEFAULT,
  QLT_MEMORY_MODE_INVALID,
  QLT_MEMORY_MODE_POLICY_ID,
  QLT_MEMORY_MODES,
  QLT_MEMORY_POLICY_ROW_ID,
  type QltMemoryMode,
  type QltResolvedMemoryPolicy,
  type QltTurnMemoryPolicyRecord,
} from './policy-contract.js';

/** A policy-store failure with a stable, non-echoing code. */
export class QltMemoryPolicyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'QltMemoryPolicyError';
    this.code = code;
  }
}

/** The durable policy row (mirrors the frozen inventory). */
export interface QltMemoryPolicyRow {
  readonly policyId: string;
  readonly mode: QltMemoryMode;
  readonly revision: number;
  readonly updatedBy: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

function assertMode(mode: unknown): QltMemoryMode {
  if (typeof mode !== 'string' || !(QLT_MEMORY_MODES as readonly string[]).includes(mode)) {
    // Non-echoing: the invalid value never appears in the message.
    throw new QltMemoryPolicyError(
      QLT_MEMORY_MODE_INVALID,
      'The requested memory mode is outside the closed vocabulary.',
    );
  }
  // The includes check above proved membership in the closed vocabulary.
  return mode as QltMemoryMode;
}

function assertActor(actorId: unknown): string {
  if (typeof actorId !== 'string' || !/^actor-[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(actorId)) {
    throw new QltMemoryPolicyError(
      'QLT_MEMORY_POLICY_FORBIDDEN',
      'A memory-mode change requires a user identity.',
    );
  }
  return actorId;
}

export interface MemoryPolicyStoreOptions {
  readonly db: DatabaseSync;
  /** Deterministic clock (epoch ms). */
  readonly clock: () => number;
  /** The SERVER-DERIVED local user actor (never client-supplied). */
  readonly localActorId: string;
}

export interface MemoryPolicyStore {
  /** Resolve the current durable default policy (lazily seeds the row). */
  resolveCurrent(): QltResolvedMemoryPolicy;
  /** Read the full durable policy row (seeding on first read). */
  getPolicyRow(): QltMemoryPolicyRow;
  /**
   * Set the mode (user-attributed; value-idempotent; ONE transaction).
   * Setting the SAME mode converges without a revision bump. Returns the
   * resulting row.
   */
  setMode(input: { readonly mode: QltMemoryMode; readonly updatedBy: string }): QltMemoryPolicyRow;
  /**
   * Record the immutable per-turn applied-policy evidence
   * (INSERT-or-converge on turn_id; NEVER updated). Returns the durable
   * row (the winner on convergence).
   */
  recordTurnPolicy(record: {
    readonly turnId: string;
    readonly policy: QltResolvedMemoryPolicy;
  }): QltTurnMemoryPolicyRecord;
  /** Read the per-turn applied-policy evidence (undefined when absent). */
  getTurnPolicy(turnId: string): QltTurnMemoryPolicyRecord | undefined;
}

export function createMemoryPolicyStore(options: MemoryPolicyStoreOptions): MemoryPolicyStore {
  const { db, clock } = options;

  function rowToPolicy(row: Record<string, unknown>): QltMemoryPolicyRow {
    return {
      policyId: String(row['policy_id'] ?? ''),
      mode: row['mode'] as QltMemoryMode,
      revision: Number(row['revision'] ?? 0),
      updatedBy: String(row['updated_by'] ?? ''),
      createdAtMs: Number(row['created_at_ms'] ?? 0),
      updatedAtMs: Number(row['updated_at_ms'] ?? 0),
    };
  }

  function rowToTurnPolicy(row: Record<string, unknown>): QltTurnMemoryPolicyRecord {
    return {
      turnId: String(row['turn_id'] ?? ''),
      policyId: String(row['policy_id'] ?? ''),
      mode: row['mode'] as QltMemoryMode,
      policyRevision: Number(row['policy_revision'] ?? 0),
      recordedAtMs: Number(row['recorded_at_ms'] ?? 0),
    };
  }

  function getPolicyRowOrNull(): QltMemoryPolicyRow | undefined {
    const row = db
      .prepare('SELECT * FROM qlt_memory_policy WHERE id = ?;')
      .get(QLT_MEMORY_POLICY_ROW_ID) as Record<string, unknown> | undefined;
    return row === undefined ? undefined : rowToPolicy(row);
  }

  function seedDefaultRow(): void {
    // One transaction; INSERT OR IGNORE makes concurrent seeding converge.
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(
        `INSERT INTO qlt_memory_policy
           (id, policy_id, mode, revision, updated_by, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING;`,
      ).run(
        QLT_MEMORY_POLICY_ROW_ID,
        QLT_MEMORY_MODE_POLICY_ID,
        QLT_MEMORY_MODE_DEFAULT,
        options.localActorId,
        clock(),
        clock(),
      );
      db.exec('COMMIT;');
    } catch (cause) {
      db.exec('ROLLBACK;');
      throw cause;
    }
  }

  function ensurePolicyRow(): QltMemoryPolicyRow {
    const existing = getPolicyRowOrNull();
    if (existing !== undefined) {
      return existing;
    }
    seedDefaultRow();
    const seeded = getPolicyRowOrNull();
    if (seeded === undefined) {
      throw new QltMemoryPolicyError(
        'QLT_STORE_ERROR',
        'The memory policy row could not be established.',
      );
    }
    return seeded;
  }

  const store: MemoryPolicyStore = {
    resolveCurrent(): QltResolvedMemoryPolicy {
      const row = ensurePolicyRow();
      return {
        policyId: QLT_MEMORY_MODE_POLICY_ID,
        mode: row.mode,
        revision: row.revision,
      };
    },

    getPolicyRow(): QltMemoryPolicyRow {
      return ensurePolicyRow();
    },

    setMode(input): QltMemoryPolicyRow {
      const mode = assertMode(input.mode);
      const updatedBy = assertActor(input.updatedBy);
      db.exec('BEGIN IMMEDIATE;');
      try {
        // Ensure the seeded default row exists first (same transaction), so
        // the FIRST user change always bumps the revision from the seeded
        // default (revision 1) to revision 2 — the change count stays
        // truthful even when the first change precedes any read.
        db.prepare(
          `INSERT INTO qlt_memory_policy
             (id, policy_id, mode, revision, updated_by, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING;`,
        ).run(
          QLT_MEMORY_POLICY_ROW_ID,
          QLT_MEMORY_MODE_POLICY_ID,
          QLT_MEMORY_MODE_DEFAULT,
          updatedBy,
          clock(),
          clock(),
        );
        const current = getPolicyRowOrNull();
        if (current !== undefined && current.mode !== mode) {
          // Effective change: monotonic revision bump, one UPDATE.
          db.prepare(
            `UPDATE qlt_memory_policy
             SET mode = ?, revision = revision + 1, updated_by = ?, updated_at_ms = ?
             WHERE id = ?;`,
          ).run(mode, updatedBy, clock(), QLT_MEMORY_POLICY_ROW_ID);
        }
        db.exec('COMMIT;');
      } catch (cause) {
        db.exec('ROLLBACK;');
        // The closed mode CHECK is the third fence; map it to the stable
        // non-echoing code (defense in depth; the first two fences already
        // rejected invalid modes).
        const message = String((cause as { message?: string }).message ?? '');
        if (message.includes('CHECK')) {
          throw new QltMemoryPolicyError(
            QLT_MEMORY_MODE_INVALID,
            'The requested memory mode is outside the closed vocabulary.',
          );
        }
        throw cause;
      }
      return ensurePolicyRow();
    },

    recordTurnPolicy(record): QltTurnMemoryPolicyRecord {
      if (
        typeof record.turnId !== 'string' ||
        record.turnId.length === 0 ||
        record.turnId.length > 128
      ) {
        throw new QltMemoryPolicyError(
          'QLT_STORE_ERROR',
          'The per-turn policy evidence requires a bounded turn identity.',
        );
      }
      const existing = store.getTurnPolicy(record.turnId);
      if (existing !== undefined) {
        return existing;
      }
      try {
        db.prepare(
          `INSERT INTO qlt_turn_memory_policy
             (turn_id, policy_id, mode, policy_revision, recorded_at_ms)
           VALUES (?, ?, ?, ?, ?);`,
        ).run(
          record.turnId,
          QLT_MEMORY_MODE_POLICY_ID,
          record.policy.mode,
          record.policy.revision,
          clock(),
        );
      } catch (cause) {
        const message = String((cause as { message?: string }).message ?? '');
        if (!message.includes('UNIQUE')) {
          throw cause;
        }
        // Converged: another writer recorded this turn's evidence first.
      }
      const winner = store.getTurnPolicy(record.turnId);
      if (winner === undefined) {
        throw new QltMemoryPolicyError(
          'QLT_STORE_ERROR',
          'The per-turn policy evidence could not be recorded.',
        );
      }
      return winner;
    },

    getTurnPolicy(turnId): QltTurnMemoryPolicyRecord | undefined {
      if (typeof turnId !== 'string' || turnId.length === 0 || turnId.length > 128) {
        return undefined;
      }
      const row = db
        .prepare('SELECT * FROM qlt_turn_memory_policy WHERE turn_id = ?;')
        .get(turnId) as Record<string, unknown> | undefined;
      return row === undefined ? undefined : rowToTurnPolicy(row);
    },
  };

  return store;
}

/** Narrow a value into a QltMemoryMode or undefined (read-side guard). */
export function asMemoryMode(value: unknown): QltMemoryMode | undefined {
  return typeof value === 'string' && (QLT_MEMORY_MODES as readonly string[]).includes(value)
    ? (value as QltMemoryMode)
    : undefined;
}
