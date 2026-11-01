'use strict';
// Production adapter/controller/UI/flow + Cocos node doubles and temporary Map storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),{createHarness}=require('./harness.cjs');
const Port=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
const witness=require('../mainline-fixtures/verified-replays.json')[0];
const boot=fs.readFileSync('creator-build-project/assets/scripts/WorldIntegrationBoot.ts','utf8');
const start=boot.indexOf(' const board=this.board(),b=board?.hostPresentation();');
const gate=boot.slice(start,boot.indexOf('\n const f=this.navLayout()',start));
const transfer=boot.split('\n').find(x=>x.startsWith(' if(board){const actions:any='));
const {stripTypeScriptTypes}=require('node:module');
// Needs node:module.stripTypeScriptTypes (Node >=22.6). Older Node: report the reason and exit 78 (run-suite: BLOCKED_NODE); never a pass.
if(typeof stripTypeScriptTypes!=='function'){console.error('BLOCKED_NODE: reward-background-return requires Node >=22.6 (node:module.stripTypeScriptTypes), found '+process.version);process.exit(78);}
const paint=new Function('s',stripTypeScriptTypes("const RESULT_ACTION_IDS=['mainNext','chest','regionReward','next','claim'];\n"+gate+'\n'+transfer,{mode:'transform'}));
(async()=>{
 const H=createHarness(),values=new Map(),port=Port.createPort({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))});port.inspect=()=>[...values];
 H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['starlight','windbell','tidebottle']));
 const {WorldFlow,Cancellation}=H.load('world-r1/WorldFlowCore'),{createNativeWorldLevelAdapter}=H.load('world-r2/NativeWorldLevelAdapter');
 const UI=H.load('ManagedMobileBoardUI').ManagedMobileBoardUI;let session;
 const adapter=createNativeWorldLevelAdapter({uiParent:H.cc._scene,fixture:{},mainlinePort:port,select:id=>({provider:'mainline',stageId:id,seed:1}),navigation:{exit:()=>({ok:true}),resume:()=>undefined},onSession:s=>session=s,background:()=>({frame(){},setVisible(){},setPaused(){},dispose(){}})});
 const lease=await adapter.enter(witness.stageId,new Cancellation());await H.flush();lease.reveal();const u=H.cc._scene.getComponentsInChildren(UI)[0];
 const step=()=>{for(let i=0;i<1800;i++)u.update(1/60);};
 for(const action of witness.actions){assert(session.submit(action).ok);step();}
 assert.equal(session.snapshot().state,'result.saved');assert(lease.isSettledResult());
 const flow=Object.create(WorldFlow.prototype);Object.assign(flow,{state:'level',stable:'level',mode:'motion',hidden:false,needsResume:false,error:null,level:lease,world:null,
 invalidate(){},restore(){},characterReady:()=>true,emit(){},change(s){this.state=s;}});
 let next=0;const controls=new Map(['mainNext','chest','regionReward','next','claim','resume'].map(k=>[k,{active:false}]));
 const actions={mainNext:()=>next++,chest:()=>session.command('openChest',0),regionReward:()=>session.command('claimRegion',0)};
 const owner={board:()=>u,controls,resultActions:actions};const update=()=>paint.call(owner,flow.snapshot());
 const bytes=()=>JSON.stringify([...values]);update();const initialPanel=u.popups.find('ResultPanel');assert(initialPanel.root.find('ResultChestTap'));
 // The claimed rewards are visible on the result panel (open chest, every reward slot claimed) and stay so across background trips.
 const shown=()=>{const p=u.popups.find('ResultPanel');assert(p,'result panel still up');assert(p.resultDiagnostics().chestOpen,'chest shown open');assert(p.root.find('ResultReward-0'),'reward badges shown on the result panel');assert(!u.popups.find('RewardPanel'));};
 const checks=[];let settledPose=null,riseChecked=0;
 // Funning (Mac, 09a1b8e): nothing of the rewards may be on screen while the chest is closed: no badge, icon, count or name.
 // A reward node is every float holder / plate / count / name and every side-reward slot (ResultReward-1..); visible = active in hierarchy, opacity > 0.
 const REWARD=/^(ResultFloat|ResultCountBadge|ResultRewardState|stamp_claimed)|^ResultReward-[1-9]/;
 const visibleRewards=p=>{const out=[];const walk=(n,inside)=>{const r=inside||REWARD.test(n.name);const o=n.getComponent?.(H.cc.UIOpacity);if(r&&n.activeInHierarchy&&(!o||o.opacity>0))out.push(n.name);for(const c of n.children)walk(c,r);};walk(p.root,false);return out;};
 const holders=p=>{const out=[];const walk=n=>{if(/^ResultFloat-\d+$/.test(n.name)&&n.activeInHierarchy)out.push(n);for(const c of n.children)walk(c);};walk(p.root);return out;};
 const pose=p=>holders(p).map(n=>({name:n.name,x:+n.position.x.toFixed(2),y:n.position.y,opacity:n.getComponent(H.cc.UIOpacity)?.opacity??255}));
 const closed=()=>{const p=u.popups.find('ResultPanel');assert(p,'result panel up');assert(!p.resultDiagnostics().chestOpen,'chest still closed');assert.deepEqual(visibleRewards(p),[],'no reward of any kind on screen before the chest opens');assert.equal(p.resultDiagnostics().float.length,0,'no badge placed while closed');};
 const settled=(a,b,label)=>{assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++){assert.equal(a[i].name,b[i].name,label);assert.equal(a[i].x,b[i].x,label+' x');assert(Math.abs(a[i].y-b[i].y)<=3.01,label+' y (only the 3-pt bob)');assert.equal(b[i].opacity,255,label+' opacity');}};
 closed();
 for(const which of ['before-claim','after-chest','after-region']){
  for(let i=0;i<3;i++){const saved=bytes(),panel=u.popups.find('ResultPanel'),names=u.popups.names().join(',');flow.hide();update();flow.hide();flow.show();flow.show();update();step();
   assert.equal(flow.snapshot().state,'level');assert.equal(controls.get('resume').active,false);assert.equal(bytes(),saved);assert.equal(u.popups.names().join(','),names);assert.equal(u.popups.find('ResultPanel'),panel);
   assert.equal(H.cc._scene.getComponentsInChildren(UI).length,1);
   if(which==='before-claim')closed();else{shown();const now=pose(u.popups.find('ResultPanel'));settled(settledPose,now,which+' cycle '+i+': badges stay in their final place, no replayed rise');}}
  checks.push({which,cycles:3,rewardsShownOnResult:which!=='before-claim',duplicateEvents:true,storageUnchanged:true,sameResultPanel:true,noGlobalResume:true});
  if(which==='before-claim'){H.tap(u.popups.find('ResultPanel').root.find('ResultChestTap'));update();assert(session.snapshot().journey.chests[0].opened);assert(session.snapshot().journey.regionRewards[0].claimed);
   // The moment it opens the badges come out of the chest's mouth (below their final place, transparent) and rise into place.
   u.update(1/60);const opened=u.popups.find('ResultPanel');assert(opened.resultDiagnostics().chestOpen&&opened.resultDiagnostics().floatRise,'the panel shown as the chest opens plays the rise');
   const first=pose(opened),target=opened.resultDiagnostics().float;assert(first.length>=1,'badges placed once open');
   for(let k=0;k<first.length;k++){assert(first[k].y<target[k].y-20,'badge starts at the chest mouth, below its place');assert(first[k].opacity<255,'badge fades in as it leaves the chest');}
   for(let i=0;i<60;i++)u.update(1/60);settledPose=pose(opened);for(let k=0;k<settledPose.length;k++){assert(Math.abs(settledPose[k].y-target[k].y)<=3.01,'badge settled above the chest');assert.equal(settledPose[k].opacity,255);}
   riseChecked=first.length;}
  if(which==='after-chest'){
   // SPEC v2.1 / 3765e34: on the result screen the rewards show on the ResultPanel itself (open chest + reward badges), no 「获得」 RewardPanel.
   assert(!u.popups.find('RewardPanel'),'no separate RewardPanel on the result screen');
   assert(!u.popups.find('ResultPanel').root.find('ResultChestTap'),'both rewards leave with the one claim');
  }
 }
 const reward=u.popups.find('RewardPanel');if(reward)H.tap(reward.root.find('Accept'));step();update();
 const beforeDuplicate=bytes();assert(session.command('openChest',0).duplicate);assert(session.command('claimRegion',0).duplicate);assert.equal(bytes(),beforeDuplicate);
 H.tap(u.popups.find('ResultPanel').root.find('Next'));assert.equal(next,1);
 lease.dispose();assert.equal(H.cc._scene.getComponentsInChildren(UI).length,0);
 // Replayed level: its region tool was claimed long ago, this level's chest is still closed. Before the fix that claimed tool
 // floated above the closed chest (Funning's Mac report). Real BoardPanels.openResult, same Cocos doubles.
 const A=H.load('ui/BoardArt'),K=H.load('ui/PopupKit'),P=H.load('ui/BoardPanels');await Promise.all(['board','popup','r2'].map(d=>A.BoardArt.shared().load(d)));
 const stackOwner=new H.cc.Node('ReplayProbe');H.cc._scene.addChild(stackOwner);const stack=new K.PopupStack(stackOwner,()=>H.state.viewport);const settle=n=>{for(let i=0;i<n;i++)stack.update(1/60);};
 const replay=chest=>({kind:'win',score:630,stars:3,movesUsed:11,movesLeft:11,goalsLeft:[],chestHint:false,next:()=>{},home:()=>{},rewards:[{id:'chest',label:'打开宝箱',icon:'popup/chest_closed',iconKind:'chest',state:chest,claim:chest==='ready'?()=>{}:undefined},{id:'regionReward',label:'潮汐网',icon:'',tool:'tideNet',iconKind:'tool',state:'claimed',count:2}]});
 for(const [w,h] of [[390,844],[320,568]]){H.state.viewport={width:w,height:h,safeInsets:{top:47,bottom:34,left:0,right:0}};
  const c=P.openResult(stack,replay('ready'),null);settle(90);assert.deepEqual(visibleRewards(c),[],w+'x'+h+' closed chest + already-claimed tool: nothing shown');assert.equal(c.resultDiagnostics().float.length,0);stack.clear();settle(30);
  // An open chest shown later (restore / re-entry, the tap long past): badges settled at once, no second rise.
  const realNow=Date.now;Date.now=()=>realNow()+60000;try{const o=P.openResult(stack,replay('claimed'),null);stack.update(1/60);assert.equal(o.resultDiagnostics().floatRise,false,'no replay');const at=pose(o),tg=o.resultDiagnostics().float;assert(at.length>=1);for(let k=0;k<at.length;k++){assert.equal(at[k].opacity,255,'settled at once');assert(Math.abs(at[k].y-tg[k].y)<=3.01,'already in its final place');}stack.clear();settle(30);}finally{Date.now=realNow;}}
 checks.push({which:'replayed-level-closed-chest',claimedToolHidden:true,openChestLaterSettledNoRise:true,viewports:['390x844','320x568']});
 console.log(JSON.stringify({status:'PASS',scope:'Actual production TS, controller witness actions, Map-only storage, Cocos doubles. No native input/GPU/phone lockscreen claim.',checks,noRewardBeforeOpen:true,badgesRiseFromChestMouth:riseChecked,noReplayAfterBackground:true,nextButtonRouted:true,duplicateRewardsZeroWrites:true,disposed:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
