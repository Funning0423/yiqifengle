const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),K=A.KN,bb=A.balAt(G,A.LJ.toWorld(K.launchLocal)),S=A.newShot(A.landingFor([390,844]),K);
 for(const t of JSON.parse(process.argv[2])){const g=S.girl(t),gl=A.toLocal(g),c=[g[0],g[1]+1.2,g[2]];const ok={};
  for(let az=0;az<360;az+=15)for(const r of [3.5,5,6.5])for(const up of [0,.6,1.4]){const a=az*Math.PI/180,pl=[gl[0]+Math.sin(a)*r,1.78+up,gl[2]+Math.cos(a)*r],p=A.LJ.toWorld(pl),pose={position:p,target:c,fovVerticalDeg:48};
   const cl=Math.min(A.nearest(G.stat,p).d,A.nearest(bb,p).d);if(cl<1.15)continue;let e=0,gp=1e9;for(const s of [[768,1024],[390,844]]){e+=A.voidRays(G,bb,pose,s[0]/s[1],18,39).bad;if(e)break;gp=Math.min(gp,A.uiCheck(pose,g,s).gap);}
   if(e||gp<20)continue;if(A.los(G,bb,p,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,p,c))continue;(ok[az]=ok[az]||[]).push(r+'/'+up);}
  console.log('t',t,'girl',gl.map(x=>x.toFixed(1)).join(','),JSON.stringify(ok));}})();
