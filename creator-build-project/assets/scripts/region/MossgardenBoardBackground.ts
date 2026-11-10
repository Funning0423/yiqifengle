import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { MOSSGARDEN_BUNDLE, mossgardenBoardLook } from './MossgardenSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const MOSSGARDEN_LAYER = 1 << 20;
export const MOSSGARDEN_NODES = Object.freeze({ rig: 'MossgardenLiveScene', camera: 'MossgardenBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = MOSSGARDEN_LAYER; for (const c of n.children) setLayer(c); }
/** The court behind the board. The 7×7 is painted into MG_ground (MossgardenSceneData); this lease only mounts that GLB
 *  and frames the moss garden. It does not touch the balloon, the harbor, or any other region's materials. */
export const createMossgardenBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
  let rig: Node | null = null, prefab: Prefab | null = null, camera: Camera | null = null;
  const held: Array<{ decRef(): unknown }> = [];
  let disposed = false, visible = false, paused = true, offCancel = () => {};
  const dispose = () => {
    if (disposed) return; disposed = true; offCancel();
    if (camera && isValid(camera, true)) camera.enabled = false;
    if (rig && isValid(rig, true)) { rig.active = false; rig.destroy(); }
    rig = null; camera = null;
    for (const a of held.splice(0)) a.decRef(); prefab = null;
  };
  offCancel = token.onCancel(dispose);
  const waitAsset = async <T extends { addRef(): unknown; decRef(): unknown }>(pending: Promise<T>): Promise<T> => {
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Mossgarden background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Mossgarden scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & MOSSGARDEN_LAYER) !== 0)) throw Error('Mossgarden layer visible to an existing camera');
    const def = REGIONS.mossgarden; if (!def || def.bundle !== MOSSGARDEN_BUNDLE) throw Error('Mossgarden region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Mossgarden scene owner destroyed during load');
    rig = new Node(MOSSGARDEN_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'MG_ground')) throw Error('Mossgarden court missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(MOSSGARDEN_NODES.camera); cameraNode.layer = MOSSGARDEN_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = MOSSGARDEN_LAYER; camera.priority = 45; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#E07A48'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'mossgarden');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Mossgarden camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Mossgarden requires current board layout');
        const look = mossgardenBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'mossgarden.board-background')) throw Error('Mossgarden camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'mossgarden', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 45, layer: MOSSGARDEN_LAYER, seatedOn: 'MG_ground' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
