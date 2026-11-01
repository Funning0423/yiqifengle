'use strict';
// r4-prep (lead): landing from the island→lakeside journey into a 风铃湖畔 board must not open 「暂停一下」 for a restored
// unfinished attempt: it resumes straight into a playable board (steps shown as usual), first-time tool intros still show,
// saved bytes and actions are untouched. Boards without the flag keep the explicit Resume (test_restored_entry_resume).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('./harness.cjs');
const MainPort=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
async function restoredBoard(seen,flag){
 const H=createHarness();H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(seen));
 const mem=new Map(),port=MainPort.createPort({getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)});const c=port.createController();
 assert(c.startStage('mainline-01',{seed:1}).ok);const preview=c.previewAction(['swap',23,24]);assert(preview.ok);assert(c.commitAction(preview.token).ok);
 const restored=port.createController();assert.equal(restored.snapshot().state,'run.paused');const bytes=JSON.stringify([...mem]);
 const {createManagedMainlineBinding}=H.load('world-r2/ManagedMainlineBinding'),{ManagedMobileBoardUI}=H.load('ManagedMobileBoardUI');
 const u=new ManagedMobileBoardUI();u.node=new H.cc.Node('lake-owner');u.node.active=false;H.cc._scene.addChild(u.node);u.deferPresentation=true;u.resumeRestoredOnPresent=flag;
 u.initializeManaged({},createManagedMainlineBinding(port,restored,{exit:()=>({ok:true}),resume:()=>undefined}));await H.flush();u.update(1/60);
 assert(!u.popups.find('PausePanel'),'nothing before reveal');return {H,u,restored,mem,bytes};}
(async()=>{
 {const {u,restored,mem,bytes}=await restoredBoard(['starlight','windbell','tidebottle'],true);u.presentForPlay();for(let i=0;i<5;i++)u.update(1/60);
  assert(!u.popups.find('PausePanel'),'lakeside landing: no 「暂停一下」');assert.equal(restored.snapshot().state,'run.ready','playable at once');
  assert.equal(restored.snapshot().active.moves,u.snapshot.active.moves,'steps shown from the restored attempt');assert.deepEqual(restored.snapshot().active.actions,[['swap',23,24]],'restored action kept');
  assert.equal(JSON.stringify([...mem]),bytes,'resume does not rewrite the save');u.onDestroy();console.log('PASS restored lakeside landing resumes without the pause panel; steps, action and saved bytes kept');}
 {const {u,restored}=await restoredBoard([],true);u.presentForPlay();for(let i=0;i<5;i++)u.update(1/60);
  assert(!u.popups.find('PausePanel'));assert.equal(restored.snapshot().state,'run.ready');assert(u.popups.find('ToolIntroPanel'),'unseen first-time tool intro still shows (and first)');u.onDestroy();console.log('PASS unseen tool intro still shows on the lakeside landing, with no pause panel before it');}
 {const {u,restored}=await restoredBoard(['starlight','windbell','tidebottle'],false);u.presentForPlay();u.update(1/60);
  assert(u.popups.find('PausePanel'),'other boards keep the explicit Resume');assert.equal(restored.snapshot().state,'run.paused');u.onDestroy();console.log('PASS boards without the flag keep 「暂停一下」 (existing behaviour)');}
 const S=path.join(__dirname,'../../creator-build-project/assets/scripts/'),ad=fs.readFileSync(S+'world-r2/NativeWorldLevelAdapter.ts','utf8'),lr=fs.readFileSync(S+'world-r2/LevelRegion.ts','utf8');
 assert.match(ad,/\(ui as any\)\.resumeRestoredOnPresent=WORLD_BOARD_RESUMES_RESTORED;\s*\n\s*\(ui as any\)\.initializeManaged\(/,'adapter sets the flag (all world boards incl. 风铃湖畔, P2 full6) before initializeManaged');assert.match(ad,/export const WORLD_BOARD_RESUMES_RESTORED=true;/);
 assert.match(lr,/\^r0\[45\]-lake-\\d\+\$/,'flag only for r04/r05-lake-* stages');console.log('PASS wiring: adapter flag = WORLD_BOARD_RESUMES_RESTORED (all regions)');
})().catch(e=>{console.error(e);process.exitCode=1});
