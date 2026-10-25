'use strict';
/* b19 skycity visibility regression: no camera may see through the holes left by the face-budget cut (9e84571d).
 * For every camera (repo cameras collected at run time, see visibility/cams.cjs, plus --extra / --cam) and every sample point of every
 * removed face (visibility/removed-faces.json.gz; centroid, 3 inset corners, 3 edge midpoints): if the point is inside the camera view and
 * the segment camera→point is not blocked by the CURRENT env_skycity solids (stopping 3 cm short), the camera looks through a hole -> FAIL.
 * Usage (DRACO3D=<draco3d dir> if not vendored):
 *   node tools/skycity/test_skycity_visibility.cjs [--full] [--extra cams.json] [--cam px,py,pz,lx,ly,lz[,fov[,aspect]]] [--world] [--no-repo] [--workers N] [--json out.json]
 * See tools/skycity/VISIBILITY_TEST.md. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),os=require('node:os');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const ROOT=path.resolve(__dirname,'../..'),V=path.join(__dirname,'visibility');
const GLB=ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb';
// non-blockers (same rules as the analysis that chose the cut): character, state toggles, clouds/mist, skinned ropes/props, alpha cards
const NOT_SOLID=/^(chr_|state_|env_sky_cloud|env_sky_cumulus|env_sky_waterfall_mist|env_sky_rope_roots|env_sky_ambient_props)|cards/;
const EPS=0.03;
async function solids(){const {decode}=require(ROOT+'/tools/camera-frame-test/glb_geometry.cjs');const g=await decode(GLB);if(!g)throw Error('draco3d not found: set DRACO3D');
 let n=0;for(const [k,t] of Object.entries(g.meshes))if(!NOT_SOLID.test(k))n+=t.length;const f=new Float64Array(n*9);let o=0;
 for(const [k,t] of Object.entries(g.meshes)){if(NOT_SOLID.test(k))continue;for(const tri of t)for(const v of tri){f[o++]=v[0];f[o++]=v[1];f[o++]=v[2];}}return {tris:f,sha:g.sha};}
function samples(){const fx=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(V,'removed-faces.json.gz'))));const P=[],face=[];
 for(const [m,list] of Object.entries(fx.meshes))list.forEach((t,i)=>{const a=t.slice(0,3),b=t.slice(3,6),c=t.slice(6,9),ce=[0,1,2].map(k=>(a[k]+b[k]+c[k])/3);
  const pts=[ce,...[a,b,c].map(v=>v.map((x,k)=>x+(ce[k]-x)*.1)),[0,1,2].map(k=>(a[k]+b[k])/2),[0,1,2].map(k=>(b[k]+c[k])/2),[0,1,2].map(k=>(c[k]+a[k])/2)];
  for(const p of pts){P.push(...p);face.push(`${m}#${i}`);}});
 return {P:new Float64Array(P),face,fx};}
function basis(c){const f=[0,1,2].map(k=>c.target[k]-c.position[k]),l=Math.hypot(...f);f.forEach((_,k)=>f[k]/=l);let r=[f[2],0,-f[0]];const rl=Math.hypot(...r)||1;r=r.map(x=>x/rl);
 // Cocos/OpenGL: right = forward x up
 r=[-r[0],-r[1],-r[2]];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];return {f,r,u};}
function scan(bv,cams,S,anyHit){const hits=[];const P=S.P,n=P.length/3,o=[0,0,0],d=[0,0,0];
 for(const c of cams){const {f,r,u}=basis(c),ty=Math.tan((c.fovVerticalDeg||48)*Math.PI/360)*1.02,tx=ty*(c.aspect||1),cone=c.cone?Math.cos(c.cone*Math.PI/180):null;
  o[0]=c.position[0];o[1]=c.position[1];o[2]=c.position[2];let first=null,cnt=0;
  for(let i=0;i<n;i++){const vx=P[i*3]-o[0],vy=P[i*3+1]-o[1],vz=P[i*3+2]-o[2],z=vx*f[0]+vy*f[1]+vz*f[2];if(z<=0.05)continue;const L=Math.hypot(vx,vy,vz);
   let sx,sy;if(cone!==null){if(z/L<cone)continue;sx=(vx*r[0]+vy*r[1]+vz*r[2])/z;sy=(vx*u[0]+vy*u[1]+vz*u[2])/z;}
   else{sx=(vx*r[0]+vy*r[1]+vz*r[2])/z/tx;sy=(vx*u[0]+vy*u[1]+vz*u[2])/z/ty;if(sx<-1||sx>1||sy<-1||sy>1)continue;}
   d[0]=vx/L;d[1]=vy/L;d[2]=vz/L;if(anyHit(bv,o,d,1e-3,L-EPS))continue;
   cnt++;if(!first)first={face:S.face[i],point:[P[i*3],P[i*3+1],P[i*3+2]].map(v=>+v.toFixed(3)),distM:+L.toFixed(2),
    screen:cone!==null?{coneTanX:+sx.toFixed(3),coneTanY:+sy.toFixed(3)}:{x01:+((sx+1)/2).toFixed(3),y01_fromTop:+((1-sy)/2).toFixed(3)}};}
  if(cnt)hits.push({tag:c.tag,at:c.at,position:c.position.map(v=>+v.toFixed(3)),target:c.target.map(v=>+v.toFixed(3)),seenSamples:cnt,first});}
 return hits;}
if(!isMainThread){(async()=>{const {build,anyHit}=require(path.join(V,'bvh.cjs'));const g=await solids();const bv=build(g.tris);const S=samples();
  parentPort.postMessage(scan(bv,workerData.cams,S,anyHit));})().catch(e=>{parentPort.postMessage({error:String(e.stack||e)});});return;}
const argv=process.argv.slice(2),has=k=>argv.includes(k),val=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;},vals=k=>argv.flatMap((a,i)=>a===k?[argv[i+1]]:[]);
(async()=>{const t0=Date.now(),fast=!has('--full'),{build,firstHit}=require(path.join(V,'bvh.cjs')),C=require(path.join(V,'cams.cjs'));
 const g=await solids(),bv=build(g.tris),S=samples();let cams=[],anchors=C.anchors();
 const H=require(ROOT+'/tools/board-ui/harness.cjs').createHarness(),BF=H.load('region/BalloonFlight.ts'),toLocal=p=>BF.unapplyRigid(BF.CW_JSON,p);
 if(!has('--no-repo')){const r=await C.repoCams({dt:fast?0.5:0.25});cams=r.cams;
  const piv=C.orbitPivots(anchors,fast?6:3),rays=C.orbitRays(piv,fast?40:20);let kept=0;
  for(const q of rays){const h=firstHit(bv,q.look,q.u,q.d+0.5),d=Math.min(q.d,h-0.3);if(d<=1)continue;kept++;
   cams.push({tag:'orbit',at:q.at,position:[0,1,2].map(k=>q.look[k]+q.u[k]*d),target:q.look,cone:45});}}
 const extra=[];for(const f of vals('--extra')){const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const c of (Array.isArray(j)?j:j.cams))extra.push({...c,src:f});}
 for(const s of vals('--cam')){const v=s.split(',').map(Number);extra.push({position:v.slice(0,3),target:v.slice(3,6),fovVerticalDeg:v[6]||48,aspect:v[7]||390/844,src:'--cam'});}
 extra.forEach((c,i)=>{const w=has('--world')||c.frame==='world';const p=c.pos||c.position,l=c.lookAt||c.target;
  cams.push({tag:c.tag||'extra',at:c.at||`${c.src}[${i}]`,position:w?toLocal(p):p,target:w?toLocal(l):l,fovVerticalDeg:c.fov||c.fovVerticalDeg||48,aspect:c.aspect||390/844,cone:c.cone});});
 const counts={};for(const c of cams)counts[c.tag]=(counts[c.tag]||0)+1;
 const NW=+(val('--workers')||Math.max(1,Math.min(8,os.cpus().length))),chunks=Array.from({length:NW},()=>[]);cams.forEach((c,i)=>chunks[i%NW].push(c));
 const res=await Promise.all(chunks.map(ch=>new Promise((ok,no)=>{const w=new Worker(__filename,{workerData:{cams:ch}});w.once('message',m=>m.error?no(Error(m.error)):ok(m));w.once('error',no);})));
 const hits=res.flat();
 // canary: a camera known to look through a hole must be reported, otherwise the ray test itself is broken
 const {anyHit}=require(path.join(V,'bvh.cjs')),can=JSON.parse(fs.readFileSync(path.join(V,'canary-cams.json'),'utf8')).cams.map(c=>({tag:c.tag,at:c.at,position:c.pos,target:c.lookAt,fovVerticalDeg:c.fov,aspect:c.aspect}));
 const canHits=scan(bv,can,S,anyHit),canaryOk=canHits.length===can.length;
 const secs=+((Date.now()-t0)/1000).toFixed(1);
 const rep={status:hits.length||!canaryOk?'FAIL':'PASS',canary:canaryOk?'detected (ok)':'NOT DETECTED - ray test broken',mode:fast?'fast':'full',seconds:secs,removedFaces:S.fx.faces,samples:S.P.length/3,solidTris:g.tris.length/9,glbSha:g.sha,cams:cams.length,camsByTag:counts,
  holesSeenBy:hits.length,hits:hits.slice(0,50)};
 if(val('--json'))fs.writeFileSync(val('--json'),JSON.stringify({...rep,hits},null,1));
 console.log(JSON.stringify(rep,null,1));process.exit(hits.length||!canaryOk?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
