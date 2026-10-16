import { _decorator, Animation, AnimationClip, Camera, Color, Component, EffectAsset, Material, MeshRenderer, Node, Prefab, SphereLight, Vec4, assetManager, director, game, Game, isValid, instantiate, type AnimationState } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { MEADOW_SCENE_SOURCE, meadowScenePose } from './MeadowSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import { uiNightWeight } from '../ui/NightTint';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
import { Cancellation } from '../world-r1/WorldFlowCore';
const {ccclass} = _decorator;
export const MEADOW_LAYER = 1 << 20;
/** Clip names on the meadow GLB. v7.2 may replace textures and the flower mesh; these names stay. */
export const MEADOW_LOOP_CLIPS = ['windmill_sails_loop','meadow_butterflies_loop','meadow_birds_loop','windmill_flag_loop'] as const;
function find(n:Node,name:string):Node|null { if(n.name===name)return n;for(const child of n.children){const hit=find(child,name);if(hit)return hit;}return null; }
function setLayer(n:Node) { n.layer=MEADOW_LAYER;for(const child of n.children)setLayer(child); }
function grassRenderer(r:MeshRenderer) { for(let n:Node|null=r.node;n;n=n.parent)if(n.name.startsWith('meadow_grass_instances.'))return true;return false; }
/** Island unlit night multipliers (env_sky_dome / env_cloud_layer). Authored day colour is 1. */
export const MEADOW_SKY_NIGHT: readonly [number, number, number] = [0.18, 0.24, 0.46];
export const MEADOW_CLOUD_NIGHT: readonly [number, number, number] = [0.22, 0.28, 0.43];
const DAY_CLEAR: readonly [number, number, number] = [0x87, 0xbf, 0xc9];
const NIGHT_CLEAR: readonly [number, number, number] = [0x2e, 0x3d, 0x75];
function clamp01(w:number){return w<0?0:w>1?1:w;}
export function meadowNightChannels(day:readonly number[], night:readonly number[], w:number):[number,number,number]{
 const t=clamp01(w);if(t===0)return [day[0],day[1],day[2]];if(t===1)return [night[0],night[1],night[2]];return [day[0]+(night[0]-day[0])*t, day[1]+(night[1]-day[1])*t, day[2]+(night[2]-day[2])*t];
}
function hasVertexColor(r:MeshRenderer){
 const bundles=r.mesh?.struct?.vertexBundles;if(!bundles)return false;
 for(const bundle of bundles)for(const attribute of bundle.attributes)if(attribute.name==='a_color')return true;
 return false;
}
/** Windmill tower, cottage and sails share M_meadow_palette. Grass uses the wind shader.
 *  Both multiply by the sky night colour with the same 0..1 weight. Day (weight 0) stays (1,1,1). */
const NIGHT_STRUCTURE_PREFIX='windmill_';
export function bindMeadowNightStructures(model:Node):Material[]{
 const out:Material[]=[];
 for(const r of model.getComponentsInChildren(MeshRenderer)){
  if(!r.node.name.startsWith(NIGHT_STRUCTURE_PREFIX))continue;
  const slots=r.sharedMaterials.length||1;
  for(let i=0;i<slots;i++){const material=r.getMaterialInstance(i);if(material)out.push(material);}
 }
 return out;
}
/** builtin-unlit outputs mainColor * vertex colour only when USE_VERTEX_COLOR is on.
 *  M_meadow_cloud is unlit, has COLOR_0 and no texture, so the instance must keep that define.
 *  M_meadow_sky is unlit with a day panorama (factor 1); mainColor multiplies the texture.
 *  Missing nodes are skipped. Names stay meadow_sky_dome / meadow_clouds_near. */
export function bindMeadowNightSurfaces(model:Node):{sky:Material|null;cloud:Material|null}{
 const take=(name:string,keepVertexColor:boolean):Material|null=>{
  const renderer=find(model,name)?.getComponent(MeshRenderer)??null;if(!renderer)return null;
  const material=renderer.getMaterialInstance(0);if(!material)return null;
  if(keepVertexColor&&hasVertexColor(renderer))material.recompileShaders({USE_VERTEX_COLOR:true});
  return material;
 };
 return {sky:take('meadow_sky_dome',false),cloud:take('meadow_clouds_near',true)};
}
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
function loadWindEffect():Promise<EffectAsset> {
 const bundle=assetManager.getBundle(REGIONS.meadow.bundle);if(!bundle)return Promise.reject(Error('Meadow bundle missing'));
 return new Promise((ok,fail)=>bundle.load('meadow-grass-wind',EffectAsset,(error,effect)=>error||!effect?fail(error||Error('Meadow grass shader missing')):ok(effect)));
}
/** Preflight happens before exiting a saved result. Import/shader failures retain its rewards and retry action. */
function meadowAnimations(model:Node):Animation[] { return model.getComponentsInChildren(Animation); }
function requireMeadowLoops(model:Node):void {
 const anims=meadowAnimations(model);
 for(const name of MEADOW_LOOP_CLIPS)if(!anims.some(anim=>(anim.clips||[]).some(clip=>clip?.name===name)))throw Error('Meadow loop clip missing: '+name);
}
/** Loop the sail, butterfly, bird and flag clips together. Imported autoplay stays off.
 * Concurrent clips on one component use real-time playback when the importer exposes it. */
function startMeadowLoops(model:Node):AnimationState[] {
 const anims=meadowAnimations(model);
 for(const anim of anims){anim.playOnLoad=false;anim.enabled=false;}
 return MEADOW_LOOP_CLIPS.map(name=>{
  for(const anim of anims){
   const clip=(anim.clips||[]).find((item):item is AnimationClip=>!!item&&item.name===name);
   if(!clip)continue;
   anim.enabled=true;
   if('useBakedAnimation' in anim)(anim as Animation&{useBakedAnimation:boolean}).useBakedAnimation=false;
   const state=anim.getState(name)||anim.createState(clip);
   if(!state)throw Error('Meadow loop state missing: '+name);
   state.wrapMode=AnimationClip.WrapMode.Loop;state.repeatCount=Infinity;state.play();state.pause();
   return state;
  }
  throw Error('Meadow loop clip missing: '+name);
 });
}
function validateModel(model:Node):MeshRenderer[] {
 for(const name of ['scene_root','player_spawn','windmill_sail_hub','wind_bell_frame_root','meadow_terrain','meadow_river'])if(!find(model,name))throw Error('Meadow anchor/mesh missing: '+name);
 requireMeadowLoops(model);
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
@ccclass('MeadowSceneMotion')
export class MeadowSceneMotion extends Component {
 material:Material|null=null;skyMaterial:Material|null=null;cloudMaterial:Material|null=null;structureMaterials:Material[]=[];viewCamera:Camera|null=null;sail:Node|null=null;light:SphereLight|null=null;
 private _hostPaused=true;private _visible=false;
 private seconds=0;private hidden=false;private loops:AnimationState[]=[];
 get hostPaused(){return this._hostPaused;}set hostPaused(value:boolean){this._hostPaused=value;this.syncLoops();}
 get visible(){return this._visible;}set visible(value:boolean){this._visible=value;this.syncLoops();}
 /** The four GLB loops share this gate with the grass clock: explicit pause, hide, and background. */
 bindLoops(states:AnimationState[]){this.loops=states;this.syncLoops();}
 onLoad(){game.on(Game.EVENT_HIDE,this.hide,this);game.on(Game.EVENT_SHOW,this.show,this);}
 private hide(){this.hidden=true;this.syncLoops();}private show(){this.hidden=false;this.syncLoops();}
 private running(){return this.visible&&!this.hostPaused&&!this.hidden;}
 private syncLoops(){
  const run=this.running();
  for(const state of this.loops){
   if(run){if(!state.isPlaying)state.play();else if(state.isPaused)state.resume();}
   else if(state.isPlaying&&!state.isPaused)state.pause();
  }
 }
 update(dt:number){
  if(this.running()&&Number.isFinite(dt)&&dt>0)this.seconds=(this.seconds+Math.min(dt,.1))%120;
  this.syncLoops();
  const night=uiNightWeight();
  // windmill_sails_loop owns windmill_sail_hub. Writing Euler here would replace the clip.
  this.material?.setProperty('windParams',new Vec4(this.seconds,1,night,0));
  // Day/night follows the world clock even while the loops are paused.
  // Weight 0 (day, including the first sample) is exactly (1,1,1): the cloud GLB stores
  // sRGB COLOR_0 because builtin-unlit runs SRGBToLinear, so a leftover tint would grey it.
  const sky=meadowNightChannels([1,1,1],MEADOW_SKY_NIGHT,night),cloud=meadowNightChannels([1,1,1],MEADOW_CLOUD_NIGHT,night);
  this.skyMaterial?.setProperty('mainColor',new Vec4(sky[0],sky[1],sky[2],1));
  this.cloudMaterial?.setProperty('mainColor',new Vec4(cloud[0],cloud[1],cloud[2],1));
  const structure=meadowNightChannels([1,1,1],MEADOW_SKY_NIGHT,night);
  for(const material of this.structureMaterials)material.setProperty('mainColor',new Vec4(structure[0],structure[1],structure[2],1));
  if(this.viewCamera){const rgb=meadowNightChannels(DAY_CLEAR,NIGHT_CLEAR,night);this.viewCamera.clearColor=new Color(Math.round(rgb[0]),Math.round(rgb[1]),Math.round(rgb[2]),255);}
 }
 diagnostics(){return {seconds:this.seconds,paused:!this.running(),windmillLoopSeconds:MEADOW_SCENE_SOURCE.windmillSeconds,grassWaveSeconds:4,loops:this.loops.map(state=>({name:state.name,paused:!!state.isPaused,playing:!!state.isPlaying,wrapMode:state.wrapMode,repeatCount:state.repeatCount}))};}
 onDestroy(){game.off(Game.EVENT_HIDE,this.hide,this);game.off(Game.EVENT_SHOW,this.show,this);for(const state of this.loops)if(state.isPlaying)state.pause();this.loops=[];this.material=null;this.skyMaterial=null;this.cloudMaterial=null;this.structureMaterials=[];this.viewCamera=null;this.sail=null;this.light=null;}
}
/** The actual meadow model renders behind the board at camera priority 44.
 * No static picture/RenderTexture substitute, world-camera write, save or progression mutation.
 * Bit20 is excluded by the committed world camera masks; check again at runtime.
 */
export const createMeadowBoardBackground:LevelBackgroundFactory=async({parent,token})=>{
 let rig:Node|null=null,prefab:Prefab|null=null,effect:EffectAsset|null=null,material:Material|null=null,camera:Camera|null=null,motion:MeadowSceneMotion|null=null;
 const heldAssets:Array<{decRef():unknown}>=[];
 let disposed=false,visible=false,paused=true,offCancel=()=>{};
 const dispose=()=>{
  if(disposed)return;disposed=true;offCancel();
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
  const grass=validateModel(model);
  const loops=startMeadowLoops(model);
  configureMeadowVertexColors(model);
  material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('Meadow wind material unavailable');
  for(const r of grass){for(let i=0;i<r.sharedMaterials.length;i++)r.setSharedMaterial(material,i);r.shadowCastingMode=MeshRenderer.ShadowCastingMode.OFF;}
  const lightNode=new Node('MeadowKeyLight');lightNode.layer=MEADOW_LAYER;rig.addChild(lightNode);lightNode.setPosition(-25,80,25);
  const light=lightNode.addComponent(SphereLight);light.color=new Color('#fff3da');light.range=260;light.size=30;light.luminance*=12;light.visibility=MEADOW_LAYER;
  const cameraNode=new Node('MeadowBackgroundCamera');cameraNode.layer=MEADOW_LAYER;rig.addChild(cameraNode);camera=cameraNode.addComponent(Camera);
  camera.projection=Camera.ProjectionType.PERSPECTIVE;camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=.1;camera.far=1000;camera.visibility=MEADOW_LAYER;
  camera.priority=44;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color('#87bfc9');camera.enabled=false;
  const nightSurfaces=bindMeadowNightSurfaces(model);
  motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.skyMaterial=nightSurfaces.sky;motion.cloudMaterial=nightSurfaces.cloud;motion.structureMaterials=bindMeadowNightStructures(model);motion.viewCamera=camera;motion.sail=find(model,'windmill_sail_hub');motion.light=light;motion.bindLoops(loops);
  return {
   frame:(_portrait,layout)=>{if(disposed)return;token.check();if(!camera||!isValid(camera,true)||!isValid(camera.node,true))throw Error('Meadow camera owner destroyed');if(!layout||!(layout.width>0&&layout.height>0))throw Error('Meadow requires current board layout');
    const pose=meadowScenePose(layout.width/layout.height);if(!applyCameraPose(camera!,fromLookAt(pose),'meadow.board-background'))throw Error('Meadow camera pose rejected');},
   setVisible:value=>{if(disposed)return;visible=value;rig!.active=value;camera!.enabled=value;motion!.visible=value;},
   setPaused:value=>{if(disposed)return;paused=value;motion!.hostPaused=value;if(visible&&camera&&isValid(camera,true))camera.enabled=true;},
   diagnostics:()=>({renderer:'region-live-3d',region:'meadow',bundle:REGIONS.meadow.bundle,prefabName:REGIONS.meadow.prefabName,source:MEADOW_SCENE_SOURCE,visible,paused,cameraPriority:44,layer:MEADOW_LAYER,motion:motion?.diagnostics()||null,dynamicTextureUploads:0}),
   dispose,
  };
 }catch(error){dispose();throw error;}
};
