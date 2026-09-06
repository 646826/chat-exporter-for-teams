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

export async function prefetchEphemeralAttachments(messages, ephemeralMap, signal, enabled = true) {
  if (!enabled) return;
  const promises = [];
  for (const message of messages) {
    for (const attachment of message.attachments || []) {
      if (!/^(?:blob|data):/i.test(attachment.url) || ephemeralMap.has(attachment.url)) continue;
      const promise = (async () => {
        try {
          throwIfAborted(signal);
          const response = await fetch(attachment.url, { credentials: 'include', signal });
          if (!response.ok && response.status !== 0) throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, `HTTP ${response.status}`);
          const blob = await response.blob();
          return { blob, mimeType: blob.type || '', error: '' };
        } catch (error) {
          return { blob: null, mimeType: '', error: String(error && error.message || error) };
        }
      })();
      ephemeralMap.set(attachment.url, promise);
      promises.push(promise);
    }
  }
  if (promises.length) await Promise.allSettled(promises);
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
async function readAttachmentBlob(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') return response.blob();
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(bytes)})`);
      }
      chunks.push(value);
    }
    return new Blob(chunks, { type: response.headers.get('content-type') || '' });
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function fetchAttachmentCandidate(candidate, signal, config) {
  const attempts = sharePointDownloadCandidates(candidate.url);
  if (!attempts.length) attempts.push(candidate.url);
  const errors = [];
  for (const attemptUrl of attempts) {
    throwIfAborted(signal);
    const linked = createLinkedTimeoutSignal(signal, config.attachmentTimeoutMs);
    try {
      const response = await fetch(attemptUrl, { credentials: 'include', redirect: 'follow', cache: 'no-store', signal: linked.signal });
      if (!response.ok) throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, `HTTP ${response.status} ${response.statusText || ''}`.trim());
      const contentLength = Number(response.headers.get('content-length')) || 0;
      if (contentLength > config.maxSingleAttachmentBytes) {
        if (response.body) await response.body.cancel().catch(() => {});
        throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(contentLength)})`);
      }
      const blob = await readAttachmentBlob(response, config.maxSingleAttachmentBytes);
      if (!blob.size) throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, 'Empty response body');
      if (blob.size > config.maxSingleAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(blob.size)})`);
      const mimeType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
      if (/^text\/html\b/i.test(mimeType) && !urlLooksLikeHtmlDocument(candidate.url, candidate.nameHint)) {
        throw new ExportError(ERROR_CODES.ATTACHMENT_SIGN_IN_PAGE, 'Received an HTML sign-in or viewer page instead of the file');
      }
      return {
        blob,
        mimeType,
        resolvedUrl: response.url || attemptUrl,
        contentDispositionName: parseContentDispositionFilename(response.headers.get('content-disposition')),
        attempts: [...errors.map((entry) => entry.url), attemptUrl],
      };
    } catch (error) {
      if (signal && signal.aborted) throw signal.reason || error;
      const normalized = linked.signal.aborted && linked.signal.reason ? linked.signal.reason : error;
      errors.push({ url: attemptUrl, code: normalized && normalized.code, message: String(normalized && normalized.message || normalized) });
    } finally {
      linked.cleanup();
    }
  }
  const last = errors.at(-1) || {};
  const error = new ExportError(last.code || ERROR_CODES.ATTACHMENT_HTTP_ERROR, errors.map((entry) => `${entry.url}: ${entry.message}`).join(' | ') || 'Download failed', { attempts: errors });
  error.attempts = errors;
  throw error;
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
      const baseRecord = { url: candidate.url, resolvedUrl: '', status: 'failed', filename: '', path: '', bytes: 0, mimeType: '', error: '', messageIds: candidate.messageIds || [], attempts: [] };
      try {
        if (!config.includeAttachments) throw new ExportError('DOWNLOAD_DISABLED', 'Attachment downloads were disabled by the user.');
        let downloaded;
        if (ephemeralMap.has(candidate.url)) {
          const prefetched = await ephemeralMap.get(candidate.url);
          if (!prefetched || !prefetched.blob) throw new ExportError(ERROR_CODES.ATTACHMENT_HTTP_ERROR, prefetched && prefetched.error || 'Ephemeral media URL expired');
          downloaded = { blob: prefetched.blob, mimeType: prefetched.mimeType || prefetched.blob.type || 'application/octet-stream', resolvedUrl: candidate.url, contentDispositionName: '', attempts: [candidate.url] };
        } else {
          downloaded = await fetchAttachmentCandidate(candidate, signal, config);
        }
        if (downloaded.blob.size > config.maxSingleAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOO_LARGE, `File exceeds limit (${formatBytes(downloaded.blob.size)})`);
        if (totalBytes + downloaded.blob.size > config.maxTotalAttachmentBytes) throw new ExportError(ERROR_CODES.ATTACHMENT_TOTAL_LIMIT, `Total attachment limit would exceed ${formatBytes(config.maxTotalAttachmentBytes)}`);
        totalBytes += downloaded.blob.size;
        const filename = uniqueAttachmentFilename(downloaded.contentDispositionName || candidate.nameHint || filenameHintFromUrl(candidate.url) || 'attachment', downloaded.mimeType, index + 1, usedNames);
        records[index] = { ...baseRecord, status: 'downloaded', filename, path: `attachments/${filename}`, bytes: downloaded.blob.size, mimeType: downloaded.mimeType, resolvedUrl: downloaded.resolvedUrl, attempts: downloaded.attempts, blob: downloaded.blob };
      } catch (error) {
        if (signal && signal.aborted) throw signal.reason || error;
        const status = error && ['DOWNLOAD_DISABLED', ERROR_CODES.ATTACHMENT_TOO_LARGE, ERROR_CODES.ATTACHMENT_TOTAL_LIMIT].includes(error.code) ? 'skipped' : 'failed';
        const filename = uniqueAttachmentFilename(candidate.nameHint || filenameHintFromUrl(candidate.url) || 'attachment', '', index + 1, usedNames);
        records[index] = { ...baseRecord, status, filename, error: String(error && error.message || error), attempts: error && (error.attempts || error.details && error.details.attempts) || [] };
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
