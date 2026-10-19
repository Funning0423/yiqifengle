'use strict';
/**
 * Far-sea (K3/K7) windmill framing helpers. CPU only: loads the real meadow GLB and sailboat.glb,
 * z-buffers them into a small id buffer for a sail camera pose, and reports how much of the
 * screen the windmill covers after occlusion, where she is, and lens clearance.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs');
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const B=path.resolve(__dirname,'../../creator-build-project/assets/bundles');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req||(()=>{}),console},{filename:file});return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts');
const landing=load('region/SailLanding.ts');
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:{});
const MILL=/^windmill_(static_merged|sails)$/;
/** Sky dome, clouds and the far-hill ring are not solid. Far hills are hidden in the sail still too. */
const SKIP=/^(meadow_sky_dome|meadow_clouds_near|meadow_far_hills)$/;
let cache=null;
function scene(){
 if(cache)return cache;
 const root=leg.sailMeadowRoot();
 const meadow=[];
 for(const n of loadGlb(path.join(B,'region_meadow/env_meadow.glb'))){
  if(!n.tris||!n.tris.length||SKIP.test(n.name))continue;
  const t=new Float64Array(n.tris.length);
  for(let i=0;i<t.length;i+=3){t[i]=root[0]-n.tris[i];t[i+1]=root[1]+n.tris[i+1];t[i+2]=root[2]-n.tris[i+2];}
  meadow.push({name:n.name,mill:MILL.test(n.name),tris:t});
 }
 const boat=[];
 for(const n of loadGlb(path.join(B,'transport_sail/sailboat.glb'))){if(n.tris&&n.tris.length&&n.name!=='sail_furled')boat.push({name:n.name,tris:n.tris});}
 cache={root,meadow,boat};return cache;
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
function basis(cam){const fw=nrm(sub(cam.target,cam.position));const r=nrm(cross(fw,[0,1,0]));const up=cross(r,fw);return {fw,r,up,th:Math.tan((cam.fovVerticalDeg||48)*Math.PI/360)};}
/** Boat-local → world, same as the k2k7 test / TransitBackdrop.placeLocal (roll ignored, ≤ 4°). */
function boatWorld(v,p){const c=Math.cos(v.yaw),s=Math.sin(v.yaw);return [v.pos[0]+c*p[0]+s*p[2],v.pos[1]+p[1],v.pos[2]-s*p[0]+c*p[2]];}
/** Seated girl: root anchor (0,0.06,-0.55); head ≈ 1.0 m above it, chest 0.65 m. */
const GIRL={head:[0,1.06,-0.55],chest:[0,0.71,-0.55],seat:[0,0.3,-0.55]};
function raster(cam,screen,v,opt={}){
 const W=opt.w||Math.round(screen.w/2),H=opt.h||Math.round(screen.h/2),asp=screen.w/screen.h;
 const {fw,r,up,th}=basis(cam),o=cam.position,near=0.2;
 const zb=new Float32Array(W*H).fill(Infinity),id=new Uint8Array(W*H);
 const toCam=p=>{const d=sub(p,o);return [dot(d,r),dot(d,up),dot(d,fw)];};
 function tri(a,b,c,code){
  // clip against z=near
  let poly=[a,b,c],out=[];
  for(let i=0;i<poly.length;i++){const P=poly[i],Q=poly[(i+1)%poly.length];const pin=P[2]>=near,qin=Q[2]>=near;if(pin)out.push(P);if(pin!==qin){const k=(near-P[2])/(Q[2]-P[2]);out.push([P[0]+(Q[0]-P[0])*k,P[1]+(Q[1]-P[1])*k,near]);}}
  if(out.length<3)return;
  const s=out.map(p=>[((p[0]/(p[2]*th*asp))+1)/2*W,(1-(p[1]/(p[2]*th)))/2*H,1/p[2]]);
  for(let i=1;i+1<s.length;i++)fill(s[0],s[i],s[i+1],code);
 }
 function fill(A,Bp,C,code){
  const minx=Math.max(0,Math.floor(Math.min(A[0],Bp[0],C[0]))),maxx=Math.min(W-1,Math.ceil(Math.max(A[0],Bp[0],C[0])));
  const miny=Math.max(0,Math.floor(Math.min(A[1],Bp[1],C[1]))),maxy=Math.min(H-1,Math.ceil(Math.max(A[1],Bp[1],C[1])));
  if(minx>maxx||miny>maxy)return;
  const area=(Bp[0]-A[0])*(C[1]-A[1])-(Bp[1]-A[1])*(C[0]-A[0]);if(Math.abs(area)<1e-9)return;
  for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
   const px=x+0.5,py=y+0.5;
   const w0=((Bp[0]-px)*(C[1]-py)-(Bp[1]-py)*(C[0]-px))/area,w1=((C[0]-px)*(A[1]-py)-(C[1]-py)*(A[0]-px))/area,w2=1-w0-w1;
   if(w0<0||w1<0||w2<0)continue;
   const iz=w0*A[2]+w1*Bp[2]+w2*C[2],z=1/iz,k=y*W+x;
   if(z<zb[k]){zb[k]=z;id[k]=code;}
  }
 }
 const sc=scene();
 for(const m of sc.meadow){const t=m.tris,code=m.mill?2:1;for(let i=0;i<t.length;i+=9)tri(toCam([t[i],t[i+1],t[i+2]]),toCam([t[i+3],t[i+4],t[i+5]]),toCam([t[i+6],t[i+7],t[i+8]]),code);}
 if(v)for(const m of sc.boat){const t=m.tris;for(let i=0;i<t.length;i+=9)tri(toCam(boatWorld(v,[t[i],t[i+1],t[i+2]])),toCam(boatWorld(v,[t[i+3],t[i+4],t[i+5]])),toCam(boatWorld(v,[t[i+6],t[i+7],t[i+8]])),3);}
 let mill=0,x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(id[y*W+x]===2){mill++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const proj=p=>{const c=toCam(p);if(c[2]<near)return null;const sx=((c[0]/(c[2]*th*asp))+1)/2*W,sy=(1-(c[1]/(c[2]*th)))/2*H;const k=Math.floor(sy)*W+Math.floor(sx);
  const inside=sx>=0&&sx<W&&sy>=0&&sy<H;return {ndc:[c[0]/(c[2]*th*asp),c[1]/(c[2]*th)],depth:c[2],visible:inside&&c[2]<=zb[k]+0.05,blocker:inside?id[k]:0};};
 const girl=v?{head:proj(boatWorld(v,GIRL.head)),chest:proj(boatWorld(v,GIRL.chest)),seat:proj(boatWorld(v,GIRL.seat))}:null;
 return {W,H,mill:mill/(W*H),millBox:mill?{x0:x0/W,x1:(x1+1)/W,y0:y0/H,y1:(y1+1)/H,hFrac:(y1+1-y0)/H,wFrac:(x1+1-x0)/W}:null,girl,id,zb};
}
function triDist(o,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ao=sub(o,a),d1=dot(ab,ao),d2=dot(ac,ao);const len=q=>Math.hypot(q[0],q[1],q[2]);
 if(d1<=0&&d2<=0)return len(ao);
 const bo=sub(o,b),d3=dot(ab,bo),d4=dot(ac,bo);if(d3>=0&&d4<=d3)return len(bo);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const k=d1/(d1-d3);return len(sub(o,[a[0]+ab[0]*k,a[1]+ab[1]*k,a[2]+ab[2]*k]));}
 const co=sub(o,c),d5=dot(ab,co),d6=dot(ac,co);if(d6>=0&&d5<=d6)return len(co);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const k=d2/(d2-d6);return len(sub(o,[a[0]+ac[0]*k,a[1]+ac[1]*k,a[2]+ac[2]*k]));}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const k=(d4-d3)/((d4-d3)+(d5-d6));return len(sub(o,[b[0]+(c[0]-b[0])*k,b[1]+(c[1]-b[1])*k,b[2]+(c[2]-b[2])*k]));}
 const den=1/(va+vb+vc),vv=vb*den,ww=vc*den;return len(sub(o,[a[0]+ab[0]*vv+ac[0]*ww,a[1]+ab[1]*vv+ac[1]*ww,a[2]+ab[2]*vv+ac[2]*ww]));
}
/** Lens clearance to real meadow geometry and to the drawn sailboat (sailboat.glb). Water plane is not geometry. */
function clearance(cam,v){
 const o=cam.position,sc=scene();let best=1e9,who='';
 for(const m of sc.meadow){if(m.name==='meadow_river')continue;const t=m.tris;for(let i=0;i<t.length;i+=9){
  const mx=Math.min(Math.abs(t[i]-o[0]),Math.abs(t[i+3]-o[0]),Math.abs(t[i+6]-o[0]));if(mx>best+30)continue;
  const d=triDist(o,[t[i],t[i+1],t[i+2]],[t[i+3],t[i+4],t[i+5]],[t[i+6],t[i+7],t[i+8]]);if(d<best){best=d;who=m.name;}}}
 if(v)for(const m of sc.boat){const t=m.tris;for(let i=0;i<t.length;i+=9){const d=triDist(o,boatWorld(v,[t[i],t[i+1],t[i+2]]),boatWorld(v,[t[i+3],t[i+4],t[i+5]]),boatWorld(v,[t[i+6],t[i+7],t[i+8]]));if(d<best){best=d;who='boat:'+m.name;}}}
 return {m:best,who};
}
/** Per-frame view-direction angular speed (°/s) and its change (°/s²), plus lens speed / accel. */
function motion(poses,dt){
 const dir=p=>nrm(sub(p.target,p.position));const out=[];
 for(let i=1;i<poses.length;i++){const a=dir(poses[i-1]),b=dir(poses[i]);const ang=Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI;
  const lin=Math.hypot(...sub(poses[i].position,poses[i-1].position));out.push({w:ang/dt,v:lin/dt,fov:Math.abs((poses[i].fovVerticalDeg||48)-(poses[i-1].fovVerticalDeg||48))/dt});}
 let wMax=0,aMax=0,vMax=0,laMax=0,fovMax=0,at={};
 for(let i=0;i<out.length;i++){wMax=Math.max(wMax,out[i].w);vMax=Math.max(vMax,out[i].v);fovMax=Math.max(fovMax,out[i].fov);
  if(i){const a=Math.abs(out[i].w-out[i-1].w)/dt,la=Math.abs(out[i].v-out[i-1].v)/dt;if(a>aMax){aMax=a;at.ang=i;}if(la>laMax){laMax=la;at.lin=i;}}}
 return {wMax,aMax,vMax,laMax,fovMax,at};
}
function rayTri(o,d,a,b,c){const e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-9)return -1;const iv=1/det,tv=sub(o,a),u=dot(tv,p)*iv;if(u<0||u>1)return -1;const q=cross(tv,e1),v=dot(d,q)*iv;if(v<0||u+v>1)return -1;return dot(e2,q)*iv;}
/** Names of sailboat.glb parts between the lens and a point of her (boat-local). */
function girlOccluders(cam,v,local){
 const P=boatWorld(v,local),d=sub(P,cam.position),D=Math.hypot(d[0],d[1],d[2]),dn=[d[0]/D,d[1]/D,d[2]/D],hits=[];
 for(const m of scene().boat){const t=m.tris;for(let i=0;i<t.length;i+=9){const k=rayTri(cam.position,dn,boatWorld(v,[t[i],t[i+1],t[i+2]]),boatWorld(v,[t[i+3],t[i+4],t[i+5]]),boatWorld(v,[t[i+6],t[i+7],t[i+8]]));if(k>0&&k<D-0.05){hits.push(m.name);break;}}}
 return hits;
}
module.exports={leg,scene,raster,clearance,motion,basis,boatWorld,girlOccluders,GIRL,load};
