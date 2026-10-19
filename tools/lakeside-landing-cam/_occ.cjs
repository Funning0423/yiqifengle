const A=require('./audit.cjs');
(async()=>{const G=await A.geometry(),from=A.startCamera(0),mod=process.argv[2]?JSON.parse(process.argv[2]):{};const kn={...A.KN,...mod};
for(const scr of A.SCREENS){const S=A.newShot(A.landingFor(scr),kn),bbc=[];const out=[];
 for(let t=9.6;t<14;t+=.05){const pose=S.camera(t,from),g=S.girl(t),bb=A.balAt(G,S.vehicle(t));
  const hd=A.los(G,bb,pose.position,[g[0],g[1]+1.55,g[2]]),ch=A.los(G,bb,pose.position,[g[0],g[1]+1.2,g[2]]),cl=Math.min(A.nearest(G.stat,pose.position).d,A.nearest(bb,pose.position).d),ui=A.uiCheck(pose,g,scr),sb=A.southBank(G,bb,pose,scr[0]/scr[1],14,30);
  if(hd||ch||cl<1.1||ui.gap<13||sb.edge||sb.lakeHit)out.push([t.toFixed(2),hd?'H':'',ch?'C':'',cl.toFixed(2),ui.gap,sb.edge,sb.lakeHit].join(' '));}
 console.log(scr.join('x'),'cut',S.cut.toFixed(2),'liftT',S.R.liftT.toFixed(2),out.length?out.join(' | '):'clean');}
})();
