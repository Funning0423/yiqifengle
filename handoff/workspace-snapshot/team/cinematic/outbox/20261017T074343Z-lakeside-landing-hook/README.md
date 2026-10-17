# 风铃湖畔 landing→board 1 s hook (运镜bot), camera only, local branches, not pushed

| base | branch | SHA | tree | suite |
|---|---|---|---|---|
| be1cd5a | cine/lakeside-hook-on-be1cd5a | 7e4a4a619004a6809e97e7b824b4c550921b6566 (parent 0c9a9ed = f49ce47 cherry-pick) | bc049d93ed580116155f0841ed06edb0d2e64fa5 | 63/68 = baseline 62/67 + the new hook test |
| r2 228df2f | cine/lakeside-hook-on-r2 | 26be951cc0b3b6f7f072b0c19345274bdc7cae1d (parent d9f5c3e) | c33a48a8f2fbb8fc396d90696bb3075f752c749f | 65/70 = r2 64/69 + the hook test |

The suite fails the same 5 tests on both bases: production-integrity, legacy-board-ui-pure, reward-background-return, navigation-guard (BLOCKED_BROWSER), cloud-web-contract. All lakeside tests pass, including the new lakeside-landing-hook.

Cherry-picking onto r2 has ONE trivial conflict, in tools/journey-integration/run-suite.cjs (the line that lists the tests; r2 added lakeside-daynight and lakeside-static-merge there). It was resolved by keeping both. Use patches-on-r2/ for r2.

## What the hook does
- region/LakesideLandingHook.ts lakesideLandingToBoard({stageId,journey,deps}):
  - waits for prewarmLakesideAssets (at most 3 s of frames; a failure or timeout is logged and the blend still runs);
  - reads the world camera, and skips (plain cut, logs not-at-landing) if the view or FOV differs from the landing END by more than 0.5°;
  - moves the camera to the board camera pose over 1 s: position lerp + direction slerp + FOV lerp on one smootherstep, so the velocity is 0 at both ends and nothing overshoots;
  - the last frame is exactly boardWorld, which is where the board's own lease camera (boardLocal) starts, so the scene swap happens at the same pose;
  - never rejects; with no deps it resolves at once (the old cut).
- WorldNativeComposition passes in the deps (world camera via applyCameraPose, a frame clock via scheduleOnce, the UI viewport, boardSafeInsets, prewarm).
- ui/BoardLayout.ts gets boardSafeInsets(w,h), the exact body of ManagedMobileBoardUI.safeInsets, moved there so the hook predicts the board UI frame exactly. ManagedMobileBoardUI now just calls it. This is a pure refactor with no behaviour change.
- LakesideCameraLayout: the landing END is now referenced to 390x844 with the UI's default safe insets (arrivalPitchDeg -2.507461, arrivalFovDeg 57.35256).

## Residual gap the hook closes (position is always ~1e-15 m)
| screen | view deg | FOV deg | peak turn deg/s |
|---|---|---|---|
| 390x844 | 0.000001 | 0.000004 | 0 |
| 414x896 | 0.67 | +0.02 | 1.26 |
| 360x780 | 1.78 | -2.16 | 3.33 |
| 375x667 | 2.26 | -3.71 | 4.23 |
| 390x520 | 2.57 | +13.97 | 4.81 (FOV rate peak 26 deg/s) |

Per-frame data (t, dt, position, forward, fov, angular velocity, displacement, FOV rate) are in curves/hook_perframe_7e4a4a6.json; the plot is curves/hook_perframe_7e4a4a6.png.
