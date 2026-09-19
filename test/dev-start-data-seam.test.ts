// Q5 verification-isolation remediation: focused behavioral coverage for the
// `QUELLIGHT_DATA_DIR_ABSOLUTE` seam in `resolveQuellightEnvironment`.
//
// Every case runs against a SYNTHETIC repository root created in the OS
// temporary directory — never the real repository root and never the real
// operator data directory. The guard branches that would point at operator
// data are exercised purely through path arithmetic on the synthetic root,
// which is exactly how the guard behaves in production (pure comparison,
// no filesystem access).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QuellightCompositionError, resolveQuellightEnvironment } from '$lib/server/composition';

function syntheticRepo(): string {
  return mkdtempSync(join(tmpdir(), 'quellight-data-seam-test-'));
}

describe('resolveQuellightEnvironment data-location seam', () => {
  it('keeps the default operator-relative data location when no override is set', () => {
    const repo = syntheticRepo();
    try {
      const env = resolveQuellightEnvironment({}, repo);
      expect(env.dataDir).toBe(resolvePath(join(repo, '.quellight-data')));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('keeps the bounded relative QUELLIGHT_DATA_DIR behavior unchanged', () => {
    const repo = syntheticRepo();
    try {
      const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'data' }, repo);
      expect(env.dataDir).toBe(resolvePath(join(repo, 'data')));
      expect(() => resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: '..\\escape' }, repo)).toThrow(
        QuellightCompositionError,
      );
      expect(() => resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR: 'a/../b' }, repo)).toThrow(
        QuellightCompositionError,
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('accepts an absolute override that resolves strictly outside the repository', () => {
    const repo = syntheticRepo();
    const outside = mkdtempSync(join(tmpdir(), 'quellight-data-seam-outside-'));
    try {
      const env = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: outside }, repo);
      expect(env.dataDir).toBe(resolvePath(outside));
      expect(isAbsolute(env.dataDir)).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('refuses an override at or inside the default operator data directory', () => {
    const repo = syntheticRepo();
    try {
      const operatorDir = resolvePath(join(repo, '.quellight-data'));
      expect(() =>
        resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: operatorDir }, repo),
      ).toThrow(/default operator data directory/);
      expect(() =>
        resolveQuellightEnvironment(
          { QUELLIGHT_DATA_DIR_ABSOLUTE: join(operatorDir, 'nested') },
          repo,
        ),
      ).toThrow(/default operator data directory/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('refuses an override at or inside the repository', () => {
    const repo = syntheticRepo();
    try {
      expect(() =>
        resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: repo }, repo),
      ).toThrow(/outside the repository/);
      expect(() =>
        resolveQuellightEnvironment(
          { QUELLIGHT_DATA_DIR_ABSOLUTE: join(repo, 'tmp', 'gate-data') },
          repo,
        ),
      ).toThrow(/outside the repository/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('refuses relative, traversal, empty, and combined override forms', () => {
    const repo = syntheticRepo();
    try {
      expect(() =>
        resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: 'relative/dir' }, repo),
      ).toThrow(/absolute path/);
      expect(() =>
        resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: '../outside' }, repo),
      ).toThrow(/absolute path/);
      expect(() =>
        resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: '   ' }, repo),
      ).not.toThrow(); // whitespace-only is treated as unset, like the relative form
      const unsetEnv = resolveQuellightEnvironment({ QUELLIGHT_DATA_DIR_ABSOLUTE: '   ' }, repo);
      expect(unsetEnv.dataDir).toBe(resolvePath(join(repo, '.quellight-data')));
      expect(() =>
        resolveQuellightEnvironment(
          { QUELLIGHT_DATA_DIR: 'data', QUELLIGHT_DATA_DIR_ABSOLUTE: tmpdir() },
          repo,
        ),
      ).toThrow(/must not be combined/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
