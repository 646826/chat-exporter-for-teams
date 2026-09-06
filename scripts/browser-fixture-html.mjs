// Keep replacement tokens and string values literal when embedding JavaScript.
export function inlineBrowserFixture(html, bundle) {
  const safeBundle = bundle.replace(/<\/script/gi, (tag) => '<\\/' + tag.slice(2));
  return html.replace(
    '<script nonce="browser-fixture" src="../../dist/browser-fixture.js"></script>',
    () => `<script nonce="browser-fixture">${safeBundle}</script>`,
  );
}
