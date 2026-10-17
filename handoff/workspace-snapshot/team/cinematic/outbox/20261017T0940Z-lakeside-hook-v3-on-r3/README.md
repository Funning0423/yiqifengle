# Lakeside hook v3 on r3: hard cut at the landing→board swap fixed (camera only)

Base: f3d3614 (integration/build05-next-20261017T0818Z-r3). Branch `cine/lakeside-hook-v3-on-r3` (local only, not pushed)
- c3cbf8932f1631692715397ff41c5facbe04442d: the enter-level cover holds the landed board pose (fix)
- a8ba19a301b1867d68fbe8a9ea9eaab8fc9d3570: swap-frame tests on 5 screens (HEAD, tree 1cf3346c2dea18f9433b03502a13fdca5ba9326f)
- Also on `cine/lakeside-enter-hold-r3` = c3cbf89. Bundle: lakeside-hook-v3-on-r3.bundle (f3d3614..a8ba19a); patches/ (git am).

## Root cause
On f3d3614 the lakeside landing→board hook already ended exactly on the board camera pose. After it, though,
`WorldFlowCore.enterLevel → playEnterCover → WorldFlowComponent.playEnterLevel → enterLevelLook()` ran the generic
island push-in (ENTER_LEVEL_SHOT_S = 0.78 s: a 2.6 m dolly along the view, FOV −6°) on Main Camera during `level-loading`.
At `level` the board's LakesideBackgroundCamera (priority 44, layer 1<<20, rig LakesideLiveScene under
ManagedNativeBoardHost) takes over at the pre-push pose. The result is a hard cut back: +6.0° FOV and 2.6 m back
(audit items 69–72). The audit's "different position" is partly a world-space comparison across two rigs: the journey copy
LakesideJourneyScene is yawed at L.root, and the board LakesideScenery is identity. Measured relative to the scenery, the only
jump was the push-in.

## Fix (camera only)
- WorldFlowComponent: one-shot `holdEnterLevel(on)`. When it is set, `playEnterLevel` runs the same 0.78 s cover (timing and token
  unchanged) without writing the camera, then clears itself.
- WorldNativeComposition: set only in the lakeside branch after the hook lands (`held=true; world?.holdEnterLevel?.(true)`),
  and cleared in `finally` (`if(held) world?.holdEnterLevel?.(false)`). Other regions and the failure path (`lakesideFallback`) are unchanged.

## Swap deltas (last frame before vs first frame after)
| screen | pre-fix f3d3614 (box, SwiftShader) | post-fix c3cbf89 real web build, Mac GPU, dpr 2 | test a8ba19a (goals 2..4) |
|---|---|---|---|
| 390x844 | +6.0° FOV, 2.6 m, 0° angle (rig-relative) | 0.000° / 0.000° FOV / 0.000 cm | ~1e-15° / 0 / ~9e-14 cm |
| 414x896 | same push-in + cut | 0 / 0 / 0 | PASS |
| 360x780 | same | 0 / 0 / 0 | PASS |
| 375x667 | same | 0 / 0 / 0 | PASS |
| 390x520 | same | 0 / 0 / 0 | PASS |
On every screen, each frame-to-frame step across the 20-frame window (10 before through 10 after) is 0 (swapdelta/*.json `window20`).
Hand-off: Main Camera (level-loading) → LakesideBackgroundCamera (level). Limits: ≤0.1° angle, ≤0.1° FOV, ≤1 cm.
The constraints are still met: ≤1.1 m clearance, hook ≤3° FOV / ≤2° angle, monotonic arrival, failure path unchanged
(test-lakeside-landing-hook 18/18 and lakeside-journey-wire PASS).

## Stutter
The camera is static across the swap, but the swap frame itself takes 38–57 ms on every screen (1–2 dropped frames at 60 Hz):
390x844 38.2 ms, 414x896 40.8, 390x520 38.8, 375x667 57.4, 360x780 41.7. That run was at ~33 ms/frame (30 fps) throughout.
This is a one-frame hitch from mounting the board, not a camera jump.

## Suite (a8ba19a, box)
74 total, 69 passed. Only the 5 known r3 failures remain: production-integrity, legacy-board-ui-pure, reward-background-return,
cloud-web-contract (FAIL), and navigation-guard (BLOCKED_BROWSER). See suite_a8ba19a.txt.

## Files
- strips/swap_strip20_<screen>.jpg: 20 frames rendered by the game (real build, Mac GPU, dpr 2), annotated with per-step deltas.
- swapdelta/swapdelta_<screen>.json (+ engine_dump_bg_camera_pose_<screen>.json raw dumps).
- background_camera_pose.json: engine LakesideBackgroundCamera for all 5 screens. Includes world pos, quaternion and Euler, vertical FOV,
  near/far, aspect, safe insets, scene/node path, Cocos Y-up right-handed conventions, and the Blender Z-up conversion
  (location (x,−z,y), q_bl = qX(+90°)·q_cc, sensor_fit VERTICAL, angle_y, clip, resolution). Position is the same on every screen
  (2.94478, 3.58, 31.16376); pitch and FOV vary with the screen.
- bgonly/: board background without UI per screen, and journey-end vs bg-only at 390x844 (geometry lines up).

## Non-camera differences at the swap (for GGbot/art, not changed)
The girl is missing from the board background. The cloud and gull exist only in the journey layer; the board shows mountains/sky instead.
Sky colour and water tint/haze differ.

## Meadow/skycity (report only, no hook there)
On f3d3614 both get the same push-in, then a designed cut: meadow +7.43° FOV / −6.0° pitch / 19.7° yaw; skycity +13° FOV / −27.3° pitch / 7.5° yaw.
