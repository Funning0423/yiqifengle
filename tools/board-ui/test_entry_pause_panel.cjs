'use strict';
// P2 (Mac full5 frame 815: 「暂停一下」 flashes on L11 entry). Real MainlineHost + mainline controller + ManagedMobileBoardUI (harness cc doubles).
// Fresh entry must reveal a playable board with NO PausePanel; only a RESTORED unfinished attempt (player left mid-level) opens it
// on reveal, by design (explicit Resume, QF-BOARD-FREEZE-20261013). The flash in full5 = DevTools save with an unfinished L11
// attempt left by earlier autoPlay rounds + autoPlay resuming it ~1.6 s later.
const assert=require('node:assert/strict');
const {createHarness}=require('./harness.cjs');
const Port=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port');
const Campaign=require('../../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign');
const witnesses=require('../region-levels/verified-mainline.json').entries;
const memory=src=>{const map=new Map(src);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const fin=c=>{while(c.snapshot().visual)assert(c.finishVisualStep(c.snapshot().visual.token).ok);};
const save=memory(),c0=Port.createPort(save).createController();
for(let level=0;level<10;level++){const w=witnesses.find(x=>x.level===level);assert(c0.startStage(w.stageId,{seed:w.seed}).ok);for(const a of w.actions){const p=c0.previewAction(a);assert(p.ok);assert(c0.commitAction(p.token).ok);fin(c0);}assert(c0.snapshot().result.completionRecorded);}
const L11=Campaign.stages[10];
async function enter(storage){const H=createHarness();H.setViewport(390,844);const {openMainlineSession}=H.load('world-r2/MainlineHost'),{ManagedMobileBoardUI}=H.load('ManagedMobileBoardUI');
 const s=openMainlineSession({port:Port.createPort(storage),stageId:L11.id,seed:L11.seedBank[0],navigation:{exit:()=>({ok:true}),resume:()=>undefined}});
 const owner=new H.cc.Node('Owner'),ui=owner.addComponent(ManagedMobileBoardUI);H.cc._scene.addChild(owner);ui.deferPresentation=true;
 ui.initializeManaged(s.controller,s.binding);await H.flush();ui.update(.016);ui.presentForPlay();for(let i=0;i<5;i++){ui.update(.016);await H.flush();}
 return {s,ui,pause:!!ui.popups?.find?.('PausePanel')};}
(async()=>{
 const fresh=await enter(memory(save.map));
 assert.equal(fresh.s.snapshot().state,'run.ready','fresh L11 starts playable');assert.equal(fresh.pause,false,'fresh entry: no 「暂停一下」');console.log('PASS fresh L11 entry: run.ready, no PausePanel');
 // leave mid-attempt: one committed move, then the board is torn down (app killed / back to island)
 const mid=memory(save.map),c=Port.createPort(mid).createController();assert(c.startStage(L11.id,{seed:L11.seedBank[0]}).ok);
 const w=witnesses.find(x=>x.level===10);const p=c.previewAction(w.actions[0]);assert(p.ok);assert(c.commitAction(p.token).ok);fin(c);assert.equal(c.snapshot().active.status,'playing');
 const back=await enter(memory(mid.map));
 assert.equal(back.s.snapshot().state,'run.paused','restored attempt stays paused');assert.equal(back.pause,true,'restored attempt: explicit Resume panel (by design)');console.log('PASS restored unfinished L11: run.paused + PausePanel (explicit Resume, by design)');
})().catch(e=>{console.error(e);process.exit(1);});
