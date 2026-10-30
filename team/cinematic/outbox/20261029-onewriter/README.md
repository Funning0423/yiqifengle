# onewriter (Mac 19bd812a MULTI=2: finstart 12, m 7) — 运镜bot
Branch cine/b19-full9c-onewriter (from final-cam 18965329). Apply in order on final-cam HEAD 18965329 (checked: all 4 apply clean in sequence):
01-RegionNodeStage-finale-rail.diff, 02-BalloonTransit-b1-ease.diff, 03-BalloonTransit-3b-landing.diff (= final-cam outbox, byte-identical to /workspace/wt-final-cam at 21:3x EDT), 04-CameraPose-onewriter.diff (already committed on this branch).

## Same-frame writer pairs (raw ev/*/console.log, pairs by fr=)
| seg | t s | fr | 1st write → 2nd write | Δpose | should win | root cause (file:line, final-cam tree) |
|---|---|---|---|---|---|---|
| fin+m | 3.9 | 145/152 | world.setCamera → world.setCamera | 0 | either (same) | startup places the home lens twice in one frame (WorldFlowComponent.ts:440 setCamera, two callers on boot) |
| fin+m | 5.0/9.2 | 146/262 | world.setCamera → world.animateCamera | 5 mm | animateCamera | the track's first sample lands in the frame of the hold write (WorldFlowComponent.ts:479 createCameraTrack) |
| fin+m | 8.0/12.3 | 245/339 | animateCamera → animateCamera | 0 | 2nd track | track N end pose + track N+1 first sample in one frame (CameraPose.ts createCameraTrack end write) |
| fin+m | 16.0/20.4 | 500 | animateCamera → animateCamera | 3.6 mm | 2nd track | same as above |
| fin+m | 54.2/69.0 | 888/876 | world.setCamera (sail start, JUMP 50 m = registered seam) → RegionJourneyCore:onFrame | 0 | onFrame | start pose written, then observe() lease.onFrame same frame (RegionJourneyCore.ts:258) |
| fin+m | 189/241 | 1506/1502 | onFrame → world.setCamera | 0 | onFrame | observe() writes TWICE: lease.onFrame (RegionJourneyCore.ts:258) and journeyCamera (RegionJourneyCore.ts:264) |
| fin+m | 191/243 | 1531/1527 | LiveHandoff → LiveHandoff | 0 | either | same double observe write, both go through patchCamera (RegionJourneyCore.ts:278-284) |
| fin | 283.9 | 2463 | BalloonTransit:B5 → world.setCamera | 0 | B5 | B5 last landing write + arrival setCamera same frame (BalloonTransit B5 end → WorldNativeComposition arrival) |
| fin | 299.7 | 2757 | regionBoardHandoff → regionLandingToBoard | 0 | handoff | RegionBoardLanding.ts:161 final `to` write, then :133 landing write without awaiting a frame |
| fin | 303.0 | 2800 | node-lens → node-lens | 0 | either | RegionNodeStage.ts:1059 takeSyncView writePose, then openExplore writes again (likely) |
| fin | 313.6 | 2896 | node-lens → node-lens | 0 | either | blend end write (RegionNodeStage.ts:254, t>=seconds) + lateUpdate follow (:895) same frame (likely) |
| fin | 383.3 | 3611 | world.setCamera (JUMP 58 m = seam) → world.setCamera | 0 | either | sky→lake ride start pose written twice (SkyLakeContinuous / RegionJourneyAdapter start) |
All 19 pairs: 2nd pose ≤ 5 mm / ≤ 0.04° / ≤ 0.02° fov from the 1st (17 identical). No real competing lens in any row.

## Fix (camera-owned, one place): CameraPose.ts applyCameraPose (THE single writer)
A 2nd write in the same engine frame (cc.director.getTotalFrames) on the same camera that matches the 1st within 1 cm / ~0.5° / 0.05° fov is merged (not re-applied, not traced). A really different 2nd pose is still written and still shows MULTI (no masking). No frame clock (tests, editor) = old behaviour.
Proposed root fixes for GGbot (optional, merge already makes them single-write): RegionJourneyCore.ts:264 skip journeyCamera write when :258 onFrame already wrote this frame; RegionBoardLanding.ts:161/133 skip landing's first write when gap==0.

## Our camera write points (all through applyCameraPose)
- RegionNodeStage.writePose → applyCameraPose('region.node-lens') (RegionNodeStage.ts:146). final-cam adds: 01 diff hunk `this.writePose(this.skyFinalePose(),false)` (finale start, diff line 86), `else if(FollowWalk&&skycity&&skyRail) this.writePose(this.skyRail(),false)` (diff line 105, an else-if branch of lateUpdate: exclusive with orbit/follow), skyJoin → blendPath → writePose.
- SkyRunLens.ts / SkyFinaleRail.ts / SkyWalkShot S4>S6 follow: pure pose functions, no writes.
- 02 diff: `world.setCamera(b1Hold)` tag BalloonTransit:B1-hold (before-draw, single writer). 03 diff: `if(writeCam){camTag('BalloonTransit:flight');world.setCamera(pose);}` (guarded as before).

## Gates
- cam-onewriter-19bd (suite): replays the 19 Mac pairs through the real applyCameraPose: before 12/7 multi frames, after 0/0; real conflict still written; next frame writes.
- lens-clearance-gate.cjs --trace <console.log>: every camTrace writer judged with the same RULE (S≥0.5, B≥0.5, H≥0.5, G 1.5 travel / 1.1 standing; J stays with check_camera_jumps --register). --must-fail-writers: a sample 0.2 m above the skycity floor labelled as each of 17 writers must be caught (suite: lens-clearance-all-writers). PASS.
- 19bd812a finstart trace judged (old code, not final-cam): FAIL — world.setCamera 4 samples (t 337.9 s, 0.23 m to env_sky_static_palette, sky→lake start) and region.node-lens 2 (t 312.6 s, 0.17 m above env_sky_ruins). SkyWalkShot min 1.41 m, B5/board 1.83 m. Needs a Mac camTrace of the final-cam+onewriter build.

## Root fixes (one writer per frame at the source; the 04 merge stays as a guard)
Order: 01–03 final-cam, 04 CameraPose merge (committed), 05–08 GGbot, 09 CameraPose track start (committed). All 9 apply clean in order on 18965329.
| diff | rows fixed | change |
|---|---|---|
| 05 RegionJourneyCore | 1506/1502 (onFrame+walk), 1531/1527 (LiveHandoff ×2), 2463 (B5→arrival), 888/876 + 3611 (ride start re-write, likely) | observe(): walk write only if onFrame did not write (:258/:264); ride end no longer re-writes this.camera after unpatch (:335); walkContinuous writes the live lens only when it could not be read fresh (:378) |
| 06 RegionBoardLanding | 2757 | regionLandingToBoard exact branch: gap 0 (handoff's :161 write is on screen) = no write |
| 07 WorldFlowComponent | 145/152 | setCamera adapter: same stable Pose object with no camera write since = no write (boot restore ×2, WorldFlowCore:321/329/334) |
| 08 RegionNodeStage | 2896 (+2800 likely) | lateUpdate anim tail (:1251): the end pose is written once by done(), not by sample(seconds) AND done() |
| 09 CameraPose (ours) | 146/262, 245/339, 500 | createCameraTrack: the run()-synchronous first tick (same frame as the hold / previous track end) writes nothing; the track starts next frame |
Not proven by source (no CALLER stacks): 2800 node-lens (RegionNodeStage :1059 sync view + openExplore) and the exact 3611 writer — a Mac run with camTraceStacks=1 will name them; the merge guards them meanwhile.
None of these is in WorldIntegrationBoot.ts / ScreenCover.ts (the reviewed-controller-change file is WorldIntegrationBoot.ts).
Gate cam-onewriter-19bd source mode (merge off, real source paths): 19bd812a = 8 doubles over 7 paths FAIL; this set = 0 PASS. Replay mode (merge guard) unchanged: 12/7 → 0/0.
Size (05–09, comment-stripped JS): +252 B raw / +82 B gz. Whole camera set vs d3b8e5e4: +8531 raw / +3445 gz.
