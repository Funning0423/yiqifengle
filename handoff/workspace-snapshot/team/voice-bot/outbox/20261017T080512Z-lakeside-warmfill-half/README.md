# Voice Bot — lakeside warm fill halved (r2b), on GGbot r2 228df2f

Branch `voice/build05-lakeside-art-engine-r2`, 6 commits on 228df2f. Nothing pushed, mainline untouched, author Voice Bot.
- HEAD `f7f892f06bb49bf25c0c176384c4ef3f2def83e2`, tree `e454422831f8a055e7ab595065e9dca41f03344c`
- New commit on top of c60ac55: **f7f892f**. The earlier 5 (7176c56, a90b2cf, 78b23c5, de093cd, c60ac55) are unchanged; see
  `../20261017T075426Z-lakeside-art-engine-r2/README.md` for the encoding finding.
- Apply: `git fetch voice-build05-lakeside-art-engine-r2.bundle voice/build05-lakeside-art-engine-r2` (prerequisite 228df2f,
  verified) or `git am patches/*.patch` on 228df2f.

## Change (Grok Bot review of c60ac55: rails yellow, sky and far hills yellow-green)
- Ground ambient 1/0.841/0.0687 → **0.9095/0.83/0.4439**: the warm saturation is cut in half, toward its own luminance.
  Luminance stays 0.819, so the night ratios (moon/sun 0.857, ambient 0.219) are unchanged and still locked by `lakeside-light-encoding`.
- Unchanged: sun 0.7, ambient 0.49, sky, water scales, fog, pavilion. Draw calls are unchanged: no lights, materials or meshes were added.

One sanity pass on the stand-in emulator, with no iteration (the Mac screenshots decide): `emu_warmfill_half.png`.

| region | r5h3 | c60ac55 | f7f892f |
|---|---|---|---|
| bridge_side | 108/110/88 | 140/126/70 | 140/126/110 (neutral; luma +18%) |
| bridge_rail | 107/132/133 | 129/146/140 | 129/146/141 |
| far_trees | 71/83/20 | 31/95/16 | 29/94/30 |
| roof | 131/37/2 | 135/44/10 | 128/43/14 |
| grass_L | 81/107/24 | 109/134/59 | 109/134/59 |
| near_water_L | 66/152/146 | 59/153/146 | 59/153/146 |

## Suite
66/71. Only the known 5 failures: production-integrity, legacy-board-ui-pure, reward-background-return,
cloud-web-contract FAIL; navigation-guard BLOCKED_BROWSER. lakeside-daynight, lakeside-pavilion, lakeside-light-encoding and
all other lakeside tests PASS. Log: `suite.log`.

## Risks
The bridge side's hue is now neutral but it reads about 18% bright, which is outside ±10% in the emulator. Grass is about 1.29×.
The olive of the far hills and terrain is a separate follow-up.
