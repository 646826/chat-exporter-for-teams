# Release Checklist

## 1. Product and privacy review

- [ ] The release still has one clear purpose: export the currently open Teams chat to one local ZIP.
- [ ] Permissions remain exactly `activeTab`, `scripting`, and `storage`.
- [ ] No host permissions, static content scripts, remote executable code, telemetry, analytics, or backend were added.
- [ ] New behavior is reflected in the first-run disclosure, privacy policy, listing, support guide, and changelog.
- [ ] Microsoft trademark usage remains nominative text only; no Microsoft or Teams logo is used.

## 2. Versioning

- [ ] Update `manifest.json` version.
- [ ] Update `package.json` version to the exact same value.
- [ ] Add a dated section to `CHANGELOG.md`.
- [ ] Confirm `v<version>` does not already exist.

## 3. Source verification

Run from a clean checkout:

```bash
npm ci
npm test
npm run build:site
```

Confirm:

- [ ] syntax checks pass;
- [ ] all unit tests pass;
- [ ] the real-Chromium Teams DOM fixture passes;
- [ ] Trusted Types enforcement passes;
- [ ] deterministic build test passes;
- [ ] package allowlist and icon dimensions pass;
- [ ] store-asset dimensions pass;
- [ ] site validation passes.

## 4. Manual extension acceptance

Test a non-sensitive account or prepared test tenant in current Chrome and Edge:

- [ ] personal chat with text only;
- [ ] group chat;
- [ ] long virtualized history reaching the beginning;
- [ ] formatted text, code, links, emoji, and reactions;
- [ ] inline image;
- [ ] OneDrive or SharePoint file that is accessible;
- [ ] intentionally unavailable file producing a report row;
- [ ] export with files disabled;
- [ ] cancellation during capture;
- [ ] cancellation during attachment retrieval;
- [ ] second export in the same tab;
- [ ] page reload after extension update.

Inspect the ZIP:

- [ ] standard archive software opens it;
- [ ] `chat.html` works offline;
- [ ] message order and first/last messages match Teams;
- [ ] JSON schema identifier is `chat-exporter-for-teams/v1`;
- [ ] CSV opens with Unicode text intact;
- [ ] every attachment candidate has one status row;
- [ ] downloaded HTML uses relative paths for included files;
- [ ] no access tokens or authorization headers appear in any output.

## 5. Store materials

- [ ] Validate the English title, short description, and long description.
- [ ] Upload store icon 128×128.
- [ ] Upload five English screenshots in order.
- [ ] Upload the 440×280 small promo tile.
- [ ] Upload the 1400×560 marquee only where useful.
- [ ] Verify privacy-policy and support URLs are live.
- [ ] Review localized metadata before publishing it.
- [ ] Reconfirm the extension is marked independent and not Microsoft-endorsed.

## 6. Delivery

Recommended normal path:

1. merge the version change to `main`;
2. verify the release workflow built and validated the exact ZIP;
3. confirm Chrome Web Store upload state `SUCCEEDED`;
4. inspect `release-evidence.json` and its SHA-256;
5. review the draft in the Developer Dashboard;
6. submit manually or rerun with `STAGED_PUBLISH` after approval;
7. verify the GitHub tag and Release were created only after successful upload.

## 7. Post-release

- [ ] Install the store build in a clean browser profile.
- [ ] Repeat a text-only export and an attachment export.
- [ ] Confirm the published version and listing assets.
- [ ] Verify the privacy and support pages.
- [ ] Monitor reviews and issues without collecting conversation data.
- [ ] Record any Teams DOM change as a fixture before changing selectors.
