#!/usr/bin/env node
'use strict';
/** sail-voyage (REPORT-ONLY, NOT_ENGINE). Measures the three voyage beats + motion caps for the parametric
 *  SailVoyage camera, on the current geometry and on the scene team's three candidate scenarios. Never fails on the
 *  proposed thresholds (they await Grok Bot); fails only if the module cannot load / evaluate. */
const fs=require('node:fs'),path=require('node:path');
const V=require('./voyage_lib.cjs'),leg=V.leg,L=V.L;
const SV=L.load('region/SailVoyage.ts',s=>s.includes('TransportLeg')?leg:{});
const PROPOSED={departMaxH:0.03,openSeaMinS:6,dockH:[0.30,0.40],yawDegS:90,yawP99DegS2:200,stepM:0.6,clearM:1.1,occlMaxS:0.5,wholeMaxS:45};
const WHOLE_NOW=41.4,BASE_SAIL=leg.sailBeats(leg.sailRoute().length).build05S;
const SOLID=/^(sail_main|sail_jib|boom|hull|seat_bench|mast)$/;
function scenarioRoute(sc){const r=leg.sailRoute(),z0=r.samples[0][2],z1=r.samples.at(-1)[2],k=((z1-z0)+(sc.dz||0))/(z1-z0);
 const s=r.samples.map(p=>[p[0],p[1],z0+(p[2]-z0)*k]);let len=0;for(let i=1;i<s.length;i++)len+=Math.hypot(s[i][0]-s[i-1][0],s[i][2]-s[i-1][2]);return {samples:s,length:len};}
function run(name,sc,useVoyage){
 const r=scenarioRoute(sc),tl=useVoyage?SV.voyageBeats(r.length):leg.sailBeats(r.length),m0=leg.sailM0World();
 SV.SAIL_VOYAGE.dest=[m0[0],m0[1],m0[2]+(sc.dz||0)];
 const cam=(t,s)=>useVoyage?SV.sailVoyageCamera(tl,r.samples,t,s):leg.sailCamera(tl,r.samples,t,s);
 const sc0=tl.beats.find(b=>b.id==='S-c'),end=tl.build05S,out={scenario:name,camera:useVoyage?'voyage':'current',sailS:+end.toFixed(2),wholeS:+(WHOLE_NOW+end-BASE_SAIL).toFixed(2),speedMps:+tl.speed.v.toFixed(2),screens:{}};
 for(const s of leg.SAIL_SCREENS){
  const ser=[];for(let t=sc0.t0;t<=end+1e-6;t+=0.25){const v=leg.sailVehicle(tl,r.samples,t),q=V.raster(cam(t,s),s,v,sc);ser.push({t,p:v.distance/tl.speed.length,h:q.islandH,sea:q.seaArea,hz:q.horizon,head:q.headNdc});}
  const dep=ser.filter(x=>x.p<=0.06),app=ser.filter(x=>x.p>=0.90);let run=0,best=0;for(const x of ser){run=(x.h===0&&x.sea>0.15&&x.hz!=null)?run+0.25:0;best=Math.max(best,run);}
  let mono=0;for(let i=1;i<app.length;i++)if(app[i].h<app[i-1].h-0.01)mono++;
  // WeChat capsule 87×32 at (w−7−87, 48) px; her head must sit ≥ 8 px outside it
  let cap=1e9;for(const x of ser)if(x.head){const px=(x.head[0]+1)/2*s.w,py=(1-x.head[1])/2*s.h,cx0=s.w-94,cx1=s.w-7,cy0=48,cy1=80;const dx=Math.max(cx0-px,0,px-cx1),dy=Math.max(cy0-py,0,py-cy1);cap=Math.min(cap,Math.hypot(dx,dy));}
  const headOut=ser.filter(x=>!x.head||Math.abs(x.head[0])>0.9||Math.abs(x.head[1])>0.9).length*0.25;
  out.screens[s.w+'x'+s.h]={departMaxH:+Math.max(...dep.map(x=>x.h)).toFixed(3),openSeaS:best,dockH:+ser.at(-1).h.toFixed(3),approachDrops:mono,capsuleGapPx:+cap.toFixed(0),headOffFrameS:headOut,series:ser.filter((_,i)=>i%2===0).map(x=>[+x.t.toFixed(1),+x.h.toFixed(3)])};
 }
 // motion @60 fps over the whole sail clock, 390×844
 const poses=[];for(let t=0;t<=end+1e-6;t+=1/60)poses.push(cam(t,{w:390,h:844}));
 const dir=p=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(...d);return d.map(x=>x/l);};
 const w=[],step=[];for(let i=1;i<poses.length;i++){const a=dir(poses[i-1]),b=dir(poses[i]);w.push(Math.acos(Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))*180/Math.PI*60);step.push(Math.hypot(...[0,1,2].map(j=>poses[i].position[j]-poses[i-1].position[j])));}
 const acc=w.slice(1).map((x,i)=>Math.abs(x-w[i])*60).sort((a,b)=>a-b);
 out.motion={yawMaxDegS:+Math.max(...w).toFixed(1),accP99DegS2:+acc[Math.floor(acc.length*0.99)].toFixed(1),stepMaxM:+Math.max(...step).toFixed(3),firstFrameDeltaM:0};
 if(name==='current-geometry'&&useVoyage){
  let cl={m:1e9},occ=0,occMax=0;
  for(let t=sc0.t0;t<=end;t+=0.1){const v=leg.sailVehicle(tl,r.samples,t),c=cam(t,{w:390,h:844}),k=L.clearance(c,v);if(k.m<cl.m)cl={m:+k.m.toFixed(2),who:k.who,t:+t.toFixed(1)};
   const hits=[...L.girlOccluders(c,v,L.GIRL.head),...L.girlOccluders(c,v,L.GIRL.chest)].filter(n=>SOLID.test(n));occ=hits.length?occ+0.1:0;occMax=Math.max(occMax,occ);}
  out.clearance=cl;out.faceChestHiddenMaxS=+occMax.toFixed(2);
  const a=leg.sailCamera(tl,r.samples,0),b=cam(0,{w:390,h:844});out.motion.firstFrameDeltaM=Math.hypot(...[0,1,2].map(j=>a.position[j]-b.position[j]));
 }
 return out;
}
const scen=[['current-geometry',{}],['farther-island+60m',{dz:60}],['farther-island+150m',{dz:150}],['horizon-occluder',{occluder:{z:30,h:2.2,w:200}}],['scaled-stand-in-0.25',{scale:0.25}]];
const res={status:'REPORT_ONLY',proposed:PROPOSED,before:run('current-geometry',{},false),after:scen.map(([n,s])=>run(n,s,true))};
const dst=path.join(__dirname,'reports');fs.mkdirSync(dst,{recursive:true});fs.writeFileSync(path.join(dst,'sail-voyage.json'),JSON.stringify(res,null,1));
const brief=x=>({scenario:x.scenario,camera:x.camera,sailS:x.sailS,wholeS:x.wholeS,v:x.speedMps,motion:x.motion,clearance:x.clearance,occl:x.faceChestHiddenMaxS,screens:Object.fromEntries(Object.entries(x.screens).map(([k,s])=>[k,[s.departMaxH,s.openSeaS,s.dockH,s.approachDrops,s.capsuleGapPx,s.headOffFrameS]]))});
console.log(JSON.stringify({status:'REPORT_ONLY',cols:'departMaxH,openSeaS,dockH,approachDrops,capsuleGapPx,headOffFrameS',before:brief(res.before),after:res.after.map(brief)}));
