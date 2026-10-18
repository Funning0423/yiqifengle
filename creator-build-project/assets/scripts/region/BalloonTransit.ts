import {Camera, Color, Component, Director, DirectionalLight, EffectAsset, JsonAsset, Material, MeshRenderer, Node, Prefab, Quat, Vec3, assetManager, director, gfx, instantiate, isValid} from 'cc';
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
import {
 ALWAYS_CLOUD, ALWAYS_HIDDEN, BACKDROP_HIDE, CITY_CLOUD, CITY_ON_T, FAR_CARD_ON_T, FLIGHT_FORMAT, GRASS_OFF_T,
 ISLET_NODES, ISLETS_ON_T, LAND_T, LIGHT_RAMP_T0, LIGHT_RAMP_YAW, MEADOW_OFF_T, NIGHT_MOON_HIDE, P_SEAM, S0_LOCAL,
 SEAM_T, STRATA_OFF_T, balloonQuat, postSeamFrame, skyNodeAfterArrival, type FlightDoc, type Rigid,
} from './BalloonFlight';
const M6_LOCAL:Vec=[0.2,6.5,-25.6];
const GIRL_YAW=-76.6;
/** Plan B: ShoreBreak / RoomLightingRig rewrite env_sea_surface every frame, so teleport×6 (plan A) cannot stick. */
const SEA_PLAN:'A'|'B'='B';
const q=new Quat();
/** Sea/backdrop restore under a forced full-screen fade (landing cover is only ~20% cloud). */
const HANDOFF_FADE_T0=35.7;
const HANDOFF_COVER_T=35.9;
const HANDOFF_FADE_T1=36.0;
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
  // Draw first, no depth write; keep depth test so later opaques (clouds/balloon) can cover the dome.
  try{m.overridePipelineStates({depthStencilState:{depthTest:true,depthWrite:false,depthFunc:gfx.ComparisonFunc.LEQUAL}},0);}catch{/* material without a pass */}
 });
}
function showBothSides(root:Node):void{
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;try{m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);}catch{/* unlit pass */}}});
}
/** Drop shadow passes during the transit — city + clouds otherwise push DC past 53. */
function noShadow(root:Node|null):void{
 if(!root)return;
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){
  try{r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;}catch{}
  try{(r as any).receiveShadow=0;}catch{}
 }});
}
function setEmissive(root:Node,night:boolean):void{
 if(!night)return;
 const black=new Color(0,0,0,255);
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){
  const shared=r.getSharedMaterial(0);if(!shared)continue;
  const m=r.getMaterialInstance(0);if(!m)continue;
  // Rebind maps — getMaterialInstance alone drops glTF albedo and flashes magenta at night.
  for(const key of ['mainTexture','albedoMap','metallicRoughnessMap','normalMap','emissiveMap']){
   try{const tex=shared.getProperty(key);if(tex!=null)m.setProperty(key,tex);}catch{/* slot absent */}
  }
  try{m.setProperty('emissive',black);}catch{}
  try{m.setProperty('emissiveScale',0);}catch{}
 }});
}
/**
 * Force builtin-unlit so glTF materials with a missing/unbound albedo never flash engine magenta,
 * and so night never leaves a full-bright unlit green sea/card under the city.
 */
function forceUnlit(root:Node|null,color:Color,opts?:{keepTexture?:boolean;vertexColor?:boolean}):void{
 if(!root||!EffectAsset.get('builtin-unlit'))return;
 eachNamed(root,n=>{for(const r of n.getComponents(MeshRenderer)){
  try{r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;}catch{}
  let tex:unknown=null;
  if(opts?.keepTexture){
   try{const shared=r.getSharedMaterial(0);tex=shared?.getProperty('mainTexture')??shared?.getProperty('albedoMap')??null;}catch{tex=null;}
  }
  const defines:Record<string,boolean>={};
  if(tex)defines.USE_TEXTURE=true;
  else if(opts?.vertexColor)defines.USE_VERTEX_COLOR=true;
  const m=new Material();
  m.initialize({effectName:'builtin-unlit',technique:0,defines});
  try{m.setProperty('mainColor',color);}catch{}
  if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
  try{r.setMaterialInstance(0,m);}catch{}
  // clouds_floor is authored with downward normals; a fresh unlit pass culls it and the cruise view falls through to the sea.
  try{m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);}catch{/* unlit pass */}
 }});
}
/** Day sea + the far-card skirt share this sRGB so the card's rectangular sea does not read as a separate plate. */
const SEA_DAY=new Color(172,216,236,255);
const lookCache=new WeakMap<Node,boolean>();
/** Far card: island albedo stays; skirt pixels in the glb are the same light blue as the sea disc. Night: solid dark. */
function tintFarCard(root:Node|null,night:boolean):void{
 if(!root||lookCache.get(root)===night)return;
 const nite=new Color(42,50,62,255);
 forceUnlit(root,night?nite:new Color(255,255,255,255),{keepTexture:!night});
 lookCache.set(root,night);
}
/** Sea fallback: light blue (day, matches the card skirt) / dark (night). No empty-albedo path. */
function paintSeaFallback(root:Node|null,night:boolean):void{
 if(!root||lookCache.get(root)===night)return;
 forceUnlit(root,night?new Color(18,26,40,255):SEA_DAY);
 lookCache.set(root,night);
}
/**
 * Cloud deck uses baked vertex shade (0.66–1, cool white) × unlit mainColor.
 * Day stays white→light grey. Night mainColor sits in the dark blue-grey range; vertex shade keeps the clumps.
 * Never an emissive glTF instance (magenta path).
 */
function paintCloudSea(clouds:Node|null,night:boolean):void{
 if(!clouds||lookCache.get(clouds)===night)return;
 const day=new Color(255,255,255,255),nite=new Color(68,80,94,255);
 eachNamed(clouds,n=>{
  if(n.name==='clouds_floor'||n.name==='clouds_floor_puff'||n.name==='clouds_city_sea')forceUnlit(n,night?nite:day,{vertexColor:true});
 });
 lookCache.set(clouds,night);
}
/** Always-hidden neon / DC extras. Island body + hanging vines are gated separately. */
const CITY_RIDE_HIDE=[
 'env_sky_island_vine_cards','env_sky_island_windcore',
 'env_sky_rope_root_01','env_sky_rope_root_02','env_sky_rope_root_03','env_sky_rope_root_04',
 'env_sky_rope_root_05','env_sky_rope_root_06','env_sky_rope_root_07','env_sky_rope_root_08',
];
const ISLAND_BODY=['env_sky_static_palette','env_sky_static_rock_strata'];
const ISLAND_VINES=['env_sky_island_vines'];
/**
 * Hide neon foliage cards only. Keep env_sky_static_palette / rock_strata (island body).
 * Do not touch city material instances — albedoScale/mainColor edits flash magenta on ruins.
 */
function hideCityNightGlow(model:Node|null,_night:boolean):void{
 if(!model)return;
 eachNamed(model,n=>{
  if(/ground_card|foliage_card|flower|Icosphere|plant\d*_vine|rope_root|windcore/i.test(n.name))n.active=false;
 });
}
/** Night silhouette: unlit darken non-emissive city meshes; leave emissive window mats alone. */
function dimCityNight(model:Node|null,night:boolean,cache:WeakSet<MeshRenderer>):void{
 if(!model||!night||!EffectAsset.get('builtin-unlit'))return;
 eachNamed(model,n=>{
  if(/window|emissive|lamp|light|flame|pennant|flag/i.test(n.name))return;
  for(const r of n.getComponents(MeshRenderer)){
   if(cache.has(r))continue;
   const shared=r.getSharedMaterial(0);if(!shared)continue;
   let emissive=false;
   try{const e=shared.getProperty('emissiveScale');if(typeof e==='number'&&e>0.05)emissive=true;}catch{/* */}
   try{const e=shared.getProperty('emissive');if(e&&((e as Color).r>8||(e as any).x>0.02))emissive=true;}catch{/* */}
   try{if(shared.getProperty('emissiveMap'))emissive=true;}catch{/* */}
   if(emissive)continue;
   let tex:unknown=null;
   try{tex=shared.getProperty('mainTexture')??shared.getProperty('albedoMap')??null;}catch{tex=null;}
   const m=new Material();
   m.initialize({effectName:'builtin-unlit',technique:0,defines:tex?{USE_TEXTURE:true}:{}});
   try{m.setProperty('mainColor',new Color(38,44,58,255));}catch{}
   if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
   try{r.setMaterialInstance(0,m);cache.add(r);}catch{}
  }
 });
}
function showNamed(root:Node|null,names:readonly string[],on:boolean):void{
 if(!root)return;const set=new Set(names);
 eachNamed(root,n=>{if(set.has(n.name))n.active=on;});
}
function setRigid(node:Node,frame:Rigid):void{
 Quat.fromEuler(q,0,frame.yawDeg,0);node.setWorldRotation(q);
 node.setWorldPosition(frame.origin[0],frame.origin[1],frame.origin[2]);
}
function findSceneNamed(name:string):Node|null{
 const scene=director.getScene();if(!scene)return null;let hit:Node|null=null;
 eachNamed(scene,n=>{if(!hit&&n.name===name)hit=n;});return hit;
}
/** Soften sea specular during cruise (plan A leftover / game sea if briefly visible). */
function dampSeaSpecular(sea:Node|null,on:boolean):void{
 if(!sea)return;
 eachNamed(sea,n=>{for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;
  try{m.setProperty('roughness',on?0.92:0.35);}catch{}
  try{m.setProperty('metallic',on?0:0);}catch{}
  try{m.setProperty('specularIntensity',on?0.05:1);}catch{}
 }});
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
 * Meadow → sky city on the GGbot balloon (flightpath 2.2 + far card + seam at 11.4).
 * Sea plan B: hide game sea, show transit_sea_fallback under transitFrame (ShoreBreak would clobber plan A).
 */
export async function mountBalloonLease(opts:{parent:Node;meadow:Node|null;start:Vec;token:Cancellation;progress:(n:number)=>void}):Promise<JourneySceneLease&{model:Node|null}>{
 if(!opts.meadow||!isValid(opts.meadow,true))throw Error('journey-meadow-lease-missing');
 const token=opts.token,progress=opts.progress,meadow=opts.meadow;
 const prefab=await waitRegionAsset(loadRegionPrefab(REGIONS.skycity,p=>progress(p*.45)),token);token.check();
 prefab.addRef();
 const owned:Array<{destroy():void}>=[],rig=new Node('RegionJourney-skycity');rig.active=false;opts.parent.addChild(rig);
  let dead=false,model:Node|null=null,offNight=()=>{},beforeDraw=()=>{};
  let mainLight:DirectionalLight|null=null,mainShadow0=true,mainIllum0=0;
  const release=()=>{if(dead)return;dead=true;director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);(globalThis as any).__QF_BALLOON_LENS=false;(globalThis as any).__QF_BALLOON_HOLD_SKY=false;(globalThis as any).__QF_BALLOON_SEA_PLAN=null;offNight();
  try{if(mainLight){(mainLight as any).shadowEnabled=mainShadow0;if(mainIllum0>0)mainLight.illuminance=mainIllum0;}}catch{}
  try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=true;}catch{}
  rig.active=false;if(isValid(rig,true))rig.destroy();for(const a of owned)a.destroy();prefab.decRef();};
 try{
  const json=await loadFlightJson();token.check();if(json.format!==FLIGHT_FORMAT)throw Error('balloon-flight-format');
  publishFlight(json);
  const postFrame=postSeamFrame(json);
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
  // transitFrame is bookkeeping; clouds/card/sea are placed with setWorld* each frame so mesh bounds stay valid.
  const transitFrame=new Node('transitFrame');rig.addChild(transitFrame);
  setRigid(transitFrame,meadowFrame);
  const balloonPrefab=await loadTransitPrefab('transport_balloon');
  if(!balloonPrefab)throw Error('balloon-art-missing');
  balloonPrefab.addRef();owned.push({destroy(){balloonPrefab.decRef();}});
  const vehicle=mountVehicle(balloonPrefab,rig);
  showBothSides(vehicle);noShadow(vehicle);
  const cloudsPrefab=await loadTransitPrefab('transit_clouds_merged');
  if(!cloudsPrefab)throw Error('balloon-clouds-missing');
  cloudsPrefab.addRef();owned.push({destroy(){cloudsPrefab.decRef();}});
  const clouds=instantiate(cloudsPrefab);clouds.name='transit_clouds_merged';rig.addChild(clouds);
  showBothSides(clouds);noShadow(clouds);
  const nightPrefab=await loadTransitPrefab('transit_night_dome');
  let nightDome:Node|null=null;
  if(nightPrefab){nightPrefab.addRef();owned.push({destroy(){nightPrefab.decRef();}});nightDome=instantiate(nightPrefab);nightDome.name='transit_night_dome';rig.addChild(nightDome);nightDome.active=false;skybox(nightDome);}
  // Far card: preload, start inactive; enable at 11.2 with meadow unload.
  const farRoot=new Node('far_meadow_card');rig.addChild(farRoot);farRoot.active=false;
  const farPrefab=await loadTransitPrefab('far_meadow_card');
  if(farPrefab){farPrefab.addRef();owned.push({destroy(){farPrefab.decRef();}});const card=instantiate(farPrefab);farRoot.addChild(card);showBothSides(card);}
  // Plan B sea fallback (same world frame as clouds).
  let seaFallback:Node|null=null;
  if(SEA_PLAN==='B'){
   const seaPrefab=await loadTransitPrefab('transit_sea_fallback');
   if(seaPrefab){seaPrefab.addRef();owned.push({destroy(){seaPrefab.decRef();}});seaFallback=instantiate(seaPrefab);seaFallback.name='transit_sea_fallback';rig.addChild(seaFallback);seaFallback.active=false;showBothSides(seaFallback);paintSeaFallback(seaFallback,false);}
  }
  const sea=findSceneNamed('env_sea_surface');
  const seaHome=sea?{pos:sea.position.clone(),scale:sea.scale.clone(),euler:sea.eulerAngles.clone()}:null;
  const backdropNodes:Node[]=[];
  const scene=director.getScene();
  if(scene)eachNamed(scene,n=>{if(BACKDROP_HIDE.includes(n.name)||NIGHT_MOON_HIDE.includes(n.name))backdropNodes.push(n);});
  const backdropHome=new Map<Node,boolean>();for(const n of backdropNodes)backdropHome.set(n,n.active);
  const seat=find(vehicle,'stand_point')??basketFloor(vehicle);
  const flame=find(vehicle,'burner_flame');
  let night=nightNow();
  const domes:Node[]=[];
  if(scene)eachNamed(scene,n=>{if(n.name==='env_sky_dome'||n.name==='meadow_sky_dome')domes.push(n);});
  // Keep meadow clouds / hills / gameplay look until unload. Only the meadow-local sky dome is suppressed (env_sky_dome is the live skybox).
  eachNamed(meadow,n=>{if(n.name==='meadow_sky_dome')n.active=false;});
  let mainYaw0=0;
  if(scene){const lights=scene.getComponentsInChildren(DirectionalLight);mainLight=lights[0]||null;if(mainLight){mainYaw0=mainLight.node.eulerAngles.y;mainIllum0=mainLight.illuminance;mainShadow0=!!(mainLight as any).shadowEnabled;}}
  // Shadows stay on during meadow board/liftoff so windmill/bell match normal meadow gameplay; drop after unload for DC.
  let seaRestored=false,backdropRestored=false,arrived=false;
  const cityNightDimmed=new WeakSet<MeshRenderer>();
  (globalThis as any).__QF_BALLOON_SEA_PLAN={plan:SEA_PLAN,handoffCoverT:HANDOFF_COVER_T,handoffFade:true};
  const handoffFade=(t:number):number=>{
   if(t<HANDOFF_FADE_T0)return 0;
   if(t<HANDOFF_COVER_T)return (t-HANDOFF_FADE_T0)/(HANDOFF_COVER_T-HANDOFF_FADE_T0);
   if(t<HANDOFF_FADE_T1)return 1;
   return Math.max(0,1-(t-HANDOFF_FADE_T1)/0.15);
  };
  const applyBackdrop=(t:number,handoff:boolean)=>{
   const hideBg=t>=MEADOW_OFF_T&&!handoff;
   for(const n of backdropNodes){
    if(!isValid(n,true))continue;
    if(NIGHT_MOON_HIDE.includes(n.name)){n.active=night?false:(backdropHome.get(n)??false);continue;}
    if(hideBg&&BACKDROP_HIDE.includes(n.name))n.active=false;
    else if(handoff)n.active=backdropHome.get(n)??true;
   }
  };
  const applySea=(t:number,handoff:boolean)=>{
   if(SEA_PLAN==='B'){
    // Night keeps a dark unlit disc under the city (cloud sea sits above it). Day: blue disc.
    const showFb=t>=MEADOW_OFF_T&&!handoff;
    if(seaFallback&&isValid(seaFallback,true))seaFallback.active=showFb;
    if(sea&&isValid(sea,true)){sea.active=!showFb&&!(t>=MEADOW_OFF_T&&!handoff);if(showFb)dampSeaSpecular(sea,true);}
    return;
   }
   // Plan A (kept for fallback): teleport × S and scale ×6 at seam.
   if(!sea||!isValid(sea,true)||!seaHome)return;
   if(t+1e-9>=SEAM_T&&!handoff){
    const p=postFrame; // after S·Mw the sea sits with transit content; apply S to home pose via worldJump on transitFrame-relative is already P.
    // Home is island-local; convert worldJump on world position of home.
    const homeW=sea.worldPosition;
    // Once: set from remembered local, then worldJump. Simpler: parent under island — set world from S applied to original world.
    // We only have local home; island root ≈ identity for sea.
    const ox=seaHome.pos.x,oy=seaHome.pos.y,oz=seaHome.pos.z;
    const S=json.seam?.worldJump;
    const yaw=S?.yawDeg??255.747026,tS=S?.translation??[-49.527771,-48.128136,75.925381];
    const rad=yaw*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
    const wx=c*ox+s*oz+tS[0],wy=oy+tS[1],wz=-s*ox+c*oz+tS[2];
    sea.setWorldPosition(wx,wy,wz);
    sea.setWorldRotationFromEuler(0,yaw,0);
    sea.setScale(seaHome.scale.x*6,seaHome.scale.y,seaHome.scale.z*6);
    dampSeaSpecular(sea,true);
   }else if(handoff){
    sea.setPosition(seaHome.pos);sea.setScale(seaHome.scale);sea.setRotationFromEuler(seaHome.euler.x,seaHome.euler.y,seaHome.euler.z);
    dampSeaSpecular(sea,false);sea.active=true;
   }
  };
  const applyLight=(t:number)=>{
   if(!mainLight||!isValid(mainLight.node,true))return;
   // Only while clouds cover (≥0.99 from 10.7) and meadow/city are off — never light those scenes with the ramp.
   if(t>=LIGHT_RAMP_T0&&t+1e-9<SEAM_T){
    const u=Math.max(0,Math.min(1,(t-LIGHT_RAMP_T0)/(SEAM_T-LIGHT_RAMP_T0)));
    mainLight.node.setRotationFromEuler(mainLight.node.eulerAngles.x,mainYaw0+LIGHT_RAMP_YAW*u,mainLight.node.eulerAngles.z);
   }else{
    mainLight.node.setRotationFromEuler(mainLight.node.eulerAngles.x,mainYaw0,mainLight.node.eulerAngles.z);
   }
  };
  const paint=(t:number)=>{
   const fade=handoffFade(t);
   const cover=t+1e-9>=HANDOFF_COVER_T;
   const handoff=arrived||cover;
   const meadowOn=!arrived&&t<plan.meadowOffAt,cityOn=arrived||t>=plan.cityActiveAt;
   const showIsland=arrived||(cityOn&&t+1e-9<plan.strataOffAt&&!cover);
   if(isValid(meadow,true))meadow.active=meadowOn;
   // Shadows on for meadow gameplay match; off after unload for DC ≤53.
   if(mainLight){
    const wantShadow=meadowOn&&mainShadow0;
    try{(mainLight as any).shadowEnabled=wantShadow;}catch{}
    try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=wantShadow;}catch{}
    if(arrived){try{(mainLight as any).shadowEnabled=mainShadow0;}catch{} try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=mainShadow0;}catch{} if(mainIllum0>0){try{mainLight.illuminance=mainIllum0;}catch{}}}
    else if(night&&cityOn){try{mainLight.illuminance=Math.min(mainLight.illuminance,mainIllum0*0.22);}catch{}}
    else if(mainIllum0>0){try{mainLight.illuminance=mainIllum0;}catch{}}
   }
   if(model){
    model.active=cityOn;
    if(cityOn)noShadow(model);
    showNamed(model,ALWAYS_HIDDEN,false);
    showNamed(model,['env_sky_floatingrocks_cards_1','env_sky_floatingrocks_cards_2','env_sky_floatingrocks_cards_3'],false);
    showNamed(model,['env_sky_floatingrocks_1','env_sky_floatingrocks_2','env_sky_floatingrocks_3'],cityOn&&t>=ISLETS_ON_T&&t>=27);
    showNamed(model,['env_sky_islets_far'],false);
    showNamed(model,CITY_RIDE_HIDE,false);
    // Floating island body (grass + rock). Hide vines/roots — they read as free-floating brown rods in the cloud sea.
    showNamed(model,ISLAND_BODY,showIsland);
    showNamed(model,ISLAND_VINES,arrived);
    if(!arrived)eachNamed(model,n=>{if(/foliage_card|env_sky_static_foliage|env_sky_static_flower|Icosphere/.test(n.name))n.active=false;});
   }
   if(!arrived){
   showNamed(clouds,CITY_CLOUD,cityOn);
   showNamed(clouds,ALWAYS_CLOUD,true);
   // Board (t≈0.9): keep far/horizon transit clouds so the sky matches meadow gameplay (not empty blue).
   // Liftoff (t≈5.2): hide near/mid clouds so none sit on the envelope (GBT defect 8).
   if(t>=4.8&&t<7.5){showNamed(clouds,['clouds_deck','clouds_deck_loose','clouds_far'],false);}
   // City on screen: drop far/horizon cloud cards (DC budget) — city silhouette already fills the frame.
   if(cityOn){showNamed(clouds,['clouds_far','clouds_horizon','clouds_deck_loose'],false);}
   }
   eachNamed(meadow,n=>{
    if(n.name.startsWith('meadow_grass'))n.active=meadowOn&&t<GRASS_OFF_T;
    // Re-assert meadow sky dressing every frame (other systems may park these inactive).
    if(meadowOn&&(n.name==='meadow_clouds_near'||n.name==='meadow_far_hills'))n.active=true;
   });
   // Card is only readable through cruise cloud gaps (~14–21 s); hide afterward to save DC.
   const farOn=t>=FAR_CARD_ON_T&&t<21&&!handoff&&!meadowOn;
   if(farRoot&&isValid(farRoot,true)){
    farRoot.active=farOn;
    eachNamed(farRoot,n=>{for(const r of n.getComponents(MeshRenderer))r.enabled=farOn;});
    if(farOn)tintFarCard(farRoot,night);
   }
   const frame=t+1e-9>=SEAM_T?postFrame:meadowFrame;
   setRigid(transitFrame,frame);
   setRigid(clouds,frame);
   if(farRoot&&isValid(farRoot,true))setRigid(farRoot,frame);
   if(seaFallback&&isValid(seaFallback,true)){setRigid(seaFallback,frame);paintSeaFallback(seaFallback,night);}
   applyBackdrop(t,handoff);
   applySea(t,handoff);
   if(handoff){seaRestored=true;backdropRestored=true;}
   applyLight(t);
   if(!arrived){
    (globalThis as any).__QF_BALLOON_HOLD_SKY={night};
    (globalThis as any).__QF_BALLOON_LENS=true;
    for(const n of domes){if(!isValid(n,true))continue;const day=n.name==='env_sky_dome'&&!night;n.active=day;for(const r of n.getComponents(MeshRenderer))r.enabled=day;if(day)skybox(n);}
    if(nightDome){nightDome.active=night;if(night)skybox(nightDome);}
    // Cloud sea: double-sided unlit × vertex shade (day white / night blue-grey). Never emissive.
    if(cityOn)paintCloudSea(clouds,night);
    else if(night)setEmissive(clouds,true);
   }
   applyVehicleNight(vehicle,night);
   if(model&&cityOn&&!arrived){hideCityNightGlow(model,night);if(night)dimCityNight(model,true,cityNightDimmed);}
   if(flame){const burn=!arrived&&t>=0.4&&t<LAND_T;flame.active=burn;const s=burn?1+0.15*Math.sin(t*18):1;flame.setScale(s,s,s);}
   if(arrived){
    const dress=[model,clouds,farRoot,seaFallback,nightDome];
    for(const root of dress){if(!root||!isValid(root,true))continue;eachNamed(root,n=>{const want=skyNodeAfterArrival(n.name);if(want==='on')n.active=true;else if(want==='off')n.active=false;});}
    (globalThis as any).__QF_BALLOON_LENS=false;(globalThis as any).__QF_BALLOON_HOLD_SKY=false;(globalThis as any).__QF_BALLOON_FADE=0;
   }else{(globalThis as any).__QF_BALLOON_FADE=fade;}
   (globalThis as any).__QF_BALLOON_HANDOFF={t,coverT:HANDOFF_COVER_T,fade:arrived?0:fade,seaRestored,backdropRestored,seaPlan:SEA_PLAN,farOn:arrived?false:farOn,meadowOn,cityOn,showIsland,arrived};
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
   let dcWorst=0,dcAt=0,frames=0,lastFade=-1;
   const apply=()=>{
    const t=Math.max(0,Math.min(plan.total,clock.t));
    const sample=plan.vehicle(t);
    vehicle.setWorldPosition(sample.pos[0],sample.pos[1],sample.pos[2]);
    const qq=balloonQuat(sample.yaw*180/Math.PI,sample.roll);Quat.set(q,qq[0],qq[1],qq[2],qq[3]);vehicle.setWorldRotation(q);
    const pose=plan.camera(t);world.setCamera(pose);
    const cam=findCamera();if(nightDome&&cam)nightDome.setWorldPosition(cam.worldPosition);if(cam)for(const n of domes)if(n.active&&isValid(n,true))n.setWorldPosition(cam.worldPosition);
    if(girl&&isValid(girl,true)&&girl.parent===seat){girl.setPosition(0,0,0);girl.setRotationFromEuler(0,GIRL_YAW,0);}
    paint(t);
    const fade=Number((globalThis as any).__QF_BALLOON_FADE)||0;
    if(typeof world.fadeCover==='function'&&(Math.abs(fade-lastFade)>0.02||(fade<=0&&lastFade>0))){
     lastFade=fade;try{void world.fadeCover(fade,0);}catch{/* cover optional in tests */}
    }
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
     (globalThis as any).__QF_BALLOON={t,total:plan.total,beat,alt:plan.vehicle(t).pos[1]-plan.launch[1],wind:0.35,night,meadow:t<MEADOW_OFF_T,city:t>=CITY_ON_T,dc,dcWorst,dcAt,frames,hold:hold!=null&&t>=(hold??0)-1e-3,seam:t>=SEAM_T,far:t>=FAR_CARD_ON_T&&t<MEADOW_OFF_T?false:t>=FAR_CARD_ON_T,seaPlan:SEA_PLAN};
     if(t>=plan.total&&hold==null){off();director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);driver.step=()=>{};ok();}
    };
   });
   rideToken.check();
   if(setWind)setWind(()=>{try{const w=(globalThis as any).__worldDayNight?.windStrength?.();return typeof w==='number'?w:null;}catch{return null;}});
   if(girl&&isValid(girl,true)){const worldParent=prev&&isValid(prev,true)?prev:rig.parent;if(worldParent)girl.setParent(worldParent,true);}
   actor.cancelAndReset({kind:'standing',controllerRoot:plan.s0,yawRad:plan.vehicle(LAND_T).yaw});
   arrived=true;
   if(model){model.active=true;showNamed(model,ISLET_NODES,true);}
   paint(plan.total);
   // handoffFade(total) is still 1: the 0.15 s fade-out sits past the clock, so the black cover would stay up over the level.
   try{if(typeof world.fadeCover==='function')void world.fadeCover(0,0);}catch{}
  };
  progress(.98);
  const lease:JourneySceneLease&{model:Node|null}={model,route,ride,show(visible){if(dead)return;rig.active=visible;model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
  return lease;
 }catch(error){release();throw error;}
}
function worldOf(model:Node,local:Vec):Vec{const v=new Vec3(local[0],local[1],local[2]);Vec3.transformMat4(v,v,model.worldMatrix);return [v.x,v.y,v.z];}
function findCamera():Node|null{const scene=director.getScene();if(!scene)return null;const cams=scene.getComponentsInChildren(Camera);const world=cams.find(c=>c.node.name!=='WorldNavigationCamera'&&c.visibility!==0);return (world??cams[0])?.node??null;}
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
