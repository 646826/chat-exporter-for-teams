import test from 'node:test';
import assert from 'node:assert/strict';
import * as renderers from '../../src/content/renderers.js';
import { buildArchive } from '../../src/content/archive.js';
function fixture() {
  return { title: 'Обсуждение проекта', sourceUrl: 'https://teams.microsoft.com/chat?id=1', exportedAt: '2026-09-05T12:00:00Z',
    messages: [{ id: 'm1', author: 'Alice', timestamp: '2026-09-05T10:00:00Z', text: 'Привет\n  indented\n\nNext paragraph', attachments: [], links: [], reactions: ['Like 1'] },
      { id: 'm2', author: 'Bob', text: 'Reply', attachments: [], links: [], reactions: [] }], attachmentRecords: [] };
}
function render(data = fixture()) { assert.equal(typeof renderers.renderChatMarkdown, 'function'); return renderers.renderChatMarkdown(data); }
test('Markdown contains ordered authors, timestamps, source and literal multiline text', () => {
  const data = fixture(), output = render(data);
  assert.match(output, /^# Обсуждение проекта\n/);
  assert.ok(output.includes(data.messages[0].text));
  assert.ok(output.indexOf('Alice') < output.indexOf('Bob'));
  assert.ok(output.includes(data.messages[0].timestamp));
  assert.ok(output.includes(data.sourceUrl));
  assert.ok(output.includes('Like 1'));
});
test('message code fences and HTML remain literal within a longer fence', () => {
  const data = fixture(); data.messages[0].text = '```js\n<script>alert(1)</script>\n```\n````\nend';
  const output = render(data);
  assert.ok(output.includes('`````text\n' + data.messages[0].text + '\n`````'));
});
test('downloaded attachments point to encoded local paths with explicit status', () => {
  const data = fixture(); data.messages[0].attachments = [{ url: 'https://example.test/file', nameHint: 'Report [final]' }];
  data.attachmentRecords = [{ url: 'https://example.test/file', status: 'downloaded', path: 'attachments/001_file #1.txt', filename: 'file #1.txt' }];
  const output = render(data);
  assert.ok(output.includes('attachments/001_file%20%231.txt')); assert.ok(output.includes('downloaded'));
  assert.ok(!output.includes('](<https://example.test/file>)'));
});
test('failed and skipped attachments retain status, reason and original safe link', () => {
  const data = fixture();
  data.messages[0].attachments = [{ url: 'https://example.test/a', nameHint: 'File' }];
  for (const status of ['failed', 'skipped']) {
    data.attachmentRecords = [{ url: 'https://example.test/a', status, error: 'Permission denied' }];
    const output = render(data); assert.ok(output.includes(status)); assert.ok(output.includes('Permission denied')); assert.ok(output.includes('https://example.test/a'));
  }
});
test('unsafe link schemes are not emitted as clickable Markdown destinations', () => {
  const data = fixture(); data.sourceUrl = 'javascript:alert(1)';
  data.messages[0].links = [{ url: 'javascript:alert(2)', text: 'Bad' }, { url: 'https://example.test/path?q=(a)', text: 'Good [link]' }];
  const output = render(data);
  assert.ok(!output.includes('](<javascript:'));
  assert.ok(output.includes('](<https://example.test/path?q=(a)>)'));
  assert.ok(output.includes('Good \\[link\\]'));
});
test('metadata cannot introduce headings or executable HTML', () => {
  const data = fixture(); data.title = '<script>x</script>\n# forged'; data.messages[0].author = 'Name\n## forged';
  const output = render(data);
  assert.ok(!output.includes('<script>')); assert.ok(!output.includes('\n# forged')); assert.ok(!output.includes('\n## forged'));
});
test('empty and attachment-only messages are represented without inventing text', () => {
  assert.match(render({}), /No messages were captured/);
  const data = fixture(); data.messages[0].text = ''; data.messages[0].attachments = [{ url: 'https://example.test/a', nameHint: 'Only file' }];
  const output = render(data); assert.ok(output.includes('[No text]')); assert.ok(output.includes('Only file'));
});
test('rendering leaves structured data and message order unchanged', () => {
  const data = fixture(), before = JSON.stringify(data); render(data);
  assert.equal(JSON.stringify(data), before);
  assert.equal(JSON.parse(renderers.renderChatJson(data)).format, 'chat-exporter-for-teams/v1');
});
function storedEntries(buffer) {
  const entries = new Map(); let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extra;
    entries.set(name, buffer.subarray(start, start + size)); offset = start + size;
  }
  return entries;
}
test('the real ZIP includes chat.md alongside every previous transcript and attachment', async () => {
  const data = fixture(); data.attachmentRecords = [{ status: 'downloaded', url: 'https://example.test/file', path: 'attachments/file.txt', blob: new Blob(['attachment bytes']), mimeType: 'text/plain' }];
  const archive = await buildArchive({ ...data, extensionVersion: 'test', overlay: { text: (key) => key, update() {} } });
  const entries = storedEntries(Buffer.from(await archive.arrayBuffer()));
  assert.deepEqual([...entries.keys()].sort(), ['chat.html', 'chat.md', 'chat.json', 'chat.csv', 'links.csv', 'attachments-report.csv', 'failed-attachments.html', 'README.txt', 'attachments/file.txt'].sort());
  assert.equal(entries.get('chat.md').toString('utf8'), render(data));
  assert.equal(entries.get('attachments/file.txt').toString(), 'attachment bytes');
  assert.ok(entries.get('README.txt').toString().includes('chat.md'));
});
