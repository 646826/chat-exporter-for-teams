import { archivePathToHref } from '../shared/urls.js';
import { decodeHtmlAttribute, escapeHtml, lookupPath, toCsv } from './utils.js';

export function publicAttachmentRecord(record) {
  if (!record) return {};
  const { blob, response, ...safe } = record;
  return safe;
}

export function renderChatJson({ title, sourceUrl, exportedAt, messages, attachmentRecords }) {
  const payload = {
    format: 'chat-exporter-for-teams/v1',
    title: String(title || 'Teams chat'),
    sourceUrl: String(sourceUrl || ''),
    exportedAt: String(exportedAt || new Date().toISOString()),
    messageCount: Array.isArray(messages) ? messages.length : 0,
    attachmentCount: Array.isArray(attachmentRecords) ? attachmentRecords.length : 0,
    messages: (Array.isArray(messages) ? messages : []).map((message, index) => ({ index: index + 1, ...message })),
    attachments: (Array.isArray(attachmentRecords) ? attachmentRecords : []).map(publicAttachmentRecord),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function renderChatCsv(messages) {
  return toCsv((Array.isArray(messages) ? messages : []).map((message, index) => ({ ...message, index: index + 1 })), [
    { key: 'index', label: 'Index' }, { key: 'id', label: 'Message ID' }, { key: 'timestamp', label: 'Date/time' },
    { key: 'author', label: 'Author' }, { key: 'text', label: 'Text' },
    { label: 'Attachments', value: (message) => (message.attachments || []).map((item) => item.nameHint || item.url).join('\n') },
    { label: 'Attachment URLs', value: (message) => (message.attachments || []).map((item) => item.url).join('\n') },
    { label: 'Links', value: (message) => (message.links || []).map((item) => item.url).join('\n') },
    { label: 'Reactions', value: (message) => (message.reactions || []).join('\n') },
  ]);
}

export function renderLinksCsv(messages) {
  const rows = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    for (const link of message.links || []) rows.push({ messageId: message.id, timestamp: message.timestamp, author: message.author, text: link.text, url: link.url });
  }
  return toCsv(rows, [
    { key: 'messageId', label: 'Message ID' }, { key: 'timestamp', label: 'Date/time' }, { key: 'author', label: 'Author' },
    { key: 'text', label: 'Link text' }, { key: 'url', label: 'URL' },
  ]);
}

export function renderAttachmentReportCsv(records) {
  return toCsv(Array.isArray(records) ? records : [], [
    { key: 'status', label: 'Status' }, { key: 'filename', label: 'Filename' }, { key: 'path', label: 'Archive path' },
    { key: 'bytes', label: 'Bytes' }, { key: 'mimeType', label: 'MIME type' }, { key: 'url', label: 'Original URL' },
    { key: 'resolvedUrl', label: 'Resolved URL' }, { key: 'error', label: 'Error' },
    { label: 'Message IDs', value: (record) => (record.messageIds || []).join(' ') },
  ]);
}

export function buildAttachmentPathMap(records) {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (record && record.status === 'downloaded' && record.path && record.url) map.set(record.url, record.path);
    if (record && record.status === 'downloaded' && record.path && record.resolvedUrl) map.set(record.resolvedUrl, record.path);
  }
  return map;
}

export function rewriteHtmlAssetUrls(html, pathMap) {
  return String(html || '').replace(/\b(src|href)=(['"])(.*?)\2/gi, (whole, attribute, quote, encodedUrl) => {
    const path = lookupPath(pathMap, decodeHtmlAttribute(encodedUrl));
    return path ? `${attribute}=${quote}${archivePathToHref(path)}${quote}` : whole;
  });
}

function renderMessageAttachments(message, recordsByUrl) {
  const items = [];
  for (const attachment of message.attachments || []) {
    const record = recordsByUrl.get(attachment.url);
    const label = attachment.nameHint || record && record.filename || 'attachment';
    const href = record && record.status === 'downloaded' && record.path ? archivePathToHref(record.path) : attachment.url;
    const status = record && record.status !== 'downloaded' ? ` <span class="attachment-status">(${escapeHtml(record.status)})</span>` : '';
    items.push(`<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>${status}</li>`);
  }
  return items.length ? `<ul class="attachments">${items.join('')}</ul>` : '';
}

export function renderChatHtml({ title, sourceUrl, exportedAt, messages, attachmentRecords }) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeRecords = Array.isArray(attachmentRecords) ? attachmentRecords : [];
  const pathMap = buildAttachmentPathMap(safeRecords);
  const recordsByUrl = new Map(safeRecords.filter(Boolean).map((record) => [record.url, record]));
  const messageHtml = safeMessages.map((message, index) => {
    const richBody = message.html ? rewriteHtmlAssetUrls(message.html, pathMap) : escapeHtml(message.text || '').replace(/\r?\n/g, '<br>');
    const reactions = (message.reactions || []).length ? `<div class="reactions">${message.reactions.map((reaction) => `<span>${escapeHtml(reaction)}</span>`).join('')}</div>` : '';
    const links = (message.links || []).length ? `<details class="links"><summary>Links (${message.links.length})</summary><ul>${message.links.map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.text || link.url)}</a></li>`).join('')}</ul></details>` : '';
    const time = message.timestamp || message.timestampLabel || '';
    return `<article class="message" id="message-${escapeHtml(message.id || String(index + 1))}">
<header><strong>${escapeHtml(message.author || 'Unknown')}</strong><time datetime="${escapeHtml(message.timestamp || '')}">${escapeHtml(time)}</time><span class="number">#${index + 1}</span></header>
<div class="body" dir="auto">${richBody || '<em class="empty">[No text]</em>'}</div>
${renderMessageAttachments(message, recordsByUrl)}${reactions}${links}
</article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || 'Teams chat')}</title>
<style>:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}body{margin:0;background:#f4f5f7;color:#202124}main{max-width:980px;margin:0 auto;padding:28px 18px 80px}.summary{background:#fff;border:1px solid #dfe1e5;border-radius:14px;padding:18px 20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.05)}h1{font-size:1.5rem;margin:0 0 8px;word-break:break-word}.meta{font-size:.88rem;color:#5f6368;overflow-wrap:anywhere}.message{background:#fff;border:1px solid #dfe1e5;border-radius:12px;margin:10px 0;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.035)}.message header{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid #eceff1;padding-bottom:7px;margin-bottom:9px}.message header strong{font-size:.98rem}.message time{font-size:.8rem;color:#6b7280}.number{margin-left:auto;font-size:.75rem;color:#9ca3af}.body{overflow-wrap:anywhere}.body pre{white-space:pre-wrap;background:#f6f8fa;border-radius:8px;padding:10px;overflow:auto}.body code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f0f1f3;border-radius:4px;padding:.08em .3em}.body img,.body video{max-width:100%;height:auto;border-radius:8px}.body table{border-collapse:collapse;max-width:100%;display:block;overflow:auto}.body td,.body th{border:1px solid #cfd4dc;padding:5px 8px}.attachments,.links ul{margin:10px 0 0;padding-left:22px}.attachments a,.links a{overflow-wrap:anywhere}.attachment-status{color:#9a3412;font-size:.82rem}.reactions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.reactions span{font-size:.76rem;border:1px solid #d9dde3;border-radius:999px;padding:2px 7px;background:#f8fafc}.links{margin-top:8px;font-size:.84rem}.empty{color:#9ca3af}@media(prefers-color-scheme:dark){body{background:#17181a;color:#e8eaed}.summary,.message{background:#222326;border-color:#3a3b3e}.meta,.message time{color:#aeb4bd}.message header{border-color:#3a3b3e}.body pre,.body code{background:#2c2d31}.reactions span{background:#2c2d31;border-color:#484a50}.attachment-status{color:#fdba74}}</style></head>
<body><main><section class="summary"><h1>${escapeHtml(title || 'Teams chat')}</h1><div class="meta">Exported: ${escapeHtml(exportedAt || '')}<br>Messages: ${safeMessages.length}<br>Attachments found: ${safeRecords.length}<br>Source: <a href="${escapeHtml(sourceUrl || '')}" rel="noreferrer noopener">${escapeHtml(sourceUrl || '')}</a></div></section>${messageHtml || '<p>No messages were captured.</p>'}</main></body></html>\n`;
}

export function renderFailedAttachmentsHtml(records) {
  const failed = (Array.isArray(records) ? records : []).filter((record) => record && record.status !== 'downloaded');
  const rows = failed.map((record, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(record.status || 'failed')}</td><td>${escapeHtml(record.filename || '')}</td><td><a href="${escapeHtml(record.url || '')}" target="_blank" rel="noreferrer noopener">${escapeHtml(record.url || '')}</a></td><td>${escapeHtml(record.error || '')}</td></tr>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unavailable Teams attachments</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px;text-align:left;vertical-align:top}a{overflow-wrap:anywhere}</style></head><body><h1>Attachments not included in ZIP</h1><p>Open an original link while signed in to Microsoft 365. Browser CORS, expired permissions, Conditional Access, tenant policy, or deletion can prevent automatic download.</p><table><thead><tr><th>#</th><th>Status</th><th>Name</th><th>Original URL</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`;
}

export function renderArchiveReadme({ title, sourceUrl, exportedAt, messages, records, extensionVersion }) {
  const downloaded = records.filter((record) => record.status === 'downloaded').length;
  const failed = records.length - downloaded;
  return `Chat Exporter for Microsoft Teams — Files & ZIP\nVersion: ${extensionVersion || 'unknown'}\n\nChat: ${title}\nSource: ${sourceUrl}\nExported: ${exportedAt}\nMessages: ${messages.length}\nAttachments found: ${records.length}\nAttachments included: ${downloaded}\nNot downloaded automatically: ${failed}\n\nContents:\n- chat.html — readable offline transcript.\n- chat.md — Markdown transcript with literal text and local attachment links.\n- chat.json — structured data.\n- chat.csv — one row per message.\n- links.csv — ordinary links shared in messages.\n- attachments/ — files and images the browser could access.\n- attachments-report.csv — status of every attachment candidate.\n- failed-attachments.html — clickable links for unavailable items.\n\nLimitations:\nThe extension does not bypass Microsoft 365 permissions, CORS, Conditional Access, retention policies, or deleted files. Open failed-attachments.html while signed in to Microsoft 365 to recover files manually.\n\nMicrosoft Teams is a trademark of Microsoft Corporation. This independent extension is not affiliated with or endorsed by Microsoft.\n`;
}

// Markdown is a literal-text companion to the rich HTML transcript. Fencing
// message bodies preserves code, indentation and HTML without interpreting it.
export function renderChatMarkdown({ title, sourceUrl, exportedAt, messages, attachmentRecords } = {}) {
  const safeMessages = (Array.isArray(messages) ? messages : []).filter(Boolean);
  const records = new Map((Array.isArray(attachmentRecords) ? attachmentRecords : []).filter(Boolean).map((record) => [record.url, record]));
  const output = [`# ${markdownLabel(title || 'Teams chat')}`, '', `Exported: ${markdownLabel(exportedAt || '')}`, `Messages: ${safeMessages.length}`];
  if (sourceUrl) output.push(`Source: ${markdownLink(sourceUrl, sourceUrl)}`);
  for (const [index, message] of safeMessages.entries()) {
    const time = message.timestamp || message.timestampLabel || '';
    output.push('', `## ${index + 1}. ${markdownLabel(message.author || 'Unknown')}${time ? ` — ${markdownLabel(time)}` : ''}`, '');
    if (message.id) output.push(`Message ID: ${markdownLabel(message.id)}`, '');
    const text = String(message.text || '');
    if (text) {
      let fenceLength = 3;
      for (const match of text.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
      const fence = '`'.repeat(fenceLength);
      output.push(`${fence}text\n${text}\n${fence}`);
    } else output.push('[No text]');
    for (const attachment of message.attachments || []) {
      if (!attachment) continue;
      const record = records.get(attachment.url);
      const local = Boolean(record?.status === 'downloaded' && record.path);
      const href = local ? archivePathToHref(record.path) : attachment.url;
      const label = attachment.nameHint || record?.filename || 'attachment';
      const status = record?.status || 'not downloaded';
      output.push('', `- Attachment: ${markdownLink(label, href, local)} — ${markdownLabel(status)}${record?.error ? `: ${markdownLabel(record.error)}` : ''}`);
    }
    for (const link of message.links || []) {
      if (link) output.push('', `- Link: ${markdownLink(link.text || link.url, link.url)}`);
    }
    if (message.reactions?.length) output.push('', `Reactions: ${message.reactions.map(markdownLabel).join(', ')}`);
  }
  if (!safeMessages.length) output.push('', 'No messages were captured.');
  return `${output.join('\n')}\n`;
}

function markdownLabel(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_\[\]~]/g, '\\$&');
}

function markdownLink(label, value, local = false) {
  const text = markdownLabel(label);
  let href = String(value || '');
  if (!local) {
    try {
      const url = new URL(href);
      if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return text;
      href = url.href;
    } catch { return text; }
  }
  href = href.replace(/[<>\s]/g, (character) => encodeURIComponent(character));
  return href ? `[${text}](<${href}>)` : text;
}
