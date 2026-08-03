import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, mergeConfig } from '../../src/content/controller.js';

test('clamps configuration and accepts only explicit attachment opt-out', () => {
  const config = mergeConfig({
    scrollDelayMs: -1, topLoadDelayMs: 99_999, topStableCycles: 1.2, maxScrollCycles: 0,
    scrollStepRatio: 4, attachmentConcurrency: 100, attachmentTimeoutMs: 1,
    maxSingleAttachmentBytes: 5, maxTotalAttachmentBytes: 5, includeAttachments: false,
    strings: 'wrong', extensionVersion: 123,
  });
  assert.equal(config.scrollDelayMs, 100);
  assert.equal(config.topLoadDelayMs, 15_000);
  assert.equal(config.topStableCycles, 2);
  assert.equal(config.maxScrollCycles, 1);
  assert.equal(config.scrollStepRatio, 0.95);
  assert.equal(config.attachmentConcurrency, 8);
  assert.equal(config.attachmentTimeoutMs, 5_000);
  assert.equal(config.maxSingleAttachmentBytes, 1_000_000);
  assert.equal(config.maxTotalAttachmentBytes, 10_000_000);
  assert.equal(config.includeAttachments, false);
  assert.deepEqual(config.strings, {});
  assert.equal(config.extensionVersion, '123');
  assert.equal(mergeConfig({}).includeAttachments, DEFAULT_CONFIG.includeAttachments);
});
