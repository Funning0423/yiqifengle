'use strict';
/** Print world placements + screen-prop sea anchors for the island pose (JSON), used by the preview + reports.
 * node layout_dump.cjs [width height]   (CSS px; default 390 844) */
const {load}=require('./load_ts.cjs'),M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout']);
const C=M.CameraPose,L=M.IslandPropsLayout,R=M.RegionCameraData;
const [w,h]=[+(process.argv[2]||390),+(process.argv[3]||844)];
const pose=C.fromLookAt(R.islandPoseEntry());const P=L.ISLAND_PROPS,aspect=w/h;
const ndc=p=>{const q=C.projectPoint(pose,aspect,p);return {sx:+((q.x+1)/2).toFixed(4),sy:+((1-q.y)/2).toFixed(4),depth:+q.depth.toFixed(2)};};
const lay=L.propButtonLayout(w,h);
const buttons=lay.slots.map(s=>{const [sx,sy]=L.uiToScreen(s.prop.x,s.prop.bottom,w,h);const a=L.seaAnchor(pose,aspect,sx,sy,s.prop.height,h,P.buttons[s.role].heightM);
  return {role:s.role,prefab:P.buttons[s.role].prefab,label:P.buttons[s.role].label,position:a.point.map(v=>+v.toFixed(4)),yawDeg:+a.yawDeg.toFixed(2),scale:+a.scale.toFixed(4),onSea:a.onSea,slot:s};});
const S=P.signpost;
const out={frame:{width:w,height:h},pose:{source:R.REGION_CAMERA.islandPoseSource,...R.islandPoseEntry()},
  signpost:{...S,screenBase:ndc(S.position),rectUi:L.signpostRectUi(pose,w,h),textCenterWorld:L.propCorners({position:S.position,yawDeg:S.yawDeg,scale:S.scale},S.text.center,S.text.center)[0]},
  palms:P.palms.map(p=>({...p,screenBase:ndc(p.position)})),buttons};
console.log(JSON.stringify(out,null,1));
