import {Camera, Color, Component, Director, JsonAsset, MeshRenderer, Node, Prefab, Quat, Vec3, assetManager, director, gfx, instantiate, isValid} from 'cc';
import {waitRegionAsset} from './RegionAssetDeadline';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {routeLength} from '../world-r1/RegionJourneyCore';
import type {JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Cancellation, CharacterAdapter, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT, meadowExitFrom, plus, skyDeckRoute, skycityYawDeg} from './RegionJourneyLayout';
import {balloonBeats, balloonRoutePoints, stepTransitClock} from './TransportLeg';
import {basketFloor, loadBundlePrefab, mountVehicle, applyVehicleNight} from './TransportVehicle';
import {emitTransitCue} from './TransitAudioHooks';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {ALWAYS_CLOUD, ALWAYS_HIDDEN, ART_SKY, CITY_CLOUD, CITY_ON_T, FLIGHT_FORMAT, GRASS_OFF_T, ISLET_NODES, ISLETS_ON_T, LAND_T, MEADOW_OFF_T, S0_LOCAL, balloonQuat, rotY, type FlightDoc, type Rigid} from './BalloonFlight';
const M6_LOCAL:Vec=[0.2,6.5,-25.6];
const GIRL_YAW=-76.6;
const q=new Quat();
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
function eachNamed(root:Node,fn:(n:Node)=>void):void{fn(root);for(const c of root.children)eachNamed(c,fn);}
function anchor(model:Node,name:string):Vec{const node=find(model,name);if(!node)throw Error('journey-anchor-missing:'+name);const p=node.worldPosition;return [p.x,p.y,p.z];}
function nightNow():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
function holdAt():number|null{try{const q=typeof location!=='undefined'?String(location.search||''):'';const m=/(?:^|[?&])balloonAt=([0-9.]+)/.exec(q);if(!m)return null;const t=Number(m[1]);return Number.isFinite(t)?t:null;}catch{return null;}}
class TransitDriver extends Component{step:(dt:number)=>void=()=>{};lateUpdate(dt:number){this.step(Math.max(0,Math.min(0.1,dt||0)));}}
/** glTF scene prefab inside region_transit_balloon. Same loadDir fallback as the balloon-fix (bundle.load misses the sub-asset). */
export function loadTransitPrefab(name:string):Promise<Prefab|null>{return loadBundlePrefab(name,'region_transit_balloon');}
function skybox(node:Node|null):void{
 if(!node)return;
 eachNamed(node,n=>{
  const r=n.getComponent(MeshRenderer);if(!r)return;
  (r as any).priority=-100;
  const m=r.getMaterialInstance(0);if(!m)return;
  try{m.overridePipelineStates({depthStencilState:{depthTest:false,depthWrite:false,depthFunc:gfx.ComparisonFunc.ALWAYS}},0);}catch{/* material without a pass */}
 });
}
function showBothSides(root:Node):void{
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;try{m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);}catch{/* unlit pass */}}});
}
function setEmissive(root:Node,night:boolean):void{
 const black=new Color(0,0,0,255);
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;
  if(night){try{m.setProperty('emissive',black);}catch{}try{m.setProperty('emissiveScale',0);}catch{}}
 }});
}
function showNamed(root:Node|null,names:readonly string[],on:boolean):void{
 if(!root)return;const set=new Set(names);
 eachNamed(root,n=>{if(set.has(n.name))n.active=on;});
}
/** Live env_skycity placement: the rainbow-bridge offset and heading. The art balloonSkyOffset is not applied. */
export function placeLiveSkycity(model:Node,meadow:Node,start:Vec):Rigid{
 model.setRotationFromEuler(0,0,0);
 model.setRotationFromEuler(0,skycityYawDeg(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start')),0);
 const exit:Vec[]=[];for(let i=2;i<=REGION_JOURNEY_LAYOUT.meadowExitPathIndex;i++)exit.push(anchor(meadow,'walk_path_'+String(i).padStart(2,'0')));
 const edge=meadowExitFrom(start,exit).at(-1)??exit.at(-1)??start;
 const placed=skyDeckRoute(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start'));
 const landing=plus(edge,REGION_JOURNEY_LAYOUT.skycityOffset);
 const p=model.worldPosition;
 model.setWorldPosition(...plus([p.x,p.y,p.z],[landing[0]-placed.rim[0],landing[1]-placed.rim[1],landing[2]-placed.rim[2]]));
 const w=model.worldPosition,e=model.eulerAngles;
 return {yawDeg:e.y,origin:[w.x,w.y,w.z]};
}
function publishFlight(doc:FlightDoc):void{(globalThis as any).__QF_BALLOON_FLIGHT=doc;}
/**
 * Meadow → sky city on the GGbot balloon. The city node keeps the gameplay placement.
 * 11.2 s hides the meadow, 11.6 s shows the city; both sit inside the full-screen cloud.
 */
export async function mountBalloonLease(opts:{parent:Node;meadow:Node|null;start:Vec;token:Cancellation;progress:(n:number)=>void}):Promise<JourneySceneLease&{model:Node|null}>{
 if(!opts.meadow||!isValid(opts.meadow,true))throw Error('journey-meadow-lease-missing');
 const token=opts.token,progress=opts.progress,meadow=opts.meadow;
 const prefab=await waitRegionAsset(loadRegionPrefab(REGIONS.skycity,p=>progress(p*.45)),token);token.check();
 prefab.addRef();
 const owned:Array<{destroy():void}>=[],rig=new Node('RegionJourney-skycity');rig.active=false;opts.parent.addChild(rig);
 let dead=false,model:Node|null=null,offNight=()=>{},beforeDraw=()=>{};
 const release=()=>{if(dead)return;dead=true;director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);(globalThis as any).__QF_BALLOON_LENS=false;(globalThis as any).__QF_BALLOON_HOLD_SKY=false;offNight();rig.active=false;if(isValid(rig,true))rig.destroy();for(const a of owned)a.destroy();prefab.decRef();};
 try{
  const json=await loadFlightJson();token.check();if(json.format!==FLIGHT_FORMAT)throw Error('balloon-flight-format');
  publishFlight(json);
  model=mountRegion(REGIONS.skycity,prefab,rig);
  for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
  const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');
  await waitRegionAsset(ambient.prepare(),token);token.check();
  model.setRotationFromEuler(0,0,0);model.setPosition(0,0,0);
  const city=placeLiveSkycity(model,meadow,opts.start);
  const mp=meadow.worldPosition,meadowFrame:Rigid={yawDeg:meadow.eulerAngles.y,origin:[mp.x,mp.y,mp.z]};
  model.active=false;
  showNamed(model,ALWAYS_HIDDEN,false);
  showNamed(model,ISLET_NODES,false);
  const m6=worldOf(meadow,M6_LOCAL);
  const plan=balloonBeats(m6,S0_LOCAL,anchor(model,'anchor_starcourt_center'),{cityFrame:city,meadowFrame,walkInM:0,walkOutM:0});
  const points=balloonRoutePoints(opts.start,plan);
  const length=routeLength(points);
  const route={from:'meadow' as const,to:'skycity' as const,path:points,bridgeStart:length*0.42,bridgeEnd:Math.min(length,length*0.42+Math.max(0.05,length*0.04)),speed:1.2,startBlendM:0,focus:plan.court};
  const balloonPrefab=await loadTransitPrefab('transport_balloon');
  if(!balloonPrefab)throw Error('balloon-art-missing');
  balloonPrefab.addRef();owned.push({destroy(){balloonPrefab.decRef();}});
  const vehicle=mountVehicle(balloonPrefab,rig);
  showBothSides(vehicle);
  const cloudsPrefab=await loadTransitPrefab('transit_clouds_merged');
  if(!cloudsPrefab)throw Error('balloon-clouds-missing');
  cloudsPrefab.addRef();owned.push({destroy(){cloudsPrefab.decRef();}});
  const clouds=instantiate(cloudsPrefab);clouds.name='transit_clouds_merged';rig.addChild(clouds);
  showBothSides(clouds);
  const nightPrefab=await loadTransitPrefab('transit_night_dome');
  let nightDome:Node|null=null;
  if(nightPrefab){nightPrefab.addRef();owned.push({destroy(){nightPrefab.decRef();}});nightDome=instantiate(nightPrefab);nightDome.name='transit_night_dome';rig.addChild(nightDome);nightDome.active=false;skybox(nightDome);}
  const farHook=new Node('far_meadow_card');rig.addChild(farHook);farHook.active=false;
  const farPrefab=await loadTransitPrefab('far_meadow_card');
  if(farPrefab){farPrefab.addRef();owned.push({destroy(){farPrefab.decRef();}});const card=instantiate(farPrefab);farHook.addChild(card);farHook.active=true;}
  const seat=find(vehicle,'stand_point')??basketFloor(vehicle);
  const flame=find(vehicle,'burner_flame');
  let night=nightNow();
  const domes:Node[]=[];
  const scene=director.getScene();
  if(scene)eachNamed(scene,n=>{if(n.name==='env_sky_dome'||n.name==='meadow_sky_dome')domes.push(n);});
  eachNamed(meadow,n=>{if(n.name==='meadow_sky_dome'||n.name==='meadow_far_hills'||n.name==='meadow_clouds_near')n.active=false;});
  const paint=(t:number)=>{
   const meadowOn=t<plan.meadowOffAt,cityOn=t>=plan.cityActiveAt;
   if(isValid(meadow,true))meadow.active=meadowOn;
   if(model)model.active=cityOn;
   showNamed(model,ISLET_NODES,cityOn&&t>=ISLETS_ON_T);
   showNamed(model,ALWAYS_HIDDEN,false);
   showNamed(clouds,CITY_CLOUD,cityOn);
   showNamed(clouds,ALWAYS_CLOUD,true);
   eachNamed(meadow,n=>{if(n.name.startsWith('meadow_grass'))n.active=meadowOn&&t<GRASS_OFF_T;});
   (globalThis as any).__QF_BALLOON_HOLD_SKY={night};
   (globalThis as any).__QF_BALLOON_LENS=true;
   for(const n of domes){if(!isValid(n,true))continue;const day=n.name==='env_sky_dome'&&!night;n.active=day;for(const r of n.getComponents(MeshRenderer))r.enabled=day;if(day)skybox(n);}
   if(nightDome){nightDome.active=night;if(night)skybox(nightDome);}
   setEmissive(clouds,night);
   applyVehicleNight(vehicle,night);
   if(flame){const burn=t>=0.4&&t<LAND_T;flame.active=burn;const s=burn?1+0.15*Math.sin(t*18):1;flame.setScale(s,s,s);}
  };
  offNight=onDayNightChange(mode=>{night=String(mode).includes('night');});
  const driver=rig.addComponent(TransitDriver);
  const ride=async(actor:CharacterAdapter,world:WorldLease,rideToken:Cancellation)=>{
   const girl=(actor as any).node as Node|undefined;const prev=girl?.parent??null;
   if(girl&&isValid(girl,true)){girl.setParent(seat,true);girl.setPosition(0,0,0);girl.setRotationFromEuler(0,GIRL_YAW,0);}
   const setWind=(actor as {setWindSource?:(fn:(()=>number|null)|null)=>void}).setWindSource;
   if(setWind)setWind(()=>0.35);
   const hold=holdAt();
   const clock={t:0,hiddenFor:0,fade:0};
   const fired=new Set<string>();
   const cues:Array<[number,string]>=Object.entries(json.cues).map(([name,t])=>[t,name]).sort((a,b)=>a[0]-b[0]);
   let dcWorst=0,dcAt=0,frames=0;
   const apply=()=>{
    const t=Math.max(0,Math.min(plan.total,clock.t));
    const sample=plan.vehicle(t);
    vehicle.setWorldPosition(sample.pos[0],sample.pos[1],sample.pos[2]);
    const qq=balloonQuat(sample.yaw*180/Math.PI,sample.roll);Quat.set(q,qq[0],qq[1],qq[2],qq[3]);vehicle.setWorldRotation(q);
    placeClouds(clouds,t,city,meadowFrame);
    const pose=plan.camera(t);world.setCamera(pose);
    const cam=findCamera();if(nightDome&&cam)nightDome.setWorldPosition(cam.worldPosition);if(cam)for(const n of domes)if(n.active&&isValid(n,true))n.setWorldPosition(cam.worldPosition);
    if(girl&&isValid(girl,true)&&girl.parent===seat){girl.setPosition(0,0,0);girl.setRotationFromEuler(0,GIRL_YAW,0);}
    paint(t);
    return t;
   };
   beforeDraw=()=>{if(!dead)apply();};
   director.on(Director.EVENT_BEFORE_DRAW,beforeDraw);
   await new Promise<void>((ok,bad)=>{
    const off=rideToken.onCancel(()=>bad(Error('cancelled')));
    driver.step=(dt)=>{
     const hidden=typeof document!=='undefined'&&!!document.hidden;
     if(!(hold!=null&&clock.t>=hold-1e-4)){const next=stepTransitClock(clock,dt,hidden);clock.t=next.t;clock.hiddenFor=next.hiddenFor;clock.fade=next.fade;}
     const t=apply();
     for(const [ct,name] of cues){if(fired.has(name)||t<ct||hidden)continue;fired.add(name);emitTransitCue(name as any,{t,region:'meadow-skycity',id:name});}
     let dc=0;try{dc=Number((director as any).root?.device?.numDrawCalls)||0;}catch{dc=0;}
     frames++;if(dc>dcWorst){dcWorst=dc;dcAt=t;}
     const beat=plan.beats.find(b=>t>=b.t0&&t<b.t1)?.id??'board';
     (globalThis as any).__QF_BALLOON={t,total:plan.total,beat,alt:plan.vehicle(t).pos[1]-plan.launch[1],wind:0.35,night,meadow:t<MEADOW_OFF_T,city:t>=CITY_ON_T,dc,dcWorst,dcAt,frames,hold:hold!=null&&t>=(hold??0)-1e-3};
     if(t>=plan.total&&hold==null){off();director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);driver.step=()=>{};ok();}
    };
   });
   rideToken.check();
   if(setWind)setWind(()=>{try{const w=(globalThis as any).__worldDayNight?.windStrength?.();return typeof w==='number'?w:null;}catch{return null;}});
   if(girl&&isValid(girl,true)){const worldParent=prev&&isValid(prev,true)?prev:rig.parent;if(worldParent)girl.setParent(worldParent,true);}
   actor.cancelAndReset({kind:'standing',controllerRoot:plan.s0,yawRad:plan.vehicle(LAND_T).yaw});
   (globalThis as any).__QF_BALLOON_LENS=false;(globalThis as any).__QF_BALLOON_HOLD_SKY=false;
   if(model){model.active=true;showNamed(model,ISLET_NODES,true);}
   if(isValid(meadow,true))meadow.active=false;
   if(nightDome)nightDome.active=false;
   paint(plan.total);
  };
  progress(.98);
  const lease:JourneySceneLease&{model:Node|null}={model,route,ride,show(visible){if(dead)return;rig.active=visible;model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
  return lease;
 }catch(error){release();throw error;}
}
function worldOf(model:Node,local:Vec):Vec{const v=new Vec3(local[0],local[1],local[2]);Vec3.transformMat4(v,v,model.worldMatrix);return [v.x,v.y,v.z];}
function findCamera():Node|null{const scene=director.getScene();if(!scene)return null;const cams=scene.getComponentsInChildren(Camera);const world=cams.find(c=>c.node.name!=='WorldNavigationCamera'&&c.visibility!==0);return (world??cams[0])?.node??null;}
/** Cloud mesh is authored in meadow-local. Before the seam it copies the live meadow root.
 * After the seam, Ry(gameYaw-artYaw) * p + (gameOrigin - Ry(gameYaw-artYaw) * artOrigin) matches seamMap. */
function placeClouds(clouds:Node,t:number,city:Rigid,meadow:Rigid):void{
 const seam=t+1e-6>=CITY_ON_T;
 const yaw=seam?city.yawDeg-ART_SKY.yawDeg:meadow.yawDeg;
 const shift=seam?rotY(yaw,ART_SKY.origin):[0,0,0] as Vec;
 const origin=seam?[city.origin[0]-shift[0],city.origin[1]-shift[1],city.origin[2]-shift[2]] as Vec:meadow.origin;
 Quat.fromEuler(q,0,yaw,0);clouds.setWorldRotation(q);
 clouds.setWorldPosition(origin[0],origin[1],origin[2]);
}
function loadFlightJson():Promise<FlightDoc>{
 return new Promise((ok,fail)=>{
  assetManager.loadBundle('region_transit_balloon',(err,bundle)=>{
   if(err||!bundle){fail(err||Error('no bundle region_transit_balloon'));return;}
   const take=(asset:any)=>{const data=asset?.json??asset;if(data&&data.format)ok(data as FlightDoc);else fail(Error('balloon-flight-json-missing'));};
   bundle.load('balloon_flightpath',JsonAsset,(e:any,asset:JsonAsset)=>{
    if(!e&&asset){take(asset);return;}
    bundle.loadDir('',(e2:any,list:any[])=>{
     if(e2){fail(e2);return;}
     const hit=(list||[]).find(a=>a&&(a.name==='balloon_flightpath'||a.json?.format));
     hit?take(hit):fail(Error('balloon-flight-json-missing'));
    });
   });
  });
 });
}
