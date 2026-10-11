# Native Cocos board handoff - 2026-10-09

Branch: cocos/native-board-ui-20261009. Base: 2a320f93b86625e7d59ebbd32a52e2868f993ce6.

NativeBoardUI builds a Cocos Canvas, orthographic UI camera, Graphics and Label nodes. 49 cells use native TOUCH_START/MOVE/END/CANCEL. Adjacent taps or a swipe invoke the unchanged R4 COMPAT preview/commit seam. Scalar goals and moves, shape/color tiles, moss/root/beacon markers, selection (first three tide stages), result, pause, exit and resume are native Cocos nodes. The tool slot is reserved and disabled; inventory, drag effects and rewards are not implemented. The HTML board is removed from this branch; the Web template only provides the full-screen canvas shell.

FirstsliceBoot keeps the original model/material/probe setup and initializes NativeBoardUI. No role, scene, GLB, anchors, collision, R4 COMPAT or material-candidate source file changed. 30 protected files match the base byte for byte. 1041 old project files retain their SHA256.

Actual Creator 3.8.8 Web build exit: 36. Chromium 149 touch emulation passed native stage selection, swipe, hide/show during animation with stale timer cancellation, pause input blocking, exit/reentry via native buttons, controlled cold reload then explicit resume, eight touch actions winning with score 910 and four moves left, saved-result reload, and next stage unlock. Errors: none. Swaps are real browser touch events; lifecycle simulation and cold reload use the diagnostic seam. Persistence remains a disposable in-memory Map. Real user storage, actual phone input, OS background transitions and phone performance are not tested. Original keys and contracts remain unchanged; legacy keys are never accessed.

Reproduce: official Creator with tools/web-build-options.json; python3 tools/serve_native_ui.py; node tools/test_native_ui.cjs. The test references the existing local Playwright/Chromium installation. Final screenshots: output/native-ui/02-board.png and 05-result.png. Runtime report: evidence/native-ui-runtime.json. Scope/boundary evidence: evidence/native-ui-boundary-check.json. No WeChat build/upload/publish or editor-window close was performed in this stage.

Old branch/commit and artifacts remain available for rollback. Merge only this UI/input/adapter delta; protect any independently modified files using the delta manifest base hashes.
