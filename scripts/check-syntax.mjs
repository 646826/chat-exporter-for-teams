import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { walkFiles } from './lib/files.mjs';

const root = process.cwd();
const targets = [];
for (const directory of ['src', 'scripts', 'tests']) {
  try {
    for (const relative of await walkFiles(path.join(root, directory))) {
      if (/\.(?:js|mjs)$/.test(relative)) targets.push(path.join(directory, relative));
    }
  } catch {
    // A directory can be absent during initial scaffolding.
  }
}

const forbiddenControlBytes = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
for (const target of targets.sort()) {
  const source = await readFile(path.join(root, target), 'utf8');
  if (forbiddenControlBytes.test(source)) throw new Error(`Forbidden control byte found in ${target}`);
  const result = spawnSync(process.execPath, ['--check', target], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
}
console.log(`Syntax and control-byte checks passed for ${targets.length} JavaScript files.`);
