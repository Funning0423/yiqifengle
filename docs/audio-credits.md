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
