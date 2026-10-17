# skycity bgm loop seam — voice/build05-skycity-bgm-loop (not pushed)
Base bc418c560d257421039c3d1cc953aeb937e47636 (ggbot/build05-landing-A-final). Commit ce0e4ff309026463ea474309cdce75c176e1fe8e, tree 6ef49c4e758cbff18ce3c597f116090985f5278e.
Patch 0001-skycity-bgm-loop.patch sha256 f40e2f8b99c57c9633e7a5dbb1765f3400727ce9a914bc19a99ffec76ec9ca6b (applies cleanly with git am on bc418c5).
bgm_skycity.mp3 sha256 1e78794879d20ac80fe32e9a7b553a35bbf4b176548221edf562d1a3569576a2. .meta unchanged.

## Method
ffmpeg decode to f32 44.1 kHz, L+R mono mix. RMS over the last 50 ms vs the first 50 ms (2205 samples each), jump = |dB difference|.
"gapless" = ffmpeg default (LAME priming/padding trimmed); "raw" = -flags2 +skip_manual (untrimmed).
In-game model: GameAudio partner crossfade (start at dur-0.045-0.15-0.03 s, 150 ms equal-power); 50 ms before vs after the fade.
The Mac figures (7.4/2.7/2.0) aren't reproduced exactly with this method; the ranking matches.

## Findings
- The jump is in the music: the last ~200 ms dip to about -34 dBFS vs about -28 at the start. The 48 kbps original has the same 6.0 dB jump, so the 40 kbps re-encode didn't cause it.
- Not encoder padding: about 14 ms lead / 19 ms trail of near-silence, the same in 40 and 48 kbps.
- No click: the seam's largest sample-to-sample step (max |diff|) is 0.0093 before / 0.0164 after, vs 0.0184 for the 99.9th percentile within ±0.5 s; it is 0 in the raw decode. The vertical line on the spectrogram is the seam marker plus the level step, not an impulse.
- In game the seam is already crossfaded (2.4 dB before, 2.3 after). The raw jump only matters for the fallback platform loop.

## Fix
fix.py: from the 48 kbps original, replace the last 70 ms with an equal-power blend into the first 70 ms (cos/sin). Then libmp3lame 40k CBR, 44100 Hz, stereo.
Sample count unchanged (3,175,200 = 72.000 s gapless; container 72.0457 s). Edit is inside the never-audible tail.
Size 360,480 B -> 360,480 B. Jump 6.0 -> 1.4 dB (gapless), 5.6 -> 0.3 dB (raw). See rms.tsv and seam.png.
Trade-off: in the fallback loop only, the first ~70 ms play twice (blended).

## Tests
run-suite 32/37 on both base and new; same 5 known failures (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER). test_scene_bgm ALL PASS (114).

## Follow-up
meadow's in-game crossfade seam measures 4.5 dB (>3).

Audition clips: sky40_seam6s.mp3 (before) and sky_new_seam6s.mp3 (after): last 3 s + first 3 s, 192 kbps.
