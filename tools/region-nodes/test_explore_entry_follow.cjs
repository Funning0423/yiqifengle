'use strict';
/* p0drag5 (Mac r16c fc742aa2): entering lakeside free explore showed a fixed wide shot; the lens followed her only after a ground tap.
 * Real path: RegionNodeStage.syncExplore (4 Hz poll: board exit → lakeside) → openExplore → update/tickLens, with the scene holding the
 * board's live LakesideBackgroundCamera (fixed, priority 44) exactly as the journey scene does after 「离开棋盘」. Cause: that camera kept
 * drawing; only groundTap's cover switched it off. Asserts, with ?camTrace=1 on (CamTrace sub-paths):
 *  F1 within 0.1 s of the explore opening the stage camera writer is region.node-lens:orbit[+entry] / :follow AND it is the camera on
 *     screen (no other enabled camera of higher/equal priority drawing: the background camera is off);
 *  F2 no cut: first written pose == the background shot on screen (≤ 0.05 m), every frame step in the first 1.5 s ≤ 9 m/s·dt + 0.05;
 *  F3 before any tap the lens moves with her (after the entry glide she drifts 1 m in 0.67 s, no tap: lens ≥ 0.6 m and aim ≥ 0.8 m
 *     the same way within 1 s);
 *  F4 leaving the region (sync close) gives the background camera back.
 * p0drag5b (GGbot review of 8d6d6279) — the owner's setVisible (BgCamGate.bgCamWant) is the truth, explore only holds:
 *  G1 other regions' background cameras are untouched by the take;
 *  G2 owner setVisible(true) while explore holds → stays off; normal exit → restored (F4);
 *  G3 background hidden by its owner during explore → exit leaves it off;
 *  G4 region changed during explore → exit leaves the old background camera off (no frozen / solid-colour frame).
 * node tools/region-nodes/test_explore_entry_follow.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {BG,CT,H,S,rig,setScene}=require('./explore-stage-harness.cjs');
const CP=H.load(S('world-r1/CameraPose.ts'));
CT.camTraceInit('?camTrace=1');
const R=rig('lakeside','S1',null,{seed:h=>({position:[h[0]+3,h[1]+15,h[2]+18],target:[h[0],h[1]+1,h[2]],fovVerticalDeg:48})});
const st=R.st,her0=R.her().slice();
// scene: stage camera + the board's live lakeside background camera, showing a fixed wide shot
const wide={position:[her0[0]+3,her0[1]+15,her0[2]+18],target:[her0[0],her0[1]+1,her0[2]]};
const fwd=(()=>{const d=wide.target.map((v,i)=>v-wide.position[i]),l=Math.hypot(...d);return d.map(v=>v/l);})();
const bg={enabled:true,isValid:true,fov:48,priority:44,node:{name:'LakesideBackgroundCamera',activeInHierarchy:true,worldPosition:{x:wide.position[0],y:wide.position[1],z:wide.position[2]},forward:{x:fwd[0],y:fwd[1],z:fwd[2]}}};
BG.bgCamWant(bg,true);
// another region's background camera, live in the same scene (must stay untouched)
const other={enabled:true,isValid:true,fov:48,priority:44,node:{name:'MeadowBackgroundCamera',activeInHierarchy:true,worldPosition:{x:0,y:9,z:9},forward:{x:0,y:0,z:-1}}};BG.bgCamWant(other,true);
const stageCam={enabled:true,isValid:true,priority:10,node:{name:'Main Camera',activeInHierarchy:true}};
st.camera=stageCam;
const sbScene={getComponentsInChildren:()=>[stageCam,other,bg]};
Object.assign(st,{exploreCheck:1,exploreArmed:{lakeside:true},explorePrev:'level',syncOpened:null,syncCams:[],cover:null,ensureCharacter:()=>true});
let snap={state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}};
st.flow=()=>({commands:()=>({snapshot:()=>snap})});
const lakeModel={worldMatrix:null,activeInHierarchy:true};st.model=r=>r==='lakeside'?lakeModel:null;
// written camera = what writePose applied; trace through the real CameraPose hook
let written=null;const camObj={node:{setWorldPosition(){},setWorldRotation(){}},fov:45};
st.writePose=p=>{written=p;CP.applyCameraPose(camObj,CP.fromLookAt(p,45),'region.node-lens');return p;};
st.readPose=()=>written||{...wide,fovVerticalDeg:48};
setScene(sbScene);
const DT=1/30,frames=[];let t=0;
function frame(){st.tickLens(DT);t+=DT;const w=CT.camTrace.writers.slice();CT.camTraceFrame({t});const f=CT.camTrace.frames[CT.camTrace.frames.length-1];
 frames.push({t:+t.toFixed(3),w:(f&&f.w)||[],cam:written?written.position.slice():null,bgOn:bg.enabled});}
// open via the real poll
st.syncExplore(0.3);
const opened=st.syncOpened==='lakeside';
const G1={otherOn:other.enabled};G1.ok=other.enabled===true;
BG.bgCamWant(bg,true);/* owner re-shows mid-explore */const G2hold={bgOnWhileHeld:bg.enabled};
const first=written?written.position.slice():null;
for(let i=0;i<45;i++)frame();
const camAt=()=>written.position.slice();
const settle=frames.length;while(st.entry&&frames.length<settle+300)frame();const entryDoneS=+(t).toFixed(2);
const before=camAt(),tb=written.target.slice();for(let i=0;i<20;i++){R.walk(0.05);frame();}for(let i=0;i<10;i++)frame();const after=camAt(),ta=written.target.slice();
const res={opened};
const early=frames.filter(f=>f.t<=0.1+1e-9);
res.F1={writers:[...new Set(early.flatMap(f=>f.w))],bgOnAt0_1:early.length?early[early.length-1].bgOn:null};
res.F1.ok=opened&&early.length>0&&early.every(f=>f.w.some(x=>/^region\.node-lens:(orbit|orbit\+entry|follow)$/.test(x)))&&res.F1.bgOnAt0_1===false;
let maxStep=0;for(let i=1;i<45;i++){const a=frames[i-1].cam,b=frames[i].cam;if(a&&b)maxStep=Math.max(maxStep,Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]));}
const firstDev=first?Math.hypot(...first.map((v,i)=>v-wide.position[i])):null;
res.F2={firstDevM:firstDev==null?null:+firstDev.toFixed(3),maxStepM:+maxStep.toFixed(3)};res.F2.ok=firstDev!=null&&firstDev<=0.05&&maxStep<=9*DT+0.05+1e-9;
res.F3={entryDoneS,lensShiftXM:+(after[0]-before[0]).toFixed(3),aimShiftXM:+(ta[0]-tb[0]).toFixed(3)};res.F3.ok=res.F3.lensShiftXM>=0.6&&res.F3.aimShiftXM>=0.8;
snap={state:'level',hidden:false,journey:{region:'lakeside',phase:'arrived'}};st.exploreCheck=1;st.syncExplore(0.3);
res.F4={bgOn:bg.enabled};res.F4.ok=bg.enabled===true;
res.G1=G1;res.G2={...G2hold,restoredOnExit:bg.enabled};res.G2.ok=G2hold.bgOnWhileHeld===false&&bg.enabled===true;
// reopen explore, then the owner hides the background (G3) / the region changes (G4) before the exit
function reopen(){st.exploreArmed.lakeside=true;snap={state:'lakeside',hidden:false,needsResume:false,journey:{region:'lakeside',phase:'arrived'}};st.region='lakeside';st.exploreCheck=1;st.syncExplore(0.3);return st.syncOpened==='lakeside'&&bg.enabled===false;}
function close(){snap={state:'level',hidden:false,journey:{region:'lakeside',phase:'arrived'}};st.exploreCheck=1;st.syncExplore(0.3);}
{const held=reopen();BG.bgCamWant(bg,false);close();res.G3={held,bgOnAfterExit:bg.enabled};res.G3.ok=held&&bg.enabled===false;
 BG.bgCamWant(bg,true);res.G3.ownerShowsAgain=bg.enabled;res.G3.ok=res.G3.ok&&bg.enabled===true;}
{const held=reopen();st.region='meadow';close();res.G4={held,bgOnAfterExit:bg.enabled,otherOn:other.enabled};res.G4.ok=held&&bg.enabled===false&&other.enabled===true;}
const fails=['F1','F2','F3','F4','G1','G2','G3','G4'].filter(k=>!res[k].ok);
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/explore-entry-follow.json'),JSON.stringify({status:fails.length?'FAIL':'PASS',scope:'NOT ENGINE: real RegionNodeStage/FreeOrbit/LensGuard/CamTrace code, stubbed scene',res,frames:frames.slice(0,6)},null,1));
console.log(JSON.stringify(res));
assert.equal(fails.length,0,'explore-entry-follow failing: '+fails.join(','));
console.log('explore-entry-follow: ok');
