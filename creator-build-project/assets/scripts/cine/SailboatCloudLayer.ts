/**
 * Soft cloud bank parented to the world camera. Fades out the island and in the meadow.
 * Not a Component. A missing builtin-unlit effect skips the bank (the caller keeps the island up).
 */
import { Camera, Color, EffectAsset, Layers, Material, Mesh, MeshRenderer, Node, utils, Vec3, view } from 'cc';
import { discGeometry } from '../render/IslandAtmosphereFxCore';
import { SAILBOAT_CLOUD_PUFFS, cloudShownAlpha } from './SailboatCloudLayout';

const ALPHA_BLEND = 3;

export interface SailboatCloudLayer {
  root: Node;
  mesh: Mesh;
  materials: Material[];
  puffs: { node: Node; material: Material; x: number; y: number; scale: number; phase: number; rgb: readonly [number, number, number] }[];
  time: number;
}

export function createSailboatCloudLayer(cameraNode: Node): SailboatCloudLayer | null {
  if (!EffectAsset.get('builtin-unlit')) { console.warn('[sailboat] builtin-unlit missing; cloud bank skipped'); return null; }
  const geometry = discGeometry(18, 0.62, 0.96, 0.32, 0.2, 11);
  const mesh = utils.createMesh({
    positions: geometry.positions, colors: geometry.colors, indices: geometry.indices,
    minPos: new Vec3(geometry.min[0], geometry.min[1], geometry.min[2]),
    maxPos: new Vec3(geometry.max[0], geometry.max[1], geometry.max[2]),
  });
  const root = new Node('SailboatCloudLayer');
  cameraNode.addChild(root);
  const layer = cloudLayerBit(cameraNode);
  root.layer = layer;
  const materials: Material[] = [];
  const puffs: SailboatCloudLayer['puffs'] = [];
  for (let i = 0; i < SAILBOAT_CLOUD_PUFFS.length; i++) {
    const spot = SAILBOAT_CLOUD_PUFFS[i];
    const material = new Material();
    material.initialize({ effectName: 'builtin-unlit', technique: ALPHA_BLEND, defines: { USE_VERTEX_COLOR: true } });
    material.setProperty('mainColor', new Color(spot[3], spot[4], spot[5], 0));
    materials.push(material);
    const node = new Node('SailboatCloudPuff');
    root.addChild(node);
    node.layer = layer;
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
    try { (renderer as MeshRenderer & { priority?: number }).priority = 240; } catch { /* optional */ }
    puffs.push({ node, material, x: spot[0], y: spot[1], scale: spot[2], phase: i * 0.7, rgb: [spot[3], spot[4], spot[5]] });
  }
  root.active = false;
  return { root, mesh, materials, puffs, time: 0 };
}

export function syncSailboatCloudLayer(bank: SailboatCloudLayer, cameraNode: Node, alpha: number, fovDeg: number, dt: number): void {
  const shown = cloudShownAlpha(alpha);
  const visible = shown > 1 / 255;
  if (bank.root.active !== visible) bank.root.active = visible;
  if (!visible || !bank.root.isValid) return;
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
  bank.time += step;
  const cam = cameraNode.getComponent(Camera);
  const near = cam && cam.near > 0 ? cam.near : 0.05;
  const dist = Math.max(near * 8, 0.45);
  const fov = (Number.isFinite(fovDeg) ? fovDeg : 45) * Math.PI / 180;
  const height = 2 * Math.tan(fov * 0.5) * dist;
  const frame = viewRatio();
  const width = height * frame;
  const span = Math.max(width, height);
  const byte = Math.round(shown * 255);
  for (let i = 0; i < bank.puffs.length; i++) {
    const puff = bank.puffs[i];
    const drift = Math.sin(bank.time * 0.35 + puff.phase) * 0.03;
    puff.node.setPosition((puff.x + drift) * width, puff.y * height, -dist - i * 0.015);
    const scale = puff.scale * span;
    puff.node.setScale(scale, scale, 1);
    puff.material.setProperty('mainColor', new Color(puff.rgb[0], puff.rgb[1], puff.rgb[2], byte));
  }
}

export function destroySailboatCloudLayer(bank: SailboatCloudLayer | null): void {
  if (!bank) return;
  if (bank.root.isValid) bank.root.destroy();
  for (let i = 0; i < bank.materials.length; i++) bank.materials[i].destroy();
  bank.mesh.destroy();
}

function cloudLayerBit(cameraNode: Node): number {
  const vis = cameraNode.getComponent(Camera)?.visibility || 0;
  if (vis & Layers.Enum.DEFAULT) return Layers.Enum.DEFAULT;
  if (vis) return vis & -vis;
  return Layers.Enum.DEFAULT;
}

function viewRatio(): number {
  try {
    const size = view.getVisibleSize();
    return size.width / Math.max(1, size.height);
  } catch { return 0.46; }
}
