# 运镜bot HANDOFF (2026-10-22, America/New_York)

Paused under the checkpoint rule. Everything is committed locally and nothing has been pushed by me (push result is in the bundles README).

## Branches and SHAs
| branch | head | base for bundle | worktree |
|---|---|---|---|
| cine/r5-b18-board-compose | (this commit; previous head c2bc4eb9) | 55368056 (gbt/r5-integrated-b15) | /workspace/yiqifengle/work/cine-r5-b18-board |
| cine/r5-b17-home-fade | (this commit; previous head 7c64fa30) | 7b9ba1d6 | /workspace/yiqifengle/work/cine-r5-b15-handover |

b18 history:
- 08e56f7e: mainline-1[3-6] lakeside mapping, snow-pass draft
- e925b4e5: B′ lens, landing solve, skycity board dir
- 48548a01: B″ lens, test contracts
- c2bc4eb9: QA-only `qaTools=N` (guarded by MINIGAME, pure test)
- next commit: endpoint doc v4 + this file

## b17 notes
- Merged up to 9bab39c9.
- 7c64fa30 (basket +0.03 m) is superseded by FX 333f0b15 (floor board in the model).
- OPEN: 0.40 m landing pose pop at touchdown. This is animation/model work, not camera work, and needs to be assigned.
- Snow-pass draft: docs/r5/cine/snow_pass_transition_draft.md (b18 branch).

## b18 plan (approved by 角色动画bot in Blender at 30 fps): path v4
Spec is docs/r5/cine/b18_endpoint_v2.md (v4 section).
- End root [3.2531, 0.5714, 25.0904], yaw −58°, reached by walking.
- Speed 0.8 m/s, stop on walk_stop_bodyL.
- Total 6.3563 m from true P0 [9.1105, ·, 25.6722]; stop stretch 1.000.
- Lowest foot z 24.354; max foot drift 10.5 mm with turn foot-lock.

| # | segment | ends at (lake-local x,z) | heading | centre | length |
|---|---|---|---|---|---|
| S0 | straight from step-down [8.7525,25.7099] | [7.9569,25.7935] | −84° | – | 0.8000 |
| A1 | arc R 2, turning right | [6.4423,25.3196] | −84° → −130.75° | [7.7478,23.8045] | 1.6319 |
| S1 | straight | [6.0635,24.9932] | −130.75° | – | 0.5000 |
| A2 | arc R 2, turning left | [3.6982,24.8123] | −130.75° → −58° | [4.7580,26.5084] | 2.5395 |
| S2 | stop straight | [3.2531,25.0904] | −58° | – | 0.5249 |

Cameras (portrait fov 50):
- Main, h/w ≥ 2.0: 7 m P [1.5,7,34.5] → T [1,−0.5,0]. Fallback 6 m P [2,6,33] → T [1,−0.5,2].
- Short, h/w < 2.0: P [2.5,6.5,34] → T [−3,−0.5,0].
- Orbit pitch about 28–29° in all cases (limit 52°).

## Progress
DONE
- qaTools=3 (c2bc4eb9). Suite 146/147, only navigation-guard BLOCKED_BROWSER. ES5 passes.
- v4 path design and endpoint doc.
- Real renders with 3 tools for 6 sizes at the v4 end (M6, M7 at 390x844, S2). Her boxes are in the doc.
- In-engine ground y, from a ray onto LK_terrain.

NOT DONE (no code written yet)
1. Landing walk. In LakesideBalloon.lakesideBalloonMooring:
   - build the walk as [start, stepPt, v4 segments sampled about every 5° on the arcs], from lake-local through toWorld;
   - replace roundWalk([stepPt,appr,shoreG]);
   - check that toWorld([8.7525,·,25.7099]) equals the computed stepPt.
2. Fix ① terrain follow:
   - In RegionJourneyAdapter's stepping branch, root y = P0.y + r[1], which ends 0.572. Blend this onto terrain by drop fraction r[1]/(−0.03).
   - Walk path y comes from a sampled height profile. Source: previews/角色动画bot/lakeside-path-v4/terrain_samples.json (s from true P0 → root_t, 0.5654–0.5761).
   - Check that CharacterMotion follows path y.
3. Fix ② foot-lock recovery:
   - footLockStep exists (LakesideBalloon.ts) and the adapter applies it.
   - BUG 1: it relaxes exponentially whenever yaw is steady, including during stance, so the stance foot slides.
   - BUG 2: the adapter uses a.lastFoot, which is never null, so it never knows a swing phase.
   - Planned: swing = motionT − lastFootEmit.t > about 0.12 s (double support). Recover only in swing, linearly at about 15–20 mm/s.
   - Offline replay on their sim_lock_frames gives max 8–10 mm and end 0.0 mm with HALF_W 0.09. Their own model peaks at 30.5 mm; the target is end error ≤ 2 mm.
4. Cameras:
   - LakesideCameraLayout.board.portrait becomes main and short, split at h/w 2.0.
   - Update lakesideLandingLocal, lakesideAlignedLookAt and lakesideScreenLanding (the walkLocal end must become the v4 end) so landing → board ends exactly on the camera for each screen.
5. Tests:
   - Update the camera, landing-hook, hint/tool-overlap, reveal-orbit and occlusion tests to the new contract.
   - Add tests: terrain penetration ≤ about 2 mm; foot-lock end error ≤ 2 mm; recovery only during swing.
   - Run the suite and ES5.
6. Real renders at 390x844, 360x780, 414x896, 320x568, 390x520 and 375x667 with qaTools=3, plus a landing → board strip.
7. Hand back to 角色动画bot for a 30 fps recheck.

UNTESTED
- Everything in items 1–6 above.
- The 7 m camera at 360x780 and 414x896.
- The 6 m camera at 360x780 had only a 3 px horizontal gap.

## Decisions pending for Grok Bot
- Assign the b17 0.40 m landing pose pop (animation/model).
- Confirm the main camera, 7 m or 6 m.

## QA render tools (box, not committed)
- /tmp/b18/varg2.mjs: env EP, EY, VARS, GROUND.
  - A variant name starting with "ng" hides her.
  - It resizes to w+2,h+2 first to avoid stale frames.
- /tmp/b18/lk/web-test is the patched QA copy (qaTools patched into the built index.js).
- Fit tools: fitC.cjs (env E, SCR, Y), path4.py, lay.json.

## Previews (paths only)
/workspace/yiqifengle/previews/运镜bot/r5-b18-board-compose/:
- endpoint_v4_*_c2bc4eb9_qaTools3.png
- endpoint_v3_*
- lakeside_Bpp_heroine_48548a01.png
