# full6-cam — 运镜bot (base 45f601b1 = ggbot/cand-b19-full5 tip, branch cine/b19-full6-cam)

## P1 L11 hard cut (Mac cut-c 810→811) — FIXED
Root cause: the balloon lease (BalloonTransit.mountBalloonLease, meadow→skycity) never called setRegionBoardSource('skycity').
Only the sail builder in RegionJourneyAdapter (line 176) registers a source. On device, regionBoardHandoff and
regionLandingToBoard both returned 'no-board-pose' → no hold → enter-level ran the generic push-in = cut
(Mac console: `cover motion true` / `shot motion` with no `[enter-level] hold`). This affects every skycity stage entered
after the balloon arrival (L9–L12, r05-sky-*).
Fix (camera/handoff module only, no RegionJourneyAdapter routing change): BalloonTransit captures the prefab root transform
before the placement reset, then registers balloonBoardSource (the same J·B⁻¹ map + anchors as journeyBoardSource) after
placeLiveSkycity. Release drops it.
test-board-handoff: new basketDoorL11/mainline-11 start on all 7 screens, plus wiring guards (register after placement,
release drop, import, LevelRegion covers 11) and a no-source case.
L11 numbers (7 screens): gap 9.2–19.2 m / 109.9°, blend 3.47–7.23 s, yaw max 29.8–62.8 °/s (≤90), yaw-acc p99 13–56 °/s²
(≤200), step 0.083 m (= cap), clearance ≥3 m, first write within one capped frame of the live lens, last = board pose exactly,
hook 'on-board-pose', L10 re-entry 'near'.
Other transition-entered levels: meadow is covered by the sail builder; lakeside has its own lakesideLandingToBoard path;
skycity (balloon) was the only gap.

## Gangway gate — now a real gate (share ≥0.25 %, inFrame ≥0.9): PASS. Worst case 390x520 / 768x1024 boarding at 0.29 %, inFrame 1.

## Suite: 224 PASS / 0 FAIL / 3 BLOCKED (env: legacy-board-ui-pure, reward-background-return, navigation-guard)
## Visibility: --full 235,257 cams, 0 holes; --extra 527 cams, 0 holes (no new skycity poses added)

## P2 — not fixed in this round (NOT_ENGINE; needs engine/Mac confirmation)
- P2a 771→772 / P2b 793→794: not fixed. The contact sheet shows these as real cuts, not blends missed between screenshots
  1.35 s apart. They need a device trace (cam-trace) to tell which writer jumps.
- P2c sky-only pull-back: not reframed. Proposed report-only check: flag a frame when ≥92 % of pixels fall within ΔE<6 of the
  frame's median sky colour (or when no lens ray hits city, cloud or horizon geometry in a 9×16 grid).
- P2d 「暂停一下」 flash — not camera. A restored unfinished attempt reaches run.paused (Mac log 186.2 s
  `level-loading|…|run.paused`), and on reveal ManagedMobileBoardUI.ts:931 opens PausePanel.
  resumeRestoredOnPresent (which skips it) is set only for lakeside (world-r2/NativeWorldLevelAdapter.ts:76,
  requiresLakesideScene). → GGbot (decide whether skycity/autoPlay restore should resume too).

## Meadow 39 s walk: blocker. No corrected path committed after 45f601b1; nothing adapted.
