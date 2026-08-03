export const SUPPORTED_HOSTS = Object.freeze([
  'teams.cloud.microsoft',
  'teams.microsoft.com',
]);

export function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

export function hostIsSupported(hostname) {
  return SUPPORTED_HOSTS.includes(normalizeHostname(hostname));
}

export function urlIsSupported(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    return url.protocol === 'https:' && hostIsSupported(url.hostname);
  } catch {
    return false;
  }
}

export function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

export function resolveSafeUrl(rawValue, baseValue = 'https://teams.cloud.microsoft/', options = {}) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  const allowData = options.allowData === true;
  const allowBlob = options.allowBlob === true;
  if (allowData && /^data:/i.test(raw)) return raw;
  if (allowBlob && /^blob:/i.test(raw)) return raw;
  try {
    const url = new URL(raw, baseValue);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    // Invalid URLs are deliberately discarded.
  }
  return '';
}

export function classifyAttachmentUrl(rawUrl, hints = {}) {
  const value = String(rawUrl || '').trim();
  if (!value || value === '#' || /^(?:javascript|mailto|tel|sms|about):/i.test(value)) return 'ignore';
  if (/^(?:blob|data):/i.test(value)) return 'attachment';
  if (hints.isFileCard || hints.isMedia || hints.download || hints.isAttachment) return 'attachment';

  let url;
  try {
    url = new URL(value, 'https://teams.cloud.microsoft/');
  } catch {
    return 'ignore';
  }
  if (!/^https?:$/.test(url.protocol)) return 'ignore';

  const host = normalizeHostname(url.hostname);
  const pathAndQuery = `${decodeURIComponentSafe(url.pathname)} ${decodeURIComponentSafe(url.search)}`.toLowerCase();
  if (
    host === '1drv.ms'
    || host.endsWith('.sharepoint.com')
    || host === 'onedrive.live.com'
    || host.endsWith('.onedrive.com')
    || host === 'api.asm.skype.com'
    || host.endsWith('.asm.skype.com')
    || host.endsWith('.skype.com')
  ) return 'attachment';

  const fileExtension = /\.(?:7z|aac|avi|bmp|csv|doc|docm|docx|eml|epub|gif|gz|heic|heif|htm|html|ics|jpeg|jpg|json|m4a|m4v|md|mkv|mov|mp3|mp4|mpeg|mpg|msg|odp|ods|odt|ogg|ogv|pdf|png|ppt|pptm|pptx|rar|rtf|svg|tar|tif|tiff|tsv|txt|wav|webm|webp|xls|xlsb|xlsm|xlsx|xml|yaml|yml|zip)(?:$|[?#&\s])/i;
  if (fileExtension.test(`${url.pathname}${url.search}`) || fileExtension.test(pathAndQuery)) return 'attachment';
  return 'link';
}

export function sharePointDownloadCandidates(rawUrl) {
  const original = String(rawUrl || '').trim();
  if (!original) return [];
  const result = [original];
  let parsed;
  try {
    parsed = new URL(original);
  } catch {
    return result;
  }
  const host = normalizeHostname(parsed.hostname);
  if (!(host.endsWith('.sharepoint.com') || host === 'onedrive.live.com' || host === '1drv.ms')) return result;

  for (const entries of [
    [['action', 'download']],
    [['download', '1']],
    [['action', 'download'], ['download', '1']],
  ]) {
    const candidate = new URL(parsed.href);
    for (const [key, value] of entries) candidate.searchParams.set(key, value);
    result.push(candidate.href);
  }
  return [...new Set(result)];
}

export function filenameHintFromUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''), 'https://teams.cloud.microsoft/');
    const queryName = url.searchParams.get('file') || url.searchParams.get('filename') || url.searchParams.get('name');
    if (queryName) return decodeURIComponentSafe(queryName);
    return decodeURIComponentSafe(url.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return '';
  }
}

export function archivePathToHref(pathValue) {
  return String(pathValue || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
