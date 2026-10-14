'use strict';
const assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs'),API=require('../../creator-build-project/assets/scripts/regional-r05/runtime/index.js');
(async()=>{const checks=[];
for(const [end,region]of [[4,'tide'],[8,'meadow'],[12,'sky']]){
 const H=createHarness({debug:true}),x=H.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(end),c=x.mainline.createController();assert(c.resume().ok);const p=c.previewAction(x.lastAction);assert(c.commitAction(p.token).ok);while(c.snapshot().visual)c.finishVisualStep(c.snapshot().visual.token);assert.equal(c.snapshot().state,'result.saved');
 const stage=API.catalog.find(s=>s.region===region&&s.ordinal===1),selection={provider:'r5',stageId:stage.id,seed:stage.seedBank[0]};let session;
 const {createNativeWorldLevelAdapter}=H.load('world-r2/NativeWorldLevelAdapter'),{Cancellation}=H.load('world-r1/WorldFlowCore');
 const adapter=createNativeWorldLevelAdapter({uiParent:H.cc._scene,fixture:{},mainlinePort:x.mainline,r5Persistence:x.r5,r4Persistence:x.r4,select:()=>selection,navigation:{exit:()=>({ok:true}),resume:()=>undefined},onSession:s=>session=s,background:()=>({frame(){},setVisible(){},setPaused(){},dispose(){}})});
 let lease=await adapter.enter(stage.id,new Cancellation());await H.flush();lease.reveal();assert.equal(session.snapshot().active.stageId,stage.id);const attempt=session.snapshot().active.attemptId;lease.dispose();
 lease=await adapter.enter(stage.id,new Cancellation());await H.flush();lease.reveal();assert.equal(session.snapshot().active.attemptId,attempt);assert.equal(session.snapshot().active.stageId,stage.id);lease.dispose();checks.push({end,region,stage:stage.id,attemptPreserved:true,native:false});
}
console.log(JSON.stringify({status:'PASS',scope:'Actual adapter/provider with node doubles; target entry/reentry ownership, no actual window or 3D scene acceptance',checks},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
