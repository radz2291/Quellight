# Quellight Stage 07D Phase D4a — MSTR-012 Real-Use Proof Contract

> **Class:** Frozen phase contract (documentation only). This document is
> committed BEFORE any D4 proof machinery exists. It freezes the shape of
> the Stage 07D D4 real-use proof: what MSTR-012/QLT-017 require, the two
> evidence layers, the session-level authorization model, the store and
> data-safety strategy, the evidence boundaries, and the negative-control
> obligations of the preparation phase. It authorizes nothing: no
> provider access, no organic-use session, no execution of the proof.
> **D4 real-use evidence does not exist yet. Stage 07D is not verified
> or formally closed. Stage 07E has not begun.**

## 0. Disposition and anchors

```text
Contract basis (verified 2026-09-22, fresh fetch):
Quellight origin/main = 99e54010… (HEAD; clean tree; D2 implementation
  complete with focused safety evidence; no D4 execution work exists)
VICT origin/main      = 4aa245d2… (HEAD; untouched; read-only)
D1/D3 foundations:   implemented (49 + 35 gate checks green)
D2 deletion/export:  implemented (74 gate checks + browser pass)
D4 live/real-use:    NOT BEGUN (no evidence exists)
Stage 07D:           NOT verified or formally closed
Stage 07E:           NOT BEGUN
```

## 1. MSTR-012 / QLT-017 interpretation (from canonical text, not assumption)

`MSTR-012` (VICT architecture, v0.3.1 split): Stage 07 must declare its
supported deployment envelope — local-first, single-actor,
single-application-process, non-multi-tenant, file-backed — and prove
retention, deletion, export, and pruning **in real use**; store files not
web-accessible; secret canaries absent from every retained and observable
surface; credentials external to stored data; informed-user retention
disclosure; documented backup/recovery limitations.

`QLT-017`: the same proofs must exist **before Quellight is called usable
for real cases**. The Stage 07 exit gate (§13 item 8) carries the same
list. Neither canonical text prescribes a numeric session count or
duration; they prescribe behaviors proven in real use. The approved owner
decision **OD-D5** fixes the shape: **one bounded owner-authorized
structured session** (the Q6 one-shot pattern: explicit authorization,
consumed receipt, structural-evidence-only records, no raw conversation
content committed) **followed by a short owner organic-use evidence
window**.

Therefore the proof has exactly two evidence layers, and neither alone is
sufficient: Layer A proves the machinery end to end under controlled
bounds; Layer B proves the product behaves under uncontrolled, genuine
use. Layer A's controlled conditions must never be described as organic
use, and Layer B must never substitute for Layer A's end-to-end controls.

## 2. Layer A — bounded structured real-use session

A single owner-authorized session using the **real application** (the
production composition, the pinned provider profile
`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`) and a
**owner-supplied low-sensitivity scenario** stored OUTSIDE the repository
(never committed; the harness reads only its byte count, never its
content, into evidence).

Structural proof points (each must leave a pass/fail receipt; none may
depend on model wording, hidden reasoning, autonomous capability choice,
token counts, or behavior outside the declared product contract):

| #   | Proof point                                                        | Structural evidence                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Natural conversation remains usable                                | turn terminal status `completed`; reply bytes > 0                                                                                                                                                     |
| A2  | The owner deliberately preserves durable meaning                   | a confirmed record exists, created by a user boundary; the path used (ceremony confirmation of a proposal, or direct Save) is recorded — **both are valid product paths of equal evidentiary weight** |
| A3  | Nothing becomes canonical without user authority                   | the canonical record count matches the user-confirmed/direct-saved set exactly; agent-drafted proposals remain pending and non-canonical                                                              |
| A4  | Confirmed meaning survives restart                                 | after a real composition restart on the same data dir: record intact (same identity, version, content bytes)                                                                                          |
| A5  | A genuinely fresh conversation receives relevant confirmed meaning | assembly of the fresh thread selects the confirmed record; selection evidence present                                                                                                                 |
| A6  | Pending, removed, and ineligible meaning is excluded               | assembly evidence contains no pending proposal, no `user-removed` record, no expired record                                                                                                           |
| A7  | A supported commitment conflict produces the quiet challenge       | a second confirmation of the same `d4-proof-*` commitment key is refused (`QLT_COMMITMENT_CONFLICT`), a challenge row exists, and the quiet dismiss path resolves it                                  |
| A8  | Export truthfully represents its declared scope                    | the versioned export builds, carries the disclosure header, its counts match the store, and the canary scan of the document is clean                                                                  |
| A9  | Deletion/removal of dedicated proof records behaves as designed    | the dedicated proof record is removed; the tombstone is content-free; assembly excludes it                                                                                                            |
| A10 | Conversation-only deletion preserves Shared World meaning          | the dedicated proof thread is deleted conversation-only; the preserved meaning is byte-identical; the thread tombstone row has a null title                                                           |
| A11 | Reconciliation remains complete and truthful                       | the deletion receipt is `completed` with all cross-store receipts present; boot recovery reports no open intent afterwards                                                                            |
| A12 | Transcripts contain no injected context block                      | transcript bytes of both threads scanned for the context-block marker; absent                                                                                                                         |
| A13 | Evidence hygiene                                                   | every evidence byte scanned for the credential value, the scenario digest, and raw prompt/response text: all absent                                                                                   |

**Session bounds (frozen):** ≤ 45 minutes wall clock; ≤ 10 user turns;
≤ 20 provider HTTP requests; ≤ 2048 output tokens per request; ≤ 120 s
per-turn deadline; **zero retries and no fallback** (the Q6 precedent).
The harness verifies the remaining request budget BEFORE each transport
and fails closed when any bound would be exceeded.

**Failure semantics:** any failed proof point, any scan hit, or any bound
exceeded seals the session truthfully as failed/incomplete. An
infrastructure-only failure (provider unreachable/5xx before any scenario
meaning) seals as `failed-infrastructure`; the OWNER may then authorize
one fresh session — a new one-shot receipt is required; the harness can
never issue one itself.

## 3. Layer B — short organic-use observation window

**Proposed window (smallest defensible):** **three genuine sessions,
across at least two separate application launches on at least two
calendar days, including at least one restart and at least one genuinely
fresh conversation.** Justification from repository truth: the canonical
texts prescribe no duration — they prescribe that the behaviors be proven
in real use — and the approved OD-D5 default calls for a _short_ window.
Three sessions across separate launches is the minimum that exhibits
continuity actually relied upon (session 2+), a restart boundary, a
fresh-conversation boundary, and a repeat observation for stability, all
without engineering a synthetic duration. The owner may extend the
window; it may not be shortened below one session.

Organic use happens on the owner's **real low-sensitivity subject of the
owner's choosing**, in the owner's normal application, on the owner's
normal data directory — with **no harness attached**. Evidence rules:

- conversation wording is **never committed** (no content, no digests of
  content unless the owner explicitly elects one for a specific event);
- the owner may exclude any private event from evidence, without giving a
  reason;
- reports carry structural metadata (session count, launch count, restart
  yes/no, fresh-conversation yes/no) and the owner's observation answers
  only;
- the eight observation questions recorded: did continuity help; was
  remembered meaning accurate; was the confirmation burden reasonable;
  did conflict handling interrupt natural conversation; could the owner
  understand and control memory; did restart preserve trust; did
  deletion/export behave as claimed; was there noticeable friction or
  latency.

## 4. Store and data-safety strategy (staged combination)

- **Layer A** uses a **dedicated isolated real-use data directory**
  (`QUELLIGHT_DATA_DIR_ABSOLUTE`, an owner-chosen path outside the
  repository; the composition guard already refuses the default operator
  directory and any repository-internal location). This is a real
  application, real provider, real durable stores — disposable only
  because the scenario content is owner-supplied and low-sensitivity.
- **Layer B** uses the **normal operator store**, because organic use on
  a synthetic isolated store would not be genuine use and must not be
  equated to it. The preparation machinery never touches the operator
  store; the D-Q5-3 binding decision stands.
- Destructive scenarios (A9–A11) operate **only on clearly dedicated
  proof records/threads** (`d4-proof-*` keys, `d4-proof` subject prefix),
  always preview-first, export-verified before deletion, with
  reconciliation and restart verified after. The harness may delete only
  through the same governed user surfaces the product UI uses — it gains
  no deletion authority beyond them. The proof **never claims** that
  uncontrolled backups or external copies were deleted; the documented
  backup/recovery limitations disclosure (MSTR-012) carries that truth.

## 5. Session-level authorization model (frozen)

- **Identity:** profile `ollama-cloud/glm-5.3-flash` at
  `https://ollama.com/v1`; credentials via the `OLLAMA_API_KEY`
  environment variable only (existence checked; value never printed,
  logged, or written anywhere).
- **Gate:** the harness refuses to run unless (1) the owner sets
  `QUELLIGHT_D4_STRUCTURED=1` explicitly, (2) the credential is present,
  and (3) the one-shot receipt `docs/report/evidence/d4-structured-session-receipt.json`
  does not yet exist. The receipt is created with an exclusive-create
  write carrying the authorization date, profile, bounds, and workspace
  path; any later run finds it and refuses (`QLT_D4_ALREADY_AUTHORIZED`).
  Only the owner may remove a receipt (an owner act), enabling exactly one
  re-authorization.
- **Bounds, retries, stop conditions:** §2. Stop immediately and seal
  truthfully on: any failed proof point; any leak-scan hit; any bound
  breach; provider unavailability at session start.
- **Evidence boundaries:** sealed evidence contains structural outcomes
  and counters only — no conversation content, no credential values, no
  absolute paths, no scenario text or digests, no raw prompts/responses.
- **Cleanup:** the owned workspace is removed after sealing and the
  removal is verified; the receipt and the sealed evidence summary remain
  as the audit trail.
- **Rerun prevention:** the consumed receipt (N-D4-P controls below
  enforce absence/malformed/reuse refusals offline).

The future owner authorization for Layer A must be short and
comprehensible. The exact text required to begin the structured session:

> I authorize ONE Quellight D4 structured real-use session. It will run
> the real application against the pinned provider profile
> `ollama-cloud/glm-5.3-flash` using my `OLLAMA_API_KEY` from the
> environment. It will use a dedicated proof data directory outside the
> repository; my normal Quellight data and VICT `.pi/` data are not
> touched. Bounds: one session of at most 45 minutes, at most 10 of my
> user turns, at most 20 provider requests, at most 2048 output tokens
> per request, no retries and no fallback. I will supply the scenario
> text myself and it will never be committed. Evidence will be structural
> outcomes only — no conversation content, no credentials, no absolute
> paths. If the provider fails before the scenario begins, the session is
> sealed as failed and I may authorize one fresh session with a new
> receipt. Everything is cleaned up afterwards; a receipt records that
> the authorization was consumed. — Owner, [date]

The organic window needs no harness authorization (no harness runs); it
requires only the owner's willingness to answer the observation questions
afterwards.

## 6. Preparation-phase obligations (this phase, D4a)

Before any execution authorization is requested, the preparation must
prove **permanently and offline** (gate `verify:d4-prep`, synthetic
stores only): the authorization gate refuses absent, reused, and
malformed authorization; bounds are enforced before any transport;
evidence cannot contain credentials, absolute paths, raw prompt/response
keys, or scenario digests; partial or contradictory evidence cannot be
sealed as success; false restart, fresh-thread, deletion, export, and
reconciliation claims fail; a synthetic success traverses the complete
evidence lifecycle; failure and cleanup paths stay truthful; operator
data stays untouched; and the D1/D2/D3 focused gates remain green where
affected. The prep gate itself performs no provider access of any kind.

## 7. Status

```text
QUELLIGHT STAGE 07D D4 PROOF CONTRACT FROZEN — EXECUTION NOT AUTHORIZED
NO PROVIDER OR OPERATOR-DATA ACCESS OCCURRED
D4 REAL-USE EVIDENCE DOES NOT YET EXIST
STAGE 07D IS NOT VERIFIED OR FORMALLY CLOSED
STAGE 07E HAS NOT BEGUN
Stage 07 remains In Progress.
```
