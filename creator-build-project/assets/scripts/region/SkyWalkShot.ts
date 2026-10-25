/** 运镜bot b19: T-02 finale → seg 5a walk (S6 → basket door) — one continuous shot, no cuts. Pure (no cc).
 *  Beats: gaze hold at S6 (gazeS: GGbot's ≥2 s after the 1.4 s ease-in; auto-start 3.4 s or 继续旅程) → walk along the data path
 *  (TRANSITION_STAGING.skyMooring5a.walkWorld, walkPathM / walkMps). The lens leads her (front 3/4, looking back) so the city she
 *  turned away from stays behind her in frame; slow azimuth drift for variety; occluder search (HerShot.followShot). Durations,
 *  path, speed and the city point are data — nothing here is tuned to one mooring. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {HER_SHOT,followShot,herTimeline,type Box,type HerSample} from './HerShot';
export const SKY_WALK_SHOT=Object.freeze({
 /** lens azimuth = the city→her line (city straight behind her), leaned toward her front by cityLean, clamped */cityLean:1,azMaxDeg:75,arm:5.2,up:2.1,lookUp:1.25,fov:52,
 driftAzDeg:10,driftArm:.5,driftPeriodS:12,driftFromS:4,
 /** aim pulled from her chest toward the city by this fraction of the angle (keeps the city in the upper frame) */cityPull:.06});
export type SkyWalk=Readonly<{gazeS:number;walkS:number;total:number;her:(t:number)=>HerSample;pose:(t:number)=>Pose}>;
export function skyWalkShot(path:readonly Vec[],walkMps:number,gazeS:number,boxes:readonly Box[],city:Vec,k=SKY_WALK_SHOT):SkyWalk{
 let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2]);const walkS=L/walkMps;
 const d0=[path[1][0]-path[0][0],path[1][2]-path[0][2]],gazeYaw=Math.atan2(city[0]-path[0][0],city[2]-path[0][2])*180/Math.PI;
 const tl=herTimeline([{kind:'hold',at:path[0],yawDeg:gazeYaw,seconds:gazeS,pose:'stand'},{kind:'walk',path,seconds:walkS}]);
 // heading for the lens = her WALK heading from the start (she turns from the city to the path during the gaze → the lens is
 // already placed for the walk; HerShot keeps the last walking heading through holds → seed it with the first walk direction)
 const her=(t:number):HerSample=>{const h=tl.at(t);return t<gazeS?{...h,pose:'walk',yawDeg:Math.atan2(d0[0],d0[1])*180/Math.PI}:h;};
 const head=Math.atan2(d0[0],d0[1]),mid=path[Math.floor(path.length/2)],away=Math.atan2(mid[0]-city[0],mid[2]-city[2]);
 let az=((away-head)*180/Math.PI+540)%360-180;az=Math.max(-k.azMaxDeg,Math.min(k.azMaxDeg,az*k.cityLean));
 const shot=followShot(her,tl.total,boxes,{...HER_SHOT,azDeg:az,arm:k.arm,up:k.up,lookUp:k.lookUp,fov:k.fov,driftAzDeg:k.driftAzDeg,driftArm:k.driftArm,driftPeriodS:k.driftPeriodS,driftFromS:gazeS+k.driftFromS} as any);
 const pose=(t:number):Pose=>{const p=shot.pose(t),c=city,q=p.target;return {position:p.position,target:[q[0]+(c[0]-q[0])*k.cityPull,q[1]+(c[1]-q[1])*k.cityPull,q[2]+(c[2]-q[2])*k.cityPull],fovVerticalDeg:p.fovVerticalDeg};};
 return {gazeS,walkS,total:tl.total,her:tl.at,pose};}
