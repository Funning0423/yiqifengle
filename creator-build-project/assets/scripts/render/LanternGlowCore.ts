/**
 * R5 hand-lantern glow (场景特效bot, 星夜灯塔). Pure module (no 'cc'), loose ES5. All sizes are bound to the lantern's height.
 * v2 (final): prop_lantern_v2, 0.115 m; hierarchy socket.lantern > lantern_pivot (the only swinging node, max 8 deg) > lantern.core
 * at (0, -0.0984, 0) m right under the pivot. Hold pose: right elbow bent, lantern in front of the waist (core ~0.98 m above ground,
 * ~0.29 m in front of the hips): the glow is a child of lantern.core, so it follows the pivot swing.
 */
export const LANTERN_GLOW = {
  /** Reference lantern (prop_lantern_v2, default height). */
  refHeightM: 0.115,
  /** lantern.core offset under lantern_pivot at the reference height (prop_lantern_v2.glb). */
  refCoreOffset: [0, -0.0984, 0] as [number, number, number],
  /** Glow radius as a multiple of the lantern height (0.144 m at 0.115 m). */
  radiusPerHeight: 1.25,
  /** Hard cap on the radius: core ~0.98 m vs her chin ~1.40 m, so the halo (radius x breathe) always stays >= 0.25 m under the face. */
  maxRadiusM: 0.16,
  /** Core emissive colour (linear), as in CONCEPT_scarf_lantern: warm orange against the starry-night blue. */
  color: [1.0, 0.62, 0.25] as [number, number, number],
  /** Halo strength, breathe and flicker amounts (shader glowParams.yzw). */
  halo: 0.55, breathe: 0.06, flicker: 0.04,
  /** Intensity by mode: night full, day off (the task allows 'invisible or very faint'). */
  night: 1.0, day: 0.0,
  /** Face guard: below faceDistM from the camera (her close-ups) the glow dims to faceMin. v2: waist-height lantern sits right under
   *  the face in close-ups, so the guard starts a little further out (1.4 m) and dims deeper (0.35). */
  faceMin: 0.35, faceDistM: 1.4,
};
/** Glow parameters for a lantern of height h (m) whose core sits at coreOffset (defaults: scaled from the reference). */
export function lanternGlowFor(h: number, coreOffset?: [number, number, number]): { offset: [number, number, number]; radius: number } {
  var L = LANTERN_GLOW, k = (typeof h === 'number' && h > 0 ? h : L.refHeightM) / L.refHeightM;
  var o = coreOffset || [L.refCoreOffset[0] * k, L.refCoreOffset[1] * k, L.refCoreOffset[2] * k];
  return { offset: [o[0], o[1], o[2]], radius: Math.min(L.maxRadiusM, L.radiusPerHeight * L.refHeightM * k) };
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
