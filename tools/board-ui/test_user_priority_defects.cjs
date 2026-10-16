'use strict';
// Actual TS against in-memory Cocos nodes. No browser, Creator build or real save access.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHarness}=require('./harness.cjs');
(async()=>{
 const H=createHarness(), A=H.load('ui/BoardArt'), K=H.load('ui/PopupKit'), P=H.load('ui/BoardPanels');
 await Promise.all(['board','popup','r2'].map(dir=>A.BoardArt.shared().load(dir)));
 const C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition;
 const calls=[]; const composition=Object.create(C.prototype);
 composition.world={commands:()=>({snapshot:()=>({state:'island'}),exitLevel(){calls.push('exit');return {ok:true};},enterLevel(){calls.push('enter');return {ok:true};}})};
 composition.mainline={createController(){throw Error('Recovery must not run for missing scene');}};
 composition.persistence={platform:{load(){throw Error('No save reads allowed for missing scene');}}};
 composition.selection={provider:'mainline',stageId:'mainline-04',seed:1};
 composition.activeSession={snapshot:()=>({provider:'mainline-v33',state:'result.saved',result:{completionRecorded:true},nextStageId:'mainline-05'})};
 for(let level=5;level<=8;level++)assert.throws(()=>A.boardBackgroundFor({provider:'mainline',stageId:'mainline-0'+level}),/meadow-requires-live-3d-background/);
 // The harness deliberately has no GLB importer: preflight failure must preserve the win.
 assert.equal((await composition.advanceMainline()).reason,'meadow-scene-load-failed');
 assert.equal(composition.selection.stageId,'mainline-04');assert.deepEqual(calls,[]);
 assert.equal(A.boardBackgroundFor({stageId:'mainline-04'}).bundle,'region_island');assert.equal(A.boardBackgroundFor({stageId:'r05-sky-01'}).bundle,'region_skycity');
 const owner=new H.cc.Node('PriorityDefectProbe');H.cc._scene.addChild(owner);const stack=new K.PopupStack(owner,()=>H.state.viewport), layouts=[];
 const model={kind:'win',score:510,stars:3,movesUsed:10,movesLeft:4,goalsLeft:[],chestHint:false,unlockHint:'草原场景暂未就绪，下一关暂不可进入；成绩和奖励已保留',nextUnavailable:'草原场景暂未就绪',next:()=>calls.push('next'),home:()=>calls.push('home'),rewards:[{id:'chest',label:'打开宝箱',icon:'popup/chest_closed',state:'ready',claim:()=>calls.push('chest')},{id:'tool',label:'领取地区道具',icon:'',tool:'tideNet',iconKind:'tool',state:'ready',claim:()=>calls.push('tool')}]};
 for(const [width,height] of [[390,844],[320,568],[844,390]]){
  H.setViewport(width,height);const panel=P.openResult(stack,model,null);for(let i=0;i<40;i++)stack.update(.025);
  if(height>600)assert(panel.height<height-80,'portrait panel must shrink to current result content');
  const count=Number(panel.root.find('ResultPageNumber').getComponent(H.cc.Label).string.split('/')[1])||1;
  let claim=null,tool=null,tapped=false;
  for(let page=0;page<count;page++){
   const live=panel.root.find('ResultChestTap');if(live&&live.activeInHierarchy)claim=live;
   const art=panel.root.find('ResultChestArt');
   if(art&&art.activeInHierarchy){const ui=art.getComponent(H.cc.UITransform),w=ui.width*Math.abs(art.scale.x),h=ui.height*Math.abs(art.scale.y);assert(Math.max(w,h)>=120,'chest hero at least 120');}
   const icon=panel.root.find('tool_tidenet');if(icon&&icon.activeInHierarchy)tool=icon;
   if(claim&&claim.activeInHierarchy&&!tapped){const face=claim.getChildByName('Face'),inside=face.children.filter(n=>!['Plate','Label'].includes(n.name));assert.equal(inside.length,0,'claim-all is the button under the hero');H.tap(claim);tapped=true;}
   if(page+1<count)H.tap(panel.root.find('ResultNextPage'));
  }
  assert(tapped,'one claim-all button');assert(calls.includes('chest')&&calls.includes('tool'),'one tap claims every ready reward');
  assert(tool,'region reward art stays on the result');const ui=tool.getComponent(H.cc.UITransform),tw=ui.width*Math.abs(tool.scale.x),th=ui.height*Math.abs(tool.scale.y);assert(Math.max(tw,th)>=50,'actual loaded reward icon visibly larger than old 44×36');
  H.tap(panel.root.find('Next'));assert(!calls.includes('next'),'unavailable meadow cannot advance');
  layouts.push({width,height,panelHeight:panel.height,pages:count});stack.clear();
 }
 const record=JSON.parse(fs.readFileSync('docs/user-defects/2026-10-14-priority.json'));assert.equal(record.defects.length,4);assert(record.defects.every(d=>d.status==='OPEN'));
 console.log(JSON.stringify({status:'PASS',layouts,checks:['failed meadow import preflight cannot mutate selection, exit won level or read recovery/save data','island and real sky-city art routing remain intact','current PNG icons mounted inside card hit area, enlarged, reachable on finite pages','unavailable next disabled; all four user defects remain OPEN'],scope:'Node geometry and method contracts only; actual Cocos visual/scene acceptance queued'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
