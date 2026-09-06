import { richerText } from './utils.js';

export function dedupeItemsByUrl(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item) continue;
    const url = String(item.url || '').trim();
    const key = url || JSON.stringify(item);
    if (!key) continue;
    const previous = map.get(key);
    map.set(key, previous ? { ...previous, ...item, nameHint: item.nameHint || previous.nameHint } : { ...item });
  }
  return [...map.values()];
}

export function dedupeStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

export function dedupeMessages(messages) {
  const result = [];
  const byKey = new Map();
  for (const source of Array.isArray(messages) ? messages : []) {
    if (!source) continue;
    const key = String(source.id || '').trim() || `${source.timestampMs || source.timestamp || ''}|${source.author || ''}|${source.text || ''}`;
    if (!key) continue;
    if (!byKey.has(key)) {
      const clone = {
        ...source,
        attachments: dedupeItemsByUrl(source.attachments),
        links: dedupeItemsByUrl(source.links),
        reactions: dedupeStrings(source.reactions),
      };
      byKey.set(key, clone);
      result.push(clone);
      continue;
    }
    const target = byKey.get(key);
    if ((!target.author || /^unknown$/i.test(target.author)) && source.author && !/^unknown$/i.test(source.author)) target.author = source.author;
    target.text = richerText(target.text, source.text);
    target.html = richerText(target.html, source.html);
    target.timestamp = target.timestamp || source.timestamp;
    target.timestampLabel = target.timestampLabel || source.timestampLabel;
    target.timestampMs = Number.isFinite(target.timestampMs) ? target.timestampMs : source.timestampMs;
    target.attachments = dedupeItemsByUrl([...(target.attachments || []), ...(source.attachments || [])]);
    target.links = dedupeItemsByUrl([...(target.links || []), ...(source.links || [])]);
    target.reactions = dedupeStrings([...(target.reactions || []), ...(source.reactions || [])]);
    if (Number.isFinite(source.captureOrder)) target.captureOrder = Number.isFinite(target.captureOrder) ? Math.min(target.captureOrder, source.captureOrder) : source.captureOrder;
  }
  return result;
}

export function mergeCapturedMessage(messageMap, message) {
  const current = messageMap.get(message.id);
  if (!current) {
    messageMap.set(message.id, message);
    return true;
  }
  messageMap.set(message.id, dedupeMessages([current, message])[0]);
  return false;
}

export function numericMessageTime(message) {
  if (Number.isFinite(message && message.timestampMs)) return Number(message.timestampMs);
  const match = String(message && message.id || '').match(/(?:^|\D)(\d{10,13})(?:\D|$)/);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  return match[1].length === 10 ? raw * 1000 : raw;
}

export function sortMessagesChronologically(messages) {
  return (Array.isArray(messages) ? messages : [])
    // Parse fallback ID timestamps once per message, not on every comparison.
    .map((message, stableIndex) => ({ message, stableIndex, time: numericMessageTime(message) }))
    .sort((left, right) => {
      const leftTime = left.time;
      const rightTime = right.time;
      if (leftTime != null && rightTime != null && leftTime !== rightTime) return leftTime - rightTime;
      if (leftTime != null && rightTime == null) return -1;
      if (leftTime == null && rightTime != null) return 1;
      const leftBatch = Number.isFinite(left.message.captureBatch) ? left.message.captureBatch : null;
      const rightBatch = Number.isFinite(right.message.captureBatch) ? right.message.captureBatch : null;
      if (leftBatch != null && rightBatch != null && leftBatch !== rightBatch) return rightBatch - leftBatch;
      const leftDom = Number.isFinite(left.message.domIndex) ? left.message.domIndex : null;
      const rightDom = Number.isFinite(right.message.domIndex) ? right.message.domIndex : null;
      if (leftDom != null && rightDom != null && leftDom !== rightDom) return leftDom - rightDom;
      return left.stableIndex - right.stableIndex;
    })
    .map(({ message }) => message);
}
