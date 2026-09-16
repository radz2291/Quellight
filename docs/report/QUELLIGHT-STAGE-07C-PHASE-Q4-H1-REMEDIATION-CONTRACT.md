# Quellight Stage 07C Phase Q4 — H-1 Remediation Contract (Dated Addendum)

> **Class:** Phase 0 remediation-contract addendum (Q4 frozen-contract
> amendment procedure §17/§18, exercised by the owner decision following
> the independent verification finding H-1). This document is committed
> ALONE, before any executable remediation change. It does NOT rewrite the
> frozen Q4 contract
> (`QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md`, byte-identical
> through this commit); it narrows and extends it for exactly one finding.
>
> **Audit basis:** `QUELLIGHT-STAGE-07C-PHASE-Q4-INDEPENDENT-VERIFICATION.md`
> finding **H-1** (same-conversation turn-overlap snapshot crossover,
> independently confirmed by probe P4 against the audited tree
> `c4896befa64e7499b85cd751d2d4393482f2e7f0`).
>
> **Negative-control reproduction recorded before this addendum:** H-1 was
> reproduced against the audited implementation SHA `c4896bef…` in an
> isolated temporary worktree (real `resolveForStream`, real durable
> stores): with one recorded open turn and one record-less open turn in
> one conversation, the seam returned the NEWER turn's freshly assembled
> snapshot for a stream that may be the OLDER turn's, and wrote a durable
> `complete` assembly record for the newer turn although that turn's own
> stream received zero injection. The worktree and all repro artifacts
> were removed afterward; the audited tree was never modified.
>
> **Governing status at this addendum:**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q4 IMPLEMENTED — VERIFIED WITH ONE HIGH FINDING — CLOSURE NOT PERMITTED
> H-1 REMEDIATION IS OWNER-DIRECTED AND NOW PERMITTED — NOT BEGUN
> PHASE Q5 REMAINS NOT BEGUN
> Stage 07 remains In Progress.
> ```

## 0. Authority and basis

| Input                                                      | Value                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remediation freeze starting SHA                            | `821d4f80ae160200f262dacb49560f71c528dca0` (`HEAD == origin/main`, fetch-verified; fetch advanced nothing)                                           |
| VICT read-only SHA                                         | `6e3e10d8114216d19c1d338494a6cafeb67ae6f9` (`HEAD == origin/main`; pre-existing untracked `.pi/` untouched)                                          |
| Audited Q4 implementation tree                             | `c4896befa64e7499b85cd751d2d4393482f2e7f0` (audit-report commit `821d4f8…` adds only the verification report)                                        |
| Conflicting remediation/closure/Q5 work                    | none found on either remote (histories inspected after fresh fetch; no competing H-1 remediation, closure, Q5, or later phase work exists)           |
| Binding owner decision (this addendum, §1)                 | exactly one active agent turn per conversation; truthful stable refusal for distinct overlapping requests; VICT same-key idempotent replay preserved |
| Deferred product direction (recorded, NOT implemented, §4) | future turn steering                                                                                                                                 |
| Scope of this addendum                                     | H-1 remediation ONLY — no Q5 work, no steering, no queuing, no live provider, no VICT modification                                                   |

## 1. Owner decision (binding; implemented by this remediation)

> Quellight permits exactly one active agent turn per conversation. A
> distinct request arriving while a reply remains active is rejected
> truthfully and creates no second turn. A retry of the same logical
> request preserves VICT's existing idempotent replay behavior.

This applies to the current single-process Quellight product scope. The
second message is NOT queued; parallel replies in one conversation are NOT
permitted. Different conversations may continue concurrently.

## 2. Frozen state matrix (binding for the remediation)

| Durable state in one conversation                                         | Required behavior                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No open turn                                                              | A new distinct request may start                                                                |
| One record-less open turn                                                 | Only that turn may assemble                                                                     |
| One recorded open turn                                                    | Only that turn may replay its own snapshot                                                      |
| More than one open turn, in any recorded/unrecorded/in-flight combination | Model seam injects zero memory and creates no falsely attributed assembly                       |
| Same logical request/key retried                                          | Existing VICT idempotency behavior applies; never create another turn                           |
| Different key while one turn is open                                      | Stable refusal; no new intent, model call, assembly, transcript message, or Shared World effect |
| First turn terminal                                                       | A later distinct request may start normally                                                     |
| Different conversations                                                   | May run concurrently without interference                                                       |

## 3. Remediation requirements (binding)

1. **Race-safe admission control at the Quellight-owned turn-start
   boundary.** The check and the start must be atomic for the supported
   single-process deployment; a naïve unprotected "list then start" check
   is insufficient. VICT idempotency is preserved exactly: the same key
   and same payload never create another turn; a settled same-key retry
   replays the original turn identity; a concurrently pending same-key
   request may retain VICT's truthful in-progress disposition; the same
   key with different content remains an idempotency conflict; the guard
   must not misclassify a legitimate same-key replay as a new overlapping
   request. For two simultaneous distinct keys against the same
   conversation: exactly one may create a durable turn; the other
   receives the refusal below; only one model execution, one assembly,
   and one accepted transcript input occur; no partial effect occurs for
   the refused request. No generic orchestration or queuing framework is
   introduced.
2. **Model-seam defensive backstop.** `resolveForStream` must never
   select one turn merely because that turn is the only record-less
   entry while another open turn also exists, and must never return an
   in-flight promise belonging to one turn to another turn's stream.
   Before consulting or returning any per-turn in-flight promise, the
   seam must establish that EXACTLY ONE attributable open turn exists
   for the conversation and actor. Exactly one open record-less turn
   assembles; exactly one open recorded turn replays; zero open turns
   pass through untouched; two or more open turns in any combination are
   `ambiguous` with zero injection and NO new assembly. The backstop
   must remain effective even if the admission invariant is bypassed
   through a direct internal call, test fixture, future route, or
   corrupted state. No "pick newest", timestamp guessing, mutable global
   current-turn variable, or client/model-supplied turn identity.
3. **Stable, non-echoing refusal code:** `QLT_TURN_ALREADY_OPEN`.
   User-facing meaning: `A reply is already in progress for this
conversation.` The refusal is quiet and non-interruptive: no modal,
   no tray opening, no focus change.
4. **Tests and negative controls.** The H-1 regression suite must cover,
   at minimum: the mixed recorded/record-less state; an in-flight older
   turn with a newer record-less turn; two record-less turns; two
   recorded turns; the single-turn positive cases still assembling and
   replaying; two simultaneous distinct-key HTTP requests to the real
   turns ingress; same-key replay during and after an active turn;
   same-key conflicting payload; a distinct request after the first turn
   becomes terminal; concurrent turns in different conversations; zero
   effect for refused requests; no cross-turn snapshot; truthful
   transparency; and restart reconciliation preserving the rule. A
   deliberately delayed offline model keeps the first turn open long
   enough to exercise the real race. Existing Q4 tests are not weakened.
5. **Verification containment.** Focused checks during development; ONE
   authoritative aggregate sequence on the frozen final tree (`npm ci`,
   `verify:consumer`, `verify:quellight`, `npm audit --omit=dev`,
   `git diff --check`). `verify:quellight` must permanently include the
   new H-1 regression coverage without adding a duplicate browser boot.
   First-run results are recorded; no silent reruns, timeout increases,
   output suppression, or assertion weakening.

## 4. Future direction recorded — NOT implemented (deferred product direction)

> In the future, Quellight may allow the user to steer an answer while it
> is being generated. Steering must be an explicit operation targeting
> the exact active turn — not a second overlapping turn.

Steering is recorded in the decision register as a future design input
ONLY. It is not an implementation requirement of this remediation.
Future steering requires a separate contract covering: exact target-turn
identity; append-guidance versus cancel-and-restart semantics; durable
event and transcript truth; idempotency; restart/reconnect behavior;
context-snapshot consequences; provider support; and user-visible state.
This remediation implements no steering, no queuing, no parallel replies,
no cancellation redesign, and no provider behavior.

## 5. Carried findings (recorded additively; NOT repaired here)

- **L-1 (duplicated Q3 status line):** corrected additively in this
  remediation's documentation pass (README / system-reference).
- **L-2 (implementation-identity lag):** reconciled additively in the
  same documentation pass (no historical report is rewritten).
- **L-3 (correction-kind proposal confirmation rollback):** recorded as a
  Q5/backlog obligation ONLY. Confirming a `correction`-kind proposal
  through `confirmProposal` currently rolls back (`QLT_RECORD_EXISTS`) due
  to a duplicate source-thread link, while the active production
  correction path remains `applyCorrection`. No repair in this task.
- **O-1, O-2, O-3:** preserved as observations.
- **Pending-correction fixture limitation** and the **Q3
  correction-proposal deferral:** preserved.
- **M-1 (framework obligation):** unchanged, with its hard deadline
  before the Phase Q6 live-provider proof and the Stage 07C final audit.

## 6. Non-goals (unchanged from the frozen Q4 contract)

No Q5 work; no steering or queuing; no live provider; no VICT code,
package, test, release-identity, or System Reference change; no package
pin or lockfile change; no historical implementation or audit report
rewrite; no multi-process or cloud correctness claims; no change to
Shared World selection, budgets, ordering, authority, or injection
format except where necessary to prevent H-1 crossover.

## 7. Status after implementation (binding wording)

```text
Q4 H-1 REMEDIATED — AWAITING FRESH INDEPENDENT RE-VERIFICATION
```

Q4 is NOT called Verified and is NOT formally closed by this remediation.
