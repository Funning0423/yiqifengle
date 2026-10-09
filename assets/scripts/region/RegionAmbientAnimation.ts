import {_decorator,Component,SkeletalAnimation,AnimationClip,AnimationState,assetManager,isValid} from 'cc';
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
  /** Spread clip start times so identical loops do not move in sync. */
  @property randomizeStart=false;
  private anim:SkeletalAnimation|null=null;private playing:AnimationState[]=[];

  start(){
    this.anim=this.getComponent(SkeletalAnimation)||this.addComponent(SkeletalAnimation);
    if(this.anim.clips.filter(Boolean).length||!this.clipUuids.length){this.play();return;}
    let left=this.clipUuids.length;const loaded:AnimationClip[]=[];
    for(const uuid of this.clipUuids)assetManager.loadAny({uuid},(err:any,clip:AnimationClip)=>{
      if(err)console.error('Ambient clip failed',uuid,err);else loaded.push(clip);
      if(--left===0&&isValid(this.node,true)&&this.anim){this.anim.clips=[...this.anim.clips.filter(Boolean),...loaded];this.play();}
    });
  }
  private play(){
    const anim=this.anim!;const clips=anim.clips.filter(Boolean) as AnimationClip[];
    const wanted=this.clipNames.length?clips.filter(c=>this.clipNames.includes(c.name)):clips;
    if(!wanted.length){console.warn('RegionAmbientAnimation: no clips to play on',this.node.name);return;}
    if(wanted.length>1)anim.useBakedAnimation=false;
    anim.playOnLoad=true;anim.defaultClip=wanted[0];
    this.playing=wanted.map(c=>{const s=anim.getState(c.name)!;s.wrapMode=AnimationClip.WrapMode.Loop;s.repeatCount=Infinity;
      if(this.randomizeStart)s.time=Math.random()*s.duration;s.play();return s;});
  }
  /** For tests: names and times of the clips currently playing. */
  diagnostics(){return this.playing.map(s=>({name:s.name,time:s.time,playing:s.isPlaying,baked:!!this.anim?.useBakedAnimation}));}
  onDestroy(){for(const s of this.playing)s.stop();this.playing=[];}
}
