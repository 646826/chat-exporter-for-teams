# Chat Exporter for Microsoft Teams — Files & ZIP Implementation Plan

**Goal:** Ship a local-first Manifest V3 extension that exports the currently open Microsoft Teams personal or group chat, accessible attachments, and diagnostics into one ZIP.

**Architecture:** A minimal service worker injects an idempotent self-contained content bundle into the active Teams tab only after a user action. Source remains split into ES modules; a dependency-free build script creates the page-world bundle and a deterministic store package. Popup state and preferences stay in extension pages, while extraction, authenticated attachment fetches, archive construction, and progress UI run in the Teams page world.

**Tech stack:** JavaScript ES modules, Manifest V3, Node.js built-ins, Node test runner, headless Chromium fixtures, GitHub Actions, Chrome Web Store API V2.

## Global constraints

- Permissions are exactly `activeTab`, `scripting`, and `storage`.
- Supported hosts are exactly `teams.cloud.microsoft` and `teams.microsoft.com`.
- No backend, telemetry, analytics, remote executable code, broad host permissions, or static content scripts.
- Runtime UI must not assign strings to Trusted Types HTML sinks.
- Every discovered attachment receives a `downloaded`, `failed`, or `skipped` report row.
- A capture-cycle limit is terminal and never produces a silently partial ZIP.
- Store package is deterministic and contains runtime files only.

## Work packages

1. Repository metadata, manifest, localization, popup, and background injection.
2. Shared URL, option, error, filename, CSV, and abort utilities with unit tests.
3. Teams adapter, message model, virtualized capture, and DOM fixture tests.
4. Attachment download pipeline, renderers, ZIP writer, and archive tests.
5. Trusted Types-safe overlay, cancellation, and browser tests.
6. Dependency-free build, package validation, deterministic ZIP, and policy checks.
7. Icons, five store screenshots, promo tiles, listing copy, privacy/support docs, and SEO site.
8. CI, GitHub Pages, Chrome Web Store API V2 upload-only release workflow, and release evidence.
9. Full verification, local commits, and push to `main`.
