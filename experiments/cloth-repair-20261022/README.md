# Experimental cloth-repair code checkpoint — NOT ACCEPTED

This is actual research tooling, not a finished character, integrated game runtime,
new GLB, build16 package, or production release. It uses the already-public Oct18
stage candidate. It is NOT an exact Oct21/latest-asset recovery.

Base commit: `9a47dc69fe3acab3c54e64399b7031a1f69a5217`.
Base tree: `f44e876f1868e48b97da184e82cc511c6555b2e9`.
Only this experiment directory is added. Existing public assets are inherited
unchanged and must not be described as new exports. No private model, NPZ geometry,
Mac source, credentials, recovery bundle, or game build is included.

## Included code

- `polynomial_interval_foundation.py`: outward binary64 interval operations,
  polynomial products and dyadic Bernstein sufficient positivity checks.
- `audit_curve_kinematics_v4.py`: bounds ideal Hermite source-coordinate
  acceleration and speed for an explicitly supplied NPZ curve. Its 1000 m/s²
  source threshold is NOT world-space acceleration, a correction-step limit,
  material acceptance, collision clearance, or a general permission to change thresholds.
- `exact_foundation.py`: exact-rational finite-triangle distances, oriented-side
  primitives and explicit missing-obligation handling.
- `finite_scan.py`: represented-coordinate triangle-pair broadphase and exact
  narrowphase. Not a continuous-time, topology-order, or ideal-skin certificate.
- `material_checker.py`: numerical raw-source edge/area/signed-bend and local-frame
  diagnostics. Not an interval proof or recovered Oct21 formula.
- `pose_evaluator.py`, `glb_io.py`: CPU public GLB/metadata evaluator, linear named
  morph curves and skeletal skinning. The optional memory-only rotation-factor
  method is experimental; defaults preserve the frozen baseline.
- Three original test modules plus `test_checkpoint.py` and
  `verify_public_input.py`: synthetic checks and limited frozen-input CPU smoke.

`SOURCE_MANIFEST.json` records copied source and exported hashes. The only changes
in copied modules are removal of machine-specific import paths and a repository-
relative default public-asset path. `MANIFEST.json` hashes every delivered file
except itself. The active solver and its source directory were not modified.

## Reproduce checks

Tested with Python 3.12.14, NumPy 2.3.5 and SciPy 1.17.0. Use your approved Python
environment with NumPy and SciPy; this checkpoint does not install anything.
From a checkout of this branch:

```sh
cd experiments/cloth-repair-20261022
python -m compileall -q .
python -B -m unittest discover -v
python -B verify_public_input.py
```

The smoke command reads the inherited public files at
`candidates/skirt-v2-normal-h1-20261018/cocos-attrs-r1/`, checks full SHA-256 values,
and evaluates exactly three CPU poses: 0, 0.05345 and 0.1166666667 seconds. An
explicit `--asset-dir PATH` may point to a verified copy of those same public files.
It fails if either input hash differs.

For a separately supplied curve:

```sh
python -B audit_curve_kinematics_v4.py --curve /path/to/curve_nodes.npz
```

Required keys: `times_s`, `apron_D_m`, `apron_V_mps`, `dress_D_m`,
`dress_V_mps`; optional `apron_times_s` / `dress_times_s`. Arrays are node × vertex
× 3 in metres and metres/second; times must increase and preserve common nodes.
This writes `KINEMATICS_V4.json` beside that curve, so use a disposable copy.
The curve is intentionally NOT distributed here. Synthetic integration tests
create only tiny temporary zero curves, not model data.

## Actual verification and explicit gaps

- Syntax compilation passed; 40 unit/integration tests passed.
- Frozen GLB and metadata hashes checked; all 9 evaluated surfaces had finite
  positions at each of the three smoke times. This is not full animation validation.
- Current repair experiments remain unaccepted. A recent candidate still failed
  source material gates despite passing a limited source-acceleration bound.
- No latest curve, optimization modes, source-material interval certificate,
  local topology/protection data, solver orchestration, or current model export
  is included. Full research-run reproduction is therefore NOT claimed.
- Existing interval-material results apply only to their exact curve/hash and
  assumptions, not this branch or arbitrary candidate curves.
- Complete walk, world/correction kinematics, continuous collision/CCD,
  full-layer order, self-clearance, visible shell, actual runtime/import/GPU,
  grounding, sit/stand/turn and artistic quality remain unaccepted or untested.
- Raw-source mathematical `CERTIFIED_*` labels have their explicitly narrow
  meaning only. Neither passing tests nor a numerical optimizer creates a
  complete-character acceptance certificate.
