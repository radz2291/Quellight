# Quellight — Stage 9 G3-C2 implementation record (owner-decision OD-R4)

**Increment**: second boundary actor (`agent-quellight-agent-context`) +
actor-derived inspection grant. Entry contract: `docs/governance/STAGE-9-G3-C2-ENTRY-CONTRACT.md`
(committed verbatim as the first increment commit; date 2026-09-29/30).

**Implementation commits**: S1 (two-entry authenticator map +
`QUELLIGHT_AGENT_ACTOR_TOKEN`, distinct `AGENT_CONTEXT_ACTOR_ID`); S2 (the
inspection permission derives from the authenticated actor's DIRECTORY
record at Quellight's read boundary — the operator actor's derived
permission is byte-identical to the released hard-coded grant; the
agent-context actor resolves WITHOUT it and is REFUSED by Quellight's own
surface authorization). S3: `src/routes/vict/[...path]/+server.ts` UNCHANGED
(it still injects only the operator token). Tests:
`test/g3-c2-boundary-actor.test.ts` (S1 distinct resolution, S2 refusal +
operator success, S4 operator independence / identical shapes).

**Outcome codes**

- Operator inspection read (released `app.data.query` on `qlt.inspection`):
  `ok:true` (rows per the frozen surface).
- Agent-context inspection attempt: REFUSED with the stable Quellight
  authorization code `DATA_UNAUTHORIZED` ("Access to resource 'qlt.inspection'
  requires permission 'qlt.inspection.read'") — refused INSIDE Quellight's
  own surface authorization, after the identity resolved through the REAL
  boundary authenticator and passed the released `app.data.read` scope.
  Read-command denials carry no durable VICT receipt by the machinery's
  design (receipts are mutation-bound); the committed transcript below is
  the truthful evidence record — no synthetic durable event was fabricated.
- health.inspect / compatibility.inspect: byte-identical for BOTH tokens.

**Transport note**: the released `app.data.query` GET transport carries
query-param strings only and structurally cannot carry the bounded object
filter container, so the inspection-surface demos cross the IDENTICAL
in-process released command boundary the SvelteKit proxy drives (the same
composition, the same dispatch, the same surface). Identities themselves
are exercised on the DIRECT boundary port (whoami/inspect below are wire
HTTP responses from the loopback listener). Tokens are generated
in-process by the demo script and REDACTED from every printed line.

---

## Live demo transcript (offline deterministic mode; tokens REDACTED)

=== PRODUCT PROOF — real turn via admission (method POST /vict/v1/turns, authorization header PRESENT, value REDACTED) ===
{
"startResponse": {
"status": 200,
"body": {
"ok": true,
"data": {
"turnId": "turn-e3b7787f-9e67-4451-b8e4-28b269302b8c",
"streamId": "stream-e221f3c0-a1dc-493d-be27-39e79501155a"
}
}
},
"terminalStatus": "completed",
"recordedTurn": {
"ok": true,
"data": {
"turn": {
"turnId": "turn-e3b7787f-9e67-4451-b8e4-28b269302b8c",
"streamId": "stream-e221f3c0-a1dc-493d-be27-39e79501155a",
"threadId": "vict-conv-conv-7c68b3434c67046f",
"actorId": "actor-quellight-local",
"agentProfileVersion": "v1_f34b3c23f75552267f998173131c141429ae93b413b98fcc1d418bcd6bfa6b41",
"inputSummary": "user-input:length=45",
"status": "completed",
"createdAt": 1790744459086,
"updatedAt": 1790744459780,
"terminalAt": 1790744459780,
"traceId": "97ed49de23ca243f3c1419dd0830568c"
}
}
}
}

=== DEMO 1a — operator token, GET /vict/v1/actor/whoami (authorization header PRESENT, value REDACTED) ===
HTTP 200
{"ok":true,"data":{"actorId":"actor-quellight-local","roles":["developer","operator"],"scopes":["activation.read","activation.select","agent.stream.read","agent.turn.cancel","agent.turn.start","app.data.read","app.data.write","audit.read","changeset.propose","changeset.read","changeset.revise","conversation.delete","conversation.read","operator.resolve","release.read","release.select","run.cancel","run.read"],"mastraResourceId":"vict-actor-actor-quellight-local"}}

=== DEMO 1b — agent-context token, GET /vict/v1/actor/whoami (authorization header PRESENT, value REDACTED) ===
HTTP 200
{"ok":true,"data":{"actorId":"agent-quellight-agent-context","roles":["developer"],"scopes":["activation.read","agent.stream.read","agent.turn.cancel","agent.turn.start","app.data.read","audit.read","changeset.propose","changeset.read","changeset.revise","release.read","run.read"],"mastraResourceId":"vict-actor-agent-quellight-agent-context"}}

=== DEMO 2 — agent-context token, app.data.query on qlt.inspection (REFUSED by Quellight’s own authorization; authorization resolved through the boundary authenticator) ===
{
"ok": true,
"data": {
"result": {
"ok": false,
"code": "DATA_UNAUTHORIZED",
"message": "Access to resource 'qlt.inspection' requires permission 'qlt.inspection.read'."
}
}
}

=== DEMO 3 — operator token, the SAME surface (SUCCEEDS; inspect answers actor-independent) ===
{
"ok": true,
"data": {
"result": {
"ok": true,
"rows": [],
"total": 0
}
}
}

=== S4 — health.inspect under BOTH tokens (byte-identical; GET /vict/v1/health) ===
{
"operator": "HTTP 200\n{\"ok\":true,\"data\":{\"healthy\":true,\"commandSchema\":\"vict.command@1\",\"streamSchema\":\"vict.agent-stream@1\"}}",
"agent-context": "HTTP 200\n{\"ok\":true,\"data\":{\"healthy\":true,\"commandSchema\":\"vict.command@1\",\"streamSchema\":\"vict.agent-stream@1\"}}"
}

=== S4 — compatibility.inspect under BOTH tokens (byte-identical; GET /vict/v1/compatibility) ===
{
"operator": "HTTP 200\n{\"ok\":true,\"data\":{\"commandSchema\":\"vict.command@1\",\"streamSchema\":\"vict.agent-stream@1\",\"changesetSchema\":\"vict.changeset@1\",\"turnSchema\":\"vict.agent-turn@1\"}}",
"agent-context": "HTTP 200\n{\"ok\":true,\"data\":{\"commandSchema\":\"vict.command@1\",\"streamSchema\":\"vict.agent-stream@1\",\"changesetSchema\":\"vict.changeset@1\",\"turnSchema\":\"vict.agent-turn@1\"}}"
}
This storage provider does not support batch creating metrics

DEMO COMPLETE
