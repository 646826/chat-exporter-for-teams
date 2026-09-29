import { discardResponseBody, fetchWithRetry } from './retry.js';
import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { classifyAttachmentUrl, filenameHintFromUrl, sharePointDownloadCandidates } from '../shared/urls.js';
import { formatBytes, getAttributeSafe, sanitizeFilename, throwIfAborted } from './utils.js';

export function isLikelyAttachmentCandidate(candidate = {}) {
  const url = String(candidate.url || '').trim();
  if (!url) return false;
  const context = [candidate.dataTid, candidate.className, candidate.role, candidate.alt, candidate.title].filter(Boolean).join(' ').toLowerCase();
  const kind = String(candidate.kind || '').toLowerCase();
  const width = Number(candidate.width) || 0;
  const height = Number(candidate.height) || 0;
  if (/\b(?:avatar|persona|profile(?: picture)?|presence|reaction|emoji|emoticon)\b/i.test(context)) return false;
  if (kind === 'image' && width > 0 && height > 0 && width <= 64 && height <= 64 && !candidate.isFileCard) return false;
  if (candidate.isFileCard || candidate.download || candidate.isAttachment) return true;
  if (candidate.isMedia || /^(?:image|video|audio|source|poster)$/.test(kind)) {
    if (kind === 'image') return width === 0 || height === 0 || width >= 96 || height >= 96;
    return true;
  }
  return classifyAttachmentUrl(url, candidate) === 'attachment';
}

function filenameQuality(name) {
  const value = String(name || '');
  let score = value.length;
  if (/\.[a-z0-9]{1,10}$/i.test(value)) score += 1000;
  if (/^(?:file|attachment|image|video|audio|download|data-url)$/i.test(value)) score -= 1000;
  return score;
}

export function aggregateAttachments(messages) {
  const map = new Map();
  for (const message of Array.isArray(messages) ? messages : []) {
    for (const candidate of message.attachments || []) {
      const url = String(candidate && candidate.url || '').trim();
      if (!url) continue;
      if (!map.has(url)) {
        map.set(url, { ...candidate, url, messageIds: message.id ? [String(message.id)] : [] });
        continue;
      }
      const current = map.get(url);
      if (message.id && !current.messageIds.includes(String(message.id))) current.messageIds.push(String(message.id));
      if (filenameQuality(candidate.nameHint) > filenameQuality(current.nameHint)) current.nameHint = candidate.nameHint;
      for (const key of ['kind', 'dataTid', 'className', 'role', 'alt', 'title']) if (!current[key] && candidate[key]) current[key] = candidate[key];
      current.width = Math.max(Number(current.width) || 0, Number(candidate.width) || 0);
      current.height = Math.max(Number(current.height) || 0, Number(candidate.height) || 0);
      current.isFileCard = Boolean(current.isFileCard || candidate.isFileCard);
      current.isMedia = Boolean(current.isMedia || candidate.isMedia);
    }
  }
  return [...map.values()];
}

export function parseContentDispositionFilename(headerValue) {
  const value = String(headerValue || '');
  const extended = value.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (extended) {
    const raw = extended[1].trim().replace(/^['"]|['"]$/g, '');
    try { return sanitizeFilename(decodeURIComponent(raw)); } catch { return sanitizeFilename(raw); }
  }
  const quoted = value.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted) return sanitizeFilename(quoted[1]);
  const plain = value.match(/filename\s*=\s*([^;]+)/i);
  return plain ? sanitizeFilename(plain[1].trim().replace(/^['"]|['"]$/g, '')) : '';
}

const MIME_EXTENSIONS = Object.freeze({
  'application/json': '.json', 'application/msword': '.doc', 'application/pdf': '.pdf', 'application/rtf': '.rtf',
  'application/vnd.ms-excel': '.xls', 'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/x-7z-compressed': '.7z', 'application/x-rar-compressed': '.rar', 'application/zip': '.zip',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'image/bmp': '.bmp', 'image/gif': '.gif',
  'image/heic': '.heic', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/svg+xml': '.svg', 'image/tiff': '.tiff',
  'image/webp': '.webp', 'text/csv': '.csv', 'text/html': '.html', 'text/markdown': '.md', 'text/plain': '.txt',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
});

export function inferExtensionFromMime(mimeType) {
  return MIME_EXTENSIONS[String(mimeType || '').split(';')[0].trim().toLowerCase()] || '';
}

export function uniqueAttachmentFilename(nameHint, mimeType, index, usedNames = new Set()) {
  const prefix = String(Math.max(1, Number(index) || 1)).padStart(3, '0');
  let base = sanitizeFilename(nameHint || 'attachment');
  if (!/\.[a-z0-9]{1,10}$/i.test(base)) base += inferExtensionFromMime(mimeType);
  let candidate = `${prefix}_${base}`;
  let collision = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const dot = candidate.lastIndexOf('.');
    const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
    const extension = dot > 0 ? candidate.slice(dot) : '';
    candidate = `${stem}_${collision}${extension}`;
    collision += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

const ephemeralByteTotals = new WeakMap();

export async function prefetchEphemeralAttachments(messages, ephemeralMap, signal, enabled = true, options = {}) {
  if (!enabled) return;
  const config = { attachmentTimeoutMs: 45000, attachmentConcurrency: 3, maxSingleAttachmentBytes: 2_000_000_000, maxTotalAttachmentBytes: 3_500_000_000, ...options };
  const queue = [];
  for (const message of messages) {
    for (const candidate of message.attachments || []) {
      if (!/^(?:blob|data):/i.test(candidate.url) || ephemeralMap.has(candidate.url)) continue;
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      ephemeralMap.set(candidate.url, promise);
      queue.push({ candidate, resolve });
    }
  }
  let next = 0;
  async function prefetchWorker() {
    while (next < queue.length) {
      throwIfAborted(signal);
      const task = queue[next++];
      let attempts = [];
      try {
        const downloaded = await fetchAttachmentCandidate(task.candidate, signal, config);
        attempts = downloaded.attempts;
        const used = ephemeralByteTotals.get(ephemeralMap) || 0;
        if (used + downloaded.blob.size > config.maxTotalAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOTAL_LIMIT, 'Ephemeral media cache reached the total attachment limit');
        ephemeralByteTotals.set(ephemeralMap, used + downloaded.blob.size);
        task.resolve({ blob: downloaded.blob, mimeType: downloaded.mimeType, error: '', errorCode: '', attempts });
      } catch (error) {
        task.resolve({ blob: null, mimeType: '', error: String(error?.message || error), errorCode: error?.code || ERROR_CODES.ATTACHMENT_HTTP_ERROR, attempts: error?.attempts || attempts });
        throwIfAborted(signal);
      }
    }
  }
  const workers = Math.min(queue.length, Math.max(1, Math.min(8, Number(config.attachmentConcurrency) || 3)));
  await Promise.all(Array.from({ length: workers }, () => prefetchWorker()));
}

function createLinkedTimeoutSignal(parentSignal, timeoutMs) {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(parentSignal.reason || new ExportError(ERROR_CODES.EXPORT_CANCELLED, 'Export cancelled'));
  if (parentSignal) {
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new ExportError(ERROR_CODES.ATTACHMENT_TIMEOUT, `Timed out after ${timeoutMs} ms`)), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
    },
  };
}

function urlLooksLikeHtmlDocument(urlValue, nameHint) {
  return /\.html?(?:$|[?#])/i.test(String(urlValue || '')) || /\.html?$/i.test(String(nameHint || ''));
}

// Enforce the limit while reading, not only after allocating the entire file.
// Fetch's linked AbortSignal still owns cancellation and the existing timeout.
async function readAttachmentBlob(response, maxBytes, signal) {
  if (!response.body || typeof response.body.getReader !== 'function') return response.blob();
  const reader = response.body.getReader();
  const onReadAbort = () => { discardResponseBody(reader, signal.reason); };
  if (signal) signal.addEventListener('abort', onReadAbort, { once: true });
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(bytes)})`);
      }
      chunks.push(value);
    }
    return new Blob(chunks, { type: response.headers.get('content-type') || '' });
  } catch (error) {
    discardResponseBody(reader, error);
    throw error;
  } finally {
    if (signal) signal.removeEventListener('abort', onReadAbort);
    reader.releaseLock();
  }
}

export async function fetchAttachmentCandidate(candidate, signal, config) {
  const attempts = sharePointDownloadCandidates(candidate.url);
  if (!attempts.length) attempts.push(candidate.url);
  const errors = [];
  const requestAttempts = [];
  const ephemeral = /^(?:blob|data):/i.test(candidate.url);
  const linked = createLinkedTimeoutSignal(signal, config.attachmentTimeoutMs);
  try {
    for (const attemptUrl of attempts) {
      throwIfAborted(signal);
      if (linked.signal.aborted) break;
      try {
        const response = await fetchWithRetry(attemptUrl, { credentials: 'include', redirect: 'follow', cache: 'no-store', signal: linked.signal }, config, requestAttempts);
        if (!response.ok) {
          discardResponseBody(response.body);
          throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, `HTTP ${response.status} ${response.statusText || ''}`.trim());
        }
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';
        const contentDispositionName = parseContentDispositionFilename(response.headers.get('content-disposition'));
        if (/^text\/html\b/i.test(mimeType) && !ephemeral && !urlLooksLikeHtmlDocument(candidate.url, candidate.nameHint)) {
          discardResponseBody(response.body);
          throw new ExportError(ERROR_CODES.ATTACHMENT_SIGN_IN_PAGE, 'Received an HTML sign-in or viewer page instead of the file');
        }
        const contentLength = Number(response.headers.get('content-length')) || 0;
        if (contentLength > config.maxSingleAttachmentBytes) {
          discardResponseBody(response.body);
          throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(contentLength)})`);
        }
        const blob = await readAttachmentBlob(response, config.maxSingleAttachmentBytes, linked.signal);
        const explicitEmptyFile = response.status === 200 && contentDispositionName && /^attachment\b/i.test(response.headers.get('content-disposition') || '');
        if (!blob.size && !ephemeral && !explicitEmptyFile) throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, 'Empty response body');
        if (blob.size > config.maxSingleAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(blob.size)})`);
        return { blob, mimeType, resolvedUrl: response.url || attemptUrl, contentDispositionName, attempts: [...requestAttempts] };
      } catch (error) {
        if (signal && signal.aborted) throw signal.reason || error;
        const normalized = linked.signal.aborted && linked.signal.reason ? linked.signal.reason : error;
        errors.push({ url: attemptUrl, code: normalized?.code, message: String(normalized?.message || normalized) });
        if (linked.signal.aborted) break;
      }
    }
    const last = errors.at(-1) || {};
    const error = new ExportError(last.code || ERROR_CODES.ATTACHMENT_HTTP_ERROR, errors.map((entry) => `${entry.url}: ${entry.message}`).join(' | ') || 'Download failed', { attempts: errors });
    error.attempts = requestAttempts;
    throw error;
  } finally { linked.cleanup(); }
}

function attachmentDisplayName(candidate) {
  const hint = String(candidate.nameHint || '');
  const urlName = filenameHintFromUrl(candidate.url);
  const linkLabel = hint.match(/^link\s+(.+)$/i);
  if (linkLabel && !/^https?(?:[:_\/])/i.test(linkLabel[1])) return linkLabel[1];
  const generic = /^(?:link|shared|attachment|file)$/i.test(hint) || /^url preview\b/i.test(hint) || Boolean(linkLabel);
  return generic && urlName ? urlName : hint || urlName || 'attachment';
}

export async function downloadAttachments(attachments, ephemeralMap, overlay, signal, config) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const records = new Array(safeAttachments.length);
  const usedNames = new Set();
  let nextIndex = 0;
  let completed = 0;
  let totalBytes = 0;

  async function worker() {
    while (true) {
      throwIfAborted(signal);
      const index = nextIndex;
      nextIndex += 1;
      if (index >= safeAttachments.length) return;
      const candidate = safeAttachments[index];
      const baseRecord = { url: candidate.url, resolvedUrl: '', status: 'failed', filename: '', path: '', bytes: 0, mimeType: '', error: '', errorCode: '', messageIds: candidate.messageIds || [], attempts: [] };
      try {
        if (!config.includeAttachments) throw new ExportError('DOWNLOAD_DISABLED', 'Attachment downloads were disabled by the user.');
        let downloaded;
        if (ephemeralMap.has(candidate.url)) {
          const prefetched = await ephemeralMap.get(candidate.url);
          if (!prefetched || !prefetched.blob) throw new ExportError(prefetched?.errorCode || ERROR_CODES.ATTACHMENT_HTTP_ERROR, prefetched && prefetched.error || 'Ephemeral media URL expired', { attempts: prefetched?.attempts || [] });
          downloaded = { blob: prefetched.blob, mimeType: prefetched.mimeType || prefetched.blob.type || 'application/octet-stream', resolvedUrl: candidate.url, contentDispositionName: '', attempts: prefetched.attempts || [candidate.url] };
        } else {
          downloaded = await fetchAttachmentCandidate(candidate, signal, config);
        }
        baseRecord.attempts = downloaded.attempts;
        if (downloaded.blob.size > config.maxSingleAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(downloaded.blob.size)})`);
        if (totalBytes + downloaded.blob.size > config.maxTotalAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOTAL_LIMIT, `Total attachment limit would exceed ${formatBytes(config.maxTotalAttachmentBytes)}`);
        totalBytes += downloaded.blob.size;
        const filename = uniqueAttachmentFilename(downloaded.contentDispositionName || attachmentDisplayName(candidate), downloaded.mimeType, index + 1, usedNames);
        records[index] = { ...baseRecord, status: 'downloaded', filename, path: `attachments/${filename}`, bytes: downloaded.blob.size, mimeType: downloaded.mimeType, resolvedUrl: downloaded.resolvedUrl, attempts: downloaded.attempts, blob: downloaded.blob };
      } catch (error) {
        if (signal && signal.aborted) throw signal.reason || error;
        const status = error && ['DOWNLOAD_DISABLED', ERROR_CODES.ATTACHMENT_TOO_LARGE, ERROR_CODES.ATTACHMENT_TOTAL_LIMIT].includes(error.code) ? 'skipped' : 'failed';
        const filename = uniqueAttachmentFilename(attachmentDisplayName(candidate), '', index + 1, usedNames);
        records[index] = { ...baseRecord, status, filename, errorCode: error?.code || ERROR_CODES.ATTACHMENT_HTTP_ERROR, error: String(error && error.message || error), attempts: error && (error.attempts || error.details && error.details.attempts) || baseRecord.attempts };
      }
      completed += 1;
      overlay.update({
        phase: overlay.text('phaseDownloadingAttachments'),
        status: overlay.text('statusAttachmentProgress', { current: completed, total: safeAttachments.length, filename: records[index].filename }),
        attachments: safeAttachments.length,
        bytes: totalBytes,
        progress: safeAttachments.length ? completed / safeAttachments.length : 1,
      });
      if (records[index].status !== 'downloaded') overlay.log(`${records[index].status}: ${records[index].filename}`);
    }
  }

  const workerCount = Math.min(config.attachmentConcurrency, Math.max(1, safeAttachments.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { records, totalBytes };
}
