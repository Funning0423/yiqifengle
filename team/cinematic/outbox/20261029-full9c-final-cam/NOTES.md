# full9c final-cam notes
- GGbot diffs (apply in order on 14f7bc96): RegionNodeStage-finale-rail.diff, BalloonTransit-b1-ease.diff, BalloonTransit-3b-landing.diff. Verified with `git apply --check` and the full suite in /workspace/scratch-final-cam (279/280; navigation-guard BLOCKED_BROWSER = no browser on box).
- 3b has no day/night branch: night uses the same spot as the old B5 close-up (not closer). The landing-move model runs only on day poses.
- /workspace/wt-sf/tools/journey-integration/run-suite.cjs has 1 unresolved conflict marker block. wt-sf is unused; I left it as is.
