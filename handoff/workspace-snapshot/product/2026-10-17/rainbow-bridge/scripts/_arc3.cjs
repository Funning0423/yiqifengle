const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts');
const {topY}=require('./_mapfine.cjs');const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
const yc=new Map();const Y=(x,z)=>{const k=x.toFixed(2)+','+z.toFixed(2);if(!yc.has(k)){const [y]=topY(x,z);yc.set(k,y<-1?-0.25:y);}return yc.get(k);};
const out=[];
for(let x0=5.6;x0<=7.6;x0+=0.1)for(let a=0.1;a<=0.5;a+=0.025)for(let b=0;b<=0.03;b+=0.005){
 const L=[];for(let z=47;z>=38.0-1e-9;z-=0.25){const u=47-z,x=x0-a*u-b*u*u;L.push([+x.toFixed(3),Y(+x.toFixed(2),+z.toFixed(2)),z]);}
 let ok=true,mins=1e9,ds=[];for(const {w,h,safe,cam} of cams){const s=RB.girlStandStop('skycity',L,cam,w,h,safe);if(!s.clear||s.gapPt<13){ok=false;break;}mins=Math.min(mins,s.gapPt);ds.push(+s.distanceM.toFixed(1));}
 if(ok)out.push({x0:+x0.toFixed(2),a:+a.toFixed(3),b:+b.toFixed(3),mins:+mins.toFixed(1),ds,maxd:Math.max(...ds)});}
out.sort((p,q)=>q.mins-p.mins||p.maxd-q.maxd);console.log(out.length);for(const o of out.slice(0,15))console.log(JSON.stringify(o));
