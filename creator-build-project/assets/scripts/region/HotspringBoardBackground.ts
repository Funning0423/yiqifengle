import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { HOTSPRING_BUNDLE, hotspringBoardLook } from './HotspringSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const HOTSPRING_LAYER = 1 << 20;
export const HOTSPRING_NODES = Object.freeze({ rig: 'HotspringLiveScene', camera: 'HotspringBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = HOTSPRING_LAYER; for (const c of n.children) setLayer(c); }
/** The blockout behind the board. The 7×7 sits on HS_platform (HotspringSceneData); this lease only mounts that GLB
 *  and frames the deck. It does not touch the balloon, the cloud sea, the railway, or any other region's materials. */
export const createHotspringBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
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
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Hotspring background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Hotspring scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & HOTSPRING_LAYER) !== 0)) throw Error('Hotspring layer visible to an existing camera');
    const def = REGIONS.spring; if (!def || def.bundle !== HOTSPRING_BUNDLE) throw Error('Hotspring region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Hotspring scene owner destroyed during load');
    rig = new Node(HOTSPRING_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'HS_platform')) throw Error('Hotspring deck missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(HOTSPRING_NODES.camera); cameraNode.layer = HOTSPRING_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = HOTSPRING_LAYER; camera.priority = 44; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#d7ebe4'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'spring');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Hotspring camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Hotspring requires current board layout');
        const look = hotspringBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'spring.board-background')) throw Error('Hotspring camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'spring', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 44, layer: HOTSPRING_LAYER, seatedOn: 'HS_platform' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
