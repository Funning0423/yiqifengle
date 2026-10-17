# Sample table: new targets | Mac r3 | stand-in r4

Targets = graded engine-camera r5h3 reference (pre-grade in REFERENCE.md). Mac r3 exists only at 360x640 (bg-only shots); the 390x844 points are the same world points re-projected (boxes_390x844.json). Bar: every point within ±12 per channel, mid stripe std ≤ 10. Night has no r5h3 reference: judged by hue (lake B ≥ G > R, dark blue-teal), Mac r3 shown for the before.

## day - 390x844 (primary pose)

| point | target | Mac r3 | stand-in r4 | r4 - target | pass |
|---|---|---|---|---|---|
| far_water | 109/130/103 | - | 110/129/105 | +1/-1/+2 | yes |
| mid_water | 83/128/128 | - | 84/122/123 | +1/-6/-5 | yes |
| mid_water_R | 72/106/115 | - | 76/115/120 | +4/+9/+5 | yes |
| under_bridge | 98/138/128 | - | 97/133/123 | -1/-5/-5 | yes |
| near_mid_water | 88/146/137 | - | 94/148/136 | +6/+2/-1 | yes |
| near_water_bottom | 114/172/153 | - | 115/174/155 | +1/+2/+2 | yes |
| near_water_L | 119/172/153 | - | 111/172/154 | -8/+0/+1 | yes |
| bridge_stone_deck | 125/94/53 | - | 133/89/52 | +8/-5/-1 | yes |
| bridge_stone_left | 132/99/58 | - | 136/89/54 | +4/-10/-4 | yes |
| bridge_rail_top | 164/128/84 | - | 169/124/78 | +5/-4/-6 | yes |
| STRIPE std | 1.5 | - | 1.9 | | yes |

## day - 360x640 (Mac calibration frame)

| point | target | Mac r3 | stand-in r4 | r4 - target | pass |
|---|---|---|---|---|---|
| far_water | 110/128/99 | 196/150/106 | 110/129/105 | +0/+1/+6 | yes |
| mid_water | 84/128/126 | 178/131/92 | 84/122/123 | +0/-6/-3 | yes |
| mid_water_R | 75/106/114 | 179/128/87 | 77/115/120 | +2/+9/+6 | yes |
| under_bridge | 100/137/126 | 184/141/100 | 98/133/123 | -2/-4/-3 | yes |
| near_mid_water | 88/146/136 | 170/135/96 | 94/148/136 | +6/+2/+0 | yes |
| near_water_bottom | 114/172/153 | 61/136/128 | 114/174/155 | +0/+2/+2 | yes |
| near_water_L | 116/171/152 | 95/142/125 | 111/172/154 | -5/+1/+2 | yes |
| bridge_stone_deck | 124/94/53 | 175/164/110 | 133/89/52 | +9/-5/-1 | yes |
| bridge_stone_left | 130/92/56 | 163/147/104 | 121/85/54 | -9/-7/-2 | yes |
| bridge_rail_top | 163/128/84 | 207/200/154 | 169/124/78 | +6/-4/-6 | yes |
| STRIPE std | 1.8 | 14.4 | 2.3 | | yes |

Land (regression only, not in the bar), day 360x640: target | Mac r3 | r4

- grass_near: 116/168/38 | 57/97/22 | 47/92/13
- far_hills: 96/120/129 | 149/164/155 | 79/79/75
- mtn_snow: 139/142/142 | 155/170/160 | 106/91/82
- tree_crown: 42/108/5 | 41/127/33 | 24/63/15
- house_wall: 128/74/0 | 107/130/42 | 81/70/25
- far_shore: 95/136/126 | 178/135/100 | 97/128/126

## night - 390x844 (primary pose)

| point | target | Mac r3 | stand-in r4 | r4 - target | pass |
|---|---|---|---|---|---|
| far_water | (no ref) | - | 14/36/55 | - | hue ok |
| mid_water | (no ref) | - | 11/32/54 | - | hue ok |
| mid_water_R | (no ref) | - | 10/30/53 | - | hue ok |
| under_bridge | (no ref) | - | 12/36/57 | - | hue ok |
| near_mid_water | (no ref) | - | 12/40/64 | - | hue ok |
| near_water_bottom | (no ref) | - | 13/48/78 | - | hue ok |
| near_water_L | (no ref) | - | 13/48/76 | - | hue ok |
| bridge_stone_deck | (no ref) | - | 11/14/23 | - | hue ok |
| bridge_stone_left | (no ref) | - | 12/16/27 | - | hue ok |
| bridge_rail_top | (no ref) | - | 15/20/33 | - | hue ok |
| STRIPE std | 1.5 | - | 1.0 | | yes |

## night - 360x640 (Mac calibration frame)

| point | target | Mac r3 | stand-in r4 | r4 - target | pass |
|---|---|---|---|---|---|
| far_water | (no ref) | 106/58/48 | 14/36/55 | - | hue ok |
| mid_water | (no ref) | 91/51/43 | 11/32/54 | - | hue ok |
| mid_water_R | (no ref) | 90/50/40 | 10/30/53 | - | hue ok |
| under_bridge | (no ref) | 97/56/46 | 13/36/57 | - | hue ok |
| near_mid_water | (no ref) | 87/54/46 | 12/40/64 | - | hue ok |
| near_water_bottom | (no ref) | 33/50/66 | 13/48/78 | - | hue ok |
| near_water_L | (no ref) | 19/47/69 | 13/48/76 | - | hue ok |
| bridge_stone_deck | (no ref) | 20/28/44 | 11/14/23 | - | hue ok |
| bridge_stone_left | (no ref) | 22/32/54 | 12/16/27 | - | hue ok |
| bridge_rail_top | (no ref) | 30/43/71 | 15/20/33 | - | hue ok |
| STRIPE std | 1.8 | 6.1 | 1.1 | | yes |

Land (regression only, not in the bar), night 360x640: target | Mac r3 | r4

- grass_near: - | 13/47/17 | 11/40/12
- far_hills: - | 16/31/79 | 7/14/35
- mtn_snow: - | 20/39/94 | 10/18/44
- tree_crown: - | 5/22/14 | 3/11/7
- house_wall: - | 14/21/18 | 11/12/14
- far_shore: - | 90/55/46 | 12/36/58

## Stand-in calibration (r3 stand-in vs Mac r3, 360x640)

| mode | point | Mac r3 | r3 stand-in | max abs diff |
|---|---|---|---|---|
| day (t=1.5) | far_water | 196/150/106 | 196/150/106 | 0 |
| day (t=1.5) | mid_water | 178/131/92 | 178/131/92 | 0 |
| day (t=1.5) | mid_water_R | 179/128/87 | 178/127/87 | 1 |
| day (t=1.5) | under_bridge | 184/141/100 | 184/141/99 | 1 |
| day (t=1.5) | near_mid_water | 170/135/96 | 168/136/98 | 2 |
| day (t=1.5) | near_water_bottom | 61/136/128 | 62/138/127 | 2 |
| day (t=1.5) | near_water_L | 95/142/125 | 93/140/124 | 2 |
| day (t=1.5) | bridge_stone_deck | 175/164/110 | 175/164/110 | 0 |
| day (t=1.5) | bridge_stone_left | 163/147/104 | 162/147/101 | 3 |
| day (t=1.5) | bridge_rail_top | 207/200/154 | 207/200/154 | 0 |
| day | STRIPE std | 14.36 | 13.77 | |
| night (t=5.25) | far_water | 106/58/48 | 106/58/48 | 0 |
| night (t=5.25) | mid_water | 91/51/43 | 94/52/42 | 3 |
| night (t=5.25) | mid_water_R | 90/50/40 | 87/49/41 | 3 |
| night (t=5.25) | under_bridge | 97/56/46 | 97/56/46 | 0 |
| night (t=5.25) | near_mid_water | 87/54/46 | 78/52/48 | 9 |
| night (t=5.25) | near_water_bottom | 33/50/66 | 25/46/65 | 8 |
| night (t=5.25) | near_water_L | 19/47/69 | 16/45/69 | 3 |
| night (t=5.25) | bridge_stone_deck | 20/28/44 | 20/28/44 | 0 |
| night (t=5.25) | bridge_stone_left | 22/32/54 | 22/32/54 | 0 |
| night (t=5.25) | bridge_rail_top | 30/43/71 | 31/43/71 | 1 |
| night | STRIPE std | 6.07 | 3.13 | |
