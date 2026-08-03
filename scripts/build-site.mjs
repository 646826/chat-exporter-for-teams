import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { copyFileEnsured, ensureEmptyDir, writeText } from './lib/files.mjs';
import { pages, site } from '../site/content.mjs';

const root = process.cwd();
const output = path.join(root, 'site-dist');
const basePath = '/chat-exporter-for-teams/';

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function canonicalFor(route) {
  return `${site.origin}${route}`;
}

function template(page) {
  const canonical = page.canonical || canonicalFor(page.route);
  const structured = page.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(page.structuredData)}</script>`
    : '';
  const assetPrefix = page.assetPrefix || (page.route ? '../' : './');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeAttribute(page.title)}</title>
<meta name="description" content="${escapeAttribute(page.description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" sizes="128x128" href="${assetPrefix}assets/icon128.png">
<link rel="stylesheet" href="${assetPrefix}assets/site.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Chat Exporter">
<meta property="og:title" content="${escapeAttribute(page.title)}">
<meta property="og:description" content="${escapeAttribute(page.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.origin}assets/screenshot-export.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttribute(page.title)}">
<meta name="twitter:description" content="${escapeAttribute(page.description)}">
<meta name="theme-color" content="#2563eb">
${structured}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar"><nav class="wrap nav" aria-label="Primary"><a class="brand" href="${basePath}"><img src="${assetPrefix}assets/icon128.png" width="36" height="36" alt=""><span>Chat Exporter</span></a><div class="navlinks"><a href="${basePath}how-to-export-microsoft-teams-chat-with-attachments/">How it works</a><a href="${basePath}privacy/">Privacy</a><a href="${basePath}support/">Support</a><a class="navcta" href="${site.repo}">GitHub</a></div></nav></header>
<main id="main">${page.body}</main>
<footer class="footer"><div class="wrap"><div class="footer-grid"><div><a class="brand" href="${basePath}"><img src="${assetPrefix}assets/icon128.png" width="36" height="36" alt=""><span style="color:white">Chat Exporter</span></a><p>Local-first Microsoft Teams chat export with accessible files, structured formats, and honest diagnostics.</p></div><div><h3>Guides</h3><ul><li><a href="${basePath}how-to-export-microsoft-teams-chat-with-attachments/">Export with attachments</a></li><li><a href="${basePath}download-teams-chat-history-without-admin/">Export without admin</a></li><li><a href="${basePath}teams-chat-export-html-json-csv-zip/">HTML, JSON, CSV, ZIP</a></li></ul></div><div><h3>Project</h3><ul><li><a href="${site.repo}">Source code</a></li><li><a href="${basePath}privacy/">Privacy policy</a></li><li><a href="${basePath}support/">Support</a></li><li><a href="${site.repo}/blob/main/LICENSE">MIT license</a></li></ul></div></div><div class="fine">Microsoft and Microsoft Teams are trademarks of the Microsoft group of companies. This independent extension is not affiliated with, endorsed by, or sponsored by Microsoft.</div></div></footer>
</body>
</html>`;
}

await ensureEmptyDir(output);
for (const page of pages) {
  const target = page.route ? path.join(output, page.route, 'index.html') : path.join(output, 'index.html');
  await writeText(target, template(page));
}

const assets = [
  ['site/assets/site.css', 'assets/site.css'],
  ['assets/icon128.png', 'assets/icon128.png'],
  ['store-assets/screenshots/en/01-export-one-zip.png', 'assets/screenshot-export.png'],
  ['store-assets/screenshots/en/02-long-chat-progress.png', 'assets/screenshot-progress.png'],
  ['store-assets/screenshots/en/03-messages-and-files.png', 'assets/screenshot-files.png'],
  ['store-assets/small-promo-440x280.png', 'assets/small-promo.png'],
  ['store-assets/marquee-1400x560.png', 'assets/marquee.png'],
];
for (const [source, destination] of assets) {
  await copyFileEnsured(path.join(root, source), path.join(output, destination));
}

const routeUrls = pages.map((page) => canonicalFor(page.route));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routeUrls.map((url) => `  <url><loc>${url}</loc><lastmod>2026-08-02</lastmod></url>`).join('\n')}
</urlset>`;
await writeText(path.join(output, 'sitemap.xml'), sitemap);
await writeText(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.origin}sitemap.xml`);
await writeText(path.join(output, '.nojekyll'), '');

const notFound = template({
  route: '',
  canonical: site.origin,
  assetPrefix: './',
  title: 'Page not found | Chat Exporter',
  description: 'The requested Chat Exporter page could not be found.',
  body: `<section class="article-hero"><div class="wrap"><span class="eyebrow">404</span><h1>Page not found</h1><p class="lead">Return to the Chat Exporter home page or open the project on GitHub.</p><div class="actions"><a class="button" href="${basePath}">Go to home page</a><a class="button secondary" href="${site.repo}">Open GitHub</a></div></div></section>`,
});
await writeText(path.join(output, '404.html'), notFound);

// Final source check catches accidental placeholders before Pages deployment.
for (const page of pages) {
  const target = page.route ? path.join(output, page.route, 'index.html') : path.join(output, 'index.html');
  const html = await readFile(target, 'utf8');
  if (/\b(?:TBD|TODO)\b|localhost|127\.0\.0\.1|aggregateRating/i.test(html)) throw new Error(`Invalid placeholder or prohibited metadata in ${target}`);
  if (!html.includes('<link rel="canonical"') || !html.includes('<meta name="description"')) throw new Error(`SEO metadata missing in ${target}`);
}

console.log(`Built ${pages.length} indexed pages plus assets in site-dist/.`);
