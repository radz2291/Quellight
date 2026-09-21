# Quellight Stage 07C — Phase Q6 Live-Harness Safety Hardening Report

**Status:** two bounded safety defects (S-1 deletion of an unowned path;
S-2 swallowable final credential scan) in the Q6 live-proof harness were
corrected fail-closed. This is a verification-harness correction only:
the frozen Q6 contract, its bounds, the provider identity, the ceremony
behavior, the authority rules, the product source, and the durable
schema are unchanged. **The authoritative live-provider execution count
remains ZERO. Q6 remains
`IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION` with the live proof
NOT executed; Phase Q7 remains BLOCKED — NOT BEGUN.**
**Date:** 2026-09-21/22.
**Prior remediation record (unchanged, historical):**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-LIVE-DATA-ISOLATION-REMEDIATION.md`.

## 1. SHAs

| Event                                                                         | SHA                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------ |
| Starting tree (verified `HEAD == origin/main`)                                | `49305197d91470d5caa0c333cf42e60be7c4f333` |
| Fix — `fix(stage-07c): fail closed without deleting unowned live-proof paths` | `6a81f66…` (verified on this tree)         |
| Documentation                                                                 | this commit                                |

VICT remained read-only at `153384877ae90b79c990636eba28fde2e50ae7d5`
(`HEAD == origin/main` verified by fresh fetch; its pre-existing
untracked `.pi/` material was never read, opened, or modified).

## 2. S-1 — deletion of an unowned path

**Old behavior:** in `composeLive`, when
`requireCompositionDataDir` rejected a composition-reported directory,
the catch block recursively deleted the REJECTED path:

```js
rmSync(resolve(composition.dataDir), { recursive: true, force: true });
```

A path rejected precisely because it is not the owned workspace must
never be recursively deleted — had a future composition defect reported
the repository, operator data, or any unrelated location as its data
directory, this cleanup could have destroyed unowned data. The failure
path also re-threw the identity error whose message embedded the foreign
path, echoing it into credential-bearing proof output.

**Correction (commit `6a81f66…`):**

- ALL recursive deletion of composition-reported or other unowned paths
  is removed; the `rmSync` and `resolve` imports are removed from the
  live script entirely, along with the `node:fs` import — the harness
  now has NO deletion capability at all. The ONLY permitted removal
  target is the verified owned workspace root, through the owned
  workspace's `dispose()` (called exactly once, in the proof's
  `finally`, after both scan outcomes).
- On a composition-directory mismatch: close the composition; record a
  stable, non-echoing failure (`path not echoed`); leave the unowned
  path completely untouched; dispose only the owned root.
- NEW pre-construction validation: the RESOLVED Quellight environment's
  data directory (`env.dataDir` from `resolveQuellightEnvironment`) is
  validated against the owned workspace (`requireResolvedEnvironment-
DataDir`) BEFORE the composition is constructed — so the ownership
  chain is now: caller-passed root → dataEnv → resolved environment →
  composition-reported `dataDir`, with a fail-closed assertion at every
  link, all before any provider turn.
- No unexpected foreign path is ever printed in proof output (three
  distinct stable non-echoing failure messages; the thrown identity
  errors are converted to generic non-echoing messages before reaching
  the crash handler).

## 3. S-2 — final scan failure was swallowed

**Old behavior:** the final credential scan was wrapped in a catch
treating EVERY exception as "nothing left to scan," and the helper's
`scanForCredential` treated an `ENOENT` workspace root as an empty CLEAN
scan. An unreadable, unexpectedly missing, or otherwise unscannable
workspace would have been reported as credential-clean — invalid
evidence.

**Correction (commit `6a81f66…`):**

- `scanForCredential` now FAILS (throws) unless traversal COMPLETES:
  an unexpectedly absent root ("an absent workspace is NOT evidence of
  a clean scan"), a non-directory root, an unreadable entry, and any
  traversal error surface as scan failures. Only a completed traversal
  can produce a result (empty = every byte read and credential-free).
- The final harness scan converts EVERY scan exception into a proof
  failure ("an incomplete scan is never treated as credential-clean");
  it is never silently caught, never echoes the credential or file
  contents.
- Cleanup still runs after a scan failure, remains restricted to the
  single owned root, and an unremovable root remains a proof failure.

## 4. Negative controls and focused evidence (permanent, offline)

New permanent suites `test/q6-live-workspace-safety.test.ts` (10 tests,
all offline — no provider, no credential, no repository or operator data
access; disposable temp fixtures only) prove:

1. a rejected foreign directory containing a sentinel file remains
   completely untouched (bytes identical);
2. a repository path is rejected and never deleted (real product source
   still present and untouched after the refusal);
3. an operator `.quellight-data`-NAMED path (a disposable fixture — the
   real operator directory is never referenced on disk) is rejected
   through every ownership assertion and never deleted;
4. the live harness contains NO recursive deletion of a
   composition-reported path (no `rmSync`, no `node:fs` import at all);
5. the only permitted removal target is the owned root (exactly one
   `workspace.dispose()` call; a sibling outside the owned root with a
   sentinel file survives disposal while the root is removed);
6. an unexpectedly missing root causes the credential scan to FAIL,
   not return clean;
7. an incomplete/unreadable traversal (a dangling directory entry) and
   a non-directory root cause scan failure;
8. scan failure still proceeds to owned-root cleanup (scan throws →
   dispose removes exactly the root);
9. a completed traversal still detects nested credential canaries;
10. the normal same-root initial/restart path remains green (fresh
    allocation, resolved-environment and composition identity both
    validated, clean completed scan, successful disposal).

The lifecycle suites (11 tests) were kept green (the allocation-count
proof was made deterministic under parallel test workers via fresh-
allocation/fixed-point attribution; the strict single-allocation
property remains pinned by the structural single-`mkdtempSync` proofs).

**Negative controls:** foreign/repository/operator-named paths are
refused with specific reasons and provably untouched afterward (tests
1–3); planted canaries are detected while absent values scan clean
(tests 8–9); an absent root is refused as a clean scan (test 6).

**`verify:q6` strengthening:** the `live-workspace` section grew from 6
to 11 checks, adding: no-`rmSync`/no-`fs`-import in the harness; exactly
one `workspace.dispose()`; three non-echoing identity failures plus the
environment pre-validation; the scan-failure-to-proof-failure conversion
(with the old swallow-marker required absent); and the helper's
fail-closed scan contract. The behavioral guard now runs BOTH focused
suites (`--no-file-parallelism`). Both S-1 and S-2 can therefore not
regress unnoticed.

## 5. Focused FastGate verification (exact commands and exits)

```text
npm run format:check                                        EXIT=0
npm run typecheck                                           EXIT=0
npx vitest run (lifecycle + safety suites)                  EXIT=0  (21 passed)
npm run verify:q6                                           EXIT=0  (100 checks incl. 11 live-workspace)
npm run verify:stage7c                                      EXIT=0  (release identity stable)
git diff --check                                            EXIT=0
```

The broad browser/Q2–Q5 ladder was deliberately NOT repeated (bounded
harness correction).

## 6. Files changed (Git-derived)

```text
scripts/lib/q6-live-workspace.mjs        |  70 +++++++-
scripts/verify-q6-live.mjs               |  85 ++++++-----
scripts/verify-q6.mjs                    |  37 +++-
test/q6-live-workspace-lifecycle.test.ts |  15 +-
test/q6-live-workspace-safety.test.ts    | 255 +++++++++++++++
```

Plus this report and the current status-surface updates in the docs
commit. `package.json` and `package-lock.json` are byte-unchanged; no
product source or durable schema changed; provider identity, bounds,
ceremony behavior, authority rules, the frozen contract, and all
historical reports are unchanged.

## 7. Preservation, cleanup, and execution accounting

- `OLLAMA_API_KEY` was neither present nor accessed at any point
  (presence-only checks; never printed, inspected, hashed, serialized,
  or written). `npm run verify:q6:live` was NOT invoked.
- **The authoritative live-provider execution count remains ZERO.**
- The operator `.quellight-data` directory was never opened (mtimes
  unchanged, metadata-only observation); VICT remained read-only and
  untouched; VICT identity re-derived stable from the unchanged lockfile
  by `verify:stage7c`.
- Every test fixture was a disposable OS-temporary directory and was
  removed by its suite; no temporary directories remain after the run.
- The remote was fetched before the push; the push is a normal
  fast-forward; after it `HEAD == origin/main`.
