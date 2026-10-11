// SceneMusic.ts — Voice bot：按所在场景切 BGM（小岛 / 草原 / 天空之城），只读轮询，不改任何游戏状态。
//   - WorldFlow 在 skycity（天空城参观）            -> 天空之城 BGM（region_skycity 分包）
//   - 地区棋盘 regional-r05，region = 'sky'          -> 天空之城 BGM
//   - 地区棋盘 regional-r05，region = 'meadow'       -> 草原 BGM（region_meadow 分包）
//   - 其他（家里、小岛、潮汐 tide、主线、R4）         -> 小岛 BGM（resources/audio_bgm/bgm_main，原默认）
//   - skycity-loading / 进关卡还没找到棋盘等过渡状态：保持当前曲目不动。
// 切换由 GameAudio.setMusic(path, bundle) 负责（正在播时 1.5 s 等功率交叉）。场景曲加载失败（例如分包缺失）时
// 回落到小岛 BGM，同一个场景只回落一次，不来回重试；离开该场景后重置。
import { _decorator, Component, director, Director, isValid } from 'cc';
import { GameAudio, DEFAULT_BGM_PATH } from './GameAudio';
const { ccclass } = _decorator;

export type SceneTrackId = 'island' | 'meadow' | 'skycity';
export type SceneTrack = { path: string; bundle: string | null };
export const SCENE_TRACKS: Record<SceneTrackId, SceneTrack> = {
  island: { path: DEFAULT_BGM_PATH, bundle: null },
  meadow: { path: 'audio/bgm_meadow', bundle: 'region_meadow' },
  skycity: { path: 'audio/bgm_skycity', bundle: 'region_skycity' },
};
const POLL_S = 0.25;
const REFIND_S = 1;

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

  static ensure() {
    try {
      const audio = GameAudio.ensure();
      if (!audio.node.getComponent(SceneMusic)) audio.node.addComponent(SceneMusic);
    } catch (e) { console.warn('[SceneMusic] mount failed (silent, gameplay unaffected)', e); }
  }
  onLoad() { SceneMusic.instance = this; }
  onDestroy() { if (SceneMusic.instance === this) SceneMusic.instance = null; this.flow = null; this.board = null; }

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
  private step(_dt: number) {
    const audio = GameAudio.instance; if (!audio) return;
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
    audio.setMusic(track.path, track.bundle);
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
