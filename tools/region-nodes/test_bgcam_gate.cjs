'use strict';
/* p0drag6 (GGbot static review of a248c646): every switch of a board-background camera goes through BgCamGate.
 * Real RegionNodeStage.showWorld / restoreBoard (ground-tap walk cover), syncExplore / takeSyncView / releaseSyncCams (explore) and
 * RegionBoardStaging (warm-up), with the owner simulated through bgCamWant (= its setVisible). NOT ENGINE.
 *  W1 walk cover + owner setVisible(true) mid-walk: stays off during the walk; on after it (owner wants it).
 *  W2 walk cover + owner setVisible(false) mid-walk: off after the walk (no stale "was on" snapshot).
 *  W3 explore hold + walk cover overlapping: explore closes while the walk cover is up → still off; cover ends → on.
 *  W4 warm-up (stageRegionBoard) during a hold: the camera never draws, stays off after staging; release → owner's want.
 *  W5 other regions' cameras: the cover holds them too and gives each back by its own owner's want.
 *  W6 source scan: no raw `.enabled=true` / snapshot restore on *BackgroundCamera outside BgCamGate / owners' bgCamWant.
 * node tools/region-nodes/test_bgcam_gate.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {BG,H,S,rig,setScene}=require('./explore-stage-harness.cjs');
const STG=H.load(S('region/RegionBoardStaging.ts'));
const cam=(name)=>({name,enabled:false,isValid:true,fov:48,node:{name,activeInHierarchy:true,worldPosition:{x:0,y:12,z:15},forward:{x:0,y:-0.6,z:-0.8}}});
const R=rig('lakeside','S1',null,{});const st=R.st;
const lake=cam('LakesideBackgroundCamera'),meadow=cam('MeadowBackgroundCamera'),stageCam={enabled:true,isValid:true,node:{name:'Main Camera',activeInHierarchy:true}};
BG.bgCamWant(lake,true);BG.bgCamWant(meadow,true);
setScene({getComponentsInChildren:()=>[stageCam,meadow,lake],find:()=>null});
const lakeModel={worldMatrix:null,activeInHierarchy:true};st.model=r=>r==='lakeside'?lakeModel:null;
Object.assign(st,{camera:stageCam,cover:null,syncCams:[],exploreCheck:1,exploreArmed:{lakeside:true},explorePrev:'level',syncOpened:null,ensureCharacter:()=>true,character:{setVisible(){}}});
let snap=null;st.flow=()=>({presentNodeWalkWorld(){},commands:()=>({snapshot:()=>snap})});
st.writePose=p=>p;st.readPose=()=>({position:[0,12,15],target:[0,1,0],fovVerticalDeg:48});
const res={};const ok=(k,v,o)=>{res[k]={...o,ok:!!v};};
// W1
st.showWorld('lakeside');const w1a=lake.enabled;BG.bgCamWant(lake,true);const w1b=lake.enabled;st.restoreBoard();
ok('W1',!w1a&&!w1b&&lake.enabled,{offAtCover:!w1a,offAfterOwnerShow:!w1b,onAfterWalk:lake.enabled});
// W2
st.showWorld('lakeside');BG.bgCamWant(lake,false);st.restoreBoard();const w2=lake.enabled;BG.bgCamWant(lake,true);
ok('W2',!w2&&lake.enabled,{onAfterWalk:w2,ownerShowsAgain:lake.enabled});
// W3: explore via the real poll, then a walk cover, explore closes first, then the cover
st.region='lakeside';snap={state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}};st.syncExplore(0.3);
const opened=st.syncOpened==='lakeside';st.showWorld('lakeside');
snap={state:'level',hidden:false,journey:{region:'lakeside',phase:'arrived'}};st.exploreCheck=1;st.cover&&(st.cover=st.cover);
// explore close while the cover is up (its sync close path is guarded by !cover, so drop explore's hold the way it does)
st.releaseSyncCams();const w3a=lake.enabled;st.restoreBoard();
ok('W3',opened&&!w3a&&lake.enabled,{opened,offWhileCoverStillUp:!w3a,onAfterBoth:lake.enabled});
// W4: warm-up during a hold
const rigNode=new H.cc.Node('LakesideLiveScene');const camNode=new H.cc.Node('LakesideBackgroundCamera');rigNode.addChild(camNode);
const wc=camNode.addComponent(H.cc.Camera);wc.enabled=false;BG.bgCamWant(wc,true);BG.bgCamHold(wc,'explore');
let tick=null;const stg=STG.stageRegionBoard(rigNode,{onFrame:cb=>{tick=cb;return()=>{tick=null;};},viewport:()=>({w:390,h:844})});
let drew=false;for(let i=0;i<40&&tick;i++){tick();drew=drew||wc.enabled;}stg&&stg.finish('test');const w4a=wc.enabled;
BG.bgCamRelease(wc,true,'explore');
ok('W4',!!stg&&!drew&&!w4a&&wc.enabled,{staged:!!stg,drewWhileHeld:drew,offAfterStaging:!w4a,ownerWantAfterRelease:wc.enabled});
// W4b warm-up with no hold still works (temporary draw, then the owner's want: here hidden)
BG.bgCamWant(wc,false);const stg2=STG.stageRegionBoard(rigNode,{onFrame:cb=>{tick=cb;return()=>{tick=null;};},viewport:()=>({w:390,h:844})});
let drew2=false;for(let i=0;i<40&&tick;i++){tick();drew2=drew2||wc.enabled;}stg2&&stg2.finish('test');
ok('W4b',drew2&&!wc.enabled,{warmUpDrew:drew2,offAfter:!wc.enabled});
// W5: the other region's camera under the cover: owner hides it mid-walk → stays off; the lake one comes back
BG.bgCamWant(meadow,true);st.showWorld('lakeside');BG.bgCamWant(meadow,false);st.restoreBoard();
ok('W5',!meadow.enabled&&lake.enabled,{meadowOn:meadow.enabled,lakeOn:lake.enabled});
// W6: source scan
const SC=path.join(__dirname,'../../creator-build-project/assets/scripts');const bad=[];
for(const f of ['world-r2/RegionNodeStage.ts','region/RegionBoardStaging.ts','region/LakesideBoardBackground.ts','region/MeadowBoardBackground.ts','region/SkycityBoardBackground.ts','region/SkycityBoardLive.ts']){
 const src=fs.readFileSync(path.join(SC,f),'utf8');
 const m=src.match(/(?<![\w.])(cam|camera!?|x\.cam|c)\.enabled\s*=\s*(?!false\b|bgCam)[^;]*/g);if(m)bad.push(f+': '+m.join(' | '));}
ok('W6',bad.length===0,{bad});
const fails=Object.keys(res).filter(k=>!res[k].ok);
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/bgcam-gate.json'),JSON.stringify({status:fails.length?'FAIL':'PASS',scope:'NOT ENGINE: real RegionNodeStage / RegionBoardStaging / BgCamGate code, stubbed scene',res},null,1));
console.log(JSON.stringify(res));assert.equal(fails.length,0,'bgcam-gate failing: '+fails.join(','));console.log('bgcam-gate: ok');
