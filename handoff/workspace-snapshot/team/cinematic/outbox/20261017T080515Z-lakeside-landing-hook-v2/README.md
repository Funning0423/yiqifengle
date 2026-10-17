# 风铃湖畔 landing→board hook v2 (运镜bot): the journey ends on the current screen's board camera; camera code only; local, not pushed

Main commit: 4bd6ba3c937e476cbc4470990c33350ead5436d7, tree 1c682593745380184ad6e0bf8d73a22d8a7a9a40, on cine/lakeside-hook-r2-v2. Parent: r2 228df2f.
- This one commit contains the whole lakeside camera change against r2. It replaces 26be951 and d9f5c3e, and their 360x780 / 390x844 fixed-reference wording.
- Suite: 65/70. The 5 failures are the known ones: production-integrity, legacy-board-ui-pure, reward-background-return, navigation-guard (BLOCKED_BROWSER), cloud-web-contract. All 16 lakeside tests pass, including the new lakeside-landing-hook.

Pre-resolved variants for r3 (cherry-pick conflicts resolved by keeping both sides; lakeside tests pass, full suite not run):

| on | branch | SHA | conflict |
|---|---|---|---|
| journey-merge 55d1922 | cine/lakeside-hook-v2-on-journey-merge | d71aa62abf6ac18ae06fa5efd62d49de2b84b836 | RegionJourneyAdapter imports (keep both) |
| Voice Bot art-engine-r2 f7f892f | cine/lakeside-hook-v2-on-voice-r2 | 3d0650ae162c932a7893efb6669c1f5063fb5d15 | run-suite test list (keep both) |

All three are in lakeside-landing-hook-v2.bundle; the matching patches are in patches/.

## Behaviour
1. **The landing end is solved per screen at runtime.**
   - When the journey is prepared, RegionJourneyAdapter sets L.landing = lakesideScreenLanding(L, lakesideScreenFrame(viewport, boardSafeInsets)). The viewport and safe insets are the board UI's own frame.
   - The arrival aim (arrivalYawDeg, a new key that comes out 0 on every screen tested, plus arrivalPitchDeg) and arrivalFovDeg are set to that screen's board camera. The lens position is not changed, so clearance and the lens-on-her-right rule are unchanged.
2. **The screen difference is absorbed on the arrival S-curve, not in the hook.**
   - The arrival blend is one smootherstep over the last 14.3 m: 6.2 s before she stops with the constant-speed walk, 6.7 s with the timed walk. It reaches 1 at 0.5 m before the stop.
   - View and FOV share one weight, so the zoom is monotonic. I tried a separate 3 s overlay first: it reversed the zoom on 360x780 and 375x667, because the arrival FOV ramps up while the correction pulls it down. So I dropped it.
3. **Hook targets are met on all screens.** The FOV and view changes during the 1 s hook are about 0, against targets of ≤3° and ≤2°. A real residual only appears if the viewport changes after the journey is planned. Beyond 10° view / 15° FOV, or away from the landing position, the hook does a plain cut instead of a blend.
4. **Failure path.** If the 3 s prewarm wait fails or times out, the hook writes no camera pose and returns {ok:false,'lakeside-assets-not-ready'}. enterSelectedLevel then runs the existing lakesideFallback('board') from 240ac97 / be1cd5a: [QF_LAKE] goes to the log only, she returns to the island, and the HUD shows only the toast 「湖畔暂时没准备好，先回小岛吧」. No new UI. The hook never rejects.
5. **Compatibility.** GGbot's source-regex tests (journey-atmosphere `landing:L.landing,timing:L.timing`, and lakeside-fallback's mock hook that resolves undefined) pass unchanged.

## Residual table
residual_table.md lists all five screens. Per-frame data for every screen (last 3.5 s of both walk models, then the hook: t, dt, pos, forward, FOV, angular velocity, FOV rate, displacement) is in curves/perframe_last3s_and_hook_all_screens.json (runs.*). The plot is curves/v2_last3s_hook_390x520_390x844.png.

## Notes
- **Walk model in game.** The in-game walk is still the controller's constant-speed plan: the frozen FlowReferenceStandin ignores distanceAt until the reviewed patch lands. Both walk models are tested.
- **390x520 zoom.** The FOV goes 48 → 71.3° over the arrival. That is 10.1° in the last 3 s, peaking at 7.3°/s with the constant walk; with the timed walk it peaks at 9.6°/s about 4 s before the stop. The +14° gap is no longer in the hook. Grok Bot still has to rule on whether this zoom is acceptable.
- **Her position in frame.** Her chest is at x ≈ 0.29–0.41 of the width, inside 20–80%, with the lens on HER right (she reads left of centre), as in every earlier round. If "her on the right of frame" was meant literally, that would be a framing change and needs a ruling.
