# r5 sail segment audio — RESULT (Voice Bot, 2026-10-18)

Branch `voice/r5-sail-audio`, based on `gbt/r5-integrated-b07-wip` @ bc81575. Sail camera and duration are unchanged
(sailBeats total 24.6 s ≤ 30.5 s; no TransportLeg / SailRide / camera code touched).

## What ships
| file (bundles/transport_sail/audio_sail/) | cue (TransitAudioHooks) | length | bytes | level | game vol |
|---|---|---|---|---|---|
| sfx_sail_board.mp3 | `sail-board` (S-b, stepping aboard): soft pier-wood creak + water lapping | 3.45 s | 20,915 | −26.5 LUFS | 0.7 |
| sfx_sail_unfurl.mp3 | `sail-unfurl` (S-c, leaving the shore): sail luffs a few times and fills, bow wave rises | 4.65 s | 28,125 | −25.4 LUFS | 0.7 |
| amb_sail_cruise.mp3 | `sail-cruise-loop-start` / `-stop` (S-d): calm bow wave + distant sail/lines, 16 s seamless loop | 16.04 s | 96,461 | −26.9 LUFS | 0.45 |
| sfx_sail_dock.mp3 | `sail-dock` (S-e, decel 2.2 s): water slosh, then a muffled hull/pier creak at +2.1 s (≈ end of decel), settling | 4.44 s | 26,871 | −25.5 LUFS | 0.7 |

Total 172,372 B (mono 44.1 kHz CBR 48 kbps). transport_sail source bytes go from 206,639 B to ≈ 379,011 B. The guarded
WeChat package (20,286,150 B of the 24,641,536 B cap on the baseline) grows by ≈ 172 KB, before Cocos packing. This was not
measured with a real Cocos build.

Sources: CC0 1.0 Freesound field recordings (Pfannkuchn 360630, canoeCG 460061, maryhelena.clark 554439, Filipe Chagas
91912, kyles 450241), credited in `docs/audio-credits.md`. Style: everything is low-passed at 1.8–3.2 kHz, the creak and
cloth peaks are smoothed, onsets are rounded, and each clip ends on its natural decay plus a 0.9–1.2 s raised-cosine
fade-out. There are no hard cuts. Rebuild script: `tools/audio/sail/build_sail_audio.py`. The source FLACs live on the box
in /workspace/vbr5/sail/src and are not in the repo.

## Mix against the v2 sail BGM / sea bed
voice/v2-scene-audio (cc281de0) adds `transport_sail/audio_amb/bgm_sail.mp3` (−17.4 LUFS, × music slider 0.4) and
`audio_amb/amb_sea_open_loop.mp3` (−23.3 LUFS, × 0.8). My files live in a separate folder, `audio_sail/`, with new uuids.
I grep-checked the uuids against that branch: there are no clashes, and nothing under `audio_amb/` is touched. Game volumes
were set so that the sail SFX sit about 4–8 dB under that mix. The cruise bed is only near-hull detail under the open-sea
bed. Preview loudness: SFX only −30.1 LUFS, BGM+bed only −26.4, everything together −25.0.

## Code
- `scripts/audio/SailAudioCore.ts` is pure logic with no cc dependency. It runs one voice per cue on its own AudioSource
  and keeps a sail clock that only advances while the ride is not hidden, the same rule SailRide uses for its `t`.
  - **Hidden:** voices are paused, never stopped, and their position is kept.
  - **Shown:** each voice resumes at (clock − its cue time); it seeks only if it is more than 50 ms off.
  - **Muted / SFX off while the ride runs:** the clock keeps going. On unmute a voice jumps to its timeline position, or
    stays silent if that position is past its end.
  - The `sail-cruise-loop-start` that the hooks re-send on return (region `resume`) does not restart the bed.
  - loop-stop fades the bed over 2.0 s, and `transit-skip` fades everything over 0.4 s.
  - Every restart ramps in over 0.12 s, so there are no clicks.
- `scripts/audio/SailAudio.ts` is the component, mounted on the GameAudio node the same way LakeAmbience is. It subscribes
  with `onTransitCue` and loads the clips from transport_sail on the first sail cue.
  - Sound is allowed only when `GameAudio.canPlayAmbience()` is true and `isSfxMuted()` is false. The clock runs while
    `!transitHidden()`.
  - GameAudio is untouched, so there are still exactly 3 sfxMuted gates.
- `region/TransitAudioHooks.ts` gets one read-only getter, `transitHidden()`, and its header comment is updated.

## Timeline / timing.json
**There is no timing.json on the baseline (or sail-qa4).** The timeline comes from `sailBeats(sailRoute().length)` in
TransportLeg.ts:
- route 37.16 m
- S-a 0–7.6 node-walk-start
- S-b 7.6–9.6 sail-board
- S-c 9.6–11.6 sail-unfurl
- S-d 11.6–20.6 cruise (loop-stop at 20.6)
- S-e 20.6–22.8 sail-dock
- S-f 22.8–23.8
- S-g 23.8–24.6 node-arrive

The old 5.2 s timing.json exists only on the outdated feat/sailboat-transition-20261015 branch and is not used. The
tripwire in test-journey-background-audio still demands that no timing.json and no other audio_cine track exist.

## Tests
- `tools/journey-integration/test-journey-background-audio.cjs` (extended) **PASS**. The new sail block uses the real
  TransitAudioHooks, SailAudioCore and sailBeats with fake sources:
  - hides mid-board, mid-unfurl, mid-cruise, just after loop-stop and in the dock tail, each resuming at 0.0 ms offset;
  - no stop() on hide, and the bed is never restarted, including on the hooks' 'resume' re-send;
  - mute for 3 s and for 10 s, landing on the timeline;
  - a loop-start swallowed while hidden starts on return;
  - the loop-stop fade has no hard cut, and skip fades;
  - the asset list equals `SAIL_AUDIO.clips`, at most 200 KB.
- `tools/region-nodes/test_transit_background_resume.cjs` PASS, `tools/transitions/test_transit_background.cjs` PASS,
  `tools/transitions/asset-budget.cjs` PASS.
- TypeScript strict check of SailAudio.ts and SailAudioCore.ts against the Cocos 3.8 cc.d.ts: clean.
- Full suite: see "Suite" below.

## Untested
- No device or WeChat playback. Not checked on hardware: mp3 loop seam at 16 s (only reached when the cruise runs longer
  than 16 s; it is 9 s on the current route), real AudioSource.currentTime seek and resume behaviour, the Cocos import of
  the new metas, real package size.
- Levels against the v2 BGM were checked offline only, with an assumed music slider of 0.4 and bed volume 0.8.
- These need someone to listen to them.

## Previews
/workspace/yiqifengle/previews/Voice-bot/r5-sail-audio/:
- `sail_mix_preview.mp3` (sail SFX only, timeline 6.6–27.0 s, 245,490 B)
- `sail_mix_with_v2_bgm_bed_preview.mp3` (+ bgm_sail × 0.4 + sea bed × 0.8, 245,490 B)
- `v2_bgm_bed_only_reference.mp3`
- the four shipped mp3s
- `sail_mix_waveform.png`
- `build_sail_audio.py`

## Suite
run-suite.cjs on the committed branch (Node 20.19.2): 118 passed.
- PASS: journey-background-audio, production-integrity, exit-cine-audio, es5-iterator-spread, transport-sail and
  asset-budget.
- The only non-passing checks also fail or are blocked on the baseline:
  - region-nodes-data and lens-clearance FAIL;
  - legacy-board-ui-pure and reward-background-return are BLOCKED (need Node ≥ 22.6);
  - navigation-guard is BLOCKED (no browser).
- retry-protection, which fails on the baseline, passed in this run.
