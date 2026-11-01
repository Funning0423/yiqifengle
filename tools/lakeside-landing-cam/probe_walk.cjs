'use strict';
// Static-pose feasibility probe along the walk: which camera poses around her see zero forbidden-zone rays (390×844 + 768×1024)?
const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),K=A.KN,bb=A.balAt(G,A.LJ.toWorld(K.launchLocal));
 const pts=[[2,.58,63.2],[-1,.58,61],[-2.5,.58,57.5],[-3,.58,55.6]];
 for(const lp of pts){const g=A.LJ.toWorld(lp),c=[g[0],g[1]+1.2,g[2]];const ok=[];
  for(let az=0;az<360;az+=15)for(const r of [3,4.5,6,8])for(const up of [-.4,.3,1.2,2.5,4])for(const tilt of [-.6,0,.6]){
   const a=az*Math.PI/180,p=[c[0]+Math.sin(a)*r,c[1]+up,c[2]+Math.cos(a)*r],pose={position:p,target:[c[0],c[1]+tilt,c[2]],fovVerticalDeg:48};
   const cl=Math.min(A.nearest(G.stat,p).d,A.nearest(bb,p).d);if(cl<1.1)continue;
   let e=0,gp=1e9;for(const s of [[390,844],[768,1024]]){const sb=A.southBank(G,bb,pose,s[0]/s[1],14,30);e+=sb.edge+sb.lakeHit;gp=Math.min(gp,A.uiCheck(pose,g,s).gap);}
   if(e)continue;if(gp<13)continue;
   const hd=A.los(G,bb,p,[g[0],g[1]+1.55,g[2]]),ch=A.los(G,bb,p,[g[0],g[1]+1.2,g[2]]);if(hd||ch)continue;
   const lpos=A.toLocal(p);ok.push([az,r,up,tilt,+cl.toFixed(2),+gp.toFixed(0),lpos.map(x=>+x.toFixed(1))].join(' '));}
  console.log('girl',lp,'ok',ok.length);for(const o of ok)console.log('  ',o);}
})();
