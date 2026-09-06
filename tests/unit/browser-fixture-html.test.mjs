import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { inlineBrowserFixture } from '../../scripts/browser-fixture-html.mjs';

const marker = '<script nonce="browser-fixture" src="../../dist/browser-fixture.js"></script>';
const template = `<!doctype html><body><pre id="status">RUNNING</pre>${marker}<footer>After</footer></body>`;
function extractScript(html) {
  const match = html.match(/<script nonce="browser-fixture">([\s\S]*?)<\/script>/);
  assert.ok(match, 'fixture script is present');
  return match[1];
}

test('embedding preserves JavaScript replacement tokens instead of substituting HTML', () => {
  const bundle = 'globalThis.tokens = ' + JSON.stringify(["$&", "$$", "$`", "$'", "$1"]) + ';';
  assert.equal(extractScript(inlineBrowserFixture(template, bundle)), bundle);
});

test('the embedded regex replacement executes with its original dollar semantics', () => {
  const bundle = String.raw`globalThis.result = '[label]'.replace(/[\[\]]/g, '\\$&');`;
  const context = vm.createContext({});
  assert.doesNotThrow(() => vm.runInContext(extractScript(inlineBrowserFixture(template, bundle)), context));
  assert.equal(context.result, '\\[label\\]');
});

test('closing script tags are escaped case-insensitively without changing JavaScript values', () => {
  const bundle = 'globalThis.sample = ' + JSON.stringify('</script><ScRiPt>example</ScRiPt>') + ';';
  const html = inlineBrowserFixture(template, bundle);
  const source = extractScript(html);
  assert.ok(!/<\/script/i.test(source));
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.sample, '</script><ScRiPt>example</ScRiPt>');
});

test('fixture markup and nonce around the replaced script are unchanged', () => {
  const html = inlineBrowserFixture(template, 'globalThis.ready = true;');
  assert.ok(html.startsWith('<!doctype html><body><pre id="status">RUNNING</pre>'));
  assert.ok(html.endsWith('<footer>After</footer></body>'));
  assert.equal(extractScript(html), 'globalThis.ready = true;');
});
