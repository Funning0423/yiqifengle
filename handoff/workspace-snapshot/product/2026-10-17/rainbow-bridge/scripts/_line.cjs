const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const RB=J.H.load(J.S+'region/RegionBoardLanding.ts'),BL=J.H.load(J.S+'ui/BoardLayout.ts'),V=J.H.load(J.S+'region/SkycityVisitPose.ts'),RC=J.H.load(J.S+'world-r1/RegionCameraData.ts');
const spawn=J.sp('anchor_spawn_girl'),court=J.sp('anchor_starcourt_center');const FL=RC.REGION_CAMERA.frameLimits;
const SCR=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
const T=[];for(const n of J.local.skycity){if(/state_.*before/.test(n.name))continue;for(let i=0;i<n.tris.length;i+=9)T.push(n.tris.slice(i,i+9));}
const cams=SCR.map(([w,h])=>({w,h,safe:BL.boardSafeInsets(w,h),cam:V.skycityVisitPose(spawn,court,w/h)}));
const lines={A:[[5.5,-0.2,47],[5.5,-0.2,43.0],[5.0,-0.2,41.0],[4.5,-0.2,38.5],[4.25,-0.05,34.5]],
 B:[[5.5,-0.2,47],[5.5,-0.2,43.3],[5.0,-0.2,41.8],[4.75,-0.2,39.0],[4.25,-0.05,34.5]],
 C:[[5.6,-0.2,47],[5.5,-0.2,43.5],[5.0,-0.2,42],[4.9,-0.2,39.5],[4.4,-0.2,38],[4.25,-0.05,34.5]]};
for(const [k,L] of Object.entries(lines)){console.log('line',k);for(const {w,h,safe,cam} of cams){const s=RB.girlStandStop('skycity',L,cam,w,h,safe);console.log(' ',w+'x'+h,s.clear,s.gapPt.toFixed(1),s.inFrameLimits,s.distanceM.toFixed(2),JSON.stringify(s.local.map(v=>+v.toFixed(2))));}}
