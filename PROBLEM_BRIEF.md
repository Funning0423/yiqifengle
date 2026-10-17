# Problem brief: r5 cloth redo with self-collision, for the M1 stand-up clip (《咦，起风了》, WeChat mini-game)

**Goal.** Produce the dress and apron motion for the cinematic *sit → stand → turn*. It must be temporally coherent: no frame-to-frame shimmer, no body or chair penetration, no apron↔dress or self crossings. The body animation is fixed and must not change.

**Assets** (Blender 5.2.2 scene `pipe/scene/cine_m1_anim.blend`, 30 fps; the stand clip is f0–90, the turn clip is f1–45):
| mesh | verts / faces | deformation |
|---|---|---|
| body `B_ANATOMICAL_VERTICAL_SLENDER_R5` | 31,656 / 38,849 | 26-bone armature `R5G2_RIG_22P4` (fixed animation) |
| dress `G2_DRESS_R5G2` | 6,678 / 13,104 | skinned + 74 shape keys; Solidify 0.8 mm (±0.4) |
| apron `G2_APRON_R5G2` (outer layer) | 729 / 1,352 | skinned + 74 shape keys; Solidify 0.8 mm |
| bow tails `G2_BOW_TAILS_R5G2` | 816 / 1,608 | skinned + 74 shape keys |
| real chair `CHAIR_REAL_reading_chair` | 290 / 179 | static; its backrest is the reference (not the proxy) |

**How SRC (pass2c) was made.**
- Base: the v2g animation (pass2b character).
- 72 per-frame corrective shape keys `m1_cNN` per garment, each solved *independently per frame* to clear penetration.
- Schedule: f0–5 `sit_corrective`, then one-hot knots with a few 2-key blend frames; f86–90 basis.
- Result: clean penetration-wise. But fold topology jumps between frames. Peak acceleration is 94.8 mm/frame² for the dress (f78) and 71.2 for the apron (f80); v2g was 7.5. The shimmer is visible at the game camera at f36–41 and f76–82.
- SRC is what ships for now. In v4, the apron's f3–6 is eased into `sit_corrective` (accel ≤3.1 there).

**Metrics and thresholds** (scripts in `scripts/` and `pipe/scripts/`):
- **Penetration:** signed depth in mm, + = inside. Leg×garment uses the garment midsurface and the ±0.4 mm shell. Target 0 mm on visible surfaces; the hidden underside of the lap is tolerated ≤2 mm.
- **Acceleration:** max per vertex of |X(f+1) − 2X(f) + X(f−1)|, in mm/frame². Target ≤~10 for dress and apron. Bone-only motion gives about 7.7.
- **Triangle overlaps:** count of intersecting triangle pairs, using the 0.8 mm shells. Checked for apron×dress, dress self, apron self, torso/legs/arms × garments, bow × dress, chair × garments. Target 0, and 0 visible apron×dress at f37.
- **Vertex-check:** `layer_cross apron_vs_dress`, the max depth of apron vertices on the inner side of the dress. Report it; SRC has 19.56 mm.
- **Cameras:**
  - `r24`: the R24 `camera_render_plan`; shot A's eye is fixed at Blender (−0.8, 4.8, 1.65); vfov 90.
  - `portrait45`: same eye, vfov 45, 390×844 portrait (the game default).
  - "Visible" means front-facing triangles hit by a ray from the eye.

**Already tried** (all smoothed the SRC knots; numbers are the worst values over the stand clip):
| approach | dress / apron accel | crossings |
|---|---|---|
| cs2: QP temporal smoothing + per-frame contact planes (λ 0.05) | 9.69 / 13.36 | dress self 624 pairs/frame (69 frames); apron×dress 530 (37 frames, vertex 29.4 mm); torso×dress 12.9 mm; legL×dress 2.1 mm |
| triangle-level constraints with homotopy λ 3 → 0.05 | diverged | self pairs 1,149 → 23,978 |
| Blender cloth sim with the knot shape as the pin goal (pin 0.5–0.85) | 57–84 | tens of thousands |
| per-vertex λ raised where crossings appear | climbs back to ≈62 | dress self 6,360 → 2,797 |
| visibility-filtered constraints + apron-over-dress sandwich | 120–184 | apron pushed ≈30 mm into the body |

The key finding: SRC's per-frame fold topology is not coherent over time. Even λ=3 smoothing makes 1,149 self crossings, so the knots cannot simply be filtered. A real cloth simulation with self-collision and layered dress→apron collision is needed. It should run against the fixed body and the real chair, starting from the `sit_corrective` rest at f0.

**Engine and runtime constraints** (Cocos Creator 3.8.8, WeChat mini-game):
- **Morph targets:** `UBOMorph.MAX_MORPH_TARGET_COUNT` = 60 per submesh. Above that, Cocos skips morphing for the submesh (warning 10002). The current 74 keys cannot ship as-is.
- **Current export:** `../m1v2/export/clips/cine_m1_open_stand_turn.glb` is 3,434,556 B. It has 1 morph target (`sit_corrective`) per garment, max 3 bone influences, and is sampled at 24 fps (stand 0–72, turn 0–36).
- **Package gate** (`tools/check_wechat_build.py`): main package ≤4,000,000 B, total ≤30 MiB (31,457,280 B). The last measured build was main 1,861,856 B and total 28,709,293 B. That leaves about 2.75 MB for everything new.
- **Implications:**
  - Raw float morphs cost verts × 12 B per target. For the dress that is about 80 KB per target, so per-frame morphs (91 + 46 frames) are far over budget.
  - Prefer one of these:
    - a few (≤8–12) pose-space corrective targets driven by curves;
    - extra cloth bones (dress/apron skirt chains, ≤~16 bones, ≤4 influences);
    - quantised or sparse morphs.

**Expected deliverable:**
- A `.blend`, or GLB plus a weight/bone-curve sidecar, for the stand and turn clips.
- The same mesh topology and vertex order as the current dress, apron and bow.
- The body animation untouched (we diff bone transforms; they must be 0).
- Morph count ≤60 per submesh and a total added size of ≤~1.5 MB.
- A self-report of the metrics above per frame: penetration mm visible/hidden, accel, the overlap-pair table, and the vertex-check.
- Game-camera renders at f36–41 and f76–82.
