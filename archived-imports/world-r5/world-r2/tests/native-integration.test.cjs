const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {loadActualUI,loadTS,double:d}=require('./load-actual-ui.cjs');
const {createManagedBoardSession,FramePresenter}=loadTS(path.resolve(__dirname,'../components/ManagedBoardSession.ts'));
const {paintRegionalOverlay}=loadTS(path.resolve(__dirname,'../components/RegionalOverlay.ts'));
const {createNativeWorldLevelAdapter}=loadTS(path.resolve(__dirname,'../components/NativeWorldLevelAdapter.ts'));
const {Cancellation}=require('../../world-r1/components/WorldFlowCore.ts');
const BASE='/workspace/shared/grok-takeover/mac-recovery/reconstructed/COCOS-FIRSTSLICE-COMPAT/creator-build-project/assets/';
const R5ROOT='/workspace/shared/grok-takeover/parallel-development/levels-r5/revisions/v1.1-candidate';
const deps={R4:require(BASE+'scripts/r4-cloud-compat/runtime/challenge-controller.js'),R5:require(R5ROOT+'/import-only/runtime/board-session-provider.js'),port:require(BASE+'scripts/r4-cloud-compat/adapter/cocos-port.js')};
const fixture=require(BASE+'resources/firstslice/r4-smoke-fixture.json'),witnesses=require(R5ROOT+'/reports/verified-replays.json');
const audit={scope:'Actual NativeBoardUI source with explicit managed patch; cc-node contract double, real R4/R5 provider/binder. NOT Cocos runtime.',replays:[],kinds:new Set(),rendered:0};
function rig(selection,options={}){
 const parent=new d.cc.Node('NativeHost'),UI=loadActualUI(),ui=parent.addComponent(UI),stores=options.stores||{r4:new Map(),r5:new Map()};let exits=0;
 const session=createManagedBoardSession(selection,deps,stores,{exit:()=>{exits++;return options.onExit?.()||{ok:true}},resume:()=>undefined},(s,c)=>{audit.rendered++;paintRegionalOverlay(s,c)});
 ui.initializeManaged(fixture,session.binding);
 function drain(){let n=0;while(d.tick()){assert.ok(++n<500,'finite animation queue');}assert.equal(session.snapshot().visual,null);}
 return {ui,parent,stores,session,drain,get exits(){return exits},dispose(){session.dispose();parent.destroy()}};
}
function walk(r,actions){for(const action of actions){const p=r.session.command('previewAction',action);assert.equal(p.ok,true,JSON.stringify(action));assert.equal(r.session.command('commitAction',p.token).ok,true);let budget=100;while(r.session.snapshot().visual){audit.kinds.add(r.session.snapshot().visual.kind);assert.ok(budget--);assert.ok(d.tick());}}}

test('actual managed NativeBoardUI creates 49 cells with no duplicate lifecycle/global ownership',()=>{
 const existing={owner:'unrelated'};globalThis.__nativeBoard=existing;const r=rig({provider:'r4',stageId:fixture.stageId,seed:fixture.seed});
 assert.equal(r.ui.cells.length,49);assert.equal(r.ui.managedViewVersion(),'native-board-managed-v1');assert.equal(globalThis.__nativeBoard,existing);
 assert.equal([...d.events.values()].reduce((n,s)=>n+s.size,0),0);r.dispose();assert.equal(globalThis.__nativeBoard,existing);delete globalThis.__nativeBoard;
});
test('actual R4 NativeBoardUI swap input reaches same eight-action win',()=>{
 const r=rig({provider:'r4',stageId:fixture.stageId,seed:fixture.seed});
 for(const a of fixture.winningActions){if(a[0]==='swap')r.ui.swap(a[1],a[2]);else assert.equal(r.session.submit(a).ok,true);r.drain();}
 assert.equal(r.session.snapshot().state,'result.saved');assert.equal(r.session.snapshot().active.score,910);assert.equal(r.ui.snapshot.state,'result.saved');r.dispose();
});
test('actual NativeBoardUI renders every published R5 winning replay without completion claims',()=>{
 for(const [id,list] of Object.entries(witnesses))for(const w of list){const r=rig({provider:'r5',stageId:id,seed:w.seed});walk(r,w.actions);
  const s=r.session.snapshot();assert.equal(s.state,'result.session-saved');assert.equal(s.result.completionRecorded,false);assert.equal(r.session.controller.session.checkpoint().expectedState,w.expectedState);
  assert.equal(r.ui.snapshot.state,'result.session-saved');assert.match(r.ui.snapshot.uiResultCaption,/成绩未登记/);assert.equal(r.ui.snapshot.result.saved,undefined);
  audit.replays.push({stageId:id,seed:w.seed,actions:w.actions.length,score:s.active.score});r.dispose();}
});
test('R5 action/clear/drop display uses intermediate frames rather than final logical board',()=>{
 const r=rig({provider:'r5',stageId:'r05-meadow-03',seed:7});const original=r.session.snapshot().active.board;assert.equal(r.session.submit(['activate',37]).ok,true);
 const s=r.session.snapshot();assert.equal(s.visual.kind,'action');assert.deepEqual(r.ui.snapshot.active.board,s.visual.before);assert.notDeepEqual(r.ui.snapshot.active.board,s.active.board);
 while(r.session.snapshot().visual){const v=r.session.snapshot().visual;if(v.kind==='clear')assert.deepEqual(r.ui.snapshot.active.board,v.before);audit.kinds.add(v.kind);d.tick();}
 assert.notDeepEqual(r.ui.snapshot.active.board,original);r.dispose();
});
test('managed native tap activates a special without assuming action.tiles',()=>{
 const r=rig({provider:'r5',stageId:'r05-meadow-03',seed:7});r.ui.tap(37);r.ui.tap(37);assert.equal(r.session.snapshot().state,'run.resolving');assert.equal(r.session.snapshot().visual.action[0],'activate');r.drain();r.dispose();
});
test('three stage tools use exact actions and remain isolated from inventory',()=>{
 for(const [stage,index,kind] of [['r05-tide-01',-1,'tideAnchor'],['r05-meadow-01',3,'sunSeed'],['r05-sky-01',-1,'prismShift']]){
  const r=rig({provider:'r5',stageId:stage,seed:1});const before=r.session.snapshot().active.moves;
  assert.equal(r.session.binding.useTool(index).ok,true);assert.equal(r.session.snapshot().visual.kind,'tool');audit.kinds.add('tool');r.drain();
  assert.equal(r.session.snapshot().active.moves,before-1);assert.equal(r.session.snapshot().active.tool.charges,0);assert.equal(r.session.binding.useTool(index).ok,false);
  assert.deepEqual([...r.stores.r5.keys()],['forest-regional-r05-active']);assert.equal(r.stores.r4.size,0);r.dispose();}
});
test('native exit button requests world exit instead of opening its private stage book',()=>{
 const r=rig({provider:'r5',stageId:'r05-tide-01',seed:1});const result=r.ui.command('requestExit');assert.equal(result.ok,true);assert.equal(r.exits,1);assert.equal(r.session.snapshot().state,'run.ready');r.dispose();
});
test('unsupported R4 book/reward commands never enter R5 binder',()=>{
 const r=rig({provider:'r5',stageId:'r05-tide-01',seed:1});for(const command of ['selectStage','startStage','discardActive','claimMemento','finish'])assert.equal(r.session.command(command).reason,'host-navigation-only');r.dispose();
});
test('old animation callbacks after hide/dispose cannot advance any provider',()=>{
 const r=rig({provider:'r5',stageId:'r05-tide-01',seed:1});r.session.submit(witnesses['r05-tide-01'][0].actions[0]);const old=d.allCallbacks.at(-1),before=r.session.controller.session.checkpoint().expectedState;
 r.session.hide();r.session.show();assert.equal(r.session.snapshot().state,'run.paused');old();assert.equal(r.session.controller.session.checkpoint().expectedState,before);assert.equal(r.session.resume().ok,true);r.dispose();old();assert.equal(d.timers.size,0);
 const next=rig({provider:'r4',stageId:fixture.stageId,seed:fixture.seed});const beforeNext=next.session.snapshot();old();assert.deepEqual(next.session.snapshot(),beforeNext);next.dispose();
});
test('direct Cocos adapter instantiates the actual managed native UI and switches provider only after exit',async()=>{
 const parent=new d.cc.Node('UIParent');let lease;const adapter=createNativeWorldLevelAdapter({uiParent:parent,fixture,select:id=>({provider:id.startsWith('r05-')?'r5':'r4',stageId:id,seed:id.startsWith('r05-')?1:fixture.seed}),navigation:{exit:()=>{const r=lease.requestExit();if(r.ok)lease.dispose();return r;},resume:()=>undefined}});
 lease=await adapter.enter(fixture.stageId,new Cancellation());assert.equal(parent.children.length,1);
 await assert.rejects(()=>adapter.enter('r05-tide-01',new Cancellation()),/previous board/);
 assert.equal(lease.requestExit().ok,true);lease.dispose();assert.equal(parent.children.length,0);
 lease=await adapter.enter('r05-tide-01',new Cancellation());lease.hide();assert.equal(parent.children[0].active,false);lease.showPaused();assert.equal(parent.children[0].active,true);assert.equal(lease.resume().ok,true);lease.dispose();assert.equal(parent.children.length,0);
});
test('existing R5 different-stage record is preserved rather than discarded for provider selection',()=>{
 const stores={r4:new Map(),r5:new Map()},r=rig({provider:'r5',stageId:'r05-tide-01',seed:1},{stores});r.dispose();const before=[...stores.r5];assert.throws(()=>rig({provider:'r5',stageId:'r05-sky-01',seed:1},{stores}),/refused/);assert.deepEqual([...stores.r5],before);
});
test.after(()=>{assert.equal(d.timers.size,0);fs.writeFileSync(path.resolve(__dirname,'../evidence/native-integration-report.json'),JSON.stringify({...audit,kinds:[...audit.kinds]},null,2)+'\n');});
test('world-r1 state machine drives the actual managed NativeBoardUI through R4/R5 and returns home',async()=>{
 const {WorldFlow}=require('../../world-r1/components/WorldFlowCore.ts'),{createFirstsliceRoutes}=require('../../world-r1/components/FirstsliceRoutes.ts'),{FIRSTSLICE}=require('../../world-r1/components/FirstsliceFacts.ts'),{CHARACTER_REFERENCE}=require('../../world-r1/components/CharacterReference.ts');
 for(const provider of ['r4','r5']){
  const c=createFirstsliceRoutes(FIRSTSLICE,CHARACTER_REFERENCE),parent=new d.cc.Node('UIParent'),log=[];let flow;
  const stageId=provider==='r4'?fixture.stageId:'r05-tide-01';
  const levels=createNativeWorldLevelAdapter({uiParent:parent,fixture,select:id=>({provider,stageId:id,seed:provider==='r4'?fixture.seed:1}),navigation:{exit:()=>flow.exitLevel(),resume:()=>flow.snapshot().needsResume?flow.resume():undefined}});
  const character={calibrated:true,coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:c.seat.standingControllerRoot,seatedRoot:c.seat.seatedControllerRoot,seatYawRad:-2,clearanceRadiusM:.18},advance(){},perform:async a=>log.push(a.kind),cancelAndReset(){},setVisible(){},dispose(){}};
  flow=new WorldFlow({config:c,levels,character,loadWorld:async()=>({setLayers(){},setDoor(){},setCamera(){},animateDoor:async(a,b)=>log.push('door:'+b),animateCamera:async()=>{},cancelTransient(){},assertStaticWorld(){},dispose(){}})});
  await flow.load();assert.equal((await flow.leaveHome()).ok,true);assert.equal((await flow.enterLevel(stageId)).ok,true);
  const ui=parent.children[0].components.find(x=>x instanceof loadActualUI());assert.ok(ui);
  const actions=provider==='r4'?fixture.winningActions:witnesses[stageId][0].actions;
  for(const a of actions){const p=ui.host.command('previewAction',a);assert.equal(ui.host.command('commitAction',p.token).ok,true);while(d.tick()){};}
  assert.equal(ui.command('requestExit').ok,true);assert.equal(flow.snapshot().state,'island');assert.equal(parent.children.length,0);
  assert.equal((await flow.returnHome()).ok,true);assert.equal(flow.snapshot().state,'home');assert.ok(log.indexOf('door:0')<log.indexOf('sit'));flow.dispose();
 }
});
test('actual R5 stable-write failure displays native retry UI and blocks exit without losing intent',()=>{
 class FaultMap extends Map{writes=0;failAt=Infinity;set(k,v){if(++this.writes===this.failAt)throw Error('Injected stable-write failure');return super.set(k,v);}}
 const values=new FaultMap(),stores={r4:new Map(),r5:values};let r;
 r=rig({provider:'r5',stageId:'r05-tide-01',seed:1},{stores,onExit:()=>r.session.requestExit()});values.failAt=values.writes+2;
 r.session.submit(witnesses['r05-tide-01'][0].actions[0]);assert.equal(r.session.snapshot().state,'run.unsaved');
 assert.equal(r.ui.resultPanel.active,true);assert.ok(r.ui.resultPanel.getChildByName('重试保存'));assert.equal(r.ui.command('requestExit').ok,false);assert.equal(r.parent.isValid,true);
 values.failAt=Infinity;assert.equal(r.ui.command('retrySave').ok,true);assert.equal(JSON.parse(values.get('forest-regional-r05-active')).pendingAction,null);r.dispose();
});
test('shuffle visual uses its board payload (synthetic schema-bound frame test)',()=>{
 const p=new FramePresenter(),active={board:[{id:1}],region:'tide',regionPieces:[],goals:{pearls:1},moss:[],roots:[],scene:{phase:'ebb',clock:0},tool:{kind:'tideAnchor',charges:1},moves:5,score:0};
 p.present({provider:'regional-r05',state:'run.ready',active,visual:null});
 const frame={provider:'regional-r05',state:'run.resolving',active:{...active,board:[{id:999}]},visual:{kind:'shuffle',board:[{id:7}],token:'synthetic'}};
 assert.deepEqual(p.present(frame).active.board,[{id:1}]);assert.deepEqual(p.present(frame,'after').active.board,[{id:7}]);
});
test('actual native touch handlers commit one drag and reject late touch-end after hide',()=>{
 const r=rig({provider:'r5',stageId:'r05-tide-01',seed:1});const node=r.ui.cells[23],ev=x=>({getLocation:()=>({x,y:0})});
 node.emit('start',ev(0));node.emit('move',ev(24));node.emit('end',ev(24));assert.equal(r.session.controller.session.actions.length,1);r.drain();
 node.emit('start',ev(0));r.session.hide();r.session.show();r.session.resume();node.emit('end',ev(24));node.emit('end',ev(24));assert.equal(r.session.controller.session.actions.length,1);assert.equal(r.ui.selected,-1);r.dispose();
});
