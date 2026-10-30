'use strict';
/* b21 nodewalker-waypoints gate (Grok Bot → GGbot). Waypoint routes walk as ONE continuous walk (no clip / fade / idle).
 * 1) clip count 0: one segment, cut=false, fades=0; every leg ≤ DIRECT_MAX_M 9.6.
 * 2) heading: her yaw (REAL CharacterMotion.YawFollower, WALK_YAW_LOOKAHEAD_M target, 60 fps) ≤ cap, |heading accel| p99 ≤ cap.
 *    cap = min(CharacterMotion.WALK_YAW_MAX_DEG_S, LensSmooth.yawOursDegS, (reveal linMS − WALK_SPEED_MPS)/|FOLLOW back,side|):
 *    the node-walk lens is ExploreCameraCore.followPose(her, her yaw) — rigid on her yaw, so its yaw rate = hers and its position
 *    swings on the 7.02 m arm. Accel cap = LensSmooth.yawAccDegS2 (= reveal angAccP99DegS2). Read from the sources each run.
 *    The follow lens itself must stay within the reveal-camera-motion LIMITS (read from that test) and ≥ 1.5 m above her.
 * 3) time: duration = curved length / WALK_SPEED_MPS + turn cost 0 s (she never slows on a curve). Tolerance 1 frame (1/60 s) for
 *    the plan and 2 frames for the 60 fps simulated arrival. Walk_loop rate·native = L/D within 1 %.
 *    Floor: the curve may not cross more blocked RegionWalkable 0.1 m cells (2 cm sampling) than the waypoint polyline it smooths.
 * 4) self-check: old clipping (planWalk without route), a raw snap-turn path and a +0.5 s duration must each FAIL.
 * 5) default unchanged: golden-dump of every node pair (planWalk/planSkip) + planTapWalk == golden-default.json (fc3123fa). */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),W=H.load('region/NodeWalker.ts'),N=H.load('region/RegionNodes.ts').REGION_NODES,CM=H.load('CharacterMotion.ts'),LS=H.load('region/LensSmooth.ts').LENS_SMOOTH,
 E=H.load('region/ExploreCameraCore.ts'),RW=H.load('region/RegionWalkable.ts');
const R=180/Math.PI,FPS=60,dt=1/FPS,v=W.WALK_SPEED_MPS;
// ── caps from their sources
const revealSrc=fs.readFileSync(path.join(__dirname,'../journey-integration/test-reveal-camera-motion.cjs'),'utf8');
const LIMITS=Function('return '+revealSrc.match(/const LIMITS=Object\.freeze\((\{[^}]*\})\)/)[1].replace(/\/\*.*?\*\//g,''))();
const ARM=Math.hypot(E.FOLLOW.backM,E.FOLLOW.sideM),armCap=(LIMITS.linMS-v)/ARM*R;
const CAP=Math.min(CM.WALK_YAW_MAX_DEG_S,LS.yawOursDegS,LIMITS.yawDegS,armCap),ACC=Math.min(LS.yawAccDegS2,LIMITS.angAccP99DegS2);
assert(Math.abs(W.WAYPOINT_HEADING_CAP_DEG_S-CAP)<0.01,`NodeWalker heading cap ${W.WAYPOINT_HEADING_CAP_DEG_S} ≠ derived ${CAP.toFixed(2)}`);
assert.equal(W.WAYPOINT_HEADING_ACC_CAP_DEG_S2,ACC,'accel cap drifted');
const wrap=a=>((a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,p99=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(.99*s.length))]:0;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2]),pitchOf=p=>{const d=p.target.map((x,i)=>x-p.position[i]);return Math.asin(d[1]/Math.hypot(...d));};
/** Simulate one plan at 60 fps; returns failures (strings) and measurements. */
function check(plan,label,poly,region){const bad=[],m={label};
 // 1) clip count
 const clips=plan.segments.length-1+(plan.cut?1:0)+plan.fades;m.clips=clips;if(clips)bad.push(`clip count ${clips} (segments ${plan.segments.length}, cut ${plan.cut}, fades ${plan.fades})`);
 if(plan.legs)for(const l of plan.legs)if(l>W.DIRECT_MAX_M+1e-9)bad.push(`leg ${l.toFixed(2)} m > ${W.DIRECT_MAX_M}`);
 // 2) heading + follow lens, every segment back to back (an injected old plan is checked the same way)
 const yf=new CM.YawFollower();let wPrev=null,cwPrev=null,prevCam=null,her=[],acc=[],cacc=[],maxW=0,maxCW=0,maxCP=0,maxLin=0,maxStep=0,minUp=1e9,maxFov=0,frames=0,slide=0;
 for(const seg of plan.segments){const P=seg.path,L=W.pathLength(P),D=seg.duration;let first=true;
  const a0=W.pointAlong(P,Math.min(L,CM.WALK_YAW_LOOKAHEAD_M));yf.reset(Math.atan2(a0[0]-P[0][0],a0[2]-P[0][2]));let prevPos=P[0];
  for(let t=0;t<=D+1e-9;t+=dt){const s=L*Math.min(1,t/D),q=W.pointAlong(P,s),ah=W.pointAlong(P,Math.min(L,s+CM.WALK_YAW_LOOKAHEAD_M));
   const tgt=s+CM.WALK_YAW_LOOKAHEAD_M<=L+1e-9&&Math.hypot(ah[0]-q[0],ah[2]-q[2])>1e-4?Math.atan2(ah[0]-q[0],ah[2]-q[2]):yf.yaw;
   const prevYaw=yf.yaw,yaw=first?yf.yaw:yf.step(tgt,dt),w=Math.abs(wrap(yaw-prevYaw))/dt*R;
   if(!first){maxW=Math.max(maxW,w);if(wPrev!==null)acc.push(Math.abs(w-wPrev)/dt);wPrev=w;
    const step=Math.hypot(q[0]-prevPos[0],q[2]-prevPos[2],q[1]-prevPos[1]);slide=Math.max(slide,Math.abs(step-L/D*dt));}
   prevPos=q;
   const cam=E.followPose(q,yaw,390,844,0);minUp=Math.min(minUp,cam.position[1]-q[1]);
   if(prevCam){const dm=Math.hypot(...cam.position.map((x,k)=>x-prevCam.position[k])),cw=Math.abs(wrap(yawOf(cam)-yawOf(prevCam)))/dt*R,cp=Math.abs(pitchOf(cam)-pitchOf(prevCam))/dt*R;
    maxStep=Math.max(maxStep,dm);maxLin=Math.max(maxLin,dm/dt);maxCW=Math.max(maxCW,cw);maxCP=Math.max(maxCP,cp);const W2=Math.max(cw,cp);if(cwPrev!==null)cacc.push(Math.abs(W2-cwPrev)/dt);cwPrev=W2;
    maxFov=Math.max(maxFov,Math.abs((cam.fovVerticalDeg??48)-(prevCam.fovVerticalDeg??48)));}
   prevCam=cam;first=false;frames++;}}
 Object.assign(m,{headingMaxDegS:+maxW.toFixed(2),headingAccP99:+p99(acc).toFixed(1),camYawMax:+maxCW.toFixed(2),camPitchMax:+maxCP.toFixed(2),camAccP99:+p99(cacc).toFixed(1),camMaxMS:+maxLin.toFixed(3),camStepM:+maxStep.toFixed(4),camMinUpM:+minUp.toFixed(2),fovStep:maxFov});
 if(maxW>CAP)bad.push(`heading ${maxW.toFixed(1)}°/s > cap ${CAP.toFixed(2)}`);if(p99(acc)>ACC)bad.push(`heading accel p99 ${p99(acc).toFixed(0)} > ${ACC}`);
 if(maxCW>LIMITS.yawDegS||maxCP>LIMITS.pitchDegS)bad.push(`lens yaw/pitch ${maxCW.toFixed(1)}/${maxCP.toFixed(1)}°/s`);if(p99(cacc)>LIMITS.angAccP99DegS2)bad.push(`lens accel p99 ${p99(cacc).toFixed(0)}`);
 if(maxLin>LIMITS.linMS)bad.push(`lens ${maxLin.toFixed(2)} m/s > ${LIMITS.linMS}`);if(maxStep>LIMITS.stepM)bad.push(`lens step ${maxStep.toFixed(3)} m`);if(maxFov>LIMITS.fovStepDeg)bad.push('lens fov step');if(minUp<LIMITS.minHeightM)bad.push(`lens height ${minUp.toFixed(2)} m`);
 // foot slide: constant speed (per-frame displacement = L/D·dt within 2 mm) and walk_loop rate·native = L/D (CharacterMotion.planWalk)
 m.slideMm=+(slide*1000).toFixed(2);if(slide>0.002)bad.push(`speed not constant: ${m.slideMm} mm/frame off`);
 for(const seg of plan.segments){const L=W.pathLength(seg.path),D=seg.duration,cp=CM.planWalk({L,D,start:null,stops:[],walkCycle:1,native:CM.DEFAULT_NATIVE_SPEED,phase0:null,v0:null});
  // walk_loop phase advances Δs/native (WorldIntegrationBoot) × plan.rate: no slide ⇔ linear cruise at warp 1 and L/D = WALK_SPEED_MPS
  if(!cp.linear||cp.rate!==1||Math.abs(L/D-v)/v>0.01)bad.push(`anim warp ${cp.rate} linear ${cp.linear}, root ${(L/D).toFixed(4)} m/s vs ${v}`);}
 // 3) time
 const T=plan.segments.reduce((a,s)=>a+s.duration,0),Lc=plan.segments.reduce((a,s)=>a+W.pathLength(s.path),0);m.timeS=+T.toFixed(3);m.lengthM=+Lc.toFixed(3);
 if(poly){m.polylineM=+W.pathLength(poly).toFixed(3);m.cutM=+(W.pathLength(poly)-Lc).toFixed(3);
  // turn cost: 0 s by design (no slow-down on a curve); expected = curved length / v. Tolerance 1 frame.
  if(Math.abs(T-Lc/v)>dt)bad.push(`time ${T.toFixed(3)} s vs length/v ${(Lc/v).toFixed(3)} s + turn cost 0 (tol 1 frame)`);}
 if(Math.abs(frames*dt-T)>2*dt)bad.push(`simulated ${(frames*dt).toFixed(3)} s vs plan ${T.toFixed(3)} s`);
 // walkable + deviation (informative / must stay on floor)
 if(region&&poly){const offOf=P=>{const L=W.pathLength(P),k=new Set();for(let s=0;s<=L;s+=0.02){const q=W.pointAlong(P,s);if(!RW.isWalkable(region,q[0],q[2]))k.add(Math.round(q[0]*10)+","+Math.round(q[2]*10));}return k.size;};
  const off=plan.segments.reduce((a,s)=>a+offOf(s.path),0),base=offOf(poly);let dev=0;for(const s of plan.segments)for(const q of s.path)dev=Math.max(dev,W.distanceToPolyline(poly,q));
  m.offFloor=off;m.polyOffFloor=base;m.maxDevM=+dev.toFixed(3);if(off>base)bad.push(`${off} blocked 0.1 m floor cells on the curve > ${base} on the waypoint polyline`);}
 return {bad,m};}
const rows=[],checks=[];
// ── routes: island fixture + skycity pass-through walks
const FX=JSON.parse(fs.readFileSync(path.join(__dirname,'island-i3-i4-waypoints.json'),'utf8'));
const routes=[{region:'island',from:FX.from,to:FX.to,route:{via:FX.via},tag:'island I3→I4 fixture (3 waypoints)'}];
for(const a of ['S0','S1','S2','S3']){const keys=W.routeKeys('skycity',a,'S6').keys;routes.push({region:'skycity',from:a,to:'S6',route:{via:keys.slice(1,-1)},tag:`skycity ${keys.join('>')} (pass-through ${keys.slice(1,-1).join(',')})`});}
for(const [a,b] of [['S3','S4'],['S4','S6'],['S1','S4']]){const keys=W.routeKeys('skycity',a,b).keys;routes.push({region:'skycity',from:a,to:b,route:{via:keys.slice(1,-1).length?keys.slice(1,-1):[b==='S4'?'S4':b].slice(0,0).concat([])},tag:`skycity ${keys.join('>')}`});}
for(const r of routes){if(!r.route.via.length)r.route={via:[r.to]};/* a lone node key = the direct edge (still chained) */
 const poly=W.waypointPolyline(r.region,r.from,r.to,r.route).poly,plan=W.planWalk(r.region,r.from,r.to,r.route),c=check(plan,r.tag,poly,r.region);
 assert.deepEqual(c.bad,[],r.tag+': '+c.bad.join('; '));rows.push(c.m);
 // 4) self-check: injected old behaviour must fail
 const old=W.planWalk(r.region,r.from,r.to,null),oc=check(old,'old',null,null);if(W.pathLength(poly)>W.DIRECT_MAX_M)assert(oc.bad.some(x=>/clip count/.test(x)),r.tag+': old clip not caught');
 const snap={segments:[{path:poly,duration:W.pathLength(poly)/v}],cut:false,fades:0,lengthM:W.pathLength(poly)},sc=check(snap,'snap',null,null);
 assert(sc.bad.some(x=>/heading|lens/.test(x)),r.tag+': raw snap-turn path not caught '+JSON.stringify(sc.m));
 const slow={...plan,segments:[{path:plan.segments[0].path,duration:plan.segments[0].duration+0.5}]},tc=check(slow,'slow',poly,null);
 assert(tc.bad.some(x=>/time|anim/.test(x)),r.tag+': +0.5 s not caught');}
checks.push(`${routes.length} waypoint routes: clip count 0, legs ≤ ${W.DIRECT_MAX_M} m, heading ≤ ${CAP.toFixed(2)}°/s & accel p99 ≤ ${ACC}°/s², follow lens within reveal LIMITS, constant speed, time ±1 frame`);
checks.push('self-check: old clipped plan, raw snap-turn path and +0.5 s duration each FAIL the gate');
// 5) default unchanged
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'golden-default.json'),'utf8')),now=require('./golden-dump.cjs').dump();
assert.deepEqual(now,golden,'default NodeWalker plans differ from the fc3123fa golden');assert.equal(Object.keys(W.WAYPOINT_ROUTES).length,0,'production WAYPOINT_ROUTES must stay empty until a route is approved');
checks.push(`default unchanged: ${Object.keys(golden).length} golden entries (all node pairs planWalk+planSkip, planTapWalk samples) identical to fc3123fa`);
console.log('CAPS '+JSON.stringify({headingDegS:+CAP.toFixed(2),from:{characterYawMax:CM.WALK_YAW_MAX_DEG_S,lensYaw:LS.yawOursDegS,armLimit:+armCap.toFixed(2),armM:+ARM.toFixed(3),linMS:LIMITS.linMS},accDegS2:ACC}));
for(const r of rows)console.log('ROUTE '+JSON.stringify(r));
for(const c of checks)console.log('PASS '+c);console.log(JSON.stringify({status:'PASS',checks},null,1));
