# Quellight Stage 07D — Focused Independent D5 Re-Verification of the D2 Deep-Purge Remediation

**Independent auditor's report — 2026-09-24.**
**Verdict: VERIFIED WITH NON-BLOCKING ISSUES — STAGE 07D FORMAL CLOSURE PERMITTED.**
(0 Blocking / 0 High / 1 Medium carried / 2 new Low / 3 Low prior, dispositions below.)

This re-verification was performed by an independent agent that did **not**
implement the remediation and does not accept its completion report by
assertion: every claim below was re-derived from fresh evidence. No provider
was contacted, no credential accessed, no operator `.quellight-data` read, no
VICT `.pi/` read, no D4 live rerun, and no executable code modified.

---

## 1. Starting identities and history reconciliation

| Identity                                        | SHA                                        | Verified                                                                                    |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Quellight remediated tip (audited + final)      | `072430e74874dfb5b1c22c4771f7fc176c2be42d` | HEAD == `origin/main` after fresh fetch; tracked tree clean                                 |
| Pre-fix audited tree (D5 audit's audited state) | `60859c4e4f741b3d711f62bbae33303d638b06d9` | commit; parent of the audit report commit; ancestor of HEAD                                 |
| Original D5 audit report commit                 | `ed144b19d05aa19f4b7d7fea0b954548b0f51c26` | direct child of `60859c4e`; ancestor of HEAD                                                |
| VICT tip                                        | `4aa245d29a79b0e9f9f2e35b46597e7a10701571` | HEAD == `origin/main` after fresh fetch; tracked tree clean (only untracked `.pi/`, unread) |

- History is a strict fast-forward: `ed144b1 → 559e40a → b232682 → 483fd7c → 8e74991 → 3503a51 → 072430e`; no force-push, no divergence, remote equality on both repositories.
- **Amendment-before-execution ordering confirmed:** `559e40a` (the D2 safety-contract Amendment 1, docs-only, 2 files) lands **before** `b232682` (the executable change), exactly as the amended contract requires.
- **Boundedness:** the full diff `60859c4..072430e` touches exactly 18 files — 5 docs (README, decision register, system reference, the new Amendment-1 document, the new remediation report), the 3 added reports of the D5 audit commit itself, 4 executable files of the purge-order/contract-version surface (`deletion-store.ts`, `d2-contract.ts`, `composition.ts`, `conversation-lifecycle.ts`, `port.ts`, `sqlite.ts`, 2 route files — 8 in total), and 4 test/gate files (`verify-d2.mjs`, `d2-deep-purge.test.ts`, `verify-governance.mjs`, `governed-mutation.test.ts`). Every changed file belongs to the declared amendment, its coverage, the disclosed L-1 repair, or the status surfaces.
- **Byte-preservation:** all 22 D4 receipts/evidence/cleanup/organic-use/historical-report/machinery paths are blob-identical between `60859c4` and HEAD; `docs/report` gained only the 3 expected new documents and lost/modified nothing. The frozen contracts outside the declared amendment are unchanged. The migration-6 comment intentionally remains at `@1` (historical truth).

## 2. Independent reproduction of the old defect (B-1) on `60859c4`

On a disposable isolated worktree of `60859c4` (fresh `npm ci`, removed after
the probe), a custom probe drove the **real** composition, the **real**
proposal/confirmation ceremony, and the **real** governed deletion and purge
boundaries:

- Ceremony-created claim, commitment, and open loop each carry a **non-null `proposal_id`** (commitment additionally `normative_basis_proposal_id`), verified by raw SQL against the live store; `PRAGMA foreign_keys = 1` confirmed on the store connection.
- The governed plus-meaning deletion completes (`completed`).
- The governed deep purge **fails with the raw SQLite error** `ERR_SQLITE_ERROR: FOREIGN KEY constraint failed` — a raw constraint error, not a typed `QLT_*` refusal.
- **Full rollback proven:** no purge receipt row anywhere; claim/commitment/open-loop tombstone rows retained (with `proposal_id`); all three proposal rows retained; the thread tombstone row retained; the deletion row still `completed`; `PRAGMA foreign_key_check` clean after the rollback.
- **H-1 mask confirmed on the same tree:** a direct-verb-only thread (all `proposal_id` NULL) deletes and purges successfully — the pre-fix gate's direct-verb fixtures could not see the defect. (18/18 probes PASS.)

## 3. Independent foreign-key graph derivation (not trusting the reported order)

From a freshly migrated current store, `PRAGMA foreign_key_list` was enumerated
over all 17 `qlt_*` tables. The derived graph has **exactly 20 FK edges**;
parents are exactly `qlt_proposal`, `qlt_commitment`, and `qlt_thread`:

- `qlt_conflict_challenge` → thread / proposal / commitment (deleted step 1)
- `qlt_amendment` → thread / commitment ×2 (step 2)
- `qlt_correction` → thread (step 3); `qlt_source_link` carries no FK (step 4)
- `qlt_claim` → thread / **proposal** / self (supersedes) — step 5, **before proposals**
- `qlt_commitment` → thread / **proposal ×2** / self — step 5
- `qlt_open_loop` → thread / **proposal** / self — step 5
- `qlt_proposal` → thread (step 6 — now AFTER the subjects); `qlt_context_assembly` → thread (7); `qlt_thread_conversation` → thread (8); `qlt_thread` (9)

**Every in-scope FK edge is satisfied by the implemented order (0 violations).**
Self-referential `supersedes_id` chains resolve within the single per-family
statement; cross-thread references into a purge scope fail closed (proven in
§4). The repair keeps `PRAGMA foreign_keys = ON`, performs no cleanup outside
the single `BEGIN IMMEDIATE` transaction (receipt inside; VACUUM best-effort
after commit), does not broaden any scope (all `WHERE source_thread_id = ?`
clauses unchanged), and does not clear `proposal_id` on ordinary logical
removal (the D1 retention/meaning stores are byte-unchanged since `60859c4`).

## 4. Repaired behavior through real boundaries — independent battery (24/24 PASS)

A custom battery (disposable synthetic stores; composition-level AND store-level) verified:

- **Ceremony-created claim/commitment/open-loop** deep purge through the composition lifecycle succeeds with truthful, content-free receipts (proposals=3, originatingTombstones=3); scope fully removed; thread gone; replay refuses truthfully (`QLT_PURGE_NOT_AVAILABLE`) with the receipt still readable.
- **Conversation-only deletion preserves meaning**: the claim row stays `currently-relevant` with its proposal anchor; the purge removes only the shell (tombstones=0, proposals=0; the thread tombstone row legitimately stays as the provenance FK anchor); `foreign_key_check` clean.
- **Same-key replay/convergence**: duplicate `planDeletion` with one key yields ONE row; idempotent step replays; purge succeeds.
- **Mixed scope** (ceremony claim + commitment, real amendment lineage via `amendCommitment`, real correction lineage with a `supersedes_id` successor, cross-thread commitment-conflict challenge via the production `detectCommitmentConflict` wiring, one direct-verb record): purge receipt exact (challenges=1, amendments=1, corrections=1, proposals=3, originatingTombstones=5); the cross-thread challenge is removed; Q's own proposal row survives; both lineage chains fully removed; **full-store row inventory byte-identity** outside the authorized scope (0 violations); `foreign_key_check` clean.
- **Foreign reference INTO the scope fails closed**: a cross-thread correction successor (`supersedes_id` into the scope) makes the purge fail with the raw FK error; the store is **byte-identical** after the failure (steps 1–4 mid-purge deletions fully rolled back), NO receipt, `foreign_key_check` clean; after a **close/reopen restart** the truthful state persists; after the foreign child leaves through its OWN governed path the scope purge converges with truthful counts.
- **Unrelated conversation and meaning rows byte-identical** across successes and failures (witness rows in separate threads).

## 5. H-1 non-vacuity (gate + focused suite proven non-vacuous)

- The new fixtures **create meaning through the real ceremony** (`createProposal` → `markProposalAwaitingDecision` → `confirmProposal`, non-user proposers refused) with explicit assertions of non-null `proposal_id` / `normative_basis_proposal_id`; the old direct-verb-only concealment is structurally closed (the gate's purge-closure section is ceremony-driven).
- **Against the pre-fix tree `60859c4`** (disposable worktree, fresh install): the new focused suite fails **3 of 4** tests, each with the raw `FOREIGN KEY constraint failed` error (the 4th — the fail-closed control — passes on both trees by design). The new `verify:d2` overlay goes **red exactly on the new ceremony controls** (`N-D2-19: … cause=ERR_SQLITE_ERROR` plus its dependent closure/receipt/integrity checks — 6 red; dependent checks unevaluated after the reds).
- **On the remediated tree:** `verify:d2` **87/87 checks green**; the focused suite **4/4 PASS**.
- **No assertion weakening:** the style commit `3503a51` only reflows line-wrapped assertions (identical predicates); the L-1 commit `8e74991` preserves the containment invariant and the negative assertions (VICT-checkout and workspace-source refusals) verbatim.

## 6. L-1 portability repair independently confirmed

In a disposable checkout of the **same commit under a different directory
name** (fresh `npm ci`): `verify:governance` **PASS** and
`test/governed-mutation.test.ts` **28/28 PASS** with the repaired files; the
same overlay experiment with the OLD hard-coded files **fails** there
(governance FAIL; 1/28 test) — proving the repair necessary, substantive, and
assertion-neutral.

## 7. Carried findings — dispositions

- **M-1 (Medium, carried — process, non-blocking).** Re-verified factually: `6856d45` is labeled docs/standalone yet lands the full Lane B implementation (1838 lines: `conflict-store.ts`, `conflict-surface.ts`, `test/d3-conflict.test.ts`, composition wiring). The co-landed amendment text is semantically precise and matches the co-landed DDL/machine data — **no frozen-contract ambiguity** (contract text, schema data, migration, and tests co-landed coherently). **No executable bypass**: the co-landed machinery is exactly what `verify:d3` (35 checks) gates and what the prior D5 audit independently verified 13/13 through the production conflict-hook wiring. History is NOT rewritten (owner directive). Carried as a process/attribution finding; later amendments corrected the pattern.
- **L-2 (Low, carried — ruling unchanged).** The organic-use record is byte-identical since `60859c4`; no new evidence exists; the prior ruling (aggregate OB-1/3/4/7 attestation permitted by the frozen text, honestly labeled, materially weaker than direct answers) stands preserved. The optional direct owner answers were not recorded; this remains optional.
- **L-3 (Low — remains repaired).** The system-reference status tail is current and truthful through the remediation and this re-verification.
- **L-1 (Low — repaired, verified)**: §6.

## 8. New findings from this re-verification (both non-blocking)

- **L-4 (Low, NEW — frozen-report vs artifact-scan conflict).** `verify:quellight`'s credential/canary/local-path scan deterministically flags the **frozen D5 audit report itself** (`docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md`): that report quotes the auditor's own local environment paths in its §1 identity lines. The file entered the tree in the audit's own commit — AFTER that audit's battery ran — so this is the first ladder to see it. It is not a remediation regression, not a credential/canary issue, and adds no exposure (the report is already on the public remote). The conflict is between two frozen rules (byte-preserve historical records vs no-local-paths hygiene) and requires an **owner decision**: a future owner-authorized scan-scope exception for frozen historical documents, or an owner-authorized redaction of the historical report. Neither is performed here (no executable change; historical records byte-preserved).
- **L-5 (Low, NEW — intermittent in-sequence browser-ceremony flake; pre-existing).** Inside the full composite (and in a 3-check browser sequence), `browser-ceremony-check` intermittently times out at a late-phase tray-reopen wait (20 s) — and passes standalone. The check's main ceremony proofs (steps 1–9b) always pass before the flake point. Controlled characterization: fresh worktree of the **pre-fix tree `60859c4`** failed the same sequence (1 of 3 trials); fresh worktree of the **remediated tip** failed identically (1 of 3 trials; standalone 2/2 PASS); the gate script is byte-identical since the 07C era, and VICT's §0.32 records the same flake class during the Phase Q7 audit. **Not a remediation regression**; environmental/load-sensitive. Recorded truthfully: composite run 1 and run 2 each reported it; standalone reruns green with identical assertions and no timeout changes.

## 9. Authoritative verification ladder (frozen tree `072430e`, fresh `npm ci`)

| Step                                           | Exit                                  | Result                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                       | 0                                     | 297 packages                                                                                                                                                                                                                                                                                                    |
| `verify:consumer`                              | 0                                     | registry-only exact-pin consumption; unreachable-registry negative control held                                                                                                                                                                                                                                 |
| `verify:quellight` run 1                       | 1                                     | 2 findings: browser-ceremony flake (L-5) + scan-vs-frozen-report (L-4); all internal steps green except 6c                                                                                                                                                                                                      |
| `verify:quellight` run 2                       | 1                                     | same 2 findings (both classified above)                                                                                                                                                                                                                                                                         |
| — format:check / typecheck / verify:governance | 0 / 0 / 0                             | inside both composites                                                                                                                                                                                                                                                                                          |
| — verify:q2 / q3 / q4 / q5 / dev-start         | 0                                     | preservation gates green                                                                                                                                                                                                                                                                                        |
| — test:node                                    | 0                                     | **30 files / 357 tests** (also run standalone: identical)                                                                                                                                                                                                                                                       |
| — test:ui                                      | 0                                     | happy-dom island suites                                                                                                                                                                                                                                                                                         |
| — build + warning scan                         | 0                                     | 1 warning, on the closed allowlist (known Node 22 experimental-SQLite notice)                                                                                                                                                                                                                                   |
| — browser-check / browser-stop-check           | 0 / 0                                 |                                                                                                                                                                                                                                                                                                                 |
| — browser-ceremony-check                       | 1 in-composite; **0 standalone (×2)** | L-5                                                                                                                                                                                                                                                                                                             |
| verify:q6                                      | 0                                     | 114 checks                                                                                                                                                                                                                                                                                                      |
| verify:stage7c                                 | 0                                     | N-C1..C25                                                                                                                                                                                                                                                                                                       |
| verify:d1                                      | 0                                     | 49 checks                                                                                                                                                                                                                                                                                                       |
| **verify:d2**                                  | 0                                     | **87 checks (incl. N-D2-19..24)**                                                                                                                                                                                                                                                                               |
| verify:d3                                      | 0                                     | 35 checks                                                                                                                                                                                                                                                                                                       |
| verify:dev-live                                | 0                                     | 19 checks (offline loopback; no provider contact)                                                                                                                                                                                                                                                               |
| verify:d4-prep                                 | 1                                     | **exactly the documented by-design red**: the sealed attempt-2 bundle intentionally occupies the canonical active paths, so the all-active-paths-absent invariant cannot hold; the gate goes history-aware (N-D4-P-27/28 correctly skipped, history preserved). Documented refusal invariant, NOT a regression. |
| verify:browser-d2                              | 0                                     | real-browser D2 purge ceremony; axe clean at 1280/390 px                                                                                                                                                                                                                                                        |
| `npm audit --omit=dev`                         | 0                                     | 0 vulnerabilities                                                                                                                                                                                                                                                                                               |
| `git diff --check`                             | 0                                     | clean                                                                                                                                                                                                                                                                                                           |

The live provider session was NOT run; D4 was NOT re-executed; no one-shot
authorization was consumed.

## 10. Preservation and cleanup

All disposable material (old-tree worktrees, fresh-worktree controls, probe
scripts, temp stores) was removed after each experiment; the audited tree was
left byte-clean (`git status` clean; `git diff --check` clean). Historical
records, D4 evidence, frozen contracts, and the D5 audit report are
byte-preserved. No executable code was modified by this audit.

## 11. Verdict

**VERIFIED WITH NON-BLOCKING ISSUES — STAGE 07D FORMAL CLOSURE PERMITTED.**

Blocking B-1 and High H-1 are remediated with independently reproduced defect
evidence, an independently derived FK graph, real-boundary behavioral proofs,
and demonstrated non-vacuous coverage. The remediation is bounded, the
amendment landed before the executable change, and all unrelated records are
byte-preserved. Stage 07E is **PERMITTED and NOT BEGUN**.

— Independent D5 re-verification auditor, 2026-09-24
