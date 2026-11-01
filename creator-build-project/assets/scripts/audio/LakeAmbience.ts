// LakeAmbience.ts — 风铃湖畔环境声组件（Voice Bot）。进湖畔（旅程最后一段 / lakeside 状态 / 湖畔棋盘）时把海浪压下去、
// 放湖水+风铃循环；离开湖畔恢复海浪（AmbienceAudio 自己平滑回来）。BGM 不动（SceneMusic 仍是海岛 BGM）。
// 静音 / 后台 / 没有手势：跟 GameAudio.canPlayAmbience()；音量滑条：同 A1c（ambienceBedGain）。素材在 region_lakeside 分包，
// 第一次需要时才加载（分包已经因湖畔场景下载过，不额外占主包）。
import { _decorator, Component, AudioSource, AudioClip, assetManager, director, Director, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { AmbienceAudio, ambienceBedGain } from './AmbienceAudio';
import { LAKE_AMB, LakeAmbienceCore, lakeAmbienceWanted, type LakeProbe } from './LakeAmbienceCore';
const { ccclass } = _decorator;
function qfAudioLog(event: string, data: Record<string, unknown>) { try { if ((globalThis as any).__worldFlowLog) console.info('[QF_AUDIO] ' + JSON.stringify({ event, t: Date.now(), ...data })); } catch { } }
const POLL_S = 0.25;
@ccclass('LakeAmbience')
export class LakeAmbience extends Component {
  static instance: LakeAmbience | null = null;
  private core: LakeAmbienceCore | null = null; private a: AudioSource | null = null; private b: AudioSource | null = null;
  private clip: AudioClip | null = null; private loading = false; private failed = false; private alive = true;
  private flow: any = null; private board: any = null; private poll = 0; private wanted = false;
  static ensure() {
    try { const audio = GameAudio.ensure(); if (!audio.node.getComponent(LakeAmbience)) audio.node.addComponent(LakeAmbience); }
    catch (e) { console.error('[QF_LAKE] lake ambience mount failed', e); }
  }
  onLoad() {
    LakeAmbience.instance = this;
    const mk = () => { const s = this.node.addComponent(AudioSource); s.playOnAwake = false; s.loop = true; s.volume = 0; return s; };
    this.a = mk(); this.b = mk(); this.core = new LakeAmbienceCore(this.a as any, this.b as any, qfAudioLog);
  }
  onDestroy() {
    this.alive = false; AmbienceAudio.lakeActive = false; if (LakeAmbience.instance === this) LakeAmbience.instance = null;
    for (const s of [this.a, this.b]) { try { s?.stop(); if (s) s.clip = null; } catch { } }
    this.clip?.decRef(); this.clip = null;
  }
  quiet() { this.core?.quiet(); }
  diagnostics() { return { wanted: this.wanted, failed: this.failed, loading: this.loading, ...(this.core ? this.core.diagnostics() : {}) }; }
  private load() {
    if (this.loading || this.clip || this.failed) return; this.loading = true; qfAudioLog('lake-load', { bundle: LAKE_AMB.bundle });
    const fail = (stage: string, err: unknown) => { this.loading = false; this.failed = true; console.error('[QF_LAKE] lake ambience ' + stage + ' failed (sea waves stay on): ' + String(err)); qfAudioLog('lake-load-failed', { stage, err: String(err) }); };
    assetManager.loadBundle(LAKE_AMB.bundle, (e, bundle) => {
      if (!this.alive) return; if (e || !bundle) return fail('bundle', e);
      bundle.load(LAKE_AMB.path, AudioClip, (err, clip) => {
        if (!this.alive || !isValid(this.node, true)) return; if (err || !clip) return fail('clip', err);
        clip.addRef(); this.clip = clip; this.loading = false; if (this.a) this.a.clip = clip; if (this.b) this.b.clip = clip;
        if (this.core) this.core.ready = true; qfAudioLog('lake-loaded', { durationS: (clip as any).getDuration?.() ?? null });
      });
    });
  }
  probe(): LakeProbe {
    try {
      if (!this.flow || !isValid(this.flow, true)) { const sc = director.getScene(); this.flow = sc ? sc.getComponentInChildren('WorldFlowComponent') : null; }
      if (!this.board || !isValid(this.board, true)) { const sc = director.getScene(); const list: any[] = sc ? sc.getComponentsInChildren('ManagedMobileBoardUI') : []; this.board = list && list.length ? list[0] : null; }
    } catch { this.flow = null; this.board = null; }
    let snap: any = null, s: any = null;
    try { snap = this.flow && typeof this.flow.commands === 'function' ? this.flow.commands().snapshot() : null; } catch { snap = null; }
    try { s = this.board && typeof this.board.hostPresentation === 'function' ? this.board.hostPresentation() : null; } catch { s = null; }
    const j = snap ? snap.journey : null;
    return { state: snap ? snap.state : null, boardPresent: !!this.board, boardRegion: s && s.active ? (s.active.region || null) : null, boardStageId: s?.active?.stageId || null,
      journeyTarget: j ? j.target || null : null, journeyPhase: j ? j.phase || null : null, journeyRegion: j ? j.region || null : null };
  }
  update(dt: number) {
    const core = this.core; if (!core) return;
    this.poll -= dt; if (this.poll <= 0) { this.poll = POLL_S; const w = lakeAmbienceWanted(this.probe()); if (w !== this.wanted) { this.wanted = w; qfAudioLog(w ? 'lake-enter' : 'lake-exit', {}); } }
    if (this.wanted) this.load();
    const audio: any = GameAudio.instance, canSound = !!audio && audio.canPlayAmbience();
    const bed = audio && typeof audio.getMusicVolume === 'function' ? ambienceBedGain(Number(audio.getMusicVolume()), typeof audio.transitionGain === 'function' ? Number(audio.transitionGain()) : 1) : 1;
    core.step(dt, this.wanted, canSound, bed);
    AmbienceAudio.lakeActive = core.suppressWaves(this.wanted);
  }
}
director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => LakeAmbience.ensure());
(GameAudio as any).ambienceMounters?.push(() => LakeAmbience.ensure());
(GameAudio as any).ambienceQuieters?.push(() => LakeAmbience.instance?.quiet());
