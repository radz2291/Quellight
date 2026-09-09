// One-time host scaffolding (APP-015: scaffold-once).
//
// Runs the pinned @victframework/scaffolder against the repository root.
// Deterministic and non-destructive: rerunning without changes reports
// `unchanged`; any conflict (a generated file that drifted) is reported
// and refuses instead of overwriting application-owned files.
//
// The generated package.json/.gitignore/README are reconciled with the
// repository foundation immediately after generation (see the Stage 07B
// report); the scaffolder is never run again afterwards.
import { resolve } from 'node:path';
import { scaffoldVictApp } from '@victframework/scaffolder';

const targetDir = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const result = scaffoldVictApp({
  targetDir,
  appName: 'Quellight',
  packageName: 'quellight',
});

if (result.status === 'refused') {
  console.error(`scaffolder refused: ${result.reason}`);
  process.exit(1);
}
if (result.status === 'conflict') {
  console.error(`scaffolder conflict (generated files drifted from application-owned files):`);
  for (const conflict of result.conflicts) {
    console.error(`  - ${conflict}`);
  }
  process.exit(1);
}
console.log(`scaffolder result: ${result.status} (${result.files.length} files)`);
