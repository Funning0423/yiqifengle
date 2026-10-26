# sail-voyage (运镜bot) — option E. See OUTBOX.md (numbers), capture-spec.json (Mac engine frames), rebaseline.cjs (golden re-baseline).
SailVoyage.ts: dock (S-a end/S-b) → time-keyed sail-up swing (4 s) → beam open sea (lens 15 m out, 20° off the beam, looking back-across
through the hull, away from both islands) → progress-keyed approach swing p0.70–0.93 → astern approach. Boat clock unchanged (3.6 m/s).
Enabled only by ?sailVoyage=1 (web QA) until the re-baseline commit flips it on. RegionJourneyAdapter untouched.

## 2026-10-26 retune notes
- Stand-in now matches SEA_STANDIN (−5.6,−0.91,242) s0.335 (2ddfbb44); the old 480 m spot was hidden by the 282.6 m opaque env_sky_dome.
- Head overshoot (ndc ~1.04 at ~18.6 s on tall screens) fixed by swing2 look damp 0.6 (was 0.3).
- Windmill pre-dock frames (19.5–20.5 s) need APP side ≥ −1 with appLs ≈ −1.5; more negative side/ls clips the mill at the right edge, side ≥2 pushes yaw >90 °/s.
- 390x520 windmill 11×12 (h×w) — gate is 320x568-only; scale 0.355 fallback for the scene team (dock ≤3.9 %).
- Reef 0 stays ~13° out of frame in the mid-sea beam (open-sea read), by design.
- 2026-10-26 gate miss: boat-in-frame window started at the end of swing1; now starts at S-c. Swing1 aims boat-relative (aimOf/aimLen blend), DOCK ls 1. 9 s in the before image is the S-b dock shot (boom out of frame before DOCK ls 1).
- Stand-in model scale 0.355 (all-screen windmill gate); 360x780 dock is at 4.0 % — no headroom for a bigger stand-in.
