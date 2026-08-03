import { MESSAGE_TYPES } from '../shared/messages.js';
import { DEFAULT_USER_OPTIONS, sanitizeUserOptions } from '../shared/options.js';
import { createPopupView } from './view.js';

const POPUP_STRING_KEYS = [
  'popupTitle', 'popupSubtitle', 'checkingTitle', 'checkingDetail', 'disclosureTitle', 'disclosureDetail',
  'disclosureText', 'continueButton', 'chatDetected', 'currentConversation', 'includeAttachments',
  'exportButton', 'localOnly', 'openChatTitle', 'openChatDetail', 'openTeamsButton', 'exportStartingTitle',
  'exportStartingDetail', 'errorTitle', 'errorGeneric',
];

function getStrings() {
  return Object.fromEntries(POPUP_STRING_KEYS.map((key) => [key, chrome.i18n.getMessage(key) || key]));
}

async function initPopup() {
  const strings = getStrings();
  const view = createPopupView(document, strings);
  const stored = await chrome.storage.local.get(DEFAULT_USER_OPTIONS);
  let options = sanitizeUserOptions(stored);
  view.elements.includeAttachments.checked = options.includeAttachments;

  async function saveOptions() {
    options = sanitizeUserOptions({
      ...options,
      includeAttachments: view.elements.includeAttachments.checked,
    });
    await chrome.storage.local.set(options);
  }

  async function checkCurrentPage() {
    view.resetPrimaryClass();
    view.showLoading();
    const result = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHECK_PAGE });
    if (!result || result.ok !== true) {
      view.showError(result && result.message);
      return 'error';
    }
    if (!result.supported || !result.chatDetected) {
      view.showUnsupported();
      return 'unsupported';
    }
    view.showSupported(result.chatTitle);
    return 'supported';
  }

  let mode = options.disclosureAccepted ? await checkCurrentPage() : 'disclosure';
  if (mode === 'disclosure') view.showDisclosure();

  view.elements.includeAttachments.addEventListener('change', () => {
    saveOptions().catch((error) => view.showError(error.message));
  });

  view.elements.primaryButton.addEventListener('click', async () => {
    try {
      if (mode === 'disclosure') {
        options.disclosureAccepted = true;
        await chrome.storage.local.set(options);
        mode = await checkCurrentPage();
        return;
      }
      if (mode === 'unsupported') {
        await chrome.tabs.create({ url: 'https://teams.cloud.microsoft/' });
        return;
      }
      if (mode !== 'supported') return;
      await saveOptions();
      view.showStarting();
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.START_EXPORT,
        options: { includeAttachments: options.includeAttachments },
      });
      if (!response || response.ok !== true) {
        view.showError(response && response.message);
        return;
      }
      setTimeout(() => window.close(), 280);
    } catch (error) {
      view.showError(error && error.message);
    }
  });
}

if (globalThis.chrome && chrome.runtime && chrome.storage && typeof document !== 'undefined') {
  initPopup().catch((error) => console.error('[Chat Exporter popup]', error));
}

export { initPopup };
