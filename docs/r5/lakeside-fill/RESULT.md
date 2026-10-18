# r5 lakeside per-part fill — RESULT (Voice Bot, 2026-10-18)

Branch `voice/r5-lakeside-fill`, based on `gbt/r5-integrated-b07-wip` @ bc81575. None of the frozen inputs are touched
(CharacterMotion, anim_meta, region assets, audio, WorldIntegrationBoot).

## What changed
1. **Fill is now per part.** Every lakeside GLB shares the single palette material M_LK_palette (16×16 swatches of 16 px;
   rows 10–15 are used), so a "part" is a palette swatch. Each fill copy (one per fill class, as in r4) now also gets
   `USE_EMISSIVE_MAP`.
   - The emissive map is a 16×16 RGBA8 mask built in code. There is no asset and no meta; it costs 2 × 1 KB of runtime
     memory. Filtering is nearest + clamp, the same as the palette.
   - Each byte = round(255·√w). Cocos SRGBToLinear is x², so the shader sees exactly the swatch weight w.
   - There is one mask per mode: `LAKESIDE_FILL_PART_WEIGHT.day` and `.night` in LakesideSceneData.ts. Unlisted swatches are 1.
   - **Off by day (w = 0):**
     - roofs #e2622f / #d9862f / #c9532a
     - door frames / dark wood #5a3524
     - trunks #6a4630
     - cliffs / sand / path #8a5a3a #5e3b28 #e9cf94 #b98a55 #d9a867
   - Grass, tree crowns and walls stay at 1. Conifers and far hills are partial.
   - Fallback: if the mask texture cannot be created, the copy keeps the old r4 flat fill. This is logged as
     `[QF_LAKE] land-fill-mask-failed`.
2. **New fill groups.**
   - The pavilion (凉亭, `LK_pavilion.glb`) joins the wall class.
   - New `plant` class: LK_reed_card, LK_flower_clump, LK_flowerpot, LK_lotus, LK_lilypad.
   - New `prop` class: LK_chime_post, LK_chime_raft, LK_windchime, LK_buoy_lantern, LK_lantern, LK_lantern_boat,
     LK_paper_boat, LK_barrel, LK_porch_steps, LK_clothesline.
   - Values are linear, with day and night taken from the one shared `lakesideModeLighting(mode)`:

     | class | day | night |
     |---|---|---|
     | plant | [0.03, 0.09, 0.04] | [0.016, 0.048, 0.052] |
     | prop | [0.06, 0.045, 0.035] | [0.0015, 0.016, 0.026] |

     Night values have red lowest, and nothing is negative.
3. **Fill follows the atmosphere blend weight.**
   - emissiveScale = class fill × clamp(w).
   - On the journey copy (RegionJourneyAdapter), the fill starts at w = 0 right after instancing. In `lease.progress` it
     follows `lakesideAtmosphereWeight(route,total,d)`, the same weight used for the lights and fog, and is re-written on
     each step of at least 1/64 or when it reaches 0 or 1 (`lakesideFillStep`).
   - The day/night listener keeps the current weight. The board copy uses full weight, so the hand-off at w = 1 is continuous.
   - The journey into lakeside now starts from sky city by balloon. The fill does not care which route is used: it only
     reads the journey's atmosphere weight.

## Acceptance (stand-in emulator: Blender G-buffer → numpy Cocos 3.8.8 shading; params and mask dumped from this branch's code)
**Day.** HANDOFF §4 10-point bar at both board poses. Water points are within ±12, and so are the lake-bridge points
(LK_bridge, the wooden bridge on the lake):

| point | 390x844 Δ | 360x640 Δ |
|---|---|---|
| far_water | +1/−1/+2 | 0/+1/+6 |
| mid_water | +1/−7/−5 | −1/−7/−3 |
| mid_water_R | +4/+9/+5 | +2/+9/+6 |
| under_bridge | −1/−5/−5 | −2/−4/−3 |
| near_mid_water | +5/+1/−1 | +5/+1/0 |
| near_water_bottom | +1/+1/+2 | +1/+1/+2 |
| near_water_L | −8/0/0 | −5/+1/+1 |
| bridge_stone_deck | +8/−5/−1 | +9/−5/−1 |
| bridge_stone_left | +4/−10/−4 | −9/−7/−2 |
| bridge_rail_top | +5/−4/−6 | +6/−4/−5 |
| stripe std | 1.9 (≤10) PASS | 2.3 (≤10) PASS |

Land, props and clouds (where visible):

| sample | emulator | target |
|---|---|---|
| tree crown | 41/106/14 | 42/108/5 |
| house wall | 175/133/90 | 174/134/91 |
| cloud | 202/173/157 | 199/172/157 |

All are within ±12 (the largest gap is tree-crown blue, +9). The pavilion has 0 visible pixels in both board poses, so it
cannot be measured there.

**Night.** Land and props are about 80 % of Mac r3 luma, measured on the Mac r3 night 360 capture:

| sample | ratio | colour |
|---|---|---|
| tree | 0.78 | cool |
| house wall | 0.79 | cool |
| cloud | 0.80 | cool |
| grass | 0.85 | cool |
| plant | 0.82 | cool |
| prop | 0.81 | 11/12/18, red lowest |
| reeds | 0.82 | cool |
| lilypad + lotus | 0.80 | cool |

Every sample has red lowest. The lake is unchanged blue-teal, and no emissive is negative.

**Water / lake-bridge / foam pixels:** max|Δ| = **0** vs before, in day and night at both poses. Their materials never get
fill: they keep the plain copy, and the test asserts this.

**Draw calls (model):** baseline 53 → **55** (two new merge groups: plant and prop), within the ≤ 60 bar.
`test_lakeside_land_fill` reports "background ~12 draws, total ~55 (merge groups 11)"; dc_estimate.cjs reports 53 → 55.

## Tests
- `tools/lakeside/test_lakeside_land_fill.cjs` **PASS** (11 blocks). New checks:
  - class lists, values, and the pavilion in the wall class;
  - mask bytes against the weights;
  - roofs, door frames, trunks and cliffs are 0 by day;
  - texture setup (16×16 RGBA8888, nearest, no mip, clamp, cached);
  - the night mask is swapped in;
  - weight scaling at 0, 0.5, 1 and clamp, and the `lakesideFillStep` rule;
  - journey wiring (starts at 0, the listener keeps the weight);
  - DC ≤ 60.
- `tools/lakeside/test_lakeside_instancing.cjs` **PASS**: fill copies have USE_EMISSIVE_MAP and the plain copy does not.
  When no mask can be made, the copy keeps the flat fill.
- `tools/lakeside/test_lakeside_journey_atmosphere.cjs` **PASS**: the fill follows the same weight as the atmosphere.
- TypeScript strict check of LakesideBoardBackground.ts and RegionJourneyAdapter.ts against the Cocos 3.8 cc.d.ts: no new
  errors (pre-existing errors in other files are unchanged).
- Full suite: see "Suite" below.

## Untested
- These are emulator numbers, not a Cocos or Mac capture. The emulator reproduces the r4 propfill stand-in renders to
  within 2/255.
- Not verified on a device: the Cocos runtime upload of the code-built mask, its sampling on WeChat, and whether the
  static merge keys the USE_EMISSIVE_MAP copies as modelled.
- The journey-time fill ramp is unit-tested only. No mid-journey frames were captured.

## Previews
/workspace/yiqifengle/previews/Voice-bot/r5-lakeside-fill/ contains:
- `compare_390x844.png` and `compare_360x640.png`: before = r4 flat fill (bc81575), after = r5 per-part at weight 1;
  day and night in each.
- Single frames `before_*` and `after_*`.
- `emulator/`: the scripts plus the code-dumped params and mask.

## Suite (tools/journey-integration/run-suite.cjs, Node 20.19.2, box under heavy load)
- **Baseline bc81575:** 117 passed.
  - FAIL: retry-protection, region-nodes-data, lens-clearance.
  - BLOCKED: legacy-board-ui-pure and reward-background-return (both need Node ≥ 22.6), navigation-guard (no browser).
- **This branch** (run before the commit): 115 passed. It has the same 3 failures and 3 blocked checks as the baseline,
  plus 2 more failures, both re-checked afterwards:
  - region-levels: only PASS lines were printed, and it was most likely killed by the suite timeout under load. A
    standalone run gives PASS (2 m 48 s).
  - region-transport-flag: this test compares RegionJourneyAdapter.ts with HEAD, and the file was not committed yet. It
    gives PASS after the commit.
