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
/** Arc-length camera rail: same sample as the controller, fixed follow offset. The first four metres smoothly
 * rejoin from the actual live lens, so user-dragged island views do not cut to an authored start shot. */
export function journeyCamera(path:readonly Vec[],distance:number,start:Pose):Pose {
 const p=sampleRoute(path,distance),u=Math.min(1,Math.max(0,distance/4)),blend=u*u*(3-2*u);
 const target:Vec=[p[0],p[1]+1.05,p[2]+.8],position:Vec=[p[0]+3.6,p[1]+3.4,p[2]-6.2];
 const mix=(a:Vec,b:Vec):Vec=>[a[0]+(b[0]-a[0])*blend,a[1]+(b[1]-a[1])*blend,a[2]+(b[2]-a[2])*blend];
 return {position:mix(start.position,position),target:mix(start.target,target),fovVerticalDeg:(start.fovVerticalDeg??45)+(48-(start.fovVerticalDeg??45))*blend};
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
