import { gfx, isValid, MeshRenderer, Node, utils, type Material, type Mesh } from 'cc';
import { buildRearPlant, buildWindowShutter, buildWindowTrim, cutWallOpening, ROOM360_RIGHT_WINDOW, type FlatMesh } from './RoomShell360Core';

/** 场景特效bot r5 S2-2: room 360 fixes, mounted on the live island model after renderer classification
 * (WorldFlowComponent), never written into the imported GLB.
 *  1. env_interior_shell (M_env_palette_interior_1s, single-sided) renders both faces with USE_TWOSIDE, so a free
 *     look never sees through a wall: jambs and the outer side of the shell now show their palette colour.
 *  2. env_window_blind_cards (painted day view in a window whose wall is solid 3 cm behind it) is hidden, and then
 *     ROOM360_RIGHT_WINDOW picks the variant: 'shutter' (A) = a real louvred shutter with thickness takes its place
 *     (buildWindowShutter); 'open' (B) = env_lighthouse_ext gets a runtime copy of its mesh with the arched opening cut
 *     out (cutWallOpening) and a wooden trim lines the cut outside (buildWindowTrim). If the wall mesh data cannot be
 *     read, B falls back to A.
 *  3. env_rear_window_plant's leaf card is hidden and a solid leaf clump is parented to the same node, so the
 *     RoomLightingRig sway still applies.
 * New meshes use the island's shared M_env_palette (taken from env_lighthouse_door) and palette UVs only.
 * Loose ES5 only (no spread / for-of on Map or Set). Failures are non-fatal: the room keeps its original look. */
export class RoomShell360 {
  private readonly hidden: MeshRenderer[] = [];
  /** Replacement renderer i stands in for hidden[i] and follows the layer switches written into it. */
  private readonly stand: MeshRenderer[] = [];
  private readonly added: Node[] = [];
  private readonly meshes: Mesh[] = [];
  private shell: { renderer: MeshRenderer; shared: Material | null } | null = null;
  private wall: { renderer: MeshRenderer; original: Mesh } | null = null;
  private readonly notes: string[] = [];
  private disposed = false;

  constructor(model: Node) {
    try { this.mount(model); } catch (error) { this.notes.push('mount failed: ' + String(error)); console.warn('[RoomShell360]', String(error)); }
  }

  private mount(model: Node): void {
    const all = model.getComponentsInChildren(MeshRenderer);
    const byName = (name: string): MeshRenderer | null => { for (let i = 0; i < all.length; i++) if (all[i].node.name === name) return all[i]; return null; };
    const door = byName('env_lighthouse_door'), palette = door ? door.getSharedMaterial(0) : null;
    if (!palette) { this.notes.push('M_env_palette (env_lighthouse_door) missing; no new meshes'); }

    const shell = byName('env_interior_shell');
    if (shell) {
      const shared = shell.getSharedMaterial(0), inst = shell.getMaterialInstance(0) as any;
      if (inst && inst !== shared && inst.passes && inst.passes.length) {
        inst.recompileShaders({ USE_TWOSIDE: true });
        inst.overridePipelineStates({ rasterizerState: { cullMode: 0 } });
        this.shell = { renderer: shell, shared };
      } else this.notes.push('shell material instance unavailable; left single-sided');
    } else this.notes.push('env_interior_shell missing');

    const card = byName('env_window_blind_cards');
    if (card && palette) {
      const opened = ROOM360_RIGHT_WINDOW === 'open' && this.openWall(byName('env_lighthouse_ext'));
      if (opened) this.add(card.node, 'fx360_window_trim', buildWindowTrim(), palette, card);
      else this.add(card.node, 'fx360_window_shutter', buildWindowShutter(), palette, card);
    }
    const plant = byName('env_rear_window_plant');
    if (plant && palette) {
      this.add(plant.node, 'fx360_rear_plant', buildRearPlant(), palette, plant);
    }
  }

  /** Variant B: swap env_lighthouse_ext's mesh for a copy with the window opening cut out (submesh 0 only). */
  private openWall(wall: MeshRenderer | null): boolean {
    const src = wall ? wall.mesh : null;
    if (!wall || !src || src.struct.primitives.length !== 1) { this.notes.push('open window: env_lighthouse_ext mesh unavailable; shutter instead'); return false; }
    const P = src.readAttribute(0, gfx.AttributeName.ATTR_POSITION), N = src.readAttribute(0, gfx.AttributeName.ATTR_NORMAL);
    const U = src.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD), I = src.readIndices(0);
    if (!P || !N || !U || !I) { this.notes.push('open window: wall mesh data not readable; shutter instead'); return false; }
    const flat: FlatMesh = { positions: Array.prototype.slice.call(P), normals: Array.prototype.slice.call(N), uvs: Array.prototype.slice.call(U), indices: Array.prototype.slice.call(I) };
    const cut = cutWallOpening(flat);
    if (cut.touched === 0) { this.notes.push('open window: no wall triangles over the opening; shutter instead'); return false; }
    const mesh = utils.createMesh({ positions: cut.mesh.positions, normals: cut.mesh.normals, uvs: cut.mesh.uvs, indices: cut.mesh.indices }, undefined, { calculateBounds: true });
    this.wall = { renderer: wall, original: src };
    wall.mesh = mesh; this.meshes.push(mesh);
    this.notes.push('open window: ' + cut.touched + ' wall triangles cut, ' + cut.removedArea.toFixed(3) + ' m2 removed');
    return true;
  }

  private add(parent: Node, name: string, geo: FlatMesh, material: Material, like: MeshRenderer): void {
    const node = new Node(name); node.layer = parent.layer; parent.addChild(node);
    const mesh = utils.createMesh({ positions: geo.positions, normals: geo.normals, uvs: geo.uvs, indices: geo.indices }, undefined, { calculateBounds: true });
    const r = node.addComponent(MeshRenderer); r.mesh = mesh; r.setSharedMaterial(material, 0);
    r.shadowCastingMode = MeshRenderer.ShadowCastingMode.ON; r.receiveShadow = MeshRenderer.ShadowReceivingMode.ON;
    r.visibility = like.visibility;
    this.added.push(node); this.meshes.push(mesh); this.hidden.push(like); this.stand.push(r);
    r.enabled = like.enabled; like.enabled = false;
  }

  /** Call right after the room layer writer (WorldFlowComponent.writeLayers), which writes enabled into every original
   *  renderer each time: the replacement takes the value just written into its card, and the card goes dark again. */
  syncLayers(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.hidden.length; i++) {
      const card = this.hidden[i], mine = this.stand[i];
      if (!isValid(card, true) || !isValid(mine, true)) continue;
      mine.enabled = card.enabled; card.enabled = false;
    }
  }

  diagnostics(): { shellTwoSided: boolean; windowOpen: boolean; hidden: string[]; added: string[]; notes: string[] } {
    const hidden: string[] = [], added: string[] = [];
    for (let i = 0; i < this.hidden.length; i++) hidden.push(this.hidden[i].node.name);
    for (let i = 0; i < this.added.length; i++) added.push(this.added[i].name);
    return { shellTwoSided: !!this.shell, windowOpen: !!this.wall, hidden, added, notes: this.notes.slice() };
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    for (let i = 0; i < this.added.length; i++) if (isValid(this.added[i], true)) this.added[i].destroy();
    if (this.wall && isValid(this.wall.renderer, true)) this.wall.renderer.mesh = this.wall.original;
    this.wall = null;
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].destroy();
    for (let i = 0; i < this.hidden.length; i++) if (isValid(this.hidden[i], true)) this.hidden[i].enabled = true;
    if (this.shell && isValid(this.shell.renderer, true) && this.shell.shared) this.shell.renderer.setSharedMaterial(this.shell.shared, 0);
    this.added.length = 0; this.meshes.length = 0; this.hidden.length = 0; this.stand.length = 0; this.shell = null;
  }
}
