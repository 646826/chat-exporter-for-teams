# Chat Exporter for Microsoft Teams — Files & ZIP: Product and Technical Design

**Date:** 2026-08-02
**Repository:** `646826/chat-exporter-for-teams`
**Extension name:** `Chat Exporter for Microsoft Teams — Files & ZIP`
**Short name:** `Chat Export`
**Initial version:** `0.1.0`
**License:** MIT

## 1. Product summary

Chat Exporter for Microsoft Teams — Files & ZIP is a local-first Manifest V3 browser extension that exports the currently open personal or group conversation in Microsoft Teams for the web. It loads older messages through the visible Teams interface, captures message content and metadata, downloads attachments accessible to the signed-in user, and creates one portable ZIP archive without sending conversation data to developer-controlled infrastructure.

The product is intentionally narrow: open one conversation, click one primary action, receive one archive containing readable and structured formats plus an attachment report.

### Primary user promise

> Export Microsoft Teams chat history with accessible files to one private ZIP.

### Positioning

The extension differentiates itself through:

1. A one-action workflow rather than format-heavy configuration.
2. A single ZIP that always contains HTML, JSON, CSV, links, and attachment diagnostics.
3. Explicit support for accessible attachments, not only message text.
4. Local-only processing with no account, telemetry, analytics, or backend.
5. Clear failure reporting when Microsoft 365 permissions or browser restrictions prevent a file download.

## 2. Goals and success criteria

### Goals for version 0.1.0

- Export the currently open personal or group chat from `teams.cloud.microsoft` and `teams.microsoft.com`.
- Capture virtualized history by repeatedly collecting messages while scrolling toward the beginning.
- Preserve author, timestamp, text, sanitized rich HTML, message ID, ordinary links, reactions, and attachment candidates.
- Download attachment URLs that are accessible in the current signed-in browser session.
- Create a portable ZIP containing all public export formats and diagnostic reports.
- Provide a simple, accessible popup and an in-page progress overlay with cancellation.
- Process all conversation data locally.
- Use only narrowly justified extension permissions.
- Ship a deterministic, validated Chrome Web Store package from CI.
- Publish an English listing and include Russian, Ukrainian, Spanish, Portuguese, German, French, and Polish extension UI localizations.
- Remain compatible with Chromium-based Microsoft Edge from the same package.

### Product success criteria

- A user can complete a normal export with three interactions: open the chat, open the extension, click **Export chat to ZIP**.
- The generated archive opens successfully with standard ZIP software.
- `chat.html` is readable offline and references downloaded assets through relative archive paths.
- Every discovered attachment has exactly one status row: `downloaded`, `failed`, or `skipped`.
- An incomplete history or failed attachment is never silently presented as complete.
- No conversation content leaves the browser through developer-controlled endpoints.

### Search and listing goals

The first listing targets high-intent phrases naturally, without keyword stuffing:

- `teams chat export attachments`
- `export teams chat with files`
- `teams chat export zip`
- `microsoft teams chat to zip`
- `download teams chat history`

Ranking position is not an acceptance criterion because it depends on store algorithms, competition, retention, ratings, and review history outside the codebase. The repository must nevertheless provide high-quality metadata, screenshots, documentation, and stable product behavior that support discoverability and conversion.

## 3. Non-goals for version 0.1.0

- Exporting Teams channel posts, threaded channel replies, SharePoint channel libraries, or entire tenants.
- Microsoft Graph, Purview, eDiscovery, admin consent, or organization-wide export.
- Bypassing Microsoft 365 authorization, retention, Conditional Access, CORS, deletion, or tenant policy.
- Exporting multiple conversations in one operation.
- Date-range selection.
- PDF generation.
- Cloud backup, sync, accounts, subscriptions, analytics, telemetry, or crash reporting.
- Firefox support.
- Automated publication before a human deliberately submits or approves the release.

Meeting chats may work when their rendered DOM matches supported personal/group chat structures, but the first listing must not promise meeting-chat coverage until it is verified with dedicated fixtures and manual tenant tests.

## 4. User experience

### 4.1 Toolbar popup

The popup is approximately 360 pixels wide and uses one dominant action.

Default detected state:

```text
Chat Exporter

Current conversation
✓ Chat detected

[✓] Include accessible files

[ Export chat to ZIP ]

Processed locally.
Nothing is sent to us.
```

Unsupported page state:

```text
Chat Exporter

Open a personal or group conversation
in Microsoft Teams, then try again.

[ Open Microsoft Teams ]
```

Running state:

```text
Export in progress
Follow progress in the Teams tab.
```

The popup closes after starting the export. Long-running state belongs to the page overlay so closing the popup cannot cancel the job.

### 4.2 First-run disclosure

Before the first export, the popup shows a concise disclosure:

> The extension reads the open conversation and accessible file links to create an archive on this device. Nothing is sent to the developer.

The user must click **Continue**. Acceptance is stored locally. No consent is required for analytics because analytics do not exist.

### 4.3 In-page progress overlay

The overlay is injected only after an explicit user action. It displays:

- current phase;
- status detail;
- messages captured;
- attachment candidates found;
- bytes downloaded;
- determinate progress when a total is known;
- a bounded diagnostic log;
- **Cancel export**, **Download ZIP**, and **Close** actions as appropriate.

The overlay must use only safe DOM construction such as `createElement`, `textContent`, `setAttribute`, and `appendChild`. It must not assign string values to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or equivalent Trusted Types sinks.

### 4.4 Archive contents

Every successful export contains:

```text
chat.html
chat.json
chat.csv
links.csv
attachments-report.csv
failed-attachments.html
README.txt
attachments/
```

`attachments/` may be absent when no item was downloaded.

- `chat.html`: searchable, accessible, offline transcript with relative links to downloaded files.
- `chat.json`: stable machine-readable schema identified as `chat-exporter-for-teams/v1`.
- `chat.csv`: one message per row with metadata and URLs.
- `links.csv`: ordinary links shared in messages.
- `attachments-report.csv`: one row per attachment candidate with status, path, size, MIME type, original URL, resolved URL, reason, and message IDs.
- `failed-attachments.html`: clickable recovery list for unavailable files.
- `README.txt`: archive summary, limitations, and file descriptions.

## 5. Extension permissions and security model

### Manifest V3 permissions

Required permissions:

```json
[
  "activeTab",
  "scripting",
  "storage"
]
```

The extension must not request `<all_urls>`, broad static host permissions, `tabs`, cookies, identity, webRequest, debugger, native messaging, or management access.

`activeTab` and `scripting` are used only after the user clicks the extension. `storage` stores non-sensitive preferences and the first-run disclosure acknowledgement.

The initial implementation creates and downloads the final Blob from the injected page-side bundle. It therefore does not require the `downloads` permission. If browser evidence later proves this unreliable, adding `downloads` requires a separate design change, permission review, user-facing disclosure update, and migration test.

### Supported origins

Runtime execution must reject every origin except:

```text
https://teams.cloud.microsoft/*
https://teams.microsoft.com/*
```

No static content script runs continuously. The service worker injects the bundled exporter after explicit user activation.

### Local-first requirements

- No conversation content, URLs, metadata, filenames, errors, or usage events are transmitted to a developer-controlled server.
- No remote executable code, remotely hosted script, dynamic code evaluation, or fetched command interpreter.
- No `eval`, `new Function`, or runtime loading from a CDN.
- No analytics SDK, tracking pixel, advertising SDK, error-reporting SDK, or account system.
- Store listing and privacy documentation must state that Microsoft 365 itself still serves the page and attachment URLs requested by the signed-in user.

### Sanitization

Exported HTML must remove active content and unsafe interaction surfaces:

- remove `script`, `style`, `iframe`, `object`, `embed`, form controls, and event-handler attributes;
- remove page-specific classes, IDs, inline styles, `contenteditable`, and tab indexes;
- resolve safe `http`, `https`, `blob`, and `data` asset URLs deliberately;
- ensure generated external links use `rel="noreferrer noopener"`;
- escape all generated metadata and report fields;
- prevent ZIP path traversal and reserved filename issues.

## 6. Architecture

### 6.1 Repository structure

```text
.github/
  workflows/
    ci.yml
    chrome-web-store-release.yml
    pages.yml
assets/
  icon16.png
  icon32.png
  icon48.png
  icon128.png
  store/
    screenshot-01.png
    screenshot-02.png
    screenshot-03.png
    screenshot-04.png
    screenshot-05.png
    small-promo-tile.png
    marquee-promo-tile.png
docs/
  chrome-web-store-listing.md
  chrome-web-store-pipeline.md
  privacy-policy.md
  release-checklist.md
  support.md
  superpowers/
    specs/
    plans/
src/
  background.js
  shared/
    messages.js
    options.js
    urls.js
  popup/
    popup.html
    popup.css
    popup.js
  content/
    index.js
    controller.js
    teams-adapter.js
    capture.js
    attachments.js
    archive.js
    renderers.js
    overlay.js
    zip.js
_locales/
  en/messages.json
  ru/messages.json
  uk/messages.json
  es_419/messages.json
  pt_BR/messages.json
  de/messages.json
  fr/messages.json
  pl/messages.json
scripts/
  build.mjs
  build-zip.mjs
  check-syntax.mjs
  validate-package.mjs
  cws-release.mjs
  google-access-token.mjs
tests/
  fixtures/
  *.test.mjs
manifest.json
package.json
README.md
CHANGELOG.md
LICENSE
```

Generated artifacts live in `dist/` and are never treated as source.

### 6.2 Components

#### `src/background.js`

Responsibilities:

- receive popup requests;
- identify the active tab by ID;
- prevent concurrent exports in the same tab;
- inject the compiled content bundle;
- start the export with sanitized options;
- return stable start and error states to the popup.

It does not read or store conversation content.

#### `src/popup/*`

Responsibilities:

- render localized UI;
- perform a lightweight in-tab support check through injected code;
- show disclosure and preferences;
- send `START_EXPORT` to the service worker;
- show actionable errors.

#### `src/content/teams-adapter.js`

The only module that knows Teams DOM details. It provides:

- supported-host validation;
- message-node selectors;
- scroll-container discovery;
- message ID, author, timestamp, content, link, reaction, and attachment extraction;
- chat-title discovery;
- “See more” and “load earlier messages” controls.

Selectors and DOM heuristics must not leak into orchestration, archive, or UI modules.

#### `src/content/capture.js`

Responsibilities:

- remember enough initial scroll state for best-effort restoration;
- capture the currently visible batch;
- prefetch ephemeral `blob:` and `data:` assets before virtualization removes their nodes;
- scroll upward in bounded steps;
- detect stable top state;
- request earlier history when a visible loader exists;
- merge richer duplicates;
- sort messages chronologically;
- report an explicit warning when the cycle limit is reached.

#### `src/content/attachments.js`

Responsibilities:

- distinguish ordinary links from likely attachments;
- aggregate duplicate URLs across messages;
- try original and safe SharePoint/OneDrive download variants;
- use the current browser credentials;
- enforce per-file, total-size, timeout, and concurrency limits;
- reject HTML sign-in/viewer responses masquerading as files;
- produce one status record for every candidate.

#### `src/content/archive.js` and `zip.js`

Responsibilities:

- render HTML, JSON, CSV, link, report, and README files;
- rewrite downloaded asset URLs to relative archive paths;
- create a deterministic classic ZIP archive;
- enforce ZIP32 limits and path safety;
- expose progress during CRC calculation;
- trigger the single final ZIP download.

#### `src/content/overlay.js`

Responsibilities:

- render the progress interface through safe DOM APIs;
- expose `update`, `log`, `setError`, `setCancelled`, and `setDownload` methods;
- support keyboard navigation, visible focus, `aria-live`, light mode, and dark mode;
- revoke object URLs when the interface closes.

### 6.3 Build model

- Source code uses JavaScript ES modules.
- `esbuild` creates a self-contained content bundle and copies popup/background assets into `dist/`.
- No runtime npm dependencies are allowed in the extension package.
- Development dependencies may include `esbuild`, `playwright`, and package-validation utilities.
- The Chrome Web Store ZIP contains only the extension runtime allowlist, never tests, source maps, design documents, secrets, or development scripts.

## 7. Data model

### Message schema

```ts
type ExportedMessage = {
  id: string;
  author: string;
  timestamp: string;
  timestampMs: number | null;
  timestampLabel: string;
  text: string;
  html: string;
  attachments: AttachmentCandidate[];
  links: OrdinaryLink[];
  reactions: string[];
  captureBatch?: number;
  domIndex?: number;
};
```

### Attachment candidate schema

```ts
type AttachmentCandidate = {
  url: string;
  kind: string;
  nameHint: string;
  messageIds: string[];
  isFileCard?: boolean;
  isMedia?: boolean;
  width?: number;
  height?: number;
};
```

### Attachment record schema

```ts
type AttachmentRecord = {
  url: string;
  resolvedUrl: string;
  status: "downloaded" | "failed" | "skipped";
  filename: string;
  path: string;
  bytes: number;
  mimeType: string;
  error: string;
  messageIds: string[];
  attempts: string[];
};
```

Blob and response objects are internal and must never be serialized into `chat.json`.

## 8. Capture algorithm

1. Validate the active hostname and confirm that message nodes exist.
2. Find the best scroll container by combining known Teams selectors, message ancestry, scrollability, visible message count, and overflow height.
3. Record initial scroll information.
4. Move to the most recent end and wait for rendering to settle.
5. For each bounded cycle:
   - find visible message nodes;
   - expand truncated messages once;
   - extract and merge messages immediately;
   - prefetch ephemeral media URLs;
   - update progress;
   - when not at the top, move upward by a configurable fraction of viewport height;
   - at the top, click an earlier-history loader only once per observed state;
   - stop after multiple stable cycles with no new messages or height changes.
6. Sort and deduplicate captured messages.
7. Restore the user's prior area best-effort; if precise restoration is impossible because of virtualization, return to the newest end and disclose that behavior in documentation.
8. Continue to attachment download and archive creation.

The algorithm must never infer completeness solely from one zero scroll position. It requires stable signatures across multiple cycles.

## 9. Error handling

Stable error categories exposed to UI and tests:

- `UNSUPPORTED_PAGE`
- `CHAT_NOT_FOUND`
- `SCROLLER_NOT_FOUND`
- `EXPORT_ALREADY_RUNNING`
- `CAPTURE_LIMIT_REACHED`
- `EXPORT_CANCELLED`
- `ATTACHMENT_TIMEOUT`
- `ATTACHMENT_TOO_LARGE`
- `ATTACHMENT_TOTAL_LIMIT`
- `ATTACHMENT_HTTP_ERROR`
- `ATTACHMENT_SIGN_IN_PAGE`
- `ZIP_LIMIT_EXCEEDED`
- `ZIP_BUILD_FAILED`
- `DOWNLOAD_FAILED`

Attachment failures do not abort the whole export unless the ZIP itself cannot be created. Capture failures and ZIP failures are terminal. Cancellation produces no automatic partial ZIP.

All user-facing messages must include a next action and avoid implying that the extension can bypass Microsoft permissions.

## 10. Configuration

Persisted user options:

```ts
type UserOptions = {
  includeAttachments: boolean; // default true
  disclosureAccepted: boolean; // default false
};
```

Internal bounded defaults:

```text
scroll delay: 400 ms
history-load delay: 1100 ms
stable top cycles: 5
maximum scroll cycles: 5000
scroll step ratio: 0.78
attachment concurrency: 3
attachment timeout: 45 seconds
maximum single attachment: 2,000,000,000 bytes
maximum total attachments: 3,500,000,000 bytes
```

Only `includeAttachments` is exposed in version 0.1.0. Advanced timing and size limits remain internal until real user evidence justifies UI complexity.

## 11. Visual identity and store assets

### Brand rules

- Do not use the Microsoft Teams logo, Microsoft four-square mark, the letter `T` as a Teams imitation, or Microsoft-owned artwork.
- Use a custom rounded speech bubble combined with a downward archive/ZIP cue.
- The mark must remain legible at 16×16 and must not rely on embedded text.
- Listing copy includes an independent-product disclaimer.

### Palette

```text
Ink background:  #0B1220
Primary blue:    #2563EB
Export teal:     #14B8A6
Light surface:   #F8FAFC
Muted text:      #64748B
Warning:         #F59E0B
Error:           #DC2626
```

The runtime UI uses system fonts only and supports light and dark color schemes.

### Required assets

- Icons: 16×16, 32×32, 48×48, 128×128 PNG.
- Five real-product screenshots: 1280×800 PNG.
- Small promotional tile: 440×280 PNG.
- Optional marquee promotional tile: 1400×560 PNG.

### Screenshot narratives

1. **Export a Teams chat to one ZIP** — popup beside a visible conversation and archive file tree.
2. **Long chat? History loads automatically.** — in-page progress overlay during capture.
3. **Messages + accessible files** — archive attachments folder and report.
4. **Readable now. Structured for later.** — HTML, JSON, and CSV outputs.
5. **Processed locally. Nothing sent to us.** — browser-to-local-archive privacy diagram.

Store images must show the actual extension interface. Decorative mockups may be used only when clearly faithful to the shipping UI.

## 12. Store listing metadata

### English

**Name**

```text
Chat Exporter for Microsoft Teams — Files & ZIP
```

**Short name**

```text
Chat Export
```

**Manifest/store short description**

```text
Export Microsoft Teams chats with messages, images, accessible files and links to a private ZIP. Runs locally; no admin access.
```

**Primary headline**

```text
Export Microsoft Teams chat history with attachments
```

**Tagline**

```text
Messages and accessible files in one private ZIP.
```

### Full English listing copy

```text
Export a Microsoft Teams conversation and its accessible attachments to one private ZIP. The extension loads older messages automatically, preserves authors, timestamps, text, links, reactions, images and files, then builds the archive locally in your browser.

WHAT YOU GET

• chat.html — a readable, searchable transcript
• chat.json — structured data for scripts, analysis and AI tools
• chat.csv — one row per message for Excel and spreadsheets
• links.csv — links shared in the conversation
• attachments/ — accessible images and files
• attachments-report.csv — downloaded, skipped and failed items

HOW IT WORKS

1. Open a personal or group conversation in Teams on the web.
2. Click the extension icon.
3. Choose whether to include attachments.
4. Keep the browser tab open while the history loads.
5. Save the finished ZIP.

PRIVATE BY DESIGN

• Processing happens locally in your browser.
• No developer-controlled server receives your messages.
• No account, analytics or telemetry.
• No organization administrator access is required.
• Free and open source.

LIMITATIONS

The extension can only export content available to your signed-in account. Some OneDrive or SharePoint files may be unavailable because of permissions, expired links, tenant policy, CORS or deletion. Original links and error details remain in the attachment report.

Microsoft Teams is a trademark of Microsoft Corporation. This independent extension is not affiliated with or endorsed by Microsoft.
```

Translations must preserve the same claims and limitations. They must not introduce unsupported capabilities.

## 13. Documentation and public site

Required public documents:

- `README.md`: purpose, installation, usage, architecture, development, privacy, limitations, support, license.
- `docs/privacy-policy.md`: local processing, data categories handled, no transmission to developer, browser/Microsoft requests, retention, contact.
- `docs/support.md`: supported pages, troubleshooting, issue template guidance, security reporting.
- `docs/chrome-web-store-listing.md`: canonical listing copy, disclosures, screenshot text, localization checklist.
- `docs/chrome-web-store-pipeline.md`: initial item setup, credentials, upload modes, safeguards.
- `docs/release-checklist.md`: versioning, tests, real-tenant checks, screenshots, privacy declarations, store submission.
- GitHub Pages landing page with the H1 “Export Microsoft Teams chat history with attachments,” installation links when available, privacy statement, feature summary, limitations, and support links.

Planned educational pages may target search intent, but must be substantive documentation rather than duplicate doorway pages:

- `/how-to-export-microsoft-teams-chat-with-attachments/`
- `/download-teams-chat-history-without-admin/`
- `/teams-chat-export-html-json-csv-zip/`

## 14. Testing strategy

### Unit tests

- filename and ZIP path sanitization;
- CSV escaping and BOM output;
- attachment URL classification;
- SharePoint/OneDrive candidate generation;
- CRC32 and ZIP structure;
- message deduplication and richer-record merging;
- chronological sorting;
- attachment aggregation and filename collision handling;
- exported HTML URL rewriting and escaping;
- config bounds;
- host validation;
- stable top/loader state logic.

### DOM fixture tests

Fixtures cover at least:

- current `chat-pane-message` structure;
- fallback role/list-item structure;
- message groups and inherited authors;
- truncated messages and “See more” controls;
- ordinary links versus file cards;
- images, videos, blob URLs, and avatars;
- reactions;
- missing timestamps and IDs;
- virtualized message replacement;
- history loader states;
- unsupported page and missing scroller.

### Browser tests

Playwright verifies:

- popup supported and unsupported states;
- first-run disclosure;
- option persistence;
- injection and one-export-per-tab concurrency;
- progress overlay accessibility and cancellation;
- safe operation under an enforced Trusted Types policy;
- absence of prohibited HTML string sinks in UI construction;
- ZIP download trigger;
- archive entries and offline HTML behavior.

### Packaging and policy tests

- manifest version is 3;
- exact permission allowlist;
- no host permissions or static content scripts;
- no remote script URLs, `eval`, or `new Function`;
- no source maps, tests, secrets, or documentation in the store ZIP;
- all manifest-referenced files exist;
- icon dimensions are correct;
- package build is deterministic;
- source version, manifest version, ZIP filename, tag, and release metadata agree.

### Manual acceptance tests

Before store submission, test with signed-in accounts on both supported domains when available:

- short personal chat;
- long virtualized personal chat;
- group chat;
- text, reactions, links, images, Office documents, PDF, and unavailable attachment;
- include-attachments on and off;
- cancellation during history capture and file download;
- light and dark themes;
- Chrome stable and Microsoft Edge stable.

Manual results are recorded in the release checklist. CI must never use committed corporate credentials or captured private conversations.

## 15. CI and release pipeline

### Pull request and push CI

GitHub Actions uses Node.js 24 and performs:

1. checkout;
2. `npm ci`;
3. install Playwright Chromium and system dependencies;
4. syntax and policy checks;
5. unit tests;
6. fixture/browser tests;
7. production build;
8. deterministic ZIP build;
9. package allowlist validation;
10. upload the verified ZIP as a temporary workflow artifact.

### Chrome Web Store release workflow

Normal `main` behavior:

1. read version from `manifest.json`;
2. derive `v<version>` and skip idempotently if the tag already exists;
3. run the full verification suite;
4. build and validate `chat-exporter-for-teams.zip`;
5. authenticate to the Chrome Web Store API V2 using Workload Identity Federation where possible, with a service-account-key fallback;
6. upload the package in `UPLOAD_ONLY` mode;
7. save release evidence and logs as workflow artifacts;
8. create the GitHub tag and Release only after a successful store upload.

Manual dispatch supports:

- `UPLOAD_ONLY`;
- `STAGED_PUBLISH`;
- `DEFAULT_PUBLISH`.

Automatic pushes must never submit for public publication. A human decides when to submit for review or publish.

Required GitHub environment/secrets:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
GOOGLE_CREDENTIALS              # fallback only
CWS_PUBLISHER_ID
CWS_EXTENSION_ID
```

The first Chrome Web Store item, listing, privacy declarations, distribution settings, and extension ID must be created manually in the Developer Dashboard before automated updates can run.

### GitHub Pages

A separate workflow publishes the static landing page and public policy documents. Pages deployment must not depend on store credentials.

### Microsoft Edge

The validated Chromium ZIP is also uploaded as a CI artifact named for Edge compatibility. Edge Add-ons automation is deferred until official publisher credentials and API behavior are confirmed. The release checklist includes manual Edge submission from the same tested package.

## 16. Versioning and compatibility

- Semantic versioning.
- Initial public package: `0.1.0`.
- `minimum_chrome_version` is `109` for the initial release and is verified in package tests.
- Selector changes that restore compatibility are patch releases unless the exported schema changes.
- Any change to archive schema increments the schema identifier and documents backward compatibility.
- Any new permission requires a minor version, explicit changelog entry, privacy review, package test update, and store disclosure review.

## 17. Privacy and trademark statements

Canonical disclaimer:

> Microsoft Teams is a trademark of Microsoft Corporation. This independent extension is not affiliated with or endorsed by Microsoft.

The extension and listing must use original icons and visual identity. References to Microsoft Teams describe compatibility only.

The privacy policy must distinguish:

- data handled locally by the extension;
- requests sent directly by the user’s browser to Microsoft 365 while fetching the page and attachment URLs;
- data never received or retained by the extension developer.

## 18. Implementation source and migration

The existing browser script is the behavioral reference for:

- Teams DOM selectors and fallbacks;
- virtualized-history capture;
- message extraction and deduplication;
- attachment classification and download attempts;
- classic ZIP creation;
- HTML/JSON/CSV/report renderers;
- cancellation and progress reporting.

The source is not copied into production as one monolithic file. Behavior is migrated module-by-module behind tests. The corrected overlay implementation that avoids `ShadowRoot.innerHTML` is the required baseline; the original Trusted Types failure becomes a permanent regression test.

## 19. Acceptance checklist for version 0.1.0

- [ ] Manifest V3 package loads unpacked in Chrome.
- [ ] Only `activeTab`, `scripting`, and `storage` permissions are requested.
- [ ] Popup detects supported and unsupported pages.
- [ ] First-run disclosure is shown once and stored locally.
- [ ] Export starts only after an explicit user action.
- [ ] A short fixture chat exports expected messages and metadata.
- [ ] A virtualized fixture exports messages that disappear from the DOM.
- [ ] Stable-top logic stops without an infinite loop.
- [ ] Attachment successes, skips, and failures are represented in the report.
- [ ] ZIP contains the required files and opens with standard tools.
- [ ] Exported HTML is readable offline and sanitized.
- [ ] Trusted Types regression test passes without unsafe overlay sinks.
- [ ] Cancellation leaves no silently incomplete auto-downloaded ZIP.
- [ ] No data transmission, analytics, remote code, or broad host access exists.
- [ ] English and seven additional UI locales build successfully.
- [ ] Icons and store screenshots meet required dimensions.
- [ ] CI verifies tests, build, package allowlist, and deterministic ZIP.
- [ ] Release workflow defaults to upload-only and creates a GitHub Release only after successful store upload.
- [ ] Privacy policy, support page, listing copy, and release checklist are published.
- [ ] Manual tenant acceptance evidence is recorded before store submission.

## 20. Explicit design decisions

1. **One ZIP, all formats:** users do not choose HTML versus JSON versus CSV in the first release.
2. **No persistent content script:** code runs only after a user activates the extension.
3. **No broad host permissions:** supported-host checks happen inside temporary `activeTab` access.
4. **No backend:** local processing is both the product promise and the architecture.
5. **Attachments default on:** this is the primary differentiator; users can disable it from the popup.
6. **Partial attachment success is acceptable and visible:** every failure remains recoverable through reports and original links.
7. **Partial chat success is not silently acceptable:** capture limits produce a visible warning and release tests must guard against false completeness.
8. **Safe DOM construction:** runtime UI never uses string-to-HTML sinks.
9. **Chrome first, Edge compatible:** one Chromium package; Chrome automation first, Edge submission documented.
10. **Search-aware but policy-safe metadata:** natural task language, no hidden keywords, duplicate listings, or review manipulation.

## 21. Authoritative platform references

Implementation and release details must be checked against current first-party documentation before each store submission:

- Chrome Extensions Manifest V3 and `activeTab` documentation.
- Chrome Web Store user-data, listing, image, and program policies.
- Chrome Web Store API V2 upload and publish methods.
- Microsoft trademark guidelines for compatibility references and independent branding.

The repository documentation may summarize these requirements but must not copy large portions of third-party documentation.
