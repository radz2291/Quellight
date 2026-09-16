# Quellight Stage 07C Phase Q4 — H-1 Remediation (One Active Turn Per Conversation)

> **Class:** Remediation record (owner-directed executable remediation of
> audit finding H-1). This document does NOT verify Q4, does NOT close
> Q4, and does NOT begin Q5. VICT was treated read-only throughout.

## 0. Verdict

```text
Q4 H-1 REMEDIATED — AWAITING FRESH INDEPENDENT RE-VERIFICATION
```

Q4 is NOT called Verified and is NOT formally closed. Phase Q5 remains
NOT BEGUN. A fresh independent re-verification of the remediation is
required before any Q4 closure.

## 1. Repository identities

| Item                                                           | Value                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Remediation starting SHA                                       | `821d4f880ae160200f262dacb49560f71c528dca0` (`HEAD == origin/main`, fetch-verified; fetch advanced nothing)                           |
| Remediation-contract commit (alone, before executable changes) | `2b519d2…` (`docs(stage-07c): freeze the Q4 H-1 remediation contract`; exactly one new file)                                          |
| Implementation commit                                          | `e9ac36a…` (`fix(stage-07c): prevent overlapping-turn context crossover`)                                                             |
| Test commit                                                    | `a49be65…` (`test(stage-07c): lock overlapping-turn isolation`)                                                                       |
| Documentation commit                                           | this commit                                                                                                                           |
| Final remote SHA                                               | recorded in the completion response after the normal fast-forward push                                                                |
| VICT read-only SHA                                             | `6e3e10d8114216d19c1d338494a6cafeb67ae6f9` (`HEAD == origin/main`; pre-existing untracked `.pi/` untouched; ZERO VICT files modified) |
| Audited Q4 implementation tree                                 | `c4896befa64e7499b85cd751d2d4393482f2e7f0` (untouched; no historical report rewritten; the frozen Q4 contract byte-identical)         |
| Conflicting remediation / closure / Q5 work on either remote   | none (histories inspected after fresh fetch before every push)                                                                        |

## 2. The owner policy implemented (exact)

> Quellight permits exactly one active agent turn per conversation. A
> distinct request arriving while a reply remains active is rejected
> truthfully and creates no second turn. A retry of the same logical
> request preserves VICT's existing idempotent replay behavior.

Applies to the current single-process Quellight product scope. The second
message is not queued; parallel replies in one conversation do not occur;
different conversations may run concurrently. Recorded in the decision
register as D-Q4-H1-1.

## 3. H-1 negative-control reproduction (recorded; worktree removed)

H-1 was reproduced against the AUDITED implementation SHA `c4896bef…` in
an isolated temporary worktree (`git worktree add --detach`, node_modules
junction, `.svelte-kit/tsconfig.json` copied; the audited tree never
modified). The probe drove the REAL `resolveForStream` against the REAL
durable stores in the mixed state: one real, open, RECORDED turn (real
dispatch through the production scope; its assembly record existed; the
model stream genuinely held open) plus one record-less open turn (a
real-shaped open-turn fixture written directly through the VICT turns
store — the corrupted-state bypass the backstop must survive). Result:

```text
resolveForStream [a stream that may be turn A's]: inject turn-h1-fixture-b (the NEWER turn's snapshot)
resolveForStream [turn B stream]: pass/ambiguous
durable assembly record for fixture turn B: outcome=complete used=1
H-1 REPRODUCED
  - a stream that may be turn A's receives turn B's snapshot (in-flight substitution)
  - a durable assembly record claims complete for turn B although no B stream received any injection
```

Under the remediated code the same mixed state yields `pass/ambiguous`
for every stream, zero injection, and NO record for the record-less
turn (locked permanently by the regression suite). The worktree, its
junction, and all temporary directories were removed afterward.

## 4. Admission-control design and why check+start is race-safe

New module `src/lib/server/turn-admission.ts`, wired into the composition
and wrapped around the dispatch in the real turns route
(`src/routes/api/threads/[id]/turns/+server.ts`):

1. The route resolves the conversation link SERVER-SIDE, then calls
   `composition.admitTurn({ mastraThreadId, idempotencyKey }, dispatch)`.
2. `admitTurn` runs inside a PER-CONVERSATION critical section
   (a promise-chain mutex keyed by the server-resolved Mastra
   conversation id). Inside the section, in order:
   - a durable command-idempotency receipt for (actor, `agent.turn.start`,
     key) exists → the request IS a same-key retry: dispatch unchanged;
     VICT owns the truthful disposition (replay / in-progress / digest
     conflict);
   - otherwise the durable VICT turn store is read for open turns of
     this conversation and actor; any open turn → refuse
     `QLT_TURN_ALREADY_OPEN` BEFORE any effect;
   - otherwise dispatch — the dispatch durably creates the turn intent —
     and AWAIT it inside the section.
3. Race-safety: Quellight is ONE Node process (composition header,
   MSTR-012 declaration) and the admission decision is made only here.
   The section serializes check+start per conversation: a concurrent
   distinct-key request for the same conversation cannot interleave
   between the "is a turn open?" read and the durable turn creation,
   because the creation happens inside the section before it releases.
   The naïve unprotected "list then start" race (two requests passing the
   check simultaneously) is therefore impossible in the supported
   single-process deployment. The model-seam backstop (§6) additionally
   fails closed if the invariant is ever bypassed through a direct
   internal call, test fixture, future route, or corrupted state. No
   generic orchestration or queuing framework was added; no multi-process
   or cloud correctness is claimed.

Distinct-key race semantics (proven by the real-ingress tests): for two
simultaneous distinct keys against one conversation, exactly one creates
a durable turn; the other receives `QLT_TURN_ALREADY_OPEN`; only one
model execution, one assembly, and one accepted transcript input occur;
the refused request creates NO VICT intent, no idempotency receipt, no
model call, no assembly, no transcript message, and no Shared World
effect (deep zero-effect audit in the suite).

Same-key versus distinct-key behavior (exact):

| Case                                                                        | Behavior                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Same key + same payload, turn active                                        | Pass-through; VICT replays the original turn identity (receipt settled at dispatch resolution); never a second turn |
| Same key + same payload, settled                                            | Pass-through; VICT replays the original turn identity                                                               |
| Same key + same payload, receipt pending with a live lease (crash recovery) | Pass-through; VICT retains its truthful `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` disposition                          |
| Same key + different payload                                                | Pass-through; VICT returns the stable `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; no turn                                  |
| Distinct key while a turn is open                                           | Refused `QLT_TURN_ALREADY_OPEN`; zero effect                                                                        |
| Distinct key, no open turn                                                  | Admitted normally                                                                                                   |
| Distinct key, first turn terminal                                           | Admitted normally                                                                                                   |

The refusal is surfaced quietly in the workspace: a quiet `role="status"`
banner ("A reply is already in progress for this conversation. Your
message was not sent and nothing was queued.") and a polite
aria-live announcement; the optimistic local message is withdrawn (it
never reached the durable transcript), the composer is restored, and the
resting connection state is kept. No modal, no tray opening, no focus
change.

## 5. Model-seam mixed-state behavior (backstop)

`resolveForStream` (in `src/lib/sharedworld/context-assembler.ts`) now
attributes a snapshot only when EXACTLY ONE attributable open turn
exists for the conversation and actor (durable turn store; server-derived
only):

- exactly one open record-less turn → assembles it (unchanged);
- exactly one open recorded turn → replays its own frozen record
  (unchanged);
- zero attributable open turns → existing safe pass-through (unchanged,
  same `ambiguous` pass reason as the audited behavior);
- two or more open turns in ANY recorded/unrecorded/in-flight combination
  → `ambiguous` for EVERY stream in the scope: zero injection, no
  per-turn in-flight promise is consulted (a promise belonging to one
  turn is never returned for another turn's stream), and NO new assembly
  is created (writing one would be a false attribution).

No "pick newest", no timestamp guessing, no mutable global current-turn
variable, no client/model-supplied turn identity. The frozen Q4
selection, budgets, ordering, authority, and injection format are
unchanged; the ONLY behavioral change is that ambiguous states no longer
assemble a record-less turn when other open turns exist.

## 6. Concurrency and zero-effect evidence

Permanent suite `test/turn-overlap-isolation.test.ts` (11 tests, node
side; real stores, real route handler, real admission boundary, real
VICT command boundary; a deliberately delayed offline model keeps the
first turn genuinely open for the real race):

1. mixed state (one recorded + one record-less open turn) — zero
   injection for every stream, no promise borrowing, no new assembly,
   turn A's frozen record unchanged, transparency stays A's own record;
2. in-flight older turn never lends its resolution to a newer
   record-less turn (gated in-flight assembly); after the older turn
   settles, the single record-less turn assembles;
3. two record-less open turns and two recorded open turns — fail closed,
   zero injection, zero new records;
4. exactly one record-less turn still assembles, and exactly one
   recorded turn still replays its identical frozen block; zero open
   turns pass through;
5. two simultaneous distinct-key POSTs to the REAL turns ingress —
   exactly one durable turn, one refusal, one model execution, one
   assembly, only the accepted input in the transcript;
6. same-key replay during AND after an active turn — original turn
   identity, never a second turn;
7. same-key conflicting payload — `VICT_COMMAND_IDEMPOTENCY_CONFLICT`,
   no turn;
8. a new distinct request after the first turn becomes terminal —
   admitted, new turn;
9. concurrent turns in DIFFERENT conversations — both admitted, each
   with its own snapshot and its own assembly record (distinct
   fingerprints);
10. deep zero-effect audit of a refused request under the real race —
    no receipt, no second transcript message (transcript snapshot
    equality while open and after completion), no Shared World effect,
    one model execution;
11. restart reconciliation (the REAL boot path `reconcileAfterRestart`)
    settles the interrupted turn truthfully (fenced: the later executor
    settlement cannot overwrite it), zero open turns remain, a distinct
    request is admitted, and the rule holds while the new turn is
    active.

Full node suite: 216 tests green (14 files; 205 pre-existing tests were
green before the remediation with 194 tests in 13 files — none weakened;
the new file adds 11).

## 7. Verification (FastGate; focused during development)

Focused checks during development: the new suite, `test:node`,
`test:ui`, `typecheck`, `format:check`, `verify:governance`,
`verify:q2`, `verify:q3`, `verify:q4` — all green before the docs
freeze. No full aggregate rehearsal was run during development.

After the documentation freeze, ONE authoritative sequence ran on the
frozen final tree:

```text
npm ci
npm run verify:consumer
npm run verify:quellight
npm audit --omit=dev
git diff --check
```

First-run results are recorded in §11 (recorded after the run by the
disclosed docs-only completion commit; see the identity note there).
`verify:quellight` permanently includes the new H-1 regression coverage
through the node-side test step (`test/**/*.test.ts` includes
`test/turn-overlap-isolation.test.ts`) — NO duplicate browser boot and
no aggregate-lane change was needed.

## 8. Disclosed verifier reconciliation

`verify:q4`'s L-3 inventory comparison (`git diff --numstat freeze..HEAD`
vs the Q4 report inventory) had ALREADY been broken by the independent-
verification report commit itself (the 27th file after the audited tree;
the check was red at the remediation starting SHA `821d4f8…` before any
remediation work). The remediation re-anchored the comparison from HEAD
to the Q4 AUDITED TREE (the parent of the verification-report commit) —
a bounded, disclosed re-pin inside `scripts/verify-q4.mjs` that
strengthens nothing away and weakens nothing: the Q4 report and its
inventory are unmodified, and the comparison is again exact (41 checks
green). No other verifier changed.

## 9. Changed-file inventory (Git-derived)

FREEZE-SHA (remediation start): `821d4f880ae160200f262dacb49560f71c528dca0`

```text
49 3 README.md
73 0 docs/decision-register.md
173 0 docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION-CONTRACT.md
340 0 docs/report/QUELLIGHT-STAGE-07C-PHASE-Q4-H1-REMEDIATION.md
67 4 docs/system-reference.md
22 2 scripts/verify-q4.mjs
24 0 src/lib/islands/ConversationWorkspace.svelte
30 0 src/lib/server/composition.ts
153 0 src/lib/server/turn-admission.ts
30 33 src/lib/sharedworld/context-assembler.ts
35 9 src/routes/api/threads/[id]/turns/+server.ts
852 0 test/turn-overlap-isolation.test.ts
```

TOTALS: 12 files, +1848, −51. Derived from `git diff --numstat
821d4f880ae160200f262dacb49560f71c528dca0..HEAD` (Git only; the report's
own self-row is the file's exact insertion count). Not verifier-compared
(no verifier consumes the remediation report inventory; the Q4 report's
inventory comparison remains anchored to the Q4 audited tree per §8).

## 10. Other audit findings — dispositions

- **L-1 (duplicated Q3 status line):** corrected additively in this
  documentation pass (README.md and docs/system-reference.md status
  blocks). No historical report rewritten.
- **L-2 (implementation-identity lag):** reconciled additively: the Q4
  audited implementation tree is `c4896bef…`; executable content was
  unchanged since `bf7fec3`; the audit-report commit is `821d4f8…`. The
  ladder below is executed on the frozen remediation tree and its
  results are recorded by the disclosed docs-only completion commit —
  the exact run-tree SHA and the final-tree SHA are both named in the
  completion response so no silent identity lag recurs.
- **L-3 (correction-kind proposal confirmation rollback):** recorded as
  a Q5/backlog obligation ONLY (see D-Q4-H1-1 in the decision register):
  confirming a `correction`-kind proposal through `confirmProposal`
  currently always fails `QLT_RECORD_EXISTS` because
  `applyCorrectionInTransaction` already writes the successor's
  source-thread link and the confirmation loop writes it again, rolling
  the transaction back; the active production correction path remains
  `applyCorrection`; the capability rejects correction proposals. NOT
  repaired in this task.
- **O-1, O-2, O-3:** preserved as observations (untouched).
- **Pending-correction fixture limitation:** preserved (the seeded
  pending-correction proposal remains a script fixture; production wires
  no pending-correction path).
- **Q3 correction-proposal deferral:** preserved (the pinned capability
  still rejects `proposalKind: 'correction'`).
- **M-1:** unchanged and openly tracked with its hard deadline: the
  truthful noncanonical/proposal VICT effect-class correction and the
  Quellight repin must complete BEFORE the Phase Q6 live-provider proof
  and therefore before the Stage 07C final audit.

## 11. Authoritative ladder (first run; frozen tree)

| Command                    | Result (first run)                  |
| -------------------------- | ----------------------------------- |
| `npm ci`                   | recorded in the completion response |
| `npm run verify:consumer`  | recorded in the completion response |
| `npm run verify:quellight` | recorded in the completion response |
| `npm audit --omit=dev`     | recorded in the completion response |
| `git diff --check`         | recorded in the completion response |

No rerun, no timeout increase, no output suppression, no weakened
assertion is permitted; any permitted rerun must name its cause and
disclose both results.

## 12. Future steering direction — recorded, NOT implemented

Recorded in the decision register (D-FUTURE-STEERING-1) as a deferred
product direction: steering an answer while it is being generated must
be an explicit operation targeting the exact active turn — never a
second overlapping turn — and requires a separate future contract
covering exact target-turn identity, append-guidance versus
cancel-and-restart semantics, durable event and transcript truth,
idempotency, restart/reconnect behavior, context-snapshot consequences,
provider support, and user-visible state. This remediation implements no
steering, no queuing, no parallel replies, no cancellation redesign, and
no provider behavior.

## 13. Scope protections honored

No Q5 work; no steering or queuing; no live provider; no VICT code,
package, test, release-identity, or System Reference change (VICT
byte-unchanged at `6e3e10d…`); no package pin or `package-lock.json`
change; no historical implementation or audit report rewritten; the
frozen Q4 contract byte-identical (remediation contract is a dated
addendum, committed alone); no multi-process or cloud correctness claim;
Shared World selection, budgets, ordering, authority, and injection
format unchanged except the H-1-necessary attribution behavior in §5;
unrelated and untracked material untouched.

## 14. Preservation and cleanup

Both repositories fetch-verified before every push; normal fast-forward
pushes only; never reset, rebased, or force-pushed. The H-1 reproduction
worktree, its junction, and all temporary files/databases were removed;
`git status --porcelain` is clean at report time. Untracked material
outside the repositories (including VICT's pre-existing `.pi/`) was
never read or modified.
