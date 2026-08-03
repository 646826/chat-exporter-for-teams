import { createHash } from 'node:crypto';
import path from 'node:path';

export function createReleaseEvidence(options = {}) {
  const bytes = options.packageBytes;
  if (!(bytes instanceof Uint8Array) && !Buffer.isBuffer(bytes)) throw new TypeError('packageBytes must be a Buffer or Uint8Array.');
  const result = options.releaseResult || {};
  const version = String(options.version || '').trim();
  if (!version) throw new TypeError('version is required.');
  return {
    schemaVersion: 1,
    repository: String(options.repository || ''),
    version,
    tag: `v${version}`,
    commit: String(options.commit || ''),
    eventName: String(options.eventName || ''),
    itemName: String(result.itemName || ''),
    package: {
      filename: path.basename(String(options.packageName || 'chat-exporter-for-teams.zip')),
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    delivery: {
      publishType: String(result.publishType || 'UPLOAD_ONLY'),
      chromeWebStoreUpload: String(result.chromeWebStoreUpload || ''),
      publishSubmission: String(result.publishSubmission || ''),
      uploadState: String(result.upload && (result.upload.uploadState || result.upload.lastAsyncUploadState) || ''),
      crxVersion: String(result.upload && result.upload.crxVersion || ''),
      itemState: String(result.publish && result.publish.state || ''),
      warnings: result.publish && result.publish.warningInfo && Array.isArray(result.publish.warningInfo.warnings)
        ? result.publish.warningInfo.warnings.map((warning) => ({
          reason: String(warning && warning.reason || ''),
          description: String(warning && warning.description || ''),
        }))
        : [],
    },
    verifiedAt: String(options.verifiedAt || new Date().toISOString()),
  };
}
