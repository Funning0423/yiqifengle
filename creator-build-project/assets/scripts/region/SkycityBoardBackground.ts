import {bgCamWant,bgCamWarmOn} from './BgCamGate';
import {waitRegionAsset} from './RegionAssetDeadline';
import {Camera,Color,Node,Prefab,SphereLight,director,isValid} from 'cc';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {skycityVisitPose} from './SkycityVisitPose';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import {createSceneFade} from './BoardBackgroundFade';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {noteTransitionHeavyFrames,holdTransitionShaders} from './TransitionShaderWarm';
const SKY_BOARD_LAYER=1<<20; // Dedicated level-background layer, shared with the mutually exclusive meadow lease.
function setLayer(n:Node){n.layer=SKY_BOARD_LAYER;for(const child of n.children)setLayer(child);}
function find(n:Node,name:string):Node|null{if(n.name===name)return n;for(const child of n.children){const result=find(child,name);if(result)return result;}return null;}
/** Actual sky-city GLB behind mainline 09–12 and sky challenges. Own camera; never writes the world lens. */
export const createSkycityBoardBackground:LevelBackgroundFactory=async({parent,token})=>{
 let rig:Node|null=null,prefab:Prefab|null=null,camera:Camera|null=null,ambient:RegionAmbientAnimation|null=null,visible=false,paused=true,dead=false,held=false,primed=false,off=()=>{},holdLeft=0,holdOff:(()=>void)|null=null;
 const dispose=()=>{if(dead)return;dead=true;off();try{holdOff?.();}catch{}try{holdTransitionShaders(false);}catch{}if(camera&&isValid(camera,true))camera.enabled=false;if(rig&&isValid(rig,true)){rig.active=false;rig.destroy();}if(held)prefab?.decRef();rig=null;camera=null;ambient=null;};
 off=token.onCancel(dispose);
 try{
  token.check();const scene=director.getScene();if(!scene||!isValid(parent,true))throw Error('skycity-background-owner-missing');
  if(scene.getComponentsInChildren(Camera).some(c=>c.enabled&&(c.visibility&SKY_BOARD_LAYER)!==0))throw Error('skycity-background-layer-conflict');
  prefab=await waitRegionAsset(loadRegionPrefab(REGIONS.skycity),token);token.check();if(dead||!isValid(parent,true))throw Error('skycity-background-disposed');prefab.addRef();held=true;
  rig=new Node('SkycityLiveBackground');rig.active=false;parent.addChild(rig);const model=mountRegion(REGIONS.skycity,prefab,rig);setLayer(model);
  for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
  ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('skycity-background-ambient-missing');await waitRegionAsset(ambient.prepare(),token);token.check();
  const a=find(model,'anchor_spawn_girl'),b=find(model,'anchor_starcourt_center');if(!a||!b)throw Error('skycity-background-anchor-missing');
  const lightNode=new Node('SkycityBackgroundKey');lightNode.layer=SKY_BOARD_LAYER;rig.addChild(lightNode);lightNode.setPosition(-25,80,25);const light=lightNode.addComponent(SphereLight);light.visibility=SKY_BOARD_LAYER;light.color=new Color('#fff3da');light.range=260;light.size=30;light.luminance*=12;
  const node=new Node('SkycityBackgroundCamera');node.layer=SKY_BOARD_LAYER;rig.addChild(node);camera=node.addComponent(Camera);camera.projection=Camera.ProjectionType.PERSPECTIVE;camera.fovAxis=Camera.FOVAxis.VERTICAL;camera.near=.1;camera.far=1200;camera.visibility=SKY_BOARD_LAYER;camera.priority=44;camera.usePostProcess=false;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=new Color('#9ccadf');camera.enabled=false;
  const fade=createSceneFade(()=>rig,()=>camera,'skycity');
  const armHold=(n:number)=>{try{holdTransitionShaders(true);noteTransitionHeavyFrames(n);holdLeft=Math.max(holdLeft,n|0);if(!holdOff){const tick=()=>{if(holdLeft>0)holdLeft--;if(holdLeft<=0){const f=holdOff;holdOff=null;try{director.off('director_after_draw' as any,tick);}catch{}try{holdTransitionShaders(false);}catch{}try{f&&f();}catch{}}};holdOff=()=>{try{director.off('director_after_draw' as any,tick);}catch{};holdOff=null;};try{director.on('director_after_draw' as any,tick);}catch{holdOff=null;holdTransitionShaders(false);}};}catch{/* warm optional */}};
  return {
   setFade:a=>{if(!dead)fade(a);},
   /** Activate GLB early and force 2 board-cam draws so uploads leave the reveal/board-bg window. */
   primeScene:()=>{if(dead||primed||visible||!rig||!isValid(rig,true))return;primed=true;armHold(16);try{armTransitionHold(16);}catch{/* warm optional */}rig.active=true;ambient?.setHostPaused(true);
    if(camera&&isValid(camera,true)){try{const av=a.worldPosition,bv=b.worldPosition,pose=skycityVisitPose([av.x,av.y,av.z],[bv.x,bv.y,bv.z],9/16);applyCameraPose(camera,fromLookAt(pose),'skycity.board-background');bgCamWarmOn(camera);let left=2;const tick=()=>{if(--left>0)return;try{director.off('director_after_draw' as any,tick);}catch{}if(!visible&&camera&&isValid(camera,true)){camera.enabled=false;bgCamWant(camera,false);}};try{director.on('director_after_draw' as any,tick);}catch{if(!visible&&camera&&isValid(camera,true)){camera.enabled=false;bgCamWant(camera,false);}}}catch{/* prime draw optional */}}},
   frame:(_portrait,layout)=>{if(dead)return;token.check();if(!layout||!(layout.width>0&&layout.height>0))throw Error('skycity-background-layout-missing');try{if(visible)noteTransitionHeavyFrames(6);}catch{/* warm optional */}const av=a.worldPosition,bv=b.worldPosition,pose=skycityVisitPose([av.x,av.y,av.z],[bv.x,bv.y,bv.z],layout.width/layout.height);if(!applyCameraPose(camera!,fromLookAt(pose),'skycity.board-background'))throw Error('skycity-background-camera-rejected');},
   setVisible:value=>{if(dead)return;if(value){armHold(24);try{armTransitionHold(24);}catch{/* warm optional */}primed=true;}visible=value;rig!.active=value;bgCamWant(camera!,value);ambient?.setHostPaused(paused||!visible);},
   setPaused:value=>{if(dead)return;paused=value;ambient?.setHostPaused(paused||!visible);},
   diagnostics:()=>({renderer:'region-live-3d',region:'skycity',bundle:REGIONS.skycity.bundle,visible,paused,primed,layer:SKY_BOARD_LAYER,cameraPriority:44,dynamicTextureUploads:0}),dispose,
  };
 }catch(error){dispose();throw error;}
};
