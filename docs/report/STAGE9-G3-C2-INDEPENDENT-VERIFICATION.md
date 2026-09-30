# Quellight — Stage 9 G3-C2 INDEPENDENT VERIFICATION (OD-R4 minimal boundary-actor increment)

Fresh verifier (separate checkout, no prior role). Audited commit `1f7dcdcbbffdd58901c1eb478f6492aa106f4ba7`
on `origin/codex/stage9-g3-c2-boundary-actors`; base verified `origin/main = 5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`
(ls-remote pre-check). Verification date 2026-09-30. No product file was modified.

## Verdict: VERIFIED PASS (no Blocking, no High, one non-blocking Low)

| #   | Area                       | Result |
|-----|----------------------------|--------|
| 1   | Contract fidelity          | PASS   |
| 2   | Minimality audit           | PASS   |
| 3   | Test ladder                | PASS   |
| 4   | verify:stage7e             | PASS   |
| 5   | Live reproduction (demos)  | PASS   |
| 6   | Outcome recording          | PASS AS HONEST LIMITATION |
| 7   | Agent-prefix guard         | PASS (guard preserved) |
| 8   | Overall                    | VERIFIED PASS |

## 1. Contract fidelity (docs/governance/STAGE-9-G3-C2-ENTRY-CONTRACT.md)

The committed contract matches the authorized OD-R4 scope verbatim: S1 second
boundary token → DISTINCT agent-context actor lacking `qlt.inspection.read`
+ `app.data.write`; S2 actor-derived inspection grant with operator behavior
byte-identical; S3 `src/routes/vict/[...path]/+server.ts` UNCHANGED vs main
(full diff audit of `5f709a5..1f7dcdc` over `src/routes` = EMPTY); S4 nothing
else (no dep bumps, no lockfile repair, 07E Lows not folded).

Verified implementation facts against each clause:
- S1: `QUELLIGHT_AGENT_ACTOR_TOKEN` resolves to `agent-quellight-agent-context`
  (roles `developer` only) via a two-entry `createLocalTestAuthenticator` map
  (src/lib/server/composition.ts). Live whoami under the agent token shows NO
  `app.data.write` and NO `operator.resolve`.
- S2: `inspectionPermissionsForActorRecord()` derives `qlt.inspection.read`
  from the resolved actor's directory record (active + `operator` role),
  fail-closed for unresolvable actors. Operator behavior byte-identical.
- S4: health/compatibility inspect answers byte-identical for both tokens and
  byte-equal to the frozen VICT-side pin (see §5).

## 2. Minimality audit — every hunk classified

`git diff 5f709a5..1f7dcdc --stat`: 8 files, 635 insertions, 3 deletions.
No hunks outside their classification; no version-pin/schemata/lockfile/package.json
changes; no ceremony/memory/retention/product-admission edits.

| File                                                     | Class                              | Verdict |
|----------------------------------------------------------|------------------------------------|---------|
| src/lib/server/composition.ts (+101)                      | S1 + S2 only                        | in-scope |
| test/g3-c2-boundary-actor.test.ts (new)                   | contract-required tests             | in-scope |
| scripts/demo-g3c2-boundary-actors.mjs (new)               | contract-required demos             | in-scope |
| docs/governance/STAGE-9-G3-C2-ENTRY-CONTRACT.md (new)      | contract itself                     | in-scope |
| docs/decision-register.md (+45)                            | S4/register: D-G3-C2-1              | in-scope governance reconciliation |
| README.md / docs/system-reference.md (+1 each)             | S4/status-surface reconciliation    | in-scope governance reconciliation |
| docs/report/QUELLIGHT-STAGE-9-G3-C2-IMPLEMENTATION.md (new) | implementation record + transcripts | in-scope |

Scope creep found: NONE.

## 3. Tests

- `npm run test:node`: 31 test files / 360 tests — ALL PASS (counts match the builder's claim).
- `npm run test:ui`: 20/20 PASS.
- `npm run typecheck`: PASS.
- `npm run format:check`: PASS.
- `test/g3-c2-boundary-actor.test.ts` run individually: 3/3 PASS. The three
  tests assert BOTH distinct-resolution (S1: different actorId, roles, scopes
  sets, mastraResourceId, wire whoami + `resolveBoundaryActor`) AND the refusal
  (S2: agent-context `app.data.query` on `qlt.inspection` → result
  `ok:false`, `code:'DATA_UNAUTHORIZED'`, operator same-surface `ok:true`).

Environment note (verifier machine, non-blocking): `npm ci` refuses on this
host (`@esbuild/aix-ppc64@0.25.12` missing from lockfile in the esbuild version
pin family — the pre-existing upstream LOW, untouched per S4). Installation
proceeded via `npm install` with the committed `package-lock.json` immediately
restored unmodified (`git status` clean). Also needed `npx svelte-kit sync`
first (generative `.svelte-kit` artifact) and one npm-scripts-allowlist approval
for esbuild's own postinstall. No repo change resulted.

## 4. verify:stage7e

`npm run verify:stage7e`: **PASS** — the register/status reconciliation
(D-G3-C2-1 added to the register + README/system-reference surfaces) kept the
re-keyed validator holding; the L-4 frozen-evidence exception held with all
negative controls (byte change / added match / shifted line / different path
all refuse); every composed offline gate green including verify:consumer,
q2–q6, stage7c, d1/d2/d3, dev-live; verify:d4-prep held to its exact
by-design red.

## 5. Live reproduction (fresh run, offline deterministic, fresh loopback port — the demo listener bound a fresh ephemeral 127.0.0.1 port)

Real product turn through admission: POST /vict/v1/turns, authorization
header PRESENT (value redacted), terminal status `completed`
(turnId `turn-a8530955-3b62-49fe-89ff-dff7ae5fa858`, actorId
`actor-quellight-local`, deterministic fixture).

(i) Operator whoami: actorId `actor-quellight-local`, roles
`["developer","operator"]`, scopes include `app.data.write` and
`operator.resolve`.
(ii) Agent-context whoami: actorId `agent-quellight-agent-context` — TWO
DISTINCT actorIds; agent scopes include `app.data.read`,`run.read`,
`agent.turn.start/agent.stream.read/audit.read/…` and EXCLUDE
`app.data.write` AND `operator.resolve`.
(iii) Operator token on qlt.inspection query → `{"result":{"ok":true,"rows":[],"total":0}}`.
(iv) Agent-context token on the SAME query → REFUSED:
`{"ok":true,"data":{"result":{"ok":false,"code":"DATA_UNAUTHORIZED","message":"Access to resource 'qlt.inspection' requires permission 'qlt.inspection.read'."}}}`.
(v) health.inspect / compatibility.inspect under BOTH tokens byte-identical
and matching the frozen VICT-side pins verbatim:

- health (both): `{"ok":true,"data":{"healthy":true,"commandSchema":"vict.command@1","streamSchema":"vict.agent-stream@1"}}` — MATCH.
- compatibility (both): `{"ok":true,"data":{"commandSchema":"vict.command@1","streamSchema":"vict.agent-stream@1","changesetSchema":"vict.changeset@1","turnSchema":"vict.agent-turn@1"}}` — MATCH.

Token values redacted in every recorded artifact; full transcript committed at
`docs/report/evidence/g3-c2-live-demo-transcript-independent-verifier.txt`.

## 6. Audit / outcome recording

The refusal surfaces through Quellight's own released surface authorization
(inspection-surface `authorize()` → `DATA_UNAUTHORIZED`), but Quellight's
receipt machinery is mutation-bound: read-command (query) denials carry NO
durable receipt — this is the builder's disclosed open issue and matches the
code (no receipt write on the query-denial path). The durable evidence is the
builder's committed implementation record (`docs/report/
QUELLIGHT-STAGE-9-G3-C2-IMPLEMENTATION.md` transcripts) plus this verifier's
own fresh transcript. Classified HONEST LIMITATION NOTE — non-blocking under
the owner's OD-R4 minimal-increment scope (recording machinery for read
denials was not in scope). No synthetic durable event was fabricated by the
builder — truthfulness preserved.

## 7. Agent-prefix guard (D-Q5 guard vs the new identity)

Implementation record cites the D-Q5 agent-refusal guard. Verified in
`src/lib/server/conversation-lifecycle.ts`: `requireUserActor(actorId, code)`
throws for ANY actorId whose identity is not exactly `LOCAL_ACTOR_ID`
(`actorId !== LOCAL_ACTOR_ID || actorId.startsWith('agent-')` fail-closed).
`AGENT_CONTEXT_ACTOR_ID = 'agent-quellight-agent-context'` starts with
`agent-` (and is not the local actor), so every operator/user actor surface it
guards refuses the agent-context identity with the recorded stable refusal
codes. It neither accidentally grants nor bypasses: the guard tests the actor
identity, not the token, and the new distinct actorId is refused exactly as
`QLT_AGENT_PROPOSER_ID` (`agent-quellight`) is. VERDICT: guard semantics
PRESERVED (criterion (d) machinery intact).

## Non-blocking findings

- **L-1 (Low, pre-existing)**: lockfile desync class (`npm ci` incompatibility
  on a fresh host, esbuild 0.25.12 platform set missing from lockfile). The
  contract explicitly forbids lockfile repair this increment (upstream LOW
  stays). Verifier worked around with a work-local install; the committed
  lockfile remains byte-untouched.

## Summary

The G3-C2 increment is exactly OD-R4 minimal, contract-faithful, freshly
reproducible live, all gates green, guard preserved. G3-C2: VERIFIED PASS.