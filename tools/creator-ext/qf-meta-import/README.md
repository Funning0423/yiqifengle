# qf-meta-import (Creator 3.8.8 one-shot project extension)

Purpose: let Creator generate the 9 r4 new-regions `.meta` files (list in `list.js`) without clicking through the UI.
It never writes a `.meta` itself: it waits for `asset-db` `query-ready`, calls `refresh-asset` on each new asset URL,
reads the files Creator wrote, checks importer + uuid against `list.js` (= exact `allowAdd` entries in meta-allowlist.json),
writes `<project>/meta-import-ext.log.json`, a marker `.qf-meta-import.done`, prints `[qf-meta-import] DONE` and quits after 5 s
(`QF_META_IMPORT_NO_QUIT=1`: stays open, the tester closes Creator by PID).

Install on the Mac (DevTools closed, `.build.lock` held): copy this folder to `creator-build-project/extensions/qf-meta-import`,
open the project in Creator 3.8.8, enable it in the Extension Manager if it is not enabled (same known risk as qf-meadow-encode:
new project extensions start disabled). Then remove `extensions/qf-meta-import` again; it is never committed into the project.
