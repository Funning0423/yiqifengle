# PR #56 r4: meadow instantiate split + cloud-hold sting guard (local, NOT pushed)

Base d317b2f (tree 5f41b387). Branch cine/pr56-r4-instantiate-split, worktree /workspace/wt-pr56r4.
- 0001 e2aa900  meadow instantiate split   -> tree 4e895780a08636c4475011bf1c03dd9c28c13167
- 0002 7f51b59  cloud-hold sting guard     -> tree 7906f43ddc68e02452be18d5b238e176ccdc67da  (FINAL: 7f51b59335a4379874c9f144360d424276942900)
Verified: `git am patches/*.patch` on a clean d317b2f worktree gives tree 7906f43d (and 4e895780 after 0001).

## 0002 audio guard (per Voice Bot 0431Z analysis, Grok approved)
- Removed SAILBOAT_HOLD_CINE_FADE_SEC = 0.08. New SAILBOAT_HOLD_FADE_DELAY_SEC = 0.25, SAILBOAT_HOLD_FADE_SEC = 0.4.
- Model: enterHold no longer fades; it only starts the wind bed (unchanged) and zeroes a hold clock. While holding, once the hold has lasted >250 ms
  the model emits one `cine-fade 0.4`. leaveHold: if that fade is still running (<0.4 s on the model clock) it emits new `cine-restore`
  and the cine state goes back to `playing` (so a later skip still fades it with 0.3 s); if the fade already finished it marks the sting stopped.
- GameAudio.restoreCineSlot(): cancels a running fade (cineFadeAt=null) and puts the source back at its pre-fade gain; no-op when no fade/slot.
  The <0.001 auto-stop in tickCineFade is untouched; with a 0.4 s cos fade it can only trigger at the end of the fade, i.e. never before hold 250 ms + 0.4 s.
- Driver: dispatches `cine-restore` -> audio.restoreCineSlot().
- Skip (0.3 s skipFadeSec) unchanged; a tap during a hold before 250 ms gets the skip fade only. timing.json and home-island hide timing untouched.
- Also corrected the start-gate doc comment (r3 1.8 s claim was an artifact, see below). text-MANIFEST rewritten for the 3 changed scripts.

Tests (box, Node 22.14 /exec-daemon/node, TS 5.9.3, hello-wx cc.d.ts): test_sailboat_transition (new: short hold no fade; long hold fades right after
250 ms with 0.4 s; leaveHold mid-fade restores + later skip fades; skip during hold keeps only 0.3 s fade; finished fade not restored),
test_sailboat_audio 13/13 (new: 0.4 s fade still live at 390 ms, stopped at 400 ms; restore mid-fade -> full gain, keeps playing, skip still works; restore no-op cases),
test_meadow_preload, test_manifests, test_es5_safety, test_meadow_night_sky: all exit 0. Logs in evidence/.
Not verified: no Cocos build, no Mac run.

## r3 recheck: "sting starts 1.78 s before sail start" -> MEASUREMENT ARTIFACT
Method: sting onset in each wav by cross-correlating the first 2 s of sfx_transition_island_to_meadow.mp3 (reproduces Voice Bot's r4 onsets exactly:
25.638/25.872/25.723/25.729). wav->video offset from two independent anchors:
| run | onset (wav) | anchor | wav->video offset |
|---|---|---|---|
| r4 23 day | 25.723 | sting log 27.775 / skip-fade start vs skipTap 29.13 | 2.052 / 2.072 |
| r4 23 night | 25.729 | sting log 27.809 / skip-fade vs skipTap 29.16 | 2.081 / 2.067 |
| r3 13 day | 25.611 | skip-fade start vs skipTap 30.18 | 2.054 |
| r3 13 night | 25.633 | skip-fade start vs skipTap 30.18 | 2.052 |
The skip-fade anchor agrees with the log anchor in r4 within ~20 ms, so r3 had the same ~2.05 s lag (same recorder; summary assumed +0.13-0.16 s).
Re-aligned r3 sting start (video): day12 ≈27.61, night12 ≈27.79, day13 ≈27.66, night13 ≈27.69 vs recorder sailStart marks 27.50/27.64/27.55/27.56
=> the sting started ~0.1-0.15 s AFTER the mark, not 1.78 s before. Night12 boat departure seen at 28.12 ≈ sting+0.33 (S2 at frame 12 = +0.4 s): picture and
clock were in step. The r3 night "cut at sea" (wav 28.64) maps to video ≈30.70 = the cloud-hold fade under cover (same mechanism as r4), not at sea.
r3 durations from sting were ≈6.0 s day / ≈5.3 s night, not 7.88/7.26.

Is the start gate still justified? Its original motivation is gone, but it is harmless and still useful:
- r4 shows gate opens on `settled` after 58-76 ms, sting within 1 ms, durations 5.28/5.22 s pass; cost is ≤ ~0.08 s.
- It enforces the timing file's frame-0 definition (after exit camera settles) instead of relying on load-callback timing.
- Risk remains only the 3 s timeout fallback if the exit camera ever sways (watch for `[sailboat] start gate timeout`); none seen in r4.
- The dt cap 0.1 -> 0.25 s from the same patch is independent and still correct.
Recommendation: keep it; no revert. Recorder should align audio by the sting log / first sting onset from now on.
