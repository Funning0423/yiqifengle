/** Board projection (coast pilot P1, PLAN 20261030-coast-board-pilot §2.2–2.3, Grok Bot decisions 10/30 + P1 notes). Engine-free.
 *  Projects a kit's world board through the kit camera (BoardKit.kitBoardPose / kitProject; read-only, never writes the camera) and answers:
 *  - the projected grid (centres, quads) the pieces are placed on and hit-tested against (nearest projected centre, 44 pt tap boxes);
 *  - the in-scene piece placement (perspective scale, contact shadow, the slabs' lighting tint);
 *  - the HUD no-go limits of the active HUD variant (data in the kit, never hard-coded here);
 *  - the edge rule (every playable tile ≥ 8 pt from all four screen edges; the stone rim may bleed off left/right only,
 *    symmetrically, on its straight sides, clear of the HUD) and the tap areas (real effective size per tile). */
import { COAST_KIT, kitBoardPose, kitProject, registerBoardKit, setProjectedHitHook, setProjectGridHook, unregisterBoardKit, type KitGrid, type RegionBoardKit, type V3 } from './BoardKit';
export type Pt = { x: number; y: number };
export interface HudLimits { readonly variant: string; readonly pending: boolean; readonly top: number; readonly bottom: number }
/** HUD variant for a screen: the kit's `hud.select` (default 'normal'); a variant only applies where its trigger holds. */
export function kitHudLimits(kit: RegionBoardKit, w: number, h: number, choose?: string): HudLimits {
  const hud = kit.hud; if (!hud) throw Error('board kit: no HUD variants');
  const key = Math.round(w) + 'x' + Math.round(h), want = choose || hud.select || 'normal';
  const v = hud.variants[want], ok = v && v.screens[key] && (!v.trigger || ((!v.trigger.portrait || w < h * 1.1) && h <= v.trigger.maxHeight));
  const use = ok ? want : 'normal', s = hud.variants[use].screens[key]; if (!s) throw Error('board kit: no HUD limits for ' + key);
  return { variant: use, pending: !!hud.variants[use].pending, top: s[0], bottom: s[1] };
}
/** World point of board-local (x right, y up, z toward the near row) metres. */
export function kitLocalWorld(kit: RegionBoardKit, lx: number, ly: number, lz: number): [number, number, number] {
  const b = kit.board!; const R = b.yawDeg * Math.PI / 180, c = Math.cos(R), s = Math.sin(R);
  return [b.anchor[0] + c * lx + s * lz, b.anchor[1] + ly, b.anchor[2] - s * lx + c * lz];
}
export interface ProjectedBoard {
  readonly w: number; readonly h: number; readonly distanceM: number;
  readonly centers: Pt[]; /** per tile [far-left, far-right, near-right, near-left] corners of the playable cell (±0.5 m) */ readonly quads: Pt[][];
  /** rim outer outline (rounded rectangle, 3.95 m) and whether each sample sits on a straight side */ readonly rim: Array<Pt & { straight: boolean }>;
}
const RIM = { outerHalf: 3.95, outerCorner: 0.55 + (3.95 - 3.72), topY: 0.15 };
export function projectBoard(kit: RegionBoardKit, w: number, h: number, opts?: { distanceM?: number; lookAtOffsetM?: number }): ProjectedBoard | null {
  if (!kit.board || !kit.camera) return null;
  const pose = kitBoardPose(kit.camera, w, h, opts); const P = (l: V3) => kitProject(pose, w, h, kitLocalWorld(kit, l[0], l[1], l[2]));
  const top = kit.board.topY, centers: Pt[] = [], quads: Pt[][] = [];
  for (let i = 0; i < 49; i++) { const x = i % 7 - 3, z = Math.floor(i / 7) - 3, c = P([x, top, z]); if (!c) return null; centers.push(c);
    const q = [P([x - .5, top, z - .5]), P([x + .5, top, z - .5]), P([x + .5, top, z + .5]), P([x - .5, top, z + .5])]; if (q.some(p => !p)) return null; quads.push(q as Pt[]); }
  const rim: Array<Pt & { straight: boolean }> = [], H = RIM.outerHalf, r = RIM.outerCorner, n = 24;
  const push = (lx: number, lz: number, straight: boolean) => { const p = P([lx, RIM.topY, lz]); if (p) rim.push({ ...p, straight }); };
  for (let k = 0; k <= 80; k++) { const t = -H + r + (2 * (H - r)) * k / 80; push(-H, t, true); push(H, t, true); push(t, -H, true); push(t, H, true); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let k = 0; k <= n; k++) { const a = k / n * Math.PI / 2; push(sx * (H - r + r * Math.cos(a)), sz * (H - r + r * Math.sin(a)), false); }
  return { w, h, distanceM: pose.distanceM, centers, quads, rim };
}
/** Tap box half-size (pt): every tile gets at least a 44×44 pt box around its projected centre; overlaps resolve to the nearest centre. */
export const TAP_HALF = 22;
function inQuad(q: Pt[], x: number, y: number) { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); if (c !== 0) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; }
/** Projected hit test: nearest projected centre, accepted inside that tile's quad or its 44 pt box; otherwise -1 (off the board). */
export function projectedCellAt(b: { centers: ReadonlyArray<Pt>; quads?: ReadonlyArray<ReadonlyArray<Pt>> }, x: number, y: number): number {
  let best = -1, bd = Infinity; for (let i = 0; i < b.centers.length; i++) { const d = Math.hypot(b.centers[i].x - x, b.centers[i].y - y); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return -1; const c = b.centers[best];
  if (Math.abs(x - c.x) <= TAP_HALF && Math.abs(y - c.y) <= TAP_HALF) return best;
  return b.quads && inQuad(b.quads[best] as Pt[], x, y) ? best : -1;
}
/** Real effective tap size of a tile (pt): nearest-centre resolution means the tile owns up to the half-way line to each neighbour,
 *  capped by its 44 pt box (TAP_HALF each side; also the cap on the outer side of edge tiles). Overlapping boxes are NOT counted as 44. */
export function effectiveTapSize(b: { centers: ReadonlyArray<Pt> }, i: number): { w: number; h: number; short: number } {
  const C = b.centers, c = C[i], col = i % 7, row = Math.floor(i / 7);
  const half = (j: number) => Math.min(TAP_HALF, Math.hypot(C[j].x - c.x, C[j].y - c.y) / 2);
  const w = (col > 0 ? half(i - 1) : TAP_HALF) + (col < 6 ? half(i + 1) : TAP_HALF), h = (row > 0 ? half(i - 7) : TAP_HALF) + (row < 6 ? half(i + 7) : TAP_HALF);
  return { w, h, short: Math.min(w, h) };
}
/** Edge rule (Grok Bot 10/30): tiles ≥ 8 pt from all four edges; rim bleed only left/right, symmetric, straight sides only, clear of
 *  the HUD; rim top ≥ HUD top limit + 8 and rim bottom ≤ HUD bottom limit − 8. Numbers are returned; the caller gates them. */
export const EDGE_MIN_PT = 8, BLEED_ASYM_MAX_PT = 0.5;
export function edgeReport(b: ProjectedBoard, hud: HudLimits) {
  let tileMin = Infinity; for (const q of b.quads) for (const p of q) tileMin = Math.min(tileMin, p.x, b.w - p.x, p.y, b.h - p.y);
  const xs = b.rim.map(p => p.x), ys = b.rim.map(p => p.y), bleedL = Math.max(0, -Math.min(...xs)), bleedR = Math.max(0, Math.max(...xs) - b.w);
  const off = b.rim.filter(p => p.x < 0 || p.x > b.w), cutOnCorner = off.some(p => !p.straight);
  const rimTop = Math.min(...ys), rimBottom = Math.max(...ys), offY = off.length ? [Math.min(...off.map(p => p.y)), Math.max(...off.map(p => p.y))] : null;
  const bleedHitsHud = !!offY && (offY[0] < hud.top + EDGE_MIN_PT || offY[1] > hud.bottom - EDGE_MIN_PT);
  const problems: string[] = [];
  if (tileMin < EDGE_MIN_PT) problems.push(`tile ${tileMin.toFixed(1)} pt from the edge < ${EDGE_MIN_PT}`);
  if (Math.abs(bleedL - bleedR) > BLEED_ASYM_MAX_PT) problems.push(`rim bleed asymmetric L ${bleedL.toFixed(1)} / R ${bleedR.toFixed(1)}`);
  if (cutOnCorner) problems.push('rim cut through a rounded corner');
  if (bleedHitsHud) problems.push('rim bleed reaches the HUD');
  if (rimTop < hud.top + EDGE_MIN_PT) problems.push(`rim top ${rimTop.toFixed(1)} < HUD top limit ${hud.top}+${EDGE_MIN_PT}`);
  if (rimBottom > hud.bottom - EDGE_MIN_PT) problems.push(`rim bottom ${rimBottom.toFixed(1)} > HUD bottom limit ${hud.bottom}−${EDGE_MIN_PT}`);
  if (rimTop < 0 || rimBottom > b.h) problems.push('rim bleeds off top/bottom');
  return { tileMin, bleedL, bleedR, asym: Math.abs(bleedL - bleedR), rimTop, rimBottom, cutOnCorner, bleedHitsHud, problems };
}
/** In-scene piece placement (decision 1: a 2D sprite that reads as a scene object). Anchored at the slab contact point; width =
 *  projected width of `fill` m at that tile (perspective: the far row is smaller); contact shadow = projected 0.62 m disc on the
 *  slab top (foreshortened by the camera pitch); tint = the slabs' lighting (kit.lighting). */
export function kitPiecePlacement(kit: RegionBoardKit, w: number, h: number, i: number, opts?: { distanceM?: number; lookAtOffsetM?: number }) {
  const pose = kitBoardPose(kit.camera!, w, h, opts), top = kit.board!.topY, x = i % 7 - 3, z = Math.floor(i / 7) - 3, L = kit.lighting || DEFAULT_LIGHT;
  const P = (lx: number, lz: number) => kitProject(pose, w, h, kitLocalWorld(kit, lx, top, lz))!;
  const c = P(x, z), f = L.pieceFill, s = L.shadowM / 2, l = P(x - f / 2, z), r = P(x + f / 2, z), sf = P(x, z - s), sn = P(x, z + s), sl = P(x - s, z), sr = P(x + s, z);
  return { x: c.x, y: c.y, width: Math.hypot(r.x - l.x, r.y - l.y), anchorY: L.anchorY, shadow: { w: Math.hypot(sr.x - sl.x, sr.y - sl.y), h: Math.hypot(sn.x - sf.x, sn.y - sf.y), opacity: L.shadowOpacity, color: L.shadowColor }, tint: L.tint };
}
export const DEFAULT_LIGHT = Object.freeze({ pieceFill: 0.75, anchorY: 0.18, shadowM: 0.62, shadowOpacity: 0.3, shadowColor: '#3d4a3a', tint: '#ffffff', source: 'default' });
/** Projected KitGrid for a world-board kit, or null (→ counted fallback) when the projection is invalid: a tile behind the camera or
 *  closer than EDGE_MIN_PT to a screen edge. */
export function projectedGrid(kit: RegionBoardKit, w: number, h: number): KitGrid | null {
  const b = projectBoard(kit, w, h); if (!b) return null;
  for (const q of b.quads) for (const p of q) if (Math.min(p.x, w - p.x, p.y, h - p.y) < EDGE_MIN_PT) return null;
  const ws = b.quads.map(q => Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y)).sort((a, c) => a - c);
  return { centers: b.centers, quads: b.quads, pitch: ws[24], projected: true };
}
setProjectGridHook(projectedGrid); setProjectedHitHook((g, x, y) => projectedCellAt(g, x, y));
/** Coast config switch. OFF by default (Grok Bot 10/30: until P1 is accepted). On = COAST_KIT registered for region 'coast'
 *  (boardKitFor('coast') → projected grid + in-scene pieces); off = unregistered (DEFAULT_KIT everywhere). Test mode: call
 *  coastBoardKitFromFlag() with globalThis.__qfCoastBoardKit === true or a '?qfcoastkit=1' page URL (web-test capture only). */
export function setCoastBoardKit(on: boolean): void { if (on) registerBoardKit('coast', COAST_KIT); else unregisterBoardKit('coast'); }
export function coastBoardKitFromFlag(): boolean {
  const g = globalThis as any; let on = g.__qfCoastBoardKit === true;
  try { if (!on && g.location && typeof g.location.search === 'string') on = /[?&]qfcoastkit=1(&|$)/.test(g.location.search); } catch { /* no location */ }
  setCoastBoardKit(on); return on;
}
