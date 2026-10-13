# Reconstructed runtime diagnostic renderer

New reconstruction after the executor-context interruption; not the missing historical renderer. Read a frozen actual TypeScript controller trace (`root`, `yaw`, node local TRS, per-primitive morph weights). Never reconstruct a route by concatenating isolated clips.

`replay_skin.py` independently composes every trace node parent transform, applies recorded controller root/yaw exactly once, applies glTF morph displacements before linear blend skinning, and supports all seven baseline mesh primitives. `render_replay.py` displays those positions with embedded original materials/UVs. The camera remains fixed for each selected sequence, and a 0.5 m checkerboard supplies world-space ground references. Source glTF V is flipped only for Blender's UV convention.

Usage (from repo):

```
blender -b -P tools/character-diag/render_replay.py -- --glb /path/character.glb --replay /path/frames.json.gz --out /path/evidence --frames 800 --view q34
```

`--validate-only` does not render: it compares recomposed hip position and independently exported sole positions against actual skinned body vertices (0.05 mm gate). This is a selected numerical parity check, not whole-surface visual acceptance. Explicit `--morph-zero` is a geometry diagnostic and must never be confused with the full production clothing behavior. The manifest records it.

All output is Blender diagnostic, not Cocos footage. No room/door/chair geometry is present, so no scene contact can pass from this renderer alone. Mesh normals are recomputed smooth for this diagnostic, not a claim of identical engine shading. glTF topology, source animations, skin weights, textures and production assets are read-only. Missing frame joints, cyclic hierarchy, unsupported primitives and failed parity gates reject. Output directory and image/manifest files are separate from source.

Tested current Blender4.3.2 lacks OpenImageDenoise; denoising is disabled rather than installing dependencies. Numpy comes from the existing Blender installation. Runtime/metadata source hash and each selected frame's root/yaw/clip/morph remain traceable.
