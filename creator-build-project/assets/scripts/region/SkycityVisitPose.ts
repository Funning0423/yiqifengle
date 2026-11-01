import type {AuthoredPose,V3} from '../world-r1/CameraPose';
/** Fits the two interaction anchors and their nearby court in portrait/landscape.
 * This is an anchor framing contract, not a claim of native visual acceptance. */
/** Board-lens direction from the court centre (x, up, z), normalised in skycityVisitPose. */
export const SKYCITY_BOARD_DIR:readonly [number,number,number]=[1.2,.55,1.3];
export function skycityVisitPose(a:V3,b:V3,aspect:number):AuthoredPose {
  if(![...a,...b,aspect].every(Number.isFinite)||aspect<=0)throw Error('Invalid skycity framing input');
  const center:V3=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,(a[2]+b[2])/2];
  const span=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const radius=Math.max(6,span*.65+2),fovVerticalDeg=55;
  const half=Math.atan(Math.tan(fovVerticalDeg*Math.PI/360)*Math.min(1,aspect));
  // b18 (运镜bot, board-view composition): the lens azimuth swung from (0.3, ·, 1.3) to (1.2, ·, 1.3) (≈ 30° round the court):
  // the old view put a dark tree/foliage clump on the left frame edge and cut the light tower at the top; this one has sky and
  // the small domes round the board on 390×844 and keeps the guardian statue whole beside the board on 320×568. Same height
  // ratio, distance rule and FOV, so the 08→09 landing (which ends on this pose) only changes its end aim.
  const D=SKYCITY_BOARD_DIR,distance=radius/Math.sin(half)*1.12,normal=Math.hypot(D[0],D[1],D[2]);
  return {position:[center[0]+distance*D[0]/normal,center[1]+distance*D[1]/normal,center[2]+distance*D[2]/normal],target:center,fovVerticalDeg};
}
