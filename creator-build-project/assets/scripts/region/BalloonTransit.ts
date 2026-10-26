import {BASKET_CLOSE,b1InS,basketClosePose,basketCloseSpot,meadowLensBoxesWorld,speedSafeS} from './BasketCloseShot';
import {transitionOccluderBoxes} from './TransitionAnchorData';
import {blendPose,minJerk} from './TransitionCamera';
import {Mat4, Layers, Camera, Color, Component, Director, DirectionalLight, EffectAsset, JsonAsset, Material, MeshRenderer, Node, Prefab, Quat, Vec3, assetManager, director, gfx, instantiate, isValid, view} from 'cc';
import {waitRegionAsset} from './RegionAssetDeadline';
import {VEHICLE_ASSET_WAIT_MS} from './TransportWait';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {SkycityCloudsea} from './SkycityCloudsea';
import {routeLength} from '../world-r1/RegionJourneyCore';
import type {JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT, meadowExitFrom, plus, skyDeckRoute, skycityYawDeg} from './RegionJourneyLayout';
import {balloonBeats, balloonRoutePoints, stepTransitClock} from './TransportLeg';
import {basketFloor, loadBundlePrefab, mountVehicle, applyVehicleNight} from './TransportVehicle';
import {emitTransitCue} from './TransitAudioHooks';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {gradeSkycityCloudsea,gradeSkycityNight} from './SkycityNightApply';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {BALLOON_DOOR,INFLATE,chainMark,continuousTransitions,doorAngleAt,doorInAngleAt,guardBeforeWalk,inflateAt} from './TransitionChain';
import {TRANSITION_DURATIONS,TRANSITION_STAGING} from './TransitionStaging';
import {basketToWorld,pathLength} from './TransitionStagingMath';
import {seatFromBench} from './TransportLeg';
import {isTransitionPlaceholder} from './TransitionProps';
import {setMooringRopes} from './SkyMooringRopes';
import {basketObstacleEvent} from './BasketObstacles';
import {b1PreWalk,b1DoorPath,b1PreWalkLens,type PreWalkLensState} from './BalloonB1Start';
import {walkFloorY} from './RegionWalkable';
import {lensClearStep,type LensClearState} from './LensClear';
import {meadowLensSolid,sailSweepBoxesWorld} from './LensVoxels';
import {M6_LOCAL} from './BalloonFlight'/* full8: one basket-anchor M6 (was a second literal here) */;
import {followPose} from './ExploreCameraCore';
import {camTag,camLog,camActorProbe,camActorPose} from './CamTraceLog';
import {regionBoardSource,setRegionBoardSource,type RegionBoardSource} from './RegionBoardLanding';
import {
 ALWAYS_CLOUD, ALWAYS_HIDDEN, BACKDROP_HIDE, CITY_CLOUD, CITY_ON_T, FAR_CARD_ON_T, FLIGHT_FAR_CLOUDS, FLIGHT_FORMAT, GRASS_OFF_T,
 ISLET_NODES, ISLETS_ON_T, RIDE_DURATION, rideToFlightT, LAND_T, MEADOW_OFF_T, NIGHT_MOON_HIDE, P_SEAM, S0_LOCAL,
 SEAM_T, STRATA_OFF_T, balloonIllumFactor, islandSeaShown, nightCityBlend, nightCloudColor, sailLeftoverShown, balloonLightYawOffset, balloonQuat, postSeamFrame, skyNodeAfterArrival, type FlightDoc, type Rigid,
} from './BalloonFlight';
function balloonCueRegion(name:string):string{
 if(name==='sky-city-enable'||name==='sky-islets-enable'||name==='balloon-cloud-exit'||name==='balloon-land')return 'skycity';
 if(name==='meadow-unload'||name==='far-meadow-card-on')return 'meadow';
 return 'balloon';
}
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
/** Web diagnostics (Mac bisect): ?hideNode=a,b hides nodes by exact name every frame; ?diagDump=1 logs every active renderer
 *  ('[QF_DIAG]' JSON: path, effect, technique, mainTexture, emissive/emissiveScale, NaN flags) once the ride reaches balloonAt. */
export function diagParams(q?:string):{hide:string[];dump:boolean}{try{const s=q!==undefined?q:(typeof location!=='undefined'?String(location.search||''):'');const h=/(?:^|[?&])hideNode=([^&]*)/.exec(s);return {hide:h?decodeURIComponent(h[1]).split(',').map(x=>x.trim()).filter(Boolean):[],dump:/(?:^|[?&])diagDump=1(?:&|$)/.test(s)};}catch{return {hide:[],dump:false};}}
function nodePath(n:Node):string{const a:string[]=[];let c:Node|null=n;while(c){a.unshift(c.name);c=c.parent;}return a.join('/');}
function diagVal(v:any):any{if(v==null)return null;if(typeof v==='number')return Number.isFinite(v)?+v.toFixed(4):String(v);if(typeof v==='object'){if(typeof v.name==='string'&&v.name)return v.name;const o:any={};for(const k of ['x','y','z','w','r','g','b','a'])if(typeof v[k]==='number')o[k]=Number.isFinite(v[k])?+v[k].toFixed(4):String(v[k]);return Object.keys(o).length?o:String(v);}return String(v);}
/** ?lakeDiagAt=t: the skycity→lakeside ride time (s) at which ?diagDump=1 dumps (the lakeside leg; balloonAt is the meadow→skycity leg). */
export function lakeDiagAt(q?:string):number|null{try{const s=q!==undefined?q:(typeof location!=='undefined'?String(location.search||''):'');const m=/(?:^|[?&])lakeDiagAt=([0-9.]+)/.exec(s);if(!m)return null;const t=Number(m[1]);return Number.isFinite(t)?t:null;}catch{return null;}}
export function diagDumpScene(t:number,leg:string='skycity'):void{
 const scene=director.getScene();if(!scene)return;const rows:any[]=[];
 for(const r of scene.getComponentsInChildren(MeshRenderer)){
  if(!r.enabled||!r.node.activeInHierarchy)continue;const mat:any=(r as any)._materialInstances?.[0]||r.getSharedMaterial(0); // read only, never creates an instance
  const get=(k:string)=>{try{return diagVal(mat?.getProperty?.(k));}catch{return null;}};
  const wb:any=(r as any).model?.worldBounds;const wp=r.node.worldPosition;
  rows.push({path:nodePath(r.node),pos:[+wp.x.toFixed(2),+wp.y.toFixed(2),+wp.z.toFixed(2)],aabb:wb?[+wb.center.x.toFixed(1),+wb.center.y.toFixed(1),+wb.center.z.toFixed(1),+wb.halfExtents.x.toFixed(1),+wb.halfExtents.y.toFixed(1),+wb.halfExtents.z.toFixed(1)]:null,effect:mat?.effectName??null,technique:mat?.technique??null,mainTexture:get('mainTexture'),albedoMap:get('albedoMap'),mainColor:get('mainColor'),emissive:get('emissive'),emissiveScale:get('emissiveScale'),priority:(r as any).priority??null});
 }
 console.info('[QF_DIAG] '+JSON.stringify({leg,t,count:rows.length,rows}));
}
class TransitDriver extends Component{step:(dt:number)=>void=()=>{};lateUpdate(dt:number){this.step(Math.max(0,Math.min(0.1,dt||0)));}}
/** glTF scene prefab inside region_transit_balloon. Same loadDir fallback as the balloon-fix (bundle.load misses the sub-asset). */
export function loadTransitPrefab(name:string):Promise<Prefab|null>{return loadBundlePrefab(name,'region_transit_balloon');}
/** Valid depth compare for sky passes. Literal fallback (LEQUAL=3) so an undefined enum can never reach glDepthFunc as 0. */
export const SKY_DEPTH_FUNC:number=Number((gfx as any)?.ComparisonFunc?.LEQUAL??3);
const skyboxed=new WeakSet<object>();
function skybox(node:Node|null):void{
 if(!node)return;
 eachNamed(node,n=>{
  const r=n.getComponent(MeshRenderer);if(!r)return;
  (r as any).priority=-100;
  const shared=r.getSharedMaterial(0);
  const m=r.getMaterialInstance(0);if(!m||skyboxed.has(m))return; // once per instance — never rebuild pass state per frame
  skyboxed.add(m);
  // getMaterialInstance on a glTF material drops the albedo binding → magenta (see setEmissive). Rebind it.
  if(shared)for(const key of ['mainTexture','albedoMap']){try{const tex=shared.getProperty(key);if(tex!=null)m.setProperty(key,tex);}catch{/* slot absent */}}
  // Draw first, no depth write; keep depth test so later opaques (clouds/balloon) can cover the dome.
  try{m.overridePipelineStates({depthStencilState:{depthTest:true,depthWrite:false,depthFunc:SKY_DEPTH_FUNC}},0);}catch{/* material without a pass */}
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
  // No emissiveScale write: it is a vec3 uniform (emissiveScaleParam.xyz). A bare number goes through the FLOAT3 writer as
  // v.x/v.y/v.z = undefined -> NaN in the UBO -> flat green/magenta cloud sheets at night. emissive=black already zeroes it.
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
const emissiveDone=new WeakSet<Node>();
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
 * Night: baked vertex shade × unlit RGB(68,80,94) (v24fix). No emissive.
 * Day: balloon-grade stretches the same shade so the cruise floor reads as clumps, not a flat wash.
 */
const CLOUD_GRADE=['clouds_floor','clouds_floor_puff','clouds_city_sea','clouds_horizon'];
function paintCloudSea(clouds:Node|null,night:boolean,grade:EffectAsset|null):void{
 if(!clouds||lookCache.get(clouds)===night)return;
 const day=new Color(255,255,255,255),nite=new Color(68,80,94,255);
 eachNamed(clouds,n=>{
  const graded=!night&&!!grade&&CLOUD_GRADE.includes(n.name);
  if(graded){
   for(const r of n.getComponents(MeshRenderer)){
    const m=new Material();
    m.initialize({effectAsset:grade!,technique:0});
    try{m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);}catch{/* */}
    try{r.setMaterialInstance(0,m);}catch{/* */}
   }
   return;
  }
  if(n.name==='clouds_floor'||n.name==='clouds_floor_puff'||n.name==='clouds_city_sea')forceUnlit(n,night?nite:day,{vertexColor:true});
 });
 lookCache.set(clouds,night);
}
/** b17r10: per-frame night cloud colour during the city blend. Only touches the unlit instances paintCloudSea made; skips when unchanged. */
const cloudTint=new WeakMap<Node,string>();
function tintCloudSea(clouds:Node|null,rgb:[number,number,number]):void{
 if(!clouds)return;const key=rgb.join(',');if(cloudTint.get(clouds)===key)return;cloudTint.set(clouds,key);
 const c=new Color(rgb[0],rgb[1],rgb[2],255);
 eachNamed(clouds,n=>{if(n.name!=='clouds_floor'&&n.name!=='clouds_floor_puff'&&n.name!=='clouds_city_sea')return;
  for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;try{m.setProperty('mainColor',c);}catch{/* */}}});
}
/** Coarse sky-dome rings band in 8-bit. Swap the day dome to a dithered pass; caller restores the shared mat. */
function ditherSky(dome:Node,grade:EffectAsset):void{
 eachNamed(dome,n=>{for(const r of n.getComponents(MeshRenderer)){
  const m=new Material();
  m.initialize({effectAsset:grade,technique:1});
  try{r.setMaterialInstance(0,m);}catch{/* */}
 }});
 skybox(dome);
}
/** Alpha-mask canopy cards go opaque inside dimCityNight and paint their black texels. Keep the test, raise the cutoff. */
function clipCanopy(model:Node):void{
 eachNamed(model,n=>{
  if(!/canopy_cards|foliage_cards/.test(n.name))return;
  for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;try{m.setProperty('alphaThreshold',0.68);}catch{/* standard mat may omit it */}}
 });
}
/** full8 (Mac m1 775–785: night skycity ground missing after landing). The night silhouette used to replace the shared material for
 *  good — setMaterialInstance(0, plain Material) == setSharedMaterial, which also DESTROYED any live instance (night grade / canopy
 *  clip) — so after touchdown the ground stayed (38,44,58) unlit, i.e. sky-coloured. Now every swap is recorded and undone exactly:
 *  the original shared material goes back and the original instance object is re-attached (detached, never destroyed — no repeat of
 *  the WorldFlowComponent destroyed-MaterialInstance bug). */
export type CityNightSwap={r:MeshRenderer;shared:Material;inst:Material|null;dim:Material};
export type CityNightCache=Map<MeshRenderer,CityNightSwap>;
function dimOne(r:MeshRenderer,tex:unknown,cache:CityNightCache,alpha:boolean):void{
 const shared=r.getSharedMaterial(0);if(!shared)return;
 const m=new Material();
 m.initialize({effectName:'builtin-unlit',technique:0,defines:{...(tex?{USE_TEXTURE:true}:{}),...(alpha?{USE_ALPHA_TEST:true}:{})}});
 try{m.setProperty('mainColor',new Color(38,44,58,255));}catch{}
 if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
 if(alpha){try{m.setProperty('alphaThreshold',0.72);}catch{}}
 try{const insts:any[]=(r as any)._materialInstances||[];const inst=insts[0]||null;if(inst)insts[0]=null/* detach, keep alive */;
  r.setSharedMaterial(m,0);cache.set(r,{r,shared,inst,dim:m});}catch{}
}
/** Undo every night-silhouette swap exactly (touchdown, release/abort/teardown). Idempotent. Returns how many were restored. */
export function restoreCityNight(cache:CityNightCache):number{
 let n=0;cache.forEach(e=>{try{if(isValid(e.r,true)){if(e.r.getSharedMaterial(0)===e.dim)e.r.setSharedMaterial(e.shared,0);if(e.inst)e.r.setMaterialInstance(0,e.inst as any);n++;}}catch{}try{e.dim.destroy();}catch{}});
 cache.clear();return n;}
/** Ground / island body: dimmed to (38,44,58) it reads as sky at night, so it is never silhouetted (gradeSkycityNight still darkens it). */
export const CITY_NIGHT_KEEP=/^(env_sky_static_palette|env_sky_floor_seal)$/;
/** full8 P1-a: B1 lens blend speed cap (m/s). */
export const B1_LENS_MPS=2.5;
/** full8: live→flight blend length: ≥0.6 s, ≤ B1_LENS_MPS average over the gap (0 when already on the plan). */
export function flightBlendSeconds(gapM:number):number{return gapM<0.02?0:Math.max(0.6,gapM/B1_LENS_MPS);}
/** World yaw (deg) of a node from its world rotation (+Z axis), not the local eulerAngles. */
export function worldYawDeg(n:Node):number{const f=new Vec3(0,0,1);Vec3.transformQuat(f,f,n.worldRotation);return Math.atan2(f.x,f.z)*180/Math.PI;}
/** Always-hidden neon / DC extras. Island body + hanging vines are gated separately. */
const CITY_RIDE_HIDE=[
 'env_sky_island_vine_cards','env_sky_island_windcore',
 'env_sky_rope_root_01','env_sky_rope_root_02','env_sky_rope_root_03','env_sky_rope_root_04',
 'env_sky_rope_root_05','env_sky_rope_root_06','env_sky_rope_root_07','env_sky_rope_root_08',
 'env_sky_rope_roots_skin'/* b15: the 8 rope meshes are one skinned mesh (joints = the nodes above) */,
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
function dimCityNight(model:Node|null,night:boolean,cache:CityNightCache):void{
 if(!model||!night||!EffectAsset.get('builtin-unlit'))return;
 eachNamed(model,n=>{
  if(/window|emissive|lamp|light|flame|pennant|flag/i.test(n.name))return;
  if(CITY_NIGHT_KEEP.test(n.name))return;
  if(isTransitionPlaceholder(n))return/* cand7: placeholder planks never get the night silhouette */;
  if(/^(island_dock|island_dock_ramp|sail_gangway|sail_gangway_meadow|sail_frozen_pose)$/.test(n.name))return;/* black-shape P2: transition placeholders / runtime nodes never get the night silhouette */
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
   dimOne(r,tex,cache,/canopy_cards|foliage_cards|vine_cards/.test(n.name));
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
/** Live env_skycity placement: the skycity placement offset and heading (RegionJourneyLayout). The art balloonSkyOffset is not applied. */
export function placeLiveSkycity(model:Node,meadow:Node,start:Vec):Rigid{
 model.setRotationFromEuler(0,0,0);
 model.setRotationFromEuler(0,skycityYawDeg(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start')),0);
 const exit:Vec[]=[];for(let i=2;i<=REGION_JOURNEY_LAYOUT.meadowExitPathIndex;i++)exit.push(anchor(meadow,'walk_path_'+String(i).padStart(2,'0')));
 const edge=meadowExitFrom(start,exit).at(-1)??exit.at(-1)??start;
 const placed=skyDeckRoute(anchor(model,'anchor_cloudbridge_end'),anchor(model,'anchor_cloudbridge_start'));
 const landing=plus(edge,REGION_JOURNEY_LAYOUT.skycityOffset);
 const p=model.worldPosition;
 model.setWorldPosition(...plus([p.x,p.y,p.z],[landing[0]-placed.rim[0],landing[1]-placed.rim[1],landing[2]-placed.rim[2]]));
 const w=model.worldPosition;
 return {yawDeg:worldYawDeg(model)/* full8: world yaw, not the local euler read-back */,origin:[w.x,w.y,w.z]};
}
function publishFlight(doc:FlightDoc):void{(globalThis as any).__QF_BALLOON_FLIGHT=doc;}
/**
 * Meadow → sky city on the GGbot balloon (flightpath 2.2 + far card + seam at 11.4).
 * Sea plan B: hide game sea, show transit_sea_fallback under transitFrame (ShoreBreak would clobber plan A).
 */
export async function mountBalloonLease(opts:{parent:Node;meadow:Node|null;start:Vec;token:Cancellation;progress:(n:number)=>void}):Promise<JourneySceneLease&{model:Node|null}>{
 if(!opts.meadow||!isValid(opts.meadow,true))throw Error('journey-meadow-lease-missing');
 const token=opts.token,progress=opts.progress,meadow=opts.meadow;
 const prefab=await waitRegionAsset(loadRegionPrefab(REGIONS.skycity,p=>progress(p*.45)),token,VEHICLE_ASSET_WAIT_MS);token.check();
 prefab.addRef();
 const owned:Array<{destroy():void}>=[],rig=new Node('RegionJourney-skycity');rig.active=false;opts.parent.addChild(rig);
  let boardSrc:RegionBoardSource|null=null;
  let dead=false,model:Node|null=null,offNight=()=>{},beforeDraw=()=>{};
  let mainLight:DirectionalLight|null=null,mainShadow0=true,mainIllum0=0;
  const skyHome:Array<{r:MeshRenderer;shared:Material|null}>=[];
  /** b18 T-04: sky domes are camera-centred and not teleported; yaw them with the sun so sky + light stay camera-relative continuous across the seam. */
  const domeYaw0=new Map<Node,[number,number,number]>();
  let restoreSailLeft=()=>{};
  let landRopeOn=false;
  const cityNightDimmed:CityNightCache=new Map()/* full8: before release() so abort/teardown can restore */;
  const release=()=>{if(dead)return;dead=true;try{restoreCityNight(cityNightDimmed);}catch{}if(boardSrc&&regionBoardSource('skycity')===boardSrc)setRegionBoardSource('skycity',null);try{restoreSailLeft();}catch{}try{setMooringRopes(model,'landing',false);basketObstacleEvent('balloon:released');}catch{}/* cand7: basket gone → rope stowed, landing obstacle off */director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);(globalThis as any).__QF_BALLOON_LENS=false;(globalThis as any).__QF_BALLOON_HOLD_SKY=false;(globalThis as any).__QF_BALLOON_SEA_PLAN=null;offNight();
  domeYaw0.forEach((e,n)=>{if(isValid(n,true))try{n.setRotationFromEuler(e[0],e[1],e[2]);}catch{/* */}});
  for(const s of skyHome){if(s.shared&&isValid(s.r,true))try{s.r.setSharedMaterial(s.shared,0);}catch{/* */}}
  try{if(mainLight){(mainLight as any).shadowEnabled=mainShadow0;if(mainIllum0>0)mainLight.illuminance=mainIllum0;}}catch{}
  try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=true;}catch{}
  rig.active=false;if(isValid(rig,true))rig.destroy();for(const a of owned)a.destroy();prefab.decRef();};
 try{
  const json=await loadFlightJson();token.check();if(json.format!==FLIGHT_FORMAT)throw Error('balloon-flight-format');
  publishFlight(json);
  const postFrame=postSeamFrame(json);
  model=mountRegion(REGIONS.skycity,prefab,rig);
  // full6-cam P1 (Mac 45f601b1 L11 810→811): the board copy's own root transform, for the skycity board source below
  const boardLocal=new Mat4();Mat4.fromRTS(boardLocal,model.rotation,model.position,model.scale);
  model.getComponent(SkycityCloudsea)!.setFlightHidden(true);
  for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
  const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');
  await waitRegionAsset(ambient.prepare(),token,VEHICLE_ASSET_WAIT_MS);token.check();
  model.setRotationFromEuler(0,0,0);model.setPosition(0,0,0);
  const city=placeLiveSkycity(model,meadow,opts.start);
  // full6-cam P1: the balloon lease never registered the skycity board source (only the sail/meadow builder does), so on arrival
  // regionBoardHandoff and regionLandingToBoard both returned 'no-board-pose' and enter-level played the generic push-in = the
  // basket-door close-up hard-cut to the board (L9 / L11, any stage entered from the balloon arrival). Same map as the adapter's.
  try{boardSrc=balloonBoardSource(model,boardLocal);setRegionBoardSource('skycity',boardSrc);}catch(e){boardSrc=null;console.error('[QF_REGION] skycity board source unavailable: '+String(e));}
  // full8 P1-a root cause candidate (运镜bot planAgree: trace B1 c0 (−20.6,8.25,89.6) vs plan.camera(0) (−20.2,8.44,63.0), mirrored about
  // M6): eulerAngles is the LOCAL rotation; the camera plan needs the meadow's WORLD yaw (worldOf() already uses the world matrix).
  const mp=meadow.worldPosition,meadowFrame:Rigid={yawDeg:worldYawDeg(meadow),origin:[mp.x,mp.y,mp.z]};
  try{console.info('[QF_B1_FRAME] '+JSON.stringify({localYaw:+meadow.eulerAngles.y.toFixed(3),worldYaw:+meadowFrame.yawDeg.toFixed(3)}));}catch{}
  model.active=false;
  showNamed(model,ALWAYS_HIDDEN,false);
  showNamed(model,FLIGHT_FAR_CLOUDS,false);
  showNamed(model,ISLET_NODES,false);
  const m6=worldOf(meadow,M6_LOCAL);
  const plan=balloonBeats(m6,S0_LOCAL,anchor(model,'anchor_starcourt_center'),{cityFrame:city,meadowFrame,walkInM:0,walkOutM:0});
  const points=balloonRoutePoints(opts.start,plan);
  const length=routeLength(points);
  const route={from:'meadow' as const,to:'skycity' as const,path:points,bridgeStart:length*0.42,bridgeEnd:Math.min(length,length*0.42+Math.max(0.05,length*0.04)),speed:1.2,startBlendM:0,focus:plan.court};
  // transitFrame is bookkeeping; clouds/card/sea are placed with setWorld* each frame so mesh bounds stay valid.
  const transitFrame=new Node('transitFrame');rig.addChild(transitFrame);
  setRigid(transitFrame,meadowFrame);
  const gradeEffect=await loadGradeEffect();
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
  // b17r7 (运镜bot): the island sea (env_sea_surface, flat at world y=-0.918) stayed visible during the flight and the post-seam
  // lens climbs through that height at ~15.9 s while the basket is still ~7 m below it: the sea cut the basket and her out
  // (audit b17-cand-76a0433, 15.8-17 s). Hide EVERY live env_sea_surface each frame (rescanned, not one cached node) whenever
  // islandSeaShown() says so; paint runs on EVENT_BEFORE_DRAW so this is the last write before the frame.
  const seas:Node[]=[];let seaScanAt=-1;
  const scanSeas=(t:number)=>{if(seaScanAt>=0&&Math.abs(t-seaScanAt)<0.5&&seas.every(n=>isValid(n,true))&&sailLeft.every(n=>isValid(n,true)))return;seaScanAt=t;seas.length=0;sailLeft.length=0;const sc=director.getScene();if(sc)eachNamed(sc,n=>{if(n.name==='env_sea_surface')seas.push(n);else if(n.name==='SailArt'){sailLeft.push(n);if(!sailHome.has(n))sailHome.set(n,n.active);}});};
  // b17r7 B1 (Mac diagDump 3efe2a0c): the blocker is the SAIL leg's leftover SailArt (WorldFlowOwner/RegionJourney-meadow/SailArt:
  // transit_sea/sea_plane, world y=-0.91, AABB half-extent 832 m around (-3.7,30.4)). SailArt is a sibling of the meadow model,
  // disposed only with the meadow lease, so hiding the meadow at MEADOW_OFF_T left it on; the post-seam lens climbs through
  // y≈-0.9 at 15.8 s with the basket below. It now follows the meadow: off with the meadow, home state if the meadow returns.
  const sailLeft:Node[]=[];const sailHome=new Map<Node,boolean>();
  restoreSailLeft=()=>{if(!(isValid(meadow,true)&&meadow.activeInHierarchy))return;for(const [n,a] of sailHome)if(isValid(n,true))n.active=a;};
  const applySailLeft=(meadowOn:boolean)=>{for(const n of sailLeft)if(isValid(n,true)){const want=meadowOn?(sailHome.get(n)??true):false;if(n.active!==want)n.active=want;}
   const g=(globalThis as any).__QF_BALLOON_SEA_PLAN;if(g){g.sailLeftover=sailLeft.length;g.sailLeftoverLive=sailLeft.filter(n=>isValid(n,true)&&n.activeInHierarchy).length;}};
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
  let mainYaw0=0,mainPitch0=0,mainRoll0=0;
  if(scene){const lights=scene.getComponentsInChildren(DirectionalLight);mainLight=lights[0]||null;if(mainLight){mainYaw0=mainLight.node.eulerAngles.y;mainPitch0=mainLight.node.eulerAngles.x;mainRoll0=mainLight.node.eulerAngles.z;mainIllum0=mainLight.illuminance;mainShadow0=!!(mainLight as any).shadowEnabled;}}
  // Shadows stay on during meadow board/liftoff so windmill/bell match normal meadow gameplay; drop after unload for DC.
  let seaRestored=false,backdropRestored=false,arrived=false;
  let canopyClipped=false;
  (globalThis as any).__QF_BALLOON_SEA_PLAN={plan:SEA_PLAN,handoffCoverT:HANDOFF_COVER_T,handoffFade:true};
  const contChain=continuousTransitions();
  const handoffFade=(t:number):number=>{
   if(contChain)return 0/* transitions-continuous: no black blink at the landing handoff */;
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
    const on=islandSeaShown(t,handoff);scanSeas(t);
    for(const n of seas)if(isValid(n,true)){n.active=on;if(showFb)dampSeaSpecular(n,true);}
    const g=(globalThis as any).__QF_BALLOON_SEA_PLAN;if(g){g.islandSea=on;g.islandSeaNodes=seas.length;g.islandSeaLive=seas.filter(n=>isValid(n,true)&&n.activeInHierarchy).length;}
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
   const off=balloonLightYawOffset(t);
   for(const n of nightDome?[...domes,nightDome]:domes){if(!isValid(n,true))continue;let e=domeYaw0.get(n);if(!e){const q=n.eulerAngles;e=[q.x,q.y,q.z];domeYaw0.set(n,e);}n.setRotationFromEuler(e[0],e[1]+off,e[2]);}
   if(!mainLight||!isValid(mainLight.node,true))return;
   // Content-relative continuous sun: no pre-seam spin, no snap (see balloonLightYawOffset). Pitch/roll cached
   // once so eulerAngles read-back can never flip x/z when yaw passes ±90°.
   mainLight.node.setRotationFromEuler(mainPitch0,mainYaw0+balloonLightYawOffset(t),mainRoll0);
  };
  const paint=(t:number)=>{
   const fade=handoffFade(t);
   const cover=t+1e-9>=HANDOFF_COVER_T;
   const handoff=arrived||cover;
   const meadowOn=!arrived&&t<plan.meadowOffAt,cityOn=arrived||t>=plan.cityActiveAt;
   const showIsland=arrived||(cityOn&&t+1e-9<plan.strataOffAt&&!cover);
   if(isValid(meadow,true))meadow.active=meadowOn;
   scanSeas(t);applySailLeft(sailLeftoverShown(t,arrived)&&meadowOn);
   // Shadows on for meadow gameplay match; off after unload for DC ≤53.
   if(mainLight){
    const wantShadow=meadowOn&&mainShadow0;
    try{(mainLight as any).shadowEnabled=wantShadow;}catch{}
    try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=wantShadow;}catch{}
    if(arrived){try{(mainLight as any).shadowEnabled=mainShadow0;}catch{} try{const g=(director as any).root?.pipeline?.pipelineSceneData?.shadows;if(g)g.enabled=mainShadow0;}catch{} if(mainIllum0>0){try{mainLight.illuminance=mainIllum0;}catch{}}}
    else if(mainIllum0>0){try{mainLight.illuminance=mainIllum0*balloonIllumFactor(t,night);}catch{}} // b17r10: night ramps x1 -> x0.22 over NIGHT_BLEND_S (was a one-frame cut at CITY_ON_T)
   }
   if(model){
    model.active=cityOn;
    model.getComponent(SkycityCloudsea)!.setFlightHidden(!arrived);
    if(cityOn)noShadow(model);
    showNamed(model,ALWAYS_HIDDEN,false);
    if(!arrived)showNamed(model,FLIGHT_FAR_CLOUDS,false);
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
   // City close-up drops far cards for DC. Horizon stays through cruise (before islets) so the sea/sky edge is not a hard line.
   if(cityOn){showNamed(clouds,['clouds_far','clouds_deck_loose'],false);showNamed(clouds,['clouds_horizon'],t<ISLETS_ON_T);}
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
   (globalThis as any).__QF_BALLOON_LIGHT={t,yawOffset:balloonLightYawOffset(t),illum:mainLight?mainLight.illuminance:0,illumFactor:balloonIllumFactor(t,night),nightW:night?nightCityBlend(t):0};
   if(!arrived){
    (globalThis as any).__QF_BALLOON_HOLD_SKY={night};
    (globalThis as any).__QF_BALLOON_LENS=true;
    for(const n of domes){if(!isValid(n,true))continue;const day=n.name==='env_sky_dome'&&!night;n.active=day;for(const r of n.getComponents(MeshRenderer))r.enabled=day;if(day){if(gradeEffect&&!skyHome.length){for(const r of n.getComponents(MeshRenderer))skyHome.push({r,shared:r.getSharedMaterial(0)});ditherSky(n,gradeEffect);}else skybox(n);}}
    if(nightDome){nightDome.active=night;} // skybox() ran once at mount; re-running it per frame rebuilt the pass every frame
    // Cloud sea: graded day clumps, night blue-grey. Never emissive.
    if(cityOn){paintCloudSea(clouds,night,gradeEffect);if(night)tintCloudSea(clouds,nightCloudColor(t));}
    else if(night&&!emissiveDone.has(clouds)){emissiveDone.add(clouds);setEmissive(clouds,true);} // once — per-frame instance rebinds churned the pass
   }
   applyVehicleNight(vehicle,night);
   // b16: self-lit sky-city clouds / accents follow the island night (they ignored the dimmed light; after landing the
   // cloud_small and accents came back at day brightness). Cached: only walks the city when the mode changes.
   if(model&&cityOn){const w=night?(arrived?1:Math.round(nightCityBlend(t)*20)/20):0; /* 5% steps: one city walk per step, not per frame */gradeSkycityNight(model,w);gradeSkycityCloudsea(model.parent,w);}
   if(model&&cityOn&&!arrived){if(!canopyClipped){canopyClipped=true;clipCanopy(model);}hideCityNightGlow(model,night);if(night)dimCityNight(model,true,cityNightDimmed);}
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
   const door=find(vehicle,TRANSITION_STAGING.basket.entryDoorNode)??find(vehicle,'basket_door_leaf'),doorB=find(vehicle,TRANSITION_STAGING.basket.exitDoorNode)/* door2: exit leaf */,envelope=find(vehicle,'balloon_envelope');
   const anim=(actor as any).anim||null;
   let seatDef:any=null,seated=false,s0End:Vec|null=null;
   const walkTo=(path:Vec[],secs?:number)=>{let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);
    return L>0.05?actor.perform({kind:'walk',path,duration:secs&&secs>0?secs:Math.max(.5,L/TRANSITION_STAGING.walkMps),stopAtEnd:true} as any,rideToken):Promise.resolve();};
   const vYawDeg=()=>{const v=plan.vehicle(0);return v.yaw*180/Math.PI;};
   // B2 inflate (compress: Grok Bot 2026-10-25): ignition + fill start with the B1 walk to the basket (overlap), so the ride
   // clock no longer waits at 0 after she sits unless the walk was shorter than INFLATE.durationS; burner brightness synced.
   const envHome=envelope&&isValid(envelope,true)?{p:envelope.position.clone(),s:envelope.scale.clone(),drop:NaN}:null;
   let inflateT=contChain&&envHome?0:INFLATE.durationS;let inflateMarked=false;
   const applyInflate=()=>{if(!envHome||!envelope||!isValid(envelope,true))return;const f=inflateAt(inflateT);
    if(!Number.isFinite(envHome.drop)){envHome.drop=0;try{let lo=Infinity;for(const r of envelope.getComponentsInChildren(MeshRenderer)){const b:any=(r as any).model?.worldBounds;if(b)lo=Math.min(lo,b.center.y-b.halfExtents.y);}
      const ps=envelope.parent?envelope.parent.worldScale.y:1;if(Number.isFinite(lo))envHome.drop=(lo-envelope.worldPosition.y)/(ps||1);}catch{envHome.drop=0;}}
    envelope.setScale(envHome.s.x*f.sxz,envHome.s.y*f.sy,envHome.s.z*f.sxz);
    envelope.setPosition(envHome.p.x,envHome.p.y+envHome.drop*envHome.s.y*(1-f.sy),envHome.p.z)/* bottom stays on the burner ring */;
    if(flame){flame.active=inflateT>0;const k=f.flame*(1+0.12*Math.sin(inflateT*18));flame.setScale(k,k,k);}};
   if(contChain&&girl&&isValid(girl,true)){
    // B1 (transitions-continuous): she walks from the last meadow stop to the basket door, the door opens (door_reach), she
    // steps in to stand_point and the door closes behind her. Basket at its t=0 pose; lens = the ride's first pose (handoff blend).
    // full6 P1: chained island→skycity (no meadow level played) hands her over at sail M1. Walk the meadow node graph to the YARD GATE (2.6,−20.8)
    // first (through the gate, natural 1.2 m/s, one continuous walk); B1 then starts at the gate exactly like the normal flow (M4→M6 departure is cut at the gate).
    {try{const gp0=girl.worldPosition,inv=new Mat4();Mat4.invert(inv,meadow.worldMatrix);const lv=new Vec3(gp0.x,gp0.y,gp0.z);Vec3.transformMat4(lv,lv,inv);
      const B0=TRANSITION_STAGING.basket,vv=plan.vehicle(0),outW=basketToWorld([vv.pos[0],vv.pos[1],vv.pos[2]],vv.yaw*180/Math.PI,B0.outside),ov=new Vec3(outW[0],outW[1],outW[2]);Vec3.transformMat4(ov,ov,inv);
      const pre=b1PreWalk([lv.x,lv.y,lv.z],[ov.x,ov.y,ov.z]);(globalThis as any).__QF_B1_PREWALK=pre?{from:pre.fromKey,m:+pre.lengthM.toFixed(2),s:+pre.durationS.toFixed(2)}:null;
      if(pre){const t0=Date.now();emitTransitCue('node-walk-start',{t:0,region:'meadow',node:'gate'});guardBeforeWalk(anim,'B1 pre-walk to the gate');
       // lens: continuous follow — starts from the live world camera (blend 1 s), follows her (eased), lands on the B1 first lens
       // (plan.camera(0) = cam0 below) over the last 1.5 s so B1 starts with no step. No cut.
       const live=liveWorldPose(),fs0=(view as any)?.getFrameSize?.(),fw=fs0?.width||390,fh=fs0?.height||844,c0=plan.camera(0);let pt=0,fol:PreWalkLensState|null=null;
       const preBoxes=meadow&&isValid(meadow,true)?sailSweepBoxesWorld(l=>worldOf(meadow,l)) as any:[]/* full8: sails sweep; the rest = MeadowLensVoxels grid */,preClr:LensClearState={pull:0},preInv=new Mat4();Mat4.invert(preInv,meadow.worldMatrix);const preY0=meadow.worldPosition.y;
       const preSolid=meadowLensSolid(w=>{const v=new Vec3(w[0],w[1],w[2]);Vec3.transformMat4(v,v,preInv);return [v.x,v.y,v.z];});
       const preGround=(w:Vec):number|null=>{const v=new Vec3(w[0],w[1],w[2]);Vec3.transformMat4(v,v,preInv);const f=walkFloorY('meadow',v.x,v.z);return f===null?null:f+preY0;};
       const preDraw=()=>{if(dead||!girl||!isValid(girl,true))return;const dt=Math.min(.1,Math.max(0,director.getDeltaTime()));pt+=dt;const g=girl.worldPosition,herYawDeg=worldYawDeg(girl)/* full8: world yaw (she may be parented under a rotated node) */;
        /* 运镜bot full7-cam: lens = BalloonB1Start.b1PreWalkLens (critically damped heading follow, same in/out blends) */const L=b1PreWalkLens({her:[g.x,g.y,g.z],yawRad:herYawDeg*Math.PI/180,w:fw,h:fh,dt,t:pt,durationS:pre.durationS,live,c0,prev:fol});fol=L.state;const p=lensClearStep(L.pose,preBoxes,dt,preClr,undefined,preGround,preSolid)/* full8: windmill / trees pull-in, 1.1 m */;
        camTag('BalloonTransit:prewalk');world.setCamera(p);};
       director.on(Director.EVENT_BEFORE_DRAW,preDraw);
       try{await actor.perform({kind:'walk',path:pre.path.map(l=>worldOf(meadow,l)),duration:pre.durationS,stopAtEnd:true} as any,rideToken);}finally{director.off(Director.EVENT_BEFORE_DRAW,preDraw);}rideToken.check();
       emitTransitCue('node-arrive',{t:0,region:'meadow',node:'gate'});{const r3=(v:any)=>v?[+(+v.x).toFixed(3),+(+v.y).toFixed(3),+(+v.z).toFixed(3)]:null,rv=(v:readonly number[]|undefined)=>v?v.map(x=>+x.toFixed(3)):null,live=liveWorldPose(),p0=plan.camera(0);
       console.info('[QF_B1_PREWALK] '+JSON.stringify({from:pre.fromKey,m:+pre.lengthM.toFixed(2),planS:+pre.durationS.toFixed(2),realS:(Date.now()-t0)/1000,
        meadowPos:r3(meadow.worldPosition),meadowEuler:r3(meadow.eulerAngles),meadowWorldYaw:+worldYawDeg(meadow).toFixed(3),meadowScale:r3(meadow.worldScale),herStart:r3(gp0),m6Local:rv(M6_LOCAL),m6World:rv(m6),
        c0:live?rv(live.position):null,plan0:rv(p0.position)}));}}
    }catch(error){if(String(error).includes('ancel'))throw error;console.warn('[QF_B1_PREWALK] skipped '+String(error));}}
    // full9c B1-gap (Grok Bot): [QF_B1_PREWALK] → B1's first camera write. m2: 0.34 s with no camera write = gray frames 591–593.
    // One summary line per run (on by default): [QF_B1_GAP] totalMs / frames / maxDtMs / phases{sync ms per B1 setup step}.
    // Per-frame dt only with camTrace on, ≤ 30 lines (well under CAM_LOG_BUDGET.linesPerS).
    const gapNow=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
    const b1Gap={t0:gapNow(),pt:gapNow(),f0:((director as any).getTotalFrames?.()??0),maxDt:0,lines:0,done:false,ph:{} as Record<string,number>};
    const gapPh=(k:string)=>{if(b1Gap.done)return;const n=gapNow();b1Gap.ph[k]=+((b1Gap.ph[k]||0)+n-b1Gap.pt).toFixed(1);b1Gap.pt=n;};
    const gapProbe=()=>{if(b1Gap.done)return;const dt=director.getDeltaTime();b1Gap.maxDt=Math.max(b1Gap.maxDt,dt);gapPh('frame');
     if(camLog.on&&b1Gap.lines<30){b1Gap.lines++;camLog.out('[QF_B1_GAP_FRAME] '+JSON.stringify({fr:((director as any).getTotalFrames?.()??0),dtMs:+(dt*1000).toFixed(1),sinceMs:+(gapNow()-b1Gap.t0).toFixed(1)}));}};
    const gapEnd=(end:string)=>{if(b1Gap.done)return;gapPh('end');b1Gap.done=true;director.off(Director.EVENT_BEFORE_DRAW,gapProbe);
     console.info('[QF_B1_GAP] '+JSON.stringify({totalMs:+(gapNow()-b1Gap.t0).toFixed(1),frames:((director as any).getTotalFrames?.()??0)-b1Gap.f0,maxDtMs:+(b1Gap.maxDt*1000).toFixed(1),phases:b1Gap.ph,end}));};
    director.on(Director.EVENT_BEFORE_DRAW,gapProbe);
    chainMark('balloon','B1-basket-in');gapPh('chainMark');
    const v0=plan.vehicle(0);vehicle.setWorldPosition(v0.pos[0],v0.pos[1],v0.pos[2]);{const qq=balloonQuat(v0.yaw*180/Math.PI,v0.roll);Quat.set(q,qq[0],qq[1],qq[2],qq[3]);vehicle.setWorldRotation(q);}
    if(flame)flame.active=false;gapPh('vehicleT0');
    // full2-cam E (d3fe578e P2): close-up of the boarding — lens beside the door (BasketCloseShot, her ≈30 % of the frame), panning to
    // her live; once she is in, min-jerk onto the ride's first pose before she is seated (the ride then continues from it, no step).
    const cam0=plan.camera(0),oB:Vec=[v0.pos[0],v0.pos[1],v0.pos[2]],doorB1=basketToWorld(oB,vYawDeg(),TRANSITION_STAGING.basket.doorOut);
    let spotB1:{position:Vec}|null=null;try{spotB1=basketCloseSpot(doorB1,oB,[...transitionOccluderBoxes() as any,...(meadow&&isValid(meadow,true)?meadowLensBoxesWorld(l=>worldOf(meadow,l)):[])]/* full8: + meadow windmill / trees from the node */,undefined,[cam0]);}catch{spotB1=null;}gapPh('closeSpot');
    const b1Dist=spotB1?Math.hypot(spotB1.position[0]-cam0.position[0],spotB1.position[1]-cam0.position[1],spotB1.position[2]-cam0.position[2]):0/* full8 ours: ≤ B1_LENS_MPS pacing */;
    const b1Blend=Math.min(BASKET_CLOSE.blendS,TRANSITION_DURATIONS.seg3.sitDown*.9);let b1In=b1InS(TRANSITION_DURATIONS.seg3.toBasket)/* reset to the real walk time below */;
    const b1Lens=():Pose=>{if(!spotB1||!girl||!isValid(girl,true))return cam0;const g=girl.worldPosition,close=blendPose(cam0,basketClosePose(spotB1.position,[g.x,g.y,g.z]),minJerk(b1/b1In));return inAt<1e9?blendPose(close,cam0,minJerk((b1-inAt)/b1Blend)):close;};
    // full8 P1-a: the B1 lens gets the same 1.1 m clearance (occupancy grid + sails sweep + walk floor) as the pre-walk (m2: terrain t 141.3 / 147.8)
    const b1Inv=new Mat4();if(meadow&&isValid(meadow,true))Mat4.invert(b1Inv,meadow.worldMatrix);const b1Y0=meadow&&isValid(meadow,true)?meadow.worldPosition.y:0,b1Clr:LensClearState={pull:0};
    const b1Solid=meadow&&isValid(meadow,true)?meadowLensSolid(w=>{const v=new Vec3(w[0],w[1],w[2]);Vec3.transformMat4(v,v,b1Inv);return [v.x,v.y,v.z];}):undefined,b1Boxes=meadow&&isValid(meadow,true)?sailSweepBoxesWorld(l=>worldOf(meadow,l)) as any:[];gapPh('lensSolid');
    const b1Ground=(w:Vec):number|null=>{if(!b1Solid)return null;const v=new Vec3(w[0],w[1],w[2]);Vec3.transformMat4(v,v,b1Inv);const f=walkFloorY('meadow',v.x,v.z);return f===null?null:f+b1Y0;};
    let b1=0,inAt=1e9,b1On=true;const b1Draw=()=>{if(dead||!b1On)return;const b1dt=Math.min(.1,Math.max(0,director.getDeltaTime()));b1+=b1dt;camTag('BalloonTransit:B1');{const b1p=b1Solid?lensClearStep(b1Lens(),b1Boxes,b1dt,b1Clr,undefined,b1Ground,b1Solid):b1Lens();gapPh('b1LensCalc');world.setCamera(b1p);gapEnd('b1-first-write');}if(camLog.on&&girl&&isValid(girl,true)){const gp=girl.worldPosition;camActorProbe(gp.x,gp.y,gp.z,true,'B1');camActorPose('B1',gp,isValid(vehicle,true)?vehicle.worldPosition:null,v0.pos);}paint(0);if(flame)flame.active=false;
     if(inflateT<INFLATE.durationS&&envHome){if(!inflateMarked){inflateMarked=true;chainMark('balloon','B2-ignite-inflate');}inflateT=Math.min(INFLATE.durationS,inflateT+Math.min(.1,Math.max(0,director.getDeltaTime())));applyInflate();}
     if(door&&isValid(door,true))door.setRotationFromEuler(0,doorInAngleAt(Math.max(0,b1-doorAt),inAt-doorAt),0);};
    let doorAt=1e9;director.on(Director.EVENT_BEFORE_DRAW,b1Draw);gapPh('b1Register');
    try{
     const B=TRANSITION_STAGING.basket,D3=TRANSITION_DURATIONS.seg3,o:Vec=[v0.pos[0],v0.pos[1],v0.pos[2]],y=vYawDeg(),W=(l:Vec)=>basketToWorld(o,y,l);
     const gp=girl.worldPosition,here:Vec=[gp.x,gp.y,gp.z],toDoor=b1DoorPath(here,W(B.outside),W(B.doorOut))/* full6: no in-place turn > 90° */;
     const walkS=Math.max(D3.toBasket*Math.min(1,pathLength(toDoor)/6),pathLength(toDoor)/TRANSITION_STAGING.walkMps);b1In=Math.max(spotB1?speedSafeS(cam0.position,spotB1.position,b1InS(walkS)):b1InS(walkS),b1Dist/B1_LENS_MPS)/* full8: 运镜bot ≤11 m/s + ours ≤2.5 m/s */;
     guardBeforeWalk(anim,'B1 walk to basket');await walkTo(toDoor,walkS);rideToken.check();
     doorAt=b1;const reach=actor.performDoorReach?actor.performDoorReach(rideToken).catch(()=>{}):Promise.resolve();await reach;rideToken.check();
     guardBeforeWalk(anim,'B1 step into basket');await walkTo([W(B.doorOut),W(B.threshold),W(B.p0)],D3.intoBasket);rideToken.check();inAt=b1;
     // b19: ridden SEATED (sit_down → sit_hold; stand_up before any walk at B5), seat = basket (0.032,0,−0.099) facing the door
     seatDef=seatFromBench(W(B.seat),(y+B.seatYawDeg)*Math.PI/180);
     try{await actor.perform({kind:'sit',seat:seatDef} as any,rideToken);}catch(e){if((e as any)?.name==='Cancelled')throw e;console.warn('[QF_TRANSITION] B1 sit skipped: '+String(e));}
     rideToken.check();seated=true;
    }finally{b1On=false;director.off(Director.EVENT_BEFORE_DRAW,b1Draw);gapEnd('b1-ended-without-write');}
   }
   if(girl&&isValid(girl,true)){if(seated)girl.setParent(vehicle,true)/* seated root kept where sit_down put it */;else{girl.setParent(seat,true);girl.setPosition(0,0,0);girl.setRotationFromEuler(0,GIRL_YAW,0);}}
   if(door&&isValid(door,true)&&contChain)door.setRotationFromEuler(0,0,0);if(doorB&&isValid(doorB,true)&&contChain)doorB.setRotationFromEuler(0,0,0);
   if(inflateT<INFLATE.durationS)applyInflate();
   const setWind=(actor as {setWindSource?:(fn:(()=>number|null)|null)=>void}).setWindSource;
   /* call with the actor as `this`: FlowReferenceStandin.setWindSource is a class method (unbound call threw "Cannot set properties of undefined (setting 'windSource')" -> journey failed) */if(setWind)setWind.call(actor,()=>0.35);
   const hold=holdAt();
   const diag=diagParams();let diagDone=false;
   const clock={t:0,hiddenFor:0,fade:0};
   const fired=new Set<string>();
   const cues:Array<[number,string]>=Object.entries(json.cues).map(([name,t])=>[t,name]).sort((a,b)=>a[0]-b[0]);
   let dcWorst=0,dcAt=0,frames=0,lastFade=-1;
   let flightFrom:Pose|null|undefined=undefined,flightBlendS=0;
   const apply=(writeCam=true)=>{
    const t=Math.max(0,Math.min(plan.total,rideToFlightT(clock.t)));/* transitions: 30 s ride clock → 36 s flight file */
    const sample=plan.vehicle(t);
    vehicle.setWorldPosition(sample.pos[0],sample.pos[1],sample.pos[2]);
    const qq=balloonQuat(sample.yaw*180/Math.PI,sample.roll);Quat.set(q,qq[0],qq[1],qq[2],qq[3]);vehicle.setWorldRotation(q);
    const fs=(view as any)?.getFrameSize?.(),plan0=plan.camera(t,fs?{w:fs.width,h:fs.height}:undefined)/* b19: seam framing is aspect-aware */;
    // full8 P1-a: the flight starts from the LIVE lens (B1 close-up / lens-cleared pose), not a step onto plan.camera(0) (m2: 1.72 m in one 77 ms frame)
    if(flightFrom===undefined){flightFrom=liveWorldPose();const g=flightFrom?Math.hypot(flightFrom.position[0]-plan0.position[0],flightFrom.position[1]-plan0.position[1],flightFrom.position[2]-plan0.position[2]):0;flightBlendS=flightBlendSeconds(g);}
    const pose=flightFrom&&clock.t<flightBlendS?blendPose(flightFrom,plan0,minJerk(clock.t/flightBlendS)):plan0;if(writeCam){camTag('BalloonTransit:flight');world.setCamera(pose);}
    const cam=findCamera();if(nightDome&&cam)nightDome.setWorldPosition(cam.worldPosition);if(cam)for(const n of domes)if(n.active&&isValid(n,true))n.setWorldPosition(cam.worldPosition);
    if(girl&&isValid(girl,true)&&girl.parent===seat){girl.setPosition(0,0,0);girl.setRotationFromEuler(0,GIRL_YAW,0);}
    paint(t);
    if(diag.hide.length){const sc=director.getScene();if(sc)eachNamed(sc,n=>{if(diag.hide.includes(n.name))n.active=false;});}
    if(diag.dump&&!diagDone&&(hold===null||t+1e-6>=hold)){diagDone=true;diagDumpScene(t);}
    const fade=Number((globalThis as any).__QF_BALLOON_FADE)||0;
    if(typeof world.fadeCover==='function'&&(Math.abs(fade-lastFade)>0.02||(fade<=0&&lastFade>0))){
     lastFade=fade;try{void world.fadeCover(fade,0);}catch{/* cover optional in tests */}
    }
    return t;
   };
   let flightMarked=!contChain,settleMarked=!contChain;
   beforeDraw=()=>{if(!dead){apply();if(inflateT<INFLATE.durationS)applyInflate();}};
   director.on(Director.EVENT_BEFORE_DRAW,beforeDraw);
   await new Promise<void>((ok,bad)=>{
    const off=rideToken.onCancel(()=>bad(Error('cancelled')));
    driver.step=(dt)=>{
     const hidden=typeof document!=='undefined'&&!!document.hidden;
     if(inflateT<INFLATE.durationS){if(!inflateMarked){inflateMarked=true;chainMark('balloon','B2-ignite-inflate');}if(!hidden)inflateT=Math.min(INFLATE.durationS,inflateT+Math.max(0,Math.min(.1,dt)));}
     else if(!(hold!=null&&rideToFlightT(clock.t)>=hold-1e-4)){const next=stepTransitClock(clock,dt,hidden);clock.t=next.t;clock.hiddenFor=next.hiddenFor;clock.fade=next.fade;}
     const t=apply(Math.max(0,Math.min(plan.total,rideToFlightT(clock.t)))>=plan.total&&hold==null)/* full9b single writer: beforeDraw writes the lens; the step only on its last frame (beforeDraw is removed below) */;if(inflateT<INFLATE.durationS||!flightMarked)applyInflate();
     {const m=t>=LAND_T;if(m!==landRopeOn){landRopeOn=m;setMooringRopes(model,'landing',m);}}/* cand7: landing rope only with the basket down */
     if(contChain&&inflateT>=INFLATE.durationS&&!flightMarked){flightMarked=true;chainMark('balloon','B3-flight');}
     if(contChain&&!settleMarked&&clock.t>=BALLOON_DOOR.settleT0){settleMarked=true;chainMark('balloon','B4-settle');}
     for(const [ct,name] of cues){if(fired.has(name)||t<ct||hidden)continue;fired.add(name);emitTransitCue(name as any,{t,region:balloonCueRegion(name),id:name});}
     let dc=0;try{dc=Number((director as any).root?.device?.numDrawCalls)||0;}catch{dc=0;}
     frames++;if(dc>dcWorst){dcWorst=dc;dcAt=t;}
     const beat=plan.beats.find(b=>t>=b.t0&&t<b.t1)?.id??'board';
     (globalThis as any).__QF_BALLOON={t,rideT:clock.t,rideTotal:RIDE_DURATION,total:plan.total,beat,alt:plan.vehicle(t).pos[1]-plan.launch[1],wind:0.35,night,meadow:t<MEADOW_OFF_T,city:t>=CITY_ON_T,dc,dcWorst,dcAt,frames,hold:hold!=null&&t>=(hold??0)-1e-3,seam:t>=SEAM_T,far:t>=FAR_CARD_ON_T&&t<MEADOW_OFF_T?false:t>=FAR_CARD_ON_T,seaPlan:SEA_PLAN};
     if(t>=plan.total&&hold==null){off();director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);driver.step=()=>{};ok();}
    };
   });
   rideToken.check();
   if(setWind)setWind.call(actor,()=>{try{const w=(globalThis as any).__worldDayNight?.windStrength?.();return typeof w==='number'?w:null;}catch{return null;}});
   if(envHome&&envelope&&isValid(envelope,true)){envelope.setScale(envHome.s);envelope.setPosition(envHome.p);}
   if(contChain&&girl&&isValid(girl,true)){
    // B5 (after the B4 settle 29–30 s): the door opens (door_reach), she leaves stand_point over the sill and walks to the first
    // sky-city stop (plan.s0). No teleport: the actor is reset to where she stands, then walks.
    chainMark('balloon','B5-door-walk-out');
    const vp=vehicle.worldPosition,o:Vec=[vp.x,vp.y,vp.z],y=worldYawDeg(vehicle)/* full8: world yaw (yaw+roll quat; euler read-back can fold) */;
    // full2-cam E: exit close-up — from the ride's last pose, min-jerk (BASKET_CLOSE.blendS) onto a lens beside door B (her ≈30 %),
    // panning with her down the step to S0; the ride ends on it (RegionJourneyCore keeps a ride's last lens; D hands it to the board).
    const camEnd=plan.camera(plan.total),doorOutW=basketToWorld(o,y,TRANSITION_STAGING.basket.doorOutB);let spotB5:{position:Vec}|null=null;
    try{spotB5=basketCloseSpot(doorOutW,o,transitionOccluderBoxes() as any,undefined,[camEnd]);}catch{spotB5=null;}let b5Cam=0;
    const b5Lens=():Pose|null=>{if(!spotB5||!girl||!isValid(girl,true))return null;const g=girl.worldPosition;return blendPose(camEnd,basketClosePose(spotB5.position,[g.x,g.y,g.z]),minJerk(b5Cam/(spotB5?speedSafeS(camEnd.position,spotB5.position,BASKET_CLOSE.blendOutS):BASKET_CLOSE.blendOutS))/* full8: ≤11 m/s */);};
    let b5=0,b5On=true;const b5Draw=()=>{if(dead||!b5On)return;const dd=Math.min(.1,Math.max(0,director.getDeltaTime()));b5+=dd;b5Cam+=dd;{const p=b5Lens();if(p){camTag('BalloonTransit:B5');world.setCamera(p);}}if(doorB&&isValid(doorB,true))doorB.setRotationFromEuler(0,doorAngleAt(b5),0);};
    director.on(Director.EVENT_BEFORE_DRAW,b5Draw);
    try{
     const D4=TRANSITION_DURATIONS.seg4,B=TRANSITION_STAGING.basket,K=TRANSITION_STAGING.skycity,W=(l:Vec)=>basketToWorld(o,y,l);
     const worldParent=prev&&isValid(prev,true)?prev:rig.parent;if(worldParent)girl.setParent(worldParent,true);
     const city=(l:Vec):Vec=>{if(!model)return l;const v=new Vec3(l[0],l[1],l[2]);Vec3.transformMat4(v,v,model.worldMatrix);return [v.x,v.y,v.z];};
     guardBeforeWalk(anim,'B5 stand up');
     if(seated&&seatDef){try{await actor.perform({kind:'stand',seat:seatDef} as any,rideToken);}catch(e){if((e as any)?.name==='Cancelled')throw e;console.warn('[QF_TRANSITION] B5 stand skipped: '+String(e));}}
     rideToken.check();await new Promise<void>(r=>setTimeout(r,D4.pause*1000));b5=0/* door clock starts with door_reach */;
     const gw=girl.worldPosition,here:Vec=[gw.x,gw.y,gw.z];
     actor.cancelAndReset({kind:'standing',controllerRoot:here,yawRad:(y+B.seatYawDeg)*Math.PI/180/* door2: stood up facing door B, no turn */});
     guardBeforeWalk(anim,'B5 door reach');if(actor.performDoorReach)await actor.performDoorReach(rideToken).catch(()=>{});
     rideToken.check();guardBeforeWalk(anim,'B5 walk out');
     await walkTo([here,W(B.thresholdB),W(B.doorOutB),city(K.stepDown)],D4.stepDown+1.0);rideToken.check();
     await walkTo([city(K.stepDown),city(K.deckEdge),city(K.s0New)],Math.min(D4.toPath,Math.max(1.5,pathLength([city(K.stepDown),city(K.deckEdge),city(K.s0New)])/TRANSITION_STAGING.walkMps)));rideToken.check();
     s0End=city(K.s0New);(lease as any).tail=true/* she ends on the b19 S0: the controller must not reset her to the old route end */;
    }finally{b5On=false;director.off(Director.EVENT_BEFORE_DRAW,b5Draw);}
   }else if(girl&&isValid(girl,true)){const worldParent=prev&&isValid(prev,true)?prev:rig.parent;if(worldParent)girl.setParent(worldParent,true);}
   actor.cancelAndReset({kind:'standing',controllerRoot:s0End||plan.s0,yawRad:s0End?TRANSITION_STAGING.skycity.s0YawDeg*Math.PI/180+(model?worldYawDeg(model)*Math.PI/180:0):plan.vehicle(LAND_T).yaw});
   arrived=true;
   const restored=restoreCityNight(cityNightDimmed);try{(globalThis as any).__QF_CITY_NIGHT_RESTORED=restored;}catch{}/* full8: touchdown */
   if(model){model.active=true;showNamed(model,ISLET_NODES,true);}
   paint(plan.total);
   // handoffFade(total) is still 1: the 0.15 s fade-out sits past the clock, so the black cover would stay up over the level.
   try{if(typeof world.fadeCover==='function')void world.fadeCover(0,0);}catch{}
  };
  progress(.98);
  const lease:JourneySceneLease&{model:Node|null}={model,route,ride,startPose:()=>plan.camera(0),show(visible){if(dead)return;rig.active=visible;model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release};
  return lease;
 }catch(error){release();throw error;}
}
/** full6: the live 3D world camera pose (lowest-priority enabled camera rendering the DEFAULT layer), for a no-step lens start. */
function liveWorldPose():Pose|null{try{const cams=(director.getScene()?.getComponentsInChildren(Camera)||[]).filter(c=>c.enabledInHierarchy&&(c.visibility&Layers.Enum.DEFAULT)).sort((a,b)=>a.priority-b.priority);const c=cams[0];if(!c)return null;
 const p=c.node.worldPosition,f=c.node.forward;return {position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:c.fov};}catch{return null;}}
/** full6-cam P1: board copy (board rig coords, boardLocal = prefab root transform) ↔ this placed journey copy (world), as
 *  RegionJourneyAdapter.journeyBoardSource: toJourney = J·B⁻¹, toBoard = its inverse; skycity framing anchors from the journey copy. */
export function balloonBoardSource(model:Node,boardLocal:Mat4):RegionBoardSource{
 const J=new Mat4();Mat4.copy(J,model.worldMatrix);const Bi=new Mat4();Mat4.invert(Bi,boardLocal);const M=new Mat4();Mat4.multiply(M,J,Bi);const Mi=new Mat4();Mat4.invert(Mi,M);
 const tf=(m:Mat4)=>(p:Vec):Vec=>{const v=new Vec3(p[0],p[1],p[2]);Vec3.transformMat4(v,v,m);return [v.x,v.y,v.z];};
 const mm=M as any;for(let i=0;i<16;i++)if(!Number.isFinite(mm['m'+String(i).padStart(2,'0')]))throw Error('region-board-map-invalid');
 return {region:'skycity',map:{toJourney:tf(M),toBoard:tf(Mi)},anchors:{spawn:anchor(model,'anchor_spawn_girl'),court:anchor(model,'anchor_starcourt_center')}};
}
function worldOf(model:Node,local:Vec):Vec{const v=new Vec3(local[0],local[1],local[2]);Vec3.transformMat4(v,v,model.worldMatrix);return [v.x,v.y,v.z];}
function findCamera():Node|null{const scene=director.getScene();if(!scene)return null;const cams=scene.getComponentsInChildren(Camera);const world=cams.find(c=>c.node.name!=='WorldNavigationCamera'&&c.visibility!==0);return (world??cams[0])?.node??null;}
function loadGradeEffect():Promise<EffectAsset|null>{
 return new Promise(ok=>{
  assetManager.loadBundle('region_transit_balloon',(err,bundle)=>{
   if(err||!bundle){ok(null);return;}
   bundle.load('balloon-grade',EffectAsset,(e:any,asset:EffectAsset)=>{ok(!e&&asset?asset:null);});
  });
 });
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
