'use strict';
// Actual WorldIntegrationBoot navigation wiring (board-ui harness: real Boot, real IslandJourneyOverlay / WarmButton /
// navigation layout; doubles for the 3D props, T1 lighthouse tap, startup gate, room overlay and region loader).
// IslandProps never becomes ready here, so this keeps covering the flat-button path.
const assert=require('node:assert/strict');const {createHarness}=require('../board-ui/harness.cjs');
const islandHomes=[];class IslandHomeInteraction{constructor(parent,options){this.parent=parent;this.options=options;this.syncs=[];this.disposed=false;islandHomes.push(this);}sync(w,h,enabled){this.syncs.push(enabled);}dispose(){this.disposed=true;}get last(){return this.syncs[this.syncs.length-1];}}
let skinCalls=0;
const B=createHarness({overrides:{
 'world-r2/IslandHomeInteraction':{IslandHomeInteraction},
 'world-r2/IslandProps':{IslandProps:class{get ready(){return false;}load(){return Promise.resolve(false);}dispose(){}}},
 'world-r2/StartupReadyGate':{StartupReadyGate:class{dispose(){}},StartupAttempt:class{},StartupCancelled:class extends Error{}},
 'RoomExploreOverlay':{RoomExploreOverlay:class{sync(){}diagnostics(){return null;}dispose(){}}},
}});
const realSkin=B.load('ui/JourneyNavigationSkin');
// count skin bakes: wrap the real export the Boot imports (same module instance)
const origSkin=realSkin.applyJourneyNavigationSkin;Object.defineProperty(realSkin,'applyJourneyNavigationSkin',{configurable:true,enumerable:true,get:()=>(...a)=>{skinCalls++;return origSkin(...a);}});
const hudLog=[];const consoleInfo=console.info;console.info=(...a)=>{if(typeof a[0]==='string'&&a[0].startsWith('[OI_HUD]'))hudLog.push(a[0]);else consoleInfo(...a);};
const code=require('node:fs').readFileSync(require('node:path').join(B.SCRIPTS,'WorldIntegrationBoot.ts'),'utf8');
const Boot=B.load('WorldIntegrationBoot').WorldIntegrationBoot;
const H={Node:B.cc.Node,UITransform:B.cc.UITransform,point:B.point,event:(id,p)=>B.event(p,id),tapNode:n=>B.tap(n),setup:(prov,region,w,h)=>B.setViewport(w,h)};
B.cc.director.getScene=()=>null;
let cases=0,hudCases=0;
for(const [w,h] of [[320,568],[390,844],[402,874],[568,320],[844,390]]){
 H.setup('mainline-v33',0,w,h);const boot=new Boot(),calls=[];let snap={state:'island',needsResume:false,hidden:false};boot.node=new H.Node('Boot');boot.ready=true;boot.loadPhase='ready';boot.board=()=>null;boot.composition={worldCommands:()=>({snapshot:()=>snap,dayNight:()=>({mode:'day'}),returnHome:()=>calls.push('home'),enterSkycity:()=>calls.push('skycity'),exitSkycity:()=>calls.push('back'),cancelTransition:()=>({ok:true})}),enterMainline:()=>calls.push('mainline'),islandOverview:()=>({journey:{inventory:{tools:{windBell:1}}}}),islandGates:()=>({r4:[],r5:[]})};const preResize=skinCalls;boot.createNavigation();boot.resize();const before=skinCalls;assert.ok(before>preResize,'T2: island button skin is baked during resize while hidden');boot.paintNavigation();boot.paintNavigation();assert.equal(skinCalls,before,'T2: first visible island frame uses the pre-baked skin; no per-frame surface rebuild');assert.deepEqual([...boot.controls].filter(([,n])=>n.active).map(([k])=>k),['mainline']);
 const main=boot.controls.get('mainline'),r=main.getComponent(H.UITransform),d=boot.islandJourney.buttons;if(w<h)assert(main.position.y-r.height/2>Math.max(...d.map(n=>n.position.y+32)),'portrait primary above dock');else{assert(main.position.x+r.width/2<Math.min(...d.map(n=>n.position.x-32)),'landscape primary left of dock');assert(main.position.y-r.height/2>=-h/2+20);assert(main.position.y+r.height/2<-h*.2,'landscape middle remains clear');}assert(main.position.y+r.height/2<h/2);assert(r.width<=w-32);
 const event=H.event(1,H.point(main));main.emit(H.Node.EventType.TOUCH_START,event);H.tapNode(d[1]);assert(boot.islandJourney.isOpen());main.emit(H.Node.EventType.TOUCH_END,event);assert.equal(calls.length,0,'captured mainline cannot fire behind open journal');boot.paintNavigation();assert.equal(main.active,false);boot.islandJourney.close();boot.paintNavigation();assert.equal(main.active,true);
 const ih=islandHomes[islandHomes.length-1];assert.ok(ih&&ih.parent===boot.canvas,'T1 IslandHomeInteraction created on the Boot canvas');assert.equal(ih.last,true,'T1 lighthouse tap enabled on stable island');
 assert.equal(typeof ih.options.canUse,'function');assert.equal(typeof ih.options.hit,'function');assert.equal(typeof ih.options.returnHome,'function');
 snap={state:'skycity',needsResume:false,hidden:false};boot.paintNavigation();assert.equal(ih.last,false,'T1 lighthouse disabled off-island');assert.deepEqual([...boot.controls].filter(([,n])=>n.active).map(([k])=>k),['returnIsland']);assert.equal(boot.islandJourney.root.active,false);
 snap={state:'skycity-loading',needsResume:false,hidden:false};boot.paintNavigation();assert.deepEqual([...boot.controls].filter(([,n])=>n.active).map(([k])=>k),['cancelVisit']);boot.islandJourney.dispose();
 // Status bar removed: never on screen in ANY ready-world state. Before every frame the plate is forced active (as the
 // loading screen leaves it) to prove the Boot itself turns it off; settle/crane hooks still fire (T0/camera) but the
 // Boot no longer subscribes. Errors and the skycity hint go to the console log only, once per change.
 {const plate=boot.status.node.parent,seen=[];const frames=(n,label,dt=1/60)=>{for(let i=0;i<n;i++){plate.active=true;boot.paintNavigation(dt);assert.equal(plate.active,false,'status bar shown: '+label+' @'+w+'x'+h);assert.equal(boot.status.string,'',label);}seen.push(label);};
  for(const k of ['statusHud','hideHud','slideInHud','bindHudHooks','applyStatusHud'])assert.equal(boot[k],undefined,'HUD API removed: '+k);
  assert.ok(!/StatusHud|onCameraSettled\(|onCraneStart\(/.test(code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')),'Boot has no StatusHud wiring / hook subscription');
  hudLog.length=0;const st=(state,extra={})=>{snap={state,needsResume:false,hidden:false,...extra};};
  st('home');frames(20,'home');
  for(const x of ['standing','turning-out','walking-out','opening-door','crossing-out'])st(x),frames(3,x);
  st('island');frames(60,'island');
  boot.error='网络有点慢，请稍后再试';frames(30,'island+error');boot.error='';frames(10,'island error cleared');
  st('island',{needsResume:true});frames(5,'needsResume');st('island',{hidden:true});frames(5,'hidden');st('island');
  for(const x of ['walking-home','crossing-in','closing-door','walking-to-seat','sitting'])st(x),frames(3,x);
  st('home');boot.error='记录暂时无法安全读取，请保留并稍后重试';frames(10,'home+error');boot.error='';frames(5,'home');
  st('skycity-loading');frames(10,'skycity-loading');st('skycity');frames(30,'skycity');st('skycity');boot.error='天空城加载失败';frames(5,'skycity+error');boot.error='';
  st('island');frames(10,'back on island');
  // early-return path (character bind failure before ready): still hidden, error logged
  const ready=boot.ready,attach=boot.composition.attachCalibratedCharacter;boot.ready=false;boot.composition.attachCalibratedCharacter=()=>({ok:false,reason:'角色绑定失败'});
  st('home');frames(3,'bind-failure early return');boot.ready=ready;boot.composition.attachCalibratedCharacter=attach;boot.error='';
  assert.deepEqual(hudLog,['[OI_HUD] suppressed {"kind":"error","text":"网络有点慢，请稍后再试"}','[OI_HUD] suppressed {"kind":"error","text":"记录暂时无法安全读取，请保留并稍后重试"}',
   '[OI_HUD] suppressed {"kind":"skycity","text":"天空城 · 轻点机器人或庭院"}','[OI_HUD] suppressed {"kind":"error","text":"天空城加载失败"}','[OI_HUD] suppressed {"kind":"error","text":"角色绑定失败"}'],JSON.stringify(hudLog));
  hudCases+=seen.length;
  boot.onDestroy?.call(boot);assert.equal(ih.disposed,true,'T1 stub disposed with Boot');}
 cases++;
}
console.log(JSON.stringify({status:'PASS',cases,statusBarHiddenStateChecks:hudCases,checks:['actual Boot wiring leaves one island primary plus three small utilities','T1 IslandHomeInteraction wired (stub): enabled on stable island, disabled off-island, disposed with Boot','status bar removed (Funning final): plate inactive every frame in home/cutscenes/island/error/needsResume/hidden/skycity-loading/skycity/bind-failure across five viewports; errors + skycity hint console-only [OI_HUD] suppressed, once per change; no HUD API on Boot','legacy six-button grid and day/night banner absent','primary/dock nonoverlap across five viewports','open journal blocks captured mainline release','skycity return and loading cancel stay separate, no background dock','no per-frame primary skin rebuild'],scope:'actual type-stripped Boot/overlay with Cocos memory doubles; no native screenshots/touch/save access'},null,2));
