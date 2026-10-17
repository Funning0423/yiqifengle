# m1v2-clipfix STATUS (运镜bot)
- 2026-10-17 06:20 EDT start. Base = m1v2-truesize (TRUESIZE ts2). Step 1: signed-depth measure on v2g (repro 80/45) and ts2.
- 18:2x render jobs launched (run_render.sh, resumable; frames /workspace/tmp-m1clip)
- 18:3x cloth jitter found in pass2c knots (apron visible pops up to 63 mm/f^2). trying contact-masked smoothing with checker-guarded alpha (fix_cloth.py, run_fix.sh f15b)

## v3 constrained-smooth (cs) — resumed 2026-10-17 06:57 EDT
Grok Bot decisions: constrained smoothing (temporal smooth + per-frame projection outside body/chair/dress, 1–2 mm margin, alternate to convergence),
apron×dress in the same solve, targets accel ≤~10 mm/f², 0 visible apron×dress @f37, no 4.5 recheck, chair proxy unchanged.
Work dir: cs/ (scripts+npz), outputs pipe/scene/cine_m1_anim_cs*.blend, probe/*_cs*.json, evidence/*_v3*.
Steps: [1] precompute skin affine + body/chair per frame -> cs/pre.npz  [2] solve -> cs/knots_csN.npz  [3] write blend  [4] measure/check/cloth/jitter  [5] render+video  [6] cleanup
- cs1 alternating projection: oscillated/diverged (abandoned). cs2 per-vertex QP (lam .05): accel dress 9.69 apron 13.36, but tri-level self/apron×dress overlaps appeared (probe/check_cs2_summary.txt). cs3 (lam .03): apron accel 19 (rejected).
- next: cs/solve3.py = per-vertex QP + tri-tri constraints (dress self, apron×dress, body×garment), block Gauss-Seidel.

## v3 status (2026-10-17 08:35 EDT): DONE — partial
cs2 constrained-smooth packaged: shimmer accel targets met for dress and visible pops; apron 13.4 at f5-7; FAILS zero-penetration/zero-overlap (dress self 624, apron×dress 530 / 29.4 mm, torso×dress 12.9 mm, legL×dress 2.1 mm). Recommend art-side cloth re-solve. Nothing committed/pushed. See README v3.

## v4 status (2026-10-17 08:52 EDT): DONE
SRC + apron-only f3-6 ease (`pipe/scene/cine_m1_anim_ease.blend`) is the candidate; cs2 not used. Triangle checks identical to SRC; apron f1-8 accel ≤3.1. Committed on local branch `cine/m1v2-src-apron-ease` (local repo in this folder; never pushed). PROBLEM_BRIEF.md written.
