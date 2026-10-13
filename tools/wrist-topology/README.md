# Wrist topology candidate — visual acceptance remains failed/open

Input commit: 99c314f619371765603e486f68746e1de6a748f3.
Input GLB SHA256: 8294a71c2fb1ec441f2a0a187620da293c7a0a5d1435273c073304f018797e53.
Final GLB SHA256: 245e923f668a4e570d1021ef58aacd871305129b152c30a08e6ea9ffc4969e72.

The sleeve has a 20-vertex open inner cuff boundary. The palm is an independent closed 86-vertex shell with a 14-vertex proximal fan; fingers remain five independent 30-vertex shells. No same-position vertices with conflicting hand weights were found in the input inspection. Topological separation does not by itself prove a visible spatial gap. The preceding 8 mm extension actually affected the second wrist ring, not the proximal fan/root ring; a cap inversion was checked and disproved.

The candidate removes 14 proximal fan triangles per palm and adds a 34-triangle cuff-to-palm skin annulus per side. Forty UV seam vertices share exact cuff positions and weights. Both edge multiplicity and opposite shared-edge directions are verified. Existing positions, sleeve outline, fingers, UV/colors, materials, rig, inverse binds and every clip are preserved; only proximal connection normals and five elbow-ring weight distributions per side are revised. No sleeve enlargement, palm hiding, animation removal or lower-body change.

The elbow rings previously had up to 26.6% within-ring forearm-weight spread. Uniform ring weights remove that variation, but do not remove the visual failure. The real driver reaches approximately 115 degrees elbow flexion; rest-relative forearm twist is -44.0..42.6 degrees. Non-adjacent sleeve triangles still intersect in recovery (25 pairs at frame 580; 31 at frame 610). Other sampled intersections are at the shoulder, not all at the elbow. The broad sleeve profile under the existing recovery pose requires a cloth correction or pose reauthoring beyond this connection/weight repair. Palm/finger hard joins and overall shape/boot mismatch remain.

An early version (GLB 544cd656bd112545cc568e4d78f2e918c548ffec67a2f3ec13c1a375f0828319) incorrectly oriented annulus triangles independently by radial normals. It had 62 same-direction shared seam edges and was rejected. The final script retains consistent zipper winding and tests it explicitly. The early version's WeChat s8 videos must never be presented as final-version GPU proof.

Reproduce the final source on a copy of the pinned input:

```
python3 tools/repair_wrist_topology.py --glb /tmp/input-copy.glb --report /tmp/repair.json
python3 tools/verify_wrist_topology.py /path/to/input.glb /tmp/input-copy.glb
```

The reproduction matched the final GLB byte for byte. Final 27 foot timestep/distance gates and primary 30/60 Hz CPU gates pass with the original thresholds. Existing 1 FAIL/2 SKIP and bounded foot IK clamps remain. Action, startup and paused-entry contracts pass; they do not certify appearance.

Exactly one Creator build and one WeChat window s8 were used, then s8 was closed. It recorded the rejected early version. Final source winding/normals were corrected afterward. `patch_wrist_native_winding.py` verifies the imported source vertex attributes and indices before patching only normals/indices in the generated body mesh. Creator prunes zero-weight joint lanes to zero; nonzero lanes and all weights remain exact. Serialized mesh hash is reset to zero so the engine's official `Mesh.hash` getter recomputes murmurhash2(data,666). No second Creator build or window reopen. This postprocessed final package is **NOT runtime/GPU verified**.

The existing tracked startup template and three art files were restored after building and checked against previous package bytes. The final startup overlay was not rerun in s8. Package: 479 files, 29,473,304 bytes, main 1,861,856 bytes. Full source, package, storage and window receipts are in task-12/evidence. Original task-9 74 storage files and all 77 pre-window files remain size/SHA identical; one added 8-byte empty file is retained.

Final visual status: topology connection verified; no confirmed complete elimination of the broken-hand appearance; elbow sleeve folding/self-intersection remains. Final full-scene GPU/phone proof, all-angle hand naturalness, phone performance and cold persistent restoration are not established.
