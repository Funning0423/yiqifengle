/**
 * 风铃湖畔 (region_lakeside, r5h3) scene facts for the board background. Engine-independent (no 'cc'), unit-tested in Node.
 * Source: art/regions/lakeside/COCOS_HANDOFF.md §3–§5 and bundles/region_lakeside/scene_r5h3_lighting.json.
 * Units: metres, glTF/Cocos Y-up. The board is a 7×7 grid on the water: cell centre x=-3.3+1.1·col, z=8.7+1.1·row.
 */
export const LAKESIDE_BUNDLE = 'region_lakeside';
export const LAKESIDE_TRANSFORMS = 'scene_r5h_slim_transforms';
export const LAKESIDE_MODELS_DIR = 'models';
/** Lakeside challenge ids from LEVELS_DRAFT_lakeside.json ('r04-lake-0N'); a future r05 renumbering also matches. */
export function isLakesideStage(id: unknown): boolean { return /^r0[45]-lake-\d+$/.test(String(id || '')); }
export const LAKESIDE_GRID = Object.freeze({ cols: 7, rows: 7, cell: 1.1, x0: -3.3, z0: 8.7, y: 0 });
export function lakesideCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('lakeside cell out of range: ' + index);
  const col = index % 7, row = Math.floor(index / 7);
  return [+(LAKESIDE_GRID.x0 + LAKESIDE_GRID.cell * col).toFixed(4), LAKESIDE_GRID.y, +(LAKESIDE_GRID.z0 + LAKESIDE_GRID.cell * row).toFixed(4)];
}
/** Outer edges of the 7×7 cells (half a cell beyond the outer centres). */
export const LAKESIDE_BOARD_BOUNDS = Object.freeze({ min: [-3.85, 0, 8.15] as const, max: [3.85, 0, 15.85] as const, center: [0, 0, 12] as const });
/** Handoff §4 board camera, authored for 720×1280 portrait. */
export const LAKESIDE_BOARD_CAMERA = Object.freeze({
  position: [0.0, 13.2, 26.5] as const, rotation: [-0.22109, 0, 0, 0.97525] as const, forward: [0.0, -0.4312, -0.9022] as const,
  fovVerticalDeg: 61.928, near: 0.1, far: 1000, referenceAspect: 720 / 1280,
});
/** Same pose at any aspect: taller-than-reference screens keep the authored horizontal coverage (wider vertical FOV, capped at
 *  the 75° camera limit); wider screens keep the authored vertical FOV. Position/rotation never change, so a later
 *  travel/landing camera can end exactly on this pose. */
export function lakesideBoardPose(aspect: number): { position: [number, number, number]; rotation: [number, number, number, number]; fovVerticalDeg: number } {
  const c = LAKESIDE_BOARD_CAMERA, a = Number.isFinite(aspect) && aspect > 0 ? aspect : c.referenceAspect;
  let fov = c.fovVerticalDeg;
  if (a < c.referenceAspect) fov = 2 * Math.atan(Math.tan(c.fovVerticalDeg * Math.PI / 360) * c.referenceAspect / a) * 180 / Math.PI;
  return { position: [...c.position] as [number, number, number], rotation: [...c.rotation] as [number, number, number, number], fovVerticalDeg: +Math.min(75, fov).toFixed(3) };
}
export type LakesideLight = Readonly<{ name: string; forward: readonly number[]; colorLinear: readonly number[]; ratio: number; onlyLayer?: string }>;
/** Handoff §5 suns. Cocos has one main DirectionalLight (owned by the world scene), so the lease places each sun as a
 *  far SphereLight on the layer, `LAKESIDE_SUN_DISTANCE` m up-light from the board centre (nearly parallel over the board),
 *  with luminance scaled by the handoff ratios 1 / 0.08 / 0.22 / 0.31. SUN_mtn_sky only lights MTN_RECV → skipped. */
export const LAKESIDE_LIGHTS: readonly LakesideLight[] = Object.freeze([
  { name: 'Sun', forward: [-0.4182, -0.3983, 0.8164], colorLinear: [1.0, 0.6, 0.32], ratio: 1.0 },
  { name: 'Sun.001', forward: [0.5014, -0.6217, -0.6017], colorLinear: [0.212, 0.631, 0.745], ratio: 0.08 },
  { name: 'SUN_mtn_sky', forward: [-0.7318, -0.575, -0.3659], colorLinear: [1.0, 0.72, 0.48], ratio: 0.22, onlyLayer: 'MTN_RECV' },
  { name: 'SUN_dusk_side', forward: [-0.9629, -0.223, 0.152], colorLinear: [1.0, 0.55, 0.28], ratio: 0.31 },
]);
export const LAKESIDE_SUN_DISTANCE = 220;
export function lakesideLightPosition(l: LakesideLight): [number, number, number] {
  const c = LAKESIDE_BOARD_BOUNDS.center, d = LAKESIDE_SUN_DISTANCE;
  return [+(c[0] - l.forward[0] * d).toFixed(3), +(c[1] - l.forward[1] * d).toFixed(3), +(c[2] - l.forward[2] * d).toFixed(3)];
}
const linToSrgb8 = (c: number) => Math.round(255 * Math.max(0, Math.min(1, c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)));
export function lakesideLightSrgb(l: LakesideLight): [number, number, number] { return [linToSrgb8(l.colorLinear[0]), linToSrgb8(l.colorLinear[1]), linToSrgb8(l.colorLinear[2])]; }
/** Warm dusk clear colour behind the far hills (no skybox in the bundle). */
export const LAKESIDE_CLEAR_COLOR = '#f2b98a';
export type LakesideInstance = Readonly<{ name: string; glb: string; group: string; pos: readonly number[]; rot_quat_xyzw: readonly number[]; scale: readonly number[]; animated?: boolean }>;
/** The 2D board UI draws pieces, cells and selection. The live scene keeps the background and the static water dressing
 *  (lily pads, rope floats, buoy lanterns, white-balance lines, chime rafts), and drops what the 2D board already shows:
 *  3D match pieces, their contact shadows / ripple rings, and the board frame whose GLB is not in the subpackage. */
export const LAKESIDE_SKIPPED_GLB: readonly string[] = Object.freeze(['LK_board_frame.glb', 'LK_contact_shadow.glb', 'LK_ripple_ring.glb']);
export function lakesideSceneInstances(instances: readonly LakesideInstance[]): LakesideInstance[] {
  if (!Array.isArray(instances) || !instances.length) throw Error('lakeside transforms empty');
  return instances.filter(i => i && typeof i.glb === 'string' && !LAKESIDE_SKIPPED_GLB.includes(i.glb) && !/^LK_piece_/.test(i.glb));
}
export function lakesidePrefabName(glb: string): string { return String(glb).replace(/\.glb$/i, ''); }
