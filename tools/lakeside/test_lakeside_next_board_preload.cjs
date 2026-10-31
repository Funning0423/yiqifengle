// P0 fin (Mac fc3123fa): r04-lake-02 built its lakeside board cold (lake-01 had consumed the one landing preload) and hit the
// 12 s QF_BOARD_ENTRY_TIMEOUT. Gate: while a lake board draws, the NEXT lake board is preloaded dormant and the next entry adopts it.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const bg=fs.readFileSync(S+'region/LakesideBoardBackground.ts','utf8'),ad=fs.readFileSync(S+'world-r2/NativeWorldLevelAdapter.ts','utf8');
const run=(n,f)=>{f();console.log('PASS',n);};
run('timeout untouched: the board entry deadline stays 12 s',()=>{assert.match(ad,/console\.error\('\[QF_BOARD_ENTRY_TIMEOUT\] background',stageId\);reject\(Error\('enter-level-not-ready'\)\);\},12000\)/);});
run('trigger: a drawing lake board kicks the next-board preload (idempotent, none after the last lake stage)',()=>{
 assert.match(bg,/const applyDir=\(\)=>\{kickNextLakesideBoard\(\)/);
 assert.match(bg,/export const LAKESIDE_LAST_STAGE='r04-lake-06';/);
 assert.match(bg,/export function kickNextLakesideBoard\(\):Promise<unknown>\|null\{\n if\(boardPreload\|\|lakesideEnteredStage===LAKESIDE_LAST_STAGE\)return null;/);
 assert.match(bg,/boardPreload=st;/);});
run('dormant: instances a batch per frame, rig stays inactive, no layer-conflict with the showing board, camera off',()=>{
 assert.match(bg,/\{yieldFrame:nextFrame,dormant:true\}/);
 assert.match(bg,/if\(!pre\?\.dormant&&scene\.getComponentsInChildren\(Camera\)/);
 assert.match(bg,/if\(pre\?\.dormant\)\{\/\* P0 fin: dormant next-board preload, the rig stays inactive until wake\(\) \*\/\}\n  else if\(pre\)\{step='preload-activate';/);});
run('claim: the next entry wakes it (batched activation) BEFORE adopting, through the existing adopt path',()=>{
 assert.match(bg,/st\.promise=built\.then\(lease=>claimed\.then\(\(\)=>lease\.wake\(\)\)\.then\(\(\)=>lease\)\)/);
 assert.match(bg,/lakesideEnteredStage=String\(\(ctx\.selection as any\)\?\.stageId\?\?''\);boardPreload\?\.wake\?\.\(\);\n const st=boardPreload;/);
 assert.match(bg,/wake:async\(\)=>\{if\(dead\|\|!pre\?\.dormant\|\|!rig\|\|!scenery\)return;[^\n]*\n    for\(let i=0;i<kids\.length;i\+\+\)\{if\(isValid\(kids\[i\],true\)\)kids\[i\]\.active=true;if\(\(i\+1\)%LAKESIDE_PRELOAD_BATCH===0\)\{await pre!\.yieldFrame\(\);token\.check\(\);\}\}\},/);});
run('release: the dormant preload sits in the one boardPreload slot, so the journey release cancels + destroys it',()=>{
 assert.match(bg,/export function releaseLakesideBoardPreload\(\)\{const st=boardPreload;boardPreload=null;if\(!st\|\|st\.adopted\)return;st\.token\.cancel\(\);/);
 assert.match(bg,/\.catch\(\(\)=>\{if\(boardPreload===st\)boardPreload=null;if\(isValid\(holder,true\)\)holder\.destroy\(\);return null;\}\)/);});
// behaviour: sequence lake-01 → lake-02 → … with the real kick/claim logic extracted (no engine).
run('sequence: every lake board after the first is adopted from a preload; none built cold; last stage kicks nothing',()=>{
 let boardPreload=null,lakesideEnteredStage='',builds=0,cold=0;const LAKESIDE_LAST_STAGE='r04-lake-06';
 const kick=()=>{if(boardPreload||lakesideEnteredStage===LAKESIDE_LAST_STAGE)return null;builds++;boardPreload={woken:false,wake(){this.woken=true;}};return 1;};
 const enter=id=>{lakesideEnteredStage=id;boardPreload?.wake?.();const st=boardPreload;if(st){boardPreload=null;assert(st.woken);return 'adopted';}cold++;return 'cold';};
 boardPreload={wake(){this.woken=true;}};// landing preload (preloadLakesideBoard)
 const got=[];for(let i=1;i<=6;i++){got.push(enter('r04-lake-0'+i));kick();kick();}
 assert.deepEqual(got,Array(6).fill('adopted'));assert.equal(cold,0);assert.equal(builds,5,'one preload per next board, none after lake-06');assert.equal(boardPreload,null);});
console.log('lakeside next-board preload OK');
