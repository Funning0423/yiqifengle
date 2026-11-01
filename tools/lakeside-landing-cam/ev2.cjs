'use strict';
// v2.1 quick evaluator (void rule). usage: [SCENE_REF=ref] node ev2.cjs '<knob overrides JSON>' [t0] [t1] [dt] [screens idx csv]
const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),kn={...A.KN,...JSON.parse(process.argv[2]||'{}')},t0=+(process.argv[3]||0),t1=process.argv[4]!=null?+process.argv[4]:1e9,dt=+(process.argv[5]||.1),idx=(process.argv[6]||'0,1,2').split(',').map(Number);
 const out={};for(const si of idx){const scr=A.SCREENS[si],S=A.newShot(A.landingFor(scr),kn);const rays=[];let cl=9,clT=0,gap=999,gapT=0,occ=[];
  for(let t=t0;t<=Math.min(t1,S.timing.durationS)+1e-9;t+=dt){if(S.cover(t)>=.999)continue;const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t)),vr=A.voidRays(G,bb,pose,scr[0]/scr[1]);if(vr.bad)rays.push(t.toFixed(2)+':'+vr.bad+(vr.through?'t'+vr.through:''));
   const c=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d);if(c<cl){cl=c;clT=t;}const u=A.uiCheck(pose,g,scr).gap;if(u<gap){gap=u;gapT=t;}
   if(A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]])||A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]))occ.push(+t.toFixed(2));}
  out[scr.join('x')]={rays:rays.join(' ')||'0',cl:+cl.toFixed(2),clT:+clT.toFixed(2),gap:+gap.toFixed(1),gapT:+gapT.toFixed(2),occ:occ.length?occ.join(','):0};
  if(si===idx[0]){const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},from);out.kin=k;out.cut=+S.cut.toFixed(2);out.T=+S.timing.durationS.toFixed(2);}}
 console.log(A.SCENE_REF||'worktree',JSON.stringify(out));})();
