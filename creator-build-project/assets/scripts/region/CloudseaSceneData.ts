/**
 * 黎明云海 board seat. Engine-independent (no 'cc').
 * CS_platform in env_cloudsea.glb is one slab. Its top is a single horizontal rectangle:
 * every top vertex y = 0.5, covering x [-2.5, 2.5] × z [-2.5, 2.5].
 * The 7×7 is inset on that plane. Cell y is the terrace y, so the grid does not
 * float above the stone and does not cut into it.
 */
export const CLOUDSEA_BUNDLE = 'region_cloudsea';
export const CLOUDSEA_PREFAB = 'env_cloudsea';
/** Coplanar terrace top authored in env_cloudsea.glb (exact in float32). */
export const CLOUDSEA_PLATFORM = Object.freeze({
  y: 0.5,
  minX: -2.5,
  maxX: 2.5,
  minZ: -2.5,
  maxZ: 2.5,
});
/** Metres kept inside the terrace edge so the outer cells stay on the plane. */
export const CLOUDSEA_BOARD_INSET = 0.375;
const shelfW = CLOUDSEA_PLATFORM.maxX - CLOUDSEA_PLATFORM.minX, shelfD = CLOUDSEA_PLATFORM.maxZ - CLOUDSEA_PLATFORM.minZ;
const side = Math.min(shelfW, shelfD) - CLOUDSEA_BOARD_INSET * 2;
export const CLOUDSEA_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (CLOUDSEA_PLATFORM.minX + CLOUDSEA_PLATFORM.maxX) / 2,
  cz: (CLOUDSEA_PLATFORM.minZ + CLOUDSEA_PLATFORM.maxZ) / 2,
  y: CLOUDSEA_PLATFORM.y,
});
export function isCloudseaStage(id: unknown): boolean { return /^r08-cloud-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the terrace. */
export function cloudseaBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = CLOUDSEA_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function cloudseaCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('cloudsea cell out of range: ' + index);
  const g = CLOUDSEA_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the terrace. Positive would be floating; negative would be sunk into the stone. */
export function cloudseaBoardGap(): number { return cloudseaBoardBounds().min[1] - CLOUDSEA_PLATFORM.y; }
/** Board footprint is strictly inside the flat terrace (not on the clouds, the jetty, or the flags). */
export function cloudseaBoardOnPlatform(): boolean {
  const b = cloudseaBoardBounds(), s = CLOUDSEA_PLATFORM;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && cloudseaBoardGap() === 0;
}
/** Mild overhead, like the railway board camera: the terrace shows around the grid. Taller screens keep horizontal coverage. */
export function cloudseaBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = cloudseaBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 46;
  if (a < ref) fov = 2 * Math.atan(Math.tan(46 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0], c[1] + 8.6, c[2] + 10.8],
    target: [c[0], c[1], c[2]],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
