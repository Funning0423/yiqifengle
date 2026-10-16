import { basisQuat, clamp01, cross, dot, len, norm, smoothstep, sub } from './IslandAtmosphereFxCore';
import type { FxGeometry, Q4, V3 } from './IslandAtmosphereFxCore';
/** Island gulls (fx_gull_N), engine-free: flight planning, call sync, poses. cc wrapper = GullFlock.ts, tests = tools/scene-fx.
 * Mesh: the island's own env_anim_seagull_fly_01_v22 body + wing_L/R (local +Z = beak, wings hinge at x = -/+0.04, y 0.03).
 * Each gull lives in one of three modes: off (hidden, waiting off-screen), fly (a chain of cubic Hermite legs), perch.
 * Flights start and end outside the current camera frame; over the island they stay above the trees unless landing / taking off;
 * every sampled point keeps clear of the lighthouse, house, trees, signpost (>= 2 m) and the heroine; >= camClearM from the camera
 * (planned with planClearM, plus a hard per-frame push-out). Gull calls (AmbienceAudio.onGullCall, yawWorldDeg = world heading
 * from the heroine, atan2(x, z)): a near call books a hidden gull at 'scheduled' and re-plans it at 'start' against the live camera
 * so it crosses close in front of the lens from the call's side (or over the camera's shoulder if that side is behind it). */
export const GULL_FX = {
  count: 6,                                     // >= 1 always held back off-screen for a short-lead near call
  target: { day: [4, 5], night: [1, 2] },       // gulls out (flying or perched) at once; in frame that is ~2-4 by day
  speed: { fly: [5.5, 8], glide: 9, near: 6.5, land: 1.2 },
  size: [.92, 1.12],
  seaY: -0.92, glideAboveSeaM: .7,
  island: { c: [1.5, 1] as [number, number], r: 13, flyY: 7.5, groundY: 1.6 },
  lighthouse: { c: [0, -2.65] as [number, number], r: 3.3, topY: 10.8 },
  house: { min: [.7, -2, -5.1] as V3, max: [5.5, 5.9, 1.2] as V3 },
  trees: [[2.3, -7.9, 2, 3.9], [-4.9, .2, 2.4, 6.6], [5.1, 9.3, 2.2, 4.5], [3.1, 2.6, 1.7, 5], [-3.2, -6, 2.8, 7.4]] as number[][],   // x, z, r, top
  sign: { base: [-4.4, -1.15, 1.5] as V3, topY: 3.9, clearM: 2, postR: 1 },
  /** Body-centre positions (surface + 0.09 m body half-height). Not on the lighthouse, not on the signpost. */
  perches: [
    { id: 'roof_ridge_a', p: [3.25, 4.55, -1.38] as V3, out: null as number[] | null },
    { id: 'roof_ridge_b', p: [4.3, 4.55, -1.38] as V3, out: null as number[] | null },
    { id: 'fence_e_0', p: [8.15, 1.27, .1] as V3, out: [1, 0] },
    { id: 'fence_e_1', p: [7.75, 1.27, 2.0] as V3, out: [1, .2] },
    { id: 'fence_w_0', p: [-1.65, 1.04, .3] as V3, out: [-1, -.3] },
  ],
  camClearM: 1.0, planClearM: 1.6, nearClearM: 2.0, heroClearM: 1.0, heroFleeM: 2.4, camFleeM: 2.6,
  near: { passM: [3.2, 2.5, 4, 5], upK: [.3, .5, .12, .75], inS: [.55, 1.6], exitM: 14 },
  restS: { day: [5, 12], night: [30, 70] }, offS: { day: [.5, 2.5], night: [6, 16] },
  chance: { perchDay: .3, perchNight: .65, glide: .2, nearDay: .12 },
  flap: { hz: 2.7, ampDeg: 34, fastHz: 3.6, fastAmpDeg: 44, glideDeg: 7, foldYDeg: 80, foldScale: .58 },
  nightTint: [.74, .8, .94] as V3,
  /** Far gulls read as ~5 px on a phone (Mac r4): drawn up to farBoost x larger from farM[0] to farM[1] metres off the lens
   * (cosmetic only: paths, clearances and the >= 1 m lens rule are unchanged; near gulls keep their size). */
  farBoost: 1.6, farM: [16, 42] as [number, number],
  /** fx wings (Mac r4: the GLB wing planes put the dark palette texel on top and the white one underneath, unlit by the sun
   * from below = black slivers). Own low-poly cambered wing, both sides built explicitly (no cull override), builtin-unlit
   * vertex colour: top light grey with darker tips, underside white-grey; day/night via wingTint(). Span/chord as the GLB wing. */
  wing: { top: [176, 184, 194] as V3, tip: [92, 96, 104] as V3, under: [240, 242, 244] as V3, underTip: [204, 208, 214] as V3,
    camberM: .045, night: .5 },
  /** Edge-on guard: a flying gull whose wing plane is within faceDeg of the lens line is tilted (about the axis across the view)
   * so the lens sees it at >= min(faceDeg, 6 x elevation); max faceDeg, eased over ~0.1 s. Pose only (path unchanged). */
  faceDeg: 14,
};
/** One wing (side -1 = left, +1 = right) in the wing node's local space (span along X from the root at 0, chord along Z with
 * the leading edge +Z, up +Y). Two shells: top (visible from above) and underside (from below), each wound to face out. */
export function wingGeometry(side: number): FxGeometry {
  const W = GULL_FX.wing, s = side < 0 ? -1 : 1, c = W.camberM;
  // root leading/ridge/trailing, mid leading/ridge/trailing, tip (cambered: ridge and leading edge raised)
  const P: V3[] = [[0, c * .6, .065], [0, c, -.01], [0, 0, -.09], [.3 * s, c * .8, .045], [.31 * s, c * 1.1, -.012], [.32 * s, 0, -.065], [.56 * s, c * .2, .01]];
  const T = [[0, 3, 4], [0, 4, 1], [1, 4, 5], [1, 5, 2], [3, 6, 4], [4, 6, 5]], positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let shell = 0; shell < 2; shell++) {
    const base = positions.length / 3, top = shell === 0, lift = top ? .002 : -.002;
    for (let i = 0; i < P.length; i++) { const k = Math.min(1, Math.abs(P[i][0]) / .56), a = top ? W.top : W.under, b = top ? W.tip : W.underTip, m = k * k;
      positions.push(P[i][0], P[i][1] + lift, P[i][2]); colors.push((a[0] + (b[0] - a[0]) * m) / 255, (a[1] + (b[1] - a[1]) * m) / 255, (a[2] + (b[2] - a[2]) * m) / 255, 1); }
    for (let t = 0; t < T.length; t++) { const tri = T[t], A = P[tri[0]], B = P[tri[1]], C = P[tri[2]], n = cross(sub(B, A), sub(C, A)), up = n[1] > 0;
      if (up === top) indices.push(base + tri[0], base + tri[1], base + tri[2]); else indices.push(base + tri[0], base + tri[2], base + tri[1]); }
  }
  let mn: V3 = [1e9, 1e9, 1e9], mx: V3 = [-1e9, -1e9, -1e9]; for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], positions[i + k]); mx[k] = Math.max(mx[k], positions[i + k]); }
  return { positions, colors, indices, min: mn, max: mx };
}
/** Unlit wing colour multiplier: 1 by day; at night the gull night tint x wing.night (the wings get no night lighting). */
export function wingTint(night: number): V3 { const w = clamp01(night), T = GULL_FX.nightTint, k = 1 + (GULL_FX.wing.night - 1) * w;
  return [(1 + (T[0] - 1) * w) * k, (1 + (T[1] - 1) * w) * k, (1 + (T[2] - 1) * w) * k]; }
export type GullCam = { pos: V3; fwd: V3; up: V3; right: V3; tanY: number; aspect: number; vel?: V3; turn?: V3 };
export type GullCallEvent = { id: number; phase: 'scheduled' | 'start' | 'cancelled' | string; at?: number; dist: 'near' | 'far' | string;
  yawWorldDeg: number; distM?: number; durS?: number; leadS?: number; kind?: string };
export type GullPose = { visible: boolean; pos: V3; rot: Q4; size: number; wingL: Q4; wingR: Q4; wingScaleX: number; mode: string; perch: string | null };
type Leg = { a: V3; b: V3; c: V3; d: V3; dur: number; kind: string };
type Gull = { i: number; mode: string; pos: V3; vel: V3; legs: Leg[]; lt: number; until: number; perch: number; yaw: number; size: number;
  up: V3; tilt: number; fold: number; flapT: number; flapOn: boolean; flapUntil: number; ext: number; call: number | null; callStart: number; reqDone: boolean; prevVel: V3 };
/** Rodrigues rotation of v about unit axis k by angle t (rad). */
function rotv(v: V3, k: V3, t: number): V3 { const c = Math.cos(t), sn = Math.sin(t), kv = cross(k, v), d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * sn + k[0] * d, v[1] * c + kv[1] * sn + k[1] * d, v[2] * c + kv[2] * sn + k[2] * d]; }
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const mad = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dist = (a: V3, b: V3) => len(sub(a, b));
const qmul = (p: Q4, q: Q4): Q4 => [p[3] * q[0] + p[0] * q[3] + p[1] * q[2] - p[2] * q[1], p[3] * q[1] - p[0] * q[2] + p[1] * q[3] + p[2] * q[0],
  p[3] * q[2] + p[0] * q[1] - p[1] * q[0] + p[2] * q[3], p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2]];
const qaxis = (ax: number, deg: number): Q4 => { const h = deg * Math.PI / 360, s = Math.sin(h), q: Q4 = [0, 0, 0, Math.cos(h)]; q[ax] = s; return q; };
export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function yawDir(yawDeg: number): V3 { const r = yawDeg * Math.PI / 180; return [Math.sin(r), 0, Math.cos(r)]; }
export function yawOf(v: V3): number { const d = Math.atan2(v[0], v[2]) * 180 / Math.PI; return d < 0 ? d + 360 : d; }
function bez(l: Leg, u: number): V3 { const v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
  return [A * l.a[0] + B * l.b[0] + C * l.c[0] + D * l.d[0], A * l.a[1] + B * l.b[1] + C * l.c[1] + D * l.d[1], A * l.a[2] + B * l.b[2] + C * l.c[2] + D * l.d[2]]; }
function bezVel(l: Leg, u: number): V3 { const v = 1 - u, A = 3 * v * v / l.dur, B = 6 * v * u / l.dur, C = 3 * u * u / l.dur;
  return [A * (l.b[0] - l.a[0]) + B * (l.c[0] - l.b[0]) + C * (l.d[0] - l.c[0]), A * (l.b[1] - l.a[1]) + B * (l.c[1] - l.b[1]) + C * (l.d[1] - l.c[1]), A * (l.b[2] - l.a[2]) + B * (l.c[2] - l.b[2]) + C * (l.d[2] - l.c[2])]; }
/** Cubic Hermite leg a(va) -> b(vb) as a Bezier (C1 joins between legs). dur defaults to length / mean speed. */
export function hermite(a: V3, va: V3, b: V3, vb: V3, kind: string, dur?: number): Leg {
  const T = dur !== undefined ? dur : Math.max(.3, dist(a, b) / Math.max(1, (len(va) + len(vb)) / 2));
  return { a, b: mad(a, va, T / 3), c: mad(b, vb, -T / 3), d: b, dur: T, kind };
}
export function project(cam: GullCam, p: V3): { sx: number; sy: number; z: number; inFrame: boolean } {
  const r = sub(p, cam.pos), z = dot(r, cam.fwd), tanX = cam.tanY * cam.aspect;
  const sx = z > 1e-3 ? dot(r, cam.right) / (z * tanX) : 9, sy = z > 1e-3 ? dot(r, cam.up) / (z * cam.tanY) : 9;
  return { sx, sy, z, inFrame: z > .3 && Math.abs(sx) < 1 && Math.abs(sy) < 1 };
}
export function screenPoint(cam: GullCam, sx: number, sy: number, d: number): V3 {
  const tanX = cam.tanY * cam.aspect; return add(add(add(cam.pos, mul(cam.fwd, d)), mul(cam.right, sx * tanX * d)), mul(cam.up, sy * cam.tanY * d));
}
function segDist(p: V3, a: V3, b: V3): number { const ab = sub(b, a), t = clamp01(dot(sub(p, a), ab) / Math.max(1e-9, dot(ab, ab))); return dist(p, mad(a, ab, t)); }
/** Static-world clearance for one point. kind: fly (above trees over the island), glide (may skim the sea), near/land/takeoff
 * (low allowed, obstacles only). `end` = perch the leg lands on / leaves from (house/ground/trees ignored within 1.6 m of it). */
export function pointClear(p: V3, kind: string, end: V3 | null, hero: V3 | null, m = 0): string | null {
  const G = GULL_FX, I = G.island, L = G.lighthouse, H = G.house, S = G.sign;
  if (p[1] < G.seaY + (kind === 'glide' ? .3 : 1) + m) return 'sea';
  const nearEnd = !!end && dist(p, end) < 1.6, dI = Math.sqrt((p[0] - I.c[0]) * (p[0] - I.c[0]) + (p[2] - I.c[1]) * (p[2] - I.c[1]));
  if (dI < I.r + m) { if (kind === 'fly' && p[1] < I.flyY + m) return 'island-low'; if (!nearEnd && p[1] < I.groundY + m) return 'ground'; }
  if (p[1] < L.topY + m && Math.sqrt((p[0] - L.c[0]) * (p[0] - L.c[0]) + (p[2] - L.c[1]) * (p[2] - L.c[1])) < L.r + m) return 'lighthouse';
  if (!nearEnd && p[0] > H.min[0] - m && p[0] < H.max[0] + m && p[1] > H.min[1] - m && p[1] < H.max[1] + m && p[2] > H.min[2] - m && p[2] < H.max[2] + m) return 'house';
  if (!nearEnd) for (let i = 0; i < G.trees.length; i++) { const t = G.trees[i]; if (p[1] < t[3] + m && Math.sqrt((p[0] - t[0]) * (p[0] - t[0]) + (p[2] - t[1]) * (p[2] - t[1])) < t[2] + m) return 'tree'; }
  if (segDist(p, S.base, [S.base[0], S.topY, S.base[2]]) < S.clearM + S.postR + m) return 'signpost';
  if (hero && segDist(p, hero, [hero[0], hero[1] + 1.7, hero[2]]) < G.heroClearM + m) return 'heroine';
  return null;
}
/** Samples a leg chain; checks static clearance and the camera (predicted along cam.vel for up to 1.5 s) >= minCam. */
export function legsClear(legs: Leg[], cam: GullCam, hero: V3 | null, minCam: number, perch: V3 | null): string | null {
  let t = 0;
  for (let k = 0; k < legs.length; k++) { const l = legs[k], n = Math.max(8, Math.ceil(l.dur * 30));
    for (let j = 0; j <= n; j++) { const u = j / n, p = bez(l, u), why = pointClear(p, l.kind, perch, hero, .25); if (why) return why;
      const cp = cam.vel ? mad(cam.pos, cam.vel, Math.min(1.5, t + u * l.dur)) : cam.pos; if (dist(p, cp) < minCam) return 'camera'; }
    t += l.dur; }
  return null;
}
export class GullFlock {
  readonly gulls: Gull[] = []; readonly stats = { minCamM: 1e9, pushes: 0, plans: 0, rejects: 0, nearCalls: 0, nearBooked: 0, nearPlanned: 0 };
  /** Calls this flock wants played (wrapper forwards them to requestGullCall when it exists). */
  readonly requests: { dist: 'near' | 'far'; yawWorldDeg: number; gull: number }[] = [];
  readonly nearLog: { id: number; gull: number; start: number; passAt: number; pass: V3 | null; behind: boolean; ok: boolean }[] = [];
  private rand: () => number; private time = 0; private night = 0; private wantDay = 3; private wantIn = 0; private exterior = false;
  private cam: GullCam | null = null; private hero: V3 | null = null; private reqYaw: { yaw: number; gull: number; until: number } | null = null; lastReject = '';
  constructor(seed: number) { this.rand = rng(seed); const G = GULL_FX;
    for (let i = 0; i < G.count; i++) this.gulls.push({ i, mode: 'off', pos: [0, 30, 0], vel: [0, 0, 1], legs: [], lt: 0, until: this.R(.5, 4) + i * 1.5, perch: -1, yaw: 0,
      size: this.R(G.size[0], G.size[1]), up: [0, 1, 0], tilt: 0, fold: 0, flapT: this.R(0, 1), flapOn: true, flapUntil: 0, ext: 0, call: null, callStart: 0, reqDone: false, prevVel: [0, 0, 1] }); }
  private R(a: number, b: number) { return a + (b - a) * this.rand(); }
  get now() { return this.time; }
  /** exterior false = indoors: every gull goes off (no pop on return, all re-enter from outside the frame). */
  setView(exterior: boolean) { if (!exterior && this.exterior) for (let i = 0; i < this.gulls.length; i++) this.toOff(this.gulls[i], this.R(.5, 3)); this.exterior = exterior; }
  private toOff(g: Gull, wait: number) { if (g.perch >= 0) g.perch = -1; g.mode = 'off'; g.legs = []; g.call = null; g.until = this.time + wait; g.ext = 0; }
  private perchTaken(j: number) { for (let i = 0; i < this.gulls.length; i++) if (this.gulls[i].perch === j) return true; return false; }
  private startLegs(g: Gull, legs: Leg[], perch: number) { g.mode = 'fly'; g.legs = legs; g.lt = 0; g.perch = perch; g.ext = 0; g.pos = legs[0].a; this.stats.plans++; }
  private speed() { return this.R(GULL_FX.speed.fly[0], GULL_FX.speed.fly[1]); }
  /** Random crossing of the frame (enters and leaves beyond the frame edge) at depth d0..d1, gently curved, never a fixed loop. */
  planPass(cam: GullCam, dMin: number, dMax: number, sideHint?: number): Leg[] | null {
    for (let k = 0; k < 10; k++) {
      // 1-2 waypoints inside the frame at their own depths: some cross flat, some recede or come closer, some wander
      const d0 = this.R(dMin, dMax), d1 = Math.min(dMax * 1.6, d0 * this.R(.6, 2.2)), side = sideHint || (this.rand() < .5 ? -1 : 1), s = this.speed() * (d0 > 12 ? .85 : 1);
      const pts: V3[] = [screenPoint(cam, side * this.R(1.25, 1.55), this.R(-.35, .8), d0)], n = this.rand() < .45 ? 2 : 1;
      for (let j = 1; j <= n; j++) { const u = j / (n + 1); pts.push(screenPoint(cam, side * (1 - 2 * u) * this.R(.3, .8), this.R(-.25, .7), (d0 + (d1 - d0) * u) * this.R(.85, 1.15))); }
      pts.push(this.rand() < .2 ? screenPoint(cam, this.R(-.6, .6), this.R(1.25, 1.45), d1) : screenPoint(cam, -side * this.R(1.25, 1.55), this.R(-.3, .9), d1));
      const vel: V3[] = []; for (let j = 0; j < pts.length; j++) { const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)]; vel.push(mul(norm(add(sub(b, a), [0, j && j < pts.length - 1 ? this.R(-1.5, 1.5) : 0, 0])), s)); }
      const legs: Leg[] = []; for (let j = 0; j + 1 < pts.length; j++) legs.push(hermite(pts[j], vel[j], pts[j + 1], vel[j + 1], 'fly'));
      if (!legsClear(legs, cam, this.hero, GULL_FX.planClearM, null)) return legs; this.stats.rejects++;
    }
    return null;
  }
  /** Long glide that drops to the sea, skims ~12 m across the lower frame and climbs out (overview cameras only). */
  planGlide(cam: GullCam): Leg[] | null {
    const G = GULL_FX, y = G.seaY + G.glideAboveSeaM;
    for (let k = 0; k < 8; k++) {
      const sx = this.R(-.5, .5), sy = this.R(-.85, -.2), tanX = cam.tanY * cam.aspect, d = norm(add(add(cam.fwd, mul(cam.right, sx * tanX)), mul(cam.up, sy * cam.tanY)));
      if (d[1] > -.05) continue; const t = (y - cam.pos[1]) / d[1]; if (t < 8 || t > 45) continue;
      const s0 = mad(cam.pos, d, t), across = norm(cross([0, 1, 0], cam.fwd)), turn = this.R(-.6, .6), side = this.rand() < .5 ? -1 : 1;
      const dir = norm(mad(mul(across, side), cam.fwd, turn)), v = mul(dir, G.speed.glide), A = mad(s0, dir, -6), B = mad(s0, dir, 6);
      const dA = Math.max(10, dot(sub(A, cam.pos), cam.fwd)), p0 = screenPoint(cam, -side * 1.4, this.R(.1, .6), dA);
      const p3 = mad(mad(B, dir, 16), [0, 1, 0], 7);
      const legs = [hermite(p0, mul(norm(sub(A, p0)), G.speed.glide), A, v, 'fly'), hermite(A, v, B, v, 'glide'), hermite(B, v, p3, mul(norm(sub(p3, B)), 7), 'fly')];
      legs[0].kind = 'glide'; legs[2].kind = 'glide';
      if (!legsClear(legs, cam, this.hero, G.planClearM, null)) return legs; this.stats.rejects++;
    }
    return null;
  }
  /** Fly in from outside the frame and land on perch j (approach from its outer side, slowing to ~1 m/s). */
  planPerch(cam: GullCam, j: number): Leg[] | null {
    const G = GULL_FX, P = G.perches[j], p = P.p;
    for (let k = 0; k < 6; k++) {
      let o: V3; if (P.out) o = norm([P.out[0] + this.R(-.25, .25), 0, P.out[1] + this.R(-.25, .25)]); else { const a = (this.rand() < .5 ? 0 : 180) + this.R(-40, 40); o = yawDir(a); }
      const w2 = add(p, add(mul(o, 9), [0, 6, 0])), s = this.speed(), dw = Math.max(8, dot(sub(w2, cam.pos), cam.fwd));
      const p0 = screenPoint(cam, (dot(sub(w2, cam.pos), cam.right) > 0 ? 1 : -1) * this.R(1.25, 1.5), this.R(.2, .9), dw);
      const vin = mul(norm(sub(p, w2)), s * .8), vend = add(mul(o, -G.speed.land), [0, -.3, 0]);
      const legs = [hermite(p0, mul(norm(sub(w2, p0)), s), w2, vin, 'fly'), hermite(w2, vin, p, vend, 'land', dist(w2, p) / (s * .45))];
      if (!legsClear(legs, cam, this.hero, G.planClearM, p)) return legs; this.stats.rejects++;
    }
    return null;
  }
  /** Leave the perch: hop up and away (from the heroine/camera if they came close) and out of the frame. */
  planTakeoff(g: Gull, cam: GullCam, away: V3 | null): Leg[] | null {
    const G = GULL_FX, p = g.pos;
    for (let k = 0; k < 8; k++) {
      let o = away ? norm([away[0], 0, away[2]]) : yawDir(g.yaw + this.R(-60, 60)); if (k > 3) o = yawDir(this.R(0, 360));
      const t1 = add(p, add(mul(o, 3.5), [0, 2.6, 0])), side = dot(o, cam.right) > 0 ? 1 : -1, s = this.speed();
      const ex = screenPoint(cam, side * this.R(1.3, 1.6), this.R(.3, 1.2), Math.max(10, dot(sub(t1, cam.pos), cam.fwd) + this.R(4, 14)));
      const v1 = mul(norm(add(sub(ex, t1), [0, 2, 0])), s * .7);
      const legs = [hermite(p, add(mul(o, 1.5), [0, 2.4, 0]), t1, v1, 'takeoff'), hermite(t1, v1, ex, mul(norm(sub(ex, t1)), s), 'takeoff')];
      if (!legsClear(legs, cam, this.hero, G.planClearM, p)) { g.perch = -1; return legs; } this.stats.rejects++;
    }
    return null;
  }
  /** Source point of a call: distM (clamped) from the heroine along yawWorldDeg, at gull height. */
  private source(yaw: number, d: number): V3 { const h = this.hero || (this.cam ? mad(this.cam.pos, this.cam.fwd, 4) : [0, 0, 0] as V3); return add(mad(h, yawDir(yaw), d), [0, 3, 0]); }
  /** Near fly-by at the live camera: crosses the frame ~passM in front of the lens from the call's side (side-on when that
   * direction is in front of the camera, over the shoulder when it is behind), arriving inS after now. */
  planNear(g: Gull, cam: GullCam, yaw: number): { legs: Leg[]; pass: V3; inS: number; behind: boolean } | null {
    const G = GULL_FX, N = G.near, src = this.source(yaw, 7), r = sub(src, cam.pos), lx = dot(r, cam.right), lz = dot(r, cam.fwd);
    const side = lx >= 0 ? 1 : -1, behind = lz < -.25 * Math.abs(lx), vis = g.mode !== 'off', s = G.speed.near;
    const camAt = (t: number) => cam.vel ? mad(cam.pos, cam.vel, Math.min(1.5, t)) : cam.pos;
    // the camera may be turning (outbound orbit): aim at where it will look when the gull arrives
    const turnS = cam.turn ? Math.min(.8, N.inS[1]) : 0, fwd = norm(cam.turn ? mad(cam.fwd, cam.turn, turnS) : cam.fwd), right = norm(cross(fwd, cam.up)), up = cross(right, fwd);
    const C: GullCam = { pos: cam.pos, fwd, up, right, tanY: cam.tanY, aspect: cam.aspect, vel: cam.vel }, tanX = cam.tanY * cam.aspect;
    for (let k = 0; k < N.passM.length * N.upK.length * 12; k++) {
      const D = N.passM[k % N.passM.length], upK = N.upK[Math.floor(k / N.passM.length) % N.upK.length], ev = Math.floor(k / (N.passM.length * N.upK.length)) % 6, wide = k >= N.passM.length * N.upK.length * 6;
      // leaves the lens diagonally into the scene (lateral drift ~0.28 per metre) so it stays in the narrow portrait frame ~1-2 s
      const move = norm(add(add(C.fwd, mul(C.right, -side * (behind ? .18 : .28))), mul(C.up, -.06)));
      let inS = vis ? Math.min(N.inS[1], Math.max(N.inS[0], dist(g.pos, cam.pos) / (s * 1.3))) : .9;
      let pc = camAt(inS);
      const pass = add(add(add(pc, mul(C.fwd, D)), mul(C.right, side * .3 * tanX * D)), mul(C.up, upK * cam.tanY * D));
      // hidden gull: comes from beside the camera on the call's side (or over its shoulder when that side is behind it)
      const entry = vis ? g.pos : behind ? add(add(add(pc, mul(C.right, side * (wide ? 2.8 : 1.9))), mul(C.up, 2.3)), mul(C.fwd, -1.6))
        : add(add(add(pc, mul(C.right, side * (wide ? 3.9 : 2.9))), mul(C.up, 1.2)), mul(C.fwd, -.4));
      if (!vis) { inS = Math.max(N.inS[0], dist(entry, pass) / s); pc = camAt(inS); }
      const vIn = vis && len(g.vel) > .5 ? g.vel : mul(norm(sub(pass, entry)), s), vPass = mul(move, s);
      // after the pass it climbs away (over whatever stands behind the heroine) and leaves the frame upward/sideways
      // exit variants: straight on and up, veer to the far / the call's side, then the same climbing steeply (e.g. over the lighthouse)
      const h = norm([move[0], 0, move[2]]), sideH = norm(cross([0, 1, 0], h)), turn = [0, -side * .9, side * .9, 0, -side * 1.8, side * 1.8][ev], steep = ev >= 3;
      const mid = add(mad(pass, move, steep ? 3 : 5), [0, steep ? 3.5 : 2.2, 0]), out = norm(mad(h, sideH, -turn * (dot(sideH, C.right) >= 0 ? 1 : -1)));
      const exit = add(mad(mid, out, 7), [0, steep ? 12 : 5, 0]), vMid = mul(norm(sub(exit, pass)), s);
      const legs = [hermite(entry, vIn, pass, vPass, 'near', inS), hermite(pass, vPass, mid, vMid, 'near'), hermite(mid, vMid, exit, mul(norm(sub(exit, mid)), s), 'near')];
      const why = legsClear(legs, cam, this.hero, G.nearClearM, null); if (!why) return { legs, pass, inS, behind };
      this.stats.rejects++; this.lastReject = why;
    }
    return null;
  }
  /** AmbienceAudio.onGullCall listener body. now = this flock's clock (leadS from the event, else at - clock if given). */
  onCall(e: GullCallEvent, audioClock?: number) {
    if (!e || typeof e !== 'object' || !this.cam || !this.exterior) return; const cam = this.cam, yaw = Number(e.yawWorldDeg); if (!isFinite(yaw)) return;
    const mine = this.reqYaw && this.reqYaw.until > this.time && Math.abs(((yaw - this.reqYaw.yaw + 540) % 360) - 180) < 1 ? this.reqYaw.gull : -1;
    if (e.phase === 'cancelled') { for (let i = 0; i < this.gulls.length; i++) { const q = this.gulls[i]; if (q.call !== e.id) continue; q.call = null; if (q.mode === 'off') q.until = this.time + this.R(1, 3); } return; }
    if (mine >= 0) { if (e.phase === 'start') this.reqYaw = null; return; }     // our own requestGullCall: that gull is already there
    if (e.dist === 'near') {
      if (e.phase === 'scheduled') { this.stats.nearBooked++;
        let g: Gull | null = null; for (let i = 0; i < this.gulls.length && !g; i++) if (this.gulls[i].mode === 'off' && this.gulls[i].call === null) g = this.gulls[i];
        if (!g) { let best = -1; for (let i = 0; i < this.gulls.length; i++) { const q = this.gulls[i]; if (q.mode !== 'fly' || q.call !== null) continue; const d = dist(q.pos, cam.pos); if (d > best) { best = d; g = q; } } }
        if (!g) return; g.call = e.id; if (g.mode === 'perch') g.call = null; const lead = typeof e.leadS === 'number' && isFinite(e.leadS) ? e.leadS : typeof e.at === 'number' && typeof audioClock === 'number' ? e.at - audioClock : 2.5;
        g.callStart = this.time + Math.max(0, lead);
        if (g.mode === 'off') { g.until = this.time + 99; g.legs = []; }      // held off-screen, launched at 'start'
        return;
      }
      if (e.phase === 'start') { this.stats.nearCalls++;
        let g: Gull | null = null; for (let i = 0; i < this.gulls.length; i++) if (this.gulls[i].call === e.id) g = this.gulls[i];
        if (!g) for (let i = 0; i < this.gulls.length && !g; i++) if (this.gulls[i].mode === 'off') g = this.gulls[i];
        const plan = g ? this.planNear(g, cam, yaw) : null;
        if (this.nearLog.length > 31) this.nearLog.shift();
        this.nearLog.push({ id: e.id, gull: g ? g.i : -1, start: this.time, passAt: plan ? this.time + plan.inS : -1, pass: plan ? plan.pass : null, behind: plan ? plan.behind : false, ok: !!plan });
        if (!g) return; g.call = null;
        if (plan) { if (g.perch >= 0) g.perch = -1; this.startLegs(g, plan.legs, -1); this.stats.nearPlanned++; } else if (g.mode === 'off') g.until = this.time + 1;
      }
      return;
    }
    if (e.phase === 'scheduled') {        // far call: make sure someone is out there on that side
      for (let i = 0; i < this.gulls.length; i++) { const q = this.gulls[i]; if (q.mode !== 'off' && project(cam, q.pos).inFrame) return; }
      let free = 0; for (let i = 0; i < this.gulls.length; i++) if (this.gulls[i].mode === 'off' && this.gulls[i].call === null) free++;
      if (free < 2) return;                 // keep the reserve for a near call that may follow ~1.2 s later
      for (let i = 0; i < this.gulls.length; i++) { const q = this.gulls[i]; if (q.mode !== 'off' || q.call !== null) continue;
        const r = sub(this.source(yaw, 20), cam.pos), legs = this.planPass(cam, 16, 40, dot(r, cam.right) >= 0 ? 1 : -1); if (legs) this.startLegs(q, legs, -1); return; }
    }
  }
  private request(g: Gull, d: 'near' | 'far') { const h = this.hero || this.cam!.pos, y = yawOf(sub(g.pos, h)); this.requests.push({ dist: d, yawWorldDeg: +y.toFixed(2), gull: g.i }); this.reqYaw = { yaw: +y.toFixed(2), gull: g.i, until: this.time + .5 }; }
  /** One frame. night = night weight 0..1; hero = heroine root (null when unknown). Returns poses (index = gull). */
  advance(dt: number, cam: GullCam, night: number, hero: V3 | null): GullPose[] {
    const G = GULL_FX, step = isFinite(dt) && dt > 0 ? Math.min(dt, .1) : 0; this.time += step; this.night = clamp01(night); this.hero = hero;
    if (this.cam && step > 0 && !cam.vel) { const v = mul(sub(cam.pos, this.cam.pos), 1 / step), pv = this.cam.vel || v, k = Math.min(1, step * 6); cam.vel = len(v) > 40 ? [0, 0, 0] : add(mul(pv, 1 - k), mul(v, k));
      if (!cam.turn) { const w = mul(sub(cam.fwd, this.cam.fwd), 1 / step), pw = this.cam.turn || w; cam.turn = len(w) > 6 ? [0, 0, 0] : add(mul(pw, 1 - k), mul(w, k)); } }
    this.cam = cam; const isNight = this.night > .5;
    if ((this.wantIn -= step) <= 0) { this.wantDay = Math.round(this.R(G.target.day[0], G.target.day[1] + .49)); this.wantIn = this.R(15, 30); }
    const want = isNight ? (this.wantDay > 4 ? G.target.night[1] : G.target.night[0]) : this.wantDay; let out = 0; for (let i = 0; i < this.gulls.length; i++) if (this.gulls[i].mode !== 'off') out++;
    const poses: GullPose[] = [];
    for (let i = 0; i < this.gulls.length; i++) { const g = this.gulls[i];
      if (g.mode === 'off' && g.call !== null && this.time > g.callStart + 1.5) { g.call = null; g.until = this.time + 1; }   // booked call never started
      if (g.mode === 'off' && g.call === null && this.exterior && this.time >= g.until) {
        if (out >= want) g.until = this.time + this.R(1, 3);
        else { let legs: Leg[] | null = null, perch = -1, close = false; const r = this.rand();
          const pc = isNight ? G.chance.perchNight : G.chance.perchDay, free: number[] = [];
          for (let j = 0; j < G.perches.length; j++) if (!this.perchTaken(j) && (!hero || dist(G.perches[j].p, hero) > 4) && dist(G.perches[j].p, cam.pos) > 4) free.push(j);
          if (r < pc && free.length) { perch = free[Math.floor(this.rand() * free.length)]; legs = this.planPerch(cam, perch); }
          else if (!isNight && r < pc + G.chance.glide && cam.pos[1] > 5) legs = this.planGlide(cam);
          else if (!isNight && r < pc + G.chance.glide + G.chance.nearDay && cam.pos[1] > 5) { legs = this.planPass(cam, 4.5, 8); close = !!legs; }
          if (!legs) { perch = -1; legs = this.planPass(cam, 14, 42); }
          if (legs) { this.startLegs(g, legs, perch); g.reqDone = !close; out++; } else g.until = this.time + 1; }
      }
      if (g.mode === 'fly') this.fly(g, step, cam);
      else if (g.mode === 'perch') { const near = (hero && dist(hero, g.pos) < G.heroFleeM) || dist(cam.pos, g.pos) < G.camFleeM;
        if (this.exterior && (near || this.time >= g.until)) { const away = near ? sub(g.pos, hero && dist(hero, g.pos) < G.heroFleeM ? hero : cam.pos) : null; const legs = this.planTakeoff(g, cam, away);
          if (legs) this.startLegs(g, legs, -1); else g.until = this.time + 2; } }
      poses.push(this.pose(g, step, cam));
    }
    return poses;
  }
  private fly(g: Gull, step: number, cam: GullCam) {
    const G = GULL_FX; g.lt += step;
    while (g.legs.length && g.lt >= g.legs[0].dur) { g.lt -= g.legs[0].dur; const done = g.legs.shift()!;
      if (!g.legs.length) {
        if (done.kind === 'land' && g.perch >= 0) { g.mode = 'perch'; g.pos = G.perches[g.perch].p; g.vel = [0, 0, 0]; const v = sub(done.d, done.c);
          g.yaw = yawOf(len([v[0], 0, v[2]]) > 1e-3 ? v : [0, 0, 1]) + this.R(-35, 35); const R = this.night > .5 ? G.restS.night : G.restS.day; g.until = this.time + this.R(R[0], R[1]);
          if (project(cam, g.pos).inFrame && this.rand() < .45) this.request(g, 'far'); return; }
        // leaving: if still inside the frame (camera moved), carry on straight a little longer before hiding
        if (project(cam, done.d).inFrame && g.ext < 4) { const v = bezVel(done, 1), k = done.kind === 'glide' ? 'glide' : 'near'; g.ext++;
          let ext = hermite(done.d, v, mad(done.d, len(v) > 1 ? v : [0, .5, 3], 2.5), v, k, 2.5);
          if (legsClear([ext], cam, this.hero, G.planClearM, null)) { const e = add(mad(done.d, v, 1), [0, 5, 0]); ext = hermite(done.d, v, e, mul(norm(sub(e, done.d)), len(v)), k, 2.5); }
          if (!legsClear([ext], cam, this.hero, G.planClearM, null)) { g.legs.push(ext); g.lt = 0; continue; } }
        this.toOff(g, this.night > .5 ? this.R(G.offS.night[0], G.offS.night[1]) : this.R(G.offS.day[0], G.offS.day[1])); g.pos = done.d; return; } }
    if (!g.legs.length) return; const l = g.legs[0], u = clamp01(g.lt / l.dur); g.pos = bez(l, u); g.vel = bezVel(l, u);
    if (!g.reqDone && l.kind === 'fly' && project(cam, g.pos).inFrame && dist(g.pos, cam.pos) < 9 && cam.pos[1] > 5) { g.reqDone = true; if (this.rand() < .5) this.request(g, 'near'); }
  }
  private pose(g: Gull, step: number, cam: GullCam): GullPose {
    const G = GULL_FX, F = G.flap, vis = g.mode !== 'off'; let p = g.pos;
    if (vis) { const d = dist(p, cam.pos); if (d < this.stats.minCamM) this.stats.minCamM = d;
      if (d < G.camClearM + .05) { this.stats.pushes++; p = mad(cam.pos, norm(sub(p, cam.pos)), G.camClearM + .05); g.pos = p; } }
    let z: V3, upT: V3 = [0, 1, 0];
    if (g.mode === 'perch') { z = yawDir(g.yaw); const nod = Math.sin(this.time * 1.7 + g.i * 2) > .93 ? .12 : 0; z = norm([z[0], -nod, z[2]]); g.fold = Math.min(1, g.fold + step / .35); }
    else { const v = len(g.vel) > .2 ? g.vel : [0, 0, 1] as V3; z = norm([v[0], Math.max(-.6, Math.min(.6, v[1] / Math.max(.5, len(v)))) * len([v[0], 0, v[2]]) + 1e-4, v[2]]);
      const acc = step > 0 ? mul(sub(g.vel, g.prevVel), 1 / step) : [0, 0, 0] as V3, lat = sub(acc, mul(z, dot(acc, z))), ll = len(lat), lim = ll > 6 ? 6 / ll : 1;
      upT = norm(add([0, 9.8, 0], mul(lat, lim))); g.fold = Math.max(0, g.fold - step / .3); }
    g.prevVel = g.vel; const k = Math.min(1, step * 6); g.up = norm(add(mul(g.up, 1 - k), mul(upT, k)));
    let x = cross(g.up, z); if (len(x) < 1e-4) x = [1, 0, 0]; x = norm(x); let y = cross(z, x);
    // edge-on guard: tilt the wing plane toward the lens (continuous in the camera elevation e, 0 when |e| >= faceDeg)
    const dc = sub(cam.pos, p), dl = len(dc); let want = 0, axis: V3 = [0, 0, 0];
    if (g.mode !== 'perch' && dl > 1e-3) { const d = mul(dc, 1 / dl), sn = Math.max(-1, Math.min(1, dot(d, y))), e = Math.asin(sn) * 180 / Math.PI, E = G.faceDeg;
      const h = sub(d, mul(y, sn)); if (len(h) > 1e-3) { axis = norm(cross(y, h)); want = Math.abs(e) < E ? Math.max(-E, Math.min(E, 6 * e)) - e : 0; } }
    g.tilt += (want - g.tilt) * Math.min(1, step * 16);
    if (Math.abs(g.tilt) > 1e-3 && len(axis) > .5) { const t = g.tilt * Math.PI / 180; x = rotv(x, axis, t); y = rotv(y, axis, t); z = rotv(z, axis, t); }
    const rot = basisQuat(x, y, z);
    // wings: flap/glide bouts while cruising, fast flap on take-off / landing / climb, held on sea glides, folded on a perch
    const kind = g.legs.length ? g.legs[0].kind : g.mode, climbing = g.vel[1] > 1.2, endLand = kind === 'land' && g.legs.length && g.legs[0].dur - g.lt < 1;
    if (this.time >= g.flapUntil) { g.flapOn = !g.flapOn; g.flapUntil = this.time + (g.flapOn ? this.R(1.1, 2.6) : this.R(.9, 2.4)); }
    const fast = kind === 'takeoff' || endLand || climbing, flapping = fast || (kind !== 'glide' && g.flapOn);
    g.flapT += step * (fast ? F.fastHz : F.hz); const amp = fast ? F.fastAmpDeg : F.ampDeg;
    const a = flapping ? F.glideDeg + amp * Math.sin(g.flapT * Math.PI * 2) : F.glideDeg + (kind === 'glide' ? 2 : 1.5) * Math.sin(this.time * 9 + g.i), f = smoothstep(0, 1, g.fold);
    const az = a * (1 - f) - 12 * f, ay = F.foldYDeg * f;
    const boost = 1 + (G.farBoost - 1) * smoothstep(G.farM[0], G.farM[1], dist(p, cam.pos));
    return { visible: vis, pos: p, rot, size: g.size * boost, wingL: qmul(qaxis(1, -ay), qaxis(2, -az)), wingR: qmul(qaxis(1, ay), qaxis(2, az)), wingScaleX: 1 - (1 - F.foldScale) * f,
      mode: g.mode === 'fly' ? kind : g.mode, perch: g.mode === 'perch' && g.perch >= 0 ? G.perches[g.perch].id : null };
  }
  /** Night tint multiplier on the gulls' palette colour (they also get the island's night lighting like every prop). */
  static tint(night: number): V3 { const w = clamp01(night), T = GULL_FX.nightTint; return [1 + (T[0] - 1) * w, 1 + (T[1] - 1) * w, 1 + (T[2] - 1) * w]; }
}
