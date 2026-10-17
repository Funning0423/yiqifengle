const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
const out=[];const fails={};
for(let x0=5.2;x0<=7;x0+=0.1)for(let a=-0.1;a<=0.6;a+=0.025)for(let b=-0.03;b<=0.03;b+=0.005){
 const L=[];for(let z=48;z>=33;z-=0.25){const u=48-z;const x=x0-a*u-b*u*u;L.push([x,x<3.2?-0.05:-0.2,z]);}
 let ok=true,mins=1e9,ds=[];for(const {w,h,safe,cam} of cams){const s=RB.girlStandStop('skycity',L,cam,w,h,safe);if(!s.clear||s.gapPt<13){ok=false;fails[w+'x'+h]=(fails[w+'x'+h]||0)+1;break;}mins=Math.min(mins,s.gapPt);ds.push(+s.distanceM.toFixed(1));}
 if(ok)out.push({x0:+x0.toFixed(2),a:+a.toFixed(3),b:+b.toFixed(3),mins:+mins.toFixed(1),ds,maxd:Math.max(...ds)});}
out.sort((p,q)=>p.maxd-q.maxd);console.log(out.length,JSON.stringify(fails));for(const o of out.slice(0,20))console.log(JSON.stringify(o));
