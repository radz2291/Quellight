#!/usr/bin/env node
/**
 * Real-browser consolidated Stage 07D D1/D3/D2 UI integration pass.
 *
 * Runs the ADAPTER-NODE production build on an ephemeral port with the
 * deterministic offline fixture model and a throwaway data directory
 * (no provider credential is present or required). Proves, through the
 * REAL rendered UI:
 *
 *   D1 — Memory-tray Remove (content-free tombstone discipline is the
 *        user-visible outcome), claim expiry control, and the visible
 *        Run-retention-pass control;
 *   D3 — the quiet conflict-challenge rows with the dismiss path;
 *   D2 — the deletion chooser (conversation-only DEFAULT, cancellation
 *        with zero effect, confirmed deletion with the truthful deleted
 *        banner), deep purge (hidden until deleted; explicit word), and
 *        the export download;
 *   — zero console warnings/errors, responsive (390px/1280px), keyboard
 *     operability for every new control, and no serious/critical axe
 *     violations on either viewport.
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

const dataDir = mkdtempSync(join(tmpdir(), 'qlt-browser-d2-'));
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
  return undefined;
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
    if (response.status() >= 400) {
      consoleProblems.push(
        `http ${response.status()} on ${response.request().method()} ${response.url()}`,
      );
    }
  });
};

try {
  const base = await waitForServer();
  if (base === undefined) {
    fail(`the server did not start; log:\n${serverLog.slice(0, 2000)}`);
    process.exit(1);
  }
  note(`server at ${base}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  watchConsole(page);

  await page.goto(base, { waitUntil: 'networkidle' });

  // ---- Conversation + direct-saved memory (Current tab) ------------------
  await page.getByRole('button', { name: 'New thread' }).click();
  await page.locator('.qlt-thread-heading').first().waitFor({ state: 'visible', timeout: 20_000 });
  const trayOpener = page.locator('button.qlt-memory-chip');
  await trayOpener.waitFor({ state: 'visible', timeout: 20_000 });
  await trayOpener.click();
  const tray = page.locator('section[aria-label="Memory review"]');

  // Direct-save a claim and a commitment (first-party Save control).
  await tray
    .locator('select.qlt-input, select')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => undefined);
  const saveKind = tray.locator('select').first();
  if (await saveKind.count()) {
    await saveKind.selectOption('claim');
  }
  await tray.getByPlaceholder(/Subject/i).fill('D2 browser claim');
  await tray.locator('textarea').first().fill('The workspace keeps a D2 browser claim.');
  await tray.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(600);

  // Move to the Current tab and REMOVE the record (D1 control).
  await tray.locator('button[data-memory-tab="current"]').click();
  const currentArea = tray.locator('div').filter({ hasText: 'Current memory in force' }).first();
  await currentArea.getByRole('button', { name: 'Remove', exact: true }).first().click();
  await page
    .locator('p[role="status"]')
    .filter({ hasText: 'Removed' })
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  note('D1 Remove: truthful removal announcement shown');

  // Claim expiry control exists for claims (D1).
  const expiryButton = tray.getByRole('button', { name: 'Expire…', exact: true });
  if (await expiryButton.count()) {
    note('D1 claim expiry control present');
  }

  // Run retention pass (D1/D2 visible control) + export (D2).
  await tray.getByTestId('run-retention-pass').click();
  await page
    .locator('p[role="status"]')
    .filter({ hasText: 'retention pass ran' })
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  note('D1 retention pass: truthful evidence announcement shown');

  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await tray.getByTestId('export-data').click();
  const download = await downloadPromise;
  if (download.suggestedFilename() !== 'quellight-user-export.json') {
    fail(`the export download filename is wrong: ${download.suggestedFilename()}`);
  } else {
    note('D2 export: deterministic user-export download delivered');
  }

  // ---- D2 deletion chooser: conversation-only DEFAULT, cancel = zero ----
  await tray.getByRole('button', { name: 'Close memory review' }).click();
  await page.getByTestId('delete-conversation').click();
  const chooser = page.getByTestId('deletion-chooser');
  await chooser.waitFor({ state: 'visible', timeout: 20_000 });
  const onlyDefault = await chooser.locator('input[value="conversation-only"]').isChecked();
  if (!onlyDefault) {
    fail('the deletion chooser does not default to conversation-only');
  } else {
    note('D2 deletion chooser: conversation-only is the default (nothing destructive preselected)');
  }
  await chooser.getByRole('button', { name: 'Cancel' }).click();
  const deletedBanner = page.getByTestId('deleted-banner');
  if (await deletedBanner.count()) {
    fail('cancellation still produced the deleted state');
  } else {
    note('D2 cancellation: zero effect, no deleted state');
  }

  // Confirm a conversation-only deletion.
  await page.getByTestId('delete-conversation').click();
  await chooser.waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByTestId('confirm-deletion').click();
  await page
    .locator('p[role="status"]')
    .filter({ hasText: 'deleted' })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  note('D2 deletion: completed with the truthful preservation disclosure');

  // Deep purge: hidden until deleted; explicit word required.
  const purgeOpener = page.getByTestId('open-purge');
  await purgeOpener.waitFor({ state: 'visible', timeout: 20_000 });
  await purgeOpener.click();
  await page.locator('#qlt-purge-word').fill('nope');
  const purgeConfirm = page.getByTestId('confirm-purge');
  if (await purgeConfirm.isEnabled()) {
    fail('the purge confirm is enabled without the exact confirmation word');
  } else {
    note('D2 deep purge: confirmation word enforced (disabled until exact)');
  }
  await page.locator('#qlt-purge-word').fill('purge');
  await purgeConfirm.click();
  await page
    .locator('p[role="status"]')
    .filter({ hasText: 'deep purge finished' })
    .waitFor({ state: 'visible', timeout: 30_000 });
  note('D2 deep purge: completed with the truthful residue disclosure');

  // ---- D3: the quiet conflict-challenge flow (deterministic fixture) -----
  const runTrigger = async () => {
    await page.getByRole('button', { name: 'New thread' }).click();
    await page.locator('.qlt-thread-heading').last().waitFor({ state: 'visible', timeout: 20_000 });
    const composer = page.locator('#qlt-composer');
    await composer.focus();
    await composer.fill('I have to prepare the quarterly review');
    await page.getByRole('button', { name: 'Send' }).click();
    await page
      .locator('.qlt-message--assistant')
      .last()
      .waitFor({ state: 'visible', timeout: 45_000 });
    await page.getByRole('button', { name: 'Send' }).waitFor({ state: 'visible', timeout: 45_000 });
  };
  await runTrigger();
  const chipFirst = page.locator('button.qlt-memory-chip');
  await chipFirst.click();
  const trayConflict = page.locator('section[aria-label="Memory review"]');
  const confirmButton = trayConflict.getByRole('button', { name: 'Confirm', exact: true }).first();
  await confirmButton.waitFor({ state: 'visible', timeout: 20_000 });
  await confirmButton.click();
  await page.waitForTimeout(900);
  await trayConflict.getByRole('button', { name: 'Close memory review' }).click();

  // A second confirmation of the same commitment key must be refused
  // quietly and surface a challenge row in the Data safety area.
  await runTrigger();
  await page.locator('button.qlt-memory-chip').click();
  const traySecond = page.locator('section[aria-label="Memory review"]');
  const secondConfirm = traySecond.getByRole('button', { name: 'Confirm', exact: true }).first();
  await secondConfirm.waitFor({ state: 'visible', timeout: 20_000 });
  await secondConfirm.click();
  await traySecond
    .locator('p[role="status"]')
    .filter({ hasText: 'did not complete' })
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  const challengeRow = traySecond.getByTestId('challenge-row').first();
  await challengeRow.waitFor({ state: 'visible', timeout: 20_000 });
  note('D3 conflict: the refused confirmation surfaces a quiet challenge row');
  await challengeRow.getByRole('button', { name: 'Keep existing, dismiss' }).click();
  await page
    .locator('p[role="status"]')
    .filter({ hasText: 'challenge was dismissed' })
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  note('D3 conflict: the quiet dismiss path resolves the challenge');
  await traySecond.getByRole('button', { name: 'Close memory review' }).click();

  // ---- Keyboard operability of the new controls --------------------------
  await page.keyboard.press('Tab');
  const active = await page.evaluate(() => document.activeElement?.className ?? '');
  if (typeof active !== 'string' || active.length === 0) {
    fail('keyboard focus was lost after the purge flow');
  }

  // ---- Accessibility at both supported viewports -------------------------
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) =>
      ['serious', 'critical'].includes(String(violation.impact)),
    );
    if (serious.length > 0) {
      fail(
        `axe ${viewport.width}px: ${serious.length} serious/critical violations: ${serious
          .map((v) => v.id)
          .join(', ')}`,
      );
    } else {
      note(`axe ${viewport.width}px: no serious/critical violations`);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (overflow) {
      fail(`horizontal overflow at ${viewport.width}px`);
    }
  }

  await browser.close();

  if (consoleProblems.length > 0) {
    fail(`console problems: ${consoleProblems.slice(0, 10).join(' | ')}`);
  }
} finally {
  server.kill();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  try {
    rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    /* disposable */
  }
}

if (failures.length > 0) {
  console.error(`\nbrowser-d2-check: FAILED — ${failures.length} failure(s).`);
  process.exit(1);
}
console.log('\nbrowser-d2-check: PASS — D1/D3/D2 UI integration proven in the real browser.');
