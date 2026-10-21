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
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
function visibleTriangles(pose,aspect){
 const {fw,r,up,th}=FL.basis(pose);let count=0;
 for(const o of mesh)for(let k=0;k<o.tris.length;k+=9){const clip=[];
  for(let j=0;j<9;j+=3){const q=[o.tris[k+j],o.tris[k+j+1],o.tris[k+j+2]],v=sub(q.map((x,i)=>x+point[i]),pose.position),z=dot(v,fw),x=dot(v,r),y=dot(v,up);
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
let peak=0;for(let t=.01;t<M.timing.durationS;t+=.01)peak=Math.max(peak,(M.walkAt(t)-M.walkAt(t-.01))/.01);
assert(Math.abs(peak-1.2)<1e-7,'production walk cruises at 1.2 m/s');
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
for(const dy of [.5,1.5,3,5,6.7,8.5,10])for(let i=0;i<8;i++){const a=i/8*2*Math.PI,r=dy<3?1:2.9,n=nearest(bvh,[point[0]+Math.cos(a)*r,point[1]+dy,point[2]+Math.sin(a)*r]);
 if(n.d<clearance){clearance=n.d;closest=n.who;}}
if(clearance<.49)errors.push(`clearance ${clearance.toFixed(6)} m < 0.49 m (${closest})`);
console.log(JSON.stringify({point,clearance,closest,walkSeconds:M.timing.durationS,peakWalkMps:peak,errors}));
assert.deepEqual(errors,[],'option A acceptance');
console.log('PASS mooring, mesh frusta, right free look, geometry, unchanged shore, walk speed and stationary end lens');
