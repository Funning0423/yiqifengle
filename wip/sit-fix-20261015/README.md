# Task21 frozen static WIP comparison — not a product fix

This isolated bundle records the unfinished lower-stool/support, hand03 and tail10 experiment. Product files outside this directory are unchanged from c9be589c108a3c79361197bcbb49f447ef453f11. Its frozen product file source is 751905c985e4e0c898f395456c3b2a41ff7a1376. No cloud candidate has been adopted into the character GLB, animation metadata or runtime.

## Scope and known failures
- Support: stool lowered 47.160 mm; seat thickness 45.599985 mm retained; legs shortened to ground, crossbars translated rigidly. Original body proportions and flat feet preserved. Static BODY/chair crossing pairs and sampled interior points are zero. This does not certify support mechanics or natural sitting.
- Hand03: four upper-arm/forearm local rotations. Original hand local rotations, all translations/scales and other bone rotations remain. Finger-pad gaps about 0.59 mm; left support thumb-biased, palm-root gap about 4.14 mm. Naturalness and load-bearing are not accepted. Exact four-bone deltas are in rotation-delta-and-transition.json; transition release interval is unselected.
- Tail10: absolute actor-local posed BOW target, bit-identical to tail09 positions. Only face IDs 326/327 change. This changes the actual interior surface by up to 5.014830 mm; it is not merely an invisible index change. Seat gaps 2.883328/0.334392 mm. Width/length residuals and appearance require review.
- Combined endpoint: no additional audited intersections from composing these frozen candidates. Existing BODY self166, BOW self126, BOW/APRON14 and DRESS/chair505 remain. Zero new pairs never means all geometry is clean.
- DRESS has no acceptable target. The two structural reports document the baseline/rest-length and crossbar material-route problem. Failed continuous-field03 produced new collisions; it is intentionally not included as a repair. Ongoing solver outputs are excluded.
- No visual acceptance, native/mobile validation, continuous sit/hold/rise validation, walking-return cycle or performance acceptance. The separate rise72 work is not part of this snapshot.

## Contents and coordinate rules
`diagnostics/` contains frozen arrays, selected audit reports and three CPU-rendered reference views. Images are offline geometry views, not game screenshots. `repro/` contains a standalone composition check and only its five necessary helpers. `MANIFEST.json` lists every payload file, byte size, full SHA256 and original source SHA256.

World matrices already include the selected gravity correction. Do not apply it twice. BOW target.npy is the final actor-local posed target, not a bind mesh: do not skin it a second time. faces.npy is a diagnostic topology override. DRESS/APRON retain the original GLB under the frozen hand03 gravity matrices. Chair world triangles are converted using historical frame31768 root/yaw.

All report paths were normalized for packaging: diagnostic paths are relative to this WIP directory; REPOSITORY_ROOT denotes the checkout root. Old toe-contact-preview aliases point to the canonical lower-chair-design candidate here. Report hashes embedded in original evidence refer to original files; use MANIFEST.json for packaged-file hashes. Some provenance paths intentionally reference excluded historical evidence and are not runnable dependencies.

## Reproduce the static composition
From the repository root, with Python, NumPy, SciPy and Pillow available:

```sh
P=wip/sit-fix-20261015
python "$P/repro/reproduce_snapshot.py" \
  --source "$PWD" \
  --replay "$P/repro/frame31768-replay-subset.json" \
  --world "$P/diagnostics/hand-lap-support/candidate-03/gravity-world.npy" \
  --chair-world "$P/diagnostics/posterior-seat-support-ik/lower-chair-design/candidate-preserve-seat/chair-world-triangles.npy" \
  --tail-target "$P/diagnostics/pose-review/lower-chair-bow/tail10-root-diagonal/target.npy" \
  --tail-faces "$P/diagnostics/pose-review/lower-chair-bow/tail10-root-diagonal/faces.npy" \
  --out /tmp/task21-wip-review --frame 31768 --no-render
```

Remove --no-render to produce front/side/back CPU renders. This reproduces the frozen composition, not solver optimization or the full collision audit. The packaged no-render check exited 0 with maximum BOW reconstruction error 3.3429341157592284e-16 m. This numerical check is not visual acceptance.

The 18 KB replay subset preserves only original frame31768 from the historical 2213-frame capture, full source SHA256 a129e12fd490c4139d589dfc1a53927f90402173b7db7ab4a698525aff48b213. It is not a new native capture of 751905c. Product GLB SHA256 must be 42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec; metadata cefb3e4261592da20be40c9ada49a8f51354fc93f5557da7f178c79b40ea60e6.

Only helper path resolution was adapted for standalone packaging; source/helper hashes are recorded. Original workers and their clean product worktrees were not edited. No historical repair directory, entire replay, old candidate suite, credentials or unrelated data is bundled. Do not merge this WIP folder as a completed runtime repair.
