import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildZipBlob, crc32Bytes } from '../../src/content/zip.js';
import { parseZipBuffer } from '../../scripts/lib/zip.mjs';

test('computes the standard CRC-32 check vector', () => {
  assert.equal(crc32Bytes(new TextEncoder().encode('123456789')).toString(16), 'cbf43926');
});

test('builds a readable UTF-8 store-only ZIP', async () => {
  const blob = await buildZipBlob([
    { name: 'chat.html', data: '<h1>Hello</h1>', date: new Date('2026-08-02T12:00:00Z') },
    { name: 'attachments/résumé.txt', data: 'ok', date: new Date('2026-08-02T12:00:00Z') },
  ]);
  const entries = parseZipBuffer(await blob.arrayBuffer());
  assert.deepEqual(entries.map((entry) => entry.name), ['chat.html', 'attachments/résumé.txt']);
  assert.ok(entries.every((entry) => entry.method === 0));
  assert.equal(entries[0].data.toString(), '<h1>Hello</h1>');
  assert.equal(entries[1].data.toString(), 'ok');
});

test('is byte-for-byte deterministic with a fixed date', async () => {
  const input = [{ name: 'a.txt', data: 'same', date: new Date('1980-01-01T00:00:00Z') }];
  const first = Buffer.from(await (await buildZipBlob(input)).arrayBuffer());
  const second = Buffer.from(await (await buildZipBlob(input)).arrayBuffer());
  assert.equal(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(second).digest('hex'));
  assert.deepEqual(first, second);
});
