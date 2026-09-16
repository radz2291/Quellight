/**
 * The Quellight turn-admission boundary (H-1 remediation; remediation
 * contract §2/§3).
 *
 * OWNER DECISION (binding): Quellight permits exactly ONE active agent
 * turn per conversation. A distinct request arriving while a reply
 * remains active is rejected truthfully and creates no second turn. A
 * retry of the same logical request preserves VICT's existing idempotent
 * replay behavior. The second message is never queued; parallel replies
 * in one conversation never occur. Different conversations may continue
 * concurrently.
 *
 * Race safety for the supported single-process deployment: the admission
 * decision and the turn start are serialized through a per-conversation
 * critical section (a promise-chain mutex keyed by the SERVER-RESOLVED
 * Mastra conversation id). Quellight is composed as ONE Node process
 * (composition header; MSTR-012 declaration), and the durable turn
 * intent is created by the dispatch INSIDE the section, so a concurrent
 * request for the same conversation can never interleave between the
 * "is a turn open?" check and the start — the naïve unprotected
 * "list then start" race cannot occur in the supported deployment. The
 * model-seam defensive backstop (`resolveForStream`, remediation §3.2)
 * additionally fails closed if the invariant is ever bypassed through a
 * direct internal call, test fixture, future route, or corrupted state.
 *
 * VICT idempotency is preserved exactly: a request whose durable
 * command-idempotency receipt already exists (same actor + command +
 * key) is passed through to the VICT boundary UNCHANGED — VICT then
 * truthfully replays the settled result, answers the stable in-progress
 * disposition, or refuses a different payload with the stable conflict.
 * The guard therefore never misclassifies a legitimate same-key replay
 * as a new overlapping request, and a refused distinct request creates
 * no VICT intent, no model call, no assembly, no transcript message, and
 * no Shared World effect.
 */

/** The stable, non-echoing refusal code (remediation contract §3). */
export const QLT_TURN_ALREADY_OPEN = 'QLT_TURN_ALREADY_OPEN';

/** The user-facing meaning (quiet; never a modal, tray, or focus change). */
export const QLT_TURN_ALREADY_OPEN_MESSAGE =
  'A reply is already in progress for this conversation.';

/** One durable open-turn record (the fields the guard reads). */
export interface AdmissionOpenTurnRecord {
  readonly turnId: string;
  readonly threadId: string;
  readonly actorId: string;
}

/** One durable command-idempotency receipt (existence is all the guard reads). */
export interface AdmissionIdempotencyReceipt {
  readonly status: string;
}

/** Durable store ports for the admission decision (bounded reads only). */
export interface TurnAdmissionDeps {
  /** Durable open turns (VICT-authoritative; intent/running/awaiting-approval). */
  readonly listOpenTurns: () => Promise<readonly AdmissionOpenTurnRecord[]>;
  /**
   * The durable command-idempotency receipt for (actor, turn command,
   * idempotency key) — existence alone marks the request as a SAME-KEY
   * retry, which is passed through to VICT's truthful disposition.
   */
  readonly getReceipt: (name: {
    readonly actorId: string;
    readonly command: string;
    readonly idempotencyKey: string;
  }) => Promise<AdmissionIdempotencyReceipt | undefined>;
  /** The server-derived local actor (single-actor envelope). */
  readonly localActorId: string;
  /** The turn-start command identity the receipt namespace is scoped by. */
  readonly turnCommand: string;
}

export interface TurnAdmissionInput {
  /** The SERVER-RESOLVED Mastra conversation id (never client-derived). */
  readonly mastraThreadId: string;
  readonly idempotencyKey: string;
}

/** The result of one admitted-or-refused turn start. */
export type TurnAdmissionResult<T> =
  | { readonly refused: false; readonly result: T }
  | { readonly refused: true; readonly code: typeof QLT_TURN_ALREADY_OPEN };

/**
 * The turn-admission guard. `admitTurn` serializes the check and the
 * start per conversation and either runs the dispatch inside the critical
 * section or refuses it truthfully before ANY effect.
 */
export function createTurnAdmission(deps: TurnAdmissionDeps): {
  admitTurn<T>(
    input: TurnAdmissionInput,
    dispatch: () => Promise<T>,
  ): Promise<TurnAdmissionResult<T>>;
  /** Run one critical section for a conversation (test/inspection surface). */
  runExclusive<T>(mastraThreadId: string, run: () => Promise<T>): Promise<T>;
} {
  // Per-conversation promise-chain critical sections. The section's
  // promise is replaced by the NEXT queued continuation, so the chain
  // never accumulates; distinct conversations never share a section.
  const sections = new Map<string, Promise<unknown>>();

  function runExclusive<T>(mastraThreadId: string, run: () => Promise<T>): Promise<T> {
    const previous = sections.get(mastraThreadId) ?? Promise.resolve();
    const next = previous.then(run, run);
    // The stored tail never rejects: a failed section must not poison
    // later requests for the same conversation.
    sections.set(
      mastraThreadId,
      next.catch(() => undefined),
    );
    return next;
  }

  return {
    async admitTurn<T>(
      input: TurnAdmissionInput,
      dispatch: () => Promise<T>,
    ): Promise<TurnAdmissionResult<T>> {
      return runExclusive(input.mastraThreadId, async () => {
        // 1. Same logical request? A durable receipt for (actor, turn
        //    command, key) exists → pass through to the VICT boundary,
        //    which owns the truthful same-key disposition (replay /
        //    in-progress / digest conflict). No open-turn refusal here.
        const receipt = await deps.getReceipt({
          actorId: deps.localActorId,
          command: deps.turnCommand,
          idempotencyKey: input.idempotencyKey,
        });
        if (receipt !== undefined) {
          return { refused: false, result: await dispatch() } as TurnAdmissionResult<T>;
        }
        // 2. Distinct request: refuse truthfully while ANY turn of this
        //    conversation and actor is open — before any intent, model
        //    call, assembly, transcript message, or Shared World effect.
        const openTurns = (await deps.listOpenTurns()).filter(
          (turn) => turn.threadId === input.mastraThreadId && turn.actorId === deps.localActorId,
        );
        if (openTurns.length > 0) {
          return { refused: true, code: QLT_TURN_ALREADY_OPEN } as TurnAdmissionResult<T>;
        }
        // 3. Admit: the dispatch (which durably creates the turn intent)
        //    runs INSIDE the section, so the next admission decision for
        //    this conversation can never interleave before the durable
        //    turn exists.
        return { refused: false, result: await dispatch() } as TurnAdmissionResult<T>;
      });
    },
    runExclusive,
  };
}
