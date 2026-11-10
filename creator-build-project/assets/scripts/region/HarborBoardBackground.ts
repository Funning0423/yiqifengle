import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { HARBOR_BUNDLE, harborBoardLook } from './HarborSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const HARBOR_LAYER = 1 << 20;
export const HARBOR_NODES = Object.freeze({ rig: 'HarborLiveScene', camera: 'HarborBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = HARBOR_LAYER; for (const c of n.children) setLayer(c); }
/** The terrace behind the board. The 7×7 is painted into HB_ground (HarborSceneData); this lease only mounts that GLB
 *  and frames the harbor. It does not touch the balloon, the oasis, or any other region's materials. */
export const createHarborBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
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
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Harbor background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Harbor scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & HARBOR_LAYER) !== 0)) throw Error('Harbor layer visible to an existing camera');
    const def = REGIONS.harbor; if (!def || def.bundle !== HARBOR_BUNDLE) throw Error('Harbor region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Harbor scene owner destroyed during load');
    rig = new Node(HARBOR_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'HB_ground')) throw Error('Harbor terrace missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(HARBOR_NODES.camera); cameraNode.layer = HARBOR_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = HARBOR_LAYER; camera.priority = 45; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#C45A3A'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'harbor');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Harbor camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Harbor requires current board layout');
        const look = harborBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'harbor.board-background')) throw Error('Harbor camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'harbor', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 45, layer: HARBOR_LAYER, seatedOn: 'HB_ground' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
