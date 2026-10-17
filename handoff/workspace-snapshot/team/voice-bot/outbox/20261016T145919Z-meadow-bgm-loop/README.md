# meadow bgm loop seam — voice/build05-meadow-bgm-loop (on ce0e4ff, not pushed)
Commit 700ec499ca42cd13919665907bb5c2bbfeebca0a, tree bd03c131571566c30a4b40d83d66f50bb5628978.
Patch sha256 528883fdf032b5264b1538c2b5226987fa7a8890e58a84b005be5edb32a01a6a. bgm_meadow.mp3 sha256 f6fd8bac1abc4f0ca9a7ddc5dd6fb22a5761c2ad1b12ba92b240da5290a45fb5. Only the mp3 changed (.meta untouched).

## Method (meas.py)
44.1 kHz decode, mono mix of L and R, 50 ms (2205-sample) RMS windows.
- In-game model: raw (untrimmed) decode; GameAudio starts the partner at T0 = duration-0.045-0.15-0.03 s (container duration 72.672653 s), with a 150 ms equal-power crossfade. Compares [T0-50 ms, T0] with partner [150, 200 ms] (right after the fade ends). This gives 4.33 dB for the current file, vs 4.5 in the earlier skycity report (small model-detail difference).
- Normal decode (gapless, LAME padding trimmed) and raw decode: last 50 ms vs first 50 ms.

## Cause
The music is about 4.3 dB louder in the ~0.3 s before the in-game crossfade than just after the restart. The 48 kbps original has the same 4.4 dB jump, so the 40 kbps re-encode didn't cause it.

## Fix (fix.py)
From the 48 kbps original (3e0bdc3^): a raised-cosine gain ramp from 0 to -2.5 dB over [end-2.0 s, end-0.3 s], held to the end, plus the 70 ms equal-power end->start blend used for skycity. Then libmp3lame 40k CBR, 44100 Hz, stereo, metadata stripped (same as the current file).
Samples 3,203,053 -> 3,203,053; container 72.672653 s unchanged; size 363,615 -> 363,615 B.

## Result
In game 4.33 -> 1.67 dB; normal decode 2.86 -> 0.22; raw 1.08 -> 1.56.
No click: the largest sample-to-sample step in the rendered in-game seam is 0.0214, vs the 99.9th percentile of 0.0242 (before: 0.0319 vs 0.0303).
seam.png: rendered in-game seam ±0.5 s (waveform, 10 ms RMS, spectrogram), before vs after.
before/after_seam6s.mp3: the in-game render, 3 s before T0 plus 3 s after (192k).

## Tests
test_scene_bgm ALL PASS (114). run-suite 32/37, the same 5 known failures as bc418c5/ce0e4ff.
