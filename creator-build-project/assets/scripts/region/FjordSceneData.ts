/**
 * 峡湾极光栈道 board seat. Engine-independent (no 'cc').
 * FJ_platform in env_fjord.glb is one wooden pier above the fjord. Its top is a single
 * horizontal rectangle: every top vertex y = 1.25, covering x [-2.5, 2.5] × z [-2.5, 2.5].
 * The 7×7 is inset on that plane. Cell y is the pier y, so the grid does not
 * float above the planks and does not cut into them. The water sits below.
 */
export const FJORD_BUNDLE = 'region_fjord';
export const FJORD_PREFAB = 'env_fjord';
/** Coplanar pier top authored in env_fjord.glb (exact in float32; this mesh is not quantized). */
export const FJORD_PLATFORM = Object.freeze({
  y: 1.25,
  minX: -2.5,
  maxX: 2.5,
  minZ: -2.5,
  maxZ: 2.5,
});
/** Metres kept inside the pier edge so the outer cells stay on the planks. */
export const FJORD_BOARD_INSET = 0.375;
const shelfW = FJORD_PLATFORM.maxX - FJORD_PLATFORM.minX, shelfD = FJORD_PLATFORM.maxZ - FJORD_PLATFORM.minZ;
const side = Math.min(shelfW, shelfD) - FJORD_BOARD_INSET * 2;
export const FJORD_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (FJORD_PLATFORM.minX + FJORD_PLATFORM.maxX) / 2,
  cz: (FJORD_PLATFORM.minZ + FJORD_PLATFORM.maxZ) / 2,
  y: FJORD_PLATFORM.y,
});
export function isFjordStage(id: unknown): boolean { return /^r10-fjord-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the pier. */
export function fjordBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = FJORD_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function fjordCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('fjord cell out of range: ' + index);
  const g = FJORD_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the pier. Positive would be floating; negative would be sunk into the wood. */
export function fjordBoardGap(): number { return fjordBoardBounds().min[1] - FJORD_PLATFORM.y; }
/** Board footprint is strictly inside the flat pier (not on the water, the cliffs, or the cabins). */
export function fjordBoardOnPlatform(): boolean {
  const b = fjordBoardBounds(), s = FJORD_PLATFORM;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && fjordBoardGap() === 0;
}
/** The board camera looks along the pier toward the cliffs. Water stays in the lower frame and the aurora in the upper frame. */
export function fjordBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = fjordBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 52;
  if (a < ref) fov = 2 * Math.atan(Math.tan(52 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0] + 0.15, c[1] + 7.6, c[2] + 11.6],
    target: [c[0], c[1] + 1.55, c[2] - 2.4],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
