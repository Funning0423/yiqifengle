# 运镜bot full8-cam — cine/b19-full8-cam on 3ec2dd26 (local, not pushed)
All images NOT_ENGINE (proxy ray-cast, no engine on this box) except MAC_m2_585-594_reference.jpg (copied from the full7 m2 report).

## Commits (3ec2dd26..HEAD)
60cd5ffd cam-trace switch exactly true/1/'1'/'true' + test · 9720cb2c b1PreWalkLens (prewalk p99 908→147, 7 screens) ·
07608a25 solid-colour gate + windmill→balloon segment · 2a8e4737 camera-collision gate · 98a17aa9/edac0204 S6 recheck test ·
d581257f replay fixture (superseded) · b4df9721 collision gate HARD (rules 1+2) + collision-gate.cjs --trace + m2 must-fail ·
1e1be2b3 planAgree check · bb00af56 close-up lens ≤11 m/s + B1 spot avoids meadow windmill/sails/trees · b3a8da63 S6 SkyPreFollow wiring

## Collision gate (HARD rules 1+2, AABB report-only) — Grok Bot approved 2026-10-26 07:37 EDT
(1) no surface within 1.1 m (26 rays); (2) not enclosed (one of 14 × 20 m rays escapes); (3) AABB report.
Proxy: 28 rows (sail/balloon/lakeside/windmill→balloon × 7 screens) 0 violating. FP found + fixed in definition: 400 m enclosure
flagged the lakeside descent under the island (open air) → 20 m. AABB: meadow_trees_merged covers the meadow → report-only.
Mac tool: `node tools/journey-integration/collision-gate.cjs --trace <camtrace> [--expect-fail] [--require-plan-agree] [--json f]`,
node frame (M6 world (−1.514,5.33,77.281)). m2: 5,689 writes, 786 meadow writes checked, 302 violations, 115 enclosed
(collision-gate-m2.json). Spans: prewalk t 123.3–129.9 inside windmill_static_merged (f 2944–3132); prewalk end blend t 139.7–140.5 +
B1 140.5–141.2 inside / within 1.1 m of a meadow tree (f 3487–3523); B1 147.9–150.5 near trees. Suite: collision-gate-m2-mustfail.
Frame map (3.66 shots/s, 594 = B1 c0 hold ≈ t 140.46): 591–593 ≈ t 139.7–140.3 = the tree span; the windmill span ≈ capture 541–565.
planAgree: trace B1 first (−20.587,8.248,89.609) vs proxy plan.camera(0) (−20.214,8.436,62.981): gap ≈26.6 m → FAILS until GGbot's
M6/plan fix lands (stale BalloonTransit.ts:40 M6_LOCAL; plan TransportLeg.ts:556 via BalloonTransit.ts:335).

## B5 / B1 close-up speed
speedSafeS: blend ≥ 1.875·D/11 m/s. B5 77 ms step 1.88 (Mac) → 0.847 m proxy, yaw 23/p99 16, her 29 %. B1 blend-in 0.746 m, B1 p99 198 (unchanged ≤200).
Open: B1 close→cam0 return 1.721 m per 77 ms (bounded by sitDown·.9 so the flight starts on cam0) — reported (st77back), needs GGbot's
flight-from-live-pose change to lengthen. B1 spot now also clears MeadowLensBoxes (windmill, sails, 10 trees) × meadow node.

## Meadow m2 410–429 (her not in frame ≈3 s)
Writer RegionJourneyCore:onFrame (sail leg, trace t≈93–98). Runtime lens = proxy sail cam ≤0.7 m to t 96; proxy has her in frame
(x −0.53..−0.56, chest, unoccluded). ⇒ her/boat runtime position differs from the plan at that time (not the lens). Needs her world
pos in the trace (proposal to GGbot: add actor pos to camActorProbe lines); not fixed.

## S6 resume follow (679a937b) → SkyPreFollow (b3a8da63, one line in GGbot's WorldNativeComposition.resumeSkyAtS6)
yaw 172 → 71.7 °/s, p99 219/238 → 212/218 (HARD now). Hidden by env_sky_ruins: S0 1.6 s, S3 1.15 s (>0.5, report-only).
Crane +1/+1.5/+2.5 m makes it worse (foliage cards overhead). Geometry for 场景设计部: env_sky_ruins wall top at skycity-local
y≈2.1 at (4.27,2.08,10.62) [her (6.24,1.48,7.82), S0 walk t 32.5–35] and (5.58–5.85,2.1–2.2,1.28–1.39) [her (2.99–3.51,1.48,−1.3..−1.8),
S0 t 44–45.5 = S3 t 9.5–10]: lower those wall tops below ≈1.5 m or open 1.5 m beside the path (lens sits 0.3–1.2 m from them).

## Suite / visibility
Visibility --full PASS (235,257 cams, 0 hits). Suite on edac0204: 237 PASS; sky-resume-s6 FAIL (Node ≥22.6 needed, 679a937b test,
env); sky-resume-follow FAIL (my comment bug, fixed in edac0204); 3 env BLOCKED. Final suite on b3a8da63: /tmp/f8-suite2.log (running).
