'use strict';
// Production session entry + real Cocos UI class on Cocos memory doubles.
// Geometry/input checks only. This does not render pixels or certify WebGL.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {createHarness} = require('../board-ui/harness.cjs');
const Port = require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port');
const Main = require('../../creator-build-project/assets/scripts/mainline-r1/runtime/mainline-controller');
const Campaign = require('../../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign');
const witnesses = require('./verified-mainline.json').entries;
function memory(source) {const map = new Map(source);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
function finishFrames(c) {while(c.snapshot().visual) assert(c.finishVisualStep(c.snapshot().visual.token).ok);}
const earned = memory(); const originalPort = Port.createPort(earned); const c = originalPort.createController();
for (let level = 0; level < 12; level++) {
  const w = witnesses.find(x=>x.level===level); assert(c.startStage(w.stageId,{seed:w.seed}).ok);
  for (const action of w.actions) {const p=c.previewAction(action);assert(p.ok);assert(c.commitAction(p.token).ok);finishFrames(c);}
  assert(c.snapshot().result.completionRecorded);
}
(async()=>{
  const checks=[];
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) for (let level=4;level<12;level++) {
    const H=createHarness();H.setViewport(viewport.width,viewport.height);
    const {openMainlineSession}=H.load('world-r2/MainlineHost');
    const {ManagedMobileBoardUI}=H.load('ManagedMobileBoardUI');
    const storage=memory(earned.map),port=Port.createPort(storage),stage=Campaign.stages[level];
    const session=openMainlineSession({port,stageId:stage.id,seed:stage.seedBank[0],navigation:{exit:()=>({ok:true}),resume:()=>undefined}});
    assert.equal(session.snapshot().active.stageId,stage.id);
    const owner=new H.cc.Node('RegionLevelProductionOwner'),ui=owner.addComponent(ManagedMobileBoardUI);H.cc._scene.addChild(owner);
    ui.initializeManaged(session.controller,session.binding);await H.flush();ui.update(.016);
    assert.equal(ui.titleLabel.string,`${String(level+1).padStart(2,'0')}  ${stage.name}`);
    assert.equal(ui.titleLabel.overflow,H.cc.Label.Overflow.SHRINK);
    assert.equal(ui.moves.string,String(stage.moves));
    assert.equal(ui.goalNodes.filter(n=>n.active).length,stage.goalOrder.length);
    const titleRect=ui.titleLabel.node.getComponent(H.cc.UITransform),plateRect=ui.plateSprite.node.getComponent(H.cc.UITransform);
    assert(titleRect.width>0 && titleRect.width<=plateRect.width);
    assert.equal(session.snapshot().active.chapterName,stage.chapterName);
    checks.push({stageId:stage.id,viewport,title:ui.titleLabel.string,goals:stage.goalOrder,moves:stage.moves,titleWidth:titleRect.width,plateWidth:plateRect.width});
    owner.destroy();
  }
  // Bind the real managed host/port and take genuine actions through its input
  // command path, rather than invoking a parallel hand-written gate/reward model.
  for (const level of [4,8]) {
    const H=createHarness(),{openMainlineSession}=H.load('world-r2/MainlineHost'),w=witnesses.find(x=>x.level===level);
    const storage=memory(earned.map),port=Port.createPort(storage),session=openMainlineSession({port,stageId:w.stageId,seed:w.seed,navigation:{exit:()=>({ok:true}),resume:()=>undefined}});
    let paints=0; const host=session.binding.bind(session.controller,{render:s=>{assert.equal(s.active.name,Campaign.stages[level].name);paints++;},animate:(_v,_s,done)=>done(),cancelAnimations:()=>{}});
    for(const a of w.actions) assert(session.binding.submit(a).ok);
    const s=session.snapshot();assert(s.result.completionRecorded);assert(s.rewardHandoff.chest.pending);
    assert.equal(s.journey.records[level].clears,2);assert(host.command('openChest',level).ok);
    const bytes=JSON.stringify([...storage.map]),dup=host.command('openChest',level);assert(dup.duplicate);assert.equal(JSON.stringify([...storage.map]),bytes);
    host.dispose();const cold=port.createController();assert(cold.snapshot().result.completionRecorded);assert.equal(cold.snapshot().journey.records[level].clears,2);
    checks.push({stageId:w.stageId,productionBindingActions:w.actions.length,paints,replayClearCount:2,duplicateChestSafe:true});
  }
  fs.writeFileSync(path.join(__dirname,'production-binding-results.json'),JSON.stringify({status:'PASS',scope:'Actual MainlineHost/ManagedMainlineBinding/port + ManagedMobileBoardUI on Cocos memory doubles. No pixel, WebGL, real storage or device acceptance.',checks},null,2)+'\n');
  console.log(`PASS ${checks.length} production regional entry/binding/UI geometry cases`);
})().catch(e=>{console.error(e);process.exitCode=1;});
