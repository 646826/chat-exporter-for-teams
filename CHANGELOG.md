# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog, and releases use Semantic Versioning.

## [Unreleased]

## [0.1.0] - 2026-08-02

### Added

- Initial Manifest V3 extension for the currently open Microsoft Teams personal or group chat.
- Explicit active-tab injection with no static host permissions or persistent content script.
- One-time local-processing disclosure and an accessible one-action popup.
- Virtualized history traversal with message deduplication, chronological ordering, cancellation, position restoration, and terminal completeness limits.
- Message extraction for author, timestamp, ID, text, sanitized rich HTML, ordinary links, reactions, and attachment candidates.
- Authenticated attachment retrieval with concurrency, timeout, per-file and total-size limits, SharePoint download candidates, and complete status reporting.
- Local ZIP containing HTML, JSON, CSV, links, diagnostics, and downloaded files.
- Trusted Types-safe in-page progress overlay built without string HTML sinks.
- English, Russian, Ukrainian, Latin American Spanish, Brazilian Portuguese, German, French, and Polish extension localizations.
- Dependency-free deterministic build and ZIP packaging.
- Unit tests, real-Chromium DOM fixtures, CSP/Trusted Types regression coverage, and package-policy validation.
- Custom icons, five English store screenshots, two Russian screenshots, small promo tile, and marquee asset.
- Chrome Web Store listing, privacy, support, release documentation, and GitHub Pages source.
- CI, GitHub Pages, and Chrome Web Store API V2 release automation.

[Unreleased]: https://github.com/646826/chat-exporter-for-teams/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/646826/chat-exporter-for-teams/releases/tag/v0.1.0
