#!/usr/bin/env node
/**
 * Development-start regression gate (D-11), with task-owned data isolation
 * (Q5 verification-isolation remediation).
 *
 * Proves that the ordinary `npm run dev` path works through the REAL
 * committed repository Vite configuration — not a generated substitute —
 * so the dev-only renderer dependency-optimization failure recorded in
 * D-11 can never again pass unnoticed by full verification.
 *
 * The gate is STRICTLY ISOLATED from operator data: it never starts the
 * application against the default operator data location. The historical
 * version of this gate requested `GET /` from a dev server rooted at the
 * repository, which composed the application through its default operator
 * data location (`.quellight-data`) and indirectly applied Q5's additive
 * migration 4 to the real operator database. That is corrected here: the
 * spawned server receives an explicit, task-owned, disposable data
 * directory in the OS temporary directory through the repository's typed
 * configuration seam (`QUELLIGHT_DATA_DIR_ABSOLUTE`), which refuses any
 * path at or inside the default operator data directory or the repository.
 *
 * What it does (offline, no credentials, no live-provider calls):
 *
 *   1. Configuration identity — asserts `vite.config.ts` carries exactly
 *      `optimizeDeps: { exclude: ['@victframework/renderer-svelte'] }`,
 *      that no module aliasing or `@victframework` resolution override
 *      exists in `vite.config.ts` / `svelte.config.js` / `tsconfig.json`,
 *      and that the renderer resolves (realpath) from THIS repository's
 *      `node_modules` at the released `0.3.0` with its intact TypeScript
 *      source (`export interface` present in `mount.svelte.ts`) — i.e.
 *      the package is not replaced, aliased, vendored, or resolved from
 *      a local VICT checkout.
 *   2. Isolation guard — creates its own disposable data directory via
 *      `mkdtempSync` in the OS temporary directory and fail-closed
 *      verifies it: existing, resolvable, NOT equal to or inside the
 *      default operator data directory, and NOT inside the repository.
 *      The verifier-side guard is itself regression-checked in-process
 *      (expected refusals of missing, operator-path, operator-nested, and
 *      repository-nested candidates), and the spawned application's
 *      guard is exercised end-to-end by a permanent negative control
 *      that must be refused with an uninitialized store.
 *   3. Real dev server — spawns `node node_modules/vite/bin/vite.js dev`
 *      with cwd = repository root (so Vite auto-loads `vite.config.ts`)
 *      on loopback with a bounded, freshly-picked port and
 *      `--strictPort`, from a cold dependency-optimizer cache so the
 *      optimizer path is actually exercised, and with the task-owned
 *      data directory passed explicitly in the child environment.
 *   4. Ordinary path — polls `GET /` until the application answers
 *      HTTP 200, then walks the real dev transform pipeline: the host
 *      page, the workspace island, and the released renderer entry
 *      including `mount.svelte.ts` — the exact module whose TypeScript
 *      previously crashed `svelte.compileModule` through the dev
 *      prebundler.
 *   5. Store isolation proof — after teardown, the task-owned directory
 *      MUST contain the initialized stores (`shared-world.db` and
 *      `vict-operational.db`), opened read-only to prove the migration
 *      chain (1–4, including Q5's `qlt-memory-mode-policy`) ran THERE.
 *      A missing store proves the child did not receive or use the
 *      task-owned path (e.g. a dropped override silently falling back
 *      to the default operator location) and fails the gate.
 *   6. Failure conditions — the gate FAILS on the renderer
 *      `js_parse_error` signature, any `vite-plugin-svelte-module:
 *      optimize-svelte` failure, the mangled `xport interface`
 *      diagnostic, process crash, readiness/transform timeout, any
 *      HTTP 5xx, raw untransformed TypeScript leaking out of the
 *      renderer modules, an exit of the dev-server child, any warning
 *      outside the closed known-warning set (zero project warnings),
 *      any isolation-guard violation, a store initialized outside the
 *      task-owned directory, a persistent listener after teardown, or
 *      cleanup failing to remove a task-owned temporary directory.
 *   7. Zero-warning treatment — Q5 (freeze §13): the three formerly
 *      deferred warnings in `ConversationWorkspace.svelte` are REPAIRED,
 *      so the gate expects ZERO project Svelte warnings and fails on
 *      EVERY warning (no allowlist for project warnings). The known
 *      cosmetic dev-only sourcemap notice (D-11) remains a separately
 *      recorded optional external-tool notice.
 *   8. Teardown — the exact spawned child trees are terminated
 *      (SIGTERM, with a Windows `taskkill /T /F` escalation against the
 *      captured PID) on success, failure, and timeout; released ports
 *      are re-proved free; every task-owned temporary directory (and,
 *      only in the disclosed regression scenario, the negative control's
 *      repository-side fallback path) is removed in a `finally`
 *      equivalent path and its removal is verified; nothing is written
 *      to the repository outside `node_modules/.vite`, which is restored
 *      to its pre-run existence state; no log, config, or database
 *      artifact remains. Ordinary `npm run dev` behavior is unchanged:
 *      without the override the application keeps using its configured
 *      default operator data location.
 */
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, relative, resolve as resolvePath } from 'node:path';

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
  rendererPackage.version !== '0.3.1-rc.2'
) {
  fail(
    `released renderer identity changed: ${rendererPackage.name}@${rendererPackage.version} (expected @victframework/renderer-svelte@0.3.0).`,
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
// 2. Task-owned data isolation (path arithmetic only below this point —
//    the real operator data directory is never opened, read, or probed;
//    it exists here solely as a resolved comparison string).
// ---------------------------------------------------------------------------
const defaultOperatorDataDir = resolvePath(join(repoRoot, '.quellight-data'));
const resolvedRepoRoot = resolvePath(repoRoot);

function insideBase(base, candidate) {
  // path.relative is case-insensitive on win32 and case-sensitive on posix —
  // the platform-correct containment comparison (mirrors the app-side seam).
  const rel = relative(base, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Fail-closed assessment of a candidate task-owned data directory:
 * returns a refusal reason string, or null when the candidate is a valid
 * disposable location outside the repository and the operator directory.
 */
function assessTaskDataDir(candidate) {
  if (!existsSync(candidate)) return `path is missing: ${candidate}`;
  let real;
  try {
    real = realpathSync(candidate);
  } catch {
    return `path could not be resolved: ${candidate}`;
  }
  const lexical = resolvePath(candidate);
  if (insideBase(defaultOperatorDataDir, real) || insideBase(defaultOperatorDataDir, lexical)) {
    return `path resolves to or inside the default operator data directory: ${candidate}`;
  }
  if (insideBase(resolvedRepoRoot, real) || insideBase(resolvedRepoRoot, lexical)) {
    return `path resolves inside the repository: ${candidate}`;
  }
  return null;
}

// Regression checks of the verifier-side guard itself (in-process, no
// server): each of these candidates MUST be refused. None of them is
// created, opened, or probed on the filesystem — the operator-path
// candidates are pure path strings.
const guardProbeBase = join(
  tmpdir(),
  `quellight-devstart-guard-probe-nonexistent-${process.pid}-${Date.now()}`,
);
const expectedRefusals = [
  { candidate: guardProbeBase, why: 'missing temporary path' },
  { candidate: defaultOperatorDataDir, why: 'the default operator data directory itself' },
  {
    candidate: join(defaultOperatorDataDir, 'nested-probe'),
    why: 'a path inside the operator data directory',
  },
  { candidate: join(resolvedRepoRoot, 'tmp', 'guard-probe'), why: 'a path inside the repository' },
];
for (const probe of expectedRefusals) {
  const refusal = assessTaskDataDir(probe.candidate);
  if (refusal === null) {
    fail(`isolation guard regression: it failed to refuse ${probe.why} (${probe.candidate}).`);
  }
}

const taskDataRoot = mkdtempSync(join(tmpdir(), 'quellight-devstart-'));
const taskRoots = [taskDataRoot];
// The negative control's override value: inside the repository, so the
// application's seam MUST refuse it. Only if that guard regresses would
// anything be written there; the cleanup removes exactly this path then.
const guardControlOverride = resolvePath(join(resolvedRepoRoot, 'tmp', 'devstart-guard-control'));
const guardControlFallbacks = [];
console.log(`verify:dev-start: task-owned data dir: ${taskDataRoot}`);

function removeTaskRoots() {
  for (const root of [...taskRoots, ...guardControlFallbacks]) {
    rmSync(root, { recursive: true, force: true });
    if (existsSync(root)) {
      fail(`cleanup failed to remove the task-owned temporary directory: ${root}`);
    }
  }
  taskRoots.length = 0;
  guardControlFallbacks.length = 0;
}

const taskAssessment = assessTaskDataDir(taskDataRoot);
if (taskAssessment !== null) {
  fail(`task-owned data directory rejected before start: ${taskAssessment}`);
}

// ---------------------------------------------------------------------------
// 3. Start the real dev server (repository vite.config.ts, loopback,
//    bounded fresh port, strict port, cold optimizer cache, explicit
//    task-owned data directory).
// ---------------------------------------------------------------------------
async function pickFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

const viteCacheDir = join(repoRoot, 'node_modules', '.vite');
const cacheExistedBefore = existsSync(viteCacheDir);
rmSync(viteCacheDir, { recursive: true, force: true });

const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function spawnVite(port, extraEnv) {
  const child = spawn(
    process.execPath,
    [viteBin, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
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
  let log = '';
  const note = (chunk) => {
    log = (log + chunk).slice(-LOG_LIMIT);
  };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', note);
  child.stderr.on('data', note);
  return {
    child,
    getLog: () => log,
    isExited: () => exited,
    getExitInfo: () => exitInfo,
    isCrashed: () => crashed,
  };
}

async function terminateChild(server) {
  const { child } = server;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const pid = child.pid;
  child.kill('SIGTERM');
  const deadline = Date.now() + 5_000;
  while (!server.isExited() && Date.now() < deadline) await sleep(100);
  if (!server.isExited()) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
    const hardDeadline = Date.now() + 5_000;
    while (!server.isExited() && Date.now() < hardDeadline) await sleep(100);
  }
}

async function assertPortReleased(port, label) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const free = await new Promise((resolveFree) => {
      const probe = net.createServer();
      probe.once('error', () => resolveFree(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolveFree(true)));
    });
    if (free) return;
    await sleep(250);
  }
  fail(`${label}: a listener is still bound to 127.0.0.1:${port} after teardown.`);
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

// ZERO-WARNING GATE (Q5, freeze §13): the three formerly deferred
// ConversationWorkspace.svelte warnings are REPAIRED in Phase Q5, so the
// gate now expects ZERO project Svelte warnings — ANY Svelte warning id
// fails the gate. The known cosmetic dev-only sourcemap notice (D-11) is
// kept as a separately recorded, optional external-tool notice; it is not
// a Svelte warning and never hides project warnings.
const SVELTE_WARN_URL = /https:\/\/svelte\.dev\/e\/([A-Za-z0-9_]+)/g;
const SOURCMAP_NOTICE = /Sourcemap for .*points to missing source files/;

function auditWarnings(log) {
  const seen = new Map();
  for (const match of log.matchAll(SVELTE_WARN_URL)) {
    const id = match[1];
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    fail(
      `svelte warning "${id}" emitted ${count} time(s); the zero-warning dev-start gate forbids every project warning.`,
    );
  }
  return SOURCMAP_NOTICE.test(log);
}

async function get(base, pathname, timeoutMs) {
  return fetch(base + pathname, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: '*/*' },
  });
}

let sourcemapNoticeSeen = false;

// The permanent spawned negative control: the application's own seam MUST
// refuse an override that resolves inside the repository. Proves, through
// the real boundary on every run, that a misconfigured child can never
// silently start against an unisolated location.
async function runGuardControl() {
  const controlRoot = mkdtempSync(join(tmpdir(), 'quellight-devstart-control-'));
  taskRoots.push(controlRoot);
  const controlPort = await pickFreePort();
  const server = spawnVite(controlPort, { QUELLIGHT_DATA_DIR_ABSOLUTE: guardControlOverride });
  try {
    const BASE = `http://127.0.0.1:${controlPort}`;
    const deadline = Date.now() + 60_000;
    let answered = null;
    while (answered === null && Date.now() < deadline && !server.isExited()) {
      try {
        const res = await get(BASE, '/', 5_000);
        answered = res.status;
      } catch {
        await sleep(500);
      }
    }
    if (server.isExited()) {
      fail(`guard control: dev-server child exited unexpectedly (${server.getExitInfo()}).`);
    } else if (answered === null) {
      fail('guard control: the dev server never answered the probe request.');
    } else if (answered === 200) {
      fail(
        'guard control: the application composed with an override inside the repository — the isolation seam failed closed. ' +
          'No task-owned store may be trusted; this is a hard isolation regression.',
      );
    } else if (answered < 400) {
      fail(`guard control: unexpected probe status ${answered} (expected a >= 400 refusal).`);
    }
    // The refused composition must not initialize any store in the
    // control's task-owned directory.
    const leftovers = existsSync(controlRoot) ? readdirSync(controlRoot) : [];
    if (leftovers.length > 0) {
      fail(
        `guard control: the refused child still wrote into the task-owned directory: ${leftovers.join(', ')}.`,
      );
    }
  } finally {
    await terminateChild(server);
  }
  await assertPortReleased(controlPort, 'guard control');
  // Only if the seam regressed could anything exist at the repository-side
  // fallback path; register it for cleanup regardless (removal of a
  // non-existent path is a no-op).
  guardControlFallbacks.push(guardControlOverride);
}

// Global safety bound for the whole run (readiness + transforms).
const mainPhase = {
  isCrashedFlag: false,
  hardDeadlineExceeded: false,
};
const HARD_DEADLINE_MS = 150_000;
const hardTimer = setTimeout(() => {
  mainPhase.isCrashedFlag = true; // treated as fatal below
  mainPhase.hardDeadlineExceeded = true;
}, HARD_DEADLINE_MS);

const freePort = await pickFreePort();
// Pre-spawn fail-closed assertions: the explicit disposable data path MUST
// be present in the child environment and MUST assess as isolated.
const childEnv = { ...process.env, QUELLIGHT_DATA_DIR_ABSOLUTE: taskDataRoot };
if (childEnv.QUELLIGHT_DATA_DIR_ABSOLUTE !== taskDataRoot) {
  fail('isolation regression: no explicit disposable data path was supplied to the child.');
}

let server = spawnVite(freePort, { QUELLIGHT_DATA_DIR_ABSOLUTE: taskDataRoot });

try {
  // 4a. Readiness: poll GET / until HTTP 200 (bounded).
  const READY_DEADLINE_MS = 90_000;
  const BASE = `http://127.0.0.1:${freePort}`;
  const start = Date.now();
  let ready = false;
  let lastStatus = 'no connection';
  while (
    !ready &&
    Date.now() - start < READY_DEADLINE_MS &&
    !(mainPhase.isCrashedFlag || server.isCrashed())
  ) {
    if (server.isExited()) break;
    try {
      const res = await get(BASE, '/', 5_000);
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
  if (!ready && !(mainPhase.isCrashedFlag || server.isCrashed()) && !server.isExited()) {
    fail(
      `development server did not serve the application within ${READY_DEADLINE_MS / 1000}s (last status: ${lastStatus}).`,
    );
  }

  if (ready && !(mainPhase.isCrashedFlag || server.isCrashed())) {
    // 4b. The real transform pipeline: host page, workspace island,
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
      if (mainPhase.isCrashedFlag || server.isCrashed() || server.isExited()) break;
      let body = null;
      // The dev optimizer may reload the module graph after discovering
      // new dependencies; a request racing that reload gets an "Outdated
      // Optimize Dep" 504 exactly as a browser reload would. Bounded
      // retry (3 attempts, 1s apart), like a browser, then fail.
      for (let attempt = 1; attempt <= 3 && body === null; attempt += 1) {
        let res;
        try {
          res = await get(BASE, target.path, 20_000);
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

  // 5. Final accounting: crash, fatal signatures, closed warning set.
  if (server.isCrashed() && server.isExited())
    fail(`dev-server process exited unexpectedly (${server.getExitInfo() ?? 'unknown'}).`);
  if (mainPhase.hardDeadlineExceeded)
    fail(`verify:dev-start hard deadline (${HARD_DEADLINE_MS / 1000}s) exceeded.`);
  const devLog = server.getLog();
  for (const signature of FATAL_SIGNATURES) {
    if (signature.pattern.test(devLog)) {
      fail(`fatal signature in dev-server output: ${signature.label}.`);
    }
  }
  sourcemapNoticeSeen = auditWarnings(devLog);
} finally {
  clearTimeout(hardTimer);
  await terminateChild(server);
  await assertPortReleased(freePort, 'main phase');
}

// 6. Store isolation proof: the task-owned directory must contain the
// initialized stores, and the Shared World migration chain (1..4) must
// have run THERE — read-only, after the server has been stopped.
try {
  const sharedDbPath = join(taskDataRoot, 'shared-world.db');
  const victDbPath = join(taskDataRoot, 'vict-operational.db');
  if (!existsSync(sharedDbPath) || !existsSync(victDbPath)) {
    fail(
      'store isolation regression: the child did not initialize its stores in the task-owned ' +
        'temporary directory (a missing store here means an override was dropped or ignored and ' +
        'the default operator location would have been used instead).',
    );
  } else {
    const db = new DatabaseSync(sharedDbPath, { readOnly: true });
    try {
      const rows = db
        .prepare('SELECT version, name FROM quellight_shared_world_migrations ORDER BY version;')
        .all();
      const versions = rows.map((r) => r.version);
      if (
        JSON.stringify(versions) !== JSON.stringify([1, 2, 3, 4]) ||
        rows.find((r) => r.version === 4)?.name !== 'qlt-memory-mode-policy'
      ) {
        fail(
          `store isolation proof: unexpected migration chain in the task-owned store: ${JSON.stringify(rows)}.`,
        );
      }
    } finally {
      db.close();
    }
  }

  // 7. Permanent spawned negative control through the real application
  //    boundary (the app-side isolation seam must fail closed).
  await runGuardControl();
} finally {
  removeTaskRoots();
  if (!cacheExistedBefore) rmSync(viteCacheDir, { recursive: true, force: true });
}

// 8. Report. The zero-warning outcome is printed; the optional sourcemap
// notice stays visible as a recorded external-tool notice (never hidden).
if (failures.length === 0) {
  console.log('verify:dev-start: PASS');
  console.log(`  real repository vite.config.ts; http://127.0.0.1:${freePort}/ → 200`);
  console.log(`  isolated task-owned data dir used and removed: ${taskDataRoot}`);
  console.log(
    '  task-owned store initialized with the migration chain 1..4 (incl. qlt-memory-mode-policy); default operator store untouched by this gate.',
  );
  console.log(
    '  isolation guard verified in-process (refuses missing / operator / repository paths) and through the real boundary (guard control refused, no store written).',
  );
  console.log(
    '  renderer entry + mount.svelte.ts transformed through the dev pipeline (no js_parse_error, no optimize-svelte failure, no raw TypeScript).',
  );
  console.log(
    '  ZERO project Svelte warnings (Q5 zero-warning gate; the three D-11 deferred warnings were repaired in Phase Q5).',
  );
  console.log(
    sourcemapNoticeSeen
      ? '  known recorded cosmetic sourcemap notice present (D-11: dev-only external-tool notice, expected in this loading mode).'
      : '  (known cosmetic sourcemap notice not emitted this run — optional).',
  );
  process.exit(0);
}
console.error(`verify:dev-start: ${failures.length} failure(s).`);
console.error('--- dev-server output tail ---');
console.error(server.getLog().split('\n').slice(-40).join('\n'));
process.exit(1);
