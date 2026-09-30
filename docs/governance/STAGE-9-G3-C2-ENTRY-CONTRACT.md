# Quellight — Stage 9 G3-C2 entry contract: second boundary actor + actor-derived inspection grants (owner-decision OD-R4, trigger: verifier ruling X, 2026-09-30)

Purpose: make Quellight's OWN authorization able to REFUSE an identity that lacks the inspection permission, so the VICT Studio same-turn proof can demonstrate operator allow, underprivileged denial, and preservation of the agent-identity refusal — WITHOUT any other product behavior change.

Scope bounds (ADDITIVE MINIMALITY — anything beyond this is a material-contract violation):
- S1: boundary authenticator accepts a SECOND token entry mapping to a DISTINCT agent-context actor identity (new actorId; roles/scopes chosen minimally-realistic; it must LACK the inspection permission and any app.data.write; it MAY carry read scopes the agent caller legitimately needs e.g. agent.turn.get). Follow the existing token/actor machinery's patterns (env-var names included).
- S2: the inspection permission/grant becomes ACTOR-DERIVED: the operator actor's current behavior byte-identical (same whoami fields semantics, same granted surface); the new actor resolves WITHOUT it, so its attempts on the operator inspection surface are REFUSED by Quellight's own authorization (truthful stable outcome code).
- S3: the browser-facing proxy route src/routes/vict/[...path]/+server.ts UNCHANGED (it still re-injects the operator token for browser safety; the distinct identities are exercised on the DIRECT boundary port, which is what external server-side callers use).
- S4: NOTHING else changes: inspect answers (health.inspect/compatibility.inspect) byte-identical (a downstream frozen VICT pin requires equality); product admission flows, Shared World schema, ceremony/mem/retention surfaces untouched; NO dependency bumps; NO lockfile repair (upstream LOW stays); the two 07E product Lows NOT folded.

Required demos (post-increment, live): whoami DIFF non-empty between the two tokens (distinct actorIds); agent-context token attempting the operator inspection surface -> REFUSED with a stable outcome code recorded in the audit/log where the machinery records outcomes; the SAME surface under the operator token -> succeeds; no client-side simulation anywhere.

Governance: Quellight's own validators must stay truthful — run the repo's verify ladder relevant to touched surfaces + verify:stage7e (its re-keyed status validator: add the increment to the decision register + status surfaces per YOUR OWN repo's D-register conventions so the validator keeps holding; product code only for S1/S2); full existing test suites green.

Independent verification: a fresh verifier (separate checkout) will verify this contract's demos + minimality + the verify ladder before the VICT-side G3-C re-verification consumes the incremented tree.
