/**
 * 秋日铁路 board seat. Engine-independent (no 'cc').
 * RL_platform in env_rail.glb is one box. Its top is a single horizontal rectangle:
 * every top vertex y = 0.5, covering x [-2.5, 2.5] × z [-2.5, 2.5].
 * The 7×7 is inset on that plane. Cell y is the platform y, so the grid does not
 * float above the platform and does not cut into it.
 */
export const RAIL_BUNDLE = 'region_rail';
export const RAIL_PREFAB = 'env_rail';
/** Coplanar platform top authored in env_rail.glb (exact in float32). */
export const RAIL_PLATFORM = Object.freeze({
  y: 0.5,
  minX: -2.5,
  maxX: 2.5,
  minZ: -2.5,
  maxZ: 2.5,
});
/** Metres kept inside the platform edge so the outer cells stay on the plane. */
export const RAIL_BOARD_INSET = 0.375;
const shelfW = RAIL_PLATFORM.maxX - RAIL_PLATFORM.minX, shelfD = RAIL_PLATFORM.maxZ - RAIL_PLATFORM.minZ;
const side = Math.min(shelfW, shelfD) - RAIL_BOARD_INSET * 2;
export const RAIL_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (RAIL_PLATFORM.minX + RAIL_PLATFORM.maxX) / 2,
  cz: (RAIL_PLATFORM.minZ + RAIL_PLATFORM.maxZ) / 2,
  y: RAIL_PLATFORM.y,
});
export function isRailStage(id: unknown): boolean { return /^r07-rail-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the platform. */
export function railBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = RAIL_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function railCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('rail cell out of range: ' + index);
  const g = RAIL_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the platform. Positive would be floating; negative would be sunk into the stone. */
export function railBoardGap(): number { return railBoardBounds().min[1] - RAIL_PLATFORM.y; }
/** Board footprint is strictly inside the flat platform (not on the rails or the steps). */
export function railBoardOnPlatform(): boolean {
  const b = railBoardBounds(), s = RAIL_PLATFORM;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && railBoardGap() === 0;
}
/** Mild overhead, like the lakeside board camera: the platform shows around the grid. Taller screens keep horizontal coverage. */
export function railBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = railBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 46;
  if (a < ref) fov = 2 * Math.atan(Math.tan(46 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0], c[1] + 8.6, c[2] + 10.8],
    target: [c[0], c[1], c[2]],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
