import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateAttachments, downloadAttachments, inferExtensionFromMime, isLikelyAttachmentCandidate,
  parseContentDispositionFilename, uniqueAttachmentFilename,
} from '../../src/content/attachments.js';

test('rejects avatar-like images but keeps real media and file cards', () => {
  assert.equal(isLikelyAttachmentCandidate({ url: 'https://example.com/avatar.png', kind: 'image', width: 32, height: 32, className: 'persona avatar' }), false);
  assert.equal(isLikelyAttachmentCandidate({ url: 'https://example.com/photo.png', kind: 'image', width: 900, height: 600, isMedia: true }), true);
  assert.equal(isLikelyAttachmentCandidate({ url: 'https://example.com/download', kind: 'link', isFileCard: true }), true);
});

test('aggregates duplicate candidates and message references', () => {
  const result = aggregateAttachments([
    { id: 'm1', attachments: [{ url: 'https://a/file', nameHint: 'file' }] },
    { id: 'm2', attachments: [{ url: 'https://a/file', nameHint: 'report.pdf', isFileCard: true }] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].nameHint, 'report.pdf');
  assert.deepEqual(result[0].messageIds, ['m1', 'm2']);
  assert.equal(result[0].isFileCard, true);
});

test('parses content-disposition and generates stable unique names', () => {
  assert.equal(parseContentDispositionFilename("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf"), 'résumé.pdf');
  assert.equal(inferExtensionFromMime('application/pdf; charset=binary'), '.pdf');
  const used = new Set();
  assert.equal(uniqueAttachmentFilename('report', 'application/pdf', 1, used), '001_report.pdf');
  assert.equal(uniqueAttachmentFilename('report', 'application/pdf', 1, used), '001_report_2.pdf');
});

test('reports every attachment as skipped when file download is disabled', async () => {
  const updates = [];
  const overlay = {
    text(key, values = {}) { return `${key}:${JSON.stringify(values)}`; },
    update(value) { updates.push(value); },
    log() {},
  };
  const result = await downloadAttachments(
    [{ url: 'https://example.com/a.pdf', nameHint: 'a.pdf', messageIds: ['m1'] }, { url: 'https://example.com/b.docx', nameHint: 'b.docx', messageIds: ['m2'] }],
    new Map(), overlay, new AbortController().signal,
    { includeAttachments: false, attachmentConcurrency: 2, attachmentTimeoutMs: 5000, maxSingleAttachmentBytes: 100_000_000, maxTotalAttachmentBytes: 100_000_000 },
  );
  assert.equal(result.records.length, 2);
  assert.ok(result.records.every((record) => record.status === 'skipped'));
  assert.ok(result.records.every((record) => /disabled/i.test(record.error)));
  assert.equal(updates.at(-1).progress, 1);
});
