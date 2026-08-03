import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { crc32Bytes } from '../src/content/zip.js';
import { fileExists, readJson, walkFiles } from './lib/files.mjs';
import { parseZipFile } from './lib/zip.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const zipPath = path.join(root, 'chat-exporter-for-teams.zip');
const manifest = await readJson(path.join(dist, 'manifest.json'));
const packageJson = await readJson(path.join(root, 'package.json'));
const expectedPermissions = ['activeTab', 'scripting', 'storage'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.manifest_version === 3, 'manifest_version must be 3.');
assert(manifest.version === packageJson.version, 'manifest.json and package.json versions must match.');
assert(JSON.stringify(manifest.permissions) === JSON.stringify(expectedPermissions), `permissions must be exactly ${expectedPermissions.join(', ')}.`);
assert(!Object.hasOwn(manifest, 'host_permissions'), 'host_permissions are prohibited.');
assert(!Object.hasOwn(manifest, 'optional_host_permissions'), 'optional_host_permissions are prohibited for v0.1.0.');
assert(!Object.hasOwn(manifest, 'content_scripts'), 'static content_scripts are prohibited.');
assert(manifest.background && manifest.background.service_worker === 'background.js' && manifest.background.type === 'module', 'A module service worker is required.');
assert(manifest.action && manifest.action.default_popup === 'popup/popup.html', 'The toolbar popup is missing.');

const requiredPaths = new Set([
  'manifest.json', 'background.js', 'content.js',
  'popup/popup.html', 'popup/popup.css', 'popup/popup.js', 'popup/view.js',
  'shared/errors.js', 'shared/i18n.js', 'shared/messages.js', 'shared/options.js', 'shared/urls.js',
  'assets/icon16.png', 'assets/icon32.png', 'assets/icon48.png', 'assets/icon128.png',
]);
for (const locale of ['en', 'ru', 'uk', 'es_419', 'pt_BR', 'de', 'fr', 'pl']) requiredPaths.add(`_locales/${locale}/messages.json`);
const distFiles = await walkFiles(dist);
for (const required of requiredPaths) assert(distFiles.includes(required), `Missing runtime file: ${required}`);
assert(distFiles.every((file) => requiredPaths.has(file)), `Unexpected runtime files: ${distFiles.filter((file) => !requiredPaths.has(file)).join(', ')}`);

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action.default_icon || {}),
];
for (const relative of referencedFiles) assert(await fileExists(path.join(dist, relative)), `Manifest references a missing file: ${relative}`);

const en = await readJson(path.join(dist, '_locales/en/messages.json'));
const localeKeys = Object.keys(en).sort();
for (const locale of ['en', 'ru', 'uk', 'es_419', 'pt_BR', 'de', 'fr', 'pl']) {
  const messages = await readJson(path.join(dist, `_locales/${locale}/messages.json`));
  assert(JSON.stringify(Object.keys(messages).sort()) === JSON.stringify(localeKeys), `${locale} locale keys do not match English.`);
  for (const [key, entry] of Object.entries(messages)) assert(entry && typeof entry.message === 'string' && entry.message.trim(), `${locale}.${key} must contain a non-empty message.`);
  assert(messages.extensionName.message.length <= 75, `${locale} extension name exceeds 75 characters.`);
  assert(messages.extensionShortName.message.length <= 18, `${locale} short name is unexpectedly long.`);
  assert(messages.extensionDescription.message.length <= 132, `${locale} description exceeds 132 characters.`);
}

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  assert(buffer.subarray(0, 8).toString('hex') === signature, 'Invalid PNG signature.');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
for (const size of [16, 32, 48, 128]) {
  const dimensions = pngDimensions(await readFile(path.join(dist, `assets/icon${size}.png`)));
  assert(dimensions.width === size && dimensions.height === size, `icon${size}.png must be ${size}×${size}.`);
}

const runtimeTextFiles = distFiles.filter((file) => /\.(?:js|html|css|json)$/.test(file));
for (const relative of runtimeTextFiles) {
  const source = await readFile(path.join(dist, relative), 'utf8');
  assert(!/(?:\.innerHTML|\.outerHTML)\s*=/.test(source), `${relative} assigns to an HTML string sink.`);
  assert(!/\.insertAdjacentHTML\s*\(/.test(source), `${relative} calls insertAdjacentHTML.`);
  assert(!/\bdocument\.write(?:ln)?\s*\(/.test(source), `${relative} calls document.write.`);
  assert(!/\beval\s*\(/.test(source), `${relative} calls eval.`);
  assert(!/\bnew\s+Function\s*\(/.test(source), `${relative} constructs dynamic code.`);
  assert(!/<script[^>]+src\s*=\s*["']https?:/i.test(source), `${relative} references a remote script.`);
  assert(!/sourceMappingURL=/.test(source), `${relative} contains a source map reference.`);
}
assert(!distFiles.some((file) => /(?:^|\/)(?:tests?|docs?|scripts?|store-assets|assets-src)(?:\/|$)/i.test(file)), 'Store package includes development-only files.');
assert(!distFiles.some((file) => /\.(?:map|md|pem|key|env)$/i.test(file)), 'Store package includes a prohibited file type.');

assert(await fileExists(zipPath), 'chat-exporter-for-teams.zip does not exist. Run npm run build:zip first.');
const entries = await parseZipFile(zipPath);
assert(JSON.stringify(entries.map((entry) => entry.name)) === JSON.stringify(distFiles), 'ZIP entries do not exactly match sorted dist files.');
for (const entry of entries) {
  assert(entry.method === 0, `${entry.name} is not stored with the deterministic store method.`);
  assert(entry.uncompressedSize === entry.data.length, `${entry.name} has an invalid size.`);
  assert(crc32Bytes(entry.data) === entry.crc32, `${entry.name} failed CRC validation.`);
}

const storeAssets = [
  ['store-assets/store-icon-128.png', 128, 128],
  ['store-assets/small-promo-440x280.png', 440, 280],
  ['store-assets/marquee-1400x560.png', 1400, 560],
  ...[1, 2, 3, 4, 5].map((number) => [`store-assets/screenshots/en/0${number}-${['export-one-zip', 'long-chat-progress', 'messages-and-files', 'html-json-csv', 'local-processing'][number - 1]}.png`, 1280, 800]),
  ['store-assets/screenshots/ru/01-export-one-zip.png', 1280, 800],
  ['store-assets/screenshots/ru/02-long-chat-progress.png', 1280, 800],
];
for (const [relative, width, height] of storeAssets) {
  assert(await fileExists(path.join(root, relative)), `Missing store asset: ${relative}`);
  const dimensions = pngDimensions(await readFile(path.join(root, relative)));
  assert(dimensions.width === width && dimensions.height === height, `${relative} must be ${width}×${height}.`);
}

const zipSize = (await stat(zipPath)).size;
console.log(`Package validation passed: ${distFiles.length} runtime files, ${entries.length} ZIP entries, ${zipSize} bytes.`);
