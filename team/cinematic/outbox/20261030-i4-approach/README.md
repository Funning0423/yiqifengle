# 运镜bot b21 — island I3>I4 on GGbot's E-waypoint route

Grok Bot decision (a): `islandEntryPan` (L04, already in ggbot/b20-walk-merge 9cfcf129) keeps owning I3>I4. Plan B (`IslandApproachLens`) is a
fallback only. Base for every diff below: 9cfcf129 (l04-lens-r2 diffs are already applied there and are dropped).

GGbot-owned files:
1. `NodeWalker-island-i3-i4-E-route.diff` — adds `island:I3>I4` to WAYPOINT_ROUTES (GGbot E via, 8.018 m, 1 segment, so the entry pan stays wired).
2. `RNS-island-i4-approach.diff` — RegionNodeStage: B is built only when no entry pan / departure lens exists (`!ent&&!dep`), and fills the
   same single `skyRail` slot → never writes alongside the entry pan.
3. `meta-allowlist-IslandApproachLens.diff` — adds exactly one entry (IslandApproachLens.ts.meta).

Gates: `island-stage04-lens-e` (entry pan on the E route; island-stage04-lens itself covers the route once WAYPOINT_ROUTES is wired),
`island-i4-approach` (B fallback).
