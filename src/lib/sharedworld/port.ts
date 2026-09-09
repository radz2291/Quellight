/**
 * The Quellight Shared World port (Stage 07B foundation).
 *
 * Ownership (Stage 07 architecture §5–§6; handoff §6):
 * - the Shared World store is QUELLIGHT-OWNED durable state in its own
 *   SQLite file (`shared-world.db`), physically separate from the VICT
 *   operational store and from the Mastra store;
 * - conversation persistence is NOT Shared World continuity. The only
 *   durable record family in 07B is the USER-created Shared World thread
 *   record (`qlt_thread`) plus the explicit conversation correlation
 *   record (`qlt_thread_conversation`);
 * - the agent/model has NO write path into the Shared World in 07B. Every
 *   write is user-initiated through this typed port; the conversation
 *   composition never receives a writer (proven by negative control
 *   N-12);
 * - the canonical thread-state vocabulary is DECLARED CLOSED in 07B:
 *   `active` | `dormant`. `waiting`/`resolved` arrive as additive
 *   migrations with later substages, never as semantic overloads;
 * - per-record retention metadata is present from day one (QLT-019
 *   foundation); the retention state vocabulary is equally closed:
 *   `currently-relevant` | `user-removed`.
 */

/** The closed 07B canonical thread-state vocabulary. */
export const QLT_THREAD_STATES = ['active', 'dormant'] as const;
export type QltThreadState = (typeof QLT_THREAD_STATES)[number];

/** The closed 07B retention-state vocabulary (QLT-019 foundation). */
export const QLT_RETENTION_STATES = ['currently-relevant', 'user-removed'] as const;
export type QltRetentionState = (typeof QLT_RETENTION_STATES)[number];

/** Provenance is closed: every 07B Shared World record is USER-created. */
export const QLT_THREAD_PROVENANCE = 'user' as const;

/** One durable Shared World thread record. */
export interface QltThread {
  readonly id: string;
  readonly title: string;
  readonly state: QltThreadState;
  readonly retentionState: QltRetentionState;
  readonly provenance: typeof QLT_THREAD_PROVENANCE;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

/** One conversation correlation record (Shared World thread ↔ Mastra thread). */
export interface QltThreadConversation {
  readonly id: string;
  readonly threadId: string;
  readonly mastraThreadId: string;
  readonly createdAtMs: number;
}

/** Domain errors of the Shared World port (stable, non-echoing). */
export type QltSharedWorldErrorCode =
  | 'QLT_THREAD_MISSING'
  | 'QLT_THREAD_EXISTS'
  | 'QLT_THREAD_ARCHIVED'
  | 'QLT_THREAD_INVALID_TITLE'
  | 'QLT_THREAD_INVALID_ID'
  | 'QLT_THREAD_INVALID_STATE'
  | 'QLT_STORE_UNAVAILABLE';

/** Structured Shared World port failure (never echoes content). */
export class QltSharedWorldError extends Error {
  readonly code: QltSharedWorldErrorCode;
  constructor(code: QltSharedWorldErrorCode, message: string) {
    super(message);
    this.name = 'QltSharedWorldError';
    this.code = code;
  }
}

/** Input for creating a Shared World thread (user-initiated). */
export interface CreateThreadInput {
  readonly title: string;
  readonly id?: string;
  readonly now?: number;
}

/** The Quellight-owned Shared World storage port. */
export interface SharedWorldPort {
  /** Create a thread record (user-initiated; provenance is always `user`). */
  createThread(input: CreateThreadInput): Promise<QltThread>;
  /** List thread records ordered by most recent activity. */
  listThreads(options?: {
    readonly state?: QltThreadState;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<{ readonly threads: readonly QltThread[]; readonly total: number }>;
  /** Get one thread record. */
  getThread(threadId: string): Promise<QltThread | undefined>;
  /** Rename a thread (dormant threads are read-only). */
  renameThread(threadId: string, title: string, now?: number): Promise<QltThread>;
  /** Archive a thread to `dormant` (read-only thereafter except reopen). */
  archiveThread(threadId: string, now?: number): Promise<QltThread>;
  /** Reopen a thread to `active`. */
  reopenThread(threadId: string, now?: number): Promise<QltThread>;
  /**
   * Ensure the conversation correlation record for a thread exists and
   * return it. Idempotent: one 07B conversation per Shared World thread;
   * the Mastra thread id is derived (`vict-conv-<conversationId>`).
   */
  ensureConversationLink(threadId: string, now?: number): Promise<QltThreadConversation>;
  /** Resolve the conversation correlation record of a thread, if any. */
  getConversationLink(threadId: string): Promise<QltThreadConversation | undefined>;
  /** Close the underlying store handle. */
  close(): void;
}
