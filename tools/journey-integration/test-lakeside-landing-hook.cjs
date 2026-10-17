'use strict';
// 运镜bot: region/LakesideLandingHook.lakesideLandingToBoard (landing → board, 1 s) with injected fakes (camera, frame clock,
// viewport/safe area, preload). Checks: preload awaited before the first camera write (and bounded: failure / hang never block
// or reject); first write = the landing pose, last write = boardWorld exactly (identical pose for the board's camera, the board
// UI frame predicted with the UI's own boardSafeInsets + BoardLayout); per-frame position / view / FOV monotonic, no overshoot,
// single-peak rates ≈ 0 at both ends, 60 Hz and jittery dt (incl. a long frame); never rejects (camera rejected / throws /
// not at the landing → stops, logs); no deps → resolves at once. Writes reports/lakeside-landing-hook.json (per-frame data).
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),S=path.resolve(__dirname,'../../creator-build-project/assets/scripts')+'/';
const Hook=H.load(S+'region/LakesideLandingHook.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),BL=H.load(S+'ui/BoardLayout.ts');
const results=[];let fail=0;const T=async(id,f)=>{try{const r=await f();results.push({id,status:'PASS',...(r||{})});console.log('PASS',id);}catch(e){fail++;results.push({id,status:'FAIL',error:String(e.stack||e)});console.log('FAIL',id,'\n',e.stack||e);}};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dir=p=>{const d=sub(p.target,p.position),l=Math.hypot(...d);return d.map(x=>x/l);};
const ang=(a,b)=>{const u=dir(a),v=dir(b),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(...c),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])*180/Math.PI;};
const j=LK.lakesideJourney([2,0,-1]),path_=[...j.approach,...j.bridge.slice(1),...j.arrival];
const landing=Core.journeyCamera(path_,Core.routeLength(path_),{position:[0,5,-10],target:[0,0,0],fovVerticalDeg:45},j.focus,undefined,0,j.landing);
const UI=(w,h)=>BL.boardSafeInsets(w,h);
// preload resolving after `frames` frames (the fake clock is virtual: frames come back-to-back)
const afterFrames=frames=>{let res;const p=new Promise(r=>{res=r;});p.frames=frames;p.res=res;return ()=>p;};
function fake({w=390,h=844,dts=null,preload=()=>Promise.resolve(),readCamera,setCamera,timeout}={}){
 const st={pose:landing,writes:[],at:[],dts:[],logs:[],preloadDoneAtWrite:null,preloaded:false};let k=0;const pre=preload();
 const deps={readCamera:readCamera||(()=>st.pose),setCamera:setCamera||(p=>{if(st.preloadDoneAtWrite===null)st.preloadDoneAtWrite=st.preloaded;st.pose=p;st.writes.push(p);st.at.push(st.dts.length);return true;}),
  nextFrame:()=>new Promise(r=>setImmediate(()=>{const dt=dts?dts[k++%dts.length]:1/60;st.dts.push(dt);if(pre.frames!==undefined&&st.dts.length>=pre.frames)pre.res();r(dt);})),viewport:()=>({width:w,height:h}),safe:UI,
  preload:()=>pre.then(v=>{st.preloaded=true;return v;}),preloadTimeoutS:timeout,log:e=>st.logs.push(e)};return {st,deps};}
const board=(w,h)=>{const f=Hook.lakesideHookFrame(w,h,UI(w,h));return LK.lakesideLandingBlend(landing,f,j);};
function series(st){const F=[];let t=0;const dts=st.writes.map((_,i)=>i?st.dts.slice(st.at[i-1],st.at[i]).reduce((a,b)=>a+b,0):0).slice(1);st.writes.forEach((p,i)=>{if(i)t+=Math.min(.1,dts[i-1]);const q=st.writes[i-1];
 F.push({frame:i,t:+t.toFixed(5),dt:i?+dts[i-1].toFixed(5):0,position:p.position.map(x=>+x.toFixed(6)),forward:dir(p).map(x=>+x.toFixed(7)),fov:+p.fovVerticalDeg.toFixed(5),
  dispM:Math.hypot(...sub(p.position,landing.position)),angFromStartDeg:ang(landing,p),angVelDegS:q?ang(q,p)/Math.max(1e-9,Math.min(.1,dts[i-1])):0,speedMps:q?Math.hypot(...sub(p.position,q.position))/Math.max(1e-9,Math.min(.1,dts[i-1])):0,fovRateDegS:q?(p.fovVerticalDeg-q.fovVerticalDeg)/Math.max(1e-9,Math.min(.1,dts[i-1])):0});});return F;}
function checkRun(st,w,h,label){const b=board(w,h),F=series(st),last=st.writes.at(-1),first=st.writes[0];
 assert.equal(st.preloadDoneAtWrite,true,label+': first camera write before the preload finished');
 assert(Math.hypot(...sub(first.position,landing.position))<1e-12&&ang(first,landing)<1e-9&&Math.abs(first.fovVerticalDeg-landing.fovVerticalDeg)<1e-12,label+': first write != landing pose');
 // last write = boardWorld (the hook recovers the root from the landing pose: equal to the journey root within float noise)
 const close=(x,y)=>x.every((v,i)=>Math.abs(v-y[i])<=1e-9);assert(close(last.position,b.boardWorld.position)&&close(last.target,b.boardWorld.target)&&last.fovVerticalDeg===b.boardWorld.fovVerticalDeg,label+': last write != boardWorld');
 // the board's own camera (lease rig at the origin) = boardLocal = lakesideAlignedLookAt(the UI frame) → identical pose
 const ui=BL.boardLayout(w,h,UI(w,h),3),uiFrame={width:w,height:h,boardTop:ui.tray.y-ui.tray.height/2,board:{x:ui.grid.x,y:ui.grid.y,size:ui.grid.size}},lease=LK.lakesideAlignedLookAt(uiFrame);
 assert.deepEqual(lease,b.boardLocal,label+': board camera for the UI frame (3 goals) != hook target');
 const tot=ang(landing,last),totF=last.fovVerticalDeg-landing.fovVerticalDeg,tol=1e-6;
 for(let i=1;i<F.length;i++){assert(F[i].angFromStartDeg>=F[i-1].angFromStartDeg-tol&&F[i].angFromStartDeg<=tot+tol,label+': view overshoot at '+i);assert((F[i].fov-F[i-1].fov)*(Math.sign(totF)||1)>=-tol,label+': FOV not monotonic at '+i);assert(F[i].dispM>=F[i-1].dispM-tol,label+': displacement not monotonic');}
 const elapsed=F.at(-1).t;assert(elapsed>=1-1e-9&&elapsed<=1.1+1e-9,label+': blend took '+elapsed+' s');
 return {F,b,tot,totF};}
(async()=>{
 await T('no deps: resolves at once (previous cut)',async()=>{await Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null});});
 const runs={};
 for(const [w,h] of [[390,844],[360,780],[414,896],[375,667],[390,520]])await T(`60 Hz ${w}x${h}: preload first, exact ends (landing → board camera of the UI frame), monotonic, single-peak rates ≈ 0 at both ends`,async()=>{
  const {st,deps}=fake({w,h,preload:afterFrames(20)});await Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null,deps});
  const {F,b,tot,totF}=checkRun(st,w,h,`${w}x${h}`);const r=F.slice(1).map(f=>f.angVelDegS),m=Math.max(...r),im=r.indexOf(m);
  if(m>1e-6){assert(r.every((x,i)=>!i||(i<=im?x>=r[i-1]-1e-3*m:x<=r[i-1]+1e-3*m)),'turn rate not single-peaked');assert(r[0]<=.02*m&&r.at(-1)<=.02*m,'turn rate not ≈ 0 at the ends');}
  const fr=F.slice(1).map(f=>Math.abs(f.fovRateDegS)),fm=Math.max(...fr);if(fm>1e-6)assert(fr[0]<=.02*fm&&fr.at(-1)<=.02*fm,'FOV rate not ≈ 0 at the ends');
  assert.equal(st.logs.at(-1).result,'ok');runs[w+'x'+h]={frames:F.length,gap:b.gap,peakTurnDegS:+m.toFixed(4),peakFovRateDegS:+fm.toFixed(4),perFrame:F};
  return {frames:F.length,gap:{positionM:+b.gap.positionM.toExponential(2),viewDeg:+b.gap.viewDeg.toFixed(4),fovDeg:+b.gap.fovDeg.toFixed(4)},totalTurnDeg:+tot.toFixed(4),fovChangeDeg:+totF.toFixed(4),peakTurnDegS:+m.toFixed(4)};});
 await T('jittery dt (12–40 ms) + one 250 ms frame (capped 0.1 s): exact ends, monotonic, ≤ 1.1 s',async()=>{const dts=[.016,.012,.033,.017,.25,.04,.016,.02,.016,.013];
  const {st,deps}=fake({w:390,h:520,dts});await Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null,deps});const {F}=checkRun(st,390,520,'jitter');return {frames:F.length};});
 await T('preload rejects → still blends (logged failed)',async()=>{const {st,deps}=fake({preload:()=>Promise.reject(Error('x'))});deps.setCamera=p=>{st.pose=p;st.writes.push(p);return true;};
  await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps});assert.equal(st.logs.at(-1).result,'ok');assert.equal(st.logs.at(-1).preloaded,'failed');assert(st.writes.at(-1).position.every((v,i)=>Math.abs(v-board(390,844).boardWorld.position[i])<1e-9));});
 await T('preload hangs → bounded by preloadTimeoutS, then blends',async()=>{const {st,deps}=fake({preload:()=>new Promise(()=>{}),timeout:.2});deps.setCamera=p=>{st.pose=p;st.writes.push(p);return true;};
  await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps});assert.equal(st.logs.at(-1).preloaded,'timeout');assert.equal(st.logs.at(-1).result,'ok');const waited=st.dts.length-(st.writes.length-1);assert(waited>=12&&waited<=13,'waited frames '+waited);});
 await T('never rejects: camera rejected / readCamera throws / setCamera throws / viewport throws',async()=>{
  for(const mut of [d=>{d.setCamera=()=>false;},d=>{d.readCamera=()=>{throw Error('r');};},d=>{d.setCamera=()=>{throw Error('s');};},d=>{d.viewport=()=>{throw Error('v');};},d=>{d.readCamera=()=>null;}]){
   const {st,deps}=fake();const dd={...deps};mut(dd);await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps:dd});assert(['camera-rejected','error','no-camera'].includes(st.logs.at(-1).result),JSON.stringify(st.logs.at(-1)));}});
 await T('not at the landing END (other view / FOV) → no camera write, plain cut',async()=>{
  for(const p of [{...landing,target:[landing.target[0]+3,landing.target[1],landing.target[2]]},{...landing,fovVerticalDeg:48}]){const {st,deps}=fake();deps.readCamera=()=>p;let wrote=0;const dd={...deps,setCamera:()=>{wrote++;return true;}};
   await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps:dd});assert.equal(wrote,0);assert.equal(st.logs.at(-1).result,'not-at-landing');}});
 await T('root recovered from the landing pose = the journey root',async()=>{const r=Hook.lakesideRootFromLanding(landing);assert(Math.hypot(...sub(r.root,j.root))<1e-9);assert.equal(r.yawDeg,j.yawDeg);});
 const report={status:fail?'FAIL':'PASS',results,runs};fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-landing-hook.json',JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status}))},null,1));if(fail)process.exitCode=1;
})();
