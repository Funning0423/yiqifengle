/**
 * 雪山风铃山口 board seat. Engine-independent (no 'cc').
 * The grey-box ground (SP_ground in SP_snowpass.glb) is low-poly and sloped. One shelf is a
 * single plane: nine upward faces, every vertex y = 0.34915465116500854, covering
 * x [-10.304115295410156, -5.824066162109375] × z [-1.956207275390625, 2.204010009765625].
 * The 7×7 board is inset on that plane (lake fusion: the carrier IS the surface). Cell y is
 * the shelf y, so the grid does not float above the snow and does not cut into it.
 */
export const SNOWPASS_BUNDLE = 'region_snowpass';
export const SNOWPASS_PREFAB = 'SP_snowpass';
/** Coplanar snow shelf measured from the Draco mesh of SP_ground. */
export const SNOW_SHELF = Object.freeze({
  y: 0.34915465116500854,
  minX: -10.304115295410156,
  maxX: -5.824066162109375,
  minZ: -1.956207275390625,
  maxZ: 2.204010009765625,
});
/** Metres kept inside the shelf edge so the outer cells stay on the plane, not on the slope. */
export const SNOW_BOARD_INSET = 0.04;
const shelfW = SNOW_SHELF.maxX - SNOW_SHELF.minX, shelfD = SNOW_SHELF.maxZ - SNOW_SHELF.minZ;
const side = Math.min(shelfW, shelfD) - SNOW_BOARD_INSET * 2;
export const SNOW_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (SNOW_SHELF.minX + SNOW_SHELF.maxX) / 2,
  cz: (SNOW_SHELF.minZ + SNOW_SHELF.maxZ) / 2,
  y: SNOW_SHELF.y,
});
export function isSnowpassStage(id: unknown): boolean { return /^r06-snow-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the shelf. */
export function snowpassBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = SNOW_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function snowpassCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('snowpass cell out of range: ' + index);
  const g = SNOW_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the shelf. Positive would be floating; negative would be sunk into the snow. */
export function snowpassBoardGap(): number { return snowpassBoardBounds().min[1] - SNOW_SHELF.y; }
/** Board footprint is strictly inside the flat shelf (not on the sloping ground around it). */
export function snowpassBoardOnShelf(): boolean {
  const b = snowpassBoardBounds(), s = SNOW_SHELF;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && snowpassBoardGap() === 0;
}
/** Mild overhead, like the lakeside board camera: the shelf (snow) shows around the grid. Taller screens keep horizontal coverage. */
export function snowpassBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = snowpassBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 46;
  if (a < ref) fov = 2 * Math.atan(Math.tan(46 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0], c[1] + 4.8, c[2] + 6.4],
    target: [c[0], c[1], c[2]],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
