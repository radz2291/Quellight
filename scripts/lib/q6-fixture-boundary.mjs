/**
 * The Q6 live-proof EXTERNAL natural-fixture boundary (script-only helper;
 * amendment §7, D-Q6-6).
 *
 * The Turn-2 natural fixture is the operator's PERSONAL text. It is never
 * committed, embedded, logged, or reported. It reaches the live proof only
 * through an operator-designated external UTF-8 file named by the
 * QUELLIGHT_Q6_NATURAL_FIXTURE_FILE environment variable, and this boundary
 * is the ONLY code that may read it:
 *
 *   - the path must be ABSOLUTE and must resolve OUTSIDE the repository and
 *     outside the operator `.quellight-data` directory (any path segment);
 *   - the target must exist, must be a REGULAR file, must be at most
 *     `QLT_Q6_NATURAL_FIXTURE_MAX_BYTES` UTF-8 bytes, must contain no NUL
 *     bytes, and must decode as valid UTF-8;
 *   - every failure is NON-ECHOING: the error message names the stable
 *     reason only — never the path and never any content;
 *   - the returned EVIDENCE carries only the byte length and the SHA-256
 *     fixture identity (plus the in-memory text the live worker sends as
 *     the user turn — the text never enters any report, log, or artifact);
 *   - the fixture is read-only input: nothing in this module writes,
 *     moves, or deletes it, and the parent re-verifies its identity after
 *     the worker exits (a changed or vanished fixture fails the proof).
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  QLT_Q6_NATURAL_FIXTURE_MAX_BYTES,
  QLT_Q6_NATURAL_FIXTURE_VAR,
} from '../../src/lib/sharedworld/q6-contract.ts';

/** Stable, non-echoing fixture-boundary failure codes. */
export const Q6_FIXTURE_ERROR_CODES = {
  NOT_SET: 'QLT_Q6_FIXTURE_NOT_SET',
  NOT_ABSOLUTE: 'QLT_Q6_FIXTURE_NOT_ABSOLUTE',
  OPERATOR_DATA: 'QLT_Q6_FIXTURE_OPERATOR_DATA',
  INSIDE_REPOSITORY: 'QLT_Q6_FIXTURE_INSIDE_REPOSITORY',
  NOT_READABLE: 'QLT_Q6_FIXTURE_NOT_READABLE',
  NOT_REGULAR_FILE: 'QLT_Q6_FIXTURE_NOT_REGULAR_FILE',
  TOO_LARGE: 'QLT_Q6_FIXTURE_TOO_LARGE',
  NUL_BYTES: 'QLT_Q6_FIXTURE_NUL_BYTES',
  NOT_UTF8: 'QLT_Q6_FIXTURE_NOT_UTF8',
};

/** A fixture-boundary failure: a stable code plus a message that names the
 * reason only — never the path, never any content. */
export class Q6FixtureBoundaryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'Q6FixtureBoundaryError';
    this.code = code;
  }
}

/**
 * The safe evidence identity of the external fixture (the ONLY fixture
 * facts that may enter reports, logs, or completion output).
 *
 * @typedef {{ byteLength: number; sha256: string }} Q6FixtureIdentity
 */

/**
 * Validate and resolve the operator-designated external natural fixture.
 * The in-memory `text` is for the live worker's Turn-2 user input ONLY.
 *
 * @param {{ fixturePath: string | undefined; repoRoot: string }} input
 * @returns {{ path: string; byteLength: number; sha256: string; text: string }}
 */
export const resolveNaturalFixture = ({ fixturePath, repoRoot }) => {
  if (typeof fixturePath !== 'string' || fixturePath.trim() === '') {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NOT_SET,
      `${QLT_Q6_NATURAL_FIXTURE_VAR} is not set — the live proof requires the operator-designated external natural fixture (amendment §7)`,
    );
  }
  if (!isAbsolute(fixturePath)) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NOT_ABSOLUTE,
      'the natural fixture path must be an absolute path (path not echoed)',
    );
  }
  const candidate = resolve(fixturePath);
  if (candidate.split(sep).includes('.quellight-data')) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.OPERATOR_DATA,
      'the operator .quellight-data directory is never accessed by the live proof (path not echoed)',
    );
  }
  const repository = resolve(repoRoot);
  const rel = relative(repository, candidate);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.INSIDE_REPOSITORY,
      'paths inside the repository are never used as the natural fixture (path not echoed)',
    );
  }
  let bytes;
  try {
    const stats = statSync(candidate);
    if (!stats.isFile()) {
      throw new Q6FixtureBoundaryError(
        Q6_FIXTURE_ERROR_CODES.NOT_REGULAR_FILE,
        'the natural fixture path is not a regular file (path not echoed)',
      );
    }
    bytes = readFileSync(candidate);
  } catch (error) {
    if (error instanceof Q6FixtureBoundaryError) {
      throw error;
    }
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NOT_READABLE,
      'the natural fixture file does not exist or is not readable (path not echoed)',
    );
  }
  if (bytes.length > QLT_Q6_NATURAL_FIXTURE_MAX_BYTES) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.TOO_LARGE,
      `the natural fixture exceeds the ${QLT_Q6_NATURAL_FIXTURE_MAX_BYTES}-byte maximum (${bytes.length} bytes; content not echoed)`,
    );
  }
  if (bytes.includes(0)) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NUL_BYTES,
      'the natural fixture contains NUL bytes (content not echoed)',
    );
  }
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NOT_UTF8,
      'the natural fixture is not valid UTF-8 (content not echoed)',
    );
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { path: candidate, byteLength: bytes.length, sha256, text };
};

/**
 * Re-verify the fixture identity AFTER the worker exits (parent-side
 * content-safety check): the file must still exist, still be readable,
 * and still hash to the SAME identity. Returns the identity; throws a
 * non-echoing boundary error on any change or disappearance.
 *
 * @param {{ fixturePath: string | undefined; repoRoot: string; expected: Q6FixtureIdentity }} input
 * @returns {Q6FixtureIdentity}
 */
export const reverifyFixtureIdentity = ({ fixturePath, repoRoot, expected }) => {
  const current = resolveNaturalFixture({ fixturePath, repoRoot });
  if (current.byteLength !== expected.byteLength || current.sha256 !== expected.sha256) {
    throw new Q6FixtureBoundaryError(
      Q6_FIXTURE_ERROR_CODES.NOT_READABLE,
      'the external fixture changed during the proof — a modified fixture fails the content-safety check (content not echoed)',
    );
  }
  return { byteLength: current.byteLength, sha256: current.sha256 };
};
