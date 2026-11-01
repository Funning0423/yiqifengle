# Legacy comparison diagnosis — 2026-10-14

Original suite remains FAIL / 2 SKIP in the diagnostic receipt. Both old and current paths ran the new SoleContactSolver because stripRoot removed root curves but retained sole_contact. The measured worst drift was 1.84 mm on both paths, so the legacy >2x assertion failed despite current drift satisfying the original <12 mm limit.

The corrected negative control omits sole_contact only on the explicitly labeled legacy constant-root path. It measures the whole current pipeline against constant-root without sole correction, not the isolated contribution of root curves. Current drift remains 1.84 mm, legacy drift 320.51 mm, endpoint error 0 mm. All thresholds, clip sequence and endpoint checks are unchanged. Result: 36 checks pass / 2 explicit SKIP. Product code and assets are unchanged.

Two ankle-based checks remain skipped: current rolling-foot metadata lacks foot_flat / heel_off windows. They require valid stance metadata before measurement; zero coverage is not a pass. Sole-vertex tests use a different contact definition and do not turn these skipped checks into passes.

Receipts were produced using the original full checkout at 7ddd667d33abdfa5ccff103233cbb960cb7725da, with only test_locomotion.cjs loaded from this sparse isolated branch by the local run-fixed-suite.cjs adapter. No render/device claim follows from these CPU checks.
