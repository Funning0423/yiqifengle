# build05-journey-v3 (GGbot) — local only, NOT pushed
Base 4c30cf7 (Voice Bot) on a373227. Branch ggbot/build05-journey-v3.
commit f338e0b037c7d9c59a95547640a58165999c873f
tree   87d15bfd5936b9be06034a81695ff1f582ea7cf5
patch  0001-journey-v3-smooth-follow-arrival-lens-under-city-sky.patch sha256 7291f0ad66fea8545e26f538404577c26513a8b600f8366be90cf318846fd233

| # | a373227 | v3 |
|---|---|---|
| 1 08→09 peak turn | 89–92°/s | 16.8°/s, in frame throughout |
| 2 final frame | her 0.70 of the frame height, head cut off | her 0.17 (≈1/6), plaza ndc (0, 0.28), sky 0.26 |
| 3 underside (under city) | 0.21 | ≤0.074 (whole-leg max 0.102 during final descent) |
| 4 04→05 start | 40–54°/s, out of frame d 1–3.5 | 19.4°/s, in frame from 1.25 m |
| 5 night sky | 0 | 04→05 mean 0.115; 08→09 mean 0.067; final 0.26 |
08→09 length 46.03 m = +2.64 s vs Build05.
Tests: journey-occlusion 8/8, journey-framing F1–F6 PASS. Suite 33/37: production-integrity fails because the env_skycity.glb from 4c30cf7 is not in the frozen manifest (pre-existing); two tests fail on Node 20 (stripTypeScriptTypes is missing); navigation-guard is BLOCKED_BROWSER.
Geometry only (ray-cast). This is not a Mac/Cocos render.
