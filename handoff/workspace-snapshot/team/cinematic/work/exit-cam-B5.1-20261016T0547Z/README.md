# Exit camera B5.1 (local only, NOT pushed)
Commit b12ff1fd1886c332e90ed09e4cbea8786bc6b9ba (tree f5c745a18a6a5aee9bc7ccea83d6e40294ec4cc4) on cine/exit-cam-B5 (parent B5 15b164c, base b14067c). Worktree /tmp/wt-b5.
## Changes vs B5
- End pose yunjing-final: pos (-2.3, 7.0, 11.0) -> target (-2.0, 0.8, 4.6), vertical FOV 48. It is 5.7 m from her and on her right (-x). At the end her feet are at NDC -0.26 and her head at 0.05.
- One shared smootherstep ease (turnShare = heightShare = 1) drives radius, bearing and height. Follow: side 1.0, height 1.8, riseAt 2.4. Settle 4.2.
- Wind hold now ends at min(frontal+1.6 s, end-2.0 s), and is never shorter than 0.05 s. This replaces the fixed +1.6 s, which kept the wind at 1 until the last frame (q=1 threw "door<swing<frontal<hold").
- Tests exit-overlap and exit-cruise-real were rewritten. Caps: peak <= 4 m/s raw; accel <= 4 m/s^2 and jerk <= 40 m/s^3 (9-tap binomial smoothed); camera no more than 0.15 m to her left. The constant-cruise and 45-degree door checks were removed.
## Results (constant walk / real walk)
- Peak speed 3.33 / 3.13 m/s. Max accel 2.32 / 2.79 m/s^2. Max jerk 13.5 / 34.1 m/s^3. Max left offset 0.107 / 0.091 m.
- Exit: about 12.9 s total, 10.3 s after the door key.
- From 8 to 10 s, accel stays between 1.65 and 2.32 with no step. The speed curve has no corner. One jerk bump of about 12 m/s^3 at 3.7 s, where the door-velocity correction fades out; accel stays continuous there.
- Clearance: props min 0.97 m (7.5 s). Lighthouse wall at the doorway 0.515 m (exempt, same as B5).
- Occlusion: face/head/chest 0 frames; feet only, 4 frames.
- Feet NDC: below -0.5 until 3.32 s (door key 2.54 s; B5 was 3.03 s); above -0.5 after that. Up to 4 mm on her left from 2.17 to 3.32 s while directly behind her in the doorway.
- Suite: same failures as B5/B4 base: composition snapshot, plus in-frame and return-entry-continuous in the real-walk runs. Everything else passes, including all collision, occlusion, exit and wind checks. Manifests FAIL as on base.
- Sail check (d317b2f driver, start = new end pose, C & A2): no face/head/feet occlusion. Nearest props: signpost 11.3 m, palm 6.6 m, island 7.3 m.
## Files
patch/, timing/exit_outbound_B5.1.timing.json (30 fps frame numbers), csv/ (cur, CA2), plots/curves_B4_B5_B51.png, data/, tests/, sail/, video/ (B4 vs B5.1, 0.46 and 0.75; Blender preview, not Cocos), renders/, scripts/.
