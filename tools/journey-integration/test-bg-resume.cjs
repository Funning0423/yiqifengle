'use strict';
// r5 F4: back from background (wx.onShow / visibilitychange -> hide/show) continues a journey, the sail,
// the balloon and a region free-walk without the 「继续」 overlay. Progress stays put while hidden and then
// moves by at most one capped frame (0.1 s), never by the hidden gap (3 s / 10 s / 60 s / 10 min).
// Seated home, idle island and a sky-city visit freeze the same way (no cancelAndReset, no 「继续」).
// An in-progress board stays paused behind an explicit resume. No flow fault.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
const H=createHarness();
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const {WorldFlow,Cancellation}=H.load('world-r1/WorldFlowCore');
const {RegionJourneyController}=H.load('world-r1/RegionJourneyCore');
const leg=H.load('region/TransportLeg.ts');
const DT=1/60,CAP=.1,GAPS=[3,10,60,600];
const zero=[0,0,0],end=[2,0,8];
const seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:[0,0,.3]};
const P=z=>({position:[2,1.5,z-3],target:[0,1,z]});
const config={seat,toDoor:[[0,0,.3],[0,0,2]],outCrossing:[[0,0,2],[0,0,3]],toIsland:[[0,0,3],end],toThreshold:[end,[0,0,3]],inCrossing:[[0,0,3],[0,0,2]],toSeat:[[0,0,2],[0,0,.3]],
 cameraHome:P(0),cameraToDoor:[P(0),P(2)],cameraInside:P(2),cameraOutside:P(3),cameraIsland:P(8),openDeg:90,speed:1.2};
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function make(){
 const jobs=new Set(),log={resets:0},clocks=[];
 let root=[...seat.seatedControllerRoot],walk=null;
 const job=(seconds,token)=>{if(!(seconds>0))return Promise.resolve();return new Promise((res,rej)=>{const j={e:0,seconds,res};jobs.add(j);token.onCancel(()=>{jobs.delete(j);rej(Error('cancelled'));});});};
 const world={setLayers(){},setDoor(){},setCamera(){},cancelTransient(){},assertStaticWorld(){},dispose(){},setRoomLightWeight(){return true;},
  animateCamera:(p,s,tk)=>job(s,tk),animateDoor:(a,b,s,tk)=>job(s,tk),wait:(s,tk)=>job(s,tk)};
 const ch={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:seat.standingControllerRoot,seatedRoot:seat.seatedControllerRoot,seatYawRad:0,clearanceRadiusM:.1},
  actionSeconds:()=>1,walkProgress(){return walk?walk.f:null},ticks:0,
  advance(s){this.ticks+=s;if(!walk)return;walk.e+=s;walk.f=Math.min(1,walk.e/walk.d);const a=walk.path[0],b=walk.path[walk.path.length-1],L=dist(a,b)||1,u=walk.f;root=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];if(walk.f>=1){const w=walk;walk=null;w.res();}},
  perform(action,token){return new Promise((res,rej)=>{if(action.kind!=='walk'){res();return;}walk={path:action.path,d:action.duration,e:0,f:0,res};token.onCancel(()=>{if(walk)walk=null;rej(Error('cancelled'));});});},
  cancelAndReset(p){log.resets++;walk=null;root=p.kind==='standing'?[...p.controllerRoot]:[...seat.seatedControllerRoot];},setVisible(){},dispose(){}};
 const visit={shown:0,hidden:0,show(){this.shown++;},hide(){this.hidden++;},dispose(){}};
 const journey=new RegionJourneyController({readCamera:()=>config.cameraIsland,prepare:async(from,to,start)=>{
  const path=[start.slice(),[start[0],start[1]+1,start[2]+4],[start[0]+2,start[1]+1,start[2]+8]];
  const clock={t:0,kind:clocks.length?'balloon':'sail'};clocks.push(clock);
  return {route:{from,to,path,bridgeStart:1,bridgeEnd:6,speed:1.2},show(){},dispose(){},
   async ride(_a,_w,token){while(clock.t+1e-9<1){token.check();await world.wait(DT,token);clock.t=Math.min(1,clock.t+DT);}}};
 }});
 const flow=new WorldFlow({config,mode:'fixed',character:ch,journey,skycity:{enter:async()=>visit},levels:{enter:async()=>({requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){},isSettledResult:()=>false})},loadWorld:async()=>world});
 const flush=()=>new Promise(r=>setImmediate(r));
 const frame=async(dt=DT)=>{const s=flow.snapshot();if(!(s.hidden||s.needsResume)){const step=Math.min(Math.max(0,dt),CAP);if(step>0){flow.advance(step);for(const j of Array.from(jobs)){if(!jobs.has(j))continue;j.e+=step;if(j.e>=j.seconds){jobs.delete(j);j.res();}}}}await flush();};
 return {flow,ch,log,clocks,visit,frame,flush,pos:()=>root.slice()};
}
async function still(r,state){
 const out=[];
 for(const hiddenS of GAPS){
  const feet=r.pos(),resets=r.log.resets,ticks=r.ch.ticks,shown=r.visit.shown,hidden=r.visit.hidden;
  r.flow.hide();
  assert.equal(r.flow.snapshot().state,state,'frozen state '+state+' at '+hiddenS+'s');
  assert.equal(r.flow.snapshot().hidden,true);
  r.flow.advance(hiddenS);
  for(let i=0;i<4;i++)await r.frame();
  assert.equal(r.ch.ticks,ticks,'hidden '+hiddenS+'s did not tick the clip');
  assert.deepEqual(r.pos(),feet,'hidden '+hiddenS+'s did not move her');
  assert.equal(r.visit.shown,shown);assert.equal(r.visit.hidden,hidden,'visit stayed mounted');
  r.flow.show();
  const s=r.flow.snapshot();
  assert.equal(s.hidden,false);assert.equal(s.needsResume,false,'no 继续 after '+hiddenS+'s at '+state);
  assert.equal(s.state,state);noFault(r.flow,state+' '+hiddenS);
  assert.equal(r.log.resets,resets,'no snap (cancelAndReset)');
  assert.equal(r.flow.resume().ok,false,'already playing');
  assert.equal(r.visit.shown,shown);assert.equal(r.visit.hidden,hidden);
  await r.frame();
  assert(r.ch.ticks>ticks,'clip clock resumes after '+hiddenS+'s');
  assert.deepEqual(r.pos(),feet);
  out.push({state,hiddenS,step:+(r.ch.ticks-ticks).toFixed(4)});
 }
 return out;
}
function noFault(flow,where){const s=flow.snapshot();assert.notEqual(s.state,'error',where);assert.equal(s.error,null,where+' error');}
async function until(r,pred,max=240){for(let i=0;i<max;i++){if(pred())return;await r.frame();}throw Error('timeout '+r.flow.snapshot().state);}
async function gaps(r,read,state){
 const out=[];
 for(const hiddenS of GAPS){
  const before=read(),feet=r.pos(),resets=r.log.resets;
  r.flow.hide();
  assert.equal(r.flow.snapshot().state,state,'frozen state '+state+' at '+hiddenS+'s');
  assert.equal(r.flow.snapshot().hidden,true);
  r.flow.advance(hiddenS);
  for(let i=0;i<4;i++)await r.frame();
  assert.equal(read(),before,'hidden '+hiddenS+'s did not move progress');
  assert.deepEqual(r.pos(),feet,'hidden '+hiddenS+'s did not move her');
  r.flow.show();
  const s=r.flow.snapshot();
  assert.equal(s.hidden,false);assert.equal(s.needsResume,false,'no 继续 after '+hiddenS+'s at '+state);
  assert.equal(s.state,state);noFault(r.flow,state+' '+hiddenS);
  assert.equal(r.log.resets,resets,'no snap (cancelAndReset)');
  assert.deepEqual(r.pos(),feet);
  await r.frame();
  const moved=read()-before;
  assert(moved>0&&moved<=CAP+1e-6,'continues by one capped frame, not the '+hiddenS+'s gap: +'+moved);
  out.push({state,hiddenS,progress:read(),step:+moved.toFixed(4)});
 }
 return out;
}
(async()=>{
 const cases=[];
 // --- sail (island -> meadow ride) ---
 {const r=make();assert((await r.flow.load()).ok);r.flow.state='island';r.flow.stable='island';
  const pending=r.flow.travelRegion('meadow');
  await until(r,()=>r.clocks[0]&&r.clocks[0].t>0);
  assert.equal(r.clocks[0].kind,'sail');assert.equal(r.flow.snapshot().state,'region-travel');
  cases.push(...await gaps(r,()=>r.clocks[0].t,'region-travel'));
  await until(r,()=>r.flow.snapshot().state==='meadow',400);
  assert((await pending).ok);noFault(r.flow,'sail land');assert.equal(r.flow.snapshot().state,'meadow');
  // region free-walk on the meadow
  const token=new Cancellation();const from=r.pos();const dest=[from[0]+3,from[1],from[2]];
  const walking=r.ch.perform({kind:'walk',path:[from,dest],duration:2},token);
  await until(r,()=>{const p=r.ch.walkProgress();return typeof p==='number'&&p>0.2;});
  cases.push(...await gaps(r,()=>r.ch.walkProgress(),'meadow'));
  await until(r,()=>r.ch.walkProgress()==null,400);await walking;assert.equal(r.ch.walkProgress(),null);
  // balloon (meadow -> skycity)
  const air=r.flow.travelRegion('skycity');
  await until(r,()=>r.clocks[1]&&r.clocks[1].t>0);
  assert.equal(r.clocks[1].kind,'balloon');assert.equal(r.flow.snapshot().state,'region-travel');
  cases.push(...await gaps(r,()=>r.clocks[1].t,'region-travel'));
  await until(r,()=>r.flow.snapshot().state==='skycity',400);
  assert((await air).ok);noFault(r.flow,'balloon land');
  const token2=new Cancellation();const a0=r.pos();
  const walking2=r.ch.perform({kind:'walk',path:[a0,[a0[0]+2,a0[1],a0[2]+1]],duration:2},token2);
  await until(r,()=>{const p=r.ch.walkProgress();return typeof p==='number'&&p>0.2;});
  cases.push(...await gaps(r,()=>r.ch.walkProgress(),'skycity'));
  await until(r,()=>r.ch.walkProgress()==null,400);await walking2;
 }
 // island free-walk, then idle island, seated home and a sky-city visit: freeze, no cancelAndReset, no 「继续」.
 {const r=make();assert((await r.flow.load()).ok);r.flow.state='island';r.flow.stable='island';r.ch.cancelAndReset({kind:'standing',controllerRoot:end,yawRad:0});
  const token=new Cancellation();const walking=r.ch.perform({kind:'walk',path:[end,[end[0]+4,end[1],end[2]]],duration:2},token);
  await r.frame();assert(r.ch.walkProgress()>0&&r.ch.walkProgress()<1);
  const resets=r.log.resets;r.flow.hide();assert.equal(r.flow.snapshot().state,'island');r.flow.advance(600);r.flow.show();
  assert.equal(r.flow.snapshot().needsResume,false);assert.equal(r.log.resets,resets);noFault(r.flow,'island walk');
  await until(r,()=>r.ch.walkProgress()==null,400);await walking;
  cases.push(...await still(r,'island'));
 }
 {const r=make();assert((await r.flow.load()).ok);assert.equal(r.flow.snapshot().state,'home');cases.push(...await still(r,'home'));}
 {const r=make();assert((await r.flow.load()).ok);r.flow.state='island';r.flow.stable='island';r.ch.cancelAndReset({kind:'standing',controllerRoot:end,yawRad:0});
  assert((await r.flow.enterSkycity()).ok);assert.equal(r.flow.snapshot().state,'skycity');assert.equal(r.visit.shown,1);
  cases.push(...await still(r,'skycity'));
 }
 {const r=make();assert((await r.flow.load()).ok);r.flow.state='island';r.flow.stable='island';assert((await r.flow.enterLevel('board')).ok);
  r.flow.hide();r.flow.show();assert.equal(r.flow.snapshot().state,'paused');assert.equal(r.flow.snapshot().needsResume,true,'board keeps the confirm');assert(r.flow.resume().ok);assert.equal(r.flow.snapshot().state,'level');}
 // sail clock + balloon step clock: hidden wall time does not jump t.
 const clocks=[];
 for(const hiddenS of GAPS){
  const sail=leg.createSailClock();const t0=sail.t;sail.hide(hiddenS);assert.equal(sail.t,t0);sail.show(.1);assert(Math.abs(sail.t-.1)<1e-9);
  let balloon={t:4,hiddenFor:0,fade:0};balloon=leg.stepTransitClock(balloon,hiddenS,true);assert.equal(balloon.t,4);assert.ok(balloon.hiddenFor>=hiddenS);
  balloon=leg.stepTransitClock(balloon,.1,false);assert(Math.abs(balloon.t-4.1)<1e-9);assert.equal(balloon.jumped,false);
  clocks.push({hiddenS,sailT:+sail.t.toFixed(3),balloonT:+balloon.t.toFixed(3)});
 }
 const saved=globalThis.__worldIntegration;globalThis.__worldIntegration={snapshot:()=>({hidden:true,needsResume:true,state:'region-travel'})};
 assert.equal(leg.transitAppHidden(),true);globalThis.__worldIntegration=saved;assert.equal(leg.transitAppHidden(),false);
 // 「继续」 overlay: frozen states keep the button off; a paused home/board still shows it.
 const boot=overlay();
 const shown=[];
 for(const state of ['region-loading','region-travel','meadow','lakeside','skycity','skycity-loading','home','island']){
  boot.snap={state,needsResume:true,hidden:true,journey:{region:state==='skycity'?'skycity':'island',phase:'bridge'}};
  boot.paintNavigation();
  assert.equal(boot.controls.get('resume').active,false,state+' hides 继续');
  assert.deepEqual(boot.calls,[],'no resumeJourney while '+state);boot.calls.length=0;
  shown.push(state);
 }
 boot.snap={state:'paused',needsResume:true,hidden:false};boot.paintNavigation();
 assert.equal(boot.controls.get('resume').active,true,'paused board still shows 继续');
 boot.snap={state:'level',needsResume:true,hidden:false};boot.paintNavigation();
 assert.equal(boot.controls.get('resume').active,true,'live board still shows 继续');
 boot.snap={state:'region-travel',needsResume:false,hidden:false,journey:{phase:'bridge',target:'meadow'}};boot.paintNavigation();
 assert.equal(boot.controls.get('resume').active,false);assert.deepEqual(boot.calls,[]);
 const comp=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
 assert(comp.includes("document.addEventListener('visibilitychange'"),'web visibilitychange reaches EVENT_HIDE/SHOW');
 assert(comp.includes('bindWxLifecycle'),'wx.onShow still bound');
 const audio=bgmOffsets();
 console.log(JSON.stringify({status:'PASS',cases,clocks,overlay:shown,pausedOverlay:true,audio,checks:['sail and balloon rides and meadow/skycity/island free-walk: 3s/10s/60s/10min hide does not move progress or feet','seated home, idle island and sky visit: same gaps, clip clock stops then resumes, no cancelAndReset','show clears needsResume (no 继续) and the next frame advances by <=0.1s','no state error / snapshot.error','a live board still requires 继续','sail clock and stepTransitClock do not jump','resume button off for frozen states, on for paused and level']},null,2));
})().catch(e=>{console.error(e);process.exit(1);});

function overlay(){
 const B=createHarness({overrides:{
  'world-r2/IslandHomeInteraction':{IslandHomeInteraction:class{sync(){}dispose(){}}},
  'world-r2/IslandProps':{IslandProps:class{get ready(){return false;}load(){return Promise.resolve(false);}dispose(){}}},
  'world-r2/StartupReadyGate':{StartupReadyGate:class{dispose(){}},StartupAttempt:class{},StartupCancelled:class extends Error{}},
  'RoomExploreOverlay':{RoomExploreOverlay:class{sync(){}diagnostics(){return null;}dispose(){}}},
 }});
 const Boot=B.load('WorldIntegrationBoot').WorldIntegrationBoot,{Node}=B.cc;
 B.setViewport(390,844);
 const boot=new Boot(),calls=[];boot.snap={state:'island',needsResume:false,hidden:false};
 boot.node=new Node('Boot');boot.ready=true;boot.loadPhase='ready';boot.board=()=>null;
 boot.composition={worldCommands:()=>({snapshot:()=>boot.snap,dayNight:()=>({mode:'day'})}),resumeJourney:()=>{calls.push('resumeJourney');return Promise.resolve({ok:true});},enterMainline:()=>{},islandOverview:()=>({journey:{inventory:{tools:{windBell:1}}}}),islandGates:()=>({r4:[],r5:[]})};
 boot.createNavigation();boot.resize();boot.calls=calls;return boot;
}
function bgmOffsets(){
 const src=fs.readFileSync(path.join(S,'audio/GameAudio.ts'),'utf8');
 const plain=src.replace(/^import .* from 'cc';\n/m,'').replace(/^@ccclass\('GameAudio'\)\n/m,'').replace(/export /g,'');
 const {stripTypeScriptTypes}=require('node:module');
 const js=(stripTypeScriptTypes?stripTypeScriptTypes(plain,{mode:'transform'}):require('../qf-env.cjs').typescript().transpileModule(plain,{compilerOptions:{target:99}}).outputText)+'\nglobalThis.AudioClass=GameAudio;';
 const out=[];
 for(const hiddenS of GAPS){
  class Events{constructor(){this.m=new Map();}on(n,f,t){(this.m.get(n)||this.m.set(n,[]).get(n)).push([f,t]);}off(n,f){this.m.set(n,(this.m.get(n)||[]).filter(x=>x[0]!==f));}emit(n){for(const [f,t] of [...(this.m.get(n)||[])])f.call(t);}}
  class Component{destroy(){return true;}}
  class AudioSource{constructor(){this.clip=null;this._state=0;this.currentTime=0;this.volume=1;this.loop=false;this.starts=0;this.restarts=0;this.stops=0;all.push(this);}get playing(){return this._state===1;}get state(){return this._state;}
   play(){if(this._state===1){this.restarts++;this.currentTime=0;}this.starts++;this._state=1;}pause(){if(this._state===1)this._state=2;}stop(){this.stops++;this._state=3;this.currentTime=0;}destroy(){this._state=3;}}
  const all=[];AudioSource.EventType={STARTED:'s',ENDED:'e'};AudioSource.AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3};AudioSource.maxAudioChannel=24;
  class Node extends Events{constructor(n){super();this.name=n;this.valid=true;}addComponent(C){const c=new C();c.node=this;c.onLoad?.();return c;}addChild(){}}
  const loads=[],bundle={load:(p,t,cb)=>loads.push({p,cb})};
  const ctx={_decorator:{ccclass:()=>x=>x},Component,Node,AudioSource,AudioClip:class{},assetManager:{getBundle:()=>bundle,loadBundle:(n,cb)=>cb(null,bundle)},resources:{load(){},loadDir(){}},director:{getScene:()=>new Node('scene'),addPersistRootNode(){}},game:new Events(),Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},input:new Events(),Input:{EventType:{TOUCH_END:'t',MOUSE_UP:'m',KEY_DOWN:'k'}},sys:{localStorage:{getItem:()=>null,setItem(){}}},isValid:n=>!!n?.valid,console:{warn(){},info(){}},globalThis:{}};
  ctx.globalThis=ctx;vm.runInNewContext(js,ctx);const A=ctx.AudioClass;let time=1000;A.now=()=>time;const a=A.ensure();
  const clip=(n,d)=>({name:n,refs:0,addRef(){this.refs++;},decRef(){this.refs--;},getDuration:()=>d});
  a.onGesture();a.setMusic('audio/bgm_main','audio_bgm_island');loads.find(l=>l.p==='audio/bgm_main').cb(null,clip('bgm_main',83.478));
  const loop=all.find(s=>s.clip?.name==='bgm_main');
  for(let i=0;i<90;i++){if(loop.playing)loop.currentTime+=DT;time+=DT*1000;}
  a.onWorldState('region-travel');
  const at=loop.currentTime,stops=loop.stops,restarts=loop.restarts;
  a.onHide();ctx.game.emit('hide');
  time+=hiddenS*1000;
  assert.equal(loop.playing,false);assert.equal(loop.stops,stops);assert(Math.abs(loop.currentTime-at)<1e-9);
  a.onShow();ctx.game.emit('show');
  assert.equal(loop.playing,true);assert.equal(loop.restarts,restarts);assert.equal(loop.stops,stops);
  assert(Math.abs(loop.currentTime-at)<1e-9,'BGM offset '+loop.currentTime+' vs '+at);
  a.onWorldState('region-travel');
  assert.equal(loop.restarts,restarts,'staying on region-travel does not restart BGM');
  out.push({hiddenS,offset:+at.toFixed(3),restarts:loop.restarts});
 }
 return out;
}
