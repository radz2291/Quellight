import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  Q6FixtureBoundaryError,
  Q6_FIXTURE_ERROR_CODES,
  reverifyFixtureIdentity,
  resolveNaturalFixture,
} from '../scripts/lib/q6-fixture-boundary.mjs';
import { QLT_Q6_NATURAL_FIXTURE_MAX_BYTES } from '../src/lib/sharedworld/q6-contract';

/**
 * Q6 EXTERNAL natural-fixture boundary (amendment §7, D-Q6-6): the live
 * fixture is the operator's personal text and reaches the proof only
 * through a validated external UTF-8 file. These focused offline tests
 * prove the boundary's fail-closed validation, its NON-ECHOING failures,
 * its read-only treatment of the file, and the safe evidence identity.
 * All fixtures here are disposable synthetic temp files — never anything
 * personal, and never anything inside the repository.
 */

const repoRoot = process.cwd();

const tempFixture = (content: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-'));
  const file = join(dir, 'fixture.txt');
  writeFileSync(file, content, 'utf8');
  return file;
};

const CANARY = 'PERSONAL-CANARY-CONTENT that must never be echoed';

describe('Q6 fixture boundary: acceptance and safe evidence', () => {
  it('a valid external fixture resolves with byte length and filesystem metadata without hashing content', () => {
    const file = tempFixture(CANARY);
    try {
      const resolved = resolveNaturalFixture({ fixturePath: file, repoRoot });
      expect(Object.keys(resolved).sort()).toEqual(['byteLength', 'identity', 'path', 'text']);
      expect(resolved.byteLength).toBe(Buffer.byteLength(CANARY, 'utf8'));
      expect(resolved.identity.size).toBe(resolved.byteLength);
      expect(resolved).not.toHaveProperty('sha256');
      expect(resolved.path).toBe(resolve(file));
      // The raw text is available ONLY in memory for the live worker.
      expect(resolved.text).toBe(CANARY);
    } finally {
      rmSync(resolve(file, '..'), { recursive: true, force: true });
    }
  });

  it('the fixture is treated as read-only input: validation never modifies or deletes it', () => {
    const file = tempFixture(CANARY);
    try {
      resolveNaturalFixture({ fixturePath: file, repoRoot });
      reverifyFixtureIdentity({
        fixturePath: file,
        repoRoot,
        expected: {
          byteLength: Buffer.byteLength(CANARY, 'utf8'),
          text: CANARY,
        },
      });
      expect(readFileSync(file, 'utf8')).toBe(CANARY);
    } finally {
      rmSync(resolve(file, '..'), { recursive: true, force: true });
    }
  });

  it('the module imports only node builtins (no provider surface, no deletion)', () => {
    const source = readFileSync('scripts/lib/q6-fixture-boundary.mjs', 'utf8');
    expect(source).not.toMatch(/rmSync|unlink|rmdir|writeFileSync/);
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier.startsWith('node:') || specifier.startsWith('../../src/')).toBe(true);
    }
  });
});

describe('Q6 fixture boundary: fail-closed, non-echoing validation', () => {
  it('refuses an unset path', () => {
    try {
      resolveNaturalFixture({ fixturePath: undefined, repoRoot });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Q6FixtureBoundaryError);
      expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NOT_SET);
    }
  });

  it('refuses a relative path (path not echoed)', () => {
    try {
      resolveNaturalFixture({ fixturePath: 'relative/fixture.txt', repoRoot });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NOT_ABSOLUTE);
      expect((error as Error).message).toContain('path not echoed');
    }
  });

  it('refuses a path inside the repository without touching anything', () => {
    const inside = join(repoRoot, 'not-a-real-fixture-directory', 'fixture.txt');
    try {
      resolveNaturalFixture({ fixturePath: inside, repoRoot });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.INSIDE_REPOSITORY);
      expect((error as Error).message).toContain('path not echoed');
    }
  });

  it('refuses an operator .quellight-data path segment (fail closed)', () => {
    const fake = join(tmpdir(), '.quellight-data', 'fixture.txt');
    try {
      resolveNaturalFixture({ fixturePath: fake, repoRoot });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.OPERATOR_DATA);
      expect((error as Error).message).toContain('.quellight-data');
    }
  });

  it('refuses a missing file and a directory (path not echoed)', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-')), 'absent.txt');
    try {
      expect(() => resolveNaturalFixture({ fixturePath: missing, repoRoot })).toThrowError(
        Q6FixtureBoundaryError,
      );
      try {
        resolveNaturalFixture({ fixturePath: missing, repoRoot });
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NOT_READABLE);
      }
      const dir = mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-'));
      try {
        try {
          resolveNaturalFixture({ fixturePath: dir, repoRoot });
          throw new Error('should have thrown');
        } catch (error) {
          expect((error as Q6FixtureBoundaryError).code).toBe(
            Q6_FIXTURE_ERROR_CODES.NOT_REGULAR_FILE,
          );
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      rmSync(resolve(missing, '..'), { recursive: true, force: true });
    }
  });

  it('refuses an oversized fixture (above 12288 bytes) with the count but no content', () => {
    const big = 'x'.repeat(QLT_Q6_NATURAL_FIXTURE_MAX_BYTES + 1);
    const file = tempFixture(big);
    try {
      try {
        resolveNaturalFixture({ fixturePath: file, repoRoot });
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.TOO_LARGE);
        expect((error as Error).message).toContain('12288');
        expect((error as Error).message).not.toContain('xxxx');
      }
    } finally {
      rmSync(resolve(file, '..'), { recursive: true, force: true });
    }
  });

  it('refuses NUL bytes and invalid UTF-8 (content not echoed)', () => {
    const nulDir = mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-'));
    const nulFile = join(nulDir, 'nul.txt');
    writeFileSync(nulFile, Buffer.from([0x61, 0x00, 0x62]));
    try {
      try {
        resolveNaturalFixture({ fixturePath: nulFile, repoRoot });
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NUL_BYTES);
      }
    } finally {
      rmSync(nulDir, { recursive: true, force: true });
    }
    const binDir = mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-'));
    const binFile = join(binDir, 'bin.txt');
    writeFileSync(binFile, Buffer.from([0xff, 0xfe, 0x41, 0x80, 0x81]));
    try {
      try {
        resolveNaturalFixture({ fixturePath: binFile, repoRoot });
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NOT_UTF8);
      }
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('a changed fixture fails the post-run identity re-verification without echoing content', () => {
    const file = tempFixture(CANARY);
    try {
      const identity = {
        byteLength: Buffer.byteLength(CANARY, 'utf8'),
        text: CANARY,
      };
      expect(reverifyFixtureIdentity({ fixturePath: file, repoRoot, expected: identity })).toEqual({
        byteLength: identity.byteLength,
      });
      writeFileSync(file, 'changed content entirely', 'utf8');
      try {
        reverifyFixtureIdentity({ fixturePath: file, repoRoot, expected: identity });
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as Q6FixtureBoundaryError).code).toBe(Q6_FIXTURE_ERROR_CODES.NOT_READABLE);
        expect((error as Error).message).toContain('changed during the proof');
        expect((error as Error).message).not.toContain(CANARY);
      }
      rmSync(file, { force: true });
      try {
        reverifyFixtureIdentity({ fixturePath: file, repoRoot, expected: identity });
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Q6FixtureBoundaryError);
      }
    } finally {
      rmSync(resolve(file, '..'), { recursive: true, force: true });
    }
  });

  it('every failure message is non-echoing: the canary content never appears', () => {
    const file = tempFixture(CANARY);
    try {
      const messages: string[] = [];
      const probe = (fixturePath: string | undefined) => {
        try {
          resolveNaturalFixture({ fixturePath, repoRoot });
        } catch (error) {
          messages.push((error as Error).message);
        }
      };
      probe(undefined);
      probe('relative.txt');
      probe(join(repoRoot, 'x.txt'));
      probe(join(tmpdir(), '.quellight-data', 'f.txt'));
      probe(join(mkdtempSync(join(tmpdir(), 'qlt-q6-fixture-')), 'gone.txt'));
      for (const message of messages) {
        expect(message).not.toContain(CANARY);
        expect(message).not.toContain('PERSONAL-CANARY');
      }
    } finally {
      rmSync(resolve(file, '..'), { recursive: true, force: true });
    }
  });
});
