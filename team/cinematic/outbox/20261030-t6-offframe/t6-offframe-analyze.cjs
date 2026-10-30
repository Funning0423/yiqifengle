const path=require('path');process.chdir('/workspace/wt-t6');
const M=require('/workspace/wt-t6/tools/region-nodes/sky-rail-model.cjs'),{H,RL}=M,LS=H.load('region/LensSmooth.ts');
const ss=x=>(x=Math.max(0,Math.min(1,x)))*x*x*(x*(x*6-15)+10);
const out=[];
for(const w of M.WALKS)for(const sc of M.SCREENS)for(const [lab,o] of [['board',{}],...(w==='S4>S6'?[['fromS6',{fromS6:true}]]:[])]){
 const smp=M.samples(w,sc,o);const B=M.board(sc);
 // recompute join T per part
 let Tin=null,Tout=null;{const h=smp[0].h;Tin=RL.skyRailJoinPlan(w,B,RL.skyRailFollow(w)(h,0)).T;}
 const outIdx=smp.findIndex(s=>s.join==='out');if(outIdx>=0)Tout=RL.skyRailJoinPlan(w,smp[outIdx-1].p,B,true).T;
 smp.forEach((s,i)=>{if(!s.join)return;const P=s.p.position,h=s.h,d=Math.hypot(P[0]-h[0],P[1]-h[1]-1.3,P[2]-h[2]);if(d<=12)return;
  const m=LS.herMargin(P,s.p.target,s.p.fovVerticalDeg,h,[sc]);
  let x,T,wB;if(s.join==='in'){T=Tin;x=Math.min(1,i/60/T);const u=Math.min(.4,.6/T);wB=1-ss(x/u);}else if(s.join==='out'){T=Tout;x=Math.min(1,(i-outIdx)/60/T);const u=Math.min(.4,.6/T);wB=ss((x-1+u)/u);}else{wB=0;x=null;T=null;}
  const f=s.p.target.map((v,k)=>v-P[k]),fl=Math.hypot(...f),c=[h[0]-P[0],h[1]+1.3-P[1],h[2]-P[2]],cl=Math.hypot(...c);
  const ang=Math.acos(Math.max(-1,Math.min(1,(f[0]*c[0]+f[1]*c[1]+f[2]*c[2])/fl/cl)))*180/Math.PI;
  // board-view angle to her
  const fb=B.target.map((v,k)=>v-B.position[k]),cb=[h[0]-B.position[0],h[1]+1.3-B.position[1],h[2]-B.position[2]];
  const angB=Math.acos((fb[0]*cb[0]+fb[1]*cb[1]+fb[2]*cb[2])/Math.hypot(...fb)/Math.hypot(...cb))*180/Math.PI;
  const mB=LS.herMargin(B.position,B.target,B.fovVerticalDeg,h,[sc]);
  out.push({w,screen:sc.join('x'),case:lab,i,t:+(i/60).toFixed(3),join:s.join,x:x==null?null:+x.toFixed(3),T:T==null?null:+T.toFixed(2),wBoard:+wB.toFixed(3),distM:+d.toFixed(2),margin:+m.toFixed(3),out:m<0,angDeg:+ang.toFixed(1),fov:+s.p.fovVerticalDeg.toFixed(1),boardMargin:+mB.toFixed(3),boardAngDeg:+angB.toFixed(1),pos:P.map(v=>+v.toFixed(2)),h:h.map(v=>+v.toFixed(2))});});}
require('fs').writeFileSync('/workspace/t6scratch/frames.json',JSON.stringify(out));
const o=out.filter(r=>r.out);console.log('far',out.length,'out',o.length);
