# 04→05 set-off ease (Grok Bot: hard cut not acceptable) — branch ggbot/d238881-oi-review, local only
Commit eadd9f1cc68d5874847484c7625611ee11891a12 tree 3af071abdfc169306df2b79680e358be6bd2d04d, parent 450f1f5 (series 0001–0005 in 20261016T191155Z-d238881-oi-review).
Approach: time/distance ease (blend 18 rejected: fails F7 right-side and O1 face/chest occlusion). journeyCamera, startBlendM 0 only:
over setOffEaseM 0.78 m (= 0.65 s at 1.2 m/s) position lerp, view-direction slerp and FOV 42→48, all smootherstep (zero vel/acc at both ends).
d >= 0.78 m: identical to d238881 (pinned 7 poses, 1e-5). 08→09 untouched.
Metrics (60 fps): before = 50.73 m / 132° / +6° FOV in one frame (3044 m/s, 7924 °/s spike);
after: max 2.42 m/frame (145 m/s peak), accel ≤ 687 m/s² (0.19 m/frame²), peak turn 383 °/s, FOV ≤ 0.29°/frame.
20°/s is NOT met inside the 0.65 s ease (infeasible: 132° needs ≥15 m; linear eases 4/8/12/16 m fail F1/F2, blend 18 fails F7/O1). Post-set-off ≤ 20°/s holds.
Visibility in the ease (0–0.4 m): she stays behind the palm strip as in the live island lens; reported as setOffEase exemptions, lens clearance still enforced.
Visual note: the ease sweeps low over the meadow hill (frames ~3–5 after set-off in compare.mp4). Geometry-only Workbench render of fixture triangles, red capsule = her; not a game capture.
Suite 33/38, same non-passes as baseline (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract FAIL; navigation-guard BLOCKED).
