/**
 * 温泉谷 board seat. Engine-independent (no 'cc').
 * HS_platform in env_hotspring.glb is one wooden deck. Its top is a single horizontal rectangle:
 * every top vertex y = 0.5, covering x [-2.5, 2.5] × z [-2.5, 2.5].
 * The 7×7 is inset on that plane. Cell y is the deck y, so the grid does not
 * float above the wood and does not cut into it.
 */
export const HOTSPRING_BUNDLE = 'region_hotspring';
export const HOTSPRING_PREFAB = 'env_hotspring';
/** Coplanar deck top authored in env_hotspring.glb (exact in float32). */
export const HOTSPRING_PLATFORM = Object.freeze({
  y: 0.5,
  minX: -2.5,
  maxX: 2.5,
  minZ: -2.5,
  maxZ: 2.5,
});
/** Metres kept inside the deck edge so the outer cells stay on the plane. */
export const HOTSPRING_BOARD_INSET = 0.375;
const shelfW = HOTSPRING_PLATFORM.maxX - HOTSPRING_PLATFORM.minX, shelfD = HOTSPRING_PLATFORM.maxZ - HOTSPRING_PLATFORM.minZ;
const side = Math.min(shelfW, shelfD) - HOTSPRING_BOARD_INSET * 2;
export const HOTSPRING_GRID = Object.freeze({
  cols: 7, rows: 7, cell: side / 7,
  cx: (HOTSPRING_PLATFORM.minX + HOTSPRING_PLATFORM.maxX) / 2,
  cz: (HOTSPRING_PLATFORM.minZ + HOTSPRING_PLATFORM.maxZ) / 2,
  y: HOTSPRING_PLATFORM.y,
});
export function isHotspringStage(id: unknown): boolean { return /^r09-spring-\d+$/.test(String(id || '')); }
/** Outer edge of the 7×7. Half a cell past the outer centres, still inside the deck. */
export function hotspringBoardBounds(): { min: [number, number, number]; max: [number, number, number]; center: [number, number, number] } {
  const g = HOTSPRING_GRID, h = g.cell * g.cols / 2;
  return {
    min: [g.cx - h, g.y, g.cz - h],
    max: [g.cx + h, g.y, g.cz + h],
    center: [g.cx, g.y, g.cz],
  };
}
export function hotspringCellCenter(index: number): [number, number, number] {
  if (!Number.isInteger(index) || index < 0 || index >= 49) throw Error('hotspring cell out of range: ' + index);
  const g = HOTSPRING_GRID, col = index % 7, row = Math.floor(index / 7);
  const x0 = g.cx - g.cell * (g.cols - 1) / 2, z0 = g.cz - g.cell * (g.rows - 1) / 2;
  return [x0 + g.cell * col, g.y, z0 + g.cell * row];
}
/** 0 when the board plane is the deck. Positive would be floating; negative would be sunk into the wood. */
export function hotspringBoardGap(): number { return hotspringBoardBounds().min[1] - HOTSPRING_PLATFORM.y; }
/** Board footprint is strictly inside the flat deck (not on the pools, the fence, or the corridor). */
export function hotspringBoardOnPlatform(): boolean {
  const b = hotspringBoardBounds(), s = HOTSPRING_PLATFORM;
  return b.min[0] > s.minX && b.max[0] < s.maxX && b.min[2] > s.minZ && b.max[2] < s.maxZ
    && b.min[1] === s.y && b.max[1] === s.y && hotspringBoardGap() === 0;
}
/** Mild overhead, like the cloud-sea board camera: the deck shows around the grid. Taller screens keep horizontal coverage. */
export function hotspringBoardLook(aspect: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const c = hotspringBoardBounds().center, ref = 720 / 1280, a = Number.isFinite(aspect) && aspect > 0 ? aspect : ref;
  let fov = 48;
  if (a < ref) fov = 2 * Math.atan(Math.tan(48 * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return {
    position: [c[0], c[1] + 9.2, c[2] + 11.4],
    target: [c[0], c[1], c[2]],
    fovVerticalDeg: +Math.min(75, fov).toFixed(3),
  };
}
