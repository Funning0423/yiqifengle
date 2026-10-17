# Result screen (结算界面): ggbot/result-screen, based on 88506aa. Local only, nothing pushed.

Commits (base 88506aa):
- 2e7f5bf: from PR #55 16d7ca1, settlement files only. Centred 3D chest hero and the roomy layout.
- 81a3e2a: from PR #55 5575c78, settlement parts. One 「全部领取」 claims everything, and the 获得 panels merge.
- d6d150b: from PR #55 bd10569, settlement hunks. ClaimAll fires once, and same-turn claims batch into one invoke.
- c87881f: new work. 3D bottom buttons, region item icon cards, and the chest stays open after claiming. Adds tests.

Head c87881f153ef3f114f2192fbc9405527995893a3, tree ddebca9dd75a6acf396fb53955f1d3e8a8802612. The git am tree check matches (TREE_CHECK.txt).

## What was taken from PR #55, and what was left out
- **16d7ca1**
  - Taken: BoardPanels.ts, test_result_safe_area, test_user_priority_defects.
  - Left out: sign shadow and sea decals (SeaSurfaceFollow, IslandAtmosphereFx, WorldNativeComposition, IslandProps*), DebugJumpPanel, settings icons, WorldFlowComponent.
- **5575c78**
  - Taken:
    - BoardPanels result hunks.
    - ManagedMobileBoardUI reward merge (rewardShown/rewardChest).
    - Result tests: safe_area, viewports, reward_background_return, user_priority_defects, and the board_runtime ClaimAll line.
  - Left out:
    - The pause-panel hunks: audio toggles removed and panel height 800→680. These are not settlement changes.
    - Loading, day-night, island entrance, the tool bubble, and rule-guide memory.
    - Settings hit boxes, the tool-intro mark, WorldFlowComponent, IslandProps, builder.json and build options.
    - ui01_reward_dedup (that file is not on the base).
- **bd10569**
  - Taken: the ClaimAll spent-guard, enqueueResultBatch with resultActions, test_claim_batch, and the board_runtime ClaimAll checks.
  - Adapted:
    - The batch now runs on a microtask instead of setTimeout(0). legacy-startup-ready forbids timers in WorldIntegrationBoot.
    - test_result_viewports now expects the one-shot ClaimAll. PR #55 left that check failing.
  - Left out: night-sky readback, DebugJumpPanel, StartupLoading*, dock fade/targets, WorldFlowComponent, IslandProps, RegionFlowTest, WorldNativeComposition.
- **3b6589d**: nothing taken. It has no settlement hunks (dock icons, cream cover, debug home/opGen).

## New work (c87881f)
- **Bottom buttons 「下一关」「回小岛」**
  - Height 56, plate artScale 0.6 (was 0.45 / 48), a 5-unit drop shadow behind the face, identical widths.
  - At 390×844 with WeChat insets: each is 155×56.
    - Centres are at (113.5, 750) and (276.5, 750) in screen points from the top-left.
    - Spans: x 36–191 and 199–354, y 722–778. The shadow reaches y 783; the bottom safe edge is 810.
  - 320×568: 136×56. 375×667: 147.5×56.
- **Chest**
  - Size: 240×216 at 390×844 (with or without insets). Never smaller than 96×86. On short screens: 122×110 at 320×568, 120×108 at 375×667 SE.
  - The whole result stays on one page at every size checked.
  - A ready chest no longer repeats 打开宝箱; 「全部领取」 sits under it.
- **Region items: icon cards**
  - 120×120 (120×96 on short pages): rays and the icon on top, the item name below (TOOL_NAMES, e.g. 潮汐网), a cream well, a 4-unit shadow.
  - The cards sit centred in a row under the chest.
  - The long per-item claim bar is removed; 「全部领取」 is the only claim. Claimed cards carry the stamp.
- **Chest after claiming**: ResultChest3D.open(false), so the lid holds the chest_open end pose (−118°).
  - With the 2D fallback (when the 3D chest fails to load), it stays the closed sprite plus the stamp. There is no new image asset.

## Tests
- Full suite at c87881f: 34/39 (logs/test-suite_c87881f.log).
  - Baseline 88506aa: 32/37 (logs/test-suite_88506aa-baseline.log).
  - Two suite entries were added: result-claim-batch and result-screen-style. Both pass.
  - The same 5 known non-passes remain: production-integrity, legacy-board-ui-pure, reward-background-return and cloud-web-contract fail; navigation-guard is BLOCKED_BROWSER.
- Outside the suite: test_result_safe_area PASS, test_result_viewports PASS, test_board_runtime PASS.
  - test_user_priority_defects and test_result_reward_width already fail at 88506aa, in the same way.

## Package size
- Not measured on a device build yet; this is an upper bound.
- c87881f adds no assets. Raw TS growth from 2607de6 (measured on the Mac at 24,539,994 B) to c87881f is +20,724 B. That includes 88506aa's own changes.
- So the total is ≤ 24,560,718 B = 23.42 MiB, at or under 23.5 MiB (24,641,536 B), with at least 80 KB to spare.

## Media: harness layout previews, not device recordings
There is no Cocos Creator on the box. These images come from the real BoardPanels node tree (tests/harness.cjs) composited with the real board_art PNGs.
- **3D chest**: Blender renders of result_chest.glb with the island palette and the chest camera (pitch 40°, fov 30). Lid frames follow LID_KEYS.
- **Background**: a blurred Mac frame of the home screen.
- **Night**: uses the UI night tint.
- **Files**:
  - media/result_{day,night}_390x844.mp4, 6.5 s each: before → after (ready) → tap 全部领取 → lid opens → hold.
  - media/before_*.png, after_*_{ready,claimed}.png, compare_*_before_ready_claimed.png.
- The device check by 界面验收部 is still to do.
