import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32Blob, crc32Bytes, buildZipBlob } from '../../src/content/zip.js';
import { buildArchive } from '../../src/content/archive.js';
import { createAbortError } from '../../src/content/utils.js';

const MiB = 1024 * 1024;
class ObservedBlob extends Blob {
  slices = [];
  onSlice = () => {};
  slice(start, end, type) {
    this.slices.push([start, end]);
    const result = super.slice(start, end, type);
    this.onSlice(this.slices.length, result);
    return result;
  }
}
test('pre-cancelled checksums reject with the original reason without reading bytes', async () => {
  const controller = new AbortController(), reason = createAbortError();
  controller.abort(reason);
  const blob = new ObservedBlob(['must not be read']);
  await assert.rejects(crc32Blob(blob, controller.signal), error => error === reason);
  assert.equal(blob.slices.length, 0);
});
test('cancellation between chunks stops reading the rest of a large file', async () => {
  const controller = new AbortController(), reason = createAbortError();
  const blob = new ObservedBlob([new Uint8Array(3 * MiB)]);
  blob.onSlice = count => { if (count === 2) controller.abort(reason); };
  await assert.rejects(crc32Blob(blob, controller.signal), error => error === reason);
  assert.equal(blob.slices.length, 2);
  assert.ok(blob.slices.every(([start, end]) => end - start <= 256 * 1024));
});
test('chunked CRC preserves bytes at empty, small and boundary sizes', async () => {
  assert.equal(await crc32Blob(new Blob(['123456789'])), 0xcbf43926);
  for (const size of [0, 1, 256 * 1024 - 1, 256 * 1024, 256 * 1024 + 1, MiB + 7]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 31) & 255);
    assert.equal(await crc32Blob(new Blob([bytes])), crc32Bytes(bytes));
  }
});
test('large checksums yield to scheduled user cancellation', async () => {
  const controller = new AbortController(), reason = createAbortError();
  const blob = new ObservedBlob([new Uint8Array(3 * MiB)]);
  const timer = setTimeout(() => controller.abort(reason), 0);
  try { await assert.rejects(crc32Blob(blob, controller.signal), error => error === reason); }
  finally { clearTimeout(timer); }
  assert.ok(blob.slices.length < 12, 'cancel before the full file is read');
});
test('pre-cancelled ZIP creation does not report progress or build a result', async () => {
  const controller = new AbortController(), reason = createAbortError(); controller.abort(reason);
  let progress = 0;
  await assert.rejects(buildZipBlob([{ name: 'a', data: 'A' }], {
    signal: controller.signal, onProgress() { progress++; },
  }), error => error === reason);
  assert.equal(progress, 0);
});
test('cancelling after a ZIP entry prevents subsequent entries and final output', async () => {
  for (const files of [[{ name: 'a', data: 'A' }], [{ name: 'a', data: 'A' }, { name: 'b', data: 'B' }]]) {
    const controller = new AbortController(), reason = createAbortError(); let progress = 0;
    await assert.rejects(buildZipBlob(files, { signal: controller.signal,
      onProgress() { progress++; controller.abort(reason); },
    }), error => error === reason);
    assert.equal(progress, 1);
  }
});
test('cancelled archive construction is not relabelled as ZIP_BUILD_FAILED', async () => {
  const controller = new AbortController(), reason = createAbortError();
  await assert.rejects(buildArchive({ title: 'Synthetic', sourceUrl: 'https://example.test',
    exportedAt: '2026-01-01T00:00:00Z', messages: [], attachmentRecords: [],
    signal: controller.signal, overlay: { text: key => key, update() { controller.abort(reason); } },
  }), error => error === reason);
});
test('pre-cancelled archives do not render progress UI', async () => {
  const controller = new AbortController(), reason = createAbortError(); controller.abort(reason);
  let updates = 0;
  await assert.rejects(buildArchive({ title: 'Synthetic', sourceUrl: '',
    exportedAt: '2026-01-01T00:00:00Z', messages: [], attachmentRecords: [],
    signal: controller.signal, overlay: { text: key => key, update() { updates++; } },
  }), error => error === reason);
  assert.equal(updates, 0);
});
test('normal ZIP output remains deterministic and includes the original checksum', async () => {
  const options = { defaultDate: new Date('2026-01-01T00:00:00Z') };
  const files = [{ name: 'text.txt', data: '123456789' }];
  const first = Buffer.from(await (await buildZipBlob(files, options)).arrayBuffer());
  const second = Buffer.from(await (await buildZipBlob(files, options)).arrayBuffer());
  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(14), 0xcbf43926);
});
