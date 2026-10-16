import type { Cancellation, CharacterAdapter, Pose, StablePose, Vec, WorldLease } from './WorldFlowCore';
export type JourneyRegion = 'island'|'meadow'|'skycity';
export type JourneyPhase = 'idle'|'loading'|'ready'|'approach'|'bridge'|'arrival'|'paused'|'failed'|'arrived'|'disposed';
export type JourneyRoute = Readonly<{ from:JourneyRegion; to:JourneyRegion; path:readonly Vec[]; bridgeStart:number; bridgeEnd:number; speed:number; focus?:Vec; lens?:readonly LensKey[]; startBlendM?:number }>;
export interface JourneySceneLease { route:JourneyRoute; show(visible:boolean):void; dispose():void; }
export interface JourneySceneAdapter {
 prepare(from:JourneyRegion,to:JourneyRegion,start:Vec,token:Cancellation,progress:(n:number)=>void):Promise<JourneySceneLease>;
 readCamera():Pose;
}
export type JourneySnapshot = Readonly<{phase:JourneyPhase;region:JourneyRegion;target:JourneyRegion|null;loadProgress:number;distance:number;total:number;error:string|null;canRetry:boolean;canResume:boolean}>;
const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export const routeLength=(p:readonly Vec[])=>p.slice(1).reduce((n,b,i)=>n+dist(p[i],b),0);
export function sampleRoute(path:readonly Vec[],distance:number):Vec {
 let left=Math.max(0,distance);for(let i=1;i<path.length;i++){const d=dist(path[i-1],path[i]);if(d>0&&left<=d){const a=path[i-1],b=path[i],t=left/d;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}left-=d;}return path[path.length-1];
}
export function remainingRoute(path:readonly Vec[],distance:number):Vec[] {
 const result:Vec[]=[sampleRoute(path,distance)];let walked=0;for(let i=1;i<path.length;i++){walked+=dist(path[i-1],path[i]);if(walked>distance+1e-6)result.push(path[i]);}return result;
}
export function validateJourneyRoute(route:JourneyRoute,start:Vec):void {
 if(!route.path||route.path.length<2||route.path.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n))))throw Error('journey-invalid-path');
 const length=routeLength(route.path);if(dist(start,route.path[0])>1e-4||!(length>0)||!Number.isFinite(length)||!(route.speed>0&&route.speed<=2)||!(route.bridgeStart>=0&&route.bridgeEnd>route.bridgeStart&&route.bridgeEnd<=length))throw Error('journey-invalid-continuity');
 if(!((route.from==='island'&&route.to==='meadow')||(route.from==='meadow'&&route.to==='skycity')))throw Error('journey-region-order');
}
/** Follow lens for the region bridges. Build05 occlusion fix: the offset is in the PATH frame (behind/left/up of the
 * smoothed walking heading), so a bridge that turns keeps the lens behind her. Numbers are checked by
 * tools/journey-integration/test-journey-occlusion.cjs (geometry) and test-journey-framing.cjs (screen framing,
 * angular velocity, underside/sky coverage) against the real region GLB geometry.
 * v3 (lead Mac review of a373227+4c30cf7):
 *  - Lower, flatter follow (upM 3.4, aim lookM 2.4 above her feet): the top of the portrait frame now holds the sky dome,
 *    so the night journey shows the night sky instead of only the bright sea under a steep lens.
 *  - Start (04→05): the lens no longer flies ahead toward the bridge. It turns onto HER in the first startAimM metres and
 *    keeps her in frame while it travels to the follow pose over blendM (7 m, was 4) with a lower arc (blendLiftM 2.5).
 *  - Route lens keys (LensKey, metres along the route) locally raise/pull back the lens, e.g. under the sky city where its
 *    grey underside filled the upper left (08→09).
 *  - Arrival (route.focus): one smooth move from the follow pose to a high, pulled-back side-rear pose that frames the
 *    plaza (anchor_starcourt_center) centred with her small in front (~1/6 frame height) and clears the platform post.
 *    Position and view direction both move on smootherstep over arrivalBlendM metres; direction is slerped, so the
 *    angular speed is bounded (≤ 20°/s at 1.2 m/s, asserted by the framing test). */
export type LensKey = Readonly<{at:number;upM?:number;backM?:number;sideM?:number;lookM?:number}>;
export const JOURNEY_CAMERA={blendM:18,startAimM:2,startTurn:1,headingWindowM:5,backM:6.6,sideM:-2.4,upM:3.4,leadM:1.2,lookM:2.4,blendLiftM:2.5,fovDeg:48,setOffEaseM:0.78,
 arrivalBlendM:14,arrivalHoldM:3,arrivalLiftM:8,arrivalRiseM:6,arrivalDropM:4,arrivalBackM:10,arrivalSideM:-1,arrivalUpM:3.5,arrivalAim:.45} as const;
export function journeyHeading(path:readonly Vec[],distance:number):[number,number]{
 const a=sampleRoute(path,Math.max(0,distance-JOURNEY_CAMERA.headingWindowM)),b=sampleRoute(path,distance+JOURNEY_CAMERA.headingWindowM),x=b[0]-a[0],z=b[2]-a[2],l=Math.hypot(x,z);
 return l>1e-6?[x/l,z/l]:[0,1];
}
const smooth=(v:number)=>{const u=Math.min(1,Math.max(0,v));return u*u*(3-2*u);};
const smoother=(v:number)=>{const u=Math.min(1,Math.max(0,v));return u*u*u*(u*(u*6-15)+10);};
const unit=(v:Vec):Vec=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const lerp=(a:Vec,b:Vec,t:number):Vec=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
/** Great-circle interpolation of two unit directions (constant angular rate in t). */
export function slerpDir(a:Vec,b:Vec,t:number):Vec{const d=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),w=Math.acos(d);if(w<1e-5)return unit(lerp(a,b,t));const s=Math.sin(w),k0=Math.sin((1-t)*w)/s,k1=Math.sin(t*w)/s;return unit([a[0]*k0+b[0]*k1,a[1]*k0+b[1]*k1,a[2]*k0+b[2]*k1]);}
/** Lens offsets at a route distance: defaults, smoothly blended (smoothstep) between the route's keys. */
export function lensAt(keys:readonly LensKey[]|undefined,distance:number){
 const C=JOURNEY_CAMERA,base={upM:C.upM as number,backM:C.backM as number,sideM:C.sideM as number,lookM:C.lookM as number};if(!keys||!keys.length)return base;
 const full=(k:LensKey)=>({upM:k.upM??base.upM,backM:k.backM??base.backM,sideM:k.sideM??base.sideM,lookM:k.lookM??base.lookM});
 if(distance<=keys[0].at)return full(keys[0]);
 for(let i=1;i<keys.length;i++)if(distance<=keys[i].at){const a=full(keys[i-1]),b=full(keys[i]),t=smooth((distance-keys[i-1].at)/((keys[i].at-keys[i-1].at)||1));return {upM:a.upM+(b.upM-a.upM)*t,backM:a.backM+(b.backM-a.backM)*t,sideM:a.sideM+(b.sideM-a.sideM)*t,lookM:a.lookM+(b.lookM-a.lookM)*t};}
 return full(keys[keys.length-1]);
}
/** Pure path-frame follow pose (no start blend, no arrival). */
export function followPose(path:readonly Vec[],distance:number,keys?:readonly LensKey[]):{position:Vec;target:Vec}{
 const p=sampleRoute(path,distance),[hx,hz]=journeyHeading(path,distance),sx=hz,sz=-hx,o=lensAt(keys,distance);
 return {position:[p[0]-hx*o.backM+sx*o.sideM,p[1]+o.upM,p[2]-hz*o.backM+sz*o.sideM],target:[p[0]+hx*JOURNEY_CAMERA.leadM,p[1]+o.lookM,p[2]+hz*JOURNEY_CAMERA.leadM]};
}
/** Arrival hero pose for a focused route: behind her on the far side of the line to the focus, pulled back, raised and
 * offset sideways (clear of the terminus post), aimed horizontally at the focus (plaza centred) and tilted toward her chest by arrivalAim. */
export function arrivalPose(path:readonly Vec[],focus:Vec):{position:Vec;target:Vec}{
 const C=JOURNEY_CAMERA,p=path[path.length-1],fx=focus[0]-p[0],fz=focus[2]-p[2],fl=Math.hypot(fx,fz)||1,u=[fx/fl,fz/fl],n=[-u[1],u[0]];
 const position:Vec=[p[0]-u[0]*C.arrivalBackM+n[0]*C.arrivalSideM,p[1]+C.arrivalUpM,p[2]-u[1]*C.arrivalBackM+n[1]*C.arrivalSideM];
 // Horizontally the view points straight at the focus (plaza centred); vertically it tilts from the focus toward her
 // chest by arrivalAim so she stays in the lower part of the portrait frame.
 const fx2=focus[0]-position[0],fz2=focus[2]-position[2],fh=Math.hypot(fx2,fz2)||1,pf=Math.atan2(focus[1]-position[1],fh),pc=Math.atan2(p[1]+.9-position[1],Math.hypot(p[0]-position[0],p[2]-position[2])||1),pitch=pf+(pc-pf)*C.arrivalAim,aim:Vec=[fx2/fh*Math.cos(pitch),Math.sin(pitch),fz2/fh*Math.cos(pitch)];
 return {position,target:[position[0]+aim[0]*8,position[1]+aim[1]*8,position[2]+aim[2]*8]};
}
/** Her-relative lens offset moved on an orbit: horizontal angle, horizontal radius and height interpolate separately,
 * so a lens that has to get from in front of her to behind her goes AROUND her (for a swing of more than 135° the side is given by
 * turn: +1 ccw, -1 cw, 0 shortest; smaller swings always take the short way) instead of through or over her, and her screen position changes slowly. The radius moves geometrically,
 * so a distant lens closes in early instead of leaving her tiny for most of the move. */
export function orbitOffset(a:Vec,b:Vec,t:number,turn=0):Vec{
 const aa=Math.atan2(a[0],a[2]),ab=Math.atan2(b[0],b[2]),ra=Math.hypot(a[0],a[2]),rb=Math.hypot(b[0],b[2]);let d=ab-aa;
 while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;if(Math.abs(d)>Math.PI*.75){if(turn>0&&d<0)d+=2*Math.PI;if(turn<0&&d>0)d-=2*Math.PI;}
 const ang=aa+d*t,r=ra>1e-3&&rb>1e-3?ra*Math.pow(rb/ra,t):ra+(rb-ra)*t;return [Math.sin(ang)*r,a[1]+(b[1]-a[1])*t,Math.cos(ang)*r];
}
export function journeyCamera(path:readonly Vec[],distance:number,start:Pose,focus?:Vec,keys?:readonly LensKey[],startBlendM:number=JOURNEY_CAMERA.blendM):Pose {
 const C=JOURNEY_CAMERA,T=routeLength(path),p=sampleRoute(path,distance),f=followPose(path,distance,keys);
 const rel=(q:Vec,o:Vec):Vec=>[q[0]-o[0],q[1]-o[1],q[2]-o[2]],at=(o:Vec):Vec=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]];
 // The lens is a her-relative offset plus an AIM POINT that stays within a few metres of her, so moving between poses
 // never swings her out of the frame; the view direction is derived from the two.
 let offset=rel(f.position,p),aim=f.target;
 // startBlendM 0 (v3.2, 04→05): no wide authored-pose blend; the lens is on her follow pose (right, behind) from set-off.
 const blend=startBlendM>0?smooth(distance/startBlendM):1;
 if(blend<1){const o=orbitOffset(rel(start.position,path[0]),offset,blend,C.startTurn);offset=[o[0],o[1]+C.blendLiftM*Math.sin(Math.PI*blend),o[2]];aim=lerp([p[0],p[1]+lensAt(keys,distance).lookM,p[2]],aim,blend);}
 if(focus){const w=smoother((C.arrivalBlendM-(T-distance))/(C.arrivalBlendM-C.arrivalHoldM));
  if(w>0){const e=arrivalPose(path,focus),end=path[path.length-1],eo=rel(e.position,end),ed=unit(rel(e.target,e.position)),r=Math.hypot(eo[0],eo[1]-.9,eo[2]);
   const o=orbitOffset(offset,eo,w,0);const left=T-distance,lift=C.arrivalLiftM*smooth((C.arrivalBlendM-left)/C.arrivalRiseM)*smooth(left/C.arrivalDropM);offset=[o[0],o[1]+lift,o[2]];aim=lerp(aim,at([eo[0]+ed[0]*r,eo[1]+ed[1]*r,eo[2]+ed[2]*r]),w);}}
 const position=at(offset);let dir=unit(rel(aim,position));
 // Leaving the live lens: the view first turns from wherever it was looking onto her, over startAimM.
 if(startBlendM>0&&distance<C.startAimM)dir=slerpDir(unit(rel(start.target,start.position)),dir,smoother(distance/C.startAimM));
 const fov=(start.fovVerticalDeg??45)+(C.fovDeg-(start.fovVerticalDeg??45))*blend;
 // v3.3 (Grok Bot, Oi review): startBlendM 0 must not hard-cut from the live lens at set-off. Over the first setOffEaseM
 // (0.78 m = 0.65 s at 1.2 m/s) ease position, aim point and FOV from the live lens onto the follow pose (smootherstep, C2).
 // From setOffEaseM on the result is exactly the startBlendM-0 follow pose (post-set-off unchanged).
 if(startBlendM<=0&&C.setOffEaseM>0&&distance<C.setOffEaseM){const e=smoother(distance/C.setOffEaseM),sf=start.fovVerticalDeg??45;
  const ps=lerp(start.position,position,e),ds=slerpDir(unit(rel(start.target,start.position)),dir,e);
  return {position:ps,target:[ps[0]+ds[0]*8,ps[1]+ds[1]*8,ps[2]+ds[2]*8],fovVerticalDeg:sf+(fov-sf)*e};}
 return {position,target:[position[0]+dir[0]*8,position[1]+dir[1]*8,position[2]+dir[2]*8],fovVerticalDeg:fov};
}
/** No timers, persistence, fake percentages or character assets. All movement is through the existing adapter.
 * The flow owns the sole clock. Assets become ready only after real prefab/anchor/material validation succeeds. */
export class RegionJourneyController {
 private phase:JourneyPhase='idle';private region:JourneyRegion='island';private target:JourneyRegion|null=null;
 private lease:JourneySceneLease|null=null;private scenes:JourneySceneLease[]=[];private loadProgress=0;private distance=0;private error:string|null=null;
 private root:Vec|null=null;private yaw=0;private camera:Pose|null=null;private startCamera:Pose|null=null;
 private activePath:readonly Vec[]|null=null;private startDistance=0;private serial=0;private busy=false;
 constructor(private adapter:JourneySceneAdapter){}
 snapshot():JourneySnapshot {return Object.freeze({phase:this.phase,region:this.region,target:this.target,loadProgress:this.loadProgress,distance:this.distance,total:this.lease?routeLength(this.lease.route.path):0,error:this.error,canRetry:this.phase==='failed',canResume:this.phase==='paused'});}
 position():StablePose|null{return this.root?{kind:'standing',controllerRoot:this.root,yawRad:this.yaw}:null;}
 isInTransit(){return !!this.target&&this.phase!=='arrived'&&this.phase!=='idle'&&this.phase!=='disposed';}
 hasCheckpoint(){return !!this.root;}
 async prepare(to:JourneyRegion,start:Vec,token:Cancellation):Promise<void>{
  if(this.busy)throw Error('journey-busy');if(this.phase==='disposed')throw Error('journey-disposed');
  if(this.lease?.route.to===to&&this.target===to)return;
  if(this.target&&this.target!==to&&this.phase!=='arrived')throw Error('journey-already-pending');
  this.busy=true;const serial=++this.serial;this.target=to;this.phase='loading';this.error=null;this.loadProgress=0;
  try{
   const pending=this.adapter.prepare(this.region,to,start,token,p=>{if(serial===this.serial&&!token.cancelled&&Number.isFinite(p))this.loadProgress=Math.max(this.loadProgress,Math.min(.99,Math.max(0,p)));}).then(lease=>{if(token.cancelled||serial!==this.serial){lease.dispose();token.check();throw Error('journey-stale-load');}return lease;});
   const lease=await token.wait(pending);token.check();
   let camera:Pose;try{if(lease.route.from!==this.region||lease.route.to!==to)throw Error('journey-loaded-region-mismatch');validateJourneyRoute(lease.route,start);camera=this.adapter.readCamera();if([...camera.position,...camera.target].some(n=>!Number.isFinite(n)))throw Error('journey-invalid-camera');}catch(error){lease.dispose();throw error;}
   this.lease=lease;this.scenes.push(lease);this.distance=0;this.root=start;this.camera=camera;this.startCamera=this.camera;this.loadProgress=1;this.phase='ready';
  }catch(error){if(serial===this.serial){this.error=String(error);this.phase=token.cancelled?'paused':'failed';}throw error;}
  finally{if(serial===this.serial)this.busy=false;}
 }
 observe(actor:CharacterAdapter,world:WorldLease):void{
  if(!this.activePath||!this.lease||!this.startCamera)return;
  const f=actor.walkProgress?.();if(typeof f!=='number'||!Number.isFinite(f))return;
  this.distance=Math.min(routeLength(this.lease.route.path),this.startDistance+routeLength(this.activePath)*Math.max(0,Math.min(1,f)));
  this.root=sampleRoute(this.lease.route.path,this.distance);const ahead=sampleRoute(this.lease.route.path,this.distance+.08);
  if(dist(this.root,ahead)>.001)this.yaw=Math.atan2(ahead[0]-this.root[0],ahead[2]-this.root[2]);
  this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera,this.lease.route.focus,this.lease.route.lens,this.lease.route.startBlendM);world.setCamera(this.camera);
  this.phase=this.distance<this.lease.route.bridgeStart?'approach':this.distance<this.lease.route.bridgeEnd?'bridge':'arrival';
 }
 async walk(actor:CharacterAdapter,world:WorldLease,token:Cancellation):Promise<void>{
  if(this.busy)throw Error('journey-busy');if(!this.lease||!this.root||!this.startCamera)throw Error('journey-not-prepared');
  if(!actor.walkProgress)throw Error('journey-needs-distance-signal');
  this.busy=true;this.error=null;const serial=++this.serial,path=remainingRoute(this.lease.route.path,this.distance);this.startDistance=this.distance;
  try{
   this.show(true);token.check();
   if(path.length>1){this.activePath=path;this.phase=this.distance<this.lease.route.bridgeStart?'approach':this.distance<this.lease.route.bridgeEnd?'bridge':'arrival';
    await token.wait(actor.perform({kind:'walk',path,duration:routeLength(path)/this.lease.route.speed},token));token.check();}
   this.activePath=null;this.distance=routeLength(this.lease.route.path);this.root=sampleRoute(this.lease.route.path,this.distance);
   const before=sampleRoute(this.lease.route.path,Math.max(0,this.distance-.08));this.yaw=Math.atan2(this.root[0]-before[0],this.root[2]-before[2]);
   this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera,this.lease.route.focus,this.lease.route.lens,this.lease.route.startBlendM);world.setCamera(this.camera);actor.cancelAndReset(this.position()!);
   this.region=this.lease.route.to;this.phase='arrived';this.target=null;
  }catch(error){if(serial===this.serial){this.observe(actor,world);this.activePath=null;this.error=token.cancelled?null:String(error);this.phase=token.cancelled?'paused':'failed';}throw error;}
  finally{if(serial===this.serial)this.busy=false;}
 }
 /** Called BEFORE cancelling the action token, while its distance signal is still available. */
 suspend(actor:CharacterAdapter,world:WorldLease):void{this.observe(actor,world);this.activePath=null;if(this.isInTransit())this.phase='paused';}
 restore(actor:CharacterAdapter,world:WorldLease,visible:boolean):void{if(this.root)actor.cancelAndReset(this.position()!);if(this.camera)world.setCamera(this.camera);actor.setVisible(visible);this.show(visible);}
 show(visible:boolean){for(const scene of this.scenes)scene.show(visible);}
 dispose(){++this.serial;this.phase='disposed';this.activePath=null;for(const scene of this.scenes)scene.dispose();this.scenes=[];this.lease=null;this.root=null;}
}
