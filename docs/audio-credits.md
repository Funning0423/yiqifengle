# Audio credits / provenance

Only third-party sources are listed here. All entries are CC0 1.0 (public domain dedication): attribution is not legally
required; recorded for provenance.

## Seagulls (gull v6, Voice bot, 2026-10-11)

Files: `creator-build-project/assets/resources/audio_sfx/sfx_amb_gull_1.mp3`, `_2.mp3`, `_3.mp3` (mono 44.1 kHz, CBR 32 kbps,
~3.3 s each incl. reverb tail). Downloaded as Freesound HQ mp3 previews (cdn.freesound.org), then edited.

| file | length | source | author | licence | excerpt / processing |
|---|---|---|---|---|---|
| sfx_amb_gull_1.mp3 | 3.40 s | "sea gulls.wav" (Whitby, UK) https://freesound.org/people/Snapper4298/sounds/166703/ | Snapper4298 | CC0 1.0 | source 2.50–4.30 s |
| sfx_amb_gull_2.mp3 | 3.29 s | "GullsChatter.wav" (Brighton Beach, NYC) https://freesound.org/people/LouisDirector/sounds/331685/ | LouisDirector | CC0 1.0 | source 5.30–7.00 s, afftdn nr 8 |
| sfx_amb_gull_3.mp3 | 3.24 s | "Gulls at Moelfre.wav" (herring gulls, Anglesey) https://freesound.org/people/achats57/sounds/372213/ | achats57 | CC0 1.0 | source 12.30–14.00 s, afftdn nr 14, HP 550 Hz |

Processing (Voice bot): no time-stretch or pitch-shift of the calls; quiet dips between notes are padded with 90–170 ms of
their own background (clip 1 +31 %, clip 2 +33 %, clip 3 +29 % vs source). Synthesized space: cliff echoes 320 ms / -9 dB
(LP 2.8 kHz) and 700 ms / -12 dB (LP 2.0 kHz); sparse seaside reverb RT60 2.0 s below 4 kHz / 0.5 s above, pre-delay
40 ms, wet -10 dB RMS; 1.0 s tail appended, fade-in 60 ms, fade-out 800 ms. Filtering: 2x HP 400 Hz (clip 3: 550 Hz),
2x LP 6.5 kHz; gain to ≈ -18.5 LUFS, limiter -3.6 dBFS. In game: AmbienceAudio GULL_VOL 0.6.
Rebuild script (box, not in repo): /workspace/gullv3/v6.py + v6.json.

## UI taps: bag / journey book (ui-soft-v2, Voice bot, 2026-10-11)

Source pack: Kenney "RPG Audio" by Kenney Vleugels (Kenney.nl), https://kenney.nl/assets/rpg-audio
(kenney_rpg-audio.zip, sha256 6dbeaf85…f38b; copy kept on the box in previews/Voice-bot/ui-soft-v2/src/), licence CC0 1.0 (pack License.txt: "You may use these assets in personal and commercial projects.
Credit ... would be nice but is not mandatory"). Files are mono 44.1 kHz CBR 48 kbps.

| file | length | source (pack Audio/) | author | licence | processing |
|---|---|---|---|---|---|
| sfx_ui_bag.mp3 | 0.62 s | cloth1.ogg | Kenney | CC0 1.0 | 4-pole LP 3.2 kHz, HP 90 Hz, 25 ms rounded onset |
| sfx_ui_book.mp3 | 0.62 s | bookOpen.ogg + bookPlace2.ogg (placed at +70 ms, -5 dB) | Kenney | CC0 1.0 | LP 3.0 / 2.5 kHz, HP 100 / 80 Hz, 12 / 15 ms rounded onsets |

Common processing (Voice bot): only true leading silence trimmed (4 ms rounded entry); light dark room (synthetic IR,
RT 0.32 s bag / 0.40 s book, LP 1.8 kHz, wet 10 % / 15 %); natural decay plus 220 / 250 ms raised-cosine fade-out, no
hard cut; level ≈ -21 LUFS (max 100 ms K-weighted), peaks -5.1 / -7.8 dBFS. In game: UI_TAP_VOLUME 1 (file level = what Funning approved).
Rebuild script (box, not in repo): /workspace/yiqifengle/previews/Voice-bot/ui-soft-v2/make.py (candidates bag_1, book_2).

## UI taps: signpost / click / confirm / back (ui-soft-v3, Voice bot, 2026-10-11)

Source packs (both by Kenney Vleugels, Kenney.nl, licence CC0 1.0, pack License.txt "Creative Commons Zero, CC0"):
Kenney "Impact Sounds" https://kenney.nl/assets/impact-sounds (kenney_impact-sounds.zip, sha256 029d734a…77f8) and
Kenney "Interface Sounds" https://kenney.nl/assets/interface-sounds (kenney_interface-sounds.zip, sha256 f2193d07…1232; not used
by the picked files). Copies kept on the box in previews/Voice-bot/ui-soft-v3/src/. Files are mono 44.1 kHz CBR 48 kbps.
`sfx_ui_settings.mp3` was removed: the settings prop now plays `sfx_ui_click` (Funning: no dedicated settings sound).

| file | length | source | author | licence | processing |
|---|---|---|---|---|---|
| sfx_ui_signpost.mp3 | 0.55 s | Impact Sounds impactWood_light_000.ogg | Kenney | CC0 1.0 | LP 2.4 kHz, HP 90 Hz, 10 ms rounded onset, own tail faded, room RT 0.42 s wet 15 %, 250 ms fade |
| sfx_ui_click.mp3 | 0.45 s | Impact Sounds impactWood_light_003.ogg | Kenney | CC0 1.0 | LP 2.4 kHz, HP 90 Hz, 10 ms rounded onset, own tail faded, room RT 0.34 s wet 12 %, 220 ms fade |
| sfx_ui_confirm.mp3 | 0.72 s | own synthesis (felt-mallet wooden bar, G4 → C5) | Voice bot | CC0 1.0 (own work) | pure sine partials (1, 3.93, 0.5 ×f), no noise; LP 3 kHz, room RT 0.42 s wet 12 %, 280 ms fade |
| sfx_ui_back.mp3 | 0.72 s | own synthesis (felt-mallet wooden bar, C5 → G4) | Voice bot | CC0 1.0 (own work) | same as confirm, descending |

Level ≈ -21.4…-22.4 LUFS (max 100 ms K-weighted), peaks -7.2…-13.3 dBFS; in game UI_TAP_VOLUME 1 for these and for
onButton / onToolTap (generic click), i.e. ≈ 11–13 dB below the cheers (≈ -9…-10 LUFS at volume 1).
Rebuild script (box, not in repo): /workspace/yiqifengle/previews/Voice-bot/ui-soft-v3/make.py (candidates signpost_1, click_1,
confirm_2, back_2).

The two "level ≈" paragraphs above are the make.py targets (short-window K-weighted). Shipped bytes were quieter on
EBU R128 integrated loudness (−25.6…−28.9 LUFS). On 2026-10-12 the six mp3s were renormalized in place (same MPEG-1
Layer III, mono, 44.1 kHz, CBR 48 kbps, same duration, same `.meta` uuid): ffmpeg `volume` plus `alimiter`
(limit −2 dB, attack 0.5 ms, release 50 ms) where a linear gain to −21.5 LUFS would pass −1 dBTP. UI_TAP_VOLUME stays 1.
A press that actually played suppresses `sfx_ui_confirm` on the same target for 150 ms.

Remeasured with ffmpeg 8.1 `ebur128=peak=true` (I / true peak) and `loudnorm` input (`input_i` / `input_tp`):

| file | ebur128 I | ebur128 TP | loudnorm I | loudnorm TP |
|---|---|---|---|---|
| sfx_ui_back.mp3 | −21.5 LUFS | −7.7 dBTP | −21.50 | −7.69 |
| sfx_ui_bag.mp3 | −21.5 LUFS | −2.2 dBTP | −21.55 | −2.20 |
| sfx_ui_book.mp3 | −21.5 LUFS | −2.2 dBTP | −21.53 | −2.17 |
| sfx_ui_click.mp3 | −21.5 LUFS | −2.4 dBTP | −21.55 | −2.44 |
| sfx_ui_confirm.mp3 | −21.5 LUFS | −7.8 dBTP | −21.59 | −7.82 |
| sfx_ui_signpost.mp3 | −21.5 LUFS | −2.5 dBTP | −21.55 | −2.50 |

Six files total 24,871 bytes. Cheer files were not touched (ebur128 integrated −13.6 / −12.8 / −12.0 / −12.0 LUFS at
volume 1), so the quietest cheer stays 7.9 dB above these taps.

## Footsteps (r4 exit footsteps, Voice Bot)

`bundles/region_island/audio_steps/step_{wood,rug,stone,path,grass}_{1..4}.mp3` were **synthesised from code** (numpy noise and
sines in `tools/exit-footsteps/synth_footsteps.py`). No recordings or third-party samples are used, so no licence applies.
There are 4 variants per surface, with the pitch baked in at 0.94/0.98/1.02/1.06 and different noise seeds. Each file is
low-passed at 4.5 kHz (8th-order Butterworth, applied after the pitch shift) and peak-normalised to −6 dBFS, then encoded as
44.1 kHz mono 32 kbps mp3. The 20 files total 27,504 B. The in-game volume is `STEP_GAIN` (0.32–0.38) ±1.5 dB, set in
`FootstepCore.ts`.

`audio_cine/sfx_exit_outbound.mp3` was regenerated by `tools/exit-footsteps/synth_exit.py`, the A1 script with its baked
steps removed. The file keeps the same scale, seed and encoding (32 kHz 56k mono). Running it with `--with-steps` reproduces
the A1 file byte for byte.

## Scene ambience V2 (Voice bot, 2026-10-18, branch voice/v2-scene-audio, candidates)

Design: `docs/audio/scene-sound-design.md`. Rebuild scripts: `tools/voice-bot/scene-audio-v2/` (sources on the box in
/workspace/v2amb/src, sha256 in `SOURCES-SHA256SUMS`). Real recordings come from OpenGameArt entries licensed CC0 1.0. Each
licence was checked on the entry page (OGA "License(s): CC0"). Freesound was not used because its CDN returned 403 to the
box. Nothing here is marked NOT_FOR_SHIP. Common processing: high-pass, a -2.5…-4 dB peak cut at 3.5 kHz, a -4 dB shelf above
7 kHz, low-pass, a synthetic room/outdoor reverb (own IR, no third-party IR), and loudness set with ffmpeg ebur128.
Loops are circular, with a 3 s equal-power tail→head crossfade (insects: 1 s linear) and a 0.15 s duplicate of the start
appended. One-shots have a 40–80 ms rounded onset, a 1.0–1.2 s reverb tail and a 0.6–0.7 s raised-cosine fade-out.

| file (creator-build-project/assets/bundles/…) | bytes | format | loudness (ebur128 I / TP) | source | author | licence | excerpt / processing |
|---|---|---|---|---|---|---|---|
| audio_bgm_island/audio/amb_island_shore_loop.mp3 | 97,028 | 32 kbps joint-stereo 32 kHz, loop 24.0 s | -22.4 LUFS / -4.5 dBTP | "Sea and river wave sounds" (VistulaShort.mp3) https://opengameart.org/content/sea-and-river-wave-sounds | randommind | CC0 1.0 | source 201.5–228.5 s (1 s filter warm-up dropped); HP 70 Hz, de-harsh -3 dB, LP 9 kHz, reverb RT 1.8 s wet -16 dB |
| transport_sail/audio_amb/amb_sea_open_loop.mp3 | 97,028 | 32 kbps joint-stereo 32 kHz, loop 24.0 s | -23.3 LUFS / -9.6 dBTP | same VistulaShort.mp3 | randommind | CC0 1.0 | source 38.5–65.5 s; HP 55 Hz, LP 2.4 kHz (4-pole), low shelf +2 dB @180 Hz, reverb RT 2.2 s wet -18 dB |
| region_meadow/audio/amb_meadow_birds_loop.mp3 | 121,076 | 32 kbps joint-stereo 32 kHz, loop 30.0 s | -26.3 LUFS / -12.2 dBTP | "Park Ambiences" (park_ambience_birds.wav) https://opengameart.org/content/park-ambiences | thimras | CC0 1.0 | source 204–237 s; HP 900 Hz (4-pole), de-harsh -2.5 dB, LP 7 kHz, reverb RT 1.3 s wet -16 dB |
| region_meadow/audio/amb_meadow_insects_loop.mp3 | 58,628 | 24 kbps mono 24 kHz, loop 19.25 s | -30.4 LUFS / -13.0 dBTP | "Cricket sounds" (cricketsounds090613.wav) https://opengameart.org/content/cricket-sounds | syncopika | CC0 1.0 | source 10.0–30.25 s; HP 1.5 kHz, de-harsh -4 dB, LP 5 kHz (4-pole), reverb RT 1.5 s wet -8 dB (distant) |
| region_meadow/audio/sfx_meadow_bird_1.mp3 | 13,184 | 32 kbps mono 32 kHz, 3.2 s | -27.4 / -13.7 | "Ambient Bird Sounds" (birds-isaiah658_0.ogg) https://opengameart.org/content/ambient-bird-sounds | isaiah658 | CC0 1.0 | source 9.3–11.3 s |
| region_meadow/audio/sfx_meadow_bird_2.mp3 | 12,896 | same, 3.1 s | -27.2 / -13.8 | same | isaiah658 | CC0 1.0 | source 12.3–14.2 s |
| region_meadow/audio/sfx_meadow_bird_3.mp3 | 12,464 | same, 3.0 s | -27.1 / -11.2 | same | isaiah658 | CC0 1.0 | source 19.72–21.52 s; birds: HP 1.2 kHz, de-harsh -3.5 dB, LP 6.5 kHz, reverb RT 1.5 s wet -7 dB |
| region_meadow/audio/sfx_windmill_creak_1.mp3 | 14,480 | 32 kbps mono 32 kHz, 3.5 s | -28.4 / -13.9 | "Tree Creaking" (tree_creak.flac) https://opengameart.org/content/tree-creaking (cleanup by antumdeluge of a recording by Department64) | Department64 / antumdeluge | CC0 1.0 | source 3.55–5.35 s slowed to 0.72x (pitch follows); HP 110 Hz, LP 3.2 kHz, de-harsh -3 dB, reverb RT 1.3 s wet -9 dB |
| region_meadow/audio/sfx_windmill_creak_2.mp3 | 16,496 | same, 4.0 s | -29.4 / -13.3 | same | Department64 / antumdeluge | CC0 1.0 | same excerpt slowed to 0.60x |
| region_skycity/audio/amb_sky_air_loop.mp3 | 129,140 | 32 kbps joint-stereo 32 kHz, loop 32.0 s | -24.4 / -11.0 | own synthesis (`s_sky.py`, seed 20261018) | Voice bot | CC0 1.0 (own work) | circular band-limited noise in 3 bands with integer-period swells, plus 8 soft D-minor-pentatonic sine glints; circular reverb RT 3.5 s |

Reused unchanged: gull v6 (`resources/audio_sfx/sfx_amb_gull_1..3`), `resources/audio_amb/amb_wind_soft_loop`,
`region_lakeside/audio/amb_lake_loop`, and the three BGMs.

### Scene audio V2, second delivery (ACNH supplement + real-table mapping, Voice bot, 2026-10-18)

Config mapping is in `creator-build-project/assets/scripts/audio/SceneAudioTable.ts`: `BGM_CANDIDATES`, `PENDING_LAYER_ASSETS`,
`SCENE_AMBIENCE_DESIGN`, `FOOTSTEP_SETS` and `SCENE_GROUND_TYPES`. Rebuild scripts are `tools/voice-bot/scene-audio-v2/s_landmarks.py`,
`s_steps.py` and `music/*.py`. Loudness was measured with ffmpeg ebur128 on the shipped mp3.

| file (creator-build-project/assets/bundles/…) | bytes | format | loudness (I / TP) | source | author | licence | excerpt / processing |
|---|---|---|---|---|---|---|---|
| transport_sail/audio_amb/bgm_sail.mp3 | 213,881 | 48 kbps stereo 44.1 kHz, plain circular loop 35.556 s | -17.4 LUFS / -5.1 dBTP | original composition + synthesis (`music/sail.py`, `music/synth.py`, `music/motif.py`) | Voice bot | CC0 1.0 (own work, no samples) | C major, 6/8, dotted quarter = 54. Nylon-guitar rocking arpeggio, bass, string swells. The flute plays the shared motif 「风起」 (bars 2–9), then the strings repeat it a third lower. Circular reverb RT 2.6 s |
| region_lakeside/audio/bgm_lakeside.mp3 | 400,552 | 48 kbps stereo 44.1 kHz, plain circular loop 66.667 s | -17.4 LUFS / -5.5 dBTP | original composition + synthesis (`music/lakeside.py`) | Voice bot | CC0 1.0 (own work, no samples) | F major, 72 BPM. Harp arpeggios, soft bass, strings in bars 10–17. The piano plays the motif, then sequences it a third lower. Circular reverb RT 2.4 s |
| region_meadow/audio/amb_meadow_river_loop.mp3 | 48,836 | 24 kbps mono 24 kHz, loop 16.0 s + 0.15 s dup | -27.2 / -13.0 | "Park Ambiences" (park_ambience_river.wav) https://opengameart.org/content/park-ambiences | thimras | CC0 1.0 | source from 62.5 s. HP / de-harsh / LP, light reverb |
| region_skycity/audio/amb_sky_waterfall_loop.mp3 | 48,836 | 24 kbps mono 24 kHz, loop 16.0 s + 0.15 s dup | -27.2 / -13.7 | same park_ambience_river.wav | thimras | CC0 1.0 | source from 274 s. HP 350 Hz, LP 4.5 kHz, reverb RT 2.5 s (distant mist) |
| audio_bgm_island/audio/amb_island_dock_lap_loop.mp3 | 36,884 | 24 kbps mono 24 kHz, loop 12.0 s + 0.15 s dup | -27.3 / -9.8 | "Sea and river wave sounds" (VistulaShort.mp3) https://opengameart.org/content/sea-and-river-wave-sounds | randommind | CC0 1.0 | source from 80.5 s. LP 1.6 kHz (water lapping under the pier) |
| region_meadow/audio/sfx_meadow_windbell_1.mp3 / _2 | 26,576 / 25,280 | mono, 6.6 s natural tail | -29.4 / -17.2, -17.8 | own synthesis (`s_landmarks.py`) | Voice bot | CC0 1.0 (own work) | bronze-bell partials, G pentatonic, soft strike, reverb tail |
| region_skycity/audio/sfx_sky_chime_1.mp3 / _2 | 26,000 / 27,296 | mono, 6.4 s natural tail | -30.5 / -20.0, -30.4 / -19.6 | own synthesis (`s_landmarks.py`) | Voice bot | CC0 1.0 (own work) | glass partials, D minor pentatonic (matches the sky-air glints) |
| region_island/audio_steps/step_sand_1..4.mp3 | 2,629 each | 32 kbps mono 44.1 kHz, 0.60 s | 100 ms RMS max ≈ -24.5 dBFS (same as step_grass) | Kenney "Impact Sounds" footstep_snow_000/001/002/004.ogg https://kenney.nl/assets/impact-sounds | Kenney | CC0 1.0 | HP 140 Hz, LP 3 kHz, de-harsh -3 dB, reverb RT 0.35 s |
| region_skycity/audio_steps/step_cloud_1..4.mp3 | 2,420 / 2,316 / 2,316 / 2,316 | 32 kbps mono 44.1 kHz, 0.55 s | ≈ -24.5 dBFS (as above) | Kenney "Impact Sounds" footstep_carpet_000..003.ogg | Kenney | CC0 1.0 | HP 120 Hz, LP 1.6 kHz, reverb RT 0.7 s wet -9 dB (soft, padded) |

Non-shipped preview only: `motif_demo` (the motif in the island and meadow arrangements), made from the same own-synthesis scripts.

### Scene audio V2 rework: plan B + pending-layer candidates (Voice bot, 2026-10-18)

These are **pending candidates**. They are in the bundles but not referenced by `SCENE_AMBIENCE_DESIGN`; the only reference is `PENDING_CANDIDATES` in `SceneAudioTable.ts`, and no player reads it. They wait for Funning's decision (previews 12a/12b and 13a/13b). If rejected, delete the mp3 and .meta files and their manifest entries.
Rebuild script: `tools/voice-bot/scene-audio-v2/s_pending.py`. Source sha256 sums are in `SOURCES-SHA256SUMS` (`wb/…`).

| file (creator-build-project/assets/bundles/…) | bytes | format | loudness (I / TP) | source | author | licence | excerpt / processing |
|---|---|---|---|---|---|---|---|
| region_lakeside/audio/sfx_lake_waterbird_1.mp3 | 26,000 | 32 kbps mono 32 kHz, 6.4 s | -28.5 / -13.4 | "Tundra swans.ogg" https://commons.wikimedia.org/wiki/File:Tundra_swans.ogg | U.S. Fish and Wildlife Service | Public domain (US federal government work), commercial use OK | source 1.0–6.0 s. HP 260 Hz (4-pole), de-harsh -4 dB, LP 4.2 kHz, reverb RT 1.9 s wet -6 dB (distant over water), 0.35 s fade in, 1.2 s fade out + 1.4 s tail |
| region_lakeside/audio/sfx_lake_waterbird_2.mp3 | 23,984 | same, 5.9 s | -28.4 / -13.1 | same | U.S. Fish and Wildlife Service | Public domain | source 10.0–14.5 s, same chain |
| region_lakeside/audio/sfx_lake_waterbird_3.mp3 | 34,064 | same, 8.4 s | -28.4 / -9.0 | "Yellowstone sound library - American Coots - 001.mp3" https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_American_Coots_-_001.mp3 | NPS & MSU Acoustic Atlas / Jennifer Jerrett | Public domain (US National Park Service), commercial use OK | source 224.0–231.0 s (ends before a louder call at 231.6 s); same chain |
| region_lakeside/audio/sfx_lake_waterbird_4.mp3 | 34,064 | same, 8.4 s | -28.4 / -12.5 | same | NPS & MSU Acoustic Atlas / Jennifer Jerrett | Public domain | source 348.0–355.0 s (the calmest window: peak ≤ 6 dB over p90); same chain |
| region_skycity/audio/sfx_sky_gardener_water_1.mp3 / _2 | 24,704 / 22,256 | 32 kbps mono 32 kHz, 6.1 / 5.5 s | -31.5 / -16.0, -31.4 / -13.7 | own synthesis (`s_pending.py`) | Voice bot | CC0 1.0 (own work) | watering-can sprinkle: about 55 soft droplet pings per second plus low-passed spray, LP 3 kHz, reverb RT 1.1 s |
| region_skycity/audio/sfx_sky_gardener_boop_1.mp3 | 16,208 | same, 3.9 s | -32.4 / -20.0 | own synthesis | Voice bot | CC0 1.0 (own work) | soft sine "hum-boop" (G5 E5 A5) with gentle vibrato over a faint motor purr, LP 2.6 kHz |
| region_skycity/audio/amb_sky_starring_loop.mp3 | 48,836 | 24 kbps mono 24 kHz, loop 16.0 s + 0.15 s dup | -31.4 / -21.2 | own synthesis | Voice bot | CC0 1.0 (own work) | five D-minor-pentatonic sines with whole-cycle swells, 146.8 Hz hum, faint whirr; built circular (dup correlation 0.998) |

## Sail segment (r5 sail audio, Voice Bot, 2026-10-18)

Files: `creator-build-project/assets/bundles/transport_sail/audio_sail/{sfx_sail_board,sfx_sail_unfurl,amb_sail_cruise,sfx_sail_dock}.mp3`
(mono 44.1 kHz, CBR 48 kbps; 172,372 B total). Edited from **CC0 1.0 field recordings on Freesound**. The originals were downloaded
in full quality from Creazilla's public-domain mirror (cdn.creazilla.com), because freesound.org / its CDN return 403 to the box.
Attribution is not required; it is recorded here for provenance.

| source | author | licence | Freesound | used in (excerpt) |
|---|---|---|---|---|
| "Sailing boat, bow wave (distant perspective)" (calm water, ~8 m boat, Neumann KM183 AB) | Pfannkuchn | CC0 1.0 | https://freesound.org/people/Pfannkuchn/sounds/360630/ | board 4.0–7.4 s, unfurl 10.0–14.6 s, cruise 23.0–40.5 s |
| "sailboat underway.wav" (wind-filled sails, lines, boat parts) | canoeCG | CC0 1.0 | https://freesound.org/people/canoeCG/sounds/460061/ | cruise 124.0–141.5 s (−7 dB under the water) |
| "Sailboat sail flapping with insect summer ambience" | maryhelena.clark | CC0 1.0 | https://freesound.org/people/maryhelena.clark/sounds/554439/ | unfurl 69.6–74.2 s |
| "Dock,Wood,Creak,Water,Laping.wav" (yacht club pier) | Filipe Chagas | CC0 1.0 | https://freesound.org/people/Filipe%20Chagas/sounds/91912/ | board 136.5–139.1 s, dock 88.0–90.8 s |
| "Lovis ship sailboat below deck … water sloshing around hull, wood creaks" | kyles | CC0 1.0 | https://freesound.org/people/kyles/sounds/450241/ | dock 40.0–44.4 s |

Processing (Voice Bot, `tools/audio/sail/build_sail_audio.py`): mono fold-down, resample to 44.1 kHz, 2nd-order HP 80–150 Hz,
4th-order LP 1.8–3.2 kHz (no hiss / insects / sharp highs), a gentle feed-forward smoother on the creak and cloth layers
(1 ms attack, 150 ms release, 3–4:1 only above the clip's RMS + 6–9 dB) so no transient pokes out, a light synthetic room on
board / dock (RT 0.5–0.55 s, 10 % wet, LP 2.5 kHz), raised-cosine onsets (30–250 ms) and natural decays ending in a 0.9–1.2 s
raised-cosine fade-out (never a hard cut). The 16 s cruise bed is a seamless loop (its 1.5 s tail is equal-power cross-faded
into its head). Levels (ffmpeg `ebur128`): board −26.5 LUFS, unfurl −25.4, dock −25.5, cruise −26.9 (true peak −3.3 to
−11.7 dBFS). In game: volumes 0.7 / 0.7 / 0.45 / 0.7 (`SAIL_AUDIO.vol`), so the sail SFX sit about 4–8 dB under the sail BGM
(`audio_amb/bgm_sail`, music slider 0.4) and the open-sea bed (`audio_amb/amb_sea_open_loop`, 0.8) from voice/v2-scene-audio.
The bed fades in over 1.0 s and out over 2.0 s.
Source sha256 (first 16 hex): bow 78b580af72a88f51, underway 9d2d7ccb30cbdfdc, flapping d5e7adbdc8b4374e, dock
6cab581c9821a6ce, Lovis fe53fec8252baad3.

### b15 landmark mix pass (Voice bot, 2026-10-21)

These are edits to files already credited above; no new sources.
- `sfx_lake_waterbird_1..4`, `sfx_sky_gardener_water_1..2`, `sfx_sky_gardener_boop_1`: re-encoded from the same masters with 1.5 s of leading silence added, so LandmarkAudioCore's 2 s fade-in no longer swallows the first call. New sizes: 32,048 / 30,032 / 39,968 / 39,968 / 30,608 / 28,304 / 22,112 B. Loudness is unchanged apart from the added silence.
- `amb_sky_starring_loop`: re-rendered as a plain circular loop for AudioSource.loop. It is 16.008 s (667 MPEG-2 L3 frames at 24 kHz) and no longer carries the 0.15 s duplicate tail, which played as a 150 ms repeat on every native loop. 48,404 B, -31.4 LUFS / -21.6 dBTP. Own synthesis, CC0.

### b15 follow-up: one-shots at target level, two-source star ring loop
- The 7 landmark one-shots (sfx_lake_waterbird_1..4, sfx_sky_gardener_water_1/2, sfx_sky_gardener_boop_1) are back to the
  b14 encodes with no silence padding (byte-identical to e567125a). LandmarkAudioCore now starts a one-shot directly at its distance
  level; leaving still fades out over 2 s, and the voice cap and gain budget are the same as before.
- amb_sky_starring_loop re-rendered from the same synthesis (own work, s_pending.py): 16.0 s circular body + 0.3 s copy of its own
  start, 24 kbps mono 24 kHz, 49,340 B, -31.4 LUFS, true peak -21.2 dBTP. It plays on two alternating AudioSources
  (LandmarkLoopPair): the partner starts at 16.0 s and they cross over 0.15 s after the 1105-sample encoder delay, so mp3 padding
  is never heard. No third-party material; licence unchanged.

## b15 lakeside levels 13–16 + snow-pass concept (Voice bot, 2026-10-22)

Lakeside main-line levels 13–16 (`LAKESIDE_BOARD_LEVELS` in SceneAudioTable.ts) reuse `bgm_lakeside`, `amb_lake_loop` and `sfx_lake_waterbird_1..4` unchanged: no new game audio, 0 bytes added to the package.

Snow-pass concept previews only (`previews/Voice-bot/b15-lakeside-l13-16/02..04`, not in the game):

| Source | Author | License | URL | Use |
|---|---|---|---|---|
| Howling_wind.ogg | Tvabutzku1234 | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Howling_wind.ogg | 30–58 s rumble (octave down, LP 180 Hz); 40–68 s gust (BP 250–1600 Hz, 700 Hz −5 dB); 72–100 s high wind (BP 700–2000 Hz, echo) |
| Windchime.ogg | stephan | Public domain | https://commons.wikimedia.org/wiki/File:Windchime.ogg | chime A: 12–36 s, +39 cents, HP 300 / LP 6.5 kHz, 3.5 kHz −5 dB, echo tail |
| Windglockenspiel.Koshi.ogg | Membeth | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Windglockenspiel.Koshi.ogg | chime B: 2–26 s, +22 cents, same chain |
| snow hiss | Voice bot (own synthesis, ffmpeg pink noise) | CC0 1.0 (own work) | — | HP 6.5 kHz / LP 10 kHz, −30 dB |

## 「风起」路线动机小样（Voice bot，2026-10-22，仅预览，不进游戏）
`previews/Voice-bot/feng-qi-roadmap/01..02`，脚本 `tools/audio/feng_qi_roadmap_demos.py`。

| Source | Author | License | URL | Use |
|---|---|---|---|---|
| Windchime.ogg | stephan | Public domain | https://commons.wikimedia.org/wiki/File:Windchime.ogg | single strike 0.72–6.0 s (≈1592 Hz), resampled to G5/C6/D6/E6/G6, HP 250 Hz, LP 5 kHz |
| Howling_wind.ogg | Tvabutzku1234 | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Howling_wind.ogg | 30–59 s / 40–70 s: LP 250 Hz rumble + BP 250–1400 Hz gust, slow LFO |
| piano / harp / accordion / flute / string pad | Voice bot (own synthesis: additive, Karplus-Strong) | CC0 1.0 (own work) | — | no CC0 multi-sample instruments were available on the box; placeholders for the final recorded/sampled versions |
| reverb IR | Voice bot (own synthesis) | CC0 1.0 | — | noise-decay IR, RT 3.0–3.5 s |

## 采样乐器小样：风铃湖畔「风起」（Voice bot，2026-10-22，仅预览，不进游戏）
`previews/Voice-bot/sampled-instruments/01_lakeside_fengqi_harp_flute_clarinet_strings_windchime_30s.mp3`，脚本 `tools/audio/sampled/lakeside_windchime_demo.py`。方案见 `docs/audio/instrument-sourcing-plan.md`。

| Source | Author | License | URL | Use |
|---|---|---|---|---|
| VSCO-2-CE `Strings/Harp` (KSHarp_*_mf) | Versilian Studios (Sam Gossner, Simon Dalzell; cutting Elan Hickler) | CC0 1.0 | https://github.com/sgossner/VSCO-2-CE (commit 440300901dfe9275fd84e0b7763af1f8443ae62e) | rolled arpeggios, pitch by resampling from nearest sample |
| VSCO-2-CE `Woodwinds/Flute/susvib` | same | CC0 1.0 | same | motif statement C5 F5 G5 A5 G5 |
| VSCO-2-CE `Woodwinds/Clarinet/susLong` | same | CC0 1.0 | same | motif answer C4 F4 G4 A4 F4 |
| VSCO-2-CE `Strings/Viola Section/susvib`, `Strings/Cello Section/susvib` | same | CC0 1.0 | same | sustained chords, cosine fades |
| Windchime.ogg | stephan | Public domain | https://commons.wikimedia.org/wiki/File:Windchime.ogg | single strike 0.72–6.0 s, resampled to C6/F6/G6/A6, HP 250 Hz, LP 4.5 kHz |
| room IR | Voice bot (processing, own) | CC0 1.0 | — | noise-decay convolution IR, RT 2.6 s, BP 200–4000 Hz |
