'use strict';
// 「主页」 ≤10 s (Mac re-check 2607de6). Simulated wall clock, day and night: from meadow / journey-skycity / a paused
// journey, runHomeTransition (fade 0.4 s → WorldFlow.returnHome places her at home → resolve) must resolve {ok:true}
// in ≤10 s with state home. Walks run on SIMULATED frames whose flow dt is capped at 0.1 s (WorldFlowComponent.update),
// so a low-fps night stretches any walk; the teleport path takes no walk at all. Every failure path resolves.
const assert=require('node:assert/strict'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),{WorldFlow}=H.load('world-r1/WorldFlowCore'),{RegionJourneyController}=H.load('world-r1/RegionJourneyCore'),{runHomeTransition,HOME_FADE}=H.load('world-r2/HomeTransition');
const pose={position:[3,3,-6],target:[0,1,0]},zero=[0,0,0],seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:zero};
const config={seat,toDoor:[zero,[0,0,1]],outCrossing:[[0,0,1],[0,0,2]],toIsland:[[0,0,2],[0,0,3]],toThreshold:[[0,0,3],[0,0,2]],inCrossing:[[0,0,2],[0,0,1]],toSeat:[[0,0,1],zero],cameraHome:pose,cameraToDoor:[pose,pose],cameraInside:pose,cameraOutside:pose,cameraIsland:pose,openDeg:90,speed:1};
// virtual wall clock
function clock(){let now=0;const timers=[];const wait=s=>new Promise(r=>timers.push({at:now+s*1000,r}));
 const flush=()=>new Promise(r=>setImmediate(r));
 async function drive(p){let done=false,val;p.then(v=>{done=true;val=v;});for(let i=0;i<100000;i++){await flush();if(done)return val;timers.sort((a,b)=>a.at-b.at);const t=timers.shift();if(!t)throw Error('stalled: no timer and promise pending');now=Math.max(now,t.at);t.r();}throw Error('runaway');}
 return {now:()=>now/1000,wait,drive};}
function make(ck,{fps=60,holdJourney=false}={}){let root=zero,camera=pose;const walks=[];let release=null;
 // a walk of L metres at speed 1 needs L s of FLOW time; flow dt per frame = min(1/fps, 0.1) → wall = L * (1/fps)/min(1/fps,.1)
 const dil=(1/fps)/Math.min(1/fps,.1);
 const actor={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:zero,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},advance(){},walkProgress:()=>holdJourney?.4:1,
  perform:async(action,token)=>{if(action.kind==='walk'){walks.push(action.path);if(holdJourney&&action.path.length>2){await new Promise((res,rej)=>{release=res;token?.onCancel?.(()=>rej(new Error('cancelled')));});}
   else{let L=0;for(let i=1;i<action.path.length;i++)L+=Math.hypot(...action.path[i].map((v,k)=>v-action.path[i-1][k]));await ck.wait(L*dil);}root=action.path.at(-1);}},
  cancelAndReset:p=>{root=p.kind==='standing'?p.controllerRoot:p.seat.seatedControllerRoot;},setVisible(){},dispose(){}};
 const world={setCamera:p=>{camera=p;},setLayers(){},setDoor(){},cancelTransient(){},assertStaticWorld(){},dispose(){},animateCamera:async()=>{},animateDoor:async()=>{}};
 const journey=new RegionJourneyController({readCamera:()=>camera,prepare:async(from,to,start)=>({route:{from,to,path:[start,[start[0],start[1]+1,start[2]+4],[start[0],start[1]+1,start[2]+8]],bridgeStart:1,bridgeEnd:6,speed:1},show(){},dispose(){}})});
 const flow=new WorldFlow({config,character:actor,journey,skycity:{enter:async()=>({show(){},hide(){},dispose(){}})},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>true})},loadWorld:async()=>world});
 return {flow,journey,walks,root:()=>root};}
function host(ck,flow,log,over={}){return {now:ck.now,wait:ck.wait,
 cover:(a,s)=>{log.push(['cover',a,s,ck.now()]);return ck.wait(s);},audioOut:s=>{log.push(['audioOut',s,ck.now()]);return ck.wait(s);},
 audioIn:s=>log.push(['audioIn',s,ck.now()]),audioRestore:()=>log.push(['audioRestore',ck.now()]),act:()=>flow.returnHome(),state:()=>flow.snapshot().state,...over};}
const results=[],timings=[];const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
(async()=>{
 for(const [phase,fps] of [['day',60],['night',1.6]])for(const [region,stage,legs] of [['meadow','mainline-05',['meadow']],['journey-skycity','mainline-09',['meadow','skycity']]])
  await test(`${phase} (${fps} fps): 主页 from ${region} resolves ok ≤10 s, state home, fade then audio in`,async()=>{
   const ck=clock(),x=make(ck,{fps}),log=[];
   assert((await ck.drive(x.flow.load())).ok);assert((await ck.drive(x.flow.leaveHome())).ok);
   for(const r of legs)assert((await ck.drive(x.flow.travelRegion(r))).ok);
   assert((await ck.drive(x.flow.enterLevel(stage))).ok);assert(x.flow.exitLevel().ok);
   const t0=ck.now(),r=await ck.drive(runHomeTransition(host(ck,x.flow,log)));const dt=ck.now()-t0;
   assert.equal(r.ok,true,JSON.stringify(r));assert(dt<=10,'resolved in '+dt+' s');assert.equal(x.flow.snapshot().state,'home');
   assert.deepEqual(log.map(e=>e[0]),['cover','audioOut','audioIn','cover']);assert.equal(log[0][1],1);assert.equal(log[3][1],0);
   assert(log[1][1]>=.3&&log[1][1]<=.5,'audio fade 0.3-0.5 s');timings.push({phase,fps,region,seconds:+dt.toFixed(3)});});
 await test('night: 主页 from a paused journey on the island resolves ok ≤10 s',async()=>{const ck=clock(),x=make(ck,{fps:1.6,holdJourney:true}),log=[];
  await ck.drive(x.flow.load());await ck.drive(x.flow.leaveHome());const p=x.flow.travelRegion('meadow');await new Promise(r=>setTimeout(r,5));x.flow.cancelTransition();await p;
  const t0=ck.now(),r=await ck.drive(runHomeTransition(host(ck,x.flow,log)));assert.equal(r.ok,true,JSON.stringify(r));assert(ck.now()-t0<=10);assert.equal(x.flow.snapshot().state,'home');timings.push({phase:'night',fps:1.6,region:'paused-journey',seconds:+(ck.now()-t0).toFixed(3)});});
 await test('root cause model: the old island walk home at night (1.6 fps, dt cap 0.1 s) takes ~6x its day wall time',async()=>{
  const w={};for(const [k,fps] of [['day',60],['night',1.6]]){const ck=clock(),x=make(ck,{fps});await ck.drive(x.flow.load());await ck.drive(x.flow.leaveHome());const t0=ck.now();assert((await ck.drive(x.flow.returnHome())).ok);w[k]=ck.now()-t0;}
  assert(w.night/w.day>5.5&&w.night/w.day<6.8,JSON.stringify(w));timings.push({model:'legacy-walk',...w});});
 await test('timeout: a returnHome that never settles resolves {ok:false, reason:return-home-timeout} at 10 s and restores audio + cover',async()=>{const ck=clock(),log=[];
  const r=await ck.drive(runHomeTransition(host(ck,null,log,{act:()=>new Promise(()=>{}),state:()=>'walking-home'})));
  assert.deepEqual([r.ok,r.reason],[false,'return-home-timeout']);assert(Math.abs(r.seconds-HOME_FADE.timeoutS)<1e-6);assert(log.some(e=>e[0]==='audioRestore'));assert.equal(log.at(-1)[0],'cover');assert.equal(log.at(-1)[1],0);});
 await test('failure paths all resolve: act rejects / act {ok:false} / wrong state / cover throws',async()=>{const ck=clock();
  for(const over of [{act:async()=>{throw Error('boom');}},{act:async()=>({ok:false,reason:'wrong-state'})},{act:async()=>({ok:true}),state:()=>'island'},{cover:()=>{throw Error('cover');}}]){const log=[];
   const r=await ck.drive(runHomeTransition(host(ck,null,log,{act:async()=>({ok:true}),state:()=>'home',...over})));assert.equal(r.ok,false,JSON.stringify(r));assert(r.reason);assert(log.some(e=>e[0]==='audioRestore'));}});
 console.log(JSON.stringify({status:'PASS',checks:results.length,timings}));
})().catch(e=>{console.error('FAIL',e);process.exitCode=1;});
