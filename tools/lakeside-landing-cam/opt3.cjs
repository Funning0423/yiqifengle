'use strict';
// Walk-segment lens search: zero forbidden-zone rays (390×844 + 768×1024) with clearance, UI gap, LOS, accel. Usage: node opt3.cjs iters seedJSON
const A=require('./audit.cjs');
const iters=+(process.argv[2]||300),seed0=Object.assign({},A.KN,process.argv[3]?JSON.parse(process.argv[3]):{});
(async()=>{const G=await A.geometry(),from=A.startCamera(0),S2=[[390,844],[768,1024]],lands=S2.map(s=>A.landingFor(s));
 const bb0=A.balAt(G,A.LJ.toWorld(seed0.launchLocal));
 function cost(kn,detail){let c=0;const d=[];
  for(const [si,scr] of S2.entries()){const S=A.newShot(lands[si],kn),aspect=scr[0]/scr[1];
   for(let t=0;t<S.cut-1e-6;t+=.25){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t);
    const cl=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb0,pose.position).d),ui=A.uiCheck(pose,g,scr),sb=A.southBank(G,bb0,pose,aspect,14,30);
    const hd=A.los(G,bb0,pose.position,[g[0],g[1]+1.55,g[2]]),ch=A.los(G,bb0,pose.position,[g[0],g[1]+1.2,g[2]]);
    c+=200*Math.max(0,1.25-cl)+Math.max(0,22-ui.gap)*.8+(hd?30:0)+(ch?30:0)+8*sb.edge+8*sb.lakeHit+(t>0?0:0);if(detail)d.push([scr[0],t,+cl.toFixed(2),ui.gap,sb.edge,sb.gap,hd?1:0,ch?1:0]);}
   if(si===0){const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);c+=5000*Math.max(0,k.linAccMax-2.85)+50*Math.max(0,k.angAccMax-110);if(detail)d.push(['kin',JSON.stringify(k)]);}}
  return detail?{c,d}:c;}
 const clone=kn=>({...kn,walkLens:kn.walkLens.slice(),walkLensEnd:kn.walkLensEnd.slice()});
 let best=clone(seed0),bc=cost(best),step=2;console.log('seed',bc.toFixed(1));
 for(let it=0;it<iters;it++){const cand=clone(best);for(let n=0;n<(Math.random()<.4?2:1);n++){const r=Math.floor(Math.random()*11),dv=(Math.random()*2-1)*step;
   if(r<5)cand.walkLens[r]=+(cand.walkLens[r]+dv).toFixed(2);else if(r<10)cand.walkLensEnd[r-5]=+(cand.walkLensEnd[r-5]+dv).toFixed(2);else cand.walkBlendInS=+Math.max(2,Math.min(7.5,cand.walkBlendInS+dv*.5)).toFixed(2);}
  const c=cost(cand);if(c<bc){bc=c;best=cand;}if(it%50===49){step=Math.max(.3,step*.85);console.log(it+1,bc.toFixed(1));}}
 const r=cost(best,true);console.log('BEST',JSON.stringify({walkLens:best.walkLens,walkLensEnd:best.walkLensEnd,walkBlendInS:best.walkBlendInS}));
 for(const row of r.d)if(row[0]==='kin'||row[2]<1.1||row[3]<13||row[4]||row[6]||row[7])console.log('bad',JSON.stringify(row));
})();
