# Bounded sleeve / door recovery candidate — partial improvement, NOT full visual acceptance

Input commit b281e6da07dae5ac7ebc1ddaad3d1998af37548a, input GLB 245e923f668a4e570d1021ef58aacd871305129b152c30a08e6ea9ffc4969e72.
Final GLB 6e4342028c11b43f2bf1834825e40e70cc3d6176052c95894f88b715e76495a8.

Two bounded candidates: first three post-release arm curves only, then the final candidate with a local sleeve taper. No candidate farm. The first still had 20 elbow face intersections at frame580; it was never built or GPU tested.

Final changes: 360 shared BODY vertices across bilateral elbow rings9..17, radial taper up to30%, capped at12mm; 440 sleeve/neighbor normals recalculated. BODY's three material primitives share these accessors. Cuff/palm/finger positions, topology, UV/color, weights, skeleton, inverse binds, morphs, all lower-body geometry and other animation data remain unchanged. Only door_reach rotations upper_arm.L, forearm.L, hand.L change after0.683333s: smoothstep shortest-arc return from release pose to original2s terminal pose. Contact at0.6333s and initial release remain preserved. Runtime TS/flow/routes/board code and anim_meta unchanged.

Reproduce on a COPY of pinned input:
```
python3 tools/sleeve-recovery/repair.py /tmp/input-copy.glb --report /tmp/repair.json
python3 tools/sleeve-recovery/verify.py /path/to/pinned-input.glb /tmp/input-copy.glb /tmp/preservation.json
```
Reproduction final bytes matched exactly. The proof does not certify appearance.

Offline same camera/light/GLB normals: 15 before/after poses, plus every 1/30s over the 60 door frames. Recovery folding visibly improves. Nonadjacent elbow face intersections: 33/60 frames, peak33, summed762 before; 8/60, peak16, summed69 after. Remaining frames564..578 span contact/release, with the maximum at566. Shoulder intersections remain, peak25 pairs. Classification is by mean bind-space Y<1.19m for elbow; numerical detection is not an exhaustive collision proof. Palm/finger hard joins and cuff root line remain; overall style and boot mismatch remain failed.

Final source alone was built ONCE in Creator3.8.8, Finished12s, exit36 with retained warnings. Final native BODY positions/normals/UV/color/weights/indices match GLB, nonzero joints exact; Creator prunes zero-weight joint lanes. Final imported door key times exact; upper arm quaternion rounding max5.96046448e-8, forearm/hand exact. Library/package/test clip bytes identical. No post-test model/native corrections.

One WeChat window s9 used and closed. The test clone differs only in game.js (fresh memory-only storage) and project.config.json (local project name). Final SHA was tested in actual scene: out665 drawn frames including52 door frames, in493. This is local simulator GPU evidence, not phone/other-angle perfection or performance proof. No global hand detachment observed in viewed door frames; the real camera is predominantly rear-view and cannot establish all-angle wrist naturalness. Original s8 rejected-candidate results are NOT reused as final proof.

27 original foot gates and primary30/60Hz pass.10 action checks pass, contact4.396596mm under original10mm, complete2s recovery before walking. Original walk-suite1FAIL/2SKIP remains. Startup10 checks/8 expectedFailures pass with bundled engine TypeScript. Board swap23↔24: moves22→21, goals15→12; star2→1, goals12→11. Paused reentry remains run.paused; explicit resume run.ready; active state exact through tool/pause/reentry/resume, presentationError null. Memory-only restoration is not cold persistent restoration.

Before/after original74 storage independently snapshotted, size/SHA exact; all78 pre-window files unchanged, one added8B empty file retained. No source/archive/old evidence/Trash deletion, no discarded-build cleanup needed, no whole-engineering copy, no Playwright, upload/publish, credentials/permission changes, Library attempts, cloud large files, or cross-thread messages.

479 package files29,474,293B; main1,861,856B pass unchanged30M/4M limits. Console response truncated65536B: no complete error-free-log claim. Final startup template/art restored before s9 with exact previous bytes; no dedicated first-screen visual capture. Full raw evidence and final receipt live in task-13/evidence; partial visual improvement is reviewable, not whole-model acceptance.
