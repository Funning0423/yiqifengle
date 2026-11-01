'use strict';
// Lens-key search for the lakeside balloon shot (hill climbing on the HANDOFF §4 penalty). Usage: node opt.cjs [iters] [seedKeysJSON]
const A=require('./audit.cjs');const {B,S6,bank}=A;
const iters=+(process.argv[2]||400),seed=process.argv[3]?JSON.parse(process.argv[3]):A.KN.keys.map(k=>k.slice());
(async()=>{const G=await A.geometry(),scr=[390,844],land=A.landingFor(scr),from=A.startCamera(0),aspect=scr[0]/scr[1];
 const cache=new Map();const bbAt=(v,t)=>{const k=t.toFixed(2);if(!cache.has(k))cache.set(k,A.balAt(G,v));return cache.get(k);};
 function cost(keys,detail){const kn=Object.assign({},A.KN,{keys});const F=B.lakesideBalloonFlight(S6,bank,land,kn),T=F.timing.durationS;let c=0;const d=[];
  for(let t=0;t<=T+1e-9;t+=.25){const pose=F.camera(t,from),v=F.vehicle(t),bb=bbAt(v,t);
   const cl=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d),ui=A.uiCheck(pose,v,scr),sb=A.southBank(G,bb,pose,aspect,14,30),bo=A.balloonOnScreen(pose,aspect,v);
   const hd=A.los(G,bb,pose.position,[v[0],v[1]+1.55,v[2]]),ch=A.los(G,bb,pose.position,[v[0],v[1]+1.2,v[2]]);
   const e=120*Math.max(0,1.4-cl)+Math.max(0,22-ui.gap)*.6+(hd?25:0)+(ch?25:0)+4*sb.bad+30*Math.max(0,.3-bo.envelope)+(bo.basket?0:8);c+=e;if(detail)d.push([t,+cl.toFixed(2),ui.gap,sb.bad,+bo.envelope.toFixed(2),hd?1:0,ch?1:0]);}
  const k=A.kinematics({camera:(t,f)=>F.camera(t,f),timing:F.timing},from);c+=400*Math.max(0,k.linAccMax-2.6)+2*Math.max(0,k.angAccMax-100);
  for(let i=0;i<keys.length;i++)for(const j of[1,2,3])c+=.01*(keys[i][j]-seed[i][j])**2;
  return detail?{c,k,d}:c;}
 let best=seed.map(k=>k.slice()),bc=cost(best),step=3;console.log('seed',bc.toFixed(1));
 for(let it=0;it<iters;it++){const cand=best.map(k=>k.slice()),i=Math.floor(Math.random()*(cand.length-1)),j=1+Math.floor(Math.random()*3);cand[i][j]=+(cand[i][j]+(Math.random()*2-1)*step).toFixed(2);
  if(Math.random()<.3){const j2=1+Math.floor(Math.random()*3);cand[i][j2]=+(cand[i][j2]+(Math.random()*2-1)*step).toFixed(2);}
  for(const k of cand)k[3]=Math.max(1.5,k[3]);const c=cost(cand);if(c<bc){bc=c;best=cand;}if(it%100===99){step=Math.max(.5,step*.75);console.log(it+1,bc.toFixed(1));}}
 const r=cost(best,true);console.log(JSON.stringify(best));console.log(JSON.stringify(r.k));for(const row of r.d)if(row[1]<1.1||row[2]<13||row[3]||row[4]<.2||row[5]||row[6])console.log('bad',JSON.stringify(row));
})();
