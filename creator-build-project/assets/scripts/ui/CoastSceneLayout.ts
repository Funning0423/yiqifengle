/**
 * Coast placement core from the f9c5656a loader contract (CoastSceneLayout.ts). Engine-free.
 * position = p, euler = (tilt[0], rz*180/PI, tilt[1]) degrees, uniform scale s.
 * Coast root in the island scene_root frame: COAST_ROOT.position, yaw 180.
 */
export type V3 = [number, number, number];
export type CoastLayoutEntry = Readonly<{ mesh: string; p: V3; rz: number; s: number; tilt?: [number, number]; reuse?: boolean; piece?: boolean; cast_shadow?: boolean; receive_shadow?: boolean; anim?: string; k?: number; board_cell?: unknown }>;
export type CoastLayout = Readonly<{ placement?: { position: V3; yaw_deg: number; scale: number }; layout: readonly CoastLayoutEntry[] }>;
export type MatKind = 'std' | 'unlit';
export type CoastInstance = Readonly<{ index: number; mesh: string; reuse: boolean; position: V3; eulerDeg: V3; scale: number; kind: MatKind; alpha: number; palette: boolean; castShadow: boolean; receiveShadow: boolean; anim: string | null }>;

export const COAST_BUNDLE = 'region_coast';
export const COAST_LAYOUT_PATH = 'data/coast_layout';
export const COAST_PALETTE_PATH = 'textures/coast_palette_256/texture';
export const COAST_PALETTE_SAND_PATH = 'textures/coast_palette_sand_256/texture';
export const COAST_SAND_TINT = Object.freeze({ srgb: '#E9D7B0', amount: 0.38 });
export const COAST_MODELS_DIR = 'models';
export const COAST_ROOT = Object.freeze({ name: 'region_coast_root', position: [-0.6, -0.845, 21.5] as V3, yawDeg: 180, scale: 1 });
/** unlit / emit / alpha < 1. Everything else: std, alpha 1. */
export const COAST_MESH_FLAGS: Readonly<Record<string, { unlit?: boolean; emit?: boolean; alpha?: number }>> = Object.freeze({
  beacon_lamp: { emit: true }, foam: { unlit: true, alpha: 0.92 }, foam_inner: { unlit: true, alpha: 0.55 }, beacon_line: { unlit: true, emit: true, alpha: 0.9 },
  tide_sheet: { alpha: 0.6 }, sidepool: { alpha: 0.7 },
});
const CAST_RE = /^rock_|^reuse_rock|ebb_bell|crab|gull|hermit|headland|beacon_post|reuse_palm|reuse_bush/;

export function coastInstances(L: CoastLayout): CoastInstance[] {
  const out: CoastInstance[] = [];
  L.layout.forEach((e, index) => {
    if (e.piece || /^piece_/.test(e.mesh)) return;
    const f = COAST_MESH_FLAGS[e.mesh] || {}, unlit = !!(f.unlit || f.emit);
    out.push({
      index, mesh: e.mesh, reuse: !!e.reuse, position: [e.p[0], e.p[1], e.p[2]],
      eulerDeg: [e.tilt ? e.tilt[0] : 0, e.rz * 180 / Math.PI, e.tilt ? e.tilt[1] : 0], scale: e.s, kind: unlit ? 'unlit' : 'std', alpha: f.alpha ?? 1, palette: (f.alpha ?? 1) >= 1 && !unlit,
      castShadow: !!(e.cast_shadow || CAST_RE.test(e.mesh)) && !unlit, receiveShadow: !(e.receive_shadow === false || unlit), anim: e.anim ?? null,
    });
  });
  return out;
}
export function coastWorldOf(p: V3, root = COAST_ROOT): V3 {
  const a = root.yawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = root.scale;
  return [root.position[0] + k * (c * p[0] + s * p[2]), root.position[1] + k * p[1], root.position[2] + k * (-s * p[0] + c * p[2])];
}
export type CoastReuseSource = Readonly<{ count: number; src: string; from: 'island' | 'region_coast'; norm?: Readonly<{ scale: number; offsetY: number }>; tint?: 'sand'; note?: string }>;
export const COAST_REUSE_SOURCES: Readonly<Record<string, CoastReuseSource>> = Object.freeze({
  reuse_grass_a: { count: 25, src: 'env_prop_grass_tuft_01', from: 'region_coast' }, reuse_grass_b: { count: 19, src: 'env_prop_grass_tuft_02', from: 'region_coast' },
  reuse_flowers: { count: 16, src: 'env_prop_flowers_01', from: 'region_coast' },
  reuse_rock_0: { count: 3, src: 'env_prop_rock_01', from: 'region_coast', norm: { scale: 1.84991, offsetY: -0.1777 } }, reuse_rock_1: { count: 3, src: 'env_prop_rock_02', from: 'region_coast', norm: { scale: 1.07753, offsetY: -0.15926 } },
  reuse_rock_2: { count: 1, src: 'env_prop_rock_03', from: 'region_coast', norm: { scale: 0.56613, offsetY: -0.15944 } },
  reuse_rock_s0: { count: 5, src: 'env_prop_rock_01', from: 'region_coast', norm: { scale: 1.84991, offsetY: -0.1777 }, tint: 'sand' }, reuse_rock_s1: { count: 7, src: 'env_prop_rock_02', from: 'region_coast', norm: { scale: 1.07753, offsetY: -0.15926 }, tint: 'sand' },
  reuse_rock_s2: { count: 6, src: 'env_prop_rock_03', from: 'region_coast', norm: { scale: 0.56613, offsetY: -0.15944 }, tint: 'sand' },
  reuse_bush: { count: 3, src: 'env_prop_hydrangea_bush_01', from: 'region_coast' },
  reuse_palm_tall: { count: 2, src: 'env_prop_palm_tall_01', from: 'island' }, reuse_palm_lean: { count: 1, src: 'env_prop_palm_lean_01', from: 'island' },
});
export const COAST_ISLAND_REUSE = Object.freeze(Object.keys(COAST_REUSE_SOURCES).filter((k) => COAST_REUSE_SOURCES[k].from === 'island'));
export const COAST_MATERIAL_KEYS = Object.freeze(Object.keys(COAST_MESH_FLAGS));
