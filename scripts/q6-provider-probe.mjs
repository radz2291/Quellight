// Owner-invoked diagnostic, never an automatic gate or a formal ceremony.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createQ6LiveWorkspace } from './lib/q6-live-workspace.mjs';

const scenario = process.argv[2];
if (
  ![
    'valid',
    'invalid',
    'length',
    'baseline',
    'none',
    'none1024',
    'guided2048',
    'guided-offline',
    'matrix',
  ].includes(scenario)
)
  process.exit(2);
const live = ['baseline', 'none', 'none1024', 'guided2048'].includes(scenario);
if (live && process.env.QUELLIGHT_DIAGNOSTIC !== '1') process.exit(2);
const workspace = createQ6LiveWorkspace();
let credential = 'q6-network-disabled-canary';
try {
  if (live)
    credential =
      process.env.OLLAMA_API_KEY ||
      JSON.parse(readFileSync(join(homedir(), '.pi/agent/auth.json'), 'utf8')).ollama.key;
  if (typeof credential !== 'string' || !credential || credential.startsWith('$'))
    throw new Error();
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/lib/q6-provider-probe-worker.mjs', scenario],
    {
      env: { ...process.env, OLLAMA_API_KEY: credential, QUELLIGHT_Q6_OWNED_ROOT: workspace.root },
      encoding: 'utf8',
      timeout: 150_000,
      maxBuffer: 1024 * 1024,
    },
  );
  const leaks = workspace.scanForCredential(credential);
  const outputSafe = !child.stdout?.includes(credential) && !child.stderr?.includes(credential);
  let result;
  try {
    result = JSON.parse(child.stdout);
  } catch {
    result = { failure: 'QLT_PROBE_WORKER_FAILED' };
  }
  // Worker emits only the closed metadata record; never forward stderr.
  if (outputSafe && leaks.length === 0) console.log(JSON.stringify(result));
  else console.log(JSON.stringify({ failure: 'QLT_PROBE_LEAK_SCAN_FAILED' }));
  console.log(
    JSON.stringify({ workerExit: child.status, credentialOccurrences: leaks.length, outputSafe }),
  );
  process.exitCode = child.status === 0 && outputSafe && leaks.length === 0 ? 0 : 1;
} catch {
  console.log(JSON.stringify({ failure: 'QLT_PROBE_SETUP_FAILED' }));
  process.exitCode = 1;
} finally {
  const cleanup = await workspace.dispose();
  console.log(JSON.stringify({ cleanupRemoved: cleanup.removed }));
  if (!cleanup.removed) process.exitCode = 1;
}
