'use strict';
// T0 timing (Mac r4 issue 3): cost of finding the lighthouse tap point in island-idle, OLD grid vs NEW projection pick.
// REAL geometry: env_lighthouse_ext / env_lighthouse_door / env_interior_shell triangles from the game's combined_visual_m.glb
// (world space, decoded by <game>/tools/camera-frame-test/glb_geometry.cjs) and the REAL island camera (flow_sim, state island).
// Ray test mimics Cocos 3.8.8 geometry.intersect.rayModel (ERaycastMode.ANY, doubleSided): world-AABB reject, then every
// triangle until the first hit; targets tried in WorldFlowComponent order (ext, door, interior shell), stop at first hit.
// The point picks reproduce GrokbotAutoplay.lhGrid (centroid rule) / lhProjected (centre, then 5x5 nearest-first, first hit).
// usage: node bench_lighthouse_pick.cjs --root <game worktree> [--w 390 --h 844 --reps 5]
const path=require('path'),args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const ROOT=path.resolve(opt('--root','.')),W=+opt('--w',390),H=+opt('--h',844),REPS=+opt('--reps',5);
const G=require(path.join(ROOT,'tools/camera-frame-test/glb_geometry.cjs')),S=require(path.join(ROOT,'tools/camera-frame-test/flow_sim.cjs'));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rot=(q,v)=>{const [x,y,z,w]=q,t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];};
(async()=>{
  const geo=await G.decode();if(!geo)throw Error('draco3d not found (see glb_geometry.cjs)');
  const NAMES=['env_lighthouse_ext','env_lighthouse_door','env_interior_shell'];
  const models=NAMES.map(n=>{const tris=geo.meshes[n];if(!tris)throw Error('missing mesh '+n);const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(const t of tris)for(const v of t)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k]);}
    return {name:n,tris:tris.map(t=>({v0:t[0],e1:sub(t[1],t[0]),e2:sub(t[2],t[0])})),mn,mx};});
  const env=S.create(),run=await S.run(env),isl=run.frames.filter(f=>f.state==='island');const cam=isl[Math.floor(isl.length/2)].cam;
  const q=cam.rotation,tanV=Math.tan(cam.fovVerticalDeg*Math.PI/360),asp=W/H;let tested=0;
  const ray=(cx,cy)=>{const nx=(2*cx/W-1)*tanV*asp,ny=(1-2*cy/H)*tanV,d=rot(q,[nx,ny,-1]),L=Math.hypot(...d);return {o:cam.position,d:d.map(v=>v/L)};};
  const rayAABB=(r,mn,mx)=>{let t0=0,t1=500;for(let k=0;k<3;k++){const inv=1/r.d[k];let a=(mn[k]-r.o[k])*inv,b=(mx[k]-r.o[k])*inv;if(a>b)[a,b]=[b,a];t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return false;}return true;};
  const rayModel=(r,m)=>{if(!rayAABB(r,m.mn,m.mx))return false;for(const t of m.tris){tested++;const h=cross(r.d,t.e2),det=dot(t.e1,h);if(Math.abs(det)<1e-9)continue;const f=1/det,s=sub(r.o,t.v0),u=f*dot(s,h);if(u<0||u>1)continue;const qq=cross(s,t.e1),v=f*dot(r.d,qq);if(v<0||u+v>1)continue;const tt=f*dot(t.e2,qq);if(tt>0&&tt<=500)return true;}return false;};
  let rays=0;const hit=p=>{rays++;const r=ray(p.x,p.y);for(const m of models)if(rayModel(r,m))return true;return false;};
  const pick=hits=>{if(!hits.length)return null;const cx=hits.reduce((a,p)=>a+p.x,0)/hits.length,cy=hits.reduce((a,p)=>a+p.y,0)/hits.length;let b=hits[0],bd=1e9;for(const p of hits){const d=Math.hypot(p.x-cx,p.y-cy);if(d<bd){bd=d;b=p;}}return b;};
  const grid=()=>{const hs=[];for(let gy=0.12;gy<=0.80;gy+=0.02)for(let gx=0.06;gx<=0.94;gx+=0.02){const p={x:gx*W,y:gy*H};if(hit(p))hs.push(p);}return pick(hs);};
  const project=w=>{const d=sub(w,cam.position),c=rot([-q[0],-q[1],-q[2],q[3]],d);return {x:(1+c[0]/(-c[2])/(tanV*asp))*W/2,y:(1-c[1]/(-c[2])/tanV)*H/2};};
  const proj=()=>{const m=models[0],ctr=[0,1,2].map(k=>(m.mn[k]+m.mx[k])/2);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(let i=0;i<8;i++){const p=project([i&1?m.mx[0]:m.mn[0],i&2?m.mx[1]:m.mn[1],i&4?m.mx[2]:m.mn[2]]);x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
    const c=project(ctr);x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(W,x1);y1=Math.min(H,y1);const cc={x:Math.min(x1,Math.max(x0,c.x)),y:Math.min(y1,Math.max(y0,c.y))},rest=[];
    for(let j=0;j<5;j++)for(let i=0;i<5;i++)rest.push({x:x0+(x1-x0)*(.1+.2*i),y:y0+(y1-y0)*(.1+.2*j)});rest.sort((a,b)=>Math.hypot(a.x-cc.x,a.y-cc.y)-Math.hypot(b.x-cc.x,b.y-cc.y));
    for(const p of [cc,...rest])if(hit(p))return p;return null;};
  const time=(fn)=>{const out=[];let res=null,r0,t0;for(let i=0;i<REPS;i++){rays=0;tested=0;t0=process.hrtime.bigint();res=fn();out.push(Number(process.hrtime.bigint()-t0)/1e6);r0={rays,tested};}out.sort((a,b)=>a-b);return {ms:+out[Math.floor(out.length/2)].toFixed(2),...r0,at:res&&{x:Math.round(res.x),y:Math.round(res.y)}};};
  const g=time(grid),p=time(proj),v=time(()=>{const ok=hit(p.at);return ok?p.at:null;});
  const verdict={client:[W,H],camera:{position:cam.position.map(x=>+x.toFixed(3)),fov:cam.fovVerticalDeg},triangles:Object.fromEntries(models.map(m=>[m.name,m.tris.length])),
    old_grid:g,new_projection_warmup:p,new_use_cached_verify:v,speedup_warmup:+(g.ms/p.ms).toFixed(1),speedup_use:+(g.ms/v.ms).toFixed(1),rayRatio:+(g.rays/(p.rays+1)).toFixed(1),
    pickDistancePx:g.at&&p.at?+Math.hypot(g.at.x-p.at.x,g.at.y-p.at.y).toFixed(1):null};
  console.log(JSON.stringify(verdict,null,1));
  if(!p.at||!g.at||!(v.at))throw Error('no pick');
})().catch(e=>{console.error(e);process.exit(1);});
