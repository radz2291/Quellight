/**
 * Frozen-evidence scan exception registry (Stage 07E; owner decision
 * D-07E-01; carries finding L-4 from the Stage 07D D5 re-verification).
 *
 * WHY THIS EXISTS: the frozen D5 independent-audit report quotes its own
 * auditor's local environment paths in §1, so the composite ladder's
 * local-path scan deterministically flags a byte-frozen historical record.
 * The owner decided (D-07E-01) to preserve the report byte-for-byte and to
 * bind the narrowest defensible scan disposition to it: exactly ONE
 * exception, keyed to the exact historical file path, the exact content
 * SHA-256, the exact Git blob ID, and the exact already-documented match
 * set. Documentation in general is NOT excluded; the credential, canary,
 * fixture-content, operator-data, and privacy scans are NOT weakened; the
 * historical report is NOT redacted or rewritten.
 *
 * CONTRACT: `quellight.stage07e.exit-contract@1` §5/§6.1
 * (docs/report/QUELLIGHT-STAGE-07E-EXIT-CONTRACT-FREEZE.md — itself
 * digest-pinned by scripts/verify-stage7e.mjs).
 *
 * FAIL-CLOSED RULES (all enforced by `evaluateFrozenEvidence`):
 *   - any byte change to a registered file (digest drift) fails;
 *   - any additional match, different match text, or match on a different
 *     line fails;
 *   - the same content at a different path gains nothing (registration is
 *     by exact path AND digests);
 *   - a registered file that no longer trips the local-path pattern still
 *     fails its digest verification — removing the paths by editing the
 *     frozen record is a rewrite, not a fix.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative, sep } from 'node:path';

/**
 * @typedef {Object} FrozenEvidenceRecord
 * @property {string} path repo-relative POSIX path of the frozen file
 * @property {string} sha256 exact content digest (working tree == repo; LF discipline)
 * @property {string} gitBlob exact Git blob ID (`git hash-object`)
 * @property {string} decision owner decision registering the exception
 * @property {Array<{line: number, match: string}>} expectedMatches exact ordered match set
 */

/** @type {FrozenEvidenceRecord[]} */
export const FROZEN_EVIDENCE_RECORDS = [
  {
    path: 'docs/report/QUELLIGHT-STAGE-07D-PHASE-D5-INDEPENDENT-AUDIT.md',
    sha256: '169a215369114b443697e68c7974b10d56742196f5bc11912cd7d0a6dd7a41b5',
    gitBlob: 'd89fad1134e55b5e32e302519219e23085f8ff69',
    decision: 'D-07E-01',
    expectedMatches: [
      { line: 15, match: 'C:\\Users\\' },
      { line: 16, match: 'C:\\Users\\' },
    ],
  },
];

export const frozenEvidenceFor = (relativePath) =>
  FROZEN_EVIDENCE_RECORDS.find((record) => record.path === relativePath);

/** Repo-relative POSIX path for a file walked under the repository root. */
export const relativePosix = (root, file) => relative(root, file).split(sep).join('/');

/** `git hash-object` of the working-tree bytes (fail-closed on error). */
export const gitBlobIdOfWorkingFile = (file) => {
  try {
    return execFileSync('git', ['hash-object', '--', file], { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
};

const sha256Of = (content) => createHash('sha256').update(content, 'utf8').digest('hex');

/**
 * Collect the ordered local-path matches of `content` using the caller's
 * exact scan regex (the rule stays defined in ONE place — the scanner).
 * @param {string[]} lines the content split on '\n'
 * @param {RegExp} localPathRegex a GLOBAL regex; lastIndex is reset here
 * @returns {Array<{line: number, match: string}>}
 */
export const collectMatches = (lines, localPathRegex) => {
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    localPathRegex.lastIndex = 0;
    let match;
    while ((match = localPathRegex.exec(lines[index])) !== null) {
      hits.push({ line: index + 1, match: match[0] });
    }
  }
  return hits;
};

/**
 * Full evaluation for one registered file.
 * @param {FrozenEvidenceRecord} record
 * @param {string} content the file bytes (utf8)
 * @param {string|undefined} gitBlobId `git hash-object` of the working file
 * @param {string[]} contentLines the file split on '\n'
 * @param {RegExp} localPathRegex the scanner's exact local-path pattern (global)
 * @returns {{accepted: boolean, problems: string[], matches: Array<{line:number,match:string}>, detail: string}}
 */
export const evaluateFrozenEvidence = (
  record,
  content,
  gitBlobId,
  contentLines,
  localPathRegex,
) => {
  const problems = [];
  const digest = sha256Of(content);
  if (digest !== record.sha256) {
    problems.push(`content digest drifted from the frozen record (${digest})`);
  }
  if (gitBlobId !== record.gitBlob) {
    problems.push(
      `git blob drifted from the frozen record (${gitBlobId ?? 'hash-object unavailable'})`,
    );
  }
  const matches = collectMatches(contentLines, localPathRegex);
  if (matches.length !== record.expectedMatches.length) {
    problems.push(`match count ${matches.length} != frozen count ${record.expectedMatches.length}`);
  } else {
    for (let index = 0; index < matches.length; index += 1) {
      const got = matches[index];
      const want = record.expectedMatches[index];
      if (got.line !== want.line || got.match !== want.match) {
        problems.push(
          `match ${index + 1} deviates: got line ${got.line} ${JSON.stringify(got.match)}, ` +
            `frozen line ${want.line} ${JSON.stringify(want.match)}`,
        );
      }
    }
  }
  return {
    accepted: problems.length === 0,
    problems,
    matches,
    detail: `path+sha256+git-blob+match-set ${problems.length === 0 ? 'all verified' : 'MISMATCH'}`,
  };
};
