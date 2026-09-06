import test from 'node:test';
import assert from 'node:assert/strict';
import { numericMessageTime, sortMessagesChronologically } from '../../src/content/model.js';

test('extracts the numeric ID timestamp once per message in a large history', () => {
  const count = 4096;
  let idReads = 0;
  // Multiplication by an odd number permutes this power-of-two-sized fixture.
  const messages = Array.from({ length: count }, (_, index) => {
    const ordinal = (index * 109) % count;
    return Object.freeze({
      ordinal,
      get id() { idReads += 1; return `message-${1700000000000 + ordinal}`; },
    });
  });
  Object.freeze(messages);
  const sorted = sortMessagesChronologically(messages);
  assert.deepEqual(sorted.map((message) => message.ordinal), Array.from({ length: count }, (_, index) => index));
  assert.equal(idReads, count, 'timestamp parsing must not be repeated by the sort comparator');
  assert.equal(sorted.length, messages.length);
  assert.equal(new Set(sorted).size, count);
  assert.notEqual(sorted, messages);
});

test('explicit timestamps take precedence over timestamps embedded in IDs', () => {
  const first = { id: 'message-1900000000000', timestampMs: 100 };
  const second = { id: 'message-1600000000000', timestampMs: 200 };
  assert.deepEqual(sortMessagesChronologically([second, first]), [first, second]);
});

test('seconds and milliseconds in IDs retain their existing interpretation', () => {
  const first = { id: 'message-1700000000' };
  const second = { id: 'message-1700000000500' };
  assert.equal(numericMessageTime(first), 1700000000000);
  assert.equal(numericMessageTime(second), 1700000000500);
  assert.deepEqual(sortMessagesChronologically([second, first]), [first, second]);
});

test('messages without usable timestamps retain reverse-batch and DOM ordering', () => {
  const newer = { id: 'newer', captureBatch: 0, domIndex: 0 };
  const olderSecond = { id: 'older-second', captureBatch: 4, domIndex: 1 };
  const olderFirst = { id: 'older-first', captureBatch: 4, domIndex: 0 };
  assert.deepEqual(sortMessagesChronologically([newer, olderSecond, olderFirst]), [olderFirst, olderSecond, newer]);
});

test('known times precede unknown times as before', () => {
  const unknown = { id: 'unknown', captureBatch: 10 };
  const known = { id: 'known', timestampMs: 0 };
  assert.deepEqual(sortMessagesChronologically([unknown, known]), [known, unknown]);
});

test('equal times still use capture batch then DOM position as tie breakers', () => {
  const a = { id: 'a', timestampMs: 5, captureBatch: 0, domIndex: 0 };
  const b = { id: 'b', timestampMs: 5, captureBatch: 2, domIndex: 1 };
  const c = { id: 'c', timestampMs: 5, captureBatch: 2, domIndex: 0 };
  assert.deepEqual(sortMessagesChronologically([a, b, c]), [c, b, a]);
});

test('equal keys preserve stable order, object identity and input contents', () => {
  const messages = Object.freeze([
    Object.freeze({ id: 'a', timestampMs: 5, text: 'Synthetic A' }),
    Object.freeze({ id: 'b', timestampMs: 5, text: 'Synthetic B' }),
  ]);
  const before = JSON.stringify(messages);
  const sorted = sortMessagesChronologically(messages);
  assert.equal(sorted[0], messages[0]);
  assert.equal(sorted[1], messages[1]);
  assert.equal(JSON.stringify(messages), before);
});

test('non-array and empty inputs continue to produce an empty array', () => {
  for (const input of [undefined, null, {}, 'invalid', []]) {
    assert.deepEqual(sortMessagesChronologically(input), []);
  }
});
