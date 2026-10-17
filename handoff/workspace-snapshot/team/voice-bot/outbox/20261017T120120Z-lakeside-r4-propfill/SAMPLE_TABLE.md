# r4 prop fill (foliage / house walls / rocks / clouds): sample table

Stand-in = Mac-calibrated HDR+ACES emulator, fresh renders of this commit. "prev" = previous delivery 467b36d (land fill only). Day targets = engine-cam r5h3 reference; bar ±12 per channel, stripe std ≤ 10.
Prop samplers: median over the pixels of that object class inside the old sample box (tree_crown box ∩ trees/bush; house_wall box ∩ houses) and over all cloud pixels. The old house_wall box was 55% trees + chime post + porch, so its plain-box median is also listed for continuity.

## Day 390x844

| point | target | prev | now | now - target | pass |
|---|---|---|---|---|---|
| far_water | 109/130/103 | 110/129/105 | 110/129/105 | +1/-1/+2 | yes |
| mid_water | 83/128/128 | 84/122/123 | 84/122/123 | +1/-6/-5 | yes |
| mid_water_R | 72/106/115 | 76/115/120 | 76/115/120 | +4/+9/+5 | yes |
| under_bridge | 98/138/128 | 97/133/123 | 97/133/123 | -1/-5/-5 | yes |
| near_mid_water | 88/146/137 | 94/148/136 | 94/148/136 | +6/+2/-1 | yes |
| near_water_bottom | 114/172/153 | 115/174/155 | 115/174/155 | +1/+2/+2 | yes |
| near_water_L | 119/172/153 | 111/172/154 | 111/172/154 | -8/+0/+1 | yes |
| bridge_stone_deck | 125/94/53 | 133/89/52 | 133/89/52 | +8/-5/-1 | yes |
| bridge_stone_left | 132/99/58 | 136/89/54 | 136/89/54 | +4/-10/-4 | yes |
| bridge_rail_top | 164/128/84 | 169/124/78 | 169/124/78 | +5/-4/-6 | yes |
| grass_near | 116/168/38 | 116/168/38 | 116/168/38 | +0/+0/+0 | yes |
| far_hills | 96/121/129 | 106/127/133 | 106/127/133 | +10/+6/+4 | yes |
| mtn_snow | 139/142/142 | 127/135/138 | 127/135/138 | -12/-7/-4 | yes |
| tree (trees+bush px in tree_crown box) | 42/108/5 | 23/63/14 | 41/106/14 | -1/-2/+9 | yes |
| house wall (house px in house_wall box) | 174/134/91 | 170/125/79 | 175/133/90 | +1/-1/-1 | yes |
| cloud (all cloud px) | 199/172/157 | 134/76/42 | 202/173/157 | +3/+1/+0 | yes |
| tree_crown (old plain box, mixed objects) | 42/108/5 | 23/65/14 | 42/106/14 | +0/-2/+9 | yes |
| house_wall (old plain box, mixed objects) | 128/74/0 | 80/69/25 | 88/106/26 | -40/+32/+26 | no |
| STRIPE std | 1.5 | 1.9 | 1.9 | | yes |

## Day 360x640

| point | target | prev | now | now - target | pass |
|---|---|---|---|---|---|
| far_water | 110/128/99 | 110/129/105 | 110/129/105 | +0/+1/+6 | yes |
| mid_water | 84/128/126 | 84/122/123 | 84/122/123 | +0/-6/-3 | yes |
| mid_water_R | 75/106/114 | 77/115/120 | 77/115/120 | +2/+9/+6 | yes |
| under_bridge | 100/137/126 | 98/133/123 | 98/133/123 | -2/-4/-3 | yes |
| near_mid_water | 88/146/136 | 94/148/136 | 94/148/136 | +6/+2/+0 | yes |
| near_water_bottom | 114/172/153 | 115/174/155 | 115/174/155 | +1/+2/+2 | yes |
| near_water_L | 116/171/152 | 111/172/154 | 111/172/154 | -5/+1/+2 | yes |
| bridge_stone_deck | 124/94/53 | 133/89/52 | 133/89/52 | +9/-5/-1 | yes |
| bridge_stone_left | 130/92/56 | 121/85/54 | 121/85/54 | -9/-7/-2 | yes |
| bridge_rail_top | 163/128/84 | 169/124/78 | 169/124/78 | +6/-4/-6 | yes |
| grass_near | 116/168/38 | 116/168/38 | 116/168/38 | +0/+0/+0 | yes |
| far_hills | 96/120/129 | 106/127/133 | 106/127/133 | +10/+7/+4 | yes |
| mtn_snow | 139/142/142 | 127/135/138 | 127/135/138 | -12/-7/-4 | yes |
| tree (trees+bush px in tree_crown box) | 41/107/3 | 23/64/14 | 41/106/14 | +0/-1/+11 | yes |
| house wall (house px in house_wall box) | 174/133/90 | 170/125/79 | 175/133/90 | +1/+0/+0 | yes |
| cloud (all cloud px) | 205/174/157 | 135/76/41 | 202/173/157 | -3/-1/+0 | yes |
| tree_crown (old plain box, mixed objects) | 42/108/5 | 24/65/15 | 42/106/15 | +0/-2/+10 | yes |
| house_wall (old plain box, mixed objects) | 128/74/0 | 81/70/25 | 88/106/26 | -40/+32/+26 | no |
| STRIPE std | 1.8 | 2.3 | 2.3 | | yes |

## Night 360x640 (target ≈ 80% of Mac r3 night, cool hue, not brown)

| point | Mac r3 | prev | now | luma ratio vs r3 | hue° | check |
|---|---|---|---|---|---|---|
| tree | 5/22/14 | 3/11/7 | 4/17/11 | 0.78 | 152 | cool |
| house wall | 30/42/69 | 15/21/35 | 24/33/54 | 0.79 | 222 | cool |
| cloud | 26/29/42 | 12/14/19 | 21/23/34 | 0.80 | 231 | cool |
| far_water | 106/58/48 | 14/36/55 | 14/36/55 | 0.48 | 208 | unchanged |
| mid_water | 91/51/43 | 11/32/54 | 11/32/54 | 0.49 | 211 | unchanged |
| mid_water_R | 90/50/40 | 10/30/53 | 10/30/53 | 0.47 | 212 | unchanged |
| under_bridge | 97/56/46 | 13/36/57 | 13/36/57 | 0.51 | 209 | unchanged |
| near_mid_water | 87/54/46 | 12/40/64 | 12/40/64 | 0.59 | 208 | unchanged |
| near_water_bottom | 33/50/66 | 13/48/78 | 13/48/78 | 0.91 | 207 | unchanged |
| near_water_L | 19/47/69 | 13/48/76 | 13/48/76 | 1.00 | 207 | unchanged |
| bridge_stone_deck | 20/28/44 | 11/14/23 | 11/14/23 | 0.51 | 225 | unchanged |
| bridge_stone_left | 22/32/54 | 12/16/27 | 12/16/27 | 0.50 | 223 | unchanged |
| bridge_rail_top | 30/43/71 | 15/20/33 | 15/20/33 | 0.47 | 223 | unchanged |
| grass_near | 13/47/17 | 11/40/14 | 11/40/14 | 0.85 | 126 | unchanged |
| far_hills | 16/31/79 | 13/26/66 | 13/26/66 | 0.84 | 225 | unchanged |
| mtn_snow | 20/39/94 | 16/30/73 | 16/30/73 | 0.77 | 225 | unchanged |

Water + bridge pixels (LK_lake, LK_shore_foam, LK_bridge, LK_bridge_steps), both poses, day and night: max |now - prev| = 0.
