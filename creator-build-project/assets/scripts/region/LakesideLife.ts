import {Color,Component,Material,MeshRenderer,Node,Quat,Vec3,instantiate,isValid,utils} from 'cc';
import {LAKESIDE_LIFE,chimeSwing,axisAngleQuat,fireflyAt,fireflyMesh} from '../render/LakesideLifeCore';
import {getGlobalWind} from '../render/GlobalWind';
import {lakesideDayNightMode} from './LakesideJourneyAtmosphere';
/** R5 lakeside life (场景特效bot): swings every LK_windchime (plus one new chime under the pavilion eave, a second instance of the
 *  same palette GLB) with the global wind, and shows a few night-only fireflies drifting downwind. Shared by the board and the
 *  journey copy (mountLakesideScenery). The chimes and the firefly node are kept out of the static merge (isLakesideLifeNode). */
const LIFE_NODES=new WeakSet<Node>();
const LIFE_MATERIALS=new WeakSet<Material>();
export function isLakesideLifeNode(n:Node):boolean{return LIFE_NODES.has(n);}
export function isLakesideLifeMaterial(m:Material):boolean{return LIFE_MATERIALS.has(m);}
class LakesideLifeMotion extends Component{
 chimes:Node[]=[];rest:Quat[]=[];flies:Node[]=[];t=0;
 private q=new Quat();private qi=new Quat();private v=new Vec3();
 update(dt:number){
  this.t+=Math.min(.1,Math.max(0,dt||0));const t=this.t,root=this.node.parent;if(!root||!isValid(root,true))return;
  const w=getGlobalWind();Quat.invert(this.qi,root.worldRotation);Vec3.transformQuat(this.v,new Vec3(w.dirX,0,w.dirZ),this.qi);
  const l=Math.hypot(this.v.x,this.v.z)||1,dx=this.v.x/l,dz=this.v.z/l;
  for(let i=0;i<this.chimes.length;i++){const c=this.chimes[i];if(!isValid(c,true))continue;
   // swing in the PARENT (scenery) frame, then the authored rest tilt
   const s=chimeSwing(t,i,dx,dz,w.strength),a=axisAngleQuat(s.axis,s.angle);this.q.set(a[0],a[1],a[2],a[3]);Quat.multiply(this.q,this.q,this.rest[i]);c.setRotation(this.q);}
  const night=lakesideDayNightMode()==='night';
  for(let i=0;i<this.flies.length;i++){const f=this.flies[i];if(!isValid(f,true))continue;f.active=night;if(!night)continue;
   const s=fireflyAt(t,i,dx,dz);f.setPosition(s.pos[0],s.pos[1],s.pos[2]);const k=.35+.65*s.glow;f.setScale(k,k,k);}
 }
}
/** Mounts the life on a freshly instantiated lakeside scenery root. Never throws (an error only logs; the scene stays static). */
export function mountLakesideLife(scenery:Node):number{
 try{
  const chimes=scenery.children.filter(c=>/^LK_windchime_i/.test(c.name));if(!chimes.length)return 0;
  const extra=instantiate(chimes[0]);extra.name=LAKESIDE_LIFE.pavilionChime.name;const p=LAKESIDE_LIFE.pavilionChime.pos;extra.setPosition(p[0],p[1],p[2]);extra.setRotation(Quat.IDENTITY);scenery.addChild(extra);chimes.push(extra);
  const host=new Node('LakesideLife');scenery.addChild(host);LIFE_NODES.add(host);const motion=host.addComponent(LakesideLifeMotion);
  for(const c of chimes){LIFE_NODES.add(c);motion.chimes.push(c);motion.rest.push(c.rotation.clone());}
  // fireflies: one shared octahedron mesh + one additive unlit material (instanced: one draw). enableLakesideInstancing later gives
  // them its plain USE_INSTANCING copy, which keeps this effect, technique and colour.
  const g=fireflyMesh(LAKESIDE_LIFE.fireflySize),col=LAKESIDE_LIFE.fireflyColor,colors:number[]=[];for(let i=0;i<g.positions.length/3;i++)colors.push(col[0],col[1],col[2],1);
  const mesh=utils.MeshUtils.createMesh({positions:g.positions,indices:g.indices,colors});
  const mat=new Material();mat.initialize({effectName:'builtin-unlit',technique:2/* add */,defines:{USE_VERTEX_COLOR:true,USE_INSTANCING:true}});
  mat.setProperty('mainColor',new Color(255,255,255,255));LIFE_MATERIALS.add(mat);
  for(let i=0;i<LAKESIDE_LIFE.fireflyCount;i++){const f=new Node('LK_firefly_'+i);host.addChild(f);const r=f.addComponent(MeshRenderer);r.mesh=mesh;r.setSharedMaterial(mat,0);r.shadowCastingMode=0;f.active=false;motion.flies.push(f);}
  return chimes.length;
 }catch(e){try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'life-skipped',error:String((e as any)?.message??e)}));}catch{}return 0;}
}
