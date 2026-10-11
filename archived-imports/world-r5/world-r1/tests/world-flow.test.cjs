const {CHARACTER_REFERENCE}=require('../components/CharacterReference.ts');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {WorldFlow,Cancelled,pointOnPath}=require('../components/WorldFlowCore.ts');
const {createFirstsliceRoutes}=require('../components/FirstsliceRoutes.ts');
const {FIRSTSLICE}=require('../components/FirstsliceFacts.ts');
const cfg=createFirstsliceRoutes(FIRSTSLICE,CHARACTER_REFERENCE);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
function rig({character=true,calibrated=true,mode='motion',lateLoad=false,lateLevel=false}={}) {
 const log=[],pending=[],worldLoad=deferred(),levelLoad=deferred();
 const stats={worldDisposed:0,levelDisposed:0,charDisposed:0,layers:null,door:0,camera:null,visible:null,reset:null};
 function task(kind,token,finish){return new Promise((resolve,reject)=>{
   const entry={kind,done:()=>{if(entry.complete)return;entry.complete=true;off();finish?.();resolve();}};
   const off=token.onCancel(()=>{entry.complete=true;reject(new Cancelled())});pending.push(entry);
 });}
 const world={setLayers:l=>{stats.layers=l;log.push(['layers',l]);},setDoor:a=>{stats.door=a;log.push(['door',a]);},setCamera:p=>{stats.camera=p;},assertStaticWorld:()=>log.push(['static']),cancelTransient:()=>log.push(['cancel-world']),dispose:()=>{stats.worldDisposed++;},
 animateDoor:(a,b,s,t)=>{log.push(['door-start',a,b]);return task('door',t,()=>{stats.door=b;log.push(['door-done',b])});},
 animateCamera:(p,s,t)=>{log.push(['camera-start',p]);return task('camera',t,()=>{stats.camera=p[p.length-1]});}};
 const char={calibrated,advance:dt=>log.push(['character-tick',dt]),coordinates:{units:'m',up:'+Y',forward:'+Z',rootMotion:'controller-only',standingRoot:cfg.seat.standingControllerRoot,seatedRoot:cfg.seat.seatedControllerRoot,seatYawRad:cfg.seat.yawRad,clearanceRadiusM:.18},perform:(action,t)=>{log.push(['character-start',action]);return task(action.kind,t,()=>log.push(['character-done',action.kind]));},cancelAndReset:p=>{stats.reset=p;log.push(['reset',p]);},setVisible:v=>{stats.visible=v;},dispose:()=>{stats.charDisposed++;}};
 const level={requestExit:()=>({ok:true}),hide:()=>log.push(['level-hide']),showPaused:()=>log.push(['level-show-paused']),resume:()=>{log.push(['level-resume']);return {ok:true}},dispose:()=>{stats.levelDisposed++;}};
 const flow=new WorldFlow({config:cfg,mode,character:character?char:undefined,loadWorld:()=>lateLoad?worldLoad.promise:Promise.resolve(world),levels:{enter:()=>lateLevel?levelLoad.promise:Promise.resolve(level)},onChange:s=>log.push(['state',s.state])});
 async function settle(promise){let finished=false,result;promise.then(v=>{finished=true;result=v;},e=>{throw e});for(let i=0;i<300&&!finished;i++){await flush();for(const p of [...pending])if(!p.complete)p.done();}assert.ok(finished,'operation must settle');return result;}
 async function until(state,promise){for(let i=0;i<300;i++){await flush();if(flow.snapshot().state===state)return;const p=pending.find(x=>!x.complete);assert.ok(p,'pending effect to reach '+state);p.done();}throw Error('state not reached '+state);}
 return {flow,log,pending,stats,world,char,level,worldLoad,levelLoad,settle,until};
}

test('actual asset facts bind all 49 anchors and 24 renderer nodes',()=>{
 assert.equal(Object.keys(FIRSTSLICE.anchors).length,49);assert.equal(FIRSTSLICE.renderers.length,24);
 assert.deepEqual(cfg.seat.position,FIRSTSLICE.anchors.seat_anchor.position);assert.equal(cfg.seat.yawRad,-2);
 assert.notDeepEqual(cfg.seat.position,FIRSTSLICE.anchors.interior_spawn.position);
 assert.deepEqual(cfg.toDoor[0],cfg.seat.standingControllerRoot);assert.deepEqual(cfg.toSeat.at(-1),cfg.seat.standingControllerRoot);
});
test('full home / island / level / island / home flow, with close before sit',async()=>{
 const r=rig();assert.equal((await r.flow.load()).ok,true);assert.equal(r.flow.snapshot().state,'home');
 assert.equal((await r.settle(r.flow.leaveHome())).ok,true);assert.equal(r.flow.snapshot().state,'island');
 assert.equal((await r.flow.enterLevel('tide-c01-001')).ok,true);assert.equal(r.stats.visible,false);assert.ok(Object.values(r.stats.layers).every(x=>!x));
 assert.equal(r.flow.exitLevel().ok,true);assert.equal(r.stats.levelDisposed,1);assert.equal(r.stats.visible,true);
 assert.equal((await r.settle(r.flow.returnHome())).ok,true);assert.equal(r.flow.snapshot().state,'home');
 const closed=r.log.findIndex(x=>x[0]==='door-done'&&x[1]===0);const sit=r.log.findIndex(x=>x[0]==='character-start'&&x[1].kind==='sit');
 assert.ok(closed>0&&sit>closed);assert.deepEqual(r.stats.reset,{kind:'seated',seat:cfg.seat});
 r.flow.dispose();r.flow.dispose();assert.equal(r.stats.worldDisposed,1);assert.equal(r.stats.charDisposed,1);
});
test('missing/unvalidated character blocks movement without inventing a character',async()=>{
 for(const opts of [{character:false},{calibrated:false}]){const r=rig(opts);await r.flow.load();assert.equal((await r.flow.leaveHome()).reason,'character-adapter-not-calibrated');assert.equal(r.flow.snapshot().state,'home');}
});
test('duplicate actions and mode switches while busy are rejected',async()=>{
 const r=rig();await r.flow.load();const p=r.flow.leaveHome();assert.equal((await r.flow.leaveHome()).reason,'busy');assert.equal((await r.flow.enterLevel('x')).reason,'busy');assert.equal(r.flow.setMode('fixed').ok,false);await r.settle(p);
});
test('fixed camera mode does not start animated camera jobs',async()=>{
 const r=rig({mode:'fixed'});await r.flow.load();await r.settle(r.flow.leaveHome());await r.settle(r.flow.returnHome());assert.equal(r.log.filter(x=>x[0]==='camera-start').length,0);assert.deepEqual(r.stats.camera,cfg.cameraHome);
});
for(const state of ['standing','turning-out','walking-out','opening-door','crossing-out'])test('hide/show during '+state+' rolls back home and requires explicit resume',async()=>{
 const r=rig();await r.flow.load();const p=r.flow.leaveHome();await r.until(state,p);r.flow.hide();await flush();assert.equal((await p).reason,'cancelled');assert.equal(r.flow.snapshot().state,'paused');assert.equal(r.stats.door,0);assert.ok(Object.values(r.stats.layers).every(x=>!x));
 r.flow.show();assert.equal(r.flow.snapshot().state,'paused');assert.equal((await r.flow.leaveHome()).reason,'paused');assert.equal(r.flow.resume().ok,true);assert.equal(r.flow.snapshot().state,'home');assert.equal(r.stats.visible,true);await r.settle(r.flow.leaveHome());assert.equal(r.flow.snapshot().state,'island');
});
for(const state of ['walking-home','crossing-in','closing-door','walking-to-seat','sitting'])test('cancel '+state+' returns to island with no sit/door leftovers',async()=>{
 const r=rig();await r.flow.load();await r.settle(r.flow.leaveHome());const p=r.flow.returnHome();await r.until(state,p);assert.equal(r.flow.cancelTransition().ok,true);assert.equal((await p).reason,'cancelled');assert.equal(r.flow.snapshot().state,'island');assert.equal(r.stats.door,cfg.openDeg);assert.deepEqual(r.stats.reset.controllerRoot,cfg.toIsland.at(-1));await r.settle(r.flow.returnHome());assert.equal(r.flow.snapshot().state,'home');
});
test('late world load after destroy is released exactly once',async()=>{
 const r=rig({lateLoad:true});const p=r.flow.load();r.flow.dispose();assert.equal((await p).reason,'cancelled');r.worldLoad.resolve(r.world);await flush();assert.equal(r.stats.worldDisposed,1);assert.equal(r.flow.snapshot().state,'disposed');
});
test('late level load after hide is released; no layer takeover',async()=>{
 const r=rig({lateLevel:true});await r.flow.load();await r.settle(r.flow.leaveHome());const p=r.flow.enterLevel('tide-c01-001');r.flow.hide();r.flow.show();assert.equal(r.flow.resume().ok,true);r.levelLoad.resolve(r.level);assert.equal((await p).reason,'cancelled');await flush();assert.equal(r.stats.levelDisposed,1);assert.equal(r.flow.snapshot().state,'island');assert.equal(r.stats.layers.exterior,true);
});
test('level hide/show stays paused until explicit resume and duplicate show is no-op',async()=>{
 const r=rig();await r.flow.load();await r.settle(r.flow.leaveHome());await r.flow.enterLevel('tide-c01-001');r.flow.hide();r.flow.hide();r.flow.show();r.flow.show();assert.equal(r.log.filter(x=>x[0]==='level-hide').length,1);assert.equal(r.log.filter(x=>x[0]==='level-show-paused').length,1);assert.equal(r.log.filter(x=>x[0]==='level-resume').length,0);r.flow.resume();assert.equal(r.log.filter(x=>x[0]==='level-resume').length,1);r.flow.dispose();assert.equal(r.stats.levelDisposed,1);
});
test('load interruption can be explicitly resumed and retried without stale takeover',async()=>{
 const r=rig({lateLoad:true});const first=r.flow.load();r.flow.hide();r.flow.show();r.flow.resume();assert.equal(r.flow.snapshot().state,'idle');r.worldLoad.resolve(r.world);assert.equal((await first).reason,'cancelled');await flush();assert.equal(r.stats.worldDisposed,1);
});
test('rejecting level entry restores island; errors never create a level lease',async()=>{
 const r=rig({lateLevel:true});await r.flow.load();await r.settle(r.flow.leaveHome());const p=r.flow.enterLevel('bad');r.levelLoad.reject(Error('fixture load failure'));assert.equal((await p).ok,false);assert.equal(r.flow.snapshot().state,'island');assert.equal(r.stats.layers.exterior,true);assert.equal(r.stats.levelDisposed,0);
});
test('pointOnPath preserves endpoints, clamps progress, and uses arc length',()=>{assert.deepEqual(pointOnPath([[0,0,0],[1,0,0],[1,0,3]],.5),[1,0,1]);assert.deepEqual(pointOnPath([[0,0,0],[1,0,0]],2),[1,0,0]);});
test('coordinate mismatch does not replace an existing calibrated adapter',async()=>{
 const r=rig();await r.flow.load();const wrong={...r.char,coordinates:{...r.char.coordinates,standingRoot:cfg.seat.standingFoot}};
 assert.equal(r.flow.bindCharacter(wrong).reason,'character-coordinate-contract-mismatch');assert.equal(r.flow.snapshot().characterReady,true);assert.equal(r.stats.charDisposed,0);
});
test('R4 exit failure keeps level mounted and world hidden for retry',async()=>{
 const r=rig();await r.flow.load();await r.settle(r.flow.leaveHome());await r.flow.enterLevel('x');r.level.requestExit=()=>({ok:false,reason:'storage-error'});
 assert.equal(r.flow.exitLevel().reason,'storage-error');assert.equal(r.flow.snapshot().state,'level');assert.equal(r.stats.levelDisposed,0);assert.equal(r.stats.visible,false);
 r.level.requestExit=()=>({ok:true});assert.equal(r.flow.exitLevel().ok,true);
});
test('effect error cancels its concurrent camera and restores stable home',async()=>{
 const r=rig();await r.flow.load();r.char.perform=(action,t)=>action.kind==='walk'?Promise.reject(Error('animation-failed')):Promise.resolve();
 const result=await r.settle(r.flow.leaveHome());assert.equal(result.ok,false);assert.equal(r.flow.snapshot().state,'home');assert.equal(r.stats.door,0);assert.ok(r.pending.every(p=>p.complete));
});

test('level resume failure stays explicitly paused for retry',async()=>{const r=rig();await r.flow.load();await r.settle(r.flow.leaveHome());await r.flow.enterLevel('x');r.flow.hide();r.flow.show();r.level.resume=()=>({ok:false,reason:'storage-error'});assert.equal(r.flow.resume().ok,false);assert.equal(r.flow.snapshot().needsResume,true);assert.equal(r.flow.snapshot().state,'paused');});

test('shared update clock caps gaps and freezes character when paused',async()=>{const r=rig();await r.flow.load();r.flow.advance(20);assert.equal(r.log.at(-1)[1],.1);r.flow.hide();const n=r.log.length;r.flow.advance(1);assert.equal(r.log.length,n);});
