#!/usr/bin/env node
'use strict';
/**
 * sail-voyage — option E hard gates (Grok Bot approved 2026-10-26). NOT_ENGINE: CPU z-buffer of the real env_meadow.glb
 * (sail copy, south lowland z<45 sunk to y≤−1.3, hidden until the swap), the 0.335 stand-in at (−5.6,−0.91,242) (scene SEA_STANDIN, 2ddfbb44) (same glb,
 * scaled about the meadow root), sailboat.glb and an opaque sea plane at y −0.91. Share = vertical extent of visible
 * meadow/stand-in pixels ÷ frame height (depth-occluded by the sea and the hull). The Mac DevTools capture is the arbiter.
 * Camera = SailVoyage.sailVoyageCamera on the unchanged boat clock (sailBeats, 3.6 m/s).
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const V=require('./voyage_lib.cjs'),leg=V.leg,L=V.L;
const SV=L.load('region/SailVoyage.ts',s=>s.includes('TransportLeg')?leg:{});
const G={dock:[0.02,0.04],millHPx:12,millWPx:10/* windmill recognisable on 320×568: silhouette ≥12 px tall, blades ≥10 px wide */,
 seaS:6,approach:[0.30,0.40],swapT:17.4,swapWin:0.1,wholeS:45,headNdc:0.9,boatNdc:0.97,yaw:90,accP99:200,stepM:0.6,clearM:1.1,occlS:0.5,solid:0.92};
const WHOLE_NOW=41.4;
const route=leg.sailRoute(),R=route.samples,tl=leg.sailBeats(route.length),BEFORE=process.env.QF_SAIL_VOYAGE_BEFORE==='1'/* report the approved sailCamera on the E scene, never gates */,cam=(t,s)=>BEFORE?leg.sailCamera(tl,R,t,s):SV.sailVoyageCamera(tl,R,t,s);
const sb=tl.beats.find(b=>b.id==='S-b'),sc=tl.beats.find(b=>b.id==='S-c'),end=tl.build05S;
const fails=[];const gate=(ok,msg)=>{if(!ok)fails.push(msg);};
const E=V.eScene({}),SEA=V.SEA;
/** Off-frustum test on the drawn (above-water) geometry. NB the terrain node AABB encloses the boat, so a runtime test
 *  must use above-water sub-bounds, not the node AABB. */
function inFrustum(c,s,items){const {fw,r,up,th}=L.basis(c),asp=s.w/s.h,o=c.position;let n=0;
 for(const it of items){const t=it.t;for(let i=0;i<t.length;i+=3){if(t[i+1]<=SEA+0.02)continue;const d=[t[i]-o[0],t[i+1]-o[1],t[i+2]-o[2]],z=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];if(z<0.2)continue;
  const x=(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th*asp),y=(d[0]*up[0]+d[1]*up[1]+d[2]*up[2])/(z*th);if(Math.abs(x)<=1&&Math.abs(y)<=1)n++;}}return n;}
function boatNdc(c,s,v){const {fw,r,up,th}=L.basis(c),asp=s.w/s.h,o=c.position;let m=0;for(const b of L.scene().boat){const t=b.tris;for(let i=0;i<t.length;i+=3){const p=L.boatWorld(v,[t[i],t[i+1],t[i+2]]),d=[p[0]-o[0],p[1]-o[1],p[2]-o[2]],z=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];
 m=Math.max(m,z<0.2?9:Math.max(Math.abs((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th*asp)),Math.abs((d[0]*up[0]+d[1]*up[1]+d[2]*up[2])/(z*th))));}}return m;}
const swapP=leg.sailVehicle(tl,R,G.swapT).distance/tl.speed.length;
const out={method:'NOT_ENGINE z-buffer (see header)',boat:{mps:+tl.speed.v.toFixed(2),cruiseS:+tl.speed.cruiseS.toFixed(2),sailS:+end.toFixed(2)},wholeS:+(WHOLE_NOW+end-23.821462039439513).toFixed(2),swap:{t:G.swapT,p:+swapP.toFixed(3)},gates:G,screens:{}};
gate(out.wholeS<=G.wholeS,'whole transition '+out.wholeS);
for(const s of leg.SAIL_SCREENS){const k=s.w+'x'+s.h,row={};
 const scene=t=>({E:{real:t>=G.swapT,impostor:t<G.swapT}});
 // dock: S-b hold
 let dmin=1,dmax=0,mill=null;for(let t=sb.t0;t<=sb.t1+1e-6;t+=0.25){const v=leg.sailVehicle(tl,R,t),q=V.raster(cam(t,s),s,v,scene(t),s.w<=390?1:2);dmin=Math.min(dmin,q.islandH);dmax=Math.max(dmax,q.islandH);if(Math.abs(t-(sb.t0+sb.t1)/2)<0.13)mill=q.mill;}
 row.dock=[+dmin.toFixed(3),+dmax.toFixed(3)];row.millPx=mill?[mill.hPx,mill.wPx]:null;
 gate(dmin>=G.dock[0]&&dmax<=G.dock[1],k+' dock share '+row.dock);
 if(k==='320x568')gate(mill&&mill.hPx>=G.millHPx&&mill.wPx>=G.millWPx,'windmill not recognisable on 320x568 '+JSON.stringify(mill));
 // voyage series
 const ser=[];let run=0,best=0,bestAt=null,solid=0;for(let t=sc.t0;t<=end+1e-6;t+=0.25){const v=leg.sailVehicle(tl,R,t),q=V.raster(cam(t,s),s,v,scene(t)),qc=V.raster(cam(t,s),s,v,{...scene(t),noBoat:1});
  ser.push({t,h:q.islandH,hc:qc.islandH});const seaOnly=q.islandH===0&&q.seaArea>0.15;run=seaOnly?run+0.25:0;if(run>best){best=run;bestAt=+(t-run+0.25).toFixed(2);}solid=Math.max(solid,q.dominant);}
 row.sea=[best,bestAt];gate(best>=G.seaS,k+' open sea '+best+' s');
 row.preDock=+Math.max(...ser.filter(x=>x.t>=19&&x.t<=21).map(x=>x.h)).toFixed(3);
 row.docked=+ser.at(-1).h.toFixed(3);gate(row.docked>=G.approach[0]&&row.docked<=G.approach[1],k+' approach share '+row.docked);
 const pA=t=>leg.sailVehicle(tl,R,t).distance/tl.speed.length;let drops=0;const app=ser.filter(x=>pA(x.t)>=SV.SAIL_VOYAGE_P.sea1);for(let i=1;i<app.length;i++)if(app[i].hc<app[i-1].hc-0.01)drops++;row.cameraShrinkSteps=drops;
 row.series=ser.filter((_,i)=>i%2===0).map(x=>[+x.t.toFixed(1),+x.h.toFixed(3)]);
 row.dominantMax=+solid.toFixed(3);
 // swap window: both off-frustum, no solid frame
 let swapIn=0,swapDom=0;for(let t=G.swapT-G.swapWin;t<=G.swapT+G.swapWin+1e-6;t+=1/60){const c=cam(t,s);swapIn+=inFrustum(c,s,E.real)+inFrustum(c,s,E.imp);swapDom=Math.max(swapDom,V.raster(c,s,leg.sailVehicle(tl,R,t),scene(t),4).dominant);}
 row.swap={inFrustumVerts:swapIn,dominant:+swapDom.toFixed(3)};gate(swapIn===0,k+' swap: geometry in frustum '+swapIn);gate(swapDom<=G.solid,k+' swap: solid frame '+swapDom);
 // head |ndc| at 30 fps, whole boat in frame through the sea hold, capsule
 let hmax=0,cap=1e9,bmax=0;for(let t=0;t<=end+1e-6;t+=1/30){const c=cam(t,s),v=leg.sailVehicle(tl,R,t),{fw,r,up,th}=L.basis(c),h=L.boatWorld(v,L.GIRL.head),d=[h[0]-c.position[0],h[1]-c.position[1],h[2]-c.position[2]],z=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];
  if(t<sb.t0)continue;/* S-a: she walks on the dock (sailCamera K0, approved) */
  const nx=(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th*s.w/s.h),ny=(d[0]*up[0]+d[1]*up[1]+d[2]*up[2])/(z*th);hmax=Math.max(hmax,z>0?Math.max(Math.abs(nx),Math.abs(ny)):9);
  const px=(nx+1)/2*s.w,py=(1-ny)/2*s.h,dx=Math.max(s.w-94-px,0,px-(s.w-7)),dy=Math.max(48-py,0,py-80);cap=Math.min(cap,Math.hypot(dx,dy));
  const p=v.distance/tl.speed.length;if(t>=sc.t0+SV.SAIL_VOYAGE.swing1S&&p<=SV.SAIL_VOYAGE_P.sea1&&Math.round(t*30)%6===0)bmax=Math.max(bmax,boatNdc(c,s,v));}
 row.headNdcMax=+hmax.toFixed(3);row.capsuleGapPx=Math.round(cap);row.boatNdcMaxSea=+bmax.toFixed(3);
 gate(hmax<=G.headNdc,k+' head ndc '+hmax);gate(cap>0,k+' capsule over her face');gate(bmax<=G.boatNdc,k+' boat cropped in the beam shot '+bmax);
 out.screens[k]=row;}
// motion @60 fps over the whole clock, 390×844 (yaw = view-direction angular speed)
{const P=[];for(let t=0;t<=end+1e-6;t+=1/60)P.push(cam(t,{w:390,h:844}));const dir=p=>{const d=[0,1,2].map(j=>p.target[j]-p.position[j]),l=Math.hypot(...d);return d.map(x=>x/l)};
 const w=[],st=[];for(let i=1;i<P.length;i++){const a=dir(P[i-1]),b=dir(P[i]);w.push(Math.acos(Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))*180/Math.PI*60);st.push(Math.hypot(...[0,1,2].map(j=>P[i].position[j]-P[i-1].position[j])));}
 const acc=w.slice(1).map((x,i)=>Math.abs(x-w[i])*60).sort((a,b)=>a-b),a0=leg.sailCamera(tl,R,0),b0=P[0];
 out.motion={yawMaxDegS:+Math.max(...w).toFixed(1),yawAt:+(w.indexOf(Math.max(...w))/60).toFixed(2),accP99:+acc[Math.floor(acc.length*0.99)].toFixed(1),stepMaxM:+Math.max(...st).toFixed(3),firstFrameDeltaM:Math.hypot(...[0,1,2].map(j=>a0.position[j]-b0.position[j]))};
 gate(out.motion.yawMaxDegS<=G.yaw,'yaw '+out.motion.yawMaxDegS);gate(out.motion.accP99<=G.accP99,'yaw accel p99 '+out.motion.accP99);gate(out.motion.stepMaxM<=G.stepM,'step '+out.motion.stepMaxM);gate(out.motion.firstFrameDeltaM<1e-9,'first frame ≠ live lens');}
// clearance + face/chest occlusion by solid boat parts, 10 Hz
{let cl={m:1e9},run=0,mx=0;const SOLID=/^(sail_main|sail_jib|boom|hull|seat_bench|mast)$/;for(let t=sb.t0;t<=end;t+=0.1){const v=leg.sailVehicle(tl,R,t),c=cam(t,{w:390,h:844}),k=L.clearance(c,v);if(k.m<cl.m)cl={m:+k.m.toFixed(2),who:k.who,t:+t.toFixed(1)};
 const hit=[...L.girlOccluders(c,v,L.GIRL.head),...L.girlOccluders(c,v,L.GIRL.chest)].some(n=>SOLID.test(n));run=hit?run+0.1:0;mx=Math.max(mx,run);}
 out.clearance=cl;out.faceChestHiddenMaxS=+mx.toFixed(1);gate(cl.m>=G.clearM,'clearance '+JSON.stringify(cl));gate(mx<=G.occlS,'face/chest hidden '+mx);}
out.status=fails.length?'FAIL':'PASS';out.fails=fails;
const dst=path.join(__dirname,'reports');fs.mkdirSync(dst,{recursive:true});fs.writeFileSync(path.join(dst,BEFORE?'sail-voyage-before.json':'sail-voyage.json'),JSON.stringify(out,null,1));
const brief={...out,screens:Object.fromEntries(Object.entries(out.screens).map(([k,r])=>[k,{...r,series:undefined}]))};
console.log(JSON.stringify(brief));
if(fails.length&&!BEFORE)process.exit(1);
