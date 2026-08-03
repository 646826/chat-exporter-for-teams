import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseZipFile } from '../scripts/lib/zip.mjs';

const root = process.cwd();
function runBuild() {
  const result = spawnSync(process.execPath, ['scripts/build-zip.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

test('store package is deterministic and contains runtime files only', async () => {
  runBuild();
  const first = await readFile(path.join(root, 'chat-exporter-for-teams.zip'));
  runBuild();
  const second = await readFile(path.join(root, 'chat-exporter-for-teams.zip'));
  assert.equal(sha256(first), sha256(second));
  assert.deepEqual(first, second);
  const entries = await parseZipFile(path.join(root, 'chat-exporter-for-teams.zip'));
  assert.ok(entries.some((entry) => entry.name === 'manifest.json'));
  assert.ok(entries.some((entry) => entry.name === 'content.js'));
  assert.ok(entries.some((entry) => entry.name === 'assets/icon128.png'));
  assert.ok(entries.every((entry) => !/(?:^|\/)(?:tests?|docs?|scripts?|store-assets)(?:\/|$)/.test(entry.name)));
});
