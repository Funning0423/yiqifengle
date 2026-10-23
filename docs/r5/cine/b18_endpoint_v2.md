# B18 endpoint v4 (implemented on cursor/b18-path-v4-7m-df84)

Path v4, terrain follow, swing-only foot-lock, and the 7 m / short board cameras are in
`LakesideBalloon`, `RegionJourneyAdapter`, and `LakesideCameraLayout`. The 6 m main lens is not shipped.

## End
Root [3.2531, 0.5714, 25.0904], yaw −58°, reached by walking.
y is measured in-engine: ray against LK_terrain, LakesideLiveScene at the origin.
Other ground samples: step-down 0.5754; [3.8,24.3] 0.5652; [4.758,24.508] 0.5657.

## Path (lakeside-local x,z; 0.8 m/s; arcs R = 2 m, turn foot-lock on both)
| # | segment | ends at | heading | centre | length |
|---|---|---|---|---|---|
| S0 | straight (walk_start_stepdown), from step-down [8.7525,25.7099] | [7.9569,25.7935] | −84° | – | 0.8000 |
| A1 | arc, turning right | [6.4423,25.3196] | −84° → −130.75° | [7.7478,23.8045] | 1.6319 |
| S1 | straight | [6.0635,24.9932] | −130.75° | – | 0.5000 |
| A2 | arc, turning left | [3.6982,24.8123] | −130.75° → −58° | [4.7580,26.5084] | 2.5395 |
| S2 | straight (stop) | [3.2531,25.0904] | −58° | – | 0.5249 |

- From the step-down: 5.9962 m.
- From true P0: 6.3562 m (0.36 m before the step-down, per the v3 6.711 figure).
- Stop phase = 0.316 + (6.3562 − 1.6566)/1.00333 = 5.000, which means bodyL, stretch 1.00.
- Lowest root z is 24.508, at the bottom of A2, so the outer foot is at about 24.41 (bank 24.25).

## Cameras (portrait fov 50°) — locked, shipped
- Main, h/w ≥ 2.0 (exactly 2.0 is main): **7 m** P [1.5, 7, 34.5] → T [1, −0.5, 0].
  - The 6 m lens P [2, 6, 33] → T [1, −0.5, 2] is not shipped (360×780 left about a 3 px gap).
- Short, h/w < 2.0: P [2.5, 6.5, 34] → T [−3, −0.5, 0].
- Orbit pitch to her pivot (end y + 1.15), measured from the shipped lenses: main 28.9° (~10.9 m), short 28.1° (~10.1 m). Limit 52°. FreeOrbit's lakeside pitch cap stays 54°; yaw stays unlocked.

## Real renders (qaTools=3); her box x0,y0,x1,y1 against tray bottom and right tool
| size | cam | her box | tray bottom | right tool x | tool y |
|---|---|---|---|---|---|
| 390x844 | M6 | 324,633,374,810 | 588 | 315 | 693–768 |
| 414x896 | M6 | 344,672,397,860 | 614 | 334 | 742–822 |
| 360x780 | M6 | 299,585,345,748 | 573 | 296 | 630–702 (only 3 px horizontal gap) |
| 390x844 | M7 | 336,651,378,798 | 588 | 315 | 693–768 |
| 320x568 | S2 | 281,438,312,546 | 402 | 256 | 424–484 |
| 390x520 | S2 | 305,401,334,500 | 354 | 291 | 376–436 |
| 375x667 | S2 | 329,514,366,641 | 501 | 283 | 523–583 |

Files: previews/运镜bot/r5-b18-board-compose/endpoint_v4_*_c2bc4eb9_qaTools3.png and endpoint_v4_sheet_c2bc4eb9_qaTools3.png.
