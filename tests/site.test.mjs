import assert from 'node:assert/strict';
import { readFile, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const output = path.join(root, 'site-dist');

const routes = [
  'index.html',
  'privacy/index.html',
  'support/index.html',
  'how-to-export-microsoft-teams-chat-with-attachments/index.html',
  'download-teams-chat-history-without-admin/index.html',
  'teams-chat-export-html-json-csv-zip/index.html',
];

test('build-site creates a complete SEO site with faithful product assets', async () => {
  await rm(output, { recursive: true, force: true });
  const result = spawnSync(process.execPath, ['scripts/build-site.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const route of routes) {
    const html = await readFile(path.join(output, route), 'utf8');
    assert.match(html, /<title>[^<]+<\/title>/i, `${route} lacks a title`);
    assert.match(html, /<meta name="description" content="[^"]+">/i, `${route} lacks a description`);
    assert.match(html, /<link rel="canonical" href="https:\/\/646826\.github\.io\/chat-exporter-for-teams\//i, `${route} lacks a canonical URL`);
    assert.match(html, /Chat Exporter/i, `${route} lacks product identity`);
    assert.doesNotMatch(html, /aggregateRating|localhost|127\.0\.0\.1/i, `${route} contains prohibited placeholder or fake rating data`);
  }

  const home = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(home, /"@type":"SoftwareApplication"/);
  assert.match(home, /Export Microsoft Teams chat history with attachments/i);
  assert.match(home, /No telemetry/i);

  const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
  for (const route of routes) {
    const suffix = route === 'index.html' ? '' : route.replace(/index\.html$/, '');
    assert(sitemap.includes(`https://646826.github.io/chat-exporter-for-teams/${suffix}`));
  }

  for (const asset of [
    'assets/site.css',
    'assets/icon128.png',
    'assets/screenshot-export.png',
    'assets/screenshot-progress.png',
    'assets/screenshot-files.png',
  ]) {
    const metadata = await stat(path.join(output, asset));
    assert(metadata.size > 0, `${asset} is empty`);
  }
});
