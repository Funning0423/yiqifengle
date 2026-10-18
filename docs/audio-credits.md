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
