# Quellight Stage 07C Phase Q4 — H-1 Independent Re-Verification

> **Class:** Independent-audit record (fresh re-verification of the H-1
> remediation plus regression assurance, bounded to the remediated
> concurrency boundary). The auditor did NOT implement the remediation,
> authored all probes independently outside both repositories, modified no
> production code, permanent test, migration, contract, or verifier, and
> treats the remediation report strictly as claims to verify. No live
> provider was used; VICT was treated read-only (its released 0.2.0 turn /
> command-idempotency boundary only; its pre-existing untracked `.pi/` was
> never read or modified).

## 0. Verdict

```text
VERIFIED WITH NON-BLOCKING ISSUES — Q4 FORMAL CLOSURE PERMITTED
```

Finding counts: **0 Blocking · 0 High · 0 Medium · 2 Low · 2 Observations.**

The H-1 crossover is NOT reproducible on the remediated tree: the
independently authored negative control that reproduces all four facets of
the original defect against the ORIGINAL tree FAILS against the remediated
tree exactly where the fix must hold (the seam returns `pass/ambiguous`
where the old seam injected another turn's snapshot). Admission control is
race-safe for the supported single-process deployment and creates zero
effect for refused requests. VICT idempotency semantics are preserved
exactly. The seam-state matrix is complete and fails closed. Restart
reconciliation, failure truth, and the quiet refusal UX verify. The two
Low findings are bounded, disclosed, and carried with explicit
dispositions; executable remediation is NOT required.

## 1. Repository and audited identities

| Item                                   | Value                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quellight audited SHA (start = finish) | `6fd1ba894e63fa66b36694d5a193be95fd6b47f6` (`HEAD == origin/main` after fresh fetch; fetch advanced nothing; tree byte-clean at every probe point)                                                     |
| Original Q4 implementation tree        | `c4896befa64e7499b85cd751d2d4393482f2e7f0` (negative-control worktree; removed afterward)                                                                                                              |
| Original Q4 audit-report commit        | `821d4f80ae160200f262dacb49560f71c528dca0` (proven the true remediation-start: resolves, is an ancestor, adds exactly the Q4 verification report)                                                      |
| H-1 remediation contract commit        | `2b519d2c2734917ea065a0a0ba5e407502d5f49f` (alone; exactly one new file; direct child of `821d4f8…`)                                                                                                   |
| H-1 executable implementation commit   | `e9ac36a5aded9ba9af4412062b4a4c5667048b14` (6 files: `turn-admission.ts` new, `composition.ts`, turns route, `context-assembler.ts`, `ConversationWorkspace.svelte`, disclosed `verify-q4.mjs` re-pin) |
| H-1 permanent test commit              | `a49be653af9cdb89b03847a6449fee190b846af9` (exactly one new file, 852 lines)                                                                                                                           |
| VICT read-only SHA                     | `6e3e10d8114216d19c1d338494a6cafeb67ae6f9` (`HEAD == origin/main`; `git diff` clean; only pre-existing untracked `.pi/` present, untouched)                                                            |
| Conflicting closure / Q5+ work         | none on either remote (histories inspected after fresh fetch; nothing after `6fd1ba8…`; linear ancestry `821d4f8 → 2b519d2 → e9ac36a → a49be65 → … → 6fd1ba8` verified by `rev-parse` + parent chain)  |

## 2. Area 1 — history and evidence integrity

**Verified.** Independently proven, without relying on any report:

1. The remediation contract commit contains EXACTLY one new file (the
   contract, 173 lines) and descends directly from the audit-report
   commit — committed alone, before any executable change (§1 table).
2. The owner policy is frozen IN the contract commit (§1 binding owner
   decision: exactly one active agent turn per conversation; truthful
   refusal; VICT same-key idempotency preserved) and predates the
   executable commit `e9ac36a…` on the same linear chain.
3. The executable commit's file set is exactly the declared remediation
   boundary; the test commit adds exactly one file. No Q4 frozen semantic
   contract was rewritten (`QUELLIGHT-STAGE-07C-PHASE-Q4-CONTRACT-FREEZE.md`
   byte-identical from its freeze commit `b4bf759…` through HEAD; the
   remediation contract is a dated addendum narrowing §8 for exactly one
   finding, per the disclosed amendment procedure), and the original Q4
   audit report is byte-identical since `821d4f8…`.
4. The post-completion correction `6fd1ba8…` changed ONLY the malformed
   41-character remediation-start SHA (4 occurrences, corrected to
   `821d4f8…`), the documentary node-test count (216/205 → 205/194+11),
   and the mechanically re-derived inventory self-row and totals. The
   erratum is disclosed in the corrected report §15. A repository-wide
   search finds NO remaining 41-character SHA value; the correct start
   SHA appears exactly where declared.
5. The Git-derived remediation inventory is EXACT: the auditor's own
   `git diff --numstat 821d4f8…..6fd1ba8…` equals the report §9 block
   entry-by-entry (12 files) and the totals match (+1880, −51),
   including the report's self-row (374 insertions).
6. The node-test inventory is TRUTHFUL: the auditor's own
   `npx vitest list --config vitest.node.config.ts` counts exactly
   **205 tests across 14 files**, and the H-1 regression file contains
   exactly **11 tests** (194 pre-existing in 13 files). The remediation
   report's corrected §6/§15 counts are accurate.
7. Preservation: NO Quellight change touches VICT-related pins —
   `package.json` still pins exactly `@victframework/*@0.2.0`,
   `package-lock.json` unchanged by the remediation (zero remediation
   commits touch it), VICT working tree clean at `6e3e10d8…`, and the
   Quellight changed-file set between start and HEAD touches no manifest,
   lockfile, migration, or VICT-owned file.

**Audit-process disclosure (transparency; not a repository defect):** the
auditor's own first-ladder `npm ci` normalized 19 `"dev": true` markers in
`package-lock.json` (npm-version behavior on this machine, zero semantic
change). The file was restored byte-identically from git immediately after
detection; the tree was re-verified clean (`git status --porcelain` empty;
`git diff --check` clean) before the report commit.

## 3. Area 2 — the original defect independently reproduced

**H-1 reproduced against `c4896be…`.** In a detached temporary worktree at
the original implementation SHA (node_modules junction; `.svelte-kit`
generated types regenerated inside the worktree only; the audited tree
never modified), the auditor authored an independently designed negative
control (not a copy of the implementer's recorded probe): a REAL
composition with a REAL delayed offline model (records every prompt; holds
every stream open), the REAL per-turn context service wired exactly as the
audited composition wired it, REAL durable stores, one REAL dispatched
recorded open turn A (stream held open), and real-shaped record-less open
turn fixtures written directly through the durable turn store (the bypass
the backstop must survive). Four facets proven on the OLD code:

- **NC1 — in-flight promise borrowing:** with open turns A2 and B2 in one
  conversation, the old seam returned A2's REGISTERED in-flight assembly
  resolution for a SECOND stream in that scope (the old loop consults the
  in-flight map before any attribution reasoning and never examined B2).
- **NC2 — in-flight substitution:** in the classic mixed state (A
  recorded + B record-less), a stream that may be A's received B's
  FRESHLY assembled snapshot — containing BETA, a claim created only
  AFTER A froze — instead of A's own frozen block.
- **NC3 — false usage evidence:** a durable `complete` assembly record
  was written for B although no stream belonging to B ever received any
  injection (exactly ONE model call existed in the whole probe — A's).
- **NC4 — transparency corruption:** the thread's LATEST assembly record
  named B, so the transparency line would have credited a turn whose
  stream never saw any memory.

**Discriminating control:** the SAME probe file, pointed at the
remediated tree `6fd1ba8…`, FAILS at NC1 with
`expected 'pass' to be 'inject'` — the remediated seam returns
`pass/ambiguous` exactly where the old seam injected another turn's
snapshot. The negative control is therefore meaningful, and the fix is
demonstrated by the very staging that breaks the old code.

All worktrees, junctions, probe databases, scripts, and logs were removed
afterwards; the audited trees were never modified.

## 4. Area 3 — race-safe admission control (real ingress)

**Verified.** Independent probes drove the REAL turns route handler
(`POST`) against a REAL composition through the runtime seam (the only
bridge; everything beneath it is production code), with a deliberately
delayed offline model keeping the first turn genuinely open:

- **Eight simultaneous distinct-key POSTs to ONE conversation:** exactly
  ONE admitted turn and SEVEN `QLT_TURN_ALREADY_OPEN` refusals; the losers
  left NO command-idempotency receipt, NO turn intent, NO model call, NO
  context assembly, NO transcript message, and NO Shared World effect
  (claim counts unchanged; transcript contains only the admitted input).
- **Critical-section lifecycle:** six concurrent same-conversation
  admissions over the REAL guard produced `maxActive === 1` — dispatches
  never interleaved — while a DIFFERENT conversation's dispatch verifiably
  overlapped a held one (no global lock). The durable check+start pair is
  atomic for the supported single-process topology because the dispatch
  (which durably creates the intent) is awaited INSIDE the per-conversation
  promise-chain section before it releases; the permanent suite's real
  eight-way race additionally proves exactly one durable turn under true
  HTTP-level concurrency.
- **Different conversations remain concurrent** (own snapshots, own
  assembly records, distinct fingerprints — probe-verified).
- **A distinct request succeeds after the active turn becomes terminal**
  (probe-verified), and a failed dispatch does not poison the section:
  the dispatch rejection propagates truthfully and the next distinct
  request is admitted (probe-verified; the stored chain tail can never
  reject).
- **No queuing or parallel-reply machinery exists**: the remediation adds
  one promise-chain mutex and a bounded read of the durable turn store;
  the second message is never queued; the refusal returns a minimal
  `{ ok, code }` body (probe-verified: exactly those keys, no echo).
- **Settled-entry retention classified (audit question):** the
  per-conversation critical-section map retains ONE settled promise per
  DISTINCT conversation id for the process lifetime; the chain tail is
  replaced (never accumulated) per request. Measured: ≈349 B transient
  heap per request on ONE conversation (no accumulation), ≈102 B per
  distinct conversation entry, and repeated failing dispatches stay flat
  with the guard healthy afterwards. Classification: **Low (L-R1)** —
  bounded per entry and per conversation, unbounded ONLY in the lifetime
  conversation-count axis of one process; negligible at product scale;
  carried, NOT fixed during the audit.

## 5. Area 4 — idempotency preservation (real ingress)

**Verified.** The admission guard defers every same-key disposition to
VICT exactly as the remediation contract requires:

| Probe                                                                                    | Result                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same key + same payload WHILE active                                                     | replays the ORIGINAL turn identity; never a second turn; still exactly one open turn                                                                                                                                          |
| Same key + same payload AFTER settlement                                                 | replays the original turn identity again                                                                                                                                                                                      |
| Seeded PENDING receipt with a LIVE lease (crash-recovery shape)                          | truthful `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS`; no turn created                                                                                                                                                              |
| Same key + DIFFERENT payload                                                             | stable `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; no turn; no model call                                                                                                                                                            |
| Key bound to conversation A reused against conversation B (B has no open turn)           | guard passes through to VICT; digest conflict; B receives NO turn; B remains fully usable with a fresh key                                                                                                                    |
| Seeded FAILED receipt (stale failure)                                                    | deterministic failure replay; NO new overlapping turn                                                                                                                                                                         |
| Distinct keys                                                                            | distinct logical requests; the second is refused while the first is active and admitted as a NEW turn after settlement                                                                                                        |
| Client-controlled authority (`threadId`/`mastraThreadId`/`turnId`/`actorId` in the body) | ignored server-side: the turn binds to the SERVER-resolved conversation, the assembly record binds to the real thread, conversation B receives no turn, and the injected snapshot is assembled from the server-resolved scope |

The durable truthfulness of VICT's receipt lifecycle (claim / digest
conflict / live-lease in-progress / fenced settlement) was verified
directly against the released 0.2.0 boundary source.

## 6. Area 5 — model-seam defensive backstop (admission bypassed)

**Verified — the complete state matrix**, driven against REAL durable
stores with admission deliberately bypassed (real-shaped open-turn
fixtures written directly through the turn store — the corrupted-state
path the backstop must survive):

| Open-turn state (one conversation)                              | Required result                              | Probe result                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| zero open turns                                                 | safe pass-through, zero injection, no record | PASS (`pass/ambiguous`; no record written)                                                         |
| exactly one record-less turn                                    | assemble ONLY that turn                      | PASS (correct frozen block; durable record for THAT turn; replay byte-identical)                   |
| exactly one recorded turn                                       | replay ONLY that turn                        | PASS (byte-identical replay; post-freeze memory never crosses in)                                  |
| two record-less turns                                           | ambiguous, zero injection, no assembly       | PASS (no record for either)                                                                        |
| two recorded turns                                              | ambiguous, zero injection, no replay         | PASS                                                                                               |
| one recorded + one record-less                                  | ambiguous, zero injection, no assembly       | PASS (B gets no record; A's record untouched)                                                      |
| one in-flight promise + another open turn                       | ambiguous; never borrow the promise          | PASS (A's gated in-flight assembly is NOT returned; ambiguity; after A settles the matrix behaves) |
| three or more in any combination                                | ambiguous, zero injection                    | PASS                                                                                               |
| no "pick newest": record-less turn OLDER than the recorded turn | still ambiguous                              | PASS                                                                                               |
| two scopes interleaved concurrently                             | no cross-scope leakage                       | PASS (A injects A's own block; B passes; records bind to own threads)                              |
| junk scope fields (`turnId`, `actorId`, `forceInject`)          | ignored                                      | PASS (client/model-supplied values change nothing; assembly binds to the durable turn)             |

Additionally: no mutable global current-turn identity exists (attribution
reads the DURABLE turn store per call; `AsyncLocalStorage` carries only
the server-resolved conversation ids); no snapshot from one turn reached
another in any probe; NO falsely attributed `complete` assembly was
written in any ambiguous state; existing single-turn replay and
frozen-snapshot behavior remain intact (byte-identical replay,
post-freeze exclusion). Remediation boundedness: the `context-assembler`
diff between `c4896be…` and `e9ac36a…` touches ONLY the attribution block
of `resolveForStream` — selection, budgets, ordering, injection format,
transcript non-pollution, and agent authority are unchanged (verified by
diff scope + the aggregate ladder's Q1–Q4 gates).

## 7. Area 6 — restart and failure behavior

**Verified** over the REAL boot path (`reconcileAfterRestart`) and REAL
fencing:

- A durably open interrupted turn is settled TRUTHFULLY (failed/cancelled)
  by reconciliation; zero open turns remain.
- A stale executor settlement attempt on the reconciled terminal turn is
  REJECTED by the durable fence with the stable
  `VICT_CONTROL_TURN_INVALID_TRANSITION` code and the reconciled status is
  preserved (probe-verified).
- The one-active-turn rule applies again after restart: a new distinct
  request is admitted; while it is active, another distinct request is
  refused.
- A bypass-created ambiguous state (two open fixtures, admission
  bypassed) injects ZERO memory and writes nothing.
- Failure truth: a deliberately failing model call settles the turn
  `failed` immediately (probe-verified); the transcript carries no
  fabricated assistant content; the assembly record (if present) is
  truthful (complete/empty/failed only); the refusal/failure bodies carry
  stable codes only, with no echo of input; the conversation remains
  usable afterwards (a distinct request is admitted and completes).

## 8. Area 7 — user experience

**Verified** by an independent happy-dom component probe mounting the REAL
`ConversationWorkspace` island and driving the REAL `send()` path against
the REAL refusal code:

- The optimistic local message is WITHDRAWN (never rendered in the
  transcript list).
- The composer text is RESTORED to the draft.
- The quiet banner appears with `role="status"` and the exact truthful
  sentence "A reply is already in progress for this conversation." plus
  "Your message was not sent and nothing was queued."
- NO modal opens (`dialog` / `[role="dialog"]` absent); the memory tray
  stays closed (`section.qlt-memory` absent).
- Focus is NOT moved by the refusal (`document.activeElement` unchanged).
- The conversation remains usable (composer enabled; no failure state).
- Exactly ONE ingress request was made (nothing queued).
- The notice clears on a later thread transition (and on the next valid
  send, per the send path resetting it before dispatch — source-verified).

No additional permanent browser boot was added for this audit (per audit
scope); the aggregate ladder's existing real-browser checks (stop
regression negative control, ceremony recovery) ran green unchanged.

## 9. Area 8 — carried obligations (confirmed; NOT implemented)

- **M-1** (truthful VICT effect-class correction + Quellight repin):
  open, hard deadline unchanged — before the Phase Q6 live-provider proof
  and the Stage 07C final audit.
- **L-3** (correction-kind proposal confirmation rollback — duplicate
  source-thread link): carried as a Q5/backlog obligation only; dormant
  (production correction path is `applyCorrection`; the capability rejects
  correction proposals).
- **Pending-correction fixture limitation** and the **Q3
  correction-proposal deferral**: preserved.
- **Future turn steering**: recorded (`D-FUTURE-STEERING-1`) as a
  deferred product direction requiring a separate future contract
  (exact target-turn identity, append-vs-restart semantics, durable
  truth, idempotency, restart/reconnect, snapshot consequences, provider
  support, user-visible state). NOT implemented; no steering, queuing,
  parallel-reply, cancellation-redesign, or provider behavior exists.
- **Original Q4 observations O-1/O-2/O-3** and the audit's L-1/L-2
  documentary corrections: preserved/reconciled as recorded.

## 10. Authoritative verification ladder (first run; untouched tree)

Executed ONCE, by the auditor, on the untouched remediated tree
`6fd1ba8…` (HEAD == origin/main), before any probe:

| Command                    | First-run result                                                                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git fetch` (both repos)   | advanced nothing; `HEAD == origin/main` both sides                                                                                                                                                                                                                                                       |
| `npm ci`                   | exit 0 (see the §2 disclosure: post-run the lockfile was restored byte-identically)                                                                                                                                                                                                                      |
| `npm run verify:consumer`  | exit 0 PASS — exact-pin 0.2.0 consumption; 13-member content identity re-derived `v1_7a5579…`; unreachable-registry negative control held                                                                                                                                                                |
| `npm run verify:quellight` | exit 0 PASS — format; typecheck; governance; Q2; Q3; **Q4 (41 checks)**; node tests; UI tests; production build + closed-allowlist warning scan (1 warning); real-browser check; real-browser Stop regression; real-browser ceremony recovery; artifact scan (199 files); `git diff --check` — all green |
| `npm audit --omit=dev`     | exit 0 — **0 vulnerabilities**                                                                                                                                                                                                                                                                           |
| `git diff --check`         | exit 0                                                                                                                                                                                                                                                                                                   |

No rerun, timeout increase, output suppression, or assertion weakening.
The permanent H-1 suite runs inside `verify:quellight`'s node step; the
audit probes below are ADDITIONAL independent evidence, not duplicate
execution of the repository suite.

## 11. Independent probe summary (all authored outside both repositories; removed afterwards)

| Probe suite                                                                            | Tree                | Result                                                                                |
| -------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| H-1 negative control (NC1–NC4)                                                         | `c4896be…` worktree | **PASS — defect reproduced** (5.6 s)                                                  |
| Same negative control as discriminator                                                 | `6fd1ba8…`          | **FAIL as required** (`'pass'` where the old tree injected — the fix holds)           |
| Remediated node probes (seam matrix 11; admission 3; idempotency 8; restart/failure 2) | `6fd1ba8…`          | **24/24 PASS** (recorded run)                                                         |
| Admission critical-section lifecycle & retention                                       | `6fd1ba8…`          | **3/3 PASS** (≈349 B/request transient; ≈102 B per conversation entry; failures flat) |
| Quiet refusal UX (real island, happy-dom)                                              | `6fd1ba8…`          | **1/1 PASS**                                                                          |

All TypeScript probe files type-clean under `tsc --noEmit` with strict
settings. Probe development (harness sequencing fixes) preceded the
recorded runs above; the repository suite and its gates were never
modified at any point.

## 12. Findings

| ID   | Severity    | Finding                                                                                                                                                                                                                                                                                                                                             | Disposition                                                                                                                                                                     |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-R1 | Low         | The admission guard's per-conversation critical-section map retains one settled promise per DISTINCT conversation id for the process lifetime (tail replaced per request; no per-request growth). Measured ≈102 B/entry; unbounded only in the lifetime conversation-count axis of one process.                                                     | Carried with explicit disposition: bounded in practice at product scale; no correctness impact; any future eviction policy belongs to a Q5+ change. NOT fixed during the audit. |
| L-R2 | Low         | The `resolveForStream` pass-reason union retains `'no-open-turn'`, now unreachable: the remediated exactly-one rule returns `'ambiguous'` for the zero-open-turn case too (behavior identical: safe pass-through, zero injection).                                                                                                                  | Cosmetic vocabulary retention. May be cleaned in a future docs/tests pass; no behavior change; carried.                                                                         |
| O-R1 | Observation | The executor's post-turn pipeline issues additional in-process model calls (memory settle) after a turn's own stream completes; audit harnesses must drain before gating. Server-side only; no transcript, authority, or evidence impact.                                                                                                           | No action; recorded for future probe/verification authors.                                                                                                                      |
| O-R2 | Observation | The `verify:q4` inventory comparison re-pin (freeze→HEAD changed to freeze→Q4-audited-tree) was necessary because the audit-report commit itself legitimately adds files after the audited tree; the change strengthens nothing away, is disclosed in the remediation report §8, and the comparison is again exact (41 checks green in the ladder). | No action.                                                                                                                                                                      |

No Blocking or High finding exists; no Medium finding exists; idempotent
retries are intact; H-1 is not reproducible; admission is race-safe in the
supported topology; no executable remediation is required.

## 13. Closure recommendation

```text
FORMAL CLOSURE PERMITTED
```

The remediation is bounded, complete against the remediation contract's
state matrix and acceptance requirements, independently re-verified with
a reproduced negative control that discriminates old from new behavior,
and covered by permanent regression (11 tests, green in the aggregate).
The remaining Low findings and observations are carried with explicit
dispositions. Q4 may be formally closed with the standard reconciliation
(original implementation → audit/H-1 → owner decision → remediation →
evidence erratum → this re-verification → carried items → future steering
recorded-but-unimplemented → Q5 permitted-not-begun).

## 14. Preservation and cleanup

- Both repositories fetch-verified before every probe and push; never
  reset, rebased, or rewritten; the audited Quellight tree unmodified at
  every probe point (work tree clean; the one `npm ci` lockfile
  normalization restored byte-identically and disclosed); VICT read-only
  (untracked `.pi/` untouched).
- The negative-control worktree at `c4896be…` (including its junction and
  generated `.svelte-kit` types) was REMOVED after the discriminator run.
- All probe files, probe databases (temporary SQLite directories),
  configs, scripts, logs, and the probes-directory node_modules junction
  were removed after evidence capture. `git status --porcelain` is clean
  in both repositories at report time.

## 15. Audit-report commit identity

This report is committed to Quellight by normal fast-forward only (fresh
fetch immediately before commit/push). The audited executable tree is
unchanged by this commit (report file only). The exact audit-report
commit SHA is recorded in the completion response and remains the
re-verification record until closure.
