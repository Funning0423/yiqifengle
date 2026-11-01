# Frame and distance contact repair

Input: `ad7d15707b8ebed39fcdd6d86b5fa4e8b5c91168`. All GLB and metadata bytes are unchanged.

The old contact solver sampled rendered endpoints and released swing corrections by a per-frame factor of .8. Its right-shoe floor (-2.560 mm), derived from the animation minimum, delayed contact compared to the shared controller ground. At 30 Hz a sole point at 5.316 mm was already inside the unchanged measurement window, but not inside the solver's 3.440 mm acquisition window. Stop-to-idle also discarded live anchors.

Controller time is now integrated with pose, root, blend and IK in steps of at most 1/120 second. The caller's elapsed time is consumed, including partial steps. WorldFlow's existing foreground 100 ms cap and pause contract remain. Both feet use controller Y as ground. Solver acquisition is 6 mm and release is 12 mm (state hysteresis); the acceptance window remains 6 mm with the original four-sample minimum. Swing correction releases by `.8^(60*dt)`, and zero-time resampling does not decay it. Live stop contacts persist through idle; non-locomotion clips reset them. Root path, hips, arms, clip data, actions and warp budgets are unchanged.

`test_timestep_matrix.cjs` reuses the original `slideOf`. It checks 30/60 Hz and alternating 8.33/41.67/20/33.33/90/6.94 ms steps over 3.0 to 3.7 m and 4.198 m. It verifies integrated time, endpoint error below .001 mm and actual swing lift above 20 mm. The previous rate-one baseline 4.32 mm is frozen for the original warp budget; toDoor retains 12 mm. This does not relax a gate using a newly measured baseline. The unchanged original walk suite also passes the tighter current 3.7 m budget (3.78 mm).

Before/after results are in `evidence/timestep-before.json` and `timestep-after.json`. toDoor 30/60 Hz is 1.82/1.84 mm; 3.7 m is 1.72/1.74 mm. Alternating steps give 1.74/1.69 mm respectively. Stand contact remains 1.588/1.393 mm.

The original suite retains one failed comparison (the old constant-root path is also corrected, so it is no longer twice as slippery) and two skips for absent ankle-stance metadata. Some IK targets still require bounded reach clamping, especially unplanned-stop fallback paths. No claim of all targets being reachable, GPU millimetre acceptance, phone performance, elbow/wrist naturalness, boot matching or overall artistic acceptance is made. One local Creator build and one WeChat window are recorded in task-10 evidence.
