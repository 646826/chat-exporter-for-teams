import { archivePathToHref, classifyAttachmentUrl, filenameHintFromUrl, resolveSafeUrl } from '../shared/urls.js';
import { isLikelyAttachmentCandidate } from './attachments.js';
import { dedupeItemsByUrl, dedupeStrings } from './model.js';
import { fnv1a, getAttributeSafe, normalizedText, querySelectorAllSafe, querySelectorSafe, sanitizeFilename } from './utils.js';

export const MESSAGE_SELECTORS = Object.freeze([
  '[data-tid="chat-pane-message"][data-mid]',
  '[data-tid="chat-pane-message"]',
  '[data-tid="message-list-item"]',
  '[data-tid="message-group-container"] [data-mid]',
  'div[role="listitem"][data-mid]',
  'div[role="listitem"]',
]);

export const SCROLLER_SELECTORS = Object.freeze([
  '[data-tid="message-pane-list-viewport"]',
  '[data-tid="thread-body-scrollable-content"]',
  '[data-tid="chat-pane-message-list"]',
  '[data-tid="scrollable-thread-body"]',
  'div[role="log"][aria-label*="message" i]',
  'div[role="list"][aria-label*="message" i]',
  '[data-tid="message-pane"]',
  '[data-tid="thread-view"]',
]);

const CONTENT_SELECTORS = Object.freeze([
  '[id^="content-"]',
  '[data-tid="message-content"]',
  '[data-tid="message-body"]',
  '[data-tid="bubble-text"]',
  '[data-tid^="message-content-"]',
  '[data-tid^="messageBody"]',
  '[role="document"]',
  '.ts-message-content',
  '.message-body',
  '.ui-chat__messagecontent',
]);

export function messageIdFromElement(element) {
  if (!element) return '';
  const attributes = ['data-mid', 'data-message-id', 'data-messageid', 'data-item-key', 'data-id'];
  for (const name of attributes) {
    const value = getAttributeSafe(element, name);
    if (value) return value;
  }
  for (const selector of ['[data-mid]', '[data-message-id]', '[data-messageid]']) {
    const nested = querySelectorSafe(element, selector);
    if (!nested || nested === element) continue;
    for (const name of attributes) {
      const value = getAttributeSafe(nested, name);
      if (value) return value;
    }
  }
  const ownId = String(element.id || '').trim();
  if (ownId) return ownId;
  const labelledBy = getAttributeSafe(element, 'aria-labelledby');
  const labelledMatch = labelledBy.match(/(?:author|timestamp|content)-([^\s]+)/i);
  return labelledMatch ? labelledMatch[1] : '';
}

export function parseTimestampValue(value) {
  const label = String(value || '').trim();
  if (!label) return null;
  const ms = Date.parse(label);
  if (!Number.isFinite(ms)) return { iso: '', ms: null, label };
  return { iso: new Date(ms).toISOString(), ms, label };
}

export function timestampFromElement(element, messageId = '') {
  const selectors = [
    'time[datetime]', '[id^="timestamp-"][datetime]', '[data-tid="message-timestamp"][datetime]',
    '[data-tid="message-time"][datetime]', '[data-tid="message-timestamp"]', '[data-tid="message-time"]', 'time',
  ];
  for (const selector of selectors) {
    const candidate = querySelectorSafe(element, selector);
    if (!candidate) continue;
    const raw = getAttributeSafe(candidate, 'datetime') || getAttributeSafe(candidate, 'title') || getAttributeSafe(candidate, 'aria-label') || String(candidate.textContent || '').trim();
    const parsed = parseTimestampValue(raw);
    if (parsed) return parsed;
  }
  const numeric = String(messageId || '').match(/(?:^|\D)(\d{13})(?:\D|$)/);
  if (numeric) {
    const ms = Number(numeric[1]);
    if (Number.isFinite(ms)) return { iso: new Date(ms).toISOString(), ms, label: new Date(ms).toISOString() };
  }
  const seconds = String(messageId || '').match(/(?:^|\D)(\d{10})(?:\D|$)/);
  if (seconds) {
    const ms = Number(seconds[1]) * 1000;
    if (Number.isFinite(ms)) return { iso: new Date(ms).toISOString(), ms, label: new Date(ms).toISOString() };
  }
  return { iso: '', ms: null, label: '' };
}

export function findMessageNodes(rootNode) {
  const root = rootNode || (typeof document !== 'undefined' ? document : null);
  if (!root) return [];
  const candidates = [];
  for (const selector of MESSAGE_SELECTORS) {
    const found = querySelectorAllSafe(root, selector);
    if (found.length) candidates.push(...found);
    if (found.length >= 2 && selector.includes('chat-pane-message')) break;
  }
  const unique = [...new Set(candidates)];
  return unique.filter((node) => {
    if (!node) return false;
    const id = messageIdFromElement(node);
    return !unique.some((other) => other !== node && typeof other.contains === 'function' && other.contains(node) && id && messageIdFromElement(other) === id);
  });
}

export function isScrollableElement(element) {
  if (!element || typeof element.scrollHeight !== 'number' || typeof element.clientHeight !== 'number') return false;
  if (element.scrollHeight <= element.clientHeight + 20) return false;
  if (typeof getComputedStyle !== 'function') return true;
  const style = getComputedStyle(element);
  return /(?:auto|scroll|overlay)/i.test(`${style.overflowY} ${style.overflow}`);
}

export function findScrollContainer(rootNode) {
  const root = rootNode || (typeof document !== 'undefined' ? document : null);
  if (!root) return null;
  const candidates = [];
  for (const selector of SCROLLER_SELECTORS) candidates.push(...querySelectorAllSafe(root, selector));
  const firstMessage = findMessageNodes(root)[0];
  let parent = firstMessage && firstMessage.parentElement;
  while (parent) {
    candidates.push(parent);
    parent = parent.parentElement;
  }
  let best = null;
  let bestScore = -1;
  for (const candidate of [...new Set(candidates)]) {
    if (!isScrollableElement(candidate)) continue;
    const messageCount = findMessageNodes(candidate).length;
    const overflow = Math.max(0, candidate.scrollHeight - candidate.clientHeight);
    const score = messageCount * 1_000_000 + Math.min(overflow, 999_999);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function closestContextText(element, stopAt) {
  const parts = [];
  let current = element;
  let depth = 0;
  while (current && current !== stopAt && depth < 6) {
    parts.push(getAttributeSafe(current, 'data-tid'), getAttributeSafe(current, 'class'), getAttributeSafe(current, 'role'), getAttributeSafe(current, 'aria-label'), getAttributeSafe(current, 'title'));
    current = current.parentElement;
    depth += 1;
  }
  return parts.filter(Boolean).join(' ');
}

function readElementDimensions(element) {
  return {
    width: Number(element && (element.naturalWidth || element.videoWidth || element.width || getAttributeSafe(element, 'width'))) || 0,
    height: Number(element && (element.naturalHeight || element.videoHeight || element.height || getAttributeSafe(element, 'height'))) || 0,
  };
}

export function collectMessageUrls(messageNode, contentNode) {
  const attachments = [];
  const links = [];
  const scope = messageNode || contentNode;
  if (!scope) return { attachments: [], links: [] };
  const base = typeof location !== 'undefined' ? location.href : 'https://teams.cloud.microsoft/';

  function pushCandidate(element, rawUrl, kind, extra = {}) {
    const url = resolveSafeUrl(rawUrl, base, { allowBlob: true, allowData: true });
    if (!url) return;
    const context = closestContextText(element, messageNode && messageNode.parentElement);
    const candidate = {
      url,
      kind,
      download: Boolean(getAttributeSafe(element, 'download')),
      isFileCard: /(?:file|attachment|document|media-card|image-card|video-card|recording)/i.test(context),
      isMedia: /^(?:image|video|audio|source|poster)$/i.test(kind),
      dataTid: `${getAttributeSafe(element, 'data-tid')} ${context}`.trim(),
      className: getAttributeSafe(element, 'class'),
      role: getAttributeSafe(element, 'role'),
      alt: getAttributeSafe(element, 'alt'),
      title: getAttributeSafe(element, 'title') || getAttributeSafe(element, 'aria-label'),
      nameHint: sanitizeFilename(getAttributeSafe(element, 'download') || getAttributeSafe(element, 'aria-label') || getAttributeSafe(element, 'title') || getAttributeSafe(element, 'alt') || String(element && element.textContent || '').trim() || filenameHintFromUrl(url) || kind || 'attachment'),
      ...readElementDimensions(element),
      ...extra,
    };
    if (isLikelyAttachmentCandidate(candidate)) attachments.push(candidate);
    else if (classifyAttachmentUrl(url, candidate) === 'link') links.push({ url, text: String(element && element.textContent || '').trim() });
  }

  for (const anchor of querySelectorAllSafe(scope, 'a[href]')) pushCandidate(anchor, getAttributeSafe(anchor, 'href'), 'link');
  for (const image of querySelectorAllSafe(scope, 'img')) {
    const source = getAttributeSafe(image, 'data-gallery-src') || getAttributeSafe(image, 'data-orig-src') || getAttributeSafe(image, 'data-original-src') || getAttributeSafe(image, 'data-src') || getAttributeSafe(image, 'src');
    pushCandidate(image, source, 'image');
  }
  for (const video of querySelectorAllSafe(scope, 'video')) {
    pushCandidate(video, getAttributeSafe(video, 'src'), 'video');
    pushCandidate(video, getAttributeSafe(video, 'poster'), 'poster');
  }
  for (const audio of querySelectorAllSafe(scope, 'audio')) pushCandidate(audio, getAttributeSafe(audio, 'src'), 'audio');
  for (const source of querySelectorAllSafe(scope, 'source[src]')) pushCandidate(source, getAttributeSafe(source, 'src'), 'source');

  const dataAttributes = ['data-url', 'data-download-url', 'data-file-url', 'data-content-url', 'data-gallery-src', 'data-orig-src', 'data-original-src', 'data-src'];
  for (const element of querySelectorAllSafe(scope, dataAttributes.map((name) => `[${name}]`).join(','))) {
    for (const name of dataAttributes) {
      const value = getAttributeSafe(element, name);
      if (value) pushCandidate(element, value, /image/i.test(name) ? 'image' : 'data-url');
    }
  }
  return { attachments: dedupeItemsByUrl(attachments), links: dedupeItemsByUrl(links) };
}

export function findContentElement(messageNode) {
  for (const selector of CONTENT_SELECTORS) {
    const candidate = querySelectorSafe(messageNode, selector);
    if (candidate) return candidate;
  }
  return null;
}

const ACTIVE_CONTENT_SELECTOR = 'script,style,link,meta,base,iframe,object,embed,form,input,button,select,textarea,noscript';
const SAFE_ATTRIBUTES = new Set(['alt', 'title', 'dir', 'lang', 'colspan', 'rowspan', 'scope', 'start', 'value', 'checked', 'controls', 'width', 'height']);

export function sanitizeMessageHtml(contentNode) {
  if (!contentNode || typeof contentNode.cloneNode !== 'function') return '';
  const clone = contentNode.cloneNode(true);
  for (const element of querySelectorAllSafe(clone, ACTIVE_CONTENT_SELECTOR)) if (typeof element.remove === 'function') element.remove();
  for (const emoji of querySelectorAllSafe(clone, 'emoji,customemoji')) {
    const alt = getAttributeSafe(emoji, 'alt') || getAttributeSafe(emoji, 'title') || '';
    if (typeof emoji.replaceWith === 'function') emoji.replaceWith(alt);
  }
  const base = typeof location !== 'undefined' ? location.href : 'https://teams.cloud.microsoft/';
  for (const element of querySelectorAllSafe(clone, '*')) {
    const tag = String(element.tagName || '').toLowerCase();
    if (element.attributes) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on') || name.startsWith('data-') || name.startsWith('aria-') || ['style', 'class', 'id', 'contenteditable', 'tabindex', 'srcdoc', 'formaction', 'xlink:href'].includes(name)) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (!SAFE_ATTRIBUTES.has(name) && !['href', 'src', 'poster', 'rel', 'target'].includes(name)) element.removeAttribute(attribute.name);
      }
    }
    if (tag === 'a') {
      const href = resolveSafeUrl(getAttributeSafe(element, 'href'), base);
      if (href) {
        element.setAttribute('href', href);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noreferrer noopener');
      } else {
        element.removeAttribute('href');
        element.removeAttribute('target');
        element.removeAttribute('rel');
      }
    }
    if (['img', 'video', 'audio', 'source'].includes(tag)) {
      const source = getAttributeSafe(element, 'data-gallery-src') || getAttributeSafe(element, 'data-orig-src') || getAttributeSafe(element, 'data-original-src') || getAttributeSafe(element, 'data-src') || getAttributeSafe(element, 'src');
      const resolved = resolveSafeUrl(source, base, { allowBlob: true, allowData: true });
      if (resolved) element.setAttribute('src', resolved); else element.removeAttribute('src');
      for (const attribute of ['srcset', 'data-gallery-src', 'data-orig-src', 'data-original-src', 'data-src']) element.removeAttribute(attribute);
      if (tag === 'video') {
        const poster = resolveSafeUrl(getAttributeSafe(element, 'poster'), base, { allowBlob: true, allowData: true });
        if (poster) element.setAttribute('poster', poster); else element.removeAttribute('poster');
      }
    }
  }
  return String(clone.innerHTML || '').trim();
}

function authorTextFromScope(scope) {
  const selectors = [
    '[data-tid="message-author-name"]', '[data-tid="author-name"]', '[id^="author-"]', '[id^="message-author-"]',
    '[data-tid="person-card-name"]', '[data-tid="message-group-author"]', '[data-tid="message-group-header"]',
  ];
  for (const selector of selectors) {
    const element = querySelectorSafe(scope, selector);
    const value = normalizedText(element && (element.textContent || getAttributeSafe(element, 'aria-label')));
    if (value) return value.split('•')[0].trim();
  }
  return '';
}

export function extractAuthor(messageNode, messageId) {
  const doc = messageNode && messageNode.ownerDocument;
  if (doc && messageId && typeof doc.getElementById === 'function') {
    const direct = doc.getElementById(`author-${messageId}`);
    const directText = normalizedText(direct && (direct.textContent || getAttributeSafe(direct, 'aria-label')));
    if (directText) return directText;
  }
  const direct = authorTextFromScope(messageNode);
  if (direct) return direct;
  let ancestor = messageNode && messageNode.parentElement;
  let depth = 0;
  while (ancestor && depth < 5) {
    const tid = getAttributeSafe(ancestor, 'data-tid');
    if (/message-group|chat-pane-message/i.test(tid) || getAttributeSafe(ancestor, 'role') === 'group') {
      const inherited = authorTextFromScope(ancestor);
      if (inherited) return inherited;
    }
    ancestor = ancestor.parentElement;
    depth += 1;
  }
  return 'Unknown';
}

export function extractTimestamp(messageNode, messageId) {
  const doc = messageNode && messageNode.ownerDocument;
  if (doc && messageId && typeof doc.getElementById === 'function') {
    const direct = doc.getElementById(`timestamp-${messageId}`);
    if (direct) {
      const raw = getAttributeSafe(direct, 'datetime') || getAttributeSafe(direct, 'title') || getAttributeSafe(direct, 'aria-label') || String(direct.textContent || '').trim();
      const parsed = parseTimestampValue(raw);
      if (parsed) return parsed;
    }
  }
  return timestampFromElement(messageNode, messageId);
}

export function extractReactions(messageNode) {
  const values = [];
  for (const element of querySelectorAllSafe(messageNode, '[data-tid*="reaction" i], [aria-label*="reaction" i], [title*="reaction" i]')) {
    const text = normalizedText(getAttributeSafe(element, 'aria-label') || getAttributeSafe(element, 'title') || element.textContent);
    if (text && text.length < 300) values.push(text);
  }
  return dedupeStrings(values);
}

export function extractMessageElement(messageNode, captureOrder = 0) {
  const preliminaryId = messageIdFromElement(messageNode);
  const contentNode = findContentElement(messageNode);
  const text = normalizedText(contentNode ? (contentNode.innerText || contentNode.textContent) : (messageNode && (messageNode.innerText || messageNode.textContent)));
  const author = extractAuthor(messageNode, preliminaryId);
  const time = extractTimestamp(messageNode, preliminaryId);
  const urls = collectMessageUrls(messageNode, contentNode);
  const id = preliminaryId || `synthetic-${fnv1a(`${time.iso}|${author}|${text}`)}`;
  return {
    id, author, timestamp: time.iso, timestampMs: time.ms, timestampLabel: time.label, text,
    html: sanitizeMessageHtml(contentNode), attachments: urls.attachments, links: urls.links,
    reactions: extractReactions(messageNode), captureOrder,
  };
}

export function setScrollTop(element, value) {
  const top = Math.max(0, Number(value) || 0);
  try {
    if (typeof element.scrollTo === 'function') element.scrollTo({ top, behavior: 'instant' });
    else element.scrollTop = top;
  } catch {
    element.scrollTop = top;
  }
  try { element.dispatchEvent(new Event('scroll', { bubbles: true })); } catch { /* assignment is sufficient */ }
}

export function captureScrollState(scroller) {
  const max = Math.max(0, Number(scroller.scrollHeight) - Number(scroller.clientHeight));
  const top = Math.max(0, Number(scroller.scrollTop) || 0);
  return { top, max, ratio: max > 0 ? top / max : 1, wasNearBottom: max - top <= Math.max(80, Number(scroller.clientHeight) * 0.25) };
}

export function restoreScrollState(scroller, state) {
  if (!scroller || !state) return;
  const max = Math.max(0, Number(scroller.scrollHeight) - Number(scroller.clientHeight));
  setScrollTop(scroller, state.wasNearBottom ? max : Math.round(max * Math.max(0, Math.min(1, Number(state.ratio) || 0))));
}

export function clickVisibleMessageExpanders(messageNodes, clickedElements) {
  const exactText = /^(?:see more|show more|read more|показать ещё|показать еще|показать больше|показати більше|показати ще|ver más|mostrar más|voir plus|mehr anzeigen|mostrar mais|pokaż więcej)$/i;
  let clicked = 0;
  for (const messageNode of messageNodes) {
    for (const control of querySelectorAllSafe(messageNode, 'button, [role="button"], [data-tid*="see-more" i], [data-tid*="read-more" i]')) {
      if (clickedElements.has(control)) continue;
      const text = normalizedText(getAttributeSafe(control, 'aria-label') || control.textContent);
      const tid = getAttributeSafe(control, 'data-tid');
      if (!(exactText.test(text) || /(?:see|read)-more/i.test(tid))) continue;
      clickedElements.add(control);
      try { control.click(); clicked += 1; } catch { /* virtualized node disappeared */ }
    }
  }
  return clicked;
}

export function shouldClickLoaderForState(currentState, previousClickedState) {
  const state = String(currentState || '');
  return Boolean(state) && state !== String(previousClickedState || '');
}

export function clickLoadEarlierButton(scope) {
  const pattern = /(?:load|show|view).*(?:earlier|older|previous).*(?:message|chat)|(?:earlier|older|previous).*(?:message|chat)|(?:загрузить|показать).*(?:предыдущ|ранн).*(?:сообщ|чат)|(?:завантажити|показати).*(?:поперед|ранн).*(?:повідом|чат)|(?:cargar|ver|mostrar).*(?:mensajes?).*(?:anteriores|previos)|(?:carregar|ver).*(?:mensagens?).*(?:anteriores|prévias)|(?:afficher|charger).*(?:messages?).*(?:précédents|antérieurs)|(?:ältere|vorherige).*(?:nachrichten)|(?:załaduj|pokaż).*(?:wcześniejsze|starsze).*(?:wiadomości)/i;
  for (const control of querySelectorAllSafe(scope, 'button, [role="button"]')) {
    const text = normalizedText(getAttributeSafe(control, 'aria-label') || getAttributeSafe(control, 'title') || control.textContent);
    if (!pattern.test(text) || control.disabled || getAttributeSafe(control, 'aria-disabled').toLowerCase() === 'true') continue;
    try { control.click(); return true; } catch { return false; }
  }
  return false;
}

export function getChatTitle(doc = document) {
  const selectors = [
    '[data-tid="chat-header-title"]', '[data-tid="chat-title"]', '[data-tid="header-title"]',
    '[data-tid="conversation-header"] h1', '[data-tid="conversation-header"] h2', 'main header h1', 'main header h2',
  ];
  for (const selector of selectors) {
    const element = querySelectorSafe(doc, selector);
    const text = normalizedText(element && (element.textContent || getAttributeSafe(element, 'aria-label')));
    if (text && !/^chat$/i.test(text)) return text;
  }
  const documentTitle = normalizedText(doc.title).replace(/\s*[|–—-]\s*Microsoft Teams.*$/i, '').replace(/^Microsoft Teams\s*[|–—-]\s*/i, '');
  return documentTitle || 'Teams chat';
}

export { archivePathToHref };
