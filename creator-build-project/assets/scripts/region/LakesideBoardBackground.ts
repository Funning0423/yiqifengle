import {Animation,AssetManager,Camera,Color,JsonAsset,Node,Prefab,SphereLight,assetManager,director,instantiate,isValid} from 'cc';
import {waitRegionAsset} from './RegionAssetDeadline';
import {applyCameraPose} from '../world-r1/CameraPose';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {LAKESIDE_BUNDLE,LAKESIDE_TRANSFORMS,LAKESIDE_MODELS_DIR,LAKESIDE_LIGHTS,LAKESIDE_CLEAR_COLOR,LAKESIDE_BOARD_CAMERA,lakesideBoardPose,lakesideLightPosition,lakesideLightSrgb,lakesideSceneInstances,lakesidePrefabName,type LakesideInstance} from './LakesideSceneData';
/** Dedicated level-background layer, shared with the mutually exclusive meadow / sky-city leases (never two at once). */
export const LAKESIDE_LAYER=1<<20;
/** Scene node names (stable; 运镜bot's travel/landing camera hook and tests use them). */
export const LAKESIDE_NODES=Object.freeze({rig:'LakesideLiveScene',scenery:'LakesideScenery',camera:'LakesideBackgroundCamera',lights:'LakesideLights'});
function setLayer(n:Node){n.layer=LAKESIDE_LAYER;for(const c of n.children)setLayer(c);}
function loadBundle(name:string){return new Promise<AssetManager.Bundle>((ok,fail)=>assetManager.loadBundle(name,(e,b)=>e||!b?fail(e||Error('no bundle '+name)):ok(b)));}
function loadJson(b:AssetManager.Bundle,path:string){return new Promise<JsonAsset>((ok,fail)=>b.load(path,JsonAsset,(e,a)=>e||!a?fail(e||Error('lakeside transforms missing')):ok(a)));}
function loadPrefabs(b:AssetManager.Bundle){return new Promise<Prefab[]>((ok,fail)=>b.loadDir(LAKESIDE_MODELS_DIR,Prefab,(e,list)=>e?fail(e):ok(list||[])));}
/** Live r5h3 lakeside behind 风铃湖畔 challenge boards (camera priority 44, own camera and lights; never writes the world
 *  camera, saves or progression). Scene composition = scene_r5h_slim_transforms.json minus what the 2D board draws. */
export const createLakesideBoardBackground:LevelBackgroundFactory=async({parent,token})=>{
 let rig:Node|null=null,camera:Camera|null=null,visible=false,paused=true,dead=false,off=()=>{},instances=0;
 const held:Array<{decRef():unknown}>=[];
 const dispose=()=>{if(dead)return;dead=true;off();if(camera&&isValid(camera,true))camera.enabled=false;if(rig&&isValid(rig,true)){rig.active=false;rig.destroy();}rig=null;camera=null;for(const a of held.splice(0))a.decRef();};
 off=token.onCancel(dispose);
 const take=<T extends {addRef():unknown;decRef():unknown}>(a:T):T=>{if(dead)throw Error('lakeside-background-disposed');a.addRef();held.push(a);return a;};
 try{
  token.check();const scene=director.getScene();if(!scene||!isValid(parent,true))throw Error('lakeside-background-owner-missing');
  if(scene.getComponentsInChildren(Camera).some(c=>c.enabled&&(c.visibility&LAKESIDE_LAYER)!==0))throw Error('lakeside-background-layer-conflict');
  const bundle=await waitRegionAsset(loadBundle(LAKESIDE_BUNDLE),token);token.check();
  const json=take(await waitRegionAsset(loadJson(bundle,LAKESIDE_TRANSFORMS),token));token.check();
  const prefabs=await waitRegionAsset(loadPrefabs(bundle),token,30000);token.check();for(const p of prefabs)take(p);
  if(!isValid(parent,true)||!isValid(scene,true))throw Error('lakeside-background-owner-destroyed');
  const list=lakesideSceneInstances(((json.json as any)?.instances||[]) as LakesideInstance[]),byName=new Map(prefabs.map(p=>[p.name,p]));
  const missing=[...new Set(list.map(i=>lakesidePrefabName(i.glb)).filter(n=>!byName.has(n)))];if(missing.length)throw Error('lakeside-prefab-missing: '+missing.join(','));
  rig=new Node(LAKESIDE_NODES.rig);rig.active=false;rig.layer=LAKESIDE_LAYER;parent.addChild(rig);
  const scenery=new Node(LAKESIDE_NODES.scenery);rig.addChild(scenery);
  for(const i of list){const n=instantiate(byName.get(lakesidePrefabName(i.glb))!);n.name=i.name;n.setPosition(i.pos[0],i.pos[1],i.pos[2]);n.setRotation(i.rot_quat_xyzw[0],i.rot_quat_xyzw[1],i.rot_quat_xyzw[2],i.rot_quat_xyzw[3]);n.setScale(i.scale[0],i.scale[1],i.scale[2]);scenery.addChild(n);instances++;}
  for(const c of scenery.getComponentsInChildren(Camera))c.enabled=false;
  for(const a of scenery.getComponentsInChildren(Animation)){a.playOnLoad=false;a.enabled=false;}
  setLayer(scenery);
  const lights=new Node(LAKESIDE_NODES.lights);lights.layer=LAKESIDE_LAYER;rig.addChild(lights);
  for(const l of LAKESIDE_LIGHTS){if(l.onlyLayer)continue;const n=new Node('Lakeside_'+l.name);n.layer=LAKESIDE_LAYER;lights.addChild(n);const p=lakesideLightPosition(l);n.setPosition(p[0],p[1],p[2]);
   const s=n.addComponent(SphereLight),c=lakesideLightSrgb(l);s.color=new Color(c[0],c[1],c[2],255);s.range=600;s.size=30;s.luminance*=12*l.ratio;s.visibility=LAKESIDE_LAYER;}
  const cn=new Node(LAKESIDE_NODES.camera);cn.layer=LAKESIDE_LAYER;rig.addChild(cn);camera=cn.addComponent(Camera);
  camera.projection=Camera.ProjectionType.PERSPECTIVE;camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=LAKESIDE_BOARD_CAMERA.near;camera.far=LAKESIDE_BOARD_CAMERA.far;camera.visibility=LAKESIDE_LAYER;
  camera.priority=44;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color(LAKESIDE_CLEAR_COLOR);camera.enabled=false;
  return {
   frame:(_portrait,layout)=>{if(dead)return;token.check();if(!layout||!(layout.width>0&&layout.height>0))throw Error('lakeside-background-layout-missing');if(!applyCameraPose(camera!,lakesideBoardPose(layout.width/layout.height),'lakeside.board-background'))throw Error('lakeside-background-camera-rejected');},
   setVisible:value=>{if(dead)return;visible=value;rig!.active=value;camera!.enabled=value;},
   setPaused:value=>{if(dead)return;paused=value;},
   diagnostics:()=>({renderer:'region-live-3d',region:'lake',bundle:LAKESIDE_BUNDLE,instances,visible,paused,layer:LAKESIDE_LAYER,cameraPriority:44,nodes:LAKESIDE_NODES,dynamicTextureUploads:0}),
   dispose,
  };
 }catch(error){dispose();throw error;}
};
