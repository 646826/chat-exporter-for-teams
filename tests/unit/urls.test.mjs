import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archivePathToHref, classifyAttachmentUrl, hostIsSupported, resolveSafeUrl,
  sharePointDownloadCandidates, urlIsSupported,
} from '../../src/shared/urls.js';

test('supports only the two HTTPS Teams hosts', () => {
  assert.equal(hostIsSupported('TEAMS.CLOUD.MICROSOFT.'), true);
  assert.equal(hostIsSupported('teams.microsoft.com'), true);
  assert.equal(hostIsSupported('evilteams.microsoft.com'), false);
  assert.equal(urlIsSupported('https://teams.cloud.microsoft/v2/'), true);
  assert.equal(urlIsSupported('http://teams.cloud.microsoft/'), false);
  assert.equal(urlIsSupported('https://teams.cloud.microsoft.evil.test/'), false);
});

test('resolves only safe URL protocols explicitly allowed by the caller', () => {
  assert.equal(resolveSafeUrl('/file.pdf', 'https://teams.cloud.microsoft/v2/'), 'https://teams.cloud.microsoft/file.pdf');
  assert.equal(resolveSafeUrl('javascript:alert(1)'), '');
  assert.equal(resolveSafeUrl('data:text/plain,ok'), '');
  assert.equal(resolveSafeUrl('data:text/plain,ok', undefined, { allowData: true }), 'data:text/plain,ok');
  assert.equal(resolveSafeUrl('blob:https://teams.cloud.microsoft/id', undefined, { allowBlob: true }), 'blob:https://teams.cloud.microsoft/id');
});

test('classifies SharePoint, OneDrive, media and ordinary links', () => {
  assert.equal(classifyAttachmentUrl('https://tenant.sharepoint.com/x.docx'), 'attachment');
  assert.equal(classifyAttachmentUrl('https://1drv.ms/u/s!abc'), 'attachment');
  assert.equal(classifyAttachmentUrl('https://example.com/archive.zip'), 'attachment');
  assert.equal(classifyAttachmentUrl('https://example.com/news'), 'link');
  assert.equal(classifyAttachmentUrl('mailto:user@example.com'), 'ignore');
  assert.equal(classifyAttachmentUrl('https://example.com/no-extension', { isMedia: true }), 'attachment');
});

test('creates unique SharePoint download candidates without losing the original', () => {
  const original = 'https://tenant.sharepoint.com/:w:/r/sites/a/file.docx?web=1';
  const candidates = sharePointDownloadCandidates(original);
  assert.equal(candidates[0], original);
  assert.equal(new Set(candidates).size, candidates.length);
  assert.ok(candidates.some((value) => value.includes('action=download')));
  assert.ok(candidates.some((value) => value.includes('download=1')));
  assert.deepEqual(sharePointDownloadCandidates('https://example.com/file.pdf'), ['https://example.com/file.pdf']);
});

test('encodes archive paths segment by segment', () => {
  assert.equal(archivePathToHref('attachments/001 résumé.pdf'), 'attachments/001%20r%C3%A9sum%C3%A9.pdf');
});
