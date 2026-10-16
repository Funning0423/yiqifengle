import type { Cancellation, CharacterAdapter, Pose, StablePose, Vec, WorldLease } from './WorldFlowCore';
export type JourneyRegion = 'island'|'meadow'|'skycity';
export type JourneyPhase = 'idle'|'loading'|'ready'|'approach'|'bridge'|'arrival'|'paused'|'failed'|'arrived'|'disposed';
export type JourneyRoute = Readonly<{ from:JourneyRegion; to:JourneyRegion; path:readonly Vec[]; bridgeStart:number; bridgeEnd:number; speed:number }>;
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
/** Follow lens for the region bridges (Build05 occlusion fix). Same arc-length sample as the controller; the offset
 * is now in the PATH frame (behind/left/up of the smoothed walking heading) instead of a fixed world +X/-Z offset,
 * so a bridge that turns (meadow exit → sky platform rim, around the platform post) keeps the lens behind her rather
 * than beside the windmill or inside the post. The first blendM metres rejoin from the actual live lens; during that
 * swing the lens arcs up by blendLiftM so it passes over the beach palms instead of through their canopies.
 * Numbers are checked by tools/journey-integration/test-journey-occlusion.cjs against the real region GLB geometry. */
export const JOURNEY_CAMERA={blendM:4,headingWindowM:3,backM:6.2,sideM:-3,upM:5,leadM:.8,lookM:1.05,blendLiftM:5.5,fovDeg:48} as const;
export function journeyHeading(path:readonly Vec[],distance:number):[number,number]{
 const a=sampleRoute(path,Math.max(0,distance-JOURNEY_CAMERA.headingWindowM)),b=sampleRoute(path,distance+JOURNEY_CAMERA.headingWindowM),x=b[0]-a[0],z=b[2]-a[2],l=Math.hypot(x,z);
 return l>1e-6?[x/l,z/l]:[0,1];
}
export function journeyCamera(path:readonly Vec[],distance:number,start:Pose):Pose {
 const C=JOURNEY_CAMERA,p=sampleRoute(path,distance),[hx,hz]=journeyHeading(path,distance),sx=hz,sz=-hx;
 const u=Math.min(1,Math.max(0,distance/C.blendM)),blend=u*u*(3-2*u);
 const target:Vec=[p[0]+hx*C.leadM,p[1]+C.lookM,p[2]+hz*C.leadM],position:Vec=[p[0]-hx*C.backM+sx*C.sideM,p[1]+C.upM,p[2]-hz*C.backM+sz*C.sideM];
 const mix=(a:Vec,b:Vec):Vec=>[a[0]+(b[0]-a[0])*blend,a[1]+(b[1]-a[1])*blend,a[2]+(b[2]-a[2])*blend];
 const m=mix(start.position,position),lens:Vec=[m[0],m[1]+C.blendLiftM*Math.sin(Math.PI*blend),m[2]];
 return {position:lens,target:mix(start.target,target),fovVerticalDeg:(start.fovVerticalDeg??45)+(C.fovDeg-(start.fovVerticalDeg??45))*blend};
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
  this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera);world.setCamera(this.camera);
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
   this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera);world.setCamera(this.camera);actor.cancelAndReset(this.position()!);
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
