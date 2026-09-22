/** D-Q6-15: spell out closed encodings without changing the capability contract. */
export const QLT_PROPOSAL_FIELD_GUIDANCE =
  'When drafting a claim, content.epistemicType must be exactly one of E1, E2, E3, E4, E5, E6, E7; ' +
  'content.honestyState must be exactly known, likely, uncertain, stale, or conflicted; ' +
  'content.confidence must be exactly stated, qualified, or uncertain. Do not invent enum values. ' +
  'For an open_loop, content.loopKind must be exactly pending_action, undecided_question, or expected_event. ' +
  'After drafting, answer the user briefly and naturally without describing internal deliberation.';
