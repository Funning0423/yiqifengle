# Hard-cut register (运镜bot) — format
`hard-cut-register.json` is a JSON **list** read by `ui-audit/tools/check_camera_jumps.py --register`. Each entry describes one designed cut
(id, scene, kind, trigger, lens_before / lens_after, frame_tol) and carries the matching keys the script understands:
- `{"t": s, "tol": s}` — state-clock seconds of that run (the script's `t` column); only meaningful for the `run` named in the entry;
- `{"writer": owner}` — matches any jump whose CHANGE<- owner (or writer) is `owner` (use only for owners whose every switch is a designed cut).
Entries with neither key (HC-04…06) are documentation of designed cuts not present in full7 m2; add `t`/`tol` per run when a trace shows them.

## full7 m2 f3918 (105.6 m / 104.3°) — finding
Not a logging-frame error and not the skyframe class. Every [QF_CAM_TRACE] line is written by applyCameraPose (the single writer), which logs the WORLD pose it just set (setWorldPosition/Rotation). f3918 is the designed flight SEAM (BalloonFlight SEAM_T 11.4 s, 100 % cloud): the transit content and camera are re-rooted by seam.worldJump in one frame, camera-relative continuous, so the picture does not change. Δyaw 104.33° = 360 − 255.747 (worldJump yaw). The translation implied by f3917→f3918 is (−22.64, −47.30, 83.28) vs the JSON worldJump (−49.53, −48.13, 75.93): the 27.9 m residual equals Ry(255.747)·(meadow root difference ≈ 28.5 m in z) — m2 ran with the bridge-placed meadow while seam.meadowRootWorld is the sail root. The pre-seam lens follows the live meadow and the post-seam keys are world keys, so the picture is unaffected. Still present on d3b8e5e4 (⊇ 19bd812a): same SEAM_T / postSeamFrame code. No runtime change was made (0 B).
The script counts any jump without CHANGE<- or a design event as 'unexpected' even when it is registered. Proposed 1-line patch: check_camera_jumps-registered-unexpected.diff (run: check_camera_jumps-full7-m2-run.txt).
