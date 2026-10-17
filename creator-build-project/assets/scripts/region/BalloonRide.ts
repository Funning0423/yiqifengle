import {Camera, Component, MeshRenderer, Node, Vec3, instantiate, isValid, view} from 'cc';
import {waitRegionAsset} from './RegionAssetDeadline';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {routeLength} from '../world-r1/RegionJourneyCore';
import type {JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Cancellation, CharacterAdapter, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {BALLOON_CAP, balloonBeats, balloonRoutePoints, stepTransitClock, type BalloonPlan, type Screen} from './TransportLeg';
import {domeVisible, transitBackdrop} from './TransitBackdrop';
import {emitTransitCue} from './TransitAudioHooks';
import {applyVehicleNight, basketFloor, loadBundlePrefab, mountVehicle} from './TransportVehicle';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
/** Meadow-local M6 (windmill door) and sky-local S0 lawn. See maps/nodes.json. */
const M6_LOCAL:Vec=[0.2,6.5,-25.6],S0_LOCAL:Vec=[5.4,-0.11,43.8];
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
function worldOf(model:Node,local:Vec):Vec{const v=new Vec3(local[0],local[1],local[2]);Vec3.transformMat4(v,v,model.worldMatrix);return [v.x,v.y,v.z];}
function eachNamed(root:Node,fn:(n:Node)=>void):void{fn(root);for(const c of root.children)eachNamed(c,fn);}
class BalloonDriver extends Component{step:(dt:number)=>void=()=>{};update(dt:number){this.step(Math.max(0,Math.min(0.1,dt||0)));}}
function nightNow():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
function screenNow():Screen|undefined{try{const v=view.getFrameSize();if(v.width>0&&v.height>0)return {w:v.width,h:v.height};}catch{}return undefined;}
/**
 * Meadow → sky city balloon lease. No rainbow-bridge mesh. A 6 s timeout in the adapter falls back to the bridge.
 * The city stays inactive until B-e. Rock strata stay hidden for the first 70% of B-b…B-g.
 */
export async function mountBalloonLease(opts:{parent:Node;meadow:Node|null;start:Vec;token:Cancellation;progress:(n:number)=>void}):Promise<JourneySceneLease&{model:Node|null}>{
 if(!opts.meadow||!isValid(opts.meadow,true))throw Error('journey-meadow-lease-missing');
 const token=opts.token,progress=opts.progress;
 const prefab=await waitRegionAsset(loadRegionPrefab(REGIONS.skycity,p=>progress(p*.6)),token);token.check();
 prefab.addRef();
 const owned:Array<{destroy():void}>=[],rig=new Node('RegionJourney-skycity');rig.active=false;opts.parent.addChild(rig);
 let dead=false,model:Node|null=null,vehicle:Node|null=null,cloud:Node|null=null,cards:Node|null=null,offNight=()=>{};
 const release=()=>{if(dead)return;dead=true;offNight();rig.active=false;if(isValid(rig,true))rig.destroy();for(const a of owned)a.destroy();prefab.decRef();};
 try{
  model=mountRegion(REGIONS.skycity,prefab,rig);
  for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
  const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');
  await waitRegionAsset(ambient.prepare(),token);token.check();
  model.setRotationFromEuler(0,0,0);model.setPosition(0,0,0);
  const courtNode=find(model,'anchor_starcourt_center');
  const courtLocal:Vec=courtNode?[courtNode.worldPosition.x,courtNode.worldPosition.y,courtNode.worldPosition.z]:[0,-0.07,30];
  const m6=worldOf(opts.meadow,M6_LOCAL);
  const launch:Vec=[m6[0]+8,m6[1],m6[2]+3];
  const walkIn=Math.hypot(opts.start[0]-launch[0],opts.start[1]-launch[1],opts.start[2]-launch[2]);
  const plan=balloonBeats(m6,S0_LOCAL,courtLocal,{launch,walkInM:walkIn,walkOutM:8.6});
  model.setRotationFromEuler(0,plan.yawDeg,0);
  model.setWorldPosition(plan.origin[0],plan.origin[1],plan.origin[2]);
  model.active=false;
  const strata=find(model,'env_sky_static_rock_strata');if(strata)strata.active=false;
  eachNamed(model,n=>{if(n.name.startsWith('state_')&&n.name!=='state_bridge_after')n.active=false;});
  const points=balloonRoutePoints(opts.start,plan);
  const length=routeLength(points);
  const route={from:'meadow' as const,to:'skycity' as const,path:points,bridgeStart:length*0.42,bridgeEnd:Math.min(length,length*0.42+Math.max(0.05,length*0.04)),speed:1.2,startBlendM:0,focus:plan.court};
  const balloonPrefab=await loadBundlePrefab('transport_balloon');if(balloonPrefab){balloonPrefab.addRef();owned.push({destroy(){balloonPrefab.decRef();}});}
  vehicle=mountVehicle(balloonPrefab,rig);vehicle.setWorldPosition(launch[0],launch[1],launch[2]);
  const hold=(p:{addRef():void;decRef():void}|null)=>{if(p){p.addRef();owned.push({destroy(){p.decRef();}});}};
  const cloudPrefab=await loadBundlePrefab('transit_cloud_band');hold(cloudPrefab);
  cloud=cloudPrefab?instantiate(cloudPrefab):new Node('transit_cloud_band');if(!cloud.parent)rig.addChild(cloud);cloud.setWorldPosition(plan.cloudAt[0],plan.cloudY,plan.cloudAt[2]);
  const cardPrefab=await loadBundlePrefab('transit_sky_cards');hold(cardPrefab);
  cards=cardPrefab?instantiate(cardPrefab):new Node('transit_sky_cards');if(!cards.parent)rig.addChild(cards);
  const domes:Node[]=[];eachNamed(model,n=>{if(n.name==='env_sky_dome'||n.name==='meadow_sky_dome')domes.push(n);});
  eachNamed(opts.meadow,n=>{if(n.name==='meadow_sky_dome'||n.name==='env_sky_dome')domes.push(n);});
  let night=nightNow();
  const paintBackdrop=(t:number)=>{
   const frame=transitBackdrop(t,plan.total,night,plan.cityActiveAt);
   for(const n of domes){const show=domeVisible(n.name,frame);for(const r of n.getComponents(MeshRenderer))r.enabled=show;if(n.name==='meadow_sky_dome'||n.name==='env_sky_dome')n.active=show;}
   if(model)model.active=t>=plan.cityActiveAt;
   if(strata)strata.active=t>=plan.strataHideUntil&&t>=plan.cityActiveAt;
   eachNamed(opts.meadow!,n=>{if(n.name.startsWith('meadow_grass_instances'))n.active=t<plan.grassOffAt;});
   if(vehicle)applyVehicleNight(vehicle,night);
  };
  offNight=onDayNightChange(mode=>{night=String(mode).includes('night');});
  const driver=rig.addComponent(BalloonDriver);
  const ride=async(actor:CharacterAdapter,world:WorldLease,rideToken:Cancellation)=>{
   const cue=(id:string,name:Parameters<typeof emitTransitCue>[0])=>{emitTransitCue(name,{t:0,region:'meadow-skycity',id});};
   const distIn=Math.hypot(opts.start[0]-launch[0],opts.start[2]-launch[2]);
   if(distIn>0.4){cue('B-a','node-walk-start');await actor.perform({kind:'walk',path:[opts.start,launch],duration:Math.min(BALLOON_CAP.a,Math.max(0.4,distIn/1.2))},rideToken);rideToken.check();}
   const yaw=Math.atan2(plan.s0[0]-launch[0],plan.s0[2]-launch[2]);
   try{await actor.perform({kind:'turn',controllerRoot:launch,fromYawRad:yaw,toYawRad:yaw,direction:'left'},rideToken);}catch{/* a zero turn is still a stand */}
   rideToken.check();
   const girl=(actor as any).node as Node|undefined;const prev=girl?.parent??null;const seat=basketFloor(vehicle!);
   if(girl&&isValid(girl,true))girl.setParent(seat,true);
   cue('B-b','balloon-burner');
   const clock={t:plan.beats.find(b=>b.id==='B-b')!.t0,hiddenFor:0,fade:0};
   const fired=new Set<string>();
   await new Promise<void>((ok,bad)=>{
    const off=rideToken.onCancel(()=>bad(Error('cancelled')));
    driver.step=(dt)=>{
     const hidden=typeof document!=='undefined'&&!!document.hidden;
     const next=stepTransitClock(clock,dt,hidden);clock.t=next.t;clock.hiddenFor=next.hiddenFor;clock.fade=next.fade;
     const t=clock.t;const sample=plan.vehicle(t);
     vehicle!.setWorldPosition(sample.pos[0],sample.pos[1],sample.pos[2]);
     vehicle!.setRotationFromEuler(sample.roll*0.15,sample.yaw*180/Math.PI,sample.roll);
     const pose=plan.camera(t,screenNow());world.setCamera(pose);
     paintBackdrop(t);
     for(const b of plan.beats){if(fired.has(b.id)||t<b.t0)continue;fired.add(b.id);
      const cue=b.id==='B-c'?'balloon-liftoff':b.id==='B-d'?'balloon-cloud-enter':b.id==='B-e'?'balloon-cloud-exit':b.id==='B-f'?'balloon-land':null;
      if(cue&&!hidden)emitTransitCue(cue,{t,region:'meadow-skycity',id:b.id});}
     (globalThis as any).__QF_BALLOON={t,total:plan.total,beat:plan.beats.find(b=>t>=b.t0&&t<b.t1)?.id??'board'};
     if(t>=plan.beats.find(b=>b.id==='B-g')!.t1){off();driver.step=()=>{};ok();}
    };
   });
   rideToken.check();
   if(girl&&prev&&isValid(prev,true))girl.setParent(prev,true);
   actor.cancelAndReset({kind:'standing',controllerRoot:plan.s0,yawRad:yaw});
   const out=Math.hypot(plan.court[0]-plan.s0[0],plan.court[2]-plan.s0[2]);
   if(out>0.4)await actor.perform({kind:'walk',path:[plan.s0,plan.court],duration:Math.min(BALLOON_CAP.h,Math.max(0.8,out/1.2))},rideToken);
   paintBackdrop(plan.total);
  };
  progress(.98);
  const lease:JourneySceneLease&{model:Node|null}={model,route,ride,show(visible){if(dead)return;rig.active=visible;model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
  return lease;
 }catch(error){release();throw error;}
}
