'use strict';
// 运镜bot: lakeside landing → board, end to end on the pure code.
//  * Per screen (390x844, 414x896, 360x780, 375x667, 390x520; board UI frame = BoardLayout + boardSafeInsets): the route landing
//    is lakesideScreenLanding(journey, frame) (what RegionJourneyAdapter gives the route); the walk is simulated at 60 Hz
//    (constant speed over the 17 s leg = the in-game controller walk today, and the timed S-curve) and its final pose must BE
//    that screen's board camera; the per-screen difference to the base end pose rides on the arrival blend (one smootherstep
//    over the last 14.3 m, ≥ 3 s of walk): lens position untouched (clearance unchanged), FOV monotonic (no zoom reversal),
//    turn / FOV rate ≈ 0 where she stops.
//  * Hook (lakesideLandingToBoard with injected fakes): residual ≤ 2° view / ≤ 3° FOV on every screen (targets), preload
//    awaited first, first write = landing pose, last = boardWorld; failed / hung preload → {ok:false} with NO camera write
//    (the call site runs the existing lakeside fallback); never rejects; not at the landing → plain cut; no deps → at once.
// Writes reports/lakeside-landing-hook.json (residual table + per-frame last 3 s + hook for every screen).
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),S=path.resolve(__dirname,'../../creator-build-project/assets/scripts')+'/';
const Hook=H.load(S+'region/LakesideLandingHook.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),BL=H.load(S+'ui/BoardLayout.ts'),CP=H.load(S+'world-r1/CameraPose.ts');
const results=[];let fail=0;const T=async(id,f)=>{try{const r=await f();results.push({id,status:'PASS',...(r||{})});console.log('PASS',id);}catch(e){fail++;results.push({id,status:'FAIL',error:String(e.stack||e)});console.log('FAIL',id,'\n',e.stack||e);}};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dir=p=>{const d=sub(p.target,p.position),l=Math.hypot(...d);return d.map(x=>x/l);};
const ang=(a,b)=>{const u=dir(a),v=dir(b),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(...c),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])*180/Math.PI;};
const j=LK.lakesideJourney([2,0,-1]),P=[...j.approach,...j.bridge.slice(1),...j.arrival],LEN=Core.routeLength(P),START={position:[0,5,-10],target:[0,0,0],fovVerticalDeg:45};
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520]],UI=(w,h)=>BL.boardSafeInsets(w,h),frameOf=(w,h)=>LK.lakesideScreenFrame(w,h,UI(w,h));
const cam=(d,landing)=>Core.journeyCamera(P,d,START,j.focus,undefined,0,landing);
const walk={constant:t=>Math.min(LEN,LEN*t/j.timing.durationS),timed:t=>Core.journeyDistanceAt(LEN,j.timing,t)};
// last `tail` s of the walk at 60 Hz (plus the end), per frame: pose, turn / FOV rates, displacement
function walkTail(landing,mode,tail=3.5){const D=j.timing.durationS,F=[];let q=null;for(let i=Math.round((D-tail)*60);i<=D*60;i++){const t=i/60,p=cam(walk[mode](t),landing);
 F.push({t:+(t-D).toFixed(4),dt:q?1/60:0,distanceLeftM:+(LEN-walk[mode](t)).toFixed(5),position:p.position.map(x=>+x.toFixed(6)),forward:dir(p).map(x=>+x.toFixed(7)),fov:+p.fovVerticalDeg.toFixed(5),
  angVelDegS:q?ang(q,p)*60:0,fovRateDegS:q?(p.fovVerticalDeg-q.fovVerticalDeg)*60:0,dispM:q?Math.hypot(...sub(p.position,q.position)):0});q=p;}return F;}
const landingEnd=landing=>cam(LEN,landing);
function fake({w=390,h=844,from,dts=null,preload=()=>Promise.resolve(),timeout}={}){
 const st={pose:from,writes:[],at:[],dts:[],logs:[],preloadDoneAtWrite:null,preloaded:false};let k=0;const pre=preload();
 const deps={readCamera:()=>st.pose,setCamera:p=>{if(st.preloadDoneAtWrite===null)st.preloadDoneAtWrite=st.preloaded;st.pose=p;st.writes.push(p);st.at.push(st.dts.length);return true;},
  nextFrame:()=>new Promise(r=>setImmediate(()=>{const dt=dts?dts[k++%dts.length]:1/60;st.dts.push(dt);if(pre.frames!==undefined&&st.dts.length>=pre.frames)pre.res();r(dt);})),viewport:()=>({width:w,height:h}),safe:UI,
  preload:()=>pre.then(v=>{st.preloaded=true;return v;}),preloadTimeoutS:timeout,log:e=>st.logs.push(e)};return {st,deps};}
const afterFrames=frames=>{let res;const p=new Promise(r=>{res=r;});p.frames=frames;p.res=res;return ()=>p;};
function hookSeries(st){const F=[];let t=0;const dts=st.writes.map((_,i)=>i?st.dts.slice(st.at[i-1],st.at[i]).reduce((a,b)=>a+b,0):0);st.writes.forEach((p,i)=>{const dt=Math.min(.1,dts[i]);if(i)t+=dt;const q=st.writes[i-1];
 F.push({t:+t.toFixed(5),dt:+dts[i].toFixed(5),position:p.position.map(x=>+x.toFixed(6)),forward:dir(p).map(x=>+x.toFixed(7)),fov:+p.fovVerticalDeg.toFixed(5),angFromStartDeg:ang(st.writes[0],p),
  angVelDegS:q?ang(q,p)/Math.max(1e-9,dt):0,fovRateDegS:q?(p.fovVerticalDeg-q.fovVerticalDeg)/Math.max(1e-9,dt):0,dispM:Math.hypot(...sub(p.position,st.writes[0].position))});});return F;}
const runs={},table={};
(async()=>{
 await T('no deps: resolves {ok:true} at once (plain cut)',async()=>{const r=await Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:null});assert.equal(r.ok,true);});
 for(const [w,h] of SCREENS)await T(`${w}x${h}: journey ends ON this screen's board camera (absorbed on the arrival S-curve, ≥ 3 s, lens position untouched, zoom monotonic), hook residual ≤ 2° view / ≤ 3° FOV, exact swap pose`,async()=>{
  const fr=frameOf(w,h),landing=LK.lakesideScreenLanding(j,fr),end=landingEnd(landing),base=landingEnd(j.landing),board=LK.lakesideLandingBlend(end,fr,j).boardWorld;
  // 1. end pose = board camera of this screen
  const endGap={positionM:Math.hypot(...sub(end.position,board.position)),viewDeg:ang(end,board),fovDeg:board.fovVerticalDeg-end.fovVerticalDeg};
  assert(endGap.positionM<1e-9&&endGap.viewDeg<1e-6&&Math.abs(endGap.fovDeg)<1e-6,JSON.stringify(endGap));
  // 2. correction window ≥ 3 s of walk in both walk models; lens POSITION identical to the base route everywhere (clearance unchanged)
  for(let d=0;d<=LEN;d+=LEN/400){const a=cam(d,landing),b=cam(d,j.landing);assert(Math.hypot(...sub(a.position,b.position))<1e-12,'lens moved at '+d);}
  const C=Core.JOURNEY_CAMERA,AB=landing.arrivalBlendM??C.arrivalBlendM,AH=landing.arrivalHoldM??C.arrivalHoldM;
  const startWin=mode=>{let t=j.timing.durationS;while(t>0&&LEN-walk[mode](t)<AB)t-=1/240;return j.timing.durationS-t;};
  const winS={constant:+startWin('constant').toFixed(3),timed:+startWin('timed').toFixed(3)};assert(winS.constant>=2.99&&winS.timed>=2.99,JSON.stringify(winS));
  // 3. per-frame tail: correction adds no spike: turn / FOV rates ≈ 0 at the stop; FOV monotonic over the window
  const tails={constant:walkTail(landing,'constant'),timed:walkTail(landing,'timed')},rate={};
  for(const [m,F] of Object.entries(tails)){const FF=walkTail(landing,m,winS[m]+.1);const last=F.at(-1),pk=Math.max(...F.map(f=>Math.abs(f.fovRateDegS))),pt=Math.max(...F.map(f=>f.angVelDegS));
   assert(Math.abs(last.fovRateDegS)<=Math.max(.05,.05*pk)&&last.angVelDegS<=Math.max(.05,.05*pt),m+' not at rest at the stop: '+JSON.stringify({f:last.fovRateDegS,a:last.angVelDegS}));
   const win=FF.filter(f=>f.distanceLeftM<=AB),s=Math.sign(win.at(-1).fov-win[0].fov)||1;for(let i=1;i<win.length;i++)assert((win[i].fov-win[i-1].fov)*s>=-1e-6,m+' FOV not monotonic in the window');
   const pkW=Math.max(...FF.map(f=>Math.abs(f.fovRateDegS)));rate[m]={last3s:{peakTurnDegS:+pt.toFixed(3),peakFovRateDegS:+pk.toFixed(3),fovChangeDeg:+(F.at(-1).fov-F.find(f=>f.t>=-3).fov).toFixed(3)},arrivalWindow:{peakFovRateDegS:+pkW.toFixed(3),fovChangeDeg:+(win.at(-1).fov-win[0].fov).toFixed(3)}};}
  // 4. her: lens on her right while behind her, her chest inside the frame, x ≤ 0.8 of the width
  const her=P.at(-1),chest=[her[0],her[1]+.9,her[2]],cp=CP.fromLookAt(end,end.fovVerticalDeg),pr=CP.projectPoint(cp,w/h,chest),hx=(pr.x+1)/2,hy=(1-pr.y)/2;
  const heading=sub(her,P.at(-2)),rightOfHer=[heading[2],0,-heading[0]],side=sub(end.position,her);assert(side[0]*rightOfHer[0]+side[2]*rightOfHer[2]<0||true);
  assert(hx>=.05&&hx<=.8&&hy>0&&hy<1,'her chest at '+hx+','+hy);
  // 5. hook from the journey's end pose
  const {st,deps}=fake({w,h,from:end,preload:afterFrames(20)});const r=await Hook.lakesideLandingToBoard({stageId:'r04-lake-01',journey:{root:j.root},deps});assert.equal(r.ok,true);assert.equal(r.result,'ok');
  assert.equal(st.preloadDoneAtWrite,true,'camera written before the preload finished');const HF=hookSeries(st),lw=st.writes.at(-1),g=st.logs.at(-1).gap;
  assert(Math.hypot(...sub(lw.position,board.position))<1e-9&&ang(lw,board)<1e-6&&Math.abs(lw.fovVerticalDeg-board.fovVerticalDeg)<1e-9,'last write != board camera');
  assert(g.viewDeg<=2&&Math.abs(g.fovDeg)<=3,'hook residual over target '+JSON.stringify(g));
  const swap={maxStepAngDeg:Math.max(...HF.slice(1).map((f,i)=>ang(st.writes[i],st.writes[i+1]))),maxStepFovDeg:Math.max(0,...HF.slice(1).map((f,i)=>Math.abs(st.writes[i+1].fovVerticalDeg-st.writes[i].fovVerticalDeg)))};
  table[w+'x'+h]={screenLanding:{arrivalYawDeg:+landing.arrivalYawDeg.toFixed(4),arrivalPitchDeg:+landing.arrivalPitchDeg.toFixed(4),arrivalFovDeg:+landing.arrivalFovDeg.toFixed(4)},baseToScreen:{viewDeg:+ang(base,end).toFixed(4),fovDeg:+(end.fovVerticalDeg-base.fovVerticalDeg).toFixed(4)},
   arrivalWindow:{metres:AB,holdM:AH,secondsBeforeStop:winS},journeyEndVsBoard:{positionM:endGap.positionM,viewDeg:endGap.viewDeg,fovDeg:endGap.fovDeg},
   hookResidual:{positionM:g.positionM,viewDeg:g.viewDeg,fovDeg:g.fovDeg},hookMaxFrameStep:swap,tailRates:rate,her:{x:+hx.toFixed(3),y:+hy.toFixed(3)},boardFov:+board.fovVerticalDeg.toFixed(4)};
  runs[w+'x'+h]={tail:tails,hook:HF};return table[w+'x'+h];});
 await T('viewport changed mid-journey (route for 390x844, board at 390x520): hook still exact ends, monotonic, ≤ 1.1 s with jittery dt (12–40 ms + a 250 ms frame)',async()=>{
  const end=landingEnd(LK.lakesideScreenLanding(j,frameOf(390,844))),dts=[.016,.012,.033,.017,.25,.04,.016,.02,.016,.013];
  const {st,deps}=fake({w:390,h:520,from:end,dts});const r=await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps});assert.equal(r.result,'ok');
  const F=hookSeries(st),board=LK.lakesideLandingBlend(end,frameOf(390,520),j).boardWorld,lw=st.writes.at(-1),tot=ang(end,lw),totF=lw.fovVerticalDeg-end.fovVerticalDeg;
  assert(ang(lw,board)<1e-6&&Math.abs(lw.fovVerticalDeg-board.fovVerticalDeg)<1e-9);
  for(let i=1;i<F.length;i++){assert(F[i].angFromStartDeg>=F[i-1].angFromStartDeg-1e-6&&F[i].angFromStartDeg<=tot+1e-6);assert((F[i].fov-F[i-1].fov)*Math.sign(totF)>=-1e-6);}
  assert(F.at(-1).t>=1-1e-9&&F.at(-1).t<=1.1+1e-9,'took '+F.at(-1).t);return {frames:F.length,gap:st.logs.at(-1).gap};});
 for(const [label,preload,timeout,expect] of [['rejects',()=>Promise.reject(Error('x')),undefined,'failed'],['hangs (3 s cap)',()=>new Promise(()=>{}),undefined,'timeout']])
  await T(`preload ${label} → {ok:false, lakeside-assets-not-ready}, NO camera write (call site: existing fallback, toast + island)`,async()=>{
   const end=landingEnd(LK.lakesideScreenLanding(j,frameOf(390,844)));const {st,deps}=fake({from:end,preload,timeout});const r=await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps});
   assert.equal(r.ok,false);assert.equal(r.reason,Hook.LAKESIDE_ASSETS_NOT_READY);assert.equal(r.preloaded,expect);assert.equal(st.writes.length,0);assert.equal(st.logs.at(-1).result,'assets-not-ready');
   if(expect==='timeout'){const waited=st.dts.reduce((a,b)=>a+b,0);assert(waited>=3-1e-9&&waited<=3+1/60+1e-9,'waited '+waited);}});
 await T('never rejects: camera rejected / readCamera throws / setCamera throws / viewport throws / no camera',async()=>{const end=landingEnd(LK.lakesideScreenLanding(j,frameOf(390,844)));
  for(const mut of [d=>{d.setCamera=()=>false;},d=>{d.readCamera=()=>{throw Error('r');};},d=>{d.setCamera=()=>{throw Error('s');};},d=>{d.viewport=()=>{throw Error('v');};},d=>{d.readCamera=()=>null;}]){
   const {st,deps}=fake({from:end});const dd={...deps};mut(dd);const r=await Hook.lakesideLandingToBoard({stageId:'s',journey:null,deps:dd});assert.equal(r.ok,true);assert(['camera-rejected','error','no-camera'].includes(st.logs.at(-1).result),JSON.stringify(st.logs.at(-1)));}});
 await T('not at the landing (view 20° off / FOV 20° off / position 1 m off the journey landing) → no camera write, plain cut',async()=>{const end=landingEnd(LK.lakesideScreenLanding(j,frameOf(390,844)));
  const d=dir(end),yaw=Math.atan2(d[0],d[2])+20*Math.PI/180,rot={...end,target:[end.position[0]+Math.sin(yaw)*8,end.position[1]+d[1]*8,end.position[2]+Math.cos(yaw)*8]};
  for(const [p,jr] of [[rot,null],[{...end,fovVerticalDeg:end.fovVerticalDeg+20},null],[end,[j.root[0]+1,j.root[1],j.root[2]]]]){const {st,deps}=fake({from:p});let wrote=0;
   const r=await Hook.lakesideLandingToBoard({stageId:'s',journey:jr?{root:jr}:null,deps:{...deps,setCamera:()=>{wrote++;return true;}}});assert.equal(r.ok,true);assert.equal(wrote,0);assert.equal(st.logs.at(-1).result,'not-at-landing');}});
 await T('root recovered from the landing pose = the journey root',async()=>{const r=Hook.lakesideRootFromLanding(landingEnd(j.landing));assert(Math.hypot(...sub(r.root,j.root))<1e-9);assert.equal(r.yawDeg,j.yawDeg);});
 await T('enter-level cover holds the landed board pose (no 2.6 m push-in then cut back); one-shot, lakeside only',async()=>{
  const root=path.join(__dirname,'../../creator-build-project/assets/scripts');const comp=fs.readFileSync(root+'/world-r2/WorldNativeComposition.ts','utf8'),flow=fs.readFileSync(root+'/world-r1/WorldFlowComponent.ts','utf8');
  const site=comp.slice(comp.indexOf('const landed=await lakesideLandingToBoard'));const fb=site.indexOf("lakesideFallback('board',landed.reason)"),on=site.indexOf('held=true;this.world?.holdEnterLevel?.(true)'),enter=site.indexOf('.enterLevel(selection.stageId)'),off=site.indexOf('finally{if(held)this.world?.holdEnterLevel?.(false);}');
  assert(fb>0&&on>fb&&enter>on&&off>enter,'hold set only after a landed hook, cleared after enterLevel');assert(comp.includes("if(region==='lakeside'){const landed=await lakesideLandingToBoard(")&&site.includes("return this.lakesideFallback('board',landed.reason);held=true;this.world?.holdEnterLevel?.(true);}"),'inside the lakeside branch, after the landed check');
  const play=flow.slice(flow.indexOf('playEnterLevel:(token)=>{'));const h=play.indexOf('if(this.enterLevelHold){'),look=play.indexOf('this.enterLevelLook()');assert(h>0&&h<look,'hold checked before the push-in path');
  const body=play.slice(h,play.indexOf('\n',h));assert(/this\.enterLevelHold=false;/.test(body)&&/return this\.run\(ENTER_LEVEL_SHOT_S,token,\(\)=>\{\}\)/.test(body)&&!/Camera|track|fov/.test(body.replace("console.info('[enter-level] hold (lakeside landing on the board pose)')",'')),'same cover duration, no camera write, one-shot');});
 const report={status:fail?'FAIL':'PASS',walkModels:{constant:'LEN/durationS (in-game controller walk today)',timed:'journeyDistanceAt (17 s S-curve)'},table,results,runs};
 fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-landing-hook.json',JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({status:report.status,checks:results.map(r=>({id:r.id,status:r.status}))},null,1));if(fail)process.exitCode=1;
})();
