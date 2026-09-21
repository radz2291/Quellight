// @ts-nocheck
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQ6LiveMatrix, QLT_Q6_FAILURE_CODES } from '../scripts/lib/q6-live-matrix.mjs';
import {
  createQ6LiveWorkspace,
  Q6_LIVE_WORKSPACE_PREFIX,
} from '../scripts/lib/q6-live-workspace.mjs';
import { reverifyFixtureIdentity } from '../scripts/lib/q6-fixture-boundary.mjs';
import { Q6_RESULT_FILE_NAME } from '../scripts/lib/q6-live-parent.mjs';
import { resolveQuellightEnvironment } from '../src/lib/server/composition';

/**
 * Q6 EXECUTION-3 REMEDIATION — the FULL OFFLINE WORKER-PATH PROOF
 * (frozen contract §7) plus the awaited-evidence and stable-failure
 * controls (§3/§4).
 *
 * The proof traverses, through the REAL worker code path (mode-injected;
 * no credential; no provider; the deterministic fixture model):
 *
 *   Turn 1 → reply retrieval → proposal inspection → Turn 2 → Turn 3 →
 *   governed confirmation → composition close → recomposition on same
 *   root → Turn 4 fresh-thread restore/continuity → Turn 5 non-mutation →
 *   result serialization → worker exit → parent scan and cleanup.
 *
 * No live acceptance rule is weakened: the same acceptance predicates, the
 * same durable-invocation truth checks, the same ceremony/restart/
 * continuity/conflict controls run as in the live matrix.
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* disposable */
    }
  }
});

/**
 * A SYNTHETIC, NON-PERSONAL fixture with the same semantic structure the
 * live matrix requires (durable commitment with the four anchors inside a
 * transient-hardship narrative plus an unresolved pacing decision). This
 * text is ALSO the offline script's Turn-2 key — the real worker reads it
 * from the external fixture file through the real boundary.
 */
const SYNTHETIC_FIXTURE = [
  'This week was a setup marathon: my work laptop screen died, so I had to move to a borrowed machine,',
  'the tools had to be reinstalled twice, and a part I ordered for the desk never arrived on time.',
  'Through all of that, one thing stays fixed: I will not leave my current job until there is a clear pathway',
  'and an established base for the change I am building toward.',
  'I still cannot decide whether to push that change on a fast track or move gradually, and honestly,',
  'I do not know whether this stretch of trouble is a signal of anything at all.',
].join(' ');

const CREDENTIAL_CANARY = 'q6-offline-matrix-test-credential-canary';

interface WorkspaceHandle {
  root: string;
  requireOwned(directory: string, label: string): void;
  dataEnv(directory: string): Record<string, string>;
  requireResolvedEnvironmentDataDir(environment: unknown): void;
  requireCompositionDataDir(composition: unknown, label: string): void;
  scanForCredential(secretValue: string): string[];
  dispose(): Promise<{ removed: boolean }>;
}

/** Allocate the workspace and the EXTERNAL synthetic fixture file. */
function allocate(): {
  workspace: WorkspaceHandle;
  fixture: { path: string; text: string; byteLength: number; sha256: string };
} {
  const workspace = createQ6LiveWorkspace() as unknown as WorkspaceHandle;
  tempDirs.push(workspace.root);
  const fixtureDir = tempDir('qlt-q6-offline-fixture-');
  const fixturePath = join(fixtureDir, 'fixture.txt');
  writeFileSync(fixturePath, SYNTHETIC_FIXTURE, 'utf8');
  const fixture = {
    path: fixturePath,
    text: SYNTHETIC_FIXTURE,
    byteLength: Buffer.byteLength(SYNTHETIC_FIXTURE, 'utf8'),
    sha256: createHash('sha256').update(Buffer.from(SYNTHETIC_FIXTURE, 'utf8')).digest('hex'),
  };
  return { workspace, fixture };
}

const matrixOptionsFor = (
  workspace: WorkspaceHandle,
  fixture: { text: string; byteLength: number; sha256: string },
) => ({
  ownedRoot: workspace.root,
  mode: 'offline' as const,
  credential: CREDENTIAL_CANARY,
  fixture,
  requireOwned: (directory: string, label: string) => workspace.requireOwned(directory, label),
  dataEnv: (directory: string) => workspace.dataEnv(directory),
  requireResolvedEnvironmentDataDir: (environment: unknown) =>
    workspace.requireResolvedEnvironmentDataDir(environment),
  requireCompositionDataDir: (composition: unknown, label: string) =>
    workspace.requireCompositionDataDir(composition, label),
});

describe('Q6 offline worker-path proof (frozen contract §7)', () => {
  it(
    'the REAL worker process traverses the ENTIRE matrix offline and the parent-side scans and cleanup follow',
    { timeout: 300_000 },
    async () => {
      const { workspace, fixture } = allocate();
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        QUELLIGHT_Q6_OFFLINE: '1',
        QUELLIGHT_Q6_OWNED_ROOT: workspace.root,
        QUELLIGHT_Q6_NATURAL_FIXTURE_FILE: fixture.path,
        QUELLIGHT_Q6_FIXTURE_IDENTITY: JSON.stringify({
          byteLength: fixture.byteLength,
          sha256: fixture.sha256,
        }),
      };
      delete childEnv.OLLAMA_API_KEY;
      // THE REAL WORKER, as a real process, exactly as the parent spawns it:
      const workerPath = fileURLToPath(
        new URL('../scripts/lib/q6-live-worker.mjs', import.meta.url),
      );
      const spawned = spawnSync(process.execPath, ['--import', 'tsx', workerPath], {
        cwd: process.cwd(),
        env: childEnv,
        encoding: 'utf8',
        timeout: 240_000,
      });
      expect(spawned.status, `worker stderr: ${spawned.stderr}`).toBe(0);

      // The result record written INSIDE the owned root:
      const result = JSON.parse(readFileSync(join(workspace.root, Q6_RESULT_FILE_NAME), 'utf8'));
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
      expect(result.providerTurns).toBe(5);
      expect(result.turns.map((turn: { id: string }) => turn.id)).toEqual([
        't1 (explicit remember request)',
        't2 (natural discretionary fixture)',
        't3 (transient incident)',
        't4 (fresh-conversation continuity)',
        't5 (hypothetical conflict)',
      ]);
      // The five-turn behavioral shape (the offline deterministic mirror of
      // the live acceptance controls):
      const byId = (id: string) =>
        result.turns.find((turn: { id: string }) => turn.id.startsWith(id));
      expect(byId('t1')).toMatchObject({ status: 'completed', invocations: 1, proposals: 1 });
      expect(byId('t2')).toMatchObject({ status: 'completed', invocations: 1, proposals: 1 });
      expect(byId('t3')).toMatchObject({ status: 'completed', invocations: 0, proposals: 0 });
      expect(byId('t5')).toMatchObject({ status: 'completed', invocations: 0, proposals: 0 });
      expect(result.fixture).toEqual({ byteLength: fixture.byteLength, sha256: fixture.sha256 });

      // ---- parent-side phase (the real parent helpers) ---------------------
      // fixture identity re-verification (read-only content safety):
      const identity = reverifyFixtureIdentity({
        fixturePath: fixture.path,
        repoRoot: process.cwd(),
        expected: { byteLength: fixture.byteLength, sha256: fixture.sha256 },
      });
      expect(identity).toEqual({ byteLength: fixture.byteLength, sha256: fixture.sha256 });
      // the byte-level credential scan over EVERY persisted byte:
      const offending = workspace.scanForCredential(CREDENTIAL_CANARY);
      expect(offending).toEqual([]);
      // the owned-root disposal (cleanup is proof):
      const disposed = await workspace.dispose();
      expect(disposed.removed).toBe(true);
      expect(existsSync(workspace.root)).toBe(false);
    },
  );

  it(
    'the full matrix traverses in-process too (deterministic re-proof of the same path)',
    { timeout: 300_000 },
    async () => {
      const { workspace, fixture } = allocate();
      const result = await runQ6LiveMatrix(matrixOptionsFor(workspace, fixture));
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
      expect(result.providerTurns).toBe(5);
      expect(result.turns).toHaveLength(5);
      // In-process Windows handle release can lag the close; the AUTHORITATIVE
      // parent-scan-and-cleanup proof is the spawned-worker test above. Here
      // disposal is retried patiently; eventual removal is verified.
      let disposed = { removed: false };
      for (let attempt = 0; attempt < 24 && !disposed.removed; attempt += 1) {
        disposed = await workspace.dispose();
        if (!disposed.removed) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      expect(disposed.removed).toBe(true);
    },
  );

  it(
    'an ASYNCHRONOUS evidence failure is awaited, recorded before serialization, and the matrix still completes',
    { timeout: 300_000 },
    async () => {
      const { workspace, fixture } = allocate();
      let invocationReads = 0;
      const options = {
        ...matrixOptionsFor(workspace, fixture),
        // Injection point already owned by the matrix seam: this hook receives
        // each freshly composed REAL composition. The fault: the SECOND
        // listInvocationsForTurn call of the run — the t1 EVIDENCE check's own
        // read — rejects ASYNCHRONOUSLY (M-1's exact hazard).
        requireCompositionDataDir: (
          composition: {
            stores: {
              invocations: { listInvocationsForTurn: (turnId: string) => Promise<unknown> };
            };
          },
          label: string,
        ) => {
          workspace.requireCompositionDataDir(composition, label);
          const original = composition.stores.invocations.listInvocationsForTurn.bind(
            composition.stores.invocations,
          );
          composition.stores.invocations.listInvocationsForTurn = (turnId: string) => {
            invocationReads += 1;
            if (invocationReads === 2) {
              return new Promise((_resolve, reject) => {
                setTimeout(() => reject(new Error('fault-injected async evidence failure')), 5);
              });
            }
            return original(turnId);
          };
        },
      };
      const result = await runQ6LiveMatrix(options);
      // The evidence failure was AWAITED and RECORDED — it can never vanish:
      expect(
        result.findings.some(
          (finding: string) =>
            finding.startsWith(QLT_Q6_FAILURE_CODES.EVIDENCE) && finding.includes('t1'),
        ),
      ).toBe(true);
      // It was recorded BEFORE result serialization, and the matrix went on to
      // traverse every remaining phase deterministically:
      expect(result.ok).toBe(false);
      expect(result.providerTurns).toBe(5);
      expect(result.turns).toHaveLength(5);
      await workspace.dispose();
    },
  );

  it('the real composition exposes restoreThread on the COMPOSITION and never on the Shared World store (the corrected Execution-3 chronology)', async () => {
    const dir = tempDir('qlt-q6-offline-restore-');
    const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: dir }, process.cwd());
    const { createQuellightComposition } = await import('../src/lib/server/composition');
    const composition = await createQuellightComposition({ env, skipListen: true });
    try {
      expect(typeof composition.restoreThread).toBe('function');
      expect(typeof (composition.sharedWorld as Record<string, unknown>).restoreThread).toBe(
        'undefined',
      );
      // The Execution-3 crash mechanics, reproduced exactly: calling
      // sharedWorld.restoreThread throws TypeError — which the repaired
      // reply retrieval can never do (it calls the composition boundary and
      // stabilizes any failure into QLT_Q6_REPLY_RESTORE_FAILED).
      let thrown: unknown;
      try {
        (composition.sharedWorld as unknown as Record<string, unknown>)['restoreThread']!(
          'thread-x',
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TypeError);
    } finally {
      await composition.close().catch(() => undefined);
    }
  });
});

describe('Q6 structural gates: awaited evidence and non-echoing failures (frozen contract §3/§4)', () => {
  const matrixSource = readFileSync(
    fileURLToPath(new URL('../scripts/lib/q6-live-matrix.mjs', import.meta.url)),
    'utf8',
  );
  const workerSource = readFileSync(
    fileURLToPath(new URL('../scripts/lib/q6-live-worker.mjs', import.meta.url)),
    'utf8',
  );

  it('every evidence-check call site is the declaration or explicitly awaited (no floating calls)', () => {
    const lines = matrixSource.split('\n');
    for (const [index, line] of lines.entries()) {
      if (!line.includes('checkInvocationTruth(')) {
        continue;
      }
      const isDeclaration = line.includes('const checkInvocationTruth');
      const isAwaited = line.trimStart().startsWith('await checkInvocationTruth(');
      expect(isDeclaration || isAwaited, `matrix line ${index + 1}: ${line.trim()}`).toBe(true);
    }
    // Both proposal-bearing turns carry the awaited check:
    expect(matrixSource.match(/await checkInvocationTruth\(/g)?.length).toBe(2);
  });

  it('the reply boundary is the FULL composition — the Execution-3 defect cannot reappear', () => {
    expect(matrixSource).not.toContain('sharedWorld.restoreThread');
    expect(matrixSource).toContain('replyComposition.restoreThread(threadId)');
    expect(matrixSource).toContain('composition2.restoreThread(threadB.id)');
  });

  it('findings are stable non-echoing codes only — no error-message slicing anywhere', () => {
    expect(workerSource).not.toContain('safeCrashMessage');
    expect(matrixSource).not.toContain('safeCrashMessage');
    expect(matrixSource).not.toContain('.slice(0,');
    expect(matrixSource).toContain(QLT_Q6_FAILURE_CODES.MATRIX);
    expect(matrixSource).toContain(QLT_Q6_FAILURE_CODES.REPLY_RESTORE);
    expect(matrixSource).toContain(QLT_Q6_FAILURE_CODES.EVIDENCE);
    // The catch path derives the finding from the CLOSED code vocabulary —
    // never from the thrown value:
    expect(matrixSource).toContain('error instanceof Q6MatrixFailure');
    expect(matrixSource).toContain('void cause;');
  });

  it('the worker deletion-free adoption boundary is intact (the worker never removes anything)', () => {
    expect(workerSource).toContain('adoptQ6LiveWorkspace');
    expect(workerSource).not.toContain('dispose');
    expect(workerSource).not.toContain('rmSync');
    expect(workerSource).not.toContain('rmdirSync');
    expect(workerSource).not.toContain('unlink');
  });
});
