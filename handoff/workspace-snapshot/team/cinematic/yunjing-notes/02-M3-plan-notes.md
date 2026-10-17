# M3 planning notes (recorded 2026-10-09 17:16 CT; not started — M1 v2 first)

Source: team/ggbot/outbox-to-dot/REGION-PAN-CAMERA-DESIGN-0007-v1.1.md (sha256 940da140734969048ef65151912fc1848370040e02042e8c016f4ca40179fa52, verified)

- Every island return entry (exit end, result return, cancel, cold start, skip) lands on ONE pose, regionPan=0:
  character at exit_path_17 = game (-2.1135, 0, 5.2814) with a fixed yaw (we choose it; suggestion: slightly turned toward the camera).
- island_camera_pose.json adds:
  - characterYawDeg;
  - projected character bbox (with hat 1.73 m, width ~0.6 m) at aspect 0.46 AND 0.75;
  - the rule: |x| <= 0.7, -0.85 <= y <= 0.75 NDC; vFOV 45°; camera >= ~3 m from the character;
  - an occlusion check against island objects.
- The exit cutscene's last-frame rootEnd must equal exit_path_17 + characterYawDeg (<1 mm, <0.1°). The cine_open_safe_end pose moves there too.
- Bug context: team/oi/oi0004/evidence/character-interim/wechat-result-return-island.png. With the current 2.6 m camera the character is half cut off at the right edge.
  0007 interim proposal: position [-5.796, 3.323, 9.352], target [-2.114, 0.9, 5.281].
- Team-lead decision (17:16):
  - The RESTING island pose must keep the girl fully in frame and recognizable at aspect 0.46.
  - The reference image's high whole-island overview is done only DURING the exit camera pull-out (a few seconds), which then settles into the closer resting pose.
  - Deliver both options side by side (renders + projected bbox numbers + readability, e.g. character pixel height at 0.46), and report the tradeoff.

## Oi review of 0007 (relayed 17:24 CT)
- island_camera_pose.json uses EXACTLY 0006's CameraPose format:
  - required: position (m), quaternion rotation, fovVerticalDeg;
  - optional: target (for readability), characterYawDeg, exit_path_17 position.
- The island pose must be verified with ALL of the following (bbox-in-frame alone is NOT enough):
  - renders at the actual camera pose, FOV and viewport, with the HUD safe areas drawn, at aspect 0.46 (narrow) and 0.75 (wide);
  - a projection log;
  - an occlusion check (the character is not hidden by scene geometry);
  - a same-version check that exit_path_17 + characterYawDeg == the exit clip's rootEnd.

## Final framing constraint (relayed 17:28 CT)
- The island home nav buttons move to a bottom strip covering about the bottom 25% of the screen (above the safe area).
- The character bbox must be entirely ABOVE NDC y = -0.5 at aspect 0.46 AND 0.75, roughly centered horizontally. Engineering's frameCheck lower bound = -0.5.
- The pose goes into RegionCameraData.ts slot `yunjing-final`:
  - CameraPose = position (m), quaternion, fovVerticalDeg;
  - interpolation: position linear, quaternion slerp, FOV linear.
- Ref: team/ggbot/outbox-to-dot/20261009T2227Z-grokbot2-REGION-PAN-CAMERA-0007-v1.2.zip §9 (read at M3 start; verify SHA).

## Camera bake constraint (relayed 17:38 CT) — applies to every baked cine_camera frame (M1 camera pass, M2, M3)
- Runtime validateCameraPose rejects any pose whose camera right-axis Y component exceeds 0.001, so roll must be ~0 (level horizon).
- Build the rotation PER FRAME as a look-at from position + target with up = +Y (game).
  Do NOT slerp raw quaternions between keys: GGbot 0007 v1.2 was rejected because slerp produced roll up to 0.0166 mid-path.
- The camera sweep report must add three per-frame checks:
  - roll: |right.y| < 0.001;
  - unit quaternion: | |q| - 1 | small;
  - position continuity: per-frame step and velocity jumps.

## Island pose format, FINAL (0007 v1.3, relayed 17:41 CT) — supersedes the 17:24 and 17:28 format notes
- `yunjing-final` / island_camera_pose.json pose entry = position + target + fovVerticalDeg ONLY.
  - NO rotation field. A pose with rotation, or without target, is rejected at load.
  - Runtime derives rotation via lookAt with up = +Y.
- characterYawDeg, exit_path_17 and the projection/occlusion results go in separate metadata fields or files, outside the pose entry.
- The baked cine_camera node animation in the GLB is unaffected (still per-frame look-at with up = +Y and the roll check).

## 18:13 CT 决定（Grok Bot / GGbot 0006 v1.3）
- 身体×椅背验收以真实椅背网格为准；col_int_chair_back 代理盒不算过场穿模验收。
- 转身保持左转 111.76°（左脚先迈）。撑膝起身不改坐姿手位。
- pass2c 会按座高 0.38 m、大腿下斜重做 sit_corrective，并处理起身过程裙子；脚整体抬 0.2 mm。
- 0006 v1.3：回家跳过校验点运行时读 cine_open_stand.timing.json 的 rootStart；回家最后一段 rootEnd 必须与它相差 ≤1 mm，否则整段被拒。
- rootStart/rootEnd 必须写世界坐标，并注明坐标系（与 exit_path_17 同一套，游戏/Cocos 世界坐标）。
- v2 timing.json 保留每一步落地、起身事件帧（Voice Bot 直接据此重新生成 sfx_cine_open_stand / sfx_cine_open_turn）。
