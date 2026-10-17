t = seconds from leaveHome (60 fps sim). Error = step (frame GameAudio.play is called) minus plant (sole reaches 4 mm, interpolated).

| # | plant t (s) | foot | state / clip | surface (sole) | step t (s) | step surface | error (ms) | +25 ms priming |
|---|---|---|---|---|---|---|---|---|
| 1 | 2.531 | L | turning-out / walk_turn_90_bodyL | wood | 2.517 | wood | -14.1 | +10.9 |
| 2 | 3.315 | L | walking-out / walk_start | wood | 3.300 | wood | -14.8 | +10.2 |
| 3 | 4.102 | R | walking-out / walk_start | rug | 4.083 | rug | -18.8 | +6.3 |
| 4 | 4.704 | L | walking-out / walk_loop | rug | 4.683 | rug | -20.4 | +4.7 |
| 5 | 5.233 | R | walking-out / walk_loop | rug | 5.217 | rug | -16.6 | +8.5 |
| 6 | 5.789 | L | walking-out / walk_loop | wood | 5.767 | wood | -22.5 | +2.5 |
| 7 | 6.319 | R | walking-out / walk_loop | wood | 6.300 | wood | -19.2 | +5.9 |
| 8 | 6.875 | L | walking-out / walk_loop | wood | 6.850 | wood | -24.7 | +0.4 |
| 9 | 7.483 | R | walking-out / walk_loop | wood | 7.467 | wood | -16.0 | +9.1 |
| 10 | 8.248 | L | walking-out / walk_stop_bodyL | wood | 8.233 | wood | -14.8 | +10.2 |
| 11 | 8.650 | R | walking-out / walk_stop_bodyL | wood | 8.633 | wood | -16.3 | +8.8 |
| 12 | 11.315 | L | crossing-out / walk_start | stone | 11.300 | stone | -14.8 | +10.2 |
| 13 | 12.102 | R | crossing-out / walk_start | stone | 12.083 | stone | -18.8 | +6.3 |
| 14 | 12.704 | L | crossing-out / walk_loop | path | 12.683 | path | -21.0 | +4.1 |
| 15 | 13.248 | R | crossing-out / walk_loop | path | 13.233 | path | -14.9 | +10.1 |
| 16 | 13.833 | L | crossing-out / walk_loop | path | 13.817 | path | -15.9 | +9.1 |
| 17 | 14.397 | R | crossing-out / walk_loop | grass | 14.383 | grass | -13.9 | +11.1 |
| 18 | 14.990 | L | crossing-out / walk_loop | grass | 14.967 | grass | -23.5 | +1.6 |
| 19 | 15.555 | R | crossing-out / walk_loop | grass | 15.533 | grass | -21.7 | +3.3 |
| 20 | 16.147 | L | crossing-out / walk_loop | grass | 16.133 | grass | -13.9 | +11.1 |
| 21 | 16.712 | R | crossing-out / walk_loop | grass | 16.700 | grass | -12.3 | +12.7 |
| 22 | 17.305 | L | crossing-out / walk_loop | grass | 17.283 | grass | -21.3 | +3.8 |
| 23 | 17.952 | R | crossing-out / walk_loop | path | 17.933 | path | -18.6 | +6.5 |
| 24 | 18.832 | L | crossing-out / walk_stop_bodyL | path | 18.817 | path | -14.9 | +10.2 |
| 25 | 19.294 | R | crossing-out / walk_stop_bodyL | path | 19.283 | path | -10.2 | +14.9 |

Stats: {"fps": 60, "plants": 25, "steps": 25, "matched": 25, "missing": 0, "extra": 0, "surfaceMismatch": 0, "errMinMs": -24.68568403401772, "errMaxMs": -10.169261282996445, "errMeanMs": -17.35677692458671, "untrimmedWithin40": 25, "errMaxAbsUntrimmedMs": 14.887428059407185}
