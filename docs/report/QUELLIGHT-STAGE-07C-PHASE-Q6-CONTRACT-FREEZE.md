# Quellight Stage 07C — Phase Q6 Contract Freeze (deterministic final verification and the bounded live-provider Shared World ceremony proof)

**Status:** FROZEN — committed alone before any executable Q6 change.
**Date:** 2026-09-22.
**Freeze commit:** recorded in
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-IMPLEMENTATION.md` (§1).
**Governing inputs (read before this freeze):** the Stage 07C handoff
(VICT `docs/handoff/VICT-STAGE-07C-QUELLIGHT-SHARED-WORLD-MEANING-AND-CEREMONY-HANDOFF.md`,
§7, §8, §14, §15, §19 — the ratified OQ6 authority model); the Quellight
System Reference and decision register (D-Q4-1…6, D-Q4-H1-1, D-Q5-1,
D-Q-M1-1/D-Q-M1-2); the frozen Q3/Q4/Q5 contracts and their reports; the
M-1 stable-repin record. **Current starting identity:** VICT
`vict-release-set@1/0.3.0` (content ID
`v1_5f3a074a50ab5623acbf933d52a24e6d383ded2ccd02bbaa78a28c3be3915580`),
Quellight exact-pinned to `@victframework/*@0.3.0`; VICT-M-1
independently verified and formally closed; Q1–Q5 formally closed.

Q6 is the final Stage 07C implementation/evidence phase. It is
**verification hardening, not product scope**: it must prove that the
already-implemented Shared World system works deterministically through
restart, browser, and ONE tightly bounded real-provider ceremony. Q6
adds NO new product capability, NO new action, NO new migration, NO new
agent authority, and NO schema change. Every assertion below is enforced
by gates and suites that are permanent.

---

## 1. What Q6 must prove (the required proof)

Using the real Quellight ingress, the released VICT `0.3.0` packages, the
real Mastra bridge, the real provider, the governed ceremony, and
disposable data:

1. A user statement causes the real model to draft a bounded pending
   proposal through `qlt.proposal.draft@2`.
2. The durable invocation records it truthfully as `write` (effect
   `write`, `approvalRequired=false`, disposition
   `host-policy-write-without-separate-approval`, policy identity
   `vict-effect-policy@1`; zero approval rows, zero approver identities,
   zero awaiting-approval events).
3. The host quiet-write policy permits proposal drafting without a
   separate generic approval interruption (the exact one-entry
   `qlt.host-policy.quiet-write@1` composition policy; unchanged).
4. The proposal remains epistemically inert: never canonical, never
   model-visible through assembly, never durable truth by itself.
5. An explicit real-user confirmation through the governed ceremony
   (`/api/act` shape → released `app.data.mutate` boundary → memory
   surface) creates EXACTLY ONE canonical Shared World record.
6. Retry/idempotency produces no duplicate record and no duplicated
   effect (same-key confirmation replays; the proposal store key
   converges).
7. Restart preserves the confirmed record and its lineage.
8. A genuinely fresh conversation with NO transcript dependency receives
   the confirmed meaning through its per-turn `C1` context snapshot
   (per-turn assembly record with the confirmed record selected; the
   fresh conversation's durable transcript contains zero context-block
   bytes).
9. A conflicting or relevant later statement demonstrates that the
   standing record is available to the model without silently changing
   it (the canonical record's identity, version, and content bytes are
   unchanged; any model opinion remains a draftable proposal at most).
10. No model response can directly confirm, reject, amend, withdraw,
    correct, or otherwise exercise user authority (structural: the
    capability envelope contains exactly one draft verb; the store
    refuses agent decision identities; the ceremony requires the
    user-attributed governed boundary).

The principal success path uses the minimum viable Stage 07C example
already named in the architecture, sent as a real user turn:

```text
I will not leave my current job without a clear pathway and established base.
```

The principal success path is NEVER seeded directly into SQLite and
never bypasses the model/tool bridge: the proposal must be created by
the real model through `qlt.proposal.draft@2`, and the canonical record
must be created only by the explicit user confirmation through the
governed ceremony.

## 2. Exact provider/profile identity (frozen; unchanged from D-1/M-1)

```text
Provider:                     Ollama Cloud
Model:                        glm-5.3-flash
Router identity:              ollama-cloud/glm-5.3-flash
Endpoint:                     https://ollama.com/v1
Credential env var (NAME):    OLLAMA_API_KEY
Activation gate:              QUELLIGHT_LIVE_PROOF=1
Agent profile:                agent.quellight.conversation@4 (UNCHANGED)
Capability envelope:          exactly qlt.proposal.draft@2 / write (UNCHANGED)
Host quiet-write policy:      qlt.host-policy.quiet-write@1, one entry (UNCHANGED)
Action inventory:             exactly 21 declared actions (UNCHANGED)
Memory Mode default:          across-conversations (UNCHANGED)
```

No provider rotation, no fallback, no alternative model, no second
profile. The credential VALUE is never printed, inspected, serialized,
persisted, copied, hashed, or included in any report or artifact; only
its PRESENCE in the process environment is checked.

## 3. Live-proof bounds (frozen; N-C24)

The live ceremony is bounded to:

- **≤ 6 provider turns** total (the frozen plan uses at most 4; the
  actual count is recorded truthfully);
- **≤ 256 output tokens per turn** (`QUELLIGHT_MAX_OUTPUT_TOKENS=256`);
- **≤ 120 s deadline per provider turn** (`QUELLIGHT_TURN_DEADLINE_MS=120000`,
  the composition default);
- **exactly ONE authoritative execution** — process discipline: the
  operator runs the live gate exactly once for this phase; a failed or
  blocked run is reported truthfully and is NEVER silently re-run
  (a fresh owner-authorized execution requires a dated amendment);
- **ZERO automatic provider retries** (`maxRetries: 0` is pinned in the
  profile; the harness re-dispatches no failed turn);
- **no alternative model or fallback provider.**

A provider 429, 5xx, timeout, malformed response, or refusal produces a
truthful FAILED proof (exit non-zero with the observed stable code and
turn metadata only). It is never silently rerun and never weakened.

## 4. Offline acceptance requirements (permanent gates)

New permanent offline gates (wired without changing any existing gate):

```text
npm run verify:q6        # focused deterministic Q6 gate
npm run verify:stage7c   # the Stage 07C aggregate gate (N-C25)
npm run verify:q6:live   # the bounded live ceremony (gated; NEVER automatic)
```

- `verify:q6` proves the frozen Q6 offline assertions (§6 controls) and
  embeds the recorded release identity literals.
- `verify:stage7c` composes N-C1..N-C25 coverage: it executes the
  existing focused Q2–Q5 gates plus `verify:q6`, validates the
  N-C↔constituent coverage manifest, and proves by negative control
  that the aggregate fails if any constituent is absent, stale, or
  bypassed. It runs NO large suite twice in one authoritative sequence:
  the expensive complete suites (`test:node`, `test:ui`, the production
  build, the three real-browser checks) execute exactly once, inside
  `verify:quellight`; the focused gates are the only constituents
  `verify:stage7c` re-executes.
- `verify:stage7c` must FAIL if any constituent phase is absent
  (missing script/suite), stale (a recorded-identity literal mismatch),
  or bypassed (structural containment scan fails).
- The Stage 07B live-provider verifier (`verify:live-provider`) and its
  evidence are preserved unchanged.
- The live gate `verify:q6:live` is NEVER invoked by `npm test`,
  `verify:quellight`, `verify:stage7c`, CI configuration, or any other
  script chain; this is structurally asserted in `verify:q6`.
- `verify:stage7c` preserves the exact VICT `0.3.0` release identity and
  the registry-only consumer proof (it composes the consumer gate
  constants; the authoritative sequence runs `verify:consumer` before
  it).

### 4.1 Authoritative verification order (offline; before the live proof)

```text
npm ci
npm run verify:consumer
npm run verify:quellight
npm run verify:stage7c
npm audit --omit=dev
git diff --check
```

The scripts are arranged so this sequence does not run the same complete
suite twice: the large suites run inside `verify:quellight`;
`verify:stage7c` runs the focused Q-phase gates, its manifest, and its
negative control only.

## 5. Durable-state, authority, restart, transcript, credential, and cleanup assertions (frozen)

- **Durable state.** The proposal row (`proposed`, epistemically inert),
  the durable invocation record (truthful `write` evidence), exactly one
  canonical record after confirmation, the correction/source lineage,
  and the per-turn assembly records (including the fresh conversation's
  `complete` assembly with the confirmed record selected) are all
  asserted from durable rows on disposable stores.
- **Authority.** The model can only draft. The confirmation crosses the
  governed ceremony with the server-derived local user identity; an
  agent-attributed decision identity fails closed
  (`QLT_CONFIRMER_INVALID`); no ceremony verb exists on the capability
  surface; the action inventory stays 21.
- **Restart.** A real composition close/reopen on the same disposable
  data directory preserves the confirmed record, its lineage, and the
  assembly evidence; reconcileAfterRestart runs truthfully.
- **Transcript.** The generated context block is call-scoped only: the
  durable transcript (Mastra bytes and restored messages) contains ZERO
  occurrences of the frozen block markers
  (`<<<QLT:SHARED-WORLD-CONTEXT:V1>>>` / `…END>>>`) and zero injected
  message rows.
- **Credential.** Presence-only checks; a byte-level leak scan over the
  disposable data directory, ledger frames, and the serialized operator
  configuration must find zero occurrences of the credential value. The
  scan runs on success AND on deliberate failure paths.
- **Cleanup.** All task data lives in disposable OS-temporary
  directories OUTSIDE the repository and outside `.quellight-data`
  (the `QUELLIGHT_DATA_DIR_ABSOLUTE` seam or a temp-anchored relative
  dir for spawned servers whose cwd is the temp directory). Cleanup is
  verified on success and deliberate failure. The operator
  `.quellight-data` directory is never opened, read, migrated, hashed,
  or modified by any Q6 gate (fail-closed seam + structural scan).

## 6. Hostile-memory and injection containment (structural; N-Q6-7 family)

At least one confirmed record contains adversarial instructions and
forged authority markers. The proven claims are STRUCTURAL:

- hostile memory stays escaped and bounded as quoted DATA inside the
  context block (the delimiter-safe serializer makes `<`, `>`, `&`, and
  `/` unrepresentable inside record content; markers cannot be forged);
- it cannot add tools or capabilities (the envelope resolves exactly one
  capability; the plan inventory stays 21; `bindings.capabilities` stays
  empty);
- it cannot forge actor, thread, turn, project, or authority identity
  (all correlation is server-derived from durable records; the client,
  the model, and record content supply no identity);
- it cannot confirm itself (the capability exposes no ceremony verb; the
  store refuses agent decision identities; the ceremony requires the
  user-attributed governed boundary);
- it cannot create a canonical record without explicit user action
  (N-C9/N-C10 controls);
- it cannot bypass the VICT host policy (the policy is supplied only
  through the trusted composition-dependency channel; capability
  metadata cannot exempt itself; `irreversible` targets can never be
  exempted);
- it cannot leak the provider credential (presence-only resolution;
  byte-level scans);
- it cannot pollute the durable transcript with the generated context
  block (zero transcript pollution proofs, node and browser level).

**Non-claim (explicit):** Q6 does NOT claim that arbitrary remembered
text can never influence model wording. Exact natural-language phrasing
is nondeterministic. Acceptance is based on authority, durable effects,
identity, policy, provenance, bounded context, and zero unauthorized
mutation — never on a brittle exact-response assertion.

## 7. Concurrency/correlation state matrix (frozen for Q6)

The H-1 binding rule stands unchanged (D-Q4-H1-1): exactly one active
agent turn per conversation. The Q6 live ceremony runs its provider
turns strictly SEQUENTIALLY in each conversation (each turn reaches a
terminal state before the next send); no overlapping turn is created.
The full seam-state matrix (zero / one / ≥2 open turns, recorded and
in-flight mixtures, all fail closed with zero injection) remains
permanently enforced by `test/turn-overlap-isolation.test.ts` and the
Q4 gate; the aggregate includes it. Different conversations may run
concurrently (offline coverage unchanged). The live harness additionally
asserts, per turn, that exactly one assembly record exists for the turn
(UNIQUE turn_id) and that the fresh conversation's assembly selected the
confirmed record — i.e., correlation is per-conversation, never
cross-thread.

## 8. Negative controls and fail-closed behavior (frozen set)

Offline (permanent): N-C1–N-C23 as mapped in §10, plus the Q6 controls:
capability-envelope invariance, live-gate refusal structure, absence of
any automatic live invocation, transcript zero-pollution, hostile-memory
containment, fresh-thread `C1` recovery, conflict non-mutation,
credential-value absence, cleanup-on-failure, operator-data isolation,
and the aggregate negative control (missing constituent → red).

Live (N-C24): the bounded ceremony itself; provider failure classes
(429/5xx/timeout/malformed) settle truthfully as a failed proof; a
missing credential BLOCKS the live proof truthfully (exit 2) with the
offline implementation still landing; the offline gates never require
the credential.

## 9. Browser and fresh-thread recovery evidence (frozen)

Extend the EXISTING real-browser ceremony session (no additional browser
boots) with a Q6 fresh-conversation continuity scenario: after the
confirmed record exists, a genuinely NEW conversation receives its
per-turn context (the quiet transparency line truthfully reports
memory used), while the conversation flow stays uninterrupted (no modal,
no focus theft, composer enabled, tray closed). The session continues to
prove: explicit proposal and confirmation, hard-reload/restart
persistence, truthful Memory-used/unavailable states, zero serious or
critical accessibility issues (axe, both viewports, tray open), and ZERO
unexpected console warnings or errors. Full-process restart persistence
is proven at the composition level (§5) and by the existing restart
suites.

## 10. N-C coverage manifest (N-C1..N-C25; frozen mapping)

| N-C   | Constituent that proves it (permanent)                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-C1  | `test/composition.test.ts` canary controls (+ `verify:quellight` step 7 artifact scan)                                                                        |
| N-C2  | `scripts/verify-consumer.mjs` registry-only install + unreachable-registry negative control                                                                   |
| N-C3  | historical F-8 baseline (VICT Phase F record; consumer gate fail-closed shape `QLT_APPDATA_MUTATION_PAYLOAD_UNSUPPORTED` in `test/governed-mutation.test.ts`) |
| N-C4  | released-boundary input fences (`test/governed-mutation.test.ts`; Q2 closed validators in `test/meaning-foundation.test.ts`)                                  |
| N-C5  | contract mismatch (`VICT_APPDATA_INPUT_CONTRACT_REJECTED`; `test/governed-mutation.test.ts`)                                                                  |
| N-C6  | plan identity / stale revision refusal (`test/governed-mutation.test.ts`)                                                                                     |
| N-C7  | unregistered capability kind → `VICT_APPDATA_ACTION_UNAVAILABLE` (`test/governed-mutation.test.ts`)                                                           |
| N-C8  | agent self-confirmation denial (`test/ceremony-authority.test.ts`, `test/q6-ceremony-authority.test.ts`)                                                      |
| N-C9  | confirmation without user action (`test/ceremony-authority.test.ts`; `verify:q3`)                                                                             |
| N-C10 | unconfirmed-context exclusion (`test/context-assembly.test.ts`; `verify:q4`)                                                                                  |
| N-C11 | superseded-context exclusion (`test/context-assembly.test.ts`; `verify:q4`)                                                                                   |
| N-C12 | confirmation replay/idempotency (`test/ceremony-authority.test.ts`; `verify:q3`)                                                                              |
| N-C13 | crash before confirmation (`test/ceremony-authority.test.ts`, `test/restart.test.ts`)                                                                         |
| N-C14 | crash during confirm commit (fault-injected transaction boundary; `test/ceremony-authority.test.ts`)                                                          |
| N-C15 | crash after commit before response (`test/ceremony-authority.test.ts`, `test/reconnect.test.ts`)                                                              |
| N-C16 | stale proposal refusal (version-eligibility; `verify:q3`, browser L-2 scenario)                                                                               |
| N-C17 | correction conflict (one successor; `verify:q2`, `verify:q5`)                                                                                                 |
| N-C18 | duplicate correction replay (`verify:q2`, `verify:q5`)                                                                                                        |
| N-C19 | transcript-only recovery from `C1` (`test/context-injection.test.ts`; `verify:q4`; Q6 fresh-thread suite)                                                     |
| N-C20 | direct-route database-write prohibition (`verify:q2`/`q5` structure sections; `verify:governance`)                                                            |
| N-C21 | identity mismatch refusal (`test/memory-authority.test.ts`, `test/governed-mutation.test.ts`)                                                                 |
| N-C22 | empty-registry/local-checkout negative control (`scripts/verify-consumer.mjs`)                                                                                |
| N-C23 | responsive browser + accessibility proof (`scripts/browser-check.mjs`, `scripts/browser-ceremony-check.mjs` axe viewports)                                    |
| N-C24 | `scripts/verify-q6-live.mjs` — the bounded live ceremony (LIVE; last; exactly once)                                                                           |
| N-C25 | `scripts/verify-stage7c.mjs` — this aggregate (manifest + focused gates + negative control)                                                                   |

`verify:stage7c` validates this manifest structurally (every mapped
constituent exists and is wired) and proves by negative control that a
manifest with a missing constituent fails the aggregate.

## 11. Q6 offline control numbering (N-Q6-x; frozen)

| #       | Control                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| N-Q6-1  | frozen contract data: live bounds (6/256/120000/once/zero-retries/no-fallback), provider identity, activation gate         |
| N-Q6-2  | envelope invariance: `qlt.proposal.draft@2`/`write`, one-entry quiet-write policy, 21 actions, empty capability bindings   |
| N-Q6-3  | live-gate refusal structure (exit 2 without the gate env or the credential name; never automatic)                          |
| N-Q6-4  | durable invocation truth: effect `write`, host-policy disposition, zero approval rows/events; proposal epistemically inert |
| N-Q6-5  | fresh-thread `C1` recovery: confirmed record assembled into a genuinely fresh conversation; zero transcript pollution      |
| N-Q6-6  | conflict statement leaves the standing record unchanged; the record stays available to assembly                            |
| N-Q6-7  | hostile-memory structural containment (§6)                                                                                 |
| N-Q6-8  | restart preserves confirmed record + lineage + assembly evidence                                                           |
| N-Q6-9  | credential discipline: presence-only; value absent from all disposable persisted bytes/frames                              |
| N-Q6-10 | aggregate manifest coverage + missing-constituent negative control                                                         |

## 12. Lane ownership (frozen)

- **Lane A** — offline Q6 + Stage 07C aggregate gates (`verify:q6`,
  `verify:stage7c`, package wiring; manifest).
- **Lane B** — the bounded live ceremony harness (`verify:q6:live`) and
  credential containment.
- **Lane C** — hostile-memory authority and injection-containment probes
  (`test/q6-ceremony-authority.test.ts`).
- **Lane D** — browser/restart/fresh-conversation evidence (extension of
  `scripts/browser-ceremony-check.mjs`) and the fresh-thread offline
  suite (`test/q6-fresh-thread-continuity.test.ts`).
- **Lane E** — final integration, Git-derived inventory, documentation,
  and the implementation report.

All lanes start from this freeze commit (or an explicit amendment
commit). Lane ownership is recorded truthfully in the implementation
report; no coordinator abstraction is committed. `package.json` script
wiring is owned by Lane A (all three new script entries are added there;
Lane B's commit adds the harness file and its documentation).

## 13. Amendment procedure (frozen)

If any frozen statement proves wrong: STOP the consuming lane, make a
standalone dated amendment commit
(`docs(stage-07c): amend the Phase Q6 contract — <reason>`) that changes
ONLY this document (plus, if needed, the frozen declarative module
`src/lib/sharedworld/q6-contract.ts`), and restart every affected lane
from the amendment. Amendments are NEVER bundled with implementation
(Q3 M-3 discipline).

## 14. Status language and stop conditions (frozen)

- On success: Q6 is recorded as `IMPLEMENTED — AWAITING INDEPENDENT Q7
VERIFICATION`. Q6 is NEVER described as independently verified or
  formally closed; that belongs to the fresh Phase Q7 independent audit.
- If the credential is absent, the offline implementation lands and the
  report states truthfully that the live proof is BLOCKED; the
  completion marker is not used and Q7 remains blocked for the live
  portion.
- Stop and request an owner decision when: a required proof point cannot
  be met without widening beyond this freeze (new capability, new
  action, migration, policy change, or provider change); a released
  surface must break; the release identity or lockfile integrity
  fails; an executable defect outside Q6's bounded fix authority is
  found; or the operator data could be touched.
- Scope protections (binding): VICT stays read-only; no publish; no
  version changes; no `qlt.proposal.draft` or M-1 policy change; no
  agent read/list/search tools; no agent confirmation authority; no
  project-scoped conversations; no turn steering; no autonomous cycles;
  no retention/deletion propagation; no provider broadening; no real
  operator data; no frozen-contract rewrites; no Stage 07C/Stage 07
  completion claims.
- Boundary vs. later work: Stage 07D (retention, recovery, real-use
  data-protection proof), Stage 07E, Q7, turn steering,
  project-scoped conversations, provider fallback, and additional agent
  authority remain OUT OF SCOPE.

## 15. Structural containment vs. model-behavior observations (frozen)

Every acceptance criterion above is STRUCTURAL (durable rows, closed
envelopes, stable codes, byte scans, identity discipline). Model WORDED
behavior (exact phrasing, willingness, tone) is an OBSERVATION recorded
truthfully in the implementation report — never an acceptance gate,
because it is nondeterministic.
