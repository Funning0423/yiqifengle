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
assert.ok(z.crownY>1.25&&z.crownY<2.15&&z.mouthY<1.15,'deflated cloth crests the rim so the lip and the mound are both visible, and it is not a full balloon');
assert.ok(z.sxz<0.45&&z.sy/z.sxz>0.35,'deflated aspect is a pile, not the old 0.12/0.55 disc');
const swellAt=(t)=>D.balloonDrapePose(t);
const s0=swellAt(0),s1=swellAt(1),s15=swellAt(1.5),s3=swellAt(3);
assert.ok(s1.crownY>s0.crownY+1.5&&s1.crownY<6,'t=1 is a small balloon, not the mound and not already full');
assert.ok(s15.crownY>s1.crownY+1.2&&s15.crownY<s3.crownY-2,'t=1.5 sits between the small balloon and cruise');
let prevS=s0.sxz,maxStep=0;
for(let t=0.1;t<=3.001;t+=0.1){const sxz=swellAt(+t.toFixed(1)).sxz;maxStep=Math.max(maxStep,Math.abs(sxz-prevS));prevS=sxz;}
assert.ok(maxStep<0.08,'sxz step per 0.1 s stays smooth, got '+maxStep.toFixed(4));
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
const runtimeReport={
  source:'runtime',
  note:'Node harness executes BalloonDrape.balloonDrapePose (the function BalloonTransit and the lakeside adapter call) and measures distance from each rim-corner wood vertex to the posed envelope triangles. Positive metres. Minimum over t=0..3 step 0.1 s.',
  minimumM:+worst.gap.toFixed(4), atT:worst.t,
  cornersAtMinimum:Object.fromEntries(Object.entries(worst.corners).map(([k,v])=>[k,+v.toFixed(4)])),
  stages,
};
const outDir=path.join(ROOT,'product/2026-11-05/balloon-inflate/r2');
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'clearance-runtime.json'), JSON.stringify(runtimeReport,null,2)+'\n');
console.log(JSON.stringify({
  deflated:{mouthY:+z.mouthY.toFixed(3),crownY:+z.crownY.toFixed(3),sy:+z.sy.toFixed(3),sxz:+z.sxz.toFixed(3),frame:z.frameVisible},
  mid:{t:0.9,mouthY:+mid.mouthY.toFixed(3),crownY:+mid.crownY.toFixed(3),sy:+mid.sy.toFixed(3),sxz:+mid.sxz.toFixed(3),frame:mid.frameVisible,frameSy:+mid.frameSy.toFixed(3)},
  full:{sy:full.sy,sxz:full.sxz,frameSy:full.frameSy},
}));
console.log('balloon-drape: PASS');
