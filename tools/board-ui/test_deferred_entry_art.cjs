'use strict';
// Real UI/Native adapter/mainline code; explicit frame-end Node destruction double.
// QF-BOARD-FREEZE-20261013. No Cocos engine or device lifecycle acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHarness}=require('./harness.cjs');
const Port=require('../../creator-build-project/assets/scripts/mainline-r1/adapter/mainline-port.js');
const results=[];
async function test(name,fn){try{const detail=await fn();results.push({name,ok:true,...detail});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.stack});console.error('FAIL',name,e.stack);}}
async function run({flushFirst,waiter,oldLate}) {
 const H=createHarness(),values=new Map(),writes=[],delayed=[];let session,wrapped=false;
 H.cc.sys.localStorage.setItem('qfl.ui.seenTools',JSON.stringify(['starlight','windbell','tidebottle']));
 const port=Port.createPort({getItem:k=>values.get(k)||null,setItem(k,v){writes.push(k);values.set(k,String(v));}});port.inspect=()=>[...values];
 const original=H.cc.assetManager.loadBundle;
 H.cc.assetManager.loadBundle=(name,callback)=>original(name,(error,bundle)=>{
  if(bundle&&!wrapped){wrapped=true;const load=bundle.loadDir;bundle.loadDir=(dir,type,done)=>{
   if(dir==='board')delayed.push({success:()=>load.call(bundle,dir,type,done),error:()=>done(Error('late old error'),null)});
   else load.call(bundle,dir,type,done);
  };}callback(error,bundle);
 });
 const {createNativeWorldLevelAdapter}=H.load('world-r2/NativeWorldLevelAdapter'),{Cancellation}=H.load('world-r1/WorldFlowCore');
 const UI=H.load('ManagedMobileBoardUI').ManagedMobileBoardUI,art=H.load('ui/BoardArt').BoardArt.shared();
 const adapter=createNativeWorldLevelAdapter({uiParent:H.cc._scene,fixture:{},select:id=>({provider:'mainline',stageId:id,seed:1}),navigation:{exit:()=>({ok:true}),resume:()=>undefined},mainlinePort:port,onSession:s=>session=s,background:()=>({frame(){},setVisible(){},dispose(){}})});
 let old,newer,flushOld;
 try{
  old=await adapter.enter('mainline-01',new Cancellation());await H.flush();const oldUI=H.cc._scene.getComponentsInChildren(UI)[0],oldPromise=oldUI.boardArtRequest;
  const oldGate=waiter?old.whenPlayable():null;await H.flush();const destroy=oldUI.node.destroy.bind(oldUI.node);oldUI.node.destroy=()=>{flushOld=destroy;};
  old.dispose();assert(flushOld);assert.equal(oldUI.boardArtRequest,null,'lease releases request before onDestroy');assert.equal(await oldPromise,false);if(oldGate)await oldGate;
  assert.equal(oldUI.disposing,false,'component destruction really is deferred');assert.equal(oldUI.inputVisible(),false);
  await assert.rejects(old.whenPlayable(),/enter-level-not-ready/);old.reveal();assert.equal(oldUI.camera.enabled,false);
  if(flushFirst){flushOld();await H.flush();}
  newer=await adapter.enter('mainline-01',new Cancellation());await H.flush();const newUI=H.cc._scene.getComponentsInChildren(UI).find(u=>u!==oldUI),controller=session.controller;
  assert(newUI);assert.notEqual(newUI.boardArtRequest,oldPromise);const gate=newer.whenPlayable();await H.flush();assert.equal(delayed.length,2);
  const bytes=JSON.stringify([...values]),writeCount=writes.length;
  if(!flushFirst){flushOld();await H.flush();}
  if(!oldLate){delayed[0].error();delayed[0].success();await H.flush();assert.equal(art.loaded('board'),false,'old callbacks cannot publish into current generation');}
  delayed[1].success();await H.flush();await gate;assert.equal(art.loaded('board'),true);const frame=art.frame('board/piece_leaf'),failures=art.diagnostics().failures.slice(),changes=[];const off=art.onChange(()=>changes.push('change'));
  if(oldLate){delayed[0].error();delayed[0].success();await H.flush();}
  oldUI.onDestroy();old.dispose();assert.equal(art.frame('board/piece_leaf'),frame);assert.deepEqual(art.diagnostics().failures,failures);assert.deepEqual(changes,[]);off();
  assert.equal(JSON.stringify([...values]),bytes);assert.equal(writes.length,writeCount,'disposal/load recovery attempts zero gameplay writes');
  newer.reveal();assert.equal(controller.snapshot().state,'run.paused');H.tap(newUI.pause);H.tap(newUI.popups.find('PausePanel').root.find('Resume'));for(let i=0;i<30;i++)newUI.update(1/60);
  H.tap(newUI.cells[23]);H.tap(newUI.cells[24]);for(let i=0;i<1800;i++)newUI.update(1/60);assert.equal(controller.snapshot().state,'run.ready');assert.deepEqual(controller.snapshot().active.actions,[['swap',23,24]]);assert.equal(controller.snapshot().active.moves,21);
  return {flushFirst,waiter,oldLate,loadDirCalls:delayed.length,ready:true,recoveryWriteCalls:0,bytesPreserved:true,explicitActions:1};
 }finally{newer?.dispose();old?.dispose();flushOld?.();}
}
(async()=>{
 for(const options of [{flushFirst:true,waiter:true,oldLate:false},{flushFirst:false,waiter:true,oldLate:false},{flushFirst:false,waiter:true,oldLate:true},{flushFirst:false,waiter:false,oldLate:false},{flushFirst:false,waiter:false,oldLate:true}])await test('deferred entry '+JSON.stringify(options),()=>run(options));
 const report={issue:'QF-BOARD-FREEZE-20261013',version:3,status:results.every(r=>r.ok)?'PASS':'FAIL',checks:results.length,scope:'Actual Native adapter, BoardArt, UI and mainline TS/JS with frame-end lifecycle and resource doubles; no engine/device run.',results};if(process.env.QF_DEFERRED_ENTRY_REPORT)fs.writeFileSync(process.env.QF_DEFERRED_ENTRY_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks}));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
