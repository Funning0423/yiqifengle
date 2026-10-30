/** Board kit (coast pilot, PLAN 20261030-coast-board-pilot, Grok Bot decisions 10/30). Engine-free.
 *  A region kit overrides the piece art (PIECE_KEYS, type 0..5), may hide the 2D tray/tiles and places the board grid from a
 *  projected world-space board. DEFAULT_KIT is the shipped 2D board: every default-path answer equals the pre-kit code
 *  (BoardArt.PIECE_KEYS, ManagedMobileBoardUI.goalArt / cellAt), proven by tools/board-ui/test_board_kit_equivalence.cjs.
 *  The 2D tray fallback is insurance only: every kitFallback() call is counted and any count > 0 FAILs the suite (fallback=0). */
import { PIECE_KEYS } from './BoardArt';
import { cellCenter, type BoardLayout } from './BoardLayout';
export type PieceKeys = readonly [string, string, string, string, string, string];
export type V3 = readonly [number, number, number];
/** Board camera (D2, 运镜bot cine/b20-coast-board-lens; Grok Bot 10/30). The kit NEVER writes the camera: kitBoardPose() only answers the
 *  pose that WorldFlowComponent.setEnterLevelEnd(() => pose) makes the enter-level push-in end on; nothing writes after the reveal.
 *  Look-at point, rotation and vertical FOV are the same on every screen; only the distance back along the view line changes,
 *  from camera_per_aspect ('WxH' → m). */
export interface BoardKitCamera {
  readonly lookAtWorld: V3; readonly quatWorldXYZW: readonly [number, number, number, number]; readonly fovVerticalDeg: number;
  readonly distanceByAspect: Readonly<Record<string, number>>;
  /** true while the per-aspect distances are not signed off (Grok Bot 10/30: being recalculated for top-info-board avoidance) */
  readonly placeholder: boolean; readonly source: string;
}
/** Top info-board avoidance (Grok Bot 10/30): per screen 'WxH', the y range [top, bottom] (pt, y down) the projected board
 *  (rim + pieces) must stay out of = level plate + hint banner from BoardLayout (boardSafeInsets). Gated in P1/P3. */
export type TopNoGo = Readonly<Record<string, readonly [number, number]>>;
function fwd(q: readonly number[]): [number, number, number] {// rotate (0,0,-1) by q (x,y,z,w)
  const [x, y, z, w] = q; return [-(2 * (x * z + w * y)), -(2 * (y * z - w * x)), -(1 - 2 * (x * x + y * y))];
}
function aspectKey(w: number, h: number) { return Math.round(w) + 'x' + Math.round(h); }
export function kitBoardPose(cam: BoardKitCamera, w: number, h: number): { position: [number, number, number]; rotationXYZW: [number, number, number, number]; fovVerticalDeg: number; distanceM: number } {
  const d = cam.distanceByAspect[aspectKey(w, h)]; if (!(d > 0)) throw Error('board kit camera: no distance for ' + aspectKey(w, h));
  const f = fwd(cam.quatWorldXYZW), L = cam.lookAtWorld;
  return { position: [L[0] - f[0] * d, L[1] - f[1] * d, L[2] - f[2] * d], rotationXYZW: [...cam.quatWorldXYZW] as [number, number, number, number], fovVerticalDeg: cam.fovVerticalDeg, distanceM: d };
}
/** World point → screen pt (top-left, y down) for a kit pose; Cocos perspective, vertical FOV axis. null behind the camera. */
export function kitProject(pose: { position: V3; rotationXYZW: readonly number[]; fovVerticalDeg: number }, w: number, h: number, p: V3): { x: number; y: number } | null {
  const [qx, qy, qz, qw] = pose.rotationXYZW, v = [p[0] - pose.position[0], p[1] - pose.position[1], p[2] - pose.position[2]];
  // inverse rotate v by q
  const ix = -qx, iy = -qy, iz = -qz, tx = 2 * (iy * v[2] - iz * v[1]), ty = 2 * (iz * v[0] - ix * v[2]), tz = 2 * (ix * v[1] - iy * v[0]);
  const c = [v[0] + qw * tx + (iy * tz - iz * ty), v[1] + qw * ty + (iz * tx - ix * tz), v[2] + qw * tz + (ix * ty - iy * tx)];
  if (c[2] >= -1e-6) return null; const t = Math.tan(pose.fovVerticalDeg * Math.PI / 360), a = w / h;
  return { x: w / 2 + (c[0] / -c[2]) / (t * a) * w / 2, y: h / 2 - (c[1] / -c[2]) / t * h / 2 };
}
/** Tile centre (index row*7+col) in island world: coast placement world = (pos.x − x, pos.y + y, pos.z − z), x = col−3, z = row−3. */
export function kitTileWorld(kit: RegionBoardKit, index: number): [number, number, number] {
  const b = kit.board; if (!b) throw Error('board kit: no world board'); const x = (index % 7 - 3) * b.cellM, z = (Math.floor(index / 7) - 3) * b.cellM;
  const R = b.yawDeg * Math.PI / 180, c = Math.cos(R), s = Math.sin(R);
  return [b.anchor[0] + c * x + s * z, b.anchor[1] + b.topY, b.anchor[2] - s * x + c * z];
}
export interface RegionBoardKit {
  readonly id: string;
  /** piece art by engine tile type 0..5 */
  readonly pieceKeys: PieceKeys;
  /** asset bundle + dir that hold pieceKeys ('board_art' for the default) */
  readonly pieceBundle: string;
  /** GOAL_ART overrides (type0..5 always follow pieceKeys) */
  readonly goalArt?: Readonly<Record<string, string>>;
  readonly hide2D: { readonly tray: boolean; readonly tiles: boolean };
  /** world-space board (null = the 2D layout grid) */
  readonly board: null | { readonly anchor: readonly [number, number, number]; readonly yawDeg: number; readonly cellM: number; readonly topY: number };
  readonly camera: BoardKitCamera | null;
  readonly topNoGo?: TopNoGo;
}
export const DEFAULT_KIT: RegionBoardKit = Object.freeze({ id: 'default', pieceKeys: PIECE_KEYS as unknown as PieceKeys, pieceBundle: 'board_art', hide2D: Object.freeze({ tray: false, tiles: false }), board: null, camera: null });
/** Coast pilot kit (Grok Bot 10/30: D1 order final, D3 tiles.json adopted, D2 camera configurable). NOT registered in P0 (the coast
 *  region / region_coast bundle are not in this candidate); P1 registers it. Camera per-aspect distances are a PLACEHOLDER copy of
 *  team/cinematic/outbox/20261030-coast-board-lens/tiles.json camera_per_aspect (being recalculated; cine/b20-coast-board-lens NOT merged). */
export const COAST_KIT: RegionBoardKit = Object.freeze({
  id: 'coast', pieceBundle: 'region_coast',
  pieceKeys: ['conch', 'star', 'coral', 'float', 'scallop', 'badge'].map(n => 'board/piece_' + n) as unknown as PieceKeys,
  hide2D: Object.freeze({ tray: true, tiles: true }),
  board: Object.freeze({ anchor: [-0.6, -0.845, 21.5] as const, yawDeg: 180, cellM: 1, topY: 0.12 /* slab top at the centre (tiles.json slab_top_y_centre_note); the projected centres use it */ }),
  camera: Object.freeze({ lookAtWorld: [-0.6, -0.845, 21.55] as const, quatWorldXYZW: [0, 0.851965, 0.523599, 0] as const, fovVerticalDeg: 50,
    distanceByAspect: Object.freeze({ '390x844': 23.306, '414x896': 23.307, '360x780': 23.332, '375x667': 19.424, '320x568': 19.387, '390x520': 18.1335, '768x1024': 18.1335 }),
    placeholder: true, source: 'tiles.json camera_per_aspect 2026-10-30 unsigned (运镜bot, recalculating for top info-board avoidance)' }),
  topNoGo: Object.freeze({ '390x844': [0, 200] as const, '414x896': [0, 201.7] as const, '360x780': [0, 199.1] as const, '375x667': [0, 194] as const, '320x568': [0, 194] as const, '390x520': [0, 171.7] as const, '768x1024': [0, 208.4] as const }),
});
const KITS = new Map<string, RegionBoardKit>();
/** Register a region kit (P1: coast). Registration only; nothing ships one in P0. */
export function registerBoardKit(region: string, kit: RegionBoardKit): void {
  if (!region || region === 'default') throw Error('board kit: region id required');
  if (!kit || !Array.isArray(kit.pieceKeys) || kit.pieceKeys.length !== 6 || kit.pieceKeys.some(k => typeof k !== 'string' || !k)) throw Error('board kit: 6 piece keys (type 0..5) required');
  KITS.set(region, kit);
}
export function unregisterBoardKit(region: string): void { KITS.delete(region); }
/** Kit for a board chapter / region id ('' = mainline island). Unknown or unconverted regions get DEFAULT_KIT. */
export function boardKitFor(region: string | null | undefined): RegionBoardKit { return (region && KITS.get(region)) || DEFAULT_KIT; }
export function kitPieceKey(kit: RegionBoardKit, type: number): string { return kit.pieceKeys[type]; }
/** Same contract as ManagedMobileBoardUI.goalArt: type0..5 → piece art, otherwise the goal table (kit override first). */
export function kitGoalArt(kit: RegionBoardKit, key: string, base: Readonly<Record<string, string>>): string {
  return /^type[0-5]$/.test(key) ? kit.pieceKeys[Number(key.slice(4))] : (kit.goalArt && kit.goalArt[key]) || base[key] || 'board/piece_flower';
}
/** Screen grid the board is drawn and hit-tested on (top-left pt, y down). */
export interface KitGrid { readonly centers: ReadonlyArray<{ x: number; y: number }>; readonly pitch: number; readonly projected: boolean }
/** Default kit: the 2D layout grid, exactly cellCenter(). */
export function kitGrid(kit: RegionBoardKit, layout: BoardLayout): KitGrid {
  if (kit.board) { kitFallback('projection-not-implemented:' + kit.id); }
  const centers: { x: number; y: number }[] = []; for (let i = 0; i < 49; i++) centers.push(cellCenter(layout, i));
  return { centers, pitch: layout.pitch, projected: false };
}
/** Cell under a top-left pt. Default grid: same answer as ManagedMobileBoardUI.cellAt (round to the nearest square, |d| < 3.5 cells).
 *  Projected grids (P1) resolve overlapping tap areas to the nearest projected centre. */
export function kitCellAt(grid: KitGrid, x: number, y: number): number {
  if (!grid.projected) {
    const c = grid.centers[24], lx = x - c.x, ly = c.y - y, P = grid.pitch;
    const col = Math.round(lx / P) + 3, row = 3 - Math.round(ly / P);
    if (Math.abs(lx) >= P * 3.5 || Math.abs(ly) >= P * 3.5 || col < 0 || col > 6 || row < 0 || row > 6) return -1; return row * 7 + col;
  }
  let best = -1, bd = Infinity; for (let i = 0; i < grid.centers.length; i++) { const d = Math.hypot(grid.centers[i].x - x, grid.centers[i].y - y); if (d < bd) { bd = d; best = i; } }
  return best;
}
/** Fallback to the original 2D tray: logged and counted. The suite FAILs any test that prints the marker (fallback=0). */
export const KIT_FALLBACK_MARKER = '[QF_BOARD_KIT] fallback';
export function kitFallback(reason: string): void {
  const g = globalThis as any; const s = g.__qfBoardKitFallback || (g.__qfBoardKitFallback = { count: 0, reasons: [] as string[] });
  s.count++; s.reasons.push(reason);
  try { console.warn(KIT_FALLBACK_MARKER + ' ' + JSON.stringify({ reason, count: s.count })); } catch { /* console gone */ }
}
export function kitFallbackCount(): number { const s = (globalThis as any).__qfBoardKitFallback; return s ? s.count : 0; }
