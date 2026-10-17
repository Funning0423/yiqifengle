import { _decorator, Animation, Camera, Color, Component, EffectAsset, Material, MeshRenderer, Node, Prefab, SphereLight, Vec4, assetManager, director, game, Game, isValid, instantiate } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { MEADOW_SCENE_SOURCE, meadowScenePose } from './MeadowSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import { uiNightWeight } from '../ui/NightTint';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
import { Cancellation } from '../world-r1/WorldFlowCore';
import { SkyNightTexture } from '../render/SkyNightTexture';
import { onDayNightChange } from '../world-r1/DayNightContract';
import { hexToRgb, regionNightNow, writeRegionBoardClear } from './RegionBoardNight';
const {ccclass} = _decorator;
export const MEADOW_LAYER = 1 << 20;
function find(n:Node,name:string):Node|null { if(n.name===name)return n;for(const child of n.children){const hit=find(child,name);if(hit)return hit;}return null; }
function setLayer(n:Node) { n.layer=MEADOW_LAYER;for(const child of n.children)setLayer(child); }
function grassRenderer(r:MeshRenderer) { for(let n:Node|null=r.node;n;n=n.parent)if(n.name.startsWith('meadow_grass_instances.'))return true;return false; }
/** Imported palette material is shared by colour-bearing flowers and colourless
 * path/river/windmill meshes. A missing vertex colour defaults to black on GPU;
 * use a renderer-owned variant, preserving the authored texture and lighting. */
export function configureMeadowVertexColors(model:Node):string[] {
 const changed:string[]=[];
 for(const r of model.getComponentsInChildren(MeshRenderer)) {
  if(!r.mesh)continue;
  const hasColor=r.mesh.struct.vertexBundles.some(b=>b.attributes.some(a=>a.name==='a_color'));
  if(hasColor)continue;
  for(let i=0;i<r.sharedMaterials.length;i++) {
   const m=r.sharedMaterials[i];
   if(m?.passes.some(p=>p.defines.USE_VERTEX_COLOR)) {
    r.getMaterialInstance(i)?.recompileShaders({USE_VERTEX_COLOR:false});changed.push(r.node.name);
   }
  }
 }
 return changed;
}
export function loadWindEffect():Promise<EffectAsset> {
 const bundle=assetManager.getBundle(REGIONS.meadow.bundle);if(!bundle)return Promise.reject(Error('Meadow bundle missing'));
 return new Promise((ok,fail)=>bundle.load('meadow-grass-wind',EffectAsset,(error,effect)=>error||!effect?fail(error||Error('Meadow grass shader missing')):ok(effect)));
}
/** Preflight happens before exiting a saved result. Import/shader failures retain its rewards and retry action. */
export function validateModel(model:Node):MeshRenderer[] {
 for(const name of ['scene_root','player_spawn','windmill_sail_hub','wind_bell_frame_root','meadow_terrain','meadow_river'])if(!find(model,name))throw Error('Meadow anchor/mesh missing: '+name);
 const grass=model.getComponentsInChildren(MeshRenderer).filter(grassRenderer);if(grass.length!==5)throw Error('Meadow merged grass renderer count: '+grass.length);return grass;
}
export async function preflightMeadowScene():Promise<void> {
 const token=new Cancellation(),timer=setTimeout(()=>token.cancel(),12000);let model:Node|null=null,material:Material|null=null;
 try {
  const prefab=await token.wait(loadRegionPrefab(REGIONS.meadow));token.check();
  const effect=await token.wait(loadWindEffect());token.check();
  model=instantiate(prefab);model.active=false;validateModel(model);
  material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('Meadow wind material unavailable');
 }finally{clearTimeout(timer);model?.destroy();material?.destroy();}
}
/** Same sRGB tint WorldFlowComponent.bindUnlitBackdrop gives env_cloud_layer at night. */
export const MEADOW_CLOUD_NIGHT_TINT:readonly number[]=[.22,.28,.43];
export function meadowCloudColor(w:number):number[]{const t=Math.max(0,Math.min(1,w));return MEADOW_CLOUD_NIGHT_TINT.map(k=>1+(k-1)*t);}
/** N2b: lit ground (meadow_terrain, meadow_river_bank) uses builtin-standard and is lit mostly by ambient, so the dimmed
 *  main light barely moves it. Grade its albedo with the grass journey-night constant (linear 0.16/0.20/0.28, the world
 *  lightScale x moon colour); mainColor is an sRGB colour property, so the sRGB equivalent is written. */
export const MEADOW_NIGHT_LINEAR:readonly number[]=[.16,.20,.28];
const linToSrgb=(c:number)=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
export function meadowGroundFactor(w:number,f?:readonly number[]):number[]{const t=Math.max(0,Math.min(1,w));return f?f.map(k=>1+(k-1)*t):MEADOW_NIGHT_LINEAR.map(k=>1+(linToSrgb(k)-1)*t);}
/** N3: path, rainbow bridge and windmill read too bright at night; same mechanism, brightness x0.6 (sRGB) at full night. */
export const MEADOW_PROP_NIGHT:readonly number[]=[.6,.6,.6];
export function meadowGroundMaterials(nodes:Array<Node|null>,f?:readonly number[],shared=false):Array<{m:Material,base:number[],f?:readonly number[]}>{
 const out:Array<{m:Material,base:number[],f?:readonly number[]}>=[];
 for(const node of nodes)if(node)for(const r of node.getComponentsInChildren(MeshRenderer))for(let i=0;i<r.sharedMaterials.length;i++){
  const m=shared?r.getSharedMaterial(i):r.getMaterialInstance(i),h=m?.passes[0]?.getHandle('mainColor');if(!m||!h)continue;
  const v=new Vec4();m.passes[0].getUniform(h,v);const base=[v.x,v.y,v.z,v.w].map(x=>Number.isFinite(x)?x:1);
  // uniform readback is linear; store sRGB so writing it back is lossless.
  out.push({m,base:[linToSrgb(base[0]),linToSrgb(base[1]),linToSrgb(base[2]),base[3]],...(f?{f}:{})});
 }
 return out;
}
/** Collect builtin-unlit cloud material instances under `node` (instances, the shared glTF material stays untouched). */
export function meadowCloudMaterials(node:Node|null):Material[]{
 const out:Material[]=[];if(!node)return out;
 for(const r of node.getComponentsInChildren(MeshRenderer))for(let i=0;i<r.sharedMaterials.length;i++){const m=r.getMaterialInstance(i);if(m&&m.passes[0]?.getHandle('mainColor'))out.push(m);}
 return out;
}
@ccclass('MeadowSceneMotion')
export class MeadowSceneMotion extends Component {
 /** N2: journey mode (93-120 s night journey). Grass gets the world's lit-night grade (windParams.w=1) and the unlit
  *  meadow_clouds_near gets the env_cloud_layer night tint, both following uiNightWeight(). r4.2 item 9: the board background
  *  uses the same grade (it showed a daytime meadow at night after the swap); day is unchanged (weight 0 = factor 1). */
 journeyNight=false;
 /** r4.2 item 9: board only - the camera whose clear colour (the board sky) eases from dayClear to the journey's night sky. */
 boardCamera:Camera|null=null;dayClear:readonly number[]=[0x87,0xbf,0xc9];clouds:Material[]=[];grounds:Array<{m:Material,base:number[],f?:readonly number[]}>=[];
 material:Material|null=null;sail:Node|null=null;light:SphereLight|null=null;hostPaused=true;visible=false;
 private seconds=0;private hidden=false;
 onLoad(){game.on(Game.EVENT_HIDE,this.hide,this);game.on(Game.EVENT_SHOW,this.show,this);}
 private hide(){this.hidden=true;}private show(){this.hidden=false;}
 update(dt:number){
  if(this.visible&&!this.hostPaused&&!this.hidden&&Number.isFinite(dt)&&dt>0)this.seconds=(this.seconds+Math.min(dt,.1))%120;
  const night=uiNightWeight();
  if(this.sail&&isValid(this.sail,true))this.sail.setRotationFromEuler(0,0,(this.seconds%MEADOW_SCENE_SOURCE.windmillSeconds)*360/MEADOW_SCENE_SOURCE.windmillSeconds);
  this.material?.setProperty('windParams',new Vec4(this.seconds,1,night,this.journeyNight?1:0));
  if(this.journeyNight)for(const g of this.grounds){const k=meadowGroundFactor(night,g.f);g.m.setProperty('mainColor',new Vec4(g.base[0]*k[0],g.base[1]*k[1],g.base[2]*k[2],g.base[3]));}
  if(this.journeyNight)for(const m of this.clouds){const c=meadowCloudColor(night);m.setProperty('mainColor',new Vec4(c[0],c[1],c[2],1));}
  if(this.boardCamera&&isValid(this.boardCamera,true))writeRegionBoardClear(this.boardCamera,this.dayClear,night,(r,g,b)=>new Color(r,g,b,255));
 }
 diagnostics(){return {seconds:this.seconds,paused:this.hostPaused||this.hidden||!this.visible,windmillLoopSeconds:8,grassWaveSeconds:4};}
 onDestroy(){game.off(Game.EVENT_HIDE,this.hide,this);game.off(Game.EVENT_SHOW,this.show,this);this.material=null;this.sail=null;this.light=null;}
}
/** r4.2 item 9: the board's own meadow_sky_dome takes the night sky picture (not night-only: it stays this board's day sky). */
export function mountMeadowBoardNightSky(model:Node):SkyNightTexture|null{
 const dome=find(model,'meadow_sky_dome');const r=dome?dome.getComponentsInChildren(MeshRenderer)[0]:null;if(!dome||!r)return null;
 const sky=dome.getComponent(SkyNightTexture)||dome.addComponent(SkyNightTexture);sky.skyRenderer=r;sky.setNightBlend(1);return sky;}
/** The actual meadow model renders behind the board at camera priority 44.
 * No static picture/RenderTexture substitute, world-camera write, save or progression mutation.
 * Bit20 is excluded by the committed world camera masks; check again at runtime.
 */
export const createMeadowBoardBackground:LevelBackgroundFactory=async({parent,token})=>{
 let rig:Node|null=null,prefab:Prefab|null=null,effect:EffectAsset|null=null,material:Material|null=null,camera:Camera|null=null,motion:MeadowSceneMotion|null=null;
 const heldAssets:Array<{decRef():unknown}>=[];
 let disposed=false,visible=false,paused=true,offCancel=()=>{},offNight=()=>{},nightSky:SkyNightTexture|null=null;
 const dispose=()=>{
  if(disposed)return;disposed=true;offCancel();offNight();nightSky=null;
  if(camera&&isValid(camera,true))camera.enabled=false;
  if(rig&&isValid(rig,true)){rig.active=false;rig.destroy();}rig=null;camera=null;motion=null;
  material?.destroy();material=null;for(const asset of heldAssets.splice(0))asset.decRef();effect=null;prefab=null;
 };
 offCancel=token.onCancel(dispose);
 const waitAsset=async<T extends {addRef():unknown;decRef():unknown}>(pending:Promise<T>):Promise<T>=>{
  // Engine callbacks are not cancellable. Do not take ownership on a late completion.
  const asset=await token.wait(pending);token.check();if(disposed)throw Error('Meadow background disposed');asset.addRef();heldAssets.push(asset);return asset;
 };
 try{
  token.check();const scene=director.getScene();if(!scene||!isValid(parent,true))throw Error('Meadow scene owner missing');
  if(scene.getComponentsInChildren(Camera).some(c=>c.enabled&&(c.visibility&MEADOW_LAYER)!==0))throw Error('Meadow layer visible to an existing camera');
  prefab=await waitAsset(loadRegionPrefab(REGIONS.meadow));effect=await waitAsset(loadWindEffect());token.check();if(!isValid(parent,true)||!isValid(scene,true))throw Error('Meadow scene owner destroyed during load');
  rig=new Node('MeadowLiveScene');rig.active=false;parent.addChild(rig);
  const model=mountRegion(REGIONS.meadow,prefab,rig);setLayer(model);
  // The lease owns its camera and animation clock; imported cameras and autoplay
  // must not race that ownership when the prefab becomes active.
  for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
  for(const a of model.getComponentsInChildren(Animation)){a.playOnLoad=false;a.enabled=false;}
  const grass=validateModel(model);
  configureMeadowVertexColors(model);
  material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('Meadow wind material unavailable');
  for(const r of grass){for(let i=0;i<r.sharedMaterials.length;i++)r.setSharedMaterial(material,i);r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;}
  const lightNode=new Node('MeadowKeyLight');lightNode.layer=MEADOW_LAYER;rig.addChild(lightNode);lightNode.setPosition(-25,80,25);
  const light=lightNode.addComponent(SphereLight);light.color=new Color('#fff3da');light.range=260;light.size=30;light.luminance*=12;light.visibility=MEADOW_LAYER;
  const cameraNode=new Node('MeadowBackgroundCamera');cameraNode.layer=MEADOW_LAYER;rig.addChild(cameraNode);camera=cameraNode.addComponent(Camera);
  camera.projection=Camera.ProjectionType.PERSPECTIVE;camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=.1;camera.far=1000;camera.visibility=MEADOW_LAYER;
  camera.priority=44;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color('#87bfc9');camera.enabled=false;
  motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.sail=find(model,'windmill_sail_hub');motion.light=light;
  // r4.2 item 9: night honours the world mode like the journey copy (same grade lists, see RegionJourneyAdapter) and the board's own
  // meadow_sky_dome (kept on: it is this board's day sky) gets the night picture once the mode is night (SkyNightTexture, blend
  // driven by WorldFlowComponent.applyDayNight from then on; day output unchanged at blend 0). Clear colour eases in motion.update.
  motion.journeyNight=true;motion.clouds=meadowCloudMaterials(find(model,'meadow_clouds_near'));
  motion.grounds=meadowGroundMaterials([find(model,'meadow_terrain'),find(model,'meadow_river_bank')]);
  motion.grounds.push(...meadowGroundMaterials([find(model,'meadow_path'),find(model,'windmill_static_merged'),find(model,'windmill_sails')],MEADOW_PROP_NIGHT));
  motion.boardCamera=camera;motion.dayClear=hexToRgb('#87bfc9');
  const syncNight=()=>{if(disposed)return;const night=regionNightNow();if(night&&!nightSky)nightSky=mountMeadowBoardNightSky(model);if(nightSky&&isValid(nightSky,true))nightSky.setNightBlend(night?1:0);};
  syncNight();offNight=onDayNightChange(syncNight);
  rig.active=true;/* r4.2 items 10/11: the scene switches on with the (still hidden) board host, not on the swap frame; visibility = camera */
  return {
   frame:(_portrait,layout)=>{if(disposed)return;token.check();if(!camera||!isValid(camera,true)||!isValid(camera.node,true))throw Error('Meadow camera owner destroyed');if(!layout||!(layout.width>0&&layout.height>0))throw Error('Meadow requires current board layout');
    const pose=meadowScenePose(layout.width/layout.height);if(!applyCameraPose(camera!,fromLookAt(pose),'meadow.board-background'))throw Error('Meadow camera pose rejected');},
   setVisible:value=>{if(disposed)return;visible=value;camera!.enabled=value;motion!.visible=value;},
   setPaused:value=>{if(disposed)return;paused=value;motion!.hostPaused=value;},
   diagnostics:()=>({renderer:'region-live-3d',region:'meadow',bundle:REGIONS.meadow.bundle,prefabName:REGIONS.meadow.prefabName,source:MEADOW_SCENE_SOURCE,visible,paused,cameraPriority:44,layer:MEADOW_LAYER,motion:motion?.diagnostics()||null,dynamicTextureUploads:0}),
   dispose,
  };
 }catch(error){dispose();throw error;}
};
