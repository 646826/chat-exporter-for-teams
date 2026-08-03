import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderAttachmentReportCsv, renderChatCsv, renderChatHtml, renderChatJson,
  renderFailedAttachmentsHtml, rewriteHtmlAssetUrls,
} from '../../src/content/renderers.js';

const messages = [{
  id: 'm1', author: 'Ada & Bob', timestamp: '2026-08-02T12:00:00.000Z', text: '<hello>',
  html: '<p>Hello <img src="https://files.example/pic.png"></p>',
  attachments: [{ url: 'https://files.example/pic.png', nameHint: 'pic.png' }],
  links: [{ url: 'https://example.com/?a=1&b=2', text: 'Example' }], reactions: ['Like'],
}];
const records = [{ status: 'downloaded', filename: '001_pic.png', path: 'attachments/001 pic.png', bytes: 2, mimeType: 'image/png', url: 'https://files.example/pic.png', resolvedUrl: 'https://cdn.example/pic.png', error: '', messageIds: ['m1'] }];

test('renders structured JSON and spreadsheet CSV outputs', () => {
  const json = JSON.parse(renderChatJson({ title: 'Test', sourceUrl: 'https://teams.cloud.microsoft/', exportedAt: '2026-08-02T12:00:00Z', messages, attachmentRecords: records }));
  assert.equal(json.format, 'chat-exporter-for-teams/v1');
  assert.equal(json.messageCount, 1);
  assert.equal(json.attachments[0].blob, undefined);
  assert.match(renderChatCsv(messages), /Ada & Bob/);
  assert.match(renderAttachmentReportCsv(records), /attachments\/001 pic\.png/);
});

test('rewrites downloaded asset URLs to relative archive paths', () => {
  const result = rewriteHtmlAssetUrls('<img src="https://files.example/pic.png">', new Map([['https://files.example/pic.png', 'attachments/001 pic.png']]));
  assert.equal(result, '<img src="attachments/001%20pic.png">');
});

test('escapes transcript metadata and links downloaded attachments locally', () => {
  const html = renderChatHtml({ title: '<script>alert(1)</script>', sourceUrl: 'https://teams.cloud.microsoft/?x=<x>', exportedAt: 'now', messages, attachmentRecords: records });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('attachments/001%20pic.png'));
  assert.ok(html.includes('rel="noreferrer noopener"'));
});

test('renders failed attachment links without embedding the error as HTML', () => {
  const html = renderFailedAttachmentsHtml([{ status: 'failed', filename: 'x', url: 'https://example.com/?x=<bad>', error: '<b>no</b>' }]);
  assert.ok(html.includes('&lt;b&gt;no&lt;/b&gt;'));
  assert.ok(!html.includes('<b>no</b>'));
});
