# Chrome Web Store Listing

## Product identity

**Name**

```text
Chat Exporter for Microsoft Teams — Files & ZIP
```

**Short name**

```text
Chat Export
```

**Category**

```text
Tools
```

**Primary language**

```text
English
```

**Manifest description**

```text
Export Microsoft Teams chats with messages, images, accessible files and links to a private ZIP. Runs locally; no admin access.
```

**Tagline**

```text
Messages and accessible files in one private ZIP.
```

## Detailed description

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
3. Choose whether to include accessible files.
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

Version 0.1.0 targets the currently open personal or group chat. It does not export channel posts or an entire tenant.

Microsoft Teams is a trademark of Microsoft Corporation. This independent extension is not affiliated with or endorsed by Microsoft.
```

## Single-purpose statement

```text
The extension exports the currently open Microsoft Teams personal or group conversation and accessible attachments into one local ZIP archive containing readable, structured, and diagnostic files.
```

## Permission justifications

### activeTab

```text
Provides temporary access to the Teams tab only after the user opens the extension and starts an export. The extension has no persistent host access.
```

### scripting

```text
Injects the bundled local exporter into the explicitly activated Teams tab. Page-world execution is required to read the rendered virtualized conversation and request files using the current signed-in Microsoft 365 context.
```

### storage

```text
Stores only the first-run disclosure acknowledgement and the user's include-accessible-files preference. Conversation content is not persisted in extension storage.
```

## User-data disclosure summary

```text
The extension handles website content and personal communications only to create the user-requested local archive. Data is processed in browser memory and is not transferred to the developer or used for unrelated purposes. Optional file requests go directly to the Microsoft-hosted URLs available to the signed-in user.
```

## Privacy policy URL

```text
https://646826.github.io/chat-exporter-for-teams/privacy/
```

## Support URL

```text
https://646826.github.io/chat-exporter-for-teams/support/
```

## Homepage URL

```text
https://646826.github.io/chat-exporter-for-teams/
```

## Assets

| Asset | Path | Dimensions |
|---|---|---:|
| Store icon | `store-assets/store-icon-128.png` | 128×128 |
| Screenshot 1 | `store-assets/screenshots/en/01-export-one-zip.png` | 1280×800 |
| Screenshot 2 | `store-assets/screenshots/en/02-long-chat-progress.png` | 1280×800 |
| Screenshot 3 | `store-assets/screenshots/en/03-messages-and-files.png` | 1280×800 |
| Screenshot 4 | `store-assets/screenshots/en/04-html-json-csv.png` | 1280×800 |
| Screenshot 5 | `store-assets/screenshots/en/05-local-processing.png` | 1280×800 |
| Small promo tile | `store-assets/small-promo-440x280.png` | 440×280 |
| Marquee | `store-assets/marquee-1400x560.png` | 1400×560 |

Russian-localized screenshot 1 and 2 are available under `store-assets/screenshots/ru/`.

## Screenshot captions

1. **Export a Teams chat to one ZIP** — show the popup, the active chat, and the archive tree.
2. **Long chat? History loads automatically.** — show virtualized-history progress and counts.
3. **Messages + accessible files** — show attachment folder and diagnostic rows.
4. **Readable now. Structured for later.** — show HTML, JSON, and CSV outputs.
5. **Processed locally. Nothing sent to us.** — show browser-to-local-archive flow with no developer cloud.

## Search phrases used naturally in the listing and site

- teams chat export attachments
- export Teams chat with files
- Teams chat export ZIP
- Microsoft Teams chat to ZIP
- download Teams chat history

Do not add a keyword list to the public listing or repeat phrases unnaturally.

## Localization

The extension package includes UI strings for:

- English;
- Russian;
- Ukrainian;
- Spanish (Latin America);
- Portuguese (Brazil);
- German;
- French;
- Polish.

The Developer Dashboard listing should use localized descriptions only after a native-language review. Do not machine-publish unreviewed long descriptions.
