// Owner-invoked recovery launcher. The live receipt prevents accidental re-execution.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { runQ6LiveProof } from './lib/q6-live-parent.mjs';

const live = process.argv[2] === '--live';
if (
  (!live && process.argv[2] !== '--offline') ||
  (live && process.env.QUELLIGHT_Q6_RECOVERY !== '1')
)
  process.exit(2);
const receipt = resolve('docs/report/evidence/q6-recovery-live.json');
if (live) {
  mkdirSync(resolve('docs/report/evidence'), { recursive: true });
  try {
    writeFileSync(
      receipt,
      JSON.stringify({ status: 'started', authorization: '2026-09-22', executions: 1 }),
      { flag: 'wx' },
    );
  } catch {
    console.error('QLT_Q6_RECOVERY_ALREADY_STARTED');
    process.exit(2);
  }
}
const fixtureRoot = mkdtempSync(join(tmpdir(), 'qlt-q6-recovery-fixture-'));
const fixturePath = join(fixtureRoot, 'synthetic-natural-fixture.txt');
const fixtureText = [
  'This week was a setup marathon. My work laptop screen stopped working, so I moved to a borrowed machine.',
  'I had to reinstall the tools twice, and a part for the desk arrived late. I am frustrated today.',
  'Through all of that, one thing stays fixed: I will not leave my current job without a clear pathway and an established base.',
  'I still cannot decide whether to push that change on a fast track or move gradually.',
  'Honestly, I do not know whether this stretch of trouble is a signal of anything at all.',
].join(' ');
writeFileSync(fixturePath, fixtureText, 'utf8');
let result;
let credential = 'q6-recovery-offline-canary';
const notes = [];
let childOutputSafe = true;
try {
  if (live)
    credential =
      process.env.OLLAMA_API_KEY ||
      JSON.parse(readFileSync(join(homedir(), '.pi/agent/auth.json'), 'utf8')).ollama.key;
  if (typeof credential !== 'string' || !credential || credential.startsWith('$'))
    throw new Error();
  const outcome = await runQ6LiveProof({
    repoRoot: process.cwd(),
    env: {
      ...process.env,
      OLLAMA_API_KEY: credential,
      QUELLIGHT_LIVE_PROOF: '1',
      QUELLIGHT_Q6_OFFLINE: live ? '0' : '1',
      QUELLIGHT_Q6_NATURAL_FIXTURE_FILE: fixturePath,
    },
    log: (message) => notes.push(message),
    spawnFn(file, args, options) {
      const child = spawnSync(file, args, {
        ...options,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 780_000,
        maxBuffer: 1024 * 1024,
      });
      childOutputSafe = !child.stdout?.includes(credential) && !child.stderr?.includes(credential);
      // The worker suppresses dependency output; only its metadata-only notes remain.
      if (childOutputSafe)
        notes.push(...(child.stdout ?? '').split(/\r?\n/).filter((line) => line.startsWith('  ')));
      return { status: childOutputSafe ? child.status : 1 };
    },
  });
  result = {
    mode: live ? 'live' : 'offline',
    fixtureProvenance: 'synthetic-naturalistic',
    childOutputSafe,
    ...outcome,
    notes,
  };
} catch {
  result = { mode: live ? 'live' : 'offline', exit: 1, failure: 'QLT_Q6_RECOVERY_LAUNCH_FAILED' };
} finally {
  // Only the exact directory allocated by this launcher is deletable.
  const rel = relative(resolve(tmpdir()), resolve(fixtureRoot));
  if (!rel.startsWith('qlt-q6-recovery-fixture-') || rel.includes('..'))
    throw new Error('QLT_Q6_FIXTURE_CLEANUP_REFUSED');
  rmSync(fixtureRoot, { recursive: true, force: true });
  result.fixtureRemoved = !existsSync(fixtureRoot);
}
if (!result.fixtureRemoved) result.exit = 1;
if (live) writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exit(result.exit);
