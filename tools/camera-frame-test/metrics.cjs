'use strict';
/** Shared metrics for test_camera_frames.cjs. Screen: 586x1266 evidence = 390x844 CSS (DPR 1.5), portrait aspect 0.4621. */
const SCREEN={width:586,height:1266,aspect:586/1266};
/** Funning 2026-10-11: status plate is HIDDEN during transitions. Top safe line = bottom of WeChat capsule
 * (measured 114 px of 1266 in 11-return-motion.mp4 @13.0s; lead quoted ~100 px, the larger value is used) + 4% H. */
const CAPSULE_BOTTOM_PX=114;
const SAFE={topFrac:CAPSULE_BOTTOM_PX/1266+.04,bottomFrac:.04,sideFrac:.04};
const ndcLimits=()=>({maxY:1-2*SAFE.topFrac,minY:-(1-2*SAFE.bottomFrac),maxAbsX:1-2*SAFE.sideFrac});
const CHAR={heightM:1.7253,halfWidthM:.3};
function framing(C,f,aspect=SCREEN.aspect){
  const box=C.characterBox(f.root,CHAR.heightM,CHAR.halfWidthM),pts=box.map(p=>C.projectPoint(f.cam,aspect,p));
  const L=ndcLimits(),maxY=Math.max(...pts.map(p=>p.y)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>Math.abs(p.x)));
  const behind=pts.some(p=>p.depth<=.05);
  // margins in screen-height / screen-width fractions (positive = inside safe area)
  return {behind,topMargin:(L.maxY-maxY)/2,bottomMargin:(minY-L.minY)/2,sideMargin:(L.maxAbsX-maxX)/2,hatTopPx:(1-maxY)/2*SCREEN.height,feetPx:(1-minY)/2*SCREEN.height};
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);const len=a=>Math.hypot(...a);
function forward(C,q){return C.rotate(q,[0,0,-1]);}
/** Per-frame kinematics: linear speed (m/s), angular speed (deg/s), fov speed (deg/s); accel = per-frame change of those. */
function kinematics(C,frames,dt){
  const out=[];for(let i=1;i<frames.length;i++){const a=frames[i-1].cam,b=frames[i].cam;const fa=forward(C,a.rotation),fb=forward(C,b.rotation);
    const dot=Math.max(-1,Math.min(1,fa[0]*fb[0]+fa[1]*fb[1]+fa[2]*fb[2]));
    out.push({i,v:len(sub(b.position,a.position))/dt,w:Math.acos(dot)*180/Math.PI/dt,fv:(b.fovVerticalDeg-a.fovVerticalDeg)/dt});}
  for(let i=1;i<out.length;i++){out[i].dv=(out[i].v-out[i-1].v)/dt;out[i].dw=(out[i].w-out[i-1].w)/dt;out[i].dfv=(out[i].fv-out[i-1].fv)/dt;}
  if(out.length){out[0].dv=0;out[0].dw=0;out[0].dfv=0;}
  return out;
}
module.exports={SCREEN,SAFE,CAPSULE_BOTTOM_PX,ndcLimits,CHAR,framing,kinematics,forward};
