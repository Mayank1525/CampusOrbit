#!/usr/bin/env node
/**
 * Cross-platform dependency repair for CampusOrbit.
 *
 * Fixes the npm optional-dependency bug (npm/cli#4828), whose usual symptom on
 * Windows is:
 *
 *   Error: Cannot find module @rollup/rollup-win32-x64-msvc
 *
 * Why it happens
 * --------------
 * Rollup (used by Vite) ships its native binary as a separate per-platform
 * optional dependency: ...-win32-x64-msvc on Windows, ...-linux-x64-gnu on
 * Linux, ...-darwin-arm64 on Apple silicon. When a package-lock.json produced
 * on one OS is installed on another, npm sometimes skips the optional package
 * that the new platform actually needs, and Vite cannot start.
 *
 * The reliable cure is to delete node_modules AND the lockfile, then let npm
 * resolve fresh for the current platform. This script does that for the root,
 * server and client packages, then reinstalls.
 *
 * Usage:  npm run fix:install
 */
import { rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [root, join(root, 'server'), join(root, 'client')];

console.log('\nCampusOrbit — repairing dependencies for ' + process.platform + '/' + process.arch + '\n');

for (const dir of targets) {
  const name = dir === root ? 'root' : dir.split(/[\\/]/).pop();
  for (const artifact of ['node_modules', 'package-lock.json']) {
    const target = join(dir, artifact);
    if (existsSync(target)) {
      process.stdout.write(`  removing ${name}/${artifact} ... `);
      rmSync(target, { recursive: true, force: true, maxRetries: 3 });
      console.log('done');
    }
  }
}

console.log('\nReinstalling (this can take a few minutes)...\n');

for (const dir of targets) {
  const name = dir === root ? 'root' : dir.split(/[\\/]/).pop();
  console.log(`--- npm install (${name}) ---`);
  execSync('npm install --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
}

console.log('\nDependencies repaired. Start the app with:  npm run dev\n');
