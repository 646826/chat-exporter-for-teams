# Markdown transcript in exported archives

Each newly generated ZIP includes `chat.md` alongside `chat.html`, `chat.json`, `chat.csv`, the link/attachment reports, README and accessible attachment files. Extract the ZIP and keep `chat.md` beside the `attachments/` directory to use its relative file links in a Markdown reader.

The Markdown transcript contains the chat title, source URL, export date, ordered messages, authors, available timestamps and message IDs, attachment statuses, ordinary links and reactions. Downloaded attachments point to their local archive path. Failed or skipped attachments retain their status and reason, with an original link when its scheme is safe for linking.

## Text fidelity, not rich-text conversion

Message text is preserved inside fenced `text` blocks. The enclosing fence is longer than any backtick run in the message, so embedded code fences, indentation, multiline text and HTML-like text remain literal. Use `chat.html` for the existing rich-text presentation; this feature does not convert captured HTML formatting into Markdown. Metadata is escaped and unsafe URL schemes are not emitted as clickable Markdown destinations.

No existing archive entry is removed or renamed. The JSON format identifier remains `chat-exporter-for-teams/v1`; scripts reading that JSON do not need a schema migration. Consumers that require an exact ZIP entry allowlist should permit the additional `chat.md` file.

This feature does not change which messages or files Teams exposes, bypass Microsoft 365 permissions, repair missing captured data, or transmit the transcript to another service. The file remains local until the user chooses to share it. Remote attachment links still depend on access rights and validity.

## Verification

Run `node --test tests/unit/markdown-export.test.mjs`. The tests cover literal text, longer code fences, Unicode metadata, safe links, local attachment paths, failed/skipped records, empty messages and input immutability. An integration test builds and reads an actual ZIP and checks the additional Markdown file, every previous entry, and attachment bytes.

Before store publication, also run the full repository verification and a manual export in a signed-in Teams session. Open the extracted `chat.md` in the intended Markdown reader and verify the first/last messages and local file links. Passing synthetic tests is not proof of completeness for every live Teams DOM variant.
