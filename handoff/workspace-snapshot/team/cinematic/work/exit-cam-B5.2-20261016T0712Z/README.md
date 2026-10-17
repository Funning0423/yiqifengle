# Exit camera B5.2 (local only, NOT pushed)
Commit 468b2d7796ff002c572acd91f6a8a728346f9fe7, tree 6f593625153cbd68aaa7575bc0a5f14b12d187e9, on cine/exit-cam-B5. Parent: B5.1 b12ff1f. Base: b14067c.

## Changes from B5.1
- New end pose yunjing-final: pos (-22, 12, 18) → target (-1, 2.5, 1), vertical FOV 56. It sits on her right, 23.6 m away horizontally.
- Settle is now 28 s. turnShare is 0.45: the camera swings to her right before pulling back, so it stays clear of the palm by the lighthouse and of the gulls. heightShare is 0.55. Follow-segment speed is unchanged.
- Wind fallback: the side pose never gets within 20° of her front. The wind therefore peaks at the most frontal sample, at least 3 s before the end, and eases out. Max step 0.0097 per frame.
- Test cap: peak ≤ 2.2 m/s.
- Preview fix: the black speckle was linear filtering of the palette texture. It is fixed with Closest filtering, and the camera clip planes are now 0.3–400. The white palm was a T9 GLB with no texture; it now uses the island palette material.

## Results
- Total 36.68 s (B5.1: 12.88 s). The exit runs 34.14 s after the door key.
- Peak 1.84 m/s at 14.4 s. Max accel 1.33 m/s² constant walk / 1.73 real walk. Max jerk 11.4 / 15.5 m/s³. No kinks.
- Clearance:
  - lighthouse wall at the doorway: 0.50 m (exempt)
  - props: 0.80 m (8.8 s)
  - gull orbit: 2.07 m (limit 2 m)
- Occlusion: face/head/chest 0 frames. Feet only, 5 frames.
- Feet NDC: above -0.5 after 3.42 s.
- Left of her: max 0.067 m, in the doorway only (tolerance 0.15 m).
- Final frame (raycast + render):
  - whole lighthouse, island and sea in view
  - no props on the line of sight to her
  - chest and face sunlit; the feet sample falls in the beach palm's shadow (preview sun)
- Suite FAIL:
  - composition (also failed on B5/B5.1)
  - return-entry-continuous, real walk (also failed on B5/B5.1)
  - **wind-frontal** (new): the lens is 59° off her front at the wind peak. The side end pose makes this unavoidable; needs a decision.
  - Everything else passes, including island-pull, movers and in-frame.
- Manifests: FAIL, same as base.
- Sail check, C and A2 placements (start = new pose): no occlusion. Nearest: signpost 26 m, palm 27 m, island 12.9 m.
- Timing (30 fps): door 76, walk end 260, peak 433, wind full 516–579, crane 524, settled / sailboat start 1101.

## Progress
- [x] commit, patch, tests, sail, CSVs, timing, plot, final stills
- [x] videos video/exit_B5.1_vs_B5.2_{0.46,0.75}.mp4 (36.8 s, 5 fps, 396x528 EEVEE 4 samples; Closest-filter fix removes speckle; EEVEE has no denoiser)
