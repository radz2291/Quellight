# Quellight Stage 07C Phase Q6 recovery amendment

Date: 2026-09-22. Owner authorization: the new recovery instruction dated
2026-09-22. Decision D-Q6-15. This additive amendment is committed alone before
production or acceptance changes. Historical freezes and reports remain intact.

Starting identities: Quellight `c07385e5b9b05e16471a00b8337c84afee8cf0ad`,
VICT `fd0c1f7bcd9b0b53a97dfc578a5911244e4bacc4`. Both fetched and equal to
their remote main branches. Quellight retains exact stable VICT 0.3.1 pins.

## Executable findings before adoption

Network-disabled diagnostics traversed the installed Mastra router, VICT bridge,
closed contracts, disposable stores and reply restore. Fragmented simulated SSE
proved valid-call acceptance, invalid-call rejection (`VICT_TOOL_FAILED`, zero
invocations), and reasoning-only length termination producing an empty reply.
The outgoing schema and incoming arguments were structurally preserved.

Five diagnostic HTTP requests have completed under the new authorization:

1. Reasoning effort `none`, 512 tokens: HTTP 200, length, zero reasoning bytes,
   2,438 visible bytes, no call. Reasoning control alone did not solve the task.
2. Same control, 1,024 tokens: HTTP 200, tool_calls, 3,157 visible bytes; the
   260-byte claim arguments failed the epistemicType bound and honestyState /
   confidence enums. No normalization change, no durable invocation.
3. Its tool-result continuation: same rejection for 264-byte arguments;
   3,305 visible bytes. The request cap refused a third request before transport.
   Natural-flow acceptance also failed. This control will not be adopted.
4. Normal reasoning (no effort override), 2,048 tokens, explicit closed-field
   guidance: HTTP 200, tool_calls, 2,240 reasoning bytes, zero visible bytes;
   268-byte real arguments passed the guard, Mastra validation, Contract.parse
   and domain validation unchanged; one completed quiet-write invocation and
   one inert pending claim, zero canonical records.
5. Its continuation: HTTP 200, stop, 219 reasoning bytes, 205 visible bytes;
   natural-flow acceptance passed, no additional call.

All diagnostic stores were scanned for credential absence and removed after
worker exit. Raw arguments and reply text were examined only in memory;
evidence contains field names, lengths, closed codes and counts. No private
fixture has been used in diagnostics. No formal live ceremony has run.

These findings establish two independently observable barriers: insufficient
generation allowance for the reasoning-plus-tool path, and real generated
arguments outside the closed enum contract. They do not establish the provider's
internal schema-rendering mechanism or the exact arguments of historical runs.

## Adopted changes

- Keep the provider/model/endpoint, automatic tool choice and default reasoning
  behavior. Do not use `reasoning_effort: none`.
- Add compact instruction guidance spelling out the existing claim/open-loop
  field enums and requesting a brief natural response after drafting. This
  supplies the model with valid encodings; it does not repair, coerce or loosen
  returned arguments. Instructions revision 4 becomes 5; profile 6 becomes 7.
  Capability `qlt.proposal.draft@3`, its schema, parsers and authority stay intact.
- Set the product default and maximum output allowance to 2,048 tokens per
  provider request. Set the Q6 request allowance to the same value. The previous
  name `maxOutputTokensPerTurn` incorrectly described a setting applied anew on
  every Mastra model step; rename the Q6 field to reflect its actual unit.
- Bound the final proof to six user turns, three HTTP requests per user turn,
  twelve HTTP requests overall, and a 120-second deadline shared by all HTTP
  requests in a user turn. Fail before transport on overflow. Retain zero SDK
  retries, no fallback, maxToolCalls two, and exactly one final authoritative
  execution under this authorization, after the authoritative offline ladder.
- Preserve all five existing matrix turns and their ceremony. Add a sixth
  transient conversation control combining a temporary feeling, one-off delivery
  incident, speculation and ordinary conversation. Require a natural visible
  reply, zero calls, zero proposals and zero canonical changes.
- Require every turn's reply to belong to that turn (never reuse an earlier
  assistant message), and apply natural-flow checks to the fresh-thread turn
  as well. Record every HTTP request and validation verdict as structural
  metadata. A length termination is a failed proof, even when it has visible
  text. Tool failures cannot be hidden by a later conversational reply.

The unchanged external private fixture must be owner-designated; do not invent
or substitute a fixture. The parent/worker lifecycle, disposable storage,
credential scans, fixture identity checks, governed user confirmation,
idempotency, stale-version refusal, restart, fresh-thread context, authority and
transcript containment requirements remain mandatory. No VICT change or release
is supported by the current evidence. Q6 is not formally closed; Q7 has not begun.
