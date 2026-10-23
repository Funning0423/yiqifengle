'use strict';
// Node-only contract against the committed balloon mesh and placed lake triangles; no renderer or port.
const assert=require('node:assert/strict');
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load('region/LakesideBalloon.ts'),LC=H.load('region/LakesideCameraLayout.ts'),BL=H.load('ui/BoardLayout.ts'),C=H.load('world-r1/RegionJourneyCore.ts');
const candidate=process.argv.find(a=>a.startsWith('--candidate='));
if(candidate)B.LAKESIDE_BALLOON_LANDING.mooringLocal=candidate.split('=')[1].split(',').map(Number);
const FL=require('../journey-integration/journey-framing-lib.cjs'),{nearest}=require('../lakeside-landing-cam/audit-geo.cjs');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs'),lake=require('../journey-integration/lakeside/lakeside-scene.cjs');
const mesh=load('creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb').filter(n=>n.tris?.length&&!/flame/.test(n.name));
const L=LC.lakesideJourney([2,.58,63.2]),bank=L.arrival.at(-1),M=B.lakesideBalloonMooring(bank,L.toWorld);
const point=B.LAKESIDE_BALLOON_LANDING.mooringLocal;
// b15: the moored basket carries its door yaw (world 96.19°, Cocos rotY: x' = x cos + z sin, z' = −x sin + z cos)
const YAW=M.doorYawDeg*Math.PI/180,yawed=p=>[p[0]*Math.cos(YAW)+p[2]*Math.sin(YAW),p[1],-p[0]*Math.sin(YAW)+p[2]*Math.cos(YAW)];
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
function visibleTriangles(pose,aspect){
 const {fw,r,up,th}=FL.basis(pose);let count=0;
 for(const o of mesh)for(let k=0;k<o.tris.length;k+=9){const clip=[];
  for(let j=0;j<9;j+=3){const q=yawed([o.tris[k+j],o.tris[k+j+1],o.tris[k+j+2]]),v=sub(q.map((x,i)=>x+point[i]),pose.position),z=dot(v,fw),x=dot(v,r),y=dot(v,up);
   clip.push([z-.01,x+z*th*aspect,-x+z*th*aspect,y+z*th,-y+z*th]);}
  // Conservative triangle/frustum rejection: no triangle can cross the frame if every triangle has a separating plane.
  if(![0,1,2,3,4].some(i=>clip.every(v=>v[i]<0)))count++;
 }return count;
}
assert.deepEqual(M.mooring,L.toWorld([...point]));
assert(Math.abs(M.walk.at(-1)[0]-bank[0])<1e-9&&Math.abs(M.walk.at(-1)[2]-bank[2])<1e-9&&M.walk.at(-1)[1]===bank[1],'v4 stop is the journey arrival node');
// b15 floor fix: P0 stands on the 3 cm floor board (mooring y 0.602). groundY stays the board-relative lawn 0.572.
// b18: from the step on, path y is the terrain profile (about 0.565–0.576), not a hard 0.572.
assert(Math.abs(M.start[1]-.602)<1e-9&&Math.abs(M.groundY-.572)<1e-9,'P0 on the board, groundY is the board-relative lawn');
assert(M.walk.slice(1).every(p=>p[1]<M.start[1]-1e-4),'the exit route is below the board');
// b15 getout v2: door yaw / P0 / planner walk / door clock / foot lock
const K=B.LAKESIDE_BALLOON_LANDING;
assert.deepEqual([...K.mooringLocal],[9.5,.602,25.6],'b15 mooring (floor-fix: lawn 0.572 + 3 cm board)');
assert(Math.abs(M.doorYawDeg-96.19)<.01,'basket door yaw 96.19 deg at the b15 mooring, got '+M.doorYawDeg);
assert.deepEqual(M.walk[0],M.start,'exit walk starts at P0');
const off=sub(M.start,M.mooring),yr=M.doorYawDeg*Math.PI/180;
assert(Math.abs(off[0]*Math.sin(yr)+off[2]*Math.cos(yr)-.395)<1e-9&&Math.abs(off[0]*Math.cos(yr)-off[2]*Math.sin(yr)-.03)<1e-9,'P0 = mooring + rotY(doorYaw)(0.03,0,0.395)');
assert(Math.abs(M.startYawRad*180/Math.PI-95.97)<.02,'faces the first walk point (95.97 deg), got '+M.startYawRad*180/Math.PI);
const lp=L.toLocal?L.toLocal(M.start):null;if(lp)assert(Math.abs(lp[0]-9.1105)<1e-3&&Math.abs(lp[2]-25.6724)<1e-3,'P0 lake-local (9.1105, 25.6724)');
assert(Math.abs(M.length-6.356)<.01,'path v4 from P0 is 6.356 m, got '+M.length);
assert(Math.abs(M.seatYawDeg(30)-(30-M.doorYawDeg))<1e-12,'seat yaw compensated for the basket yaw');
assert.equal(M.mps,.8,'exit walk 0.8 m/s');
assert.equal(B.exitWalkSpeed(.7),.8);assert(Math.abs(B.exitWalkSpeed(.5)-.65)<1e-12&&Math.abs(B.exitWalkSpeed(1.2)-.9)<1e-12,'speed picked inside the planner band of the calibrated clip speed');
const ratio=M.mps/.7;assert(ratio>=.75&&ratio<=1.3,'walk_start and walk_stop kept by planWalk');
assert(M.cornerM>=1-1e-12,'corner radius >= 1.0 m, got '+M.cornerM);
const cruise=(M.length-K.exitStart.M-K.exitStop.M)/(M.walkS-K.exitStart.S/Math.min(K.exitStart.rateMax,ratio)-K.exitStop.S);
assert(Math.abs(cruise-.8)<1e-9,'planned cruise 0.8 m/s');
assert.equal(M.T0,.5);assert(Math.abs(M.doorAt-.833)<1e-12);assert(Math.abs(M.walkStartAt-2.3)<1e-12);
assert.equal(M.doorDeg(M.doorAt),0);assert(Math.abs(M.doorDeg(M.T0+.367)-2.75)<1e-6);assert.equal(M.doorDeg(M.T0+.367+.8),100);assert.equal(M.doorDeg(99),100);
for(let t=0;t<3;t+=.01)assert(M.doorDeg(t+.01)>=M.doorDeg(t)-1e-12,'door opens monotonically');
const CM=B;
let o=[0,0];for(let i=0;i<60;i++){const y0=i*Math.PI/120,y1=(i+1)*Math.PI/120,before=[o[0]+CM.FOOT_LOCK_HALF_W*Math.cos(y0),o[1]-CM.FOOT_LOCK_HALF_W*Math.sin(y0)];o=CM.footLockStep(o,'L',y0,y1,1/60);const after=[o[0]+CM.FOOT_LOCK_HALF_W*Math.cos(y1),o[1]-CM.FOOT_LOCK_HALF_W*Math.sin(y1)];
 if(Math.hypot(o[0],o[1])<CM.FOOT_LOCK_MAX_M-1e-9)assert(Math.hypot(after[0]-before[0],after[1]-before[1])<1e-12,'planted sole stays put while she turns');}
const held=Math.hypot(o[0],o[1]);assert(held>1e-4,'the turn left an offset to recover');
for(let i=0;i<120;i++)o=CM.footLockStep(o,'L',1,1,1/60);assert(Math.abs(Math.hypot(o[0],o[1])-held)<1e-12,'stance (steady yaw) does not relax');
assert.equal(CM.footLockSwing(1,null),false);assert.equal(CM.footLockSwing(1,.9),false);assert.equal(CM.footLockSwing(1,.87),true);
for(let i=0;i<900;i++)o=CM.footLockStep(o,'L',1,1,1/60,true);assert(Math.hypot(o[0],o[1])<1e-6,'swing recovers the offset onto the path');
const peak=M.mps;
const errors=[];
for(const [w,h] of [[390,844],[390,520],[844,390]]){
 const frame=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),pose=LC.lakesideAlignedLookAt(frame),n=visibleTriangles(pose,w/h);
 if(n)errors.push(`${w}x${h}: ${n} mesh triangles intersect the conservative frustum`);
 const landing=LC.lakesideScreenLanding(L,frame),e=C.arrivalPose(L.arrival,L.focus,landing);
 const ride=B.lakesideBalloonRide(B.LAKESIDE_BALLOON_LANDING.walkLocal.map(L.toWorld),L.toWorld(B.LAKESIDE_BALLOON_LANDING.launchLocal),M.mooring,{position:e.position,target:e.target,fovVerticalDeg:landing.arrivalFovDeg});
 assert.deepEqual(ride.vehicle(ride.T+60),M.mooring,'balloon stays moored after touchdown');
 assert.deepEqual(ride.camera(ride.T,null),ride.camera(ride.T+M.timing.durationS,null),'camera holds steady during shore walk');
 const final=C.arrivalPose([...ride.path,...M.walk],L.focus,landing);
 for(const key of ['position','target'])assert(Math.hypot(...final[key].map((x,i)=>x-e[key][i]))<1e-8,'controller final lens agrees with the held arrival lens');
 if(w===390&&h===844){const {fw,r}=FL.basis(pose),a=35*Math.PI/180,d=fw.map((x,i)=>x*Math.cos(a)+r[i]*Math.sin(a)),turned={...pose,target:pose.position.map((x,i)=>x+d[i]*10)};
  assert(visibleTriangles(turned,w/h)>0,'free look right 35 degrees reveals the physical balloon');}
}
// Same 56-point clearance definition used by the option-A tether proposal; includes shore foam.
const bvh=FL.buildBvh(lake.instances().map(i=>({tag:'lake',name:i.name,tris:i.tris})));let clearance=8,closest;
for(const dy of [.5,1.5,3,5,6.7,8.5,10])for(let i=0;i<8;i++){const a=i/8*2*Math.PI,r=dy<3?1:2.9,w=yawed([Math.cos(a)*r,0,Math.sin(a)*r]),n=nearest(bvh,[point[0]+w[0],point[1]+dy,point[2]+w[2]]);
 if(n.d<clearance){clearance=n.d;closest=n.who;}}
if(clearance<.49)errors.push(`clearance ${clearance.toFixed(6)} m < 0.49 m (${closest})`);
console.log(JSON.stringify({point,basketYawDeg:M.doorYawDeg,clearance,closest,walkSeconds:M.timing.durationS,peakWalkMps:peak,errors}));
assert.deepEqual(errors,[],'option A acceptance');
// sd3 step-down (角色动画bot 3c5025af, getout_v3/INTEGRATE.md last section): walk[1] = step point on the lawn, 0.36 m along the exit heading
{const S=B.LAKESIDE_STEPDOWN,w1=M.walk[1],d=Math.hypot(w1[0]-M.start[0],w1[2]-M.start[2]);
 assert(Math.abs(w1[1]-M.groundAt(S.stepM))<1e-9&&d<=.36+1e-9&&d>.35,'step point '+JSON.stringify(w1)+' d '+d);
 assert(Math.abs(Math.atan2(w1[0]-M.start[0],w1[2]-M.start[2])-M.startYawRad)<1e-9,'start yaw toward the step point');
 assert(S.t.length===53&&Math.abs(S.durationS-1.7333)<1e-9&&Math.abs(S.loopTime-.453)<1e-9&&Math.abs(S.forwardEnd-1.1566)<1e-9,'stepdown meta');
 const end=B.stepdownRootAt(S.durationS),at6=B.stepdownRootAt(.6);assert(Math.abs(end[0]-1.1566)<1e-6&&Math.abs(end[1]+.03)<1e-6&&Math.abs(at6[1]+.03)<5e-3,'stepdown root table');
 const r=B.walkFrom(M.walk,S.forwardEnd),lr=r.reduce((a,p,i)=>i?a+Math.hypot(p[0]-r[i-1][0],p[1]-r[i-1][1],p[2]-r[i-1][2]):0,0);
 assert(Math.abs(lr-(M.length-S.forwardEnd))<2e-3&&Math.abs(r[0][1]-M.groundAt(S.forwardEnd))<2e-3,'rest walk from 1.1566 m on the profile '+lr);}
{const k0=B.standupRootK(0,1.266667),k1=B.standupRootK(1.266667,1.266667),kh=B.standupRootK(.633333,1.266667);assert(k0===0&&Math.abs(k1-1)<1e-9&&kh>0&&kh<1,'stand-up root fraction 0..1');
 const U=B.LAKESIDE_STANDUP;assert(U.t.length===39&&Math.abs(U.forwardEnd-.494)<1e-9&&Math.abs(U.durationS-1.266667)<1e-9,'stand_up 1.2667 s, rise 0.494 m');for(let i=0;i<U.t.length;i++)assert(Math.abs(B.standupRootK(U.t[i],U.durationS)*U.forwardEnd-U.forward[i])<1e-6,'stand-up root follows forward_m @'+U.t[i]);}
// b18 path v4: step xz equals toWorld of the authored lake-local point; end is the v4 stop, yaw −58°.
{const o0=L.toWorld([0,0,0]),zz=L.toWorld([0,0,1]),ly=Math.atan2(zz[0]-o0[0],zz[2]-o0[2]);
 const toL=p=>{const d=[p[0]-o0[0],p[1]-o0[1],p[2]-o0[2]],a=-ly;return [d[0]*Math.cos(a)+d[2]*Math.sin(a),d[1],-d[0]*Math.sin(a)+d[2]*Math.cos(a)];};
 const authored=L.toWorld([8.7525,B.exitGroundY(.36),25.7099]),w1=M.walk[1];
 assert(Math.hypot(w1[0]-authored[0],w1[1]-authored[1],w1[2]-authored[2])<1e-3,'computed stepPt matches toWorld([8.7525, ·, 25.7099])');
 const end=toL(M.walk.at(-1)),prior=toL(M.walk.at(-2)),yaw=Math.atan2(end[0]-prior[0],end[2]-prior[2])*180/Math.PI;
 assert(Math.abs(end[0]-3.2531)<1e-4&&Math.abs(end[1]-.5714)<1e-4&&Math.abs(end[2]-25.0904)<1e-4,'v4 end root');
 assert(Math.abs(yaw+58)<.05,'stop heading −58°, got '+yaw);
 const knots=[[7.9569,25.7935],[6.4423,25.3196],[6.0635,24.9932],[3.6982,24.8123],[3.2531,25.0904]];
 for(const k of knots){let best=9;for(const p of M.walk){const q=toL(p);best=Math.min(best,Math.hypot(q[0]-k[0],q[2]-k[1]));}assert(best<1e-3,'knot '+k+' off by '+best);}
 let minZ=99;for(const p of M.walk)minZ=Math.min(minZ,toL(p)[2]);assert(minZ<24.52&&minZ>24.50,'lowest root z ~24.508, got '+minZ);
 assert(Math.abs(B.lakesideBalloonMooring([9,9,9],L.toWorld).doorYawDeg-M.doorYawDeg)<1e-9,'door heading ignores the arrival node');}
// terrain: the 11-knot profile stays within 2 mm of the full ray samples, and the walk y follows it.
{const samples=require('./fixtures/terrain_samples.json');let maxE=0;for(const s of samples)maxE=Math.max(maxE,Math.abs(B.exitGroundY(s.s)-s.y));
 assert(maxE<=.002,'terrain profile error '+maxE);
 const o0=L.toWorld([0,0,0]);let acc=0,pen=0;for(let i=1;i<M.walk.length;i++){const a=M.walk[i-1],b=M.walk[i],len=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  for(let k=1;k<=8;k++){const u=k/8,s=acc+len*u;if(s<.36)continue;const y=a[1]+(b[1]-a[1])*u-o0[1],gy=s>=6.35615?.5714:B.exitGroundY(s);pen=Math.max(pen,Math.abs(y-gy));}acc+=len;}
 assert(pen<=.002,'walk y vs profile '+pen);
 const W=H.load('world-r1/WorldFlowCore.ts'),mid=W.pointOnPath(M.walk,.55);
 assert(Math.abs(mid[1]-.572)>.002,'CharacterMotion pointOnPath keeps the profile y, not the hard lawn');
 assert.equal(B.stepdownBlendedY(.602,0,.5754),.602);assert(Math.abs(B.stepdownBlendedY(.602,-.03,.5754)-.5754)<1e-12,'full drop lands on terrain');}
// foot-lock replay: recover only in swing; end error ≤ 2 mm. Peak is reported (about 11 mm at 18 mm/s).
{const frames=require('./fixtures/sim_lock_frames.json');const sole=p=>p==='foot.L'?'L':p==='foot.R'?'R':null;
 let off=[0,0],motionT=0,lastEmit=null,yawOld=frames[0].psi*Math.PI/180,peak=0,steady=0;
 for(let i=0;i<frames.length;i++){const f=frames[i];let dt=1/30;if(i){const d=f.tc-frames[i-1].tc;if(frames[i-1].clip===f.clip&&d>0&&d<.1)dt=d;}
  motionT+=dt;const prev=new Set((i?frames[i-1].planted:[]));for(const b of f.planted||[])if(!prev.has(b))lastEmit=motionT;
  const pl=(f.planted||[]).length===1?sole(f.planted[0]):null,yaw=f.psi*Math.PI/180,swing=B.footLockSwing(motionT,lastEmit),before=Math.hypot(off[0],off[1]);
  off=B.footLockStep(off,pl,yawOld,yaw,dt,swing);const after=Math.hypot(off[0],off[1]);
  if(pl&&Math.abs(yaw-yawOld)<1e-4&&!swing&&after<before-1e-9)steady++;if(after>peak)peak=after;yawOld=yaw;}
 assert.equal(steady,0,'recovery only during swing');assert(Math.hypot(off[0],off[1])<=.002,'foot-lock end '+Math.hypot(off[0],off[1]));
 console.log('foot-lock replay peak mm '+((peak*1000).toFixed(2)));}
// portrait cameras: 7 m main at h/w ≥ 2, short otherwise. Orbit pitch ~28–29°, under 52°.
{const main=LC.lakesidePortraitBoard({width:390,height:844}),sh=LC.lakesidePortraitBoard({width:320,height:568}),eq=LC.lakesidePortraitBoard({width:100,height:200}),none=LC.lakesidePortraitBoard();
 assert.deepEqual(main.position,[1.5,7,34.5]);assert.deepEqual(main.target,[1,-.5,0]);
 assert.deepEqual(sh.position,[2.5,6.5,34]);assert.deepEqual(sh.target,[-3,-.5,0]);
 assert.deepEqual(eq.position,main.position);assert.deepEqual(none.position,main.position);
 assert.deepEqual(LC.lakesidePortraitBoard({width:360,height:780}).position,main.position);
 assert.deepEqual(LC.lakesidePortraitBoard({width:390,height:520}).position,sh.position);
 const pivot=[3.2531,.5714+1.15,25.0904],pitch=cam=>{const d=[pivot[0]-cam.position[0],pivot[1]-cam.position[1],pivot[2]-cam.position[2]];return Math.atan2(-d[1],Math.hypot(d[0],d[2]))*180/Math.PI;};
 const pm=pitch(main),ps=pitch(sh);assert(pm>28&&pm<30&&ps>27.5&&ps<29,'orbit pitch main '+pm+' short '+ps);assert(pm<52&&ps<52);}
// standup wiring: sit_hold seat, then stand_up, then the in-place standing reset. Never a cut that skips stand_up.
{const ad=require('node:fs').readFileSync('creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');
 const seat=ad.indexOf('girl.setPosition(.032,-.1,-.099)'),seated=ad.indexOf("kind:'seated'"),stand=ad.indexOf("playNamed('stand_up'"),cut=ad.indexOf('controllerRoot:moored.start');
 assert(seat>0&&seated>seat&&stand>seated&&cut>stand,'seat → sit_hold/seated → stand_up → idle at P0');
 assert(ad.includes('stepdownBlendedY')&&ad.includes('footLockSwing'),'stepping blend and swing recovery are wired');}
console.log('PASS mooring, mesh frusta, right free look, path v4, terrain, foot lock, 7 m / short cameras, standup wiring');
