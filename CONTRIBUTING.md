# Contributing

Contributions are welcome, especially reproducible Microsoft Teams DOM fixtures, selector updates, accessibility improvements, and privacy-preserving tests.

## Before opening a pull request

1. Create an issue for behavior changes that affect scope, permissions, privacy, archive schema, or store claims.
2. Use synthetic test conversations only. Never commit real chat content, signed Microsoft 365 URLs, tokens, tenant identifiers, email addresses, or confidential screenshots.
3. Keep the extension local-first and dependency-free unless a separate design review justifies a change.
4. Do not add host permissions, static content scripts, telemetry, remote code, or new data uses without updating the design, privacy policy, listing, and permission tests.
5. Write a failing test first for production behavior changes.
6. Run the complete verification suite.

```bash
npm ci
npm test
```

## Coding principles

- Prefer small modules with one responsibility.
- Keep the page-world bundle deterministic and free of remote executable code.
- Construct runtime UI with safe DOM APIs; do not assign strings to HTML sinks.
- Treat capture incompleteness as an error, never as a successful partial export.
- Give every attachment candidate a final `downloaded`, `failed`, or `skipped` record.
- Preserve backwards compatibility of `chat-exporter-for-teams/v1` unless a versioned schema change is deliberate.
- Keep user-facing copy honest about Microsoft 365 permission and policy boundaries.

## Fixtures

A useful DOM fixture should:

- contain synthetic names and content;
- isolate one Teams rendering pattern or regression;
- include the minimum attributes needed to reproduce the behavior;
- assert public behavior rather than internal implementation details;
- run under the enforced Trusted Types policy.

## Commit messages

Use concise conventional prefixes such as:

```text
feat: support a new Teams message structure
fix: preserve grouped message authors
security: harden exported link handling
test: cover attachment viewer responses
docs: clarify Web Store setup
```

## Release-sensitive changes

Changes to permissions, the archive schema, privacy statements, supported chat types, or release automation require explicit review and matching documentation updates.
