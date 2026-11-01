'use strict';
// Path v4 geometry (lake-local x,z), pure JS mirror of LakesideBalloon.lakesidePathV4Local for offline tools.
const D=Math.PI/180;
const V4={p0:[9.1105,25.6722],step:[8.7525,25.7099],h0:-84,segs:[['S',.8],['A',2,-130.75],['S',.5],['A',2,-58],['S',.5249]],end:[3.2531,25.0904]};
function samples(stepDeg=5,ds=.05){const out=[[V4.p0[0],V4.p0[1],0,V4.h0]];let p=V4.step.slice(),h=V4.h0,s=Math.hypot(V4.step[0]-V4.p0[0],V4.step[1]-V4.p0[1]);out.push([p[0],p[1],s,h]);
 for(const g of V4.segs){if(g[0]==='S'){const n=Math.max(1,Math.ceil(g[1]/ds));for(let i=1;i<=n;i++){const l=g[1]*i/n;out.push([p[0]+Math.sin(h*D)*l,p[1]+Math.cos(h*D)*l,s+l,h]);}p=[p[0]+Math.sin(h*D)*g[1],p[1]+Math.cos(h*D)*g[1]];s+=g[1];}
  else{const R=g[1],h1=g[2],sg=Math.sign(h1-h),a0=h-sg*90,c=[p[0]-R*Math.sin(a0*D),p[1]-R*Math.cos(a0*D)];const n=Math.max(1,Math.ceil(Math.abs(h1-h)/stepDeg));
   for(let i=1;i<=n;i++){const hh=h+(h1-h)*i/n,a=hh-sg*90;out.push([c[0]+R*Math.sin(a*D),c[1]+R*Math.cos(a*D),s+R*Math.abs(hh-h)*D,hh]);}
   s+=R*Math.abs(h1-h)*D;const a=h1-sg*90;p=[c[0]+R*Math.sin(a*D),c[1]+R*Math.cos(a*D)];h=h1;}}
 return {pts:out,end:p,length:s};}
module.exports={V4,samples};
if(require.main===module){const r=samples();console.log('end',r.end.map(v=>v.toFixed(4)),'expected',V4.end,'length',r.length.toFixed(4),'n',r.pts.length);}
