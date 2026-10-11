import { _decorator, Component, Prefab, instantiate, Camera, Vec3, MeshRenderer, Node, game, Game } from 'cc';
import { WorldFlow, Cancellation, Cancelled, interpolate } from './WorldFlowCore';
import type { CharacterAdapter, LevelAdapter, WorldLease, Layers, Pose, Mode, Snapshot } from './WorldFlowCore';
import { CHARACTER_REFERENCE } from './CharacterReference';
import { FIRSTSLICE } from './FirstsliceFacts';
import { createFirstsliceRoutes } from './FirstsliceRoutes';
const {ccclass,property}=_decorator;
type Job={elapsed:number;seconds:number;tick:(t:number)=>void;resolve:()=>void;reject:(e:Error)=>void;off:()=>void};
function resolvePath(root:Node,path:string):Node {
  let node:Node|null=root;for(const part of path.split('/'))node=node?.getChildByName(part)??null;
  if(!node)throw Error('Missing exact imported node path: '+path);return node;
}
function identity(node:Node):void {
  const p=node.worldPosition,r=node.worldRotation,s=node.worldScale;
  if(Math.hypot(p.x,p.y,p.z)>1e-5||Math.hypot(r.x,r.y,r.z)>1e-5||Math.abs(Math.abs(r.w)-1)>1e-5||Math.hypot(s.x-1,s.y-1,s.z-1)>1e-5)
    throw Error('World root must stay identity in metre space: '+node.name);
}
function descendant(child:Node,parent:Node):boolean {for(let n:Node|null=child;n;n=n.parent)if(n===parent)return true;return false;}
/** Add to a NEW, identity scene-root sibling. Do not add to a Camera, Canvas or imported model. */
@ccclass('WorldFlowComponent')
export class WorldFlowComponent extends Component {
  @property(Prefab) firstsliceModel:Prefab|null=null;
  @property(Camera) worldCamera:Camera|null=null;
  private flow:WorldFlow|null=null;
  private jobs=new Set<Job>();
  private ownedModel:Node|null=null;
  private disposed=false;
  private safetyFailure:string|null=null;
  private onStatus:((status:Snapshot)=>void)|undefined;
  private savedCamera:{position:Vec3;rotation:any}|null=null;
  /** Called once by a composition root, after real adapters are ready. Character may be omitted for scene inspection. */
  async initialize(levels:LevelAdapter,character?:CharacterAdapter,mode:Mode='fixed',onStatus?:(s:Snapshot)=>void) {
    if(this.flow||this.disposed)throw Error('WorldFlowComponent already initialized/disposed');
    if(!this.firstsliceModel||!this.worldCamera)throw Error('Bind imported combined prefab and dedicated WorldCamera');
    identity(this.node);
    if(descendant(this.node,this.worldCamera.node)||descendant(this.worldCamera.node,this.node))throw Error('Camera and world owner must be independent siblings');
    this.onStatus=onStatus;
    const cam=this.worldCamera.node;this.savedCamera={position:cam.worldPosition.clone(),rotation:cam.worldRotation.clone()};
    this.flow=new WorldFlow({config:createFirstsliceRoutes(FIRSTSLICE,CHARACTER_REFERENCE),mode,levels,character,onChange:onStatus,loadWorld:t=>this.createWorld(t)});
    game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);
    return this.flow.load();
  }
  /** UI receives this command facade, never scene/model/camera references. */
  commands() {
    const flow=()=>{if(!this.flow)throw Error('World not initialized');return this.flow;};
    return Object.freeze({snapshot:()=>flow().snapshot(),leaveHome:()=>flow().leaveHome(),returnHome:()=>flow().returnHome(),
      enterLevel:(id:string)=>flow().enterLevel(id),exitLevel:()=>flow().exitLevel(),resume:()=>flow().resume(),
      cancelTransition:()=>flow().cancelTransition(),setMode:(m:Mode)=>flow().setMode(m)});
  }
  bindCharacter(adapter:CharacterAdapter) {if(!this.flow)throw Error('World not initialized');return this.flow.bindCharacter(adapter);}
  private async createWorld(token:Cancellation):Promise<WorldLease> {
    token.check();const model=instantiate(this.firstsliceModel!);this.ownedModel=model;this.node.addChild(model);
    try {
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
      for(const r of model.getComponentsInChildren(MeshRenderer))if(!known.has(r))throw Error('Unclassified renderer: '+r.node.name);
      const camera=this.worldCamera!.node;
      const setCamera=(pose:Pose)=>{camera.setWorldPosition(...pose.position);camera.lookAt(new Vec3(...pose.target));};
      let alive=true;
      const assertStaticWorld=()=>{if(!alive)return;identity(this.node);identity(model);identity(sceneRoot);};
      const setDoor=(angle:number)=>{if(angle<0||angle>FIRSTSLICE.door.maxDeg)throw Error('Door angle outside contract');door.setRotationFromEuler(0,angle,0);};
      token.check();
      return {
        setLayers:(layers:Layers)=>{for(const entry of FIRSTSLICE.renderers)for(const r of renderers.get(entry.path)!)r.enabled=layers[entry.layer];},
        setDoor,setCamera,assertStaticWorld,
        animateDoor:(from,to,seconds,t)=>this.run(seconds,t,p=>setDoor(from+(to-from)*p)),
        animateCamera:(path,seconds,t)=>this.run(seconds,t,p=>{
          if(path.length<2){setCamera(path[0]);return;}
          let i=0;
          const timed=path.length>2&&path.every(k=>k.progress!==undefined)&&path[0].progress===0&&path[path.length-1].progress===1;
          const key=(j:number)=>timed?path[j].progress!:j/(path.length-1);
          while(i<path.length-2&&p>key(i+1))i++;
          const local=(p-key(i))/Math.max(1e-9,key(i+1)-key(i));
          setCamera({position:interpolate(path[i].position,path[i+1].position,local),target:interpolate(path[i].target,path[i+1].target,local)});
        }),
        cancelTransient:()=>this.cancelJobs(),
        dispose:()=>{if(!alive)return;alive=false;this.cancelJobs();model.destroy();if(this.ownedModel===model)this.ownedModel=null;},
      };
    } catch(e) {model.destroy();this.ownedModel=null;throw e;}
  }
  private run(seconds:number,token:Cancellation,tick:(p:number)=>void):Promise<void> {
    token.check();if(!Number.isFinite(seconds)||seconds<=0){tick(1);return Promise.resolve();}
    return new Promise<void>((resolve,reject)=>{
      const job:Job={elapsed:0,seconds,tick,resolve,reject,off:()=>{}};
      job.off=token.onCancel(()=>{this.jobs.delete(job);reject(new Cancelled());});this.jobs.add(job);tick(0);
    });
  }
  private cancelJobs():void {for(const j of Array.from(this.jobs)){j.off();j.reject(new Cancelled());}this.jobs.clear();}
  update(dt:number):void {
    if(!this.flow||this.disposed||this.safetyFailure)return;
    try {identity(this.node);if(this.ownedModel){identity(this.ownedModel);identity(resolvePath(this.ownedModel,'scene_root'));}}
    catch(e){this.safetyFailure=String(e);this.flow.fault(this.safetyFailure);throw e;}
    if(!Number.isFinite(dt)||dt<=0||this.flow.snapshot().needsResume)return;
    // Deliberately cap one update to avoid a background/long-frame teleport.
    const frameDt=Math.min(dt,.1);
    try {this.flow.advance(frameDt);}catch(e){this.safetyFailure=String(e);this.flow.fault(this.safetyFailure);throw e;}
    for(const j of Array.from(this.jobs)) {
      if(!this.jobs.has(j))continue;j.elapsed+=frameDt;
      try {j.tick(Math.min(1,j.elapsed/j.seconds));if(j.elapsed>=j.seconds){this.jobs.delete(j);j.off();j.resolve();}}
      catch(e){this.jobs.delete(j);j.off();j.reject(e instanceof Error?e:Error(String(e)));}
    }
  }
  private onHide():void {this.flow?.hide();}
  private onShow():void {this.flow?.show();}
  onDisable():void {this.flow?.hide();}
  onEnable():void {if(this.flow)this.flow.show();} // remains paused; explicit resume is required
  onDestroy():void {
    if(this.disposed)return;this.disposed=true;game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);
    this.flow?.dispose();this.cancelJobs();this.ownedModel?.destroy();this.ownedModel=null;
    if(this.worldCamera?.node.isValid&&this.savedCamera){this.worldCamera.node.setWorldPosition(this.savedCamera.position);this.worldCamera.node.setWorldRotation(this.savedCamera.rotation);}
    this.savedCamera=null;this.onStatus=undefined;
  }
}
