'use strict';
/* QA-only (not shipped): decodes the KHR_draco_mesh_compression triangles of combined_visual_m.glb in WORLD space
 * (glTF Y-up == Cocos world; scene_root is identity) and answers lens-clearance and line-of-sight queries.
 * draco3d 1.5.7 is resolved from $DRACO3D, ./node_modules/draco3d, ../vendor-node/node_modules/draco3d, or the GGbot
 * worktree vendor (work/GGbot/tools/vendor-node). Decoded triangles are cached next to the OS tmpdir by GLB sha256. */
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const GLB=path.join(ROOT,'creator-build-project/assets/bundles/region_island/combined_visual_m.glb');
function dracoDir(){const c=[process.env.DRACO3D,path.join(__dirname,'node_modules/draco3d'),path.join(ROOT,'tools/vendor-node/node_modules/draco3d'),
  path.resolve(ROOT,'../GGbot/tools/vendor-node/node_modules/draco3d')].filter(Boolean);for(const d of c)if(fs.existsSync(path.join(d,'draco3d.js')))return d;return null;}
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot=(q,v)=>{const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
async function decode(glbPath=GLB){
  const raw=fs.readFileSync(glbPath),sha=crypto.createHash('sha256').update(raw).digest('hex');
  const cache=path.join(os.tmpdir(),'camtest-tris-'+sha.slice(0,16)+'.json');
  if(fs.existsSync(cache))return {sha,...JSON.parse(fs.readFileSync(cache,'utf8'))};
  const dir=dracoDir();if(!dir)return null;
  const draco=require(path.join(dir,'draco3d.js')),version=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version;
  const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
  const dec=await draco.createDecoderModule({});const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
  const world=i=>{let t=[0,0,0],r=[0,0,0,1],s=[1,1,1];for(let k=i;k!==undefined;k=parent[k]){const n=doc.nodes[k];if(n.matrix)throw Error('matrix nodes unsupported: '+n.name);
    const nt=n.translation||[0,0,0],nr=n.rotation||[0,0,0,1],ns=n.scale||[1,1,1];const st=qrot(nr,[t[0]*ns[0],t[1]*ns[1],t[2]*ns[2]]);t=[st[0]+nt[0],st[1]+nt[1],st[2]+nt[2]];r=qmul(nr,r);s=[s[0]*ns[0],s[1]*ns[1],s[2]*ns[2]];}return {t,r,s};};
  const meshes={};
  doc.nodes.forEach((node,i)=>{if(node.mesh===undefined)return;const X=world(i),tris=[];
    for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions?.KHR_draco_mesh_compression;if(!ext)continue;
      const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
      const d=new dec.Decoder(),buf=new dec.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
      const mesh=new dec.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco decode failed '+node.name);
      const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new dec.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attr,pos);
      const P=[];for(let v=0;v<nv;v++){const l=[pos.GetValue(v*3)*X.s[0],pos.GetValue(v*3+1)*X.s[1],pos.GetValue(v*3+2)*X.s[2]],w=qrot(X.r,l);P.push([+(w[0]+X.t[0]).toFixed(5),+(w[1]+X.t[1]).toFixed(5),+(w[2]+X.t[2]).toFixed(5)]);}
      const face=new dec.DracoInt32Array();for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);tris.push([P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]]);}
      [pos,face,mesh,buf,d].forEach(o=>dec.destroy(o));}
    if(tris.length)meshes[node.name]=(meshes[node.name]||[]).concat(tris);});
  const out={decoder:{name:'draco3d',version},meshes};fs.writeFileSync(cache,JSON.stringify(out));return {sha,...out};
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function closest(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a);const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v];}const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w];}const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return [b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w];}const den=1/(va+vb+vc),v=vb*den,w=vc*den;return [a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w];}
/** Non-solid / non-colliding render layers: sky dome, sea, clouds, glass, beams, fx and the dynamic door leaf. */
const IGNORE=/^(env_sky|env_sea|env_cloud|env_chimney_smoke|env_anim_seagull_fly|env_foam|fx_|env_moon|env_lighthouse_door$|env_window_blind_cards|.*glass|.*beam|.*glow)/;
function index(geo,{ignore=IGNORE,cell=.3}={}){const grid=new Map(),key=(i,j,k)=>i+','+j+','+k;let count=0;
  for(const name of Object.keys(geo.meshes)){if(ignore.test(name))continue;for(const t of geo.meshes[name]){const tr={name,t,min:[0,1,2].map(k=>Math.min(t[0][k],t[1][k],t[2][k])),max:[0,1,2].map(k=>Math.max(t[0][k],t[1][k],t[2][k]))};count++;
    for(let i=Math.floor(tr.min[0]/cell);i<=Math.floor(tr.max[0]/cell);i++)for(let j=Math.floor(tr.min[1]/cell);j<=Math.floor(tr.max[1]/cell);j++)for(let k=Math.floor(tr.min[2]/cell);k<=Math.floor(tr.max[2]/cell);k++){const kk=key(i,j,k);let a=grid.get(kk);if(!a)grid.set(kk,a=[]);a.push(tr);}}}
  function clearance(p,R=.6){let best=R,who=null;const seen=new Set(),r=Math.ceil(R/cell),ci=Math.floor(p[0]/cell),cj=Math.floor(p[1]/cell),ck=Math.floor(p[2]/cell);
    for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++)for(let k=ck-r;k<=ck+r;k++){const a=grid.get(key(i,j,k));if(!a)continue;for(const tr of a){if(seen.has(tr))continue;seen.add(tr);
      if(p[0]<tr.min[0]-best||p[0]>tr.max[0]+best||p[1]<tr.min[1]-best||p[1]>tr.max[1]+best||p[2]<tr.min[2]-best||p[2]>tr.max[2]+best)continue;const q=closest(p,...tr.t),d=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);if(d<best){best=d;who=tr.name;}}}
    return {d:best,who};}
  /** First mesh hit strictly between a and b (ignoring 5 cm at the far end), or null. */
  function occluded(a,b){const d=sub(b,a),L=Math.hypot(...d),dir=d.map(v=>v/L),seen=new Set(),steps=Math.ceil(L/cell)*2;
    for(let s=0;s<=steps;s++){const p=a.map((v,i)=>v+d[i]*s/steps),arr=grid.get(key(Math.floor(p[0]/cell),Math.floor(p[1]/cell),Math.floor(p[2]/cell)));if(!arr)continue;
      for(const tr of arr){if(seen.has(tr))continue;seen.add(tr);const [v0,v1,v2]=tr.t,e1=sub(v1,v0),e2=sub(v2,v0),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;
        const f=1/det,sv=sub(a,v0),u=f*dot(sv,h);if(u<0||u>1)continue;const q=cross(sv,e1),v=f*dot(dir,q);if(v<0||u+v>1)continue;const t=f*dot(e2,q);if(t>1e-3&&t<L-.05)return tr.name;}}
    return null;}
  return {clearance,occluded,triangles:count};
}
module.exports={decode,index,GLB,dracoDir};
if(require.main===module)decode().then(g=>{if(!g){console.log('draco3d not found');process.exit(2);}const I=index(g);console.log(JSON.stringify({sha:g.sha.slice(0,16),decoder:g.decoder,meshes:Object.keys(g.meshes).length,indexed:I.triangles,
  homeClearance:I.clearance([-1.317,1.386,-2.111])}));});
