# L04 lens — 运镜bot (current: branch cine/b20-l04-lens, base 7eecdca8 scene/b20-island-walk-fixes)

Commits:
- c26400be: camera work carried over from 8b260d13
- d26b344b: hero-axis exit and skinned-palm gate

The old branch cine/b20-meadow-nodelens-ease (04259711 / 8b260d13) is left untouched and superseded.

## Skinned palms (box, no Mac)
occlusion/skin-island-palms.py applies rest-pose LBS to the room GLB palms (lean_01, tall_01, young_01, rear_window). The young_01 trunk comes out at x2.6–3.5, z2.25–3.05, matching 场景设计部. The gate now uses the skinned triangles. Animation/sway is not modelled (rest pose).

## Exit (04→05 departure)
- Old follow@I6 (1.47,3.22,2.94): 1.62 m from palm_young_01, and 1.38 m after the palm move. ✗ ≥3 m.
- P1 D_fix_P1_follow_rear (9.478,3.512,-1.812): 3.27 m clear, but 15.6 m from I6, wrong side. ✗
- P2 D_fix_P2_pushin_side (0.702,3.512,12.035): 1.51 m from beach_palm_tall. ✗
- Chosen: hero-axis end (-3.053,3.019,15.096), on the v2.2 hero/push-in axis (az −15° from I6, 6 m, +3.2 m, over sea).
  - 4.62 m from geometry.
  - She walks toward the lens with the lighthouse behind her, as in the hero shot.
  - The path is a straight dolly from the push-in end with an 8 m bow, which keeps beach_palm_tall off her.

## Gate (skinned)
- 7eecdca8 legacy: FAIL 168 (yaw 546°/s, 162 m/s, 8.17 s).
- Fix: PASS. Same result for T1 / T2 and with or without PALM_MOVE.
- Worst of 7 screens, 30 fps, T1: yaw 14.1, pitch 3.6, p99 42, 5.61 m/s, step 0.187, fov 0.096, solids ≥3, hidden 0.37 s (beach_palm_tall), margin ≥0.40, capsule 0, total 7.97 s.
- T2: yaw 16.6, p99 50, hidden 0.33, margin 0.27.

## Totals
- Departure: 8.174 s (0.6 blend + 7.574 walk) → 7.97 s (0.4 pre + 7.574 walk; the lens lands 0.2 s before she stops).
- Entry: 0.6 + 4.52 s → 4.52 s.

## Entry (I3→I4) — open
Not gated: face/chest is hidden 0.6 s on all screens, which is >0.5 ✗. env_prop_palm_lean_01 accounts for ~0.4 s and beach_palm_short for ~0.2 s. Margin is −0.14 on 3 tall screens.

The palm_young_01 move makes no difference to either camera path with skinned data, since young_01 is not a blocker. Its only effect is the I6 follow clearance, which the hero end makes moot. T2 is a drop-in (env PUSHIN=T2) and changes nothing on entry.

## Apply (GGbot)
1. RNS-island-stage04-lens.diff (unchanged, applies on 7eecdca8)
2. meta-allowlist-IslandStageLens.diff (needs Grok Bot)

Then remove the KNOWN_DEFECT entry.

## Other
WorldNativeComposition.ts:385 (sailqa) still hardcodes the old I4.

Strips are NOT_ENGINE rasters, and the strip renderer uses the unskinned palms.

---
# Stage-04 island lens (entry + departure) — 运镜bot

Branch cine/b20-meadow-nodelens-ease (from 96dfbd33). Route: cherry-pick 04259711 of c651ba8c (场景设计部), with no void chain.

## Root cause
The old walk was clipped with a fade (DIRECT_MAX_M 9.6). The 0.6 s board→follow blend made a 60.8 m / 171° whip.

## Design (plan E, IslandStageLens.ts)
- Departure: a tangent line plus an R 8 m arc round I6 on the +x side, Chaikin ×4, with a trapezoid arc-length clock. It aims at her smoothed position and ends exactly on the follow pose at I6.
- Entry: position held at the push-in end; aim eases onto her over 0.6 s. The board blend is dropped.

## Gate (tools/journey-integration/test-island-stage04-lens.cjs)
- 96dfbd33 plus route: FAIL (168–175 violations).
- With the fix: PASS, fail=0, on 7 screens at 60/30 fps.
- Departure worst case (390x844 at 30 fps): yaw 74.4°/s, pitch 26.6°/s, accel p99 178°/s², 7.44 m/s, step 0.248 m, fov 0.096°/frame, ground 3.17 m, solids 1.32 m, hidden 0.13 s, margin 0.10, capsule 0, total 7.97 s.

## Totals
- Departure: 7.52 s before (0.6 s blend + 0.52 s fade = the 1.12 s non-walk part) → 7.97 s after (0.4 s pre + 7.574 s walk).
- Entry: 0.6 + 4.52 s before → 4.52 s after.

## 场景设计部 poses
| pose | result |
|---|---|
| D_fix_P1_follow_rear (line) | yaw 107°/s ✗, hidden 2.1 s ✗ |
| D_fix_P2_pushin_side (line) | 0.43 s out of frame, hidden 1.97 s ✗ |
| D_fix_P1_follow_rear (arc) | 8.22 m/s ✗ |
| D_fix_P2_pushin_side (arc) | 10.7 m/s, 0.03 m from a palm ✗ |
| E-arc (chosen) | all limits pass |

A_pushInEnd: no head clip in the engine GLB. The head line clears the palms by 0.65 m. She is about 4.8% of screen height, margin ≥0.40. No change.

## Bytes
- IslandStageLens.ts: 5944 B source, 5382 B JS, 1950 B gzip.
- RNS delta: +911 B source, +938 B JS.

## Apply order (GGbot)
1. RNS-island-stage04-lens.diff
2. meta-allowlist-IslandStageLens.diff (needs Grok Bot review)

Then remove the KNOWN_DEFECT entry.

## Suite with diff 1
EXIT 1, 310 passed. Fails: meta-allowlist only (fixed by diff 2). navigation-guard BLOCKED_BROWSER.

## Open items
- Entry face/chest is hidden about 1.0 s by palm_young_01 at 2.0–2.75 s (reported, not gated). Needs 场景设计部 or Grok Bot.
- WorldNativeComposition.ts:385 (sailqa) still hardcodes the old I4.
