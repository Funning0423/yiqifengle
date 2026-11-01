'use strict';
const assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs');
const W=require('../mainline-fixtures/verified-replays.json');
const Host=require('../../creator-build-project/assets/scripts/regional-r05/runtime/campaign-host.js');
const checks=[];
for(const end of [4,8,12]){
 const H=createHarness({debug:true}),{createRegionFlowCheckpoint}=H.load('world-r2/RegionFlowTest');
 const x=createRegionFlowCheckpoint(end);assert.equal(x.stageId,W[end-1].stageId);
 const c=x.mainline.createController(),s=c.snapshot();assert.equal(s.active.status,'playing');assert.equal(s.journey.completed,end-1);assert.equal(s.active.actions.length,W[end-1].actions.length-1);
 assert.deepEqual(s.active.actions,W[end-1].actions.slice(0,-1));assert.equal(s.journey.records[end-1].bestStars,0);
 assert(c.resume().ok);const p=c.previewAction(x.lastAction);assert(p.ok);assert(c.commitAction(p.token).ok);while(c.snapshot().visual)assert(c.finishVisualStep(c.snapshot().visual.token).ok);
 const won=c.snapshot();assert.equal(won.state,'result.saved');assert.equal(won.journey.completed,end);
 const gates=['tide','meadow','sky'].map((region,i)=>Host.inspectSelection(x.r5,{stageId:'r05-'+region+'-01',seed:require('../../creator-build-project/assets/scripts/regional-r05/runtime/index.js').getStage('r05-'+region+'-01').seedBank[0]}).ok);assert.deepEqual(gates,[end>=4,end>=8,end>=12]);
 for(const cmd of [['openChest',end-1],['claimRegion',Math.floor((end-1)/4)]]){assert(c[cmd[0]](cmd[1]).ok);const bytes=JSON.stringify(x.mainline.inspect());assert(c[cmd[0]](cmd[1]).ok);assert.equal(JSON.stringify(x.mainline.inspect()),bytes);}
 checks.push({end,preWinActions:s.active.actions.length,completedAfter:won.journey.completed,gates,namespace:x.namespace});
}
const release=createHarness();assert.throws(()=>release.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(4),/test-build-only/);
console.log(JSON.stringify({status:'PASS',scope:'Actual engine/controller replay with temporary storage; no native/device claim',checks},null,2));
