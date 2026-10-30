# b20 meadow board lens r3 (运镜bot), on scene/b20-meadow-walk-fixes 8e73b26c (final M0/M1)

The images and per-frame tables are outside the repo, in /workspace/wechat-game/product/2026-10-30/meadow-board-lens/ (untracked).

- Rebuilt from the r2 commits (cherry-picked; r1 and r2 branches untouched).
- The 05 fixture follows M1 by (-0.4, +0.039, 0) only.
- Reopen-at-05 (TransitResume.reopenAfterKill → M0):
  - Own lens on M0: MeadowStageLens.setMeadowReopenAtM0(true), same solver.
  - Walk M0→M1 with the lens folded in: RegionNodeStage.playMeadowReopen + RegionNodePlay.runMeadowReopenWalk.
  - Nothing in production calls reopenAfterKill yet. The caller has to call setMeadowReopenAtM0(true) before the board shows, then playMeadowReopen.
- Gate tools/meadow/test_meadow_stage_lens.cjs: 105 runs = 7 screens × (3 stage folds + departure + reopen fold) × 3 frame rates.
  - FAIL conditions: under 8 pt from the edge; over 7.5 m/s; reopen overlapping the board UI (FAILs on the default lens).
- GGbot diffs: ggbot-RegionBoardLanding.diff, ggbot-RegionNodeStage.diff (apply on r3 HEAD).
- meta-allowlist-MeadowStageLens.diff: the approved allowlist entry, already committed (9ac93646 on r3).
