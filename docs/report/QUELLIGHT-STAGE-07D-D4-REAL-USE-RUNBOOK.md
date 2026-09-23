# Quellight Stage 07D D4 Real-Use Runbook (owner-facing)

> **Status:** preparation only. Nothing in this runbook authorizes or
> performs the proof. **D4 real-use evidence does not exist yet.** This
> runbook is the owner's instructions for the two D4 evidence layers
> fixed by the proof contract
> `quellight.stage07d.d4.proof-contract@2` (Amendment 1).

## Part 1 — The bounded structured session (Layer A)

### What will run

The harness `scripts/run-d4-structured-session.mjs` drives the REAL
application against the pinned provider profile
(`ollama-cloud/glm-5.3-flash` at `https://ollama.com/v1`) in a dedicated
disposable data directory outside the repository. It performs the
structural proof points A1–A13 (contract §2): conversation usable,
deliberate meaning preservation (ceremony confirmation or direct Save —
both are valid), no agent-canonical records, restart survival, fresh-
conversation receipt, exclusion of pending/removed material, the quiet
commitment-conflict behavior, a truthful in-scope export, removal and
conversation-only deletion of DEDICATED `d4-proof-*` records only, complete
and truthful reconciliation, transcript hygiene, and evidence hygiene.

### Bounds (enforced BEFORE each provider transport)

One session: ≤ 45 minutes; ≤ 5 of your user turns; ≤ 20 provider
requests; ≤ 2048 output tokens per request; ≤ 120 s per-turn deadline;
zero retries; no fallback.

### Before you authorize

1. Think of a **low-sensitivity durable fact about yourself** (e.g., a
   working preference) and a matching commitment you are willing to use
   for the proof. Write them in a scenario file OUTSIDE the repository,
   e.g. `%TEMP%\d4-scenario.json`:

```json
{
  "chatter": "…ordinary small talk…",
  "durableRemember": "…please remember this about me: <your durable fact>…",
  "durableSecond": "…restate the same commitment in your own words…",
  "ordinaryFollowup": "…an ordinary follow-up question…",
  "freshProbe": "…ask something the durable fact would help answer…",
  "preservedNote": "…a short note to preserve…",
  "removableNote": "…a short note you will remove during the proof…"
}
```

The file's content stays in memory only — it is never printed,
logged, or committed. Only its SHA-256 digest (kept in memory) feeds
the leak scanners.

2. Have your provider credential reachable through the OWNER-DESIGNATED
   authentication boundary (the credential file the Q6 live precedent
   used; the environment variable is accepted as a secondary source).
   Presence is checked only — the value is held in memory for the
   pinned transport and never printed, hashed, persisted, reported, or
   copied into the proof workspace.

### Authorization (exact text)

> I authorize ONE Quellight D4 structured real-use session. It will run
> the real application against the pinned provider profile
> `ollama-cloud/glm-5.3-flash`, resolving my provider credential
> through the owner-designated authentication boundary — presence
> checked only, held in memory for the pinned transport, never printed,
> hashed, persisted, reported, or copied into the proof workspace. It
> will use a dedicated proof data directory outside the repository; my
> normal Quellight data and VICT `.pi/` data are not touched. Bounds:
> one session of at most 45 minutes, at most 5 of my user turns, at
> most 20 provider requests, at most 2048 output tokens per request,
> no retries and no fallback. I will supply the scenario file myself
> and it will never be committed. Evidence will be structural outcomes
> only — no conversation content, no credentials, no absolute paths.
> Required proof points complete through my own governed actions and
> deterministic application behavior; what the model drafts or calls
> is recorded only as observation. If the provider fails before the
> scenario begins, the session is sealed as failed and I may authorize
> one fresh session with a new receipt. Everything is cleaned up
> afterwards; a receipt records that the authorization was consumed.
> — Owner, [date]

### Running it

```
set QUELLIGHT_D4_STRUCTURED=1
set QUELLIGHT_D4_SCENARIO_FILE=<path to your scenario file>
node --import tsx scripts/run-d4-structured-session.mjs
```

What happens: the harness refuses unless the flag is set, the receipt
`docs/report/evidence/d4-structured-session-receipt.json` is absent, a
credential is present, and all three active output paths — the receipt,
the evidence summary `docs/report/evidence/d4-structured-session-
evidence.json`, and the cleanup record
`docs/report/evidence/d4-structured-session-evidence.json.cleanup.json` —
are absent (a file at any of them means a previous attempt's bundle has
not been archived yet, and the harness refuses before anything is
consumed or created). Then it consumes the receipt (one-shot), runs the
proof points, seals `docs/report/evidence/d4-structured-session-
evidence.json` (structural outcomes only), removes its workspace, and
records the cleanup result in
`docs/report/evidence/d4-structured-session-evidence.json.cleanup.json`.
Every evidence or cleanup-record write is exclusive-create and fails
closed: a run whose own evidence or cleanup result could not be durably
recorded can never report success (non-zero exit). If anything fails —
including a frozen bounds being exceeded — the seal carries the complete
structural accounting (phase, stable failure class, provider-request
count, transport/header/bytes facts, turn settlement, elapsed time) and
says so truthfully; a failed session is a valid, truthful result, not a
hidden error.

A consumed receipt prevents rerun. Each attempt is handled as ONE atomic
bundle: the receipt, the evidence summary, and the cleanup record belong
together. To close an attempt, archive all of its files that exist as a
byte-identical, immutably named set — e.g.
`d4-structured-session-receipt.attempt-N.json`,
`d4-structured-session-evidence.attempt-N.json`, and, when present,
`d4-structured-session-evidence.attempt-N.cleanup.json` — record the
mapping additively (decision register), state a new authorization line,
and run again; the fresh authorization can then create exactly one new
attempt because all active paths are absent. Never archive the evidence
without the receipt, or the receipt without the evidence.

## Part 2 — The organic-use observation window (Layer B)

No harness runs. Use Quellight normally, on a real low-sensitivity
subject of your choice, on your normal data directory.

**Smallest defensible window:** three genuine sessions, across at least
two separate application launches on at least two calendar days,
including at least one restart and at least one genuinely fresh
conversation. You may extend it; do not shorten it below one session.

**Rules:** conversation wording is never committed; you may exclude any
private event from the record without giving a reason; nothing except
structural metadata (session/launch/restart/fresh-conversation counts)
and your observation answers below is recorded.

After the window, answer (privately or in your own notes — the eight
observation answers are the evidence):

1. Did continuity actually help?
2. Was remembered meaning accurate?
3. Was the confirmation burden reasonable?
4. Did conflict handling interrupt natural conversation?
5. Could you understand and control memory?
6. Did restart preserve trust?
7. Did deletion/export behave as the UI claimed?
8. Was there noticeable friction or latency?

The documented backup/recovery limitations disclosure (MSTR-012) carries
the standing truth: nothing can claim that OS/file backups or external
copies were deleted; `VACUUM` reclaims space only inside the
application's own database file.

## Verification before requesting authorization

`npm run verify:d4-prep` must be green: 23+ offline checks proving the
authorization gate (absent / reused / malformed), the before-transport
bounds, the leak scanners, the fail-closed seal, the false-claim
refusals, the truthful failure path, the cleanup, the workspace policy,
and the static no-provider-access property — all over synthetic
evidence only.
