/**
 * T9 island scene dressing: DATA + pure geometry for the 3D UI props (engine-free, node-testable).
 * Art: ui-props/ (work/grokbot 0f28044, style approved by Funning). Every prop is a Draco GLB whose single
 * material is named M_env_palette and is rebound at runtime to the island's shared M_env_palette; the
 * only other material is the signpost lamp's own M_signpost_lamp (day). No textures, no new fonts.
 *
 * World props (fixed in the island's world space, Cocos metres, +Y up, island scene_root is identity):
 *   - ui_signpost "继续旅程" in the shallows in front of the beach, bottom-right of the portrait island view.
 *     Its screen rect is the hit area of the existing `mainline` control (same handler: composition.enterMainline).
 *   - beach_palm_tall on the left end of the beach, beach_palm_short on the right end.
 * Screen props (bag / journal / settings): stand on the sea under a fixed SCREEN anchor (bottom row) for
 *   the current camera, so the row follows portrait/landscape without moving any world art. A lens pull
 *   (IslandRail) only moves the world camera: these three keep the settled wide shot's screen position and
 *   pixel size (screenPropPose). Their hit areas and the labels 行囊 / 旅程册 / 设置 stay on the existing
 *   IslandJourneyOverlay buttons (same handlers, same screen slots, not scaled by the pull).
 * The signpost "继续旅程" stays a world prop in the shallows. It is not a screen HUD and it does grow when the
 *   lens comes closer.
 * Not added (the island already has them, see combined_visual_m.glb): beach_gull (env_anim_seagull_01 + two
 * flying gulls), beach_crab (env_anim_crab_01, env_anim_hermit_crab_v22), beach_turtle (env_anim_turtle_01).
 */
import { projectPoint, rotate, type CameraPose } from '../world-r1/CameraPose';
export type V3 = [number, number, number];
export type PropRole = 'bag' | 'journal' | 'settings';
export type WorldProp = Readonly<{ prefab: string; position: V3; yawDeg: number; scale: number }>;

export const ISLAND_PROPS = Object.freeze({
  version: 'T9-2026-10-11',
  bundle: 'region_island',
  dir: 'ui-props',
  /** combined_visual_m.glb sub-asset "M_env_palette.material" (the island's shared palette material). */
  paletteMaterialUuid: '498b3fa5-2dd3-4e86-93b8-637ae51438fe@18b7e',
  paletteMaterialName: 'M_env_palette',
  /** env_sea_surface node height in combined_visual_m.glb. */
  seaY: -0.92,
  signpost: {
    prefab: 'ui_signpost', position: [-1.2, -1.15, 18.8] as V3, yawDeg: -21, scale: 2.3,
    lampNode: 'lamp_glass', lampDayMaterial: 'M_signpost_lamp',
    /** Water at the posts (procedural, no asset): contact shadow + two expanding ripple rings, sign-local metres, on the sea surface. */
    water: { centerX: 0.25, postsX: [-0.4, 0.9], shadow: { rx: 1.3, rz: 0.45, color: '#123a44', alpha: 0.5, nightAlpha: 0.35 },
      ripple: { rx: 1.05, rz: 0.36, band: 0.1, color: '#f4fbff', alpha: 0.75, nightColor: '#a9c4dc', nightAlpha: 0.30, periodS: 2.6, grow: 0.45, lift: 0.015 } },
    /** Local AABB of the GLB (origin = bottom centre, front = +Z). */
    boxMin: [-1.235, 0, -0.183] as V3, boxMax: [1.235, 1.875, 0.183] as V3,
    /** props_info.json text_quad_local (Blender) -> Cocos local: (x, z, -y). Panel front face. */
    text: { center: [0.2355, 0.98, 0.19] as V3, widthM: 1.44, heightM: 0.48, string: '继续旅程', color: '#633f21', nightColor: '#3a220f' },
    /** Night-only warm lamp light (T9n). A real SphereLight just in front of lamp_glass (sign-local metres), restricted by
     * Light.visibility to the sign's own layer so only the sign (2 renderers) gets the forward-add pass; range/size are
     * sign-local and scale with the sign. luminanceScale multiplies the engine default luminance (HDR/LDR-safe, same
     * rule as RoomLightingRig's lamp) and the night weight. reflection = faint additive warm pool on the sea under it. */
    lampLight: { local: [-0.78, 1.12, 0.42] as V3, color: '#ffb45c', range: 1.8, size: 0.05, luminanceScale: 0.5, layerBit: 0,
      reflection: { x: -0.85, rx: 0.4, rz: 0.17, color: '#ff9f4f', alpha: 0.12, lift: 0.02 } },
    /** T9n-2 lamp glass at night: unlit warm amber (never lit, never clipped to white; brightest thing on the sign) +
     * a small soft additive glow disc in front of the glass (sign-local metres; lamp_glass bbox centre -1.005, 1.13, 0). */
    lampGlass: { nightColor: '#ffb04a', glow: { center: [-1.005, 1.13, 0.17] as V3, radius: 0.36, color: '#ff9a3c', alpha: 0.4 } },
  },
  palms: [
    { prefab: 'beach_palm_tall', position: [-0.5, -0.30, 9.0] as V3, yawDeg: 200, scale: 0.9 },
    { prefab: 'beach_palm_short', position: [7.0, -0.36, 7.4] as V3, yawDeg: 180, scale: 1 },
  ] as readonly WorldProp[],
  buttons: {
    bag: { prefab: 'ui_satchel', label: '行囊', heightM: 0.915, widthM: 0.86, depthM: 0.514 },
    journal: { prefab: 'ui_notebook', label: '旅程册', heightM: 0.89, widthM: 0.665, depthM: 0.314 },
    settings: { prefab: 'ui_compass', label: '设置', heightM: 1.051, widthM: 0.84, depthM: 0.288 },
  } as Readonly<Record<PropRole, Readonly<{ prefab: string; label: string; heightM: number; widthM: number; depthM: number }>>>,
  /** Cream rounded tag under each screen prop (mockup.py tag(): palette plaster / wood / dark wood). */
  tag: { fill: '#f8f2e2', edge: '#956737', text: '#633f21', shadow: '#14323c5a',
    /** T9n night end (same weight as the 3D props): darker warm grey card, deeper brown text/edge; >= 4.5:1 along the blend. */
    nightFill: '#9a8f7f', nightEdge: '#5e4128', nightText: '#2b1b0c', nightShadow: '#0a1a205a' },
  /** T9n-2 night sea: env_sea_surface's render material (RoomLightingRig's own instance, which only scrolls tilingOffset) gets
   * mainColor = authored mainColor x tint, blended by the props night weight; restored exactly at weight 0. Never the shared
   * M_env_sea material; skipped when the renderer has no instance. tint is sRGB hex (linear = (0.212, 0.347, 0.451)). */
  seaNight: { node: 'env_sea_surface', property: 'mainColor', tint: '#7f9fb3' },
  /** Seconds for the props' night weight to follow a day/night switch (labels, lamp light, water tint fade together). */
  nightFadeS: 0.5,
  notAdded: {
    beach_gull: 'island already has env_anim_seagull_01 (+ env_anim_seagull_fly_01/02_v22)',
    beach_crab: 'island already has env_anim_crab_01 + env_anim_hermit_crab_v22',
    beach_turtle: 'island already has env_anim_turtle_01',
  },
});
export const PROP_ROLES: readonly PropRole[] = ['bag', 'journal', 'settings'];

export type Rect = { x: number; y: number; width: number; height: number };
/** UI rect: centre x/y in canvas units (origin = screen centre, +y up), same convention as WorldNavigationLayout. */
export type PropButtonSlot = { role: PropRole; prop: { x: number; bottom: number; height: number }; hit: Rect; tag: Rect & { fontSize: number } };

/** Bottom-row slots for the three screen props (mockup-portrait.png: x = 0.2/0.5/0.8 W, prop centre 0.885 H). */
export function propButtonLayout(width: number, height: number): { portrait: boolean; slots: PropButtonSlot[] } {
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw Error('Invalid prop frame');
  const portrait = width < height, row = portrait || width < 568;
  const propH = Math.round(Math.max(48, Math.min(84, row ? height * 0.07 : height * 0.12)));
  const font = Math.max(12, Math.min(15, Math.round(propH * 0.22)));
  const tagH = font + 12;
  const slots = PROP_ROLES.map((role, i) => {
    // landscape (mockup-landscape.png): bottom-right row at x = 0.70 / 0.805 / 0.91 W, kept >= 66 px apart and on screen
    const gapL = Math.max(width * 0.105, 66), lastL = width < 700 ? width / 2 - 36 : width * 0.41;
    const cx = row ? (i - 1) * Math.min(width * 0.3, 140) : lastL - (2 - i) * gapL;
    // portrait: prop centre at 0.885 H from the top, but keep the tag above a 30 px bottom inset (home indicator)
    const centreFromTop = row ? Math.min(height * 0.885, height - 30 - tagH - 8 - propH / 2) : height * 0.86 - propH / 2;
    const cy = height / 2 - centreFromTop, bottom = cy - propH / 2;
    const tagW = Math.round(font * (ISLAND_PROPS.buttons[role].label.length + 1.5));
    const tagY = bottom - 6 - tagH / 2;
    const top = cy + propH / 2, low = tagY - tagH / 2, w = Math.max(propH * 1.15, tagW + 8, 64);
    return { role, prop: { x: cx, bottom, height: propH }, tag: { x: cx, y: tagY, width: tagW, height: tagH, fontSize: font },
      hit: { x: cx, y: (top + low) / 2, width: Math.round(w), height: Math.round(top - low + 4) } };
  });
  return { portrait, slots };
}

/** UI (centre origin, +y up) -> normalised screen (0..1 from the top-left). */
export function uiToScreen(x: number, y: number, width: number, height: number): [number, number] { return [0.5 + x / width, 0.5 - y / height]; }

/** World ray through a normalised screen point for a camera pose (vertical fov). */
export function screenRay(pose: CameraPose, aspect: number, sx: number, sy: number): { origin: V3; dir: V3 } {
  const t = Math.tan(pose.fovVerticalDeg * Math.PI / 360), x = (sx * 2 - 1) * t * aspect, y = (1 - sy * 2) * t;
  const d = rotate(pose.rotation, [x, y, -1]), l = Math.hypot(d[0], d[1], d[2]);
  return { origin: [pose.position[0], pose.position[1], pose.position[2]], dir: [d[0] / l, d[1] / l, d[2] / l] };
}

/** Where a screen prop stands: the sea surface under the screen anchor, scaled to `pixels` tall on a `screenH` screen.
 * Falls back to a fixed 20 m depth when the ray does not reach the sea (e.g. looking above the horizon). */
export function seaAnchor(pose: CameraPose, aspect: number, sx: number, sy: number, pixels: number, screenH: number, modelHeightM: number, seaY = ISLAND_PROPS.seaY) {
  const r = screenRay(pose, aspect, sx, sy);
  let dist = r.dir[1] < -1e-3 ? (seaY - r.origin[1]) / r.dir[1] : NaN;
  const onSea = Number.isFinite(dist) && dist > 1 && dist < 200;
  if (!onSea) dist = 20;
  const point: V3 = [r.origin[0] + r.dir[0] * dist, r.origin[1] + r.dir[1] * dist, r.origin[2] + r.dir[2] * dist];
  const depth = projectPoint(pose, aspect, point).depth;
  const metresPerPixel = 2 * depth * Math.tan(pose.fovVerticalDeg * Math.PI / 360) / screenH;
  let scale = pixels * metresPerPixel / modelHeightM;
  // correct for pitch/perspective: measure the projected height once and rescale (exact to < 1 % for these sizes)
  const q0 = projectPoint(pose, aspect, point), q1 = projectPoint(pose, aspect, [point[0], point[1] + modelHeightM * scale, point[2]]);
  const measured = Math.abs(q1.y - q0.y) / 2 * screenH;
  if (measured > 1e-6 && q1.depth > 0.05) scale *= pixels / measured;
  // face the camera (yaw only; GLB front = +Z)
  const yawDeg = Math.atan2(pose.position[0] - point[0], pose.position[2] - point[2]) * 180 / Math.PI;
  return { point, scale, yawDeg, depth, onSea };
}

export type ScreenPropPose = {
  /** World position of the mesh origin (bottom centre). */
  point: V3;
  /** Pivot scale in camera axes: x/y hold the screen size when fov changes, z holds the view-depth ratio. */
  pivotScale: V3;
  /** Pivot world rotation = the live camera, so the scale axes stay stuck to the lens. */
  pivotRotation: readonly [number, number, number, number];
  /** Mesh rotation inside the pivot, locked to the settled wide shot (upright, yawed toward that lens). */
  localRotation: readonly [number, number, number, number];
  depth: number;
  onSea: boolean;
};
type Q4 = readonly [number, number, number, number];
const quatMul = (a: Q4, b: Q4): [number, number, number, number] => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
};
const quatConj = (q: Q4): [number, number, number, number] => [-q[0], -q[1], -q[2], q[3]];
/** Yaw-only quaternion, same as Node.setRotationFromEuler(0, yawDeg, 0). Local +Z turns toward the camera on the horizontal. */
function yawQuat(pose: CameraPose, point: V3): [number, number, number, number] {
  const yaw = Math.atan2(pose.position[0] - point[0], pose.position[2] - point[2]), h = yaw * 0.5;
  return [0, Math.sin(h), 0, Math.cos(h)];
}
/** How far above the sea a screen prop's lowest corner is kept, so the water plane cannot cover it when the lens drops. */
const SCREEN_PROP_CLEAR_M = 0.015;
type SeaHit = { point: V3; depth: number; onSea: boolean; along: number; origin: V3; dir: V3 };
function seaHit(pose: CameraPose, aspect: number, sx: number, sy: number, seaY: number): SeaHit {
  const r = screenRay(pose, aspect, sx, sy);
  let dist = r.dir[1] < -1e-3 ? (seaY - r.origin[1]) / r.dir[1] : NaN;
  const onSea = Number.isFinite(dist) && dist > 1 && dist < 200;
  if (!onSea) dist = 20;
  const point: V3 = [r.origin[0] + r.dir[0] * dist, r.origin[1] + r.dir[1] * dist, r.origin[2] + r.dir[2] * dist];
  const fwd = rotate(pose.rotation, [0, 0, -1]);
  const along = fwd[0] * r.dir[0] + fwd[1] * r.dir[1] + fwd[2] * r.dir[2];
  return { point, depth: projectPoint(pose, aspect, point).depth, onSea, along: along > 1e-4 ? along : 1, origin: r.origin, dir: r.dir };
}
/**
 * Bag / journal / settings for one frame. The settled `reference` pose (the island wide shot) is the screen
 * they keep: same pixels, same face. A closer lens only changes where that picture sits in the world.
 * Scale is non-uniform in camera space (parent pivot) so a fov change does not resize the picture; the mesh
 * stays a child with the wide shot's upright yaw. The signpost does not use this.
 */
export function screenPropPose(pose: CameraPose, reference: CameraPose, aspect: number, sx: number, sy: number, pixels: number, screenH: number, model: { heightM: number; widthM: number; depthM: number }, seaY = ISLAND_PROPS.seaY): ScreenPropPose {
  const hit = seaHit(pose, aspect, sx, sy, seaY);
  const refA = seaAnchor(reference, aspect, sx, sy, pixels, screenH, model.heightM, seaY);
  const t = Math.tan(pose.fovVerticalDeg * Math.PI / 360), tRef = Math.tan(reference.fovVerticalDeg * Math.PI / 360);
  const refDepth = refA.depth > 0.05 ? refA.depth : 1;
  const localRotation = quatMul(quatConj(reference.rotation), yawQuat(reference, refA.point));
  const pivotRotation = pose.rotation;
  const hx = model.widthM / 2, hz = model.depthM / 2, hy = model.heightM;
  const xs = [-hx, hx], ys = [0, hy], zs = [-hz, hz];
  const camY = pose.position[1];
  let f = 1;
  const sAt = (depth: number) => { const sDepth = refA.scale * (depth / refDepth), sPerp = sDepth * (t / tRef); return { sDepth, sPerp }; };
  for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++) {
    const s = sAt(hit.depth);
    const v1 = rotate(localRotation, [xs[ix], ys[iy], zs[iz]]);
    const v3 = rotate(pivotRotation, [v1[0] * s.sPerp, v1[1] * s.sPerp, v1[2] * s.sDepth]);
    const y = hit.point[1] + v3[1], dy = y - camY;
    if (!(dy < -1e-8)) continue;
    const lim = (seaY + SCREEN_PROP_CLEAR_M - camY) / dy;
    if (lim < f) f = lim;
  }
  if (!(f > 0.25) || f > 1) f = 1;
  const depth = hit.depth * f, dist = depth / hit.along;
  const point: V3 = [hit.origin[0] + hit.dir[0] * dist, hit.origin[1] + hit.dir[1] * dist, hit.origin[2] + hit.dir[2] * dist];
  const s = sAt(depth);
  return { point, pivotScale: [s.sPerp, s.sPerp, s.sDepth], pivotRotation: [pivotRotation[0], pivotRotation[1], pivotRotation[2], pivotRotation[3]], localRotation, depth, onSea: hit.onSea };
}

/** World corners of a prop's local AABB after yaw + uniform scale + translation. */
export function propCorners(p: { position: V3; yawDeg: number; scale: number }, min: V3, max: V3): V3[] {
  const a = p.yawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out: V3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]])
    out.push([p.position[0] + p.scale * (x * c + z * s), p.position[1] + p.scale * y, p.position[2] + p.scale * (-x * s + z * c)]);
  return out;
}

/** UI rect (centre origin, +y up) covering projected world points; null when any point is behind the lens. */
export function projectRectUi(pose: CameraPose, width: number, height: number, points: readonly V3[], minW = 0, minH = 0): Rect | null {
  const aspect = width / height; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) { const q = projectPoint(pose, aspect, p); if (!(q.depth > 0.05)) return null; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const w = Math.max(minW, (x1 - x0) * width / 2), h = Math.max(minH, (y1 - y0) * height / 2);
  return { x: (x0 + x1) / 2 * width / 2, y: (y0 + y1) / 2 * height / 2, width: w, height: h };
}

export type FlatMesh = { positions: number[]; colors: number[]; normals: number[]; indices: number[] };
/** Soft ellipse (alpha 1 at the centre -> 0 at the rim), y = 0, CCW seen from +Y. */
export function softEllipse(cx: number, rx: number, rz: number, seg = 28): FlatMesh {
  const m: FlatMesh = { positions: [cx, 0, 0], colors: [1, 1, 1, 1], normals: [0, 1, 0], indices: [] };
  const rings: [number, number][] = [[0.55, 0.8], [0.8, 0.45], [1, 0]];
  for (const [k, a] of rings) for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; m.positions.push(cx + Math.cos(t) * rx * k, 0, Math.sin(t) * rz * k); m.colors.push(1, 1, 1, a); m.normals.push(0, 1, 0); }
  for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; m.indices.push(0, 1 + j, 1 + i);
    for (let r = 0; r < rings.length - 1; r++) { const a = 1 + r * seg + i, b = 1 + r * seg + j, c = 1 + (r + 1) * seg + j, d = 1 + (r + 1) * seg + i; m.indices.push(a, c, b, a, d, c); } }
  return m;
}
/** Thin soft ellipse ring (alpha 0 -> 1 -> 0 across `band`, as a fraction of the radius). */
export function softRing(cx: number, rx: number, rz: number, band: number, seg = 40): FlatMesh {
  const m: FlatMesh = { positions: [], colors: [], normals: [], indices: [] }, ks: [number, number][] = [[1 - band, 0], [1, 1], [1 + band, 0]];
  for (const [k, a] of ks) for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; m.positions.push(cx + Math.cos(t) * rx * k, 0, Math.sin(t) * rz * k); m.colors.push(1, 1, 1, a); m.normals.push(0, 1, 0); }
  for (let r = 0; r < 2; r++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg, a = r * seg + i, b = r * seg + j, c = (r + 1) * seg + j, d = (r + 1) * seg + i; m.indices.push(a, c, b, a, d, c); }
  return m;
}
/** Ripple animation at time t (s) for ring `k` of 2: scale and alpha factor. Pure (tested); IslandProps applies it. */
export function rippleAt(t: number, k: number): { scale: number; alpha: number } {
  const W = ISLAND_PROPS.signpost.water.ripple, f = (((t / W.periodS + k / 2) % 1) + 1) % 1;
  return { scale: 1 + W.grow * f, alpha: Math.sin(Math.PI * f) };
}

/** Signpost visual rect (projected AABB) in UI units for the current camera (null = not in front of the camera). */
export function signpostRectUi(pose: CameraPose, width: number, height: number): Rect | null {
  const S = ISLAND_PROPS.signpost;
  return projectRectUi(pose, width, height, propCorners(S, S.boxMin, S.boxMax));
}
/** Minimum mainline (signpost) touch target, logical px. */
export const SIGN_HIT_MIN = 88;
/** Mainline hit rect: the visual rect grown to >= SIGN_HIT_MIN per axis. The growth is placed (centred first, then
 * shifted while still covering the whole sign) so it stays inside an 8 px safe inset and off the bottom-row prop hits. */
export function signpostHitUi(pose: CameraPose, width: number, height: number): Rect | null {
  const r = signpostRectUi(pose, width, height); if (!r) return null;
  const w = Math.max(SIGN_HIT_MIN, r.width), h = Math.max(SIGN_HIT_MIN, r.height), ex = (w - r.width) / 2, ey = (h - r.height) / 2;
  const slots = propButtonLayout(width, height).slots.map(s => s.hit), inset = 8;
  const clear = (c: Rect) => c.x - c.width / 2 >= -width / 2 + inset && c.x + c.width / 2 <= width / 2 - inset && c.y - c.height / 2 >= -height / 2 + inset && c.y + c.height / 2 <= height / 2 - inset
    && slots.every(b => !(Math.abs(c.x - b.x) < (c.width + b.width) / 2 && Math.abs(c.y - b.y) < (c.height + b.height) / 2));
  for (const fy of [0, 1, -1]) for (const fx of [0, -1, 1]) { const c = { x: r.x + fx * ex, y: r.y + fy * ey, width: w, height: h }; if (clear(c)) return c; }
  return { x: r.x, y: r.y, width: w, height: h }; // nothing clear: keep centred (tests assert this never happens on supported frames)
}

/* ---------- T9n night look (engine-free) ---------- */
const hexRgba = (h: string): number[] => { const x = h.replace('#', ''); const v = [0, 2, 4, 6].map(i => i < x.length ? parseInt(x.slice(i, i + 2), 16) : 255); return v; };
const toHex = (v: number[], alpha: boolean) => '#' + v.slice(0, alpha ? 4 : 3).map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
/** Linear sRGB-byte mix of two #rrggbb[aa] colours (t clamped to 0..1). */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t)), A = hexRgba(a), B = hexRgba(b), alpha = a.length > 7 || b.length > 7;
  return toHex(A.map((c, i) => c + (B[i] - c) * k), alpha);
}
/** WCAG 2 relative-luminance contrast ratio of two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const L = (h: string) => { const [r, g, bl] = hexRgba(h).map(c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Bottom-row tag colours at night weight w (0 = day, 1 = night). */
export function tagColorsAt(w: number) {
  const T = ISLAND_PROPS.tag;
  return { fill: mixHex(T.fill, T.nightFill, w), edge: mixHex(T.edge, T.nightEdge, w), text: mixHex(T.text, T.nightText, w), shadow: mixHex(T.shadow, T.nightShadow, w) };
}
/** Night weight step: linear approach to target (0/1) over ISLAND_PROPS.nightFadeS; dt clamped like the T2 entrance. */
export function approachNight(current: number, night: boolean, dt: number): number {
  const target = night ? 1 : 0, step = Math.max(0, Math.min(dt, 0.1)) / ISLAND_PROPS.nightFadeS;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}
/** Lamp light state at night weight w: smoothstep so the light eases in/out (no pop at either end). */
export function lampLightAt(w: number): { enabled: boolean; scale: number } {
  const k = Math.max(0, Math.min(1, w)), e = k * k * (3 - 2 * k);
  return { enabled: e > 0, scale: ISLAND_PROPS.signpost.lampLight.luminanceScale * e };
}
/** Shared night weight of the island props (published by IslandProps each frame; read by IslandJourneyOverlay tags). */
let propNight = 0;
export function setPropNightWeight(w: number) { propNight = Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0; }
export function propNightWeight(): number { return propNight; }

/** sRGB hex -> linear multiplier (for the sea tint; Cocos colour uniforms are converted the same way when gamma is on). */
export function srgbToLinear(h: string): [number, number, number] {
  const x = h.replace('#', ''); return [0, 2, 4].map(i => { const v = parseInt(x.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }) as [number, number, number];
}
/** Night sea mainColor at weight w: authored colour (0..255 RGBA) lerped toward authored x tint (sRGB-byte multiply, as Color stores it). */
export function seaColorAt(authored: readonly number[], w: number): number[] {
  const k = Math.max(0, Math.min(1, w)), t = hexRgba(ISLAND_PROPS.seaNight.tint);
  return [0, 1, 2].map(i => Math.round(authored[i] + (authored[i] * t[i] / 255 - authored[i]) * k)).concat([authored[3] ?? 255]);
}
