import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const requiredPublicFiles = [
  'README.md', 'CHANGELOG.md', 'LICENSE', 'SECURITY.md',
  'docs/privacy-policy.md', 'docs/support.md', 'docs/chrome-web-store-listing.md',
  'docs/chrome-web-store-pipeline.md', 'docs/release-checklist.md',
  '.github/workflows/ci.yml', '.github/workflows/pages.yml',
  '.github/workflows/chrome-web-store-release.yml',
];

test('repository metadata, public documents, and workflows match the release contract', async () => {
  for (const relative of requiredPublicFiles) assert((await stat(path.join(root, relative))).size > 0, `${relative} is missing or empty`);

  const manifest = JSON.parse(await read('manifest.json'));
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  assert.equal('host_permissions' in manifest, false);
  assert.equal('content_scripts' in manifest, false);
  assert.match(packageJson.scripts.test, /test:site/);

  const ci = await read('.github/workflows/ci.yml');
  assert.match(ci, /actions\/checkout@v6/);
  assert.match(ci, /actions\/setup-node@v6/);
  assert.match(ci, /actions\/upload-artifact@v7/);
  assert.match(ci, /npm test/);

  const pages = await read('.github/workflows/pages.yml');
  assert.match(pages, /actions\/configure-pages@v5/);
  assert.match(pages, /actions\/upload-pages-artifact@v4/);
  assert.match(pages, /actions\/deploy-pages@v4/);

  const release = await read('.github/workflows/chrome-web-store-release.yml');
  assert.match(release, /default: UPLOAD_ONLY/);
  assert.match(release, /google-github-actions\/auth@v3/);
  assert.match(release, /https:\/\/www\.googleapis\.com\/auth\/chromewebstore/);
  assert.match(release, /node scripts\/cws-release\.mjs/);
  assert.match(release, /Create GitHub Release after verified automatic upload/);
  assert.doesNotMatch(release, /chromewebstore\/v1|v1\.1\/items/i);

  const listing = await read('docs/chrome-web-store-listing.md');
  assert.match(listing, /not affiliated with or endorsed by Microsoft/i);
  assert.match(listing, /attachments-report\.csv/);
  const privacy = await read('docs/privacy-policy.md');
  assert.match(privacy, /does not transmit conversation data to the developer/i);
});
