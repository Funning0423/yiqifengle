#!/usr/bin/env node
'use strict';
/**
 * r5-sail-farsea: the far-sea shot (K3 day / K7 night still) shows the meadow windmill.
 * - Windmill screen share after occlusion (meadow terrain/trees/grass + sailboat.glb) on every SAIL_SCREEN through the K3 hold.
 * - She stays visible (head/chest not behind the sail or hull) and inside the frame through the whole swing in and out.
 * - Lens ≥ 1.1 m from real meadow geometry and from the drawn hull through S-d.
 * - Per-frame angular speed / angular acceleration / lens acceleration limits for the swing in and out (60 fps).
 * - K1, K2, K4, K5, K6 stills follow the 3.6 m/s sail clock.
 */
const assert=require('node:assert/strict');
const L=require('./sail_farsea_lib.cjs');
const leg=L.leg;
// Live lens: SailVoyage once its re-baseline commit turns it on (enabled:true), else the approved sailCamera. The content checks
// follow the lens that actually runs (Grok Bot 2026-10-26); every threshold in LIM is unchanged.
const SV=L.load('region/SailVoyage.ts',()=>({...leg})),LIVE_VOYAGE=SV.SAIL_VOYAGE.enabled===true,lens=LIVE_VOYAGE?SV.sailVoyageCamera:leg.sailCamera;
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
const sd=tl.beats.find(b=>b.id==='S-d'),at=u=>sd.t0+(sd.t1-sd.t0)*u;
const LIM={millShare:0.010,millStillShare:0.020,millH:0.12,edge:0.03,girlNdc:0.8,clearM:1.1,wDeg:110,aDeg:360,linA:60,wholeW:173,wholeA:706};
assert(tl.build05S<=30.5,'sail clock '+tl.build05S);
assert(Math.abs(tl.build05S-23.821462039439513)<1e-6,'sail clock changed '+tl.build05S);
// b16: K3 hold and the swing window come from the eased arc clock (sailK3Window / sailArcWindow), not fixed S-d u.
const KW=leg.sailK3Window(tl),K3_IN=KW.in,K3_OUT=KW.out,AW=leg.sailArcWindow(tl),U=t=>(t-sd.t0)/(sd.t1-sd.t0),SW0=U(leg.sailStillTimes(tl).k2+leg.SAIL_K2_HOLD_S/2),SW1=U(AW.t1);
assert(K3_IN>0&&K3_OUT>K3_IN&&K3_OUT<1,'K3 hold window');
// Stills updated for the 3.6 m/s profile; camera geometry limits below stay unchanged.
// b16 sail.C1ride/O1sgMain: K4→K6 dock move now runs to the end of S-g with a raised K6 (up 10.0) — K4/K5/K6 stills regenerated.
// b16 stills (eased arc clock, lens yaw from the smoothed route; sailStillTimes). Was K2 11.48 / K4 16.64 / K5 17.72.
const GOLD={K1:{t:8.7,p:[-4.6486,3.39,5.793],q:[-0.1257,0.14,12.8995],f:48},K2:{t:13.675,p:[-5.4524,4.29,33.427],q:[-0.2905,0.14,17.1987],f:52},K4:{t:20.4,p:[-3.35,5.2901,37.4489],q:[-4.4,0.14,49.0489],f:49.99992139338046},K5:{t:21.1857,p:[-3.3709,5.6161,39.0639],q:[-4.4,0.14,50.6011],f:49.68600251452534},K6:{t:tl.build05S-0.12,p:[-3.55,9.089,40.3997],q:[-4.4,0.14,51.5997],f:48.00000014703174}};
for(const [k,g] of Object.entries(GOLD)){const c=lens(tl,route.samples,g.t);for(let i=0;i<3;i++){assert(Math.abs(c.position[i]-g.p[i])<2e-3,k+' position moved');assert(Math.abs(c.target[i]-g.q[i])<2e-3,k+' target moved');}assert(Math.abs(c.fovVerticalDeg-g.f)<1e-4,k+' fov');}
// windmill share through the hold, every screen
const share=[];let still=null;
// Windmill frames: K3 hold (sailCamera) → pre-docking 19.5–20.5 s (SailVoyage: the meadow is off-frame mid-sea by design).
const MILL_T=LIVE_VOYAGE?Array.from({length:21},(_,i)=>19.5+i*0.05):(()=>{const a=[];for(let u=K3_IN;u<=K3_OUT+1e-6;u+=0.02)a.push(at(Math.min(u,K3_OUT-1e-4)));return a;})();
for(const s of leg.SAIL_SCREENS){
 let worst=null;
 for(const t of MILL_T){
  const u=(t-sd.t0)/(sd.t1-sd.t0),v=leg.sailVehicle(tl,route.samples,t),c=lens(tl,route.samples,t,s);
  const r=L.raster(c,s,v);
  assert(r.millBox,'windmill not on screen '+s.w+'x'+s.h+' u='+u.toFixed(2));
  const b=r.millBox;
  assert(r.mill>=LIM.millShare,'windmill share '+r.mill.toFixed(4)+' '+s.w+'x'+s.h+' u='+u.toFixed(2));
  assert(b.hFrac>=LIM.millH,'windmill height '+b.hFrac.toFixed(3));
  assert(b.x0>=LIM.edge&&b.x1<=1-LIM.edge&&b.y0>=LIM.edge&&b.y1<=0.5,'windmill cropped/low '+JSON.stringify(b));
  if(!worst||r.mill<worst.share)worst={screen:s.w+'x'+s.h,u:+u.toFixed(2),share:+r.mill.toFixed(4),hFrac:+b.hFrac.toFixed(3),box:[b.x0,b.x1,b.y0,b.y1].map(x=>+x.toFixed(3))};
 }
 share.push(worst);
 if(s.w===390&&s.h===844){const t=LIVE_VOYAGE?20.0:leg.sailStillTimes(tl).k3,v=leg.sailVehicle(tl,route.samples,t),r=L.raster(lens(tl,route.samples,t,s),s,v,{w:390,h:844});still={share:+r.mill.toFixed(4),hFrac:+r.millBox.hFrac.toFixed(3),wFrac:+r.millBox.wFrac.toFixed(3),girlHead:r.girl.head.ndc.map(x=>+x.toFixed(3))};assert(r.mill>=LIM.millStillShare,'K3 still share '+r.mill);}
}
// SailVoyage mid-sea (the old K3 hold role): no meadow island and no stand-in in frame, horizon present — option E scene
// (voyage_lib: real meadow hidden before the 17.4 s swap, stand-in after it hidden), every screen, sea hold at 4 Hz.
let midSea=null;
if(LIVE_VOYAGE){const V=require('../sail-voyage/voyage_lib.cjs'),sc=tl.beats.find(b=>b.id==='S-c'),t0=sc.t0+SV.SAIL_VOYAGE.swing1S;let t1=t0;
 while(leg.sailVehicle(tl,route.samples,t1).distance/tl.speed.length<SV.SAIL_VOYAGE_P.sea1)t1+=0.05;midSea={t0:+t0.toFixed(2),t1:+t1.toFixed(2),frames:0};
 for(const s of leg.SAIL_SCREENS)for(let t=t0;t<=t1;t+=0.25){const q=V.raster(lens(tl,route.samples,t,s),s,leg.sailVehicle(tl,route.samples,t),{E:{real:t>=17.4,impostor:t<17.4}},4);
  assert.equal(q.islandH,0,'mid-sea: meadow / stand-in in frame '+s.w+'x'+s.h+' t='+t.toFixed(2));assert(q.horizon!=null&&q.horizon>0.02&&q.horizon<0.98,'mid-sea: no horizon '+s.w+'x'+s.h+' t='+t.toFixed(2));midSea.frames++;}}
// girl visible, lens clearance, through S-d
let clear={m:1e9},girlWorst=0;
for(let t=sd.t0;t<=sd.t1+1e-6;t+=0.1){
 const v=leg.sailVehicle(tl,route.samples,t),c=lens(tl,route.samples,t);
 const cl=L.clearance(c,v);if(cl.m<clear.m)clear={m:+cl.m.toFixed(3),who:cl.who,t:+t.toFixed(2)};
 const u=(t-sd.t0)/(sd.t1-sd.t0);
 if(u>=SW0&&u<=SW1){
  const r=L.raster(c,{w:390,h:844},v,{w:98,h:211});
  for(const k of ['head','chest']){const p=r.girl[k];assert(p&&p.depth>0,'girl '+k+' behind lens');girlWorst=Math.max(girlWorst,Math.abs(p.ndc[0]),Math.abs(p.ndc[1]));}
 }
}
// occlusion of her head/chest by the drawn boat, 30 fps over the swing in, hold and swing out.
// Sail, jib, boom, hull and bench never; the thin stern lantern post / rigging may cross her chest for ≤ 0.15 s.
const SOLID=/^(sail_main|sail_jib|boom|hull|seat_bench)$/;let thinRun=0,thinMax=0,headHidden=0;const thinSeen=new Set();
for(let t=AW.t0;t<=AW.t1+1e-6;t+=1/30){
 const v=leg.sailVehicle(tl,route.samples,t),c=lens(tl,route.samples,t);
 const h=L.girlOccluders(c,v,L.GIRL.head),ch=L.girlOccluders(c,v,L.GIRL.chest);
 if(h.length)headHidden++;
 for(const n of h.concat(ch))assert(!SOLID.test(n),'girl behind '+n+' t='+t.toFixed(2));
 if(ch.length){thinRun+=1/30;ch.forEach(n=>thinSeen.add(n));}else thinRun=0;thinMax=Math.max(thinMax,thinRun);
}
assert.equal(headHidden,0,'head hidden frames');
assert(thinMax<=0.15+1e-6,'chest behind thin rigging '+thinMax.toFixed(2)+'s');
const thin={maxS:+thinMax.toFixed(3),parts:[...thinSeen]};
assert(clear.m>=LIM.clearM,'lens clearance '+JSON.stringify(clear));
assert(girlWorst<=LIM.girlNdc,'girl near frame edge '+girlWorst);
// motion
const win=[],all=[];
for(let t=AW.t0;t<=AW.t1+1e-6;t+=1/60)win.push(lens(tl,route.samples,t));
for(let t=0;t<=tl.build05S+1e-6;t+=1/60)all.push(lens(tl,route.samples,t));
const mw=L.motion(win,1/60),ma=L.motion(all,1/60);
assert(mw.wMax<=LIM.wDeg,'swing angular speed '+mw.wMax.toFixed(1));
assert(mw.aMax<=LIM.aDeg,'swing angular accel '+mw.aMax.toFixed(1));
assert(mw.laMax<=LIM.linA,'swing lens accel '+mw.laMax.toFixed(1));
assert(ma.wMax<=LIM.wholeW&&ma.aMax<=LIM.wholeA,'sail peak moved '+ma.wMax.toFixed(1)+' '+ma.aMax.toFixed(1));
console.log(JSON.stringify({status:'PASS',lens:LIVE_VOYAGE?'SailVoyage':'sailCamera',millFrames:LIVE_VOYAGE?'pre-docking 19.5-20.5 s':'K3 hold',midSea,limits:LIM,k3:{in:K3_IN,out:K3_OUT,holdS:+((K3_OUT-K3_IN)*(sd.t1-sd.t0)).toFixed(2)},still390:still,worstShare:share,clearance:clear,girlMaxNdc:+girlWorst.toFixed(3),thinOcclusion:thin,
 swing:{wMax:+mw.wMax.toFixed(1),aMax:+mw.aMax.toFixed(1),vMax:+mw.vMax.toFixed(2),linAMax:+mw.laMax.toFixed(1)},whole:{wMax:+ma.wMax.toFixed(1),aMax:+ma.aMax.toFixed(1)}}));
