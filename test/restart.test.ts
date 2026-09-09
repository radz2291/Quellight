import { afterAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * N-9 — forced server termination and restart (real child-process
 * SIGKILL): recovery renders exactly the durable truth — completed turns
 * survive, an in-flight turn settles honestly (never a fabricated
 * completion), and the Shared World thread list survives.
 */

const workerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'quellight-worker.mts',
);

interface WorkerLine {
  readonly ok: boolean;
  readonly [key: string]: unknown;
}

function runWorker(
  mode: string,
  dataDir: string,
  timeoutMs = 90_000,
): Promise<{ code: number | null; lines: WorkerLine[]; killed: boolean }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workerPath, mode], {
      env: { ...process.env, QUELLIGHT_WORKER_DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const lines: WorkerLine[] = [];
    let buffer = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf('\n');
        if (line.startsWith('<<JSON>>')) {
          lines.push(JSON.parse(line.slice('<<JSON>>'.length)) as WorkerLine);
        }
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, lines, killed });
    });
  });
}

describe('forced process termination and restart (N-9)', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'qlt-restart-'));
  afterAll(() => {
    // Windows holds store locks briefly; the temp dir is disposable and
    // removal failures there are inert.
    const attempt = (remaining: number): void => {
      try {
        rmSync(dataDir, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(8);
  });

  it('completed turns survive a SIGKILL and an in-flight turn settles honestly', async () => {
    // 1. Setup: one completed turn on a persistent data dir.
    const setup = await runWorker('setup', dataDir);
    expect(setup.code).toBe(0);
    const setupLine = setup.lines.at(-1) as { ok: boolean; threadId: string };
    expect(setupLine.ok).toBe(true);
    const threadId = setupLine.threadId as string;

    // 2. Start a long turn and SIGKILL the process mid-turn. EXACTLY ONE
    //    midturn process is spawned (a second dispatch of the same
    //    idempotency key would legitimately return
    //    VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS and break the scenario).
    const victim = await new Promise<{ lines: WorkerLine[]; kill(): void }>((resolvePromise) => {
      const child = spawn(process.execPath, ['--import', 'tsx', workerPath, 'midturn'], {
        env: { ...process.env, QUELLIGHT_WORKER_DATA_DIR: dataDir },
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const lines: WorkerLine[] = [];
      let buffer = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const line = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf('\n');
          if (line.startsWith('<<JSON>>')) {
            lines.push(JSON.parse(line.slice('<<JSON>>'.length)) as WorkerLine);
            resolvePromise({
              lines,
              kill: () => {
                child.kill('SIGKILL');
              },
            });
            return;
          }
        }
      });
    });
    // Give the turn a moment to be genuinely in flight, then kill hard.
    // The worker's first JSON line MUST report a started turn; if the
    // dispatch failed we surface the stable code instead of killing a
    // process that never started a turn (that would fake the scenario).
    const midturnLine = victim.lines.at(-1) as { ok: boolean; code?: string };
    expect(midturnLine.ok, `midturn worker lines: ${JSON.stringify(victim.lines)}`).toBe(true);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    victim.kill();

    // 3. Restart: reconciliation at boot settles the in-flight turn
    //    honestly; durable truth is exactly what survived.
    const verify = await runWorker('verify', dataDir);
    expect(verify.code).toBe(0);
    const verdict = verify.lines.at(-1) as {
      ok: boolean;
      threadTitle: string;
      threadCount: number;
      restoredMessages: string[];
      turns: Array<{ status: string; errorCode: string | null }>;
      rawTurns: Array<{
        turnId: string;
        threadId: string;
        actorId: string;
        status: string;
        linked: string | null;
      }>;
    };
    expect(verdict.ok).toBe(true);
    // The Shared World thread list survives.
    expect(verdict.threadCount).toBe(1);
    expect(verdict.threadTitle).toBe('Restart proof thread');
    // The setup turn's completed content is durably restored.
    expect(verdict.restoredMessages).toContain('setup-response-text');
    // The killed turn is NOT fabricated as completed: exactly one honest
    // non-completed terminal state (restart reconciliation settles open
    // turns cancelled/failed with stable codes).
    const killedTurns = verdict.turns.filter((turn) => turn.status !== 'completed');
    expect(killedTurns.length).toBe(1);
    expect(['cancelled', 'failed']).toContain(killedTurns[0]!.status);
    expect(killedTurns[0]!.errorCode).toMatch(/VICT_/);
  });
});
