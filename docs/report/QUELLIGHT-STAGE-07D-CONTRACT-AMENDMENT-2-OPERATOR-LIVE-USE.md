# Quellight Stage 07D — Contract Amendment 2: Operator Live-Use Startup

**Status:** FROZEN as `quellight.stage07d.operator-live-use@1` (this document).
**Date:** 2026-09-23. **Authority:** owner instruction after the product-readiness
finding that the ordinary `npm run dev` startup runs the offline fixture only,
so the owner's attempted organic-use session could not use the live provider.

## 1. Finding

The only live-provider seam in the released source is the proof-only
`QUELLIGHT_LIVE_PROOF=1` gate used by the Q6 and D4 verification harnesses.
Ordinary `npm run dev` composes `offline-fixture`; every message truthfully
answers "Offline deterministic fixture — no live provider call" and no
assistant response can ever come from the provider. There was no supported
normal-use live startup path. This is a Stage 07D product-readiness defect,
not user misconfiguration.

## 2. The amended surface (frozen)

1. **Supported normal-use live startup command.** `npm run dev:live` — the
   ordinary Vite dev server composed with the live provider, the normal
   operator store, and the pinned profile. It is the ONLY supported
   ordinary live-use startup path; running Vite directly with hand-written
   environment is not supported.
2. **Seam separation.** The operator live-use mode is requested through the
   new environment seam `QUELLIGHT_OPERATOR_LIVE=1`. It is entirely
   separate from `QUELLIGHT_LIVE_PROOF` and from ALL D4 receipt, evidence,
   and cleanup machinery: no D4 code path reads it, and setting both live
   seams in one environment is a fail-closed configuration error
   (`VICT_OPERATOR_CONFIG_INVALID`). The proof-only seam is unchanged.
3. **Credential resolution through the existing owner-designated boundary.**
   In operator live-use mode the composition resolves the provider
   credential, in this order:
   (a) the protected operator credential environment variable
   (`OLLAMA_API_KEY`) through the closed VICT operator-configuration
   foundation, exactly as the proof seam does today; then
   (b) the owner-designated authentication boundary file (the Q6/D4
   precedent: the `.ollama.key` field of `~/.pi/agent/auth.json`),
   read in memory at composition time. The value is injected only as
   the provider environment value the pinned model router reads BY
   VARIABLE NAME; it is never logged, serialized, persisted, echoed in
   an error, or printed. The owner is never asked to paste it.
4. **Fail closed, clearly.** If neither source resolves, or the boundary
   file is absent, unreadable, malformed, or missing the designated field,
   composition refuses with the stable code
   `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` and an operator-facing
   explanation. There is NO fallback to the offline fixture in a live
   request: an application that cannot run live states so truthfully (the
   health boundary answers `503` with the stable code and the UI shows
   Unavailable). Provider unavailability at turn time settles the turn
   truthfully failed through the existing turn machinery.
5. **Pinned profile, no silent fallback.** The operator live-use mode uses
   exactly the one pinned Stage 07B profile `ollama-cloud/glm-5.3-flash`.
   Provider rotation, retries, and fallback do not exist. The existing
   `QUELLIGHT_PROFILE` refusal is unchanged.
6. **Normal operator store.** The operator live-use mode composes with the
   default operator data location (`.quellight-data`) — this path is for
   genuine owner use. The verification-isolation seam
   (`QUELLIGHT_DATA_DIR_ABSOLUTE`) remains the ONLY way to point the
   application at a task-owned store and keeps its fail-closed refusals
   (never the default operator directory, never inside the repository).
7. **Deterministic offline mode preserved.** The default composition
   (ordinary `npm run dev`, `npm test`, every verification gate) remains
   `offline-fixture` with the credential never resolved. No existing
   offline behavior, contract, bound, or gate is weakened.
8. **Truthful mode disclosure.** The runtime self-description (`/api/health`)
   and the workspace UI continue to disclose exactly the composed mode —
   `Live`, `Offline deterministic fixture — no live provider call`, or
   `Unavailable` — from the same composition field; no new disclosure
   vocabulary is introduced. The closed mode vocabulary remains
   `offline-fixture | live`; `Unavailable` is a UI/health state of a failed
   or unresolvable composition, not a third composition mode.
9. **Proof discipline (this amendment).** The live provider path is proven
   offline through the established loopback transport stand-in (the pinned
   endpoint URL is intercepted in-process; no real provider request
   leaves the machine), over a task-owned store; the proof asserts live
   selection, exactly the expected provider request, the assistant
   response produced through the real adapter path, credential presence
   in the transport in memory only, and that the default operator data
   directory is never created or touched by the proof.

## 3. Non-goals

No change to the D4 proof contract `@2`, its bounds, receipts, evidence, or
gates; no new provider, profile, or fallback; no change to the organic-use
window definition (Layer B remains harness-free normal use of the
application by the owner).
