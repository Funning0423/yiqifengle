// r4-prep A (lead): the 风铃湖畔 board is preloaded during the arrival/landing (a batch of instances per frame, on the board layer,
// camera off) and the board entry adopts it, so the swap frame only turns the board camera on (no instantiate / onLoad / merge /
// water compile there). Structural checks of the real sources (a full lease needs the engine; see README Mac checks).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),ja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8'),wn=fs.readFileSync(S+'world-r2/WorldNativeComposition.ts','utf8');
const run=(n,f)=>{f();console.log('PASS',n);};
run('start: the journey arrival (w >= 0.9) and the landing hook preload (not awaited) both start the one idempotent preload',()=>{
 assert.match(ja,/export const LAKESIDE_BOARD_PRELOAD_W=\.9;/);assert.match(ja,/lease\.progress=d=>\{walk\(d\);if\(!dead&&lakesideAtmosphereWeight\(route,total,d\)>=LAKESIDE_BOARD_PRELOAD_W\)void preloadLakesideBoard\(\);\};/);
 assert.match(wn,/preload:\(\)=>prewarmLakesideAssets\(\)\.then\(r=>\{void preloadLakesideBoard\(\)[^}]*;return r;\}\),/,'the hook still waits for the assets only');
 assert.match(bg,/export function preloadLakesideBoard\(\):Promise<unknown>\{\n if\(boardPreload\)return boardPreload\.promise;/);});
run('spread: instances a batch per frame, then components enabled a batch per frame, camera off, board layer first',()=>{
 assert.match(bg,/if\(yieldFrame&&n%LAKESIDE_PRELOAD_BATCH===0\)\{await yieldFrame\(\);token\.check\(\);/);assert.match(bg,/export const LAKESIDE_PRELOAD_BATCH=24;/);
 assert.match(bg,/if\(pre\)instances=await mountLakesideScenery\(scenery,token,take,pre\.yieldFrame\);else instances=await mountLakesideScenery\(scenery,token,take\);/,'normal entry unchanged');
 const a=bg.indexOf("step='preload-activate'"),l=bg.lastIndexOf('setLayer(scenery);',a),c=bg.lastIndexOf('camera.enabled=false;',a);assert(a>0&&l>0&&l<a&&c<a,'layer + camera off before anything activates');
 assert.match(bg,/for\(const k of kids\)k\.active=false;rig\.active=true;\n   for\(let i=0;i<kids\.length;i\+\+\)\{if\(isValid\(kids\[i\],true\)\)kids\[i\]\.active=true;if\(\(i\+1\)%LAKESIDE_PRELOAD_BATCH===0\)\{await pre\.yieldFrame\(\);token\.check\(\);\}\}/);
 assert.match(bg,/setTimeout\(go,50\)\/\* paused game: never stall \*\//);});
run('swap: adopted lease keeps its rig active; the camera shows only when visible AND the board host is shown (reveal), lighting as before',()=>{
 assert.match(bg,/const showCamera=\(\)=>\{if\(!camera\|\|!isValid\(camera,true\)\)return;camera\.enabled=visible&&\(!pre\|\|\(isValid\(host,true\)&&host\.activeInHierarchy\)\);\};/);
 assert.match(bg,/setVisible:value=>\{if\(dead\)return;visible=value;if\(!pre\)rig!\.active=value;if\(pre\)showCamera\(\);else camera!\.enabled=value;if\(value\)applyDir\(\);else restoreDir\(\);\},/);
 assert.match(bg,/adopt:\(owner,next\)=>\{if\(dead\)return;host=owner;off\(\);token=next;off=next\.onCancel\(dispose\);/,'entry token owns it after adopt');
 assert.match(bg,/if\(st\)\{boardPreload=null;st\.adopted=true;let lease:LakesideBoardLease\|null=null;\n  try\{lease=await ctx\.token\.wait\(st\.promise\);\}catch\(error\)\{void st\.promise\.then\(l=>l\?\.dispose\(\)\);throw error;\}\n  if\(lease\)\{lease\.adopt\(ctx\.parent,ctx\.token\);return lease;\}/);
 assert.match(bg,/ return buildLakesideBoard\(ctx\);\n\};/,'no preload / failed preload → the normal build (and its single fallback reason)');});
run('free once: unadopted preload cancelled + disposed with the journey; adopted lease disposes its holder with itself',()=>{
 assert.match(ja,/atmosphere\.restore\(\);releaseLakesideBoardPreload\(\)/);
 assert.match(bg,/export function releaseLakesideBoardPreload\(\)\{const st=boardPreload;boardPreload=null;if\(!st\|\|st\.adopted\)return;st\.token\.cancel\(\);/);
 assert.match(bg,/if\(pre&&isValid\(parent,true\)\)parent\.destroy\(\)\/\* preload holder \*\//);assert.match(bg,/const dispose=\(\)=>\{if\(dead\)return;/);});
