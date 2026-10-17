# Lakeside ambience: lake water + wind chimes (Voice Bot)

Entering the lakeside now swaps the sea waves for a self-made lake water and wind-chime loop. Leaving the lakeside brings the waves back. The BGM stays the island BGM.

- **Commit:** `f3fce67261e417de4df11954df4a898414751738` (tree `ce3dd501b51ffe0990f3d72dc94dc7e6841b322f`)
- **Branch:** `voice/build05-lakeside-ambience`, on top of 4728814 (the journey wiring). Not pushed.
- **Files here:**
  - patch and incremental bundle (4728814..branch);
  - `amb_lake_loop.mp3`;
  - `synth_lake_amb.py`, `synth_meta.json` (seed and chime strike list);
  - `seam.py`, `seam.json`;
  - `lake_amb_waveform_spectrogram.png`;
  - `suite.txt`;
  - `SHA256SUMS`.

## The sound
- **Fully synthesized in numpy, no outside samples.** It's deterministic (seed 20261017, PYTHONHASHSEED=0).
- **Layers:**
  - lake lapping: band-shaped noise from 80 Hz to 1.4 kHz with slow, irregular swells;
  - 26 small water plips;
  - a very soft wind bed;
  - 14 soft chime strikes in 4 gust clusters. Notes are from C-major pentatonic C6–C7, with tubular-chime partials (×1, 2.76, 5.4, 8.93) and a 2–3.2 s decay.
- **Seamless by construction:**
  - every noise layer is shaped in the frequency domain over the loop length;
  - every swell has a whole number of cycles per loop;
  - chime tails wrap around the end.
- **Chimes near the seam:** no strike starts in the first 0.6 s or the last 4 s, so no fresh chime sits on the loop boundary.

## Encoding and size
- **Format:** mono, **24 kHz**, 24 kbps CBR (MPEG-2 Layer III). **57,836 bytes**, under the 60 KB limit.
- **Why not 32 kHz:** at 32 kHz MP3 can't go below 32 kbps, so a ≥19 s loop wouldn't fit in 60 KB. At 24 kHz, 20 kbps isn't a valid MPEG-2 rate (it becomes 16), and 24 kbps for 23 s is 70 KB. So the loop is **19.0 s**.
- **File layout:** 19.0 s circular loop, plus a 0.15 s copy of its own start at the end.

## Loudness
**−22.4 LUFS integrated.** The existing ambience: amb_waves_loop −20.9, amb_wind_soft −23.4, amb_wind_strong −24.9.

Playback volume is 0.55, the same as the waves (WAVES_MAX_VOL), so the lake bed sits about 1.5 dB under the sea. Sample peak is 0.58.

## Loop seam (`seam.json`)
- **Encoder delay:** LAME adds 1105 samples (0.046 s) at the head. The decoder trims it in gapless mode, but players that don't trim gaps play it as silence.
- **Cross-loop:** the player starts the second copy when the first reaches the 19.0 s period. The 150 ms crossfade begins once the second copy is past the encoder delay.
  - Both copies then play identical audio, so the crossfade is linear (equal-gain). Equal-power would add +3 dB on correlated audio. This replaces the "blend the last 70 ms" step from the earlier BGM fixes.
  - The overlap mismatch is −17.5 dB, which is just MP3 quantisation.
- **Measured level jump at the seam with cross-loop:**

  | Window | At the seam (max) | Rest of the loop |
  |---|---|---|
  | 50 ms | 2.6 dB | median 0.8, p95 2.5 |
  | 20 ms | 4.5 dB | median 1.0, p95 3.5 |

  The seam figure is the largest of about 15 points scanned, so it sits inside the natural texture of the noise.
- **Gapless circular wrap at 19.0 s:** largest 5 ms step is 3.1 dB, against p99.5 of 5.4 for the whole loop.
- **Fallback without cross-loop:** a plain platform loop has a 56 dB drop at the seam, because of the encoder delay plus padding gap. That's the same gap the waves loop already has. The cross-loop avoids it; if the second copy fails to start within 0.6 s, playback falls back to the platform loop.

## Wiring
**`LakeAmbienceCore.ts` (pure logic, tested)**
- `lakeAmbienceWanted` is true for:
  - state `lakeside`;
  - `region-travel` toward lakeside during the `arrival` phase (the last walk);
  - a lakeside board (region `lake` or stage `r04-lake-*`);
  - its level-loading.
- **Fades:** in over 1.2 s, out over 0.8 s.
- **Gating:** the same `canPlayAmbience()` gate as the other ambience (mute, background, no gesture yet → 0 at once and pause; on returning it fades back in).
- **Volume slider:** follows the A1c rule (`ambienceBedGain`).

**`LakeAmbience.ts` (component on the GameAudio node)**
- It reads the same flow and board info as SceneMusic.
- On first need it loads `region_lakeside/audio/amb_lake_loop`.
- It writes `AmbienceAudio.lakeActive`.
- It registers with the ambience mount and quiet hooks, so backgrounding and exit restarts silence it at once.

**`AmbienceAudio.ts`**
- While `lakeActive` is set, the waves take the same path as "world not visible": they fade out with their usual smoothing and no gulls play. When it clears, the waves fade back in.
- The gate log shows `lakeside`.

**BGM:** unchanged. `SceneMusic` still plays the island BGM.

**Logs:**
- `[QF_AUDIO]` events: `lake-enter`, `lake-exit`, `lake-load`, `lake-loaded`, `lake-play`, `lake-pause`, `lake-xloop`, `lake-xloop-failed`, `lake-load-failed`.
- A load failure also logs `console.error('[QF_LAKE] lake ambience … failed (sea waves stay on)')`. The waves are only suppressed once the lake clip is ready, so a failure never leaves silence. It is logged, not silent.

**Code safety:** no spreads of Set or Map. The ES5 transpile check produced no spread helpers.

## Loading
- **Where the asset lives:** in the `region_lakeside` subpackage (wx subpackage, not remote). The main package is unchanged.
- **When it loads:** the journey and the board background have already loaded that bundle when it's needed, so loading the clip is a small local load.
- **Subpackage size:** about +58 KB; the region_lakeside folder is now 1,320,215 bytes including metas.

## Tests
- **New `tools/test_lake_ambience.cjs`: 6/6 pass.** It covers:
  - when the lake sound is wanted;
  - entry → lake plays and waves are suppressed; exit → lake pauses and waves are released;
  - mute/background/slider;
  - the cross-loop: hand-over at equal gain, and fallback to the platform loop;
  - the source wiring, including no Set/Map spreads and BGM unchanged;
  - the asset: ≤60 KB, MPEG-2, 24 kHz, mono, with meta.
- **Suite: 52/57.** The only failures are the 5 known ones: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, and navigation-guard BLOCKED_BROWSER.

## Risks
- **Untested on a device.** WeChat's `currentTime` for the cross-loop and the 0.6 s fallback have not been checked on the Mac or a phone.
- **Not yet tuned by ear.** The chime and lapping balance needs a listen from Funning or Grok Bot.
- **Two extra audio players.** The component holds two AudioSources; they stay paused when not at the lakeside.
- **Arrival timing assumption.** The lake sound starts at the journey's `arrival` phase, about the last 11.5 m of the walk. Before that, the waves keep playing over the bridge.
