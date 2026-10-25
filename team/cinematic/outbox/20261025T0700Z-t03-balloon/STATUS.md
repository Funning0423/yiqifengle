# T-03 balloon skycity→lakeside: visible flight 21 s → 12 s (运镜bot)
Branch cine/t03-balloon-12s from scene/b18-balloon-sun-sky 234e614f.
- [x] step 1: flightSkipS 9→18 (durationS 30, keys, turnInS, strut dodge unchanged); chest-smoothing window sampled on the flight clock (no open-ramp at the cut); turn-in guard max(blendOutS,turnInS). Offline sim (390x844): lens maxAcc 2.66 m/s² (= baseline), maxV 5.63, ω 6.7°/s in the flight.
- [ ] step 2: full suite
- [ ] step 3: before/after contact sheet
- [x] step 1b (Grok Bot addendum): wide touchdown lens lakesideDoorWideLens (basket + her standing body + ≥3 lake samples in the safe frame, 7 screens), turnInS 8→11.5; board view reached at touchdown + 5.8 s (sign +1.8 for 3.0 s, +1.0) by a fixed-time before-draw blend in the adapter; touchdown event 'qf-lakeside-touchdown' {atS: ride.T} + globalThis.__qfLakesideTouchdownAt. Probe: ω ≤ 19.6°/s, |a| ≤ 2.71 m/s², α ≤ 41°/s² after the cut on all 7 screens.
- [x] step 1c: wide-lens target body block .9→.7 of frame height (route O1 strut pass on 390x520/768x1024 → 0 frames)
- [x] step 2: full suite on 060df717: 180 PASS, 0 FAIL, 3 env-blocked (2× Node ≥22.6, navigation-guard browser); route-continuity/-framing/-occlusion PASS, lakeside-qashot PASS. No test expectations changed.
- [x] step 3: before/after ray-cast schematic sheets, 7 screens: before_after_<WxH>.png (tools/ = render.cjs, sheet.py, c1.cjs probe).

## Timings (segment clock: t=0 = her first step from S6 in the skycity)
| | before 234e614f | after |
|---|---|---|
| walk to basket + board fade (cut) | 9.30 | 9.30 |
| flight skipped under black (flightSkipS) | 9 | 18 |
| visible flight | 21.0 (9.30→30.30) | 12.0 (9.30→21.30) |
| touchdown (ride.T) | 30.30 | 21.30 |
| board view reached | ≈41.8 (touchdown + 4.59 hold + 6.87 blend) | 27.10 (touchdown + 5.8) |
| ride durationS / ease | 30 / 5 / 7 | unchanged |
| turn-in onto touchdown lens | 8 s | 11.5 s |
Touchdown hook: director event 'qf-lakeside-touchdown' {atS: ride.T}; globalThis.__qfLakesideTouchdownAt = ride.T (21.30). LAKESIDE_TOUCHDOWN = {signAtS 1.8, signS 3.0, boardWithinS 1.0}; lakesideBoardByS() = 5.8.
