# Mac steps — coast arrival runtime (运镜bot, cine/b20-coast-arrival-runtime)
Lock from 全流程测试部 first (and no `.build.lock` held by anyone else in the project root; create it for the run, remove after);
one DevTools; free disk >= 9 GiB. Any console line containing `[QF_COAST]` (console.error) at any step = FAIL; fallback count must be 0.
1. Open creator-build-project in Cocos Creator 3.8.8 and let it import. Creator creates (do NOT hand-write):
   - creator-build-project/assets/bundles/region_coast/scripts.meta (folder)
   - creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalLens.ts.meta
   - creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalTrack.ts.meta
2. Commit exactly those 3 metas; add those 3 paths to tools/build-guard/meta-allowlist.json "files" (Grok Bot review) — nothing else.
3. Build WeChat (WITHOUT diff 02); report the region_coast subpackage bytes (must stay <= 943,718 B) and the main package bytes
   (must not change vs the previous build). grep the main package for `COAST_ARRIVAL_TRACK` / `__qfCoast` / `coast.arrival`: 0 hits.
4. Self-registry on Creator 3.8.8 (still without diff 02): in DevTools console on the built game run
   `cc.assetManager.loadBundle('region_coast',(e)=>console.log('[YJ_REG]',e,typeof globalThis.__qfCoast?.runCoastArrival,typeof globalThis.__qfCoast?.loadCoastScene,Object.isFrozen(globalThis.__qfCoast)))`
   PASS = `[YJ_REG] null function function false`. Anything else = FAIL (stop; diff 02 must not be applied).
5. Only after diff 02 is approved and applied: rebuild; main package grows only by WNC line 156 (desktop estimate +1,391 B minified,
   no new module / require); region_coast unchanged vs step 3.
6. Run with ?qfcoastkit=1, record island->coast arrival + board landing (screen recording) on 390x844 AND 390x520:
   - [QF_CAM] writer = coast.arrival only until the board pose, then 0 world.enterLevel writes; 0 `[QF_COAST]` lines.
   - her height on 390x520: measure her on-screen height (head top to sole, px of the 520-high view) in the recording at every frame
     <= 38.867 s of the arrival; report the minimum and its time. Gate: >= 38.5 px (desktop real-walk replay predicts 35.3-35.6 px = FAIL).
   - note which clips she plays in S7 (desktop replay: walk_loop only, no walk_start / walk_stop; see STATUS).
7. Kit off (no ?qfcoastkit): same level entry as before the patch, 0 `[QF_COAST]`, no region_coast load from line 156.
