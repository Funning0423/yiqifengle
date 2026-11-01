process.chdir('/workspace/wt-t03/tools/journey-integration');
const R=require('/workspace/wt-t03/tools/journey-integration/route/route-legs.cjs');
(async()=>{const G=await R.geometry();for(const s of (process.env.ALL?R.SCREENS:[[390,844],[390,520]])){const leg=R.lakeLeg(G,s),T=leg.timing,dt=1/60;let pp=null,pv=null,pd=null,pw=null,mw=0,ma=0,mal=0,tw=0,ta=0;
 for(let t=T.cutT+1e-3;t<=leg.T;t+=dt){const c=leg.cam(t),P=c.position,d=(()=>{const v=c.target.map((x,i)=>x-P[i]),l=Math.hypot(...v);return v.map(x=>x/l)})();
  if(pp){const v=P.map((x,i)=>(x-pp[i])/dt);if(pv){const a=Math.hypot(...v.map((x,i)=>(x-pv[i])/dt));if(a>ma){ma=a;ta=t;}}pv=v;const w=Math.acos(Math.min(1,d[0]*pd[0]+d[1]*pd[1]+d[2]*pd[2]))*180/Math.PI/dt;if(w>mw){mw=w;tw=t;}if(pw!=null)mal=Math.max(mal,Math.abs(w-pw)/dt);pw=w;}pp=P;pd=d;}
 console.log(s.join('x'),'rideT',T.rideT.toFixed(2),'outT',T.outT.toFixed(2),'durS',T.durS.toFixed(2),'board@',(T.rideT+T.outT+T.durS).toFixed(2),'ω',mw.toFixed(1),'@',tw.toFixed(2),'acc',ma.toFixed(2),'@',ta.toFixed(2),'α',mal.toFixed(0));}})();
