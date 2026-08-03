const API_ROOT = 'https://chromewebstore.googleapis.com';
const IN_PROGRESS_STATES = new Set(['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']);
const SUCCESS_STATES = new Set(['SUCCEEDED']);
const FAILURE_STATES = new Set(['FAILED', 'NOT_FOUND']);
const PUBLISH_TYPES = new Set(['UPLOAD_ONLY', 'DEFAULT_PUBLISH', 'STAGED_PUBLISH']);

function requireIdentifier(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new TypeError(`Invalid ${label.toLowerCase()}.`);
  return text;
}

export function buildItemName(publisherId, extensionId) {
  const publisher = requireIdentifier(publisherId, 'Publisher ID');
  const extension = requireIdentifier(extensionId, 'Extension ID');
  return `publishers/${publisher}/items/${extension}`;
}

function collectApiDetails(payload) {
  const error = payload && payload.error;
  if (!error) return '';
  const details = Array.isArray(error.details)
    ? error.details.flatMap((detail) => [detail && detail.reason, detail && detail.description, detail && detail.message]).filter(Boolean)
    : [];
  return [error.message, error.status, ...details].filter(Boolean).join(' · ');
}

export async function cwsRequest(url, options = {}) {
  const {
    accessToken,
    fetchImpl = globalThis.fetch,
    method = 'GET',
    headers = {},
    body,
  } = options;
  if (!String(accessToken || '').trim()) throw new TypeError('Chrome Web Store access token is required.');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required.');

  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  });
  const raw = await response.text();
  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }
  }
  if (!response.ok) {
    const detail = collectApiDetails(payload) || raw || `${response.status} ${response.statusText}`.trim();
    const error = new Error(`Chrome Web Store API ${response.status}: ${detail}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizedUploadState(value) {
  return String(value || '').trim().toUpperCase();
}

export async function waitForUpload(options = {}) {
  const {
    accessToken,
    itemName,
    initialState,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    nowImpl = Date.now,
    pollIntervalMs = 3000,
    timeoutMs = 180000,
  } = options;
  const name = String(itemName || '').trim();
  if (!/^publishers\/[A-Za-z0-9_-]+\/items\/[A-Za-z0-9_-]+$/.test(name)) throw new TypeError('A valid item name is required.');

  let state = normalizedUploadState(initialState);
  if (SUCCESS_STATES.has(state)) return { lastAsyncUploadState: state };
  if (FAILURE_STATES.has(state)) throw new Error(`Chrome Web Store upload failed with state ${state}.`);
  if (!IN_PROGRESS_STATES.has(state)) throw new Error(`Unexpected Chrome Web Store upload state: ${state || 'empty'}.`);

  const startedAt = nowImpl();
  while (nowImpl() - startedAt <= timeoutMs) {
    await sleepImpl(pollIntervalMs);
    const status = await cwsRequest(`${API_ROOT}/v2/${name}:fetchStatus`, { accessToken, fetchImpl });
    state = normalizedUploadState(status.lastAsyncUploadState);
    if (SUCCESS_STATES.has(state)) return status;
    if (FAILURE_STATES.has(state)) throw new Error(`Chrome Web Store upload failed with state ${state}.`);
    if (!IN_PROGRESS_STATES.has(state)) throw new Error(`Unexpected Chrome Web Store upload state: ${state || 'empty'}.`);
  }
  throw new Error(`Chrome Web Store upload timed out after ${timeoutMs} ms.`);
}

export async function uploadPackage(options = {}) {
  const {
    accessToken,
    publisherId,
    extensionId,
    packageBytes,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    nowImpl = Date.now,
    pollIntervalMs,
    timeoutMs,
  } = options;
  const itemName = buildItemName(publisherId, extensionId);
  if (!(packageBytes instanceof Uint8Array) && !Buffer.isBuffer(packageBytes)) {
    throw new TypeError('packageBytes must be a Buffer or Uint8Array.');
  }
  if (!packageBytes.byteLength) throw new TypeError('The Chrome Web Store package is empty.');

  const upload = await cwsRequest(`${API_ROOT}/upload/v2/${itemName}:upload`, {
    accessToken,
    fetchImpl,
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: packageBytes,
  });
  const state = normalizedUploadState(upload.uploadState);
  if (SUCCESS_STATES.has(state)) return upload;
  if (FAILURE_STATES.has(state)) throw new Error(`Chrome Web Store upload failed with state ${state}.`);
  const status = await waitForUpload({
    accessToken,
    itemName,
    initialState: state,
    fetchImpl,
    sleepImpl,
    nowImpl,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { ...upload, ...status, uploadState: normalizedUploadState(status.lastAsyncUploadState) };
}

export async function publishItem(options = {}) {
  const {
    accessToken,
    itemName,
    publishType = 'DEFAULT_PUBLISH',
    skipReview = false,
    fetchImpl = globalThis.fetch,
  } = options;
  const type = String(publishType || '').trim().toUpperCase();
  if (!['DEFAULT_PUBLISH', 'STAGED_PUBLISH'].includes(type)) {
    throw new TypeError(`Unsupported publish type: ${publishType}.`);
  }
  return cwsRequest(`${API_ROOT}/v2/${itemName}:publish`, {
    accessToken,
    fetchImpl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publishType: type,
      skipReview: Boolean(skipReview),
      blockOnWarnings: true,
    }),
  });
}

export async function releaseToChromeWebStore(options = {}) {
  const publishType = String(options.publishType || 'UPLOAD_ONLY').trim().toUpperCase();
  if (!PUBLISH_TYPES.has(publishType)) throw new TypeError(`Unsupported publish type: ${options.publishType}.`);
  const itemName = buildItemName(options.publisherId, options.extensionId);
  const upload = await uploadPackage(options);
  if (publishType === 'UPLOAD_ONLY') {
    return {
      itemName,
      publishType,
      chromeWebStoreUpload: 'SUCCEEDED',
      publishSubmission: 'SKIPPED',
      upload,
      publish: null,
    };
  }
  const publish = await publishItem({
    accessToken: options.accessToken,
    itemName,
    publishType,
    skipReview: Boolean(options.skipReview),
    fetchImpl: options.fetchImpl,
  });
  return {
    itemName,
    publishType,
    chromeWebStoreUpload: 'SUCCEEDED',
    publishSubmission: 'REQUESTED',
    upload,
    publish,
  };
}
