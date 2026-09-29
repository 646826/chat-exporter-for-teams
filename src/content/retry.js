import { sleep, throwIfAborted } from './utils.js';

export function retryDelayMs(retryAfter, attempt, baseDelayMs = 500, now = Date.now()) {
  const text = String(retryAfter || '').trim();
  const requested = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 1000 : Math.max(0, Date.parse(text) - now) || 0;
  return Math.min(30000, Math.max(Math.max(1, Number(baseDelayMs) || 500) * (2 ** attempt), requested));
}

// Cancellation is cleanup, not part of the download's completion contract.
// A custom stream may never settle its cancel promise; never wait for it.
export function discardResponseBody(body, reason) {
  if (!body || typeof body.cancel !== 'function') return;
  try { Promise.resolve(body.cancel(reason)).catch(() => {}); } catch {}
}

// Page code can wrap fetch and fail to propagate AbortSignal. Keep the export
// deadline authoritative and dispose of any response that arrives after abort.
function fetchUntilAbort(url, init) {
  const operation = fetch(url, init);
  const signal = init.signal;
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(operation).then((response) => {
      if (settled) { discardResponseBody(response?.body); return; }
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(response);
    }, (error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
    if (signal.aborted) onAbort();
  });
}

// Retry only transient HTTP/network failures. Permanent authorization and
// missing-file responses are returned unchanged for normal diagnostics.
export async function fetchWithRetry(url, init, config = {}, attempts = []) {
  const retries = Math.max(0, Math.min(3, Number(config.attachmentRetries ?? 2) || 0));
  for (let attempt = 0; ; attempt += 1) {
    throwIfAborted(init.signal);
    attempts.push(url);
    let response;
    try {
      response = await fetchUntilAbort(url, init);
    } catch (error) {
      throwIfAborted(init.signal);
      if (!/^https?:/i.test(String(url)) || !(error instanceof TypeError) || attempt >= retries) throw error;
      await sleep(retryDelayMs('', attempt, config.attachmentRetryDelayMs), init.signal);
      continue;
    }
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt >= retries) return response;
    const delay = retryDelayMs(response.headers.get('retry-after'), attempt, config.attachmentRetryDelayMs);
    discardResponseBody(response.body);
    await sleep(delay, init.signal);
  }
}
