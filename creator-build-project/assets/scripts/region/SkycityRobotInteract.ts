import { _decorator, Camera, Component, director, EventTouch, input, Input, Node, Vec3, UITransform, BlockInputEvents, MeshRenderer, geometry } from 'cc';
import { RegionAmbientAnimation } from './RegionAmbientAnimation';
import type { RobotGestureName } from './RobotClips';
const { ccclass } = _decorator;
/**
 * Real taps only. anchor_robot_interact plays robot_give_flower.
 * anchor_starcourt_center is the court garden and plays robot_watering.
 * Scenery ambient clips are left running; the gesture replaces robot_idle until it finishes.
 */
@ccclass('SkycityRobotInteract')
export class SkycityRobotInteract extends Component {
  private contextSnapshot:(()=>{state?:string;hidden?:boolean;needsResume?:boolean;regionVisit?:boolean})|null=null;
  bindInteractionContext(snapshot:()=>{state?:string;hidden?:boolean;needsResume?:boolean;regionVisit?:boolean}){this.contextSnapshot=snapshot;}
  private lastTap:any=null;
  inputDiagnostics(){return this.lastTap;}
  private hits: { node: Node; gesture: RobotGestureName }[] = [];
  start() {
    const give = this.find('anchor_robot_interact'), water = this.find('anchor_starcourt_center');
    if (give) this.hits.push({ node: give, gesture: 'robot_give_flower' });
    if (water) this.hits.push({ node: water, gesture: 'robot_watering' });
    input.on(Input.EventType.TOUCH_END, this.onTouch, this);
  }
  private find(name: string): Node | null {
    const walk = (n: Node): Node | null => {
      if (n.name === name) return n;
      for (const child of n.children) { const hit = walk(child); if (hit) return hit; }
      return null;
    };
    return walk(this.node);
  }
  private onTouch(event: EventTouch) {
    const raw=event.getLocation();this.lastTap={utc:new Date().toISOString(),raw:[raw.x,raw.y],reason:'owner-or-event',candidates:[]};
    if (!this.enabled || !this.node.activeInHierarchy || event.propagationStopped || event.propagationImmediateStopped) return;
    const snap = this.contextSnapshot?.() ?? (globalThis as any).__worldIntegration?.snapshot?.();
    if (snap?.state === 'level' || snap?.hidden || snap?.needsResume) return;
    if (snap?.regionVisit && snap.state !== 'skycity') return;
    const anim = this.getComponent(RegionAmbientAnimation);
    if (!anim || !this.hits.length) return;
    const scene=director.getScene();
    const cameras = scene?.getComponentsInChildren(Camera).filter(c => c.enabled && c.node.activeInHierarchy && c.priority < 40 && (c.visibility & this.node.layer)!==0) || [];
    const camera = cameras[0];
    if (!camera) return;
    const p = raw;this.lastTap.reason='ui-or-no-hit';this.lastTap.camera=[camera.camera.width,camera.camera.height];
    // Global input also receives taps over UI. Test only actual interactive targets,
    // not full-screen Canvas transforms, before considering an anchor.
    if(scene?.getComponentsInChildren(UITransform).some(t=>t.node.activeInHierarchy &&
      (t.node.getComponent(BlockInputEvents)?.enabled || t.node.hasEventListener(Node.EventType.TOUCH_END) || t.node.hasEventListener(Node.EventType.TOUCH_START)) && t.hitTest(p)))return;
    let best: { gesture: RobotGestureName; d: number } | null = null;
    const out = new Vec3();
    for (const hit of this.hits) {
      if (!hit.node.isValid || !hit.node.activeInHierarchy || (camera.visibility & hit.node.layer)===0) continue;
      camera.worldToScreen(hit.node.worldPosition, out);
      if (![out.x,out.y,out.z].every(Number.isFinite) || out.z<0 || out.z>1 || out.x<0 || out.y<0 || out.x>camera.camera.width || out.y>camera.camera.height)continue;
      const d = Math.hypot(p.x - out.x, p.y - out.y);this.lastTap.candidates.push({name:hit.node.name,screen:[out.x,out.y,out.z],distance:d});
      if (d > 64 || (best && d>=best.d))continue;
      // Ray through the anchor (not the edge of its tap radius). Geometry in front
      // blocks it; a small contact radius permits an anchor embedded in its robot.
      const ray=camera.screenPointToRay(out.x,out.y);
      const distance=Vec3.distance(ray.o,hit.node.worldPosition);
      const blocked=scene?.getComponentsInChildren(MeshRenderer).some(r=>r.enabled && r.node.activeInHierarchy && r.model &&
        (camera.visibility&r.node.layer)!==0 && (()=>{const t=geometry.intersect.rayModel(ray,r.model!,{doubleSided:true});return t>0 && t<distance-.35;})());
      this.lastTap.candidates[this.lastTap.candidates.length-1].blocked=!!blocked;if(!blocked)best = { gesture: hit.gesture, d };
    }
    if (best){this.lastTap.reason=anim.playGesture(best.gesture)?'started':'animation-busy-or-missing';this.lastTap.gesture=best.gesture;}
  }
  onDestroy() { input.off(Input.EventType.TOUCH_END, this.onTouch, this); }
}
