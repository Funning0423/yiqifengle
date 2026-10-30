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
   Mesh Compress **enable / compress / quantize / encode = on**, tangents = 1 (as lakeside), LODs off. Keep Vertex Colors (COLOR_0) — the
   loader binds builtin-standard / builtin-unlit with USE_VERTEX_COLOR; the glbs carry no materials. Apply (Creator rewrites the metas).
   Check: each glb's sub-asset tree shows one node per mesh, named like the layout `mesh` (anemone, board_rim, ...).
3. Commit exactly the Creator-generated metas from step 1–2; add their paths to tools/build-guard/meta-allowlist.json "files" (Grok Bot review).
4. Build WeChat (tools/build-guard/build-wechat-guarded.sh). Report: region_coast subpackage bytes (target <= 943,718 B, hard 1 MiB),
   main package (must not change), total <= 24,641,536 B. Run `node tools/build-guard/meta-allowlist.cjs` and the suite.
5. Only after the WNC hook below is approved and applied by GGbot: run with ?qfcoastkit=1 on 390x844, record island -> coast arrival:
   the coast must already be there on the first arrival frame (no pop-in), [QF_COAST] logs no "scene mount skipped" / "missing meshes".
   Without ?qfcoastkit=1 the build must log nothing [QF_COAST] and not load region_coast.

## PROPOSED hook (NOT applied — WorldNativeComposition.ts is GGbot-owned; replaces 运镜bot's 02-...diff.PROPOSED body)
```ts
// kit-on branch only, after setEnterLevelEnd(...)
const cam=this.worldCamera;
if(cam?.node?.isValid){try{
  await new Promise((ok,no)=>assetManager.loadBundle('region_coast',e=>e?no(e):ok(null)));
  const m=await import('../../bundles/region_coast/scripts/CoastSceneLoader');
  await m.runCoastArrivalWithScene({camera:cam,viewport,nextFrame,her},{parent:<island scene_root node>});   // mount (hidden) -> show -> camera
}catch(e){console.warn('[QF_COAST] arrival skipped',String((e as any)?.message??e));}}
```
`<island scene_root node>` = the node the island visual (combined_visual_m.glb) hangs under (identity frame of coast_layout.json placement).

## Known gaps (need an owner answer, see README)
- 96 `reuse:true` instances (island rocks/grass/flowers/bush/palms/clouds) are not in region_coast; the loader skips + counts them unless
  the hook passes `resolveReuse(mesh)` returning an island template node. Where those island props live at runtime is GGbot's call.
- Animated entries (anim:*) are placed static; the preview's procedural water/sky/seabed are not part of this loader.
