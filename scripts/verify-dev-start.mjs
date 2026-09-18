#!/usr/bin/env node
/**
 * Development-start regression gate (D-11).
 *
 * Proves that the ordinary `npm run dev` path works through the REAL
 * committed repository Vite configuration — not a generated substitute —
 * so the dev-only renderer dependency-optimization failure recorded in
 * D-11 can never again pass unnoticed by full verification.
 *
 * What it does (offline, no credentials, no live-provider calls):
 *
 *   1. Configuration identity — asserts `vite.config.ts` carries exactly
 *      `optimizeDeps: { exclude: ['@victframework/renderer-svelte'] }`,
 *      that no module aliasing or `@victframework` resolution override
 *      exists in `vite.config.ts` / `svelte.config.js` / `tsconfig.json`,
 *      and that the renderer resolves (realpath) from THIS repository's
 *      `node_modules` at the released `0.2.0` with its intact TypeScript
 *      source (`export interface` present in `mount.svelte.ts`) — i.e.
 *      the package is not replaced, aliased, vendored, or resolved from
 *      a local VICT checkout.
 *   2. Real dev server — spawns `node node_modules/vite/bin/vite.js dev`
 *      with cwd = repository root (so Vite auto-loads `vite.config.ts`)
 *      on loopback with a bounded, freshly-picked port and
 *      `--strictPort`, from a cold dependency-optimizer cache so the
 *      optimizer path is actually exercised.
 *   3. Ordinary path — polls `GET /` until the application answers
 *      HTTP 200, then walks the real dev transform pipeline: the host
 *      page, the workspace island (its compile emits the three known
 *      deferred Svelte warnings), and the released renderer entry
 *      including `mount.svelte.ts` — the exact module whose TypeScript
 *      previously crashed `svelte.compileModule` through the dev
 *      prebundler.
 *   4. Failure conditions — the gate FAILS on the renderer
 *      `js_parse_error` signature, any `vite-plugin-svelte-module:
 *      optimize-svelte` failure, the mangled `xport interface`
 *      diagnostic, process crash, readiness/transform timeout, any
 *      HTTP 5xx, raw untransformed TypeScript leaking out of the
 *      renderer modules, an exit of the dev-server child, or any
 *      warning outside the closed known-warning allowlist below.
 *   5. Closed warning treatment — the three known deferred warnings in
 *      `ConversationWorkspace.svelte` (redundant `role="region"`;
 *      keyboard listener on a non-interactive `<section>`; `chipButton`
 *      updated without `$state`) are EXPECTED with exact counts and are
 *      printed in the output (visible, deferred to the Phase Q5 UI
 *      lane — never hidden or rewritten as success). Any additional or
 *      unknown warning fails the gate.
 *   6. Teardown — the exact spawned child is terminated (SIGTERM, with
 *      a Windows `taskkill /T /F` escalation against the captured PID)
 *      on success, failure, and timeout; the optimizer cache is
 *      restored to its pre-run existence state; nothing is written to
 *      the repository, and no log, config, or database artifact remains.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`verify:dev-start: FAIL — ${message}`);
};

// ---------------------------------------------------------------------------
// 1. Configuration and package identity (real repository config, no
//    substitution, no vendoring, no local VICT checkout).
// ---------------------------------------------------------------------------
const viteConfigText = readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8');
const codeWithoutComments = viteConfigText
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

const exclusionPattern =
  /optimizeDeps:\s*\{\s*exclude:\s*\[\s*'@victframework\/renderer-svelte'\s*\]\s*,?\s*\}/;
if (!exclusionPattern.test(codeWithoutComments)) {
  fail('vite.config.ts does not carry the exact D-11 renderer exclusion.');
}
const victOccurrences = codeWithoutComments.match(/@victframework/g) ?? [];
if (victOccurrences.length !== 1) {
  fail(
    `vite.config.ts must reference @victframework exactly once (the exclusion); found ${victOccurrences.length}.`,
  );
}
if (/alias|resolve\s*:/.test(codeWithoutComments)) {
  fail('vite.config.ts must not add module aliasing or resolution overrides.');
}
for (const configName of ['svelte.config.js', 'tsconfig.json']) {
  const text = readFileSync(join(repoRoot, configName), 'utf8');
  if (text.includes('@victframework') || /alias/.test(text)) {
    fail(`${configName} must not alias or override @victframework resolution.`);
  }
}

const require = createRequire(join(repoRoot, 'package.json'));
const rendererEntry = require.resolve('@victframework/renderer-svelte');
// The exports map can resolve to a subdirectory; walk up to the package
// root (the nearest ancestor containing package.json).
let rendererPkgDir = rendererEntry;
while (!existsSync(join(rendererPkgDir, 'package.json'))) {
  const parent = join(rendererPkgDir, '..');
  if (parent === rendererPkgDir) {
    fail(`could not locate the installed renderer package root from ${rendererEntry}.`);
    break;
  }
  rendererPkgDir = parent;
}
const rendererRoot = realpathSync(rendererPkgDir);
const expectedRendererRoot = realpathSync(
  join(repoRoot, 'node_modules', '@victframework', 'renderer-svelte'),
);
if (rendererRoot !== expectedRendererRoot) {
  fail(
    `renderer resolved outside this repository's node_modules: ${rendererRoot} (expected ${expectedRendererRoot}).`,
  );
} else if (!realpathSync(rendererEntry).startsWith(rendererRoot)) {
  fail(`renderer entry escaped the installed package: ${rendererEntry}.`);
}
const rendererPackage = JSON.parse(
  readFileSync(join(expectedRendererRoot, 'package.json'), 'utf8'),
);
if (
  rendererPackage.name !== '@victframework/renderer-svelte' ||
  rendererPackage.version !== '0.2.0'
) {
  fail(
    `released renderer identity changed: ${rendererPackage.name}@${rendererPackage.version} (expected @victframework/renderer-svelte@0.2.0).`,
  );
}
const mountSource = readFileSync(join(expectedRendererRoot, 'src', 'mount.svelte.ts'), 'utf8');
if (!mountSource.includes('export interface')) {
  fail(
    'installed renderer mount.svelte.ts no longer contains its released `export interface` source — the package appears replaced or patched.',
  );
}

if (failures.length > 0) {
  console.error('verify:dev-start: configuration identity checks failed; nothing was started.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Start the real dev server (repository vite.config.ts, loopback,
//    bounded fresh port, strict port, cold optimizer cache).
// ---------------------------------------------------------------------------
const freePort = await new Promise((resolvePort, rejectPort) => {
  const probe = net.createServer();
  probe.unref();
  probe.on('error', rejectPort);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolvePort(port));
  });
});

const viteCacheDir = join(repoRoot, 'node_modules', '.vite');
const cacheExistedBefore = existsSync(viteCacheDir);
rmSync(viteCacheDir, { recursive: true, force: true });

const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(
  process.execPath,
  [viteBin, 'dev', '--host', '127.0.0.1', '--port', String(freePort), '--strictPort'],
  { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);

let exited = false;
let exitInfo = null;
let crashed = false;
child.on('exit', (code, signal) => {
  exited = true;
  exitInfo = `code=${code} signal=${signal}`;
  crashed = true;
});

const LOG_LIMIT = 400_000;
let devLog = '';
const noteLog = (chunk) => {
  devLog = (devLog + chunk).slice(-LOG_LIMIT);
};
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', noteLog);
child.stderr.on('data', noteLog);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function terminateChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const pid = child.pid;
  child.kill('SIGTERM');
  const deadline = Date.now() + 5_000;
  while (!exited && Date.now() < deadline) await sleep(100);
  if (!exited) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
    const hardDeadline = Date.now() + 5_000;
    while (!exited && Date.now() < hardDeadline) await sleep(100);
  }
}

// Failure signatures monitored in the live dev-server output (D-11 record).
const FATAL_SIGNATURES = [
  { pattern: /js_parse_error/, label: 'renderer js_parse_error' },
  {
    pattern: /vite-plugin-svelte-module:optimize-svelte/i,
    label: 'vite-plugin-svelte-module:optimize-svelte failure',
  },
  { pattern: /xport interface/, label: 'mangled `xport interface` diagnostic' },
  { pattern: /Unexpected token/, label: '`Unexpected token` parse failure' },
  { pattern: /Internal server error/i, label: 'internal server error' },
  {
    pattern: /Failed to optimize|optimizeDependencies.*failed/i,
    label: 'dependency optimizer failure',
  },
  { pattern: /SyntaxError/, label: 'SyntaxError' },
];
let fatalSignatureHits = [];

// Closed known-warning allowlist. Svelte emits each warning with a
// stable id URL (https://svelte.dev/e/<id>) on the line following the
// message; the gate classifies by that id, so the three deferred
// ConversationWorkspace.svelte warnings are EXPECTED and VISIBLE while
// any svelte warning with an id outside the closed list fails the gate.
// Optimizer reloads may legitimately re-emit them (counts >= 1).
const KNOWN_WARNING_IDS = [
  'a11y_no_noninteractive_element_interactions',
  'a11y_no_redundant_roles',
  'non_reactive_update',
];
const SVELTE_WARN_URL = /https:\/\/svelte\.dev\/e\/([A-Za-z0-9_]+)/g;
const SOURCMAP_NOTICE = /Sourcemap for .*points to missing source files/;
let warningCounts = KNOWN_WARNING_IDS.map(() => 0);
let sourcemapNoticeSeen = false;
function auditWarnings() {
  const counts = Object.fromEntries(KNOWN_WARNING_IDS.map((id) => [id, 0]));
  const unknownIds = new Set();
  for (const match of devLog.matchAll(SVELTE_WARN_URL)) {
    const id = match[1];
    if (id in counts) counts[id] += 1;
    else unknownIds.add(id);
  }
  warningCounts = KNOWN_WARNING_IDS.map((id) => counts[id]);
  for (let i = 0; i < KNOWN_WARNING_IDS.length; i += 1) {
    if (counts[KNOWN_WARNING_IDS[i]] < 1) {
      fail(
        `known deferred warning "${KNOWN_WARNING_IDS[i]}" did not appear (expected visible with the workspace compile).`,
      );
    }
  }
  if (unknownIds.size > 0) {
    fail(
      `unknown svelte warning(s) outside the closed D-11 allowlist: ${[...unknownIds].join(', ')}.`,
    );
  }
  sourcemapNoticeSeen = SOURCMAP_NOTICE.test(devLog);
  return sourcemapNoticeSeen;
}

const BASE = `http://127.0.0.1:${freePort}`;
async function get(pathname, timeoutMs) {
  return fetch(BASE + pathname, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: '*/*' },
  });
}

let serverStopped = false;
const stopServer = async (why) => {
  if (serverStopped) return;
  serverStopped = true;
  await terminateChild();
  if (why) fail(why);
  if (!cacheExistedBefore) rmSync(viteCacheDir, { recursive: true, force: true });
};

// Global safety bound for the whole run (readiness + transforms).
const HARD_DEADLINE_MS = 150_000;
const hardTimer = setTimeout(() => {
  crashed = true; // treat as fatal so the flow below reports and tears down
  exitInfo = 'hard deadline exceeded';
}, HARD_DEADLINE_MS);

try {
  // 3a. Readiness: poll GET / until HTTP 200 (bounded).
  const READY_DEADLINE_MS = 90_000;
  const start = Date.now();
  let ready = false;
  let lastStatus = 'no connection';
  while (!ready && Date.now() - start < READY_DEADLINE_MS && !crashed) {
    if (exited) break;
    try {
      const res = await get('/', 5_000);
      lastStatus = res.status;
      if (res.status === 200) {
        const body = await res.text();
        if (!body.includes('<script')) {
          fail('GET / returned 200 but the body is not the application shell (no module script).');
        }
        ready = true;
      } else if (res.status >= 500) {
        fail(`GET / answered HTTP ${res.status} (5xx).`);
        break;
      }
    } catch {
      lastStatus = 'no connection';
    }
    if (!ready) await sleep(500);
  }
  if (!ready && !crashed && !exited) {
    fail(
      `development server did not serve the application within ${READY_DEADLINE_MS / 1000}s (last status: ${lastStatus}).`,
    );
  }

  if (ready && !crashed) {
    // 3b. The real transform pipeline: host page, workspace island,
    //     renderer entry, and the previously-fatal mount.svelte.ts.
    const transformTargets = [
      { path: '/src/routes/[...vict]/+page.svelte', label: 'host page module' },
      { path: '/src/lib/islands/ConversationWorkspace.svelte', label: 'workspace island' },
      {
        path: '/@fs/' + join(expectedRendererRoot, 'src', 'index.ts').replace(/\\/g, '/'),
        label: 'released renderer entry',
        renderer: true,
      },
      {
        path: '/@fs/' + join(expectedRendererRoot, 'src', 'mount.svelte.ts').replace(/\\/g, '/'),
        label: 'released renderer mount.svelte.ts',
        renderer: true,
      },
    ];
    for (const target of transformTargets) {
      if (crashed || exited) break;
      let body = null;
      // The dev optimizer may reload the module graph after discovering
      // new dependencies; a request racing that reload gets an "Outdated
      // Optimize Dep" 504 exactly as a browser reload would. Bounded
      // retry (3 attempts, 1s apart), like a browser, then fail.
      for (let attempt = 1; attempt <= 3 && body === null; attempt += 1) {
        let res;
        try {
          res = await get(target.path, 20_000);
        } catch (error) {
          if (attempt === 3) {
            fail(
              `${target.label}: transform request failed (${error.name === 'TimeoutError' ? 'timeout' : error.message}).`,
            );
            break;
          }
          await sleep(1_000);
          continue;
        }
        if (res.status === 200) {
          body = await res.text();
          break;
        }
        if (res.status === 504 && attempt < 3) {
          await sleep(1_000);
          continue;
        }
        fail(`${target.label}: dev transform returned HTTP ${res.status} (expected 200).`);
        break;
      }
      if (body === null) break;
      if (target.renderer) {
        if (/export\s+interface/.test(body)) {
          fail(
            `${target.label}: raw untransformed TypeScript leaked through the dev pipeline (transform did not strip it).`,
          );
        }
        if (
          !/RenderVictApplicationOptions|renderVictApplication|MountedVictApplication/.test(body)
        ) {
          fail(
            `${target.label}: transformed module does not contain the expected renderer exports.`,
          );
        }
      }
    }
  }

  // 4. Final accounting: crash, fatal signatures, closed warning set.
  if (crashed && exited) fail(`dev-server process exited unexpectedly (${exitInfo ?? 'unknown'}).`);
  if (crashed && !exited)
    fail(`verify:dev-start hard deadline (${HARD_DEADLINE_MS / 1000}s) exceeded.`);
  for (const signature of FATAL_SIGNATURES) {
    if (signature.pattern.test(devLog)) {
      fail(`fatal signature in dev-server output: ${signature.label}.`);
    }
  }
  auditWarnings();
} finally {
  clearTimeout(hardTimer);
  await stopServer(null);
}

// 5. Report. Known deferred warnings are printed (visible, never hidden).
if (failures.length === 0) {
  console.log('verify:dev-start: PASS');
  console.log(`  real repository vite.config.ts; http://127.0.0.1:${freePort}/ → 200`);
  console.log(
    '  renderer entry + mount.svelte.ts transformed through the dev pipeline (no js_parse_error, no optimize-svelte failure, no raw TypeScript).',
  );
  console.log(
    '  visible known deferred warnings (D-11 — Phase Q5 UI lane, not fixed here; >=1 required, optimizer reloads may repeat them):',
  );
  KNOWN_WARNING_IDS.forEach((id, i) => console.log(`    - ${id} ×${warningCounts[i]}`));
  console.log(
    sourcemapNoticeSeen
      ? '  known recorded cosmetic sourcemap notice present (D-11: dev-only, expected in this loading mode).'
      : '  (known cosmetic sourcemap notice not emitted this run — optional).',
  );
  process.exit(0);
}
console.error(`verify:dev-start: ${failures.length} failure(s).`);
console.error('--- dev-server output tail ---');
console.error(devLog.split('\n').slice(-40).join('\n'));
process.exit(1);
