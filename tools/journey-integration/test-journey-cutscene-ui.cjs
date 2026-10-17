'use strict';
// Funning (Mac, desktop package 09a1b8e): the journey cutscene shows no 「暂停旅程」 button and no caption strip; only test
// builds draw a tiny non-interactive 「开发预览画面，不代表最终效果」 line bottom-right (clear of safe area + capsule).
// Tapping the picture never pauses; going to the background pauses and coming back resumes by itself.
// Real type-stripped WorldIntegrationBoot + DevPreviewMark (board-ui harness, Cocos memory doubles). No GPU / native touch.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {createHarness}=require('../board-ui/harness.cjs');
const B=createHarness({overrides:{
 'world-r2/IslandHomeInteraction':{IslandHomeInteraction:class{sync(){}dispose(){}}},
 'world-r2/IslandProps':{IslandProps:class{get ready(){return false;}load(){return Promise.resolve(false);}dispose(){}}},
 'world-r2/StartupReadyGate':{StartupReadyGate:class{dispose(){}},StartupAttempt:class{},StartupCancelled:class extends Error{}},
 'RoomExploreOverlay':{RoomExploreOverlay:class{sync(){}diagnostics(){return null;}dispose(){}}},
}});
const SRC=path.join(B.SCRIPTS,'WorldIntegrationBoot.ts'),code=fs.readFileSync(SRC,'utf8'),strip=t=>t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
assert(!strip(code).includes('暂停旅程'),'no 「暂停旅程」 label left in the Boot');
assert(!/this\.notice\b/.test(strip(code)),'the caption/notes strip (notice plate) is gone from the Boot');
for(const t of ['沿着彩虹，去下一片天地','快到了，跟着风往前走','旅程已暂停。点继续旅程从这里接着走'])assert(!code.includes(t),'old strip copy removed: '+t);
const M=B.load('ui/DevPreviewMark'),Boot=B.load('WorldIntegrationBoot').WorldIntegrationBoot,{Node,UITransform,Label}=B.cc;
// Build flag: DEBUG define, WeChat envVersion, web.
const acct=env=>({getAccountInfoSync:()=>({miniProgram:{envVersion:env}})});
assert.equal(M.devPreviewBuild(true,acct('release')),true,'DEBUG build: shown');
assert.equal(M.devPreviewBuild(false,acct('develop')),true,'WeChat devtools / 开发版: shown');
assert.equal(M.devPreviewBuild(false,acct('trial')),true,'体验版: shown');
assert.equal(M.devPreviewBuild(false,acct('release')),false,'正式版: hidden');
assert.equal(M.devPreviewBuild(false,{getAccountInfoSync:()=>{throw Error('x');}}),false,'unreadable env: hidden');
assert.equal(M.devPreviewBuild(false,{}),false,'no envVersion: hidden');
assert.equal(M.devPreviewBuild(false,null),true,'web preview (no wx): shown');
const CUTSCENE=[{state:'region-loading',journey:{phase:'loading',target:'lakeside'}},{state:'region-travel',journey:{phase:'approach',target:'lakeside'}},{state:'region-travel',journey:{phase:'bridge',target:'meadow'}},{state:'region-travel',journey:{phase:'arrival',target:'skycity'}}];
// The startup loading layer has faded out long before any journey (its fade is not driven here), so it is skipped.
const active=(n,skip)=>{const out=[];const w=x=>{if(x===skip)return;if(x.activeInHierarchy)out.push(x);for(const c of x.children)w(c);};w(n);return out;};
let cases=0,taps=0;const report={};
for(const [w,h] of [[320,568],[390,844],[402,874],[568,320],[844,390]]){
 B.setViewport(w,h);const boot=new Boot(),calls=[];let snap={state:'island',needsResume:false,hidden:false};
 boot.node=new Node('Boot');boot.ready=true;boot.loadPhase='ready';boot.board=()=>null;
 const cmd={snapshot:()=>snap,dayNight:()=>({mode:'day'}),returnHome:()=>calls.push('home'),enterSkycity:()=>calls.push('skycity'),exitSkycity:()=>calls.push('back'),cancelTransition:()=>{calls.push('cancelTransition');return {ok:true};},resume:()=>{calls.push('resume');return {ok:true};}};
 boot.composition={worldCommands:()=>cmd,enterMainline:()=>calls.push('mainline'),resumeJourney:()=>{calls.push('resumeJourney');snap={state:'region-travel',needsResume:false,hidden:false,journey:{phase:'bridge',target:'lakeside'}};return Promise.resolve({ok:true});},islandOverview:()=>({journey:{inventory:{tools:{windBell:1}}}}),islandGates:()=>({r4:[],r5:[]})};
 boot.createNavigation();boot.resize();
 const mark=boot.canvas.getChildByName('DevPreviewMark');assert(mark,'DevPreviewMark on the navigation canvas');
 snap={state:'island',needsResume:false,hidden:false};boot.paintNavigation();assert.equal(mark.active,false,'no mark on the island');
 for(const c of CUTSCENE){snap={needsResume:false,hidden:false,...c};for(let i=0;i<3;i++)boot.paintNavigation(1/60);
  const ctl=[...boot.controls].filter(([,n])=>n.activeInHierarchy).map(([k])=>k);assert.deepEqual(ctl,[],w+'x'+h+' '+c.state+'/'+c.journey.phase+': no button over the cutscene');
  const plates=active(boot.canvas,boot.loadingBackdrop).filter(n=>n.name==='LabelPlate');assert.deepEqual(plates.map(n=>n.getComponentInChildren(Label)?.string),[],'no caption/notes strip');
  const labels=active(boot.canvas,boot.loadingBackdrop).map(n=>n.getComponent(Label)).filter(Boolean).filter(l=>l.string);
  assert.deepEqual(labels.map(l=>l.string),[M.DEV_PREVIEW_TEXT],'the only text on screen is the dev line');
  // Geometry: bottom-right, inset >= 12 from the safe-area bottom/right, inside the screen, far from the top-right capsule.
  const t=mark.getComponent(UITransform),r={l:mark.position.x-t.width/2+w/2,r:mark.position.x+t.width/2+w/2,top:h/2-(mark.position.y+t.height/2),bot:h/2-(mark.position.y-t.height/2)};
  const safe=B.load('ui/BoardLayout').boardSafeInsets(w,h);
  assert(r.l>=0&&r.top>=0,'inside the screen');assert(w-r.r>=safe.right+12-1e-6,'inset from the right safe edge');assert(h-r.bot>=safe.bottom+12-1e-6,'above the bottom safe area');
  assert(r.l>w/2-1,'right half');assert(r.top>h/2,'bottom half');
  const cap=safe.capsule;if(cap)assert(r.top>cap.bottom||r.r<cap.left,'clear of the capsule');
  const l=mark.getComponent(Label);assert(l.fontSize<=10&&l.color.a<255&&l.color.a>=96,'tiny, semi-transparent');
  report[w+'x'+h]={x:+r.l.toFixed(1),y:+r.top.toFixed(1),width:t.width,height:t.height,rightGap:+(w-r.r).toFixed(1),bottomGap:+(h-r.bot).toFixed(1)};
  // Non-interactive: plain Label node, no Button/BlockInputEvents, no touch listener; taps anywhere change nothing.
  for(const comp of mark.components)assert(['UITransform','Label'].includes(comp.constructor.name),'mark carries only UITransform + Label, found '+comp.constructor.name);
  for(const e of ['touch-start','touch-move','touch-end','touch-cancel',Node.EventType.TOUCH_START,Node.EventType.TOUCH_END])assert.equal(mark.listeners(e),0,'no '+e+' listener on the mark');
  const before=JSON.stringify(snap);
  for(const n of [mark,boot.canvas,boot.node]){const ev=B.event({x:w/2,y:h/2},1);n.emit(Node.EventType.TOUCH_START,ev);n.emit(Node.EventType.TOUCH_END,ev);taps++;}
  B.tap(mark);taps++;boot.paintNavigation(1/60);
  assert.deepEqual(calls,[],'a tap on the cutscene never pauses / cancels / resumes it');assert.equal(JSON.stringify(snap),before,'still playing');assert.equal(mark.active,true);}
 // Background: hide() suspends; the hidden frame may never paint (WeChat stops the loop). On return it resumes by itself, once, no 「继续」 button.
 for(const paintHidden of [true,false]){
  snap={state:'region-travel',needsResume:false,hidden:false,journey:{phase:'bridge',target:'lakeside'}};boot.paintNavigation(1/60);
  if(paintHidden){snap={state:'paused',needsResume:true,hidden:true,journey:{phase:'paused',target:'lakeside'}};boot.paintNavigation(1/60);assert.deepEqual(calls,[],'nothing runs while hidden');assert.equal(mark.active,false);}
  snap={state:'paused',needsResume:true,hidden:false,journey:{phase:'paused',target:'lakeside'}};boot.busy=true;boot.paintNavigation(1/60);
  assert.deepEqual(calls,[],'waits while busy');assert.equal(boot.controls.get('resume').active,false,'no 「继续」 button flash on return');boot.busy=false;
  boot.paintNavigation(1/60);await0();
  assert.deepEqual(calls,['resumeJourney'],'resumed by itself on return ('+(paintHidden?'hidden frame painted':'no hidden frame')+')');calls.length=0;
  boot.paintNavigation(1/60);boot.paintNavigation(1/60);assert.deepEqual(calls,[],'exactly once');assert.equal(mark.active,true,'cutscene back on screen');
 }
 // Not a cutscene (island) or an error: the existing paused 「继续」 path is untouched.
 snap={state:'island',needsResume:false,hidden:false};boot.paintNavigation();snap={state:'paused',needsResume:true,hidden:false};boot.paintNavigation();
 assert.deepEqual(calls,[]);assert.equal(boot.controls.get('resume').active,true,'island background return keeps 「继续」');
 snap={state:'region-travel',needsResume:false,hidden:false,journey:{phase:'bridge'}};boot.paintNavigation();snap={state:'error',needsResume:true,hidden:false,error:'x'};boot.paintNavigation();boot.paintNavigation();assert.deepEqual(calls,[],'an error is never auto-resumed');
 // Release build: no mark at all.
 const rel=new M.DevPreviewMark(boot.canvas,false);rel.sync(w,h,true);assert.equal(rel.root.active,false,'release build: hidden');rel.dispose();
 // skycity loading keeps its own small 取消前往 (not the journey cutscene).
 snap={state:'skycity-loading',needsResume:false,hidden:false};boot.paintNavigation();assert.deepEqual([...boot.controls].filter(([,n])=>n.active).map(([k])=>k),['cancelVisit']);assert.equal(mark.active,false);
 boot.onDestroy();cases++;
}
function await0(){} // invoke() is async but calls fn synchronously before its first await
console.log(JSON.stringify({status:'PASS',cases,taps,mark:{text:M.DEV_PREVIEW_TEXT,...M.DEV_PREVIEW_MARK},rects:report,checks:['no 暂停旅程 button / caption strip in loading/approach/bridge/arrival across five viewports','dev line is the only text, bottom-right, inset from safe area, clear of capsule, tiny + semi-transparent','dev line non-interactive (UITransform+Label only, zero touch listeners); taps never pause/cancel','background return auto-resumes the cutscene once (hidden frame painted or not), waits while busy, no 继续 flash','island / error paths unchanged','release builds hide the line (DEBUG / envVersion / web rules)','skycity-loading keeps 取消前往'],scope:'actual type-stripped Boot + DevPreviewMark with Cocos memory doubles; no native render/touch'},null,2));
