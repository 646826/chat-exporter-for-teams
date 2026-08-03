import { ERROR_CODES, ExportError } from '../shared/errors.js';

export const textEncoder = new TextEncoder();

export function sanitizeFilename(value, fallback = 'file', maxLength = 180) {
  let name = String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!name || /^\.+$/.test(name)) name = fallback;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) name = `_${name}`;
  if (name.length > maxLength) {
    const extension = dot > 0 && name.length - dot <= 20 ? name.slice(dot) : '';
    name = `${name.slice(0, Math.max(1, maxLength - extension.length))}${extension}`;
  }
  return name || fallback;
}

export function sanitizeZipPath(value) {
  const segments = String(value == null ? '' : value)
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => sanitizeFilename(segment));
  return segments.length ? segments.join('/') : 'file';
}

export function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const body = (Array.isArray(rows) ? rows : []).map((row) => columns.map((column) => {
    const raw = typeof column.value === 'function' ? column.value(row) : row[column.key];
    return csvEscape(raw);
  }).join(','));
  return `\ufeff${[header, ...body].join('\r\n')}\r\n`;
}

export function normalizedText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getAttributeSafe(element, name) {
  if (!element || typeof element.getAttribute !== 'function') return '';
  const value = element.getAttribute(name);
  return value == null ? '' : String(value).trim();
}

export function querySelectorSafe(element, selector) {
  if (!element || typeof element.querySelector !== 'function') return null;
  try {
    return element.querySelector(selector);
  } catch {
    return null;
  }
}

export function querySelectorAllSafe(element, selector) {
  if (!element || typeof element.querySelectorAll !== 'function') return [];
  try {
    return Array.from(element.querySelectorAll(selector));
  } catch {
    return [];
  }
}

export function richerText(first, second) {
  const a = String(first || '');
  const b = String(second || '');
  return b.length > a.length ? b : a;
}

export function fnv1a(value) {
  const bytes = textEncoder.encode(String(value || ''));
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function lookupPath(pathMap, url) {
  if (!pathMap) return '';
  if (typeof pathMap.get === 'function') return pathMap.get(url) || '';
  return pathMap[url] || '';
}

export function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index += 1;
  } while (size >= 1024 && index < units.length - 1);
  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[index]}`;
}

export function formatTemplate(template, values = {}) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole
  ));
}

export function createAbortError(message = 'Export cancelled') {
  const error = new ExportError(ERROR_CODES.EXPORT_CANCELLED, message);
  error.name = 'AbortError';
  return error;
}

export function throwIfAborted(signal) {
  if (signal && signal.aborted) throw signal.reason || createAbortError();
}

export function sleep(ms, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason || createAbortError());
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function asBlob(data, type = 'application/octet-stream') {
  if (data instanceof Blob) return data;
  if (typeof data === 'string') return new Blob([textEncoder.encode(data)], { type: type || 'text/plain;charset=utf-8' });
  if (data instanceof Uint8Array) return new Blob([data], { type });
  if (data instanceof ArrayBuffer) return new Blob([new Uint8Array(data)], { type });
  if (ArrayBuffer.isView(data)) return new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)], { type });
  throw new TypeError('ZIP entry data must be a string, Blob, ArrayBuffer, or typed array');
}
