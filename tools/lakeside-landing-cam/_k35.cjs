const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),base=A.KN.keys.map(k=>k.slice());const lands=A.SCREENS.map(s=>A.landingFor(s));
function ev(keys){const kn={...A.KN,keys};let occ=0,cl=9,edge=0,gap=999;
 for(const [si,scr] of A.SCREENS.entries()){const S=A.newShot(lands[si],kn);
  for(let t=9.5;t<17;t+=.05){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t));
   if(A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]))occ++;
   cl=Math.min(cl,A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d);gap=Math.min(gap,A.uiCheck(pose,g,scr).gap);
   if(Math.round(t*20)%2===0){const sb=A.southBank(G,bb,pose,scr[0]/scr[1],14,30);edge+=sb.edge+sb.lakeHit;}}}
 const S=A.newShot(lands[0],kn),k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);
 return {occ,cl:+cl.toFixed(2),edge,gap:+gap.toFixed(0),lin:k.linAccMax,ang:k.angAccMax};}
console.log('base',JSON.stringify(ev(base)));
const cands=JSON.parse(process.argv[2]||'[]');
for(const c of cands){const keys=base.map(k=>k.slice());for(const [i,j,v] of c)keys[i][j]=v;console.log(JSON.stringify(c),JSON.stringify(ev(keys)));}
})();
