'use strict';
/** QA-only: evaluate a glTF animation (LINEAR/STEP; rotation nlerp) on the island GLB node tree and return world-space
 * node origins over the clip. Used for animated, non-collision props the lens can still fly into (Mac round 3 night:
 * env_anim_seagull_fly_0x_v22 orbiting on the GLB idle_loop - its phase at runtime is NOT tied to the flow clock, so
 * checks must use the WHOLE loop as an envelope). */
const fs=require('fs'),G=require('./glb_geometry.cjs');
function load(glbPath=G.GLB){const raw=fs.readFileSync(glbPath),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),bin=raw.subarray(20+jl+8);
  const acc=i=>{const a=doc.accessors[i],bv=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type],o=(bv.byteOffset||0)+(a.byteOffset||0),st=bv.byteStride||n*4,out=[];
    for(let k=0;k<a.count;k++){const v=[];for(let c=0;c<n;c++)v.push(bin.readFloatLE(o+k*st+c*4));out.push(n===1?v[0]:v);}return out;};
  const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));return {doc,acc,parent};}
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3],uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
function sampler(L,anim){const ch={};for(const c of anim.channels){const s=anim.samplers[c.sampler];(ch[c.target.node]||(ch[c.target.node]={}))[c.target.path]={t:L.acc(s.input),v:L.acc(s.output),step:s.interpolation==='STEP'};}
  const ev=(k,t)=>{const T=k.t,n=T.length;if(t<=T[0])return k.v[0];if(t>=T[n-1])return k.v[n-1];let i=1;while(T[i]<t)i++;const u=k.step?0:(t-T[i-1])/(T[i]-T[i-1]),a=k.v[i-1],b=k.v[i];
    if(a.length===4){const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],sg=d<0?-1:1,q=a.map((x,j)=>x*(1-u)+b[j]*sg*u),l=Math.hypot(...q);return q.map(x=>x/l);}return a.map((x,j)=>x+(b[j]-x)*u);};
  return (node,t)=>{const c=ch[node]||{},n=L.doc.nodes[node];return {t:c.translation?ev(c.translation,t):n.translation||[0,0,0],r:c.rotation?ev(c.rotation,t):n.rotation||[0,0,0,1],s:c.scale?ev(c.scale,t):n.scale||[1,1,1]};};}
/** World position of local point p on `node` at clip time t. */
function worldPoint(L,S,node,t,p=[0,0,0]){let v=p.slice();for(let k=node;k!==undefined;k=L.parent[k]){const x=S(k,t);v=qrot(x.r,[v[0]*x.s[0],v[1]*x.s[1],v[2]*x.s[2]]);v=[v[0]+x.t[0],v[1]+x.t[1],v[2]+x.t[2]];}return v;}
/** Envelope of animated movers: for each node matching `rx`, its origin plus `pts` local points sampled every dt over the clip. */
function envelope(rx=/^env_anim_seagull_fly_0\d_v22$/,{clip='idle_loop',dt=1/30,pts=[[0,0,0],[-0.55,0,0],[0.55,0,0],[0,0,0.29],[0,0,-0.21]]}={}){
  const L=load(),a=L.doc.animations.find(x=>x.name===clip)||L.doc.animations[0],S=sampler(L,a);let len=0;for(const s of a.samplers){const t=L.acc(s.input);len=Math.max(len,t[t.length-1]);}
  const out=[];L.doc.nodes.forEach((n,i)=>{if(!rx.test(n.name||''))return;for(let t=0;t<len;t+=dt)for(const p of pts)out.push({node:n.name,t:+t.toFixed(3),p:worldPoint(L,S,i,t,p)});});
  return {clip:a.name,seconds:len,points:out};}
module.exports={load,sampler,worldPoint,envelope};
if(require.main===module&&!process.argv.includes('--sweep')){const e=envelope();const ys=e.points.map(p=>p.p[1]);console.log(e.clip,e.seconds,e.points.length,'y',Math.min(...ys).toFixed(2),Math.max(...ys).toFixed(2));
  for(const n of new Set(e.points.map(p=>p.node))){const q=e.points.filter(p=>p.node===n&&p.t%3<1/30);console.log(n,q.filter((_,i)=>i%5===0).map(p=>p.t+':'+p.p.map(v=>v.toFixed(1)).join(',')).join(' '));}}

// ---- Animated-mesh sweep (movers + sway) ----------------------------------------------------------------------------
/** Mesh nodes moved by the GLB idle_loop (their node/ancestor is animated, or their skin's joints are). The static ray index
 * (glb_geometry.decode) poses everything at REST and ignores env_anim_seagull_fly entirely, so a frond's sway or a flying
 * gull never reached the lens checks. `exclude`: non-solid layers (glb_geometry IGNORE minus the flying gulls) and the room
 * interior (architecture; checked separately). */
const MOVER_EXCLUDE=/^(env_sky|env_sea|env_cloud|env_chimney_smoke|env_foam|fx_|env_moon|env_int_anim_|.*glass|.*beam|.*glow)/;
async function decodeMovers(glbPath=G.GLB,{exclude=MOVER_EXCLUDE,include=/./,clip='idle_loop'}={}){
  const L=load(glbPath),doc=L.doc,a=doc.animations.find(x=>x.name===clip)||doc.animations[0],S=sampler(L,a),an=new Set(a.channels.map(c=>c.target.node));
  let seconds=0;for(const s of a.samplers){const t=L.acc(s.input);seconds=Math.max(seconds,t[t.length-1]);}
  const animatedChain=i=>{for(let k=i;k!==undefined;k=L.parent[k])if(an.has(k))return true;return false;};
  const dir=G.dracoDir();if(!dir)return null;const draco=require(require('path').join(dir,'draco3d.js')),dec=await draco.createDecoderModule({});
  const raw=fs.readFileSync(glbPath),jl=raw.readUInt32LE(12),bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl)),items=[];
  doc.nodes.forEach((node,i)=>{if(node.mesh===undefined||exclude.test(node.name||'')||!include.test(node.name||''))return;const skin=node.skin!==undefined?doc.skins[node.skin]:null;
    if(!(animatedChain(i)||(skin&&skin.joints.some(j=>animatedChain(j)))))return;
    for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
      const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),d=new dec.Decoder(),buf=new dec.DecoderBuffer();
      buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new dec.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco decode failed '+node.name);
      const get=(id,n)=>{if(id===undefined)return null;const at=d.GetAttributeByUniqueId(mesh,id),v=new dec.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,at,v);const o=new Float64Array(mesh.num_points()*n);for(let k=0;k<o.length;k++)o[k]=v.GetValue(k);dec.destroy(v);return o;};
      const P=get(ext.attributes.POSITION,3),Jt=skin?get(ext.attributes.JOINTS_0,4):null,W=skin?get(ext.attributes.WEIGHTS_0,4):null,faces=[],f=new dec.DracoInt32Array();
      for(let k=0;k<mesh.num_faces();k++){d.GetFaceFromMesh(mesh,k,f);faces.push([f.GetValue(0),f.GetValue(1),f.GetValue(2)]);}
      [f,mesh,buf,d].forEach(o=>dec.destroy(o));items.push({name:node.name,node:i,skin,P,J:Jt,W,faces});}});
  // 4x4 column-major
  const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
  const trs=x=>{const [qx,qy,qz,qw]=x.r,[sx,sy,sz]=x.s,t=x.t;return [(1-2*(qy*qy+qz*qz))*sx,2*(qx*qy+qz*qw)*sx,2*(qx*qz-qy*qw)*sx,0,2*(qx*qy-qz*qw)*sy,(1-2*(qx*qx+qz*qz))*sy,2*(qy*qz+qx*qw)*sy,0,2*(qx*qz+qy*qw)*sz,2*(qy*qz-qx*qw)*sz,(1-2*(qx*qx+qy*qy))*sz,0,t[0],t[1],t[2],1];};
  const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
  const ibm=new Map();const IBM=sk=>{if(ibm.has(sk))return ibm.get(sk);const A=doc.accessors[sk.inverseBindMatrices],bv=doc.bufferViews[A.bufferView],o=(bv.byteOffset||0)+(A.byteOffset||0);
    const m=sk.joints.map((_,k)=>Array.from({length:16},(_,e)=>bin.readFloatLE(o+(k*16+e)*4)));ibm.set(sk,m);return m;};
  /** Triangles of every mover at clip time t: {name: [[a,b,c],...]} (world space). */
  function poseAt(t){const cache=new Map(),glob=i=>{if(cache.has(i))return cache.get(i);let M=trs(S(i,t));if(L.parent[i]!==undefined)M=mul(glob(L.parent[i]),M);cache.set(i,M);return M;};
    const out={};for(const it of items){const n=it.P.length/3,V=new Array(n);
      if(it.skin){const JM=it.skin.joints.map((j,k)=>mul(glob(j),IBM(it.skin)[k]));
        for(let v=0;v<n;v++){const l=[it.P[v*3],it.P[v*3+1],it.P[v*3+2]];let w=[0,0,0],sw=0;
          if(it.J&&it.W)for(let k=0;k<4;k++){const wt=it.W[v*4+k];if(!(wt>0))continue;const q=xf(JM[Math.round(it.J[v*4+k])]||JM[0],l);w=[w[0]+q[0]*wt,w[1]+q[1]*wt,w[2]+q[2]*wt];sw+=wt;}
          V[v]=sw>0?w.map(x=>x/sw):xf(JM[0],l);}}
      else{const M=glob(it.node);for(let v=0;v<n;v++)V[v]=xf(M,[it.P[v*3],it.P[v*3+1],it.P[v*3+2]]);}
      const tri=it.faces.map(f=>[V[f[0]],V[f[1]],V[f[2]]]);out[it.name]=(out[it.name]||[]).concat(tri);}
    return out;}
  return {clip:a.name,seconds,names:[...new Set(items.map(i=>i.name))],poseAt};}
/** Swept envelope over the whole loop: union of poseAt(t) for t = 0, dt, 2dt ... (phase-agnostic: the runtime clip phase is
 * not tied to the flow clock). Mesh names get '@sweep'. Flying gulls (~3.1 m/s on a 6 m orbit) are sampled every
 * flyerDt (1/15 s = 0.2 m, below their 0.5 m body / 1.1 m span, so the band has no gaps); everything else (palm sway,
 * ground animals: slow) every dt. */
const FLYERS=/^env_anim_seagull_fly/;
async function sweep(glbPath=G.GLB,{dt=0.25,flyerDt=1/15}={}){const meshes={},out={phases:{},names:[]};
  for(const [inc,step,key] of [[FLYERS,flyerDt,'flyers'],[new RegExp('^(?!'+FLYERS.source.slice(1)+')'),dt,'sway']]){const M=await decodeMovers(glbPath,{include:inc});if(!M)return null;
    let n=0;for(let t=0;t<M.seconds-1e-6;t+=step){n++;const p=M.poseAt(t);for(const k of Object.keys(p))(meshes[k+'@sweep']||(meshes[k+'@sweep']=[])).push(...p[k]);}
    out.clip=M.clip;out.seconds=M.seconds;out.phases[key]=n+' x '+(+step.toFixed(4))+' s';out.names.push(...M.names);}
  return {...out,meshes};}
module.exports.decodeMovers=decodeMovers;module.exports.sweep=sweep;module.exports.MOVER_EXCLUDE=MOVER_EXCLUDE;
