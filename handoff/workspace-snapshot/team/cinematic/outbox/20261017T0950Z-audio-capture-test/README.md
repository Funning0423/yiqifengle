# In-page audio capture pipeline — verification clip (not a deliverable recording)

Purpose: prove the capture pipeline is ready for the r4 final recordings. Per the 05:43 EDT plan change, no full
recordings were made on c3cbf89.

- Build: c3cbf89 web build (web-v3), Mac GPU (Chromium/Playwright, dpr 2), 390x844, 2026-10-17 ~05:50 EDT.
- video.mp4: 22.4 s, h264 + aac.
- Audio: AudioWorklet tap on the game's master output (gapless PCM), muxed by mux3.py.
- Sync method: the game emits 6 test markers (flash on screen + beep in audio). The audio is aligned to video by marker clap-sync
  (timeline.json), and cross-checked with an independent AudioContext.getOutputTimestamp map (timeline_gos.json, ANCHOR=gos).
- Result (worst flash−beep error over 6 markers): 14.8 ms with the marker map, 8.6 ms with the gos map; limit is 50 ms → PASS.
  0 audio gaps; 59.6 fps.
- Files: video.mp4, timeline.json, timeline_gos.json, markers.jsonl (per-marker flash/beep times), run.log, console.log.
