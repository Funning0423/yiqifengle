/** 运镜bot b19: T-02 finale → seg 5a walk (S6 → basket door) — one continuous shot, no cuts. Pure (no cc).
 *  Beats: gaze hold at S6 (gazeS: GGbot's ≥2 s after the 1.4 s ease-in; auto-start 3.4 s or 继续旅程) → walk along the data path
 *  (TRANSITION_STAGING.skyMooring5a.walkWorld, walkPathM / walkMps). The lens sits on the city→her line (data: the finale gaze axis), so
 *  with the city ahead of her (option-C mooring: she walks toward it) it is a rear follow continuing the finale's rear 3/4; slow azimuth drift for variety; occluder search (HerShot.followShot). Durations,
 *  path, speed and the city point are data — nothing here is tuned to one mooring. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {HER_SHOT,followShot,herTimeline,type Box,type HerSample} from './HerShot';
export const SKY_WALK_SHOT=Object.freeze({
 /** lens azimuth = the city→her line (city straight behind her), leaned toward her front by cityLean, clamped */cityLean:1,azMaxDeg:180,arm:5.2,up:2.1,lookUp:1.25,fov:52,
 driftAzDeg:10,driftArm:.5,driftPeriodS:12,driftFromS:4,
 /** aim pulled from her chest toward the city by this fraction of the angle (keeps the city in the upper frame) */cityPull:.06,
 /** full2-cam: lens heights over `up` tried when no azimuth is clear (foliage cards on the 5a walk) */liftSearch:[0,.8,1.6,2.4,3.2] as readonly number[],armSearch:[0,-1.2,-2.2] as readonly number[]});
/** The city she gazes at = 60 m down the T-02 finale lens axis (world). */
export function finaleCity(f:Pose,m=60):Vec{const d=[f.target[0]-f.position[0],f.target[1]-f.position[1],f.target[2]-f.position[2]],n=Math.hypot(d[0],d[1],d[2])||1;return [f.position[0]+d[0]/n*m,f.position[1]+d[1]/n*m,f.position[2]+d[2]/n*m];}
/** Skycity-local pose → world via the mooring's two frames (world = root ∘ local). */
export function skyLocalToWorld(m:{world:readonly number[];worldYawDeg:number;pos:readonly number[];yawDeg:number},q:readonly number[]):Vec{const r=(m.worldYawDeg-m.yawDeg)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),l=m.pos;
 const o=[m.world[0]-(c*l[0]+s*l[2]),m.world[1]-l[1],m.world[2]-(-s*l[0]+c*l[2])];return [o[0]+c*q[0]+s*q[2],o[1]+q[1],o[2]-s*q[0]+c*q[2]];}
/** full2-cam: skycity model-local AABBs → world AABBs (bbox of the 8 rotated corners) for the walk-shot occluder search. */
export function skyBoxesToWorld(m:{world:readonly number[];worldYawDeg:number;pos:readonly number[];yawDeg:number},rows:readonly (readonly number[])[],near?:readonly Vec[],within=30):Box[]{
 const out:Box[]=[];for(const b of rows){const cs:Vec[]=[];for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]])cs.push(skyLocalToWorld(m,[x,y,z]));
  const lo=[0,1,2].map(k=>Math.min(...cs.map(c=>c[k]))),hi=[0,1,2].map(k=>Math.max(...cs.map(c=>c[k])));
  if(near&&!near.some(p=>Math.hypot((lo[0]+hi[0])/2-p[0],(lo[2]+hi[2])/2-p[2])<within))continue;out.push([lo[0],lo[1],lo[2],hi[0],hi[1],hi[2]]);}
 return out;}
export type SkyWalk=Readonly<{gazeS:number;walkS:number;total:number;her:(t:number)=>HerSample;pose:(t:number)=>Pose;plan:{az:number[];arm:number[];up:number[]}}>;
/** start = the T-02 finale lens (world). The lens holds it through the gaze, then ORBITS round her (azimuth / range / height / view
 *  yaw+pitch interpolated about her live feet, min-jerk over orbitS) onto the walk follow — she turns from the city toward the
 *  basket, so the rear-3/4 finale lens ends up in front of her with the city behind her. No linear cross-blend through her. */
export function skyWalkShot(path:readonly Vec[],walkMps:number,gazeS:number,boxes:readonly Box[],city:Vec,k=SKY_WALK_SHOT,start?:Pose,orbitS=3.2):SkyWalk{
 let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2]);const walkS=L/walkMps;
 const d0=[path[1][0]-path[0][0],path[1][2]-path[0][2]],gazeYaw=Math.atan2(city[0]-path[0][0],city[2]-path[0][2])*180/Math.PI;
 const tl=herTimeline([{kind:'hold',at:path[0],yawDeg:gazeYaw,seconds:gazeS,pose:'stand'},{kind:'walk',path,seconds:walkS}]);
 // heading for the lens = her WALK heading from the start (she turns from the city to the path during the gaze → the lens is
 // already placed for the walk; HerShot keeps the last walking heading through holds → seed it with the first walk direction)
 const her=(t:number):HerSample=>{const h=tl.at(t);return t<gazeS?{...h,pose:'walk',yawDeg:Math.atan2(d0[0],d0[1])*180/Math.PI}:h;};
 const head=Math.atan2(d0[0],d0[1]),mid=path[Math.floor(path.length/2)],away=Math.atan2(mid[0]-city[0],mid[2]-city[2]);
 let az=((away-head)*180/Math.PI+540)%360-180;az=Math.max(-k.azMaxDeg,Math.min(k.azMaxDeg,az*k.cityLean));
 const shot=followShot(her,tl.total,boxes,{...HER_SHOT,azDeg:az,arm:k.arm,up:k.up,lookUp:k.lookUp,fov:k.fov,driftAzDeg:k.driftAzDeg,driftArm:k.driftArm,driftPeriodS:k.driftPeriodS,driftFromS:gazeS+k.driftFromS,liftSearch:(k as any).liftSearch,armSearch:(k as any).armSearch,plan:(k as any).plan,okFn:(k as any).okFn} as any);
 const pose=(t:number):Pose=>{const p=shot.pose(t),P=p.position,a=P.map((v,i)=>p.target[i]-v),b=P.map((v,i)=>city[i]-v),la=Math.hypot(...a)||1,lb=Math.hypot(...b)||1,x=k.cityPull,
  th=Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/la/lb))),sn=Math.sin(th),d=a.map((v,i)=>th<1e-6?v/la:v/la*Math.sin((1-x)*th)/sn+b[i]/lb*Math.sin(x*th)/sn);return {position:P,target:P.map((v,i)=>v+d[i]*la) as any,fovVerticalDeg:p.fovVerticalDeg};};
 const mj=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10-15*u+6*u*u);},wrap=(a:number)=>((a+3*Math.PI)%(2*Math.PI))-Math.PI;
 const polar=(p:Pose,f:Vec)=>{const dx=p.position[0]-f[0],dz=p.position[2]-f[2],tx=p.target[0]-p.position[0],ty=p.target[1]-p.position[1],tz=p.target[2]-p.position[2];
  return {az:Math.atan2(dx,dz),r:Math.hypot(dx,dz),h:p.position[1]-f[1],vy:Math.atan2(tx,tz),vp:Math.atan2(ty,Math.hypot(tx,tz)),fov:p.fovVerticalDeg??45};};
 const posed=(t:number):Pose=>{if(!start)return pose(t);const w=mj((t-gazeS)/orbitS);if(w>=1)return pose(t);const f=tl.at(t).feet,a=polar(start,path[0]),b=polar(pose(t),f);
  const az=a.az+wrap(b.az-a.az)*w,r=a.r+(b.r-a.r)*w,h=a.h+(b.h-a.h)*w,vy=a.vy+wrap(b.vy-a.vy)*w,vp=a.vp+(b.vp-a.vp)*w,P:Vec=[f[0]+Math.sin(az)*r,f[1]+h,f[2]+Math.cos(az)*r];
  return {position:P,target:[P[0]+Math.sin(vy)*Math.cos(vp)*8,P[1]+Math.sin(vp)*8,P[2]+Math.cos(vy)*Math.cos(vp)*8],fovVerticalDeg:a.fov+(b.fov-a.fov)*w};};
 return {gazeS,walkS,total:tl.total,her:tl.at,pose:posed,plan:shot.plan};}
