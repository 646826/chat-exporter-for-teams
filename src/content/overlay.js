import { ERROR_CODES } from '../shared/errors.js';
import { formatBytes, formatTemplate } from './utils.js';

const OVERLAY_ID = '__chat_exporter_for_teams_overlay__';

const DEFAULT_STRINGS = Object.freeze({
  overlayTitle: 'Chat Exporter', phasePreparing: 'Preparing export…', statusCheckingChat: 'Checking the open conversation.',
  phaseFindingChat: 'Finding the open chat', statusKeepTabOpen: 'Keep this Teams tab open until the archive is ready.',
  phaseReadingHistory: 'Loading chat history', statusCaptureStep: 'Step {step}: position {top} / {height}',
  logEarlierMessages: 'Teams: requested earlier messages', phaseHistoryLoaded: 'History loaded',
  statusHistoryLoaded: '{messages} messages and {attachments} attachment candidates found.',
  phaseDownloadingAttachments: 'Downloading accessible files', statusAttachmentProgress: '{current} of {total}: {filename}',
  phaseBuildingZip: 'Building ZIP', statusZipFiles: 'Files in archive: {count}', statusZipCrc: 'Checking {filename}',
  phaseReady: 'Archive ready', phaseError: 'Export stopped', phaseCancelled: 'Export cancelled',
  statusCancelled: 'No partial ZIP was created. Start the export again to retry.', cancelButton: 'Cancel export',
  cancellingButton: 'Cancelling…', downloadButton: 'Download ZIP', closeButton: 'Close', messagesLabel: 'messages',
  attachmentsLabel: 'attachments', downloadedLabel: 'downloaded',
  errorUnsupportedPage: 'Open Teams in the browser and select a chat first.',
  errorChatNotFound: 'No messages were found. Open a personal or group chat and try again.',
  errorScrollerNotFound: 'The message list could not be found. Make sure a chat—not the Files tab—is open.',
  errorAlreadyRunning: 'An export is already running in this tab.',
  errorCaptureLimit: 'The history limit was reached before the beginning of the chat could be confirmed. No partial ZIP was created.',
  errorZipBuild: 'The ZIP could not be created. Reduce attachment size or retry without files.',
  errorDownload: 'The browser could not start the ZIP download. Use the Download ZIP button.',
});

const ERROR_STRING_KEYS = Object.freeze({
  [ERROR_CODES.UNSUPPORTED_PAGE]: 'errorUnsupportedPage',
  [ERROR_CODES.CHAT_NOT_FOUND]: 'errorChatNotFound',
  [ERROR_CODES.SCROLLER_NOT_FOUND]: 'errorScrollerNotFound',
  [ERROR_CODES.EXPORT_ALREADY_RUNNING]: 'errorAlreadyRunning',
  [ERROR_CODES.CAPTURE_LIMIT_REACHED]: 'errorCaptureLimit',
  [ERROR_CODES.ZIP_LIMIT_EXCEEDED]: 'errorZipBuild',
  [ERROR_CODES.ZIP_BUILD_FAILED]: 'errorZipBuild',
  [ERROR_CODES.DOWNLOAD_FAILED]: 'errorDownload',
});

function appendElement(doc, parent, tagName, options = {}) {
  const element = doc.createElement(tagName);
  if (options.className) element.className = String(options.className);
  if (options.text != null) element.textContent = String(options.text);
  if (options.hidden) element.hidden = true;
  for (const [name, value] of Object.entries(options.attributes || {})) element.setAttribute(name, String(value));
  parent.appendChild(element);
  return element;
}

function overlayCss() {
  return `
:host{all:initial;--ce-blue:#2563eb;--ce-teal:#14b8a6;--ce-ink:#0b1220;--ce-muted:#64748b;--ce-line:#dce4ee;--ce-soft:#f4f7fb}
.panel{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(420px,calc(100vw - 36px));box-sizing:border-box;background:#fff;color:var(--ce-ink);border:1px solid var(--ce-line);border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.28);font:13px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.head{display:flex;align-items:center;gap:11px;padding:14px 16px;background:linear-gradient(180deg,#f8fbff,#f3f7fc);border-bottom:1px solid #e5ebf2}.mark{position:relative;width:30px;height:30px;border-radius:9px;background:linear-gradient(145deg,var(--ce-blue),#3b82f6);box-shadow:0 7px 16px rgba(37,99,235,.24)}.mark:before{content:"";position:absolute;left:7px;top:7px;width:14px;height:10px;border:2px solid #fff;border-radius:5px}.mark:after{content:"↓";position:absolute;right:-3px;bottom:-5px;width:17px;height:17px;display:grid;place-items:center;background:var(--ce-teal);color:#fff;border:2px solid #fff;border-radius:6px;font:800 12px/1 system-ui}.title{font-weight:780;font-size:14px;flex:1}.phase{padding:14px 16px 5px;font-weight:740;font-size:13px}.status{padding:0 16px 10px;color:#475569;overflow-wrap:anywhere}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 16px 13px}.stat{background:var(--ce-soft);border:1px solid #e7edf5;border-radius:10px;padding:8px}.stat b{display:block;font-size:14px;line-height:1.25}.stat span{font-size:9px;color:var(--ce-muted);text-transform:uppercase;letter-spacing:.055em}.bar{height:5px;background:#e9eef5;overflow:hidden}.bar>i{display:block;height:100%;width:30%;background:linear-gradient(90deg,var(--ce-blue),var(--ce-teal));animation:ce-move 1.25s linear infinite}.bar.determinate>i{animation:none}.logs{max-height:96px;overflow:auto;padding:8px 16px;color:#64748b;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;border-top:1px solid #edf1f6}.logs:empty{display:none}.actions{display:flex;justify-content:flex-end;gap:8px;padding:11px 16px 14px;border-top:1px solid #edf1f6}.actions button{border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#172033;padding:7px 11px;font:700 12px/1.2 system-ui;cursor:pointer}.actions button.primary{background:var(--ce-blue);border-color:var(--ce-blue);color:#fff}.actions button:focus-visible{outline:3px solid rgba(37,99,235,.3);outline-offset:2px}.actions button:disabled{opacity:.5;cursor:default}.error{color:#b42318}.ok{color:#087f6f}@keyframes ce-move{from{transform:translateX(-120%)}to{transform:translateX(360%)}}
@media(prefers-color-scheme:dark){:host{--ce-ink:#f8fafc;--ce-muted:#a7b2c1;--ce-line:#334155;--ce-soft:#172235}.panel{background:#101826;color:var(--ce-ink);border-color:var(--ce-line)}.head{background:linear-gradient(180deg,#182437,#152033);border-color:#2d3b50}.status,.logs,.stat span{color:#aab5c3}.stat{background:#172235;border-color:#29384d}.bar{background:#2a384d}.actions,.logs{border-color:#2d3b50}.actions button{background:#172235;color:#f8fafc;border-color:#43516a}.mark:after{border-color:#101826}}
`;
}

export function createProgressOverlay(onCancel, localizedStrings = {}, doc = document) {
  const existing = doc.getElementById(OVERLAY_ID);
  if (existing) {
    if (typeof existing.__chatExporterCleanup === 'function') existing.__chatExporterCleanup();
    existing.remove();
  }
  const strings = { ...DEFAULT_STRINGS, ...(localizedStrings || {}) };
  const text = (key, values) => formatTemplate(strings[key] || DEFAULT_STRINGS[key] || key, values);
  const host = doc.createElement('div');
  host.id = OVERLAY_ID;
  const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  const css = overlayCss();
  if (shadow.adoptedStyleSheets && typeof CSSStyleSheet === 'function') {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
    } catch {
      const style = appendElement(doc, shadow, 'style');
      style.textContent = css;
    }
  } else {
    const style = appendElement(doc, shadow, 'style');
    style.textContent = css;
  }

  const panel = appendElement(doc, shadow, 'section', { className: 'panel', attributes: { role: 'dialog', 'aria-labelledby': `${OVERLAY_ID}_title` } });
  const head = appendElement(doc, panel, 'header', { className: 'head' });
  appendElement(doc, head, 'span', { className: 'mark', attributes: { 'aria-hidden': 'true' } });
  appendElement(doc, head, 'div', { className: 'title', text: text('overlayTitle'), attributes: { id: `${OVERLAY_ID}_title` } });
  const bar = appendElement(doc, panel, 'div', { className: 'bar', attributes: { role: 'progressbar', 'aria-label': text('phasePreparing') } });
  const barFill = appendElement(doc, bar, 'i');
  const live = appendElement(doc, panel, 'div', { attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const phase = appendElement(doc, live, 'div', { className: 'phase', text: text('phasePreparing') });
  const status = appendElement(doc, live, 'div', { className: 'status', text: text('statusCheckingChat') });
  const stats = appendElement(doc, panel, 'div', { className: 'stats' });

  function appendStat(key, value, label) {
    const stat = appendElement(doc, stats, 'div', { className: 'stat' });
    const valueElement = appendElement(doc, stat, 'b', { text: value, attributes: { 'data-value': key } });
    appendElement(doc, stat, 'span', { text: label });
    return valueElement;
  }

  const messagesValue = appendStat('messages', '0', text('messagesLabel'));
  const attachmentsValue = appendStat('attachments', '0', text('attachmentsLabel'));
  const bytesValue = appendStat('bytes', '0 B', text('downloadedLabel'));
  const logs = appendElement(doc, panel, 'div', { className: 'logs' });
  const actions = appendElement(doc, panel, 'div', { className: 'actions' });
  const cancelButton = appendElement(doc, actions, 'button', { text: text('cancelButton'), attributes: { type: 'button', 'data-action': 'cancel' } });
  const downloadButton = appendElement(doc, actions, 'button', { className: 'primary', text: text('downloadButton'), hidden: true, attributes: { type: 'button', 'data-action': 'download' } });
  const closeButton = appendElement(doc, actions, 'button', { text: text('closeButton'), hidden: true, attributes: { type: 'button', 'data-action': 'close' } });
  doc.documentElement.appendChild(host);

  let objectUrl = '';
  let downloadName = '';
  function cleanup() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  host.__chatExporterCleanup = cleanup;

  function triggerDownload() {
    if (!objectUrl) return false;
    try {
      const anchor = doc.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      anchor.style.display = 'none';
      (doc.body || doc.documentElement).appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }

  cancelButton.addEventListener('click', () => {
    cancelButton.disabled = true;
    cancelButton.textContent = text('cancellingButton');
    if (typeof onCancel === 'function') onCancel();
  });
  closeButton.addEventListener('click', () => { cleanup(); host.remove(); });
  downloadButton.addEventListener('click', () => triggerDownload());

  return {
    host,
    text,
    update(values = {}) {
      if (values.phase != null) phase.textContent = String(values.phase);
      if (values.status != null) status.textContent = String(values.status);
      if (values.messages != null) messagesValue.textContent = String(values.messages);
      if (values.attachments != null) attachmentsValue.textContent = String(values.attachments);
      if (values.bytes != null) bytesValue.textContent = formatBytes(values.bytes);
      if (Number.isFinite(values.progress)) {
        const percent = Math.max(0, Math.min(100, values.progress * 100));
        bar.classList.add('determinate');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', String(Math.round(percent)));
        barFill.style.width = `${percent}%`;
        barFill.style.transform = 'none';
      } else {
        bar.classList.remove('determinate');
        bar.removeAttribute('aria-valuenow');
        barFill.style.width = '30%';
      }
    },
    log(message) {
      const line = doc.createElement('div');
      line.textContent = String(message || '');
      logs.appendChild(line);
      while (logs.childElementCount > 7) logs.firstElementChild.remove();
      logs.scrollTop = logs.scrollHeight;
    },
    setError(error) {
      const key = ERROR_STRING_KEYS[error && error.code];
      phase.textContent = text('phaseError');
      phase.className = 'phase error';
      status.textContent = key ? text(key) : String(error && error.message || error || 'Unknown error');
      bar.classList.add('determinate');
      bar.setAttribute('aria-valuenow', '100');
      barFill.style.width = '100%';
      cancelButton.hidden = true;
      downloadButton.hidden = true;
      closeButton.hidden = false;
    },
    setCancelled() {
      phase.textContent = text('phaseCancelled');
      status.textContent = text('statusCancelled');
      bar.classList.add('determinate');
      bar.setAttribute('aria-valuenow', '100');
      barFill.style.width = '100%';
      cancelButton.hidden = true;
      downloadButton.hidden = true;
      closeButton.hidden = false;
    },
    setDownload(blob, filename, autoDownload) {
      cleanup();
      objectUrl = URL.createObjectURL(blob);
      downloadName = filename;
      downloadButton.hidden = false;
      closeButton.hidden = false;
      cancelButton.hidden = true;
      phase.textContent = text('phaseReady');
      phase.className = 'phase ok';
      status.textContent = `${filename} · ${formatBytes(blob.size)}`;
      bar.classList.add('determinate');
      bar.setAttribute('aria-valuenow', '100');
      barFill.style.width = '100%';
      if (autoDownload && !triggerDownload()) status.textContent = text('errorDownload');
    },
    close() { cleanup(); host.remove(); },
  };
}
