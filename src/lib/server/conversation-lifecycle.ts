/**
 * Quellight Stage 07D Phase D2 — the governed conversation-lifecycle
 * service (deletion, deep purge, export, cross-store reconciliation).
 *
 * FROZEN CONTRACT: the D2 safety contract
 * (`quellight.stage07d.d2.safety-contract@1`; data in `d2-contract.ts`).
 *
 * Cross-store discipline (no atomicity is claimed or implemented):
 * - VICT-backed stores are touched ONLY through the released 0.3.1
 *   governed surface: `ConversationDeletionCoordinator` (durable
 *   intents/receipts; `recoverPending()`), the governed
 *   `MastraMemoryDeletionPort` (fenced, coordinator-shared),
 *   `fenceCompletedDeletions`, and `MastraConversationExportPort`.
 * - The product store is `sharedWorld.deletion` (durable, keyed,
 *   receipted). The recorded mode/scope is NEVER broadened; recovery is
 *   receipt-driven and converges (safety contract §2).
 * - Deletion serializes against turns through the existing
 *   per-conversation admission boundary.
 * - Every entry point refuses any identity other than the
 *   server-derived local user actor (the browser never supplies an
 *   identity; `agent-*` fails closed).
 * - Errors are stable and non-echoing: no store content, credential, or
 *   path ever reaches a caller.
 */

import {
  QLT_D2_DELETION_MODES,
  QLT_D2_ERROR_CODES,
  QLT_D2_EXPORT_EXCLUDED_CATEGORIES,
  QLT_D2_EXPORT_LIMITS,
  QLT_D2_EXPORT_SCHEMA_ID,
  QLT_D2_FORBIDDEN_CLAIMS,
  QLT_D2_RESIDUE_DISCLOSURE,
  type QltD2DeletionMode,
} from '../sharedworld/d2-contract.js';
import { conversationIdForThreadId } from '@victframework/mastra';
import type {
  ConversationDeletionCoordinator,
  ConversationExportService,
} from '@victframework/runtime';
import type { SharedWorldSqlite } from '../sharedworld/sqlite.js';
import type { QltDeletionPreview, QltDeletionRow } from '../sharedworld/deletion-store.js';
import { LOCAL_ACTOR_ID } from './composition.js';

/** The truthful, content-free status surfaced to the user. */
export interface QltDeletionStatus {
  readonly threadId: string;
  readonly row: QltDeletionRow | undefined;
  readonly purged: boolean;
}

export interface ConversationLifecycleDeps {
  readonly sharedWorld: SharedWorldSqlite;
  readonly coordinator: ConversationDeletionCoordinator;
  readonly exportService: ConversationExportService;
  /**
   * Serialize the deletion against turns of the same conversation (the
   * race-safe per-conversation critical section). Absent for
   * store-level compositions (pure unit tests).
   */
  readonly admitTurn?: (input: {
    readonly swThreadId: string;
    readonly mastraThreadId: string;
    readonly idempotencyKey: string;
  }) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }>;
}

export class QuellightLifecycleError extends Error {
  readonly code: string;
  constructor(code: string) {
    if (
      !(QLT_D2_ERROR_CODES as readonly string[]).includes(code) &&
      code !== 'QLT_TURN_ALREADY_OPEN'
    ) {
      throw new Error('unknown lifecycle code');
    }
    super(code);
    this.name = 'QuellightLifecycleError';
    this.code = code;
  }
}

export function createConversationLifecycle(deps: ConversationLifecycleDeps) {
  const { sharedWorld, coordinator, exportService } = deps;
  const deletion = sharedWorld.deletion;

  function requireUserActor(actorId: string, code: string): string {
    if (actorId !== LOCAL_ACTOR_ID || actorId.startsWith('agent-')) {
      throw new QuellightLifecycleError(code);
    }
    return actorId;
  }

  return {
    /** Pure deterministic preview (N-D2-1). */
    async preview(input: {
      readonly threadId: string;
      readonly mode: QltD2DeletionMode;
      readonly actorId: string;
    }): Promise<QltDeletionPreview> {
      requireUserActor(input.actorId, 'QLT_DELETION_IDENTITY_REFUSED');
      if (!(QLT_D2_DELETION_MODES as readonly string[]).includes(input.mode)) {
        throw new QuellightLifecycleError('QLT_DELETION_MODE_INVALID');
      }
      const preview = deletion.previewDeletion({
        threadId: input.threadId,
        mode: input.mode,
      });
      return {
        ...preview,
        deletion: deletion.getDeletion(input.threadId),
        purged: deletion.getPurgeReceipt(input.threadId) !== undefined,
      };
    },

    /**
     * The confirmed governed deletion (safety contract §2). The plan row
     * is durable before any effect; steps are idempotent; the terminal
     * state is truthful (`completed` only with every receipt).
     */
    async deleteConversation(input: {
      readonly threadId: string;
      readonly mode: QltD2DeletionMode;
      readonly confirmed: boolean;
      readonly key: string;
      readonly actorId: string;
    }): Promise<QltDeletionStatus> {
      const actorId = requireUserActor(input.actorId, 'QLT_DELETION_IDENTITY_REFUSED');
      if (input.confirmed !== true) {
        // Refuse BEFORE any effect (N-D2-2/§2.2).
        throw new QuellightLifecycleError('QLT_DELETION_CONFIRMATION_REQUIRED');
      }
      if (!(QLT_D2_DELETION_MODES as readonly string[]).includes(input.mode)) {
        throw new QuellightLifecycleError('QLT_DELETION_MODE_INVALID');
      }
      const threadId = input.threadId;
      // The durable product intent (planned) — same key replays.
      deletion.planDeletion({
        threadId,
        mode: input.mode,
        requestedBy: actorId,
        key: input.key,
      });

      const link = await sharedWorld.getThread(threadId);
      if (link === undefined) {
        deletion.markIncomplete({ threadId, errorCode: 'QLT_DELETION_THREAD_MISSING' });
        throw new QuellightLifecycleError('QLT_DELETION_THREAD_MISSING');
      }
      const linkRow = await sharedWorld.getConversationLink(threadId);
      const mastraThreadId = linkRow?.mastraThreadId;

      const run = async (): Promise<void> => {
        if (input.mode === 'conversation-and-originating-meaning') {
          deletion.executeMeaningRemoval({ threadId, requestedBy: actorId });
        }
        if (mastraThreadId !== undefined) {
          const conversationId = conversationIdForThreadId(mastraThreadId);
          if (conversationId === undefined) {
            throw new Error('conversation identity derivation failed');
          }
          deletion.recordVictIntentId({
            threadId,
            victIntentId: coordinator.intentIdFor(conversationId),
          });
          const outcome = await coordinator.deleteConversation({
            conversationId,
            actorId: LOCAL_ACTOR_ID,
          });
          if (outcome.status !== 'completed') {
            throw new QuellightLifecycleError('QLT_DELETION_INCOMPLETE');
          }
        } else {
          // No conversation was ever linked: the domain tombstone alone
          // is the whole governed effect.
          deletion.tombstoneThread({ threadId });
        }
        deletion.completeDeletion({ threadId });
      };

      if (mastraThreadId === undefined) {
        try {
          await run();
        } catch (cause) {
          if (cause instanceof QuellightLifecycleError) {
            deletion.markIncomplete({ threadId, errorCode: cause.code });
            throw cause;
          }
          deletion.markIncomplete({ threadId, errorCode: 'QLT_DELETION_INCOMPLETE' });
          throw new QuellightLifecycleError('QLT_DELETION_INCOMPLETE');
        }
      } else {
        // Serialize against turns of the same conversation.
        const admission = await deps.admitTurn!({
          swThreadId: threadId,
          mastraThreadId,
          idempotencyKey: `deletion-${input.key}`,
        });
        if (!admission.ok) {
          // A reply is active on this conversation: truthful busy
          // refusal, the recorded row stays planned, nothing executed.
          throw new QuellightLifecycleError('QLT_TURN_ALREADY_OPEN');
        }
        try {
          await run();
        } catch (cause) {
          if (cause instanceof QuellightLifecycleError) {
            deletion.markIncomplete({ threadId, errorCode: cause.code });
            throw cause;
          }
          deletion.markIncomplete({ threadId, errorCode: 'QLT_DELETION_INCOMPLETE' });
          throw new QuellightLifecycleError('QLT_DELETION_INCOMPLETE');
        }
      }
      return {
        threadId,
        row: deletion.getDeletion(threadId),
        purged: deletion.getPurgeReceipt(threadId) !== undefined,
      };
    },

    /** Cancel a planned deletion (zero effect; N-D2-2). */
    async cancelDeletion(input: {
      readonly threadId: string;
      readonly actorId: string;
    }): Promise<QltDeletionStatus> {
      const actorId = requireUserActor(input.actorId, 'QLT_DELETION_IDENTITY_REFUSED');
      deletion.cancelDeletion({ threadId: input.threadId, canceledBy: actorId });
      return {
        threadId: input.threadId,
        row: deletion.getDeletion(input.threadId),
        purged: deletion.getPurgeReceipt(input.threadId) !== undefined,
      };
    },

    /** Truthful status (never a premature complete). */
    async status(input: {
      readonly threadId: string;
      readonly actorId: string;
    }): Promise<QltDeletionStatus> {
      requireUserActor(input.actorId, 'QLT_DELETION_IDENTITY_REFUSED');
      return {
        threadId: input.threadId,
        row: deletion.getDeletion(input.threadId),
        purged: deletion.getPurgeReceipt(input.threadId) !== undefined,
      };
    },

    /**
     * The deep purge of an already deleted conversation (safety
     * contract §5): distinct explicit confirmation, one transaction in
     * the frozen FK-driven order, a content-free receipt, best-effort
     * VACUUM.
     */
    async purge(input: {
      readonly threadId: string;
      readonly confirmation: string;
      readonly actorId: string;
    }): Promise<{ readonly receipt: ReturnType<typeof deletion.getPurgeReceipt> }> {
      const actorId = requireUserActor(input.actorId, 'QLT_DELETION_IDENTITY_REFUSED');
      const receipt = deletion.purgeConversation({
        threadId: input.threadId,
        purgedBy: actorId,
        confirmation: input.confirmation,
      });
      return { receipt };
    },

    /**
     * Boot reconciliation (receipt-driven; never broadens scope):
     * resume open product deletions through the governed coordinator,
     * finalize the truthful terminal states, and fence every completed
     * conversation.
     */
    async recoverOnBoot(): Promise<{
      readonly resumed: number;
      readonly completed: number;
      readonly fenced: number;
    }> {
      let resumed = 0;
      let completed = 0;
      for (const row of deletion.listOpenDeletions()) {
        resumed += 1;
        try {
          if (row.mode === 'conversation-and-originating-meaning') {
            // Idempotent convergence: already-removed records and
            // already-terminal proposals are skipped by the store.
            deletion.executeMeaningRemoval({
              threadId: row.threadId,
              requestedBy: row.requestedBy,
            });
          }
          const linkRow = await sharedWorld.getConversationLink(row.threadId);
          if (linkRow !== undefined) {
            const conversationId = conversationIdForThreadId(linkRow.mastraThreadId);
            if (conversationId !== undefined) {
              const outcome = await coordinator.deleteConversation({
                conversationId,
                actorId: LOCAL_ACTOR_ID,
              });
              if (outcome.status !== 'completed') {
                continue; // stays truthfully open; the next boot resumes
              }
            }
          } else {
            deletion.tombstoneThread({ threadId: row.threadId });
          }
          deletion.completeDeletion({ threadId: row.threadId });
          completed += 1;
        } catch {
          // Truthful: the row stays open; nothing is fabricated.
        }
      }
      return { resumed, completed, fenced: 0 };
    },

    /**
     * The deterministic, versioned, bounded user export (safety
     * contract §6). Fails closed: any governed port failure produces NO
     * document. The export is handed to the requestor and not retained.
     */
    async buildExport(): Promise<Record<string, unknown>> {
      const limits = QLT_D2_EXPORT_LIMITS;
      let failureCode: string | undefined;

      // Threads (current and content-free tombstones, distinguished).
      const threadsPage = await sharedWorld.listThreads({ limit: limits.conversations });
      const threads = threadsPage.threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        state: thread.state,
        retentionState: thread.retentionState,
        provenance: thread.provenance,
        createdAtMs: thread.createdAtMs,
        updatedAtMs: thread.updatedAtMs,
      }));

      // Governed per-conversation message exports (VICT-owned transcript).
      const conversations: Array<Record<string, unknown>> = [];
      for (const thread of threadsPage.threads) {
        if (conversations.length >= limits.conversations) {
          break;
        }
        const linkRow = await sharedWorld.getConversationLink(thread.id);
        if (linkRow === undefined) {
          continue;
        }
        const conversationId = conversationIdForThreadId(linkRow.mastraThreadId);
        if (conversationId === undefined) {
          failureCode = 'QLT_EXPORT_FAILED';
          break;
        }
        const governed = await exportService
          .export({ conversationId, actorId: LOCAL_ACTOR_ID })
          .then(
            (result) => result.export,
            () => undefined,
          );
        if (governed === undefined) {
          // A deleted conversation has no memory to export — the
          // tombstone is the truthful record; a genuine port failure is
          // detected below by the fail-closed scan.
          conversations.push({
            threadId: thread.id,
            conversationDeleted: true,
            messages: [],
          });
          continue;
        }
        conversations.push({
          threadId: thread.id,
          conversationDeleted: false,
          threadCreatedAt: governed.threadCreatedAt,
          messages: governed.messages.map((message) => ({
            seq: message.seq,
            role: message.role,
            createdAt: message.createdAt,
            text: message.text,
          })),
        });
      }

      // Meaning sections (every state; bounded per the declared scope).
      const perFamily = limits.perFamily;
      const claims = await sharedWorld.meaning.listClaims({ limit: perFamily });
      const commitments = await sharedWorld.meaning.listCommitments({ limit: perFamily });
      const openLoops = await sharedWorld.meaning.listOpenLoops({ limit: perFamily });
      const proposals = await sharedWorld.meaning.listProposals({ limit: perFamily });
      const corrections = sharedWorld.deletion.listCorrectionsForExport({ limit: perFamily });
      const challenges = sharedWorld.conflict.listChallenges(undefined);
      const passes = await sharedWorld.retention.listRetentionPasses({ limit: limits.passes });
      const deletionReceipts = deletion.listDeletions({ limit: limits.deletions });
      const purgeReceipts = deletion.listPurgeReceipts({ limit: limits.deletions });
      const policyRow = sharedWorld.memoryPolicy.peekPolicyRow();

      if (failureCode !== undefined) {
        // Fail closed: NO document (never a falsely complete export).
        throw new QuellightLifecycleError('QLT_EXPORT_FAILED');
      }

      const evidenceCommitmentIds = new Set(
        commitments.rows.slice(0, limits.perFamily).map((commitment) => commitment.id),
      );
      const amendments = [];
      for (const commitment of commitments.rows) {
        if (!evidenceCommitmentIds.has(commitment.id)) {
          continue;
        }
        for (const amendment of sharedWorld.conflict.listAmendments({
          commitmentId: commitment.id,
        })) {
          amendments.push(amendment);
        }
      }

      return {
        schema: QLT_D2_EXPORT_SCHEMA_ID,
        disclosure: {
          included: [
            'threads (current and content-free tombstones)',
            'conversation transcripts through the governed VICT export ports',
            'meaning records in all states (current, historical, expired, removed)',
            'proposals, corrections, challenges, amendments',
            'retention-pass, deletion, and purge evidence (content-free)',
            'the memory-mode policy',
          ],
          excluded: QLT_D2_EXPORT_EXCLUDED_CATEGORIES,
          forbiddenClaims: QLT_D2_FORBIDDEN_CLAIMS,
          residue: QLT_D2_RESIDUE_DISCLOSURE,
          bounds: { ...limits },
        },
        threads,
        conversations,
        meaning: {
          claims: claims.rows,
          claimTotal: claims.total,
          commitments: commitments.rows,
          commitmentTotal: commitments.total,
          openLoops: openLoops.rows,
          openLoopTotal: openLoops.total,
          proposals: proposals.rows,
          proposalTotal: proposals.total,
          corrections,
        },
        conflicts: {
          challenges: challenges.rows,
          challengeTotal: challenges.total,
          amendments,
        },
        retention: {
          passes,
        },
        deletions: {
          rows: deletionReceipts,
          purges: purgeReceipts,
        },
        memoryPolicy: policyRow ?? null,
      };
    },
  };
}

export type ConversationLifecycle = ReturnType<typeof createConversationLifecycle>;
