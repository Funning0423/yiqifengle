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
 material:Material|null=null;sail:Node|null=null;light:SphereLight|null=null;
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
 }
 diagnostics(){return {seconds:this.seconds,paused:!this.running(),windmillLoopSeconds:MEADOW_SCENE_SOURCE.windmillSeconds,grassWaveSeconds:4,loops:this.loops.map(state=>({name:state.name,paused:!!state.isPaused,playing:!!state.isPlaying,wrapMode:state.wrapMode,repeatCount:state.repeatCount}))};}
 onDestroy(){game.off(Game.EVENT_HIDE,this.hide,this);game.off(Game.EVENT_SHOW,this.show,this);for(const state of this.loops)if(state.isPlaying)state.pause();this.loops=[];this.material=null;this.sail=null;this.light=null;}
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
  motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.sail=find(model,'windmill_sail_hub');motion.light=light;motion.bindLoops(loops);
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
