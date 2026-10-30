# Coast arrival — single entry contract (运镜bot, 2026-10-30; confirmed by Grok Bot via GGbot)
`await globalThis.__qfCoast.runCoastArrival(world, {resolveReuse?, cancelled?})` → `{ok, reason, frames, seconds, scene}`; never rejects.
- Caller: WorldNativeComposition.ts:156 only (diff 02, kit on, after `assetManager.loadBundle('region_coast')`, before enterLevel).
  Main package never imports a bundle script; the entry exists only after the bundle's scripts are evaluated.
- `world` = WorldFlowComponent: `worldCamera` (the one camera written), `node` (scene parent), `scheduleOnce` (frame clock),
  `cc.director.getDeltaTime()` for dt, viewport = `window.innerWidth/innerHeight`.
- Order: 1 `__qfCoast.loadCoastScene(world,{resolveReuse,resolveMaterial,cancelled})` (场景设计部, CoastSceneLoader.ts) — awaited FIRST;
  null / cancelled → dispose, `{ok:false}`. 2 `installCoastArrivalHer(world)`. 3 `playCoastArrival` (camera writer `coast.arrival`,
  ends exactly on coastBoardPose → WFC enter-level push-in holds, 0 writes). 4 uninstall in `finally`. Scene kept on success.
- `cancelled()`: WNC passes component/world gone, world swapped, selection changed, journey.region changed; the entry adds world.node invalid.
- `resolveReuse` optional: default = first node of that name under world.node.scene (GGbot's createCoastReuseResolver may replace it).
- Every failure / skip: `console.error('[QF_COAST] …')` (Mac: any [QF_COAST] line = FAIL; fallback count 0).
- Registry: each bundle script MERGES into `globalThis.__qfCoast` (`o=g.__qfCoast||(g.__qfCoast={}); o.x=…`). Never `Object.freeze`
  and never replace the object — script evaluation order inside the bundle is not fixed.
- Owner: runCoastArrival lives in CoastArrivalLens.ts (运镜bot); CoastSceneLoader registers only loadCoastScene / unloadCoastScene.
Open: (1) 1062a72b's loadCoastScene REQUIRES resolveMaterial; the contract has none → today it fails with [QF_COAST] unless WNC/entry
supplies island materials — 场景设计部/Grok Bot to decide. (2) GGbot's d1114808 also defines runCoastArrival in CoastSceneLoader and
registers with Object.freeze({...}) — must be dropped (two registrants, freeze breaks the merge).
Gate: tools/coast-arrival-runtime/test_single_writer_wnc.cjs (loadCoastScene stubbed until 场景设计部's export is merged).
