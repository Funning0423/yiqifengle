import { DEBUG } from 'cc/env';
/** Full world-snapshot console line: debug builds or explicit opt-in only. */
export function worldFlowConsoleEnabled(debug:boolean,optIn:unknown):boolean{return !!debug||optIn===true;}
import { createRegionJourney } from '../region/RegionJourneyAdapter';
import type { JourneyRegion } from './RegionJourneyCore';
import { createSkycityVisitAdapter } from '../region/SkycityVisitAdapter';
import { _decorator, Component, Prefab, instantiate, Camera, Vec3, Vec4, isValid, MeshRenderer, Node, game, Game, sys, director, DirectionalLight, Color, gfx, geometry, view } from 'cc';
import { RoomLook } from './RoomLook';
import { createIslandRail, IslandRail } from './IslandRail';
import { RegionAmbientAnimation } from '../region/RegionAmbientAnimation';
import { RoomLightingRig } from '../render/RoomLightingRig';
import { DoorSpillHint } from '../render/DoorSpillHint';
import { IslandAtmosphereFx } from '../render/IslandAtmosphereFx';
import { ShoreBreak } from '../render/ShoreBreak';
import { REGIONS } from '../region/RegionLoader';
import { preloadMeadowForSail } from '../region/SailPreload';
import { SkyNightTexture } from '../render/SkyNightTexture';
import { WorldFlow, Cancellation, Cancelled, ENTER_LEVEL_SHOT_S } from './WorldFlowCore';
import { hasScreenCover, screenCover } from './ScreenCover';
import type { CharacterAdapter, LevelAdapter, WorldLease, Layers, Pose, Mode, Snapshot, CameraEvent } from './WorldFlowCore';
import { CHARACTER_REFERENCE } from './CharacterReference';
import { FIRSTSLICE } from './FirstsliceFacts';
import { createFirstsliceRoutes } from './FirstsliceRoutes';
import { applyCameraPose, fromLookAt, createCameraTrack, createProgressFollower, frameCheck, characterBox, cameraWriteLog, blendPoseHorizon, rotate, projectPoint, yawPitch, CAMERA_FIXED } from './CameraPose';
import type { CameraPose, V3 } from './CameraPose';
import { REGION_CAMERA, homePoseEntry, islandPoseEntry, characterPoseEntry } from './RegionCameraData';
import { DIALOG_CAMERA_YIELD, dialogCameraOpen, dialogYieldPitchDeg, createYieldMotion, stepYieldMotion, yieldPose } from './DialogCameraYield';
import { FreeOrbit, orbitColliderName, type OrbitBox } from '../region/FreeOrbit';
import { RoomShell360 } from '../render/RoomShell360';
import { exploreEnabled } from '../region/ExploreGate';
import { localNight, resolveDayNight, writeNightBlend, type DayNightMode, emitDayNightChange } from './DayNightContract';
import { skyFollowColor, vertexColorAverageLinear } from './SkyFollowCore';
/** World x where the cabin annex starts (env_lighthouse_ext tower radius ~2.6). */
export const CABIN_MIN_X=2.6;
const {ccclass,property}=_decorator;
/** T2: interior renderers that the island camera can see through the open door / tower windows.
 * Blender ray audit of combined_visual_m.glb (door open 86.4°, 60k rays from cameraIsland and two late toIsland poses):
 * only env_interior_shell, env_interior_props_merged and env_int_anim_window_breeze are hit; env_interior_glass is
 * transparent (not ray-hit) and kept because it sits above the doorway. Others (cat, lamp props, mobile, plants,
 * blind cards) were never hit and are disabled on the island as before. Native visual check still required. */
const DOORWAY_INTERIOR=new Set(['env_interior_shell','env_interior_props_merged','env_int_anim_window_breeze','env_interior_glass']);
type Job={elapsed:number;seconds:number;tick:(t:number)=>void;resolve:()=>void;reject:(e:Error)=>void;off:()=>void};
function resolvePath(root:Node,path:string):Node {
  let node:Node|null=root;for(const part of path.split('/'))node=node?.getChildByName(part)??null;
  if(!node&&!path.includes('/')){
    // Island v2.2 keeps the mesh names, but parents the formerly top-level skinned
    // meshes under scene_root/<mesh>_rig so the combined idle loop has one root.
    const mapped=`scene_root/${path}_rig/${path}`,socketMapped=`scene_root Socket/${path}_rig/${path}`;
    node=root.getChildByPath(mapped)||root.getChildByPath(socketMapped);
    if(node){const audit=(globalThis as any).__worldImportPathAudit||((globalThis as any).__worldImportPathAudit=[]);if(!audit.some((x:any)=>x.source===path))audit.push({source:path,imported:node===root.getChildByPath(mapped)?mapped:socketMapped});}
  }
  if(!node&&path.startsWith('scene_root/')){
    // Official importer relocates mesh descendants into scene_root Socket.
    const mapped='scene_root Socket/'+path.slice('scene_root/'.length);node=root.getChildByPath(mapped);
    if(node){const audit=(globalThis as any).__worldImportPathAudit||((globalThis as any).__worldImportPathAudit=[]);if(!audit.some((x:any)=>x.source===path))audit.push({source:path,imported:mapped});}
  }
  if(!node)throw Error('Missing exact imported node path: '+path);return node;
}
function identity(node:Node):void {
  const p=node.worldPosition,r=node.worldRotation,s=node.worldScale;
  if(Math.hypot(p.x,p.y,p.z)>1e-5||Math.hypot(r.x,r.y,r.z)>1e-5||Math.abs(Math.abs(r.w)-1)>1e-5||Math.hypot(s.x-1,s.y-1,s.z-1)>1e-5)
    throw Error('World root must stay identity in metre space: '+node.name);
}
function descendant(child:Node,parent:Node):boolean {for(let n:Node|null=child;n;n=n.parent)if(n===parent)return true;return false;}
/** Restore glTF baseColorFactor.a lost by the editor's standard-material RGB-only conversion.
 * Only this fresh model's rear glass instance is changed; imported/shared materials stay untouched. */
function bindRearWindowAlpha(renderer:MeshRenderer):()=>void {
  const alpha=.06,shared=renderer.getSharedMaterial(0),prior=renderer.getRenderMaterial(0);
  if(renderer.node.name!=='env_rear_window_glass'||!shared||prior!==shared||shared.effectName!=='builtin-standard')throw Error('Rear glass material baseline mismatch');
  const states=(m:any)=>JSON.stringify(m.passes.map((p:any)=>({phase:p.phase,cull:p.rasterizerState.cullMode,depthTest:p.depthStencilState.depthTest,depthWrite:p.depthStencilState.depthWrite,depthFunc:p.depthStencilState.depthFunc,blend:p.blendState.targets[0]?.blend,src:p.blendState.targets[0]?.blendSrc,dst:p.blendState.targets[0]?.blendDst})));
  const readColor=(m:any)=>{const p=m.passes[0],h=p.getHandle('mainColor');if(!h)throw Error('Rear glass mainColor uniform missing');const v=new Vec4();p.getUniform(h,v);return v;};
  const before=readColor(shared),beforeStates=states(shared),pass=shared.passes[0];
  if(![before.x,before.y,before.z,before.w].every(Number.isFinite)||Math.max(Math.abs(before.x-1),Math.abs(before.y-1),Math.abs(before.z-1))>1e-5)throw Error('Rear glass RGB baseline changed; refusing unrelated colour edits');
  if(!pass.blendState.targets[0]?.blend||pass.depthStencilState.depthWrite||pass.rasterizerState.cullMode!==0)throw Error('Rear glass transparent pass baseline mismatch');
  let instance:ReturnType<MeshRenderer['getMaterialInstance']>=null,released=false;
  const release=()=>{if(released)return;released=true;
    // forceUpdate is required: same-shared-material early return would otherwise keep the instance.
    if(isValid(renderer,true)&&isValid(renderer.node,true)&&isValid(shared,true))renderer.setSharedMaterial(shared,0,true);
    else if(instance&&isValid(instance,true))instance.destroy();
  };
  try {
    instance=renderer.getMaterialInstance(0);if(!instance||instance===shared)throw Error('Rear glass instance not isolated');
    // builtin-standard mainColor targets albedo; its RGB scale remains in albedoScaleAndCutoff.xyz.
    // Vec4 preserves the exact .06 alpha (Color alpha is byte-quantized). White RGB remains unchanged.
    instance.setProperty('mainColor',new Vec4(1,1,1,alpha));
    const after=readColor(instance);
    if(![after.x,after.y,after.z,after.w].every(Number.isFinite)||Math.abs(after.w-alpha)>1e-6||Math.max(Math.abs(after.x-before.x),Math.abs(after.y-before.y),Math.abs(after.z-before.z))>1e-6||states(instance)!==beforeStates)throw Error('Rear glass alpha/state postcondition failed');
    console.info('[OI_REAR_GLASS_ALPHA]',JSON.stringify({version:1,node:renderer.node.name,sourceAlpha:alpha,before:[before.x,before.y,before.z,before.w],after:[after.x,after.y,after.z,after.w],sharedUnchanged:readColor(shared).w===before.w,passesUnchanged:true,scope:'Imported alpha restoration only; native window pixels still require visual check'}));
    return release;
  }catch(error){release();throw error;}
}
/** Restore the original authored transparency of tower windows, light beam and lamp glow. */
function bindIslandSourceAlpha(renderer:MeshRenderer):()=>void {
  const beam=renderer.node.name==='env_lighthouse_beam_night_v22';
  const rgb=beam?[1,.8999999761581421,.6200000047683716]:[1,1,1];
  const alpha=({env_interior_glass:.16,env_lighthouse_beam_night_v22:.10,env_lighthouse_lamp_glow_v22:.85} as Record<string,number>)[renderer.node.name],shared=renderer.getSharedMaterial(0),prior=renderer.getRenderMaterial(0);
  if(!Number.isFinite(alpha)||!shared||prior!==shared||shared.effectName!==(beam?'builtin-unlit':'builtin-standard'))throw Error('Island transparency material baseline mismatch');
  const states=(m:any)=>JSON.stringify(m.passes.map((p:any)=>({phase:p.phase,cull:p.rasterizerState.cullMode,depthTest:p.depthStencilState.depthTest,depthWrite:p.depthStencilState.depthWrite,depthFunc:p.depthStencilState.depthFunc,blend:p.blendState.targets[0]?.blend,src:p.blendState.targets[0]?.blendSrc,dst:p.blendState.targets[0]?.blendDst})));
  const readColor=(m:any)=>{const p=m.passes[0],h=p.getHandle('mainColor');if(!h)throw Error('Island transparency mainColor uniform missing');const v=new Vec4();p.getUniform(h,v);return v;};
  const before=readColor(shared),beforeStates=states(shared),pass=shared.passes[0];
  if(![before.x,before.y,before.z,before.w].every(Number.isFinite)||(!beam&&Math.max(Math.abs(before.x-1),Math.abs(before.y-1),Math.abs(before.z-1))>1e-5))throw Error('Island transparency RGB baseline changed; refusing unrelated colour edits');
  if(!pass.blendState.targets[0]?.blend||pass.depthStencilState.depthWrite||pass.rasterizerState.cullMode!==0)throw Error('Island transparency transparent pass baseline mismatch');
  let instance:ReturnType<MeshRenderer['getMaterialInstance']>=null,released=false;
  const release=()=>{if(released)return;released=true;
    // forceUpdate is required: same-shared-material early return would otherwise keep the instance.
    if(isValid(renderer,true)&&isValid(renderer.node,true)&&isValid(shared,true))renderer.setSharedMaterial(shared,0,true);
    else if(instance&&isValid(instance,true))instance.destroy();
  };
  try {
    instance=renderer.getMaterialInstance(0);if(!instance||instance===shared)throw Error('Island transparency instance not isolated');
    const expectedStates=JSON.parse(beforeStates);
    if(beam){
      // Light adds radiance instead of painting a gray surface over the background.
      // Explicit depth/cull preserve the imported transparent pass; only this instance's main pass changes.
      instance.overridePipelineStates({rasterizerState:{cullMode:pass.rasterizerState.cullMode},depthStencilState:{depthTest:pass.depthStencilState.depthTest,depthWrite:false,depthFunc:pass.depthStencilState.depthFunc},blendState:{targets:[{blend:true,blendEq:gfx.BlendOp.ADD,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE,blendAlphaEq:gfx.BlendOp.ADD,blendSrcAlpha:gfx.BlendFactor.ZERO,blendDstAlpha:gfx.BlendFactor.ONE}]}},0);
      expectedStates[0].src=gfx.BlendFactor.SRC_ALPHA;expectedStates[0].dst=gfx.BlendFactor.ONE;
    }
    // Use original input RGB, not linear uniform readback (which would double-convert).
    instance.setProperty('mainColor',new Vec4(rgb[0],rgb[1],rgb[2],alpha));
    const after=readColor(instance);
    if(![after.x,after.y,after.z,after.w].every(Number.isFinite)||Math.abs(after.w-alpha)>1e-6||Math.max(Math.abs(after.x-before.x),Math.abs(after.y-before.y),Math.abs(after.z-before.z))>1e-6||states(instance)!==JSON.stringify(expectedStates)||states(shared)!==beforeStates)throw Error('Island transparency alpha/state postcondition failed');
    console.info('[OI_ISLAND_ALPHA]',JSON.stringify({version:1,node:renderer.node.name,sourceAlpha:alpha,before:[before.x,before.y,before.z,before.w],after:[after.x,after.y,after.z,after.w],sharedUnchanged:readColor(shared).w===before.w,passesUnchanged:!beam,beamBlend:beam?'SRC_ALPHA/ONE':null,scope:'Source transparency/beam blend configuration; native island pixels still require visual check'}));
    return release;
  }catch(error){release();throw error;}
}
type UnlitBackdropBinding={setNight:(night:boolean)=>void;release:()=>void;setFollow?:(target:readonly number[]|null,w:number,fade?:number)=>boolean};
/** r4-prep: mean linear vertex colour of the backdrop mesh (what builtin-unlit multiplies mainColor with); [1,1,1] without vertex colours. */
function backdropAverage(renderer:MeshRenderer,shared:any):[number,number,number]{
  try{if(!shared?.passes?.[0]?.defines?.USE_VERTEX_COLOR)return [1,1,1];const mesh:any=renderer.mesh;if(!mesh)return [1,1,1];
    const c=mesh.readAttribute(0,gfx.AttributeName.ATTR_COLOR),p=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);if(!c||!p)return [1,1,1];
    const n=p.length/3,stride=n>0?Math.round(c.length/n):0;return vertexColorAverageLinear(c,stride,c instanceof Uint8Array);}catch{return [1,1,1];}
}
/** Imported sky/cloud use builtin-unlit: there is no nightBlend uniform and no light response. */
function bindUnlitBackdrop(renderer:MeshRenderer):UnlitBackdropBinding {
  const name=renderer.node.name,foamAlpha=({env_sea_foam:.9,env_sea_surf_foam_v22:.48,env_sea_wave_line_01_v22:.34,env_sea_wave_line_02_v22:.38} as Record<string,number>)[name];
  const tint=name==='env_sky_dome'||name==='env_window_blind_cards'?[.18,.24,.46]:name==='env_cloud_layer'?[.22,.28,.43]:Number.isFinite(foamAlpha)?[.35,.48,.64]:null,alpha=Number.isFinite(foamAlpha)?foamAlpha:1;
  const shared=renderer.getSharedMaterial(0);
  if(!tint||!shared||shared.effectName!=='builtin-unlit'||renderer.getRenderMaterial(0)!==shared)throw Error('Unexpected unlit backdrop material');
  const read=(m:any)=>{const p=m.passes[0],h=p.getHandle('mainColor');if(!h)throw Error('Backdrop mainColor missing');const v=new Vec4();p.getUniform(h,v);return v;};
  const original=read(shared);
  if(![original.x,original.y,original.z,original.w].every(Number.isFinite)||Math.max(Math.abs(original.x-1),Math.abs(original.y-1),Math.abs(original.z-1),Math.abs(original.w-1))>1e-5)throw Error('Backdrop authored colour changed');
  const day=new Vec4(1,1,1,alpha),night=new Vec4(tint[0],tint[1],tint[2],alpha);
  let instance:ReturnType<MeshRenderer['getMaterialInstance']>=null,released=false,last:boolean|null=null;
  // r4-prep: sky dome + cloud layer can follow the lakeside journey sky (SkyFollowCore). follow=null → exactly the old day/night writes.
  const follows=name==='env_sky_dome'||name==='env_cloud_layer',average=follows?backdropAverage(renderer,shared):[1,1,1];let follow:{target:number[];w:number}|null=null;
  // r4-prep (C/D): fade < 1 → this instance's pass blends SRC_ALPHA/ONE_MINUS_SRC_ALPHA without depth write (transparent queue, still
  // one draw); fade back to 1 → the shared pass's own blend/depth/cull states again. Only the instance; the shared material is untouched.
  let fade=1,blended=false;
  const sp:any=shared.passes[0],orig={cull:sp.rasterizerState.cullMode,test:sp.depthStencilState.depthTest,write:sp.depthStencilState.depthWrite,func:sp.depthStencilState.depthFunc,t:sp.blendState.targets[0]};
  const setBlend=(on:boolean)=>{if(on===blended)return;const t=orig.t;
    instance!.overridePipelineStates(on?{rasterizerState:{cullMode:orig.cull},depthStencilState:{depthTest:orig.test,depthWrite:false,depthFunc:orig.func},blendState:{targets:[{blend:true,blendEq:gfx.BlendOp.ADD,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendAlphaEq:gfx.BlendOp.ADD,blendSrcAlpha:gfx.BlendFactor.ONE,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]}}
      :{rasterizerState:{cullMode:orig.cull},depthStencilState:{depthTest:orig.test,depthWrite:orig.write,depthFunc:orig.func},blendState:{targets:[{blend:t.blend,blendEq:t.blendEq,blendSrc:t.blendSrc,blendDst:t.blendDst,blendAlphaEq:t.blendAlphaEq,blendSrcAlpha:t.blendSrcAlpha,blendDstAlpha:t.blendDstAlpha}]}},0);blended=on;};
  const followWrite=()=>{const b=last?tint:[1,1,1],c=skyFollowColor(b,follow?follow.target:null,average,follow?follow.w:0);setBlend(fade<1);instance!.setProperty('mainColor',new Vec4(c[0],c[1],c[2],alpha*fade));};
  const release=()=>{if(released)return;released=true;if(isValid(renderer,true)&&isValid(renderer.node,true)&&isValid(shared,true))renderer.setSharedMaterial(shared,0,true);else if(instance&&isValid(instance,true))instance.destroy();};
  try {
    instance=renderer.getMaterialInstance(0);if(!instance||instance===shared)throw Error('Backdrop instance not isolated');
    return {release,
    setFollow:follows?(target,w,f=1)=>{if(released||!isValid(renderer,true)||!isValid(renderer.node,true))return false;const next=target&&target.length>=3&&Number.isFinite(w)&&w>0?{target:[target[0],target[1],target[2]],w:Math.min(1,w)}:null;
      const nf=next&&Number.isFinite(f)?Math.max(0,Math.min(1,f)):1;if(!next&&!follow&&fade===1)return true;follow=next;fade=nf;if(last===null)last=false;try{followWrite();return true;}catch(error){follow=null;fade=1;release();throw error;}}:undefined,
    setNight:(value:boolean)=>{if(released||!isValid(renderer,true)||!isValid(renderer.node,true))return;if(follow){if(value!==last){last=value;try{followWrite();}catch(error){release();throw error;}}return;}if(value===last)return;try {
      instance!.setProperty('mainColor',value?night:day);const v=read(instance);
      if(![v.x,v.y,v.z,v.w].every(Number.isFinite)||Math.abs(v.w-alpha)>1e-6||(value?Math.max(v.x,v.y,v.z)>=.5:Math.max(Math.abs(v.x-1),Math.abs(v.y-1),Math.abs(v.z-1))>1e-6))throw Error('Backdrop day/night uniform postcondition failed');
      last=value;console.info(Number.isFinite(foamAlpha)?'[OI_SHORE_FOAM]':'[OI_WINDOW_SKY]',JSON.stringify({node:name,night:value,tintSRGB:value?tint:[1,1,1],uniformLinear:[v.x,v.y,v.z,v.w],scope:'Material uniform readback; native pixels still require visual check'}));
    }catch(error){release();throw error;}}};
  }catch(error){release();throw error;}
}
/** Add to a NEW, identity scene-root sibling. Do not add to a Camera, Canvas or imported model. */
@ccclass('WorldFlowComponent')
export class WorldFlowComponent extends Component {
  @property(Prefab) firstsliceModel:Prefab|null=null;
  @property(Camera) worldCamera:Camera|null=null;
  private flow:WorldFlow|null=null;
  private roomLook=new RoomLook(homePoseEntry());
  private islandRail:IslandRail|null=null;
  private readonly homeOrbit=new FreeOrbit('home');
  private readonly islandOrbit=new FreeOrbit('island');
  private orbitBoxes:OrbitBox[]=[];
  private orbitBoxAt=0;
  private frameSerial=0;
  private cinematicSerial=-1;
  private orbitHeldTick=false;
  private readonly settledListeners=new Set<(place:'island'|'home')=>void>();
  private readonly craneListeners=new Set<(info:{segment:'toIsland';progress:number;seconds:number})=>void>();
  private readonly doorShutListeners=new Set<()=>void>();
  private flowEventsOff:(()=>void)|null=null;
  private doorShutOff:(()=>void)|null=null;
  private windStrength=0;private readonly windListeners=new Set<(strength:number)=>void>();private windOff:(()=>void)|null=null;
  /** T2+ hook (contract with GGbot T0): fires once per completed journey when the camera has reached cameraIsland /
   *  cameraHome with zero speed and the girl is still. Returns unsubscribe. No logging here. */
  onCameraSettled(listener:(place:'island'|'home')=>void):()=>void {this.settledListeners.add(listener);return ()=>{this.settledListeners.delete(listener);};}
  /** T2+ hook: the outbound camera leaves the rail and starts the crane up to the island wide shot (ends at
   *  onCameraSettled('island')). info.seconds = time from the start of crossing-out. Returns unsubscribe. */
  onCraneStart(listener:(info:{segment:'toIsland';progress:number;seconds:number})=>void):()=>void {this.craneListeners.add(listener);return ()=>{this.craneListeners.delete(listener);};}
  /** Return door leaf has reached 0 (once per return). The follow route never enters 'closing-door'; this is the shut.
   *  Returns unsubscribe. */
  onDoorShut(listener:()=>void):()=>void {this.doorShutListeners.add(listener);return ()=>{this.doorShutListeners.delete(listener);};}
  /** T2+ wind strength 0..1 for the current frame (primary API; Voice bot + 角色动画bot poll it every frame). Clamped,
   *  0 when disposed / before the world exists / whenever the camera is settled (island idle = exactly 0).
   *  Driven by WorldFlowCore's outbound frontal-swing wind channel (signature unchanged from work/运镜bot-wind-api). */
  getWindStrength():number {if(this.disposed)return 0;const v=this.windStrength;return v>0?(v<1?v:1):0;}
  /** T2+: subscribe to wind-strength changes (fired only when the value changes; same style as onCraneStart).
   *  Returns an unsubscribe fn (idempotent). Safe before the flow exists (attached when it is created). */
  onWindStrength(listener:(strength:number)=>void):()=>void {this.windListeners.add(listener);return ()=>{this.windListeners.delete(listener);};}
  private forwardCameraEvent(e:CameraEvent){
    const list:Array<(x:any)=>void>=e.kind==='settled'?Array.from(this.settledListeners) as any:Array.from(this.craneListeners) as any;
    for(const fn of list){try{e.kind==='settled'?fn(e.place):fn({segment:e.segment,progress:e.progress,seconds:e.seconds});}catch(error){console.warn('camera hook listener failed',String(error));}}
  }
  private forwardDoorShut(){
    this.reportRuntime('door-shut');
    for(const fn of Array.from(this.doorShutListeners)){try{fn();}catch(error){console.warn('door shut listener failed',String(error));}}
  }
  private roomLookToken:Cancellation|null=null;
  private jobs=new Set<Job>();
  private lighthouseTargets:MeshRenderer[]=[];private readonly lighthouseRay=new geometry.Ray();private readonly lighthouseRayOptions={mode:geometry.ERaycastMode.ANY,distance:500,doubleSided:true};private readonly cabinRayOptions={mode:geometry.ERaycastMode.CLOSEST,distance:500,doubleSided:true};
  private ownedModel:Node|null=null;
  private disposed=false;
  private safetyFailure:string|null=null;
  private onStatus:((status:Snapshot)=>void)|undefined;
  private savedCamera:CameraPose|null=null;
  // 运镜bot r5 dialog yield: base = the pose the flow/jobs/room look wrote, last = what the post-pass wrote on top of it.
  private yieldMotion=createYieldMotion();private yieldBase:CameraPose|null=null;private yieldLast:CameraPose|null=null;
  private dayNightMode:DayNightMode='day';
  /** null follows the clock. true/false is the player's switch and blocks the clock. */
  private nightOverride:boolean|null=null;
  private exteriorVisible=false;private interiorVisible=false;private backdropVisible=false;private doorSpill:DoorSpillHint|null=null;private atmosphere:IslandAtmosphereFx|null=null;private shore:ShoreBreak|null=null;private room360:RoomShell360|null=null;
  private roomLighting:RoomLightingRig|null=null;private worldAmbient:RegionAmbientAnimation|null=null;
  private nightRenderers:MeshRenderer[]=[];
  private skyDomes:MeshRenderer[]=[];
  private mainLight:DirectionalLight|null=null;
  private lightHome=125000;private lightHomeColor:Color|null=null;
  private dayNightClock=0;
  private appliedBlend=0;
  private clock={updates:0,rawSeconds:0,appliedSeconds:0,maxDt:0,lastTickUtc:'',hideEvents:0,showEvents:0};
  /** Frames the flow has stayed hidden while the director is still ticking. Two frames, then revealReturn(). */
  private hiddenTicks=0;
  /** Region-node walks turn the island exterior back on while the board camera is hidden. */
  private nodeWalkLayers:((layers:Layers)=>void)|null=null;
  presentNodeWalkWorld(on:boolean):void{
    const layers:Layers=on?{interior:false,exterior:true,door:true,backdrop:true,doorwayInterior:true}:{interior:false,exterior:false,door:false,backdrop:false};
    this.nodeWalkLayers?.(layers);
  }
  /** One-shot return. Not cleared on hide: a same-turn hide after show must still reveal. */
  private returnTimer:any=null;
  private wxOff:[string,()=>void][]=[];
  private lastDiagnosticAt=0;
  private releaseRearGlass:(()=>void)|null=null;
  private unlitBackdrops=new Map<MeshRenderer,UnlitBackdropBinding>();
  private islandAlphaReleases:(()=>void)[]=[];
  private releaseIslandAlpha():void {for(const release of this.islandAlphaReleases)release();this.islandAlphaReleases.length=0;}
  private releaseUnlitBackdrops():void {Array.from(this.unlitBackdrops.values()).forEach(b=>b.release());this.unlitBackdrops.clear();}
  /** Separate diagnostic key only: never writes journey, attempt or reward data. */
  private reportRuntime(event:string):void {
    if(!this.flow)return;
    const data={version:2,integrationSource:'fb338ef+Oi-auto-room-action-clock',event,utc:new Date().toISOString(),world:this.flow.snapshot(),clock:{...this.clock},jobs:Array.from(this.jobs).map(j=>({elapsed:j.elapsed,seconds:j.seconds})),camera:cameraWriteLog.last,motion:(globalThis as any).__worldLoading?.motion?.()??null,dayNight:this.dayNightSnapshot()};
    this.lastDiagnosticAt=Date.now();
    // Periodic telemetry must not keep resetting the IDE's storage persistence debounce.
    // State transitions remain inspectable; tick details remain in console.
    try {if(event!=='tick')sys.localStorage.setItem('dot-runtime-diagnostics-20261010:world-flow',JSON.stringify(data));}catch(error){console.warn('[OI_WORLD_FLOW] diagnostic storage unavailable',String(error));}
    // build05 DevTools check: the full snapshot (~11.7 KB) flooded the release console. Debug builds, or an explicit
    // opt-in (globalThis.__worldFlowLog = true, e.g. for a recording session), only. snapshot() itself is untouched.
    if(worldFlowConsoleEnabled(DEBUG,(globalThis as any).__worldFlowLog))console.info('[OI_WORLD_FLOW]',JSON.stringify(data));
  }
  /** Called once by a composition root, after real adapters are ready. Character may be omitted for scene inspection. */
  async initialize(levels:LevelAdapter,character?:CharacterAdapter,mode:Mode='fixed',onStatus?:(s:Snapshot)=>void) {
    if(this.flow||this.disposed)throw Error('WorldFlowComponent already initialized/disposed');
    if(!this.firstsliceModel||!this.worldCamera)throw Error('Bind imported combined prefab and dedicated WorldCamera');
    identity(this.node);
    if(descendant(this.node,this.worldCamera.node)||descendant(this.worldCamera.node,this.node))throw Error('Camera and world owner must be independent siblings');
    this.onStatus=onStatus;
    const cam=this.worldCamera.node,p=cam.worldPosition,q=cam.worldRotation;this.savedCamera={position:[p.x,p.y,p.z],rotation:[q.x,q.y,q.z,q.w],fovVerticalDeg:this.worldCamera.fov};
    this.installCameraDebug();
    this.dayNightMode=localNight(new Date())?'night':'day';
    const routes=createFirstsliceRoutes(FIRSTSLICE,CHARACTER_REFERENCE);this.islandRail=createIslandRail(routes);
    this.flow=new WorldFlow({config:routes,mode,levels,character,journey:createRegionJourney({parent:this.node,camera:this.worldCamera}),skycity:createSkycityVisitAdapter({parent:this.node,camera:this.worldCamera,snapshot:()=>this.flow!.snapshot()}),onChange:s=>{this.reportRuntime('state:'+s.state);onStatus?.(s);},loadWorld:t=>this.createWorld(t)});this.flowEventsOff?.();this.flowEventsOff=this.flow.onCameraEvent(e=>this.forwardCameraEvent(e));
    this.doorShutOff?.();this.doorShutOff=this.flow.onDoorShut(()=>this.forwardDoorShut());
    this.windOff?.();this.windOff=this.flow.onWindStrength(s=>{this.windStrength=s;Array.from(this.windListeners).forEach(fn=>{try{fn(s);}catch(error){console.warn('wind listener failed',String(error));}});});
    game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);this.bindWxLifecycle();
    return this.flow.load();
  }
  /** mainline-04 board: warm the meadow rig inactive. A slow warm keeps waiting on the sail. */
  preloadHiddenRegion(target:JourneyRegion):Promise<{ok:boolean;reason?:string}>{
   if(target!=='meadow')return Promise.resolve({ok:false,reason:'unsupported'});
   const scene=director.getScene();if(!scene)return Promise.resolve({ok:false,reason:'no-scene'});
   return preloadMeadowForSail(scene).then(()=>({ok:true}));
  }
  /** UI receives this command facade, never scene/model/camera references. */
  commands() {
    const flow=()=>{if(!this.flow)throw Error('World not initialized');return this.flow;};
    return Object.freeze({snapshot:()=>flow().snapshot(),leaveHome:()=>this.leaveRoom(),roomView:(aspect:number)=>this.roomView(aspect),lookRoom:(dx:number,dy:number)=>this.lookRoom(dx,dy),pullIsland:(dy:number,scale:number)=>this.pullIsland(dy,scale),orbitIsland:(dx:number,dy:number,scale:number)=>this.orbitIsland(dx,dy,scale),returnHome:()=>flow().returnHome(),hitLighthouse:(x:number,y:number)=>this.hitLighthouse(x,y),hitCabin:(x:number,y:number)=>this.hitCabin(x,y),
      enterLevel:(id:string)=>flow().enterLevel(id),exitLevel:()=>flow().exitLevel(),resume:()=>flow().resume(),
      enterSkycity:()=>flow().enterSkycity(),exitSkycity:()=>flow().exitSkycity(),
      prepareRegion:(target:JourneyRegion)=>flow().prepareRegion(target),travelRegion:(target:JourneyRegion)=>flow().travelRegion(target),journeySnapshot:()=>flow().snapshot().journey,abandonLakesideJourney:()=>flow().abandonLakesideJourney(),
      preloadHiddenRegion:(target:JourneyRegion)=>this.preloadHiddenRegion(target),
      cancelTransition:()=>{const settling=!!this.roomLookToken;this.cancelRoomLook();return settling?{ok:true}:flow().cancelTransition();},setMode:(m:Mode)=>{this.cancelRoomLook();return flow().setMode(m);},
      dayNight:()=>this.dayNightSnapshot(),toggleDayNight:()=>this.toggleDayNight(),setDayNight:(mode:DayNightMode)=>this.setDayNight(mode,true)});
  }
  private hitLighthouse(x:number,y:number):boolean {
    const s=this.flow?.snapshot();if(!s||s.state!=='island'||s.hidden||s.needsResume||!s.characterReady||this.disposed||this.safetyFailure||!this.worldCamera||!Number.isFinite(x)||!Number.isFinite(y))return false;
    const ray=this.lighthouseRay;ray.o.set(NaN,NaN,NaN);ray.d.set(NaN,NaN,NaN);this.worldCamera.screenPointToRay(x,y,ray);
    if(!Number.isFinite(ray.o.x)||!Number.isFinite(ray.o.y)||!Number.isFinite(ray.o.z)||!Number.isFinite(ray.d.x)||!Number.isFinite(ray.d.y)||!Number.isFinite(ray.d.z))return false;
    // The hidden interior shell is an exact-geometry fallback for open doorway/window holes, never a bounding-box hotzone.
    for(const r of this.lighthouseTargets){if(!isValid(r,true)||!isValid(r.node,true)||!r.node.activeInHierarchy||!r.model)continue;if(geometry.intersect.rayModel(ray,r.model,this.lighthouseRayOptions)>0)return true;}return false;
  }
  /** The exterior lighthouse mesh also wraps the cabin annex (east of the tower): classify the closest hit by world x. */
  private hitCabin(x:number,y:number):boolean {
    if(!this.hitLighthouse(x,y))return false;const ray=this.lighthouseRay;let best=Infinity;
    for(const r of this.lighthouseTargets){if(!isValid(r,true)||!isValid(r.node,true)||!r.node.activeInHierarchy||!r.model)continue;const t=geometry.intersect.rayModel(ray,r.model,this.cabinRayOptions);if(t>0&&t<best)best=t;}
    return Number.isFinite(best)&&ray.o.x+ray.d.x*best>=CABIN_MIN_X;
  }
  private homePivot():V3{const r=CHARACTER_REFERENCE.seatedRoot;return [r[0],r[1],r[2]];}
  private islandPivot():V3{const r=REGION_CAMERA.islandCharacter.root;return [r[0],r[1],r[2]];}
  private readLivePose():Pose{const cam=this.worldCamera!,n=cam.node,p=n.worldPosition,f=n.forward;return {position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:cam.fov};}
  /** Door hint from a lens. Same screen test as RoomLook, measured from this lens so a spun room still finds the handle. */
  private doorGlance(cam:CameraPose,aspect:number,point:V3){if(!Number.isFinite(aspect)||aspect<=0)return {visible:false,x:.5,y:.5,direction:1};const p=projectPoint(cam,aspect,point),x=(p.x+1)/2,y=(p.y+1)/2;const a=yawPitch(cam.rotation),rel=[point[0]-cam.position[0],point[2]-cam.position[2]];let delta=Math.atan2(rel[0],rel[1])-a.yaw;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;return {visible:p.depth>.05&&x>.10&&x<1-.10&&y>.12&&y<.86,x,y,direction:delta<0?1:-1};}
  private fillBoxes():OrbitBox[]{const now=Date.now();if(now-this.orbitBoxAt<400&&this.orbitBoxes.length)return this.orbitBoxes;this.orbitBoxAt=now;this.orbitBoxes.length=0;const root=this.ownedModel;if(!root)return this.orbitBoxes;const list=root.getComponentsInChildren(MeshRenderer);for(let i=0;i<list.length&&this.orbitBoxes.length<32;i++){const r=list[i];if(!r.enabled||!r.node.activeInHierarchy||orbitColliderName(r.node.name)||!r.model?.worldBounds)continue;const b=r.model.worldBounds,c=b.center,h=b.halfExtents,span=Math.max(h.x,h.y,h.z)*2;if(span<0.25||span>16)continue;this.orbitBoxes.push({min:[c.x-h.x,c.y-h.y,c.z-h.z],max:[c.x+h.x,c.y+h.y,c.z+h.z],name:r.node.name});}return this.orbitBoxes;}
  private writeOrbit(orbit:FreeOrbit,feet:V3,reason:string):boolean{if(!this.worldCamera)return false;const pose=orbit.solve(feet,this.fillBoxes(),feet[1]);return applyCameraPose(this.worldCamera,fromLookAt(pose),reason);}
  private noteCinematic(){this.homeOrbit.pause();this.islandOrbit.pause();this.cinematicSerial=this.frameSerial;}
  private roomView(aspect:number){const s=this.flow?.snapshot();const enabled=!!s&&s.state==='home'&&!s.hidden&&!s.needsResume&&s.characterReady&&!this.disposed&&!this.safetyFailure&&!this.roomLookToken&&this.jobs.size===0;const handle=FIRSTSLICE.anchors.door_handle.position as V3;if(enabled&&this.homeOrbit.engaged()&&this.worldCamera){const pose=fromLookAt(this.homeOrbit.solve(this.homePivot(),this.fillBoxes(),this.homePivot()[1]));return {enabled,settling:!!this.roomLookToken,door:this.doorGlance(pose,aspect,handle),angles:{yaw:this.homeOrbit.yaw,pitch:this.homeOrbit.pitch}};}return {enabled,settling:!!this.roomLookToken,door:this.roomLook.door(handle,aspect),angles:this.roomLook.angles()};}
  private lookRoom(dx:number,dy:number):boolean {if(!this.roomView(1).enabled||!this.worldCamera)return false;this.orbitHeldTick=true;if(!this.homeOrbit.seeded)this.homeOrbit.seed(this.readLivePose(),this.homePivot());if(!this.homeOrbit.drag(dx,dy))return false;return this.writeOrbit(this.homeOrbit,this.homePivot(),'room.orbit');}
  private orbitIsland(dx:number,dy:number,scale:number):boolean {if(!this.islandView()||!this.worldCamera)return false;this.orbitHeldTick=true;if(!this.islandOrbit.seeded)this.islandOrbit.seed(this.readLivePose(),this.islandPivot());let moved=false;if(Number.isFinite(scale)&&Math.abs(scale-1)>1e-4)moved=this.islandOrbit.pinch(scale)||moved;if(Number.isFinite(dx)&&Number.isFinite(dy)&&(dx!==0||dy!==0))moved=this.islandOrbit.drag(dx,dy)||moved;if(!moved&&!this.islandOrbit.engaged())return false;return this.writeOrbit(this.islandOrbit,this.islandPivot(),'island.orbit');}
  /** Settled island only: the exit arc is finished (state is island) and no camera job is writing. */
  private islandView(){const s=this.flow?.snapshot();return !!s&&s.state==='island'&&!s.hidden&&!s.needsResume&&s.characterReady&&!this.disposed&&!this.safetyFailure&&this.jobs.size===0;}
  private pullIsland(dy:number,scale:number):boolean {const rail=this.islandRail;if(!rail||!this.islandView()||!this.worldCamera)return false;const before=rail.fraction();if(!rail.nudge(dy,scale))return false;if(applyCameraPose(this.worldCamera,rail.pose(),'island.pull'))return true;rail.restore(before);return false;}
  /** Enter-level push from the camera as it stands (wide shot or a pull). Same look direction, a short dolly and a tighter fov.
   *  The exit arc is not read or written. */
  /** 运镜bot: one-shot. The 风铃湖畔 landing→board hook already put the world camera on the board camera's pose, so the
   *  next enter-level cover holds that frame (same ENTER_LEVEL_SHOT_S, no dolly, no fov change) instead of pushing in 2.6 m
   *  and then cutting back to the board camera. Set by WorldNativeComposition after the hook lands; cleared after enterLevel. */
  private enterLevelHold=false;
  holdEnterLevel(on:boolean){this.enterLevelHold=on;}
  private enterLevelLook():Pose[]|null {
    const camera=this.worldCamera;if(!camera||!isValid(camera.node,true))return null;
    const n=camera.node,p=n.worldPosition,q=n.worldRotation,f=rotate([q.x,q.y,q.z,q.w],[0,0,-1]),fl=Math.hypot(f[0],f[1],f[2]);
    if(!(fl>1e-4)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(camera.fov))return null;
    const fx=f[0]/fl,fy=f[1]/fl,fz=f[2]/fl,reach=40,step=2.6;
    const target:[number,number,number]=[p.x+fx*reach,p.y+fy*reach,p.z+fz*reach];
    const clamp=(fov:number)=>Math.min(CAMERA_FIXED.maxFov,Math.max(CAMERA_FIXED.minFov,fov));
    return [{position:[p.x,p.y,p.z],target,fovVerticalDeg:clamp(camera.fov)},{position:[p.x+fx*step,p.y+fy*step,p.z+fz*step],target,fovVerticalDeg:clamp(camera.fov-6)}];
  }
  private cancelRoomLook(){const changed=this.roomLook.moved()||this.homeOrbit.engaged()||!!this.roomLookToken;this.roomLookToken?.cancel();this.roomLookToken=null;this.roomLook.reset();this.homeOrbit.forget();if(changed&&this.worldCamera&&!this.disposed)try{applyCameraPose(this.worldCamera,fromLookAt(homePoseEntry()),'room.cancel-reset');}catch(error){console.warn('Room view reset failed',String(error));}}
  /** Rejoin the existing authored opening from the same origin before character motion starts.
   * Only user-look adds this bounded horizon-locked settle; untouched default view follows the old track exactly. */
  private async leaveRoom(){
    if(this.roomLookToken)return {ok:false,reason:'room-view-busy'};
    if(!this.flow)return {ok:false,reason:'world-not-ready'};
    const spun=this.homeOrbit.engaged();
    if(!this.roomView(1).enabled||(!this.roomLook.moved()&&!spun))return this.flow.leaveHome();
    const orbitFrom=():Pose=>this.homeOrbit.solve(this.homePivot(),this.fillBoxes(),this.homePivot()[1]);
    if(this.flow.continuousLeave){
      // T2+: no rejoin-then-cut. The stand-up camera move starts on the exact dragged view and pans back to the girl.
      let from:Pose;
      if(spun)from=orbitFrom();
      else {const look=this.roomLook.pose(),f=rotate(look.rotation,[0,0,-1]),p=look.position;from={position:[p[0],p[1],p[2]],target:[p[0]+f[0]*2.5,p[1]+f[1]*2.5,p[2]+f[2]*2.5],fovVerticalDeg:look.fovVerticalDeg??homePoseEntry().fovVerticalDeg};}
      const pending=this.flow.leaveHome({from});if(this.flow.snapshot().state==='standing')this.roomLook.reset();return pending;
    }
    const from=spun?fromLookAt(orbitFrom()):this.roomLook.pose(),to=fromLookAt(homePoseEntry()),a=spun?{yaw:this.homeOrbit.yaw,pitch:this.homeOrbit.pitch}:this.roomLook.angles();const token=new Cancellation();this.roomLookToken=token;
    try {await this.run(Math.max(.25,Math.min(1.05,Math.hypot(a.yaw,a.pitch)/120)),token,p=>{token.check();if(!this.worldCamera||!applyCameraPose(this.worldCamera,blendPoseHorizon(from,to,p,'easeInOutCubic'),'room.rejoin'))throw Error('Room camera rejoin rejected');});token.check();this.roomLook.reset();this.roomLookToken=null;return await this.flow.leaveHome();}
    catch(error){this.cancelRoomLook();if(error instanceof Cancelled)return {ok:false,reason:'cancelled'};throw error;}
    finally {if(this.roomLookToken===token)this.roomLookToken=null;}
  }
  bindCharacter(adapter:CharacterAdapter) {if(!this.flow)throw Error('World not initialized');return this.flow.bindCharacter(adapter);}
  private async createWorld(token:Cancellation):Promise<WorldLease> {
    token.check();const model=instantiate(this.firstsliceModel!);const ambient=model.addComponent(RegionAmbientAnimation);this.worldAmbient=ambient;ambient.clipUuids=REGIONS.island.ambientClipUuids!;this.ownedModel=model;this.node.addChild(model);
    try {
      await ambient.prepare();token.check();
      identity(model);const sceneRoot=resolvePath(model,'scene_root');identity(sceneRoot);
      for(const anchor of Object.values(FIRSTSLICE.anchors)) {
        const found=resolvePath(model,anchor.path),p=found.worldPosition;
        if(Math.hypot(p.x-anchor.position[0],p.y-anchor.position[1],p.z-anchor.position[2])>1e-4)throw Error('Anchor changed at import: '+anchor.path);
      }
      const seatRotation=resolvePath(model,FIRSTSLICE.anchors.seat_anchor.path).worldRotation;
      const seatYaw=FIRSTSLICE.anchors.seat_anchor.properties.yaw_rad;
      const alignment=Math.abs(seatRotation.y*Math.sin(seatYaw/2)+seatRotation.w*Math.cos(seatYaw/2));
      if(alignment<1-1e-5)throw Error('Seat anchor yaw changed at import');
      const door=resolvePath(model,FIRSTSLICE.door.path),h=FIRSTSLICE.door.hinge;
      if(Math.hypot(door.rotation.x,door.rotation.y,door.rotation.z)>1e-5)throw Error('Door must import in source closed rest rotation');
      if(Math.hypot(door.position.x-h[0],door.position.y-h[1],door.position.z-h[2])>1e-4)throw Error('Door origin is not the source hinge');
      const renderers=new Map<string,MeshRenderer[]>();
      for(const entry of FIRSTSLICE.renderers) {
        const list=resolvePath(model,entry.path).getComponents(MeshRenderer);
        if(list.length===0)throw Error('Imported mesh has no renderer: '+entry.path);
        renderers.set(entry.path,list);
      }
      // Reject unclassified renderers. No hidden duplicate combined/interior prefab or residual preview nodes.
      const known=new Set(Array.from(renderers.values()).flat());
      const v22=model.getComponentsInChildren(MeshRenderer).filter(r=>r.node.name.includes('_v22'));
      const v22Day=v22.filter(r=>!r.node.name.includes('_night_v22'));
      const v22Night=v22.filter(r=>r.node.name.includes('_night_v22'));
      for(const r of v22)known.add(r);
      for(const r of v22Night)r.enabled=false;
      // Scene FX: the authored chimney balls, hard beam bar and the two orbiting gulls stay imported (classified, alpha-bound) but
      // never render; IslandAtmosphereFx draws their replacements (fx_chimney_smoke, fx_lighthouse_beam/glow/seaglint, fx_gull_N
      // reusing the gull meshes) outside the model.
      const replacedFx=(r:MeshRenderer)=>r.node.name==='env_lighthouse_beam_night_v22'||/^env_chimney_smoke_0[1-5]_v22$/.test(r.node.name)||/^env_anim_seagull_fly_0[12]_v22(_wing_[LR])?$/.test(r.node.name);
      if(v22.filter(replacedFx).length!==12)throw Error('Expected the authored beam bar, five chimney smoke balls and two flying gulls (body + 2 wings)');
      for(const r of v22)if(replacedFx(r))r.enabled=false;
      for(let i=v22Day.length-1;i>=0;i--)if(replacedFx(v22Day[i]))v22Day.splice(i,1);
      for(let i=v22Night.length-1;i>=0;i--)if(replacedFx(v22Night[i]))v22Night.splice(i,1);
      this.nightRenderers=v22Night;this.skyDomes=model.getComponentsInChildren(MeshRenderer).filter(r=>r.node.name==='env_sky_dome');
      const lightNode=director.getScene()?.getChildByName('Main Light');this.mainLight=lightNode?.getComponent(DirectionalLight)??null;
      if(this.mainLight){this.lightHome=this.mainLight.illuminance;this.lightHomeColor=this.mainLight.color.clone();}
      for(const r of model.getComponentsInChildren(MeshRenderer))if(!known.has(r)){if(['env_interior_floor_skirt_preview','character_height_reference_1p626'].includes(r.node.name))r.enabled=false;else throw Error('Unclassified renderer: '+r.node.name);}
      this.lighthouseTargets=[];for(const name of ['env_lighthouse_ext','env_lighthouse_door','env_interior_shell']){const entry=FIRSTSLICE.renderers.find(e=>e.name===name);const list=entry?renderers.get(entry.path):null;if(!list||list.length!==1)throw Error('Exact lighthouse tap mesh missing: '+name);this.lighthouseTargets.push(list[0]);}
      const rearGlass=renderers.get('scene_root/env_rear_window_glass');
      if(!rearGlass||rearGlass.length!==1)throw Error('Expected one exact rear-window glass renderer');
      this.releaseRearGlass=bindRearWindowAlpha(rearGlass[0]);
      const alphaNames=['env_interior_glass','env_lighthouse_beam_night_v22','env_lighthouse_lamp_glow_v22'];
      const alphaRenderers=model.getComponentsInChildren(MeshRenderer).filter(r=>alphaNames.includes(r.node.name));
      if(alphaRenderers.length!==3||new Set(alphaRenderers.map(r=>r.node.name)).size!==3)throw Error('Expected three authored island transparency renderers');
      for(const r of alphaRenderers)this.islandAlphaReleases.push(bindIslandSourceAlpha(r));
      const backdropNames=['env_sky_dome','env_cloud_layer','env_sea_foam','env_sea_surf_foam_v22','env_sea_wave_line_01_v22','env_sea_wave_line_02_v22'];
      const backdrops=model.getComponentsInChildren(MeshRenderer).filter(r=>backdropNames.includes(r.node.name));
      if(backdrops.length!==6||new Set(backdrops.map(r=>r.node.name)).size!==6)throw Error('Expected exact sky/cloud/shore-foam backdrops');
      for(const r of backdrops)this.unlitBackdrops.set(r,bindUnlitBackdrop(r));
      // The small window beside the door shows a painted unlit day-view card (env_window_views_1024), not the sky dome.
      // Tint it with the dome's night colour so every window follows day/night. Non-fatal: a mismatch keeps the day card.
      const viewCards=model.getComponentsInChildren(MeshRenderer).filter(r=>r.node.name==='env_window_blind_cards');
      if(viewCards.length!==1)console.warn('[OI_WINDOW_SKY] expected one env_window_blind_cards renderer, found',viewCards.length);
      else try{this.unlitBackdrops.set(viewCards[0],bindUnlitBackdrop(viewCards[0]));}catch(error){console.warn('[OI_WINDOW_SKY] window view card left in day colour',String(error));}
      const palm=renderers.get('env_rear_window_palm')?.[0] as any;
      console.info('[OI_REAR_PALM_BIND]',JSON.stringify({node:palm?.node.name,skeletonHash:palm?.skeleton?.hash,joints:palm?.skeleton?.joints?.length,expectedSourceSkeletonHash:4226273243,scope:'Skeleton binding only; native window visibility still requires visual check'}));
      // Runtime lighting is installed after source-renderer classification, never into imported GLB data.
      this.roomLighting=new RoomLightingRig(director.getScene()!,model,director.getScene()?.getChildByName('FLOW_REFERENCE_PLACEHOLDER_NOT_B')??null);
      this.doorSpill=new DoorSpillHint(director.getScene()!); // T2+ room home camera option 1: door light-spill hint
      this.atmosphere=new IslandAtmosphereFx(director.getScene()!); // scene FX: chimney smoke + lighthouse beam + gulls
      this.room360=new RoomShell360(model); // 场景特效bot r5 S2-2: two-sided shell, real shutter for the blind window, solid rear plant
      this.shore=new ShoreBreak(director.getScene()!,model); // same sea heaves on amb_waves_loop; beach lip only while the crest is on the sand; night is a colour multiply
      const camera=this.worldCamera!;
      // 0007 v1.2: adapter only. Pose (look-at authoring form) -> CameraPose -> applyCameraPose (the single camera writer).
      // A pose without fovVerticalDeg keeps the current fov (legacy route waypoints).
      const toCameraPose=(pose:Pose):CameraPose=>fromLookAt(pose,(globalThis as any).__QF_BALLOON_LENS&&pose.fovVerticalDeg?pose.fovVerticalDeg:camera.fov);
      const setCamera=(pose:Pose)=>{this.noteCinematic();this.roomLook.reset();this.islandRail?.reset();if((globalThis as any).__QF_BALLOON_LENS){camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=0.3;if(!(camera.far>=2500))camera.far=2500;}if(!applyCameraPose(camera,toCameraPose(pose),'world.setCamera'))console.error('[0007] stable camera pose rejected; camera unchanged',pose);};
      let alive=true;
      const assertStaticWorld=()=>{if(!alive)return;identity(this.node);identity(model);identity(sceneRoot);};
      const setDoor=(angle:number)=>{if(angle<0||angle>FIRSTSLICE.door.maxDeg)throw Error('Door angle outside contract');door.setRotationFromEuler(0,angle,0);};
      token.check();
      const writeLayers=(layers:Layers)=>{for(const entry of FIRSTSLICE.renderers)for(const r of renderers.get(entry.path)!)r.enabled=entry.name==='env_lighthouse_ext'?(layers.interior||layers.exterior):layers[entry.layer]||(entry.layer==='interior'&&!!layers.doorwayInterior&&DOORWAY_INTERIOR.has(entry.name));for(const r of v22Day)r.enabled=layers.exterior;this.exteriorVisible=layers.exterior;this.interiorVisible=layers.interior;this.backdropVisible=layers.backdrop;const paused=!layers.interior&&!layers.exterior&&!layers.backdrop;ambient.setHostPaused(paused);this.roomLighting?.setPaused(paused);this.applyDayNight();if(layers.interior)this.roomLighting?.setRoomLightWeight(1);this.room360?.syncLayers();};
      this.nodeWalkLayers=writeLayers;
      return {
        // The source tower mesh also owns the doorway lintel, jamb backing and threshold.
        // Keep the existing building envelope at home; the rear arch is cut through both shells.
        setLayers:writeLayers,
        // T5 room-light API (contract: render/RoomLightingRig.ts header). setLayers(interior) lands on w=1, setLayers(!interior) on w=0;
        // only these calls produce intermediate w. blendRoomLight is a cancellable job like animateDoor/animateCamera.
        setRoomLightWeight:(w:number)=>this.setRoomLightWeight(w),
        getRoomLightWeight:()=>this.getRoomLightWeight(),
        hasRoomLight:()=>this.hasRoomLight(),
        isWorldVisible:()=>this.isWorldVisible(),
        blendRoomLight:(from,to,seconds,t)=>this.run(seconds,t,p=>{this.roomLighting?.setRoomLightWeight(from+(to-from)*p);}),
        // R3 exterior key (RoomLightingRig "R3 exterior key"): same job clock; setView() entering/leaving resets it to 0.
        setExteriorKey:(k:number)=>!!this.roomLighting?.setExteriorKey(k),
        blendExteriorKey:(from,to,seconds,t)=>this.run(seconds,t,p=>{this.roomLighting?.setExteriorKey(from+(to-from)*p);}),
        setDoor,setCamera,assertStaticWorld,
        animateDoor:(from,to,seconds,t)=>this.run(seconds,t,p=>setDoor(from+(to-from)*p)),
        wait:(seconds,t)=>this.run(seconds,t,()=>{}),
        // v3.3 set-off fade: the shared black screen cover (registered by WorldIntegrationBoot); absent = no fade.
        get fadeCover(){return hasScreenCover()?(a:number,s:number)=>screenCover(a,s):undefined;},
        // 0007 v1.3: lerp position/target/fov + fromLookAt each sample (no slerp). A rejected sample aborts the track and
        // writes the end pose (see createCameraTrack); never continues silently.
        playEnterLevel:(token)=>{
          // Push in from the live island camera (including a finger pull). Not the exit arc.
          // WorldFlow calls this for every flow mode; a missing clock tick is still this run(), not a skipped shot.
          console.info('[enter-level] shot', this.flow?.snapshot().mode);
          this.noteCinematic();
          if(this.enterLevelHold){this.enterLevelHold=false;console.info('[enter-level] hold (lakeside landing on the board pose)');return this.run(ENTER_LEVEL_SHOT_S,token,()=>{});}
          let path:Pose[]|null=null;try{path=this.enterLevelLook();}catch(error){console.warn('enter-level shot skipped',String(error));}
          if(!path)return this.run(ENTER_LEVEL_SHOT_S,token,()=>{});
          const track=createCameraTrack(camera,path,'world.enterLevel',{easeIn:0.14,easeOut:0.4});
          return this.run(ENTER_LEVEL_SHOT_S,token,p=>{this.noteCinematic();track.tick(p);});
        },
        animateCamera:(path,seconds,t,options,progress,onSample)=>{const track=createCameraTrack(camera,path,'world.animateCamera',options);
          // walk-duration contract: follow the reported distance-travelled progress (smoothed, monotone), else time.
          // onSample (wind channel): eased key progress of each written sample.
          const tick=(v:number)=>{this.noteCinematic();const e=track.tick(v);if(onSample&&e>=0)onSample(e);};
          if(!progress)return this.run(seconds,t,tick);const follow=createProgressFollower(seconds,options?.followTauSeconds??0.25);return this.run(seconds,t,p=>tick(follow(p,progress())));},
        cancelTransient:()=>{this.cancelRoomLook();this.cancelJobs();},
        dispose:()=>{if(!alive)return;alive=false;this.cancelJobs();this.releaseRearGlass?.();this.releaseRearGlass=null;this.releaseUnlitBackdrops();this.releaseIslandAlpha();this.doorSpill?.dispose();this.doorSpill=null;this.atmosphere?.dispose();this.atmosphere=null;this.room360?.dispose();this.room360=null;this.shore?.dispose();this.shore=null;this.roomLighting?.dispose();this.roomLighting=null;if(this.worldAmbient===ambient)this.worldAmbient=null;model.destroy();if(this.ownedModel===model)this.ownedModel=null;},
      };
    } catch(e) {this.releaseRearGlass?.();this.releaseRearGlass=null;this.releaseUnlitBackdrops();this.releaseIslandAlpha();this.doorSpill?.dispose();this.doorSpill=null;this.atmosphere?.dispose();this.atmosphere=null;this.room360?.dispose();this.room360=null;this.shore?.dispose();this.shore=null;this.roomLighting?.dispose();this.roomLighting=null;this.worldAmbient=null;model.destroy();this.ownedModel=null;throw e;}
  }
  private run(seconds:number,token:Cancellation,tick:(p:number)=>void):Promise<void> {
    token.check();if(!Number.isFinite(seconds)||seconds<=0){tick(1);return Promise.resolve();}
    return new Promise<void>((resolve,reject)=>{
      const job:Job={elapsed:0,seconds,tick,resolve,reject,off:()=>{}};
      job.off=token.onCancel(()=>{this.jobs.delete(job);reject(new Cancelled());});this.jobs.add(job);try{tick(0);}catch(e){this.jobs.delete(job);job.off();reject(e instanceof Error?e:Error(String(e)));}
    });
  }
  private cancelJobs():void {for(const j of Array.from(this.jobs)){j.off();j.reject(new Cancelled());}this.jobs.clear();}
  /** 0007 v1.2 debug (read-only): __worldCamera.frameCheck(aspect?) projects the island character bbox for the CURRENT island pose. */
  private installCameraDebug():void {
    const self=this;
    (globalThis as any).__worldCamera={owner:this,
      writes:()=>({...cameraWriteLog}),
      sources:()=>({islandPoseSource:REGION_CAMERA.islandPoseSource,characterPoseSource:REGION_CAMERA.characterPoseSource,homePoseSource:REGION_CAMERA.homePoseSource,island:islandPoseEntry(),character:characterPoseEntry()}),
      frameCheck:(aspect?:number)=>{
        const c=REGION_CAMERA.islandCharacter,root:V3=[c.root[0],c.root[1],c.root[2]],pose=fromLookAt(islandPoseEntry());
        const box=characterBox(root,c.heightM,c.halfWidthM);
        const live=typeof window!=='undefined'&&window.innerHeight>0?window.innerWidth/window.innerHeight:undefined;
        return (aspect!==undefined?[aspect]:[live??.46,.46,.75]).map(a=>frameCheck(pose,a,box,REGION_CAMERA.frameLimits));
      },
      windStrength:()=>self.getWindStrength(),onWindStrength:(listener:(strength:number)=>void)=>self.onWindStrength(listener),
      liveFrameCheck:()=>{const last=cameraWriteLog.last;if(!last||!self.worldCamera)return null;const c=REGION_CAMERA.islandCharacter;
        const a=typeof window!=='undefined'&&window.innerHeight>0?window.innerWidth/window.innerHeight:.46;
        return {...frameCheck(last,a,characterBox([c.root[0],c.root[1],c.root[2]],c.heightM,c.halfWidthM),REGION_CAMERA.frameLimits),note:'LOG ONLY: last written pose + fixed box; not camera readback, not skinned bounds, not occlusion/HUD acceptance'};},
    };
    (globalThis as any).__worldDayNight={owner:this,snapshot:()=>self.dayNightSnapshot(),skyFollow:(target:readonly number[]|null,w:number,fade?:number)=>self.skyFollow(target,w,fade)/* r4-prep: lakeside journey blend */,reapply:()=>self.applyDayNight()/* build05-next r2: re-write the island look for the current mode without locking it (lakeside restore-on-leave) */,set:(mode:DayNightMode)=>self.setDayNight(mode,true),toggle:()=>self.toggleDayNight(),roomLighting:()=>self.roomLighting?.diagnostics()??null,roomLightWeight:()=>self.getRoomLightWeight(),exteriorKey:()=>self.roomLighting?.getExteriorKey()??0,windStrength:()=>self.getWindStrength(),hasRoomLight:()=>self.hasRoomLight(),isWorldVisible:()=>self.isWorldVisible()};
  }
  update(dt:number):void {
    if(!this.flow||this.disposed||this.safetyFailure)return;
    this.frameSerial++;const finger=this.orbitHeldTick;this.orbitHeldTick=false;
    this.clock.updates++;this.clock.lastTickUtc=new Date().toISOString();
    if(Number.isFinite(dt)&&dt>0){this.clock.rawSeconds+=dt;this.clock.maxDt=Math.max(this.clock.maxDt,dt);}
    try {identity(this.node);if(this.ownedModel){identity(this.ownedModel);identity(resolvePath(this.ownedModel,'scene_root'));}}
    catch(e){this.safetyFailure=String(e);this.flow.fault(this.safetyFailure);throw e;}
    const snap=this.flow.snapshot();
    if(snap.hidden&&snap.state!=='disposed'){this.hiddenTicks++;if(this.hiddenTicks>=2){this.hiddenTicks=0;this.revealReturn();}}
    else this.hiddenTicks=0;
    if(!Number.isFinite(dt)||dt<=0||this.flow.snapshot().needsResume)return;
    // Deliberately cap one update to avoid a background/long-frame teleport.
    const frameDt=Math.min(dt,.1);
    this.clock.appliedSeconds+=frameDt;
    if(this.nightOverride===null){this.dayNightClock+=frameDt;if(this.dayNightClock>=60){this.dayNightClock=0;const next:DayNightMode=localNight(new Date())?'night':'day';if(next!==this.dayNightMode)this.setDayNight(next,false);}}
    try {this.flow.advance(frameDt);}catch(e){this.safetyFailure=String(e);this.flow.fault(this.safetyFailure);throw e;}
    for(const j of Array.from(this.jobs)) {
      if(!this.jobs.has(j))continue;j.elapsed+=frameDt;
      try {j.tick(Math.min(1,j.elapsed/j.seconds));if(j.elapsed>=j.seconds){this.jobs.delete(j);j.off();j.resolve();}}
      catch(e){this.jobs.delete(j);j.off();j.reject(e instanceof Error?e:Error(String(e)));}
    }
    this.settleOrbit(frameDt,finger);
    this.applyDialogYield(frameDt);
    if(Date.now()-this.lastDiagnosticAt>=5000)this.reportRuntime('tick');
  }
  /** After a cinematic frame, ease back to the orbit the player left. Region walks own the lens while explore is on. */
  private settleOrbit(dt:number,finger:boolean){
    if(!finger){this.homeOrbit.release();this.islandOrbit.release();}
    if(exploreEnabled()||this.cinematicSerial===this.frameSerial||this.jobs.size>0)return;
    const state=this.flow?.snapshot().state;
    const place=state==='home'?'home':state==='island'?'island':null;if(!place)return;
    const orbit=place==='home'?this.homeOrbit:this.islandOrbit;
    /* paused + never engaged (arrival cinematic paused a fresh orbit) used to stay paused forever, so FreeOrbit.drag() refused every island drag; beginReturn() sends an unengaged orbit to idle */if(orbit.mode==='paused')orbit.beginReturn(this.readLivePose());
    if(!orbit.shouldWrite())return;
    orbit.step(dt);
    this.writeOrbit(orbit,place==='home'?this.homePivot():this.islandPivot(),place+'.orbit');
  }
  /** 运镜bot r5 dialog yield (DialogCameraYield.ts): a post-pass after every camera writer this frame. Pitches the lens down
   *  while setDialogCameraOpen(true) on short screens and eases back on close. It never moves the lens position. */
  private applyDialogYield(dt:number):void {
    const cam=this.worldCamera;if(!cam||!cam.node||!isValid(cam.node))return;
    const m=this.yieldMotion,fs=typeof window!=='undefined'&&window.innerHeight>0?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();
    const deg=dialogYieldPitchDeg(fs.width,fs.height),goal=dialogCameraOpen()&&deg>0?1:0;
    if(goal===0&&m.x<=0&&m.v===0&&m.goal===0){this.yieldBase=null;this.yieldLast=null;return;}
    const p=cam.node.worldPosition,q=cam.node.worldRotation,cur:CameraPose={position:[p.x,p.y,p.z],rotation:[q.x,q.y,q.z,q.w],fovVerticalDeg:cam.fov};
    const l=this.yieldLast,same=!!l&&Math.abs(l.position[0]-cur.position[0])+Math.abs(l.position[1]-cur.position[1])+Math.abs(l.position[2]-cur.position[2])<1e-5&&Math.abs(l.rotation[0]-cur.rotation[0])+Math.abs(l.rotation[1]-cur.rotation[1])+Math.abs(l.rotation[2]-cur.rotation[2])+Math.abs(l.rotation[3]-cur.rotation[3])<1e-5&&Math.abs(l.fovVerticalDeg-cur.fovVerticalDeg)<1e-4;
    if(!same||!this.yieldBase)this.yieldBase=cur;
    const x=stepYieldMotion(m,goal,dt,DIALOG_CAMERA_YIELD.seconds),pose=x>0?yieldPose(this.yieldBase,deg*x):this.yieldBase;
    if(applyCameraPose(cam,pose,'dialog.yield'))this.yieldLast=pose;else this.yieldLast=null;
  }
  /** T5 passthrough: see RoomLightingRig.setRoomLightWeight. false when no rig / not in an interior view. */
  setRoomLightWeight(weight:number):boolean {return !!this.roomLighting?.setRoomLightWeight(weight);}
  /** T5 read-only, poll per frame (no events): current w in [0,1]; 0 when no rig / not in an interior view. */
  getRoomLightWeight():number {return this.roomLighting?this.roomLighting.getRoomLightWeight():0;}
  /** T5 read-only: true while a live rig exists (world loaded, not disposed); then getRoomLightWeight() is meaningful. */
  hasRoomLight():boolean {return !this.disposed&&!!this.roomLighting&&this.roomLighting.hasRoomLight();}
  /** T5 read-only: true when the island/home world is on screen (last setLayers had interior or exterior). False under
   * levels/skycity/hidden, where the world stays loaded with layers NONE and w reads 0. A paused return (needsResume)
   * puts home/island layers back, so the room or island stays visible until resume(). */
  isWorldVisible():boolean {return this.hasRoomLight()&&(this.interiorVisible||this.exteriorVisible);}
  lateUpdate(dt:number):void {if(!this.disposed&&!this.safetyFailure){this.roomLighting?.advance(dt);this.doorSpill?.advance(dt);this.shore?.advance(dt);this.atmosphere?.advance(dt,this.worldCamera?.node??null,this.getWindStrength(),this.shore?.surfaceWorldY());}}
  private onHide():void {this.cancelRoomLook();this.worldAmbient?.setHostPaused(true);this.roomLighting?.setPaused(true);this.clock.hideEvents++;this.hiddenTicks=0;this.flow?.hide();this.reportRuntime('hide');}
  private onShow():void {this.revealReturn();this.scheduleReturn();}
  /** wx.onShow and EVENT_SHOW both land here. The place comes back paused; resume() stays explicit.
   *  A paused director is resumed so the return can paint. An error fault is left blank. */
  private revealReturn():void {
    if(this.disposed||!this.flow)return;
    const g=game as any;
    if(typeof g.isPaused==='function'&&g.isPaused()&&typeof g.resume==='function')g.resume();
    const snap=this.flow.snapshot();
    if(snap.state==='disposed'||snap.state==='error'||!snap.hidden)return;
    this.clock.showEvents++;
    if(this.nightOverride===null)this.setDayNight(localNight(new Date())?'night':'day',false);
    this.flow.show();this.syncHostPause();
    this.reportRuntime('show');
  }
  /** r4.1: onHide paused the island ambient clips and the room-light rig. A paused return re-applies them through
   *  setLayers; a frozen exit / walk home that resumed by itself keeps its layers, so un-pause them here from the
   *  layers on screen (same rule as setLayers). */
  private syncHostPause():void {
    const s=this.flow?.snapshot();if(!s||s.hidden||s.needsResume)return;
    const paused=!this.interiorVisible&&!this.exteriorVisible&&!this.backdropVisible;this.worldAmbient?.setHostPaused(paused);this.roomLighting?.setPaused(paused);
  }
  private scheduleReturn():void {
    if(this.returnTimer!=null||this.disposed)return;
    this.returnTimer=setTimeout(()=>{this.returnTimer=null;if(!this.disposed)this.revealReturn();},0);
  }
  /** WeChat lock often delivers wx.onHide/onShow without Game.EVENT_HIDE/EVENT_SHOW. Same handlers, idempotent. */
  private bindWxLifecycle():void {
    const w:any=(typeof wx!=='undefined')?(wx as any):null;
    if(!w)return;
    const pairs:[string,string,()=>void][]=[['onHide','offHide',()=>this.onHide()],['onShow','offShow',()=>this.onShow()]];
    for(let i=0;i<pairs.length;i++){
      const on=w[pairs[i][0]];
      if(typeof on!=='function')continue;
      const cb=pairs[i][2];
      try{on.call(w,cb);this.wxOff.push([pairs[i][1],cb]);}catch(error){console.warn('[OI_WORLD_FLOW] wx.'+pairs[i][0]+' failed',String(error));}
    }
  }
  private unbindWxLifecycle():void {
    const w:any=(typeof wx!=='undefined')?(wx as any):null;
    for(let i=0;i<this.wxOff.length;i++){
      const off=w&&w[this.wxOff[i][0]];
      try{if(typeof off==='function')off.call(w,this.wxOff[i][1]);}catch(error){void error;}
    }
    this.wxOff.length=0;
  }
  /** r4-prep: the island sky dome + cloud layer follow the lakeside journey sky (target = lakeside end clear sRGB bytes, w = blend
   *  weight); target null restores the island day/night look. Only the two existing instances' mainColor moves (no DC). Returns how
   *  many backdrops follow. */
  private skyFollow(target:readonly number[]|null,w:number,fade=1):number{let n=0;const f=target?fade:1;Array.from(this.unlitBackdrops.entries()).forEach(([r,b])=>{if(b.setFollow&&isValid(r,true)){try{if(b.setFollow(target,w,f))n++;}catch(error){console.warn('[QF_SKY] sky follow skipped',String(error));}}});
    /* r4-prep (C): the island-only gulls fade with the dome/clouds (lakeside has no gulls); target null → back to 1 */try{this.atmosphere?.setIslandFade(f);}catch{}return n;}
  /** Does not read or write WorldFlow state. Night meshes stay off until mode is night and the exterior layer is on. */
  private applyDayNight():void {
    const view=resolveDayNight(this.dayNightMode,this.exteriorVisible);this.appliedBlend=view.skyNightBlend;
    // Moon and halo belong to the sky backdrop, including views through the real indoor window.
    for(const r of this.nightRenderers)if(r.isValid)r.enabled=this.dayNightMode==='night'&&(r.node.name.startsWith('env_sky_')?this.backdropVisible:this.exteriorVisible);
    if(this.mainLight?.isValid){this.mainLight.illuminance=this.lightHome*view.lightScale;this.mainLight.color=new Color(view.lightColor[0],view.lightColor[1],view.lightColor[2],255);}
    const scene=director.getScene();
    const holdSky=(globalThis as any).__QF_BALLOON_HOLD_SKY as {night?:boolean}|false|undefined;
    if(scene)for(const sky of scene.getComponentsInChildren(SkyNightTexture)){if(holdSky){if(sky.skyRenderer?.isValid)sky.skyRenderer.enabled=false;continue;}sky.setNightBlend(view.skyNightBlend);if((sky as any).__qfNightOnly&&sky.skyRenderer?.isValid)sky.skyRenderer.enabled=view.skyNightBlend>0;} // N1: meadow night-only dome. Balloon transit keeps a single dome.
    for(const dome of this.skyDomes)if(dome.isValid&&!this.unlitBackdrops.has(dome)){if(holdSky){dome.enabled=!holdSky.night;if(dome.node)dome.node.active=!holdSky.night;}else writeNightBlend(dome.getMaterialInstance(0),view.skyNightBlend);}
    Array.from(this.unlitBackdrops.entries()).forEach(([r,b])=>{if(isValid(r,true))b.setNight(this.dayNightMode==='night');});
    this.roomLighting?.setView(this.interiorVisible,this.backdropVisible,this.dayNightMode==='night');
    this.doorSpill?.setView(this.interiorVisible,this.exteriorVisible,this.dayNightMode==='night');
    this.atmosphere?.setView(this.exteriorVisible,this.dayNightMode==='night');
    this.shore?.setView(this.exteriorVisible,this.backdropVisible,this.dayNightMode==='night');
    emitDayNightChange(this.dayNightMode); // build05-next r2: lakeside lighting re-applies its own day/night look on top
  }
  private dayNightSnapshot(){const view=resolveDayNight(this.dayNightMode,this.exteriorVisible);return {mode:this.dayNightMode,override:this.nightOverride,exteriorVisible:this.exteriorVisible,nightRenderersEnabled:view.nightRenderersEnabled,nightSkyBackdropsEnabled:this.dayNightMode==='night'&&this.backdropVisible,nightRendererCount:this.nightRenderers.length,skyNightBlend:this.appliedBlend,lightScale:view.lightScale};}
  private setDayNight(mode:DayNightMode,lock:boolean){if(mode!=='day'&&mode!=='night')return this.dayNightSnapshot();this.dayNightMode=mode;if(lock)this.nightOverride=mode==='night';this.applyDayNight();return this.dayNightSnapshot();}
  private toggleDayNight(){return this.setDayNight(this.dayNightMode==='night'?'day':'night',true);}
  onDisable():void {this.cancelRoomLook();this.worldAmbient?.setHostPaused(true);this.roomLighting?.setPaused(true);this.flow?.hide();}
  onEnable():void {if(this.flow){this.flow.show();this.syncHostPause();}} // remains paused (explicit resume) unless a frozen exit / walk home resumed
  onDestroy():void {
    if(this.returnTimer!=null){clearTimeout(this.returnTimer);this.returnTimer=null;}
    this.unbindWxLifecycle();
    this.flowEventsOff?.();this.flowEventsOff=null;this.doorShutOff?.();this.doorShutOff=null;this.settledListeners.clear();this.craneListeners.clear();this.doorShutListeners.clear();this.windOff?.();this.windOff=null;this.windStrength=0;this.windListeners.clear();
    if(this.disposed)return;this.disposed=true;this.lighthouseTargets=[];this.cancelRoomLook();game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);
    this.flow?.dispose();this.cancelJobs();this.releaseRearGlass?.();this.releaseRearGlass=null;this.releaseUnlitBackdrops();this.releaseIslandAlpha();this.doorSpill?.dispose();this.doorSpill=null;this.atmosphere?.dispose();this.atmosphere=null;this.room360?.dispose();this.room360=null;this.shore?.dispose();this.shore=null;this.roomLighting?.dispose();this.roomLighting=null;this.worldAmbient=null;this.ownedModel?.destroy();this.ownedModel=null;
    // The light belongs to the scene; a retry must capture the authored day baseline.
    if(this.mainLight?.isValid){this.mainLight.illuminance=this.lightHome;if(this.lightHomeColor)this.mainLight.color=this.lightHomeColor;}
    this.mainLight=null;this.lightHomeColor=null;
    if(this.worldCamera?.node.isValid&&this.savedCamera)applyCameraPose(this.worldCamera,this.savedCamera,'world.dispose-restore',{allowRoll:true});
    if((globalThis as any).__worldCamera?.owner===this)delete (globalThis as any).__worldCamera;
    if((globalThis as any).__worldDayNight?.owner===this)delete (globalThis as any).__worldDayNight;
    this.savedCamera=null;this.onStatus=undefined;
  }
}
declare const wx:any;
