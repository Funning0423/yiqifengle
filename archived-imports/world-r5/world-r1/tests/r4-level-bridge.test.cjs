const {test}=require('node:test'),assert=require('node:assert/strict');
const {createR4LevelAdapter}=require('../components/R4LevelBridge.ts');
const {Cancellation}=require('../components/WorldFlowCore.ts');
const base=process.env.WORLD_BASELINE_ASSETS||'/workspace/shared/grok-takeover/mac-recovery/reconstructed/COCOS-FIRSTSLICE-COMPAT/creator-build-project/assets/';
const Controller=require(base+'scripts/r4-cloud-compat/runtime/challenge-controller.js');
const Port=require(base+'scripts/r4-cloud-compat/adapter/cocos-port.js');
const fixture=require(base+'resources/firstslice/r4-smoke-fixture.json');
function rig(){const memory=new Map(),phases=[];let visible=false,destroyed=0,failWrites=false;
 const controller=new Controller({platform:Port.createSynchronousStorage({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failWrites)throw Error('injected memory-store failure');memory.set(k,v)}}),journey:{readOnly:false,records:Array.from({length:12},()=>({bestStars:3}))}});
 const host=Port.bindChallengeController(controller,{render:()=>{},animate:(v,s,done)=>phases.push(done),cancelAnimations:()=>{phases.length=0}});
 const adapter=createR4LevelAdapter(async()=>({host,snapshot:()=>controller.snapshot(),openStage:id=>host.command('startStage',id,{seed:fixture.seed,attemptId:'world-r1-memory-only'}),setVisible:v=>visible=v,destroyView:()=>destroyed++}));
 return{adapter,controller,host,memory,phases,setFailWrites:value=>failWrites=value,get visible(){return visible},get destroyed(){return destroyed}};}
test('actual unchanged R4 CJS host enters/hides/shows/explicitly resumes/exits through new bridge',async()=>{
 const r=rig(),lease=await r.adapter.enter(fixture.stageId,new Cancellation());assert.equal(r.controller.snapshot().state,'run.ready');assert.equal(r.visible,true);
 const p=r.host.command('previewAction',fixture.action);r.host.command('commitAction',p.token);assert.equal(r.controller.snapshot().state,'run.resolving');
 const late=r.phases[0];lease.hide();assert.equal(r.controller.snapshot().state,'run.paused');lease.showPaused();assert.equal(r.controller.snapshot().state,'run.paused');assert.equal(lease.resume().ok,true);late();late();assert.equal(r.controller.snapshot().state,'run.ready');
 assert.equal(lease.requestExit().ok,true);lease.dispose();lease.dispose();assert.equal(r.destroyed,1);assert.deepEqual([...r.memory.keys()],['forest-challenges-c01-active']);
});
test('actual R4 saved-result lifecycle does not falsely call resume on terminal result',async()=>{
 const r=rig(),lease=await r.adapter.enter(fixture.stageId,new Cancellation());
 for(const action of fixture.winningActions){const p=r.host.command('previewAction',action);assert.equal(p.ok,true);assert.equal(r.host.command('commitAction',p.token).ok,true);let budget=100;while(r.controller.snapshot().state==='run.resolving'){assert.ok(budget--);r.phases.shift()();}}
 assert.equal(r.controller.snapshot().state,'result.saved');lease.hide();lease.showPaused();assert.equal(lease.resume().ok,true);assert.equal(r.controller.snapshot().state,'result.saved');assert.equal(lease.requestExit().ok,true);lease.dispose();
});
test('cancelled board factory destroys late view without opening a stage',async()=>{
 const r=rig(),token=new Cancellation();token.cancel();await assert.rejects(()=>r.adapter.enter(fixture.stageId,token),/cancelled/);assert.equal(r.destroyed,1);assert.equal(r.controller.snapshot().active,null);
});

test('actual R4 terminal save failure remains mounted and returns save-failed',async()=>{
 const r=rig(),lease=await r.adapter.enter(fixture.stageId,new Cancellation());
 for(const action of fixture.winningActions){const p=r.host.command('previewAction',action);r.host.command('commitAction',p.token);while(r.controller.snapshot().state==='run.resolving')r.phases.shift()();}
 r.setFailWrites(true);const result=lease.requestExit();assert.equal(result.ok,false);assert.equal(result.reason,'save-failed');assert.equal(r.destroyed,0);assert.equal(r.visible,true);
 r.setFailWrites(false);assert.equal(r.host.command('retrySave').ok,true);lease.dispose();assert.equal(r.destroyed,1);
});
