# b20 meadow board lens r2 (运镜bot)

The images are outside the repo, in /workspace/wechat-game/product/2026-10-30/meadow-board-lens/ (untracked).

- The code is the same as 1b810e5a (old branch cine/b20-meadow-board-lens, left untouched), with the speed headroom added.
- Mainline meadow reward walks (05→06→07→08) are one fold path: MeadowStageLens.meadowFoldPlan / meadowFoldPose.
  - The board offset rides her and eases toward the follow lens and back.
  - Her chest is kept on the eased screen spot, so she stays in frame.
  - The walk starts on the board lens she left and ends exactly on the next board lens.
  - No fade and no pause. One writer (blendPath).
- Departure (08→09): the board lens eases onto the live follow lens (meadowBlendSeconds) during the walk.
- The gate tools/meadow/test_meadow_stage_lens.cjs runs 84 runs: 7 screens × (3 folds + 1 departure) × 3 frame rates.
  - FAIL conditions: under 8 pt from the edge on the boards; over 7.5 m/s; leaving the frame or face blocked for more than 0.5 s during the walk.
- GGbot diffs: ggbot-RegionBoardLanding.diff, ggbot-RegionNodeStage.diff. They apply cleanly on r2 HEAD.

Rebase onto a new 场景设计部 SHA:
1. New branch from that SHA; cherry-pick the r2 commits.
2. git apply the two diffs in a throwaway worktree.
3. Run: node tools/meadow/test_meadow_stage_lens.cjs
   If it fails only on "M1 moved since the 05 fixture", review stage 05, then rerun it with --write-05-fixture.
4. Renders: OUT=<dir> node tools/meadow/lens-renders/shots.cjs [--before <old fixture>];
   REPO=. OUT=<dir> blender -b -P tools/meadow/lens-renders/render.py;
   OUT=<dir> IMG=<dir> python3 tools/meadow/lens-renders/compose.py
