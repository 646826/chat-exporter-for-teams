import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { releaseToChromeWebStore } from './lib/cws.mjs';
import { createReleaseEvidence } from './lib/release-evidence.mjs';

function requiredEnv(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function envBoolean(value) {
  return /^(?:1|true|yes|on)$/i.test(String(value || '').trim());
}

async function main() {
  const env = process.env;
  const packagePath = path.resolve(process.argv[2] || 'chat-exporter-for-teams.zip');
  const manifestPath = path.resolve(process.argv[3] || 'manifest.json');
  const [packageBytes, manifestRaw] = await Promise.all([
    readFile(packagePath),
    readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const accessToken = requiredEnv(env, 'CWS_ACCESS_TOKEN');
  const publisherId = requiredEnv(env, 'CWS_PUBLISHER_ID');
  const extensionId = requiredEnv(env, 'CWS_EXTENSION_ID');
  const publishType = String(env.CWS_PUBLISH_TYPE || 'UPLOAD_ONLY').trim().toUpperCase();
  const skipReview = envBoolean(env.CWS_SKIP_REVIEW);

  console.log(`Uploading ${path.basename(packagePath)} (${packageBytes.byteLength} bytes) to Chrome Web Store API V2.`);
  console.log(`Delivery mode: ${publishType}; skip review: ${skipReview}.`);

  const releaseResult = await releaseToChromeWebStore({
    accessToken,
    publisherId,
    extensionId,
    packageBytes,
    publishType,
    skipReview,
    pollIntervalMs: Number(env.CWS_POLL_INTERVAL_MS) || 3000,
    timeoutMs: Number(env.CWS_UPLOAD_TIMEOUT_MS) || 180000,
  });
  const uploadedVersion = String(releaseResult.upload && releaseResult.upload.crxVersion || '');
  if (uploadedVersion && uploadedVersion !== manifest.version) {
    throw new Error(`Chrome Web Store reported version ${uploadedVersion}, expected ${manifest.version}.`);
  }

  const evidence = createReleaseEvidence({
    repository: env.GITHUB_REPOSITORY || '646826/chat-exporter-for-teams',
    version: manifest.version,
    commit: env.GITHUB_SHA || '',
    eventName: env.GITHUB_EVENT_NAME || 'local',
    packageName: path.basename(packagePath),
    packageBytes,
    releaseResult,
  });
  await writeFile('release-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  console.log('Upload finished successfully.');
  if (publishType === 'UPLOAD_ONLY') console.log('Skipping publish step.');
  else console.log(`Publish submission requested with state ${releaseResult.publish && releaseResult.publish.state || 'unknown'}.`);
  console.log('Release evidence written to release-evidence.json.');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
