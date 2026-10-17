# 04→05 set-off FADE — branch ggbot/d238881-oi-review-fade (from 450f1f5), local only. Supersedes eadd9f1 (left untouched on ggbot/d238881-oi-review).
Commit 3f3e865cb6ce9c862783d612ffeae793cfd27f36 tree 48c69164978dc179b20f9e926cba0f2896ed3bb0. Apply 0006 on top of 0001–0005 (outbox 20261016T191155Z-d238881-oi-review).
Sequence (RegionJourneyController.walk, startBlendM-0 route at d=0, lease has fadeCover): cover 0→1 0.25 s (island lens held, she has not moved)
-> under α=1: setCamera(d238881 follow pose d=0, FOV 48) + show journey scenes -> cover 1→0 0.35 s while she walks (0.42 m). Walk starts 0.25 s later than before.
Cover: shared black ScreenCover (world-r1/ScreenCover.ts + .meta), the 88506aa 主页 Graphics+UIOpacity cover ported minimally into WorldIntegrationBoot
(registered in createNavigation, cleared in onDestroy, ticked in update); WorldFlowComponent WorldLease.fadeCover getter forwards to it. No cover -> old path.
Audio: untouched (no stop/switch/duck; wind continues). Cancel during fade-out -> cover back to 0 in 0.2 s, no walk.
journeyCamera, F1/F6 and occlusion tests: unchanged from d238881/450f1f5 (no exemptions added; no fade frames are in their samples).
Metrics (60 fps): before visible cut 50.73 m / 132.07° / FOV 42→48 in one frame (3044 m/s, 7924°/s). After: the same cut happens only on the α=1 frame;
visible frames peak 1.18 m/s, 2.17°/s, FOV constant 42 (fade-out) then 48 (fade-in). Post-cut = d238881: max 0.02 m/frame, 2.18°/s (0–10 m).
Fade-in frames (d 0–0.42 m): in frame, chest/head/face unoccluded, no palm; only low points behind env_island_props_merged (same as d238881 legs exemption).
Test stub: test_startup_ready_gate.cjs gets a ScreenCover boundary stub (it stubs every Boot import).
Suite 33/38 = baseline non-passes only. Video: geometry-only Workbench render of fixture triangles + red capsule; not a game capture.
