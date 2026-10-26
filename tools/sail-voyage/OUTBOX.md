# OUTBOX — sail-voyage option E (运镜bot, 2026-10-26)

NOT_ENGINE: CPU z-buffer (real env_meadow.glb sail copy with z<45 terrain/river_bank/meadow_river sunk to y≤−1.3 and hidden before the 17.4 s swap; stand-in = same glb ×0.7 about the meadow root at (−11.6,−0.91,492); sailboat.glb; opaque sea at y −0.91). Share = vertical extent of visible meadow/stand-in pixels ÷ frame height. Not renders; the Mac DevTools capture (capture-spec.json) is the arbiter.

Boat: 3.6 m/s, cruise 8.22 s, sail clock 23.82 s (unchanged). Whole island→meadow: 41.4 s (≤45).
Motion (390x844, 60 fps): yaw max 87°/s (≤90), accel p99 168.3°/s² (≤200), step max 0.26 m (≤0.6), first frame = live lens. Clearance 3.92 m (meadow_terrain). Face/chest hidden 0 s.

| screen | dock S-b before→after | windmill px h×w (after) | open sea s before→after | swap verts in frustum before→after | pre-dock 19–21 s before→after | docked before→after | head ndc max | boat ndc max (sea) | capsule gap px |
|---|---|---|---|---|---|---|---|---|---|
| 390x844 | 0.000→0.036–0.036 | [20, 19] | 8→8.25 | 207975→0 | 0.493→0.327 | 0.512→0.341 | 0.814 | 0.709 | 367 |
| 414x896 | 0.000→0.036–0.036 | [22, 22] | 8→8.25 | 207962→0 | 0.491→0.326 | 0.513→0.339 | 0.815 | 0.709 | 395 |
| 360x780 | 0.000→0.036–0.036 | [18, 17] | 8→8.25 | 207553→0 | 0.492→0.328 | 0.513→0.338 | 0.815 | 0.71 | 333 |
| 375x667 | 0.000→0.036–0.036 | [15, 16] | 8→8.25 | 290269→0 | 0.509→0.329 | 0.533→0.341 | 0.669 | 0.583 | 274 |
| 390x520 | 0.000→0.035–0.035 | [11, 12] | 8→7.75 | 484005→0 | 0.531→0.338 | 0.569→0.346 | 0.502 | 0.47 | 198 |
| 320x568 | 0.000→0.035–0.035 | [13, 13] | 8→8.5 | 291214→0 | 0.507→0.324 | 0.535→0.338 | 0.668 | 0.582 | 221 |
| 768x1024 | 0.000→0.035–0.035 | [24, 24] | 8→7.75 | 484005→0 | 0.531→0.332 | 0.574→0.344 | 0.502 | 0.47 | 480 |

Before open-sea seconds are with the meadow already hidden by E (old camera, new scene); the old camera fails the swap (meadow in frustum) and dock (stand-in behind the sail).

Gates (hard, tools/sail-voyage/test_sail_voyage.cjs, in run-suite): dock 2–4 %; windmill on 320x568 ≥12 px tall and ≥10 px blade span; open sea ≥6 s; docked 30–40 %; swap t 17.3–17.5: 0 above-water meadow/stand-in vertices in the frustum and dominant pixel class ≤92 %; whole ≤45 s; head |ndc| ≤0.9 (30 fps, from S-b); whole hull/rig |ndc| ≤0.97 in the beam; capsule clear; yaw/accel/step/clearance/occlusion caps.

Plot: reports/sail-voyage-before-after.png. Golden re-baseline: NOT committed (needs engine frames): capture-spec.json + rebaseline.cjs (--dry-run shows sail-farsea 'windmill not on screen' in the K3 hold and sail-k2k7 'wake corners in frame' fail on the new lens — semantic, need Grok Bot; script refuses to commit while they fail).
