# b15 balloon: getting out of the basket, candidate 1 (trial)

**Status: delivered, but it does NOT pass.** The arms, torso and legs go through the basket rim. Details below. Production files were not touched, and nothing was pushed.

## Source and licence
- **Clip:** CMU Graphics Lab Motion Capture Database, subject 143, trial **143_16 "Walk And Step Over"**.
  - It was fetched as BVH from the GitHub mirror `una-dinosauria/cmu-mocap` (`data/143/143_16.bvh`), because mocap.cs.cmu.edu timed out (HTTP 000).
  - **Licence:** CMU states that the data is free to use for any purpose, including commercial, and may not be resold as data. Crediting "mocap.cs.cmu.edu" is requested but not required.
  - The subject's gender and build are not documented.
- **Why this clip:** I surveyed 14 trials (`survey.py`) for toe lift / hip height. Required is about 1.0, because the rim is 1.03 and her hips are at 1.058.

  | Trial | Toe lift / hip height |
  |---|---|
  | 143_16 | 0.86 / 0.92 (highest) |
  | 141_09 | 0.77 |
  | 41_07 | 0.84 (stepstool, jump) |
  | 113_22 | 0.57 |
  | 111_29 | 0.44 |

  No flat-ground CMU step-over reaches the rim height.
- **Segments used** (no hand keys):
  1. production `walk_start` f0–20, with the .R foot planted and root motion derived from it;
  2. a 6-frame crossfade;
  3. CMU 143_16 from src 0.50 s (her right foot planted at the wall) to 1.76 s (landing step), slowed ×1.4;
  4. a 6-frame crossfade;
  5. production `walk_stop_bodyL` f6–44, then 4 settle frames.
- **End:** the last frame is exactly `walk_start` f0, which equals `idle` f0 (max diff 5e-7). The ending root offset is applied in hips world translation.

## Basket (measured: transport_balloon.glb, sha ba5a7578…)
- **Shape:** square, low-poly basket.
  - Inner floor node `basket_floor` / `stand_point` at z 0.10.
  - Half-extent about 0.70 at the floor and 0.84 at mid height.
  - **Rim top z ≈ 1.03** (half-extent 0.79–0.80), with padding to 1.12.
  - Strap band out to 0.936 at z 0.68.
- **Wall:** a single shell with no inner/outer pair, so I assumed a thin wall of about 0.05.
- **Assumption:** her feet stand at z 0, which matches b11 (her feet are at the basket origin). That makes the floor = ground and the rim 1.03 above her soles. If she actually stands on the 0.10 mesh floor, the rim is 0.93 above her soles.
- **Exit direction:** assumed through the −Y wall (yaw 0, facing the flight heading). The b14 branch was unavailable, so this is not confirmed.
- **Start position** (because the mocap stride is fixed): she starts at **0.35 m behind and 0.11 m to the side of stand_point**, inside the basket. The rider idle would need that offset, or a short shuffle.

## Result (30 fps, 119 frames = 3.93 s)
Root motion: forward from −0.35 to +2.74 m, i.e. she ends about 1.9 m beyond the rim. Hip height 0.93–1.09 m. Curves are in `qa.json` (`root_fwd`, `root_h`).

**Foot slide** on planted soles (<12 mm above ground), in mm per frame:

| Segment | Median | Max | Notes |
|---|---|---|---|
| mocap, with foot-lock IK | 4.1 | 15 | |
| crossfade in | 11 | 40 | |
| crossfade out | 7.6 | 10 | |
| walk_start | | 33 | at the .L touch-down f18 |
| walk_stop | 1.6 | 19 | |

Ground penetration: at most 11.7 mm below ground (in a crossfade).

**Knees:**
- The mocap stance knee goes near or fully straight: min 0°, because the CMU knee is clamped. At least 1.6° is kept wherever the foot-lock IK runs.
- Fastest knee change: 32°/frame on the lead leg at the high lift (f24), and 22.5°/frame at the trail toe-off (f46). That is fast; check the mp4.

**Basket intersections:** 23 of 119 frames (f30–53) have body×basket triangle overlaps.
- feet/shins at the lead lift (f30–32) and the trail crossing (f48–53);
- thigh lying on or through the rim (f34–49);
- **torso, upper arm, forearm and hands into the rim at f40–46.** She leans onto the rim: the hand is at 0 mm, i.e. touching or slightly inside. This **violates "hands may touch but must not penetrate"**.
- Max sole height: lead leg 0.99 and trail leg 0.87, both below the 1.03 rim. **The trail foot goes through the wall, not over it.**

**Cloth:**
- Dress×basket in 26 frames (up to 629 pairs).
- Apron×basket in 17 frames.
- Skirt×legs in 56 frames (up to 549 pairs; it is 0 in the walk segments).

**Cloth help needed from 角色建模bot:** the skirt bones are held at idle/walk values, so during a hip-high leg-over:
- the thighs come out through the front/side of the dress;
- the hem must ride up over the rim (collide or drape against a rim proxy);
- a front/side skirt bone must follow the lifted thigh (side split or more flare).

None of this can come from the arms.

## Verdict
**What is natural:** the walk to the wall, the lead knee pull-up, the trail-leg lift behind, the landing and the walk_stop.

**What fails:**
1. The flat-ground mocap obstacle is lower than a hip-high rim. Clearing it would need more lift than any free mocap I found.
2. There is visible penetration (legs, torso and hands at the rim).
3. The 1.9 m run-out is longer than needed.

**Options, for the user to choose:**
- (a) A low step inside the basket (a box or foothole about 0.3–0.45 m, as real balloon baskets have). Then a CMU stepstool clip (40_06–09 / 41_07 "climb, step over stepstool") fits naturally: step up, sit or straddle the rim, step down.
- (b) Lower the rim, or raise her on the 0.10 floor, which gives a rim 0.93 above her soles. This still leaves the trail foot about 6 cm short.
- (c) A higher-lift mocap source: a "climb over fence" clip from a library that needs a login, which I avoided.

I did **not** add hand-authored hip-flex layers, because the brief rules out hand-keying.

## Tested / untested
**Tested** (headless Blender 4.5.3 on the A1 v4 final GLB with the transport_balloon basket):
- per-frame slide, knee angles, BVH overlap counts and hand distance;
- side and game-like renders (I viewed the contact sheets).

**Untested:**
- in the game (it is not wired into CharacterMotion and no GLB was exported);
- the real in-game camera (the "game" render is an approximate 3/4 high-back view);
- the exit side;
- cloth.

## Files
| File | Contents |
|---|---|
| `getout_cand1_side.mp4` | side view, basket as wireframe |
| `getout_cand1_game.mp4` | game-like view |
| `sheet_side.png` | contact sheet, every 6 frames |
| `sheet_side_rim_closeup.png` | rim close-up, f26–54 |
| `sheet_game.png` | game-like contact sheet |
| `qa.json` | per-frame numbers |
| `retarget.py` | the full pipeline (`RENDER=0` for QA only) |
| `survey.py`, `tl.py`, `basket.py`, `rig.py`, `ws.py` | probes |
| `src/*.bvh` | CMU trials |
| `getout_cand1.blend` | baked action `balloon_getout`, scene with basket |
