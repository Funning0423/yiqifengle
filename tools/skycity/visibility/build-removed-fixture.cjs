'use strict';
/* b19 skycity face budget: the faces 9e84571d removed from env_skycity (vs 8557f895) -> removed-faces.json.gz.
 * Faces are matched by their three decoded vertex positions (1e-4 m). Zero-area faces are skipped (never rasterised).
 * Usage: DRACO3D=... node tools/skycity/visibility/build-removed-fixture.cjs [beforeRev=8557f895] [afterRev=9e84571d] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../..'),{decode}=require(ROOT+'/tools/camera-frame-test/glb_geometry.cjs');
const GLB='creator-build-project/assets/bundles/region_skycity/env_skycity.glb';
const [A='8557f895',B='9e84571d']=process.argv.slice(2);
const dump=rev=>{const f=path.join(os.tmpdir(),`skyvis-${rev}.glb`);fs.writeFileSync(f,cp.execFileSync('git',['show',`${rev}:${GLB}`],{cwd:ROOT,maxBuffer:1<<28}));return f;};
const key=t=>t.map(v=>v.map(x=>x.toFixed(4)).join(',')).sort().join('|');
const area=t=>{const u=[0,1,2].map(i=>t[1][i]-t[0][i]),v=[0,1,2].map(i=>t[2][i]-t[0][i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;};
(async()=>{
 const a=await decode(dump(A)),b=await decode(dump(B));if(!a||!b)throw Error('draco3d not found: set DRACO3D');
 const out={format:'skycity-removed-faces/1',before:A,after:B,beforeSha:a.sha,afterSha:b.sha,meshes:{}};let n=0;
 for(const [name,tris] of Object.entries(a.meshes)){
  const keep=new Map();for(const t of b.meshes[name]||[]){const k=key(t);keep.set(k,(keep.get(k)||0)+1);}
  const rm=[];for(const t of tris){const k=key(t),c=keep.get(k)||0;if(c){keep.set(k,c-1);continue;}if(area(t)<1e-7)continue;rm.push(t.flat().map(x=>+x.toFixed(4)));}
  if(rm.length){out.meshes[name]=rm;n+=rm.length;}
 }
 out.faces=n;fs.writeFileSync(path.join(__dirname,'removed-faces.json.gz'),zlib.gzipSync(JSON.stringify(out),{level:9}));
 console.log(JSON.stringify({faces:n,perMesh:Object.fromEntries(Object.entries(out.meshes).map(([k,v])=>[k,v.length]))}));
})().catch(e=>{console.error(e);process.exit(1);});
