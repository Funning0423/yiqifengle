/**
 * R5 hand-lantern glow (场景特效bot, 星夜灯塔). Pure module (no 'cc'), loose ES5. All sizes are bound to the lantern's height
 * (角色建模bot prop_lantern_v1: ~0.16 m, core lantern.core at (0, -0.148, 0) under socket.lantern; may shrink to 0.11-0.12 m),
 * so a smaller lantern gets a proportionally smaller, closer glow with no other change.
 */
export const LANTERN_GLOW = {
  /** Reference lantern (v1). */
  refHeightM: 0.16,
  /** lantern.core offset under socket.lantern at the reference height (prop_lantern_v1.glb). */
  refCoreOffset: [0, -0.148, 0] as [number, number, number],
  /** Glow radius as a multiple of the lantern height (0.20 m at 0.16 m: the halo reads as a warm ball, stays clear of her face). */
  radiusPerHeight: 1.25,
  /** Core emissive colour (linear), as in CONCEPT_scarf_lantern: warm orange against the starry-night blue. */
  color: [1.0, 0.62, 0.25] as [number, number, number],
  /** Halo strength, breathe and flicker amounts (shader glowParams.yzw). */
  halo: 0.55, breathe: 0.06, flicker: 0.04,
  /** Intensity by mode: night full, day off (the task allows 'invisible or very faint'). */
  night: 1.0, day: 0.0,
  /** Face guard: below faceDistM from the camera (her close-ups) the glow dims to faceMin. */
  faceMin: 0.45, faceDistM: 1.2,
};
/** Glow parameters for a lantern of height h (m) whose core sits at coreOffset (defaults: scaled from the reference). */
export function lanternGlowFor(h: number, coreOffset?: [number, number, number]): { offset: [number, number, number]; radius: number } {
  var L = LANTERN_GLOW, k = (typeof h === 'number' && h > 0 ? h : L.refHeightM) / L.refHeightM;
  var o = coreOffset || [L.refCoreOffset[0] * k, L.refCoreOffset[1] * k, L.refCoreOffset[2] * k];
  return { offset: [o[0], o[1], o[2]], radius: L.radiusPerHeight * L.refHeightM * k };
}
export function lanternGlowIntensity(night: boolean): number { return night ? LANTERN_GLOW.night : LANTERN_GLOW.day; }
/** CPU mirror of the shader's breathe x flicker at time t (s), for previews and tests. */
export function lanternGlowPulse(t: number): { radiusK: number; intensityK: number } {
  var L = LANTERN_GLOW;
  return { radiusK: 1 + L.breathe * Math.sin(t * 1.7), intensityK: 1 + L.flicker * (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 23.7 + 1.3) * 0.4) };
}
/** Quad: 4 vertices at the node origin, corners in a_texCoord (-1..1); the vertex shader expands them in view space. */
export function lanternGlowQuad(): { positions: number[]; uvs: number[]; indices: number[] } {
  return { positions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], uvs: [-1, -1, 1, -1, 1, 1, -1, 1], indices: [0, 1, 2, 0, 2, 3] };
}
