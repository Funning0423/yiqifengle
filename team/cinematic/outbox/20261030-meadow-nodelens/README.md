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
