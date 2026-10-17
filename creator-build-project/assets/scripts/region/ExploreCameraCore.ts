import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {REGION_NODES,type RegionId} from './RegionNodes';

export const FOLLOW_DISTANCE_M=7.4;
export const FOLLOW={backM:6.6,sideM:-2.4,upM:3.4,leadM:1.2,lookM:2.4,fovDeg:48};
export const MAP_PITCH_DEG=52;
export const BODY_M=1.7253;
export const UI_GAP_PT=13;
export const MIN_BODY_SCREEN=0.12;
export const SCREENS:readonly (readonly [number,number])[]=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];
export type LensState='Board'|'BoardToFollow'|'FollowWalk'|'FollowToBoard'|'MapExplore'|'Transition';
export type ScreenProfile=Readonly<{upExtra:number;zoomMin:number;zoomMax:number;short:boolean;tablet:boolean}>;

export function screenProfile(w:number,h:number):ScreenProfile{
 const short=(w===390&&h===520)||(w===375&&h===667);
 const tablet=w===768&&h===1024;
 return {upExtra:short?0.4:0,zoomMin:short?0.8:0.7,zoomMax:tablet?1.8:1.6,short,tablet};
}
const smoother=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
function sub(a:Vec,b:Vec):number[]{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function add(a:number[],b:number[]):Vec{return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function mul(a:number[],s:number):number[]{return [a[0]*s,a[1]*s,a[2]*s];}
function unit(v:number[]):number[]{const L=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/L,v[1]/L,v[2]/L];}
function cross(a:number[],b:number[]):number[]{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function slerp(a:number[],b:number[],t:number):number[]{
 const c=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),th=Math.acos(c),sn=Math.sin(th);
 if(th<1e-6)return unit([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);
 const k0=Math.sin((1-t)*th)/sn,k1=Math.sin(t*th)/sn;return unit([a[0]*k0+b[0]*k1,a[1]*k0+b[1]*k1,a[2]*k0+b[2]*k1]);
}
export function followPose(girl:Vec,yawRad:number,w:number,h:number,lookUpDeg=0):Pose{
 const profile=screenProfile(w,h);
 const f=[Math.sin(yawRad),0,Math.cos(yawRad)];
 const right=[f[2],0,-f[0]];
 const up=FOLLOW.upM+profile.upExtra;
 const position:Vec=[girl[0]-f[0]*FOLLOW.backM+right[0]*FOLLOW.sideM,girl[1]+up,girl[2]-f[2]*FOLLOW.backM+right[2]*FOLLOW.sideM];
 let dir=unit([girl[0]+f[0]*FOLLOW.leadM-position[0],girl[1]+FOLLOW.lookM-position[1],girl[2]+f[2]*FOLLOW.leadM-position[2]]);
 if(lookUpDeg){const axis=unit(cross(dir,[0,1,0]));const rad=lookUpDeg*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),dot=axis[0]*dir[0]+axis[1]*dir[1]+axis[2]*dir[2];
  dir=unit(add(add(mul(dir,c),mul(cross(axis,dir),s)),mul(axis,dot*(1-c))));}
 return {position,target:[position[0]+dir[0]*10,position[1]+dir[1]*10,position[2]+dir[2]*10],fovVerticalDeg:FOLLOW.fovDeg};
}
/** Skycity only: raise the lens 8° over the last 4.2 m. */
export function followLookUp(region:RegionId,remainM:number):number{return region==='skycity'&&remainM<=4.2?8:0;}
/** 52° pitch foreshortens a standing body. Pull the lens in so she stays ≥ 0.12 screen tall. */
export function zoomForBody(w:number,h:number,zoom:number):number{
 const profile=screenProfile(w,h);
 const half=Math.tan(FOLLOW.fovDeg*Math.PI/360);
 const dist=BODY_M*Math.cos(MAP_PITCH_DEG*Math.PI/180)/Math.max(1e-4,MIN_BODY_SCREEN*2*half);
 const cap=dist/FOLLOW_DISTANCE_M;
 return Math.max(profile.zoomMin,Math.min(profile.zoomMax,cap,zoom));
}
export function mapPose(focus:Vec,zoom:number,w:number,h:number):Pose{
 const z=zoomForBody(w,h,zoom);
 const dist=FOLLOW_DISTANCE_M*z,pitch=MAP_PITCH_DEG*Math.PI/180;
 const position:Vec=[focus[0],focus[1]+Math.sin(pitch)*dist,focus[2]+Math.cos(pitch)*dist];
 return {position,target:[focus[0],focus[1]+BODY_M*0.5,focus[2]],fovVerticalDeg:FOLLOW.fovDeg};
}
export function clampFocus(region:RegionId,focus:Vec):Vec{
 const box=REGION_NODES[region].exploreBox;
 return [Math.max(box[0],Math.min(box[2],focus[0])),focus[1],Math.max(box[1],Math.min(box[3],focus[2]))];
}
export function outsideFocus(region:RegionId,focus:Vec):boolean{
 const c=clampFocus(region,focus);return c[0]!==focus[0]||c[2]!==focus[2];
}
/** Inertia: speed multiplied by 0.9 each second. */
export function dampSpeed(speed:number,dt:number):number{return speed*Math.pow(0.9,Math.max(0,dt));}
export function rebound(from:Vec,to:Vec,t:number,seconds=0.25):Vec{
 const e=smoother(seconds?t/seconds:1);
 return [from[0]+(to[0]-from[0])*e,from[1]+(to[1]-from[1])*e,from[2]+(to[2]-from[2])*e];
}
export function blendPose(a:Pose,b:Pose,t:number,seconds:number):Pose{
 if(!(seconds>0)||t<=0)return a;
 if(t>=seconds)return b;
 const e=smoother(t/seconds);
 const p:Vec=[a.position[0]+(b.position[0]-a.position[0])*e,a.position[1]+(b.position[1]-a.position[1])*e,a.position[2]+(b.position[2]-a.position[2])*e];
 const da=unit(sub(a.target,a.position)),db=unit(sub(b.target,b.position)),d=slerp(da,db,e);
 const f0=a.fovVerticalDeg??48,f1=b.fovVerticalDeg??48;
 return {position:p,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:f0+(f1-f0)*e};
}
export function poseDelta(a:Pose,b:Pose):{positionM:number;dirDeg:number}{
 const da=unit(sub(a.target,a.position)),db=unit(sub(b.target,b.position));
 const c=Math.max(-1,Math.min(1,da[0]*db[0]+da[1]*db[1]+da[2]*db[2]));
 return {positionM:Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1],a.position[2]-b.position[2]),dirDeg:Math.acos(c)*180/Math.PI};
}
export function viewOf(pose:Pose):{forward:number[];right:number[];up:number[]}{
 const forward=unit(sub(pose.target,pose.position));
 const right=unit(cross(forward,[0,1,0]));
 const up=unit(cross(right,forward));
 return {forward,right,up};
}
/** Body projection. Returns screen fraction of her height and whether she clears the UI gap. */
export function bodyFrame(pose:Pose,girl:Vec,w:number,h:number):{fraction:number;inside:boolean;uiGap:boolean}{
 const {forward,right,up}=viewOf(pose);
 const fov=(pose.fovVerticalDeg??48)*Math.PI/180,half=Math.tan(fov/2);
 const project=(p:Vec)=>{const r=sub(p,pose.position),z=r[0]*forward[0]+r[1]*forward[1]+r[2]*forward[2];
  const x=(r[0]*right[0]+r[1]*right[1]+r[2]*right[2])/Math.max(1e-4,z);
  const y=(r[0]*up[0]+r[1]*up[1]+r[2]*up[2])/Math.max(1e-4,z);
  return {ndcX:x/(half*(w/h)),ndcY:y/half,z};};
 const feet=project(girl),head=project([girl[0],girl[1]+BODY_M,girl[2]]);
 const fraction=Math.abs(head.ndcY-feet.ndcY)/2;
 const inside=[feet,head].every(p=>p.z>0.2&&p.ndcX>=-1&&p.ndcX<=1&&p.ndcY>=-1&&p.ndcY<=1);
 const footPx=(Math.min(feet.ndcY,head.ndcY)+1)/2*h;
 return {fraction,inside,uiGap:footPx>=UI_GAP_PT};
}
export function transition(state:LensState,event:string,explore=false):LensState{
 if(state==='Board'&&event==='reward')return 'BoardToFollow';
 if(state==='BoardToFollow'&&event==='blend-done')return 'FollowWalk';
 if(state==='FollowWalk'&&event==='arrive-mainline')return 'FollowToBoard';
 if(state==='FollowToBoard'&&event==='blend-done')return 'Board';
 if(state==='FollowWalk'&&event==='arrive-departure')return 'Transition';
 if(state==='Transition'&&event==='arrive-landing')return 'FollowWalk';
 if(state==='Board'&&event==='open-map'&&explore)return 'MapExplore';
 if(state==='FollowWalk'&&event==='idle-explore'&&explore)return 'MapExplore';
 if(state==='MapExplore'&&event==='tap-ground')return 'FollowWalk';
 if(state==='MapExplore'&&event==='tap-mainline')return 'BoardToFollow';
 if(state==='FollowWalk'&&event==='cut')return 'FollowWalk';
 return state;
}
export const BLEND_S={boardToFollow:0.6,followToBoard:0.8} as const;
