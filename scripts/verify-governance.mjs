#!/usr/bin/env node
/**
 * Quellight governed-mutation structural conformance gate (Stage 07C
 * Phase Q1). Permanent enforcement: fails when the historical Stage 07B
 * mutation accommodation reappears or the adopted release identity
 * regresses. Complements the runtime negative controls in
 * `test/governed-mutation.test.ts` with structural, module-graph
 * evidence.
 *
 * Fails if:
 *  - any route (+server.ts) imports the SQLite store modules or the VICT
 *    store package (direct governed-table writes from a route);
 *  - any route references the adapter mutation boundary directly;
 *  - the retired parallel mutation shortcut (`sharedWorldActionBoundary`)
 *    is re-added to the composition;
 *  - an effectful action identifier referenced by the UI is not declared
 *    in the compiled plan (undeclared effectful action);
 *  - any VICT dependency is not the exact coordinated 0.3.0-rc.1 release pin;
 *  - the lockfile resolves any dependency outside the public registry;
 *  - YAML presence is treated as governance evidence (no YAML file or
 *    YAML parser participates in the application definition);
 *  - the released mutation boundary is not genuinely installed from the
 *    public `@victframework/server` package (no local-checkout stand-in).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createRequire } from 'node:module';
// Run with `node --import tsx` so the typed definition compiles in-process:
// the gate re-derives the compiled plan from the AUTHORITATIVE definition
// (no YAML, no snapshot) through the installed released packages.
import { getCompiledPlan } from '../src/lib/application/definition.ts';
import {
  CONTENT_ID,
  EXPECTED_VERSION,
  RELEASE_IDENTITY,
  checkReleaseSetCompatibility,
} from './lib/release-set.mjs';

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const failures = [];
const note = (message) => console.log(`  ${message}`);
const fail = (message) => {
  failures.push(message);
  console.error(`  FAIL: ${message}`);
};

console.log('verify:governance — governed mutation boundary structural conformance');
console.log(`release identity: ${RELEASE_IDENTITY}`);

const collectFiles = (root, filter) => {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else if (filter(full)) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
};

// 1. Route module-graph: no direct store writes, no adapter shortcuts.
console.log('\n[1] route module-graph (no direct store or adapter access from routes)');
const routeFiles = collectFiles(join(repoRoot, 'src', 'routes'), (file) =>
  file.endsWith('+server.ts'),
);
const routeForbidden = [
  { pattern: /node:sqlite/, label: 'node:sqlite import' },
  { pattern: /store-sqlite/, label: 'store-sqlite import' },
  { pattern: /\$lib\/sharedworld\/sqlite/, label: 'Shared World SQLite module import' },
  { pattern: /DatabaseSync/, label: 'direct DatabaseSync use' },
  { pattern: /adapter\.(mutate|query)\(/, label: 'direct adapter effect call' },
  { pattern: /sharedWorldActionBoundary/, label: 'retired parallel mutation shortcut' },
  { pattern: /INSERT\s+INTO|UPDATE\s+\w+\s+SET/, label: 'inline SQL write' },
];
for (const file of routeFiles) {
  const content = readFileSync(file, 'utf8');
  for (const { pattern, label } of routeForbidden) {
    if (pattern.test(content)) {
      fail(`${file.replace(repoRoot + sep, '')}: route contains ${label}`);
    }
  }
}
note(`${routeFiles.length} server routes scanned — no direct store/adapter effect path`);

// 2. The retired Stage 07B accommodation stays retired.
console.log('\n[2] retired Stage 07B accommodation (no parallel mutation shortcut)');
for (const rel of ['src/lib/server/composition.ts', 'src/lib/server/application-server.ts']) {
  const content = readFileSync(join(repoRoot, rel), 'utf8');
  if (content.includes('sharedWorldActionBoundary')) {
    fail(`${rel}: the retired parallel mutation shortcut reappeared`);
  }
}
note('the composition exposes no parallel mutation shortcut (Q1 retirement held)');

// 3. The ingress crosses the released command boundary (one effect path).
console.log('\n[3] ingress crosses the released app.data command boundary');
{
  const content = readFileSync(
    join(repoRoot, 'src', 'lib', 'server', 'application-server.ts'),
    'utf8',
  );
  for (const required of [
    /command:\s*'app\.data\.mutate'/,
    /command:\s*'app\.data\.query'/,
    /commandService\.dispatch\(/,
    /expectedActionRevision/,
    /mutation:\s*\{/,
  ]) {
    if (!required.test(content)) {
      fail(`application-server.ts: the governed command request shape is missing (${required})`);
    }
  }
  const composition = readFileSync(
    join(repoRoot, 'src', 'lib', 'server', 'composition.ts'),
    'utf8',
  );
  for (const required of [
    /resolveAction:\s*resolveCompiledMutationAction/,
    /resolveInputContract:\s*resolveCompiledInputContract/,
    /getCompiledPlan\(\)/,
  ]) {
    if (!required.test(composition)) {
      fail(`composition.ts: the released boundary resolver wiring is missing (${required})`);
    }
  }
}
note('/api/act ingress dispatches app.data.mutate/app.data.query with plan-resolved identity');

// 4. Every UI-referenced effectful action is declared in the compiled plan.
console.log('\n[4] undeclared-effectful-action gate (UI identifiers ⊆ compiled plan)');
{
  const islandFiles = collectFiles(join(repoRoot, 'src', 'lib', 'islands'), (file) =>
    file.endsWith('.svelte'),
  );
  const pageFiles = collectFiles(join(repoRoot, 'src', 'routes'), (file) =>
    file.endsWith('+page.svelte'),
  );
  const referenced = new Set();
  for (const file of [...islandFiles, ...pageFiles]) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/'(act\.[A-Za-z0-9_.-]+)'/g)) {
      referenced.add(match[1]);
    }
  }
  const declaredActions = new Set(Object.keys(getCompiledPlan().actions));
  for (const id of referenced) {
    if (!declaredActions.has(id)) {
      fail(`UI-referenced action '${id}' is not declared in the compiled plan`);
    }
  }
  note(
    `${referenced.size} UI-referenced action identifier(s) all declared: ${[...referenced].join(', ') || '(none)'}`,
  );
}

// 5. Dependency graph: exact 0.3.0-rc.1 coordinated set, registry-only.
console.log('\n[5] dependency-graph conformance');
{
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8'));
  const declared = new Map(
    Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies }).filter(
      ([name]) => name.startsWith('@victframework/'),
    ),
  );
  const installed = new Map();
  for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
    if (key.startsWith('node_modules/@victframework/')) {
      installed.set(key.replace('node_modules/', ''), entry.version);
    }
  }
  const findings = checkReleaseSetCompatibility({ declared, resolved: installed });
  if (findings.length > 0) {
    for (const finding of findings) {
      fail(finding);
    }
  } else {
    note(
      `all declared and installed VICT members at exactly ${EXPECTED_VERSION} (content identity ${CONTENT_ID.slice(0, 18)}… re-derived)`,
    );
  }
  for (const forbidden of ['workspace:', 'file:', 'link:', 'git+', 'github:']) {
    if (JSON.stringify(lockfile).includes(forbidden)) {
      fail(`lockfile contains forbidden protocol marker "${forbidden}"`);
    }
  }
}

// 6. YAML presence is never governance evidence.
console.log('\n[6] YAML is not treated as governance evidence');
{
  const yamlInSrc = collectFiles(join(repoRoot, 'src'), (file) => /\.ya?ml$/i.test(file));
  if (yamlInSrc.length > 0) {
    fail(`YAML files participate in the product source: ${yamlInSrc.join(', ')}`);
  }
  const definition = readFileSync(
    join(repoRoot, 'src', 'lib', 'application', 'definition.ts'),
    'utf8',
  );
  if (/yaml/i.test(definition)) {
    fail('the authoritative Application Definition references YAML semantics');
  }
  note('authoritative representation is the typed definition + compiled plan; no YAML file used');
}

// 7. The adopted 0.3.0-rc.1 boundary is genuinely installed (no local stand-in).
console.log('\n[7] released boundary provenance (public package, not a local checkout)');
{
  const entry = require.resolve('@victframework/server');
  const packageDir = entry.replace(/\\/g, '/').split('/dist/')[0];
  const serverPackage = JSON.parse(readFileSync(join(packageDir ?? '', 'package.json'), 'utf8'));
  if (serverPackage.version !== EXPECTED_VERSION) {
    fail(
      `installed @victframework/server is ${serverPackage.version}, expected ${EXPECTED_VERSION}`,
    );
  }
  const resolvedFile = entry;
  if (!resolvedFile.replace(/\\/g, '/').includes('/260909-VCT-Quellight/node_modules/')) {
    fail(`@victframework/server resolves outside Quellight's node_modules: ${resolvedFile}`);
  }
  const appRemote = require.resolve('@victframework/server');
  if (/260831-VCT-02|packages\/server\/src/.test(appRemote.replace(/\\/g, '/'))) {
    fail('a VICT repository checkout leaked into dependency resolution');
  }
  note(
    `@victframework/server@${serverPackage.version} resolves inside Quellight's node_modules (no local checkout)`,
  );
}

console.log('');
if (failures.length > 0) {
  console.error(`verify:governance: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log('verify:governance: PASS — governed mutation boundary structural conformance proven.');
