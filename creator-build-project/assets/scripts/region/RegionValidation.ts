import {Component,Camera,Vec3,Node,director,isValid,sys} from 'cc';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {SkycityRobotInteract} from './SkycityRobotInteract';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
/** Existing diagnostic scene only. No reward/progression or gameplay command mailbox. */
export async function validateSkycity(owner:Component){
 try {
  const prefab=await loadRegionPrefab(REGIONS.skycity);if(!isValid(owner.node,true))return;
  const scene=director.getScene()!,model=mountRegion(REGIONS.skycity,prefab,scene);model.name='OI_VALIDATION_SKYCITY';
  const ambient=model.getComponent(RegionAmbientAnimation)!;await ambient.prepare();if(!isValid(owner.node,true))return;
  scene.getChildByName('IsolatedWorldComposition')!.active=false;scene.getChildByName('FLOW_REFERENCE_PLACEHOLDER_NOT_B')!.active=false;
  const ui=owner.node.getChildByName('WorldNavigationCanvas');if(ui)ui.active=false;
  model.getComponent(SkycityRobotInteract)!.bindInteractionContext(()=>({state:'island',hidden:!owner.node.activeInHierarchy}));
  const find=(n:Node,name:string):Node|null=>n.name===name?n:n.children.map(c=>find(c,name)).find(Boolean)||null;
  const anchors=['anchor_robot_interact','anchor_starcourt_center'].map(name=>find(model,name));
  if(anchors.some(n=>!n))throw Error('Required diagnostic robot anchors missing');
  const a=anchors[0]!.worldPosition,b=anchors[1]!.worldPosition,span=Math.max(Vec3.distance(a,b),8);
  const center:[number,number,number]=[(a.x+b.x)/2,(a.y+b.y)/2+1,(a.z+b.z)/2];
  const camera=scene.getComponentsInChildren(Camera).find(c=>c.node.name!=='WorldNavigationCamera')!;
  if(!applyCameraPose(camera,fromLookAt({position:[center[0]+span*.3,center[1]+span*.55,center[2]+span*1.3],target:center,fovVerticalDeg:55}),'diagnostic-robot-anchors'))throw Error('Diagnostic camera rejected');
  const capture=()=>{
   if(!isValid(owner.node,true)||!isValid(model,true))return;
   const states=ambient.diagnosticsAll();
   const data={input:model.getComponent(SkycityRobotInteract)?.inputDiagnostics(),utc:new Date().toISOString(),scope:'ISOLATED_DIAGNOSTIC_SCENE_NOT_PRODUCTION_ENTRY',model:model.name,states,gesture:ambient.gestureState(),events:ambient.gestureEvents(),anchors:anchors.map(n=>{const screen=camera.worldToScreen(n!.worldPosition);return {name:n!.name,world:[n!.worldPosition.x,n!.worldPosition.y,n!.worldPosition.z],screen:[screen.x,screen.y,screen.z]};}),screen:{width:camera.camera.width,height:camera.camera.height}};
   sys.localStorage.setItem('dot-runtime-diagnostics-20261010:skycity',JSON.stringify(data));
  };
  capture();owner.schedule(capture,.25);console.info('OI_VALIDATION_SKYCITY_READY');
 }catch(e){console.error('OI_VALIDATION_FAILED',String(e));}
}
