import { fetchAttachmentCandidate, downloadAttachments } from '../../src/content/attachments.js';
import { createProgressOverlay } from '../../src/content/overlay.js';
import {
  collectMessageUrls, extractMessageElement, findMessageNodes, findScrollContainer, sanitizeMessageHtml,
} from '../../src/content/teams-adapter.js';
import { createPopupView } from '../../src/popup/view.js';

async function runBrowserFixtures() {
const output = document.getElementById('test-output');
const assertions = [];
function assert(value, message) {
  if (!value) throw new Error(message);
  assertions.push(message);
}

try {
  const probe = document.createElement('div');
  const probeShadow = probe.attachShadow({ mode: 'open' });
  let trustedTypesBlocked = false;
  try { probeShadow.innerHTML = '<b>blocked</b>'; } catch { trustedTypesBlocked = true; }
  assert(trustedTypesBlocked, 'fixture enforces Trusted Types HTML assignments');

  const overlay = createProgressOverlay(() => {}, { overlayTitle: 'Fixture Exporter' }, document);
  assert(overlay.host.shadowRoot.querySelector('.panel'), 'overlay builds under Trusted Types enforcement');
  assert(overlay.host.shadowRoot.textContent.includes('Fixture Exporter'), 'overlay uses localized title');
  overlay.update({ messages: 2, attachments: 1, bytes: 2048, progress: 0.5 });
  assert(overlay.host.shadowRoot.querySelector('[data-value="messages"]').textContent === '2', 'overlay updates message count');
  assert(overlay.host.shadowRoot.querySelector('.bar').getAttribute('aria-valuenow') === '50', 'overlay exposes determinate progress');
  overlay.close();

  const strings = new Proxy({}, { get: (_target, key) => String(key) });
  const popup = createPopupView(document, strings, { root: document.getElementById('app'), iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' });
  popup.showLoading();
  assert(document.querySelector('.spinner'), 'popup exposes a visible loading spinner');
  popup.showSupported('Ada & Grace');
  assert(!popup.elements.primaryButton.classList.contains('hidden'), 'popup exposes the export action for a detected chat');
  assert(popup.elements.includeAttachments.closest('label') && !popup.elements.includeAttachments.closest('label').classList.contains('hidden'), 'popup exposes the attachment choice');

  const nodes = findMessageNodes(document);
  assert(nodes.length === 2, 'adapter finds two distinct Teams messages');
  const first = extractMessageElement(nodes[0], 0);
  const second = extractMessageElement(nodes[1], 1);
  assert(first.id === '1700000000000', 'adapter reads message ID');
  assert(first.author === 'Ada Lovelace', 'adapter reads direct author');
  assert(first.timestamp === '2026-08-02T12:00:00.000Z', 'adapter reads timestamp');
  assert(first.reactions.includes('Like reaction'), 'adapter reads reactions');
  assert(first.links.some((link) => link.url.startsWith('https://example.com/docs')), 'adapter keeps ordinary links');
  assert(first.attachments.some((item) => item.kind === 'image'), 'adapter detects a real image attachment');
  assert(second.author === 'Grace Hopper', 'adapter inherits grouped author');
  assert(second.attachments.some((item) => item.url.includes('sharepoint.com')), 'adapter detects SharePoint files');

  const sanitized = sanitizeMessageHtml(nodes[0].querySelector('[data-tid="message-content"]'));
  assert(!sanitized.includes('<script'), 'sanitizer removes active content');
  assert(!sanitized.includes('onclick='), 'sanitizer removes event handlers');
  assert(!sanitized.includes('style='), 'sanitizer removes inline style');
  assert(!sanitized.includes('javascript:'), 'sanitizer removes unsafe URLs');
  assert(sanitized.includes('rel="noreferrer noopener"'), 'sanitizer hardens external links');

  assert(findScrollContainer(document) === document.getElementById('fixture-scroller'), 'adapter selects the message scroller');
  assert(window.__CHAT_EXPORTER_FOR_TEAMS__ && window.__CHAT_EXPORTER_FOR_TEAMS__.version === '0.2.2', 'built content bundle installs its idempotent global API');

  const message = document.createElement('div');
  message.setAttribute('data-tid', 'chat-pane-message');
  const body = document.createElement('div'); body.setAttribute('role', 'document'); message.appendChild(body);
  function addLink(parent, url, label) { const a = document.createElement('a'); a.href = url; a.textContent = label; parent.appendChild(a); return a; }
  addLink(body, 'https://example.test/games/bloom', 'Url Preview for Bloom');
  addLink(body, 'https://example.test/iframe.html#room=ROOM', 'Link Shared');
  const preview = document.createElement('div'); preview.setAttribute('data-tid','url-preview'); body.appendChild(preview);
  addLink(preview, 'https://example.test/other-game', 'Play online');
  const file = document.createElement('div'); file.setAttribute('data-tid','file-card'); body.appendChild(file);
  addLink(file,'https://example.test/download','report');
  const download = addLink(body,'https://example.test/saved.html','Saved HTML'); download.setAttribute('download','');
  const urls = collectMessageUrls(message,body);
  assert(urls.links.length === 3, 'role=document and URL previews do not turn website links into files');
  assert(urls.attachments.length === 2, 'explicit file cards and empty download attributes remain attachments');
  const summaryOverlay = createProgressOverlay(()=>{}, {}, document);
  summaryOverlay.setDownload(new Blob(['zip']), 'test.zip', false, {downloaded:2,failed:1,skipped:0});
  assert(summaryOverlay.host.shadowRoot.querySelector('.phase').textContent === 'Archive ready — files missing', 'incomplete archive is explicitly labeled');
  assert(summaryOverlay.host.shadowRoot.querySelector('.status').textContent.includes('1 failed'), 'completion reports missing-file counts');
  summaryOverlay.close();

  const browserConfig = { attachmentTimeoutMs: 5000, attachmentRetries: 0, attachmentConcurrency: 1, maxSingleAttachmentBytes: 1000, maxTotalAttachmentBytes: 1000, includeAttachments: true };
  const binaryUrl = URL.createObjectURL(new Blob([new Uint8Array([0, 255, 1, 128, 64])], { type: 'application/octet-stream' }));
  const emptyUrl = URL.createObjectURL(new Blob([], { type: 'application/octet-stream' }));
  try {
    const loaded = await fetchAttachmentCandidate({ url: binaryUrl, nameHint: 'binary.bin' }, null, browserConfig);
    assert(Array.from(new Uint8Array(await loaded.blob.arrayBuffer())).join(',') === '0,255,1,128,64', 'real browser Blob fetch preserves all binary bytes');
    const empty = await fetchAttachmentCandidate({ url: emptyUrl, nameHint: 'empty.bin' }, null, browserConfig);
    assert(empty.blob.size === 0, 'real browser preserves zero-byte attachments');
    const data = await fetchAttachmentCandidate({ url: 'data:text/plain;base64,aGVsbG8=', nameHint: 'hello.txt' }, null, browserConfig);
    assert(await data.blob.text() === 'hello', 'real browser decodes data attachments');
    const controller = new AbortController();
    controller.abort(new Error('browser cancellation'));
    let cancelled = false;
    try { await fetchAttachmentCandidate({ url: binaryUrl }, controller.signal, browserConfig); } catch (error) { cancelled = error === controller.signal.reason; }
    assert(cancelled, 'browser cancellation preserves the original reason');
  } finally { URL.revokeObjectURL(binaryUrl); URL.revokeObjectURL(emptyUrl); }

  output.dataset.testStatus = 'pass';
  output.textContent = `PASS ${assertions.length}`;
} catch (error) {
  output.dataset.testStatus = 'fail';
  output.textContent = `FAIL ${error && error.stack || error}`;
  document.documentElement.dataset.testFailure = String(error && error.message || error);
}

}
runBrowserFixtures();
