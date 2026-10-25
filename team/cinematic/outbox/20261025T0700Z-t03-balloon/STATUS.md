# T-03 balloon skycity→lakeside: visible flight 21 s → 12 s (运镜bot)
Branch cine/t03-balloon-12s from scene/b18-balloon-sun-sky 234e614f.
- [x] step 1: flightSkipS 9→18 (durationS 30, keys, turnInS, strut dodge unchanged); chest-smoothing window sampled on the flight clock (no open-ramp at the cut); turn-in guard max(blendOutS,turnInS). Offline sim (390x844): lens maxAcc 2.66 m/s² (= baseline), maxV 5.63, ω 6.7°/s in the flight.
- [ ] step 2: full suite
- [ ] step 3: before/after contact sheet
- [x] step 1b (Grok Bot addendum): wide touchdown lens lakesideDoorWideLens (basket + her standing body + ≥3 lake samples in the safe frame, 7 screens), turnInS 8→11.5; board view reached at touchdown + 5.8 s (sign +1.8 for 3.0 s, +1.0) by a fixed-time before-draw blend in the adapter; touchdown event 'qf-lakeside-touchdown' {atS: ride.T} + globalThis.__qfLakesideTouchdownAt. Probe: ω ≤ 19.6°/s, |a| ≤ 2.71 m/s², α ≤ 41°/s² after the cut on all 7 screens.
- [x] step 1c: wide-lens target body block .9→.7 of frame height (route O1 strut pass on 390x520/768x1024 → 0 frames)
