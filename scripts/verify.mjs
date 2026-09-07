#!/usr/bin/env node
/**
 * Preflight check for CampusOrbit. Run `npm run verify` whenever something
 * looks wrong -- it tells you exactly which piece is missing instead of leaving
 * you to decode a stack trace.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
let warn = 0;

const ok = (m) => console.log('  \u2713', m);
const bad = (m, fix) => { fail++; console.log('  \u2717', m); if (fix) console.log('      fix:', fix); };
const meh = (m, fix) => { warn++; console.log('  !', m); if (fix) console.log('      fix:', fix); };

const probe = (port, host = '127.0.0.1') =>
  new Promise((res) => {
    const s = net.createConnection({ port, host });
    const done = (v) => { s.destroy(); res(v); };
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
    s.setTimeout(1200, () => done(false));
  });

console.log('\nCampusOrbit preflight\n');

console.log('Runtime');
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj > 20 || (maj === 20 && min >= 19)) ok(`Node ${process.version}`);
else bad(`Node ${process.version} is too old`, 'install Node 22 LTS from nodejs.org');
if (maj >= 25) meh(`Node ${process.version} is newer than tested`, 'prefer Node 22 LTS if you hit odd install errors');

console.log('\nDependencies');
for (const [name, dir] of [['root', root], ['server', join(root, 'server')], ['client', join(root, 'client')]]) {
  existsSync(join(dir, 'node_modules'))
    ? ok(`${name}/node_modules`)
    : bad(`${name}/node_modules missing`, 'npm run install:all');
}
if (existsSync(join(root, 'client/node_modules/vite'))) ok('vite installed');
else bad('vite missing', 'npm run fix:install');

const rollupDir = join(root, 'client/node_modules/@rollup');
if (existsSync(rollupDir)) {
  const natives = readdirSync(rollupDir).filter((d) => d.startsWith('rollup-'));
  natives.length
    ? ok(`rollup native binary (${natives.join(', ')})`)
    : bad('no @rollup native binary for this platform', 'npm run fix:install');
}

console.log('\nConfiguration');
existsSync(join(root, 'server/.env'))
  ? ok('server/.env')
  : bad('server/.env missing', 'cp server/.env.example server/.env');

console.log('\nServices');
(await probe(27017)) ? ok('MongoDB on 27017') : bad('MongoDB not reachable on 27017', 'start mongod, or: npm run db:up');
(await probe(5000)) ? ok('API on 5000') : meh('API not running on 5000', 'npm run dev');
(await probe(5173)) ? ok('Web on 5173') : meh('Web not running on 5173', 'npm run dev');

console.log(`\n${fail ? `${fail} blocking problem(s)` : 'No blocking problems'}${warn ? `, ${warn} warning(s)` : ''}.\n`);
process.exit(fail ? 1 : 0);
