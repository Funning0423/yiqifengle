'use strict';
// T-03 option B (Grok Bot 2026-10-25): touchdown → board timeline and her framing on the 7 portrait screens (route-legs model of
// the adapter): the board blend starts within 1 s after the place-name sign leaves, she stays in frame from touchdown to the
// board view, her face/chest are never hidden > 0.5 s in a row, and the lens keeps the C1 limits (ω ≤ 20°/s, α ≤ 120°/s², |a| ≤ 3 m/s²).
const assert=require('node:assert/strict');
const R=require('./route/route-legs.cjs'),F=R.F,{createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),LB=H.load('region/LakesideBalloon.ts');
(async()=>{const G=await R.geometry(),K=LB.LAKESIDE_TOUCHDOWN,signOut=K.signAtS+K.signS,out=[];
 assert.equal(LB.lakesideBoardBlendAtS(),signOut+K.blendAfterSignS);assert(K.blendAfterSignS>=0&&K.blendAfterSignS<=1,'blend starts within 1 s after the sign');
 for(const s of R.SCREENS){const leg=R.lakeLeg(G,s),T=leg.timing,a=s[0]/s[1],end=T.rideT+T.outT+T.durS,dt=1/60;
  assert(Math.abs(T.outT-LB.lakesideBoardBlendAtS())<1e-9,'model blend start = lakesideBoardBlendAtS');
  let worst=0,run=0,runMax=0,pp=null,pv=null,pd=null,pw=null,w=0,acc=0,al=0;
  for(let t=T.rideT;t<=end+1e-9;t+=dt){const c=leg.cam(t),h=leg.her(t),{fw,r,up,th}=F.basis(c);
   for(const p of [h.face,h.head,h.chest,h.root,...(h.box||[])]){if(!p)continue;const v=p.map((q,i)=>q-c.position[i]),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];
    worst=Math.max(worst,z<=0?9:Math.abs((v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*a)),z<=0?9:Math.abs((v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th)));}
   const occ=['face','chest'].some(k=>h[k]&&leg.los(t,c.position,h[k]));run=occ?run+dt:0;runMax=Math.max(runMax,run);
   const P=c.position,d=(()=>{const q=c.target.map((x,i)=>x-P[i]),l=Math.hypot(...q);return q.map(x=>x/l);})();
   if(pp){const v=P.map((x,i)=>(x-pp[i])/dt);if(pv)acc=Math.max(acc,Math.hypot(...v.map((x,i)=>(x-pv[i])/dt)));pv=v;const o=Math.acos(Math.min(1,d[0]*pd[0]+d[1]*pd[1]+d[2]*pd[2]))*180/Math.PI/dt;w=Math.max(w,o);if(pw!==null)al=Math.max(al,Math.abs(o-pw)/dt);pw=o;}pp=P;pd=d;}
  const row={screen:s.join('x'),touchdownS:+T.rideT.toFixed(2),blendAtS:+T.outT.toFixed(2),blendS:+T.durS.toFixed(2),boardAtS:+(T.outT+T.durS).toFixed(2),worstNdc:+worst.toFixed(3),occFaceChestMaxS:+runMax.toFixed(2),omegaDegS:+w.toFixed(1),alphaDegS2:+al.toFixed(0),accMS2:+acc.toFixed(2)};out.push(row);
  assert(worst<=1,'she stays in frame '+JSON.stringify(row));assert(runMax<=.5,'face/chest hidden ≤ 0.5 s '+JSON.stringify(row));
  assert(w<=20&&al<=120&&acc<=3,'C1 limits '+JSON.stringify(row));}
 console.log(JSON.stringify({status:'PASS',signOutS:signOut,rows:out}));})().catch(e=>{console.error(e);process.exit(1);});
