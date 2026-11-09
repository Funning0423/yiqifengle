/** In-scene coast pieces (coast pilot P1, decision 1): 2D sprites placed on the projected slabs so they read as scene objects —
 *  perspective size per tile (far row smaller), a contact shadow (foreshortened ellipse on the slab top, drawn with Graphics, no new
 *  asset) and the slabs' lighting tint. Read-only on the camera: it only consumes BoardProjection numbers. Not used by the default
 *  board; ManagedMobileBoardUI is unchanged. Only built while the coast config is on (BoardProjection.setCoastBoardKit). */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Graphics, Color, assetManager, director, Material } from 'cc';
import { boardKitFor, type RegionBoardKit } from './BoardKit';
import { coastBoardKitFromFlag, coastBoardSurfaceY, kitPiecePlacement, projectedGrid } from './BoardProjection';
import { ISLAND_PROPS } from '../world-r2/IslandPropsLayout';
import type { LevelBackgroundFactory } from '../world-r2/LevelBackground';
import { qaSkipAllowed } from '../world-r2/QaSkip';
import { COAST_REUSE_SOURCES } from './CoastSceneLayout';
import { coastIslandMaterial, loadCoastScene } from './CoastSceneLoader';
const { ccclass } = _decorator;
@ccclass('CoastBoardPieces')
export class CoastBoardPieces extends Component {
  private pieces: Node[] = []; private shadows: Node[] = [];
  /** Lay out 49 pieces for `types` (engine tile type 0..5 or -1 = empty). Returns false (nothing drawn) when the coast config is off
   *  or the projection is invalid; the caller then keeps the 2D board (BoardKit.kitGrid counts that fallback). */
  layoutPieces(w: number, h: number, types: ReadonlyArray<number>, frames: ReadonlyArray<SpriteFrame | null>, kit: RegionBoardKit = boardKitFor('coast')): boolean {
    if (!kit.board || !kit.camera || !projectedGrid(kit, w, h)) {
      if (kit.id === 'coast' && kit.board) { try { console.error('[QF_COAST] ' + JSON.stringify({ event: 'piece-layout-rejected' })); } catch { /* console gone */ } }
      return false;
    }
    // all shadows first (under every piece), then pieces far row → near row so nearer pieces overlap farther ones
    if (!this.shadows.length) { for (let i = 0; i < 49; i++) this.shadows[i] = this.child('shadow' + i); for (let i = 0; i < 49; i++) this.pieces[i] = this.child('piece' + i); }
    for (let i = 0; i < 49; i++) {
      const p = kitPiecePlacement(kit, w, h, i), t = types[i], f = t >= 0 ? frames[t] : null;
      const sh = this.shadows[i], pc = this.pieces[i];
      sh.setPosition(p.x - w / 2, h / 2 - p.y, 0); const g = sh.getComponent(Graphics) || sh.addComponent(Graphics); g.clear();
      const c = new Color(p.shadow.color); c.a = Math.round(255 * p.shadow.opacity); g.fillColor = c; g.ellipse(0, 0, p.shadow.w / 2, p.shadow.h / 2); g.fill();
      sh.active = !!f;
      const ut = pc.getComponent(UITransform) || pc.addComponent(UITransform), sp = pc.getComponent(Sprite) || pc.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.spriteFrame = f; sp.color = new Color(p.tint);
      ut.setAnchorPoint(0.5, p.anchorY); ut.setContentSize(p.width, p.width); pc.setPosition(p.x - w / 2, h / 2 - p.y, 0); pc.active = !!f;
    }
    return true;
  }
  private child(name: string): Node { const n = new Node(name); n.layer = this.node.layer; n.addComponent(UITransform); this.node.addChild(n); return n; }
}
/** Newest known resource tree is f9c5656a (ancestor bake 8a279bb4). It is not in this candidate.
 *  41947e21 is an older bundle and is not a budget measurement. Both kit states log a missing bundle; kit off still uses the 2D tray. */
export const COAST_RESOURCE_COMMIT = 'f9c5656a46fcb436100920092ea8caf0595b1b60';
export const COAST_REUSE_BAKE = '8a279bb4ab4cda0df08ebc0fb0068ccc2dbea29b';
export const COAST_META_PENDING = [
  'board/piece_badge.png.meta', 'board/piece_conch.png.meta', 'board/piece_coral.png.meta', 'board/piece_float.png.meta', 'board/piece_scallop.png.meta', 'board/piece_star.png.meta',
  'data/coast_layout.json.meta',
  'models/coast_board.glb.meta', 'models/coast_props.glb.meta', 'models/coast_reuse.glb.meta', 'models/coast_rocks.glb.meta', 'models/coast_terrain.glb.meta',
  'textures/coast_palette_256.png.meta', 'textures/coast_palette_sand_256.png.meta',
] as const;
export const COAST_PALETTE_UUID = ISLAND_PROPS.paletteMaterialUuid;
export const COAST_PALETTE_NAME = ISLAND_PROPS.paletteMaterialName;
/** Live island palm with the contract source name, or null. Baked reuse and ordinary meshes are not resolved here. */
export function coastReuseFrom(root: Node | null, mesh: string): Node | null {
  const src = COAST_REUSE_SOURCES[mesh]; if (!root || !src || src.from !== 'island') return null;
  const walk = (n: Node): Node | null => { if (n.name === src.src) return n; for (const c of n.children) { const h = walk(c); if (h) return h; } return null; };
  return walk(root);
}
export function loadSharedPalette(): Promise<Material | null> {
  return new Promise((ok) => {
    try {
      assetManager.loadAny({ uuid: COAST_PALETTE_UUID }, (e: Error | null, m: Material) => {
        if (e || !m) { reportCoastResourceGap(true, 'material unavailable: ' + COAST_PALETTE_NAME + ' ' + COAST_PALETTE_UUID + ' ' + String(e?.message || e || 'no material')); ok(null); return; }
        if (m.name && m.name !== COAST_PALETTE_NAME) reportCoastResourceGap(true, 'palette name ' + m.name + ' != ' + COAST_PALETTE_NAME);
        ok(m);
      });
    } catch (e) { reportCoastResourceGap(true, 'material unavailable: ' + String((e as Error)?.message || e)); ok(null); }
  });
}
export function reportCoastResourceGap(kitOn: boolean, error: string): void {
  try { console.error('[QF_COAST] ' + JSON.stringify({ event: 'scene-mesh-missing', kitOn, engineLoaded: false, engineEvidence: 'unavailable', metaPending: COAST_META_PENDING.length, missing: 'creator-build-project/assets/bundles/region_coast', newestResourceCommit: COAST_RESOURCE_COMMIT, reuseBake: COAST_REUSE_BAKE, error })); } catch { /* console gone */ }
}
export class CoastEntryRejected extends Error {
  readonly reason: string;
  readonly detail: string;
  constructor(reason: string, detail: string) { super(reason); this.name = 'CoastEntryRejected'; this.reason = reason; this.detail = detail; }
}
/** Origin and release only. A mainline star and a book button are not gates. Formal release never probes. */
export function decideCoastEntry(input: { origin: string; formalRelease: boolean; stageId: string }): { probe: boolean; allowStart: false; reason: string; detail: string } {
  if (input.stageId !== 'r06-coast-01') return { probe: false, allowStart: false, reason: 'not-coast01', detail: input.stageId || '' };
  if (input.formalRelease) return { probe: false, allowStart: false, reason: 'formal-release-unreachable', detail: 'coast entry is not a formal release path' };
  const origin = input.origin || '';
  if (origin !== 'island' && origin !== 'home') return { probe: false, allowStart: false, reason: 'return-route-not-yet-available', detail: 'selectionRegion classifies r06-coast-01 as island; no coast route from ' + origin };
  return { probe: true, allowStart: false, reason: 'await-resource-gate', detail: 'typed asset classes are not runtime evidence' };
}
export type CoastMountReport = { typesAccepted: boolean; engineEvidence: string; runtimeReady: boolean; dispose?: () => void };
/**
 * Resource gate in front of any provider. allowStart stays false: contract classes are not a Creator frame,
 * and engineEvidence from the loader is unavailable. Failure does not call startProvider.
 */
export async function orchestrateCoastEntry(input: {
  origin: string; formalRelease: boolean; stageId: string;
  saveBytes: () => string;
  mount: () => Promise<CoastMountReport>;
  startProvider: () => void;
}): Promise<{ ok: false; reason: string; started: false; runtimeEvidence: 'unavailable' }> {
  const before = input.saveBytes();
  const reject = (reason: string) => {
    if (input.saveBytes() !== before) throw new CoastEntryRejected('save-mutated', 'coast entry changed player save bytes');
    return { ok: false as const, reason, started: false as const, runtimeEvidence: 'unavailable' as const };
  };
  const decision = decideCoastEntry(input);
  if (!decision.probe) return reject(decision.reason);
  let mounted: CoastMountReport | null = null;
  try { mounted = await input.mount(); } catch (e) {
    if (mounted && mounted.dispose) mounted.dispose();
    const reason = e instanceof CoastEntryRejected ? e.reason : 'coast-resources-unavailable';
    return reject(reason);
  }
  if (mounted && mounted.dispose) mounted.dispose();
  if (!mounted || !mounted.typesAccepted) return reject('coast-contract-not-accepted');
  if (mounted.runtimeReady || mounted.engineEvidence !== 'unavailable') return reject('coast-runtime-evidence-untrusted');
  if (!decision.allowStart) return reject(decision.reason);
  input.startProvider();
  return reject('coast-runtime-evidence-unavailable');
}
/** Fail closed. A missing bundle, asset, or material does not become a projected coast board. */
export const createCoastBoardBackground: LevelBackgroundFactory = async (ctx) => {
  const on = coastBoardKitFromFlag();
  if (!on) { reportCoastResourceGap(false, 'kit-off: coast scene not mounted'); throw new CoastEntryRejected('coast-kit-off', 'coast kit is off; island picture is not a coast scene'); }
  const scene = director.getScene();
  for (const mesh of ['reuse_palm_tall', 'reuse_palm_lean']) if (!coastReuseFrom(scene, mesh)) reportCoastResourceGap(true, 'reuse unresolved: ' + mesh + ' -> ' + COAST_REUSE_SOURCES[mesh].src);
  const palette = await loadSharedPalette();
  if (ctx.token.cancelled) throw new CoastEntryRejected('coast-load-cancelled', 'cancelled before coast scene load');
  const handle = await loadCoastScene(ctx.parent, {
    resolveReuse: (name) => coastReuseFrom(scene, name),
    resolveMaterial: (key) => {
      const shared = coastIslandMaterial(scene, COAST_PALETTE_NAME) || palette;
      if (!shared) { reportCoastResourceGap(true, 'material unavailable for ' + key.mesh + ' alpha=' + key.alpha + ' emit=' + key.emit); return null; }
      return shared;
    },
    cancelled: () => !!ctx.token.cancelled,
  });
  if (ctx.token.cancelled) { if (handle) handle.dispose(); throw new CoastEntryRejected('coast-load-cancelled', 'cancelled during coast scene load'); }
  if (!handle) throw new CoastEntryRejected('coast-resources-unavailable', 'region_coast bundle, layout, models, or material did not mount');
  if (!handle.typesAccepted || handle.engineEvidence !== 'unavailable') { handle.dispose(); throw new CoastEntryRejected(handle.typesAccepted ? 'coast-runtime-evidence-untrusted' : 'coast-contract-not-accepted', 'typed assets are not a Creator load'); }
  handle.dispose();
  throw new CoastEntryRejected('coast-runtime-evidence-unavailable', 'contract classes mounted; Creator runtime evidence is unavailable');
};
/** Stage identity used by the dev teleport. Not a journey region and not an island alias. */
export function coastRegionIdentity(stageId: string): 'coast' | null {
  return stageId === 'r06-coast-01' ? 'coast' : null;
}
export type CoastDevOrigin = 'island' | 'meadow' | 'skycity' | 'lakeside';
/*QF_TRIAL_BEGIN*/
/**
 * Isolated developer teleport. It does not travel, stamp, or open a formal route.
 * Production port stays closed. A labeled mock port is the only surface that may enter,
 * and only when the test-package gate allows it.
 * One world has one in-flight dev session. An overlap is rejected before it takes a
 * generation, restores, or releases. The owner keeps that session through enter, play,
 * and exit; finally restores a failed entry and releases only this request, including
 * when exitLevel fails. WorldFlow's own cancellation path is unchanged.
 */
const coastDevWorldGeneration = new WeakMap<object, { generation: number; inflight: boolean }>();
export function coastDevOwnership(world: object): { generation: number; inflight: boolean } {
  const slot = coastDevWorldGeneration.get(world);
  return { generation: slot?.generation ?? 0, inflight: !!slot?.inflight };
}
export async function coastDevTeleport(input: {
  origin: CoastDevOrigin;
  formalRelease: boolean;
  host?: object;
  port: 'labeled-mock' | 'production';
  flow: { state: string; stable: string; enterLevel(id: string): Promise<{ ok: boolean; reason?: string }>; exitLevel(): { ok: boolean; reason?: string }; snapshot(): { state: string; stable: string; error?: string | null } };
  world: { camera(): { position: readonly number[]; fovVerticalDeg: number }; setCamera(pose: { position: readonly number[]; fovVerticalDeg: number }): void; cancelTransient(): void; setDoor(v: number): void; setLayers(v: string): void; assertStaticWorld(): void };
  door: number;
  layers: string;
  release?: () => void;
  play?: () => Promise<void>;
}): Promise<{ ok: true; origin: CoastDevOrigin; returned: string; port: 'labeled-mock'; engineLoaded: false } | { ok: false; reason: string; origin: CoastDevOrigin; restored: boolean }> {
  const origin = input.origin;
  if (input.formalRelease || !qaSkipAllowed(input.host)) return { ok: false, reason: 'formal-release-unreachable', origin, restored: false };
  if (input.port !== 'labeled-mock') return { ok: false, reason: 'production-entry-closed', origin, restored: false };
  const slot = coastDevWorldGeneration.get(input.world) ?? { generation: 0, inflight: false };
  coastDevWorldGeneration.set(input.world, slot);
  if (slot.inflight) return { ok: false, reason: 'dev-world-busy', origin, restored: false };
  if (input.flow.state !== origin) return { ok: false, reason: 'dev-teleport-requires-current-region', origin, restored: false };
  slot.inflight = true;
  const generation = ++slot.generation;
  const shot = input.world.camera();
  let released = false;
  let outcome: { ok: true; origin: CoastDevOrigin; returned: string; port: 'labeled-mock'; engineLoaded: false } | { ok: false; reason: string; origin: CoastDevOrigin; restored: boolean } | null = null;
  const atOrigin = () => input.flow.snapshot().state === origin && input.flow.snapshot().stable === origin;
  const owns = () => slot.generation === generation && slot.inflight;
  try {
    const entered = await input.flow.enterLevel('r06-coast-01');
    if (!entered.ok) return outcome = { ok: false, reason: entered.reason || 'enter-failed', origin, restored: false };
    if (input.play) await input.play();
    const left = input.flow.exitLevel();
    if (!left.ok) return outcome = { ok: false, reason: left.reason || 'exit-failed', origin, restored: false };
    return outcome = { ok: true, origin, returned: input.flow.snapshot().stable, port: 'labeled-mock', engineLoaded: false };
  } catch {
    return outcome = { ok: false, reason: 'caller-error', origin, restored: false };
  } finally {
    if (owns()) {
      try {
        if (!atOrigin()) {
          input.flow.state = origin;
          input.flow.stable = origin;
          input.world.cancelTransient();
          input.world.setCamera(shot);
          input.world.setDoor(input.door);
          input.world.setLayers(input.layers);
          input.world.assertStaticWorld();
        }
        if (!released) { released = true; input.release?.(); }
        if (outcome && outcome.ok === false) outcome.restored = atOrigin();
      } finally {
        if (slot.generation === generation) slot.inflight = false;
      }
    }
  }
}
/*QF_TRIAL_END*/
