// SceneMusic.ts — Voice bot：按所在场景切 BGM（小岛 / 草原 / 天空之城），只读轮询，不改任何游戏状态。
//   - WorldFlow 在 skycity（天空城参观）            -> 天空之城 BGM（region_skycity 分包）
//   - 地区棋盘 regional-r05，region = 'sky'          -> 天空之城 BGM
//   - 地区棋盘 regional-r05，region = 'meadow'       -> 草原 BGM（region_meadow 分包）
//   - 其他（家里、小岛、潮汐 tide、主线、R4）         -> 小岛 BGM（audio_bgm_island 分包 audio/bgm_main，原默认）
//   - skycity-loading / 进关卡还没找到棋盘等过渡状态：保持当前曲目不动。
// 切换由 GameAudio.setMusic(path, bundle) 负责（正在播时 1.5 s 等功率交叉）。场景曲加载失败（例如分包缺失）时
// 回落到小岛 BGM，同一个场景只回落一次，不来回重试；离开该场景后重置。
// v0.5（包体）：启动时什么音乐都不加载。等房间可操作（roomInteractive()）后才第一次 setMusic，小岛曲带 { fadeIn: true }
// （起播后 1.5 s 淡入）。判定：场景里有 WorldIntegrationBoot 时看 globalThis.__worldLoading.snapshot().phase === 'ready'
// —— 就是加载页隐藏、RoomExploreOverlay 开始接受滑动 / 点门的那一刻（WorldIntegrationBoot.loadWorld 里 loadPhase='ready'）；
// 场景里没有 WorldIntegrationBoot（没有加载页的场景）就直接算可操作。加载页从不等音乐；分包下载失败只记 warn，不重试、不阻塞。
import { _decorator, Component, director, Director, isValid } from 'cc';
import { GameAudio, DEFAULT_BGM_PATH, DEFAULT_BGM_BUNDLE } from './GameAudio';
const { ccclass } = _decorator;

export type SceneTrackId = 'island' | 'meadow' | 'skycity';
export type SceneTrack = { path: string; bundle: string | null };
export const SCENE_TRACKS: Record<SceneTrackId, SceneTrack> = {
  island: { path: DEFAULT_BGM_PATH, bundle: DEFAULT_BGM_BUNDLE },
  meadow: { path: 'audio/bgm_meadow', bundle: 'region_meadow' },
  skycity: { path: 'audio/bgm_skycity', bundle: 'region_skycity' },
};
const POLL_S = 0.25;
const REFIND_S = 1;

/** Pure (tested): room interactive = no world boot in the scene, or its loading gate reports phase 'ready'. */
export function roomInteractiveFrom(hasWorldBoot: boolean, loading: any): boolean {
  if (!hasWorldBoot) return true;
  let snap: any = null;
  try { snap = loading && typeof loading.snapshot === 'function' ? loading.snapshot() : null; } catch (e) { snap = null; }
  return !!snap && snap.phase === 'ready';
}

export type SceneProbe = { state?: string | null; stable?: string | null; boardProvider?: string | null; boardRegion?: string | null; boardPresent?: boolean };
/** Pure mapping (tested). null = transitional: keep whatever is playing. */
export function sceneTrackFor(p: SceneProbe): SceneTrackId | null {
  const state = p.state || '', stable = p.stable || '';
  if (state === 'skycity' || (stable === 'skycity' && state !== 'skycity-loading')) return 'skycity';
  if (state === 'skycity-loading' || state === 'level-loading') return null;
  if (p.boardPresent) {
    if (p.boardProvider === 'regional-r05' || p.boardRegion) {
      if (p.boardRegion === 'meadow') return 'meadow';
      if (p.boardRegion === 'sky') return 'skycity';
    }
    return 'island';
  }
  if (stable === 'level' || state === 'level') return null;   // level entered but board not mounted yet
  return 'island';
}

@ccclass('SceneMusic')
export class SceneMusic extends Component {
  static instance: SceneMusic | null = null;
  private flow: any = null;
  private board: any = null;
  private poll = 0;
  private refindIn = 0;
  private current: SceneTrackId | null = null;
  private fellBack: SceneTrackId | null = null;
  private worldBoot: any = null;
  private worldBootChecked = false;
  /** 第一次真正 setMusic 的时间（GameAudio.now()，null = 还没开始加载音乐） */
  private firstLoadAt: number | null = null;

  static ensure() {
    try {
      const audio = GameAudio.ensure();
      if (!audio.node.getComponent(SceneMusic)) audio.node.addComponent(SceneMusic);
    } catch (e) { console.warn('[SceneMusic] mount failed (silent, gameplay unaffected)', e); }
  }
  onLoad() { SceneMusic.instance = this; }
  onDestroy() { if (SceneMusic.instance === this) SceneMusic.instance = null; this.flow = null; this.board = null; this.worldBoot = null; }

  update(dt: number) {
    this.poll -= dt; if (this.poll > 0) return; this.poll = POLL_S;
    try { this.step(dt); } catch (e) { /* observation only */ }
  }
  /** Current probe of the world (exposed for logs/tests). */
  probe(): SceneProbe {
    this.findFlow();
    let snap: any = null;
    try { snap = this.flow && typeof this.flow.commands === 'function' ? this.flow.commands().snapshot() : null; } catch (e) { snap = null; }
    const board = this.findBoard();
    let s: any = null;
    try { s = board && typeof board.hostPresentation === 'function' ? board.hostPresentation() : null; } catch (e) { s = null; }
    return { state: snap ? snap.state : null, stable: snap ? snap.stable : null, boardPresent: !!board,
      boardProvider: s ? (s.provider || null) : null, boardRegion: s && s.active ? (s.active.region || null) : null };
  }
  /** v0.5: true once the room accepts input (see header). Until then no music is requested at all. */
  roomInteractive(): boolean {
    if (this.worldBoot && !isValid(this.worldBoot, true)) { this.worldBoot = null; this.worldBootChecked = false; }
    if (!this.worldBootChecked) {
      this.worldBootChecked = true;
      try { const scene = director.getScene(); const list = scene ? scene.getComponentsInChildren('WorldIntegrationBoot') : []; this.worldBoot = list && list.length ? list[0] : null; } catch (e) { this.worldBoot = null; }
    }
    return roomInteractiveFrom(!!this.worldBoot, (globalThis as any).__worldLoading);
  }
  /** Read-only status for logs/tests. */
  diagnostics() { return { roomInteractive: this.firstLoadAt !== null || this.roomInteractive(), firstLoadAt: this.firstLoadAt, current: this.current, fellBack: this.fellBack }; }
  private step(_dt: number) {
    const audio = GameAudio.instance; if (!audio) return;
    if (this.firstLoadAt === null && !this.roomInteractive()) return;   // loading page / room not ready: never touch music
    const want = sceneTrackFor(this.probe());
    if (want === null) return;
    if (want !== this.current) { this.current = want; this.fellBack = null; }
    let id: SceneTrackId = want;
    const d: any = audio.musicDiagnostics();
    const t = SCENE_TRACKS[want];
    if (this.fellBack === want) id = 'island';
    else if (want !== 'island' && d && d.status === 'error' && d.path === t.path && (d.bundle || null) === t.bundle) {
      this.fellBack = want; id = 'island';
      console.warn('[SceneMusic] ' + want + ' BGM unavailable, falling back to island BGM:', d.error);
    }
    const track = SCENE_TRACKS[id];
    if (d && d.path === track.path && (d.bundle || null) === track.bundle && d.status !== 'error') return;
    if (d && d.status === 'error' && id === 'island' && d.path === track.path) return;   // island itself failed: do not spin
    // First music of the session: fade in over ROOM_FADE_IN_S once it actually starts (island in the room; any track if the room is skipped).
    const first = this.firstLoadAt === null && (!d || !d.path);
    if (this.firstLoadAt === null) this.firstLoadAt = GameAudio.now();
    audio.setMusic(track.path, track.bundle, first ? { fadeIn: true } : null);
  }
  private findFlow() {
    if (this.flow && isValid(this.flow, true)) return;
    this.flow = null;
    this.refindIn -= POLL_S; if (this.refindIn > 0) return; this.refindIn = REFIND_S;
    try { const scene = director.getScene(); const list = scene ? scene.getComponentsInChildren('WorldFlowComponent') : []; this.flow = list && list.length ? list[0] : null; } catch (e) { this.flow = null; }
  }
  private findBoard(): any {
    if (this.board && isValid(this.board, true) && isValid(this.board.node, true)) return this.board;
    this.board = null;
    try {
      const scene = director.getScene();
      const list: any[] = scene ? scene.getComponentsInChildren('ManagedMobileBoardUI') : [];
      for (let i = 0; i < (list ? list.length : 0); i++) if (isValid(list[i], true) && isValid(list[i].node, true)) { this.board = list[i]; break; }
    } catch (e) { this.board = null; }
    return this.board;
  }
}

// Mount once after the first scene (same pattern as AudioBridge); GameAudio's node is persistent.
director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => SceneMusic.ensure());
