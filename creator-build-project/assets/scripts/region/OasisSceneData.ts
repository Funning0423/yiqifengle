/**
 * 沙漠绿洲庭院 board seat. Engine-independent (no 'cc').
 * OA_ground in env_oasis.glb is the courtyard sand-brick floor. Its top is one
 * horizontal rectangle: every top vertex y = 0, covering x [-6.5, 6.5] × z [-7, 7].
 * The 7×7 is painted into that floor. Cell y is the floor y, so the grid is the
 * bricks, not a platform floating above them. The pool is cut into the same floor.
 */
export const OASIS_BUNDLE = 'region_oasis';
export const OASIS_PREFAB = 'env_oasis';
/** Coplanar courtyard floor authored in env_oasis.glb (exact in float32; this mesh is not quantized). */
export const OASIS_COURT = Object.freeze({
  y: 0,
  minX: -6.5,
  maxX: 6.5,
  minZ: -7,
  maxZ: 7,
});
/** Metres of sand brick kept around the 7×7. Side length stays 4.25, same cell size as the fjord pier. */
export const OASIS_BOARD_INSET = 4.375;
const shelfW = OASIS_COURT.maxX - OASIS_COURT.minX, shelfD = OASIS_COURT.maxZ - OASIS_COURT.minZ;
const side = Math.min(shelfW, shelfD) - OASIS_BOARD_INSET * 2;
export const OASIS_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (OASIS_COURT.minX + OASIS_COURT.maxX) / 2,
  cz: (OASIS_COURT.minZ + OASIS_COURT.maxZ) / 2,
  y: OASIS_COURT.y,
});
export function isOasisStage(id: unknown): boolean { return /^r11-oasis-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the courtyard. */
export function oasisBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = OASIS_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function oasisCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('oasis cell out of range: ' + index);
  const g = OASIS_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the courtyard floor. Positive would be floating; negative would be sunk into the brick. */
export function oasisBoardGap(): number { return oasisBoardBounds().min[1] - OASIS_COURT.y; }
/** Board footprint is strictly inside the flat courtyard (not on the pool, the arcade, or the dunes). */
export function oasisBoardOnCourt(): boolean {
  const b = oasisBoardBounds(), s = OASIS_COURT;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && oasisBoardGap() === 0;
}
/** Pulled back so the whole 7×7 sits above the bottom safe area. Arches frame the near edge, the pool sits past the board, dunes close the top. */
export function oasisBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = oasisBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 56;
  if (a < ref) fov = 2 * Math.atan(Math.tan(56 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0] + 0.02, c[1] + 5.85, c[2] + 8.7],
    target: [c[0] - 0.02, c[1] + 0.95, c[2] - 2.6],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
