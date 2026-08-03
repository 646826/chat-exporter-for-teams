# Support Guide

## Before exporting

1. Use a current Chromium-based Chrome or Microsoft Edge build.
2. Sign in to Microsoft Teams on the web.
3. Open the conversation itself, not the **Files** tab or only the chat list.
4. Wait until visible messages have loaded.
5. Keep the tab open and avoid switching conversations until the ZIP is ready.

## “Open a Teams conversation”

The extension only runs on:

- `https://teams.cloud.microsoft/`
- `https://teams.microsoft.com/`

Open a personal or group chat, reload the Teams tab, and open the extension again. Version 0.1.0 does not claim support for channel posts.

## “No messages were found”

Teams may still be loading, the wrong view may be open, or Microsoft may have changed the rendered DOM.

Try these steps in order:

1. reload the Teams tab;
2. open the exact conversation again;
3. wait for several messages to become visible;
4. run the export again;
5. confirm the issue in both `teams.cloud.microsoft` and `teams.microsoft.com` when your account supports both.

When reporting the problem, do not attach a real conversation or screenshot containing private data. Include the extension version, browser version, Teams domain, whether the chat is personal/group/meeting, and the exact error text.

## A long chat stops before completion

The exporter uses a bounded completeness check. It does not produce a ZIP when it reaches the configured capture-cycle limit before confirming the beginning of the conversation. This avoids presenting a silently incomplete archive as complete.

Reload Teams and retry while keeping the tab in the foreground. Very large histories may require Teams to load several batches at the top. A future release may add a user-visible advanced limit after more tenant testing.

## Some files are missing

Open `attachments-report.csv` and `failed-attachments.html` inside the ZIP. Each attachment candidate has one status:

- `downloaded` — included under `attachments/`;
- `failed` — the request did not return a usable file;
- `skipped` — disabled by preference or blocked by an explicit size limit.

Common causes include:

- the signed-in account no longer has access;
- the file was deleted or its URL expired;
- OneDrive or SharePoint returned a viewer/sign-in HTML page instead of the file;
- tenant Conditional Access requires another interaction;
- browser cross-origin policy blocks the request;
- a file or the whole archive exceeds classic ZIP limits.

Open the original link in `failed-attachments.html` while signed in to Microsoft 365 and download the file manually when permitted.

## The ZIP download did not start

The progress panel keeps a **Download ZIP** button after the archive is ready. Click it once. Also check:

- Chrome download permissions and automatic download settings;
- whether the browser showed a save dialog behind another window;
- available disk space;
- endpoint security software that may block Blob downloads.

Do not close or reload the Teams tab before saving the ZIP.

## The exported HTML contains less formatting than Teams

The transcript deliberately removes scripts, iframes, event handlers, page-specific classes, inline styles, and form controls. This protects the offline export and keeps it portable. Text, safe formatting, links, and downloaded assets are preserved where possible.

## Cancelled export

Cancellation stops capture or file requests and does not generate a partial ZIP. Run the extension again to retry.

## Filing an issue

Public issues: `https://github.com/646826/chat-exporter-for-teams/issues`

Include:

- extension version;
- Chrome/Edge version and operating system;
- Teams domain;
- chat type;
- approximate message and attachment counts;
- exact phase and error message;
- steps that reproduce the issue with non-sensitive test content.

Never include access tokens, signed attachment URLs, real chat archives, names, email addresses, or confidential screenshots.

Security or privacy reports should be sent privately to `646826@gmail.com`.
