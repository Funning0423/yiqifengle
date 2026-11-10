import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { CLOUDSEA_BUNDLE, cloudseaBoardLook } from './CloudseaSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const CLOUDSEA_LAYER = 1 << 20;
export const CLOUDSEA_NODES = Object.freeze({ rig: 'CloudseaLiveScene', camera: 'CloudseaBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = CLOUDSEA_LAYER; for (const c of n.children) setLayer(c); }
/** The blockout behind the board. The 7×7 sits on CS_platform (CloudseaSceneData); this lease only mounts that GLB
 *  and frames the terrace. It does not touch the balloon, the railway, the snow, or any other region's materials. */
export const createCloudseaBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
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
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Cloudsea background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Cloudsea scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & CLOUDSEA_LAYER) !== 0)) throw Error('Cloudsea layer visible to an existing camera');
    const def = REGIONS.cloud; if (!def || def.bundle !== CLOUDSEA_BUNDLE) throw Error('Cloudsea region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Cloudsea scene owner destroyed during load');
    rig = new Node(CLOUDSEA_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'CS_platform')) throw Error('Cloudsea terrace missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(CLOUDSEA_NODES.camera); cameraNode.layer = CLOUDSEA_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = CLOUDSEA_LAYER; camera.priority = 44; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#f6d5c8'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'cloud');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Cloudsea camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Cloudsea requires current board layout');
        const look = cloudseaBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'cloud.board-background')) throw Error('Cloudsea camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'cloud', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 44, layer: CLOUDSEA_LAYER, seatedOn: 'CS_platform' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
