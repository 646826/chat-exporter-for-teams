import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { copyFileEnsured, copyTree, ensureEmptyDir, walkFiles } from './lib/files.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const bundleSources = [
  'src/shared/errors.js',
  'src/shared/urls.js',
  'src/shared/options.js',
  'src/content/utils.js',
  'src/content/zip.js',
  'src/content/model.js',
  'src/content/attachments.js',
  'src/content/teams-adapter.js',
  'src/content/overlay.js',
  'src/content/capture.js',
  'src/content/renderers.js',
  'src/content/archive.js',
  'src/content/controller.js',
  'src/content/index.js',
];

function stripModuleSyntax(source, filename) {
  let output = source;
  output = output.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;\s*$/gm, '');
  output = output.replace(/^\s*import\s+['"][^'"]+['"]\s*;\s*$/gm, '');
  output = output.replace(/^\s*export\s*\{[^}]*\}\s*;\s*$/gm, '');
  output = output.replace(/\bexport\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/g, '');
  output = output.replace(/\bexport\s+default\s+/g, '');
  if (/^\s*(?:import|export)\b/m.test(output)) throw new Error(`Untransformed module syntax remains in ${filename}`);
  return output.trim();
}

await ensureEmptyDir(dist);
await copyFileEnsured(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
await copyFileEnsured(path.join(root, 'src/background.js'), path.join(dist, 'background.js'));
await copyTree(path.join(root, 'src/shared'), path.join(dist, 'shared'));
await copyTree(path.join(root, 'src/popup'), path.join(dist, 'popup'));
await copyTree(path.join(root, '_locales'), path.join(dist, '_locales'));
await copyTree(path.join(root, 'assets'), path.join(dist, 'assets'));

const chunks = [];
for (const filename of bundleSources) {
  const source = await readFile(path.join(root, filename), 'utf8');
  chunks.push(`\n/* ${filename} */\n${stripModuleSyntax(source, filename)}\n`);
}
const banner = `/*\n * Chat Exporter for Microsoft Teams — Files & ZIP\n * Generated from local ES modules. No remote code.\n * Version: ${JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')).version}\n */`;
const bundle = `${banner}\n(function chatExporterBundle(){\n'use strict';\n${chunks.join('\n')}\n})();\n`;
await writeFile(path.join(dist, 'content.js'), bundle, 'utf8');

const builtFiles = await walkFiles(dist);
console.log(`Built ${builtFiles.length} extension files in dist/.`);
