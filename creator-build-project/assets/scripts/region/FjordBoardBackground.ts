import { bgCamWant } from './BgCamGate';
import { createSceneFade } from './BoardBackgroundFade';
import { Camera, Color, Node, Prefab, director, isValid } from 'cc';
import { REGIONS, loadRegionPrefab, mountRegion } from './RegionLoader';
import { FJORD_BUNDLE, fjordBoardLook } from './FjordSceneData';
import { applyCameraPose, fromLookAt } from '../world-r1/CameraPose';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
/** Same exclusive background layer as meadow / lakeside / sky-city (never two board leases at once). */
export const FJORD_LAYER = 1 << 20;
export const FJORD_NODES = Object.freeze({ rig: 'FjordLiveScene', camera: 'FjordBackgroundCamera' });
function find(n: Node, name: string): Node | null { if (n.name === name) return n; for (const c of n.children) { const h = find(c, name); if (h) return h; } return null; }
function setLayer(n: Node) { n.layer = FJORD_LAYER; for (const c of n.children) setLayer(c); }
/** The blockout behind the board. The 7×7 sits on FJ_platform (FjordSceneData); this lease only mounts that GLB
 *  and frames the pier. It does not touch the balloon, the hot spring, or any other region's materials. */
export const createFjordBoardBackground: LevelBackgroundFactory = async ({ parent, token }) => {
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
    const asset = await token.wait(pending); token.check(); if (disposed) throw Error('Fjord background disposed');
    asset.addRef(); held.push(asset); return asset;
  };
  try {
    token.check(); const scene = director.getScene(); if (!scene || !isValid(parent, true)) throw Error('Fjord scene owner missing');
    if (scene.getComponentsInChildren(Camera).some(c => c.enabled && (c.visibility & FJORD_LAYER) !== 0)) throw Error('Fjord layer visible to an existing camera');
    const def = REGIONS.fjord; if (!def || def.bundle !== FJORD_BUNDLE) throw Error('Fjord region is not registered');
    prefab = await waitAsset(loadRegionPrefab(def)); token.check();
    if (!isValid(parent, true) || !isValid(scene, true)) throw Error('Fjord scene owner destroyed during load');
    rig = new Node(FJORD_NODES.rig); rig.active = false; parent.addChild(rig);
    const model = mountRegion(def, prefab, rig); setLayer(model);
    if (!find(model, 'FJ_platform')) throw Error('Fjord pier missing');
    for (const c of model.getComponentsInChildren(Camera)) c.enabled = false;
    const cameraNode = new Node(FJORD_NODES.camera); cameraNode.layer = FJORD_LAYER; rig.addChild(cameraNode);
    camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.PERSPECTIVE; camera.fovAxis = Camera.FOVAxis.VERTICAL; camera.near = 0.1; camera.far = 1000;
    camera.visibility = FJORD_LAYER; camera.priority = 44; camera.usePostProcess = false;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color('#071428'); camera.enabled = false;
    rig.active = true;
    const fade = createSceneFade(() => rig, () => camera, 'fjord');
    return {
      setFade: a => { if (!disposed) fade(a); },
      frame: (_portrait, layout) => {
        if (disposed) return; token.check();
        if (!camera || !isValid(camera, true) || !isValid(camera.node, true)) throw Error('Fjord camera owner destroyed');
        if (!layout || !(layout.width > 0 && layout.height > 0)) throw Error('Fjord requires current board layout');
        const look = fjordBoardLook(layout.width / layout.height);
        if (!applyCameraPose(camera, fromLookAt(look), 'fjord.board-background')) throw Error('Fjord camera pose rejected');
      },
      setVisible: value => { if (disposed) return; visible = value; bgCamWant(camera!, value); },
      setPaused: value => { if (disposed) return; paused = value; },
      diagnostics: () => ({ renderer: 'region-live-3d', region: 'fjord', bundle: def.bundle, prefabName: def.prefabName, visible, paused, cameraPriority: 44, layer: FJORD_LAYER, seatedOn: 'FJ_platform' }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
