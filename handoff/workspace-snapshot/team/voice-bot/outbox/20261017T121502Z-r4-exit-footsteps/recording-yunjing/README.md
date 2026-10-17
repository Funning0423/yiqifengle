# r4 exit footsteps: recordings with sound (运镜bot), cfe6429

**Build:** cfe64292bfd23d187b5a9409e712098e28b259d0, built on Funning's Mac with `tools/build-guard/build-wechat-guarded.sh web` (Creator 3.8.8, guard PASSED try 1, 20,139,371 B). The build ran 12:28–12:29 UTC (08:28–08:29 EDT); recorded 12:29–12:33 UTC (08:29–08:33 EDT).
**Player:** headless Chromium (Playwright) on the Mac GPU (ANGLE Metal, Apple M4), viewport 390x844, dpr 2. Music slider at its default (0.4), 音效 on, not muted. `globalThis.__worldFlowLog=true` was set before 出门.
**Capture:** in-page AudioWorklet tap on the game's master output (gapless PCM, the same pipeline as cinematic/outbox/20261017T0950Z-audio-capture-test) plus CDP screencast. Muxed by `kit/mux4.py` (60 fps CFR, AAC 160k).

## Deviations from the requested flow
- **Web build in Chromium, not WeChat DevTools.** We can't drive the DevTools GUI or Cmd+Shift+5, and the Mac has no loopback audio device. The game code and assets are the same commit. What a web build can't show: WeChat/iOS output latency, whether the WeChat decoder honours the mp3 priming, and wx.onHide.
- **Video is 390x844 (CSS px), not 720p.** The headless screencast delivers frames at CSS size.
- **Steps were triggered by the debug API, not taps.** 出门 = `__worldIntegration.leave()`, 回家 = `__worldIntegration.returnHome()`. The audio gesture was GameAudio `onGesture()`, which is what a real tap calls.
- **C, sound effects:** `GameAudio.setSfxMuted(true/false)`, the same setter the 设置「音效」 switch calls.
- **C, background:** simulated. `document.hidden` and `visibilityState` were overridden, then `visibilitychange` and `pagehide`/`pageshow` were dispatched. This is the path Cocos web uses to emit Game.EVENT_HIDE/SHOW; the world log shows `hide`/`show` events. In WeChat the same engine events come from wx.onHide/onShow.
- **A/V markers:** each clip has 2 marker flash+beeps at the head and 2 at the tail (1 kHz, white screen), used for sync. Marker positions are in `*/markers.jsonl` / `timeline.json`. All step material lies between them.
- **Clip B:** before recording, the exit was played (unrecorded) to reach the island.

## Files
`A_exit/A_exit.mp4` (41.2 s), `B_return/B_return.mp4` (31.3 s), `C_gating/C_gating.mp4` (60.1 s). 出门/回家 is called at video t ≈ 4.28 / 4.29 / 4.30 s.
Each folder also has:
- `console.log`: [QF_AUDIO]/[QF_LAKE] lines with ISO time and perf ms.
- `console_full.log`: the whole page console.
- `events.json`: every AudioBufferSource start, world states, harness marks.
- `steps.csv` / `analysis.json`: per-step results.
- `timeline.json`: sync data.
- `rms400.json`: 400 ms RMS curve.

`transients.txt` has the largest 50 ms jumps over the preceding 400 ms. `kit/` holds the harness and analysis scripts.

## A/V sync
Flash frame minus beep onset, per marker (bounded by one frame interval):
- A: 2.8 / 13.1 / 8.6 / 7.8 ms
- B: 13.7 / 8.7 / 4.8 / 16.4 ms
- C: 2.8 / 11.9 / 24.4 / 18.1 ms

All are within 50 ms. There were 0 audio gaps, and the getOutputTimestamp map agrees with the marker map within 0.1 ms. Capture rate: 59.7 / 54.9 / 52.9 fps mean, median frame interval 16.7 ms. In C, no frames come while hidden.

## Step timing (method)
Each `[QF_AUDIO] step` log was paired with the AudioBufferSource it started. The audible onset was found in the recorded mix by matched filter with the exact decoded step buffer. The table comparison removes one constant offset (harness call → game leaveHome).

| | A exit | B return |
|---|---|---|
| steps logged / sources started | 25 / 25 | 27 / 27 |
| vs Voice Bot table: count, foot, surface | 25/25, 25/25, 25/25 | 27/27, 27/27, 27/27 |
| log time vs table step time | −1 … +17 ms (1 frame) | −25 … +17 ms |
| audible onset − log (play() frame) | 26.4 … 35.7 ms, mean 29.2 | 26.4 … 44.1 ms (first step), mean 29.9 |
| **audible onset − table foot plant** | **+3.4 … +32.7 ms, mean +11.9** | **+3.6 … +31.6 ms, mean +14.1** |

- Max offset of onset against plant: **32.7 ms** (A), inside ±40 ms.
- Chromium's ~29 ms trigger→audible latency (output latency plus the next audio quantum) is what moves Voice Bot's −25…−10 ms trigger error to positive.
- Chromium decodeAudioData trims the mp3 priming: the decoded step buffers reach 5 % of peak within 0–2.2 ms.
- The WeChat/iOS latency is still unmeasured. If device steps prove consistently late, `STEP_LEAD_S` is the knob.

Room order in A (matches the README):
- 2 wood, 3 rug, 6 wood (including the 2 settle steps at the door);
- outside: 2 stone, 3 path, 6 grass, 3 path.

B order: 13 path, 2 stone, then wood/rug inside and a final wood step when sitting.

## Loudness / "no loud hit after leaving"
- **Steps sit under the bed:** 4.2–19.7 dB (A) and 5.0–18.7 dB (B) below it, by RMS over each step (unweighted, gain fitted in the mix).
  - Most present: rug (−4…−6 dB). Least present: late grass/path (−15…−20 dB, barely audible).
  - Step peaks reach at most −13.5 dBFS (A) and −13.0 dBFS (B).
- **No hit in A after the door.** Largest transient after crossing-out: +4.1 dB at 20.8 s (−15.9 dBFS), an ambient one-shot (1.0 s buffer, likely a gull), not a step. The exit track at crossing-out has no step crack.
- **Mix peaks:** excluding markers, −6.8 dBFS (A, at 20.7 s, gull/waves) and −7.8 dBFS (B).
- **Possible doubling (FYI, not footsteps):** three ambient one-shots (3.26 s, 3.36 s, 3.19 s) are each started twice in the same frame. That doubles them (+6 dB).

## C gating
Times are seconds from 出门.
- **SFX off 5.50 → on 9.01:** 6 plants logged (5.75–8.62 s), **0 sources started, no step audio.** The log line still says `"loaded":true`; that field means the clip exists, not that it played. The next plant after "on" (11.30 s, stone) played normally. No burst.
- **Hidden 14.85 → 18.87:** output was digital silence. 0 steps logged. On show, no step or one-shot played in the first 2.5 s; the first 0.5 s after show is −29 dBFS RMS, at or under the normal bed. No catch-up burst.
- ⚠️ **Not a footstep issue (world flow), worth a look:**
  - Backgrounding mid-exit (she was outside on the path, state crossing-out) went to `paused`. On show the world went `home → standing`: she **snaps back to the chair in the room and replays the whole exit**, then reaches the island at 49.7 s. See `C_gating/C_show_snapback_strip.png` (video t 18.9 / 22.9 / 23.4 / 24.5 / 26.5 s).
  - BGM was also started again on show.
  - Footsteps behaved correctly through the replay: 25 more steps, same surfaces.
  - This came from simulated visibility in a web build. Whether WeChat does the same on wx.onHide needs a device check.
