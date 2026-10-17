# r4.1 exit footsteps: outdoor steps 10–12 dB under music+ambience (Voice Bot)

**Commit:** `f125cd21d8c056ca1ec25072a4fc5855a40a4c60` on `voice/build05-r4-exit-footsteps`. It is one commit stacked on the accepted `cfe6429`. Not pushed.
- `patches/0001-*.patch`: `git am` it onto cfe6429.
- `voice-build05-r4-exit-footsteps-r4.1.bundle`: prerequisite cfe6429. Check it with `git bundle verify` before fetching.

## What changed (code only; no assets regenerated)
All changes are in `FootstepCore.ts`, apart from the wind plumbing.

**Indoor (wood, rug) is unchanged.** Gain, ±1.5 dB jitter and files are the same as cfe6429; the test asserts this.

**Outdoor (stone slab, sand path, grass):**

| | cfe6429 | r4.1 |
|---|---|---|
| STEP_GAIN stone / path / grass | 0.38 / 0.34 / 0.32 | 0.50 / 0.36 / 0.36 (+2.4 / +0.5 / +1.0 dB) |
| wind lift | none | +6 dB × smoothstep(0.3, 0.9, wind), ≤1.5 dB per 0.1 wind |
| per-variant trim (dB, files 1–4) | none | stone +0.2/+0.1/0/−0.3 · path +1.8/−1.4/−0.9/+0.6 · grass +0.2/−0.2/+0.2/−0.1 |
| jitter | ±1.5 dB | ±0.75 dB |

- **Wind lift.** The wind value is `WorldFlow.getWindStrength()`, the same source the walk driver uses, passed from WorldIntegrationBoot into the FootstepAudio sample. Outdoors the bed rises with the strong-wind loop. On the recording, the late grass and path steps (wind 0.5–0.8) fell 14–20 dB under the bed. Indoors the wind is 0.
- **Per-variant trim.** This level-matches the 4 files of each outdoor surface to within 0.3 dB. path_1 had been 3.1 dB under path_2, which made single steps drop out.
- **Jitter.** It is smaller outdoors so neighbours stay within ~3 dB while the lift moves. Variation still comes from the 4 pitch variants, no immediate repeat, and the ±0.75 dB jitter.
- **Untouched:** low-pass 4.5 kHz (the files are the same), STEP_LEAD_S, plants, ground map and the trigger. All alignment tests are unchanged and pass.

## How it was calibrated (`recording-calibration/`)
The source is 运镜bot's cfe6429 recording: Chromium web build, in-page AudioWorklet tap on the master, `recording-yunjing/`. It was used read-only; audio was extracted to /tmp.

Method, using `tools/exit-footsteps/recording_levels.py`:
- **The step signal.** For each logged step, the exact step file × the game's own `vol` is placed at the matched onset, refined by ±5 ms cross-correlation. 运镜bot's fitted gain_in_mix ≈ vol, so the master gain is 1.
- **The bed.** bed = recording − step.
- **The measurement.** Both are measured as K-weighted momentary loudness over one 400 ms window, starting 70 ms before onset. This is the same window as `loudness.json`.
- **"After" values.** Each recorded step is re-scaled by the new code volume for that same step (same file, same wind, jitter scaled), against the same recorded bed.

**Step under bed, dB (higher = quieter)** (the full table and every step are in `loudness_table.md`):

| surface | recording before | recording after | offline before | offline after |
|---|---|---|---|---|
| stone | A 14.5 · B 12.6 | A 12.2 · B 10.2 | 13.3 | 11.2 |
| path | A 13.8 (10.0–19.6) · B 12.8 | A 10.9 (9.2–13.9) · B 12.1 (median 11.2) | 12.3 | 10.0 |
| grass | A 12.8 (11.3–15.4) | A 10.8 (9.8–11.7) | 11.4 | 9.6 |
| **all outdoor** | 13.1 (6.4–19.6) | **11.4, median 11.0** | 12.1 | 10.0 (7.0–12.4) |
| wood / rug | 12.6 / 9.7 (A) | unchanged | 11.0 / 10.7 | unchanged |

- **Offline vs recording.** The offline mix (`preview/`) has a weaker high-wind bed than the recording (−20…−23 vs −17…−21 LUFS) and no gulls or one-shots. That is why its late steps read 7–9 dB under. The recording was the calibration reference, as requested.
- **Remaining outliers, return path (B).** Two steps sit 15–17 dB under at wind 0 and one sits 7.7 dB under. Wave swells and one-shots in the recorded bed move ±4 dB within a second. A static per-surface gain cannot follow that, and there is no analyser on WeChat to track the live bed.

## No sudden jumps
- **Door, exit.** Last wood step −36.3 → first slab step −34.6 LUFS (+1.7 dB), after the 2.7 s door-opening gap. Offline: +0.4 dB.
- **Door, return.** Slab −34.9 → first wood −36.6 (−1.7 dB).
- **Outdoor neighbours.** On the recording, the largest amount any outdoor step is louder than its louder neighbour is +1.3 dB; offline it is ≤2 dB.
- **Test bound.** The test checks the worst-case jitter draw, ≤3.3 dB, on the real 60 fps exit + return. It also checks door wood↔stone ≤3 dB.
- **Indoor, unchanged and FYI.** wood_1 is 3.4 dB quieter than the other wood files, so the step before it reads +3.5 dB over its neighbour (A step 1). That is a dip, not a hit. It would be the same trim fix if indoor may change.
- **Peaks.** Offline step peak −13.9 → −9.2 dBFS, mix peak −6.9 dBFS, bed integrated −23.3 LUFS (both unchanged).

## Tests
- **`exit-footsteps`:** 19/19 PASS (`exit-footsteps.test.log`). New cases:
  - levels locked: indoor = cfe6429; outdoor gains, trims and lift exact; lift slope; volume cap;
  - neighbour/door loudness on the real exit + return;
  - wind wiring in Boot/FootstepAudio.
- **Full suite** (`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`): **81/86** (`suite.log`). The 5 failures are the same as the cfe6429/50a3074 baseline: production-integrity (same first frozen mismatch), legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER.

## For 运镜bot (optional re-record, same kit as before)
Build f125cd2 with `tools/build-guard/build-wechat-guarded.sh web` and record A_exit and B_return exactly as for cfe6429. Then run `python3 tools/exit-footsteps/recording_levels.py <recording dir> A_exit out.json` (and the same for B_return).

Expected result:
- outdoor `underDb` about 10–12, median ≈ 11, with occasional ±4 dB from wave or gull swells in the bed;
- wood/rug the same as the cfe6429 recording.

On WeChat/iPhone, only the speaker check is still open.
