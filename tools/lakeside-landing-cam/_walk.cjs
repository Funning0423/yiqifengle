// usage: node _walk.cjs '[{"W0":[b,s,up,ah,au,fov],"endLocal":[x,y,z],"Tb":3}, ...]'  (endLocal -> walkLensEnd solved; aim chest)
const A=require('./audit.cjs');
function solveEnd(kn,W0,endLocal,land){// lens(t_end)=p - wd*b + wr*s, y=chest+up
 const S=A.newShot(land,{...kn,walkLens:W0,walkLensEnd:[0,0,0,0,0,W0[5]],walkBlendInS:.01}),t=S.R.walkS,p0=S.camera(t,null).position;
 const S1=A.newShot(land,{...kn,walkLens:W0,walkLensEnd:[1,0,0,0,0,W0[5]],walkBlendInS:.01}).camera(t,null).position,S2=A.newShot(land,{...kn,walkLens:W0,walkLensEnd:[0,1,0,0,0,W0[5]],walkBlendInS:.01}).camera(t,null).position;
 const e=A.LJ.toWorld(endLocal),h=[S1[0]-p0[0],S1[2]-p0[2]],r=[S2[0]-p0[0],S2[2]-p0[2]],D=[e[0]-p0[0],e[2]-p0[2]],det=h[0]*r[1]-h[1]*r[0];
 return [+((D[0]*r[1]-D[1]*r[0])/det).toFixed(3),+((h[0]*D[1]-h[1]*D[0])/det).toFixed(3),+(e[1]-p0[1]).toFixed(3),0,0,W0[5]];}
module.exports={solveEnd};
if(require.main===module)(async()=>{const G=await A.geometry(),from=A.startCamera(0),lands=A.SCREENS.map(s=>A.landingFor(s)),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal));const fine=process.env.FINE?1:0;
 for(const c of JSON.parse(process.argv[2])){const W1=c.W1||solveEnd(A.KN,c.W0,c.endLocal,lands[0]);const kn={...A.KN,...(c.kn||{}),walkLens:c.W0,walkLensEnd:W1,walkBlendInS:c.Tb};
  const res={W1};for(const [si,scr] of A.SCREENS.entries()){if(!fine&&si===1)continue;const S=A.newShot(lands[si],kn);let rays=[],cl=9,gap=999,occ=0,last0=-1;
   for(let t=0;t<S.cut;t+=(+process.env.DT||.1)){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t);const sb=fine?A.southBank(G,bb,pose,scr[0]/scr[1]):A.southBank(G,bb,pose,scr[0]/scr[1],14,30);const n=sb.edge+sb.lakeHit;if(n){rays.push(t.toFixed(1)+':'+n);last0=t;}
    cl=Math.min(cl,A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d);gap=Math.min(gap,A.uiCheck(pose,g,scr).gap);
    if(A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]))occ++;}
   res[scr[0]]={lastRay:+last0.toFixed(1),rays:rays.join(' '),cl:+cl.toFixed(2),gap:+gap.toFixed(0),occ};
   if(si===0){const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);res.kin=[k.linAccMax,k.linAt,k.angAccMax,k.angAt];}}
  console.log(JSON.stringify(c),JSON.stringify(res));}})();
