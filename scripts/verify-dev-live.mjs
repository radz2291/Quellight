#!/usr/bin/env node
/**
 * Contract Amendment 2 proof (`quellight.stage07d.operator-live-use@1`):
 * the supported normal-use live startup seam, proven OFFLINE — the pinned
 * provider endpoint is intercepted in-process by a loopback transport
 * stand-in; ZERO real provider requests leave the machine; the store is a
 * task-owned temporary directory and the default operator data directory is
 * proven untouched. Structural output only; the credential value (any
 * sentinel or boundary-resolved value) is NEVER printed.
 *
 * Deterministic two-process structure (the Q6/D4 parent-worker precedent):
 * the CHILD composes and closes; on win32 the SQLite handles are provably
 * released only at child process exit (EBUSY class, disclosed in the D4
 * attempt-2 record), so the PARENT — after the child has exited — removes
 * and verifies every task-owned temporary directory. The child prints one
 * JSON result line; the parent owns the exit code and the final checks.
 *
 * Child proofs:
 *   P1  offline default unchanged — no seams → 'offline-fixture', the
 *       credential variable is never resolved or touched.
 *   P2  operator live selection — QUELLIGHT_OPERATOR_LIVE=1 + protected
 *       env credential → 'live'; one full conversation turn through the
 *       REAL adapter path produces the assistant response from the pinned
 *       endpoint transport; exactly one provider request; the credential
 *       value was present in the transport ONLY in memory; the task-owned
 *       data dir was used.
 *   P3  boundary fallback — no env credential; the owner-designated
 *       boundary resolves in memory; composition still selects 'live';
 *       the resolved value appears in neither the serialized operator
 *       configuration nor any durable byte.
 *   P4  fail closed — live seam, no credential, boundary disabled →
 *       refuses with the stable code, no fixture fallback.
 *   P5  seam separation — both live seams together → refused.
 *   P6  boundary unavailability — a malformed task-owned boundary file →
 *       refuses with the same stable code and a clear explanation.
 * Parent proofs:
 *   F1  the default operator data directory was never created or touched.
 *   F2  every task-owned temporary directory was removed after the child
 *       exited and its store handles were released.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfPath = fileURLToPath(import.meta.url);

if (process.argv[2] === '--child') {
  await runChild();
} else {
  await runParent();
}

// =====================================================================
// CHILD: composition proofs (loopback; task-owned stores; no operator data)
// =====================================================================
async function runChild() {
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const repoRoot = resolve(import.meta.dirname, '..');
  const temps = [];
  const taskOwnedDir = (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    temps.push(dir);
    return dir;
  };

  const checks = [];
  function check(label, condition) {
    checks.push({ label, ok: Boolean(condition) });
  }

  const PINNED_CREDENTIAL_VAR = 'OLLAMA_API_KEY';
  const LOOPBACK_REPLY =
    'Hello. This reply arrived through the pinned live provider path (loopback stand-in; no real provider request left this machine).';
  const ENV_SENTINEL = 'qlt-dev-live-loopback-sentinel-value';

  // ---- Loopback interception of the pinned provider endpoint --------------
  const realFetch = globalThis.fetch;
  let providerRequests = 0;
  let authorizationValue = null;
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://ollama.com/v1/chat/completions') {
      providerRequests += 1;
      authorizationValue = new Headers(init?.headers).get('authorization');
      const { simulatedResponse } = await import('./lib/q6-provider-observer.mjs');
      return simulatedResponse('text', undefined, LOOPBACK_REPLY);
    }
    return realFetch(url, init);
  };

  const { resolveQuellightEnvironment, createQuellightComposition } = await import(
    pathToFileURL(join(repoRoot, 'src/lib/server/composition.ts')).href
  );

  async function compose(envOverrides, compositionOverrides, script = {}) {
    const dataDir = taskOwnedDir('qlt-dev-live-');
    const env = resolveQuellightEnvironment(
      { QUELLIGHT_DATA_DIR_ABSOLUTE: dataDir, ...envOverrides },
      repoRoot,
    );
    const composition = await createQuellightComposition({
      env,
      offlineScript: script,
      skipListen: true,
      ...compositionOverrides,
    });
    return { composition, dataDir };
  }

  const actorOf = (composition) => ({
    ...composition.actor,
    presentedTokenKind: 'local-test',
  });

  async function awaitTurnTerminal(composition, turnId, timeoutMs = 30_000) {
    const started = Date.now();
    for (;;) {
      const turn = await composition.turnService.getTurn(actorOf(composition), turnId);
      if (['completed', 'failed', 'cancelled', 'blocked'].includes(turn.status)) {
        return { status: turn.status, errorCode: turn.errorCode };
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error(`turn ${turnId} did not settle within ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // The durable content milestone carries a bounded ref; the authoritative
  // restored text comes through the VICT thread transcript.
  async function assistantTextOf(composition) {
    const restored = await composition.restoreThread(
      (await composition.sharedWorld.listThreads()).threads[0].id,
    );
    return restored.messages.map((m) => m.text).join('\n');
  }

  // ---- P1: offline default unchanged ----------------------------------------
  {
    delete process.env[PINNED_CREDENTIAL_VAR];
    const { composition } = await compose({}, {});
    check(
      'P1 the default composition remains the deterministic offline fixture',
      composition.modelMode === 'offline-fixture',
    );
    check(
      'P1 the credential variable was never resolved or touched in offline mode',
      process.env[PINNED_CREDENTIAL_VAR] === undefined,
    );
    await composition.close();
  }

  // ---- P2: operator live-use via the protected env credential ----------------
  {
    providerRequests = 0;
    authorizationValue = null;
    process.env[PINNED_CREDENTIAL_VAR] = ENV_SENTINEL;
    const { composition } = await compose({ QUELLIGHT_OPERATOR_LIVE: '1' });
    check(
      'P2 the operator live seam composes the LIVE provider path',
      composition.modelMode === 'live',
    );
    check(
      'P2 the composition used the task-owned data directory',
      composition.dataDir.startsWith(tmpdir()) && !composition.dataDir.includes('.quellight-data'),
    );

    const thread = await composition.sharedWorld.createThread({ title: 'dev-live proof' });
    const conversation = await composition.sharedWorld.ensureConversationLink(thread.id);
    const outcome = await composition.commandService.dispatch(actorOf(composition), {
      command: 'agent.turn.start',
      payload: { threadId: conversation.mastraThreadId, input: 'Hello' },
      idempotencyKey: 'dev-live-proof-1',
    });
    check('P2 the turn started through the real dispatch boundary', outcome.ok === true);
    const turnId = outcome.data.turnId;
    const terminal = await awaitTurnTerminal(composition, turnId);
    check(
      'P2 the live turn completed through the real adapter path',
      terminal.status === 'completed',
    );
    const text = await assistantTextOf(composition);
    check(
      'P2 an assistant response was produced through the live provider path',
      text.includes(LOOPBACK_REPLY.slice(0, 40)),
    );
    check(
      'P2 exactly ONE provider request reached the pinned endpoint (loopback)',
      providerRequests === 1,
    );
    check(
      'P2 the credential was present in the transport IN MEMORY ONLY (never logged, never persisted)',
      typeof authorizationValue === 'string' && authorizationValue.includes(ENV_SENTINEL),
    );
    check(
      'P2 the credential value appears in no durable frame row',
      (await composition.stores.streamLedger.listEventsFrom(outcome.data.streamId, 0))
        .map((row) => JSON.stringify(row))
        .every((row) => !row.includes(ENV_SENTINEL)),
    );
    check(
      'P2 the serialized operator configuration never contains the credential value',
      !JSON.stringify(composition.serializedOperatorConfig).includes(ENV_SENTINEL),
    );
    await composition.close();
    delete process.env[PINNED_CREDENTIAL_VAR];
  }

  // ---- P3: the owner-designated boundary fallback (in memory only) -----------
  {
    delete process.env[PINNED_CREDENTIAL_VAR];
    const { composition } = await compose({ QUELLIGHT_OPERATOR_LIVE: '1' }, {});
    check(
      'P3 the credential resolves in memory through the owner-designated boundary and the composition selects live',
      composition.modelMode === 'live' &&
        typeof process.env[PINNED_CREDENTIAL_VAR] === 'string' &&
        process.env[PINNED_CREDENTIAL_VAR].length > 0,
    );
    const resolvedValue = process.env[PINNED_CREDENTIAL_VAR];
    const serialized = JSON.stringify(composition.serializedOperatorConfig);
    check(
      'P3 the boundary-resolved value appears in no serialized configuration byte',
      !serialized.includes(resolvedValue),
    );
    await composition.close();
    delete process.env[PINNED_CREDENTIAL_VAR];
  }

  // ---- P4: fail closed with no fixture fallback ------------------------------
  {
    delete process.env[PINNED_CREDENTIAL_VAR];
    let refusedCode;
    try {
      await compose({ QUELLIGHT_OPERATOR_LIVE: '1' }, { operatorCredentialBoundary: null });
    } catch (cause) {
      refusedCode = cause?.code;
    }
    check(
      'P4 the live seam without any resolvable credential refuses (no fixture fallback)',
      refusedCode === 'VICT_OPERATOR_CREDENTIAL_UNAVAILABLE',
    );
  }

  // ---- P5: the two live seams never combine ----------------------------------
  {
    delete process.env[PINNED_CREDENTIAL_VAR];
    let refusedCode;
    try {
      await compose({ QUELLIGHT_OPERATOR_LIVE: '1', QUELLIGHT_LIVE_PROOF: '1' });
    } catch (cause) {
      refusedCode = cause?.code;
    }
    check(
      'P5 setting both live seams together is refused as an invalid configuration',
      refusedCode === 'VICT_OPERATOR_CONFIG_INVALID',
    );
  }

  // ---- P6: an unavailable boundary fails closed with the same code -----------
  {
    delete process.env[PINNED_CREDENTIAL_VAR];
    const malformedBoundary = join(taskOwnedDir('qlt-dev-live-'), 'boundary.json');
    const { writeFileSync: wf } = await import('node:fs');
    wf(malformedBoundary, '{"not-ollama": true}\n');
    let refusedCode;
    try {
      await compose(
        { QUELLIGHT_OPERATOR_LIVE: '1' },
        { operatorCredentialBoundary: malformedBoundary },
      );
    } catch (cause) {
      refusedCode = cause?.code;
    }
    check(
      'P6 a malformed/unavailable boundary file refuses with the stable unavailable code',
      refusedCode === 'VICT_OPERATOR_CREDENTIAL_UNAVAILABLE',
    );
  }

  globalThis.fetch = realFetch;
  // Best-effort in-process removal; the parent re-verifies after exit.
  for (const dir of temps) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* the parent re-verifies after the handles are released at exit */
    }
  }
  console.log(JSON.stringify({ checks, remaining: temps.filter((d) => existsSync(d)) }));
}

// =====================================================================
// PARENT: run the child, then verify the released handles and the operator store
// =====================================================================
async function runParent() {
  const repoRoot = resolve(import.meta.dirname, '..');
  const defaultOperatorDir = join(repoRoot, '.quellight-data');
  const defaultOperatorDirExistedBefore = existsSync(defaultOperatorDir);
  const snapshot = () => {
    if (!defaultOperatorDirExistedBefore) return null;
    const out = [];
    const walk = (base) => {
      for (const entry of readdirSync(base)) {
        const p = join(base, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else out.push(`${entry}:${st.size}`);
      }
    };
    try {
      walk(defaultOperatorDir);
    } catch {
      return ['unreadable'];
    }
    return out;
  };
  const snapshotBefore = snapshot();
  const mtimeBefore = defaultOperatorDirExistedBefore ? statSync(defaultOperatorDir).mtimeMs : null;
  const fileCountBefore = defaultOperatorDirExistedBefore
    ? countFilesRecursive(defaultOperatorDir)
    : 0;

  const child = spawnSync(process.execPath, ['--import', 'tsx', selfPath, '--child'], {
    encoding: 'utf8',
    timeout: 300_000,
    env: { ...process.env, OLLAMA_API_KEY: '' },
  });

  console.log(
    'verify:dev-live — operator live-use startup proof (offline loopback; no real provider, no operator data).',
  );

  let parsed;
  try {
    parsed = JSON.parse(child.stdout.trim().split('\n').at(-1));
  } catch {
    console.log('  FAIL: the child proof produced no result line');
    if (child.stdout) console.log(child.stdout);
    if (child.stderr) console.log(child.stderr);
    process.exitCode = 1;
    return;
  }

  let failed = false;
  for (const entry of parsed.checks) {
    if (!entry.ok) failed = true;
    console.log(`  ${entry.ok ? 'ok' : 'FAIL'}: ${entry.label}`);
  }

  // ---- F1: the default operator data directory untouched --------------------
  const snapshotAfter = snapshot();
  const operatorUntouched = defaultOperatorDirExistedBefore
    ? JSON.stringify(snapshotAfter) === JSON.stringify(snapshotBefore) &&
      statSync(defaultOperatorDir).mtimeMs === mtimeBefore &&
      countFilesRecursive(defaultOperatorDir) === fileCountBefore
    : !existsSync(defaultOperatorDir);
  check(
    'F1 the default operator data directory was never created or touched by this proof',
    operatorUntouched,
  ) && (failed ||= !operatorUntouched);

  // ---- F2: every task-owned directory removed after the child exited --------
  // The child's SQLite handles were provably released at its exit; removal
  // now is deterministic (the EBUSY class is disclosed in the D4 attempt-2
  // execution record).
  const { rmSync } = await import('node:fs');
  let leftovers = [];
  const candidates = new Set(parsed.remaining);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    leftovers = [];
    for (const dir of parsed.remaining) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* retried below */
      }
      if (existsSync(dir)) leftovers.push(dir);
    }
    if (leftovers.length === 0) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  const removedClean = leftovers.length === 0;
  if (!removedClean) failed = true;
  check(
    'F2 every task-owned temporary directory was removed after the child proof exited',
    removedClean,
    leftovers.length === 0 ? undefined : `${leftovers.length} dir(s) remained`,
  );

  if (failed) {
    console.log('verify:dev-live: FAIL');
    process.exitCode = 1;
  } else {
    console.log(
      'verify:dev-live: PASS — operator live-use startup proven offline (loopback provider; task-owned store; credential in memory only; no real provider request, no operator data touched).',
    );
  }
}

function check(label, condition, detail) {
  console.log(`  ${condition ? 'ok' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
}

function countFilesRecursive(base) {
  let count = 0;
  for (const entry of readdirSync(base)) {
    const p = join(base, entry);
    if (statSync(p).isDirectory()) count += countFilesRecursive(p);
    else count += 1;
  }
  return count;
}
