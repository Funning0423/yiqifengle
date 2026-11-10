/**
 * 白阶海港台地 board seat. Engine-independent (no 'cc').
 * HB_ground in env_harbor.glb is the limestone terrace. Its top is one
 * horizontal rectangle: every top vertex y = 0, covering x [-6.5, 6.5] × z [-7, 7].
 * The 7×7 is painted into that terrace. Cell y is the terrace y, so the grid is
 * the paving, not a platform floating above it. A blue-white glaze band and a
 * low white parapet edge the same floor.
 */
export const HARBOR_BUNDLE = 'region_harbor';
export const HARBOR_PREFAB = 'env_harbor';
/** Coplanar terrace authored in env_harbor.glb (exact in float32; this mesh is not quantized). */
export const HARBOR_COURT = Object.freeze({
  y: 0,
  minX: -6.5,
  maxX: 6.5,
  minZ: -7,
  maxZ: 7,
});
/** Metres of limestone kept around the 7×7. Side length stays 4.25, same cell size as the oasis court. */
export const HARBOR_BOARD_INSET = 4.375;
const shelfW = HARBOR_COURT.maxX - HARBOR_COURT.minX, shelfD = HARBOR_COURT.maxZ - HARBOR_COURT.minZ;
const side = Math.min(shelfW, shelfD) - HARBOR_BOARD_INSET * 2;
export const HARBOR_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (HARBOR_COURT.minX + HARBOR_COURT.maxX) / 2,
  cz: (HARBOR_COURT.minZ + HARBOR_COURT.maxZ) / 2,
  y: HARBOR_COURT.y,
});
export function isHarborStage(id: unknown): boolean { return /^r12-harbor-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the terrace. */
export function harborBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = HARBOR_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function harborCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('harbor cell out of range: ' + index);
  const g = HARBOR_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the terrace. Positive would be floating; negative would be sunk into the stone. */
export function harborBoardGap(): number { return harborBoardBounds().min[1] - HARBOR_COURT.y; }
/** Board footprint is strictly inside the flat terrace (not on the parapet, the domes, or the sea). */
export function harborBoardOnCourt(): boolean {
  const b = harborBoardBounds(), s = HARBOR_COURT;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && harborBoardGap() === 0;
}
/** Pulled back so the whole 7×7 sits inside the portrait frame. Domes and the sea close the top; the parapet and bougainvillea frame the near edge. */
export function harborBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = harborBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 54;
  if (a < ref) fov = 2 * Math.atan(Math.tan(54 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0] + 0.12, c[1] + 6.35, c[2] + 9.05],
    target: [c[0] - 0.06, c[1] + 1.05, c[2] - 2.85],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
