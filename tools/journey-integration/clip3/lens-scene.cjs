'use strict';
// 运镜bot full9c clip3: shared NOT_ENGINE scene for the whole-trajectory lens gates and the 9ec5323c before/after renders.
// Skycity = env_skycity.glb (Draco) placed by the journey frame (yaw J.yaw, origin J.sOff = seam.skycityRootWorld = skyMooring5a/Cw),
// optionally translated by `off` (9ec5323c sail-chain visible city = Cw + Δ(−0.386,−0.187,+26.619)); lakeside instances at
// lakesideJourney(S6); balloon prefab (transport_balloon.glb) at a basket pose. Flat-shaded z-buffer raster (cam pose → RGB).
const RL=require('../route/route-legs.cjs'),F=require('../journey-framing-lib.cjs'),{J}=RL,{add,sub,rotY}=J;
const {load:loadGlb}=require('../occlusion/lib-glb.cjs');
const DELTA_9EC=[-0.386,-0.187,26.619];
const tris=o=>{const r=[];for(let i=0;i<o.tris.length;i+=9)r.push(Array.from(o.tris.slice(i,i+9)));return r;};
const SKY_HIDE=/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/;
let SKY=null;async function skyObjs(off=[0,0,0]){if(!SKY)SKY=(await RL.skyLocal()).filter(o=>!SKY_HIDE.test(o.name));
 return RL.rigid(SKY,'skycity',{yawDeg:J.yaw,origin:add(J.sOff,off)});}
const BAL=loadGlb(RL.J.B+'region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length);
function balloonObjs(pos,yawDeg,scale=1){return BAL.map(n=>{const t=new Float64Array(n.tris.length);for(let k=0;k<t.length;k+=3){const p=RL.balToWorld(pos,yawDeg,0,[n.tris[k]*scale,n.tris[k+1]*scale,n.tris[k+2]*scale]);t[k]=p[0];t[k+1]=p[1];t[k+2]=p[2];}return {tag:'balloon',name:n.name,tris:t};});}
function herObjs(feet,top=1.7){const x0=feet[0]-.25,x1=feet[0]+.25,z0=feet[2]-.25,z1=feet[2]+.25,y0=feet[1],y1=feet[1]+top,v=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],t=[];
 for(const [a,b,c,d] of [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){t.push(...v[a],...v[b],...v[c],...v[a],...v[c],...v[d]);}return [{tag:'her',name:'her',tris:Float64Array.from(t)}];}
const bvh=objs=>F.buildBvh(objs.filter(o=>o.tris&&o.tris.length));
// pose from a state.jsonl camera sample (Cocos euler: x pitch, y yaw; forward = −Z rotated)
function poseFromEuler(pos,eul,fov=45){const p=eul[0]*Math.PI/180,y=eul[1]*Math.PI/180,f=[-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p)];return {position:pos,target:add(pos,f.map(v=>v*8)),fovVerticalDeg:fov};}
// 26-direction fan: smallest radius (of RADII) at which any direction hits a surface; Infinity when none within the largest radius
const DIRS=(()=>{const d=[];for(let i=0;i<26;i++){const th=Math.acos(1-2*(i+.5)/26),ph=i*2.399963;d.push([Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)]);}return d;})();
function hitDist(B,a,u,L){if(!B||!B.root)return null;const h=F.cast(B,a,u,L);return h?{d:h.t!==undefined?h.t:(h.dist!==undefined?h.dist:null),tag:h.obj.tag+':'+h.obj.name}:null;}
function clearance(Bs,p,maxM=3){let best=Infinity,tag=null;for(const u of DIRS)for(const B of Bs){const h=hitDist(B,p,u,maxM);if(h){const d=h.d==null?maxM:h.d;if(d<best){best=d;tag=h.tag;}}}return {m:best,tag};}
// enclosed: none of 14 long rays escapes 20 m (inside a closed solid)
const D14=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],...[[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]].map(v=>v.map(x=>x/Math.sqrt(3)))];
function enclosed(Bs,p){return D14.every(u=>Bs.some(B=>hitDist(B,p,u,20)));}
function groundBelow(Bs,p,maxM=30){let best=Infinity,tag=null;for(const B of Bs){const h=hitDist(B,p,[0,-1,0],maxM);if(h&&h.d!=null&&h.d<best){best=h.d;tag=h.tag;}}return {m:best,tag};}
function render(objsList,pose,w,h,H=300){const k=H/h,Wd=Math.round(w*k),Hh=H,P=pose.position,Tg=pose.target;
 const f=sub(Tg,P),fl=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fl;let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const tv=Math.tan((pose.fovVerticalDeg||45)*Math.PI/360),th=tv*Wd/Hh,NEAR=.1;const pr=q=>{const d=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];return [((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th)*.5+.5)*Wd,(.5-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(z*tv)*.5)*Hh,z];};
 const img=Buffer.alloc(Wd*Hh*3);for(let i=0;i<Wd*Hh;i++){img[i*3]=160;img[i*3+1]=185;img[i*3+2]=215;}const zb=new Float32Array(Wd*Hh).fill(1e9);
 const COL={skycity:[120,125,140],balloon:[200,150,60],her:[235,40,40],lake:[90,140,90]};
 for(const o of objsList){const col=COL[o.tag]||[128,128,128],t=o.tris;for(let i=0;i<t.length;i+=9){const a=pr([t[i],t[i+1],t[i+2]]),b=pr([t[i+3],t[i+4],t[i+5]]),c=pr([t[i+6],t[i+7],t[i+8]]);if(a[2]<NEAR||b[2]<NEAR||c[2]<NEAR)continue;
  const e1=[t[i+3]-t[i],t[i+4]-t[i+1],t[i+5]-t[i+2]],e2=[t[i+6]-t[i],t[i+7]-t[i+1],t[i+8]-t[i+2]],n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],nl=Math.hypot(...n)||1,sh=.55+.45*Math.abs((n[0]*.3+n[1]*.8+n[2]*.5)/nl);
  const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(Wd-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(Hh-1,Math.ceil(Math.max(a[1],b[1],c[1])));if(x0>x1||y0>y1)continue;if((x1-x0)*(y1-y0)>Wd*Hh*4)continue;
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const z=1/(l1/a[2]+l2/b[2]+l3/c[2]),j=y*Wd+x;if(z>=zb[j])continue;zb[j]=z;img[j*3]=col[0]*sh;img[j*3+1]=col[1]*sh;img[j*3+2]=col[2]*sh;}}}
 // near-plane fill: fraction of pixels whose nearest surface is < 0.5 m (camera pressed against / inside geometry)
 let near=0;for(let j=0;j<zb.length;j++)if(zb[j]<.5)near++;
 return {w:Wd,h:Hh,img,nearFrac:near/zb.length};}
function ppm(file,R){require('fs').writeFileSync(file,Buffer.concat([Buffer.from(`P6 ${R.w} ${R.h} 255\n`),R.img]));}
module.exports={RL,J,DELTA_9EC,skyObjs,balloonObjs,herObjs,bvh,poseFromEuler,clearance,enclosed,groundBelow,render,ppm,DIRS};
