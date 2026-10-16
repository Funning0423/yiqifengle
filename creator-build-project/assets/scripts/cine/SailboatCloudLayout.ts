/**
 * Camera-space cloud bank for the island → meadow cover.
 * x/y are fractions of the view width/height, s is the puff half-size in view-heights, rgb tint,
 * rank 0..1 = dissolve order (0 arrives first and leaves last). The first 9 are the big fill that
 * shuts the screen; the 14 smaller billows sit in front so the shut bank still reads as cloud.
 * No engine imports: the driver fades this bank instead of a flat grey plate.
 */
export const SAILBOAT_CLOUD_PUFFS: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [0, 0, 1.55, 248, 250, 252, 1.0],
  [-0.4, 0.26, 1.22, 236, 244, 250, 0.7],
  [0.42, 0.3, 1.26, 255, 255, 255, 0.67],
  [-0.34, -0.32, 1.18, 226, 236, 246, 0.7],
  [0.36, -0.3, 1.2, 242, 246, 250, 0.7],
  [0, 0.52, 1.16, 232, 240, 248, 0.67],
  [0, -0.5, 1.14, 250, 252, 255, 0.68],
  [-0.58, 0.02, 1.12, 220, 232, 242, 0.63],
  [0.6, -0.04, 1.12, 238, 244, 250, 0.62],
  [0.47, 0.09, 0.42, 255, 255, 255, 0.05],
  [0.22, 0.15, 0.57, 244, 248, 252, 0.25],
  [0.22, 0.39, 0.51, 232, 240, 248, 0.11],
  [0.01, 0.25, 0.44, 250, 250, 255, 0.22],
  [-0.2, 0.4, 0.6, 255, 255, 255, 0.08],
  [-0.21, 0.16, 0.53, 244, 248, 252, 0.28],
  [-0.47, 0.11, 0.46, 232, 240, 248, 0.05],
  [-0.27, -0.05, 0.62, 250, 250, 255, 0.25],
  [-0.38, -0.27, 0.55, 255, 255, 255, 0.11],
  [-0.13, -0.22, 0.49, 244, 248, 252, 0.22],
  [-0.01, -0.44, 0.42, 232, 240, 248, 0.08],
  [0.11, -0.23, 0.57, 250, 250, 255, 0.28],
  [0.37, -0.28, 0.51, 255, 255, 255, 0.05],
  [0.27, -0.06, 0.44, 244, 248, 252, 0.25],
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
