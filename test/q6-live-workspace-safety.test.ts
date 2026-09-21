/**
 * Quellight Stage 07C Phase Q6 — live-proof WORKSPACE SAFETY suites
 * (fully offline; NO provider, NO credential, NO repository or operator
 * data access).
 *
 * These suites pin the fail-closed ownership and scan discipline that
 * the safety hardening added to the live proof:
 *
 *   S-1: a REJECTED (unowned) path is never recursively deleted and
 *        never echoed — only `workspace.root` may ever be removed;
 *   S-2: a credential scan that cannot COMPLETE is a failure, never a
 *        clean result — and cleanup still proceeds on the owned root.
 *
 * Every fixture here is disposable and task-owned (OS temp only).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import {
  adoptQ6LiveWorkspace,
  createQ6LiveWorkspace,
  OPERATOR_DATA_DIR_NAME,
  Q6_LIVE_WORKSPACE_PREFIX,
} from '../scripts/lib/q6-live-workspace.mjs';

const ownedTempEntries = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith(Q6_LIVE_WORKSPACE_PREFIX));

describe('S-1 ownership: rejected paths are never touched', () => {
  it('a rejected foreign directory containing a sentinel file remains completely untouched', async () => {
    const workspace = createQ6LiveWorkspace();
    const foreign = join(tmpdir(), `qlt-q6-safety-foreign-${randomBytes(4).toString('hex')}`);
    mkdirSync(foreign, { recursive: true });
    const sentinel = join(foreign, 'sentinel.txt');
    writeFileSync(sentinel, 'must survive');
    try {
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: foreign }, 'composition'),
      ).toThrowError(/identity violation/);
      // The rejected path and its contents are byte-for-byte untouched.
      expect(existsSync(sentinel)).toBe(true);
      expect(readFileSync(sentinel, 'utf8')).toBe('must survive');
      expect(statSync(foreign).isDirectory()).toBe(true);
    } finally {
      rmSync(foreign, { recursive: true, force: true });
      await workspace.dispose();
    }
  });

  it('a repository path is rejected and never deleted', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      const repoPath = join(process.cwd(), 'src', 'lib', 'server');
      expect(() => workspace.requireOwned(repoPath, 'probe')).toThrowError(/repository/);
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: repoPath }, 'probe'),
      ).toThrowError();
      // Real product source still present and untouched.
      expect(existsSync(repoPath)).toBe(true);
      expect(statSync(repoPath).isDirectory()).toBe(true);
    } finally {
      await workspace.dispose();
    }
  });

  it(`an operator ${OPERATOR_DATA_DIR_NAME} path is rejected and never deleted`, async () => {
    const workspace = createQ6LiveWorkspace();
    // A disposable fixture whose NAME is the operator data directory —
    // the real operator directory is never referenced on disk.
    const fakeOperator = join(
      tmpdir(),
      `qlt-q6-safety-fixture-${randomBytes(4).toString('hex')}`,
      OPERATOR_DATA_DIR_NAME,
      'nested',
    );
    mkdirSync(fakeOperator, { recursive: true });
    const sentinel = join(fakeOperator, 'sentinel.txt');
    writeFileSync(sentinel, 'must survive');
    try {
      expect(() => workspace.requireOwned(fakeOperator, 'probe')).toThrowError(/operator data/);
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: fakeOperator }, 'probe'),
      ).toThrowError(/operator data/);
      expect(() =>
        workspace.requireResolvedEnvironmentDataDir({ dataDir: fakeOperator }),
      ).toThrowError(/operator data/);
      expect(existsSync(sentinel)).toBe(true);
      expect(readFileSync(sentinel, 'utf8')).toBe('must survive');
    } finally {
      rmSync(resolve(fakeOperator, '..', '..'), { recursive: true, force: true });
      await workspace.dispose();
    }
  });
});

describe('S-1 ownership: the only removal target is the owned root', () => {
  it('the parent/worker live harness contains no recursive deletion of a composition-reported path', () => {
    // The parent/worker lifecycle (amendment §6) splits the live proof:
    // the PARENT (verify-q6-live.mjs + lib/q6-live-parent.mjs) never deletes
    // anything except through the owned workspace's dispose, and the WORKER
    // (lib/q6-live-worker.mjs) has NO deletion capability at all. The old
    // S-1 property is preserved across BOTH files, at equal or greater
    // strength.
    const parentSource = readFileSync('scripts/verify-q6-live.mjs', 'utf8');
    const parentLibSource = readFileSync('scripts/lib/q6-live-parent.mjs', 'utf8');
    const workerSource = readFileSync('scripts/lib/q6-live-worker.mjs', 'utf8');
    // No rmSync anywhere in any live-proof file.
    for (const source of [parentSource, parentLibSource, workerSource]) {
      expect(source).not.toMatch(/rmSync/);
    }
    // The worker has no deletion capability at all: no dispose reaches it.
    expect(workerSource).not.toMatch(/dispose/);
    // The parent performs removal EXACTLY once, through the owned dispose.
    expect((parentLibSource.match(/workspace\.dispose\(\)/g) ?? []).length).toBe(1);
    // The identity failures are stable and non-echoing (worker), and the
    // resolved environment is pre-validated before composition.
    expect(workerSource).toMatch(/path not echoed/);
    expect(workerSource).toMatch(/requireResolvedEnvironmentDataDir/);
  });

  it('the only permitted removal target is the owned workspace root (dispose-only, parent-side, scoped)', async () => {
    const parentLibSource = readFileSync('scripts/lib/q6-live-parent.mjs', 'utf8');
    expect((parentLibSource.match(/workspace\.dispose\(\)/g) ?? []).length).toBe(1);
    // The adopted (worker) API carries NO dispose whatsoever.
    const adopted = adoptQ6LiveWorkspace(mkdtempSync(join(tmpdir(), Q6_LIVE_WORKSPACE_PREFIX)));
    expect((adopted as unknown as { dispose?: unknown }).dispose).toBeUndefined();
    rmSync(adopted.root, { recursive: true, force: true });
    const workspace = createQ6LiveWorkspace();
    // A sibling OUTSIDE the owned root must never be touched.
    const sibling = join(
      tmpdir(),
      `${Q6_LIVE_WORKSPACE_PREFIX}safety-sibling-${randomBytes(4).toString('hex')}`,
    );
    mkdirSync(sibling, { recursive: true });
    const sentinel = join(sibling, 'sentinel.txt');
    writeFileSync(sentinel, 'must survive');
    try {
      const result = await workspace.dispose();
      expect(result.removed).toBe(true);
      expect(existsSync(workspace.root)).toBe(false);
      expect(existsSync(sentinel)).toBe(true);
    } finally {
      rmSync(sibling, { recursive: true, force: true });
    }
  });
});

describe('S-2 scanning: incomplete scans fail closed', () => {
  it('an unexpectedly missing root causes the credential scan to FAIL — not return clean', async () => {
    const workspace = createQ6LiveWorkspace();
    const root = workspace.root;
    rmSync(root, { recursive: true, force: true });
    expect(() => workspace.scanForCredential('any-secret-value')).toThrowError(
      /unexpectedly absent/,
    );
    await workspace.dispose();
  });

  it('an incomplete/unreadable traversal causes the scan to fail', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      // A dangling directory entry makes traversal incomplete: listing
      // the parent succeeds, but stat on the entry fails.
      const missingTarget = join(workspace.root, 'no-such-target');
      const dangling = join(workspace.root, 'mastra');
      mkdirSync(dangling, { recursive: true });
      symlinkSync(
        missingTarget,
        join(dangling, 'broken-entry'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      expect(() => workspace.scanForCredential('any-secret-value')).toThrowError();
      // A non-directory root also refuses to be treated as scanned.
      const fileRoot = createQ6LiveWorkspace();
      rmSync(fileRoot.root, { recursive: true, force: true });
      writeFileSync(fileRoot.root, 'not a directory');
      try {
        expect(() => fileRoot.scanForCredential('any-secret-value')).toThrowError(
          /not a directory/,
        );
      } finally {
        rmSync(fileRoot.root, { force: true });
      }
    } finally {
      await workspace.dispose();
    }
  });

  it('scan failure still proceeds to owned-root cleanup', async () => {
    const workspace = createQ6LiveWorkspace();
    const missingTarget = join(workspace.root, 'no-such-target');
    const dangling = join(workspace.root, 'mastra');
    mkdirSync(dangling, { recursive: true });
    symlinkSync(
      missingTarget,
      join(dangling, 'broken-entry'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    let scanFailed = false;
    try {
      workspace.scanForCredential('any-secret-value');
    } catch {
      scanFailed = true;
    }
    expect(scanFailed).toBe(true);
    // The harness shape: scan failure does not prevent owned-root
    // cleanup, and cleanup still removes exactly the owned root.
    const result = await workspace.dispose();
    expect(result.removed).toBe(true);
    expect(existsSync(workspace.root)).toBe(false);
  });

  it('a completed traversal still detects nested credential canaries', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      const canary = `q6-safety-canary-${randomBytes(16).toString('hex')}`;
      const deep = join(workspace.root, 'a', 'b');
      mkdirSync(deep, { recursive: true });
      writeFileSync(join(deep, 'store.db'), `bytes ${canary} bytes`);
      expect(workspace.scanForCredential(canary)).toEqual([join('a', 'b', 'store.db')]);
      // And a completed traversal with nothing planted is clean.
      expect(workspace.scanForCredential(`absent-${randomBytes(8).toString('hex')}`)).toEqual([]);
    } finally {
      await workspace.dispose();
    }
  });
});

describe('S-1/S-2: the normal same-root path remains green', () => {
  it('initial and restart on the SAME root pass every ownership and scan gate', async () => {
    const before = new Set(ownedTempEntries());
    const workspace = createQ6LiveWorkspace();
    try {
      const rootName = workspace.root.slice(workspace.root.lastIndexOf(sep) + 1);
      // Fresh allocation (attribution form; deterministic under parallel
      // workers) and a completed, clean scan of the untouched root.
      expect(before.has(rootName)).toBe(false);
      expect(ownedTempEntries().some((entry) => entry === rootName)).toBe(true);
      // The exact harness call pattern: same explicit root for both
      // compositions; resolved environment and composition identity both
      // validated.
      const envPayload = workspace.dataEnv(workspace.root);
      const initialEnv = { ...envPayload, dataDir: workspace.root };
      const restartEnv = { ...envPayload, dataDir: workspace.root };
      expect(workspace.requireResolvedEnvironmentDataDir(initialEnv)).toBe(workspace.root);
      expect(workspace.requireResolvedEnvironmentDataDir(restartEnv)).toBe(workspace.root);
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: workspace.root }, 'initial composition'),
      ).not.toThrow();
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: workspace.root }, 'restarted composition'),
      ).not.toThrow();
      // A completed scan of the untouched root is clean.
      expect(workspace.scanForCredential(`absent-${randomBytes(8).toString('hex')}`)).toEqual([]);
      // And cleanup succeeds.
      expect((await workspace.dispose()).removed).toBe(true);
    } finally {
      await workspace.dispose();
    }
  });
});
