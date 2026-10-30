# b20 meadow board lens (运镜bot) — Grok Bot plan 1

Base: scene/b20-meadow-walk-fixes 3fb967af. Branch: cine/b20-meadow-board-lens.

- Each meadow board 05–08 frames its own node (05→M1, 06→M2, 07→M3, 08→M4), solved with meadowFramedPose + boardSafeInsets.
  Same orientation, pitch and FOV (49.426°) as the shared lens, so it's a translation only. 05 is unchanged on every screen ≥390 pt wide.
- Narrow screens (360x780, 320x568): the room edge moves in by the measured overhang, so she is ≥8 pt from the edge. 05 shifts by ≤2 pt there.
- The lens moves are folded into the reward walk (RegionNodeStage.meadowRewardFold), with no fade and no pause.
- Gate: tools/meadow/test_meadow_stage_lens.cjs. It FAILs on 3fb967af (stage 06 at -33.6 pt on 390x844) and PASSes with the diffs.
- GGbot diffs: ggbot-RegionBoardLanding.diff, ggbot-RegionNodeStage.diff. Grok Bot review: grokbot-review-meta-allowlist.diff.
- Images are Blender Cycles renders with real textures (env_meadow.glb plus her glb), not engine captures. The UI rects are overlaid,
  and the box around her is green when she is ≥8 pt from the edge.
- Tables:
  - transition_metrics.csv: before and after, per real dt.
  - frames_before_3fb967af.csv / frames_after.csv: per-frame data.
  - stage_lens_report.json: per stage and screen.
  - follow_cam_walks.json: walk occlusion and clearance.
