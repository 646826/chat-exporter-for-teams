import { sleep, throwIfAborted } from './utils.js';

export function retryDelayMs(retryAfter, attempt, baseDelayMs = 500, now = Date.now()) {
  const text = String(retryAfter || '').trim();
  const requested = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 1000 : Math.max(0, Date.parse(text) - now) || 0;
  return Math.min(30000, Math.max(Math.max(1, Number(baseDelayMs) || 500) * (2 ** attempt), requested));
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
      response = await fetch(url, init);
    } catch (error) {
      throwIfAborted(init.signal);
      if (!(error instanceof TypeError) || attempt >= retries) throw error;
      await sleep(retryDelayMs('', attempt, config.attachmentRetryDelayMs), init.signal);
      continue;
    }
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt >= retries) return response;
    const delay = retryDelayMs(response.headers.get('retry-after'), attempt, config.attachmentRetryDelayMs);
    if (response.body) await response.body.cancel().catch(() => {});
    await sleep(delay, init.signal);
  }
}
