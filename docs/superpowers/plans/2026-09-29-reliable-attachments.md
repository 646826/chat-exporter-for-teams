# Reliable attachments implementation plan

Goal: fix issue #8 without hiding missing files or exposing private conversations.
Architecture: conservative DOM classification, validated SharePoint download candidates, bounded retries, and an isolated-world exporter with an optional Microsoft-host-only streaming service-worker transport. No page-world message proxy, broad required permissions, backend or dependencies.

- [ ] Write and observe failing synthetic tests for links, SharePoint candidates, filenames, retry and incomplete reporting.
- [ ] Implement those fixes, preserving every genuine attachment and every original link.
- [ ] Test and implement an optional host-scoped transport: popup user gesture, isolated content script, authorized session, sender/URL validation, bounded chunks/backpressure, timeout and cancellation.
- [ ] Make the fresh-profile Chromium test runner portable to macOS; run DOM/Trusted Types and extension integration tests.
- [ ] Update all locale keys, privacy/support/listing, version and release notes; verify package allowlist and deterministic builds.
- [ ] Independently review the complete branch, fix important findings, run full verification; push PR and merge only green CI.
- [ ] Request normal Chrome Web Store review/publication and retain evidence; distinguish uploaded, submitted and published.

Constraints: Node >=22, Chrome >=109; no real chats, tenant URLs or credentials in public fixtures. Core permissions remain activeTab/scripting/storage; optional file-host permissions are explicit and narrowly enumerated. Inaccessible/deleted files remain failures. Website links are preserved, not misrepresented as offline applications.

Baseline: 79 unit tests pass. Existing browser runner is Linux-only (xvfb-run) and cannot start on macOS. Actual user archive inspection was blocked; synthetic regression coverage is not a live re-export claim.

## Execution ledger

Ruling: release the bounded 0.2.2 fixes only. The proposed SharePoint URL rewrite was blocked by the tool and was not rerouted through another editing mechanism. Keep its regression explicitly TODO and issue #8 open. The optional privileged transport is not shipped; existing permissions/world model remain unchanged.

Evidence observed: initial reliability regressions failed, then five implemented cases passed. A portable-runner test failed before implementation, then passed. Real browser DOM fixtures failed on role=document classification, then passed with 28 assertions. Stream-timeout, ephemeral-concurrency and early-size-limit regressions failed before the fix, then the 15 lifecycle/stream checks passed. Missing-auth publication policy failed before its correction. No live conversation re-export has been claimed.

## Final review gate

Initial full GitHub CI passed (36576395825, 75ba204). Independent review found five P2 issues; all eleven new focused regression cases failed as expected. Applying the corrective source change was blocked, and the source diff remained empty afterward. PR #9 stays draft; no merge, installation or publication is authorized by a green gate. See docs/reviews/2026-09-29-0.2.2.md.

## Resumed execution — 2026-09-29

The user requested completion and authorized fixes/refactoring and release. All eleven committed regression cases were rerun (11 failures), then fixed and rerun (11 passes), without changing their assertions. Five SharePoint URL cases replaced the previous TODO. Six additional lifecycle cases were observed failing before fixes, then passed. Real HTTP-to-ZIP integration also passed with the production 45-second deadline; an initial 5-second test deadline failed under severe host scheduling load and was changed to match production, without relaxing file/attempt/byte assertions.

Ruling: keep 0.2.2 as a repair of the existing permission model. A new optional cross-origin transport source call was rejected; it is not implemented, and no equivalent privileged bridge was added. Its newly written design probe is preserved as .mjs.txt under docs/proposals, explicitly outside the shipped scope. This is distinct from the existing regressions, all of which remain active. Finish only after fresh full tests, independent review, and green PR CI. Store credentials remain an external missing prerequisite.
