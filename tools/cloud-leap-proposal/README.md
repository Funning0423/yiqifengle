# Full-trajectory leap corridor research

## Result

- **88/88** research candidates and **88/88** production reader/selector plans have a full, UI-free fish trajectory.
- Base matrix: 320×568, 390×844, 402×874, 568×320, 844×390 × WeChat capsule off/on × 1–4 goals = 40.
- Additional physical-safe-area matrix: both landscape sizes × 44px left/right/both side exclusions × capsule off/on × 1–4 goals = 48.
- Geometry includes actual Board Graphics, in-memory Sprite alpha bounds, full Label rectangles, first/last goal, all tool badges/labels, and the union of neutral/first/last armed-slot visuals. It also unions conservative production AABBs for board frame, utilities and slots.
- The fish body's complete 76×44 rectangle plus the complete 21×34 tail at pivot (-29.5, 0) remain inside the available sea area for the entire 1800ms arc. Tail angle is bounded analytically over [-0.28, +0.28], not just sampled at a favorable phase.
- These are **offline geometry checks and diagrams**, not Cocos/WeChat native rendering, touch, FPS or visual acceptance. The 568×320 side-notch fallback uses a small 26px fish with an 8px horizontal/22px vertical hop. Review its appearance in the provider animation and on device.

## Interfaces and units

`chooseLeapCorridor({ width, height, horizon, rectangles, safe?, boardRect? })` returns a plan or `null` when no profile fits.

- Coordinates and fishWidth/scale are in actual screen pixels, with origin at top left and Y downward.
- Rectangle shape: `{ name?, kind?, left, right, top, bottom }`.
- `safe` is the physical OS safe-area rectangle. Board layout reservations, such as a 100px right inset to avoid a capsule, are **not** physical exclusions. The capsule has its own rectangle.
- The board rectangle is supplied explicitly or found by name `IslandBoardCarving` / kind `board`. It only determines side/footer preference.
- The output contains `startX, surfaceY, span, lift, drop, scale, fishWidth, durationMs`, plus the complete `sweep` and `clearRect`.
- Pose: `p = elapsedMs / 1800`; `x = startX + span*p`; `y = surfaceY + drop - sin(PI*p)*lift`; `angle = atan2(-lift*PI*cos(PI*p), span)*0.55`.
- For the existing 390-wide logical backdrop, multiply startX, surfaceY, span, lift, drop **and scale** by `390 / actualWidth`. Do not apply another device scale to fishWidth first.
- Use the corridor's own surfaceY for its ripple and underwater-alpha relation. Keep fish behind the Board/HUD.

## Eight precomputed profiles

`profiles.cjs` is the complete certified numeric table. The original seven chosen profiles remain unchanged. The added eighth is fishWidth=26, span=8, lift=22, drop=9.428571428571429.

Its local sweep is [-14.544374, 22.544374] × [-25.677943, 24.090293], i.e. 37.088748×49.768236px. It covers the eight 568×320 cases with a left or both-side physical exclusion and capsule disabled. No per-frame or per-resize 1801-point sampling is needed in production.

The offline certification samples each profile at 1ms, expands by a global derivative bound for the nearest 0.5ms plus 0.001px numerical guard, and rounds every extent outward. Maximum corner radius <49.5 logical pixels includes the tail pivot. The analytic tail range means the guard does not assume a specific tail-animation phase.

## Lifecycle and compatibility

Read geometry only after Board rendering positions goals and slots. On resize, hide the leap and mark layout pending until the post-render read completes. Recompute once, not every frame. Hide the leap when a layout is unavailable or no profile fits.

The checked Board is the tactile-tool build SHA 91f45984efb11c23435a01793d42f57fee01955561a626208d04d6860b13dccf. The production reader checks ToolWoodBase readiness; old full-width tray layouts require their complete tray rectangle and are not certified by this matrix.

## Run

From a checkout containing the current production Board/background files:

```
node tools/cloud-leap-proposal/test_profiles.cjs
node tools/cloud-leap-proposal/test_corridors.cjs
QF_REQUIRE_ALL_PLANS=1 node tools/cloud-leap-proposal/test_reader_independent.cjs
node tools/cloud-leap-proposal/diagram.cjs
```

All source resolution defaults to the current repository. To read a separate verified source checkout, set `QF_LEAP_SOURCE_ROOT=/absolute/path/to/checkout`. Tests never patch source, write saves, claim rewards or invoke touch actions. `test_reader_independent` executes the production geometry reader and selector, then checks its plan against separately measured draw geometry. Source hashes are checked before and after each run.

Large regenerated JSON/PNG files live under evidence/cloud-leap-proposal and are not included in the compact test commit. `verification-summary.json` binds the full reports by SHA-256 and records every scenario result. All research files are outside game assets: packaged asset delta 0B, production source delta 0B in this research commit.
