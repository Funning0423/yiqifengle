'use strict';
/** Seated fix step 1 (b21 option A, 运镜bot): stand_up front-hem flip near the end of the rise.  Corrective keys on the front
 *  panel joints (skirt.front pitch A, skirt.front.mid pitch F, skirt.front.low pitch B) ONLY in stand_up, only on the 30 fps keys
 *  where the thigh is within 40 deg of vertical (blend 40->32 deg), grid search per key against the strict lift limits with headroom
 *  (lift/apron <= 2.7 cm, below knee >= 4.8 cm, vertex <= 4.6 cm, flare <= 27 cm) + leg penetration count + smoothness.
 *  Penetration left over is cleared by the corrective shapes (seat_morph.cjs).  node seat_lift.cjs --in glb --out glb */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),GW=require('./glb_write.cjs');
const a=process.argv.slice(2),arg=(n,d)=>a.includes(n)?a[a.indexOf(n)+1]:d;const IN=arg('--in',H.GLB),OUT=arg('--out','/tmp/ss/lift.glb');
const R=H.load(IN),S=H.sets(R),M=H.loadMeta(path.join(path.dirname(IN),'anim_meta.json'));const CLIP='stand_up',C=R.clips[CLIP];
const NX=[-1,0,0],aa=(deg)=>{const h=deg*Math.PI/360;return [-Math.sin(h),0,0,Math.cos(h)];};
const J={A:'skirt.front',F:'skirt.front.mid',B:'skirt.front.low'};const ch={};for(const k in J){ch[k]=C.channels.find(x=>x.path==='rotation'&&x.node===R.byName[J[k]]);if(!ch[k])throw Error('no ch '+J[k]);}
const TG={lift:0.027,apron:0.027,bk:0.048,vert:0.046,flare:0.27};
const keyT=Array.from(ch.A.inp);const orig={};for(const k in ch)orig[k]=Float64Array.from(ch[k].out);
const sameT=k=>Array.from(ch[k].inp).every((t,i)=>Math.abs(t-keyT[i])<1e-6);if(!sameT('B'))throw Error('B times differ');
// skirt.front.mid has 2 keys (rest): resample it onto the 30 fps grid so it can carry keys
if(!sameT('F')){const vals=[];for(const t of keyT)vals.push(...H.sampleChannel(ch.F,t));ch.F.inp=Float64Array.from(keyT);ch.F.out=Float64Array.from(vals);orig.F=Float64Array.from(vals);}
const setKey=(k,i,deg)=>{ch[k].out.set(H.qmul(aa(deg),Array.from(orig[k].slice(i*4,i*4+4))),i*4);};
const evalAt=t=>{H.applyClip(R,CLIP,t);const W=H.world(R);const mw=H.clipMorph(M,CLIP,t);const m=H.hemMetrics(R,S,mw);const p=H.penetration(R,S,mw,W);
  const v={lift:m.dress.lift,apron:m.apron.lift,bk:m.dress.belowKnee,flare:Math.max(m.dress.flare,m.apron.flare),vert:Math.max(m.dress.maxVertLift,m.apron.maxVertLift)};return {v,th:m.thighDeg,pen:p.count,pd:p.maxDepth};};
const over=v=>Math.max(0,v.lift-TG.lift)+Math.max(0,v.apron-TG.apron)+Math.max(0,TG.bk-v.bk)+Math.max(0,v.vert-TG.vert)+Math.max(0,v.flare-TG.flare);
const th=keyT.map(t=>{H.applyClip(R,CLIP,t);return H.thighFromVertical(R,H.world(R));});
const blend=th.map(d=>d<=32?1:d>=40?0:(40-d)/8);const P=keyT.map(()=>({A:0,F:0,B:0}));let prev={A:0,F:0,B:0};const log=[];
for(let i=0;i<keyT.length;i++){if(blend[i]<=0)continue;let best=null;
  const AR=[],FR=[],BR=[];for(let x=-36;x<=6;x+=3)AR.push(x);for(let x=-30;x<=12;x+=3)FR.push(x);for(let x=-30;x<=15;x+=3)BR.push(x);
  const tryP=p=>{for(const k in p)setKey(k,i,p[k]*blend[i]);const e=evalAt(keyT[i]);const c=1000*over(e.v)+40*e.pen+0.15*(Math.abs(p.A)+Math.abs(p.F)+Math.abs(p.B))+0.1*(Math.abs(p.A-prev.A)+Math.abs(p.F-prev.F)+Math.abs(p.B-prev.B));if(!best||c<best.c)best={c,p:{...p},e};};
  for(const A of AR)for(const B of BR)tryP({A,F:prev.F,B});const b1=best.p;for(const F of FR)tryP({A:b1.A,F,B:b1.B});
  for(let r=0;r<2;r++){const b=best.p;for(const dA of [-2,-1,0,1,2])for(const dF of [-2,-1,0,1,2])for(const dB of [-2,-1,0,1,2])tryP({A:b.A+dA,F:b.F+dF,B:b.B+dB});}
  for(const k in best.p)setKey(k,i,best.p[k]*blend[i]);P[i]=best.p;prev=best.p;
  log.push({t:+keyT[i].toFixed(3),th:+th[i].toFixed(1),blend:+blend[i].toFixed(2),p:best.p,v:Object.fromEntries(Object.entries(best.e.v).map(([k,v])=>[k,+(v*100).toFixed(2)])),pen:best.e.pen});console.error(JSON.stringify(log[log.length-1]));}
// verify at 120 Hz
let bad=0,mx={lift:-9,apron:-9,bk:9,flare:-9,vert:-9};for(let t=0;t<=C.duration+1e-9;t+=1/120){const e=evalAt(Math.min(t,C.duration));if(e.th>30)continue;for(const k in mx)mx[k]=k==='bk'?Math.min(mx[k],e.v[k]):Math.max(mx[k],e.v[k]);
  if(e.v.lift>0.03||e.v.apron>0.03||e.v.bk<0.045||e.v.flare>0.28||e.v.vert>0.05)bad++;}
const edits=['A','F','B'].map(k=>({anim:CLIP,node:R.byName[J[k]],path:'rotation',times:Float32Array.from(ch[k].inp),values:Float32Array.from(ch[k].out)}));
fs.writeFileSync(OUT,GW.rewrite(R.buf,edits,[]));fs.copyFileSync(path.join(path.dirname(IN),'anim_meta.json'),path.join(path.dirname(OUT),'anim_meta.json'));
console.log(JSON.stringify({out:OUT,bad120:bad,max:Object.fromEntries(Object.entries(mx).map(([k,v])=>[k,+(v*100).toFixed(2)])),keys:log.length}));
