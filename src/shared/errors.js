export const ERROR_CODES = Object.freeze({
  UNSUPPORTED_PAGE: 'UNSUPPORTED_PAGE',
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  SCROLLER_NOT_FOUND: 'SCROLLER_NOT_FOUND',
  EXPORT_ALREADY_RUNNING: 'EXPORT_ALREADY_RUNNING',
  CAPTURE_LIMIT_REACHED: 'CAPTURE_LIMIT_REACHED',
  EXPORT_CANCELLED: 'EXPORT_CANCELLED',
  ATTACHMENT_TIMEOUT: 'ATTACHMENT_TIMEOUT',
  ATTACHMENT_TOO_LARGE: 'ATTACHMENT_TOO_LARGE',
  ATTACHMENT_TOTAL_LIMIT: 'ATTACHMENT_TOTAL_LIMIT',
  ATTACHMENT_HTTP_ERROR: 'ATTACHMENT_HTTP_ERROR',
  ATTACHMENT_SIGN_IN_PAGE: 'ATTACHMENT_SIGN_IN_PAGE',
  ZIP_LIMIT_EXCEEDED: 'ZIP_LIMIT_EXCEEDED',
  ZIP_BUILD_FAILED: 'ZIP_BUILD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  INJECTION_FAILED: 'INJECTION_FAILED',
  UNKNOWN: 'UNKNOWN',
});

export class ExportError extends Error {
  constructor(code, message, details = {}) {
    super(String(message || code || ERROR_CODES.UNKNOWN));
    this.name = 'ExportError';
    this.code = code || ERROR_CODES.UNKNOWN;
    this.details = details && typeof details === 'object' ? details : {};
  }
}

export function toPublicError(error) {
  return {
    code: String(error && error.code || ERROR_CODES.UNKNOWN),
    message: String(error && error.message || error || 'Unknown error'),
  };
}
