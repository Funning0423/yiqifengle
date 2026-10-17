# r4 land fill: sample table (stand-in, Mac-calibrated HDR+ACES emulator)

Targets: graded engine-camera r5h3 reference (ENGINE_COLOR_REFERENCE/engine_cam_r5h3). Bar: ±12 per channel; mid stripe std ≤ 10. "r4" = 9581c23 (no fill), "r4+fill" = this branch.

## Day 390x844

| point | target | Mac r3 | r4 | r4+fill | r4+fill - target | pass |
|---|---|---|---|---|---|---|
| far_water | 109/130/103 | - | 110/129/105 | 110/129/105 | +1/-1/+2 | yes |
| mid_water | 83/128/128 | - | 84/122/123 | 84/122/123 | +1/-6/-5 | yes |
| mid_water_R | 72/106/115 | - | 76/115/120 | 76/115/120 | +4/+9/+5 | yes |
| under_bridge | 98/138/128 | - | 97/133/123 | 97/133/123 | -1/-5/-5 | yes |
| near_mid_water | 88/146/137 | - | 94/148/136 | 94/148/136 | +6/+2/-1 | yes |
| near_water_bottom | 114/172/153 | - | 115/174/155 | 115/174/155 | +1/+2/+2 | yes |
| near_water_L | 119/172/153 | - | 111/172/154 | 111/172/154 | -8/+0/+1 | yes |
| bridge_stone_deck | 125/94/53 | - | 133/89/52 | 133/89/52 | +8/-5/-1 | yes |
| bridge_stone_left | 132/99/58 | - | 136/89/54 | 136/89/54 | +4/-10/-4 | yes |
| bridge_rail_top | 164/128/84 | - | 169/124/78 | 169/124/78 | +5/-4/-6 | yes |
| grass_near | 116/168/38 | - | 47/92/13 | 116/168/38 | +0/+0/+0 | yes |
| far_hills | 96/121/129 | - | 79/79/75 | 106/127/133 | +10/+6/+4 | yes |
| mtn_snow | 139/142/142 | - | 106/91/82 | 127/135/138 | -12/-7/-4 | yes |
| tree_crown (land, not in bar) | 42/108/5 | - | 23/62/14 | 23/65/14 | -19/-43/+9 | no |
| house_wall (land, not in bar) | 128/74/0 | - | 80/69/25 | 80/69/25 | -48/-5/+25 | no |
| far_shore (land, not in bar) | 92/136/128 | - | 97/129/126 | 98/130/126 | +6/-6/-2 | yes |
| STRIPE std | 1.5 | | | 1.9 | | yes |

## Day 360x640

| point | target | Mac r3 | r4 | r4+fill | r4+fill - target | pass |
|---|---|---|---|---|---|---|
| far_water | 110/128/99 | 196/150/106 | 110/129/105 | 110/129/105 | +0/+1/+6 | yes |
| mid_water | 84/128/126 | 178/131/92 | 84/122/123 | 84/122/123 | +0/-6/-3 | yes |
| mid_water_R | 75/106/114 | 179/128/87 | 77/115/120 | 77/115/120 | +2/+9/+6 | yes |
| under_bridge | 100/137/126 | 184/141/100 | 98/133/123 | 98/133/123 | -2/-4/-3 | yes |
| near_mid_water | 88/146/136 | 170/135/96 | 94/148/136 | 94/148/136 | +6/+2/+0 | yes |
| near_water_bottom | 114/172/153 | 61/136/128 | 114/174/155 | 115/174/155 | +1/+2/+2 | yes |
| near_water_L | 116/171/152 | 95/142/125 | 111/172/154 | 111/172/154 | -5/+1/+2 | yes |
| bridge_stone_deck | 124/94/53 | 175/164/110 | 133/89/52 | 133/89/52 | +9/-5/-1 | yes |
| bridge_stone_left | 130/92/56 | 163/147/104 | 121/85/54 | 121/85/54 | -9/-7/-2 | yes |
| bridge_rail_top | 163/128/84 | 207/200/154 | 169/124/78 | 169/124/78 | +6/-4/-6 | yes |
| grass_near | 116/168/38 | 57/97/22 | 47/92/13 | 116/168/38 | +0/+0/+0 | yes |
| far_hills | 96/120/129 | 149/164/155 | 79/79/75 | 106/127/133 | +10/+7/+4 | yes |
| mtn_snow | 139/142/142 | 155/170/160 | 106/91/82 | 127/135/138 | -12/-7/-4 | yes |
| tree_crown (land, not in bar) | 42/108/5 | 41/127/33 | 24/63/15 | 24/65/15 | -18/-43/+10 | no |
| house_wall (land, not in bar) | 128/74/0 | 107/130/42 | 81/70/25 | 81/70/25 | -47/-4/+25 | no |
| far_shore (land, not in bar) | 95/136/126 | 178/135/100 | 97/128/126 | 98/129/126 | +3/-7/+0 | yes |
| STRIPE std | 1.8 | | | 2.3 | | yes |

## Night 360x640 (no reference; land target ≈ 80% of Mac r3 night land, cool hue; lake blue-teal)

| point | Mac r3 | r4 | r4+fill | luma ratio vs Mac r3 | hue° (r4+fill) | check |
|---|---|---|---|---|---|---|
| far_water | 106/58/48 | 14/36/55 | 14/36/55 | 0.48 | 208 | blue-teal |
| mid_water | 91/51/43 | 11/32/54 | 11/32/54 | 0.49 | 211 | blue-teal |
| mid_water_R | 90/50/40 | 10/30/53 | 10/30/53 | 0.47 | 212 | blue-teal |
| under_bridge | 97/56/46 | 13/36/57 | 13/36/57 | 0.51 | 209 | blue-teal |
| near_mid_water | 87/54/46 | 12/40/64 | 12/40/64 | 0.59 | 208 | blue-teal |
| near_water_bottom | 33/50/66 | 13/48/78 | 13/48/78 | 0.91 | 207 | blue-teal |
| near_water_L | 19/47/69 | 13/48/76 | 13/48/76 | 1.00 | 207 | blue-teal |
| bridge_stone_deck | 20/28/44 | 11/14/23 | 11/14/23 | 0.51 | 225 | - |
| bridge_stone_left | 22/32/54 | 12/16/27 | 12/16/27 | 0.50 | 223 | - |
| bridge_rail_top | 30/43/71 | 15/20/33 | 15/20/33 | 0.47 | 223 | - |
| grass_near | 13/47/17 | 11/40/12 | 11/40/14 | 0.85 | 126 | ratio ok, cool |
| far_hills | 16/31/79 | 7/14/35 | 13/26/66 | 0.84 | 225 | ratio ok, cool |
| mtn_snow | 20/39/94 | 10/18/44 | 16/30/73 | 0.77 | 225 | ratio ok, cool |
| tree_crown | 5/22/14 | 3/11/7 | 3/11/7 | 0.51 | 150 | - |
| house_wall | 14/21/18 | 11/12/14 | 11/12/14 | 0.61 | 220 | - |
| far_shore | 90/55/46 | 12/36/58 | 12/36/58 | 0.53 | 209 | - |
| STRIPE std | 6.1 | | | 1.1 | | |

## Night 390x844 (r4+fill)

| point | r4 | r4+fill | hue° |
|---|---|---|---|
| far_water | 14/36/55 | 14/36/55 | 208 |
| mid_water | 11/32/54 | 11/32/54 | 211 |
| mid_water_R | 10/30/53 | 10/30/53 | 212 |
| under_bridge | 12/36/57 | 12/36/57 | 208 |
| near_mid_water | 12/40/64 | 12/40/64 | 208 |
| near_water_bottom | 13/48/78 | 13/48/78 | 207 |
| near_water_L | 13/48/76 | 13/48/76 | 207 |
| bridge_stone_deck | 11/14/23 | 11/14/23 | 225 |
| bridge_stone_left | 12/16/27 | 12/16/27 | 224 |
| bridge_rail_top | 15/20/33 | 15/20/33 | 223 |
| grass_near | 11/40/12 | 11/40/14 | 126 |
| far_hills | 7/14/35 | 13/26/66 | 225 |
| mtn_snow | 10/18/44 | 16/30/73 | 225 |
| tree_crown | 3/11/7 | 3/11/7 | 150 |
| house_wall | 11/12/14 | 11/12/14 | 220 |
| far_shore | 12/36/58 | 12/36/58 | 209 |

Water + bridge pixels (LK_lake, LK_bridge, LK_bridge_steps; 390x844, day and night): max |r4+fill - r4| = 0 (the fill only touches LK_terrain / LK_far_hills / LK_far_shore).
