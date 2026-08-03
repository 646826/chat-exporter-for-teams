# Security Policy

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

Do not include private chat content, Microsoft 365 tokens, signed URLs, tenant identifiers, or exported archives in a public GitHub issue.

Report a suspected vulnerability privately to `646826@gmail.com` with:

- the affected extension version;
- Chrome or Edge version;
- a minimal reproduction that contains no real conversation data;
- expected and observed behavior;
- whether any user data left the local browser context.

The project intentionally has no telemetry or backend, so a useful local reproduction is important.

## Security boundaries

The extension does not bypass Microsoft 365 permissions, retention, Conditional Access, CORS, or tenant policy. It can only inspect content rendered in the active Teams tab and request files accessible to the signed-in session.
