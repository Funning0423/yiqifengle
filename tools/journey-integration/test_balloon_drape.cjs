'use strict';
// P0 2026-11-05: deflated / mid-inflate envelope must not leave the load frame standing as scaffolding.
// Full inflate (t = 3) is the authored cruise pose: envelope mouth y 3.05, frame identity.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();
const D=H.load(S+'region/BalloonDrape.ts');
const P=D.BALLOON_DRAPE;

function gltf(){
  const b=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'));
  const n=b.readUInt32LE(12);return JSON.parse(b.slice(20,20+n).toString('utf8'));
}
const g=gltf();
const frame=g.nodes.find(n=>n.name==='balloon_load_frame');
assert.ok(frame&&frame.mesh===4,'load frame is its own node, mesh index 4 (appended)');
const root=g.nodes.find(n=>n.name==='transport_balloon');
assert.ok(root.children.includes(g.nodes.indexOf(frame)),'frame hangs off transport_balloon');
const prim=g.meshes[frame.mesh].primitives[0];
const ymin=g.accessors[prim.attributes.POSITION].min[1],ymax=g.accessors[prim.attributes.POSITION].max[1];
assert.ok(Math.abs(ymin-P.frameBaseY)<1e-3&&Math.abs(ymax-P.frameTopY)<1e-3,`frame bounds ${ymin}..${ymax} != drape constants`);
const basket=g.meshes[0];
const bmax=g.accessors[basket.primitives[0].attributes.POSITION].max[1];
assert.ok(bmax<1.20,`basket body must stop at the rim, got y ${bmax}`);
assert.equal(g.meshes[2].name,'balloon_envelope');

const samples=[];
for(let t=0;t<=3.0001;t+=1/30){
  const p=D.balloonDrapePose(t);
  const top=P.frameBaseY+(P.frameTopY-P.frameBaseY)*p.frameSy;
  if(p.frameVisible){
    assert.ok(top<=p.crownY+1e-3,`t ${t.toFixed(2)} frame top ${top.toFixed(2)} above crown ${p.crownY.toFixed(2)}`);
    assert.ok(top<=p.mouthY+(P.frameTopY-P.mouthFullY)+1e-3,`t ${t.toFixed(2)} cables reach above the mouth`);
  }
  assert.ok(p.crownY>p.mouthY,'crown above mouth');
  assert.ok(p.sy>0&&p.sxz>0);
  samples.push(p);
}
const z=D.balloonDrapePose(0),full=D.balloonDrapePose(3),mid=D.balloonDrapePose(0.9);
assert.ok(z.mouthY<0.5&&z.crownY>0.7&&z.crownY<1.05,'deflated cloth is a mound under the rim wood, not a disc at y 3');
assert.ok(z.sxz<0.45&&z.sy/z.sxz>0.35,'deflated aspect is a pile, not the old 0.12/0.55 disc');
assert.equal(z.frameVisible,false);
const home={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const y0=D.envelopeLocalY(z,home);
// world mouth = pivot 3.05 + localY + mouthMesh * sy
const mouthW=3.05+y0+P.mouthMeshY*z.sy;
assert.ok(Math.abs(mouthW-z.mouthY)<1e-6,'local Y puts the mouth on the drape target');
assert.ok(Math.abs(full.sy-1)<1e-9&&Math.abs(full.sxz-1)<1e-9&&Math.abs(full.mouthY-3.05)<1e-9,'t=3 is the authored envelope');
assert.ok(full.frameVisible&&Math.abs(full.frameSy-1)<1e-9&&Math.abs(full.frameLocalY)<1e-9&&Math.abs(full.frameSxz-1)<1e-9,'t=3 frame is identity');
assert.ok(Math.abs(D.envelopeLocalY(full,home)+3.05)<1e-9,'t=3 envelope local Y is the glTF rest -3.05');
assert.ok(mid.crownY>z.crownY+1.5&&mid.sxz>z.sxz,'mid-inflate has grown up and out');
assert.ok(mid.crownY> (mid.frameVisible?P.frameBaseY+(P.frameTopY-P.frameBaseY)*mid.frameSy:0),'mid crown covers the frame');
// node: deflated frame is off, full inflate restores the authored envelope + frame + flame
const cc=H.cc,vehicle=new cc.Node('transport_balloon'),sway=new cc.Node('envelope_sway_pivot'),env=new cc.Node('balloon_envelope');
const frameN=new cc.Node('balloon_load_frame'),flame=new cc.Node('burner_flame');
sway.setPosition(0,3.05,0);env.setPosition(0,-3.05,0);flame.setPosition(0,2.625,0);
vehicle.addChild(sway);sway.addChild(env);vehicle.addChild(frameN);vehicle.addChild(flame);
D.applyEnvelopeDrape(env,0,home);D.poseLoadFrameFromEnvelope(env,0);
assert.equal(frameN.active,false,'deflated load frame is hidden');
assert.ok(env.scale.y<0.25&&env.scale.x<0.5,'deflated envelope is the mound, not the old disc scale');
D.applyEnvelopeDrape(env,3,home);D.poseLoadFrameFromEnvelope(env,3);
assert.equal(frameN.active,true);
assert.ok(Math.abs(frameN.scale.x-1)<1e-6&&Math.abs(frameN.scale.y-1)<1e-6&&Math.abs(frameN.position.y)<1e-6,'full frame is identity');
assert.ok(Math.abs(env.position.y+3.05)<1e-6&&Math.abs(env.scale.x-1)<1e-6&&Math.abs(env.scale.y-1)<1e-6,'full envelope is the glTF rest pose');
assert.ok(Math.abs(flame.position.y-2.625)<1e-4,'flame returns to the authored burner');
const BT=H.load(S+'region/BalloonTransit.ts');
const o={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const stub={get position(){return {x:o.p.x,y:o.p.y,z:o.p.z,clone(){return {x:o.p.x,y:o.p.y,z:o.p.z};}};},get scale(){return {x:o.s.x,y:o.s.y,z:o.s.z,clone(){return {x:o.s.x,y:o.s.y,z:o.s.z};}};},setScale(x,y,z){o.s={x,y,z};},setPosition(x,y,z){o.p={x,y,z};}};
BT.yardEnvelope(stub,0);
assert.ok(Math.abs(o.s.y-z.sy)<1e-9&&Math.abs(o.p.y-D.envelopeLocalY(z,home))<1e-9,'yard stand-in uses the drape');
const adapter=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
assert.match(adapter,/applyEnvelopeDrape\(lenv,it,envHome\)/,'lakeside inflate drapes the same envelope');

// Runtime clearance: the game pose (balloonDrapePose) placed on the real envelope mesh,
// then the distance from each rim-corner's wood vertices to the cloth triangles.
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
function distOne(P,a,b,c){
  const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], bc=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
  let m=Infinity;
  for(const p of P){
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
    else {const va=d3*d6-d5*d4, vb=d5*d2-d1*d6, vc=d1*d4-d3*d2, den=va+vb+vc, v=vb/den, w=vc/den;
      q=[a[0]+ab[0]*v+ac[0]*w, a[1]+ab[1]*v+ac[1]*w, a[2]+ab[2]*v+ac[2]*w];}
    const dx=p[0]-q[0], dy=p[1]-q[1], dz=p[2]-q[2];
    const dist=Math.hypot(dx,dy,dz); if(dist<m)m=dist;
  }
  return m;
}
function cornerGaps(pose, env, quads){
  const sy=pose.sy, sxz=pose.sxz, mouth=pose.mouthY;
  const X=env.pw.map(p=>[p[0]*sxz, mouth+(p[1]-P.mouthMeshY)*sy, p[2]*sxz]);
  const tris=[];
  for(let i=0;i<env.idx.length;i+=3)tris.push([X[env.idx[i]], X[env.idx[i+1]], X[env.idx[i+2]]]);
  const out={};
  for(const [name, pts] of quads){
    let m=Infinity;
    for(const T of tris){const d=distOne(pts, T[0], T[1], T[2]); if(d<m)m=d;}
    out[name]=m;
  }
  return out;
}
const raw=readGlb();
const envMesh=meshWorld(raw.json, raw.bin, 'balloon_envelope');
const basketPts=meshWorld(raw.json, raw.bin, 'balloon_basket').pw.filter(p=>p[1]>=1);
const quads=[['NE',1,1],['NW',-1,1],['SE',1,-1],['SW',-1,-1]].map(([name,sx,sz])=>[name, basketPts.filter(p=>Math.sign(p[0])===sx&&Math.sign(p[2])===sz)]);
const sweep=[];
let worst={gap:Infinity,t:0,corners:null};
for(let t=0;t<=3.0001;t+=0.1){
  const pose=D.balloonDrapePose(t);
  const gaps=cornerGaps(pose, envMesh, quads);
  const gap=Math.min(...Object.values(gaps));
  sweep.push({t:+t.toFixed(1), gap:+gap.toFixed(4), sxz:+pose.sxz.toFixed(4), mouthY:+pose.mouthY.toFixed(3)});
  if(gap<worst.gap)worst={gap, t:+t.toFixed(1), corners:gaps, sxz:pose.sxz, mouthY:pose.mouthY, crownY:pose.crownY};
}
for(const row of sweep)assert.ok(row.gap>=0.20, `runtime corner clearance ${row.gap} m at t=${row.t} < 0.20 m`);
const stages={};
for(const t of [0,0.45,0.9,3]){
  const pose=D.balloonDrapePose(t), gaps=cornerGaps(pose, envMesh, quads);
  stages[String(t)]={sxz:+pose.sxz.toFixed(4), sy:+pose.sy.toFixed(4), mouthY:+pose.mouthY.toFixed(3), crownY:+pose.crownY.toFixed(3), frameVisible:pose.frameVisible,
    corners:Object.fromEntries(Object.entries(gaps).map(([k,v])=>[k,+v.toFixed(4)])), minM:+Math.min(...Object.values(gaps)).toFixed(4)};
}
assert.ok(Math.abs(stages['3'].sxz-1)<1e-9&&Math.abs(stages['3'].sy-1)<1e-9,'full inflate is still the authored scale');

// Whole wood frame, four sides, doors, and the load frame: triangle intersection plus
// vertex/edge-midpoint distance. This replays balloonDrapePose. It is not a Cocos device run.
function sub(p,q){return [p[0]-q[0],p[1]-q[1],p[2]-q[2]];}
function cross(p,q){return [p[1]*q[2]-p[2]*q[1], p[2]*q[0]-p[0]*q[2], p[0]*q[1]-p[1]*q[0]];}
function dot(p,q){return p[0]*q[0]+p[1]*q[1]+p[2]*q[2];}
function triList(pts, idx){
  const t=[];
  for(let i=0;i<idx.length;i+=3)t.push([pts[idx[i]], pts[idx[i+1]], pts[idx[i+2]]]);
  return t;
}
function triSamples(tris){
  const s=[];
  for(const T of tris){
    s.push(T[0],T[1],T[2]);
    for(let i=0;i<3;i++){const a=T[i], b=T[(i+1)%3]; s.push([(a[0]+b[0])*0.5,(a[1]+b[1])*0.5,(a[2]+b[2])*0.5]);}
  }
  return s;
}
function triAABB(T){
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for(const p of T){if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; if(p[2]<z0)z0=p[2]; if(p[2]>z1)z1=p[2];}
  return [x0,y0,z0,x1,y1,z1];
}
function aabbOverlap(a,b){return a[0]<=b[3]&&a[3]>=b[0]&&a[1]<=b[4]&&a[4]>=b[1]&&a[2]<=b[5]&&a[5]>=b[2];}
function separated(A,B,axis){
  const n=Math.hypot(axis[0],axis[1],axis[2]);
  if(n<1e-12)return false;
  let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
  for(const p of A){const d=dot(p,axis); if(d<a0)a0=d; if(d>a1)a1=d;}
  for(const p of B){const d=dot(p,axis); if(d<b0)b0=d; if(d>b1)b1=d;}
  return a1<b0-1e-7||b1<a0-1e-7;
}
function triHit(A,B){
  const axes=[cross(sub(A[1],A[0]),sub(A[2],A[0])), cross(sub(B[1],B[0]),sub(B[2],B[0]))];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)axes.push(cross(sub(A[(i+1)%3],A[i]), sub(B[(j+1)%3],B[j])));
  for(const ax of axes)if(separated(A,B,ax))return false;
  return true;
}
function anyHit(cloth, solid){
  const ca=cloth.map(triAABB), sa=solid.map(triAABB);
  for(let i=0;i<cloth.length;i++)for(let j=0;j<solid.length;j++){
    if(!aabbOverlap(ca[i], sa[j]))continue;
    if(triHit(cloth[i], solid[j]))return true;
  }
  return false;
}
function minSep(samples, tris){
  let m=Infinity;
  for(const T of tris){const d=distOne(samples, T[0], T[1], T[2]); if(d<m)m=d;}
  return m;
}
function clothOf(pose){
  const X=envMesh.pw.map(p=>[p[0]*pose.sxz, pose.mouthY+(p[1]-P.mouthMeshY)*pose.sy, p[2]*pose.sxz]);
  return triList(X, envMesh.idx);
}
function frameOf(pose){
  const sx=pose.frameVisible?pose.frameSxz:0.001, sy=pose.frameVisible?pose.frameSy:0.001;
  const X=frameMesh.pw.map(p=>[p[0]*sx, p[1]*sy+pose.frameLocalY, p[2]*sx]);
  return triList(X, frameMesh.idx);
}
function sideOf(p){
  return Math.abs(p[0])>=Math.abs(p[2])?(p[0]>=0?'+X':'-X'):(p[2]>=0?'+Z':'-Z');
}
function shellReport(pose){
  const cloth=clothOf(pose), frame=frameOf(pose), posedFrameSamples=triSamples(frame);
  const basketHit=anyHit(cloth, basketTris), doorHit=anyHit(cloth, doorTris.concat(doorTrisB));
  const frameBody=posedFrameSamples.filter(p=>p[1]<pose.mouthY-0.05);
  const basketGap=minSep(basketSamples, cloth), doorGap=Math.min(minSep(doorSamples, cloth), minSep(doorSamplesB, cloth));
  const sides={};
  for(const name of ['+X','-X','+Z','-Z']){
    const pts=basketSamples.filter(p=>sideOf(p)===name);
    sides[name]=minSep(pts, cloth);
  }
  return {
    basketIntersects:basketHit, doorIntersects:doorHit,
    basketMinM:basketGap, doorMinM:doorGap, sides,
    frameIntersects:anyHit(cloth, frame),
    frameBelowMouthMinM:frameBody.length?minSep(frameBody, cloth):null,
  };
}
const basketMesh=meshWorld(raw.json, raw.bin, 'balloon_basket');
const doorMesh=meshWorld(raw.json, raw.bin, 'basket_door_leaf');
const doorMeshB=meshWorld(raw.json, raw.bin, 'basket_door_leaf_b');
const frameMesh=meshWorld(raw.json, raw.bin, 'balloon_load_frame');
const basketTris=triList(basketMesh.pw, basketMesh.idx);
const doorTris=triList(doorMesh.pw, doorMesh.idx);
const doorTrisB=triList(doorMeshB.pw, doorMeshB.idx);
const basketSamples=triSamples(basketTris), doorSamples=triSamples(doorTris), doorSamplesB=triSamples(doorTrisB);
const badPose={sy:0.55,sxz:1.15,mouthY:0.35,crownY:0.35+(P.crownMeshY-P.mouthMeshY)*0.55,frameVisible:false,frameSy:0,frameSxz:1,frameLocalY:P.frameBaseY,flameLocalY:0.5,burnerLocalY:0.5};
const negative=shellReport(badPose);
assert.equal(negative.basketIntersects, true, 'negative case: a cloth scaled through the basket must be reported as an intersection');
const shellTimes=[0,0.35,0.7,1.2,1.8,3];
let releaseT=null;
for(let t=0;t<=3.0001;t+=0.01){const p=D.balloonDrapePose(t); if(D.basketSxzCap(p.mouthY,p.sy)>2){releaseT=t; break;}}
for(let t=Math.max(0,releaseT-0.16);t<=releaseT+0.16;t+=0.02)shellTimes.push(+t.toFixed(3));
const shellRows=[];
for(const t of [...new Set(shellTimes)].sort((a,b)=>a-b)){
  const pose=D.balloonDrapePose(t), row=shellReport(pose);
  assert.equal(row.basketIntersects, false, `basket intersects the cloth at t=${t}`);
  assert.equal(row.doorIntersects, false, `a door intersects the cloth at t=${t}`);
  assert.ok(row.basketMinM>=0.04, `basket shell gap ${row.basketMinM} at t=${t}`);
  assert.ok(row.doorMinM>=0.04, `door gap ${row.doorMinM} at t=${t}`);
  for(const name of ['+X','-X','+Z','-Z'])assert.ok(row.sides[name]>=0.04, `side ${name} gap ${row.sides[name]} at t=${t}`);
  if(row.frameBelowMouthMinM!=null)assert.ok(row.frameBelowMouthMinM>=0.02, `load frame below the mouth is ${row.frameBelowMouthMinM} m from the cloth at t=${t}`);
  shellRows.push({t:+t.toFixed(3), basketMinM:+row.basketMinM.toFixed(4), doorMinM:+row.doorMinM.toFixed(4), sides:Object.fromEntries(Object.entries(row.sides).map(([k,v])=>[k,+v.toFixed(4)])), frameIntersects:row.frameIntersects, frameBelowMouthMinM:row.frameBelowMouthMinM==null?null:+row.frameBelowMouthMinM.toFixed(4)});
}
let prevS=null, maxStep=0, stepAt=0;
const curve=[];
for(let t=0;t<=3.0001;t+=0.01){
  const p=D.balloonDrapePose(t);
  if(prevS){const d=Math.abs(p.sxz-prevS); if(d>maxStep){maxStep=d; stepAt=t;}}
  prevS=p.sxz;
  if(Math.abs(t/0.02-Math.round(t/0.02))<1e-6)curve.push({t:+t.toFixed(2), sxz:+p.sxz.toFixed(4), sy:+p.sy.toFixed(4), mouthY:+p.mouthY.toFixed(3), crownY:+p.crownY.toFixed(3), horizR:+(2.989*p.sxz).toFixed(4)});
}
assert.ok(maxStep<0.02, `sxz steps ${maxStep} in 0.01 s at t=${stepAt.toFixed(3)} (cap release pop)`);
const outDir=path.join(ROOT,'product/2026-11-05/balloon-inflate/r2');
fs.mkdirSync(outDir,{recursive:true});
const shellReportOut={
  kind:'pose-replay',
  notCocosDevice:true,
  note:'Node runs balloonDrapePose, the same function BalloonTransit.applyInflate and the lakeside inflate call, then tests the posed triangles. This is not a Cocos editor or device run. Device check stays with the test team.',
  negativeCase:{intentionalClip:true, basketIntersects:negative.basketIntersects, basketMinM:+negative.basketMinM.toFixed(4), expect:'basketIntersects true', pose:'sy 0.55, sxz 1.15, mouthY 0.35'},
  frameAtFull:'t=3 frameIntersects is the authored cable top, 2.2 cm inside the mouth. Samples more than 5 cm below the mouth stay clear (frameBelowMouthMinM).',
  capReleaseT:+releaseT.toFixed(3),
  maxAbsDsxzPer001s:+maxStep.toFixed(4),
  maxAbsDsxzAtT:+stepAt.toFixed(3),
  rows:shellRows,
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'clearance-shell-runtime.json'), JSON.stringify(shellReportOut,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'swell-curve-runtime.json'), JSON.stringify({kind:'pose-replay', notCocosDevice:true, stepS:0.02, capReleaseT:+releaseT.toFixed(3), maxAbsDsxzPer001s:+maxStep.toFixed(4), samples:curve},null,2)+'\n');
const runtimeReport={
  source:'runtime',
  note:'Pose replay, not a Cocos device run. Node executes balloonDrapePose and measures rim-corner wood vertices against the posed envelope. Device check stays with the test team. Whole-shell numbers are in clearance-shell-runtime.json.',
  minimumM:+worst.gap.toFixed(4), atT:worst.t,
  cornersAtMinimum:Object.fromEntries(Object.entries(worst.corners).map(([k,v])=>[k,+v.toFixed(4)])),
  stages,
};
fs.writeFileSync(path.join(outDir,'clearance-runtime.json'), JSON.stringify(runtimeReport,null,2)+'\n');
console.log(JSON.stringify({
  deflated:{mouthY:+z.mouthY.toFixed(3),crownY:+z.crownY.toFixed(3),sy:+z.sy.toFixed(3),sxz:+z.sxz.toFixed(3),frame:z.frameVisible},
  mid:{t:0.9,mouthY:+mid.mouthY.toFixed(3),crownY:+mid.crownY.toFixed(3),sy:+mid.sy.toFixed(3),sxz:+mid.sxz.toFixed(3),frame:mid.frameVisible,frameSy:+mid.frameSy.toFixed(3)},
  full:{sy:full.sy,sxz:full.sxz,frameSy:full.frameSy},
}));
console.log('balloon-drape: PASS');
