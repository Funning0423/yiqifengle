# PR #56 r3: when the sailboat starts (A: duration, B: early fade at night)

Base: feat/sailboat-transition-20261015 @ 50cba71 → local branch cine/sail-start-gate-r3 @ f2adb78 (39ea7a8 + logging commit), tree f892e5f (was 751fcf2 after commit 1).
Patch: patch/0001-*.patch + 0002-*.patch (git am both on 50cba71 → tree f892e5f, verified). Not pushed. GGbot's items (the island frame that flashes after skip, the night tint) are untouched.
timing.json is unchanged (all phases are the same, 5.2 s).

## Measurements (r3 recordings; video and audio aligned to the recorder marks)
- Spectral cross-correlation between the sting mp3 and each recording's wav (evidence/sting_align.py, r≈0.49–0.52 in all four):
  sting onset day12 25.72, night12 25.86, day13 25.74, night13 25.78. That is **1.78–1.81 s before** the recorder's sailStart in every run.
  This matches Voice Bot's 0226Z markers (25.715 / 25.860).
- Night 12 cut 28.64–28.72 = 2.78 s after the sting started ≈ frame 81 on the sting clock, plus 80 ms of fade. It **is** the cloud-hold fade, and it fired on time **for the playback clock**.
  The clock was ~53 frames ahead of the picture, so the boat was still at sea.
- Picture: frame-to-frame YDIF for night 25.0–29.0 shows the camera still easing at 25.9–27.3, almost still at 27.3–28.1, and the boat departing from 28.12 on.
  In the strip (evidence/night_25.4-28.0_strip.png) the island stays at the exit-camera framing the whole time.
  So the driver called begin() (sting + countdown) on the timing-JSON load callback, while the exit camera was still writing the camera. The timing file defines frame 0 as "after the exit camera settles".
- Durations from the sting start (the real begin()): day 33.60−25.72 = **7.88 s**, night 33.12−25.86 = **7.26 s**. The recorder's 6.10 / 5.48 were measured from the late sailStart mark.
  The extra time is: the start ran ~1.8 s early; the cloud hold, because warm-up only counts frames under full cover, and night reached frame 81 before the cover was shown; and dt was clamped to 0.1 s.

## Fix
1. `createSailboatStartGate` (model, no engine): begin() (sting + countdown) only after the live camera holds still (≤2 mm, forward ≤5e-4) for 3 consecutive frames with dt ≤50 ms.
   Fallback: start after 3 s anyway. That costs at most 3 frames (~0.05 s at 60 fps), so the sting and the boat start within 2 timing frames of each other. The boat is hidden until then; taps before then are ignored.
2. The driver's per-frame dt cap goes from 0.1 s to 0.25 s, still in 1/30 s substeps. On heavy frames the timeline no longer runs behind the wall clock.
3. The hold logic is unchanged: it can only engage when crossing sceneSwapFrame (81) under full cover. New tests check this at 60/30/20/10 fps.
   They also check 5.2 s ±1 step with no hold when the meadow is ready.

## Tests (box, Node 22.14)
test_sailboat_transition (incl. new r3 start-gate/hold cases) ✔, test_sailboat_audio 10/10 ✔, test_manifests ✔ (text manifest rewritten for the 2 cine files),
test_es5_safety ✔ (QF_TYPESCRIPT_MODULE=/tmp/ts5 TS 5.9.3, QF_CC_DTS=hello-wx cc.d.ts).

## Not verified / risks
- No Cocos build and no Mac run. The gate opening at the settled exit pose is inferred from the recordings.
  If the exit camera drifts slowly (idle sway >2 mm/frame), the gate falls back to the 3 s timeout and logs `[sailboat] start gate timeout`. Watch for that line on the Mac.
- Whether the meadow is warm by frame 81 once start is aligned is not proven. Night may still hold briefly (now under real cover, so it is a correct hold, not a cut at sea).
- Why the exit camera was still moving when playRegionArrival ran: the arrival overlaps the level load (WorldFlowCore.playEnterCover). The flow was not changed.
- For the Mac rerun: please log sting start, gate open and hold enter/leave via console so the next measurement does not depend on the recorder's polling mark.

## r3 addendum (Grok's two pre-push questions; commit 2 of the series)
None of the numbers below were measured on the Mac. They are estimates from the r3 recordings plus the timing model.

### 1) Gate vs real sail start (within 2 timing frames?)
- In this patch, sail start is not a separate event that the gate has to line up with. The gate opening *is* the sail start. In one `update()`, the driver:
  1. opens the gate,
  2. sets `boat.active = true`,
  3. calls `playback.begin()`, which returns timing frame 0 and issues the `cine-play` sting command,
  4. dispatches that sting on the same apply.
- The boat is inactive (hidden) before that point, so it can't appear or move earlier. Offset between gate, boat shown and sting command: **0 timing frames, day and night**.
- What is left is outside the game logic: WebAudio output latency, typically 10–40 ms, which is ≤1.2 timing frames. The boat's visible departure is S2 at frame 12 (0.4 s after frame 0) by design.
- The remaining question is whether "camera still for 3 frames" fires at the right *moment*: at the end of the exit move, not too early and not on timeout.
  - Recording evidence: frame-to-frame YDIF, 160 px gray, 25 fps (evidence/ydif_day12_night12_25-34s.txt).
  - The exit-camera ease decays to the idle floor of ~0.07–0.12 at day ≈27.0–27.4 s and night ≈27.0–27.3 s. The old recorder sailStart marks were 27.50 / 27.64.
  - So the settle moment is within ≈0.1–0.4 s of where r3 placed the sail start. That is the intended frame 0 ("S1 hold on island final pose begins").
  - Previously the sting came 1.78 s *before* that point.
- Added console logs (commit 2) so the Mac rerun measures this directly rather than through the recorder's polling:
  - `[sailboat] gate open <reason> waited <s> t <ms>`
  - `[sailboat] sting start t <ms>` (same update as gate open)
  - `[sailboat] hold enter t <ms>` / `[sailboat] hold leave t <ms>`
  - Pass criterion: |sting start − gate open| ≤ 66 ms (2 frames), and reason = `settled`.

### 2) Total duration from sail start, after the fix (estimate)
Model: end = max(T0 + 5.2 s, R + 2.5 s).
- T0 is the gate open time.
- R is when the warmed meadow is ready (hold leave). The 2.5 s is frames 81→156.

Assumption: the meadow load/mount time is unchanged by moving begin() later. Prefetch starts during the exit camera and does not depend on begin().

R is taken from the r3 picture, at the dissolve onset (YDIF):

| | T0 (camera settled) | R (dissolve onset, minus ~0.1 s) | Old end (node removed) | **New estimate** | Hold |
|---|---|---|---|---|---|
| Day 12 | ≈27.40 | ≈31.2 | 33.60 | **≈6.2 s** (33.6−27.4) | ≈1.0 s under full cover |
| Night 12 | ≈27.40 | ≈30.75 | 33.12 | **≈5.7 s** (33.1−27.4) | ≈0.5 s under full cover |

- If the meadow is ready by T0+2.63 s, both runs come out at **5.2 s** (±1 step; tests cover 60/30/20/10 fps).
- The 0.25 s dt cap does not change these r3 numbers. The recording frame interval was a constant 40 ms, so the old 0.1 s clamp never engaged. The cap only matters on frames longer than 100 ms.
- Conclusion: the start offset is fixed (−1.8 s → 0). The night cut at sea becomes a hold under full cover.
- The total lands at 5.2 s **only if the meadow is warm by frame 81**. With r3's load times it would be ≈6.2 s by day and ≈5.7 s at night.
- The rest is meadow load time, not the timeline. If 5.2 s is a hard requirement, the next lever is starting the meadow prefetch earlier, or making it lighter (separate change, not in this patch).
- Confirm on the Mac with the hold enter/leave logs.
