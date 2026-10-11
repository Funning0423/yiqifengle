/** T2+ door light-spill hint (room home camera, lead option 1). Engine-free data + rules; DoorSpillHint.ts is the cc wrapper.
 * A soft warm fan of light on the floor from the closed door's gap toward the seat. Its faint tail enters the bottom of the
 * home frame (floor is only visible there from z ~ -3.4) and leads the eye back toward the off-screen door; at the door it
 * is brightest. No texture, no FOV change: one 20-vertex mesh, vertex alpha, tint = env_palette_256 texel (112,216).
 * Visible only in the HOME view (interior on, exterior off); fades out when the door opens, hard-off outdoors. */
export type SpillView = Readonly<{ interior: boolean; exterior: boolean; night: boolean }>;
export const DOOR_SPILL = Object.freeze({
  /** Warm yellow of the shared M_env_palette (env_palette_256.png texel x=112,y=216; verified by the test against the GLB). */
  paletteTexel: [112, 216] as const,
  color: [252, 201, 114] as const,
  /** Walkable floor (interior shell planks) is y=0, the rug top +0.006: 6 mm above the rug, 12 mm above the planks. */
  y: 0.012,
  /** Rows from the room edge of the recessed door threshold (z -0.30, door leaf at z ~0) toward the seat:
   *  z, half-width (m), alpha factor. The decal does not cover the recessed threshold (y -0.035) itself. */
  rows: [[-0.32, 0.62, 1], [-0.6, 0.68, .92], [-1.3, 0.86, .8], [-2.4, 1.02, .7], [-3.6, 1.16, .6], [-4.1, 1.22, 0]] as ReadonlyArray<readonly [number, number, number]>,
  centerX: 0,
  /** Lateral profile across a row (fraction of half-width -> alpha factor); soft edges. */
  columns: [[-1, 0], [-0.55, 1], [0.55, 1], [1, 0]] as ReadonlyArray<readonly [number, number]>,
  /** Peak alpha by mode: brighter at night, fainter by day. */
  peakAlpha: { day: 0.26, night: 0.55 },
  /** Fade speed (alpha units of peak per second); 0 -> 1 in 0.4 s, never a pop. */
  fadePerSecond: 2.5,
});
/** 1 when the hint should show (HOME view only), else 0. Outdoors / island / doorway-interior: 0. */
export function spillTarget(v: SpillView): number { return v.interior && !v.exterior ? 1 : 0; }
export function spillPeak(night: boolean): number { return night ? DOOR_SPILL.peakAlpha.night : DOOR_SPILL.peakAlpha.day; }
/** Linear approach of the visibility fraction toward its target. */
export function stepSpill(current: number, target: number, dt: number): number {
  const d = Math.max(0, dt) * DOOR_SPILL.fadePerSecond;
  return current < target ? Math.min(target, current + d) : Math.max(target, current - d);
}
/** Grid mesh: positions (xyz), per-vertex alpha factor (0..1), triangle indices. */
export function spillGeometry(): { positions: number[]; alpha: number[]; indices: number[]; min: number[]; max: number[] } {
  const S = DOOR_SPILL, positions: number[] = [], alpha: number[] = [], indices: number[] = [], nc = S.columns.length;
  for (const [z, hw, ra] of S.rows) for (const [cx, ca] of S.columns) { positions.push(S.centerX + cx * hw, S.y, z); alpha.push(ra * ca); }
  for (let r = 0; r < S.rows.length - 1; r++) for (let c = 0; c < nc - 1; c++) {
    const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1; indices.push(a, d, b, b, d, e);
  }
  const xs = positions.filter((_, i) => i % 3 === 0), zs = positions.filter((_, i) => i % 3 === 2);
  return { positions, alpha, indices, min: [Math.min(...xs), S.y, Math.min(...zs)], max: [Math.max(...xs), S.y, Math.max(...zs)] };
}
