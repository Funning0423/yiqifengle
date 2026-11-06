'use strict';
// Subdivided shell: cruise vertices exact, UV seams closed, sampled crossings, pole/rim clearance.
// The 8 mouth cable ends are the only joint exemption. Samples are not a continuous proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'../..'),S=path.join(ROOT,'creator-build-project/assets/scripts/');
const H=require(path.join(ROOT,'tools/board-ui/harness.cjs')).createHarness();
const C=H.load(S+'region/BalloonCloth.ts');
const b=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'));
const n=b.readUInt32LE(12), json=JSON.parse(b.slice(20,20+n).toString('utf8'));
const bin=b.slice(20+n+8, 20+n+8+b.readUInt32LE(20+n));
function arr(i){
  const a=json.accessors[i], bv=json.bufferViews[a.bufferView];
  const start=(bv.byteOffset||0)+(a.byteOffset||0);
  const ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  if(a.componentType===5126)return new Float32Array(bin.buffer, bin.byteOffset+start, a.count*ncomp);
  return a.componentType===5125?new Uint32Array(bin.buffer, bin.byteOffset+start, a.count):new Uint16Array(bin.buffer, bin.byteOffset+start, a.count);
}
function mesh(name){
  const node=json.nodes.find(nd=>nd.name===name);
  const prim=json.meshes[node.mesh].primitives[0];
  return {pos:arr(prim.attributes.POSITION), uv:prim.attributes.TEXCOORD_0!=null?arr(prim.attributes.TEXCOORD_0):null, idx:arr(prim.indices)};
}
const env=mesh('balloon_envelope'), frame=mesh('balloon_load_frame'), basket=mesh('balloon_basket');
const cloth=C.buildCloth(env.pos, env.uv, env.idx, 2);
const err=C.cruiseError(cloth);
assert.equal(err.originalMax,0,'original cruise vertices are exact at shape 1');
assert.equal(err.addedMax,0,'added vertices sit on the authored surface at shape 1');
const times=[0,0.75,1.5,2.25,3];
const samples={};
for(const t of times){
  const p=C.clothPositions(cloth,t);
  const gap=C.seamGap(p, cloth.weld);
  assert.ok(gap<1e-5,'seam opened at t='+t+' by '+gap);
  const cross=C.crossingCount(p, cloth.idx);
  samples[String(t)]={seam:gap, crossings:cross, shape:+C.clothShape01(t).toFixed(4)};
}
assert.equal(samples['0'].crossings,0,'deflated shell is an embedding at the t=0 sample');
assert.equal(samples['3'].crossings,0,'cruise sample has no new crossings');
// Negative control: the counter must notice a forced stab.
const neg=new Float32Array([0,0,0, 1,0,0, 0,1,0, 0.2,0.2,-1, 0.2,0.2,1, 1,0.2,0]);
const negIdx=Uint32Array.from([0,1,2, 3,4,5]);
assert.ok(C.crossingCount(neg, negIdx)>=1,'negative control did not see a known crossing');
// Blue band (uv.x 0.9375) bends in Y instead of standing as one slab.
const p0=C.clothPositions(cloth,0);
let by0=Infinity, by1=-Infinity, bn=0;
for(let i=0;i<cloth.originals;i++){
  if(Math.abs(env.uv[i*2]-0.9375)>1e-4)continue;
  const y=p0[i*3+1]; if(y<by0)by0=y; if(y>by1)by1=y; bn++;
}
assert.ok(bn>=24,'blue band vertices missing');
assert.ok(by1-by0>0.12,'blue band Y span '+((by1-by0).toFixed(3)));
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function distOne(P,a,b,c){
  const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], bc=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
  let m=Infinity, worst=null;
  for(const p of P){
    const ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]], bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]], cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];
    const d1=dot(ab,ap), d2=dot(ac,ap), d3=dot(ab,bp), d4=dot(ac,bp), d5=dot(ab,cp), d6=dot(ac,cp);
    let q;
    if(d1<=0&&d2<=0)q=a; else if(d3>=0&&d4<=d3)q=b;
    else if(d1*d4-d3*d2<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3); q=[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v];}
    else if(d6>=0&&d5<=d6)q=c;
    else if(d5*d2-d1*d6<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6); q=[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w];}
    else if(d3*d6-d5*d4<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)); q=[b[0]+bc[0]*w,b[1]+bc[1]*w,b[2]+bc[2]*w];}
    else {const va=d3*d6-d5*d4, vb=d5*d2-d1*d6, vc=d1*d4-d3*d2, den=va+vb+vc||1, v=vb/den, w=vc/den; q=[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w];}
    const dist=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]); if(dist<m){m=dist; worst=p;}
  }
  return {m, worst};
}
function minSurface(pts, pos, idx){
  let m=Infinity, worst=null;
  for(let t=0;t<idx.length;t+=3){
    const a=idx[t], b=idx[t+1], c=idx[t+2];
    const hit=distOne(pts,[pos[a*3],pos[a*3+1],pos[a*3+2]],[pos[b*3],pos[b*3+1],pos[b*3+2]],[pos[c*3],pos[c*3+1],pos[c*3+2]]);
    if(hit.m<m){m=hit.m; worst=hit.worst;}
  }
  return {m, worst};
}
const poles=[], caps=[];
for(let i=0;i<frame.pos.length;i+=3){
  const p=[frame.pos[i], frame.pos[i+1], frame.pos[i+2]];
  (C.isMouthCap(p[0],p[1],p[2])?caps:poles).push(p);
}
const rim=[];
for(let i=0;i<basket.pos.length;i+=3)if(basket.pos[i+1]>1.0)rim.push([basket.pos[i], basket.pos[i+1], basket.pos[i+2]]);
const pole0=minSurface(poles, p0, cloth.idx);
const rim0=minSurface(rim, p0, cloth.idx);
const p3=C.clothPositions(cloth,3);
const pole3=minSurface(poles, p3, cloth.idx);
assert.ok(pole0.m>0.02,'deflated shell meets a pole at '+pole0.m);
assert.ok(rim0.m>0.02,'deflated shell meets the rim at '+rim0.m);
assert.ok(pole3.m>0.01,'cruise shell cuts a pole at '+pole3.m);
assert.equal(caps.length>0,true,'mouth cap vertices found');
const bytes={
  verts:cloth.cruise.length/3, tris:cloth.idx.length/3,
  positionBytes:cloth.cruise.byteLength, moundBytes:cloth.mound.byteLength, indexBytes:cloth.idx.byteLength,
};
const out={
  samples, blueY:[+by0.toFixed(3), +by1.toFixed(3)], blueN:bn,
  clearance:{poleDeflatedM:+pole0.m.toFixed(4), rimDeflatedM:+rim0.m.toFixed(4), poleCruiseM:+pole3.m.toFixed(4), mouthCapVerts:caps.length, poleVerts:poles.length},
  bytes, levels:cloth.levels,
  note:'Crossings are non-adjacent edge stabs at the listed clocks only. Not a continuous proof and not an engine frame.',
};
const dir=path.join(ROOT,'product/2026-11-06/balloon-mound-cloth');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'geometry.json'), JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
console.log('balloon-cloth: PASS');
