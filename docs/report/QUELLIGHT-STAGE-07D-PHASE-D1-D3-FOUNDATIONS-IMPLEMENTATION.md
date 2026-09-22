# Quellight Stage 07D — Phases D1a + D1/D3 Foundations Implementation Report

> **Class:** Implementation record (documentation). This report documents
> the D1a contract freeze, the D1 Lane A retention foundations, and the
> D3 Lane B conflict-semantics foundations TRUTHFULLY: what was frozen,
> what was implemented, what was verified and how, what was deliberately
> NOT implemented, and every reconciliation against frozen 07C surfaces.
> **Stage 07D is NOT verified and NOT formally closed.** D2 (governed
> deletion/export and cross-store reconciliation), D4 (MSTR-012 real-use
> proof), D5 (independent audit and closure), and Stage 07E remain NOT
> BEGUN. No provider was accessed; no operator data, credentials,
> `.quellight-data`, or VICT `.pi/` material was touched; VICT was not
> modified.

## 1. Commit ledger (this delivery, in order)

| #   | Commit      | Content                                                                                                                                                           |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `493c52e0`  | **D1a freeze** — `d1-contract.ts` (declarative) + `meaning-contract.ts` data amendment + freeze report + decision register D-07D-1/D-07D-2. No executable change. |
| 2   | `cdcfde24`  | **Schema foundation** — migration 5 `qlt-retention-conflict-foundations` (meaning-table rebuilds + three new families); test bookkeeping re-pins.                 |
| 3   | `68b72958`  | **Lane A** — retention store/surface, removal/expiry/pass, correction retention guards, `qlt.retention` wiring, `test/d1-retention.test.ts`.                      |
| 4   | `6856d45d`  | **Freeze Amendment 1** (challenge mutable-version CHECK) + the in-flight Lane B module files present in the worktree (see §6 for the truthful composition note).  |
| 5   | `8fa81906`  | **Lane B** — conflict store/surface, ceremony confirm-time detector, `qlt.conflict` wiring, `test/d3-conflict.test.ts`.                                           |
| 6   | `33b3162f`  | style: prettier on the sqlite wiring module.                                                                                                                      |
| 7   | `866074e`   | **Gates** — `scripts/verify-d1.mjs` (49 checks), `scripts/verify-d3.mjs` (35 checks), package.json registration, verify-q2..q6 re-pins.                           |
| 8   | this commit | Implementation report + status surfaces + decision register D-07D-3.                                                                                              |

## 2. Frozen identities (D1a; authoritative data in `d1-contract.ts`)

- **Retention vocabulary** (six meaning tables):
  `currently-relevant | expired | user-removed`; transitions
  `currently-relevant → expired` (pass only, claims only),
  `currently-relevant → user-removed` (user removal),
  `expired → user-removed` (removal preempts lineage). The 07B
  `qlt_thread` family keeps its closed 2-state vocabulary.
- **Tombstone semantics:** removal nulls EXACTLY the frozen per-family
  column sets (claims also `expires_at_ms`) and writes
  `removed_at_ms`/`removed_by`; content-freeness is a STORAGE CHECK
  (`user-removed ⇒ all tombstone columns NULL`), not a convention.
- **Expiry:** claims only; future-only assignment; clearable; applied ONLY
  by the pass. Commitments and open loops have no expiry column at all.
- **Enforcement pass:** frozen DUE predicate; ONE transaction; append-only
  `qlt_retention_pass` evidence (examined, expired count, bounded id list
  — batch bound 100 per pass, an implementation detail within the frozen
  "bounded expired-id list" rule); idempotent and keyed-convergent.
- **Removal identities:** `act.removeRecord` / `act.setClaimExpiry` /
  `act.runRetentionPass` on `qlt.retention` (read
  `qlt.retention.read`, write `qlt.retention.write`).
- **Conflict identity:** exactly one deterministic classification,
  `commitment-key-conflict`, detected at the ceremony confirm choke
  point; refusal code `QLT_COMMITMENT_CONFLICT`; challenge lifecycle
  `open → dismissed | resolved` with resolutions
  `incoming-abandoned | existing-amended`; codes
  `QLT_CHALLENGE_NOT_OPEN`, `QLT_RETENTION_INVALID_TRANSITION`,
  `QLT_RETENTION_EXPIRY_INVALID`.
- **Amendment identity:** `act.amendCommitment` /
  `act.dismissChallenge` / `act.resolveChallengeWithAmendment` on
  `qlt.conflict`; immutable `qlt_amendment` judgment rows; the successor
  --amends--> predecessor source link (frozen 07C relation vocabulary).

## 3. Migrations (frozen inventory consumed by introspection gates)

Migration 5 `qlt-retention-conflict-foundations` (forward-only, ONE
transaction, deferred FK enforcement inside the transaction):

- **Rebuilds** the six meaning tables to the amended shapes: 3-state
  retention CHECKs; nullable content columns on the three subject
  families with content-free tombstone CHECKs; claim
  `expires_at_ms`/`removed_at_ms`/`removed_by` with consistency CHECKs;
  the partial index `idx_qlt_claim_due_expiry`. The COPY preserves every
  value except the frozen defensive rule (a legacy `user-removed` row
  gets its tombstone columns nulled).
- **Adds** `qlt_amendment` (immutable; `version = 1`),
  `qlt_conflict_challenge` (mutable judgment rows; `version >= 1` per
  Amendment 1), `qlt_retention_pass` (append-only evidence).

## 4. Implemented behavior (natural language)

- **A user can remove any claim, commitment, or open loop.** The record
  immediately becomes ineligible for context assembly everywhere, keeps a
  truthful content-free tombstone (identity, status, version, dates,
  provenance, lifecycle metadata), and the removal is attributed and
  timestamped. Re-removal converges; keyed retries replay; stale versions
  refuse.
- **A user can assign or clear an expiry on an active claim.** Nothing
  happens from time passage alone: the claim stays eligible and
  unchanged until a user runs the visible enforcement pass, which
  transitions exactly the due claims to `expired` and records durable,
  inspectable evidence.
- **Removed and expired material never reaches the model.** The assembler
  stays time-blind (frozen 07C invariant); exclusion is state-based at
  the deterministic candidate scan.
- **Dependent material is re-evaluated, boundedly.** Correction proposals
  targeting a removed/expired record become structurally stale (the
  boundary refuses with `target-ineligible`; the pure projection
  mirrors); direct corrections of non-currently-relevant subjects refuse
  (`QLT_RECORD_NOT_CURRENT`); amendments of removed commitments refuse.
  No semantic inference, no rewriting, no deletion; unrelated rows are
  byte-identical.
- **A confirmation that would conflict with an active commitment is
  refused, quietly.** The deterministic detector (complete over the
  durable write surface because ordinary turns never write meaning)
  records a challenge judgment row (idempotent per incoming proposal) and
  returns `QLT_COMMITMENT_CONFLICT`; the existing commitment keeps its
  content, key, and version; the incoming proposal stays
  `awaiting_decision`; the candidate pool is untouched (epistemic
  inertness). The user resolves by dismissing quietly or by amending the
  existing commitment through the frozen amendment operation.
- **Amendment versus execution is structural.** Only `act.amendCommitment`
  (and the challenge-resolution verb that uses it) can produce an
  amendment row, an `amends` link, or an `amended` status. A full
  ordinary ceremony run (confirmations, corrections, lifecycle exits)
  writes zero amendment artifacts — verified by N-D3-4.
- **The agent surface is unchanged.** Still exactly
  `qlt.proposal.draft@3` with the frozen three proposable kinds; the
  agent can never remove, expire, run the pass, amend, dismiss, resolve,
  or read the new surfaces. Every store mutation additionally refuses
  `agent-*` identities (defense in depth).
- **Presentation is quiet by contract.** Challenge and retention
  projections are plain list-row data on their own resources; no
  interrupting presentation mechanism exists in or behind them.

## 5. Test and negative-control results

- **Permanent suites:** `test/d1-retention.test.ts` (11 tests) and
  `test/d3-conflict.test.ts` (11 tests) added; full node suite
  **351/351 green** (was 329 before this delivery). One transient failure
  occurred during the Lane A commit window while Prettier was rewriting
  files concurrently with the test run; three consecutive full-suite runs
  after that point were fully green (351/351 each) — recorded truthfully.
- **Focused gates:** `verify:d1` — **49 checks green**
  (schema/controls/structural/wiring); `verify:d3` — **35 checks green**.
  Both implement the frozen negative-control matrix end-to-end on fresh
  synthetic stores: N-D1-1..N-D1-8 and N-D3-1..N-D3-9, every one
  non-vacuous (stable refusals, absences, and byte-identical invariants).
- **Existing phase gates re-run:** `verify:q2` 196, `verify:q3` 34,
  `verify:q4` 41, `verify:q5` 86, `verify:q6` 114 — all green after the
  documented re-pins (§7). Typecheck clean; `format:check` clean;
  `git diff --check` clean.
- **Explicitly NOT run (and why):** the aggregate/browser ladder
  (`verify:quellight`, browser suites, `verify:consumer`, `npm ci`) — D1
  changed no UI component, no route, and no dependency, so the changed
  boundaries were fully verifiable without them; they run once at the D2
  integration point and at the D5 audit freeze per the D0 FastGate plan.
  No provider was accessed (D4 scope; owner decision OD-D5).

## 6. Contract amendments and reconciliations

1. **Freeze Amendment 1** (explicit, standalone commit `6856d45d`, before
   the dependent Lane B implementation concluded): the
   `qlt_conflict_challenge` version CHECK moved from `version = 1` to
   `version >= 1` — challenge rows are mutable judgment rows on a closed
   transition path and carry optimistic-concurrency versions, mirroring
   the 07C proposal-table discipline. `qlt_amendment` stays immutable.
   **Truthful composition note:** the amendment commit also carried the
   in-flight Lane B module files from the worktree (they were staged);
   the amendment itself is complete and standalone-readable within it,
   and it precedes the Lane B implementation's completion (tests were
   still red at that commit).
2. **`meaning-contract.ts` data amendments** (in the freeze commit):
   retention vocabulary, nullable content columns, expiry/removal
   columns, amended schema inventory. The typed error-code union gained
   the four frozen D1 codes during Lane A (the code DATA was already
   frozen; the union is its typing mechanism).
3. **`q6-contract.ts` data amendment:** `QLT_Q6_UNCHANGED_ENVELOPE.
actionInventory` 21 → 29 (the plan inventory legitimately grew by the
   eight D1 actions). The Q6 AGENT envelope fields (capability
   id/revision, declared effect, host policy, maxToolCalls, profile and
   instruction revisions) are unchanged; no D1 action is agent-reachable.
4. **Narrow conforming edits to 07C executable modules** (the Q5 L-3
   precedent): `meaning-store.ts` — tombstone-tolerant row mappers, the
   retention guard on the direct correction path, the widened
   `assertProposalNotStale` (expired targets are structurally stale);
   `meaning.ts` — the pure projection mirror of the same rule;
   `ceremony-actions.ts` — the optional confirm-time conflict hook (absent
   in legacy test compositions, so 07C behavior is unchanged there);
   `sqlite.ts`/`composition.ts`/`definition.ts` — wiring.
5. **verify-q2..q6 re-pins:** bookkeeping to `[1,2,3,4,5]`, schema version
   to 5, plan inventories to the 29-action set, resource lists extended
   with `qlt.retention`/`qlt.conflict` — each with a truthful
   reconciliation comment; the Q4/Q5 reconciliation precedent. No 07C
   assertion was otherwise weakened. Three 07C test books were reconciled
   where direct-SQL manipulations now correctly fail the new storage
   CHECKs (they simulate removals and must now write full tombstones), and
   where bookkeeping expectations followed the migration list.

## 7. Files changed (this delivery)

- **New:** `src/lib/sharedworld/d1-contract.ts`,
  `retention-store.ts`, `retention-surface.ts`, `conflict-store.ts`,
  `conflict-surface.ts`; `test/d1-retention.test.ts`,
  `test/d3-conflict.test.ts`; `scripts/verify-d1.mjs`,
  `scripts/verify-d3.mjs`;
  `docs/report/QUELLIGHT-STAGE-07D-PHASE-D1A-CONTRACT-FREEZE.md`; this
  report.
- **Modified:** `src/lib/sharedworld/meaning-contract.ts` (data
  amendment), `migrations.ts`, `meaning-store.ts` (narrow guards),
  `meaning.ts` (projection mirror), `ceremony-actions.ts` (confirm hook),
  `sqlite.ts`, `composition.ts`, `definition.ts`, `q6-contract.ts`
  (inventory count), `package.json` (two gate scripts); tests
  `meaning-foundation`, `sharedworld-meaning`, `sharedworld`,
  `context-assembly`, `ceremony-authority`, `q6-ceremony-authority`
  (reconciliations); scripts `verify-q2..q6` (re-pins);
  `README.md`, `docs/system-reference.md`, `docs/decision-register.md`.

## 8. Carried limitations and debts

- **Browser/UI proof deferred:** D1 wires no UI component, so the
  real-browser suites are unexercised by this delivery; the frozen UI
  rules are contract data until the D2+ UI work.
- **Deep purge, export, conversation deletion, and cross-store
  reconciliation do not exist** (D2 scope). Removal is logical; storage
  residue disclosure and the deep-purge action are D2 deliverables under
  owner decision OD-D2/OD-D3.
- **One deterministic conflict classification exists.** Natural-language
  contradiction of commitment TEXT is not detected (deliberately — no
  deterministic non-semantic detector exists); the durable write surface
  is fully covered, the conversational surface is covered by the
  structural no-write property.
- **No durable clarification artifact** (frozen boundary; revisit only by
  amendment with D4 evidence).
- **Lane execution was sequential, not parallel** (one implementer; no
  isolated workers/worktrees were available) — reported truthfully, as
  the freeze requires.
- The transient test failure during the Lane A commit window (§5) and the
  amendment-commit composition note (§6.2) are recorded for the D5
  auditor's chain-of-custody review.
- Carried from 07C/Q7 unchanged: stale `0.3.0` console labels (docs-only
  cleanup still owed), hashed Mastra dist import coupling, L-1/L-2 audit
  findings, synthetic-fixture limitation (D4 real-use supersedes).

## 9. Status

```text
QUELLIGHT STAGE 07D D1/D3 FOUNDATIONS IMPLEMENTED — AWAITING D2 INTEGRATION
RETENTION AND CONFLICT SEMANTICS EXIST; DEEP PURGE, EXPORT, AND
CROSS-STORE RECONCILIATION ARE NOT IMPLEMENTED
STAGE 07D IS NOT VERIFIED OR FORMALLY CLOSED
STAGE 07E HAS NOT BEGUN
Stage 07 remains In Progress.
```
