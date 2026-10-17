| file | format | sample peak before→after | true peak (4x) before→after | LUFS-I before→after | bytes before→after |
|---|---|---|---|---|---|
| sfx_cheer_1_great.mp3 | 44100 Hz mono 40k | -1.86 → -9.30 | -1.82 → -9.30 | -13.6 → -21.2 | 7932 → 7932 |
| sfx_cheer_2_excellent.mp3 | 44100 Hz mono 40k | -0.16 → -8.60 | -0.16 → -8.38 | -12.8 → -20.7 | 8716 → 8716 |
| sfx_cheer_3_amazing.mp3 | 44100 Hz mono 40k | -2.08 → -9.05 | -2.06 → -9.05 | -12.0 → -19.8 | 8585 → 8585 |
| sfx_cheer_4_unbelievable.mp3 | 44100 Hz mono 40k | -2.15 → -9.12 | -2.14 → -9.06 | -12.0 → -19.5 | 9499 → 9499 |
| sfx_combo_1.mp3 | 44100 Hz mono 64k | -1.71 → -8.43 | -1.70 → -8.42 | -16.0 → -23.0 | 10283 → 10283 |
| sfx_combo_2.mp3 | 44100 Hz mono 64k | -1.69 → -8.68 | -1.61 → -8.50 | -14.3 → -21.3 | 11327 → 11327 |
| sfx_combo_3.mp3 | 44100 Hz mono 64k | -1.60 → -8.45 | -1.60 → -8.44 | -13.5 → -20.5 | 11745 → 11745 |
| sfx_match_normal.mp3 | 44100 Hz mono 64k | -2.18 → -9.42 | -2.11 → -9.13 | -16.4 → -23.4 | 8611 → 8611 |

All other 25 mp3 in e2a03ec are already <= -1.0 dBTP (worst: bgm_skycity -2.72, combo_2 -1.61); only sfx_cheer_2_excellent was over (-0.16 dBTP).

Worst-case level cascade (src/sim.py: bgm_main x0.4 + match + combo_1..3 + cheers, 0.2 s apart, playCheer retire): before **+5.11 dBFS** true peak, after **-1.28 dBFS**.
