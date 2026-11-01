// v3.3: a failed lakeside load is no longer swallowed. The lease logs the real cause ([QF_LAKESIDE] load-failed, always on), rethrows one
// stable reason; WorldFlow keeps the player on the island; the island HUD shows only the approved copy in the board's concise toast style.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts'),rd=f=>fs.readFileSync(path.join(S,f),'utf8');
const bg=rd('region/LakesideBoardBackground.ts'),comp=rd('world-r2/WorldNativeComposition.ts'),boot=rd('WorldIntegrationBoot.ts'),toast=rd('ui/IslandToast.ts'),flow=rd('world-r1/WorldFlowCore.ts');
assert(/export const LAKESIDE_LOAD_FAILED='lakeside-scene-load-failed';/.test(bg));
assert(/console\.error\('\[QF_LAKESIDE\] '\+JSON\.stringify\(\{event:'load-failed',stageId,step,error:/.test(bg),'always-on log with step + cause');
assert(/\}catch\(error\)\{dispose\(\);[\s\S]{0,400}if\(token\.cancelled\)throw error;logLakesideFailure\(step,String\(selection\?\.stageId\?\?''\),error\);throw Error\(LAKESIDE_LOAD_FAILED\);\}/.test(bg),'dispose, skip cancellations, log, stable reason');
for(const st of ['scenery','water-material','lights-camera'])assert(bg.includes("step='"+st+"'"),'step '+st);
// behaviour of the log helper (no cc needed)
const src=bg.match(/export function logLakesideFailure[^\n]*\n/)[0].replace('export ','').replace(/:string|:unknown|as any/g,'');
const lines=[];const orig=console.error;console.error=(...a)=>lines.push(a.join(' '));
new Function(src+';logLakesideFailure("prefabs","r04-lake-01",new Error("lakeside-prefab-missing: x"));logLakesideFailure("bundle","r04-lake-02","plain");')();console.error=orig;
assert.equal(lines.length,2);const j=JSON.parse(lines[0].replace('[QF_LAKESIDE] ',''));assert.deepEqual(j,{event:'load-failed',stageId:'r04-lake-01',step:'prefabs',error:'lakeside-prefab-missing: x'});
// fallback stays the island: operate() restores the stable place on a non-cancel error
assert(/token\.cancel\(\);this\.error=String\(err\);this\.restore\(\);this\.change\(this\.world\?this\.stable:'error'\);/.test(flow),'WorldFlow returns to the stable place');
assert(/if\(result\.ok===false&&String\(result\.reason\)\.includes\(LAKESIDE_LOAD_FAILED\)\)return this\.lakesideFallback\('board',result\.reason\);/.test(comp),'build05-next: board failure -> lakesideFallback (test_lakeside_fallback)');
// HUD: approved copy only, toast (no error panel, no raw reason), and it does not block the island (this.error stays empty)
const m={exports:{}};const out=ts.transpileModule(toast.replace(/^import[^\n]*\n/gm,''),{compilerOptions:{module:1,target:6}}).outputText;
new Function('module','exports','require','TOAST_S','makeLabel','measure',out)(m,m.exports,require,2,null,null);
assert.equal(m.exports.LAKESIDE_NOT_READY_TEXT,'湖畔暂时没准备好，先回小岛吧');
const op=m.exports.islandToastOpacity;assert.equal(op(-1),0);assert.equal(op(0.1),0.5);assert.equal(op(1),1);assert.equal(op(2.2),1);assert(op(2.35)<1&&op(2.35)>0);assert.equal(op(2.6),0);
assert(/r\.reason===LAKESIDE_LOAD_FAILED\)\{this\.islandToast\?\.show\(LAKESIDE_NOT_READY_TEXT\);this\.logSuppressedStatus\('lakeside',r\.reason\);\}else if/.test(boot),'toast + log, error stays empty');
assert(/this\.islandToast\?\.update\(dt,f\.width,f\.height\);/.test(boot)&&/this\.islandToast=new IslandToast\(this\.canvas\);/.test(boot));
assert(!/湖畔[^'"]*(失败|错误|error)/i.test(toast+boot),'no technical wording on screen');
// same look as the board toast (ManagedMobileBoardUI.paintToast)
const board=rd('ManagedMobileBoardUI.ts');for(const c of ['new Color(40, 30, 20, 40)','new Color(201, 177, 133, 255)','g.lineWidth = 1.5'])assert(board.includes(c)&&toast.includes(c),c);
assert(/new Color\(248, 242, 226, 240\)/.test(toast)&&/Math\.round\(248 \* k\), Math\.round\(242 \* k\), Math\.round\(226 \* k\), 240/.test(board));
console.log('lakeside load-failure OK');
