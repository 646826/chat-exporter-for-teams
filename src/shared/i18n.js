export const CONTENT_STRING_KEYS = Object.freeze([
  'overlayTitle',
  'phasePreparing',
  'statusCheckingChat',
  'phaseFindingChat',
  'statusKeepTabOpen',
  'phaseReadingHistory',
  'statusCaptureStep',
  'logEarlierMessages',
  'phaseHistoryLoaded',
  'statusHistoryLoaded',
  'phaseDownloadingAttachments',
  'statusAttachmentProgress',
  'phaseBuildingZip',
  'statusZipFiles',
  'statusZipCrc',
  'phaseReady',
  'phaseError',
  'phaseCancelled',
  'statusCancelled',
  'cancelButton',
  'cancellingButton',
  'downloadButton',
  'closeButton',
  'messagesLabel',
  'attachmentsLabel',
  'downloadedLabel',
  'errorUnsupportedPage',
  'errorChatNotFound',
  'errorScrollerNotFound',
  'errorAlreadyRunning',
  'errorCaptureLimit',
  'errorZipBuild',
  'errorDownload',
]);

export function getLocalizedContentStrings(i18nApi = globalThis.chrome && globalThis.chrome.i18n) {
  const result = {};
  for (const key of CONTENT_STRING_KEYS) {
    const value = i18nApi && typeof i18nApi.getMessage === 'function' ? i18nApi.getMessage(key) : '';
    if (value) result[key] = value;
  }
  return result;
}
