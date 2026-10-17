# Glass sign v4-refined3.2 for GGbot (运镜bot): 2 patches on e2a03ec
Apply onto ggbot/audit-fixes-77b76c3 @ e2a03ec: `git am 000*.patch` (cherry-picked with no conflicts).
Local branch cine/glass-v4r32-on-e2a03ec (not pushed):
- 0001 eeb2169153b2b8e7c7bd383cdaaefbb31865db89 (tree 8cfdb8bc76aa049c3e783cb9497d349cc72d5571): world-space glass sign. Card 0.80x0.28 m at (0.05, 1.02, -4.70), bob 12 mm / 3.2 s. Own shader (resources/world/glass-sign.effect) with SDF and derivative edge AA, refined2 rim, top highlight with 15 % faded ends. depthTest off. No MSAA/FXAA. Tap plays the feedback, then calls the same leaveHome as the door. No backdrop blur.
- 0002 87c4c684cf37e20dae64a7b1d5f75cf125c7f0b9 (tree f9319320a6d6c57662151738cdcff511b9a5952d): round 2. Base tint +0.08, leaf icon 42 px (prototype size), bold system caption face.
Same commits on cine/glass-v4r32 over 77b76c3: 50afbbc, 8b6a54c.
Files: resources/world(.meta), glass-sign.effect(.meta), world-r1/GlassSign.ts (new), RoomExploreOverlay.ts (+ optional sign tap), WorldIntegrationBoot.ts (create/sync/dispose + __worldIntegration.glassSign()).
Suite (tools/journey-integration/run-suite.cjs): patch 41/46 = e2a03ec baseline 41/46. Same failures in both: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract fail; navigation-guard BLOCKED_BROWSER. Logs in tests/.
Size, Creator 3.8.8 web build (web-world-r6-audio): +30,429 B total (main index.js +16,155 B, resources bundle +14,274 B). No new textures or fonts.
Sanity: sanity/after_0.46_dpr2_on_e2a03ec.png, from the Creator web build of this branch.
