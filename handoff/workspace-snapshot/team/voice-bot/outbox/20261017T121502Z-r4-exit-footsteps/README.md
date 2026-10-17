# r4 exit footsteps (Voice Bot)

**Branch:** `voice/build05-r4-exit-footsteps`, HEAD **cfe64292bfd23d187b5a9409e712098e28b259d0**. One commit, local only, not pushed.

**Base:** GGbot `ggbot/build05-r4-ui-fixes` **50a3074**, which is 2c12565 plus his journey background audio resume commit. His bundle `team/ggbot/outbox/20261017T114519Z-r4-ui-audio-resume/` was verified (SHA256SUMS OK, head 50a3074).

The commit was first made on 2c12565 and moved onto 50a3074 with no conflicts.

**Delivery files:**
- `patches/0001-*.patch`: `git format-patch 50a3074..cfe6429`.
- `voice-build05-r4-exit-footsteps.bundle`: `50a3074..voice/build05-r4-exit-footsteps`. It needs 50a3074, and `git bundle verify` reports it okay.

## Funning's report and its cause

**Report (desktop build 09a1b8e):** no footsteps while she walks in the home room. After she leaves the room, steps start suddenly, sharp and loud.

**Cause:** the only footsteps were baked into `region_island/audio_cine/sfx_exit_outbound.mp3` (8b22546, re-encoded in A1 f57b8d2).
- That track starts on `crossing-out`, at the doorway. Nothing plays during the room walk (`turning-out` / `walking-out`).
- The steps were laid on a fixed 0.56 s grid from 0.08 s of the track (`steps.json`). That grid is not tied to her feet.
- The steps set the file's normalisation peak, so they were the loudest part of the file:
  - sample peak −3.4 dBFS;
  - 400 ms momentary loudness only −0.5 to +4.6 dB under BGM + wind + waves;
  - a band-passed 400–4000 Hz crunch with a fast attack, which is why they sound sharp.

## What changed (option 1: steps synced to the animation)

**1. Foot-plant data, derived offline from the shipped assets**

`tools/exit-footsteps/derive_footsteps.cjs` writes `scripts/audio/FootstepData.ts`. A test fails if that file is stale.

- **Source:** the character GLB `region_island/character/chr_b_r5g2_…grokbot2.glb` (sha bb37efb5…). FK of every clip at 480 Hz, using `tools/walk-driver/glb_rig.cjs`, on the shoe-sole vertices of foot.L and foot.R.
- **Plant rule:** the first sample where the sole is ≤ 4 mm above the root plane, after a lift of ≥ 10 mm. The data stores the plant's clip time and the sole contact point in the model frame.
- **Clips covered:** walk_loop, walk_start, walk_stop_bodyL/R, walk_turn_90_bodyL/R, walk_turn_180, walk_turn_180_bodyR.
- **Pivot shuffles:** lifts under 10 mm (for example the 7 mm R pivot in the turn) are not steps.
- **Settle steps now sound.** The stop clip's second foot, which closes her stance, gets a step. The old `anim_meta` foot events had no event there.
- **Surface map:** `tools/exit-footsteps/ground_map_blender.py` (Blender 5.2.2) builds a 0.1 m grid from the shipped world GLB `static_seat_preview/room/room_no_original_chair.glb` (sha f62e2832…). It samples the palette colour under each cell. Classes:
  - W: wood plank floor;
  - R: the striped rug, from the room props;
  - S: the cream door sill and the lighthouse doorstep slab;
  - P: the sand-coloured winding path;
  - G: grass, in the bend where her route cuts across the grass.

**2. FootstepCore.ts (engine-free)**

- **Tracker:** observes the stand-in's motion clock (`clock.base`: clip, abs) once per frame, read-only. It fires every plant whose clip time was crossed, plus `STEP_LEAD_S` = 25 ms.
  - The lead centres the error so that it stays within 40 ms both on decoders that trim the mp3 priming and on those that do not.
  - Clip switches are handled. After a reset, nothing is fired as a backlog.
  - The same foot is deduplicated within 0.25 s.
- **Frozen code is untouched:** `FlowReferenceStandin` (controller-integrity passes), `CharacterMotion.ts` and `anim_meta.json`.
- **Surface:** read from the map under the planted sole, which is the root position plus the plant's sole offset rotated by yaw.
- **Variants:** 4 per surface. The same file never plays twice in a row, and each step gets ±1.5 dB of random volume.

**3. FootstepAudio.ts and its wiring**

- `WorldIntegrationBoot` creates it right after it sets up the stand-in. This is outside the frozen section, inside try/catch, and the world never depends on it.
- It is fed every world state next to GameAudio and ticked in `Boot.lateUpdate`, after `WorldFlowComponent.update` has advanced her.
- It loads `region_island/audio_steps` on `home`, before she stands up.
- It plays through `GameAudio.play`, so mute, 设置「音效」 off, background and audio interruptions all drop steps. Nothing is queued and nothing bursts on return.
- Steps are active from `standing` to `island` on the exit and from `walking-home` to `sitting` on the return. They do not play on region journeys or in levels.
- GameAudio itself only gains the 20 step names in `SfxName`, plus `adoptClips()` and `hasClip()`. It does not import the footstep modules, so the existing GameAudio harness tests are unaffected. No new `sfxMuted` gate was added (the count stays 3).

**4. Assets (free)**

- 20 one-shots, `step_{wood,rug,stone,path,grass}_{1..4}.mp3`, **synthesised in code** (`tools/exit-footsteps/synth_footsteps.py`). No samples are used, so no licence applies; credited in `docs/audio-credits.md`.
- Pitch is baked into each variant (0.94 / 0.98 / 1.02 / 1.06), because Cocos AudioSource has no pitch control.
- Each file is low-passed at 4.5 kHz (8th order), has a 3 ms soft attack, and is peak-normalised to −6 dBFS.
- Encoding: 44.1 kHz mono 32 kbps mp3.
- Character per surface:
  - wood: soft plank thump with a 300–1400 Hz body, so it is audible on phone speakers;
  - rug: muffled;
  - stone: soft tap;
  - path: fine sandy grit;
  - grass: swish and rustle.

**5. Exit track**

- `sfx_exit_outbound.mp3` was regenerated by `tools/exit-footsteps/synth_exit.py`, the A1 script with the baked steps removed.
- It keeps the same seed, scale and encoding (32 kHz 56k mono, 140,660 B). Running it with `--with-steps` reproduces the shipped A1 file byte for byte.
- What remains is the camera whoosh and a near-silent air bed (−60.5 LUFS).
- The track is kept because its start also proves audio for the wind/waves gate.

## Alignment (alignment/)

**Method:**
- `tools/exit-footsteps/exit_sim.cjs` runs the real `WorldFlow.leaveHome` / `returnHome` with FirstsliceRoutes in motion mode, the real frozen `FlowReferenceStandin` and `CharacterMotion`, and the shipped GLB with its anim_meta.
- Every frame it feeds the REAL tracker exactly like `lateUpdate`.
- The ground truth is the posed GLB soles: sole height above the controller root drops to ≤ 4 mm after a ≥ 10 mm lift, with the time interpolated between frames.
- Error = step time (the frame on which `GameAudio.play` is called) minus plant time.

**Exit, 60 fps** (`exit_alignment.md` / `.csv`; t is seconds from 出门):
- 25 plants, 25 steps, 25 matched; 0 missing, 0 extra, 0 wrong surfaces.
- Error −24.7 … −10.2 ms (mean −17.4).
- With a decoder that keeps the 25 ms LAME priming: +0.4 … +14.9 ms.
- The first step is the turn's left foot at 2.53 s, in the room on wood.

| zone | steps | surfaces |
|---|---|---|
| room (turn, walk, stop at the door) | 11 | wood, wood, rug, rug, rug, wood ×6 |
| outside (`crossing-out`) | 14 | stone ×2 (door slab), path ×3, grass ×6 (bend), path ×3 |

**Exit + return** (`exit_and_return_alignment.*`, `stats_other_fps.txt`): 52/52 plants matched at every frame rate, with 0 extra and 0 wrong surfaces.

| fps | error range (ms) | within 40 ms with +25 ms priming |
|---|---|---|
| 30 | −25.6 … +36.2 | 50/52 |
| 45 | −25.7 … +25.3 | 51/52 |
| 60 | −24.7 … +19.8 | 51/52 |
| 60, ±30 % frame jitter | −25.0 … +18.1 | 51/52 |
| 120 | −24.4 … +11.7 | 52/52 |

- The one late outlier is the return turn `walk_turn_180_bodyR` (R foot at 34.65 s). In flow, the foot lands about 20 ms before the clip-derived time.
- The ≤ 40 ms requirement is enforced in the test on the trigger. The priming column is reported, not required.

## Offline preview (preview/)

- `exit_preview_mix.wav` / `.mp3`: 0–32.8 s from 出门 at game levels:
  - BGM bgm_main ×0.4 with the wind duck;
  - wind soft and strong loops;
  - waves (outdoor/floor/duck formulas);
  - the new exit track from `crossing-out`;
  - the steps at `STEP_GAIN` ±1.5 dB, on the simulated step times.
  - Gulls are not included.
- `exit_preview_OLD_baked_steps.wav`: the same bed with the old A1 track, for comparison.
- `exit_preview_steps_only.wav`: steps alone, **+12 dB** so you can hear them.
- `exit_preview_spectrogram.png`: mix spectrogram, steps-only spectrogram (4.5 kHz line), and momentary loudness of bed / steps / mix with step markers coloured by surface.
- `loudness.json` (K-weighted BS.1770, 400 ms momentary):
  - Steps are **7.7–14.7 dB under the bed** (room mean 10.9 dB, outside mean 12.1 dB). The old baked steps were −0.5 … 4.6 dB under.
  - Integrated: mix −23.3 LUFS, steps alone −36.3 LUFS.
  - Sample peak: mix −7.0 dBFS (old −1.3 dBFS); steps −13.9 dBFS.
- `ebur128_ffmpeg.txt`: ffmpeg check of the same.
- `step_files_spectrum.txt`, per file:
  - spectral centroid: wood/rug about 340–430 Hz, stone about 1.0–1.3 kHz, path/grass about 1.9–2.1 kHz;
  - energy above 6 kHz: ≤ −45 dB;
  - size: 1,271–1,584 B.

## Sizes

- **Subpackage region_island:** 20 step mp3 files, +27,504 B. The exit track is unchanged in size (140,660 B).
- **Main package scripts:** FootstepData + FootstepCore + FootstepAudio come to about 14.6 KB of ES5 before minification (data 3.5 KB). GameAudio adds a few hundred bytes. The total is still far below the 24,641,536 B gate.

## Tests

- **New `exit-footsteps`** (`tools/exit-footsteps/test_footsteps.cjs`, in run-suite), 17 cases, all passing (`exit-footsteps.test.log`):
  - data up to date;
  - alignment at 60 fps for the exit, and at 30/45/60-jitter/120 fps for exit + return;
  - room steps from the first plant;
  - surface zones in the right order;
  - tracker, picker and ground unit checks;
  - mock-Cocos FootstepAudio + GameAudio: loading, one step per plant, mute, sfx mute, background (none queued, no burst), state gating, Boot wiring, controller-integrity;
  - assets: 20 mono 44.1 kHz files ≤ 2 KB each, ≤ 32 KB total; exit-track sha pinned.
- **Full suite** (`suite.log`, Node 20.19.2, `QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript`): **81/86 PASS**. Only the known 5 fail: production-integrity (bgm_main hash; the fix 886a340 is on the r4-tests line), legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER. GGbot's 50a3074 run was 80/85 with the same 5.
- `exit-cine-audio` still passes (9 cases), and GGbot's `journey-background-audio` passes.
- The legacy GameAudio harness tests outside the suite fail identically before and after this change (checked against an archived copy of the 50a3074 tree): `test_audio_lifecycle`, `a5`, `ui_gestures`, `destroy_parent`, `audio_unlock`.

## Recording on the Mac with sound on, for 运镜bot

The box cannot run Cocos. Funning's Mac is low on disk: record short clips only, and delete the local files after uploading them.

1. Build `cfe6429`, or the r4 integration that contains it, with `tools/build-guard/build-wechat-guarded.sh wechat`. Open it in WeChat DevTools at 390x844.
   - Settings: sound on; Mac volume about 50 %; in-game music slider at its default; 设置「音效」 on.
2. In the DevTools console, before 出门, run `globalThis.__worldFlowLog=true`. Each step then logs a line `[QF_AUDIO] {"event":"step","t":<ms>,"clip":…,"bone":"foot.L|R","surface":"wood|rug|stone|path|grass","name":"step_…","loaded":true,…}`.
3. Start the screen recording with system audio. Use macOS Cmd+Shift+5 → Options → audio source, or whatever capture path you already used for the r4 recordings. Record at 60 fps if you can, at 720p.
4. **Clip A, exit, about 35 s.** Tap 出门 and record until she settles on the island.
   - Steps should start with the turn as she rises and turns, at about 2.5 s; the first 2 steps are on wood.
   - Then 3 softer, muffled steps on the rug, wood steps up to the door, and 2 settle steps at the door.
   - Outside: 2 stone taps on the doorstep slab, path grit, grass where the route crosses the bend, path, and 2 settle steps.
   - No sudden loud steps after the door. Steps stay below the music and the waves.
5. **Clip B, return, about 25 s.** Tap 回家. Steps should come on path, the slab, then wood and rug inside, then the stop and the turn before sitting.
6. **Clip C, gating, short.**
   - Mid-walk, turn 设置「音效」 off: steps stop. Turn it back on: steps resume with no burst.
   - Background the app mid-walk for a few seconds and come back: no steps while away, no burst on return.
7. Upload clips A–C plus the console log (the `[QF_AUDIO] step` lines) to your outbox. Delete the local recordings from the Mac.
8. **What I will measure from the clips:**
   - On the 60 fps video, the offset between the frame where the heel touches and the audio onset. Expected: −25 … +15 ms plus the platform output latency.
   - The surface per step.
   - Loudness against BGM and waves.
   - If the steps are consistently late on the device, the fix is to raise `STEP_LEAD_S` in `FootstepCore.ts`; it is one constant.

## Open items

- **Device latency and decoder priming are unmeasured.** WeChat/iOS output latency is unknown, and so is whether the mp3 LAME gapless header is honoured (+25 ms if it is not). The recording above decides this; the lead is a single constant.
- **Path surface:** it is the sandy winding-path class (P). The task said stone or grass outside. The real ground on the route is a door slab (stone), then a sand path, then grass in the bend, so the path gets a fine grit sound. If a stone path was meant, map P to stone with one line in `FootstepAudio` / `STEP_GAIN`.
- **Ground map:** a few spurious rug cells at the west edge of the room, off her route. Not hit.
- **Step loudness:** 7.7–14.7 dB under the bed in the model. Funning may want them a little louder or softer; `STEP_GAIN` is per surface.
- **Region journeys and lakeside walks are not covered.** Other grounds, other maps. Steps are off there.
- **GGbot's integration:** the commit is on his 50a3074. If he stacks more on `build05-r4-ui-fixes`, it should rebase cleanly. It only touches `GameAudio` at the type list, in 2 new methods and in the EXIT_CINE comment; plus Boot (4 small hunks) and run-suite (1 line).
- **Creator import not run:** new metas were hand-written in the existing formats (TS 4.0.24, audio-clip 1.0.0, directory 1.2.0, fresh uuids). Creator will confirm them on the first import.
