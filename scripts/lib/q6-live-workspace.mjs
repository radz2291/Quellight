/**
 * The Q6 live-proof disposable workspace owner (script-only helper; no
 * product source, no durable schema, no provider surface).
 *
 * WHY THIS EXISTS: the original live harness allocated one directory for
 * leak-scan/cleanup ownership and let `composeLive` silently allocate a
 * SECOND directory for the actual composition (the `reuseDataDir`
 * boolean), so the restart recomposed against the WRONG store, the leak
 * scan could miss the composition's real directory, and cleanup could
 * strand it. This helper makes directory ownership explicit and single:
 *
 *   - `createQ6LiveWorkspace()` allocates EXACTLY ONE disposable root
 *     (one `mkdtempSync`, always inside the OS temporary directory).
 *   - `adoptQ6LiveWorkspace(root)` ADOPTS the parent-allocated root in
 *     the worker process with the SAME refusal/validation/scanning
 *     semantics and NO `dispose`: the worker has no deletion capability
 *     at all (parent/worker lifecycle; amendment §6). Adoption performs
 *     no allocation — there is still exactly ONE `mkdtempSync` anywhere.
 *   - `requireOwned(directory)` / `dataEnv(directory)` refuse every path
 *     that is not that exact root — including repository paths and the
 *     operator `.quellight-data` directory (fail closed).
 *   - `requireCompositionDataDir(composition)` fails closed unless the
 *     composition's resolved `dataDir` IS the owned root; the live
 *     worker calls it BEFORE any provider turn. A REJECTED path is
 *     never touched: only `workspace.root` may ever be removed.
 *   - `requireResolvedEnvironmentDataDir(environment)` fails closed
 *     unless the RESOLVED Quellight environment's data directory IS the
 *     owned root; the live worker calls it BEFORE constructing the
 *     composition (in addition to checking `composition.dataDir`
 *     afterward).
 *   - `scanForCredential(secret)` walks EVERY file under the root
 *     (nested included) and returns the offending relative paths; the
 *     caller turns hits into proof failures. The secret value is never
 *     logged by this helper. The scan FAILS (throws) unless traversal
 *     COMPLETES: an unexpectedly absent root, a non-directory root, an
 *     unreadable entry, or any traversal error is never treated as a
 *     clean scan.
 *   - `dispose()` (allocation side ONLY) removes the root with bounded
 *     retries and reports `{ removed }`; it NEVER throws — the caller
 *     (the live parent) maps `removed: false` to a proof FAILURE, not a
 *     note. The adopted (worker) API has no `dispose` whatsoever.
 *
 * The helper imports only node builtins and performs no I/O outside the
 * owned root. It is deliberately NOT generalized temporary-directory
 * infrastructure: it exists for the Q6 live proof's frozen cleanup and
 * scanning requirements and for its focused regression tests.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/** The temp-directory prefix owned by the Q6 live proof. */
export const Q6_LIVE_WORKSPACE_PREFIX = 'qlt-q6-live-';

/** The operator data directory name that must never be accessed. */
export const OPERATOR_DATA_DIR_NAME = '.quellight-data';

/** The nearest repository root for the current working directory (or null). */
const repositoryRoot = () => {
  let current = process.cwd();
  for (;;) {
    try {
      statSync(join(current, '.git'));
      return current;
    } catch {
      /* keep walking */
    }
    const parent = resolve(current, '..');
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

/**
 * A specific refusal reason for paths that must never be touched by
 * the live proof (operator data, repository paths, non-temp paths).
 *
 * @param {string} directory
 * @param {{ repoRoot: string | null; tempRoot: string }} context
 * @returns {string | null}
 */
const forbiddenReasonFor = (directory, context) => {
  const candidate = resolve(directory);
  if (candidate.split(sep).includes(OPERATOR_DATA_DIR_NAME)) {
    return `the operator data directory (${OPERATOR_DATA_DIR_NAME}) is never accessed by the live proof`;
  }
  if (
    context.repoRoot !== null &&
    (candidate === context.repoRoot || candidate.startsWith(context.repoRoot + sep))
  ) {
    return 'paths inside the repository are never used as proof data directories';
  }
  if (candidate !== context.tempRoot && !candidate.startsWith(context.tempRoot + sep)) {
    return 'proof data directories must live inside the OS temporary directory';
  }
  return null;
};

/**
 * Build the owner API for one verified root. Shared by the allocating
 * and adopting constructors so refusal, validation, and scanning
 * semantics are IDENTICAL for both sides of the parent/worker lifecycle.
 *
 * @param {string} root The verified owned root (resolved absolute).
 * @param {{ remove: ((directory: string, options?: { recursive?: boolean; force?: boolean }) => void) | undefined }} removal
 *   The removal capability. `undefined` (adoption) omits `dispose` entirely.
 * @returns {Q6LiveWorkspace}
 */
const workspaceApiFor = (root, { remove }) => {
  const repoRoot = repositoryRoot();
  const tempRoot = resolve(tmpdir());
  /** @param {string} directory */
  const forbiddenReason = (directory) => forbiddenReasonFor(directory, { repoRoot, tempRoot });

  const workspace = {
    /** The single owned disposable root (resolved absolute path). */
    root,

    /** Refuse anything that is not the exact owned root.
     *
     * @param {string} directory
     * @param {string} label
     * @returns {void}
     */
    requireOwned(directory, label) {
      const reason = /** @type {string | null} */ (forbiddenReason(directory));
      if (reason !== null) {
        throw new Error(`${label}: ${reason} (refused: ${resolve(directory)})`);
      }
      if (resolve(directory) !== root) {
        throw new Error(
          `${label}: directory identity violation — ${resolve(directory)} is not the owned workspace root ${root}`,
        );
      }
    },

    /**
     * Fail closed unless the composition's resolved data directory IS
     * the owned root. The live worker calls this BEFORE any provider
     * turn so an identity mismatch can never reach the provider. A
     * rejected path is never touched — only `workspace.root` may ever
     * be removed (by the parent, through dispose).
     *
     * @param {{ dataDir?: unknown }} composition
     * @param {string} label
     * @returns {string}
     */
    requireCompositionDataDir(composition, label) {
      const directory = composition?.dataDir;
      if (typeof directory !== 'string' || directory.length === 0) {
        throw new Error(`${label}: the composition did not report a resolved data directory`);
      }
      workspace.requireOwned(directory, label);
      return resolve(directory);
    },

    /** The data-directory env payload — only ever for the owned root.
     *
     * @param {string} directory
     * @returns {{ QUELLIGHT_DATA_DIR_ABSOLUTE: string }}
     */
    dataEnv(directory) {
      workspace.requireOwned(directory, 'dataEnv');
      return { QUELLIGHT_DATA_DIR_ABSOLUTE: root };
    },

    /**
     * Fail closed unless the RESOLVED Quellight environment's data
     * directory IS the owned root. The live worker calls this BEFORE
     * constructing the composition, in addition to checking
     * `composition.dataDir` afterward.
     *
     * @param {{ dataDir?: unknown }} environment
     * @returns {string}
     */
    requireResolvedEnvironmentDataDir(environment) {
      const directory = environment?.dataDir;
      if (typeof directory !== 'string' || directory.length === 0) {
        throw new Error(
          'requireResolvedEnvironmentDataDir: the resolved environment did not report a data directory',
        );
      }
      workspace.requireOwned(directory, 'requireResolvedEnvironmentDataDir');
      return resolve(directory);
    },

    /**
     * Scan EVERY file under the owned root (nested included) for the
     * credential VALUE. Returns the offending relative paths; empty
     * means every persisted byte was read and is credential-free. The
     * scan FAILS (throws) unless traversal COMPLETES: an unexpectedly
     * absent root, a non-directory root, an unreadable entry, or any
     * traversal error is never treated as a clean scan. The value
     * itself is never emitted.
     *
     * @param {string} secretValue
     * @returns {string[]}
     */
    scanForCredential(secretValue) {
      if (typeof secretValue !== 'string' || secretValue.length === 0) {
        throw new Error('scanForCredential: the secret value must be a non-empty string');
      }
      let rootStats;
      try {
        rootStats = statSync(root);
      } catch {
        throw new Error(
          'scanForCredential: the owned workspace root is unexpectedly absent — an absent workspace is NOT evidence of a clean scan',
        );
      }
      if (!rootStats.isDirectory()) {
        throw new Error(
          'scanForCredential: the owned workspace root is not a directory — refusing to treat it as scanned',
        );
      }
      /** @type {string[]} */
      const offending = [];
      /** @param {string} directory */
      const walk = (directory) => {
        for (const entry of readdirSync(directory)) {
          const full = join(directory, entry);
          if (statSync(full).isDirectory()) {
            walk(full);
          } else if (readFileSync(full).includes(secretValue)) {
            offending.push(full.slice(root.length + 1));
          }
        }
      };
      // No catch: an incomplete traversal must surface to the caller as
      // a scan FAILURE, never as a clean result.
      walk(root);
      return offending;
    },

    ...(remove === undefined
      ? {}
      : {
          /**
           * Remove the owned root with bounded retries. NEVER throws: the
           * caller maps `removed: false` to a proof failure. Available on
           * the ALLOCATING (parent) API only — the adopted (worker) API
           * carries no deletion capability at all.
           */
          async dispose({ retries = 5 } = {}) {
            let lastError;
            for (let attempt = 0; attempt <= retries; attempt += 1) {
              try {
                remove(root, { recursive: true, force: true });
                statSync(root);
                lastError = new Error('the workspace root still exists after removal');
              } catch (error) {
                if (/** @type {{ code?: string }} */ (error)?.code === 'ENOENT') {
                  return { removed: true };
                }
                lastError = error;
              }
              if (attempt < retries) {
                await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
              }
            }
            return { removed: false, error: lastError };
          },
        }),
  };
  return workspace;
};

/**
 * Allocate the ONE disposable workspace root and return its owner API.
 * `removeFn` is an internal test seam only (defaults to `rmSync`); it
 * never changes ownership, scanning, or refusal semantics.
 *
 * @param {{ removeFn?: (directory: string, options?: { recursive?: boolean; force?: boolean }) => void }} [options]
 * @returns {Q6LiveWorkspace}
 */
export const createQ6LiveWorkspace = (options = {}) => {
  // EXACTLY ONE allocation happens here — nowhere else in the live proof.
  const root = resolve(mkdtempSync(join(tmpdir(), Q6_LIVE_WORKSPACE_PREFIX)));
  return workspaceApiFor(root, {
    remove: options.removeFn ?? ((directory, opts) => rmSync(directory, opts)),
  });
};

/**
 * ADOPT an existing owned workspace root WITHOUT allocating or deleting.
 *
 * The parent/worker lifecycle (amendment §6) splits the live proof: the
 * PARENT allocates the single root and, only after the WORKER has exited,
 * scans and disposes it. The worker adopts the parent's root with this
 * constructor: the returned API carries every ownership, validation, and
 * scanning capability but NO `dispose` — the worker has no deletion
 * capability at all, and no second `mkdtempSync` exists anywhere.
 *
 * @param {string} directory The root the parent allocated (resolved absolute).
 * @returns {Q6LiveWorkspace} The owner API without `dispose`.
 */
export const adoptQ6LiveWorkspace = (directory) => {
  const root = resolve(directory);
  const reason = forbiddenReasonFor(root, { repoRoot: repositoryRoot(), tempRoot: resolve(tmpdir()) });
  if (reason !== null) {
    throw new Error(`adoptQ6LiveWorkspace: ${reason}`);
  }
  let stats;
  try {
    stats = statSync(root);
  } catch {
    throw new Error(
      'adoptQ6LiveWorkspace: the owned workspace root is unexpectedly absent — refusing to adopt',
    );
  }
  if (!stats.isDirectory()) {
    throw new Error('adoptQ6LiveWorkspace: the owned workspace root is not a directory');
  }
  return workspaceApiFor(root, { remove: undefined });
};
