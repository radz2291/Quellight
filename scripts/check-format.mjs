#!/usr/bin/env node
// Deterministic format check: prettier --check over repository sources.
// Fails with the file list on any drift; never rewrites files.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const mainEntry = require.resolve('prettier');
const prettierBin = join(dirname(mainEntry), 'bin', 'prettier.cjs');
if (!existsSync(prettierBin)) {
  console.error('format check could not locate the prettier CLI.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [prettierBin, '--check', '.'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
