#!/usr/bin/env node
/**
 * Robust installer for CampusOrbit.
 *
 * Plain `npm install` can fail on a fresh clone for two reasons that have
 * nothing to do with this codebase:
 *
 *  1. npm/cli#4828 — when a package-lock.json generated on one OS is installed
 *     on another, npm can skip the platform-specific optional dependency that
 *     Rollup (and therefore Vite) needs, producing
 *     "Cannot find module @rollup/rollup-win32-x64-msvc".
 *
 *  2. A partially-populated node_modules left behind by an interrupted install.
 *
 * This script installs each package, verifies that the binaries which actually
 * matter are present, and automatically repairs and retries once if they are
 * not. Idempotent and safe to re-run.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(`\nCampusOrbit needs Node >= 20.19. You are on ${process.version}.`);
  console.error('Install Node 22 LTS from https://nodejs.org and try again.\n');
  process.exit(1);
}
if (major >= 25) {
  console.warn(`\nWarning: Node ${process.version} is newer than the tested LTS (20/22).`);
  console.warn('If the install misbehaves, switch to Node 22 LTS.\n');
}

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

/** Verify the packages that break most often are genuinely on disk. */
function verify(pkgDir) {
  const nm = join(pkgDir, 'node_modules');
  if (!existsSync(nm)) return 'node_modules missing';

  if (pkgDir.endsWith('client')) {
    if (!existsSync(join(nm, 'vite'))) return 'vite missing';
    // Rollup needs exactly one native binary matching this platform.
    const scoped = join(nm, '@rollup');
    if (existsSync(scoped)) {
      const natives = readdirSync(scoped).filter((d) => d.startsWith('rollup-'));
      if (natives.length === 0) return 'no @rollup native binary for this platform';
    }
    try {
      execSync('node -e "require.resolve(\'vite\')"', { cwd: pkgDir, stdio: 'pipe' });
    } catch {
      return 'vite cannot be resolved';
    }
  }
  if (pkgDir.endsWith('server') && !existsSync(join(nm, 'express'))) return 'express missing';
  return null;
}

const targets = [
  { dir: root, name: 'root' },
  { dir: join(root, 'server'), name: 'server' },
  { dir: join(root, 'client'), name: 'client' },
];

console.log(`\nCampusOrbit installer — Node ${process.version} on ${process.platform}/${process.arch}\n`);

for (const { dir, name } of targets) {
  console.log(`--- installing ${name} ---`);
  try {
    run('npm install --no-audit --no-fund', dir);
  } catch {
    console.log(`  first attempt failed for ${name}; repairing...`);
  }

  let problem = verify(dir);
  if (problem) {
    console.log(`\n  ${name}: ${problem}`);
    console.log('  This is the known npm optional-dependency bug (npm/cli#4828).');
    console.log('  Removing node_modules + package-lock.json and reinstalling...\n');
    rmSync(join(dir, 'node_modules'), { recursive: true, force: true, maxRetries: 3 });
    rmSync(join(dir, 'package-lock.json'), { force: true, maxRetries: 3 });
    run('npm install --no-audit --no-fund', dir);
    problem = verify(dir);
  }

  if (problem) {
    console.error(`\n${name} is still broken: ${problem}`);
    console.error('Please open an issue with the output above.\n');
    process.exit(1);
  }
  console.log(`  ${name}: ok\n`);
}

console.log('All dependencies installed and verified.\n');
console.log('Next steps:');
console.log('  1. cp server/.env.example server/.env     (defaults work locally)');
console.log('  2. npm run seed                           (demo data)');
console.log('  3. npm run dev                            (API :5000 + web :5173)\n');
