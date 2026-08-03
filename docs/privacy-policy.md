# Privacy Policy

**Chat Exporter for Microsoft Teams — Files & ZIP**
Effective date: August 2, 2026

## Summary

Chat Exporter is a local-first browser extension. It reads the Microsoft Teams conversation that the user has explicitly opened, optionally requests file URLs available to the same signed-in browser session, and creates a ZIP archive on the user's device.

The developer does not operate a server for this extension and does not receive the conversation, attachment contents, shared URLs, filenames, contact names, export metadata, usage events, or error logs.

## Data the extension processes

After the user starts an export, the extension may process:

- message text and sanitized message formatting;
- author names, timestamps, message identifiers, reactions, and links rendered in the open conversation;
- attachment names, URLs, content types, sizes, and downloaded file contents that are accessible to the signed-in user;
- the current Teams page URL and visible conversation title;
- local preferences: whether accessible files are included and whether the first-run disclosure was acknowledged.

These values are needed to create the requested archive and display progress.

## How data is used

Conversation data is used only to:

1. traverse and capture the open chat;
2. retrieve accessible files when the user enables that option;
3. render the local HTML, JSON, CSV, link, and diagnostic files;
4. assemble and download the ZIP archive;
5. display local progress and errors.

The extension does not use conversation data for advertising, profiling, credit decisions, analytics, machine-learning training, or any purpose unrelated to the user-requested export.

## Data transmission

The extension does not transmit conversation data to the developer or to a developer-controlled third party.

Microsoft Teams and Microsoft 365 continue to communicate with Microsoft services as part of the website. When the user includes files, the extension may make authenticated requests from the active Teams page to Microsoft-hosted URLs such as Teams media, OneDrive, or SharePoint. Those requests are governed by the user's Microsoft 365 account, organization policies, and Microsoft's terms and privacy practices.

## Storage and retention

The extension stores only non-sensitive preferences in Chromium extension storage:

- first-run disclosure acknowledgement;
- include-accessible-files preference.

Conversation data and file contents are held in browser memory only for the duration of the export. The resulting ZIP is saved to the location selected or configured by the user's browser. The extension does not keep a separate copy.

Users can clear extension preferences by removing the extension or clearing its site/extension data in the browser.

## Permissions

The extension requests:

- `activeTab` to access the current tab after an explicit user action;
- `scripting` to inject the local export code into that active Teams tab;
- `storage` to save the two non-sensitive preferences described above.

The extension does not request broad host access, cookies, identity, webRequest, browsing history, native messaging, or persistent access to every Teams page.

## Security measures

The project uses Manifest V3, bundles all executable code locally, prohibits remote scripts and dynamic code evaluation, constructs runtime UI without unsafe string HTML sinks, sanitizes exported HTML, escapes generated fields, validates archive paths, and tests the release package against an explicit allowlist.

No software can guarantee absolute security. Users should protect exported ZIP files because they may contain confidential conversation data and attachments.

## Limitations controlled by Microsoft 365

The extension cannot bypass permissions, retention rules, Conditional Access, cross-origin restrictions, expired links, deleted files, or tenant policy. Unavailable files are recorded in the local diagnostic report rather than silently omitted.

## Children's privacy

The extension is a general productivity tool and is not directed to children. The developer does not knowingly collect personal information from any user because the extension has no collection endpoint.

## Changes

Material changes to this policy will be documented in the repository history and reflected by an updated effective date. Changes that require new permissions or new data uses will also be disclosed in the extension listing and release notes.

## Contact

Privacy questions can be sent to `646826@gmail.com`.

## Trademark notice

Microsoft and Microsoft Teams are trademarks of the Microsoft group of companies. This independent extension is not affiliated with, endorsed by, or sponsored by Microsoft.
