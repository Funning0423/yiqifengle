const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
const out=[];
for(let x0=5.3;x0<=6.6;x0+=0.1)for(let a=-0.15;a<=0.1;a+=0.025)for(let b=0;b<=0.06;b+=0.004){
 const L=[];for(let z=47;z>=37.9;z-=0.25){const u=47-z;L.push([x0-a*u-b*u*u,-0.2,z]);}
 if(L.at(-1)[0]<3.9)continue;
 let ok=true,mins=1e9,ds=[];for(const {w,h,safe,cam} of cams){const s=RB.girlStandStop('skycity',L,cam,w,h,safe);if(!s.clear||s.gapPt<13){ok=false;break;}mins=Math.min(mins,s.gapPt);ds.push(+s.distanceM.toFixed(1));}
 if(ok)out.push({x0:+x0.toFixed(2),a:+a.toFixed(3),b:+b.toFixed(3),mins:+mins.toFixed(1),ds});}
out.sort((p,q)=>q.mins-p.mins);console.log(out.length);for(const o of out.slice(0,15))console.log(JSON.stringify(o));
