# Coast arrival — single entry contract (运镜bot r4, 2026-10-30; confirmed by Grok Bot via GGbot)
`await globalThis.__qfCoast.runCoastArrival(world, {resolveReuse?, resolveMaterial?, cancelled?})` → frozen
`{ok, reason, frames, seconds, scene}`; never rejects. Defined in bundles/region_coast/scripts/CoastArrivalLens.ts (运镜bot).
- Caller: WorldNativeComposition.ts:156 only (outbox diff 02, kit on, after `assetManager.loadBundle('region_coast')`, before
  enterLevel). The main package never imports a bundle script; the entry exists only once the bundle's scripts have run.
- `world` = WorldFlowComponent: `worldCamera` (the only camera written), `node`, `scheduleOnce` (frame clock); dt =
  `cc.director.getDeltaTime()`; viewport = `window.innerWidth/innerHeight`.
- Order:
  1. `loadCoastScene(world,{resolveReuse,resolveMaterial,cancelled})`, imported from `./CoastSceneLoader` (场景设计部 1062a72b, same
     bundle; merged into this branch at 9ad1faca), awaited FIRST.
     - Returns null and cancelled → return `{ok:false,reason:'cancelled'}` with no log (teardown).
     - Returns null and not cancelled → `console.error('[QF_COAST] …scene-null')` and the arrival is NOT played (no silent fallback).
  2. `installCoastArrivalHer(world)`.
  3. `playCoastArrival`: the camera writer is `coast.arrival`. It ends exactly on coastBoardPose, so the WFC push-in holds and writes 0.
  4. Uninstall her in `finally`.
- Scene handle: KEPT when the arrival finishes (the board stands in it, returned as `result.scene`). Disposed on cancel, teardown, region
  change or error (here; afterwards by whoever tears down the scene, via `scene.dispose()`).
- `cancelled()`: WNC passes these: component gone, world gone or swapped, selection stageId changed, journey.region changed. The entry adds:
  world.node invalid.
- `resolveReuse` optional. The default is the first node of that name under world.node.scene.
- `resolveMaterial`: passed through unchanged. GGbot supplies it (island materials); WNC 156 does not pass one today, so 1062a72b logs
  [QF_COAST] and returns null → no arrival. GGbot/Grok Bot need to decide where it comes from (entry default from world, or WNC).
- Every failure: `console.error('[QF_COAST] …')`. On the Mac any [QF_COAST] line = FAIL; the fallback count must be 0.
- Registry: every bundle script MERGES into `globalThis.__qfCoast` (`o=g.__qfCoast||(g.__qfCoast={}); o.x=…`). Never use
  `Object.freeze` and never replace the object (GGbot d1114808's freeze-registration of a second runCoastArrival in CoastSceneLoader must
  be dropped).
- Gate: tools/coast-arrival-runtime/test_single_writer_wnc.cjs. It pins 1062a72b's loadCoastScene signature from the merged source,
  then stubs it with that signature.
