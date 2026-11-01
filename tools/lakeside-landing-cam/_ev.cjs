const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),lands=A.SCREENS.map(s=>A.landingFor(s));
for(const arg of process.argv.slice(2)){const kn={...A.KN,...JSON.parse(arg)};const r={};
 for(const [si,scr] of A.SCREENS.entries()){const S=A.newShot(lands[si],kn);let occ=[],cl=9,clT=0,edge=[],gap=999;
  for(let t=9.5;t<S.timing.durationS;t+=.05){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t));
   if(A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]))occ.push(+t.toFixed(2));
   const c=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d);if(c<cl){cl=c;clT=t;}gap=Math.min(gap,A.uiCheck(pose,g,scr).gap);
   if(Math.round(t*20)%2===0){const sb=A.southBank(G,bb,pose,scr[0]/scr[1],14,30);if(sb.edge+sb.lakeHit)edge.push(+t.toFixed(2));}}
  r[scr.join('x')]={occ:occ.length?occ[0]+'..'+occ[occ.length-1]+'('+occ.length+')':0,cl:+cl.toFixed(2),clT:+clT.toFixed(2),edge:edge.length?edge[0]+'..'+edge[edge.length-1]+'('+edge.length+')':0,gap:+gap.toFixed(0)};
  if(si===0){const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);r.kin=[k.linAccMax,k.linAt,k.angAccMax,k.angAt];}}
 console.log(JSON.stringify(r));}})();
