# m1v2 clip fix — legs × dress/apron/chair-back (运镜bot task, 2026-10-17)

Status: DONE (evidence only). NOTHING went into the game; this is a before/after for Funning to pick.

## Source versions
- BEFORE: m1v2 v2g (team/cinematic/work/m1v2/scene/cine_m1_anim.blend, pass2b character). This is where the
  "80 mm / 45 mm" figures come from (export/report/clipping_summary_v2g.txt): legL×apron 80.13 mm @f42,
  legL×dress 79.50 mm @f60, body×col_int_chair_back 45.24 mm @f32. Those were stale numbers from the pass2b base.
- AFTER: the same v2g animation (bones unchanged) rebuilt on the latest art delivery
  art/character/r5-fix-g2/pass2c SRC (R5G2_PASS2C_SRC_grokbot2_SOURCE.blend, sha256 96192d10…2e4c2e, matches art SHA256SUMS),
  with the per-frame correctives from its cine_open_stand_weights sidecar. Built in pipe/ -> pipe/scene/cine_m1_anim.blend.
  Built with Blender 5.2.2 (4.5 isn't on the box). Cross-check: the ts2 tri-pair counts are the same, and bones match within 0 mm / ≤0.39°.

## Results (signed mm, + = penetration; scripts/measure.py, probe/measure_{v2g,src}.json)
| pair | before (v2g) | after (pass2c SRC) |
|---|---|---|
| legs × dress, midsurface | full pass-through f0–75 (region hits the 120 mm cap); old 79.50 reproduced | −0.34 (clear, worst f14) |
| legs × dress, visible shell bound | 79.50 @f60 | +0.06 (hem graze, under the skirt, not visible) |
| legs × apron | 80.13 @f42 | −2.78 (shell −2.38), clear |
| legs × chair-back proxy | −87 (never inside) | −87.34 (never inside) |
| body × chair-back proxy | 45.24 @f32 (bow) | bow tails 32.27 @f27, hair 23.49, head/hat 20.76, all inside the invisible collision box only; real backrest mesh clearance 8.85 mm body / 5.12 mm bow (0 tri pairs) |
The proxy is effectively the backrest AABB (real 487×125×533 vs proxy ≈495×113×512 mm), so refitting it wouldn't help. It's a collision volume that is never rendered, so I left it as is.

## Method
Per the preferred order: no anim keys needed changing. The fix comes from the art side's pass2c sit-skirt correctives
(cloth shape keys, one knot per frame) plus the separated bow object, applied to the unchanged v2g animation. The pipeline was patched for:
the 5.x slotted-action fcurves, keeping the bow object and its keys (poselib SKM/clips/check_run), and including the bow in the checker.

## Smoothness
- Joints (scripts/joint_vel.py): max angular velocity, stand 10.25 -> 10.246 °/frame; turn 14.282 -> 14.282. Accel 6.317 -> 6.332 / 10.387 -> 10.408. Body bones Δ ≤ 1.0 mm / 0.21°. No new pops.
- Cloth (scripts/cloth_pop.py): the pass2c knots were solved independently per frame, so cloth jitters.
  Dress max accel 94.8 mm/frame² @f78 (v2g 7.5), apron 71.2 @f80 (visible max 62.65), bow 114.5 (not visible from the game camera).
  At the game camera it reads as a faint fold shimmer around f36–41 and f76–82. Smoothing the knots afterwards brought
  the clipping back (σ1: 47 mm, σ1.5/2: ~80 mm), and contact-masked variants created apron×dress and self-intersections
  (probe/check_f15*). None of them was adopted, so this needs a temporally coherent re-solve on the art side (grokbot2 / pass2c).

## Evidence
- evidence/penetration_curves_before_v2g_vs_after_src.png (before curves saturate at the 120 mm region cap)
- evidence/stills/{before,after}_fNNN_<label>_{game_r24,game_portrait45,closeFront,closeFront_marker,closeRight}.png
  (f42 legs_apron_dress, f60 legs_dress_f60, f32 chairback_proxy, f14 after_min_clear, f42 after_hem_graze)
- evidence/video/m1v2_clipfix_before_after_{portrait45,r24}[_halfspeed].mp4 — side by side, 30 fps, frames 0–90 stand-up + 91–135 turn
- Remaining checker items (pipe/probe/check_src_summary.txt): layer_cross apron_vs_dress up to 19.56 mm (vertex sign-flip metric),
  4 visible apron×dress pairs @f37

## Repo
The game repo (yiqifengle) doesn't contain the cine_m1 build, so nothing in it was touched. No branch, no SHA, no suite run.

## v3 — constrained temporal smoothing of pass2c knots (2026-10-17, result: PARTIAL / targets missed)
Candidate: `pipe/scene/cine_m1_anim_cs2.blend` (only m1_cNN shape-key data changed; knots in `cs/knots_cs2.npz/.json`, solver `cs/solve2.py`, λ=0.05, per-vertex QP with body/torso/chair contact planes, margins 2.0/1.4/2.0 mm).
| target | SRC | cs2 | pass? |
|---|---|---|---|
| dress accel ≤~10 mm/f² | 94.8 | 9.69 (f86) | yes |
| apron accel ≤~10 | 71.2 | 13.36 (f7; 12.6 f5, sit_corrective boundary) | no (near) |
| visible pop f36-41 (dress/apron) | 33.5/62.5 | 7.39/8.97 | yes |
| visible pop f76-82 | 41.1/59.5 | 6.64/10.0 | yes |
| 0 visible penetration | legL/R×dress mid -0.34/-0.41 | legL×dress mid 2.12 mm (f37), torso×dress 12.94 mm (12 fr) | no |
| apron×dress 0 visible overlaps @f37 | 4 tri pairs | max 530 pairs/frame, 37 frames; vertex check max 29.40 mm @f42 (SRC 19.56) | no |
| dress self-overlap | 0 | max 624 tri pairs/frame, 69 frames | no |
| body keys unchanged | — | bone pos diff 0.0 mm, ang vel/accel identical | yes |
Finding: the pass2c per-frame fold topology is not temporally coherent; any smoothing that removes shimmer creates self/layer crossings (even λ=3 → 1149 dress self pairs), and tri-level constraints / cloth-sim filter / local-λ variants (solve3/4/5, sim_cloth) diverged or brought accel back to 57–184. Fix needs an art-side temporally coherent re-solve (cloth sim with self-collision) or accept SRC.
Evidence: `evidence/curves_v3_penetration_accel_overlaps.png`, `evidence/stills_v3/` (+ `stills_v3_compare_f037/f079_*.png`), `evidence/video_v3/m1v2_clipfix_v3_v2g_src_cs2_{portrait45,r24}[_halfspeed].mp4`, probes `probe/*_cs2.*`, `probe/jv_src_vs_cs2.json`.

## v4: shipped candidate = pass2c SRC + apron-only ease f3–6 (2026-10-17, Grok Bot decision: SRC used, cs2 NOT used)
- Scene: `pipe/scene/cine_m1_anim_ease.blend` (sha256 4132c36b…, see `ease/SHA256SUMS.txt`). It is made reproducibly from SRC `pipe/scene/cine_m1_anim.blend` (9a5b2e24…) by `ease/apron_ease.py`.
- Change: on `G2_APRON_R5G2` only, `cine_open_stand` uses a smoothstep from f2 to f7. `sit_corrective` at f3/4/5/6 goes from SRC 1/1/1/0.5 to 0.896/0.648/0.352/0.104, and `m1_c07` = 1 − sit. Keys are linear. The dress, bow tails, bones and all other frames are untouched (`ease/apron_ease_weights.json`).
- Apron accel in f1–8: SRC max 3.9 (f5) → 3.1 (f7, the unchanged c07→c08 step); f5 goes 3.9 → 0.4. NB: SRC never had a peak here. The 13.4 at f5–7 belonged to cs2 only.
- Full check vs SRC:
  - Every triangle-level pair check is identical in all frames and clips: legs×dress/apron, apron×dress, dress/apron self, arms, bow, chair, torso.
  - Measure (penetration depth) maxima are unchanged.
  - Vertex-check `layer_cross apron_vs_dress` at f3–6 has 3 verts inside instead of 2, with depth ≤3.07 mm, the same as SRC's own f0–5 maximum. This is the sit-rest layering; SRC f7 already has 3 verts at 12.9 mm.
  - Body: bone pos diff 0.0 mm; joint angular velocity identical.
- Evidence:
  - `evidence/stills_v4/` (f4, f5, f37, SRC vs SRC+ease; game r24/portrait45 + close; f37 is pixel-identical).
  - `evidence/video_v4/` (half speed: v2g vs SRC+ease full clip; SRC vs SRC+ease f0–15, half and quarter speed).
  - `probe/{measure,cloth,jitter,joints,check}_ease.*`, `probe/jv_src_vs_ease.json`.
- Expert brief for an r5 cloth redo: `PROBLEM_BRIEF.md`.
