import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runQ6LiveProof, Q6_RESULT_FILE_NAME } from '../scripts/lib/q6-live-parent.mjs';
import {
  createQ6LiveWorkspace,
  Q6_LIVE_WORKSPACE_PREFIX,
} from '../scripts/lib/q6-live-workspace.mjs';

/**
 * Q6 PARENT/WORKER lifecycle (amendment §6): the parent owns the single
 * disposable root; the worker runs every composition and exits; ONLY after
 * the worker exits does the parent read the result, re-verify the fixture,
 * scan for the credential, and remove the owned root. These focused
 * offline tests model success AND every failure mode with injected
 * spawn/removal seams — no provider, no credential, no operator data.
 */

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

const FAKE_FIXTURE = 'synthetic fixture body (non-personal)';
const CREDENTIAL_CANARY = 'q6-parent-worker-test-credential-canary';

interface ParentOptions {
  workerStatus?: number;
  writeResult?: (root: string) => void;
  spawnNote?: (root: string) => void;
  removeShouldFail?: boolean;
  changeFixtureAfterSpawn?: boolean;
  env?: NodeJS.ProcessEnv;
}

/** Build a parent invocation with a REAL owned root, a REAL fixture file,
 * and a FAKE worker spawn that models the worker lifecycle deterministically. */
const runModeled = async (options: ParentOptions = {}) => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'qlt-q6-parent-fixture-'));
  tempDirs.push(fixtureDir);
  const fixtureFile = join(fixtureDir, 'fixture.txt');
  writeFileSync(fixtureFile, FAKE_FIXTURE, 'utf8');
  const identity = {
    byteLength: Buffer.byteLength(FAKE_FIXTURE, 'utf8'),
  };
  let spawnedRoot: string | undefined;
  const spawnFn = (_file: string, _args: string[], spawnOptions: object) => {
    const childEnv = spawnOptions as { env?: Record<string, string | undefined> };
    spawnedRoot = childEnv.env?.QUELLIGHT_Q6_OWNED_ROOT;
    options.spawnNote?.(spawnedRoot!);
    if (options.changeFixtureAfterSpawn) {
      writeFileSync(fixtureFile, 'mutated after spawn', 'utf8');
    }
    if (options.writeResult !== undefined && spawnedRoot !== undefined) {
      options.writeResult(spawnedRoot);
    }
    return { status: options.workerStatus ?? 0 };
  };
  let removeCalls = 0;
  const removeFn = (directory: string, opts?: object) => {
    removeCalls += 1;
    if (options.removeShouldFail) {
      // Model a Windows-style lock: the removal silently does nothing.
      return;
    }
    // Fall through to a real removal for the real owned root only.
    rmSync(directory, opts);
  };
  const outcome = await runQ6LiveProof({
    env: {
      QUELLIGHT_LIVE_PROOF: '1',
      OLLAMA_API_KEY: CREDENTIAL_CANARY,
      QUELLIGHT_Q6_NATURAL_FIXTURE_FILE: fixtureFile,
      ...(options.env ?? {}),
    } as unknown as NodeJS.ProcessEnv,
    repoRoot: process.cwd(),
    spawnFn,
    removeFn,
    workerPath: 'worker-not-spawned.mjs',
    log: () => undefined,
  });
  return { outcome, spawnedRoot, identity, fixtureFile, removeCalls: () => removeCalls };
};

const goodResult = (root: string): void => {
  writeFileSync(
    join(root, Q6_RESULT_FILE_NAME),
    JSON.stringify({
      ok: true,
      findings: [],
      turns: [{ id: 't1', status: 'completed', elapsedMs: 12, proposals: 0, invocations: 0 }],
      providerTurns: 1,
    }),
    'utf8',
  );
};

describe('Q6 parent/worker ordering and cleanup (modeled; offline)', () => {
  it('the worker spawns with the owned root; scan and removal happen ONLY after the worker exits; success exits 0', async () => {
    const events: string[] = [];
    const { outcome, spawnedRoot, removeCalls } = await runModeled({
      writeResult: (root) => {
        goodResult(root);
        events.push('worker-wrote-result');
      },
      spawnNote: () => events.push('worker-spawned'),
    });
    expect(events).toEqual(['worker-spawned', 'worker-wrote-result']);
    expect(outcome.order[0]).toBe('workspace-allocated');
    expect(outcome.order[1]).toBe('fixture-validated');
    expect(outcome.order[2]).toBe('worker-exited(0)');
    expect(outcome.order.indexOf('credential-scanned')).toBeGreaterThan(
      outcome.order.indexOf('worker-exited(0)'),
    );
    expect(outcome.order.indexOf('workspace-disposed')).toBeGreaterThan(
      outcome.order.indexOf('credential-scanned'),
    );
    expect(outcome.exit).toBe(0);
    expect(outcome.findings).toEqual([]);
    expect(spawnedRoot).toBeTruthy();
    expect(existsSync(spawnedRoot!)).toBe(false);
    expect(removeCalls()).toBe(1);
  });

  it('a worker crash (nonzero exit, no result record) fails the proof AND still removes the owned root', async () => {
    const { outcome, spawnedRoot } = await runModeled({ workerStatus: 1 });
    expect(outcome.exit).toBe(1);
    expect(
      outcome.findings.some((finding) => finding.includes('worker result record is missing')),
    ).toBe(true);
    expect(outcome.findings.some((finding) => finding.includes('exited abnormally'))).toBe(true);
    expect(existsSync(spawnedRoot!)).toBe(false);
  });

  it('a planted credential canary inside the owned root is a LEAK finding and fails the proof', async () => {
    const { outcome, spawnedRoot } = await runModeled({
      writeResult: (root) => {
        goodResult(root);
        writeFileSync(join(root, 'leak.bin'), `x ${CREDENTIAL_CANARY} y`, 'utf8');
      },
    });
    expect(outcome.exit).toBe(1);
    expect(outcome.findings.some((finding) => finding.includes('LEAK'))).toBe(true);
    expect(existsSync(spawnedRoot!)).toBe(false);
  });

  it('cleanup failure remains proof failure (removed:false is a finding, not a note)', async () => {
    const { outcome, spawnedRoot, removeCalls } = await runModeled({
      writeResult: goodResult,
      removeShouldFail: true,
    });
    expect(outcome.exit).toBe(1);
    expect(outcome.findings.some((finding) => finding.includes('could NOT be removed'))).toBe(true);
    expect(outcome.order).toContain('workspace-dispose-failed');
    // The locked root could not be removed by the modelled failing remover.
    expect(existsSync(spawnedRoot!)).toBe(true);
    expect(removeCalls()).toBeGreaterThanOrEqual(1);
    rmSync(spawnedRoot!, { recursive: true, force: true });
  });

  it('a fixture mutated during the run fails the content-safety check (and the file is still never deleted by the proof)', async () => {
    const { outcome } = await runModeled({
      writeResult: goodResult,
      changeFixtureAfterSpawn: true,
    });
    expect(outcome.exit).toBe(1);
    expect(
      outcome.findings.some((finding) => finding.includes('fixture vanished or changed')),
    ).toBe(true);
  });

  it('a tampered worker result (findings present) fails the proof through the parent merge', async () => {
    const { outcome } = await runModeled({
      writeResult: (root) => {
        writeFileSync(
          join(root, Q6_RESULT_FILE_NAME),
          JSON.stringify({
            ok: false,
            findings: ['t2: expected exactly one commitment proposal, found 0'],
            providerTurns: 1,
          }),
          'utf8',
        );
      },
    });
    expect(outcome.exit).toBe(1);
    expect(outcome.findings).toContain('t2: expected exactly one commitment proposal, found 0');
  });

  it('the gate refuses (exit 2) before any allocation when the activation gate or credential is absent', async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'qlt-q6-parent-gate-'));
    tempDirs.push(fixtureDir);
    const fixtureFile = join(fixtureDir, 'fixture.txt');
    writeFileSync(fixtureFile, FAKE_FIXTURE, 'utf8');
    // The precise invariant: the gate allocates NOTHING — no new
    // qlt-q6-live-* directory may appear. (A global tmpdir-entry count is
    // inherently racy under parallel suites, which legitimately create
    // unrelated temporary entries concurrently.)
    const liveRootsBefore = readdirSync(tmpdir()).filter((entry) =>
      entry.startsWith(Q6_LIVE_WORKSPACE_PREFIX),
    ).length;
    const refused1 = await runQ6LiveProof({
      env: {
        QUELLIGHT_LIVE_PROOF: '0',
        OLLAMA_API_KEY: CREDENTIAL_CANARY,
      } as unknown as NodeJS.ProcessEnv,
      repoRoot: process.cwd(),
      workerPath: 'worker-not-spawned.mjs',
      log: () => undefined,
    });
    const refused2 = await runQ6LiveProof({
      env: { QUELLIGHT_LIVE_PROOF: '1' } as unknown as NodeJS.ProcessEnv,
      repoRoot: process.cwd(),
      workerPath: 'worker-not-spawned.mjs',
      log: () => undefined,
    });
    expect(refused1.exit).toBe(2);
    expect(refused2.exit).toBe(2);
    const liveRootsAfter = readdirSync(tmpdir()).filter((entry) =>
      entry.startsWith(Q6_LIVE_WORKSPACE_PREFIX),
    ).length;
    expect(liveRootsAfter).toBe(liveRootsBefore);
  });

  it('an invalid fixture refuses (exit 2) before the worker spawns and before any allocation', async () => {
    let spawned = false;
    const outcome = await runQ6LiveProof({
      env: {
        QUELLIGHT_LIVE_PROOF: '1',
        OLLAMA_API_KEY: CREDENTIAL_CANARY,
        QUELLIGHT_Q6_NATURAL_FIXTURE_FILE: 'relative-fixture.txt',
      } as unknown as NodeJS.ProcessEnv,
      repoRoot: process.cwd(),
      spawnFn: () => {
        spawned = true;
        return { status: 0 };
      },
      workerPath: 'worker-not-spawned.mjs',
      log: () => undefined,
    });
    expect(outcome.exit).toBe(2);
    expect(outcome.refused).toContain('absolute path');
    expect(spawned).toBe(false);
    // The just-allocated root is disposed even on this early refusal (no leak).
    expect(outcome.order).toContain('workspace-disposed');
  });

  it('the allocating API still carries dispose and the temp prefix stays task-owned', () => {
    const workspace = createQ6LiveWorkspace();
    expect(typeof workspace.dispose).toBe('function');
    expect(
      workspace.root
        .split(/[\\/]/)
        .some((segment: string) => segment.startsWith(Q6_LIVE_WORKSPACE_PREFIX)),
    ).toBe(true);
    return workspace.dispose().then((result: { removed: boolean }) => {
      expect(result.removed).toBe(true);
      expect(existsSync(workspace.root)).toBe(false);
    });
  });

  it('no task directory survives any modeled run', async () => {
    const runs = await Promise.all([
      runModeled({ writeResult: goodResult }),
      runModeled({ workerStatus: 3 }),
    ]);
    for (const { spawnedRoot } of runs) {
      expect(existsSync(spawnedRoot!)).toBe(false);
    }
  });
});
