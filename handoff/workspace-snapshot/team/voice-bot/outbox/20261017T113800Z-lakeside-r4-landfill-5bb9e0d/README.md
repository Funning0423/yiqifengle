# Lakeside r4 land fill on GGbot 5bb9e0d (Voice Bot)

Branch `voice/build05-lakeside-r4-landfill-5bb9e0d`, HEAD **467b36d495ccd456201bcb16f82b82ac8eae5aa6**. Base: `ggbot/build05-r4-journey-fixes` 5bb9e0da057efde43879b7cd1e98adf8f09c7788.
The land-fill commits from c7141d6 (outbox 20261017T111632Z-lakeside-r4-landfill) were cherry-picked onto 5bb9e0d with no conflicts.

| commit | what |
|---|---|
| b131471 | flat emissive fill on the landform GLBs only, per mode from lakesideModeLighting (board + journey) |
| b8bd243 | test tools/lakeside/test_lakeside_land_fill.cjs (suite id lakeside-land-fill) |
| 6902ba3 | test regex fixups (es5-iterator-spread, journey-water-prewarm accept the new code) + `lakesideModeLighting(mode).skyDomeColor` |
| 467b36d | separate small commit: GGbot's `lakesideSkyDomeColor(mode)` reads `.skyDomeColor` (one line) + his sky-follow test expectation |

- `patches/`: `git format-patch 5bb9e0d..467b36d`, 4 patches. `git am` on 5bb9e0d gives a tree identical to 467b36d.
- `lakeside-r4-landfill-5bb9e0d.bundle`: `5bb9e0d..voice/build05-lakeside-r4-landfill-5bb9e0d`. `git bundle verify` reports it okay.
- Global lights (sun, ambient, exposure, clear colour) are exactly as in r4.

## Sky dome colour export
- `LakesideModeLighting.skyDomeColor: string`. Read it as `lakesideModeLighting(mode: LakesideDayNight).skyDomeColor`, in LakesideSceneData.ts.
- It is an sRGB hex string equal to the board clear colour:
  - day: `lakesideDayClearColor()`, 28/143/184
  - night: `LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor`, #1c2740 = 28/39/64
- It is derived, never a second literal. It is not the `waterSky*Linear` values; those are reflection inputs pre-compensated for the water tint, and their mean is lavender.
- 467b36d changes `LakesideJourneyAtmosphere.ts` from `hexRgb(lakesideModeLighting(mode).clearColor)` to
  `export function lakesideSkyDomeColor(mode:LakesideDayNight):Rgb{return hexRgb(lakesideModeLighting(mode).skyDomeColor);}`
  - The value is identical in both modes.
  - The exact-text assert in `tools/lakeside/test_lakeside_sky_follow.cjs` is updated to match; its numeric dome = clear-colour checks still pass.
  - If GGbot prefers to own this change, drop 467b36d and make that one-line edit himself.

## Land fill: what and how
- **Materials touched** (rule: ground surface only):
  - near: `LK_terrain.glb` (ground, grass)
  - far: `LK_far_hills.glb`, `LK_far_shore.glb` (hills, mountains, snow, far shore)
  - Never filled: water, bridge (`LK_bridge`, `LK_bridge_steps`), buildings, props, vegetation, rocks, clouds.
  - The lists are in `LAKESIDE_DIR_LIGHT_PARAMS.landFillNearGlbs` / `landFillFarGlbs`; the class comes from `lakesideLandFillClass(glb)`.
- **Single source:** `lakesideModeLighting(mode).landFillNearLinear` / `.landFillFarLinear` (emissiveScale, linear).
  - day: near 0.104/0.196/0.025; far 0.043/0.087/0.107
  - night: near 0/0/0.0014; far 0.0049/0.0116/0.0356
- **How it is applied:**
  - Land renderers get their own instanced material copy, with emissive set to white.
  - `writeLakesideLandFill` is the only writer. If the effect has no emissive handles, it logs `[QF_LAKE] land-fill-unsupported`.
  - board: `applyDir` → `applyLakesideLandFill`. journey: `onDayNightChange` → `applyLakesideLandFill`, released with offWater.
- **Test locks:**
  - single source and no duplicate writer or values
  - the land list matches the bundle's GLBs
  - land-only code path on a stand-in scene (water and bridge copies stay plain; the night writer touches only land)
  - night fill cool (B ≥ G ≥ R) and < 0.5 × day
  - skyDomeColor = clear colour (day 28/143/184, night 28/39/64), never a literal

## Numbers
SAMPLE_TABLE.md / samples.json / renders / side_by_side_*.png are carried over. On 5bb9e0d the board path (LakesideBoardBackground.ts, lighting, water and fill values) is identical to c7141d6, so the stand-in output is the same.

Day vs the engine-cam r5h3 reference (bar ±12), 390x844 / 360x640:

| point | error |
|---|---|
| grass | 0/0/0 |
| far_hills | +10/+6/+4 (360x640: +10/+7/+4) |
| mtn_snow | -12/-7/-4 |

- All 10 water and bridge points are unchanged from r4 and within the bar (worst bridge_left G -10; 360x640 deck R +9).
- Stripe std 1.9 / 2.3 (bar ≤ 10).

Night 360x640 vs Mac r3 night land:

| point | luma ratio | hue |
|---|---|---|
| grass | 0.85 | 126° |
| far_hills | 0.84 | 225° |
| snow | 0.77 | 225° |

R is the lowest channel at all three, so none is brown. The lake stays blue-teal (hue 207-212°).

## Suite
`suite.log`: 87 total, 82 pass. Only the known 5 fail: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER.

## Open
- Trees and the house wall are still dark, and clouds are still orange-brown. None of these is land.
- Land draws as its own batches (about +2 draw calls).
- The journey applies the full fill regardless of the atmosphere weight.
- Needs checking on a device (`?lakediag=1` in DEBUG builds).
