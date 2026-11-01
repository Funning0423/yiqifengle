'use strict';
/** Engine-free evaluator for her character GLB (运镜bot, front-hem fix b21).
 *  glTF 2.0 LINEAR/STEP sampling into joint nodes (rest first, like AnimRig.sample), FK, morph targets + linear-blend skinning
 *  (glTF spec = Cocos realtime skinning), and the front-hem / leg-penetration metrics used by the skirt gates.
 *  Coordinates: glTF (+Y up, +Z her forward), metres. */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const GLB=path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');
const META=path.join(path.dirname(GLB),'anim_meta.json');
function parseGlb(buf){if(buf.readUInt32LE(0)!==0x46546c67)throw Error('not a glb');let off=12,json=null,bin=null;
  while(off<buf.length){const len=buf.readUInt32LE(off),type=buf.readUInt32LE(off+4),c=buf.subarray(off+8,off+8+len);if(type===0x4e4f534a)json=JSON.parse(c.toString('utf8'));else if(type===0x004e4942)bin=c;off+=8+len;}
  const N={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},K={5126:[4,'readFloatLE',1],5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',1]};
  const raw=(bv,off,count,n,ct,norm)=>{const v=json.bufferViews[bv],[sz,rd,mx]=K[ct],st=v.byteStride||n*sz,base=(v.byteOffset||0)+(off||0),div=norm?mx:1;
    const out=new Float64Array(count*n);for(let k=0;k<count;k++)for(let c=0;c<n;c++)out[k*n+c]=bin[rd](base+k*st+c*sz)/div;return out;};
  /* sparse accessors (the morph targets): zeros (or the base view) + sparse indices/values */
  const acc=i=>{const a=json.accessors[i],n=N[a.type];const out=a.bufferView!==undefined?raw(a.bufferView,a.byteOffset,a.count,n,a.componentType,a.normalized):new Float64Array(a.count*n);
    if(a.sparse){const sp=a.sparse,ix=raw(sp.indices.bufferView,sp.indices.byteOffset,sp.count,1,sp.indices.componentType,false),vl=raw(sp.values.bufferView,sp.values.byteOffset,sp.count,n,a.componentType,a.normalized);
      for(let k=0;k<sp.count;k++)for(let c=0;c<n;c++)out[ix[k]*n+c]=vl[k*n+c];}return out;};
  return {json,bin,acc};}
/* ---- quaternion / matrix helpers ---- */
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
function trs(p,q,s){const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return [(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,p[0],p[1],p[2],1];}
function mm(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
const xf=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
/** Load: nodes (TRS), clips (channels), skin, meshes (positions, joints, weights, morph deltas, target names). */
function load(file=GLB){const buf=fs.readFileSync(file),{json,acc}=parseGlb(buf);
  const nodes=json.nodes.map((n,i)=>({i,name:n.name||'',p:(n.translation||[0,0,0]).slice(),q:(n.rotation||[0,0,0,1]).slice(),s:(n.scale||[1,1,1]).slice(),parent:-1,children:n.children||[]}));
  nodes.forEach(n=>n.children.forEach(c=>nodes[c].parent=n.i));const rest=nodes.map(n=>({p:n.p.slice(),q:n.q.slice(),s:n.s.slice()}));
  const order=[];const visit=i=>{order.push(i);nodes[i].children.forEach(visit);};nodes.filter(n=>n.parent<0).forEach(n=>visit(n.i));
  const clips={};for(const a of json.animations||[]){let dur=0;const ch=a.channels.map(c=>{const s=a.samplers[c.sampler],inp=acc(s.input),out=acc(s.output);dur=Math.max(dur,inp[inp.length-1]);
    return {node:c.target.node,path:c.target.path,inp,out,n:out.length/inp.length,step:s.interpolation==='STEP',sampler:c.sampler};});clips[a.name]={name:a.name,duration:dur,channels:ch};}
  const skin=json.skins[0],joints=skin.joints,ibm=acc(skin.inverseBindMatrices);
  const meshes={};json.nodes.forEach(n=>{if(n.mesh===undefined)return;const m=json.meshes[n.mesh],names=(m.extras&&m.extras.targetNames)||[];
    const prims=m.primitives.map(p=>({P:acc(p.attributes.POSITION),J:acc(p.attributes.JOINTS_0),W:acc(p.attributes.WEIGHTS_0),I:p.indices!==undefined?acc(p.indices):null,T:(p.targets||[]).map(t=>t.POSITION!==undefined?acc(t.POSITION):null)}));
    let P=[],J=[],W=[],F=[],T=names.map(()=>[]),off=0;for(const pr of prims){const nv=pr.P.length/3;for(let k=0;k<nv*3;k++)P.push(pr.P[k]);for(let k=0;k<nv*4;k++){J.push(pr.J[k]);W.push(pr.W[k]);}
      if(pr.I)for(let k=0;k<pr.I.length;k++)F.push(pr.I[k]+off);names.forEach((_,t)=>{const d=pr.T[t];for(let k=0;k<nv*3;k++)T[t].push(d?d[k]:0);});off+=nv;}
    meshes[m.name]={name:m.name,P:Float64Array.from(P),J:Int32Array.from(J),W:Float64Array.from(W),F:Int32Array.from(F),targets:names,T:T.map(a=>Float64Array.from(a)),nv:off};});
  const byName={};nodes.forEach(n=>byName[n.name]=n.i);
  return {file,buf,json,nodes,rest,order,clips,joints,ibm,meshes,byName,jointNames:joints.map(i=>nodes[i].name)};}
function sampleChannel(c,t){const i=c.inp,N=i.length,n=c.n,v=c.out;let k=0;
  if(t<=i[0]||N===1)return Array.from(v.subarray(0,n));if(t>=i[N-1])return Array.from(v.subarray((N-1)*n,N*n));
  let lo=0,hi=N-1;while(hi-lo>1){const m=(lo+hi)>>1;if(i[m]<=t)lo=m;else hi=m;}k=lo;if(c.step)return Array.from(v.subarray(k*n,k*n+n));
  const u=(t-i[k])/(i[k+1]-i[k]),a=k*n,b=(k+1)*n;
  if(c.path==='rotation'){const d=v[a]*v[b]+v[a+1]*v[b+1]+v[a+2]*v[b+2]+v[a+3]*v[b+3],sg=d<0?-1:1;
    // Cocos samples quaternion tracks with slerp
    let c0=Math.abs(d),k0=1-u,k1=u;if(c0<.9995){const th=Math.acos(c0),s=Math.sin(th);k0=Math.sin((1-u)*th)/s;k1=Math.sin(u*th)/s;}
    const r=[0,1,2,3].map(j=>v[a+j]*k0+sg*v[b+j]*k1),l=Math.hypot(...r);return r.map(x=>x/l);}
  const r=[];for(let j=0;j<n;j++)r.push(v[a+j]*(1-u)+v[b+j]*u);return r;}
/** AnimRig.sample: rest TRS first (glTF clips omit rest-valued channels), then the clip's channels. */
function resetRest(R){R.nodes.forEach((n,i)=>{n.p=R.rest[i].p.slice();n.q=R.rest[i].q.slice();n.s=R.rest[i].s.slice();});}
function applyClip(R,clip,t,override){resetRest(R);const C=R.clips[clip];if(!C)throw Error('no clip '+clip);
  for(const c of C.channels){const ov=override&&override(c);const v=ov?sampleChannel(ov,t):sampleChannel(c,t);const n=R.nodes[c.node];if(c.path==='translation')n.p=v;else if(c.path==='rotation')n.q=v;else if(c.path==='scale')n.s=v;}}
function world(R){const W=new Array(R.nodes.length);for(const i of R.order){const n=R.nodes[i],L=trs(n.p,n.q,n.s);W[i]=n.parent<0?L:mm(W[n.parent],L);}return W;}
/** Skinned vertex positions of one mesh (morph deltas first, then LBS). weights: {targetName: w}. ids: optional vertex subset. */
function skinMesh(R,W,mesh,weights,ids){const M=R.joints.map((j,k)=>mm(W[j],Array.from(R.ibm.subarray(k*16,k*16+16))));
  const act=[];mesh.targets.forEach((nm,t)=>{const w=weights&&weights[nm];if(w>1e-6)act.push([mesh.T[t],w]);});
  const list=ids||null,n=list?list.length:mesh.nv,out=new Float64Array(n*3);
  for(let q=0;q<n;q++){const i=list?list[q]:q;let x=mesh.P[i*3],y=mesh.P[i*3+1],z=mesh.P[i*3+2];for(const [d,w] of act){x+=d[i*3]*w;y+=d[i*3+1]*w;z+=d[i*3+2]*w;}
    let ox=0,oy=0,oz=0;for(let k=0;k<4;k++){const w=mesh.W[i*4+k];if(!(w>0))continue;const m=M[mesh.J[i*4+k]];ox+=w*(m[0]*x+m[4]*y+m[8]*z+m[12]);oy+=w*(m[1]*x+m[5]*y+m[9]*z+m[13]);oz+=w*(m[2]*x+m[6]*y+m[10]*z+m[14]);}
    out[q*3]=ox;out[q*3+1]=oy;out[q*3+2]=oz;}return out;}
const jpos=(R,W,name)=>{const m=W[R.byName[name]];return [m[12],m[13],m[14]];};
/** Hips forward (+Z rest) in world, flattened. */
function hipsForward(R,W,W0){const h=R.byName['hips'],a=W[h],b=W0[h];
  // rotation of hips relative to rest applied to +Z: R_now * R_rest^T * z
  const z=[b[8],b[9],b[10]];const lz=[b[0]*0+b[1]*0+b[2]*1,b[4]*0+b[5]*0+b[6]*1,b[8]*0+b[9]*0+b[10]*1];// rest^T * +Z
  const f=[a[0]*lz[0]+a[4]*lz[1]+a[8]*lz[2],0,a[2]*lz[0]+a[6]*lz[1]+a[10]*lz[2]];const l=Math.hypot(f[0],f[2])||1;return [f[0]/l,0,f[2]/l];}
function dominant(mesh,i){let b=-1,bw=-1;for(let k=0;k<4;k++)if(mesh.W[i*4+k]>bw){bw=mesh.W[i*4+k];b=mesh.J[i*4+k];}return b;}
/** Bind-pose vertex sets (same definition as the step-1 Blender probe): dress front panel = within +-40 deg of her forward about
 *  the hips axis and below knee+0.10 m; front hem = lowest 4 cm of it; apron hem = lowest 3 cm of the apron. Legs = BODY vertices
 *  whose dominant joint is thigh/shin/foot (knees and shoes included). */
function sets(R){resetRest(R);const W0=world(R),hip=jpos(R,W0,'hips'),k0=(jpos(R,W0,'shin.L')[1]+jpos(R,W0,'shin.R')[1])/2;
  const D=R.meshes.LOD0_G2_DRESS,A=R.meshes.LOD0_G2_APRON,B=R.meshes.LOD0_G2_BODY;const Dp=skinMesh(R,W0,D,null),Ap=skinMesh(R,W0,A,null);
  const cos40=Math.cos(40*Math.PI/180),fp=[];for(let i=0;i<D.nv;i++){const dx=Dp[i*3]-hip[0],dz=Dp[i*3+2]-hip[2],l=Math.hypot(dx,dz);if(l>1e-4&&dz/l>cos40&&Dp[i*3+1]<k0+0.10)fp.push(i);}
  const fz=Math.min(...fp.map(i=>Dp[i*3+1]));const hem=fp.filter(i=>Dp[i*3+1]<fz+0.04);
  let az=Infinity;for(let i=0;i<A.nv;i++)az=Math.min(az,Ap[i*3+1]);const ahem=[];for(let i=0;i<A.nv;i++)if(Ap[i*3+1]<az+0.03)ahem.push(i);
  const legJ=new Set(R.joints.map((j,k)=>/^(thigh|shin|foot)\./.test(R.nodes[j].name)?k:-1).filter(k=>k>=0));const legs=[],legBone=[],fc={L:[0,0,0,0],R:[0,0,0,0]};for(let i=0;i<B.nv;i++){const d=dominant(B,i);if(!legJ.has(d))continue;legs.push(i);const nm=R.nodes[R.joints[d]].name;legBone.push(nm);
    if(/^foot/.test(nm)){const c=fc[nm.slice(-1)];c[0]+=B.P[i*3];c[1]+=B.P[i*3+1];c[2]+=B.P[i*3+2];c[3]++;}}
  // foot centroid in the foot joint's local frame (inverse of its bind world)
  const footCentroid={};for(const s of ['L','R']){const c=fc[s],p=[c[0]/c[3],c[1]/c[3],c[2]/c[3]],m=W0[R.byName['foot.'+s]];const d=[p[0]-m[12],p[1]-m[13],p[2]-m[14]];
    footCentroid[s]=[m[0]*d[0]+m[1]*d[1]+m[2]*d[2],m[4]*d[0]+m[5]*d[1]+m[6]*d[2],m[8]*d[0]+m[9]*d[1]+m[10]*d[2]];}
  const restRel=(P,ids)=>ids.map(i=>P[i*3+1]-k0);
  return {W0,knee0:k0,hem,ahem,legs,legBone,footCentroid,frontPanel:fp,restHem:restRel(Dp,hem),restAhem:restRel(Ap,ahem),restHemLow:Math.min(...hem.map(i=>Dp[i*3+1]))-k0,restAhemLow:az-k0};}
/** Thigh angle from straight down (deg), max of both legs. */
function thighFromVertical(R,W){let m=0;for(const s of ['L','R']){const a=jpos(R,W,'thigh.'+s),b=jpos(R,W,'shin.'+s),d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);m=Math.max(m,Math.acos(Math.max(-1,Math.min(1,-d[1]/l)))*180/Math.PI);}return m;}
/** Front-hem metrics of the current pose (R.nodes) with morph weights. */
function hemMetrics(R,S,weights){const W=world(R),kL=jpos(R,W,'shin.L'),kR=jpos(R,W,'shin.R'),kz=(kL[1]+kR[1])/2,km=[(kL[0]+kR[0])/2,kz,(kL[2]+kR[2])/2],f=hipsForward(R,W,S.W0);
  const one=(mesh,ids,rest,restLow)=>{const P=skinMesh(R,W,mesh,weights,ids);let low=Infinity,mv=-Infinity,mvI=-1,fl=-Infinity;
    for(let q=0;q<ids.length;q++){const y=P[q*3+1];if(y<low)low=y;const l=(y-kz)-rest[q];if(l>mv){mv=l;mvI=ids[q];}const fw=(P[q*3]-km[0])*f[0]+(P[q*3+2]-km[2])*f[2];if(fw>fl)fl=fw;}
    return {lift:(low-kz)-restLow,belowKnee:kz-low,maxVertLift:mv,vert:mvI,flare:fl};};
  return {dress:one(R.meshes.LOD0_G2_DRESS,S.hem,S.restHem,S.restHemLow),apron:one(R.meshes.LOD0_G2_APRON,S.ahem,S.restAhem,S.restAhemLow),thighDeg:thighFromVertical(R,W),kneeY:kz,W};}
/* ---- leg penetration: a leg / knee / shoe vertex is through the cloth when the cloth surface lies between that vertex and the
 *  centre line of its own limb segment (thigh: hip->knee, shin: knee->ankle, foot: ankle->foot centroid).  Cloth draped over or
 *  around a leg never crosses that short segment; a knee or shoe poking out always does.  Valid in every pose (standing, swing,
 *  seated thighs).  depth = distance from the vertex back to the cloth along that segment.  Triangles binned in a 3 cm grid. ---- */
const CELL=0.03;
function triGrid(P,F){const g=new Map(),c=x=>Math.floor(x/CELL);
  for(let t=0;t<F.length;t+=3){const a=F[t],b=F[t+1],d=F[t+2];const lo=[0,1,2].map(k=>c(Math.min(P[a*3+k],P[b*3+k],P[d*3+k]))),hi=[0,1,2].map(k=>c(Math.max(P[a*3+k],P[b*3+k],P[d*3+k])));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=x+','+y+','+z;let l=g.get(key);if(!l)g.set(key,l=[]);l.push(t);}}
  return {g,P,F};}
function rayTri(o,d,P,a,b,c){const e1=[P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]],e2=[P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]];
  const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return -1;const inv=1/det;
  const s=[o[0]-P[a*3],o[1]-P[a*3+1],o[2]-P[a*3+2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]];
  const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return -1;return (e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;}
function segHit(grid,o,e){const d=[e[0]-o[0],e[1]-o[1],e[2]-o[2]],L=Math.hypot(...d);if(L<1e-5)return -1;const u=d.map(x=>x/L);
  const lo=[0,1,2].map(k=>Math.floor(Math.min(o[k],e[k])/CELL)),hi=[0,1,2].map(k=>Math.floor(Math.max(o[k],e[k])/CELL));let best=-1;const seen=new Set();
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const l=grid.g.get(x+','+y+','+z);if(!l)continue;
    for(const t of l){if(seen.has(t))continue;seen.add(t);const h=rayTri(o,u,grid.P,grid.F[t],grid.F[t+1],grid.F[t+2]);if(h>1e-6&&h<L&&(best<0||h<best)){best=h;grid.lastTri=t;}}}return best;}
const closestOnSeg=(p,a,b)=>{const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l2=ab[0]**2+ab[1]**2+ab[2]**2;let t=l2>0?((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/l2:0;t=Math.max(0,Math.min(1,t));return [a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t];};
/** limb segments of the current pose: per side thigh (hip->knee), shin (knee->ankle), foot (ankle->foot centroid). */
function limbSegs(R,S,W){const out={};for(const s of ['L','R']){const hip=jpos(R,W,'thigh.'+s),kn=jpos(R,W,'shin.'+s),an=jpos(R,W,'foot.'+s),fm=W[R.byName['foot.'+s]],c=S.footCentroid[s];
    const toe=[fm[0]*c[0]+fm[4]*c[1]+fm[8]*c[2]+fm[12],fm[1]*c[0]+fm[5]*c[1]+fm[9]*c[2]+fm[13],fm[2]*c[0]+fm[6]*c[1]+fm[10]*c[2]+fm[14]];
    out['thigh.'+s]=[hip,kn];out['shin.'+s]=[kn,an];out['foot.'+s]=[an,toe];}return out;}
function clothBone(R,mesh,F,t){if(t===undefined)return null;const acc={};for(let k=0;k<3;k++){const i=F[t+k];for(let j=0;j<4;j++){const w=mesh.W[i*4+j];if(w>0){const n=R.nodes[R.joints[mesh.J[i*4+j]]].name;acc[n]=(acc[n]||0)+w;}}}return Object.entries(acc).sort((a,b)=>b[1]-a[1])[0][0];}
/** Pass-through test (b21 run 4): the limb-segment test above misses cloth that has passed wholly BEHIND a limb (both the leg
 *  vertex and its centre line on the outer side of the cloth, e.g. a front panel swung back through the forward shin).  In
 *  standing / walking poses (thigh within 30 deg of vertical) the skirt is a tube around her hips' vertical axis, so every leg
 *  vertex above the cloth's lowest point must reach that axis (horizontal segment at its own height) without crossing cloth.
 *  Seated poses are excluded (lap / seat cloth legitimately lies between the thighs and the axis). */
function axisHits(R,S,weights,W,legP,meshes){W=W||world(R);const L=legP||skinMesh(R,W,R.meshes.LOD0_G2_BODY,weights,S.legs);const hp=jpos(R,W,'hips');let n=0,maxDepth=0,worst=null;const by={};
  for(const [key,mesh,P0,F0] of meshes||[['dress',R.meshes.LOD0_G2_DRESS],['apron',R.meshes.LOD0_G2_APRON]]){const P=P0||skinMesh(R,W,mesh,weights),F=F0||mesh.F,g=triGrid(P,F);let lo=Infinity;for(let q=1;q<P.length;q+=3)if(P[q]<lo)lo=P[q];
    for(let q=0;q<S.legs.length;q++){const o=[L[q*3],L[q*3+1],L[q*3+2]];if(o[1]<lo)continue;const e=[hp[0],o[1],hp[2]];const h=segHit(g,o,e);
      if(h>0){n++;by[key]=(by[key]||0)+1;if(h>maxDepth){maxDepth=h;worst={vertex:S.legs[q],bone:S.legBone[q],mesh:key,test:'axis'};}}}}
  return {n,by,maxDepth,worst};}
/** Leg penetration of the current pose: {count, maxDepth, worst, by:{dress,apron,axis}} (limb-segment test + pass-through test
 *  when the thigh is within 30 deg of vertical). */
function penetration(R,S,weights,W){W=W||world(R);const B=R.meshes.LOD0_G2_BODY;const L=skinMesh(R,W,B,weights,S.legs),seg=limbSegs(R,S,W);
  let count=0,maxDepth=0,worst=null;const by={},panels={};const addP=(k,h)=>{const e=panels[k]||(panels[k]={n:0,max:0});e.n++;if(h>e.max)e.max=h;};
  for(const [key,mesh] of [['dress',R.meshes.LOD0_G2_DRESS],['apron',R.meshes.LOD0_G2_APRON]]){const P=skinMesh(R,W,mesh,weights),grid=triGrid(P,mesh.F);let c=0;
    for(let q=0;q<S.legs.length;q++){const o=[L[q*3],L[q*3+1],L[q*3+2]],sg=seg[S.legBone[q]],e=closestOnSeg(o,sg[0],sg[1]);const h=segHit(grid,o,e);
      if(h>0){c++;count++;const cl=clothBone(R,mesh,grid.F,grid.lastTri);addP(key+':'+cl,h);if(h>maxDepth){maxDepth=h;worst={vertex:S.legs[q],bone:S.legBone[q],mesh:key,tri:grid.lastTri,cloth:cl};}}}by[key]=c;}
  if(thighFromVertical(R,W)<=30){const a=axisHits(R,S,weights,W,L);if(a.n){count+=a.n;by.axis=a.n;for(const k in a.by)for(let i=0;i<a.by[k];i++)addP('axis:'+k,0);if(a.maxDepth>(panels['axis:'+a.worst.mesh]||{max:0}).max)panels['axis:'+a.worst.mesh].max=a.maxDepth;if(a.maxDepth>maxDepth){maxDepth=a.maxDepth;worst=a.worst;}}}
  return {count,maxDepth,worst,by,panels};}
/** Option-B helper (b21): split the lower front panel into two halves.  Every dress/apron vertex weighted to skirt.front.low moves
 *  a share f(x) of that weight to its child skirt.front.low.mid (identity in every authored clip), f = 0 on her right half (x < -band),
 *  1 on her left half (x > band), smoothstep across the centre seam.  Bind pose is unchanged (LBS at bind = identity), so the rest look
 *  is byte-identical in shape; the re-bake can then pitch each half over its own knee.  Vertices without a free influence slot drop
 *  their smallest influence (renormalised).  Mutates R.meshes; returns per-mesh {J,W} arrays for the GLB writer. */
function splitFront(R,band=0.03){const lo=R.joints.indexOf(R.byName['skirt.front.low']),lm=R.joints.indexOf(R.byName['skirt.front.low.mid']);const out={};
  for(const k of ['LOD0_G2_DRESS','LOD0_G2_APRON']){const m=R.meshes[k];let moved=0;
    for(let i=0;i<m.nv;i++){let sl=-1,sm=-1;for(let j=0;j<4;j++){if(m.J[i*4+j]===lo&&m.W[i*4+j]>0)sl=j;if(m.J[i*4+j]===lm&&m.W[i*4+j]>0)sm=j;}if(sl<0)continue;
      const x=m.P[i*3],u=Math.max(0,Math.min(1,(x+band)/(2*band))),f=u*u*(3-2*u);if(f<=0)continue;const w=m.W[i*4+sl]*f;
      if(sm<0){for(let j=0;j<4;j++)if(!(m.W[i*4+j]>0)){sm=j;break;}if(sm<0){let jm=-1;for(let j=0;j<4;j++)if(j!==sl&&(jm<0||m.W[i*4+j]<m.W[i*4+jm]))jm=j;const drop=m.W[i*4+jm];m.W[i*4+jm]=0;sm=jm;
        let t=0;for(let j=0;j<4;j++)t+=m.W[i*4+j];for(let j=0;j<4;j++)m.W[i*4+j]*=(t+drop)/t;}m.J[i*4+sm]=lm;m.W[i*4+sm]=0;}
      const w2=m.W[i*4+sl]*f;m.W[i*4+sl]-=w2;m.W[i*4+sm]+=w2;moved++;}
    out[k]={J:Uint8Array.from(m.J),W:Float32Array.from(m.W),moved};}return out;}
/** Replace rotation channels of clips: spec {clip: {nodeName: {times, values}}} (negative-test fixtures). */
function overrideChannels(R,spec){for(const clip in spec)for(const name in spec[clip]){const c=R.clips[clip].channels.find(x=>x.path==='rotation'&&R.nodes[x.node].name===name);if(!c)throw Error('no channel '+clip+' '+name);
    c.inp=Float64Array.from(spec[clip][name].times);c.out=Float64Array.from(spec[clip][name].values);c.n=4;c.step=false;}}
/** Pin joints of a clip to their rest rotation (the "no skirt solve" negative pose). */
function restChannels(R,clip,names){const C=R.clips[clip];for(const name of names){const i=R.byName[name];if(i===undefined)continue;
    for(const c of C.channels.filter(x=>x.node===i&&(x.path==='rotation'||x.path==='scale'))){const v=c.path==='rotation'?R.rest[i].q:R.rest[i].s;c.inp=Float64Array.from([0,C.duration]);c.out=Float64Array.from([...v,...v]);c.n=v.length;c.step=false;}}}

function loadMeta(file=META){return JSON.parse(fs.readFileSync(file,'utf8'));}
/** Morph weights of a single clip played alone (CharacterMotion.morphWeights semantics for plan={base}); used by the Blender-parity path. */
function clipMorph(meta,clip,t){const c=meta.clips[clip]&&meta.clips[clip].morph&&meta.clips[clip].morph.curves;const o={};if(!c)return o;
  for(const k in c){const p=c[k];let v=p[0][1];if(t>=p[p.length-1][0])v=p[p.length-1][1];else for(let i=1;i<p.length;i++)if(t<=p[i][0]){const a=p[i-1],b=p[i];v=a[1]+(b[1]-a[1])*(t-a[0])/Math.max(b[0]-a[0],1e-9);break;}o[k]=Math.max(0,Math.min(1,v));}return o;}
/** LCG uneven dt in [1/90, 1/45] (same generator family as the camera gates). */
function lcg(seed=12345){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return 1/90+(s/4294967296)*(1/45-1/90);};}
/** Frame times of a clip for a dt mode: 60, 30 or 'uneven'. Always includes the clip end. */
function times(dur,mode,seed){const out=[];if(mode==='uneven'){const r=lcg(seed);let t=0;while(t<dur){out.push(t);t+=r();}}else{const n=Math.round(dur*mode);for(let k=0;k<=n;k++)out.push(Math.min(k/mode,dur));}if(out[out.length-1]<dur)out.push(dur);return out;}
module.exports={axisHits,overrideChannels,restChannels,splitFront,_triGrid:triGrid,_segHit:segHit,_closestOnSeg:closestOnSeg,_limbSegs:limbSegs,GLB,META,ROOT,parseGlb,load,sampleChannel,applyClip,resetRest,world,skinMesh,sets,hemMetrics,penetration,thighFromVertical,loadMeta,clipMorph,times,lcg,jpos,qmul};
