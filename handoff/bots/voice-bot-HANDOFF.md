# Voice Bot handoff (written 2026-10-17 ~08:20 EDT, updated ~09:55 EDT for the GitHub push)

**Repo:** `/workspace/wechat-game/yiqifengle`. The main checkout stays on a995c41; never work in it. Make your own `/tmp` worktree from the branch or bundle.

**Outbox folders:** under `/workspace/wechat-game/team/voice-bot/outbox/` (shortened to `outbox/` below). Each folder has a README, patches, a bundle and SHA256SUMS.

**Push status:** nothing is pushed by Voice Bot. GGbot pushes everyone's work. All Voice Bot work is on local `voice/*` refs in the shared repo (41 branches, table below), plus bundles/patches in the outbox. Every outbox bundle tip and every outbox patch commit is on a `voice/*` branch.

## 1. Branches and SHAs

### All `voice/*` branches (state at 09:55 EDT)

- **Base:** the first non-Voice-Bot commit under the branch.
- **"r4.1":** GGbot's `integration/build05-r41-20261017T125738Z` (e4a05b9).
- **"merged":** the commit (or the same patch) is in r4.1's history.
- **New refs:** the `voicebot/*`, `voice-bot/*` and patch-only commits got `voice/*` refs on 2026-10-17. Same SHAs; the old refs are untouched.

| branch | full SHA | base (full SHA) | commits | status | outbox |
|---|---|---|---|---|---|
| `voice/audio-cc0-20261015` | `127e2fbb9997dba627fb3564d40d8b829f6df9b6` | 5c54f7a6706abe157e23e4386969b80f8b1c6852 (`cinematic/window-tap-exit-proto`) | 1 | not merged (candidate SFX set); new ref for voicebot/audio-cc0-20261015 | outbox/20261015T1852Z-audio-cc0/ |
| `voice/build05-a2-clip` | `08bd1caaec9bb91fe6e01a78c16f3a34aee10149` | e2a03ec3ca7866570a0e04ae46564bec783163f3 | 1 | merged (ancestor of r4.1) | outbox/20261016T230157Z-a2-level-clip/ |
| `voice/build05-exit-audio-B5.5` | `8b225463f278aacfbd8891d64130c42fc8ca0942` | 274ac39fb3d261b5fbf9d0ece3cb38695e08dc83 (`cine/exit-cam-B5`) | 1 | merged (patch-equal in r4.1); superseded by a1 + cfe6429 | outbox/20261016T195708Z-exit-audio-B5.5/ |
| `voice/build05-exit-audio-a1` | `f57b8d20631fbc463fc1fc8c94ce281aa3b29b7e` | 77b76c3d15ec552bc110c66484873abfd64994ca | 1 | merged (ancestor of r4.1); baked steps later removed by cfe6429 | outbox/20261016T221048Z-exit-audio-A1/ |
| `voice/build05-journey-ground` | `599994d8132bd3aeb7b07243f9997e024f39efbc` | 3ff5b7358287f41aea8b9959e093f1ce7af3434b | 1 | superseded (by -v2) | outbox/20261016T0745Z-build05-journey-ground/ |
| `voice/build05-journey-ground-v2` | `4c30cf72a6ea3b9a21eb803f27a4dc4ff9196810` | a373227b7aadb9e9af7522d3993e7de5fc0fbc6f (`ggbot/build05-journey-occlusion`) | 1 | merged (ancestor of r4.1) | outbox/20261016T0816Z-build05-journey-ground-v2/ |
| `voice/build05-journey-ground-v3` | `0a9161c85ca35f4272d037f8ded311b078a8cb42` | f05c6a3ab150802881e7e32d8394843f79bc0332 (`ggbot/build05-journey-v3.1`) | 1 | merged (ancestor of r4.1) | outbox/20261016T1018Z-build05-journey-ground-v3/ |
| `voice/build05-lakeside-ambience` | `f3fce67261e417de4df11954df4a898414751738` | c37530460e48b37a19b4fc3a1b1b01fb95e02160 | 2 | merged (replayed as 88ed387 + 5bdfdc5) | outbox/20261017T070900Z-lakeside-ambience/ |
| `voice/build05-lakeside-art-engine` | `48e71ba7fecd1dc329f96fbfb5504060045b8506` | c2eaf64a3f9b1fa868051776e5150b8ebac0d494 (`integration/build05-next-20261017T0702Z-optional-water-dc`) | 3 | merged/superseded (2 commits patch-equal in r4.1; 48e71ba replayed as 78b23c5) | outbox/20261017T073549Z-lakeside-art-engine/ |
| `voice/build05-lakeside-art-engine-r2` | `f7f892f06bb49bf25c0c176384c4ef3f2def83e2` | 228df2fee791ea14b6da683c8362a69d603d801a (`integration/build05-next-20261017T0725Z`) | 6 | merged (ancestor of r4.1) | outbox/20261017T075426Z-lakeside-art-engine-r2/, outbox/20261017T080512Z-lakeside-warmfill-half/ |
| `voice/build05-lakeside-journey-wire` | `4728814a9b0b7daafc15b4a5a06abbe663546699` | c37530460e48b37a19b4fc3a1b1b01fb95e02160 | 1 | merged (replayed as 88ed387) | outbox/20261017T065103Z-lakeside-journey-wire/ |
| `voice/build05-lakeside-olive` | `a6f39edba9cebca9eb735d154107d817f229b661` | 228df2fee791ea14b6da683c8362a69d603d801a (`integration/build05-next-20261017T0725Z`) | 7 | merged (ancestor of r4.1) | outbox/20261017T081625Z-lakeside-olive/ |
| `voice/build05-lakeside-playable` | `0932b6b59621f41e5b70e3d8e5fbc03039f39796` | 09a1b8e456fd38dadf632f627189883808307cbe (`ggbot/audit-fixes-77b76c3`) | 5 | merged (4 patch-equal in r4.1; d8cd409 replayed as 30440cc) | outbox/20261017T043229Z-lakeside-playable/, outbox/20261017T051017Z-lakeside-lights-pavilion/ |
| `voice/build05-lakeside-r4` | `c7141d6f1d7823e0e999f0ddd72784610a31a488` | 939049ceb815434fbb65c4dfdc187d8266d08a24 | 3 | superseded (by landfill-5bb9e0d) | outbox/20261017T104639Z-lakeside-r4/, outbox/20261017T111632Z-lakeside-r4-landfill/ |
| `voice/build05-lakeside-r4-fill-props` | `32be13f677d5cca7b34aad2bccb0f0b6e029d358` | `467b36d495ccd456201bcb16f82b82ac8eae5aa6` (landfill tip) on 5bb9e0da057efde43879b7cd1e98adf8f09c7788 (`ggbot/build05-r4-journey-fixes`) | 5 | **accepted (r4)**; stacked on 467b36d | outbox/20261017T120120Z-lakeside-r4-propfill/ |
| `voice/build05-lakeside-r4-landfill-5bb9e0d` | `467b36d495ccd456201bcb16f82b82ac8eae5aa6` | 5bb9e0da057efde43879b7cd1e98adf8f09c7788 (`ggbot/build05-r4-journey-fixes`) | 4 | **accepted (r4)** | outbox/20261017T113800Z-lakeside-r4-landfill-5bb9e0d/ |
| `voice/build05-lakeside-r4-on-f492dc1` | `7aa9317e957aadd3c8d4b75a2581d56b60e4f9eb` | f3d3614361dd2dc23098353ff314a520c3e1c00e (`integration/build05-next-20261017T0818Z-r3`) | 7 | superseded |  |
| `voice/build05-lakeside-water-fix-r3` | `f492dc1898300f270bf7d55478efd2666737b1c2` | f3d3614361dd2dc23098353ff314a520c3e1c00e (`integration/build05-next-20261017T0818Z-r3`) | 2 | superseded; S f492dc1 went into r4 via c4965cb, D 10a7820 via 193b4f1 | outbox/20261017T084601Z-lakeside-water-fix-r3/ |
| `voice/build05-lakeside-water-ref` | `a47c8fe672777cea88343b94a941ed19d71e8f6b` | f3d3614361dd2dc23098353ff314a520c3e1c00e (`integration/build05-next-20261017T0818Z-r3`) | 2 | not accepted (candidate; superseded by water-fix-r3) | outbox/20261017T083436Z-lakeside-water-ref/ |
| `voice/build05-landing-rockcut-preview` | `dca9c301a0ba51184ca953dc03f044f1bcf75c3a` | 764dcd8997ccf21a79bdeff1bd7484441124e6ab (`ggbot/build05-v3-stack`) | 3 | not accepted (PREVIEW, not for merge) | outbox/20261016T1251Z-build05-landing-rockcut-preview/ |
| `voice/build05-meadow-bgm-loop` | `700ec499ca42cd13919665907bb5c2bbfeebca0a` | bc418c560d257421039c3d1cc953aeb937e47636 | 2 | merged (patch-equal in r4.1) | outbox/20261016T145919Z-meadow-bgm-loop/ |
| `voice/build05-mushroom-sink` | `08fdfeafa506705e219e0bb2731f8c8d285a3f01` | d238881c85df7787fc63a37092a46968bb6f3d34 (`ggbot/build05-v3.2-final`) | 1 | merged (ancestor of r4.1) | outbox/20261016T1314Z-build05-mushroom-sink/ |
| `voice/build05-r4-exit-footsteps` | `f125cd21d8c056ca1ec25072a4fc5855a40a4c60` | 50a3074da5d74344b5a4465c3ea9f5b815b9d287 (`ggbot/build05-r4-ui-fixes`); cfe6429 = `cfe64292bfd23d187b5a9409e712098e28b259d0` | 2 | cfe6429 **accepted (r4.1)**; tip f125cd2 **delivered, awaiting acceptance** (same patch already sits on integration/build05-r41-20261017T125738Z as e4a05b9) | outbox/20261017T121502Z-r4-exit-footsteps/, outbox/20261017T132651Z-r4.1-outdoor-step-levels/ |
| `voice/build05-r4-tests` | `e79bfcad4a3e2077a3bae62872a7a524206d756a` | 7c1047bd4d7f3424ff766d33d3746e578057919c | 3 | **accepted** (886a340/7c2a7f5/e79bfca); GGbot dc25cec is the final test line | outbox/20261017T102057Z-r4-tests/ |
| `voice/build05-skycity-bgm-loop` | `ce0e4ff309026463ea474309cdce75c176e1fe8e` | bc418c560d257421039c3d1cc953aeb937e47636 | 1 | merged (patch-equal in r4.1) | outbox/20261016T145254Z-skycity-bgm-loop/ |
| `voice/build05-stones-oct` | `3b1f5a800be44dce76c8e5956b7a4e64eb088dc4` | cb4f846b831a030d866aa87c71330c2ba06acee1 | 1 | not merged (not in r4.1; no acceptance on record) | outbox/20261016T1027Z-build05-stones-oct/ |
| `voice/build05-v4-ground` | `1c21428d3235f16866d879a078df7cf324117d98` | 764dcd8997ccf21a79bdeff1bd7484441124e6ab (`ggbot/build05-v3-stack`) | 2 | merged (ancestor of r4.1) | outbox/20261016T1155Z-build05-v4-ground/, outbox/20261016T1216Z-build05-v4_1-ground/ |
| `voice/exit-audio-B5_3` | `2fba62f68c90291476b87d10e482e509c1e2d5e5` | 00fea6336b57f982430b24be5e39073131210e1a | 1 | superseded (by B5.5); new voice/* ref for old voice-bot/exit-audio-B5_3 | outbox/20261016T0849Z-exit-audio-B5_3/ |
| `voice/home-sign-A` | `3080d07b794e3c66a6dbc119ab5484dddc4eccca` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | not merged (candidate); new ref for voicebot/home-sign-A | outbox/20261016T0131Z-home-sign-AB/ |
| `voice/home-sign-A2` | `3e6b7df6f38414d720468ab71417caeb1be55674` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | not merged (candidate); new ref for voicebot/home-sign-A2 | outbox/20261016T0414Z-home-sign-C-A2-palm2-sheet/ |
| `voice/home-sign-A2-first` | `f4e26a2b922ababeb054b6689a734f31b7b36131` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | superseded (first A2, was only a patch; ref added) | outbox/20261016T0155Z-home-sign-C-A2/ |
| `voice/home-sign-B` | `50eceeaf5705b704ba711cc3901f003677891421` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | not merged (candidate); new ref for voicebot/home-sign-B | outbox/20261016T0131Z-home-sign-AB/ |
| `voice/home-sign-C` | `2936c308e9586ce1f283bf843bc6d8abc21c8df1` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | not merged (candidate); new ref for voicebot/home-sign-C | outbox/20261016T0414Z-home-sign-C-A2-palm2-sheet/ |
| `voice/home-sign-C-first` | `53926de4d7e69bebbbe475ebf6977a543d3f847d` | b14067c443d6cc849822757394f3bfd31c628658 | 1 | superseded (first C, was only a patch; ref added) | outbox/20261016T0155Z-home-sign-C-A2/ |
| `voice/lk-pavilion` | `0932b6b59621f41e5b70e3d8e5fbc03039f39796` | 09a1b8e456fd38dadf632f627189883808307cbe (`ggbot/audit-fixes-77b76c3`) | 5 | same SHA as -playable (alias) | outbox/20261017T051017Z-lakeside-lights-pavilion/ |
| `voice/meadow-art-20261015` | `9237c5331d82b6ce3b0ffec46db60c6b1461acc6` | 5c54f7a6706abe157e23e4386969b80f8b1c6852 (`cinematic/window-tap-exit-proto`) | 12 | superseded meadow art line v1-v7.5 (not in r4.1); new ref for voicebot/meadow-art-20261015 | outbox/20261015T1914Z-meadow-art .. 20261015T2318Z-meadow-art-v7_5/ |
| `voice/meadow-art-v7_2-v7_3` | `4431f38045abd9246ef9330f2f11f413005a04fb` | 5c54f7a6706abe157e23e4386969b80f8b1c6852 (`cinematic/window-tap-exit-proto`) | 9 | superseded (was only a patch; ref added) | outbox/patches/meadow-v7_2-v7_3/ |
| `voice/meadow-art-v7_2-v7_4` | `cd4d6a132319f98cd8357928d28ce95e7dba22d8` | 5c54f7a6706abe157e23e4386969b80f8b1c6852 (`cinematic/window-tap-exit-proto`) | 9 | superseded (was only a patch; ref added) | outbox/patches/meadow-v7_2-v7_4/ |
| `voice/meadow-art-v7_2-v7_5` | `099f8eb6305ad6a9bc896e94b323239da5276c3b` | 5c54f7a6706abe157e23e4386969b80f8b1c6852 (`cinematic/window-tap-exit-proto`) | 9 | superseded (was only a patch; ref added) | outbox/patches/meadow-v7_2-v7_5/ |
| `voice/meadow-art-v7_6` | `2e6b485ff4b100ec836d147f7b7d77fd7ff0e7c7` | 0b1181db2c50a85be53864173bf730edac32aa72 (`pr58-remote`) | 1 | not merged (not in r4.1); new ref for voicebot/meadow-art-v7_6 (worktree /workspace/v76/wt, clean) | outbox/20261016T0215Z-meadow-art-v7_6/ |
| `voice/meadow-birds-v7_7` | `1d9d485d961b372c0ab36aab8da4d0e003674f60` | aabd8a259da16c7c78f9f292eef5705cacd520b3 | 1 | not merged (not in r4.1) | outbox/20261016T0415Z-meadow-birds-v7_7/ |

**Copies on other agents' branches:** some of my commits also sit there as cherry-picks. They have the same patch-id, and the original is on `voice/*`:
- e4a05b9 = f125cd2
- 6f42df4 = 32be13f
- 385a934 = a47c8fe

### Details: accepted into r4 by Grok Bot

| branch | HEAD | base | contents | outbox |
|---|---|---|---|---|
| `voice/build05-lakeside-r4-landfill-5bb9e0d` | **467b36d** | GGbot `ggbot/build05-r4-journey-fixes` 5bb9e0d | 4 commits, listed below | `outbox/20261017T113800Z-lakeside-r4-landfill-5bb9e0d/` |
| `voice/build05-lakeside-r4-fill-props` | **32be13f** | 467b36d | 1 commit: foliage / house wall / rock / cloud fill classes, each with its own per-mode value | `outbox/20261017T120120Z-lakeside-r4-propfill/` (includes `dc_estimate.cjs`) |
| `voice/build05-r4-tests` | **e79bfca** | GGbot 7c1047b | 3 commits, listed below | `outbox/20261017T102057Z-r4-tests/` |

Land-fill commits (on 5bb9e0d):
- b131471: land emissive fill
- b8bd243: test `lakeside-land-fill`
- 6902ba3: regex fixups + `skyDomeColor`
- 467b36d: `lakesideSkyDomeColor` reads `.skyDomeColor`

Test-fix commits (on 7c1047b):
- 886a340: production-integrity re-baseline (20 sha256 values)
- 7c2a7f5: legacy-board-ui-pure expects 3 sfxMuted gates, plus the stale 'lake' chapter expectation
- e79bfca: legacy-board-ui-pure reports `BLOCKED_NODE` with exit 78 on Node < 22.6

### Footsteps

| branch | HEAD | state | outbox |
|---|---|---|---|
| `voice/build05-r4-exit-footsteps` | cfe6429 | **accepted into r4.1** by Grok Bot. Base: GGbot `ggbot/build05-r4-ui-fixes` 50a3074. 运镜bot recording: exit 25/25, return 27/27, max +32.7 ms. | `outbox/20261017T121502Z-r4-exit-footsteps/` (recording in `recording-yunjing/`) |
| `voice/build05-r4-exit-footsteps` | **f125cd2** | **new, waiting for review.** One commit on cfe6429: outdoor steps 10–12 dB under music+ambience (recording-calibrated), indoor unchanged. | `outbox/20261017T132651Z-r4.1-outdoor-step-levels/` |

Footsteps summary:
- cfe6429: live steps on the animation's foot plants; the baked steps are removed from `sfx_exit_outbound`.
- f125cd2: outdoor STEP_GAIN stone 0.50, path 0.36, grass 0.36; wind lift +6 dB × smoothstep(0.3, 0.9, wind); outdoor variant trims; outdoor jitter ±0.75 dB.
- Measure a recording with `tools/exit-footsteps/recording_levels.py <recording dir> A_exit out.json`. It uses 400 ms K-weighted momentary loudness, step = file × game vol, bed = mix − step.

### Superseded (do not merge, not deleted)

- `voice/build05-lakeside-r4`: 9581c23 → c7141d6.
  - This is the r4 water/sky/fog/light refit on GGbot 97b761d, plus rebase fixups.
  - The landfill-5bb9e0d branch replays its content.
  - Outboxes: `outbox/20261017T104639Z-lakeside-r4/` (the engine-cam reference, emulator, camera and exposure notes are in its README) and `outbox/20261017T111632Z-lakeside-r4-landfill/`.
- `voice/build05-lakeside-r4-on-f492dc1` 7aa9317: first port onto f492dc1.
- Earlier water work (r3 and before):
  - `voice/build05-lakeside-water-ref` a47c8fe: candidate. `outbox/20261017T083436Z-lakeside-water-ref/`
  - `voice/build05-lakeside-water-fix-r3` f492dc1. `outbox/20261017T084601Z-lakeside-water-fix-r3/`
    - S = f492dc1: v_color double-decode fix.
    - D = 10a7820: `[QF_LAKE_DIAG]` print.
    - Both were replayed into r4 as c4965cb and 193b4f1.
- Older lakeside steps, all replayed or superseded:
  - `voice/build05-lakeside-art-engine` 48e71ba
  - `-art-engine-r2` f7f892f
  - `-olive` a6f39ed
  - `-playable` 0932b6b (`voice/lk-pavilion` is the same SHA)
  - `-journey-wire` 4728814
  - `-ambience` f3fce67
- Older audio branches, already merged or superseded:
  - `voice/build05-exit-audio-B5.5` 8b22546 and `voice/build05-exit-audio-a1` f57b8d2. Their baked steps are removed by the footsteps branch.
  - `voice/build05-a2-clip` 08bd1ca
  - `voice/build05-meadow-bgm-loop` 700ec49
  - `voice/build05-skycity-bgm-loop` ce0e4ff
- Older build05 ground branches:
  - `journey-ground*`: 599994d, 4c30cf7, 0a9161c
  - `stones-oct` 3b1f5a8
  - `v4-ground` 1c21428
  - `mushroom-sink` 08fdfea
  - `landing-rockcut-preview` dca9c30 (PREVIEW only)
  - `meadow-birds-v7_7` 1d9d485

## 2. How the lakeside colour data is measured

- **Reference:** `/workspace/wechat-game/art/regions/lakeside/ENGINE_COLOR_REFERENCE/engine_cam_r5h3/`. This is outside the repo; a copy is at `outbox/20261017T104639Z-lakeside-r4/reference/`.
  - Contents: REFERENCE.md, targets.json, sample.py, `pose_390x844.json`, `pose_360x640.json`, and graded / pre-grade renders at 390x844 and 360x640.
  - What it is: r5h3.blend rendered through the engine's board camera (Blender 5.2.2 EEVEE, 24 samples, @2x).
  - How it was made: 12 wave-phase frames, each through the `postgrade16` grade, then a per-pixel temporal median.
  - Only the 431 objects the runtime mounts are visible.
- **Camera:** 运镜bot's `background_camera_pose.json`, 390x844 entry. It equals `LakesideCameraLayout.lakesideAlignedBoardPose`.
  - pos (2.94478, 3.58, 31.16376)
  - quat xyzw (-0.105171, 0.075737, 0.008033, 0.991533)
  - vertical fov 57.3526°
  - 360x640: same code path, fov 55.8197°. It matches the Mac r3 bg-only captures pixel for pixel.
- **Sample points:** sRGB box medians; boxes are in REFERENCE.md and targets.json.
  - 10 bar points: far_water, mid_water, mid_water_R, under_bridge, near_mid_water, near_water_bottom, near_water_L, bridge_stone_deck, bridge_stone_left, bridge_rail_top.
  - The mid stripe.
  - Land regression points: grass_near, far_hills, mtn_snow.
  - Prop points, using an object-class pixel median inside the box: tree, house wall, cloud.
  - Example day targets at 390x844: far_water 109/130/103, grass 116/168/38, cloud 199/172/157, house wall 174/134/91, tree 42/108/5. The full tables are in the propfill outbox (SAMPLE_TABLE.md, samples.json).
- **Bar (day):**
  - every point within **±12 per channel** of the graded target;
  - mid-stripe **std ≤ 10** (mean over channels of the std of the row means).
  - Check: `python3 sample.py <capture.png>` on a 780x1688 or 720x1280 bg-only capture; it exits 1 on FAIL.
- **Bar (night, 360x640 vs Mac r3 night):**
  - land and props at about **80% of r3 luma** (measured 0.77–0.85);
  - **cool**, with red the lowest channel (never brown);
  - the lake stays blue-teal (hue about 207–212°).
- **Stand-in:** a Mac-calibrated HDR+ACES emulator, in `outbox/20261017T104639Z-lakeside-r4/emulator/`.
  - Exposure: EV100 14.97, exposure 2.604e-5.
  - Lights: main 87500 → 2.279; skyIllum 61250 → 1.595.
  - Tone mapping: ACES 2.51/0.03/2.43/0.59/0.14, then sqrt as LinearToSRGB, no post.
  - These are numbers from a model, not from the engine.
- **Device debug:** `?lakediag=1` in a DEBUG build prints a one-time `[QF_LAKE_DIAG]` at the first board light apply. The r3 README's `?qfLakeDiag=1` is wrong.
- **Draw-call estimate:** `outbox/20261017T120120Z-lakeside-r4-propfill/dc_estimate.cjs`. It models static merge plus batching: 49 → 53 draws (≤ 60 is locked by `lakeside-land-fill`). This is a model; confirm with the engine profiler.
- **Cocos linear-colour lessons:**
  - Cocos 3.8.8 `Material._uploadProperty` **squares** any property tagged `linear: true` (SRGBToLinear is x·x). Pass linear values without that tag (r4 ed2e532). This was the cause of the "sand" water.
  - glTF COLOR_0 is already linear. `SRGBToLinear(v_color)` in a custom effect decodes it twice; use `albedo *= v_color.rgb` (f492dc1). builtin-standard also decodes vertex colours; leave it alone for the grey-AO palette meshes.
  - `lakesideModeLighting(mode)` in `LakesideSceneData.ts` is the single source.
    - `*Linear` fields are linear.
    - For a light colour use `lakesideCocosLightColor()` (×255); for unlit / sRGB use `linearToSrgb8()`.
    - `skyDomeColor` = clear colour (an sRGB hex).
    - Never add a second literal.
- **Suite:**
  - Command: `QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`, run from the worktree root. The runner exits 1 whenever the status is not PASS.
  - Known 5 non-pass on Node 20.19.2: production-integrity, legacy-board-ui-pure (BLOCKED_NODE, exit 78), reward-background-return (BLOCKED_NODE, exit 78), cloud-web-contract, navigation-guard (BLOCKED_BROWSER).
  - The suite rewrites tracked files in `tools/journey-integration/reports/` and `output/`. Never commit them; run `git checkout -- tools/journey-integration/reports output` after a run.
  - If another agent's run kills yours (exit 143), rerun it detached with `setsid nohup`.

## 3. Open items

**Lakeside**
- r5 whole-object fill lift: the flat fill brightens whole GLBs, so roofs, door trim and tree trunks get the same lift as the sampled wall or crown.
- The pavilion, reeds, flowers and small props are not filled.
- Rocks are unmeasured (0 visible pixels in both poses).
- The journey applies the full fill regardless of the atmosphere blend weight.
- The draw-call model (53) needs confirming in the engine.
- Device checks are still needed for everything; all numbers are emulator values.
- From the r4 README, GGbot / journey scope:
  - The journey model is yawed 180° but the sun is set in world space, so the sun is mirrored relative to the board.
  - The `loadLakesideWaterAsset` catch falls back silently.
  - The water variant compiles at journey show, a possible hitch.

**Audio**
- Sailing-track `timing.json` audio: make it when it lands on mainline. GGbot's `journey-background-audio` test fails on purpose when a journey cue track or timing.json appears, as a reminder to add timeline resume.
- Review the audio in 运镜bot's r4 recordings, including the footsteps recording (instructions in the footsteps README).
- Footsteps r4.1 (f125cd2) open items:
  - Re-record to confirm outdoor ~11 dB under. Wave and gull swells in the bed still move single return-path steps ±4 dB.
  - Indoor wood_1 is 3.4 dB quieter than the other wood files. That would be a trim if indoor may change.
  - WeChat/iPhone speaker check.
  - Details: `outbox/20261017T132651Z-r4.1-outdoor-step-levels/README.md`.
- Footsteps open items are in `outbox/20261017T121502Z-r4-exit-footsteps/README.md`:
  - device latency or decoder priming, to be measured from the recording;
  - the path surface is the sandy "path" class.

**Housekeeping**
- Old branches are not deleted. Delete them only when Funning or Grok Bot asks.

## 4. Acceptance criteria

- **Lakeside day:** all 10 water/bridge points within ±12 per channel, and stripe std ≤ 10, at 390x844 and 360x640 against engine_cam_r5h3. Land, prop and cloud points are within ±12 where they are visible.
- **Lakeside night:** land and props at about 80% of Mac r3 luma, red channel lowest; lake blue-teal. No negative emissive. Water, bridge and foam pixels unchanged by the fill (max |Δ| 0).
- **Draw calls:** lakeside board ≤ 60 (model), confirmed on device.
- **Suite:** only the known 5 non-pass.
- **Footsteps:**
  - one step per foot plant within ≤ 40 ms (sim, 30–120 fps);
  - wood or rug indoors; stone slab, sand path and grass outdoors, matching the ground;
  - quieter than BGM and ambience: 400 ms momentary loudness ≥ 7 dB under the bed;
  - low-pass at 4.5 kHz;
  - variants with ±1.5 dB per step indoors, ±0.75 dB outdoors (r4.1);
  - r4.1: outdoor steps about 10–12 dB under music+ambience on a master-tap recording (400 ms K-weighted), indoor as cfe6429; door wood↔stone ≤ 3 dB; no step more than ~3 dB louder than its neighbours;
  - free (self-synthesised) assets;
  - mute, sfx mute and background respected;
  - on device: Funning hears soft steps from the first step in the room, and no sharp burst after the door.
- **Audio in general:** free assets only (CC0 or self-synthesised, credited in `docs/audio-credits.md`); tiny mono files in subpackages.

## 5. Team rules

- Work only on your own branch and your own `/tmp` worktree. Never use another agent's worktree, never modify the main checkout, never force-push. No push at all unless asked.
- Never change `.git/config`. Commit with `git -c user.name='Voice Bot' -c user.email=voicebot@local commit …`.
- Never `pkill` or kill by name; kill only your own PIDs.
- Never delete outbox folders. Each delivery gets a new `outbox/<UTC ts>-<name>/` with README, patches (`git format-patch base..head`), bundle (`git bundle create … base..branch`, then verify), suite log and SHA256SUMS.
- Free assets only (CC0 or self-made); record the source in `docs/audio-credits.md`.
- Funning's Mac is low on disk: create nothing there. Mac checks are done by 运镜bot / GGbot, who delete local recordings after uploading them.
- Frozen production inputs:
  - `FlowReferenceStandin` section of `WorldIntegrationBoot.ts`, guarded by `tools/legacy-test-repair/controller-integrity.cjs`;
  - `CharacterMotion.ts`, `anim_meta.json`, and the files in `tools/journey-integration/frozen-production-inputs.json`.
  - Observe them from outside; never edit them.
- Report times in EDT.

## 6. Non-git material to carry along (sizes at 09:55 EDT)

| path | size | what |
|---|---|---|
| `/workspace/wechat-game/team/voice-bot/` | 924 MB | everything below plus HANDOFF.md |
| `.../voice-bot/outbox/` | 825 MB | all deliveries. `outbox/patches/` is 337 MB (meadow v7.x patches, 22–46 MB each). `20261017T121502Z-r4-exit-footsteps/recording-yunjing/` (20 MB) is 运镜bot's recording; keep it unmodified. |
| `.../voice-bot/{skycity-v1,skycity-v2,skycity-v3,m5-island,meadow-v1,island-v1,cine-v1,sfx-v1,sfx-cc0-20261015,audio-hook-v1,outbox-to-dot,plans}` | 23 / 27 / 5.5 / 17 / 14 / 12 / 1.0 / 1.6 / 1.5 MB / 24 KB / 264 KB / 8 KB | earlier work folders |
| `/workspace/wechat-game/art/regions/lakeside/ENGINE_COLOR_REFERENCE/` (incl. `engine_cam_r5h3/` 5.3 MB) | 6.0 MB | engine-cam reference renders for the lakeside colour targets |
| `/tmp/amb/` | 12 MB | lake ambience synthesis work (source wavs and spectrogram) |
| `/tmp/vbx2/` | 13 MB | r4.1 recording calibration scratch (extracted recording audio, levels, predictions) |
| `/tmp/vbx_preview/`, `/tmp/vbx_steps/`, `/tmp/vbx_tc/`, `/tmp/vbx_suite/`, `/tmp/vbx_*` files | 9.4 MB / 264 KB / 40 KB / 12 KB / ~22 MB total | footsteps work: simulation JSONs, ground maps, preview renders |

- **Files over 50 MB:** none in these folders (largest is a 46 MB meadow patch).
- **Git objects over 50 MB:** none in any `voice/*` tree or history (largest blob is 7.1 MB, `env_meadow.glb`).
- **/tmp is scratch:** everything durable is already in the outbox or the repo, so the `/tmp` folders are optional.
