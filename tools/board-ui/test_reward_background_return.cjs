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
 const checks=[];
 for(const which of ['before-claim','after-chest','after-region']){
  for(let i=0;i<3;i++){const saved=bytes(),panel=u.popups.find('ResultPanel'),names=u.popups.names().join(',');flow.hide();update();flow.hide();flow.show();flow.show();update();step();
   assert.equal(flow.snapshot().state,'level');assert.equal(controls.get('resume').active,false);assert.equal(bytes(),saved);assert.equal(u.popups.names().join(','),names);assert.equal(u.popups.find('ResultPanel'),panel);
   assert.equal(H.cc._scene.getComponentsInChildren(UI).length,1);}
  checks.push({which,cycles:3,duplicateEvents:true,storageUnchanged:true,sameResultPanel:true,noGlobalResume:true});
  if(which==='before-claim'){H.tap(u.popups.find('ResultPanel').root.find('ResultChestTap'));update();assert(session.snapshot().journey.chests[0].opened);assert(session.snapshot().journey.regionRewards[0].claimed);}
  if(which==='after-chest'){
   const reward=u.popups.find('RewardPanel');assert(reward);H.tap(reward.root.find('Accept'));step();update();
   assert(!u.popups.find('ResultPanel').root.find('ResultChestTap'),'both rewards leave with the one claim');
  }
 }
 const reward=u.popups.find('RewardPanel');if(reward)H.tap(reward.root.find('Accept'));step();update();
 const beforeDuplicate=bytes();assert(session.command('openChest',0).duplicate);assert(session.command('claimRegion',0).duplicate);assert.equal(bytes(),beforeDuplicate);
 H.tap(u.popups.find('ResultPanel').root.find('Next'));assert.equal(next,1);
 lease.dispose();assert.equal(H.cc._scene.getComponentsInChildren(UI).length,0);
 console.log(JSON.stringify({status:'PASS',scope:'Actual production TS, controller witness actions, Map-only storage, Cocos doubles. No native input/GPU/phone lockscreen claim.',checks,nextButtonRouted:true,duplicateRewardsZeroWrites:true,disposed:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
