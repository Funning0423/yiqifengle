# Mac steps — coast runtime scene loader (场景设计部, scene/b19-coast-runtime-loader)
Lock from 全流程测试部 first; one Creator, one DevTools. Nothing below is hand-written: Creator generates every .meta.
Includes 运镜bot's 9be6e8e0 (merged); its MAC_STEPS (team/cinematic/outbox/20261030-coast-arrival-runtime) is folded in here.

1. Open creator-build-project in Cocos Creator 3.8.8, let it import. Creator creates:
   - assets/bundles/region_coast.meta (folder), then in the Inspector tick **Is Bundle** with the same settings as region_lakeside.meta:
     bundleName `region_coast`, bundleConfigID `wx_subpackage`, priority 1, WeChat compression `subpackage`, not remote. Apply.
   - region_coast/{board,data,models,scripts}.meta (folders), board/*.png.meta, data/coast_layout.json.meta
   - models/coast_board.glb.meta, coast_props.glb.meta, coast_rocks.glb.meta, coast_terrain.glb.meta
   - scripts/CoastArrivalLens.ts.meta, CoastArrivalTrack.ts.meta, CoastSceneLayout.ts.meta, CoastSceneLoader.ts.meta
2. For each of the 4 models/*.glb, in the Inspector (Model tab) set mesh compression exactly like region_lakeside/models/*.glb.meta:
   Mesh Compress **enable / compress / quantize / encode = on**, tangents = 1 (as lakeside), LODs off. Apply (Creator rewrites the metas).
   The glbs carry no materials; the loader binds ONLY what the caller's resolveMaterial returns (island/meadow set), never a builtin one.
   Check: each glb's sub-asset tree shows one node per mesh, named like the layout `mesh` (anemone, board_rim, ...).
3. Commit exactly the Creator-generated metas from step 1–2; add their paths to tools/build-guard/meta-allowlist.json "files" (Grok Bot review).
4. Build WeChat (tools/build-guard/build-wechat-guarded.sh). Report: region_coast subpackage bytes (target <= 943,718 B, hard 1 MiB),
   main package (must not change), total <= 24,641,536 B. Run `node tools/build-guard/meta-allowlist.cjs` and the suite.
5. Only after GGbot's single entry is in: run with ?qfcoastkit=1 on 390x844, record island -> coast arrival:
   the coast must already be there on the first arrival frame (no pop-in); the console must show **no `[QF_COAST]` console.error**
   (any one = FAIL: mount failed / missing option / reuse unresolved / material unavailable). A normal play-through never cancels:
   any `[QF_COAST] scene mount cancelled` warn in the Mac test also counts as FAIL (only a real teardown / region change may cancel).
   Without ?qfcoastkit=1: no [QF_COAST] at all.
6. Same-camera side-by-side style check (record, 390x844, same FOV/height/distance/sun, day): one frame each of
   (a) coast board area, (b) island v2.2 beach, (c) meadow ground - identical camera offset to the subject. Compare palette value range,
   saturation, specular, shadow softness. Coast must read as the same material family; attach the 3 frames to the review.

## Single wiring point (no second hook; nothing in WNC from this branch)
The region_coast bundle self-registers ONE `globalThis.__qfCoast.runCoastArrival(world, {resolveReuse, resolveMaterial, cancelled})`
(written by 运镜bot/GGbot). It must `await loadCoastScene(world, opts)` FIRST, then installCoastArrivalHer -> playCoastArrival -> finally uninstall,
and call `handle.dispose()` (or `unloadCoastScene(handle)`) on scene teardown / region change.
- Entry: module export `loadCoastScene` / `unloadCoastScene` from `assets/bundles/region_coast/scripts/CoastSceneLoader.ts` (primary,
  same bundle: `import { loadCoastScene } from './CoastSceneLoader'`); also `globalThis.__qfCoast.loadCoastScene` / `.unloadCoastScene`
  (registered when the module evaluates; merges into an existing __qfCoast object).
- `loadCoastScene(world, opts): Promise<CoastSceneHandle|null>`; world = island scene_root Node (or {sceneRoot|node|root}).
  Handle `{root, placed, reusePlaced, errors, dispose()}`; null = not mounted (already console.error'd, or flag off, or cancelled).
- opts (all REQUIRED, missing one = console.error, nothing loaded):
  - `resolveReuse(name) => Node|null` - an already-loaded island node to CLONE (the loader instantiate()s it, keeps its materials,
    never mutates/releases it). Names (13 / 96 instances), `COAST_REUSE_SOURCES` in CoastSceneLayout.ts:
    reuse_grass_a 25 (env_prop_grass_tuft_01), reuse_grass_b 19 (env_prop_grass_tuft_02), reuse_flowers 16 (env_prop_flowers_01),
    reuse_rock_0 3 / reuse_rock_1 3 / reuse_rock_2 1 (env_prop_rock_01/02/03, normalised: max |x|,|y| 1 m, base -0.1 m),
    reuse_rock_s0 5 / s1 7 / s2 6 (same rocks, preview tinted 38% to #E9D7B0), reuse_bush 3 (env_prop_hydrangea_bush_01),
    reuse_palm_tall 2 / reuse_palm_lean 1 (env_prop_palm_tall_01 / _lean_01), reuse_cloud 5 (env_cloud_01).
  - `resolveMaterial({mesh, kind:'std'|'unlit', alpha, emit}) => Material|null` - caller-owned island/meadow material; null = console.error,
    that mesh is not mounted (no fallback).
  - `cancelled() => boolean` - checked after every async step; true = release loaded assets, show nothing (console.warn, not an error).
- dispose: destroys all instantiated nodes; decRefs the layout + 4 glb prefabs loaded here; never releases island templates/materials.

## Materials (coast_palette, Grok Bot option B, 2026-10-30)
- models/*.glb carry TEXCOORD_0 (texel centres, exact in fp16, kept by meshCompress quantize) into `textures/coast_palette.png` and no COLOR_0
  (tools/coast-scene/coast_palette.py + palette_uv.py, run by build_coast.py).
- coast_palette.png = the island's env_palette_256 layout (256x256, 16 bands x 16 px); bands 0/11/12 rewritten as 4-px coast swatches;
  band 13 (emissive) and every other band byte-identical to the island, so the island M_env_palette's emissive map still lines up.
  The island env_palette_256.png is not touched (pinned in test_coast_scene_loader.cjs).
- Creator: let it import textures/coast_palette.png (Creator writes coast_palette.png.meta + the texture sub-asset; do NOT hand-write).
  In the Inspector set the texture like the island palette sampler: Min/Mag filter **linear**, Mip filter **linear** (mipmaps on),
  Wrap S/T **clamp-to-edge**, no premultiply alpha, no fixAlphaTransparencyArtifacts; not in an auto-atlas. Apply. (RGB PNG, 2,951 B:
  2,193 distinct colours, so lossless 8-bit indexed is impossible; WeChat build copies the PNG as is.)
- No new material asset: the loader clones the island's shared **M_env_palette** at runtime (`new Material(); m.copy(island)` = same effect,
  technique, defines, pipeline states and properties incl. roughness 0.9 / specular 0.4 / emissive map) and sets only `mainTexture` =
  coast_palette. One clone per island material, destroyed by dispose(); the island material is never modified.
- resolveMaterial(key): `key.palette === true` -> return the island's M_env_palette (combined_visual_m.glb sub-asset
  61fa04e2-644b-5997-bfd1-812b61d3586b@18b7e, `assetManager.loadAny({uuid})` like IslandProps.ts). `key.palette === false` (foam,
  foam_inner, contact, footprints, blob, net, crabtrap_mesh, tide_sheet, sidepool, beacon_line: translucent / unlit) -> GGbot's choice of
  island material (e.g. M_env_sea_foam), used as returned.
- **Confirm on the Mac** the base-colour texture property name of the island M_env_palette's effect (assumed `mainTexture`,
  `COAST_MAIN_TEXTURE` in CoastSceneLoader.ts): in Creator select combined_visual_m.glb > M_env_palette and check the property, or in the
  ?qfcoastkit=1 run look for `[QF_COAST] coast_palette swap failed`. The loader reads the property back after setting it; missing property,
  a throwing setProperty or a read-back mismatch = console.error [QF_COAST] and that mesh is NOT mounted (island colours are never shown).
- Mac check: step 6 side-by-side must include the coast sand next to the island beach sand (same camera) - final colour judgement is the
  engine screenshot, not the Blender Cycles previews.
## Material red line - BLOCKED for the correct look (see README)
Island v2.2 (combined_visual_m.glb M_env_palette, sub-asset 61fa04e2-...@18b7e, loaded via assetManager.loadAny like IslandProps.ts) and
meadow (env_meadow.glb M_meadow_palette, meadow even recompiles USE_VERTEX_COLOR:false) are palette-TEXTURE materials: colour comes
from TEXCOORD_0 into env_palette_256. The coast glbs have POSITION/NORMAL/COLOR_0 only (no UVs), so any island/meadow material
would sample one texel. The coast meshes must be re-baked with palette UVs (build_coast.py, vertex colour -> nearest palette texel)
before resolveMaterial can give the real look. Until then the Mac step 5 run will show material errors or wrong colours by design.

## Pending Creator metas (GGbot, Grok Bot 2026-10-30)
Every .meta Creator must generate is listed exactly (one path per line, no wildcards) in `tools/build-guard/meta-pending-creator.txt`. After the Creator import: commit those metas and remove each line; the `meta-missing` gate fails on a stale line (meta exists), a wildcard, and on any bundles/** asset without a meta. The list must be empty when the Mac step is done.
