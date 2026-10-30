# full9c final-cam notes (cine/b19-full9c-final-cam)
## GGbot diffs (stable names, apply in this order on the branch head)
1. RegionNodeStage-finale-rail.diff: rails + mesh joins; the walk lens is SkyRunLens.skyRailFollow (skip-aware), written by the existing tickLens / blendPath writers only (no new writer).
2. BalloonTransit-b1-ease.diff: B1 eases from the B1-hold pose.
3. BalloonTransit-3b-landing.diff (on top of 2): one landing move from ride end −2 s, aim eased onto her (in frame, margin ≥ 0.08), B5 continues it. Written by the existing apply()/b5Draw writers only.
Verified: `git apply` clean in a fresh worktree (/workspace/scratch-fc2) at the branch head; full suite run there.
## Skips
Walk-plan skips (her teleport between runs) are no longer lens cuts: skyRailFollow takes the baked SKY_JOINS.m path (A* with her chest/face seen over 0–3 m of her next run, hidden nodes rejected within 12 m) and eases the aim onto her. Rails end on a spot that frames and sees her next-run start. planSkip (fromS6, tools model only — not called at runtime) uses the same follower; its 0.6 s-class move peaks at 0.59 m/frame (gate ≤ 0.6).
## >12 m spans
far12-spans.md / far12-spans.json: every span where the lens is > 12 m from her chest. Board-join spans are not occlusion-gated (approved rule) and DO have long face-hidden runs (up to 5.1 s on one screen, S3>S4 / S4>S5 / S4>S6 board joins) — for Grok Bot's decision. Skip joins are occlusion-gated at any distance.
## Night landing
The landing lens code has no day/night branch (asserted by the landing-move gate on the BalloonTransit source); night rows run the same poses: hold 0, peak 7.63 m/s, in-frame ≥ 0.546, clearance ≥ 1.83 m, sight lines clear. Night lighting is not modelled.
## Size
SkyFinaleShot's runtime-dead T-02 bake search / approach models moved to tools/asset-companions/region/SkyFinaleShot.ts (harness merges them), −9.4 KB raw. See the report for the table.
## Other
/workspace/wt-sf/tools/journey-integration/run-suite.cjs has one unresolved conflict-marker block; wt-sf is unused, left as is.
