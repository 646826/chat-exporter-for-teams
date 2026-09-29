# Deferred optional SharePoint transport

The proposed new permission-gated cross-origin transport is NOT implemented or shipped. Its source-creation call was rejected by the execution tool in this session. No host permissions, content-script world changes or privileged bridge were applied.

The accompanying .mjs.txt is a preserved design probe for this unimplemented subsystem, not a passing test or a runtime file. It is outside the release test suite because the release scope does not include this subsystem. Existing production regression tests remain active and unchanged.

Version 0.2.2 fixes the existing downloader and generates better SharePoint viewer-download candidates with its current signed-in page-context transport. Browser CORS and Microsoft authorization policies can still prevent access and must remain explicit failures. Do not describe this candidate as a universal file downloader.
