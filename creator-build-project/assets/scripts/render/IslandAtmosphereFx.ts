import { Node, Scene, MeshRenderer, Material, Mesh, Color, Vec3, EffectAsset, utils, isValid } from 'cc';
import { ISLAND_FX, approachNight, lightFromNight, pickNight, beamGeometry, beamState, bandGeometry, discGeometry, glintGeometry, moonState, smokePuffs } from './IslandAtmosphereFxCore';
import * as PropsLayout from '../world-r2/IslandPropsLayout';
import { GullFlock } from './GullFlock';
import type { FxGeometry, V3 } from './IslandAtmosphereFxCore';
/** cc wrapper for IslandAtmosphereFxCore (chimney smoke + lighthouse beam/glow/sea glint).
 * Nodes live under one scene-root node 'IslandAtmosphereFx' (outside the imported model: renderer classification,
 * static-world checks and lighthouseTargets are untouched). No colliders: none of these nodes can take a tap.
 * Night light only shows with the exterior layer; smoke shows with the exterior layer day and night.
 * Night weight: GGbot's propNightWeight() (same value as signpost/sea/tags) when live, else our own replica (pickNight).
 * Gulls (fx_gulls/fx_gull_N): GullFlock, same root, same night weight.
 * Moon (fx_moon, fx_moon_halo, fx_moonlight_band_0..2 glitter layers): additive unlit like the beam, night only (hidden at weight 0). */
type Fx = { node: Node; material: Material; applied: string };
const TECH_ADD = 2, TECH_ALPHA_BLEND = 3; // builtin-unlit 3.8.8: opaque, transparent, add, alpha-blend
export class IslandAtmosphereFx {
  private root: Node | null = null; private meshes: Mesh[] = []; private materials: Material[] = [];
  private beam: Fx | null = null; private glow: Fx | null = null; private glint: Fx | null = null; private moon: Fx | null = null; private halo: Fx | null = null; private bands: Fx[] = []; private puffs: Fx[] = [];
  private exterior = false; private night = false; private lightShown = 0; private smokeShown = 0; private nightShown = 0; private synced = false; private time = 0; private ownNight = 0; private gulls: GullFlock | null = null;
  private readonly tmp = new Vec3(); private last: { beam: number; flash: number; puffs: number[]; moon: number; band: number } = { beam: 0, flash: 0, puffs: [], moon: 0, band: 0 };
  constructor(scene: Scene) {
    if (!EffectAsset.get('builtin-unlit')) { console.warn('[SCENE_FX] builtin-unlit unavailable; island smoke/beam skipped'); return; }
    const root = new Node('IslandAtmosphereFx'); scene.addChild(root); this.root = root;
    const beamMesh = this.mesh(beamGeometry()), glowMesh = this.mesh(discGeometry(18, .32, .55, 0, 0, 900)), glintMesh = this.mesh(glintGeometry());
    const puffMeshes = [this.mesh(discGeometry(14, .5, .8, .26, .22, 11)), this.mesh(discGeometry(14, .5, .8, .3, .22, 37))];
    this.beam = this.fx(root, 'fx_lighthouse_beam', beamMesh, TECH_ADD);
    this.glow = this.fx(root, 'fx_lighthouse_glow', glowMesh, TECH_ADD);
    this.glint = this.fx(root, 'fx_lighthouse_seaglint', glintMesh, TECH_ADD);
    const M = ISLAND_FX.moon;
    this.halo = this.fx(root, 'fx_moon_halo', this.mesh(discGeometry(24, .2, .5, 0, 0, 0)), TECH_ADD);
    this.moon = this.fx(root, 'fx_moon', this.mesh(discGeometry(28, .9, 1, 0, .14, 0)), TECH_ADD);
    for (let k = 0; k < ISLAND_FX.band.layers; k++) this.bands.push(this.fx(root, 'fx_moonlight_band_' + k, this.mesh(bandGeometry(k)), TECH_ADD));
    this.moon.node.setWorldPosition(M.pos[0], M.pos[1], M.pos[2]); this.moon.node.setScale(M.radiusM, M.radiusM, M.radiusM);
    this.halo.node.setWorldPosition(M.pos[0], M.pos[1], M.pos[2]); this.halo.node.setScale(M.haloRadiusM, M.haloRadiusM, M.haloRadiusM);
    const L = ISLAND_FX.lamp, sea = ISLAND_FX.seaY;
    this.beam.node.setWorldPosition(L[0], L[1], L[2]); this.glint.node.setWorldPosition(L[0], sea, L[2]);
    const smoke = new Node('fx_chimney_smoke'); root.addChild(smoke);
    for (let i = 0; i < ISLAND_FX.smoke.count; i++) this.puffs.push(this.fx(smoke, 'fx_chimney_smoke_puff_' + i, puffMeshes[i % 2], TECH_ALPHA_BLEND));
    try { this.gulls = new GullFlock(scene, root); } catch (e) { this.gulls = null; console.warn('[SCENE_FX] gulls skipped', String(e)); }
    root.active = false;
  }
  private mesh(g: FxGeometry): Mesh {
    const m = utils.createMesh({ positions: g.positions, colors: g.colors, indices: g.indices,
      minPos: new Vec3(g.min[0], g.min[1], g.min[2]), maxPos: new Vec3(g.max[0], g.max[1], g.max[2]) });
    this.meshes.push(m); return m;
  }
  private fx(parent: Node, name: string, mesh: Mesh, technique: number): Fx {
    const material = new Material(); this.materials.push(material);
    material.initialize({ effectName: 'builtin-unlit', technique, defines: { USE_VERTEX_COLOR: true } });
    material.setProperty('mainColor', new Color(255, 255, 255, 0));
    const node = new Node(name); parent.addChild(node); node.active = false;
    const mr = node.addComponent(MeshRenderer); mr.mesh = mesh; mr.setMaterial(material, 0);
    mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
    return { node, material, applied: '' };
  }
  /** Called from WorldFlowComponent.applyDayNight (same inputs as DoorSpillHint/RoomLightingRig). */
  setView(exterior: boolean, night: boolean): void { this.exterior = exterior; this.night = night; if (this.gulls) this.gulls.setView(exterior); if (!exterior) { this.lightShown = 0; this.smokeShown = 0; this.hideAll(); } }
  /** lateUpdate: after WorldFlow wrote this frame's camera. camera = main world camera node (live position). */
  advance(dt: number, camera: Node | null, wind: number, seaSurfaceY?: number): void {
    const root = this.root; if (!root || !isValid(root, true)) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .1) : 0; this.time += step;
    // Night weight: first sync snaps to the current mode, afterwards a switch fades over nightFadeS (T9n mechanism).
    this.ownNight = this.synced ? approachNight(this.ownNight, this.night, step) : (this.night ? 1 : 0); this.synced = true;
    let shared: unknown = null; try { const f = (PropsLayout as any).propNightWeight; shared = typeof f === 'function' ? f() : null; } catch (e) { shared = null; }
    this.nightShown = pickNight(this.ownNight, shared);
    // Exterior on/off is a layer cut (door / level change): no fade, like the other exterior renderers.
    this.smokeShown = this.exterior ? 1 : 0; this.lightShown = this.exterior ? lightFromNight(this.nightShown) : 0;
    const on = this.lightShown > 1e-3 || this.smokeShown > 1e-3; if (root.active !== on) root.active = on;
    if (!on || !camera || !isValid(camera, true)) return;
    if (this.gulls) this.gulls.advance(step, camera, this.nightShown);
    const p = camera.worldPosition, cam: V3 = [p.x, p.y, p.z];
    const b = beamState(this.time, cam, this.lightShown); this.last.beam = b.alpha; this.last.flash = b.flash;
    this.place(this.beam, null, b.rotation, null, ISLAND_FX.beam.color, b.alpha);
    this.place(this.glow, b.glowPos, b.glowRotation, [b.glowScale, b.glowScale, b.glowScale], ISLAND_FX.glow.color, b.glowAlpha);
    this.place(this.glint, null, b.glintRotation, null, ISLAND_FX.glint.color, b.glintAlpha);
    const m = moonState(this.time, cam, this.lightShown, seaSurfaceY); this.last.moon = m.moonAlpha; this.last.band = m.bandAlpha;
    this.place(this.moon, null, m.moonRotation, null, ISLAND_FX.moon.color, m.moonAlpha);
    this.place(this.halo, null, m.moonRotation, null, ISLAND_FX.moon.haloColor, m.haloAlpha);
    for (let k = 0; k < this.bands.length; k++) this.place(this.bands[k], m.bandPos, m.bandRotation, [m.bandScale, 1, m.bandScale], ISLAND_FX.band.color, m.bandLayerAlpha[k]);
    const puffs = smokePuffs(this.time, Number.isFinite(wind) ? wind : 0, this.nightShown, this.smokeShown, cam); this.last.puffs = [];
    for (let i = 0; i < puffs.length && i < this.puffs.length; i++) { const q = puffs[i]; this.last.puffs.push(q.alpha); this.place(this.puffs[i], q.position, q.rotation, q.scale, q.color, q.alpha); }
  }
  private place(fx: Fx | null, pos: V3 | null, rot: number[], scale: V3 | null, rgb: V3, alpha: number): void {
    if (!fx || !isValid(fx.node, true)) return; const visible = alpha > 1 / 255; if (fx.node.active !== visible) fx.node.active = visible; if (!visible) return;
    if (pos) fx.node.setWorldPosition(pos[0], pos[1], pos[2]);
    fx.node.setWorldRotation(rot[0], rot[1], rot[2], rot[3]);
    if (scale) { this.tmp.set(scale[0], scale[1], scale[2]); fx.node.setScale(this.tmp); }
    const r = Math.round(rgb[0]), g = Math.round(rgb[1]), bl = Math.round(rgb[2]), a = Math.round(alpha * 255), key = r + ',' + g + ',' + bl + ',' + a;
    if (key !== fx.applied) { fx.material.setProperty('mainColor', new Color(r, g, bl, a)); fx.applied = key; }
  }
  private hideAll(): void { const all = [this.beam, this.glow, this.glint, this.moon, this.halo].concat(this.bands, this.puffs); for (let i = 0; i < all.length; i++) { const f = all[i]; if (f && isValid(f.node, true)) f.node.active = false; } if (this.root && isValid(this.root, true)) this.root.active = false; }
  diagnostics() { return { time: this.time, lightShown: this.lightShown, smokeShown: this.smokeShown, nightShown: this.nightShown, beamAlpha: this.last.beam, flash: this.last.flash, puffAlpha: this.last.puffs.slice(), moonAlpha: this.last.moon, bandAlpha: this.last.band, ownNight: this.ownNight, gulls: this.gulls ? this.gulls.diagnostics() : null }; }
  dispose(): void {
    if (this.gulls) this.gulls.dispose(); this.gulls = null;
    if (this.root && isValid(this.root, true)) this.root.destroy();
    for (let i = 0; i < this.materials.length; i++) this.materials[i].destroy();
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].destroy();
    this.root = null; this.beam = this.glow = this.glint = this.moon = this.halo = null; this.bands = []; this.puffs = []; this.materials = []; this.meshes = [];
  }
}
