'use strict';
/* b21/b21b nodewalker-waypoints gate (Grok Bot → GGbot). Waypoint routes walk as ONE continuous walk (no clip / fade / idle).
 * Routes: the island fixture (island-fixture.json — the ONE file to swap: scene SHA whose walkable grid + routeAvoid are read with
 * git show, I3/I4 and via; run in a separate harness, production island data untouched) + skycity pass-through walks (S2 leaves south
 * of the blocked block, avoid discs and the S3 pass-through disc: skycity-avoid.json). Every route is simulated at 60 fps and 30 fps
 * (b21b ruling, grokbot-2 option 2: the uneven-dt clock and YawFollower option A live on ggbot/yawfollower-dt and land together next
 * version with the candidate re-freeze; this branch keeps the shipped CharacterMotion.ts):
 * 1) clip count 0: one segment, cut=false, fades=0; every leg ≤ DIRECT_MAX_M 9.6.
 * 2) heading: her yaw (REAL CharacterMotion.YawFollower — the shipped one, WALK_YAW_LOOKAHEAD_M target) ≤ cap, |heading accel|
 *    p99 ≤ cap (accel = Δrate / mean of the two frame times: per unit time, identical to /dt on a steady clock).
 *    cap = min(CharacterMotion.WALK_YAW_MAX_DEG_S, LensSmooth.yawOursDegS, (reveal linMS − WALK_SPEED_MPS)/|FOLLOW back,side|):
 *    the node-walk lens is ExploreCameraCore.followPose(her, her yaw) — rigid on her yaw, so its yaw rate = hers and its position
 *    swings on the 7.02 m arm. Accel cap = LensSmooth.yawAccDegS2 (= reveal angAccP99DegS2). Read from the sources each run.
 *    The follow lens itself must stay within the reveal-camera-motion LIMITS (read from that test) and ≥ 1.5 m above her.
 *    Per bend: every > SHARP_TURN_RAD bend (plan.sharpAt) over ±SHARP_ZONE_M — heading peak ≤ cap, accel p99 ≤ cap, speed — at both clocks.
 * 3) time: duration = curved length / WALK_SPEED_MPS + turn cost 0 s. Tolerance 1 frame. Walk_loop rate·native = L/D within 1 %.
 *    Speed: |step/dt − L/D| ≤ 0.12 m/s AND |step − L/D·dt| ≤ 2 mm per frame (both, at every clock: neither form is loosened).
 *    Clearance (every ≤ 0.05 m of the walked curve; 场景设计部 routeAvoid rules: island from the fixture SHA's
 *    tools/region-nodes/bake-region-nodes.cjs routeAvoid, skycity stump scene/b20-island-walk-fixes @ a1c4c07d :69; geometry
 *    skin-corrected (clearance.cjs)): off walkable floor = 0; inside a routeAvoid disc = 0; trunk distance ≥ 1.0 m; foliage inside her
 *    head band [BODY_M − 0.30, BODY_M + 0.05] m within the 0.3 m body radius = 0.
 * 4) self-check: old clipping, a raw snap-turn path and a +0.5 s duration each FAIL; an off-floor walk, a walk 0.6 m from a trunk,
 *    a walk through head-height foliage and a raw 120° corner (per-bend gate) each FAIL.
 * 5) default unchanged: golden-dump of every node pair (planWalk/planSkip) + planTapWalk == golden-default.json (fc3123fa);
 *    WAYPOINT_ROUTES empty.
 * 6) GUARD (hard): WAYPOINT_ROUTES is empty AND no production script (creator-build-project/assets/scripts, NodeWalker.ts itself aside)
 *    reaches a waypoint route: no WAYPOINT_ROUTES / waypointPolyline / planChained reference, no NodeWalker planWalk call with a 4th
 *    (route) argument. Only tests/tools may walk the routes. Self-check: injected sources/route tables must FAIL.
 *    This guard is removed ONLY in the same change that brings back YawFollower A + the uneven-dt gate (ggbot/yawfollower-dt). */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),W=H.load('region/NodeWalker.ts'),N=H.load('region/RegionNodes.ts').REGION_NODES,CM=H.load('CharacterMotion.ts'),LS=H.load('region/LensSmooth.ts').LENS_SMOOTH,
 E=H.load('region/ExploreCameraCore.ts'),RW=H.load('region/RegionWalkable.ts');
const R=180/Math.PI,dt=1/60,v=W.WALK_SPEED_MPS;
// ── caps from their sources
const revealSrc=fs.readFileSync(path.join(__dirname,'../journey-integration/test-reveal-camera-motion.cjs'),'utf8');
const LIMITS=Function('return '+revealSrc.match(/const LIMITS=Object\.freeze\((\{[^}]*\})\)/)[1].replace(/\/\*.*?\*\//g,''))();
const ARM=Math.hypot(E.FOLLOW.backM,E.FOLLOW.sideM),armCap=(LIMITS.linMS-v)/ARM*R;
const CAP=Math.min(CM.WALK_YAW_MAX_DEG_S,LS.yawOursDegS,LIMITS.yawDegS,armCap),ACC=Math.min(LS.yawAccDegS2,LIMITS.angAccP99DegS2);
assert(Math.abs(W.WAYPOINT_HEADING_CAP_DEG_S-CAP)<0.01,`NodeWalker heading cap ${W.WAYPOINT_HEADING_CAP_DEG_S} ≠ derived ${CAP.toFixed(2)}`);
assert.equal(W.WAYPOINT_HEADING_ACC_CAP_DEG_S2,ACC,'accel cap drifted');
const wrap=a=>((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,p99=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(.99*s.length))]:0;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2]),pitchOf=p=>{const d=p.target.map((x,i)=>x-p.position[i]);return Math.asin(d[1]/Math.hypot(...d));};
/** Frame clocks: 60 fps and 30 fps (the uneven-dt clock is on ggbot/yawfollower-dt with YawFollower A). */
const CLOCKS={'60fps':()=>()=>1/60,'30fps':()=>()=>1/30};
/** Speed: per-unit-time |step/dt − L/D| ≤ SPEED_TOL_MS (0.12 m/s = 2 mm per 1/60 s frame) AND per-frame |step − L/D·dt| ≤ 2 mm (the
 *  b21 rule, kept: at 30 fps it is the tighter of the two — 0.06 m/s — so neither form is loosened at any rate). */
const SPEED_TOL_MS=0.12,SPEED_TOL_FRAME_M=0.002;
/** Simulate one plan on a frame clock (default 60 fps); returns failures (strings) and measurements. trace: per-frame [s, yaw rate, |accel|, speed err m/s]. */
function check(plan,label,poly,region,clock='60fps',trace=null){const bad=[],m={label,clock},next=CLOCKS[clock]();let hMax=0;
 // 1) clip count
 const clips=plan.segments.length-1+(plan.cut?1:0)+plan.fades;m.clips=clips;if(clips)bad.push(`clip count ${clips} (segments ${plan.segments.length}, cut ${plan.cut}, fades ${plan.fades})`);
 if(plan.legs)for(const l of plan.legs)if(l>W.DIRECT_MAX_M+1e-9)bad.push(`leg ${l.toFixed(2)} m > ${W.DIRECT_MAX_M}`);
 // 2) heading + follow lens, every segment back to back (an injected old plan is checked the same way)
 const yf=new CM.YawFollower();let wPrev=null,cwPrev=null,prevCam=null,her=[],acc=[],cacc=[],maxW=0,maxCW=0,maxCP=0,maxLin=0,maxStep=0,minUp=1e9,maxFov=0,frames=0,slide=0,slideMS=0,hPrev=1/60;
 for(const seg of plan.segments){const P=seg.path,L=W.pathLength(P),D=seg.duration;let first=true;
  const a0=W.pointAlong(P,Math.min(L,CM.WALK_YAW_LOOKAHEAD_M));yf.reset(Math.atan2(a0[0]-P[0][0],a0[2]-P[0][2]));let prevPos=P[0];
  for(let t=0,dt=1/60;t<=D+1e-9;dt=next(),t+=dt){if(!first)hMax=Math.max(hMax,dt);const s=L*Math.min(1,t/D),q=W.pointAlong(P,s),ah=W.pointAlong(P,Math.min(L,s+CM.WALK_YAW_LOOKAHEAD_M));
   const tgt=s+CM.WALK_YAW_LOOKAHEAD_M<=L+1e-9&&Math.hypot(ah[0]-q[0],ah[2]-q[2])>1e-4?Math.atan2(ah[0]-q[0],ah[2]-q[2]):yf.yaw;
   const prevYaw=yf.yaw,yaw=first?yf.yaw:yf.step(tgt,dt),w=Math.abs(wrap(yaw-prevYaw))/dt*R;
   if(!first){maxW=Math.max(maxW,w);const a=wPrev!==null?Math.abs(w-wPrev)/((dt+hPrev)/2):0;if(wPrev!==null)acc.push(a);wPrev=w;
    const step=Math.hypot(q[0]-prevPos[0],q[2]-prevPos[2],q[1]-prevPos[1]);slide=Math.max(slide,Math.abs(step-L/D*dt));slideMS=Math.max(slideMS,Math.abs(step/dt-L/D));
    if(trace)trace.push([s,w,a,Math.abs(step/dt-L/D),Math.abs(step-L/D*dt)]);}
   prevPos=q;
   const cam=E.followPose(q,yaw,390,844,0);minUp=Math.min(minUp,cam.position[1]-q[1]);
   if(prevCam){const dm=Math.hypot(...cam.position.map((x,k)=>x-prevCam.position[k])),cw=Math.abs(wrap(yawOf(cam)-yawOf(prevCam)))/dt*R,cp=Math.abs(pitchOf(cam)-pitchOf(prevCam))/dt*R;
    maxStep=Math.max(maxStep,dm);maxLin=Math.max(maxLin,dm/dt);maxCW=Math.max(maxCW,cw);maxCP=Math.max(maxCP,cp);const W2=Math.max(cw,cp);if(cwPrev!==null)cacc.push(Math.abs(W2-cwPrev)/((dt+hPrev)/2));cwPrev=W2;
    maxFov=Math.max(maxFov,Math.abs((cam.fovVerticalDeg??48)-(prevCam.fovVerticalDeg??48)));}
   prevCam=cam;if(!first)hPrev=dt;first=false;frames+=dt;}}
 Object.assign(m,{headingMaxDegS:+maxW.toFixed(2),headingAccP99:+p99(acc).toFixed(1),camYawMax:+maxCW.toFixed(2),camPitchMax:+maxCP.toFixed(2),camAccP99:+p99(cacc).toFixed(1),camMaxMS:+maxLin.toFixed(3),camStepM:+maxStep.toFixed(4),camMinUpM:+minUp.toFixed(2),fovStep:maxFov});
 if(maxW>CAP)bad.push(`heading ${maxW.toFixed(1)}°/s > cap ${CAP.toFixed(2)}`);if(p99(acc)>ACC)bad.push(`heading accel p99 ${p99(acc).toFixed(0)} > ${ACC}`);
 if(maxCW>LIMITS.yawDegS||maxCP>LIMITS.pitchDegS)bad.push(`lens yaw/pitch ${maxCW.toFixed(1)}/${maxCP.toFixed(1)}°/s`);if(p99(cacc)>LIMITS.angAccP99DegS2)bad.push(`lens accel p99 ${p99(cacc).toFixed(0)}`);
 if(maxLin>LIMITS.linMS)bad.push(`lens ${maxLin.toFixed(2)} m/s > ${LIMITS.linMS}`);if(maxStep>LIMITS.stepM)bad.push(`lens step ${maxStep.toFixed(3)} m`);if(maxFov>LIMITS.fovStepDeg)bad.push('lens fov step');if(minUp<LIMITS.minHeightM)bad.push(`lens height ${minUp.toFixed(2)} m`);
 // foot slide: constant speed (per-frame displacement = L/D·dt within 2 mm) and walk_loop rate·native = L/D (CharacterMotion.planWalk)
 m.slideMm=+(slide*1000).toFixed(2);m.speedErrMS=+slideMS.toFixed(4);if(slideMS>SPEED_TOL_MS)bad.push(`speed not constant: ${m.speedErrMS} m/s off`);if(slide>SPEED_TOL_FRAME_M)bad.push(`speed not constant: ${m.slideMm} mm/frame off`);
 for(const seg of plan.segments){const L=W.pathLength(seg.path),D=seg.duration,cp=CM.planWalk({L,D,start:null,stops:[],walkCycle:1,native:CM.DEFAULT_NATIVE_SPEED,phase0:null,v0:null});
  // walk_loop phase advances Δs/native (WorldIntegrationBoot) × plan.rate: no slide ⇔ linear cruise at warp 1 and L/D = WALK_SPEED_MPS
  if(!cp.linear||cp.rate!==1||Math.abs(L/D-v)/v>0.01)bad.push(`anim warp ${cp.rate} linear ${cp.linear}, root ${(L/D).toFixed(4)} m/s vs ${v}`);}
 // 3) time
 const T=plan.segments.reduce((a,s)=>a+s.duration,0),Lc=plan.segments.reduce((a,s)=>a+W.pathLength(s.path),0);m.timeS=+T.toFixed(3);m.lengthM=+Lc.toFixed(3);
 if(poly){m.polylineM=+W.pathLength(poly).toFixed(3);m.cutM=+(W.pathLength(poly)-Lc).toFixed(3);
  // turn cost: 0 s by design (no slow-down on a curve); expected = curved length / v. Tolerance 1 frame.
  if(Math.abs(T-Lc/v)>dt)bad.push(`time ${T.toFixed(3)} s vs length/v ${(Lc/v).toFixed(3)} s + turn cost 0 (tol 1 frame)`);}
 if(Math.abs(frames-T)>2*Math.max(dt,hMax))bad.push(`simulated ${frames.toFixed(3)} s vs plan ${T.toFixed(3)} s`);
 return {bad,m};}
/** Per-bend gate: every > SHARP_TURN_RAD bend (plan.sharpAt, the short look-ahead zones) — over its ±SHARP_ZONE_M window, at every
 *  clock: heading peak ≤ CAP, heading accel p99 ≤ ACC, speed within SPEED_TOL_MS and SPEED_TOL_FRAME_M. */
function bendCheck(plan,tag,poly){const rows=[],bad=[],P=plan.segments[0].path,LP=W.pathLength(P);
 const bendS=(plan.sharpAt||[]).map(b=>{let best=1e9,sb=0;for(let s=0;s<=LP;s+=0.02){const q=W.pointAlong(P,s),d=Math.hypot(q[0]-b[0],q[2]-b[2]);if(d<best){best=d;sb=s;}}return {at:b,s:sb};});
 if(bendS.length)for(const ck of Object.keys(CLOCKS)){const tr=[];check(plan,tag,poly,null,ck,tr);
  for(const [bi,b] of bendS.entries()){const w=tr.filter(f=>Math.abs(f[0]-b.s)<=W.SHARP_ZONE_M);if(!w.length)continue;
   const row={route:tag,bend:bi+1,at:b.at.map(x=>+x.toFixed(2)),clock:ck,headingMaxDegS:+Math.max(...w.map(f=>f[1])).toFixed(2),headingAccP99:+p99(w.slice(1).map(f=>f[2])).toFixed(1),speedErrMS:+Math.max(...w.map(f=>f[3])).toFixed(4),slideMm:+(1000*Math.max(...w.map(f=>f[4]))).toFixed(2)};
   rows.push(row);if(row.headingMaxDegS>CAP||row.headingAccP99>ACC||row.speedErrMS>SPEED_TOL_MS||row.slideMm>SPEED_TOL_FRAME_M*1000)bad.push(`${ck} bend ${bi+1}: ${JSON.stringify(row)}`);}}
 return {rows,bad};}
const CL=require('./clearance.cjs'),HEAD=[E.BODY_M-0.30,E.BODY_M+0.05],BODY_R=0.3,TRUNK_M=1.0;
function hashPts(pts,c=0.5){const m=new Map();for(const q of pts){const k=Math.floor(q[0]/c)+','+Math.floor(q[2]/c);(m.get(k)||m.set(k,[]).get(k)).push(q);}return {m,c};}
function near(h,x,z,r){const out=[],c=h.c;for(let i=Math.floor((x-r)/c);i<=Math.floor((x+r)/c);i++)for(let j=Math.floor((z-r)/c);j<=Math.floor((z+r)/c);j++){const L=h.m.get(i+','+j);if(L)for(const q of L)out.push(q);}return out;}
/** Clearance of every ≤ 0.05 m sample of the walked curve (all segments). */
function clear(plan,region,C,src=null){const R=C.regions[region],walk=src?src.isWalkable:(x,z)=>RW.isWalkable(region,x,z),AV=src?src.routeAvoid:R.routeAvoid,bad=[],m={};let off=0,disc=0,trunk=Infinity,trunkBy='',fol=0,folMin=Infinity,folBy='',n=0;
 const TR=R.trunks.flatMap(t=>t.xz.map(q=>[q[0],q[1],t.name])),FH=R._fh||(R._fh=hashPts(R.foliage.flatMap(f=>f.pts.map(q=>[q[0],q[1],q[2],f.name]))));
 for(const seg of plan.segments){const P=seg.path,L=W.pathLength(P),k=Math.max(1,Math.ceil(L/0.05));
  for(let i=0;i<=k;i++){const q=W.pointAlong(P,L*i/k);n++;
   if(!walk(q[0],q[2]))off++;
   for(const [ax,az,ar] of AV)if(Math.hypot(q[0]-ax,q[2]-az)<=ar)disc++;
   for(const t of TR){const d=Math.hypot(q[0]-t[0],q[2]-t[1]);if(d<trunk){trunk=d;trunkBy=t[2];}}
   for(const f of near(FH,q[0],q[2],1.0)){const dy=f[1]-q[1];if(dy<HEAD[0]||dy>HEAD[1])continue;const d=Math.hypot(f[0]-q[0],f[2]-q[2]);if(d<folMin){folMin=d;folBy=f[3];}if(d<=BODY_R)fol++;}}}
 Object.assign(m,{samples:n,offFloor:off,inRouteAvoid:disc,minTrunkM:isFinite(trunk)?+trunk.toFixed(3):null,trunk:trunkBy||null,headFoliageHits:fol,minHeadFoliageM:isFinite(folMin)?+folMin.toFixed(3):'>1',foliage:folBy||null});
 if(off)bad.push(off+' samples off the walkable floor');if(disc)bad.push(disc+' samples inside a routeAvoid disc');if(trunk<TRUNK_M)bad.push(`trunk ${trunk.toFixed(3)} m < ${TRUNK_M} (${trunkBy})`);
 if(fol)bad.push(fol+' head-height foliage hits ('+folBy+')');return {bad,m};}
(async()=>{const C=await CL.clearance();
const rows=[],checks=[];
// ── routes: island fixture + skycity pass-through walks
// island fixture: ONE data file (island-fixture.json) names the scene branch SHA; its walkable grid and routeAvoid are read from that
// commit with git show, its I3/I4 replace the production nodes in a SEPARATE harness (production island data stays untouched).
const FX=JSON.parse(fs.readFileSync(path.join(__dirname,'island-fixture.json'),'utf8')),gitShow=p=>require('child_process').execFileSync('git',['show',FX.sourceSha+':'+p],{cwd:__dirname,encoding:'utf8',maxBuffer:64<<20});
const tsMod=src=>{const o=H.ts.transpileModule(src,{compilerOptions:{module:H.ts.ModuleKind.CommonJS,target:H.ts.ScriptTarget.ES2019}}).outputText,mod={exports:{}};new Function('exports','require','module',o)(mod.exports,require,mod);return mod.exports;};
const SRC_NODES=tsMod(gitShow(FX.nodesFile)).REGION_NODES.island.nodes,atOf=k=>SRC_NODES.find(n=>n.key===k).at;
const NODES_FX=JSON.parse(JSON.stringify(N));for(const n of NODES_FX.island.nodes)if(n.key===FX.from||n.key===FX.to)n.at=atOf(n.key);
const VIA_SRC=JSON.parse(gitShow(FX.viaFile)).via;FX.via=FX.viaReplaceLast?VIA_SRC.slice(0,-1).concat(FX.viaReplaceLast):VIA_SRC;
const HF=createHarness({overrides:{'region/RegionWalkableData':tsMod(gitShow(FX.walkableFile)),'region/RegionNodes':{...H.load('region/RegionNodes.ts'),REGION_NODES:NODES_FX}}});
const WF=HF.load('region/NodeWalker.ts'),RWF=HF.load('region/RegionWalkable.ts');
const FX_AVOID=JSON.parse(gitShow(FX.routeAvoidFile).match(/routeAvoid:(\[\[[^\n]*?\]\]),/)[1]);
const FX_SRC={isWalkable:(x,z)=>RWF.isWalkable('island',x,z),routeAvoid:FX_AVOID};
const SKY=JSON.parse(fs.readFileSync(path.join(__dirname,'skycity-avoid.json'),'utf8'));
const routes=[{region:'island',from:FX.from,to:FX.to,route:{via:FX.via},W:WF,src:FX_SRC,tag:`island ${FX.from}→${FX.to} fixture option ${FX.option.split(' ')[0]} @ ${FX.sourceSha.slice(0,8)} (${FX.via.length} waypoints${FX.viaReplaceLast?', last replaced':''})`}];
for(const a of ['S0','S1','S2','S3']){const keys=W.routeKeys('skycity',a,'S6').keys;routes.push({region:'skycity',from:a,to:'S6',route:{via:keys.slice(1,-1)},tag:`skycity ${keys.join('>')} (pass-through ${keys.slice(1,-1).join(',')})`});}
for(const [a,b] of [['S3','S4'],['S4','S6'],['S1','S4']]){const keys=W.routeKeys('skycity',a,b).keys;routes.push({region:'skycity',from:a,to:b,route:{via:keys.slice(1,-1).length?keys.slice(1,-1):[b==='S4'?'S4':b].slice(0,0).concat([])},tag:`skycity ${keys.join('>')}`});}
const bendRows=[];
for(const r of routes){if(!r.route.via.length)r.route={via:[r.to]};/* a lone node key = the direct edge (still chained) */
 if(r.region==='skycity'){const via=r.route.via.slice(),i=via.indexOf('S2');if(i>=0)via.splice(i+1,0,...SKY.s2South);else if(r.from==='S2')via.unshift(...SKY.s2South);
  r.route={via,avoid:SKY.avoid.concat(via.includes('S3')?SKY.passS3Avoid:[])};}
 const RWk=r.W||W,poly=RWk.waypointPolyline(r.region,r.from,r.to,r.route).poly,plan=RWk.planWalk(r.region,r.from,r.to,r.route),k=clear(plan,r.region,C,r.src||null),P=plan.segments[0].path,LP=W.pathLength(P);
 const bad=k.bad.slice(),m0={};
 for(const ck of Object.keys(CLOCKS)){const c=check(plan,r.tag,poly,r.region,ck);bad.push(...c.bad.map(x=>ck+': '+x));
  if(ck==='60fps')Object.assign(m0,c.m);else m0[ck]={headingMaxDegS:c.m.headingMaxDegS,headingAccP99:c.m.headingAccP99,speedErrMS:c.m.speedErrMS,slideMm:c.m.slideMm,camMaxMS:c.m.camMaxMS,camAccP99:c.m.camAccP99};}
 const bb=bendCheck(plan,r.tag,poly);bendRows.push(...bb.rows);bad.push(...bb.bad);
 Object.assign(m0,k.m);assert.deepEqual(bad,[],r.tag+': '+bad.join('; '));rows.push(m0);
 // 4) self-check: injected old behaviour must fail
 const old=RWk.planWalk(r.region,r.from,r.to,null),oc=check(old,"old",null,null);if(W.pathLength(poly)>W.DIRECT_MAX_M)assert(oc.bad.some(x=>/clip count/.test(x)),r.tag+': old clip not caught');
 const snap={segments:[{path:poly,duration:W.pathLength(poly)/v}],cut:false,fades:0,lengthM:W.pathLength(poly)},sc=check(snap,'snap',null,null);
 assert(sc.bad.some(x=>/heading|lens/.test(x)),r.tag+': raw snap-turn path not caught '+JSON.stringify(sc.m));
 const slow={...plan,segments:[{path:plan.segments[0].path,duration:plan.segments[0].duration+0.5}]},tc=check(slow,'slow',poly,null);
 assert(tc.bad.some(x=>/time|anim/.test(x)),r.tag+': +0.5 s not caught');}
checks.push(`${routes.length} waypoint routes: clip count 0, legs ≤ ${W.DIRECT_MAX_M} m, heading ≤ ${CAP.toFixed(2)}°/s & accel p99 ≤ ${ACC}°/s², follow lens within reveal LIMITS, constant speed, time ±1 frame`);
checks.push('self-check: old clipped plan, raw snap-turn path and +0.5 s duration each FAIL the gate');
// 6) clearance self-check: a walk off the floor, past a trunk at < 1 m, and through head-height foliage must each FAIL
const line=(a,b)=>({segments:[{path:[a,b],duration:Math.hypot(b[0]-a[0],b[2]-a[2])/v}],cut:false,fades:0}),T0=C.regions.island.trunks[0],tc0=T0.xz.reduce((a,q)=>[a[0]+q[0]/T0.xz.length,a[1]+q[1]/T0.xz.length],[0,0]);
const SELF=[['off floor (skycity across the blocked cells x −6.25…−5, z 18.5…19.5)','skycity',[-7,-0.06,19],[-4,-0.06,19],/off the walkable floor/],
 [`trunk < 1 m (island ${T0.name}, 0.6 m abeam)`,'island',[tc0[0]-2,RW.walkFloorY('island',tc0[0]-2,tc0[1]+0.6),tc0[1]+0.6],[tc0[0]+2,RW.walkFloorY('island',tc0[0]+2,tc0[1]+0.6),tc0[1]+0.6],/trunk .* < 1/],
 ['head-height foliage (skycity baked S2–S3 edge under bush A)','skycity',[-6.6,-0.051,20.2],[-4.2,-0.036,20.2],/foliage hits/]];
const selfRows=[];for(const [name,reg,a,b,re] of SELF){const k=clear(line(a,b),reg,C);assert(k.bad.some(x=>re.test(x)),'clearance self-check not caught: '+name+' '+JSON.stringify(k));selfRows.push({fixture:name,fails:k.bad});}
// 7) per-bend self-check: a 120° corner walked raw (no pursuit) must FAIL the per-bend gate
{const V=[[0,0,0],[0,0,4],[4*Math.sin(2*Math.PI/3),0,4+4*Math.cos(2*Math.PI/3)]],pl={segments:[{path:V,duration:W.pathLength(V)/v}],cut:false,fades:0,sharpAt:[V[1]]},bb=bendCheck(pl,'self-check raw 120° corner',V);
 assert(bb.bad.length>0,'per-bend self-check not caught '+JSON.stringify(bb.rows));selfRows.push({fixture:'raw 120° corner (per-bend gate)',fails:bb.bad.map(x=>x.slice(0,160))});}
checks.push('clearance self-check: off-floor, trunk < 1 m and head-height foliage fixtures each FAIL; per-bend self-check: raw 120° corner FAILS');
checks.push('per-bend gate: every > 100° bend window, heading peak ≤ cap and accel p99 ≤ cap at 60 fps and 30 fps');
// 5) default unchanged
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'golden-default.json'),'utf8')),now=require('./golden-dump.cjs').dump();
assert.deepEqual(now,golden,'default NodeWalker plans differ from the fc3123fa golden');assert.equal(Object.keys(W.WAYPOINT_ROUTES).length,0,'production WAYPOINT_ROUTES must stay empty until a route is approved');
checks.push(`default unchanged: ${Object.keys(golden).length} golden entries (all node pairs planWalk+planSkip, planTapWalk samples) identical to fc3123fa`);
// 6) GUARD: no live path walks a waypoint route (removed only together with YawFollower A + the uneven-dt gate)
function splitArgs(src,i){let d=0,a=1,q=null;for(let k=i;k<src.length;k++){const c=src[k];if(q){if(c==='\\')k++;else if(c===q)q=null;continue;}
  if(c==='"'||c==="'"||c==='`'){q=c;continue;}if('([{'.includes(c))d++;else if(')]}'.includes(c)){if(d===0)return src.slice(i,k).trim()?a:0;d--;}else if(c===','&&d===0)a++;}return a;}
function liveRouteUses(files,routes){const bad=[];if(Object.keys(routes).length)bad.push('WAYPOINT_ROUTES not empty: '+Object.keys(routes).join(','));
 for(const [f,src0] of files){const src=src0.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  for(const id of ['WAYPOINT_ROUTES','waypointPolyline','planChained'])if(new RegExp('\\b'+id+'\\b').test(src))bad.push(f+': references '+id);
  if(/from\s+['"][^'"]*NodeWalker['"]/.test(src)){const re=/(?<![.\w])planWalk\s*\(/g;let m;while((m=re.exec(src)))if(splitArgs(src,m.index+m[0].length)>3)bad.push(f+': planWalk with a route argument');}}
 return bad;}
const SCRIPTS=path.join(__dirname,'../../creator-build-project/assets/scripts'),walkTs=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkTs(path.join(d,e.name)):/\.ts$/.test(e.name)?[path.join(d,e.name)]:[]);
const LIVE=walkTs(SCRIPTS).filter(f=>path.basename(f)!=='NodeWalker.ts').map(f=>[path.relative(SCRIPTS,f),fs.readFileSync(f,'utf8')]);
assert(LIVE.length>50,'guard: production scripts not found ('+LIVE.length+')');
const gBad=liveRouteUses(LIVE,W.WAYPOINT_ROUTES);assert.deepEqual(gBad,[],'GUARD: a live path reaches a NodeWalker waypoint route: '+gBad.join('; '));
{const imp="import {planWalk} from './NodeWalker';\n",inj=[['route arg',imp+"const p=planWalk('island','I3','I4',{via:[[1,0,2]]});"],['table ref',"import {WAYPOINT_ROUTES} from './NodeWalker';\nconst r=WAYPOINT_ROUTES;"],
  ['polyline',"import {waypointPolyline} from './NodeWalker';\nwaypointPolyline('island','I3','I4',{via:[]});"]];
 for(const [n,src] of inj)assert(liveRouteUses([['inj.ts',src]],{}).length>0,'guard self-check not caught: '+n);
 assert(liveRouteUses([['ok.ts',imp+"const p=planWalk('island','I3','I4');this.planWalk(a,b,c,d);"]],{}).length===0,'guard self-check: 3-arg planWalk wrongly flagged');
 assert(liveRouteUses([],{'island:I3>I4':{via:['I4']}}).length>0,'guard self-check not caught: non-empty WAYPOINT_ROUTES');
 selfRows.push({fixture:'guard: route arg / WAYPOINT_ROUTES ref / waypointPolyline ref / non-empty table',fails:'all caught; 3-arg planWalk passes'});}
checks.push(`GUARD: WAYPOINT_ROUTES empty and none of ${LIVE.length} production scripts reaches a waypoint route (self-check: 4 injections FAIL, 3-arg call passes); removed only with YawFollower A + uneven-dt gate`);
console.log('CAPS '+JSON.stringify({headingDegS:+CAP.toFixed(2),from:{characterYawMax:CM.WALK_YAW_MAX_DEG_S,lensYaw:LS.yawOursDegS,armLimit:+armCap.toFixed(2),armM:+ARM.toFixed(3),linMS:LIMITS.linMS},accDegS2:ACC}));
for(const r of rows)console.log('ROUTE '+JSON.stringify(r));for(const b of bendRows)console.log('BEND '+JSON.stringify(b));for(const x of selfRows)console.log('SELF '+JSON.stringify(x));
for(const c of checks)console.log('PASS '+c);console.log(JSON.stringify({status:'PASS',checks},null,1));
})().catch(e=>{console.error(e);process.exit(1);});
