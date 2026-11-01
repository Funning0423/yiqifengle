#!/usr/bin/env node
'use strict';
/** r5 S1 stern wake: length, speed fade, no flicker, no white block, night tint, DC-neutral wiring. QF_TS_TARGET=ES5 runs the core as ES5. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sim=require('./sail_wake_sim.cjs');
const {core,leg}=sim,W=core.SAIL_WAKE;
const out={};
// 1. Length at cruise: the authored wake_strips card was 9.03 m long; the trail must read clearly longer.
const {tl}=sim.journey();
const sd=tl.beats.find(b=>b.id==='S-d'),se=tl.beats.find(b=>b.id==='S-e'),sf=tl.beats.find(b=>b.id==='S-f');
let cruiseMin=1e9,cruiseMax=0;
sim.simulate({until:sd.t1,onFrame:(t,v,tr)=>{if(t>=sd.t0+3&&t<=sd.t1){const m=core.wakeVisibleM(tr);cruiseMin=Math.min(cruiseMin,m);cruiseMax=Math.max(cruiseMax,m);}}});
out.cruiseVisibleM=[+cruiseMin.toFixed(2),+cruiseMax.toFixed(2)];
// b11: K2 (last 10 % of S-c, ~3 m sailed) shows a V back toward the pier like the sail-art render (launch ghost).
{const sc=tl.beats.find(b=>b.id==='S-c');let k2=1e9;sim.simulate({until:sc.t1,onFrame:(t,v,tr)=>{if(t>=sc.t0+0.9*(sc.t1-sc.t0))k2=Math.min(k2,core.wakeVisibleWithGhostM(tr));}});
 out.k2VisibleM=+k2.toFixed(2);assert(k2>=12,'K2 wake length '+k2);}
assert(cruiseMin>=12,'cruise wake visible length (3 s into S-d it is still limited by the distance sailed) '+cruiseMin);
assert(cruiseMax>=18,'settled cruise wake length '+cruiseMax);
// 2. Speed fade: emission follows v.speed; after the stop it dissolves within ageS.
assert.equal(core.wakeEmission(0),0);assert.equal(core.wakeEmission(W.speedHi+1),1);
assert(core.wakeEmission(1.0)<0.25,'slow boat leaves a faint wake');
const stopT=se.t1;let peakAtStop=0,peakLate=1,peakDock=0,headDock=1;
sim.simulate({until:stopT+W.ageS+0.5,onFrame:(t,v,tr)=>{
 const g=sim.geometry(tr);
 if(Math.abs(t-stopT)<1/120)peakAtStop=g.peak;
 if(t>se.t1-0.4&&t<se.t1){peakDock=Math.max(peakDock,g.peak);headDock=Math.min(headDock,tr.pts[0].k);}
 if(t>=stopT+W.ageS)peakLate=Math.min(peakLate,g.peak);
}});
out.peakAtStop=+peakAtStop.toFixed(3);out.peakLate=peakLate;out.headEmissionDocking=+headDock.toFixed(3);
assert(headDock<0.3,'new foam at the berth is faint, k '+headDock);
assert.equal(peakLate,0,'wake gone '+W.ageS+' s after the stop');
// 3. No flicker: a laid point (past the transom fade-in) keeps its alpha smooth frame to frame (60 Hz), per ribbon.
let maxStep=0,maxUJump=0;const prev=new Map();
sim.simulate({until:sf.t1+2,onFrame:(t,v,tr)=>{
 const g=sim.geometry(tr),N=W.maxPoints,n=tr.pts.length;const cur=new Map();
 for(let r=0;r<core.WAKE_RIBBONS;r++)for(let i=1;i<n;i++){
  if(tr.pts[0].s-tr.pts[i].s<W.inM)continue; // the transom fade-in is a spatial ramp the point slides along, not a flicker
  const key=r+':'+tr.pts[i].s.toFixed(4),a=g.b.colors[((r*N+i)*2)*4+3],u=g.b.uvs[((r*N+i)*2)*2];
  cur.set(key,[a,u]);const p=prev.get(key);
  if(p){maxStep=Math.max(maxStep,Math.abs(a-p[0]));maxUJump=Math.max(maxUJump,Math.abs(u-p[1]));}
 }
 prev.clear();cur.forEach((val,key)=>prev.set(key,val));
}});
out.maxAlphaStep60Hz=+maxStep.toFixed(4);out.maxUvDrift=maxUJump;
assert(maxStep<=0.03,'alpha step per frame '+maxStep);
assert.equal(maxUJump,0,'foam UV is anchored to the water');
// 4. No white block: capped alpha, wash and arms do not overlap behind the transom, tail closes at zero.
let peakAll=0,overlap=0,tailOpen=0;
sim.simulate({until:sf.t1,onFrame:(t,v,tr)=>{
 const g=sim.geometry(tr),N=W.maxPoints,n=tr.pts.length,C=g.b.colors,P=g.b.positions;
 peakAll=Math.max(peakAll,g.peak);
 const gEnd=Math.min(N-1,n-1+core.wakeGhost(tr).n);for(let r=0;r<3;r++){const last=(r*N+gEnd)*2; /* b11: the launch ghost extends the closed end */if(n>1&&(C[last*4+3]>0||C[(last+1)*4+3]>0))tailOpen++;}
 for(let i=0;i<n;i++){
  const d=tr.pts[0].s-tr.pts[i].s;if(d<W.inM)continue;
  const washOuter=W.washHalf0+d*W.washGrow,armInner=Math.min(W.armMaxOff,W.armOff0+d*Math.tan(W.armDeg*Math.PI/180))-(W.armHalf0+d*W.armGrow);
  if(armInner<washOuter-0.05&&d<W.washM)overlap++;
 }
}});
out.peakAlpha=+peakAll.toFixed(3);out.overlapRows=overlap;
assert(peakAll<=0.72,'peak alpha '+peakAll);assert.equal(tailOpen,0,'tail closes');
assert.equal(overlap,0,'wash and arm overlap');
// 5. Night: same day/night weight as the sail grade (0.5 s ease), dimmer blue-grey foam, never brighter than day.
const trN=core.createWakeTrail();for(let i=0;i<120;i++)core.stepWakeTrail(trN,0,i*0.06,0,1,3.3,1/60,true);
const gN=core.createWakeBuffers();const pkN=core.buildWakeGeometry(trN,-0.86,gN);
const trD=core.createWakeTrail();for(let i=0;i<120;i++)core.stepWakeTrail(trD,0,i*0.06,0,1,3.3,1/60,false);
const gD=core.createWakeBuffers();const pkD=core.buildWakeGeometry(trD,-0.86,gD);
assert.equal(trN.night,1);assert(pkN<pkD,'night alpha below day');
assert(gN.colors[0]<gD.colors[0]&&gN.colors[2]>gN.colors[0],'night foam is blue-grey');
const trE=core.createWakeTrail();core.stepWakeTrail(trE,0,0,0,1,3,0,false);
for(let i=1;i<=15;i++)core.stepWakeTrail(trE,0,i*0.05,0,1,3,1/60,true);
assert(trE.night>0.45&&trE.night<0.55,'0.5 s ease, got '+trE.night);
out.night={peakDay:+pkD.toFixed(3),peakNight:+pkN.toFixed(3),rgbNight:[gN.colors[0],gN.colors[1],gN.colors[2]].map(x=>+(x*255).toFixed(0))};
// 6. Teleport guard and buffer sizes.
const trT=core.createWakeTrail();for(let i=0;i<60;i++)core.stepWakeTrail(trT,0,i*0.06,0,1,3.3,1/60,false);
core.stepWakeTrail(trT,50,50,0,1,3.3,1/60,false);assert.equal(trT.pts.length,2,'jump resets');
assert(core.wakeVertexCount()<=65535&&core.wakeVertexCount()===264,'verts '+core.wakeVertexCount());
// 7. Wiring: one wake renderer swapped for one (draw calls unchanged), loose-ES5 safe source, no new assets.
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts/region');
const art=fs.readFileSync(path.join(S,'SailArt.ts'),'utf8'),src=fs.readFileSync(path.join(S,'SailWakeCore.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert(/mountWakeTrail\(root,foamTex\)/.test(art)&&/wake\.active=false/.test(art),'wake_strips replaced by wake_trail');
assert.equal((art.match(/addComponent\(MeshRenderer\)/g)||[]).length,3,'SailArt adds exactly sole + stars + wake_trail renderers');
assert(/syncWakeTrail\(wakeFx,wakeAnchor,boat,v\.speed,dt,night\)/.test(art),'trail follows v.speed and the sail night flag');
for(const [rx,what] of [[/\bfor\s*\([^)]*\bof\b/,'for-of'],[/\.\.\./,'spread'],[/new\s+(Map|Set)\b/,'Map/Set'],[/Math\.random/,'random'],[/from\s+'cc'/,'cc import']])assert(!rx.test(src),'SailWakeCore '+what);
const DIR=path.resolve(__dirname,'../../creator-build-project/assets/bundles/transport_sail');
let bytes=0;const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(!f.endsWith('.meta'))bytes+=st.size;}};walk(DIR);
out.transportSailSourceBytes=bytes;assert(bytes<=1024*1024,'transport_sail source bytes '+bytes);
console.log(JSON.stringify({status:'PASS',target:process.env.QF_TS_TARGET||'ES2020',...out}));
