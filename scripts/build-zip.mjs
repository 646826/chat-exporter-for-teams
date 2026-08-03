import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildZipBlob } from '../src/content/zip.js';
import { walkFiles } from './lib/files.mjs';

const root = process.cwd();
await import('./build.mjs');
const dist = path.join(root, 'dist');
const output = path.join(root, 'chat-exporter-for-teams.zip');
const date = new Date('1980-01-01T00:00:00.000Z');
const files = [];
for (const relativePath of await walkFiles(dist)) {
  files.push({ name: relativePath, data: await readFile(path.join(dist, relativePath)), date });
}
const zip = await buildZipBlob(files, { defaultDate: date });
await writeFile(output, new Uint8Array(await zip.arrayBuffer()));
console.log(`Created deterministic package ${path.basename(output)} (${zip.size} bytes, ${files.length} files).`);
