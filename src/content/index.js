import { ERROR_CODES, ExportError } from '../shared/errors.js';
import { runTeamsChatExporter } from './controller.js';

export const GLOBAL_API_KEY = '__CHAT_EXPORTER_FOR_TEAMS__';
export const BUNDLE_VERSION = '0.2.0';

export function installGlobalApi(target = globalThis) {
  const existing = target[GLOBAL_API_KEY];
  if (existing && existing.version === BUNDLE_VERSION) return existing;
  if (existing && typeof existing.isRunning === 'function' && existing.isRunning()) return existing;
  let running = false;
  const api = Object.freeze({
    version: BUNDLE_VERSION,
    isRunning: () => running,
    start(options = {}) {
      if (running) return Promise.reject(new ExportError(ERROR_CODES.EXPORT_ALREADY_RUNNING, 'An export is already running in this tab.'));
      running = true;
      return runTeamsChatExporter(options).finally(() => { running = false; });
    },
  });
  try {
    Object.defineProperty(target, GLOBAL_API_KEY, { configurable: true, enumerable: false, writable: false, value: api });
  } catch {
    target[GLOBAL_API_KEY] = api;
  }
  return api;
}

if (typeof window !== 'undefined') installGlobalApi(window);
