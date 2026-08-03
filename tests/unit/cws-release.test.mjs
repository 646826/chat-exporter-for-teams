import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildItemName,
  cwsRequest,
  publishItem,
  releaseToChromeWebStore,
  uploadPackage,
  waitForUpload,
} from '../../scripts/lib/cws.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('buildItemName validates publisher and extension identifiers', () => {
  assert.equal(buildItemName('publisher-123', 'abcdefghijklmnopabcdefghijklmnop'), 'publishers/publisher-123/items/abcdefghijklmnopabcdefghijklmnop');
  assert.throws(() => buildItemName('', 'item'), /publisher/i);
  assert.throws(() => buildItemName('publisher', ''), /extension/i);
  assert.throws(() => buildItemName('../publisher', 'item'), /invalid/i);
});

test('cwsRequest includes bearer authentication and surfaces API error details', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ error: { message: 'Version already exists', status: 'ALREADY_EXISTS', details: [{ reason: 'VERSION_REUSE' }] } }, 409);
  };
  await assert.rejects(
    () => cwsRequest('https://example.test/api', { accessToken: 'secret-token', fetchImpl }),
    /Version already exists.*VERSION_REUSE/,
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
});

test('uploadPackage sends the ZIP as a raw application/zip request', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ itemId: 'abcdefghijklmnopabcdefghijklmnop', crxVersion: '0.1.0', uploadState: 'SUCCEEDED' });
  };
  const result = await uploadPackage({
    accessToken: 'token',
    publisherId: 'publisher-123',
    extensionId: 'abcdefghijklmnopabcdefghijklmnop',
    packageBytes: Buffer.from('ZIP DATA'),
    fetchImpl,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://chromewebstore.googleapis.com/upload/v2/publishers/publisher-123/items/abcdefghijklmnopabcdefghijklmnop:upload');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/zip');
  assert.deepEqual(Buffer.from(calls[0].options.body), Buffer.from('ZIP DATA'));
  assert.equal(result.uploadState, 'SUCCEEDED');
});

test('waitForUpload polls fetchStatus until an asynchronous upload succeeds', async () => {
  const states = ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS', 'SUCCEEDED'];
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ lastAsyncUploadState: states.shift() });
  };
  const result = await waitForUpload({
    accessToken: 'token',
    itemName: 'publishers/p/items/e',
    initialState: 'IN_PROGRESS',
    fetchImpl,
    sleepImpl: async () => {},
    pollIntervalMs: 1,
    timeoutMs: 1000,
  });
  assert.equal(result.lastAsyncUploadState, 'SUCCEEDED');
  assert.equal(calls.length, 3);
  assert(calls.every((call) => call.url.endsWith('/v2/publishers/p/items/e:fetchStatus')));
});

test('waitForUpload rejects terminal failure and timeout states', async () => {
  await assert.rejects(
    () => waitForUpload({
      accessToken: 'token',
      itemName: 'publishers/p/items/e',
      initialState: 'FAILED',
      fetchImpl: async () => jsonResponse({}),
      sleepImpl: async () => {},
    }),
    /upload failed/i,
  );

  let now = 0;
  await assert.rejects(
    () => waitForUpload({
      accessToken: 'token',
      itemName: 'publishers/p/items/e',
      initialState: 'IN_PROGRESS',
      fetchImpl: async () => jsonResponse({ lastAsyncUploadState: 'IN_PROGRESS' }),
      sleepImpl: async () => { now += 100; },
      nowImpl: () => now,
      pollIntervalMs: 100,
      timeoutMs: 250,
    }),
    /timed out/i,
  );
});

test('publishItem sends explicit safe publish controls', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ itemId: 'e', state: 'PENDING_REVIEW', warningInfo: {} });
  };
  const result = await publishItem({
    accessToken: 'token',
    itemName: 'publishers/p/items/e',
    publishType: 'STAGED_PUBLISH',
    skipReview: false,
    fetchImpl,
  });
  assert.equal(result.state, 'PENDING_REVIEW');
  assert.equal(calls[0].url, 'https://chromewebstore.googleapis.com/v2/publishers/p/items/e:publish');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    publishType: 'STAGED_PUBLISH',
    skipReview: false,
    blockOnWarnings: true,
  });
});

test('releaseToChromeWebStore uploads without publishing by default', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ itemId: 'e', crxVersion: '0.1.0', uploadState: 'SUCCEEDED' });
  };
  const result = await releaseToChromeWebStore({
    accessToken: 'token',
    publisherId: 'p',
    extensionId: 'e',
    packageBytes: Buffer.from('zip'),
    fetchImpl,
  });
  assert.equal(result.publishType, 'UPLOAD_ONLY');
  assert.equal(result.publishSubmission, 'SKIPPED');
  assert.equal(calls.length, 1);
});

test('releaseToChromeWebStore publishes only when explicitly requested', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/upload/')) return jsonResponse({ itemId: 'e', crxVersion: '0.1.0', uploadState: 'SUCCEEDED' });
    return jsonResponse({ itemId: 'e', state: 'PENDING_REVIEW' });
  };
  const result = await releaseToChromeWebStore({
    accessToken: 'token',
    publisherId: 'p',
    extensionId: 'e',
    packageBytes: Buffer.from('zip'),
    publishType: 'DEFAULT_PUBLISH',
    skipReview: false,
    fetchImpl,
  });
  assert.equal(result.publishSubmission, 'REQUESTED');
  assert.equal(result.publish.state, 'PENDING_REVIEW');
  assert.equal(calls.length, 2);
});

import { createReleaseEvidence } from '../../scripts/lib/release-evidence.mjs';

test('createReleaseEvidence records package integrity and delivery mode without secrets', () => {
  const evidence = createReleaseEvidence({
    repository: '646826/chat-exporter-for-teams',
    version: '0.1.0',
    commit: 'abc123',
    eventName: 'workflow_dispatch',
    packageName: 'chat-exporter-for-teams.zip',
    packageBytes: Buffer.from('zip'),
    releaseResult: {
      itemName: 'publishers/p/items/e',
      publishType: 'UPLOAD_ONLY',
      chromeWebStoreUpload: 'SUCCEEDED',
      publishSubmission: 'SKIPPED',
      upload: { crxVersion: '0.1.0', uploadState: 'SUCCEEDED' },
      publish: null,
    },
    verifiedAt: '2026-08-02T20:00:00.000Z',
  });
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.tag, 'v0.1.0');
  assert.equal(evidence.package.bytes, 3);
  assert.match(evidence.package.sha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.delivery.publishSubmission, 'SKIPPED');
  assert.equal(JSON.stringify(evidence).includes('token'), false);
});
