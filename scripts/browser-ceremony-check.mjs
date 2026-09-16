#!/usr/bin/env node
/**
 * TEST-1 — the permanent real-browser ceremony recovery proof (Stage 07C
 * Phase Q3; frozen contract §14).
 *
 * Uses the ADAPTER-NODE production build on an ephemeral port with the
 * deterministic offline fixture model and a throwaway data directory — the
 * full governed path is real: real UI → /api/act → released VICT 0.2.0
 * boundary → memory surface → shared-world.db; real turn streaming →
 * pinned capability (qlt.proposal.draft via the tool bridge) → inert
 * proposal. No provider credential exists or is required.
 *
 * Proves (freeze §14 browser surfaces):
 *   1.  a fixture agent turn invokes the proposal capability;
 *   2.  the conversation continues and a quiet pending count appears;
 *   3.  the inbox does not open or steal focus automatically;
 *   4.  reload re-presents the pending proposal;
 *   5.  user confirmation crosses the governed boundary (keyboard-only);
 *   6.  a hard reload around the commit boundary converges on the truth;
 *   7.  exactly one target record exists;
 *   9.  rejected and withdrawn proposals create no canonical record;
 *   11. keyboard-only review and decision work;
 *   12. the accessibility baseline stays clean (axe, both viewports,
 *       tray open).
 * (Freeze §14 items 8, 10, 13, 14 are proven at the node/structural level by
 * test/ceremony-authority.test.ts and scripts/verify-q3.mjs.)
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

const TRIGGER_CLAIM = 'I keep important details scattered everywhere';
const TRIGGER_COMMITMENT = 'I have to prepare the quarterly review';
const TRIGGER_LOOP = 'I still need to figure out the travel plans';

const dataDir = mkdtempSync(join(tmpdir(), 'qlt-ceremony-'));
const server = spawn(process.execPath, [join(process.cwd(), 'build', 'index.js')], {
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
const watchConsole = (page) => {
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
      consoleProblems.push(`http ${response.status()} on ${response.request().method()} ${response.url()}`);
    }
  });
};

/** Create a thread, send one trigger, and wait for the assistant reply. */
const runScenario = async (page, trigger) => {
  await page.getByRole('button', { name: 'New thread' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.qlt-thread-heading').first().waitFor({ state: 'visible', timeout: 20_000 });
  const composer = page.locator('#qlt-composer');
  await composer.focus();
  await composer.fill(trigger);
  await page.getByRole('button', { name: 'Send' }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.qlt-message--assistant').last().waitFor({ state: 'visible', timeout: 45_000 });
  // The quiet pending chip appears (1 pending proposal on the fresh thread).
  const chip = page.locator('button.qlt-memory-chip');
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  return chip;
};

const openThreadAt = async (page, index) => {
  const threadButton = page.locator('button.qlt-thread').nth(index);
  await threadButton.waitFor({ state: 'visible', timeout: 20_000 });
  await threadButton.click();
  await page.locator('.qlt-thread-heading').first().waitFor({ state: 'visible', timeout: 20_000 });
};

const openTray = async (page) => {
  const chip = page.locator('button.qlt-memory-chip');
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  await chip.focus();
  await page.keyboard.press('Enter');
  await page.locator('section[aria-label="Memory review"]').waitFor({ state: 'visible', timeout: 20_000 });
  // The rows load asynchronously after the tray opens; wait for content.
  await page.locator('.qlt-memory-item').first().waitFor({ state: 'visible', timeout: 20_000 });
};

try {
  const origin = await waitForServer();
  note(`production server listening at ${origin}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  watchConsole(page);

  await page.goto(origin, { waitUntil: 'networkidle' });

  // ---------- Scenario A: draft → quiet indicator → reload → confirm ----------
  const chip = await runScenario(page, TRIGGER_CLAIM);
  note('1/2: fixture agent turn invoked the proposal capability; the pending chip appeared');
  const chipLabel = await chip.getAttribute('aria-label');
  if (!chipLabel || !chipLabel.includes('1 pending')) {
    fail(`the chip does not report exactly 1 pending proposal (${chipLabel})`);
  } else {
    note('2: the quiet pending count reads exactly 1 pending proposal');
  }

  // 3: the inbox did NOT open or steal focus automatically.
  const trayDuringStream = await page.locator('section[aria-label="Memory review"]').count();
  if (trayDuringStream !== 0) {
    fail('the memory tray opened by itself (auto-open violation)');
  }
  const activeAfterTurn = await page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName);
  if (activeAfterTurn === 'qlt-memory-chip' || /memory/i.test(String(activeAfterTurn))) {
    fail(`focus was stolen by the memory surface (activeElement=${activeAfterTurn})`);
  }
  const composerStillEnabled = await page.locator('#qlt-composer').isEnabled();
  if (!composerStillEnabled) {
    fail('the composer was disabled while a proposal was pending (blocking violation)');
  }
  note('3: the tray stayed closed, focus was not stolen, and the composer stayed enabled');

  // 4: reload re-presents the pending proposal.
  await page.reload({ waitUntil: 'networkidle' });
  await openThreadAt(page, 0);
  await page.locator('button.qlt-memory-chip').waitFor({ state: 'visible', timeout: 20_000 });
  note('4: reload re-presented the pending proposal indicator');

  // 5 + 11: keyboard-only review and confirm.
  await openTray(page);
  const tray = page.locator('section[aria-label="Memory review"]');
  const trayText = (await tray.textContent()) ?? '';
  for (const expected of ['Possible claim', 'Deep work preferences', 'Drafted by the assistant', 'Confirm', 'Edit', 'Reject', 'Withdraw', 'Remember this']) {
    if (!trayText.includes(expected)) {
      fail(`the review tray is missing expected content: ${expected}`);
    }
  }
  const confirmButton = tray.getByRole('button', { name: 'Confirm', exact: true }).first();
  await confirmButton.focus();
  await page.keyboard.press('Enter');
  await tray.locator('.qlt-memory-status[data-status="confirmed"]').first().waitFor({ state: 'visible', timeout: 20_000 });
  note('5 + 11: keyboard-only review and confirm crossed the governed boundary');

  // 6 + 7: hard reload around the commit boundary converges on the truth;
  // exactly one claim record exists and the proposal is confirmed.
  await page.reload({ waitUntil: 'networkidle' });
  await openThreadAt(page, 0);
  await openTray(page);
  await tray.locator('.qlt-memory-status[data-status="confirmed"]').first().waitFor({ state: 'visible', timeout: 20_000 });
  const recordBadges = tray.locator('.qlt-memory-item[data-kind="claim"] .qlt-memory-status[data-status="active"]');
  const claimCount = await recordBadges.count();
  if (claimCount !== 1) {
    fail(`expected EXACTLY one confirmed claim record after the ceremony, found ${claimCount}`);
  } else {
    note('6 + 7: hard reload converged on the truthful confirmed state; exactly one claim record exists');
  }
  await tray.getByRole('button', { name: 'Close memory review' }).click();

  // ---------- Scenario B: reject creates no canonical record ----------
  await runScenario(page, TRIGGER_COMMITMENT);
  await openTray(page);
  await tray.getByRole('button', { name: 'Reject', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  await tray.locator('.qlt-memory-status[data-status="rejected"]').first().waitFor({ state: 'visible', timeout: 20_000 });
  const rejectedClaims = await tray.locator('.qlt-memory-item[data-kind="commitment"] .qlt-memory-status[data-status="active"]').count();
  if (rejectedClaims !== 0) {
    fail('a rejected proposal produced a canonical record (authority violation)');
  } else {
    note('9a: the rejected proposal created no canonical record');
  }
  await tray.getByRole('button', { name: 'Close memory review' }).click();

  // ---------- Scenario C: withdraw creates no canonical record ----------
  await runScenario(page, TRIGGER_LOOP);
  await openTray(page);
  await tray.getByRole('button', { name: 'Withdraw', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  await tray.locator('.qlt-memory-status[data-status="withdrawn"]').first().waitFor({ state: 'visible', timeout: 20_000 });
  const withdrawnLoops = await tray.locator('.qlt-memory-item[data-kind="open_loop"] .qlt-memory-status[data-status="open"]').count();
  if (withdrawnLoops !== 0) {
    fail('a withdrawn proposal produced a canonical record (authority violation)');
  } else {
    note('9b: the withdrawn proposal created no canonical record');
  }

  // ---------- 12: responsive + axe with the tray OPEN ----------
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
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
    if (!(await page.locator('#qlt-composer').isVisible())) {
      fail(`${viewport.name}: composer not visible with the tray open`);
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
          .map(
            (violation) =>
              `${violation.id}(${violation.nodes.length}): ${violation.nodes
                .map((node) => node.target.join(' '))
                .slice(0, 4)
                .join(' | ')}`,
          )
          .join('; ')}`,
      );
    } else {
      note(`${viewport.name}: axe clean with the memory tray open`);
    }
  }

  // ---------- final assertion: zero console problems ----------
  if (consoleProblems.length > 0) {
    fail(`console problems detected during the whole session: ${consoleProblems.join(' | ')}`);
  } else {
    note('ZERO console warnings/errors across the entire ceremony session');
  }

  await context.close();
  await browser.close();
} catch (error) {
  fail(`ceremony check crashed: ${String(error && error.stack ? error.stack : error)}`);
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
  console.error(`browser-ceremony-check: FAILED with ${failures.length} finding(s).`);
  process.exit(1);
}
console.log('browser-ceremony-check: PASS — TEST-1 real-browser ceremony recovery proof green.');
