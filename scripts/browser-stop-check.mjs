#!/usr/bin/env node
/**
 * F-1 PERMANENT REGRESSION — the real-browser Stop flow, plus the
 * old-commit baseline negative control.
 *
 * Step 0 (baseline negative control): in an ISOLATED TEMPORARY GIT
 *   WORKTREE at commit 00ca458374f99f9cd35612affb71e9adbf01b70f (the
 *   audited pre-remediation commit), the old composition is started and
 *   the EXACT request shape the old island's Stop control sent —
 *   `{"turnId":…}` with no idempotency-key header — is sent through the
 *   real loopback VICT boundary of that commit. It must fail closed with
 *   400 `VICT_HTTP_BODY_MALFORMED`. A positive envelope control proves
 *   the released contract itself was correct on the same commit. The
 *   worktree and all artifacts are removed afterwards.
 *
 * Step 1 (real browser): the REAL SvelteKit application (real island,
 *   real `/vict` proxy, real in-process loopback VICT boundary) is
 *   served by `vite dev`; the ONLY substitution is the offline fixture
 *   model — a paced text fixture (same stream-part shapes, released
 *   offline identity) whose stream stays genuinely in flight long
 *   enough for a real Chromium to click the visible Stop control
 *   mid-stream. The check then proves, through the actual public
 *   browser-to-VICT route:
 *
 *   2. a real browser starts a genuinely in-flight fixture turn;
 *   3. clicking the visible Stop control sends the released
 *      `{payload:{turnId,…}}` envelope;
 *   4. the request carries a non-empty idempotency key;
 *   5. the VICT boundary answers 200 with `accepted: true`;
 *   6. the UI does NOT claim terminal cancellation before the stream
 *      declares it (truthful intermediate state only);
 *   7. exactly one authoritative `response.cancelled` terminal frame is
 *      received and persisted (single turn record; stream replay shows
 *      exactly one terminal);
 *   8. the cancelled state is visible and accessible;
 *   9. no unexpected console or network error occurs;
 *  10. repeated Stop clicks and a simulated same-key retry reuse or
 *      deduplicate the same intent;
 *  11. a disconnect during cancellation (page reload mid-cancel)
 *      restores the truthful cancelled outcome — no fabricated state,
 *      no second effect;
 *  12. close/reopen AND a full-process restart (SIGKILL + fresh server
 *      on the same data dir) restore the cancelled outcome;
 *  13. no second cancellation effect or second terminal frame ever
 *      occurs;
 *  14. malformed and missing-envelope requests still fail closed with
 *      `VICT_HTTP_BODY_MALFORMED`;
 *  15. a failed (network-aborted) cancellation request produces a
 *      visible truthful error and never a false cancelled state.
 *
 * No provider credential is present or required; the composition runs
 * the offline fixture path.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);

const failures = [];

const REPO = process.cwd();
const OLDCOMMIT = '00ca458374f99f9cd35612affb71e9adbf01b70f';
const DATA_DIR_NAME = '.quellight-data-stop-check';

const rmRfRetry = (target, attempts = 10) => {
  const attempt = (remaining) => {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch {
      if (remaining > 0) {
        setTimeout(() => attempt(remaining - 1), 500);
      } else {
        console.error(`  warning: could not remove ${target} (disposable)`);
      }
    }
  };
  attempt(attempts);
};

const waitUntil = async (expectation, label, timeoutMs = 30_000) => {
  const started = Date.now();
  let lastError;
  for (;;) {
    try {
      const value = await expectation();
      if (value) {
        return value;
      }
      lastError = new Error(`condition false: ${label}`);
    } catch (error) {
      lastError = error;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ''}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
};

// ---------------------------------------------------------------------------
// Step 0 — the old-commit negative control in an isolated worktree.
// ---------------------------------------------------------------------------
const negativeControl = async () => {
  console.log('\n=== step 0: old-commit negative control (isolated worktree) ===');
  const tmp = mkdtempSync(join(tmpdir(), 'qlt-stop-negctl-'));
  const worktree = join(tmp, 'wt');
  const add = spawnSync('git', ['worktree', 'add', '--detach', worktree, OLDCOMMIT], {
    cwd: REPO,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (add.status !== 0) {
    fail(`git worktree add failed: ${(add.stderr || add.stdout || '').slice(0, 400)}`);
    rmRfRetry(tmp);
    return;
  }
  try {
    // The isolated worktree resolves its @victframework/*@0.1.0 imports
    // from the repository's node_modules through a junction (the pinned
    // release set is identical on both commits — same lockfile).
    symlinkSync(join(REPO, 'node_modules'), join(worktree, 'node_modules'), 'junction');

    const probePath = join(tmp, 'negctl-probe.mts');
    writeFileSync(
      probePath,
      `
const { createQuellightComposition, resolveQuellightEnvironment } = await import(
  pathToFileURL(process.env.QLT_NEGCTL_WT + '/src/lib/server/composition.ts').href
);
import { pathToFileURL } from 'node:url';

const dir = process.env.QLT_NEGCTL_DATA;
const env = resolveQuellightEnvironment(
  { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_ACTOR_TOKEN: 'negctl-token' },
  dir,
);
const composition = await createQuellightComposition({
  env,
  offlineScript: { probe: { kind: 'text', text: 'x'.repeat(600) } },
});
const port = await composition.listen();
const origin = \`http://127.0.0.1:\${port}\`;
const actor = { ...composition.actor, presentedTokenKind: 'local-test' };
const thread = await composition.sharedWorld.createThread({ title: 'negctl' });
const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
const started = await composition.commandService.dispatch(actor, {
  command: 'agent.turn.start',
  payload: { threadId: conversation.mastraThreadId, input: 'probe' },
  idempotencyKey: 'negctl-1',
});
const { turnId } = started.data;

// EXACTLY the pre-remediation island request shape (audit P2b/P6):
// flat body, NO idempotency-key header. The bearer header is the one the
// /vict proxy injects server-side before any browser request reaches
// this boundary.
const oldShape = await fetch(\`\${origin}/vict/v1/turns/cancel\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer negctl-token' },
  body: JSON.stringify({ turnId }),
});
const oldShapeBody = await oldShape.json();

// Positive control: the released envelope over a non-mutation command on
// the SAME commit's boundary proves the contract itself was correct.
const envelopeControl = await fetch(\`\${origin}/vict/v1/actor/whoami\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer negctl-token' },
  body: JSON.stringify({ payload: {} }),
});
const envelopeBody = await envelopeControl.json();

// Positive envelope+key control against the cancel route itself: with the
// released envelope AND the header the SAME commit's boundary accepts the
// command (the old island simply never sent this shape).
const envelopeCancel = await fetch(\`\${origin}/vict/v1/turns/cancel\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer negctl-token', 'idempotency-key': 'negctl-correct-envelope-1' },
  body: JSON.stringify({ payload: { turnId, reasonCode: 'user' } }),
});
const envelopeCancelBody = await envelopeCancel.json();

process.stdout.write(
  '<<VERDICT>>' + JSON.stringify({
    oldShape: { status: oldShape.status, body: oldShapeBody },
    envelopeControl: { status: envelopeControl.status, body: envelopeBody },
    envelopeCancel: { status: envelopeCancel.status, body: envelopeCancelBody },
  }) + '\\n',
);
await composition.close();
process.exit(0);
`,
      'utf8',
    );

    const dataDir = join(tmp, 'negctl-data');
    const probe = spawn(process.execPath, ['--import', 'tsx', probePath], {
      cwd: REPO,
      env: {
        ...process.env,
        QLT_NEGCTL_WT: worktree,
        QLT_NEGCTL_DATA: dataDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    probe.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    probe.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const exit = await new Promise((resolvePromise) => {
      const timer = setTimeout(() => probe.kill('SIGKILL'), 120_000);
      probe.on('exit', (code) => {
        clearTimeout(timer);
        resolvePromise(code);
      });
    });
    const verdictLine = stdout.split('\n').find((line) => line.startsWith('<<VERDICT>>'));
    if (exit !== 0 || verdictLine === undefined) {
      fail(`negative-control probe failed (exit ${exit}): ${(stderr || stdout).slice(0, 600)}`);
      return;
    }
    const verdict = JSON.parse(verdictLine.slice('<<VERDICT>>'.length));

    if (
      verdict.oldShape.status !== 400 ||
      verdict.oldShape.body?.code !== 'VICT_HTTP_BODY_MALFORMED'
    ) {
      fail(
        `old-commit old-shape request did not fail closed as expected: ${JSON.stringify(
          verdict.oldShape,
        ).slice(0, 300)}`,
      );
    } else {
      note(
        'old shape {turnId} on 00ca458 boundary -> 400 VICT_HTTP_BODY_MALFORMED (the F-1 defect, reproduced)',
      );
    }
    if (verdict.envelopeControl.status !== 200 || verdict.envelopeControl.body?.ok !== true) {
      fail(
        `old-commit envelope control failed: ${JSON.stringify(verdict.envelopeControl).slice(0, 300)}`,
      );
    } else {
      note('released envelope on 00ca458 boundary -> 200 (the released contract was correct)');
    }
    if (
      verdict.envelopeCancel.status !== 200 ||
      verdict.envelopeCancel.body?.data?.result?.accepted === undefined
    ) {
      fail(
        `old-commit envelope+key cancel control failed: ${JSON.stringify(verdict.envelopeCancel).slice(0, 300)}`,
      );
    } else {
      note(
        `envelope+key cancel on 00ca458 boundary -> 200 accepted (accepted=${verdict.envelopeCancel.body.data.result.accepted})`,
      );
    }
  } finally {
    // Remove the junction FIRST (unlink the reparse point itself — never
    // let any directory traversal follow it into the repository's real
    // node_modules), and only then remove the worktree.
    const junction = join(worktree, 'node_modules');
    try {
      rmSync(junction, { force: true });
    } catch {
      try {
        spawnSync('cmd', ['/c', 'rmdir', junction], { shell: process.platform === 'win32' });
      } catch {
        /* disposed with the worktree below */
      }
    }
    const remove = spawnSync('git', ['worktree', 'remove', '--force', worktree], {
      cwd: REPO,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (remove.status !== 0) {
      fail(`git worktree remove failed: ${(remove.stderr || '').slice(0, 300)}`);
    }
    const prune = spawnSync('git', ['worktree', 'prune'], {
      cwd: REPO,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (prune.status !== 0) {
      fail(`git worktree prune failed`);
    }
    rmRfRetry(tmp);
    if (!existsSync(worktree)) {
      note('temporary worktree and probe artifacts removed');
    }
  }
};

// ---------------------------------------------------------------------------
// Step 1 — the real-browser Stop regression.
// ---------------------------------------------------------------------------
const browserRegression = async () => {
  console.log('\n=== step 1: real-browser Stop regression (Chromium via the real app) ===');
  const tmp = mkdtempSync(join(tmpdir(), 'qlt-stop-browser-'));
  // The composition anchors its data dir under the process working
  // directory; the dev server runs from the repository root, so the
  // disposable stores live in the (gitignored, removed-after) check dir.
  const dataDir = join(REPO, DATA_DIR_NAME);
  rmRfRetry(dataDir, 2);

  const serverEnv = {
    ...process.env,
    QUELLIGHT_DATA_DIR: DATA_DIR_NAME,
    QUELLIGHT_ACTOR_TOKEN: `qlt-stop-check-${Date.now()}`,
  };

  const configPath = join(tmp, 'vite.stopcheck.mts');
  writeFileSync(
    configPath,
    `
import repoConfig from '${REPO.replace(/\\/g, '/')}/vite.config.ts';

const fixtureRuntime = '${REPO.replace(/\\/g, '/')}/test/fixtures/stop-check-runtime.mts';

// Serves the REAL application with ONE substitution for this check only:
// the runtime singleton wires the paced offline fixture model so the
// browser can click Stop mid-stream. The routes, island, proxy, and the
// released VICT boundary are the real product code paths.
const fixturePlugin = {
  name: 'qlt-stop-check-fixture-runtime',
  enforce: 'pre',
  resolveId(id) {
    const norm = id.split(String.fromCharCode(92)).join('/');
    if (id === '$lib/server/runtime' || norm.endsWith('/src/lib/server/runtime')) {
      return fixtureRuntime;
    }
    return undefined;
  },
};

export default {
  ...(repoConfig as object),
  root: '${REPO.replace(/\\/g, '/')}',
  plugins: [...((repoConfig as { plugins?: unknown[] }).plugins ?? []), fixturePlugin],
  server: { host: '127.0.0.1', strictPort: false },
  // Dev-only, stop-check-only: serve the renderer package through the
  // normal transform pipeline (esbuild TS strip -> svelte module compile)
  // instead of the esbuild dep prebundler, whose svelte-module pass
  // cannot parse TypeScript in .svelte.ts library modules under the
  // pinned svelte version. The production build (the N-17 evidence path)
  // is unaffected.
  optimizeDeps: { exclude: ['@victframework/renderer-svelte'] },
};
`,
    'utf8',
  );

  const startServer = () => {
    const child = spawn(
      process.execPath,
      [join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'dev', '--config', configPath],
      {
        cwd: REPO,
        env: serverEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let log = '';
    const stripAnsi = (text) => text.replace(/\u001B[[0-9;]*m/g, '');
    child.stdout.on('data', (chunk) => {
      log += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      log += String(chunk);
    });
    return { child, getLog: () => stripAnsi(log) };
  };

  const waitOrigin = async (server) =>
    waitUntil(
      async () => {
        const match = server.getLog().match(/Local:\s*(http:\/\/127\.0\.0\.1:\d+)\/?/);
        if (match) {
          try {
            const probe = await fetch(match[1] + '/api/health');
            if (probe.ok) {
              return match[1];
            }
          } catch {
            /* not up yet */
          }
        }
        return false;
      },
      'dev server origin',
      90_000,
    );

  let server = startServer();
  let browser;
  const cancelResponses = [];
  const consoleProblems = [];
  const cancelRequests = [];
  const turnStarts = {};

  const watchPage = (page, label) => {
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleProblems.push({ label, text: `${message.type()}: ${message.text()}` });
      }
    });
    page.on('pageerror', (error) => {
      consoleProblems.push({ label, text: `pageerror: ${String(error)}` });
    });
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/vict/v1/turns/cancel')) {
        const request = response.request();
        const entry = {
          label,
          key: request.headers()['idempotency-key'] ?? null,
          postData: request.postData() ?? null,
          status: response.status(),
          body: null,
        };
        cancelResponses.push(entry);
        void response
          .json()
          .then((body) => {
            entry.body = body;
          })
          .catch(() => undefined);
      }
      const turnMatch = /\/api\/threads\/([^/]+)\/turns$/.exec(url);
      if (turnMatch !== null && response.request().method() === 'POST') {
        void response
          .json()
          .then((body) => {
            if (body?.ok && body?.data?.turnId) {
              turnStarts[turnMatch[1]] = body.data;
            }
          })
          .catch(() => undefined);
      }
      if (response.status() >= 500) {
        consoleProblems.push({ label, text: `http ${response.status()} on ${url}` });
      }
    });
  };

  const openThread = async (page, origin, title) => {
    await page.goto(origin, { waitUntil: 'networkidle' });
    const thread = page.locator('.qlt-thread', { hasText: title }).first();
    await thread.waitFor({ state: 'visible', timeout: 20_000 });
    await thread.click();
    await page
      .locator('.qlt-thread-heading')
      .filter({ hasText: title })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
  };

  const createThreadAndSend = async (page, title, message) => {
    await page.getByRole('button', { name: 'New thread' }).click();
    // The island creates threads with an auto-generated title; give this
    // one its unique check title through the island's own rename flow.
    await page
      .locator('.qlt-thread-heading')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByRole('button', { name: 'Rename' }).click();
    const renameInput = page.locator('.qlt-rename');
    await renameInput.waitFor({ state: 'visible', timeout: 20_000 });
    await renameInput.fill(title);
    await page.getByRole('button', { name: 'Save' }).click();
    await page
      .locator('.qlt-thread-heading')
      .filter({ hasText: title })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    note(`thread created: ${title}`);
    const composer = page.locator('#qlt-composer');
    await composer.fill(message);
    const turnsBefore = Object.keys(turnStarts).length;
    await page.getByRole('button', { name: 'Send' }).click();
    // The turn-start response carries the turnId/streamId evidence.
    await waitUntil(
      async () => Object.keys(turnStarts).length > turnsBefore,
      'turn start recorded',
    );
    // Wait until the turn is GENUINELY in flight: the first paced delta
    // is rendered by the island.
    await page
      .locator('.qlt-message--assistant')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    note('fixture turn genuinely in flight (assistant delta rendered)');
  };

  const cancelledOutcomeVisible = async (page) => {
    await page
      .locator('.qlt-banner--warn')
      .filter({ hasText: 'Past turn outcome: cancelled' })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
  };

  const replayTerminalKindsFromPage = async (page, streamId) => {
    return page.evaluate(async (id) => {
      const response = await fetch(`/vict/v1/streams/${id}`, {
        headers: { accept: 'text/event-stream' },
      });
      if (!response.ok || response.body === null) {
        return { error: `stream replay failed: ${response.status}` };
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const kinds = [];
      let closed = false;
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
          if (dataLine === undefined) {
            continue;
          }
          try {
            kinds.push(JSON.parse(dataLine.slice('data: '.length)).kind);
          } catch {
            /* keep-alive/comment */
          }
        }
      }
      return { kinds };
    }, streamId);
  };

  const threadMessagesFromPage = async (page, threadId) =>
    page.evaluate(async (id) => {
      const response = await fetch(`/api/threads/${id}/messages`);
      return response.json();
    }, threadId);

  try {
    const origin = await waitOrigin(server);
    note(`real application served at ${origin}`);
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    watchPage(page, 'main');

    const pageText = () => page.locator('body').innerText();

    // ---------- scenario A: the full Stop flow (requirements 2-10, 13) ----
    await page.goto(origin, { waitUntil: 'networkidle' });
    // Dev-mode warmup: the first load makes Vite discover and prebundle
    // the remaining client dependencies (which triggers exactly one full
    // app reload). Reload once more so the real flow runs on a settled
    // module graph — no optimizer reload can interrupt it.
    await page.waitForTimeout(3000);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await createThreadAndSend(page, 'Stop check', 'Hello stop check');
    const threadUrlMatch = /\/api\/threads\/([^/]+)\/turns/;
    const cancelUrlSeen = () => cancelResponses.filter((entry) => entry.label === 'main');
    const threadIdA = Object.keys(turnStarts).find((id) => turnStarts[id].turnId) ?? '';

    // --- click the visible Stop control (THE literal click) -------------
    // Inject the announcement recorder BEFORE clicking so the sequence of
    // live-region states is captured from the click onward.
    await page.evaluate(() => {
      window.__qltAnnouncements = [];
      const region = document.querySelector('[role="status"][aria-live="polite"]');
      if (region === null) {
        return;
      }
      const record = () => {
        const text = (region.textContent ?? '').trim();
        const seen = window.__qltAnnouncements;
        if (text && seen[seen.length - 1] !== text) {
          seen.push(text);
        }
      };
      new MutationObserver(record).observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    // A DOUBLE-click gesture: two real clicks on the visible control fire
    // the Stop handler twice within one gesture - one user intent, two
    // identical requests, both landing before the fast authoritative
    // terminal. Every request must carry the SAME key and be durably
    // deduplicated by the released boundary.
    await page.locator('.qlt-btn--stop').dblclick();
    await waitUntil(async () => cancelUrlSeen().length >= 1, 'first cancel request observed');
    await page.waitForTimeout(250);
    const repeated = cancelUrlSeen().slice(1);
    const first = cancelUrlSeen()[0];
    const firstRequest = JSON.parse(first.postData ?? '{}');
    if (
      JSON.stringify(firstRequest) !==
      JSON.stringify({ payload: { turnId: turnStarts[threadIdA]?.turnId, reasonCode: 'user' } })
    ) {
      fail(`stop request envelope is not the released contract: ${first.postData}`);
    } else {
      note(
        `stop request envelope {payload:{turnId,reasonCode}} (turn ${turnStarts[threadIdA]?.turnId})`,
      );
    }
    if (typeof first.key !== 'string' || first.key.length === 0) {
      fail('stop request carried no non-empty idempotency-key header');
    } else {
      note(`stop request idempotency-key present (${first.key})`);
    }
    await waitUntil(async () => first.body !== null, 'first cancel response body');
    if (
      first.status !== 200 ||
      first.body?.ok !== true ||
      first.body?.data?.result?.accepted !== true
    ) {
      fail(`VICT boundary did not accept the cancel: ${JSON.stringify(first.body)}`);
    } else {
      note('VICT boundary -> 200 {ok:true, accepted:true} through the real /vict proxy');
    }

    // Repeated clicks of the SAME intent: every additional click from the
    // double-click gesture carried the SAME key and SAME envelope, and the
    // boundary deduplicated durably (200 replay or the stable 409
    // in-progress conflict) - never a second effect.
    for (const extra of repeated) {
      if (extra.key !== first.key) {
        fail(`repeated Stop click used a DIFFERENT key (${extra.key} != ${first.key})`);
      }
      const extraRequest = JSON.parse(extra.postData ?? '{}');
      if (JSON.stringify(extraRequest) !== JSON.stringify(firstRequest)) {
        fail(`repeated Stop click changed the request body: ${extra.postData}`);
      }
      await waitUntil(async () => extra.body !== null, 'repeated cancel response body');
      const deduped =
        (extra.status === 200 && extra.body?.ok === true) ||
        (extra.status === 409 && extra.body?.code === 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS');
      if (!deduped) {
        fail(`repeated Stop click was not deduplicated: ${JSON.stringify(extra.body)}`);
      }
    }
    if (repeated.length > 0) {
      note(
        `repeated Stop click (${repeated.length} extra request(s)) reused the SAME key and was durably deduplicated`,
      );
    } else {
      note('single click observed; the repeat proof continues via the same-key retry below');
    }

    // --- truthful intermediate state: no terminal cancellation claim ----
    // The authoritative terminal can land within milliseconds of the
    // acceptance, so the intermediate state is proven deterministically:
    // a MutationObserver recorded the live-region announcement sequence —
    // the truthful intermediate ('Stop request accepted…') must have
    // rendered BEFORE any terminal cancellation wording.
    const announcements = await page.evaluate(() => window.__qltAnnouncements ?? []);
    const acceptedIndex = announcements.findIndex((text) => text.includes('Stop request accepted'));
    const stoppedIndex = announcements.findIndex((text) => text.startsWith('Stopped'));
    if (acceptedIndex === -1) {
      fail(
        `the truthful intermediate acceptance state never rendered: ${JSON.stringify(announcements)}`,
      );
    } else if (stoppedIndex !== -1 && stoppedIndex < acceptedIndex) {
      fail(
        `the UI claimed terminal cancellation before/without the stream declaring it: ${JSON.stringify(announcements)}`,
      );
    } else {
      note(
        `truthful intermediate state rendered BEFORE the terminal (announcements: ${JSON.stringify(announcements.slice(0, 4))})`,
      );
    }

    // --- simulated retry of the same intent (same key, same body) -------
    const retry = await page.evaluate(
      async ({ url, key, body }) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': key },
          body,
        });
        return { status: response.status, body: await response.json() };
      },
      { url: `${origin}/vict/v1/turns/cancel`, key: first.key, body: first.postData },
    );
    if (retry.status !== 200 || retry.body?.ok !== true) {
      fail(`simulated same-key retry did not deduplicate: ${JSON.stringify(retry)}`);
    } else {
      note('simulated same-key retry -> 200 (durable dedupe/replay, no second intent)');
    }

    // --- the authoritative terminal settles the accessible state --------
    await page
      .locator('.qlt-banner--warn')
      .filter({ hasText: 'Past turn outcome: cancelled' })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    const text = await pageText();
    if (
      !text.includes('Past turn outcome: cancelled') ||
      !(
        text.includes('Stopped. The partial response is retained and marked.') ||
        text.includes('Stopped before any response content')
      )
    ) {
      fail(`cancelled state not visible/accessible as expected: ${text.slice(0, 300)}`);
    } else {
      note('cancelled state visible and accessible (status banner + live-region announcement)');
    }

    // --- exactly one authoritative terminal frame, received + persisted -
    const streamIdA = turnStarts[threadIdA]?.streamId;
    const replay = await replayTerminalKindsFromPage(page, streamIdA);
    if (replay.error) {
      fail(`stream replay failed: ${replay.error}`);
    } else {
      const terminals = replay.kinds.filter((kind) =>
        ['response.completed', 'response.failed', 'response.cancelled'].includes(kind),
      );
      if (terminals.length !== 1 || terminals[0] !== 'response.cancelled') {
        fail(
          `stream replay did not show exactly one response.cancelled: ${JSON.stringify(replay.kinds)}`,
        );
      } else {
        note('stream replay through the real proxy: exactly ONE response.cancelled terminal');
      }
    }
    const messagesA = await threadMessagesFromPage(page, threadIdA);
    const turnsA = messagesA?.turns ?? [];
    if (turnsA.length !== 1 || turnsA[0]?.status !== 'cancelled') {
      fail(`durable turn truth is not a single cancelled turn: ${JSON.stringify(turnsA)}`);
    } else {
      note('persisted truth: exactly one turn record, status cancelled');
    }

    // ---------- scenario B: disconnect during cancellation (req 11) ------
    const cancelCountBeforeB = cancelResponses.length;
    await createThreadAndSend(page, 'Reconnect stop', 'Hello reconnect stop');
    const threadIdB = Object.keys(turnStarts).at(-1);
    await page.locator('.qlt-btn--stop').click();
    await waitUntil(
      async () => cancelResponses.length >= cancelCountBeforeB + 1,
      'scenario B cancel observed',
    );
    const cancelB = cancelResponses.at(-1);
    if (cancelB.status !== 200 || cancelB.body?.data?.result?.accepted !== true) {
      fail(`scenario B cancel not accepted: ${JSON.stringify(cancelB.body)}`);
    }
    // Graceful client disconnect DURING cancellation (before the terminal
    // is rendered): reload the page mid-cancel.
    await page.reload({ waitUntil: 'networkidle' });
    note('page reloaded mid-cancellation (client disconnected from the SSE stream)');
    await openThread(page, origin, 'Reconnect stop');
    await cancelledOutcomeVisible(page);
    const messagesB = await threadMessagesFromPage(page, threadIdB);
    const turnsB = messagesB?.turns ?? [];
    if (turnsB.length !== 1 || turnsB[0]?.status !== 'cancelled') {
      fail(
        `reconnect restore is not the truthful single cancelled turn: ${JSON.stringify(turnsB)}`,
      );
    } else {
      note('reconnect during cancellation restored the truthful cancelled outcome');
    }
    const streamIdB = turnStarts[threadIdB]?.streamId;
    const replayB = await replayTerminalKindsFromPage(page, streamIdB);
    const terminalsB = (replayB.kinds ?? []).filter((kind) =>
      ['response.completed', 'response.failed', 'response.cancelled'].includes(kind),
    );
    if (terminalsB.length !== 1 || terminalsB[0] !== 'response.cancelled') {
      fail(`scenario B replay shows wrong terminals: ${JSON.stringify(replayB)}`);
    } else {
      note('no second terminal was created by the disconnect/reconnect (replay: exactly one)');
    }

    // ---------- scenario C: rejected/undeliverable cancel (req 15) -------
    const consoleBeforeC = consoleProblems.length;
    await context.route('**/vict/v1/turns/cancel', (route) => route.abort());
    await createThreadAndSend(page, 'Failed stop', 'Hello failed stop');
    await page.locator('.qlt-btn--stop').click();
    await page
      .locator('.qlt-banner--warn')
      .filter({ hasText: 'The stop request was not accepted' })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    const textC = await pageText();
    if (
      textC.includes('Past turn outcome: cancelled') ||
      textC.includes('Stopped before any response content')
    ) {
      fail('the UI claimed cancellation after a FAILED stop request');
    } else {
      note('failed stop request -> visible truthful failure banner, never a false cancelled state');
    }
    await context.unroute('**/vict/v1/turns/cancel');
    // The turn keeps streaming truthfully and settles completed on its
    // own (honest outcome the failed cancel request never fabricated):
    // the composer returns to the Send state.
    await page.getByRole('button', { name: 'Send' }).waitFor({ state: 'visible', timeout: 30_000 });
    note('the unaffected turn settled completed truthfully after the failed stop request');
    // The expected fetch-abort noise is scoped to scenario C's own
    // simulated network failure.
    const scenarioCProblems = consoleProblems.slice(consoleBeforeC);
    const unexpectedInC = scenarioCProblems.filter(
      (problem) => !/net::ERR_FAILED|Failed to fetch|Failed to load resource/i.test(problem.text),
    );
    if (unexpectedInC.length > 0) {
      fail(`unexpected console problems in scenario C: ${JSON.stringify(unexpectedInC)}`);
    }

    // ---------- requirement 14: malformed/missing-envelope fail-closed ---
    const malformed = await page.evaluate(async (url) => {
      const probe = async (body, key) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(key ? { 'idempotency-key': key } : {}),
          },
          body,
        });
        return { status: response.status, body: await response.json() };
      };
      const oldShape = await probe(JSON.stringify({ turnId: 'turn-x' }), null);
      const nonObject = await probe(JSON.stringify([1, 2, 3]), 'stop-check-malformed-1');
      const wrongSchema = await probe(
        JSON.stringify({ payload: { turnId: 'turn-x' }, schema: 'vict.command@2' }),
        'stop-check-malformed-2',
      );
      const noHeader = await probe(
        JSON.stringify({ payload: { turnId: 'turn-x', reasonCode: 'user' } }),
        null,
      );
      return { oldShape, nonObject, wrongSchema, noHeader };
    }, `${origin}/vict/v1/turns/cancel`);
    const malformedCases = [
      ['old shape', malformed.oldShape, 'VICT_HTTP_BODY_MALFORMED'],
      ['non-object envelope', malformed.nonObject, 'VICT_HTTP_BODY_MALFORMED'],
      ['wrong schema marker', malformed.wrongSchema, 'VICT_HTTP_BODY_MALFORMED'],
    ];
    for (const [label, result, expectedCode] of malformedCases) {
      if (result.status !== 400 || result.body?.code !== expectedCode) {
        fail(
          `${label} did not fail closed with ${expectedCode}: ${JSON.stringify(result).slice(0, 200)}`,
        );
      } else {
        note(`${label} -> 400 ${expectedCode} (fail closed)`);
      }
    }
    if (
      malformed.noHeader.status !== 400 ||
      malformed.noHeader.body?.code !== 'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID'
    ) {
      fail(`missing idempotency header not rejected: ${JSON.stringify(malformed.noHeader)}`);
    } else {
      note('missing idempotency-key header -> 400 VICT_COMMAND_IDEMPOTENCY_KEY_INVALID');
    }

    // ---------- requirement 12: FULL-PROCESS restart ----------------------
    note('restarting the whole application process (SIGKILL) on the same data dir');
    server.child.kill('SIGKILL');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
    server = startServer();
    const origin2 = await waitOrigin(server);
    note(`fresh process serving at ${origin2}`);
    await openThread(page, origin2, 'Reconnect stop');
    await cancelledOutcomeVisible(page);
    const messagesAfterRestart = await threadMessagesFromPage(page, threadIdB);
    const turnsAfterRestart = messagesAfterRestart?.turns ?? [];
    if (turnsAfterRestart.length !== 1 || turnsAfterRestart[0]?.status !== 'cancelled') {
      fail(
        `restart restore is not the truthful single cancelled turn: ${JSON.stringify(turnsAfterRestart)}`,
      );
    } else {
      note('full-process restart restored the cancelled outcome (exactly one cancelled turn)');
    }
    const replayAfterRestart = await replayTerminalKindsFromPage(page, streamIdB);
    const terminalsAfterRestart = (replayAfterRestart.kinds ?? []).filter((kind) =>
      ['response.completed', 'response.failed', 'response.cancelled'].includes(kind),
    );
    if (terminalsAfterRestart.length !== 1 || terminalsAfterRestart[0] !== 'response.cancelled') {
      fail(`post-restart replay shows wrong terminals: ${JSON.stringify(replayAfterRestart)}`);
    } else {
      note('post-restart stream replay: still exactly ONE response.cancelled terminal');
    }

    // ---------- requirement 9: no unexpected console/network problems -----
    const beforeC = consoleProblems.slice(0, consoleBeforeC);
    if (beforeC.length > 0) {
      fail(`console/network problems during scenarios A/B: ${JSON.stringify(beforeC)}`);
    } else {
      note('zero console warnings/errors and zero 5xx responses during the real Stop flows');
    }

    await context.close();
  } catch (error) {
    fail(`browser regression crashed: ${String(error && error.stack ? error.stack : error)}`);
    if (server.getLog().length > 0) {
      console.error(`--- dev server log (tail) ---
${server.getLog().slice(-1500)}`);
    }
  } finally {
    if (browser !== undefined) {
      await browser.close().catch(() => undefined);
    }
    server.child.kill('SIGKILL');
    rmRfRetry(dataDir);
    rmRfRetry(tmp);
    note('browser, dev server, data dir, and temp artifacts removed');
  }
};

// ---------------------------------------------------------------------------
await negativeControl();
await browserRegression();

console.log('');
if (failures.length > 0) {
  console.error(`browser-stop-check: FAILED with ${failures.length} finding(s):`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}
console.log(
  'browser-stop-check: PASS — old-commit negative control + real-browser Stop flow green.',
);
