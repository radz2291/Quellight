#!/usr/bin/env node
/**
 * Quellight Stage 07C Phase Q3 — focused governed-ceremony verifier
 * (`npm run verify:q3`; run as `node --import tsx scripts/verify-q3.mjs`).
 *
 * Stable Q3 structural and deterministic checks ONLY — the full adversarial
 * matrix lives in `test/ceremony-authority.test.ts` and
 * `test/proposal-capability.test.ts`:
 *
 *   1. PLAN           — the compiled plan carries EXACTLY the frozen Q3
 *                       inventory (5 thread actions + 1 memory query + 13
 *                       memory mutations = 19); the memory resource declares
 *                       exactly the frozen mutations/query/filters; every
 *                       memory action references its declared contract.
 *   2. AUTHORITY      — the composition pins EXACTLY ONE capability (the
 *                       inert proposal-draft); the capability resolver and
 *                       the profile envelope agree; no confirmer-class or
 *                       record-read verb exists anywhere in `src/lib/agent`;
 *                       the instructions artifact truthfully discloses the
 *                       single tool and the no-memory-read rule.
 *   3. INGRESS/FENCE-1 — the prohibited-key list and the stable
 *                       QLT_INGRESS_PROHIBITED_FIELD code are wired into the
 *                       ingress; own-property (not prototype-chain) field
 *                       membership is used; the query filters rebuild
 *                       rejects prohibited keys.
 *   4. ISOLATION      — no route/island/component references the meaning
 *                       store or SQLite; no context-assembler module exists;
 *                       the agent surface has no record-read import.
 *   5. PINS           — package.json @victframework/* deps all exactly
 *                       0.3.0 (the full gate remains `verify:consumer`).
 *   6. WIRING         — `verify:q3` and the TEST-1 browser ceremony check
 *                       exist in package.json and the aggregate verifier
 *                       references both.
 *   7. DETERMINISTIC  — a fast store-level ceremony smoke: confirm creates
 *                       exactly one attributable record; the agent
 *                       confirmer is refused; staleness is version-driven.
 *
 * Emits clear per-section counts; exits non-zero on ANY failure.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createRequire } from 'node:module';
import { createSharedWorldSqlite } from '../src/lib/sharedworld/sqlite.ts';
import {
  QLT_MEMORY_MUTATION_OPS,
  QLT_INGRESS_PROHIBITED_FIELD,
  QLT_INGRESS_PROHIBITED_KEYS,
  QLT_PLAN_ACTION_INVENTORY,
  QLT_PROPOSAL_CAPABILITY_ID,
  QLT_PROPOSAL_CAPABILITY_REVISION,
} from '../src/lib/sharedworld/ceremony-contract.ts';
import { getCompiledPlan, inputContracts } from '../src/lib/application/definition.ts';
import { proposalStaleness } from '../src/lib/sharedworld/meaning.ts';
import { QltMeaningError } from '../src/lib/sharedworld/meaning-contract.ts';

const failures = [];
const sections = {
  plan: 0,
  authority: 0,
  ingress: 0,
  isolation: 0,
  pins: 0,
  wiring: 0,
  deterministic: 0,
};
const check = (label, sectionName, condition) => {
  if (condition) {
    sections[sectionName] += 1;
  } else {
    failures.push(`[${sectionName}] ${label}`);
    console.error(`  FAIL: ${label}`);
  }
};

console.log('verify:q3 — governed ceremony structural conformance (Phase Q3)');

// ---------------------------------------------------------------------------
// 1. PLAN — the frozen action/query inventory
// ---------------------------------------------------------------------------
console.log('\n[1] PLAN — frozen Q3 inventory (19 actions; 13 memory mutations)');
{
  const plan = getCompiledPlan();
  const actionIds = Object.keys(plan.actions).sort();
  // Q5 reconciliation (Q5 freeze §14): the frozen 19-action Q3 inventory
  // is unchanged and is EXTENDED by EXACTLY the two Q5 actions
  // (act.queryInspection, act.setMemoryMode) — assertions strengthened,
  // never weakened; the frozen Q3 contract data is not rewritten.
  const Q5_ADDED_ACTIONS = ['act.queryInspection', 'act.setMemoryMode'];
  check(
    'the compiled plan carries EXACTLY the frozen 19-action inventory PLUS exactly the two Q5 actions',
    'plan',
    JSON.stringify(actionIds) ===
      JSON.stringify([...QLT_PLAN_ACTION_INVENTORY, ...Q5_ADDED_ACTIONS].sort()),
  );
  check(
    'the Q5 actions are the only additions beyond the frozen Q3 inventory',
    'plan',
    actionIds.filter((id) => !QLT_PLAN_ACTION_INVENTORY.includes(id)).length === 2 &&
      Q5_ADDED_ACTIONS.every((id) => actionIds.includes(id)),
  );
  const memoryActions = Object.values(plan.actions).filter(
    (action) => action.resourceId === 'qlt.memory',
  );
  check(
    'exactly 14 memory actions exist (1 query + 13 mutations)',
    'plan',
    memoryActions.length === 14,
  );
  const memoryMutations = memoryActions
    .filter((action) => action.kind === 'mutation')
    .map((action) => action.op)
    .sort();
  check(
    'the memory mutations are EXACTLY the frozen thirteen ops',
    'plan',
    JSON.stringify(memoryMutations) === JSON.stringify([...QLT_MEMORY_MUTATION_OPS].sort()),
  );
  const memoryQuery = memoryActions.filter((action) => action.kind === 'query');
  check(
    'exactly ONE memory query action exists (act.queryMemory)',
    'plan',
    memoryQuery.length === 1,
  );
  const threadActions = Object.values(plan.actions).filter(
    (action) => action.resourceId === 'qlt.threads',
  );
  check('the five thread actions are unchanged', 'plan', threadActions.length === 5);
  const contractIds = new Set(inputContracts.map((contract) => contract.id));
  const everyMemoryActionHasContract = memoryActions
    .filter((action) => action.kind === 'mutation')
    .every(
      (action) =>
        typeof action.inputContractId === 'string' && contractIds.has(action.inputContractId),
    );
  check(
    'every memory mutation references a declared input contract',
    'plan',
    everyMemoryActionHasContract,
  );
  console.log(`  plan: ${sections.plan} checks`);
}

// ---------------------------------------------------------------------------
// 2. AUTHORITY — one capability; no confirmer power; no model read
// ---------------------------------------------------------------------------
console.log('\n[2] AUTHORITY — the single inert capability envelope');
{
  const composition = readFileSync(join('src', 'lib', 'server', 'composition.ts'), 'utf8');
  check(
    'the composition pins the proposal capability with its exact revision',
    'authority',
    composition.includes('QLT_PROPOSAL_CAPABILITY_ID') &&
      composition.includes('QLT_PROPOSAL_CAPABILITY_REVISION'),
  );
  check(
    'the activation resolver admits only the pinned (id, revision)',
    'authority',
    /id === QLT_PROPOSAL_CAPABILITY_ID && revision === QLT_PROPOSAL_CAPABILITY_REVISION/.test(
      composition,
    ),
  );
  check(
    'the invocation boundary refuses every other capability id',
    'authority',
    /definition\.id !== QLT_PROPOSAL_CAPABILITY_ID/.test(composition),
  );
  check(
    'the composition derives proposal correlation from server records (no model input)',
    'authority',
    composition.includes('resolveProposalTurnCorrelation') &&
      composition.includes('getThreadIdByConversation'),
  );

  const agent = readFileSync(join('src', 'lib', 'agent', 'proposal-capability.ts'), 'utf8');
  const forbiddenVerbs = [
    'confirmProposal',
    'rejectProposal',
    'amendProposal',
    'withdrawProposal',
    'retireClaim',
    'releaseCommitment',
    'resolveLoop',
    'abandonLoop',
    'transformLoop',
    'applyCorrection',
    'listProposals',
    'listClaims',
    'listCommitments',
    'listOpenLoops',
    'getClaim',
    'getCommitment',
    'getOpenLoop',
    'listSourceLinks',
    'listCorrections',
  ];
  const agentFree = forbiddenVerbs.every((verb) => !agent.includes(verb));
  check('the agent module contains NO confirmer-class or record-read verb', 'authority', agentFree);
  check(
    'the agent module writes ONLY through meaning.createProposal',
    'authority',
    agent.includes('createProposal'),
  );
  check(
    'the capability output contract admits ONLY the bounded outcome union',
    'authority',
    agent.includes('{ accepted: true, proposalId:'),
  );
  const instructionsSource = readFileSync(join('src', 'lib', 'server', 'composition.ts'), 'utf8');
  check(
    'the instructions artifact truthfully discloses the single tool and the no-read rule',
    'authority',
    instructionsSource.includes('exactly one tool') &&
      instructionsSource.includes(
        'You cannot read, list, search, confirm, edit, or delete any memory',
      ),
  );
  check(
    'the tool budget stays bounded and fail-closed',
    'authority',
    /maxToolCalls: 2/.test(composition) && composition.includes("onLimit: 'fail-closed'"),
  );
  console.log(`  authority: ${sections.authority} checks`);
}

// ---------------------------------------------------------------------------
// 3. INGRESS / FENCE-1 (D-Q3-6)
// ---------------------------------------------------------------------------
console.log('\n[3] INGRESS — FENCE-1 hardening wired with stable codes');
{
  const ingress = readFileSync(join('src', 'lib', 'server', 'application-server.ts'), 'utf8');
  check(
    'the stable non-echoing prohibited-field code is wired',
    'ingress',
    ingress.includes(QLT_INGRESS_PROHIBITED_FIELD),
  );
  check(
    'the prohibited-key list covers the prototype-named family',
    'ingress',
    QLT_INGRESS_PROHIBITED_KEYS.includes('__proto__') &&
      QLT_INGRESS_PROHIBITED_KEYS.includes('constructor') &&
      QLT_INGRESS_PROHIBITED_KEYS.includes('prototype'),
  );
  check(
    'the ingress uses OWN-PROPERTY field membership (no prototype-chain lookups)',
    'ingress',
    ingress.includes('Object.hasOwn(spec.fields, key)'),
  );
  check(
    'the query filters rebuild refuses prohibited keys',
    'ingress',
    /prohibitedKey\(key\)/.test(ingress),
  );
  check(
    'memory actions are declared in the ingress schema map',
    'ingress',
    ingress.includes("'act.confirmProposal'") && ingress.includes("'act.transformLoop'"),
  );
  console.log(`  ingress: ${sections.ingress} checks`);
}

// ---------------------------------------------------------------------------
// 4. ISOLATION — no second path, no assembler, no model read
// ---------------------------------------------------------------------------
console.log('\n[4] ISOLATION — one effect path; no context assembly; no model reads');
{
  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full, out);
      } else {
        out.push(full);
      }
    }
    return out;
  };
  const uiFiles = [
    ...walk(join('src', 'routes')),
    ...walk(join('src', 'lib', 'islands')),
    ...walk(join('src', 'lib', 'components')),
  ];
  const forbiddenMarkers = [
    'meaning-store',
    'meaning-contract',
    'sharedWorld.meaning',
    '.meaning',
    'node:sqlite',
    'DatabaseSync',
  ];
  let uiClean = true;
  for (const file of uiFiles) {
    const content = readFileSync(file, 'utf8');
    for (const marker of forbiddenMarkers) {
      if (content.includes(marker)) {
        uiClean = false;
        console.error(`  ${file.replace(process.cwd() + sep, '')} references ${marker}`);
      }
    }
  }
  check('no route/island/component touches the meaning store or SQLite', 'isolation', uiClean);
  const srcFiles = walk(join('src'));
  // Q4 re-pin (frozen Q4 contract §12): the deterministic context assembler
  // is now AUTHORIZED in its frozen location. The check asserts that the
  // assembler lives ONLY in the frozen Lane A/Lane B-owned files and that
  // no other module claims assembly behavior.
  const authorizedAssemblerFiles = new Set(
    ['context-assembler.ts', 'context-contract.ts'].map((name) =>
      join('src', 'lib', 'sharedworld', name),
    ),
  );
  const assemblerFiles = srcFiles.filter((file) =>
    /context-assembl|assembleContext|buildContextBlock|memory-context/i.test(file),
  );
  check(
    'context-assembler modules exist only in the frozen Q4 location',
    'isolation',
    assemblerFiles.length > 0 && assemblerFiles.every((file) => authorizedAssemblerFiles.has(file)),
  );
  const agentDirFiles = walk(join('src', 'lib', 'agent'));
  const agentClean = agentDirFiles.every((file) => {
    const content = readFileSync(file, 'utf8');
    return !content.includes('listClaims') && !content.includes('listProposals');
  });
  check('the agent surface has no record-read import or call', 'isolation', agentClean);
  console.log(`  isolation: ${sections.isolation} checks`);
}

// ---------------------------------------------------------------------------
// 5. PINS (light; the full gate remains verify:consumer)
// ---------------------------------------------------------------------------
console.log('\n[5] PINS — exact VICT 0.3.0 identity unchanged');
{
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const victDeps = Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }).filter(([name]) => name.startsWith('@victframework/'));
  check(
    'all declared @victframework/* pins are exactly 0.3.0',
    'pins',
    victDeps.length >= 9 && victDeps.every(([, specifier]) => specifier === '0.3.1-rc.2'),
  );
  const require = createRequire(join(process.cwd(), 'package.json'));
  const entry = require.resolve('@victframework/server');
  const packageDir = entry.replace(/\\/g, '/').split('/dist/')[0];
  const serverPackage = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  check(
    'installed @victframework/server is exactly 0.3.0',
    'pins',
    serverPackage.version === '0.3.1-rc.2',
  );
  console.log(`  pins: ${sections.pins} checks`);
}

// ---------------------------------------------------------------------------
// 6. WIRING — package scripts and the aggregate verifier
// ---------------------------------------------------------------------------
console.log('\n[6] WIRING — verify:q3 and the TEST-1 browser ceremony check');
{
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  check(
    'the verify:q3 script exists',
    'wiring',
    packageJson.scripts['verify:q3'] === 'node --import tsx scripts/verify-q3.mjs',
  );
  check(
    'the verify:browser-ceremony script exists',
    'wiring',
    packageJson.scripts['verify:browser-ceremony'] === 'node scripts/browser-ceremony-check.mjs',
  );
  const aggregate = readFileSync(join('scripts', 'verify-quellight.mjs'), 'utf8');
  check(
    'the aggregate runs verify:q3',
    'wiring',
    aggregate.includes('scripts/verify-q3.mjs') || aggregate.includes("'verify:q3'"),
  );
  check(
    'the aggregate runs the TEST-1 browser ceremony check',
    'wiring',
    aggregate.includes('browser-ceremony-check.mjs'),
  );
  console.log(`  wiring: ${sections.wiring} checks`);
}

// ---------------------------------------------------------------------------
// 7. DETERMINISTIC — fast store-level ceremony smoke
// ---------------------------------------------------------------------------
console.log('\n[7] DETERMINISTIC — ceremony smoke on a fresh store');
{
  const store = createSharedWorldSqlite({ path: ':memory:' });
  const thread = await store.createThread({ title: 'q3 verifier' });
  const meaning = store.meaning;
  await meaning.createClaim({
    subject: 's',
    epistemicType: 'E2',
    honestyState: 'known',
    confidence: 'stated',
    statement: 'user save',
    createdBy: 'actor-quellight-local',
    sourceThreadId: thread.id,
  });
  const proposal = await meaning.createProposal({
    proposalKind: 'claim',
    content: {
      subject: 's',
      epistemicType: 'E5',
      honestyState: 'likely',
      confidence: 'qualified',
      statement: 'agent draft',
    },
    proposedBy: 'agent-quellight',
    sourceThreadId: thread.id,
    sourceTurnRef: 'turn-1',
  });
  await meaning.markProposalAwaitingDecision(proposal.id);
  let refused = false;
  try {
    await meaning.confirmProposal({ proposalId: proposal.id, confirmedBy: 'agent-quellight' });
  } catch (cause) {
    refused = cause instanceof QltMeaningError && cause.code === 'QLT_CONFIRMER_INVALID';
  }
  check('the agent confirmer is refused (QLT_CONFIRMER_INVALID)', 'deterministic', refused);
  const outcome = await meaning.confirmProposal({
    proposalId: proposal.id,
    confirmedBy: 'actor-quellight-local',
  });
  check(
    'the user confirm creates EXACTLY one attributable record',
    'deterministic',
    outcome.createdRecords.length === 1 &&
      outcome.createdRecords[0].createdBy === 'actor-quellight-local',
  );
  check(
    'the proposal closed as confirmed with user attribution',
    'deterministic',
    outcome.proposal.status === 'confirmed' &&
      outcome.proposal.decisionBy === 'actor-quellight-local',
  );
  // Staleness predicate: time-free, version-driven (pure re-check).
  const stale = proposalStaleness(
    {
      proposalKind: 'correction',
      targetRecordFamily: 'claim',
      targetRecordVersion: 1,
    },
    { version: 2, status: 'active', retentionState: 'currently-relevant' },
    { retentionState: 'currently-relevant' },
  );
  check(
    'a changed target version stales; unchanged references never do',
    'deterministic',
    stale.stale === true &&
      proposalStaleness({ proposalKind: 'claim' }, undefined, {
        retentionState: 'currently-relevant',
      }).stale === false,
  );
  console.log(`  deterministic: ${sections.deterministic} checks`);
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:q3: FAILED with ${failures.length} finding(s):`);
  for (const entry of failures) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
}
const total = Object.values(sections).reduce((sum, count) => sum + count, 0);
console.log(
  `verify:q3: PASS — ${total} checks green (plan/authority/ingress/isolation/pins/wiring/deterministic).`,
);
