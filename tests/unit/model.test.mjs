import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMessages, mergeCapturedMessage, sortMessagesChronologically } from '../../src/content/model.js';

test('deduplicates message observations while keeping the richest data', () => {
  const messages = dedupeMessages([
    { id: 'm1', author: 'Unknown', text: 'Hi', html: '', attachments: [{ url: 'https://a/x.pdf' }], links: [], reactions: [], captureOrder: 5 },
    { id: 'm1', author: 'Ada', text: 'Hi there', html: '<b>Hi there</b>', attachments: [{ url: 'https://a/x.pdf', nameHint: 'x.pdf' }], links: [{ url: 'https://example.com' }], reactions: ['Like'], captureOrder: 2 },
  ]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].author, 'Ada');
  assert.equal(messages[0].text, 'Hi there');
  assert.equal(messages[0].attachments.length, 1);
  assert.equal(messages[0].attachments[0].nameHint, 'x.pdf');
  assert.deepEqual(messages[0].reactions, ['Like']);
  assert.equal(messages[0].captureOrder, 2);
});

test('mergeCapturedMessage reports whether a message is new', () => {
  const map = new Map();
  assert.equal(mergeCapturedMessage(map, { id: 'm1', text: 'a', attachments: [], links: [], reactions: [] }), true);
  assert.equal(mergeCapturedMessage(map, { id: 'm1', text: 'a longer text', attachments: [], links: [], reactions: [] }), false);
  assert.equal(map.get('m1').text, 'a longer text');
});

test('sorts chronologically and uses virtualized batch order as a stable fallback', () => {
  const sorted = sortMessagesChronologically([
    { id: 'no-time-new', captureBatch: 0, domIndex: 0 },
    { id: '1700000000000', timestampMs: 1_700_000_000_000 },
    { id: '1600000000000', timestampMs: 1_600_000_000_000 },
    { id: 'no-time-old', captureBatch: 3, domIndex: 1 },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ['1600000000000', '1700000000000', 'no-time-old', 'no-time-new']);
});
