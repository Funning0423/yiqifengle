// 运镜bot 2026-10-15: skip / quick exit end-state tests. Reuses the archived world-flow rig (same file, appended).
for(const state of ['standing','turning-out','walking-out','opening-door','crossing-out'])test('skip during '+state+' = same end state as watching through',async()=>{
 const full=rig();await full.flow.load();await full.settle(full.flow.leaveHome());const want={state:full.flow.snapshot().state,door:full.stats.door,layers:JSON.stringify(full.stats.layers),camera:JSON.stringify(full.stats.camera),reset:JSON.stringify(full.stats.reset),visible:full.stats.visible};
 const r=rig();await r.flow.load();const ev=[];r.flow.onCameraEvent(e=>ev.push(e.kind));const winds=[];r.flow.onWindStrength(w=>winds.push(w));
 const p=r.flow.leaveHome();await r.until(state,p);assert.equal(r.flow.leavingHome,true);
 assert.equal(r.flow.skipLeave().ok,true);const res=await p;assert.equal(res.ok,true,'leaveHome resolves ok after skip');
 assert.equal(r.flow.leavingHome,false);
 const got={state:r.flow.snapshot().state,door:r.stats.door,layers:JSON.stringify(r.stats.layers),camera:JSON.stringify(r.stats.camera),reset:JSON.stringify(r.stats.reset),visible:r.stats.visible};
 assert.deepEqual(got,want);assert.ok(r.pending.every(x=>x.complete),'no dangling camera/door/walk job');
 assert.equal(winds.length?winds[winds.length-1]:0,0,'wind back to 0');assert.equal(ev[ev.length-1],'settled','settled event fired');
 assert.equal(r.flow.skipLeave().ok,false,'second skip is a no-op');
 assert.equal((await r.settle(r.flow.returnHome())).ok,true,'can go home again after skip');
});
test('quick exit reaches the same end state',async()=>{
 const full=rig();await full.flow.load();await full.settle(full.flow.leaveHome());
 const r=rig();await r.flow.load();const res=await r.settle(r.flow.leaveHome({quick:true}));assert.equal(res.ok,true);
 assert.equal(r.flow.snapshot().state,'island');assert.equal(r.stats.door,full.stats.door);assert.deepEqual(r.stats.camera,full.stats.camera);assert.deepEqual(r.stats.layers,full.stats.layers);assert.deepEqual(r.stats.reset,full.stats.reset);
});
test('skip outside an exit does nothing',async()=>{const r=rig();await r.flow.load();assert.equal(r.flow.skipLeave().ok,false);assert.equal(r.flow.snapshot().state,'home');});
