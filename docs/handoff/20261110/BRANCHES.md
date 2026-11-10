# 2026-11-10 交接时推送的分支清单（自动生成）

生成时间：2026-11-10（America/New_York）。来源：盒子 /workspace 下 156 个 worktree + 若干独立 scratch 仓库，以及 Funning 的 Mac。

## A. 本地有未推送提交的分支（按原名普通 push，未 force）

| 分支 | SHA | 新推提交数 | 最新提交 |
|---|---|---:|---|
| `backup/build16-d4d4d51f` | `d4d4d51f` | 2 | build16-oichar: drop 2 Oi candidate GLBs (non-shipping; available at oi/... 9a47dc69) |
| `build/m1m2-mac` | `dd47465b` | 1 | fix(coast): enterRegion('coast') resolves next coast row by ordinal; trial-only coast-next key |
| `cine/b19-full6-cam` | `567c3959` | 2 | full6-cam outbox |
| `cine/b19-full7-cam` | `218efb3d` | 3 | full7-cam: meadow pre-walk follow = BalloonB1Start.b1PreWalkLens (critically damped heading; corner yaw-acc p9 |
| `cine/b19-full8-cam` | `977217fd` | 1 | full8-cam outbox (STATUS, NOT_ENGINE before/after, collision-gate m2 json, bundle 3ec2dd26..b3a8da63, SHA256SU |
| `cine/b19-full8-skyfollow` | `dfab4bcd` | 1 | sky-resume-follow: root cause = resume lens has no clearance and S0/S3 walks pass covered passages (no 1.1 m-c |
| `cine/b19-full9c-camtrace-world` | `23aa9644` | 1 | cinematic: hard-cut register (HC-01 flight seam f3918, HC-02/03 board cuts f5684/f5689, HC-04..06 designed cut |
| `cine/b19-full9c-clip19` | `da7fbae7` | 17 | clip19: run-suite-clip19-cd0893ea.diff (row + gate files for GGbot cd0893ea chain) |
| `cine/b19-full9c-clip3` | `222cc149` | 1 | full9c clip3: whole-trajectory lens clearance gate (real skycity/lakeside/balloon meshes, her, ground; sky→l |
| `cine/b19-full9c-final-cam` | `410517c0` | 14 | full9c final-cam outbox: 00 camera-owned diff, 10 clip19 residual, k-join before/after + 7-screen strip, >12 m |
| `cine/b19-full9c-finale-plan` | `7ad96cc9` | 2 | full9c: walk lens city aim = fixed SKY_FINALE_CITY_LOCAL (not dragged by the finale pose) → SKY_5A_WALK_PLAN |
| `cine/b19-full9c-on-skyframe` | `daf298a8` | 4 | full9c T-02 clip3: finale rail (SKY_FINALE_RAILS, baked on the real skycity mesh incl. steps; run 1 starts on  |
| `cine/b19-full9c-onewriter` | `972cca12` | 9 | onewriter outbox: 01-03 refreshed from final-cam 11767f5b; ORDER.md (final-cam 3 → clip19 5 → onewriter 04 |
| `cine/b19-s6-follow` | `dc08e8cf` | 1 | s6-follow: SkyPreFollow (critically damped heading) for the off-S6 pre-walk lens; corner yaw 172→71.7 °/s;  |
| `cine/b20-coast-arrival-runtime` | `3730315f` | 1 | Merge commit '3dab3967' into cine/b20-coast-arrival-runtime |
| `cine/b20-coast-board-lens` | `b70bc410` | 7 | coast transition v4.2 S3: 7-screen before/after image + restored after-shots |
| `cine/b20-coast-transition-draft` | `b9053b7e` | 8 | coast v3.5: activation_gate code check (sail driver/SailArt only in island->meadow journey, disposed; wake str |
| `cine/b20-l04-lens` | `d26b344b` | 2 | cine: L04 exit on the island v2.2 hero axis + skinned-palm gate |
| `cine/b20-meadow-board-lens` | `1b810e5a` | 1 | b20 meadow-board-lens (Grok Bot plan 1): per-stage meadow board lens 05-08 (MeadowStageLens; same view/FOV, tr |
| `cine/b20-meadow-board-lens-r2` | `4b02a82c` | 4 | b20 meadow-board-lens r2: outbox (text only: README, GGbot diffs for r2, transition metrics, stage report) + t |
| `cine/b20-meadow-board-lens-r3` | `102e6e8e` | 1 | b20 meadow-board-lens r3: outbox text (README, GGbot diffs for r3, allowlist diff, transition metrics, stage + |
| `cine/b20-meadow-nodelens-ease` | `8b260d13` | 2 | cine: stage-04 island entry+departure lens (plan E), gate, strips, outbox diffs |
| `cine/b20-t6-offframe` | `fcb62d60` | 2 | b20 T6 registry gate: off-frame only inside registered board-join head/tail windows (<=0.4 s), any distance; s |
| `cine/b21-island-i3i4-clean` | `6fafe01e` | 2 | cine b21: FollowHeading lazily created (??=) so prototype-only RegionNodeStage harnesses keep working; explore |
| `cine/transitions-continuous` | `0df94c89` | 5 | cine: seg1-4 follow shots on 01975129 anchors (HerShot), flight take-off shift to new basket + landing +0.12,  |
| `fjord-meta` | `ab820b58` | 1 | chore(fjord): Creator 3.8.8 first import of env_fjord.glb |
| `ggbot/autoplay-pretransition` | `e0e85405` | 1 | qf-autoplay: journey phase=failed, snapshot errors, wx.onError/unhandled rejections and HUD-suppressed errors  |
| `ggbot/autoplay-pretransition-f08` | `2ee28dd6` | 1 | wx-autoplay: preTransition/preT op (enable hook without launch params, setup, optional normal tap on returned  |
| `ggbot/b16-meadow-preload` | `427e1c67` | 2 | b16 meadow preload: callback-chained AudioPreload (no microtask hop); scene-bgm-switch harness warms beds via  |
| `ggbot/b17r15-verify` | `e3b881d8` | 2 | b17r15: refresh text manifest after lens-guard merge |
| `ggbot/b17r8-mac-verify` | `3efe2a0c` | 2 | manifest regen |
| `ggbot/b20-sync-b23` | `592907ee` | 2 | B23 sync: journal-sky source gate accepts the qa-scoped seeding call; manifests via tool |
| `ggbot/coast-sync-b23` | `528af1b8` | 2 | B23 sync: journal-sky source gate accepts the qa-scoped seeding call; manifests via tool |
| `ggbot/fg-autoplay-leveltime` | `44727d98` | 1 | wx-autoplay: record per-level wall time ([QF_LEVEL_TIME], result.json levelTimes) + suite test |
| `ggbot/fg-mainpkg-gate` | `870884c5` | 2 | revert suite report outputs accidentally included in 19cf5f3c (reports stay as in 19bd812a) |
| `ggbot/fg-system-panels` | `39b87291` | 1 | IMPLEMENTATION_NOTES: late-engine advisory crossfade not feasible on WeChat (one on-screen canvas, shared GL c |
| `ggbot/fix-balloon-windsource` | `cc93d12d` | 1 | P0 balloon: call actor.setWindSource bound (setWind.call(actor,...)); regression test balloon-windsource-bound |
| `ggbot/fix-sail-depart` | `3bbaf454` | 1 | fix-sail-depart: decode SailArt meshes before editing (inactive-rig meshopt/zlib meshes threw 'Malformed buffe |
| `ggbot/nodewalker-e-route` | `dce99d72` | 1 | PREPARED, do not merge: E route island:I3>I4 in WAYPOINT_ROUTES (运镜bot NodeWalker-island-i3-i4-E-route.dif |
| `ggbot/nodewalker-waypoints-r2` | `00e0ac7a` | 2 | nodewalker-waypoints r2: island fixture sourceSha 87ead310 -> 9d2bdc6f (d4fe0968 I5 move + 9d2bdc6f I4-I6 rout |
| `ggbot/p0drag10-verify` | `477575f1` | 2 | p0drag10: refresh text manifest |
| `ggbot/p0drag9-verify` | `579952ac` | 1 | p0drag9 verify: refresh text manifest |
| `ggbot/perf-r1-on-bg2` | `4e4121ef` | 3 | perf-land: lakeside prewarm unpin in plain-JS form (lakeside-prewarm gate evals the body) |
| `ggbot/stage-budgets` | `89d30333` | 1 | stage-budgets: [QF_PRELOAD_STAGE] ok is false when ms > budgetMs (TransitionChain.stageOk; meadow and skycity; |
| `ggbot/t03-sail-verify` | `b8317089` | 2 | fix(meta): Creator files order |
| `ggbot/yawfollower-dt` | `f6e02560` | 2 | Merge branch 'ggbot/nodewalker-waypoints' into ggbot/yawfollower-dt |
| `integration/build17-cand-ridestart` | `9a9ad671` | 11 | manifests: refresh after cine route-tests merge (22e4d236) |
| `handoff/20261110/qf-fjord-qa` | `6b8f2e03` | 2 | LOCAL QA ONLY (never push): unlock-fjord / unlock-fjord-08 presets |
| `handoff/20261110/qf-fjord-test` | `177e591c` | 3 | LOCAL QA ONLY (never push): unlock-fjord / unlock-fjord-08 presets |
| `scene/b16-skycity-night` | `04cf89c1` | 2 | scene/b16 r2: sky city night ground/foliage/rock albedo follow the meadow night grade (ambient is not dimmed o |
| `scene/b17-skycity-walk-r7` | `b7f61a9d` | 1 | skycity walk r7b: snapNear prefers cells on her side of the hit (no 30 m detour to behind a tall wall) |
| `scene/b18-design-doc-vehicles` | `fed45a5b` | 1 | docs: vehicles as built — sail island→meadow, balloon meadow→skycity and skycity→lakeside; rainbow bri |
| `scene/b19-island-depart-walk` | `c651ba8c` | 1 | b19 island depart walk (方案 E): I4 (mainline-04) [4.5,0.23,-4.9] -> [4.1,0.112,2.7] so I4->I6 is one contin |
| `scene/b19-meadow-gate-handoff` | `21eb4050` | 2 | b19 meadow gate-handoff: docs/r5 nodes M6 + M5-M6 walkM 9.5; manifests |
| `scene/b19-meadow-instancing` | `1dce50be` | 5 | meadow non-instance option (b): QFS1 segmented zlib data + bake/dump/timing tools |
| `scene/b19-meadow-walk-fix` | `f57b5030` | 1 | b19 meadow walk: test_b1_start_budget — B1 within 11.3 s from every hand-off point (M6 live-start 11.42 s PA |
| `scene/b19-night-balloon-sky` | `7aaa0618` | 1 | b19 night balloon landing moonlight: during B-f_land (31-33 s smoothstep) the board light turns to the transit |
| `scene/b19-skycity-facebudget` | `9e84571d` | 1 | b19 skycity face budget: resident skycity geometry 91,369 -> 89,560 (<= 90k). env_skycity: 1,800 never-seen fa |
| `scene/b19-snowpass` | `88790d36` | 2 | snowpass pieces: region_snowpass/board outlined piece sprite variants (all 6, ~3px #1d2440, 192px, P8) + SnowP |
| `scene/coast01-creator-import` | `b72bb0c0` | 5 | coast01 visual re-pass: driftwood + sand berm in natural colours, phone-visible beacon, 430x932 camera |
| `scene/coast02-03` | `0501b017` | 1 | fix(coast): enterRegion('coast') resolves next coast row by ordinal; trial-only coast-next key |
| `scene/lakeside-lotus-props` | `3acb00aa` | 1 | scene(lakeside): add LK_lotus_pedestal under each board piece (Funning fusion gap G5) |
| `scene/lakeside-lotus-props-contact` | `655e21de` | 8 | scene(lakeside): natural filled lilypad asset; remove washer seats under shells |
| `ui/coast-compact-hud` | `46649fd4` | 5 | coast-compact-hud: recheck P3 decisions |
| `ui/new-regions` | `4276a4f2` | 5 | 九区：开启条件、结局章去底板(S)、9 区域改版 SPEC |
| `ui/post-island-ui` | `d50c514c` | 6 | docs(post-island): 结局入口改为 L18「刻名的桥」(r04-lake-06) 通关后 |
| `ui/r6-lakeside-fix` | `cd5545d6` | 1 | r6 lakeside fix: board bg from engine-camera lakeside palette (sample.py 10/10 PASS, no haze), empty-slot + #7 |
| `ui/system-panels` | `6c629efc` | 2 | design(system-panels) v1.1: icon_vibrate.png + meta；设置图重出；SPEC：320/180 已批、信息标识� |
| `voice/audio-cc0-20261015` | `127e2fbb` | 1 | Voice Bot audio candidates 2026-10-15: 15 procedural SFX (windmill loop, door, footsteps grass/wood/stone, met |
| `grokbot/ui-3d-20261015`（/workspace/yqfl 独立克隆） | `640a5a62` | 1 | UI 3D P1: baked 3D buttons/item icons, chest v2, original island loading bg + windmill blades |

注：`qf-fjord-qa` / `qf-fjord-test` 的提交标着 LOCAL QA ONLY，所以放在 `handoff/20261110/` 下，**不要**合进 PR 分支。`qfx-*`、`voicebot/audio-cc0-20261015` 与上表同 SHA，已覆盖。

## B. 有未提交改动的 worktree → WIP 快照分支（父提交 = 该 worktree 当时的 HEAD，原分支未动）

排除：node_modules、transport_balloon.glb.meta、output/task21-ui/profile-*（浏览器配置/缓存）、.env*、*.pem、*.key、library/、temp/、build/。没有 >50MB 文件。快照里大部分是测试跑出的 reports/*.json、*.stdout.txt，可视为证据，未审阅。

| 快照分支 | SHA | 来源 worktree | 原分支@HEAD | 改动文件数 |
|---|---|---|---|---:|
| `handoff/20261110/wip-wechat-game-yiqifengle` | `e8caf419` | /workspace/wechat-game/yiqifengle | integration/build05-a3b-20261017T063646Z@a995c415 | 65 |
| `handoff/20261110/wip-cd08-suite` | `c5bffefb` | /workspace/cd08-suite | HEAD@cd0893ea | 221 |
| `handoff/20261110/wip-fs-set` | `0bb09744` | /workspace/fs-set | cine/b19-full9c-final-set@8c98bbfe | 212 |
| `handoff/20261110/wip-scratch-base` | `0b3290e3` | /workspace/scratch-base | HEAD@d3b8e5e4 | 1 |
| `handoff/20261110/wip-scratch-chain8` | `cf6274fd` | /workspace/scratch-chain8 | HEAD@11767f5b | 6 |
| `handoff/20261110/wip-scratch-clip19` | `52dab804` | /workspace/scratch-clip19 | HEAD@18965329 | 220 |
| `handoff/20261110/wip-scratch-fc2` | `91a5a4bf` | /workspace/scratch-fc2 | HEAD@74b12c50 | 54 |
| `handoff/20261110/wip-scratch-fc3` | `b6c1bc54` | /workspace/scratch-fc3 | HEAD@6af9cc41 | 208 |
| `handoff/20261110/wip-scratch-fc4` | `8a48cb0e` | /workspace/scratch-fc4 | HEAD@11767f5b | 84 |
| `handoff/20261110/wip-scratch-fc5` | `d36fd435` | /workspace/scratch-fc5 | HEAD@54d3dc3b | 209 |
| `handoff/20261110/wip-scratch-final-cam` | `6aebcb28` | /workspace/scratch-final-cam | HEAD@14f7bc96 | 219 |
| `handoff/20261110/wip-scratch-onewriter` | `c98f2357` | /workspace/scratch-onewriter | HEAD@18965329 | 6 |
| `handoff/20261110/wip-scratch-ow-cd08` | `28412ac9` | /workspace/scratch-ow-cd08 | HEAD@cd0893ea | 10 |
| `handoff/20261110/wip-scratch-ow-clip19` | `72ef6797` | /workspace/scratch-ow-clip19 | HEAD@18965329 | 11 |
| `handoff/20261110/wip-scratch-ow-fc2` | `a9ab64d3` | /workspace/scratch-ow-fc2 | HEAD@11767f5b | 226 |
| `handoff/20261110/wip-tmp-exp-wt-chk` | `d2473fbf` | /workspace/tmp-exp/wt-chk | HEAD@96dfbd33 | 2 |
| `handoff/20261110/wip-tmp-exp-wt-i4` | `a85cdb1c` | /workspace/tmp-exp/wt-i4 | HEAD@d26b344b | 11 |
| `handoff/20261110/wip-tmp-exp-wt-iwf` | `dad59fda` | /workspace/tmp-exp/wt-iwf | scene/b20-island-walk-fixes@9d2bdc6f | 289 |
| `handoff/20261110/wip-tmp-exp-wt-loader` | `2c80ca64` | /workspace/tmp-exp/wt-loader | scene/b19-coast-runtime-loader@8a279bb4 | 320 |
| `handoff/20261110/wip-tmp-exp-wt-rb` | `a199c4c1` | /workspace/tmp-exp/wt-rb | HEAD@9d2bdc6f | 1 |
| `handoff/20261110/wip-tmp-exp-wt-terr` | `8fd494f6` | /workspace/tmp-exp/wt-terr | scene/b20-island-walkable-terrain@b27fc82d | 262 |
| `handoff/20261110/wip-tmp-lkcam-wt-r3hold` | `fd1be2c4` | /workspace/tmp-lkcam/wt-r3hold | cine/region-hooks-meadow-skycity@768b272d | 1 |
| `handoff/20261110/wip-tmp-lkcam-wt-r4` | `29f0eb46` | /workspace/tmp-lkcam/wt-r4 | cine/region-hooks-meadow-r4.1-on-260ea02@0ea1564c | 82 |
| `handoff/20261110/wip-tmp-skyb2-wt` | `1e61b814` | /workspace/tmp-skyb2/wt | cine/skycity-bridge-r2-cam@e5b16a47 | 122 |
| `handoff/20261110/wip-wechat-game-work-build05-occl` | `b8d19352` | /workspace/wechat-game/work/build05-occl | ggbot/build05-v3.2-final@d238881c | 4 |
| `handoff/20261110/wip-wechat-game-work-r6-lakeside-fix` | `1401e22a` | /workspace/wechat-game/work/r6-lakeside-fix | ui/r6-lakeside-fix@cd5545d6 | 52 |
| `handoff/20261110/detached-wechat-game-work-ui-b16-fixes` | `d5ed5275` | /workspace/wechat-game/work/ui-b16-fixes | HEAD@d5ed5275 | 0 |
| `handoff/20261110/wip-wechat-game-work-wt-base88` | `21cd8b60` | /workspace/wechat-game/work/wt-base88 | HEAD@88506aa4 | 25 |
| `handoff/20261110/wip-wechat-game-work-wt-lk` | `8bebf62e` | /workspace/wechat-game/work/wt-lk | cine/lakeside-cam@f49ce470 | 1 |
| `handoff/20261110/wip-wechat-game-work-wt-oi-char` | `cafea333` | /workspace/wechat-game/work/wt-oi-char | grok/build05-oi-char-20261016T1505@7ecd2890 | 25 |
| `handoff/20261110/wip-wechat-game-work-wt-v2` | `4568f909` | /workspace/wechat-game/work/wt-v2 | cine/lakeside-hook-r2-v2@4bd6ba3c | 1 |
| `handoff/20261110/wip-wechat-game-yiqifengle-audit` | `0c552ec4` | /workspace/wechat-game/yiqifengle-audit | ggbot/audit-fixes-77b76c3@09a1b8e4 | 30 |
| `handoff/20261110/wip-wechat-game-yiqifengle-integ` | `844318b0` | /workspace/wechat-game/yiqifengle-integ | integration/build05-20261016T2048@09a1b8e4 | 32 |
| `handoff/20261110/wip-wechat-game-yiqifengle-result` | `6c82d5f6` | /workspace/wechat-game/yiqifengle-result | ggbot/result-screen@f318da4e | 1 |
| `handoff/20261110/wip-wt-b17r13-lko2` | `49abc124` | /workspace/wt-b17r13-lko2 | cine/b17r13-lakeside-occlusion2@31b21344 | 97 |
| `handoff/20261110/wip-wt-b17r7-lko` | `020cc595` | /workspace/wt-b17r7-lko | cine/b17r7-lakeside-occlusion@5ae6e43b | 96 |
| `handoff/20261110/wip-wt-base` | `7a93ed4b` | /workspace/wt-base | HEAD@19db388e | 3 |
| `handoff/20261110/wip-wt-c6` | `6a39c2ea` | /workspace/wt-c6 | cine/b19-cand6@2fc32879 | 29 |
| `handoff/20261110/wip-wt-c7` | `a06ef823` | /workspace/wt-c7 | cine/b19-full2-cam@e41bc7be | 38 |
| `handoff/20261110/detached-wt-chain-1` | `e0440931` | /workspace/wt-chain-1 | HEAD@e0440931 | 0 |
| `handoff/20261110/wip-wt-cm` | `24294453` | /workspace/wt-cm | cine/transitions-c-mooring@7692e263 | 12 |
| `handoff/20261110/wip-wt-coast-arrival` | `e5b9874d` | /workspace/wt-coast-arrival | cine/b20-coast-arrival-lens@5233c468 | 2 |
| `handoff/20261110/wip-wt-coast-board` | `70554e74` | /workspace/wt-coast-board | cine/b20-coast-board-lens@b70bc410 | 282 |
| `handoff/20261110/wip-wt-coast-board-r2` | `00625ed3` | /workspace/wt-coast-board-r2 | cine/b20-coast-board-lens-r2@7496be3e | 282 |
| `handoff/20261110/wip-wt-coast-rt` | `1d9cf21e` | /workspace/wt-coast-rt | cine/b20-coast-arrival-runtime@3730315f | 263 |
| `handoff/20261110/wip-wt-coast-size` | `ce34131a` | /workspace/wt-coast-size | cine/b20-coast-track-size@46928ab2 | 265 |
| `handoff/20261110/wip-wt-f7` | `91d55d9b` | /workspace/wt-f7 | cine/b19-full7-cam@218efb3d | 121 |
| `handoff/20261110/wip-wt-final-cam` | `6904c1a0` | /workspace/wt-final-cam | cine/b19-full9c-final-cam@410517c0 | 1 |
| `handoff/20261110/wip-wt-g7` | `dcc2cd90` | /workspace/wt-g7 | cine/b19-s6-follow@dc08e8cf | 135 |
| `handoff/20261110/wip-wt-i4a` | `fc7c7868` | /workspace/wt-i4a | cine/b21-i4-entry-e@7419810a | 5 |
| `handoff/20261110/wip-wt-island-final` | `61cfdc52` | /workspace/wt-island-final | cine/b21-island-final-camera@675b8f70 | 276 |
| `handoff/20261110/wip-wt-island-i3i4` | `e5101b7d` | /workspace/wt-island-i3i4 | cine/b21-island-i3i4-recheck@3aca707c | 228 |
| `handoff/20261110/wip-wt-island-i3i4-base` | `01fcf12c` | /workspace/wt-island-i3i4-base | HEAD@dc69e994 | 290 |
| `handoff/20261110/wip-wt-island-i3i4b` | `1afd08ec` | /workspace/wt-island-i3i4b | cine/b21-island-i3i4-clean@6fafe01e | 296 |
| `handoff/20261110/wip-wt-l04` | `614cb6e0` | /workspace/wt-l04 | cine/b20-l04-lens@d26b344b | 4 |
| `handoff/20261110/wip-wt-meadow-exit` | `f47485f1` | /workspace/wt-meadow-exit | cine/b21-meadow-exit-handover@8c528c80 | 235 |
| `handoff/20261110/wip-wt-meadow-lens` | `e08df280` | /workspace/wt-meadow-lens | cine/b20-meadow-board-lens@1b810e5a | 287 |
| `handoff/20261110/wip-wt-meadow-lens-r2` | `7b60b8ea` | /workspace/wt-meadow-lens-r2 | cine/b20-meadow-board-lens-r2@4b02a82c | 1 |
| `handoff/20261110/wip-wt-meadow-lens-r3` | `c36d31f4` | /workspace/wt-meadow-lens-r3 | cine/b20-meadow-board-lens-r3@102e6e8e | 1 |
| `handoff/20261110/wip-wt-mlf` | `c4d5dde6` | /workspace/wt-mlf | cine/meadow-liftoff-fix-v2@5bc6c139 | 61 |
| `handoff/20261110/wip-wt-night` | `e15918f5` | /workspace/wt-night | scene/b16-skycity-night@04cf89c1 | 18 |
| `handoff/20261110/wip-wt-onewriter` | `7668c2f6` | /workspace/wt-onewriter | cine/b19-full9c-onewriter@972cca12 | 186 |
| `handoff/20261110/wip-wt-p0-drag` | `3f4bef84` | /workspace/wt-p0-drag | cine/p0-drag-rotate@a34026be | 37 |
| `handoff/20261110/wip-wt-p0d5` | `492ff3bb` | /workspace/wt-p0d5 | cine/p0drag5@a248c646 | 17 |
| `handoff/20261110/wip-wt-p0d6` | `f261d6f1` | /workspace/wt-p0d6 | cine/p0drag6@42d0982f | 49 |
| `handoff/20261110/wip-wt-p0d7` | `0bd8d5c9` | /workspace/wt-p0d7 | cine/p0drag7@612732b0 | 25 |
| `handoff/20261110/wip-wt-rb` | `fd80ddd1` | /workspace/wt-rb | scene/b16-remove-rainbow-bridge@f678c084 | 53 |
| `handoff/20261110/wip-wt-sf` | `566adb8b` | /workspace/wt-sf | cine/b19-full9c-on-skyframe@daf298a8 | 1 |
| `handoff/20261110/wip-wt-skirt` | `15c554f7` | /workspace/wt-skirt | cine/b21-skirt-front-hem@04788770 | 310 |
| `handoff/20261110/wip-wt-skirt-seat` | `d28ff139` | /workspace/wt-skirt-seat | cine/b21-skirt-seated@7202ad8f | 310 |
| `handoff/20261110/wip-wt-skw7` | `da4cc630` | /workspace/wt-skw7 | scene/b17-skycity-walk-r7@b7f61a9d | 61 |
| `handoff/20261110/wip-wt-t03` | `b71cea17` | /workspace/wt-t03 | cine/t03-balloon-12s@b1bb58e7 | 45 |
| `handoff/20261110/wip-wt-trans` | `81559614` | /workspace/wt-trans | cine/transitions-continuous@0df94c89 | 46 |
| `handoff/20261110/wip-wt-b1ff` | `881591af` | /workspace/wt/b1ff | ggbot/full9c-b1-firstframe@cd0893ea | 135 |
| `handoff/20261110/wip-wt-b1ff-base` | `66b816c7` | /workspace/wt/b1ff-base | HEAD@d3b8e5e4 | 1 |
| `handoff/20261110/wip-wt-b20-island-rebake` | `307803ae` | /workspace/wt/b20-island-rebake | ggbot/b20-island-rebake@4b0aacb0 | 259 |
| `handoff/20261110/wip-wt-b20-journal-r5` | `722cde93` | /workspace/wt/b20-journal-r5 | ggbot/b20-journal-r5@773c061e | 306 |
| `handoff/20261110/wip-wt-b20-shadow-churn` | `e90a71dd` | /workspace/wt/b20-shadow-churn | ggbot/b20-shadow-churn@481c599c | 312 |
| `handoff/20261110/wip-wt-b20-shadow-churn-r2` | `8c53e1bb` | /workspace/wt/b20-shadow-churn-r2 | ggbot/b20-shadow-churn-r3@d70b2138 | 322 |
| `handoff/20261110/wip-wt-b20-skirt-hem` | `9267b2cc` | /workspace/wt/b20-skirt-hem | ggbot/b20-skirt-hem@04788770 | 310 |
| `handoff/20261110/wip-wt-b20-skirt-seated` | `e58b9ab1` | /workspace/wt/b20-skirt-seated | ggbot/b20-skirt-seated@7202ad8f | 310 |
| `handoff/20261110/wip-wt-b20-sync-b23` | `beb46467` | /workspace/wt/b20-sync-b23 | ggbot/b20-sync-b23@592907ee | 320 |
| `handoff/20261110/wip-wt-b20-sync-b23-r3` | `c8cec9d0` | /workspace/wt/b20-sync-b23-r3 | ggbot/b20-sync-b23-r3@05c2d2ce | 1 |
| `handoff/20261110/wip-wt-b20-walk` | `84be0745` | /workspace/wt/b20-walk | ggbot/b20-walk-merge@c88320c1 | 239 |
| `handoff/20261110/wip-wt-board-kit` | `fe358ab2` | /workspace/wt/board-kit | ggbot/board-kit-p0@378d9d3a | 217 |
| `handoff/20261110/wip-wt-board-kit-p1` | `f187d6d4` | /workspace/wt/board-kit-p1 | ggbot/board-kit-p1@00cb5bef | 291 |
| `handoff/20261110/wip-wt-cand-20261030` | `3de79fa2` | /workspace/wt/cand-20261030 | ggbot/cand-20261030@fc3123fa | 211 |
| `handoff/20261110/wip-wt-clip19chk` | `c7154129` | /workspace/wt/clip19chk | HEAD@d2b2a7cc | 5 |
| `handoff/20261110/wip-wt-clip19chk2` | `2b7c3b5c` | /workspace/wt/clip19chk2 | HEAD@0e5514c4 | 5 |
| `handoff/20261110/wip-wt-clip19chk3` | `41b482b5` | /workspace/wt/clip19chk3 | HEAD@0e5514c4 | 76 |
| `handoff/20261110/wip-wt-coast-arrival-her` | `3d469477` | /workspace/wt/coast-arrival-her | ggbot/coast-arrival-her@991576c2 | 245 |
| `handoff/20261110/wip-wt-coast-arrival-safearea` | `18734551` | /workspace/wt/coast-arrival-safearea | ggbot/coast-arrival-safearea@c442baae | 287 |
| `handoff/20261110/detached-wt-coast-bd-check` | `e8627759` | /workspace/wt/coast-bd-check | HEAD@e8627759 | 0 |
| `handoff/20261110/wip-wt-coast-journal-r5` | `b923fecb` | /workspace/wt/coast-journal-r5 | ggbot/coast-journal-r5@9c50e0fd | 315 |
| `handoff/20261110/wip-wt-coast-kit-int` | `bf1fa543` | /workspace/wt/coast-kit-int | ggbot/coast-kit-int@57ef5ac4 | 241 |
| `handoff/20261110/wip-wt-coast-kit-int-arrival` | `2457b922` | /workspace/wt/coast-kit-int-arrival | ggbot/coast-kit-int-arrival@f9c5656a | 263 |
| `handoff/20261110/wip-wt-coast-shadow-churn` | `bf03dc46` | /workspace/wt/coast-shadow-churn | ggbot/coast-shadow-churn@dce549a4 | 317 |
| `handoff/20261110/wip-wt-coast-shadow-churn-r2` | `d8642b4b` | /workspace/wt/coast-shadow-churn-r2 | ggbot/coast-shadow-churn-r3@6aa3c737 | 327 |
| `handoff/20261110/wip-wt-cp-test-c88320c1` | `fa11b7d7` | /workspace/wt/cp-test-c88320c1 | ggbot/p0-safearea-on-b20@1e648626 | 257 |
| `handoff/20261110/wip-wt-fg-gate` | `a745ac63` | /workspace/wt/fg-gate | ggbot/fg-mainpkg-gate@870884c5 | 189 |
| `handoff/20261110/wip-wt-fg-leveltime` | `2ec0630d` | /workspace/wt/fg-leveltime | ggbot/fg-autoplay-leveltime@44727d98 | 189 |
| `handoff/20261110/wip-wt-fg-meadow-encode` | `9d6a3960` | /workspace/wt/fg-meadow-encode | ggbot/fg-meadow-encode@aaeabd24 | 141 |
| `handoff/20261110/wip-wt-fg-meadow-gates` | `bd960f93` | /workspace/wt/fg-meadow-gates | ggbot/fg-meadow-gates@91088ce7 | 194 |
| `handoff/20261110/wip-wt-fg-new-regions` | `4873fcd8` | /workspace/wt/fg-new-regions | ggbot/fg-new-regions@d4f25246 | 45 |
| `handoff/20261110/wip-wt-fg-preload-sizes` | `c670fcd1` | /workspace/wt/fg-preload-sizes | ggbot/fg-preload-sizes@8ad132a2 | 197 |
| `handoff/20261110/wip-wt-fg-system-panels` | `fb246be0` | /workspace/wt/fg-system-panels | ggbot/fg-system-panels@39b87291 | 43 |
| `handoff/20261110/wip-wt-fg-update` | `72aee2df` | /workspace/wt/fg-update | ggbot/fg-update-manager@b15ca0df | 189 |
| `handoff/20261110/wip-wt-fullN-20261030` | `5f62cf3c` | /workspace/wt/fullN-20261030 | ggbot/fullN-20261030@85559762 | 185 |
| `handoff/20261110/wip-wt-glb-skin` | `17d4cdb9` | /workspace/wt/glb-skin | ggbot/glb-skin-bounds@96986d56 | 213 |
| `handoff/20261110/wip-wt-journal-r5` | `cbcf1b29` | /workspace/wt/journal-r5 | ggbot/journal-r5-paper-inset@a5cf58fa | 229 |
| `handoff/20261110/wip-wt-journal-r6` | `8b021880` | /workspace/wt/journal-r6 | ggbot/journal-r6@bc09aac1 | 2 |
| `handoff/20261110/wip-wt-journal-r6-preview-guard` | `3bad2122` | /workspace/wt/journal-r6-preview-guard | ggbot/journal-r6-preview-guard@fcb354a9 | 237 |
| `handoff/20261110/wip-wt-nodewalker` | `63ea9fad` | /workspace/wt/nodewalker | ggbot/nodewalker-waypoints@95b135e7 | 213 |
| `handoff/20261110/wip-wt-nodewalker-r2` | `1a7f4145` | /workspace/wt/nodewalker-r2 | ggbot/nodewalker-waypoints-r2@00e0ac7a | 290 |
| `handoff/20261110/wip-wt-p0-shadow-churn-r2` | `0691c2cf` | /workspace/wt/p0-shadow-churn-r2 | ggbot/p0-shadow-churn-r3@aa044e43 | 265 |
| `handoff/20261110/wip-wt-p0wm` | `afe9d2bf` | /workspace/wt/p0wm | ggbot/fg-grass-preswap@6041e8e9 | 195 |
| `handoff/20261110/wip-wt-palm-clear` | `5c3a98a0` | /workspace/wt/palm-clear | cine/b20-island-palm-clearance@0a8e294b | 291 |
| `handoff/20261110/wip-wt-probes` | `0343ca2e` | /workspace/wt/probes | ggbot/full9c-probes@7fbf8dd7 | 137 |
| `handoff/20261110/wip-wt-probes-strip` | `f8efe574` | /workspace/wt/probes-strip | ggbot/full9c-probes-strip@cd2f58df | 199 |
| `handoff/20261110/wip-wt-reveal-restore` | `d2d1b239` | /workspace/wt/reveal-restore | ggbot/reveal-restore@fa7fb450 | 211 |
| `handoff/20261110/wip-wt-shadow-churn` | `d8f4477d` | /workspace/wt/shadow-churn | ggbot/p0-shadow-churn@6ef362f2 | 255 |
| `handoff/20261110/wip-wt-stage-budgets` | `5eda3e18` | /workspace/wt/stage-budgets | ggbot/stage-budgets@89d30333 | 13 |
| `handoff/20261110/wip-wt-p0-fin-lake` | `78602d67` | /workspace/wt/p0-fin-lake | ggbot/p0-fin-lake-freeze@3ab153bd | 253 |
| `handoff/20261110/wip-mac-oi-web-input-freeze-native` | `f3dee308` | Mac ~/Documents/Codex/2026-10-16/yiqifengle-oi-web-input-freeze-native-20261016 | oi/web-input-freeze-native-20261016@690454cd | 7 |

`detached-*` 是没有分支名、但有未推送提交的 detached HEAD，原样推送。

## C. 独立 scratch 小仓库（10 月的补丁暂存仓库，和主仓库历史无关，推为孤立历史分支）

- `handoff/20261110/scratch-wechat-game-work-ggbot-0008b-repo` @ `8aa668cf`
- `handoff/20261110/scratch-wechat-game-work-ggbot-island-bundle` @ `58e4dce3`
- `handoff/20261110/scratch-wechat-game-work-ggbot-e8-tools` @ `625beb31`
- `handoff/20261110/scratch-wechat-game-team-cinematic-work-m1v2-clipfix` @ `c4c14466`
- `handoff/20261110/scratch-e4-t0007-meadow` @ `2b513b00`
- `handoff/20261110/scratch-e4-mi` @ `6af81e26`
- `handoff/20261110/scratch-t0007-wibrepo` @ `1db288cc`
- `handoff/20261110/scratch-t0007-sim13` @ `7bd63425`
- `handoff/20261110/scratch-t0007-wib13` @ `6ce41afc`
- `handoff/20261110/scratch-t0007-simrepo` @ `350c8e2d`
