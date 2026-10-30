/** Board kit (coast pilot, PLAN 20261030-coast-board-pilot, Grok Bot decisions 10/30). Engine-free.
 *  A region kit overrides the piece art (PIECE_KEYS, type 0..5), may hide the 2D tray/tiles and places the board grid from a
 *  projected world-space board. DEFAULT_KIT is the shipped 2D board: every default-path answer equals the pre-kit code
 *  (BoardArt.PIECE_KEYS, ManagedMobileBoardUI.goalArt / cellAt), proven by tools/board-ui/test_board_kit_equivalence.cjs.
 *  The 2D tray fallback is insurance only: every kitFallback() call is counted and any count > 0 FAILs the suite (fallback=0). */
import { PIECE_KEYS } from './BoardArt';
import { cellCenter, type BoardLayout } from './BoardLayout';
export type PieceKeys = readonly [string, string, string, string, string, string];
/** Board camera (D2, 运镜bot = the coast push-in end pose). Pitch, yaw and FOV are FIXED for every screen; only the distance along the
 *  view line may differ per aspect ratio (distanceByAspect: 'W:H' → m along the view line; missing = refDistanceM). Never a per-screen pitch or FOV. */
export interface BoardKitCamera { readonly target: readonly [number, number, number]; readonly yawDeg: number; readonly pitchDeg: number; readonly fovVerticalDeg: number;
  /** reference pose = r5d: camera at refDistanceM from target along (yaw, pitch), looking at target + (0,0,lookShiftM) */
  readonly refDistanceM: number; readonly lookShiftM: number;
  /** distance from the look point ALONG the fixed reference view line, by 'W:H'; missing = the reference distance */
  readonly distanceByAspect: Readonly<Record<string, number>> }
/** Pitch, yaw, view direction and FOV are identical on every screen; only the distance along the view line changes (D2, 运镜bot). */
export function kitCameraPose(cam: BoardKitCamera, w: number, h: number): { position: [number, number, number]; target: [number, number, number]; fovVerticalDeg: number } {
  const R = Math.PI / 180, p = cam.pitchDeg * R, y = cam.yawDeg * R, t = cam.target, look: [number, number, number] = [t[0], t[1], t[2] + cam.lookShiftM];
  const ref = [t[0] + Math.sin(y) * Math.cos(p) * cam.refDistanceM, t[1] + Math.sin(p) * cam.refDistanceM, t[2] + Math.cos(y) * Math.cos(p) * cam.refDistanceM];
  const v = [ref[0] - look[0], ref[1] - look[1], ref[2] - look[2]], D0 = Math.hypot(v[0], v[1], v[2]), d = cam.distanceByAspect[w + ':' + h] ?? D0;
  if (!(d > 0)) throw Error('board kit camera: distance must be > 0');
  return { position: [look[0] + v[0] / D0 * d, look[1] + v[1] / D0 * d, look[2] + v[2] / D0 * d], target: look, fovVerticalDeg: cam.fovVerticalDeg };
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
}
export const DEFAULT_KIT: RegionBoardKit = Object.freeze({ id: 'default', pieceKeys: PIECE_KEYS as unknown as PieceKeys, pieceBundle: 'board_art', hide2D: Object.freeze({ tray: false, tiles: false }), board: null, camera: null });
/** Coast pilot kit (Grok Bot 10/30: D1 order final, D3 tiles.json adopted, D2 configurable). NOT registered in P0 (the coast region
 *  and region_coast bundle are not in this candidate); P1 registers it. Values = r5d coastshot 'game' camera (board-local frame). */
export const COAST_KIT: RegionBoardKit = Object.freeze({
  id: 'coast', pieceBundle: 'region_coast',
  pieceKeys: ['conch', 'star', 'coral', 'float', 'scallop', 'badge'].map(n => 'board/piece_' + n) as unknown as PieceKeys,
  hide2D: Object.freeze({ tray: true, tiles: true }),
  board: Object.freeze({ anchor: [0, 0, 0] as const, yawDeg: 0, cellM: 1, topY: 0.16 }),
  camera: Object.freeze({ target: [0, 0, 0.25] as const, yawDeg: 0, pitchDeg: 64, fovVerticalDeg: 50, refDistanceM: 18, lookShiftM: -0.3, distanceByAspect: Object.freeze({}) }),
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
