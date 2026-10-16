/**
 * Soft cloud bank parented to the world camera. Fades out the island and in the meadow.
 * Each puff is a quad with a procedural fBm cloud texture (SailboatCloudTexture, no downloaded
 * art). Puffs dissolve in one after another from the edges and open from the centre.
 * Not a Component. A missing builtin-unlit effect skips the bank (the caller keeps the island up).
 */
import { Camera, Color, EffectAsset, ImageAsset, Layers, Material, Mesh, MeshRenderer, Node, Texture2D, utils, Vec3, view } from 'cc';
import { SAILBOAT_CLOUD_PUFFS, cloudShownAlpha } from './SailboatCloudLayout';
import { SAILBOAT_CLOUD_TEX_SIZE, cloudNightTint, puffDissolveAlpha, puffPlacement, sailboatCloudPixels } from './SailboatCloudTexture';
import { uiNightWeight } from '../ui/NightTint';

const CLOUD_TEXTURE_SEEDS = [11, 23, 37];

const ALPHA_BLEND = 3;

export interface SailboatCloudLayer {
  root: Node;
  mesh: Mesh;
  materials: Material[];
  textures: Texture2D[];
  puffs: { node: Node; material: Material; x: number; y: number; scale: number; phase: number; rank: number; rgb: readonly [number, number, number] }[];
  time: number;
}

export function createSailboatCloudLayer(cameraNode: Node): SailboatCloudLayer | null {
  if (!EffectAsset.get('builtin-unlit')) { console.warn('[sailboat] builtin-unlit missing; cloud bank skipped'); return null; }
  const mesh = utils.createMesh({
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    uvs: [0, 1, 1, 1, 1, 0, 0, 0],
    indices: [0, 1, 2, 0, 2, 3],
    minPos: new Vec3(-1, -1, 0), maxPos: new Vec3(1, 1, 0),
  });
  const textures = CLOUD_TEXTURE_SEEDS.map(makeCloudTexture);
  const root = new Node('SailboatCloudLayer');
  cameraNode.addChild(root);
  const layer = cloudLayerBit(cameraNode);
  root.layer = layer;
  const materials: Material[] = [];
  const puffs: SailboatCloudLayer['puffs'] = [];
  for (let i = 0; i < SAILBOAT_CLOUD_PUFFS.length; i++) {
    const spot = SAILBOAT_CLOUD_PUFFS[i];
    const material = new Material();
    material.initialize({ effectName: 'builtin-unlit', technique: ALPHA_BLEND, defines: { USE_TEXTURE: true } });
    material.setProperty('mainTexture', textures[i % textures.length]);
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
    puffs.push({ node, material, x: spot[0], y: spot[1], scale: spot[2], phase: i * 0.7, rank: spot[6], rgb: [spot[3], spot[4], spot[5]] });
  }
  root.active = false;
  return { root, mesh, materials, textures, puffs, time: 0 };
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
  let night = 0;
  try { night = uiNightWeight(); } catch { night = 0; }
  for (let i = 0; i < bank.puffs.length; i++) {
    const puff = bank.puffs[i];
    const drift = Math.sin(bank.time * 0.35 + puff.phase) * 0.03;
    const a = puffDissolveAlpha(shown, puff.rank);
    const byte = Math.round(a * 255);
    puff.node.active = byte > 0;
    const at = puffPlacement(puff.x + drift, puff.y, puff.scale, a);
    // Later puffs draw nearer. Depth is compensated so every puff keeps its authored on-screen size.
    const depth = dist + (bank.puffs.length - 1 - i) * 0.012;
    const k = depth / dist;
    puff.node.setPosition(at.x * width * k, at.y * height * k, -depth);
    const scale = at.scale * span * k;
    puff.node.setScale(scale, scale, 1);
    const rgb = cloudNightTint(puff.rgb, night);
    puff.material.setProperty('mainColor', new Color(rgb[0], rgb[1], rgb[2], byte));
  }
}

export function destroySailboatCloudLayer(bank: SailboatCloudLayer | null): void {
  if (!bank) return;
  if (bank.root.isValid) bank.root.destroy();
  for (let i = 0; i < bank.materials.length; i++) bank.materials[i].destroy();
  for (let i = 0; i < bank.textures.length; i++) bank.textures[i].destroy();
  bank.mesh.destroy();
}

function makeCloudTexture(seed: number): Texture2D {
  const size = SAILBOAT_CLOUD_TEX_SIZE;
  const image = new ImageAsset({ _data: sailboatCloudPixels(size, seed), _compressed: false, width: size, height: size, format: Texture2D.PixelFormat.RGBA8888 });
  const texture = new Texture2D();
  texture.image = image;
  texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
  texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
  return texture;
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
