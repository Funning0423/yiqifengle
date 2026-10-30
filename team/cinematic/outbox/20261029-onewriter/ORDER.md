# Ordered apply (verified 2026-10-29 23:0x EDT, fresh scratch, all clean)
Base: cine/b19-full9c-final-cam HEAD 11767f5b (also clean on 18965329).
1-3  final-cam: RegionNodeStage-finale-rail, BalloonTransit-b1-ease, BalloonTransit-3b-landing (01-03 here = copies of wt-final-cam outbox @ 11767f5b)
4-8  clip19 (outbox/20261029-clip19, wt-clip19 553cc08c): RegionJourneyAdapter-lake-departure, test-lakeside-journey-wire, test_lakeside_reach, run-suite-clip19, BalloonTransit-prewalk-cloud-paint
9-14 onewriter: 04-CameraPose-onewriter (merge guard, ours), 05-RegionJourneyCore, 06-RegionBoardLanding, 07-WorldFlowComponent, 08-RegionNodeStage (GGbot), 09-CameraPose-track-start (ours)
04/09 are already committed on cine/b19-full9c-onewriter; on that branch apply only 01-03, clip19 4-8, 05-08.
