import {_decorator,Component,Node,Quat,isValid} from 'cc';
import {quatMul,windYawDelta,yawQuat} from '../render/GlobalWind';
const {ccclass}=_decorator;
/**
 * R5 S3 fix_r1 (场景特效bot): the two skycity pennants (env_sky_pennant_01/02, baked flutter on sky_ambient_loop) follow
 * GlobalWind's direction. Both were authored pointing roughly downwind (flag +x from the pole: +0.7 / +10.9 deg off
 * the default wind azimuth 109.3 deg), so lateUpdate pre-multiplies the clip's rotation by a pure yaw of windYawDelta() in the parent
 * frame (pivot = the pole, which is the node origin). Delta 0 (defaults) never writes, so today's look is untouched.
 * If the clip did not write the node this frame (paused / hidden), the last clip pose is reused, so the yaw never accumulates.
 * Strength is not applied: the flutter is baked. Added by RegionLoader.mountRegion for region_skycity only.
 */
export const SKYCITY_PENNANTS=['env_sky_pennant_01','env_sky_pennant_02'];
type Slot={node:Node;base:Quat;written:Quat|null};
@ccclass('SkycityPennantWind')
export class SkycityPennantWind extends Component{
  private slots:Slot[]=[];private tmp=new Quat();
  start(){
    for(let i=0;i<SKYCITY_PENNANTS.length;i++){const n=findDeep(this.node,SKYCITY_PENNANTS[i]);if(n)this.slots.push({node:n,base:n.rotation.clone(),written:null});}
  }
  lateUpdate(){
    const delta=windYawDelta();
    for(let i=0;i<this.slots.length;i++){
      const s=this.slots[i];if(!isValid(s.node,true))continue;
      const cur=s.node.rotation;
      // A rotation different from what we wrote last frame is a fresh clip sample.
      if(!s.written||!Quat.equals(cur,s.written,1e-7))Quat.copy(s.base,cur);
      if(delta===0&&!s.written)continue;
      const b=s.base,q=quatMul(yawQuat(delta),[b.x,b.y,b.z,b.w]);
      Quat.set(this.tmp,q[0],q[1],q[2],q[3]);s.node.setRotation(this.tmp);
      if(!s.written)s.written=new Quat();Quat.copy(s.written,this.tmp);
      if(delta===0)s.written=null;
    }
  }
  /** For tests / diagnostics. */
  pennantCount(){return this.slots.length;}
}
function findDeep(root:Node,name:string):Node|null{
  if(root.name===name)return root;
  const c=root.children;for(let i=0;i<c.length;i++){const f=findDeep(c[i],name);if(f)return f;}
  return null;
}
