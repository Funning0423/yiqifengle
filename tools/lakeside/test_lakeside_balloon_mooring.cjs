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
// b18 path v4: the walk ends on the v4 stop (lake-local [3.2531, 0.5714, 25.0904], measured lawn), no longer on the bridge L1
const STOP=LC.LAKESIDE_CAMERA_LAYOUT.stopLocal,stopW=L.toWorld([...STOP]),rootY=L.toWorld([0,0,0])[1];
assert.deepEqual([...STOP],[...B.LAKESIDE_PATH_V4.endLocal],'camera stop = path v4 end');
assert(Math.hypot(M.walk.at(-1)[0]-stopW[0],M.walk.at(-1)[2]-stopW[2])<1e-3&&Math.abs(M.walk.at(-1)[1]-stopW[1])<1e-3,'v4 stop '+JSON.stringify(M.walk.at(-1)));
assert(M.pathV4===true&&M.stepMismatchM<.01,'toWorld(v4 step-down) = computed step point, off '+M.stepMismatchM);
// b15 floor fix: P0 stands on the 3 cm floor board (mooring y 0.602 = lawn 0.572 + board); the route after it is on the 0.572 lawn
assert(Math.abs(M.start[1]-.602)<1e-9&&Math.abs(M.groundY-.572)<1e-9,'P0 on the 3 cm board');
// b18 fix ①: the route after P0 is on the measured LK_terrain profile (0.5654…0.5761), not the hard 0.572
{const {groundAt}=require('../lakeside-pathv4/terrain.cjs');let pen=0;for(const p of M.walk.slice(1)){const q=[-(p[0]-L.root[0]),p[1]-rootY,-(p[2]-L.root[2])];pen=Math.max(pen,Math.abs(groundAt(q[0],q[2])-q[1]));}
 assert(pen<=.002,'walk on the terrain (|Δy| ≤ 2 mm), got '+pen);assert(M.walk.slice(1).every(p=>p[1]-rootY>=.565&&p[1]-rootY<=.577),'v4 ground band');}
{const a=M.walk.at(-2),b=M.walk.at(-1),hl=Math.atan2(-(b[0]-a[0]),-(b[2]-a[2]))*180/Math.PI/* lake yaw 180: local = −world */;assert(Math.abs(hl+58)<.5,'v4 stop heading −58° lake-local, got '+hl);}
// b15 getout v2: door yaw / P0 / planner walk / door clock / foot lock
const K=B.LAKESIDE_BALLOON_LANDING;
assert.deepEqual([...K.mooringLocal],[9.5,.602,25.6],'b15 mooring (floor-fix: lawn 0.572 + 3 cm board)');
/* door2 (scene/b19-basket-door2 01c4cbe3): the EXIT wall (door B, basket −Z) faces 96.19°, so the basket yaw is 96.19+180 */
assert(Math.abs(M.exitWallYawDeg-96.19)<.01,'exit door wall yaw 96.19 deg at the b15 mooring, got '+M.exitWallYawDeg);assert(Math.abs(M.doorYawDeg-(96.19+180))<.01,'basket yaw = exit wall +180, got '+M.doorYawDeg);assert.equal(M.exitDoorNode,'basket_door_b');
assert.deepEqual(M.walk[0],M.start,'exit walk starts at P0');
const off=sub(M.start,M.mooring),yr=M.exitWallYawDeg*Math.PI/180/* P0 world unchanged by door2: rotY(yaw+180)(−0.03,0,−0.395) = rotY(yaw)(0.03,0,0.395) */;
assert(Math.abs(off[0]*Math.sin(yr)+off[2]*Math.cos(yr)-.395)<1e-9&&Math.abs(off[0]*Math.cos(yr)-off[2]*Math.sin(yr)-.03)<1e-9,'P0 = mooring + rotY(doorYaw)(0.03,0,0.395)');
assert(Math.abs(M.startYawRad*180/Math.PI-95.97)<.02,'faces the first walk point (95.97 deg), got '+M.startYawRad*180/Math.PI);
const lp=L.toLocal?L.toLocal(M.start):null;if(lp)assert(Math.abs(lp[0]-9.1105)<1e-3&&Math.abs(lp[2]-25.6724)<1e-3,'P0 lake-local (9.1105, 25.6724)');
assert(Math.abs(M.length-6.3562)<.005,'v4 L = 6.3562 m from P0, got '+M.length);
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
// b18 fix ②: stance (no swing) holds the offset; swing walks it back linearly at FOOT_LOCK_RECOVER_MPS, never past 0
{const l0=Math.hypot(o[0],o[1]);assert(l0>.02,'turn built an offset '+l0);let h=o;for(let i=0;i<60;i++)h=CM.footLockStep(h,'L',1,1,1/60,false);assert(Math.abs(Math.hypot(h[0],h[1])-l0)<1e-12,'stance: offset held (no stance-foot slide)');
 let s=o;for(let i=0;i<30;i++)s=CM.footLockStep(s,'L',1,1,1/60,true);assert(Math.abs(Math.hypot(s[0],s[1])-(l0-CM.FOOT_LOCK_RECOVER_MPS*.5))<1e-9,'swing: linear recovery');
 for(let i=0;i<600;i++)s=CM.footLockStep(s,'L',1,1,1/60,true);assert.equal(Math.hypot(s[0],s[1]),0,'swing recovery ends on 0');
 assert(CM.FOOT_LOCK_RECOVER_MPS>=.015&&CM.FOOT_LOCK_RECOVER_MPS<=.02&&Math.abs(CM.FOOT_LOCK_SWING_S-.12)<1e-12,'15–20 mm/s, 0.12 s double support');
 assert(!CM.footLockSwing(1,null)&&!CM.footLockSwing(1,.95)&&CM.footLockSwing(1,.85),'swing = > 0.12 s after the last contact, unknown without a contact');
 let u=[.01,0];u=CM.footLockStep(u,null,0,.2,1/60,false);assert.deepEqual(u,[.01,0],'no stance foot known: no pivot');}
const peak=M.mps;
const errors=[];
for(const [w,h] of [[390,844],[390,520],[844,390]]){
 const frame=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),pose=LC.lakesideAlignedLookAt(frame),n=visibleTriangles(pose,w/h);
 if(n)errors.push(`${w}x${h}: ${n} mesh triangles intersect the conservative frustum`);
 const landing=LC.lakesideScreenLanding(L,frame,STOP),e=C.arrivalPose([bank,stopW],L.focus,landing);
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
 assert(Math.abs(w1[1]-rootY-B.pathV4GroundAt(.36))<1e-3&&d<=.36+1e-3&&d>.35,'step point '+JSON.stringify(w1)+' d '+d);
 assert(Math.abs(Math.atan2(w1[0]-M.start[0],w1[2]-M.start[2])-M.startYawRad)<1e-9&&Math.abs(M.startYawRad*180/Math.PI-95.97)<.05,'start yaw toward the step point');
 assert(S.t.length===53&&Math.abs(S.durationS-1.7333)<1e-9&&Math.abs(S.loopTime-.453)<1e-9&&Math.abs(S.forwardEnd-1.1566)<1e-9,'stepdown meta');
 const end=B.stepdownRootAt(S.durationS),at6=B.stepdownRootAt(.6);assert(Math.abs(end[0]-1.1566)<1e-6&&Math.abs(end[1]+.03)<1e-6&&Math.abs(at6[1]+.03)<5e-3,'stepdown root table');
 const r=B.walkFrom(M.walk,S.forwardEnd),lr=r.reduce((a,p,i)=>i?a+Math.hypot(p[0]-r[i-1][0],p[1]-r[i-1][1],p[2]-r[i-1][2]):0,0);
 assert(Math.abs(lr-(M.length-S.forwardEnd))<2e-3&&Math.abs(r[0][1]-rootY-B.pathV4GroundAt(1.1566))<1e-3,'rest walk from 1.1566 m on the lawn '+lr);}
{const k0=B.standupRootK(0,1.266667),k1=B.standupRootK(1.266667,1.266667),kh=B.standupRootK(.633333,1.266667);assert(k0===0&&Math.abs(k1-1)<1e-9&&kh>0&&kh<1,'stand-up root fraction 0..1');
 const U=B.LAKESIDE_STANDUP;assert(U.t.length===39&&Math.abs(U.forwardEnd-.494)<1e-9,'stand_up forward_m table');for(let i=0;i<U.t.length;i++)assert(Math.abs(B.standupRootK(U.t[i],U.durationS)*U.forwardEnd-U.forward[i])<1e-6,'stand-up root follows forward_m @'+U.t[i]);}
console.log('PASS mooring, mesh frusta, right free look, geometry, unchanged shore, b15 door exit (yaw, P0, 0.8 m/s planner walk, r>=1, door clock, foot lock) and stationary end lens');
