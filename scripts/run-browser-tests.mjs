import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

await import(pathToFileURL(path.join(process.cwd(), 'scripts/build.mjs')).href + `?run=${Date.now()}`);

const root = process.cwd();
const browserSources = [
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
  'src/popup/view.js',
  'tests/browser/fixture.test.js',
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

const chunks = [];
for (const filename of browserSources) chunks.push(`\n/* ${filename} */\n${stripModuleSyntax(await readFile(path.join(root, filename), 'utf8'), filename)}\n`);
const fixtureBundle = `(function browserFixture(){\n'use strict';\n${chunks.join('\n')}\n})();\n`;
await writeFile(path.join(root, 'dist/browser-fixture.js'), fixtureBundle, 'utf8');
const fixtureHtml = (await readFile(path.join(root, 'tests/browser/fixture.html'), 'utf8'))
  .replace(
    '<script nonce="browser-fixture" src="../../dist/browser-fixture.js"></script>',
    `<script nonce="browser-fixture">${fixtureBundle.replace(/<\/script/gi, '<\\/script')}</script>`,
  );

const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'chat-exporter-chromium-'));
const chromium = process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium';
const args = [
  '-a', chromium, '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking',
  '--disable-component-update', '--disable-default-apps', '--disable-sync', '--mute-audio', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, 'about:blank',
];
const child = spawn('xvfb-run', args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
let chromiumLog = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => { chromiumLog += chunk; });

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForDevToolsPort() {
  const filePath = path.join(userDataDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port, browserPath] = (await readFile(filePath, 'utf8')).trim().split(/\r?\n/);
      if (port && browserPath) return { port: Number(port), browserPath };
    } catch {
      // Chromium has not created the file yet.
    }
    await delay(100);
  }
  throw new Error(`Chromium did not expose a DevTools port.\n${chromiumLog.slice(-4000)}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error(`Could not connect to ${webSocketUrl}`)), { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
    else resolve(message.result || {});
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId;
      nextId += 1;
      const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() { socket.close(); },
  };
}

async function waitForFixture(client) {
  let last = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await client.send('Runtime.evaluate', {
      expression: `(() => { const node = document.getElementById('test-output'); return {href: location.href, status: node && node.dataset.testStatus, text: node && node.textContent, failure: document.documentElement.dataset.testFailure || '', body: document.body && document.body.innerText}; })()`,
      returnByValue: true,
    });
    last = response.result && response.result.value;
    if (last && last.status && last.status !== 'running') return last;
    await delay(100);
  }
  throw new Error(`Browser fixture did not finish within 10 seconds. Last state: ${JSON.stringify(last)}\n${chromiumLog.slice(-4000)}`);
}

let pageClient;
let browserClient;
try {
  const { port, browserPath } = await waitForDevToolsPort();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) throw new Error('No Chromium page target was found.');
  pageClient = createCdpClient(page.webSocketDebuggerUrl);
  browserClient = createCdpClient(`ws://127.0.0.1:${port}${browserPath}`);
  await pageClient.send('Runtime.enable');
  await pageClient.send('Page.enable');
  const frameTree = await pageClient.send('Page.getFrameTree');
  const frameId = frameTree.frameTree && frameTree.frameTree.frame && frameTree.frameTree.frame.id;
  if (!frameId) throw new Error('Chromium did not expose the main frame.');
  await pageClient.send('Page.setDocumentContent', { frameId, html: fixtureHtml });
  const result = await waitForFixture(pageClient);
  if (result.status !== 'pass') throw new Error(`${result.failure || result.text}\n${chromiumLog.slice(-4000)}`);
  const count = String(result.text || '').match(/PASS\s+(\d+)/)?.[1] || '?';
  console.log(`Chromium Trusted Types and Teams DOM fixture passed (${count} assertions).`);
  await browserClient.send('Browser.close');
} finally {
  try { pageClient?.close(); } catch {}
  try { browserClient?.close(); } catch {}
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await delay(150);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
