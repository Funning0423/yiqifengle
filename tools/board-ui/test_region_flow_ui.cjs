'use strict';
const assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs');
(async()=>{const checks=[];
for(const end of [4,8,12]){
 const H=createHarness({debug:true}),x=H.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(end);
 H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['starlight','windbell','tidebottle']));
 const {createNativeWorldLevelAdapter}=H.load('world-r2/NativeWorldLevelAdapter'),{Cancellation}=H.load('world-r1/WorldFlowCore'),UI=H.load('ManagedMobileBoardUI').ManagedMobileBoardUI;
 let session;const adapter=createNativeWorldLevelAdapter({uiParent:H.cc._scene,fixture:{},mainlinePort:x.mainline,select:id=>({provider:'mainline',stageId:id,seed:x.seed}),navigation:{exit:()=>({ok:true}),resume:()=>undefined},onSession:s=>session=s,background:()=>({frame(){},setVisible(){},setPaused(){},dispose(){}})});
 const lease=await adapter.enter(x.stageId,new Cancellation());await H.flush();lease.reveal();const u=H.cc._scene.getComponentsInChildren(UI)[0],step=()=>{for(let n=0;n<1800;n++)u.update(1/60);};step();
 if(session.snapshot().state==='run.paused'){const pause=u.popups.find('PausePanel');assert(pause);H.tap(pause.root.find('Resume'));step();}
 assert.equal(session.snapshot().state,'run.ready');const a=x.lastAction;H.tap(u.cells[a[1]]);H.tap(u.cells[a[2]]);step();assert.equal(session.snapshot().state,'result.saved');assert.equal(session.snapshot().journey.completed,end);
 const m=u.resultModel(session.snapshot());assert(m.unlockHint);assert(m.unlockHint.includes(end===4?'主线 05':end===8?'主线 09':'天空挑战'));
 assert(u.popups.find('ResultPanel'));const bytes=JSON.stringify(x.mainline.inspect());for(let i=0;i<3;i++){lease.hide();lease.showPaused();step();assert.equal(JSON.stringify(x.mainline.inspect()),bytes);assert(lease.isSettledResult());}
 checks.push({checkpoint:end,finalAction:a,actualComponentEventRoute:true,registered:true,hint:m.unlockHint,backgroundCycles:3,native:false});lease.dispose();
}
console.log(JSON.stringify({status:'PASS',scope:'Production Cocos components with node doubles; not native/phone',checks},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
