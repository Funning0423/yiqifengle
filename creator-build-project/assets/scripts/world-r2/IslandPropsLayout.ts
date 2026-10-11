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
 * Screen props (bag / journal / settings): stand on the sea surface at a fixed SCREEN anchor (bottom row) for
 *   the current camera, so the row follows portrait/landscape without moving any world art. Their hit areas are
 *   the existing IslandJourneyOverlay buttons (same handlers).
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
    prefab: 'ui_signpost', position: [-0.62, -1.05, 18.6] as V3, yawDeg: -16, scale: 1.7,
    lampNode: 'lamp_glass', lampDayMaterial: 'M_signpost_lamp',
    /** Local AABB of the GLB (origin = bottom centre, front = +Z). */
    boxMin: [-1.235, 0, -0.183] as V3, boxMax: [1.235, 1.875, 0.183] as V3,
    /** props_info.json text_quad_local (Blender) -> Cocos local: (x, z, -y). Panel front face. */
    text: { center: [0.2355, 0.98, 0.19] as V3, widthM: 1.44, heightM: 0.48, string: '继续旅程', color: '#633f21' },
  },
  palms: [
    { prefab: 'beach_palm_tall', position: [-0.5, -0.30, 9.0] as V3, yawDeg: 200, scale: 0.9 },
    { prefab: 'beach_palm_short', position: [7.0, -0.36, 7.4] as V3, yawDeg: 180, scale: 1 },
  ] as readonly WorldProp[],
  buttons: {
    bag: { prefab: 'ui_satchel', label: '行囊', heightM: 0.915, widthM: 0.86 },
    journal: { prefab: 'ui_notebook', label: '旅程册', heightM: 0.89, widthM: 0.665 },
    settings: { prefab: 'ui_compass', label: '设置', heightM: 1.051, widthM: 0.84 },
  } as Readonly<Record<PropRole, Readonly<{ prefab: string; label: string; heightM: number; widthM: number }>>>,
  /** Cream rounded tag under each screen prop (mockup.py tag(): palette plaster / wood / dark wood). */
  tag: { fill: '#f8f2e2', edge: '#956737', text: '#633f21', shadow: '#14323c5a' },
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

/** Signpost hit rect in UI units for the current camera (null = not in front of the camera). */
export function signpostRectUi(pose: CameraPose, width: number, height: number): Rect | null {
  const S = ISLAND_PROPS.signpost;
  return projectRectUi(pose, width, height, propCorners(S, S.boxMin, S.boxMax), 64, 48);
}
