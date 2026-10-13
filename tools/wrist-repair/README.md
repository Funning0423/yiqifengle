# Wrist repair candidate — visual acceptance remains open

Input commit: ea36c554524ddde406c4f4b0fdfd0ea6a8714010.
Input dynamic GLB SHA256: ca040cc6e20ce8fa58f24cbbe9f38c82654da2fba31817384647bd9e01e3a2e4.
Candidate dynamic GLB SHA256: 8294a71c2fb1ec441f2a0a187620da293c7a0a5d1435273c073304f018797e53.

The palm root and cuff are separate components. Their different forearm/hand weights can separate during flexion. The candidate keeps the palm root ring with the forearm, extends its existing root vertices 8 mm toward the cuff, and grades the existing wrist rings in hand-local space. It changes 68 weighted vertices, including 28 extended root vertices. It does not enlarge the cuff or cover the hand. Forearm roll is reduced during door_reach, with the hand counterrotated to preserve its world pose. Only forearm.L and hand.L rotation channels of that clip change. The mesh topology, normals, UVs, colors, materials, rig, inverse binds, morphs, lower body, runtime driver, board and 13 other clips are unchanged.

Reproduce on a copy of the baseline GLB (the skin script rejects other input):

```
python3 tools/repair_wrist_skin.py --glb /tmp/baseline-copy.glb
python3 tools/repair_door_arm.py --glb /tmp/baseline-copy.glb
```

The reproduced file matched the candidate byte for byte. Door key samples preserve the hand position within 0.000553 mm; 120 Hz interpolated samples differ by at most 0.199874 mm. The maximum wrist local angle changes from 78.865960° to 74.688007°, so this small correction does not establish natural wrist bending.

Actual continuous close views still show a dark cuff/wrist seam at some angles and marked elbow sleeve folding during recovery. The hand does not fly away as a whole, but the reported broken-hand appearance and elbow/wrist naturalness are NOT accepted as solved. The current style and layout are retained; this is not a complete character rebuild or overall acceptance.

Validation: 27 unchanged foot timestep/distance gates PASS; primary 30/60 Hz CPU gates PASS; sit/stand foot deltas remain 1.501065/1.319820 and 1.588176/1.393163 mm. Action contract PASS, Startup 10 checks/8 expected failures PASS, paused restoration contract PASS. Original walk suite retains 1 FAIL (old constant root is also protected by IK, invalidating its comparative assertion) and 2 SKIP (missing foot_flat/heel_off metadata). No thresholds or test assertions were changed. Bounded foot IK clamps remain (up to 132.387321 mm correction and 245 unreachable solves in one configuration).

One Creator build finished in 10 s with exit 36 and existing process/warning behavior. The resulting package is 29,464,913 bytes, main 1,861,856 bytes. Actual WeChat visual/board/storage evidence and all final SHA manifests are saved in task-11/evidence. GPU/phone millimetre proof, phone performance, overall shape/boot matching and complete visual acceptance remain untested or failed. Drawing JPEG capture adds overhead and is not a performance test.
