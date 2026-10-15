import { _decorator, Animation, Camera, Color, Component, EffectAsset, Material, MeshRenderer, Node, Prefab, SkeletalAnimation, Texture2D, director, gfx, isValid, instantiate } from 'cc';
import { REGIONS, loadRegionPrefab } from './RegionLoader';
import { RegionAmbientAnimation } from './RegionAmbientAnimation';
import { skycityBoardPoseAt } from './SkycityBoardPose';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
import { Cancellation } from '../world-r1/WorldFlowCore';
const { ccclass } = _decorator;
/** Same excluded bit the world camera already masks. Priority stays under the board UI camera. */
export const SKYCITY_LAYER = 1 << 20;
const SKYCITY_CAMERA_PRIORITY = 43;
const CULL_NONE = gfx && gfx.CullMode ? gfx.CullMode.NONE : 0;
// v0.4b renamed the cloud sea and split the bird flock into pivot nodes. Cumulus has no successor.
const REQUIRED = ['anchor_scene_root', 'anchor_robot_root', 'chr_robot_gardener_mesh', 'env_merged_SKY_08_CloudSea', 'env_sky_starring', 'anim_birds_flock_0_pivot'];
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const child of n.children) { const hit = find(child, name); if (hit) return hit; } return null; }
function setLayer(n: Node) { n.layer = SKYCITY_LAYER; for (const child of n.children) setLayer(child); }
function textureOf(mat: Material | null): Texture2D | null {
  if (!mat) return null;
  for (const key of ['mainTexture', 'albedoMap']) {
    try { const value = mat.getProperty(key) as Texture2D | null; if (value) return value; } catch { /* property absent on this pass */ }
  }
  return null;
}
function surfaceMode(nodeName: string, materialName: string): 'cut' | 'blend' | 'opaque' {
  const name = nodeName + ' ' + materialName;
  if (/mist/i.test(name)) return 'blend';
  if (/cards|foliage|flower/i.test(name)) return 'cut';
  return 'opaque';
}
/** Unlit palette. Cloud shade stays in the mesh vertex colour and UV; no fullscreen card and no new light. */
export function applySkycityUnlit(model: Node): Material[] {
  if (!EffectAsset.get('builtin-unlit')) throw Error('Skycity unlit material unavailable');
  const owned: Material[] = [], cache = new Map<string, Material>();
  for (const renderer of model.getComponentsInChildren(MeshRenderer)) {
    for (let i = 0; i < renderer.sharedMaterials.length; i++) {
      const source = renderer.sharedMaterials[i];
      const tex = textureOf(source);
      if (!tex) throw Error('Skycity texture missing on ' + renderer.node.name);
      const mode = surfaceMode(renderer.node.name, source?.name || '');
      const id = ((tex as { uuid?: string }).uuid || tex.name || 'tex') + ':' + mode;
      let mat = cache.get(id);
      if (!mat) {
        mat = new Material();
        const defines: Record<string, boolean> = { USE_TEXTURE: true, USE_VERTEX_COLOR: true };
        if (mode === 'cut') defines.USE_ALPHA_TEST = true;
        mat.initialize({ effectName: 'builtin-unlit', technique: mode === 'blend' ? 3 : 0, defines });
        mat.setProperty('mainTexture', tex);
        mat.setProperty('mainColor', new Color(255, 255, 255, 255));
        if (mode === 'cut') mat.setProperty('alphaThreshold', 0.5);
        try { mat.overridePipelineStates({ rasterizerState: { cullMode: CULL_NONE } }); } catch { /* technique 0 stays; alpha-blend is already two-sided */ }
        cache.set(id, mat); owned.push(mat);
      }
      renderer.setSharedMaterial(mat, i);
    }
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
  }
  if (!owned.length) throw Error('Skycity unlit materials missing');
  return owned;
}
function clipNames(model: Node): string[] {
  const names: string[] = [];
  for (const anim of model.getComponentsInChildren(Animation)) for (const clip of anim.clips || []) if (clip?.name) names.push(clip.name);
  return names;
}
function validateSkycity(model: Node) {
  for (const name of REQUIRED) if (!find(model, name)) throw Error('Skycity anchor/mesh missing: ' + name);
  const names = clipNames(model);
  for (const clip of REGIONS.skycity.ambientClips || []) if (!names.includes(clip)) throw Error('Skycity ambient clip missing: ' + clip);
}
/** Preflight happens before exiting a saved result. Import failures retain its rewards and retry action. */
export async function preflightSkycityScene(): Promise<void> {
  const token = new Cancellation(), timer = setTimeout(() => token.cancel(), 12000); let model: Node | null = null;
  try {
    const prefab = await token.wait(loadRegionPrefab(REGIONS.skycity)); token.check();
    if (!EffectAsset.get('builtin-unlit')) throw Error('Skycity unlit material unavailable');
    model = instantiate(prefab); model.active = false; validateSkycity(model);
    const materials = applySkycityUnlit(model);
    for (const material of materials) material.destroy();
  } finally { clearTimeout(timer); model?.destroy(); }
}
@ccclass('SkycitySceneMotion')
export class SkycitySceneMotion extends Component {
  ambient: RegionAmbientAnimation | null = null; camera: Camera | null = null; robot: Node | null = null;
  aspect = 0.46; hostPaused = true; visible = false; last = '';
  update() {
    if (!this.visible || !this.camera || !this.robot || !isValid(this.camera, true) || !isValid(this.robot, true)) return;
    const p = this.robot.worldPosition, key = p.x.toFixed(2) + '/' + p.y.toFixed(2) + '/' + p.z.toFixed(2) + '/' + this.aspect.toFixed(3);
    if (key === this.last) return; this.last = key;
    const pose = skycityBoardPoseAt([p.x, p.y, p.z], this.aspect);
    if (!applyCameraPose(this.camera, fromLookAt(pose), 'skycity.board-background')) throw Error('Skycity camera pose rejected');
  }
  onDestroy() { this.ambient = null; this.camera = null; this.robot = null; }
}
/** Live sky city behind the board. Own camera, priority 43. Does not write the world camera or flow layers.
 * Pause freezes ambient motion and keeps the last frame. Cancel and dispose release the lease. */
export const createSkycityBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
  let rig: Node | null = null, prefab: Prefab | null = null, camera: Camera | null = null, motion: SkycitySceneMotion | null = null;
  const owned: Material[] = [], heldAssets: Array<{ decRef(): unknown }> = [];
  let disposed = false, visible = false, paused = true, offCancel = () => {};
  const dispose = () => {
    if (disposed) return; disposed = true; offCancel();
    if (camera && isValid(camera, true)) camera.enabled = false;
    if (rig && isValid(rig, true)) { rig.active = false; rig.destroy(); }
    rig = null; camera = null; motion = null;
    for (const mat of owned.splice(0)) mat.destroy();
    for (const asset of heldAssets.splice(0)) asset.decRef();
    prefab = null;
  };
  offCancel = token.onCancel(dispose);
  const waitAsset = async <T extends { addRef(): unknown; decRef(): unknown }>(pending: Promise<T>): Promise<T> => {
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Skycity background disposed'); asset.addRef(); heldAssets.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Skycity scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & SKYCITY_LAYER) !== 0)) throw Error('Skycity layer visible to an existing camera');
    prefab = await waitAsset(loadRegionPrefab(REGIONS.skycity)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Skycity scene owner destroyed during load');
    rig = new Node('SkycityLiveScene'); rig.active = false; parent.addChild(rig);
    const model = instantiate(prefab); rig.addChild(model); setLayer(model);
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    for (const a of model.getComponentsInChildren(Animation)) a.playOnLoad = false;
    validateSkycity(model);
    owned.push(...applySkycityUnlit(model));
    const wanted = REGIONS.skycity.ambientClips || [];
    const host = model.getComponentsInChildren(Animation).find(a => wanted.every(name => (a.clips || []).some(c => c?.name === name)))?.node || model;
    if (!host.getComponent(SkeletalAnimation)) {
      const plain = host.getComponent(Animation);
      const skel = host.addComponent(SkeletalAnimation);
      skel.playOnLoad = false;
      skel.clips = (plain?.clips || []).filter((clip): clip is NonNullable<typeof clip> => !!clip);
    }
    const ambient = host.addComponent(RegionAmbientAnimation);
    ambient.clipNames = wanted.slice();
    ambient.gestureNames = [];
    const playback = host.getComponent(SkeletalAnimation);
    if (playback) for (const clip of playback.clips) if (clip && !playback.getState(clip.name)) playback.createState(clip);
    ambient.setHostPaused(true);
    await token.wait(ambient.prepare()); token.check();
    if (!isValid(parent, true) || !isValid(rig, true)) throw Error('Skycity scene owner destroyed during load');
    const robot = find(model, 'anchor_robot_root'); if (!robot) throw Error('Skycity robot anchor missing');
    const cameraNode = new Node('SkycityBackgroundCamera'); cameraNode.layer = SKYCITY_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 4000;
    camera.visibility = SKYCITY_LAYER; camera.priority = SKYCITY_CAMERA_PRIORITY; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#8ec5e8'); camera.enabled = false;
    motion = rig.addComponent(SkycitySceneMotion); motion.ambient = ambient; motion.camera = camera; motion.robot = robot;
    return {
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true) || !robot || !isValid(robot, true)) throw Error('Skycity camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Skycity requires current board layout');
        motion!.aspect = layout.width / layout.height; motion!.last = '';
        const p = robot.worldPosition, pose = skycityBoardPoseAt([p.x, p.y, p.z], motion!.aspect);
        if (!applyCameraPose(camera, fromLookAt(pose), 'skycity.board-background')) throw Error('Skycity camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; rig!.active = value; camera!.enabled = value; motion!.visible = value; motion!.ambient?.setHostPaused(paused || !value); },
      setPaused: value => { if (disposed) return; paused = value; motion!.hostPaused = value; motion!.ambient?.setHostPaused(value || !visible); if (visible && camera && isValid(camera, true)) camera.enabled = true; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'skycity', bundle: REGIONS.skycity.bundle, prefabName: REGIONS.skycity.prefabName, visible, paused, cameraPriority: SKYCITY_CAMERA_PRIORITY, layer: SKYCITY_LAYER, dynamicTextureUploads: 0 }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
