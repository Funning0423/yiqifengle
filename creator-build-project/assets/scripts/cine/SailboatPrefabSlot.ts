/**
 * Drop the finished sailboat prefab on this component, or author resources/cine/sailboat.prefab.
 * One Component per file: Cocos rejects a script that declares two @ccclass types.
 */
import { _decorator, Component, Node, Prefab, Vec3, Color, MeshRenderer, Material, Mesh, utils, instantiate, EffectAsset } from 'cc';

const { ccclass, property } = _decorator;

export const SAILBOAT_PREFAB_SLOT = 'SailboatPrefabSlot';
export const SAILBOAT_PREFAB_RESOURCE = 'cine/sailboat';
const OPAQUE = 0;

@ccclass('SailboatPrefabSlot')
export class SailboatPrefabSlot extends Component {
  @property(Prefab)
  sailboatPrefab: Prefab | null = null;

  refresh() {
    const gone = this.node.children.slice();
    for (let i = 0; i < gone.length; i++) gone[i].destroy();
    if (this.sailboatPrefab) {
      const model = instantiate(this.sailboatPrefab);
      model.name = 'SailboatModel';
      this.node.addChild(model);
      return;
    }
    buildPlaceholder(this.node);
  }
}

function buildPlaceholder(slot: Node) {
  const root = new Node('SailboatPlaceholder');
  slot.addChild(root);
  if (!EffectAsset.get('builtin-unlit')) return;
  addBox(root, 'Hull', new Vec3(0, 0.15, 0), new Vec3(1.7, 0.32, 0.62), new Color(139, 90, 43, 255));
  addBox(root, 'Mast', new Vec3(-0.15, 0.95, 0), new Vec3(0.06, 1.3, 0.06), new Color(92, 64, 40, 255));
  addBox(root, 'Sail', new Vec3(0.15, 1.05, 0), new Vec3(0.02, 0.95, 0.72), new Color(244, 241, 232, 255));
}
function addBox(parent: Node, name: string, position: Vec3, size: Vec3, color: Color) {
  const node = new Node(name);
  parent.addChild(node);
  node.setPosition(position);
  node.layer = parent.layer;
  const material = new Material();
  material.initialize({ effectName: 'builtin-unlit', technique: OPAQUE });
  material.setProperty('mainColor', color);
  const renderer = node.addComponent(MeshRenderer);
  renderer.mesh = boxMesh(size.x, size.y, size.z);
  renderer.setMaterial(material, 0);
  renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
  renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
}
function boxMesh(sx: number, sy: number, sz: number): Mesh {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const positions: number[] = [];
  const push = (ax: number, ay: number, az: number) => { positions.push(ax, ay, az); };
  const face = (a: number[], b: number[], c: number[], d: number[]) => { push(a[0], a[1], a[2]); push(b[0], b[1], b[2]); push(c[0], c[1], c[2]); push(d[0], d[1], d[2]); };
  face([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]);
  face([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]);
  face([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]);
  face([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]);
  face([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]);
  face([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]);
  const indices: number[] = [];
  for (let f = 0; f < 6; f++) { const o = f * 4; indices.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  return utils.createMesh({ positions, indices, minPos: new Vec3(-x, -y, -z), maxPos: new Vec3(x, y, z) });
}
