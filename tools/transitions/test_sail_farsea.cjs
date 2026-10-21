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
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
const sd=tl.beats.find(b=>b.id==='S-d'),at=u=>sd.t0+(sd.t1-sd.t0)*u;
const LIM={millShare:0.010,millStillShare:0.020,millH:0.12,edge:0.03,girlNdc:0.8,clearM:1.1,wDeg:110,aDeg:360,linA:60,wholeW:173,wholeA:706};
assert(tl.build05S<=30.5,'sail clock '+tl.build05S);
assert(Math.abs(tl.build05S-23.821462039439513)<1e-6,'sail clock changed '+tl.build05S);
const K3_IN=leg.SAIL_K3_IN,K3_OUT=leg.SAIL_K3_OUT;
assert(K3_IN>0.12&&K3_OUT>K3_IN&&K3_OUT<0.56,'K3 hold window');
// Stills updated for the 3.6 m/s profile; camera geometry limits below stay unchanged.
const GOLD={K1:{t:8.7,p:[-4.7244,3.39,5.8483],q:[-0.1161,0.14,12.8998],f:48},K2:{t:11.48,p:[-2.3627,4.29,26.1218],q:[0.3159,0.14,9.3044],f:52},K4:{t:16.64,p:[-2.2216,5.29,24.3479],q:[-4.4499,0.14,35.7802],f:50},K5:{t:17.72,p:[-3.3243,6.1963,27.4375],q:[-4.4172,0.14,39.5452],f:48.70521623747569},K6:{t:tl.build05S-0.12,p:[-3.55,5.89,40.4],q:[-4.4,0.14,51.6],f:48}};
for(const [k,g] of Object.entries(GOLD)){const c=leg.sailCamera(tl,route.samples,g.t);for(let i=0;i<3;i++){assert(Math.abs(c.position[i]-g.p[i])<2e-3,k+' position moved');assert(Math.abs(c.target[i]-g.q[i])<2e-3,k+' target moved');}assert(Math.abs(c.fovVerticalDeg-g.f)<1e-6,k+' fov');}
// windmill share through the hold, every screen
const share=[];let still=null;
for(const s of leg.SAIL_SCREENS){
 let worst=null;
 for(let u=K3_IN;u<=K3_OUT+1e-6;u+=0.02){
  const t=at(Math.min(u,K3_OUT-1e-4)),v=leg.sailVehicle(tl,route.samples,t),c=leg.sailCamera(tl,route.samples,t,s);
  const r=L.raster(c,s,v);
  assert(r.millBox,'windmill not on screen '+s.w+'x'+s.h+' u='+u.toFixed(2));
  const b=r.millBox;
  assert(r.mill>=LIM.millShare,'windmill share '+r.mill.toFixed(4)+' '+s.w+'x'+s.h+' u='+u.toFixed(2));
  assert(b.hFrac>=LIM.millH,'windmill height '+b.hFrac.toFixed(3));
  assert(b.x0>=LIM.edge&&b.x1<=1-LIM.edge&&b.y0>=LIM.edge&&b.y1<=0.5,'windmill cropped/low '+JSON.stringify(b));
  if(!worst||r.mill<worst.share)worst={screen:s.w+'x'+s.h,u:+u.toFixed(2),share:+r.mill.toFixed(4),hFrac:+b.hFrac.toFixed(3),box:[b.x0,b.x1,b.y0,b.y1].map(x=>+x.toFixed(3))};
 }
 share.push(worst);
 if(s.w===390&&s.h===844){const t=at(0.4),v=leg.sailVehicle(tl,route.samples,t),r=L.raster(leg.sailCamera(tl,route.samples,t,s),s,v,{w:390,h:844});still={share:+r.mill.toFixed(4),hFrac:+r.millBox.hFrac.toFixed(3),wFrac:+r.millBox.wFrac.toFixed(3),girlHead:r.girl.head.ndc.map(x=>+x.toFixed(3))};assert(r.mill>=LIM.millStillShare,'K3 still share '+r.mill);}
}
// girl visible, lens clearance, through S-d
let clear={m:1e9},girlWorst=0;
for(let t=sd.t0;t<=sd.t1+1e-6;t+=0.1){
 const v=leg.sailVehicle(tl,route.samples,t),c=leg.sailCamera(tl,route.samples,t);
 const cl=L.clearance(c,v);if(cl.m<clear.m)clear={m:+cl.m.toFixed(3),who:cl.who,t:+t.toFixed(2)};
 const u=(t-sd.t0)/(sd.t1-sd.t0);
 if(u>=0.12&&u<=0.56){
  const r=L.raster(c,{w:390,h:844},v,{w:98,h:211});
  for(const k of ['head','chest']){const p=r.girl[k];assert(p&&p.depth>0,'girl '+k+' behind lens');girlWorst=Math.max(girlWorst,Math.abs(p.ndc[0]),Math.abs(p.ndc[1]));}
 }
}
// occlusion of her head/chest by the drawn boat, 30 fps over the swing in, hold and swing out.
// Sail, jib, boom, hull and bench never; the thin stern lantern post / rigging may cross her chest for ≤ 0.15 s.
const SOLID=/^(sail_main|sail_jib|boom|hull|seat_bench)$/;let thinRun=0,thinMax=0,headHidden=0;const thinSeen=new Set();
for(let t=at(0.12);t<=at(0.56)+1e-6;t+=1/30){
 const v=leg.sailVehicle(tl,route.samples,t),c=leg.sailCamera(tl,route.samples,t);
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
for(let t=at(leg.SAIL_BEAM_IN);t<=at(0.56)+1e-6;t+=1/60)win.push(leg.sailCamera(tl,route.samples,t));
for(let t=0;t<=tl.build05S+1e-6;t+=1/60)all.push(leg.sailCamera(tl,route.samples,t));
const mw=L.motion(win,1/60),ma=L.motion(all,1/60);
assert(mw.wMax<=LIM.wDeg,'swing angular speed '+mw.wMax.toFixed(1));
assert(mw.aMax<=LIM.aDeg,'swing angular accel '+mw.aMax.toFixed(1));
assert(mw.laMax<=LIM.linA,'swing lens accel '+mw.laMax.toFixed(1));
assert(ma.wMax<=LIM.wholeW&&ma.aMax<=LIM.wholeA,'sail peak moved '+ma.wMax.toFixed(1)+' '+ma.aMax.toFixed(1));
console.log(JSON.stringify({status:'PASS',limits:LIM,k3:{in:K3_IN,out:K3_OUT,holdS:+((K3_OUT-K3_IN)*(sd.t1-sd.t0)).toFixed(2)},still390:still,worstShare:share,clearance:clear,girlMaxNdc:+girlWorst.toFixed(3),thinOcclusion:thin,
 swing:{wMax:+mw.wMax.toFixed(1),aMax:+mw.aMax.toFixed(1),vMax:+mw.vMax.toFixed(2),linAMax:+mw.laMax.toFixed(1)},whole:{wMax:+ma.wMax.toFixed(1),aMax:+ma.aMax.toFixed(1)}}));
