'use strict';
// v2 lens search (walk lens + flight keys) on the HANDOFF §4 penalty, 390×844. Usage: node opt2.cjs iters [seedKnobsJSON]
const A=require('./audit.cjs');const {B}=A;
const iters=+(process.argv[2]||400),seed0=Object.assign({},A.KN,process.argv[3]?JSON.parse(process.argv[3]):{});
(async()=>{const G=await A.geometry(),scr=[390,844],land=A.landingFor(scr),from=A.startCamera(0),aspect=scr[0]/scr[1];const cache=new Map();
 const bbAt=v=>{const k=v.map(x=>x.toFixed(2)).join();if(!cache.has(k))cache.set(k,A.balAt(G,v));return cache.get(k);};
 function cost(kn,detail){const S=A.newShot(land,kn),T=S.timing.durationS;let c=0;const d=[];
  for(let t=0;t<=T+1e-9;t+=.25){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),v=S.vehicle(t),g=S.girl(t),bb=bbAt(v);
   const cl=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d),ui=A.uiCheck(pose,g,scr),sb=A.southBank(G,bb,pose,aspect,12,26),bo=A.balloonOnScreen(pose,aspect,v);
   const hd=A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]]),ch=A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]);
   const e=150*Math.max(0,1.25-cl)+Math.max(0,20-ui.gap)*.6+(hd?25:0)+(ch?25:0)+6*sb.edge+6*sb.lakeHit+30*Math.max(0,.25-bo.envelope);c+=e;if(detail)d.push([t,+cl.toFixed(2),ui.gap,sb.edge,sb.gap,+bo.envelope.toFixed(2),hd?1:0,ch?1:0]);}
  const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);c+=300*Math.max(0,k.linAccMax-2.7)+3*Math.max(0,k.angAccMax-105);
  return detail?{c,k,d}:c;}
 const vars=[];for(let i=0;i<5;i++)vars.push(['walkLens',i]);for(let i=0;i<seed0.keys.length-1;i++)for(const j of[1,2,3,6])vars.push(['keys',i,j]);
 const clone=kn=>({...kn,walkLens:kn.walkLens.slice(),keys:kn.keys.map(k=>k.slice())});
 let best=clone(seed0),bc=cost(best),step=2.5;console.log('seed',bc.toFixed(1));
 for(let it=0;it<iters;it++){const cand=clone(best);for(let n=0;n<(Math.random()<.3?2:1);n++){const v=vars[Math.floor(Math.random()*vars.length)];const dv=(Math.random()*2-1)*step*(v[0]==='walkLens'?.5:1);
   if(v[0]==='walkLens')cand.walkLens[v[1]]=+(cand.walkLens[v[1]]+dv).toFixed(2);else cand.keys[v[1]][v[2]]=+(cand.keys[v[1]][v[2]]+dv).toFixed(2);}
  for(const k of cand.keys)k[3]=Math.max(1.5,k[3]);cand.walkLens[2]=Math.max(.3,cand.walkLens[2]);
  const c=cost(cand);if(c<bc){bc=c;best=cand;}if(it%100===99){step=Math.max(.4,step*.8);console.log(it+1,bc.toFixed(1));}}
 const r=cost(best,true);console.log('BEST',JSON.stringify({walkLens:best.walkLens,keys:best.keys}));console.log(JSON.stringify(r.k));
 for(const row of r.d)if(row[1]<1.1||row[2]<13||row[3]||row[5]<.15||row[6]||row[7])console.log('bad',JSON.stringify(row));
})();
