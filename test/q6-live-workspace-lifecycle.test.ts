/**
 * Quellight Stage 07C Phase Q6 — the live-proof WORKSPACE LIFECYCLE
 * regression suites (fully offline; NO provider, NO credential).
 *
 * These suites pin the single-root discipline of
 * `scripts/lib/q6-live-workspace.mjs`, the helper that owns the Q6 live
 * proof's disposable data directory. The defect they make unreturnable:
 * the original harness allocated one directory for scan/cleanup
 * ownership but let compositions silently allocate a SECOND directory,
 * so the restart recomposed against the wrong store, the leak scan could
 * miss the composition's real directory, and cleanup could strand it.
 *
 * Every suite here exercises the helper behaviorally; no test composes
 * a model, imports the composition, or touches a provider surface.
 */
import { describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import {
  createQ6LiveWorkspace,
  OPERATOR_DATA_DIR_NAME,
  Q6_LIVE_WORKSPACE_PREFIX,
} from '../scripts/lib/q6-live-workspace.mjs';

const ownedTempEntries = () =>
  readdirSync(tmpdir()).filter((entry) => entry.startsWith(Q6_LIVE_WORKSPACE_PREFIX));

describe('Q6 live workspace: exactly one disposable root', () => {
  it('allocates a FRESH disposable root and leaves nothing behind after dispose', async () => {
    // Attribution form (deterministic under parallel test workers): the
    // root must be newly allocated and fully removed; the strict
    // single-allocation property is pinned by the structural
    // single-mkdtempSync proof below and by verify:q6.
    const before = new Set(ownedTempEntries());
    const workspace = createQ6LiveWorkspace();
    try {
      const rootName = basename(workspace.root);
      expect(before.has(rootName)).toBe(false);
      expect(ownedTempEntries().some((entry) => entry === rootName)).toBe(true);
      // The root is canonical (resolved) and lives inside the OS temp dir.
      expect(workspace.root).toBe(resolve(workspace.root));
      expect(workspace.root.startsWith(resolve(tmpdir()) + sep)).toBe(true);
    } finally {
      await workspace.dispose();
    }
  });

  it('the live harness itself allocates none of its own directories (no second mkdtempSync)', () => {
    const liveSource = readFileSync('scripts/verify-q6-live.mjs', 'utf8');
    const liveAllocations = [...liveSource.matchAll(/mkdtempSync\s*\(/g)].length;
    expect(liveAllocations).toBe(0);
    const helperSource = readFileSync('scripts/lib/q6-live-workspace.mjs', 'utf8');
    const helperAllocations = [...helperSource.matchAll(/mkdtempSync\s*\(/g)].length;
    expect(helperAllocations).toBe(1);
    // The retired boolean/unused-assignment pattern is gone.
    expect(liveSource).not.toMatch(/reuseDataDir/);
    expect(liveSource).not.toMatch(/const\s+restartDataDir\s*=/);
  });
});

describe('Q6 live workspace: explicit single-root identity', () => {
  it('initial composition and restart receive the SAME canonical path', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      // The exact call pattern of the live harness: every composition is
      // handed the owned root explicitly.
      const initialEnv = workspace.dataEnv(workspace.root);
      const restartEnv = workspace.dataEnv(workspace.root);
      expect(initialEnv.QUELLIGHT_DATA_DIR_ABSOLUTE).toBe(workspace.root);
      expect(restartEnv.QUELLIGHT_DATA_DIR_ABSOLUTE).toBe(workspace.root);
      expect(resolve(initialEnv.QUELLIGHT_DATA_DIR_ABSOLUTE)).toBe(workspace.root);
      // The runtime identity assertion accepts BOTH simulated
      // compositions because their resolved dataDir IS the owned root.
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: workspace.root }, 'initial composition'),
      ).not.toThrow();
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: workspace.root }, 'restarted composition'),
      ).not.toThrow();
    } finally {
      await workspace.dispose();
    }
  });

  it('a different resolved composition path FAILS CLOSED', async () => {
    const workspace = createQ6LiveWorkspace();
    const foreign = mkdtempSync(join(tmpdir(), 'qlt-q6-live-foreign-'));
    try {
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: foreign }, 'restarted composition'),
      ).toThrowError(/identity violation/);
      // A path that only RESOLVES elsewhere is refused too.
      expect(() =>
        workspace.requireCompositionDataDir({ dataDir: '.' }, 'composition'),
      ).toThrowError();
      // A composition that reports no directory fails closed.
      expect(() => workspace.requireCompositionDataDir({}, 'composition')).toThrowError(
        /did not report/,
      );
      // The env builder refuses a foreign directory as well.
      expect(() => workspace.dataEnv(foreign)).toThrowError(/identity violation/);
    } finally {
      rmSync(foreign, { recursive: true, force: true });
      await workspace.dispose();
    }
  });
});

describe('Q6 live workspace: credential scanning', () => {
  it('nested files are included in the scan', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      const canary = `q6-canary-${randomBytes(16).toString('hex')}`;
      const deep = join(workspace.root, 'a', 'b', 'c');
      mkdirSync(deep, { recursive: true });
      writeFileSync(join(deep, 'durable-store.db'), `payload ${canary} payload`);
      writeFileSync(join(workspace.root, 'shallow.txt'), 'no secret here');
      const offending = workspace.scanForCredential(canary);
      expect(offending).toEqual([join('a', 'b', 'c', 'durable-store.db')]);
      // A value that was never written scans clean.
      expect(workspace.scanForCredential(`absent-${randomBytes(8).toString('hex')}`)).toEqual([]);
    } finally {
      await workspace.dispose();
    }
  });

  it('a planted canary is detected anywhere under the root', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      const canary = randomBytes(32).toString('hex');
      mkdirSync(join(workspace.root, 'mastra', 'stores'), { recursive: true });
      writeFileSync(
        join(workspace.root, 'mastra', 'stores', 'storage.db'),
        Buffer.from(`header\n${canary}\nfooter`),
      );
      const offending = workspace.scanForCredential(canary);
      expect(offending).toHaveLength(1);
      expect(offending[0]).toContain('storage.db');
    } finally {
      await workspace.dispose();
    }
  });
});

describe('Q6 live workspace: verified cleanup', () => {
  it('success cleanup removes the root', async () => {
    const workspace = createQ6LiveWorkspace();
    writeFileSync(join(workspace.root, 'leftover.txt'), 'x');
    const result = await workspace.dispose();
    expect(result.removed).toBe(true);
    expect(() => statSync(workspace.root)).toThrowError();
  });

  it('failure-path cleanup removes the root (files present, proof failing)', async () => {
    const workspace = createQ6LiveWorkspace();
    mkdirSync(join(workspace.root, 'mastra'), { recursive: true });
    writeFileSync(join(workspace.root, 'mastra', 'storage.db'), 'bytes');
    writeFileSync(join(workspace.root, 'shared-world.db'), 'bytes');
    const result = await workspace.dispose();
    expect(result.removed).toBe(true);
    expect(() => statSync(workspace.root)).toThrowError();
  });

  it('cleanup failure is REPORTED as failure (never a silent note)', async () => {
    const ebusy = Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
    const failing = createQ6LiveWorkspace({
      removeFn: () => {
        throw ebusy;
      },
    });
    try {
      const result = await failing.dispose({ retries: 1 });
      expect(result.removed).toBe(false);
      expect(result.error).toBe(ebusy);
    } finally {
      // Free the fixture workspace through the injected seam's twin.
      rmSync(failing.root, { recursive: true, force: true });
    }
    // A remover that does nothing (e.g. the directory is held) also
    // reports removed=false — the shape the live proof maps to FAIL.
    const stuck = createQ6LiveWorkspace({
      removeFn: () => undefined,
    });
    try {
      const result = await stuck.dispose({ retries: 0 });
      expect(result.removed).toBe(false);
    } finally {
      rmSync(stuck.root, { recursive: true, force: true });
    }
    // The real remover (no injection) removes a plain root.
    const real = createQ6LiveWorkspace();
    const realResult = await real.dispose();
    expect(realResult.removed).toBe(true);
  });
});

describe('Q6 live workspace: forbidden paths', () => {
  it('repository paths and .quellight-data remain forbidden', async () => {
    const workspace = createQ6LiveWorkspace();
    try {
      expect(() =>
        workspace.requireOwned(join(process.cwd(), OPERATOR_DATA_DIR_NAME), 'probe'),
      ).toThrowError(/operator data/);
      expect(() =>
        workspace.requireOwned(join(process.cwd(), 'src', 'lib', 'server'), 'probe'),
      ).toThrowError(/repository/);
      expect(() => workspace.requireOwned(process.cwd(), 'probe')).toThrowError(/repository/);
      // A path that merely CONTAINS an operator-data segment is refused.
      expect(() =>
        workspace.requireOwned(
          join(tmpdir(), `nest-${randomBytes(4).toString('hex')}`, OPERATOR_DATA_DIR_NAME),
          'probe',
        ),
      ).toThrowError(/operator data/);
      // The env builder and the identity assertion refuse them too.
      expect(() => workspace.dataEnv(join(process.cwd(), OPERATOR_DATA_DIR_NAME))).toThrowError(
        /operator data/,
      );
      expect(() =>
        workspace.requireCompositionDataDir(
          { dataDir: join(process.cwd(), OPERATOR_DATA_DIR_NAME) },
          'probe',
        ),
      ).toThrowError(/operator data/);
      // And the owned root itself is never one of those paths.
      expect(workspace.root).not.toContain(OPERATOR_DATA_DIR_NAME);
    } finally {
      await workspace.dispose();
    }
  });
});

describe('Q6 live workspace: no provider surface', () => {
  it('the helper imports only node builtins and references no provider surface', () => {
    const helperSource = readFileSync('scripts/lib/q6-live-workspace.mjs', 'utf8');
    const sources = [...helperSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.startsWith('node:'))).toBe(true);
    expect(helperSource).not.toMatch(
      /createQuellightComposition|OLLAMA|API_KEY|\bfetch\s*\(|admitTurn/,
    );
  });
});
