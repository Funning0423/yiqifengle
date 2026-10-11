/**
 * Island atmosphere FX core (engine-free, unit-tested by tools/scene-fx/test_island_fx.cjs).
 * Replaces two authored v22 effects at runtime, without touching the imported GLB:
 *  - chimney smoke: env_chimney_smoke_01..05_v22 (5 opaque white balls on the 12 s idle clip) -> fx_chimney_smoke,
 *    7 soft camera-facing puffs that rise, grow, fade and lean with getWindStrength().
 *  - lighthouse light: env_lighthouse_beam_night_v22 (double-ended hard bar, 30 deg/s on the idle clip, "propeller")
 *    -> fx_lighthouse_beam (one soft additive cone, 18 deg/s), fx_lighthouse_glow (lamp-room halo that flashes when the
 *    beam sweeps across the LIVE camera position) and fx_lighthouse_seaglint (faint streak on the sea under the beam).
 * Rendering: builtin-unlit with vertex colour (alpha profile in the mesh), technique 2 (add) for light,
 * technique 3 (alpha-blend) for smoke. No textures, no new effect asset. Near-camera fades are per object on the CPU
 * (camera distance to the cone surface / puff surface), so a camera passing through never sees a full-screen layer.
 * None of these nodes has a collider and none is in WorldFlowComponent.lighthouseTargets: they never take taps.
 */
export type V3 = [number, number, number];
export type Q4 = [number, number, number, number];

export const ISLAND_FX = {
  /** Lamp centre = env_lighthouse_beam_pivot_v22 / env_lighthouse_lamp_glow_v22 translation in the GLB. */
  lamp: [0, 8.42, -2.65] as V3,
  /** Chimney mouth: top ring of the chimney in env_lighthouse_ext (centre of the 252 top vertices, y = max). */
  chimney: [4.218, 5.19, -1.957] as V3,
  /** Sea glint height: env_sea_surface is flat at y=-0.918; +0.04 avoids z-fighting. */
  seaY: -0.878,
  beam: {
    periodS: 20,            // one revolution; old bar: 12 s with two ends = a sweep every 6 s
    tiltDeg: -2.5,          // slightly down toward the sea
    startYawDeg: 0,
    lengthM: 22, r0: 0.22, r1: 3.6,
    color: [255, 236, 196] as V3,
    alphaNight: 0.34,
    nearInnerM: 0.6,        // camera this close to the cone surface (or inside) -> beam alpha 0
    nearOuterM: 3.5,        // full alpha from here
  },
  glow: { baseAlpha: 0.16, flashAlpha: 0.9, flashPower: 26, baseRadiusM: 0.75, flashRadiusM: 2.3, towardCameraM: 0.9,
    color: [255, 226, 170] as V3, nearInnerM: 1.0, nearOuterM: 3.0 },
  /** Independent additive overlay on top of the sea (sea material/night params untouched). Only while the beam sweeps
   * toward the camera side (facing^power), restrained: the sea gets darker at night, this must not paint it white. */
  glint: { startM: 9, endM: 42, w0: 0.7, w1: 4.2, alphaNight: 0.13, facingPower: 6, color: [255, 222, 168] as V3 },
  smoke: {
    count: 7, lifeS: 7.5, riseM: 2.6, r0: 0.17, r1: 0.95,
    leanDir: [0.99, 0, -0.14] as V3, // authored v22 smoke drifted +X / slightly -Z
    leanCalm: 0.22, leanWind: 1.05,  // horizontal offset per metre of rise at wind 0 / extra at wind 1
    day: [238, 233, 224] as V3, night: [104, 116, 140] as V3, nightMouth: [196, 150, 106] as V3,
    alphaDay: 0.62, alphaNight: 0.46, nearInnerM: 0.25, nearOuterM: 1.4,
  },
  /** Day/night: same mechanism as GGbot T9n props (5c00182 IslandPropsLayout.approachNight / ISLAND_PROPS.nightFadeS):
   * the island switch itself is instant (DayNightContract 0/1); the FX night weight follows linearly over 0.5 s,
   * dt clamped to 0.1 s, first sync snaps. Light visibility = smoothstep(weight). */
  nightFadeS: 0.5,
};

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
export function smoothstep(a: number, b: number, x: number): number { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
/** Deterministic hash noise in [0,1). */
export function hash01(i: number): number { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/** Quaternion whose local X/Y/Z axes map to the given orthonormal world axes. */
export function basisQuat(x: V3, y: V3, z: V3): Q4 {
  const m00 = x[0], m11 = y[1], m22 = z[2], tr = m00 + m11 + m22;
  let q: Q4;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s]; }
  const l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** Camera-facing billboard (local +Z toward camera, local +Y as close to world up as possible). */
export function billboardQuat(pos: V3, cam: V3): Q4 {
  let z = norm(sub(cam, pos)); if (len(z) < .5) z = [0, 0, 1];
  let x = cross([0, 1, 0], z); if (len(x) < 1e-4) x = [1, 0, 0]; x = norm(x); const y = cross(z, x); return basisQuat(x, y, z);
}

// ---------------- geometry (shared shape: positions, RGBA 0..1 colours, indices) ----------------
export type FxGeometry = { positions: number[]; colors: number[]; indices: number[]; min: V3; max: V3 };
function bounds(g: { positions: number[] }): { min: V3; max: V3 } {
  const min: V3 = [1e9, 1e9, 1e9], max: V3 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < g.positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = g.positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max };
}
function grid(cols: number, rows: number, indices: number[], base: number): void {
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = base + r * cols + c, b = a + 1, d = a + cols, e = d + 1; indices.push(a, d, b, b, d, e); }
}
/** Beam: flat soft cone in local XZ (axis +Z from the lamp, width along X, normal +Y). Two layers: core and wider mist. */
export const BEAM_ROWS = [0, .015, .04, .08, .13, .2, .28, .37, .47, .58, .7, .82, .92, 1];
export const BEAM_COLS = [-1.6, -1, -.55, 0, .55, 1, 1.6];
export function beamRadius(u: number): number { const B = ISLAND_FX.beam; return B.r0 + (B.r1 - B.r0) * u; }
export function beamAlongAlpha(u: number): number { return smoothstep(0, .05, u) * Math.pow(1 - u, 1.7); }
export function beamGeometry(): FxGeometry {
  const B = ISLAND_FX.beam, positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const layers = [{ w: 1, a: 1 }, { w: 1.9, a: .32 }];
  for (let L = 0; L < layers.length; L++) {
    const base = positions.length / 3;
    for (let r = 0; r < BEAM_ROWS.length; r++) {
      const u = BEAM_ROWS[r], rad = beamRadius(u) * layers[L].w, along = beamAlongAlpha(u);
      for (let c = 0; c < BEAM_COLS.length; c++) {
        const v = BEAM_COLS[c], across = Math.abs(v) >= 1.6 ? 0 : Math.exp(-2.2 * v * v);
        const mist = .82 + .36 * hash01(L * 97 + r * 13 + c); // static clumps of haze
        positions.push(v * rad, 0, u * B.lengthM);
        colors.push(1, 1, 1, clamp01(along * across * layers[L].a * mist));
      }
    }
    grid(BEAM_COLS.length, BEAM_ROWS.length, indices, base);
  }
  const g = { positions, colors, indices, min: [0, 0, 0] as V3, max: [0, 0, 0] as V3 }; const b = bounds(g);
  // Bounds must hold every orientation of the billboard plane around the axis (culling).
  const R = beamRadius(1) * 1.9 * 1.6; g.min = [-R, -R, b.min[2]]; g.max = [R, R, b.max[2]]; return g;
}
/** Soft disc in local XY facing +Z: centre, inner ring, lumpy outer ring with alpha 0. shade: top lighter (smoke). */
export function discGeometry(segments: number, innerR: number, innerA: number, lump: number, shade: number, seed: number): FxGeometry {
  const positions: number[] = [0, 0, 0], colors: number[] = [1, 1, 1, 1], indices: number[] = [];
  const tone = (y: number) => 1 - shade * (1 - (y + 1) / 2);
  for (let ring = 0; ring < 2; ring++) for (let s = 0; s < segments; s++) {
    const a = s / segments * Math.PI * 2, rr = ring === 0 ? innerR * (1 + lump * .5 * (hash01(seed + s) - .5)) : 1 + lump * (hash01(seed + 50 + s) - .5);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr, t = tone(y);
    positions.push(x, y, 0); colors.push(t, t, t, ring === 0 ? innerA : 0);
  }
  colors[0] = colors[1] = colors[2] = tone(0);
  for (let s = 0; s < segments; s++) {
    const n = (s + 1) % segments, i0 = 1 + s, i1 = 1 + n, o0 = 1 + segments + s, o1 = 1 + segments + n;
    indices.push(0, i0, i1, i0, o0, i1, i1, o0, o1);
  }
  const g = { positions, colors, indices, min: [0, 0, 0] as V3, max: [0, 0, 0] as V3 }; const b = bounds(g); g.min = [b.min[0], b.min[1], -.01]; g.max = [b.max[0], b.max[1], .01]; return g;
}
/** Sea glint: streak on the sea plane in local XZ along +Z, broken into ripple bands. */
export function glintGeometry(): FxGeometry {
  const G = ISLAND_FX.glint, positions: number[] = [], colors: number[] = [], indices: number[] = [], rows = 28, cols = [-1, -.45, 0, .45, 1];
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1), z = G.startM + (G.endM - G.startM) * u, w = G.w0 + (G.w1 - G.w0) * u;
    const along = smoothstep(0, .15, u) * Math.pow(1 - u, 1.3), ripple = r % 2 === 0 ? 1 : .42 + .2 * hash01(r);
    for (let c = 0; c < cols.length; c++) {
      const v = cols[c], wob = .35 * (hash01(r * 7 + c) - .5);
      positions.push((v + (Math.abs(v) < 1 ? wob * .3 : 0)) * w, 0, z);
      colors.push(1, 1, 1, Math.abs(v) >= 1 ? 0 : clamp01(along * ripple * Math.exp(-2.4 * v * v)));
    }
  }
  grid(cols.length, rows, indices, 0);
  const g = { positions, colors, indices, min: [0, 0, 0] as V3, max: [0, 0, 0] as V3 }; const b = bounds(g); g.min = [b.min[0], -.01, b.min[2]]; g.max = [b.max[0], .01, b.max[2]]; return g;
}

// ---------------- per-frame state ----------------
export type BeamState = { dir: V3; rotation: Q4; alpha: number; flash: number; cameraFade: number; cameraInside: boolean;
  glowPos: V3; glowRotation: Q4; glowScale: number; glowAlpha: number; glintRotation: Q4; glintAlpha: number };
export function beamDirection(t: number): V3 {
  const B = ISLAND_FX.beam, yaw = (B.startYawDeg * Math.PI / 180) + t / B.periodS * Math.PI * 2, tilt = B.tiltDeg * Math.PI / 180;
  // Same turning sense as the authored pivot (+Y): local +Z rotated by yaw about +Y.
  return [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
}
/** 0 when the camera is inside the cone or within nearInnerM of its surface, 1 beyond nearOuterM. Also near the lamp. */
export function beamCameraFade(dir: V3, cam: V3): { fade: number; inside: boolean; surfaceM: number } {
  const B = ISLAND_FX.beam, rel = sub(cam, ISLAND_FX.lamp), along = dot(rel, dir), L = B.lengthM;
  const u = along / L, uc = clamp01(u), axisPoint: V3 = [dir[0] * uc * L, dir[1] * uc * L, dir[2] * uc * L];
  const radial = len(sub(rel, axisPoint)), visualR = beamRadius(uc) * 1.9; // outer mist layer half-width
  const surfaceM = u < 0 || u > 1 ? len(sub(rel, axisPoint)) - (u < 0 ? B.r0 : visualR) : radial - visualR;
  const inside = u >= 0 && u <= 1 && radial <= visualR;
  return { fade: inside ? 0 : smoothstep(B.nearInnerM, B.nearOuterM, surfaceM), inside, surfaceM };
}
/** Lamp-room flash: dot(beam direction, lamp->camera) from the camera position of THIS frame. */
export function flashWeight(dir: V3, cam: V3): number {
  // Horizontal sweep angle decides the flash; elevation only has to fall inside the cone's soft vertical spread
  // (cameras sit 10-15 deg below the lamp, the beam is tilted -2.5 deg, cone half-angle ~17 deg incl. mist).
  const to = sub(cam, ISLAND_FX.lamp), h = norm([dir[0], 0, dir[2]]), th = norm([to[0], 0, to[2]]), c = dot(h, th);
  if (c <= 0 || len(th) < .5) return 0;
  const half = Math.atan(beamRadius(1) * 1.9 / ISLAND_FX.beam.lengthM), elev = Math.atan2(to[1], Math.sqrt(to[0] * to[0] + to[2] * to[2]));
  const dv = Math.abs(elev - Math.asin(dir[1]));
  return Math.pow(c, ISLAND_FX.glow.flashPower) * (1 - smoothstep(half * .6, half * 1.4, dv));
}
/** shown: 0..1 night-and-exterior fade. */
export function beamState(t: number, cam: V3, shown: number): BeamState {
  const B = ISLAND_FX.beam, Gw = ISLAND_FX.glow, Gl = ISLAND_FX.glint, lamp = ISLAND_FX.lamp, dir = beamDirection(t);
  // Axial billboard: plane contains the axis and faces the camera as much as possible.
  const toCam = sub(cam, lamp); let side = cross(dir, toCam); if (len(side) < 1e-5) side = cross(dir, [0, 1, 0]); side = norm(side);
  const normal = cross(dir, side), rotation = basisQuat(side, normal, dir);
  const flash = flashWeight(dir, cam), near = beamCameraFade(dir, cam);
  const viewCos = Math.abs(dot(dir, norm(toCam))), boost = 1 + .6 * viewCos; // looking along the beam: denser haze
  const breathe = .93 + .07 * Math.sin(t * .9) * Math.sin(t * .37 + 1.3);
  const alpha = clamp01(B.alphaNight * shown * near.fade * boost * breathe);
  const towards = norm(toCam), dist = len(toCam), off = Math.min(Gw.towardCameraM, Math.max(0, dist - 1));
  const glowPos: V3 = [lamp[0] + towards[0] * off, lamp[1] + towards[1] * off, lamp[2] + towards[2] * off];
  const glowNear = smoothstep(Gw.nearInnerM, Gw.nearOuterM, dist - off);
  const glowAlpha = clamp01(shown * glowNear * (Gw.baseAlpha + Gw.flashAlpha * flash));
  const glowScale = Gw.baseRadiusM + (Gw.flashRadiusM - Gw.baseRadiusM) * flash;
  const h = norm([dir[0], 0, dir[2]]), camH = norm([toCam[0], 0, toCam[2]]), facingH = Math.max(0, dot(h, camH));
  const glintRotation = basisQuat(norm(cross([0, 1, 0], h)), [0, 1, 0], h);
  const glintAlpha = clamp01(Gl.alphaNight * shown * Math.pow(facingH, Gl.facingPower) * smoothstep(1, 4, cam[1] - ISLAND_FX.seaY));
  return { dir, rotation, alpha, flash, cameraFade: near.fade, cameraInside: near.inside, glowPos, glowRotation: billboardQuat(glowPos, cam), glowScale, glowAlpha, glintRotation, glintAlpha };
}

export type Puff = { position: V3; rotation: Q4; scale: V3; color: V3; alpha: number; age: number; cameraFade: number };
/** wind: getWindStrength() 0..1. nightShown: 0 day .. 1 night (eased). shown: exterior on/off fade. */
export function smokePuffs(t: number, wind: number, nightShown: number, shown: number, cam: V3): Puff[] {
  const S = ISLAND_FX.smoke, out: Puff[] = [], w = clamp01(wind), lean = S.leanCalm + S.leanWind * w;
  for (let i = 0; i < S.count; i++) {
    const phase = (t / S.lifeS + i / S.count) % 1, age = phase < 0 ? phase + 1 : phase, cycle = Math.floor(t / S.lifeS + i / S.count);
    const seed = i * 31 + cycle * 7, rise = S.riseM * Math.pow(age, .82) * (.9 + .2 * hash01(seed)) * (1 - .25 * w);
    const sway = .12 * Math.sin(t * .8 + i * 1.7) * age, drift = lean * rise * (.7 + .6 * age);
    const m = ISLAND_FX.chimney, d = S.leanDir;
    const position: V3 = [m[0] + d[0] * drift - d[2] * sway, m[1] + .06 + rise, m[2] + d[2] * drift + d[0] * sway];
    const r = (S.r0 + (S.r1 - S.r0) * Math.pow(age, .75)) * (.85 + .3 * hash01(seed + 3)), squash = .82 + .12 * hash01(seed + 5);
    const surface = len(sub(cam, position)) - r, cameraFade = smoothstep(S.nearInnerM, S.nearOuterM, surface);
    const life = smoothstep(0, .07, age) * Math.pow(1 - age, 1.35);
    const mouth = Math.max(0, 1 - age / .3) * .7 * nightShown;
    const base: V3 = [S.day[0] + (S.night[0] - S.day[0]) * nightShown, S.day[1] + (S.night[1] - S.day[1]) * nightShown, S.day[2] + (S.night[2] - S.day[2]) * nightShown];
    const color: V3 = [base[0] + (S.nightMouth[0] - base[0]) * mouth, base[1] + (S.nightMouth[1] - base[1]) * mouth, base[2] + (S.nightMouth[2] - base[2]) * mouth];
    const peak = S.alphaDay + (S.alphaNight - S.alphaDay) * nightShown;
    out.push({ position, rotation: billboardQuat(position, cam), scale: [r * (1 + .1 * age), r * squash, r], color, alpha: clamp01(peak * life * cameraFade * shown), age, cameraFade });
  }
  return out;
}
/** Night weight step, identical to GGbot T9n approachNight(w, night, dt): linear to 0/1 over nightFadeS, dt clamped 0..0.1 s. */
export function approachNight(w: number, night: boolean, dt: number): number {
  const target = night ? 1 : 0, step = Math.max(0, Math.min(dt, 0.1)) / ISLAND_FX.nightFadeS;
  return w < target ? Math.min(target, w + step) : Math.max(target, w - step);
}
/** Lighthouse light visibility from the night weight (0 slope at both ends, like the T9n lamp light). */
export function lightFromNight(w: number): number { return smoothstep(0, 1, w); }
