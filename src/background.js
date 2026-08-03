import { ERROR_CODES, toPublicError } from './shared/errors.js';
import { getLocalizedContentStrings } from './shared/i18n.js';
import { MESSAGE_TYPES } from './shared/messages.js';
import { sanitizeUserOptions } from './shared/options.js';
import { urlIsSupported } from './shared/urls.js';

const injectionsInProgress = new Set();

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function inspectTeamsPage() {
  const selectors = [
    '[data-tid="chat-pane-message"][data-mid]',
    '[data-tid="chat-pane-message"]',
    '[data-tid="message-list-item"]',
    'div[role="listitem"][data-mid]',
  ];
  const nodes = new Set();
  for (const selector of selectors) {
    for (const node of document.querySelectorAll(selector)) nodes.add(node);
  }
  const titleSelectors = [
    '[data-tid="chat-header-title"]',
    '[data-tid="chat-title"]',
    '[data-tid="conversation-header"] h1',
    '[data-tid="conversation-header"] h2',
  ];
  let chatTitle = '';
  for (const selector of titleSelectors) {
    const node = document.querySelector(selector);
    const text = String(node && node.textContent || '').trim();
    if (text) {
      chatTitle = text;
      break;
    }
  }
  return { chatDetected: nodes.size > 0, messageCount: nodes.size, chatTitle };
}

function startInjectedExporter(payload) {
  const api = window.__CHAT_EXPORTER_FOR_TEAMS__;
  if (!api || typeof api.start !== 'function') {
    return { ok: false, code: 'INJECTION_FAILED', message: 'The exporter bundle did not initialize.' };
  }
  if (typeof api.isRunning === 'function' && api.isRunning()) {
    return { ok: false, code: 'EXPORT_ALREADY_RUNNING', message: 'An export is already running in this tab.' };
  }
  const task = api.start(payload);
  if (task && typeof task.catch === 'function') {
    task.catch((error) => console.error('[Chat Exporter for Teams]', error));
  }
  return { ok: true };
}

async function checkPage() {
  const tab = await getActiveTab();
  if (!tab || !Number.isInteger(tab.id) || !urlIsSupported(tab.url)) {
    return { ok: true, supported: false, chatDetected: false, messageCount: 0 };
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: inspectTeamsPage,
      world: 'ISOLATED',
    });
    return {
      ok: true,
      supported: true,
      chatDetected: Boolean(result && result.result && result.result.chatDetected),
      messageCount: Number(result && result.result && result.result.messageCount) || 0,
      chatTitle: String(result && result.result && result.result.chatTitle || ''),
    };
  } catch (error) {
    return { ok: true, supported: true, chatDetected: false, messageCount: 0, warning: String(error && error.message || error) };
  }
}

async function startExport(rawOptions) {
  const tab = await getActiveTab();
  if (!tab || !Number.isInteger(tab.id) || !urlIsSupported(tab.url)) {
    return { ok: false, code: ERROR_CODES.UNSUPPORTED_PAGE, message: chrome.i18n.getMessage('errorUnsupportedPage') };
  }
  if (injectionsInProgress.has(tab.id)) {
    return { ok: false, code: ERROR_CODES.EXPORT_ALREADY_RUNNING, message: chrome.i18n.getMessage('errorAlreadyRunning') };
  }

  injectionsInProgress.add(tab.id);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
      world: 'MAIN',
    });
    const options = sanitizeUserOptions(rawOptions);
    const payload = {
      includeAttachments: options.includeAttachments,
      strings: getLocalizedContentStrings(),
      extensionVersion: chrome.runtime.getManifest().version,
    };
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: startInjectedExporter,
      args: [payload],
      world: 'MAIN',
    });
    const response = result && result.result;
    if (!response || response.ok !== true) {
      return response || { ok: false, code: ERROR_CODES.INJECTION_FAILED, message: chrome.i18n.getMessage('errorInjectionFailed') };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, ...toPublicError(error), code: ERROR_CODES.INJECTION_FAILED };
  } finally {
    injectionsInProgress.delete(tab.id);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message && message.type;
  const task = type === MESSAGE_TYPES.CHECK_PAGE
    ? checkPage()
    : type === MESSAGE_TYPES.START_EXPORT
      ? startExport(message.options)
      : Promise.resolve({ ok: false, code: ERROR_CODES.UNKNOWN, message: 'Unknown request.' });
  task.then(sendResponse, (error) => sendResponse({ ok: false, ...toPublicError(error) }));
  return true;
});
