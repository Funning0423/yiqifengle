'use strict';
// P1: mid-inflate pole feet stay on the basket, and the real ground/flight lenses
// stay outside the envelope. Node pose replay is not a Cocos device run.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();
const D=H.load(S+'region/BalloonDrape.ts');
const Shot=H.load(S+'region/BasketCloseShot.ts');
const Walk=H.load(S+'region/SkyWalkShot.ts');
const Anchor=H.load(S+'region/TransitionAnchorData.ts');
const Fin=H.load(S+'region/SkyFinaleShot.ts');
const Stage=H.load(S+'region/TransitionStaging.ts');
const P=D.BALLOON_DRAPE;

function readGlb(){
  const b=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'));
  const n=b.readUInt32LE(12), json=JSON.parse(b.slice(20,20+n).toString('utf8'));
  const binStart=20+n+8, bin=b.slice(binStart, binStart+b.readUInt32LE(20+n));
  return {json, bin};
}
function arr(doc, bin, i){
  const a=doc.accessors[i], bv=doc.bufferViews[a.bufferView];
  const start=(bv.byteOffset||0)+(a.byteOffset||0);
  const ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  if(a.componentType===5126){
    const f=new Float32Array(bin.buffer, bin.byteOffset+start, a.count*ncomp);
    const o=[]; for(let k=0;k<a.count;k++){const row=[]; for(let c=0;c<ncomp;c++)row.push(f[k*ncomp+c]); o.push(row);} return o;
  }
  const u=a.componentType===5125?new Uint32Array(bin.buffer, bin.byteOffset+start, a.count):new Uint16Array(bin.buffer, bin.byteOffset+start, a.count);
  return Array.from(u);
}
function meshWorld(doc, bin, name){
  const nodes=doc.nodes, parents={};
  nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parents[c]=i;}));
  const id=nodes.findIndex(n=>n.name===name);
  const chain=[]; let a=id, seen={};
  while(a!=null&&!seen[a]){seen[a]=1; chain.push(a); a=parents[a];}
  const M=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const mul=(A,B)=>{const C=new Array(16).fill(0); for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[r*4+c]+=A[r*4+k]*B[k*4+c]; return C;};
  const fromNode=(n)=>{
    const t=n.translation||[0,0,0], s=n.scale||[1,1,1], q=n.rotation||[0,0,0,1];
    const x=q[0],y=q[1],z=q[2],w=q[3];
    const R=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w), 2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w), 2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
    return [R[0]*s[0],R[1]*s[0],R[2]*s[0],0, R[3]*s[1],R[4]*s[1],R[5]*s[1],0, R[6]*s[2],R[7]*s[2],R[8]*s[2],0, t[0],t[1],t[2],1];
  };
  for(let k=chain.length-1;k>=0;k--){const A=fromNode(nodes[chain[k]]); const C=mul(M,A); for(let i=0;i<16;i++)M[i]=C[i];}
  const prim=doc.meshes[nodes[id].mesh].primitives[0];
  const pos=arr(doc,bin,prim.attributes.POSITION), idx=arr(doc,bin,prim.indices);
  const pw=pos.map(p=>{
    const x=p[0],y=p[1],z=p[2];
    return [M[0]*x+M[4]*y+M[8]*z+M[12], M[1]*x+M[5]*y+M[9]*z+M[13], M[2]*x+M[6]*y+M[10]*z+M[14]];
  });
  return {pw, idx};
}
function distPointTri(p,a,b,c){
  const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], bc=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
  const ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]], bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]], cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];
  const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const d1=dot(ab,ap), d2=dot(ac,ap), d3=dot(ab,bp), d4=dot(ac,bp), d5=dot(ab,cp), d6=dot(ac,cp);
  let q;
  if(d1<=0&&d2<=0)q=a;
  else if(d3>=0&&d4<=d3)q=b;
  else if(d1*d4-d3*d2<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3); q=[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v];}
  else if(d6>=0&&d5<=d6)q=c;
  else if(d5*d2-d1*d6<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6); q=[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w];}
  else if(d3*d6-d5*d4<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)); q=[b[0]+bc[0]*w,b[1]+bc[1]*w,b[2]+bc[2]*w];}
  else {const va=d3*d6-d5*d4, vb=d5*d2-d1*d6, vc=d1*d4-d3*d2, den=va+vb+vc||1, v=vb/den, w=vc/den;
    q=[a[0]+ab[0]*v+ac[0]*w, a[1]+ab[1]*v+ac[1]*w, a[2]+ab[2]*v+ac[2]*w];}
  return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
}
function minDist(pts, tris){
  let m=Infinity;
  for(const p of pts)for(const T of tris){const d=distPointTri(p,T[0],T[1],T[2]); if(d<m)m=d;}
  return m;
}

const raw=readGlb();
const frameMesh=meshWorld(raw.json, raw.bin, 'balloon_load_frame');
const basketMesh=meshWorld(raw.json, raw.bin, 'balloon_basket');
const feet=frameMesh.pw.filter(p=>p[1]<1.15);
assert.equal(feet.length,48,'four pole feet, 48 vertices under y 1.15');
const basketTris=[];
for(let i=0;i<basketMesh.idx.length;i+=3)basketTris.push([basketMesh.pw[basketMesh.idx[i]], basketMesh.pw[basketMesh.idx[i+1]], basketMesh.pw[basketMesh.idx[i+2]]]);

function posedFeet(pose, liftY){
  return feet.map(p=>[p[0]*pose.frameSxz, pose.frameLocalY+p[1]*pose.frameSy+(liftY||0), p[2]*pose.frameSxz]);
}

const T0=0, T1=3, STEP=0.1;
const poleRows=[];
let poleWorst={gap:0,t:0};
for(let t=T0;t<=T1+1e-9;t+=STEP){
  const pose=D.balloonDrapePose(+t.toFixed(4));
  if(!pose.frameVisible)continue;
  const gap=minDist(posedFeet(pose), basketTris);
  const y0=Math.min(...posedFeet(pose).map(p=>p[1]));
  poleRows.push({t:+t.toFixed(1), frameSy:+pose.frameSy.toFixed(3), footMinYM:+y0.toFixed(4), basketGapM:+gap.toFixed(4)});
  assert.ok(gap<=0.002, `t=${t.toFixed(1)} pole foot left the basket by ${gap.toFixed(4)} m`);
  assert.ok(Math.abs(y0-P.frameBaseY)<=0.002, `t=${t.toFixed(1)} foot Y ${y0} left the rim pivot`);
  if(gap>poleWorst.gap)poleWorst={gap,t:+t.toFixed(1)};
}
assert.ok(poleRows.length>=8, 'frame is visible on enough of the inflate');
const lifted=D.balloonDrapePose(3);
const liftedGap=minDist(posedFeet(lifted, 0.08), basketTris);
assert.ok(liftedGap>=0.05, `negative control: lifting the cruise feet 8 cm must leave the basket, got ${liftedGap}`);

const cruise=D.balloonDrapePose(3);
assert.ok(Math.abs(cruise.frameSy-1)<1e-9&&Math.abs(cruise.frameSxz-1)<1e-9&&Math.abs(cruise.frameLocalY)<1e-9,'cruise frame stays the authored identity');
assert.ok(Math.abs(cruise.sxz-1)<1e-9&&Math.abs(cruise.sy-1)<1e-9&&Math.abs(cruise.mouthY-3.05)<1e-9,'cruise envelope stays the authored rest pose');

// Real lenses, balloon-local. B1 close is beside the meadow door. Lake close is the
// skycity boarding spot from skyWalkShot + basketCloseSpot (empty occluders: the baked
// walk plan does not consult boxes). Flight keys are cam-pos in balloon_flightpath.json.
const her=Stage.TRANSITION_STAGING.basket.doorOut;
const b1=Shot.basketCloseSpot(her,[0,0,0],[]);
assert.ok(b1, 'B1 close spot exists with no occluders');
const M5=Stage.TRANSITION_STAGING.skyMooring5a;
const fin={position:Walk.skyLocalToWorld(M5,Fin.SKY_FINALE_POSE_LOCAL.position),target:Walk.skyLocalToWorld(M5,Fin.SKY_FINALE_POSE_LOCAL.target),fovVerticalDeg:Fin.SKY_FINALE_POSE_LOCAL.fovVerticalDeg};
const walk=Walk.skyWalkShot(M5.walkWorld,M5.walkMps,2,[],Walk.skyLocalToWorld(M5,Fin.SKY_FINALE_CITY_LOCAL),{...Walk.SKY_WALK_SHOT,plan:Anchor.SKY_5A_WALK_PLAN},fin);
const yaw=M5.worldYawDeg*Math.PI/180, c=Math.cos(-yaw), s=Math.sin(-yaw);
function skyLocal(p){
  const dx=p[0]-M5.world[0], dy=p[1]-M5.world[1], dz=p[2]-M5.world[2];
  return [c*dx+s*dz, dy, -s*dx+c*dz];
}
let skyNear=null;
const skySamples=[];
for(let t=0;t<=walk.total+1e-9;t+=0.2){
  const local=skyLocal(walk.pose(t).position);
  const h=Math.hypot(local[0],local[2]);
  skySamples.push({t:+t.toFixed(1), x:+local[0].toFixed(3), y:+local[1].toFixed(3), z:+local[2].toFixed(3), h:+h.toFixed(3)});
  if(!skyNear||h<skyNear.h)skyNear={t:+t.toFixed(1), local, h};
}
const door=M5.walkWorld[M5.walkWorld.length-1];
const lakeSpot=Shot.basketCloseSpot(door, M5.world, [], undefined, [walk.pose(walk.gazeS+walk.walkS)]);
assert.ok(lakeSpot, 'lakeside boarding close spot exists');
const lakeLocal=skyLocal(lakeSpot.position);

const flightDoc=JSON.parse(fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
let flightMin=1e9, flightAt=null;
for(const k of flightDoc.keys){
  if(k.t>12)break;
  const d=Math.hypot(k.cam[0]-k.pos[0], k.cam[1]-k.pos[1], k.cam[2]-k.pos[2]);
  if(d<flightMin){flightMin=d; flightAt=k.t;}
}
// Center distance minus the authored equator radius (2.989 m). Lower bound on surface gap, not a surface integral.
const flightSurfaceLower=flightMin-2.989;

const lenses=[
  {name:'b1-close', at:b1.position},
  {name:'sky-walk-nearest', at:skyNear.local},
  {name:'lake-board-close', at:lakeLocal},
];
const camRows=[];
let camWorst={gap:Infinity, name:'', t:0};
for(const lens of lenses){
  for(let t=T0;t<=T1+1e-9;t+=STEP){
    const pose=D.balloonDrapePose(+t.toFixed(4));
    const gap=D.envelopeCameraGap(lens.at[0], lens.at[1], lens.at[2], pose);
    camRows.push({lens:lens.name, t:+t.toFixed(1), gapM:+gap.toFixed(3), mouthY:+pose.mouthY.toFixed(2), sxz:+pose.sxz.toFixed(3), crownY:+pose.crownY.toFixed(2)});
    assert.ok(gap>=4.5, `${lens.name} t=${t.toFixed(1)} envelope gap ${gap.toFixed(3)} m < 4.5 m`);
    if(gap<camWorst.gap)camWorst={gap, name:lens.name, t:+t.toFixed(1)};
  }
}
assert.ok(flightSurfaceLower>=9, `flight camera t<=12 s surface lower bound ${flightSurfaceLower.toFixed(2)} m`);
const inside=D.envelopeCameraGap(0, 6.5, 0, D.balloonDrapePose(3));
assert.ok(inside<0, `negative control: a point inside the cruise envelope must be negative, got ${inside}`);
const outside=D.envelopeCameraGap(0, 1.2, 8, D.balloonDrapePose(3));
assert.ok(outside>4, `a point beside the basket stays outside, got ${outside}`);

const stages={};
for(const t of [0, 0.4, 0.6, 1.2, 3]){
  const pose=D.balloonDrapePose(t);
  stages[String(t)]={
    sy:+pose.sy.toFixed(3), sxz:+pose.sxz.toFixed(3), mouthY:+pose.mouthY.toFixed(2), crownY:+pose.crownY.toFixed(2),
    frameVisible:pose.frameVisible, frameSy:+pose.frameSy.toFixed(3), frameSxz:pose.frameSxz,
    b1GapM:+D.envelopeCameraGap(b1.position[0], b1.position[1], b1.position[2], pose).toFixed(3),
    skyGapM:+D.envelopeCameraGap(skyNear.local[0], skyNear.local[1], skyNear.local[2], pose).toFixed(3),
  };
}

const report={
  notCocosDevice:true,
  source:'node',
  note:'Node runs balloonDrapePose and envelopeCameraGap, the pose BalloonTransit.applyInflate and the lakeside inflate() call. Pole gaps are point-triangle distances from the 48 foot vertices to balloon_basket. Camera gaps are the ring-sample surface (ENV_RINGS), not a continuous mesh proof and not a Cocos/device PASS. Flight number is center distance minus the 2.989 m equator, a lower bound.',
  sample:{poleAndCameraT0:T0, t1:T1, stepS:STEP, flightT0:0, flightT1:12, flightStepS:0.1, skyWalkStepS:0.2},
  pole:{
    footCount:feet.length,
    maxBasketGapM:+poleWorst.gap.toFixed(4),
    atT:poleWorst.t,
    pivotYM:P.frameBaseY,
    rows:poleRows,
    negativeLiftM:0.08,
    negativeGapM:+liftedGap.toFixed(4),
  },
  camera:{
    b1CloseLocal:b1.position.map(v=>+v.toFixed(3)),
    skyWalkNearest:{t:skyNear.t, local:skyNear.local.map(v=>+v.toFixed(3)), horizM:+skyNear.h.toFixed(3)},
    lakeBoardCloseLocal:lakeLocal.map(v=>+v.toFixed(3)),
    minGapM:+camWorst.gap.toFixed(3),
    minAt:{lens:camWorst.name, t:camWorst.t},
    flightCamRootMinM:+flightMin.toFixed(3),
    flightCamRootAtT:flightAt,
    flightSurfaceLowerM:+flightSurfaceLower.toFixed(3),
    insideControlM:+inside.toFixed(3),
    rows:camRows,
  },
  stages,
  cruiseUnchanged:{sy:cruise.sy, sxz:cruise.sxz, mouthY:cruise.mouthY, frameSy:cruise.frameSy, frameSxz:cruise.frameSxz, frameLocalY:cruise.frameLocalY},
};
const outDir=path.join(ROOT,'product/2026-11-05/balloon-inflate/p1-pole-lens');
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'pole-lens-runtime.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  poleMaxGapM:report.pole.maxBasketGapM,
  poleNegativeGapM:report.pole.negativeGapM,
  cameraMinGapM:report.camera.minGapM,
  cameraMinAt:report.camera.minAt,
  flightSurfaceLowerM:report.camera.flightSurfaceLowerM,
  insideControlM:report.camera.insideControlM,
  stages,
}));
console.log('balloon-pole-lens: PASS');
