import type {AuthoredPose,V3} from '../world-r1/CameraPose';
/** Fits the two interaction anchors and their nearby court in portrait/landscape.
 * This is an anchor framing contract, not a claim of native visual acceptance. */
export function skycityVisitPose(a:V3,b:V3,aspect:number):AuthoredPose {
  if(![...a,...b,aspect].every(Number.isFinite)||aspect<=0)throw Error('Invalid skycity framing input');
  const center:V3=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,(a[2]+b[2])/2];
  const span=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const radius=Math.max(6,span*.65+2),fovVerticalDeg=55;
  const half=Math.atan(Math.tan(fovVerticalDeg*Math.PI/360)*Math.min(1,aspect));
  const distance=radius/Math.sin(half)*1.12,normal=Math.hypot(.3,.55,1.3);
  return {position:[center[0]+distance*.3/normal,center[1]+distance*.55/normal,center[2]+distance*1.3/normal],target:center,fovVerticalDeg};
}
