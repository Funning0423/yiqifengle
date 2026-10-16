import {_decorator,Component,SkeletalAnimation,AnimationClip,AnimationState,assetManager,isValid,game,Game} from 'cc';
import { exclusiveRobot, ROBOT_GESTURES, ROBOT_IDLE, type RobotGestureName } from './RobotClips';
const {ccclass,property}=_decorator;
/**
 * Plays a region model's ambient (idle) clips on loop, several at the same time if needed.
 * - Uses the SkeletalAnimation the glTF prefab already has; adds one if missing.
 * - Clips come from that component; extra clips can be loaded by UUID (same bundle must already be loaded).
 * - One clip: keeps baked animation (cheapest). Several clips at once: switches to real-time mode,
 *   because concurrent baked states on one component are not safe.
 * Island v2.1 ships one combined clip `idle_loop` (12 s, 12 rigs). v2.2 will ship one named clip per rig.
 */
@ccclass('RegionAmbientAnimation')
export class RegionAmbientAnimation extends Component {
  /** Clip names to play together. Empty = play every clip on the component. */
  @property([String]) clipNames:string[]=[];
  /** Optional clip asset UUIDs to add when the prefab's component has no clips. */
  @property([String]) clipUuids:string[]=[];
  /** One-shot robot clips. Not started with the idle loop. */
  @property([String]) gestureNames:string[]=[];
  /** Spread clip start times so identical loops do not move in sync. */
  @property randomizeStart=false;
  private anim:SkeletalAnimation|null=null;private playing:AnimationState[]=[];
  private gesture:RobotGestureName|null=null;private gestureLog:{utc:string;event:string;name:string}[]=[];

  private disposed=false;private hidden=false;private hostPaused=false;private inactive=false;
  private pausedStates:AnimationState[]=[];
  onLoad(){game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);}
  private onHide(){this.hidden=true;this.syncPause();}
  private onShow(){this.hidden=false;this.syncPause();}
  onDisable(){this.inactive=true;this.syncPause();}
  onEnable(){this.inactive=false;this.startPlaybackIfReady();this.syncPause();}
  /** World flow retains this gate across EVENT_SHOW until its explicit Resume action. */
  setHostPaused(paused:boolean){if(this.disposed||paused===this.hostPaused)return;this.hostPaused=paused;this.syncPause();}
  private syncPause(){
    if(this.disposed||!this.anim||!isValid(this.anim,true)||!isValid(this.anim.node,true))return;
    if(this.hidden||this.hostPaused||this.inactive){
      for(const clip of this.anim.clips){if(!clip)continue;const s=this.anim.getState(clip.name);
        if(s?.isPlaying){if(!s.isPaused)s.pause();if(!this.pausedStates.includes(s))this.pausedStates.push(s);}}
    }else{for(const s of this.pausedStates)if(s.isPlaying&&s.isPaused)s.resume();this.pausedStates.length=0;}
  }
  private preparation:Promise<void>|null=null;
  private prepared=false;private playbackStarted=false;
  start(){void this.prepare().catch(error=>{if(!this.disposed)console.error('Ambient preparation failed',error);});}
  /** Resource gate shared by startup and Creator lifecycle. Failures never become a ready room. */
  prepare():Promise<void>{if(this.disposed)return Promise.reject(Error('Ambient owner disposed'));if(!this.preparation)this.preparation=this.prepareOnce();return this.preparation;}
  private async prepareOnce(){
    this.anim=this.getComponent(SkeletalAnimation)||this.addComponent(SkeletalAnimation);
    // This component owns every ambient loop, including while UUID loads are pending.
    this.anim.playOnLoad=false;
    if(!this.anim.clips.filter(Boolean).length&&this.clipUuids.length){
      const loaded=await Promise.all(this.clipUuids.map(uuid=>new Promise<AnimationClip>((ok,fail)=>assetManager.loadAny({uuid},(err:any,clip:AnimationClip)=>err||!clip?fail(err||Error('Ambient clip missing: '+uuid)):ok(clip)))));
      if(this.disposed||!isValid(this.node,true))throw Error('Ambient owner destroyed during preparation');
      this.anim.clips=[...this.anim.clips.filter(Boolean),...loaded];
    }
    if(this.disposed||!isValid(this.node,true))throw Error('Ambient owner destroyed before playback');
    const clips=this.anim.clips.filter(Boolean) as AnimationClip[];
    if(!clips.length||this.clipNames.some(name=>!clips.some(clip=>clip.name===name)))throw Error('Required ambient animation unavailable');
    this.prepared=true;this.inactive=!(this.enabled&&this.node.activeInHierarchy);
    this.startPlaybackIfReady();this.syncPause();
  }
  private startPlaybackIfReady(){
    if(this.disposed||!this.prepared||this.playbackStarted||!this.enabled||!this.node.activeInHierarchy)return;
    // On first activation Creator runs all onLoad callbacks before onEnable.
    // Animation.onLoad creates/replaces states, so never retain/play pre-onLoad states.
    this.play();this.playbackStarted=true;
  }
  private play(){
    const anim=this.anim!;const clips=anim.clips.filter(Boolean) as AnimationClip[];
    const wanted=this.clipNames.length?clips.filter(c=>this.clipNames.includes(c.name)):clips;
    if(!wanted.length||this.clipNames.some(name=>!wanted.some(c=>c.name===name)))throw Error('Required ambient animation unavailable');
    if(wanted.length>1)anim.useBakedAnimation=false;
    anim.playOnLoad=false;anim.defaultClip=wanted[0];
    this.playing=wanted.map(c=>{const s=anim.getState(c.name)||anim.createState(c,c.name);s.wrapMode=AnimationClip.WrapMode.Loop;s.repeatCount=Infinity;
      if(this.randomizeStart)s.time=Math.random()*s.duration;return s;});
    for(const state of this.playing)state.play();
  }
  /** Plays watering or give-flower once. Stops robot_idle for that skeleton and leaves sky_ambient_loop running. */
  playGesture(name:string):boolean{
    const picked=exclusiveRobot(name);
    if(this.disposed||this.hidden||this.hostPaused||this.inactive||!picked.once||!this.anim)return false;
    if(this.gesture)return false;
    const clip=this.anim.clips.find(c=>c?.name===picked.once);
    if(!clip)return false;
    for(const robot of [ROBOT_IDLE,...ROBOT_GESTURES]){const state=this.anim.getState(robot);if(state?.isPlaying)state.stop();}
    const state=this.anim.getState(picked.once)!;
    state.wrapMode=AnimationClip.WrapMode.Normal;state.repeatCount=1;state.time=0;state.play();
    this.gesture=picked.once;this.gestureLog.push({utc:new Date().toISOString(),event:'start',name:picked.once});if(this.gestureLog.length>24)this.gestureLog.shift();return true;
  }
  update(){
    if(this.disposed)return;
    if(this.hidden||this.hostPaused||this.inactive){this.syncPause();return;}
    if(!this.gesture||!this.anim)return;
    const state=this.anim.getState(this.gesture);
    if(state&&state.isPlaying)return;
    this.gestureLog.push({utc:new Date().toISOString(),event:'end',name:this.gesture});this.gesture=null;
    const idle=this.anim.getState(ROBOT_IDLE);
    if(!idle)return;
    idle.wrapMode=AnimationClip.WrapMode.Loop;idle.repeatCount=Infinity;idle.play();
  }
  gestureState(){return this.gesture;}
  gestureEvents(){return this.gestureLog.slice(-24);}
  diagnosticsAll(){return this.anim?.clips.filter(Boolean).map(c=>{const s=this.anim!.getState(c.name);return {name:c.name,time:s?.time??null,playing:!!s?.isPlaying};})||[];}
  /** For tests: names and times of the clips currently playing. */
  diagnostics(){return this.playing.map(s=>({name:s.name,time:s.time,playing:s.isPlaying,baked:!!this.anim?.useBakedAnimation}));}
  onDestroy(){
    if(this.disposed)return;this.disposed=true;
    game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);
    // SkeletalAnimation may already have been destructed by Cocos child/component destruction order.
    if(this.anim&&isValid(this.anim,true)&&isValid(this.anim.node,true)){
      for(const clip of this.anim.clips)if(clip)this.anim.getState(clip.name)?.stop();
    }
    this.playing.length=0;this.pausedStates.length=0;this.anim=null;this.gesture=null;
  }
}
