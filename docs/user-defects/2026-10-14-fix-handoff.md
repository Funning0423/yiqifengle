> **Updated continuation:** the missing-asset containment described below has been superseded by the verified v0.8 live meadow candidate in `19d719d`. See `2026-10-14-meadow-integration.md`. All defects still OPEN; actual import/render acceptance remains queued. The earlier receipt is preserved as historical evidence.

# Priority user defects — isolated candidate

All four defects in `2026-10-14-priority.json` remain **OPEN**. Current or older functional reports cannot close UI-SCALE by clickability, or REGION-MEADOW by a changed level/unlock flag. Character feet and seated pose remain owned by their existing cloud fix task; no character resource or code was changed here.

Baseline: `d8dafa166fe9789ffbca7fbaca600ee97f9bc75c`. The 2116 tracked files in the source working tree, Git baseline and isolated copy matched byte-for-byte before edits. Full input SHA256 evidence: `../input-hash-verification.json` relative to the repository root. Aggregate: `9e8fb384aa5a98f3ffe868c14a603e32a74a0684c13dfaee6354c6a7000ecba8`.

Branch: `fix/ui-scale-region-meadow`. Registration: `396c4e0`. UI fix: `e72609c`. Missing-scene guard: `f271b41`.

## Result layout candidate

The panel now measures its actual wrapped content instead of always taking up to 720 logical units. Normal reward cards are 96 units high with art fitted to 72×72; short viewports use up to 64-unit cards and 52×52 art, with smaller art only when the safe space forces it. Both icons and label belong to the full-width button's Face, so pressing/resizing uses one transform and one hit area. Claimed/locked rewards use matching card chrome; claimed stamps have separate badges. Rotation redraws card backgrounds to their current dimensions. Readable text, finite explicit pages, pointer ownership and modal cleanup remain required.

Node-only sample: 390×844 win with both rewards and missing-scene notice → 569-unit panel / 1 page; 320×568 → 544-unit panel / 2 pages; 844×390 → 366-unit panel / 1 page. These are logical node measurements, **not screenshots or design acceptance**.

## Meadow remains blocked

`creator-build-project/assets/bundles/region_meadow` contains only `audio/bgm_meadow.mp3` and its directory/asset metadata. There is no current meadow scene GLB, imported prefab, camera/anchor specification or wired scene lease. `RegionLoader.REGIONS` contains island and skycity only. The earlier sky-city background handoff also explicitly reports this absence (`cloud-tasks/RESULT-skycity-board-bg.md`). Existing chapter/seal pictures are UI art and cannot replace a meadow scene.

A pure scene-requirement guard now identifies mainline 05–08 and r05-meadow stages, rejects selection/entry/advance before exiting the completed level, and prevents `BoardArt` from silently selecting the island picture. The 04 result shows the unavailability and disables the misleading next action while retaining reward actions and return-home. Regional journal entry checks missing scenery before reading/recovering its active attempt. This is **containment**, not the requested real scene transition; it deliberately makes unavailable second-region stages inaccessible until a proper scene is supplied.

Required continuation: obtain the approved current model and provenance, Creator import UUID/meta, camera/anchors, ambient/shader/instancing contract; integrate a dedicated background/visit lease through RegionLoader; validate load/reveal, pause, resize, cancellation, retries and disposal. Do not merely add an unchecked `REGIONS.meadow` entry or remove the guard.

## Validation and queue

- `tools/board-ui/test_user_priority_defects.cjs`: PASS (missing-scene paths cannot exit/enter/recover/read saves; enlarged art inside card; unavailable Next cannot act; defects remain OPEN).
- `tools/board-ui/test_result_safe_area.cjs`: PASS, 10033 supported samples, 7660 checks. Five deliberately unsupported stress samples remain outside the support claim.
- `tools/board-ui/test_result_viewports.cjs`: PASS, 9673 geometry samples and 387 input checks. Tests now visit the target's content page and validate page-local geometry; the safety suite still requires complete action and text coverage across all pages. Rotation can retain multiple pages because cards are larger; stale presses must remain inert.
- `git diff --check`: PASS.

Reports: `../safe-area-evidence/summary.json`, `../result-viewports.json`, `../priority-defects-test.json` (relative to repo root), and the compact committed JSON receipt alongside this file. Run with `QF_TYPESCRIPT_MODULE` pointing to the locally available TypeScript package; no installation or service is needed.

Actual Cocos/phone visual review is **QUEUED** pending parent confirmation that task35's current test has ended. Review actual panel proportions, icon silhouette/readability, pressed-face behavior, claimed/locked states and short-screen pagination. No IDE, browser window, build service, task35 package/shared source or real save was touched. Source was neither uploaded nor published. The early parent-message tool could not resolve the source thread; this handoff and final response carry the result.
