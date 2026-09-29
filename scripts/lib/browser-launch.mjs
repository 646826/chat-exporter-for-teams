// Only used by tests, always with a newly created temporary browser profile.
export function browserLaunch(platform, env, userDataDir) {
  const browser = env.CHROMIUM_PATH || (platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/lib/chromium/chromium');
  const args = [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking',
    '--disable-component-update', '--disable-default-apps', '--disable-sync', '--mute-audio', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, 'about:blank',
  ];
  return platform === 'linux'
    ? { command: 'xvfb-run', args: ['-a', browser, ...args] }
    : { command: browser, args: ['--headless=new', ...args] };
}
