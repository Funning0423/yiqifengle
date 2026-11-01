import './SharedBundles';
import { _decorator, Component, assetManager, Prefab, Node, instantiate, isValid, director, Camera, Vec3, MeshRenderer, SkeletalAnimation } from 'cc';
import { PreviewLease } from './static-seat/PreviewLease';
import { FIRSTSLICE } from './world-r1/FirstsliceFacts';
import { homePoseEntry } from './world-r1/RegionCameraData';
import { hideNonShippingMeshes } from './AssetVisibility';
import { RoomLightingRig } from './render/RoomLightingRig';
const { ccclass } = _decorator;
const INPUT_SHA = '4771351fb5e200a21cc4c03ab44ff6b9067237ef16b64568d255a47343adb942';
const ROOM_SHA = '8ae5efeb5f318b22411c0033f450b6de7a935fa3a27fb45d3f3cf240f88e2e42';
/** Isolated editor preview, never the production start scene. The fused stool cannot walk.
 * Runtime motion/storage are intentionally absent until a matched animated asset is ready. */
@ccclass('StaticSeatedPreviewBoot')
export class StaticSeatedPreviewBoot extends Component {
  private lease = new PreviewLease<Node>(n => { if (isValid(n, true)) { n.active = false; n.destroy(); } });
  private version = 0; private disposed = false; private lighting: RoomLightingRig | null = null;
  private status: any = { state: 'new', originalInputSHA256: INPUT_SHA, previewRoomSHA256: ROOM_SHA, actorSHA256: '6667393b50aa9876eb760af6f229c3a2a83ccc70729c4015b7beb5f9e920b478', sourceHashesAreBuildProvenance: true, animationAccepted: false, engineAccepted: false };
  private api: any = null;
  start() { this.api = { snapshot: () => JSON.parse(JSON.stringify(this.status)), reload: (scale = 1.2) => this.reload(scale) }; (globalThis as any).__staticSeatedPreview = this.api; void this.reload(); }
  async reload(scale = 1.2) {
    if (this.disposed) return;
    if (scale !== 1 && scale !== 1.2) throw Error('Only measured uniform scales 1 or 1.2');
    const version = ++this.version; this.lighting?.dispose(); this.lighting = null; this.status = { ...this.status, state: 'loading', uniformScale: scale, error: null };
    try {
      const owner = await this.lease.load(async () => {
        const bundle: any = assetManager.getBundle('static_seat_preview') || await new Promise((ok, fail) => assetManager.loadBundle('static_seat_preview', (e, b) => e || !b ? fail(e || Error('preview-bundle-missing')) : ok(b)));
        const one = (path: string) => new Promise<Prefab>((ok, fail) => bundle.loadDir(path, Prefab, (e: any, list: Prefab[]) => e || list?.length !== 1 ? fail(e || Error('preview-prefab-count:' + path)) : ok(list[0])));
        const [room, actor] = await Promise.all([one('room'), one('actor')]);
        const own = new Node('StaticSeatPreviewOwned'); own.active = false;
        try {
          const model = instantiate(room); model.name = 'StaticSeatRoom'; own.addChild(model);
          const wrapper = new Node('SeatedWholeShell'); own.addChild(wrapper); const girl = instantiate(actor); wrapper.addChild(girl);
          if (girl.getComponentsInChildren(SkeletalAnimation).length) throw Error('Unexpected rig: static intake contract changed');
          const sx = .00037, sz = -.09094, yaw = -2, a = FIRSTSLICE.anchors.seat_anchor.position;
          wrapper.setPosition(a[0] - scale * (Math.cos(yaw) * sx + Math.sin(yaw) * sz), .000126, a[2] - scale * (-Math.sin(yaw) * sx + Math.cos(yaw) * sz));
          wrapper.setRotationFromEuler(0, yaw * 180 / Math.PI, 0); wrapper.setScale(scale, scale, scale);
          hideNonShippingMeshes(model, new Set(['env_interior_floor_skirt_preview', 'character_height_reference_1p626']));
          return own;
        } catch (error) { own.destroy(); throw error; }
      });
      if (this.disposed || version !== this.version || !isValid(this.node, true)) return;
      this.node.addChild(owner); owner.active = true;
      const scene = director.getScene(); if (!scene) throw Error('preview-scene-missing'); const camera = scene.getComponentsInChildren(Camera)[0]; if (!camera) throw Error('preview-camera-missing');
      const pose = homePoseEntry(); camera.node.setWorldPosition(...pose.position); camera.node.lookAt(new Vec3(...pose.target)); camera.fov = pose.fovVerticalDeg;
      const model = owner.getChildByName('StaticSeatRoom')!, girl = owner.getChildByName('SeatedWholeShell')!;
      this.lighting = new RoomLightingRig(scene, model, girl); this.lighting.setView(true, false, false);
      this.status = { ...this.status, state: 'ready', view: 'isolated-static-seat', worldTranslation: [girl.position.x, girl.position.y, girl.position.z], camera: pose, rendererCount: owner.getComponentsInChildren(MeshRenderer).length, floorAlignment: 'lowest shoe on source floor; stool feet retain original 3–4mm local clearance', sceneChanges: 'complete original chair removed; whole user heroine+stool preserved' };
      console.info('STATIC_SEAT_PREVIEW_READY', this.status);
    } catch (error) { if (!this.disposed && version === this.version) { this.lighting?.dispose(); this.lighting = null; this.lease.clear(); this.status = { ...this.status, state: 'error', error: String(error) }; console.error('STATIC_SEAT_PREVIEW_FAILED', error); } }
  }
  onDestroy() { this.disposed = true; ++this.version; this.lighting?.dispose(); this.lighting = null; this.lease.dispose(); if ((globalThis as any).__staticSeatedPreview === this.api) delete (globalThis as any).__staticSeatedPreview; }
}
