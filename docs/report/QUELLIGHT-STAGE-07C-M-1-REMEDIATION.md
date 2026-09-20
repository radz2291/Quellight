# Quellight Stage 07C — VICT-M-1 Remediation Record

**Status:** Implemented on the adopted verification candidate
`@victframework/*@0.3.0-rc.1` (`vict-release-set@1/0.3.0-rc.1`). M-1 is
**REMEDIATED — AWAITING INDEPENDENT VERIFICATION** (not verified, not
closed). Q5 remains formally closed; Phase Q6 remains not begun; no
live-provider behavior was added.

**Date:** 2026-09-21.
**Framework contract:** VICT
`docs/report/VICT-M-1-REMEDIATION-CONTRACT.md` (freeze `06672de…`).
**Quellight commits of this task:**

| Commit        | Subject                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `c55489f…`    | `feat(agent): adopt vict-release-set@1/0.3.0-rc.1 and the truthful write-effect capability` |
| `0fb4050…`    | `test(agent): permanent M-1 quiet-write integration evidence`                               |
| (this commit) | documentation and status                                                                    |

## 1. Old and new behavior

- OLD: the pinned capability `qlt.proposal.draft@1` created a durable,
  epistemically inert pending proposal row while declaring
  `effect: 'read'` (the Q3-era disclosure, preserved in the historical
  Q3 freeze). The false class was the only reason the 0.2.0 default
  policy kept the capability quiet. Old-tree negative control (disposable
  worktree at `1d1c9f6…`, published 0.2.0 from the public registry):
  the real offline conversation recorded `effect=read`, revision `1`,
  with NO decision evidence and zero approval rows; flipping ONLY the
  declaration to `write` produced a pending approval and a turn in
  `awaiting-approval`.
- NEW: `qlt.proposal.draft@2` truthfully declares `effect: 'write'`
  (the durable row creation IS a write; `idempotency: 'keyed'`
  unchanged). The composition supplies the EXACT host-owned
  quiet-write approval policy through the trusted bridge-dependency
  channel; the bridge durably records the decision evidence on every
  invocation; the envelope stays quiet without any approval ceremony
  and without weakening any other governed stage.

## 2. Authority model (as integrated)

- The quiet-write policy is a single EXACT entry —
  `{ capabilityId: 'qlt.proposal.draft', capabilityRevision: '2' }`
  under `policyIdentity: 'qlt.host-policy.quiet-write@1'` — supplied
  ONLY through `CapabilityBridgeDeps.quietWriteApprovals` in
  `src/lib/server/composition.ts`. There is no path to it from
  `CapabilityDefinition`, packs, model output, tool input, or profile
  content; the capability cannot exempt itself; no wildcard form
  exists; `irreversible` targets are refused at tool-build time with
  stable non-echoing codes.
- VICT records its own closed-code disposition basis
  (`host-policy-write-without-separate-approval`) and the versioned
  policy semantics identity (`vict-effect-policy@1`) — never the host
  policy content.
- Agent profile revision advanced `3` → `4` (content-derived activation
  identity changes with the pinned capability revision; discipline
  preserved). The agent envelope remains EXACTLY the one proposal-draft
  capability with no read/list/search/decision power.

## 3. Durable evidence (observed through the real composition)

Every new proposal-draft invocation records, immutably from intent
onward: `effect: 'write'`, `approvalRequired: false`,
`approvalDisposition: 'host-policy-write-without-separate-approval'`,
`effectPolicyIdentity: 'vict-effect-policy@1'`. A quiet write creates
ZERO approval rows, ZERO approver identities, and ZERO
`tool.awaiting_approval` events; intent, keyed idempotency, claim,
fence, settlement, replay, restart reconciliation, and truthful
`outcome_unknown` are unchanged. Proposal creation remains epistemically
inert; only later explicit user confirmation produces canonical Shared
World meaning.

## 4. Negative controls (Quellight side)

- `test/m1-truthful-effect.test.ts` (permanent): through the REAL
  composition and the real offline conversation path — truthful evidence
  recorded; zero approval records/events; turn completed (never
  suspended); governed chain intact (`runFenceToken`, settlement);
  exactly one pending proposal with server-derived provenance; zero
  canonical records; transcript intact (quiet path).
- The permanent identity gates (`composition`, `context-injection`,
  `governed-mutation`) now pin the new recorded identity and FAIL on
  drift — verified by first failing on the old values.
- The agent still cannot confirm, reject, amend, withdraw, correct, or
  canonically apply proposals (existing `ceremony-authority`,
  `proposal-capability`, and `memory-authority` suites pass unchanged).
- Conversation/composer remain uninterrupted: browser-check,
  browser-stop-check, and the TEST-1 real-browser ceremony all pass in
  the authoritative ladder (the real offline ceremony exercised the
  changed model-visible description once through the real bridge).

## 5. Verification

- Focused: `test:node` 18 files / 243 tests green (including the new
  M-1 suite); `npm run check` green; format green.
- Pre-ladder verifier pre-flights all green: `verify:consumer`
  (registry-only 0.3.0-rc.1 + N-2 negative control), `verify:q2` (179),
  `verify:q3` (34), `verify:q4` (41), `verify:q5` (86),
  `verify:governance`.
- **Authoritative ladder ran EXACTLY ONCE, first-run green** at
  `0fb4050…` (clean tree), 2026-09-21: `npm ci` (exit 0);
  `verify:consumer` (exit 0); `verify:quellight` (exit 0 — format,
  typecheck, governance, q2/q3/q4/dev-start/q5, node tests 18/243,
  UI tests, production build + closed-allowlist warning scan, real
  browser check, real-browser Stop regression, TEST-1 real-browser
  ceremony, artifact scan 220 files, `git diff --check`); `npm audit
--omit=dev` (exit 0, 0 vulnerabilities); `git diff --check` (exit 0).

## 6. Pins and lockfile

- `package.json`: 9 runtime dependencies + `@victframework/scaffolder`
  devDependency at EXACT `0.3.0-rc.1`; lockfile regenerated through
  public-registry installation only; 44 lockfile entries at
  `0.3.0-rc.1`; no workspace/file/link/git fallback anywhere
  (`verify:consumer` enforces permanently).

## 7. Limitations

- `0.3.0-rc.1` is a pre-verification candidate; the stable `0.3.0`
  release (through the same workflow) and the Quellight stable repin
  are separate post-verification decisions. `latest` remains `0.2.0`.
- The workflow's own post-publication verify step failed on npm CDN
  propagation lag immediately after publishing (publication itself
  succeeded); independent verification proved all 13 versions, tags,
  and integrity values equal to the run's packed artifacts. Recorded
  honestly in VICT `docs/report/VICT-M-1-REMEDIATION-IMPLEMENTATION.md`.
- The successful-ladder timestamps, run id `35530894104`, and the
  registry state are reproducible from the recorded commands.
