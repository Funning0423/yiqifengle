import { _decorator, Component, Prefab, instantiate, director, Camera, Vec3, MeshRenderer, JsonAsset, Node } from 'cc';
import { NativeBoardUI } from './NativeBoardUI';
import { applySpecularCandidate } from './SpecularCandidate';
import { RuntimeProbe } from './RuntimeProbe';
import { hideNonShippingMeshes } from './AssetVisibility';
const { ccclass, property } = _decorator;

@ccclass('FirstsliceBoot')
export class FirstsliceBoot extends Component {
  @property(Prefab) model: Prefab | null = null;
  @property(JsonAsset) smokeFixture: JsonAsset | null = null;
  start() {
    const probeNode = new Node('DesktopRuntimeProbe'); this.node.addChild(probeNode);
    const probe = probeNode.addComponent(RuntimeProbe);
    (globalThis as any).__forestExportFrames = () => probe.exportEvidence({engine: '3.8.8', device: 'Mac desktop Chromium debug', phoneAcceptance: false});
    if (!this.model) throw new Error('Missing imported firstslice prefab');
    const model = instantiate(this.model); this.node.addChild(model);
    hideNonShippingMeshes(model, new Set(['env_interior_floor_skirt_preview', 'character_height_reference_1p626']));
    const materialCandidate = applySpecularCandidate(model);
    let renderers = 0; model.getComponentsInChildren(MeshRenderer).forEach(r => { if (r.enabled) renderers++; });
    const camera = director.getScene()?.getComponentsInChildren(Camera)[0];
    if (camera) { camera.visibility &= ~(1 << 25); camera.node.setPosition(8, 6, 12); camera.node.lookAt(new Vec3(0, 1, -2)); }
    const sceneReport = { status: 'instantiated', diagnosticCameraOnly: true, renderedComponents: renderers,
      BCharacter: 'not_delivered', actions: 'not_delivered', runtimeColliders: 'not_created', materialCandidate };
    (globalThis as any).__forestSceneSmoke = sceneReport;
    console.log('FOREST_SCENE_SMOKE ' + JSON.stringify(sceneReport));
    const ui = new Node('NativeBoardHost'); this.node.addChild(ui);
    ui.addComponent(NativeBoardUI).initialize(this.smokeFixture?.json, portrait => {
      if (!camera) return;
      camera.node.setPosition(portrait ? new Vec3(14, 11, 27) : new Vec3(8, 6, 12));
      camera.node.lookAt(portrait ? new Vec3(0, 4, -2) : new Vec3(0, 1, -2));
    });
  }
}
