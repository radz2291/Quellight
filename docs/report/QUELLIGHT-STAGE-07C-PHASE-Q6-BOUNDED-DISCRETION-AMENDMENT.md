# Quellight Stage 07C — Phase Q6 Bounded Memory Discretion Amendment

**Status:** AMENDED under the freeze amendment procedure (frozen contract
§13). This is a standalone, dated amendment commit committed ALONE
before any executable change. It changes ONLY this document in this
commit; the frozen declarative module
`src/lib/sharedworld/q6-contract.ts`, the conversation instructions,
and all executable surfaces are changed in SEPARATE, subsequent
implementation commits that cite this amendment.
**Date:** 2026-09-21.
**Amended contract:**
`docs/report/QUELLIGHT-STAGE-07C-PHASE-Q6-CONTRACT-FREEZE.md`
(freeze commit `ca82892…`; zero prior amendments).
**Preserved unchanged:** the original freeze document, the Phase Q6
implementation report, both live-proof failure records, and all
historical reports.

## 1. What happened (truthful preservation of both failed live executions)

The authoritative live-provider execution history of Phase Q6 is:

1. **Execution 1** (2026-09-21, tree `8d1273bf51b1bfd2921cd51d0e9bdf1135ad9556`,
   original phase authorization): the proof failed at its first
   provider turn with an HTTP 401 (authentication failure) response
   class. Read-only root-cause diagnosis found the launcher had
   supplied a literal credential REFERENCE string (an unresolved
   `$OLLAMA_API_KEY` environment-variable name from the operator's
   agent-configuration file) instead of the real credential — a
   meaningless bearer value reached the provider. The credential itself
   was later verified valid and working directly (models list and a
   minimal chat completion with the frozen model both returned HTTP
   200). No proposal, record, or durable effect was created; no rerun
   occurred.
2. **Execution 2** (2026-09-21, tree
   `a32bba5468c2f7fe8d1b805deef8803d2fcd0cad`, a fresh dated owner
   authorization): with the corrected, verified-working credential, the
   gate passed, the composition built in LIVE mode, and the first
   provider turn COMPLETED successfully (5,925 ms, within every frozen
   bound) — but the model returned a conversational reply WITHOUT
   invoking the one draft capability `qlt.proposal.draft@2`. Zero
   durable invocation records and zero proposals existed, so the
   harness failed truthfully at the t1 boundary (the frozen
   missing-proposal failure class). No durable effect was created; no
   rerun occurred.

Both runs preserved every credential-protection property (presence-only
discipline; every byte-level leak scan completed clean) and failed
closed on Windows workspace cleanup (remediated by safe manual cleanup
each time; a parent/worker lifecycle correction is ordered by §6 of
this amendment).

## 2. Why the amendment is needed — "use it sparingly" was insufficiently precise

The revision-3 conversation instructions granted exactly one tool and
constrained it with: _"Use it sparingly, only when the user shares
something that may be worth remembering later, and never claim that
anything was remembered."_

Execution 2 demonstrated the defect in that instruction design: it is
ONE-SIDED. "Sparingly" restrains over-drafting but provides NO decision
procedure for when drafting IS appropriate, so the model's behavior on
a genuinely durable personal statement becomes a coin flip —
under-drafting (as observed) is as unconstrained as over-drafting. A
bounded live proof cannot be built on an unspecified behavior: the
proof would be random rather than evidential. What is required is
RULE-GUIDED DISCRETION — explicit, compact criteria that separate (a)
explicit remembering requests, (b) implicit durable meaning, and (c)
transient conversational detail — so each class has its own observable,
acceptance-testable behavior.

This amendment therefore makes the discretion rule-guided WITHOUT
widening authority: the capability envelope stays exactly one verb, the
host quiet-write policy stays one entry, the action inventory stays 21,
and only the user's governed confirmation creates canonical meaning.

## 3. Adopted: D-Q6-6 — bounded memory discretion (owner-approved policy)

Memory proposal discretion is rule-guided, not arbitrary:

1. When the user explicitly asks Quellight to remember durable
   information, the agent should draft a reviewable pending proposal.
2. When the user does not explicitly ask, the agent should still draft
   a proposal when the message contains a clear durable preference,
   commitment, ongoing goal, identity-relevant fact, or unresolved
   issue likely to matter in later conversations.
3. Temporary logistics, one-off incidents, software trouble, momentary
   feelings, speculative causal interpretations, and ordinary
   conversational detail should not become proposals merely because
   they were mentioned.
4. In a mixed message, extract only the durable core. Supporting
   circumstances remain transcript context.
5. Uncertain interpretations remain uncertain. In particular, the agent
   must not convert "this might be a signal" into a factual claim that
   technical hardship means the user should leave a job.
6. The agent may draft at most two distinct proposals in one turn under
   the existing budget: one proposal per durable semantic item.
7. Drafting remains quiet and epistemically inert. The conversational
   reply continues naturally; it must not claim that anything was saved
   or remembered.
8. Only the user's governed confirmation can create canonical Shared
   World meaning.

This policy changes conversation behavior only. The capability envelope
remains exactly:

```text
qlt.proposal.draft@2
declared effect: write
host policy: qlt.host-policy.quiet-write@1
maxToolCalls: 2
```

## 4. Conversation artifact identity (executable instructions change)

Because the executable conversation instructions change, the artifact
identity is bumped and nothing else about the authority envelope moves:

- instruction artifact `quellight.conversation-instructions`: revision
  **3 → 4** (the D-Q6-6 policy expressed clearly and compactly);
- agent profile `agent.quellight.conversation`: revision **4 → 5**
  (binding the revision-4 instructions);
- PRESERVED UNCHANGED: the pinned model and provider
  (`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`), the
  capability identity `qlt.proposal.draft@2/write`, the one-entry
  `qlt.host-policy.quiet-write@1` host quiet-write policy, the
  memory-policy artifact, the 21-action inventory, `maxToolCalls: 2`,
  `maxRetries: 0`, and the single-conversation authority model;
- ADDED: nothing — no capability, query, mutation, schema, migration,
  or autonomous behavior of any kind.

The distinction between durable meaning and transient context must
remain real: the agent must NOT draft on every personal statement.

## 5. The five-turn live proof matrix (replaces the single implicit-positive proof)

The original live proof sent ONE statement and implicitly expected a
proposal. It is REPLACED by a five-turn matrix that gives explicit
remembering, implicit durable judgment, and transient abstention
SEPARATE acceptance controls. Exactly five provider turns are planned,
within the retained six-turn ceiling:

- **Turn 1 — explicit positive control** (fixed statement): the user
  explicitly asks Quellight to remember a plain-language preference.
  Expected: natural conversational response; exactly one pending
  `claim` proposal; no canonical record; no claim that anything was
  saved or remembered.
- **Turn 2 — naturalistic discretionary positive**: the operator's
  personal natural fixture (§7) is sent verbatim through the real
  ingress. Expected: natural response to the user's dilemma; EXACTLY
  ONE `commitment` proposal is required; one additional `open_loop`
  proposal is permitted but optional (the unresolved fast-track-versus-
  gradual transition decision); no other proposal kind is permitted; no
  more than two total proposal invocations; no canonical record before
  confirmation. The commitment must preserve — without inventing
  meaning — all four semantic anchors: `not leave`, `current job`,
  `clear pathway`, `established base`. Minor grammatical normalization
  is allowed; the stored proposal must remain the USER'S commitment,
  never advice authored by the agent. The turn FAILS acceptance if it
  produces no commitment, records only the equipment/setup incident,
  treats hardship as proof or a factual "signal" that the user must
  leave, invents financial/family/health/spiritual/employer/deadline
  facts, creates a canonical record automatically, or produces more
  than two proposals.
- **Turn 3 — discretionary negative control** (fixed statement, an
  ordinary software incident): expected ordinary conversational
  response; ZERO capability invocations; ZERO proposals; ZERO canonical
  effects. This proves discretion is not merely always invoking the
  tool.
- **User ceremony** (not a provider turn): through the real governed
  user boundary — confirm ONLY the Turn-2 commitment proposal; leave
  the Turn-1 claim and any optional open loop pending; prove same-key
  confirmation replay; prove stale-version refusal with zero effect;
  prove exactly one canonical commitment; prove the agent exercised no
  confirmation authority. Then close and restart the composition
  against the same verified disposable data root.
- **Turn 4 — fresh-conversation continuity** (fixed statement, in a
  genuinely fresh conversation with no transcript dependency):
  structurally, the confirmed commitment is selected into that turn's
  bounded C1 snapshot; the response is non-empty and conversational; NO
  exact-wording assertion is made against nondeterministic model
  output; the durable transcript contains zero context-block bytes; the
  pending proposals are not injected as canonical meaning.
- **Turn 5 — hypothetical conflict and negative control** (fixed
  statement): the agent may engage the hypothetical normally; ZERO
  proposal invocations; the confirmed commitment remains byte-identical
  and version-identical; no silent correction, replacement, or
  supersession occurs.

Natural-flow assertions apply to ALL five turns: no exact response
wording is ever asserted; a non-empty completed response is required
when the provider succeeds; replies claiming "I saved that", "I
remembered that", or "memory updated" are rejected; visible tool,
capability, schema, or Shared World implementation jargon is rejected;
proposal creation must not interrupt the response with a generic
approval ceremony; and no tray, modal, focus theft, or conversational
blocking is introduced.

## 6. Bound change and lifecycle correction

- **Amended bound:** the Q6 live per-turn output-token ceiling is
  raised from 256 to **512** (`QUELLIGHT_MAX_OUTPUT_TOKENS=512` for the
  live proof only). This gives a reasoning-capable model room to
  exercise tool choice within one turn. No other bound moves.
- **Retained bounds:** at most 6 provider turns; 120 seconds per turn
  (`QUELLIGHT_TURN_DEADLINE_MS=120000`); zero automatic provider
  retries; ONE provider, ONE model, no fallback; exactly ONE
  authoritative execution per owner authorization; the double refusal
  gate (exit 2) and presence-only credential discipline.
- **Parent/worker lifecycle correction:** both live runs exposed a
  Windows cleanup failure because the process that owned the
  compositions also attempted to remove their SQLite workspace. The
  live verifier is corrected to a parent/worker lifecycle: the PARENT
  creates and owns the one verified disposable data root; a CHILD
  WORKER runs every composition, provider turn, restart, and ceremony
  operation; the worker closes every composition and exits; ONLY after
  the worker has exited does the parent perform the credential scan,
  the fixture-content safety checks, and the workspace deletion.
  Cleanup failure remains proof failure; only the verified owned root
  may ever be deleted; the external fixture file is never deleted;
  every S-1/S-2 ownership and fail-closed protection is preserved; and
  success and deliberate-failure tests must prove that no handles,
  listeners, child processes, or task-owned directories survive.

## 7. Privacy-preserving natural fixture (external; never committed)

Turn 2 uses the owner's long autobiographical message. It is PERSONAL:

- it is NEVER committed, NEVER embedded in source, tests, reports,
  snapshots, or documentation, and NEVER printed in logs or completion
  output;
- the live harness receives it from an operator-designated external
  UTF-8 file through the environment variable
  `QUELLIGHT_Q6_NATURAL_FIXTURE_FILE`, which must be an absolute path
  to a regular UTF-8 text file OUTSIDE the repository and outside the
  operator `.quellight-data` directory, of at most 12,288 UTF-8 bytes,
  containing no NUL bytes;
- the fixture is read-only input: the harness never deletes or modifies
  it and never copies it into the repository; its raw content is never
  logged or reported — only its byte length and SHA-256 fixture
  identity may enter safe evidence;
- the disposable live workspace may contain the user turn (as the
  normal durable transcript of a real conversation) and is removed with
  the owned proof workspace;
- offline tests use a SYNTHETIC, NON-PERSONAL fixture with the same
  semantic structure — never the personal message.

## 8. Authorization scope

This amendment AUTHORIZES PREPARATION ONLY: the instruction/profile
revision bump, the contract-data update, the external fixture boundary,
the parent/worker live harness, the acceptance predicates, the focused
offline tests, and the strengthened offline gates.

**Execution 3 remains UNCONSUMED.** It is NOT authorized by this
amendment and requires a separate, explicit owner invocation after this
preparation has been reviewed. Q7 remains BLOCKED — NOT BEGUN.
