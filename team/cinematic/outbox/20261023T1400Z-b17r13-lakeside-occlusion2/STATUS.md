# b17r13 lakeside occlusion 2 — 运镜bot — DONE (code + Node tests + software render); Mac NOT run
Branch cine/b17r13-lakeside-occlusion2 from 5ae6e43b (worktree /workspace/wt-b17r13-lko2). Not pushed.
Commits: 18f703f6 LensGuard + proxies + wiring; ce4d389e hard test lakeside-lens-guard (in suite); 183601de checkpoint; + evidence commit.
## Causes (r13b Mac)
- Canopy / trunks: the b17r7 proxy regex missed LK_ring_tree_* (the tree ring round the play area), seal/ring bushes, the b16
  boardwalk (deck + railings) and bridge steps. The test used the same list, so it passed while the Mac failed.
- Under the deck: LensPullIn cranes allowed −10/−20°, no floor. Close-up through railings: 1.6 m arm floor. Jumps: 9 m/s ease-in
  + 27 m/s hard cap.
- Reward close-up: the lens is HELD at followPose(her start, yaw 0) = (−4.5,3.4,−1.3) (matches the Mac log) with no occlusion.
  The pillar is NOT in any island GLB I have (props merge / palms / lighthouse rays from that pose hit nothing near): it is a runtime node.
## Fix
LensGuard: candidate grid (crane 0–64°, swing ±75°, arm 100/78/58 %) scored for head/chest line, inside/clearance, near-lens
clutter (3×3 view fan ≤ 3 m), floor (her feet + 1.2 m), at her now and +0.6 / +1.2 s along her walk velocity (pre-empts);
replanned every 0.15 s with hysteresis; offset follows a critically damped spring capped at 3.5 m/s and 7 m/s²; aims at her.
Proxies 1017 → 1373 (lakeside) + 824 island cells. Wired: lakeside AND island walk lens; reward held close-up blends to a
planned pose using proxies + the live scene's renderer AABBs (≤ 14 m), which should catch the runtime pillar.
No occluder fading: the lakeside is static-merged (one renderer per merge), so a single tree/railing cannot be faded.
## Test lakeside-lens-guard (geometry, real GLB triangles, NOT render), 10 routes (MAC 57.61 m/8 pts recreated, 4 deck/bridge, 3 canopy, 1 random)
                 before (5ae6e43b)                         after
follow hidden    7 / 53382                                  0
follow fill      7                                          0
orbit hidden     560 / 76260                                160 (0.21 %)
orbit fill       235                                        16
lens under deck  12191 (orbit)                              0
extra speed      110 m/s follow / 23 m/s orbit (per frame)  3.5 m/s
extra accel      1709 / 822 m/s²                            7 m/s²
G1–G4 FAIL before, all PASS after. G5 reward: 0 fill in both, because the Mac pillar is not in the test geometry; wired, not proven.
Residual: bridge straight-over walk (DECK2) orbit 36 hidden frames (railings).
## Suite 159/162 (3 env: 2× Node ≥22.6, navigation-guard browser). lakeside-lens-occlusion replaced by lakeside-lens-guard.
## Package: + ~24 KB source (LakesideLensOccluders 29→41 KB, IslandLensOccluders 20.8 KB, LensGuard ~8 KB). No build.
## Evidence (NOT engine capture): render_*_NOT_ENGINE.mp4 (software ray-cast, left before / right after; MAC route then to the far
boardwalk end), trace_*.json, sheet_*.png, lakeside-lens-guard.json, logs.
## Open: Mac day/night recheck of the walk to the boardwalk and the reward close-up; island free-orbit now also uses LensGuard (check).
