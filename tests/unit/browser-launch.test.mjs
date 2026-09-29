import test from 'node:test';
import assert from 'node:assert/strict';

test('fresh-profile browser launch supports macOS and retains Linux CI', async () => {
  const module = await import('../../scripts/lib/browser-launch.mjs').catch(() => ({}));
  assert.equal(typeof module.browserLaunch, 'function', 'portable launcher must exist');
  const mac = module.browserLaunch('darwin', {}, '/tmp/private-test-profile');
  assert.equal(mac.command, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.ok(mac.args.includes('--headless=new'));
  assert.ok(mac.args.includes('--user-data-dir=/tmp/private-test-profile'));
  const linux = module.browserLaunch('linux', {CHROMIUM_PATH:'/opt/chromium'}, '/tmp/test');
  assert.equal(linux.command, 'xvfb-run');
  assert.deepEqual(linux.args.slice(0,2), ['-a','/opt/chromium']);
  const explicit = module.browserLaunch('darwin', {CHROMIUM_PATH:'/custom/browser'}, '/tmp/test');
  assert.equal(explicit.command,'/custom/browser');
});
