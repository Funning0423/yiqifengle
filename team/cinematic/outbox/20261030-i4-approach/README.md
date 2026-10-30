# 运镜bot b21 — island I3>I4 approach lens (plan B) on GGbot's E-waypoint route

GGbot-owned files, apply in order (after 20261030-l04-lens-r2):
1. `NodeWalker-island-i3-i4-E-route.diff` — adds `island:I3>I4` to WAYPOINT_ROUTES (GGbot E via, 8.018 m).
2. `RNS-island-i4-approach.diff` (base: RNS after the l04-lens-r2 diff) — when `island:I3>I4` is wired and no entry pan / departure lens owns the walk, the island FollowWalk writer (existing skyRail slot, single writer) plays `approachClock(islandApproachLens(liveLens, walk, …))`.

Module: `region/IslandApproachLens.ts` (ISLAND_APPROACH takeS 4.0). Gate: `test-island-i4-approach.cjs` (face ≤0.2 s, motion, handover C1/C2 continuity, 7 screens × 60/30 fps).

Caveat: in the reward flow, I3>I4 begins with `islandEntryPan` from the stage board lens (~45 m away). The approach lens applies only when the follow lens owns the walk (first write = the live lens read at FollowWalk start).

Note: with l04-lens-r2 applied as-is, I3>I4 is still owned by `islandEntryPan`, so this lens stays dormant until the parent decides the entry pan yields to it (needs the follow to be live at walk start).
