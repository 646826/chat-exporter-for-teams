import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { asBlob, sanitizeZipPath, textEncoder, throwIfAborted, sleep } from './utils.js';

const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
export const MAX_ZIP_32 = 0xffffffff;
let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

export function crc32Update(current, bytes) {
  const table = getCrcTable();
  let crc = current >>> 0;
  for (let index = 0; index < bytes.length; index += 1) crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

export function crc32Bytes(bytes) {
  return (crc32Update(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
}

export async function crc32Blob(blob, signal) {
  // Bound each read and give the existing cancel button regular opportunities
  // to run. The checksum and ZIP format are unchanged; no worker is required.
  const chunkSize = 256 * 1024;
  const yieldBytes = 1024 * 1024;
  let crc = 0xffffffff;
  let sinceYield = 0;
  throwIfAborted(signal);
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    throwIfAborted(signal);
    const end = Math.min(blob.size, offset + chunkSize);
    const bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
    throwIfAborted(signal);
    crc = crc32Update(crc, bytes);
    sinceYield += bytes.length;
    if (sinceYield >= yieldBytes && end < blob.size) {
      await sleep(0, signal);
      sinceYield = 0;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(dateValue) {
  const date = dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : new Date();
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  const dosTime = ((date.getUTCHours() & 0x1f) << 11)
    | ((date.getUTCMinutes() & 0x3f) << 5)
    | (Math.floor(date.getUTCSeconds() / 2) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9)
    | (((date.getUTCMonth() + 1) & 0x0f) << 5)
    | (date.getUTCDate() & 0x1f);
  return { dosTime, dosDate };
}

function createLocalHeader(entry) {
  const bytes = new Uint8Array(30 + entry.nameBytes.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, ZIP_UTF8_FLAG, true);
  view.setUint16(8, ZIP_STORE_METHOD, true);
  view.setUint16(10, entry.dosTime, true);
  view.setUint16(12, entry.dosDate, true);
  view.setUint32(14, entry.crc32, true);
  view.setUint32(18, entry.size, true);
  view.setUint32(22, entry.size, true);
  view.setUint16(26, entry.nameBytes.length, true);
  view.setUint16(28, 0, true);
  bytes.set(entry.nameBytes, 30);
  return bytes;
}

function createCentralHeader(entry) {
  const bytes = new Uint8Array(46 + entry.nameBytes.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, ZIP_UTF8_FLAG, true);
  view.setUint16(10, ZIP_STORE_METHOD, true);
  view.setUint16(12, entry.dosTime, true);
  view.setUint16(14, entry.dosDate, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.size, true);
  view.setUint32(24, entry.size, true);
  view.setUint16(28, entry.nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, entry.offset, true);
  bytes.set(entry.nameBytes, 46);
  return bytes;
}

function createEndOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return bytes;
}

export async function buildZipBlob(files, options = {}) {
  throwIfAborted(options.signal);
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  if (files.length > 0xffff) throw new ExportError(ERROR_CODES.ZIP_LIMIT_EXCEEDED, 'Classic ZIP supports at most 65,535 entries.');
  const entries = [];
  let offset = 0;

  for (const file of files) {
    throwIfAborted(options.signal);
    const name = sanitizeZipPath(file.name || 'file');
    const nameBytes = textEncoder.encode(name);
    if (nameBytes.length > 0xffff) throw new ExportError(ERROR_CODES.ZIP_LIMIT_EXCEEDED, `ZIP filename is too long: ${name}`);
    const blob = asBlob(file.data, file.type);
    if (blob.size > MAX_ZIP_32) throw new ExportError(ERROR_CODES.ZIP_LIMIT_EXCEEDED, `ZIP64 is not supported; file is too large: ${name}`);
    const crc32 = await crc32Blob(blob, options.signal);
    const date = file.date || options.defaultDate || new Date();
    const { dosTime, dosDate } = dosDateTime(date instanceof Date ? date : new Date(date));
    const entry = { name, nameBytes, blob, size: blob.size, crc32, dosTime, dosDate, offset };
    entry.localHeader = createLocalHeader(entry);
    offset += entry.localHeader.length + entry.size;
    if (offset > MAX_ZIP_32) throw new ExportError(ERROR_CODES.ZIP_LIMIT_EXCEEDED, 'ZIP64 is not supported; archive exceeds 4 GiB.');
    entries.push(entry);
    if (typeof options.onProgress === 'function') options.onProgress({ phase: 'crc', completed: entries.length, total: files.length, name });
  }

  throwIfAborted(options.signal);
  const centralOffset = offset;
  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = createCentralHeader(entry);
    centralParts.push(header);
    centralSize += header.length;
  }
  if (centralOffset + centralSize > MAX_ZIP_32) throw new ExportError(ERROR_CODES.ZIP_LIMIT_EXCEEDED, 'ZIP64 is not supported; archive exceeds 4 GiB.');
  const parts = [];
  for (const entry of entries) parts.push(entry.localHeader, entry.blob);
  parts.push(...centralParts, createEndOfCentralDirectory(entries.length, centralSize, centralOffset));
  return new Blob(parts, { type: 'application/zip' });
}
