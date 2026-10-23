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
DONE in code (this branch)
1. Landing walk. `lakesideBalloonMooring` builds [P0, computed step, v4 samples]. Arcs every ~5°, straights every ~0.25 m, lake-local through `toWorld`. Door / P0 / step stay on the fixed shore anchor `[1.2, .58, 24.5]` (the journey arrival node is the v4 stop, and using it as the heading swings the door about 7°). `toWorld([8.7525, ·, 25.7099])` matches the computed step within 1 mm. End `[3.2531, 0.5714, 25.0904]`, yaw −58°, 0.8 m/s, `walk_stop_bodyL` via the existing stop planner. Polyline length 6.356 m.
2. Terrain follow ①. Stepping y is `stepdownBlendedY` (drop = clamp(y_m / −0.03)). Walk y from the step on is an 11-knot profile (max error 0.32 mm vs the full ray samples). `groundY` stays 0.572 (board-relative lawn). `pointOnPath` keeps that y.
3. Foot-lock ②. Stance no longer decays. Swing is `motionT − lastFootEmit.t > 0.12 s` (`footLockSwing`); a missing emit is not a swing. Recovery is linear at 18 mm/s, and only then. Replay on `tools/lakeside/fixtures/sim_lock_frames.json`: peak 10.93 mm, end 0.0 mm, no steady-yaw slip. `lastFoot` still drives the pivot during swing.
4. Cameras. Main is the **7 m** lens when h/w ≥ 2.0; short lens otherwise. `lakesidePortraitBoard` feeds `lakesideLandingLocal`, `lakesideAlignedLookAt`, and `lakesideScreenLanding`. `walkLocal` ends at the v4 stop, so the arrival solve lands on that lens. Orbit pitch 28.9° / 28.1°, under 52°. Free look stays unlocked off the board. The 6 m lens is not shipped.
5. Tests updated: camera K1–K8, landing hook, hint/tool overlap, reveal orbit, qashot overlap (v4 leaves ~3.7 s / ~2.8 s, still overlapping). Added terrain ≤ 2 mm, foot-lock end ≤ 2 mm and swing-only recovery, camera split, orbit pitch, standup source order.

Landing standup wiring — **done, not a new path.** `RegionJourneyAdapter` on this line is the `gbt/r5-integrated-b15` sequence, not the `cine/r5-b17-home-fade` hard cut:
   - seat `(0.032, -0.1, -0.099)` + `seatYawDeg`
   - `sit_hold` → `playNamed('stand_up')` (1.2667 s, root rise 0.494 m, `standupRootK` lerps seat → P0)
   - then `cancelAndReset({kind:'standing', controllerRoot: P0})`, which is the idle crossfade (0.2 s) **after** stand_up
   The forbidden pop is a standing reset that **skips** `stand_up` and teleports to P0 (~0.40 m / ~128°). That cut is not on this line. Animation reference: `anim/b17-landing-standup` @ `97fc3243` (Funning0423/yiqifengle). Adapter wiring commits on the integrated line: `b8c6fd30`, `4b7f6f32`, `bebe76f3`.

NOT DONE
6. Real QA renders of this commit (390×844, 360×780, 414×896, 320×568, 390×520, 375×667, qaTools=3, plus a landing → board strip). The box tools are not in the repo (`/tmp/b18/varg2.mjs`, `/tmp/b18/lk/web-test`). Earlier renders in the endpoint doc are the c2bc4eb9 sheet (M6 / M7 / S2), not this head.
7. Hand back to 角色动画bot for a 30 fps recheck of path v4 on this wiring.

UNTESTED here
- In-engine QA renders (item 6). Needs the box harness.
- navigation-guard stays BLOCKED_BROWSER (no Chromium). Ignore that one only.

## Decisions locked
- Main portrait camera is 7 m. 6 m is not shipped.
- Landing pose pop is adapter wiring. This line already has the integrated-b15 standup. Do not replace it with a bare cut to P0. Animation content reference is `97fc3243`.

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
