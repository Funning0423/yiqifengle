/**
 * Camera-space cloud bank for the island → meadow cover.
 * x/y are fractions of the view width/height, s is the disc scale in view-heights.
 * No engine imports: the driver fades this bank instead of a flat grey plate.
 */
export const SAILBOAT_CLOUD_PUFFS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 1.55, 248, 250, 252],
  [-0.4, 0.26, 1.22, 236, 244, 250],
  [0.42, 0.3, 1.26, 255, 255, 255],
  [-0.34, -0.32, 1.18, 226, 236, 246],
  [0.36, -0.3, 1.2, 242, 246, 250],
  [0, 0.52, 1.16, 232, 240, 248],
  [0, -0.5, 1.14, 250, 252, 255],
  [-0.58, 0.02, 1.12, 220, 232, 242],
  [0.6, -0.04, 1.12, 238, 244, 250],
];

/** True only when the bank is shut: the scene swap and the meadow warmup stay behind it. */
export function cloudBankCovers(alpha: number): boolean {
  return alpha >= 1 - 1e-4;
}

/** Ease-out so the bank is visibly cloudy before it shuts, then opens the same way. */
export function cloudShownAlpha(alpha: number): number {
  if (!(alpha > 0)) return 0;
  if (alpha >= 1) return 1;
  return 1 - (1 - alpha) * (1 - alpha);
}
