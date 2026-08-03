import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { hostIsSupported } from '../shared/urls.js';
import { aggregateAttachments, downloadAttachments } from './attachments.js';
import { buildArchive } from './archive.js';
import { captureChatHistory } from './capture.js';
import { createProgressOverlay } from './overlay.js';
import { publicAttachmentRecord } from './renderers.js';
import { findMessageNodes, findScrollContainer, getChatTitle } from './teams-adapter.js';
import { clampNumber, createAbortError, sanitizeFilename, sleep } from './utils.js';
import { MAX_ZIP_32 } from './zip.js';

export const DEFAULT_CONFIG = Object.freeze({
  scrollDelayMs: 400,
  topLoadDelayMs: 1100,
  topStableCycles: 5,
  maxScrollCycles: 5000,
  scrollStepRatio: 0.78,
  attachmentConcurrency: 3,
  attachmentTimeoutMs: 45000,
  maxSingleAttachmentBytes: 2_000_000_000,
  maxTotalAttachmentBytes: 3_500_000_000,
  includeAttachments: true,
  autoDownloadZip: true,
});

export function mergeConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    scrollDelayMs: clampNumber(overrides.scrollDelayMs, 100, 5000, DEFAULT_CONFIG.scrollDelayMs),
    topLoadDelayMs: clampNumber(overrides.topLoadDelayMs, 300, 15000, DEFAULT_CONFIG.topLoadDelayMs),
    topStableCycles: Math.round(clampNumber(overrides.topStableCycles, 2, 20, DEFAULT_CONFIG.topStableCycles)),
    maxScrollCycles: Math.round(clampNumber(overrides.maxScrollCycles, 1, 50000, DEFAULT_CONFIG.maxScrollCycles)),
    scrollStepRatio: clampNumber(overrides.scrollStepRatio, 0.25, 0.95, DEFAULT_CONFIG.scrollStepRatio),
    attachmentConcurrency: Math.round(clampNumber(overrides.attachmentConcurrency, 1, 8, DEFAULT_CONFIG.attachmentConcurrency)),
    attachmentTimeoutMs: clampNumber(overrides.attachmentTimeoutMs, 5000, 300000, DEFAULT_CONFIG.attachmentTimeoutMs),
    maxSingleAttachmentBytes: clampNumber(overrides.maxSingleAttachmentBytes, 1_000_000, MAX_ZIP_32, DEFAULT_CONFIG.maxSingleAttachmentBytes),
    maxTotalAttachmentBytes: clampNumber(overrides.maxTotalAttachmentBytes, 10_000_000, MAX_ZIP_32, DEFAULT_CONFIG.maxTotalAttachmentBytes),
    includeAttachments: overrides.includeAttachments !== false,
    autoDownloadZip: overrides.autoDownloadZip !== false,
    strings: overrides.strings && typeof overrides.strings === 'object' ? overrides.strings : {},
    extensionVersion: String(overrides.extensionVersion || ''),
  };
}

export async function runTeamsChatExporter(overrides = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new ExportError(ERROR_CODES.UNSUPPORTED_PAGE, 'The exporter must run in a browser tab.');
  const config = mergeConfig(overrides);
  if (!hostIsSupported(location.hostname) || location.protocol !== 'https:') throw new ExportError(ERROR_CODES.UNSUPPORTED_PAGE, 'Open Microsoft Teams in the browser first.');
  const controller = new AbortController();
  const overlay = createProgressOverlay(() => controller.abort(createAbortError()), config.strings);
  try {
    overlay.update({ phase: overlay.text('phaseFindingChat'), status: overlay.text('statusKeepTabOpen') });
    await sleep(120, controller.signal);
    if (!findMessageNodes(document).length) throw new ExportError(ERROR_CODES.CHAT_NOT_FOUND, overlay.text('errorChatNotFound'));
    const scroller = findScrollContainer(document);
    if (!scroller) throw new ExportError(ERROR_CODES.SCROLLER_NOT_FOUND, overlay.text('errorScrollerNotFound'));
    const captured = await captureChatHistory(scroller, overlay, controller.signal, config);
    if (!captured.messages.length) throw new ExportError(ERROR_CODES.CHAT_NOT_FOUND, overlay.text('errorChatNotFound'));
    const attachments = aggregateAttachments(captured.messages);
    overlay.update({
      phase: overlay.text('phaseHistoryLoaded'),
      status: overlay.text('statusHistoryLoaded', { messages: captured.messages.length, attachments: attachments.length }),
      messages: captured.messages.length,
      attachments: attachments.length,
      progress: attachments.length ? 0 : 1,
    });
    const downloadResult = attachments.length
      ? await downloadAttachments(attachments, captured.ephemeralMap, overlay, controller.signal, config)
      : { records: [], totalBytes: 0 };
    const exportedAt = new Date().toISOString();
    const title = getChatTitle(document);
    const sourceUrl = location.href;
    const zip = await buildArchive({ title, sourceUrl, exportedAt, messages: captured.messages, attachmentRecords: downloadResult.records, overlay, signal: controller.signal, extensionVersion: config.extensionVersion });
    const datePart = exportedAt.slice(0, 10);
    const archiveName = sanitizeFilename(`teams-chat-${title}-${datePart}.zip`, `teams-chat-${datePart}.zip`, 180);
    overlay.update({ messages: captured.messages.length, attachments: attachments.length, bytes: downloadResult.totalBytes });
    overlay.setDownload(zip, archiveName, config.autoDownloadZip);
    return { archiveName, zip, messages: captured.messages, attachmentRecords: downloadResult.records.map(publicAttachmentRecord) };
  } catch (error) {
    if (error && (error.name === 'AbortError' || error.code === ERROR_CODES.EXPORT_CANCELLED)) {
      overlay.setCancelled();
      return null;
    }
    console.error('[Chat Exporter for Teams]', error);
    overlay.setError(error);
    throw error;
  }
}
