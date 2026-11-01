/** 运镜bot b19: pure adapter from 场景设计部's transition-anchors.json (qf-transition-cam/1) to camera parameters for the three
 *  balloon spots. NOTHING about the basket yaw, her seated facing, door sides, walk length or beat seconds is hard-coded here:
 *  the incoming yaws / second-door data drop in by replacing the JSON. Seated pose offsets come from BASKET_RIDE_POSE. */
import type {Vec} from '../world-r1/WorldFlowCore';
export type AnchorPose=Readonly<{pos:Vec;yawDeg:number}>;
export type LiftKey=Readonly<{t:number;pos:Vec;yawDeg:number}>;
export type BalloonSpot=Readonly<{
 id:'meadow-board'|'sky-board'|'lake-exit';
 basket:AnchorPose;            // basket root (mooring / touchdown)
 seat:AnchorPose|null;         // her seated root; yawDeg = her facing while riding (data)
 entryDoor:AnchorPose|null;    // door she walks in through (null = not this spot)
 exitDoor:AnchorPose|null;     // door she walks out through
 beats:ReadonlyArray<Readonly<{clip:string;s:number}>>;
 walkS:number;                 // first beat if it is a walk (approach), else 0
 walkM:number|null;walkMps:number|null;
 liftKeys:ReadonlyArray<LiftKey>|null;liftS:number|null;
}>;
const P=(a:any):AnchorPose|null=>a&&a.pos?{pos:[+a.pos[0],+a.pos[1],+a.pos[2]] as Vec,yawDeg:+(a.yawDeg??a.yaw??0)}:null;
const pathLen=(p:any[]|undefined):number|null=>{if(!p||p.length<2)return null;let L=0;for(let i=1;i<p.length;i++){const a=p[i-1].pos??p[i-1],b=p[i].pos??p[i];L+=Math.hypot(b[0]-a[0],b[2]-a[2]);}return L;};
function spot(id:BalloonSpot['id'],a:any):BalloonSpot{
 const beats=(a.timeline??[]).map((b:any)=>({clip:String(b.clip),s:+b.s}));const walk0=beats.length&&/walk/.test(beats[0].clip)&&!/door/.test(beats[0].clip);
 const lift=a.liftSuggested&&a.liftSuggested.keys?a.liftSuggested.keys.map((k:any)=>({t:+k.t,pos:[+k.pos[0],+k.pos[1],+k.pos[2]] as Vec,yawDeg:+(k.yawDeg??k.yaw??0)})):null;
 const inside=a.inside??{};const seat=P(inside.seat)??P(a.seat);
 return {id,basket:(P(a.mooringPose)??P(a.balloonPose)??P(a.touchdownPose)) as AnchorPose,seat,entryDoor:P(a.doorFront),exitDoor:P(a.exitDoor),beats,
  walkS:walk0?beats[0].s:0,walkM:id==='sky-board'?pathLen(a.path?.slice(0,(a.path as any[]).findIndex((p:any)=>/door|outside/.test(p.id??''))+1||undefined)):null,
  walkMps:a.walkMps!=null?+a.walkMps:null,liftKeys:lift,liftS:lift?lift[lift.length-1].t-lift[0].t:null};}
/** segments: transition-anchors.json → .segments */
export function balloonSpots(segments:any):{meadowBoard:BalloonSpot;skyBoard:BalloonSpot;lakeExit:BalloonSpot}{
 return {meadowBoard:spot('meadow-board',segments['B1-basket-in'].anchors),skyBoard:spot('sky-board',segments['C1-sky-basket-in'].anchors),lakeExit:spot('lake-exit',segments['C2-lakeside-out'].anchors)};}
/** SkyLakeContinuous overrides from the C1 spot: walk (data), door, step-in+sit (everything after the door beat), lift keys. */
export function skyLakeParamsFrom(s:BalloonSpot):{walkS:number;doorS:number;stepInS:number;liftTraj:ReadonlyArray<LiftKey>|null;liftS:number|null;riderYawDeg:number|null;basketYawDeg:number}{
 const b=s.beats,iDoor=b.findIndex(x=>/door/.test(x.clip));const doorS=iDoor>=0?b[iDoor].s:0,stepInS=iDoor>=0?b.slice(iDoor+1).reduce((a,x)=>a+x.s,0):0;
 return {walkS:s.walkS,doorS,stepInS,liftTraj:s.liftKeys,liftS:s.liftS,riderYawDeg:s.seat?s.seat.yawDeg:null,basketYawDeg:s.basket.yawDeg};}
