import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asBlob, csvEscape, formatTemplate, sanitizeFilename, sanitizeZipPath, toCsv,
} from '../../src/content/utils.js';

test('sanitizes filenames for Windows, Unicode and length limits', () => {
  assert.equal(sanitizeFilename('  report<>:"/\\|?*.pdf  '), 'report_________.pdf');
  assert.equal(sanitizeFilename('CON.txt'), '_CON.txt');
  assert.equal(sanitizeFilename('...'), 'file');
  assert.equal(sanitizeFilename('ＡＢＣ.txt'), 'ABC.txt');
  const long = sanitizeFilename(`${'a'.repeat(300)}.docx`, 'file', 40);
  assert.equal(long.length, 40);
  assert.ok(long.endsWith('.docx'));
});

test('sanitizes ZIP paths without traversal', () => {
  assert.equal(sanitizeZipPath('../attachments/../../secret?.txt'), 'attachments/secret_.txt');
  assert.equal(sanitizeZipPath('\\folder\\file.txt'), 'folder/file.txt');
});

test('escapes CSV fields and emits a UTF-8 BOM', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,"b"\n'), '"a,""b""\n"');
  const csv = toCsv([{ value: 'one\ntwo' }], [{ key: 'value', label: 'Value' }]);
  assert.ok(csv.startsWith('\ufeffValue\r\n'));
  assert.ok(csv.includes('"one\ntwo"'));
});

test('formats named placeholders and leaves unknown placeholders visible', () => {
  assert.equal(formatTemplate('{count} files: {name} {missing}', { count: 2, name: 'x' }), '2 files: x {missing}');
});

test('converts supported payloads to Blob', async () => {
  assert.equal(await asBlob('hello', 'text/plain').text(), 'hello');
  assert.deepEqual(new Uint8Array(await asBlob(new Uint8Array([1, 2, 3])).arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.throws(() => asBlob({ nope: true }), /ZIP entry data/);
});
