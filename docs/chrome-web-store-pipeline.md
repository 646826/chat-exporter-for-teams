# Chrome Web Store Pipeline

The repository uses Chrome Web Store API V2 and keeps upload, submission, and public release as separate states.

## Safety model

- `UPLOAD_ONLY` is the default for automatic and manual runs.
- Upload success never implies that the extension was submitted for review or published.
- `DEFAULT_PUBLISH` and `STAGED_PUBLISH` require an explicit manual workflow choice.
- API publication uses `blockOnWarnings: true`.
- `skipReview` defaults to `false` and is available only as an explicit manual input.
- A GitHub tag and Release are created only after a verified Web Store upload in the automatic version-change path.
- Secrets never appear in `release-evidence.json`.

## Workflows

### CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. checks out the repository;
2. installs the pinned npm metadata with Node.js 24;
3. locates a Chromium binary;
4. runs syntax, unit, browser, deterministic-build, and package-policy verification;
5. uploads the validated ZIP as a temporary GitHub Actions artifact.

### GitHub Pages

`.github/workflows/pages.yml` builds the static site into `site-dist/`, validates internal routes and required metadata, uploads the Pages artifact, and deploys it to the `github-pages` environment.

### Chrome Web Store release

`.github/workflows/chrome-web-store-release.yml` supports:

- a push to `main` where `manifest.json` changed to a new version;
- a deliberate manual dispatch.

The workflow:

1. resolves the manifest version and `v<version>` tag;
2. skips automatic delivery if that tag already exists;
3. runs the complete verification suite;
4. builds and validates `chat-exporter-for-teams.zip`;
5. stores the package as a workflow artifact;
6. authenticates to Google Cloud with short-lived credentials;
7. uploads the ZIP with Chrome Web Store API V2;
8. polls `fetchStatus` when upload processing is asynchronous;
9. optionally submits for review only when manually requested;
10. stores the API log and cryptographic release evidence;
11. creates a GitHub tag and Release only for a successful automatic version-change upload.

When store credentials are not configured, the workflow still verifies and publishes the build artifact, but it does not contact the Chrome Web Store and does not create a GitHub Release.

## First item setup

Chrome Web Store API V2 updates an existing item; it does not create the first item.

1. Register and verify the Chrome Web Store developer account.
2. In the Developer Dashboard, select **Add new item**.
3. Upload the validated `chat-exporter-for-teams.zip` once.
4. Complete the Store listing and Privacy tabs using `docs/chrome-web-store-listing.md`.
5. Set distribution and visibility deliberately.
6. Record the extension ID and publisher ID.
7. Complete the first manual publication when the Dashboard requires it, especially after a visibility change.

## Authentication

Use a dedicated Google Cloud service account and grant its email access in the Chrome Web Store Developer Dashboard.

### Preferred: Workload Identity Federation

Create the GitHub environment `chrome-web-store` and add:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
CWS_PUBLISHER_ID
CWS_EXTENSION_ID
```

The workflow requests an OIDC token with `id-token: write` and exchanges it for a short-lived access token scoped to:

```text
https://www.googleapis.com/auth/chromewebstore
```

### Fallback: service-account key

Add:

```text
GOOGLE_CREDENTIALS
CWS_PUBLISHER_ID
CWS_EXTENSION_ID
```

`GOOGLE_CREDENTIALS` contains the complete service-account JSON. Treat it as a password, rotate it after suspected exposure, and prefer Workload Identity Federation whenever possible.

Protect the `chrome-web-store` environment with required reviewers for manual publication modes.

## Manual release modes

Open **Actions → Chrome Web Store Release → Run workflow**.

### UPLOAD_ONLY

Uploads a draft package and stops. It does not call the publish endpoint. Use this for normal preparation and review in the Developer Dashboard.

### STAGED_PUBLISH

Submits the uploaded revision for review. After approval, the revision remains staged until a developer publishes it deliberately.

### DEFAULT_PUBLISH

Submits the revision for review and asks the store to publish it automatically after approval under the item's existing distribution settings.

### skip_review

Leave this `false`. Enabling it only asks the API to attempt review bypass for an eligible item; the request fails when the item is not eligible.

## Release evidence

A successful store call produces `release-evidence.json` with:

- repository, commit, version, and tag;
- package filename, byte size, and SHA-256;
- Web Store item resource name;
- upload and submission modes;
- uploaded CRX version and API state;
- non-secret warning details;
- verification timestamp.

The workflow stores this file and `cws-release.log` as an artifact. Automatic GitHub Releases include the validated ZIP and evidence file.

## Local API invocation

With a short-lived access token:

```bash
npm run build:zip
npm run validate:package

CWS_ACCESS_TOKEN='…' \
CWS_PUBLISHER_ID='…' \
CWS_EXTENSION_ID='…' \
CWS_PUBLISH_TYPE='UPLOAD_ONLY' \
node scripts/cws-release.mjs chat-exporter-for-teams.zip
```

Do not place credentials in `.env` files committed to the repository.

## Failure handling

- **Version already exists:** increase both `manifest.json` and `package.json` versions, update `CHANGELOG.md`, rebuild, and retry.
- **Upload state FAILED or NOT_FOUND:** inspect the API response and Developer Dashboard; do not create a tag.
- **Upload timeout:** check `fetchStatus` and rerun only after understanding whether the previous package was accepted.
- **Publish warning:** the request is blocked by design; resolve the warning before retrying.
- **Visibility mismatch:** publish once manually in the Dashboard after changing visibility.
- **Authentication failure:** verify the publisher ID, extension ID, service-account access, WIF audience/provider, and API scope.

Never force-create the release tag to make a failed pipeline look complete.
