import type {AuthoredPose} from '../world-r1/CameraPose';
import {meadowScenePose} from './MeadowSceneData';
import {girlBoxPt,girlStandUi} from './RegionBoardLanding';
import type {SafeArea} from '../ui/BoardLayout';
import type {Vec} from './RegionNodes';
/**
 * 运镜bot r5 (PREP ONLY, not wired, not for merge): three candidate board cameras so she reads bigger on the meadow board.
 * Today every meadow node (M1–M4, boards 05–08) keeps the one authored board camera (meadowScenePose, 35–60 m from her):
 * her box is 6.1% of the screen height at M1 and 3.3–4.6% at M2–M4, where the board tray also covers her.
 * UI-free room on a portrait board: the strip between the tray and the tool row, or the corners beside the tool row (≥ 13 pt
 * from every UI rect). Every option frames her as large as fits in the best of these, at the same place on every node (camera hung on her node).
 *  A  落点机位拉近: same view direction and FOV as today, camera slid along the ray to her until she fills the strip.
 *  B  FOV 调整:     camera kept at today's distance band (≈ 1.5× A's), FOV narrowed until she fills the strip.
 *  C  到达后小推镜: board starts on today's framing re-centred on her node (cPushFrom of A's distance), then a
 *                  C.pushS smootherstep push-in along the same ray to A's pose. pushPose(t) gives the move.
 *  D  地平线弯曲:   A's framing with the lens pitched dPitchDeg steeper, plus a world-space *spherical* (radial) bend centred on her:
 *                  y -= ((x-cx)^2+(z-cz)^2)/(2*dBendR). Radial, so it reads the same at every orbit yaw (a z-only cylinder bend shows
 *                  a tilted horizon as soon as the view turns). She and the sky dome are not bent. meadowBendDrop() is the reference
 *                  for the vertex chunk; every world material (terrain, grass, water, props, particles, shadow pass) must use it.
 * MEADOW_GIRLSIZE_OPTION stays 'off'; nothing imports this file at runtime. ES5-safe (no spread on Map/Set, no for-of).
 */
export type MeadowGirlSizeOption='off'|'A'|'B'|'C'|'D';
export const MEADOW_GIRLSIZE_OPTION:MeadowGirlSizeOption='off';
/** zone 'left': she stands left of the tool row on every node and screen, so the lens is behind / on her right (F7b sense) when 08→09 sets off from M4. */
export const MEADOW_GIRLSIZE={gapPt:13,fill:0.92,zone:'left' as 'strip'|'left'|'right',bFovScale:1.5,cPushFrom:1.45,cPushS:1.6,minFovDeg:20,dPitchDeg:10,dBendR:120} as const;
type V3=[number,number,number];
const sub=(a:readonly number[],b:readonly number[]):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const unit=(v:readonly number[]):V3=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const cross=(a:readonly number[],b:readonly number[]):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** UI-free zones (pt) she can stand in on the board, each already inset by gapPt from tray, tools, safe bands and edges:
 *  strip = full width between the tray bottom and the tool row; left/right = beside the tool row, down to the bottom safe band. */
export type GirlZone=Readonly<{id:'strip'|'left'|'right';l:number;t:number;r:number;b:number}>;
export function meadowGirlZones(width:number,height:number,safe:SafeArea):GirlZone[]{
 const ui=girlStandUi(width,height,safe),g=MEADOW_GIRLSIZE.gapPt,tray=ui[0];let tl=width,tr=0,tt=height;
 for(let i=2;i<5;i++){tl=Math.min(tl,ui[i].l);tr=Math.max(tr,ui[i].r);tt=Math.min(tt,ui[i].t);}
 const bottom=height-Math.max(0,safe.bottom)-g,top=tray.b+g;
 return [{id:'strip',l:g,t:top,r:width-g,b:tt-g},{id:'left',l:g,t:top,r:tl-g,b:bottom},{id:'right',l:tr+g,t:top,r:width-g,b:bottom}];
}
/** Camera with orientation of `base` and `fovDeg`, framing her box as large as fits inside the best zone, centred in it. */
function frame(base:AuthoredPose,fovDeg:number,foot:Vec,width:number,height:number,safe:SafeArea,scale:number,zoneId?:string):AuthoredPose{
 const f=unit(sub(base.target,base.position)),r=unit([-f[2],0,f[0]]),u=cross(r,f),tv=Math.tan(fovDeg*Math.PI/360),asp=width/height;
 const mid:V3=[foot[0],foot[1]+0.86,foot[2]];
 const place=(z:number,cx:number,cy:number):AuthoredPose=>{const nx=cx/width*2-1,ny=1-cy/height*2;const d:V3=[f[0]+r[0]*nx*tv*asp+u[0]*ny*tv,f[1]+r[1]*nx*tv*asp+u[1]*ny*tv,f[2]+r[2]*nx*tv*asp+u[2]*ny*tv];
  const p:V3=[mid[0]-d[0]*z,mid[1]-d[1]*z,mid[2]-d[2]*z];return {position:p,target:[p[0]+f[0]*10,p[1]+f[1]*10,p[2]+f[2]*10],fovVerticalDeg:fovDeg};};
 let best:{pose:AuthoredPose;h:number}|null=null;
 const zones=meadowGirlZones(width,height,safe);
 for(let k=0;k<zones.length;k++){const q=zones[k];if(zoneId&&q.id!==zoneId)continue;const zw=(q.r-q.l)*MEADOW_GIRLSIZE.fill,zh=(q.b-q.t)*MEADOW_GIRLSIZE.fill;if(zw<=4||zh<=4)continue;
  const cx=(q.l+q.r)/2,cy=(q.t+q.b)/2;let z=1.7253/(2*tv*zh/height);
  for(let i=0;i<10;i++){const b=girlBoxPt(place(z,cx,cy),foot,width,height);if(!b)break;z*=Math.max((b.b-b.t)/zh,(b.r-b.l)/zw);}
  const pose=place(z,cx,cy),b=girlBoxPt(pose,foot,width,height);if(!b)continue;const h=b.b-b.t;if(!best||h>best.h)best={pose:place(z*scale,cx,cy),h};}
 if(!best)return base;
 return best.pose;
}
/** Option pose for her node (model / board-rig coordinates). 'off' returns today's board camera. */
export function meadowGirlSizePose(option:MeadowGirlSizeOption,foot:Vec,width:number,height:number,safe:SafeArea):AuthoredPose{
 const base=meadowScenePose(width/height);
 if(option==='off')return base;
 if(option==='D'){const f=unit(sub(base.target,base.position)),hl=Math.hypot(f[0],f[2])||1,th=Math.asin(-f[1])+MEADOW_GIRLSIZE.dPitchDeg*Math.PI/180;
  const g:V3=[f[0]/hl*Math.cos(th),-Math.sin(th),f[2]/hl*Math.cos(th)],p=base.position;
  return frame({position:p,target:[p[0]+g[0]*10,p[1]+g[1]*10,p[2]+g[2]*10],fovVerticalDeg:base.fovVerticalDeg},base.fovVerticalDeg,foot,width,height,safe,1,MEADOW_GIRLSIZE.zone);}
 if(option==='A'||option==='C')return frame(base,base.fovVerticalDeg,foot,width,height,safe,1,MEADOW_GIRLSIZE.zone);
 // B: same strip, camera MEADOW_GIRLSIZE.bFovScale× further, FOV narrowed to keep her size.
 const tv=Math.tan(base.fovVerticalDeg*Math.PI/360)/MEADOW_GIRLSIZE.bFovScale,fov=Math.max(MEADOW_GIRLSIZE.minFovDeg,Math.atan(tv)*360/Math.PI);
 return frame(base,fov,foot,width,height,safe,1,MEADOW_GIRLSIZE.zone);
}
/** C only: the push-in after arrival. t = seconds since the board camera took over; ends exactly on option A's pose. */
export function meadowGirlSizePush(foot:Vec,width:number,height:number,safe:SafeArea,t:number):AuthoredPose{
 const A=meadowGirlSizePose('A',foot,width,height,safe),mid:V3=[foot[0],foot[1]+0.86,foot[2]];
 const k=Math.max(0,Math.min(1,t/MEADOW_GIRLSIZE.cPushS)),e=k*k*k*(10+k*(-15+6*k)),s=MEADOW_GIRLSIZE.cPushFrom+(1-MEADOW_GIRLSIZE.cPushFrom)*e;
 const p:V3=[mid[0]+(A.position[0]-mid[0])*s,mid[1]+(A.position[1]-mid[1])*s,mid[2]+(A.position[2]-mid[2])*s],f=sub(A.target,A.position);
 return {position:p,target:[p[0]+f[0],p[1]+f[1],p[2]+f[2]],fovVerticalDeg:A.fovVerticalDeg};
}
/** D only: how far the spherical bend lowers a world point (x,z) for bend centre (cx,cz) and radius R (m). 0 at the centre. */
export function meadowBendDrop(x:number,z:number,cx:number,cz:number,R:number):number{const dx=x-cx,dz=z-cz;return R>0?(dx*dx+dz*dz)/(2*R):0;}
