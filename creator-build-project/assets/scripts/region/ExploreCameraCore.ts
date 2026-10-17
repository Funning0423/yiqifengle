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
/** S6 terrace: look up at the star ring (y≈20), steeper than the 8° approach lift. */
export const FINALE_LOOK_DEG=34;
export function finalePose(girl:Vec,yawRad:number,w:number,h:number):Pose{return followPose(girl,yawRad,w,h,FINALE_LOOK_DEG);}
/** Camera origin and the near point stay at least this far from scene meshes. Near clip is 0.1 m. */
export const LENS_CLEAR_M=0.6;
export type Aabb=Readonly<{min:Vec;max:Vec}>;
export function projectNdc(pose:Pose,p:Vec,w:number,h:number):{x:number;y:number;z:number}{
 const {forward,right,up}=viewOf(pose);
 const fov=(pose.fovVerticalDeg??48)*Math.PI/180,half=Math.tan(fov/2),aspect=Math.max(1e-4,w/h);
 const r=sub(p,pose.position),z=r[0]*forward[0]+r[1]*forward[1]+r[2]*forward[2];
 const sx=r[0]*right[0]+r[1]*right[1]+r[2]*right[2],sy=r[0]*up[0]+r[1]*up[1]+r[2]*up[2];
 const denom=Math.max(1e-4,z);
 return {x:sx/(denom*half*aspect),y:sy/(denom*half),z};
}
/**
 * S6 finale. The ring is a ~40 m horizontal loop, so a portrait lens only shows a sliver unless
 * it stands well above the loop, on her side of it. The great tree is hidden for this pose;
 * the offset is in the girl/ring ground frame so the city yaw does not aim it into the island.
 */
export function finaleLook(girl:Vec,ring:Vec):Pose{
 const dx=girl[0]-ring[0],dz=girl[2]-ring[2],L=Math.hypot(dx,dz)||1,sx=dx/L,sz=dz/L,rx=sz,rz=-sx;
 const back=32,side=0,up=46;
 const position:Vec=[ring[0]+sx*back+rx*side,ring[1]+up,ring[2]+sz*back+rz*side];
 const head:Vec=[girl[0],girl[1]+BODY_M*0.9,girl[2]];
 const target:Vec=[(head[0]+ring[0])/2,head[1]*0.4+ring[1]*0.6,(head[2]+ring[2])/2];
 return {position,target,fovVerticalDeg:66};
}
/** Object tap: stand on her side of the prop, far enough that a `span`-tall prop fits, looking at its middle. */
export function propLook(prop:Vec,girl:Vec,span=3):Pose{
 const dx=girl[0]-prop[0],dz=girl[2]-prop[2],L=Math.hypot(dx,dz)||1;
 const back=Math.max(4.2,span*1.7);
 const position:Vec=[prop[0]+dx/L*back,prop[1]+span*0.55,prop[2]+dz/L*back];
 return {position,target:[prop[0],prop[1]+span*0.35,prop[2]],fovVerticalDeg:42};
}
/** Three node gems in one portrait frame. Pulls back until the narrow horizontal FOV holds all three. */
export function markersLook(a:Vec,b:Vec,c:Vec,w=390,h=844):Pose{
 const mid:Vec=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3+0.45,(a[2]+b[2]+c[2])/3];
 const dx=c[0]-a[0],dz=c[2]-a[2],L=Math.hypot(dx,dz)||1,fx=dx/L,fz=dz/L,sx=fz,sz=-fx;
 let back=9;
 const pts=[a,b,c];
 for(let i=0;i<10;i++){
  const position:Vec=[mid[0]-fx*back+sx*1.8,mid[1]+1.6+back*0.06,mid[2]-fz*back+sz*1.8];
  const pose:Pose={position,target:mid,fovVerticalDeg:FOLLOW.fovDeg};
  const xs=pts.map(p=>Math.abs(projectNdc(pose,p,w,h).x));
  const ys=pts.map(p=>Math.abs(projectNdc(pose,p,w,h).y));
  const near=Math.min(...pts.map(p=>Math.hypot(p[0]-position[0],p[1]-position[1],p[2]-position[2])));
  if(Math.max(...xs)<0.82&&Math.max(...ys)<0.9&&near>4.5)return pose;
  back+=2.5;
 }
 const position:Vec=[mid[0]-fx*back+sx*1.8,mid[1]+1.6+back*0.06,mid[2]-fz*back+sz*1.8];
 return {position,target:mid,fovVerticalDeg:FOLLOW.fovDeg};
}
function boxSpan(b:Aabb):number{return Math.max(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);}
/** Distance to an AABB. A camera buried inside a huge shell (sky, merged island) is not a hit. */
export function boxGap(p:Vec,b:Aabb):number{
 let inside=true;const c=[0,0,0];
 for(let k=0;k<3;k++){if(p[k]<b.min[k]||p[k]>b.max[k])inside=false;c[k]=Math.max(b.min[k],Math.min(b.max[k],p[k]));}
 if(inside&&boxSpan(b)>8)return 1e9;
 if(inside)return 0;
 return Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]);
}
export function nearestGap(p:Vec,boxes:readonly Aabb[]):number{let g=1e9;for(const b of boxes){const d=boxGap(p,b);if(d<g)g=d;}return g;}
/** Pull the lens backward until the origin and a 0.2 m near point clear every box. */
export function retreatClear(pose:Pose,boxes:readonly Aabb[],clear=LENS_CLEAR_M):Pose{
 const dir=unit(sub(pose.target,pose.position));
 let p:Vec=[pose.position[0],pose.position[1],pose.position[2]];
 for(let i=0;i<18;i++){
  const near:Vec=[p[0]+dir[0]*0.2,p[1]+dir[1]*0.2,p[2]+dir[2]*0.2];
  const g=Math.min(nearestGap(p,boxes),nearestGap(near,boxes));
  if(g>=clear)break;
  const step=Math.max(0.2,clear-g+0.08);
  p=[p[0]-dir[0]*step,p[1]-dir[1]*step,p[2]-dir[2]*step];
 }
 return {position:p,target:[p[0]+dir[0]*10,p[1]+dir[1]*10,p[2]+dir[2]*10],fovVerticalDeg:pose.fovVerticalDeg};
}
