/**
 * 石灯苔庭 board seat. Engine-independent (no 'cc').
 * MG_ground in env_mossgarden.glb is the raked sand court. Its top is one
 * horizontal rectangle: every top vertex y = 0, covering x [-6.5, 6.5] × z [-7, 7].
 * The 7×7 is painted into that court. Cell y is the court y, so the grid is
 * the paving, not a platform floating above it. A moss-stone curb and a wood
 * lip edge the same floor.
 */
export const MOSSGARDEN_BUNDLE = 'region_mossgarden';
export const MOSSGARDEN_PREFAB = 'env_mossgarden';
/** Coplanar court authored in env_mossgarden.glb (exact in float32; this mesh is not quantized). */
export const MOSSGARDEN_COURT = Object.freeze({
  y: 0,
  minX: -6.5,
  maxX: 6.5,
  minZ: -7,
  maxZ: 7,
});
/** Metres of court kept around the 7×7. Side length stays 4.25, same cell size as the harbor terrace. */
export const MOSSGARDEN_BOARD_INSET = 4.375;
const shelfW = MOSSGARDEN_COURT.maxX - MOSSGARDEN_COURT.minX, shelfD = MOSSGARDEN_COURT.maxZ - MOSSGARDEN_COURT.minZ;
const side = Math.min(shelfW, shelfD) - MOSSGARDEN_BOARD_INSET * 2;
export const MOSSGARDEN_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (MOSSGARDEN_COURT.minX + MOSSGARDEN_COURT.maxX) / 2,
  cz: (MOSSGARDEN_COURT.minZ + MOSSGARDEN_COURT.maxZ) / 2,
  y: MOSSGARDEN_COURT.y,
});
export function isMossgardenStage(id: unknown): boolean { return /^r13-mossgarden-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the court. */
export function mossgardenBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = MOSSGARDEN_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function mossgardenCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('mossgarden cell out of range: ' + index);
  const g = MOSSGARDEN_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the court. Positive would be floating; negative would be sunk into the sand. */
export function mossgardenBoardGap(): number { return mossgardenBoardBounds().min[1] - MOSSGARDEN_COURT.y; }
/** Board footprint is strictly inside the flat court (not on the curb, the lanterns, or the gate). */
export function mossgardenBoardOnCourt(): boolean {
  const b = mossgardenBoardBounds(), s = MOSSGARDEN_COURT;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && mossgardenBoardGap() === 0;
}
/** Pulled back so the whole 7×7 sits inside the portrait frame. Maples and lanterns frame the near corners; the gate and mountains close the top. */
export function mossgardenBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = mossgardenBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 54;
  if (a < ref) fov = 2 * Math.atan(Math.tan(54 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0] + 0.04, c[1] + 6.48, c[2] + 9.2],
    target: [c[0] - 0.02, c[1] + 1.12, c[2] - 2.75],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
