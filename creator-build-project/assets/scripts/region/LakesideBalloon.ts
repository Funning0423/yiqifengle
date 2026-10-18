import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {journeyTimingOk, type JourneyTiming} from '../world-r1/RegionJourneyCore';
/** Default descent lens for skycity → lakeside. 运镜bot tunes these; the standing arrival after the ride
 * still uses LakesideCameraLayout.LAKESIDE_CAMERA_LAYOUT.landing. */
export const LAKESIDE_BALLOON_LANDING={
 climbM:14,
 descentM:12,
 durationS:22,
 easeInS:4,
 easeOutS:4,
 camBackM:8.5,
 camUpM:3.2,
 camSideM:1.4,
 lookUpM:1.1,
 fovDeg:48,
 yawDeg:180,
} as const;
const seg=(a:Vec,b:Vec)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
/** Climb, level cruise, then descend onto `bank` (the south-bank walk stop, 湖边). */
export function lakesideBalloonPath(start:Vec,bank:Vec,knobs=LAKESIDE_BALLOON_LANDING):{path:Vec[];bridgeStart:number;bridgeEnd:number}{
 const dx=bank[0]-start[0],dz=bank[2]-start[2],h=Math.hypot(dx,dz)||1,ux=dx/h,uz=dz/h;
 const descent=Math.min(knobs.descentM,h*0.45);
 const climbRun=Math.min(8,Math.max(2,h-descent-2));
 const climb:Vec=[start[0]+ux*climbRun,start[1]+knobs.climbM,start[2]+uz*climbRun];
 const drop:Vec=[bank[0]-ux*descent,bank[1]+Math.min(2.4,knobs.climbM*0.2),bank[2]-uz*descent];
 const cruise:Vec=[drop[0],climb[1],drop[2]];
 const path:Vec[]=[start,climb,cruise,bank];
 let bridgeStart=seg(path[0],path[1]);
 let bridgeEnd=bridgeStart+seg(path[1],path[2]);
 if(!(bridgeEnd>bridgeStart+1e-3)){
  const mid:Vec=[(climb[0]+cruise[0])/2,climb[1],(climb[2]+cruise[2])/2];
  path.splice(2,0,mid);
  bridgeEnd=bridgeStart+seg(path[1],path[2])+seg(path[2],path[3]);
 }
 const length=path.slice(1).reduce((n,p,i)=>n+seg(path[i],p),0);
 if(bridgeEnd>length)bridgeEnd=length;
 if(!(bridgeEnd>bridgeStart))bridgeEnd=Math.min(length,bridgeStart+Math.max(0.05,length*0.05));
 return {path,bridgeStart,bridgeEnd};
}
/** At least `durationS`, and long enough that cruise stays under 4.2 m/s and |a| under 3. */
export function lakesideBalloonTiming(length:number,knobs=LAKESIDE_BALLOON_LANDING):JourneyTiming{
 const easeInS=knobs.easeInS,easeOutS=knobs.easeOutS;
 let durationS=knobs.durationS;
 while(!journeyTimingOk(Math.max(length,0.01),{durationS,easeInS,easeOutS})&&durationS<180)durationS=Math.round((durationS+0.5)*10)/10;
 return {durationS,easeInS,easeOutS};
}
/** Behind / to the side / above the basket, looking at the bank. */
export function lakesideBalloonLens(pos:Vec,bank:Vec,knobs=LAKESIDE_BALLOON_LANDING):Pose{
 const dx=bank[0]-pos[0],dz=bank[2]-pos[2],h=Math.hypot(dx,dz)||1;
 const bx=-dx/h,bz=-dz/h,sx=-bz,sz=bx;
 return {
  position:[pos[0]+bx*knobs.camBackM+sx*knobs.camSideM,pos[1]+knobs.camUpM,pos[2]+bz*knobs.camBackM+sz*knobs.camSideM],
  target:[bank[0],bank[1]+knobs.lookUpM,bank[2]],
  fovVerticalDeg:knobs.fovDeg,
 };
}
