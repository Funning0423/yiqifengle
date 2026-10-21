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
assert.deepEqual(M.walk.at(-1),bank,'unchanged shore position');
const prior=M.walk.at(-2),oldPrior=L.arrival.at(-2);
assert(dot(sub(bank,prior),sub(bank,oldPrior))>0,'same final approach heading');
assert(Math.abs(bank[0]-prior[0])<1e-8,'same arrival tangent avoids an end-camera jump');
// b15 getout v2: door yaw / P0 / planner walk / door clock / foot lock
const K=B.LAKESIDE_BALLOON_LANDING;
assert.deepEqual([...K.mooringLocal],[9.5,.572,25.6],'b15 mooring');
assert(Math.abs(M.doorYawDeg-96.19)<.01,'basket door yaw 96.19 deg at the b15 mooring, got '+M.doorYawDeg);
assert.deepEqual(M.walk[0],M.start,'exit walk starts at P0');
const off=sub(M.start,M.mooring),yr=M.doorYawDeg*Math.PI/180;
assert(Math.abs(off[0]*Math.sin(yr)+off[2]*Math.cos(yr)-.395)<1e-9&&Math.abs(off[0]*Math.cos(yr)-off[2]*Math.sin(yr)-.03)<1e-9,'P0 = mooring + rotY(doorYaw)(0.03,0,0.395)');
assert(Math.abs(M.startYawRad-yr)<1e-12,'she is reset to face the door');
assert(Math.abs(M.seatYawDeg(30)-(30-M.doorYawDeg))<1e-12,'seat yaw compensated for the basket yaw');
assert.equal(M.mps,.8,'exit walk 0.8 m/s');
assert.equal(B.exitWalkSpeed(.7),.8);assert(Math.abs(B.exitWalkSpeed(.5)-.65)<1e-12&&Math.abs(B.exitWalkSpeed(1.2)-.9)<1e-12,'speed picked inside the planner band of the calibrated clip speed');
const ratio=M.mps/.7;assert(ratio>=.75&&ratio<=1.3,'walk_start and walk_stop kept by planWalk');
assert(M.cornerM>=1-1e-12,'corner radius >= 1.0 m, got '+M.cornerM);
const cruise=(M.length-K.exitStart.M-K.exitStop.M)/(M.walkS-K.exitStart.S/Math.min(K.exitStart.rateMax,ratio)-K.exitStop.S);
assert(Math.abs(cruise-.8)<1e-9,'planned cruise 0.8 m/s');
assert.equal(M.T0,.5);assert(Math.abs(M.doorAt-.833)<1e-12);assert(Math.abs(M.walkStartAt-2.3)<1e-12);
assert.equal(M.doorDeg(M.doorAt),0);assert(Math.abs(M.doorDeg(M.doorAt+2/30)-2.75)<1e-9);assert.equal(M.doorDeg(M.doorAt+2/30+.8),100);assert.equal(M.doorDeg(99),100);
for(let t=0;t<3;t+=.01)assert(M.doorDeg(t+.01)>=M.doorDeg(t)-1e-12,'door opens monotonically');
const CM=B;
let o=[0,0];for(let i=0;i<60;i++){const y0=i*Math.PI/120,y1=(i+1)*Math.PI/120,before=[o[0]+CM.FOOT_LOCK_HALF_W*Math.cos(y0),o[1]-CM.FOOT_LOCK_HALF_W*Math.sin(y0)];o=CM.footLockStep(o,'L',y0,y1,1/60);const after=[o[0]+CM.FOOT_LOCK_HALF_W*Math.cos(y1),o[1]-CM.FOOT_LOCK_HALF_W*Math.sin(y1)];
 if(Math.hypot(o[0],o[1])<CM.FOOT_LOCK_MAX_M-1e-9)assert(Math.hypot(after[0]-before[0],after[1]-before[1])<1e-12,'planted sole stays put while she turns');}
for(let i=0;i<120;i++)o=CM.footLockStep(o,'L',1,1,1/60);assert(Math.hypot(o[0],o[1])<.01,'lock offset relaxes back onto the path');
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
console.log('PASS mooring, mesh frusta, right free look, geometry, unchanged shore, b15 door exit (yaw, P0, 0.8 m/s planner walk, r>=1, door clock, foot lock) and stationary end lens');
