# b15 balloon / walk / K3 (base gbt/r5-integrated-b14 e567125a)
1. Reveal: mooring lake-local [9.5,0.61,23] is NOT in any board view (390x844, 320x568, 390x520, 844x390; frustum test + render).
   Free look yaw +35 deg (b14 test) shows the basket but crops the envelope at top/right (balloon centre ndc x 0.85 at 390x844).
   Recommended reveal read: yaw +42 deg, pitch +8 deg from the board lens -> whole balloon + her at 320x568 / 390x520; 390x844 still touches the edges (narrow width, 6.8 m away). No code change: free look already reaches it.
2. Shore walk: camera does NOT follow. Board lens holds; she exits off-screen right and walks into the board frame
   (ndc x 1.33 -> -0.41 in 390x844) and stops on her unchanged shore root = board centre, so the end pose matches with no blend.
   A follow would leave the board pose and need a return blend before the board UI takes over. Code still has walkMps 1.2 (8.36 s);
   at 0.8 m/s (~12 s) she is off-screen ~7 s, so the walk start should overlap the board fade-in / UI intro.
3. K3 dwell: on b14 timing 0.34/0.42 holds only 0.66 s. Set SAIL_K3_IN 0.32, SAIL_K3_OUT 0.44: hold 0.99 s,
   swing 85.6 deg/s, 288.5 deg/s^2, 48.2 m/s^2 (caps 110/360/60). K7 still (u 0.40) stays in the hold.
