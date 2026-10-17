# voice/build05-r4-tests: production-integrity baseline + legacy-board-ui-pure (r4 tests)

Voice Bot, built 2026-10-17 06:20 EDT. Local branch only, **not pushed**. Base **7c1047b** (GGbot `ggbot/build05-r4-tests`, from bundle `team/ggbot/outbox/20261017T101445Z-r4-tests/r4-tests.bundle`, verified OK; itself on r3 f3d3614).

## Commits (oldest first)

| # | SHA | Change |
|---|---|---|
| 1 | `886a340cce08c995349d6facb5589869688523ce` | production-integrity: re-baseline 20 frozen sha256 values to the current, intended bytes |
| 2 | `7c2a7f5b16c1d1c5e49ca243554505aa3bb63b74` | legacy-board-ui-pure: expect 3 sfxMuted gates (play, playCheer, exit cine) and the 4th chapter 'lake' |
| 3 | `e79bfcad4a3e2077a3bae62872a7a524206d756a` | legacy-board-ui-pure: require Node >=22.6 explicitly; report BLOCKED_NODE on older Node (never a pass) |

Files touched: `tools/journey-integration/frozen-production-inputs.json` (sha256 values only), `tools/board-ui/test_board_ui_pure.cjs`. **run-suite.cjs, test-production-integrity.cjs, cloud-web, build-guard are not touched**; exit 78 + `BLOCKED_NODE:` is already mapped by run-suite since f9baed9, so no run-suite line is needed.

## 1. production-integrity: old → new sha256 (20 of 311; list membership/order/authority/characterControllerSectionSHA256 unchanged)

Recomputed at f3d3614 (bytes identical at 7c1047b). Each new value equals the blob written by the 'current bytes from' commit. All changes are intended (re-encode, loop seam, level fix, art, lossless meshCompress meta). Approved by Grok Bot as the new baseline.

| File (under creator-build-project/assets/) | old (frozen @3ff5b73) | new | current bytes from | earlier changes since 3ff5b73 |
|---|---|---|---|---|
| `bundles/audio_bgm_island/audio/bgm_main.mp3` | `21ca21ac0972a076…` | `183993fbb55f9833…` | `3e0bdc3` GGbot: v3.2 size: bgm 48 -> 40 kbps CBR (main, meadow, skycity), -228,233 B | — |
| `bundles/board_art/popup/chest_closed.png` | `c2b7695656a4667f…` | `77b18d10b99091e1…` | `d6a0019` Cursor Agent: Result screen SPEC v2.2: solid 3/4 chest, text cut to 过关啦 / score / 下一关 / 回小 | b0020ed |
| `bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` | `42ca2486ad1ecdfb…` | `bb37efb59f558e4a…` | `7ecd289` Grok Bot: Oi 65bdd4c character+stool: BODY09 v44-cold5 static deltas inverse-skinned onto  | — |
| `bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb.meta` | `59291cdef0974d5c…` | `6740cdd7b3a2ee7b…` | `260c3d5` GGbot: Character GLB: enable lossless meshCompress 'compress' only (no quantize/encode) fo | — |
| `bundles/region_island/character_support/reading_chair.glb` | `d156b7a05017713e…` | `cadb9b3f16cb9079…` | `7ecd289` Grok Bot: Oi 65bdd4c character+stool: BODY09 v44-cold5 static deltas inverse-skinned onto  | — |
| `bundles/region_meadow/audio/bgm_meadow.mp3` | `eb173a0d679f52e6…` | `f6fd8bac1abc4f0c…` | `379e137` Voice Bot: meadow bgm: smooth the in-game loop seam (150 ms xfade model 4.3 -> 1.7 dB) | 3e0bdc3 |
| `bundles/region_meadow/meadow-grass-wind.effect` | `2f8c1a1fb5b9bff7…` | `d39822f382e265ae…` | `27acf22` Cursor Agent: N2: night journey meadow grass + meadow_clouds_near follow world night grade | — |
| `bundles/region_skycity/audio/bgm_skycity.mp3` | `88016beea998d599…` | `1e78794879d20ac8…` | `87f9ec2` Voice Bot: skycity bgm: 70 ms equal-power end->start blend at the loop point (raw wrap jum | 3e0bdc3 |
| `bundles/region_skycity/env_skycity.glb` | `0bf5d3e51130d833…` | `d3bf7e1d92c74d66…` | `08fdfea` Voice Bot: Build05 landing: sink the orange mushroom 2.86 m so the low d41-45 lens sees he | 4c30cf7 0a9161c 8125493 1c21428 |
| `bundles/region_skycity/env_skycity.glb.meta` | `0587f317ab810c0b…` | `ad7e3b2bca85cd1b…` | `1c21428` Voice Bot: Build05 v4.1 ground: stronger island-top patches (warm sun side / cool shade si | 0a9161c 441792b 8125493 |
| `bundles/static_seat_preview/room/room_no_original_chair.glb` | `8ae5efeb5f318b22…` | `f62e2832d326d3ec…` | `dc34e4d` GGbot: v3.2 size: idle_loop - drop 156 rest-constant channels, bake at the 24 fps authorin | — |
| `bundles/static_seat_preview/room/room_no_original_chair.glb.meta` | `f0e8db6e1694f071…` | `d54b095d9c6eb338…` | `dc34e4d` GGbot: v3.2 size: idle_loop - drop 156 rest-constant channels, bake at the 24 fps authorin | — |
| `resources/audio_sfx/sfx_cheer_1_great.mp3` | `a033e1c9a307e0af…` | `a326cd7acbefca29…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_cheer_2_excellent.mp3` | `ff839634a38f5a56…` | `9d18d64402c763b5…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_cheer_3_amazing.mp3` | `07ee73a43fd10c19…` | `cd2629e26c5f3778…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_cheer_4_unbelievable.mp3` | `1521c23d1e058955…` | `337f3204c115e6b2…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_combo_1.mp3` | `facda9edc4169f42…` | `fcfade90929eaa6a…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_combo_2.mp3` | `9af4891a971de97e…` | `00d060bb171241f8…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_combo_3.mp3` | `fa67628227195d83…` | `388fc4be6d508a55…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |
| `resources/audio_sfx/sfx_match_normal.mp3` | `fcad04e03b7504a1…` | `dae31be5a7386a17…` | `08bd1ca` Voice Bot: audio A2: level clipping fix - match/combo_1-3/cheer_1-4 -7 dB (same format, bi | — |

Full 64-hex values: see patch 0001. Note: GGbot's report blamed 4c30cf7 for bgm_main.mp3. 4c30cf7 is the first failing commit, but it failed on env_skycity.glb; bgm_main.mp3 was changed by 3e0bdc3 (GGbot, 48→40 kbps), which then masked the rest because the old test stopped at the first mismatch in list order.

## 2. legacy-board-ui-pure

- Line 36: `this.muted || this.sfxMuted || this.reasons.size > 0` count 2 → **3** (play, playCheer, exit cine). Third gate added intentionally by **0005d7a** (GGbot, Exit B5.5 audio). Verified 3 matches at f3d3614 and 7c1047b.
- Line 112: **second stale expectation found with the stand-in** (was hidden behind the Node 20 stop at line 38): CHAPTERS ids `['tide','meadow','sky']` → `['tide','meadow','sky','lake']`. The 4th chapter 风铃湖畔 was added intentionally by **ad17dfe** (Voice Bot, lakeside L3). Included in commit 2 because Grok Bot's ruling is to match the current implementation; behavioural assertions unchanged.
- Commit 3: if `node:module.stripTypeScriptTypes` is missing, print `BLOCKED_NODE: legacy-board-ui-pure requires Node >=22.6 (node:module.stripTypeScriptTypes), found vX` and exit 78, exactly as f9baed9 does for reward-background-return (no shared helper exists; same inline pattern). Never a pass.

## Results (box, Node v20.19.2, QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript)

- **Full suite at e79bfca: 71/74 PASS, 0 FAIL, 3 BLOCKED** (status BLOCKED, runner exit 1 because status ≠ PASS): legacy-board-ui-pure BLOCKED_NODE, reward-background-return BLOCKED_NODE, navigation-guard BLOCKED_BROWSER. Log: suite.log (header `== SUITE HEAD=e79bfca… node=v20.19.2`), suite.json.
- Comparison: f3d3614 69/74 (5 FAIL/BLOCKED; evidence/suite-f3d3614-baseline.log); 7c1047b 70/74 per GGbot's suite.txt (production-integrity FAIL, legacy-board-ui-pure FAIL, 2 BLOCKED). The 70/75 r3 figure included the lakeside-diag test, which is not on this line.

- `node tools/journey-integration/test-production-integrity.cjs`: PASS, 0 mismatches (7c1047b alone reports 20/311, see evidence/before-7c1047b-production-integrity-20-mismatches.txt).
- `legacy-board-ui-pure` on Node 20: exit 78, BLOCKED_NODE (evidence/legacy-board-ui-pure.node20.log).
- With the scratch stand-in `node -r evidence/scratch-stripTypeScriptTypes-standin.cjs tools/board-ui/test_board_ui_pure.cjs` (TypeScript transpileModule in place of stripTypeScriptTypes; **not committed**): 13/13 PASS (evidence/legacy-board-ui-pure.standin-node20.log).

## Apply

```
git fetch <this dir>/voice-build05-r4-tests.bundle voice/build05-r4-tests   # prereq 7c1047b
# or: git checkout 7c1047b && git am patches/*.patch
```
Verified in a fresh repo (f3d3614 + GGbot bundle): bundle okay; `git am` of the 3 patches on 7c1047b gives tree 48cccccd141a…, identical to e79bfca.
