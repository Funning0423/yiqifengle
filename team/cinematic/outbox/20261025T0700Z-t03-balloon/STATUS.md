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

## Addendum 2 (option C → B) + Addendum 3 (WindWipe 'ride')
- [x] Option C NOT feasible: she enters the unchanged board frame only at ~6.2–6.35 m of the 6.36 m walk-out; reaching it by touchdown +6.5 s needs ~1.4 m/s, clip band ≤ 0.91 m/s. **Option B shipped**: board blend STARTS 0.5 s after the sign leaves (touchdown +5.3), duration max(SPEC blend, remaining walk / mps + 1.5 s pad) = 6.73 s → board view at touchdown +12.03 s. Board framing unchanged.
- [x] wide touchdown lens: target body block .5, her box right edge ≤ .52 ndc (door path + seated basket box) → route F2 pass on 390x520/768x1024.
- [x] test: tools/journey-integration/test-lakeside-touchdown-timeline.cjs (registered in run-suite): blend start = sign out + ≤1 s; in-frame (|ndc| ≤ 1) touchdown→board; face/chest hidden ≤ 0.5 s; ω ≤ 20, α ≤ 120, |a| ≤ 3.
- [x] merged ggbot/windwipe-ending b476a6ca (no conflict at all, manifests auto-merged).
- [x] boarding = ONE 'ride' WindWipe (newWipeEvent('ride', balloon + 风铃湖畔)); our black fade removed. onWipeCovered (kind 'ride' + our id): seat her, ride clock → cutT (= flightSkipS jump); addWipeBeforeReveal: true once the ride camera was placed 2 frames; ride clock frozen at cutT through the hold; hooks unsubscribed at segment end/cancel. K.boardFadeOutS .45 / boardBlackS 0 / boardFadeInS .55 (= WINDWIPE).

## Visible timeline (wall clock, t=0 = first step from S6; H = wipe hold ≥ 1.10 s, ≤ 20 s)
| event | t |
|---|---|
| walk ends at basket, wipe OUT starts | 8.65 |
| fully covered → seat + skip 18 s of flight | 9.10 |
| reveal starts (IN .55) — ride clock resumes at cutT 9.10 | 9.10 + H (≥10.20) |
| visible flight | 12.0 s |
| touchdown, event qf-lakeside-touchdown | 21.10 + H (≥22.20); event atS = ride.T = 21.10 (ride clock, hold excluded) |
| she stands, door, walk-out starts | touchdown + 2.0 |
| sign (GGbot) | touchdown +1.8 → +4.8 |
| board blend starts | touchdown +5.3 |
| board view | touchdown +12.03 (≥34.23) |
LAKESIDE_TOUCHDOWN = {signAtS 1.8, signS 3.0, blendAfterSignS 0.5, blendPadS 1.5, blendAimPull .15, event 'qf-lakeside-touchdown'}.

## Her on screen while the sign is up (touchdown +1.8…+4.8; % of width from left / height from top, body + basket box)
390x844/414x896/360x780 x 12–51 y 38–56 · 375x667/320x568 x 15–51 y 32–51 · 390x520 x 19–50 y 32–52 · 768x1024 x 19–50 y 40–59. Ropes run from the basket up into the envelope above this box (not measured separately). Keep the sign in the top 30 % or the bottom 40 % band.
