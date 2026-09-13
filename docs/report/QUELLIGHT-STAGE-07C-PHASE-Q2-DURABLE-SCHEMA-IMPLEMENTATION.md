# Quellight Stage 07C — Phase Q2 — Durable Shared World Schema Implementation

> **Class:** implementation report. This document records Phase Q2 of
> Stage 07C Phase Q (Quellight side): the Quellight-owned durable Shared
> World schema foundation — additive migrations, closed domain schemas and
> validators, product-owned ports and a SQLite repository, deterministic
> lifecycle/lineage/eligibility rules, provenance and retention-ready
> metadata, durable transaction and idempotency invariants, repository-level
> inspection reads, and the permanent conformance suite plus the focused
> `verify:q2` gate. It is a record of the implementer's claims. It is NOT an
> independent verification; nothing in this phase is "Verified" or "Closed"
> by this document, and no `QLT-*` requirement is promoted by it.
>
> **Completion disposition (binding wording):**
>
> ```text
> QUELLIGHT STAGE 07C PHASE Q2 IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
> Shared World schemas exist, but no production meaning or confirmation path is active.
> PHASE Q3 IMPLEMENTATION HAS NOT BEGUN
> Stage 07 remains In Progress.
> ```

## 1. Prerequisites and starting evidence

| Property                                                  | Value                                                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Quellight starting SHA (fetch-verified)                   | `2fc529f48277ee495febee4eb21b91809cb8f616` (`HEAD == origin/main`; tracked tree clean)                                                 |
| VICT read-only SHA (fetch-verified; unchanged throughout) | `0f4f72b0812bdfa40229a170f4d97e9696f72dd9` (`HEAD == origin/main`; untracked `.pi/` preserved byte-identically and never read)         |
| Conflicting Q2 / later-07C work                           | none found on either remote (both fetches advanced nothing; histories inspected)                                                       |
| Canonical persistent-cognitive-partner input              | SHA-256 `e7f61d24c16fd60c66efdb0af0b32859f1fdf1b571e32a0368870cb559b01331` — reconfirmed byte-identical before any edit                |
| Governing status at start                                 | `QUELLIGHT STAGE 07C PHASE Q1 VERIFIED WITH NON-BLOCKING ISSUES — FORMALLY CLOSED / PHASE Q2 … PERMITTED — NOT BEGUN`                  |
| Adopted release identity (unchanged by Q2)                | `@victframework/*@0.2.0`, `vict-release-set@1/0.2.0`, content ID `v1_7a557983114b0743334061bd1f02ccd14f22e29f3a86697a4fd09b1722a8f172` |
| Environment                                               | Windows (win32-x64), Node v22.13.1, npm 10.9.2                                                                                         |
| `AGENTS.md`                                               | none exists in either repository (filesystem search)                                                                                   |
| Credentials                                               | none read, copied, or used; no `.npmrc`, no token files, no provider secrets; no live provider executed                                |

Baseline spot-check before any edit: `test/sharedworld.test.ts` +
`test/governed-mutation.test.ts` green (34/34) after the documented
fresh-checkout environmental step (`npx svelte-kit sync` for the
git-ignored `.svelte-kit/tsconfig.json` — the same step the Q1 independent
verification diagnosed).

## 2. Phase 0 — the contract freeze

The exact Q2 contract was frozen BEFORE any production edit, in
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md` together
with the frozen declarative module
`src/lib/sharedworld/meaning-contract.ts` (closed vocabularies, bounds,
stable rejection codes, transition tables, eligibility data, record/port
types, the machine-readable schema inventory, and the deterministic
canonical serializer). One typo correction (index count "13" → "16")
was made by amending the freeze commit BEFORE any lane branched; the
freeze commit is:

```text
e79aba6c1cfb8f8dba93aca1b03b7b383611f990
docs(stage-07c): freeze Phase Q2 durable schema contract
```

All implementation lanes began from this exact commit. The contract was
not altered during any lane.

## 3. Controlled parallel workflow actually used

Two lanes ran in PARALLEL, in separate git worktrees on separate
temporary branches, each with its own `npm ci` (no shared writable
`node_modules`, no shared edited files, no pushes):

| Lane                  | Worktree / branch                                              | Base      | Ownership (files actually touched)                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — SQLite foundation | repo-sibling worktree `qlt-q2-lane-a` / branch `qlt-q2-lane-a` | `e79aba6` | `migrations.ts` (migration 2), `meaning-store.ts` (new repository), `sqlite.ts` (wiring + `PRAGMA foreign_keys = ON`), `test/meaning-foundation.test.ts` (new), `test/sharedworld.test.ts` (bookkeeping assertion only) |
| B — domain contracts  | repo-sibling worktree `qlt-q2-lane-b` / branch `qlt-q2-lane-b` | `e79aba6` | `meaning.ts` (new — closed validators, lifecycle, authority/staleness/eligibility predicates, lineage validation, pure resolution parity rule)                                                                          |

Lane C (conformance tests + `verify:q2`) is inherently downstream — its
black-box suite exercises both implementations — and therefore ran
sequentially after the A+B integration, from the integration commit, in
its own worktree (`qlt-q2-lane-c`). The one-directional dependency chain
B→A/C (both lanes consume only the frozen contract module) is what made
the A‖B parallelism safe; this parallel/sequential mix is recorded
honestly rather than forced.

Lane C executed the freeze's amendment procedure literally: it STOPPED
without committing when its adversarial tests exposed a Lane A
implementation defect (§5), reported the exact reconciliation to the
integration owner, and its deliverables were integrated afterward.

All worktrees, temporary branches, coordination scratch files, probe
databases, and logs were removed after integration; no parallel-work
coordinator and no new permanent architecture layer remain.

## 4. Commits and files changed

```text
e79aba6  docs(stage-07c): freeze Phase Q2 durable schema contract
         docs/report/QUELLIGHT-STAGE-07C-PHASE-Q2-CONTRACT-FREEZE.md (new)
         src/lib/sharedworld/meaning-contract.ts (new, frozen)
c080e30  feat(stage-07c): implement durable Shared World schema
         src/lib/sharedworld/migrations.ts        (migration 2; +157)
         src/lib/sharedworld/meaning-store.ts     (new repository; ~2.3k)
         src/lib/sharedworld/meaning.ts           (new domain layer; 692)
         src/lib/sharedworld/sqlite.ts            (meaning port wiring + FK pragma; +27)
         test/meaning-foundation.test.ts          (new Lane A fixtures; 648)
         test/sharedworld.test.ts                 (bookkeeping assertion [1, current]; 1 line)
dcb5e69  test(stage-07c): verify durable Shared World schema
         test/sharedworld-meaning.test.ts         (new Lane C suite; ~1.7k)
         scripts/verify-q2.mjs                    (new focused verifier; 630)
         package.json                             (one script line: verify:q2)
         scripts/verify-quellight.mjs             (one aggregate step: 2c)
docs     docs(stage-07c): record Phase Q2 implementation   (this report + status docs)
```

Lane A and Lane B commits (`e79e8d0`, `bdfc29c`) were combined by the
integration owner into `c080e30` (disjoint file sets; no file was edited
by two lanes). The `c080e30` commit additionally carries the single
integration reconciliation described in §5. The lane branches were
temporary and no longer exist.

## 5. Integration reconciliation record (no silent deviations)

1. **Correction-verb storage defect (found by Lane C, fixed by the
   integration owner in `c080e30`).** All three successor-INSERT branches
   of `applyCorrectionInTransaction` bound 14 values against 15
   placeholders, leaving `retention_state` unbound (`NOT NULL` failure on
   every correction). Lane A's own fixtures had not exercised the
   correction path; Lane C's adversarial suite did. The fix binds the
   successor's `retention_state` to the SUBJECT's retention state in all
   three branches — a corrected successor inherits retention (a corrected
   record can never resurrect `user-removed` material as fresh,
   currently-relevant content), which strengthens the contract's
   retention-ready-metadata discipline.
2. **Lane C test mechanics corrected during integration (assertions not
   weakened).** (a) the "same-key replay converges" controls in A-19 and
   `verify:q2` initially passed no idempotency key — the store correctly
   refused the un-keyed duplicates (`QLT_RECORD_NOT_CURRENT`); the key is
   now supplied on both calls so the keyed-convergence semantics are
   genuinely exercised; (b) A-06 expected `version` on the API-level
   `QltCorrection` object — the frozen contract type deliberately omits
   it (immutability is a storage `CHECK (version = 1)`); the assertion
   now reads the raw storage column (stronger); (c) the A-06 lineage-link
   assertion followed the wrong link direction — the frozen relations
   flow successor→predecessor (`supersedes`) and correction→subject
   (`corrects`); the test now asserts both precisely.
3. **Pinned interpretation — withdrawal identity.** The frozen proposal
   CHECK couples every decided status (including `withdrawn`) to a
   user-actor `decision_by` (`GLOB 'actor-*'`). Agent-attributed
   withdrawal is therefore not representable in this schema revision;
   withdrawal is recorded as a decision attributed to the governing user
   actor (coherent with the single-actor envelope and the ratified OQ6
   model). Q3 may refine the representation; this is recorded, not
   silently decided.

## 6. Migration and schema inventory

One additive migration: `version 2`, `name 'qlt-meaning-foundation'`,
applied by the existing forward-only bookkeeping inside one
`BEGIN IMMEDIATE` transaction. `QLT_SHARED_WORLD_SCHEMA_VERSION = 2`.
The migration is `CREATE TABLE`/`CREATE INDEX` only; it neither reads nor
writes pre-existing rows and cannot delete or rewrite user data.
`PRAGMA foreign_keys = ON` is set at store open (Q1 declared FKs; Q2's
are enforced).

New tables (6): `qlt_proposal`, `qlt_claim`, `qlt_commitment`,
`qlt_open_loop`, `qlt_correction`, `qlt_source_link`. New indexes (16):
`idx_qlt_proposal_status`, `idx_qlt_proposal_thread`,
`uq_qlt_proposal_open_per_turn` (partial unique — one OPEN proposal per
`(source_thread_id, proposal_kind, source_turn_ref)`),
`idx_qlt_claim_subject`, `idx_qlt_claim_eligible`,
`uq_qlt_commitment_active_key` (partial unique — one ACTIVE commitment
per key), `idx_qlt_commitment_key`, `idx_qlt_commitment_eligible`,
`idx_qlt_open_loop_thread`, `idx_qlt_open_loop_subject`,
`idx_qlt_open_loop_eligible`, `uq_qlt_correction_subject_key` (unique —
one correction per `(subject, correction_key)`), `uq_qlt_source_link`
(unique per `(from, to_kind, to_ref, relation)`), `idx_qlt_source_link_from`,
`idx_qlt_source_link_to`.

Storage-level guards (SQLite-enforced): closed lifecycle CHECK
vocabularies (§7); closed retention vocabulary; identity-pattern CHECKs
(`proposed_by` = `agent-*` or `actor-*`; `decision_by` / `created_by` /
`corrected_by` / `exit_by` = `actor-*` only); UTF-8 content byte bound
`length(CAST(content AS BLOB)) <= 4096`; 64-char sha256 fingerprint
CHECKs; decided-status ↔ `decision_by`+`decided_at_ms` coupling;
loop-exit ↔ `exit_by`+`exited_at_ms` coupling; correction immutability
(`version = 1`, `status = 'recorded'`); self-reference-proof
`supersedes_id <> id`; enforced foreign keys (polymorphic subject/from
references documented as family-CHECK + repository-enforced existence).
The machine-readable inventory (`QLT_MEANING_SCHEMA_INVENTORY`) is
compared against live pragma output by the introspection gates (139
checks green) — any drift fails.

## 7. Record families and lifecycle contracts

Common discipline on every family: QLT-prefixed stable `id`;
monotonic `version` (every transition bumps by exactly 1; content never
mutated in place; corrections create new records); closed `status`;
provenance identities; source (thread + conversation/turn reference);
`created_at_ms` / `updated_at_ms` / `effective_at_ms` (server clock,
injectable); canonical-JSON bounded `content` + `content_fingerprint`;
`retention_state` (`currently-relevant` default | `user-removed`; no Q2
mutation verb — 07D owns the flow).

| Family            | Closed lifecycle                                                               | Notes                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qlt_proposal`    | `proposed → awaiting_decision → confirmed \| rejected \| amended \| withdrawn` | proposal kinds `claim \| commitment \| open_loop \| correction`; correction-kind proposals REQUIRE a target record (+ drafted-against `target_record_version`); decided proposals are terminal and CHECK-coupled to their decision identity |
| `qlt_claim`       | `active → superseded \| retired`                                               | epistemic type `E1–E7`, honesty state, bounded confidence (`stated/qualified/uncertain`), subject                                                                                                                                           |
| `qlt_commitment`  | `active → released \| superseded \| amended`                                   | `commitment_key`; partial-unique ACTIVE key; optional `normative_basis_proposal_id`                                                                                                                                                         |
| `qlt_open_loop`   | `open → resolved \| superseded \| abandoned \| transformed`                    | exactly the four canonical exits; exits require a user identity (`abandon`/`transform` require a reason) and exit provenance is CHECK-coupled                                                                                               |
| `qlt_correction`  | `recorded` (append-only, immutable)                                            | subject + family, `correction_key`, prior-content fingerprint, reason                                                                                                                                                                       |
| `qlt_source_link` | immutable link records                                                         | closed relations `source-thread \| source-turn \| proposed-from \| supersedes \| corrects \| amends`; unique per `(from, to_kind, to_ref, relation)`                                                                                        |

Repository (`SharedWorldMeaningStore`, exposed as `SharedWorldSqlite.meaning`
over the SAME connection — the future ceremony needs ONE transaction
across proposal + records + links): proposal ceremony verbs
(create/list/get, `markProposalAwaitingDecision`, `confirmProposal` — the
atomic ceremony transition creating target records + provenance links,
`rejectProposal`, `withdrawProposal`, `amendProposal`), direct
user-authority creates (explicit Save = confirmation:
`createClaim/createCommitment/createOpenLoop`), lifecycle exits
(`retireClaim`, `releaseCommitment`, `resolveLoop`, `abandonLoop`,
`transformLoop`), corrections (`applyCorrection` — one transaction:
successor + predecessor supersede + immutable correction row + links),
reads (`get*/list*` with deterministic ordering), and inspection reads
(`listSourceLinks`, `listCorrections`,
`resolveCurrentEffectiveClaim/Commitment/OpenLoop`).

## 8. Authority, provenance, eligibility, and correction invariants

- **Proposals are epistemically inert.** `QltProposal` is never
  canonical-eligible in ANY status (`QLT_CANONICAL_ELIGIBLE_STATUSES.proposal`
  is empty); only the confirm transition creates substantive records, in
  one transaction with `proposed-from` links.
- **The agent cannot confirm.** Confirmer/decider/corrector/creator/exit
  identities MUST match the user-actor pattern (`actor-*`); `agent-*`
  identities are refused (`QLT_CONFIRMER_INVALID`), CHECK-enforced at the
  storage layer and guard-enforced at the repository. `proposedBy`/
  `withdrawnBy` accept agent or user identities (withdrawal decision
  attribution per §5.3).
- **Confirmation identity is attributable to the user.** Decided
  proposals carry `decision_by` + `decided_at_ms` (CHECK-coupled);
  created records carry `created_by` (user) and resolvable `proposed-from`
  links; explicit user-authored Save is represented as direct creation
  with `createdBy` = user actor.
- **Staleness is version-eligibility, never time (OQ6 §19).**
  `proposalStaleness` (pure) and the repository's confirm-time re-check
  (against CURRENT storage) mark a proposal stale exactly when its
  referenced target version changed, the target left current-effective
  standing, the target or source became retention-ineligible, or the
  source vanished. No clock comparison exists anywhere in the predicate
  (negative-controlled: an ancient proposal with unchanged references
  confirms normally). Stale proposals cannot be confirmed unchanged
  (`QLT_PROPOSAL_STALE`); amendment/regeneration is the Q3 path.
- **Rejected/withdrawn proposals create no canonical record** and refuse
  re-decision (`QLT_PROPOSAL_ALREADY_DECIDED`).
- **Corrections append history.** The predecessor's content bytes are
  never touched (byte-compared negative control); the immutable
  correction row records the prior-content fingerprint; the successor
  inherits the subject's retention state; lineage links make every step
  attributable.
- **Duplicate successors and cycles fail closed.** One correction per
  `(subject, correction_key)` (UNIQUE); same-key replay converges to the
  SAME correction/successor; a different key against a non-current
  subject fails `QLT_RECORD_NOT_CURRENT`; self-reference is
  CHECK-forbidden; the pure `validateLineageChain` rejects crafted
  cycles.
- **Current-effective resolution is deterministic** (eligible status ∧
  currently-relevant; `effective_at_ms DESC, created_at_ms DESC, id ASC`),
  implemented in SQL and as a pure function, parity-tested on crafted tie
  sets.
- **Superseded/ineligible material fails eligibility;** confirmed
  eligible records stay attributable (proposal link + creator + source
  links). No Q2 code path assembles model context or connects records to
  a prompt — eligibility predicates and inspection reads only.
- **Idempotency.** Keyed verbs record
  `qlt_adapter_idempotency` rows IN THE SAME TRANSACTION as their effect
  (a failed transaction never consumes a key); same key + same canonical
  fingerprint converges with no duplicate rows; same key + different
  content fails `QLT_IDEMPOTENCY_CONFLICT`; concurrent duplicates converge
  to one row. Optimistic `expectedVersion` on every transition
  (`QLT_VERSION_CONFLICT`).

## 9. FENCE-1 treatment (new Shared World input contracts)

FENCE-1 (Q1 observation, open Low) is NOT closed by Q2 — the Q1 ingress
is untouched. What Q2 delivers is the FENCE-1 CONDITION the Q1 closure
imposed on new Shared World input contracts, fully implemented and
negative-controlled in `src/lib/sharedworld/meaning.ts`:

- unknown fields are REJECTED (`QLT_INPUT_UNKNOWN_FIELD`) — silent
  dropping is not the Q2 contract;
- an own `__proto__` key at any depth (including via `JSON.parse`) is
  REJECTED (`QLT_INPUT_PROTO_KEY`); `constructor`/`prototype` keys are
  plain own data and unknown fields in every closed schema; validators
  never write to input and build results from explicit literals —
  prototype pollution is structurally impossible (global-prototype
  untouched controls);
- inherited properties are never consulted (own-property enumeration
  only); null-prototype containers are accepted, exotic prototypes
  rejected;
- nesting-depth, key-count, array-count, string-length, and UTF-8 BYTE
  bounds (byte bound wins over char bounds; multibyte fixtures at and
  around 4096 bytes);
- non-serializable values (functions, symbols, BigInt, undefined,
  non-finite numbers, Date/RegExp, cycles) fail closed;
- deterministic normalization (sorted-key canonical JSON;
  key-insertion-order-invariant fingerprints);
- credential/secret non-persistence and non-echoing (canary controls);
- stable, non-echoing rejection codes carrying code + structural path
  only.

## 10. What Q2 does NOT do (boundary preserved)

No production proposal/confirmation/rejection/amendment/correction/
commitment actions; `/api/act` untouched (the five bounded thread
actions remain the entire declared surface — plan-verified); no new HTTP
route, UI control, agent tool, or capability; no context assembly or
prompt construction from records; no retention/deletion enforcement
(columns and vocabulary only); no autonomous learning; no alternate
write path; no VICT package, pin, lockfile-entry, or framework-semantics
change (`package-lock.json` byte-identical); no `.pi/` access; no
historical report modified; TEST-1 (browser replay recovery) remains
open with its binding Q3 deadline — Q2 adds no browser action.

## 11. Verification

Lane work used focused runs (per-lane typecheck, prettier, and the
focused vitest files; Lane B additionally a deleted scratch
self-verification of every validator/predicate). After integration — and
after the §5 reconciliation — the COMPLETE ladder was executed once, in
order, with no command skipped, timeout enlarged, or assertion weakened.
One incident is recorded truthfully: during the FIRST aggregate run
(`verify:quellight`), its internal format:check step flagged the two
documentation files that were being edited CONCURRENTLY with that run
(this report and the system reference — a run-race caused by the
integration owner, not a code or test defect; every other step of that
aggregate run passed, including both real-browser suites and the
170-file artifact scan). With the tree committed and static, the
affected command was re-run ONCE and finished green; no failure was
masked, no timeout was raised, and no assertion was changed.

| Command                     | Exit                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                    | 0                                                                                                                                                                                                                                  |
| `npm run format:check`      | 0                                                                                                                                                                                                                                  |
| `npm run typecheck`         | 0                                                                                                                                                                                                                                  |
| `npm test`                  | 0 — node: 8 files / 102 tests; ui: 2 files / 6 tests                                                                                                                                                                               |
| `npm run build`             | 0 (build-log scan: all warning lines on the closed allowlist)                                                                                                                                                                      |
| `npm run verify:stop`       | 0                                                                                                                                                                                                                                  |
| `npm run verify:consumer`   | 0 (13-member 0.2.0 identity re-derived from the public registry; N-2 held)                                                                                                                                                         |
| `npm run verify:governance` | 0                                                                                                                                                                                                                                  |
| `npm run verify:q2`         | 0 — 178 checks green (schema 139, deterministic 22, repository 7, structural 6, pins 2, wiring 2)                                                                                                                                  |
| `npm run verify:quellight`  | first run: 1 finding — format:check, the diagnosed concurrent-docs-editing race (§11 above; every other step of that run passed incl. both real-browser suites and the 170-file artifact scan); re-run on the final static tree: 0 |
| `npm audit --omit=dev`      | 0 vulnerabilities                                                                                                                                                                                                                  |
| `git diff --check`          | clean                                                                                                                                                                                                                              |

Focused Q2 evidence: `test/meaning-foundation.test.ts` (15 tests —
A-01..A-05, A-16..A-18, A-26 + storage guards), `test/sharedworld-meaning.test.ts`
(31 tests — A-06..A-15, A-19..A-30), `test/sharedworld.test.ts` (6 tests,
updated bookkeeping assertion), `test/governed-mutation.test.ts` (28
tests, unchanged and green), `verify:q2` 178 structural/deterministic
checks. Every important semantic assertion in the freeze §13 matrix has
an independently inspectable negative control with zero-effect
verification.

## 12. Documentation

- This report (new).
- `docs/system-reference.md` — current status block and Q2 boundary notes.
- `docs/decision-register.md` — dated additive status note on D-10 (Q2
  implemented, awaiting independent verification). No new decision
  identifier was created: Q2 introduces no new owner-level normative
  decision; its normative artifact is the frozen contract (§2), which
  derives from the Stage 07C handoff and the ratified OQ6 addendum.
- `README.md` — status block and verification list.
- Historical implementation, audit, remediation, re-verification,
  release, and closure reports remain BYTE-IDENTICAL, as do the Q1
  implementation/tests/audit/closure evidence.

## 13. Preservation

- Canonical input byte-identical (`e7f61d24…b01331`).
- VICT repository untouched and clean at `0f4f72b…`; only public-registry
  reads occurred (via the unchanged `verify:consumer` gate).
- Quellight remains exactly pinned to `@victframework/*@0.2.0`
  (`vict-release-set@1/0.2.0`, content ID `v1_7a557…8f172`);
  `package-lock.json` untouched by Q2.
- `.pi/` untouched and unread; no credential or authentication file read.
- Temporary worktrees (`qlt-q2-lane-a/b/c`), their branches, scratch
  files, probe databases, and ladder logs removed; tracked trees clean.
- Both repositories finish with `HEAD == origin/main` (Quellight pushed
  by normal fast-forward after a fresh fetch; VICT unchanged).

## 14. Genuine limitations (truthful)

1. The repository is a storage contract: it enforces lifecycle, lineage,
   authority, and idempotency at the port/SQL level, but Q2 wires NO
   production caller — ceremony UX, governed actions, and context
   assembly are Q3/Q4 work. The store being green does not mean meaning
   flows anywhere.
2. Withdrawal is user-actor-attributed in this schema revision (§5.3);
   agent-initiated withdrawal under product policy will need a Q3
   representation decision.
3. The one-open-proposal-per-(thread,kind,turn) rule is enforceable only
   where a turn reference is supplied (NULL turn refs are distinct under
   SQLite uniqueness); Q3 production proposals are expected to always
   carry turn correlation.
4. `PRAGMA foreign_keys = ON` is set at every store open (it is a
   per-connection setting); direct external writers using their own
   connections would not gain FK enforcement — irrelevant to the product,
   which owns one connection.
5. The `id TEXT NOT NULL PRIMARY KEY` declaration (vs 07B's
   `id TEXT PRIMARY KEY` on `qlt_thread`) is deliberate — SQLite allows
   NULL in a non-INTEGRITY primary key without NOT NULL; the Q2 tables
   pin the stronger form.
6. Lane C contributed the Q2 permanent tests but is NOT the later
   independent Q2 auditor; an independent verification of this entire
   phase remains outstanding.

## 15. Explicit stop point

Phase Q2 is IMPLEMENTED and AWAITING INDEPENDENT VERIFICATION. Phases
Q3–Q7 have not begun. Shared World meaning and the confirmation ceremony
remain unimplemented. Stage 07C and Stage 07 remain In Progress. No
`QLT-*` requirement is promoted by this report.
