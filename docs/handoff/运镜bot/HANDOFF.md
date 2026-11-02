# 运镜bot HANDOFF — skycity sea-landing fix
Date: 2026-11-02 02:07 EST (America/New_York)

## Branches / SHA
| branch | head (pre-push) | worktree |
|---|---|---|
| cine/skycity-sea-landing-fix | (this commit; was 606f434e @ 606f434e tip) | /workspace/yiqifengle/work/cine-skycity-sea-landing |

Base tip: `ggbot/b20-meadow-c-skycity-rt` @ `606f434e`. FX align data used as-is (env_skycity.glb == b3394140; anchors/S0_LOCAL match).

## Root cause
B5 exit stand was `TRANSITION_STAGING.skycity.s0New ≈ S0 rim` ([5.25,−0.084,40.6] local, ~14 m from court). Board handoff uses `skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center)`, so after the blend the player sees the character on/near soft cloudsea at the balloon rim with the island mass framed far away (“人站海上、岛在远”). Soft sea AABB y≈−40…+18 overlaps deck height; rim stand makes the misread worse. Not bridge_end; glb/placement/yaw already matched FX.

## Fix
1. `s0New` → `anchor_spawn_girl` [-1.40009, −0.07002, 32.59992]; `s0YawDeg` 151.7° (face court); mid waypoint `s1` [1.9, −0.077, 36.6].
2. B5 walk: stepDown → deckEdge → s1 → spawn_girl (~11.8 m, ~13.1 s @ 0.9 m/s). Basket touchdown **unchanged** (`S0_LOCAL` / `S0_GAME`).
3. `seg4.toPath` 7.5 → 15; `TRANSITION_RETIME.caps.meadowToSkycity` 50 → **60** (measured timeline 58.72 s).
4. `SKY_LAWN` += `env_sky_floor_seal` so arrival forces floor seal on (full8 night “没地” debt).

## Tests (box)
- `test-board-handoff.cjs` PASS (her = spawn)
- `test-region-landing-hook.cjs` PASS
- `test-transition-totals.cjs` PASS (cap 60)
- `test_chain_ggbot.cjs` ok
- `test_sky_resume_s6.cjs` PASS (S0DECK = spawn world)
- `test_lake_continuity.cjs` PASS
- `test_landing_move` / `test_basket_close`: need `DRACO3D` (not installed here); path arrays updated

## Not done / open
- Device / Funning visual retest of meadow→skycity land → board (expected: feet on court deck, island fills frame).
- Graph bake `S0` node still at old rim in `bake-region-nodes.cjs` (scene graph); runtime B5 end is spawn. Scene bot may want bake sync later.
- No WeChat upload (fail gate). b18/lakeside path v4 untouched.

## Push
Push: **403** to `Funning0423/yiqifengle` (denied). Bundle instead:
`docs/handoff/运镜bot/cine-skycity-sea-landing-fix.bundle` (from `606f434e..d8ff771a`).
