# L04 island stage-04 lens r2 (运镜bot) — for GGbot

Branch cine/b20-l04-lens-r2, base e826fd33 (scene/b20-island-walk-fixes, I3 option E; contains the a1c4c07d skin-correct re-bake).

## Apply (GGbot files, not edited by 运镜bot)
1. `RNS-island-stage04-lens.diff` -> world-r2/RegionNodeStage.ts (applies cleanly on e826fd33). Island I3>I4 reward walk: board lens
   pans onto her (no 0.6 s blend); I4>I6 departure: live lens converges along her uncut walk onto the island v2.2 hero axis
   (no cover, no WindWipe, no hard cut). `this.skyRail` stays the single per-frame writer.
2. `meta-allowlist-IslandStageLens.diff` -> tools/build-guard/meta-allowlist.json (needs Grok Bot review per that file's rule).

Until (1) is merged, `island-stage04-lens` applies the diff to a temp copy of the live RegionNodeStage.ts and gates that
(`wired:"outbox-diff"`); once merged it reports `wired:true`. If the diff stops applying the gate falls back to the legacy path and FAILs.

## Note to GGbot
The stage-04 departure fix (方案 E) is in this diff. After you merge RNS-island-stage04-lens.diff, please remove the KNOWN_DEFECT entry
for the stage-04 departure whip (RegionNodeStage:273, 0.6 s blend over 60.8 m / 171°).

## Also on this branch (运镜bot files)
- WorldNativeComposition.ts sailqa stand: reads I4 from REGION_NODES (was hardcoded pre-r5 [4.5,0.231,-4.9]).
- IslandStageLens: endS 0.2 -> 1.0 (lens lands on the hero pose 1 s before she reaches I6; face/chest blocked by beach_palm_tall
  0.37 -> 0.27 s), hero height profile knob heroDropPow (=1, unchanged path).
- Gate tightened: face/chest hidden <= 0.3 s on entry and departure; entry margin gated (>= 0.08 from 0.2 s on, never drops back).
