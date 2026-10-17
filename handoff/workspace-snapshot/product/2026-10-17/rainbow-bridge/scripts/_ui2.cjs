const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
for(const {w,h,safe,cam} of cams){console.log(w+'x'+h,'cam',JSON.stringify(cam.position.map(v=>+v.toFixed(1))),JSON.stringify(cam.target.map(v=>+v.toFixed(1))),cam.fovVerticalDeg.toFixed(1));
 for(const q of RB.girlStandUi(w,h,safe))console.log('  ui',[q.l,q.t,q.r,q.b].map(v=>v.toFixed(0)).join(','));
 for(const p of [[0,-0.2,44],[0,-0.2,48],[5.5,-0.2,43.5],[0,-0.2,30],[-1.25,-0.2,44]]){const b=RB.girlBoxPt(cam,p,w,h);console.log('  box',JSON.stringify(p),b&&[b.l,b.t,b.r,b.b].map(v=>v.toFixed(0)).join(','));}}
