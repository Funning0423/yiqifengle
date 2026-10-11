import { Node, Scene, MeshRenderer, Material, Mesh, Color, Vec3, EffectAsset, utils, isValid } from 'cc';
import { DOOR_SPILL, spillGeometry, spillPeak, spillTarget, stepSpill } from './DoorSpillHintCore';
import type { SpillView } from './DoorSpillHintCore';
/** cc wrapper for the door light-spill hint (see DoorSpillHintCore). One node under the scene root (not inside the imported
 * model, so renderer classification and static-world checks are untouched), one mesh, one owned material. */
export class DoorSpillHint {
  private node: Node | null = null; private mesh: Mesh | null = null; private material: Material | null = null;
  private view: SpillView = { interior: false, exterior: false, night: false }; private shown = 0; private applied = -1;
  constructor(scene: Scene) {
    if (!EffectAsset.get('builtin-unlit')) { console.warn('[T2+] builtin-unlit unavailable; door spill hint skipped'); return; }
    const g = spillGeometry(), [r, gr, b] = DOOR_SPILL.color, colors: number[] = [];
    for (const a of g.alpha) colors.push(1, 1, 1, a); // vertex alpha carries the fan; tint comes from mainColor
    this.mesh = utils.createMesh({ positions: g.positions, colors, indices: g.indices,
      minPos: new Vec3(g.min[0], g.min[1], g.min[2]), maxPos: new Vec3(g.max[0], g.max[1] + .01, g.max[2]) });
    const m = new Material(); this.material = m;
    // builtin-unlit technique 3: two-sided alpha blending, depthWrite=false (same as RoomLightingRig steam).
    m.initialize({ effectName: 'builtin-unlit', technique: 3, defines: { USE_VERTEX_COLOR: true } });
    m.setProperty('mainColor', new Color(r, gr, b, 0));
    const n = new Node('RoomDoorSpillHint'); scene.addChild(n); n.active = false; this.node = n;
    const mr = n.addComponent(MeshRenderer); mr.mesh = this.mesh; mr.setMaterial(m, 0);
    mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
  }
  /** Layers + day/night (called from WorldFlowComponent.applyDayNight). Leaving the interior is a hard off. */
  setView(interior: boolean, exterior: boolean, night: boolean): void {
    this.view = { interior, exterior, night }; if (!interior) { this.shown = 0; this.write(); }
  }
  advance(dt: number): void { if (!this.material) return; this.shown = stepSpill(this.shown, spillTarget(this.view), dt); this.write(); }
  private write(): void {
    const n = this.node, m = this.material; if (!n || !m || !isValid(n, true)) return;
    const a = this.view.interior ? this.shown * spillPeak(this.view.night) : 0, on = a > 1e-3;
    if (n.active !== on) n.active = on;
    if (on && Math.abs(a - this.applied) > 1e-3) { const [r, g, b] = DOOR_SPILL.color; m.setProperty('mainColor', new Color(r, g, b, Math.round(a * 255))); this.applied = a; }
  }
  dispose(): void {
    if (this.node && isValid(this.node, true)) this.node.destroy();
    this.material?.destroy(); this.mesh?.destroy(); this.node = null; this.material = null; this.mesh = null;
  }
}
