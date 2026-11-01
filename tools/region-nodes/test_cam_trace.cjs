'use strict';
/* ?camTrace=1 (CamTrace.ts): off = no frames, no writer strings, no window helper; on = per-frame rows carry the applyCameraPose source + sub-path. */
const assert=require('node:assert/strict');
const {CT,H,S,rig,inputFor,Gate}=require('./explore-stage-harness.cjs');
const CP=H.load(S('world-r1/CameraPose.ts'));
const cam={node:{setWorldPosition(){},setWorldRotation(){}},fov:45};
function run(region){Gate.setExploreEnabled(true);const R=rig(region,'S1',null,{});R.st.writePose=p=>{CP.applyCameraPose(cam,CP.fromLookAt(p,45),'region.node-lens');return p;};
 const I=inputFor(region,R.st);I.start(150,400);for(let k=1;k<=6;k++){I.move(150+k*10,400);R.st.tickLens(1/30);CT.camTraceFrame({region});}I.end(210,400);for(let k=0;k<5;k++){R.st.tickLens(1/30);CT.camTraceFrame({region});}}
// OFF (default: no location in the box / wx)
assert.equal(CT.camTrace.on,false,'default off');const w0=CT.camTrace.writers;
run('meadow');
assert.equal(CT.camTrace.frames.length,0,'off: no frames');assert.equal(CT.camTrace.writers,w0,'off: writer list untouched');assert.equal(w0.length,0,'off: no writer strings');
assert.equal(globalThis.__qfCamTrace,undefined,'off: no console helper');assert.ok(CP.cameraWriteLog.writes>0,'camera still written '+JSON.stringify({w:CP.cameraWriteLog.writes,r:CP.cameraWriteLog.rejected}));
assert.equal(CT.camTraceInit('?qfSkip=lakeside'),false);
// ON
assert.equal(CT.camTraceInit('?a=1&camTrace=1'),true);run('meadow');run('island');
const f=CT.camTrace.frames;assert.ok(f.length>=20,'on: frames '+f.length);
const ids=new Set(f.flatMap(r=>r.w));assert.ok([...ids].some(i=>i.startsWith('region.node-lens:orbit')),'orbit writer id: '+[...ids]);
const j=JSON.parse(globalThis.__qfCamTrace.dump());assert.equal(j.kind,'qf-camtrace');assert.equal(j.trace.length,f.length);
CT.camTrace.max=8;for(let i=0;i<20;i++)CT.camTraceFrame({i});assert.equal(CT.camTraceOrdered().slice(-1)[0].i,19,'ring keeps newest');
CT.camTraceInit('');assert.equal(CT.camTrace.on,false);
console.log('cam-trace OK: writer ids',[...ids].join(','));
