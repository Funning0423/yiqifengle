const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),bb=A.balAt(G,A.LJ.toWorld(A.KN.launchLocal)),base=JSON.parse(process.argv[2]),lands=A.SCREENS.map(s=>A.landingFor(s));
 const res=[];for(const ds of [-.3,0,.3])for(const du of [-.15,0,.15])for(const da of [-.25,0,.25])for(const dau of [-.2,0,.2]){const W1=base.W1.slice();W1[1]+=ds;W1[2]+=du;W1[3]+=da;W1[4]+=dau;
  const kn={...A.KN,walkLens:base.W0,walkLensEnd:W1,walkBlendInS:base.Tb};let n=0,cl=9,gap=999,occ=0;
  for(const si of [0,2]){const scr=A.SCREENS[si],S=A.newShot(lands[si],kn);for(let t=+process.argv[3];t<S.cut;t+=.05){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t),sb=A.southBank(G,bb,pose,scr[0]/scr[1]);n+=sb.edge+sb.lakeHit;
   cl=Math.min(cl,A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d);gap=Math.min(gap,A.uiCheck(pose,g,scr).gap);if(A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]))occ++;}}
  res.push({W1:W1.map(x=>+x.toFixed(2)),n,cl:+cl.toFixed(2),gap:+gap.toFixed(0),occ});}
 const ok=res.filter(r=>r.gap>=20&&!r.occ&&r.cl>=1.15);ok.sort((a,b)=>a.n-b.n||b.cl-a.cl);for(const r of ok.slice(0,12))console.log(JSON.stringify(r));})();
