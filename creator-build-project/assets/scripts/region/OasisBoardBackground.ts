import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { OASIS_BUNDLE, oasisBoardLook } from './OasisSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const OASIS_LAYER = 1 << 20;
export const OASIS_NODES = Object.freeze({ rig: 'OasisLiveScene', camera: 'OasisBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = OASIS_LAYER; for (const c of n.children) setLayer(c); }
/** The blockout behind the board. The 7×7 is painted into OA_ground (OasisSceneData); this lease only mounts that GLB
 *  and frames the courtyard. It does not touch the balloon, the fjord, or any other region's materials. */
export const createOasisBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
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
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Oasis background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Oasis scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & OASIS_LAYER) !== 0)) throw Error('Oasis layer visible to an existing camera');
    const def = REGIONS.oasis; if (!def || def.bundle !== OASIS_BUNDLE) throw Error('Oasis region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Oasis scene owner destroyed during load');
    rig = new Node(OASIS_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'OA_ground')) throw Error('Oasis courtyard missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(OASIS_NODES.camera); cameraNode.layer = OASIS_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = OASIS_LAYER; camera.priority = 44; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#4A241C'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'oasis');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Oasis camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Oasis requires current board layout');
        const look = oasisBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'oasis.board-background')) throw Error('Oasis camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'oasis', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 44, layer: OASIS_LAYER, seatedOn: 'OA_ground' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
