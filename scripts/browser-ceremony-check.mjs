#!/usr/bin/env node
/**
 * TEST-1 — the permanent real-browser ceremony recovery proof (Stage 07C
 * Phase Q3; frozen contract §14).
 *
 * Uses the ADAPTER-NODE production build on an ephemeral port with the
 * deterministic offline fixture model and a throwaway data directory — the
 * full governed path is real: real UI → /api/act → released VICT 0.3.0-rc.1
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
 * Q4 (Lane E) additions:
 *   L-2 stale refusal through the REAL governed boundary (one disclosed
 *       seeding fixture; the staleness cause and the refused confirmation
 *       cross the real UI/API path; zero canonical effect);
 *   M-2 a real Escape key closes the tray with focus on the chip;
 *   D-Q4-6 the quiet transparency line (used + unavailable states).
 * Q5 (Lane E) additions (frozen contract §15):
 *   the four-area surface (Pending / Current / History / Used for reply);
 *   the Memory Mode control (three frozen choices, applies-to-all scope
 *       statement, current durable mode displayed);
 *   lifecycle transitions through Current (direct-Save commitment ->
 *       Release commitment -> History, inspect-only);
 *   Used-for-reply recorded evidence (applied mode, historical selected
 *       versions, technical ids hidden behind Details);
 *   MID-TURN policy-change containment (a mode change issued after
 *       admission leaves the admitted turn bound to its mode while the
 *       next turn uses the new mode);
 *   the off-turn truthful evidence and quiet line state;
 *   axe + responsive viewports with the Memory surface OPEN.
 * (Freeze §14 items 8, 10, 13, 14 are proven at the node/structural level by
 * test/ceremony-authority.test.ts and scripts/verify-q3.mjs.)
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
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
      consoleProblems.push(
        `http ${response.status()} on ${response.request().method()} ${response.url()}`,
      );
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
  // Robustness (Lane E): the thread-creation re-render can detach the
  // focused Send button and swallow the Enter activation. The send clears
  // the composer on delivery; if it did not clear promptly, deliver the
  // send with a real click on the (re-resolved) Send button.
  const sent = await (async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if ((await composer.inputValue()) === '') {
        return true;
      }
      await page.waitForTimeout(100);
    }
    return false;
  })();
  if (!sent) {
    await page.getByRole('button', { name: 'Send' }).click();
  }
  await composer.inputValue('', { timeout: 20_000 }).catch(() => undefined);
  await page
    .locator('.qlt-message--assistant')
    .last()
    .waitFor({ state: 'visible', timeout: 45_000 });
  // Q5: the Memory chip is ALWAYS present, so the script waits for the
  // turn to SETTLE (the Send control returns) and for the truthful
  // pending count to appear on the chip — never for the chip itself.
  await page.getByRole('button', { name: 'Send' }).waitFor({ state: 'visible', timeout: 45_000 });
  const chip = page.locator('button.qlt-memory-chip');
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(
    () =>
      (document.querySelector('button.qlt-memory-chip')?.getAttribute('aria-label') ?? '').includes(
        'pending',
      ),
    undefined,
    { timeout: 20_000 },
  );
  return chip;
};

const openThreadAt = async (page, index) => {
  const threadButton = page.locator('button.qlt-thread').nth(index);
  await threadButton.waitFor({ state: 'visible', timeout: 20_000 });
  await threadButton.click();
  await page.locator('.qlt-thread-heading').first().waitFor({ state: 'visible', timeout: 20_000 });
};

const openTray = async (page, tab = 'pending') => {
  const chip = page.locator('button.qlt-memory-chip');
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  const trayNow = page.locator('section[aria-label="Memory review"]');
  // Q5: the surface opens on the Pending tab. Toggle only when closed,
  // then select the requested area and wait for its content to load.
  if ((await trayNow.count()) === 0) {
    await chip.focus();
    await page.keyboard.press('Enter');
    await trayNow.waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('.qlt-memory-tabs').waitFor({ state: 'visible', timeout: 20_000 });
  }
  const tabButton = page.locator(`button[data-memory-tab="${tab}"]`);
  if ((await tabButton.getAttribute('aria-pressed')) !== 'true') {
    await tabButton.click();
  }
  await page.waitForTimeout(400);
};

// ---------------------------------------------------------------------------
// Q4 (Lane E) helpers
// ---------------------------------------------------------------------------

/** Canonical JSON (keys sorted) — the frozen Q2 serialization primitive. */
const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

/**
 * Disclosed fixture boundary (freeze §10, L-2): seed a PENDING correction
 * proposal DIRECTLY into the disposable store database — production wires
 * no pending-correction path (the pinned capability rejects
 * `proposalKind: 'correction'`; repository-level capability, Q2-frozen).
 * The staleness CAUSE and the REFUSED CONFIRMATION below still cross the
 * REAL governed boundary (the UI path through /api/act).
 */
const seedPendingCorrection = (dbPath, id) => {
  const raw = new DatabaseSync(dbPath);
  try {
    const thread = raw
      .prepare('SELECT id FROM qlt_thread ORDER BY created_at_ms ASC, id ASC LIMIT 1;')
      .get();
    const claim = raw
      .prepare(
        "SELECT id, version, subject FROM qlt_claim WHERE status = 'active' " +
          'ORDER BY version DESC, updated_at_ms DESC, id ASC LIMIT 1;',
      )
      .get();
    if (thread === undefined || claim === undefined) {
      return undefined;
    }
    const now = Date.now();
    const content = {
      statement: 'A stale pending correction proposal seeded by the browser check (fixture).',
      subject: String(claim.subject ?? ''),
    };
    raw
      .prepare(
        `INSERT INTO qlt_proposal
           (id, version, status, proposal_kind, content, content_fingerprint, proposed_by,
            decision_by, decided_at_ms, decision_reason, target_record_id, target_record_family,
            target_record_version, source_thread_id, source_turn_ref, created_at_ms,
            updated_at_ms, effective_at_ms, retention_state)
         VALUES (?, 1, 'proposed', 'correction', ?, ?, 'actor-quellight-local', NULL, NULL,
                 NULL, ?, 'claim', ?, ?, NULL, ?, ?, ?, 'currently-relevant');`,
      )
      .run(
        id,
        JSON.stringify(content),
        createHash('sha256')
          .update(Buffer.from(canonicalJson(content), 'utf8'))
          .digest('hex'),
        claim.id,
        claim.version,
        thread.id,
        now,
        now,
        now,
      );
    return { claimId: String(claim.id), targetVersion: Number(claim.version) };
  } finally {
    raw.close();
  }
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
  const activeAfterTurn = await page.evaluate(
    () => document.activeElement?.id ?? document.activeElement?.tagName,
  );
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
  for (const expected of [
    'Possible claim',
    'Deep work preferences',
    'Drafted by the assistant',
    'Confirm',
    'Edit',
    'Reject',
    'Withdraw',
    'Remember this',
  ]) {
    if (!trayText.includes(expected)) {
      fail(`the review tray is missing expected content: ${expected}`);
    }
  }
  const confirmButton = tray.getByRole('button', { name: 'Confirm', exact: true }).first();
  await confirmButton.focus();
  await page.keyboard.press('Enter');
  // Q5: the terminal (confirmed) proposal is presented in the HISTORY area.
  await openTray(page, 'history');
  await tray
    .locator('.qlt-memory-status[data-status="confirmed"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  note('5 + 11: keyboard-only review and confirm crossed the governed boundary');

  // 6 + 7: hard reload around the commit boundary converges on the truth;
  // exactly one claim record exists (CURRENT area) and the proposal is
  // confirmed (HISTORY area).
  await page.reload({ waitUntil: 'networkidle' });
  await openThreadAt(page, 0);
  await openTray(page, 'current');
  const recordBadges = tray.locator(
    '.qlt-memory-item[data-kind="claim"] .qlt-memory-status[data-status="active"]',
  );
  const claimCount = await recordBadges.count();
  if (claimCount !== 1) {
    fail(`expected EXACTLY one confirmed claim record after the ceremony, found ${claimCount}`);
  } else {
    note(
      '6 + 7: hard reload converged on the truthful confirmed state; exactly one claim record exists',
    );
  }
  // Q5-H-1 remediation (non-vacuous after-confirm control): the CURRENT
  // area must hold ONLY the canonical current-effective record — ZERO
  // proposal items of any status and EXACTLY ONE item in total, so a
  // decided proposal can never appear in Current or as a duplicate-looking
  // memory item alongside the record it created.
  const currentProposalItems = await tray.locator('.qlt-memory-item[data-kind="proposal"]').count();
  const currentAllItems = await tray.locator('.qlt-memory-item').count();
  if (currentProposalItems !== 0 || currentAllItems !== 1) {
    fail(
      `the CURRENT area is not truthful after the confirm: proposal items=${currentProposalItems}, total items=${currentAllItems} (expected 0 and 1)`,
    );
  } else {
    note('Q5-H-1: Current holds ONLY the canonical record — zero proposals, no duplicate item');
  }
  await openTray(page, 'history');
  await tray
    .locator('.qlt-memory-status[data-status="confirmed"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await tray.getByRole('button', { name: 'Close memory review' }).click();

  // ---------- Scenario B: reject creates no canonical record ----------
  await runScenario(page, TRIGGER_COMMITMENT);
  await openTray(page);
  await tray.getByRole('button', { name: 'Reject', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  await openTray(page, 'history');
  await tray
    .locator('.qlt-memory-status[data-status="rejected"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await openTray(page, 'current');
  const rejectedClaims = await tray
    .locator('.qlt-memory-item[data-kind="commitment"] .qlt-memory-status[data-status="active"]')
    .count();
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
  await openTray(page, 'history');
  await tray
    .locator('.qlt-memory-status[data-status="withdrawn"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await openTray(page, 'current');
  const withdrawnLoops = await tray
    .locator('.qlt-memory-item[data-kind="open_loop"] .qlt-memory-status[data-status="open"]')
    .count();
  if (withdrawnLoops !== 0) {
    fail('a withdrawn proposal produced a canonical record (authority violation)');
  } else {
    note('9b: the withdrawn proposal created no canonical record');
  }

  // -----------------------------------------------------------------------
  // Scenario D (Q4 / Lane E): L-2 stale refusal through the REAL boundary
  // -----------------------------------------------------------------------
  // The sidebar is ordered updated_at_ms DESC (newest first); identify the
  // claim-bearing (oldest) thread deterministically by its durable title
  // and click exactly that button.
  const openOldestThreadTray = async () => {
    const rawThread = new DatabaseSync(join(dataDir, 'data', 'shared-world.db'), {
      readOnly: true,
    });
    const oldestThread = rawThread
      .prepare('SELECT title FROM qlt_thread ORDER BY created_at_ms ASC, id ASC LIMIT 1;')
      .get();
    rawThread.close();
    const claimThreadButton = page
      .locator('button.qlt-thread')
      .filter({
        has: page.locator('.qlt-thread-title', {
          hasText: String(oldestThread.title),
        }),
      })
      .last();
    await claimThreadButton.waitFor({ state: 'visible', timeout: 20_000 });
    await claimThreadButton.click();
    await page
      .locator('.qlt-thread-heading')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    // openThread() closes any open tray; if one is still closing, wait for
    // the detach before reopening deterministically.
    const trayNow = page.locator('section[aria-label="Memory review"]');
    if ((await trayNow.count()) > 0) {
      await trayNow.waitFor({ state: 'detached', timeout: 20_000 });
    }
    const chipNow = page.locator('button.qlt-memory-chip');
    await chipNow.waitFor({ state: 'visible', timeout: 20_000 });
    await chipNow.focus();
    await page.keyboard.press('Enter');
    await trayNow.waitFor({ state: 'visible', timeout: 20_000 });
    await trayNow.locator('.qlt-memory-tabs').waitFor({ state: 'visible', timeout: 20_000 });
  };
  await openOldestThreadTray();

  /** Perform one REAL governed correction of the active claim through the UI. */
  const correctClaim = async (statementSuffix) => {
    await openTray(page, 'current');
    const activeClaim = tray
      .locator('.qlt-memory-item[data-kind="claim"]:has(button:text-is("Correct"))')
      .first();
    await activeClaim.getByRole('button', { name: 'Correct', exact: true }).click();
    // the correcting row re-renders (the Correct button is replaced by the
    // editing form), so address the textarea/input via the tray directly
    await tray
      .locator('textarea.qlt-memory-input')
      .first()
      .fill(`The corrected claim statement ${statementSuffix} (browser proof).`);
    await tray
      .locator('input.qlt-memory-input[placeholder="Why is this being corrected?"]')
      .first()
      .fill('Browser ceremony stale-refusal correction');
    await tray.getByRole('button', { name: 'Save correction', exact: true }).click();
    await page.waitForTimeout(600);
  };

  // D-1: the first REAL correction (claim v1 → v2) through the UI boundary.
  await correctClaim('one');
  await page.waitForTimeout(400);
  note('D-1: a real governed correction crossed the UI/API boundary (claim now version 2)');

  // D-2 (disclosed fixture): seed a PENDING correction proposal directly
  // into the disposable store, targeting the CURRENT claim version.
  const seeded = seedPendingCorrection(
    join(dataDir, 'data', 'shared-world.db'),
    'qlt-prop-browser-stale',
  );
  if (seeded === undefined) {
    fail('the fixture pending correction proposal could not be seeded into the disposable store');
  } else {
    note(
      `D-2: pending correction proposal seeded (target claim ${seeded.claimId} v${seeded.targetVersion}; disclosed fixture boundary)`,
    );
  }

  // D-3: the staleness CAUSE crosses the REAL governed boundary: a second
  // real correction (claim v2 → v3) makes the pending proposal stale.
  await correctClaim('two');
  note('D-3: the second real correction made the pending proposal stale (real governed action)');

  // D-4: a hard reload re-presents the proposal as STALE.
  await page.reload({ waitUntil: 'networkidle' });
  await openOldestThreadTray();
  const staleBadge = tray.locator('.qlt-memory-status[data-status="stale"]').first();
  await staleBadge.waitFor({ state: 'visible', timeout: 20_000 });
  const staleText = ((await staleBadge.textContent()) ?? '').trim();
  if (!staleText.includes('out of date')) {
    fail(`the stale proposal badge does not read "out of date" (${staleText})`);
  } else {
    note('D-4: hard reload re-presented the pending correction proposal as stale (out of date)');
  }

  // D-5: the UNCHANGED confirm visibly fails with QLT_PROPOSAL_STALE and
  // has ZERO canonical effect.
  const staleConfirm = tray
    .locator('.qlt-memory-item[data-stale="true"]')
    .getByRole('button', { name: 'Confirm', exact: true })
    .first();
  await staleConfirm.click();
  const staleError = tray.locator('.qlt-memory-error');
  await staleError.waitFor({ state: 'visible', timeout: 20_000 });
  const staleErrorText = ((await staleError.textContent()) ?? '').trim();
  if (!staleErrorText.includes('QLT_PROPOSAL_STALE')) {
    fail(
      `the refused stale confirmation is not visible with QLT_PROPOSAL_STALE (${staleErrorText})`,
    );
  } else {
    note('D-5a: the unchanged confirm visibly failed with QLT_PROPOSAL_STALE in the tray');
  }
  // zero canonical effect: exactly one ACTIVE claim (the real v3 successor);
  // the stale proposal stays pending; the durable correction lineage has
  // exactly the two real rows (never a third from the refused confirm).
  await openTray(page, 'current');
  const activeClaims = await tray
    .locator('.qlt-memory-item[data-kind="claim"] .qlt-memory-status[data-status="active"]')
    .count();
  if (activeClaims !== 1) {
    fail(
      `zero-effect violation: expected exactly 1 active claim after the refusal, found ${activeClaims}`,
    );
  }
  const rawAfter = new DatabaseSync(join(dataDir, 'data', 'shared-world.db'), {
    readOnly: true,
  });
  const correctionCount = rawAfter.prepare('SELECT COUNT(*) AS total FROM qlt_correction;').get();
  const stalePending = rawAfter
    .prepare(
      "SELECT status, COUNT(*) AS total FROM qlt_proposal WHERE id = 'qlt-prop-browser-stale' AND status IN ('proposed','awaiting_decision') GROUP BY status;",
    )
    .get();
  rawAfter.close();
  // The refusal may have moved the proposal to awaiting_decision (the
  // pre-confirm transition) — it must still be PENDING and undecided.
  if (
    Number(correctionCount.total) !== 2 ||
    stalePending === undefined ||
    Number(stalePending.total) !== 1
  ) {
    fail(
      `zero-effect violation: corrections=${correctionCount.total} (expected 2), ` +
        `seeded proposal still pending=${stalePending === undefined ? 0 : stalePending.total} (expected 1)`,
    );
  } else {
    note(
      `D-5b: zero canonical effect — the refusal created no record and no correction row (proposal still ${stalePending.status})`,
    );
  }

  // -----------------------------------------------------------------------
  // Q4 (Lane E): M-2 Escape-to-close with focus return (real browser)
  // -----------------------------------------------------------------------
  const closeButton = tray.getByRole('button', { name: 'Close memory review' });
  await closeButton.focus();
  await page.keyboard.press('Escape');
  await page
    .locator('section[aria-label="Memory review"]')
    .waitFor({ state: 'detached', timeout: 20_000 });
  const focusAfterEscape = await page.evaluate(() => {
    const active = document.activeElement;
    return `${active?.tagName ?? ''} ${active?.className ?? ''}`;
  });
  if (!focusAfterEscape.includes('qlt-memory-chip')) {
    fail(`Escape did not return focus to the memory chip (activeElement=${focusAfterEscape})`);
  } else {
    note('M-2: a real Escape key closed the tray and focus returned to the memory chip');
  }
  if (!(await page.locator('#qlt-composer').isEnabled())) {
    fail('the composer was disabled by the Escape close (blocking violation)');
  }

  // -----------------------------------------------------------------------
  // Q4 (Lane E): the quiet transparency line — used / unavailable
  // -----------------------------------------------------------------------
  // A plain follow-up turn (fixture: 'Hello' → text reply).
  const composer = page.locator('#qlt-composer');
  await composer.focus();
  await composer.fill('Hello');
  const assistantBefore = await page.locator('.qlt-message--assistant').count();
  await page.getByRole('button', { name: 'Send' }).focus();
  await page.keyboard.press('Enter');
  // wait for a NEW assistant message (the turn's reply)
  await page
    .locator('.qlt-message--assistant')
    .nth(assistantBefore)
    .waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(1_500);
  // the conversation stayed uninterrupted: composer enabled, tray closed
  if (!(await composer.isEnabled())) {
    fail('the composer was disabled by the follow-up turn (interrupted conversation)');
  }
  if ((await page.locator('section[aria-label="Memory review"]').count()) !== 0) {
    fail('the memory tray opened itself during the follow-up turn');
  }
  note('Q4: the follow-up turn completed with the composer enabled and the tray closed');

  // The quiet line inside the USER-OPENED tray reads the used state.
  await openTray(page);
  const assemblyLine = tray.locator('.qlt-memory-assembly');
  await assemblyLine.waitFor({ state: 'visible', timeout: 20_000 });
  let lineText = ((await assemblyLine.textContent()) ?? '').trim();
  // the thread holds exactly one current-effective claim (v3): the latest
  // assembled turn used exactly 1 memory
  if (lineText !== 'Your last reply here used 1 memory.') {
    fail(`the quiet usage line is not truthful ("${lineText}", expected the used-1 state)`);
  } else {
    note('Q4: the quiet transparency line reads "Your last reply here used 1 memory."');
  }

  // The unavailable state (disclosed boundary fixture): the summary
  // response is intercepted with the frozen truthful failure shape; the
  // island must render the unavailable state (the underlying truth — a
  // real failed assembly record renders unavailable — is proven at node
  // level by the Lane B/Lane D suites).
  await page.route('**/assembly*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assembly: { outcome: 'failed', usedCount: 0 } }),
    }),
  );
  await page.waitForTimeout(200);
  await tray.getByRole('button', { name: 'Close memory review' }).click();
  await page
    .locator('section[aria-label="Memory review"]')
    .waitFor({ state: 'detached', timeout: 20_000 });
  await openTray(page);
  lineText = ((await tray.locator('.qlt-memory-assembly').textContent()) ?? '').trim();
  await page.unroute('**/assembly*');
  if (lineText !== 'Memory unavailable for this turn') {
    fail(`the unavailable transparency state did not render ("${lineText}")`);
  } else {
    note(
      'Q4: the unavailable state renders truthfully (intercepted failed summary; disclosed fixture)',
    );
  }
  await tray.getByRole('button', { name: 'Close memory review' }).click();

  // -----------------------------------------------------------------------
  // Q5 (Lane E): the four-area surface, the Memory Mode control, lifecycle
  // transitions, Used-for-reply historical truth, and mid-turn containment
  // -----------------------------------------------------------------------

  // Q5-1: the Memory Mode control lives ONLY inside the surface, offers
  // exactly the three frozen choices, states that it applies to ALL
  // conversations, and shows the current durable mode.
  await openTray(page, 'pending');
  const modeFieldset = tray.locator('fieldset.qlt-memory-mode');
  await modeFieldset.waitFor({ state: 'visible', timeout: 20_000 });
  const surfaceText = ((await tray.textContent()) ?? '').replace(/\s+/g, ' ');
  for (const expected of [
    'This setting applies to all conversations',
    'Across conversations (default)',
    'Within each conversation only',
    'Memory off',
  ]) {
    if (!surfaceText.includes(expected)) {
      fail(`the Memory Mode control is missing "${expected}"`);
    }
  }
  const radioValues = await tray
    .locator('input[type="radio"][name="qlt-memory-mode"]')
    .evaluateAll((nodes) => nodes.map((node) => node.value).sort());
  if (
    JSON.stringify(radioValues) !==
    JSON.stringify(['across-conversations', 'off', 'per-conversation'])
  ) {
    fail(`the Memory Mode radios are not exactly the three frozen choices: ${radioValues}`);
  }
  for (const tabName of ['pending', 'current', 'history', 'used']) {
    if ((await tray.locator(`button[data-memory-tab="${tabName}"]`).count()) !== 1) {
      fail(`the four-area surface is missing the "${tabName}" area`);
    }
  }
  const modeCurrent = tray.locator('[data-memory-mode="across-conversations"]');
  if ((await modeCurrent.count()) === 0) {
    fail('the current durable Memory Mode is not displayed in the surface');
  }
  note('Q5-1: the Memory Mode control renders the three frozen choices with the scope statement');

  // Q5-2: lifecycle transitions through CURRENT: a direct-Save commitment
  // is released through its UI control and moves to HISTORY (inspect-only).
  await tray.locator('#qlt-save-kind').selectOption('commitment');
  await tray.locator('#qlt-save-subject').fill('browser-release');
  await tray.locator('#qlt-save-text').fill('The browser ceremony commitment to release.');
  await tray.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(900);
  await openTray(page, 'current');
  const commitmentItem = tray.locator('.qlt-memory-item[data-kind="commitment"]').first();
  await commitmentItem.waitFor({ state: 'visible', timeout: 20_000 });
  await commitmentItem.getByRole('button', { name: 'Release commitment', exact: true }).click();
  await page.waitForTimeout(900);
  const commitmentsLeft = await tray.locator('.qlt-memory-item[data-kind="commitment"]').count();
  if (commitmentsLeft !== 0) {
    fail(`the released commitment still renders as Current (${commitmentsLeft} left)`);
  }
  await openTray(page, 'history');
  await tray
    .locator('.qlt-memory-item[data-status="released"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  note('Q5-2: Release commitment moved the record from Current to the inspect-only History');

  // Q5-3: Used for reply shows RECORDED evidence: usage state, applied
  // mode, historical versions in injection order; technical identifiers
  // stay behind Details.
  await openTray(page, 'used');
  const chooser = tray.locator('#qlt-turn-chooser');
  await chooser.waitFor({ state: 'visible', timeout: 20_000 });
  const turnOptions = await chooser.locator('option').count();
  if (turnOptions < 2) {
    fail(`the Used-for-reply chooser has no completed turns (${turnOptions} options)`);
  }
  await chooser.selectOption({ index: 1 });
  await page.waitForTimeout(700);
  const usedText = ((await tray.textContent()) ?? '').replace(/\s+/g, ' ');
  if (!usedText.includes('Memory mode: Across conversations')) {
    fail('the turn detail does not display the applied Memory Mode');
  }
  if (!usedText.includes('version 1')) {
    fail('the turn detail does not display the historical selected version');
  }
  if (usedText.includes('asm-') || usedText.includes('fingerprint')) {
    fail('technical identifiers leaked outside the Details disclosure');
  }
  await tray.locator('button.qlt-memory-details-toggle').last().click();
  await page.waitForTimeout(300);
  const detailsText = ((await tray.textContent()) ?? '').replace(/\s+/g, ' ');
  if (!detailsText.includes('turnId')) {
    fail('the Details disclosure does not reveal the technical turn identity');
  }
  note(
    'Q5-3: Used for reply renders recorded evidence with the applied mode and hidden technical ids',
  );

  // Q5-4: MID-TURN containment. The send's admission completes when the
  // stream starts; a mode change issued after that can never rebind the
  // in-flight turn. Send, then switch the durable mode to off mid-turn.
  await tray.getByRole('button', { name: 'Close memory review' }).click();
  await page
    .locator('section[aria-label="Memory review"]')
    .waitFor({ state: 'detached', timeout: 20_000 });
  const midComposer = page.locator('#qlt-composer');
  await midComposer.focus();
  await midComposer.fill('Hello');
  const assistantCountBefore = await page.locator('.qlt-message--assistant').count();
  await page.getByRole('button', { name: 'Send' }).focus();
  await page.keyboard.press('Enter');
  // The stream started => the turn is durably admitted (the Send POST has
  // returned with the durable turn identity).
  await page
    .locator('.qlt-message--assistant')
    .nth(assistantCountBefore)
    .waitFor({ state: 'visible', timeout: 45_000 });
  // Change the durable mode to off WHILE the reply streams (or immediately
  // after it settles — in both cases AFTER admission).
  await openTray(page, 'pending');
  await tray.locator('input[type="radio"][name="qlt-memory-mode"][value="off"]').check();
  await tray.getByRole('button', { name: 'Save memory mode', exact: true }).click();
  await page.waitForTimeout(800);
  if ((await tray.locator('[data-memory-mode="off"]').count()) === 0) {
    fail('the durable Memory Mode change to off was not reflected in the surface');
  }
  // The in-flight (or just-settled) turn keeps its bound mode.
  await openTray(page, 'used');
  const midChooser = tray.locator('#qlt-turn-chooser');
  await midChooser.waitFor({ state: 'visible', timeout: 20_000 });
  await midChooser.selectOption({ index: 1 });
  await page.waitForTimeout(700);
  const midText = ((await tray.textContent()) ?? '').replace(/\s+/g, ' ');
  if (!midText.includes('Memory mode: Across conversations')) {
    fail('the admitted turn was reinterpreted by the mid-turn mode change');
  }
  note('Q5-4: the mid-turn mode change left the admitted turn bound to across-conversations');

  // Q5-5: the NEXT turn uses the new mode; its evidence reads "memory was
  // intentionally off" and the quiet line tells the truth.
  await tray.getByRole('button', { name: 'Close memory review' }).click();
  await page
    .locator('section[aria-label="Memory review"]')
    .waitFor({ state: 'detached', timeout: 20_000 });
  const offComposer = page.locator('#qlt-composer');
  await offComposer.focus();
  await offComposer.fill('Hello');
  const assistantBeforeOff = await page.locator('.qlt-message--assistant').count();
  await page.getByRole('button', { name: 'Send' }).focus();
  await page.keyboard.press('Enter');
  await page
    .locator('.qlt-message--assistant')
    .nth(assistantBeforeOff)
    .waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(1_200);
  await openTray(page, 'used');
  const offChooser = tray.locator('#qlt-turn-chooser');
  await offChooser.waitFor({ state: 'visible', timeout: 20_000 });
  await offChooser.selectOption({ index: 1 });
  await page.waitForTimeout(700);
  const offText = ((await tray.textContent()) ?? '').replace(/\s+/g, ' ');
  if (!offText.includes('Memory was off for this reply.')) {
    fail('the off turn is not reported as intentionally off in Used for reply');
  }
  if (!offText.includes('Memory mode: Memory off')) {
    fail('the off turn does not display the applied off mode');
  }
  note(
    'Q5-5: the next turn used the new mode and its evidence reads "memory was intentionally off"',
  );

  // Q5-6: the quiet line reports the off state for the latest reply.
  await openTray(page, 'pending');
  const offAssemblyLine = ((await tray.locator('.qlt-memory-assembly').textContent()) ?? '').trim();
  if (offAssemblyLine !== 'Memory was off for your last reply here.') {
    fail(`the quiet line misreports an off reply ("${offAssemblyLine}")`);
  } else {
    note('Q5-6: the quiet line reads "Memory was off for your last reply here."');
  }
  // Restore the durable default for the remainder of the session.
  await tray
    .locator('input[type="radio"][name="qlt-memory-mode"][value="across-conversations"]')
    .check();
  await tray.getByRole('button', { name: 'Save memory mode', exact: true }).click();
  await page.waitForTimeout(600);
  await tray.getByRole('button', { name: 'Close memory review' }).click();

  // ---------- 12: responsive + axe with the Memory surface OPEN ----------
  await openTray(page, 'pending');
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
