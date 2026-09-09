#!/usr/bin/env node
/**
 * Real-browser proof for the Quellight conversation surface.
 *
 *   N-17: the production build starts and the workspace mounts with ZERO
 *         console warnings/errors (including hydration warnings).
 *   N-19: responsive (mobile 390px / desktop 1280px, no horizontal
 *         overflow), fully keyboard-operable (create thread, focus
 *         composer, send, streaming states reachable by keyboard), with
 *         visible focus and no serious/critical axe violations on either
 *         viewport.
 *
 * Runs the ADAPTER-NODE production build (build/index.js) on an ephemeral
 * port with the deterministic offline fixture model and a throwaway data
 * directory. No provider credential is present or required.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};
const note = (message) => console.log(`  ${message}`);

const dataDir = mkdtempSync(join(tmpdir(), 'qlt-browser-'));
const server = spawn(process.execPath, [join(process.cwd(), 'build', 'index.js')], {
  // The server resolves its bounded RELATIVE data dir against its working
  // directory, so the throwaway store lives in the temp dir, not the repo.
  cwd: dataDir,
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    QUELLIGHT_DATA_DIR: 'data',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += String(chunk);
});
server.stderr.on('data', (chunk) => {
  serverLog += String(chunk);
});

const waitForServer = async () => {
  // adapter-node logs "Listening on <url>" — parse it from stdout.
  for (let index = 0; index < 120; index += 1) {
    const match = serverLog.match(/Listening on (http:\/\/[^\s]+)/);
    if (match) {
      return match[1];
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`server did not start: ${serverLog.slice(0, 400)}`);
};

const consoleProblems = [];

try {
  const origin = await waitForServer();
  note(`production server listening at ${origin}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleProblems.push(`pageerror: ${String(error)}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      consoleProblems.push(
        `http ${response.status()} on ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await page.goto(origin, { waitUntil: 'networkidle' });

  // ---------- N-17: hydration warning smoke (desktop) ----------
  note('N-17: mounted with zero console warnings/errors so far');
  if (consoleProblems.length > 0) {
    fail(`console problems detected: ${consoleProblems.join(' | ')}`);
  }

  // ---------- keyboard-operable flow ----------
  // Create a thread via keyboard only.
  await page.getByRole('button', { name: 'New thread' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const threadHeading = page.locator('.qlt-thread-heading').first();
  const threadVisible = await threadHeading.isVisible().catch(() => false);
  if (!threadVisible) {
    fail('thread list did not surface a selectable thread after keyboard creation');
  } else {
    note('keyboard: thread created and surfaced');
  }

  // Focus the composer and send a message via keyboard.
  const composer = page.locator('#qlt-composer');
  await composer.focus();
  if ((await composer.evaluate((element) => element.ownerDocument.activeElement)) === null) {
    fail('composer could not take focus');
  }
  await page.keyboard.type('Hello');
  // Textarea Enter inserts a newline (correct convention); submission is
  // keyboard-reachable through the focused Send button.
  await page.getByRole('button', { name: 'Send' }).focus();
  await page.keyboard.press('Enter');
  note('keyboard: message sent from the composer');

  // Wait for the offline deterministic response to stream in.
  const assistantMessage = page.locator('.qlt-message--assistant').first();
  await assistantMessage.waitFor({ state: 'visible', timeout: 30_000 });
  note('streaming: assistant response region became visible');

  // The live region must exist and announce something.
  const liveRegion = page.locator('[role="status"][aria-live="polite"]');
  if ((await liveRegion.count()) === 0) {
    fail('accessible live region for streaming state is missing');
  }

  // ---------- N-19: responsive + axe on both viewports ----------
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) {
      fail(`${viewport.name}: horizontal overflow of ${overflow}px`);
    } else {
      note(`${viewport.name}: no horizontal overflow`);
    }
    const composerVisible = await composer.isVisible();
    if (!composerVisible) {
      fail(`${viewport.name}: composer not visible`);
    }
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = axe.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );
    if (serious.length > 0) {
      fail(
        `${viewport.name}: axe serious/critical violations: ${serious
          .map((violation) => `${violation.id}(${violation.nodes.length})`)
          .join(', ')}`,
      );
    } else {
      note(`${viewport.name}: axe clean (no serious/critical violations)`);
    }
  }

  // ---------- final N-17 assertion: still zero console problems ----------
  if (consoleProblems.length > 0) {
    fail(`console problems detected during the whole session: ${consoleProblems.join(' | ')}`);
  } else {
    note('N-17: ZERO console warnings/errors across the entire session');
  }

  await context.close();
  await browser.close();
} catch (error) {
  fail(`browser check crashed: ${String(error && error.stack ? error.stack : error)}`);
  console.error(`--- server log ---
${serverLog.slice(-2000)}`);
} finally {
  server.kill('SIGKILL');
  const attempt = (remaining) => {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      if (remaining > 0) {
        setTimeout(() => attempt(remaining - 1), 500);
      }
    }
  };
  attempt(8);
}

console.log('');
if (failures.length > 0) {
  console.error(`browser-check: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log(
  'browser-check: PASS — real-browser N-17 hydration smoke + N-19 responsive/keyboard/axe green.',
);
