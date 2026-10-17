'use strict';
// r4.1 (Grok Bot; Mac evidence voice-bot 20261017T121502Z-r4-exit-footsteps/recording-yunjing/C_gating): backgrounding
// halfway through the home exit snapped her back to the chair and replayed the whole exit (V1 hide() cancelled the
// transition, show() restarted leaveHome from the seat); the walk home was cancelled back to the island behind 「继续」.
// Now hide() freezes either walk and show() continues it from the same frame by itself. This test drives WorldFlowCore
// on a frame clock that mirrors WorldFlowComponent.update (jobs + character advance only while !needsResume) and locks:
//  - every exit / walk-home state, hidden 3 s and 10 s, with and without frames while hidden: position, clip time, camera
//    progress, door angle and wind identical before/while/after; no 'paused'/'home'/'standing' re-entry, no
//    cancelAndReset (no seat snap), no second leaveHome/load; same state sequence and the same active walk time as an
//    uninterrupted run; ends on the island / seated at home;
//  - GameAudio (mock Cocos AudioSource with 3.8.8 semantics: play() on a PLAYING source restarts at 0, pause keeps the
//    position): BGM paused not stopped and resumed at the same offset (no restart), exit track held mid-'crossing-out' and
//    continued at its offset with one voice; island tail / interruption keep the old rule;
//  - footsteps (FootstepTracker on the frozen motion clock): no extra, missing or doubled plant across the trip.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const {WorldFlow,EXIT_STATES,RETURN_STATES,pointOnPath,pathDuration}=H.load('world-r1/WorldFlowCore');
const {FootstepTracker,crossedPlants}=H.load(S+'audio/FootstepCore.ts');
const DT=1/60,results=[];
// ---------- A. world flow on a frame clock ----------
const zero=[0,0,0],seat={position:zero,back:[0,0,-1],yawRad:0,seatedFoot:zero,standingFoot:zero,seatedControllerRoot:zero,standingControllerRoot:[0,0,.3]};
const P=(z,y=1.5)=>({position:[2,y,z-3],target:[0,1,z]});
const config={seat,toDoor:[[0,0,.3],[0,0,2]],outCrossing:[[0,0,2],[0,0,3]],toIsland:[[0,0,3],[1,0,6],[2,0,8]],toThreshold:[[2,0,8],[1,0,6],[0,0,3]],inCrossing:[[0,0,3],[0,0,2]],toSeat:[[0,0,2],[0,0,.3]],
 cameraHome:P(0),cameraToDoor:[P(0),P(2)],cameraInside:P(2),cameraOutside:P(3),cameraIsland:P(8,4),openDeg:90,speed:1.1,wind:{outbound:[[0,0],[.5,1],[1,.4]]},
 cameraTracks:{outbound:{},inbound:{}},crane:{startProgress:.3,settleSeconds:1.2,startSeconds:2}};
function rig(){
 const jobs=new Set(),log={reset:0,camera:[],door:0,loads:0,visible:true};let t=0;
 const job=(seconds,token,tick)=>{if(!(seconds>0)){tick(1);return Promise.resolve();}return new Promise((res,rej)=>{const j={e:0,seconds,tick,res};jobs.add(j);token.onCancel(()=>{jobs.delete(j);rej(new Error('cancelled'));});tick(0);});};
 const world={setLayers(){},setDoor(d){log.door=d;},setCamera(p){log.camera.push(JSON.stringify(p));log.cam=p;log.camP=1;},cancelTransient(){for(const j of jobs)jobs.delete(j);},assertStaticWorld(){},dispose(){},
  animateCamera:(path,s,tk,o,progress,onSample)=>job(s,tk,p=>{log.camP=p;onSample?.(p);}),animateDoor:(a,b,s,tk)=>job(s,tk,p=>{log.door=a+(b-a)*p;}),wait:(s,tk)=>job(s,tk,()=>{}),
  setRoomLightWeight(){return true;},blendRoomLight:(a,b,s,tk)=>job(s,tk,()=>{})};
 // Character: controller-only motion; each action is a clip on the same advance() clock (abs = clip time).
 const ch={pos:[...seat.seatedControllerRoot],abs:0,clip:'idle',act:null,walkP:null,
  calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:seat.standingControllerRoot,seatedRoot:zero,seatYawRad:0,clearanceRadiusM:.1},
  actionSeconds:k=>k==='stand'?1:k==='sit'?1.2:1.5,walkProgress(){return this.walkP;},
  advance(s){this.abs+=s;const a=this.act;if(!a)return;a.e=Math.min(a.d,a.e+s);const p=a.e/a.d;if(a.kind==='walk'){this.pos=pointOnPath(a.path,p);this.walkP=p;}
   else if(a.kind==='stand'||a.kind==='sit'){const to=a.kind==='stand'?seat.standingControllerRoot:seat.seatedControllerRoot;this.pos=a.from.map((v,i)=>v+(to[i]-v)*p);}
   if(a.e>=a.d){this.act=null;this.walkP=null;a.res();}},
  perform(action,token){return new Promise((res,rej)=>{const d=action.kind==='walk'?action.duration:action.kind==='turn'?1.5:action.kind==='stand'?1:1.2;
   this.clip=action.kind;this.abs=0;this.act={kind:action.kind,path:action.path,d,e:0,from:[...this.pos],res};token.onCancel(()=>{this.act=null;rej(new Error('cancelled'));});});},
  cancelAndReset(pose){log.reset++;this.act=null;this.walkP=null;this.pos=pose.kind==='seated'?[...pose.seat.seatedControllerRoot]:[...pose.controllerRoot];},setVisible(v){log.visible=v;},dispose(){}};
 const states=[];let leaves=0;
 const flow=new WorldFlow({config,mode:'motion',character:ch,levels:{enter:async()=>({})},loadWorld:async()=>{log.loads++;return world;},onChange:s=>{if(states[states.length-1]!==s.state)states.push(s.state);}});
 const orig=flow.leaveHome.bind(flow);flow.leaveHome=(...a)=>{leaves++;return orig(...a);};
 const flush=()=>new Promise(r=>setImmediate(r));
 // == WorldFlowComponent.update: no job / character tick while needsResume (the flow's own advance() also refuses).
 const frame=async(gated=true)=>{const s=flow.snapshot();if(!(gated&&s.needsResume)){flow.advance(DT);for(const j of Array.from(jobs)){if(!jobs.has(j))continue;j.e+=DT;j.tick(Math.min(1,j.e/j.seconds));if(j.e>=j.seconds){jobs.delete(j);j.res();}}t+=DT;}await flush();};
 const probe=()=>({pos:ch.pos.map(v=>+v.toFixed(9)),abs:+ch.abs.toFixed(9),clip:ch.clip,cam:+(+log.camP).toFixed(9),door:+log.door.toFixed(9),wind:flow.getWindStrength(),jobs:Array.from(jobs).map(j=>+j.e.toFixed(9))});
 return {flow,ch,log,states,frame,probe,flush,active:()=>t,leaves:()=>leaves};
}
const untilState=async(r,pred,max=6000)=>{for(let i=0;i<max;i++){if(pred(r.flow.snapshot().state))return;await r.frame();}throw Error('timeout waiting; at '+r.flow.snapshot().state);};
async function reference(){const r=rig();assert((await r.flow.load()).ok);const p=r.flow.leaveHome();await untilState(r,s=>s==='island');assert((await p).ok);const exitT=r.active(),exitStates=r.states.slice();
 const q=r.flow.returnHome();await untilState(r,s=>s==='home');assert((await q).ok);return {exitStates,allStates:r.states.slice(),exitT,totalT:r.active()};}
async function trip(at,hiddenS,ticksWhileHidden,route){
 const r=rig();assert((await r.flow.load()).ok);let pending=r.flow.leaveHome();
 if(route==='return'){await untilState(r,s=>s==='island');assert((await pending).ok);pending=r.flow.returnHome();}
 await untilState(r,s=>s===at);for(let i=0;i<20;i++)await r.frame(); // halfway into that state
 const before=r.probe(),resets=r.log.reset,cams=r.log.camera.length,leaves=r.leaves(),statesAt=r.states.length;
 r.flow.hide();let s=r.flow.snapshot();
 assert.equal(s.hidden,true);assert.equal(s.needsResume,true);assert.equal(s.state,at,'state kept while hidden (no paused)');
 const frames=Math.round(hiddenS/DT);for(let i=0;i<frames;i++){if(ticksWhileHidden)await r.frame();else await r.flush();}
 assert.deepEqual(r.probe(),before,'frozen while hidden: position / clip time / camera / door / wind / jobs');
 r.flow.show();s=r.flow.snapshot();
 assert.equal(s.hidden,false);assert.equal(s.needsResume,false,'resumes by itself (no 继续)');assert.equal(s.state,at,'same walk continues');
 assert.deepEqual(r.probe(),before,'show() moves nothing');
 assert.equal(r.log.reset,resets,'no cancelAndReset (no snap to the seat / island)');assert.equal(r.log.camera.length,cams,'no stable camera write on hide/show');
 await r.frame();const next=r.probe();assert(next.abs>before.abs||next.clip!==before.clip||next.cam>before.cam,'continues on the next frame');
 if(next.clip===before.clip&&before.clip==='walk')assert(Math.abs(next.abs-before.abs-DT)<1e-9,'clip time continues by one frame');
 await untilState(r,st=>st===(route==='return'?'home':'island'));assert((await pending).ok,'the same leaveHome/returnHome resolves ok');
 assert.equal(r.leaves(),leaves,'no second leaveHome');assert.equal(r.log.loads,1,'no world re-init');
 assert(!r.states.slice(statesAt).some(x=>x==='paused'||x==='standing'&&route==='exit'&&at!=='standing'),'no paused / no replay from the seat');
 return {r,frozenAt:before};
}
(async()=>{
 assert.deepEqual([...EXIT_STATES],['standing','turning-out','walking-out','opening-door','crossing-out']);
 assert.deepEqual([...RETURN_STATES],['walking-home','crossing-in','closing-door','walking-to-seat','sitting']);
 const ref=await reference();
 for(const route of ['exit','return'])for(const at of route==='exit'?EXIT_STATES:RETURN_STATES)for(const hiddenS of [3,10])for(const ticks of [false,true]){
  const {r,frozenAt}=await trip(at,hiddenS,ticks,route);
  // Same path as the uninterrupted run: identical state sequence and the same active (unfrozen) seconds.
  assert.deepEqual(r.states,route==='exit'?ref.exitStates:ref.allStates,'state sequence as uninterrupted');
  const T=route==='exit'?ref.exitT:ref.totalT;assert(Math.abs(r.active()-T)<=DT*3,'active walk time '+r.active().toFixed(3)+' vs '+T.toFixed(3));
  if(route==='return'){assert.deepEqual(r.ch.pos,[...seat.seatedControllerRoot],'seated at home');}
  results.push({route,at,hiddenS,framesWhileHidden:ticks,frozenAt:{pos:frozenAt.pos,clip:frozenAt.clip,clipTime:frozenAt.abs,camera:frozenAt.cam},activeS:+r.active().toFixed(3)});
 }
 // Seated / island backgrounds keep paused + 继续 (unchanged).
 {const r=rig();assert((await r.flow.load()).ok);r.flow.hide();r.flow.show();assert.equal(r.flow.snapshot().needsResume,true);assert.equal(r.flow.snapshot().state,'paused');assert(r.flow.resume().ok);assert.equal(r.flow.snapshot().state,'home');}
 {const r=rig();assert((await r.flow.load()).ok);const p=r.flow.leaveHome();await untilState(r,s=>s==='island');await p;r.flow.hide();assert.equal(r.flow.snapshot().state,'paused');r.flow.show();assert.equal(r.flow.snapshot().needsResume,true);assert(r.flow.resume().ok);assert.equal(r.flow.snapshot().state,'island');}
 // cancelTransition while frozen: back to the stable place, still paused behind 继续 (freeze dropped, no auto-resume).
 {const r=rig();assert((await r.flow.load()).ok);const p=r.flow.leaveHome();await untilState(r,s=>s==='walking-out');r.flow.hide();assert(r.flow.cancelTransition().ok);await p;r.flow.show();const s=r.flow.snapshot();assert.equal(s.needsResume,true);assert.equal(s.stable,'home');}
 // hide → show → hide → show in quick succession: still one walk, still frozen exactly.
 {const r=rig();assert((await r.flow.load()).ok);const p=r.flow.leaveHome();await untilState(r,s=>s==='crossing-out');for(let i=0;i<10;i++)await r.frame();const b=r.probe();r.flow.hide();r.flow.show();r.flow.hide();await r.frame();r.flow.show();assert.deepEqual(r.probe(),b);await untilState(r,s=>s==='island');assert((await p).ok);assert.equal(r.leaves(),1);}
 // ---------- B. GameAudio: BGM + exit track across the trip ----------
 const audio=gameAudioCases();
 // ---------- C. footsteps on the frozen clock ----------
 const steps=footstepCases();
 // ---------- D. wiring in the Cocos components ----------
 const comp=fs.readFileSync(S+'world-r1/WorldFlowComponent.ts','utf8');
 assert(/if\(!Number\.isFinite\(dt\)\|\|dt<=0\|\|this\.flow\.snapshot\(\)\.needsResume\)return;/.test(comp),'job clock stops while needsResume');
 assert(/this\.flow\.show\(\);this\.syncHostPause\(\);/.test(comp),'show re-applies the ambient / room-light pause from the visible layers');
 const core=fs.readFileSync(S+'world-r1/WorldFlowCore.ts','utf8');assert(!/void this\.leaveHome\(\)/.test(core),'show() never restarts leaveHome');
 console.log(JSON.stringify({status:'PASS',worldCases:results.length,cases:results,audio,steps,checks:['exit + walk home frozen on hide (every state, 3 s / 10 s, with/without hidden frames): pos, clip time, camera, door, wind, jobs unchanged','show continues the same walk by itself: no paused/home/standing re-entry, no cancelAndReset, no second leaveHome/load, same states + active time as uninterrupted','seated / island / cancel keep paused + 继续','BGM paused (not stopped), resumed at the same offset, no restart','exit track held on crossing-out and continued at its offset, one voice; island tail / interruption unchanged','footsteps: same plants as uninterrupted, none doubled'],scope:'WorldFlowCore + GameAudio + FootstepCore on mocks (frame clock = WorldFlowComponent.update rule); no engine, no device audio'},null,2));
})().catch(e=>{console.error(e);process.exit(1);});

function gameAudioCases(){
 const src=fs.readFileSync(S+'audio/GameAudio.ts','utf8');
 const plain=src.replace(/^import .* from 'cc';\n/m,'').replace(/^@ccclass\('GameAudio'\)\n/m,'').replace(/export /g,'');
 const {stripTypeScriptTypes}=require('node:module');
 const js=(stripTypeScriptTypes?stripTypeScriptTypes(plain,{mode:'transform'}):require('../qf-env.cjs').typescript().transpileModule(plain,{compilerOptions:{target:99}}).outputText)+'\nglobalThis.AudioClass=GameAudio;';
 const make=()=>{
  class Events{constructor(){this.m=new Map();}on(n,f,t){(this.m.get(n)||this.m.set(n,[]).get(n)).push([f,t]);}off(n,f){this.m.set(n,(this.m.get(n)||[]).filter(x=>x[0]!==f));}emit(n){for(const [f,t] of [...(this.m.get(n)||[])])f.call(t);}}
  class Component{destroy(){return true;}}
  // Cocos 3.8.8 AudioSource: play() on PLAYING = stop + play from 0; on PAUSED = resume; pause keeps currentTime.
  class AudioSource{constructor(){this.clip=null;this._state=0;this.currentTime=0;this.volume=1;this.loop=false;this.starts=0;this.restarts=0;this.stops=0;all.push(this);}get playing(){return this._state===1;}get state(){return this._state;}
   play(){if(this._state===1){this.restarts++;this.currentTime=0;}this.starts++;this._state=1;}pause(){if(this._state===1)this._state=2;}stop(){this.stops++;this._state=3;this.currentTime=0;}destroy(){this.destroyed=true;this._state=3;}}
  const all=[];AudioSource.EventType={STARTED:'s',ENDED:'e'};AudioSource.AudioState={INIT:0,PLAYING:1,PAUSED:2,STOPPED:3};AudioSource.maxAudioChannel=24;
  class Node extends Events{constructor(n){super();this.name=n;this.valid=true;}addComponent(C){const c=new C();c.node=this;c.onLoad?.();return c;}addChild(){}}
  const loads=[],bundle={load:(p,t,cb)=>loads.push({p,cb})};
  const ctx={_decorator:{ccclass:()=>x=>x},Component,Node,AudioSource,AudioClip:class{},assetManager:{getBundle:()=>bundle,loadBundle:(n,cb)=>cb(null,bundle)},resources:{load(){},loadDir(){}},director:{getScene:()=>new Node('scene'),addPersistRootNode(){}},game:new Events(),Game:{EVENT_HIDE:'hide',EVENT_SHOW:'show'},input:new Events(),Input:{EventType:{TOUCH_END:'t',MOUSE_UP:'m',KEY_DOWN:'k'}},sys:{localStorage:{getItem:()=>null,setItem(){}}},isValid:n=>!!n?.valid,console:{warn(){},info(){}},globalThis:{}};
  ctx.globalThis=ctx;vm.runInNewContext(js,ctx);const A=ctx.AudioClass;let time=50000;A.now=()=>time;const a=A.ensure();
  const clip=(n,d)=>({name:n,refs:0,addRef(){this.refs++;},decRef(){this.refs--;},getDuration:()=>d});
  const play=s=>{for(const x of all)if(x.playing)x.currentTime+=s;time+=s*1000;};
  const hide=()=>{a.onHide();ctx.game.emit('hide');},show=()=>{a.onShow();ctx.game.emit('show');};
  return {A,a,all,loads,clip,play,hide,show};
 };
 const out=[];
 for(const hiddenS of [3,10]){
  const h=make(),a=h.a;a.onGesture();a.setMusic('audio/bgm_main','audio_bgm_island');const m=h.loads.find(l=>l.p==='audio/bgm_main');m.cb(null,h.clip('bgm_main',83.478));
  const loop=h.all.find(s=>s.clip?.name==='bgm_main');assert(loop&&loop.playing,'bgm playing');
  for(const s of ['home','standing','turning-out','walking-out','opening-door'])a.onWorldState(s);const ex=h.loads.find(l=>l.p==='audio_cine/sfx_exit_outbound');ex.cb(null,h.clip('sfx_exit_outbound',20));
  h.play(9);a.onWorldState('crossing-out');const v1=h.all.find(s=>s.clip?.name==='sfx_exit_outbound');assert(v1&&v1.playing);h.play(4.25);
  const bgmAt=loop.currentTime,exitAt=v1.currentTime;
  // Background mid-'crossing-out'. The flow freezes the walk, so no world state reaches GameAudio (Boot feeds changes only).
  const stops0=loop.stops;h.hide();assert(!loop.playing&&loop.stops===stops0,'BGM paused, not stopped');
  h.show();assert(loop.playing,'BGM back');assert.equal(loop.restarts,0,'BGM never restarted');assert.equal(loop.stops,stops0,'no stop');assert(Math.abs(loop.currentTime-bgmAt)<1e-9,'BGM resumes at '+bgmAt+' s');
  const voices=h.all.filter(s=>s.clip?.name==='sfx_exit_outbound'&&s.playing);assert.equal(voices.length,1,'one exit voice');assert(voices[0]!==v1);
  assert(Math.abs(voices[0].currentTime-exitAt)<=.05,'exit track continues at its offset: '+voices[0].currentTime+' vs '+exitAt);const bgmOnShow=loop.currentTime,exitOnShow=voices[0].currentTime;
  const ev=a.exitCineDiagnostics().log.map(e=>e.event);assert(ev.includes('hold')&&ev.includes('resume'),ev.join());
  h.show();assert.equal(h.all.filter(s=>s.clip?.name==='sfx_exit_outbound'&&s.playing).length,1,'repeated show: still one voice');
  h.play(2);a.onWorldState('island');assert(voices[0].playing,'island keeps the tail');
  out.push({hiddenS,bgmOffsetAtHideS:+bgmAt.toFixed(3),bgmOffsetOnShowS:+bgmOnShow.toFixed(3),exitTrackAtHideS:+exitAt.toFixed(3),exitTrackOnShowS:+exitOnShow.toFixed(3),bgmRestarts:loop.restarts});
 }
 // Old rules kept: background on the island tail (flow goes paused) does not resume it; an interruption is not held.
 {const h=make(),a=h.a;a.onGesture();for(const s of ['standing','opening-door'])a.onWorldState(s);h.loads.find(l=>l.p==='audio_cine/sfx_exit_outbound').cb(null,h.clip('sfx_exit_outbound',20));a.onWorldState('crossing-out');h.play(3);a.onWorldState('island');h.play(1);
  h.hide();a.onWorldState('paused');h.play(3);h.show();assert.equal(h.all.filter(s=>s.clip?.name==='sfx_exit_outbound'&&s.playing).length,0,'island tail stays cut');}
 {const h=make(),a=h.a;a.onGesture();for(const s of ['standing','opening-door'])a.onWorldState(s);h.loads.find(l=>l.p==='audio_cine/sfx_exit_outbound').cb(null,h.clip('sfx_exit_outbound',20));a.onWorldState('crossing-out');h.play(3);
  a.onInterruptBegin();h.play(2);a.onInterruptEnd();assert.equal(h.all.filter(s=>s.clip?.name==='sfx_exit_outbound'&&s.playing).length,0,'interruption: voice ends (unchanged)');}
 // Old flow (V1 cancel → 'paused' → 'standing'): any state change drops the hold, so nothing resumes into a restarted exit.
 {const h=make(),a=h.a;a.onGesture();for(const s of ['standing','opening-door'])a.onWorldState(s);h.loads.find(l=>l.p==='audio_cine/sfx_exit_outbound').cb(null,h.clip('sfx_exit_outbound',20));a.onWorldState('crossing-out');h.play(3);
  h.hide();a.onWorldState('paused');h.show();assert.equal(h.all.filter(s=>s.clip?.name==='sfx_exit_outbound'&&s.playing).length,0);}
 assert.equal((fs.readFileSync(S+'audio/GameAudio.ts','utf8').match(/this\.muted \|\| this\.sfxMuted \|\| this\.reasons\.size > 0/g)||[]).length,3,'3 sfxMuted gates unchanged');
 return out;
}
function footstepCases(){
 // walk_loop-like clip with two plants per 1.1 s cycle; frozen clock while hidden (abs does not move; Boot may still tick).
 const plants={walk_loop:[{t:.27,bone:'foot.L'},{t:.82,bone:'foot.R'}]},dur=1.1;
 const run=(hideAt,hiddenS,ticks)=>{const tr=new FootstepTracker(plants),clock={base:{clip:'walk_loop',abs:0,loop:true,duration:dur}},hits=[];let t=0;
  while(clock.base.abs<8){const hidden=hideAt!==null&&t>=hideAt&&t<hideAt+hiddenS;if(!hidden)clock.base.abs+=DT;if(!hidden||ticks)for(const x of tr.observe(clock,DT))hits.push(x.plantAbs);t+=DT;}
  return hits;};
 const ref=run(null,0,false),out=[];
 for(const hideAt of [1.0,2.5,4.33])for(const hiddenS of [3,10])for(const ticks of [false,true]){const h=run(hideAt,hiddenS,ticks);
  assert.deepEqual(h.map(v=>+v.toFixed(6)),ref.map(v=>+v.toFixed(6)),'same plants as uninterrupted (hide at '+hideAt+' for '+hiddenS+' s)');assert.equal(new Set(h.map(v=>v.toFixed(6))).size,h.length,'no doubled plant');out.push({hideAt,hiddenS,framesWhileHidden:ticks,steps:h.length});}
 assert.equal(ref.length,crossedPlants(plants.walk_loop,-1e-9,ref[ref.length-1]+1e-9,dur,true).length);
 return {uninterruptedSteps:ref.length,cases:out.length};
}
