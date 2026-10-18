// SceneMusic.ts — 按所在场景切 BGM，并发布环境音层（海浪 / 海鸥 / 风 / 湖）。
// 对照表在 SceneAudioTable.ts：家里 / 小岛 / 帆船 / 草原 / 湖畔 / 热气球 / 天空之城，外加棋盘。
// 只读轮询，不改游戏状态。曲目加载失败时回落小岛 BGM，同一个场景只回落一次。
// v0.5：房间可操作（__worldLoading.phase === 'ready'，或场景里没有 WorldIntegrationBoot）后才第一次 setMusic，带淡入。
// 换场景：正在播时按 SCENE_AUDIO_CROSSFADE_S（2 s）等功率交叉。加载页不请求音乐。
import { _decorator, Component, director, Director, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { BGM, SCENE_AUDIO_CROSSFADE_S, resolveSceneAudio, publishSceneBed } from './SceneAudioTable';
import type { SceneAudioProbe, SceneTrackId } from './SceneAudioTable';
const { ccclass } = _decorator;

export type { SceneTrackId };
export type SceneTrack = { path: string; bundle: string | null };
export const SCENE_TRACKS: Record<SceneTrackId, SceneTrack> = {
  island: BGM.island, meadow: BGM.meadow, skycity: BGM.skycity,
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

export type SceneProbe = SceneAudioProbe;
/** Pure mapping (tested). null = transitional: keep whatever is playing. */
export function sceneTrackFor(p: SceneProbe): SceneTrackId | null {
  return resolveSceneAudio(p).track;
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
    const j = snap ? snap.journey : null;
    return { state: snap ? snap.state : null, stable: snap ? snap.stable : null, boardPresent: !!board,
      boardProvider: s ? (s.provider || null) : null, boardRegion: s && s.active ? (s.active.region || null) : null, boardStageId:s?.active?.stageId||null,
      journeyTarget: j ? (j.target || null) : null, journeyPhase: j ? (j.phase || null) : null, journeyRegion: j ? (j.region || null) : null };
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
    const decision = resolveSceneAudio(this.probe());
    if (decision.place !== 'hold') publishSceneBed(decision);
    const want = decision.track;
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
    audio.setMusic(track.path, track.bundle, first ? { fadeIn: true } : { xfadeS: SCENE_AUDIO_CROSSFADE_S });
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
