'use strict';
// P2 (Mac full5 frame 815: 「暂停一下」 flashes on L11 entry). Cause: the DevTools save held an unfinished L11 attempt (earlier
// autoPlay rounds); MainlineHost restores it run.paused and presentForPlay opened PausePanel (only lakeside had resumeRestoredOnPresent);
// autoPlay then resumed ~1.6 s later. A real player who left mid-level saw the same panel. 运镜bot decision: world boards in every
// region go straight into play on reveal; PausePanel only for the pause button and returning from the background.
// Real MainlineHost + mainline controller + ManagedMobileBoardUI (harness cc doubles); flag value read from the real adapter source.
const assert=require('node:assert/strict');
const {createHarness}=require('./harness.cjs');
const Port=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port');
const Campaign=require('../../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign');
const witnesses=require('../region-levels/verified-mainline.json').entries;
const fs=require('node:fs'),path=require('node:path');
const AD=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/world-r2/NativeWorldLevelAdapter.ts'),'utf8');
const FLAG=/export const WORLD_BOARD_RESUMES_RESTORED=true;/.test(AD)&&/\(ui as any\)\.resumeRestoredOnPresent=WORLD_BOARD_RESUMES_RESTORED;/.test(AD);
const memory=src=>{const map=new Map(src);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const fin=c=>{while(c.snapshot().visual)assert(c.finishVisualStep(c.snapshot().visual.token).ok);};
const save=memory(),c0=Port.createPort(save).createController();
for(let level=0;level<10;level++){const w=witnesses.find(x=>x.level===level);assert(c0.startStage(w.stageId,{seed:w.seed}).ok);for(const a of w.actions){const p=c0.previewAction(a);assert(p.ok);assert(c0.commitAction(p.token).ok);fin(c0);}assert(c0.snapshot().result.completionRecorded);}
const L11=Campaign.stages[10];
async function enter(storage){return enter2(storage,L11);}
async function enter2(storage,L11){const H=createHarness();H.setViewport(390,844);const {openMainlineSession}=H.load('world-r2/MainlineHost'),{ManagedMobileBoardUI}=H.load('ManagedMobileBoardUI');
 const s=openMainlineSession({port:Port.createPort(storage),stageId:L11.id,seed:L11.seedBank[0],navigation:{exit:()=>({ok:true}),resume:()=>undefined}});
 const owner=new H.cc.Node('Owner'),ui=owner.addComponent(ManagedMobileBoardUI);H.cc._scene.addChild(owner);ui.deferPresentation=true;ui.resumeRestoredOnPresent=FLAG;
 ui.initializeManaged(s.controller,s.binding);await H.flush();ui.update(.016);ui.presentForPlay();for(let i=0;i<5;i++){ui.update(.016);await H.flush();}
 return {s,ui,H,pause:!!ui.popups?.find?.('PausePanel')};}
(async()=>{
 const fresh=await enter(memory(save.map));
 assert.equal(fresh.s.snapshot().state,'run.ready','fresh L11 starts playable');assert.equal(fresh.pause,false,'fresh entry: no 「暂停一下」');console.log('PASS fresh L11 entry: run.ready, no PausePanel');
 // leave mid-attempt: one committed move, then the board is torn down (app killed / back to island)
 const mid=memory(save.map),c=Port.createPort(mid).createController();assert(c.startStage(L11.id,{seed:L11.seedBank[0]}).ok);
 const w=witnesses.find(x=>x.level===10);const p=c.previewAction(w.actions[0]);assert(p.ok);assert(c.commitAction(p.token).ok);fin(c);assert.equal(c.snapshot().active.status,'playing');
 assert(FLAG,'adapter: all world boards resume restored attempts');
 for(const [region,level] of [['island',2],['meadow',6],['skycity',10]]){
  const st=Campaign.stages[level],ww=witnesses.find(x=>x.level===level),src=memory(save.map),cc=Port.createPort(src).createController();
  if(level>=10)assert(cc.startStage(st.id,{seed:st.seedBank[0]}).ok);else{/* replay-able older stage */assert(cc.startStage(st.id,{seed:st.seedBank[0]}).ok);}
  const pp=cc.previewAction(ww.actions[0]);assert(pp.ok);assert(cc.commitAction(pp.token).ok);fin(cc);assert.equal(cc.snapshot().active.status,'playing');
  const back=await enter2(memory(src.map),st);
  assert.equal(back.s.snapshot().state,'run.ready',region+': restored attempt goes straight into play');assert.equal(back.pause,false,region+': no 「暂停一下」 on reveal');
  // background return still asks for the explicit Resume
  back.ui.hide();for(let i=0;i<2;i++){back.ui.update(.016);await back.H.flush();}back.ui.show();for(let i=0;i<4;i++){back.ui.update(.016);await back.H.flush();}
  assert.equal(back.s.snapshot().state,'run.paused',region+': background return pauses');/* the hidden→visible PausePanel edge itself is unchanged code, covered by board-runtime 'lock return' */
  console.log('PASS '+region+' restored entry: run.ready, no PausePanel'+'; background return pauses (panel edge: board-runtime lock return)');}
 // pause button still opens it
 fresh.ui.openPausePanel();assert(fresh.ui.popups.find('PausePanel'),'pause button opens 「暂停一下」');console.log('PASS pause button still opens PausePanel');
})().catch(e=>{console.error(e);process.exit(1);});
