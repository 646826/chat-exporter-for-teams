import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { buildZipBlob } from './zip.js';
import {
  renderArchiveReadme, renderAttachmentReportCsv, renderChatCsv, renderChatHtml, renderChatJson,
  renderFailedAttachmentsHtml, renderLinksCsv, renderChatMarkdown,
} from './renderers.js';
import { throwIfAborted } from './utils.js';

export async function buildArchive({ title, sourceUrl, exportedAt, messages, attachmentRecords, overlay, signal, extensionVersion }) {
  throwIfAborted(signal);
  const date = new Date(exportedAt);
  const files = [
    { name: 'chat.html', data: renderChatHtml({ title, sourceUrl, exportedAt, messages, attachmentRecords }), type: 'text/html;charset=utf-8', date },
    { name: 'chat.md', data: renderChatMarkdown({ title, sourceUrl, exportedAt, messages, attachmentRecords }), type: 'text/markdown;charset=utf-8', date },
    { name: 'chat.json', data: renderChatJson({ title, sourceUrl, exportedAt, messages, attachmentRecords }), type: 'application/json;charset=utf-8', date },
    { name: 'chat.csv', data: renderChatCsv(messages), type: 'text/csv;charset=utf-8', date },
    { name: 'links.csv', data: renderLinksCsv(messages), type: 'text/csv;charset=utf-8', date },
    { name: 'attachments-report.csv', data: renderAttachmentReportCsv(attachmentRecords), type: 'text/csv;charset=utf-8', date },
    { name: 'failed-attachments.html', data: renderFailedAttachmentsHtml(attachmentRecords), type: 'text/html;charset=utf-8', date },
    { name: 'README.txt', data: renderArchiveReadme({ title, sourceUrl, exportedAt, messages, records: attachmentRecords, extensionVersion }), type: 'text/plain;charset=utf-8', date },
  ];
  for (const record of attachmentRecords) if (record.status === 'downloaded' && record.blob && record.path) files.push({ name: record.path, data: record.blob, type: record.mimeType, date });
  overlay.update({ phase: overlay.text('phaseBuildingZip'), status: overlay.text('statusZipFiles', { count: files.length }), progress: 0 });
  try {
    return await buildZipBlob(files, {
      defaultDate: date,
      signal,
      onProgress(progress) {
        throwIfAborted(signal);
        overlay.update({ phase: overlay.text('phaseBuildingZip'), status: overlay.text('statusZipCrc', { filename: progress.name }), progress: files.length ? progress.completed / files.length : 1 });
      },
    });
  } catch (error) {
    throwIfAborted(signal);
    if (error && error.code === ERROR_CODES.ZIP_LIMIT_EXCEEDED) throw error;
    throw new ExportError(ERROR_CODES.ZIP_BUILD_FAILED, String(error && error.message || error), { cause: error });
  }
}
