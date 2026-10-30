# 运镜bot b21 — island I3>I4 approach lens (plan B) on GGbot's E-waypoint route

GGbot-owned files, apply in order (after 20261030-l04-lens-r2):
1. `NodeWalker-island-i3-i4-E-route.diff` — adds `island:I3>I4` to WAYPOINT_ROUTES (GGbot E via, 8.018 m).
2. `RNS-island-i4-approach.diff` — RegionNodeStage: when that route is wired, FollowWalk on island I3>I4 writes `approachClock(islandApproachLens(...))` (still the one writer; LensGuard follow otherwise).

Module: `region/IslandApproachLens.ts` (ISLAND_APPROACH takeS 4.0). Gate: `test-island-i4-approach.cjs` (face ≤0.2 s, motion, handover C1/C2 continuity, 7 screens × 60/30 fps).

Caveat: in the reward flow, I3>I4 begins with `islandEntryPan` from the stage board lens (~45 m away). The approach lens applies only when the follow lens owns the walk (first write = the live lens read at FollowWalk start).
