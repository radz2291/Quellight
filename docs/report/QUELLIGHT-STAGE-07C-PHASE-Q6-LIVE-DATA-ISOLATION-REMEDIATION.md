# Quellight Stage 07C — Phase Q6 Live-Proof Data-Isolation Remediation Report

**Status:** the bounded live-provider ceremony harness (`verify:q6:live`,
N-C24) had a data-directory identity defect; it is now remediated. The
frozen Q6 contract was NOT amended (zero semantic changes — this is an
implementation-conformance correction). **Q6 remains
`IMPLEMENTED — AWAITING INDEPENDENT Q7 VERIFICATION` with the live proof
NOT executed; the authoritative live-provider execution count remains
ZERO; Phase Q7 remains BLOCKED — NOT BEGUN.**
**Date:** 2026-09-21/22.
**Governing contract (unchanged):**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md`
(freeze commit `ca82892…`). The original implementation record
(`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md`) and all
historical reports are unchanged.

## 1. SHAs

| Event                                                          | SHA                                        |
| -------------------------------------------------------------- | ------------------------------------------ |
| Starting tree (verified `HEAD == origin/main`)                 | `6cdbf0750bc8a3147ec7274e3c13a4c748b31afc` |
| Fix — `fix(stage-07c): reuse one Q6 live-proof data directory` | `c0e5a93…` (verified on this tree)         |
| Documentation                                                  | this commit                                |

VICT stayed read-only at `153384877ae90b79c990636eba28fde2e50ae7d5`
(`HEAD == origin/main` verified by fresh fetch; its pre-existing
untracked `.pi/` material was never read, opened, or modified).

## 2. The exact old behavior (root cause)

At the starting SHA, `scripts/verify-q6-live.mjs` did:

```js
const dataDir = mkdtempSync(join(tmpdir(), 'qlt-q6-live-'));   // (1) the "owned" dir
const composeLive = async (reuseDataDir = false) => {
  const dir = reuseDataDir ? dataDir : mkdtempSync(...);       // (2) a SECOND temp dir
  ... QUELLIGHT_DATA_DIR_ABSOLUTE: dir ...                     // (3) the composition ran THERE
};
...
const restartDataDir = composition.dataDir;                    // (4) assigned, NEVER used
const composition2 = await composeLive(true);                  // (5) restart recomposed against (1) — the WRONG store
```

Leak scans walked only `dataDir` (1) and the `finally` cleanup removed
only `dataDir` (1). Had the credential-backed proof been run: the
restart persistence proof would not have tested the first composition's
durable store (the proof would truthfully FAIL at restart); the first
composition's actual directory could escape credential scanning; and
that directory could remain after cleanup. **The defect never fired:
the live proof has never executed (the credential was absent), so the
frozen one-execution allowance remains unused and no live evidence was
ever produced from a wrong store.**

## 3. Why the original offline gates missed it

The Q6 offline gates (`verify:q6`, `verify:stage7c`, the vitest suites)
exercised the REAL composition's own restart/fresh-thread/hostile-memory
behavior through their own test helpers — which always passed the data
directory explicitly and correctly — and checked the live harness only
STRUCTURALLY (gate refusal patterns, frozen bounds, package mapping,
never-automatic enforcement, leak-scan presence). The harness's
directory choreography (allocation → composition identity → restart
target → scan scope → cleanup scope) sits INSIDE the credential-gated
body, which no offline gate ever executes, and no behavioral test
covered the workspace lifecycle itself. The structural checks asserted
that patterns were present, not that the directory plumbing behaved
correctly — the gap this remediation closes with behavioral suites.

## 4. The corrected directory lifecycle

A new script-only helper — `scripts/lib/q6-live-workspace.mjs` (no
product source, no durable schema, imports only node builtins) — owns
the workspace, and the harness now reads:

```js
const workspace = createQ6LiveWorkspace();        // EXACTLY ONE mkdtempSync, in the helper
const ownedDataDir = workspace.root;
const composeLive = async (directory) => {        // EXPLICIT path argument (no boolean flag)
  workspace.requireOwned(directory, 'composeLive');          // refuses anything but the owned root
  ... ...workspace.dataEnv(directory)...                     // env carries the owned root
  const composition = await createQuellightComposition(...);
  try { workspace.requireCompositionDataDir(composition, 'composeLive'); } // identity assertion
  catch (error) { close + remove foreign dir + throw; }      // FAILS CLOSED BEFORE ANY PROVIDER TURN
  composed.push(composition);
};
const composition  = await composeLive(ownedDataDir);  // initial
const composition2 = await composeLive(ownedDataDir);  // restart — the SAME explicit path
```

- The unused `restartDataDir` assignment is REMOVED; restart identity is
  now enforced by the runtime assertion (which also runs for the initial
  composition, immediately after composition and before any provider
  turn, so an identity mismatch can never reach the provider; the
  mismatching foreign directory is closed and removed before failing).
- Repository paths and the operator `.quellight-data` directory are
  refused by name/segment (and any path outside the OS temporary
  directory), fail-closed.
- `scanForCredential(secret)` walks EVERY file under the owned root
  (nested included) — the exact directory every composition ran
  against; ledger frames and the serialized operator configuration
  remain scanned as before.
- `dispose()` removes the complete owned root with bounded retries on
  success AND every failure path (single `finally`), NEVER throws, and
  reports `{ removed }`; the harness maps `removed: false` to a proof
  FAILURE (fail closed) instead of the old best-effort note.
- There is NO second `mkdtempSync` anywhere in the live proof and no
  untracked composition directory can exist.
- All live bounds (≤6 turns / 256 tokens / 120 s / one execution / zero
  retries / no fallback), the provider identity
  (`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`), the
  ceremony behavior, authority assertions, the double refusal gate, and
  the metadata-only output redaction are unchanged.

## 5. Old-tree negative control (non-vacuous; offline)

A disposable git worktree at the starting SHA `6cdbf075…` was created in
the OS temp directory (with a `node_modules` junction so the starting
tree's own modules resolved), and an independently authored probe
replicated the OLD two-directory flow against the STARTING tree's real
composition — fully OFFLINE (deterministic fixture model; NO provider
call, NO credential). Output (probe exit 0 = defect demonstrated):

```text
DEMONSTRATED — the composition runs against a SECOND directory (identity mismatch with the owned root)
DEMONSTRATED — the old restart LOSES the durable record (recomposed against the wrong store)
DEMONSTRATED — a secret persisted in the ACTUAL store escapes the old leak scan (5 file(s) scanned under the WRONG root)
DEMONSTRATED — the ACTUAL store directory SURVIVES the old cleanup (untracked)
NEGATIVE CONTROL CONFIRMED: the starting tree's directory pattern exhibits all four consequences
```

The worktree and probe were then removed (`git worktree remove --force`;
`git worktree list` shows only the main checkout; no probe file or
`qlt-q6-nc-start` directory remains; probe-created temp stores were
swept).

**Disclosed incident (truthful):** `git worktree remove --force`
followed the `node_modules` JUNCTION inside the worktree and deleted the
main repository's installed dependency tree. No source, lockfile,
contract, or operator file was affected; the tree was restored with
`npm ci` (exact lockfile re-install, exit 0) and the full bounded
verification below was run AFTER the restoration. Lesson applied: the
negative-control worktree needed either a real install or junction-safe
removal.

## 6. Focused verification (permanent, offline; no provider, no credential)

New permanent suites `test/q6-live-workspace-lifecycle.test.ts`
(11 tests) prove, behaviorally:

- EXACTLY ONE disposable root is allocated per workspace (temp-dir
  delta = 1) and the live script itself allocates none;
- initial composition and restart receive the SAME canonical path (the
  explicit call pattern of the harness) and the identity assertion
  accepts both;
- a different resolved composition path fails closed (identity
  violation), as do a relative path, a missing `dataDir`, and a foreign
  `dataEnv`;
- success cleanup removes the root; failure-path cleanup (files present,
  proof failing) removes the root;
- nested files are included in the scan; a planted canary is detected
  (and an absent value scans clean);
- cleanup failure is REPORTED as failure (`removed: false` — the shape
  the harness maps to FAIL), for both a throwing remover and a no-op
  remover;
- repository paths, `.quellight-data`, and operator-data segments remain
  forbidden (specific refusal reasons; env builder and identity
  assertion included);
- the helper imports only node builtins and references no provider
  surface (so no provider call can occur in these suites).

`verify:q6` was strengthened with a permanent `live-workspace` section
(6 checks): the single-allocation structural proof (0 `mkdtempSync` in
the harness, 1 in the helper), the absence of the retired
`reuseDataDir`/`restartDataDir` pattern, the explicit two-call-site
ownership + pre-turn identity assertion, cleanup-failure-fails-closed,
the helper's node-builtin-only imports — AND the behavioral execution of
the lifecycle suites above, so this precise regression cannot return
unnoticed (not string-matching-only).

## 7. FastGate bounded verification (exact commands and exits)

```text
npm run format:check                                       EXIT=0
npm run typecheck                                          EXIT=0
npx vitest run (q6-live-workspace-lifecycle.test.ts)       EXIT=0  (11 passed)
npm run verify:q6                                          EXIT=0  (95 checks incl. 6 live-workspace)
npm run verify:stage7c                                     EXIT=0  (release identity stable)
git diff --check                                           EXIT=0
```

The full Q2–Q5/browser ladder was deliberately NOT repeated (bounded
harness correction). Additional proofs: `package.json` and
`package-lock.json` are byte-identical to the starting SHA (git diff
empty); the VICT release identity is unchanged (verify:stage7c
re-derives `vict-release-set@1/0.3.0`, content `v1_5f3a074a…`, from the
unchanged lockfile); NO product source or durable schema changed (the
whole fix is 4 script/test files: the harness, the strengthened gate,
the new script-only helper, the new suites); the operator
`.quellight-data` directory was never opened (mtimes unchanged,
metadata-only observation); NO live provider request occurred; no
temporary directories remain (worktree, probe, junction, and all
`qlt-*` stores swept).

## 8. Credential and live-execution accounting

- `OLLAMA_API_KEY` was NOT present in the environment at any point in
  this task (presence-only checks; the value was never printed,
  inspected, hashed, serialized, or written anywhere).
- `npm run verify:q6:live` was NOT invoked (the refusal probe was
  unnecessary — the refusal gates are byte-unchanged).
- **The authoritative live-provider execution count remains ZERO.** The
  frozen one-execution allowance is intact and the remediated harness
  stands ready for its single owner-invoked run after the offline
  gates.

## 9. Cleanup and remote state

All task-owned stores, the negative-control worktree, the probe file,
the junction, and every `qlt-*` temporary directory were removed and
verified absent. The Quellight remote was fetched before the push; the
push is a normal fast-forward; after it, `HEAD == origin/main`. VICT
remained read-only and untouched throughout.
