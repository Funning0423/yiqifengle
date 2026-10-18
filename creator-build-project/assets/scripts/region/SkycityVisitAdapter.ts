import {Camera,Node,Vec3,isValid,view} from 'cc';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {SkycityRobotInteract} from './SkycityRobotInteract';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import {Cancelled,type RegionVisitAdapter,type RegionVisitLease} from '../world-r1/WorldFlowCore';
import {skycityVisitPose} from './SkycityVisitPose';
import {applySkycityBrokenBridge} from './SkycityBridgeState';
/** Existing bundled scene, normal navigation. Does not access progress, rewards or storage. */
export function createSkycityVisitAdapter(options:{parent:Node;camera:Camera;snapshot:()=>{state:string;hidden:boolean;needsResume:boolean}}):RegionVisitAdapter {
  return {async enter(token){
    token.check();
    const prefab=await token.wait(loadRegionPrefab(REGIONS.skycity));token.check();
    if(!isValid(options.parent,true)||!isValid(options.camera.node,true))throw new Cancelled();
    let model:Node|null=null,disposed=false,visible=false;let offCancel=()=>{};let listening=false;
    const release=()=>{if(disposed)return;disposed=true;visible=false;offCancel();if(listening){view.off('canvas-resize',refresh);listening=false;}if(model&&isValid(model,true)){model.active=false;model.destroy();}model=null;};
    let a:Node|null=null,b:Node|null=null;
    const refresh=()=>{
      if(!visible||disposed||!model||!isValid(model,true)||!isValid(options.camera.node,true)||!a||!b)return;
      const frame=view.getFrameSize(),aspect=frame.width/Math.max(1,frame.height);
      const av=a.worldPosition,bv=b.worldPosition;
      const pose=skycityVisitPose([av.x,av.y,av.z],[bv.x,bv.y,bv.z],aspect);
      if(!applyCameraPose(options.camera,fromLookAt(pose),'skycity.normal-visit'))throw Error('Skycity camera rejected');
    };
    try{
      model=mountRegion(REGIONS.skycity,prefab,options.parent);model.name='SkycityNormalVisit';model.active=false;applySkycityBrokenBridge(model);
      offCancel=token.onCancel(release);token.check();
      const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('Skycity ambient component missing');
      await token.wait(ambient.prepare());token.check();
      if(!model||!isValid(model,true)||!isValid(options.parent,true))throw new Cancelled();
      const find=(n:Node,name:string):Node|null=>{if(n.name===name)return n;for(const child of n.children){const hit=find(child,name);if(hit)return hit;}return null;};
      a=find(model,'anchor_robot_interact');b=find(model,'anchor_starcourt_center');
      if(!a||!b||!Number.isFinite(Vec3.distance(a.worldPosition,b.worldPosition)))throw Error('Skycity interaction anchors missing');
      const robot=model.getComponent(SkycityRobotInteract);if(!robot)throw Error('Skycity interaction component missing');
      robot.bindInteractionContext(()=>({...options.snapshot(),regionVisit:true}));
      view.on('canvas-resize',refresh);listening=true;
      // Once the lease is accepted the flow owns its lifecycle; token cancellation
      // still cleans up a load cancelled before that handoff.
      const lease:RegionVisitLease={
        show(){if(disposed||!model||!isValid(model,true)||!isValid(options.parent,true)||!isValid(options.camera.node,true))throw Error('Skycity visit owner destroyed');applySkycityBrokenBridge(model);visible=true;model.active=true;refresh();},
        hide(){visible=false;if(model&&isValid(model,true))model.active=false;},
        dispose:release,
      };
      return lease;
    }catch(error){release();throw error;}
  }};
}
