# Coast board lens (D2 default) — 运镜bot cine/b20-coast-board-lens

Base 571b6af6 (GGbot PLAN's candidate; contains 96dfbd33). Scene r5d bb238126 (descendant of 8321f594), read via git show into /workspace/coast-r5d.
Engine projection: pure vertical fov (CAMERA_FIXED fovAxis vertical). Look line fixed (D2 quat), distance only.

| screen | D2 as proposed (board / her margin) | final dist m | pos | quat xyzw | fov | board margin | her margin | menu over face/cells | HUD band (advisory) | S7 v max m/s | step m/frame | yaw/pitch °/s | acc p99 | fov/frame | end = pose |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390x844 | FAIL (-0.0508 / 0.1851) | 23.306 | (-0.6, 19.948, 11.023) | (0, 0.851965, 0.523599, 0) | 50 | 0.08 | 0.2629 | no / 0 | ok | 6.96 | 0.116 | 56.8 | 40.3 | 0.0 | yes |
| 414x896 | FAIL (-0.0508 / 0.1851) | 23.307 | (-0.6, 19.9489, 11.0225) | (0, 0.851965, 0.523599, 0) | 50 | 0.08 | 0.2629 | no / 0 | ok | 6.96 | 0.116 | 56.8 | 40.3 | 0.0 | yes |
| 360x780 | FAIL (-0.0514 / 0.1851) | 23.332 | (-0.6, 19.9712, 11.0112) | (0, 0.851965, 0.523599, 0) | 50 | 0.08 | 0.2632 | no / 0 | ok | 6.96 | 0.116 | 56.8 | 40.3 | 0.0 | yes |
| 375x667 | FAIL (0.0473 / 0.1851) | 19.424 | (-0.6, 16.4846, 12.7764) | (0, 0.851965, 0.523599, 0) | 50 | 0.08 | 0.2089 | no / 0 | ok | 5.85 | 0.097 | 60.3 | 48.3 | 0.0 | yes |
| 320x568 | FAIL (0.0483 / 0.1851) | 19.387 | (-0.6, 16.4516, 12.7931) | (0, 0.851965, 0.523599, 0) | 50 | 0.08 | 0.2083 | no / 0 | over by [183.5, 407.4] vs [200.0, 402] | 5.84 | 0.097 | 60.3 | 48.4 | 0.0 | yes |
| 390x520 | PASS (0.1607 / 0.1851) | 18.1335 | (-0.6, 15.3333, 13.3593) | (0, 0.851965, 0.523599, 0) | 50 | 0.1607 | 0.1851 | no / 0 | over by [162.1, 381.7] vs [200.0, 354] | 5.5 | 0.092 | 62.0 | 52.4 | 0.0 | yes |
| 768x1024 | PASS (0.1607 / 0.1851) | 18.1335 | (-0.6, 15.3333, 13.3593) | (0, 0.851965, 0.523599, 0) | 50 | 0.1607 | 0.1851 | no / 0 | ok | 5.5 | 0.092 | 62.0 | 52.4 | 0.0 | yes |

Gate: tools/coast-board-lens/test_coast_board_lens.cjs (suite row coast-board-lens). Rebuild: python3 tools/coast-board-lens/scene_d2.py; tools/coast-transition-draft/run_v4.sh.
