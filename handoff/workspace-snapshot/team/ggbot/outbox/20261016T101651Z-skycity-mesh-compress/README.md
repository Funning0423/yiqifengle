# skycity mesh compression — step 1 (local, NOT pushed)
Branch ggbot/skycity-mesh-compress from 4c30cf7 (independent of journey v3/v3.1).
commit bd6763ae6a586d4e54fc078a1e28a5fe2ba9ea31  tree 9b6b6ee18dec61f83d4cf57fcafc674aafcfd9c1
patch sha256 eb74affa32a395362abe04c822cc78aa7865a2e77c952f0880bb32b5b6bc663b
Change: env_skycity.glb.meta userData.meshCompress = {enable:true, compress:true, encode:false, quantize:false} (same as PR58 0d7c940). Test tools/skycity/test_skycity_mesh_compress.cjs.

## Box estimate. Not a Creator build: measure on the Mac.
Baseline: Oct 15 web build region_skycity is 8,004,431 B (7.63 MiB); mesh .bin is 5.08 MiB; anim .bin is 0.49 MiB; builtin-standard EffectAsset JSON is 1.00 MiB; PNGs are 0.53 MiB; mp3 is 0.41 MiB.
| meta option | meshes MiB | bundle MiB | lossless | engine change |
|---|---|---|---|---|
| none | 5.08 | 7.63 | – | – |
| compress (this commit) | ~1.13 | ~3.68 | yes | none |
| encode+compress | ~1.02 | ~3.57 | yes | enable meshopt module (WASM/asm decoder in main package) |
| quantize+compress | ~0.75 | ~3.30 | no (half-float) | none |
| quantize+encode+compress | ~0.49 | ~3.04 | no | meshopt |
Palette 0.96 → ~0.26 MiB (compress) / ~0.12 MiB (all). Robot 0.87 → ~0.19 / ~0.06 MiB.
Quantize error (half float, mesh-local): palette 6.2 cm @75 m extent, foliage 6.2 cm, cloudsea 49 cm @725 m, robot 1.6 cm.
≤3 MiB is not reachable through meshes alone. The remaining lever is the 1.00 MiB builtin-standard EffectAsset copied into this bundle (move to main/shared), plus PR58 ASTC on the 2 PNGs.
