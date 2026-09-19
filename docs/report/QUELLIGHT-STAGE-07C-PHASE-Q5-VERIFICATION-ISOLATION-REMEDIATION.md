# Quellight Stage 07C — Phase Q5 — Verification-Data Isolation Remediation Report

```text
STATUS: REMEDIATED (narrow, post-Q5 verification-isolation fix; additive to Phase Q5)
Phase Q5 remains IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (unchanged by this remediation).
Phase Q6 implementation has NOT begun.
Stage 07 remains In Progress.
Remediation base: f18cff8250bdac52dc37d4d4275698f3712c6966 (Quellight; == origin/main at task start)
VICT: 4b9fed21430787a72eda76b1b72d448f234f05fa (read-only; untouched; not accessed beyond its committed state)
```

This report records a narrow remediation of the Phase Q5 verification
tooling. It is NOT Q5 product work, changes NO Q5 behavior, and does not
begin independent verification, formal closure, Q6, M-1 remediation,
provider work, or project-scoped conversations. The historical Phase Q5
reports are preserved byte-for-byte; corrections to their wording are
made HERE, additively.

## 1. Root cause (what actually happened)

The development-start regression gate (`scripts/verify-dev-start.mjs`,
introduced at D-11) proves the ordinary `npm run dev` path by spawning
the real Vite development server rooted at the repository and requesting
`GET /`. The page's server load (`src/routes/[...vict]/+page.server.ts`,
Stage 07B architecture) starts the full application composition, which —
with no data-location override — opens the DEFAULT operator data
location (`.quellight-data` relative to the repository root). The
relative `QUELLIGHT_DATA_DIR` seam can only ever anchor INSIDE the
repository, so no verifier could isolate its store with the existing
mechanism.

Consequently, when the Q5 authoritative verification ladder ran this
gate, the gate's `GET /` composed the application against the real
operator database and thereby applied additive migration 4's schema
(`qlt-memory-mode-policy`: the `qlt_memory_policy` and
`qlt_turn_memory_policy` tables) to it. Per the disclosure in the
implementation report (§6a, preserved verbatim below): the migration is
CREATE-TABLE-only by frozen design; both new tables were verified EMPTY;
every pre-existing user row family was reported intact and untouched;
the lazy default-policy seed never ran. No content damage is indicated —
but the gate was capable of touching operator data, which violates the
isolation rule under which verification must operate, and would do so
again on every future run.

## 2. Wording correction (recorded additively; historical text preserved)

The Q5 implementation report's §6a sentence "No test, verifier, browser
script reads or writes the operator data directory" was TOO BROAD and is
corrected by this report: the development-start verifier did CAUSE a
schema write to the operator data directory — indirectly, through normal
application startup against the default data location during `GET /`.
The verified facts in that section (empty new tables; intact existing
rows; no test fixture or browser script using the operator directory)
stand unchanged. The two tables already created in the operator database
belong to Q5's legitimate forward migration, will be used by the real
application, and were NOT removed.

## 3. Remediation

Two committed changes, nothing else:

1. **A typed configuration seam** (`src/lib/server/composition.ts`):
   `QUELLIGHT_DATA_DIR_ABSOLUTE` — an optional absolute data-directory
   override in `resolveQuellightEnvironment`, fail-closed by design: it
   must be absolute; it must not be combined with the relative
   `QUELLIGHT_DATA_DIR`; and it must resolve strictly OUTSIDE the
   repository — in particular never at or inside the default operator
   data directory (pure path-arithmetic guard; the operator path exists
   in the guard only as a resolved comparison string and is never
   opened). Ordinary `npm run dev` startup never sets the variable and
   keeps the configured/default operator location unchanged.
2. **The isolated gate** (`scripts/verify-dev-start.mjs`): the verifier
   now creates its own disposable data directory via `mkdtempSync` in
   the OS temporary directory with a unique task-owned identity, passes
   it to the spawned server explicitly through the seam, and fails
   closed if the path is missing, unresolvable, equal to or inside the
   default operator path, or inside the repository. Every prior check is
   preserved: configuration identity, real Vite config, strict port,
   cold optimizer cache with restore, HTTP and module-transform
   pipeline, fatal-signature set, ZERO-project-warning gate, process-tree
   teardown, and the closed external-notice allowlist.

Permanent regression coverage added to the gate (every run):

- the verifier-side guard is regression-checked in-process (expected
  refusals: missing path; the default operator directory itself; a path
  inside it; a path inside the repository);
- the spawned child environment is asserted, before start, to carry the
  explicit task-owned path;
- after teardown the task-owned directory MUST contain the initialized
  stores, opened READ-ONLY to prove the migration chain 1..4 (including
  `qlt-memory-mode-policy`) ran THERE — a missing store fails the gate
  (a dropped or ignored override would otherwise silently fall back to
  the default operator location);
- a permanent spawned negative control exercises the application-side
  seam through the real boundary with an override inside the repository:
  the composition must refuse (non-200), and the control's own
  task-owned directory must remain empty;
- released ports are re-proved free after every teardown (no listener
  remains);
- every task-owned temporary directory is removed in a `finally`
  equivalent path and its removal is VERIFIED (failed cleanup fails the
  gate); only in the disclosed guard-regression scenario is the
  control's repository-side fallback path removed as well;
- proven on both a successful run and a deliberately failed run
  (§5).

## 4. Safe negative control (historical behavior, demonstrated and removed)

To demonstrate the starting behavior, the pre-remediation verifier was
run once inside a disposable `git worktree` created at the remediation
base commit in the OS temporary directory, with its own `npm ci`. The
starting verifier PASSED and initialized that worktree's OWN default
store (`<worktree>/.quellight-data`) with the full migration chain
(version 4 `qlt-memory-mode-policy` present) — demonstrating, safely and
without any reference to the real repository's `.quellight-data`, the
exact mechanism that had reached the operator database during the Q5
ladder. The worktree, its store, its `node_modules`, and all generated
data were then removed (`git worktree remove --force` + prune), leaving
only the main working tree.

## 5. Verification evidence (narrow, per the remediation scope)

```text
npm run format:check        PASS
npm run typecheck           PASS
npm run verify:dev-start    PASS — isolated task-owned OS-temporary data dir;
                            store proof (migrations 1..4) read back after teardown;
                            in-process guard refusals verified; spawned guard
                            control refused with an empty control directory;
                            ports released; all task-owned directories removed
                            and removal verified; ZERO project Svelte warnings
test/dev-start-data-seam…   PASS — 6 focused behavioral tests of the seam on a
                            SYNTHETIC repository root (default/relative behavior
                            unchanged; operator-path, repository-path, relative,
                            traversal, and combined-form refusals)
npm run build               PASS (only the closed-allowlist notices)
git diff --check            PASS
```

Deliberate-failure cleanup proof (disclosed negative invocation, NOT a
rerun of an unexpected failure): with `QUELLIGHT_DATA_DIR` preset in the
environment, the application's seam refused the combined form through
the real boundary (`QuellightCompositionError: QUELLIGHT_DATA_DIR_ABSOLUTE
must not be combined with QUELLIGHT_DATA_DIR`; `GET /` → 500), the gate
failed loudly with the store-isolation message, and cleanup nonetheless
removed the task-owned directory (verified absent afterwards; exit 1).
The subsequent legitimate run passed (§5 above).

`package-lock.json` is byte-identical (not modified). The changed-file
set is exactly: `scripts/verify-dev-start.mjs`,
`src/lib/server/composition.ts`, `test/dev-start-data-seam.test.ts`,
this report, and the two current-documentation wording corrections in
`docs/decision-register.md` and `docs/system-reference.md` (§6).

## 6. Ladder wording reconciliation (truthful record)

The Q5 authoritative ladder was previously summarized as "green
first-run". The surviving evidence — the session record of the run; the
raw command logs were removed during post-run cleanup — establishes that
an environmental file lock (a leftover `npm run dev` process from the
D-11 investigation holding esbuild/libsql artifacts, outside the
repository's lifecycle) interrupted the initial `npm ci` attempt of the
authoritative sequence; the offending processes were terminated; and the
subsequent complete sequence — on the same untouched, clean, committed
tree at `a2d1f272…` — passed in full (`npm ci`; `verify:consumer`;
`verify:quellight`; `npm audit --omit=dev` 0 vulnerabilities;
`git diff --check`). The unqualified "first-run green" claim is
corrected accordingly: ONE attempt was interrupted by an environmental
file lock, and the SUBSEQUENT complete frozen-tree sequence passed. No
failure was rerun silently; no timeout was raised; no assertion was
weakened. Should the interruption instead have fallen before the
declared sequence began rather than aborting its first `npm ci`, the
corrected wording remains the accurate conservative record — it asserts
only what the evidence supports. The completed ladder remains the
executable verification of record for Phase Q5, anchored at
`a2d1f272…`, and the fresh independent audit will rerun it in full.

## 7. Data-safety record

During this remediation the real operator database
(`.quellight-data`) was NOT opened, queried, hashed, copied, inspected,
migrated, altered, deleted, or otherwise accessed — not by any gate, not
by any test, not by the negative control (which ran against a disposable
worktree's own store), and not by the author (the implementation
report's disclosure is accepted as the historical evidence). The two
tables previously created in the operator database remain in place as
Q5's legitimate forward migration. No development server was started
against the default operator data location. Before any gate ran, the
process table was checked for stale Quellight development processes
(vite/esbuild/`npm run dev` command lines): none were found, so none
were terminated.

## 8. Status

The verification-isolation defect is REMEDIATED. Phase Q5 remains
exactly `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` — not
Verified, not formally closed; no `QLT-*` requirement is promoted.
Phases Q6–Q7 have not begun. M-1 remains open with its hard deadline.
VICT remains pinned at the immutable `@victframework/*@0.2.0` set and
was not modified. Stage 07 remains In Progress.
